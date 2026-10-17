import * as THREE from 'three';
import {BICYCLE} from './vehicle-dynamics.js';

// A full-size diamond-frame city bicycle, articulated rider and insulated bag.
export function buildBicycle({paint,tyre,metal,dark,head,tail}){
  const g=new THREE.Group(),wheels=[],bones=[],frontZ=0.56,rearZ=-0.56,r=BICYCLE.wheelRadius;
  const cylinder=new THREE.CylinderGeometry(1,1,1,10),sphere=new THREE.SphereGeometry(1,12,8);
  const cloth=new THREE.MeshStandardMaterial({color:0x1b695c,roughness:0.88}),pants=new THREE.MeshStandardMaterial({color:0x263445,roughness:0.95}),skin=new THREE.MeshStandardMaterial({color:0xba805c,roughness:0.9});
  for(const m of [cloth,pants,skin])m.userData.own=true;
  // Shapes share geometry inside this model; killVehicle disposes them on removal.
  function tube(parent,a,b,radius,mat){const mesh=new THREE.Mesh(cylinder,mat);parent.add(mesh);poseTube(mesh,a,b,radius);mesh.castShadow=true;return mesh;}
  function ball(parent,p,radius,mat){const mesh=new THREE.Mesh(sphere,mat);mesh.position.set(...p);mesh.scale.setScalar(radius);mesh.castShadow=true;parent.add(mesh);return mesh;}
  function box(parent,size,p,mat){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);mesh.position.set(...p);mesh.castShadow=true;parent.add(mesh);return mesh;}
  const rear=[0,r,rearZ],bb=[0,0.35,-0.08],seat=[0,0.97,-0.25],neck=[0,1.02,0.36],fork=[0,r,frontZ];
  for(const [a,b] of [[rear,bb],[bb,seat],[seat,rear],[seat,neck],[neck,bb]])tube(g,a,b,0.026,paint);
  for(const side of [-1,1]){tube(g,[side*0.045,r,rearZ],[side*0.045,seat[1],seat[2]],0.014,paint);tube(g,[side*0.045,r,rearZ],[side*0.045,bb[1],bb[2]],0.014,paint);tube(g,[side*0.045,r+0.04,rearZ],[side*0.045,bb[1]+0.04,bb[2]],0.006,dark);}
  tube(g,seat,[0,1.05,-0.27],0.018,metal);box(g,[0.19,0.045,0.27],[0,1.06,-0.29],dark);
  const steer=new THREE.Group();steer.position.set(...neck);g.add(steer);
  for(const side of [-1,1]){tube(steer,[side*0.055,-0.04,0],[side*0.055,r-neck[1],frontZ-neck[2]],0.017,metal);tube(steer,[0,0.02,0],[side*0.29,0.08,0.04],0.014,metal);tube(steer,[side*0.23,0.08,0.04],[side*0.34,0.08,0.04],0.02,dark);}
  ball(steer,[0.12,0.1,0.04],0.025,metal);tube(g,[0.04,0.94,0.34],[0.04,0.42,0.54],0.004,dark);
  const tyreGeo=new THREE.TorusGeometry(r-0.018,0.018,8,40);tyreGeo.rotateY(Math.PI/2);
  const rimGeo=new THREE.TorusGeometry(r-0.035,0.008,6,40);rimGeo.rotateY(Math.PI/2);
  for(const z of [frontZ,rearZ]){const w=new THREE.Group();w.position.set(0,r,z);g.add(w);wheels.push(w);
    const t=new THREE.Mesh(tyreGeo,tyre),rim=new THREE.Mesh(rimGeo,metal);w.add(t,rim);t.castShadow=true;
    tube(w,[-0.06,0,0],[0.06,0,0],0.023,metal);
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2;tube(w,[i%2?0.018:-0.018,0,0],[0,Math.sin(a)*(r-0.035),Math.cos(a)*(r-0.035)],0.0025,metal);}
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.006,20),metal);disc.rotation.z=Math.PI/2;disc.position.x=0.032;w.add(disc);
  }
  const crank=new THREE.Group();crank.position.set(...bb);g.add(crank);
  tube(crank,[-0.11,0,0],[0.11,0,0],0.018,metal);
  for(const side of [-1,1]){tube(crank,[side*0.1,0,0],[side*0.1,0,side*0.16],0.014,metal);box(crank,[0.12,0.025,0.07],[side*0.14,0,side*0.16],dark);}
  const chainring=new THREE.Mesh(new THREE.CylinderGeometry(0.105,0.105,0.009,24),metal);chainring.rotation.z=Math.PI/2;chainring.position.set(0.085,0.35,-0.08);g.add(chainring);
  tube(g,[0.09,0.44,-0.08],[0.09,r+0.055,rearZ],0.005,dark);tube(g,[0.09,0.25,-0.08],[0.09,r-0.055,rearZ],0.005,dark);
  for(const side of [-1,1])tube(g,[side*0.09,r,rearZ],[side*0.14,0.81,-0.58],0.012,metal);
  box(g,[0.32,0.025,0.42],[0,0.82,-0.56],metal);
  const bag=box(g,[0.42,0.47,0.39],[0,1.07,-0.62],cloth);bag.visible=false;box(bag,[0.43,0.025,0.4],[0,0.17,0],dark);
  // Torso and helmet use curved surfaces, arms and legs have real joints.
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(0.15,0.34,5,12),cloth);torso.position.set(0,1.29,-0.12);torso.rotation.x=0.32;g.add(torso);torso.castShadow=true;
  ball(g,[0,1.67,0.02],0.115,skin);const helmet=ball(g,[0,1.74,0],0.132,paint);helmet.scale.y*=0.72;
  for(const side of [-1,1]){const shoulder=[side*0.16,1.42,-0.05],elbow=[side*0.22,1.15,0.12],hand=[side*0.3,1.1,0.4];tube(g,shoulder,elbow,0.046,cloth);tube(g,elbow,hand,0.033,skin);ball(g,hand,0.038,dark);
    bones.push({side,hip:[side*0.1,1.02,-0.28],thigh:tube(g,[0,0,0],[0,1,0],0.06,pants),shin:tube(g,[0,0,0],[0,1,0],0.045,pants),shoe:box(g,[0.1,0.06,0.2],[0,0,0],dark)});
  }
  box(steer,[0.09,0.05,0.05],[0,0.04,0.07],head);box(g,[0.08,0.04,0.04],[0,0.84,-0.78],tail);
  const bicycle={steer,crank,bag,bones,phase:0};animateBicycle(bicycle,0,0,0,false);
  return {g,wh:wheels,front:[wheels[0]],len:1.9,r,v0:BICYCLE.cruise,type:'bicycle',lights:null,lampM:null,bicycle};
}
const up=new THREE.Vector3(0,1,0),va=new THREE.Vector3(),vb=new THREE.Vector3();
function poseTube(mesh,a,b,radius){va.set(...a);vb.set(...b).sub(va);mesh.position.copy(va).addScaledVector(vb,0.5);mesh.scale.set(radius,Math.max(0.001,vb.length()),radius);mesh.quaternion.setFromUnitVectors(up,vb.normalize());}
export function animateBicycle(bike,speed,pedal,dt,delivery){
  if(!bike)return;bike.phase+=Math.max(0,pedal)*Math.min(10,2+Math.abs(speed))*dt;bike.crank.rotation.x=bike.phase;bike.bag.visible=delivery;
  for(const leg of bike.bones){const a=bike.phase+(leg.side<0?Math.PI:0),foot=[leg.side*0.14,0.35-Math.sin(a)*0.16,-0.08+Math.cos(a)*0.16],hip=leg.hip;
    const dy=foot[1]-hip[1],dz=foot[2]-hip[2],d=Math.max(0.01,Math.hypot(dy,dz)),reach=Math.min(0.8,d),bend=Math.sqrt(Math.max(0,0.42**2-(reach/2)**2));
    const knee=[leg.side*0.12,(hip[1]+foot[1])/2+dz/d*bend,(hip[2]+foot[2])/2-dy/d*bend];
    poseTube(leg.thigh,hip,knee,0.06);poseTube(leg.shin,knee,foot,0.045);leg.shoe.position.set(...foot);
  }
}

export function buildBicycleView(){
  const g=new THREE.Group(),bar=new THREE.Group();g.position.set(0,-0.22,-0.62);g.add(bar);
  const body=new THREE.MeshStandardMaterial({color:0x39424d,metalness:0.65,roughness:0.3}),grip=new THREE.MeshStandardMaterial({color:0x20242a,roughness:0.95});
  for(const side of [-1,1]){const handle=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.36,12),body);handle.rotation.z=Math.PI/2;handle.position.set(side*0.17,0.04,0);bar.add(handle);
    const rubber=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.12,12),grip);rubber.rotation.z=Math.PI/2;rubber.position.set(side*0.3,0.04,0);bar.add(rubber);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(0.04,12,8),grip);hand.position.set(side*0.28,0.05,0.018);bar.add(hand);
  }
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.3,12),body);stem.position.y=-0.1;bar.add(stem);
  const cv=document.createElement('canvas');cv.width=512;cv.height=160;const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
  const display=new THREE.Mesh(new THREE.PlaneGeometry(0.22,0.069),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));display.position.set(0,0.075,0.026);display.rotation.x=-0.25;bar.add(display);
  return {g,bar,body,cv,tex,t:0};
}
