# Edición visual de Continuum

La interfaz prolonga el carácter de los grabados existentes: papel marfil, tinta,
latón y marcos de lámina. La colección usa portadas numeradas y la navegación
flotante mantiene a mano Inicio, Colección, Perfil y Ajustes.

## Alcance

- `edition.css` contiene exclusivamente la presentación de la interfaz. Sus
  variables `--edition-*` y `--scene-*` no sustituyen las tintas ni las superficies
  originales de las cartas.
- Se conservan todos los archivos de `assets/`, todos los mazos y `modes.js`.
  No se modifica `styles.css`, que mantiene la presentación original de las cartas.
- Historia usa terracota; entretenimiento, ciruela; ciencia, petróleo;
  naturaleza, verde bosque; geografía, azul cartográfico; mezcla, bronce.
  La portada y el perfil vuelven al ambiente común de la colección.
- Los modos claro, oscuro y automático siguen usando el ajuste existente.

## Movimiento con una función

- La apertura dibuja cinco hitos y se funde con la portada en aproximadamente
  1,3 segundos. Se muestra una vez por dispositivo para esta edición. Un toque
  permite saltarla; cualquier tecla la retira inmediatamente. El límite de
  seguridad de 1,8 segundos evita un bloqueo si falta `animationend`.
- El acceso a un mazo revela su título; abrir una colección despliega sus juegos.
- Un acierto recibe un halo único de 650 ms alrededor del indicador de resultado.
- La competición muestra la portada de la siguiente familia y el número de tema.
  El usuario sigue decidiendo cuándo comenzar; no se añaden esperas al juego.
- Las circunferencias de fondo son estáticas. Movimiento reducido elimina las
  nuevas animaciones y la apertura. No hay bucles de partículas ni nuevas descargas.

## Verificación

`npm test` incluye `tests/edicion.mjs`: recorre las seis familias, entra en sus
partidas, comprueba el regreso al ambiente común y la correspondencia entre el
cartel de competición y el tema siguiente. También cubre apertura ya vista,
movimiento reducido y salida mediante teclado.

`npm run build` incluye `edition.css` en el paquete para Capacitor. La caché y la
versión visible avanzan juntas a `continuum-v90`. Para la revisión visual se sirve
`dist/` como contenido estático, igual que la distribución, evitando mezclar las
transformaciones de Vite con la caché del service worker.

Revisión visual: escritorio, móvil de 390 px, tema oscuro y texto al 200 %.
Las salas con varios dispositivos y las compilaciones nativas requieren sus
entornos de prueba habituales; este cambio no modifica reglas ni motor de juego.
