# Revisión de dependencias

Se fijan correcciones transitivas en `package.json` y `package-lock.json`: qs 6.16.0; uuid 11.1.1 en xcode, gaxios y teeny-request; csv-parse 7.0.2 en Firebase CLI; OpenTelemetry core 2.11.0 en Pub/Sub. No se fuerza uuid 11 sobre los consumidores que ya usan una versión posterior.

Las verificaciones incluyen instalación reproducible en CI, arranque del emulador, pruebas Firestore, sincronización Capacitor y compilación móvil. La versión de Firebase Admin incorporada para el servicio experimental es 14.3.0. Capacitor CLI pasa a dependencias de desarrollo porque no es código de ejecución del juego.

La auditoría tras los cambios presenta dos avisos moderados: stream-json 1.9.1 y Firebase CLI como consumidor afectado. Sin avisos altos ni críticos en esa auditoría. stream-json 3.6.0 cambia a módulos ES y rutas de exportación diferentes; Firebase CLI todavía requiere rutas CommonJS como `stream-json/filters/Filter`. Forzar el salto sin adaptar ese consumidor rompería herramientas de importación. Esta excepción queda abierta hasta una versión compatible o una adaptación probada del consumidor; no se oculta ni se rebaja su severidad.

El paquete afectado forma parte de herramientas de desarrollo/importación, no de los archivos que `scripts/build.mjs` distribuye en la aplicación. El límite HTTP del nuevo servidor no se presenta como parche de esa dependencia.

Aviso: [complejidad de filtros de stream-json](https://github.com/advisories/GHSA-528h-pc64-c93x). Revisar de nuevo al actualizar Firebase CLI y retirar cada override cuando el proveedor incorpore su corrección.
