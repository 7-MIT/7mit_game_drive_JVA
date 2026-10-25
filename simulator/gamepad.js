// Gamepads and wheels: which controller it is (Xbox, PlayStation, Nintendo, a wheel or another), the player's own button
// layout (every action can be bound to any button or stick direction), steering feel (dead zone, sensitivity, curve,
// invert), vibration, and the controller settings + live tester panel (every button, trigger and axis, like a gamepad
// test page). The pure parts (brandOf, labels, readBound) are tested in tests/gamepad.test.mjs.

// ---------- which controller ----------
export function brandOf(id = ''){ const s = id.toLowerCase();
  if (/wheel|g29|g920|g923|g27|driving force|thrustmaster|t300|t150|fanatec|moza|simagic/.test(s)) return 'wheel';
  if (/045e|xbox|xinput|x-box/.test(s)) return 'xbox';
  if (/057e|pro controller|joy-?con|nintendo|switch/.test(s)) return 'nintendo';
  if (/054c|dualsense|dualshock|playstation|ps4|ps5|wireless controller/.test(s)) return 'ps';     // a DualShock 4 calls itself just "Wireless Controller"
  return 'generic'; }
export const BRAND_NAME = {xbox: 'Xbox', ps: 'PlayStation', nintendo: 'Nintendo', wheel: 'Setir & pedal', generic: 'Controller'};
// the "standard" mapping's 17 buttons, named as printed on each brand's controller
const LABELS = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Xbox'],
  ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'PS'],
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home'],
};
const AXIS_NAME = ['Stik kiri ↔', 'Stik kiri ↕', 'Stik kanan ↔', 'Stik kanan ↕'];
export const buttonLabel = (brand, i) => (LABELS[brand] || LABELS.xbox)[i] || `Tombol ${i}`;
export const axisLabel = (brand, i, dir) => (brand !== 'wheel' && AXIS_NAME[i] ? AXIS_NAME[i] : `Sumbu ${i}`) + (dir > 0 ? ' +' : dir < 0 ? ' −' : '');
export function bindLabel(b, brand){ if (!b) return '—'; return b.t === 'b' ? buttonLabel(brand, b.i) : axisLabel(brand, b.i, b.d || 0); }

// ---------- what can be bound ----------
// kind: 'steer' (a full axis, or two directions), 'pedal' (analog 0…1), 'button'
export const ACTIONS = [
  ['steer', 'Setir', 'steer'], ['gas', 'Gas', 'pedal'], ['brake', 'Rem', 'pedal'], ['clutch', 'Kopling', 'pedal'],
  ['up', 'Gigi naik', 'button'], ['down', 'Gigi turun', 'button'], ['horn', 'Klakson', 'button'], ['hazard', 'Lampu hazard', 'button'],
  ['left', 'Sein kiri', 'button'], ['right', 'Sein kanan', 'button'], ['cam', 'Ganti kamera', 'button'], ['map', 'Peta', 'button'],
  ['photo', 'Mode foto', 'button'], ['phone', 'HP', 'button'], ['radio', 'Radio', 'button'], ['settings', 'Pengaturan', 'button'],
];
// standard mapping: left stick steers, RT/R2/ZR gas, LT/L2/ZL brake, A/✕/B clutch …
export const DEFAULT_BIND = {steer: {t: 'a', i: 0}, gas: {t: 'b', i: 7}, brake: {t: 'b', i: 6}, clutch: {t: 'b', i: 0}, up: {t: 'b', i: 5}, down: {t: 'b', i: 4},
  horn: {t: 'b', i: 1}, hazard: {t: 'b', i: 2}, left: {t: 'b', i: 14}, right: {t: 'b', i: 15}, cam: {t: 'b', i: 3}, map: {t: 'b', i: 8}, photo: {t: 'b', i: 9},
  phone: {t: 'b', i: 12}, radio: {t: 'b', i: 13}, settings: {t: 'b', i: 10}};
export const DEFAULT_PAD = {bind: DEFAULT_BIND, dead: 0.08, sens: 1, curve: 1.3, invert: false, vib: true, vibK: 0.7, index: -1, custom: false};
export const padConf = c => ({...DEFAULT_PAD, ...(c || {}), bind: {...DEFAULT_BIND, ...((c && c.bind) || {})}});

