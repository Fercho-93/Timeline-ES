// Se ejecuta antes de compilar una distribución nativa. Nunca generar IDs ficticios.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const platform=process.argv[2];
if (!['ios','android'].includes(platform)) throw Error('Indica ios o android');
const path=platform==='ios'?'ios/App/App/GoogleService-Info.plist':'android/app/google-services.json';
const encoded=process.env[platform==='ios'?'GOOGLE_SERVICE_INFO_PLIST_BASE64':'GOOGLE_SERVICES_JSON_BASE64'];
if(encoded)fs.writeFileSync(path,Buffer.from(encoded,'base64'));
if(!fs.existsSync(path))throw Error(`Falta ${path}. Descarga la configuración REAL de la app com.continuum.game desde Firebase antes de distribuir esta versión.`);
if(platform==='android'){
 const config=JSON.parse(fs.readFileSync(path,'utf8'));
 if(config.project_info?.project_id!=='timeline-es' || !config.client?.some(c=>c.client_info?.android_client_info?.package_name==='com.continuum.game' && c.oauth_client?.some(o=>o.client_type===3)))throw Error('Configuración Android incorrecta o falta el cliente OAuth web de Google.');
}else{
 execFileSync('python3',['-c',`import plistlib
p='ios/App/App/GoogleService-Info.plist'
c=plistlib.load(open(p,'rb'))
assert c.get('PROJECT_ID')=='timeline-es' and c.get('BUNDLE_ID')=='com.continuum.game', 'Proyecto o bundle incorrecto'
assert c.get('REVERSED_CLIENT_ID'), 'Falta REVERSED_CLIENT_ID para Google'
p='ios/App/App/Info.plist'
d=plistlib.load(open(p,'rb')); types=d.setdefault('CFBundleURLTypes',[])
if not any(c['REVERSED_CLIENT_ID'] in v.get('CFBundleURLSchemes',[]) for v in types): types.append({'CFBundleURLSchemes':[c['REVERSED_CLIENT_ID']]})
plistlib.dump(d,open(p,'wb'))`],{stdio:'inherit'});
 execFileSync('ruby',['-rxcodeproj','-e',`p=Xcodeproj::Project.open('ios/App/App.xcodeproj');g=p.main_group.find_subpath('App',false);f=g.files.find{|f|f.path=='GoogleService-Info.plist'} || g.new_file('GoogleService-Info.plist');t=p.targets.find{|t|t.name=='App'};t.resources_build_phase.add_file_reference(f,true);p.save`],{stdio:'inherit'});
}
console.log(`Configuración de acceso ${platform} preparada.`);
