import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: ProfileStore

    var body: some View {
        NavigationStack {
            if let profile = store.profile {
                RemoteScreen(profile: profile)
            } else {
                PairingView()
            }
        }
    }
}

struct RemoteScreen: View {
    @EnvironmentObject private var store: ProfileStore
    let profile: RemoteProfile

    @StateObject private var model = WebModel()
    @State private var phase: Phase = .connecting
    @State private var message = ""
    @State private var showSettings = false

    enum Phase { case connecting, ready, failed }

    var body: some View {
        ZStack(alignment: .top) {
            RemoteWebView(webView: model.webView)
                .ignoresSafeArea(edges: .bottom)

            if phase == .connecting {
                overlay(message: "正在连接 \(profile.hostLabel) …", retry: false)
            }
            if phase == .failed {
                overlay(message: message, retry: true)
            }
            if model.isLoading && phase == .ready {
                ProgressView()
                    .controlSize(.small)
                    .padding(6)
                    .background(.regularMaterial, in: Capsule())
                    .padding(.top, 6)
            }
        }
        .navigationTitle(profile.hostLabel)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    model.reload()
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showSettings = true
                } label: {
                    Image(systemName: "gearshape")
                }
            }
        }
        .sheet(isPresented: $showSettings) {
            NavigationStack { PairingView(editing: profile) }
        }
        .task(id: profile.id) { connect() }
        .onChange(of: store.profile) { _, next in
            guard next != nil else { return }
            connect()
        }
        .onChange(of: model.didLoad) { _, finished in
            if finished { phase = .ready }
        }
        .onChange(of: model.lastError) { _, failure in
            guard let failure else { return }
            phase = .failed
            message = Self.friendly(failure, host: profile.hostLabel)
        }
    }

    /// 局域网模式下不需要登录接口：`?lan=<访问码>` 会让插件种好 cookie 再跳首页。
    private func connect() {
        phase = .connecting
        message = ""
        model.didLoad = false
        guard let url = profile.entryURL else {
            phase = .failed
            message = "地址格式不对，应该是 http://192.168.x.x:3081 这样。"
            return
        }
        Task { await model.load(url: url, cookies: []) }
    }

    private static func friendly(_ raw: String, host: String) -> String {
        let lower = raw.lowercased()
        if lower.contains("could not connect") || lower.contains("connection") || lower.contains("timed out") {
            return "连不上 \(host)。确认手机和电脑在同一个 Wi-Fi，电脑上的「局域网访问」是开着的，地址和访问码与面板一致。"
        }
        if lower.contains("app transport security") {
            return "系统拦住了明文 HTTP 请求，请在系统设置里允许本机网络访问。"
        }
        return raw
    }

    private func overlay(message: String, retry: Bool) -> some View {
        VStack(spacing: 12) {
            if !retry {
                ProgressView()
            } else {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 28))
                    .foregroundStyle(.secondary)
            }
            Text(message)
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("重试") {
                connect()
            }
            .buttonStyle(.borderedProminent)
            .opacity(retry ? 1 : 0)
        }
        .padding(20)
        .frame(maxWidth: 320)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
        .padding(.top, 60)
    }
}
