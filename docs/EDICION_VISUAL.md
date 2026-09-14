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
versión visible avanzan juntas a `continuum-v106`. Para la revisión visual se sirve
`dist/` como contenido estático, igual que la distribución, evitando mezclar las
transformaciones de Vite con la caché del service worker.

Revisión visual: escritorio, móvil de 390 px, tema oscuro y texto al 200 %.
Las salas con varios dispositivos y las compilaciones nativas requieren sus
entornos de prueba habituales; este cambio no modifica reglas ni motor de juego.

## Atlas — v153

La entrada de cada mazo integra la portada existente en el papel, con tres muestras
fijas de sus ilustraciones. Las muestras nunca proceden de una mano repartida ni
muestran valores. Las manos conservan los reversos actuales, para no introducir
pistas visuales antes de colocar las cartas.

La barra inferior mantiene Inicio (casa), Enciclopedia, Guía, Perfil y Ajustes en
la navegación y los paneles. Se retira durante la partida. La cabecera de partida
solo contiene la flecha de vuelta y el menú de tres puntos. Salir pide confirmación:
en local guarda; en línea desconecta la vista y regresa a la entrada con el código,
sin borrar la sala ni pausar los turnos. «Salir de la sala» y «Cerrar sala» siguen
siendo acciones explícitas de gestión. Atrás conserva el recorrido de preparación.

La mesa presenta la mano en dos columnas en móvil (cuatro en escritorio). Las
manos de más de cuatro se desplazan; los nombres completos siguen en el DOM y el
texto ampliado puede extender la página. Solitario y Pulso conservan su carta única.
La selección se eleva y se marca en terracota. La confirmación se mueve del hueco a
un único botón debajo de la mano. Zoom de 50 a 120 %, botones circulares y deslizador,
conservando el anclaje y los valores ocultos del Fantasma.

Las portadas se desplazan suavemente; la imagen se funde al entrar al tablero y el
revelado hace un giro breve. Movimiento reducido elimina estos efectos. Ajustes
ofrece sonido de papel/resultados, ambiente tenue y profundidad por orientación,
independientes y desactivados por defecto. Los sensores solo se escuchan en
portadas visibles, después del permiso del dispositivo; denegarlo no afecta al
juego. El sonido se sintetiza localmente y se detiene al ocultar la aplicación.

`tests/interfaz-atlas.mjs` cubre la confirmación única, salida cancelada y confirmada,
guardado/reanudación, zoom, muestras, navegación online con SDK inerte y denegación
de sensores. Se mantienen las pruebas del motor y del Fantasma. Las pruebas DOM
no sustituyen probar sensores, audio y salas reales en iPhone y Android físicos.
