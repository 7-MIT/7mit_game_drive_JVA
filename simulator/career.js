// Progression for driving.7mit: the garage (vehicles you own, engine / tyre / brake upgrades), the career level and the
// driver rating, three daily missions and the achievements. Pure state and rules; main.js feeds it events and draws the UI.
// Everything is kept in one object that is saved with the rest of the game (localStorage, and the cloud save).

// vehicle prices; 0 = owned from the start; lvl = career level needed before it can be bought
export const SHOP = {
  car: {price: 0}, moto: {price: 0}, bicycle: {price: 0},
  pickup: {price: 18000000}, taxi: {price: 15000000}, angkot: {price: 20000000}, suv: {price: 25000000, lvl: 2},
  mbg: {price: 40000000, lvl: 2}, kopdes: {price: 65000000, lvl: 3},
  truck: {price: 80000000, lvl: 3}, bus: {price: 90000000, lvl: 4},
  ambulance: {price: 35000000, lvl: 4}, police: {price: 45000000, lvl: 6}, damkar: {price: 60000000, lvl: 5},
};
// three upgrade lines, three steps each; the multipliers are what one step adds
export const PARTS = {
  eng:   {name: 'Mesin', desc: 'Tenaga & akselerasi (kecepatan puncak tetap 200 km/jam)', price: [5000000, 10000000, 20000000]},
  tire:  {name: 'Ban', desc: 'Cengkeraman di tikungan & jalan basah', price: [3000000, 6000000, 12000000]},
  brake: {name: 'Rem', desc: 'Jarak pengereman lebih pendek', price: [3000000, 6000000, 12000000]},
};
export const PART_MAX = 3;
// what the upgrades do to the vehicle's spec
export function boost(up = {}){ const e = up.eng || 0, t = up.tire || 0, b = up.brake || 0;
  return {acc: 1 + 0.08*e, vmax: 1 + 0.03*e, grip: 1 + 0.06*t, brake: 1 + 0.1*b}; }

// career: XP for distance, finished orders, clean driving and missions
export const LEVELS = [0, 300, 900, 2000, 4000, 7000, 11000, 16500, 24000, 34000];
export const TITLES = ['Pemula', 'Sopir Harian', 'Sopir Andal', 'Sopir Antarkota', 'Sopir Lintas Provinsi', 'Pengemudi Senior', 'Pengemudi Profesional', 'Instruktur Jalan Raya', 'Legenda Pantura', 'Raja Jalanan Nusantara'];
export function levelOf(xp){ let l = 0; while (l + 1 < LEVELS.length && xp >= LEVELS[l + 1]) l++;
  const next = LEVELS[l + 1]; return {lvl: l + 1, title: TITLES[l], xp, from: LEVELS[l], next: next ?? null, k: next ? (xp - LEVELS[l])/(next - LEVELS[l]) : 1}; }

