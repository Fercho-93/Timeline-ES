// El filtro de nombres: bloquea lo claramente ofensivo y los nombres que harían pasar a alguien por el
// juego o por quien lo gestiona, sin bloquear palabras normales que solo contienen una ofensiva dentro.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// Lo único de js/juego/modes.js que usa: escapar el nombre en el botón de denunciar.
const window = { CONTINUUM: { escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) } };
vm.runInNewContext(fs.readFileSync(new URL('../js/jugador/moderacion.js', import.meta.url), 'utf8'), { window });
const M = window.CONTINUUM.Moderacion;

const NO = [
  'Puta', 'putas', 'Hijo de puta', 'hijoputa', 'Cabrón', 'CABRON', 'c4br0n', 'Gilipollas', 'GILIPOLLAS99', 'mierda', 'Mi3rda',
  'puuuuta', 'p u t a m a d r e', 'Coño', 'polla', 'Chupapollas', 'Maricón', 'maricon', 'fuck', 'FUCK_YOU', 'sh1t', 'Bitch', 'cunt',
  'nigger', 'Hitler', 'Nazi', 'sieg heil', 'violador', 'pedofilo', 'puto_amo', 'xx-puta-xx', 'zorra', 'idiota'
];
for (const nombre of NO) assert.ok(M.problema(nombre), `debería bloquearse: «${nombre}»`);

const SI = [
  'Ana', 'Fernando', 'Pedro2024', 'María', 'Núñez', 'Nazario', 'Computadora', 'Disputa', 'Reputación', 'Scunthorpe', 'Dickens', 'Essex',
  'Analytics', 'Cocktail', 'Shiitake', 'Follaje', 'Mongolia', 'Pollastre', 'Culturista', 'Class', 'Assistant', 'Mariadmira',
  'Jugador 1234', 'Zorro', 'Pene Nuñez'.split(' ')[1], 'Hitchcock', 'Sexton', 'Pussycat', 'Javier_10', 'El Cid', 'Marta-Luz', 'Pola', 'Cono Sur'
];
for (const nombre of SI) assert.equal(M.problema(nombre), null, `no debería bloquearse: «${nombre}»`);

// Los que harían pasar a alguien por el juego o por quien lo gestiona.
for (const nombre of ['Continuum', 'continuum oficial', 'El Continuum', 'C0ntinuum', 'Admin', 'admin1', 'ADMIN_2024', 'Soporte', 'Moderador', 'Staff', 'Soporte Continuum', 'Oficial'])
  assert.match(M.problema(nombre) || '', /reservado/, `debería estar reservado: «${nombre}»`);
// Y se distinguen: uno es ofensivo, no «reservado».
assert.match(M.problema('puta'), /no está permitido/);

// El botón de denuncia lleva lo necesario, escapa el nombre y solo existe para contextos conocidos.
const boton = M.botonDenuncia('uid-1', '<b>"Ana"</b>', 'ranking');
assert.match(boton, /data-report-uid="uid-1"/);
assert.match(boton, /data-report-context="ranking"/);
assert.ok(!boton.includes('<b>'), 'el nombre se escapa');
assert.match(boton, /aria-label="Denunciar o bloquear a /);
assert.match(boton, />Denunciar o bloquear<\/button>/, 'el botón dice que se puede bloquear');
assert.equal(M.botonDenuncia('', 'x', 'ranking'), '', 'sin identificador no hay botón');
assert.equal(M.botonDenuncia('uid', 'x', 'chat'), '', 'solo los contextos que acepta el servidor');
assert.match(M.botonDenuncia('uid', 'x', 'mesa', true), /report-compact/);
assert.equal(M.botonDenuncia('uid', 'a'.repeat(40), 'sala').match(/data-report-alias="(a+)"/)[1].length, 24, 'el nombre se recorta como acepta el servidor');
console.log('Moderación de nombres: ofensivos y reservados bloqueados, nombres normales intactos, botón de denuncia: OK');
