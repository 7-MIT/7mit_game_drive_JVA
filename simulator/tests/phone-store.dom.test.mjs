// Optional DOM integration suite: npm install --no-save jsdom, or set PHONE_DOM_MODULE.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {APP_CATALOG, STARTER_APPS} from '../phone-apps.js';
import {createPhoneStore} from '../phone-store.js';
import {initPhone} from '../phone.js';
const require=createRequire(import.meta.url);
let JSDOM;try{({JSDOM}=require(process.env.PHONE_DOM_MODULE||'jsdom'));}catch{}
const domTest=(name,fn)=>test(name,{skip:!JSDOM},fn);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
function setup(){
  const dom=new JSDOM('<html><head></head><body></body></html>',{url:'https://game.test/'});
  const w=dom.window;Object.assign(globalThis,{window:w,document:w.document,innerHeight:900,innerWidth:1200,addEventListener:w.addEventListener.bind(w),requestAnimationFrame:()=>1});
  w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}});
  const errors=[];w.addEventListener('error',e=>errors.push(e.error));
  const P={},A={cfg:{},saveCfg(){},state:()=>({cash:1000,etoll:500,fuel:80,kmh:0,dmg:0,time:'09:00',place:'Tol Jakarta-Cikampek',dest:'Bandung',left:'100 km',leftKm:100,arrive:'10:30'}),
    sfx(){},toast(){},rpS:n=>String(n),onToggle(){},music:{dock:()=>null},mp:{ready:()=>false,peers:()=>[]},
    places:(q='',filter)=>[{key:'Bandung',name:'Bandung',km:100,kind:'k'},{key:'Jakarta',name:'Jakarta',km:20,kind:'k'}].filter(p=>!q||p.name.toLowerCase().includes(q.toLowerCase())),nav:{set(){}}};
  let render,active=null,refresh=null,homes=0,opened=null,store;const pg=document.createElement('div');document.body.append(pg);
  const ctx={A,P,save(){},head:s=>`<h2>${esc(s)}</h2>`,ic:()=>'<svg></svg>',esc,html(p,h){p.insertAdjacentHTML('beforeend',h);return p.lastElementChild;},
    push(fn){render=fn;pg.innerHTML='';fn(pg);},redraw(){pg.innerHTML='';render(pg);},live(fn){refresh=fn;},drawHome(){homes++;},openApp(id){opened=id;},setAccent(){}};
  store=createPhoneStore(ctx);
  return {dom,w,A,P,pg,store,errors,get homes(){return homes;},get opened(){return opened;},paint(fn){render=fn;refresh=null;pg.innerHTML='';fn(pg);},refresh(){refresh?.();}};
}
domTest('all 160 installed apps render with a functional registered engine',()=>{
  const t=setup();const kinds=new Set(t.store.engines);
  for(const a of APP_CATALOG){assert.ok(kinds.has(a.kind),a.id);t.store.library.install(a.id);t.paint(pg=>t.store.renderApp(pg,a.id));assert.equal(t.pg.querySelector('h2').textContent,a.name);assert.ok(t.pg.querySelector('button,input,textarea'),a.id);t.refresh();}
  assert.deepEqual(t.errors,[]);t.dom.window.close();
});
domTest('store search, category, install, open and confirmed uninstall lifecycle',()=>{
  const t=setup();t.paint(t.store.renderStore);assert.equal(t.pg.querySelectorAll('.store-row').length,160);
  const search=t.pg.querySelector('.store-search');search.value='Jelajah Jakarta';search.dispatchEvent(new t.w.Event('input'));assert.equal(t.pg.querySelectorAll('.store-row').length,1);
  t.pg.querySelector('[data-get]').click();assert.ok(t.store.library.has('store-perjalanan-1'));assert.ok(t.homes>0);
  t.pg.querySelector('[data-get]').click();assert.equal(t.opened,'store-perjalanan-1');
  t.pg.querySelector('[data-detail]').click();const remove=[...t.pg.querySelectorAll('button')].find(b=>b.textContent==='Hapus aplikasi');remove.click();
  assert.ok(t.store.library.has('store-perjalanan-1'));t.pg.querySelector('.btn.red').click();assert.equal(t.store.library.has('store-perjalanan-1'),false);
  assert.deepEqual(t.errors,[]);t.dom.window.close();
});
domTest('notes, checklist, calculator and quiz respond and preserve local data',()=>{
  const t=setup(),lib=t.store.library;
  t.paint(pg=>t.store.renderApp(pg,'store-produktivitas-1'));let text=t.pg.querySelector('textarea');text.value='<img src=x onerror=alert(1)> catatan';text.dispatchEvent(new t.w.Event('input'));
  t.paint(pg=>t.store.renderApp(pg,'store-produktivitas-1'));assert.equal(t.pg.querySelector('textarea').value,text.value);assert.equal(t.pg.querySelector('img'),null);
  t.paint(pg=>t.store.renderApp(pg,'store-produktivitas-2'));let check=t.pg.querySelector('input[type=checkbox]');check.checked=true;check.dispatchEvent(new t.w.Event('change',{bubbles:true}));assert.equal(lib.read('store-produktivitas-2').items[0].done,true);
  t.paint(pg=>t.store.renderApp(pg,'store-utilitas-1'));const numbers=t.pg.querySelectorAll('input');numbers[0].value='6';numbers[1].value='7';t.pg.querySelector('select').value='×';t.pg.querySelector('.btn').click();assert.equal(t.pg.querySelector('.mini-result').textContent,'42');
  lib.install('store-belajar-1');t.paint(pg=>t.store.renderApp(pg,'store-belajar-1'));t.pg.querySelector('input').value='999';t.pg.querySelector('.btn').click();assert.equal(lib.read('store-belajar-1').total,1);assert.ok(t.pg.querySelector('.mini-status').textContent.includes('Belum tepat'));
  assert.deepEqual(t.errors,[]);t.dom.window.close();
});
domTest('actual phone launcher installs apps, searches and restores after reinitialization',()=>{
  const t=setup();const phone=initPhone(t.A),el=document.querySelector('#phone');
  assert.equal(el.querySelectorAll('.grid .ic').length,13+STARTER_APPS.length);
  el.querySelector('[data-app=appstore]').click();assert.equal(el.querySelectorAll('.store-row').length,160);
  el.querySelector('[data-get="store-perjalanan-1"]').click();el.querySelector('.hind').click();
  assert.ok(el.querySelector('.grid [data-app="store-perjalanan-1"]'));
  const search=el.querySelector('.home-search');search.value='Jelajah Jakarta';search.dispatchEvent(new t.w.Event('input'));assert.equal(el.querySelectorAll('.grid .ic').length,1);
  el.querySelector('.grid .ic').click();assert.equal(el.querySelector('.app h2').textContent,'Jelajah Jakarta');
  el.remove();initPhone(t.A);assert.ok(document.querySelector('#phone .grid [data-app="store-perjalanan-1"]'));assert.deepEqual(t.errors,[]);t.dom.window.close();
});

domTest('custom timers start with the entered duration, pause and survive reload',()=>{
  const t=setup(),id='store-produktivitas-9';t.store.library.install(id);t.paint(pg=>t.store.renderApp(pg,id));
  t.pg.querySelector('input').value='2';t.pg.querySelector('.btn').click();
  let d=t.store.library.read(id);assert.equal(d.minutes,2);assert.equal(d.remaining,120000);assert.ok(d.end>Date.now());
  t.pg.querySelector('.btn').click();d=t.store.library.read(id);assert.equal(d.end,null);assert.ok(d.remaining<=120000);
  t.paint(pg=>t.store.renderApp(pg,id));assert.equal(t.pg.querySelector('input').value,'2');assert.deepEqual(t.errors,[]);t.dom.window.close();
});
