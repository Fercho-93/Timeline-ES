(function () {
  'use strict';
  const filmSource = 'https://www.filmsite.org/oscars2.html';
  const pokerSource = 'https://www.pokerstars.com/poker/games/rules/hand-rankings/';
  const cards = (prefix, rows) => rows.map(([title, value, label, detail, source], i) => ({id: `${prefix}-${i + 1}`, title, value, label, detail, source}));
  window.CONTINUUM.QuickCatalog = {
    version: 1,
    upcoming: {key: 'counts', name: '¿Cuántos hay…?', status: 'planned', axis: 'count', cards: []},
    challenges: [
      {id: 'social', title: 'Redes sociales', rule: 'De más antigua a más reciente', context: 'Año del primer lanzamiento del servicio indicado, aunque su acceso inicial fuese limitado.', direction: 1, cover: 'history', cards: cards('social', [
        ['LinkedIn', 2003, '2003', 'El servicio se lanzó el 5 de mayo de 2003.', 'https://www.linkedin.com/blog/member/archive/happy-cinco-de'],
        ['Facebook', 2004, '2004', 'TheFacebook comenzó en Harvard el 4 de febrero de 2004.', 'https://about.fb.com/ltam/company.info/'],
        ['YouTube', 2005, '2005', 'La beta del servicio se lanzó en mayo de 2005.', 'https://blog.youtube/news-and-events/celebrating-10-years-of-youtube/'],
        ['Instagram', 2010, '2010', 'Instagram llegó al público en octubre de 2010.', 'https://techcrunch.com/2010/10/06/instagram-launch/'],
        ['Snapchat', 2011, '2011', 'Se lanzó con el nombre Snapchat en septiembre de 2011, tras el prototipo Picaboo.', 'https://newsroom.snap.com/lets-chat'],
        ['Threads', 2023, '2023', 'Meta presentó Threads en julio de 2023; su llegada a Europa fue posterior.', 'https://about.fb.com/news/2023/07/introducing-threads-new-app-text-sharing/']
      ])},
      {id: 'oscars', title: 'Películas por Óscar', rule: 'De más premios ganados a menos', context: 'Premios competitivos ganados por cada película; no nominaciones ni premios honoríficos. Los empates son válidos.', direction: -1, cover: 'entertainment', cards: cards('oscars', [
        ['Titanic (1997)', 11], ['West Side Story (1961)', 10], ['El paciente inglés (1996)', 9],
        ['Amadeus (1984)', 8], ['La lista de Schindler (1993)', 7], ['Forrest Gump (1994)', 6],
        ['Gladiator (2000)', 5], ['La forma del agua (2017)', 4], ['El padrino (1972)', 3], ['Joker (2019)', 2]
      ].map(([title, value]) => [title, value, `${value} Óscar`, `La película ganó ${value} premios competitivos de la Academia.`, filmSource]))},
      {id: 'drinks', title: 'Graduación de bebidas', rule: 'De menor a mayor graduación', context: 'Porcentaje de alcohol por volumen de estas versiones concretas, según las fichas enlazadas. No se comparan categorías genéricas de bebida.', direction: 1, cover: 'science', cards: cards('drinks', [
        ['Guinness Draught', 4.2, '4,2 % vol.', 'Graduación de Guinness Draught en la ficha del fabricante.', 'https://www.guinness.com/es-es/preguntas-frecuentes'],
        ['Heineken Original', 5, '5 % vol.', 'Versión original de la cerveza, según la ficha neerlandesa.', 'https://www.heineken.com/nl/nl/onze-producten/heineken-origineel'],
        ['Aperol', 11, '11 % vol.', 'Aperol sin mezclar, según la ficha española; no el cóctel Spritz.', 'https://www.aperol.com/es-es/faq/ingredientes-y-nutricion/'],
        ['Baileys Original Irish Cream', 17, '17 % vol.', 'Versión Original Irish Cream de la ficha estadounidense.', 'https://www.baileys.com/en-us/products/baileys-original-irish-cream'],
        ['Jägermeister Original', 35, '35 % vol.', 'Licor original, según la ficha alemana del fabricante.', 'https://de.jagermeister.com/hilfe-kontakt/wie-viel-prozent-alkoholgehalt-hat-jaegermeister'],
        ['Absolut Vodka Original', 40, '40 % vol.', 'Vodka Original sin aromatizar, según la ficha del fabricante.', 'https://www.absolut.com/en/products/absolut-vodka/']
      ])},
      {id: 'poker', title: 'Manos del póker', rule: 'De menor a mayor fuerza', context: 'Categorías de cinco cartas en póker alto, sin comodines. La escalera real está incluida en la escalera de color.', direction: 1, cover: 'entertainment', cards: cards('poker', [
        ['Carta alta', 'Sin pareja ni otra combinación superior.'], ['Pareja', 'Dos cartas del mismo valor.'],
        ['Doble pareja', 'Dos parejas de valores diferentes.'], ['Trío', 'Tres cartas del mismo valor.'],
        ['Escalera', 'Cinco valores consecutivos, sin que todas las cartas sean del mismo palo.'],
        ['Color', 'Cinco cartas del mismo palo, sin formar una escalera.'], ['Full', 'Un trío y una pareja.'],
        ['Póker', 'Cuatro cartas del mismo valor.'], ['Escalera de color', 'Cinco cartas consecutivas del mismo palo. La escalera real es la más alta de esta categoría.']
      ].map(([title, detail], i) => [title, i + 1, `${i + 1}.ª de 9 categorías`, detail, pokerSource]))}
    ]
  };
})();
