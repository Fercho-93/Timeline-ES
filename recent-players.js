(function () {
  "use strict";

  const CT = window.CONTINUUM;
  // CT.Storage convierte esta clave en una clave local del invitado activo. Accounts solo
  // sincroniza progreso y récords, por lo que estos nombres no salen del dispositivo ni
  // aparecen al cambiar de cuenta.
  const KEY = "continuum-recent-local-players-v1";
  const LIMIT = 12;
  const clean = value => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 18);
  const identity = value => clean(value).normalize("NFKC").toLocaleLowerCase("es");
  const reusable = name => name && !/^jugador\s+\d+$/i.test(name);

  function unique(names) {
    const seen = new Set();
    return names.map(clean).filter(name => {
      const id = identity(name);
      if (!reusable(name) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function load() {
    try {
      const parsed = JSON.parse(CT.Storage.getItem(KEY));
      return Array.isArray(parsed) ? unique(parsed).slice(0, LIMIT) : [];
    } catch { return []; }
  }

  function save(names) {
    const next = unique(names).slice(0, LIMIT);
    CT.Storage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  CT.RecentPlayers = {
    key: KEY,
    identity,
    load,
    remember(names) {
      const newest = unique(Array.isArray(names) ? names : [names]);
      const used = new Set(newest.map(identity));
      return save([...newest, ...load().filter(name => !used.has(identity(name)))]);
    },
    available(activeNames = []) {
      const active = new Set(activeNames.map(identity));
      return load().filter(name => !active.has(identity(name)));
    },
    remove(name) { return save(load().filter(item => identity(item) !== identity(name))); },
    clear() { CT.Storage.removeItem(KEY); return []; }
  };
})();
