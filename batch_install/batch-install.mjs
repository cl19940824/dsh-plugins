/**
 * dsh-batch-install —— 宿主半边。
 *
 * 只干一件事：把一个目录扫一遍，列出里面的 dsh 插件包。真正的安装由界面
 * （lib/client.js）逐个调用 dsh 自带的 `remote.pluginManager.installBundle` 完成，
 * 所以 pnpm、profile 清单、bundle 选中、HMR 重组合都还是官方那条通道，
 * 本插件既不写 profile 文件，也不自己跑 pnpm。
 *
 * 扫描判据跟 `dsh-plugin-install` 技能的安装脚本一致：
 *   - 标准 bundle：package.json 里有 `dsh.bundle.patch`
 *   - 旧形态：目录里有 manifest.json
 * 选中的目录本身是插件就返回它自己；否则看它的一级子目录（插件根形态）。
 *
 * 传输层：只有 web profile 有 `connection`，所以它写在 `ctx.inject` 里按需绑定，
 * 不放进静态 `inject` —— 否则 headless / tui profile 里插件会永远停在 pending。
 * 路由挂在 connection 自己的 `/api` 共享 Fetch 处理器下，Host/Origin 围栏与
 * 浏览器 cookie 鉴权它已经处理，页面里同源 fetch 即可。
 */

import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

export const name = 'dsh-batch-install'

/** 本插件没有「非有它不可」的服务：session / connection 都不写在这里。 */
export const inject = []

const TAG = '[dsh-batch-install]'

/** 页面读取入口：POST 一个目录，拿回里面的插件清单。 */
const API_SCAN = '/api/plugin-batch.scan'

/** 扫描时跳过的目录名（插件包里不可能再套一层插件）。 */
const SKIP_NAMES = new Set([
  'node_modules',
  '__pycache__',
  '.git',
  '.venv',
  'venv',
  'dist',
  'build',
  'coverage',
  '.cache',
])

/** 一次扫描最多看多少个子目录，防止误选到超大目录时卡住。 */
const MAX_CHILDREN = 400

/** 返回给界面的「跳过原因」最多几条（够界面提示就行）。 */
const MAX_SKIPPED = 40

/** JSON 响应；一律 no-store，避免浏览器缓存扫描结果。 */
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/** 读一个 JSON 文件，读不到 / 解析不了都返回 null —— 扫描过程不该因为坏文件中断。 */
async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

/** 取 `exports["./client"]` 指向的文件（兼容 { default } 形态）。 */
function clientEntryOf(pkg) {
  const exported = pkg && pkg.exports
  if (!exported || typeof exported !== 'object') return null
  const entry = exported['./client']
  if (typeof entry === 'string') return entry
  if (entry && typeof entry === 'object' && typeof entry.default === 'string') return entry.default
  return null
}

/**
 * 读一个候选目录的插件元信息。
 *
 * @param dir - 候选目录的绝对路径。
 * @param folder - 显示用的目录名。
 * @returns 插件信息；不是插件包时返回 null。
 */
async function describe(dir, folder) {
  const pkg = await readJson(join(dir, 'package.json'))
  const dsh = (pkg && typeof pkg === 'object' && pkg.dsh) || {}
  const patch = dsh.bundle && typeof dsh.bundle.patch === 'string' ? dsh.bundle.patch : ''

  if (pkg && patch) {
    const clientEntry = clientEntryOf(pkg)
    return {
      path: dir,
      folder,
      kind: 'bundle',
      name: typeof pkg.name === 'string' && pkg.name ? pkg.name : folder,
      version: typeof pkg.version === 'string' ? pkg.version : null,
      description: typeof pkg.description === 'string' ? pkg.description : null,
      hasClient: typeof clientEntry === 'string' && existsSync(join(dir, clientEntry)),
      hasPatch: existsSync(join(dir, patch)),
      // 只有标准 bundle 形态能走插件管理器的 installBundle
      installable: true,
    }
  }

  if (existsSync(join(dir, 'manifest.json'))) {
    const meta = await readJson(join(dir, 'manifest.json'))
    const entry = (meta && typeof meta.entry === 'string' && meta.entry) || `${folder}.mjs`
    return {
      path: dir,
      folder,
      kind: 'legacy',
      name: (meta && typeof meta.name === 'string' && meta.name) || folder,
      version: typeof meta.version === 'string' ? meta.version : null,
      description: (meta && typeof meta.description === 'string' && meta.description) || null,
      hasClient: existsSync(join(dir, 'lib/client.js')),
      hasPatch: false,
      // 旧形态要复制到 profile/plugins + 追加 cordis insert，插件管理器装不了，
      // 让界面明确标出来，而不是让用户装到一半失败。
      installable: false,
      entry,
    }
  }

  return null
}

