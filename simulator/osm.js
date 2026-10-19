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
// the other islands (beta), loaded when the car or a map gets there: Sumatera by a polygon that leaves out Malaysia and Singapore
const REGIONS = {
  sumatra: {bb: [-6.0, 95.0, 5.95, 106.2], span: 8, poly: [[6.0, 95.0], [5.9, 97.0], [4.6, 98.4], [3.8, 99.0], [3.0, 100.0], [2.2, 100.9], [1.7, 101.8], [1.25, 102.6], [0.95, 103.4],
    [0.6, 104.0], [-0.5, 104.6], [-1.6, 105.2], [-3.0, 106.2], [-6.0, 106.2], [-6.0, 104.5], [-4.5, 101.5], [-2.0, 99.0], [0.0, 97.5], [2.0, 95.8], [3.5, 95.0]]},
  bali: {bb: [-8.9, 114.42, -8.0, 115.75], span: 0.9}};
const inBB = (b, lat, lon) => lat >= b[0] && lat <= b[2] && lon >= b[1] && lon <= b[3];
const CACHE = 'tj-osm-v1', MAX_AGE = 14*24*3600e3, CELL = 0.05;
const KIND = {motorway: 't', trunk: 'n', primary: 'p', secondary: 's', tertiary: 'c', residential: 'r', unclassified: 'r', living_street: 'r', road: 'r'};
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
  const S = {status: 'idle', source: '', n: 0, km: 0, at: 0, err: '', coast: 'idle'};
  const land = [], landR = {};      // the real coastline: closed rings [{xy: Float32Array lon,lat…, bb}] (Java, Madura and every island), per region
  const R = {}; S.regions = R; S.coastR = {};
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
      const p = simplify(e.geometry.map(g => [Math.round(g.lon*1e5)/1e5, Math.round(g.lat*1e5)/1e5]), k === 't' || k === 'n' ? 12 : k === 'r' ? 8 : 15);
      out.push({k, n: t.name || t['name:id'] || '', r: t.ref || '', p}); }
    return out; }
  async function cached(key){ try { const c = await caches.open(CACHE), r = await c.match('https://tj-osm.local/' + key); if (!r) return null; const j = await r.json(); return Date.now() - j.t < MAX_AGE ? j : null; } catch (e) { return null; } }
  async function store(key, data){ try { const c = await caches.open(CACHE); await c.put('https://tj-osm.local/' + key, new Response(JSON.stringify({t: Date.now(), d: data}), {headers: {'content-type': 'application/json'}})); } catch (e) {} }
  // every request goes through one queue, one at a time (the public Overpass servers allow only a couple of requests per user):
  // the main roads near the car first, the coastline last; a busy server (429 / 504) is waited out and asked again
  const Q = []; let running = false; S.queue = 0;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function overpass(q, ms, pri = 2){ return new Promise((res, rej) => { Q.push({q, ms, pri, res, rej, at: Q.length}); Q.sort((a, b) => a.pri - b.pri || a.at - b.at); S.queue = Q.length; pump(); }); }
  async function pump(){ if (running || !Q.length) return; running = true; const job = Q.shift(); S.queue = Q.length;
    try { job.res(await overpassNow(job.q, job.ms)); } catch (e) { job.rej(e); } finally { running = false; S.queue = Q.length; setTimeout(pump, 400); } }
  async function overpassNow(q, ms){ let last = '';
    for (let attempt = 0; attempt < 3; attempt++) { let busy = false;
      for (const m of MIRRORS) { const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms);
        try { const r = await fetch(m, {method: 'POST', body: 'data=' + encodeURIComponent(q), headers: {'content-type': 'application/x-www-form-urlencoded'}, signal: ac.signal});
          clearTimeout(to); if (!r.ok) { last = `${new URL(m).host}: HTTP ${r.status}`; if (r.status === 429 || r.status === 504 || r.status === 503) busy = true; continue; }
          const j = await r.json(); S.source = new URL(m).host; return j; }
        catch (e) { clearTimeout(to); last = `${new URL(m).host}: ${e.name === 'AbortError' ? 'timeout' : e.message}`; } }
      if (!busy) break; await wait(12000*(attempt + 1)); }
    throw new Error(last || 'Overpass tidak terjangkau'); }
  const bb = (s, w, n, e) => `(${s},${w},${n},${e})`;
  const area = r => REGIONS[r].poly ? `(poly:"${REGIONS[r].poly.map(p => p.join(' ')).join(' ')}")` : bb(...REGIONS[r].bb);
  // the main roads of the whole island
  async function loadBase(force){
    if (S.status === 'loading') return; S.status = 'loading'; S.err = ''; onUpdate('loading');
    try { let c = force ? null : await cached('base');
      if (!c) { const j = await overpass(`[out:json][timeout:180];way["highway"~"^(motorway|trunk)$"]${bb(...BBOX)};out geom;`, 200000, 0); const d = parse(j); if (!d.length) throw new Error('data kosong'); await store('base', d); c = {t: Date.now(), d}; }
      roads.length = 0; grid.clear(); S.km = 0; tiles.clear(); for (const k in R) delete R[k]; for (const k in T2) delete T2[k]; add(c.d); S.at = c.t; S.status = 'ok'; log(`OSM: ${roads.length} ruas`); onUpdate('ok'); }
    catch (e) { S.status = 'fail'; S.err = e.message; onUpdate('fail'); }
    loadCoast(force); }
  // the main roads (toll, trunk) of another island (Sumatera, Bali) come per 2° tile around a point, so a request stays small;
  // the first tile of an island also asks for its coastline. R[region] = 'ok' once any of its tiles has loaded.
  const T2 = {}, T2R = {}; S.t2 = T2;
  const t2key = (lat, lon) => `m${Math.floor(lat/2)}_${Math.floor(lon/2)}`;
  async function loadMain(lat, lon){ const r = regionAt(lat, lon); if (r === 'jawa' || S.status !== 'ok') return; const key = t2key(lat, lon); if (T2[key]) return; T2R[key] = r;
    const ti = Math.floor(lat/2)*2, tj = Math.floor(lon/2)*2; T2[key] = 'loading'; if (!R[r]) R[r] = 'loading';
    try { let c = await cached(key);
      if (!c) { const j = await overpass(`[out:json][timeout:150];way["highway"~"^(motorway|trunk)$"]${bb(ti, tj, ti + 2, tj + 2)};out geom;`, 170000, 1); const d = parse(j); await store(key, d); c = {d}; }
      add(c.d); T2[key] = 'ok'; R[r] = 'ok'; onUpdate('region'); }
    catch (e) { T2[key] = 'fail'; S.err = e.message; onUpdate('region'); setTimeout(() => { if (T2[key] === 'fail') delete T2[key]; }, 60000); }
    // Bali's coastline is one small request; Sumatera's is far too big for the public servers (the built-in coastline stays)
    if (r === 'bali') loadCoast(false, r); }
  S.regionInfo = () => { const o = {}; for (const [k, v] of Object.entries(T2)) { const r = T2R[k] || 'jawa'; o[r] = o[r] || {ok: 0, loading: 0, fail: 0}; o[r][v]++; } return o; };
  const mainOK = (lat, lon) => regionAt(lat, lon) === 'jawa' ? S.status === 'ok' : T2[t2key(lat, lon)] === 'ok';
  const regionAt = (lat, lon) => { for (const r in REGIONS) if (inBB(REGIONS[r].bb, lat, lon) && !(r === 'sumatra' && lon > 105.85 && lat < -5.92)) return r; return 'jawa'; };
  // the coastline: OSM coastline ways joined end to end into closed rings (land on the left), simplified to ~25 m
  function rings(j){ const ways = (j.elements || []).filter(e => e.type === 'way' && e.nodes && e.geometry && e.nodes.length === e.geometry.length && e.nodes.length > 1);
    const byStart = new Map(); for (const w of ways) byStart.set(w.nodes[0], w); const used = new Set(), out = [], open = [];
    for (const w0 of ways) { if (used.has(w0)) continue; let w = w0, pts = [], first = w0.nodes[0], closed = false;
      for (let guard = 0; guard < 100000 && w && !used.has(w); guard++) { used.add(w); for (let k = pts.length ? 1 : 0; k < w.geometry.length; k++) pts.push([Math.round(w.geometry[k].lon*1e5)/1e5, Math.round(w.geometry[k].lat*1e5)/1e5]);
        const last = w.nodes[w.nodes.length - 1]; if (last === first) { closed = true; break; } w = byStart.get(last); }
      if (closed) { if (pts.length > 3) out.push(pts); } else if (pts.length > 1) open.push(pts); }
    // small gaps in the data: join open chains whose end lies within ~1 km of another chain's start, close a chain that comes back to itself
    const near = (a, b) => Math.hypot((a[0] - b[0])*COSL, a[1] - b[1]) < 0.01;
    for (let pass = 0; pass < 3 && open.length; pass++) for (let i = 0; i < open.length; i++) { const c = open[i]; if (!c) continue;
      if (c.length > 3 && near(c[c.length - 1], c[0])) { out.push(c); open[i] = null; continue; }
      const j = open.findIndex((d, k) => d && k !== i && near(c[c.length - 1], d[0])); if (j >= 0) { open[i] = c.concat(open[j]); open[j] = null; i--; } }
    // a closed ring starts and ends on one point: simplify its two halves separately
    return out.map(p => { const m = p.length >> 1; return simplify(p.slice(0, m + 1), 25).concat(simplify(p.slice(m), 25).slice(1)); }); }
  function setLand(r, list){ landR[r] = list.map(p => { const xy = new Float32Array(p.length*2); let la0 = 90, lo0 = 180, la1 = -90, lo1 = -180;
      p.forEach(([lo, la], j) => { xy[j*2] = lo; xy[j*2 + 1] = la; la0 = Math.min(la0, la); la1 = Math.max(la1, la); lo0 = Math.min(lo0, lo); lo1 = Math.max(lo1, lo); }); return {xy, bb: [la0, lo0, la1, lo1]}; });
    land.length = 0; for (const k in landR) land.push(...landR[k]); }
  // r = 'jawa' (Java, Madura and the islands around them) or another region; the region's main island has to come out whole (a ring
  // across most of it), otherwise the built-in coastline stays
  async function loadCoast(force, r = 'jawa'){ const C = S.coastR; if (C[r] === 'loading' || (C[r] === 'ok' && !force)) return; C[r] = 'loading'; if (r === 'jawa') S.coast = 'loading';
    try { const key = r === 'jawa' ? 'coast' : 'coast-' + r, span = r === 'jawa' ? 7 : REGIONS[r].span; let c = force ? null : await cached(key);
      if (!c) { const j = await overpass(`[out:json][timeout:180];way["natural"="coastline"]${r === 'jawa' ? bb(...BBOX) : area(r)};out body geom;`, 240000, 4); const d = rings(j);
        if (!d.some(p => { let a = 180, b = -180; for (const q of p) { a = Math.min(a, q[0]); b = Math.max(b, q[0]); } return b - a > span; })) throw new Error('garis pantai tidak utuh');
        await store(key, d); c = {d}; }
      setLand(r, c.d); C[r] = 'ok'; if (r === 'jawa') S.coast = 'ok'; onUpdate('coast'); }
    catch (e) { C[r] = 'fail'; if (r === 'jawa') S.coast = 'fail'; } }
  // fill the land inside the view (one path, every ring that reaches into it)
  function fillLand(x, P, la0, lo0, la1, lo1){ x.beginPath();
    for (const r of land) { if (r.bb[2] < la0 || r.bb[0] > la1 || r.bb[3] < lo0 || r.bb[1] > lo1) continue; const xy = r.xy; let [a, b] = P(xy[1], xy[0]); x.moveTo(a, b);
      for (let j = 2; j < xy.length; j += 2) { [a, b] = P(xy[j + 1], xy[j]); x.lineTo(a, b); } x.closePath(); }
    x.fill(); }
  // provincial, regency and city roads (primary, secondary, tertiary) of the 1° tile around a point;
  // the street network (residential, unclassified) of the 0.1° tile around a point, for close-up maps and the side streets in the game
  async function loadArea(key, q, ms){ if (S.status !== 'ok' || tiles.has(key)) return; tiles.set(key, 'loading');
    try { let c = await cached(key); if (!c) { const j = await overpass(q, ms, key[0] === 'r' ? 3 : 2); const d = parse(j); await store(key, d); c = {d}; }
      add(c.d); tiles.set(key, 'ok'); onUpdate('tile'); }
    catch (e) { tiles.set(key, 'fail'); setTimeout(() => tiles.delete(key), 60000); } }
  const covered = (la0, lo0, la1, lo1) => [BBOX, ...Object.values(REGIONS).map(q => q.bb)].some(b => la1 >= b[0] && la0 <= b[2] && lo1 >= b[1] && lo0 <= b[3]);
  function loadTile(lat, lon){ const ti = Math.floor(lat), tj = Math.floor(lon); if (!covered(ti, tj, ti + 1, tj + 1)) return;
    return loadArea(`u${ti}_${tj}`, `[out:json][timeout:150];way["highway"~"^(primary|secondary|tertiary)$"]${bb(ti, tj, ti + 1, tj + 1)};out geom;`, 180000); }
  function loadStreets(lat, lon){ const ti = Math.floor(lat*10), tj = Math.floor(lon*10); if (!covered(lat, lon, lat, lon)) return;
    return loadArea(`r${ti}_${tj}`, `[out:json][timeout:90];way["highway"~"^(residential|unclassified|living_street|road)$"]${bb(ti/10, tj/10, (ti + 1)/10, (tj + 1)/10)};out geom;`, 120000); }
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
  function snap(lat, lon, kinds, maxKm = 2, accept = () => true){ const r0 = Math.ceil(maxKm/111/CELL), ca = Math.floor(lat/CELL), cb = Math.floor(lon/CELL); let best = null, bd = (maxKm/111)**2, seen = new Set();
    for (let a = ca - r0; a <= ca + r0; a++) for (let b = cb - r0; b <= cb + r0; b++) for (const i of grid.get(a + ',' + b) || []) { if (seen.has(i)) continue; seen.add(i); const r = roads[i]; if (!kinds.includes(r.k) || !accept(r)) continue;
      const xy = r.xy; for (let j = 2; j < xy.length; j += 2) { const x0 = xy[j - 2]*COSL, y0 = xy[j - 1], x1 = xy[j]*COSL, y1 = xy[j + 1], px = lon*COSL, dx = x1 - x0, dy = y1 - y0, L = dx*dx + dy*dy;
        const t = L ? Math.max(0, Math.min(1, ((px - x0)*dx + (lat - y0)*dy)/L)) : 0, qx = x0 + dx*t, qy = y0 + dy*t, d = (qx - px)**2 + (qy - lat)**2;
        if (d < bd) { bd = d; best = {lat: qy, lon: qx/COSL, road: r, j: j/2 - 1, t, km: Math.sqrt(d)*111}; } } }
    return best; }
  return {S, get ready(){ return S.status === 'ok'; }, get coastReady(){ return S.coast === 'ok'; }, coastOK: r => S.coastR[r] === 'ok', regionAt, loadMain, mainOK, land, fillLand, roads, loadBase, loadTile, loadStreets, inBox, stroke, snap, tiles};
}
