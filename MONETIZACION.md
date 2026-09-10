# Continuum — plan de ruta para la monetización

Fecha de redacción: 10 de septiembre de 2026.

Este documento propone **cómo y cuándo cobrar por Continuum**, con qué modelo, a qué precio,
qué hay que construir para poder cobrar y qué decisiones legales y fiscales bloquean cada paso.

No es una previsión de ingresos. Las cifras de conversión y precio que aparecen son **hipótesis
de trabajo**, marcadas como tales: se confirman o se descartan con la beta, no con este texto.
Ninguna de las fases posteriores a F1 debe darse por buena antes de tener los datos de F1.

Complementa a [`ROADMAP.md`](ROADMAP.md) §7 («Comercialización»), que deja la decisión de
monetización explícitamente pendiente de la beta. Este plan describe *cómo se toma esa decisión*
y qué viene después de tomarla.

---

## 1. Punto de partida

Lo que ya existe y sostiene una propuesta de pago:

- 14 juegos repartidos en seis bloques, más la Gran mezcla temporal (673 cartas cronológicas).
- Cuatro formatos: un solo móvil (2–9), salas multijugador, solitario (cuatro dificultades) y competición.
- Reto diario con semilla por fecha, racha y resultado compartible.
- Duelo por enlace, sin servidor ni cuentas.
- Enciclopedia por mazo, con búsqueda, filtros y enlaces a fuentes.
- Perfil con estadísticas, puntos débiles y diecisiete logros.
- Capa móvil con Capacitor (`android/`, `ios/`), `appId` estable `com.continuum.game`, archive iOS firmado y subido a TestFlight una vez.

Lo que hoy **impide cobrar**, y que ninguna decisión de precio puede saltarse:

| Bloqueo | Dónde está | Fase que lo resuelve |
|---|---|---|
| No hay ninguna métrica de uso: todo se queda en el móvil | `progreso.js`, `saves.js` | F0 |
| No se ha observado repetición voluntaria con personas reales | `BETA_Y_LANZAMIENTO.md` | F1 |
| Disponibilidad de la marca «Continuum» sin comprobar | `ROADMAP.md` §7 | F2 |
| Condiciones comerciales del arte generado sin cerrar | `PROCEDENCIA_ARTE_IA.md` | F2 |
| 17 cartas de Naturaleza sin fuente cerrada | `CONTENIDO_Y_DERECHOS.md` | F2 |
| No hay identidad fiscal ni condición de comerciante declarada | — | F2 |
| No existe ninguna infraestructura de compras | — | F3 |

---

## 2. Principios que no se negocian

1. **No se cobra antes de observar repetición voluntaria.** Un juego que no se vuelve a abrir
   solo no se vende: se vende una vez y se devuelve.
2. **El muro es de contenido, nunca de conexión.** Las salas, el duelo por enlace y el reto
   diario son el canal de captación. Poner un precio delante de una invitación es apagar el
   único mecanismo de crecimiento que el juego ya tiene construido.
3. **Sin anuncios.** El posicionamiento es familiar y educativo, el público incluye menores, y
   la publicidad obligaría a declaraciones de recogida de datos y categorías de edad que hoy no
   hacen falta. Un anuncio también contradice la promesa de que el juego funciona sin conexión.
4. **Sin suscripción para contenido finito.** 14 mazos no producen novedad mensual. Cobrar cada
   mes por algo que no crece cada mes genera cancelaciones y reseñas negativas.
5. **Lo comprado no se retira.** Ni por cambio de precio, ni por reestructuración de packs, ni
   por caducidad. Quien compró un mazo lo conserva en cualquier versión posterior.
6. **No se vende contenido sin fuente cerrada.** Las 17 cartas pendientes de Naturaleza no
   entran en ningún pack de pago hasta estar documentadas. Cobrar por un dato en revisión
   convierte un problema editorial en un problema de consumo.
