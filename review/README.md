# dsh-review —— 待处理改动审查插件

> **状态标记：v1.0.0 · 加载自 `dsh-mac/plugins/review` · 校验标记 2026-09-25**
> 这条是“改源码 → 官方 app 读取”的验证标记：你在官方 dsh V0.1.7-rc.2 里重开应用后，
> 这个 README 的最新内容能通过 `~/.dsh/profiles/desktop/node_modules/dsh-review`（软链到本目录）
> 被读到，就说明插件包的读取链路通了。要在**界面**里确认 review 生效，请改一个文件后看
> 输入框上方的「待处理改动」气泡，或访问 `/api/review`。

把 dsh 里 agent 的每次 `write` / `edit` / `str_replace_editor` 改动自动汇总成本地差异
账本，让你对着差异块逐个「保留 / 回退」，而不是事后凭记忆反悔。也能把工作区里 git
（VCS）的改动导进来一块审。数据全部持久化到磁盘，重启后接着审。

## 能力

- **自动汇总工具改动**：订阅 `session/event`，利用 dsh 在 `tool/call` 之后、真正执行
  工具之前同步派发事件的时序，抓到每个文件改动前后的内容，算出差异块并入账。
  - `write`（整文件写）、`edit`（字面替换）、`str_replace_editor`（`create` /
    `str_replace` / `insert`）。
  - 改完立刻出现在左侧「Agent 改动」文件列表里。
- **保留 / 回退**：
  - 单个差异块、勾选多个差异块、或整文件，一键「保留」或「回退」。
  - 文件本身按你的决策同步落盘（回退=把该块还原成改动前，保留=维持现状）。
- **撤销 / 重做**：对审查决策（保留/回退）可撤销、可重做。
- **导入 VCS 改动**：一键把工作区相对 HEAD 的 git 改动（含未跟踪新文件）导进来审，
  同样支持保留/回退。
- **三种视图**：单栏（unified）、左右对照（split）、Markdown 预览（可保留/回退）；**视图模式与来源标签会被记住**，下次打开保持上次的选择。
- **全局操作**：面板顶部有「全部保留」「全部回退」，一步作用于所有文件的全部差异；回退之后一次撤销可把全部文件整体撤回去。
- **文件内搜索**、**差异块跳转**（上/下一块）、**可复制的行号引用**（`文件:行号`）。
- **持久化**：账本落在 `<DSH_UI_DATA_DIR>/data/review.json`（外壳注入），重启后续审。

## 安装

跟 `usage` / `lan_access` 一样是“手工装”：

```bash
SRC=./plugins/review
DST="$HOME/.dsh/profiles/web/plugins/review"
mkdir -p "$DST" && cp -R "$SRC/." "$DST/"
```

再往 `$HOME/.dsh/profiles/web/cordis.patch.yml` 追加：

```yaml
- insert:
    - id: dsh-review
      name: ./plugins/review/review.mjs
```

然后 **重启服务**（菜单 →「重启服务」）生效。

当有未处理改动时，**会话顶部（“轨迹”标签上方那一行的右侧）会显示一个审查入口**（带待处理差异块数量）；点它打开审查面板，全部处理完后自动消失。

> 环境变量优先：
> - `DSH_UI_DATA_DIR`：数据根，账本写到它的 `data/review.json`；
> - `DSH_REVIEW_DATA=<路径>`：直接指定账本文件（自测用，优先级最高）。

## 数据模型（engine.mjs）

每个文件 = `baseline`（首次观察到内容 / git 的 HEAD）+ 一串有序 `changes`；每个
`change` 含若干 `hunk`。hunk 的 `status`（`pending`/`kept`/`reverted`）决定它是否“应用
到磁盘”。`current()` 从 baseline 重放所有未回退的 hunk 得到应落盘内容——回退某个块
只是把它从 applied 集合拿掉再重放，天然正确，不需逐行挪位。差异块带一小段上下文，
纯增删也能定位（见 `lib/diff.mjs` 的说明）。

## 布局

```
plugins/review/
  review.mjs          宿主入口（采集 + /api/review.* 路由）
  lib/engine.mjs      审查引擎（账本 / 决策 / 撤销重做 / git 导入 / 持久化）
  lib/diff.mjs        零依赖行级 diff + compose（Myers）
  lib/client.js       Web 客户端（会话顶部“轨迹”附近的审查入口 + 覆盖层 UI）
```

## 自测

- 引擎单元自测：`node lib/test-engine.mjs`（或参考仓库自带的探针脚本做法）。
- 集成：启动隔离的 dsh profile，校验 `/api/review` 带 cookie 200 / 不带 401、
  客户端 bundle 出现在启动图里（见仓库 `tools/probe_*.py` 的思路）。