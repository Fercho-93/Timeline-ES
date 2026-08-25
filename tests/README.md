# Comprobaciones

Las dependencias no se guardan en el repositorio; se instalan solo para pasar las pruebas
(`.gitignore` ya ignora `node_modules`).

```sh
npm install --no-save jsdom @firebase/rules-unit-testing firebase

# Partida completa del modo de un solo móvil sobre un DOM simulado.
node tests/partida-local.mjs

# 40 partidas al azar: bloqueos, conteo de cartas y orden de la línea temporal.
node tests/partidas-al-azar.mjs

# Reglas de Firestore contra el emulador oficial (necesita Java instalado).
npx --yes firebase-tools emulators:exec --project demo-hilo --only firestore \
  "node tests/reglas-firestore.mjs"
```

`reglas-firestore.mjs` cubre quién puede escribir en una sala y qué puede escribir:
entrar, empezar, colocar carta, cerrar turno, saltar turno, expulsar, marcharse y una
docena de intentos de trampa (vaciarse la mano, repartirse cartas, declararse ganador
con cartas, expulsar al anfitrión). Si alguna denegación se explica por el límite de
1000 expresiones de Firestore en vez de por la propia regla, el emulador lo imprime:
esa señal no debe aparecer.
