# Auditoría factual de mazos

Este registro indica qué cartas se han contrastado de forma individual. Una prueba automática de estructura o una URL guardada en una carta no equivalen por sí solas a verificar sus afirmaciones. Continuar por el siguiente mazo o por la siguiente carta pendiente, y no volver a marcar como revisadas las ya cerradas salvo que cambie su contenido o su fuente.

## Retos rápidos

| Mazo | Estado | Resultado |
| --- | --- | --- |
| `sports-players` · Deportes por jugadores por equipo | 21/21, cerrado el 30-09-2026 | Las cifras concuerdan con la modalidad indicada. Se precisaron lacrosse de campo masculino, curling de cuatro y natación artística por equipos; esta última admite deportistas varones. La regla ahora aclara béisbol y críquet. Cada carta enlaza una referencia específica de federación, liga u organismo deportivo. |
| `drinks` · Graduación de bebidas | 2/21, en curso | La graduación no es una propiedad fija de la categoría. Las cartas 1 y 2 ahora nombran productos concretos, Heineken Original y La Sidruca Original, con porcentajes confirmados en sus fichas de fabricante. Próxima: carta 3, vino de mesa. |
| `companies-revenue` · Empresas por facturación en 2025 | 30/30, revisado el 04-10-2026 | 22 empresas añadidas. Las ocho anteriores revisadas; todas en M€ con media anual 2025 de Eurostat, periodo fiscal y entidad precisos. Fuentes, cálculos y particularidades en `revision-facturacion-empresas-2025.md`. |
| `spanish-tv` · Programas españoles por fecha de estreno | 19/19, revisado el 04-10-2026 | Diez programas añadidos con referencias de cadenas y productora. Mes y año históricos en lugar de antigüedad; orden cronológico por ambos, con el alcance de cada versión documentado en `revision-programas-estrenos-2026-10-04.md`. |
| `poker` · Manos del póker | 9/9, cerrado el 30-09-2026 | El orden de carta alta a escalera de color es correcto para póker alto tradicional de cinco cartas y sin comodines. Se mantiene sin ilustraciones por decisión de diseño de esta primera fase. |
| `minimum-wages` · Países por salario mínimo | 22/22, revisado el 04-10-2026 | Serie Eurostat S2 de 2026 contrastada con referencias nacionales; se corrigen Rumanía, Polonia y Bélgica y se uniforma la precisión. Doce países añadidos y 22 ilustraciones renovadas. Registro: `revision-salarios-minimos-2026-10-04.md`. |
| `airports` · Aeropuertos por pasajeros | 7/7, cerrado el 30-09-2026 | Las cifras redondeadas coinciden con la tabla oficial de ACI World de tráfico total de pasajeros de 2025; se mantiene el criterio explícito de pasajeros, no movimientos de aeronaves ni carga. |
| `eurovision-wins` · Países por victorias en Eurovisión | 12/12, cerrado el 30-09-2026 | Las cifras de los países incluidos son correctas. Se aclaró que es una selección y no un listado exhaustivo, y se actualizó la fuente al historial oficial; Bulgaria ganó por primera vez en 2026, pero no forma parte de esta selección. |
| `storage` · Unidades de almacenamiento | 9/9, cerrado el 30-09-2026 | Orden correcto de byte a yottabyte usando prefijos decimales del SI; se especifica que no son unidades binarias. |
| `metros` · Redes de metro por longitud | 9/9, cerrado el 30-09-2026 | Los valores mantienen el orden de la fuente y se aclaró que son longitudes aproximadas de red operativa, porque el resultado cambia según se cuenten ramales, tramos compartidos o servicios integrados. |
| `albums-sales` · Discos por ventas | 9/9, cerrado el 30-09-2026 | Las cifras se mantienen como estimaciones mundiales aproximadas y no como ventas certificadas. Se sustituyó la referencia de Guinness, que ya devolvía 404, por una lista accesible y se explicitó la variabilidad metodológica. |
| `stadiums` · Estadios de fútbol por capacidad | 10/10, cerrado el 30-09-2026 | Las capacidades son coherentes como cifras nominales o declaradas; se aclaró que el aforo operativo puede reducirse por obras, reformas o seguridad. |
| `capitals-altitude` · Capitales del mundo por altitud | 9/9, cerrado el 30-09-2026 | Las cifras son coherentes usando la altitud aproximada del centro urbano, criterio que se mantiene explícito para no confundirlo con la elevación media del término municipal. |
| `foods-kcal` · Alimentos por calorías | 14/14, cerrado el 30-09-2026 | Los valores son referencias estándar por 100 g; se aclaró que la preparación puede alterar mucho la cifra y se identifica cuando el alimento es cocido o asado. |
| `series-seasons` · Series por número de temporadas | 11/11, cerrado el 30-09-2026 | Los recuentos son correctos a 2026; se aclaró que se cuentan temporadas estrenadas o en emisión, no episodios ni partes. |

Quedan pendientes 202 cartas de retos rápidos: 19 de `drinks` y 183 de otros 14 retos rápidos aún no cerrados. En `drinks`, la referencia común del NIAAA explica la unidad de bebida estándar, pero no respalda la graduación exacta de cada producto: sustituirla carta por carta por ficha o etiqueta específica. Para el deporte de Kin-Ball, la fuente es una federación nacional: conviene sustituirla por el reglamento internacional cuando esté accesible. La fuente de polo es el reglamento de la asociación estadounidense; la cifra corresponde al polo exterior.

## Grandes colecciones

| Mazo | Estado | Resultado |
| --- | --- | --- |
| `astronomy.js` · Astronomía y espacio | 55/55, cerrado el 30-09-2026 | Contraste individual de fecha, hito, modalidad y explicación con fuentes institucionales de NASA, ESA, ESO, IAU, LIGO, CNSA y otras instituciones. Se explicitaron las fechas aproximadas antiguas; Rømer no calculó una velocidad en distancia/tiempo; la cefeida de Andrómeda se identificó en 1923, con anuncio de la conclusión en 1924; la señal de LIGO se captó en 2015, pero se anunció en 2016; Philae rebotó tras el primer contacto. Las 55 cartas enlazan su fuente específica. |

Las otras 14 grandes colecciones ya han tenido revisiones generales y algunas correcciones, pero siguen pendientes de cierre individual carta por carta en esta ronda: 1.217 cartas en total. No significa que estén sin mirar, sino que aún no se han certificado formalmente todas sus afirmaciones y fuentes. Sumadas a los 202 retos rápidos pendientes, quedan 1.419 cartas por cerrar formalmente.

## Criterio de revisión

Para cada carta, contrastar cifra o fecha, unidad, modalidad o definición, título y explicación con una fuente primaria o institucional. Tratar fechas aproximadas y magnitudes variables como tales. Mantener el identificador estable al corregirla. Añadir la fuente a la carta cuando el esquema lo permita y registrar las dudas no resueltas antes de pasar a la siguiente.
