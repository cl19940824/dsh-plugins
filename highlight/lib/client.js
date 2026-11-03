window.__ModuleLoader__.load({
	id: "dsh-highlight",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		// dsh 前端内置 shiki 没有 objective-c / dart 语法，这些代码块会以纯文本渲染。
		// 本插件在浏览器端给它们补词法高亮，配色走与 shiki 一致的 --shiki-token-* 变量。
		//
		// 定位（踩过的坑，2026-11 版 dsh 实测）：
		//   1. 代码块可能不是 <code class="language-xxx">，而是 .md-code-block 容器：
		//      [data-code-block-banner] 里放语言名，[data-code-block-content] 里放正文。
		//   2. 关键：不认识的 fence 语言**不会**进 banner。渲染函数是
		//        span.language = F_(lang) ? lang : i.codeLabel      // F_ 只认已知语言
		//      所以 ```objc 的 banner 显示的是「代码块」，语言信息在 DOM 里直接丢了。
		//      （另一条 infostring 分支才会原样输出 lang，这里兼容两种。）
		//   3. 既然拿不到语言名，就用内容识别：先看 banner 里是不是真语言名，不是的话
		//      对正文打分（@interface / #import / NS* / [self ...] / import 'package: …），
		//      分数够才动手，避免把 log、伪代码之类的纯文本块染色。
		//   4. 已被 shiki 上色的块（含 span[style] / .tok-）一律跳过，绝不重复覆盖。
		//   5. 流式输出时正文会被 React 反复重写，所以用 MutationObserver + 防抖，
		//      等稳定后再上色；带行号的块是 <span class="line"> 列表，逐行处理保住行号。
		//
		// 着色规则（分类而非白名单）：
		//   * 注释 / 字符串 / 数字          —— 词法识别
		//   * #预处理指令 / @指令 / 关键字   —— 关键词色
		//   * 内置类型 + 大写开头的标识符    —— 类型色（NSString / NSInteger / Circle 一视同仁）
		//   * 后面紧跟 "(" 或 ":" 的标识符   —— 函数色（覆盖 OC 的 foo:bar: 选择器）

		var _started = false;

		// 颜色槽位全部取自 shiki 的 css-variables 主题（dsh 的 --shiki-token-* 变量），
		// 因此主题换色时这里自动跟随，不需要二次映射。
		// 语义分层对齐 Xcode：关键字粉、类型浅蓝、方法/选择器青、变量蓝灰、字符串红、
		// 数字土黄、注释灰。shiki 只有 9 个 token 变量、没有“变量”槽，变量色由
		// 类型色与正文色混合而来（color-mix 在主题里随深浅自动适配）。
		var C = {
			keyword: "var(--shiki-token-keyword)",
			type: "var(--shiki-token-parameter)",
			fn: "var(--shiki-token-function)",
			varName: "color-mix(in oklab, var(--shiki-token-parameter) 60%, var(--shiki-foreground) 40%)",
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

		// banner 里出现这些词才认为是“真语言名”，否则是「代码块」之类的占位标题。
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
					"nonatomic atomic strong weak copy assign retain readonly readwrite nullable nonnull " +
					"unsafe_unretained getter setter direct " +
					"@interface @implementation @end @protocol @property @synthesize @dynamic @selector @class @import " +
					"@autoreleasepool @public @private @protected @optional @required @encode @defs @try @catch @finally @throw " +
					"@synchronized @compatibility_alias @available @end"
			),
			swift: words(
				"associatedtype class deinit enum extension fileprivate func import init inout internal let open " +
					"operator private protocol public rethrows static struct subscript typealias var break case continue " +
					"default defer do else fallthrough for guard if in repeat return switch where while as Any catch is " +
					"self Self super throw throws try actor async await mutating nonmutating override required convenience " +
					"final lazy dynamic weak unowned optional indirect isolated nonisolated some"
			),
		};

		// 内置类型（类型色）。NSString / UIView 这类不列举 —— 靠“大写开头即类型”统一覆盖。
		var TY = {
			dart: words(
				"int double num String bool List Set Map Future Stream Object Never Iterable Duration DateTime RegExp " +
					"Symbol Function void dynamic Widget BuildContext State"
			),
			objc: words(
				"void int char float double long short signed unsigned id SEL Class IMP instancetype BOOL NSInteger " +
					"NSUInteger CGFloat CGRect CGSize CGPoint NSRange NSError dispatch_queue_t"
			),
			swift: words(
				"Int Int8 Int16 Int32 Int64 UInt UInt8 UInt16 UInt32 UInt64 Double Float Bool String Character Array " +
					"Dictionary Set Optional Result Void Never Error"
			),
		};

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

		function span(html, color, kind) {
			// data-k 只用于调试/截图核对（不影响渲染）。
			return '<span class="dsh-hl" data-k="' + kind + '" style="color:' + color + '">' + html + "</span>";
		}

		// 单遍扫描：注释 / 字符串（含 @"..."）/ 预处理 / @指令 / 数字 / 标识符 / 其它。
		var RE =
			/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(@"(?:[^"\\\n]|\\.)*"|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(#[A-Za-z_]\w*)|(@[A-Za-z_]\w*)|(\b\d[\w.]*\b)|([A-Za-z_$][\w$]*)|([\s\S])/g;

		// `@interface Foo` / `@implementation Foo` 后面那个名字是类型，不是方法。
		var DECL = words("@interface @implementation @protocol @class @compatibility_alias");

		function colorizeText(text, lang) {
			var kw = KW[lang] || {};
			var ty = TY[lang] || {};
			var co = CO[lang] || {};
			var out = "";
			var last = 0;
			var m;
			var lastWord = "";
			RE.lastIndex = 0;
			while ((m = RE.exec(text)) !== null) {
				if (m.index > last) out += escapeHtml(text.slice(last, m.index));
				last = RE.lastIndex;
				if (m[1]) {
					out += span(escapeHtml(m[1]), C.comment, "comment");
				} else if (m[2]) {
					out += span(escapeHtml(m[2]), C.string, "string");
				} else if (m[3] || m[4]) {
					out += span(escapeHtml(m[0]), C.keyword, "keyword");
					lastWord = m[0];
				} else if (m[5]) {
					out += span(escapeHtml(m[0]), C.constant, "number");
				} else if (m[6]) {
					var name = m[0];
					// 前后各看一个非空白字符，判断这个名字是什么角色：
					//   `foo(` 调用  `foo:` / `foo]` OC 选择器  `) foo {` 方法定义
					var rest = text.slice(RE.lastIndex);
					var next = rest.charAt(rest.match(/^\s*/)[0].length);
					var prev = "";
					for (var k = m.index - 1; k >= 0; k--) {
						if (!/\s/.test(text.charAt(k))) {
							prev = text.charAt(k);
							break;
						}
					}
					var isMethod = next === "(" || next === ":" || next === "]" || (next === "{" && prev === ")");
					var isDecl = DECL[lastWord] === 1;
					if (co[name]) out += span(escapeHtml(name), C.constant, "constant");
					else if (kw[name]) out += span(escapeHtml(name), C.keyword, "keyword");
					else if (isDecl || ty[name] || /^[A-Z]/.test(name)) out += span(escapeHtml(name), C.type, "type");
					else if (isMethod) out += span(escapeHtml(name), C.fn, "method");
					else out += span(escapeHtml(name), C.varName, "var");
					lastWord = name;
				} else {
					out += escapeHtml(m[0]);
				}
			}
			if (last < text.length) out += escapeHtml(text.slice(last));
			return out;
		}

		// 内容识别：给每个候选语言打分，分高且过阈值才认。
		// 阈值 4：单个 @property 之类的偶然命中（1~2 分）不会误伤纯文本块。
		function detect(text) {
			var score = { objc: 0, dart: 0 };
			if (/(^|\n)[ \t]*@(interface|implementation|property|protocol|end|synthesize|dynamic|class|selector|autoreleasepool|try|catch|throw)\b/.test(text))
				score.objc += 5;
			if (/(^|\n)[ \t]*#import\s*[<"]/.test(text)) score.objc += 3;
			if (/(^|\n)[ \t]*-\s*\(/.test(text)) score.objc += 2;
			if (/\bNS[A-Z]\w*/.test(text)) score.objc += 2;
			if (/\b(nonatomic|strong|weak|copy|assign|readonly|readwrite)\s*[,)]/.test(text)) score.objc += 2;
			if (/\[(super|self)\b|\]\]|\bself\.[A-Za-z_]\w*/.test(text)) score.objc += 1;
			if (/@override\b/.test(text)) score.dart += 3;
			if (/(^|\n)[ \t]*import\s+['"]package:/.test(text)) score.dart += 4;
			if (/\b(Widget|StatelessWidget|StatefulWidget)\b/.test(text)) score.dart += 3;
			if (/\b(Future|Stream|FutureBuilder|setState|BuildContext)\b/.test(text)) score.dart += 1;
			if (score.objc >= 4 && score.objc >= score.dart) return "objc";
			if (score.dart >= 4) return "dart";
			return null;
		}

		function langOf(block) {
			var banner = block.querySelector("[data-code-block-banner]");
			if (!banner) return null;
			var candidates = banner.querySelectorAll("*");
			for (var i = 0; i < candidates.length && i < 6; i++) {
				var t = candidates[i].textContent.trim().toLowerCase();
				if (ALIAS[t]) return ALIAS[t];
				if (t.indexOf("@") === 0) return null;
			}
			return null;
		}

		// 已处理缓存：key 是 <code> 元素，value 是上次上色时的 textContent。
		var handled = new WeakMap();

		function paint(code, lang) {
			var lines = code.querySelectorAll("span.line");
			if (lines.length > 0) {
				// 带行号的块：逐行上色，保住 <span class="line"> 与行号计数器。
				for (var i = 0; i < lines.length; i++) {
					var line = lines[i];
					line.innerHTML = colorizeText(line.textContent, lang);
				}
			} else {
				code.innerHTML = colorizeText(code.textContent, lang);
			}
		}

		function highlightBlock(block) {
			var content = block.querySelector("[data-code-block-content]");
			if (!content) return;
			var code = content.querySelector("code");
			if (!code) return;

			// 已被 shiki 上色（内置语言）就不重复处理。
			if (code.querySelector("span[style], .tok-") != null) return;

			var text = code.textContent;
			if (!text || !text.trim()) return;

			var lang = langOf(block) || detect(text);
			if (!lang) return;

			// 内容没变且我们的 span 还在，跳过；React 若把 innerHTML 重写回纯文本，
			// .dsh-hl 消失 → 即使 textContent 相同也重新上色。
			if (handled.get(code) === text && code.querySelector(".dsh-hl")) return;
			handled.set(code, text);

			paint(code, lang);
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
			}, 400);
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
