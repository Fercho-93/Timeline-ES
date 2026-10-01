# Continuum — hoja de ruta

Estado revisado: 10 de septiembre de 2026.

Este documento distingue lo que está implementado en el repositorio de lo que requiere pruebas reales, credenciales, configuración externa o una decisión del titular.

## Estado resumido

- **Beta técnica privada:** aproximadamente 80–85%.
- **Beta con testers reales:** aproximadamente 65–70%.
- **Publicación comercial:** aproximadamente 45–55%.

Los porcentajes son orientativos: no sustituyen la ejecución de las pruebas ni la validación legal.

## 1. Ya implementado

- Modos local, competición, solitario, Pulso y Fantasma.
- Dificultades del solitario y modo Fantasma constante.
- Multijugador con salas, turnos, presencia, abandono y recuperación del anfitrión.
- Reglas de Firestore y pruebas contra emulador.
- Guardado, migración, compatibilidad, diagnóstico y actualización.
- Accesibilidad, movimiento reducido, teclado, lector de pantalla y navegación móvil.
- Capacitor con proyectos `android/` e `ios/`.
- `capacitor.config.json`, `dist/`, iconos y splash generables.
- Tests de juego, mazos, build, enlaces, reglas, Pulso, Fantasma y servidor experimental.
- Servidor experimental con validación de cartas y resultados del servidor.
- Documentación inicial de beta, distribución, privacidad, seguridad y derechos.
- Inventario de fuentes y arte.

## 2. Prioridad inmediata: dejar lista la beta privada

- [ ] Ejecutar `npm ci`, `npm test` y `npm run test:reglas`.
- [ ] Confirmar que el build móvil genera `dist/` correctamente.
- [ ] Publicar y verificar en Firebase las reglas correspondientes a la versión actual.
- [ ] Verificar App Check, cuotas, retención y alertas en un proyecto de ensayo.
- [ ] Probar la compilación en un Android físico.
- [ ] Repetir las pruebas en iPhone y Android: reconexión, bloqueo, pérdida de red, enlaces, actualización, orientación y áreas seguras.
- [x] Configurar el correo de feedback real.
- [ ] Preparar un registro de incidencias con prioridad P0–P3.
- [ ] Reclutar testers y registrar resultados sin datos personales innecesarios.

## 3. Contenido y derechos

- [ ] Revisar las 17 cartas de Naturaleza sin fuente cerrada.
- [ ] Comenzar por topo europeo y valores que mezclan medias, máximos, rangos o cautividad.
- [ ] Documentar población, unidad, criterio, fecha y fuente de cada cifra.
- [x] Documentar la procedencia declarada del arte, icono y splash; queda conservar la evidencia privada de generación.
- [ ] Registrar autor/generador, fecha, origen y condiciones de uso comercial.
- [ ] Revisar textos, fuentes y dependencias de terceros.
- [ ] No considerar una carta o recurso validado solo porque tenga una URL de referencia.

## 4. Seguridad para beta ampliada

- [ ] Confirmar que la configuración activa coincide con las reglas aprobadas.
- [ ] Activar y observar App Check antes de aplicar enforcement.
- [ ] Configurar TTL real para salas, presencia y registros asociados.
- [ ] Preparar borrado explícito de datos por usuario.
- [ ] Configurar límites, alertas y procedimiento de cierre ante abuso o costes anómalos.
- [ ] Mantener la competición pública desactivada mientras el servidor no esté desplegado.

## 5. Distribución móvil

- [ ] Crear/configurar cuenta Apple Developer y App Store Connect.
- [ ] Crear/configurar cuenta Google Play Console.
- [ ] Configurar certificados y secretos únicamente en GitHub Actions.
- [ ] Generar un AAB Android firmado.
- [x] Generar un archive iOS firmado.
- [ ] Probar TestFlight con testers externos y Google Play Closed Testing.
- [ ] Completar asociaciones de enlaces iOS/Android desde la raíz del dominio.
- [ ] Probar actualización conservando una partida y una sala pendiente.

## 6. Servidor de competición pública

- [ ] Elegir catálogo competitivo revisado y versionado.
- [ ] Desplegar el servidor detrás de HTTPS.
- [ ] Configurar Application Default Credentials y orígenes permitidos.
- [ ] Integrar la interfaz de la aplicación.
- [ ] Completar Fantasma, abandono, recuperación y controles globales.
- [ ] Revisar IAM, App Check nativo, revocación, cuotas y alertas.
- [ ] Ejecutar pruebas de carga y recuperación.
- [ ] No anunciar esta modalidad como disponible hasta terminar estos puntos.

