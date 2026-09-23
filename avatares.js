// Los nueve avatares: medallones de pigmento con un emblema de explorador en trazo
// crema. Son dibujos propios, sin descargas, así que valen igual sin conexión y se ven
// iguales en todos los móviles. Cada uno tiene su color para distinguir de un vistazo a
// quién le toca en una partida de varios.
(function () {
  "use strict";
  const CT = window.CONTINUUM;

  const LISTA = [
    { key: "brujula", nombre: "la Brújula", color: "#9a4a2f",
      trazo: '<circle cx="24" cy="24" r="11"/><path d="m24 15 3.2 9L24 33l-3.2-9Z"/><path d="M24 11v2M24 35v2M11 24h2M35 24h2"/>' },
    { key: "buho", nombre: "el Búho", color: "#5b6b3a",
      trazo: '<path d="M15 16c3 2 6 2 9 0 3 2 6 2 9 0v11c0 6-4 10-9 10s-9-4-9-10Z"/><circle cx="20" cy="23" r="3"/><circle cx="28" cy="23" r="3"/><path d="m22.5 28 1.5 2 1.5-2"/><path d="M15 16l-1-4M33 16l1-4"/>' },
    { key: "globo", nombre: "el Globo", color: "#2f5d6b",
      trazo: '<circle cx="24" cy="23" r="10"/><path d="M14 23h20M24 13c-4 5-4 15 0 20M24 13c4 5 4 15 0 20"/><path d="M17 37h14M24 33v4"/>' },
    { key: "telescopio", nombre: "el Telescopio", color: "#43406b",
      trazo: '<path d="m12 25 18-8 3 6-18 8Z"/><path d="m30 17 4-2 3 6-4 2"/><path d="m21 29-4 9M23 28l4 10"/><path d="M34 11l.8 1.8L37 13l-1.6 1.3.4 2-1.8-1-1.8 1 .4-2L31 13l2.2-.2Z"/>' },
    { key: "pluma", nombre: "la Pluma", color: "#6b3f52",
      trazo: '<path d="M33 12c-9 1-15 8-17 20l-2 5"/><path d="M33 12c1 8-5 16-15 18"/><path d="M20 24l6 1M23 19l5 1"/>' },
    { key: "reloj", nombre: "el Reloj de arena", color: "#8a6a2c",
      trazo: '<path d="M16 12h16M16 36h16"/><path d="M18 12c0 7 12 7 12 12s-12 5-12 12M30 12c0 7-12 7-12 12s12 5 12 12"/><path d="M21 33h6"/>' },
    { key: "ancla", nombre: "el Ancla", color: "#3b5a78",
      trazo: '<circle cx="24" cy="13.5" r="2.5"/><path d="M24 16v20M18 21h12"/><path d="M14 28c1 5 5 8 10 8s9-3 10-8"/><path d="m14 28-2 2M34 28l2 2"/>' },
    { key: "laurel", nombre: "el Laurel", color: "#56713f",
      trazo: '<path d="M18 36c-5-4-6-11-3-18M30 36c5-4 6-11 3-18"/><path d="M15 30l-3-1M14 25l-3-2M15 20l-2-3M33 30l3-1M34 25l3-2M33 20l2-3"/><path d="M24 17v4M22 19h4"/>' },
    { key: "cometa", nombre: "el Cometa", color: "#7a3d33",
      trazo: '<circle cx="30" cy="18" r="4.5"/><path d="M26.5 21.5 13 35M27.5 23.5 17 36M25 20l-12 9"/><path d="M36 30l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z"/>' }
  ];
  const POR_CLAVE = new Map(LISTA.map(avatar => [avatar.key, avatar]));

  function valido(key) { return POR_CLAVE.has(key); }
  function de(key) { return POR_CLAVE.get(key) || LISTA[0]; }

  // Uno al azar, sin repetir los que se le pasen (los ya asignados en una partida).
  function aleatorio(excluir = []) {
    const libres = LISTA.filter(avatar => !excluir.includes(avatar.key));
    const bote = libres.length ? libres : LISTA;
    return bote[Math.floor(Math.random() * bote.length)].key;
  }

  // `etiqueta` da nombre al dibujo para lectores de pantalla; sin ella es decorativo.
  function markup(key, { size = 40, etiqueta = "", clase = "" } = {}) {
    const avatar = de(key);
    const accesible = etiqueta ? `role="img" aria-label="${CT.escapeHtml(etiqueta)}"` : 'aria-hidden="true"';
    return `<svg class="avatar ${clase}" viewBox="0 0 48 48" width="${size}" height="${size}" ${accesible} focusable="false">
      <circle cx="24" cy="24" r="23" fill="${avatar.color}"/>
      <circle cx="24" cy="24" r="20.5" fill="none" stroke="#f4e6c6" stroke-opacity=".45" stroke-width="1"/>
      <g fill="none" stroke="#f7ecd4" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${avatar.trazo}</g>
    </svg>`;
  }

  CT.Avatares = { LISTA, valido, de, aleatorio, markup };
})();
