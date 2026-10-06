import {gameHtml} from './game-fixture.mjs';
// La marca se comprueba en texto visible y metadatos, no sustituyendo campos de datos.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");
const brand = "Continuum";
const formerBrand = /\btimeline(?:[-_ ]es)?\b/i;
const manifest = JSON.parse(read("manifest.webmanifest"));
const pkg = JSON.parse(read("package.json"));
const dom = new JSDOM(gameHtml(read("index.html")), { runScripts: "outside-only", url: "https://continuum.test/" });
const w = dom.window;
let checks = 0;
const check = (name, condition) => {
  assert.ok(condition, name);
  checks++;
  console.log(`  ok ${name}`);
};
const click = action => {
  const button = w.document.querySelector(`[data-action="${action}"]`);
  assert.ok(button, `Existe la acción ${action}`);
  button.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};
// Al volver desde otra pantalla, la colección elegida puede seguir desplegada. Solo
// tocamos su carátula cuando aún no se ven los mazos; volver a tocar una colección ya
// abierta ahora la pliega de forma intencionada.
const openSelectedCollection = () => {
  if (w.document.querySelector('[data-action="set-mode"]')) return;
  if (!w.document.querySelector('[data-action="set-block"]')) { w.document.querySelector('[data-inline-route]').click(); w.sessionStorage.removeItem('continuum-entry-route'); }
  click("set-block");
};
const checkScreen = label => {
  check(`${label}: marca o cabecera de partida despejada`, w.CONTINUUM.UI.isPlaying(w.document.getElementById('app').dataset.screen) ? !!w.document.querySelector('.atlas-back') && !!w.document.querySelector('.atlas-menu') : w.document.querySelector('.brand')?.textContent.trim() === brand);
  check(`${label}: sin la denominación antigua`, !formerBrand.test(w.document.getElementById("app").textContent));
};

console.log("\nIdentidad de Continuum");
try {
  check("título de la web", w.document.title === brand);
  check("nombre del acceso directo de iOS", w.document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content === brand);
  check("nombre completo y corto del manifiesto", manifest.name === brand && manifest.short_name === brand);
  check("nombre del paquete", pkg.name === brand.toLowerCase());
  check("título del actualizador", read("actualizar.html").includes(`<title>Actualizar ${brand}</title>`));
  check("título de la documentación", read("README.md").startsWith(`# ${brand}\n`));
  check("título de las auditorías", read("VERIFICACION_CORRECCIONES.md").startsWith(`# Correcciones de las auditorías de ${brand}\n`));
  for (const script of w.document.querySelectorAll("script[src]:not([type=\"module\"])")) w.eval(read(script.getAttribute("src")));
  checkScreen("Inicio");
  w.CONTINUUM.localNavigate('jugar');
  w.document.querySelector('[data-inline-route]').click(); w.sessionStorage.removeItem('continuum-entry-route');
  openSelectedCollection();
  click("set-mode");
  checkScreen("Solitario");
  w.CONTINUUM.openDeckAs("local");
  checkScreen("Configuración");
  w.CONTINUUM.openDeckAs("collections");
  click("start-free");
  checkScreen("Partida libre");
  check("cabecera compartida del modo online", /CT.UI.header/.test(read("online.js")));
  console.log(`\n${checks} comprobaciones de marca correctas`);
} finally {
  w.close();
}
