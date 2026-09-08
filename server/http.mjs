// Adaptador HTTP: los verificadores se inyectan para probar rechazos sin credenciales.
export function handler({execute,verifyIdToken,verifyAppCheck,origins=[]}) {
 return async (req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  const origin=req.headers.origin;
  if(origin&&!origins.includes(origin))return send(403,{error:'ORIGIN_DENIED'});
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,X-Firebase-AppCheck');res.setHeader('Access-Control-Allow-Methods','POST');return send(204,null);}
  if(req.method!=='POST'||req.url!=='/actions')return send(404,{error:'NOT_FOUND'});
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return send(415,{error:'JSON_REQUIRED'});
  try {
   const bearer=/^Bearer (\S+)$/.exec(req.headers.authorization||'');
   if(!bearer||!req.headers['x-firebase-appcheck'])return send(401,{error:'AUTH_REQUIRED'});
   let identity;
   try {identity=await verifyIdToken(bearer[1]);await verifyAppCheck(req.headers['x-firebase-appcheck']);}
   catch{return send(401,{error:'INVALID_TOKEN'});}
   let size=0;const chunks=[];
   for await(const chunk of req){size+=chunk.length;if(size>8192)return send(413,{error:'TOO_LARGE'});chunks.push(chunk);}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'INVALID_JSON'});}
   if(!body||typeof body!=='object'||Object.keys(body).some(k=>!['matchId','requestId','command'].includes(k)))return send(400,{error:'INVALID_REQUEST'});
   return send(200,await execute({...body,uid:identity.uid}));
  }catch(error){
   const conflict=['STALE_VERSION','IDEMPOTENCY_CONFLICT'].includes(error.message);
   const known=/^(INVALID_|NOT_|NO_|CANNOT_|EXPIRED$|RATE_LIMIT$|STALE_VERSION$|IDEMPOTENCY_CONFLICT$)/.test(error.message);
   return send(error.message==='RATE_LIMIT'?429:conflict?409:known?400:500,{error:known?error.message:'SERVER_ERROR'});
  }
 };
}
