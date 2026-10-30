import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DELIVERY_JOBS, planDelivery} from '../service-delivery.js';
import {NODES, DELIVERY_FACILITIES, CORR, findRoute, buildTrip, straightOf} from '../network.js';
import {buildRoadVehicle} from '../road-vehicle-models.js';
import * as THREE from 'three';

test('nearest SPPG serves three distinct schools and nearest cooperative serves two distribution destinations',()=>{
  const here=NODES.get('N:Jakarta');
  for(const kind of ['mbg','kopdes']){
    const stops=planDelivery(kind,here,DELIVERY_FACILITIES);
    assert.equal(stops.length,DELIVERY_JOBS[kind].count+1);
    assert.equal(stops[0].kind,'pick');assert.equal(stops[0].type,DELIVERY_JOBS[kind].source);
    const dist=f=>Math.hypot(f.lat-here.lat,(f.lon-here.lon)*Math.cos((f.lat+here.lat)*Math.PI/360));
    for(const f of DELIVERY_FACILITIES.filter(f=>f.type===stops[0].type))assert.ok(dist(stops[0])<=dist(f));
    assert.equal(new Set(stops.map(s=>s.key)).size,stops.length);
    for(const stop of stops.slice(1)){assert.equal(stop.kind,'drop');assert.equal(stop.type,DELIVERY_JOBS[kind].target);assert.equal(stop.townKey,stops[0].townKey);}
    for(let i=0;i<stops.length;i++){
      const from=i?stops[i-1].key:here.key;
      const route=findRoute(from,stops[i].key,'mix');assert.ok(route?.length);
      for(const leg of route)assert.ok(CORR[leg.c]);
      const trip=buildTrip(from,stops[i].key);assert.equal(trip.ev[trip.destIdx].key,stops[i].key);
    }
  }
});
test('inaccessible depots are excluded and invalid coordinates do not invent a manifest',()=>{
  const here=NODES.get('N:Jakarta'),first=planDelivery('mbg',here,DELIVERY_FACILITIES);
  const second=planDelivery('mbg',here,DELIVERY_FACILITIES,key=>key!==first[0].key);
  assert.notEqual(first[0].key,second[0].key);
  assert.equal(planDelivery('mbg',here,DELIVERY_FACILITIES,()=>false),null);
  assert.equal(planDelivery('mbg',{},DELIVERY_FACILITIES),null);
});
test('normal free driving continues on public roads instead of entering a service driveway',()=>{
  const e=straightOf('N:Jakarta','N:Tangerang',null);
  assert.ok(e);assert.ok(!CORR[e.c].serviceAccess);
});
test('MBG van and Kopdes box truck retain distinct dimensions, liveries and grounded wheels',()=>{
  const old=globalThis.document,labels=[];
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(t){labels.push(t);}})})};
  try{
    const m=new THREE.MeshStandardMaterial(),materials={paint:m,glass:m,head:m,tail:m,chrome:m,grille:m,plate:m,cargo:m};
    const mbg=buildRoadVehicle('mbg',materials),kopdes=buildRoadVehicle('kopdes',materials);
    assert.equal(mbg.type,'mbg');assert.equal(mbg.g.userData.modelType,'van');assert.equal(mbg.len,5.4);
    assert.equal(kopdes.type,'kopdes');assert.equal(kopdes.g.userData.modelType,'boxTruck');assert.equal(kopdes.len,8.2);
    for(const v of [mbg,kopdes]){
      assert.equal(v.wh.length,4);assert.ok(new THREE.Box3().setFromObject(v.g).min.y>-.09);
      assert.equal(v.g.children.filter(m=>m.geometry?.type==='PlaneGeometry'&&m.material.map).length,2);
      v.g.traverse(o=>{if(o.isMesh)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});
    }
    assert.ok(labels.includes('MAKAN BERGIZI GRATIS'));assert.ok(labels.includes('KOPDES'));
  }finally{globalThis.document=old;}
});

test('delivery requires a stationary roadside stop, keeps missed destinations fixed, and pays only after unloading',async()=>{
 const {readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
 const source=readFileSync(new URL('../main.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('function deliveryTick(dt){'),source.indexOf('function jobStart(k){'));
 const route=[],paid=[],rated=[];
 const context={PLR:{sd:1,p:100,vel:4,x:-8},EV:route,foot:null,tow:null,trip:{destIdx:0},
   job:{J:DELIVERY_JOBS.mbg,stops:[{key:'sppg',name:'SPPG',kind:'pick',u:100},{key:'sd',name:'SD',kind:'drop',u:300},{key:'smp',name:'SMP',kind:'drop',u:500},{key:'sma',name:'SMA',kind:'drop',u:700}],i:0,route,hold:0,earned:0,lastRK:1,deliveryKm:0},
   uOfV:p=>p.sd*p.p,rkAt:u=>u/100,eAt:()=>8,LW:3.6,toast(){},jobUI(){},jobStars:()=>5,
   CAR:{ev:{job:s=>rated.push(s)}},earn:n=>paid.push(n),rp$:String,
   deliveryNavigate(){context.job.hold=0;return true;},jobStop(){context.job=null;}};
 runInNewContext(fn,context);
 context.deliveryTick(2);assert.equal(context.job.i,0,'moving vehicles cannot collect food');
 context.PLR.vel=0;context.PLR.p=400;context.deliveryTick(2);
 assert.equal(context.job.stops[0].u,100,'passing a facility must not relocate it');assert.equal(context.job.i,0);
 context.PLR.p=100;context.PLR.x=0;context.deliveryTick(2);assert.equal(context.job.i,0,'must pull over');
 context.PLR.x=-8;context.deliveryTick(1);assert.equal(context.job.i,0);
 context.deliveryTick(.6);assert.equal(context.job.i,1);assert.equal(paid.length,0,'pickup pays nothing');
 for(const p of [300,500,700]){context.PLR.p=p;context.deliveryTick(1.6);}
 assert.equal(context.job,null);assert.equal(paid.length,3);assert.equal(rated.length,3);
 assert.ok(paid.every(n=>n>=3000000));
});

test('boulevard and service driveway lane counts are fixed independently of the general lane setting',async()=>{
 const {readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
 const source=readFileSync(new URL('../main.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('const nCorr ='),source.indexOf('\n',source.indexOf('const nCorr =')));
 for(const lanes of ['auto','1','5']){
   const ctx={CORR,cfg:{lanes}};
   runInNewContext(fn+'\nglobalThis.nCorr=nCorr;',ctx);
   assert.equal(ctx.nCorr('jumay-boulevard-jakarta'),3);
   assert.equal(ctx.nCorr('delivery-N:Jakarta-0'),1);
 }
});
