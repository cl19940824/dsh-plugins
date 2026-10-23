/**
 * diff.mjs —— 轻量行级 diff / patch 引擎（dsh-review 用，零依赖）。
 *
 * 提供三样东西：
 *   1. `diffHunks(before, after)`：把一段「before 文本 → after 文本」的改动拆成
 *      一个个可独立保留/回退的差异块（hunk）。每个 hunk 有 `oldText` / `newText`，
 *      两侧都带一小段上下文（CONTEXT 行），因此 `oldText` 总是在应用后的内容里
 *      可定位，回退 = 用 `oldText` 换掉 `newText`。
 *   2. `composeContent(baseline, appliedHunks)`：从基线开始，按顺序把「已应用」的
 *      hunk 全量重放，得到当前应落盘的内容。回退某个 hunk 只是把它从 applied 集合里
 *      拿掉，重放一遍即可，天然比逐位挪行号稳健。
 *   3. Myers 行 diff 本身（对局部编辑很快；超工作上限时退化成整段替换）。
 *
 * 为什么 hunk 要带上下文而不是只存改动行：纯新增（oldText 为空）或纯删除（newText
 * 为空）的 hunk 只靠改动行本身没法在文件里定位回退位置；带上上下文后，`oldText`
 * 是一段实实在在出现过的话，替换位置唯一可寻。
 */

export const CONTEXT = 1

/**
 * 把文本切成行数组。末尾换行会在末尾留一个空串（`"a\nb\n"` → `["a","b",""]`，
 * `"a\nb"` → `["a","b"]`），这样 diff 能反映出「最后一行有没有换行」的真实差异。
 * null（文件不存在）返回 null。
 */
export function splitLines(text) {
  if (text === null || text === undefined) return null
  const s = String(text)
  if (s.length === 0) return []
  return s.split('\n')
}

const eq = (a, b) => a === b

/**
 * Myers O(ND) 差异。返回编辑步进数组（从 a 走到 b）：
 *   { t: '=', ai }         —— 相等行，a[ai] == b[bi==ai]
 *   { t: '-', ai }         —— 删除 a[ai]
 *   { t: '+', bi }         —— 插入 b[bi]
 * 顺序即文件顺序（d / i / e 交织）。`a` / `b` 为行数组。
 */
function myers(a, b) {
  const n = a.length
  const m = b.length
  const max = n + m
  // 工作上限：超过就退化成「整段替换，只在首尾留下公共行」，保证大文件不卡死。
  const workCap = 4_000_000

  if (n === 0) {
    return b.map((_, bi) => ({ t: '+', bi }))
  }
  if (m === 0) {
    return a.map((_, ai) => ({ t: '-', ai }))
  }

  const offset = max
  // V[k]（k = x - y）存 x。trace[d] = 「开始第 d 步时的 V 快照」，也就是生成第 d
  // 步视野所依据的那一代数组；回溯就用它来决定上一步来自 down 还是 up。
  let v = new Int32Array(2 * max + 1).fill(-1)
  v[offset + 1] = 0

  const trace = []
  let dFound = -1
  let work = 0
  for (let d = 0; d <= max; d += 1) {
    trace.push(new Int32Array(v)) // 开始第 d 步前的快照（生成第 d 步的依据）
    const vv = new Int32Array(2 * max + 1)
    for (let k = -d; k <= d; k += 2) {
      let x
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1]
      } else {
        x = v[offset + k - 1] + 1
      }
      let y = x - k
      work += 2
      while (x < n && y < m && a[x] === b[y]) {
        x += 1
        y += 1
        work += 1
      }
      vv[offset + k] = x
      if (x >= n && y >= m) {
        dFound = d
        break
      }
      if (work > workCap) break
    }
    v = vv
    if (dFound >= 0 || work > workCap) break
  }

  // 超上限：退回朴素解 —— 共用前后缀，中间整体替换。
  if (dFound < 0) {
    const ops = []
    let p = 0
    while (p < n && p < m && a[p] === b[p]) {
      ops.push({ t: '=', ai: p })
      p += 1
    }
    for (let i = p; i < n; i += 1) ops.push({ t: '-', ai: i })
    for (let j = p; j < m; j += 1) ops.push({ t: '+', bi: j })
    let e = 0
    while (n - 1 - e >= p && m - 1 - e >= p && a[n - 1 - e] === b[m - 1 - e]) {
      ops.push({ t: '=', ai: n - 1 - e })
      e += 1
    }
    return ops
  }

  // 回溯：从 (n, m) 沿 trace 找最短编辑路径，压栈后反转成文件顺序。
  const ops = []
  let x = n
  let y = m
  for (let d = dFound; d >= 0; d -= 1) {
    if (d === 0) {
      // 第 0 步：沿对角线一路回到原点，全是公共行
      while (x > 0 && y > 0) {
        ops.push({ t: '=', ai: x - 1 })
        x -= 1
        y -= 1
      }
      break
    }
    const V = trace[d]
    const k = x - y
    const prevK = k === -d || (k !== d && V[offset + k - 1] < V[offset + k + 1]) ? k + 1 : k - 1
    const prevX = V[offset + prevK]
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) {
      ops.push({ t: '=', ai: x - 1 })
      x -= 1
      y -= 1
    }
    if (x === prevX) {
      ops.push({ t: '+', bi: y - 1 })
      y -= 1
    } else {
      ops.push({ t: '-', ai: x - 1 })
      x -= 1
    }
  }
  ops.reverse()
  return ops
}

