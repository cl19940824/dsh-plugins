/**
 * review.mjs —— dsh-review 宿主入口（host 半边）。
 *
 * 做三件事：
 *   1. **采集**：订阅 `session/event`，对每次 write / edit / str_replace_editor 改动
 *      在 tool/call 时同步读取磁盘（改动前的 before），在 tool/result 时读取磁盘
 *      （改动后的 after），用引擎算出差异块并汇总进审查账本。
 *   2. **API**：通过 connection 的鉴权通道暴露 /api/review.* ，供浏览器半边做
 *      保留/回退、撤销/重做、导入 git、读取审查数据。
 *   3. **持久化**：账本放 `<DSH_UI_DATA_DIR>/data/review.json`，重启后接着审。
 *
 * 关键时序（为什么能读到 before）：
 *   dsh-agent-loop 在 append("tool/call") 这一步会**同步**派发 session/event，之后
 *   才 await 工具调度器去执行。所以本插件在收到 tool/call 时，工具还没真正改文件，
 *   此刻 readFileSync 拿到的就是改动前的原样；到 tool/result 时再读，就是改动后的
 *   结果。编辑器、工具失败的没成功落盘的，前后一样，引擎会跳过（空 diff）。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { createEngine } from './lib/engine.mjs'

export const name = 'review'

const TAG = '[dsh-review]'

/** 需要追踪的、会改动文件的工具。 */
const EDIT_TOOLS = new Set(['write', 'edit', 'str_replace_editor'])
/** str_replace_editor 里会改文件的 command。 */
const MUTATING_COMMANDS = new Set(['create', 'str_replace', 'insert'])

function appDataRoot() {
  const given = (process.env.DSH_UI_DATA_DIR ?? '').trim()
  if (given.length > 0) return given
  const base = (process.env.LOCALAPPDATA ?? '').trim() || homedir()
  return join(base, 'DeepSeekHarness')
}

function dataFilePath() {
  const explicit = (process.env.DSH_REVIEW_DATA ?? '').trim()
  if (explicit.length > 0) return explicit
  return join(appDataRoot(), 'data', 'review.json')
}

/** 是否有 connection（web）服务 — 见 apply 里的按需绑定。 */

/** 从工具参数里取文件路径。 */
function filePathOf(toolName, args) {
  if (!args || typeof args !== 'object') return null
  if (toolName === 'str_replace_editor') {
    // 只追踪真正改文件的 command
    const cmd = args.command
    if (!MUTATING_COMMANDS.has(cmd)) return null
    return typeof args.path === 'string' ? args.path : null
  }
  // write / edit
  const p = args.file_path
  return typeof p === 'string' ? p : null
}

