// Paged launcher and persistent home-screen customization for the game phone.
const WIDGETS = {wallet:'Dompet',drive:'Perjalanan',clock:'Jam',weather:'Cuaca',trip:'Tujuan',car:'Kendaraan'};
const PROTECTED = new Set(['appstore']);
export function normalizeHomeLayout(raw, ids) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const known=new Set(ids),unique=list=>[...new Set(Array.isArray(list)?list:[])].filter(id=>known.has(id));
  const baseOrder=unique(raw.order),labels=Object.create(null);for(const id of ids)if(typeof raw.labels?.[id]==='string')labels[id]=raw.labels[id].trim().slice(0,24);
  return {order:[...baseOrder,...ids.filter(id=>!baseOrder.includes(id))],hidden:unique(raw.hidden).filter(id=>!PROTECTED.has(id)),labels,
    dock:unique(raw.dock??['telepon','pesan','peta','kamera']).slice(0,4),
    widgets:Array.isArray(raw.widgets)?raw.widgets.filter(k=>Object.hasOwn(WIDGETS,k)).slice(0,2):['wallet','drive'],
    widgetSize:raw.widgetSize==='large'?'large':'compact',iconSize:raw.iconSize==='small'?'small':'normal',showLabels:raw.showLabels!==false};
}
export function moveHomeApp(order,id,offset){const out=[...order],i=out.indexOf(id);if(i<0)return out;const at=Math.max(0,Math.min(out.length-1,i+offset));out.splice(i,1);out.splice(at,0,id);return out;}
export function homePageSize(layout,editing=false){return !layout.widgets.length?(editing?12:16):layout.widgetSize==='large'?8:12;}

