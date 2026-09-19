// Hitos de la música. El año corresponde a un estreno, publicación, lanzamiento o
// cambio de formato concreto. El recorrido mezcla música clásica, popular y tecnología
// musical: la pregunta es cuándo ocurrió el hito, no qué género es "más importante".
window.MUSIC_CARDS = [
  { id: 6001, year: 1607, title: "Estreno de L'Orfeo", detail: "La ópera de Claudio Monteverdi se estrena en Mantua y se convierte en una de las primeras obras maestras del género." },
  { id: 6002, year: 1721, title: "Conciertos de Brandeburgo", detail: "Johann Sebastian Bach dedica a Christian Ludwig de Brandeburgo los seis conciertos que resumen el esplendor instrumental barroco." },
  { id: 6003, year: 1741, title: "Publicación de las Variaciones Goldberg", detail: "Bach publica un aria con treinta variaciones que se convertirá en una cima de la música para teclado." },
  { id: 6004, year: 1787, title: "Estreno de Don Giovanni", detail: "Mozart estrena en Praga su ópera sobre el mito de don Juan, a medio camino entre la comedia y el drama." },
  { id: 6005, year: 1805, title: "Estreno público de la Heroica", detail: "La Tercera sinfonía de Beethoven se presenta en Viena y ensancha la escala y la ambición de la sinfonía." },
  { id: 6006, year: 1824, title: "Estreno de la Novena de Beethoven", detail: "La Novena se estrena en Viena con Beethoven presente en el escenario y Michael Umlauf al frente de la ejecución. La obra incorpora voces en la Oda a la alegría." },
  { id: 6007, year: 1830, title: "Estreno de la Sinfonía fantástica", detail: "Hector Berlioz convierte una obsesión amorosa en un relato sinfónico de cinco movimientos." },
  { id: 6008, year: 1865, title: "Estreno de Tristán e Isolda", detail: "La ópera de Wagner se estrena en Múnich y lleva la tensión armónica del romanticismo hasta un nuevo límite." },
  { id: 6009, year: 1877, title: "Edison presenta el fonógrafo", detail: "La reproducción del sonido deja de ser una idea: una grabación puede conservarse y volver a escucharse." },
  { id: 6010, year: 1888, title: "Se graba «Israel en Egipto» en el Crystal Palace", detail: "Un cilindro conserva un fragmento del oratorio de Händel interpretado en Londres. Es una grabación histórica temprana, pero existen registros musicales anteriores." },
  { id: 6011, year: 1893, title: "Estreno de la Sinfonía del Nuevo Mundo", detail: "Antonín Dvořák estrena en Nueva York su Novena sinfonía, inspirada por su estancia en Estados Unidos." },
  { id: 6012, year: 1902, title: "Caruso graba en Milán", detail: "Diez arias registradas por Enrico Caruso ayudan a demostrar que el disco puede llevar una gran voz a un público masivo." },
  { id: 6013, year: 1913, title: "El escándalo de La consagración de la primavera", detail: "El ballet de Stravinski se estrena en París entre protestas y cambia para siempre el ritmo orquestal del siglo XX." },
  { id: 6014, year: 1920, title: "Comienza la radio comercial", detail: "La emisora KDKA inicia emisiones regulares en Pittsburgh; la música puede entrar en millones de hogares sin soporte físico." },
  { id: 6015, year: 1925, title: "Llega la grabación eléctrica", detail: "Micrófonos y amplificación sustituyen al gran embudo acústico y permiten registrar más matices y frecuencias." },
  { id: 6016, year: 1932, title: "La primera guitarra eléctrica comercial", detail: "La Rickenbacker Frying Pan demuestra que una pastilla electromagnética puede convertir la guitarra en protagonista." },
  { id: 6017, year: 1935, title: "Presentación del Magnetophon", detail: "AEG muestra en Berlín una grabadora de cinta magnética que hará posible editar y copiar sonido con mucha más facilidad." },
  { id: 6018, year: 1948, title: "Nace el disco de larga duración", detail: "Columbia presenta el LP de 33⅓ rpm, capaz de guardar una obra extensa o un álbum completo por disco." },
  { id: 6019, year: 1954, title: "Rock Around the Clock", detail: "Bill Haley and His Comets graban el tema que, impulsado después por el cine, lleva el rock and roll al gran público." },
  { id: 6020, year: 1956, title: "Primer álbum de Elvis Presley", detail: "El debut de Elvis llega al número uno y su portada se convierte en una de las imágenes fundacionales del rock." },
  { id: 6021, year: 1959, title: "Kind of Blue", detail: "Miles Davis publica el álbum de jazz modal más célebre y uno de los discos más vendidos de la historia del género." },
  { id: 6022, year: 1962, title: "Love Me Do", detail: "The Beatles lanzan su primer sencillo y comienza una carrera que transformará la cultura popular mundial." },
  { id: 6023, year: 1965, title: "Like a Rolling Stone", detail: "Bob Dylan rompe la duración habitual del sencillo y lleva una escritura más literaria al centro del pop." },
  { id: 6024, year: 1967, title: "Sgt. Pepper's Lonely Hearts Club Band", detail: "The Beatles convierten el estudio de grabación en instrumento y el álbum en una obra pensada como conjunto." },
  { id: 6025, year: 1969, title: "Festival de Woodstock", detail: "Más de treinta actuaciones y una multitud gigantesca fijan el gran símbolo musical de la contracultura." },
  { id: 6026, year: 1971, title: "What's Going On", detail: "Marvin Gaye publica un álbum conceptual que une soul, conciencia social y una producción de enorme influencia." },
  { id: 6027, year: 1973, title: "The Dark Side of the Moon", detail: "Pink Floyd combina rock, síntesis electrónica y sonido de estudio en uno de los álbumes más duraderos de las listas." },
  { id: 6028, year: 1975, title: "Bohemian Rhapsody", detail: "Queen publica un sencillo de seis minutos, sin estribillo convencional y con una sección operística grabada por capas." },
  { id: 6029, year: 1977, title: "Rumours", detail: "Fleetwood Mac transforma las tensiones internas del grupo en uno de los discos más vendidos de todos los tiempos." },
  { id: 6030, year: 1979, title: "Rapper's Delight", detail: "The Sugarhill Gang lleva el hip-hop a las listas internacionales con uno de los primeros grandes éxitos comerciales del rap." },
  { id: 6031, year: 1981, title: "MTV empieza a emitir", detail: "El canal inaugura una era en la que el videoclip y la imagen del artista pasan a ser inseparables de la canción." },
  { id: 6032, year: 1982, title: "Thriller", detail: "Michael Jackson publica el álbum más vendido de la historia y convierte sus videoclips en acontecimientos globales." },
  { id: 6033, year: 1984, title: "Purple Rain", detail: "Prince une álbum, película y gira en una obra que mezcla rock, pop, funk y una puesta en escena inolvidable." },
  { id: 6034, year: 1986, title: "Graceland", detail: "Paul Simon graba con músicos sudafricanos un álbum popular y polémico que amplía el mercado internacional de la llamada world music." },
  { id: 6035, year: 1987, title: "The Joshua Tree", detail: "U2 alcanza dimensión mundial con un disco inspirado por los paisajes, la música y las contradicciones de Estados Unidos." },
  { id: 6036, year: 1989, title: "Like a Prayer", detail: "Madonna publica un álbum más personal y provoca un debate mundial al mezclar imaginería religiosa y cultura pop." },
  { id: 6037, year: 1991, title: "Nevermind", detail: "Nirvana lleva el grunge de Seattle al número uno y altera el sonido dominante del rock de los noventa." },
  { id: 6038, year: 1992, title: "Automatic for the People", detail: "R.E.M. publica su disco más contemplativo y confirma que el rock alternativo puede ocupar el centro del mercado." },
  { id: 6039, year: 1994, title: "Definitely Maybe", detail: "El debut de Oasis se convierte en emblema del britpop y en el álbum de debut más rápidamente vendido del Reino Unido hasta entonces." },
  { id: 6040, year: 1997, title: "OK Computer", detail: "Radiohead combina guitarras y experimentación electrónica en un retrato inquietante de la vida tecnológica moderna." },
  { id: 6041, year: 1999, title: "Napster abre el intercambio musical", detail: "El servicio entre usuarios populariza el MP3 y desata una crisis sobre cómo distribuir y pagar la música en internet." },
  { id: 6042, year: 2001, title: "Apple presenta el iPod", detail: "Un reproductor de bolsillo y su biblioteca digital hacen cotidiana la idea de llevar miles de canciones encima." },
  { id: 6043, year: 2003, title: "Abre iTunes Store", detail: "La venta legal de canciones sueltas por internet ofrece una alternativa masiva a la descarga no autorizada." },
  { id: 6044, year: 2005, title: "YouTube lleva el videoclip a la red", detail: "La nueva plataforma permite compartir vídeos musicales sin depender de la programación de un canal de televisión." },
  { id: 6045, year: 2007, title: "In Rainbows y el precio elegido", detail: "Radiohead distribuye el álbum desde su web dejando que cada comprador decida cuánto pagar por la descarga." },
  { id: 6046, year: 2008, title: "Spotify inicia su servicio", detail: "La plataforma se lanza en varios países europeos y acelera el paso de poseer discos a escuchar un catálogo bajo demanda." },
  { id: 6047, year: 2011, title: "21 de Adele", detail: "El segundo álbum de Adele domina ventas y premios en plena transición de la industria hacia el streaming." },
  { id: 6048, year: 2012, title: "Gangnam Style supera mil millones", detail: "El vídeo de PSY se convierte en el primero de YouTube en alcanzar mil millones de reproducciones." },
  { id: 6049, year: 2017, title: "Despacito se convierte en fenómeno mundial", detail: "Luis Fonsi y Daddy Yankee llevan una canción en español al número uno de decenas de países y a cifras récord en internet." },
  { id: 6050, year: 2020, title: "Un álbum íntegramente en español lidera Billboard", detail: "El último tour del mundo de Bad Bunny es el primer álbum completamente en español que alcanza el número uno del Billboard 200." },
  { id: 6051, year: 2023, title: "The Eras Tour", detail: "Taylor Swift inicia una gira que recorre todas sus etapas discográficas y se convierte en un fenómeno cultural y económico global." }
  ,{ id: 6052, year: 1954, title: "That’s All Right", detail: "Elvis Presley publica su primera grabación para Sun Records; la mezcla de blues, country y energía vocal se convierte en una pieza fundacional del rock and roll." }
  ,{ id: 6053, year: 1963, title: "I Want to Hold Your Hand", detail: "The Beatles publican el sencillo que abre su conquista del mercado estadounidense y anuncia la Beatlemanía a escala mundial." }
  ,{ id: 6054, year: 1967, title: "Respect", detail: "Aretha Franklin transforma la canción de Otis Redding en un himno de afirmación femenina y de la cultura afroamericana." }
  ,{ id: 6055, year: 1970, title: "Your Song", detail: "Elton John y Bernie Taupin firman una balada que se convierte en una de las canciones más reconocibles del repertorio del pianista británico." }
  ,{ id: 6056, year: 1970, title: "(They Long to Be) Close to You", detail: "The Carpenters llevan esta composición de Burt Bacharach y Hal David a lo más alto de las listas y definen su sonido pop melódico." }
  ,{ id: 6057, year: 1971, title: "Imagine", detail: "John Lennon publica una canción de tono pacifista cuya melodía y mensaje se convierten en un símbolo internacional." }
  ,{ id: 6058, year: 1971, title: "Jealous Guy", detail: "John Lennon publica esta confesión íntima, originalmente escrita durante las sesiones de The Beatles para el proyecto The White Album." }
  ,{ id: 6059, year: 1972, title: "Libre", detail: "Nino Bravo graba una de sus canciones más emblemáticas, convertida después en un clásico de la canción melódica en español." }
  ,{ id: 6060, year: 1976, title: "Dancing Queen", detail: "ABBA publica el sencillo que resume su pop bailable y alcanza un éxito internacional duradero." }
  ,{ id: 6061, year: 1977, title: "Heroes", detail: "David Bowie publica una canción épica sobre una pareja separada por el Muro de Berlín, grabada en los Hansa Studios de la ciudad." }
  ,{ id: 6062, year: 1978, title: "Me olvidé de vivir", detail: "Julio Iglesias populariza esta canción de tono confesional y consolida su proyección internacional en el mercado hispano." }
  ,{ id: 6063, year: 1979, title: "Highway to Hell", detail: "AC/DC publica uno de sus grandes himnos de hard rock y el último álbum de estudio de la banda con Bon Scott como vocalista." }
  ,{ id: 6064, year: 1979, title: "Another Brick in the Wall (Part 2)", detail: "Pink Floyd convierte este fragmento de The Wall en un éxito mundial con un coro infantil y una crítica a la educación autoritaria." }
  ,{ id: 6065, year: 1981, title: "Como una ola", detail: "Rocío Jurado interpreta una de las canciones más populares de su repertorio, convertida en referencia de la canción española." }
  ,{ id: 6066, year: 1982, title: "Billie Jean", detail: "Michael Jackson publica el sencillo cuyo bajo, producción y coreografía asociada se convierten en hitos del pop de los años ochenta." }
  ,{ id: 6067, year: 1983, title: "Every Breath You Take", detail: "The Police publican una canción de apariencia romántica y letra inquietante que se convierte en su mayor éxito internacional." }
  ,{ id: 6068, year: 1983, title: "Let’s Dance", detail: "David Bowie entra en una nueva etapa pop con una producción de Nile Rodgers y una canción que alcanza un enorme éxito comercial." }
  ,{ id: 6069, year: 1984, title: "Dancing in the Dark", detail: "Bruce Springsteen publica el sencillo que abre Born in the U.S.A. y amplía su presencia en la radio y en MTV." }
  ,{ id: 6070, year: 1984, title: "Hallelujah", detail: "Leonard Cohen publica esta composición de estructura bíblica y tono íntimo, que con el tiempo se convertirá en un estándar reinterpretado por numerosos artistas." }
  ,{ id: 6071, year: 1984, title: "What’s Love Got to Do with It", detail: "Tina Turner regresa a lo más alto de las listas con una canción que relanza su carrera en solitario." }
  ,{ id: 6072, year: 1985, title: "Take on Me", detail: "A-ha combina sintetizadores, una melodía expansiva y un videoclip de animación rotoscópica para lograr un éxito global." }
  ,{ id: 6073, year: 1986, title: "A quién le importa", detail: "Alaska y Dinarama publican un himno de libertad individual que se convierte en una canción esencial de la cultura pop española." }
  ,{ id: 6074, year: 1990, title: "Rayando el sol", detail: "Maná publica una de sus canciones más conocidas y fija el sonido de la banda mexicana en el pop rock latino." }
  ,{ id: 6075, year: 1990, title: "Enjoy the Silence", detail: "Depeche Mode transforma una balada inicialmente sencilla en un clásico de la música electrónica y el pop alternativo." }
  ,{ id: 6076, year: 1991, title: "Losing My Religion", detail: "R.E.M. combina mandolina, melodía folk y una letra ambigua en el sencillo que los convierte en estrellas internacionales." }
  ,{ id: 6077, year: 1991, title: "Enter Sandman", detail: "Metallica abre el Black Album con un riff inmediato y una producción que lleva el heavy metal a un público masivo." }
  ,{ id: 6078, year: 1991, title: "20 de abril", detail: "Celtas Cortos publican una carta musical de tono nostálgico que se convierte en una de las canciones más recordadas del pop rock español." }
  ,{ id: 6079, year: 1991, title: "Smells Like Teen Spirit", detail: "Nirvana publica el sencillo que lleva el grunge de Seattle al centro de la cultura popular y del rock de los noventa." }
  ,{ id: 6080, year: 1992, title: "I Will Always Love You", detail: "Whitney Houston interpreta la canción de Dolly Parton para la película The Bodyguard y la convierte en un éxito mundial." }
  ,{ id: 6081, year: 1994, title: "Basket Case", detail: "Green Day lleva el punk melódico a las radios internacionales con una canción sobre la ansiedad y la vida cotidiana." }
  ,{ id: 6082, year: 1998, title: "…Baby One More Time", detail: "Britney Spears debuta con un sencillo pop que se convierte en uno de los grandes éxitos juveniles de finales de los noventa." }
  ,{ id: 6083, year: 1999, title: "La raja de tu falda", detail: "Estopa irrumpe con una mezcla de rumba, rock y lenguaje cotidiano que se convierte en uno de los grandes éxitos españoles de la década." }
  ,{ id: 6084, year: 2000, title: "Yellow", detail: "Coldplay publica una canción de guitarras envolventes que presenta a la banda ante el gran público internacional." }
  ,{ id: 6085, year: 2000, title: "In the End", detail: "Linkin Park combina rock, rap y electrónica en una canción que define el nu metal de comienzos del siglo XXI." }
  ,{ id: 6086, year: 2002, title: "Sin ti no soy nada", detail: "Amaral publica una canción de pop rock melódico que se convierte en una de las piezas más reconocibles del dúo zaragozano." }
  ,{ id: 6087, year: 2002, title: "Lose Yourself", detail: "Eminem publica para la película 8 Mile una canción de rap sobre la presión y la oportunidad que gana el Óscar a mejor canción original." }
  ,{ id: 6088, year: 2003, title: "Crazy in Love", detail: "Beyoncé inicia su carrera solista con una producción de pop y R&B impulsada por un sample de soul y la colaboración de Jay-Z." }
  ,{ id: 6089, year: 2008, title: "I Kissed a Girl", detail: "Katy Perry alcanza el número uno con un sencillo provocador que la sitúa en el centro del pop internacional." }
  ,{ id: 6090, year: 2010, title: "Baby", detail: "Justin Bieber consolida su salto al estrellato adolescente con una canción pop producida junto a Ludacris." }
  ,{ id: 6091, year: 2010, title: "Firework", detail: "Katy Perry publica un himno pop de afirmación personal que alcanza un éxito mundial sostenido." }
  ,{ id: 6092, year: 2011, title: "The A Team", detail: "Ed Sheeran presenta una canción acústica de narración social que se convierte en su primer gran éxito internacional." }
  ,{ id: 6093, year: 2012, title: "Payphone", detail: "Maroon 5 mezcla pop, soul y hip-hop en un sencillo de gran difusión internacional junto a Wiz Khalifa." }
  ,{ id: 6094, year: 2012, title: "Let Her Go", detail: "Passenger convierte una canción acústica y melancólica en un éxito mundial impulsado por la radio y las plataformas digitales." }
  ,{ id: 6095, year: 2013, title: "Riptide", detail: "Vance Joy combina ukelele, folk y una melodía luminosa en una canción que se transforma en éxito internacional." }
  ,{ id: 6096, year: 2016, title: "Say You Won’t Let Go", detail: "James Arthur regresa a las listas con una balada de amor que se convierte en su mayor éxito comercial." }
  ,{ id: 6097, year: 2017, title: "Havana", detail: "Camila Cabello mezcla pop, ritmos latinos y una referencia a su ciudad natal en el sencillo que impulsa su carrera solista." }
  ,{ id: 6098, year: 2020, title: "Levitating", detail: "Dua Lipa lleva el pop disco de Future Nostalgia a las listas internacionales y convierte la canción en uno de sus mayores éxitos." }
  ,{ id: 6099, year: 2022, title: "As It Was", detail: "Harry Styles publica una canción de synth pop melancólico que domina las listas internacionales y abre su tercer álbum en solitario." }
];
