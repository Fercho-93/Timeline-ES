// Efectos de sonido de la mesa. No hay archivos: cada sonido se sintetiza al momento con
// Web Audio, siempre en la misma escala pentatónica, así que nada desafina con nada y dos
// aciertos seguidos nunca suenan idénticos. Solo decoran: ninguna jugada depende de ellos.
// Tienen su propio contexto de audio, independiente de la música de ambience.js, y se
// duerme a los pocos segundos de silencio para no tener el audio del móvil despierto.
(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const VOLUMEN = .8, DORMIR = 4000, PAUSA_AVISOS = 900;
  let ctx = null, master = null, bus = null, send = null, ruido = null, dormir = 0;
  let racha = 0, aciertos = 0, fallos = 0, ultimoRico = -Infinity, ultimoConfirmar = -Infinity, ultimoSoplo = -Infinity;

  const prefs = () => CT.effectPrefs?.() || {};
  const activo = () => prefs().sfx === true && !document.hidden;
  const volumen = () => { const v = Math.max(0, Math.min(1, Number(prefs().sfxVolume ?? 1) || 0)); return VOLUMEN * v * v; };

  function impulso(segundos, caida) {
    const r = ctx.sampleRate, n = Math.floor(r * segundos), b = ctx.createBuffer(2, n, r);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, caida);
    }
    return b;
  }
  function audio() {
    if (!ctx) {
      const Contexto = window.AudioContext || window.webkitAudioContext;
      if (!Contexto) return null;
      ctx = new Contexto({ latencyHint: 'interactive' });
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3; comp.attack.value = .003; comp.release.value = .25;
      master = ctx.createGain(); master.gain.value = volumen();
      master.connect(comp); comp.connect(ctx.destination);
      bus = ctx.createGain(); bus.connect(master);
      // Eco de sala: una cola breve y oscura, la que da a la celesta su aire de habitación.
      const oscuro = ctx.createBiquadFilter(); oscuro.type = 'lowpass'; oscuro.frequency.value = 3800;
      const sala = ctx.createConvolver(); sala.buffer = impulso(2.1, 3.4);
      send = ctx.createGain(); send.gain.value = .9;
      send.connect(oscuro); oscuro.connect(sala); sala.connect(master);
      ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = ruido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
  }
  // Safari solo da el audio por desbloqueado si algo suena dentro del propio gesto.
  function despierta() {
    if (!activo()) return;
    try {
      if (!audio() || ctx.state === 'running') return;
      void ctx.resume().catch(() => {});
      const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); s.connect(ctx.destination); s.start(0);
    } catch { /* El siguiente gesto vuelve a intentarlo. */ }
  }
  function adormece(segundos) {
    clearTimeout(dormir);
    dormir = setTimeout(() => { if (ctx?.state === 'running') void ctx.suspend().catch(() => {}); }, DORMIR + segundos * 1000);
  }

  function salida(nodo, eco) {
    nodo.connect(bus);
    if (eco > 0) { const g = ctx.createGain(); g.gain.value = eco; nodo.connect(g); g.connect(send); }
  }
  const suelta = (...nodos) => setTimeout(() => nodos.forEach(n => n.disconnect()), 2500);

  // Re mayor pentatónica: re, mi, fa#, la, si.
  const ESCALA = [0, 2, 4, 7, 9];
  function nota(paso, base = 62) {
    const oct = Math.floor(paso / 5), grado = ((paso % 5) + 5) % 5;
    return 440 * Math.pow(2, (base + 12 * oct + ESCALA[grado] - 69) / 12);
  }
  const humano = () => Math.pow(2, (Math.random() - .5) * .008);

  // [proporción de frecuencia, amplitud, fracción de la duración]
  const TIMBRES = {
    celesta: { parciales: [[1, 1, 1], [2, .22, .6], [4, .08, .25]], ataque: .004, filtro: 6500 },
    madera: { parciales: [[1, 1, 1], [3.93, .22, .16], [9.2, .05, .05]], ataque: .002, filtro: 4200 },
    aire: { parciales: [[1, 1, 1], [2, .08, .5]], ataque: .09, filtro: 2400 }
  };
  function tono(f, t, { dur = .8, vol = .2, timbre = 'celesta', eco = .35, filtro } = {}) {
    const T = TIMBRES[timbre];
    f *= humano(); vol *= 1 + (Math.random() - .5) * .14;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = filtro || T.filtro; lp.Q.value = .3;
    const out = ctx.createGain(); out.gain.value = vol;
    lp.connect(out); salida(out, eco);
    let vivos = T.parciales.length;
    for (const [r, a, k] of T.parciales) {
      const o = ctx.createOscillator(), g = ctx.createGain(), d = dur * k;
      o.frequency.value = f * r;
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(a, t + T.ataque);
      g.gain.exponentialRampToValueAtTime(.0001, t + T.ataque + d);
      o.connect(g); g.connect(lp);
      o.start(t); o.stop(t + T.ataque + d + .05);
      o.onended = () => { g.disconnect(); if (--vivos === 0) suelta(lp, out); };
    }
  }
  function deslizar(t, { de, a, dur = .12, vol = .14, eco = .2 }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(de * humano(), t);
    o.frequency.exponentialRampToValueAtTime(a, t + dur * .8);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .006);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); salida(g, eco);
    o.start(t); o.stop(t + dur + .05);
    o.onended = () => suelta(g);
  }
  function soplo(t, { dur = .1, tipo = 'bandpass', frec = 2500, q = .8, vol = .2, ataque = .01, eco = .2 } = {}) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruido; f.type = tipo; f.Q.value = q; f.frequency.value = frec;
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); salida(g, eco);
    s.start(t, Math.random() * .8, dur + .05);
    s.onended = () => suelta(f, g);
  }
  // Papel: ruido filtrado cuyo centro recorre `frecs` (un punto cada `paso` segundos), con
  // la envolvente de volumen `vols` en los mismos instantes. Es el roce de una hoja.
  function papel(t, { frecs, vols, paso, tipo = 'bandpass', q = .9, eco = .12 }) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    const dur = paso * (vols.length - 1);
    s.buffer = ruido; f.type = tipo; f.Q.value = q;
    f.frequency.setValueAtTime(frecs[0], t);
    frecs.forEach((v, i) => i && f.frequency.exponentialRampToValueAtTime(v, t + i * paso));
    g.gain.setValueAtTime(.0001, t);
    vols.forEach((v, i) => i && g.gain.exponentialRampToValueAtTime(Math.max(.0001, v), t + i * paso));
    s.connect(f); f.connect(g); salida(g, eco);
    s.start(t, Math.random() * .5, dur + .05);
    s.onended = () => suelta(f, g);
  }
  function golpe(t, { de, a, dur, vol }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(de, t);
    o.frequency.exponentialRampToValueAtTime(a, t + dur * .7);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .004);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); salida(g, .08);
    o.start(t); o.stop(t + dur + .05);
    o.onended = () => suelta(g);
  }

  // Cada sonido devuelve cuánto dura, para no dormir el contexto a mitad de una cola.
  const S = {
    // Burbuja: la carta se levanta.
    coger(t) { deslizar(t, { de: 330, a: 560, dur: .13, vol: .14, eco: .15 }); return .2; },
    // La misma burbuja al revés: la carta vuelve a la mano.
    devolver(t) { deslizar(t, { de: 520, a: 340, dur: .12, vol: .08, eco: .1 }); return .2; },
    // Cada hueco, una nota: cuanto más a la derecha de la línea, más aguda.
    hueco(t, i) { tono(nota(i, 69), t, { dur: .32, vol: .13, eco: .25 }); return .4; },
    // Clic de madera casi imperceptible al elegir un hueco.
    elegir(t) {
      golpe(t, { de: 1500, a: 950, dur: .045, vol: .09 });
      soplo(t, { frec: 3500, q: 1.5, vol: .05, dur: .012, eco: 0 });
      return .1;
    },
    // Marimba: dos notas graves de madera a la vez.
    confirmar(t) {
      tono(nota(0, 50), t, { dur: .42, vol: .14, eco: .15, timbre: 'madera' });
      tono(nota(3, 50), t, { dur: .42, vol: .1, eco: .15, timbre: 'madera' });
      return .5;
    },
    acierto(t, n) {
      const k = Math.min(n, 8);
      tono(nota(5 + k), t, { dur: .9, vol: .2, eco: .4 });
      tono(nota(7 + k), t + .085, { dur: 1.1, vol: .2, eco: .4 });
      if (n >= 3) tono(nota(12 + k), t + .17, { dur: .9, vol: .055, eco: .6 });
      return 1.3;
    },
    // Dos notas graves y apagadas que bajan: nunca un zumbido.
    fallo(t) {
      tono(nota(2, 50), t, { dur: .55, vol: .16, filtro: 800, eco: .25 });
      tono(nota(0, 50), t + .14, { dur: .8, vol: .17, filtro: 700, eco: .25 });
      return 1;
    },
    lamina(t) {
      [10, 11, 12, 13, 14, 15].forEach((p, i) => tono(nota(p), t + i * .045, { dur: .7, vol: .065, eco: .7 }));
      soplo(t, { tipo: 'highpass', frec: 7000, vol: .03, ataque: .2, dur: .6, eco: .5 });
      return 1.1;
    },
    logro(t) {
      [0, 2, 3, 6, 8].forEach((p, i) => tono(nota(p), t + i * .06, { dur: 2.6, vol: .1, eco: .6 }));
      tono(nota(13), t + .35, { dur: 1.6, vol: .045, eco: .8 });
      return 3;
    },
    fin(t, como) {
      if (como === 'perfecta') {
        [0, 2, 3, 5, 7, 8, 10].forEach((p, i) => tono(nota(p), t + i * .075, { dur: 1.2, vol: .12, eco: .5 }));
        [5, 7, 8, 10].forEach(p => tono(nota(p), t + .6, { dur: 2.8, vol: .07, eco: .7 }));
        S.lamina(t + .75);
      } else if (como === 'buena') {
        [0, 2, 3, 5].forEach((p, i) => tono(nota(p), t + i * .09, { dur: 1.1, vol: .12, eco: .5 }));
        [0, 2, 3].forEach(p => tono(nota(p), t + .4, { dur: 2.4, vol: .085, eco: .6 }));
      } else {
        [5, 3, 2].forEach((p, i) => tono(nota(p), t + i * .12, { dur: 1, vol: .11, eco: .5 }));
        [-5, 0, 3].forEach(p => tono(nota(p), t + .42, { dur: 2.4, vol: .08, eco: .6, filtro: 1500 }));
      }
      return 3.5;
    },
    // Un tic por segundo en los tres últimos; al agotarse, una nota grave. Nunca una alarma.
    tic(t, quedan) { tono(nota(6 - quedan, 74), t, { dur: .18, vol: .08, eco: .15 }); return .3; },
    tiempo(t) { tono(nota(0, 50), t, { dur: 1.2, vol: .14, filtro: 900, eco: .4 }); return 1.3; },
    turno(t) {
      tono(nota(3, 74), t, { dur: 1.4, vol: .15, eco: .55 });
      tono(nota(5, 74), t + .16, { dur: 1.8, vol: .15, eco: .55 });
      return 2.1;
    },
    // Los toques del menú son de madera: secos, graves y sin cola, de la familia de la
    // marimba de confirmar. Se notan sin competir con los sonidos de la partida.
    // Tocar un botón del menú: un toque de madera que sube un escalón de la escala cada vez que se
    // avanza, de grave a agudo (ver `escalon`). Tras unos segundos sin tocar nada, vuelve al grave.
    pagina(t) { tono(nota(sube(), BASE_MENU), t, { dur: .18, vol: .1, eco: .08, timbre: 'madera' }); return .3; },
    // Volver atrás: siempre este mismo toque grave, el de Atlas, y solo en los botones de volver.
    // Baja un escalón la escala del menú, para que lo siguiente que se avance retome desde ahí.
    vuelta(t) { escalon = Math.max(0, escalon - 1); tono(nota(0, 50), t, { dur: .22, vol: .13, eco: .08, timbre: 'madera' }); return .3; },
    // Deslizar para volver: una hoja de libro que se pasa. El roce sube de tono al
    // levantarla, la hoja cruza en el aire con un crujido fino y cae con un golpe blando
    // de papel. Cada vez un poco distinta, como una hoja de verdad.
    hoja(t) {
      escalon = Math.max(0, escalon - 1);
      const v = 1 + (Math.random() - .5) * .16, k = humano() * (1 + (Math.random() - .5) * .1);
      papel(t, { frecs: [700 * k, 1900 * k, 3400 * k, 2300 * k, 1500 * k], vols: [0, .055 * v, .1 * v, .07 * v, .0001], paso: .065, q: .8 });
      for (let i = 0; i < 4; i++) {
        soplo(t + .04 + i * .045 + Math.random() * .02, { tipo: 'highpass', frec: 5200 + Math.random() * 1800, q: .7, vol: (.016 + Math.random() * .012) * v, ataque: .003, dur: .014, eco: .05 });
      }
      papel(t + .23, { frecs: [900 * k, 380 * k], vols: [0, .08 * v, .0001], paso: .045, tipo: 'lowpass', q: .5, eco: .18 });
      return .5;
    },
    // Desplegar una colección: dos toques que suben (y avanzan la escala); plegarla, los mismos al revés.
    despliegue(t) {
      const p = sube();
      tono(nota(p, BASE_MENU), t, { dur: .2, vol: .1, eco: .1, timbre: 'madera' });
      tono(nota(p + 2, BASE_MENU), t + .07, { dur: .22, vol: .11, eco: .12, timbre: 'madera' });
      return .4;
    },
    pliegue(t) {
      const p = Math.max(0, escalon - 1); escalon = p;
      tono(nota(p + 2, BASE_MENU), t, { dur: .2, vol: .1, eco: .08, timbre: 'madera' });
      tono(nota(p, BASE_MENU), t + .07, { dur: .22, vol: .09, eco: .1, timbre: 'madera' });
      return .4;
    },
    // Un poder (Fantasma o Pulso): un brillo que sube y se queda flotando.
    poder(t) {
      [7, 9, 10, 12, 14].forEach((p, i) => tono(nota(p), t + i * .05, { dur: 1, vol: .06, eco: .8 }));
      soplo(t, { tipo: 'bandpass', frec: 2400, vol: .03, ataque: .15, dur: .8, eco: .6 });
      return 1.4;
    },
    // Plantarse y asegurar los aciertos: tres notas que suben y se quedan, como guardar algo.
    asegurar(t) {
      [0, 2, 4].forEach((p, i) => tono(nota(p, 62), t + i * .07, { dur: .5, vol: .11, eco: .3, timbre: 'madera' }));
      tono(nota(7, 62), t + .21, { dur: 1.2, vol: .09, eco: .5 });
      return 1.4;
    },
    // Soplo: dos notas que entran despacio, para pasar de página y para los avisos.
    soplo(t) {
      tono(nota(3), t, { dur: .55, vol: .05, eco: .5, timbre: 'aire' });
      tono(nota(5), t, { dur: .55, vol: .04, eco: .5, timbre: 'aire' });
      return .7;
    }
  };

  // La escala del menú: cada botón que se pulsa para avanzar suena un escalón más agudo que el anterior
  // (de la escala pentatónica, dos octavas) y se queda arriba; volver baja un escalón y el botón de
  // Inicio la devuelve al grave. No se reinicia con el tiempo: leer una pantalla sin tocar nada no
  // debe devolver los toques al grave.
  const BASE_MENU = 55, ESCALON_MAX = 9;
  let escalon = 0;
  function sube() {
    const actual = escalon;
    escalon = Math.min(ESCALON_MAX, escalon + 1);
    return actual;
  }
  const ultimo = {};
  let ultimoSonido = -Infinity, ultimoAtras = -Infinity;
  function suena(nombre, retraso = 0, ...args) {
    if (!activo()) return null;
    // Una misma acción puede avisar dos veces (soltar una carta lo cuenta el arrastre y
    // también el repintado): el segundo aviso, casi simultáneo, no se oye.
    const t0 = ahora();
    if (!['hueco', 'tic'].includes(nombre) && t0 - (ultimo[nombre] ?? -Infinity) < 200) return null;
    ultimo[nombre] = t0;
    ultimoSonido = t0;
    try {
      if (!audio()) return null;
      if (ctx.state !== 'running') void ctx.resume().catch(() => {});
      master.gain.value = volumen();
      const t = ctx.currentTime + .015 + retraso;
      adormece(retraso + S[nombre](t, ...args));
      return t;
    } catch { return null; /* Un efecto opcional nunca impide jugar. */ }
  }
  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const rico = () => { ultimoRico = ahora(); };

  function result(correct) {
    // La marimba de confirmar ya ha sonado si la jugada se confirmó con un toque; si no
    // (una cifra, una jugada que llega por la red), suena aquí, justo antes del resultado.
    const sinConfirmar = ahora() - ultimoConfirmar > 1500;
    if (sinConfirmar) suena('confirmar');
    const retraso = sinConfirmar ? .16 : Math.max(0, .16 - (ahora() - ultimoConfirmar) / 1000);
    if (correct) { suena('acierto', retraso, racha); racha++; aciertos++; }
    else { suena('fallo', retraso); racha = 0; fallos++; }
    rico();
  }
  function confirm() { ultimoConfirmar = ahora(); suena('confirmar'); }
  function discovery() { suena('lamina', .62); rico(); }
  function achievement() { suena('logro', 1); rico(); }
  function clock(quedan) { if (quedan > 0) suena('tic', 0, quedan); else suena('tiempo'); }

  function cue(kind, info) {
    switch (kind) {
      case 'lift': suena('coger'); break;
      // Soltar una carta en un hueco la deja elegida: esa selección no es levantarla otra vez.
      case 'select': if (ahora() - (ultimo.elegir ?? -Infinity) > 400) suena('coger'); break;
      case 'return': suena('devolver'); break;
      case 'place': suena('elegir'); break;
      case 'hover': {
        const total = Math.max(1, Number(info?.total) - 1 || 1), i = Number(info?.index) || 0;
        suena('hueco', 0, Math.round(Math.min(1, i / total) * 9));
        break;
      }
      case 'turn': suena('turno'); rico(); break;
      case 'end': {
        const como = !fallos && aciertos ? 'perfecta' : aciertos >= fallos ? 'buena' : 'floja';
        suena('fin', .1, como); rico();
        racha = 0; aciertos = 0; fallos = 0;
        break;
      }
      // Volver atrás y desplegar o plegar una colección tienen voz propia: son toques
      // deliberados y tienen que oírse, no insinuarse como el pasar de página.
      // Volver atrás suena solo al pulsar un botón de volver, y siempre igual (deslizar para volver suena a hoja: `hoja`).
      // Un cambio de pantalla "hacia atrás" provocado por otra cosa es un toque de menú más.
      case 'back': {
        racha = 0; aciertos = 0; fallos = 0;
        if (ahora() - ultimoAtras < 1500) { ultimoSoplo = ahora(); break; }
        suena('pagina'); ultimoSoplo = ahora();
        break;
      }
      case 'unroll': suena('despliegue'); ultimoSoplo = ahora(); break;
      case 'fold': suena('pliegue'); break;
      case 'bank': suena('asegurar'); rico(); break;
      case 'power': suena('poder'); rico(); break;
      case 'page': case 'open': case 'notice': {
        // Tras un acierto, un logro o un turno, el diálogo o el aviso que llega detrás no
        // pisa la cola; y una pantalla que abre un diálogo a la vez suena una sola vez.
        const t = ahora();
        if (t - ultimoRico < PAUSA_AVISOS || t - ultimoSoplo < 250) break;
        ultimoSoplo = t;
        // Cambiar de pantalla o abrir un panel es un toque de madera; un aviso, que no
        // responde a un toque, conserva su soplo discreto.
        suena(kind === 'notice' ? 'soplo' : 'pagina');
        break;
      }
      // deal, flip, close, expand, zoom: en silencio, ya se ven.
    }
  }

  for (const evento of ['pointerdown', 'touchstart', 'keydown']) document.addEventListener(evento, despierta, { capture: true, passive: true });
  // Todo botón suena: si el toque no ha provocado ningún sonido propio (cambiar de pantalla, abrir un
  // panel, elegir una carta…) en los 90 ms siguientes, se oye el toque de madera de menú. Así ningún
  // botón queda mudo y ninguno suena dos veces.
  // Los botones de volver: la flecha de la cabecera (todas las mesas y salas) y los de volver de cada pantalla.
  const VOLVER = '.atlas-back, .turn-duel-back, [aria-label^="Volver"], [data-action="ui-back"], [data-action="collection-back"], [data-action="back-menu"], [data-online-action="back"], [data-online-action="back-from-timeline"], [data-turn-action="back"], [data-action="public-match-back"], [data-action="enc-back"], [data-action="enc-card-close"]';
  function atras() {
    ultimoAtras = ahora(); ultimoSoplo = ultimoAtras;
    racha = 0; aciertos = 0; fallos = 0;
    suena('vuelta');
  }
  // Deslizar el dedo para volver no es pulsar un botón: suena a pasar una hoja. El gesto
  // pulsa después la flecha de la pantalla, y ese clic ya no suena otra vez.
  let ultimoGesto = -Infinity;
  function hoja() {
    ultimoGesto = ultimoAtras = ultimoSoplo = ahora();
    racha = 0; aciertos = 0; fallos = 0;
    suena('hoja');
  }
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-action="home-top"], [data-action="home"]')) escalon = 0;
    const el = event.target.closest?.(VOLVER);
    if (el && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && ahora() - ultimoGesto > 800) atras();
  }, true);
  const TOCABLE = 'button, a[href], summary, [role="button"], [role="radio"], [role="tab"], [data-action], [data-quick], [data-online-action], [data-local-action], [data-turn-action], [data-account-action], [data-settings-action]';
  document.addEventListener('click', event => {
    const el = event.target.closest?.(TOCABLE);
    if (!el || el.matches(VOLVER) || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('[inert]')) return;
    const t0 = ahora();
    setTimeout(() => {
      if (ultimoSonido >= t0 || !activo()) return;
      // Los diálogos y avisos que llegan detrás de un acierto o un logro no pisan su cola.
      if (ahora() - ultimoRico < PAUSA_AVISOS) return;
      ultimoSoplo = ahora();
      suena('pagina');
    }, 90);
  }, true);
  document.addEventListener('click', event => {
    const confirmar = event.target.closest?.('[data-action="confirm-place"], [data-online-action="confirm-place"], [data-turn-action="confirm-place"], [data-quick="confirm"], [data-local-action="confirm-place"], [data-local-action="confirm-pulse"], [data-local-action="confirm-defense"], [data-online-action="confirm-pulse"], [data-online-action="confirm-defense"]');
    if (confirmar && !confirmar.disabled) confirm();
  }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden && ctx?.state === 'running') void ctx.suspend().catch(() => {}); });

  CT.Sonidos = {
    cue, result, confirm, discovery, achievement, clock, atras, hoja,
    // La prueba de Ajustes: un acierto, para oír el volumen elegido.
    test() { if (master) master.gain.value = volumen(); suena('acierto', 0, 0); }
  };
})();
