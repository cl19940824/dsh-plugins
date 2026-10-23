# dsh-plugins

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（下称 dsh）的第三方插件集，
共 **11 个插件**。每个插件都是一份「宿主半边 + Web 客户端半边」的完整包：宿主半边在 Node 里采集数据、
挂路由、改 profile 配置；客户端半边挂进启动图，往 Web 界面注入入口、面板或勾选框。

> 本仓库是社区插件集，与 DeepSeek 官方无关。插件通过 dsh 公开的 bundle / client-modules
> 机制接入，不修改 dsh 本体源码。

## 插件一览

| 目录 | 包名 | 干什么 | 形态 | 界面入口 |
| --- | --- | --- | --- | --- |
| `usage/` | `dsh-usage` | 采集模型返回的 usage，按「天 × 模型」统计总 token，堆叠柱状图看各模型用量与占比 | legacy | 左下角（设置按钮上方） |
| `lan_access/` | `dsh-lan-access` | 带鉴权的反向代理 + 二维码接口，手机扫码在局域网里打开同一套界面（**默认关闭**） | legacy | 侧边栏 |
| `review/` | `dsh-review` | 把 agent 每次 write / edit 的改动汇总成差异账本，逐块「保留 / 回退」，也能导入工作区 git 改动 | legacy | 侧边栏 |
| `font/` | `dsh-font` | 全局界面字体 / 代码字体 / 字号缩放 / 文字色 / 背景色 | legacy | 设置 → 常规 |
| `highlight/` | `dsh-highlight` | 给 shiki 未覆盖的语言（dart / objective-c / oc 等）代码块补关键词高亮 | legacy | 无 UI |
| `multimodal/` | `dsh-multimodal` | 给自定义模型逐个开关「是否支持图片输入」（写 llm-pi-ai 的 `input` 模态） | legacy | 设置 → 模型 |
| `chat_autoscroll/` | `dsh-chat-autoscroll` | 对话页流式输出智能吸底：停在底部自动跟随、往上翻则暂停 | legacy | 无 UI |
| `context_1m/` | `dsh-context-1m` | 输入框模型选择器左边的「1M」勾选框：为**当前模型**写入 / 写回 `contextWindow` | bundle | 输入框 |
| `thinking_strength/` | `dsh-thinking-strength` | 输入框模型选择器左边的「思考」勾选框：为**当前模型**补全 / 删除 `reasoningEfforts` 档位 | bundle | 输入框 |
| `image_reader/` | `dsh-image-reader` | 给纯文本模型一双「借来的眼睛」：当前模型不支持图片输入时注入 `read_image_details` 工具，把「图片 + 问题」转发给指定的多模态模型，再把答案原样带回 | bundle | 设置 → 图像解读 |
| `batch_install/` | `dsh-batch-install` | 插件安装体验补丁：**选文件夹**（走 dsh 自带的目录选择器，不用手输路径）+ **批量安装**（扫出文件夹里的插件，勾选后一次装完，逐条报成功 / 需重启 / 失败） | bundle | 设置 → 插件（「批量安装」标签 + 添加菜单） |

## 两种插件形态

仓库里同时存在两代插件写法，安装器会按目录内容自动识别，不需要你手动区分。

### 1. `bundle` 形态（推荐，新）

判据：`package.json` 里有 `dsh.bundle.patch`。

- 是一份标准的 npm 包，`package.json` 声明 `dsh.bundle.patch`（宿主半边补丁）、
  `dsh.client.platform = "web"`（浏览器半边）、`engines.dsh` 与 `peerDependencies`。
- 宿主半边由 `cordis.patch.yml` 以**裸包标识符**插入 profile 插件树，因此会进入 dsh 的
  peer 兼容检查。
- 浏览器半边不用写补丁：dsh 的 client-modules 从入口往上找最近的 `package.json`，
  读到 `dsh.client.platform === "web"` 就按 `exports["./client"]` 自动挂进启动图。
- 采用：`context_1m/`、`thinking_strength/`、`image_reader/`、`batch_install/`

### 2. `legacy` 形态

判据：目录里有 `manifest.json`。

- 插件元信息写在 `manifest.json`（`id` / `name` / `entry` / `patch` / `requiresRestart`）。
- 安装 = 整目录复制到 profile 的 `plugins/<id>/`，再往 profile 的 `cordis.patch.yml`
  追加一段带 `id` 的 `insert` 条目。
- 采用：`usage/`、`lan_access/`、`review/`、`font/`、`highlight/`、`multimodal/`、`chat_autoscroll/`

