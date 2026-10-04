import Foundation
import Capacitor
import AuthenticationServices
import CryptoKit
import Security

// Solo las compilaciones internas con APPLE_AUTH_TESTING pueden abrir Apple.
@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "availability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]
    private var pending: CAPPluginCall?
    private var controller: ASAuthorizationController?
    private var nonce: String?
    private var anchor: UIWindow?

    @objc func availability(_ call: CAPPluginCall) {
        #if APPLE_AUTH_TESTING
        call.resolve(["enabled": true])
        #else
        call.resolve(["enabled": false])
        #endif
    }

    @objc func authorize(_ call: CAPPluginCall) {
        #if APPLE_AUTH_TESTING
        DispatchQueue.main.async { [weak self] in
            guard let self else { call.reject("No se pudo abrir Apple.", "apple/unavailable"); return }
            guard self.pending == nil else { call.reject("Ya hay un acceso en curso.", "apple/busy"); return }
            guard let window = self.bridge?.viewController?.view.window else {
                call.reject("No se pudo abrir Apple.", "apple/unavailable"); return
            }
            var bytes = [UInt8](repeating: 0, count: 32)
            guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
                call.reject("No se pudo preparar el acceso.", "apple/nonce"); return
            }
            let raw = bytes.map { String(format: "%02x", $0) }.joined()
            let request = ASAuthorizationAppleIDProvider().createRequest()
            // No importamos el nombre real al alias público del juego.
            request.requestedScopes = [.email]
            request.nonce = SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined()
            let controller = ASAuthorizationController(authorizationRequests: [request])
            self.pending = call
            self.nonce = raw
            self.anchor = window
            self.controller = controller
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
        #else
        call.reject("Apple no está habilitado en esta beta.", "apple/beta-disabled")
        #endif
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        // La ventana se conserva antes de iniciar la petición.
        return anchor ?? UIWindow()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = pending else { return }
        defer { clearRequest() }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let token = credential.identityToken,
              let idToken = String(data: token, encoding: .utf8),
              !idToken.isEmpty, let raw = nonce else {
            call.reject("Apple no devolvió una identidad válida.", "apple/invalid-response"); return
        }
        // Los tokens solo viajan a Firebase; nunca se registran ni se guardan localmente.
        call.resolve(["idToken": idToken, "rawNonce": raw])
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = pending else { return }
        defer { clearRequest() }
        let cancelled = (error as? ASAuthorizationError)?.code == .canceled
        call.reject(cancelled ? "Acceso cancelado." : "No se pudo acceder con Apple.", cancelled ? "apple/cancelled" : "apple/failed")
    }

    private func clearRequest() {
        pending = nil
        controller = nil
        nonce = nil
        anchor = nil
    }
}
