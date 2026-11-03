window.__ModuleLoader__.load({
	id: "dsh-mobile-fit",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		/**
		 * dsh-mobile-fit —— 让 dsh 桌面版界面在手机竖屏下可用。
		 *
		 * DSH 的前端是纯桌面布局（整份 CSS 里没有任何宽度断点），在 390px 宽的手机上，
		 * 侧边栏固定占 280-300px，对话正文只剩几十像素，一行只能放一两个字。
		 *
		 * 这个插件只做三件事，全部在浏览器侧：
		 *   1) 窄屏时把 shell 的三列网格收成一列，侧边栏改成从左侧滑出的抽屉；
		 *   2) 抽屉的开合跟随 dsh 自己的「打开/收起侧边栏」按钮（不去抢它的状态），
		 *      点遮罩就替用户点一下那个按钮；
		 *   3) 顺手补几处窄屏细节：拖拽把手隐藏、代码块/表格横向滚动、弹窗不超屏、输入区留安全区。
		 *
		 * 不改任何后端行为，也不碰 dsh 的持久化状态。
		 */

		var BREAKPOINT = 820;
		var CSS = [
			'@media (max-width: ' + BREAKPOINT + 'px) {',
			'  html, body { overscroll-behavior: none; }',
			'  [class*="_frame"] { grid-template-columns: minmax(0, 1fr) 0px 0px !important; }',
			'  [class*="_centerCol"], [class*="_rightbarCol"] { min-width: 0 !important; }',
			'  [class*="_handle"] { display: none !important; }',
			'  [class*="_sidebarCol"] {',
			'    position: fixed !important;',
			'    top: 0; bottom: 0; left: 0;',
			'    width: min(84vw, 300px) !important;',
			'    z-index: 70;',
			'    transform: translateX(-102%);',
			'    transition: transform .22s cubic-bezier(.32,.72,0,1);',
			'    background: var(--dsw-alias-bg-base, #17171a);',
			'    border-radius: 0 18px 18px 0;',
			'    box-shadow: 12px 0 48px rgba(0,0,0,.72);',
			'    padding-top: env(safe-area-inset-top);',
			'    padding-bottom: env(safe-area-inset-bottom);',
			'  }',
			'  body.dshm-open [class*="_sidebarCol"] { transform: none; }',
			'  .dshm-mask {',
			'    position: fixed; inset: 0; z-index: 65;',
			'    background: rgba(0,0,0,.62);',
			'    opacity: 0; pointer-events: none;',
			'    transition: opacity .22s ease;',
			'  }',
			'  body.dshm-open .dshm-mask { opacity: 1; pointer-events: auto; }',
			'  pre { overflow-x: auto !important; max-width: 100%; }',
			'  table { display: block; overflow-x: auto; max-width: 100%; }',
			'  img { max-width: 100%; height: auto; }',
			'  [class*="_dialog"] { max-width: calc(100vw - 24px) !important; max-height: calc(100dvh - 48px) !important; }',
			'  .dshm-fab {',
			'    position: fixed;',
			'    top: calc(env(safe-area-inset-top) + 9px); left: 12px;',
			'    width: 40px; height: 40px; border-radius: 20px;',
			'    display: none; flex-direction: column; align-items: center; justify-content: center;',
			'    z-index: 80; padding: 0; cursor: pointer;',
			'    color: var(--dsw-alias-label-primary, #1b1b1f);',
			'    background: var(--dsw-alias-bg-elevated, var(--dsw-alias-bg-base, #1f1f24));',
			'    border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28));',
			'    box-shadow: 0 4px 16px rgba(0,0,0,.28);',
			'  }',
			'  .dshm-fab i { display: block; width: 17px; height: 2px; border-radius: 1px; background: currentColor; margin: 2.2px 0; }',
			'  @media (max-width: ' + BREAKPOINT + 'px) { body:not(.dshm-open) .dshm-fab { display: flex; } }',
			'  [class*="composer"], [class*="Composer"] { padding-bottom: env(safe-area-inset-bottom); }',
			'  /* 给左上角的 ☰ 让出位置，别压住标题行 */',
			'  header[class*="_header"] { padding-left: 62px !important; }',
			'  /* iOS 在字号小于 16px 的输入框聚焦时会自动放大整个页面 */',
			'  input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"] { font-size: 16px !important; }',
			'  html { -webkit-text-size-adjust: 100%; }',
			'}'
		].join("\n");

		var OPEN_LABEL = /^(打开侧边栏|Open sidebar|Show sidebar)/i;
		var CLOSE_LABEL = /^(收起侧边栏|Close sidebar|Hide sidebar)/i;

		var started = false;
		var mask = null;
		var fab = null;
		var observer = null;
		var mq = null;
		var scheduled = 0;

		function findByLabel(re) {
			var buttons = document.querySelectorAll("button[aria-label]");
			for (var i = 0; i < buttons.length; i++) {
				if (re.test(buttons[i].getAttribute("aria-label") || "")) return buttons[i];
			}
			return null;
		}

		/**
		 * 侧边栏是否展开：读 shell 网格的**内联** grid-template-columns 首列宽度
		 * （首列 56px = 只剩图标栏，280px = 面板展开）。内联样式是 dsh 自己写的，
		 * 我们的 !important 只改计算值，不会破坏这个信号。
		 */
		function sidebarOpen() {
			var frame = document.querySelector('[class*="_frame"]');
			if (!frame) return false;
			var first = parseFloat(frame.style.gridTemplateColumns || "0");
			return first > 64;
		}

		function isNarrow() {
			return !!(mq && mq.matches);
		}

		function sync() {
			if (!document.body) return;
			if (!isNarrow()) {
				document.body.classList.remove("dshm-open");
				return;
			}
			document.body.classList.toggle("dshm-open", sidebarOpen());
		}

		function scheduleSync() {
			if (scheduled) return;
			scheduled = window.setTimeout(function () {
				scheduled = 0;
				sync();
			}, 40);
		}

		function expand() {
			var open = findByLabel(OPEN_LABEL);
			if (open) open.click();
		}

		function collapse() {
			var close = findByLabel(CLOSE_LABEL);
			if (close) close.click();
			document.body.classList.remove("dshm-open");
		}

		function ensureMask() {
			if (mask && mask.isConnected) return mask;
			mask = document.createElement("div");
			mask.className = "dshm-mask";
			mask.setAttribute("aria-hidden", "true");
			mask.addEventListener("click", collapse);
			document.body.appendChild(mask);
			return mask;
		}

		function ensureFab() {
			if (fab && fab.isConnected) return fab;
			fab = document.createElement("button");
			fab.type = "button";
			fab.className = "dshm-fab";
			fab.setAttribute("aria-label", "打开会话列表");
			for (var i = 0; i < 3; i++) fab.appendChild(document.createElement("i"));
			fab.addEventListener("click", function (event) {
				event.preventDefault();
				event.stopPropagation();
				expand();
			});
			document.body.appendChild(fab);
			return fab;
		}

		function onDocumentClick(event) {
			if (!isNarrow()) return;
			var target = event.target;
			if (!target || !target.closest) return;
			// 侧边栏自己的开/关按钮不要当成「点了条目」（否则会刚打开就收起）
			var ariaButton = target.closest("button[aria-label]");
			if (ariaButton) {
				var label = ariaButton.getAttribute("aria-label") || "";
				if (OPEN_LABEL.test(label) || CLOSE_LABEL.test(label)) {
					scheduleSync();
					return;
				}
			}
			// 点抽屉里真正会「跳转/切换」的东西之后自动收起，但展开器/输入框不算
			var sidebar = target.closest('[class*="_sidebarCol"]');
			if (sidebar) {
				if (target.closest("input, textarea, [contenteditable='true']")) return;
				var navigate = target.closest("a, button, [role='treeitem'], [role='menuitem']");
				if (navigate) {
					var expanded = navigate.getAttribute("aria-expanded");
					if (expanded !== null) return;
					window.setTimeout(collapse, 160);
					return;
				}
			}
			scheduleSync();
		}

		function onKeyDown(event) {
			if (event.key === "Escape" && isNarrow() && document.body.classList.contains("dshm-open")) {
				collapse();
			}
		}

		function apply() {
			if (started || typeof document === "undefined" || typeof window.matchMedia !== "function") return;
			if (!window.__dshmStarted) {
				window.__dshmStarted = true;
			} else {
				return;
			}
			started = true;
			mq = window.matchMedia("(max-width: " + BREAKPOINT + "px)");

			var style = document.createElement("style");
			style.id = "dshm-style";
			style.textContent = CSS;
			document.head.appendChild(style);

			function boot() {
				ensureMask();
				ensureFab();
				sync();
				observer = new MutationObserver(scheduleSync);
				observer.observe(document.body, {
					subtree: true,
					childList: true,
					attributes: true,
					attributeFilter: ["aria-label", "class", "style"]
				});
				document.addEventListener("click", onDocumentClick, true);
				document.addEventListener("keydown", onKeyDown, true);
				if (mq.addEventListener) mq.addEventListener("change", scheduleSync);
				else if (mq.addListener) mq.addListener(scheduleSync);
				// 恢复会话/首次渲染时按钮可能晚于本模块出现，前两秒多同步几次
				[300, 1000, 2000].forEach(function (delay) {
					window.setTimeout(sync, delay);
				});
				// 兜底轮询：dsh 有时用同一 tick 内的批量更新改内联样式，观察器不一定赶得上
				window.setInterval(function () {
					if (isNarrow()) sync();
				}, 800);
			}

			if (document.body) boot();
			else document.addEventListener("DOMContentLoaded", boot);
		}

		exports.apply = apply;
		exports.inject = [];
		return module.exports;
	}
});