## 安装

### 整套安装（推荐）

```bash
git clone https://github.com/cl19940824/dsh-plugins.git
python3 ~/.dsh/skills/dsh-plugin-install/scripts/install_plugin.py ./dsh-plugins
```

安装器支持传入**单个插件目录**或**整个仓库根**（自动识别每个子目录的形态），装完按提示
**菜单 → 重启服务**才生效。

### 只装某一个 bundle 插件

```bash
# 直接作为 npm 依赖挂进 profile
pnpm add <本仓库路径>/context_1m

# 或走 CLI 的 link: 协议
dsh plugin add link:<本仓库路径>/context_1m
```

装完默认启用，并出现在 profile `package.json` 的 `dsh.profile.bundles` 数组里。

> **bundle 插件首次添加后必须重启一次**。dsh 的 profile-resolution-bootstrap 在开机时
> 把每个 `link:` 依赖的**解析路由**固化成内存表，运行中新增的链接目录在宿主进程里解析不到
> 宿主安装树，会以 `MODULE_NOT_FOUND` → `failed to import` 收场。
> 验证方式：设置 → 插件里看条目是否 `active`。

## 目录约定

每个插件目录都是一份完整、自包含的插件包：

| 文件 | 作用 |
| --- | --- |
| `package.json` | 包清单：`dsh.bundle.patch`、`dsh.client`、`exports["./client"]`、`peerDependencies` |
| `manifest.json` | legacy 形态的元信息：`id` / `name` / `entry` 等 |
| `<entry>.mjs` | 宿主半边（在 Node 里跑：采集、路由、持久化、改配置） |
| `lib/client.js` | 浏览器半边（挂进启动图，渲染界面） |
| `cordis.patch.yml` | 插件自带的插入片段 |
| `locale/*.json` | bundle 列表里显示的标题 / 简介（部分插件有） |
| `README.md` | 插件自己的说明（实现细节、边界、已知行为） |

## 开发须知

### `@deepseek-ai/*` 必须声明在 `peerDependencies` 里

宿主半边里 `import z from '@deepseek-ai/schemastery'` 这类裸说明符，由 dsh 的
profile-resolution-bootstrap 路由到宿主安装树。**但每个被 import 的包名都必须出现在本插件
`package.json` 的 `peerDependencies` 中**——解析器对 linked 目录里的裸包请求，只有祖先
`package.json` 在 `peerDependencies` 里列了这个名字才会拦到宿主条目，否则走 native 解析，
以 `ERR_MODULE_NOT_FOUND` 失败，整条插件行变成 inactive
（`plugin_manager list_plugins` 里 `enabled: true` 但 `fiberPhase: null`）。

声明 peer **不需要**跑 `pnpm install`，运行时按声明映射到 dsh 自带的副本。

### 宿主半边改动要重启

linked 插件目录不在 dsh-hmr 的 watch root 里（watch root 是 profile 目录，且忽略
`**/node_modules`），宿主 Node 的 ESM 模块缓存会一直持着旧代码，`set_plugin` 反复开关
只会反复执行旧模块的 apply。**重启是唯一可靠的加载方式**；客户端半边改动则会被
client-modules 轮询到并热替换，不用重启（保险起见再刷一次页面）。

### 新增一个插件

1. 新建 `<插件名>/` 目录，按上表补齐文件。
2. 在本 README 的「插件一览」表里加一行。
3. 用安装器装一遍验证：`python3 ~/.dsh/skills/dsh-plugin-install/scripts/install_plugin.py ./<插件名>`

安装脚本是按目录自动发现的（判据：`package.json` 的 `dsh.bundle.patch`，或 `manifest.json`），
不需要改动脚本本身。

## 版本要求

| 形态 | 要求 |
| --- | --- |
| `bundle` | dsh `>=0.2.0-rc.2 <0.3.0`（以各插件 `package.json` 的 `engines.dsh` 为准） |
| `legacy` | 未声明版本约束，面向随桌面版分发的形态设计 |

## 数据落盘

legacy 插件的数据落在桌面版注入的 `DSH_UI_DATA_DIR`
（macOS：`~/Library/Application Support/DeepSeekHarness/data/`，Windows：`%LOCALAPPDATA%\DeepSeekHarness\data\`）
下，跟 `config.json` 同处，不写进插件目录——`font/` 例外，它没有宿主侧状态，设置存在浏览器
`localStorage`。bundle 插件各自读写 dsh 自身的配置或数据目录，详见各插件 README。

## 许可

[MIT](./LICENSE)
