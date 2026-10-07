// Genera los archivos de verificación de enlaces (iOS y Android) solo con los identificadores reales del
// titular, para el dominio propio continuumjuego.es. Con el dominio propio, la raíz del sitio es la raíz
// de este proyecto, así que los archivos se escriben en `.well-known/` del repositorio y GitHub Pages los
// publica en https://continuumjuego.es/.well-known/ (hace falta `.nojekyll`, que ya existe).
import fs from 'node:fs/promises';
const [team, fingerprint, out = '.well-known'] = process.argv.slice(2);
if(!/^[A-Z0-9]{10}$/.test(team||'') || !/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/i.test(fingerprint||'')) throw Error('Uso: node scripts/domain-associations.mjs APPLE_TEAM_ID SHA256_CERTIFICADO_ANDROID [carpeta]');
await fs.mkdir(out,{recursive:true});
await fs.writeFile(`${out}/apple-app-site-association`,JSON.stringify({applinks:{apps:[],details:[{appID:team+'.com.continuum.game',paths:['/','/index.html','/invitation.html']}]}}));
await fs.writeFile(`${out}/assetlinks.json`,JSON.stringify([{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'com.continuum.game',sha256_cert_fingerprints:[fingerprint.toUpperCase()]}}]));
console.log(`Archivos generados en ${out}/. Se publican en https://continuumjuego.es/.well-known/ al subirlos a main.`);