// ---------- reading a pad through the bindings ----------
const dz = (x, d) => Math.abs(x) < d ? 0 : Math.sign(x)*(Math.abs(x) - d)/(1 - d);
// value 0…1 of a bound control; an axis half reads from its rest position (pedals of a wheel rest at ±1, sticks at 0)
function val(p, b, rest, dead){ if (!b) return 0;
  if (b.t === 'b') { const B = p.buttons[b.i]; return B ? (typeof B === 'object' ? (B.value || (B.pressed ? 1 : 0)) : +B) : 0; }
  const a = p.axes[b.i] ?? 0, r = rest ? rest[b.i] ?? 0 : 0;
  if (Math.abs(Math.abs(r) - 1) < 0.15) return Math.min(1, Math.abs(a - r)/2);          // a pedal resting at ±1 (wheels)
  return Math.max(0, dz(a, dead)*(b.d || 1)); }
export function readBound(p, conf, rest){
  const C = padConf(conf), B = C.bind, out = {steer: 0, gas: 0, brake: 0, clutch: 0, btn: {}};
  // steering: a full axis (centre 0), or two halves / buttons
  let st = 0;
  if (B.steerL || B.steerR) st = val(p, B.steerR, rest, C.dead) - val(p, B.steerL, rest, C.dead);
  else if (B.steer && B.steer.t === 'a') st = dz(p.axes[B.steer.i] ?? 0, C.dead);
  st = Math.sign(st)*Math.pow(Math.abs(st), C.curve)*C.sens; if (C.invert) st = -st; out.steer = Math.max(-1, Math.min(1, st));
  out.gas = val(p, B.gas, rest, C.dead); out.brake = val(p, B.brake, rest, C.dead); out.clutch = val(p, B.clutch, rest, C.dead);
  for (const [k, , kind] of ACTIONS) if (kind === 'button') out.btn[k] = val(p, B[k], rest, C.dead) > 0.5;
  out.btn.clutch = out.clutch > 0.5; return out; }

// the first control that moves (for binding): a button pressed, or an axis pushed past 0.6 from where it rests
export function firstMove(p, rest){
  for (let i = 0; i < p.buttons.length; i++) { const b = p.buttons[i]; if (b && (b.pressed || b.value > 0.6)) return {t: 'b', i}; }
  for (let i = 0; i < p.axes.length; i++) { const d = p.axes[i] - (rest ? rest[i] ?? 0 : 0); if (Math.abs(d) > 0.6) return {t: 'a', i, d: Math.sign(d)}; }
  return null; }

// ---------- vibration ----------
export function rumble(p, strong = 0.6, weak = 0.4, ms = 180){ try { const a = p && p.vibrationActuator; if (!a) return false;
  if (a.playEffect) { a.playEffect(a.type === 'trigger-rumble' ? 'trigger-rumble' : 'dual-rumble', {duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak)}).catch(() => {}); return true; }
  if (a.pulse) { a.pulse(Math.min(1, strong), ms); return true; } } catch (e) {} return false; }