/** 判断一个目录项要不要看：目录（含符号链接指向的目录）才看。 */
async function isDirectory(path, dirent) {
  if (dirent.isDirectory()) return true
  if (!dirent.isSymbolicLink()) return false
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

/**
 * POST /api/plugin-batch.scan
 *
 * 请求体：`{ "dir": "/绝对/路径" }`
 * 响应：`{ ok: true, dir, self, plugins: [...], skipped: [...], truncated }`
 *      或 `{ ok: false, error }`（HTTP 200，错误给人看）
 */
async function handleScan(request) {
  let body = null
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const raw = body && typeof body.dir === 'string' ? body.dir.trim() : ''
  if (!raw) return json({ ok: false, error: '缺少目录参数' }, 400)

  const dir = resolve(raw)
  let info
  try {
    info = await stat(dir)
  } catch {
    return json({ ok: false, error: `目录不存在：${dir}` })
  }
  if (!info.isDirectory()) return json({ ok: false, error: `不是目录：${dir}` })

  const plugins = []
  const skipped = []

  // 1) 选中的目录自己就是一个插件包 —— 直接返回它（典型的「选到插件目录本身」）
  const self = await describe(dir, basename(dir) || dir)
  if (self) {
    plugins.push({ ...self, self: true })
    return json({ ok: true, dir, self: true, plugins, skipped, truncated: false })
  }

  // 2) 否则当成插件根，扫一层子目录
  let dirents = []
  try {
    dirents = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    return json({ ok: false, error: `目录读不出来：${String(error?.message ?? error)}` })
  }

  const names = dirents
    .map((dirent) => dirent.name)
    .filter((entry) => !entry.startsWith('.') && !SKIP_NAMES.has(entry))
    .sort((a, b) => a.localeCompare(b))
  const truncated = names.length > MAX_CHILDREN
  const byName = new Map(dirents.map((dirent) => [dirent.name, dirent]))

  for (const entry of names.slice(0, MAX_CHILDREN)) {
    const child = join(dir, entry)
    if (!(await isDirectory(child, byName.get(entry)))) {
      skipped.push({ folder: entry, reason: '不是目录' })
      continue
    }
    const described = await describe(child, entry)
    if (described) plugins.push({ ...described, self: false })
    else skipped.push({ folder: entry, reason: '没有 package.json(dsh.bundle.patch) 或 manifest.json' })
  }

  return json({
    ok: true,
    dir,
    self: false,
    plugins,
    skipped: skipped.slice(0, MAX_SKIPPED),
    skippedTotal: skipped.length,
    truncated,
  })
}

/**
 * 挂上扫描接口。
 *
 * @param ctx - 宿主侧插件 context。
 */
export function apply(ctx) {
  ctx.inject(['connection'], (scoped) => {
    try {
      scoped.connection.fetch.register({
        path: API_SCAN,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: (request) => handleScan(request),
      })
      console.error(`${TAG} 扫描接口 = ${API_SCAN}`)
    } catch (error) {
      console.error(`${TAG} 注册 ${API_SCAN} 失败：${String(error?.message ?? error)}`)
    }
  })
}

export default { name, inject, apply }
