import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {mountStartup} from '../startup.js';
let JSDOM;try{const require=createRequire(import.meta.url);({JSDOM}=require(process.env.PHONE_DOM_MODULE||'jsdom'));}catch{}
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const setup=()=>new JSDOM(html,{url:'https://game.test/'});
const pause=()=>new Promise(r=>setTimeout(r,0));
test('welcome page waits for explicit start, saves selected ambience and reveals only after preparation',{skip:!JSDOM},async()=>{
 const d=setup(),w=d.window;let calls=0,release;const wait=new Promise(r=>release=r);
 const ctl=mountStartup({document:w.document,window:w,paint:async()=>{},load:async()=>{calls++;await wait;}});
 assert.equal(calls,0);assert.equal(ctl.state,'home');assert.ok(w.document.getElementById('simulator-shell').hasAttribute('inert'));
 w.document.querySelector('[data-start-time=night]').click();assert.equal(w.document.getElementById('start-screen').dataset.time,'night');
 const done=ctl.start();await pause();assert.equal(calls,1);assert.equal(ctl.state,'loading');assert.equal(JSON.parse(w.localStorage.getItem('tj_cfg1')).gh,21);
 await ctl.start();assert.equal(calls,1);await w.TJ_BOOT.stage(70,'Membangun jalan');await w.TJ_BOOT.stage(40,'Tahap sebelumnya');assert.equal(w.document.getElementById('start-progress').value,70);
 assert.equal(w.document.getElementById('start-screen').hidden,false);release();await done;
 assert.equal(w.TJ_BOOT.active,false);assert.equal(w.document.getElementById('start-screen').hidden,true);assert.ok(!w.document.getElementById('simulator-shell').hasAttribute('inert'));assert.equal(w.document.getElementById('start-progress').value,100);d.window.close();
});
test('startup failure remains visible with a working recovery action',{skip:!JSDOM},async()=>{
 const d=setup(),w=d.window;w.console.error=()=>{};const ctl=mountStartup({document:w.document,window:w,paint:async()=>{},load:async()=>{throw new Error('WebGL unavailable');}});
 await ctl.start();assert.equal(ctl.state,'error');assert.equal(w.document.getElementById('start-screen').hidden,false);assert.equal(w.document.getElementById('start-reload').hidden,false);assert.equal(w.document.activeElement.id,'start-reload');assert.ok(w.document.getElementById('simulator-shell').hasAttribute('inert'));d.window.close();
});
test('direct tutorial enters loading immediately and does not overwrite saved game time',{skip:!JSDOM},async()=>{
 const d=setup(),w=d.window;w.TJ_TUTORIAL=true;w.localStorage.setItem('tj_cfg1',JSON.stringify({gh:9,veh:'car'}));let calls=0;
 mountStartup({document:w.document,window:w,paint:async()=>{},load:async()=>{calls++;}});await pause();assert.equal(calls,1);assert.equal(JSON.parse(w.localStorage.getItem('tj_cfg1')).gh,9);assert.equal(w.document.getElementById('start-screen').hidden,true);d.window.close();
});
test('denied storage still permits choosing ambience and starting the simulator',{skip:!JSDOM},async()=>{
 const d=setup(),w=d.window;Object.defineProperty(w,'localStorage',{get(){throw new Error('Storage denied');}});let calls=0;const ctl=mountStartup({document:w.document,window:w,paint:async()=>{},load:async()=>calls++});ctl.select('dusk');await ctl.start();assert.equal(calls,1);assert.equal(w.document.getElementById('start-screen').hidden,true);d.window.close();
});
test('journey choices and modifications reach the simulator before it loads',{skip:!JSDOM},async()=>{
 const d=setup(),w=d.window,$=id=>w.document.getElementById(id);let received;
 const ctl=mountStartup({document:w.document,window:w,paint:async()=>{},load:async()=>{received=w.TJ_START_PLAN;}});
 const choose=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('change'));};
 choose('start-from','N:Jakarta');choose('start-to','N:Bandung');choose('start-route-mode','nr');choose('start-vehicle','suv');
 $('start-paint').value='#245678';$('start-rim').value='#bbaa22';$('start-livery').value='batik';$('start-tint').value='2';$('start-plate').value='b 777 mit';$('start-spoiler').checked=true;
 assert.equal($('start-play').disabled,false);await ctl.start();
 assert.equal(received.from,'N:Jakarta');assert.equal(received.to,'N:Bandung');assert.equal(received.mode,'nr');assert.equal(received.veh,'suv');assert.equal(received.mod.paint,'#245678');assert.equal(received.mod.rim,'#bbaa22');assert.equal(received.mod.livery,'batik');assert.equal(received.mod.tint,2);assert.equal(received.mod.plate,'B 777 MIT');assert.equal(received.mod.spoiler,true);
 assert.equal(JSON.parse(w.localStorage.getItem('tj_cfg1')).veh,'suv');d.window.close();
});
test('invalid journeys block loading and free driving retains a chosen initial direction',{skip:!JSDOM},async()=>{
 const d=setup(),w=d.window,$=id=>w.document.getElementById(id);let calls=0;
 const ctl=mountStartup({document:w.document,window:w,paint:async()=>{},load:async()=>calls++});
 $('start-to').value=$('start-from').value;$('start-to').dispatchEvent(new w.Event('change'));await ctl.start();assert.equal(calls,0);assert.equal($('start-play').disabled,true);
 $('start-trip').value='free';$('start-trip').dispatchEvent(new w.Event('change'));assert.equal($('start-to-field').hidden,true);assert.equal($('start-first-field').hidden,false);
 $('start-first').value='0';$('start-first').dispatchEvent(new w.Event('change'));const selected=$('start-first').selectedOptions[0].dataset.to;await ctl.start();assert.equal(calls,1);assert.equal(w.TJ_START_PLAN.first.to,selected);assert.equal(w.TJ_START_PLAN.trip,'free');d.window.close();
});