// ---------- the panel: settings and tester ----------
const CSS = `#padui{position:fixed;inset:0;z-index:80;background:rgba(8,10,14,.62);display:grid;place-items:center;font-family:var(--font-sans,system-ui,sans-serif)}
#padui .pw{width:min(780px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:#fbfaf7;color:#1b1b1b;border:3px solid #1b1b1b;box-shadow:6px 6px 0 #1b1b1b}
#padui header{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:2px solid #1b1b1b;position:sticky;top:0;background:#fbfaf7;z-index:1}
#padui header h2{margin:0;font-size:18px;flex:1}#padui header button{border:2px solid #1b1b1b;background:#fff;padding:6px 10px;font:600 13px inherit;cursor:pointer}
#padui .tabs{display:flex;gap:6px;padding:10px 14px 0}#padui .tabs button{border:2px solid #1b1b1b;background:#fff;padding:6px 12px;font:600 13px inherit;cursor:pointer}#padui .tabs button[aria-selected=true]{background:#1b1b1b;color:#fff}
#padui .body{padding:12px 14px 16px}#padui .muted{color:#5b5f63;font-size:12.5px}
#padui .dev{border:2px solid #1b1b1b;padding:8px 10px;margin-bottom:10px;font-size:13px}#padui .dev b{font-size:14px}
#padui table{width:100%;border-collapse:collapse;font-size:13px}#padui td{padding:5px 6px;border-bottom:1px solid #ddd;vertical-align:middle}
#padui td.k{width:34%;font-weight:600}#padui .bind{font:600 12.5px ui-monospace,monospace;background:#efece6;padding:3px 7px;border-radius:5px}
#padui .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}#padui .row label{font-size:13px;min-width:150px}
#padui input[type=range]{flex:1;min-width:140px}#padui .sm{border:2px solid #1b1b1b;background:#fff;padding:4px 9px;font:600 12px inherit;cursor:pointer}#padui .sm.on{background:#ffd166}
#padui .wait{background:#ffd166!important}
#padui .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px}
#padui .bt{border:2px solid #1b1b1b;padding:5px 6px;font-size:11.5px;position:relative;overflow:hidden;background:#fff}#padui .bt i{position:absolute;left:0;bottom:0;top:0;background:#7bd389;z-index:0}#padui .bt span{position:relative}
#padui .bt.on{border-color:#0b7a3b}#padui .ax{display:flex;align-items:center;gap:8px;font-size:12px;margin:4px 0}#padui .ax .bar{flex:1;height:12px;border:2px solid #1b1b1b;position:relative;background:#fff}
#padui .ax .bar i{position:absolute;top:0;bottom:0;background:#4f8fe0}#padui .ax .bar:after{content:'';position:absolute;left:50%;top:-2px;bottom:-2px;border-left:1px dashed #1b1b1b}
#padui .sticks{display:flex;gap:18px;flex-wrap:wrap;margin:8px 0}#padui .stk{width:96px;height:96px;border:2px solid #1b1b1b;border-radius:50%;position:relative;background:#fff}
#padui .stk i{position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:#e04f3a;left:50%;top:50%}#padui .stk.on{background:#fff3c4}
#padui svg.ctl{width:100%;max-width:420px;height:auto;display:block;margin:6px auto}#padui svg.ctl .on{fill:#ffd166}`;

