/**
 * dsh-file-explorer —— 宿主半边。
 *
 * 只做「读工作区、写单个文件」这一件事，所有请求都从浏览器半边发过来：
 *
 *   POST /api/file-explorer
 *     { action: 'roots' }                       → 工作区列表（含默认项）
 *     { action: 'list',  root, path }           → 目录的直接子项
 *     { action: 'read',  root, path }           → 文本 / 二进制 / 超大 的判定结果
 *     { action: 'image', root, path }           → 图片的 base64 + mime
 *     { action: 'write', root, path, text, version } → 保存（可带版本校验）
 *
 * 落盘走 `ctx.fs`（dsh 的抽象文件系统），不自己拼 node:fs —— 这样沙箱、远端
 * backend、版本校验这些策略都还是官方那一套。路径一律要求落在某个工作区根目录
 * 内（`fs.contains` 判断），树里的东西出不去。
 */

import { basename, extname } from 'node:path'

export const name = 'dsh-file-explorer'

/** web profile 才有 connection；fs 是硬依赖。都写在 apply 的 ctx.inject 里按需绑定。 */
export const inject = []

const TAG = '[dsh-file-explorer]'

/** 浏览器半边的唯一入口。 */
const API = '/api/file-explorer'

/** 文本预览上限：超过就只让用户在编辑器外看（避免把巨大的东西塞进 DOM）。 */
const MAX_TEXT_BYTES = 2 * 1024 * 1024

/** 图片上限：base64 之后还要再涨 4/3，别太大。 */
const MAX_IMAGE_BYTES = 12 * 1024 * 1024

/** 单个目录最多返回多少项。 */
const MAX_ENTRIES = 4000

/** 二进制判定的采样长度。 */
const SNIFF_BYTES = 8192

/** 树里默认不显示的东西（和 Xcode 隐藏 .git / 构建产物的习惯一致）。 */
const SKIP_NAMES = new Set([
  '.git',
  '.svn',
  '.hg',
  '.DS_Store',
  'node_modules',
  '__pycache__',
  '.venv',
  'venv',
  '.next',
  '.nuxt',
  '.cache',
  'dist',
  'build',
  'coverage',
  '.idea',
  '.gradle',
  'target',
])

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function fail(error, extra) {
  return json({ ok: false, error, ...(extra || {}) })
}

/** 把一个绝对路径限制在 root 里面。 */
async function targetIn(fs, root, path) {
  if (typeof root !== 'string' || !root) throw new Error('缺少工作区根目录')
  if (typeof path !== 'string' || !path) throw new Error('缺少路径')
  const rootTarget = await fs.resolve(root)
  const target = await fs.resolve(path)
  if (!fs.contains(rootTarget, target)) throw new Error('路径不在当前工作区内')
  return target
}

