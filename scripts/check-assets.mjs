import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const budget=JSON.parse(fs.readFileSync(path.join(root,'asset-budget.json'),'utf8'));
function walk(folder){return fs.readdirSync(folder,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(path.join(folder,item.name)):[path.join(folder,item.name)]);}
const files=walk(path.join(root,'assets'));
const total=files.reduce((n,file)=>n+fs.statSync(file).size,0);
assert.ok(total<=budget.assetsBytes,`Recursos: ${total} bytes; presupuesto ${budget.assetsBytes}`);
for(const file of files.filter(f=>/\.(webp|jpg|jpeg|png)$/i.test(f)))assert.ok(fs.statSync(file).size<=budget.singleImageBytes,`Imagen demasiado pesada: ${path.relative(root,file)}`);
for(const file of files.filter(f=>f.includes('-cards') && /\.(webp|jpg|png)$/i.test(f))) {
  const meta=await sharp(file).metadata();
  assert.equal(meta.width,budget.cardWidth,`Anchura de ${file}`);
  assert.equal(meta.height,budget.cardHeight,`Altura de ${file}`);
}
const source=fs.readFileSync(path.join(root,'service-worker.js'),'utf8').split('];')[0];
const precache=[...new Set([...source.matchAll(/"\.\/([^"]*)"/g)].map(m=>m[1]||'index.html'))];
const initial=precache.reduce((n,file)=>n+fs.statSync(path.join(root,file)).size,0);
assert.ok(initial<=budget.precacheBytes,`Precarga: ${initial} bytes; presupuesto ${budget.precacheBytes}`);
console.log(JSON.stringify({assetsBytes:total,assetsMiB:+(total/1048576).toFixed(2),precacheBytes:initial,precacheMiB:+(initial/1048576).toFixed(2),files:files.length}));
