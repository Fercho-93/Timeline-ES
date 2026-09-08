import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const read = name => fs.readFileSync(new URL('../'+name, import.meta.url), 'utf8');
const html = read('index.html');
const w = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/g, ''), {runScripts:'outside-only', url:'https://continuum.test/'}).window;
w.scrollTo = () => {};
const calls = [];
w.Capacitor = {isNativePlatform:()=>true, registerPlugin:()=>({notification: async value=>calls.push(value.type), impact:async value=>calls.push(value.style)})};
for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(read(m[1]));
try {
  const CT = w.CONTINUUM;
  CT.Effects.feedback(true); assert.equal(calls.length,0);
  CT.effectPrefs = () => ({haptics:true,sound:true});
  w.AudioContext = function () { throw Error('Audio no disponible'); };
  CT.Effects.feedback(true); CT.Effects.feedback(false);
  await Promise.resolve(); assert.deepEqual(calls,['SUCCESS','WARNING']);
  const confirm=w.document.createElement('button'); confirm.dataset.action='confirm-place'; w.document.body.append(confirm); confirm.click();
  await Promise.resolve(); assert.equal(calls.at(-1),'LIGHT');
  const outer=w.document.createElement('div'); outer.className='overlay'; outer.innerHTML='<div class="modal"><h2>Resultado</h2>'+CT.Art.button('history',CT.cards('history')[0])+'<button data-dialog-focus>Continuar</button></div>';
  w.document.getElementById('app').append(outer); CT.openDialog(outer);
  assert.equal(w.document.activeElement.textContent,'Continuar');
  const art=outer.querySelector('[data-art-src]'); art.focus(); art.click();
  assert.ok(w.document.querySelector('.art-modal img'));
  w.document.querySelector('[data-art-close]').click();
  assert.equal(w.document.activeElement,art);
  assert.ok(outer.isConnected);
  console.log('Efectos opcionales, fallo de audio y ampliación con retorno de foco: OK');
} finally { w.close(); }