/** 目录列表：目录在前、文件在后，各自按名字排。 */
function sortEntries(entries) {
  const weight = (entry) => (entry.type === 'directory' ? 0 : entry.type === 'file' ? 1 : 2)
  return entries.sort((a, b) => {
    const d = weight(a) - weight(b)
    if (d !== 0) return d
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
}

/**
 * 建一个处理函数，把 ctx 上的服务闭包进来。
 *
 * @param fs - 抽象文件系统服务。
 * @param registry - workspaceRegistry。
 * @param workingDirectory - workingDirectory。
 */
function createHandler(fs, registry, workingDirectory) {
  async function roots() {
    let list = []
    try {
      list = registry.list()
    } catch {
      list = []
    }
    const mapped = list.map((workspace) => ({
      id: String(workspace.id),
      title: workspace.title || basename(workspace.path),
      path: workspace.path,
    }))
    const fallback = workingDirectory && typeof workingDirectory.defaultDirectory === 'string'
      ? workingDirectory.defaultDirectory
      : ''
    if (!mapped.length && fallback) {
      mapped.push({ id: '', title: basename(fallback), path: fallback })
    }
    let index = mapped.findIndex((entry) => entry.path === fallback)
    if (index < 0) index = 0
    return json({ ok: true, roots: mapped, index })
  }

  async function list(body) {
    const target = await targetIn(fs, body.root, body.path)
    const info = await fs.stat(target)
    if (!info) return fail('目录不存在')
    if (info.type !== 'directory') return fail('不是目录')
    const entries = await fs.listDir(target)
    const mapped = []
    for (const entry of entries) {
      if (SKIP_NAMES.has(entry.name)) continue
      if (entry.type !== 'file' && entry.type !== 'directory') continue
      mapped.push({
        name: entry.name,
        type: entry.type,
        size: typeof entry.size === 'number' ? entry.size : null,
      })
    }
    sortEntries(mapped)
    return json({
      ok: true,
      path: body.path,
      entries: mapped.slice(0, MAX_ENTRIES),
      truncated: mapped.length > MAX_ENTRIES,
    })
  }

  async function read(body) {
    const target = await targetIn(fs, body.root, body.path)
    const info = await fs.stat(target)
    if (!info) return fail('文件不存在')
    if (info.type === 'directory') return fail('这是一个文件夹')
    if (info.type !== 'file') return fail('这个条目不是普通文件')
    const size = typeof info.size === 'number' ? info.size : 0
    if (size > MAX_TEXT_BYTES) {
      return json({ ok: true, kind: 'too-large', size })
    }
    // 先嗅一小段判断二进制：readBytes 对超限文件会直接抛，所以用 readByteRange。
    let head
    try {
      head = await fs.readByteRange(target, { offset: 0, length: Math.min(size, SNIFF_BYTES) })
    } catch {
      head = new Uint8Array(0)
    }
    if (head.includes(0)) {
      return json({ ok: true, kind: 'binary', size })
    }
    let text = ''
    try {
      text = await fs.readText(target)
    } catch (error) {
      return json({ ok: true, kind: 'binary', size, reason: String(error && error.message) })
    }
    return json({
      ok: true,
      kind: 'text',
      text,
      size,
      version: String(info.version),
      path: body.path,
    })
  }

  async function image(body) {
    const target = await targetIn(fs, body.root, body.path)
    const info = await fs.stat(target)
    if (!info) return fail('文件不存在')
    const size = typeof info.size === 'number' ? info.size : 0
    if (size > MAX_IMAGE_BYTES) return fail('图片太大，无法预览')
    const bytes = await fs.readBytes(target, undefined, MAX_IMAGE_BYTES)
    const mime = MIME[extname(body.path).toLowerCase()] || 'application/octet-stream'
    return json({
      ok: true,
      mime,
      size,
      base64: Buffer.from(bytes).toString('base64'),
    })
  }

  async function write(body) {
    const target = await targetIn(fs, body.root, body.path)
    const info = await fs.stat(target)
    if (!info) return fail('文件不存在')
    if (info.type !== 'file') return fail('只能保存文件')
    const text = typeof body.text === 'string' ? body.text : ''
    const intent = typeof body.version === 'string' && body.version
      ? { kind: 'replaceIfVersion', version: body.version }
      : undefined
    try {
      const outcome = await fs.writeText(target, text, intent)
      return json({
        ok: true,
        version: String(outcome.version),
        operation: outcome.operation,
        bytes: Buffer.byteLength(text, 'utf8'),
      })
    } catch (error) {
      const message = String((error && error.message) || error)
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      const stale = /STALE_VERSION/i.test(code) || /STALE_VERSION|stale/i.test(message)
      return fail(message, stale ? { stale: true, code: code || 'FS_STALE_VERSION' } : undefined)
    }
  }

  /**
   * 递归按名字搜索：筛选框不能只看「已展开」的分支，否则藏在折叠目录里的
   * Podfile 永远搜不到。走的是 listDir 拿到的真实条目，路径只做拼接，不接受
   * 客户端给的任意相对路径。
   */
  async function search(body) {
    const root = String(body.root || '')
    const query = String(body.query || '').trim().toLowerCase()
    const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 500)
    if (!query) return json({ ok: true, entries: [] })
    await targetIn(fs, root, root)
    const hits = []
    let visited = 0
    let truncated = false
    const walk = async (dir, rel, depth) => {
      if (hits.length >= limit || depth > 8) {
        truncated = truncated || hits.length >= limit
        return
      }
      let entries
      try {
        entries = await fs.listDir(await fs.resolve(dir))
      } catch {
        return
      }
      for (const entry of entries) {
        if (hits.length >= limit) {
          truncated = true
          return
        }
        if (SKIP_NAMES.has(entry.name)) continue
        if (entry.type !== 'file' && entry.type !== 'directory') continue
        visited += 1
        if (visited > MAX_ENTRIES) {
          truncated = true
          return
        }
        const path = `${dir}/${entry.name}`
        const relPath = rel ? `${rel}/${entry.name}` : entry.name
        if (entry.name.toLowerCase().includes(query)) {
          hits.push({ path, rel: relPath, name: entry.name, type: entry.type })
        }
        if (entry.type === 'directory') await walk(path, relPath, depth + 1)
      }
    }
    await walk(root, '', 0)
    return json({ ok: true, entries: hits, truncated })
  }

  return async function handle(request) {
    let body = null
    try {
      body = await request.json()
    } catch {
      body = null
    }
    if (!body || typeof body.action !== 'string') return json({ ok: false, error: '缺少 action' }, 400)
    try {
      switch (body.action) {
        case 'roots':
          return await roots()
        case 'list':
          return await list(body)
        case 'read':
          return await read(body)
        case 'image':
          return await image(body)
        case 'write':
          return await write(body)
        case 'search':
          return await search(body)
        default:
          return json({ ok: false, error: `未知 action：${body.action}` }, 400)
      }
    } catch (error) {
      const message = String((error && error.message) || error)
      return json({ ok: false, error: message })
    }
  }
}

/**
 * 挂上接口。fs / workspaceRegistry 是硬依赖，connection 只有 web profile 才有，
 * 所以统一放进 ctx.inject 里按需绑定。
 */
export function apply(ctx) {
  ctx.inject(['connection', 'fs', 'workspaceRegistry', 'workingDirectory'], (scoped) => {
    try {
      const handler = createHandler(scoped.fs, scoped.workspaceRegistry, scoped.workingDirectory)
      scoped.connection.fetch.register({
        path: API,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: handler,
      })
      console.error(`${TAG} 文件接口 = ${API}`)
    } catch (error) {
      console.error(`${TAG} 注册 ${API} 失败：${String(error && error.message)}`)
    }
  })
}

export default { name, inject, apply }
