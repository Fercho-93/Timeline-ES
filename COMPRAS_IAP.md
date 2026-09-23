# Compras dentro de la app (A.3)

Registro de decisiones y estado, para no repetir la misma conversación cada vez. La implementación real (código de compra, productos en las tiendas) todavía no existe — hoy `cartera.js` es una simulación sin cobro real, pensada justo para que se pueda enchufar esto sin tocar el resto del juego (ver comentarios al principio de ese fichero).

## Decisiones ya tomadas

- **Validación de recibos**: RevenueCat, no servidor propio. Motivo: valida recibos de Apple/Google, gestiona reembolsos y estados pendientes sin mantener un backend de pagos propio (que es justo el tipo de infraestructura que exige más cuidado por manejar pagos reales).
- **Family Sharing**: desactivado. Cada cuenta compra su propia copia; no se comparte entre el grupo familiar de Apple/Google. Esto se aplica como una casilla en el momento de crear cada producto en App Store Connect / Play Console — no es un cambio de código, es una configuración a marcar cuando se den de alta los productos.
- **Titularidad**: persona física (Fernando Sirvent Merino), no empresa — ver `privacidad.html`.

## Estado de las cuentas de tienda

- **Apple Developer Program**: ya existe.
- **Google Play Console**: todavía no está creada. Bloquea todo lo que dependa de Play Console (crear productos, Data Safety de A.4.2, sandbox de Android).

## Qué queda por hacer, y qué lo bloquea

La mayoría de A.3 no se puede avanzar sin acciones dentro de App Store Connect / Play Console que solo puede hacer quien tiene la cuenta — no es código que se pueda escribir de antemano sin saber los IDs de producto reales que asigne cada tienda:

- Crear los productos IAP en cada tienda (mazo suelto y colección, ver precios de referencia en `cartera.js`).
- Configurar el entorno Sandbox de cada tienda y probar el flujo completo con un comprador de prueba.
- Vincular cada producto a la ficha de la versión que se envíe a revisión.
- Escribir las Review Notes para Apple y las capturas de cada producto.
- Enlazar el EULA estándar de Apple.

Lo que sí se puede preparar en código en cuanto se sepan los identificadores de producto reales de cada tienda: el botón «Restaurar compras», la conexión de `cartera.js` con las respuestas reales de la tienda (sustituyendo `SIMULACION`), y el envío del recibo a RevenueCat para validarlo.

## Guía paso a paso: crear los productos en App Store Connect

Con esto puedes empezar ya, sin esperar a Google Play. Cubre solo los tres mazos que hoy están en `SIMULACION` (`mixed`, `astronomy`, `medicine`) más su colección y el paquete «todo» — son los que el propio código ya sabe vender; el resto del catálogo se puede sumar después con el mismo patrón, cuando decidas ampliar qué se vende.

**1. Entra en App Store Connect → tu app → Funciones → Compras dentro de la app.** (Si la app todavía no existe como ficha ahí, hay que crearla primero — nombre, bundle ID `com.continuum.game`, que ya coincide con `capacitor.config.json`.)

**2. Crea cada producto como «No consumible»** (Non-Consumable): una vez comprado, es tuyo para siempre — es el tipo correcto para desbloquear un mazo, no para algo que se gasta y hay que recomprar.

**3. Usa estos Product ID** (Apple los pide únicos y, una vez creados, no se pueden cambiar — por eso conviene fijarlos ya con un patrón claro):

| Product ID sugerido | Qué desbloquea | Precio de referencia (`cartera.js`) | Tier de Apple más cercano |
|---|---|---|---|
| `com.continuum.game.iap.mazo.mixed` | Mazo suelto «Gran mezcla temporal» | 3,99 € | Tier 4 (3,99 €) |
| `com.continuum.game.iap.mazo.astronomy` | Mazo suelto «Astronomía y espacio» | 3,99 € | Tier 4 (3,99 €) |
| `com.continuum.game.iap.mazo.medicine` | Mazo suelto «Historia de la medicina» | 3,99 € | Tier 4 (3,99 €) |
| `com.continuum.game.iap.coleccion.ciencia` | Colección «Ciencia» (astronomía + medicina juntas) | 5,99 € | Tier 6 (5,99 €) |
| `com.continuum.game.iap.todo` | «Todos los mazos» | 14,99 € | Tier 15 (14,99 €) |

Apple no deja fijar el precio exacto en euros: elige el «tier» de precio de la lista que ofrece App Store Connect; los de la tabla son los que hoy coinciden en euros con lo que ya calcula `cartera.js` (revísalo en el momento, Apple ajusta tiers de vez en cuando).

**4. Nombre de referencia (interno, no lo ve el jugador) y nombre para mostrar**: usa el mismo nombre que ya tiene el mazo en el juego («Astronomía y espacio», «Historia de la medicina», etc. — están en la tabla). Para la descripción que si ve el jugador, evita las palabras que pide A.3.6 evitar: nada de «free», «trial», «lifetime» — describe qué se desbloquea, sin más.

**5. Captura de pantalla del producto (A.3.13)**: Apple pide una por producto, mostrando la pantalla de compra dentro de la app. Se puede hacer con el juego actual: la pantalla de mazo bloqueado ya existe (es la que enseña la simulación de `cartera.js` con el candado), así que sirve tal cual como captura.

**6. Guarda cada Product ID exacto que Apple te confirme** (a veces difieren un poco de lo que pides si ya existe algo parecido) **y pásamelos** — con eso conecto `cartera.js` a las respuestas reales de la tienda en vez de la lista `SIMULACION`, y dejo el botón «Restaurar compras» funcionando de verdad.

**Lo que viene después, y no depende de ti crear nada nuevo todavía**: configurar el Sandbox Tester (un usuario de prueba que compra sin pagar de verdad, en Ajustes de tu iPhone/iPad de pruebas) para probar el flujo completo una vez el código esté conectado a los Product ID reales.
