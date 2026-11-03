import SwiftUI

@main
struct DSHRemoteApp: App {
    @StateObject private var store = ProfileStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .preferredColorScheme(.dark)
        }
    }
}
