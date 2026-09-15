// Música de sesión. Su reloj es independiente del de los efectos de las cartas.
(function () {
  'use strict';
  const CT = window.CONTINUUM;
  const TRACKS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map(name => `assets/audio/${name}.mp3`);
  const OVERLAP = 4, VOLUME = .12, FADE_IN = 1.5, FADE_OUT = .3;
  let queue = [], last = null, audio, master, loading = false;
  let pageActive = true, nativeActive = true, unlocked = false, pauseTimer;
  let transport = Promise.resolve(), targetVolume = 0;
  const voices = new Set();
  const enabled = () => CT.effectPrefs?.().ambience === true && pageActive && nativeActive && !document.hidden;

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
      if (enabled() && unlocked) {
        const resuming = audio.state !== 'running';
        if (resuming) await audio.resume();
        if (!enabled()) { await audio.suspend(); return; }
        if (resuming || targetVolume !== VOLUME) fadeMaster(VOLUME, FADE_IN);
        void prepareNext();
      } else {
        await audio.suspend();
      }
    }).catch(() => { /* El siguiente gesto vuelve a intentar desbloquear el audio. */ });
  }

  async function prepareNext() {
    // Solo la pista actual y la siguiente se mantienen decodificadas en memoria.
    if (!audio || loading || voices.size >= 2 || !enabled()) return;
    loading = true;
    try {
      if (!queue.length) refill();
      const path = queue[0];
      const response = await fetch(path);
      if (!response.ok) throw new Error('Audio unavailable');
      const buffer = await audio.decodeAudioData(await response.arrayBuffer());
      if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error('Invalid audio');
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

  function sync(fromGesture = false) {
    if (fromGesture && enabled()) {
      unlocked = true;
      try {
        const ctx = context();
        // Invocar resume dentro del gesto también funciona en Safari/iPhone.
        if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
      } catch { return; }
    }
    if (!audio) return;
    clearTimeout(pauseTimer);
    if (!enabled()) {
      if (!pageActive || !nativeActive || document.hidden) {
        fadeMaster(0, 0);
        // No esperar una cola de promesas al entrar en segundo plano.
        void audio.suspend().then(reconcile).catch(() => {});
      } else {
        fadeMaster(0, FADE_OUT);
        pauseTimer = setTimeout(reconcile, FADE_OUT * 1000);
      }
    } else {
      // Navegar no reinicia la pista ni aplica otra entrada de volumen.
      if (audio.state !== 'running' || targetVolume !== VOLUME) reconcile();
      else void prepareNext();
    }
  }

  document.addEventListener('visibilitychange', () => sync());
  window.addEventListener('pagehide', () => { pageActive = false; sync(); });
  window.addEventListener('pageshow', () => { pageActive = true; sync(); });
  document.addEventListener('click', () => sync(true), true);
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
  CT.Ambience = {sync};
})();