7. **Sin patrones oscuros.** Ni cajas, ni gacha, ni monedas intermedias, ni contadores de
   energía, ni ofertas con cuenta atrás falsa.

---

## 3. Modelo recomendado

**Gratis con desbloqueo de contenido por pago único, más packs temáticos posteriores.**

Es decir: se instala gratis, se juega de verdad y sin límite de tiempo con una parte del
catálogo, y se paga una vez para abrir el resto. Las ampliaciones futuras se venden como packs
sueltos, con un precio de conjunto siempre inferior a la suma de sus partes.

### Por qué este y no otro

| Modelo | Veredicto | Razón |
|---|---|---|
| **Gratis + desbloqueo único** | **Recomendado** | El catálogo ya está troceado por bloques temáticos: la línea de pago cae sola. Permite probar antes de pagar, que es lo que necesita un juego desconocido y sin marca. |
| Pago único de entrada (premium puro) | Descartado en F4 | Un juego sin marca, sin reseñas y sin prensa vende muy poco con precio de entrada. Reconsiderable en F5, ya con reseñas acumuladas. |
| Suscripción | Descartado | Contenido finito. Ver principio 4. |
| Anuncios | Descartado | Ver principio 3. |
| Consumibles (vidas, pistas) | Descartado | Rompe el solitario y el reto diario, que son las mecánicas de retención. |
| Licencia educativa B2B | **Segunda línea, F5** | Es una vía real (ver §9), pero no puede ser la primera: exige factura, soporte y un producto ya estable. |

### La línea de pago propuesta

**Gratis, para siempre:**

- Tres mazos completos: **Historia de España**, **Estrenos de cine** y **Superficie de países**
  (uno por perfil de interés, los tres con datos sólidos y arte terminado).
- Reto diario, con los tres mazos gratuitos.
- Un solo móvil, solitario y duelo por enlace sobre esos mazos.
- Perfil, estadísticas y logros, completos.
- Enciclopedia de los mazos que se posean.

**«Continuum Completo» (pago único):**

- Los 14 juegos y la Gran mezcla temporal.
- Competición (recorre los catorce juegos: exige tenerlos).
- Enciclopedia de todo el catálogo.
- Todas las ampliaciones incluidas en el precio durante los doce primeros meses tras la compra;
  después, packs sueltos con descuento para quien ya tenga el Completo.

**Packs por bloque** (para quien no quiere todo): Historia, Entretenimiento, Ciencia,
Naturaleza, Geografía.

**Gratis aunque no se posea el mazo — el pase de invitado:** quien entra por enlace a una sala
o a un duelo juega la partida entera con el mazo del anfitrión, aunque no lo haya comprado. Al
terminar se le ofrece el mazo. Esto convierte cada partida compartida en una demostración
completa del contenido de pago, que es exactamente lo que un juego sin marca necesita. El coste
—alguien podría jugar indefinidamente invitado por un amigo— es muy inferior al beneficio.

**Regla para la Gran mezcla:** concatena los ocho mazos cronológicos. Si no se poseen todos,
debe barajar solo con los que sí, avisando de cuántos quedan fuera, y no bloquearse entera.
Una mezcla que se niega a funcionar es una pantalla de error; una mezcla más corta es una
demostración de lo que falta.

---

## 4. Precios de salida (hipótesis a validar en F1)

Precios propuestos para España, IVA incluido, alineados con los escalones habituales de tienda:

| Producto | Precio propuesto |
|---|---|
| Continuum Completo | **5,99 €** |
| Pack de bloque (Historia, Entretenimiento, Ciencia, Naturaleza, Geografía) | 2,49 € |
| Oferta de lanzamiento, primeras cuatro semanas | 3,99 € |
| Ampliación futura suelta | 1,99 € |

Criterio: el Completo tiene que ser la compra obvia frente a dos packs. A 5,99 € contra
2,49 € el pack, comprar dos bloques ya es peor negocio que comprarlo todo.

