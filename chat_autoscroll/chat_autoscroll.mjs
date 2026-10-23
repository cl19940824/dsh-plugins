/**
 * chat_autoscroll.mjs —— dsh-chat-autoscroll 宿主占位。
 *
 * 功能全在浏览器半边（lib/client.js）：DSH 对话页在流式输出时智能吸底，
 * 不涉及后端。宿主这边只需让 client-modules 能发现这个包即可。
 */

export const name = 'chat_autoscroll'

const QUIET = (process.env.DSH_CHAT_AUTOSCROLL_QUIET ?? '') === '1'

export function apply() {
  if (!QUIET) {
    console.error('[dsh-chat-autoscroll] 聊天自动跟随已加载；吸底逻辑在浏览器侧生效')
  }
}

export const inject = []

export default { name, apply }
