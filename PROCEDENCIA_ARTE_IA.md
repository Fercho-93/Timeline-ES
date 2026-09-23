# Procedencia del arte generado con IA

## Declaración del titular

El titular del proyecto declara que todos los recursos visuales incorporados a Continuum —antes Timeline— fueron generados con ChatGPT/OpenAI. La declaración incluye las ilustraciones de las cartas, las portadas de las familias, el icono, el logo, el splash y los demás elementos gráficos incorporados al repositorio.

Esta declaración se basa en la confirmación expresa del titular y en el historial disponible de conversaciones del proyecto. El inventario `docs/inventario-arte.json` enlaza cada archivo con esta declaración y conserva su huella SHA-256.

## Lenguaje visual

El sistema visual común se ha construido mediante instrucciones de continuidad entre cartas:

- Formato vertical de carta.
- Ilustración sin texto añadido y sin marcos blancos.
- Tratamiento de grabado o lámina antigua.
- Fondo de pergamino y paleta sepia, marfil, marrón, cobre y otros tonos cálidos.
- Composición integrada en la carta, sin bordes visibles.
- Variaciones temáticas: grabado naturalista para animales, grabado científico para Astronomía, grabado cartográfico para Geografía y tratamientos históricos o culturales equivalentes para los demás mazos.

## Evidencia recuperada

- Astronomía: se documentaron 26 imágenes generadas con ChatGPT, en WebP de 512 × 768, con estilo sepia/pergamino y sin texto ni marcos. Posteriormente se enlazaron las 49 cartas del mazo.
- Superficie de países: se documentaron 64 ilustraciones generadas e integradas, con siluetas, mapas, relieve y paisaje en grabado cartográfico sobre pergamino.
- Longevidad de animales: 26 imágenes nuevas y 12 reutilizadas, con lámina naturalista antigua, sepia, animal completo y formato WebP de 512 × 768.
- Velocidad de animales: 31 imágenes nuevas y 7 reutilizadas, manteniendo el mismo lenguaje naturalista.
- Logo e icono: se conserva evidencia conversacional de generación mediante el prompt «crea un icono y logo para el juego de timeline/continuum».
- Portada de apertura: `assets/continuum-splash-v2.webp` se generó con ChatGPT/OpenAI el 18 de septiembre de 2026 a partir de un mockup aportado por el titular. El mockup se utilizó como referencia de composición, luz, paleta y materiales; el recurso final se pidió sin texto, logotipo ni controles para superponer en HTML la marca y los botones accesibles del juego.
- Fondo animable de portada: `assets/continuum-splash-clean-v3.webp` se derivó con ChatGPT/OpenAI el 19 de septiembre de 2026 de la portada anterior, eliminando únicamente las cartas periféricas para reconstruir el pergamino, las nubes y las líneas que quedaban detrás. Las cartas visibles se componen ahora como capas HTML con ilustraciones propias del juego para poder darles un movimiento independiente; el rayo y los destellos son CSS.
- Recursos recuperados: la ilustración de Austria fue generada el 8 de septiembre de 2026 con la herramienta de imágenes de OpenAI. El recurso de agujero negro se recuperó reutilizando otra ilustración existente del proyecto.

## Límites de la documentación

No se han recuperado los prompts completos, la fecha individual de generación, las imágenes de referencia ni el modelo utilizado para cada uno de los 959 archivos. Por ello, el inventario marca la procedencia como declarada por el titular y no como una ficha individual completa de generación.

Antes de una publicación comercial se deben conservar, junto con la documentación del proyecto, los términos aplicables al plan y servicio utilizados en cada generación. Esta documentación no afirma que OpenAI sea el titular de las imágenes ni sustituye una revisión jurídica; deja registrada la procedencia declarada y evita presentar los recursos como imágenes descargadas de terceros.

### Términos comerciales de OpenAI (A.5.2)

Según los términos de uso públicos de OpenAI vigentes: entre el usuario y OpenAI, el usuario es dueño del resultado («output») que genera — OpenAI cede su derecho, título e interés sobre ese resultado —, y puede usarlo para cualquier fin, incluido el comercial, sujeto a las políticas de uso de OpenAI. Esto aplica igual estés en el plan gratuito, Plus o de pago por API; lo que cambia entre planes es solo si OpenAI puede usar tus conversaciones para entrenar sus modelos (en Business/Team/API no lo hace; en gratuito/Plus sí, salvo que se desactive), lo cual no afecta a tu derecho a usar comercialmente lo que generaste.

Dos matices legales a tener en cuenta, no exclusivos de OpenAI sino de cómo funciona el derecho de autor con IA en general:

- **El resultado puede no ser único**: la propia cesión de derechos de OpenAI no impide que otra persona reciba una imagen parecida a partir de un prompt similar — no es una garantía de exclusividad.
- **Una obra generada íntegramente por IA, sin aportación creativa humana significativa, puede no ser protegible por derechos de autor** tanto en EE. UU. como en la práctica habitual de la UE/España (que también exige autoría humana para la protección). En la práctica: puedes usar las imágenes comercialmente sin problema (es lo que autorizan los términos de OpenAI), pero la capacidad de impedir que un tercero copie una ilustración muy similar generada por IA es legalmente menos sólida que con una ilustración encargada a una persona.

Esto no es asesoramiento jurídico — antes de un lanzamiento comercial real conviene una revisión legal de los términos vigentes en ese momento (OpenAI los actualiza) y de si conviene añadir aportación creativa humana adicional (edición, composición, selección) a las piezas más visibles (icono, logo, portada) para reforzar su protección.

Los textos, datos, fuentes y marcas representadas en las cartas tienen una revisión independiente. Que una ilustración haya sido generada con IA no convierte automáticamente en libres de derechos los nombres, logotipos o elementos identificables de terceros que pudiera representar.
