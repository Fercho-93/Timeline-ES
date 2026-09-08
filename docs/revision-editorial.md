# Revisión editorial: 8 de septiembre de 2026

Se registran dos correcciones con población, criterio y unidades explícitos. No se presenta una referencia bibliográfica como verificación automática de toda una especie.

| Carta | Antes | Ahora | Evidencia y límite |
|---|---|---|---|
| 10004 | Rana arborícola verde, 10 g sin fuente | Ranita de San Antonio, machos estudiados, 5,65 g | El estudio de alimentación suplementaria de *Hyla arborea* informa una masa inicial media de 5,65 ± 0,78 g. Es una muestra de machos, no un promedio universal de todas las ranas. [Artículo](https://link.springer.com/article/10.1186/1472-6785-9-1). |
| 12005 | 0,1 años descritos como seis semanas | 42/365,25 años, referencia de seis semanas | El trabajo de Rueppell y colaboradores describe cuatro a ocho semanas de vida adulta. Se usa el punto medio como referencia de juego, sin llamarlo esperanza de vida. [Artículo](https://doi.org/10.1016/j.exger.2007.06.002). |

La consulta de Animal Diversity Web sobre abejas da otro rango de semanas para obreras de verano. Esto refuerza la necesidad de identificar población y criterio; no deben mezclarse esos rangos ni inferirse una cifra universal.

Las otras 17 cartas de Naturaleza sin fuente se identifican como «en revisión» en el título y como pendientes en su explicación. Los valores provisionales se conservan para no inventar sustitutos. La guía vuelve a explicar ese estado. Las pruebas ahora exigen cero cartas sin fuente **y sin aviso**, manteniendo la deuda total limitada a 17; se corrige así el supuesto anterior de que todas las cartas ya estaban documentadas.

El inventario recoge 961 cartas y 113 referencias registradas. Tener `source` no basta para declarar una carta validada: estas dos incluyen además `reviewedAt` y `comparison`. Queda revisión editorial carta por carta, comenzando por el topo europeo y su confusión de unidades.

Los guardados existentes conservan su copia del catálogo. Los cambios de valor y texto se detectan mediante la huella de contenido; no se recalcula silenciosamente una partida antigua con las cifras nuevas.

## Procedencia y derechos

El inventario de arte conserva la evidencia registrada mientras coincida la huella del archivo. Si cambia el archivo, conserva el registro anterior como evidencia histórica y exige revisión; volver a ejecutar el generador ya no borra las anotaciones del titular.

Las 959 entradas actuales del catálogo visual no incluyen una evidencia de licencia registrada. Esto significa falta de documentación, no una conclusión sobre infracción. La procedencia de las dos reparaciones consta en `procedencia-recuperaciones.md`.

También requieren evidencia específica `resources/icon.png`, `resources/splash.png` e `icon.svg`, fuera del inventario de cartas. No se han encontrado archivos de tipografías distribuidos en assets/ ni resources/: la hoja de estilos solicita fuentes del sistema. Las declaraciones de licencia de los paquetes se registran mediante `scripts/audit-licenses.mjs`; son metadatos de sus autores, no una revisión jurídica ni una licencia del arte del juego.
