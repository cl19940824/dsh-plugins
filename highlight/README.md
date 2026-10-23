# dsh-highlight —— 代码高亮补充

dsh 前端内置的语法高亮（shiki）没覆盖 **dart、objective-c / oc / objc** 等语言，这些代码块
会以**纯文本**渲染。本插件在浏览器端给这类缺失语言补齐关键词高亮，配色走与 shiki 一致的
`--shiki-token-*` 主题变量，让答案里的代码块也能正确识别这些常用语言（swift 也作兜底）。

纯浏览器半边插件，不改后端。

## 功能

- **补语言**：给 `dart`、`objective-c` / `oc` / `objc`（以及 `swift` 兜底）的代码块上色。
- **主题一致**：颜色全部取自 shiki 的 css-variables 主题（`var(--shiki-token-*)`），
  深浅主题、亮色/暗色下都不会跑偏成奇怪配色。
- **只补不重**：已被 shiki 上过色的块（含 `span[style]` / `.tok-*`）直接跳过，绝不重复覆盖。

## 使用

装上重启服务即可，**无需配置**。对话里出现上述语言的代码块，会自动多出正确的语法高亮。

## 工作原理（要点）

- **定位**：前端代码块不是 `<code class="language-xxx">`（类名是 hash 过的），而是
  `.md-code-block` 容器——语言显示在 `[data-code-block-banner]` 的第一个子节点
  （infostring），正文在 `[data-code-block-content]` 里的 `<code>`。代码按语言 infostring
  命中目标。
- **应对流式渲染**：正文会被 React 反复重写，直接改 `innerHTML` 会把内容冻在第一帧。
  所以用 `MutationObserver`（含 `characterData`）+ 防抖，等正文稳定后再上色。
- **保行号**：带行号的块正文是 `<span class="line">` 列表，逐行上色以保住行号。
- **着色规则（分类而非白名单）**：
  - 注释 / 字符串 / 数字 → 词法识别；
  - `#` 预处理指令 / `@` 指令 / 关键字 → 关键词色；
  - 内置类型 + 大写开头的标识符 → 类型色（`NSString` / `NSInteger` / `Circle`…一视同仁；
    这样 `NSString` 和 `NSInteger` 不会再一个有颜色一个没有）；
  - 后面紧跟 `(` 的标识符 → 函数色。

## 数据 / 依赖

- 无持久化、无 API；纯浏览器端用 MutationObserver + 词法高亮。

## 安装（标准 npm bundle）

```bash
python3 ~/.dsh/skills/dsh-plugin-install/scripts/install_plugin.py ./highlight
# 或：dsh plugin --profile web add <highlight 目录>
```

装完**菜单 → 重启服务**生效。

## 已知边界

- 是**启发式词法**高亮，不是完整解析器：极端嵌套 / 宏展开等复杂代码可能不完美，
  但对日常 `dart` / `oc` / `swift` 代码块足够好。
- 只处理 dsh 前端渲染出来的标准 `.md-code-block`；内嵌 iframe / 自定义渲染器的代码块不在范围。