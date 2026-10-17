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
  assert.equal(el.querySelectorAll('.grid .ic').length,15+STARTER_APPS.length);
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

const pressEvent=(w,type,extra={})=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',button:0,clientX:100,clientY:100,...extra});return e;};
const buttonText=(root,text)=>[...root.querySelectorAll('button')].find(b=>b.textContent===text);
domTest('phone pages support arrows, scroll indicators and keyboard navigation',()=>{
  const t=setup();initPhone(t.A);const el=document.querySelector('#phone'),pager=el.querySelector('.home-pages');
  assert.equal(pager.children.length,2);assert.equal(el.querySelectorAll('.home-page:first-child .ic').length,12);
  el.querySelector('[data-home-next]').click();assert.equal(pager.scrollLeft,244);assert.equal(el.querySelector('[aria-current=page]').dataset.page,'1');
  const e=new t.w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true});pager.dispatchEvent(e);assert.equal(pager.scrollLeft,0);assert.equal(e.defaultPrevented,true);
  pager.scrollLeft=244;pager.dispatchEvent(new t.w.Event('scroll'));assert.equal(el.querySelector('[aria-current=page]').dataset.page,'1');assert.deepEqual(t.errors,[]);t.dom.window.close();
});
domTest('long press edits the icon without launching it; rename persists',async()=>{
  const t=setup();initPhone(t.A);const el=document.querySelector('#phone'),icon=el.querySelector('[data-app="store-produktivitas-1"]');
  icon.dispatchEvent(pressEvent(t.w,'pointerdown'));await new Promise(resolve=>setTimeout(resolve,580));
  assert.ok(el.querySelector('.home-overlay'));assert.ok(el.querySelector('.home-editing')||el.querySelector('.home').classList.contains('home-editing'));assert.equal(el.classList.contains('app-open'),false);
  const name=el.querySelector('.home-menu input');name.value='Catatan Bara';buttonText(el,'Simpan nama').click();assert.equal(t.A.cfg.phone.homeLayout.labels['store-produktivitas-1'],'Catatan Bara');
  buttonText(el,'Tutup').click();el.querySelector('[data-home-action="done"]').click();el.remove();initPhone(t.A);assert.equal(document.querySelector('[data-app="store-produktivitas-1"] span').textContent,'Catatan Bara');assert.deepEqual(t.errors,[]);t.dom.window.close();
});
domTest('swiping cancels a pending long press and never opens an app',async()=>{
  const t=setup();initPhone(t.A);const el=document.querySelector('#phone'),icon=el.querySelector('[data-app=appstore]');
  icon.dispatchEvent(pressEvent(t.w,'pointerdown'));icon.dispatchEvent(pressEvent(t.w,'pointermove',{clientX:30}));icon.dispatchEvent(pressEvent(t.w,'pointercancel'));await new Promise(resolve=>setTimeout(resolve,580));
  assert.equal(el.querySelector('.home-overlay'),null);assert.equal(el.classList.contains('app-open'),false);assert.deepEqual(t.errors,[]);t.dom.window.close();
});
domTest('widget configuration, appearance and hidden icons can be changed and restored',()=>{
  const t=setup();initPhone(t.A);const el=document.querySelector('#phone'),menu=id=>el.querySelector(`[data-home-action="${id}"]`).click();
  menu('edit');menu('widgets');let fields=el.querySelectorAll('.home-menu select');fields[0].value='clock';fields[1].value='weather';fields[2].value='large';buttonText(el,'Simpan widget').click();assert.deepEqual(t.A.cfg.phone.homeLayout.widgets,['clock','weather']);assert.equal(el.querySelectorAll('.home-page:first-child .ic').length,8);
  menu('appearance');fields=el.querySelectorAll('.home-menu select');fields[0].value='small';fields[1].value='no';buttonText(el,'Simpan tampilan').click();assert.ok(el.querySelector('.home-small-icons'));assert.ok(el.querySelector('.home-no-labels'));
  const icon=el.querySelector('[data-app=ojek]');icon.dispatchEvent(new t.w.Event('contextmenu',{bubbles:true,cancelable:true}));buttonText(el,'Sembunyikan dari layar utama').click();assert.equal(el.querySelector('[data-app=ojek]'),null);
  menu('hidden');buttonText(el,'Tampilkan Ojek').click();assert.ok(el.querySelector('[data-app=ojek]'));assert.deepEqual(t.errors,[]);t.dom.window.close();
});
domTest('home uninstall requires confirmation and removes installed app data and icon',()=>{
  const t=setup();initPhone(t.A);const el=document.querySelector('#phone'),id='store-produktivitas-1';
  el.querySelector(`[data-app="${id}"]`).dispatchEvent(new t.w.Event('contextmenu',{bubbles:true,cancelable:true}));buttonText(el,'Hapus aplikasi').click();
  assert.ok(el.querySelector(`[data-app="${id}"]`));buttonText(el,'Ya, hapus aplikasi').click();assert.equal(el.querySelector(`[data-app="${id}"]`),null);assert.equal(t.A.cfg.phone.store.installed.includes(id),false);assert.equal(t.A.cfg.phone.store.data[id],undefined);assert.deepEqual(t.errors,[]);t.dom.window.close();
});

domTest('edit mode swaps icon positions and customizes dock without duplicate icons',()=>{
  const t=setup();initPhone(t.A);const el=document.querySelector('#phone'),id='store-produktivitas-1';
  const context=k=>el.querySelector(`[data-app="${k}"]`).dispatchEvent(new t.w.Event('contextmenu',{bubbles:true,cancelable:true}));
  context(id);buttonText(el,'Pindahkan / tukar posisi').click();const target=el.querySelector('[data-app="ojek"]');target.dispatchEvent(pressEvent(t.w,'pointerdown'));target.dispatchEvent(pressEvent(t.w,'pointerup'));target.click();
  assert.equal(t.A.cfg.phone.homeLayout.order[1],id);assert.equal(new Set(t.A.cfg.phone.homeLayout.order).size,21);
  context('peta');buttonText(el,'Keluarkan dari dock').click();assert.equal(el.querySelector('.dock [data-app="peta"]'),null);
  context(id);buttonText(el,'Taruh di dock').click();assert.ok(el.querySelector(`.dock [data-app="${id}"]`));assert.equal(el.querySelectorAll('.dock .ic').length,4);
  context('appstore');assert.equal(buttonText(el,'Hapus aplikasi'),undefined);assert.equal(buttonText(el,'Sembunyikan dari layar utama'),undefined);
  assert.deepEqual(t.errors,[]);t.dom.window.close();
});
