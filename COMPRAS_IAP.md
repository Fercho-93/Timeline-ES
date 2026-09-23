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
