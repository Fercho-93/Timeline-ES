// Prueba de maquetación real: JSDOM no puede detectar que una imagen se encoge.
// Ejecutar con Playwright instalado; el workflow instala Chromium y WebKit.
// ENGINES=chromium limita la prueba a Chromium donde no hay WebKit instalado (por defecto, los dos).
import { servirJuego, chromium, motores, opcionesLanzamiento, DECODIFICAR } from './lib/navegador.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const server = await servirJuego();
const url=`http://127.0.0.1:${server.address().port}/`;
await fs.mkdir('test-results/zoom',{recursive:true});
const records=[];
// Jugar solo → Grandes colecciones: elegir un mazo lleva directo a jugarlo en solitario.
async function openCollections(page){
  await page.evaluate(()=>window.CONTINUUM.ModeHubs.open('hub-solo'));
  // Si el cajón ya estaba abierto (se recuerda al volver), no se vuelve a tocar: se cerraría.
  if(await page.locator('#mode-inline-drawer[hidden]').count())await page.locator('[data-inline-route="collections"]').click();
}
try {
 for(const [engine,type] of motores()) {
  if (process.env.BROWSER_ENGINE && process.env.BROWSER_ENGINE !== engine) continue;
  const browser=await type.launch(opcionesLanzamiento(engine));
  const newPage = async options => {
    const page = await browser.newPage(options);
    await page.addInitScript(() => localStorage.setItem('continuum-splash-seen-v2', '1'));
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);
    return page;
  };
  try {
   // Una lámina vertical debe llenar la franja horizontal, sin bandas laterales ni
   // deformación. Probamos los contenedores compartidos: los finales también tenían
   // márgenes y un max-height propios que dejaban huecos aunque se cambiara object-fit.
   const openingPage=await newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
   await openingPage.goto(url);
   await openingPage.evaluate(()=>window.CONTINUUM_SPLASH?.finish());
   for(const [width,height] of [[320,667],[390,844],[820,1180]]) {
    await openingPage.setViewportSize({width,height});
    for(const theme of ['light','dark']) {
     for(const mode of ['history','animals']) {
      for(const context of ['local','quick','room','public','duel','turn','final','revealed']) {
       await openingPage.evaluate(({theme,mode,context})=>{
        document.documentElement.dataset.theme=theme;
        const CT=window.CONTINUUM,app=document.getElementById('app');
        const card=mode==='history'?CT.cards(mode).find(card=>card.id===100):CT.cards(mode)[0];
        const plate=CT.StarterPresentation.plate(mode,card,context==='revealed');
        app.className='';app.dataset.screen='opening-preview';
        if(context==='local'||context==='quick') app.innerHTML=`<div class="overlay" data-starter-dialog ${context==='quick'?'data-quick-starter':''}><div class="modal">${CT.StarterPresentation.heading('Fer',0,2)}${plate}</div></div>`;
        else if(context==='final') app.innerHTML=`<div class="shell">${CT.Final.question(mode,{cardId:card.id,round:1})}</div>`;
        else {
         const parent=context==='room'?'panel lobby-settings':context==='public'?'panel public-starter':context==='turn'?'turn-duel-shell':'shell';
         const panel=context==='duel'?'cifra-panel starter-presentation cifra-presentation':context==='turn'?'turn-duel-answer starter-presentation cifra-presentation':'starter-presentation starter-inline';
         app.innerHTML=`<div class="${parent}"><section class="${panel}">${plate}</section></div>`;
        }
       },{theme,mode,context});
       const art=openingPage.locator('.starter-card-art img');
       await art.evaluate(DECODIFICAR);
       const fit=await art.evaluate(img=>{
        const box=img.getBoundingClientRect(),frame=img.parentElement,outer=frame.getBoundingClientRect(),style=getComputedStyle(img),edge=getComputedStyle(frame);
        const left=outer.left+parseFloat(edge.borderLeftWidth),top=outer.top+parseFloat(edge.borderTopWidth);
        const right=outer.right-parseFloat(edge.borderRightWidth),bottom=outer.bottom-parseFloat(edge.borderBottomWidth);
        return {loaded:img.naturalWidth>0,fit:style.objectFit,filled:Math.abs(box.left-left)<1&&Math.abs(box.right-right)<1&&Math.abs(box.top-top)<1&&Math.abs(box.bottom-bottom)<1};
       });
       assert.ok(fit.loaded&&fit.filled&&fit.fit==='cover',`${width}px ${theme} ${mode} ${context}: el grabado llena el recuadro sin bandas ni deformación (${JSON.stringify(fit)})`);
       assert.ok(await openingPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${context}: sin desbordamiento horizontal`);
       if(width===390&&theme==='light'&&mode==='history'&&['local','final','revealed'].includes(context)) await openingPage.screenshot({path:`test-results/zoom/${engine}-lamina-${context}.png`,fullPage:true});
      }
     }
    }
   }
   await openingPage.close();
   // La lámina completa termina antes de la placa; el toque amplía imagen y datos.
   const illustratedPage=await newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2,reducedMotion:'reduce'});
   await illustratedPage.goto(url);
   await illustratedPage.evaluate(() => window.CONTINUUM_SPLASH?.finish());
   await openCollections(illustratedPage);
   await illustratedPage.locator('[data-block="historia"]').click();
   await illustratedPage.locator('[data-mode="history"]').click();
   await illustratedPage.locator('[data-action="start-free"]').click();
   const illustratedCard=illustratedPage.locator('.timeline .timeline-card:has(.animal-card-art)').first();
   await illustratedCard.locator('img').evaluate(DECODIFICAR);
   const illustrated=await illustratedCard.evaluate(card=>{
     const image=card.querySelector('.card-visual'),caption=card.querySelector('.card-content');
     const bounds=element=>element.getBoundingClientRect();
     return {cardHeight:bounds(card).height,imageHeight:bounds(image).height,captionHeight:bounds(caption).height,
       imageWidth:bounds(image).width,cardWidth:bounds(card).width,
       imageBottom:bounds(image).bottom,captionTop:bounds(caption).top,
       imageFit:getComputedStyle(image.querySelector('img')).objectFit,
       captionFlex:getComputedStyle(caption).flexGrow,
       captionBackground:getComputedStyle(caption).backgroundColor,
       titleColor:getComputedStyle(caption.querySelector('h3')).color};
   });
   await illustratedPage.screenshot({path:`test-results/zoom/${engine}-carta-ilustrada.png`});
   assert.ok(Math.abs(illustrated.imageHeight-illustrated.imageWidth*1.5)<3,'la lámina conserva su proporción completa');
   assert.ok(illustrated.imageHeight>165,'la lámina aprovecha el espacio disponible para mostrar el dibujo');
   assert.ok(illustrated.cardHeight>illustrated.imageHeight,'la placa de datos permanece dentro de la carta');
   assert.ok(illustrated.captionTop>=illustrated.imageBottom-1,'el texto comienza debajo de la lámina');
   assert.equal(illustrated.imageFit,'contain','la imagen no recorta los bordes');
   assert.ok(illustrated.captionHeight<illustrated.cardHeight*.4,'la placa deja protagonismo al dibujo');
   assert.equal(illustrated.captionFlex,'0','el pie no crece sobre la lámina');
   assert.equal(illustrated.captionBackground,'rgb(248, 239, 221)','el pie es papel claro');
   assert.equal(illustrated.titleColor,'rgb(48, 33, 22)','el título tiene tinta oscura');
   const fullTitle=await illustratedCard.locator('h3').textContent();
   const fullValue=await illustratedCard.locator('.year').textContent();
   // Un título largo debe verse entero en la carta compacta, sin ocultar la fecha.
   await illustratedCard.locator('h3').evaluate(el=>{el.textContent='Comienzan las guerras cántabras y astures';});
   await illustratedPage.waitForFunction(()=>{
     const card=document.querySelector('.timeline .timeline-card:has(.animal-card-art)');
     const frame=card?.closest('.timeline-scale-frame');
     return frame && frame.getBoundingClientRect().bottom>=card.getBoundingClientRect().bottom-1;
   });
   const longTitle=await illustratedCard.evaluate(card=>{
     const title=card.querySelector('h3'),value=card.querySelector('.year'),frame=card.closest('.timeline-scale-frame');
     const line=parseFloat(getComputedStyle(title).lineHeight)||parseFloat(getComputedStyle(title).fontSize)*1.2;
     return {titleHeight:title.offsetHeight,titleScroll:title.scrollHeight,titleLines:Math.round(title.offsetHeight/line),
       titleClamp:getComputedStyle(title).webkitLineClamp,
       valueBottom:value.getBoundingClientRect().bottom,cardBottom:card.getBoundingClientRect().bottom,
       frameBottom:frame.getBoundingClientRect().bottom};
   });
   assert.ok(longTitle.titleLines>=2,'el título largo ocupa varias líneas');
   assert.ok(longTitle.titleScroll<=longTitle.titleHeight+1,'se ven todas las líneas del título');
   assert.equal(longTitle.titleClamp,'none','el título no tiene límite de líneas');
   assert.ok(longTitle.valueBottom<=longTitle.cardBottom+1,'el valor sigue visible bajo el título');
   assert.ok(longTitle.valueBottom<=longTitle.frameBottom+1,'el zoom deja espacio para el valor');
   await illustratedPage.screenshot({path:`test-results/zoom/${engine}-carta-titulo-largo.png`});
   await illustratedCard.locator('h3').evaluate((el,title)=>{el.textContent=title;},fullTitle);
   await illustratedCard.click();
   const detail=illustratedPage.locator('.timeline-detail-modal');
   assert.equal(await detail.locator('h2').textContent(),fullTitle,'la vista ampliada muestra el título completo');
   assert.equal(await detail.locator('.timeline-detail-value').textContent(),fullValue,'la vista ampliada muestra el valor');
   assert.equal(await detail.locator('img').evaluate(img=>getComputedStyle(img).objectFit),'contain','la lámina ampliada está completa');
   await illustratedPage.screenshot({path:`test-results/zoom/${engine}-carta-ampliada.png`});
   await detail.locator('[data-card-detail-close]').first().click();
   assert.equal(await illustratedPage.locator('.timeline-detail-overlay').count(),0,'volver conserva la partida');
   await illustratedPage.close();

   const atlasPage=await newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2,reducedMotion:'reduce'});
   await atlasPage.goto(url);
   await atlasPage.evaluate(() => window.CONTINUUM_SPLASH?.finish());
   await atlasPage.locator('.home-nav [data-action="perfil"]').evaluate(el=>{el.dataset.homeTransition='done';});
   await atlasPage.locator('.home-nav [data-action="perfil"]').click();
   const map=atlasPage.locator('.atlas-chart');
   await map.screenshot({path:`test-results/zoom/${engine}-atlas-mapa.png`});
   assert.equal(await map.locator('.atlas-chart-stop').count(),5,'el mapa muestra los cinco destinos');
   assert.equal(await atlasPage.locator('.atlas-territory').count(),6,'el Atlas conserva todas las zonas y la cuenta');
   assert.equal(await atlasPage.locator('.perfil-stats > span').count(),6,'se mantienen las seis estadísticas');
   const mapWidth=await map.evaluate(el=>({scroll:el.scrollWidth,visible:el.clientWidth}));
   assert.ok(mapWidth.scroll<=mapWidth.visible+1,'el mapa cabe en la pantalla móvil');
   await map.locator('a[href="#atlas-achievements"]').click();
   assert.ok(await atlasPage.locator('#atlas-achievements .perfil-achievement-group').count()>0,'el destino de logros lleva al contenido');
   await atlasPage.close();

   const transitionPage=await newPage({viewport:{width:414,height:714},isMobile:true,deviceScaleFactor:2,reducedMotion:'no-preference'});
   await transitionPage.goto(url);
   await transitionPage.evaluate(() => window.CONTINUUM_SPLASH?.finish());
   await openCollections(transitionPage);
   await transitionPage.locator('[data-block="historia"]').click();
   await transitionPage.locator('[data-mode="history"]').click();
   assert.equal(await transitionPage.locator('.camera-move').count(),0,'sin copia de pantalla');
   assert.equal(await transitionPage.locator('.home-nav').count(),1,'navegación única y estable');
   await transitionPage.waitForFunction(()=>!document.querySelector('.motion-entering'));
   assert.equal(await transitionPage.locator('.shell').evaluate(el=>getComputedStyle(el).animationName),'none','sin segunda entrada CSS');
   await transitionPage.screenshot({path:`test-results/zoom/${engine}-entrada-editorial.png`});
   assert.ok(await transitionPage.locator('.solo-panel [data-action="start-free"]').count()>0,'solitario llega con su única opción a la vista');
   await transitionPage.waitForFunction(()=>!document.querySelector('.motion-entering'));
   const soloBefore=await transitionPage.locator('.solo-home').evaluate(el=>({text:el.innerText,top:el.getBoundingClientRect().top,height:el.getBoundingClientRect().height}));
   await transitionPage.waitForTimeout(400);
   const soloAfter=await transitionPage.locator('.solo-home').evaluate(el=>({text:el.innerText,top:el.getBoundingClientRect().top,height:el.getBoundingClientRect().height}));
   assert.equal(soloAfter.text,soloBefore.text,'la pantalla de solitario no cambia de contenido después de que la cámara termine');
   // El texto ya prueba que no cambia el contenido; esto solo vigila que no vuelva el
   // salto de geometría del bug original. Ese salto era de cientos de píxeles (los tres
   // paneles viajaban abiertos y se plegaban de golpe al terminar); un margen amplio
   // absorbe la métrica de fuente propia de cada motor sin dejar de detectarlo.
   const SALTO_MAXIMO = 60;
   assert.ok(Math.abs(soloAfter.top-soloBefore.top)<SALTO_MAXIMO,`la posición no debería saltar tras el viaje (${soloBefore.top} → ${soloAfter.top})`);
   assert.ok(Math.abs(soloAfter.height-soloBefore.height)<SALTO_MAXIMO,`la altura no debería saltar tras el viaje (${soloBefore.height} → ${soloAfter.height})`);
   await transitionPage.locator('[data-action="back-menu"]').click();
   await transitionPage.waitForFunction(()=>!document.querySelector('.motion-entering')).catch(()=>{});
   if(!await transitionPage.locator('#app [data-mode="history"]').isVisible())await transitionPage.locator('#app [data-block="historia"]').click();
   // Durante el viaje inverso hay una réplica inerte de la pantalla anterior. El
   // usuario solo puede tocar #app; la prueba debe apuntar al mismo lugar interactivo.
   await transitionPage.locator('#app [data-mode="history"]').click();
   assert.equal(await transitionPage.locator('.shell.motion-managed').count(),1,'reentrar usa el mismo revelado');
   await transitionPage.waitForFunction(()=>!document.querySelector('.motion-entering'));
   assert.equal(await transitionPage.locator('.camera-move, .deck-cover-flight, .book-turn').count(),0,'reentrar no deja capas antiguas');
   await transitionPage.close();

   // La enciclopedia vive sobre una copia de la pantalla de origen. Al cerrarla se
   // reutiliza esa copia ya decodificada: si se repintara la portada, las carátulas
   // dejarían durante un instante su panel oscuro antes de volver a aparecer.
   const encyclopediaPage=await newPage({viewport:{width:390,height:664},isMobile:true,deviceScaleFactor:2,reducedMotion:'no-preference'});
   await encyclopediaPage.goto(url);
   await encyclopediaPage.evaluate(() => window.CONTINUUM_SPLASH?.finish());
   await encyclopediaPage.locator('.home-nav [data-action="perfil"]').click();
   await encyclopediaPage.evaluate(()=>scrollTo(0,Math.min(760,document.documentElement.scrollHeight-innerHeight)));
   await encyclopediaPage.locator('[data-action="home-encyclopedia"]').click();
   const encyclopediaModal=encyclopediaPage.locator('.enc-modal');
   const persistentBack=encyclopediaPage.locator('.enc-modal > .atlas-dialog-back');
   assert.equal(await encyclopediaPage.locator('.atlas-scroll-veil').count(),0,'no hay niebla al abrir la enciclopedia');
   const backAtTop=await persistentBack.boundingBox();
   await encyclopediaModal.evaluate(modal=>{modal.scrollTop=Math.max(20,modal.scrollHeight*.55);});
   await encyclopediaPage.waitForTimeout(50);
   await encyclopediaModal.evaluate(modal=>modal.dispatchEvent(new Event('scroll')));
   const backHalfway=await persistentBack.boundingBox();
   assert.equal(await persistentBack.evaluate(button=>getComputedStyle(button).position),'sticky','la salida de la enciclopedia queda anclada');
   assert.ok(await persistentBack.isVisible(),'la salida sigue disponible a mitad del catálogo');
   assert.ok(Math.abs(backHalfway.y-backAtTop.y)<=1,'la salida no se desplaza con las cartas');
   assert.equal(await encyclopediaPage.locator('.atlas-scroll-veil').count(),0,'hacer scroll no añade niebla sobre el catálogo');
   const backgroundImage=encyclopediaPage.locator('.enc-background img').first();
   await backgroundImage.waitFor();
   await backgroundImage.evaluate(async image=>{
     if(!image.complete) await new Promise(resolve=>image.addEventListener('load',resolve,{once:true}));
     image.__continuumCloseProbe=true;
   });
   await encyclopediaPage.locator('[data-action="enc-back"]').first().click();
   await encyclopediaPage.waitForTimeout(260);
   // Se abrió desde el Atlas: al cerrar vuelve esa misma pantalla, con sus imágenes ya decodificadas.
   const restoredImage=encyclopediaPage.locator('#app > .shell img').first();
   assert.equal(await restoredImage.evaluate(image=>image.__continuumCloseProbe===true),true,'cerrar la enciclopedia conserva el mismo nodo de imagen');
   assert.equal(await restoredImage.evaluate(image=>image.complete&&image.naturalWidth>0),true,'la carátula sigue decodificada al reaparecer');
   await encyclopediaPage.close();

   // El muelle de confirmación y el pliegue de la carta elegida: dos cosas que JSDOM no
   // ve. El botón llegó a quedarse fuera de la pantalla —`sticky` no funciona dentro de
   // `#app`, que recorta un eje y por eso es contenedor de desplazamiento— y el pliegue
   // se dibujaba como un arco dorado sobre el rótulo, por heredar la chapa del ✓.
   const duelPage=await newPage({viewport:{width:390,height:664},isMobile:true,deviceScaleFactor:2,reducedMotion:'reduce'});
   await duelPage.goto(url);
   await duelPage.evaluate(() => window.CONTINUUM_SPLASH?.finish());
   await openCollections(duelPage);
   await duelPage.locator('[data-block="naturaleza"]').click();
   await duelPage.locator('[data-mode="animals"]').click();
   // El mismo mazo, cada uno en su móvil y con las mismas cartas.
   await duelPage.evaluate(()=>window.CONTINUUM.openDeckAs('online'));
   await duelPage.locator('label:has(input[name="duel-pace"][value="seguidos"])').click();
   await duelPage.locator('[data-action="start-duel"]').click();
   await duelPage.locator('[data-action="duel-play"]').click();
   // La carta del turno va arriba, sobre la línea; se ve entera y sin el pliegue dorado.
   const selectedStyle=await duelPage.locator('.hand-solo .hand-card.selected').evaluate(el=>({
     fold:getComputedStyle(el,'::before').display,
     width:el.getBoundingClientRect().width,
     height:el.getBoundingClientRect().height
   }));
   assert.equal(selectedStyle.fold,'none','la carta de la mano no conserva el pliegue dorado');
   // En una pantalla baja la mesa encoge la carta para que quepa también la línea: legible, pero sin pasar de un cuarto del alto.
   assert.ok(selectedStyle.width>=100&&selectedStyle.height>=130&&selectedStyle.height<=664*.25,'la carta gana presencia sin dominar la pantalla');
   await duelPage.locator('[data-action="solo-place"]').first().click();
   const dockBox=await duelPage.locator('.placement-dock').boundingBox();
   const timelineBox=await duelPage.locator('.timeline-wrap').boundingBox();
   const focusBox=await duelPage.locator('.board-focus-card').boundingBox();
   assert.ok(focusBox.y+focusBox.height<=timelineBox.y+1,'la carta queda encima de la línea');
   assert.ok(dockBox.y>=timelineBox.y+timelineBox.height-1,'la confirmación queda debajo de la línea');
   assert.equal(await duelPage.locator('.placement-dock').evaluate(el=>getComputedStyle(el).position),'static','la confirmación no flota sobre el contenido');
   assert.ok(await duelPage.locator('[data-action="confirm-place"]').isVisible(),'y se puede pulsar sin desplazar');
   await duelPage.screenshot({path:`test-results/zoom/${engine}-duelo-muelle.png`});
   await duelPage.close();
   for(const [width,height] of [[375,667],[414,714],[390,844],[412,915]]) {
    const page=await newPage({viewport:{width,height},isMobile:true,deviceScaleFactor:2,reducedMotion:'reduce'});
    await page.addInitScript(()=>{
      localStorage.setItem('hilo-solo-history-v1',JSON.stringify({kind:'free',difficulty:'normal',mode:'history',day:new Date().toLocaleDateString('sv-SE'),deck:[1,2,3],timeline:[74],current:67,lives:3,hits:0,played:0,total:null,finished:false}));
    });
    await page.goto(url);
    await page.evaluate(() => window.CONTINUUM_SPLASH?.finish());
    await openCollections(page);
    await page.locator('[data-block="historia"]').click();
    await page.locator('[data-mode="history"]').click();
    if(width===414) {
      await page.locator('.atlas-landscape img, .atlas-specimens img, .walking-art').evaluateAll(`imgs=>Promise.all(imgs.map(img=>{img.loading='eager';return (${DECODIFICAR})(img);}))`);
      await page.screenshot({path:`test-results/zoom/${engine}-menu-color.png`,fullPage:true});
      await page.locator('[data-action="rules"]').click();
      const guideBack=page.locator('.rules .guide-tools > .atlas-dialog-back');
      assert.equal(await page.locator('.atlas-scroll-veil').count(),0,'la guía no lleva niebla al abrirse');
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
      assert.equal(await page.locator('.atlas-scroll-veil').count(),0,'hacer scroll en la guía no añade niebla');
      await page.locator('[data-tv-chapter="0"]').click();
      await page.locator('[data-tv="next"]').click();
      await page.locator('[data-tv="next"]').click();
      // El vídeo solo se mira: la colocación de ejemplo la hace el dedo, sin esperar a nadie.
      await page.waitForFunction(()=>document.querySelector('.tv-stage .tv-line .is-placed.is-ok'),null,{timeout:15000});
      assert.equal(await page.locator('.tv-stage button.tv-gap, .tv-stage button.tv-confirm').count(),0,'la guía en vídeo no pide jugadas');
      assert.ok(await page.locator('.tv-player').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'el vídeo cabe en el móvil');
      await page.screenshot({path:`test-results/zoom/${engine}-guia-video.png`,fullPage:true});
      await page.locator('[data-guide-chapter="02"] > summary').click();
      assert.equal(await page.locator('[data-guide-chapter][open]').count(),1);
      await page.locator('[data-guide-chapter="04"] > summary').click();
      await page.waitForFunction(()=>document.querySelectorAll('[data-guide-chapter][open]').length===1 && document.querySelector('[data-guide-chapter="04"]').open);
      assert.equal(await page.locator('.guide-pulse-table tbody tr').count(),4);
      assert.ok(await page.locator('.guide-handbook').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'la guía cabe en el móvil');
      await page.screenshot({path:`test-results/zoom/${engine}-guia-poderes.png`,fullPage:true});
      await guideBack.click();
      await page.locator('[data-settings-action="open"]').click();
      const settingsBack=page.locator('.settings-modal .settings-head > .atlas-dialog-back');
      assert.equal(await page.locator('.atlas-scroll-veil').count(),0,'ajustes no lleva niebla al abrirse');
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
      assert.equal(await page.locator('.atlas-scroll-veil').count(),0,'hacer scroll en ajustes no añade niebla');
      await page.locator('.settings-modal').evaluate(modal=>{modal.scrollTop=0;});
      await page.locator('[data-settings-action="theme"][data-value="dark"]').click();
      await page.locator('[data-settings-action="text-size"][data-value="150"]').click();
      assert.equal(await page.locator('[data-look-preview]').getAttribute('data-preview-theme'),'dark');
      assert.equal(await page.locator('html').getAttribute('data-theme'),'light','la muestra no aplica el tema antes de confirmar');
      const previewContrast=await page.locator('.look-preview-page').evaluate(el=>{
        const luminance=color=>color.match(/\d+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
        const ink=luminance(getComputedStyle(el.querySelector('h3')).color),paper=luminance(getComputedStyle(el).backgroundColor);
        return (Math.max(ink,paper)+.05)/(Math.min(ink,paper)+.05);
      });
      assert.ok(previewContrast>=4.5,'el título de la muestra oscura de Ajustes se lee con contraste suficiente');
      await page.screenshot({path:`test-results/zoom/${engine}-ajustes-muestra.png`,fullPage:true});
      await page.locator('.settings-close').click();
      await page.locator('[data-action="perfil"]').click();
      const profileBack=page.locator('#app[data-screen="perfil"] .atlas-topbar > .atlas-back');
      assert.equal(await page.locator('.atlas-profile-veil').count(),0,'el perfil no lleva niebla al abrirse');
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
      assert.equal(await page.locator('.atlas-profile-veil').count(),0,'hacer scroll en el perfil no añade niebla');
      await profileBack.click();
      await page.evaluate(()=>{
        for (const key of ['history','movies','animals','countries','languages']) {
          const card=window.CONTINUUM.cards(key).find(item=>window.CONTINUUM.cardArt(key,item));
          if(card) window.CONTINUUM.Progreso.record({mode:key,cardId:card.id,correct:true});
        }
      });
      await page.locator('.home-nav [data-action="perfil"]').click();
      await page.locator('[data-action="home-encyclopedia"]').click();
      assert.equal(await page.locator('.enc-recent-card').count(),5,'los descubrimientos abren el álbum');
      assert.ok(await page.locator('.enc-deck-cover img').count()>5,'los mazos tienen portada');
      const toolbar=await page.locator('.enc-toolbar-compact').boundingBox();
      assert.ok(toolbar.height<260,'los filtros dejan protagonismo al álbum');
      await page.locator('.enc-recent-card img, .enc-deck-cover img').evaluateAll(`imgs=>Promise.all(imgs.map(img=>{img.loading='eager';return (${DECODIFICAR})(img);}))`);
      await page.screenshot({path:`test-results/zoom/${engine}-enciclopedia-album.png`,fullPage:true});
      await page.locator('[data-action="enc-back"]').first().click();
      // La enciclopedia vuelve al Atlas: de ahí, otra vez a Jugar solo y al mazo.
      await openCollections(page);
      const historyMode=page.locator('[data-mode="history"]');
      if(!await historyMode.isVisible())await page.locator('[data-block="historia"]').click();
      await historyMode.click();
    }
    await page.locator('[data-action="resume-solo"]').click();
    await page.locator('.timeline-card img').evaluate(DECODIFICAR);
    const measure=()=>page.evaluate(()=>{
      const card=document.querySelector('.timeline-card'),img=card.querySelector('img'),panel=card.querySelector('.card-visual');
      const box=e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,top:r.top}};
      return {card:box(card),image:box(img),panel:box(panel),label:document.querySelector('.timeline-zoom output').textContent};
    });
    const base=await measure();
    assert.ok(base.card.width >= 100, 'la carta conserva un ancho legible');
    assert.ok(base.image.height >= 150, 'la ilustración conserva su altura');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'la mesa cabe sin desbordamiento horizontal');
    // El zoom se elige en el menú de la partida; aquí se pulsan los mismos niveles que ofrece.
    const zoomTo=index=>page.evaluate(i=>document.querySelector(`.timeline-zoom .zoom-menu [data-zoom-level="${i}"]`).click(),index);
    for(const [index,scale] of [.8,1,1.2].entries()) {
      await zoomTo(index);
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
      await zoomTo(1);
      const hand=page.locator('.hand-card.selected');
      await hand.scrollIntoViewIfNeeded();
      const source=await hand.boundingBox();
      const target=await page.locator('[data-action="solo-place"][data-index="1"]').boundingBox();
      await page.mouse.move(source.x+source.width/2,source.y+source.height/2);
      await page.mouse.down();
      await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:8});
      await page.locator('.drag-ghost').waitFor();
      const ghost=await page.locator('.drag-ghost').boundingBox();
      // La copia va levantada sobre el dedo: el centro del hueco de destino queda a la vista.
      const tx=target.x+target.width/2,ty=target.y+target.height/2;
      assert.ok(!(tx>ghost.x&&tx<ghost.x+ghost.width&&ty>ghost.y&&ty<ghost.y+ghost.height),'el arrastre deja visible el destino');
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
