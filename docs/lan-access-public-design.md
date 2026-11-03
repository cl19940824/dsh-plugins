# 公网访问 dsh：设计思路

> 现状：`dsh-lan-access` 在 `0.0.0.0:3081` 起一个带访问码的反向代理，转发到
> `127.0.0.1:3080`。默认只放行内网/回环来源（`isPrivateAddress`），链接形如
> `http://<内网IP>:3081/?lan=<访问码>`。
>
> 目标：手机/电脑在**任何网络**下都能打开，且不把「本机任意命令执行」裸露给互联网。

## 一、先说结论

**不要做端口映射。** 家用宽带大多是 CGNAT，拿不到公网 IP；就算拿到了，把 3080/3081
直接暴露出去等于把一台能跑任意命令的机器挂在互联网上，仅靠一个固定访问码扛不住扫描。

推荐顺序（从省事到可控）：

| 方案 | 需要什么 | 成本 | 公网入口 | 鉴权 | 适合 |
| --- | --- | --- | --- | --- | --- |
| **A. Tailscale Funnel** | 装 Tailscale，登录 | 免费 | `https://<机器>.<tailnet>.ts.net` | 插件自己的登录（TOTP） | 先跑通、个人用 |
| **B. Cloudflare Tunnel + Access** | 一个托管在 CF 的域名 | 免费 | `https://dsh.example.com` | CF Access（邮箱 OTP / Google / GitHub） | 要自己的域名、要 SSO |
| **C. VPS + frp + Caddy** | 一台国内/境外 VPS + 域名 | ¥30–60/月 | `https://dsh.example.com` | 插件 TOTP | 国内网络要稳、要完全可控 |

三者对插件的改法是一样的：**隧道客户端跑在本机，回源到 `127.0.0.1:3081`**。
所以插件只需要做两件事：把监听地址从 `0.0.0.0` 换成 `127.0.0.1`，以及把「内网访问码」
升级成「真正的登录」。

## 二、为什么改动能很小

`lib/proxy.mjs` 已经解决了公网访问最容易踩的坑：

- 转发时把 `Host` 改写成 `127.0.0.1:<port>`、`Origin`/`Referer` 跟着改 —— dsh 的
  browser-trust fence 只认回环 authority，隧道域名是什么都不影响；
- 用进程 launch token 自己去回环换 `dsh-auth-*` cookie 并代持，浏览器全程不接触；
- 转发 WebSocket Upgrade（`/api/remote.mux`），对话流不受影响；
- 剥掉上游 `Set-Cookie`，不让 dsh 的会话 cookie 漏给外部 origin。

也就是说「能不能通」不是问题，**问题只剩「谁能进」**。

## 三、目标架构

```
手机/外部浏览器
      │ https
      ▼
┌─────────────────────┐
│ 隧道边缘             │  Tailscale Funnel / Cloudflare Edge / VPS(Caddy+frps)
│ TLS 终止 + 身份（可选）│
└─────────┬───────────┘
          │ 隧道（出站连接，无需公网 IP、无需端口映射）
          ▼
┌─────────────────────┐
│ 本机 127.0.0.1:3081  │  lan_access 反代（登录页 + 会话 + 限流 + 审计）
└─────────┬───────────┘
          │ 回环，Host 已改写
          ▼
   dsh 127.0.0.1:3080
```

## 四、插件侧改动

### P0：公网模式（半天）

1. 状态文件加两个字段：`mode: 'lan' | 'public'`、`publicUrl`（隧道分配到的地址，仅展示）。
2. `mode === 'public'` 时 `BIND` 固定 `127.0.0.1` —— 隧道客户端就在本机，不需要对局域网开端口。
3. 面板加一段「公网访问」：说明 + 当前模式 + 隧道地址（手动填或从命令输出粘贴）+ 复制按钮。
4. 默认仍只放行内网来源；公网模式下**关闭 `?lan=` 长期链接**（见 P1），只留登录页。

> 注意：隧道回源时 `remoteAddress` 是 `127.0.0.1`，所以默认的网段检查天然通过，
> 不需要 `DSH_LAN_ACCESS_ALLOW_PUBLIC=1` 这把「关掉检查」的钥匙——少一个误配点。

### P1：登录与限流（1–2 天，公网模式的必需品）

固定访问码适合「同一个 WiFi 的几个人」，不适合公网：链接会进聊天记录、截图、Referer。
公网模式改成账号密码式的登录：

- **TOTP（推荐）**：启用时生成 20 字节 secret，面板显示 `otpauth://` 二维码，
  手机验证器扫码；登录页输 6 位码。实现 ~120 行（HMAC-SHA1 + Base32），不引依赖。
