// Espacio nuevo: ningún dato de la beta anónima se importa ni se borra del servidor.
(function () {
  const CT = window.CONTINUUM;
  const base = CT.Storage;
  const SEASON = 'launch-1';
  let uid = null;
  const listeners = new Set();
  const deviceKeys = new Set(['hilo-ajustes-v1']);
  const scoped = key => !deviceKeys.has(key) && /^(hilo-|continuum-)/.test(key);
  const physical = key => scoped(key) ? `continuum-account:${SEASON}:${uid || 'locked'}:${key}` : key;
  CT.AccountStorage = {
    season: SEASON,
    use(id) { if (!id || /[:/]/.test(id)) throw Error('Identidad inválida'); uid = id; },
    get uid() { return uid; },
    ownsKey(key) { return !!uid && key.startsWith(`continuum-account:${SEASON}:${uid}:`); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    clear() {
      const prefix = `continuum-account:${SEASON}:${uid}:`;
      for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) base.removeItem(key);
    }
  };
  CT.Storage = {
    ...base,
    getItem: key => base.getItem(physical(key)),
    setItem(key, value) {
      const ok = base.setItem(physical(key), value);
      for (const fn of listeners) fn(key);
      return ok;
    },
    removeItem(key) {
      const ok = base.removeItem(physical(key));
      for (const fn of listeners) fn(key);
      return ok;
    },
    // Las copias antiguas no pueden importar puntuaciones en la nueva temporada.
    restore() { throw Error('La nueva cuenta empieza de cero. Las copias de la beta no se importan.'); }
  };
})();
