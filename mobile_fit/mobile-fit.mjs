/**
 * mobile-fit.mjs —— dsh-mobile-fit 宿主占位。
 *
 * 全部逻辑在浏览器半边（lib/client.js）：窄屏时把侧边栏改成抽屉、
 * 对话区占满屏幕。宿主侧不需要任何服务，只为让 client-modules 发现这个包。
 */

export const name = 'mobile_fit'

export function apply() {}

export const inject = []

export default { name, apply }
