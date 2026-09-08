// Cliente mínimo para el servicio competitivo. Mantiene los tokens fuera del
// estado del juego y deja la activación bajo configuración explícita.
export function createCompetitionClient({baseUrl, getIdToken, getAppCheckToken, fetchImpl=globalThis.fetch, timeoutMs=10000}={}) {
 if(typeof baseUrl!=='string'||!/^https:\/\//.test(baseUrl)) throw Error('INVALID_SERVER_URL');
 if(typeof fetchImpl!=='function') throw Error('FETCH_UNAVAILABLE');
 const root=baseUrl.replace(/\/+$/,'');
 return async function request({matchId,requestId,command}) {
  if(!matchId||!requestId||!command) throw Error('INVALID_REQUEST');
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
   const [idToken,appCheckToken]=await Promise.all([getIdToken?.(),getAppCheckToken?.()]);
   const headers={'content-type':'application/json'};
   if(idToken) headers.authorization=`Bearer ${idToken}`;
   if(appCheckToken) headers['x-firebase-appcheck']=appCheckToken;
   const response=await fetchImpl(`${root}/actions`,{method:'POST',headers,body:JSON.stringify({matchId,requestId,command}),signal:controller.signal});
   let body;try{body=await response.json();}catch{throw Error('INVALID_SERVER_RESPONSE');}
   if(!response.ok){const error=new Error(body?.error||'SERVER_ERROR');error.status=response.status;throw error;}
   return body;
  } finally { clearTimeout(timer); }
 };
}
