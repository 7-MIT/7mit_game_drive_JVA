// Studio: photo mode (free camera around the car, filters, time of day, save / share), the cinematic drone camera,
// and the replay of the last 20 seconds. Camera shots are car-relative: a = along the car, b = to its side, c = up (metres),
// la / lc = where the camera looks (ahead of the car, height), fov in degrees.
const lerp = (a, b, k) => a + (b - a)*k, ease = x => x < 0 ? 0 : x > 1 ? 1 : x*x*(3 - 2*x);
// the cinematic camera: a loop of drone and tracking shots (the same kind of shots as the driving.7mit trailer)
export const SHOTS = [
  k => ({a: lerp(-130, -70, k), b: lerp(-60, -45, k), c: lerp(72, 55, k), la: 110, lc: 0, fov: 50}),
  k => ({a: lerp(-4, 2, k), b: -4.2, c: 1.5, la: 2, lc: 0.8, fov: 42}),
  k => ({a: lerp(22, 26, k), b: lerp(-6, -3, k), c: lerp(4, 9, k), la: 0, lc: 1, fov: 48}),
  k => ({a: lerp(-9, -28, k), b: lerp(-12, -30, k), c: lerp(3, 36, k), la: 25, lc: 2, fov: 55}),
  k => { const t = lerp(-2.2, 1.0, k); return {a: 26*Math.cos(t), b: 26*Math.sin(t), c: 9, la: 0, lc: 1, fov: 50}; },
  k => ({a: lerp(12, -8, k), b: lerp(-2, 8, k), c: 48, la: 3, lc: 0, fov: 45}),
  k => ({a: lerp(15, 10, k), b: lerp(-8, -6, k), c: lerp(2.2, 3, k), la: 0, lc: 1, fov: 40}),
  k => ({a: lerp(-40, 40, k), b: -45, c: 24, la: 0, lc: 0, fov: 45}),
  k => ({a: lerp(-12, -9, k), b: 3*Math.sin(k*3), c: 3.6, la: 25, lc: 1, fov: 55}),
  k => { const t = lerp(1.1, -1.4, k); return {a: 45*Math.cos(t), b: 45*Math.sin(t), c: 28, la: 0, lc: 0, fov: 50}; },
  k => { const e = ease(k); return {a: lerp(-12, -130, e), b: lerp(-8, -50, e), c: lerp(4, 85, e), la: lerp(20, 90, e), lc: 0, fov: lerp(52, 58, e)}; },
];
export const SHOT_LEN = 7;
export function cineShot(t, len = SHOT_LEN){ const n = SHOTS.length, i = Math.floor(t/len) % n; return SHOTS[(i + n) % n](((t % len) + len) % len/len); }
// photo camera: orbit around the car (yaw 0 = behind it), pitch up, distance, focal length
export function photoShot(P){ const cp = Math.cos(P.pitch); return {a: -P.dist*cp*Math.cos(P.yaw), b: P.dist*cp*Math.sin(P.yaw), c: 0.9 + P.dist*Math.sin(P.pitch), la: 0, lc: 0.9, fov: P.fov}; }
export const FILTERS = [['normal', 'Normal', 'none'], ['hangat', 'Hangat', 'sepia(.25) saturate(1.25) brightness(1.04)'], ['dingin', 'Dingin', 'hue-rotate(-12deg) saturate(.9) brightness(1.03)'],
  ['sinema', 'Sinema', 'contrast(1.18) saturate(1.15) brightness(.96)'], ['vintage', 'Vintage', 'sepia(.55) contrast(.92) brightness(1.05)'], ['hitamputih', 'Hitam putih', 'grayscale(1) contrast(1.12)'], ['senja', 'Senja', 'sepia(.35) hue-rotate(-18deg) saturate(1.6)']];

// replay: a ring of frames (camU and every nearby vehicle's transform) recorded at hz for the last max seconds
export function createRecorder({max = 20, hz = 15} = {}){
  const frames = []; let acc = 0;
  return {frames, get seconds(){ return frames.length/hz; }, hz,
    push(dt, make){ acc += dt; if (acc < 1/hz) return; acc = 0; frames.push(make()); if (frames.length > max*hz) frames.shift(); },
    clear(){ frames.length = 0; },
    // the state at time t (seconds from the first frame), interpolated between the two frames around it
    at(t){ if (!frames.length) return null; const f = Math.max(0, Math.min(frames.length - 1, t*hz)), i = Math.floor(f), k = f - i, A = frames[i], B = frames[Math.min(frames.length - 1, i + 1)];
      return {A, B, k}; }};
}
export const lerpAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; return a + d*k; };

