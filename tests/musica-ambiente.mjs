import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

function boot({native = false, delayed = false, failOnce = false, random = .5} = {}) {
  const w = new JSDOM('<div id="app"></div>', {runScripts: 'outside-only', pretendToBeVisual: true}).window;
  let enabled = false, nativeListener, resolveFetch, requests = [], contexts = [], pendingTimers = new Map(), timerId = 0;
  w.Math.random = typeof random === 'function' ? random : () => random;
  w.setTimeout = callback => { pendingTimers.set(++timerId, callback); return timerId; };
  w.clearTimeout = id => pendingTimers.delete(id);
  const node = () => ({connect(target) {this.target = target;}, disconnect() {this.disconnected = true;}});
  class Param {
    events = [];
    constructor(ctx) {this.ctx = ctx;}
    get value() {return this.at(this.ctx.currentTime);}
    at(time) {
      let prev = {time: 0, value: 1};
      for (const event of this.events) {
        if (event.time > time) return event.type === 'ramp' ? prev.value + (event.value - prev.value) * (time - prev.time) / (event.time - prev.time) : prev.value;
        prev = event;
      }
      return prev.value;
    }
    setValueAtTime(value, time) {this.events.push({value, time, type: 'set'}); this.events.sort((a,b) => a.time-b.time);}
    linearRampToValueAtTime(value, time) {this.events.push({value, time, type: 'ramp'}); this.events.sort((a,b) => a.time-b.time);}
    cancelScheduledValues(time) {this.events = this.events.filter(event => event.time < time);}
    cancelAndHoldAtTime(time) {const value = this.at(time); this.cancelScheduledValues(time); this.setValueAtTime(value, time);}
  }
  class AudioMock {
    state = 'suspended'; currentTime = 0; destination = {}; sources = []; gains = [];
    constructor() {contexts.push(this);}
    async resume() {this.state = 'running';}
    async suspend() {this.state = 'suspended';}
    async decodeAudioData(path) {return {path, duration: 30};}
    createGain() {const gain = {...node(), gain: new Param(this)}; this.gains.push(gain); return gain;}
    createBufferSource() {
      const source = {...node(), start(time) {this.startTime = time; this.path = this.buffer.path; this.duration = this.buffer.duration;}, ended: false};
      this.sources.push(source); return source;
    }
    async advance(seconds) {
      if (this.state !== 'running') return;
      const target = this.currentTime + seconds;
      while (true) {
        const source = this.sources.filter(s => !s.ended && s.startTime + s.duration <= target).sort((a,b) => a.startTime-b.startTime)[0];
        if (!source) break;
        this.currentTime = source.startTime + source.duration;
        source.ended = true; source.onended?.(); await settle();
      }
      this.currentTime = target;
    }
  }
  w.AudioContext = AudioMock;
  w.fetch = async path => {
    requests.push(path);
    if (delayed) {delayed = false; await new Promise(resolve => {resolveFetch = resolve;});}
    if (failOnce) {failOnce = false; return {ok:false};}
    return {ok: true, arrayBuffer: async () => path};
  };
  w.CONTINUUM = {effectPrefs: () => ({ambience:enabled})};
  if (native) w.Capacitor = {isNativePlatform: () => true, registerPlugin: () => ({addListener: async (name, callback) => {assert.equal(name, 'appStateChange'); nativeListener = callback;}})};
  w.eval(read('ambience.js'));
  return {
    w, contexts, requests,
    enable(value) {enabled = value; w.CONTINUUM.Ambience.sync(true);},
    click() {w.document.body.click();},
    hidden(value) {Object.defineProperty(w.document, 'hidden', {configurable:true, value}); w.document.dispatchEvent(new w.Event('visibilitychange'));},
    native(value) {nativeListener({isActive:value});},
    resolve() {resolveFetch();},
    timers() {const callbacks = [...pendingTimers.values()]; pendingTimers.clear(); callbacks.forEach(callback => callback());}
  };
}

