import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BICYCLE,bicycleAcceleration,staminaStep,springStep,ackermannAngle,roadResistance,nonTollVehicle,FOOD_BICYCLE_JOB} from '../vehicle-dynamics.js';
import {RULES,CORR,findRoute,choicesAt} from '../network.js';

test('human-powered bicycle reaches a plausible flat-road speed and reacts to grade',()=>{
  let speed=0;for(let i=0;i<120*60;i++)speed=Math.max(0,speed+bicycleAcceleration({speed,pedal:1})/120);
  assert.ok(speed*3.6>25&&speed*3.6<40,speed*3.6);
  assert.ok(bicycleAcceleration({speed:7,pedal:1,grade:0.05})<bicycleAcceleration({speed:7,pedal:1}));
  assert.ok(bicycleAcceleration({speed:7,pedal:0,grade:-0.05})>0);
  assert.ok(bicycleAcceleration({speed:8,pedal:0})<0);
  assert.ok(bicycleAcceleration({speed:8,brake:1,wet:true})>bicycleAcceleration({speed:8,brake:1}));
  assert.ok(bicycleAcceleration({speed:6,pedal:1,stamina:0})<bicycleAcceleration({speed:6,pedal:1,stamina:100}));
});
test('bicycle braking stops without a reverse gear and stamina remains bounded',()=>{
  let speed=8,t=0;while(speed>0&&t<8){speed=Math.max(0,speed+bicycleAcceleration({speed,brake:1})/120);t+=1/120;}
  assert.equal(speed,0);assert.ok(t<3);assert.equal(staminaStep(0,true,60),0);assert.equal(staminaStep(99,false,60),100);assert.ok(staminaStep(100,true,10)<100);
  assert.ok(BICYCLE.mass<150);assert.equal(FOOD_BICYCLE_JOB.veh,'bicycle');assert.equal(FOOD_BICYCLE_JOB.kind,'ride');
});
test('suspension settles consistently at 30, 60 and 120 Hz without exploding',()=>{
  const runs=[30,60,120].map(hz=>{let p=0,v=0;for(let i=0;i<hz*3;i++){const r=springStep(p,v,0.05,1.8,0.8,1/hz);p=r.position;v=r.velocity;assert.ok(Number.isFinite(p)&&Math.abs(p)<0.2);}return p;});
  for(const p of runs)assert.ok(Math.abs(p-0.05)<0.0001);
  assert.ok(Math.abs(runs[0]-runs[2])<1e-6);
});
test('Ackermann geometry steers the inside wheel farther and rolling drag opposes motion',()=>{
  assert.ok(ackermannAngle(0.3,0.8,2.7)>ackermannAngle(0.3,-0.8,2.7));assert.equal(ackermannAngle(0,0.8,2.7),0);
  assert.ok(Math.abs(ackermannAngle(-0.3,-0.8,2.7))>Math.abs(ackermannAngle(-0.3,0.8,2.7)));
  assert.ok(roadResistance(20)>0);assert.ok(roadResistance(-20)<0);assert.ok(roadResistance(30)>roadResistance(10));
});
test('bicycle and motorbike routes and junction choices exclude all toll edges',()=>{
  const previous={...RULES};try{
    assert.equal(nonTollVehicle('bicycle'),true);assert.equal(nonTollVehicle('moto'),true);assert.equal(nonTollVehicle('car'),false);
    RULES.noToll=true;RULES.noMbz=true;
    const route=findRoute('N:Jakarta','N:Bandung','mix');assert.ok(route?.length);assert.ok(route.every(e=>CORR[e.c].cls!=='t'));
    const opts=choicesAt('Bekasi Barat',null,'mix');assert.ok(opts.every(o=>o.e.cls!=='t'));
  }finally{Object.assign(RULES,previous);}
});
