// Genera archivos de asociación únicamente con los identificadores reales del titular.
import fs from 'node:fs/promises';
const [team, fingerprint] = process.argv.slice(2);
if(!/^[A-Z0-9]{10}$/.test(team||'') || !/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/i.test(fingerprint||'')) throw Error('Uso: node scripts/domain-associations.mjs APPLE_TEAM_ID SHA256_CERTIFICADO_ANDROID');
await fs.mkdir('dist/.well-known',{recursive:true});
await fs.writeFile('dist/.well-known/apple-app-site-association',JSON.stringify({applinks:{apps:[],details:[{appID:team+'.com.continuum.game',paths:['/Timeline-ES/','/Timeline-ES/index.html']}]}}));
await fs.writeFile('dist/.well-known/assetlinks.json',JSON.stringify([{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'com.continuum.game',sha256_cert_fingerprints:[fingerprint.toUpperCase()]}}]));
console.log('Archivos generados. Deben publicarse en /.well-known/ de la raíz del dominio, no en /Timeline-ES/.well-known/.');