// the photo-mode panel; G: {open(), close(), setHour(h), getHour(), canvas, render(), toast(t)}
export function initPhotoUI(G){
  const P = {yaw: 0.6, pitch: 0.18, dist: 9, fov: 45, filter: 'normal'};
  const box = document.createElement('div'); box.id = 'photo'; box.hidden = true;
  box.innerHTML = `<div class="ph-top"><b>Mode foto</b><span>Geser layar untuk memutar kamera · gulir / cubit untuk zoom</span><button data-a="close" aria-label="Tutup">×</button></div>
    <div class="ph-panel"><label>Jarak<input type="range" data-k="dist" min="3" max="80" step="0.5"></label><label>Tinggi<input type="range" data-k="pitch" min="-0.05" max="1.4" step="0.01"></label>
    <label>Lensa<input type="range" data-k="fov" min="15" max="90" step="1"></label><label>Jam<input type="range" data-k="hour" min="0" max="23.9" step="0.1"></label>
    <div class="ph-filters"></div><div class="ph-acts"><button data-a="save">Simpan foto</button><button data-a="share">Bagikan</button></div></div>`;
  const css = document.createElement('style'); css.textContent = `#photo{position:fixed;inset:0;z-index:50;pointer-events:none;font:13px/1.35 var(--font-sans,system-ui,sans-serif)}#photo[hidden]{display:none}
  #photo .ph-top{pointer-events:auto;position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;background:#f4f1eaee;color:#201e1d;border:2px solid #201e1d;padding:6px 10px;max-width:calc(100vw - 32px)}
  #photo .ph-top span{font-size:11px;opacity:.7}#photo .ph-top button{border:0;background:none;font-size:22px;cursor:pointer;line-height:1}
  #photo .ph-panel{pointer-events:auto;position:absolute;right:12px;bottom:12px;width:min(280px,calc(100vw - 32px));background:#f4f1eaee;color:#201e1d;border:2px solid #201e1d;padding:10px;display:flex;flex-direction:column;gap:6px}
  #photo label{display:flex;flex-direction:column;font-size:11px;font-weight:600}#photo input[type=range]{width:100%}
  .ph-filters{display:flex;flex-wrap:wrap;gap:4px}.ph-filters button,.ph-acts button{font:inherit;font-size:11px;padding:5px 7px;border:2px solid #201e1d;background:#fff;cursor:pointer}.ph-filters button[aria-pressed=true]{background:#201e1d;color:#fff}
  .ph-acts{display:flex;gap:6px}.ph-acts button{flex:1;font-weight:700;font-size:12px;padding:8px}.ph-acts button:first-child{background:#201e1d;color:#fff}
  body.photo-on #simulator-shell>*:not(#stage){visibility:hidden}@media(max-width:600px){#photo .ph-top span{display:none}}`;
  document.head.append(css); document.body.append(box);
  const inp = k => box.querySelector(`[data-k=${k}]`);
  const fl = box.querySelector('.ph-filters'); for (const [k, l] of FILTERS) { const b = document.createElement('button'); b.textContent = l; b.dataset.f = k; b.onclick = () => { P.filter = k; sync(); }; fl.append(b); }
  function sync(){ inp('dist').value = P.dist; inp('pitch').value = P.pitch; inp('fov').value = P.fov; inp('hour').value = G.getHour();
    const f = FILTERS.find(x => x[0] === P.filter); G.canvas().style.filter = f[2] === 'none' ? '' : f[2]; for (const b of fl.children) b.setAttribute('aria-pressed', String(b.dataset.f === P.filter)); }
  for (const k of ['dist', 'pitch', 'fov']) inp(k).oninput = e => { P[k] = +e.target.value; };
  inp('hour').oninput = e => G.setHour(+e.target.value);
  // drag to orbit, wheel / pinch to zoom (on the 3D view, not on the panel)
  const ptr = new Map(); let pinch = 0;
  const cv = () => G.canvas();
  const down = e => { if (box.hidden || e.target !== cv()) return; ptr.set(e.pointerId, {x: e.clientX, y: e.clientY}); };
  const move = e => { if (box.hidden || !ptr.has(e.pointerId)) return; const o = ptr.get(e.pointerId), dx = e.clientX - o.x, dy = e.clientY - o.y; ptr.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (ptr.size === 1) { P.yaw -= dx*0.008; P.pitch = Math.max(-0.05, Math.min(1.4, P.pitch + dy*0.006)); }
    else if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) P.dist = Math.max(3, Math.min(80, P.dist*pinch/d)); pinch = d; } sync(); };
  const up = e => { ptr.delete(e.pointerId); if (ptr.size < 2) pinch = 0; };
  addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  addEventListener('wheel', e => { if (box.hidden || e.target !== cv()) return; P.dist = Math.max(3, Math.min(80, P.dist*Math.exp(e.deltaY*0.0012))); sync(); }, {passive: true});
  // the picture: render once more and copy it with the filter applied (a WebGL canvas keeps its pixels only until the next frame)
  function shot(){ G.render(); const src = G.canvas(), c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d');
    const f = FILTERS.find(y => y[0] === P.filter)[2]; if (f !== 'none') x.filter = f; x.drawImage(src, 0, 0);
    x.filter = 'none'; x.font = `600 ${Math.round(c.height*0.022)}px system-ui, sans-serif`; x.fillStyle = 'rgba(255,255,255,.85)'; x.textAlign = 'right'; x.fillText('driving.7mit', c.width - c.height*0.03, c.height*0.96);
    return new Promise(r => c.toBlob(r, 'image/jpeg', 0.92)); }
  const name = () => `driving7mit-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`;
  box.querySelector('[data-a=save]').onclick = async () => { const b = await shot(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name(); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); G.toast('Foto disimpan'); };
  box.querySelector('[data-a=share]').onclick = async () => { const b = await shot(), f = new File([b], name(), {type: 'image/jpeg'});
    if (navigator.canShare && navigator.canShare({files: [f]})) { try { await navigator.share({files: [f], title: 'driving.7mit', text: 'Foto dari driving.7mit'}); } catch (e) {} }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name(); a.click(); G.toast('Perangkat ini tidak bisa berbagi langsung: foto diunduh'); } };
  box.querySelector('[data-a=close]').onclick = () => G.close();
  return {P, open(){ box.hidden = false; document.body.classList.add('photo-on'); sync(); }, close(){ box.hidden = true; document.body.classList.remove('photo-on'); G.canvas().style.filter = ''; }, get on(){ return !box.hidden; }, shot};
}
