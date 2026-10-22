# Trazabilidad del contenido

`node scripts/audit-content.mjs --write` regenera `docs/catalogo-fuentes.json` (las referencias
de cada carta de las Grandes colecciones) y `docs/inventario-arte.json` (cada imagen de `assets/`
con su huella SHA-256). Sin `--write` solo comprueba, y así corre dentro de `npm test`. `source`
significa que existe una referencia registrada; no acredita por sí sola que el dato y sus
condiciones coincidan. `rightsEvidence: null` identifica la falta de una evidencia de derechos
registrada, no una conclusión de infracción. Una imagen cuya huella cambia queda marcada con
`reviewRequired`.

Todas las cartas de Naturaleza (peso, longevidad y velocidad de animales) llevan ya su fuente;
la prueba falla si vuelve a aparecer una sin ella y sin aviso. Los títulos distinguen medias,
sexo, ejemplares, rangos, cautividad o fases adultas cuando corresponde: los datos aproximados no
deben presentarse como récords exactos ni compararse como si fueran medidas homogéneas. Las
cartas de Retos rápidos llevan fuente y curiosidad en `mazos/quick-challenges-data.js`, y sus revisiones
y fuentes ampliadas están en `docs/revisiones/` y `docs/fuentes-*.json`.

El estado de la revisión carta por carta está en [docs/AUDITORIA_MAZOS.md](AUDITORIA_MAZOS.md):
que una carta tenga URL no la convierte en verificada. Antes de un lanzamiento educativo o
comercial, cada cifra debería documentar población, sexo o condición, unidad, criterio (media,
rango o máximo), referencia y fecha de revisión.

Para el arte, consultar [PROCEDENCIA_ARTE_IA.md](../PROCEDENCIA_ARTE_IA.md) y
`docs/inventario-arte.json`. El titular declara que todos los recursos visuales incorporados se
generaron con ChatGPT/OpenAI. La procedencia de la imagen no sustituye la revisión de términos
comerciales del servicio ni la revisión independiente de textos, datos, marcas o elementos de
terceros. Mantener la evidencia fuera de los recursos distribuidos si contiene datos privados.
Revisar también tipografías, textos y dependencias (`docs/licencias-dependencias.json`,
`docs/dependencias-seguridad.md`).
