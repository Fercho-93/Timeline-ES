# Continuum — checklist de beta y lanzamiento

## A. Comprobación automática

- [ ] `npm ci`
- [ ] `npm test`
- [ ] `npm run test:reglas`
- [ ] `npm run build`
- [ ] `npx cap sync`
- [ ] Confirmar que no se han introducido referencias visibles a Timeline.
- [ ] Confirmar que las imágenes referenciadas existen en `dist/`.
- [ ] Confirmar que el service worker sirve la versión actual.

## B. Pruebas del juego

- [ ] Partida local completa.
- [ ] Competición completa.
- [ ] Solitario Fácil.
- [ ] Solitario Normal.
- [ ] Solitario Difícil.
- [ ] Solitario Experto/Fantasma constante.
- [ ] Pulso con acierto de ambas personas.
- [ ] Pulso con fallo de quien reta.
- [ ] Pulso con fallo de quien defiende.
- [ ] Fantasma en partida local.
- [ ] Fantasma en sala multijugador.
- [ ] Empates y desempates.
- [ ] Abandono de jugador.
- [ ] Desconexión del anfitrión y recuperación.
- [ ] Reanudación de partida guardada.
- [ ] Actualización sin perder progreso.
- [ ] Entrada mediante enlace.

## C. Pruebas físicas

Registrar dispositivo, sistema, versión de Continuum y resultado. No registrar nombres reales salvo que sea imprescindible.

- [ ] iPhone real.
- [ ] Android real.
- [ ] App abierta al recibir una invitación.
- [ ] App cerrada al recibir una invitación.
- [ ] Invitación con app no instalada.
- [ ] Cambio de aplicación y regreso.
- [ ] Bloqueo y desbloqueo de pantalla.
- [ ] Pérdida de red y reconexión.
- [ ] Modo avión en partida local.
- [ ] Orientación vertical y horizontal.
- [ ] Teclado y campos de nombre.
- [ ] Tamaño de letra grande.
- [ ] Lector de pantalla.
- [ ] Movimiento reducido.
- [ ] Gesto Atrás de Android.
- [ ] Safe areas del iPhone.
- [ ] Actualización conservando una partida.
- [ ] Actualización con una sala pendiente.

## D. Sesiones con testers

Para cada sesión registrar solo versión, dispositivo, modo y duración.

- [ ] Reclutar entre 10 y 20 personas nuevas.
- [ ] Probar sesiones de 2–4 participantes.
- [ ] Probar sesiones de 6–9 participantes.
- [ ] No explicar la interfaz durante el primer intento.
- [ ] Medir si comienzan sin ayuda.
- [ ] Medir tiempo hasta la primera jugada.
- [ ] Registrar esperas y abandonos.
- [ ] Preguntar si volverían a jugar voluntariamente.
- [ ] Preguntar qué mazos y pantallas resultan más atractivos.
- [ ] Registrar errores con prioridad P0, P1, P2 o P3.

## E. Criterios mínimos antes de ampliar la beta

- [ ] Al menos 8 de 10 testers comienzan sin ayuda.
- [ ] Ninguna pérdida de partida conocida.
- [ ] Ningún bloqueo P0 o P1 abierto.
- [ ] Invitaciones funcionando entre iPhone y Android.
- [ ] Evidencia de repetición voluntaria.
- [ ] FeedbackEmail configurado.
- [ ] Privacidad revisada para el alcance de la beta.

## F. Requisitos previos a tiendas

- [ ] Nombre Continuum revisado.
- [ ] Derechos del arte documentados.
- [ ] 17 cartas de Naturaleza revisadas o retiradas de la beta.
- [ ] Política de privacidad final.
- [ ] Responsable y correo de soporte.
- [ ] Data Safety completado.
- [ ] Clasificación de edad completada.
- [ ] Capturas reales de la app.
- [ ] Descripción de tienda revisada.
- [ ] Icono definitivo.
- [ ] Certificados y secretos configurados fuera del repositorio.
- [ ] TestFlight probado.
- [ ] Google Play Closed Testing probado.
- [ ] Prueba de actualización completada.

## Registro de incidencias

Cada incidencia debe incluir:

- Versión.
- Dispositivo y sistema.
- Modo y mazo.
- Pasos para reproducir.
- Resultado esperado.
- Resultado real.
- Prioridad: P0, P1, P2 o P3.
- Estado: nueva, reproducida, corregida o verificada.