**Ingreso neto por venta.** En la UE las tiendas actúan como intermediario fiscal: el precio
mostrado incluye el IVA y ellas lo liquidan; la comisión se calcula sobre la base sin impuesto.
Con IVA español del 21 % y comisión del 15 % (programa de pequeños desarrolladores, aplicable
mientras la facturación anual no supere el umbral que fija cada tienda):

| Precio | Base sin IVA | Comisión 15 % | **Neto** |
|---:|---:|---:|---:|
| 3,99 € | 3,30 € | 0,49 € | **2,80 €** |
| 5,99 € | 4,95 € | 0,74 € | **4,21 €** |
| 2,49 € | 2,06 € | 0,31 € | **1,75 €** |

**Umbral de cobertura de costes fijos.** La cuota anual del programa de desarrollador de Apple
(unos 99 $) se cubre con unas **25–30 ventas del Completo al año**. El alta de Google Play es un
pago único (unos 25 $). Es decir: el proyecto deja de costar dinero muy pronto, y la pregunta
relevante no es la rentabilidad sino el volumen.

Los porcentajes de comisión, los umbrales del programa de pequeños desarrolladores y el
tratamiento del IVA **deben reconfirmarse en el momento de configurar los productos**: cambian,
y han cambiado varias veces en los últimos años. Ninguna cifra de esta tabla es un compromiso.

---

## 5. Fases

### F0 — Instrumentación (antes de la beta con testers)

*Entra cuando:* las suites automáticas estén verdes y exista una compilación instalable
(criterios de `ROADMAP.md`).

- Definir el **embudo mínimo**: instalación, primera partida iniciada, primera carta colocada,
  primera partida terminada, segunda sesión, séptimo día, mazo abierto, pantalla de mazo
  bloqueado vista.
- Implementarlo con el mínimo dato posible: identificador anónimo por dispositivo (ya existe
  para el reto diario), sin perfiles publicitarios, sin identificadores de terceros.
- **Consentimiento explícito** antes del primer envío, con opción de rechazo que no degrade el
  juego, y actualización de `PRIVACIDAD.md` y de las declaraciones de tienda: en cuanto salga
  un solo evento del móvil, la ficha de recogida de datos cambia.

*Sale con:* un embudo que se puede leer, y la política de privacidad actualizada a lo que
realmente hace la aplicación.

### F1 — Validación de disposición a pagar (durante la beta)

*Entra cuando:* F0 esté cerrada y haya testers reales jugando (protocolo de `BETA_Y_LANZAMIENTO.md`).

- Medir lo que ya pide el protocolo de beta —inicio sin ayuda, tiempo hasta la primera jugada,
  abandonos— **más repetición voluntaria a 7 días**, que es el único indicador que predice si
  alguien pagaría.
- Preguntar precio al final de la sesión, no al principio, y con cuatro preguntas abiertas
  (a qué precio sería tan barato que desconfiaría, barato, caro, tan caro que no lo compraría).
  No enseñar un precio y preguntar si parece bien: eso solo mide cortesía.
- Contrastar las dos estructuras: «todo por 5,99 €» frente a «bloques por 2,49 €».
- Registrar qué mazos se abren primero y cuáles no se abren nunca. Un mazo que nadie abre no
  es un mazo de pago: es un mazo gratuito que atrae a alguien.

**Umbrales para seguir a F2** (propuestos, revisables antes de empezar la beta, nunca después):

- 8 de 10 personas completan el inicio sin ayuda (criterio ya fijado en la beta).
- ≥ 30 % de los testers vuelven a abrir el juego por voluntad propia en los 7 días siguientes.
- ≥ 25 % declara un precio aceptable de 3 € o más.
- Ningún bloqueo P0/P1 abierto.

Si no se cumplen, **no se pasa a F2**: se corrige el juego y se repite F1. Cobrar por algo que
no se repite produce reembolsos, reseñas de una estrella y un nombre quemado.

