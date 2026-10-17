// Borrado de cuenta en el servidor (functions/account-purge.js), con una base de datos en memoria:
// se llevan todo lo de la cuenta —incluidas las filas de ranking de cada día y semana y las
// subcolecciones— y no tocan nada de las demás.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { purgeAccountData, deleteAccount, findUid, ACCOUNT_DOCS } = require('../functions/account-purge.js');

function fakeDb(initial) {
  const store = new Map(Object.entries(initial));
  const ref = path => ({
    path, id: path.split('/').at(-1),
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
    delete: async () => { store.delete(path); },
    collection: name => collectionRef(`${path}/${name}`),
  });
  const collectionRef = path => ({
    doc: id => ref(`${path}/${id}`),
    listDocuments: async () => {
      const ids = new Set();
      for (const key of store.keys()) if (key.startsWith(`${path}/`)) ids.add(key.slice(path.length + 1).split('/')[0]);
      return [...ids].map(id => ref(`${path}/${id}`));
    },
  });
  return {
    store,
    doc: ref,
    collection: collectionRef,
    recursiveDelete: async target => { for (const key of [...store.keys()]) if (key === target.path || key.startsWith(`${target.path}/`)) store.delete(key); },
  };
}
const seed = uid => Object.fromEntries([
  [`playerProfiles/${uid}`, { aliasKey: `alias-${uid}` }], [`playerProfiles/${uid}/pushTokens/t1`, { token: 'x' }],
  [`playerNames/alias-${uid}`, { uid }], [`playerProgress/${uid}`, {}], [`socialRanking/${uid}`, {}], [`dailyRanking/${uid}`, {}],
  [`discoveryScores/${uid}`, {}], [`duelPreferences/${uid}`, {}], [`duelPreferences/${uid}/blocked/rival`, {}], [`creationQuota/${uid}`, {}],
  [`roomCreation/${uid}`, {}], [`duelReminderBudgets/${uid}`, {}],
  [`dailyScores/2026-10-10/players/${uid}`, { score: 1 }], [`dailyScores/2026-10-11/players/${uid}`, { score: 2 }], [`weeklyScores/2026-10-05/players/${uid}`, { score: 3 }],
]);

const db = fakeDb({ ...seed('ana'), ...seed('luis') });
const before = db.store.size;
await purgeAccountData(db, 'ana');
assert.equal([...db.store.keys()].filter(key => key.includes('ana')).length, 0, 'no queda nada de la cuenta borrada');
assert.equal(db.store.size, before / 2, 'la otra cuenta queda intacta');
assert.ok(db.store.has('dailyScores/2026-10-10/players/luis') && db.store.has('playerNames/alias-luis'));
for (const name of ACCOUNT_DOCS) assert.ok(db.store.has(`${name}/luis`), `${name} de la otra cuenta sigue ahí`);

// El nombre solo se libera si es de esa cuenta.
const robbed = fakeDb({ 'playerProfiles/ana': { aliasKey: 'x' }, 'playerNames/x': { uid: 'otra' } });
await purgeAccountData(robbed, 'ana');
assert.ok(robbed.store.has('playerNames/x'), 'el nombre de otra persona no se borra');

// Sin perfil ni datos no falla, y un uid raro se rechaza.
await purgeAccountData(fakeDb({}), 'nadie');
for (const bad of ['', 'a/b', undefined, 5]) await assert.rejects(() => purgeAccountData(fakeDb({}), bad), /uid/);

// Borra el usuario de acceso al final y repetir una petición cortada no falla.
const calls = [];
const auth = { deleteUser: async uid => { calls.push(uid); if (calls.length > 1) throw Object.assign(new Error('x'), { code: 'auth/user-not-found' }); } };
const db2 = fakeDb(seed('ana'));
await deleteAccount(db2, auth, 'ana');
await deleteAccount(db2, auth, 'ana');
assert.deepEqual(calls, ['ana', 'ana']);
await assert.rejects(() => deleteAccount(db2, { deleteUser: async () => { throw Object.assign(new Error('x'), { code: 'auth/internal-error' }); } }, 'ana'), /x/);
// Si el borrado de datos falla, el usuario no se toca (se puede reintentar).
let touched = false;
await assert.rejects(() => deleteAccount({ doc: () => { throw new Error('caído'); } }, { deleteUser: async () => { touched = true; } }, 'ana'), /caído/);
assert.equal(touched, false);
// El borrado manual encuentra a la persona por su uid o por su nombre (sin importar mayúsculas).
const names = fakeDb({ ...seed('ana'), 'playerNames/alias-ana': { uid: 'ana' }, 'playerNames/fer': { uid: 'u9' } });
assert.equal(await findUid(names, 'ana'), 'ana');
assert.equal(await findUid(names, 'FER'), 'u9');
assert.equal(await findUid(names, ' Fer '), 'u9');
assert.equal(await findUid(names, 'nadie'), null);
assert.equal(await findUid(names, 'a/b'), null);
assert.equal(await findUid(names, ''), null);
console.log('Borrado de cuenta en el servidor: OK');
