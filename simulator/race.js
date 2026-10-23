// Sirkuit & Race Season: races at the circuit against NPC drivers, in a scene of its own (loaded only when the player enters
// the circuit; the open-road game waits underneath). A season is five rounds on different layouts and conditions with
// points for the standings; a win pays Rp 2.000.000. Cars move in track coordinates (distance along the racing loop s,
// offset from the centre line d), which keeps the physics simple and the cars on the circuit.
import * as THREE from 'three';

const G = 9.81, W = 13, HALF = W/2, VMAX = 200/3.6;              // track width; every car tops out at 200 km/h like on the road
const POINTS = [25, 18, 15, 12, 10, 8], PRIZE = 2000000;
const RIVALS = [['Raka Pratama', 0xd62828], ['Intan Lestari', 0x2a9d8f], ['Dimas Saputra', 0xf4a261], ['Bagus Wijaya', 0x3a86ff], ['Yoga Prasetyo', 0x8338ec]];
// layouts: control points (metres) of a closed loop, driven in this order
const LAYOUTS = {
  gp: [[0, 0], [420, 0], [520, 40], [560, 140], [520, 240], [400, 270], [330, 340], [340, 450], [280, 530], [150, 540], [60, 470], [-40, 470], [-150, 520], [-260, 470], [-280, 360], [-200, 290], [-230, 190], [-300, 120], [-260, 20], [-150, -10]],
  short: [[0, 0], [300, 0], [380, 60], [360, 170], [260, 210], [180, 160], [90, 230], [-20, 210], [-80, 120], [-60, 30]],
};
export const SEASON = [
  {name: 'Ronde 1 · Sentul Grand Prix', layout: 'gp', laps: 3, hour: 14, rain: false},
  {name: 'Ronde 2 · Balap Malam Sentul', layout: 'gp', laps: 3, hour: 21, rain: false},
  {name: 'Ronde 3 · Sentul Basah', layout: 'gp', laps: 3, hour: 16, rain: true},
  {name: 'Ronde 4 · Sentul Pendek', layout: 'short', laps: 5, hour: 10, rain: false},
  {name: 'Ronde 5 · Final Sentul', layout: 'gp', laps: 4, hour: 17.5, rain: false},
];
const KEY = 'drive7_race_season';
export function loadSeason(){ try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.results)) return s; } catch (e) {} return {no: 1, results: [], wins: 0, titles: 0}; }
const saveSeason = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
// standings: points per driver over the rounds raced so far
export function standings(S){ const pts = new Map([['Anda', 0], ...RIVALS.map(([n]) => [n, 0])]);
  for (const r of S.results) r.order.forEach((n, i) => pts.set(n, (pts.get(n) || 0) + (POINTS[i] || 0)));
  return [...pts.entries()].sort((a, b) => b[1] - a[1]); }

// ---------- the track: a closed centripetal Catmull–Rom loop sampled every 2 m ----------
function buildTrack(ctl){
  const P = ctl.map(([x, z]) => new THREE.Vector3(x, 0, z)), curve = new THREE.CatmullRomCurve3(P, true, 'centripetal'), L = curve.getLength(), n = Math.ceil(L/2);
  const X = new Float32Array(n), Z = new Float32Array(n), TX = new Float32Array(n), TZ = new Float32Array(n), K = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = curve.getPointAt(i/n), t = curve.getTangentAt(i/n); X[i] = p.x; Z[i] = p.z; TX[i] = t.x; TZ[i] = t.z; }
  // signed curvature (positive: turning left, towards +d), smoothed
  for (let i = 0; i < n; i++) { const a = (i - 2 + n) % n, b = (i + 2) % n, h0 = Math.atan2(TZ[a], TX[a]), h1 = Math.atan2(TZ[b], TX[b]); let dh = h1 - h0; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); K[i] = -dh/8; }
  const K2 = K.map((_, i) => { let s = 0; for (let k = -3; k <= 3; k++) s += K[(i + k + n) % n]; return s/7; });
  const L2 = n*2, at = s => { const f = ((s % L2) + L2) % L2/2, i = Math.floor(f), j = (i + 1) % n, u = f - i;
    return {x: X[i] + (X[j] - X[i])*u, z: Z[i] + (Z[j] - Z[i])*u, tx: TX[i] + (TX[j] - TX[i])*u, tz: TZ[i] + (TZ[j] - TZ[i])*u, k: K2[i] + (K2[j] - K2[i])*u}; };
  // the left normal of tangent (tx, tz) is (tz, -tx) in three.js x/z (y up, looking down: x right, z towards the viewer)
  const pos = (s, d) => { const q = at(s), nl = Math.hypot(q.tx, q.tz) || 1, nx = q.tz/nl, nz = -q.tx/nl; return {x: q.x + nx*d, z: q.z + nz*d, h: Math.atan2(q.tx, q.tz), k: q.k}; };
  return {L: L2, n, X, Z, TX, TZ, K: K2, at, pos}; }

