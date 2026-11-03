import SwiftUI

/// 配对信息既能扫码，也能手动填。二维码内容由电脑端插件生成：
/// `dshremote://pair?url=https%3A%2F%2Fdsh.example.com&password=...&secret=JBSWY3DP...`
struct PairingView: View {
    @EnvironmentObject private var store: ProfileStore
    @Environment(\.dismiss) private var dismiss

    var editing: RemoteProfile?

    @State private var urlText = ""
    @State private var password = ""
    @State private var secret = ""
    @State private var showScanner = false
    @State private var error: String?

    var body: some View {
        Form {
            Section {
                TextField("https://dsh.example.com", text: $urlText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                SecureField("访问口令", text: $password)
                TextField("TOTP secret（可选，Base32）", text: $secret)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            } header: {
                Text("入口")
            } footer: {
                Text("地址就是电脑上「公网访问」里显示的那条。开了动态码的话，App 会在这里自己算 6 位码，不用装验证器。")
            }

            Section {
                Button {
                    showScanner = true
                } label: {
                    Label("扫描配对二维码", systemImage: "qrcode.viewfinder")
                }

                if let profile = editing {
                    Button(role: .destructive) {
                        store.clear()
                        dismiss()
                    } label: {
                        Label("删除这台设备上的配置", systemImage: "trash")
                    }
                }
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
        secret = editing.totpSecret ?? ""
    }

    private func apply(_ text: String) {
        guard let payload = PairingLink.parse(text) else {
            error = "这不是 dsh 的配对码"
            return
        }
        urlText = payload.url
        if !payload.password.isEmpty { password = payload.password }
        if let payloadSecret = payload.secret { secret = payloadSecret }
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
            password: password,
            totpSecret: secret.trimmed.isEmpty ? nil : secret.trimmed
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
            return Payload(url: url, password: items["password"] ?? "", secret: secret)
        }
        if raw.lowercased().hasPrefix("http://") || raw.lowercased().hasPrefix("https://") {
            return Payload(url: raw, password: "", secret: nil)
        }
        return nil
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