## 7. Comercialización

- [ ] Comprobar disponibilidad de Continuum en OEPM/EUIPO y tiendas.
- [ ] Decidir la licencia definitiva del proyecto.
- [ ] Completar identidad del responsable, contacto y soporte.
- [ ] Revisar profesionalmente privacidad, retención y borrado.
- [ ] Completar cuestionarios de edad, Data Safety y privacidad de cada tienda.
- [ ] Generar capturas reales desde una compilación final.
- [ ] Validar comprensión, repetición y disposición a pagar.
- [ ] Decidir monetización después de la beta.
- [ ] Si se venden mazos: implementar compras oficiales, restauración, reembolsos y validación en servidor.
- [ ] **Cuentas que sobrevivan a reinstalar:** hoy cada instalación crea una cuenta anónima de Firebase; al desinstalar o cambiar de móvil se pierde el usuario y su nombre queda reservado por un uid inaccesible («Fer ya está cogido»). Vincular la cuenta anónima a «Iniciar sesión con Apple» (iPhone; Apple lo exige si se ofrece Google) y a Google (Android), con recuperación del nombre, el progreso y el ranking en otro móvil. Mientras tanto, para la beta: avisar a los testers y liberar a mano los nombres en `playerNames`.

## 8. Multijugador sin conexión (red local, sin internet)

Objetivo: que varias personas jueguen la misma partida en tiempo real sin ningún tipo de
conexión a internet ni cobertura (modo avión, zonas sin señal), usando solo una red Wi-Fi
local creada por uno de los móviles.

Decisión de arquitectura: capa de transporte intercambiable detrás de la lógica de sala ya
existente en `online.js` (turnos, Fantasma, Pulso, huella del mazo), con dos transportes
según el grupo de dispositivos.

### Fase 1 — Hotspot Wi-Fi + WebRTC + compartir del sistema (cubre cualquier grupo con al menos un Android)

- [x] Lógica de sala independiente de Firestore (`local-room.js`): un reductor puro
      (`createRoom` / `joinRoom` / `startRoom` / `placeCard` / `finishTurn` / `skipTurn` /
      `removePlayer`, con `reduce({type, ...})` como entrada única), con pruebas
      (`tests/sala-local.mjs`). Decisión de diseño: en vez de tocar el `online.js` que ya
      funciona en producción —1675 líneas con la UI, las reglas y Firestore mezclados—, se
      escribió aparte, con las mismas reglas, para no arriesgar el modo con internet que ya
      usan los testers. `online.js` no se ha tocado.
      **Alcance: las mismas reglas que la sala online** (minijuego de quién empieza, final
      secreta, Fantasma y Pulso); solo falta la competición por rondas.
- [x] Implementar el transporte sobre `RTCDataChannel` (`local-transport.js`), topología en
      estrella con el anfitrión como fuente de verdad (mismo modelo que las salas actuales).
      Cubre la conexión en sí (anfitrión/invitado, mensajes) y sus pruebas (`tests/transporte-local.mjs`).
- [x] Configurar WebRTC sin depender de un servidor STUN/TURN alcanzable (`iceServers: []`
      en `local-transport.js`; solo candidatos locales, sin trickle ICE).
- [x] Formato de señal (oferta/respuesta) codificado para cámara/QR — `encodeSignal` /
      `decodeSignal` en `local-transport.js`, con pruebas.
- [x] Enchufar `local-room.js` a `local-transport.js` (`local-session.js`): el anfitrión
      traduce cada mensaje del canal en una acción del reductor (`actionFromMessage`), la
      aplica y reparte la sala entera a todos ("state"), o contesta solo a quien se
      equivocó ("error") — sus propias jugadas pasan por el mismo camino. Un invitado nunca
      aplica el reductor por su cuenta: manda la acción y refleja lo que vuelve. Con
      pruebas (`tests/sesion-local.mjs`) que cubren el protocolo sin necesitar WebRTC de
      verdad, más el aviso claro (`WEBRTC_UNAVAILABLE`) donde sí hace falta.
- [x] Señalización 100% offline de verdad — cambio de plan: el QR que dibuja `online.js`
      está fijado a una versión pequeña (~106 bytes) para el enlace corto de sala; una señal
      WebRTC pesa varios cientos de bytes (huellas de seguridad y candidatos de red) y no
      cabe ahí. Escribir un generador de QR de mayor capacidad —y, aparte, un lector por
      cámara, que tampoco existe hoy— era demasiado para este paso. En su lugar,
      `local-share.js` manda la señal por el propio "compartir" del móvil (`navigator.share`:
      Bluetooth, AirDrop, Nearby Share, todo local sin internet), con el portapapeles como
      red de seguridad si el sistema no ofrece compartir. Con pruebas
      (`tests/compartir-local.mjs`).
