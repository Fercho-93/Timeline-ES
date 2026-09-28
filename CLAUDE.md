# Flujo de trabajo

- Los cambios se commitean y se suben directamente a `main`.
- **Caché en cada cambio:** cualquier cambio que altere lo que ve el usuario (JS, CSS, HTML, assets) sube la versión a la vez en `service-worker-258.js` (`CACHE = "continuum-vNNN"`), `updates.js` (`CT.APP_VERSION`) y `index.html` (`edition.css?v=NNN`). Sin esto, el service worker sigue sirviendo la versión anterior y el cambio "no aparece".
- **Cambios en paralelo:** puede haber otras sesiones o personas subiendo a `main`. Antes de empezar y antes de cada push: `git fetch origin main` y mezcla lo nuevo. Si alguien ya subió la versión de caché, toma su número y súmale uno; nunca lo repitas ni lo pises. Si hay conflicto, resuélvelo sin descartar el trabajo ajeno.
- **Revisar cada cambio:** antes de commitear, repasa el diff (`git diff`) buscando efectos colaterales (otros scripts que dependan de lo tocado, como `home-modes-v1.js`), y ejecuta las pruebas relacionadas (`tests/service-worker.mjs`, `tests/actualizar.mjs` y las del área tocada). Varias pruebas fallan ya en `main` por selectores antiguos (`[data-block=...]`); compara contra `main` antes de dar un fallo por tuyo.
