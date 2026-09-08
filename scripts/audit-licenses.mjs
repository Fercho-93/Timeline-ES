import fs from 'node:fs/promises';
const lock=JSON.parse(await fs.readFile('package-lock.json','utf8'));
const packages=Object.entries(lock.packages).filter(([path])=>path).map(([path,p])=>({path,version:p.version,declaredLicense:p.license||null,developmentOnly:p.dev===true}));
const counts={};for(const p of packages)counts[p.declaredLicense||'SIN DECLARACIÓN']=(counts[p.declaredLicense||'SIN DECLARACIÓN']||0)+1;
const result={note:'Declaraciones del lockfile; no acreditan licencias del arte ni sustituyen la revisión de avisos y condiciones de distribución.',counts,packages};
if(process.argv.includes('--write'))await fs.writeFile('docs/licencias-dependencias.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({packages:packages.length,counts},null,2));
