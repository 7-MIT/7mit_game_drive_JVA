// ================================================================
// Real road data from OpenStreetMap, fetched live from the Overpass API in the player's browser.
// Toll roads (motorway) and national / arterial roads (trunk) for all of Java and Madura at start,
// provincial and regency roads (primary, secondary) per 1° tile when a map is zoomed in.
// Everything is simplified and kept in the browser cache, so it downloads once.
// Map data © OpenStreetMap contributors (ODbL).
// ================================================================
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const BBOX = [-8.95, 105.1, -5.75, 114.75];                  // south, west, north, east
const CACHE = 'tj-osm-v1', MAX_AGE = 14*24*3600e3, CELL = 0.05;
const KIND = {motorway: 't', trunk: 'n', primary: 'p', secondary: 's'};
const COSL = Math.cos(7.2*Math.PI/180);

// Douglas–Peucker in metres on [lon, lat] pairs
function simplify(pts, tolM){
  if (pts.length < 3) return pts; const tol = tolM/111320, keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); const ax = pts[a][0]*COSL, ay = pts[a][1], bx = pts[b][0]*COSL, by = pts[b][1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-12;
    let md = 0, mi = -1; for (let i = a + 1; i < b; i++) { const d = Math.abs(dy*(pts[i][0]*COSL - ax) - dx*(pts[i][1] - ay))/L; if (d > md) { md = d; mi = i; } }
    if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return pts.filter((_, i) => keep[i]); }

