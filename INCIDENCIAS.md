# Registro de incidencias (C.3.2)

Un sitio único donde anotar qué se rompió, cuándo, y qué se hizo. No sustituye a los `issues` de GitHub si se usan para el seguimiento día a día; esto es el resumen que se puede repasar de un vistazo antes de una versión nueva (C.3.3) o al investigar un patrón repetido (B.4.3).

## Prioridades

- **P0 — Crítico.** El juego no arranca, o una vía de pago/datos personales está comprometida. Se ataja el mismo día, sin esperar a la siguiente versión.
- **P1 — Grave.** Un modo de juego o el multijugador no funciona para una parte relevante de quienes juegan. Se ataja en días, no en semanas.
- **P2 — Molesto.** Un fallo real pero con alternativa o alcance acotado (un mazo concreto, un dispositivo concreto). Entra en la siguiente versión normal.
- **P3 — Menor.** Cosmético, o un caso de borde raro de reproducir. Se acumula y se atiende cuando toque, sin prisa.

## Cómo añadir una entrada

Una fila por incidencia, con la más reciente arriba. `Estado` es `Abierta`, `En curso` o `Cerrada`; una incidencia cerrada conserva su fila, no se borra — es el propio historial.

| Fecha | Prioridad | Qué pasó | Causa | Qué se hizo | Estado |
|---|---|---|---|---|---|
| 2026-09-21 | P2 | Ejemplo: `scripts/audit-content.mjs` señala imágenes de `quick-cards` sin carta asociada en este entorno de pruebas | Assets binarios (`assets/quick-cards/*.webp`) no disponibles en este checkout puntual; confirmado que falla igual en la rama original, sin relación con ningún cambio de esta sesión | Documentado en el checklist de lanzamiento (punto C.2); pendiente de confirmar en un checkout completo | Abierta |

## Ver también

- `SEGURIDAD_Y_OPERACION.md` → «Respuesta ante actividad anómala (B.4.3)»: el procedimiento para el tipo concreto de incidencia de tráfico o coste anómalo, que también debería dejar su fila aquí.
- `VERIFICACION_CORRECCIONES.md`: historial detallado de correcciones ya cerradas, con más contexto del que cabe en una fila de esta tabla.
