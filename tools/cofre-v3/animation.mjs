// Animación de recortes de las cuatro ilustraciones aportadas. Ningún modelo
// sustituye sus texturas. La cámara, el cuerpo y el horizonte permanecen fijos.
const W=706,H=1536;
const smooth=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const point=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
const bilinear=(q,u,v)=>point(point(q[0],q[1],u),point(q[3],q[2],u),v);
function path(ctx,points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();}
function cut(image,polygon){const layer=document.createElement('canvas');layer.width=W;layer.height=H;const c=layer.getContext('2d');path(c,polygon);c.clip();c.drawImage(image,0,0,W,H);return layer;}
// Textura afín por triángulo, subdividida para seguir el escorzo sin deformar
// las esquinas ni reencuadrar toda la fotografía.
function triangle(c,image,s,d){
 const [a,b,e]=s,[A,B,E]=d;
 const det=(b[0]-a[0])*(e[1]-a[1])-(e[0]-a[0])*(b[1]-a[1]);if(Math.abs(det)<.0001)return;
 const ux=((B[0]-A[0])*(e[1]-a[1])-(E[0]-A[0])*(b[1]-a[1]))/det;
 const uy=((B[1]-A[1])*(e[1]-a[1])-(E[1]-A[1])*(b[1]-a[1]))/det;
 const vx=((E[0]-A[0])*(b[0]-a[0])-(B[0]-A[0])*(e[0]-a[0]))/det;
 const vy=((E[1]-A[1])*(b[0]-a[0])-(B[1]-A[1])*(e[0]-a[0]))/det;
 c.save();
 // Medio píxel extra evita costuras de rasterización entre triángulos.
 const center=[(A[0]+B[0]+E[0])/3,(A[1]+B[1]+E[1])/3];
 path(c,d.map(p=>{const n=Math.hypot(p[0]-center[0],p[1]-center[1]);return[p[0]+(p[0]-center[0])*.45/n,p[1]+(p[1]-center[1])*.45/n];}));c.clip();
 c.transform(ux,uy,vx,vy,A[0]-ux*a[0]-vx*a[1],A[1]-uy*a[0]-vy*a[1]);c.drawImage(image,0,0);c.restore();
}
function quad(c,image,source,target,alpha=1,n=5){if(alpha<=0)return;c.save();c.globalAlpha*=alpha;for(let y=0;y<n;y++)for(let x=0;x<n;x++){
 const p=[[x/n,y/n],[(x+1)/n,y/n],[(x+1)/n,(y+1)/n],[x/n,(y+1)/n]];
 const s=p.map(p=>bilinear(source,...p)),d=p.map(p=>bilinear(target,...p));
 triangle(c,image,[s[0],s[1],s[2]],[d[0],d[1],d[2]]);triangle(c,image,[s[0],s[2],s[3]],[d[0],d[2],d[3]]);
 }c.restore();}
