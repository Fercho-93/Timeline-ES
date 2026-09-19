# Organización de duelos por turnos

Esta mejora no cambia los dos ejes del juego: seguidos/turnos y ordenar/cifras.
Las siguientes funciones organizan los duelos por turnos:

- Revancha desde el historial o al finalizar: mismo rival, mazo y modalidad, nueva semilla de cartas. El rival debe aceptar.
- Siguiente turno pendiente: abre la partida más antigua que espera tu jugada. No permite saltar desde una carta que ya está en juego.
- Rivales recientes y favoritos en el perfil. Retar utiliza la última partida compartida. Los favoritos son locales al dispositivo y cuenta.
- Última jugada: muestra quién jugó, el resultado y el marcador, sin mostrar la siguiente carta.
- Recordatorio después de 48 horas sin actividad: uno por turno/invitación y como máximo uno por destinatario cada 24 horas. Caducidad después de 7 días sin actividad, manteniendo el historial.

Una invitación directa es privada entre emisor y destinatario; no necesita compartir enlace. Pulsaciones repetidas de Revancha sobre la misma partida reutilizan la misma invitación. Para continuar una serie de revanchas se usa la partida más reciente. Las invitaciones aparecen al abrir de nuevo el perfil; el listado no se actualiza en vivo mientras permanece abierto.

Los 3 segundos de preparación y 15 segundos de juego se mantienen. Reabrir una carta ya mostrada no reinicia el plazo guardado en ese dispositivo. No es una garantía antitrampas absoluta: la adjudicación y el temporizador siguen en el cliente.

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
npx.cmd firebase-tools emulators:exec --project demo-hilo --only firestore "node tests/duelo-turnos-reglas.mjs"
npm.cmd run build
```

`tests/duelo-layout.mjs` verifica tamaños móviles y escritorio con Playwright/Chrome, preparación, invitaciones privadas, historial, favoritos y ausencia de desbordamiento horizontal. No sustituye una prueba entre dos móviles reales tras desplegar.
