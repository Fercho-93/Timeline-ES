// Genera los archivos de verificación de enlaces (iOS y Android) solo con los identificadores reales del
// titular, para el dominio propio continuumjuego.es. Con el dominio propio, la raíz del sitio es la raíz
// de este proyecto, así que los archivos se escriben en `.well-known/` del repositorio y GitHub Pages los
// publica en https://continuumjuego.es/.well-known/ (hace falta `.nojekyll`, que ya existe).
import fs from 'node:fs/promises';
// Cada plataforma se puede publicar por su cuenta: `-` deja sin generar la que aún no tenga dato.
const [team = '-', fingerprint = '-', out = '.well-known'] = process.argv.slice(2);
const conTeam = team !== '-', conHuella = fingerprint !== '-';
if((!conTeam && !conHuella) || (conTeam && !/^[A-Z0-9]{10}$/.test(team)) || (conHuella && !/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/i.test(fingerprint))) throw Error('Uso: node scripts/domain-associations.mjs APPLE_TEAM_ID|- SHA256_CERTIFICADO_ANDROID|- [carpeta]');
await fs.mkdir(out,{recursive:true});
const paths = ['/','/index.html','/invitation.html'];
// `appID` + `paths` es el formato que entienden todas las versiones de iOS; `appIDs` + `components`, el actual.
if(conTeam) await fs.writeFile(`${out}/apple-app-site-association`,JSON.stringify({applinks:{apps:[],details:[{appID:team+'.com.continuum.game',appIDs:[team+'.com.continuum.game'],paths,components:paths.map(path=>({'/':path}))}]}}));
if(conHuella) await fs.writeFile(`${out}/assetlinks.json`,JSON.stringify([{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'com.continuum.game',sha256_cert_fingerprints:[fingerprint.toUpperCase()]}}]));
console.log(`Archivos generados en ${out}/. Se publican en https://continuumjuego.es/.well-known/ al subirlos a main.`);
