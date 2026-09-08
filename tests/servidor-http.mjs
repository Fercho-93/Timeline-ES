import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {handler} from '../server/http.mjs';
let called=0;
const handle=handler({origins:['https://game.test'],verifyIdToken:async token=>{if(token!=='valid')throw Error('SECRET');return {uid:'player001'};},
 verifyAppCheck:async token=>{if(token!=='attested')throw Error('SECRET');},execute:async request=>{called++;return {uid:request.uid};}});
async function request(body,headers={},method='POST') {
 const req=Readable.from([Buffer.from(body)]);Object.assign(req,{method,url:'/actions',headers:{'content-type':'application/json',authorization:'Bearer valid','x-firebase-appcheck':'attested',...headers}});
 let status,output;const res={setHeader(){},writeHead(n){status=n;},end(b){output=JSON.parse(b);}};
 await handle(req,res);return {status,output};
}
assert.equal((await request('{}',{authorization:''})).status,401);
assert.equal((await request('{}',{'x-firebase-appcheck':'bad'})).status,401);
assert.equal((await request('{}',{origin:'https://evil.test'})).status,403);
assert.equal((await request('{}',{'content-type':'text/plain'})).status,415);
assert.equal((await request('x'.repeat(8193))).status,413);
assert.equal((await request('{bad')).status,400);
assert.equal((await request('{"uid":"other"}')).status,400);
assert.equal(called,0);
assert.deepEqual(await request('{"matchId":"match001","requestId":"action01","command":{"type":"join","version":0}}'),{status:200,output:{uid:'player001'}});
console.log('HTTP: identidad autenticada, App Check obligatorio, origen y límites del cuerpo: OK');