// ---------- meshes ----------
const M = (c, o = {}) => new THREE.MeshStandardMaterial({color: c, roughness: 0.85, ...o});
function ribbon(T, d0, d1, y, mat, step = 1, filter = null){
  const pos = [], col = [], idx = []; let v = 0; const vc = !!mat.vertexColors;
  for (let i = 0; i <= T.n; i += step) { const s = (i % T.n)*2, a = T.pos(s, d0), b = T.pos(s, d1); pos.push(a.x, y, a.z, b.x, y, b.z);
    if (vc) { const c = filter(i); col.push(...c, ...c); } if (v) idx.push(v - 2, v - 1, v, v - 1, v + 1, v); v += 2; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (vc) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); mat.side = THREE.DoubleSide; const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m; }
function carMesh(color){
  const g = new THREE.Group(), body = M(color, {roughness: 0.35, metalness: 0.3}), dark = M(0x15171a, {roughness: 0.6}), glass = M(0x1d2a36, {roughness: 0.1, metalness: 0.6});
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  box(1.9, 0.5, 4.4, body, 0, 0.5, 0); box(1.5, 0.42, 1.9, glass, 0, 0.95, -0.2); box(1.95, 0.08, 0.5, dark, 0, 0.98, -2.1); box(0.08, 0.3, 0.3, dark, -0.7, 0.85, -2.1); box(0.08, 0.3, 0.3, dark, 0.7, 0.85, -2.1);
  box(1.92, 0.12, 0.3, M(0xffffff, {roughness: 0.4}), 0, 0.76, 1.4);                // a racing stripe across the bonnet
  const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 14); wg.rotateZ(Math.PI/2);
  for (const [x, z] of [[-0.92, -1.35], [0.92, -1.35], [-0.92, 1.4], [0.92, 1.4]]) { const w = new THREE.Mesh(wg, dark); w.position.set(x, 0.36, z); g.add(w); }
  return g; }

