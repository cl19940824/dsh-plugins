window.__ModuleLoader__.load({
	id: "dsh-font",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var react = require("react");
		var react_dom = require("react-dom");
		//#region dsh-font/client.css
		const css =
			".dsf-trigger{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:8px;background:var(--dsw-alias-bg-layer-2,#161921);color:var(--dsw-alias-label-secondary,#9aa4b2);font:inherit;font-size:12px;line-height:1;cursor:pointer;white-space:nowrap}" +
			".dsf-trigger:hover,.dsf-trigger.dsf-on{border-color:var(--dsw-alias-state-business-primary,#3d7eff);color:var(--dsw-alias-label-primary,#e6e8ec)}" +
			".dsf-trigger:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#3d7eff);outline-offset:1px}" +
			".dsf-backdrop{position:fixed;inset:0;z-index:12090;background:rgba(0,0,0,.35)}" +
			".dsf-panel{position:fixed;z-index:12091;top:50%;left:50%;transform:translate(-50%,-50%);width:min(520px,calc(100vw - 40px));max-height:min(82vh,720px);overflow:auto;padding:18px 20px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:14px;background:var(--dsw-alias-bg-layer-1,#14161b);color:var(--dsw-alias-label-primary,#e6e8ec);font-family:var(--dsw-font-family,ui-sans-serif,system-ui,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif);font-size:13px;line-height:1.6;box-shadow:0 24px 60px rgba(0,0,0,.5)}" +
			".dsf-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}" +
			".dsf-title{font-size:14px;font-weight:600;flex:1}" +
			".dsf-btn{height:26px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#9aa4b2);font:inherit;font-size:12px;cursor:pointer}" +
			".dsf-btn:hover:not(:disabled){color:var(--dsw-alias-label-primary,#fff);border-color:var(--dsw-alias-border-l3,rgba(255,255,255,.3))}" +
			".dsf-btn:disabled{opacity:.4;cursor:default}" +
			".dsf-field{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}" +
			".dsf-field-label{width:110px;flex:none;color:var(--dsw-alias-label-secondary,#9aa4b2);font-size:12px}" +
			".dsf-field-main{flex:1;min-width:0}" +
			".dsf-select{width:100%;height:30px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));border-radius:7px;background:var(--dsw-alias-bg-layer-2,#1a1d24);color:var(--dsw-alias-label-primary,#fff);font:inherit;font-size:12px;outline:none}" +
			".dsf-select:focus{border-color:var(--dsw-alias-state-business-primary,#3d7eff)}" +
			".dsf-input{width:100%;height:30px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));border-radius:7px;background:var(--dsw-alias-bg-layer-2,#1a1d24);color:var(--dsw-alias-label-primary,#fff);font:inherit;font-size:12px;outline:none}" +
			".dsf-input:focus{border-color:var(--dsw-alias-state-business-primary,#3d7eff)}" +
			".dsf-stepper{display:flex;align-items:center;gap:8px}" +
			".dsf-step{width:26px;height:26px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#9aa4b2);font:inherit;font-size:14px;cursor:pointer;line-height:1}" +
			".dsf-step:hover:not(:disabled){color:var(--dsw-alias-label-primary,#fff)}" +
			".dsf-step:disabled{opacity:.4;cursor:default}" +
			".dsf-value{min-width:40px;text-align:center;font-variant-numeric:tabular-nums;font-size:13px}" +
			".dsf-color{width:52px;height:28px;padding:2px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.18));border-radius:7px;background:transparent;cursor:pointer}" +
			".dsf-custom{width:100%;margin-top:6px}" +
			".dsf-hint{color:var(--dsw-alias-label-tertiary,#8a93a8);font-size:11px;line-height:1.5;margin-top:10px}" +
			".dsf-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}" +
			".dsf-row{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));cursor:pointer}" +
			".dsf-row:last-child{border-bottom:none}" +
			".dsf-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05))}" +
			".dsf-row:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#3d7eff);outline-offset:-2px;border-radius:8px}" +
			".dsf-row-info{flex:1;min-width:0}" +
			".dsf-row-title{color:var(--dsw-alias-label-primary,#e6e8ec);font-size:13px;font-weight:500}" +
			".dsf-row-desc{color:var(--dsw-alias-label-tertiary,#8a93a8);font-size:11px;margin-top:2px}" +
			".dsf-row-right{display:flex;align-items:center;gap:8px;flex:none}" +
			".dsf-row-sum{color:var(--dsw-alias-label-tertiary,#8a93a8);font-size:11px}" +
			".dsf-row-btn{font-size:12px;color:var(--dsw-alias-state-business-primary,#7aa7ff)}";
		const tagId = "dsh-font/client.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-font";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region dsh-font/client/index.js
		const h = react.createElement;

		const LS_KEY = "dsh-font:settings";
		const DEFAULT = { uiFont: "", codeFont: "", fontSize: 14, text: "", bg: "", enabled: true };
		const UI_PRESETS = {
			"": "(默认)",  // 不覆盖，沿用 dsh 默认
			yahei: '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif',
			pingfang: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Heiti SC", sans-serif',
			songti: '"Songti SC", SimSun, "Noto Serif SC", "Georgia", serif',
			serif: 'Georgia, "Times New Roman", "Noto Serif SC", serif',
			mono: 'var(--ds-font-family-code)',
			couriernew: '"Courier New", Courier, monospace',
		};
		const CODE_PRESETS = {
			"": "(默认)",
			menlo: 'Menlo, Consolas, monospace',
			monaco: '"SF Mono", Monaco, Menlo, Consolas, monospace',
			jetbrains: '"JetBrains Mono", "Fira Code", Consolas, monospace',
			consolas: 'Consolas, "Liberation Mono", "SF Mono", monospace',
			couriernew: '"Courier New", Courier, monospace',
			monospace: 'ui-monospace, monospace',
		};

		// CSS 关键字/通用族：这些不需要加引号
		const GENERIC_FONTS = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "emoji", "math", "fangsong", "initial", "inherit", "unset"]);

		/** 把用户输入的字体名/字体栈规范成合法 CSS font-family 值：含空格且未加引号的族名自动加双引号。 */
		function fontFamilyValue(raw) {
			const s = String(raw ?? "").trim();
			if (!s) return "";
			return s
				.split(",")
				.map((seg) => {
					const t = seg.trim();
					if (!t) return "";
					if (/^["'].*["']$/.test(t)) return t; // 已加引号，原样保留
					if (GENERIC_FONTS.has(t.toLowerCase())) return t; // 通用族，不加引号
					if (/\s/.test(t)) return '"' + t + '"'; // 含空格的家族名 → 加双引号
					return t;
				})
				.filter(Boolean)
				.join(", ");
		}

		function loadSettings() {
			try {
				const raw = window.localStorage.getItem(LS_KEY);
				if (raw) {
					const p = JSON.parse(raw);
					return { ...DEFAULT, ...(p && typeof p === "object" ? p : {}) };
				}
			} catch { /* ignore */ }
			return { ...DEFAULT };
		}
		function saveSettings(s) {
			try { window.localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
		}

		/** 十六进制 → rgba；解析失败原样返回。 */
		function hexToRgba(hex, alpha) {
			if (typeof hex !== "string") return hex;
			let m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
			if (!m) return hex;
			let s = m[1];
			if (s.length === 3) s = s.split("").map((c2) => c2 + c2).join("");
			const n = parseInt(s, 16);
			const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
			return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
		}

		/*
		 * 覆盖写在哪里 —— 这是本插件唯一要紧的一件事。
		 *
		 * dsh 0.2.1-rc.2 起，设计 token 的落地位置变了：base.css 只在 `:root` 上放默认值，
		 * 真正的 token 表（--dsw-font-*、--ds-font-family-code、--dsw-alias-* 颜色）全部
		 * 声明在 `body` / `body[data-ds-dark-theme]` 上。自定义属性是按元素继承的，body 自己
		 * 声明了同名 token，写在 `:root` 上的覆盖对 body 及其所有后代就一律失效 —— 把 <style>
		 * 挪到 <head> 末尾也救不回来，因为跨元素比的不是级联顺序，而是“谁在这个元素上声明了”。
		 * 所以覆盖必须落在 body 作用域。
		 *
		 * 又因为这些 value 的对手里还有：boot 脚本写在 document.body.style 上的内联
		 * --dsh-content-font-size、以及 html[data-platform=darwin] body 这类 (0,1,2) 特异性的
		 * 规则，光靠 body 选择器/顺序都不够稳，统一加 !important 才算压得住。
		 * （!important 只作用于 body 这一层；后代元素自己声明的值仍然优先，不会被误伤。）
		 */
		const OVERRIDE_SEL = "body";
		const IMPORTANT = " !important";
		/** dsh 自带的三个字号设置：会话内容 / 代码块 / 终端（boot 脚本内联写在 body 上）。 */
		const CONTENT_SIZE_VARS = ["--dsh-content-font-size", "--dsh-code-font-size", "--dsh-terminal-font-size"];

		/** 自动发现所有 `--dsw-font-*` 的字号/行高（含简写），按 factor 统一缩放。 */
		function scaledFontCss(factor) {
			if (Math.abs(factor - 1) < 1e-6) return "";
			// token 声明在 body 上，所以要从 body 量；量 html 只会拿到空串（缩放从来没生效过）
			const host = document.body || document.documentElement;
			if (!host) return "";
			const st = getComputedStyle(host);
			const overrides = [];
			for (let i = 0; i < st.length; i += 1) {
				const name = st[i];
				if (!name.startsWith("--dsw-font-")) continue;
				if (name.indexOf("markdown") >= 0) continue; // markdown 字号已由 --dsh-content-font-size 驱动
				const value = st.getPropertyValue(name).trim();
				// 简写：`13px/20px var(--dsw-font-family)` 或 `500 13px/20px var(...)`
				const short = /^((?:\d+\s+)?)([\d.]+)px\/([\d.]+)px\s+(.+)$/.exec(value);
				if (short) {
					const size = parseFloat(short[2]) * factor;
					const lh = parseFloat(short[3]) * factor;
					const prefix = short[1] || "";
					overrides.push(name + ": " + prefix + Math.round(size * 10) / 10 + "px/" + Math.round(lh * 10) / 10 + "px " + short[4] + IMPORTANT);
					continue;
				}
				// 独立的 -font-size / -line-height 子属性
				if (/-(?:font-size|line-height)$/.test(name)) {
					const pm = /^([\d.]+)px$/.exec(value);
					if (pm) overrides.push(name + ": " + Math.round(parseFloat(pm[1]) * factor * 10) / 10 + "px" + IMPORTANT);
				}
			}
			// 会话内容 / 代码块 / 终端字号由 boot 脚本内联写在 body 上（dsh 自带设置驱动），
			// 这里按同一比例跟着放大缩小 —— 乘的是 dsh 自己的值，所以不和自带设置打架。
			for (const name of CONTENT_SIZE_VARS) {
				const pm = /^([\d.]+)px$/.exec(st.getPropertyValue(name).trim());
				if (pm) overrides.push(name + ": " + Math.round(parseFloat(pm[1]) * factor * 10) / 10 + "px" + IMPORTANT);
			}
			if (overrides.length === 0) return "";
			return OVERRIDE_SEL + "{" + overrides.join(";") + "}";
		}

		function buildStyle(s) {
			const chunks = [];
			let ui = UI_PRESETS[s.uiFont] !== undefined ? (s.uiFont === "" ? "" : UI_PRESETS[s.uiFont]) : (s.uiFont || "");
			let code = CODE_PRESETS[s.codeFont] !== undefined ? (s.codeFont === "" ? "" : CODE_PRESETS[s.codeFont]) : (s.codeFont || "");
			ui = fontFamilyValue(ui);
			code = fontFamilyValue(code);
			const vars = [];
			if (ui) vars.push("--dsw-font-family:" + ui + IMPORTANT);
			if (code) vars.push("--ds-font-family-code:" + code + IMPORTANT);
			if (s.text) {
				vars.push("--dsw-alias-label-primary:" + s.text + IMPORTANT);
				vars.push("--dsw-alias-label-primary-inverted:" + s.text + IMPORTANT);
				vars.push("--dsw-alias-label-secondary:" + hexToRgba(s.text, 0.82) + IMPORTANT);
				vars.push("--dsw-alias-label-tertiary:" + hexToRgba(s.text, 0.66) + IMPORTANT);
				vars.push("--dsw-alias-label-caption:" + hexToRgba(s.text, 0.6) + IMPORTANT);
			}
			if (s.bg) {
				vars.push("--dsw-alias-bg-base:" + s.bg + IMPORTANT);
				vars.push("--dsw-alias-bg-layer-1:" + s.bg + IMPORTANT);
				vars.push("--dsw-alias-bg-layer-2:" + s.bg + IMPORTANT);
				vars.push("--dsw-alias-bg-layer-3:" + s.bg + IMPORTANT);
				vars.push("--dsw-alias-bg-module-platform:" + s.bg + IMPORTANT);
			}
			if (vars.length) chunks.push(OVERRIDE_SEL + "{" + vars.join(";") + "}");
			return chunks.join("\n");
		}

		/*
		 * 两份 <style>：`base` 放字体/颜色，`scale` 放按比例缩放出来的字号表。
		 * 分开是为了让缩放那一遍「只清掉自己上一次的缩放结果」再量主题原值 —— 既不会被上一次的缩放
		 * 滚雪球，又能在量的时候保留 base 里的字体覆盖（--dsw-font-xs-13 这类简写的
		 * `13px/20px var(--dsw-font-family)` 在 computed value 里就已经把 family 展开固定了，
		 * 量的时候若不带着字体覆盖，就会把主题默认字体烤进缩放结果里）。
		 */
		function ensureStyleTag(id) {
			let el = document.getElementById(id);
			if (!el) {
				el = document.createElement("style");
				el.id = id;
				el.dataset.plugin = "dsh-font";
			}
			return el;
		}

		const BASE_STYLE_ID = "dsh-font-style";
		const SCALE_STYLE_ID = "dsh-font-scale";

		function applyStyle(s) {
			const base = ensureStyleTag(BASE_STYLE_ID);
			const scale = ensureStyleTag(SCALE_STYLE_ID);
			base.textContent = "";
			scale.textContent = "";
			if (s.enabled !== false) base.textContent = buildStyle(s);
			// 顺序仍是「插件靠后」最省心：主题在切主题时可能重新注入自己的 <style>，
			// 挪到 <head> 末尾（appendChild 对已存在节点即“移动到末尾”）可以顺带压住同特异性的规则。
			document.head.appendChild(base);
			document.head.appendChild(scale);
			if (s.enabled === false) return;
			scale.textContent = scaledFontCss((s.fontSize || 14) / 14);
		}

		// 下拉里显示的名字（比直接显示 CSS 字体栈更友好）
		const UI_LABELS = {
			"": "（默认）",
			yahei: "微软雅黑",
			pingfang: "苹方 (PingFang)",
			songti: "宋体 (Songti)",
			serif: "衬线体 (Serif)",
			mono: "等宽（跟随代码字体）",
			couriernew: "Courier New",
		};
		const CODE_LABELS = {
			"": "（默认）",
			menlo: "Menlo",
			monaco: "SF Mono / Monaco",
			jetbrains: "JetBrains Mono",
			consolas: "Consolas",
			couriernew: "Courier New",
			monospace: "等宽 (monospace)",
		};

		/** 自定义输入框里显示的字体栈：存的是预设 key 时展开成真正的 CSS 值，免得只看到 "couriernew"。 */
		function displayStack(presets, raw) {
			const s = raw || "";
			if (!s) return "";
			return presets[s] !== undefined ? presets[s] : s;
		}

		/* ---------- 入口按钮 ---------- */
		function FontEntry() {
			const [open, setOpen] = react.useState(false);
			const [settings, setSettings] = react.useState(DEFAULT);

			react.useEffect(() => {
				const s = loadSettings();
				setSettings(s);
				// 等主题 CSS 就绪后再应用，必要时重试几次
				let tries = 0;
				const tick = () => {
					applyStyle(s);
					if ((tries += 1) < 6) setTimeout(tick, 120);
				};
				setTimeout(tick, 40);
				return () => {};
			}, []);

			const update = (patch) => {
				setSettings((prev) => {
					const next = { ...prev, ...patch };
					saveSettings(next);
					applyStyle(next);
					return next;
				});
			};
			const reset = () => update({ ...DEFAULT });

			const hasCustom = !!(settings.uiFont || settings.codeFont || settings.text || settings.bg || settings.enabled === false || settings.fontSize !== 14);
			const summary = settings.enabled === false ? "已禁用" : hasCustom ? "已自定义（字号 " + settings.fontSize + "px）" : "跟随默认";

			return h(
				react.Fragment,
				null,
				h(
					"div",
					{ className: "dsf-row", role: "button", tabIndex: 0, "aria-label": "字体 / 字号 / 颜色设置", onClick: () => setOpen(true), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") setOpen(true); } },
					h("div", { className: "dsf-row-info" },
						h("div", { className: "dsf-row-title" }, "字体 / 字号 / 颜色"),
						h("div", { className: "dsf-row-desc" }, "界面字体、代码字体、字号缩放、文字色、背景色（全局）")
					),
					h("div", { className: "dsf-row-right" },
						h("span", { className: "dsf-row-sum" }, summary),
						h("span", { className: "dsf-row-btn" }, "设置")
					)
				),
				open
					? react_dom.createPortal(
							h(
								react.Fragment,
								null,
								h("div", { className: "dsf-backdrop", onClick: () => setOpen(false) }),
								h(
									"div",
									{ className: "dsf-panel", role: "dialog", "aria-label": "字体与颜色" },
									h("div", { className: "dsf-head" },
										h("span", { className: "dsf-title" }, "字体 / 字号 / 颜色"),
										h("button", { className: "dsf-btn", onClick: () => update({ enabled: !settings.enabled }) }, settings.enabled === false ? "启用" : "禁用"),
										h("button", { className: "dsf-btn", onClick: reset }, "恢复默认"),
										h("button", { className: "dsf-btn", onClick: () => setOpen(false) }, "关闭")
									),
									h(Field, { label: "界面字体", children: h("select", { className: "dsf-select", value: settings.uiFont, onChange: (e) => update({ uiFont: e.target.value }) },
										Object.keys(UI_PRESETS).map((k) => h("option", { key: k, value: k }, UI_LABELS[k] || UI_PRESETS[k])),
										settings.uiFont && UI_PRESETS[settings.uiFont] === undefined ? h("option", { key: settings.uiFont, value: settings.uiFont }, settings.uiFont) : null
									) }),
									h(Field, { label: "界面字体（自定义）", children: h("input", { className: "dsf-input dsf-custom", placeholder: "如：'Noto Sans SC', sans-serif", value: displayStack(UI_PRESETS, settings.uiFont), onChange: (e) => update({ uiFont: e.target.value }) }) }),
									h(Field, { label: "代码字体", children: h("select", { className: "dsf-select", value: settings.codeFont, onChange: (e) => update({ codeFont: e.target.value }) },
										Object.keys(CODE_PRESETS).map((k) => h("option", { key: k, value: k }, CODE_LABELS[k] || CODE_PRESETS[k])),
										settings.codeFont && CODE_PRESETS[settings.codeFont] === undefined ? h("option", { key: settings.codeFont, value: settings.codeFont }, settings.codeFont) : null
									) }),
									h(Field, { label: "代码字体（自定义）", children: h("input", { className: "dsf-input dsf-custom", placeholder: "如：'Maple Mono', monospace", value: displayStack(CODE_PRESETS, settings.codeFont), onChange: (e) => update({ codeFont: e.target.value }) }) }),
									h(Field, { label: "字号（全局缩放）", children: h("div", { className: "dsf-stepper" },
										h("button", { className: "dsf-step", disabled: settings.fontSize <= 10, onClick: () => update({ fontSize: settings.fontSize - 1 }) }, "\u2212"),
										h("span", { className: "dsf-value" }, settings.fontSize + " px"),
										h("button", { className: "dsf-step", disabled: settings.fontSize >= 22, onClick: () => update({ fontSize: settings.fontSize + 1 }) }, "+")
									) }),
									h(Field, { label: "文字颜色", children: h(ColorField, { value: settings.text || "#e6e8ec", onChange: (v) => update({ text: v }) }) }),
									h(Field, { label: "背景颜色", children: h(ColorField, { value: settings.bg || "", onChange: (v) => update({ bg: v }) }) }),
									h("div", { className: "dsf-hint" }, "设置会立即全局生效并持久化保存；「字号」以 14px 为 100%（=不缩放），按比例缩放全局文本 —— 标题、文件列表、左右对照、Markdown 与代码块、终端字号一起跟着变。文字/背景留空时沿用 dsh 当前主题。"),
									h("div", { className: "dsf-foot" }, h("button", { className: "dsf-btn", onClick: () => setOpen(false) }, "确定"))
								)
							),
							document.body
						)
					: null
			);
		}

		function Field({ label, children }) {
			return h("div", { className: "dsf-field" },
				h("div", { className: "dsf-field-label" }, label),
				h("div", { className: "dsf-field-main" }, children)
			);
		}

		function ColorField({ value, onChange }) {
			return h("input", { type: "color", className: "dsf-color", value: value || "#e6e8ec", onChange: (e) => onChange(e.target.value) });
		}

		const inject = ["slots"];

		function apply(ctx) {
			// 入口放进「设置 → 常规」：设置页里的一行「字体 / 字号 / 颜色」
			ctx.slots.inject("settings.general.item", () =>
				ctx.slots.register(
					{
						name: "settings.general.item",
						id: "dsh-font",
						order: 30,
					},
					FontEntry
				)
			);
		}

		// 启动 / 重新加载时就把已保存的设置应用到全局（入口在设置页里，未必会挂载，
		// 所以必须在模块加载阶段就应用，字体才不会被重置）
		if (typeof document !== "undefined") {
			const bootApply = () => applyStyle(loadSettings());
			bootApply();
			const _t1 = setTimeout(bootApply, 120);
			const _t2 = setTimeout(bootApply, 500);
			const _t3 = setTimeout(bootApply, 1500);
			if (typeof window !== "undefined") {
				window.addEventListener("load", bootApply);
			}
			void _t1; void _t2; void _t3;
		}
		exports.apply = apply;
		exports.inject = inject;
		//#endregion
		return module.exports;
	}
});