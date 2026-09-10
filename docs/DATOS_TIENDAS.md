# Inventario preparatorio de datos para las tiendas

Estado: borrador técnico; debe verificarse contra la configuración de producción antes de enviarlo.

## Partidas locales

Se guardan en el dispositivo:

- Partidas y progreso.
- Ajustes.
- Estadísticas y perfil.
- Racha y resultados del reto diario.
- Datos de diagnóstico cuando el usuario decide descargarlos o enviarlos.

No se envían a Firebase en el modo local.

## Salas multijugador

Firebase/Firestore trata, según la funcionalidad utilizada:

- Identificador de autenticación seudónimo.
- Nombre elegido por el usuario.
- Código y estado de la sala.
- Cartas, turnos, puntuaciones y resultado.
- Marcas de actividad y presencia.
- Datos técnicos necesarios para sincronizar la sala.

La autenticación es seudónima, pero el identificador debe declararse como dato de usuario en Google Play cuando pueda asociarse razonablemente con una persona o dispositivo.

## Acciones voluntarias

- El usuario puede abrir un correo de feedback.
- El usuario puede guardar un comentario con diagnóstico.
- El usuario puede compartir un duelo o enlace.
- El usuario puede exportar o borrar su progreso local cuando la interfaz lo permita.

## Declaraciones que deben completarse

Antes de publicar:

1. Confirmar todos los SDK y librerías presentes en el binario.
2. Confirmar qué datos llegan realmente a Firebase en producción.
3. Completar App Store Connect Privacy.
4. Completar Google Play Data safety.
5. Publicar una política de privacidad accesible sin iniciar sesión.
6. Confirmar cifrado en tránsito.
7. Confirmar un mecanismo de solicitud de borrado de datos de salas.
8. No marcar “no se recogen datos” si Firebase recibe identificadores, nombres o estado de partida.

Este documento no sustituye las declaraciones oficiales de las tiendas; sirve como inventario de preparación.
