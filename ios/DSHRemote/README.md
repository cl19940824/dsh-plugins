# DSH Remote（iOS）

用 iPhone 直接打开电脑上的 dsh：手机和电脑连同一个 Wi-Fi，填一次地址和访问码，
之后每次打开 App 就是全屏的 dsh 网页版，操作和电脑上一致。

## 跑起来

```bash
open ios/DSHRemote/DSHRemote.xcodeproj
```

- 选自己的 Apple ID 团队（Signing & Capabilities → Team），真机需要它来签名。
- 模拟器直接 `⌘R`；真机第一次运行会弹「允许访问本地网络」，要选允许，否则连不上电脑。
- 第一次打开：打开电脑上的「局域网访问」面板，把地址（`http://192.168.x.x:3081`）和访问码
  填进 App，或者直接扫面板上的二维码——两样都会自动带进来。

## 局域网模式怎么工作

电脑端的 `lan_access` 插件在 `3081` 端口上做鉴权代理，访问码既可以写在 URL 里
（`http://192.168.1.8:3081/?lan=AB12CD34`），也会在首次访问后种成 cookie。
App 直接把这条 URL 交给 `WKWebView`：代理种好 cookie、303 跳回首页，之后就是正常的 dsh。

| 文件 | 职责 |
| --- | --- |
| `RootView.swift` | 有配置就加载，没有就显示配对页；连接中 / 失败重试两种状态 |
| `PairingView.swift` | 手填地址 + 访问码，或扫码；解析 `?lan=` 与 `dshremote://pair?...` |
| `QRScannerView.swift` | AVFoundation 扫码 |
| `RemoteWebView.swift` | WKWebView 容器，首屏加载完成/失败回调 |
| `ProfileStore.swift` / `Keychain.swift` | 地址、访问码只进钥匙串 |
| `LoginClient.swift` / `TOTP.swift` | 公网模式（口令 + TOTP）预留，局域网模式不触发 |

## 配对码格式

电脑端「局域网访问」面板里的二维码就是这条网址，App 会自己把 `lan` 参数拆出来：

```
http://192.168.1.8:3081/?lan=AB12CD34
```

也兼容自定义 scheme（公网模式用，可带 TOTP secret）：

```
dshremote://pair?url=http%3A%2F%2F192.168.1.8%3A3081&password=AB12CD34
```

二维码里带着访问码，只在电脑屏幕上显示，不要截图发出去。

## 边界

- 只在内网可用：出门在外用不了，除非以后接公网隧道（设计见
  [docs/lan-access-public-design.md](../../docs/lan-access-public-design.md)）。
- 电脑换网络后 IP 会变，回 App 的设置里改地址即可；访问码不变。
- 明文 HTTP 走局域网，iOS 的 ATS 已用 `NSAllowsArbitraryLoads` + `NSAllowsLocalNetworking`
  放行（只发往本机所在网段，不做公网请求）。

## 验证过什么

- `xcodebuild ... -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build` 通过（Xcode 27.1）。
- 在 iPhone 17 Pro 模拟器上对着一个本地桩服务跑通：`?lan=` → 303 + `Set-Cookie` → 首页正常渲染，
  cookie 生效，页面按 Xcode Dark 色板显示。