/**
 * 把一次编辑的行 diff 聚成"差异块"，每块带上下文。
 * @returns {Array<{oldText:string|null,newText:string}>} oldText 为 null 表示纯新增。
 */
export function diffHunks(before, after) {
  if (before === after) return []
  if (before === null || before === undefined) {
    return String(after).length > 0 ? [{ oldText: null, newText: String(after) }] : []
  }
  if (after === null || after === undefined) {
    return String(before).length > 0 ? [{ oldText: String(before), newText: '' }] : []
  }
  const a = splitLines(before)
  const b = splitLines(after)
  const ops = myers(a, b)
  if (ops.length === 0) return []

  const hunks = []
  let cur = null // { lead:[aIdx], oldLines:[aIdx], newLines:[bIdx] }
  for (let i = 0; i < ops.length; i += 1) {
    if (ops[i].t === '=') {
      if (cur !== null) {
        // 闭块：吞后 C 行公共行进尾巴（同样记 aIdx），再补行内容
        const tail = []
        let k = i
        while (k < ops.length && ops[k].t === '=' && tail.length < CONTEXT) {
          tail.push(ops[k].ai)
          k += 1
        }
        hunks.push(closeHunk(cur, tail, a, b))
        cur = null
        i = k - 1
      }
      continue
    }
    if (cur === null) {
      // 开块：向前取 C 行公共行做前导上下文
      cur = { lead: [], oldLines: [], newLines: [] }
      let p = i
      const lead = []
      while (p > 0 && ops[p - 1].t === '=' && lead.length < CONTEXT) {
        lead.push(ops[p - 1].ai)
        p -= 1
      }
      cur.lead = lead.reverse()
    }
    if (ops[i].t === '-') cur.oldLines.push(ops[i].ai)
    else if (ops[i].t === '+') cur.newLines.push(ops[i].bi)
  }
  if (cur !== null) {
    hunks.push(closeHunk(cur, [], a, b)) // 文件末尾块无后公共行
  }

  // 相邻块可能共用同一组上下文行，会让 compose 定位重复的前导/尾巴重叠：当上一块
  // 末尾尾巴与下一块前导指向同一批 aIdx 时，把它们从后者剔除，避免 oldText 整段
  // 重放时被第二块再次匹配。剔除后重算文本。
  const merged = []
  for (let i = 0; i < hunks.length; i += 1) {
    let h = hunks[i]
    if (i > 0) {
      const prev = merged[merged.length - 1]
      if (prev && prev.tailA && h.leadA) {
        const shared = h.leadA.filter((x) => prev.tailA.includes(x))
        if (shared.length > 0) {
          h.leadA = h.leadA.filter((x) => !shared.includes(x))
          h.oldText = renderOld(h, a)
          h.newText = renderNew(h, b)
        }
      }
    }
    const lead0 = (h.leadA || []).length ? h.leadA[0] : undefined
    const oldStart = (lead0 !== undefined ? lead0 : ((h.oldLinesA && h.oldLinesA.length) ? h.oldLinesA[0] : ((h.newLinesB && h.newLinesB.length) ? h.newLinesB[0] : 0))) + 1
    const newStart = (lead0 !== undefined ? lead0 : ((h.newLinesB && h.newLinesB.length) ? h.newLinesB[0] : ((h.oldLinesA && h.oldLinesA.length) ? h.oldLinesA[0] : 0))) + 1
    merged.push({
      oldText: h.oldText,
      newText: h.newText,
      context: (h.leadA || []).length, // 前导上下文行数，客户端用它把行号点到位
      oldStart,
      newStart,
    })
  }
  return merged
}

