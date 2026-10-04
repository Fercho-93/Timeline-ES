// La cámara web también necesita las declaraciones de la aplicación que la contiene.
// Sin la descripción de iOS, WKWebView puede ocultar getUserMedia y Sala Privada
// muestra «Este navegador no permite usar la cámara aquí» antes de pedir permiso.
import assert from "node:assert/strict";
import fs from "node:fs";

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const plist = read("ios/App/App/Info.plist");
assert.match(plist, /<key>NSCameraUsageDescription<\/key>\s*<string>[^<]*QR[^<]*<\/string>/,
  "iOS debe declarar para qué usa la cámara para exponerla al escáner web");
const manifest = read("android/app/src/main/AndroidManifest.xml");
assert.match(manifest, /<uses-permission\s+android:name="android.permission.CAMERA"\s*\/>/,
  "Android debe permitir que Capacitor solicite acceso a la cámara");
assert.match(manifest, /<uses-feature\s+android:name="android.hardware.camera"\s+android:required="false"\s*\/>/,
  "el juego también debe poder instalarse en dispositivos sin cámara");
console.log("Permisos del escáner QR en iOS y Android: OK");
