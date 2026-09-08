import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const files=['cards.js','movies.js','music.js','videogames.js','animals.js','lifespan.js','speed.js','inventos.js','mundo.js','astronomy.js','medicine.js','countries.js','population.js','distances.js'];
const cards=[];
for(const file of files) {
  const window={}; vm.runInNewContext(await fs.readFile(file,'utf8'),{window});
  for(const list of Object.values(window).filter(Array.isArray)) for(const card of list) if(card.id && card.title) cards.push({file,id:card.id,title:card.title,value:card.value??card.year,source:card.source||null,reviewStatus:card.reviewStatus||null,comparison:card.comparison||null,reviewedAt:card.reviewedAt||null});
}
const natural=cards.filter(c=>['animals.js','lifespan.js','speed.js'].includes(c.file));
const missing=natural.filter(c=>!c.source);
if(process.argv.includes('--write')) {
  await fs.mkdir('docs',{recursive:true});
  await fs.writeFile('docs/catalogo-fuentes.json',JSON.stringify({note:'Inventario de referencias registradas; una referencia no implica verificación automática ni licencia de reutilización.',cards},null,2)+'\n');
  let previous=[];
  try{previous=JSON.parse(await fs.readFile('docs/inventario-arte.json','utf8')).assets;}catch(error){if(error.code!=='ENOENT')throw error;}
  const byPath=new Map(previous.map(asset=>[asset.path,asset]));
  async function walk(dir) {const result=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const file=dir+'/'+e.name;if(e.isDirectory())result.push(...await walk(file));else if(/\.(png|webp|jpg|svg)$/i.test(file)){
    const sha256=createHash('sha256').update(await fs.readFile(file)).digest('hex'),old=byPath.get(file);
    result.push(old?.sha256===sha256?old:{path:file,sha256,rightsEvidence:null,...(old?{previousEvidence:old,reviewRequired:true}:{})});
  }}return result;}
  await fs.writeFile('docs/inventario-arte.json',JSON.stringify({note:'Completar derechos y procedencia con evidencia del titular. No se presupone que una imagen pública pueda reutilizarse.',assets:await walk('assets')},null,2)+'\n');
}
console.log(JSON.stringify({cards:cards.length,withSource:cards.filter(c=>c.source).length,natureWithoutSource:missing.map(c=>({id:c.id,title:c.title}))},null,2));
if(missing.length>17)throw Error('Ha aumentado la deuda de fuentes en Naturaleza');
if(missing.some(c=>c.reviewStatus!=='pending'))throw Error('Hay cartas de Naturaleza sin fuente y sin aviso');
