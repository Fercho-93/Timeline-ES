# Activar el modo multijugador

El código de Firebase ya está incluido en `online.js`. Solo falta publicar las reglas de seguridad antes de probar una sala.

## 1. Publicar las reglas de Firestore

1. Abre el proyecto **Timeline ES** en Firebase.
2. Entra en **Firestore**.
3. Abre la pestaña **Reglas**.
4. Borra el contenido del editor.
5. Copia todo el contenido del archivo `firestore.rules`.
6. Pégalo en el editor y pulsa **Publicar**.

Las reglas permiten crear salas, unirse antes de que comience la partida y hacer jugadas únicamente al participante cuyo turno está activo. El anfitrión puede iniciar, desbloquear o cerrar su sala.

## 2. Comprobar Authentication

En **Authentication → Método de inicio de sesión**, el proveedor **Anónimo** debe aparecer como habilitado.

Si Firebase muestra un error de dominio al probar desde GitHub Pages:

1. Abre **Authentication → Configuración → Dominios autorizados**.
2. Añade el dominio `TU-USUARIO.github.io`, sustituyendo `TU-USUARIO` por el nombre de tu cuenta.

## 3. Actualizar GitHub Pages

Sube todos los archivos de esta versión. En especial deben estar:

- `app.js`
- `online.js`
- `styles.css`
- `service-worker.js`
- `cards.js`
- la carpeta `assets`

El archivo `firestore.rules` no es ejecutado por GitHub Pages; se incluye como copia de seguridad de las reglas publicadas en Firebase.

## 4. Probar con dos móviles

1. Abre la web actualizada con conexión a internet.
2. Elige **Varios móviles → Crear una sala**.
3. Escribe el nombre del anfitrión.
4. Comparte el enlace generado o pulsa **Mostrar QR** para que el resto lo escanee con la cámara.
5. Abre el enlace desde un segundo móvil e introduce otro nombre.
6. El anfitrión selecciona las cartas iniciales y la persona más joven.
7. Pulsa **Barajar y empezar**.

El orden de entrada en la sala determina el orden de los turnos; la persona marcada como más joven realiza el primero.

## Privacidad y límites

- No se solicitan correos, teléfonos ni contraseñas.
- Las cuentas anónimas las administra Firebase.
- Las salas utilizan códigos aleatorios de ocho caracteres.
- Los códigos QR se generan dentro del propio dispositivo y no envían la invitación a servicios externos.
- La interfaz solo enseña a cada participante su propia mano.
- Es un juego doméstico: una persona con conocimientos técnicos y acceso a la sala podría inspeccionar los datos enviados al navegador.
- El modo compartido necesita internet. El modo de un móvil continúa funcionando sin conexión.
