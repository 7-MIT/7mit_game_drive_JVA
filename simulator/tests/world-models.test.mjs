// Optional 3D geometry regression suite: install three@0.160.0 locally to run.
import {test} from 'node:test';
import assert from 'node:assert/strict';
let THREE,models,humans,architecture;
try{THREE=await import('three');models=await import('../road-vehicle-models.js');humans=await import('../human-model.js');architecture=await import('../architecture-models.js');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const modelTest=(name,fn)=>test(name,{skip:!THREE},fn);
const styles=()=>{const m=new THREE.MeshStandardMaterial({color:0x9a2927,side:THREE.DoubleSide});return {paint:m,glass:m,head:m,tail:m,chrome:m,grille:m,plate:m,cargo:m};};
const triangles=g=>{let n=0;g.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});return n;};
modelTest('all road-vehicle families have finite geometry, grounded round wheels and realistic metre-scale bounds',()=>{
 for(const type of ['car','suv','pickup','moto','van','angkot','bus','truck','damkar','derek','taxi','police','ambulance']){
  const materials=styles(),v=models.buildRoadVehicle(type,materials),bounds=new THREE.Box3().setFromObject(v.g),size=bounds.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.z-v.len)<.3,type+' length');assert.ok(size.y>=v.dimensions.height-.15&&size.y<v.dimensions.height+.25,type+' height');assert.ok(bounds.min.y>-.09,type+' ground');assert.ok(triangles(v.g)<85000,type+' geometry budget');
  if(type!=='moto'){const glazing=[];v.g.traverse(o=>{if(o.isMesh&&o.geometry.userData.keep&&o.geometry.attributes.position.count===81)glazing.push(o);});assert.ok(glazing.length>3,type+' glazing panels');assert.ok(glazing.every(o=>o.material===materials.glass),type+' glazing material');}
  assert.equal(v.wh.length,type==='moto'?2:type==='bus'||type==='damkar'||type==='derek'?6:type==='truck'?8:4);
  for(const w of v.wh){assert.equal(w.userData.realWheel,true);assert.equal(w.position.y,v.r);assert.ok(w.geometry.attributes.color);}
  v.g.traverse(o=>{if(!o.isMesh)return;for(const attr of ['position','normal'])for(const n of o.geometry.attributes[attr].array)assert.ok(Number.isFinite(n),type+' finite '+attr);});
 }
});
modelTest('vehicle silhouette variants retain different wheelbases and reuse immutable wheel geometry',()=>{
 const sedan=models.buildRoadVehicle('car',styles(),'sedan'),hatch=models.buildRoadVehicle('car',styles(),'hatch'),mpv=models.buildRoadVehicle('car',styles(),'mpv'),other=models.buildRoadVehicle('car',styles(),'sedan');assert.ok(hatch.len<sedan.len);assert.ok(mpv.dimensions.height>sedan.dimensions.height);assert.equal(sedan.wh[0].geometry,other.wh[0].geometry);assert.equal(sedan.wh[0].geometry.userData.keep,true);
});
modelTest('human skeleton preserves adult scale, separate knees, walking arms and seated/riding poses',()=>{
 const p=humans.buildHuman(),size=new THREE.Box3().setFromObject(p.g).getSize(new THREE.Vector3());assert.ok(size.y>1.65&&size.y<1.85);assert.equal(p.legs.length,2);assert.equal(p.arms.length,2);assert.equal(p.knees.length,2);p.legs[0].rotation.x=.4;p.arms[1].rotation.x=-1;assert.ok(p.g.userData.realisticHuman);for(const pose of ['seated','riding']){const a=humans.buildHuman({pose});assert.ok(a.legs[0].rotation.x< -1);assert.ok(a.knees[0].rotation.x>1);}
});
modelTest('houses, shops, towers and warehouses batch by material and dispose only temporary geometry',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},set fillStyle(v){}})})};try{const root=new THREE.Group();architecture.buildArchitecture(root,[{x:15,z:0,d:8,w:9,h:3.2,type:'house'},{x:16,z:15,d:10,w:12,h:7,type:'shop'},{x:90,z:50,d:18,w:20,h:33,type:'tower'},{x:45,z:-20,d:30,w:40,h:9,type:'warehouse'}]);assert.ok(root.children.length<=7);assert.ok(root.children.every(m=>m.userData.realisticArchitecture));assert.ok(triangles(root)>100);for(const m of root.children){assert.ok(m.geometry.attributes.uv);if(m.material.vertexColors)assert.ok(m.geometry.attributes.color);for(const n of m.geometry.attributes.position.array)assert.ok(Number.isFinite(n));if(m.material.map)assert.equal(m.material.map.userData.keep,true);}}finally{globalThis.document=old;}
});
