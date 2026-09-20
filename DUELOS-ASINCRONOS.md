# Organización de duelos por turnos

Esta mejora no cambia los dos ejes del juego: seguidos/turnos y ordenar/cifras.
Las siguientes funciones organizan los duelos por turnos:

- Revancha desde el historial o al finalizar: mismo rival, mazo y modalidad, nueva semilla de cartas. El rival debe aceptar.
- Siguiente turno pendiente: abre la partida más antigua que espera tu jugada. No permite saltar desde una carta que ya está en juego.
- Rivales recientes y favoritos en el perfil. Retar utiliza la última partida compartida. Los favoritos son locales al dispositivo y cuenta.
- Última jugada: muestra quién jugó, el resultado y el marcador, sin mostrar la siguiente carta.
- Recordatorio después de 48 horas sin actividad: uno por turno/invitación y como máximo uno por destinatario cada 24 horas. Caducidad después de 7 días sin actividad, manteniendo el historial.

Una invitación directa es privada entre emisor y destinatario; no necesita compartir enlace. Pulsaciones repetidas reutilizan la invitación pendiente. Al terminar, cancelar o caducar se permite otro reto. El identificador de las nuevas invitaciones mantiene una longitud acotada durante una serie de revanchas. Crear por enlace también reutiliza una invitación abierta del mismo mazo/modalidad. Reenviar comparte el mismo enlace, sin crear documentos nuevos. Las invitaciones aparecen al abrir de nuevo el perfil; el listado no se actualiza en vivo mientras permanece abierto.

## Preparación, resultados y conexión

Antes de descubrir una carta se muestra rival, marcador y última jugada. «Estoy listo» inicia los 3 segundos de preparación y después los 15 de juego. El plazo se guarda antes de descubrirla; volver a entrar no lo reinicia. Sin conexión no se permite iniciar una carta nueva.

La solución usa los mismos formatos de valor, explicación, posición correcta y valoración de cifras del resto del juego. Se muestra únicamente una carta ya resuelta, nunca la pendiente. Las cifras enseñan respuesta, diferencia y puntos. La cuenta de velocidad se calcula sobre los 15 segundos de este modo.

La jugada se guarda localmente antes de enviarse con un identificador único y el tiempo de respuesta congelado. La pantalla distingue envío pendiente y confirmado. Una transacción detecta si ya se aplicó la misma jugada, incluso si se perdió su confirmación. Se reintenta al recuperar conexión, al abrir el perfil/duelo, manualmente o cada 15 segundos mientras la página sigue viva. Navegar a otra partida no cambia el destino del envío. Una partida ya cerrada o un turno resuelto por otro dispositivo no se reescriben.

La cola pertenece a la cuenta y al dispositivo. No se debe borrar el almacenamiento mientras haya envíos pendientes. Sin espacio disponible se avisa y no se envía una respuesta sin protección local. No hay ejecución en segundo plano con el navegador cerrado: el envío continúa al regresar. No es una garantía antitrampas absoluta: la adjudicación y el temporizador siguen en el cliente.

## Cancelar, rendirse, archivar y bloquear

- Una invitación pendiente se cancela/rechaza sin victoria ni derrota.
- Rendirse en una partida aceptada otorga la victoria al rival, sin alterar las puntuaciones ni las jugadas anteriores. Hay confirmación previa. Si la invitación fue aceptada mientras se intentaba cancelar, se pide revisarla; nunca se transforma ese clic en una rendición accidental.
- Archivar solo oculta una partida terminada de tu listado principal. Se puede restaurar desde Archivados y no afecta al otro jugador. Esta preferencia se sincroniza por cuenta.
- El cara a cara cuenta victorias, derrotas y empates por separado en ordenar/cifras. Incluye rendiciones y partidas archivadas; excluye cancelaciones y caducidades.
- Bloquear retos impide crear o aceptar nuevas invitaciones entre esas cuentas, tanto directas como por enlace. No interrumpe partidas ya aceptadas. Se puede desbloquear desde el perfil. Los recordatorios de invitaciones bloqueadas se suprimen al desplegar las funciones actualizadas. No impide que una persona vuelva con otra cuenta.

Las preferencias privadas de archivo/bloqueo viven en `duelPreferences/{uid}` y no son modificables por el rival. Requieren publicar las nuevas reglas.

## Activación en Firebase

El código en GitHub no publica automáticamente las reglas ni las funciones. Desde la carpeta del repositorio actualizado, en PowerShell:

```powershell
npm.cmd install --prefix functions
npx.cmd firebase-tools login
npx.cmd firebase-tools deploy --project timeline-es --only "firestore:rules,functions"
```

Si se copian las reglas manualmente, copiar todo `firestore.rules` a Firestore > Reglas y publicar. Eso no sustituye el despliegue de Functions. El trabajo programado requiere la facturación/servicios de Cloud Functions y Cloud Scheduler habilitados; revisar sus costes antes de activarlos.

Funciones publicadas: `notifyTurnDuel`, `notifyDuelInvitation`, `maintainTurnDuels`. El mantenimiento se ejecuta cada hora; los avisos y la caducidad del servidor pueden demorarse hasta esa revisión. El cliente muestra la caducidad y las reglas rechazan nuevas jugadas desde los siete días.

Los avisos push requieren la configuración nativa y permisos de notificación. Esta entrega no verifica la entrega push en dispositivos físicos ni soluciona la integración pendiente del token APNs de iOS con FCM. No habilita avisos con Safari/Chrome cerrados. Los fallos de entrega no se reintentan automáticamente para evitar duplicados.

Los registros internos `duelNotificationEvents` y `duelReminderBudgets` solo son accesibles por el servidor. Los primeros conservan identificadores de eventos procesados para evitar avisos duplicados; no contienen tokens.

## Verificación

```powershell
node tests/duelo-policy.cjs
node tests/duelo-state.mjs
npx.cmd firebase-tools emulators:exec --project demo-hilo --only firestore "node tests/duelo-turnos-reglas.mjs"
npm.cmd run build
```

`tests/duelo-layout.mjs` verifica tamaños móviles y escritorio con Playwright/Chrome, preparación, invitaciones privadas, historial, favoritos y ausencia de desbordamiento horizontal. No sustituye una prueba entre dos móviles reales tras desplegar.
