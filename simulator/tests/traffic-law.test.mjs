import test from 'node:test';
import assert from 'node:assert/strict';
import {createLawAuditor,mustStop,safeStep,followSeconds,TRAFFIC_LAWS} from '../traffic-law.js';
import {makeEtleCameras,createEtle} from '../etle.js';
import {createPursuit} from '../pursuit.js';
const facts=(o={})=>({id:'p',plate:'B 1234 SIM',player:true,type:'car',u:0,sd:1,front:0,lane:0,lanes:2,speed:0,limit:20,time:0,route:'a',gap:Infinity,...o});
function run(a,v,base,seconds,dt=.05){const events=[];for(let i=0;i<Math.ceil(seconds/dt);i++)events.push(...a.sample(v,{...base,time:i*dt},dt));return events;}
test('one policy evaluates player and AI; speed has a measured dwell and cooldown',()=>{
 for(const player of [true,false]){const a=createLawAuditor(),v={};assert.deepEqual(run(a,v,facts({player,speed:25}),2),[]);assert.ok(run(createLawAuditor(),{},facts({player,speed:25}),4).includes('speed'));assert.equal(run(createLawAuditor(),{},facts({player,speed:25}),10).filter(x=>x==='speed').length,1);}
 assert.equal(TRAFFIC_LAWS.length,12);
});
test('red light requires a real line crossing, respects priority, and ignores teleports',()=>{
 const a=createLawAuditor(),v={};a.sample(v,facts({front:9,speed:5,lights:[{line:10,signal:'R'}]}),.1);
 assert.deepEqual(a.sample(v,facts({front:10.2,speed:5,time:.2,lights:[{line:10,signal:'R'}]}),.1),['red']);
 const b=createLawAuditor();b.sample(v,facts({front:0}),.05);assert.deepEqual(b.sample(v,facts({front:300,time:.05,lights:[{line:100,signal:'R'}]}),.05),[]);
 const c=createLawAuditor();c.sample(v,facts({front:9}),.1);assert.deepEqual(c.sample(v,facts({front:11,speed:5,priority:true,lights:[{line:10,signal:'R'}]}),.1),[]);
});
test('yellow stopping, safe integration, wet spacing, and route resets are contextual',()=>{
 assert.equal(mustStop('R',5,20),true);assert.equal(mustStop('R',5,20,true),false);assert.equal(mustStop('Y',2,20),false);assert.equal(mustStop('Y',100,20),true);assert.equal(safeStep(10,{stop:2,queue:5}),2);assert.equal(safeStep(10,{block:-1}),0);assert.ok(followSeconds(true,true)>followSeconds(false,false));
 const a=createLawAuditor(),v={};run(a,v,facts({speed:30}),2);assert.deepEqual(a.sample(v,facts({speed:30,route:'b',time:3}),.1),[]);
});
test('signals are directional; hazard is not a turn signal; allowed contraflow is not wrong-way',()=>{
 for(const indicator of [0,2,-1,1]){const a=createLawAuditor(),v={};a.sample(v,facts({speed:10,lane:0}),.1);const e=a.sample(v,facts({speed:10,lane:1,indicator,time:.1}),.1);assert.equal(e.includes('signal'),indicator!==1);}
 assert.equal(run(createLawAuditor(),{},facts({wrongway:false,speed:10}),4).includes('wrongway'),false);
 assert.ok(run(createLawAuditor(),{},facts({wrongway:true,speed:10}),2).includes('wrongway'));
 assert.equal(run(createLawAuditor(),{},facts({shoulder:true,exemptShoulder:true,speed:10}),4).includes('shoulder'),false);
 // Stopping, creeping or hazard lights on the shoulder are not offences; driving along it at speed is.
 for(const speed of [0,3,10])assert.equal(run(createLawAuditor(),{},facts({shoulder:true,exemptShoulder:false,speed}),6).includes('shoulder'),false);
 assert.equal(run(createLawAuditor(),{},facts({shoulder:true,exemptShoulder:false,speed:20,indicator:2}),6).includes('shoulder'),false);
 assert.equal(run(createLawAuditor(),{},facts({shoulder:true,exemptShoulder:false,speed:20}),6).includes('shoulder'),true);
});
test('every corridor segment and each direction receive cameras, including short non-toll roads',()=>{
 const events=[{u:0},{u:100},{u:3400},{u:6000}],cams=makeEtleCameras(events,[{u:100,name:'Simpang'}],u=>u<3400?'nasional':'tol');
 for(let i=0;i<events.length-1;i++)for(const sd of [1,-1])assert.ok(cams.some(c=>c.sd===sd&&c.u>=events[i].u&&c.u<events[i+1].u));
 assert.ok(cams.some(c=>c.kind==='junction'));assert.ok(cams.some(c=>c.corridor==='nasional'));assert.ok(cams.some(c=>c.corridor==='tol'));
});
test('ETLE requires coverage and multiple samples, deduplicates, and reviews only once',()=>{
 let saved=[];const e=createEtle({save:r=>saved=r});e.setCameras([{id:'c',u:0,sd:1,range:125}]);const f=facts({speed:30,limit:20});e.scan([f],1);assert.equal(e.capture('speed',f,1),null);e.scan([f],1.1);const r=e.capture('speed',f,1.1);assert.equal(r.status,'pending');assert.equal(r.samples,2);assert.equal(e.capture('speed',f,1.2),null);assert.equal(e.capture('speed',{...f,u:200},25),null);assert.equal(e.review(r.id,'confirmed').status,'confirmed');assert.equal(e.review(r.id,'confirmed'),null);assert.equal(saved.length,1);assert.equal(createEtle({load:()=>saved}).records[0].status,'confirmed');
});
test('repeated offences trigger pursuit, arrest needs a nearby officer and a sustained stop',()=>{
 const p=createPursuit();assert.equal(p.offence('speed',0),false);assert.equal(p.offence('speed',1),false);assert.equal(p.offence('red',5),false);assert.equal(p.offence('wrongway',9),true);assert.equal(p.state.phase,'chasing');
 assert.equal(p.step({time:12,near:false,stopped:true,dt:4}),false);assert.equal(p.step({time:14,near:true,stopped:false,dt:4}),false);assert.equal(p.step({time:16,near:true,stopped:true,dt:2}),false);assert.equal(p.step({time:17,near:true,stopped:true,dt:1}),true);assert.equal(p.state.arrests,1);assert.equal(p.step({near:true,stopped:true,dt:4}),false);p.release(20);assert.equal(p.state.phase,'idle');assert.equal(p.offence('red',30),false);assert.equal(p.state.offences.length,0);
 const q=createPursuit();q.offence('red',0);q.offence('speed',130);assert.equal(q.offence('gap',131),false);
});
