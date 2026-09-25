import Foundation
import Capacitor
import Network

@objc(LocalLanSignalPlugin)
public class LocalLanSignalPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LocalLanSignalPlugin"
    public let jsName = "LocalLanSignal"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAddress", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendAnswer", returnType: CAPPluginReturnPromise)
    ]

    private var listener: NWListener?
    private var token = ""
    private var port: UInt16 = 8765
    private let queue = DispatchQueue(label: "com.continuum.local-lan-signal")

    @objc func start(_ call: CAPPluginCall) {
        stopListener()
        token = call.getString("token") ?? ""
        port = UInt16(call.getInt("port") ?? 8765)
        do {
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true
            listener = try NWListener(using: params, on: NWEndpoint.Port(rawValue: port)!)
            listener?.newConnectionHandler = { [weak self] connection in self?.handle(connection) }
            listener?.stateUpdateHandler = { state in
                switch state {
                case .ready: call.resolve()
                case .failed(let error): call.reject("LAN_START_FAILED", nil, error)
                default: break
                }
            }
            listener?.start(queue: queue)
        } catch { stopListener(); call.reject("LAN_START_FAILED", nil, error) }
    }

    @objc func stop(_ call: CAPPluginCall) { stopListener(); call.resolve() }

    @objc func getAddress(_ call: CAPPluginCall) {
        guard let address = localIPv4() else { call.reject("LAN_ADDRESS_FAILED"); return }
        call.resolve(["address": address, "port": Int(port)])
    }

    @objc func sendAnswer(_ call: CAPPluginCall) {
        guard let host = call.getString("host"), let secret = call.getString("token"), let answer = call.getString("answer") else {
            call.reject("LAN_SEND_FAILED"); return
        }
        let targetPort = UInt16(call.getInt("port") ?? 8765)
        let peerId = call.getString("peerId") ?? ""
        let body: [String: Any] = ["token": secret, "answer": answer, "peerId": peerId]
        guard let data = try? JSONSerialization.data(withJSONObject: body) else { call.reject("LAN_SEND_FAILED"); return }
        let connection = NWConnection(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: targetPort)!, using: .tcp)
        connection.stateUpdateHandler = { state in
            if case .ready = state {
                let head = "POST /answer HTTP/1.1\r\nHost: \(host)\r\nContent-Type: application/json\r\nContent-Length: \(data.count)\r\nConnection: close\r\n\r\n"
                var packet = Data(head.utf8); packet.append(data)
                connection.send(content: packet, completion: .contentProcessed { error in
                    if let error { call.reject("LAN_SEND_FAILED", nil, error) }
                    else { call.resolve() }
                    connection.cancel()
                })
            } else if case .failed(let error) = state { call.reject("LAN_SEND_FAILED", nil, error) }
        }
        connection.start(queue: queue)
    }

    private func handle(_ connection: NWConnection) {
        connection.start(queue: queue)
        receiveAll(connection, data: Data())
    }

    private func receiveAll(_ connection: NWConnection, data: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] chunk, _, complete, error in
            guard let self else { return }
            var accumulated = data; if let chunk { accumulated.append(chunk) }
            if error != nil { connection.cancel(); return }
            if let marker = accumulated.range(of: Data("\r\n\r\n".utf8)) {
                let header = String(decoding: accumulated[..<marker.lowerBound], as: UTF8.self)
                guard header.hasPrefix("POST /answer ") else { self.reply(connection, status: 404); return }
                let length = header.split(separator: "\r\n").first { $0.lowercased().hasPrefix("content-length:") }.flatMap { Int($0.split(separator: ":", maxSplits: 1)[1].trimmingCharacters(in: .whitespaces)) } ?? 0
                let bodyStart = marker.upperBound
                if accumulated.count >= bodyStart + length {
                    let bodyData = accumulated.subdata(in: bodyStart..<(bodyStart + length))
                    guard let json = try? JSONSerialization.jsonObject(with: bodyData) as? [String: Any], (json["token"] as? String) == self.token else { self.reply(connection, status: 403); return }
                    self.notifyListeners("answer", data: ["token": self.token, "answer": json["answer"] as? String ?? "", "peerId": json["peerId"] as? String ?? ""])
                    self.reply(connection, status: 204); return
                }
            }
            if !complete { self.receiveAll(connection, data: accumulated) } else { connection.cancel() }
        }
    }

    private func reply(_ connection: NWConnection, status: Int) {
        let text = status == 204 ? "No Content" : status == 403 ? "Forbidden" : "Not Found"
        connection.send(content: Data("HTTP/1.1 \(status) \(text)\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".utf8), completion: .contentProcessed { _ in connection.cancel() })
    }

    private func localIPv4() -> String? {
        var address: String?
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return nil }
        defer { freeifaddrs(ifaddr) }
        for ptr in sequence(first: first, next: { $0.pointee.ifa_next }) {
            let interface = ptr.pointee
            guard interface.ifa_addr.pointee.sa_family == UInt8(AF_INET) else { continue }
            let name = String(cString: interface.ifa_name)
            guard name == "en0" || name.hasPrefix("bridge") else { continue }
            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            getnameinfo(interface.ifa_addr, socklen_t(interface.ifa_addr.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST)
            address = String(cString: host); if address != "127.0.0.1" { break }
        }
        return address
    }

    private func stopListener() { listener?.cancel(); listener = nil }
    deinit { stopListener() }
}
