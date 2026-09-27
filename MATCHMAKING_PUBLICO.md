# Matchmaking público — Fase 1

Objetivo: añadir **Partida rápida** al multijugador online sin tocar el modo LAN/offline ni sustituir las salas privadas actuales.

## Experiencia MVP

1. El jugador entra en `Multijugador → Partida rápida`.
2. Elige tamaño de mesa: 2, 3 o 4 jugadores. En la primera iteración se puede fijar 4 por defecto.
3. Continuum busca una mesa pública compatible en estado `waiting`.
4. Si existe hueco, reserva la plaza mediante transacción de Firestore.
5. Si no existe, crea una mesa pública y queda esperando.
6. Cuando se llena, la sala pasa atómicamente a `starting` y muestra una cuenta atrás corta.
7. Después pasa a `playing` y reutiliza el motor online existente.

No hay chat, espectadores, ranking específico, filtros por nivel ni listado manual de mesas en esta fase.

## Principios

- **Firebase es la autoridad de emparejamiento.** Ningún teléfono decide por sí solo que una mesa está llena.
- **Entrada atómica.** Dos jugadores que intenten ocupar la última plaza no pueden entrar ambos.
- **Idempotencia.** Pulsar dos veces o reintentar tras una pérdida de red no debe meter al mismo UID dos veces.
- **Compatibilidad de cliente y mazo.** Se conservan `CLIENT_VERSION` y `deckFingerprint` para evitar partidas entre instalaciones incompatibles.
- **Separación de modos.** Sala privada, partida pública y LAN/offline mantienen flujos independientes.
- **Sin anfitrión funcional.** Puede conservarse un `hostUid` técnico para compatibilidad con el motor actual, pero no debe ser necesario para que la mesa pública sobreviva al abandono de quien la creó.

## Modelo propuesto

### `publicQueues/{queueKey}`

Documento pequeño usado únicamente para localizar/reservar una mesa abierta.

```js
{
  queueKey: "history-4-v42",
  mode: "history",
  capacity: 4,
  clientVersion: 42,
  roomCode: "ABCD2345",
  status: "waiting", // waiting | full
  members: [uid1, uid2],
  createdAt,
  updatedAt
}
```

`queueKey` separa modalidad, capacidad y versión compatible. La operación buscar/crear se ejecuta en una transacción.

### `rooms/{roomCode}`

Se reutiliza el documento de sala actual, añadiendo únicamente metadatos públicos:

```js
{
  matchmaking: {
    kind: "public",
    capacity: 4,
    queueKey: "history-4-v42"
  },
  status: "lobby", // después starting / playing
  ...camposActuales
}
```

El objetivo es no duplicar el motor de partida.

## Transacción `findOrCreatePublicMatch`

Pseudocódigo:

```text
asegurar autenticación
calcular queueKey(mode, capacity, clientVersion)
leer publicQueues/queueKey

si existe una cola waiting y el UID no está dentro:
    leer rooms/roomCode
    comprobar lobby + hueco + fingerprint + versión
    añadir UID a players/playerOrder y a queue.members
    si alcanza capacity:
        queue.status = full
        room.matchmaking.readyAt = serverTimestamp
    commit
si no existe una cola utilizable:
    crear roomCode aleatorio
    crear rooms/roomCode con el jugador
    crear/reemplazar publicQueues/queueKey apuntando a esa sala
    commit

conectar al listener normal de rooms/roomCode
```

Si una transacción pierde una carrera porque otra persona llenó la mesa, se reintenta la búsqueda; nunca se fuerza la entrada en una sala completa.

## Arranque

Al alcanzar `capacity`, la sala deja de aceptar jugadores. Para la primera versión:

- `readyAt` marca cuándo se completó.
- Todos muestran la misma pantalla `Mesa completa`.
- La transición real a `playing` debe ser una única escritura validada/atómica.
- Mientras el motor actual siga necesitando acciones de anfitrión para preparar/repartir, se asignará un coordinador técnico reemplazable. La evolución posterior moverá ese arranque a lógica de servidor si hace falta para eliminar totalmente esa dependencia.

## Abandono y reconexión

### Mientras espera