/** 把 session 事件的 payload 解析成对象。 */
function parseArgs(raw) {
  if (typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** 从 tool/result 的 message 里捞出 callId 与是否出错。 */
function resultIdentity(event) {
  const data = event.data
  if (!data || typeof data !== 'object') return null
  const message = data.message
  if (!message || typeof message !== 'object') return null
  const callId = message.source?.callId ?? message.content?.[0]?.toolCallId
  if (typeof callId !== 'string') return null
  const isError = message.content?.[0]?.isError === true
  return { callId, isError }
}

/**
 * 采集器：每个会话记一个水位，增量消费事件；跨会话用 WeakMap。
 *
 * 采集策略（混合）：
 *   - 属于某个 git 仓库的文件 → 用 `git diff HEAD` 采集（source=git）。
 *   - 不属于任何 git 仓库的文件 → 用 before/after 快照采集（source=agent）。
 *
 * 切换工作空间时主动扫描该工作空间下的所有 git 仓库；agent 改动时按文件所属目录
 * 探测 git（带缓存），git 内走 git diff，git 外走快照。
 */
function createCollector(engine) {
  const marks = new WeakMap()
  let gitTimer = null
  const pendingDirs = new Set()
  const gitDirCache = new Map() // 目录 → 是否在 git 仓库内（缓存探测结果）

  function scheduleGitDir(dir) {
    if (!dir) return
    pendingDirs.add(dir)
    if (gitTimer !== null) return
    gitTimer = setTimeout(() => {
      gitTimer = null
      const dirs = [...pendingDirs]
      pendingDirs.clear()
      for (const d of dirs) {
        engine.syncGitForFile(d).catch(() => {})
      }
    }, 400)
  }

  function recordFromPending(pending, event, session) {
    let afterText = null
    try {
      afterText = readFileSync(pending.abs, 'utf8')
    } catch {
      afterText = '' // 文件被删空之类
    }
    engine.recordChange({
      tool: pending.tool,
      abs: pending.abs,
      beforeText: pending.beforeText,
      afterText,
      ts: new Date(event.time ?? Date.now()).toISOString(),
      workspaceRoot: session && session.header && session.header.cwd,
    })
  }

  /** 回放单个事件，不改文件。 */
  function fold(session, event) {
    if (event === null || typeof event !== 'object') return
    const type = event.type
    const data = event.data
    if (!data || typeof data !== 'object') return

    if (type === 'tool/call' && EDIT_TOOLS.has(data.name)) {
      const args = parseArgs(data.arguments)
      const raw = filePathOf(data.name, args)
      if (raw === null) return
      const abs = engine.resolveAbs(raw)
      if (!abs) return
      // 此刻工具还没改文件，读磁盘拿 before（git 外文件用快照，git 内文件用不到但无害）
      let beforeText = null
      try {
        beforeText = readFileSync(abs, 'utf8')
      } catch {
        beforeText = null // 新建/不存在
      }
      engine.pendingBefores.set(data.callId, { abs, tool: data.name, beforeText })
      return
    }

    if (type === 'tool/result') {
      const identity = resultIdentity(event)
      if (!identity) return
      const pending = engine.pendingBefores?.get(identity.callId)
      if (!pending) return
      engine.pendingBefores.delete(identity.callId)
      if (identity.isError) return // 失败没落盘，前后一样，跳过

      const dir = dirname(pending.abs)
      const cached = gitDirCache.get(dir)
      if (cached === true) {
        scheduleGitDir(dir)
      } else if (cached === false) {
        recordFromPending(pending, event, session)
      } else {
        // 首次碰到该目录：探测它是否在 git 仓库内，据此决定 git diff 还是快照
        engine.detectGitAt(pending.abs).then((isGit) => {
          gitDirCache.set(dir, isGit)
          if (isGit) scheduleGitDir(dir)
          else recordFromPending(pending, event, session)
        })
      }
    }
  }

  function track(session) {
    if (session === null || typeof session !== 'object') return
    if (typeof session.eventAt !== 'function') return
    // 用会话工作区更新 engine 的 root（工作区 = session.header.cwd）
    const cwd = session.header && session.header.cwd
    if (cwd) {
      const changed = engine.setRoot(cwd)
      if (changed) {
        // 切换到新工作空间：setRoot 已清空旧账本，这里主动扫描新工作空间下的 git 仓库
        console.error(`${TAG} 切换工作区 → ${cwd}`)
        gitDirCache.clear()
        pendingDirs.clear()
        if (gitTimer !== null) { clearTimeout(gitTimer); gitTimer = null }
        engine.scanWorkspace().then((r) => {
          console.error(`${TAG} 扫描完成（${cwd}）：git（${r.repos.length} 个仓库），新增 ${r.added.length} 个文件`)
        }).catch((err) => {
          console.error(`${TAG} 扫描失败：${String(err?.message ?? err)}`)
        })
      }
    }
    const total = Number(session.seq)
    if (!Number.isFinite(total) || total < 0) return
    let seen = marks.get(session)
    if (seen === undefined) {
      marks.set(session, total) // 只统计“本插件在场后”新发生的，不回填历史
      return
    }
    if (seen >= total) return
    for (let seq = seen; seq < total; seq += 1) {
      let event
      try {
        event = session.eventAt(seq)
      } catch {
        break
      }
      if (event === undefined || event === null) break
      fold(session, event)
    }
    marks.set(session, total)
  }

  return { track }
}

export function apply(ctx) {
  const engine = createEngine({ dataFile: dataFilePath(), workspaceRoot: process.cwd() })
  // 收集当前会话里还没配对的 tool/call
  engine.pendingBefores = new Map()

  ctx.effect(() => {
    engine.flush()
    engine.dispose()
  }, `${TAG}: flush review data`)

  ctx.inject(['connection'], (scoped) => {
    try {
      const conn = scoped.connection.fetch
      const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } })

      // 读审查数据
      conn.register({
        path: '/api/review',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: () => {
          const v = engine.view()
          console.error(`${TAG} [API] view 请求 → ${v.workspaceRoot}，files=${v.files.length}`)
          return Promise.resolve(json(v))
        },
      })

      // 轻量统计（顶部审查入口轮询用，避免整包下发文件内容）
      conn.register({
        path: '/api/review.stats',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: () => {
          const s = engine.stats()
          console.error(`${TAG} [API] stats 请求 → ${s.workspaceRoot}，pending=${s.pendingHunks}，files=${s.files}`)
          return Promise.resolve(json(s))
        },
      })

      // 客户端调试上报（排查切工作区后 badge 不更新用）
      conn.register({
        path: '/api/review.debug',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            const body = await request.json()
            console.error(`${TAG} [DEBUG] ${JSON.stringify(body)}`)
            return json({ ok: true })
          } catch (e) {
            return json({ ok: false, error: String(e?.message ?? e) })
          }
        },
      })

      // 决策：保留 / 回退（整文件或 hunk 集合）
      conn.register({
        path: '/api/review.decide',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            const body = await request.json()
            if (body?.action !== 'keep' && body?.action !== 'revert') return json({ ok: false, error: '未知操作' }, 400)
            const abs = engine.resolveAbs(body?.file ?? body?.path)
            if (!abs) return json({ ok: false, error: '未知文件' }, 400)
            const out = engine.decide({
              source: body?.source ?? 'agent',
              abs,
              hunkIds: Array.isArray(body?.hunkIds) ? body.hunkIds : null,
              action: body.action === 'revert' ? 'revert' : 'keep',
            })
            return json({ ok: out.ok, error: out.error, diskChanged: out.diskChanged, view: engine.view() })
          } catch (e) {
            return json({ ok: false, error: String(e?.message ?? e) }, 500)
          }
        },
      })

      // 撤销 / 重做
      for (const route of [
        { path: '/api/review.undo', name: 'undo' },
        { path: '/api/review.redo', name: 'redo' },
      ]) {
        conn.register({
          path: route.path,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async () => {
            const out = route.name === 'undo' ? engine.undo() : engine.redo()
            return json({ ok: out.ok, error: out.error, view: engine.view() })
          },
        })
      }

      // 跨所有文件：全部保留 / 全部回退（一批，一次撤销可整体回退）
      conn.register({
        path: '/api/review.act-all',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            const body = await request.json()
            if (body?.action !== 'keep' && body?.action !== 'revert') return json({ ok: false, error: '未知操作' }, 400)
            const out = engine.actAll({
              action: body.action,
              source: typeof body?.source === 'string' ? body.source : undefined,
              workspace: typeof body?.workspace === 'string' ? body.workspace : undefined
            })
            return json({ ok: out.ok, error: out.error, appliedFiles: out.appliedFiles, action: out.action, view: engine.view() })
          } catch (e) {
            return json({ ok: false, error: String(e?.message ?? e) }, 500)
          }
        },
      })

      // 导入 git 改动
      conn.register({
        path: '/api/review.git',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async () => {
          try {
            const out = await engine.importGit()
            return json({ ok: out.ok, error: out.errors?.[0] ?? out.error ?? '', added: out.added, view: engine.view() })
          } catch (e) {
            return json({ ok: false, error: String(e?.message ?? e) }, 500)
          }
        },
      })

      console.error(`${TAG} API = /api/review* ；有未处理改动时在会话顶部显示审查入口`)
    } catch (error) {
      console.error(`${TAG} 注册 API 失败：${String(error?.message ?? error)}`)
    }
  })

  const collector = createCollector(engine)
  // session 有事件时：消费增量事件 + 同步工作区
  ctx.on('session/event', (session) => {
    try {
      collector.track(session)
    } catch (error) {
      console.error(`${TAG} 采集事件失败：${String(error?.message ?? error)}`)
    }
  })
  // session 创建/进入时也同步工作区：session/event 只在 session append 事件时才触发，
  // 刚切换过去、还没有消息的新 session 不会走 session/event，这里兜底主动扫描。
  ctx.on('session/created', (session) => {
    try {
      collector.track(session)
    } catch (error) {
      console.error(`${TAG} 同步工作区失败：${String(error?.message ?? error)}`)
    }
  })

  console.error(`${TAG} 数据文件 = ${engine.dataFile}；工作区 = ${engine.root}`)
}

export const inject = ['session']

export default { name, apply }