### F2 — Habilitación legal, fiscal y de derechos

*Entra cuando:* F1 supere sus umbrales.

Nada de esta fase es opcional y todo tiene plazos externos que no dependen del proyecto:

- **Marca.** Comprobar «Continuum» en OEPM y EUIPO en las clases relevantes (9, 28, 41) y en
  las tiendas. Es una palabra muy común: hay que asumir que puede estar tomada y tener un
  nombre alternativo preparado. **Resolver antes de encargar capturas, ficha y material
  gráfico**, porque un cambio de nombre después de publicar obliga a rehacerlo todo y, si
  cambiara el `appId`, sería una aplicación nueva desde cero.
- **Identidad y condición de comerciante.** Alta como autónomo o sociedad, con domicilio y
  contacto verificables. Las tiendas exigen declarar y verificar la condición de comerciante
  para distribuir en la UE, y una app que vende sin esa verificación puede quedar retirada del
  mercado europeo. Confirmar el procedimiento vigente de cada tienda al darse de alta.
- **Fiscalidad.** Las tiendas retienen y liquidan el IVA europeo de las ventas de la aplicación;
  aun así hay que declarar los ingresos y firmar los formularios de retención de EE. UU. que
  pida cada plataforma. Si algún día se vende fuera de las tiendas (web), el IVA pasa a ser
  responsabilidad propia, con ventanilla única. Consultar con asesoría antes de la primera venta.
- **Derechos del arte.** Confirmar que las condiciones del servicio con el que se generaron las
  ilustraciones permiten su uso comercial, y conservar la evidencia. `LICENSE` ya reconoce que
  no se reivindica exclusividad sobre esas imágenes: eso no impide venderlas dentro del juego,
  pero sí impide impedir que otro las use.
- **Contenido.** Cerrar las 17 cartas de Naturaleza pendientes. Sin eso, los mazos de Peso,
  Longevidad y Velocidad no pueden formar parte de un pack de pago (principio 6).
- **Cuentas de tienda.** Apple Developer y Google Play Console. Atención al requisito de Google
  para cuentas personales nuevas: un periodo de pruebas cerradas con un número mínimo de
  testers durante varios días consecutivos **antes** de poder pasar a producción. Confirmar los
  números vigentes al crear la cuenta y planificar ese periodo dentro de esta fase, no después.
- **Soporte.** Correo de soporte publicado, procedimiento de reembolso y de borrado de datos.

*Sale con:* nombre confirmado, identidad fiscal operativa, cuentas de tienda activas y
catálogo sin cartas pendientes.

### F3 — Implementación de las compras

*Entra cuando:* F2 esté cerrada. Antes no: implementar compras sin saber el nombre definitivo
ni el catálogo final es rehacer el trabajo.

Diseño técnico propuesto:

- **Modelo de derechos.** Un módulo nuevo, `compras.js`, mantiene el conjunto de derechos
  (`continuum.completo`, `pack.historia`, …). `modes.js` declara qué juego pertenece a qué
  producto; la portada, la competición, la enciclopedia y la Gran mezcla consultan ese módulo.
  Ninguna pantalla decide por su cuenta si algo está bloqueado.
- **Pasarela.** Compras oficiales de cada tienda a través de un plugin de Capacitor. Para un
  equipo de una persona, conviene una capa que resuelva validación de recibos, restauración,
  caducidades y avisos de reembolso sin montar servidor propio. Añadir esa capa **suma un
  encargado del tratamiento** y obliga a actualizar `PRIVACIDAD.md` y las declaraciones de
  tienda. Alternativa sin terceros: validar recibos en el servidor propio de `server/`, más
  control y bastante más trabajo.
- **Validación.** El derecho se concede tras validar el recibo fuera del cliente. Nunca a
  partir de un valor guardado en el móvil.
