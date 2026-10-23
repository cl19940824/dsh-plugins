/**
 * dsh-context-1m —— 为「当前模型」声明 / 改写上下文窗口（host 半边）
 * =====================================================================
 *
 * 浏览器半边是一个勾选框（渲染在 `conversation.input.right`）：
 *
 *   - 勾选状态 = 当前模型在 llm-pi-ai 配置里**是否声明了 onTokens**（默认 1,000,000）；
 *   - 勾上   → 往 profile 的 `cordis.patch.yml`（llm-pi-ai 条目里该模型的
 *             `providers.<provider>.models[]`）写入 `contextWindow: <onTokens>`；
 *   - 取消   → 写入 `contextWindow: <offTokens>`（逐模型 `models` 表优先，
 *             否则用全局 `offTokens`），**不再删除该字段**。
 *
 * 为什么不删字段：llm-pi-ai 在模型没声明时用 provider 的 `defaultContextWindow`
 * 兜底，而它的默认值是 1e6。所以「取消 = 删字段」会让窗口**仍然是 1M**，
 * 勾选框等于失效；同时把用户手写的诚实值（例如 384000）一起丢掉。
 * 现在取消勾选会显式写回一个安全值，勾选状态也改成「等于 onTokens 才算勾上」，
 * UI 状态与真实语义一致。
 *
 * 为什么这关系到自动压缩：compaction-basic 的触发阈值是
 *   floor(min(W × thresholdRatio, W − O − headroomTokens))
 * 其中 W 就是这个 `contextWindow`。把 W 谎报成 1M 会把阈值顶到 ~800k，
 * 于是压缩永远等不到真实上限。声明值必须诚实（或用 offTokens 写回诚实值）。
 *
 * 生效方式：patch 文件写入后，长驻 surface（web GUI）会热重载 profile 补丁层；
 * 若上下文容量提示没有立刻变化，重开 profile / 重启 dsh 即生效。
 *
 * profile 定位：优先 `DSH_PROFILE_DIR` → `DSH_HOME`+`DSH_PROFILE` → 兜底扫描
 * `$DSH_HOME/profiles/*` 找装了本插件的目录（多个时取 patch 文件最新改动的）。
 *
 * YAML 解析用 profile 共享 store 里的 `yaml`（先裸导入，失败则回退到
 * `$DSH_HOME/profiles/node_modules/yaml/dist/index.js` 以文件 URL 导入），
 * 用 parseDocument 保护注释与排版，只改动目标模型的条目。
 */

import z from '@deepseek-ai/schemastery'
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** 稳定的 cordis 插件名（= entry id）。 */
export const name = 'dsh-context-1m'

const TAG = '[dsh-context-1m]'
const API_STATE = '/api/dsh-context-1m.state'
const API_SET = '/api/dsh-context-1m.set'

/** 勾上时写入的上下文窗口（token）：1M。 */
const CONTEXT_1M = 1000000
/** 取消勾选且未命中逐模型表时写回的安全值（token）。 */
const CONTEXT_OFF = 128000

/** Loader 需要的 Config：全部可在 profile 的 `cordis.patch.yml` 里覆盖。 */
export const Config = z.object({
  /** 勾选时写入的 contextWindow（token）。 */
  onTokens: z.number().step(1).min(1024).max(10000000).default(CONTEXT_1M),
  /** 取消勾选且未命中 `models` 时写回的 contextWindow（token）。 */
  offTokens: z.number().step(1).min(1024).max(10000000).default(CONTEXT_OFF),
  /** 逐模型的取消勾选写回值（命中时优先于 offTokens）。 */
  models: z
    .array(
      z.object({
        provider: z.string(),
        model: z.string(),
        tokens: z.number().step(1).min(1024).max(10000000)
      })
    )
    .default([])
})

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
}

function reasonOf(error) {
  const message = String(error?.message ?? error)
  const code = typeof error?.code === 'string' ? error.code.trim() : ''
  if (code.length === 0 || message.includes(code)) return message
  return `${code}: ${message}`
}

/* -------------------------------------------------------------------------- */
/* 配置归一化                                                                    */
/* -------------------------------------------------------------------------- */

/** 把 apply 拿到的 config 归一化成 { on, off, models }（缺省值兜底）。 */
function normalizePolicy(config) {
  const on = Number.isFinite(config?.onTokens) ? config.onTokens : CONTEXT_1M
  const off = Number.isFinite(config?.offTokens) ? config.offTokens : CONTEXT_OFF
  const models = Array.isArray(config?.models) ? config.models : []
  return { on, off, models }
}

/** 取消勾选时要写回的窗口：先查逐模型表，再退回全局 off。 */
function offTokensFor(policy, provider, model) {
  for (const entry of policy.models) {
    if (entry?.provider === provider && entry?.model === model && Number.isFinite(entry.tokens)) {
      return entry.tokens
    }
  }
  return policy.off
}

/* -------------------------------------------------------------------------- */
/* profile / patch 文件定位                                                      */
/* -------------------------------------------------------------------------- */

