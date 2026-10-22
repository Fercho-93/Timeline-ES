// Revisa el contenido: cuenta las cartas que tienen fuente y, con --write, actualiza el catálogo de
// fuentes y el inventario del arte (docs/inventario-arte.json).
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const files=['mazos/cards.js','mazos/movies.js','mazos/music.js','mazos/videogames.js','mazos/animals.js','mazos/lifespan.js','mazos/speed.js','mazos/inventos.js','mazos/mundo.js','mazos/astronomy.js','mazos/medicine.js','mazos/countries.js','mazos/population.js','mazos/idiomas.js','mazos/distances.js'];
const cards=[];
for(const file of files) {
  const window={}; vm.runInNewContext(await fs.readFile(file,'utf8'),{window});
  for(const list of Object.values(window).filter(Array.isArray)) for(const card of list) if(card.id && card.title) cards.push({file,id:card.id,title:card.title,value:card.value??card.year,source:card.source||null,reviewStatus:card.reviewStatus||null,comparison:card.comparison||null,reviewedAt:card.reviewedAt||null});
}
const natural=cards.filter(c=>['mazos/animals.js','mazos/lifespan.js','mazos/speed.js'].includes(c.file));
const missing=natural.filter(c=>!c.source);
if(process.argv.includes('--write')) {
  await fs.mkdir('docs',{recursive:true});
  await fs.writeFile('docs/catalogo-fuentes.json',JSON.stringify({note:'Inventario de referencias registradas; una referencia no implica verificación automática ni licencia de reutilización.',cards},null,2)+'\n');
  let previous=[];
  try{previous=JSON.parse(await fs.readFile('docs/inventario-arte.json','utf8')).assets;}catch(error){if(error.code!=='ENOENT')throw error;}
  const byPath=new Map(previous.map(asset=>[asset.path,asset]));
  const DECLARED={status:'user-confirmed-ai-generated',generator:'ChatGPT / OpenAI',declaredBy:'Fercho-93',evidenceRef:'PROCEDENCIA_ARTE_IA.md',exactPrompt:null,generatedAt:null,referenceImage:null,commercialTermsRef:'terms-to-preserve'};
  async function walk(dir) {const result=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const file=dir+'/'+e.name;if(e.isDirectory())result.push(...await walk(file));else if(/\.(png|webp|jpg|svg)$/i.test(file)){
    const sha256=createHash('sha256').update(await fs.readFile(file)).digest('hex'),old=byPath.get(file);
    // Todo el arte del juego se genera con IA (declaración general del titular en
    // PROCEDENCIA_ARTE_IA.md). Una imagen sin evidencia propia, nueva o cambiada, recibe esa
    // declaración; la que no ha cambiado conserva la suya, que puede ser más detallada.
    result.push(old?.sha256===sha256&&old.rightsEvidence?old:{path:file,sha256,rightsEvidence:DECLARED});
  }}return result;}
  await fs.writeFile('docs/inventario-arte.json',JSON.stringify({note:'Completar derechos y procedencia con evidencia del titular. No se presupone que una imagen pública pueda reutilizarse.',assets:await walk('assets')},null,2)+'\n');
}
console.log(JSON.stringify({cards:cards.length,withSource:cards.filter(c=>c.source).length,natureWithoutSource:missing.map(c=>({id:c.id,title:c.title}))},null,2));
if(missing.length>17)throw Error('Ha aumentado la deuda de fuentes en Naturaleza');
if(missing.some(c=>c.reviewStatus!=='pending'))throw Error('Hay cartas de Naturaleza sin fuente y sin aviso');
