import * as THREE from 'three';
import {mergeGeometries,toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {geometry,rounded,mesh,block,ellipsoid,tube,panel} from './model-primitives.js';
import {buildHuman} from './human-model.js';
export const VEHICLE_DIMENSIONS=Object.freeze({
  sedan:{length:4.5,width:1.78,height:1.46,r:.32,axles:[-1.33,1.38],belt:.93,front:1.08,frontTop:.34,rearTop:-.88,rear:-1.58},
  hatch:{length:3.85,width:1.68,height:1.46,r:.30,axles:[-1.22,1.20],belt:.93,front:.80,frontTop:.03,rearTop:-1.48,rear:-1.80},
  mpv:{length:4.42,width:1.74,height:1.69,r:.32,axles:[-1.38,1.38],belt:1.03,front:1.15,frontTop:.32,rearTop:-1.90,rear:-2.08},
  suv:{length:4.8,width:1.90,height:1.76,r:.39,axles:[-1.45,1.45],belt:1.12,front:1.25,frontTop:.48,rearTop:-1.95,rear:-2.22},
  pickup:{length:4.9,width:1.76,height:1.65,r:.36,axles:[-1.45,1.55],belt:1.04,front:1.32,frontTop:.64,rearTop:-.43,rear:-.47},
  angkot:{length:4.3,width:1.66,height:1.93,r:.30,axles:[-1.25,1.30],belt:1.13,front:1.65,frontTop:1.24,rearTop:-1.93,rear:-2.03},
  van:{length:5.4,width:1.95,height:2.23,r:.36,axles:[-1.8,1.8],belt:1.26,front:2.22,frontTop:1.64,rearTop:-2.47,rear:-2.56},
  bus:{length:12.5,width:2.5,height:3.5,r:.50,axles:[-4.8,-3.4,4.2],belt:1.62,front:6.1,frontTop:5.86,rearTop:-6.02,rear:-6.13},
  boxTruck:{length:8.2,width:2.4,height:3.65,r:.46,axles:[-2.7,2.85]},
  truck:{length:16,width:2.5,height:4.05,r:.52,axles:[-6.2,-4.85,3.0,6.65]},
  damkar:{length:9,width:2.4,height:3.25,r:.46,axles:[-3.4,-2.15,3.25]},
  derek:{length:8.6,width:2.4,height:3.16,r:.46,axles:[-3.15,-1.95,3.05]},
  moto:{length:2.04,width:.73,height:1.72,r:.30,axles:[-.66,.68]}
});
const trim=new THREE.MeshStandardMaterial({color:0x23272b,roughness:.76}),fabric=new THREE.MeshStandardMaterial({color:0x30363b,roughness:.94}),silver=new THREE.MeshStandardMaterial({color:0xa5adb3,roughness:.3,metalness:.85}),wheelMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.48,metalness:.35}),riderMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85});
export const MODEL_MATERIALS=[trim,fabric,silver,wheelMat,riderMat];
function coloredGeometry(root){root.updateMatrixWorld(true);const geos=[];root.traverse(o=>{if(!o.isMesh)return;const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);for(const a of Object.keys(g.attributes))if(!['position','normal'].includes(a))g.deleteAttribute(a);g.clearGroups();const c=o.material.color,colors=[];for(let i=0;i<g.attributes.position.count;i++)colors.push(c.r,c.g,c.b);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geos.push(g);});const result=mergeGeometries(geos);geos.forEach(g=>g.dispose());return result;}
function driver(parent,pose,x,y,z){const key='driver:'+pose,g=geometry(key,()=>{const person=buildHuman({pose,shirt:0x314d60,helmet:pose==='riding'?trim:null});return coloredGeometry(person.g);});return mesh(parent,g,riderMat,x,y,z);}
// Tyre shoulders, rim barrel, spokes, brake disc and hub are one cached mesh per wheel.
function wheel(parent,r,width,x,z,heavy=false){const key=`wheel:${r}:${width}:${heavy}`;const geo=geometry(key,()=>{
  const root=new THREE.Group(),tyre=new THREE.MeshStandardMaterial({color:0x17191c}),metal=new THREE.MeshStandardMaterial({color:heavy?0xa5a9ac:0xd0d4d8}),brake=new THREE.MeshStandardMaterial({color:0x555c63});
  const tyreGeo=new THREE.TorusGeometry(r*.81,r*.19,10,36);tyreGeo.rotateY(Math.PI/2);mesh(root,tyreGeo,tyre).scale.x=width/(r*.38);
  const barrel=new THREE.CylinderGeometry(r*.61,r*.61,width*.88,32);barrel.rotateZ(Math.PI/2);mesh(root,barrel,brake);
  for(const side of [-1,1]){const ring=new THREE.TorusGeometry(r*.62,r*.035,6,32);ring.rotateY(Math.PI/2);mesh(root,ring,metal,side*width*.5,0,0);
    const rotor=new THREE.CylinderGeometry(r*.46,r*.46,.014,28);rotor.rotateZ(Math.PI/2);mesh(root,rotor,brake,side*width*.37,0,0);
    for(let k=0;k<(heavy?8:5);k++){const a=k/(heavy?8:5)*Math.PI*2;const spoke=mesh(root,rounded(.035,r*.10,r*.49,.008),metal,side*width*.51,Math.sin(a)*r*.34,Math.cos(a)*r*.34);spoke.rotation.x=-a;}
    const hub=new THREE.CylinderGeometry(r*.17,r*.17,.035,16);hub.rotateZ(Math.PI/2);mesh(root,hub,metal,side*width*.52,0,0);
    for(let k=0;k<(heavy?8:5);k++){const a=k/(heavy?8:5)*Math.PI*2;const bolt=mesh(root,geometry('wheel-bolt',()=>new THREE.SphereGeometry(1,8,6)),brake,side*width*.55,Math.sin(a)*r*.12,Math.cos(a)*r*.12);bolt.scale.set(.012,.014,.014);}}
  const result=coloredGeometry(root);root.traverse(o=>{if(o.geometry&&!o.geometry.userData.keep)o.geometry.dispose();});tyre.dispose();metal.dispose();brake.dispose();return result;});
  const w=mesh(parent,geo,wheelMat,x,r,z);w.userData.realWheel=true;return w;
}
function bodyGeometry(s){return geometry('body:'+JSON.stringify(s),()=>{
  const {length:l,width:w,r,axles,belt}=s,half=l/2,base=Math.max(.25,r*.86),shape=new THREE.Shape();shape.moveTo(-half,base);
  for(const a of [...axles].sort((a,b)=>a-b)){const R=r+.065;shape.lineTo(a-R,base);shape.lineTo(a-R,r);shape.absarc(a,r,R,Math.PI,0,true);shape.lineTo(a+R,base);}
  shape.lineTo(half,base);shape.lineTo(half,belt-.23);shape.quadraticCurveTo(half,belt-.10,half-.17,belt-.09);shape.lineTo(s.front??half-.6,belt);shape.lineTo(s.rear??-half+.12,belt);shape.quadraticCurveTo(-half,belt,-half,belt-.15);shape.closePath();
  let g=new THREE.ExtrudeGeometry(shape,{depth:w-.10,bevelEnabled:true,bevelSize:.045,bevelThickness:.05,bevelSegments:3,curveSegments:14});g.translate(0,0,-(w-.10)/2);g.rotateY(-Math.PI/2);
  const p=g.attributes.position;for(let i=0;i<p.count;i++){const z=p.getZ(i),y=p.getY(i),end=Math.pow(Math.abs(z)/half,6);p.setX(i,p.getX(i)*(1-.095*end-.03*Math.max(0,y-belt+.15)));}g=toCreasedNormals(g,.8);return g;
});}
function cabin(g,s,m){const {width:w,height:h,belt:b,front:f,frontTop:ft,rearTop:rt,rear:r}=s,lo=w*.456,hi=w*.39,roof=h-.055;
  // Compound-curved windscreen and rear screen; the cabin narrows toward the roof.
  panel(g,m.glass,[[-lo,b+.02,f],[lo,b+.02,f],[hi,roof,ft],[-hi,roof,ft]],.028);
  panel(g,m.glass,[[lo,b+.02,r],[-lo,b+.02,r],[-hi,roof,rt],[hi,roof,rt]],.018);
  const length=ft-rt,n=length>3?Math.ceil(length/1.15):length>1.8?3:2;
  for(const side of [-1,1]){
    const lower=z=>r+(f-r)*(z-rt)/(ft-rt);
    for(let k=0;k<n;k++){const t0=k/n,t1=(k+1)/n,z0=rt+length*t0,z1=rt+length*t1,lower0=lower(z0),lower1=lower(z1);
      panel(g,m.glass,[[side*lo,b+.025,lower0+.035],[side*lo,b+.025,lower1-.035],[side*hi,roof-.03,z1-.035],[side*hi,roof-.03,z0+.035]]);
      if(k>0)tube(g,m.paint,[side*lo,b,lower0],[side*hi,roof,z0],.026);
      tube(g,m.chrome,[side*(lo+.004),b-.005,lower0],[side*(lo+.004),b-.005,lower1],.009);
    }
    tube(g,m.paint,[side*lo,b,f],[side*hi,roof,ft],.037);tube(g,m.paint,[side*lo,b,r],[side*hi,roof,rt],.045);
  }
  const roofGeo=geometry('roof:'+JSON.stringify([w,h,ft,rt]),()=>{const g=rounded(w*.80,.10,ft-rt+.07,.045).clone();const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+.035*(1-Math.min(1,(p.getX(i)/(w*.4))**2)));g.computeVertexNormals();return g;});mesh(g,roofGeo,m.paint,0,roof+.025,(ft+rt)/2);
}
function passengerDetails(g,s,m,type){const {width:w,length:l,r,belt:b,axles}=s,F=l/2,B=-F,heavy=l>7;
  block(g,m.trim,w*.84,.13,l*.88,0,r+.08,0,.035);
  for(const side of [-1,1]){
    block(g,m.chrome,.16,.10,.27,side*(w/2+.065),b+.12,s.front-.12,.045);tube(g,m.trim,[side*w*.45,b+.05,s.front-.22],[side*(w/2+.03),b+.1,s.front-.1],.018);
    for(const z of [s.front-.10,(s.front+s.rear)/2]){tube(g,m.trim,[side*(w*.5-.005),r+.10,z],[side*(w*.5-.005),b-.04,z],.004);block(g,m.chrome,.025,.026,.15,side*(w*.5+.004),b-.10,z-.22,.012);}
    // Thin lens, DRL and reflector geometries follow the curved front/rear corners.
    block(g,m.head,w*.25,.125,.10,side*w*.31,b-.22,F+.065,.035);block(g,m.head,w*.24,.023,.018,side*w*.31,b-.31,F+.075,.008);
    block(g,m.tail,w*.20,.14,.08,side*w*.35,b-.16,B-.06,.025);block(g,m.trim,.15,.10,.04,side*w*.34,r+.13,F+.07,.022);
    tube(g,m.trim,[side*w*.46,r+.09,axles[0]+r+.08],[side*w*.46,r+.09,axles.at(-1)-r-.08],.035);
  }
  for(const side of [-1,1]){tube(g,m.trim,[side*w*.31,b+.04,s.front-.02],[side*w*.10,b+.13,s.front-.14],.007);}
  block(g,m.grille,w*.49,.16,.055,0,b-.25,F+.075,.025);for(let k=0;k<4;k++)block(g,m.chrome,w*.48,.008,.012,0,b-.30+k*.034,F+.11,.002);
  block(g,m.trim,w*.80,.11,.09,0,r+.05,F+.04,.035);block(g,m.trim,w*.80,.11,.09,0,r+.05,B-.04,.035);
  block(g,m.plate,.46,.13,.025,0,r+.19,F+.05,.009);block(g,m.plate,.46,.13,.025,0,b-.35,B-.045,.009);
  block(g,m.fabric,w*.72,.10,Math.max(.65,s.front-s.rear-.15),0,b-.19,(s.front+s.rear)/2,.025);
  for(const side of [-1,1]){block(g,m.fabric,.46,.14,.49,side*w*.235,.57+(r-.32),-.08,.06);const back=block(g,m.fabric,.46,.53,.11,side*w*.235,.87+(r-.32),-.30,.05);back.rotation.x=-.12;block(g,m.fabric,.23,.15,.11,side*w*.235,1.20+(r-.32),-.34,.04);}
  block(g,m.trim,w*.78,.14,.29,0,b+.03,s.front-.23,.035);
  const ring=geometry('steering',()=>new THREE.TorusGeometry(.15,.017,6,22));const steer=mesh(g,ring,m.trim,w*.23,b+.12,s.front-.46);steer.rotation.x=-.40;
  driver(g,'seated',w*.23,b-1.38,-.02);
  if(type==='pickup'){const bedFront=-.58,back=-l/2+.06;block(g,m.trim,w*.87,.07,bedFront-back,0,1.03,(back+bedFront)/2,.02);for(const side of [-1,1])block(g,m.paint,.08,.37,bedFront-back,side*(w/2-.05),1.22,(bedFront+back)/2,.025);block(g,m.paint,w,.37,.08,0,1.22,back,.025);for(let k=0;k<6;k++)block(g,m.chrome,.012,.012,bedFront-back-.1,(k-2.5)*.21,1.074,(bedFront+back)/2,.002);}
}
function motorcycle(m){const g=new THREE.Group(),s=VEHICLE_DIMENSIONS.moto,r=s.r;
  const wh=s.axles.map(z=>wheel(g,r,.105,0,z));
  for(const side of [-1,1]){tube(g,m.chrome,[side*.045,r,.68],[side*.045,.94,.44],.022);tube(g,m.trim,[side*.06,r,-.66],[side*.06,.55,-.05],.025);tube(g,m.chrome,[side*.09,.49,-.62],[side*.09,.83,-.25],.019);}
  for(const [a,b]of [[[0,.50,-.55],[0,.81,-.20]],[[0,.81,-.20],[0,.84,.40]],[[0,.84,.40],[0,.42,.08]],[[0,.42,.08],[0,.50,-.55]]])tube(g,m.trim,a,b,.033);
  ellipsoid(g,m.paint,[0,.77,.09],[.175,.165,.30]);block(g,m.fabric,.30,.095,.62,0,.86,-.28,.045);ellipsoid(g,m.paint,[0,.73,-.57],[.14,.10,.27]);
  ellipsoid(g,m.grille,[0,.45,.02],[.145,.13,.17]);for(let k=0;k<5;k++)block(g,m.chrome,.30,.018,.20,0,.42+k*.037,.02,.005);
  tube(g,m.chrome,[.15,.40,.08],[.19,.25,-.20],.022);tube(g,m.chrome,[.19,.25,-.20],[.19,.30,-.66],.048);tube(g,m.trim,[.19,.30,-.63],[.19,.30,-.80],.038);
  tube(g,m.chrome,[-.32,.99,.46],[.32,.99,.46],.018);for(const side of [-1,1]){tube(g,m.trim,[side*.23,.99,.46],[side*.34,.99,.46],.023);tube(g,m.chrome,[side*.25,1,.45],[side*.29,1.17,.43],.009);ellipsoid(g,m.trim,[side*.29,1.19,.43],[.064,.042,.022]);tube(g,m.chrome,[side*.13,.34,-.13],[side*.24,.34,-.13],.015);}
  ellipsoid(g,m.head,[0,.90,.56],[.11,.09,.04]);block(g,m.tail,.13,.06,.03,0,.75,-.84,.018);block(g,m.plate,.18,.09,.018,0,.61,-.86,.008);
  const mud=geometry('frontMudguard',()=>new THREE.TorusGeometry(.33,.027,6,22,Math.PI*.85));const fender=mesh(g,mud,m.paint,0,r,.68);fender.rotation.y=Math.PI/2;fender.rotation.x=.1;
  driver(g,'riding',0,-.13,-.22);return {g,wh,len:s.length,r,type:'moto',v0:14,dimensions:s};
}
function commercial(g,s,m,type){const l=s.length,w=s.width,F=l/2,r=s.r,cabLen=type==='truck'?2.8:2.5,back=F-cabLen;
  block(g,m.trim,w*.76,.26,l-.4,0,r+.25,0,.05);
  // Cab-over construction: rounded corners, split windscreen, doors and access steps.
  const cab={length:cabLen,width:w-.08,height:3.12,r,axles:[Math.max(...s.axles)-(back+cabLen/2)],belt:1.87,front:cabLen/2-.10,frontTop:cabLen/2-.31,rearTop:-cabLen/2+.12,rear:-cabLen/2+.05};const cg=new THREE.Group();cg.position.z=back+cabLen/2;g.add(cg);
  mesh(cg,bodyGeometry(cab),m.paint);cabin(cg,cab,m);for(const side of [-1,1]){block(cg,m.head,.39,.18,.07,side*w*.33,.94,cabLen/2+.005,.025);tube(cg,m.trim,[side*w*.49,1.9,cabLen/2-.2],[side*(w*.5+.22),2.1,cabLen/2-.12],.025);block(cg,m.chrome,.15,.43,.10,side*(w*.5+.23),2.18,cabLen/2-.12,.035);
    block(cg,m.chrome,.23,.09,.65,side*w*.47,.80,0,.02);block(cg,m.chrome,.23,.09,.65,side*w*.47,1.08,-.2,.02);block(cg,m.chrome,.023,.04,.20,side*w*.49,1.65,-.5,.008);}
  block(cg,m.grille,w*.65,.48,.035,0,1.20,cabLen/2+.025,.03);for(let k=0;k<5;k++)block(cg,m.chrome,w*.60,.022,.025,0,1.04+k*.085,cabLen/2+.05,.004);block(cg,m.plate,.48,.14,.025,0,.67,cabLen/2+.055,.008);block(cg,m.trim,w,.16,.16,0,.60,cabLen/2-.03,.04);driver(cg,'seated',w*.23,.65,.45);
  const cargoEnd=back-.14,cargoStart=-F+.05,cargoLen=cargoEnd-cargoStart,cargoZ=(cargoStart+cargoEnd)/2;
  if(type==='truck'||type==='boxTruck'){
    const base=1.13,h=s.height-base;block(g,m.cargo,w-.04,h,cargoLen,0,base+h/2,cargoZ,.055);
    for(const side of [-1,1]){for(let z=cargoStart+.18;z<cargoEnd;z+=.38)block(g,m.chrome,.025,h-.16,.025,side*w*.497,base+h/2,z,.004);block(g,m.chrome,.06,.10,cargoLen,side*w*.49,base,cargoZ,.01);tube(g,m.chrome,[side*w*.45,.65,cargoStart+.3],[side*w*.45,.65,cargoEnd-.2],.038);}
    for(const side of [-1,1]){block(g,m.trim,w*.48,h-.12,.025,side*w*.245,base+h/2,cargoStart-.03,.008);for(const x of [.12,w*.38])tube(g,m.chrome,[side*x,base+.1,cargoStart-.06],[side*x,s.height-.1,cargoStart-.06],.014);}
  }else if(type==='damkar'){
    block(g,m.paint,w,1.72,cargoLen,0,1.93,cargoZ,.08);for(const side of [-1,1])for(let k=0;k<4;k++){block(g,m.chrome,.035,1.22,cargoLen/4-.09,side*(w/2+.01),1.94,cargoStart+(k+.5)*cargoLen/4,.014);for(let j=0;j<9;j++)block(g,m.trim,.041,.008,cargoLen/4-.11,side*(w/2+.015),1.43+j*.12,cargoStart+(k+.5)*cargoLen/4,.002);}
    for(const side of [-1,1])tube(g,m.chrome,[side*.35,2.9,-F+.3],[side*.35,2.9,F-.8],.045);for(let z=-F+.35;z<F-.8;z+=.35)tube(g,m.chrome,[-.35,2.9,z],[.35,2.9,z],.02);
    for(const side of [-1,1])for(let k=0;k<3;k++){const coil=geometry('hose',()=>new THREE.TorusGeometry(.24,.045,8,24));const h=mesh(g,coil,m.trim,side*(w/2+.055),2,cargoStart+.6+k*.55);h.rotation.y=Math.PI/2;}
  }else{
    block(g,m.chrome,w,.13,cargoLen,0,1.06,cargoZ,.025);for(const side of [-1,1])tube(g,m.chrome,[side*w*.47,1.15,cargoStart],[side*w*.47,1.15,cargoEnd],.04);block(g,m.trim,.55,.55,.45,0,1.4,cargoEnd-.35,.08);
    for(const side of [-1,1])tube(g,m.chrome,[side*.3,1.1,cargoEnd-.4],[side*.3,2.7,cargoEnd-.1],.06);
  }
  for(const side of [-1,1])block(g,m.tail,.26,.15,.04,side*w*.38,1.1,-F-.015,.02);block(g,m.plate,.48,.14,.025,0,.82,-F-.04,.008);
}
export function buildRoadVehicle(type,{paint,glass,head,tail,chrome,grille,plate,cargo=paint},variant=null){
  const m={paint,glass,head,tail,chrome,grille,plate,cargo,trim,fabric};if(type==='moto'){const v=motorcycle(m);v.realistic=v.detailed=true;return v;}
  let key=type==='car'?variant||'sedan':type==='police'||type==='taxi'?'sedan':type==='ambulance'?'van':type==='truck'?variant||'truck':type;
  const s=VEHICLE_DIMENSIONS[key]||VEHICLE_DIMENSIONS.sedan,g=new THREE.Group(),commercialType=['truck','boxTruck','damkar','derek'].includes(key);
  if(commercialType)commercial(g,s,m,key);else{mesh(g,bodyGeometry(s),paint);cabin(g,s,m);passengerDetails(g,s,m,type);
    if(type==='angkot'||type==='van'||type==='ambulance'||type==='bus'){
      // Interior benches / passenger seats and individual window frames.
      const rows=type==='bus'?9:type==='angkot'?3:4;for(let k=0;k<rows;k++)for(const side of [-1,1]){const z=s.rear+.4+(s.front-s.rear-.9)*k/rows;block(g,fabric,.42,.16,.40,side*s.width*.25,s.belt-.35,z,.05);block(g,fabric,.42,.42,.10,side*s.width*.25,s.belt-.12,z-.18,.04);}
      if(type==='angkot'){block(g,chrome,s.width+.02,.07,s.length-.2,0,1.02,0,.008);block(g,trim,.035,.98,.74,-s.width/2-.012,.81,-.3,.014);block(g,silver,.34,.10,.84,-s.width/2-.07,.27,-.3,.018);}
      if(type==='bus')for(const side of [-1,1]){block(g,chrome,.02,.07,s.length-.6,side*s.width*.5,1.33,0,.006);for(let k=0;k<6;k++)block(g,trim,.01,.01,.65,side*s.width*.5,1.02,-4.5+k*.16,.002);}
    }
  }
  const wheelWidth=s.length>7?.32:type==='angkot'?.19:.23,wh=[];for(const a of s.axles)for(const side of [-1,1])wh.push(wheel(g,s.r,wheelWidth,side*(s.width/2-wheelWidth*.48),a,s.length>7));
  const result={g,wh,len:s.length,r:s.r,type,v0:type==='angkot'?15:type==='truck'?21:25,realistic:true,detailed:true,dimensions:s};g.userData.modelType=key;return result;
}
