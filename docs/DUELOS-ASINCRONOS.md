# Duelos por turnos

Un duelo por turnos se juega entre dos cuentas, cada una cuando puede. Se crea desde
**Jugar con amigos → Cada uno en su móvil → Crear partida**, eligiendo el ritmo **Por turnos**, y
se sigue en **Tus partidas**. El código está en `js/online/duelo-turnos.js` (Grandes colecciones,
colección `turnDuels`) y en `js/retos/quick-challenges.js` / `js/retos/quick-online.js` para los duelos de Retos
rápidos (salas de dos en `quickRooms`). Los dos ejes del juego siguen igual: ordenar o cifras.

## Organización

- Revancha desde el historial o al terminar: mismo rival, mazo y modalidad, nueva semilla. El
  rival debe aceptar.
- Siguiente turno pendiente: abre la partida más antigua que espera tu jugada. No permite saltar
  desde una carta que ya está en juego.
- Rivales recientes y favoritos. Retar utiliza la última partida compartida. Los favoritos son
  locales al dispositivo y a la cuenta.
- Última jugada: quién jugó, el resultado y el marcador, sin enseñar la siguiente carta.
- Recordatorio a las 48 horas sin actividad: uno por turno o invitación y como máximo uno por
  destinatario cada 24 horas. Caducidad a los 7 días sin actividad, conservando el historial.

Una invitación directa es privada entre emisor y destinatario; no necesita enlace. Pulsar varias
veces reutiliza la invitación pendiente. Al terminar, cancelar o caducar se permite otro reto.
Crear por enlace también reutiliza una invitación abierta del mismo mazo y modalidad; reenviar
comparte el mismo enlace sin crear documentos nuevos. Las invitaciones aparecen al abrir de nuevo
la lista; no se actualiza en vivo mientras está abierta.

## Tiempo, resultados y conexión

El tiempo por carta se elige al crear el duelo: **sin tiempo, 15, 20 o 30 segundos** (`js/juego/tiempo.js`,
los mismos valores que admiten las reglas). No hay pantalla de «listo»: el plazo empieza al
descubrir la carta y se guarda en el dispositivo, así que volver a entrar no lo reinicia. Si se
agota, la jugada cuenta como fallo por tiempo. Sin plazo, lo que se tarda queda solo como dato.

La solución usa los mismos formatos de valor, explicación, posición correcta y valoración de
cifras del resto del juego. Solo se muestra una carta ya resuelta, nunca la pendiente.

La jugada se guarda en local antes de enviarse, con un identificador único y el tiempo de
respuesta congelado. La pantalla distingue envío pendiente y confirmado. Una transacción detecta si
ya se aplicó la misma jugada, aunque se perdiera su confirmación. Se reintenta al recuperar
conexión, al abrir la lista o el duelo, a mano o cada 15 segundos mientras la página sigue viva.
Una partida ya cerrada o un turno resuelto desde otro dispositivo no se reescriben.

La cola pertenece a la cuenta y al dispositivo: no borrar el almacenamiento con envíos
pendientes. Sin espacio se avisa y no se envía una respuesta sin protección local. No hay envío en
segundo plano con la app cerrada: continúa al volver. No es una garantía antitrampas: la
adjudicación y el temporizador están en el cliente.

## Cancelar, rendirse, archivar y bloquear

- Una invitación pendiente se cancela o rechaza sin victoria ni derrota.
- Rendirse en una partida aceptada da la victoria al rival, sin alterar las jugadas anteriores.
  Hay confirmación previa. Si la invitación se aceptó mientras se intentaba cancelar, se pide
  revisarla; nunca se convierte ese toque en una rendición.
- Archivar solo oculta una partida terminada de tu lista. Se restaura desde Archivados y no afecta
  al otro jugador. Se sincroniza por cuenta.
- El cara a cara cuenta victorias, derrotas y empates por separado en ordenar y cifras. Incluye
  rendiciones y archivadas; excluye cancelaciones y caducidades.
- Bloquear impide crear o aceptar nuevas invitaciones entre esas cuentas, directas o por enlace, y
  suprime sus avisos. No interrumpe partidas ya aceptadas ni impide volver con otra cuenta. Se
  puede desbloquear cuando se quiera.

Las preferencias de archivo y bloqueo viven en `duelPreferences/{uid}/archived` y `.../blocked`;
el rival no puede leerlas ni modificarlas.

## Servidor

Las Cloud Functions que intervienen (todas en `functions/index.js`):

- `notifyTurnDuel`: avisa a quien le toca cuando cambia el turno de un duelo.
- `notifyQuickDuel`: lo mismo en los duelos de Retos rápidos, y avisa del final.
- `notifyDuelInvitation`: avisa de un reto nuevo, salvo bloqueo.
- `maintainTurnDuels`: cada hora, recordatorios y caducidad a los 7 días. Los avisos y la
  caducidad del servidor pueden demorarse hasta esa revisión; el cliente muestra la caducidad y
  las reglas rechazan jugadas desde los siete días.
- `purgeExpiredData`: cada día borra los duelos y salas de Retos rápidos con 30 días sin
  actividad y los registros técnicos de avisos.

Se publican a mano con el workflow «Publicar Cloud Functions» y las reglas se publican solas
desde `main`: ver [CONFIGURAR_MULTIJUGADOR.md](CONFIGURAR_MULTIJUGADOR.md#despliegue).

`duelNotificationEvents` (eventos ya procesados, para no repetir avisos; sin tokens) y
`duelReminderBudgets` (último recordatorio por destinatario) solo son accesibles por el
servidor.

**Avisos del móvil:** las Functions envían por Firebase Cloud Messaging a los tokens guardados en
`playerProfiles/{uid}/pushTokens`, pero la app todavía no registra el dispositivo (`js/nube/push.js` no se
inicia) y falta integrar el token APNs de iOS con FCM. Mientras tanto, el navegador puede mostrar
un aviso local cuando te toca y no tienes la pestaña a la vista. Los fallos de entrega no se
reintentan, para evitar duplicados.

## Verificación

```sh
node tests/duelo-policy.cjs
node tests/duelo-state.mjs
node tests/quick-duelo.mjs
npm run test:reglas   # incluye duelo-turnos-reglas.mjs
npm run build
```

`tests/duelo-layout.mjs` y `tests/turn-duel-layout-browser.mjs` verifican la maquetación en
navegador con Playwright. Nada de esto sustituye una prueba entre dos móviles reales.