- **会话**：验证通过发 `__Host-dsh-pub` cookie（HMAC 签名，`HttpOnly; Secure; SameSite=Lax`，
  30 天滑动过期）；面板可「退出所有设备」。
- **限流**：同一 IP 5 分钟内错 5 次 → 锁 15 分钟；全局每分钟 ≤ 30 次尝试；失败也写审计。
- **审计**：`<数据根>/data/lan_access-audit.jsonl` 记录时间/IP/UA/结果，面板显示最近 20 条。
- 兜底：连续失败或异常时自动 `stop()` 代理（熔断），面板橙点提示。

### P2：更细的控制（可选）

- Cloudflare Access：校验 `Cf-Access-Jwt-Assertion`（JWKS 缓存 + `aud` 比对），
  隧道边缘已经挡了一层，这里是纵深防御。
- 设备白名单（首次登录需在面板点「允许」）、登录推送通知、按路径限制（只读模式）。

## 五、三条落地路径

### A. Tailscale Funnel（最快，推荐先用这个验证）

```bash
brew install tailscale            # 或 App Store 版
tailscale up
tailscale funnel --bg 3081        # 分配 https://<机器>.<tailnet>.ts.net
tailscale funnel status
```

- 出站连接，CGNAT 也能用；自带 TLS；Funnel 支持 WebSocket。
- 免费额度够个人用；缺点是域名是 `*.ts.net`，且 Funnel 对公网开放（所以要 P1 的登录）。
- 只想给自己的设备用、不要公网：用 `tailscale serve 3081`，只有 tailnet 内能访问，最安全。

### B. Cloudflare Tunnel + Access（要自己的域名）

```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create dsh
cloudflared tunnel route dns dsh dsh.example.com
cloudflared tunnel run --url http://127.0.0.1:3081 dsh
```

- CF 控制台给 `dsh.example.com` 加 Access 策略（邮箱 OTP / Google），未登录直接被边缘拦掉，
  请求根本到不了本机。
- 免费版 Access 支持 50 个用户；国内访问速度一般，但稳定。
- 不需要在路由器上开任何端口。

### C. VPS + frp + Caddy（国内最稳）

```ini
# frpc.toml（本机）
serverAddr = "1.2.3.4"
serverPort = 7000
auth.token = "***"
[[proxies]]
name = "dsh"
type = "tcp"
localIP = "127.0.0.1"
localPort = 3081
remotePort = 6081
```

VPS 上 Caddy 反代 `127.0.0.1:6081` 并自动签 TLS；Caddy 前面可再加一层 Basic Auth 或
`mTLS`。域名解析到 VPS（大陆机器需备案；用非 80/443 端口 + IP 可绕开域名备案，但体验差）。
成本是 VPS 月租，好处是完全自主、可加 WAF、可限速。

## 六、安全清单（上线前逐条过）

- [ ] 公网模式只听 `127.0.0.1`，不对局域网开 3081
- [ ] 强制 HTTPS（隧道/边缘负责），cookie 带 `Secure` + `__Host-` 前缀
- [ ] 关掉 `?lan=` 长期链接，登录用 TOTP/SSO
- [ ] 登录限流 + 失败审计 + 熔断
- [ ] 响应头：`Referrer-Policy: no-referrer`、`X-Content-Type-Options: nosniff`、`Cache-Control: no-store`（登录页）
- [ ] 面板一键「断开公网」（停代理 + 吊销会话）
- [ ] 定期轮换 TOTP secret / 会话密钥
- [ ] 明确风险：dsh 能执行任意命令，公网入口等同远程 shell；不要把入口发到公开群

## 七、工作量估计

| 阶段 | 内容 | 预估 |
| --- | --- | --- |
| P0 | 公网模式开关 + 绑定回环 + 面板展示 | 0.5 天 |
| P1 | TOTP 登录 + 会话 + 限流 + 审计 | 1–2 天 |
| P2 | CF Access 校验 / 设备白名单 / 通知 | 1 天 |
| 文档 | 三条路径的配置步骤与排错 | 0.5 天 |

先做 P0 + Tailscale Funnel，当天就能在外网打开；确认体验后补 P1，再考虑换自有域名。

## 八、补充：不想装任何 App 的路径（实测）

本机网络情况（2026-11-03 实测）：无公网 IPv6（只有 `fe80::` 链路本地），出口是
`183.6.180.189`（广州电信，背后 10.10.80.1 企业 NAT），出站 22 被掐、443 正常。
所以「IPv6 直连 + 路由器放行端口」这条路在当前网络走不通，只能靠隧道。

**零安装、零账号（系统自带 ssh 就够）**：

