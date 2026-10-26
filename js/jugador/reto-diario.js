// La marca del reto diario: qué día es, cuál fue el anterior y cómo se apunta un resultado en la racha.
// La usan las dos formas de jugarlo (Grandes colecciones y Retos rápidos), para que cuenten igual.
//
// El reto cuenta en el día en que se EMPEZÓ, no en el que se termina: uno empezado a las 23:58 y
// acabado pasada la medianoche sigue siendo el reto de la fecha en que se empezó, y su racha se
// calcula contra ese día. Es solo lógica, sin pantalla ni almacenamiento: quien la llama lee y
// guarda el registro (`hilo-retos-v1.retoDiario`, que la cuenta sincroniza con la nube).
(function () {
  "use strict";
  const CT = window.CONTINUUM = window.CONTINUUM || {};
  // Cuántos días de historial se conservan: basta con los últimos para el calendario del Atlas.
  const DIAS_GUARDADOS = 60;

  // AAAA-MM-DD en la hora local del móvil (formato sv-SE).
  const clave = (fecha = new Date()) => fecha.toLocaleDateString("sv-SE");

  function anterior(dia) {
    const fecha = new Date(`${dia}T00:00:00`);
    fecha.setDate(fecha.getDate() - 1);
    return clave(fecha);
  }

  const vacio = () => ({ best: 0, streak: 0, lastDay: "", days: {} });

  // El lunes de la semana de `fecha`: las semanas del ranking van de lunes a domingo.
  function lunes(fecha = new Date()) {
    const dia = new Date(fecha);
    dia.setHours(12, 0, 0, 0);
    dia.setDate(dia.getDate() - (dia.getDay() + 6) % 7);
    return clave(dia);
  }

  // La racha sigue viva si el último reto fue hoy o ayer; si no, ya se cortó.
  const racha = (registro, hoy = clave()) => registro?.lastDay === hoy || registro?.lastDay === anterior(hoy) ? Number(registro.streak) || 0 : 0;

  // Días desde el 1 de enero de 1970 para una clave AAAA-MM-DD: cuenta seguido de un mes al
  // siguiente, así que su paridad alterna de verdad cada día.
  function numero(dia) {
    const [a, m, d] = dia.split("-").map(Number);
    return Math.floor(Date.UTC(a, m - 1, d) / 86400000);
  }
  // Qué familia toca cada día: un día Grandes colecciones y al siguiente Retos rápidos. Antes
  // salía de la paridad de AAAAMMDD, que del 31 al 1 repetía Retos rápidos dos días seguidos;
  // las dos reglas coinciden el día del cambio (26 de octubre de 2026), así que nadie ve
  // cambiar el reto que ya tenía.
  const familia = (dia = clave()) => numero(dia) % 2 === 0 ? "collections" : "quick";

  // Apunta el resultado de `dia` en `registro` (lo modifica y lo devuelve). Si ese día ya estaba
  // jugado no toca nada y devuelve null: el primer resultado del día es el que vale.
  // `resultado.hits` es lo que se anota como mejor marca; el resto se guarda tal cual en el día.
  function registrar(registro, dia, resultado) {
    registro.days = registro.days || {};
    if (registro.days[dia]) return null;
    registro.days[dia] = { ...resultado, finishedAt: new Date().toISOString() };
    registro.streak = registro.lastDay === anterior(dia) ? (registro.streak || 0) + 1 : 1;
    registro.lastDay = dia;
    const dias = Object.keys(registro.days).sort().slice(-DIAS_GUARDADOS);
    registro.days = Object.fromEntries(dias.map(d => [d, registro.days[d]]));
    registro.best = Math.max(registro.best || 0, resultado.hits || 0);
    return registro;
  }

  CT.RetoDiario = { clave, anterior, vacio, registrar, numero, familia, lunes, racha, DIAS_GUARDADOS };
})();