export const HOME_CSS = `
#phone .launcher{overflow:hidden;padding:0;touch-action:auto;top:var(--home-top,148px)}
#phone .launcher .home-search{height:32px;margin:0 0 8px;padding-right:36px;box-sizing:border-box}
#phone .home-search-tools{position:relative} #phone .home-edit{position:absolute;right:2px;top:1px;width:30px;height:30px;border:0;background:none;color:var(--ink);display:grid;place-items:center;cursor:pointer}
#phone .home-edit svg{width:17px;height:17px}
#phone .home-pages{display:flex;width:100%;height:calc(100% - 70px);overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain;touch-action:pan-x;scroll-behavior:smooth;cursor:grab}
#phone .home-pages::-webkit-scrollbar{display:none} #phone .home-page{flex:0 0 100%;width:100%;min-width:0;scroll-snap-align:start;scroll-snap-stop:always;box-sizing:border-box;padding:1px 2px 8px}
#phone .home-page .grid{grid-template-columns:repeat(4,minmax(0,1fr));align-content:start;row-gap:13px} #phone .home-page .ic{min-width:0;width:100%} #phone .home-page .ic span{max-width:100%} #phone .home-page .ic i{width:52px;height:52px}
#phone .home-pages.dragging{scroll-snap-type:none;scroll-behavior:auto;cursor:grabbing}
#phone .page-nav{height:30px;display:flex;align-items:center;justify-content:center;gap:6px}
#phone .page-arrow{border:0;background:none;color:var(--ink);cursor:pointer;width:25px;height:28px;display:grid;place-items:center} #phone .page-arrow svg{width:16px;height:16px} #phone .page-arrow:disabled{opacity:.25;cursor:default}
#phone .page-dots{display:flex;align-items:center;justify-content:center;gap:2px;max-width:176px;overflow-x:auto;scrollbar-width:none}
#phone .page-dot{border:0;background:none;width:12px;height:22px;flex:none;padding:0;cursor:pointer;position:relative}
#phone .page-dot::after{content:'';position:absolute;width:5px;height:5px;border-radius:50%;background:var(--ink);opacity:.35;left:3px;top:8px;transition:opacity .2s,transform .2s}
#phone .page-dot.on::after{opacity:1;transform:scale(1.4)}
#phone .wid{grid-template-columns:repeat(2,minmax(0,1fr));height:78px} #phone .wid>div{height:78px;min-width:0} #phone .wid b{font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #phone .wid small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #phone .home-widgets-large .wid{height:114px} #phone .home-widgets-large .wid>div{height:114px} #phone .home-widgets-large .wid b{font-size:21px}
#phone .wid>div{cursor:pointer;overflow:hidden;touch-action:pan-x} #phone .wid>div:focus-visible{outline:2px solid #58a6ff}
#phone .wid:empty{display:none} #phone .home-tools{position:absolute;left:16px;right:16px;top:58px;height:76px;display:none;z-index:4;background:var(--sheet);border-radius:18px;padding:9px;box-sizing:border-box}
#phone .home-tools .tool-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;align-items:center;margin-bottom:5px} #phone .home-tools button{border:0;border-radius:12px;padding:6px 3px;font:700 9px system-ui;cursor:pointer;color:var(--ink);background:var(--card)}
#phone .home-tools button.done{background:#1878f3;color:#fff;margin-left:0} #phone .home-tools small{font-size:10px;display:block;color:var(--sub)}
#phone .home-editing .launcher{top:max(148px,var(--home-top,148px))} #phone .home-editing .home-tools{display:block} #phone .home-editing .wid{visibility:hidden} #phone .home-editing .ic i{animation:homeWiggle .23s ease-in-out infinite alternate}
#phone .home-editing .ic:nth-child(even) i{animation-delay:-.13s} #phone .ic.moving i{outline:3px solid #4fc3ff;outline-offset:3px}
#phone .home-no-labels .ic span{display:none} #phone .home-small-icons .home-page .ic i{width:42px;height:42px} #phone .home-small-icons .home-page .ic i svg{width:23px;height:23px}
#phone .home-overlay{position:absolute;inset:0;z-index:20;background:rgba(0,0,0,.3);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);border-radius:37px;display:flex;align-items:flex-end;padding:8px 8px 24px;box-sizing:border-box;animation:phIn .18s both}
#phone .home-menu{width:100%;max-height:calc(100% - 46px);overflow-y:auto;background:var(--abg);border:1px solid rgba(127,127,127,.25);border-radius:22px;padding:14px;box-sizing:border-box;color:var(--ink);box-shadow:0 -8px 30px rgba(0,0,0,.3)}
#phone .home-menu h3{font-size:17px;margin:0 0 8px} #phone .home-menu p{font-size:11px;color:var(--sub);line-height:1.5}
#phone .home-menu label{display:block;font-size:11px;margin:8px 0;color:var(--sub)} #phone .home-menu .inp{padding-left:12px;margin:5px 0;font-size:12px}
#phone .home-menu .btn{font-size:12px;padding:9px} #phone .home-menu .mini-actions .btn{padding:8px;font-size:10px}
#phone .home-menu .home-message{font-size:11px;color:#58a6ff;margin:6px 0;min-height:15px} #phone .home-empty{grid-column:1/-1;font-size:12px;text-align:center;color:var(--sub);padding:20px 4px}
@keyframes homeWiggle{from{transform:rotate(-2deg)}to{transform:rotate(2deg)}}
@media(prefers-reduced-motion:reduce){#phone .home-pages{scroll-behavior:auto}#phone .home-editing .ic i,#phone .home-overlay{animation:none}#phone .page-dot::after{transition:none}}
`;
export function createPhoneHome({home,P,A,save,getApps,icon,openApp,ic,esc,uninstall,isInstalled}){
  const q=s=>home.querySelector(s),viewport=q('.home-pages');let layout,page=0,editing=false,moving=null,hold=null,press=null,suppressUntil=0,restoreFocus=null;
  const apps=()=>getApps(),ids=()=>apps().map(a=>a.k),byId=id=>apps().find(a=>a.k===id);
  const persist=()=>{P.homeLayout=layout;save();};
  const label=a=>layout.labels[a.k]||a.name;
  const stopHold=()=>{clearTimeout(hold);hold=null;};
  function dismiss(){q('.home-overlay')?.remove();restoreFocus?.focus?.({preventScroll:true});restoreFocus=null;}
  function finish(){stopHold();dismiss();moving=null;const was=editing;editing=false;home.classList.remove('home-editing');if(was)render();}
  function startEdit(){const was=editing;editing=true;home.classList.add('home-editing');if(!was)render();updateTools();}
  function updateTools(){const box=q('.home-tools');box.innerHTML=`<div class="tool-row"><button data-home-action="widgets">Widget</button><button data-home-action="appearance">Tampilan</button><button data-home-action="hidden">Tersembunyi</button><button class="done" data-home-action="done">Selesai</button></div><small>${moving?'Pilih ikon tujuan untuk menukar posisi.':'Tahan ikon untuk mengatur. Geser untuk pindah halaman.'}</small>`;}
  function indicators(){const total=q('.home-pages').children.length;page=Math.max(0,Math.min(page,total-1));q('.page-dots').innerHTML=Array.from({length:total},(_,i)=>`<button class="page-dot ${i===page?'on':''}" data-page="${i}" aria-label="Halaman ${i+1} dari ${total}" ${i===page?'aria-current="page"':''}></button>`).join('');q('[data-home-prev]').disabled=page===0;q('[data-home-next]').disabled=page>=total-1;q('.page-dots').scrollLeft=Math.max(0,page*14-(q('.page-dots').clientWidth||176)/2);}
  function go(index){const total=viewport.children.length;page=Math.max(0,Math.min(index,total-1));const left=page*(viewport.clientWidth||244);if(viewport.scrollTo)viewport.scrollTo({left,behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});else viewport.scrollLeft=left;indicators();}
  function render(anim){
    layout=normalizeHomeLayout(P.homeLayout,ids());const appMap=new Map(apps().map(a=>[a.k,a]));
    home.classList.toggle('home-small-icons',layout.iconSize==='small');home.classList.toggle('home-no-labels',!layout.showLabels);home.classList.toggle('home-widgets-large',layout.widgetSize==='large');
    home.style.setProperty('--home-top',!layout.widgets.length?'72px':layout.widgetSize==='large'?'188px':'148px');
    const search=q('.home-search').value.trim().toLocaleLowerCase('id-ID'),list=layout.order.filter(id=>!layout.hidden.includes(id)).map(id=>appMap.get(id)).filter(a=>!search||`${label(a)} ${a.name}`.toLocaleLowerCase('id-ID').includes(search));
    const size=homePageSize(layout,editing),chunks=[];for(let i=0;i<list.length;i+=size)chunks.push(list.slice(i,i+size));if(!chunks.length)chunks.push([]);
    viewport.innerHTML=chunks.map((items,i)=>`<section class="home-page" aria-label="Halaman aplikasi ${i+1}"><div class="grid">${items.map(a=>icon({...a,name:label(a)}).replace('class="ic"',`class="ic${moving===a.k?' moving':''}"`)).join('')||'<p class="home-empty">Tidak ada aplikasi.</p>'}</div></section>`).join('');
    q('.dock').innerHTML=layout.dock.map(id=>appMap.get(id)).filter(Boolean).map(a=>icon({...a,name:label(a)})).join('');
    q('.dock').style.gridTemplateColumns=`repeat(${Math.max(1,layout.dock.length)},1fr)`;
    indicators();viewport.scrollLeft=page*(viewport.clientWidth||244);widgets();updateTools();
    if(anim){home.classList.remove('in');void home.offsetWidth;home.classList.add('in');q('.home-page')?.querySelectorAll('.ic').forEach((b,i)=>b.style.animationDelay=`${i*22}ms`);}
  }
  function widgets(){if(!layout)return;const s=A.state(),clock=s.time||'--:--',defs={
    wallet:['Uang tunai',A.rpS(s.cash),`e-Toll ${A.rpS(s.etoll)}`],drive:[s.place||'Perjalanan',`${s.kmh} km/j`,s.job||`${s.fuelLabel||'BBM'} ${s.fuel}%`],
    clock:['Jam game',clock,'Waktu dalam simulasi'],weather:['Cuaca',`${s.temp??'—'}°`,s.weather||'—'],trip:['Tujuan',s.dest||'Keliling',s.left||'Pilih tujuan di Peta'],car:['Kendaraan',s.veh||'Mobil',`Kerusakan ${s.dmg}%`]};
    q('.wid').innerHTML=layout.widgets.map((k,i)=>{const d=defs[k];return `<div data-widget="${i}" role="button" tabindex="0" aria-label="${WIDGETS[k]}, tahan untuk mengedit"><small>${esc(d[0])}</small><b>${esc(d[1])}</b><small>${esc(d[2])}</small></div>`;}).join('');
  }
  function sheet(title,build){dismiss();restoreFocus=document.activeElement?.closest('.ic,[data-widget]')||null;const overlay=document.createElement('div');overlay.className='home-overlay';overlay.innerHTML=`<section class="home-menu" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3><div class="home-message" role="status"></div></section>`;home.append(overlay);const panel=overlay.firstElementChild;
    const button=(text,fn,cls='')=>{const b=document.createElement('button');b.className='btn '+cls;b.textContent=text;b.onclick=fn;panel.append(b);return b;};
    const field=(name,type,value,options)=>{const l=document.createElement('label');l.textContent=name;const input=document.createElement(type==='select'?'select':'input');input.className='inp';if(type==='select')input.innerHTML=options.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('');else{input.type=type;input.maxLength=24;}input.value=value;l.append(input);panel.append(l);return input;};
    const msg=text=>{panel.querySelector('.home-message').textContent=text;};build({panel,button,field,msg});button('Tutup',dismiss,'sec');overlay.onclick=e=>{if(e.target===overlay)dismiss();};panel.querySelector('input,select,button')?.focus({preventScroll:true});
  }
  function appMenu(id,from){const a=byId(id);if(!a)return;startEdit();
    sheet(label(a),({button,field,msg})=>{
      button('Buka aplikasi',()=>{finish();openApp(id,home.querySelector(`[data-app="${id}"]`));});const name=field('Nama ikon','text',label(a));
      button('Simpan nama',()=>{layout.labels[id]=name.value.trim().slice(0,24)||a.name;persist();render();msg('Nama ikon tersimpan.');},'sec');
      button('Pindahkan / tukar posisi',()=>{moving=id;dismiss();render();});
      const shift=(offset)=>{const visible=layout.order.filter(id=>!layout.hidden.includes(id));const reordered=moveHomeApp(visible,id,offset);let i=0;layout.order=layout.order.map(k=>layout.hidden.includes(k)?k:reordered[i++]);persist();render();msg('Posisi aplikasi tersimpan.');};
      button('Pindah ke halaman sebelumnya',()=>shift(-homePageSize(layout,editing)),'sec');button('Pindah ke halaman berikutnya',()=>shift(homePageSize(layout,editing)),'sec');
      button(layout.dock.includes(id)?'Keluarkan dari dock':'Taruh di dock',()=>{if(layout.dock.includes(id))layout.dock=layout.dock.filter(k=>k!==id);else if(layout.dock.length<4)layout.dock.push(id);else return msg('Dock penuh. Keluarkan salah satu ikon dari dock terlebih dahulu.');persist();render();dismiss();},'sec');
      if(!PROTECTED.has(id))button('Sembunyikan dari layar utama',()=>{layout.hidden.push(id);layout.dock=layout.dock.filter(k=>k!==id);persist();dismiss();render();},'sec');
      if(isInstalled(id))button('Hapus aplikasi',()=>sheet('Hapus aplikasi?',({panel,button})=>{const p=document.createElement('p');p.textContent=`${a.name} beserta data lokalnya akan dihapus dari HP game.`;panel.append(p);button('Ya, hapus aplikasi',()=>{uninstall(id);layout.order=layout.order.filter(k=>k!==id);layout.hidden=layout.hidden.filter(k=>k!==id);layout.dock=layout.dock.filter(k=>k!==id);delete layout.labels[id];persist();dismiss();render();},'red');}), 'red');
    });
  }
  function widgetMenu(){startEdit();sheet('Atur widget',({field,button})=>{
    const options=[['','Tidak ditampilkan'],...Object.entries(WIDGETS)],first=field('Widget kiri','select',layout.widgets[0]||'',options),second=field('Widget kanan','select',layout.widgets[1]||'',options),size=field('Ukuran widget','select',layout.widgetSize,[['compact','Ringkas'],['large','Besar']]);
    button('Simpan widget',()=>{layout.widgets=[first.value,second.value].filter(Boolean);layout.widgetSize=size.value;persist();page=0;dismiss();render();});button('Tukar posisi widget',()=>{layout.widgets.reverse();persist();dismiss();render();},'sec');
  });}
  function appearanceMenu(){startEdit();sheet('Tampilan layar utama',({field,button})=>{const size=field('Ukuran ikon','select',layout.iconSize,[['normal','Normal'],['small','Kecil']]),labels=field('Nama aplikasi','select',layout.showLabels?'yes':'no',[['yes','Tampilkan'],['no','Sembunyikan']]);
    button('Simpan tampilan',()=>{layout.iconSize=size.value;layout.showLabels=labels.value==='yes';persist();dismiss();render();});button('Pulihkan susunan awal',()=>{layout=normalizeHomeLayout({},ids());persist();page=0;dismiss();render();},'sec');
  });}
  function hiddenMenu(){startEdit();sheet('Aplikasi tersembunyi',({panel,button})=>{if(!layout.hidden.length){const p=document.createElement('p');p.textContent='Tidak ada aplikasi tersembunyi.';panel.append(p);}for(const id of layout.hidden){const a=byId(id);if(a)button(`Tampilkan ${label(a)}`,()=>{layout.hidden=layout.hidden.filter(k=>k!==id);persist();dismiss();render();},'sec');}});}
  q('.home-search').oninput=()=>{page=0;render();};q('[data-home-prev]').onclick=()=>go(page-1);q('[data-home-next]').onclick=()=>go(page+1);
  q('.page-dots').onclick=e=>{const b=e.target.closest('[data-page]');if(b)go(+b.dataset.page);};viewport.addEventListener('scroll',()=>{page=Math.round(viewport.scrollLeft/(viewport.clientWidth||244));indicators();},{passive:true});
  home.addEventListener('click',e=>{
    if(e.target.closest('.home-overlay'))return;
    const tool=e.target.closest('[data-home-action]');if(tool){const k=tool.dataset.homeAction;if(k==='done')finish();else if(k==='widgets')widgetMenu();else if(k==='appearance')appearanceMenu();else if(k==='hidden')hiddenMenu();else if(k==='edit')startEdit();return;}
    if(Date.now()<suppressUntil)return;const b=e.target.closest('.ic');if(b){const id=b.dataset.app;if(moving){const i=layout.order.indexOf(moving),j=layout.order.indexOf(id);if(i>=0&&j>=0)[layout.order[i],layout.order[j]]=[layout.order[j],layout.order[i]];moving=null;persist();render();}else if(editing)appMenu(id,b);else openApp(id,b);return;}
    const widget=e.target.closest('[data-widget]');if(widget){if(editing)widgetMenu();else{const key=layout.widgets[+widget.dataset.widget],target={wallet:'dompet',drive:'peta',weather:'cuaca',trip:'peta',car:'kendaraan'}[key];if(target)openApp(target);}}
  });
  home.addEventListener('contextmenu',e=>{if(e.target.closest('.home-overlay'))return;const b=e.target.closest('.ic'),widget=e.target.closest('[data-widget]');if(b||widget){e.preventDefault();stopHold();suppressUntil=Date.now()+350;if(b)appMenu(b.dataset.app,b);else widgetMenu();}});
  home.addEventListener('pointerdown',e=>{if(e.target.closest('.home-overlay,input,select')||e.button>0)return;suppressUntil=0;stopHold();const b=e.target.closest('.ic'),widget=e.target.closest('[data-widget]');press={id:e.pointerId,x:e.clientX,y:e.clientY,left:viewport.scrollLeft,mouse:e.pointerType==='mouse',drag:false,slider:!!e.target.closest('.home-pages')};
    if(b||widget)hold=setTimeout(()=>{hold=null;suppressUntil=Date.now()+700;if(b)appMenu(b.dataset.app,b);else widgetMenu();press=null;},550);
  });
  home.addEventListener('pointermove',e=>{if(!press||press.id!==e.pointerId)return;const dx=e.clientX-press.x,dy=e.clientY-press.y;if(Math.hypot(dx,dy)>10){stopHold();suppressUntil=Date.now()+250;if(press.mouse&&press.slider&&Math.abs(dx)>Math.abs(dy)){press.drag=true;viewport.classList.add('dragging');const scale=home.getBoundingClientRect().width/home.offsetWidth||1;viewport.scrollLeft=press.left-dx/scale;e.preventDefault();}}});
  const release=()=>{stopHold();if(press?.drag){viewport.classList.remove('dragging');go(Math.round(viewport.scrollLeft/(viewport.clientWidth||244)));suppressUntil=Date.now()+300;}press=null;};
  home.addEventListener('pointerup',release);home.addEventListener('pointercancel',release);home.addEventListener('pointerleave',()=>{stopHold();if(press?.mouse)release();});
  home.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&editing){e.preventDefault();e.stopPropagation();if(q('.home-overlay'))dismiss();else finish();return;}
    const menu=q('.home-overlay');if(menu&&e.key==='Tab'){const focus=[...menu.querySelectorAll('input,select,button')],i=focus.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();focus.at(-1)?.focus();}else if(!e.shiftKey&&i===focus.length-1){e.preventDefault();focus[0]?.focus();}return;}
    if(e.target.closest('input,select,textarea,.home-overlay'))return;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();go(page+(e.key==='ArrowLeft'?-1:1));}
    else if(e.key==='Enter'&&e.target.closest('[data-widget]')){e.preventDefault();e.target.click();}
  });
  return {render,widgets,finish,go,get editing(){return editing;},get page(){return page;}};
}
