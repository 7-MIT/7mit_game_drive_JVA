// The route between two places along the real roads (OpenStreetMap): the fastest path (A* on travel time, like a navigation
// app: length over the usual speed of each road class) over the loaded national, provincial,
// regency and city roads, so the navigation line on the map and the road in the game follow the road's real bends instead
// of a straight line from town to town. The packed OSM roads are simplified, so their junctions are rebuilt: vertices within
// ~11 m are one point, segments that cross get a shared vertex, and a road ending within 30 m of another road's segment
// (a T-junction) is joined onto it. Runs in a worker (osm-route-worker.js); pure, so it also runs in tests.
const COSL = Math.cos(7.2*Math.PI/180), CELL = 1e-4, GCELL = 0.003;
const SPEED = {n: 60, p: 50, s: 40, c: 30, r: 20}, VMAX = 80;     // km/h by road class; VMAX keeps the A* estimate below any real time
const km = (la0, lo0, la1, lo1) => Math.hypot((lo1 - lo0)*COSL, la1 - la0)*111.32;

function heap(){ const h = [];
  return {get size(){ return h.length; },
    push(c, v){ h.push([c, v]); let i = h.length - 1; while (i) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } },
    pop(){ const top = h[0], last = h.pop(); if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2*i + 1, r = l + 1; let m = i;
          if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } }
      return top; }}; }

// roads: [{k, xy: [lon, lat, …], bb: [la0, lo0, la1, lo1]}]; a, b: {lat, lon}. Returns [{lat, lon}] from a to b, or null.
export function routeOSM(roads, a, b, {kinds = ['n', 'p', 's', 'c'], pad = 0.06, snapKm = 1.5, detour = 2.2} = {}){
  const la0 = Math.min(a.lat, b.lat) - pad, la1 = Math.max(a.lat, b.lat) + pad, lo0 = Math.min(a.lon, b.lon) - pad, lo1 = Math.max(a.lon, b.lon) + pad;
  const ok = new Set(kinds), idx = new Map(), LA = [], LO = [], adj = [];
  const vert = (la, lo) => { const key = Math.round(la/CELL)*1e7 + Math.round(lo/CELL); let v = idx.get(key); if (v == null) { v = LA.length; idx.set(key, v); LA.push(la); LO.push(lo); adj.push([]); } return v; };
  const link = (u, v, w) => { if (u !== v) { adj[u].push(v, w); adj[v].push(u, w); } };
  const segs = [], ends = [];                                     // segs: [vA, vB, road, cost factor]; ends: [vertex, road]
  for (let ri = 0; ri < roads.length; ri++) { const r = roads[ri]; if (!ok.has(r.k)) continue; const bb = r.bb; if (bb[2] < la0 || bb[0] > la1 || bb[3] < lo0 || bb[1] > lo1) continue;
    const f = 1/(SPEED[r.k] || 20), xy = r.xy; let prev = -1;
    for (let j = 0; j < xy.length; j += 2) { const v = vert(xy[j + 1], xy[j]); if (prev >= 0 && prev !== v) { link(prev, v, km(LA[prev], LO[prev], LA[v], LO[v])*f); segs.push([prev, v, ri, f]); } prev = v; }
    ends.push([vert(xy[1], xy[0]), ri], [prev, ri]); }
  if (LA.length < 2) return null;
  // a grid of segments for the junction search
  const G = new Map(), gk = (i, j) => i*100000 + j;
  segs.forEach((s, k) => { const i0 = Math.floor(Math.min(LA[s[0]], LA[s[1]])/GCELL), i1 = Math.floor(Math.max(LA[s[0]], LA[s[1]])/GCELL), j0 = Math.floor(Math.min(LO[s[0]], LO[s[1]])/GCELL), j1 = Math.floor(Math.max(LO[s[0]], LO[s[1]])/GCELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const c = gk(i, j); let l = G.get(c); if (!l) G.set(c, l = []); l.push(k); } });
  const X = v => LO[v]*COSL, Y = v => LA[v];
  // crossings: two segments of different roads that cross without a shared vertex
  const seen = new Set();
  for (const l of G.values()) for (let p = 0; p < l.length; p++) for (let q = p + 1; q < l.length; q++) { const s = segs[l[p]], t = segs[l[q]]; if (s[2] === t[2]) continue;
    if (s[0] === t[0] || s[0] === t[1] || s[1] === t[0] || s[1] === t[1]) continue; const key = l[p] < l[q] ? l[p]*1e7 + l[q] : l[q]*1e7 + l[p]; if (seen.has(key)) continue; seen.add(key);
    const ax = X(s[0]), ay = Y(s[0]), bx = X(s[1]), by = Y(s[1]), cx = X(t[0]), cy = Y(t[0]), dx = X(t[1]), dy = Y(t[1]);
    const den = (bx - ax)*(dy - cy) - (by - ay)*(dx - cx); if (Math.abs(den) < 1e-14) continue;
    const u = ((cx - ax)*(dy - cy) - (cy - ay)*(dx - cx))/den, w = ((cx - ax)*(by - ay) - (cy - ay)*(bx - ax))/den; if (u <= 0 || u >= 1 || w <= 0 || w >= 1) continue;
    const v = vert(ay + (by - ay)*u, (ax + (bx - ax)*u)/COSL);
    for (const [e, f] of [[s[0], s[3]], [s[1], s[3]], [t[0], t[3]], [t[1], t[3]]]) link(v, e, km(LA[v], LO[v], LA[e], LO[e])*f); }
  // T-junctions: a road's end within 30 m of another road's segment
  for (const [e, ri] of ends) { const i = Math.floor(LA[e]/GCELL), j = Math.floor(LO[e]/GCELL); let best = null, bd = 0.03;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const k of G.get(gk(i + di, j + dj)) || []) { const s = segs[k]; if (s[2] === ri || s[0] === e || s[1] === e) continue;
      const ax = X(s[0]), ay = Y(s[0]), bx = X(s[1]), by = Y(s[1]), px = X(e), py = Y(e), L2 = (bx - ax)**2 + (by - ay)**2 || 1e-18;
      const t = Math.max(0, Math.min(1, ((px - ax)*(bx - ax) + (py - ay)*(by - ay))/L2)), qx = ax + (bx - ax)*t, qy = ay + (by - ay)*t, d = Math.hypot(px - qx, py - qy)*111.32;
      if (d < bd) { bd = d; best = [s, qy, qx/COSL]; } }
    if (best) { const [s, la, lo] = best, v = vert(la, lo); link(e, v, km(LA[e], LO[e], la, lo)/20); for (const x of [s[0], s[1]]) link(v, x, km(la, lo, LA[x], LO[x])*s[3]); } }
  const n = LA.length;
  const near = q => { let best = -1, bd = snapKm; for (let v = 0; v < n; v++) { if (!adj[v].length) continue; const d = km(q.lat, q.lon, LA[v], LO[v]); if (d < bd) { bd = d; best = v; } } return best; };
  const s0 = near(a), t0 = near(b); if (s0 < 0 || t0 < 0) return null;
  const g = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), H = heap(), hk = v => km(LA[v], LO[v], LA[t0], LO[t0])/VMAX;
  g[s0] = 0; H.push(hk(s0), s0);
  while (H.size) { const [, u] = H.pop(); if (u === t0) break; const e = adj[u];
    for (let k = 0; k < e.length; k += 2) { const v = e[k], c = g[u] + e[k + 1]; if (c < g[v]) { g[v] = c; from[v] = u; H.push(c + hk(v), v); } } }
  if (!Number.isFinite(g[t0])) return null;
  const out = []; for (let v = t0; v >= 0; v = from[v]) out.push({lat: LA[v], lon: LO[v]}); out.reverse();
  // a detour far longer than the road itself means the loaded roads do not really connect: keep the old line
  let L = 0; for (let k = 1; k < out.length; k++) L += km(out[k - 1].lat, out[k - 1].lon, out[k].lat, out[k].lon);
  return L > detour*km(a.lat, a.lon, b.lat, b.lon) + 2 ? null : out;
}

