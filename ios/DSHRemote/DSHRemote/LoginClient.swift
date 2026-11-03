import Foundation

enum LoginError: LocalizedError {
    case badURL
    case rejected(String)
    case network(String)
    case noCookie

    var errorDescription: String? {
        switch self {
        case .badURL: return "地址格式不对"
        case .rejected(let reason): return reason
        case .network(let reason): return "连不上：\(reason)"
        case .noCookie: return "登录成功，但服务端没有发会话 cookie"
        }
    }
}

/// 和服务端 `POST /api/lan_access.login` 的契约：
/// 请求 `{ "password": "...", "code": "123456" }`，成功 200 + `Set-Cookie: dsh_pub=...`，
/// 失败 401 `{ "ok": false, "error": "..." }`。
enum RemoteLogin {
    static func login(profile: RemoteProfile) async throws -> HTTPCookie {
        guard let base = profile.url else { throw LoginError.badURL }
        let endpoint = base.appendingPathComponent("api/lan_access.login")

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("DSHRemote/1.0 (iOS)", forHTTPHeaderField: "User-Agent")

        var body: [String: String] = [
            "password": profile.password,
            "device": "iOS"
        ]
        if let code = TOTP.code(secret: profile.totpSecret) {
            body["code"] = code
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw LoginError.network(error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else { throw LoginError.badURL }
        guard (200..<300).contains(http.statusCode) else {
            let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            let message = (payload?["error"] as? String) ?? "口令或动态码不对"
            throw LoginError.rejected(message)
        }

        var headers: [String: String] = [:]
        for (key, value) in http.allHeaderFields {
            if let key = key as? String, let value = value as? String { headers[key] = value }
        }
        let cookies = HTTPCookie.cookies(withResponseHeaderFields: headers, for: base)
        guard let cookie = cookies.first(where: { $0.name.hasPrefix("__Host-dsh_pub") || $0.name == "dsh_pub" }) else {
            throw LoginError.noCookie
        }
        return cookie
    }
}
