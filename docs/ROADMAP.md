# Continuum — hoja de ruta

Estado revisado el 11 de octubre de 2026; los pendientes de la beta y de las tiendas se reunieron
aquí el 22 de octubre de 2026.

Este documento es la referencia única del estado del proyecto y el único sitio con la lista de
pendientes: distingue lo que está implementado en el repositorio de lo que requiere pruebas
reales, credenciales, configuración externa o una decisión del titular. Cómo se prueba a mano
y con testers está en [BETA_CHECKLIST.md](BETA_CHECKLIST.md); las fichas, las declaraciones y el
criterio de publicación, en [TIENDAS.md](TIENDAS.md#criterio-de-publicación).

## Estado resumido

- **Beta privada en iPhone:** en marcha por TestFlight, con compilaciones firmadas desde
  GitHub Actions.
- **Beta en Android:** el proyecto compila en CI; falta probarlo en un móvil real y crear la
  ficha de Google Play.
- **Publicación comercial:** pendiente de pruebas con testers, revisión legal, declaraciones de
  las tiendas y decisiones del titular.

## 1. Ya implementado

- Modos: solitario (cuatro dificultades), un solo móvil, competición por rondas, reto diario,
  Retos rápidos, duelo por enlace, duelos por turnos, salas online, mesas públicas y salas por
  Wi-Fi sin internet; poderes Pulso y Fantasma.
- Salas online con turnos, presencia, abandono, relevo del anfitrión, final numérica validada
  contra la carta (`CT.Final.valid`) y minijuego de quién empieza.
- Mesas públicas: tablón (`js/online/public-tables.js`) y partida rápida (`js/online/public-matchmaking.js`) para
  Grandes colecciones y Retos rápidos, con sus reglas y pruebas de emulador.
- Retos rápidos en red con comandos firmados por su autor (`by`), validados en `QuickRoom.validate`.
- Cuota de altas: una partida online nueva cada 10 s por persona (`creationQuota`) y una sala
  privada cada 30 s (`roomCreation`).
- Invitado anónimo automático, progreso sincronizado en Firestore (`playerProgress`), ranking
  diario y semanal opcional, y avatar elegible entre 36.
- **Iniciar sesión con Apple** en iPhone, con vinculación del invitado, cierre de sesión y
  borrado de cuenta con revocación del acceso.
- **Borrado de cuenta** desde el Atlas: perfil, alias, progreso, ranking, bloqueados,
  archivados, avisos y registros de cuota. Lo hace el servidor (`deleteMyAccount`, con las filas de ranking de
  todos los días y el acceso) y, si no responde, el móvil (`purgeServerData` en `js/nube/accounts.js`). El titular puede
  borrar a cualquiera con el workflow «Borrar cuenta de un jugador».
- **Limpieza diaria** de datos caducados (`purgeExpiredData`, plazos en `functions/retention.js`,
  ver [CONFIGURAR_MULTIJUGADOR.md](CONFIGURAR_MULTIJUGADOR.md#conservación-y-limpieza-de-datos)).
- **App Check** en la web (reCAPTCHA Enterprise) y en iPhone (App Attest). El *enforcement* aún
  no está activado.
- Reglas de Firestore publicadas automáticamente desde `main` tras pasar las pruebas del
  emulador; Cloud Functions publicadas con un workflow manual (ver «Despliegue» en
  [CONFIGURAR_MULTIJUGADOR.md](CONFIGURAR_MULTIJUGADOR.md#despliegue)).
- Dominio propio `continuumjuego.es` en GitHub Pages; **enlaces universales de iOS** verificados
  en TestFlight.
- Salas cercanas entre iPhones (MultipeerConnectivity) con **código de 4 cifras**: un código
  erróneo cierra el canal y el código cambia tras cinco intentos fallidos.
- Política de privacidad reescrita (`privacidad.html` y `PRIVACIDAD.md`), con plazos de
  conservación comprobados por `tests/retencion.mjs`.
- Cartas de Naturaleza (peso, longevidad y velocidad) con fuente en todas ellas.
- Guardado, migración, compatibilidad, diagnóstico y actualización.
- Accesibilidad, movimiento reducido, teclado, lector de pantalla y navegación móvil.
- Capacitor con proyectos `android/` e `ios/`, iconos y splash generables.
- Inventario de fuentes y de arte, y procedencia del arte documentada.
- Pruebas automáticas: una orden por suite en `npm test` y las suites de reglas en
  `npm run test:reglas` (ver [tests/README.md](../tests/README.md)).

## 2. Prioridad inmediata: beta privada

- [x] `npm ci`, `npm test` y `npm run test:reglas` en verde en CI.
- [x] El build móvil genera `dist/` correctamente.
- [x] Reglas publicadas automáticamente en Firebase desde `main`.
- [x] Correo de comentarios real.
- [x] Cartel remoto (`appConfig/current`) para pedir actualizar o pausar el online (ver [CONFIGURAR_MULTIJUGADOR.md](CONFIGURAR_MULTIJUGADOR.md#cartel-remoto-pedir-actualizar-o-pausar-el-online)).
- [ ] Comprobar en los registros de Cloud Functions que `purgeExpiredData` se ejecuta cada día.
- [ ] Activar el *enforcement* de App Check cuando las métricas muestren tráfico verificado
      (ver [SEGURIDAD_Y_OPERACION.md](SEGURIDAD_Y_OPERACION.md#app-check)).
- [ ] Alertas de presupuesto y observación de lecturas, escrituras y altas.
- [ ] Probar en un Android físico.
- [ ] Repetir en iPhone y Android las pruebas físicas de
      [BETA_CHECKLIST.md](BETA_CHECKLIST.md#pruebas-físicas): reconexión, bloqueo, pérdida de
      red, enlaces, actualización, orientación, áreas seguras y tabletas.
- [ ] Reclutar testers y registrar resultados sin datos personales innecesarios
      ([BETA_CHECKLIST.md](BETA_CHECKLIST.md#testers)); ampliar la beta solo cuando se cumplan
      sus [criterios](BETA_CHECKLIST.md#criterios-para-ampliar-la-beta).

## 3. Contenido y derechos

- [x] Fuente en todas las cartas de Naturaleza.
- [x] Procedencia declarada del arte, icono y splash; procedencia por carta del arte de Retos
      rápidos (`docs/arte-*.json`).
- [ ] Cerrar la auditoría factual carta por carta ([AUDITORIA_MAZOS.md](AUDITORIA_MAZOS.md)).
- [ ] Conservar la evidencia privada de generación del arte y los términos comerciales del
      servicio usado.
- [ ] Revisar textos, fuentes y dependencias de terceros.
- [ ] No considerar validada una carta solo porque tenga una URL de referencia.

## 4. Seguridad y operación

- [x] Limpieza programada de salas, presencia, duelos, mesas, colas, ranking y registros.
- [x] Borrado explícito de los datos de cada cuenta.
- [x] App Check en web e iPhone.
- [ ] App Check en Android: Play Integrity exige que la app esté en Google Play.
- [ ] Aplicar el *enforcement* de App Check (ver §2).
- [ ] Límites, alertas y procedimiento de cierre ante abuso o costes anómalos.
- [x] Moderación de alias: filtro de nombres ofensivos y reservados, botón «Denunciar» y colección `reports` (ver [CONFIGURAR_MULTIJUGADOR.md](CONFIGURAR_MULTIJUGADOR.md#denuncias-de-nombres)). El botón «Denunciar o bloquear» sirve también para bloquear (ranking, mesas, tablón, sala y duelos).
- [ ] Mantener fuera la competición pública arbitrada: exigiría un servidor autoritativo.

## 5. Cuentas

- [x] Invitado anónimo automático y nombre único.
- [x] Iniciar sesión con Apple (iPhone).
- [ ] Iniciar sesión con Google (Android y web) para conservar la cuenta al reinstalar. Mientras
      tanto, en Android y en la web, desinstalar o borrar los datos deja el invitado inaccesible
      y su nombre reservado hasta la limpieza anual de invitados sin uso.

## 6. Distribución móvil

- [x] Cuenta Apple Developer y App Store Connect.
- [x] Certificados y secretos únicamente en GitHub Actions.
- [x] Archive iOS firmado y subida a TestFlight (al cambiar `.github/beta-request.json`).
- [x] Enlaces universales de iOS (`apple-app-site-association`).
- [ ] Enlaces de Android: falta la huella del certificado y `assetlinks.json`.
- [ ] Cuenta de Google Play Console.
- [ ] AAB Android firmado y probado; Google Play Closed Testing.
- [ ] TestFlight con testers externos.
- [ ] Avisos del móvil: las Cloud Functions envían avisos, pero el registro del dispositivo
      (`js/nube/push.js`) está apagado con `nativePush: false` en `js/nube/deployment.js` (`tests/push-apagado.mjs`): falta
      `google-services.json` en Android, `aps-environment` en iPhone y la integración de APNs con FCM.
      Al activarlo, declarar el token del dispositivo en las tiendas y en la política.
- [ ] Prueba de actualización conservando una partida y una sala pendiente.

## 7. Servidor de competición pública

Fuera de alcance mientras no haga falta: si algún día se quiere competición pública arbitrada, el
diseño (y el prototipo retirado que sigue en el historial de git) está en
[SEGURIDAD_Y_OPERACION.md](SEGURIDAD_Y_OPERACION.md#arquitectura-para-una-futura-competición-pública).

## 8. Lanzamiento

- [ ] Comprobar la disponibilidad de Continuum en OEPM/EUIPO y tiendas.
- [ ] Decidir la licencia definitiva del proyecto.
- [x] App Store Connect: declarado «no comerciante» el 21 de octubre de 2026 (juego gratuito, sin ingresos; ver
      [TIENDAS.md](TIENDAS.md#decisión-del-titular-21-de-octubre-de-2026-gratis-al-lanzar-ventas-más-adelante)).
- [ ] Play Console: declararse «no comerciante» al crear la ficha.
- [ ] (Futuro, solo si compensa) Lanzar las compras (colecciones y mazos): condiciones de venta, política de privacidad sin «no hay compras» y con una sección «Compras» (cobran Apple o Google; el juego no ve datos de pago; qué se guarda para desbloquear y restaurar), restauración de compras, reglas de menores de las tiendas. Antes: ser comerciante, NIF y dirección física públicos y gestoría (ver `docs/TIENDAS.md`).
- [ ] Revisión legal (por un abogado: los textos publicados son borradores, no asesoramiento
      jurídico) de la política de privacidad, las condiciones de uso, el aviso legal, la página de
      soporte, la de borrado de cuenta, los plazos de conservación y las declaraciones de cada
      tienda.
- [ ] Rellenar los cuestionarios de edad, público objetivo, «Privacidad de la app» y «Seguridad de los
      datos» con las respuestas de [TIENDAS.md](TIENDAS.md) al crear las fichas.
- [ ] Capturas reales desde una compilación final e icono definitivo.
- [ ] Revisar la descripción de la ficha de cada tienda.
- [ ] Validar comprensión, repetición y disposición a pagar con testers.
- [ ] Decidir la monetización después de la beta; si se venden mazos, compras oficiales,
      restauración, reembolsos y validación en servidor.
- [ ] **Empezar de cero al salir a la App Store** (decidido por el titular): borrar todas las
      cuentas y datos de la beta para que nadie arrastre progreso, ranking ni alias de prueba.
      Pasos, el mismo día de la publicación y antes de abrirla:
      1. Avisar a los testers con antelación de que su progreso se borrará.
      2. Firebase Authentication: borrar todos los usuarios (invitados y vinculados con Apple).
      3. Firestore: borrar todas las colecciones (perfiles, progreso, ranking, salas, duelos,
         mesas, cuotas y registros de avisos).
      4. En el código, cambiar `SEASON` de `js/jugador/account-storage.js` (`'launch-1'` → `'launch-2'`)
         para que las copias guardadas en los móviles de la beta no se suban a las cuentas nuevas,
         y subir la caché.
      5. Quitar de `privacidad.html` y `PRIVACIDAD.md` la frase sobre el correo de Apple de
         quienes vincularon antes del 10 de octubre de 2026: con el borrado deja de existir.
      Conviene preparar un script o workflow de un solo uso para los pasos 2 y 3 cuando llegue el momento.

## 9. Multijugador sin internet

Objetivo: que varias personas jueguen la misma partida en tiempo real sin conexión a internet
(modo avión, zonas sin cobertura), con la misma experiencia que la sala online.

### Fase 1 — Wi-Fi local + WebRTC + QR (cualquier grupo)

Hecho. Arquitectura:

- `js/sin-conexion/local-room.js`: reductor puro con las mismas reglas que la sala online (minijuego de quién
  empieza, final secreta, Pulso, Fantasma, revancha y competición por rondas). Se escribió
  aparte de `js/online/online.js` para no arriesgar el modo con internet.
- `js/sin-conexion/local-transport.js`: `RTCDataChannel` en estrella con el anfitrión como fuente de verdad, sin
  servidores STUN/TURN (solo candidatos locales).
- `js/sin-conexion/local-session.js`: traduce cada mensaje en una acción del reductor. Un invitado nunca aplica
  el reductor: manda la acción y refleja lo que vuelve. Cada canal queda atado a quien se unió
  por él, y el identificador, el nombre y el avatar que llegan de otro móvil se validan antes de
  aceptarlos.
- Señalización sin internet: la invitación completa cabe en un único QR (`qrcode-generator`,
  MIT) que se lee con la cámara (`js/sin-conexion/qr-scanner.js` con `jsQR`, Apache-2.0); compartir por el
  sistema o pegar el texto queda como alternativa.
- Interfaz en `js/sin-conexion/local-multiplayer.js`, dentro de «Cada uno en su móvil».
- Pruebas: `sala-local`, `transporte-local`, `sesion-local`, `compartir-local`, `qr-local`,
  `multijugador-local` y `competicion-wifi`.
- Límite conocido: quien conozca el identificador de alguien desconectado podría ocupar su
  plaza; entre personas de la misma mesa se considera aceptable.

Pendiente:

- [ ] Probar en dispositivos reales, en modo avión, con grupos mixtos Android/iPhone. WebRTC y la
      cámara no se pueden probar en Node; todo lo de alrededor sí está probado.

### Fase 2 — Descubrimiento nativo sin QR

- [x] iPhone con iPhone: `LocalPeerPlugin.swift` (MultipeerConnectivity) + `js/sin-conexion/local-peer.js`. Los
      iPhones ven las salas cercanas («Unirme a una sala → Buscar salas cercanas») y entran con
      el código de 4 cifras que ve el anfitrión; Android y la web siguen por WebRTC en la misma
      sala (`tests/multijugador-cercano.mjs`).
- [ ] Probarlo en dos iPhones reales con la compilación actual.
- [ ] Android con Android: plugin de Nearby Connections, sin punto de acceso manual.
- Nota: MultipeerConnectivity y Nearby Connections no interoperan, así que en grupos mixtos
  sigue haciendo falta la Fase 1. Solo en la app instalada, no en la web.

## 10. Límites de esta hoja de ruta

No se consideran completados por existir código o documentación:

- Una prueba en móvil real.
- Una publicación efectiva en Google Play o una beta externa de TestFlight.
- Una licencia comercial del arte.
- La disponibilidad legal de la marca.
- La seguridad frente a clientes modificados.
- La preparación comercial de la competición pública.

## Cuándo se da algo por listo

El criterio para dar por buena una compilación de tienda está en
[TIENDAS.md](TIENDAS.md#criterio-de-publicación); el de ampliar la beta, en
[BETA_CHECKLIST.md](BETA_CHECKLIST.md#criterios-para-ampliar-la-beta).
