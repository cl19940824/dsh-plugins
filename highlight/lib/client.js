window.__ModuleLoader__.load({
	id: "dsh-highlight",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		// dsh 前端内置 shiki 只对 Ro 别名表里那批语言做高亮；dart / objective-c / oc /
		// objc 不在其中，代码块会以纯文本渲染。本插件在浏览器端为这些缺失语言补高亮，
		// 配色走与 shiki 一致的 --shiki-token-* 主题变量。
		//
		// 定位（踩过的坑）：
		//   1. 前端代码块不是 <code class="language-xxx">。它是 .md-code-block 容器：
		//      语言显示在 [data-code-block-banner] 的第一个子节点（infostring），正文在
		//      [data-code-block-content] 里的 <code>。按 language-* 类名找不到目标。
		//   2. 流式输出时正文会被 React 反复重写；直接改 innerHTML 会把内容冻在第一帧。
		//      所以用 MutationObserver（含 characterData）+ 防抖：等正文稳定下来再上色。
		//   3. 已被 shiki 上色的块（含 span[style] / .tok-）直接跳过。
		//   4. 带行号的块正文是 <span class="line"> 列表，逐行上色以保住行号。
		//
		// 着色规则（不是白名单，是分类）：
		//   * 注释 / 字符串 / 数字         —— 词法识别
		//   * #预处理指令 / @指令 / 关键字  —— 关键词色
		//   * 内置类型 + 大写开头的标识符   —— 类型色（NSString / NSInteger / Circle… 一视同仁）
		//   * 后面紧跟 "(" 的标识符         —— 函数色
		// 这样 NSString 和 NSInteger 不会再一个有颜色一个没有。

		var _started = false;

		// 颜色槽位全部取自 shiki 的 css-variables 主题（dsh 的 --shiki-token-* 变量）。
		var C = {
			keyword: "var(--shiki-token-keyword)",
			type: "var(--shiki-token-function)",
			fn: "var(--shiki-token-function)",
			constant: "var(--shiki-token-constant)",
			string: "var(--shiki-token-string)",
			comment: "var(--shiki-token-comment)",
		};

		function words(s) {
			var out = {};
			s.split(/\s+/).forEach(function (w) {
				if (w) out[w] = 1;
			});
			return out;
		}

		// 语言标记别名 → 规则表键。swift / kotlin 前端 shiki 已内置，
		// shiki 已上色的块会被第 3 条跳过，这里留作兜底。
		var ALIAS = {
			dart: "dart",
			dartlang: "dart",
			"objective-c": "objc",
			objectivec: "objc",
			objc: "objc",
			oc: "objc",
			"objective-c++": "objc",
			objcpp: "objc",
			swift: "swift",
		};

		// 关键字（关键词色）
		var KW = {
			dart: words(
				"abstract as assert async await break case catch class const continue covariant default deferred do " +
					"dynamic else enum export extends external factory final finally for get hide if implements import " +
					"in interface is late library mixin new on operator part required rethrow return set show static " +
					"super switch sync this throw try type typedef var when while with yield"
			),
			objc: words(
				"auto break case char const continue default do else enum extern for goto if inline register restrict " +
					"return sizeof static struct switch typedef union volatile while self super " +
					"@interface @implementation @end @protocol @property @synthesize @dynamic @selector @class @import " +
					"@autoreleasepool @public @private @protected @optional @required @encode @defs @try @catch @finally @throw"
			),
			swift: words(
				"associatedtype class deinit enum extension fileprivate func import init inout internal let open " +
					"operator private protocol public rethrows static struct subscript typealias var break case continue " +
					"default defer do else fallthrough for guard if in repeat return switch where while as Any catch is " +
					"self Self super throw throws try actor async await mutating nonmutating override required convenience " +
					"final lazy dynamic weak unowned optional indirect isolated nonisolated some"
			),
		};

		// 内置类型（类型色）。注意：NSString / NSObject 这类不需要列举 —— 靠下面
		// “大写开头即类型”的规则统一覆盖，所以不会再出现列了就亮、没列就暗。
		var TY = {
			dart: words(
				"int double num String bool List Set Map Future Stream Object Never Iterable Duration DateTime RegExp Symbol Function void dynamic"
			),
			objc: words(
				"void int char float double long short signed unsigned id SEL Class IMP instancetype BOOL NSInteger NSUInteger CGFloat"
			),
			swift: words(
				"Int Int8 Int16 Int32 Int64 UInt UInt8 UInt16 UInt32 UInt64 Double Float Bool String Character Array Dictionary Set Optional Result Void Never Error"
			),
		};

		// 字面量常量（常量色）
		var CO = {
			dart: words("true false null"),
			objc: words("true false nil NULL YES NO"),
			swift: words("true false nil"),
		};

		function escapeHtml(s) {
			return String(s)
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#39;");
		}

		function span(text, color) {
			return '<span class="dsh-hl" style="color:' + color + '">' + text + "</span>";
		}

		// 在 escapeHtml 之后的文本上做词法扫描。只有一个捕获组（字符串），
		// 其余分类靠 m 的首字符 + offset 判断。
		var TOKEN_RE =
			/(&quot;[^\n]*?&quot;|&#39;[^\n]*?&#39;)|\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[A-Za-z_]\w*|@[A-Za-z_]\w*|\b\d[\w.]*\b|\w+/g;

		function tokenize(text, lang) {
			var kw = KW[lang] || {};
			var ty = TY[lang] || {};
			var co = CO[lang] || {};
			return text.replace(TOKEN_RE, function (m, q, offset) {
				if (q !== undefined) return span(m, C.string); // 字符串字面量
				var c = m.charAt(0);
				if (c === "/") return span(m, C.comment); // // 或 /* 注释
				if (c === "#" || c === "@") return span(m, C.keyword); // 预处理 / @指令
				if (c >= "0" && c <= "9") return span(m, C.constant); // 数字
				if (co[m]) return span(m, C.constant);
				if (kw[m]) return span(m, C.keyword);
				if (ty[m]) return span(m, C.type);
				if (c >= "A" && c <= "Z") return span(m, C.type); // 大写开头 → 类型/类名
				if (/^\s*\(/.test(text.slice(offset + m.length))) return span(m, C.fn); // 函数调用
				return m;
			});
		}

		// 已处理缓存：key 是 <code> 元素，value 是上次上色时的 textContent。
		var handled = new WeakMap();

		function colorize(code, lang) {
			var lines = code.querySelectorAll("span.line");
			if (lines.length > 0) {
				// 带行号的块：逐行上色，保住 <span class="line"> 与行号计数器。
				for (var i = 0; i < lines.length; i++) {
					var line = lines[i];
					line.innerHTML = tokenize(escapeHtml(line.textContent), lang);
				}
			} else {
				code.innerHTML = tokenize(escapeHtml(code.textContent), lang);
			}
		}

		function highlightBlock(block) {
			var banner = block.querySelector("[data-code-block-banner]");
			var content = block.querySelector("[data-code-block-content]");
			if (!banner || !content) return;

			var info = banner.firstElementChild;
			var lang = info ? info.textContent.trim().toLowerCase() : "";
			var key = ALIAS[lang];
			if (!key) return;

			var code = content.querySelector("code");
			if (!code) return;

			// 已被 shiki 上色（内置语言，如 swift / kotlin）就不重复处理。
			if (code.querySelector("span[style], .tok-") != null) return;

			var text = code.textContent;
			if (!text) return;

			var prev = handled.get(code);
			if (prev === text) return;
			handled.set(code, text);

			colorize(code, key);
		}

		function scan() {
			var blocks = document.querySelectorAll(".md-code-block");
			for (var i = 0; i < blocks.length; i++) highlightBlock(blocks[i]);
		}

		var _pending = null;
		function schedule() {
			if (_pending !== null) window.clearTimeout(_pending);
			_pending = window.setTimeout(function () {
				_pending = null;
				scan();
			}, 600);
		}

		function install() {
			if (_started) return;
			_started = true;
			if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
			scan();
			new MutationObserver(schedule).observe(document.body, {
				childList: true,
				characterData: true,
				subtree: true,
			});
		}

		function apply() {
			if (typeof document === "undefined") return;
			install();
		}

		if (typeof document !== "undefined") {
			if (document.readyState === "loading") {
				document.addEventListener("DOMContentLoaded", install);
			} else {
				install();
			}
		}

		exports.apply = apply;
		exports.inject = [];
		return module.exports;
	},
});