- Salir elimina al UID de la mesa mediante transacción.
- Si queda vacía, se elimina/invalida la cola.
- Si sale el coordinador técnico, otro miembro ocupa ese papel.

### Mesa completa / partida

- Una pérdida breve de conexión no libera inmediatamente la plaza.
- Se reutiliza `presence` para detectar reconexión.
- La Fase 1 no introduce bots; un abandono definitivo utiliza la lógica existente de salida/relevo siempre que sea compatible.

## Seguridad Firestore

Antes de activar la interfaz pública hay que ampliar `firestore.rules` para `publicQueues` y para los nuevos campos de `rooms`.

Las reglas deben impedir como mínimo:

- capacidades fuera de 2–4;
- que un usuario añada/elimine a otro arbitrariamente;
- superar la capacidad;
- cambiar `mode`, `clientVersion`, `roomCode` o `queueKey` después de crear la cola;
- entrar en una cola marcada `full`;
- apuntar una cola a una sala incompatible;
- modificar una partida pública sin pertenecer a ella.

No se publicará el botón de Partida rápida hasta que estas reglas tengan pruebas con el emulador.

## Pruebas obligatorias

1. Primer usuario crea cola y sala.
2. Segundo usuario encuentra y ocupa plaza.
3. Dos usuarios compiten por la última plaza: solo uno entra.
4. Doble toque/reintento del mismo UID: no se duplica.
5. Sala llena rechaza nuevas entradas.
6. Versiones o `deckFingerprint` distintos no se mezclan.
7. Usuario abandona mientras espera y libera plaza.
8. Creador abandona y la sala sigue siendo recuperable.
9. Corte de red y reconexión conservan la plaza.
10. Dos mesas simultáneas no mezclan jugadores.

## Orden de implementación

- [x] Diseñar flujo y modelo de datos.
- [ ] Crear módulo `public-matchmaking.js` con claves, validación y transacciones.
- [ ] Añadir reglas Firestore y pruebas de emulador.
- [ ] Integrar `Partida rápida` en `online.js`.
- [ ] Añadir sala de espera y cuenta atrás.
- [ ] Reutilizar arranque/motor de partida actual.
- [ ] Pruebas con 2 y 4 dispositivos y carreras simultáneas.
- [ ] Activar el acceso en la interfaz solo después de reglas + pruebas en verde.

## Fuera de Fase 1

Chat, ranking/ELO, filtros de nivel, mesas visibles, espectadores, invitaciones a una mesa pública, bots, temporadas y matchmaking por habilidad.
## Orden de juego y relevo del anfitrión

- **Quién empieza.** Al completarse la mesa se juega el mismo minijuego que en las salas
  privadas: el anfitrión técnico reparte una carta automáticamente y cada persona tiene 30
  segundos para escribir su cifra. La partida arranca sola en cuanto han respondido todos
  (o se agota el plazo). La mesa se sienta por orden de cercanía; quien no respondió juega
  al final.
- **Relevo automático.** Si el anfitrión técnico deja de dar señales (15 s si dejó la
  pantalla de la sala o la app pasó a segundo plano, 90 s si simplemente dejó de
  responder), la primera persona conectada de la mesa toma el relevo sin pulsar nada. En
  la sala de espera, además, se saca de la mesa a quien se fue y la cola vuelve a ofrecer
  la mesa (`status: waiting`).
- **Reglas.** Reordenar la mesa al empezar necesita la versión actual de
  `firestore.rules` (`validStart` admite una permutación de `playerOrder`). Con las
  reglas antiguas publicadas, el cliente reintenta sin reordenar: empieza quien ganó el
  minijuego, en el orden de entrada.
- **Mesas abandonadas.** Mientras alguien espera en una mesa con plazas libres, su móvil
  renueva la cola cada 45 s. Una cola sin renovar en dos minutos se da por abandonada: la
  búsqueda no entra en ella y abre una mesa nueva en su lugar (la regla de
  `publicQueues` lo permite). Con las reglas anteriores publicadas, el cliente entra en la
  mesa abandonada como antes y el relevo automático la pone en marcha.
- **Sala de espera.** En una mesa pública no se muestra quién es el anfitrión técnico: cada
  plaza dice solo su número y, si esa persona no da señal, «sin señal».
