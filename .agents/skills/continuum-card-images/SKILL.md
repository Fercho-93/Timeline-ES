---
name: continuum-card-images
description: >-
  Genera, revisa e integra ilustraciones de cartas para Continuum (repositorio Timeline-ES)
  respetando exactamente el lenguaje visual, formato técnico, nomenclatura e integración
  que ya usan las cartas existentes de animales, astronomía y países. Úsala cuando haya
  que crear imágenes nuevas, completar un mazo sin imágenes, rehacer una ilustración que
  no encaja o auditar qué cartas siguen pendientes.
---

# Continuum · Card Images

## Objetivo

Mantener una única identidad visual para todas las ilustraciones de cartas de Continuum.
No inventes un estilo nuevo por mazo. Parte siempre de las imágenes ya aprobadas en el
repositorio y crea nuevas piezas que parezcan pertenecer a la misma colección.

La ilustración es una **lámina de fondo de la carta**, no una carta completa. El juego
superpone después título, datos y demás UI. Por tanto, la imagen generada **no debe llevar
texto, cifras, marcos, logotipos, iconos, bandas, etiquetas ni bordes**.

## Fuentes de verdad del repositorio

Antes de generar nada, inspecciona siempre:

- `assets/animal-cards/`
- `assets/astronomy-cards/`
- `assets/country-cards/`
- `modes.js`
- `styles.css`
- `tests/referencias-animales.mjs`
- el archivo de datos del mazo que se vaya a completar (`animals.js`, `lifespan.js`,
  `speed.js`, `astronomy.js`, `countries.js`, etc.)

Usa **3-6 imágenes existentes del mismo bloque** como referencias visuales directas antes
de redactar el prompt de una imagen nueva.

## Formato técnico obligatorio

Toda ilustración de carta debe cumplir:

- Orientación vertical.
- Relación de aspecto exacta **2:3**.
- Tamaño final: **512 × 768 px**.
- Formato final: **WebP**.
- Peso objetivo: **≤ 100 KB** por archivo siempre que la calidad siga siendo suficiente.
- Sin transparencia necesaria.
- Sin franjas blancas o negras.
- Sin borde interior.
- La imagen debe soportar `object-fit: cover` y llenar toda la superficie visible.
- El motivo principal no debe quedar cortado de forma torpe cuando la carta se recorta.
- Evita detalle crítico pegado a los últimos ~6 % de cada borde.

## Lenguaje visual común

El aspecto debe sentirse como una colección editorial premium para un juego de cultura
general, no como stock, captura de Wikipedia, clip-art ni ilustración infantil.

Mantén estas constantes:

- Composición limpia y vertical, pensada desde el principio para 2:3.
- Un sujeto o concepto principal inequívoco.
- Profundidad mediante primer plano / sujeto / fondo, sin saturar la escena.
- Iluminación cuidada y cinematográfica, con volumen y contraste moderado.
- Color rico pero contenido: evita saturación agresiva, neón gratuito o aspecto plástico.
- Texturas naturales y detalle suficiente para que la imagen siga teniendo presencia en
  una pantalla móvil pequeña.
- Acabado ilustrado y artístico coherente; no debe parecer una foto pegada dentro de la
  carta.
- Fondos integrados con el sujeto, no fondos blancos ni recortes de catálogo.
- Nada de texto generado por IA ni símbolos pseudo-tipográficos.
- Nada de marcas de agua, firmas, logos o elementos ajenos al juego.

## Regla de coherencia

**La referencia visual del mazo existente manda sobre cualquier descripción escrita en
esta skill.** Si una indicación aquí entra en conflicto con las láminas ya aprobadas,
reproduce el patrón de las láminas existentes.

Cuando se abra un bloque nuevo, toma como base la gramática visual común y crea una
variación temática moderada, no una identidad completamente diferente.

## Subestilos ya establecidos

### Naturaleza · animales

Carpetas: `assets/animal-cards/`
Mazos que reutilizan esta familia: peso, longevidad y velocidad.

- El animal es el protagonista absoluto.
- Debe reconocerse rápidamente incluso en miniatura.
- Representación anatómica verosímil.
- Entorno coherente con su hábitat, pero secundario.
- No convertir la escena en una fotografía documental genérica.
- No usar fondos blancos de estudio.
- Para animales muy pequeños, ampliar el sujeto lo necesario sin perder contexto.
- Para animales enormes, transmitir escala sin alejar tanto la cámara que el sujeto se
  vuelva irreconocible.

Antes de crear una nueva lámina, compara especialmente encuadre, escala del sujeto,
contraste y tratamiento del fondo con varias imágenes existentes de `animal-cards`.

### Ciencia · astronomía y espacio

Carpeta: `assets/astronomy-cards/`

- El hito, persona, vehículo, telescopio, planeta o fenómeno debe leerse de inmediato.
- Prioriza una escena icónica antes que una composición abstracta.
- Mantén sensación de descubrimiento, escala y profundidad espacial.
- Evita interfaces HUD, infografías, etiquetas científicas o texto.
- En retratos históricos, integrar a la persona en una escena editorial coherente con el
  resto del mazo, no usar un simple retrato de estudio.
- En misiones espaciales, mostrar el elemento distintivo de la misión sin llenar la imagen
  de objetos secundarios.

### Geografía · países por superficie

Carpeta: `assets/country-cards/`

- Representar el país mediante una escena visual reconocible y elegante.
- Priorizar geografía física, paisaje, relieve, clima, patrimonio o un conjunto visual que
  evoque claramente el país.
