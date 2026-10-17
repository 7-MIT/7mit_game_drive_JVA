// Shared map positioning and live simulation telemetry. No external traffic feed.
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const generic = new Set(['jalan', 'tol', 'lingkar', 'luar', 'dalam', 'akses', 'layang', 'rencana', 'jorr', 'seksi']);
export function roadMatches(c, r) {
  const name = norm(r.name);
  const variants = [c.short, c.name.replace(/\([^)]*\)/g, '')];
  return variants.some(v => {
    const tokens = v.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 3 && !generic.has(t));
    return tokens.length > 0 && tokens.every(t => name.includes(t));
  });
}
export function snapCorridor(osm, q, c, kinds, maxKm) {
  if (!q || !osm.ready || c?.planned) return q;
  const match = c && osm.snap(q.lat, q.lon, kinds, maxKm, r => roadMatches(c, r));
  return match || osm.snap(q.lat, q.lon, kinds, maxKm) || q;
}
export function createMapNodes({nodes, corridors, corrLL, snap}) {
  const cache = new Map();
  return {clear: () => cache.clear(), point(n) {
    if (!n) return n;
    n = nodes.get(n.key) || n;
    if (n.lat == null || n.kind === 'k') return n;
    if (cache.has(n.key)) return cache.get(n.key);
    // Toll membership wins over access roads. Never snap a gate to a city street.
    const roads = [...n.corr].map(id => corridors[id]).filter(Boolean);
    const c = roads.find(c => c.cls === 't' && c.id !== 'mbz') || roads.find(c => c.cls !== 'a');
    if (!c) return n;
    const entry = c.nodes.find(e => e.key === n.key), raw = corrLL(c.id, entry.km) || n;
    const p = snap(raw, c.id, entry.km), out = {...n, lat: p.lat, lon: p.lon};
    cache.set(n.key, out); return out;
  }};
}
export const TRAFFIC_COLORS = {heavy: '#d93025', slow: '#fbbc04', clear: '#1a73e8'};
export function trafficLevel(ratio) { return ratio <= 0.3 ? 'heavy' : ratio <= 0.65 ? 'slow' : 'clear'; }
export function collectMapTraffic({vehicles, clock, minU, maxU, limitAt, corridorAt, bucketSize = 150}) {
  const buckets = new Map(), incidents = [];
  for (const v of vehicles) {
    if (v.rp || v.lane < 0 || !Number.isFinite(v.p)) continue;
    const u = v.sd*v.p; if (u < minU || u >= maxU) continue;
    if (v.crashT > clock && (v.dmg > 0 || v.spinY)) incidents.push({u, sd: v.sd, type: 'crash', title: 'Kecelakaan'});
    // A parked player or a shoulder vehicle is not a traffic jam.
    if (v.player || v.esc || v.lx < -0.5 || (Number.isFinite(v.n) && v.lx >= v.n)) continue;
    const cid = corridorAt(u), i = Math.floor(u/bucketSize), key = `${cid}:${v.sd}:${i}`;
    let b = buckets.get(key); if (!b) buckets.set(key, b = {sd: v.sd, cid, u, a: Math.max(minU, i*bucketSize), b: Math.min(maxU, (i + 1)*bucketSize), total: 0, n: 0});
    b.total += Math.max(0, v.vel)/Math.max(1, limitAt(u)); b.n++;
  }
  // Unsampled roads keep their base style, rather than being labelled clear.
  const segments = [...buckets.values()].filter(b => b.n >= 2).map(b => ({...b, level: trafficLevel(b.total/b.n)}));
  return {segments, incidents};
}

// Split the navigation polyline itself at traffic boundaries. Keep every bend,
// including OSM vertices sharing the same route distance. Never offset a colour
// onto a neighbouring road or use traffic travelling against the destination.
export function navigationStrokes(points, segments, sd = 1) {
  const traffic = segments.filter(s => s.sd === sd && s.b > s.a);
  const cuts = [...new Set(traffic.flatMap(s => [s.a, s.b]))].sort((a,b) => a-b);
  const strokes = [];
  const add = (a, b, u) => {
    const level = traffic.find(s => u >= s.a && u < s.b)?.level || 'clear';
    const last = strokes[strokes.length - 1];
    if (last?.level === level) last.points.push(b);
    else strokes.push({level, points: [a, b]});
  };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], du = b.u - a.u;
    const stops = du > 0 ? cuts.filter(u => u > a.u && u < b.u) : [];
    let prev = a;
    for (const u of [...stops, b.u]) {
      const f = du ? (u - a.u)/du : 1;
      const q = u === b.u ? b : {u, lat: a.lat + (b.lat - a.lat)*f, lon: a.lon + (b.lon - a.lon)*f};
      add(prev, q, du ? (prev.u + u)/2 : u); prev = q;
    }
  }
  return strokes;
}