- **Funcionamiento sin conexión.** El derecho validado se cachea localmente con una vigencia
  razonable, para que el juego siga abriéndose sin red. Si la caché caduca sin poder revalidar,
  se degrada avisando, **nunca borrando partidas ni progreso**.
- **Restauración.** Botón explícito en Ajustes, obligatorio en iOS y sensato en Android.
- **Reembolsos y estados intermedios.** Compra pendiente (habitual en Android), compra
  cancelada, compra reembolsada, compartir en familia. Cada uno con su comportamiento definido.
- **Salas.** `firestore.rules` debe permitir que un anfitrión con derecho abra una sala con un
  mazo de pago y que los invitados jueguen sin tenerlo (pase de invitado), sin que eso permita
  a un cliente modificado concederse derechos. Es una regla de sala, no una protección de
  contenido: los datos de los mazos ya viven en el navegador, y `firestore.rules` y el README
  ya lo dicen con esa misma franqueza.
- **Pruebas.** Un `tests/compras.mjs` que cubra: derecho ausente, presente, caducado,
  reembolsado, recibo manipulado, restauración en dispositivo nuevo, y actualización desde una
  instalación anterior a las compras —que debe conservar todo lo que ya tenía—. Pruebas en los
  entornos de prueba (sandbox) de ambas tiendas antes de publicar.

*Sale con:* compras funcionando en sandbox en iPhone y Android reales, y la prueba de
actualización de `DISTRIBUCION_MOVIL.md` repetida con una compra hecha.

### F4 — Lanzamiento comercial

*Entra cuando:* F3 esté cerrada y las capturas reales estén hechas desde una compilación final.

- Salida solo en España, con la oferta de lanzamiento durante cuatro semanas.
- Ficha de tienda según el borrador ya redactado en `BETA_Y_LANZAMIENTO.md`.
- Vigilar durante las dos primeras semanas: tasa de reembolso, reseñas que mencionen el precio
  o el muro, y el porcentaje de quien ve la pantalla de bloqueo y compra.
- **Umbrales de revisión a las cuatro semanas:** si la conversión de instalación a compra queda
  por debajo del 1 %, el problema es el muro o el precio, no el marketing: revisar qué se
  regala antes de bajar el precio. Si los reembolsos superan el 3 %, hay un problema de
  expectativa en la ficha.
- Hipótesis de trabajo para un juego premium sin marca: conversión del 2–5 % de las instalaciones.
  Es una referencia de sector, no una previsión de este juego.

### F5 — Después del lanzamiento

Por orden de retorno esperado sobre esfuerzo:

1. **Localización a inglés.** El motor no depende del idioma, pero el contenido sí: «Historia
   de España» es un mazo local y varios mazos están escritos desde una mirada española. Es la
   mayor ampliación de mercado disponible y también la más costosa en revisión editorial.
2. **Ampliaciones de contenido de pago.** Mazos nuevos como packs sueltos, con la misma
   exigencia de fuentes que los actuales.
3. **Vía educativa B2B** (ver §9).
4. **Reconsiderar el modelo de entrada.** Con reseñas acumuladas, un precio de entrada bajo
   puede rendir más que el modelo gratuito. Solo con datos propios, no por intuición.

---

## 6. Qué hay que medir, y contra qué se decide

| Indicador | Dónde se mide | Umbral de decisión |
|---|---|---|
| Inicio sin ayuda | F1, observación directa | 8 de 10 |
| Repetición voluntaria a 7 días | F1 y F4 | ≥ 30 % |
| Precio aceptable declarado ≥ 3 € | F1, cuatro preguntas | ≥ 25 % |
| Instalación → compra | F4 | ≥ 1 % para no rehacer el muro |
| Reembolsos | F4 | < 3 % |
| Mazos nunca abiertos | F1 y F4 | Candidatos a pasar a gratuitos |
| Coste de Firestore por sala | F1 | Ver §8 |

---

## 7. Segunda línea: educación

