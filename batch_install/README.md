# dsh-batch-install

在「设置 → 插件」里补上 dsh 目前缺的两件事：**批量装** 和 **选文件夹**。

- **批量安装标签页**：插件页标题栏上的「Installed / …」一排标签里多一个「批量安装」。
- **添加菜单入口**：「添加」菜单里多一行「从文件夹安装…」，点开就是同一个面板的浮层版本。

两处入口都不需要手输路径 —— 点「选择文件夹…」调 dsh 自带的目录选择器（桌面端就是系统
的文件夹对话框），选完自动扫描，勾选后一次装完，逐条显示成功 / 需重启 / 失败。

## 它怎么工作

```
插件页（lib/client.js）
  ├── 「选择文件夹…」 → ctx.remote.directoryPicker.pick()      ← dsh 自带的目录选择器
  ├── 扫描           → POST /api/plugin-batch.scan             ← 本插件宿主半边
  └── 逐个安装       → ctx.remote.pluginManager.installBundle() ← dsh 官方插件管理器
```

只有「扫描」是本插件自己实现的（宿主半边读目录、读 `package.json` / `manifest.json`）；
**安装完全走 dsh 官方那条通道**：pnpm、profile 清单、`dsh.profile.bundles` 选中、
HMR 重组合都由插件管理器负责，本插件不写 profile 文件、不跑 pnpm、不碰 `cordis.patch.yml`。

### 扫描判据

跟 `dsh-plugin-install` 技能的安装脚本一致：

| 形态 | 判据 | 能不能批量装 |
| --- | --- | --- |
| `bundle` | `package.json` 里有 `dsh.bundle.patch` | ✅ 走 `installBundle` |
| `legacy` | 目录里有 `manifest.json` | ❌ 要复制到 `profile/plugins/` + 追加 cordis insert，界面会标出来 |

选中的目录本身是插件包就直接返回它；否则当成插件根，扫它的一级子目录（跳过
`node_modules` / `.git` / `dist` 等，最多 400 个子目录）。

### 状态怎么标

- **已安装（本目录）**：profile 里已有同名 bundle，且 `source` 就是这个路径 → 不可勾选
- **已安装（其他来源）**：同名 bundle 已装，但指向别的目录 → 也不勾选，避免重复安装被拒
- **旧形态 · 不能批量安装**：只有 `manifest.json` 的插件
- 安装过程中每行显示 `安装中… / 已安装 / 需重启服务 / 失败（原因）`
- 失败原因按插件管理器的错误码翻译：`already-installed`、`not-bundle`、
  `incompatible-version`（会带上不满足的版本要求）、`invalid-spec` 等

## 使用

1. 设置 → 插件 → 标签栏选「批量安装」（或点「添加」→「从文件夹安装…」）。
2. 「选择文件夹…」，比如选中你的插件仓库根目录。
3. 列表里勾选要装的（默认可安装的都勾上），点「安装选中（N）」。
4. 逐条出结果；装完可以点「查看已安装」跳到插件详情页。

## 边界

- 需要 **web profile**（宿主半边的接口挂在 `connection` 的 `/api` 通道上，`connection`
  只有 web profile 提供；headless / tui 里插件照常激活，只是没有扫描接口）。
- 目录选择器需要**本机浏览器 / 桌面端**；远程浏览器场景要装
  `@deepseek-ai/dsh-ui-directory-picker-browse` 那套组合才有可用的选择器。
- 一次安装一个：批量是**串行**的，每个装完都会触发一次 profile 重组合，几十个插件会
  明显耗时；安装在跑的时候按钮会禁用。
- `restart-required` 的那几条要重启服务才生效（替换了启动时加载的模块）。
- 宿主半边读目录用的是 `node:fs`，路径由界面从扫描结果原样回传，不做沙箱校验 ——
  它只读 `package.json` / `manifest.json`，不写任何东西。

## 安装

```bash
python3 ~/.dsh/skills/dsh-plugin-install/scripts/install_plugin.py ./batch_install --profile desktop
```

或者界面里：设置 → 插件 → 添加 → 选择本目录。装完按需重启服务。
