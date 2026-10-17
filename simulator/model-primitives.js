import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const cache=new Map();
export function geometry(key,build){if(!cache.has(key)){const g=build();g.userData.keep=true;cache.set(key,g);}return cache.get(key);}
export function rounded(w,h,d,r=.04){return geometry(`round:${w}:${h}:${d}:${r}`,()=>new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)));}
export function mesh(parent,geo,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
export function block(parent,mat,w,h,d,x,y,z,r=.03){return mesh(parent,rounded(w,h,d,r),mat,x,y,z);}
export function ellipsoid(parent,mat,p,size){const m=mesh(parent,geometry('sphere20',()=>new THREE.SphereGeometry(1,20,12)),mat,...p);m.scale.set(...size);return m;}
export function tube(parent,mat,a,b,r=.02,r2=r,segments=10){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av),m=mesh(parent,geometry(`tube:${r}:${r2}:${segments}`,()=>new THREE.CylinderGeometry(r2,r,1,segments)),mat);m.position.copy(av.add(bv).multiplyScalar(.5));m.scale.y=delta.length();m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
export function panel(parent,mat,points,bulge=0){const key='panel:'+points.flat().join(',')+':'+bulge;return mesh(parent,geometry(key,()=>{const pos=[],uv=[],indices=[],n=8,a=new THREE.Vector3(...points[0]),b=new THREE.Vector3(...points[1]),c=new THREE.Vector3(...points[2]),d=new THREE.Vector3(...points[3]);
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const u=i/n,v=j/n,p=a.clone().lerp(b,u).lerp(d.clone().lerp(c,u),v);p.y+=Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*bulge;pos.push(p.x,p.y,p.z);uv.push(u,v);}
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=j*(n+1)+i;indices.push(k,k+1,k+n+2,k,k+n+2,k+n+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;}),mat);}
