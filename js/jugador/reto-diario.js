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

  CT.RetoDiario = { clave, anterior, vacio, registrar, DIAS_GUARDADOS };
})();
