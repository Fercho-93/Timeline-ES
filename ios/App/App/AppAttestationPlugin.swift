import Foundation
import Capacitor
import FirebaseCore
import FirebaseAppCheck

// App Check en la app de iPhone. La web demuestra que es Continuum con reCAPTCHA; dentro de
// la app eso no sirve (no hay dominio), así que el token sale de App Attest: el propio iPhone
// certifica que la petición viene de esta app firmada. `firebase-client.js` lo pide con un
// proveedor propio del SDK web, que lo añade a cada petición a Firestore.
//
// Firebase se configura aquí, con los datos públicos que manda `deployment.js`, para no
// depender de GoogleService-Info.plist (que no está en el repositorio).
@objc(AppAttestationPlugin)
public class AppAttestationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppAttestationPlugin"
    public let jsName = "AppAttestation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getToken", returnType: CAPPluginReturnPromise)
    ]

    private class AttestFactory: NSObject, AppCheckProviderFactory {
        func createProvider(with app: FirebaseApp) -> AppCheckProvider? {
            AppAttestProvider(app: app)
        }
    }

    @objc func getToken(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if FirebaseApp.app() == nil {
                guard let appId = call.getString("appId"), !appId.isEmpty,
                      let apiKey = call.getString("apiKey"), !apiKey.isEmpty,
                      let projectId = call.getString("projectId"), !projectId.isEmpty,
                      let senderId = call.getString("senderId"), !senderId.isEmpty else {
                    call.reject("APP_CHECK_NOT_CONFIGURED")
                    return
                }
                // El proveedor se fija antes de configurar Firebase, como pide App Check.
                AppCheck.setAppCheckProviderFactory(AttestFactory())
                let options = FirebaseOptions(googleAppID: appId, gcmSenderID: senderId)
                options.apiKey = apiKey
                options.projectID = projectId
                options.bundleID = Bundle.main.bundleIdentifier ?? ""
                FirebaseApp.configure(options: options)
            }
            AppCheck.appCheck().token(forcingRefresh: call.getBool("forceRefresh") ?? false) { token, error in
                guard let token else {
                    call.reject("APP_CHECK_FAILED", nil, error)
                    return
                }
                call.resolve([
                    "token": token.token,
                    "expireTimeMillis": Int(token.expirationDate.timeIntervalSince1970 * 1000)
                ])
            }
        }
    }
}
