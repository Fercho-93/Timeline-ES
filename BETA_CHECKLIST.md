# Continuum — beta: pruebas, testers y lanzamiento

Lista de comprobación de la beta y guía para trabajar con testers. El estado general vive en
[ROADMAP.md](ROADMAP.md); la ficha y las declaraciones de las tiendas, en
[docs/TIENDAS.md](docs/TIENDAS.md); cómo se publica cada pieza, en la sección «Despliegue» de
[CONFIGURAR_MULTIJUGADOR.md](CONFIGURAR_MULTIJUGADOR.md#despliegue).

## Público y propuesta

Hipótesis a validar: familias y grupos de amigos que quieren jugar y aprender comparando
hechos, sin estudiar reglas largas. Propuesta: colocar una carta, descubrir su explicación y
compartir una partida breve en el mismo móvil, en una sala o en un duelo. No se considera
validada hasta observar uso real y repetición voluntaria.

## A. Comprobación automática

- [ ] `npm ci`
- [ ] `npm test`
- [ ] `npm run test:reglas`
- [ ] `npm run build`
- [ ] `npx cap sync`
- [ ] Sin referencias visibles a la marca anterior (lo vigila `tests/marca.mjs`).
- [ ] Las imágenes referenciadas existen en `dist/` (`tests/build-movil.mjs`).
- [ ] El service worker sirve la versión actual: `CACHE`, `CT.APP_VERSION` y `edition.css?v=`
      subidos juntos (ver `CLAUDE.md`).

## B. Pruebas del juego

- [ ] Partida en un solo móvil completa.
- [ ] Competición completa (solo, un solo móvil y cada uno en su móvil).
- [ ] Solitario Fácil, Normal, Difícil y Experto.
- [ ] Reto diario de Grandes colecciones y de Retos rápidos.
- [ ] Retos rápidos: solo, un solo móvil, sala online, Wi-Fi y duelo.
- [ ] Pulso con acierto de ambas personas, fallo de quien reta y fallo de quien defiende.
- [ ] Fantasma en partida local y en sala online.
- [ ] Empates y final numérica.
- [ ] Abandono de jugador; desconexión del anfitrión y relevo.
- [ ] Mesa pública: crear, sentarse desde el tablón y partida rápida.
- [ ] Duelo por turnos: invitar, aceptar, jugar, revancha, rendirse, archivar y bloquear.
- [ ] Duelo por enlace (mismas cartas), en orden y en cifras.
- [ ] Ranking: aceptar, dejar de aparecer y volver a aparecer.
- [ ] Apple: vincular, cerrar sesión, volver a entrar y eliminar la cuenta.
- [ ] Reanudación de partida guardada y actualización sin perder progreso.
- [ ] Entrada por enlace, por QR y por código.

## C. Pruebas físicas

Registrar dispositivo, sistema, versión de Continuum (Ajustes → «Versión y conexión») y
resultado. No registrar nombres reales salvo que sea imprescindible. Las comprobaciones
automáticas no sustituyen estas pruebas.

- [x] iPhone real (TestFlight).
- [ ] Android real.
- [ ] Invitación con la app abierta, cerrada y sin instalar.
- [ ] Enlace universal de `continuumjuego.es` en Android (falta `assetlinks.json`).
- [ ] Cambio de aplicación y regreso; bloqueo y desbloqueo de pantalla.
- [ ] Pérdida de red y reconexión.
- [ ] Modo avión en partida local y sala Wi-Fi entre Android e iPhone.
- [ ] Salas cercanas entre dos iPhone, con el código de 4 cifras.
- [ ] Orientación vertical y horizontal; áreas seguras del iPhone.
- [ ] iPad real (o tableta Android), en vertical y en horizontal: la partida a dos columnas en horizontal, girar la tableta en plena partida, Split View estrecho y áreas seguras (el diseño de tabletas se ha probado en navegador, no en un iPad).
- [ ] Teclado y campos de nombre; tamaño de letra grande.
- [ ] Lector de pantalla y movimiento reducido.
- [ ] Gesto Atrás de Android.
- [ ] Actualización conservando una partida y con una sala pendiente.

## D. Testers

### Cómo elegir el grupo

No conviene probar solo con quien ya conoce el proyecto. Un grupo variado de 10–20 personas,
por ejemplo:

- 2–3 personas que jueguen mucho a juegos de mesa o de cartas.
- 4–5 personas usuarias normales, sin perfil especialmente jugón.
- 2 personas poco habituadas a la tecnología.
- 2–3 personas que no conozcan Continuum ni el proyecto en absoluto.

Incluir al menos un iPhone y un Android. En iPhone se reparte por TestFlight (añadir a las
personas como testers, no como miembros del equipo); la primera beta externa pasa una revisión
de Apple. En Android, Google Play Closed Testing cuando exista la ficha.

### Presentación para participantes

> Continuum es un juego de cartas para ordenar, comparar y descubrir. Coloca acontecimientos y
> curiosidades en su lugar, juega a tu ritmo o comparte una partida con familiares y amigos.
> Esta es una versión de prueba: buscamos entender qué resulta claro, qué interrumpe la partida
> y qué te invita a volver. No hay compras ni anuncios.

### Instrucciones para cada participante

1. Instala la versión que te facilite la persona organizadora y anota la versión (Ajustes →
   «Versión y conexión»).
2. Intenta empezar una partida sin explicaciones previas. Cuenta en voz alta lo que esperas que
   hagan los botones.
3. Juega una partida corta. Si algo falla, anota qué estabas haciendo y si tenías conexión.
4. En Ajustes puedes aumentar el texto, cambiar el tema y activar o desactivar efectos.
5. Para dejar un comentario, usa el botón de comentarios de Ajustes: abre un correo con la
   versión y la pantalla, o guarda el diagnóstico en un archivo. Revísalo antes de enviarlo.

### Protocolo y guion de observación

Preparar sesiones de 2–4 y de 6–9 participantes. Registrar solo versión, dispositivo, modo y
duración, sin nombres reales ni datos sensibles. No explicar la interfaz durante el primer
intento; intervenir solo si alguien va a abandonar o hay un bloqueo. No interpretar el silencio
como comprensión.

| Momento | Qué registrar |
|---|---|
| Primer inicio | Tiempo hasta colocar una carta, dudas sobre mazo y modalidad |
| Primer fallo | Si se entiende por qué no encaja y qué pasa con la carta |
| Primera ronda | Esperas, turnos confundidos, necesidad de ayuda |
| Pulso | Si ambas personas entienden la apuesta y el desenlace |
| Pausa y regreso | Si recuperan la partida y reconocen dónde estaban |
| Final | Duración, deseo de repetir y motivo |
| Días posteriores | Si vuelven a jugar por iniciativa propia, sin dar por hecho que ocurrirá |

### Preguntas

No preguntar solo «¿te gusta?». Mejor:

1. ¿Has entendido cómo empezar sin ayuda?
2. ¿Dónde has dudado?
3. ¿Qué parte te ha gustado más? ¿Y cuál te ha aburrido?
4. ¿Has tenido algún fallo? (pedir el comentario desde Ajustes, que llega con la versión y el
   contexto exactos)
5. ¿Volverías a jugar? ¿Con quién?
6. ¿Qué mazos elegirías?
7. ¿Hay alguna pantalla que no entiendas?
8. ¿Pagarías por él? ¿Cuánto? ¿Preferirías pago único, mazos adicionales o versión gratuita?

### Qué hacer con las respuestas

Antes de pensar en monetizar, responder en orden: ¿la gente juega?, ¿entiende?, ¿repite?, ¿lo
recomienda? Solo después, cómo se monetiza. Las preguntas de pago ayudan ahí, pero no deben
condicionar el diseño antes de comprobar que el juego funciona. No se han recogido testimonios:
no inventar resultados de testers.

## E. Criterios para ampliar la beta

- [ ] Al menos 8 de cada 10 testers empiezan y colocan una carta sin ayuda.
- [ ] Ninguna pérdida de partida conocida.
- [ ] Ningún bloqueo P0 o P1 abierto.
- [ ] Invitaciones funcionando entre iPhone y Android.
- [ ] Evidencia de repetición voluntaria.
- [x] Correo de comentarios configurado (`feedbackcontinuum@gmail.com`).
- [ ] Privacidad revisada para el alcance de la beta.

Mientras no se cumplan, mantener una beta pequeña.

## F. Requisitos previos a las tiendas

Detalle en [docs/TIENDAS.md](docs/TIENDAS.md).

- [ ] Nombre Continuum revisado (OEPM/EUIPO y tiendas).
- [x] Procedencia del arte documentada.
- [x] Cartas de Naturaleza con fuente.
- [ ] Política de privacidad revisada profesionalmente.
- [x] Responsable y soporte: nombre y correo. Juego gratuito y sin ingresos: declararse «no comerciante» en App Store y Google Play (ver `docs/TIENDAS.md`).
- [ ] Condiciones de uso, aviso legal, soporte y página de borrado (borradores publicados; no son asesoramiento jurídico): revisión por un abogado antes del lanzamiento.
- [ ] «Privacidad de la app» (App Store) y «Seguridad de los datos» (Google Play): copiar las respuestas de `docs/TIENDAS.md`.
- [ ] Clasificación de edad y público objetivo: respuestas en `docs/TIENDAS.md`.
- [ ] Capturas reales e icono definitivo.
- [ ] Descripción de tienda revisada.
- [x] Certificados y secretos fuera del repositorio (secretos de GitHub Actions).
- [x] Subida a TestFlight probada.
- [ ] TestFlight con testers externos.
- [ ] Google Play Closed Testing.
- [ ] Prueba de actualización completada.

## Registro de incidencias

Usar la plantilla de GitHub (`.github/ISSUE_TEMPLATE/incidencia.yml`) o una fila de esta tabla.

| Fecha | Versión | Dispositivo/sistema | Modalidad y mazo | Pasos | Esperado | Ocurrido | Frecuencia | Prioridad | Estado |
|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — | — |

Prioridades: **P0** pérdida de datos o acceso indebido; **P1** impide entrar o terminar una
partida; **P2** confusión o dificultad frecuente; **P3** mejora menor. Estados: nueva,
reproducida, corregida, verificada. No cerrar una incidencia solo por subir código: reproducir
el caso corregido.

## Mantenimiento

Revisar incidencias durante la beta. Antes de cada versión, ejecutar las pruebas de juego,
reglas y compilaciones nativas. Mantener la compatibilidad de salas con clientes anteriores y
copias recuperables. Revisar cada mes dependencias, costes de Firebase y fallos. Ante pérdida de
datos o abuso: detener altas, conservar evidencias mínimas y preparar corrección o reversión
sin borrar partidas.
