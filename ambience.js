// Música de sesión. Su reloj es independiente del de los efectos de las cartas.
(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const TRACKS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map(name => `assets/audio/${name}.mp3`);
  const OVERLAP = 4, VOLUME = .12, FADE_IN = 2.2, FADE_OUT = .3;
  let userVolume = 1;
  let queue = [], last = null, audio, master, loading = false, ready = null;
  let pageActive = true, nativeActive = true, startRequested = false, pauseTimer;
  let transport = Promise.resolve(), targetVolume = 0;
  const voices = new Set();
  const enabled = () => CT.effectPrefs?.().ambience === true && pageActive && nativeActive && !document.hidden;
  const outputVolume = () => VOLUME * Math.max(0, Math.min(1, Number(CT.effectPrefs?.().ambienceVolume ?? userVolume) || 0));

  function refill() {
    queue = [...TRACKS];
    for (let i = queue.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    if (queue[0] === last) [queue[0], queue[1]] = [queue[1], queue[0]];
  }
  refill(); // Una baraja nueva por sesión; los cambios de pantalla no la alteran.

  function context() {
    if (!audio) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return null;
      audio = new Audio();
      master = audio.createGain();
      master.gain.setValueAtTime(0, audio.currentTime);
      master.connect(audio.destination);
    }
    return audio;
  }

  function fadeMaster(value, duration) {
    targetVolume = value;
    const gain = master.gain, now = audio.currentTime;
    // Conservar el nivel actual evita saltos al pulsar el interruptor rápidamente.
    if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(now);
    else {
      const current = gain.value;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(current, now);
    }
    gain.linearRampToValueAtTime(value, now + duration);
  }

  // suspend() congela las posiciones Y las rampas ya programadas. Al reanudar
  // no se recrean fuentes ni se pierde el punto de una transición en curso.
  function reconcile() {
    transport = transport.catch(() => {}).then(async () => {
      if (!audio) return;
      if (enabled() && startRequested) {
        const resuming = audio.state !== 'running';
        if (resuming) await audio.resume();
        if (!enabled()) { await audio.suspend(); return; }
        if (resuming || targetVolume !== outputVolume()) fadeMaster(outputVolume(), FADE_IN);
        void prepareNext();
      } else {
        await audio.suspend();
      }
    }).catch(() => { /* El siguiente gesto vuelve a intentar desbloquear el audio. */ });
  }

  async function load(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Audio unavailable');
    const buffer = await audio.decodeAudioData(await response.arrayBuffer());
    if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error('Invalid audio');
    return buffer;
  }

  // Cada canción son varios megas y descargarla y decodificarla lleva segundos. Hasta
  // ahora eso no empezaba hasta el primer toque —el navegador no deja sonar nada antes—,
  // así que la música entraba con el juego ya abierto. Ahora la primera pista se prepara
  // durante la presentación aunque todavía no pueda sonar: cuando llega el gesto solo
  // queda programarla. Descargar no es reproducir, y el ajuste apagado sigue sin pedir
  // ni un byte.
  async function preload() {
    if (!audio || loading || ready || voices.size || !enabled()) return;
    loading = true;
    try {
      if (!queue.length) refill();
      const path = queue[0];
      ready = {path, buffer: await load(path)};
    } catch { /* El siguiente gesto vuelve a intentar la descarga. */ }
    finally { loading = false; }
    // Programar sigue siendo cosa de un audio ya desbloqueado: una pista colocada
    // mientras el navegador lo tiene suspendido no se oiría.
    if (audio?.state === 'running') void prepareNext();
  }

  async function prepareNext() {
    // Solo la pista actual y la siguiente se mantienen decodificadas en memoria.
    if (!audio || loading || voices.size >= 2 || !enabled()) return;
    loading = true;
    try {
      if (!queue.length) refill();
      const path = queue[0];
      const buffer = ready?.path === path ? ready.buffer : await load(path);
      ready = null;
      const previous = [...voices].at(-1);
      const overlap = previous ? Math.min(OVERLAP, buffer.duration / 2, previous.duration / 2) : 0;
      const start = previous ? Math.max(audio.currentTime, previous.end - overlap) : audio.currentTime;
      const fade = previous ? Math.max(0, previous.end - start) : Math.min(FADE_IN, buffer.duration / 2);
      const source = audio.createBufferSource(), gain = audio.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(1, start + (fade || Math.min(FADE_IN, buffer.duration / 2)));
      source.connect(gain); gain.connect(master);
      const voice = {source, gain, start, end: start + buffer.duration, duration: buffer.duration};
      source.onended = () => {
        voices.delete(voice);
        source.disconnect(); gain.disconnect(); source.buffer = null;
        void prepareNext();
      };
      source.start(start);
      voices.add(voice);
      if (previous && fade > 0) {
        previous.gain.gain.setValueAtTime(1, start);
        previous.gain.gain.linearRampToValueAtTime(0, previous.end);
      }
      queue.shift(); last = path; // Un fallo de descarga no consume una canción.
    } catch { return; /* Reintentar en el siguiente gesto o al acabar la pista actual. */ }
    finally { loading = false; }
    void prepareNext();
  }

  // Safari solo da el audio por desbloqueado si algo suena dentro del propio gesto, y
  // `resume()` devuelve una promesa que se resuelve más tarde, ya fuera de él. Un búfer
  // de una sola muestra no se oye y basta para que el contexto arranque de verdad: sin
  // esto, la primera pista se programaba en un contexto todavía suspendido y no sonaba
  // hasta el toque siguiente, o el otro.
  function unlock() {
    try {
      const buffer = audio.createBuffer(1, 1, audio.sampleRate);
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(audio.destination);
      source.start(0);
    } catch { /* El siguiente gesto vuelve a intentarlo. */ }
  }

  function sync(tryStart = false) {
    if (tryStart && enabled()) {
      startRequested = true;
      try {
        const ctx = context();
        // Intentar al cargar; si autoplay está bloqueado, repetir resume dentro
        // del primer gesto, también durante el splash (Safari/iPhone incluido).
        if (ctx && ctx.state !== 'running') { void ctx.resume().catch(() => {}); unlock(); }
      } catch { return; }
    }
    if (!audio) return;
    clearTimeout(pauseTimer);
    if (!enabled()) {
      // Apagar la música suelta la pista preparada: son decenas de megas decodificados
      // que ya nadie va a oír. Irse a otra aplicación no la descarta, porque se vuelve.
      if (CT.effectPrefs?.().ambience !== true) ready = null;
      if (!pageActive || !nativeActive || document.hidden) {
        fadeMaster(0, 0);
        // No esperar una cola de promesas al entrar en segundo plano.
        void audio.suspend().then(reconcile).catch(() => {});
      } else {
        fadeMaster(0, FADE_OUT);
        pauseTimer = setTimeout(reconcile, FADE_OUT * 1000);
      }
    } else {
      // Aunque el navegador aún no deje sonar nada, la primera pista se va bajando.
      void preload();
      // Navegar no reinicia la pista ni aplica otra entrada de volumen.
      if (audio.state !== 'running' || targetVolume !== outputVolume()) reconcile();
      else void prepareNext();
    }
  }

  document.addEventListener('visibilitychange', () => sync());
  window.addEventListener('pagehide', () => { pageActive = false; sync(); });
  window.addEventListener('pageshow', () => { pageActive = true; sync(); });
  for (const event of ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click']) {
    document.addEventListener(event, () => sync(true), {capture: true, passive: true});
  }
  try {
    const cap = window.Capacitor;
    if (cap?.isNativePlatform?.()) {
      const app = cap.registerPlugin?.('App') || cap.Plugins?.App;
      Promise.resolve(app?.addListener?.('appStateChange', state => {
        nativeActive = state.isActive;
        sync();
      })).catch(() => {});
    }
  } catch { /* La visibilidad del documento sigue cubriendo la pausa. */ }
  CT.Ambience = {sync, setVolume(value) { userVolume = Math.max(0, Math.min(1, Number(value) || 0)); if (audio && enabled()) fadeMaster(outputVolume(), .2); }};
  // Los ajustes ya están cargados y el splash sigue visible. No esperar al
  // inicio de sesión ni a la primera pantalla del juego para pedir la música.
  sync(true);
})();
