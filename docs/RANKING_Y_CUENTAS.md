# Cuentas y clasificación del reto diario

El código está en el repositorio y funciona en cuanto se publiquen las reglas y se
active el acceso con correo. La función que verifica los resultados es un paso aparte y
opcional: sin ella la clasificación funciona igual, pero las entradas aparecen marcadas
**sin verificar**.

## Qué hay montado

| Pieza | Archivo | Qué hace |
| --- | --- | --- |
| Conexión con Firebase | `nube.js` | La aplicación, la sesión y la base de datos, compartidas por los tres módulos que las usan. |
| Cuentas | `cuenta.js` | Registro con correo, entrada, nombre único, copia del perfil en la nube. |
| Clasificación | `ranking.js` | Envío del reto diario y lectura de las tablas. |
| Verificación | `functions/` | Vuelve a repartir el mazo del día, repite las jugadas y decide los puntos. |
| Permisos | `firestore.rules` | Quién puede escribir qué. |
| Índices | `firestore.indexes.json` | Las consultas ordenadas de la tabla. |

### Dónde vive cada dato

```
users/{uid}                 nick, nickLower, registered, createdAt, updatedAt
users/{uid}/datos/perfil    json  ← la copia del perfil de progreso.js, solo su dueño
nicks/{nickEnMinúsculas}    uid   ← la reserva que hace único cada nombre
retosDiarios/{día__mazo__uid}
                            uid, nick, dia, mazo, semana, aciertos, total,
                            jugadas[], cartas[], ms, huella, creadaEn
                            + verificada, puntos, motivo, revisadaEn  ← solo la función
retosSemanales/{semana__uid}
                            uid, nick, semana, puntos, dias  ← solo la función
```

El identificador de un reto lleva dentro el día, el mazo y el `uid`, y las reglas exigen
que coincida con quien escribe. Eso es lo que hace que nadie pueda enviar el resultado de
otra persona ni enviar dos veces el suyo: la segunda escritura sería una modificación, y
las modificaciones están prohibidas.

## Puesta en marcha

### 1. Activar el acceso con correo y contraseña

En Firebase Console → **Authentication** → **Método de inicio de sesión**, habilita
**Correo electrónico/Contraseña**. El proveedor **Anónimo** tiene que seguir habilitado:
es el que permite entrar en una sala sin cuenta, y es la sesión que se convierte en
cuenta al registrarse.

Comprueba también los **dominios autorizados**, igual que para las salas.

### 2. Publicar reglas e índices

```
firebase deploy --only firestore:rules,firestore:indexes --project timeline-es
```

Sin los índices, la tabla del día devuelve un error de Firestore con un enlace para
crearlos a mano; publicarlos desde `firestore.indexes.json` evita ese paso. Tardan unos
minutos en construirse la primera vez.

Antes de publicar, las reglas se prueban contra el emulador oficial:

```
npm run test:reglas
```

### 3. Verificar los resultados (opcional, requiere plan Blaze)

Sin este paso todo funciona: la gente se registra, envía su reto y ve la tabla. Lo que
falta es la comprobación de que los resultados son ciertos, y el acumulado semanal, que
lo lleva entero la función.

```
cd functions && npm install && cd ..
firebase deploy --only functions --project timeline-es
```

El despliegue ejecuta antes `functions/preparar.mjs`, que copia los mazos y `modes.js`
dentro de `functions/juego/`. Esa carpeta no está en el repositorio a propósito: tener
dos copias de las fechas de las cartas acabaría con una de ellas quedándose atrás.

**Sobre el coste.** Cloud Functions exige el plan Blaze, que pide una tarjeta. A partir
de ahí hay una capa gratuita permanente de 2 millones de invocaciones, 400 000
GB-segundo y 200 000 CPU-segundo al mes. La función se ejecuta **una vez por reto
enviado**: mil personas jugando cada día son unas 30 000 invocaciones al mes, tres
órdenes de magnitud por debajo del límite. El gasto esperado es 0 €, pero conviene:

- configurar una **alerta de presupuesto** en Google Cloud (avisa, no limita);
- dejar `maxInstances` bajo, como está en `functions/index.js`;
- revisar el gasto durante la primera semana de beta.

## Qué garantiza la verificación y qué no

La función vuelve a repartir el mazo del día a partir de la fecha, repite las quince
jugadas que envió el móvil y cuenta los aciertos. Impide:

- declarar aciertos que no se tuvieron: hay que mandar jugadas coherentes con el mazo;
- enviar una partida a medias contando solo los aciertos;
- enviar el mazo de otro día o de otra versión del juego;
- resultados imposibles por tiempo.

**No impide** que alguien calcule de antemano dónde va cada carta. El mazo del día se
genera en el móvil a partir de la fecha y las fechas de las cartas están en `cards.js`,
así que son públicas: quien sepa programar puede resolver el reto sin jugarlo. Cerrar esa
puerta exige que el mazo lo reparta un servidor y que el móvil no conozca los valores
hasta después de colocar, que es el punto 6 del `ROADMAP.md` y no esto.

Para un juego doméstico y una beta entre conocidos, la diferencia relevante es la
primera: sin la función, cambiar un número en la consola del navegador basta para
encabezar la tabla.

## Limpieza y retención

`retosDiarios` crece un documento por persona, día y mazo, y no se borra solo. Antes de
abrir la beta conviene decidir su retención —por ejemplo, conservar noventa días— y
configurarla con una política TTL sobre `creadaEn`, con el mismo cuidado que la de las
salas: un desplazamiento de cero convierte el campo en fecha de vencimiento inmediato.
Ver `CONFIGURAR_MULTIJUGADOR.md`.

El borrado de datos por persona tiene que alcanzar sus retos, su ficha de `users`, la
reserva de su nombre en `nicks` y su acumulado semanal.