function dshHome() {
  const given = (process.env.DSH_HOME ?? '').trim()
  if (given.length > 0) return given
  return join(homedir(), '.dsh')
}

/** 定位当前 profile 目录（优先环境变量，兜底扫描）。找不到返回 null。 */
function resolveProfileDir() {
  const dirEnv = (process.env.DSH_PROFILE_DIR ?? '').trim()
  if (dirEnv.length > 0) return dirEnv
  const nameEnv = (process.env.DSH_PROFILE ?? '').trim()
  if (nameEnv.length > 0) return join(dshHome(), 'profiles', nameEnv)
  const profilesRoot = join(dshHome(), 'profiles')
  let best = null
  try {
    for (const entry of readdirSync(profilesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = join(profilesRoot, entry.name)
      const marker = join(dir, 'node_modules', 'dsh-context-1m')
      const patch = join(dir, 'cordis.patch.yml')
      if (!existsSync(marker) || !existsSync(patch)) continue
      const rec = { dir, patchMtime: statSync(patch).mtimeMs }
      if (best === null || rec.patchMtime > best.patchMtime) best = rec
    }
  } catch { /* 扫描失败就交给上层报错 */ }
  return best ? best.dir : null
}

/** profile 下的用户补丁层（llm-pi-ai 配置就写在这里）。 */
function patchFileOf(profileDir) {
  return join(profileDir, 'cordis.patch.yml')
}

/* -------------------------------------------------------------------------- */
/* yaml 解析（双路导入，注释与排版由 parseDocument 保留）                          */
/* -------------------------------------------------------------------------- */

let yamlPromise = null

async function loadYamlModule() {
  try {
    return await import('yaml')
  } catch { /* 运行时的解析器可能够不到共享 store，走下面的绝对路径 */ }
  const candidates = [
    join(dshHome(), 'profiles', 'node_modules', 'yaml', 'dist', 'index.js'),
    (() => {
      const dir = resolveProfileDir()
      return dir ? join(dirname(dir), 'node_modules', 'yaml', 'dist', 'index.js') : ''
    })()
  ]
  for (const candidate of candidates) {
    if (candidate.length > 0 && existsSync(candidate)) {
      return await import(pathToFileURL(candidate).href)
    }
  }
  throw new Error('找不到可用的 yaml 库（$DSH_HOME/profiles/node_modules/yaml/dist/index.js）')
}

function yamlModule() {
  yamlPromise ??= loadYamlModule()
  return yamlPromise
}

/* -------------------------------------------------------------------------- */
/* cordis.patch.yml 里的定位与编辑                                               */
/* -------------------------------------------------------------------------- */

/** 顶层数组里 llm-pi-ai 条目的下标；找不到返回 -1。 */
function llmEntryIndex(doc) {
  const seq = doc.contents
  if (!seq || !Array.isArray(seq.items)) return -1
  for (let i = 0; i < seq.items.length; i++) {
    const id = seq.items[i]?.get?.('id')
    const nm = seq.items[i]?.get?.('name')
    if (id === 'llm-pi-ai' || nm === '@deepseek-ai/dsh-llm-pi-ai') return i
  }
  return -1
}

/**
 * 定位 llm-pi-ai 配置里 (provider, model) 对应的 models 序列下标。
 * 返回 { ok, base?, why? }；base 是直达该模型条目的路径数组。
 */
function modelEntryPath(doc, entryIndex, provider, model) {
  const config = doc.getIn([entryIndex, 'config'])
  if (!config || typeof config.get !== 'function') return { ok: false, why: 'llm-pi-ai 条目没有 config' }
  const providers = config.get('providers')
  if (!providers || typeof providers.get !== 'function') return { ok: false, why: 'llm-pi-ai config 里没有 providers' }
  const route = providers.get(provider)
  if (!route || typeof route.get !== 'function') return { ok: false, why: `provider "${provider}" 未配置` }
  const models = route.get('models')
  if (!models || !Array.isArray(models.items)) return { ok: false, why: `provider "${provider}" 没有 models 列表` }
  for (let j = 0; j < models.items.length; j++) {
    if (models.items[j]?.get?.('id') === model) {
      return { ok: true, base: [entryIndex, 'config', 'providers', provider, 'models', j] }
    }
  }
  return { ok: false, why: `模型 "${model}" 未在 llm-pi-ai 的 ${provider}.models 中找到` }
}

/** 当前模型（浏览器半边投影为空时的回退）。 */
function defaultModel(ctx) {
  try {
    const agentDefault = ctx.get('agentDefaultModel')
    const s = agentDefault && typeof agentDefault.currentSelection === 'function' ? agentDefault.currentSelection() : null
    if (s && typeof s.provider === 'string' && typeof s.model === 'string') return { provider: s.provider, model: s.model }
  } catch { /* ignore */ }
  return null
}

function writePatchAtomic(file, content) {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, content, 'utf8')
  renameSync(tmp, file)
}