```bash
ssh -p 443 -R0:127.0.0.1:3081 a.pinggy.io
# 输出类似：
# https://awnox-183-6-180-189.free.pinggy.net
# https://yskku-183-6-180-189.run.pinggy-free.link
```

- 走 443，公司网络也通；自带 HTTPS 证书；支持 WebSocket。
- **限制**：免费隧道 **60 分钟到期**，每次重连 URL 都变；只适合「临时从外面看一眼」。
- `localhost.run`、`serveo.net` 在本机网络下连不上（443 被关、22 超时），不用试。

**要固定入口、又不装 App**，只剩两条：

1. `cloudflared` 单文件（不是 App，是个命令行程序）：`cloudflared tunnel --url http://127.0.0.1:3081`
   → `https://xxx.trycloudflare.com`，进程活着 URL 就不变（重启才变）。本机直连 GitHub
   下载超时，需换镜像或代理获取二进制。
2. 自有 VPS + `ssh -R` 或 frp：URL/端口完全自己定，长期稳定，成本是一台 VPS。

### 插件怎么接（「公网访问」模式）

- 面板加第三个状态：`内网 / 公网(临时) / 公网(固定)`。
- 公网模式启动时 `spawn` 隧道进程（pinggy 或 cloudflared，二选一，路径可配），
  从 stdout 抓 `https://…` 写进状态文件并画二维码；进程退出或到期前 5 分钟自动重启，
  面板上显示「已连接 12 分钟 / 剩余 48 分钟」。
- 断线重连后 URL 变了：本地状态文件保留最近一条，回到局域网打开面板就能看到新的。
- 鉴权：公网模式强制开 TOTP（或一次性口令），并把 `?lan=` 长期链接关掉；
  限流 + 熔断沿用第六节。

## 九、常驻入口 + 会话管理 + iOS App

### 为什么免费隧道是临时的

pinggy / localhost.run / serveo 用的是它们自己的服务器和带宽，免费档必然限量：pinggy
免费隧道 **60 分钟**到期、地址每次重连都换；这是商业模式，不是配置问题。**地址要一直存在，
就必须有一个属于你的端点**——要么是你的域名（Cloudflare Tunnel 把域名指过来），
要么是你的服务器 IP（VPS + 反向隧道）。没有第三种免费办法。

| 方式 | 常驻 | 成本 | 需要装东西 |
| --- | --- | --- | --- |
| 域名 + Cloudflare Tunnel | ✅ 固定 `https://dsh.你的域名` | 域名 ~¥60/年，隧道免费 | 一个 `cloudflared` 程序（非 App） |
| VPS + SSH 反向隧道 | ✅ 固定 IP / 域名 | VPS ¥30–60/月（Oracle 有免费档） | 不用装，系统 ssh 就够 |
| pinggy 等免费隧道 | ❌ 60 分钟 | 免费 | 不用装 |

### 访问口令、在线会话、踢人

公网模式下插件自己维护一张会话表（内存 + 状态文件），不再用「链接里带码」：

- **登录**：`POST /api/lan_access.login {password, code}`，密码 scrypt 哈希存储，
  `code` 是 TOTP（RFC 6238，30s/6 位/SHA1，secret 只在首次启用时生成并显示二维码）。
- **会话**：登录成功发 `__Host-dsh_pub=<hmac>` cookie（`HttpOnly; Secure; SameSite=Lax`），
  服务端记 `{id, ip, ua, device, createdAt, lastSeen, revoked}`。
- **监控**：面板列出在线会话（IP 归属、设备、最近活跃、登录时长），5 秒轮询。
- **踢人**：`POST /api/lan_access.revoke {id}` → 从表里删掉 + 把该会话的 WebSocket
  连接按 id 找到并 `socket.destroy()`，下一次 HTTP 请求直接 401。带 `?all=1` 一键全踢。
- **风控**：同 IP 5 分钟错 5 次锁 15 分钟；连续失败熔断停代理；全部写审计 JSONL。

### iOS App

工程在 [`ios/DSHRemote`](../ios/DSHRemote/README.md)。做法是「原生外壳 + WKWebView」：

- 配对：扫码或手填地址/口令/TOTP secret，全部进钥匙串；
- 登录：App 直接打 `POST /api/lan_access.login`（自己算 TOTP 码），把返回的 cookie
  塞进 `WKWebsiteDataStore`，再加载 dsh 页面——不经过网页登录表单，也不依赖验证器 App；
- 之后就是一个全屏的 dsh，旋转、手势、文件下载都走系统 WebView。

已验证：Xcode 27.1 构建通过、iPhone 17 Pro 模拟器启动并渲染出配对页。
