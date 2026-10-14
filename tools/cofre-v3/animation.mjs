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
// Los cinco anversos se toman del abanico final; los dorsos de brújula, de la
// fase de ascenso. Las coordenadas describen los bordes de cada carta.
const faces=[[[23,634],[155,578],[249,780],[115,844]],[[137,541],[269,500],[346,714],[215,765]],[[270,482],[422,455],[446,681],[293,694]],[[428,498],[573,537],[512,761],[369,721]],[[548,586],[687,651],[593,850],[455,788]]];
const backQuad=[[349,433],[424,385],[502,523],[424,568]];
const innerQuad=[[273,729],[613,749],[619,952],[227,916]];
const outerQuad=[[156,851],[608,851],[608,1011],[156,1011]];
const outerPolygon=[[166,970],[165,930],[177,895],[199,872],[234,858],[273,861],[553,886],[579,897],[596,921],[606,957],[605,981],[585,1002],[514,1008],[164,982]];
const bodyPolygon=[[144,976],[508,1019],[595,962],[599,1154],[588,1199],[507,1211],[143,1153]];
const stackPolygon=[[238,945],[404,922],[503,951],[502,986],[475,1002],[267,980],[238,966]];
const stackSource=[[238,922],[503,922],[503,1003],[238,1003]];
const riseTargets=[rect(425,477,90,161,-31),rect(351,845,108,166,-25),rect(403,620,103,171,18),rect(361,734,105,164,-30),rect(378,966,113,166,24)];
const emission=[0,3,1,2,4]; // orden de salida: barco, pájaro, cielo, mapa, mariposa
export async function createAnimation(canvas){
 const c=canvas.getContext('2d');canvas.width=W;canvas.height=H;
 const images=await Promise.all(['closed','open','rise','fan','clean'].map(name=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=`/assets/cofre-reference-v3-${name}.webp`;})));
 const [closed,open,rise,fan,clean]=images;
 const body=cut(closed,bodyPolygon),outer=cut(closed,outerPolygon),inside=cut(open,[[273,729],[613,749],[636,815],[622,950],[227,922],[255,809]]),stack=cut(open,stackPolygon);
 const cardTextures=faces.map(q=>cut(fan,q)),back=cut(rise,backQuad);
 // La vue vide de la quatrième image est replacée dans la bouche du premier
 // cofre. Le raccord reste derrière la lèvre de bois et de métal du corps.
 const emptyMouth=[[152,1043],[284,977],[592,1009],[522,1084]];
 const mouth=[[145,978],[252,918],[596,958],[508,1021]];
 const mouthLayer=cut(open,[[146,975],[227,916],[620,951],[596,1020],[508,1021]]);
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
  c.drawImage(mouthLayer,0,0);
  c.save();path(c,stackPolygon);c.clip();quad(c,fan,emptyMouth,mouth,1,7);c.restore();
  const p=smooth((t-.22)/1.43),theta=p*1.68;
  lid(theta);
  const stackAlpha=1-smooth((t-2.02)/1.1);
  const stackTarget=stackSource.map(pt=>[pt[0],pt[1]+smooth((t-2.02)/1.1)*17]);
  quad(c,stack,stackSource,stackTarget,p>.25?stackAlpha:0,4);
  // La lumière ne déborde pas sur le ciel: elle est confinée à l'ouverture.
  const light=smooth((t-.9)/1.0);
  c.save();c.globalCompositeOperation='screen';c.globalAlpha=.16*light;const glow=c.createRadialGradient(368,967,4,368,967,190);glow.addColorStop(0,'#ffc65f');glow.addColorStop(.5,'#ffbd4433');glow.addColorStop(1,'#ffbd4400');c.fillStyle=glow;c.fillRect(170,770,430,340);c.restore();
  for(let i=0;i<5;i++){
   const order=emission[i],q=smooth((t-2.04-order*.17)/.82);
   if(q<=0)continue;
   const start=[[243,943],[415,926],[499,952],[325,974]];
   const flight=start.map((pt,j)=>point(pt,riseTargets[i][j],q));
   const f=smooth((t-3.54-order*.035)/1.0);
   let pose=flight.map((pt,j)=>point(pt,faces[i][j],f));
   if(f>0&&f<1)pose=pose.map(pt=>[pt[0],pt[1]-Math.sin(f*Math.PI)*(i%2?30:50)]);
   // Les trois cartes vues de dos dans la troisième référence se retournent
   // pendant leur déploiement. L'oiseau et le ciel montrent déjà leur face.
   const reversed=[0,3,4].includes(i),flip=reversed?smooth((f-.12)/.68):1;
   const squeeze=reversed?Math.max(.06,Math.abs(Math.cos(flip*Math.PI))):1;
   if(reversed){const midL=point(pose[0],pose[1],.5),midB=point(pose[3],pose[2],.5);pose=[point(midL,pose[0],squeeze),point(midL,pose[1],squeeze),point(midB,pose[2],squeeze),point(midB,pose[3],squeeze)];}
   const texture=reversed&&flip<.5?back:cardTextures[i],source=reversed&&flip<.5?backQuad:faces[i];
   c.save();c.shadowColor='#28130460';c.shadowBlur=9;c.shadowOffsetY=4;c.fillStyle='#24100633';path(c,pose);c.fill();c.restore();quad(c,texture,source,pose,smooth(q*5),5);
  }
  c.drawImage(body,0,0);
  // Quelques poussières fixes, dont seule la lumière varie, dans le faisceau.
  c.save();c.globalCompositeOperation='screen';for(let i=0;i<14;i++){const life=smooth((t-1.15-i*.065)/.7)*(1-smooth((t-4.6)/1));if(!life)continue;const x=260+(i*67%260),y=950-((t*35+i*39)%215);c.globalAlpha=life*.35;c.fillStyle='#ffcb79';c.beginPath();c.arc(x,y,i%3===0?1.7:.9,0,Math.PI*2);c.fill();}c.restore();
 }
 return {draw};
}