- No convertir la ilustración en una bandera gigante ni en un mapa político convencional.
- Evitar collages turísticos llenos de monumentos sin jerarquía.
- Una imagen debe funcionar como una lámina unitaria: una escena dominante y, como mucho,
  apoyos secundarios discretos.
- Mantener el mismo tratamiento artístico, densidad y composición que las imágenes de
  países ya aprobadas.

## Flujo obligatorio de trabajo

### 1. Identificar las cartas pendientes

Cruza:

1. cartas declaradas en el archivo `.js` del mazo;
2. mapeos de ilustración de `modes.js`;
3. archivos realmente presentes en `assets/...-cards/`;
4. precarga/cache en `service-worker.js` cuando aplique;
5. tests existentes.

No asumas que una carta está pendiente solo porque no aparece en una lista parcial.

### 2. Elegir referencias

Para cada tanda, selecciona 3-6 imágenes ya existentes del **mismo bloque** y describe
internamente:

- escala del protagonista;
- ángulo de cámara;
- nivel de realismo;
- tratamiento de luz;
- paleta dominante;
- profundidad del fondo;
- cantidad de detalle;
- espacio libre útil para que la UI siga siendo legible.

El prompt nuevo debe conservar esas características.

### 3. Redactar el prompt

Usa esta estructura base y adáptala a la referencia real del mazo:

> Ilustración vertical 2:3 para una carta de Continuum sobre **[SUJETO]**. Mantener el
> mismo lenguaje visual que las láminas existentes del mazo **[MAZO/BLOQUE]**: composición
> editorial premium, sujeto claramente reconocible, iluminación cinematográfica sutil,
> profundidad natural, detalle limpio y paleta coherente. **[ESCENA Y ELEMENTOS
> ESPECÍFICOS]**. Diseñada para recorte edge-to-edge en una carta móvil. Sin texto, sin
> números, sin marco, sin borde, sin logotipos, sin watermark, sin interfaz, sin fondo
> blanco, sin elementos decorativos ajenos.

Añade instrucciones negativas específicas cuando el modelo pueda confundir el sujeto o
introducir texto, banderas, diagramas, carteles, matrículas, insignias, etc.

### 4. Revisar antes de integrar

Rechaza y regenera si ocurre cualquiera de estas situaciones:

- parece una fotografía o stock desconectado de la colección;
- hay bordes o franjas;
- el sujeto principal queda demasiado pequeño;
- el protagonista se corta de forma accidental;
- aparece texto ilegible o pseudotexto;
- hay anatomía, arquitectura o maquinaria claramente incorrecta;
- la escena está sobrecargada;
- no se reconoce el concepto al verla durante un segundo;
- el color o acabado rompe claramente con las imágenes vecinas del mismo mazo;
- la imagen depende de detalles diminutos que desaparecerán en móvil.

### 5. Exportar

- Recortar/ajustar a 512 × 768.
- Convertir a WebP.
- Comprimir procurando quedar en ≤ 100 KB.
- Verificar visualmente después de comprimir.

### 6. Nombrar

Sigue el patrón que ya use el mazo:

- Animales: slug semántico existente en el mapping, p. ej. `bengal-tiger.webp`.
- Astronomía: conserva el patrón existente del mapping/archivo y no renombres recursos ya
  usados.
- Países: el sistema actual enlaza las imágenes por ID numérico de carta, p. ej.
  `2025.webp`.

**Nunca cambies nombres ya publicados solo por uniformarlos.** La compatibilidad con el
mapping existente tiene prioridad.

### 7. Integrar

Al añadir una ilustración nueva:

1. guardar el WebP en la carpeta correcta;
2. actualizar el mapping de `modes.js` si ese mazo lo necesita;
3. actualizar `service-worker.js` si la estrategia de precarga actual exige enumerarla;
4. ampliar tests para garantizar que la carta tiene archivo y mapping;
5. comprobar que la UI usa la misma clase `animal-card-art`/mecanismo de lámina y no se
   introducen wrappers o estilos especiales por carta;
6. ejecutar los tests relevantes.

No modifiques el layout de la carta para compensar una ilustración mala. Corrige la
ilustración.

## Auditoría de pendientes

Cuando se invoque esta skill con una orden como **“revisa qué imágenes quedan”**:

1. lista los mazos que ya tienen sistema de ilustraciones;
2. calcula cartas totales vs. cartas con imagen;
3. identifica IDs/nombres sin imagen;
4. separa “imagen inexistente”, “imagen existente pero sin mapping” y “mapping a archivo
   inexistente”;
5. propone el siguiente lote lógico de 5-15 cartas;
6. no generes nada hasta que la petición también incluya generar/aplicar.

## Invocaciones recomendadas

- `Usa continuum-card-images y genera las imágenes pendientes del mazo de astronomía.`
- `Usa continuum-card-images para crear una muestra del mazo de distancias entre ciudades.`
- `Usa continuum-card-images, revisa los mazos y dime cuáles siguen sin ilustraciones.`
- `Usa continuum-card-images y rehace esta carta para que encaje con el resto.`
- `Usa continuum-card-images y añade al juego las imágenes ya generadas que aún no estén integradas.`

## Criterio final de aceptación

La pregunta decisiva es:

> Si se mezclan la imagen nueva y cinco imágenes existentes del mismo mazo sin enseñar sus
> nombres, ¿parece que todas fueron creadas para la misma edición de Continuum?

Si la respuesta no es claramente sí, la imagen todavía no está terminada.
