# dsh-font —— 全局字体 / 字号 / 颜色插件

给 dsh 界面加一个全局的自定义外观入口：**界面字体、代码字体、字号缩放、文字颜色、
背景颜色**，实时生效并持久化保存（下次进来自动保持）。

> dsh 自带的「字号大小」设置只影响会话内容；本插件是**全局**生效，连标题、文件列表、
> 左栏右栏、左右对照与 Markdown 视图都一起缩放。

## 能力

- **界面字体**：常见预设（微软雅黑 / 苹方 / 宋体 / Courier New 等）+ 任意自定义字体栈，
  写入 `--dsw-font-family` 并全局应用。
- **代码字体**：预设（Menlo / Monaco / JetBrains Mono / Consolas / Courier New 等）+ 自定义，
  写入 `--ds-font-family-code`（代码块与终端都跟着走）。
- **字号（全局缩放）**：以 14px 为 100%，按比例缩放所有 `--dsw-font-*` 字号/行高 token，
  并同比例缩放 `--dsh-content-font-size` / `--dsh-code-font-size` / `--dsh-terminal-font-size`，
  10–22px 可调。
- **文字颜色**：覆盖 `--dsw-alias-label-primary / secondary / tertiary / caption`。
- **背景颜色**：覆盖 `--dsw-alias-bg-*` 主要层级。
- 可整体**禁用 / 启用**、一键**恢复默认**。
- 设置存 `localStorage`（`dsh-font:settings`），持久化。

## 实现要点（覆盖写在 `body` 上，不是 `:root`）

从 dsh 0.2.1-rc.2 起，设计 token 的落地位置变了：`base.css` 只在 `:root` 上放默认值，
真正的 token 表（`--dsw-font-*`、`--ds-font-family-code`、`--dsw-alias-*` 颜色）全部声明在
`body` / `body[data-ds-dark-theme]` 上。自定义属性是按元素继承的，body 自己声明了同名 token，
写在 `:root` 上的覆盖对 body 及其后代就一律失效 —— 把 `<style>` 挪到 `<head>` 末尾也救不回来，
因为跨元素比的不是级联顺序，而是「谁在这个元素上声明了」。

因此本插件：

- 所有覆盖都落在 `body` 作用域，并统一带 `!important`（对手还包括 boot 脚本写在
  `document.body.style` 上的内联字号变量，以及 `html[data-platform=darwin] body` 这类高特异性规则）；
- 拆成两份 `<style>`：`#dsh-font-style` 放字体/颜色，`#dsh-font-scale` 放缩放出来的字号表。
  缩放那一遍先清空自己上一次的结果再量主题原值，既不会滚雪球，也能量到「带本插件字体覆盖」的
  简写值（`--dsw-font-xs-13: 13px/20px var(--dsw-font-family)` 的 computed value 里 family 已展开固定）。

## 入口

**设置 → 常规** 页面里的「字体 / 字号 / 颜色」一行，点开即弹设置面板。


## 安装（手工装，与 usage / review 一样）

```bash
SRC=./plugins/font
DST="$HOME/.dsh/profiles/web/plugins/font"
mkdir -p "$DST" && cp -R "$SRC/." "$DST/"
```

再往 `$HOME/.dsh/profiles/web/cordis.patch.yml` 追加：

```yaml
- insert:
    - id: dsh-font
      name: ./plugins/font/font.mjs
```

然后**重启服务**生效。

## 布局

```
plugins/font/
  font.mjs       宿主占位（功能全在客户端；让 client-modules 发现包）
  lib/client.js  设置面板 + 全局样式注入
```