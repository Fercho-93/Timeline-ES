// La guía en vídeo: el juego se explica mostrándolo. Cada escena se reproduce sola, con
// subtítulos y un dedo que hace las jugadas, y en algunos momentos se detiene para que la
// jugada la haga quien mira. Se pausa, se avanza y se rebobina como un vídeo; no es un
// vídeo de verdad, sino la misma mesa dibujada con cartas reales del mazo, así que nunca
// enseña algo que luego el tablero contradiga. No gasta vidas ni cambia el progreso.
(() => {
  const CT = window.CONTINUUM;
  const SEEN_KEY = "continuum-tutorial-visto-v1";
  const esc = value => CT.escapeHtml(value);

  // Las cartas de los ejemplos se toman de puntos separados del mazo, ordenadas y con valores
  // distintos: la que se coloca encaja de verdad donde dice la escena.
  function sample(modeKey) {
    const deck = CT.cards(modeKey);
    const seen = new Set();
    const ordered = [...deck].sort((a, b) => CT.sortValue(modeKey, a) - CT.sortValue(modeKey, b))
      .filter(card => { const value = CT.sortValue(modeKey, card); if (seen.has(value)) return false; seen.add(value); return true; });
    if (ordered.length < 8) return null;
    const at = fraction => ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))];
    return [0.08, 0.24, 0.4, 0.52, 0.64, 0.8, 0.94].map(at);
  }

  function cardMarkup(modeKey, card, { hidden = false, extra = "" } = {}) {
    return `<div class="tv-card${hidden ? " is-hidden" : ""}${extra ? " " + extra : ""}" data-card="${esc(card.id)}">
      <span class="tv-art">${CT.animalArt(modeKey, card) || `<i aria-hidden="true">◆</i>`}</span>
      <b class="tv-value">${esc(CT.shortValue(modeKey, card))}</b><b class="tv-secret">?<i>${esc(CT.hiddenLabel(modeKey))}</i></b>
      <small>${esc(card.title)}</small></div>`;
  }

  // Un hueco de la línea. Como en la mesa de verdad, el primero (antes de todo) es «−» y los
  // demás «+».
  const gapHtml = (index, interactive) => `<button type="button" class="tv-gap" data-gap="${index}"${interactive ? "" : ' tabindex="-1" aria-hidden="true"'} aria-label="Colocar en el hueco ${index + 1}">${index === 0 ? "−" : "+"}</button>`;
  // Una línea con sus huecos entre carta y carta (y en los extremos).
  function lineMarkup(modeKey, list, { gaps = true, interactive = false } = {}) {
    const gap = index => gaps ? gapHtml(index, interactive) : "";
    return `<div class="tv-line">${list.map((card, index) => gap(index) + cardMarkup(modeKey, card.card || card, card.opts || {})).join("")}${gap(list.length)}</div>`;
  }

  function tile(icon, name, facts, extra = "") {
    return `<div class="tv-tile${extra ? " " + extra : ""}"><i aria-hidden="true">${icon}</i><b>${name}</b><small>${facts}</small></div>`;
  }

  // ── Las escenas ────────────────────────────────────────────────────────────────────────
  // Cada escena dibuja su mesa (`html`) y una lista de pasos [milisegundo, acción]. Una
  // acción con `wait` detiene el reloj hasta que quien mira hace la jugada.
  // `portada`: el vídeo se ve suelto desde la portada, sin manual debajo; al acabar se vuelve a ella.
  function scenes(modeKey, portada = false) {
    const s = sample(modeKey);
    const time = CT.mode(modeKey).axis === "time";
    const order = time ? "de antes a después" : "de menor a mayor";
    const noun = CT.starterNoun(modeKey);
    const [A, B, C, D, E, F, G] = s;
    const hidden = card => ({ card, opts: { hidden: true } });
    const examples = [["history", "Fechas", "de antes a después"], ["animals", "Cifras", "de menor a mayor"]]
      .filter(([key]) => CT.has(key) && CT.cards(key).length)
      .map(([key, kind, how]) => { const card = CT.cards(key)[Math.floor(CT.cards(key).length / 3)]; return `<div class="tv-example">${cardMarkup(key, card)}<span><b>${kind}</b><small>${esc(CT.mode(key).name)} · ${how}</small></span></div>`; }).join("");

    return [
      // 1 · De qué va
      { chapter: 0, title: "Cada carta esconde un dato", duration: 6200,
        html: `<div class="tv-center"><div class="tv-logo">Continuum</div>${cardMarkup(modeKey, D, { hidden: true, extra: "tv-big" })}</div>`,
        steps: [
          [0, c => c.say("Continuum es un juego de ordenar cartas.")],
          [900, c => c.add(".tv-big", "is-in")],
          [2700, c => { c.fingerTo(".tv-big"); }],
          [3300, c => { c.tap(); c.reveal(".tv-big"); c.say(`Cada carta esconde un dato: ${time ? "el año en que ocurrió" : noun}.`); }]
        ] },
      { chapter: 0, title: "El objetivo", duration: 7600,
        html: `<div class="tv-center">${lineMarkup(modeKey, [A, C, E, G], { gaps: false })}<div class="tv-axis"><span>${time ? "Antes" : "Menos"}</span><i></i><span>${time ? "Después" : "Más"}</span></div></div>`,
        steps: [
          [0, c => c.say("Tu objetivo: colocar cada carta en su sitio de la línea…")],
          [300, c => c.stagger(".tv-line .tv-card", 380)],
          [2400, c => c.add(".tv-axis", "is-in")],
          [3600, c => c.say(`…ordenadas ${order}, pero sin ver su dato hasta colocarlas.`)]
        ] },
      { chapter: 0, title: "Fechas y cifras", duration: 7400,
        html: `<div class="tv-center"><div class="tv-examples">${examples}</div></div>`,
        steps: [
          [0, c => c.say("Hay mazos de fechas, que se ordenan de antes a después…")],
          [300, c => c.stagger(".tv-example", 1700)],
          [2000, c => c.say("…y mazos de cifras —peso, población, superficie…—, de menor a mayor.")],
          [4300, c => c.say("Elige el tema que más te guste: el juego es el mismo.")]
        ] },

      // 2 · Colocar cartas
      { chapter: 1, title: "Arrastra o toca el hueco", duration: 10400,
        html: `<div class="tv-table">${lineMarkup(modeKey, [B, E])}<div class="tv-hand">${cardMarkup(modeKey, C, { hidden: true })}</div><button type="button" class="tv-confirm" tabindex="-1" aria-hidden="true">Sí, aquí</button></div>`,
        steps: [
          [0, c => c.say("Arriba, la línea. Abajo, tu carta: su dato está oculto.")],
          [400, c => c.add(".tv-hand .tv-card", "is-in")],
          [2000, c => c.fingerTo(".tv-hand .tv-card")],
          [2600, c => { c.press(true); c.say("Mantenla pulsada y arrástrala hasta un hueco de la línea…"); }],
          [3100, c => c.dragTo(".tv-hand .tv-card", '.tv-gap[data-gap="1"]')],
          [4300, c => { c.press(false); c.drop('.tv-gap[data-gap="1"]'); c.say("…o, si lo prefieres, toca directamente el hueco."); }],
          [5200, c => c.add(".tv-confirm", "is-in")],
          [6200, c => c.fingerTo(".tv-confirm")],
          [6800, c => { c.tap(); c.say("Confirma con «Sí, aquí». Hasta entonces puedes cambiar de hueco o cancelar."); }],
          [7400, c => { c.reveal(".tv-line .is-placed", true); c.remove(".tv-confirm", "is-in"); c.fingerHide(); }],
          [8100, c => c.say("¡Acierto! La carta muestra su dato y se queda en la línea.")]
        ] },
      { chapter: 1, title: "Si fallas", duration: 12400,
        html: `<div class="tv-table">${lineMarkup(modeKey, [B, C, E])}<div class="tv-hand">${cardMarkup(modeKey, F, { hidden: true })}</div><div class="tv-lives" aria-hidden="true"><span>♥</span><span>♥</span><span>♥</span></div></div>`,
        steps: [
          [0, c => c.say("¿Y si te equivocas? Mira esta jugada.")],
          [300, c => { c.add(".tv-hand .tv-card", "is-in"); c.add(".tv-lives", "is-in"); }],
          [1500, c => c.fingerTo('.tv-gap[data-gap="1"]')],
          [2100, c => { c.tap(); c.drop('.tv-gap[data-gap="1"]'); }],
          [3000, c => { c.reveal(".tv-line .is-placed", false); c.fingerHide(); c.say("Fallo: la carta no iba ahí."); }],
          [4300, c => { c.mark(4); c.say("La línea marca con «Aquí» dónde iba…"); }],
          [6000, c => { c.move(".tv-line .is-placed", 3); c.say("…y la carta pasa a su sitio, para que te sirva de referencia."); }],
          [8200, c => { c.add(".tv-lives span:last-child", "is-lost"); c.say("En rondas, maratón y competición, un fallo cuesta una de tus tres vidas. El reto diario no tiene vidas."); }]
        ] },
      { chapter: 1, title: "Ahora tú", duration: 6000, interactive: true,
        html: `<div class="tv-table is-yours">${lineMarkup(modeKey, [B, C, F], { interactive: true })}<div class="tv-hand">${cardMarkup(modeKey, D, { hidden: true, extra: "is-draggable" })}</div><button type="button" class="tv-confirm" disabled>Sí, aquí</button></div>`,
        correct: 2,
        steps: [
          [0, c => { c.say("Ahora tú. ¿Dónde va esta carta? Toca un hueco o arrástrala."); c.add(".tv-hand .tv-card", "is-in"); }],
          [700, c => c.wait()],
          [1000, c => c.say("¡Exacto! Así se juega. En una partida no hay segunda oportunidad, pero aquí no gastas nada.")]
        ] },

      // 3 · Modalidades
      { chapter: 2, title: "Elige cómo jugar", duration: 9400,
        html: `<div class="tv-board"><div class="tv-kicker">En Inicio, «Jugar» abre tres caminos</div><div class="tv-tiles tv-three">
          ${tile("☺", "Jugar solo", "Colecciones, Retos rápidos o competición")}${tile("♟", "Con amigos", "En el mismo móvil o cada uno en el suyo")}${tile("◎", "Online", "Mesas públicas")}</div>
          <div class="tv-daily">${tile("☼", "Reto del día", "Uno al día, el mismo para todo el mundo", "tv-wide")}</div></div>`,
        steps: [
          [0, c => c.say("Hay muchas formas de jugar. En Inicio, «Jugar» se abre en tres caminos.")],
          [400, c => c.stagger(".tv-three .tv-tile", 500)],
          [2400, c => c.say("Jugar solo, jugar con amigos o jugar online, con otras personas.")],
          [5200, c => { c.stagger(".tv-daily .tv-tile", 0); c.say("Y cada día, además, te espera el reto del día."); }]
        ] },
      { chapter: 2, title: "Reto del día", duration: 11000,
        html: `<div class="tv-board"><div class="tv-kicker">☼ Reto del día</div><div class="tv-dots">${"✓✓✗✓✓✓✗✓✓✗".split("").map(m => `<span data-mark="${m === "✓" ? "ok" : "bad"}">${m}</span>`).join("")}</div><div class="tv-score">7 de 10</div>
          <div class="tv-facts"><span>10 cartas</span><span>Sin vidas ni tiempo</span><span>Mismas cartas para todos</span><span>Puntúa en el ranking</span><span>Pares: Grandes colecciones</span><span>Impares: Retos rápidos</span></div></div>`,
        steps: [
          [0, c => c.say("El reto del día: un solo intento, con las mismas cartas para todo el mundo.")],
          [600, c => c.stagger(".tv-dots span", 280)],
          [3600, c => { c.add(".tv-score", "is-in"); c.say("Siempre ordenas 10 cartas, sin vidas ni tiempo: al final cuentan tus aciertos."); }],
          [5600, c => { c.stagger(".tv-facts span", 220); c.say("Es lo único que puntúa en el ranking por días y por semanas."); }],
          [8000, c => c.say("Los días pares toca un mazo de Grandes colecciones; los impares, uno de Retos rápidos.")]
        ] },
      { chapter: 2, title: "Jugar solo", duration: 11400,
        html: `<div class="tv-board"><div class="tv-kicker">☺ Jugar solo · Grandes colecciones</div><div class="tv-tiles">
          ${tile("∞", "Rondas", "10 cartas · 3 vidas · una ★ por vida que te quede")}${tile("∞", "Maratón", "El mazo entero, hasta perder las 3 vidas")}${tile("◈", "Competición", "Varios temas seguidos")}</div>
          <div class="tv-levels">${Object.values(CT.Ghost?.LEVELS || { a: { name: "Fácil" }, b: { name: "Normal" }, c: { name: "Difícil" }, d: { name: "Experto" } }).map(level => `<span>${esc(level.name)}</span>`).join("")}</div></div>`,
        steps: [
          [0, c => c.say("Jugando solo eliges un mazo de Grandes colecciones y cómo jugarlo.")],
          [400, c => c.stagger(".tv-tiles .tv-tile", 700)],
          [1200, c => c.say("Rondas de 10 cartas con 3 vidas, la maratón con el mazo entero o una competición de varios temas.")],
          [5600, c => { c.stagger(".tv-levels span", 300); c.say("Y una dificultad: desde Normal, cada acierto añade cartas a la línea y hay tiempo por carta."); }],
          [8000, c => c.sweep(".tv-levels span", 600)]
        ] },
      { chapter: 2, title: "Retos rápidos", duration: 8800,
        html: `<div class="tv-board"><div class="tv-kicker">⇅ Retos rápidos</div><p class="tv-note">Mazos cortos, cada uno con su propia regla de orden, que se lee antes de empezar.</p><div class="tv-tiles">
          ${tile("☀", "Mazos del día", "Cuatro mazos que cambian cada día, los mismos para todo el mundo")}${tile("?", "Partida sorpresa", "Mazos al azar: de 1 a 20, o todo el catálogo")}</div></div>`,
        steps: [
          [0, c => c.say("Los Retos rápidos son otra familia: mazos cortos con su propia regla de orden.")],
          [500, c => c.add(".tv-note", "is-in")],
          [2600, c => c.stagger(".tv-tiles .tv-tile", 900)],
          [3200, c => c.say("Juega uno de los mazos del día o una partida sorpresa. Jugando solo, un fallo no te saca del reto.")]
        ] },
      { chapter: 2, title: "Con amigos", duration: 12600,
        html: `<div class="tv-board"><div class="tv-kicker">♟ Con amigos</div><div class="tv-pass"><span class="tv-phone" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M10.5 18.5h3"/></svg></span><span class="tv-people"><b>Ana</b><b>Luis</b><b>Sara</b></span></div><div class="tv-tiles">
          ${tile("♟", "Un solo móvil", "2–9 personas · pasáis el teléfono")}${tile("⌁", "En directo", "Cada uno en su móvil, todos a la vez")}${tile("⇄", "Por turnos", "Un duelo entre dos, cuando cada uno pueda")}${tile("↗", "Mismas cartas", "Juega y reta con un enlace")}</div></div>`,
        steps: [
          [0, c => c.say("Con amigos, todos en un mismo móvil: cada uno tiene su mano de cartas y os pasáis el teléfono.")],
          [400, c => c.add(".tv-pass", "is-in")],
          [900, c => c.cycle(".tv-people b", 900, 3)],
          [3800, c => c.say("Gana quien se quede antes sin cartas. Si fallas, la carta va al descarte y robas otra.")],
          [6400, c => { c.stagger(".tv-tiles .tv-tile", 500); c.say("O cada uno en su móvil: en directo, por turnos o con las mismas cartas, compartiendo un código, un enlace o un QR."); }]
        ] },
      { chapter: 2, title: "Poderes", duration: 9400,
        html: `<div class="tv-board"><div class="tv-kicker">Poderes · solo en partidas en grupo</div><div class="tv-tiles">
          ${tile("◌", "Fantasma", "Una vuelta entera con los datos y las ilustraciones ocultos")}${tile("ϟ", "Pulso", "Retas a un rival: los dos colocáis la misma carta a ciegas")}</div><p class="tv-note">Opcionales: se activan al preparar la partida.</p></div>`,
        steps: [
          [0, c => c.say("En las partidas en grupo de Grandes colecciones puedes activar poderes.")],
          [500, c => c.stagger(".tv-tiles .tv-tile", 1600)],
          [1600, c => c.say("Fantasma oculta los datos durante una vuelta. Con el Pulso, retas a otro jugador.")],
          [5400, c => { c.add(".tv-note", "is-in"); c.say("Los poderes llegan con algunas cartas al robarlas: quien la roba se lo queda y lo usa una vez."); }]
        ] },
      { chapter: 2, title: "Online", duration: 8600,
        html: `<div class="tv-board"><div class="tv-kicker">◎ Jugar online</div><div class="tv-table-seats"><span>●</span><span>●</span><span class="is-free">○</span><span class="is-free">○</span></div><div class="tv-tiles">
          ${tile("◎", "Mesas públicas", "2–4 plazas · crea una o siéntate")}${tile("⚡", "Partida rápida", "Te buscamos mesa")}</div></div>`,
        steps: [
          [0, c => c.say("Online juegas con otras personas en mesas públicas de 2 a 4 plazas.")],
          [400, c => c.add(".tv-table-seats", "is-in")],
          [1600, c => c.fill(".tv-table-seats .is-free", 900)],
          [3600, c => { c.stagger(".tv-tiles .tv-tile", 600); c.say("Crea tu mesa, siéntate en una abierta o pide una partida rápida."); }]
        ] },
      { chapter: 2, title: "¡A jugar!", duration: 4000, last: true,
        html: `<div class="tv-center tv-end"><div class="tv-logo">¡Ya sabes jugar!</div><p>Para tu primera partida: «Jugar solo», un mazo de Grandes colecciones, en Fácil.</p><div class="tv-end-actions"><button type="button" class="btn btn-secondary" data-tv="replay">Ver otra vez</button>${portada ? "" : '<button type="button" class="btn btn-ghost" data-tv="manual">Ver el manual</button>'}</div></div>`,
        steps: [
          [0, c => { c.say(portada ? "¡Listo! Ya sabes jugar. Pulsa «Jugar» para empezar." : "¡Listo! Ya sabes jugar. Los detalles están en el manual, debajo."); c.add(".tv-end", "is-in"); }]
        ] }
    ];
  }

  const CHAPTERS = ["De qué va", "Colocar cartas", "Modalidades"];

  const ICON = {
    play: '<svg class="tv-ico-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.6v14.8c0 .9 1 1.4 1.7.9l11-7.4c.7-.4.7-1.4 0-1.8l-11-7.4C8 3.2 7 3.7 7 4.6Z"/></svg>',
    pause: '<svg class="tv-ico-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="4" width="4.5" height="16" rx="1.3"/><rect x="14" y="4" width="4.5" height="16" rx="1.3"/></svg>',
    replay: '<svg class="tv-ico-replay" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.3 4h2.2A5 5 0 1 0 12 7v3L7.5 6 12 2v3Z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5.5h2.4v13H6v-13Zm12.6.9v11.2c0 .9-1 1.4-1.7.9L9 13c-.7-.5-.7-1.5 0-2l7.9-5.5c.7-.5 1.7 0 1.7.9Z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.6 5.5H18v13h-2.4v-13ZM5.4 6.4v11.2c0 .9 1 1.4 1.7.9L15 13c.7-.5.7-1.5 0-2L7.1 5.5c-.7-.5-1.7 0-1.7.9Z"/></svg>'
  };

  function markup(modeKey, { portada = false } = {}) {
    if (!sample(modeKey)) return "";
    const list = scenes(modeKey, portada);
    // La línea de escenas de arriba: un tramo por escena, agrupados por capítulo.
    const timeline = CHAPTERS.map((name, chapter) => `<span class="tv-seg-group" data-chapter="${chapter}">${list.map((scene, index) => scene.chapter === chapter ? `<button type="button" class="tv-seg" data-tv-scene="${index}" tabindex="-1" aria-label="${esc(scene.title)}"><i></i></button>` : "").join("")}</span>`).join("");
    return `<section class="tv-player" data-tutorial="${esc(modeKey)}"${portada ? " data-portada" : ""} aria-label="Guía en vídeo">
      <div class="tv-screen">
        <i class="tv-light" aria-hidden="true"></i>
        <div class="tv-timeline" aria-hidden="true">${timeline}</div>
        <div class="tv-scene-title" aria-hidden="true"></div>
        <div class="tv-fade" aria-hidden="true" inert></div>
        <div class="tv-stage"></div>
        <span class="tv-finger" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5V4a1.5 1.5 0 0 1 3 0v6m0-1a1.5 1.5 0 0 1 3 0v4.5a7 7 0 0 1-7 7h-1a6 6 0 0 1-4.9-2.6L3.6 14a1.5 1.5 0 0 1 2.4-1.8L9 15V11"/></svg></span>
        <p class="tv-caption" aria-live="polite"></p>
        <button type="button" class="tv-big-play" data-tv="toggle" aria-label="Reproducir" hidden>${ICON.play}</button>
      </div>
      <div class="tv-controls">
        <div class="tv-transport">
          <button type="button" class="tv-btn" data-tv="prev" aria-label="Escena anterior">${ICON.prev}</button>
          <button type="button" class="tv-btn tv-play" data-tv="toggle" data-state="playing" aria-label="Pausar">${ICON.play}${ICON.pause}${ICON.replay}</button>
          <button type="button" class="tv-btn" data-tv="next" aria-label="Escena siguiente">${ICON.next}</button>
        </div>
        <div class="tv-chapters">${CHAPTERS.map((name, index) => `<button type="button" class="tv-chapter" data-tv-chapter="${index}"><b aria-hidden="true">${index + 1}</b><small>${name}</small></button>`).join("")}</div>
      </div>
    </section>`;
  }

  // ── El reproductor ─────────────────────────────────────────────────────────────────────
  function mount(root) {
    if (root.dataset.tutorialReady) return;
    root.dataset.tutorialReady = "1";
    const modeKey = root.dataset.tutorial;
    const list = scenes(modeKey, root.hasAttribute("data-portada"));
    const stage = root.querySelector(".tv-stage"), finger = root.querySelector(".tv-finger"), fade = root.querySelector(".tv-fade");
    const caption = root.querySelector(".tv-caption"), sceneTitle = root.querySelector(".tv-scene-title");
    let index = 0, t = 0, applied = 0, playing = true, waiting = false, ended = false, last = 0, timer = 0;
    const timeouts = new Set();

    const $ = sel => stage.querySelector(sel);
    const $$ = sel => [...stage.querySelectorAll(sel)];
    const later = (fn, ms) => { if (instant) { fn(); return; } const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); };
    let instant = false;
    const centerOf = el => {
      const box = root.querySelector(".tv-screen").getBoundingClientRect(), r = el.getBoundingClientRect();
      return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
    };
    const ctx = {
      // Cada frase entra de nuevo (la clase se quita y se vuelve a poner para repetir la animación).
      say(text) { caption.textContent = text; caption.classList.remove("is-say"); void caption.offsetWidth; caption.classList.add("is-say"); },
      add(sel, cls) { $$(sel).forEach(el => el.classList.add(cls)); },
      remove(sel, cls) { $$(sel).forEach(el => el.classList.remove(cls)); },
      stagger(sel, gap) { $$(sel).forEach((el, i) => later(() => el.classList.add("is-in"), i * gap)); },
      sweep(sel, gap) { $$(sel).forEach((el, i) => later(() => { $$(sel).forEach(o => o.classList.toggle("is-on", o === el)); }, i * gap)); },
      cycle(sel, gap, rounds) { const els = $$(sel); for (let i = 0; i < els.length * rounds; i++) later(() => els.forEach((el, k) => el.classList.toggle("is-on", k === i % els.length)), i * gap); },
      fill(sel, gap) { $$(sel).forEach((el, i) => later(() => { el.classList.remove("is-free"); el.textContent = "●"; }, i * gap)); },
      fingerTo(sel) { const el = typeof sel === "string" ? $(sel) : sel; if (!el) return; const [x, y] = centerOf(el); finger.style.transform = `translate(${x}px, ${y}px)`; finger.classList.add("is-in"); },
      fingerHide() { finger.classList.remove("is-in", "is-press"); },
      press(on) { finger.classList.toggle("is-press", on); },
      tap() { finger.classList.remove("is-tap"); void finger.offsetWidth; finger.classList.add("is-tap"); },
      dragTo(cardSel, gapSel) {
        const card = $(cardSel), gap = $(gapSel); if (!card || !gap) return;
        const [cx, cy] = centerOf(card), [gx, gy] = centerOf(gap);
        card.style.transform = `translate(${gx - cx}px, ${gy - cy}px) scale(.9)`;
        card.classList.add("is-lifted");
        ctx.fingerTo(gap);
      },
      // La carta de la mano entra en la línea por el hueco indicado, todavía oculta.
      // Se busca la carta que queda a la izquierda del hueco sin contar la propia, para que
      // cambiar de idea con la carta ya en la línea la lleve al hueco que se ha tocado.
      drop(gapSel) {
        const card = $(".tv-line .is-placed") || $(".tv-hand .tv-card"), gap = typeof gapSel === "string" ? $(gapSel) : gapSel;
        const line = $(".tv-line"); if (!card || !gap || !line) return;
        let prev = gap.previousElementSibling;
        while (prev && (prev === card || !prev.classList.contains("tv-card"))) prev = prev.previousElementSibling;
        card.remove();
        if (prev) prev.after(card); else line.prepend(card);
        card.style.transform = ""; card.classList.remove("is-lifted", "is-in", "is-draggable", "is-bad");
        card.classList.add("is-placed");
        ctx.renumber();
      },
      renumber() {
        const line = $(".tv-line"); if (!line) return;
        // Huecos entre cartas, sin dos seguidos ni carta sin hueco al lado.
        line.querySelectorAll(".tv-gap").forEach(gap => gap.remove());
        const cards = [...line.querySelectorAll(".tv-card")];
        const interactive = stage.querySelector(".is-yours");
        cards.forEach((card, i) => card.insertAdjacentHTML("beforebegin", gapHtml(i, interactive)));
        line.insertAdjacentHTML("beforeend", gapHtml(cards.length, interactive));
      },
      reveal(sel, ok) {
        const el = $(sel); if (!el) return;
        el.classList.remove("is-hidden");
        if (ok === true) el.classList.add("is-ok");
        if (ok === false) el.classList.add("is-bad");
      },
      mark(gapIndex) { $(`.tv-gap[data-gap="${gapIndex}"]`)?.classList.add("is-here"); },
      move(sel, gapIndex) {
        const el = $(sel), line = $(".tv-line"); if (!el || !line) return;
        const others = [...line.querySelectorAll(".tv-card")].filter(card => card !== el);
        el.remove();
        if (others[gapIndex - 1]) others[gapIndex - 1].after(el); else line.prepend(el);
        el.classList.remove("is-bad"); el.classList.add("is-moved");
        ctx.renumber();
      },
      wait() { waiting = true; root.classList.add("is-waiting"); paint(); }
    };

    function build(target = 0) {
      timeouts.forEach(clearTimeout); timeouts.clear();
      const scene = list[index];
      // La escena anterior se disuelve mientras entra la nueva, como un fundido de vídeo.
      if (fade && stage.childElementCount && !instant) {
        fade.innerHTML = stage.innerHTML;
        fade.classList.remove("is-out"); void fade.offsetWidth; fade.classList.add("is-out");
        later(() => { fade.innerHTML = ""; fade.classList.remove("is-out"); }, 450);
      }
      stage.innerHTML = scene.html;
      stage.classList.remove("is-enter"); void stage.offsetWidth; stage.classList.add("is-enter");
      stage.dataset.scene = String(index);
      sceneTitle.textContent = scene.title;
      sceneTitle.classList.remove("is-in"); void sceneTitle.offsetWidth; sceneTitle.classList.add("is-in");
      ctx.fingerHide(); finger.style.transform = "";
      caption.textContent = "";
      waiting = false; root.classList.remove("is-waiting", "is-solved");
      t = 0; applied = 0;
      if (target > 0) {
        instant = true; root.classList.add("tv-instant");
        advance(target);
        void stage.offsetWidth;
        root.classList.remove("tv-instant"); instant = false;
      }
      paint();
    }

    function advance(to) {
      const steps = list[index].steps;
      while (applied < steps.length && steps[applied][0] <= to) {
        steps[applied][1](ctx); applied++;
        t = Math.max(t, steps[applied - 1][0]);
        if (waiting) return;
      }
      t = to;
    }

    function go(next, { play = true } = {}) {
      index = Math.max(0, Math.min(list.length - 1, next));
      ended = false; build();
      if (play) setPlaying(true);
    }

    function setPlaying(on) {
      if (ended && on) { index = 0; ended = false; build(); }
      playing = on;
      last = now();
      if (playing) loop();
      paint();
    }

    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    function loop() {
      clearTimeout(timer);
      if (!root.isConnected) { stop(); return; }
      if (!playing) return;
      const moment = now(), dt = Math.min(200, moment - last); last = moment;
      if (!waiting) {
        advance(t + dt);
        const scene = list[index];
        if (!waiting && t >= scene.duration) {
          if (scene.last || index >= list.length - 1) {
            ended = true; playing = false; markSeen(); paint();
            // Quien lo ha abierto (la portada) decide qué hacer al terminar.
            root.dispatchEvent(new CustomEvent("tutorial-end", { bubbles: true }));
            return;
          }
          index++; build();
        }
      }
      paintProgress();
      timer = setTimeout(loop, 60);
    }
    function stop() { clearTimeout(timer); timeouts.forEach(clearTimeout); timeouts.clear(); playing = false; }

    const segments = [...root.querySelectorAll(".tv-seg i")];
    function paintProgress() {
      // Arriba, un tramo por escena: las pasadas llenas, la actual avanzando.
      segments.forEach((bar, i) => {
        const scene = list[i]; if (!scene) return;
        bar.style.width = i < index || ended ? "100%" : i === index ? `${Math.min(100, Math.round(t / scene.duration * 100))}%` : "0%";
      });
      CHAPTERS.forEach((_, chapter) => {
        const tab = root.querySelector(`[data-tv-chapter="${chapter}"]`); if (!tab) return;
        tab.classList.toggle("is-current", list[index].chapter === chapter);
        tab.classList.toggle("is-done", ended || list.every((scene, i) => scene.chapter !== chapter || i < index));
      });
    }
    function paint() {
      const play = root.querySelector(".tv-play"), big = root.querySelector(".tv-big-play");
      play.dataset.state = playing ? "playing" : ended ? "ended" : "paused";
      play.setAttribute("aria-label", playing ? "Pausar" : ended ? "Ver otra vez" : "Reproducir");
      big.hidden = playing || ended || waiting;
      root.classList.toggle("is-paused", !playing);
      root.classList.toggle("is-ended", ended);
      paintProgress();
    }

    // La jugada de quien mira: tocar un hueco (o soltar la carta encima) y confirmar.
    function choose(gap) {
      if (!waiting || !gap) return;
      $(".tv-line .is-placed, .tv-hand .tv-card")?.classList.remove("is-shake");
      ctx.drop(gap);
      const confirm = $(".tv-confirm"); confirm.disabled = false; confirm.classList.add("is-in");
      ctx.say("Bien. Ahora confirma con «Sí, aquí», o toca otro hueco para cambiar de idea.");
    }
    function confirmPlacement() {
      if (!waiting) return;
      const card = $(".tv-line .is-placed"); if (!card) return;
      const position = [...$(".tv-line").querySelectorAll(".tv-card")].indexOf(card);
      CT.Sonidos?.confirm?.();
      const confirm = $(".tv-confirm");
      if (position === list[index].correct) {
        confirm.disabled = true; confirm.classList.remove("is-in");
        ctx.reveal(".tv-line .is-placed", true);
        CT.Sonidos?.result?.(true);
        root.classList.add("is-solved"); root.classList.remove("is-waiting");
        $$(".tv-gap").forEach(gap => { gap.disabled = true; });
        waiting = false; last = now(); paint();
        if (!playing) setPlaying(true);
      } else {
        card.classList.add("is-bad", "is-shake");
        CT.Sonidos?.result?.(false);
        const cards = [...$(".tv-line").querySelectorAll(".tv-card")].filter(other => other !== card);
        const before = cards[list[index].correct - 1], after = cards[list[index].correct];
        ctx.say(`Casi. Aquí no pierdes nada: prueba otro hueco. Pista: va entre «${before?.querySelector("small").textContent}» y «${after?.querySelector("small").textContent}».`);
        confirm.disabled = true;
        later(() => { card.classList.remove("is-shake"); }, 500);
      }
    }

    root.addEventListener("click", event => {
      const control = event.target.closest("[data-tv]"), chapter = event.target.closest("[data-tv-chapter]"), seg = event.target.closest("[data-tv-scene]");
      const gap = event.target.closest(".tv-gap"), confirm = event.target.closest(".tv-confirm");
      if (gap && stage.contains(gap) && stage.querySelector(".is-yours")) { choose(gap); return; }
      if (confirm && stage.contains(confirm) && !confirm.disabled && stage.querySelector(".is-yours")) { confirmPlacement(); return; }
      if (seg) { go(Number(seg.dataset.tvScene)); return; }
      if (chapter) { go(list.findIndex(scene => scene.chapter === Number(chapter.dataset.tvChapter))); return; }
      if (!control) return;
      const action = control.dataset.tv;
      if (action === "toggle") setPlaying(!playing);
      else if (action === "prev") go(t > 1500 ? index : index - 1);
      else if (action === "next") go(index + 1);
      else if (action === "replay") go(0);
      else if (action === "manual") root.closest(".guide-handbook")?.querySelector(".guide-manual")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
    // Tocar la pantalla pausa o reanuda, como en un vídeo (salvo en la jugada propia).
    root.querySelector(".tv-screen").addEventListener("click", event => {
      if (event.target.closest("button, .tv-card")) return;
      if (!waiting) setPlaying(!playing);
    });

    // Arrastrar la carta con el dedo hasta un hueco.
    let drag = null;
    stage.addEventListener("pointerdown", event => {
      const card = event.target.closest(".is-yours .tv-hand .tv-card, .is-yours .tv-line .is-placed");
      if (!card || !waiting) return;
      drag = { card, x: event.clientX, y: event.clientY, moved: false };
      card.setPointerCapture?.(event.pointerId);
    });
    stage.addEventListener("pointermove", event => {
      if (!drag) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 6) drag.moved = true;
      drag.card.classList.add("is-lifted");
      drag.card.style.transform = `translate(${dx}px, ${dy}px) scale(.92)`;
      const over = document.elementsFromPoint?.(event.clientX, event.clientY)?.find(el => el.classList?.contains("tv-gap"));
      $$(".tv-gap").forEach(gap => gap.classList.toggle("is-over", gap === over));
    });
    const endDrag = event => {
      if (!drag) return;
      const { card, moved } = drag; drag = null;
      card.style.transform = ""; card.classList.remove("is-lifted");
      const over = moved && document.elementsFromPoint?.(event.clientX, event.clientY)?.find(el => el.classList?.contains("tv-gap"));
      $$(".tv-gap").forEach(gap => gap.classList.remove("is-over"));
      if (over) choose(over);
    };
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);

    // Al salir de la aplicación el vídeo se queda en pausa, como cualquier reproductor.
    const onHidden = () => { if (!root.isConnected) document.removeEventListener("visibilitychange", onHidden); else if (document.hidden && playing) setPlaying(false); };
    document.addEventListener("visibilitychange", onHidden);
    build();
    setPlaying(true);
    root.tutorial = { go, setPlaying, state: () => ({ index, t, playing, waiting, ended, scenes: list.length }), stop };
  }

  function markSeen() { try { CT.Storage?.setItem(SEEN_KEY, "1"); } catch { /* almacenamiento lleno */ } }
  function seen() { try { return !!CT.Storage?.getItem(SEEN_KEY); } catch { return true; } }

  // La guía se inserta como texto desde varios sitios (la partida, las salas); el
  // reproductor arranca solo en cuanto aparece en la página.
  const page = typeof document !== "undefined" ? document : null;
  function mountAll(scope = page) { scope?.querySelectorAll?.("[data-tutorial]:not([data-tutorial-ready])").forEach(mount); }
  if (page?.documentElement && typeof MutationObserver !== "undefined") {
    new MutationObserver(() => mountAll()).observe(page.documentElement, { childList: true, subtree: true });
  }

  CT.Tutorial = { markup, mount, mountAll, seen, markSeen, SEEN_KEY };
})();