- [x] Interfaz nueva "Sin conexión" (`local-multiplayer.js`) — incrustada en el juego de
      verdad, no en un archivo aparte: tercera opción en el menú real de "¿Cómo quieres
      jugar?" (junto a "Un solo móvil" y "Varios móviles"), reutilizando exactamente las
      clases de `styles.css`/`edition.css` que ya pinta `online.js` (`.panel`,
      `.online-form`, `.room-code-card`, `.lobby-table`, `.table-seat`, `.timeline-card`,
      `.hand-card`…). Sin `import()` dinámico: no descarga nada de fuera, así que se carga
      siempre con el resto de la aplicación, como `duelo.js`. Cubre crear sala, invitar,
      unirse, vestíbulo y una partida jugable de principio a fin (dentro del alcance de
      `local-room.js`: sin Fantasma, Pulso, torneo ni desempate de final secreta; sin
      sorteo de quién empieza — empieza siempre quien organiza la sala). Con aviso del
      punto de acceso Wi-Fi en la entrada, y pruebas de humo sobre el DOM real de
      `index.html` (`tests/multijugador-local.mjs`).
- [x] Código QR con lectura por cámara, para cuando "compartir" no tiene ningún destino en
      común entre los dos móviles — el caso real detectado por un tester: un Android y un
      iPhone en modo avión, sin Bluetooth emparejado ni AirDrop compatible entre sí, donde
      `local-share.js` (`navigator.share`) no tiene a quién entregar el texto. Dos rondas,
      las dos a partir de pruebas reales:
      - Primera ronda: generador de QR hecho a mano (versión 5, 106 bytes), heredado del de
        `online.js`. Una invitación completa no cabía ahí, así que se troceaba en 12-13
        códigos seguidos — probado en un Android/iPhone reales, imposible de leer a ese
        ritmo.
      - Segunda ronda, tras esa prueba: sustituido por `qrcode-generator` (vendorizado sin
        modificar, licencia MIT — ver `LICENSE-QRCODE-GENERATOR.txt`), que soporta las 40
        versiones del estándar QR. Una invitación completa (código de sala + huella del
        mazo + señal WebRTC) cabe siempre en un único código — nada que trocear ni
        reunir. `qr-encode.js` expone la misma interfaz de antes (`matrix`/`draw`) sobre
        esta librería; con pruebas que no solo generan el código sino que lo decodifican de
        verdad con `jsQR` sobre píxeles reales, para varios tamaños incluido uno del tamaño
        real de una invitación (`tests/qr-local.mjs`).
      - `qr-scanner.js`: lee la cámara con `getUserMedia` y decodifica con `jsQR`
        (`jsqr.js`, vendorizado sin modificar, licencia Apache-2.0 — ver
        `LICENSE-JSQR.txt`). Es la única pieza de esta funcionalidad que no se puede probar
        en Node (no hay cámara ni `RTCPeerConnection` en el entorno de pruebas). Pesa unos
        250 KB sin comprimir: no se carga con el resto de la aplicación —solo la primera
        vez que se abre la pantalla de escanear—, pero sí está en la lista de precarga del
        service worker, así que esa carga bajo demanda sigue funcionando sin conexión.
      - `local-multiplayer.js`: el código QR se dibuja directamente en la propia pantalla
        de invitar (anfitrión) o de compartir respuesta (invitado) — no detrás de un botón
        aparte. Compartir por Bluetooth/AirDrop o pegar a mano queda como alternativa
        plegada, para cuando la cámara no se pueda usar. De paso, se corrigió un fallo
        real: ni el anfitrión ni quien se unía pasaban solos al vestíbulo al conectar
        —tenían que salir y volver a mano—, porque `onRoomChange` no reaccionaba desde las
        pantallas de invitar/compartir, solo desde el vestíbulo o la partida.
