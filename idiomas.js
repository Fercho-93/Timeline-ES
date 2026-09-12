// El valor son los hablantes de lengua materna (L1), no los hablantes totales: quien
// aprende un idioma de adulto no cuenta aquí. Por eso el inglés aparece por detrás del
// español, y no al revés como en las listas de «idiomas más hablados del mundo».
//
// El grueso del mazo sale de la recopilación de Wikipedia que cita Ethnologue 2022, en
// millones y con un decimal, que es el grano en que las publica la fuente: la carta enseña
// ese decimal y no finge una precisión mayor. Es una compilación secundaria y su corte es
// de 2022, no de hoy.
//
// Las ocho lenguas por debajo de los seis millones —del danés al feroés— no salen de esa
// lista, que se corta en los 24 millones, sino de cifras aproximadas aportadas aparte. Son
// las que dan cola a la línea, pero no comparten corte temporal con el resto: es una
// mezcla de fuentes asumida a conciencia y explicada en VERIFICACION_IDIOMAS.md.
//
// Del chino y del árabe se conservan solo las variedades principales —mandarín y cantonés;
// árabe egipcio—. Las demás que publica la fuente por separado (min nan, hakka, jin,
// xiang; árabe levantino, argelino, sudanés y marroquí) se descartaron por no ser
// situables para quien juega: ordenarlas era adivinar. No se suman entre sí para fabricar
// una carta de «chino» o de «árabe», porque la fuente no da ese dato.
//
// No se exige separación mínima entre cartas contiguas: se conserva la lista salvo las
// lenguas cuya cifra repetía la de otra ya incluida, porque dos cartas con el mismo número
// no se pueden ordenar. Se cayeron así el chino wu (81,7, como el coreano) y el canarés y
// el yoruba (43,6, como el indonesio). Ninguna cifra se ha retocado.
window.LANGUAGE_CARDS = [
  { id: 14001, value: 929000000, title: "Chino mandarín", detail: "La lengua materna de más gente en el mundo, y por mucho: oficial en China, en Taiwán y una de las cuatro de Singapur." },
  { id: 14002, value: 474700000, title: "Español", detail: "La segunda por lengua materna, oficial en una veintena de países y con la mayoría de sus hablantes en América." },
  { id: 14003, value: 372900000, title: "Inglés", detail: "Tercera por lengua materna, aunque es la primera del mundo con diferencia si se cuenta a quien la aprendió como segunda lengua." },
  { id: 14004, value: 343900000, title: "Hindi", detail: "Se escribe en devanagari y es, junto al inglés, la lengua oficial del gobierno de la India." },
  { id: 14005, value: 233700000, title: "Bengalí", detail: "Oficial en Bangladés y en varios estados de la India. Tiene más hablantes maternos que el ruso, y casi los mismos que el portugués." },
  { id: 14006, value: 232400000, title: "Portugués", detail: "Su tamaño lo explica Brasil: allí vive la gran mayoría de los hablantes, muy por encima de Portugal." },
  { id: 14007, value: 154000000, title: "Ruso", detail: "La lengua eslava con más hablantes maternos, y la que quedó como lengua común en buena parte de Asia central." },
  { id: 14008, value: 125300000, title: "Japonés", detail: "Casi todos sus hablantes viven en un solo país, algo poco habitual entre las lenguas de este tamaño." },
  { id: 14009, value: 92700000, title: "Lahnda", detail: "No es una lengua sino el conjunto de variedades panyabíes del oeste de Pakistán, el seraiki y el hindko entre ellas, que la fuente cuenta aparte del panyabí." },
  { id: 14010, value: 85200000, title: "Chino yue (cantonés)", detail: "El chino de Cantón, Hong Kong y Macao. Hablado no se entiende con el mandarín, aunque la escritura estándar es común." },
  { id: 14011, value: 84600000, title: "Vietnamita", detail: "La única lengua grande del sudeste asiático que se escribe con alfabeto latino, adaptado por misioneros europeos en el siglo XVII." },
  { id: 14012, value: 83100000, title: "Maratí", detail: "La lengua del estado indio de Maharashtra, cuya capital es Bombay." },
  { id: 14013, value: 82200000, title: "Turco", detail: "En 1928 cambió el alfabeto árabe por el latino en una reforma que se aplicó en cuestión de meses." },
  { id: 14014, value: 82000000, title: "Télugu", detail: "La lengua drávida con más hablantes, en los estados indios de Andhra Pradesh y Telangana." },
  { id: 14015, value: 81700000, title: "Coreano", detail: "Su alfabeto, el hangul, se diseñó por encargo en el siglo XV para que fuera fácil de aprender y sustituyera a los caracteres chinos." },
  { id: 14016, value: 79900000, title: "Francés", detail: "Oficial en una treintena de países repartidos por cinco continentes; hoy su crecimiento viene sobre todo de África." },
  { id: 14017, value: 75600000, title: "Alemán", detail: "La lengua materna más extendida de la Unión Europea." },
  { id: 14018, value: 75000000, title: "Tamil", detail: "Una de las lenguas vivas con literatura más antigua conservada. Es oficial en la India, en Sri Lanka y en Singapur." },
  { id: 14019, value: 70200000, title: "Urdu", detail: "Comparte gramática y buena parte del vocabulario con el hindi, pero se escribe en alfabeto árabe." },
  { id: 14020, value: 68300000, title: "Javanés", detail: "La lengua de la isla de Java. Tiene más hablantes maternos que el indonesio, que es la oficial del país." },
  { id: 14021, value: 64800000, title: "Italiano", detail: "La lengua nacional se construyó sobre el toscano literario; cuando se unificó el país, casi nadie la tenía como lengua materna." },
  { id: 14022, value: 64600000, title: "Árabe egipcio", detail: "La variedad de árabe con más hablantes maternos. El cine y la televisión de El Cairo la convirtieron en la más comprendida del mundo árabe." },
  { id: 14023, value: 57000000, title: "Guyaratí", detail: "La lengua del estado indio de Guyarat, y la materna de Gandhi." },
  { id: 14024, value: 56400000, title: "Persa", detail: "Oficial en Irán. Sus variedades de Afganistán y Tayikistán reciben los nombres de darí y tayiko." },
  { id: 14025, value: 52200000, title: "Bhojpuri", detail: "Se habla en el noreste de la India y en Nepal; la emigración del siglo XIX la llevó hasta Mauricio, Fiyi y Surinam." },
  { id: 14026, value: 43900000, title: "Hausa", detail: "Lengua del norte de Nigeria y del sur de Níger, y la lengua del comercio en buena parte del Sahel." },
  { id: 14027, value: 43600000, title: "Indonesio", detail: "Una variedad estandarizada del malayo, adoptada como lengua nacional por un país con centenares de lenguas propias." },
  { id: 14028, value: 40000000, title: "Polaco", detail: "La lengua eslava occidental con más hablantes, y casi todos en un solo país." },
  { id: 14029, value: 37100000, title: "Malayálam", detail: "La lengua del estado indio de Kerala. Escrito en alfabeto latino, su nombre se lee igual del derecho y del revés." },
  { id: 14030, value: 34500000, title: "Oriya", detail: "La lengua de Odisha, en la costa oriental de la India." },
  { id: 14031, value: 33900000, title: "Maithili", detail: "Se habla a los dos lados de la frontera, en el norte de la India y en el sur de Nepal." },
  { id: 14032, value: 33000000, title: "Birmano", detail: "Oficial de Birmania. Se escribe con un alfabeto de letras redondeadas heredado de las escrituras del sur de la India." },
  { id: 14033, value: 32600000, title: "Panyabí", detail: "El panyabí oriental, el de la India, que se escribe en alfabeto gurmují. Las variedades del oeste de Pakistán van aparte, en la carta del lahnda." },
  { id: 14034, value: 32400000, title: "Sondanés", detail: "La segunda lengua de la isla de Java, hablada en su extremo occidental." },
  { id: 14035, value: 27300000, title: "Ucraniano", detail: "Lengua eslava oriental, hermana del ruso y del bielorruso, con alfabeto cirílico propio." },
  { id: 14036, value: 27000000, title: "Igbo", detail: "Una de las tres grandes lenguas de Nigeria, hablada en el sureste del país." },
  { id: 14037, value: 25100000, title: "Uzbeko", detail: "La lengua túrquica con más hablantes después del turco." },
  { id: 14038, value: 24600000, title: "Sindhi", detail: "Se habla en la provincia pakistaní de Sind y, tras la partición de 1947, también en la India." },
  { id: 14039, value: 24300000, title: "Rumano", detail: "La lengua románica del este de Europa, aislada entre lenguas eslavas y húngara. También es la oficial de Moldavia." },
  { id: 14040, value: 5500000, title: "Danés", detail: "Un danés lee el noruego y el sueco con relativa soltura; entenderlos hablados, y que le entiendan, ya cuesta bastante más." },
  { id: 14041, value: 5400000, title: "Finés", detail: "No es una lengua indoeuropea: pertenece a la familia urálica, como el estonio y, de mucho más lejos, el húngaro." },
  { id: 14042, value: 5200000, title: "Eslovaco", detail: "Tan cercano al checo que quien habla uno entiende al otro sin haberlo estudiado nunca." },
  { id: 14043, value: 3000000, title: "Lituano", detail: "Conserva más rasgos del indoeuropeo antiguo que ninguna otra lengua viva de Europa, lo que la hace muy valiosa para los lingüistas." },
  { id: 14044, value: 2400000, title: "Gallego", detail: "Cooficial en Galicia. Comparte origen con el portugués: los dos vienen del galaicoportugués medieval." },
  { id: 14045, value: 570000, title: "Maltés", detail: "La única lengua semítica oficial de la Unión Europea, y la única que se escribe habitualmente en alfabeto latino." },
  { id: 14046, value: 390000, title: "Islandés", detail: "Ha cambiado tan poco en mil años que un islandés de hoy puede leer las sagas medievales sin traducción." },
  { id: 14047, value: 69000, title: "Feroés", detail: "La lengua de las islas Feroe, en mitad del Atlántico norte. Es la carta con menos hablantes del mazo." }
];
