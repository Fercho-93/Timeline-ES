import assert from 'node:assert/strict';
import {createCompetitionClient} from '../server/client.mjs';
let calls=[];
const client=createCompetitionClient({baseUrl:'https://competition.example.test/',getIdToken:async()=> 'id',getAppCheckToken:async()=> 'app',fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({public:{version:1}})};}});
const response=await client({matchId:'match-1234',requestId:'request-1234',command:{type:'heartbeat',version:1}});
assert.deepEqual(response,{public:{version:1}});assert.equal(calls[0].url,'https://competition.example.test/actions');assert.equal(calls[0].options.headers.authorization,'Bearer id');assert.equal(calls[0].options.headers['x-firebase-appcheck'],'app');
assert.throws(()=>createCompetitionClient({baseUrl:'http://insecure.test'}),/INVALID_SERVER_URL/);
console.log('Cliente de competición: URL segura, tokens y respuesta: OK');