export function buildCircuit({round, mobile = false}){
  const T = buildTrack(LAYOUTS[round.layout]), scene = new THREE.Scene(), night = round.hour >= 19 || round.hour < 5.5, dusk = !night && (round.hour > 17 || round.hour < 7);
  const sky = new THREE.Color(night ? 0x0b1020 : round.rain ? 0x8a949c : dusk ? 0xe8a070 : 0x9cc8ea);
  scene.background = sky; scene.fog = new THREE.Fog(sky, 180, round.rain ? 700 : 1400);
  scene.add(new THREE.HemisphereLight(night ? 0x405070 : 0xffffff, 0x3a4a2a, night ? 0.55 : round.rain ? 0.8 : 1.0));
  const sun = new THREE.DirectionalLight(dusk ? 0xffc890 : 0xffffff, night ? 0.25 : round.rain ? 0.6 : 1.6); sun.position.set(-300, 400, 200); scene.add(sun);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), M(night ? 0x1e3318 : 0x4f7d34)); grass.rotation.x = -Math.PI/2; grass.position.y = -0.02; scene.add(grass);
  const asphalt = M(round.rain ? 0x1f2124 : 0x2a2c30, {roughness: round.rain ? 0.35 : 0.95, metalness: round.rain ? 0.2 : 0});
  scene.add(ribbon(T, -HALF - 3, HALF + 3, 0.0, M(0x9b8a6a)));                         // run-off
  scene.add(ribbon(T, -HALF, HALF, 0.01, asphalt));
  // kerbs: red and white on the corners, plain white edge lines on the straights
  const kerbMat = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.6}), corner = i => Math.abs(T.K[i]) > 0.004;
  const kc = i => corner(i) ? (Math.floor(i/2) % 2 ? [0.85, 0.1, 0.1] : [0.95, 0.95, 0.95]) : [0.92, 0.92, 0.9];
  scene.add(ribbon(T, HALF, HALF + 1.2, 0.02, kerbMat, 1, kc), ribbon(T, -HALF - 1.2, -HALF, 0.02, kerbMat, 1, kc));
  // start / finish: a chequered line and a gantry
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const cx = cv.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { cx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; cx.fillRect(i*16, j*16, 16, 16); }
  const st = T.pos(0, 0), gan = new THREE.Group(); gan.position.set(st.x, 0, st.z); gan.rotation.y = st.h; scene.add(gan);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(W, 1.6), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(cv)})); line.rotation.x = -Math.PI/2; line.position.y = 0.03; gan.add(line);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), M(0x2b2b2b)); p.position.set(sx*(HALF + 2), 3.5, 0); gan.add(p); }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(W + 4.5, 1.4, 0.6), M(0x1c1c1c)); bar.position.y = 7; gan.add(bar);
  // grandstands and pit building along the start straight (outside, on the right of the cars)
  const put = (geo, mat, sAt, d, y) => { const q = T.pos(sAt, d), m = new THREE.Mesh(geo, mat); m.position.set(q.x, y, q.z); m.rotation.y = q.h; scene.add(m); return m; };
  for (let k = 0; k < 4; k++) { const s0 = 60 + k*55;
    for (let r = 0; r < 6; r++) { const hh = 0.6 + r*0.75; put(new THREE.BoxGeometry(1.6, hh, 48), M(r % 2 ? 0x8f969c : 0xa8aeb3), s0, -(HALF + 18 + r*1.6), hh/2); }
    put(new THREE.BoxGeometry(9, 0.5, 46), M([0xd94b4b, 0x3f72c4, 0xe9c46a, 0x52a06b][k]), s0, -(HALF + 22), 3.6);
    put(new THREE.BoxGeometry(12, 0.3, 50), M(0xe8e8e8), s0, -(HALF + 22), 8); }
  put(new THREE.BoxGeometry(14, 7, 160), M(0xdedad2), 150, HALF + 26, 3.5);
  // tyre walls outside the corners, light towers at night, trees around
  const tyre = new THREE.CylinderGeometry(0.45, 0.45, 1.0, 8), wallPts = [];
  for (let i = 0; i < T.n; i += 3) if (Math.abs(T.K[i]) > 0.006) { const side = T.K[i] > 0 ? -1 : 1, p = T.pos(i*2, side*(HALF + 14)); wallPts.push(p); }
  const tyres = new THREE.InstancedMesh(tyre, M(0x161616), Math.max(1, wallPts.length)), mx = new THREE.Matrix4(); wallPts.forEach((p, k) => { mx.makeTranslation(p.x, 0.5, p.z); tyres.setMatrixAt(k, mx); }); tyres.count = wallPts.length; scene.add(tyres);
  if (night) for (let i = 0; i < T.n; i += 45) { const p = T.pos(i*2, (i % 90 ? 1 : -1)*(HALF + 9)); const pole = new THREE.Mesh(new THREE.BoxGeometry(0.4, 16, 0.4), M(0x555555)); pole.position.set(p.x, 8, p.z); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 1), new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0xfff3d0, emissiveIntensity: 2})); lamp.position.set(p.x, 16, p.z); scene.add(lamp); }
  if (night) { const fill = new THREE.HemisphereLight(0xfff4dc, 0x203018, 0.6); scene.add(fill); }
  const tg = new THREE.ConeGeometry(3, 9, 7), tm = M(0x2f5e2a), trees = [], R = mulberry(7);
  for (let k = 0; k < (mobile ? 140 : 320); k++) { const x = (R() - 0.5)*1600, z = (R() - 0.5)*1600 + 250; let near = false; for (let i = 0; i < T.n; i += 6) if (Math.hypot(T.X[i] - x, T.Z[i] - z) < HALF + 30) { near = true; break; } if (!near) trees.push([x, z]); }
  const tr = new THREE.InstancedMesh(tg, tm, Math.max(1, trees.length)); trees.forEach(([x, z], k) => { mx.makeTranslation(x, 4.5, z); tr.setMatrixAt(k, mx); }); tr.count = trees.length; scene.add(tr);
  return {T, scene}; }
