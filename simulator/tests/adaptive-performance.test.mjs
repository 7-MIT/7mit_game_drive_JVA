import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialQuality,qualityProfile,createQualityGovernor,createSimulationClock} from '../adaptive-performance.js';
function run(g,fps,seconds){for(let i=0;i<fps*seconds;i++)g.sample(1/fps);}
test('device hints choose conservative starting quality without requiring browser-only APIs',()=>{
 assert.equal(initialQuality(),0);assert.equal(initialQuality({mobile:true}),2);assert.equal(initialQuality({memory:2}),3);
 for(let i=0;i<=5;i++){const p=qualityProfile(i);assert.ok(p.scale>0&&p.scale<=1);if(i)assert.ok(p.scale<=qualityProfile(i-1).scale);}
});
test('sustained slow rendering degrades quality and long recovery restores it without oscillation',()=>{
 const g=createQualityGovernor(0);g.sample(2);run(g,60,3);assert.equal(g.state.level,0);
 run(g,20,4);assert.equal(g.state.level,1);run(g,60,5);assert.equal(g.state.level,1);run(g,60,9);assert.equal(g.state.level,0);
 g.reset(5);run(g,20,20);assert.equal(g.state.level,5);g.reset(0);assert.equal(g.state.level,0);
});
test('fixed integration covers the same game time at 30, 60 and 120 Hz and bounds resume work',()=>{
 for(const fps of [30,60,120]){const clock=createSimulationClock();let time=0,steps=0;for(let i=0;i<fps*5;i++)clock.advance(1/fps,dt=>{time+=dt;steps++;});assert.ok(Math.abs(time-5)<1e-8);assert.equal(steps,300);}
 const clock=createSimulationClock();let time=0;assert.equal(clock.advance(10,dt=>time+=dt),4);assert.ok(time<.07);clock.reset();assert.equal(clock.advance(0,()=>{}),0);
});
let THREE,models,lods;
try{THREE=await import('three');models=await import('../road-vehicle-models.js');lods=await import('../vehicle-lod.js');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const count=g=>{let n=0;g.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return n;};
test('distant vehicles reduce triangles, retain dimensions and leave original meshes immutable',{skip:!THREE},()=>{
 const mat=new THREE.MeshStandardMaterial(),styles={paint:mat,glass:mat,head:mat,tail:mat,chrome:mat,grille:mat,plate:mat,cargo:mat};
 for(const type of ['car','moto','bus','truck','angkot']){
  const v=models.buildRoadVehicle(type,styles),full=count(v.g),original=v.wh[0].geometry,positions=original.attributes.position.array.slice();
  lods.attachVehicleLOD(v);const [near,far]=v.distanceLOD.levels.map(l=>l.object);assert.equal(count(near),full);assert.ok(count(far)<full*.5,type+' reduction');
  const a=new THREE.Box3().setFromObject(near),b=new THREE.Box3().setFromObject(far);assert.ok(a.min.distanceTo(b.min)<.18&&a.max.distanceTo(b.max)<.18,type+' silhouette');
  assert.deepEqual(original.attributes.position.array,positions);assert.equal(lods.clusterGeometry(original,.18),lods.clusterGeometry(original,.18));
  lods.setVehicleLOD(v,35);const cam=new THREE.PerspectiveCamera();cam.position.z=150;cam.updateMatrixWorld();v.g.updateMatrixWorld();v.distanceLOD.update(cam);assert.equal(near.visible,false);assert.equal(far.visible,true);
  cam.position.z=10;cam.updateMatrixWorld();v.distanceLOD.update(cam);assert.equal(near.visible,true);assert.equal(far.visible,false);
  far.traverse(o=>{if(o.isMesh){assert.equal(o.geometry.userData.keep,true);for(const x of o.geometry.attributes.position.array)assert.ok(Number.isFinite(x));}});
 }
});
test('distant batching reduces draw calls while preserving paint, glass and emissive lights',{skip:!THREE},()=>{
 const paint=new THREE.MeshPhysicalMaterial({color:0x2345ab});paint.userData.own=true;
 const trim=new THREE.MeshStandardMaterial({color:0x333333}),glass=new THREE.MeshPhysicalMaterial({transparent:true,opacity:.8}),head=new THREE.MeshStandardMaterial({emissive:0xffffff,emissiveIntensity:2});
 const v=models.buildRoadVehicle('car',{paint,glass,head,tail:head,chrome:trim,grille:trim,plate:trim,cargo:trim});lods.attachVehicleLOD(v);
 const near=v.distanceLOD.levels[0].object,far=v.distanceLOD.levels[1].object,parts=g=>{const a=[];g.traverse(o=>{if(o.isMesh)a.push(o);});return a;};
 assert.ok(parts(far).length<parts(near).length/2);for(const m of [paint,glass,head,lods.distantOpaqueMaterial])assert.ok(parts(far).some(o=>o.material===m));
});
