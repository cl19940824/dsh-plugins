# DSH Remote（iOS）

用 iPhone 直接打开家里的 dsh：App 自带登录（口令 + TOTP），登录后把 dsh 的网页版装在
`WKWebView` 里，操作和电脑上一致。

## 跑起来

```bash
open ios/DSHRemote/DSHRemote.xcodeproj
```

- 选自己的 Apple ID 团队（Signing & Capabilities → Team），真机需要它来签名。
- 模拟器直接 `⌘R` 就能看到配对页（已用 Xcode 27.1 / iOS 27.1 模拟器验证可构建、可启动）。
- 第一次打开：填入口地址（电脑上「公网访问」显示的那条）+ 访问口令，或扫电脑上的配对二维码。

## 它做了什么

| 文件 | 职责 |
| --- | --- |
| `RootView.swift` | 有配置就直接连，没有就显示配对页；连接失败可重试 |
| `PairingView.swift` | 手填 / 扫码配对，解析 `dshremote://pair?...` |
| `QRScannerView.swift` | AVFoundation 扫码 |
| `LoginClient.swift` | `POST /api/lan_access.login`，拿会话 cookie |
| `RemoteWebView.swift` | WKWebView，把 cookie 塞进容器后加载 dsh |
| `TOTP.swift` | RFC 6238，30 秒 / 6 位 / SHA1；App 自己算码，不依赖验证器 App |
| `ProfileStore.swift` / `Keychain.swift` | 地址、口令、secret 只进钥匙串 |

## 和服务端的契约（待实现）

```
POST {base}/api/lan_access.login
Content-Type: application/json
{ "password": "访问口令", "code": "123456", "device": "iOS" }

200 → Set-Cookie: __Host-dsh_pub=<签名>; Path=/; HttpOnly; Secure; SameSite=Lax
401 → { "ok": false, "error": "口令或动态码不对" }
```

配对二维码内容（电脑端插件生成）：

```
dshremote://pair?url=https%3A%2F%2Fdsh.example.com&password=...&secret=BASE32SECRET
```

`secret` 可省略（没开动态码时）。二维码里带着口令，所以只在电脑上本地显示，
不要截图发出去。

## 还没做的

- 与服务端 `lan_access` 的「公网模式」联调（登录接口、会话列表、踢人目前都在插件侧，
  App 只消费登录接口）。
- 生物识别解锁、多入口（内网 + 公网各一条）切换。
