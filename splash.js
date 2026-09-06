// El telón de apertura.
//
// Vive fuera de `app.js` y se carga en la cabecera por dos razones. La primera es que
// tiene que estar en pantalla antes que nada: si esperase a que se evalúen los catorce
// mazos, el telón llegaría después de la portada y ya no sería una entrada. La segunda es
// que tiene que poder decidir NO aparecer antes del primer pintado, y eso solo se puede
// hacer desde arriba.
//
// Ese caso es real: cuando el service worker toma el control recarga la página él solo,
// así que un telón por carga se vería dos veces seguidas en la primera visita. La marca
// en `sessionStorage` dura lo que dura la pestaña —una apertura de verdad de la
// aplicación instalada estrena pestaña y estrena telón—, de modo que la recarga interna
// entra ya en la portada.
//
// Quien manda de verdad es la hoja de estilo: el telón entra, se sostiene y se va con una
// animación propia que termina en `visibility: hidden`. Este archivo solo adelanta la
// salida cuando alguien la toca y retira el nodo al acabar. Si algo aquí fallara, el
// telón se apartaría igual y la aplicación seguiría siendo jugable.
(function () {
  "use strict";

  var CLAVE = "continuum-splash-visto";
  // Lo que dura el telón en la hoja de estilo, más un margen para retirar el nodo.
  var TELON = 2050;
  var SALIDA = 340;

  var raiz = document.documentElement;
  var repetido = false;
  try {
    repetido = sessionStorage.getItem(CLAVE) === "1";
    sessionStorage.setItem(CLAVE, "1");
  } catch (error) { /* sin almacenamiento se enseña siempre: molesta menos que fallar */ }

  if (repetido) {
    raiz.className += " sin-splash";
    return;
  }

  var cerrado = false;
  function retira() {
    if (cerrado) return;
    cerrado = true;
    var telon = document.getElementById("splash");
    if (telon && telon.parentNode) telon.parentNode.removeChild(telon);
  }

  // Tocar la pantalla se lo salta: quien ya se lo sabe no tiene por qué esperar.
  function salta() {
    var telon = document.getElementById("splash");
    if (!telon) return retira();
    telon.className += " splash-sale";
    setTimeout(retira, SALIDA);
  }

  document.addEventListener("pointerdown", salta, { once: true });
  setTimeout(retira, TELON);
})();