export function initOSM({onUpdate = () => {}, log = () => {}} = {}){
  const roads = [], grid = new Map(), tiles = new Map();    // tiles: key -> 'loading' | 'ok' | 'fail'
  const S = {status: 'idle', source: '', n: 0, km: 0, at: 0, err: ''};
  const cellKey = (la, lo) => Math.floor(la/CELL) + ',' + Math.floor(lo/CELL);
  function add(list){
    for (const r of list) { const i = roads.length, xy = new Float32Array(r.p.length*2); let la0 = 90, lo0 = 180, la1 = -90, lo1 = -180, km = 0;
      r.p.forEach(([lo, la], j) => { xy[j*2] = lo; xy[j*2 + 1] = la; la0 = Math.min(la0, la); la1 = Math.max(la1, la); lo0 = Math.min(lo0, lo); lo1 = Math.max(lo1, lo);
        if (j) km += Math.hypot((lo - r.p[j - 1][0])*COSL, la - r.p[j - 1][1])*111.32;
        const k = cellKey(la, lo); let c = grid.get(k); if (!c) grid.set(k, c = []); if (c[c.length - 1] !== i) c.push(i); });
      // long segments cross cells without a vertex in them: register the cells in between too
      for (let j = 1; j < r.p.length; j++) { const [x0, y0] = r.p[j - 1], [x1, y1] = r.p[j], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)/(CELL*0.7));
        for (let s = 1; s < n; s++) { const k = cellKey(y0 + (y1 - y0)*s/n, x0 + (x1 - x0)*s/n); let c = grid.get(k); if (!c) grid.set(k, c = []); if (c[c.length - 1] !== i) c.push(i); } }
      roads.push({k: r.k, name: r.n || '', ref: r.r || '', xy, bb: [la0, lo0, la1, lo1]}); S.km += km; }
    S.n = roads.length; }
  // Overpass JSON → compact roads [{k, n, r, p: [[lon, lat], …]}]
  function parse(j){ const out = [];
    for (const e of j.elements || []) { if (e.type !== 'way' || !e.geometry || e.geometry.length < 2) continue; const t = e.tags || {}, k = KIND[t.highway]; if (!k) continue;
      const p = simplify(e.geometry.map(g => [Math.round(g.lon*1e5)/1e5, Math.round(g.lat*1e5)/1e5]), k === 't' || k === 'n' ? 12 : 20);
      out.push({k, n: t.name || t['name:id'] || '', r: t.ref || '', p}); }
    return out; }
  async function cached(key){ try { const c = await caches.open(CACHE), r = await c.match('https://tj-osm.local/' + key); if (!r) return null; const j = await r.json(); return Date.now() - j.t < MAX_AGE ? j : null; } catch (e) { return null; } }
  async function store(key, data){ try { const c = await caches.open(CACHE); await c.put('https://tj-osm.local/' + key, new Response(JSON.stringify({t: Date.now(), d: data}), {headers: {'content-type': 'application/json'}})); } catch (e) {} }
  async function overpass(q, ms){ let last = '';
    for (const m of MIRRORS) { const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms);
      try { const r = await fetch(m, {method: 'POST', body: 'data=' + encodeURIComponent(q), headers: {'content-type': 'application/x-www-form-urlencoded'}, signal: ac.signal});
        clearTimeout(to); if (!r.ok) { last = `${new URL(m).host}: HTTP ${r.status}`; continue; } const j = await r.json(); S.source = new URL(m).host; return j; }
      catch (e) { clearTimeout(to); last = `${new URL(m).host}: ${e.name === 'AbortError' ? 'timeout' : e.message}`; } }
    throw new Error(last || 'Overpass tidak terjangkau'); }
  const bb = (s, w, n, e) => `(${s},${w},${n},${e})`;
  // the main roads of the whole island
  async function loadBase(force){
    if (S.status === 'loading') return; S.status = 'loading'; S.err = ''; onUpdate('loading');
    try { let c = force ? null : await cached('base');
      if (!c) { const j = await overpass(`[out:json][timeout:180];way["highway"~"^(motorway|trunk)$"]${bb(...BBOX)};out geom;`, 200000); const d = parse(j); if (!d.length) throw new Error('data kosong'); await store('base', d); c = {t: Date.now(), d}; }
      roads.length = 0; grid.clear(); S.km = 0; tiles.clear(); add(c.d); S.at = c.t; S.status = 'ok'; log(`OSM: ${roads.length} ruas`); onUpdate('ok'); }
    catch (e) { S.status = 'fail'; S.err = e.message; onUpdate('fail'); } }
  // provincial and regency roads of the 1° tile around a point
  async function loadTile(lat, lon){ if (S.status !== 'ok') return; const ti = Math.floor(lat), tj = Math.floor(lon), key = `t${ti}_${tj}`; if (tiles.has(key)) return;
    if (ti + 1 < BBOX[0] || ti > BBOX[2] || tj + 1 < BBOX[1] || tj > BBOX[3]) return; tiles.set(key, 'loading');
    try { let c = await cached(key);
      if (!c) { const j = await overpass(`[out:json][timeout:120];way["highway"~"^(primary|secondary)$"]${bb(ti, tj, ti + 1, tj + 1)};out geom;`, 150000); const d = parse(j); await store(key, d); c = {d}; }
      add(c.d); tiles.set(key, 'ok'); onUpdate('tile'); }
    catch (e) { tiles.set(key, 'fail'); setTimeout(() => tiles.delete(key), 60000); } }
  // roads with a part inside a lat/lon box
  function inBox(la0, lo0, la1, lo1){ const seen = new Set(), out = [];
    if ((la1 - la0)*(lo1 - lo0)/(CELL*CELL) > 6000) { for (const r of roads) if (r.bb[2] >= la0 && r.bb[0] <= la1 && r.bb[3] >= lo0 && r.bb[1] <= lo1) out.push(r); return out; }
    for (let a = Math.floor(la0/CELL); a <= Math.floor(la1/CELL); a++) for (let b = Math.floor(lo0/CELL); b <= Math.floor(lo1/CELL); b++)
      for (const i of grid.get(a + ',' + b) || []) if (!seen.has(i)) { seen.add(i); out.push(roads[i]); }
    return out; }
  // stroke every road of the given kinds inside the view as one path
  function stroke(x, P, list, kinds){ x.beginPath();
    for (const r of list) { if (!kinds.includes(r.k)) continue; const xy = r.xy; let [a, b] = P(xy[1], xy[0]); x.moveTo(a, b);
      for (let j = 2; j < xy.length; j += 2) { [a, b] = P(xy[j + 1], xy[j]); x.lineTo(a, b); } }
    x.stroke(); }
  // the nearest point on a road of the given kinds (within maxKm), for putting the car and the route on the real road
  function snap(lat, lon, kinds, maxKm = 2){ const r0 = Math.ceil(maxKm/111/CELL), ca = Math.floor(lat/CELL), cb = Math.floor(lon/CELL); let best = null, bd = (maxKm/111)**2, seen = new Set();
    for (let a = ca - r0; a <= ca + r0; a++) for (let b = cb - r0; b <= cb + r0; b++) for (const i of grid.get(a + ',' + b) || []) { if (seen.has(i)) continue; seen.add(i); const r = roads[i]; if (!kinds.includes(r.k)) continue;
      const xy = r.xy; for (let j = 2; j < xy.length; j += 2) { const x0 = xy[j - 2]*COSL, y0 = xy[j - 1], x1 = xy[j]*COSL, y1 = xy[j + 1], px = lon*COSL, dx = x1 - x0, dy = y1 - y0, L = dx*dx + dy*dy;
        const t = L ? Math.max(0, Math.min(1, ((px - x0)*dx + (lat - y0)*dy)/L)) : 0, qx = x0 + dx*t, qy = y0 + dy*t, d = (qx - px)**2 + (qy - lat)**2;
        if (d < bd) { bd = d; best = {lat: qy, lon: qx/COSL, road: r, km: Math.sqrt(d)*111}; } } }
    return best; }
  return {S, get ready(){ return S.status === 'ok'; }, roads, loadBase, loadTile, inBox, stroke, snap, tiles};
}