export function openPadPanel({get, set, rumbleNow, onClose, tab = 'set'}){
  if (document.getElementById('padui')) return; if (!document.getElementById('padui-css')) { const st = document.createElement('style'); st.id = 'padui-css'; st.textContent = CSS; document.head.append(st); }
  const el = document.createElement('div'); el.id = 'padui'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Pengaturan controller');
  el.innerHTML = `<div class="pw"><header><h2>Controller / gamepad</h2><button data-x>Tutup</button></header><div class="tabs" role="tablist"><button data-t="set">Pengaturan</button><button data-t="test">Tes gamepad</button></div><div class="body"></div></div>`;
  document.body.append(el); const body = el.querySelector('.body'), rest = new Map(); let raf = 0, cur = tab, capture = null, capT = 0, last = '';
  const pads = () => (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(Boolean);
  const pick = () => { const C = padConf(get()), L = pads(); return L.find(p => p.index === C.index) || L[0] || null; };
  const close = () => { cancelAnimationFrame(raf); el.remove(); onClose && onClose(); };
  el.querySelector('[data-x]').onclick = close; el.addEventListener('click', e => { if (e.target === el) close(); });
  addEventListener('keydown', function esc(e){ if (e.key === 'Escape') { if (capture) { capture = null; draw(); } else { close(); removeEventListener('keydown', esc); } } });
  for (const b of el.querySelectorAll('.tabs button')) b.onclick = () => { cur = b.dataset.t; capture = null; draw(); };
  const save = C => { set({...C, custom: true}); };
  function devCard(p){ if (!p) return `<div class="dev"><b>Belum ada controller terdeteksi.</b><div class="muted">Sambungkan controller (USB atau Bluetooth), lalu tekan salah satu tombolnya: browser baru mengenali controller setelah ada tombol yang ditekan.</div></div>`;
    const br = brandOf(p.id); return `<div class="dev"><b>${BRAND_NAME[br]}</b> · #${p.index}${p.mapping === 'standard' ? ' · mapping standar' : ' · mapping khusus'}<div class="muted">${esc(p.id)}</div><div class="muted">${p.buttons.length} tombol · ${p.axes.length} sumbu · getar: ${p.vibrationActuator ? 'didukung' : 'tidak didukung'}</div></div>`; }
  function drawSet(){
    const C = padConf(get()), p = pick(), br = p ? brandOf(p.id) : 'xbox', L = pads();
    body.innerHTML = devCard(p) + (L.length > 1 ? `<div class="row"><label>Controller yang dipakai</label>${L.map(q => `<button class="sm ${q.index === (p && p.index) ? 'on' : ''}" data-idx="${q.index}">#${q.index} ${BRAND_NAME[brandOf(q.id)]}</button>`).join('')}</div>` : '')
      + `<h3 style="margin:10px 0 4px;font-size:15px">Tombol & kendali</h3><p class="muted">Pilih "Ubah", lalu tekan tombol atau gerakkan stik/pedal yang diinginkan (Esc untuk batal). Setir bisa satu sumbu penuh atau dua arah terpisah.</p>
      <table>${ACTIONS.map(([k, name, kind]) => { const extra = k === 'steer' && C.bind.steerL ? ` · kiri ${bindLabel(C.bind.steerL, br)} / kanan ${bindLabel(C.bind.steerR, br)}` : '';
        return `<tr><td class="k">${name}</td><td><span class="bind">${k === 'steer' && C.bind.steerL ? 'dua arah' : bindLabel(C.bind[k], br)}</span>${extra}</td><td style="text-align:right">${k === 'steer' ? `<button class="sm ${capture === 'steerL' ? 'wait' : ''}" data-cap="steerL">Kiri</button> <button class="sm ${capture === 'steerR' ? 'wait' : ''}" data-cap="steerR">Kanan</button> ` : ''}<button class="sm ${capture === k ? 'wait' : ''}" data-cap="${k}">${capture === k ? 'Tekan…' : 'Ubah'}</button></td></tr>`; }).join('')}</table>
      <h3 style="margin:14px 0 4px;font-size:15px">Rasa setir & getar</h3>
      <div class="row"><label>Zona mati stik: ${Math.round(C.dead*100)}%</label><input type="range" min="0" max="0.3" step="0.01" value="${C.dead}" data-r="dead"></div>
      <div class="row"><label>Sensitivitas setir: ${C.sens.toFixed(2)}×</label><input type="range" min="0.5" max="2" step="0.05" value="${C.sens}" data-r="sens"></div>
      <div class="row"><label>Kurva setir: ${C.curve.toFixed(1)} ${C.curve <= 1.05 ? '(linear)' : '(halus di tengah)'}</label><input type="range" min="1" max="2.5" step="0.1" value="${C.curve}" data-r="curve"></div>
      <div class="row"><label>Setir terbalik</label><button class="sm ${C.invert ? 'on' : ''}" data-tg="invert">${C.invert ? 'Aktif' : 'Mati'}</button></div>
      <div class="row"><label>Getar saat tabrakan</label><button class="sm ${C.vib ? 'on' : ''}" data-tg="vib">${C.vib ? 'Aktif' : 'Mati'}</button><input type="range" min="0.2" max="1" step="0.05" value="${C.vibK}" data-r="vibK" ${C.vib ? '' : 'disabled'}><button class="sm" data-rumble="1">Tes getar</button></div>
      <div class="row"><button class="sm" data-reset>Kembalikan ke bawaan</button><span class="muted">Bawaan: stik kiri setir, ${buttonLabel(br, 7)} gas, ${buttonLabel(br, 6)} rem, ${buttonLabel(br, 5)}/${buttonLabel(br, 4)} gigi naik/turun, ${buttonLabel(br, 0)} kopling.</span></div>`;
    for (const b of body.querySelectorAll('[data-cap]')) b.onclick = () => { capture = b.dataset.cap; capT = performance.now(); rest.clear(); const q = pick(); if (q) rest.set(q.index, [...q.axes]); draw(); };
    for (const r of body.querySelectorAll('[data-r]')) r.oninput = () => { const C2 = padConf(get()); C2[r.dataset.r] = +r.value; save(C2); r.previousElementSibling.textContent = r.previousElementSibling.textContent.replace(/:.*/, ': ' + (r.dataset.r === 'dead' ? Math.round(r.value*100) + '%' : r.dataset.r === 'sens' ? (+r.value).toFixed(2) + '×' : r.dataset.r === 'curve' ? (+r.value).toFixed(1) : Math.round(r.value*100) + '%')); };
    for (const b of body.querySelectorAll('[data-tg]')) b.onclick = () => { const C2 = padConf(get()); C2[b.dataset.tg] = !C2[b.dataset.tg]; save(C2); draw(); };
    for (const b of body.querySelectorAll('[data-idx]')) b.onclick = () => { const C2 = padConf(get()); C2.index = +b.dataset.idx; save(C2); draw(); };
    body.querySelector('[data-reset]').onclick = () => { set({...DEFAULT_PAD}); draw(); };
    body.querySelector('[data-rumble]').onclick = () => { const q = pick(); if (!q || !rumble(q, padConf(get()).vibK, padConf(get()).vibK*0.6, 400)) alert('Controller ini tidak mendukung getar di browser ini.'); }; }
  function diagram(p, br){
    const v = i => (p.buttons[i] && (p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0))) || 0, on = i => v(i) > 0.5 ? 'on' : '', L = i => buttonLabel(br, i);
    const face = br === 'ps' ? [['△', 3], ['○', 1], ['✕', 0], ['□', 2]] : br === 'nintendo' ? [['X', 3], ['A', 1], ['B', 0], ['Y', 2]] : [['Y', 3], ['B', 1], ['A', 0], ['X', 2]];
    const ax = (i) => p.axes[i] || 0;
    return `<svg class="ctl" viewBox="0 0 420 230" aria-label="Diagram controller">
      <path d="M80 60 Q210 30 340 60 Q400 70 410 150 Q415 215 360 215 Q330 215 300 170 L120 170 Q90 215 60 215 Q5 215 10 150 Q20 70 80 60Z" fill="#fff" stroke="#1b1b1b" stroke-width="3"/>
      <rect x="60" y="22" width="70" height="20" rx="6" class="${on(6)}" fill="#fff" stroke="#1b1b1b" stroke-width="2"/><text x="95" y="36" font-size="11" text-anchor="middle">${L(6)} ${Math.round(v(6)*100)}%</text>
      <rect x="290" y="22" width="70" height="20" rx="6" class="${on(7)}" fill="#fff" stroke="#1b1b1b" stroke-width="2"/><text x="325" y="36" font-size="11" text-anchor="middle">${L(7)} ${Math.round(v(7)*100)}%</text>
      <rect x="62" y="46" width="66" height="12" rx="4" class="${on(4)}" fill="#fff" stroke="#1b1b1b" stroke-width="2"/><rect x="292" y="46" width="66" height="12" rx="4" class="${on(5)}" fill="#fff" stroke="#1b1b1b" stroke-width="2"/>
      <circle cx="110" cy="105" r="24" class="${on(10)}" fill="#fff" stroke="#1b1b1b" stroke-width="2"/><circle cx="${110 + ax(0)*16}" cy="${105 + ax(1)*16}" r="9" fill="#e04f3a"/>
      <circle cx="265" cy="150" r="24" class="${on(11)}" fill="#fff" stroke="#1b1b1b" stroke-width="2"/><circle cx="${265 + ax(2)*16}" cy="${150 + ax(3)*16}" r="9" fill="#e04f3a"/>
      ${[[12, 155, 128, 0, -1], [13, 155, 172, 0, 1], [14, 133, 150, -1, 0], [15, 177, 150, 1, 0]].map(([i, x, y]) => `<rect x="${x - 10}" y="${y - 10}" width="20" height="20" class="${on(i)}" fill="#fff" stroke="#1b1b1b" stroke-width="2"/>`).join('')}
      ${face.map(([t, i], k) => { const [x, y] = [[315, 80], [340, 105], [315, 130], [290, 105]][k]; return `<circle cx="${x}" cy="${y}" r="12" class="${on(i)}" fill="#fff" stroke="#1b1b1b" stroke-width="2"/><text x="${x}" y="${y + 4}" font-size="11" text-anchor="middle">${t}</text>`; }).join('')}
      <rect x="180" y="80" width="22" height="12" rx="4" class="${on(8)}" fill="#fff" stroke="#1b1b1b" stroke-width="2"/><rect x="220" y="80" width="22" height="12" rx="4" class="${on(9)}" fill="#fff" stroke="#1b1b1b" stroke-width="2"/>
      <circle cx="211" cy="112" r="9" class="${on(16)}" fill="#fff" stroke="#1b1b1b" stroke-width="2"/></svg>`; }
  function drawTest(){
    const L = pads(); if (!L.length) { body.innerHTML = devCard(null); return; }
    body.innerHTML = L.map(p => { const br = brandOf(p.id);
      return devCard(p) + (p.mapping === 'standard' ? diagram(p, br) : '')
        + `<div class="sticks">${[0, 2].filter(i => i + 1 < p.axes.length || i < p.axes.length).map(i => `<div><div class="stk ${Math.hypot(p.axes[i] || 0, p.axes[i + 1] || 0) > 0.1 ? 'on' : ''}"><i style="left:${50 + (p.axes[i] || 0)*42}%;top:${50 + (p.axes[i + 1] || 0)*42}%"></i></div><div class="muted" style="text-align:center">${i ? 'Stik kanan' : 'Stik kiri'}</div></div>`).join('')}</div>`
        + `<h3 style="margin:8px 0 4px;font-size:14px">Sumbu (${p.axes.length})</h3>${p.axes.map((a, i) => `<div class="ax"><span style="width:118px">${axisLabel(br, i)}</span><span class="bar"><i style="left:${a < 0 ? 50 + a*50 : 50}%;width:${Math.abs(a)*50}%"></i></span><code style="width:60px;text-align:right">${a.toFixed(3)}</code></div>`).join('')}`
        + `<h3 style="margin:10px 0 4px;font-size:14px">Tombol (${p.buttons.length})</h3><div class="grid">${p.buttons.map((b, i) => `<div class="bt ${b.pressed ? 'on' : ''}"><i style="width:${Math.round((b.value || (b.pressed ? 1 : 0))*100)}%"></i><span>${i} · ${buttonLabel(br, i)}<br><b>${(b.value || 0).toFixed(2)}</b></span></div>`).join('')}</div>`
        + `<div class="row" style="margin-top:10px"><button class="sm" data-rb="${p.index}" data-k="0.35">Getar lemah</button><button class="sm" data-rb="${p.index}" data-k="1">Getar kuat</button><span class="muted">Waktu baca: ${Math.round(p.timestamp)} ms</span></div>`; }).join('<hr>');
    for (const b of body.querySelectorAll('[data-rb]')) b.onclick = () => { const q = pads().find(x => x.index === +b.dataset.rb); if (!q || !rumble(q, +b.dataset.k, +b.dataset.k*0.7, 500)) alert('Controller ini tidak mendukung getar di browser ini.'); }; }
  function draw(){ for (const b of el.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', b.dataset.t === cur ? 'true' : 'false'); (cur === 'test' ? drawTest : drawSet)(); }
  function loop(){ raf = requestAnimationFrame(loop);
    if (capture) { const p = pick(); if (p) { const r = rest.get(p.index) || [...p.axes]; rest.set(p.index, r); const m = firstMove(p, r);
        if (m && performance.now() - capT > 250) { const C = padConf(get()), k = capture;
          if (k === 'steer') { if (m.t !== 'a') { capT = performance.now(); return; } C.bind.steer = {t: 'a', i: m.i}; delete C.bind.steerL; delete C.bind.steerR; }   // one full axis
          else C.bind[k] = m;                                                                       // a button, or one direction of an axis
          save(C); capture = null; draw(); } }
      if (performance.now() - capT > 8000) { capture = null; draw(); } return; }
    // the tester and the device card follow the pads live (redrawn only when something changed)
    const L = pads(), sig = cur === 'test' ? L.map(p => p.index + ':' + p.axes.map(a => a.toFixed(2)).join(',') + ':' + p.buttons.map(b => (b.value || 0).toFixed(2)).join(',')).join('|') : L.map(p => p.index).join(',');
    if (sig !== last) { last = sig; draw(); } }
  draw(); loop();
  return {close}; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
