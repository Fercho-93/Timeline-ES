// Prueba de maquetación real: JSDOM no puede detectar que una imagen se encoge.
// Ejecutar con Playwright instalado; el workflow instala Chromium y WebKit.
import {chromium, webkit} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {gameHtml} from './game-fixture.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const html=gameHtml(await fs.readFile(path.join(root,'index.html'),'utf8'));
const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)&&pathname!=='/')throw Error('path');
    const body=pathname==='/'?html:await fs.readFile(file);
    const ext=path.extname(file),mime={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'}[ext]||'text/html';
    res.writeHead(200,{'Content-Type':mime});res.end(body);
  } catch {res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/`;
await fs.mkdir('test-results/zoom',{recursive:true});
const records=[];
try {
 for(const [engine,type] of [['webkit',webkit],['chromium',chromium]]) {
  const browser=await type.launch();
  try {
   const transitionPage=await browser.newPage({viewport:{width:414,height:714},isMobile:true,deviceScaleFactor:2,reducedMotion:'no-preference'});
   await transitionPage.goto(url);
   await transitionPage.locator('[data-block="historia"]').click();
   await transitionPage.locator('[data-mode="history"]').click();
   const header=transitionPage.locator('.atlas-landscape');
   const initialHeader=await header.boundingBox();
   assert.equal(await transitionPage.locator('.deck-cover-flight, .book-turn').count(),0,'sin portada voladora ni hoja superpuesta');
   await transitionPage.waitForTimeout(300);
   const finalHeader=await header.boundingBox();
   assert.deepEqual(finalHeader,initialHeader,'el marco no cambia de posición ni tamaño durante la entrada');
   assert.equal(await header.evaluate(el=>getComputedStyle(el).opacity),'1');
   await transitionPage.screenshot({path:`test-results/zoom/${engine}-entrada-editorial.png`});
   await transitionPage.locator('[data-action="collection-back"]').click();
   await transitionPage.locator('[data-mode="history"]').click();
   assert.equal(await transitionPage.locator('.deck-cover-flight, .book-turn').count(),0,'reentrar no deja capas antiguas');
   await transitionPage.close();

   // La enciclopedia vive sobre una copia de la pantalla de origen. Al cerrarla se
   // reutiliza esa copia ya decodificada: si se repintara la portada, las carátulas
   // dejarían durante un instante su panel oscuro antes de volver a aparecer.
   const encyclopediaPage=await browser.newPage({viewport:{width:390,height:664},isMobile:true,deviceScaleFactor:2,reducedMotion:'no-preference'});
   await encyclopediaPage.goto(url);
   await encyclopediaPage.evaluate(()=>scrollTo(0,Math.min(760,document.documentElement.scrollHeight-innerHeight)));
   await encyclopediaPage.locator('[data-action="home-encyclopedia"]').click();
   const encyclopediaModal=encyclopediaPage.locator('.enc-modal');
   const persistentBack=encyclopediaPage.locator('.enc-modal > .atlas-dialog-back');
   const encyclopediaVeil=encyclopediaPage.locator('.enc-modal > .atlas-scroll-veil');
   assert.equal(await encyclopediaVeil.evaluate(veil=>getComputedStyle(veil).opacity),'0','la enciclopedia empieza sin veladura');
   assert.ok(await encyclopediaVeil.evaluate(veil=>Math.abs(veil.getBoundingClientRect().width-veil.parentElement.clientWidth)<=2),'la veladura de la enciclopedia llega a los bordes sin dibujar un rectángulo interior');
   const backAtTop=await persistentBack.boundingBox();
   await encyclopediaModal.evaluate(modal=>{modal.scrollTop=Math.max(20,modal.scrollHeight*.55);});
   await encyclopediaPage.waitForTimeout(50);
   await encyclopediaModal.evaluate(modal=>modal.dispatchEvent(new Event('scroll')));
   await encyclopediaPage.waitForTimeout(220);
   const backHalfway=await persistentBack.boundingBox();
   assert.equal(await persistentBack.evaluate(button=>getComputedStyle(button).position),'sticky','la salida de la enciclopedia queda anclada');
   assert.ok(await persistentBack.isVisible(),'la salida sigue disponible a mitad del catálogo');
   assert.ok(Math.abs(backHalfway.y-backAtTop.y)<=1,'la salida no se desplaza con las cartas');
   assert.equal(await encyclopediaVeil.evaluate(veil=>getComputedStyle(veil).opacity),'1','la enciclopedia difumina el contenido que sale por arriba');
   assert.ok(await encyclopediaVeil.evaluate(veil=>veil.getBoundingClientRect().top<=veil.parentElement.getBoundingClientRect().top+2),'la veladura de la enciclopedia cubre también el relleno superior');
   const backgroundImage=encyclopediaPage.locator('.enc-background img').first();
   await backgroundImage.waitFor();
   await backgroundImage.evaluate(async image=>{
     if(!image.complete) await new Promise(resolve=>image.addEventListener('load',resolve,{once:true}));
     image.__continuumCloseProbe=true;
   });
   await encyclopediaPage.locator('[data-action="enc-back"]').first().click();
   await encyclopediaPage.waitForTimeout(260);
   const restoredImage=encyclopediaPage.locator('.home-gallery-shell img').first();
   assert.equal(await restoredImage.evaluate(image=>image.__continuumCloseProbe===true),true,'cerrar la enciclopedia conserva el mismo nodo de imagen');
   assert.equal(await restoredImage.evaluate(image=>image.complete&&image.naturalWidth>0),true,'la carátula sigue decodificada al reaparecer');
   await encyclopediaPage.close();

   // El muelle de confirmación y el pliegue de la carta elegida: dos cosas que JSDOM no
   // ve. El botón llegó a quedarse fuera de la pantalla —`sticky` no funciona dentro de
   // `#app`, que recorta un eje y por eso es contenedor de desplazamiento— y el pliegue
   // se dibujaba como un arco dorado sobre el rótulo, por heredar la chapa del ✓.
   const duelPage=await browser.newPage({viewport:{width:390,height:664},isMobile:true,deviceScaleFactor:2,reducedMotion:'reduce'});
   await duelPage.goto(url);
   await duelPage.locator('[data-block="naturaleza"]').click();
   await duelPage.locator('[data-mode="animals"]').click();
   await duelPage.locator('[data-action="solo"]').click();
   await duelPage.locator('.solo-fold[data-solo-kind="duel"] > summary').click();
   await duelPage.locator('[data-action="start-duel"]').click();
   await duelPage.evaluate(()=>{window.CONTINUUM.Duelo.CUENTA_PASO_MS=10;});
   await duelPage.locator('[data-action="duel-play"]').click();
   await duelPage.locator('[data-action="solo-place"]').first().click();
   const dockBox=await duelPage.locator('.placement-dock').boundingBox();
   const timelineBox=await duelPage.locator('.timeline-wrap').boundingBox();
   const handTitleBox=await duelPage.locator('.atlas-hand-section .hand-title').boundingBox();
   assert.ok(dockBox.y>=timelineBox.y+timelineBox.height-1,'la confirmación queda debajo de la línea');
   assert.ok(dockBox.y+dockBox.height<=handTitleBox.y+1,'la confirmación queda antes de Tu carta');
   assert.equal(await duelPage.locator('.placement-dock').evaluate(el=>getComputedStyle(el).position),'static','la confirmación no flota sobre el contenido');
   assert.ok(await duelPage.locator('[data-action="confirm-place"]').isVisible(),'y se puede pulsar sin desplazar');
   const selectedStyle=await duelPage.locator('.hand-solo .hand-card.selected').evaluate(el=>({
     fold:getComputedStyle(el,'::before').display,
     transform:getComputedStyle(el).transform,
     width:el.getBoundingClientRect().width,
     height:el.getBoundingClientRect().height
   }));
   assert.equal(selectedStyle.fold,'none','la carta inferior no conserva el pliegue dorado');
   assert.ok(selectedStyle.width>=115&&selectedStyle.height>=148,'la carta inferior gana presencia sin dominar la pantalla');
   // Con la carta a la vista, el muelle no la tapa.
   await duelPage.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
   const manoBox=await duelPage.locator('.hand-solo .hand-card').boundingBox();
   const dockAbajo=await duelPage.locator('.placement-dock').boundingBox();
   assert.ok(dockAbajo.y+dockAbajo.height<=manoBox.y+1,'la confirmación termina antes de la carta y no la tapa');
   await duelPage.screenshot({path:`test-results/zoom/${engine}-duelo-muelle.png`});
   await duelPage.close();
   for(const [width,height] of [[375,667],[414,714],[390,844],[412,915]]) {
    const page=await browser.newPage({viewport:{width,height},isMobile:true,deviceScaleFactor:2,reducedMotion:'reduce'});
    await page.addInitScript(()=>{
      localStorage.setItem('hilo-solo-history-v1',JSON.stringify({kind:'free',difficulty:'normal',mode:'history',day:new Date().toLocaleDateString('sv-SE'),deck:[1,2,3],timeline:[74],current:67,lives:3,hits:0,played:0,total:null,finished:false}));
    });
    await page.goto(url);
    await page.locator('[data-block="historia"]').click();
    await page.locator('[data-mode="history"]').click();
    if(width===414) {
      await page.locator('.atlas-landscape img, .atlas-specimens img, .walking-art').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
      await page.screenshot({path:`test-results/zoom/${engine}-menu-color.png`,fullPage:true});
      await page.locator('[data-action="rules"]').click();
      const guideBack=page.locator('.rules .guide-tools > .atlas-dialog-back');
      const guideVeil=page.locator('.rules > .atlas-scroll-veil');
      assert.equal(await guideVeil.evaluate(veil=>getComputedStyle(veil).opacity),'0','la guía empieza sin veladura');
      assert.ok(await guideVeil.evaluate(veil=>Math.abs(veil.getBoundingClientRect().width-veil.parentElement.clientWidth)<=2),'la veladura de la guía llega a los bordes sin dibujar un rectángulo interior');
      const guideBackAtTop=await guideBack.boundingBox();
      await page.locator('.rules').evaluate(modal=>{modal.scrollTop=Math.max(20,modal.scrollHeight*.45);});
      await page.waitForTimeout(50);
      await page.locator('.rules').evaluate(modal=>modal.dispatchEvent(new Event('scroll')));
      await page.waitForTimeout(220);
      const guideBackHalfway=await guideBack.boundingBox();
      const guideBackStyle=await guideBack.evaluate(button=>({radius:getComputedStyle(button).borderRadius,background:getComputedStyle(button).backgroundColor}));
      assert.ok(Math.abs(guideBackHalfway.y-guideBackAtTop.y)<=1,'la flecha circular de la guía permanece flotante');
      assert.equal(guideBackStyle.radius,'50%','la guía comparte el botón circular de la enciclopedia');
      assert.notEqual(guideBackStyle.background,'rgba(0, 0, 0, 0)','la flecha de la guía conserva su fondo de papel');
      assert.equal(await guideVeil.evaluate(veil=>getComputedStyle(veil).opacity),'1','la guía difumina el contenido que sale por arriba');
      assert.ok(await guideVeil.evaluate(veil=>veil.getBoundingClientRect().top<=veil.parentElement.getBoundingClientRect().top+2),'la veladura de la guía cubre también el relleno superior');
      await page.locator('[data-guide-place="1"]').click();
      assert.ok(await page.locator('.guide-practice.is-correct').count(),'la guía permite completar la primera colocación');
      await page.screenshot({path:`test-results/zoom/${engine}-guia-interactiva.png`,fullPage:true});
      await page.locator('[data-guide-chapter="02"] > summary').click();
      assert.equal(await page.locator('[data-guide-chapter][open]').count(),1);
      await page.locator('[data-guide-chapter="03"] > summary').click();
      await page.waitForFunction(()=>document.querySelectorAll('[data-guide-chapter][open]').length===1 && document.querySelector('[data-guide-chapter="03"]').open);
      assert.equal(await page.locator('.guide-pulse-table tbody tr').count(),4);
      assert.ok(await page.locator('.guide-handbook').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'la guía cabe en el móvil');
      await page.screenshot({path:`test-results/zoom/${engine}-guia-poderes.png`,fullPage:true});
      await page.locator('.guide-close').click();
      await page.locator('[data-settings-action="open"]').click();
      const settingsBack=page.locator('.settings-modal .settings-head > .atlas-dialog-back');
      const settingsVeil=page.locator('.settings-modal > .atlas-scroll-veil');
      assert.equal(await settingsVeil.evaluate(veil=>getComputedStyle(veil).opacity),'0','ajustes empieza sin veladura');
      assert.ok(await settingsVeil.evaluate(veil=>Math.abs(veil.getBoundingClientRect().width-veil.parentElement.clientWidth)<=2),'la veladura de ajustes llega a los bordes sin dibujar un rectángulo interior');
      const settingsBackAtTop=await settingsBack.boundingBox();
      await page.locator('.settings-modal').evaluate(modal=>{modal.scrollTop=Math.max(20,modal.scrollHeight*.45);});
      await page.waitForTimeout(50);
      await page.locator('.settings-modal').evaluate(modal=>modal.dispatchEvent(new Event('scroll')));
      await page.waitForTimeout(220);
      const settingsBackHalfway=await settingsBack.boundingBox();
      const settingsBackStyle=await settingsBack.evaluate(button=>({radius:getComputedStyle(button).borderRadius,background:getComputedStyle(button).backgroundColor}));
      assert.ok(Math.abs(settingsBackHalfway.y-settingsBackAtTop.y)<=1,'la flecha circular de ajustes permanece flotante');
      assert.ok(settingsBackAtTop.x < width/2,'la salida de ajustes queda a la izquierda');
      assert.equal(settingsBackStyle.radius,'50%','ajustes comparte el botón circular');
      assert.notEqual(settingsBackStyle.background,'rgba(0, 0, 0, 0)','la flecha de ajustes conserva su fondo de papel');
      assert.equal(await settingsVeil.evaluate(veil=>getComputedStyle(veil).opacity),'1','ajustes difumina el contenido que sale por arriba');
      assert.ok(await settingsVeil.evaluate(veil=>veil.getBoundingClientRect().top<=veil.parentElement.getBoundingClientRect().top+2),'la veladura de ajustes cubre también el relleno superior');
      await page.locator('.settings-modal').evaluate(modal=>{modal.scrollTop=0;});
      await page.locator('#ajuste-tema').selectOption('night');
      await page.locator('#ajuste-texto').selectOption('150');
      assert.equal(await page.locator('[data-look-preview]').getAttribute('data-preview-theme'),'night');
      assert.equal(await page.locator('html').getAttribute('data-theme'),null,'la muestra no aplica el tema antes de confirmar');
      await page.screenshot({path:`test-results/zoom/${engine}-ajustes-muestra.png`,fullPage:true});
      await page.locator('.settings-close').click();
      await page.locator('[data-action="perfil"]').click();
      const profileBack=page.locator('#app[data-screen="perfil"] .atlas-topbar > .atlas-back');
      const profileVeil=page.locator('#app[data-screen="perfil"] .atlas-profile-veil');
      assert.equal(await profileVeil.evaluate(veil=>getComputedStyle(veil).opacity),'0','el perfil empieza sin veladura');
      const profileBackAtTop=await profileBack.boundingBox();
      await page.evaluate(()=>scrollTo(0,Math.max(20,document.documentElement.scrollHeight*.45)));
      await page.waitForTimeout(50);
      await page.evaluate(()=>dispatchEvent(new Event('scroll')));
      await page.waitForTimeout(220);
      const profileBackHalfway=await profileBack.boundingBox();
      const profileBackStyle=await profileBack.evaluate(button=>({radius:getComputedStyle(button).borderRadius,background:getComputedStyle(button).backgroundColor}));
      assert.ok(profileBackHalfway.y<=profileBackAtTop.y+1 && profileBackHalfway.y<=12,'la flecha circular del perfil permanece flotante');
      assert.equal(profileBackStyle.radius,'50%','perfil comparte el botón circular');
      assert.notEqual(profileBackStyle.background,'rgba(0, 0, 0, 0)','la flecha del perfil conserva su fondo de papel');
      assert.equal(await profileVeil.evaluate(veil=>getComputedStyle(veil).opacity),'1','el perfil difumina el contenido que sale por arriba');
      await profileBack.click();
      await page.evaluate(()=>{
        for (const key of ['history','movies','animals','countries','languages']) {
          const card=window.CONTINUUM.cards(key).find(item=>window.CONTINUUM.cardArt(key,item));
          if(card) window.CONTINUUM.Progreso.record({mode:key,cardId:card.id,correct:true});
        }
      });
      await page.locator('[data-action="home-encyclopedia"]').click();
      assert.equal(await page.locator('.enc-recent-card').count(),5,'los descubrimientos abren el álbum');
      assert.ok(await page.locator('.enc-deck-cover img').count()>5,'los mazos tienen portada');
      const toolbar=await page.locator('.enc-toolbar-compact').boundingBox();
      assert.ok(toolbar.height<260,'los filtros dejan protagonismo al álbum');
      await page.locator('.enc-recent-card img, .enc-deck-cover img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
      await page.screenshot({path:`test-results/zoom/${engine}-enciclopedia-album.png`,fullPage:true});
      await page.locator('[data-action="enc-back"]').first().click();
      const historyMode=page.locator('[data-mode="history"]');
      if(!await historyMode.isVisible())await page.locator('[data-block="historia"]').click();
      await historyMode.click();
    }
    await page.locator('[data-action="solo"]').click();
    await page.locator('.solo-fold').filter({has:page.locator('[data-action="resume-solo"]')}).locator('summary').click();
    await page.locator('[data-action="resume-solo"]').click();
    await page.locator('.timeline-card img').evaluate(img=>img.decode());
    const measure=()=>page.evaluate(()=>{
      const card=document.querySelector('.timeline-card'),img=card.querySelector('img'),panel=card.querySelector('.card-visual');
      const box=e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,top:r.top}};
      return {card:box(card),image:box(img),panel:box(panel),label:document.querySelector('.timeline-zoom output').textContent};
    });
    const base=await measure();
    assert.ok(base.card.width >= 127, 'la carta conserva un ancho legible');
    assert.ok(base.image.height >= 165, 'la ilustración gana altura al recuperar la fila de zoom');
    const heading=await page.locator('.timeline-toolbar').boundingBox();
    const zoom=await page.locator('.timeline-zoom').boundingBox();
    const board=await page.locator('.timeline-wrap').boundingBox();
    assert.ok(zoom.y >= heading.y && zoom.y+zoom.height <= heading.y+heading.height+1,'zoom integrado en la cabecera');
    assert.ok(zoom.y+zoom.height <= board.y+1,'zoom situado encima de las cartas');
    assert.ok(heading.x+heading.width <= width,'los controles caben sin desbordamiento horizontal');
    for(const [index,scale] of [.8,1,1.2].entries()) {
      await page.locator(`[data-zoom-level="${index}"]`).click();
      const now=await measure();
      assert.equal(now.label,`${Math.round(scale*100)}%`);
      for(const part of ['card','image'])for(const axis of ['width','height']) {
        assert.ok(Math.abs(now[part][axis]/base[part][axis]-scale)<.015,`${engine} ${width} ${now.label} ${part}.${axis}: ${JSON.stringify({base,now})}`);
      }
      assert.ok(Math.abs(now.panel.width-now.image.width)<1,'la imagen llena el ancho del panel');
      assert.ok(Math.abs(now.panel.height-now.image.height)<1,'la imagen llena el alto del panel');
      assert.ok(now.image.width/now.card.width>.75,'la imagen no se convierte en una miniatura');
      records.push({engine,width,height,scale,...now});
      if(width===414)await page.screenshot({path:`test-results/zoom/${engine}-${Math.round(scale*100)}.png`,fullPage:true});
    }
    if (width === 414) {
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.locator('[data-zoom-level="1"]').click();
      const hand=page.locator('.hand-card.selected');
      await hand.scrollIntoViewIfNeeded();
      const source=await hand.boundingBox();
      const target=await page.locator('[data-action="solo-place"][data-index="1"]').boundingBox();
      await page.mouse.move(source.x+source.width/2,source.y+source.height/2);
      await page.mouse.down();
      await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:8});
      await page.locator('.drag-ghost').waitFor();
      const ghost=await page.locator('.drag-ghost').boundingBox();
      assert.ok(ghost.width<150,'el arrastre deja visible el destino');
      assert.ok(await page.locator('.slot.drop-target').count()>0);
      await page.screenshot({path:`test-results/zoom/${engine}-arrastre.png`});
      await page.mouse.up();
      await page.locator('[data-action="confirm-place"]').click();
      const preview=page.locator('.overlay.result-preview');
      await preview.waitFor({state:'visible',timeout:800});
      assert.equal(await page.locator('.modal').isVisible(),false,'el resultado no tapa la carta');
      const style=await preview.evaluate(el=>({background:getComputedStyle(el).backgroundColor,blur:getComputedStyle(el).backdropFilter}));
      assert.equal(style.background,'rgba(0, 0, 0, 0)');
      assert.equal(style.blur,'none');
      await page.waitForTimeout(450);
      await page.screenshot({path:`test-results/zoom/${engine}-acierto-tablero.png`});
      await page.locator('.modal').waitFor({state:'visible',timeout:2500});
      assert.equal(await page.locator('[data-action="solo-next"]').evaluate(el=>document.activeElement===el),true);
      assert.equal(await page.locator('.board-result').getAttribute('aria-modal'),'false');
      assert.equal(await page.locator('.result-history').getAttribute('open'),null);
      await page.locator('.result-history > summary').click();
      assert.equal(await page.locator('.result-history .reveal').isVisible(),true);
      await page.locator('.result-history > summary').click();
      await page.screenshot({path:`test-results/zoom/${engine}-acierto-resultado.png`});
      await page.locator('[data-action="solo-next"]').click();
      assert.equal(await page.locator('.shell').evaluate(el=>el.inert),true,'el tablero espera antes de repartir');
      const hiddenAI=page.locator('.timeline-card[style*="visibility: hidden"]');
      assert.ok(await hiddenAI.count()>0,'la carta de IA aún no aparece');
      await page.waitForTimeout(500);
      assert.ok(await hiddenAI.count()>0,'la espera dura más de medio segundo');
      await page.waitForFunction(()=>!document.querySelector('.shell').inert);
      await page.waitForTimeout(800);
      // Un fallo enseña el destino real sobre el tablero antes del resultado.
      const wrong=await page.evaluate(()=>{
        const cards=new Map(window.HISTORY_CARDS.map(c=>[c.id,c]));
        const board=[...document.querySelectorAll('.timeline .timeline-card')].map(el=>cards.get(Number(el.dataset.id)));
        const card=cards.get(Number(document.querySelector('.hand-card').dataset.id));
        const right=window.CONTINUUM.correctIndex('history',board,card);
        return right===0 ? board.length : 0;
      });
      await page.locator(`[data-action="solo-place"][data-index="${wrong}"]`).click();
      await page.locator('[data-action="confirm-place"]').click();
      await page.locator('.placement-correction-card').waitFor({state:'visible',timeout:800});
      assert.ok(await page.locator('.slot-correct.correction-target').count()>0,'el hueco correcto se señala tras confirmar el fallo');
      await page.screenshot({path:`test-results/zoom/${engine}-correccion-error.png`});
      await page.locator('.modal').waitFor({state:'visible',timeout:2500});
      assert.equal(await page.locator('.placement-correction-card').count(),0,'la explicación se retira antes de abrir el resultado');
      await page.locator('[data-action="solo-next"]').click();
      if(await page.locator('.shell[inert]').count()) await page.waitForFunction(()=>!document.querySelector('.shell').inert);
      // Completar la partida permite revisar el abanico y la página de resultados reales.
      for(let turn=0;turn<8 && await page.locator('[data-action="solo-place"]').count();turn++) {
        const at=await page.evaluate(()=>{
          const cards=new Map(window.HISTORY_CARDS.map(c=>[c.id,c]));
          const board=[...document.querySelectorAll('.timeline .timeline-card')].map(el=>cards.get(Number(el.dataset.id)));
          const card=cards.get(Number(document.querySelector('.hand-card').dataset.id));
          return window.CONTINUUM.correctIndex('history',board,card);
        });
        await page.locator(`[data-action="solo-place"][data-index="${at}"]`).click();
        await page.locator('[data-action="confirm-place"]').click();
        await page.locator('.modal').waitFor({state:'visible'});
        await page.locator('[data-action="solo-next"]').click();
        if(await page.locator('.shell[inert]').count()) await page.waitForFunction(()=>!document.querySelector('.shell').inert);
      }
      await page.locator('.atlas-final-page').waitFor();
      assert.ok(await page.locator('.atlas-final-fan .timeline-card').count()>0);
      assert.ok(await page.locator('.final-metrics').count(),'el resultado abre con sus cifras clave');
      const finalAction=await page.locator('.final-actions .btn-primary').first().boundingBox();
      assert.ok(finalAction && finalAction.y<height,'la acción principal asoma sin tener que recorrer el texto');
      await page.waitForTimeout(1500);
      await page.screenshot({path:`test-results/zoom/${engine}-final-atlas.png`,fullPage:true});
      await page.close();
      continue;
    }
    // Cambiar orientación debe recalcular el espacio reservado sin recortar la tira.
    await page.setViewportSize({width:height,height:width});
    await page.waitForFunction(()=>{
      const frame=document.querySelector('.timeline-scale-frame').getBoundingClientRect();
      const line=document.querySelector('.timeline').getBoundingClientRect();
      return Math.abs(frame.height-line.height)<2;
    });
    await page.close();
   }
  } finally {await browser.close();}
 }
 console.log('OK: carta e imagen proporcionales en 24 combinaciones (WebKit/Chromium, 4 pantallas, 3 niveles).');
} finally {
 await fs.writeFile('test-results/zoom/measurements.json',JSON.stringify(records,null,2));
 server.close();
}
