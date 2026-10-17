import {APP_CATALOG, APP_CATEGORIES, APP_BY_ID, createAppLibrary, UNITS, convert, calculate, formatNumber, DECKS, makeQuestion} from './phone-apps.js';

export const STORE_CSS = `
#phone .launcher{position:absolute;top:148px;bottom:118px;left:16px;right:16px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;padding:0 0 14px;touch-action:pan-y}
#phone .launcher::-webkit-scrollbar{display:none} #phone .launcher .inp{margin-bottom:14px;padding-left:12px;background:rgba(0,0,0,.2);color:inherit;font-size:11px}
#phone .ic span{max-width:63px;overflow:hidden;text-overflow:ellipsis} #phone .home .grid{row-gap:16px} #phone .store-tabs{display:flex;gap:6px;margin:8px 0;flex-wrap:wrap}
#phone .store-tabs button{border:0;border-radius:16px;background:var(--card);color:var(--ink);font:inherit;font-size:11px;padding:7px 12px;cursor:pointer}
#phone .store-tabs button.on{background:#1878f3;color:#fff} #phone .store-filter{padding-left:12px;margin-bottom:8px} #phone .store-row{display:flex;align-items:center;gap:8px;padding:11px 0;border-bottom:1px solid rgba(127,127,127,.18)}
#phone .store-detail{flex:1;min-width:0;display:flex;gap:9px;text-align:left;align-items:center;background:none;border:0;color:var(--ink);font:inherit;cursor:pointer;padding:0}
#phone .store-logo{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;flex:none;background:var(--g);color:#fff}
#phone .store-logo svg{width:23px;height:23px} #phone .store-name{min-width:0} #phone .store-name b{display:block;font-size:12px} #phone .store-name small{display:block;font-size:10px;color:var(--sub);line-height:1.3;margin-top:3px}
#phone .store-get{border:0;border-radius:18px;background:rgba(24,120,243,.16);color:#3d9bff;padding:7px 10px;font:700 10px system-ui;cursor:pointer;flex:none}
#phone .store-count{font-size:11px;color:var(--sub);margin:9px 0} #phone .store-cover{padding:22px 16px;background:linear-gradient(135deg,#1358c8,#832be2);border-radius:22px;margin-bottom:12px;color:#fff}
#phone .store-cover small{font-size:10px;letter-spacing:1.2px;text-transform:uppercase} #phone .store-cover h3{font-size:25px;line-height:1.15;margin:8px 0} #phone .store-cover p{font-size:11px;line-height:1.5;opacity:.85;margin:0}
#phone .mini-input{padding-left:12px;margin:6px 0} #phone .mini-label{display:block;font-size:11px;color:var(--sub);margin-top:8px} #phone .mini-result{font-size:20px;font-weight:800;overflow-wrap:anywhere;padding:16px 0}
#phone .mini-note{min-height:180px;resize:vertical;line-height:1.6} #phone .mini-actions{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0} #phone .mini-actions .btn{flex:1;min-width:65px;font-size:11px;padding:9px}
#phone .mini-status{font-size:11px;min-height:17px;color:var(--sub);line-height:1.5;overflow-wrap:anywhere} #phone .mini-list{list-style:none;margin:0;padding:0} #phone .mini-list li{display:flex;align-items:center;gap:7px;padding:9px 0;border-bottom:1px solid rgba(127,127,127,.2);font-size:12px;overflow-wrap:anywhere}
#phone .mini-list label{flex:1;min-width:0} #phone .mini-list .del{border:0;background:transparent;color:#ff5a4f;padding:7px;cursor:pointer} #phone .mini-list label.done{text-decoration:line-through;opacity:.55}
#phone .mini-board{display:grid;grid-template-columns:repeat(4,1fr);gap:7px} #phone .mini-board button{aspect-ratio:1;border:0;border-radius:12px;background:var(--card);color:var(--ink);font:800 21px system-ui;cursor:pointer}
#phone .mini-board button.face{background:#1878f3;color:white} #phone .mini-board button.matched{background:#15814a;color:white}
#phone .mini-tap{width:100%;height:150px;border-radius:24px;background:#1878f3;color:#fff;border:0;font:800 28px system-ui;cursor:pointer;touch-action:manipulation}
#phone .mini-palette{display:flex;border-radius:14px;overflow:hidden;margin:12px 0} #phone .mini-palette span{flex:1;height:90px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:8px;color:#fff;font:9px system-ui;text-shadow:0 1px 3px #000}
#phone .mini-draw{width:100%;height:250px;border-radius:14px;touch-action:none;display:block;border:1px solid #888}
#phone .mini-card{min-height:150px;width:100%;border:0;border-radius:20px;background:var(--card);color:var(--ink);font:700 24px system-ui;padding:18px;cursor:pointer}
#phone .store-detail:focus-visible,#phone .store-get:focus-visible,#phone .mini-board button:focus-visible{outline:2px solid #58a6ff;outline-offset:3px}
@media(prefers-reduced-motion:reduce){#phone .home.in .ic{animation:none}#phone .store-cover{animation:none}}
`;
const FIELD_LABELS = {kmh:'Kecepatan (km/jam)',place:'Jalan',time:'Jam game',fuel:'BBM (%)',left:'Sisa perjalanan',dest:'Tujuan',dmg:'Kerusakan (%)',veh:'Kendaraan',plate:'Plat nomor',etoll:'e-Toll',cash:'Tunai',arrive:'Perkiraan tiba',job:'Pekerjaan',jobGoal:'Tujuan pekerjaan',jobEarned:'Pendapatan pekerjaan',ride:'Penumpang',weather:'Cuaca',temp:'Suhu (°C)'};
const shuffle = list => {const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const numeric = input => {const v=input.value.trim();return v===''?NaN:Number(v);};
export function createPhoneStore(ctx){
  const {A,P,save,head,ic,esc,html,push,redraw,live,drawHome,openApp,setAccent} = ctx;
  const library = createAppLibrary(P.store, state=>{P.store=state;save();});
  P.store=library.snapshot();
  let query='',category='',installedOnly=false;
  const runtime = new Map();
  const read = a => library.read(a.id);
  const write = (a,d) => library.write(a.id,d);
  const status = (pg,msg) => {const n=pg.querySelector('.mini-status');if(n)n.textContent=msg;};
  const act = (pg,label,fn,cls='') => {const b=html(pg,`<button class="btn ${cls}">${esc(label)}</button>`);b.onclick=fn;return b;};
  const input = (pg,label,value='',type='text') => {const l=html(pg,`<label class="mini-label">${esc(label)}<input class="inp mini-input" type="${type}" ${type==='number'?'step="any"':''}></label>`);const i=l.querySelector('input');i.value=value;return i;};
  const result = pg => html(pg,'<div class="mini-result" role="status" aria-live="polite"></div>');
  const info = pg => html(pg,'<p class="mini-status" role="status" aria-live="polite"></p>');
  function install(id){if(library.install(id)){drawHome();A.sfx('ok');A.toast(`${APP_BY_ID.get(id).name} terpasang di HP`);}}
  function detail(a){push(pg=>{
    pg.innerHTML=head(a.name)+`<div class="store-cover" style="background:linear-gradient(135deg,${a.color},#172033)"><span class="store-logo" style="--g:${a.color}">${ic(a.icon)}</span><h3>${esc(a.name)}</h3><p>${esc(a.categoryName)} · versi ${a.version} · Gratis</p></div><div class="card"><p>${esc(a.description)}</p><p style="margin-top:8px">Aplikasi lokal di dalam game. Data disimpan pada perangkat ini.</p></div>`;
    act(pg,library.has(a.id)?'Buka aplikasi':'Pasang aplikasi',()=>{if(library.has(a.id))openApp(a.id);else{install(a.id);redraw();}});
    if(library.has(a.id))act(pg,'Hapus aplikasi',()=>{
      const warning=html(pg,'<div class="card"><h4>Hapus aplikasi dan datanya?</h4><p>Catatan dan progres aplikasi ini akan dihapus dari HP game.</p></div>');
      const b=document.createElement('button');b.className='btn red';b.textContent='Ya, hapus aplikasi';warning.append(b);b.onclick=()=>{library.uninstall(a.id);runtime.delete(a.id);drawHome();A.sfx('tap');redraw();};
    },'sec');
  });}
  function renderStore(pg){
    setAccent('#1878f3');
    pg.innerHTML=head('App Store')+`<div class="store-cover"><small>Untuk HP dalam game</small><h3>Dunia kecil.<br>Banyak kemungkinan.</h3><p>${APP_CATALOG.length} aplikasi gratis · ${APP_CATEGORIES.length} kategori</p></div><div class="srch">${ic('Search')}<input class="inp store-search" aria-label="Cari aplikasi" placeholder="Game, catatan, kalkulator…" maxlength="100"></div><div class="store-tabs"><button data-tab="all">Jelajahi</button><button data-tab="installed">Terpasang (${library.list().length})</button></div><select class="inp store-filter" aria-label="Kategori"><option value="">Semua kategori</option>${APP_CATEGORIES.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><div class="store-count" aria-live="polite"></div><div class="store-results"></div>`;
    const search=pg.querySelector('.store-search'),select=pg.querySelector('select'),list=pg.querySelector('.store-results');search.value=query;select.value=category;
    const show=()=>{
      const rows=library.search(query,category,installedOnly);pg.querySelector('.store-count').textContent=`${rows.length} aplikasi${installedOnly?' terpasang':''}`;
      pg.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',(b.dataset.tab==='installed')===installedOnly));
      list.innerHTML=rows.map(a=>`<div class="store-row"><button class="store-detail" data-detail="${a.id}" aria-label="Detail ${esc(a.name)}"><span class="store-logo" style="--g:linear-gradient(145deg,${a.color},#172033)">${ic(a.icon)}</span><span class="store-name"><b>${esc(a.name)}</b><small>${esc(a.categoryName)}</small></span></button><button class="store-get" data-get="${a.id}" aria-label="${library.has(a.id)?'Buka':'Pasang'} ${esc(a.name)}">${library.has(a.id)?'BUKA':'DAPATKAN'}</button></div>`).join('')||'<div class="card"><p>Tidak ada aplikasi yang cocok.</p></div>';
    };
    search.oninput=()=>{query=search.value;show();};select.onchange=()=>{category=select.value;show();};
    pg.querySelector('.store-tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(b){installedOnly=b.dataset.tab==='installed';show();}};
    list.onclick=e=>{const d=e.target.closest('[data-detail]'),g=e.target.closest('[data-get]');if(d)detail(APP_BY_ID.get(d.dataset.detail));if(g){const id=g.dataset.get;if(library.has(id))openApp(id);else{install(id);show();pg.querySelector('[data-tab="installed"]').textContent=`Terpasang (${library.list().length})`;}}};
    show();
  }
  const ENGINES = {};
  ENGINES.notes = (pg,a) => {
    const text=html(pg,'<textarea class="inp mini-input mini-note" maxlength="4000" aria-label="Catatan" placeholder="Mulai menulis…"></textarea>');text.value=read(a).text||'';info(pg);
    text.oninput=()=>{write(a,{text:text.value});status(pg,`Tersimpan · ${text.value.length}/4000 karakter`);};status(pg,'Tersimpan otomatis di HP game.');
    act(pg,'Salin catatan',()=>copy(text.value,pg),'sec');
  };
  ENGINES.checklist = (pg,a) => {
    const d=read(a),items=Array.isArray(d.items)?d.items:a.items.map(text=>({text,done:false}));
    const box=html(pg,`<ul class="mini-list">${items.map((v,i)=>`<li><input type="checkbox" data-check="${i}" aria-label="Selesai: ${esc(v.text)}" ${v.done?'checked':''}><label class="${v.done?'done':''}">${esc(v.text)}</label><button class="del" data-del="${i}" aria-label="Hapus ${esc(v.text)}">×</button></li>`).join('')}</ul>`);
    box.onchange=e=>{const i=e.target.dataset.check;if(i!=null){items[+i].done=e.target.checked;write(a,{items});redraw();}};
    box.onclick=e=>{const b=e.target.closest('[data-del]');if(b){items.splice(+b.dataset.del,1);write(a,{items});redraw();}};
    const text=input(pg,'Item baru');text.maxLength=120;
    const add=()=>{if(!text.value.trim())return;if(items.length>=60){A.toast('Maksimal 60 item per daftar');return;}items.push({text:text.value.trim(),done:false});write(a,{items});redraw();};
    act(pg,'Tambah item',add);text.onkeydown=e=>{if(e.key==='Enter')add();};info(pg);status(pg,`${items.filter(x=>x.done).length}/${items.length} selesai`);
  };
  ENGINES.arithmetic = (pg,a) => {
    const one=input(pg,'Angka pertama',read(a).one||'','number'),op=html(pg,'<select class="inp mini-input" aria-label="Operasi"><option>+</option><option>−</option><option>×</option><option>÷</option></select>'),two=input(pg,'Angka kedua',read(a).two||'','number'),out=result(pg);
    act(pg,'Hitung',()=>{const x=numeric(one),y=numeric(two);if(!Number.isFinite(x)||!Number.isFinite(y)){out.textContent='Masukkan dua angka.';return;}const r=op.value==='+'?x+y:op.value==='−'?x-y:op.value==='×'?x*y:x/y;out.textContent=Number.isFinite(r)?formatNumber(r):'Tidak dapat dibagi nol.';write(a,{one:one.value,two:two.value});});
  };
  ENGINES.calculator = (pg,a) => {
    const inputs=a.labels.map((label,i)=>input(pg,label,read(a).values?.[i]??'','number')),out=result(pg);
    act(pg,'Hitung',()=>{try{const r=calculate(a.mode,inputs.map(numeric));out.textContent=typeof r==='number'?formatNumber(r):r;write(a,{values:inputs.map(i=>i.value)});}catch(e){out.textContent=e.message;}});
  };
  ENGINES.converter = (pg,a) => {
    const units=UNITS[a.family],d=read(a),value=input(pg,'Nilai',d.value??'1','number');
    const select=label=>{const l=html(pg,`<label class="mini-label">${label}<select class="inp mini-input">${units.map(([u],i)=>`<option value="${i}">${esc(u)}</option>`).join('')}</select></label>`);return l.querySelector('select');};
    const from=select('Dari'),to=select('Ke');from.value=String(d.from||0);to.value=String(d.to??1);const out=result(pg);
    const update=()=>{try{out.textContent=`${formatNumber(convert(numeric(value),a.family,+from.value,+to.value))} ${units[+to.value][0]}`;write(a,{value:value.value,from:+from.value,to:+to.value});}catch(e){out.textContent=e.message;}};value.oninput=from.onchange=to.onchange=update;update();
  };
  ENGINES.ledger = (pg,a) => {
    const entries=read(a).entries||[],total=entries.reduce((n,x)=>n+x.value,0);html(pg,`<div class="mini-result">${esc(a.unit)} ${formatNumber(total)}</div>`);
    const name=input(pg,'Keterangan'),value=input(pg,'Nilai (negatif untuk pengurangan)','','number');name.maxLength=80;info(pg);
    act(pg,'Simpan catatan',()=>{const n=numeric(value);if(!name.value.trim()||!Number.isFinite(n))return status(pg,'Isi keterangan dan angka yang valid.');if(entries.length>=60)return status(pg,'Maksimal 60 catatan. Hapus catatan lama terlebih dulu.');entries.unshift({name:name.value.trim(),value:n});write(a,{entries});redraw();});
    const list=html(pg,`<ul class="mini-list">${entries.map((v,i)=>`<li><label>${esc(v.name)}<br><b>${esc(a.unit)} ${formatNumber(v.value)}</b></label><button class="del" data-i="${i}" aria-label="Hapus catatan">×</button></li>`).join('')}</ul>`);list.onclick=e=>{const b=e.target.closest('[data-i]');if(b){entries.splice(+b.dataset.i,1);write(a,{entries});redraw();}};
  };
  ENGINES.timer = (pg,a) => {
    let d={remaining:a.minutes*60000,minutes:a.minutes,...read(a)};const minutes=input(pg,'Durasi (menit)',d.minutes,'number'),out=result(pg);info(pg);
    const remaining=()=>d.end?Math.max(0,d.end-Date.now()):d.remaining;
    const paint=()=>{const n=Math.ceil(remaining()/1000);out.textContent=`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;if(d.end&&n===0){d={...d,remaining:0,end:null};write(a,d);status(pg,'Waktu selesai.');A.sfx('ok');}};
    act(pg,d.end?'Jeda':'Mulai / lanjutkan',()=>{if(d.end){d={...d,remaining:remaining(),end:null};}else{const n=numeric(minutes);if(n<=0||n>240||!Number.isFinite(n))return status(pg,'Durasi harus lebih dari 0 sampai 240 menit.');if(n!==d.minutes||!d.remaining)d.remaining=n*60000;d.minutes=n;d.end=Date.now()+d.remaining;}write(a,d);redraw();});
    act(pg,'Atur ulang',()=>{const n=numeric(minutes);if(n<=0||n>240||!Number.isFinite(n))return status(pg,'Durasi harus lebih dari 0 sampai 240 menit.');d={remaining:n*60000,minutes:n};write(a,d);redraw();},'sec');paint();live(paint);
  };
  ENGINES.stopwatch = (pg,a) => {
    let d={elapsed:0,laps:[],...read(a)},out=result(pg);const elapsed=()=>d.elapsed+(d.start?Date.now()-d.start:0);
    const paint=()=>{const n=elapsed()/1000;out.textContent=`${Math.floor(n/60)}:${(n%60).toFixed(1).padStart(4,'0')}`;};
    act(pg,d.start?'Jeda':'Mulai',()=>{d=d.start?{...d,elapsed:elapsed(),start:null}:{...d,start:Date.now()};write(a,d);redraw();});
    act(pg,'Catat putaran',()=>{d.laps=[elapsed(),...d.laps].slice(0,12);write(a,d);redraw();},'sec');act(pg,'Reset',()=>{write(a,{elapsed:0,laps:[]});redraw();},'sec');
    html(pg,`<div class="card">${d.laps.map((n,i)=>`<p>Putaran ${d.laps.length-i}: ${(n/1000).toFixed(1)} dtk</p>`).join('')}</div>`);paint();live(paint);
  };
  ENGINES.quiz = (pg,a) => {
    const d=read(a),r=runtime.get(a.id)||{q:makeQuestion(a.topic)};runtime.set(a.id,r);
    html(pg,`<div class="card"><p>Benar ${d.correct||0} / ${d.total||0}</p><h3>${esc(r.q.text)}</h3></div>`);const answer=input(pg,'Jawaban','','number');info(pg);
    const submit=act(pg,'Periksa',()=>{const value=numeric(answer);if(!Number.isFinite(value))return status(pg,'Isi jawaban dulu.');const ok=Math.abs(value-r.q.answer)<1e-7;write(a,{total:(d.total||0)+1,correct:(d.correct||0)+(ok?1:0)});status(pg,`${ok?'Benar!':'Belum tepat.'} ${r.q.explanation}`);submit.disabled=true;answer.disabled=true;});
    act(pg,'Soal berikutnya',()=>{runtime.set(a.id,{q:makeQuestion(a.topic)});redraw();},'sec');
  };
  ENGINES.flashcards = (pg,a) => {
    const deck=DECKS[a.deck],d=read(a),index=(d.index||0)%deck.length;let flipped=false;
    html(pg,`<p class="store-count">Kartu ${index+1}/${deck.length} · tekan kartu untuk membalik</p>`);const card=html(pg,`<button class="mini-card">${esc(deck[index][0])}</button>`);card.onclick=()=>{flipped=!flipped;card.textContent=deck[index][flipped?1:0];};
    act(pg,'Kartu berikutnya',()=>{write(a,{index:(index+1)%deck.length});redraw();});act(pg,'Kartu sebelumnya',()=>{write(a,{index:(index+deck.length-1)%deck.length});redraw();},'sec');
  };
  ENGINES.places = (pg,a) => {
    const query=input(pg,'Cari lokasi di game',a.query),list=html(pg,'<div class="card"></div>');
    const show=()=>{const places=A.places(query.value).slice(0,20);list.innerHTML=places.map((p,i)=>`<button class="btn sec" data-i="${i}" style="justify-content:space-between;text-align:left">${esc(p.name)} <small>${p.km} km</small></button>`).join('')||'<p>Belum ada lokasi yang cocok. Coba kata lain.</p>';list.onclick=e=>{const b=e.target.closest('[data-i]');if(b){A.nav.set(places[+b.dataset.i].key);openApp('peta');}};};query.oninput=show;show();
  };
  ENGINES['random-place'] = (pg,a) => {
    let place=runtime.get(a.id);const out=result(pg);out.textContent=place?.name||'Mau ke mana?';
    act(pg,'Undi kota',()=>{const choices=A.places('','kota');if(!choices.length)return;place=choices[Math.floor(Math.random()*choices.length)];runtime.set(a.id,place);out.textContent=`${place.name} · ${place.km} km`;});
    act(pg,'Navigasi ke kota ini',()=>{if(place){A.nav.set(place.key);openApp('peta');}},'sec');
  };
  ENGINES.dashboard = (pg,a) => {
    const box=html(pg,'<div class="card"></div>');const paint=()=>{const s=A.state();box.innerHTML=a.fields.map(k=>`<p>${FIELD_LABELS[k]}</p><div class="mini-result" style="font-size:19px;padding:8px 0 14px">${esc(s[k]===''||s[k]==null?'—':s[k])}</div>`).join('');};paint();live(paint);
    act(pg,'Buka peta',()=>openApp('peta'),'sec');act(pg,'Lihat kendaraan',()=>openApp('kendaraan'),'sec');
  };
  ENGINES.snapshot = (pg,a) => {
    const out=html(pg,'<div class="card"><p style="white-space:pre-wrap"></p></div>');out.firstElementChild.textContent=read(a).text||'Belum ada ringkasan tersimpan.';
    act(pg,'Simpan kondisi sekarang',()=>{const s=A.state();const text=`${s.time} · ${s.place}\nTujuan: ${s.dest||'Keliling bebas'}\nKecepatan: ${s.kmh} km/jam\nBBM: ${s.fuel}%\nSisa: ${s.left}`;write(a,{text});redraw();});
  };
  ENGINES.picker = (pg,a) => {
    const items=input(pg,'Pilihan (pisahkan dengan koma)',read(a).items||a.items.join(', '));items.maxLength=1000;const out=result(pg);info(pg);
    act(pg,'Pilih acak',()=>{const options=items.value.split(',').map(s=>s.trim()).filter(Boolean);if(!options.length)return status(pg,'Tambahkan minimal satu pilihan.');out.textContent=options[Math.floor(Math.random()*options.length)];write(a,{items:items.value});});
  };
  ENGINES.text = (pg,a) => {
    const text=html(pg,'<textarea class="inp mini-input mini-note" maxlength="4000" aria-label="Teks"></textarea>');text.value=read(a).text||'';const out=result(pg);info(pg);
    const paint=()=>{out.textContent=`${text.value.length} karakter · ${text.value.trim()?text.value.trim().split(/\s+/).length:0} kata`;write(a,{text:text.value});};text.oninput=paint;
    const change=fn=>()=>{text.value=fn(text.value);paint();};
    if(a.mode==='reverse')act(pg,'Balik karakter',change(s=>Array.from(s).reverse().join('')));
    else if(a.mode==='slug')act(pg,'Buat slug',change(s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')));
    else{act(pg,'HURUF BESAR',change(s=>s.toUpperCase()),'sec');act(pg,'huruf kecil',change(s=>s.toLowerCase()),'sec');act(pg,'Huruf Judul',change(s=>s.replace(/\S+/g,w=>w[0].toUpperCase()+w.slice(1).toLowerCase())),'sec');}
    act(pg,'Salin teks',()=>copy(text.value,pg),'sec');paint();
  };
  ENGINES.guess = (pg,a) => {
    const d=read(a),secret=Number.isInteger(d.secret)?d.secret:1+Math.floor(Math.random()*a.max);if(!d.secret)write(a,{secret,tries:0});
    const answer=input(pg,`Angka 1–${a.max}`,'','number'),out=result(pg);out.textContent=d.won?`Tepat! ${d.tries} percobaan`:`${d.tries||0} percobaan`;info(pg);
    act(pg,'Tebak',()=>{if(read(a).won)return;const n=numeric(answer);if(!Number.isInteger(n)||n<1||n>a.max)return status(pg,`Masukkan bilangan bulat 1–${a.max}.`);const current=read(a);write(a,{secret,tries:(current.tries||0)+1,won:n===secret});out.textContent=n===secret?'Tepat!':n<secret?'Lebih besar ↑':'Lebih kecil ↓';status(pg,`${read(a).tries} percobaan`);});
    act(pg,'Main baru',()=>{write(a,{secret:1+Math.floor(Math.random()*a.max),tries:0});redraw();},'sec');
  };
  ENGINES.dice = (pg,a) => {
    const out=result(pg);out.textContent=read(a).last||'Siap diundi';act(pg,a.sides===2?'Lempar koin':'Lempar dadu',()=>{const nums=Array.from({length:a.count},()=>1+Math.floor(Math.random()*a.sides));const text=a.sides===2?(nums[0]===1?'Angka':'Gambar'):nums.join(' + ')+(a.count>1?' = '+nums.reduce((n,x)=>n+x,0):'');out.textContent=text;write(a,{last:text});A.sfx('tap');});
  };
  ENGINES.memory = (pg,a) => {
    const symbols={colors:['🔴','🔵','🟢','🟡','🟣','🟠'],shapes:['●','■','▲','◆','★','♥'],numbers:['1','2','3','4','5','6'],letters:['A','B','C','D','E','F']}[a.theme];
    let r=runtime.get(a.id);if(!r){r={cards:shuffle([...symbols,...symbols]),matched:[],open:[],moves:0};runtime.set(a.id,r);}
    const board=html(pg,'<div class="mini-board"></div>');info(pg);
    const paint=()=>{board.innerHTML=r.cards.map((v,i)=>`<button data-i="${i}" class="${r.matched.includes(i)?'matched':r.open.includes(i)?'face':''}" aria-label="Kartu ${i+1}${r.matched.includes(i)?' cocok':''}">${r.open.includes(i)||r.matched.includes(i)?v:'?'}</button>`).join('');status(pg,`${r.moves} langkah · ${r.matched.length/2}/6 pasangan${r.matched.length===12?' · Selesai!':''}`);};
    board.onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;const i=+b.dataset.i;if(r.matched.includes(i)||r.open.includes(i))return;if(r.open.length===2)r.open=[];r.open.push(i);if(r.open.length===2){r.moves++;if(r.cards[r.open[0]]===r.cards[r.open[1]]){r.matched.push(...r.open);r.open=[];if(r.matched.length===12)write(a,{best:Math.min(read(a).best||Infinity,r.moves)});}}paint();};
    act(pg,'Acak ulang',()=>{runtime.delete(a.id);redraw();},'sec');paint();
  };
  ENGINES.reaction = (pg,a) => {
    let r=runtime.get(a.id)||{phase:'idle'};runtime.set(a.id,r);const tap=html(pg,'<button class="mini-tap">Mulai</button>');info(pg);
    const paint=()=>{if(r.phase==='waiting'&&Date.now()>=r.ready){r.phase='go';r.go=Date.now();}tap.style.background=r.phase==='go'?'#15814a':r.phase==='waiting'?'#c24036':'#1878f3';tap.textContent=r.phase==='go'?'TEKAN!':r.phase==='waiting'?'Tunggu hijau…':'Mulai lagi';};
    tap.onclick=()=>{if(r.phase==='go'){const ms=Date.now()-r.go;r.phase='idle';write(a,{best:Math.min(read(a).best||Infinity,ms)});status(pg,`${ms} ms · terbaik ${read(a).best} ms`);}else if(r.phase==='waiting'){r.phase='idle';status(pg,'Terlalu cepat. Tunggu lampu hijau.');}else{r.phase='waiting';r.ready=Date.now()+a.delay+Math.random()*2500;status(pg,'Tunggu…');}paint();};paint();live(paint);
  };
  ENGINES.tap = (pg,a) => {
    let r=runtime.get(a.id)||{count:0,end:0};runtime.set(a.id,r);const tap=html(pg,'<button class="mini-tap">Mulai</button>');info(pg);
    const paint=()=>{const left=Math.max(0,r.end-Date.now());tap.textContent=r.end?`${r.count} TAP`:'Mulai';status(pg,r.end?`${(left/1000).toFixed(1)} dtk · terbaik ${read(a).best||0}`:`Waktu: ${a.seconds} detik`);if(r.end&&!left){if(!r.finished){r.finished=true;write(a,{best:Math.max(read(a).best||0,r.count)});}status(pg,`Selesai: ${r.count} tap · terbaik ${read(a).best}`);}};
    tap.onclick=()=>{if(!r.end){r.end=Date.now()+a.seconds*1000;r.count=0;}else if(Date.now()<r.end)r.count++;paint();};act(pg,'Reset',()=>{runtime.delete(a.id);redraw();},'sec');paint();live(paint);
  };
  ENGINES.palette = (pg,a) => {
    const box=html(pg,'<div class="mini-palette"></div>');info(pg);let colors=read(a).colors;
    const paint=()=>{box.innerHTML=colors.map(c=>`<span style="background:${c}">${c}</span>`).join('');};
    const generate=()=>{colors=Array.from({length:5},(_,i)=>hslHex((a.hue+i*13+Math.random()*30)%360,60,24+i*12));write(a,{colors});paint();};
    if(!colors)generate();else paint();act(pg,'Palet baru',generate);act(pg,'Salin warna',()=>copy(colors.join(', '),pg),'sec');
  };
  ENGINES.drawing = (pg,a) => {
    const canvas=html(pg,`<canvas class="mini-draw" width="480" height="500" aria-label="Kanvas gambar"></canvas>`),color=input(pg,'Warna pena','#1878f3','color'),width=input(pg,'Ketebalan',4,'number');
    let strokes=read(a).strokes||[],current=null;const x=canvas.getContext('2d');info(pg);if(!x){status(pg,'Kanvas tidak tersedia di perangkat ini.');return;}
    const paint=()=>{x.fillStyle=a.paper;x.fillRect(0,0,480,500);for(const s of strokes){x.lineWidth=s.w;x.strokeStyle=s.c;x.lineCap=x.lineJoin='round';x.beginPath();s.p.forEach(([px,py],i)=>i?x.lineTo(px,py):x.moveTo(px,py));x.stroke();}};
    const point=e=>{const b=canvas.getBoundingClientRect();return [Math.round((e.clientX-b.left)/b.width*480),Math.round((e.clientY-b.top)/b.height*500)];};
    canvas.onpointerdown=e=>{if(strokes.length>=100||strokes.reduce((n,s)=>n+s.p.length,0)>=700)return status(pg,'Kanvas penuh. Gunakan Urungkan atau Bersihkan.');canvas.setPointerCapture(e.pointerId);current={c:color.value,w:Math.max(1,Math.min(30,numeric(width)||4)),p:[point(e)]};strokes.push(current);paint();};
    canvas.onpointermove=e=>{if(!current||strokes.reduce((n,s)=>n+s.p.length,0)>=700)return;current.p.push(point(e));paint();};
    canvas.onpointerup=canvas.onpointercancel=()=>{current=null;write(a,{strokes});status(pg,'Gambar tersimpan.');};
    act(pg,'Urungkan',()=>{strokes.pop();write(a,{strokes});paint();},'sec');act(pg,'Bersihkan',()=>{strokes=[];write(a,{strokes});paint();},'sec');paint();
  };
  async function copy(text,pg){try{await navigator.clipboard.writeText(text);status(pg,'Disalin.');}catch{status(pg,'Pilih teks untuk menyalin secara manual.');}}
  function renderApp(pg,id){
    const a=APP_BY_ID.get(id);if(!a||!library.has(id)){pg.innerHTML=head('Aplikasi belum dipasang');act(pg,'Buka App Store',()=>openApp('appstore'));return;}
    setAccent(a.color);pg.innerHTML=head(a.name)+`<div class="card"><p>${esc(a.description)}</p></div>`;ENGINES[a.kind](pg,a);
  }
  return {library,renderStore,renderApp,engines:Object.keys(ENGINES),installed:()=>library.list().map(a=>({...a,gradient:`linear-gradient(145deg,${a.color},#172033)`}))};
}
function hslHex(h,s,l){s/=100;l/=100;const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};return '#'+f(0)+f(8)+f(4);}
