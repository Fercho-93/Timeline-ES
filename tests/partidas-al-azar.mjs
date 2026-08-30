// 40 partidas al azar: nadie debe quedarse bloqueado y las cartas no se crean ni se pierden.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");
// La lista de scripts sale de index.html, para no repetirla en cada prueba.
const guiones = () => [...read("index.html").matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const boot = () => {
  const dom = new JSDOM(read("index.html").replace(/<script src="[^"]*"><\/script>/g, ""), { runScripts: "outside-only", url: "https://hilo.test/" });
  guiones().forEach(archivo => dom.window.eval(read(archivo)));
  return dom.window;
};
const fire = (w, el) => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
let problems = 0, games = 0, sharedWins = 0, returns = 0;

const catalogo = [
  ["history", "historia", "HISTORY_CARDS"], ["world", "historia", "WORLD_CARDS"],
  ["inventions", "historia", "INVENTION_CARDS"], ["movies", "cine", "MOVIE_CARDS"],
  ["music", "cine", "MUSIC_CARDS"], ["videogames", "cine", "VIDEOGAME_CARDS"],
  ["animals", "naturaleza", "ANIMAL_WEIGHT_CARDS"], ["lifespan", "naturaleza", "ANIMAL_LIFESPAN_CARDS"], ["speed", "naturaleza", "ANIMAL_SPEED_CARDS"],
  ["astronomy", "ciencia", "ASTRONOMY_CARDS"], ["medicine", "ciencia", "MEDICINE_CARDS"],
  ["countries", "geografia", "COUNTRY_CARDS"], ["population", "geografia", "POPULATION_CARDS"],
  ["distances", "geografia", "CITY_DISTANCE_CARDS"]
];

for (let g = 0; g < 40; g++) {
  const w = boot();
  const [mode, block, globalName] = catalogo[g % catalogo.length];
  // Hay que abrir antes el bloque: la portada solo lista los juegos del bloque en pantalla.
  fire(w, w.document.querySelector(`[data-block="${block}"]`));
  fire(w, w.document.querySelector(`[data-mode="${mode}"]`));
  const mazo = w[globalName];
  const total = mazo.length;
  const cardsById = new Map(mazo.map(c => [c.id, c]));
  const orden = card => (["countries", "population", "animals", "lifespan", "speed", "distances"].includes(mode) ? card.value : card.year);
  fire(w, w.document.querySelector('[data-action="setup"]'));
  const players = 2 + (g % 8);
  for (let i = 2; i < players; i++) fire(w, w.document.querySelector('[data-action="add-player"]'));
  // Un mazo mínimo de 38 cartas admite nueve jugadores con cuatro cartas y deja dos
  // cartas para iniciar y continuar. La simulación no puede pedir más de lo que hay.
  const mano = Math.min(1 + (g % 6), Math.floor((total - 2) / players));
  w.document.getElementById("hand-size").value = String(mano);
  fire(w, w.document.querySelector('[data-action="start"]'));
  const key = `hilo-game-${mode}-v1`;
  let turns = 0;
  while (!/gana(n)?<\/h1>/.test(w.document.body.innerHTML)) {
    if (++turns > 3000) { console.log(`  FALLA partida ${g}: no termina`); problems++; break; }
    const ready = w.document.querySelector('[data-action="ready"]');
    if (!ready) { console.log(`  FALLA partida ${g}: pantalla sin salida`); problems++; break; }
    fire(w, ready);
    const hand = [...w.document.querySelectorAll('[data-action="select-card"]')];
    if (!hand.length) { console.log(`  FALLA partida ${g}: turno con la mano vacía`); problems++; break; }
    const pick = hand[Math.floor(Math.random() * hand.length)];
    const id = Number(pick.dataset.id);
    fire(w, pick);
    const stateBefore = JSON.parse(w.localStorage.getItem(key));
    const values = stateBefore.timeline.map(cid => orden(cardsById.get(cid)));
    let index = values.findIndex(value => value > orden(cardsById.get(id)));
    if (index < 0) index = values.length;
    if (Math.random() < 0.35) index = Math.floor(Math.random() * (values.length + 1)); // juega mal a menudo
    fire(w, w.document.querySelectorAll('[data-action="place"]')[index]);
  fire(w, w.document.querySelector('[data-action="confirm-place"]'));
    if (/vuelve a tu mano/.test(w.document.querySelector(".modal")?.innerHTML || "")) returns++;
    fire(w, w.document.querySelector('[data-action="finish-turn"]'));
    const state = JSON.parse(w.localStorage.getItem(key));
    const counted = state.deck.length + state.discard.length + state.timeline.length + state.players.reduce((n, p) => n + p.hand.length, 0);
    if (counted !== total) { console.log(`  FALLA partida ${g}: ${counted} cartas de ${total}`); problems++; break; }
    const dupes = new Set([...state.deck, ...state.discard, ...state.timeline, ...state.players.flatMap(p => p.hand)]).size !== total;
    if (dupes) { console.log(`  FALLA partida ${g}: cartas duplicadas`); problems++; break; }
    const line = state.timeline.map(cid => orden(cardsById.get(cid)));
    if (line.some((y, i) => i && y < line[i - 1])) { console.log(`  FALLA partida ${g}: línea desordenada`); problems++; break; }
  }
  if (/ganan<\/h1>/.test(w.document.body.innerHTML)) sharedWins++;
  games++;
}
console.log(`${games} partidas jugadas · ${sharedWins} terminadas en empate por falta de mazo · ${returns} cartas devueltas a la mano · ${problems} problemas`);
process.exit(problems ? 1 : 0);
