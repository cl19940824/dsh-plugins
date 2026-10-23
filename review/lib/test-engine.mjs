/**
 * test-engine.mjs —— dsh-review 引擎自测（不依赖 dsh 服务，直接跑）。
 * 用法：node plugins/review/lib/test-engine.mjs
 */
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diffHunks, composeContent } from './diff.mjs'
import { createEngine } from './engine.mjs'

let pass = 0
let fail = 0
const T = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.log('  ✗ FAIL:', name, extra)
  }
}

// diff / compose 基础
const h1 = diffHunks('a\nold\nb', 'a\nnew\nb')
T('单块编辑 → 一块', h1.length === 1)
T('compose 复现 after', composeContent('a\nold\nb', h1).content === 'a\nnew\nb' && h1.length > 0)
T('回退（不应用）= baseline', composeContent('a\nold\nb', []).content === 'a\nold\nb')
T('新建文件 oldText=null', diffHunks('', 'x\ny')[0].oldText === null)
T('新建 compose', composeContent('', diffHunks('', 'x\ny')).content === 'x\ny')
T('删空文件', composeContent('a\nb', diffHunks('a\nb', '')).content === '')

// 引擎端到端：捕获 → 回退 → 撤销 → 重做 → 整文件
const dir = mkdtempSync(join(tmpdir(), 'dsh-review-test-'))
const engine = createEngine({ dataFile: join(dir, 'state.json'), workspaceRoot: dir })
const abs = join(dir, 'a.txt')
writeFileSync(abs, 'one\ntwo\nthree')
engine.recordChange({ tool: 'edit', abs, beforeText: 'one\ntwo\nthree', afterText: 'one\nTWO\nthree' })
writeFileSync(abs, 'one\nTWO\nthree') // 模拟工具已把 after 写盘
let v = engine.view()
const f = v.files.find((x) => x.relPath === 'a.txt')
T('改动入账为 pending', f && f.hunks[0].status === 'pending')
T('有行号引用', f && f.hunks[0].line >= 1)
const dv = engine.decide({ source: 'agent', abs, hunkIds: [f.hunks[0].id], action: 'revert' })
T('决策回退 ok', dv.ok === true)
T('回退写盘 = 改动前', readFileSync(abs, 'utf8') === 'one\ntwo\nthree', JSON.stringify(readFileSync(abs, 'utf8')))
T('撤销 ok', engine.undo().ok === true)
T('撤销写盘 = 改动后', readFileSync(abs, 'utf8') === 'one\nTWO\nthree')
T('重做 ok', engine.redo().ok === true)
T('重做写盘 = 改动前', readFileSync(abs, 'utf8') === 'one\ntwo\nthree')
engine.decide({ source: 'agent', abs, hunkIds: null, action: 'keep' })
T('整文件保留 → kept', engine.view().files[0].hunks[0].status === 'kept')
engine.flush()
T('持久化文件生成', readFileSync(join(dir, 'state.json'), 'utf8').includes('a.txt'))
rmSync(dir, { recursive: true, force: true })

console.log(`\ndsh-review engine self-test: ${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)