# dsh-font —— 全局字体 / 字号 / 颜色插件

给 dsh 界面加一个全局的自定义外观入口：**界面字体、代码字体、字号缩放、文字颜色、
背景颜色**，实时生效并持久化保存（下次进来自动保持）。

> dsh 自带的「字号大小」设置只影响会话内容；本插件是**全局**生效，连标题、文件列表、
> 左栏右栏、左右对照与 Markdown 视图都一起缩放。

## 能力

- **界面字体**：常见预设（微软雅黑 / 苹方 / 宋体 / serif 等）+ 任意自定义字体栈，
  写入 `--dsw-font-family` 并全局应用。
- **代码字体**：预设（Menlo / Monaco / JetBrains Mono / Consolas 等）+ 自定义，
  写入 `--ds-font-family-code`。
- **字号（全局缩放）**：按比例缩放所有 `--dsw-font-*` 字号/行高 token 与
  `--dsh-content-font-size`，10–22px 可调，整体放大或缩小。
- **文字颜色**：覆盖 `--dsw-alias-label-primary / secondary / tertiary / caption`。
- **背景颜色**：覆盖 `--dsw-alias-bg-*` 主要层级。
- 可整体**禁用 / 启用**、一键**恢复默认**。
- 设置存 `localStorage`（`dsh-font:settings`），持久化。

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