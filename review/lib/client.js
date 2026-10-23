window.__ModuleLoader__.load({
	id: "dsh-review",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var react = require("react");
		var react_dom = require("react-dom");
		//#region dsh-review/client.css
		const css =
			".dsr-trigger{display:flex;align-items:center;gap:8px;width:100%;min-width:0;height:32px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#5b6478);font:inherit;font-size:13px;line-height:1;cursor:pointer;text-align:left;transition:background .15s ease,color .15s ease}" +
			".dsr-trigger:hover,.dsr-trigger:focus-visible{background:var(--dsw-alias-fill-l2,rgba(22,32,58,.06));color:var(--dsw-alias-label-primary,#1b2130);outline:none}" +
			".dsr-trigger.dsr-rail{justify-content:center;padding:0}" +
			".dsr-ic{flex:none;display:flex;align-items:center;font-size:13px}" +
			".dsr-label{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}" +
			".dsr-badge{flex:none;font-size:11px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary,#8a93a8)}" +
			".dsr-badge-hot{color:#d97706}" +
			".dsr-overlay{position:fixed;inset:0;z-index:12000;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1,#0f1115);color:var(--dsw-alias-label-primary,#e6e8ec);font-family:var(--dsw-font-family,ui-sans-serif,system-ui,-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif);font-size:13px}" +
			".dsr-bar{flex:none;display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));flex-wrap:wrap}" +
			".dsr-title{font-size:14px;font-weight:600;margin-right:4px}" +
			".dsr-caption{color:var(--dsw-alias-label-tertiary,#8a93a8);font-size:12px}" +
			".dsr-spacer{flex:1}" +
			".dsr-btn{height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#9aa4b2);font:inherit;font-size:12px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}" +
			".dsr-btn:hover:not(:disabled){color:var(--dsw-alias-label-primary,#fff);border-color:var(--dsw-alias-border-l3,rgba(255,255,255,.3))}" +
			".dsr-btn:disabled{opacity:.4;cursor:default}" +
			".dsr-btn-primary{border-color:transparent;background:var(--dsw-alias-state-business-primary,#3d7eff);color:#fff}" +
			".dsr-btn-danger{border-color:transparent;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 18%,transparent);color:var(--dsw-alias-state-error-primary,#ff6b70)}" +
			".dsr-main{flex:1;display:flex;min-height:0}" +
			".dsr-side{flex:none;width:280px;min-width:200px;border-right:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));display:flex;flex-direction:column;min-height:0}" +
			".dsr-tabs{flex:none;display:flex;gap:4px;padding:8px}" +
			".dsr-tab{flex:1;height:28px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--dsw-alias-label-tertiary,#8a93a8);font:inherit;font-size:12px;cursor:pointer}" +
			".dsr-tab-on{background:var(--dsw-alias-fill-l2,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#fff)}" +
			".dsr-filelist{flex:1;overflow:auto;padding:4px 6px}" +
			".dsr-file{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#9aa4b2);font:inherit;font-size:12px;text-align:left;cursor:pointer}" +
			".dsr-file:hover{background:var(--dsw-alias-fill-l2,rgba(255,255,255,.06))}" +
			".dsr-file-on{background:var(--dsw-alias-interactive-bg-active,rgba(61,126,255,.14));color:var(--dsw-alias-label-primary,#fff)}" +
			".dsr-file-path{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-family:var(--ds-font-family-code,ui-monospace,Menlo,Consolas,monospace);font-size:11px}" +
			".dsr-file-num{flex:none;font-size:11px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary,#8a93a8)}" +
			".dsr-empty{flex:1;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary,#8a93a8);font-size:12px;padding:24px}" +
			".dsr-detail{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}" +
			".dsr-filehead{flex:none;display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.05))}" +
			".dsr-fpath{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-family:var(--ds-font-family-code,ui-monospace,Menlo,Consolas,monospace);font-size:12px}" +
			".dsr-modes{flex:none;display:flex;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:7px}" +
			".dsr-mode{border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#8a93a8);font:inherit;font-size:11px;height:22px;padding:0 8px;border-radius:5px;cursor:pointer}" +
			".dsr-mode-on{background:var(--dsw-alias-fill-l2,rgba(255,255,255,.1));color:var(--dsw-alias-label-primary,#fff)}" +
			".dsr-tools{flex:none;display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.05))}" +
			".dsr-search{flex:1;min-width:120px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.12));border-radius:7px;background:var(--dsw-alias-bg-layer-2,#161921);color:var(--dsw-alias-label-primary,#fff);font:inherit;font-size:12px;outline:none}" +
			".dsr-search:focus{border-color:var(--dsw-alias-state-business-primary,#3d7eff)}" +
			".dsr-stat{color:var(--dsw-alias-label-tertiary,#8a93a8);font-size:11px;white-space:nowrap}" +
			".dsr-body{flex:1;overflow:auto;padding:12px 14px 40px}" +
			".dsr-emptydetail{color:var(--dsw-alias-label-tertiary,#8a93a8);text-align:center;padding:40px 0;font-size:12px}" +
			".dsr-chunk{display:flex;flex-direction:column;gap:8px}" +
			".dsr-hunk{border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.09));border-radius:10px;overflow:hidden;scroll-margin:8px}" +
			".dsr-hunk-head{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--dsw-alias-bg-layer-2,#161921);border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}" +
			".dsr-chip{font-size:10px;letter-spacing:.03em;padding:2px 8px;border-radius:999px;flex:none}" +
			".dsr-chip-pending{color:#d97706;background:color-mix(in srgb,#d97706 16%,transparent)}" +
			".dsr-chip-kept{color:#34c759;background:color-mix(in srgb,#34c759 16%,transparent)}" +
			".dsr-chip-reverted{color:#ff6b70;background:color-mix(in srgb,#ff6b70 16%,transparent)}" +
			".dsr-hmeta{flex:1;min-width:0;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a93a8);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}" +
			".dsr-linkbtn{flex:none;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#8a93a8);font:inherit;font-size:11px;cursor:pointer;padding:2px 4px;border-radius:5px}" +
			".dsr-linkbtn:hover{color:var(--dsw-alias-label-primary,#fff);background:var(--dsw-alias-fill-l2,rgba(255,255,255,.08))}" +
			".dsr-hactions{flex:none;display:flex;gap:6px}" +
			".dsr-mini{height:22px;padding:0 9px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#9aa4b2);font:inherit;font-size:11px;cursor:pointer}" +
			".dsr-mini:hover:not(:disabled){color:var(--dsw-alias-label-primary,#fff)}" +
			".dsr-mini:disabled{opacity:.4;cursor:default}" +
			".dsr-keep:hover:not(:disabled){border-color:#34c759;color:#34c759}" +
			".dsr-revert:hover:not(:disabled){border-color:#ff6b70;color:#ff6b70}" +
			".dsr-check{flex:none;width:15px;height:15px;accent-color:var(--dsw-alias-state-business-primary,#3d7eff);cursor:pointer}" +
			".dsr-diff{background:var(--dsw-alias-bg-layer-1,#0f1115)}" +
			".dsr-line{font-family:var(--ds-font-family-code,ui-monospace,Menlo,Consolas,monospace);font-size:11.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;padding:0 10px;overflow-wrap:anywhere}" +
			".dsr-ldel{color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ff6b70) 82%,#fff);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 14%,transparent)}" +
			".dsr-ladd{color:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c759) 82%,#fff);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c759) 13%,transparent)}" +
			".dsr-side2{display:flex;gap:0}" +
			".dsr-sidecol{flex:1;min-width:0;max-height:340px;overflow:auto}" +
			".dsr-sidelabel{padding:3px 10px;font-size:10px;color:var(--dsw-alias-label-tertiary,#8a93a8);background:var(--dsw-alias-bg-layer-2,#161921);border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}" +
			".dsr-markdown{color:var(--dsw-alias-label-primary,#e6e8ec);line-height:1.7;background:var(--dsw-alias-bg-layer-1,#0f1115);padding:0}" +
			".dsr-markdown h1,.dsr-markdown h2{line-height:1.35;margin:14px 0 6px}" +
			".dsr-markdown h1{font-size:19px}.dsr-markdown h2{font-size:16px}.dsr-markdown h3{font-size:14px}" +
			".dsr-markdown p{margin:8px 0}.dsr-markdown pre{background:var(--dsw-alias-markdown-code-block,#161921);padding:10px;border-radius:8px;overflow:auto;font-size:12px}" +
			".dsr-markdown code{font-family:var(--ds-font-family-code,ui-monospace,Menlo,Consolas,monospace);font-size:11.5px}" +
			".dsr-markdown :not(pre)>code{background:var(--dsw-alias-markdown-code-block,#1b1e26);padding:1px 5px;border-radius:4px}" +
			".dsr-markdown ul,.dsr-markdown ol{padding-left:22px;margin:8px 0}" +
			".dsr-markdown blockquote{border-left:3px solid var(--dsw-alias-border-l2);margin:8px 0;padding:2px 12px;color:var(--dsw-alias-label-secondary,#9aa4b2)}" +
			".dsr-markdown hr{border:0;border-top:1px solid var(--dsw-alias-border-l1);margin:14px 0}" +
			".dsr-markdown a{color:var(--dsw-alias-state-business-primary,#3d7eff)}" +
			".dsr-markdown table{border-collapse:collapse;margin:8px 0}.dsr-markdown th,.dsr-markdown td{border:1px solid var(--dsw-alias-border-l1);padding:4px 8px}" +
			".dsr-code{font-family:var(--ds-font-family-code,ui-monospace,Menlo,Consolas,monospace);font-size:12px;color:var(--dsw-alias-label-secondary,#9aa4b2);background:var(--dsw-alias-bg-layer-2,#161921);padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;margin-top:8px}" +
			".dsr-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:12001;background:rgba(23,29,44,.96);color:#fff;padding:8px 14px;border-radius:9px;font-size:12px;box-shadow:0 10px 26px rgba(0,0,0,.35)}" +
			".dsr-mark-adjust{border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));margin-top:10px;padding-top:8px}" +
			".dsr-mark-row{display:flex;align-items:center;gap:8px;padding:4px 0}" +
			".dsr-mark-path{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:11px;color:var(--dsw-alias-label-tertiary,#8a93a8);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}" +
			".dsr-diverge{color:#d97706;font-size:11px}" +
			".dsr-headbadge{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 6px 0 9px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3d7eff) 12%,var(--dsw-alias-bg-layer-2,#161921));color:var(--dsw-alias-label-primary,#e6e8ec);font:inherit;font-size:12px;line-height:1;cursor:pointer;white-space:nowrap}" +
			".dsr-headbadge:hover{border-color:var(--dsw-alias-state-business-primary,#3d7eff)}" +
			".dsr-headbadge:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#3d7eff);outline-offset:1px}" +
			".dsr-head-ic{color:var(--dsw-alias-state-business-primary,#7aa7ff);font-size:12px}" +
			".dsr-head-label{white-space:nowrap}" +
			".dsr-head-num{flex:none;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--dsw-alias-state-business-primary,#3d7eff);color:#fff;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;display:inline-flex;align-items:center;justify-content:center}@media (max-width:640px){.dsr-main{flex-direction:column}.dsr-side{width:auto;flex:none;max-height:42vh;border-right:none;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08))}.dsr-detail{min-height:0}.dsr-bar{max-height:45vh;overflow:auto}}";
		const tagId = "dsh-review/client.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-review";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region dsh-review/client/index.js
		const h = react.createElement;
		const API = {
			state: "/api/review",
			stats: "/api/review.stats",
			decide: "/api/review.decide",
			actAll: "/api/review.act-all",
			undo: "/api/review.undo",
			redo: "/api/review.redo",
			git: "/api/review.git",
		};
		const LS_PREFIX = "dsh-review:";
		const loadLS = (k, d) => { try { const v = window.localStorage.getItem(LS_PREFIX + k); return v === null ? d : v; } catch { return d; } };
		const saveLS = (k, v) => { try { window.localStorage.setItem(LS_PREFIX + k, v); } catch { /* ignore */ } };

		async function call(path, body, errorLike) {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 20000);
			try {
				const resp = await fetch(path, {
					method: body === undefined ? "GET" : "POST",
					headers: body === undefined ? undefined : { "content-type": "application/json" },
					body: body === undefined ? undefined : JSON.stringify(body),
					cache: "no-store",
					signal: controller.signal,
				});
				const data = await resp.json().catch(() => null);
				if (!resp.ok) throw new Error(data?.error || "HTTP " + resp.status);
				return data;
			} finally {
				clearTimeout(timer);
			}
		}

		/** 尽力复制到剪贴板；失败退回临时 textarea 法。 */
		function copyText(text) {
			const done = () => {};
			const fallback = () => {
				try {
					const ta = document.createElement("textarea");
					ta.value = text;
					ta.style.position = "fixed";
					ta.style.opacity = "0";
					document.body.appendChild(ta);
					ta.focus();
					ta.select();
					document.execCommand("copy");
					document.body.removeChild(ta);
					done();
				} catch {
					/* ignore */
				}
			};
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(text).catch(fallback);
				done();
			} else fallback();
			return text;
		}

		/* ---------- 极简 Markdown 渲染（够预览用，先 HTML 转义再推导） ---------- */
		function escapeHtml(s) {
			return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		}

		/** 轻量 markdown → innerHTML（分块处理常见语法）。 */
		function renderMarkdown(text) {
			if (!text) return "";
			const lines = String(text).replace(/\r\n/g, "\n").split("\n");
			const out = [];
			let i = 0;
			const inline = (s) =>
				s
					.replace(/`([^`]+)`/g, "<code>$1</code>")
					.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
					.replace(/\*([^*]+)\*/g, "<em>$1</em>")
					.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
			while (i < lines.length) {
				const line = lines[i];
				if (line.trim() === "") { out.push("<p></p>"); i += 1; continue; }
				if (line.trim().startsWith("```")) {
					const block = [];
					i += 1;
					while (i < lines.length && !lines[i].trim().startsWith("```")) { block.push(lines[i]); i += 1; }
					i += 1;
					out.push("<pre><code>" + escapeHtml(block.join("\n")) + "</code></pre>");
					continue;
				}
				const mTitle = /^(#{1,6})\s+(.*)$/.exec(line);
				if (mTitle) { out.push(`<h${mTitle[1].length}>` + inline(escapeHtml(mTitle[2])) + `</h${mTitle[1].length}>`); i += 1; continue; }
				if (/^---+$/.test(line)) { out.push("<hr>"); i += 1; continue; }
				if (/^>/.test(line)) {
					const q = [];
					while (i < lines.length && /^>/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, "")); i += 1; }
					out.push("<blockquote>" + q.map((l) => inline(escapeHtml(l))).join("<br>") + "</blockquote>");
					continue;
				}
				if (/^\s*[-*+]\s+/.test(line)) {
					const items = [];
					while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(inline(escapeHtml(lines[i].replace(/^\s*[-*+]\s+/, "")))); i += 1; }
					out.push("<ul>" + items.map((it) => "<li>" + it + "</li>").join("") + "</ul>");
					continue;
				}
				if (/^\s*\d+[.)]\s+/.test(line)) {
					const items = [];
					while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(inline(escapeHtml(lines[i].replace(/^\s*\d+[.)]\s+/, "")))); i += 1; }
					out.push("<ol>" + items.map((it) => "<li>" + it + "</li>").join("") + "</ol>");
					continue;
				}
				out.push("<p>" + inline(escapeHtml(line)) + "</p>");
				i += 1;
			}
			return out.join("");
		}

		/* ---------- 状态辅助 ---------- */
		const STATUS = { pending: "pending", kept: "kept", reverted: "reverted" };
		const SRC_LABEL = { agent: "Agent 改动", git: "Git 改动" };

		/* 跨 client 模块实例共享：dsh 每个会话可能各加载一份 client.js 实例，
		   各自模块级变量不互通，会导致切工作区后旧实例 badge 卡在旧工作区。
		   统一挂在 window.__dshReview 上共享 state 与订阅者。 */
		var G = (typeof window !== "undefined" && window.__dshReview) ? window.__dshReview : {};
		if (typeof window !== "undefined") window.__dshReview = G;
		G.subs = G.subs || [];
		const getStatsSnapshot = () => G.stats;
		const subscribeStats = (cb) => { G.subs.push(cb); return () => { const i = G.subs.indexOf(cb); if (i >= 0) G.subs.splice(i, 1); }; };
		async function pollStats() {
			try {
				const data = await call(API.stats);
				G.stats = data;
				G.subs.slice().forEach((cb) => { try { cb(); } catch { /* ignore */ } });
			} catch { /* ignore */ }
		}
		pollStats();
		setInterval(pollStats, 1000);
		// 窗口回到前台/可见时立即刷一次，缩短切工作区后的残留时间
		if (typeof document !== "undefined") {
			document.addEventListener("visibilitychange", () => { if (!document.hidden) pollStats(); });
			window.addEventListener("focus", pollStats);
		}
		function useLatestStats() {
			return react.useSyncExternalStore(subscribeStats, getStatsSnapshot, () => null);
		}

		function fileOf(view, rel, source) {
			return (view?.files || []).find((f) => f.relPath === rel && f.source === source);
		}
		function baseName(p) {
			if (!p) return p || "";
			const seg = String(p).split(/[\\/]/).filter(Boolean);
			return seg.length ? seg[seg.length - 1] : String(p);
		}

		/* ---------- 顶部入口（对话 header，所有工作区汇总；共享于 window.__dshReview） ---------- */
		function ReviewEntry() {
			const stats = useLatestStats();
			const pending = stats && stats.pendingHunks > 0 ? stats.pendingHunks : 0;
			const decided = stats ? ((stats.keptHunks || 0) + (stats.revertedHunks || 0)) : 0;
			if (pending <= 0 && decided <= 0) return null;
			const historyOnly = pending <= 0;
			return h("button",
				{ type: "button", className: "dsr-headbadge", title: historyOnly ? "已全部处理，打开历史改动" : "待处理 " + pending + " / 已处理 " + decided + "（点击查看）", onClick: () => { if (G.setOpen) G.setOpen(true); } },
				h("span", { className: "dsr-head-ic", "aria-hidden": "true" }, "\u2695"),
				h("span", { className: "dsr-head-label" }, historyOnly ? "历史改动" : "待处理改动"),
				historyOnly ? null : h("span", { className: "dsr-head-num" }, pending)
			);
		}

		// ---------- 侧边栏入口（布局流、不悬浮，所有工作区汇总；共享于 window.__dshReview） ----------
		function sidebarShell() {
			const col = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]');
			if (!col) return undefined;
			const logo = col.querySelector('[class*="logoRow"]');
			return (logo && logo.parentElement) || col.firstElementChild;
		}
		function newSessionBtn(root) {
			const nested = root.querySelector('button[class*="newSession"]');
			if (nested) return nested;
			for (const c of root.children) if (c.tagName === "BUTTON") return c;
		}
		function ensureBadge() {
			if (G.badge || typeof document === "undefined") return G.badge;
			const wrap = document.createElement("button");
			wrap.type = "button";
			wrap.setAttribute("data-dsh-review-entry", "");
			wrap.setAttribute("data-dsh-plugin", "dsh-review");
			wrap.setAttribute("data-dsh-part", "sidebar-entry");
			wrap.style.cssText = "display:flex;align-items:center;gap:8px;width:100%;min-width:0;height:36px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#5b6478);font:inherit;font-size:13px;text-align:left;cursor:pointer;";
			const ic = document.createElement("span");
			ic.textContent = "\u2695";
			ic.style.cssText = "flex:none;font-size:13px;";
			const label = document.createElement("span");
			label.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;";
			const num = document.createElement("span");
			num.style.cssText = "flex:none;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--dsw-alias-state-business-primary,#3d7eff);color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums;";
			wrap.append(ic, label, num);
			wrap.addEventListener("mouseenter", () => { wrap.style.background = "var(--dsw-alias-fill-l2,rgba(22,32,58,.06))"; });
			wrap.addEventListener("mouseleave", () => { wrap.style.background = "transparent"; });
			wrap.addEventListener("click", () => { if (G.setOpen) G.setOpen(true); });
			function place() {
				const inner = sidebarShell();
				if (!inner) return;
				if (wrap.parentElement === inner) return;
				const button = newSessionBtn(inner);
				const base = (button && button.closest('[class*="logoRow"]')) || button;
				if (base && base.parentElement === inner) inner.insertBefore(wrap, base.nextElementSibling || null);
				else inner.appendChild(wrap);
			}
			place();
			new MutationObserver(() => {
				const inner = sidebarShell();
				if (!inner || !inner.contains(wrap)) place();
			}).observe(document.body, { childList: true, subtree: true });
			G.badge = { wrap, label, num };
			return G.badge;
		}
		function updateBadge() {
			const b = G.badge || ensureBadge();
			if (!b) return;
			const s = G.stats;
			const pending = s && s.pendingHunks > 0 ? s.pendingHunks : 0;
			const decided = s ? ((s.keptHunks || 0) + (s.revertedHunks || 0)) : 0;
			const wsCount = s && s.byWorkspace ? Object.keys(s.byWorkspace).length : 0;
			const hasAny = pending > 0 || decided > 0;
			b.wrap.style.display = hasAny ? "" : "none";
			b.label.textContent = pending > 0 ? "待处理改动" : (decided > 0 ? "改动历史" : "改动审查");
			b.num.textContent = pending > 0 ? String(pending) : (decided > 0 ? String(decided) : "");
			b.num.style.display = b.num.textContent ? "" : "none";
			b.wrap.title = "待处理 " + pending + " / 已处理 " + decided + " · " + wsCount + " 个工作区（点击查看）";
		}

		// ---------- 面板 React 根（全局单实例，不随会话冻结） ----------
		function ReviewRoot() {
			const stats = useLatestStats();
			const [open, setOpen] = react.useState(false);
			G.setOpen = setOpen;
			const historyOnly = !(stats && stats.pendingHunks > 0);
			react.useEffect(() => {
				const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			}, []);
			return open
				? h(ReviewOverlay, { onClose: () => setOpen(false), initialHistory: historyOnly })
				: null;
		}
		if (typeof document !== "undefined") {
			try {
				var _panelHost = document.createElement("div");
				document.body.appendChild(_panelHost);
				var _rdc = require("react-dom/client");
				_rdc.createRoot(_panelHost).render(h(ReviewRoot));
			} catch (e) {
				console.error("[dsh-review] 面板根挂载失败:", e);
			}
		}

		/* ---------- 覆盖层 ---------- */
		function ReviewOverlay({ onClose, initialHistory = false }) {
			const [view, setView] = react.useState(null);
			const [loading, setLoading] = react.useState(true);
			const [error, setError] = react.useState("");
			const [toast, setToast] = react.useState("");
			const [tab, setTab] = react.useState(loadLS("tab", "git"));
			const [ws, setWs] = react.useState(loadLS("ws", "")); // 工作区筛选："" = 全部（记住上次选择）
			const [wsOpen, setWsOpen] = react.useState(false);
			const [confirm, setConfirm] = react.useState(null); // 回退确认弹窗 {message,onConfirm}
			const [selRel, setSelRel] = react.useState(null);
			const [mode, setMode] = react.useState(loadLS("mode", "unified")); // unified | split | markdown
			const [query, setQuery] = react.useState("");
			const [selected, setSelected] = react.useState({});
			const [showHistory, setShowHistory] = react.useState(initialHistory);
			const bodyRef = react.useRef(null);
			const lastRootRef = react.useRef(null);

			// 用户选的视图模式 / 来源标签持久化，下次进来（甚至刷新后）保持
			const setModePersist = (m) => { setMode(m); saveLS("mode", m); };
			const setTabPersist = (t) => { setTab(t); saveLS("tab", t); setSelRel(null); setSelected({}); };

			const toastShow = (msg) => {
				setToast(msg);
				window.setTimeout(() => setToast(""), 1600);
			};
			const load = react.useCallback(async () => {
				try {
					const data = await call(API.state);
					const root = data && data.workspaceRoot;
					if (root && lastRootRef.current && root !== lastRootRef.current) {
						// 工作区切换：重置选中/历史/搜索，避免显示旧工作区残留内容
						setSelRel(null);
						setSelected({});
						setShowHistory(false);
						setQuery("");
					}
					if (root) lastRootRef.current = root;
					setView(data);
					setError("");
				} catch (e) {
					setError(String(e?.message ?? e));
				} finally {
					setLoading(false);
				}
			}, []);

			react.useEffect(() => {
				load();
				const timer = window.setInterval(() => load().catch(() => {}), 6000);
				return () => window.clearInterval(timer);
			}, [load]);

			const updateView = (data) => {
				if (!data || !data.view) return;
				const v = data.view;
				setView(v);
				setError(data.error || "");
				if (data.expanded && data.expanded > 0) toastShow("这块与后面 " + data.expanded + " 处差异纠缠，已连带回退以保持一致");
				if (data.diskChanged && data.diskChanged.length) toastShow("已在磁盘生效：" + data.diskChanged.join(", "));
			};

			// 选中的文件：优先保持同 source 下。
			// 默认只看「待处理」；历史视图只看「已保留/已回退」的文件，避免处理过的改动一直堆在列表里。
			// ws 非空时只显示该工作区。
			const files = (view?.files || []).filter((f) => f.source === tab && (!ws || f.workspace === ws) && (showHistory ? f.stats.kept + f.stats.reverted > 0 : f.stats.pending > 0));
			const currentFile = selRel ? fileOf(view, selRel, tab) : files[0];
			react.useEffect(() => {
				if (currentFile && selRel !== currentFile.relPath) {
					setSelRel(currentFile.relPath);
					setSelected({});
				}
			}, [view, tab, showHistory]);

			const doAction = react.useCallback(async (body) => {
				try {
					const data = await call(API.decide, body);
					updateView(data);
					if (!data.ok && data.error) toastShow(data.error);
					return data.ok;
				} catch (e) {
					setError(String(e?.message ?? e));
					return false;
				}
			}, []);

			const askRevert = (message, run) => setConfirm({ message, onConfirm: () => { setConfirm(null); run(); } });
			const whole = (rel, action) => {
				if (action === "revert") return askRevert("确定回退整个文件「" + baseName(rel) + "」的全部改动吗？", () => doAction({ action, file: rel, source: tab, hunkIds: null }));
				doAction({ action, file: rel, source: tab, hunkIds: null });
			};
			const operateSelected = (action) => {
				if (!currentFile) return;
				const ids = currentFile.hunks.filter((hh) => selected[hh.id]).map((hh) => hh.id);
				if (ids.length === 0) return;
				if (action === "revert") return askRevert("确定回退选中的 " + ids.length + " 个差异块吗？", () => doAction({ action, file: currentFile.relPath, source: tab, hunkIds: ids }));
				doAction({ action, file: currentFile.relPath, source: tab, hunkIds: ids });
			};
			const operateHunk = (rel, action, hunkId) => {
				if (action === "revert") return askRevert("确定回退这一处改动吗？此操作会直接改写该文件。", () => doAction({ action, file: rel, source: tab, hunkIds: [hunkId] }));
				doAction({ action, file: rel, source: tab, hunkIds: [hunkId] });
			};
			const doUndo = async () => { const d = await call(API.undo, {}); updateView(d); toastShow(d.error || "已撤销"); };
			const doRedo = async () => { const d = await call(API.redo, {}); updateView(d); toastShow(d.error || "已重做"); };
			const doGit = async () => {
				try {
					const d = await call(API.git, {});
					updateView(d);
					toastShow(d.added && d.added.length ? "已导入 " + d.added.length + " 个文件的 Git 改动" : (d.error || "没有新的 Git 改动"));
				} catch (e) { setError(String(e?.message ?? e)); }
			};

			// 跳转下一个/上一个待审查差异块
			const jump = (dir) => {
				if (!currentFile) return;
				const pendings = currentFile.hunks.map((hh, i) => ({ hh, i })).filter((x) => x.hh.status === STATUS.pending);
				if (pendings.length === 0) return;
				const selIdx = currentFile.hunks.findIndex((hh) => selected[hh.id]);
				// 当前视觉焦点 = 第一个被选中的；否则找一个参照
				const cur = selIdx >= 0 ? currentFile.hunks[selIdx] : null;
				let target;
				if (dir > 0) {
					const curIdx = penIdxOf(currentFile.hunks, cur);
					const list = pendings.filter((p) => p.i > curIdx);
					target = list.length ? list[0] : pendings[0];
				} else {
					const curIdx = penIdxOf(currentFile.hunks, cur);
					const list = pendings.filter((p) => p.i < curIdx);
					target = list.length ? list[list.length - 1] : pendings[pendings.length - 1];
				}
				const id = target.hh.id;
				setSelected((s) => (s[id] ? s : { ...s, [id]: true }));
				window.setTimeout(() => {
					const esc = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape : (s) => s;
					const node = document.querySelector('[data-dsr-hunk="' + esc(id) + '"]');
					if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
				}, 30);
			};
			const penIdxOf = (hunks, cur) => hunks.findIndex((hh) => cur && hh.id === cur.id);

			const copyRef = (rel, line) => {
				if (line <= 0) return toastShow("无行号可复制");
				copyText(rel + ":" + line);
				toastShow("已复制 " + rel + ":" + line);
			};

			// 跨文件：全部保留 / 全部回退（按当前工作区筛选；ws 为空 = 所有工作区）
			const doActAll = async (action) => {
				if (!view || !view.files.length) return;
				try {
					const d = await call(API.actAll, { action, workspace: ws });
					updateView(d);
					if (d.ok) toastShow(action === "revert" ? "已回退 " + (d.appliedFiles || 0) + " 个文件的全部改动" : "已保留 " + (d.appliedFiles || 0) + " 个文件的全部改动");
					else if (d.error) toastShow(d.error);
				} catch (e) {
					setError(String(e?.message ?? e));
				}
			};
			const actAll = async (action) => {
				if (action === "revert") return askRevert(ws ? "要把「" + ws + "」工作区所有文件的全部改动都回退（还原为原始状态）吗？此操作会直接改写这些文件。" : "要把所有工作区所有文件的全部改动都回退吗？此操作会直接改写这些文件。", () => doActAll("revert"));
				doActAll(action);
			};

			const foot = view?.stats;
			// 当前筛选范围内（工作区 ws）的待处理 hunk 数，用于「全部保留/回退」按钮的可用态
			const scopedPending = (view?.files || []).filter((f) => !ws || f.workspace === ws).reduce((n, f) => n + ((f.stats && f.stats.pending) || 0), 0);
			const q = query.trim().toLowerCase();
			const hunks = currentFile ? (currentFile.hunks || []) : [];
			const filteredHunks = hunks.filter((hh) => {
				if (!q) return true;
				return (hh.oldText || "").toLowerCase().includes(q) || (hh.newText || "").toLowerCase().includes(q);
			});

			return h(
				"div",
				{ className: "dsr-overlay", role: "dialog", "aria-label": "待处理改动审查" },
				h(
					"div",
					{ className: "dsr-bar" },
					h("span", { className: "dsr-title" }, "\u2695 待处理改动审查"),
					h("span", { className: "dsr-caption" }, view?.workspaceRoot || ""),
					h("span", { className: "dsr-caption" }, foot ? (showHistory ? foot.keptHunks + " 已保留 · " + foot.revertedHunks + " 已回退" : foot.files + " 个文件 · " + foot.pendingHunks + " 待审查") : ""),
					h(
						"div",
						{ style: { position: "relative", display: "inline-block" } },
						h("button", { className: "dsr-btn" + (ws ? " dsr-btn-primary" : ""), title: "按工作区筛选", onClick: () => setWsOpen(!wsOpen) }, (ws || "\u5168\u90e8\u5de5\u4f5c\u533a") + " \u25be"),
						wsOpen
							? h(
									"div",
									{ style: { position: "absolute", top: "100%", left: 0, zIndex: 13001, marginTop: 4, padding: 4, background: "var(--dsw-alias-bg-layer-2,#161921)", border: "1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16))", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.4)" } },
									["", ...Object.keys((view && view.stats && view.stats.byWorkspace) || {})].map((w) =>
										h("button", { key: w || "__all", type: "button", className: "dsr-btn", style: { display: "block", width: "100%", textAlign: "left" }, onClick: () => { setWs(w); saveLS("ws", w); setWsOpen(false); setSelRel(null); setSelected({}); } }, w || "\u5168\u90e8")
									)
								)
							: null
					),
					h("span", { className: "dsr-spacer" }),
					h("button", { className: "dsr-btn dsr-btn-primary", onClick: () => actAll("keep"), disabled: scopedPending === 0 }, "\u2714 \u5168\u90e8\u4fdd\u7559"),
					h("button", { className: "dsr-btn dsr-btn-danger", onClick: () => actAll("revert"), disabled: scopedPending === 0 }, "\u21ba 全部回退"),
					h("button", { className: "dsr-btn" + (showHistory ? " dsr-btn-primary" : ""), title: "切换显示已保留 / 已回退的差异块", onClick: () => { setShowHistory(!showHistory); setSelRel(null); setSelected({}); } }, showHistory ? "\u25c0 返回待处理" : "\u23f1 历史"),
					h("button", { className: "dsr-btn", onClick: load, disabled: loading }, "刷新"),
					h("button", { className: "dsr-btn", onClick: doGit, disabled: !view?.gitAvailable }, "导入 Git 改动"),
					h("button", { className: "dsr-btn", onClick: doUndo, disabled: !view?.canUndo }, "\u21a9 撤销"),
					h("button", { className: "dsr-btn", onClick: doRedo, disabled: !view?.canRedo }, "\u21aa 重做"),
					h("button", { className: "dsr-btn", onClick: onClose }, "\u2715 关闭")
				),
				error ? h("div", { className: "dsr-bar", style: { color: "#ff6b70" } }, error) : null,
				h(
					"div",
					{ className: "dsr-main" },
					// -------- 左：文件列表 --------
					h(
						"div",
						{ className: "dsr-side" },
						h(
							"div",
							{ className: "dsr-tabs" },
							["git", "agent"].map((s) => {
								const sf = (view?.files || []).filter((f) => f.source === s && (!ws || f.workspace === ws));
								const pn = sf.reduce((n, f) => n + ((f.stats && f.stats.pending) || 0), 0);
								return h("button", { key: s, className: "dsr-tab" + (tab === s ? " dsr-tab-on" : ""), onClick: () => setTabPersist(s) },
									SRC_LABEL[s] + (pn > 0 ? " (" + pn + ")" : ""));
							})
						),
						h(
							"div",
							{ className: "dsr-filelist" },
							files.length === 0
								? h("div", { className: "dsr-empty" }, showHistory ? "没有已保留 / 已回退的改动。" : (tab === "agent" ? "还没有捕获到 git 范围之外的 Agent 改动。" : "还没有 Git 改动。"))
								: files.map((f) =>
										h(
											"button",
											{
												key: f.relPath,
												className: "dsr-file" + (currentFile === f ? " dsr-file-on" : ""),
												onClick: () => { setSelRel(f.relPath); setSelected({}); },
												title: f.path,
											},
											h("span", { className: "dsr-file-path", title: (f.workspace ? f.workspace + " / " : "") + f.relPath }, baseName(f.relPath)),
											h("span", { className: "dsr-file-num" }, showHistory ? (f.stats.kept + f.stats.reverted) + " 已处理" : (f.stats.pending > 0 ? f.stats.pending + " 待审" : "✓"))
										)
									)
						),
						h("div", { className: "dsr-stat", style: { padding: "6px 12px" }, title: "可复制行号引用：点差异块上的「复制」" },
							"撤销/重做只作用于审查决策。差异数据已持久化，重启后可继续审。")
					),
					// -------- 右：详情 --------
					loading && !view
						? h("div", { className: "dsr-empty" }, "读取中…")
						: !currentFile
							? h("div", { className: "dsr-empty" }, "从左侧选择一个文件")
							: h(
									"div",
									{ className: "dsr-detail" },
									h(
										"div",
										{ className: "dsr-filehead" },
										h("span", { className: "dsr-fpath", title: currentFile.path }, baseName(currentFile.relPath)),
										!currentFile.composeOk ? h("span", { className: "dsr-diverge" }, "（差异有重叠，回退可能失败）") : null,
										h(
											"div",
											{ className: "dsr-modes" },
											[["unified", "单栏"], ["split", "左右对照"], ["markdown", "Markdown"]].map(([m, label]) =>
												h("button", { key: m, className: "dsr-mode" + (mode === m ? " dsr-mode-on" : ""), onClick: () => setModePersist(m) }, label)
											)
										),
										h(
											"div",
											{ className: "dsr-hactions" },
											h("button", { className: "dsr-mini dsr-keep", onClick: () => whole(currentFile.relPath, "keep"), disabled: currentFile.stats.pending === 0 }, "全部保留"),
											h("button", { className: "dsr-mini dsr-revert", onClick: () => whole(currentFile.relPath, "revert"), disabled: currentFile.stats.pending === 0 }, "全部回退")
										)
									),
									h(
										"div",
										{ className: "dsr-tools" },
										h("input", { className: "dsr-search", placeholder: "在文件内搜索…", value: query, onChange: (e) => setQuery(e.target.value) }),
										h("button", { className: "dsr-mini", onClick: () => jump(-1) }, "\u2191 上一块"),
										h("button", { className: "dsr-mini", onClick: () => jump(1) }, "\u2193 下一块"),
										h("span", { className: "dsr-stat" }, "from L" + (currentFile.hunks[0]?.line > 0 ? currentFile.hunks[0].line : "?")),
										h(
											"div",
											{ className: "dsr-hactions" },
											h("button", { className: "dsr-mini dsr-keep", onClick: () => operateSelected("keep"), disabled: !selectionCount(currentFile.hunks, selected) }, "保留选中"),
											h("button", { className: "dsr-mini dsr-revert", onClick: () => operateSelected("revert"), disabled: !selectionCount(currentFile.hunks, selected) }, "回退选中")
										)
									),
									h(
										"div",
										{ className: "dsr-body", ref: bodyRef },
										renderDetail(currentFile, mode, q, selected, setSelected, operateHunk, copyRef, showHistory)
									)
								)
				),
				toast ? h("div", { className: "dsr-toast" }, toast) : null,
				confirm ? h(ConfirmDialog, { message: confirm.message, onConfirm: confirm.onConfirm, onCancel: () => setConfirm(null) }) : null
			);
		}

		function ConfirmDialog({ message, onConfirm, onCancel }) {
			return h(
				"div",
				{ style: { position: "fixed", inset: 0, zIndex: 13010, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center" }, onClick: onCancel },
				h(
					"div",
					{ style: { background: "var(--dsw-alias-bg-layer-1,#14161b)", border: "1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16))", borderRadius: 12, padding: "16px 18px", width: "min(360px, 86vw)", boxShadow: "0 12px 40px rgba(0,0,0,.5)" }, onClick: (e) => e.stopPropagation() },
					h("div", { style: { fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--dsw-alias-label-primary,#e6e8ec)" } }, "确认回退"),
					h("div", { style: { fontSize: 13, lineHeight: 1.6, color: "var(--dsw-alias-label-secondary,#9aa4b2)", marginBottom: 14, wordBreak: "break-word" } }, message),
					h("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8 } },
						h("button", { className: "dsr-btn", onClick: onCancel }, "取消"),
						h("button", { className: "dsr-btn dsr-btn-danger", onClick: onConfirm }, "确认回退")
					)
				)
			);
		}

		function selectionCount(hunks, selected) {
			return (hunks || []).some((hh) => selected[hh.id] && hh.status === STATUS.pending);
		}

		function renderDetail(file, mode, q, selected, setSelected, operateHunk, copyRef, showHistory) {
			const hunks = file.hunks || [];
			if (hunks.length === 0) return h("div", { className: "dsr-emptydetail" }, "该文件没有差异。");

			// 默认只显示待处理；历史视图只显示已保留/已回退
			const visible = (hh) => (showHistory ? hh.status !== STATUS.pending : hh.status === STATUS.pending);

			if (mode === "markdown") {
				const decisionHunks = hunks.filter(visible);
				return h(
					"div",
					{ className: "dsr-markdown" },
					h("div", { dangerouslySetInnerHTML: { __html: renderMarkdown(file.current) } }),
					h(
						"div",
						{ className: "dsr-mark-adjust" },
						h("div", { className: "dsr-caption", style: { marginBottom: 6 } }, showHistory ? "已保留 / 已回退的差异块（历史）：" : "Markdown 预览中的待决策差异块（可在此保留/回退）："),
						decisionHunks.length === 0
							? h("div", { className: "dsr-caption" }, showHistory ? "该文件没有已保留 / 已回退的差异块。" : "该文件没有待处理的差异块。")
							: decisionHunks.map((hh) =>
									h(
										"div",
										{ key: hh.id, className: "dsr-mark-row" },
										h("span", { className: "dsr-chip dsr-chip-" + hh.status }, statusLabel(hh.status)),
										h("span", { className: "dsr-mark-path" }, (hh.line > 0 ? "L" + hh.line + " · " : "") + ((hh.newText || "").split("\n")[0] || "").slice(0, 40)),
										h(
											"div",
											{ className: "dsr-hactions" },
											h("button", { className: "dsr-mini dsr-keep", disabled: hh.status === STATUS.kept, onClick: () => operateHunk(file.relPath, "keep", hh.id) }, "保留"),
											h("button", { className: "dsr-mini dsr-revert", disabled: hh.status === STATUS.reverted, onClick: () => operateHunk(file.relPath, "revert", hh.id) }, "回退")
										)
									)
								)
					)
				);
			}

			const show = hunks.filter((hh) => {
				if (!visible(hh)) return false;
				if (!q) return true;
				return (hh.oldText || "").toLowerCase().includes(q) || (hh.newText || "").toLowerCase().includes(q);
			});
			if (show.length === 0) return h("div", { className: "dsr-emptydetail" }, showHistory ? "该文件没有已保留 / 已回退的差异块。" : "没有待处理的差异块。");

			return h(
				"div",
				{ className: "dsr-chunk" },
				show.map((hh) =>
					h(
						"div",
						{ key: hh.id, className: "dsr-hunk", "data-dsr-hunk": hh.id },
						h(
							"div",
							{ className: "dsr-hunk-head" },
							h("input", { type: "checkbox", className: "dsr-check", checked: !!selected[hh.id], disabled: hh.status !== STATUS.pending, onChange: (e) => setSelected((s) => ({ ...s, [hh.id]: e.target.checked })) }),
							h("span", { className: "dsr-chip dsr-chip-" + hh.status }, statusLabel(hh.status)),
							h("span", { className: "dsr-hmeta" }, (hh.line > 0 ? "L" + hh.line : "") + (hh.changeTool ? " · " + hh.changeTool : "")),
							h(
								"button",
								{ className: "dsr-linkbtn", title: "复制行号引用", onClick: () => copyRef(file.relPath, hh.line) },
								"\u26db 复制引用"
							),
							h(
								"div",
								{ className: "dsr-hactions" },
								h("button", { className: "dsr-mini dsr-keep", disabled: hh.status === STATUS.kept, onClick: () => operateHunk(file.relPath, "keep", hh.id) }, "保留"),
								h("button", { className: "dsr-mini dsr-revert", disabled: hh.status === STATUS.reverted, onClick: () => operateHunk(file.relPath, "revert", hh.id) }, "回退")
							)
						),
						mode === "split"
							? h(
									"div",
									{ className: "dsr-side2" },
									h(
										"div",
										{ className: "dsr-sidecol" },
										h("div", { className: "dsr-sidelabel" }, "前（before " + (hh.line > 0 ? "L" + hh.line : "") + "）"),
										renderOldBlock(hh.oldText, q, hh.context, hh.oldStart || hh.line)
									),
									h(
										"div",
										{ className: "dsr-sidecol" },
										h("div", { className: "dsr-sidelabel" }, "后（after）"),
										renderNewBlock(hh.newText, q, hh.context, hh.newStart || hh.line)
									)
								)
							: h(
									"div",
									{ className: "dsr-diff" },
									hh.oldText !== null ? renderOldBlock(hh.oldText, q, hh.context, hh.oldStart || hh.line) : null,
									renderNewBlock(hh.newText, q, hh.context, hh.newStart || hh.line)
								)
					)
				)
			);
		}

		function statusLabel(s) {
			return s === STATUS.reverted ? "已回退" : s === STATUS.kept ? "已保留" : "待审查";
		}
		function splitLines(s) {
			if (!s) return [];
			return String(s).split("\n").slice(0, -1); // 去掉结尾由尾换行产生的空行
		}
		function highlight(line, query) {
			if (!query) return line;
			const q = (query || "").toLowerCase();
			const idx = String(line).toLowerCase().indexOf(q);
			if (idx < 0 || q.length === 0) return line;
			return h(
				react.Fragment,
				null,
				String(line).slice(0, idx),
				h("mark", { style: { background: "rgba(255,200,60,.4)", color: "inherit", borderRadius: 2 } }, String(line).slice(idx, idx + q.length)),
				String(line).slice(idx + q.length)
			);
		}
		function lineRow(no, cls, content) {
			return h("div", { className: cls },
				h("span", { style: { display: "inline-block", width: "2.6em", color: "var(--dsw-alias-label-tertiary,#8a93a8)", textAlign: "right", marginRight: 8, userSelect: "none", WebkitUserSelect: "none", fontVariantNumeric: "tabular-nums" } }, no > 0 ? String(no) : ""),
				content
			);
		}
		function blockRowLines(lines, omit, base, bodyCls, prefix, q) {
			const lead = lines.slice(0, omit);
			const body = lines.slice(omit);
			return [
				lead.length > 0 ? lead.map((l, i) => lineRow((base || 0) + i, "dsr-line", " " + highlight(l, q))) : null,
				body.map((l, i) => lineRow((base || 0) + omit + i, bodyCls, prefix + highlight(l, q)))
			];
		}
		function renderOldBlock(oldText, q, context, base) {
			const lines = splitLines(oldText);
			const omit = Math.min(context || 0, lines.length);
			return h(react.Fragment, null, ...blockRowLines(lines, omit, base, "dsr-line dsr-ldel", "-", q));
		}
		function renderNewBlock(newText, q, context, base) {
			const lines = splitLines(newText);
			const omit = Math.min(context || 0, lines.length);
			return h(react.Fragment, null, ...blockRowLines(lines, omit, base, "dsr-line dsr-ladd", "+", q));
		}

		const inject = ["slots"];

		function apply(ctx) {
			// 入口放在对话头部工具区（conversation session header），跟随对话顶部显示。
			// 数据是所有工作区汇总（订阅共享 G.stats），不受"当前工作区"判定影响。
			ctx.slots.inject("conversation.session.header.utilities", () =>
				ctx.slots.register(
					{
						name: "conversation.session.header.utilities",
						id: "dsh-review",
						order: 100,
					},
					ReviewEntry
				)
			);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});