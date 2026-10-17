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
