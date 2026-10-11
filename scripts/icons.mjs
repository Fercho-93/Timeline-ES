// Regenera solo tamaños de recursos ya existentes; no altera la composición del arte.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..',import.meta.url));
async function walk(dir) { const entries=await fs.readdir(dir,{withFileTypes:true}); return (await Promise.all(entries.map(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat(); }
for(const dir of ['android/app/src/main/res','ios/App/App/Assets.xcassets']) {
  for(const file of await walk(path.join(root,dir))) {
    if(!/\.png$/i.test(file) || !/ic_launcher|AppIcon|Splash|splash/.test(file)) continue;
    const meta=await sharp(file).metadata();
    // El modo oscuro (carpetas `-night` de Android y `-dark` de iOS) tiene su propio splash, con
    // el logo sobre fondo oscuro; reutilizar el claro dejaba un cuadrado crema en medio.
    const dark=/night|-dark/i.test(file);
    const source=path.join(root,'resources',/splash/i.test(file)?(dark?'splash-dark.png':'splash.png'):'icon.png');
    const background=dark||!/splash/i.test(file)?'#21170d':'#f6f1e8';
    const buffer=await sharp(source).resize(meta.width,meta.height,{fit:'contain',background}).removeAlpha().png().toBuffer();
    await fs.writeFile(file,buffer);
  }
}
console.log('Iconos y pantallas iniciales regenerados con sus dimensiones nativas.');
