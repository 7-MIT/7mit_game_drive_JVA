import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export const distantOpaqueMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:.15});
const batches=new Map();
const cache=new WeakMap();
// Vertex clustering keeps each vehicle's original contours and materials. Only
// triangles smaller than the distance-dependent grid are removed; the near mesh
// is never changed. UV seams and hard normals have separate vertex buckets.
export function clusterGeometry(source,cell){
  let variants=cache.get(source);if(!variants){variants=new Map();cache.set(source,variants);}if(variants.has(cell))return variants.get(cell);
  const p=source.attributes.position,n=source.attributes.normal,uv=source.attributes.uv,c=source.attributes.color,vertices=[],buckets=new Map(),remap=new Uint32Array(p.count);
  for(let i=0;i<p.count;i++){
    const key=[Math.round(p.getX(i)/cell),Math.round(p.getY(i)/cell),Math.round(p.getZ(i)/cell),n?Math.round(n.getX(i)):0,n?Math.round(n.getY(i)):0,n?Math.round(n.getZ(i)):0,uv?Math.round(uv.getX(i)):0,uv?Math.round(uv.getY(i)):0].join(',');
    let index=buckets.get(key);if(index===undefined){index=vertices.length;buckets.set(key,index);vertices.push({i,count:0,x:0,y:0,z:0});}const v=vertices[index];v.count++;v.x+=p.getX(i);v.y+=p.getY(i);v.z+=p.getZ(i);remap[i]=index;
  }
  const indices=[],seen=new Set(),count=source.index?.count??p.count;
  for(let i=0;i<count;i+=3){const a=remap[source.index?source.index.getX(i):i],b=remap[source.index?source.index.getX(i+1):i+1],d=remap[source.index?source.index.getX(i+2):i+2];if(a===b||b===d||d===a)continue;const k=[a,b,d].sort((a,b)=>a-b).join(',');if(seen.has(k))continue;seen.add(k);indices.push(a,b,d);}
  const g=new THREE.BufferGeometry(),pos=[],normals=[],uvs=[],colors=[];
  for(const v of vertices){pos.push(v.x/v.count,v.y/v.count,v.z/v.count);if(n)normals.push(n.getX(v.i),n.getY(v.i),n.getZ(v.i));if(uv)uvs.push(uv.getX(v.i),uv.getY(v.i));if(c)colors.push(c.getX(v.i),c.getY(v.i),c.getZ(v.i));}
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));if(n)g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));if(c)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeBoundingSphere();g.userData.keep=true;variants.set(cell,g);return g;
}
// Batch fixed opaque trim, tyres and occupants into one draw. Paint, glass and
// emissive lenses keep their own materials, so colours and lamps stay correct.
function batchDistant(root){
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),parts=[];
  root.traverse(o=>{if(o.isMesh&&!o.material.userData.own&&!o.material.transparent&&!(o.material.emissiveIntensity>0&&o.material.emissive?.getHex()))parts.push(o);});
  if(parts.length<2)return;
  const matrices=parts.map(o=>new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
  const key=parts.map((o,i)=>o.geometry.id+':'+o.material.color.getHex()+':'+matrices[i].elements.map(v=>v.toFixed(3)).join(',')).join('|');
  let geometry=batches.get(key);
  if(!geometry){const geos=parts.map((o,i)=>{const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(matrices[i]);const p=g.attributes.position,c=g.attributes.color,color=o.material.color,colors=[];for(let j=0;j<p.count;j++)colors.push(color.r*(o.material.vertexColors&&c?c.getX(j):1),color.g*(o.material.vertexColors&&c?c.getY(j):1),color.b*(o.material.vertexColors&&c?c.getZ(j):1));for(const a of Object.keys(g.attributes))if(!['position','normal'].includes(a))g.deleteAttribute(a);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.clearGroups();return g;});geometry=mergeGeometries(geos);geos.forEach(g=>g.dispose());geometry.userData.keep=true;batches.set(key,geometry);}
  for(const o of parts)o.parent.remove(o);root.add(new THREE.Mesh(geometry,distantOpaqueMaterial));
}
export function attachVehicleLOD(v){
  const root=v.g,near=new THREE.Group(),far=new THREE.Group(),lod=new THREE.LOD();
  const live=new Set([...(v.lights||[]),...Object.values(v.lampM||{})]);
  for(const o of [...root.children]){if(live.has(o))continue;near.add(o);const proxy=o.clone(true);proxy.traverse(m=>{if(!m.isMesh)return;m.geometry=clusterGeometry(m.geometry,.18);m.castShadow=false;});far.add(proxy);}
  if(!near.children.length)return;batchDistant(far);
  lod.addLevel(near,0);lod.addLevel(far,55,.12);root.add(lod);v.distanceLOD=lod;
}
export function setVehicleLOD(v,distance){if(v.distanceLOD)v.distanceLOD.levels[1].distance=distance;}
