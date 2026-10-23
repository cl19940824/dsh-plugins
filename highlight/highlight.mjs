/**
 * highlight.mjs —— dsh-highlight 宿主占位。
 *
 * 功能全部在浏览器半边（lib/client.js）：dsh 前端内置的 shiki 只对一部分语言做了
 * 语法高亮（别名表 Ro 缺 dart / objective-c / oc / objc 等）。本插件在浏览器里监听
 * 这些缺失语言的代码块，用 shiki 的主题变量（--shiki-token-*）补一段关键词高亮，
 * 与 dsh 已有的高亮风格一致。宿主这边只需让 client-modules 能发现这个包即可。
 */

export const name = 'highlight'

const QUIET = (process.env.DSH_HIGHLIGHT_QUIET ?? '') === '1'

export function apply() {
  if (!QUIET) {
    console.error('[dsh-highlight] 代码高亮补充已加载；缺失语言的高亮在浏览器侧生效')
  }
}

export const inject = []

export default { name, apply }
