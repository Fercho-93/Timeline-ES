# Sonidos de transiciones

Los sonidos de acción usan texturas suaves de papel y madera. Se activan con
«Sonidos suaves de cartas y resultados» y son independientes de la música y la vibración.

| Acción | Respuesta | Punto de conexión |
| --- | --- | --- |
| Avanzar o volver entre pantallas, con botón o gesto | Papel en sentidos y velocidades distintos | `a11y.js`: `paint`, `turnPage` |
| Desenrollar colección, perfil o guía | Roce de pergamino más largo | `a11y.js`: `unrollSheet` |
| Desplegar o plegar formatos, solitario y mazos de enciclopedia | Papel breve | `app.js`, `effects.js`: activación de `summary` |
| Abrir/cerrar ajustes, guía, ilustraciones, QR, menús y confirmaciones | Papel y toque tenue al abrir; papel al cerrar | `a11y.js`: `openDialog`, `closeDialog` |
| Elegir una carta o una posición | Madera ligera / colocación sobre papel | `a11y.js`: diferencias entre repintados |
| Levantar una carta con dedo o ratón | Toque ligero y vibración opcional | `drag.js`: `startDrag` |
| Rozar un nuevo hueco durante el arrastre | Toque muy tenue, limitado a uno cada 180 ms | `drag.js`: cambio de destino |
| Soltar en un hueco o devolver a la mano | Colocación / roce de retorno | `drag.js`: `onPointerUp` |
| Cancelar la posición elegida | Roce de retorno | `a11y.js`: desaparición de la confirmación |
| Girar una carta para leerla | Papel corto y rápido | `a11y.js`: `toggleFlip` |
| Recibir la siguiente carta o cartas automáticas | Papel y apoyo suave | `a11y.js`: `paint`, `dealIn` |
| Cambio de turno, Pulso o ronda | Dos golpes suaves | `a11y.js`, `online.js`: aviso de turno |
| Revelar cifras de la final | Giro de papel | `a11y.js`: entrada de `.final-results` |
| Final de partida o competición | Tres toques amortiguados | `a11y.js`: pantallas de fin |
| Zoom y cambios de preferencias | Toque muy suave, solo al cambiar el valor | `mapa.js`, `settings.js` |
| Aviso nuevo en el juego, sala o ajustes | Toque discreto | Funciones `showToast` |
| Acierto o fallo | Respuestas distintas de madera y papel | `effects.js`: `feedback` |

## Repeticiones y prioridad

`Effects.transition` agrupa los cambios de una misma acción. Por ejemplo, cerrar
un diálogo y navegar produce el sonido de navegación; mostrar un resultado
suprime el sonido adicional de abrir su diálogo. Un repintado de red con el mismo
estado, una carta ya seleccionada o un zoom que no cambia no repiten el sonido.

Las animaciones continuas (órbitas, esperas, cuenta atrás, profundidad, ejemplo de
la guía, hover y desplazamiento) permanecen silenciosas. El splash no intenta
reproducir audio antes de una interacción. Movimiento reducido conserva los
sonidos de las acciones, aunque omita sus animaciones.

El reproductor limita las voces a seis, amortigua el inicio y el final de cada
textura, descarta sonidos que se hayan quedado esperando más de 300 ms al
desbloquear audio y revisa el silencio antes de reproducir. Las muestras se
generan localmente con una semilla propia, sin consumir el azar del reparto.

Pruebas: `tests/efectos.mjs`, `tests/movimiento.mjs`, `tests/edicion.mjs` y
`tests/interfaz-atlas.mjs`.
