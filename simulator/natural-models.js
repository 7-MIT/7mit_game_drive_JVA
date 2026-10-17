import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Reusable organic crowns, still instanced by the world builder.
export function foliageGeometry(kind='broadleaf'){
  const lobes=kind==='conifer'?[[0,3.3,0,1.7,1.2,1.6],[.1,4.3,0,1.4,1.1,1.3],[-.1,5.2,.1,1.0,1.0,1.0],[0,6,0,.55,.85,.55]]:[[0,4.1,0,1.9,1.4,1.7],[-1.1,3.7,.3,1.4,1.2,1.4],[1.1,4.1,-.2,1.5,1.3,1.2],[.2,4.5,1,1.5,1.1,1.3],[-.4,5,-.4,1.5,1.3,1.4],[.3,3.8,-1.1,1.5,1.1,1.1]];
  const parts=lobes.map(([x,y,z,sx,sy,sz],j)=>{const g=new THREE.SphereGeometry(1,12,8),p=g.attributes.position,col=[];for(let i=0;i<p.count;i++){const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),noise=1+.09*Math.sin(px*11+pz*13+j*7)*Math.sin(py*9+j);p.setXYZ(i,x+px*sx*noise,y+py*sy*noise,z+pz*sz*noise);const light=.72+.18*(py+1)/2;col.push(light*.92,light,light*.84);}g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();return g;});const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());g.userData.keep=true;return g;
}
export function shrubGeometry(){const g=new THREE.SphereGeometry(.7,14,9),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+.07*Math.sin(x*19+z*17)*Math.sin(y*14);p.setXYZ(i,x*n,.60+y*.8*n,z*n);}g.computeVertexNormals();g.userData.keep=true;return g;}
