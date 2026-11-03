import Foundation

/// 存在钥匙串里的连接配置。访问码不落 UserDefaults。
struct RemoteProfile: Codable, Equatable, Identifiable {
    var id: String = UUID().uuidString
    /// 入口地址，形如 `http://192.168.1.8:3081`。
    var baseURL: String
    /// 局域网访问码（面板上的 `?lan=` 那串）。
    var password: String
    /// 公网模式的 TOTP secret，局域网模式留空。
    var totpSecret: String?

    var url: URL? { URL(string: baseURL) }
    var hostLabel: String { url?.host ?? baseURL }

    /// 真正要加载的地址：访问码拼成 `?lan=`，和电脑上二维码里的链接一致。
    var entryURL: URL? {
        guard var components = URLComponents(string: baseURL) else { return nil }
        if !password.isEmpty {
            var items = components.queryItems ?? []
            items.removeAll { $0.name == "lan" }
            items.append(URLQueryItem(name: "lan", value: password))
            components.queryItems = items
        }
        return components.url
    }
}

@MainActor
final class ProfileStore: ObservableObject {
    @Published private(set) var profile: RemoteProfile?

    private let service = "com.chenglang.dshremote"
    private let account = "profile"

    init() {
        reload()
        #if DEBUG
        seedForUITestIfNeeded()
        #endif
    }

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
    }

    #if DEBUG
    /// 只在 Debug 生效：`-e2e <url> <code>` 直接写入配置，给自动化截图用。
    private func seedForUITestIfNeeded() {
        let args = ProcessInfo.processInfo.arguments
        guard let index = args.firstIndex(of: "-e2e"), index + 2 < args.count else { return }
        save(RemoteProfile(baseURL: args[index + 1], password: args[index + 2], totpSecret: nil))
    }
    #endif
}
