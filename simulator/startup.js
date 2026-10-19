// The welcome screen is plain HTML/CSS. Three.js and the world load on demand.
import {placeList,buildTrip,choicesAt,NODES,RULES,fmtKm} from './network.js';
import {nonTollVehicle} from './vehicle-dynamics.js';
import {TRIP_OPTIONS,ROUTE_OPTIONS,VEHICLE_OPTIONS,MOD_DEF,LIVERY,PRESETS} from './start-options.js';
export function mountStartup({document:doc=globalThis.document,window:win=globalThis.window,load=()=>import('./main.js'),account=()=>import('./account.js'),paint=()=>new Promise(resolve=>win.requestAnimationFrame(()=>win.requestAnimationFrame(resolve)))}={}){
 const root=doc.getElementById('start-screen');if(!root)return null;
 const $=id=>doc.getElementById(id),home=$('start-home'),loading=$('start-loading'),play=$('start-play'),progress=$('start-progress'),status=$('start-load-status'),reload=$('start-reload');
 let begun=false,amount=0,slowTimer,choice='day';
 const hours={day:12,dusk:17.8,night:21},labels={day:'Perjalanan siang hari',dusk:'Perjalanan saat senja',night:'Perjalanan malam hari'};
 function config(){try{const c=JSON.parse(win.localStorage.getItem('tj_cfg1')||'{}');return c&&typeof c==='object'&&!Array.isArray(c)?c:{};}catch{return {};}}
 const saved=config(),places=placeList(),placeKeys=new Set(places.map(p=>p.key));
 function options(id,list,selected){const el=$(id);for(const [value,label] of list){const o=doc.createElement('option');o.value=value;o.textContent=label;el.append(o);}if([...el.options].some(o=>o.value===selected))el.value=selected;}
 options('start-trip',TRIP_OPTIONS,saved.trip||'route');options('start-vehicle',VEHICLE_OPTIONS,saved.veh||'car');
 // vehicles not in the garage yet (career.js) cannot be picked here; players from before the garage keep the one they drove
 {const own=Array.isArray(saved.car?.owned)?saved.car.owned:['car','moto','bicycle',...(saved.wal&&saved.veh?[saved.veh]:[])];for(const o of $('start-vehicle').options)if(!own.includes(o.value)){o.disabled=true;o.textContent+=' (beli di Garasi)';}if($('start-vehicle').selectedOptions[0]?.disabled)$('start-vehicle').value='car';}options('start-route-mode',ROUTE_OPTIONS,saved.mode||'mix');
 for(const id of ['start-from','start-to']){const sel=$(id),groups=new Map();for(const p of places){if(!groups.has(p.group))groups.set(p.group,[]);const o=doc.createElement('option');o.value=p.key;o.textContent=p.name+(p.planned?' (rencana)':'');groups.get(p.group).push(o);}for(const [label,items] of groups){const g=doc.createElement('optgroup');g.label=label;g.append(...items);sel.append(g);}}
 $('start-from').value=placeKeys.has(saved.from)?saved.from:'Bekasi Barat';$('start-to').value=placeKeys.has(saved.to)?saved.to:'Pasteur';
 options('start-preset',PRESETS.map(([label],i)=>[String(i),label]));options('start-livery',Object.entries(LIVERY));
 const mods={...MOD_DEF,...saved.mod};for(const key of ['paint','paint2','rim','livery','tint','plate','platecat','spoiler','low','stripe']){const el=$('start-'+key);if(el.type==='checkbox')el.checked=!!mods[key];else el.value=String(mods[key==='platecat'?'plateCat':key]??'');}
 $('start-name').value=saved.name||'';
 const noMbz=new Set(['car','suv','pickup','police','taxi']);
 function preview(){
  const kind=$('start-trip').value,veh=$('start-vehicle').value,free=kind!=='route';
  $('start-to-field').hidden=$('start-preset-field').hidden=free;$('start-from-field').hidden=kind==='mp';$('start-first-field').hidden=!free||kind==='mp';$('start-name-field').hidden=kind!=='mp';
  $('start-from').disabled=kind==='mp';RULES.noToll=nonTollVehicle(veh);RULES.noMbz=!noMbz.has(veh);
  const first=$('start-first'),prior=first.value;first.replaceChildren();options('start-first',[['','Otomatis'],...choicesAt($('start-from').value,null,'mix').map((o,i)=>[String(i),`${o.road} → ${o.toward}`])],prior);
  const alternatives=choicesAt($('start-from').value,null,'mix');for(let i=0;i<alternatives.length;i++){first.options[i+1].dataset.to=alternatives[i].e.to;first.options[i+1].dataset.corridor=alternatives[i].e.c;}
  const out=$('start-route-preview');let valid=true;
  if(kind==='mp'){valid=choicesAt('Semanggi',null,'mix').length>0;out.textContent=valid?'Multiplayer dimulai dari Semanggi.':'Kendaraan ini tidak dapat memulai perjalanan di Semanggi. Pilih kendaraan yang diizinkan di tol.';}
  else if(free){valid=alternatives.length>0;out.textContent=valid?`Mulai dari ${NODES.get($('start-from').value)?.name||'lokasi terpilih'} · arah ${first.selectedOptions[0]?.textContent||'otomatis'}.`: 'Tidak ada jalan yang bisa dilewati dari titik awal ini.';}
  else{const from=$('start-from').value,to=$('start-to').value,t=from!==to?buildTrip(from,to,$('start-route-mode').value):null;valid=!!t;out.textContent=t?`${fmtKm(t.fullKm??t.total)} · ${t.corridors.length} ruas${t.viaFerry?' · lewat '+t.viaFerry:''} · ${NODES.get(from)?.name} → ${NODES.get(to)?.name}`:from===to?'Pilih titik awal dan tujuan yang berbeda.':'Rute tidak tersedia untuk pilihan jalan dan kendaraan ini.';}
  play.disabled=!valid;out.classList.toggle('error',!valid);return valid;
 }
 for(const id of ['start-trip','start-vehicle','start-from','start-to','start-route-mode','start-first'])$(id).addEventListener('change',()=>{if(['start-trip','start-vehicle','start-from'].includes(id))$('start-first').value='';preview();});
 $('start-preset').addEventListener('change',e=>{if(e.target.value==='')return;const p=PRESETS[Number(e.target.value)];if(!p)return;$('start-trip').value='route';$('start-from').value=p[1];$('start-to').value=p[2];$('start-route-mode').value=p[3]||'mix';preview();});
 preview();
 function journey(){const chosen=$('start-first').selectedOptions[0];return {trip:$('start-trip').value,from:$('start-from').value,to:$('start-to').value,mode:$('start-route-mode').value,veh:$('start-vehicle').value,name:$('start-name').value.replace(/[^\w .\-]/g,'').slice(0,16).trim(),first:chosen?.dataset.to?{to:chosen.dataset.to,c:chosen.dataset.corridor}:null,mod:{...mods,paint:$('start-paint').value,paint2:$('start-paint2').value,rim:$('start-rim').value,livery:$('start-livery').value,tint:Number($('start-tint').value),plate:$('start-plate').value.toUpperCase().replace(/[^A-Z0-9 \-]/g,'').replace(/\s+/g,' ').slice(0,12),plateCat:$('start-platecat').value,spoiler:$('start-spoiler').checked,low:$('start-low').checked,stripe:$('start-stripe').checked}};}
 function select(time){if(begun||!Object.hasOwn(hours,time))return;choice=time;root.dataset.time=time;$('start-scene-time').textContent=labels[time];for(const b of root.querySelectorAll('[data-start-time]'))b.setAttribute('aria-pressed',String(b.dataset.startTime===time));}
 const hour=config().gh;if(typeof hour==='number')select(hour>=19||hour<5?'night':hour>=16.5?'dusk':'day');
 for(const b of root.querySelectorAll('[data-start-time]'))b.addEventListener('click',()=>select(b.dataset.startTime));
 const help=$('start-help-dialog');$('start-help-open').addEventListener('click',()=>help.showModal());
 reload.addEventListener('click',()=>win.location.reload());
 // account: the button opens the account window; after signing in it shows the player's name
 const acct=$('start-account');
 if(acct){const label=A=>{const u=A.currentUser();acct.textContent=u?A.displayName(u):'Masuk / Daftar';if(u&&$('start-name')&&!$('start-name').value)$('start-name').value=A.displayName(u);};
  account().then(A=>{A.setHooks({toast:t=>{status.textContent=t;},signedIn:()=>label(A)});A.init().then(u=>{label(A);if(u&&A.pending()==='mp-start'){$('start-trip').value='mp';$('start-trip').dispatchEvent(new Event('change'));}});
   acct.addEventListener('click',()=>{A.open('',()=>label(A));const iv=setInterval(()=>{label(A);if(doc.getElementById('acct')?.hidden)clearInterval(iv);},800);});}).catch(()=>{});}
 function update(value,message){amount=Math.max(amount,Math.min(100,value));progress.value=amount;$('start-load-percent').textContent=Math.round(amount)+'%';status.textContent=message;}
 const boot={active:false,async stage(value,message){update(value,message);await paint();}};win.TJ_BOOT=boot;
 async function start({direct=false}={}){
  if(begun||(!direct&&!preview()))return;
  // multiplayer needs an account: sign in first (a Google sign-in comes back to this page with Multiplayer still chosen)
  if(!direct&&$('start-trip').value==='mp'){let ok=true;try{const A=await account();A.init();if(!await A.signedIn()){ok=false;A.remember('mp-start');A.open('Multiplayer wajib masuk akun dulu.',()=>start());}}catch{}if(!ok)return;}
  if(!direct){const plan={...journey(),gh:hours[choice]};win.TJ_START_PLAN=plan;try{win.localStorage.setItem('tj_cfg1',JSON.stringify({...config(),...plan}));}catch{}}
  begun=true;boot.active=true;play.disabled=true;home.hidden=true;loading.hidden=false;root.dataset.state='loading';root.setAttribute('aria-busy','true');loading.focus();
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
