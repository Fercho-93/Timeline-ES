import {gameHtml} from './game-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read = f => fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html = gameHtml(read('index.html'));
function boot(reduce = true) {
  const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g,''), {runScripts:'outside-only',url:'https://continuum.test',pretendToBeVisual:true}).window;
  w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {}; w.matchMedia = () => ({matches:reduce});
  for (const match of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(match[1]));
  return w;
}
const click = (w,s) => {const el=w.document.querySelector(s);assert.ok(el,s);el.click();};
const screen = w => w.document.querySelector('#app').dataset.screen;
{
  const w = boot();
  try {
    const titulo = w.document.querySelector('.home-masthead:not(.splash-masthead) .home-wordmark');
    assert.equal(titulo?.textContent.trim(), 'Continuum', 'el título principal sigue siendo texto legible');
    const css = read('styles.css');
    assert.match(css, /\.home-masthead:not\(\.splash-masthead\) \.home-wordmark\s*\{[^}]*max-width:\s*100%/s,
      'el relieve se limita a Inicio y conserva el encaje en móvil');
    assert.match(css, /\.home-masthead:not\(\.splash-masthead\) \.home-wordmark\s*\{[^}]*color:\s*var\(--ink\)[^}]*text-shadow:[^}]*var\(--paper\)[^}]*var\(--accent-dark\)/s,
      'el título obtiene contraste y relieve desde la paleta de cada tema');
  } finally {w.close();}
}
{
  const w=boot();
  try {
    click(w,'[data-block="naturaleza"]');click(w,'[data-mode="animals"]');
    assert.equal(w.document.querySelectorAll('.atlas-specimens figure').length,3);
    assert.equal(w.document.querySelectorAll('.home-nav button').length,5);
    assert.ok(w.document.querySelector('.home-nav [data-action="rules"]'));
    assert.equal(w.document.querySelector('.topbar [data-action="rules"]'),null);
    click(w,'[data-format="multi"]');click(w,'[data-action="setup"]');
    w.document.querySelector('#hand-size').value='4';click(w,'[data-action="start"]');click(w,'[data-action="ready"]');
    assert.equal(w.document.querySelectorAll('.hand-card').length,4);
    assert.equal(w.document.querySelector('.home-nav'),null);
    assert.equal(w.document.querySelectorAll('.topbar button').length,2);
    click(w,'.hand-card');click(w,'.slot');
    const selected=w.document.querySelector('.hand-card.selected').dataset.id;
    assert.equal(w.document.querySelectorAll('[data-action="confirm-place"]').length,1);
    assert.ok(w.document.querySelector('.placement-dock [data-action="confirm-place"]'));
    assert.equal(w.document.querySelector('.placement-dock-status strong').textContent,'Posición elegida');
    assert.equal(w.document.querySelector('.placement-dock-actions [data-action="cancel-place"]').textContent,'Cambiar');
    const timelineSection=w.document.querySelector('.timeline-wrap').closest('section');
    assert.equal(timelineSection.nextElementSibling.className,'placement-dock');
    assert.ok(timelineSection.nextElementSibling.nextElementSibling.classList.contains('atlas-hand-section'));
    assert.equal(w.document.querySelector('.slot-confirm button'),null);
    const zoom=w.document.querySelector('[data-timeline-range]');zoom.value='0';zoom.dispatchEvent(new w.Event('input',{bubbles:true}));
    assert.equal(w.document.querySelector('.timeline-zoom output').textContent,'80%');
    assert.equal(w.document.querySelector('.hand-card.selected').dataset.id,selected);
    const saved=w.localStorage.getItem('hilo-game-animals-v1');
    click(w,'[data-action="ui-back"]');assert.ok(w.document.querySelector('[data-exit-dialog]'));
    click(w,'[data-exit-stay]');assert.equal(screen(w),'game');assert.equal(w.localStorage.getItem('hilo-game-animals-v1'),saved);
    click(w,'[data-action="ui-back"]');click(w,'[data-exit-confirm]');assert.equal(screen(w),'setup');
    assert.ok(w.localStorage.getItem('hilo-game-animals-v1'));
    click(w,'[data-action="back-menu"]');click(w,'[data-action="continue"]');click(w,'[data-action="ready"]');
    assert.equal(w.document.querySelectorAll('.hand-card').length,4);
  } finally {w.close();}
}
{
  const w=boot();
  try {
    // Real online rendering with an inert SDK: no server calls are made by UI navigation.
    w.eval(`(() => {
      const initializeApp=()=>({}),getAuth=()=>({}),getFirestore=()=>({});
      ${read('online.js').replace(/^import .*;$/gm,'').replace('export async function','async function')}
      const ids=CT.cards('animals').map(c=>c.id);
      user={uid:'fer'};selectedModeKey='animals';roomCode='ABCD2345';roomRef={};
      roomState={mode:'animals',status:'playing',phase:'turn',players:{fer:{name:'Fer',hand:ids.slice(1,5)},ana:{name:'Ana',hand:ids.slice(5,9)}},playerOrder:['fer','ana'],current:0,hostUid:'ana',timeline:[ids[0]],deck:ids.slice(9),discard:[],round:1,turnsInRound:0,turnSeconds:0,version:1};
      CT.onlineActive=true; window.detachCount=0;unsubscribeRoom=()=>window.detachCount++;
      renderGame();
    })()`);
    assert.equal(screen(w),'online-game');
    assert.equal(w.document.querySelectorAll('.home-nav').length,0);
    click(w,'[data-online-action="select"]');click(w,'[data-online-action="place"]');
    assert.ok(w.document.querySelector('.placement-dock [data-online-action="confirm-place"]'));
    click(w,'[data-online-action="room"]');assert.ok(w.document.querySelector('[data-online-action="guide"]'));
    click(w,'[data-online-action="close-room-menu"]');
    click(w,'[data-online-action="back"]');click(w,'[data-exit-stay]');assert.equal(screen(w),'online-game');assert.equal(w.detachCount,0);
    click(w,'[data-online-action="back"]');click(w,'[data-exit-confirm]');
    assert.equal(screen(w),'online-entry');assert.equal(w.detachCount,1);
    assert.equal(w.document.querySelector('#online-code').value,'ABCD2345');
    assert.equal(w.document.querySelectorAll('.home-nav button').length,5);
    click(w,'.home-nav [data-action="home-top"]');assert.equal(screen(w),'home');
  } finally {w.close();}
}
{
  const w=boot();
  try {
    assert.deepEqual(JSON.parse(JSON.stringify(w.CONTINUUM.effectPrefs())),{sound:false,haptics:false,ambience:false,depth:false});
    click(w,'[data-settings-action="open"]');
    assert.equal(w.document.querySelectorAll('.home-nav').length,1);
    assert.ok(w.document.querySelector('.settings-modal .home-nav'));
    w.DeviceOrientationEvent={requestPermission:async()=> 'denied'};
    const depth=w.document.querySelector('[data-settings-action="depth"]');depth.checked=true;depth.dispatchEvent(new w.Event('change',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(w.CONTINUUM.effectPrefs().depth,false);assert.equal(depth.checked,false);
    click(w,'[data-settings-action="close"]');
    assert.ok(w.document.querySelector('.shell > .home-nav'));
  } finally {w.close();}
}
// La profundidad se escribe en cada aviso del giroscopio, que en un móvil en la mano
// llega a ser sesenta veces por segundo. Poner esas variables en la portada obligaba al
// navegador a recalcular el estilo de todo lo que cuelga de ella —fondo, dibujo, rótulo,
// índice, lámina— y no solo el de la capa que se mueve. Ahora van declaradas sin herencia
// (@property en edition.css) y se escriben capa por capa, que es lo que lo evita. Las dos
// mitades tienen que ir juntas: con la declaración sin la escritura en las capas, el
// efecto se apagaría en silencio.
{
  const css = read('edition.css');
  for (const [nombre, tipo] of [['--depth-x','<length>'],['--depth-y','<length>'],['--scene-scroll','<length>'],['--cover-rx','<angle>'],['--cover-ry','<angle>']]) {
    const regla = new RegExp(`@property ${nombre} \\{[^}]*syntax: '${tipo}'[^}]*inherits: false`);
    assert.ok(regla.test(css), `${nombre} se declara como ${tipo} y sin heredarse`);
  }
}
{
  // Sin preferencia de movimiento reducido: con ella la profundidad no se enciende, y el
  // valor tiene que estar puesto antes de que se carguen los guiones porque alguno lo
  // consulta al arrancar.
  const w = boot(false);
  try {
    w.DeviceOrientationEvent = {requestPermission: async () => 'granted'};
    click(w,'[data-settings-action="open"]');
    const depth = w.document.querySelector('[data-settings-action="depth"]');
    depth.checked = true; depth.dispatchEvent(new w.Event('change',{bubbles:true}));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(w.CONTINUUM.effectPrefs().depth, true, 'con permiso concedido, la profundidad queda encendida');
    click(w,'[data-settings-action="close"]');
    // Cerrar los ajustes repinta la portada y vuelve a conectar el sensor en el turno
    // siguiente: hasta que eso pasa no hay a quién escribirle.
    await new Promise(resolve => setTimeout(resolve, 20));

    const inclina = (beta, gamma) => {
      const event = new w.Event('deviceorientation');
      Object.defineProperties(event, {beta:{value:beta}, gamma:{value:gamma}});
      w.dispatchEvent(event);
    };
    inclina(0, 0);            // la primera lectura fija el origen
    inclina(9, 9);            // media inclinación en los dos ejes
    await new Promise(resolve => setTimeout(resolve, 40));   // el frame que escribe

    const panel = w.document.querySelector('#app .gallery-panel');
    assert.ok(panel, 'hay portadas en la galería');
    const capas = [...panel.querySelectorAll('.panel-backdrop img, .panel-art img')];
    assert.ok(capas.length >= 2, 'la portada trae su fondo y su dibujo');
    for (const capa of capas) assert.ok(capa.style.getPropertyValue('--depth-x'), 'cada capa recibe su propia profundidad');
    // Lo que de verdad protege este bloque: si alguien devuelve la escritura a la portada,
    // las variables ya no bajan solas hasta las capas y el efecto se apaga sin avisar.
    assert.equal(panel.style.getPropertyValue('--depth-x'), '', 'la profundidad no se escribe en la portada, que arrastraría a todo su contenido');
    assert.ok(panel.style.getPropertyValue('--cover-rx'), 'el giro sí lo usa la portada en su propia regla y ahí se queda');

    // Un aviso que no mueve el móvil no vuelve a escribir: con el teléfono sobre la mesa
    // el sensor sigue avisando igual.
    const antes = capas[0].style.getPropertyValue('--depth-x');
    capas[0].style.setProperty('--depth-x', antes);   // el mismo valor no cuenta como cambio
    inclina(9, 9);
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(capas[0].style.getPropertyValue('--depth-x'), antes, 'una lectura repetida deja el valor donde estaba');

    // Y al apagar el efecto no queda rastro ni arriba ni abajo.
    click(w,'[data-settings-action="open"]');
    const otra = w.document.querySelector('[data-settings-action="depth"]');
    otra.checked = false; otra.dispatchEvent(new w.Event('change',{bubbles:true}));
    await new Promise(resolve => setTimeout(resolve, 0));
    const panelTras = w.document.querySelector('#app .gallery-panel') || panel;
    assert.equal(panelTras.style.getPropertyValue('--cover-rx'), '', 'apagar el efecto limpia el giro de la portada');
    for (const capa of panelTras.querySelectorAll('.panel-backdrop img, .panel-art img'))
      assert.equal(capa.style.getPropertyValue('--depth-x'), '', 'y la profundidad de cada capa');
  } finally {w.close();}
}
console.log('Profundidad: variables sin herencia, escritas capa por capa, sin repetir lecturas y limpias al apagarse: OK');
console.log('Atlas: muestras, navegación, confirmación única, zoom, guardado, salida online y permisos opcionales: OK');