- [x] Pulido de la partida (tras repasar el modo entero):
      - **Fallo que impedía jugar**: el anfitrión no tenía identificador propio en la
        interfaz y su pantalla se rompía al empezar la partida («Cannot read properties of
        undefined (reading 'hand')»). Ahora juega como cualquier otra plaza.
      - Varias personas sin cartas en la misma ronda juegan la final secreta
        (`CT.Final`), como en un solo móvil y en la sala online, en vez de dejar la
        partida atascada con `TIE_NOT_SUPPORTED_YET`. Saltar un turno también cierra la
        ronda.
      - Minijuego de quién empieza, igual que en las demás modalidades: la mesa se sienta
        por orden de cercanía (`CT.Starter`, compartido por todas).
      - Pulso y Fantasma, con las mismas reglas (`CT.Powers`, `CT.Ghost`,
        `CT.Engine.pulse`); quien defiende un Pulso lo coloca en su propio móvil.
      - Plaza reservada: si el canal de alguien se cae a mitad de partida, conserva su
        plaza y sus cartas (sus turnos se saltan) y vuelve a sentarse escaneando una
        invitación nueva. Sin internet no hay forma de reconectar sin volver a escanear;
        en la app instalada con la señal por LAN basta con escanear la invitación.
      - El «Tiempo por turno» ya funciona: cuenta atrás en todos los móviles y, al
        agotarse, el anfitrión pasa el turno.
      - Revancha con la misma mesa (`rematch` en el reductor): todos vuelven al vestíbulo.
      - Salidas y desconexiones: un invitado que sale avisa al anfitrión (sus cartas
        vuelven al descarte); si su canal se cae, el anfitrión lo saca de la mesa en vez
        de esperar su turno para siempre; si el anfitrión cierra la sala o se desconecta,
        el invitado vuelve a la entrada con un aviso. Un invitado ya no podía salir de la
        pantalla final (el botón no hacía nada); ahora sí.
      - Durante la partida, volver abre un menú de sala (guía, saltar turno, expulsar,
        salir) en vez de llevar al vestíbulo.
      - Cada canal queda atado a la persona que se unió por él: sus mensajes siempre
        hablan en su nombre, aunque manden otro identificador.
        Límite conocido: quien conozca el identificador de alguien desconectado podría
        ocupar su plaza (el identificador viaja en el estado de la sala); entre personas
        de la misma mesa se ha considerado aceptable.
      - `tests/multijugador-local.mjs` juega ahora una partida entera entre dos ventanas
        con un transporte simulado (todo lo demás es el código real).
- [ ] Probar en dispositivos reales, en modo avión, con grupos mixtos Android/iPhone —
      la conexión WebRTC en sí no se puede probar en Node (no hay `RTCPeerConnection`), y la
      lectura de QR por cámara tampoco (no hay cámara); todo lo de alrededor sí está
      probado. Con esto ya no hace falta ningún canal común entre los dos móviles: basta con
      que uno le enseñe la pantalla al otro.

### Fase 2 — Descubrimiento nativo sin hotspot manual (grupos homogéneos)

- [ ] Plugin de Capacitor para Android usando Nearby Connections (Bluetooth/Wi-Fi Direct
      automático, sin hotspot manual) para grupos 100% Android.
- [~] Escrito, **pendiente de compilar y probar en dos iPhones reales**: `LocalPeerPlugin.swift`
      (MultipeerConnectivity) + `local-peer.js`. El anfitrión se anuncia solo y los iPhones
      ven la lista de salas cercanas («Unirme a una sala → Buscar salas cercanas»), sin QR;
      Android y la web siguen por WebRTC y conviven en la misma sala. Requiere permiso de red
      local (`NSBonjourServices` en Info.plist). De paso se han añadido al proyecto de Xcode y
      registrado (`MainViewController.swift`) los plugins propios, que no estaban incluidos.
- [ ] Plugin de Capacitor para iOS usando MultipeerConnectivity (la tecnología de AirDrop)
      para grupos 100% iPhone, cubriendo el caso en que ningún iPhone pueda activar su
      Hotspot personal sin cobertura.
- [ ] Nota de alcance: estos dos frameworks no interoperan entre sí (un iPhone con
      MultipeerConnectivity no ve a un Android con Nearby Connections), así que en grupos
      mixtos sigue haciendo falta la Fase 1. Solo disponible en la app instalada, no en la
      versión web de GitHub Pages.

## 9. Límites de este roadmap

No se consideran completados por existir código o documentación:

- Una prueba en móvil real.
- Una publicación efectiva en Firebase, TestFlight o Google Play.
- Una licencia comercial del arte.
- La disponibilidad legal de la marca.
- La seguridad frente a clientes modificados.
- La preparación comercial de la competición pública.

## Criterio para declarar la beta preparada

La beta privada podrá considerarse preparada cuando:

1. Las suites automáticas estén verdes.
2. Las reglas activas de Firebase estén verificadas.
3. Exista una compilación móvil instalable.
4. Se haya probado al menos un iPhone y un Android reales.
5. No existan bloqueos P0/P1 conocidos.
6. El canal de feedback y la política provisional estén disponibles.
