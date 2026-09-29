import UIKit
import Capacitor

// Capacitor solo descubre los plugins de npm: los que viven en el propio proyecto
// (`LocalPeer`, `LocalLanSignal`) hay que registrarlos aquí a mano, como hace Android en
// MainActivity.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LocalPeerPlugin())
        bridge?.registerPluginInstance(LocalLanSignalPlugin())
    }
}
