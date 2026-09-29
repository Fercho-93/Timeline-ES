import Foundation
import Capacitor
import MultipeerConnectivity

// Conexión directa entre iPhones sin Wi-Fi ni internet: MultipeerConnectivity, la misma
// tecnología que AirDrop (Bluetooth y Wi-Fi entre iguales, se elige sola). El anfitrión se
// anuncia con los datos de su sala; los invitados la ven en una lista y se unen sin escanear
// nada. Solo lleva mensajes de texto: qué se dicen es cosa de `local-session.js`.
//
// Eventos hacia JS: `found` / `lost` (salas cercanas), `state` (un móvil se conecta o se
// cae) y `message` (texto recibido).
@objc(LocalPeerPlugin)
public class LocalPeerPlugin: CAPPlugin, CAPBridgedPlugin, MCSessionDelegate, MCNearbyServiceAdvertiserDelegate, MCNearbyServiceBrowserDelegate {
    public let identifier = "LocalPeerPlugin"
    public let jsName = "LocalPeer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "advertise", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopAdvertising", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "browse", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopBrowsing", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    // Tiene que coincidir con NSBonjourServices de Info.plist (`_continuum-loc._tcp` y `._udp`).
    private static let serviceType = "continuum-loc"
    private static let maxGuests = 8

    private var selfPeer: MCPeerID?
    private var session: MCSession?
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?
    private var found: [String: MCPeerID] = [:]
    private let lock = NSLock()

    // El nombre visible de un MCPeerID puede repetirse entre móviles; aquí es un
    // identificador aleatorio, y el nombre de la persona viaja dentro de los mensajes.
    private func ensureSession() -> MCSession {
        if let session { return session }
        let id = "c" + UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(12).lowercased()
        let peer = MCPeerID(displayName: id)
        let created = MCSession(peer: peer, securityIdentity: nil, encryptionPreference: .required)
        created.delegate = self
        selfPeer = peer
        session = created
        return created
    }

    @objc func advertise(_ call: CAPPluginCall) {
        let created = ensureSession()
        var info: [String: String] = [:]
        for (key, value) in call.getObject("info") ?? [:] {
            if let text = value as? String { info[key] = text } else if let number = value as? NSNumber { info[key] = number.stringValue }
        }
        advertiser?.stopAdvertisingPeer()
        let next = MCNearbyServiceAdvertiser(peer: selfPeer!, discoveryInfo: info, serviceType: LocalPeerPlugin.serviceType)
        next.delegate = self
        advertiser = next
        next.startAdvertisingPeer()
        call.resolve(["id": created.myPeerID.displayName])
    }

    @objc func stopAdvertising(_ call: CAPPluginCall) {
        advertiser?.stopAdvertisingPeer()
        advertiser = nil
        call.resolve()
    }

    @objc func browse(_ call: CAPPluginCall) {
        let created = ensureSession()
        browser?.stopBrowsingForPeers()
        lock.lock(); found.removeAll(); lock.unlock()
        let next = MCNearbyServiceBrowser(peer: selfPeer!, serviceType: LocalPeerPlugin.serviceType)
        next.delegate = self
        browser = next
        next.startBrowsingForPeers()
        call.resolve(["id": created.myPeerID.displayName])
    }

    @objc func stopBrowsing(_ call: CAPPluginCall) {
        browser?.stopBrowsingForPeers()
        browser = nil
        call.resolve()
    }

    @objc func connect(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("PEER_ID_REQUIRED"); return }
        lock.lock(); let peer = found[id]; lock.unlock()
        guard let peer, let session, let browser else { call.reject("PEER_NOT_FOUND"); return }
        browser.invitePeer(peer, to: session, withContext: nil, timeout: 20)
        call.resolve()
    }

    @objc func send(_ call: CAPPluginCall) {
        guard let session, let text = call.getString("data"), let data = text.data(using: .utf8) else { call.reject("SEND_FAILED"); return }
        let targets: [MCPeerID]
        if let id = call.getString("id") {
            targets = session.connectedPeers.filter { $0.displayName == id }
        } else {
            targets = session.connectedPeers
        }
        if targets.isEmpty { call.resolve(["sent": 0]); return }
        do {
            try session.send(data, toPeers: targets, with: .reliable)
            call.resolve(["sent": targets.count])
        } catch { call.reject("SEND_FAILED", nil, error) }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        if let id = call.getString("id"), let session {
            for peer in session.connectedPeers where peer.displayName == id { session.cancelConnectPeer(peer) }
        }
        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) { teardown(); call.resolve() }

    private func teardown() {
        advertiser?.stopAdvertisingPeer(); advertiser = nil
        browser?.stopBrowsingForPeers(); browser = nil
        session?.disconnect(); session?.delegate = nil; session = nil
        selfPeer = nil
        lock.lock(); found.removeAll(); lock.unlock()
    }

    deinit { teardown() }

    // MARK: MCSessionDelegate

    public func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        let name: String
        switch state {
        case .connected: name = "connected"
        case .connecting: name = "connecting"
        default: name = "notConnected"
        }
        notifyListeners("state", data: ["id": peerID.displayName, "state": name])
    }

    public func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        guard let text = String(data: data, encoding: .utf8) else { return }
        notifyListeners("message", data: ["id": peerID.displayName, "data": text])
    }

    public func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}
    public func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}
    public func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
    public func session(_ session: MCSession, didReceiveCertificate certificate: [Any]?, fromPeer peerID: MCPeerID, certificateHandler: @escaping (Bool) -> Void) { certificateHandler(true) }

    // MARK: MCNearbyServiceAdvertiserDelegate

    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        guard let session, session.connectedPeers.count < LocalPeerPlugin.maxGuests else { invitationHandler(false, nil); return }
        invitationHandler(true, session)
    }

    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        notifyListeners("error", data: ["where": "advertise", "message": error.localizedDescription])
    }

    // MARK: MCNearbyServiceBrowserDelegate

    public func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        lock.lock(); found[peerID.displayName] = peerID; lock.unlock()
        notifyListeners("found", data: ["id": peerID.displayName, "info": info ?? [:]])
    }

    public func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        lock.lock(); found.removeValue(forKey: peerID.displayName); lock.unlock()
        notifyListeners("lost", data: ["id": peerID.displayName])
    }

    public func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        notifyListeners("error", data: ["where": "browse", "message": error.localizedDescription])
    }
}