function mulberry(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; }

// ---------- the race ----------
// a car: {name, s (distance raced, keeps growing over the laps), d, v, psi (heading against the track), mesh, ai: {skill, vmax}}
export function createRace({round, season = 1, mobile = false}){
  const C = buildCircuit({round, mobile}), T = C.T, mu = round.rain ? 0.95 : 1.3, cars = [];
  const diff = Math.min(1, 0.9 + 0.03*(season - 1));
  // grid: two by two behind the line; the player starts fourth
  const grid = [0, 1, 2, 'P', 3, 4];
  grid.forEach((who, k) => { const s = -10 - k*9, d = (k % 2 ? -1 : 1)*3;
    const car = who === 'P' ? {name: 'Anda', player: true, color: 0xf2f2f2} : {name: RIVALS[who][0], color: RIVALS[who][1], ai: {skill: diff*(0.9 + 0.025*who + Math.random()*0.04), line: 0}};
    Object.assign(car, {s, d, v: 0, psi: 0, steer: 0, lap: 0, done: null, mesh: carMesh(car.color)}); C.scene.add(car.mesh); cars.push(car); });
  const P = cars.find(c => c.player), total = round.laps*T.L;
  let t = -3.5, over = false;                                 // t < 0: the countdown
  function physics(car, dt, gas, brake, steerIn){
    const q = T.at(car.s), onGrass = Math.abs(car.d) > HALF + 1.2, m = onGrass ? 0.6 : mu;
    let a = gas*6.2*Math.max(0, 1 - (car.v/VMAX)**2) - brake*11*m/1.3 - 0.0009*car.v*car.v - (onGrass ? 0.25*car.v : 0);
    car.v = Math.max(0, Math.min(VMAX, car.v + a*dt));
    const maxSt = 0.5/(1 + car.v/14); car.steer += (steerIn*maxSt - car.steer)*Math.min(1, dt*8);
    let yr = car.v*Math.tan(car.steer)/2.6; const lim = m*G/Math.max(1, car.v);
    if (Math.abs(yr) > lim) { yr = Math.sign(yr)*lim; car.v *= 1 - 0.25*dt; car.skid = true; } else car.skid = false;
    car.psi += (yr - car.v*q.k)*dt; car.psi = Math.max(-1.3, Math.min(1.3, car.psi));
    car.s += car.v*Math.cos(car.psi)/(1 - car.d*q.k)*dt; car.d += car.v*Math.sin(car.psi)*dt;
    if (Math.abs(car.d) > HALF + 13) { car.d = Math.sign(car.d)*(HALF + 13); car.v *= 0.45; car.psi *= 0.2; car.hit = 0.6; } }
  function ai(car, dt){
    const A = car.ai, look = Math.max(40, car.v*2.6); let target = VMAX*A.skill, kAhead = 0;
    for (let x = 0; x < look; x += 6) { const k = T.at(car.s + x).k, vc = Math.sqrt(mu*G*0.92/Math.max(1e-4, Math.abs(k)))*A.skill; const reach = Math.sqrt(vc*vc + 2*9*x); target = Math.min(target, reach); if (x < 60) kAhead += k; }
    // the racing line: towards the inside of the coming corner, a little wide on the straights
    let want = Math.max(-1, Math.min(1, kAhead*35))*(HALF - 2.2);
    // traffic: a slower car just ahead in the same line → move over, or wait behind it
    for (const o of cars) { if (o === car) continue; const ds = o.s - car.s; if (ds > 0 && ds < 12 && Math.abs(o.d - car.d) < 2.3) {
        if (o.v < car.v) { const left = Math.abs(o.d + 3.2) < HALF - 1, right = Math.abs(o.d - 3.2) < HALF - 1; if (left || right) want = o.d + (left && (!right || car.d >= o.d) ? 3.2 : -3.2); else target = Math.min(target, o.v); } } }
    car.d += Math.max(-2.2*dt, Math.min(2.2*dt, want - car.d)); car.d = Math.max(-HALF + 0.9, Math.min(HALF - 0.9, car.d));
    const gas = car.v < target - 0.5 ? 1 : 0, brake = car.v > target + 1.5 ? 1 : 0;
    car.v = Math.max(0, Math.min(VMAX, car.v + (gas*6.0*Math.max(0, 1 - (car.v/VMAX)**2) - brake*10.5)*dt));
    car.s += car.v*dt; car.psi = Math.atan2(want - car.d, Math.max(5, car.v))*0.4; }
  function collide(){
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) { const a = cars[i], b = cars[j], ds = b.s - a.s, dd = b.d - a.d;
      if (Math.abs(ds) < 4.4 && Math.abs(dd) < 1.95) { const push = (1.95 - Math.abs(dd))/2*(dd >= 0 ? 1 : -1); a.d -= push; b.d += push;
        const back = ds > 0 ? a : b, front = ds > 0 ? b : a; if (back.v > front.v) { const dv = back.v - front.v; back.v -= dv*0.6; front.v += dv*0.3; }
        if (a.player || b.player) P.hit = 0.4; } } }
  const order = () => cars.slice().sort((a, b) => (a.done != null && b.done != null) ? a.done - b.done : a.done != null ? -1 : b.done != null ? 1 : b.s - a.s);
  return {C, cars, P, round, get t(){ return t; }, get over(){ return over; }, total,
    step(dt, input){
      t += dt; P.hit = Math.max(0, (P.hit || 0) - dt);
      if (t < 0) return;
      const gas = input.gasA || (input.gas ? 1 : 0), brake = input.brakeA || (input.brake ? 1 : 0), steer = input.steerA ? -input.steerA : (input.left ? 1 : 0) - (input.right ? 1 : 0);
      for (const c of cars) { if (c.done != null && !c.player) { c.v = Math.max(18, c.v - 3*dt); c.s += c.v*dt; continue; }
        if (c.player) { if (c.done == null) physics(c, dt, gas, brake, steer); else { physics(c, dt, 0.3, 0, -c.d*0.05); } } else ai(c, dt);
        c.lap = Math.floor(Math.max(0, c.s)/T.L); if (c.done == null && c.s >= total) c.done = t; }
      collide();
      if (P.done != null && !over) over = true; },
    order, place: () => order().indexOf(P) + 1,
    // the finishing order once the player is in: cars still racing are ranked by how far they got
    result(){ return order().map(c => c.name); },
    pose(){ for (const c of cars) { const p = T.pos(c.s, c.d); c.mesh.position.set(p.x, 0, p.z); c.mesh.rotation.y = p.h + c.psi; } } };
}

