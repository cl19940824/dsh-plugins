# Xcode 风格主题（给 dsh-opencode-palette）

两套自定义主题，色值取自 Xcode 默认的深色 / 浅色语法配色：

| 文件 | 名称 | 外观 | 主色 |
| --- | --- | --- | --- |
| `xcode-dark.json` | Xcode Dark | dark | 编辑器 `#1F1F24`，强调蓝 `#0A84FF` |
| `xcode-light.json` | Xcode Light | light | 编辑器 `#FFFFFF`，强调蓝 `#007AFF` |

`xcode-dark.png` / `xcode-light.png` 是聊天界面预览（侧栏 + 标题/正文 + 行内代码 + Swift 代码块 + diff），
按 DSH 真实的变量语义上色：标题 `markdownHeading`、粗体 `markdownStrong`、行内代码 `markdownCode`、
代码块 `--shiki-token-*`、diff `diffAdded/Removed(+Bg)`。

## 安装

插件把**目录里的单文件 JSON 当唯一真值**，所以拷进去即可，不需要重装或重启：

```sh
mkdir -p ~/.dsh/opencode-palette/custom-themes
cp xcode_theme/xcode-*.json ~/.dsh/opencode-palette/custom-themes/
```

然后打开 **设置 → 插件 → OpenCode Palette → 自定义主题**，点 `Xcode Dark` / `Xcode Light`。

## 色值来源

深色（Xcode Default Dark）：背景 `#1F1F24`、正文 `#DFDFE0`、注释 `#7F8C98`、
关键字 `#FC5FA3`、字符串 `#FC6A5D`、数字 `#D0BF69`、类型 `#5DD8FF`、函数 `#41A1C0`、
预处理 `#FD8F3F`、URL `#6699FF`。

浅色（Xcode Default Light）：背景 `#FFFFFF`、正文 `#000000`、注释 `#536579`、
关键字 `#AD3DA4`、字符串 `#C41A16`、数字 `#1C00CF`、类型 `#3900A0`、函数 `#326D74`、
预处理 `#78492A`、URL `#0E0EFF`。

## 粗体为什么不是橙色

`**粗体**` 走 `markdownStrong`。原先取 Xcode 的预处理橙 `#FD8F3F`，但正文里加粗的地方很多，
整段橙色很跳。现改成「只加粗、不加色相」：深色 `#F2F3F7`（比正文 `#DFDFE0` 亮一档）、浅色 `#121214`。
代码块里的预处理色不受影响。

## 行内代码为什么不是红色

DSH 的行内代码（`code`）只有一个颜色槽 `markdownCode`，没有语法区分；原先直接用了 Xcode 的字符串红
`#FC6A5D`，导致正文里每个 `code` 都是红的。现改为青色：深色 `#6FC3DE`、浅色 `#1F6F8B`。
代码块里的字符串仍是 Xcode 红 `#FC6A5D` / `#C41A16`，两者互不影响。

## 两个实现细节

- 自定义主题是**单套 37 色**：插件会把同一套颜色同时注入 dark / light 两个半边，
  `appearance` 只用于面板里的标识与预览底色，不会按系统外观自动切换。
- 选择这个目录而不是改插件内置的 38 套 registry：内置表在 `lib/client.js` 构建产物里，
  插件一升级就没了；自定义目录是插件自己读写主题的地方（面板里的编辑器也写这里），
  升级不受影响。
