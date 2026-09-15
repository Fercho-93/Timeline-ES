// Las reglas de las cuentas y del ranking, contra el emulador oficial.
//
// Las reglas no pueden saber si un resultado es cierto —las fechas de las cartas viven
// en el móvil— y no lo intentan. Lo que sí tienen que garantizar es todo lo demás, que
// es lo que se comprueba aquí: que nadie escribe en nombre de otro, que un reto se
// envía una vez y no se puede corregir después, que dos personas no pueden llamarse
// igual y que los campos del veredicto —`verificada`, `puntos`— no los puede poner un
// cliente por su cuenta.
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-ranking',
  firestore: { host: '127.0.0.1', port: 8080, rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') }
});

const db = uid => env.authenticatedContext(uid).firestore();
const sinSesion = () => env.unauthenticatedContext().firestore();

// Reservar un nombre y crear la ficha pública son una sola escritura: las reglas exigen
// que al terminar la reserva esté a nombre de quien escribe la ficha.
function registra(uid, nick) {
  const base = db(uid);
  const lote = writeBatch(base);
  lote.set(doc(base, 'nicks', nick.toLowerCase()), { uid });
  lote.set(doc(base, 'users', uid), { nick, nickLower: nick.toLowerCase(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return lote.commit();
}

const DIA = '2026-09-15';
const reto = (uid, nick, extra = {}) => ({
  uid, nick, dia: DIA, mazo: 'history', semana: '2026-W38',
  aciertos: 12, total: 15, jugadas: [0, 1, 2], cartas: [10, 11, 12],
  ms: 45000, huella: 'abc', creadaEn: serverTimestamp(), ...extra
});
const entradaDe = (uid, dia = DIA) => `${dia}__history__${uid}`;

try {
  // --- Nombres -------------------------------------------------------------
  await assertSucceeds(registra('ana', 'Ana'));
  // Bea no puede quedarse el nombre de Ana: la reserva ya existe y `create` no se
  // concede sobre un documento que está.
  await assertFails(registra('bea', 'Ana'));
  await assertSucceeds(registra('bea', 'Bea'));
  // Ni apropiarse de la reserva ajena por su cuenta, ni borrarla.
  await assertFails(setDoc(doc(db('bea'), 'nicks', 'ana'), { uid: 'bea' }));
  await assertFails(deleteDoc(doc(db('bea'), 'nicks', 'ana')));
  await assertSucceeds(deleteDoc(doc(db('bea'), 'nicks', 'bea')));
  await assertSucceeds(registra('bea', 'Bea'));
  // La ficha de otra persona no se toca, aunque su nombre sea público.
  await assertFails(setDoc(doc(db('bea'), 'users', 'ana'), { nick: 'Ana', nickLower: 'ana', updatedAt: serverTimestamp() }, { merge: true }));
  await assertSucceeds(getDoc(doc(db('bea'), 'users', 'ana')));
  await assertFails(getDoc(doc(sinSesion(), 'users', 'ana')));
  // Un nombre sin reserva detrás no vale: es lo que impide saltarse la unicidad
  // escribiendo solo la ficha.
  await assertFails(setDoc(doc(db('ana'), 'users', 'ana'), { nick: 'Otra', nickLower: 'otra', updatedAt: serverTimestamp() }, { merge: true }));

  // --- El perfil privado ---------------------------------------------------
  await assertSucceeds(setDoc(doc(db('ana'), 'users', 'ana', 'datos', 'perfil'), { json: '{}', guardadoEn: serverTimestamp() }));
  await assertFails(getDoc(doc(db('bea'), 'users', 'ana', 'datos', 'perfil')));
  await assertFails(setDoc(doc(db('bea'), 'users', 'ana', 'datos', 'perfil'), { json: '{}' }));

  // --- El envío del reto ---------------------------------------------------
  await assertSucceeds(setDoc(doc(db('ana'), 'retosDiarios', entradaDe('ana')), reto('ana', 'Ana')));
  // Un intento al día: ni reescribirlo mejorándolo ni borrarlo para volver a enviarlo.
  await assertFails(setDoc(doc(db('ana'), 'retosDiarios', entradaDe('ana')), reto('ana', 'Ana', { aciertos: 15 })));
  await assertFails(updateDoc(doc(db('ana'), 'retosDiarios', entradaDe('ana')), { aciertos: 15 }));
  await assertFails(deleteDoc(doc(db('ana'), 'retosDiarios', entradaDe('ana'))));

  // El identificador tiene que acabar en el uid de quien escribe: es lo que impide
  // mandar el resultado de otra persona o esconder el propio en otro documento.
  await assertFails(setDoc(doc(db('bea'), 'retosDiarios', entradaDe('ana', '2026-09-16')), reto('ana', 'Ana', { dia: '2026-09-16' })));
  await assertFails(setDoc(doc(db('bea'), 'retosDiarios', 'otro-sitio'), reto('bea', 'Bea')));
  await assertFails(setDoc(doc(db('bea'), 'retosDiarios', entradaDe('bea')), reto('ana', 'Ana')));

  // El veredicto solo lo escribe la función, que va con credenciales de administrador.
  await assertFails(setDoc(doc(db('bea'), 'retosDiarios', entradaDe('bea')), reto('bea', 'Bea', { verificada: true, puntos: 15 })));
  await assertFails(setDoc(doc(db('bea'), 'retosDiarios', entradaDe('bea')), reto('bea', 'Bea', { puntos: 99 })));

  // Y la forma tiene que ser la que la función espera.
  await assertFails(setDoc(doc(db('bea'), 'retosDiarios', entradaDe('bea')), reto('bea', 'Bea', { aciertos: 16 })));
  await assertFails(setDoc(doc(db('bea'), 'retosDiarios', entradaDe('bea')), reto('bea', 'Bea', { aciertos: '12' })));
  await assertFails(setDoc(doc(db('bea'), 'retosDiarios', entradaDe('bea')), reto('bea', 'Bea', { cartas: [10, 11] })));
  await assertFails(setDoc(doc(db('bea'), 'retosDiarios', entradaDe('bea')), reto('bea', 'Bea', { ms: -1 })));
  await assertFails(setDoc(doc(db('bea'), 'retosDiarios', entradaDe('bea')), reto('bea', 'Bea', { nick: 'no' })));
  await assertFails(setDoc(doc(db('bea'), 'retosDiarios', entradaDe('bea')), reto('bea', 'Bea', { creadaEn: new Date(0) })));
  await assertFails(setDoc(doc(sinSesion(), 'retosDiarios', entradaDe('bea')), reto('bea', 'Bea')));
  await assertSucceeds(setDoc(doc(db('bea'), 'retosDiarios', entradaDe('bea')), reto('bea', 'Bea')));

  // La tabla se lee con sesión abierta y no de otro modo: es lo que hace posible
  // enseñarla, y lo que impide que se baje entera desde fuera de la aplicación.
  await assertSucceeds(getDocs(query(collection(db('bea'), 'retosDiarios'), where('dia', '==', DIA))));
  await assertFails(getDocs(query(collection(sinSesion(), 'retosDiarios'), where('dia', '==', DIA))));

  // --- El acumulado semanal ------------------------------------------------
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'retosSemanales', '2026-W38__ana'), { uid: 'ana', nick: 'Ana', semana: '2026-W38', puntos: 12, dias: 1 });
  });
  await assertSucceeds(getDoc(doc(db('bea'), 'retosSemanales', '2026-W38__ana')));
  await assertFails(setDoc(doc(db('ana'), 'retosSemanales', '2026-W38__ana'), { uid: 'ana', nick: 'Ana', semana: '2026-W38', puntos: 999, dias: 1 }));
  await assertFails(updateDoc(doc(db('ana'), 'retosSemanales', '2026-W38__ana'), { puntos: 999 }));

  console.log('Cuentas, nombres únicos, un reto al día y veredicto solo del servidor: OK');
} finally {
  await env.cleanup();
}
