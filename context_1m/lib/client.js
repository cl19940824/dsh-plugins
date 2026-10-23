window.__ModuleLoader__.load({
	id: "dsh-context-1m",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var react = require("react");

		//#region dsh-context-1m/client.css
		// 与 dsh-thinking-strength / dsh-multimodal 的勾选框一致：gap/height/字号/对齐/颜色/勾选框尺寸完全相同
		const css =
			".dcm-check{display:inline-flex;align-items:center;gap:6px;height:26px;font-size:12px;line-height:1;color:var(--dsw-alias-label-secondary,#5b6478);cursor:pointer}" +
			".dcm-check.dcm-check-on{color:var(--dsw-alias-state-business-primary,#3d7eff)}" +
			".dcm-check input{width:14px;height:14px;margin:0;accent-color:var(--dsw-alias-state-business-primary,#3d7eff);cursor:pointer}";
		const tagId = "dsh-context-1m/client.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-context-1m";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region dsh-context-1m/client/index.js
		const h = react.createElement;
		const API_STATE = "/api/dsh-context-1m.state";
		const API_SET = "/api/dsh-context-1m.set";
		const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-US") : "?");

		/**
		 * 输入框里的「1M 上下文」勾选框（渲染在 `conversation.input.right`）。
		 *
		 * 勾选状态 = 当前模型在 llm-pi-ai 配置（profile 的 cordis.patch.yml）里
		 * 是否**显式声明了 onTokens**（默认 1,000,000）。
		 *   勾上 → 写入 `contextWindow: onTokens`；
		 *   取消 → 写回 `offTokens`（逐模型表优先，默认 128K），**不删字段**。
		 *
		 * 不删字段的原因：llm-pi-ai 在字段缺失时用 provider 的
		 * `defaultContextWindow` 兜底，其默认值是 1e6 —— 删字段会让窗口仍然是 1M，
		 * 勾选框等于失效，还会丢掉用户手写的诚实值。声明了别的值（如 384000）时
		 * 勾选框显示为未勾选，并在 title 里如实显示当前声明值。
		 * 上下文容量 / 自动压缩（compaction-basic）都按这个声明值计算。
		 *
		 * 当前模型从 `useProjection("modelSelection")` 读：`next` 是刚在模型
		 * 选择器里选中（可能还没发消息）的 {provider, model}，切换模型时勾选框
		 * 立即跟随。**新对话（投影为空）时跟多模态插件一样，回退到宿主的默认
		 * 模型**：不带参数请求 /state，宿主用 agentDefaultModel 兜底。每次切换
		 * 都回读文件，状态按模型各自独立。
		 */
		function Context1mCheckbox({ useProjection }) {
			const selection = useProjection("modelSelection");
			const projected = selection?.next ?? selection?.lastUsed ?? null;
			// 新对话投影为空时，由宿主 `/state`（无参数）回填默认模型
			const [fallback, setFallback] = react.useState(null);
			const current = projected ?? fallback;

			const [has, setHas] = react.useState(false);
			const [declared, setDeclared] = react.useState(null);
			const [onTokens, setOnTokens] = react.useState(1000000);
			const [offTokens, setOffTokens] = react.useState(null);
			const [busy, setBusy] = react.useState(false);
			const [loading, setLoading] = react.useState(false);
			const [error, setError] = react.useState(null);

			// 请求键：只依赖「投影里的模型」或「空（新会话）」，避免回填默认模型后再触发一轮
			const requestKey = projected ? projected.provider + "\u0000" + projected.model : "\u0000default";

			react.useEffect(() => {
				let cancelled = false;
				setLoading(true);
				setError(null);
				// 投影存在按模型查；新会话投影为空 → 不带参数，宿主用默认模型兜底
				const qs = projected
					? "provider=" + encodeURIComponent(projected.provider) + "&model=" + encodeURIComponent(projected.model)
					: "";
				fetch(API_STATE + (qs ? "?" + qs : ""), { cache: "no-store" })
					.then((r) => r.json())
					.then((d) => {
						if (cancelled) return;
						if (d && d.ok && d.provider && d.model) {
							setFallback({ provider: d.provider, model: d.model });
							setHas(!!(d.checked ?? d.has));
							setDeclared(typeof d.declared === "number" ? d.declared : null);
							setOnTokens(typeof d.onTokens === "number" ? d.onTokens : 1000000);
							setOffTokens(typeof d.offTokens === "number" ? d.offTokens : null);
						} else {
							setError((d && d.error) || "读取失败");
						}
					})
					.catch(() => { if (!cancelled) setError("读取失败"); })
					.finally(() => { if (!cancelled) setLoading(false); });
				return () => { cancelled = true; };
			}, [requestKey]);

			const toggle = () => {
				if (!current || busy || loading) return;
				setBusy(true);
				setError(null);
				const enabled = !has;
				fetch(API_SET, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ provider: current.provider, model: current.model, enabled })
				})
					.then((r) => r.json())
					.then((d) => {
						if (d && d.ok) {
							setHas(!!d.enabled);
							if (typeof d.tokens === "number") setDeclared(d.tokens);
						} else setError((d && d.error) || "设置失败");
					})
					.catch(() => setError("设置失败"))
					.finally(() => setBusy(false));
			};

			if (!current || !current.provider || !current.model) return null;

			const state =
				declared === null
					? "未声明 contextWindow"
					: "当前声明 contextWindow=" + fmt(declared);
			const title =
				error ||
				current.model +
					" · " +
					state +
					(has
						? "（1M 上下文）"
						: " · 勾选写入 " + fmt(onTokens) + (offTokens !== null ? " · 取消写回 " + fmt(offTokens) : ""));

			// 与思考/多模态插件一致：文字靠左、勾选框靠右，颜色/字号/对齐照搬
			return h(
				"span",
				{ className: "dcm-check" + (has ? " dcm-check-on" : ""), title: title },
				h("span", null, "1M"),
				h("input", {
					type: "checkbox",
					checked: has,
					disabled: busy || loading,
					onChange: toggle
				})
			);
		}

		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("conversation.input.right", () =>
				ctx.slots.register(
					{ name: "conversation.input.right", id: "context-1m", order: 21 },
					Context1mCheckbox
				)
			);
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
