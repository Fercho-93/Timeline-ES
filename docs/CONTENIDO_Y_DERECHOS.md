# Trazabilidad del contenido

`node scripts/audit-content.mjs --write` regenera `docs/catalogo-fuentes.json` (las referencias
de cada carta de las Grandes colecciones) y `docs/inventario-arte.json` (cada imagen de `assets/`
con su huella SHA-256). Sin `--write` corre dentro de `npm test` y solo comprueba las fuentes de
Naturaleza (abajo): no vigila que los dos inventarios estén al día, así que hay que regenerarlos
al añadir o cambiar cartas o imágenes. `source` significa que existe una referencia registrada;
no acredita por sí sola que el dato y sus condiciones coincidan. Al regenerar, una imagen nueva
o cuya huella ha cambiado recibe en `rightsEvidence` la declaración general del titular
([PROCEDENCIA_ARTE_IA.md](../PROCEDENCIA_ARTE_IA.md)); la que no ha cambiado conserva su ficha, que
puede ser más detallada (prompt, fecha y generador).

Todas las cartas de Naturaleza (peso, longevidad y velocidad de animales) llevan ya su fuente;
la prueba falla si vuelve a aparecer una sin ella y sin aviso. Los títulos distinguen medias,
sexo, ejemplares, rangos, cautividad o fases adultas cuando corresponde: los datos aproximados no
deben presentarse como récords exactos ni compararse como si fueran medidas homogéneas. Las
cartas de Retos rápidos llevan fuente y curiosidad en `mazos/quick-challenges-data.js`, y sus revisiones
y fuentes ampliadas están en `docs/revisiones/` y `docs/fuentes-*.json`.

El estado de la revisión carta por carta está en [AUDITORIA_MAZOS.md](AUDITORIA_MAZOS.md):
que una carta tenga URL no la convierte en verificada. Antes de un lanzamiento educativo o
comercial, cada cifra debería documentar población, sexo o condición, unidad, criterio (media,
rango o máximo), referencia y fecha de revisión.

Para el arte, consultar [PROCEDENCIA_ARTE_IA.md](../PROCEDENCIA_ARTE_IA.md) y
`docs/inventario-arte.json`. El titular declara que todos los recursos visuales incorporados se
generaron con ChatGPT/OpenAI. La procedencia de la imagen no sustituye la revisión de términos
comerciales del servicio ni la revisión independiente de textos, datos, marcas o elementos de
terceros. Mantener la evidencia fuera de los recursos distribuidos si contiene datos privados.
Revisar también tipografías, textos y dependencias (`docs/licencias-dependencias.json`, que se
regenera a mano con `node scripts/audit-licenses.mjs --write` y ninguna prueba vigila, y
[dependencias-seguridad.md](dependencias-seguridad.md)).
