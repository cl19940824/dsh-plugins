import SwiftUI

/// 配对信息既能扫码，也能手动填。电脑端的「局域网访问」面板会给出两种码：
/// - 网址：`http://192.168.1.8:3081/?lan=AB12CD34`
/// - 自定义：`dshremote://pair?url=http%3A%2F%2F192.168.1.8%3A3081&password=AB12CD34`
struct PairingView: View {
    @EnvironmentObject private var store: ProfileStore
    @Environment(\.dismiss) private var dismiss

    var editing: RemoteProfile?

    @State private var urlText = ""
    @State private var password = ""
    @State private var showScanner = false
    @State private var error: String?

    var body: some View {
        Form {
            Section {
                TextField("http://192.168.1.8:3081", text: $urlText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                SecureField("访问码", text: $password)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            } header: {
                Text("电脑地址")
            } footer: {
                Text("打开电脑上 dsh 的「局域网访问」面板，照着上面的地址和访问码填；或者直接扫面板上的二维码，两项都会自动带进来。")
            }

            Section {
                Button {
                    showScanner = true
                } label: {
                    Label("扫描面板二维码", systemImage: "qrcode.viewfinder")
                }

                if let profile = editing {
                    Button(role: .destructive) {
                        store.clear()
                        dismiss()
                    } label: {
                        Label("删除这台设备上的配置", systemImage: "trash")
                    }
                }
            } footer: {
                Text("手机和电脑要在同一个 Wi-Fi。换了网络、电脑的 IP 变了，回这里改地址就行。")
            }

            if let error {
                Section { Text(error).foregroundStyle(.red) }
            }
        }
        .navigationTitle(editing == nil ? "连接 dsh" : "设置")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("保存") { save() }
                    .disabled(urlText.trimmed.isEmpty || password.isEmpty)
            }
            if editing != nil {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
        }
        .onAppear(perform: prefill)
        .sheet(isPresented: $showScanner) {
            QRScannerView { text in
                apply(text)
            }
            .ignoresSafeArea()
        }
    }

    private func prefill() {
        guard let editing else { return }
        urlText = editing.baseURL
        password = editing.password
    }

    private func apply(_ text: String) {
        guard let payload = PairingLink.parse(text) else {
            error = "这不是 dsh 的配对码"
            return
        }
        urlText = payload.url
        if !payload.password.isEmpty { password = payload.password }
        error = nil
    }

    private func save() {
        var value = urlText.trimmed
        while value.hasSuffix("/") { value.removeLast() }
        guard URL(string: value) != nil else {
            error = "地址格式不对"
            return
        }
        let profile = RemoteProfile(
            id: editing?.id ?? UUID().uuidString,
            baseURL: value,
            password: password.trimmed,
            totpSecret: editing?.totpSecret
        )
        store.save(profile)
        dismiss()
    }
}

enum PairingLink {
    struct Payload {
        var url: String
        var password: String
        var secret: String?
    }

    static func parse(_ text: String) -> Payload? {
        let raw = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.lowercased().hasPrefix("dshremote://") {
            guard let components = URLComponents(string: raw) else { return nil }
            var items: [String: String] = [:]
            for item in components.queryItems ?? [] {
                items[item.name] = item.value ?? ""
            }
            guard let url = items["url"], !url.isEmpty else { return nil }
            let secret = items["secret"].flatMap { $0.isEmpty ? nil : $0 }
            let code = items["password"] ?? items["code"] ?? ""
            return Payload(url: url, password: code, secret: secret)
        }
        if raw.lowercased().hasPrefix("http://") || raw.lowercased().hasPrefix("https://") {
            guard var components = URLComponents(string: raw) else { return nil }
            var code = ""
            if let items = components.queryItems {
                code = items.first { $0.name == "lan" }?.value ?? ""
                components.queryItems = items.filter { $0.name != "lan" }
            }
            guard let cleaned = components.string, !cleaned.isEmpty else { return nil }
            return Payload(url: cleaned, password: code, secret: nil)
        }
        return nil
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
