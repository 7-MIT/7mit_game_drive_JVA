// Packages the OpenStreetMap data the game uses, so players never wait on (or get refused by) the public Overpass servers.
// Run weekly by .github/workflows/osm-data.yml; the files go to the branch osm-data and the game reads them from there (simulator/osm.js, PACK).
//   node tools/osm-build.mjs <out-dir>          env: OVERPASS (comma-separated mirrors), ONLY (comma-separated keys, for a test run)
// Files (same format as the game's browser cache, {t, d}):
//   base.json                  toll roads and trunk roads of Java and Madura
//   m<lat2>_<lon2>.json        toll and trunk roads of Sumatera and Bali, per 2° area
//   u<lat>_<lon>.json          provincial, regency and city roads (primary, secondary, tertiary), per 1° area, all islands
//   coast.json, coast-sumatra.json, coast-bali.json   coastlines as closed rings
import fs from 'fs'; import path from 'path';
import {parseOverpass, assembleRings, BBOX, REGIONS} from '../simulator/osm.js';

const OUT = path.resolve(process.argv[2] || 'osm-out'), DIR = path.join(OUT, 'osm');
const MIRRORS = (process.env.OVERPASS || 'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter').split(',');
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
fs.mkdirSync(DIR, {recursive: true});
const wait = ms => new Promise(r => setTimeout(r, ms));
const bb = (s, w, n, e) => `(${s},${w},${n},${e})`;
const poly = r => `(poly:"${REGIONS[r].poly.map(p => p.join(' ')).join(' ')}")`;
const inPoly = (P, lat, lon) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [yi, xi] = P[i], [yj, xj] = P[j];
  if ((yi > lat) !== (yj > lat) && lon < (xj - xi)*(lat - yi)/(yj - yi) + xi) c = !c; } return c; };
// does the square [s, w, s + d, w + d] touch an island of the network (or only Sumatera / Bali)?
const inBB = (q, [la, lo]) => la >= q[0] && la <= q[2] && lo >= q[1] && lo <= q[3];
function touches(s, w, d, which = ['jawa', 'sumatra', 'bali']){ const pts = []; for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++) pts.push([s + d*a/4, w + d*b/4]);
  return pts.some(p => (which.includes('jawa') && inBB(BBOX, p)) || (which.includes('bali') && inBB(REGIONS.bali.bb, p)) || (which.includes('sumatra') && inPoly(REGIONS.sumatra.poly, p[0], p[1]))); }

async function overpass(q, timeoutMs){ let last = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const m of MIRRORS) { const ac = new AbortController(), to = setTimeout(() => ac.abort(), timeoutMs);
      try { const r = await fetch(m, {method: 'POST', body: 'data=' + encodeURIComponent(q), headers: {'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'driving.7mit OSM packager (halo@7mit.org)'}, signal: ac.signal});
        clearTimeout(to); if (!r.ok) { last = `${new URL(m).host}: HTTP ${r.status}`; continue; } return await r.json(); }
      catch (e) { clearTimeout(to); last = `${new URL(m).host}: ${e.name === 'AbortError' ? 'timeout' : e.message}`; } }
    await wait(30000*(attempt + 1)); }
  throw new Error(last); }

const jobs = [];
const add = (key, query, kind, ms = 300000, check = null) => { if (!ONLY || ONLY.has(key)) jobs.push({key, query, kind, ms, check}); };
add('base', `[out:json][timeout:300];way["highway"~"^(motorway|trunk)$"]${bb(...BBOX)};out geom;`, 'roads', 400000, d => d.length > 100);
for (let ti = -5; ti <= 2; ti++) for (let tj = 47; tj <= 57; tj++) { const s = ti*2, w = tj*2; if (!touches(s, w, 2, ['sumatra', 'bali'])) continue;
  add(`m${ti}_${tj}`, `[out:json][timeout:240];way["highway"~"^(motorway|trunk)$"]${bb(s, w, s + 2, w + 2)};out geom;`, 'roads'); }
for (let ti = -10; ti <= 5; ti++) for (let tj = 95; tj <= 115; tj++) { if (!touches(ti, tj, 1)) continue;
  add(`u${ti}_${tj}`, `[out:json][timeout:240];way["highway"~"^(primary|secondary|tertiary)$"]${bb(ti, tj, ti + 1, tj + 1)};out geom;`, 'roads'); }
const span = min => d => d.some(p => { let a = 180, b = -180; for (const q of p) { a = Math.min(a, q[0]); b = Math.max(b, q[0]); } return b - a > min; });
add('coast', `[out:json][timeout:600];way["natural"="coastline"]${bb(...BBOX)};out body geom;`, 'coast', 700000, span(7));
add('coast-bali', `[out:json][timeout:300];way["natural"="coastline"]${bb(...REGIONS.bali.bb)};out body geom;`, 'coast', 400000, span(0.9));
add('coast-sumatra', `[out:json][timeout:900];way["natural"="coastline"]${poly('sumatra')};out body geom;`, 'coast', 1000000, span(8));

console.log(`${jobs.length} files to build into ${DIR}`);
const index = fs.existsSync(path.join(DIR, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'))) : {files: {}};
let ok = 0, failed = [];
for (const [n, j] of jobs.entries()) { const t0 = Date.now();
  try { const raw = await overpass(j.query, j.ms), d = j.kind === 'coast' ? assembleRings(raw) : parseOverpass(raw);
    if (j.check && !j.check(d)) throw new Error('data tidak lengkap');
    const body = JSON.stringify({t: Date.now(), d}); fs.writeFileSync(path.join(DIR, j.key + '.json'), body);
    index.files[j.key] = {n: d.length, bytes: body.length, t: Date.now()}; ok++;
    console.log(`[${n + 1}/${jobs.length}] ${j.key}: ${d.length} ${j.kind === 'coast' ? 'rings' : 'ways'}, ${(body.length/1e6).toFixed(2)} MB, ${((Date.now() - t0)/1000).toFixed(0)} s`); }
  catch (e) { failed.push(j.key); console.log(`[${n + 1}/${jobs.length}] ${j.key}: GAGAL ${e.message} (the previous file stays)`); }
  await wait(3000); }
index.built = new Date().toISOString(); index.failed = failed;
fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify(index, null, 1));
console.log(`done: ${ok} built, ${failed.length} failed${failed.length ? ': ' + failed.join(', ') : ''}`);
if (!ok) process.exit(1);
