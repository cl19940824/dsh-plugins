import Foundation

/// 存在钥匙串里的连接配置。口令和 TOTP secret 都不落 UserDefaults。
struct RemoteProfile: Codable, Equatable, Identifiable {
    var id: String = UUID().uuidString
    /// 入口地址，形如 `https://dsh.example.com` 或 `http://192.168.1.8:3081`。
    var baseURL: String
    /// 访问口令（公网模式下是登录密码）。
    var password: String
    /// Base32 的 TOTP secret；为空表示这个入口没开动态码。
    var totpSecret: String?

    var url: URL? { URL(string: baseURL) }
    var hostLabel: String { url?.host ?? baseURL }
}

@MainActor
final class ProfileStore: ObservableObject {
    @Published private(set) var profile: RemoteProfile?

    private let service = "com.chenglang.dshremote"
    private let account = "profile"

    init() { reload() }

    func reload() {
        guard let data = Keychain.load(service: service, account: account) else {
            profile = nil
            return
        }
        profile = try? JSONDecoder().decode(RemoteProfile.self, from: data)
    }

    func save(_ next: RemoteProfile) {
        if let data = try? JSONEncoder().encode(next) {
            Keychain.save(data, service: service, account: account)
        }
        profile = next
    }

    func clear() {
        Keychain.delete(service: service, account: account)
        profile = nil
        // 顺手把网页 cookie 也清掉，避免退出后再打开还是已登录状态。
        URLCache.shared.removeAllCachedResponses()
    }
}