const plen = r => { let L = 0; for (let k = 1; k < r.length; k++) L += km(r[k - 1].lat, r[k - 1].lon, r[k].lat, r[k].lon); return L; };
// a whole road (its places P in order) routed like a navigation app: places the fastest road does not really pass through
// (going there costs over 20 % more than driving straight on) are skipped, and every place then sits where the route
// passes closest to it. use[i] false: the stretch P[i] → P[i + 1] is not needed (left null). Returns segs[i] = [{lat, lon}] | null.
export function routeCorridor(roads, P, opts = {}, use = null){
  const n = P.length, segs = new Array(Math.max(0, n - 1)).fill(null), need = i => !use || use[i];
  let i = 0;
  while (i < n - 1) { if (!need(i)) { i++; continue; }
    let j = i + 1, path = routeOSM(roads, P[i], P[j], opts);
    while (j < n - 1 && need(j)) { const next = routeOSM(roads, P[j], P[j + 1], opts), direct = routeOSM(roads, P[i], P[j + 1], opts);
      if (direct && (!path || !next || plen(path) + plen(next) > 1.2*plen(direct) + 0.8)) { path = direct; j++; } else break; }
    if (path && j > i + 1) { let k0 = 0;
      for (let m = i + 1; m <= j; m++) { let k1 = path.length - 1;
        if (m < j) { let bd = Infinity; for (let k = k0; k < path.length; k++) { const d = km(P[m].lat, P[m].lon, path[k].lat, path[k].lon); if (d < bd) { bd = d; k1 = k; } } }
        segs[m - 1] = path.slice(k0, Math.max(k1, k0 + 1) + 1); k0 = k1; } }
    else segs[i] = path;
    i = j; }
  return segs; }
