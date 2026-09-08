import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getAppCheck} from 'firebase-admin/app-check';
import {getFirestore} from 'firebase-admin/firestore';
import {createService,firestoreStore} from './service.mjs';
import {handler} from './http.mjs';
// Inicio explícito; nunca carga catálogos ni credenciales aportados por un jugador.
if(!process.env.CONTINUUM_SERVER_CATALOGS)throw Error('Falta CONTINUUM_SERVER_CATALOGS (archivo de catálogos revisados)');
const catalogs=JSON.parse(await readFile(process.env.CONTINUUM_SERVER_CATALOGS,'utf8'));
const app=initializeApp({credential:applicationDefault()});
const execute=createService({store:firestoreStore(getFirestore(app)),catalogs});
const server=createServer(handler({execute,
 verifyIdToken:token=>getAuth(app).verifyIdToken(token,true),
 verifyAppCheck:token=>getAppCheck(app).verifyToken(token),
 origins:(process.env.CONTINUUM_ALLOWED_ORIGINS||'').split(',').filter(Boolean)}));
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT||8081),'127.0.0.1');
