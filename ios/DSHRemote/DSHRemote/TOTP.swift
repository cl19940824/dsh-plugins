import CryptoKit
import Foundation

/// RFC 6238 TOTP（30 秒一档，6 位，HMAC-SHA1）—— 和服务端 `lib/auth.mjs` 保持同一套参数。
enum TOTP {
    static let period: TimeInterval = 30
    static let digits = 6

    /// 用 Base32 secret 算当前时间片的 6 位码；secret 为空或格式不对时返回 nil。
    static func code(secret: String?, at date: Date = Date()) -> String? {
        guard let secret, let key = base32(secret) else { return nil }
        let counter = UInt64(floor(date.timeIntervalSince1970 / period))
        var big = counter.bigEndian
        let message = Data(bytes: &big, count: 8)
        let mac = HMAC<Insecure.SHA1>.authenticationCode(for: message, using: SymmetricKey(data: key))
        let bytes = Array(mac)
        let offset = Int(bytes[bytes.count - 1] & 0x0f)
        let binary = (UInt32(bytes[offset] & 0x7f) << 24)
            | (UInt32(bytes[offset + 1]) << 16)
            | (UInt32(bytes[offset + 2]) << 8)
            | UInt32(bytes[offset + 3])
        return String(format: "%06d", binary % 1_000_000)
    }

    /// 剩余多少秒换下一个码（UI 上用倒计时）。
    static func secondsRemaining(at date: Date = Date()) -> Int {
        let left = period - date.timeIntervalSince1970.truncatingRemainder(dividingBy: period)
        return max(0, Int(left.rounded(.up)))
    }

    /// 解码 Base32（忽略空格、短横线、等号，大小写不敏感）。
    static func base32(_ input: String) -> Data? {
        let alphabet = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567")
        var bits = 0
        var buffer = 0
        var output = Data()

        for character in input.uppercased() {
            if character == " " || character == "-" || character == "=" { continue }
            guard let index = alphabet.firstIndex(of: character) else { return nil }
            buffer = (buffer << 5) | index
            bits += 5
            if bits >= 8 {
                bits -= 8
                output.append(UInt8((buffer >> bits) & 0xff))
            }
        }
        return output.isEmpty ? nil : output
    }
}