// ---------- the screens: season, countdown and race HUD, results ----------
const CSS = `body.race-on #simulator-shell>*:not(#stage){visibility:hidden}
#race-ui{position:fixed;inset:0;z-index:60;pointer-events:none;font-family:var(--font-sans,system-ui,sans-serif);color:#fff}
#race-ui .rh{position:absolute;left:12px;top:12px;background:rgba(10,12,16,.72);padding:10px 14px;border-radius:10px;line-height:1.35;pointer-events:none}
#race-ui .rh b{font-size:26px}#race-ui .rh small{opacity:.75}
#race-ui .rs{position:absolute;right:12px;top:12px;background:rgba(10,12,16,.72);padding:8px 12px;border-radius:10px;font-size:12px;line-height:1.45;min-width:170px}
#race-ui .rs .me{color:#ffd166;font-weight:700}
#race-ui .cd{position:absolute;left:50%;top:32%;transform:translate(-50%,-50%);font:900 96px/1 system-ui;text-shadow:0 4px 18px rgba(0,0,0,.6)}
#race-ui .spd{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:rgba(10,12,16,.72);padding:6px 16px;border-radius:10px;font:700 26px/1 system-ui}
#race-ui .pad{position:absolute;inset:auto 0 0 0;display:flex;justify-content:space-between;padding:14px;pointer-events:none}
#race-ui .pad div{display:flex;gap:10px}#race-ui .pad button{pointer-events:auto;width:76px;height:76px;border-radius:16px;border:0;background:rgba(255,255,255,.22);color:#fff;font:700 15px system-ui;touch-action:none;user-select:none}
#race-ui .quit{position:absolute;left:12px;bottom:110px;pointer-events:auto;border:0;border-radius:8px;padding:8px 12px;background:rgba(10,12,16,.72);color:#fff;font:600 13px system-ui}
#race-ui .card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;background:#fbfaf7;color:#1b1b1b;border:3px solid #1b1b1b;padding:18px;pointer-events:auto}
#race-ui .card h2{margin:0 0 4px;font-size:20px}#race-ui .card p{margin:4px 0 10px;font-size:13px}
#race-ui table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}#race-ui td,#race-ui th{padding:4px 6px;border-bottom:1px solid #ddd;text-align:left}#race-ui tr.me td{font-weight:700;background:#fff3c4}
#race-ui .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}#race-ui .row button{border:2px solid #1b1b1b;background:#1b1b1b;color:#fff;padding:9px 14px;font:600 14px system-ui;cursor:pointer}#race-ui .row button.sec{background:#fff;color:#1b1b1b}
#race-ui .rounds li{font-size:13px;margin:2px 0}#race-ui .rounds li.now{font-weight:700}`;
const fmtT = s => `${Math.floor(s/60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
const rp = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');

// opens the circuit: season screen → race → results, until the player leaves. ctx: {renderer, input, mobile, earn(n, why), xp(n, why), onExit(), sound}
export function openCircuit(ctx){
  const {renderer, input} = ctx; let S = loadSeason(), race = null, idle = null, cam = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.3, 4000), camPos = new THREE.Vector3(), alive = true;
  if (!document.getElementById('race-css')) { const st = document.createElement('style'); st.id = 'race-css'; st.textContent = CSS; document.head.append(st); }
  document.body.classList.add('race-on');
  const ui = document.createElement('div'); ui.id = 'race-ui'; document.body.append(ui);
  const engine = ctx.sound ? makeEngine() : null;
  function setIdle(){ const round = SEASON[Math.min(S.results.length, SEASON.length - 1)]; idle && dispose(idle.scene); idle = buildCircuit({round, mobile: ctx.mobile}); }
  function seasonScreen(){
    if (S.results.length >= SEASON.length) { const st = standings(S), champ = st[0][0] === 'Anda'; S = {no: S.no + 1, results: [], wins: S.wins, titles: S.titles + (champ ? 1 : 0)}; saveSeason(S); }
    setIdle(); const st = standings(S), next = SEASON[S.results.length];
    ui.innerHTML = `<div class="card"><h2>Race Season ${S.no} · Sirkuit Sentul</h2><p>Lawan 5 pembalap NPC. <b>Juara 1 dapat ${rp(PRIZE)}</b>. Poin 25-18-15-12-10-8 untuk klasemen musim.${S.titles ? ` Gelar juara musim Anda: ${S.titles}.` : ''}</p>
      <ol class="rounds">${SEASON.map((r, i) => `<li class="${i === S.results.length ? 'now' : ''}">${r.name} · ${r.laps} lap${S.results[i] ? ` — posisi ${S.results[i].order.indexOf('Anda') + 1}` : i === S.results.length ? ' — berikutnya' : ''}</li>`).join('')}</ol>
      <table><tr><th>#</th><th>Pembalap</th><th>Poin</th></tr>${st.map(([n, p], i) => `<tr class="${n === 'Anda' ? 'me' : ''}"><td>${i + 1}</td><td>${n}</td><td>${p}</td></tr>`).join('')}</table>
      <p>Kontrol: gas/rem dan kiri/kanan seperti biasa (keyboard, setir, atau tombol layar).</p>
      <div class="row"><button data-a="go">Mulai ${next.name.split(' · ')[0]}</button><button class="sec" data-a="exit">Keluar sirkuit</button></div></div>`;
    ui.querySelector('[data-a=go]').onclick = () => start(next); ui.querySelector('[data-a=exit]').onclick = close; }
  function start(round){
    idle && dispose(idle.scene); idle = null; race = createRace({round, season: S.no, mobile: ctx.mobile});
    ui.innerHTML = `<div class="rh"></div><div class="rs"></div><div class="cd"></div><div class="spd"></div><button class="quit">Keluar balapan</button>
      <div class="pad"><div><button data-k="left">◀</button><button data-k="right">▶</button></div><div><button data-k="brake">REM</button><button data-k="gas">GAS</button></div></div>`;
    ui.querySelector('.quit').onclick = () => { if (confirm('Keluar dari balapan? Hasil ronde ini tidak dihitung.')) { race && dispose(race.C.scene); race = null; seasonScreen(); } };
    for (const b of ui.querySelectorAll('.pad button')) { const k = b.dataset.k, on = e => { e.preventDefault(); input[k] = true; }, off = e => { e.preventDefault(); input[k] = false; };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off); }
    if (!ctx.mobile) ui.querySelector('.pad').style.display = 'none'; }
  function finish(){
    const order = race.result(), pos = order.indexOf('Anda') + 1, round = race.round, lapT = race.P.done;
    S.results.push({round: round.name, order}); if (pos === 1) S.wins++; saveSeason(S);
    if (pos === 1) ctx.earn(PRIZE, `Juara 1 · ${round.name}`); ctx.xp && ctx.xp(pos === 1 ? 150 : pos <= 3 ? 60 : 20, `Balap ${round.name.split(' · ')[0]}`);
    const st = standings(S), last = S.results.length >= SEASON.length;
    ui.innerHTML = `<div class="card"><h2>${pos === 1 ? 'Menang! Juara 1' : `Finis posisi ${pos}`}</h2><p>${round.name} · waktu ${fmtT(lapT)}${pos === 1 ? ` · hadiah <b>${rp(PRIZE)}</b> masuk ke uang tunai` : ' · hadiah uang hanya untuk juara 1'}</p>
      <table><tr><th>Pos</th><th>Pembalap</th><th>Poin</th></tr>${order.map((n, i) => `<tr class="${n === 'Anda' ? 'me' : ''}"><td>${i + 1}</td><td>${n}</td><td>+${POINTS[i] || 0}</td></tr>`).join('')}</table>
      ${last ? `<p><b>Musim ${S.no} selesai.</b> Juara musim: ${st[0][0]} (${st[0][1]} poin).</p>` : ''}
      <div class="row"><button data-a="next">${last ? 'Musim berikutnya' : 'Lanjut ke klasemen'}</button><button class="sec" data-a="exit">Keluar sirkuit</button></div></div>`;
    dispose(race.C.scene); race = null;
    ui.querySelector('[data-a=next]').onclick = seasonScreen; ui.querySelector('[data-a=exit]').onclick = close; }
  function close(){ if (!alive) return; alive = false; race && dispose(race.C.scene); idle && dispose(idle.scene); ui.remove(); document.body.classList.remove('race-on'); engine && engine.stop();
    for (const k of ['left', 'right', 'gas', 'brake']) input[k] = false; ctx.onExit(); }
  let hudT = 0;
  function frame(dt){
    if (!alive) return; const asp = innerWidth/innerHeight; cam.aspect = asp; cam.updateProjectionMatrix();
    if (race) { race.step(dt, input); race.pose(); const P = race.P, p = race.C.T.pos(P.s, P.d), h = p.h + P.psi*0.6, back = 7.5 + P.v*0.03;
      const want = new THREE.Vector3(p.x - Math.sin(h)*back, 2.6 + P.v*0.012, p.z - Math.cos(h)*back); if (camPos.lengthSq() === 0) camPos.copy(want); camPos.lerp(want, Math.min(1, dt*6));
      cam.fov = 60 + P.v*0.12; cam.position.copy(camPos); if (P.hit) cam.position.y += (Math.random() - 0.5)*0.25; cam.lookAt(p.x + Math.sin(h)*8, 1.0, p.z + Math.cos(h)*8);
      renderer.render(race.C.scene, cam); engine && engine.set(P.v/VMAX, input.gas || input.gasA > 0.1);
      if ((hudT -= dt) < 0) { hudT = 0.1; const R = race, T = R.C.T, lap = Math.min(R.round.laps, Math.floor(Math.max(0, P.s)/T.L) + 1), cd = ui.querySelector('.cd');
        ui.querySelector('.rh').innerHTML = `<b>P${R.place()}</b><small>/${R.cars.length}</small><br>Lap ${lap}/${R.round.laps}<br><small>${fmtT(Math.max(0, R.t))}</small>`;
        ui.querySelector('.rs').innerHTML = R.order().map((c, i) => `<div class="${c.player ? 'me' : ''}">${i + 1}. ${c.name}</div>`).join('');
        ui.querySelector('.spd').textContent = `${Math.round(P.v*3.6)} km/jam`;
        cd.textContent = R.t < 0 ? String(Math.ceil(-R.t)) : R.t < 1 ? 'GO!' : ''; }
      if (race.over) finish(); }
    else if (idle) { const k = performance.now()/1000*0.05, T = idle.T; cam.fov = 55; cam.position.set(Math.sin(k)*330 + 130, 95, Math.cos(k)*330 + 250); cam.lookAt(130, 0, 250); renderer.render(idle.scene, cam); engine && engine.set(0, false); } }
  seasonScreen();
  return {frame, close, get racing(){ return !!race; }, get season(){ return S; }, start: () => start(SEASON[S.results.length]), get race(){ return race; }, finishNow: () => race && finish()};
}
function dispose(scene){ const seen = new Set(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); for (const m of [].concat(o.material || [])) { if (seen.has(m)) continue; seen.add(m); if (m.map) m.map.dispose(); m.dispose(); } }); }
// a small engine note for the race car (the road game's sound is muted meanwhile)
function makeEngine(){ let ac = null, o = null, g = null; try { ac = new (window.AudioContext || window.webkitAudioContext)(); o = ac.createOscillator(); g = ac.createGain(); const f = ac.createBiquadFilter();
    o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0; o.connect(f); f.connect(g); g.connect(ac.destination); o.start(); } catch (e) { return null; }
  return {set(k, on){ if (ac.state === 'suspended') ac.resume().catch(() => {}); o.frequency.setTargetAtTime(55 + k*230 + (on ? 15 : 0), ac.currentTime, 0.08); g.gain.setTargetAtTime(0.025 + k*0.035, ac.currentTime, 0.1); },
    stop(){ try { o.stop(); ac.close(); } catch (e) {} }}; }
