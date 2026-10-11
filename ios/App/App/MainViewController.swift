// La pantalla principal de la app de iPhone: carga el juego y registra las piezas nativas (Apple, App
// Attest, salas cercanas y Wi-Fi).
import UIKit
import Capacitor

// Capacitor solo descubre los plugins de npm: los que viven en el propio proyecto
// (`LocalPeer`, `LocalLanSignal`, `AppleSignIn`, `AppAttestation`) hay que registrarlos aquí a mano, como hace Android en
// MainActivity.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LocalPeerPlugin())
        bridge?.registerPluginInstance(LocalLanSignalPlugin())
        bridge?.registerPluginInstance(AppleSignInPlugin())
        bridge?.registerPluginInstance(AppAttestationPlugin())
    }
}
