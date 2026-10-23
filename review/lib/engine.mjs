/**
 * engine.mjs —— dsh-review 的审查引擎（宿主半边）。
 *
 * 记录/回放各次文件改动的差异块（hunk），支持：
 *   - 自动汇总 agent 的 write / edit / str_replace_editor 改动；
 *   - 导入工作区的 git 版本控制改动；
 *   - 对单个 hunk / 选区多 hunk / 整文件执行保留(keep) / 回退(revert)；
 *   - 撤销 / 重做审查操作；
 *   - 全部数据持久化到磁盘，重启后继续审查。
 *
 * 差异数据模型：
 *   每个文件 = baseline（首次被我们发现时的内容 / git 的 HEAD）+ 一串有序 changes；
 *   每个 change 含若干 hunk；hunk 的 status(pending/kept/reverted) 决定它是否"应用
 *   到磁盘"。`current()` 从 baseline 重放所有非 reverted hunk 得到应落盘的内容 ——
 *   回退某个 hunk 只是把它从 applied 集合拿掉再重放，天然正确、不需要逐行挪位。
 */

import { readFileSync, writeFileSync, mkdirSync, renameSync, statSync, existsSync, readdirSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { dirname, join, relative, isAbsolute, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import { diffHunks, composeContent } from './diff.mjs'

const TAG = '[dsh-review]'

/** 单个文件超过这个字节数就不追踪。 */
const MAX_FILE_BYTES = 512 * 1024
/** 单个文件最多记多少 change。 */
const MAX_CHANGES_PER_FILE = 400
/** 落盘去抖延时。 */
const FLUSH_DELAY_MS = 500

let seqCounter = 0
const nextId = () => `${Date.now().toString(36)}-${(seqCounter += 1).toString(36)}`

export const STATUS = { PENDING: 'pending', KEPT: 'kept', REVERTED: 'reverted' }

/* ------------------------------------------------------------------ */
/* 工具函数                                                             */
/* ------------------------------------------------------------------ */

/** 构造"差异块重叠、无法安全单独摘除"的可操作错误信息。 */
function overlapError(file, fail, hunkIds, action) {
  const verb = action === 'revert' ? '回退' : '保留'
  let place = ''
  if (fail) {
    const tool = file.changes?.find((c) => c.hunks.some((hh) => hh.id === fail.id))?.tool
    if (tool) place = `（这处差异由 ${tool} 产生）`
  }
  return (
    `无法${verb}：${file.relPath} 这片区域的差异块有“依赖重叠”${place} —— 该区域被反复改动过，中间某一块的差异建立在另一块的结果之上，所以无法单独把它摘除（否则和其它块组合时，重放结果不再是单一、可确定的内容）。为防写坏文件已取消，文件未被改动。` +
    `建议：① 对这个文件做“整文件${verb}”；② 先${verb}它“之前”的差异块，再回来处理这一块；③ 若只需恢复原样，直接“整文件回退”。`
  )
}

/* ------------------------------------------------------------------ */
/* 工具函数                                                             */
/* ------------------------------------------------------------------ */

function safeRead(path) {
  try {
    if (!existsSync(path)) return null
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

/** 原子写（tmp + rename）。 */
function safeWrite(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, content, 'utf8')
  renameSync(tmp, path)
}

function mtimeOf(path) {
  try {
    return statSync(path).mtimeMs
  } catch {
    return 0
  }
}

/** 把工具给的文件路径解析成绝对路径，并算出 relPath。 */
function resolvePath(raw, root) {
  let p = String(raw ?? '').trim()
  if (p.length === 0) return null
  if (p.startsWith('~/')) p = join(homedir(), p.slice(2))
  const abs = isAbsolute(p) ? resolve(p) : resolve(root, p)
  const rel = relative(root, abs)
  return { abs, rel: rel.startsWith('..') ? abs : rel.split(sep).join('/') }
}

function isText(content) {
  if (content === null) return true
  let bad = 0
  const limit = Math.min(content.length, 8192)
  for (let i = 0; i < limit; i += 1) if (content.charCodeAt(i) === 0) bad += 1
  return bad === 0
}

function runGit(root, args, timeout = 20000) {
  return new Promise((done) => {
    try {
      execFile(
        'git',
        ['-C', root, ...args],
        { timeout, maxBuffer: 64 * 1024 * 1024 },
        (err, stdout, stderr) => done({ ok: !err, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') })
      )
    } catch (e) {
      done({ ok: false, stdout: '', stderr: String(e?.message ?? e) })
    }
  })
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export const EMPTY_STATE = () => ({
  version: 1,
  updatedAt: '',
  workspaceRoot: '',
  files: {},
})

function readState(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    if (parsed !== null && typeof parsed === 'object' && parsed.files !== null && typeof parsed.files === 'object') {
      return {
        version: 1,
        updatedAt: String(parsed.updatedAt ?? ''),
        workspaceRoot: String(parsed.workspaceRoot ?? ''),
        files: parsed.files,
      }
    }
  } catch {
    // 文件不存在 / 坏掉都当空
  }
  return EMPTY_STATE()
}

export function createEngine({ dataFile, workspaceRoot }) {
  let root = workspaceRoot || process.cwd()
  let state = readState(dataFile)
  if (!state.workspaceRoot) state.workspaceRoot = root
  let rootConfirmed = false // 工作区是否已由 session 确定（避免重启后先暴露旧工作区数据）
  let seenMtime = mtimeOf(dataFile)
  let timer
  let dirty = false
  const undoStack = []
  const redoStack = []
  let gitProbe = null // null=未探测, true/false
  let knownRepos = new Map() // 工作区根 → 其下已发现的 git 仓库根（缓存，跨工作区累计）
  let gitSyncTimer = null // git 刷新的去抖定时器
  let gitRefreshing = false // 防止并发的 git 刷新

  /* ---------------- 基础 ---------------- */

  function ensureFile(abs, source, wsRoot) {
    let f = state.files[abs]
    if (!f) {
      f = { path: abs, relPath: '', source, workspaceRoot: wsRoot || root, baseline: '', changes: [], updatedAt: '' }
      state.files[abs] = f
    }
    if (wsRoot && !f.workspaceRoot) f.workspaceRoot = wsRoot
    if (!f.relPath) {
      const base = f.workspaceRoot || root
      const rel = relative(base, abs)
      f.relPath = rel.startsWith('..') ? abs : rel.split(sep).join('/')
    }
    return f
  }

  function appliedHunks(file) {
    const out = []
    for (const ch of file.changes) for (const h of ch.hunks) if (h.status !== STATUS.REVERTED) out.push(h)
    return out
  }

  function currentOf(file) {
    return composeContent(file.baseline, appliedHunks(file))
  }

  /** 解析 relPath 或绝对路径 → 绝对路径。 */
  function resolveAbs(relOrAbs) {
    const r = resolvePath(relOrAbs, root)
    return r ? r.abs : null
  }

  /** 状态是否与磁盘一致：比较内存期望内容与真实磁盘。 */
  function diskDiverged(file) {
    const { content, ok } = currentOf(file)
    if (!ok) return false
    return safeRead(file.path) !== content
  }

  /* ---------------- 记录改动 ---------------- */

  function recordChange({ tool, abs, beforeText, afterText, ts, workspaceRoot }) {
    if (!abs) return { ok: false }
    if (!isText(beforeText ?? '') || !isText(afterText ?? '')) return { ok: false }
    const before = beforeText === null || beforeText === undefined ? '' : beforeText
    const after = afterText === null || afterText === undefined ? '' : afterText
    if (before.length > MAX_FILE_BYTES || after.length > MAX_FILE_BYTES) return { ok: false }
    const hunks = diffHunks(before, after)
    if (hunks.length === 0) return { ok: false }

    if (!rootConfirmed) rootConfirmed = true // agent 已开始改动，视为工作区已确定
    const existed = state.files[abs] !== undefined
    const file = ensureFile(abs, 'agent', workspaceRoot)
    if (!existed) file.baseline = before // 首次遇到：当时磁盘即基线
    const change = {
      id: nextId(),
      tool: tool || 'agent',
      ts: ts || new Date().toISOString(),
      hunks: hunks.map((h) => ({
        id: nextId(),
        oldText: h.oldText,
        newText: h.newText,
        context: h.context || 0,
        oldStart: h.oldStart || 0,
        newStart: h.newStart || 0,
        status: STATUS.PENDING,
      })),
    }
    file.changes.push(change)
    if (file.changes.length > MAX_CHANGES_PER_FILE) file.changes.splice(0, file.changes.length - MAX_CHANGES_PER_FILE)
    file.updatedAt = change.ts
    // 同步期望状态到内存 view（不主动写盘——写盘只在用户决策后）
    const c = currentOf(file)
    file.diskState = c.ok ? c.content : file.diskState ?? ''
    schedule()
    return { ok: true, file }
  }

  /* ---------------- 决策 ---------------- */

  function decide({ source, abs, hunkIds, action }) {
    const file = state.files[abs]
    if (!file) return { ok: false, error: '文件不存在' }
    const wholeFile = !Array.isArray(hunkIds)
    const isKeep = action === 'keep'
    const snapshot = JSON.stringify(file)

    // —— 保留：只记录“认可”，不改文件、不写盘，因此永远可安全执行 ——
    if (isKeep) {
      const set = new Set(hunkIds || [])
      let mutated = false
      for (const ch of file.changes) {
        for (const h of ch.hunks) {
          if (wholeFile || set.has(h.id)) {
            if (h.status !== STATUS.KEPT) {
              h.status = STATUS.KEPT
              mutated = true
            }
          }
        }
      }
      if (!mutated) return { ok: true, error: '', diskChanged: [], noop: true }
      pushJournal([{ key: abs, before: snapshot, after: JSON.stringify(file), wroteDisk: false }])
      state.updatedAt = new Date().toISOString()
      flush()
      return { ok: true, error: '', diskChanged: [] }
    }

    // —— 回退：会真正改写文件。找出“能安全重放的最小一致集” ——
    // 若目标块与后面几块纠缠（后块依赖前块结果），自动连带回退它们，而不是报错取消。
    const plan = wholeFile
      ? { ids: allHunkIds(file), expanded: 0, ok: true }
      : expandedRevert(file, hunkIds)
    if (!plan.ok) {
      return { ok: false, error: overlapError(file, plan.fail, hunkIds, 'revert') }
    }

    const idSet = new Set(plan.ids)
    let mutated = false
    for (const ch of file.changes) {
      for (const h of ch.hunks) {
        if (wholeFile || idSet.has(h.id)) {
          if (h.status !== STATUS.REVERTED) {
            h.status = STATUS.REVERTED
            mutated = true
          }
        }
      }
    }
    if (!mutated) return { ok: true, error: '', diskChanged: [], noop: true }
    pushJournal([{ key: abs, before: snapshot, after: JSON.stringify(file), wroteDisk: true }])
    state.updatedAt = new Date().toISOString()
    const diskChanged = syncToDisk([abs])
    flush()
    return { ok: true, error: '', diskChanged, expanded: plan.expanded }
  }

  /**
   * 对所有文件（可按来源过滤）执行保留/回退，作为一批（一次撤销可整体回退）。
   * @returns {{ok, appliedFiles, action}}
   */
  function actAll({ action, source, workspace }) {
    const isKeep = action === 'keep'
    const files = Object.values(state.files).filter((f) => {
      if (source && f.source !== source) return false
      // workspace 是工作区名（baseName）：非空时只处理该工作区下的文件；空则全部
      if (workspace && baseNameOf(f.workspaceRoot || root) !== workspace) return false
      return true
    })
    const changes = []
    const writtenKeys = []
    for (const file of files) {
      const before = JSON.stringify(file)
      const setAll = isKeep ? STATUS.KEPT : STATUS.REVERTED
      let hit = false
      for (const ch of file.changes) {
        for (const h of ch.hunks) {
          if (h.status !== setAll) {
            h.status = setAll
            hit = true
          }
        }
      }
      if (hit) {
        changes.push({ key: file.path, before, after: JSON.stringify(file), wroteDisk: !isKeep })
        if (!isKeep) writtenKeys.push(file.path)
      }
    }
    if (changes.length === 0) return { ok: true, error: '', appliedFiles: 0, action }
    pushJournal(changes)
    state.updatedAt = new Date().toISOString()
    if (writtenKeys.length > 0) syncToDisk(writtenKeys)
    flush()
    return { ok: true, error: '', appliedFiles: changes.length, action }
  }

  function allHunkIds(file) {
    const ids = []
    for (const ch of file.changes) for (const h of ch.hunks) ids.push(h.id)
    return ids
  }

  /**
   * 计算“回退 initialIds 所需的最小一致 hunk 集”。
   * 提交的想法：在克隆上把目标块标成 reverted，然后不断重放；每次失败时，把“放不下
   * 的那块”也加入回退集，直到能重现（或没进展/超限）。因为全部回退总等于基线、必然
   * 可重现，所以只要足够迭代，永远能收敛——回退不再有“死胡同”。
   */
  function expandedRevert(file, initialIds) {
    const trial = JSON.parse(JSON.stringify(file))
    const set = new Set(initialIds)
    let added = 0
    for (let round = 0; round < 400; round += 1) {
      for (const ch of trial.changes) {
        for (const h of ch.hunks) if (set.has(h.id)) h.status = STATUS.REVERTED
      }
      const c = composeContent(trial.baseline, appliedHunks(trial))
      if (c.ok) return { ids: [...set], expanded: added, ok: true }
      const f = c.fail
      if (!f || !f.id || set.has(f.id)) return { ids: [...set], expanded: added, ok: false, fail: f }
      set.add(f.id)
      added += 1
    }
    return { ids: [...set], expanded: added, ok: false }
  }

  function syncToDisk(keys) {
    const written = []
    for (const key of keys) {
      const file = state.files[key]
      if (!file) continue
      const { content, ok } = currentOf(file)
      file.diskState = ok ? content : file.diskState ?? ''
      if (!ok) {
        console.error(`${TAG} 文件 ${file.relPath} 的组合结果无法重现，跳过落盘（可能有重叠改动）`)
        continue
      }
      const onDisk = safeRead(file.path)
      if (onDisk !== content) {
        try {
          safeWrite(file.path, content)
          written.push(file.relPath)
        } catch (e) {
          console.error(`${TAG} 写入 ${file.path} 失败：${String(e?.message ?? e)}`)
        }
      }
    }
    return written
  }

  /* ---------------- 撤销/重做 ---------------- */

  function pushJournal(changes) {
    undoStack.push({ kind: 'decide', changes })
    redoStack.length = 0
  }

  /** 按 op.changes 逐文件恢复，并只对动过盘的落盘。dir=-1 回到操作前，+1 回到操作后。 */
  function applyOp(op, dir) {
    const writeKeys = []
    for (const c of op.changes) {
      const target = dir < 0 ? c.before : c.after
      if (state.files[c.key]) state.files[c.key] = JSON.parse(target)
      if (c.wroteDisk) writeKeys.push(c.key)
    }
    state.updatedAt = new Date().toISOString()
    if (writeKeys.length > 0) syncToDisk(writeKeys)
    flush()
  }

  function undo() {
    const op = undoStack.pop()
    if (!op || op.kind !== 'decide') return { ok: false, error: '没有可撤销的决策' }
    applyOp(op, -1)
    redoStack.push(op)
    return { ok: true }
  }

  function redo() {
    const op = redoStack.pop()
    if (!op || op.kind !== 'decide') return { ok: false, error: '没有可重做的决策' }
    applyOp(op, +1)
    undoStack.push(op)
    return { ok: true }
  }

  /* ---------------- 视图 ---------------- */

  function baseNameOf(p) {
    if (!p) return ''
    const seg = String(p).split(/[\\/]/).filter(Boolean)
    return seg.length ? seg[seg.length - 1] : String(p)
  }

  function view() {
    scheduleGitRefresh()
    const files = Object.values(state.files)
    const list = []
    let pendingHunks = 0
    let keptHunks = 0
    let revertedHunks = 0
    const byWorkspace = {}
    for (const file of files) {
      // 补齐旧数据缺失的行号：旧 review.json 的 hunk 没有 oldStart/newStart。
      // 对这类文件，用磁盘当前内容相对 baseline 重新 diff，建立 (oldText,newText)->{os,ns} 映射。
      let lineMap = null
      const needLines = file.changes.some((c) => c.hunks.some((x) => !x.oldStart && !x.newStart))
      if (needLines) {
        const ct = safeRead(file.path) ?? ''
        const nhs = diffHunks(file.baseline ?? '', ct)
        if (nhs.length) {
          lineMap = new Map()
          for (const nh of nhs) lineMap.set(String(nh.oldText ?? '') + '\0' + String(nh.newText ?? ''), { os: nh.oldStart || 0, ns: nh.newStart || 0 })
        }
      }
      const startOf = (h, fld) => {
        if (h[fld]) return h[fld]
        if (lineMap) {
          const hit = lineMap.get(String(h.oldText ?? '') + '\0' + String(h.newText ?? ''))
          if (hit) return fld === 'oldStart' ? hit.os : hit.ns
        }
        return 0
      }
      const hunks = []
      for (const ch of file.changes) {
        for (const h of ch.hunks) {
          const st = h.status
          if (st === STATUS.PENDING) pendingHunks += 1
          else if (st === STATUS.KEPT) keptHunks += 1
          else revertedHunks += 1
          hunks.push({
            id: h.id,
            changeTool: ch.tool,
            changeTs: ch.ts,
            oldText: h.oldText,
            newText: h.newText,
            context: h.context || 0,
            oldStart: startOf(h, 'oldStart'),
            newStart: startOf(h, 'newStart'),
            status: st,
          })
        }
      }
      const current = currentOf(file)
      // “current”以磁盘为准（可能 agent 又改过、或组合带上下文重叠）。compose 只负责
      // 决定“要写什么”，成功后磁盘即 compose；读盘永远反映真实状态。
      const currentText = safeRead(file.path) ?? ''
      const expectOk = current.ok
      // 给每个 hunk 算一个「当前侧行号」，用于可复制的行号引用（行号 = 内容起点 + 前导上下文行数）
      let cursor = 0
      let bcursor = 0
      for (const h of hunks) {
        if (h.status === STATUS.REVERTED) {
          const ref = h.oldText ?? ''
          let line = -1
          if (ref.length > 0) {
            const i = file.baseline.indexOf(ref, bcursor)
            if (i >= 0) {
              line = file.baseline.slice(0, i).split('\n').length + (h.context || 0)
              bcursor = i + ref.length
            }
          }
          h.line = line
        } else {
          const ref = h.newText
          let line = -1
          if (ref.length > 0) {
            const i = currentText.indexOf(ref, cursor)
            if (i >= 0) {
              line = currentText.slice(0, i).split('\n').length + (h.context || 0)
              cursor = i + ref.length
            }
          }
          h.line = line
        }
      }
      const fp = { pending: hunks.filter((h) => h.status === STATUS.PENDING).length, kept: hunks.filter((h) => h.status === STATUS.KEPT).length, reverted: hunks.filter((h) => h.status === STATUS.REVERTED).length }
      const ws = file.workspaceRoot || root
      const wsName = baseNameOf(ws)
      const b = (byWorkspace[wsName] = byWorkspace[wsName] || { root: ws, files: 0, pending: 0, kept: 0, reverted: 0 })
      b.files += 1
      b.pending += fp.pending
      b.kept += fp.kept
      b.reverted += fp.reverted
      list.push({
        path: file.path,
        relPath: file.relPath,
        source: file.source,
        workspaceRoot: ws,
        workspace: wsName,
        baseline: file.baseline,
        current: currentText,
        composeOk: expectOk,
        divergeDisk: diskDiverged(file),
        stats: fp,
        changeCount: file.changes.length,
        hunks,
      })
    }
    return {
      workspaceRoot: root,
      gitAvailable: gitProbe === true,
      files: list,
      stats: { files: list.length, pendingHunks, keptHunks, revertedHunks, byWorkspace },
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      updatedAt: state.updatedAt,
    }
  }

  /* ---------------- Git 导入 ---------------- */

  async function importGit(repoRoot, wsRoot) {
    // target = 要 diff 的 git 仓库根。未指定时用当前 root 并向上定位其所属仓库。
    const ws = wsRoot || (repoRoot || root)
    let target = repoRoot || root
    if (!repoRoot) {
      const repo = await gitRootOf(target)
      if (!repo) return { ok: false, error: '未检测到 git 仓库', added: [] }
      target = repo
    }
    gitProbe = true
    const added = []
    const errors = []
    const seen = new Set() // 本次 diff 里仍存在的文件（tracked + untracked）

    // 1) 受版本控制的改动（相对 HEAD）——覆盖已暂存 + 未暂存 + 已新增入库
    const head = await runGit(target, ['diff', '--no-color', '--unified=3', 'HEAD'])
    if (head.ok) {
      for (const entry of parseGitDiff(head.stdout)) {
        const resolved = resolvePath(entry.newPath, target)
        if (!resolved) continue
        seen.add(resolved.abs)
        // 工作区当前内容（== 新侧；文件若被删除则是空）
        const after = safeRead(resolved.abs) ?? ''
        if (after.length > MAX_FILE_BYTES) {
          errors.push(`${entry.newPath}: 文件过大，跳过`)
          continue
        }
        let before
        if (entry.fromNull) {
          before = ''
        } else {
          const show = await runGit(target, ['show', `HEAD:${entry.oldPath || entry.newPath}`], 15000)
          before = show.ok ? show.stdout : ''
        }
        if (!isText(before) || !isText(after)) continue
        const hunks = diffHunks(before, after)
        if (hunks.length === 0) continue
        const file = ensureFile(resolved.abs, 'git', ws)
        file.source = 'git'
        file.baseline = before
        file.changes = [makeGitChange(hunks, file.changes.length > 0 ? file : null)]
        added.push({ ok: true, path: file.relPath, abs: resolved.abs })
      }
    } else {
      errors.push('git diff HEAD 失败：' + head.stderr)
    }

    // 2) 未跟踪文件
    const untracked = await runGit(target, ['ls-files', '--others', '--exclude-standard'])
    if (untracked.ok) {
      for (const rel of untracked.stdout.split('\n')) {
        const name = rel.trim()
        if (!name) continue
        const resolved = resolvePath(name, target)
        if (!resolved) continue
        seen.add(resolved.abs)
        const full = safeRead(resolved.abs)
        if (full === null || !isText(full) || full.length === 0 || full.length > MAX_FILE_BYTES) continue
        const file = ensureFile(resolved.abs, 'git', ws)
        file.source = 'git'
        file.baseline = ''
        file.changes = [makeGitChange([{ oldText: null, newText: full }], file.changes.length > 0 ? file : null)]
        added.push({ ok: true, path: file.relPath, abs: resolved.abs })
      }
    } else {
      errors.push('git ls-files 失败：' + untracked.stderr)
    }

    // 3) 清理已提交 / 已还原的 git 文件：git diff HEAD 与 ls-files 都成功时，凡是本仓库下
    //    source=git 却不在本次 diff 里的文件，说明用户已 commit 或已手动还原到 HEAD，
    //    从账本里摘掉，避免「已经提交了还显示待改动」。
    if (head.ok && untracked.ok) {
      const prefix = target.endsWith(sep) ? target : target + sep
      for (const abs of Object.keys(state.files)) {
        const f = state.files[abs]
        if (!f || f.source !== 'git') continue
        if (!(abs === target || abs.startsWith(prefix))) continue
        if (seen.has(abs)) continue
        delete state.files[abs]
      }
    }

    state.updatedAt = new Date().toISOString()
    schedule()
    return { ok: added.length > 0 || errors.length === 0, added, errors }
  }

  function makeGitChange(hunks, existingFile) {
    // git 模式每次刷新都会重新生成 hunk，若直接重置为 pending，会丢掉用户已做的
    // 保留/回退决策。这里按内容（oldText+newText）继承已有决策：内容相同的 hunk 保留
    // 原状态，内容变化或新增的 hunk 才是待处理。
    const prev = new Map()
    if (existingFile) {
      for (const ch of existingFile.changes) {
        for (const h of ch.hunks) {
          const key = String(h.oldText ?? '') + '\u0000' + String(h.newText ?? '')
          if (!prev.has(key)) prev.set(key, h.status)
        }
      }
    }
    return {
      id: nextId(),
      tool: 'git',
      ts: new Date().toISOString(),
      hunks: hunks.map((h) => {
        const key = String(h.oldText ?? '') + '\u0000' + String(h.newText ?? '')
        const st = prev.get(key)
        return {
          id: nextId(),
          oldText: h.oldText,
          newText: h.newText,
          context: h.context || 0,
          oldStart: h.oldStart || 0,
          newStart: h.newStart || 0,
          status: st === STATUS.KEPT || st === STATUS.REVERTED ? st : STATUS.PENDING,
        }
      }),
    }
  }

  /** 解析 `git diff` 输出为 per-file 条目。 */
  function parseGitDiff(text) {
    const entries = []
    let cur = null
    const lines = text.split('\n')
    for (const line of lines) {
      if (line.startsWith('diff --git ')) {
        if (cur) entries.push(cur)
        const m = /diff --git a\/(.*?) b\/(.*)/.exec(line)
        const oldPath = m ? unquote(m[1]) : ''
        const newPath = m ? unquote(m[2]) : ''
        cur = { oldPath, newPath, fromNull: oldPath === '', toNull: newPath === '' }
        continue
      }
      if (!cur) continue
      if (line.startsWith('--- /dev/null')) {
        cur.fromNull = true
      } else if (line.startsWith('+++ /dev/null')) {
        cur.toNull = true
      }
    }
    if (cur) entries.push(cur)
    return entries
  }

  function unquote(p) {
    return p === '/dev/null' ? '' : p
  }

  /* ---------------- 持久化 ---------------- */

  function schedule() {
    dirty = true
    if (timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      flush()
    }, FLUSH_DELAY_MS)
  }

  function flush() {
    if (!dirty) return
    dirty = false
    try {
      safeWrite(dataFile, JSON.stringify(state, null, 2))
      seenMtime = mtimeOf(dataFile)
    } catch (e) {
      console.error(`${TAG} 写数据失败：${String(e?.message ?? e)}`)
    }
  }

  function dispose() {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    flush()
  }

  // ---- git 仓库定位（工作区下可能有多个 git 仓库，按文件路径向上定位） ----

  /** 从某个目录向上定位它所属的 git 仓库根（`git rev-parse --show-toplevel`）。 */
  function gitRootOf(dir) {
    if (!dir) return Promise.resolve(null)
    return runGit(dir, ['rev-parse', '--show-toplevel'], 4000).then((r) => {
      const top = r.ok ? String(r.stdout).trim() : ''
      return top ? top : null
    })
  }

  /** 动态更新工作区根（会话工作区 `session.header.cwd`）。
   * 只记录当前工作区（供 relPath/git 扫描参考），**不**清空账本——
   * 账本累积所有工作区的改动，badge 显示全体汇总、面板可按住区分组查看。 */
  function setRoot(r) {
    if (!r || typeof r !== 'string') return false
    if (!rootConfirmed) {
      rootConfirmed = true
      root = r
      state.workspaceRoot = r
      return true
    }
    if (r !== root) {
      root = r
      state.workspaceRoot = r
      return true
    }
    return false
  }

  /** 探测某个绝对路径是否位于 git 仓库内（命中则缓存 gitProbe）。 */
  async function detectGitAt(abs) {
    const repo = await gitRootOf(dirname(abs))
    if (repo) {
      gitProbe = true
      return true
    }
    return false
  }

  /** 对某个文件所属的 git 仓库做一次 diff 刷新（多仓库时按文件各刷各的）。 */
  async function syncGitForFile(abs) {
    const repo = await gitRootOf(dirname(abs))
    if (!repo) return { ok: false, error: '文件不在 git 仓库内' }
    return importGit(repo, root)
  }

  /** 递归找工作空间下的 git 仓库根（限制深度，跳过常见非业务目录）。 */
  function findGitRepos(dir, depth) {
    const out = []
    if (depth < 0 || !dir) return out
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return out
    }
    // 当前目录本身就是 git 仓库根 → 记下，不再深入（子目录同属该仓库）
    if (entries.some((e) => e.name === '.git')) {
      out.push(dir)
      return out
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const n = e.name
      if (n.startsWith('.') || n === 'node_modules' || n === 'dist' || n === 'build') continue
      out.push(...findGitRepos(join(dir, n), depth - 1))
    }
    return out
  }

  /** 找某个工作区根下的所有 git 仓库根（带缓存；含工作区自身是仓库的情况）。 */
  async function discoverReposFor(wsRoot) {
    if (!wsRoot) return []
    if (knownRepos.has(wsRoot)) return knownRepos.get(wsRoot)
    const repos = findGitRepos(wsRoot, 4)
    if (repos.length === 0) {
      const self = await gitRootOf(wsRoot)
      if (self) repos.push(self)
    }
    knownRepos.set(wsRoot, repos)
    return repos
  }

  /** 主动扫描当前工作空间下的所有 git 仓库，读取相对 HEAD 的改动（含未跟踪文件）。 */
  async function scanWorkspace() {
    const repos = await discoverReposFor(root)
    gitProbe = repos.length > 0
    const added = []
    for (const repo of repos) {
      try {
        const r = await importGit(repo, root)
        if (r.ok && Array.isArray(r.added)) added.push(...r.added)
      } catch { /* ignore */ }
    }
    return { ok: repos.length > 0, repos, added }
  }

  /**
   * 周期刷新 git 账本，让外部 commit / revert 能反映到账本（去抖，防并发）。
   *
   * 不只看当前工作区：账本按文件记了各自的 workspaceRoot，这里把所有「有 git 文件
   * 的工作区」都刷一遍（含已切走的工作区），所以切到别处再 commit 老仓库，打开面板
   * 也能被清掉。
   */
  async function refreshGit() {
    if (gitRefreshing) return
    gitRefreshing = true
    try {
      const roots = new Set()
      for (const f of Object.values(state.files)) {
        if (f.source === 'git' && f.workspaceRoot) roots.add(f.workspaceRoot)
      }
      roots.add(root)
      for (const wsRoot of roots) {
        const repos = await discoverReposFor(wsRoot)
        for (const repo of repos) {
          try {
            await importGit(repo, wsRoot)
          } catch { /* ignore */ }
        }
      }
    } finally {
      gitRefreshing = false
    }
  }

  /** 去抖地调度一次 git 刷新；view 每次被读都会顺手调度。 */
  function scheduleGitRefresh() {
    if (gitSyncTimer !== null) return
    gitSyncTimer = setTimeout(() => {
      gitSyncTimer = null
      refreshGit().catch(() => {})
    }, 5000)
  }

  /** 轻量统计：只数 hunk 状态，不拼文件内容，供侧边栏入口轮询计数。 */
  function stats() {
    let pendingHunks = 0
    let keptHunks = 0
    let revertedHunks = 0
    let files = 0
    let agentFiles = 0
    let gitFiles = 0
    const byWorkspace = {}
    for (const file of Object.values(state.files)) {
      files += 1
      if (file.source === 'git') gitFiles += 1
      else agentFiles += 1
      const wsName = baseNameOf(file.workspaceRoot || root)
      const b = (byWorkspace[wsName] = byWorkspace[wsName] || { root: file.workspaceRoot || root, files: 0, pending: 0, kept: 0, reverted: 0 })
      b.files += 1
      for (const ch of file.changes) {
        for (const h of ch.hunks) {
          if (h.status === STATUS.PENDING) { pendingHunks += 1; b.pending += 1 }
          else if (h.status === STATUS.KEPT) { keptHunks += 1; b.kept += 1 }
          else { revertedHunks += 1; b.reverted += 1 }
        }
      }
    }
    return { workspaceRoot: root, files, agentFiles, gitFiles, pendingHunks, keptHunks, revertedHunks, byWorkspace, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 }
  }

  return {
    root,
    dataFile,
    recordChange,
    decide,
    actAll,
    undo,
    redo,
    view,
    stats,
    importGit,
    setRoot,
    detectGitAt,
    syncGitForFile,
    scanWorkspace,
    refreshGit,
    syncToDisk,
    flush,
    dispose,
    resolveAbs,
    state,
  }
}