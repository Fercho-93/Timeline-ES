# Verificación de fechas y cifras de las 14 Grandes colecciones — 20 de octubre de 2026

Pasada de comprobación sobre las 1.272 cartas de las Grandes colecciones (más las 567 de los Retos rápidos revisadas por muestreo). No cierra carta a carta cada afirmación (eso sigue en `AUDITORIA_MAZOS.md`): busca los datos que estén **mal** o que **admitan dos respuestas correctas**, que son los que hacen que un jugador sienta que el juego le engaña.

## Método

1. Volcado de todas las cartas y comprobaciones automáticas (duplicados, años imposibles, empates, orden, fuentes vacías).
2. Recálculo de las distancias de `distances.js` con la fórmula del círculo máximo y contraste con las coordenadas.
3. Lectura de cada mazo buscando fechas, cifras y titulares dudosos.
4. Los casos dudosos se contrastaron con búsquedas web de fuentes institucionales, enciclopédicas o de prensa.

## Correcciones aplicadas (11)

| Carta | Antes | Ahora | Motivo |
| --- | --- | --- | --- |
| `music` 6066 · Billie Jean | 1982 | 1983 | El sencillo salió en enero de 1983; 1982 es el álbum *Thriller*, que además es otra carta. |
| `inventos` 4002 · Rueda de alfarero | -3000 | -3500 | Los tornos de alfarero mesopotámicos se datan hacia 3500 a. C. |
| `inventos` 4003 · Papiro | texto | texto | Se aclara que -2600 es la fecha de los papiros con texto más antiguos conservados; el uso es anterior. |
| `distances` 11001 · París–Versalles | 17 km | 18 km | En línea recta entre centros urbanos salen 17,6–17,9 km. |
| `countries` 2065 · Turkmenistán | «más de cuatro quintas partes» | «cerca del 70 %» | El Karakum cubre alrededor del 70 % del país. La superficie (valor de la carta) no cambia. |
| `idiomas` 14011 · Vietnamita | «única lengua grande del sudeste asiático con alfabeto latino» | texto neutro | Es falso: indonesio, malayo, javanés y filipino también usan alfabeto latino. |
| `animals` 10035 · Cachalote | «empate de verdad con la ballena gris» | sin empate | No existe esa carta de ballena gris; la frase inducía a error. |
| `movies` 1064 · La comunidad del anillo | «estrena en Nueva Zelanda» | rodada en NZ, estreno mundial en Londres | El estreno mundial fue en Londres (10-12-2001). |
| `quick` Batalla de Teruel | 22-12-1937 | 15-12-1937 | La batalla empezó el 15 de diciembre de 1937; el 22 de febrero de 1938 es el final. |
| `quick` Fernando VII | texto | texto | Se aclara que reinó unas semanas en 1808 y que el reto usa 1814 (regreso). |
| `quick` TikTok | texto | texto | Se aclara que Douyin es de 2016 y la versión internacional de 2017. |
| `quick` Miño | texto | texto | Se aclara que la longitud varía según la fuente (307–340 km). |

`docs/catalogo-fuentes.json` se regeneró con `node scripts/audit-content.mjs --write`. La prueba `tests/auditoria-correcciones.mjs` impide que estos datos vuelvan atrás.

## Dudas que quedan abiertas (dependen de la fuente, no son errores claros)

- **Miño 315 km** (Wikipedia en español) frente a 340 km de otras fuentes: según cuál se use, cambia su posición respecto al Segura (325 km). Ya aclarado en el texto de la carta; conviene decidir una única fuente y reordenar si hace falta.
- **Guadiana 744 km**: otras fuentes dan 818–829 km (incluye el tramo fronterizo y el alto Guadiana). Mismo criterio.
- **Intellivision 1979 / 1980**: lanzamiento de prueba en 1979 y comercialización general en 1980.
- **«In the End» de Linkin Park**: sencillo de 2001, álbum *Hybrid Theory* de 2000.
- Cartas con nombre ambiguo (apellidos comunes, coronaciones frente a proclamaciones): sin cambios, ya acotadas por el texto de cada carta.

## Qué falta

- Los Retos rápidos pendientes (183 cartas de 14 retos y 19 de `drinks`) siguen sin cierre individual; esta pasada solo los muestreó.
- Las 14 Grandes colecciones siguen sin «cierre formal» carta por carta; esta pasada aporta el filtro de errores evidentes.