El producto encaja de forma natural en un aula: contenido curricular en español, enciclopedia
con fuentes, partidas cortas, modo de un solo dispositivo y accesibilidad ya trabajada.

La vía es **licencia por centro** —un precio anual por aula o centro, con facturación— y no
compras individuales, porque un colegio no compra en tiendas de aplicaciones. Exige factura,
un contacto de soporte, una política de datos apta para menores y, con toda probabilidad,
adaptaciones (modo profesor, mazos por curso, sin funciones sociales).

**No es la primera línea de ingresos.** Es un producto distinto con un ciclo de venta largo, y
abrirlo antes de que la versión de consumo sea estable consume el tiempo que necesita F1–F4.
Se documenta aquí para no perderlo de vista, con entrada en F5.

---

## 8. Costes que crecen con el uso

El único coste variable relevante es Firestore: las salas multijugador leen y escriben en cada
turno. El plan gratuito tiene un límite diario de operaciones que hoy no se ha medido con uso
real.

Acción concreta en F1: **contar lecturas y escrituras de una partida en sala completa**, de
principio a fin, con el número de jugadores máximo. Con ese número se calcula cuántas salas
simultáneas caben antes de pasar a plan de pago, y cuánto cuesta cada usuario activo. No debe
estimarse: se mide una vez y se sabe.

`SEGURIDAD_Y_OPERACION.md` ya prevé límites, alertas y procedimiento de cierre ante costes
anómalos. Antes de cobrar, esas alertas tienen que estar activas de verdad: un juego de pago
que se cae por un pico de coste es un problema de reembolsos, no solo de infraestructura.

---

## 9. Riesgos, con su plan

| Riesgo | Impacto | Qué se hace |
|---|---|---|
| «Continuum» no disponible como marca | Alto | Resolver en F2, antes de cualquier material gráfico. Nombre alternativo preparado. Mantener `com.continuum.game` estable pase lo que pase. |
| Un dato erróneo en un mazo de pago | Medio-alto | Cerrar fuentes en F2. Un error en contenido cobrado es una reclamación, no una errata. |
| Rechazo en la revisión de la tienda | Medio | Margen de dos semanas antes de cualquier fecha anunciada. No anunciar fecha antes de tener la compilación aprobada. |
| El muro ahuyenta antes de enganchar | Medio | Tres mazos gratuitos completos y pase de invitado. Revisable a las cuatro semanas con datos. |
| Condiciones comerciales del arte | Medio | Confirmar y conservar evidencia en F2. |
| Cliente modificado que se concede derechos | Bajo | Validación fuera del cliente. Aceptado como límite conocido: el contenido ya viaja al navegador. |
| Coste de Firestore por éxito inesperado | Bajo-medio | Medición en F1 y alertas activas antes de F4. |

---

## 10. Lo que este plan no autoriza

Siguiendo el criterio de `ROADMAP.md` §8, no se consideran hechas por estar escritas aquí:

- La elección definitiva de modelo y precio, que depende de F1.
- La disponibilidad legal del nombre.
- La condición de comerciante y el alta fiscal.
- La licencia comercial del arte.
- Ninguna prueba de compra en sandbox ni en dispositivo real.
- Ninguna previsión de ingresos: no hay ninguna en este documento, y no debe deducirse de las
  hipótesis de conversión citadas.

## Criterio para declarar el juego listo para cobrar

1. F1 superada con sus cuatro umbrales, con personas reales.
2. Nombre comprobado, identidad fiscal operativa y condición de comerciante declarada.
3. Catálogo de pago sin cartas pendientes de fuente.
4. Compras validadas fuera del cliente, con restauración probada en iPhone y Android reales.
5. Actualización probada conservando partida, progreso y compra.
6. Privacidad, retención, borrado y declaraciones de tienda coincidiendo con lo que la
   aplicación hace de verdad.
7. Alertas de coste activas y procedimiento de cierre escrito.
