# Preparación comercial de Continuum

Estado de trabajo: 10 de septiembre de 2026.

Este documento separa lo que puede prepararse en el repositorio de lo que necesita una cuenta, una credencial, un pago, una declaración del titular o una revisión jurídica.

## Alcance recomendado para la primera versión

Publicar inicialmente:

- Partidas locales.
- Solitario.
- Reto diario y duelo por enlace.
- Salas privadas multijugador.

Mantener desactivados hasta completar un backend autoritativo:

- Competición pública.
- Rankings globales.
- Premios o clasificaciones arbitradas.

Mantener sin compras en la primera versión salvo que se decida y pruebe una estrategia de monetización. Si se venden mazos digitales, habrá que usar las compras oficiales de Apple y Google.

## Preparado en el repositorio

- Núcleo PWA reutilizado en iOS y Android mediante Capacitor.
- Identificador móvil estable: `com.continuum.game`.
- Iconos y splash nativos.
- Workflow de compilación y firma.
- Workflow de subida a TestFlight.
- Tests automáticos de juego, build, reglas y compilación móvil.
- Política y página de privacidad provisionales.
- Procedencia del arte documentada.
- Correo de feedback configurado.
- Inventario de contenido, fuentes y recursos.
- Pantalla de acceso a privacidad y procedencia desde Ajustes.

## Pendiente externo

- Cuenta y contratos de Apple Developer/App Store Connect.
- Cuenta de Google Play Console.
- Datos legales del responsable y correo de soporte definitivo.
- URL pública definitiva de privacidad y soporte.
- Búsqueda de marca Continuum en OEPM/EUIPO.
- Pruebas físicas y sesiones con testers.
- Revisión final de 17 cartas de Naturaleza.
- Configuración real de App Check, TTL, cuotas y alertas.
- Declaraciones de privacidad y Data Safety en las tiendas.
- Decisión sobre licencia del código y monetización.

## Criterio de publicación

No enviar una compilación como definitiva hasta que:

1. La versión se haya probado en un iPhone y un Android reales.
2. No existan bloqueos P0/P1.
3. La política de privacidad tenga responsable, contacto y URL definitivos.
4. La ficha de cada tienda describa exactamente las funciones disponibles.
5. El backend usado durante la revisión esté activo.
6. La competición pública aparezca desactivada si todavía no existe validación autoritativa.
7. Se hayan guardado copias de la compilación enviada, sus hashes y sus notas de cambios.