const rect=(x,y,w,h,angle=0)=>{const a=angle*Math.PI/180;return[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(p=>[x+p[0]*Math.cos(a)-p[1]*Math.sin(a),y+p[0]*Math.sin(a)+p[1]*Math.cos(a)]);};
// Láminas originales distribuidas en los mazos del juego; no cartas inventadas.
export const gameCards=[
 ['world-cards/5009-battle-marathon.webp','Batalla de Maratón'],
 ['medicine-cards/9001-hippocratic-corpus.webp','Corpus hipocrático'],
 ['astronomy-cards/first-earth-photo.webp','Primera fotografía de la Tierra'],
 ['world-cards/5002-great-pyramid-giza.webp','Gran Pirámide de Guiza'],
 ['world-cards/5022-vesuvius-eruption.webp','Erupción del Vesubio']
];
const cardSource=[[0,0],[512,0],[512,768],[0,768]];
const finalCards=[[132,700,-25],[244,625,-13],[355,590,0],[464,625,13],[575,700,25]];
const bezier=(a,b,c,d,t)=>{const u=1-t;return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;};
const innerQuad=[[273,729],[613,749],[619,952],[227,916]];
const outerQuad=[[156,851],[608,851],[608,1011],[156,1011]];
const outerPolygon=[[166,970],[165,930],[177,895],[199,872],[234,858],[273,861],[553,886],[579,897],[596,921],[606,957],[605,981],[585,1002],[514,1008],[164,982]];
const bodyPolygon=[[144,976],[508,1019],[595,962],[599,1154],[588,1199],[507,1211],[143,1153]];
const stackPolygon=[[238,945],[404,922],[503,951],[502,986],[475,1002],[267,980],[238,966]];
const stackSource=[[238,922],[503,922],[503,1003],[238,1003]];
export async function createAnimation(canvas){
 const c=canvas.getContext('2d');canvas.width=W;canvas.height=H;
 const images=await Promise.all(['closed','open','rise','fan','clean'].map(name=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=`/assets/cofre-reference-v3-${name}.webp`;})));
 const [closed,open,rise,fan,clean]=images;
 const body=cut(closed,bodyPolygon),outer=cut(closed,outerPolygon),inside=cut(open,[[273,729],[613,749],[636,815],[622,950],[227,922],[255,809]]),stack=cut(open,stackPolygon);
 const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src='/assets/'+src;});
 const cardTextures=await Promise.all(gameCards.map(([src])=>load(src)));
 const emblem=await load('continuum-emblem-800.webp');
 // Papel y emblema común del reverso real de la mano (edition.css).
 const back=document.createElement('canvas');back.width=512;back.height=768;
 const bc=back.getContext('2d'),paper=bc.createLinearGradient(0,0,512,768);paper.addColorStop(0,'#f9f2e2');paper.addColorStop(1,'#e6e6d5');bc.fillStyle=paper;bc.fillRect(0,0,512,768);
 bc.strokeStyle='#486d6618';bc.lineWidth=1;for(let k=-768;k<1280;k+=24){bc.beginPath();bc.moveTo(k,0);bc.lineTo(k+768,768);bc.stroke();bc.beginPath();bc.moveTo(k,0);bc.lineTo(k-768,768);bc.stroke();}
 bc.strokeStyle='#7b928180';bc.lineWidth=3;bc.strokeRect(15,15,482,738);bc.lineWidth=1;bc.strokeRect(23,23,466,722);bc.drawImage(emblem,60,235,392,261);

 // La madera vacía de la cuarta referencia sustituye el mazo completo.
 // El borde frontal se compone después para ocultar la salida de las cartas.
 const emptyMouth=[[152,1043],[284,977],[592,1009],[522,1084]];
 const mouth=[[145,978],[252,918],[596,958],[508,1021]];
 const base=document.createElement('canvas');base.width=W;base.height=H;const b=base.getContext('2d');b.drawImage(closed,0,0);
 // Le fond nettoyé ne remplace que l'emprise du cofre et son ombre. Le ciel,
 // la côte et le bateau restent les pixels de la première image.
 const repair=document.createElement('canvas');repair.width=W;repair.height=H;const r=repair.getContext('2d');r.drawImage(clean,0,0,W,H);
 const mask=document.createElement('canvas');mask.width=W;mask.height=H;const m=mask.getContext('2d');m.filter='blur(22px)';m.fillStyle='#fff';m.fillRect(100,824,544,425);r.globalCompositeOperation='destination-in';r.drawImage(mask,0,0);b.drawImage(repair,0,0);
 // Proyección calibrada sobre las cuatro esquinas de la boca: la tapa
 // es una semielipse rígida con los píxeles de la primera imagen.
 const boxQuad=[[252,918],[596,958],[508,1021],[145,978]];
 const project=(u,v,h,theta=0)=>{const depth=v*Math.cos(theta)-h*Math.sin(theta),height=v*Math.sin(theta)+h*Math.cos(theta),p=bilinear(boxQuad,u,depth);return[p[0]+height*mix(10,8,u),p[1]-height*mix(184,203,u)];};
 const area=q=>(q[1][0]-q[0][0])*(q[2][1]-q[0][1])-(q[1][1]-q[0][1])*(q[2][0]-q[0][0]);
 const lid=(theta)=>{
  const target=[project(0,1,0,theta),project(1,1,0,theta),project(1,0,0,theta),project(0,0,0,theta)];
  if(area(target)>0)quad(c,inside,innerQuad,target,1,10);
  const N=32,M=14;
  for(let j=N-1;j>=0;j--)for(let i=0;i<M;i++){
   const params=[[i/M,j/N],[(i+1)/M,j/N],[(i+1)/M,(j+1)/N],[i/M,(j+1)/N]];
   const coords=(pt,t)=>{const phi=pt[1]*Math.PI;return project(pt[0],(1+Math.cos(phi))/2,.46*Math.sin(phi),t);};
   const a=params.map(p=>coords(p,0)),d=params.map(p=>coords(p,theta));
   if(area(a)<0&&area(d)<0){triangle(c,closed,[a[0],a[1],a[2]],[d[0],d[1],d[2]]);triangle(c,closed,[a[0],a[2],a[3]],[d[0],d[2],d[3]]);}
  }
  // La tapa derecha conserva espesor y arabescos durante todo el giro.
  const origin=project(1,.5,0,0),dest=project(1,.5,0,theta);
  for(let j=0;j<N;j++){
   const a=j/N*Math.PI,z=(j+1)/N*Math.PI;
   const p0=project(1,(1+Math.cos(a))/2,.46*Math.sin(a),0),p1=project(1,(1+Math.cos(z))/2,.46*Math.sin(z),0);
   const q0=project(1,(1+Math.cos(a))/2,.46*Math.sin(a),theta),q1=project(1,(1+Math.cos(z))/2,.46*Math.sin(z),theta);
   triangle(c,closed,[origin,p0,p1],[dest,q0,q1]);
  }
 };
 function draw(t){
  c.clearRect(0,0,W,H);
  if(t<=.05){c.drawImage(closed,0,0);return;}
  c.drawImage(base,0,0);
  // Ombre de contact permanente, sans glissement de l'assise du coffre.
  c.save();const shadow=c.createRadialGradient(385,1188,30,385,1188,265);shadow.addColorStop(0,'#120a0560');shadow.addColorStop(1,'#120a0500');c.fillStyle=shadow;c.translate(0,795);c.scale(1,.34);c.fillRect(105,700,540,790);c.restore();
  quad(c,fan,emptyMouth,mouth,1,7);
  const p=smooth((t-.22)/1.43),theta=p*1.68;
  lid(theta);
  const stackAlpha=1-smooth((t-2.02)/1.1);
  const stackTarget=stackSource.map(pt=>[pt[0],pt[1]+smooth((t-2.02)/1.1)*17]);
  quad(c,stack,stackSource,stackTarget,p>.25?stackAlpha:0,4);
  // La lumière ne déborde pas sur le ciel: elle est confinée à l'ouverture.
  const light=smooth((t-.9)/1.0);
  c.save();c.globalCompositeOperation='screen';c.globalAlpha=.16*light;const glow=c.createRadialGradient(368,967,4,368,967,190);glow.addColorStop(0,'#ffc65f');glow.addColorStop(.5,'#ffbd4433');glow.addColorStop(1,'#ffbd4400');c.fillStyle=glow;c.fillRect(170,770,430,340);c.restore();
  for(let i=0;i<5;i++){
   const elapsed=t-(1.86+i*.13),progress=Math.max(0,Math.min(1,elapsed/2.8));
   if(elapsed<=0)continue;
   // Una sola curva continua desde el cofre hasta el abanico, sin escala intermedia.
   const e=1-Math.pow(1-progress,3),[fx,fy,fa]=finalCards[i];
   const x=bezier(368,368+(i-2)*26,fx+(i-2)*34,fx,e);
   const y=bezier(982,745,fy-55,fy,e);
   const drift=smooth((progress-.72)/.28);
   const bob=Math.sin((t-4.1)*1.7+i*.48)*2.1*drift;
   const w=mix(133,151,smooth(progress)),h=w*1.5;
   const angle=mix((i-2)*-8,fa,smooth(progress))+Math.sin(t*1.3+i)*.65*drift;
   let pose=rect(x,y+bob,w,h,angle);
   const flip=smooth((progress-.09-i*.018)/.55);
   const squeeze=Math.max(.025,Math.abs(Math.cos(flip*Math.PI)));
   const midT=point(pose[0],pose[1],.5),midB=point(pose[3],pose[2],.5);
   pose=[point(midT,pose[0],squeeze),point(midT,pose[1],squeeze),point(midB,pose[2],squeeze),point(midB,pose[3],squeeze)];
   const texture=flip<.5?back:cardTextures[i];
   c.save();c.shadowColor='#28130460';c.shadowBlur=9;c.shadowOffsetY=4;c.fillStyle='#24100633';path(c,pose);c.fill();c.restore();
   quad(c,texture,cardSource,pose,smooth(progress*12),5);
   c.save();path(c,pose);c.strokeStyle='#d8bf8b';c.lineWidth=1.7;c.stroke();c.restore();
  }
  c.drawImage(body,0,0);
  // Quelques poussières fixes, dont seule la lumière varie, dans le faisceau.
  c.save();c.globalCompositeOperation='screen';for(let i=0;i<14;i++){const life=smooth((t-1.15-i*.065)/.7)*(1-smooth((t-4.6)/1));if(!life)continue;const x=260+(i*67%260),y=950-((t*35+i*39)%215);c.globalAlpha=life*.35;c.fillStyle='#ffcb79';c.beginPath();c.arc(x,y,i%3===0?1.7:.9,0,Math.PI*2);c.fill();}c.restore();
 }
 return {draw};
}