// daily missions: three a day, picked from the date so every player gets the same ones
export const MISSIONS = [
  {id: 'km', t: n => `Tempuh ${n} km`, n: [15, 25, 40], cash: 2000000, xp: 120},
  {id: 'job', t: n => `Selesaikan ${n} order pekerjaan`, n: [1, 2, 3], cash: 3000000, xp: 150},
  {id: 'stars', t: n => `Dapat ${n} order bintang 5`, n: [1, 2], cash: 3500000, xp: 160},
  {id: 'toll', t: n => `Lewati ${n} gerbang tol (tap e-Toll)`, n: [2, 4, 6], cash: 1500000, xp: 90},
  {id: 'clean', t: n => `Berkendara ${n} km tanpa pelanggaran`, n: [5, 10, 20], cash: 2500000, xp: 140},
  {id: 'rest', t: n => `Mampir dan pakai layanan rest area ${n}×`, n: [1, 2], cash: 1000000, xp: 60},
  {id: 'fuel', t: () => 'Isi BBM di SPBU', n: [1], cash: 800000, xp: 50},
  {id: 'night', t: n => `Tempuh ${n} km di malam hari`, n: [5, 10], cash: 2000000, xp: 120},
  {id: 'rain', t: n => `Tempuh ${n} km saat hujan`, n: [3, 6], cash: 2000000, xp: 120},
  {id: 'ferry', t: () => 'Menyeberang dengan kapal feri', n: [1], cash: 3000000, xp: 200},
];
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export function dayKey(d = new Date()){ return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function dailyFor(day){ let h = hash(day); const pool = MISSIONS.slice(), out = [];
  while (out.length < 3) { const m = pool.splice(h % pool.length, 1)[0]; h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; out.push({id: m.id, n: m.n[h % m.n.length], p: 0, done: false}); h = (h >>> 3) + 7; }
  return out; }
export const missionText = d => (MISSIONS.find(m => m.id === d.id) || MISSIONS[0]).t(d.n);
export const missionPrize = d => { const m = MISSIONS.find(x => x.id === d.id) || MISSIONS[0]; return {cash: m.cash, xp: m.xp}; };

// achievements: [id, title, how, test(totals, state)]
export const ACH = [
  ['km1', 'Perjalanan pertama', 'Tempuh 1 km', T => T.km >= 1],
  ['km100', 'Seratus kilometer', 'Tempuh 100 km', T => T.km >= 100],
  ['km1000', 'Seribu kilometer', 'Tempuh 1.000 km', T => T.km >= 1000],
  ['job1', 'Order pertama', 'Selesaikan 1 order', T => T.jobs >= 1],
  ['job25', 'Langganan setia', 'Selesaikan 25 order', T => T.jobs >= 25],
  ['star10', 'Bintang lima', '10 order bintang 5', T => T.stars5 >= 10],
  ['toll50', 'Anak tol', 'Tap e-Toll 50×', T => T.tolls >= 50],
  ['clean50', 'Pengemudi teladan', '50 km tanpa pelanggaran (sekali jalan)', T => T.cleanBest >= 50],
  ['ferry', 'Menyeberang pulau', 'Naik kapal feri', T => T.ferry >= 1],
  ['islands', 'Keliling Nusantara', 'Berkendara di Jawa, Sumatera dan Bali', T => ['jawa', 'sumatra', 'bali'].every(r => (T.islands || []).includes(r))],
  ['night', 'Kalong', 'Tempuh 50 km di malam hari', T => T.nightKm >= 50],
  ['rain', 'Tembus hujan', 'Tempuh 30 km saat hujan', T => T.rainKm >= 30],
  ['garage3', 'Kolektor', 'Punya 6 kendaraan', (T, S) => S.owned.length >= 6],
  ['tuned', 'Bengkel resmi', 'Upgrade satu kendaraan penuh', (T, S) => Object.values(S.up).some(u => Object.keys(PARTS).every(k => (u[k] || 0) >= PART_MAX))],
  ['lvl5', 'Naik kelas', 'Capai level 5', (T, S) => levelOf(S.xp).lvl >= 5],
  ['daily7', 'Rajin harian', 'Selesaikan 7 misi harian', T => T.missions >= 7],
];

export function fresh(){ return {v: 1, owned: ['car', 'moto', 'bicycle'], up: {}, xp: 0, rate: {sum: 0, n: 0}, day: '', daily: [],
  tot: {km: 0, jobs: 0, stars5: 0, tolls: 0, clean: 0, cleanBest: 0, ferry: 0, nightKm: 0, rainKm: 0, rest: 0, fuel: 0, missions: 0, islands: []}, ach: {}}; }
export function load(raw){ const s = fresh(); if (!raw || typeof raw !== 'object') return s;
  for (const k of Object.keys(s)) if (raw[k] !== undefined) s[k] = raw[k];
  s.tot = {...fresh().tot, ...(raw.tot || {})}; if (!Array.isArray(s.owned)) s.owned = fresh().owned;
  for (const k of fresh().owned) if (!s.owned.includes(k)) s.owned.push(k);
  return s; }

// the game object: state plus the rules; notify(kind, text) is how it talks back (toasts, sounds), pay(cash, why) pays rewards
export function createCareer({state, notify = () => {}, reward = () => {}, save = () => {}, today = dayKey}){
  const S = load(state);
  const lvl = () => levelOf(S.xp);
  function addXp(n, why){ const a = lvl().lvl; S.xp = Math.max(0, S.xp + Math.round(n)); const b = lvl();
    if (b.lvl > a) notify('level', `Naik level ${b.lvl} · ${b.title}`); if (why) notify('xp', `+${Math.round(n)} XP · ${why}`); }
  function daily(){ const d = today(); if (S.day !== d) { S.day = d; S.daily = dailyFor(d); save(); } return S.daily; }
  function progress(id, n){ for (const m of daily()) if (m.id === id && !m.done) { m.p = Math.min(m.n, m.p + n);
      if (m.p >= m.n - 1e-6) { m.done = true; S.tot.missions++; const pz = missionPrize(m); reward(pz.cash, `Misi harian: ${missionText(m)}`); addXp(pz.xp); notify('mission', `Misi selesai: ${missionText(m)}`); } } }
  function checkAch(){ for (const [id, t, , test] of ACH) if (!S.ach[id] && test(S.tot, S)) { S.ach[id] = Date.now(); addXp(100); notify('ach', `Pencapaian: ${t}`); } }
  let xpKm = 0;
  // events from the game
  const ev = {
    // a stretch of driving: km, and whether it was at night / in the rain
    km(km, {night = false, rain = false, region = null} = {}){ if (!(km > 0)) return; const T = S.tot; T.km += km; T.clean += km; T.cleanBest = Math.max(T.cleanBest, T.clean);
      if (night) { T.nightKm += km; progress('night', km); } if (rain) { T.rainKm += km; progress('rain', km); }
      if (region && !T.islands.includes(region)) T.islands.push(region);
      progress('km', km); progress('clean', km); xpKm += km; if (xpKm >= 1) { addXp(10*Math.floor(xpKm)); xpKm %= 1; checkAch(); } },
    violation(){ S.tot.clean = 0; for (const m of daily()) if (m.id === 'clean' && !m.done) m.p = 0; },
    crash(){ S.tot.clean = 0; for (const m of daily()) if (m.id === 'clean' && !m.done) m.p = 0; },
    job(stars){ const T = S.tot; T.jobs++; S.rate.sum += stars; S.rate.n++; if (stars >= 5) { T.stars5++; progress('stars', 1); }
      progress('job', 1); addXp(40 + 12*stars, `order ${'★'.repeat(stars)}`); checkAch(); save(); },
    toll(){ S.tot.tolls++; progress('toll', 1); addXp(5); checkAch(); },
    rest(){ S.tot.rest++; progress('rest', 1); checkAch(); },
    fuel(){ S.tot.fuel++; progress('fuel', 1); checkAch(); },
    ferry(){ S.tot.ferry++; progress('ferry', 1); addXp(80, 'menyeberang'); checkAch(); save(); },
  };
  // garage
  const owns = t => S.owned.includes(t);
  function canBuy(t){ const s = SHOP[t]; if (!s) return 'Tidak dijual'; if (owns(t)) return 'Sudah dimiliki'; if ((s.lvl || 0) > lvl().lvl) return `Perlu level ${s.lvl}`; return null; }
  function buy(t, cash){ const why = canBuy(t); if (why) return {ok: false, why}; const p = SHOP[t].price; if (cash < p) return {ok: false, why: 'Uang tunai tidak cukup'};
    S.owned.push(t); checkAch(); save(); return {ok: true, price: p}; }
  const upOf = t => S.up[t] || {};
  function upgrade(t, part, cash){ if (!owns(t)) return {ok: false, why: 'Kendaraan belum dimiliki'}; const P = PARTS[part]; if (!P) return {ok: false, why: '?'};
    const cur = upOf(t)[part] || 0; if (cur >= PART_MAX) return {ok: false, why: 'Sudah maksimal'}; const p = P.price[cur]; if (cash < p) return {ok: false, why: 'Uang tunai tidak cukup'};
    S.up[t] = {...upOf(t), [part]: cur + 1}; checkAch(); save(); return {ok: true, price: p, lvl: cur + 1}; }
  const rating = () => S.rate.n ? S.rate.sum/S.rate.n : 0;
  return {S, ev, lvl, addXp, daily, owns, canBuy, buy, upgrade, upOf, boost: t => boost(upOf(t)), rating, checkAch,
    achList: () => ACH.map(([id, t, how]) => ({id, t, how, at: S.ach[id] || 0})), json: () => JSON.parse(JSON.stringify(S))};
}

// ---- cloud save (server.7mit, functions drive7_save_put / drive7_save_get) ----
// The save key the player writes down is CODE-SECRET; only a hash of the secret is stored on the server.
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newSecret(rand = n => crypto.getRandomValues(new Uint8Array(n))){ return [...rand(20)].map(b => ALPH[b % ALPH.length]).join(''); }
export const fmtKey = (code, secret) => `${code}-${secret}`;
export function parseKey(s){ const m = String(s || '').toUpperCase().replace(/\s+/g, '').match(/^([A-Z0-9]{8})-([A-Z0-9]{16,64})$/); return m ? {code: m[1], secret: m[2]} : null; }
// the localStorage keys that hold the game's progress (big caches, like map data, stay out)
export const SAVE_KEYS = k => /^tj_/.test(k) && !/^tj_(osm|dem|cache)/.test(k);
export function snapshot(ls){ const o = {}; for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (SAVE_KEYS(k)) { const v = ls.getItem(k); if (v != null && v.length < 60000) o[k] = v; } } return {t: Date.now(), ls: o}; }
export function restore(ls, snap){ if (!snap || typeof snap.ls !== 'object') return 0; let n = 0; for (const [k, v] of Object.entries(snap.ls)) if (SAVE_KEYS(k) && typeof v === 'string') { ls.setItem(k, v); n++; } return n; }
export async function cloudPut(sb, key, data){ const {data: code, error} = await sb.rpc('drive7_save_put', {p_code: key.code || null, p_secret: key.secret, p_data: data});
  if (error || !code) throw new Error(error ? error.message : 'Kode atau kunci salah'); return code; }
export async function cloudGet(sb, key){ const {data, error} = await sb.rpc('drive7_save_get', {p_code: key.code, p_secret: key.secret});
  if (error) throw new Error(error.message); if (!data) throw new Error('Simpanan tidak ditemukan (periksa kode)'); return data; }
