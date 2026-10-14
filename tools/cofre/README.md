# Cofre: secuencia de apertura v2

64 fotogramas a 25 fps, con cámara, cuerpo, suelo y luz constantes. Las ocho hojas WebP de 4 × 2 celdas tienen alfa real. Cada celda mide 640 × 560. Se generan fuera del juego: los móviles solo dibujan una celda en un canvas, sin Three.js, GPU 3D, vídeo ni dependencias remotas.

El modelo utiliza el roble y el emblema originales de Continuum. Tiene tablones con espesor, interior, tapa de doble superficie, flejes curvos, remaches, bisagras, cierre y asas. La luz cálida llega de arriba a la izquierda, como en el paisaje; el relleno es azul y la sombra de contacto se compone sobre la cubierta.

## Fases

| Tiempo | Movimiento |
| --- | --- |
| 0–0,42 s | Se libera el cierre. |
| 0,32–0,90 s | El candado se desplaza y cae. |
| 0,54–1,82 s | La tapa gira como una pieza rígida sobre la bisagra trasera. |
| 1,05–2,15 s | La luz aparece gradualmente por la abertura. |
| 1,82–2,10 s | La tapa se asienta con un recorrido mínimo. |
| 1,85–3,37 s | Las tres cartas salen escalonadas. |
| 3,35–4,20 s | La cámara entra y se funde con la portada. |

La iluminación del interior ya está renderizada en las hojas; el halo y las cartas conservan capas propias. El tiempo absoluto selecciona el fotograma, por lo que una bajada de rendimiento no desincroniza la secuencia. Si falla la carga o se pulsa antes de terminarla, se utiliza la geometría CSS. El teclado y la preferencia de movimiento reducido conservan su comportamiento.

## Regenerar

Herramientas de autoría: Node, Three.js 0.186.1, Playwright y Sharp. Instálalas en una carpeta de herramientas independiente, instala Chromium con Playwright y ejecuta desde este repositorio:

```sh
COFRE_TOOL_DEPS=/ruta/a/herramientas/node_modules node tools/cofre/render.mjs
```

`COFRE_CHROMIUM_EXECUTABLE` permite seleccionar un Chromium instalado. Las dependencias y la escena fuente no se incluyen en el paquete móvil. Los únicos archivos nuevos de producción son las ocho hojas WebP, cargadas bajo demanda y cacheadas por el service worker cuando se usan.