{
  const h = boot();
  try {
    h.click(); await settle(); assert.equal(h.requests.length, 0, 'no descarga música con el ajuste apagado');
    assert.equal(h.contexts.length, 0);
    h.enable(true); await settle();
    const ctx = h.contexts[0];
    assert.equal(h.contexts.length, 1);
    assert.equal(ctx.sources.length, 2, 'precarga solo actual y siguiente');
    const first = ctx.sources[0], second = ctx.sources[1];
    assert.equal(second.startTime, first.startTime + first.duration - 4, 'solapamiento exacto de cuatro segundos');
    assert.equal(first.target.gain.at(28), .5, 'la canción anterior sale progresivamente');
    assert.equal(second.target.gain.at(28), .5, 'la siguiente entra progresivamente');
    assert.equal(ctx.gains[0].gain.at(3), .12, 'volumen bajo');
    await ctx.advance(28);
    const position = ctx.currentTime, schedule = ctx.sources.map(s => s.startTime);
    h.hidden(true); await settle();
    assert.equal(ctx.state, 'suspended'); await ctx.advance(120);
    assert.equal(ctx.currentTime, position, 'pausar congela las dos pistas en pleno fundido');
    h.hidden(false); await settle();
    assert.equal(ctx.state, 'running'); assert.equal(ctx.currentTime, position);
    assert.deepEqual(ctx.sources.map(s => s.startTime), schedule, 'reanuda las mismas fuentes y rampas');
    for (let i=0;i<10;i++) h.click(); await settle();
    assert.equal(ctx.sources.length, 2, 'navegar no duplica ni reinicia la música');
    await ctx.advance(340);
    const paths = ctx.sources.map(s => s.path);
    assert.ok(paths.length >= 12);
    for (let i=0;i+6<=paths.length;i+=6) assert.equal(new Set(paths.slice(i,i+6)).size, 6, 'cada ciclo reproduce las seis sin repetir');
    assert.notEqual(paths[5], paths[6], 'el nuevo ciclo nunca repite la última');
    assert.notEqual(paths[11], paths[12]);
    assert.ok(ctx.sources.filter(s => !s.ended).length <= 2, 'memoria limitada a dos pistas');
    assert.ok(ctx.sources.filter(s => s.ended).every(s => s.buffer === null && s.disconnected), 'libera el audio ya reproducido');
    h.enable(false); await settle();
    assert.equal(ctx.state, 'running', 'apagado permite terminar la salida suave');
    await ctx.advance(.3); h.timers(); await settle(); assert.equal(ctx.state, 'suspended');
    const paused = ctx.currentTime;
    h.enable(true); await settle(); assert.equal(ctx.currentTime, paused, 'el interruptor conserva la posición');
    h.w.dispatchEvent(new h.w.Event('pagehide')); await settle(); assert.equal(ctx.state, 'suspended');
    h.click(); await settle(); assert.equal(ctx.state, 'suspended');
    h.w.dispatchEvent(new h.w.Event('pageshow')); await settle(); assert.equal(ctx.state, 'running');
  } finally {h.w.close();}
}

{
  const a = boot({random: .1}), b = boot({random: .9});
  try {a.enable(true); b.enable(true); await settle(); assert.notEqual(a.requests[0], b.requests[0], 'sesiones nuevas pueden comenzar por distintas canciones');}
  finally {a.w.close(); b.w.close();}
}
{
  // La segunda baraja intentaría comenzar por v6, la última de la primera.
  const values = [.999,.999,.999,.999,.999, 0,.999,.999,.999,.999];
  const h = boot({random: () => values.shift() ?? .5});
  try {
    h.enable(true); await settle(); await h.contexts[0].advance(160);
    const paths = h.contexts[0].sources.map(s => s.path);
    assert.equal(paths[5], 'assets/audio/v6.mp3');
    assert.notEqual(paths[6], paths[5], 'corrige una repetición en el límite entre barajas');
  } finally {h.w.close();}
}
{
  const h = boot({native:true});
  try {
    h.enable(true); await settle(); const ctx = h.contexts[0]; await ctx.advance(12);
    h.native(false); await settle(); assert.equal(ctx.state,'suspended');
    h.hidden(false); await settle(); assert.equal(ctx.state,'suspended', 'visibilidad web no contradice segundo plano nativo');
    h.native(true); await settle(); assert.equal(ctx.state,'running'); assert.equal(ctx.currentTime,12);
  } finally {h.w.close();}
}
{
  const h = boot({delayed:true});
  try {
    h.enable(true); await settle(); h.hidden(true); await settle(); h.resolve(); await settle();
    const ctx = h.contexts[0]; assert.equal(ctx.state,'suspended', 'descarga tardía no arranca en segundo plano');
    assert.equal(ctx.sources.length,1); h.hidden(false); await settle(); assert.equal(ctx.sources.length,2);
    h.enable(false); h.enable(true); h.enable(false); h.timers(); await settle(); assert.equal(ctx.state,'suspended', 'la última intención gana al alternar rápidamente');
    h.enable(true); await settle(); assert.equal(ctx.state,'running');
  } finally {h.w.close();}
}
{
  const h = boot({failOnce:true});
  try {
    h.enable(true); await settle(); assert.equal(h.contexts[0].sources.length,0);
    h.click(); await settle(); assert.equal(h.requests[0],h.requests[1], 'el fallo no salta la canción');
    assert.equal(h.contexts[0].sources.length,2, 'un gesto reintenta la descarga');
  } finally {h.w.close();}
}

const sw = read('service-worker.js');
for (let i=1;i<=6;i++) {
  assert.ok(fs.statSync(new URL(`../assets/audio/v${i}.mp3`, import.meta.url)).size > 100000);
  assert.ok(sw.includes(`"./assets/audio/v${i}.mp3"`), 'todas las canciones se conservan sin conexión');
}
assert.ok(read('index.html').indexOf('ambience.js') < read('index.html').indexOf('immersion.js'));
console.log('Música: seis pistas, barajado, cuatro segundos de fundido, pausa exacta, ciclo móvil, reintentos y caché: OK');
