/**
 * font.mjs —— dsh-font 宿主半边（占位：本插件功能全在浏览器半边）。
 *
 * 事实上的功能由 lib/client.js 完成：读/写一份本地设置（localStorage），并向全局
 * 注入 <style> 覆盖 --dsw-font-family、--ds-font-family-code、各级字号 token、
 * --dsw-alias-label-* 文字色与 --dsw-alias-bg-* 底色。宿主这边只需要让 client-modules
 * 能发现这个包即可，因此这里不做任何事。
 */

export const name = 'font'

const QUIET = (process.env.DSH_FONT_QUIET ?? '') === '1'

export function apply() {
  if (!QUIET) {
    console.error('[dsh-font] 客户端入口在「设置 → 常规」；字体/字号/颜色设置已持久化')
  }
}

export const inject = []

export default { name, apply }