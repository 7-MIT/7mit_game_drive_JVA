// The welcome screen is plain HTML/CSS. Three.js and the world load on demand.
export function mountStartup({document:doc=globalThis.document,window:win=globalThis.window,load=()=>import('./main.js'),paint=()=>new Promise(resolve=>win.requestAnimationFrame(()=>win.requestAnimationFrame(resolve)))}={}){
 const root=doc.getElementById('start-screen');if(!root)return null;
 const $=id=>doc.getElementById(id),home=$('start-home'),loading=$('start-loading'),play=$('start-play'),progress=$('start-progress'),status=$('start-load-status'),reload=$('start-reload');
 let begun=false,amount=0,slowTimer,choice='day';
 const hours={day:12,dusk:17.8,night:21},labels={day:'Perjalanan siang hari',dusk:'Perjalanan saat senja',night:'Perjalanan malam hari'};
 function config(){try{const c=JSON.parse(win.localStorage.getItem('tj_cfg1')||'{}');return c&&typeof c==='object'&&!Array.isArray(c)?c:{};}catch{return {};}}
 function select(time){if(begun||!Object.hasOwn(hours,time))return;choice=time;root.dataset.time=time;$('start-scene-time').textContent=labels[time];for(const b of root.querySelectorAll('[data-start-time]'))b.setAttribute('aria-pressed',String(b.dataset.startTime===time));}
 const hour=config().gh;if(typeof hour==='number')select(hour>=19||hour<5?'night':hour>=16.5?'dusk':'day');
 for(const b of root.querySelectorAll('[data-start-time]'))b.addEventListener('click',()=>select(b.dataset.startTime));
 const help=$('start-help-dialog');$('start-help-open').addEventListener('click',()=>help.showModal());
 reload.addEventListener('click',()=>win.location.reload());
 function update(value,message){amount=Math.max(amount,Math.min(100,value));progress.value=amount;$('start-load-percent').textContent=Math.round(amount)+'%';status.textContent=message;}
 const boot={active:false,async stage(value,message){update(value,message);await paint();}};win.TJ_BOOT=boot;
 async function start({direct=false}={}){
  if(begun)return;begun=true;boot.active=true;play.disabled=true;home.hidden=true;loading.hidden=false;root.dataset.state='loading';root.setAttribute('aria-busy','true');loading.focus();
  if(!direct){try{win.localStorage.setItem('tj_cfg1',JSON.stringify({...config(),gh:hours[choice]}));}catch{}}
  slowTimer=win.setTimeout(()=>{$('start-load-detail').textContent='Persiapan masih berjalan. Pada perangkat atau koneksi lambat, proses ini membutuhkan waktu lebih lama.';reload.hidden=false;},20000);
  try{
   await boot.stage(8,'Mengunduh simulator dan komponennya');
   await load();
   await boot.stage(100,'Siap berkendara');
   win.clearTimeout(slowTimer);boot.active=false;root.removeAttribute('aria-busy');
   const shell=$('simulator-shell');shell.setAttribute('data-ready','');shell.inert=false;shell.removeAttribute('inert');shell.removeAttribute('aria-hidden');root.hidden=true;
   win.dispatchEvent(new win.Event('resize'));
   const target=doc.querySelector('#plan:not([hidden]) #from:not(:disabled)')||doc.querySelector('#plan:not([hidden]) #go')||doc.querySelector('#tut:not([hidden]) #tut-go')||doc.querySelector('#stage canvas');if(target){if(target.tagName==='CANVAS')target.tabIndex=-1;target.focus();}
  }catch(error){
   win.clearTimeout(slowTimer);root.dataset.state='error';root.removeAttribute('aria-busy');$('start-loading-title').textContent='Simulator belum bisa dibuka';$('start-load-sub').textContent='Periksa koneksi dan dukungan grafis browser, lalu muat ulang halaman.';status.textContent='Persiapan terhenti';$('start-load-detail').textContent='Coba browser terbaru dengan WebGL aktif. Pengaturan yang sudah tersimpan tetap tersedia.';reload.hidden=false;reload.focus();win.console?.error('driving.7mit startup:',error);
  }
 }
 play.addEventListener('click',()=>start());
 const query=new URLSearchParams(win.location.search),direct=win.TJ_TUTORIAL||win.TJ_FLY||query.has('tutorial')||query.has('terbang')||/\/(tutorial|terbang)\/?(index\.html)?$/.test(win.location.pathname);
 if(direct)start({direct:true});
 return {start,select,get state(){return root.dataset.state;}};
}
if(typeof document!=='undefined')mountStartup();
