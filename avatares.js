// Ilustraciones propias de Continuum. Se asigna una al entrar, y cada invitado
// puede escoger otra sin que el nombre cambie su elección.
(function () {
  "use strict";
  const CT = window.CONTINUUM;
  const IDS = Object.freeze([
    "alfonso-x", "felipe-ii", "carlos-iii", "cleopatra", "marie-curie", "isabel-catolica",
    "ballena-azul", "elefante", "leon", "panda", "jirafa", "buho-real",
    "el-cid", "cervantes", "juana-i", "melies", "chaplin", "ingrid-bergman",
    "beethoven", "aretha-franklin", "david-bowie", "piloto-arcade", "aventurera", "creador-puzles",
    "tigre", "lince", "pulpo", "flamenco", "pinguino", "zorro",
    "caballera", "ninja", "automata", "hechicera", "explorador", "piloto-espacial"
  ]);
  const KEY = "continuum-avatar-seed-v1";
  const CHOICE_KEY = "continuum-avatar-choice-v1";
  let sessionSeed;

  function ownSeed() {
    const uid = CT.Accounts?.user?.uid;
    if (uid) return "uid:" + uid;
    if (!sessionSeed) {
      try { sessionSeed = CT.Storage.getItem(KEY); } catch { /* sesión privada */ }
      if (!sessionSeed) {
        const bytes = new Uint32Array(2);
        window.crypto?.getRandomValues(bytes);
        sessionSeed = "local:" + bytes[0].toString(36) + ":" + bytes[1].toString(36);
        try { CT.Storage.setItem(KEY, sessionSeed); } catch { /* solo esta sesión */ }
      }
    }
    return sessionSeed;
  }

  function idFor(seed) {
    // FNV-1a: la misma identidad elige la misma ilustración en cualquier móvil.
    let hash = 2166136261;
    for (const char of String(seed)) {
      hash ^= char.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return IDS[(hash >>> 0) % IDS.length];
  }

  function choice() {
    try {
      const id = CT.Storage.getItem(CHOICE_KEY);
      return IDS.includes(id) ? id : null;
    } catch { return null; }
  }

  function choose(id) {
    if (!IDS.includes(id)) return false;
    try { CT.Storage.setItem(CHOICE_KEY, id); } catch { return false; }
    return true;
  }

  function ownId() { return choice() || idFor(ownSeed()); }

  const TITLES = {
    "alfonso-x": "Alfonso X", "felipe-ii": "Felipe II", "carlos-iii": "Carlos III",
    "marie-curie": "Marie Curie", "isabel-catolica": "Isabel la Católica",
    "ballena-azul": "Ballena azul", "buho-real": "Búho real", "el-cid": "El Cid",
    "juana-i": "Juana I", melies: "Georges Méliès", "ingrid-bergman": "Ingrid Bergman",
    "aretha-franklin": "Aretha Franklin", "david-bowie": "David Bowie"
  };
  function title(id) { return TITLES[id] || id.replace(/-/g, " ").replace(/^./, c => c.toUpperCase()); }

  function markup(nombre, { size = 40, etiqueta = "", clase = "", seed, id: explicitId } = {}) {
    const name = String(nombre ?? "").trim();
    const mine = name && [CT.Identidad?.nombre?.(), CT.Accounts?.profile?.alias]
      .some(value => value && value.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"));
    const key = seed ?? (mine || !name ? ownSeed() : "name:" + name.toLocaleLowerCase("es"));
    const id = IDS.includes(explicitId) ? explicitId : key === ownSeed() ? ownId() : idFor(key);
    const side = Math.max(24, Math.min(144, Number(size) || 40));
    const accessible = etiqueta ? 'role="img" aria-label="' + CT.escapeHtml(etiqueta) + '"' : 'aria-hidden="true"';
    return '<span class="avatar avatar-art ' + CT.escapeHtml(clase) + '" ' + accessible
      + ' style="--avatar-size:' + side + 'px"><img src="assets/avatars/' + id
      + '.webp" width="' + side + '" height="' + side + '" alt="" decoding="async"></span>';
  }

  CT.Avatares = { markup, idFor, ids: IDS, ownSeed, ownId, choice, choose, title };
})();
