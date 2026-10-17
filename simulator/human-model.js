import * as THREE from 'three';
import {geometry,rounded,mesh,block,ellipsoid,tube} from './model-primitives.js';
// Adult proportions in metres. The same articulated skeleton serves walkers,
// collision NPCs, seated drivers and motorcycle riders.
export const HUMAN_DIMENSIONS=Object.freeze({height:1.76,shoulders:.44,hips:.30,headHeight:.24,thigh:.43,shin:.43});
const shared=new Map();const material=(color,roughness=.88)=>{const key=color+':'+roughness;if(!shared.has(key))shared.set(key,new THREE.MeshStandardMaterial({color,roughness}));return shared.get(key);};
export function humanHead(parent,{skin=material(0xbb805b),hair=material(0x241a14),helmet=null}={}){
  const g=new THREE.Group();parent.add(g);
  ellipsoid(g,skin,[0,0,0],[.083,.117,.093]);ellipsoid(g,skin,[0,-.049,.023],[.065,.06,.077]);
  for(const side of [-1,1]){ellipsoid(g,skin,[side*.083,-.005,0],[.017,.03,.018]);
    ellipsoid(g,material(0xeaded1),[side*.031,.015,.083],[.018,.008,.009]);ellipsoid(g,material(0x28231e),[side*.031,.015,.091],[.006,.006,.003]);
    tube(g,hair,[side*.015,.035,.089],[side*.048,.034,.079],.0035);}
  ellipsoid(g,skin,[0,-.009,.095],[.013,.022,.018]);ellipsoid(g,material(0x80534a),[0,-.049,.104],[.025,.004,.004]);
  const cap=mesh(g,geometry('haircap',()=>new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI*.55)),hair,0,.022,-.008);cap.scale.set(.087,.103,.093);
  if(helmet){const shell=mesh(g,geometry('helmet',()=>new THREE.SphereGeometry(1,28,16,0,Math.PI*2,0,Math.PI*.75)),helmet,0,.016,-.006);shell.scale.set(.106,.129,.111);const visor=material(0x263f49,.16);ellipsoid(g,visor,[0,.006,.093],[.094,.052,.04]);tube(g,material(0x202126),[-.08,-.03,.01],[0,-.102,.036],.008);tube(g,material(0x202126),[.08,-.03,.01],[0,-.102,.036],.008);}
  return g;
}
export function buildHuman({shirt=0x365875,pants=0x303740,skin=0xbb805b,hair=0x241a14,helmet=null,pose='standing'}={}){
  const cloth=typeof shirt==='number'?material(shirt):shirt,trouser=typeof pants==='number'?material(pants):pants,flesh=typeof skin==='number'?material(skin):skin,hairMat=typeof hair==='number'?material(hair):hair,shoe=material(0x242321),g=new THREE.Group();
  const torso=mesh(g,geometry('human-torso-v2',()=>{const sections=[[.98,.14,.105],[1.06,.145,.11],[1.18,.16,.115],[1.31,.19,.12],[1.42,.205,.105],[1.48,.17,.08],[1.50,.08,.055]],p=[],uv=[],idx=[],n=24;for(let j=0;j<sections.length;j++){const[y,w,d]=sections[j];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;p.push(Math.cos(a)*w,y,Math.sin(a)*d);uv.push(i/n,j/(sections.length-1));}}for(let j=0;j<sections.length-1;j++)for(let i=0;i<n;i++){const k=j*(n+1)+i;idx.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;}),cloth);
  for(let k=0;k<3;k++)ellipsoid(g,material(0xb9b8b2),[0,1.39-k*.055,.122],[.004,.004,.003]);
  block(g,trouser,.30,.17,.21,0,.965,0,.065);tube(g,flesh,[0,1.47,0],[0,1.585,.005],.047);
  const head=humanHead(g,{skin:flesh,hair:hairMat,helmet});head.position.set(0,1.637,.012);
  // Collar and sleeves define clothing independently of the body silhouette.
  for(const side of [-1,1])tube(g,material(0xd9d5cb),[side*.055,1.495,.11],[side*.025,1.452,.122],.008);
  const legs=[],arms=[],knees=[];
  for(const side of [-1,1]){
    const hip=new THREE.Group();hip.position.set(side*.088,.95,0);g.add(hip);legs.push(hip);
    tube(hip,trouser,[0,0,0],[0,-.42,.016],.073,.055,14);ellipsoid(hip,trouser,[0,-.43,.016],[.057,.061,.061]);
    const knee=new THREE.Group();knee.position.set(0,-.43,.016);hip.add(knee);knees.push(knee);tube(knee,trouser,[0,0,0],[0,-.36,-.008],.052,.035,14);tube(knee,flesh,[0,-.34,-.008],[0,-.40,-.005],.032);
    const foot=block(knee,shoe,.102,.075,.255,0,-.435,.061,.036);block(knee,material(0x55544e),.105,.018,.258,0,-.467,.061,.008);
    const shoulder=new THREE.Group();shoulder.position.set(side*.204,1.445,0);g.add(shoulder);arms.push(shoulder);
    ellipsoid(shoulder,cloth,[side*.009,-.035,0],[.068,.09,.085]);tube(shoulder,cloth,[side*.015,-.04,0],[side*.029,-.21,.006],.062,.045,14);
    tube(shoulder,flesh,[side*.029,-.20,.006],[side*.022,-.47,.034],.043,.027,14);ellipsoid(shoulder,flesh,[side*.019,-.515,.041],[.034,.065,.022]);
    for(let n=0;n<4;n++)tube(shoulder,flesh,[side*.019+(n-1.5)*.012,-.54,.043],[side*.019+(n-1.5)*.012,-.582+(n===0||n===3?.012:0),.05],.0055);
    tube(shoulder,flesh,[side*.04,-.50,.043],[side*.057,-.532,.067],.008);
    if(pose!=='standing'){hip.rotation.x=pose==='riding'?-1.15:-Math.PI/2;knee.rotation.x=pose==='riding'?1.45:Math.PI/2;shoulder.rotation.x=pose==='riding'?-.98:-.85;if(pose==='riding')shoulder.position.z=.12;shoulder.rotation.z=-side*.1;}
  }
  g.userData.realisticHuman=true;g.userData.pose=pose;return {g,legs,arms,knees,head,torso};
}
