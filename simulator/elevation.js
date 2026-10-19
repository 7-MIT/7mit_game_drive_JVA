// ================================================================
// Real ground height along the route: the Copernicus 90 m elevation model, fetched in the player's browser from the
// Open-Meteo elevation API (up to 100 points per request) on a 0.0025° grid (~280 m), kept in the browser cache so a road
// downloads once. at() answers null where nothing has loaded yet; the game then uses its own height model.
// ================================================================
const API = 'https://api.open-meteo.com/v1/elevation', CACHE = 'tj-dem-v1', GRID = 0.0025, TILE = 0.25, MAX_AGE = 60*24*3600e3;
const cellOf = (lat, lon) => [Math.round(lat/GRID), Math.round(lon/GRID)];
const tileOf = (a, b) => Math.floor(a*GRID/TILE) + '_' + Math.floor(b*GRID/TILE);

export function initDEM({onUpdate = () => {}} = {}){
  const H = new Map(), tiles = new Map(), S = {status: 'idle', n: 0, req: 0, err: ''};     // H: 'a,b' -> metres; tiles: key -> 'loading' | 'ok'
  let busy = false, failUntil = 0;
  async function loadTile(t){ if (tiles.has(t)) return; tiles.set(t, 'loading');
    try { const c = await caches.open(CACHE), r = await c.match('https://tj-dem.local/' + t); if (r) { const j = await r.json(); if (Date.now() - j.t < MAX_AGE) for (const k in j.h) H.set(k, j.h[k]); } } catch (e) {}
    tiles.set(t, 'ok'); }
  async function saveTiles(keys){ const by = new Map();
    for (const k of keys) { const [a, b] = k.split(',').map(Number), t = tileOf(a, b); if (!by.has(t)) by.set(t, {}); }
    for (const [k, v] of H) { const [a, b] = k.split(',').map(Number), t = tileOf(a, b); if (by.has(t)) by.get(t)[k] = v; }
    try { const c = await caches.open(CACHE); for (const [t, h] of by) await c.put('https://tj-dem.local/' + t, new Response(JSON.stringify({t: Date.now(), h}), {headers: {'content-type': 'application/json'}})); } catch (e) {} }
  // heights for these points (nearest grid cell); at most `budget` requests per call; resolves to the number of new cells
  async function need(points, budget = 12){
    if (busy || Date.now() < failUntil) return 0; busy = true; let got = 0;
    try { const want = new Map();
      for (const p of points) { if (p.lat == null) continue; const [a, b] = cellOf(p.lat, p.lon); await loadTile(tileOf(a, b)); const k = a + ',' + b; if (!H.has(k)) want.set(k, [a, b]); }
      const list = [...want.entries()]; S.status = list.length ? 'loading' : S.status === 'idle' ? 'ok' : S.status;
      const fresh = [];
      for (let i = 0; i < list.length && budget-- > 0; i += 100) { const part = list.slice(i, i + 100);
        const url = `${API}?latitude=${part.map(([, [a]]) => (a*GRID).toFixed(4)).join(',')}&longitude=${part.map(([, [, b]]) => (b*GRID).toFixed(4)).join(',')}`;
        const ac = new AbortController(), to = setTimeout(() => ac.abort(), 15000);
        try { const r = await fetch(url, {signal: ac.signal}); clearTimeout(to); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); S.req++;
          (j.elevation || []).forEach((h, q) => { if (Number.isFinite(h)) { H.set(part[q][0], Math.max(0, h)); fresh.push(part[q][0]); got++; } }); }
        catch (e) { clearTimeout(to); S.err = e.message; S.status = 'fail'; failUntil = Date.now() + 60000; break; } }
      if (fresh.length) { S.status = 'ok'; S.n = H.size; saveTiles(fresh); onUpdate(got); } }
    finally { busy = false; }
    return got; }
  const at = (lat, lon) => { if (lat == null) return null; const [a, b] = cellOf(lat, lon), h = H.get(a + ',' + b); return h ?? null; };
  return {S, at, need, get size(){ return H.size; }};
}
