// Moderación de nombres: qué nombre no se admite y el botón «Denunciar» que acompaña a cualquier
// nombre ajeno. Ningún filtro de palabras es perfecto (por eso existe la denuncia, que lee una
// persona en la consola de Firebase); este se limita a lo claramente ofensivo y a los nombres que
// harían pasar a alguien por el juego o por quien lo gestiona. El servidor solo exige estos últimos
// (firestore.rules, `reservedName`): el resto de la lista vive aquí para poder ajustarla sin publicar reglas.
(function () {
  "use strict";
  const CT = window.CONTINUUM;

  // «Cabrón», «CABRON» y «c4br0n» son lo mismo. La ñ se conserva (coño no es «cono») y lo demás
  // pierde acentos y mayúsculas. Cada nombre se mira de dos formas: con los números y signos que
  // imitan letras vueltos a su letra (c4br0n → cabron) y sin ellos (admin2024 → admin), porque
  // «Admin1» se leería «admini» y se escaparía.
  const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", "$": "s", "!": "i", "+": "t" };
  const base = texto => String(texto ?? "").replace(/ñ/gi, "\u0001").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\u0001/g, "ñ");
  // Tres letras iguales seguidas o más se quedan en una (puuuta → puta); dos se respetan (polla, zorra).
  const sinRepetidas = t => t.replace(/(.)\1{2,}/g, "$1");
  const formas = texto => { const b = base(texto); return [sinRepetidas(b.replace(/[0134579@$!+]/g, c => LEET[c] ?? c)), sinRepetidas(b)]; };
  const palabras = forma => forma.split(/[^a-zñ]+/).filter(Boolean);
  const junto = forma => forma.replace(/[^a-zñ]+/g, "");

  // Palabras sueltas: se miran enteras, nunca dentro de otra palabra (así «computadora» no contiene «puta»).
  const PALABRAS = new Set(`
    puta puto putas putos putita putear putero cabron cabrona cabrones gilipollas gilipolla joder jodete jodido jodida
    mierda mierdas coño polla pollas pene vagina culo culos verga vergas pendejo pendeja pendejos chingar chingada chinga chingado
    maricon maricones marica marico mariconazo zorra zorras idiota idiotas imbecil imbeciles subnormal subnormales retrasado retrasada
    mongolo mongola capullo capullos follar follame folla follando follada cagon cagar tetas sexo porno pornografia
    violador violadores violar pedofilo pedofila pederasta negrata sudaca bollera tortillera travelo mamon gonorrea hdp
    hijoputa hijodeputa hijueputa malparido malparida nazi nazis hitler kkk heil sieg
    fuck fucker fucking fuk shit shitty bitch bitches cunt dick dicks pussy asshole whore slut nigger nigga faggot fag retard rape rapist porn
  `.split(/\s+/).filter(Boolean).map(sinRepetidas));
  // Palabras largas que no aparecen dentro de palabras normales: se buscan en cualquier parte del nombre
  // (también escritas con espacios o signos de por medio: «p u t a m a d r e»).
  const FRAGMENTOS = ["gilipollas", "cabron", "maricon", "mierda", "pendejo", "hijoputa", "hijodeputa", "hijueputa", "malparido",
    "putamadre", "chupapollas", "follar", "jodete", "violador", "pedofil", "pederast", "negrata", "sudaca", "hitler", "pornograf",
    "fuck", "shit", "bitch", "nigger", "faggot", "whore", "asshole", "rapist"].map(sinRepetidas);

  // Nombres que harían pasar a alguien por el juego o por quien lo gestiona.
  const RESERVADAS = new Set("admin administrador administrator moderador moderator mod soporte support staff oficial official sistema system root".split(" "));

  const ofensivo = nombre => formas(nombre).some(f => palabras(f).some(p => PALABRAS.has(p)) || FRAGMENTOS.some(x => junto(f).includes(x)));
  const reservado = nombre => formas(nombre).some(f => junto(f).includes("continuum") || palabras(f).some(p => RESERVADAS.has(p)));

  // El motivo si el nombre no vale, o `null` si vale.
  function problema(nombre) {
    if (reservado(nombre)) return "Ese nombre está reservado. Elige otro.";
    if (ofensivo(nombre)) return "Ese nombre no está permitido. Elige otro.";
    return null;
  }

  const escapa = texto => String(texto ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // El botón que se pone junto al nombre de otra persona. Lo atiende accounts.js (que es quien tiene la
  // conexión con el servidor): `contexto` es dónde se ve el nombre (ranking, mesa, duelo o sala).
  function botonDenuncia(uid, alias, contexto, compacto = false) {
    if (!uid || !["ranking", "mesa", "duelo", "sala"].includes(contexto)) return "";
    const nombre = String(alias || "esta persona").slice(0, 24);
    return `<button type="button" class="report-btn${compacto ? " report-compact" : ""}" data-report-uid="${escapa(uid)}" data-report-alias="${escapa(nombre)}" data-report-context="${contexto}" aria-label="Denunciar a ${escapa(nombre)}" title="Denunciar">${compacto ? "⚑" : "Denunciar"}</button>`;
  }

  CT.Moderacion = { problema, ofensivo, reservado, botonDenuncia };
})();