function closeHunk(cur, tail, a, b) {
  const oldIdx = [...cur.lead, ...cur.oldLines, ...tail]
  const newIdx = [...cur.lead, ...cur.newLines, ...tail]
  const oldText = oldIdx.length > 0 ? oldIdx.map((i) => a[i]).join('\n') : null
  const newText = newIdx.map((i) => b[i]).join('\n')
  // 起始行号（1-based）：lead（上下文）在 before/after 中位置相同，故优先用 lead 首行；
  // 无上下文则用第一个改动行。
  const oldStart = (cur.lead.length ? cur.lead[0] : (cur.oldLines.length ? cur.oldLines[0] : cur.newLines[0])) + 1
  const newStart = (cur.lead.length ? cur.lead[0] : (cur.newLines.length ? cur.newLines[0] : cur.oldLines[0])) + 1
  return {
    oldText,
    newText,
    oldStart,
    newStart,
    // 保留索引供相邻块去重上下文用
    leadA: cur.lead,
    tailA: tail.slice(),
    oldLinesA: cur.oldLines,
    newLinesB: cur.newLines,
  }
}

function renderOld(h, a) {
  const idx = [...h.leadA, ...h.oldLinesA, ...h.tailA]
  return idx.length > 0 ? idx.map((i) => a[i]).join('\n') : null
}
function renderNew(h, b) {
  const idx = [...h.leadA, ...h.newLinesB, ...h.tailA]
  return idx.map((i) => b[i]).join('\n')
}

/**
 * 从基线内容开始，按顺序应用"已应用"的 hunk，返回最终内容。
 * @param {string} baseline 基线内容（空串或某状态的全文）。
 * @param {Array<{oldText:string|null,newText:string}>} appliedHunks 按文件顺序排列、已应用的那些 hunk。
 * @returns {{content:string, ok:boolean, fail?:object}} ok=false 表示某个 hunk 无法
 *   定位（它依赖的上下文已被其它被摘除的 hunk 改掉），此时 `fail` 指向最先定位不到的 hunk。
 */
export function composeContent(baseline, appliedHunks) {
  let content = baseline
  let cursor = 0
  for (const h of appliedHunks) {
    const oldText = h.oldText === null ? '' : h.oldText
    // 定位：优先从上次替换结束位置往后找；找不到才从开头找。
    if (oldText.length === 0) {
      // 纯插入块（oldText 为空）。正常只会出现在「新建文件」：基线为空，整段变成
      // newText。若内容非空且已经包含 newText，说明它本来就在（例如后续重放时该
      // 文件早已创建），视为已应用；否则定位不了，报冲突。
      if (content.length === 0) {
        content = h.newText
        cursor = h.newText.length
        continue
      }
      if (content.includes(h.newText)) {
        cursor = 0
        continue
      }
      return { content, ok: false, fail: h }
    }
    let idx = content.indexOf(oldText, cursor)
    if (idx === -1) idx = content.indexOf(oldText)
    if (idx === -1) {
      return { content, ok: false, fail: h }
    }
    content = content.slice(0, idx) + h.newText + content.slice(idx + oldText.length)
    cursor = idx + h.newText.length
  }
  return { content, ok: true }
}