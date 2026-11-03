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
        .task(id: profile.id) { await connect() }
        .onChange(of: store.profile) { _, next in
            guard next != nil else { return }
            Task { await connect() }
        }
    }

    private func connect() async {
        phase = .connecting
        message = ""
        defer { }

        do {
            let cookie = try await RemoteLogin.login(profile: profile)
            guard let url = profile.url else { throw LoginError.badURL }
            await model.load(url: url, cookies: [cookie])
            phase = .ready
        } catch {
            message = error.localizedDescription
            phase = .failed
        }
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
                Task { await connect() }
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