/** 从 Request 里取查询参数（兼容绝对/相对 URL）。 */
function queryParamsOf(request) {
  const urlText = String(request.url ?? '')
  const qIndex = urlText.indexOf('?')
  return new URLSearchParams(qIndex >= 0 ? urlText.slice(qIndex + 1) : '')
}

/* -------------------------------------------------------------------------- */
/* 面板 / API                                                                   */
/* -------------------------------------------------------------------------- */

export function apply(ctx, config) {
  const policy = normalizePolicy(config)
  ctx.inject(['connection'], (scoped) => {
    const conn = scoped.connection

    /** 读状态：当前模型的 contextWindow 是否等于 onTokens（默认 1M）。 */
    const handleState = async (request) => {
      try {
        const params = queryParamsOf(request)
        let provider = (params.get('provider') ?? '').trim()
        let model = (params.get('model') ?? '').trim()
        if (!provider || !model) {
          const def = defaultModel(ctx)
          provider = def?.provider ?? ''
          model = def?.model ?? ''
        }
        const profileDir = resolveProfileDir()
        if (!profileDir) throw new Error('定位不到 profile 目录（DSH_PROFILE_DIR / DSH_PROFILE 未设置，也没扫到装着本插件的 profile）')
        const file = patchFileOf(profileDir)
        const { parseDocument } = await yamlModule()
        const doc = parseDocument(readFileSync(file, 'utf8'))
        const entry = llmEntryIndex(doc)
        const located = entry >= 0 && provider && model ? modelEntryPath(doc, entry, provider, model) : { ok: false }
        const raw = located.ok ? doc.getIn([...located.base, 'contextWindow']) : undefined
        const declared = typeof raw === 'number' ? raw : undefined
        // 勾选语义：显式声明了 onTokens 才算「已勾选 1M」。声明了别的值（如 384000）
        // 显示为未勾选，但 declared 会如实带回，避免 UI 骗人。
        const checked = declared === policy.on
        return json({
          ok: true,
          provider,
          model,
          has: checked,
          checked,
          declared: declared ?? null,
          onTokens: policy.on,
          offTokens: offTokensFor(policy, provider, model),
          profile: basename(profileDir),
          patch: file
        })
      } catch (error) {
        return json({ ok: false, error: reasonOf(error) }, 500)
      }
    }

    /** 写状态：勾上写 onTokens，取消写 offTokens（逐模型表优先），都不删字段。 */
    const handleSet = async (request) => {
      try {
        let body
        try {
          body = await request.json()
        } catch {
          return json({ ok: false, error: '请求体不是合法 JSON' }, 400)
        }
        const provider = typeof body?.provider === 'string' ? body.provider.trim() : ''
        const model = typeof body?.model === 'string' ? body.model.trim() : ''
        const enabled = body?.enabled === true
        if (!provider || !model) return json({ ok: false, error: '缺少 provider / model' }, 400)

        const profileDir = resolveProfileDir()
        if (!profileDir) throw new Error('定位不到 profile 目录（DSH_PROFILE_DIR / DSH_PROFILE 未设置，也没扫到装着本插件的 profile）')
        const file = patchFileOf(profileDir)
        if (!existsSync(file)) throw new Error(`profile 补丁文件不存在：${file}`)

        const { parseDocument } = await yamlModule()
        const doc = parseDocument(readFileSync(file, 'utf8'))
        const entry = llmEntryIndex(doc)
        if (entry < 0) return json({ ok: false, error: 'llm-pi-ai 未在 profile 的 cordis.patch.yml 中找到' }, 404)
        const located = modelEntryPath(doc, entry, provider, model)
        if (!located.ok) return json({ ok: false, error: located.why }, 404)

        const tokens = enabled ? policy.on : offTokensFor(policy, provider, model)
        doc.setIn([...located.base, 'contextWindow'], tokens)
        writePatchAtomic(file, doc.toString({ lineWidth: 0 }))
        console.error(`${TAG} 已写入 contextWindow：${provider} / ${model} -> ${tokens}（${file}）`)
        return json({ ok: true, provider, model, enabled, tokens, profile: basename(profileDir), patch: file })
      } catch (error) {
        return json({ ok: false, error: reasonOf(error) }, 500)
      }
    }

    const routes = [
      { path: API_STATE, methods: ['GET'], fetch: (request) => handleState(request) },
      { path: API_SET, methods: ['POST'], fetch: (request) => handleSet(request) }
    ]
    // 一条一条注册、各自 try：热重载时一条失败不连累另一条
    for (const route of routes) {
      try {
        conn.fetch.register({ ...route, requestBody: 'buffered' })
        console.error(`${TAG} 接口已注册：${route.methods.join('/')} ${route.path}`)
      } catch (error) {
        console.error(`${TAG} 注册 ${route.path} 失败：${reasonOf(error)}`)
      }
    }

    const dir = resolveProfileDir()
    console.error(`${TAG} patch = ${dir ? patchFileOf(dir) : '（profile 目录未定位到）'} · on=${policy.on} off=${policy.off} models=${policy.models.length}`)
  })
}

export const inject = []

export default { name, apply, Config }
