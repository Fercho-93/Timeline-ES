# Cofre: las cuatro referencias del titular

La versión 3 sustituye el modelo de prueba por la ilustración aportada. Conserva los píxeles del cuerpo, los herrajes, la cerradura y las cartas; no genera otro cofre parecido. La película dura 6 s: 180 fotogramas a 30 fps, H.264 Main, 706 × 1536, sin audio y con metadatos al principio para reproducción inmediata.

## Fuentes y continuidad

| Archivo aportado | Copia de producción | Uso |
| --- | --- | --- |
| `2DDAA7B0-5DAE-42A1-ADB5-374BEA871E6A.jpeg` | `assets/cofre-reference-v3-closed.webp` | Paisaje, cuerpo fijo, tapa exterior y cerradura. |
| `D2B1453F-DCDD-4211-A31D-BE851268222F.jpeg` | `assets/cofre-reference-v3-open.webp` | Interior de la tapa y mazo dentro del cofre. |
| `BED95C47-0BFB-464C-B1D1-5FC7F994E9A1.jpeg` | `assets/cofre-reference-v3-rise.webp` | Dorsos, orden y trayectoria del ascenso. |
| `F32ABFF0-46A6-401C-A2AB-BDD5CEAE5125.jpeg` | `assets/cofre-reference-v3-fan.webp` | Los cinco anversos, el abanico y la madera del interior vacío. |

Las copias WebP se convierten a calidad 94, sin recorte ni cambio de tamaño. El paisaje y el cuerpo se fijan a la primera imagen para compensar las diferencias de encuadre de las demás. La cerradura frontal se mantiene en su sitio: las referencias no muestran un candado desprendiéndose.

`assets/cofre-reference-v3-clean.webp` es una reconstrucción del fondo sin el cofre, realizada con la herramienta integrada de imágenes de OpenAI. Solo se compone en la zona que el cofre oculta, con bordes difuminados; no reemplaza el cielo ni el mar de la primera referencia. Prompt:

> Edit target: this supplied illustration. Production clean background plate for animating the EXACT illustrated chest separately. Remove ONLY the entire treasure chest, its golden inner light, and its cast shadow. Reconstruct the empty wooden deck behind and beneath the chest with matching perspective, worn planks, grain, joints, warm sunset illumination. Preserve the ENTIRE surrounding image composition and all existing detail: sky clouds sun coastline city mountains sea waves reflections rail balusters ropes rigging pulleys and foreground deck unchanged. No camera move, no crop, no relighting, no new objects. Image must have exactly the same full portrait aspect and field of view as input. The chest occupied lower middle about x=20%-87%,y=55%-81%; fill that region naturally with deck and the railing where appropriate. No chest, no cards, no glowing particles, no letters. Seamless meticulous faithful restoration, not a redesign.

## Movimiento

- 0–0,22 s: referencia inicial, con la rendija luminosa que ya aparece en la imagen.
- 0,22–1,65 s: tapa rígida semielíptica. Su exterior y su lateral conservan el grosor y usan la textura de la primera imagen. El interior aparece al girar hacia la cámara.
- 1,65–2,04 s: pausa con el mazo dentro.
- 2,04–3,54 s: las cinco cartas ascienden de forma escalonada siguiendo la tercera referencia.
- 3,54–4,68 s: las cartas se despliegan y las que muestran su dorso se giran hacia el abanico final.
- 4,68–6 s: se sostiene la composición final. Al terminar realmente el vídeo, el juego funde la escena con la portada.

La proyección por triángulos mantiene las esquinas y los escorzos. Las sombras de las cartas se dibujan una vez por silueta para evitar líneas internas. La secuencia no es una disolución entre cuatro fotografías.

## Autoría y reproducción

`animation.mjs` y `scene.html` conservan las capas, coordenadas y curvas de movimiento. Para regenerar, con Node, FFmpeg y Playwright instalados:

```sh
COFRE_TOOL_DEPS=/ruta/a/herramientas/node_modules node tools/cofre-v3/render.mjs
```

`COFRE_CHROMIUM_EXECUTABLE` permite seleccionar un Chromium instalado. La herramienta envía los PNG directamente a FFmpeg, sin guardar 180 imágenes intermedias. El juego distribuye el MP4, no estas herramientas.

El archivo se descarga completo bajo demanda y se reproduce como blob local para evitar peticiones parciales Range/206 en Safari y en la caché. `media-src 'self' blob:` permite ese uso sin ampliar la política de scripts. Si falla la red o el códec, se muestran las cuatro referencias y se llega a Jugar. La cancelación libera el blob y detiene la reproducción; movimiento reducido omite la escena como antes.
