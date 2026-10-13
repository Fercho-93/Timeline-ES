// La pantalla principal de la app de iPhone: carga el juego y registra las piezas nativas (Apple, App
// Attest, salas cercanas y Wi-Fi).
import UIKit
import Capacitor

// Capacitor solo descubre los plugins de npm: los que viven en el propio proyecto
// (`LocalPeer`, `LocalLanSignal`, `AppleSignIn`, `AppAttestation`) hay que registrarlos aquí a mano, como hace Android en
// MainActivity.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        // Sin rebote elástico: con él, la barra inferior fija se mueve y tiembla al desplazar la pantalla
        // (sobre todo al tirar más allá del principio o del final).
        bridge?.webView?.scrollView.bounces = false
        bridge?.webView?.scrollView.alwaysBounceVertical = false
        bridge?.webView?.scrollView.alwaysBounceHorizontal = false
        bridge?.registerPluginInstance(LocalPeerPlugin())
        bridge?.registerPluginInstance(LocalLanSignalPlugin())
        bridge?.registerPluginInstance(AppleSignInPlugin())
        bridge?.registerPluginInstance(AppAttestationPlugin())
    }
}
