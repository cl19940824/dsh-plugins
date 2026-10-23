window.__ModuleLoader__.load({
	id: "dsh-chat-autoscroll",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		// DSH 对话页智能吸底：流式输出（思考/结果）时，如果用户停在聊天滚动容器底部附近，
		// 就自动跟随最新内容；用户往上翻则不打断，读回底部后恢复跟随。
		//
		// 不依赖前端给聊天列表预留稳定类名——前端没有（类名都是 hash 过的）。
		// 这里在运行时检测「可滚动 + 内容在增长」的容器：凡是 scrollHeight 大于 clientHeight
		// 且 overflow 可滚动的元素都收进候选集，流式追加时逐个吸底（只吸「当前在底部」的那个）。
		// 这样天然只跟随聊天主滚动区，不影响侧边栏等其它可滚动面板。

		var STICK_GAP = 80;   // 距底部多少 px 内 = “停在底部”，开始跟随
		var NUDGE_MS = 150;   // 内容改动的去抖
		var RESCAN_MS = 3000; // 周期重扫（会话切换后新挂载的聊天滚动容器能被发现）

		var scrollers = new Set();
		var nudgeTimer = null;

		function isScrollable(el) {
			var cs = getComputedStyle(el);
			var oy = cs.overflowY;
			return oy === "auto" || oy === "scroll" || oy === "overlay";
		}

		function updateCandidates() {
			if (typeof document === "undefined") return;
			var all = document.querySelectorAll("*");
			for (var i = 0; i < all.length; i++) {
				var el = all[i];
				if (el.scrollHeight > el.clientHeight + 4 && isScrollable(el)) {
					scrollers.add(el);
				}
			}
			// 清掉已脱离文档的容器（切换会话/关面板后）
			scrollers.forEach(function (el) {
				if (el.isConnected === false) scrollers.delete(el);
			});
		}

		// 对每个「当前停在底部附近」的滚动容器，吸附到最底。用 rAF 折叠渲染帧。
		function nudge() {
			requestAnimationFrame(function () {
				scrollers.forEach(function (el) {
					if (el.isConnected !== true) return;
					if (el.scrollHeight - el.scrollTop - el.clientHeight < STICK_GAP) {
						el.scrollTop = el.scrollHeight;
					}
				});
			});
		}

		function scheduleNudge() {
			if (nudgeTimer !== null) return;
			nudgeTimer = setTimeout(function () {
				nudgeTimer = null;
				nudge();
			}, NUDGE_MS);
		}

		var started = false;
		function start() {
			if (started) return;
			started = true;
			if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
			updateCandidates();
			new MutationObserver(scheduleNudge).observe(document.body, {
				childList: true,
				characterData: true,
				subtree: true
			});
			setInterval(function () {
				updateCandidates();
				nudge();
			}, RESCAN_MS);
		}

		function apply() {
			if (typeof document === "undefined") return;
			start();
		}

		if (typeof document !== "undefined") {
			if (document.readyState === "loading") {
				document.addEventListener("DOMContentLoaded", start);
			} else {
				start();
			}
		}

		exports.apply = apply;
		exports.inject = [];
		return module.exports;
	}
});