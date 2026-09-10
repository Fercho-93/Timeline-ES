# Continuum — hoja de ruta

Estado revisado: 10 de septiembre de 2026.

Este documento distingue lo que está implementado en el repositorio de lo que requiere pruebas reales, credenciales, configuración externa o una decisión del titular.

## Estado resumido

- **Beta técnica privada:** aproximadamente 80–85%.
- **Beta con testers reales:** aproximadamente 65–70%.
- **Publicación comercial:** aproximadamente 45–55%.

Los porcentajes son orientativos: no sustituyen la ejecución de las pruebas ni la validación legal.

## 1. Ya implementado

- Modos local, competición, solitario, Pulso y Fantasma.
- Dificultades del solitario y modo Fantasma constante.
- Multijugador con salas, turnos, presencia, abandono y recuperación del anfitrión.
- Reglas de Firestore y pruebas contra emulador.
- Guardado, migración, compatibilidad, diagnóstico y actualización.
- Accesibilidad, movimiento reducido, teclado, lector de pantalla y navegación móvil.
- Capacitor con proyectos `android/` e `ios/`.
- `capacitor.config.json`, `dist/`, iconos y splash generables.
- Tests de juego, mazos, build, enlaces, reglas, Pulso, Fantasma y servidor experimental.
- Servidor experimental con validación de cartas y resultados del servidor.
- Documentación inicial de beta, distribución, privacidad, seguridad y derechos.
- Inventario de fuentes y arte.

## 2. Prioridad inmediata: dejar lista la beta privada

- [ ] Ejecutar `npm ci`, `npm test` y `npm run test:reglas`.
- [ ] Confirmar que el build móvil genera `dist/` correctamente.
- [ ] Publicar y verificar en Firebase las reglas correspondientes a la versión actual.
- [ ] Verificar App Check, cuotas, retención y alertas en un proyecto de ensayo.
- [ ] Probar la compilación en un Android físico.
- [ ] Repetir las pruebas en iPhone y Android: reconexión, bloqueo, pérdida de red, enlaces, actualización, orientación y áreas seguras.
- [x] Configurar el correo de feedback real.
- [ ] Preparar un registro de incidencias con prioridad P0–P3.
- [ ] Reclutar testers y registrar resultados sin datos personales innecesarios.

## 3. Contenido y derechos

- [ ] Revisar las 17 cartas de Naturaleza sin fuente cerrada.
- [ ] Comenzar por topo europeo y valores que mezclan medias, máximos, rangos o cautividad.
- [ ] Documentar población, unidad, criterio, fecha y fuente de cada cifra.
- [x] Documentar la procedencia declarada del arte, icono y splash; queda conservar la evidencia privada de generación.
- [ ] Registrar autor/generador, fecha, origen y condiciones de uso comercial.
- [ ] Revisar textos, fuentes y dependencias de terceros.
- [ ] No considerar una carta o recurso validado solo porque tenga una URL de referencia.

## 4. Seguridad para beta ampliada

- [ ] Confirmar que la configuración activa coincide con las reglas aprobadas.
- [ ] Activar y observar App Check antes de aplicar enforcement.
- [ ] Configurar TTL real para salas, presencia y registros asociados.
- [ ] Preparar borrado explícito de datos por usuario.
- [ ] Configurar límites, alertas y procedimiento de cierre ante abuso o costes anómalos.
- [ ] Mantener la competición pública desactivada mientras el servidor no esté desplegado.

## 5. Distribución móvil

- [ ] Crear/configurar cuenta Apple Developer y App Store Connect.
- [ ] Crear/configurar cuenta Google Play Console.
- [ ] Configurar certificados y secretos únicamente en GitHub Actions.
- [ ] Generar un AAB Android firmado.
- [x] Generar un archive iOS firmado.
- [ ] Probar TestFlight con testers externos y Google Play Closed Testing.
- [ ] Completar asociaciones de enlaces iOS/Android desde la raíz del dominio.
- [ ] Probar actualización conservando una partida y una sala pendiente.

## 6. Servidor de competición pública

- [ ] Elegir catálogo competitivo revisado y versionado.
- [ ] Desplegar el servidor detrás de HTTPS.
- [ ] Configurar Application Default Credentials y orígenes permitidos.
- [ ] Integrar la interfaz de la aplicación.
- [ ] Completar Fantasma, abandono, recuperación y controles globales.
- [ ] Revisar IAM, App Check nativo, revocación, cuotas y alertas.
- [ ] Ejecutar pruebas de carga y recuperación.
- [ ] No anunciar esta modalidad como disponible hasta terminar estos puntos.

## 7. Comercialización

- [ ] Comprobar disponibilidad de Continuum en OEPM/EUIPO y tiendas.
- [ ] Decidir la licencia definitiva del proyecto.
- [ ] Completar identidad del responsable, contacto y soporte.
- [ ] Revisar profesionalmente privacidad, retención y borrado.
- [ ] Completar cuestionarios de edad, Data Safety y privacidad de cada tienda.
- [ ] Generar capturas reales desde una compilación final.
- [ ] Validar comprensión, repetición y disposición a pagar.
- [ ] Decidir monetización después de la beta.
- [ ] Si se venden mazos: implementar compras oficiales, restauración, reembolsos y validación en servidor.

## 8. Límites de este roadmap

No se consideran completados por existir código o documentación:

- Una prueba en móvil real.
- Una publicación efectiva en Firebase, TestFlight o Google Play.
- Una licencia comercial del arte.
- La disponibilidad legal de la marca.
- La seguridad frente a clientes modificados.
- La preparación comercial de la competición pública.

## Criterio para declarar la beta preparada

La beta privada podrá considerarse preparada cuando:

1. Las suites automáticas estén verdes.
2. Las reglas activas de Firebase estén verificadas.
3. Exista una compilación móvil instalable.
4. Se haya probado al menos un iPhone y un Android reales.
5. No existan bloqueos P0/P1 conocidos.
6. El canal de feedback y la política provisional estén disponibles.
