# 1M 上下文开关（context_1m）

dsh 组合包（bundle）：宿主半边（`context-1m.mjs`）+ Web 客户端半边（`lib/client.js`）。
条目 id 和包名都是 `dsh-context-1m`。

在输入框模型选择器左边放一个**勾选框**：「1M」。它作用的对象永远是**当前模型**
（`modelSelection` 投影，切换模型即时跟随）。

| 操作 | 结果 |
| --- | --- |
| 勾上  | 往 llm-pi-ai 配置里**写入**该模型的 `contextWindow: <onTokens>`（默认 1000000 = 1M） |
| 取消  | 写入 `contextWindow: <offTokens>`（逐模型 `models` 表优先，默认 128000）——**不删字段** |

勾选状态 = 当前模型的 `contextWindow` 是否**等于** `onTokens`（按模型各自独立）。
声明了别的值（例如 384000）时显示为未勾选，tooltip 会如实显示当前声明值。

## 为什么「取消」不再删除字段

早先的实现是「取消 = 删除 `contextWindow`」。这有两个坑：

1. **等于没取消。** llm-pi-ai 在字段缺失时用 provider 的 `defaultContextWindow` 兜底，
   而它的默认值是 `1e6`。所以删掉字段后窗口**仍然是 1M**，勾选框对取消操作等于失效。
2. **丢掉诚实值。** 用户手写的 `contextWindow: 384000` 会被一并删除，且无法恢复。

现在取消勾选会**显式写回**一个安全值，语义明确、可预期。

## 为什么这关系到自动压缩

DSH 自带的 `@deepseek-ai/dsh-compaction-basic`（`standard` / `cordis` 两个 preset 都挂载）
按声明值算触发阈值：

```
threshold = floor(min(W × thresholdRatio, W − O − headroomTokens))
```

`W` 就是 `models[].contextWindow`。把 `W` 谎报成 1M，阈值就被顶到 ~800k；如果模型真实
上限是 384K，**压缩永远等不到触发点**，请求会先被上游拒掉（`CONTEXT_WINDOW_EXCEEDED`）。

所以这个勾选框的正确用法是：**只给真正有 1M 窗口的模型勾上**；不是 1M 的模型不要勾，
或者用下面的 `models` 表把取消值设成它的真实窗口。

## 配置

勾选框行为可在 profile 的 `cordis.patch.yml` 里覆盖（本插件条目自身）：

```yaml
- id: dsh-context-1m
  name: dsh-context-1m
  config:
    onTokens: 1000000        # 勾上时写入（默认 1,000,000）
    offTokens: 128000        # 取消且未命中 models 时写回（默认 128,000）
    models:                  # 逐模型的取消写回值，命中时优先于 offTokens
      - provider: gongsi
        model: deepseek-v4.1-flash
        tokens: 384000
```

`models` 是让「取消」恢复诚实值的关键：对真实窗口不是 1M 的模型，在这里登记它的真实值，
勾上再取消就能回到那个值，而不是掉到 128K。

## 怎么工作

**宿主半边**（`context-1m.mjs`）解释：

- 定位 profile：优先 `DSH_PROFILE_DIR` → `DSH_HOME` + `DSH_PROFILE` → 兜底扫描
  `$DSH_HOME/profiles/*` 找装了本插件的目录。
- 读写目标：`<profile>/cordis.patch.yml` 里 llm-pi-ai 条目的
  `config.providers.<provider>.models[].contextWindow`。
- YAML 用 profile 共享 store 里的 `yaml`（`parseDocument`），改目标模型那一段时
  **保留其它注释与排版**；写文件走「临时文件 + rename」。

**网页半边**（`lib/client.js`）是输入框里的勾选框，走两个 /api：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/dsh-context-1m.state?provider=&model=` | `{ok, provider, model, has, checked, declared, onTokens, offTokens}` |
| POST | `/api/dsh-context-1m.set` | `{provider, model, enabled}` → 写 `onTokens` 或 `offTokens` |

`has` 与 `checked` 同义（都为 `declared === onTokens`），保留 `has` 只为兼容旧客户端。
切换模型时勾选框自动回读、状态按模型独立；出错（模型不在 llm-pi-ai 配置里等）会在
勾选框的 tooltip 里显示具体原因。

## 生效时机

patch 文件写入后，长驻 surface（web GUI）会热重载 profile 补丁层。若上下文容量提示
没有**立刻**变化，重开 profile / 重启 dsh 即生效。

## 文件

- `package.json` —— 组合包清单：`dsh.bundle.patch`、`dsh.client`、`peerDependencies`
- `cordis.patch.yml` —— 补丁片段：把宿主半边插进 profile 插件树（`name` 裸包标识符）
- `context-1m.mjs` —— 宿主半边（profile 定位 + patch 编辑 + /api）
- `lib/client.js` —— 网页半边（输入框里的勾选框）
- `locale/zh.json`、`locale/en.json` —— 组合包列表里的标题 / 简介

## 安装

```bash
pnpm add <本仓库路径>/context_1m
```

装完**默认启用**，并出现在 profile `package.json` 的 `dsh.profile.bundles` 数组里。
网页那半边靠 `package.json` 的 `dsh.client` 被 `dsh-client-modules` 自动发现。

**版本要求**：dsh `>=0.2.0-rc.2 <0.3.0`（`package.json` 的 `engines.dsh`）。

**依赖要求（重要）**：DSH 按插件 `package.json` 里声明的 `peerDependencies` 解析它的裸导入。
宿主半边 `import z from '@deepseek-ai/schemastery'`，所以 **`@deepseek-ai/schemastery`
必须列在 `peerDependencies` 里**；漏了会在加载时报
`ERR_MODULE_NOT_FOUND: Cannot find package '@deepseek-ai/schemastery'`，
整条插件行变成 inactive（`plugin_manager list_plugins` 里 `enabled:true` 但 `fiberPhase:null`）。
注意：声明 peer 不需要跑 pnpm 安装，运行时按声明映射到 dsh 自带的副本。

## 环境变量（可选）

| 变量 | 作用 |
| --- | --- |
| `DSH_PROFILE_DIR=<目录>` | 直接指定 profile 目录（含 `cordis.patch.yml`） |
| `DSH_PROFILE=<名字>` | 结合 `DSH_HOME`（默认 `~/.dsh`）算出 profile 目录 |

两者都不设时，插件自动扫描装了它的 profile。自测时设 `DSH_PROFILE_DIR` 指到临时目录即可。

## 边界与已知行为

- 只修改 llm-pi-ai 配置里「已存在的模型条目」；模型不在配置里会报错并保持不变。
- 取消勾选写入 `offTokens` / `models` 表里的值，**不再删字段**；因此它不会回到
  「未声明」状态，也不会触发 provider 的 `defaultContextWindow` 兜底。
- 写回值是配置里显式给出的数字，不记录历史：勾上之前是什么值，插件不记忆。
  想让某个模型取消后回到它的真实窗口，就把它登记进 `models`。
- 任何异常都吞掉 / 通过响应里的 `error` 返回，插件崩了不连带 dsh 起不来。
