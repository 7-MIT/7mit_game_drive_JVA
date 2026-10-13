// ================================================================
// Mode Terbang: a small flight simulator over Java and Madura.
// Terrain from the elevation anchors and the volcanoes, every road of the network drawn on it,
// the real airports with runways, two aircraft, arcade-but-honest flight physics, HUD, mini map.
// Runs on its own WebGL canvas (logarithmic depth, so a 2 m wheel and a 300 km horizon share one view);
// the driving game pauses underneath while flying.
// ================================================================
import * as THREE from 'three';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {AIRPORT_DATA} from './airports.js';

const D2R = Math.PI/180, R2D = 180/Math.PI, G = 9.81, KT = 1.94384, FT = 3.28084;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a)*t, sstep = (a, b, x) => { const t = clamp((x - a)/(b - a), 0, 1); return t*t*(3 - 2*t); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

// local metric frame: x east, z south, y up (metres), centred on Central Java
const LON0 = 110.2, LAT0 = -7.3, KX = 111320*Math.cos(LAT0*D2R), KZ = 110574;
const toX = lon => (lon - LON0)*KX, toZ = lat => -(lat - LAT0)*KZ, toLon = x => LON0 + x/KX, toLat = z => LAT0 - z/KZ;

const PLANES = {
  c172: {name: 'Cessna 172', vs: 25, vr: 28, vmax: 66, acc: 3.2, pitch: 34, roll: 85, gear: 1.25, camD: 17, camH: 4.2, eye: [0, 1.15, -0.4], mass: 'ringan'},
  b737: {name: 'Boeing 737', vs: 64, vr: 72, vmax: 250, acc: 2.9, pitch: 17, roll: 42, gear: 3.85, camD: 62, camH: 14, eye: [0, 1.2, -15.2], mass: 'berat'}};

export function initFly(A){
  const MOBILE = A.mobile;
  let built = false, on = false, renderer, scene, camera, root, hemi, sun, skyMat, sky, fog, sea, terrain, roads, roadsT, labels = [], clouds, lights, planeG, prop, gridH, GX, GY, LONA, LATN, STEP;
  let roadPts = null, roadHash = null;
  const st = {plane: 'c172', x: 0, y: 1000, z: 0, hd: 0, pitch: 0, roll: 0, v: 50, sink: 0, thr: 0.7, ground: false, crashed: false, cam: 'chase', warp: 1, start: null, brake: false, msgT: 0, stallT: 0, vs: 0, invert: false, camYaw: 0};
  const key = {};

  // ---------- terrain height ----------
  const VOL = A.volcanoes.map(([name, lat, lon, h]) => ({name, lat, lon, h, x: toX(lon), z: toZ(lat), base: A.altAt(lat, lon)}));
  // airports from the real data: every runway in metres, the frame of the main runway for the buildings
  const APT = AIRPORT_DATA.map(a => {
    const rws = a.rw.map(r => { const ax = toX(r.a[1]), az = toZ(r.a[0]), bx = toX(r.b[1]), bz = toZ(r.b[0]), len = Math.hypot(bx - ax, bz - az), ux = (bx - ax)/len, uz = (bz - az)/len;
      return {id: r.id, w: Math.max(18, r.w), ax, az, bx, bz, len, ux, uz, cx: (ax + bx)/2, cz: (az + bz)/2, hd: Math.atan2(ux, -uz)}; });
    const lay = a.lay, m = rws[lay.main || 0], side = lay.side || 1, P = (s, d) => [m.cx + m.ux*s - m.uz*d, m.cz + m.uz*s + m.ux*d];
    let r = 0; for (const w of rws) for (const [x, z] of [[w.ax, w.az], [w.bx, w.bz]]) r = Math.max(r, Math.hypot(x - m.cx, z - m.cz));
    for (const b of lay.b) r = Math.max(r, Math.hypot(b[1], b[2]) + 350);
    const main = rws.reduce((p, q) => q.len > p.len ? q : p);
    return {code: a.iata || a.icao, icao: a.icao, name: a.short, full: a.name, city: a.city, big: a.type === 'l', type: a.type, rws, m, main, side, lay, P, x: m.cx, z: m.cz, r, elev: Math.max(3, a.elev), lat: a.lat, lon: a.lon}; });
  const inPoly = (poly, lon, lat) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi)*(lat - yi)/(yj - yi) + xi) c = !c; } return c; };
  const noise = (x, z) => { const s = Math.sin(x*0.00031 + Math.sin(z*0.00023)*2.1)*0.5 + Math.sin(z*0.00041 + x*0.00011)*0.35 + Math.sin((x + z)*0.0011)*0.15 + Math.sin(x*0.0029 - z*0.0023)*0.08; return s; };
  function heightAt(lat, lon){
    const x = toX(lon), z = toZ(lat);
    for (const a of APT) { const d = Math.hypot(x - a.x, z - a.z), r0 = a.r + STEP*111000*1.6; if (d < r0 + 2500) { const t = sstep(r0, r0 + 2500, d); if (t < 1) return {h: lerp(a.elev, rawH(lat, lon, x, z), t), land: true, apt: a}; } }
    return {h: rawH(lat, lon, x, z), land: null};
  }
  function rawH(lat, lon, x, z){
    let h = A.altAt(lat, lon); h += (h*0.22 + 8)*noise(x, z);
    for (const v of VOL) { const d = Math.hypot(x - v.x, z - v.z), r = v.h*4.6; if (d < r) { const f = Math.pow(1 - d/r, 1.7), c = v.base + (v.h - v.base)*f; if (c > h) h = lerp(h, c, sstep(0, 0.15, 1 - d/r)); } }
    return Math.max(2, h); }

  function buildTerrain(){
    STEP = MOBILE ? 0.03 : 0.02; LONA = 105.1; LATN = -5.75; GX = Math.ceil((114.75 - LONA)/STEP) + 1; GY = Math.ceil((LATN - -8.95)/STEP) + 1;
    gridH = new Float32Array(GX*GY); const pos = new Float32Array(GX*GY*3), col = new Float32Array(GX*GY*3);
    const C = {sea: new THREE.Color(0x1b4f72), shore: new THREE.Color(0xc9b98a), rice: new THREE.Color(0x6e9a3e), rice2: new THREE.Color(0x87a94a), forest: new THREE.Color(0x3f6b2f), high: new THREE.Color(0x5a6b3a), rock: new THREE.Color(0x7a6a58), peak: new THREE.Color(0x8d8478), town: new THREE.Color(0xb3a28f)};
    const tmp = new THREE.Color(), towns = A.towns.map(t => ({x: toX(t.lon), z: toZ(t.lat)}));
    const isl = [A.coast.JAVA, A.coast.MADURA, ...A.coast.ISL].map(p => ({p, x0: Math.min(...p.map(q => q[0])), x1: Math.max(...p.map(q => q[0])), y0: Math.min(...p.map(q => q[1])), y1: Math.max(...p.map(q => q[1]))}));
    const onLand = (lat, lon) => isl.some(o => lon >= o.x0 && lon <= o.x1 && lat >= o.y0 && lat <= o.y1 && inPoly(o.p, lon, lat));
    for (let j = 0; j < GY; j++) { const lat = LATN - j*STEP;
      for (let i = 0; i < GX; i++) { const lon = LONA + i*STEP, k = j*GX + i, x = toX(lon), z = toZ(lat);
        const hh = heightAt(lat, lon), land = hh.land || onLand(lat, lon);
        const h = land ? Math.max(3, hh.h) : -45 - 30*Math.abs(noise(x*3, z*3)); gridH[k] = h;
        pos[k*3] = x; pos[k*3 + 1] = h; pos[k*3 + 2] = z;
        if (!land) tmp.copy(C.sea);
        else if (h < 250) { tmp.copy(C.rice).lerp(C.rice2, 0.5 + 0.5*noise(x*7, z*7)); let tn = 0; for (const t of towns) { const d = Math.hypot(x - t.x, z - t.z); if (d < 6000) tn = Math.max(tn, 1 - d/6000); } tmp.lerp(C.town, tn*0.75); }
        else if (h < 1100) tmp.copy(C.rice).lerp(C.forest, sstep(250, 900, h));
        else if (h < 2000) tmp.copy(C.forest).lerp(C.high, sstep(1100, 2000, h));
        else tmp.copy(C.rock).lerp(C.peak, sstep(2300, 3300, h));
        col[k*3] = tmp.r; col[k*3 + 1] = tmp.g; col[k*3 + 2] = tmp.b; } }
    // the sea next to the coast is shallow, so the shore lies between the grid points instead of the coastal plain sinking under water
    const sh = []; for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) { const k = j*GX + i; if (gridH[k] >= 0) continue;
      let nb = false; for (let v = -1; v <= 1 && !nb; v++) for (let u = -1; u <= 1; u++) { const jj = j + v, ii = i + u; if (jj >= 0 && ii >= 0 && jj < GY && ii < GX && gridH[jj*GX + ii] > 0) { nb = true; break; } }
      if (nb) sh.push(k); }
    for (const k of sh) { gridH[k] = -2.5; pos[k*3 + 1] = -2.5; }
    const idx = new Uint32Array((GX - 1)*(GY - 1)*6); let n = 0;
    for (let j = 0; j < GY - 1; j++) for (let i = 0; i < GX - 1; i++) { const a = j*GX + i, b = a + 1, c = a + GX + 1, d = a + GX;   // a=(i,j) b=(i+1,j) c=(i+1,j+1) d=(i,j+1)
      idx[n++] = a; idx[n++] = d; idx[n++] = c; idx[n++] = a; idx[n++] = c; idx[n++] = b; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    terrain = new THREE.Mesh(g, new THREE.MeshLambertMaterial({vertexColors: true})); root.add(terrain);
  }
  // exact height of the terrain mesh (same triangles as above), sea surface is 0
  function groundAt(x, z){
    const lon = toLon(x), lat = toLat(z), fi = (lon - LONA)/STEP, fj = (LATN - lat)/STEP;
    if (fi < 0 || fj < 0 || fi >= GX - 1 || fj >= GY - 1) return {h: 0, sea: true};
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, w = fj - j, k = j*GX + i;
    const ha = gridH[k], hb = gridH[k + 1], hc = gridH[k + GX + 1], hd = gridH[k + GX];
    const h = u > w ? ha + u*(hb - ha) + w*(hc - hb) : ha + w*(hd - ha) + u*(hc - hd);
    return h <= 0 ? {h: 0, sea: true} : {h, sea: false};
  }

  // ---------- roads: every road of the network, drawn on the ground ----------
  function buildRoads(){
    const kinds = {t: [[], [], 0xf39c12], n: [[], [], 0xfff1c4], p: [[], [], 0xe9dcc3], a: [[], [], 0xd8d0c4]}; roadPts = [];
    for (const c of A.corridors) { if (c.planned) continue; const g = A.corrGeo(c.id); if (!g || g.length < 2) continue;
      const kd = c.cls === 't' ? 't' : c.cls === 'a' ? 'a' : c.prov ? 'p' : 'n', K = kinds[kd], lift = kd === 't' ? 9 : 6;
      let prev = null;
      for (let q = 0; q < g.length; q++) { const x = toX(g[q].lon), z = toZ(g[q].lat);
        if (prev) { const L = Math.hypot(x - prev[0], z - prev[1]), n = Math.max(1, Math.ceil(L/350));
          for (let s = 0; s < n; s++) { const x0 = lerp(prev[0], x, s/n), z0 = lerp(prev[1], z, s/n), x1 = lerp(prev[0], x, (s + 1)/n), z1 = lerp(prev[1], z, (s + 1)/n);
            K[0].push(x0, groundAt(x0, z0).h + lift, z0, x1, groundAt(x1, z1).h + lift, z1); roadPts.push([x0, z0, c]); } }
        prev = [x, z]; } }
    const mk = (K, w) => { const g = new LineSegmentsGeometry(); g.setPositions(K[0]); const m = new LineMaterial({color: K[2], linewidth: w, worldUnits: false}); const l = new LineSegments2(g, m); l.frustumCulled = false; return l; };
    roads = [mk(kinds.n, 2), mk(kinds.p, 1.4), mk(kinds.a, 1.1)]; roadsT = mk(kinds.t, 3.2); for (const l of [...roads, roadsT]) root.add(l);
    roadHash = new Map(); for (const p of roadPts) { const h = Math.floor(p[0]/2000) + ',' + Math.floor(p[1]/2000); if (!roadHash.has(h)) roadHash.set(h, []); roadHash.get(h).push(p); }
  }
  const roadBelow = (x, z) => { let best = null, bd = 900; const cx = Math.floor(x/2000), cz = Math.floor(z/2000);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const p of roadHash.get((cx + a) + ',' + (cz + b)) || []) { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = p[2]; } }
    return best; };
  const townNear = (x, z) => { let best = null, bd = Infinity; for (const t of A.towns) { const d = Math.hypot(toX(t.lon) - x, toZ(t.lat) - z); if (d < bd) { bd = d; best = t; } } return best && {t: best, d: bd}; };

  // ---------- airports: real runways with their markings, taxiways, aprons, terminals in the style of the real ones ----------
  const AM = {};          // shared materials
  function airMats(){ const L = (c, o = {}) => new THREE.MeshLambertMaterial({color: c, ...o}), S = (c, r, m, o = {}) => new THREE.MeshStandardMaterial({color: c, roughness: r, metalness: m, ...o});
    Object.assign(AM, {rwy: L(0x3a3c3f), taxi: L(0x505357), apron: L(0x9b9d9f), white: L(0xf2f2f2), yellow: L(0xf2c200), wall: L(0xe9e4da), wall2: L(0xd4d8dd), glass: S(0x2f5470, 0.08, 0.7),
      joglo: L(0x7b3a20), tile: L(0xa04a2a), metal: S(0xc9ced4, 0.35, 0.6, {side: THREE.DoubleSide}), green: L(0x4f7d3a), wood: L(0x8a5a35), hangar: S(0xb9c2cc, 0.4, 0.5, {side: THREE.DoubleSide}),
      door: L(0x5b6168), tower: L(0xf1f1ef), red: L(0xc8202b), grass: L(0x6f9a46)}); }
  const nz = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; };
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V1 = new THREE.Vector3(), V2 = new THREE.Vector3(1, 1, 1), EU = new THREE.Euler();
  const mtx = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0) => M4.clone().compose(V1.set(x, y, z), Q.setFromEuler(EU.set(rx, ry, 0, 'YXZ')), V2.set(sx, sy, sz));
  // a pyramid roof (joglo / limasan): four sides, the joglo with a steep top over a flatter skirt
  const pyr = (w, d, h) => { const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); g.rotateY(Math.PI/4); g.translate(0, 0.5, 0); g.scale(w, h, d); return g; };
  // a roof surface over [-len/2, len/2] × [-dep/2, dep/2]: an arch across, optionally waves along (Kertajati, YIA)
  function roofGeo(len, dep, rise, wave){ const g = new THREE.PlaneGeometry(len, dep, Math.max(8, Math.round(len/12)), 10); g.rotateX(-Math.PI/2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), f = 1 - (2*z/dep)**2; p.setY(i, rise*f + (wave ? wave*Math.sin(x/len*Math.PI*2*3)*(0.6 + 0.4*f) : 0)); } g.computeVertexNormals(); return g; }
  function buildAirports(){ airMats(); const plane = bakePlane();
    for (const a of APT) { const bk = new Map(), put = (mat, geo, m) => { if (!bk.has(mat)) bk.set(mat, []); const g = nz(geo); if (m) g.applyMatrix4(m); bk.get(mat).push(g); };
      const G = new THREE.Group(); G.position.set(a.m.cx, a.elev, a.m.cz); G.rotation.y = Math.atan2(-a.m.uz, a.m.ux);   // local x along the main runway, local z to its right
      const toL = (x, z) => [(x - a.m.cx)*a.m.ux + (z - a.m.cz)*a.m.uz, -(x - a.m.cx)*a.m.uz + (z - a.m.cz)*a.m.ux], lights = [], lcol = [];
      const side = a.side, quad = (mat, m0, x, z, l, w, y = 0) => put(mat, new THREE.PlaneGeometry(l, w).rotateX(-Math.PI/2), M4.clone().multiplyMatrices(m0, mtx(x, y, z)));
      a.rws.forEach((r, ri) => {
        const [ls, ld] = toL(r.cx, r.cz), dh = Math.atan2(r.ux*a.m.uz*-1 + r.uz*a.m.ux, r.ux*a.m.ux + r.uz*a.m.uz), R0 = mtx(ls, 0, ld, -dh), L = r.len, W = r.w, hl = L/2;
        quad(AM.rwy, R0, 0, 0, L + 20, W + 6, 0.3);                                        // asphalt with shoulders
        // markings: edge lines, centre line, threshold bars, aiming point, touchdown zone
        for (const sd of [-1, 1]) quad(AM.white, R0, 0, sd*(W/2 - 1.2), L - 10, 0.9, 0.36);
        for (let x = -hl + 160; x < hl - 160; x += 60) quad(AM.white, R0, x + 15, 0, 30, 0.9, 0.36);
        const nb = W >= 44 ? 12 : W >= 30 ? 8 : 6;
        for (const e of [-1, 1]) { const x0 = e*(hl - 6 - 15);
          for (let k = 0; k < nb; k++) { const z = (k - (nb - 1)/2)*(W - 6)/nb + (k >= nb/2 ? 1.5 : -1.5); quad(AM.white, R0, x0, z, 30, 1.8, 0.36); }
          if (L > 1500) for (const sd of [-1, 1]) quad(AM.white, R0, e*(hl - 400), sd*W*0.25, 50, Math.min(10, W*0.18), 0.36);
          if (L > 2000) for (const xx of [150, 300, 600, 750]) for (const sd of [-1, 1]) for (const k of [0, 1]) quad(AM.white, R0, e*(hl - xx), sd*(W*0.25 + (k ? 3.6 : 0)), 22, 1.8, 0.36);
          // designator: number with its letter, readable from the approach
          const id = r.id.split('/')[e < 0 ? 0 : 1], c = document.createElement('canvas'); c.width = 128; c.height = 256; const g2 = c.getContext('2d'); g2.fillStyle = '#f2f2f2'; g2.textAlign = 'center';
          g2.font = '700 120px Archivo, sans-serif'; g2.fillText(id.slice(0, 2), 64, 112); if (id[2]) g2.fillText(id[2], 64, 236);
          const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
          const dm = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(18, W*0.4), 36).rotateX(-Math.PI/2), new THREE.MeshLambertMaterial({map: tx, transparent: true, depthWrite: false}));
          dm.matrixAutoUpdate = false; dm.matrix.multiplyMatrices(R0, mtx(e*(hl - 80), 0.37, 0, e < 0 ? -Math.PI/2 : Math.PI/2)); G.add(dm); }
        // parallel taxiway and its links, with a yellow centre line
        const ts = (a.lay.tside || [])[ri] ?? side, toff = a.big ? 200 : W > 40 ? 160 : 110, tw = W > 40 ? 23 : 15;
        quad(AM.taxi, R0, 0, ts*toff, L*0.94, tw, 0.25); quad(AM.yellow, R0, 0, ts*toff, L*0.94, 0.4, 0.3);
        for (const f of [-0.47, -0.2, 0.05, 0.3, 0.47]) { quad(AM.taxi, R0, f*L, ts*(toff/2 + W/4), tw, toff - W/2, 0.25); quad(AM.yellow, R0, f*L, ts*(toff/2 + W/4), 0.4, toff - W/2, 0.3); }
        // lights: edges white, thresholds green, ends red, approach lights on the big runways
        const lp = (x, z, col) => { V1.set(x, 1, z).applyMatrix4(R0); lights.push(V1.x, V1.y, V1.z); lcol.push(...col); };
        for (let x = -hl; x <= hl; x += 60) for (const sd of [-1, 1]) lp(x, sd*(W/2 + 2), [1, 0.95, 0.8]);
        for (const e of [-1, 1]) for (let k = -6; k <= 6; k++) { lp(e*(hl + 1), k*W/13, [0.2, 1, 0.3]); lp(e*(hl - 1), k*W/13, [1, 0.15, 0.1]); }
        if (L > 2000) for (const e of [-1, 1]) for (let x = 30; x <= 900; x += 30) { lp(e*(hl + x), 0, [1, 1, 0.9]); if (x % 300 === 0) for (let k = -5; k <= 5; k++) lp(e*(hl + x), k*3, [1, 1, 0.9]); }
      });
      // aprons
      for (const [s0, s1, d0, d1] of a.lay.apron || []) quad(AM.apron, new THREE.Matrix4(), (s0 + s1)/2, side*(d0 + d1)/2, s1 - s0, d1 - d0, 0.2);
      // buildings
      const gates = [];
      for (const [type, s, d0, o] of a.lay.b) { const d = side*d0, f = Math.sign(d) || 1;      // f: which way is away from the runway
        if (type === 'tower') { const h = o.h; put(AM.tower, new THREE.CylinderGeometry(3.2, 4.2, h, 12), mtx(s, h/2, d)); put(AM.glass, new THREE.CylinderGeometry(8, 6.5, 6, 12), mtx(s, h + 3, d));
          put(AM.tower, new THREE.CylinderGeometry(8.6, 8.6, 1.4, 12), mtx(s, h + 6.7, d)); put(AM.red, new THREE.CylinderGeometry(0.3, 0.3, 8, 6), mtx(s, h + 11, d)); put(AM.wall, new THREE.BoxGeometry(24, 8, 18), mtx(s, 4, d + f*14)); }
        else if (type === 'hangar') { const n = o.n, w = o.big ? 105 : 62, dp = o.big ? 85 : 55, hh = o.big ? 16 : 10;
          for (let k = 0; k < n; k++) { const x = s + (k - (n - 1)/2)*(w + 12), z = d + f*dp/2;
            put(AM.hangar, new THREE.BoxGeometry(w, hh, dp), mtx(x, hh/2, z)); const arch = new THREE.CylinderGeometry(w/2, w/2, dp, 20, 1, true, -Math.PI/2, Math.PI); arch.rotateX(Math.PI/2); arch.scale(1, (o.big ? 14 : 9)/(w/2), 1);
            put(AM.hangar, arch, mtx(x, hh, z)); put(AM.door, new THREE.PlaneGeometry(w*0.86, hh*0.9), mtx(x, hh*0.45, z - f*(dp/2 + 0.2), f > 0 ? Math.PI : 0)); } }
        else if (type === 'cargo') { for (let k = 0; k < 3; k++) put(AM.wall2, new THREE.BoxGeometry(o.len/3 - 20, 14, 70), mtx(s + (k - 1)*o.len/3, 7, d)); }
        else if (type === 'small') { const l = o.len, dp = 28; put(AM.wall, new THREE.BoxGeometry(l, 7, dp), mtx(s, 3.5, d)); put(AM.glass, new THREE.BoxGeometry(l*0.8, 3.2, 0.4), mtx(s, 3.6, d - f*(dp/2 + 0.1)));
          put(AM.tile, pyr(l + 6, dp + 6, 7), mtx(s, 7, d)); put(AM.tile, pyr(l*0.3, dp*0.6, 6), mtx(s, 11, d)); gates.push([s, d - f*dp/2, f, 0.62, l]); }
        else if (type === 'green') { const l = o.len, dp = o.dep;                    // Banyuwangi: wooden louvres, planted roofs, open courtyards
          for (let k = 0; k < 3; k++) { const x = s + (k - 1)*l/3; put(AM.wood, new THREE.BoxGeometry(l/3 - 8, 9, dp), mtx(x, 4.5, d)); put(AM.green, new THREE.BoxGeometry(l/3 - 4, 1.6, dp + 6), mtx(x, 9.8, d)); put(AM.green, pyr(l/3 - 14, dp*0.6, 5), mtx(x, 10.6, d)); }
          put(AM.glass, new THREE.BoxGeometry(l*0.9, 4, 0.4), mtx(s, 3, d - f*(dp/2 + 0.1))); gates.push([s, d - f*dp/2, f, 0.7, l]); }
        else if (type === 'cgk12') {                                                 // Soekarno–Hatta T1/T2: a landside hall and three piers ending in rings of joglo pavilions
          const hall = 420; put(AM.wall, new THREE.BoxGeometry(hall, 12, 60), mtx(s, 6, d + f*90));
          for (let k = 0; k < 9; k++) put(AM.joglo, pyr(42, 54, 15), mtx(s + (k - 4)*46, 12, d + f*90));
          for (const px of [-160, 0, 160]) { put(AM.wall, new THREE.BoxGeometry(16, 8, 200), mtx(s + px, 4, d - f*30)); put(AM.joglo, pyr(20, 200, 6), mtx(s + px, 8, d - f*30));
            const cx = s + px, cz = d - f*170;
            for (let k = 0; k < 7; k++) { const ang = (k/6 - 0.5)*Math.PI*1.1, x = cx + Math.sin(ang)*62, z = cz - f*Math.cos(ang)*62;
              put(AM.wall, new THREE.BoxGeometry(24, 7, 24), mtx(x, 3.5, z, ang)); put(AM.joglo, pyr(28, 28, 9), mtx(x, 7, z, ang)); put(AM.joglo, pyr(12, 12, 6), mtx(x, 13, z, ang));
              if (k % 2 === 0) gates.push([x, z - f*12, f, 1, 0, ang]); } } }
        else if (type === 'long' || type === 'wave') { const l = o.len, dp = o.dep, h = o.h, wv = type === 'wave';
          put(AM.wall, new THREE.BoxGeometry(l, h*0.62, dp), mtx(s, h*0.31, d)); put(AM.glass, new THREE.BoxGeometry(l*0.98, h*0.42, dp + 0.8), mtx(s, h*0.36, d));
          put(AM.metal, roofGeo(l + 24, dp + 26, wv ? 9 : 7, wv ? 4.5 : 0), mtx(s, h*0.62, d));
          for (let k = 0; k < Math.round(l/40); k++) put(AM.wall2, new THREE.CylinderGeometry(0.8, 0.8, h*0.62, 6), mtx(s - l/2 + 20 + k*40, h*0.31, d - f*(dp/2 + 10)));
          if (o.pier) { const pz = d - f*(dp/2 + 70), pl = l*1.15; put(AM.wall, new THREE.BoxGeometry(pl, 9, 30), mtx(s, 4.5, pz)); put(AM.glass, new THREE.BoxGeometry(pl*0.98, 5, 30.6), mtx(s, 5, pz));
            put(AM.metal, roofGeo(pl + 10, 36, 3, 0), mtx(s, 9, pz)); for (const lx of [-0.3, 0.3]) put(AM.wall, new THREE.BoxGeometry(24, 8, 60), mtx(s + lx*l, 4, d - f*(dp/2 + 28)));
            gates.push([s, pz - f*15, f, 1, pl]); }
          else gates.push([s, d - f*dp/2, f, 1, l]); }
      }
      // gates: jet bridges and parked aircraft, nose towards the terminal
      for (const [gx, gz, f, sc, len, ang = 0] of gates) { const n = len ? Math.max(1, Math.min(10, Math.floor(len/(70*sc)))) : 1, ox = Math.sin(ang), oz = -f*Math.cos(ang), th = Math.atan2(Math.sin(ang), -f*Math.cos(ang)), D = 16 + 20*sc;
        for (let k = 0; k < n; k++) { const x = len ? gx + (k - (n - 1)/2)*len/n : gx;
          if (sc >= 0.9) put(AM.wall2, new THREE.BoxGeometry(3.2, 3.2, 16), mtx(x + ox*8, 4.8, gz + oz*8, th));
          if ((k*7 + a.code.length) % 3 !== 2) for (const [mat, geo] of plane) put(mat, geo.clone(), mtx(x + ox*D, 3.85*sc + 0.2, gz + oz*D, th, sc, sc, sc)); } }
      for (const [mat, list] of bk) { const g = mergeGeometries(list, false); const ms = new THREE.Mesh(g, mat); G.add(ms); list.forEach(x => x.dispose()); }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lights, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(lcol, 3));
      const lt = new THREE.Points(lg, new THREE.PointsMaterial({size: 3.2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})); G.add(lt);
      root.add(G); a.G = G; a.lights = lt; a.lab = label(`${a.code} · ${a.name}`, a.x, a.elev + 160, a.z, '#ffe08a', 1.05); }
  }
  // a parked airliner, baked once into a few geometries (one per material)
  function bakePlane(){ const g = buildPlane('b737'); g.updateMatrixWorld(true); const by = new Map();
    g.traverse(o => { if (!o.isMesh || o.material.isMeshBasicMaterial) return; const k = o.material; if (!by.has(k)) by.set(k, []); by.get(k).push(nz(o.geometry.clone()).applyMatrix4(o.matrixWorld)); });
    return [...by].map(([m, l]) => [m, mergeGeometries(l, false)]); }

  // ---------- labels (towns, airports, volcanoes): screen-sized sprites ----------
  function label(t, x, y, z, color = '#fff', s = 1){ const c = document.createElement('canvas'), g = c.getContext('2d'), f = 36;
    g.font = `700 ${f}px Archivo, sans-serif`; const w = Math.ceil(g.measureText(t).width) + 24; c.width = w; c.height = f + 20;
    g.font = `700 ${f}px Archivo, sans-serif`; g.textBaseline = 'middle'; g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.65)'; g.strokeText(t, 12, c.height/2); g.fillStyle = color; g.fillText(t, 12, c.height/2);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, sizeAttenuation: false, depthWrite: false, transparent: true}));
    sp.userData.s = [w/c.height*0.034*s, 0.034*s]; sp.scale.set(...sp.userData.s, 1); sp.position.set(x, y, z); sp.center.set(0.5, 0); root.add(sp); labels.push(sp); return sp; }

  // ---------- clouds and city lights ----------
  function cloudTex(){ const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    for (let k = 0; k < 14; k++) { const px = 30 + Math.random()*68, py = 50 + Math.random()*30, r = 18 + Math.random()*26, gr = x.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.beginPath(); x.arc(px, py, r, 0, Math.PI*2); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  function buildClouds(){ const tex = cloudTex(), n = MOBILE ? 160 : 320, pos = new Float32Array(n*3); let s = 7;
    const rnd = () => (s = (s*16807) % 2147483647)/2147483647;
    for (let k = 0; k < n; k++) { pos[k*3] = toX(105.3 + rnd()*9.2); pos[k*3 + 1] = 1400 + rnd()*1600; pos[k*3 + 2] = toZ(-5.9 - rnd()*2.9); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    clouds = new THREE.Points(g, new THREE.PointsMaterial({map: tex, size: 2600, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0.9, fog: true})); root.add(clouds);
    const lp = []; for (const t of A.towns) { const cx = toX(t.lon), cz = toZ(t.lat), m = 70;
      for (let k = 0; k < m; k++) { const a = rnd()*Math.PI*2, r = Math.pow(rnd(), 0.6)*5200, x = cx + Math.cos(a)*r, z = cz + Math.sin(a)*r; lp.push(x, groundAt(x, z).h + 15, z); } }
    for (const p of roadPts) if (p[2].cls === 't' && rnd() < 0.35) lp.push(p[0], groundAt(p[0], p[1]).h + 12, p[1]);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    lights = new THREE.Points(lg, new THREE.PointsMaterial({color: 0xffc670, size: 3, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})); root.add(lights); }

  // ---------- the aircraft ----------
  function buildPlane(type){
    const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({color: 0xf4f5f7, roughness: 0.35, metalness: 0.2}), blue = new THREE.MeshStandardMaterial({color: 0x1d4e9e, roughness: 0.4}),
      red = new THREE.MeshStandardMaterial({color: 0xc8202b, roughness: 0.4}), dark = new THREE.MeshStandardMaterial({color: 0x23272d, roughness: 0.5}), glass = new THREE.MeshStandardMaterial({color: 0x26394d, roughness: 0.05, metalness: 0.6}),
      grey = new THREE.MeshStandardMaterial({color: 0x9aa1a9, roughness: 0.3, metalness: 0.6});
    const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
    const lathe = (pts, m, z0) => { const geo = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 20); const o = add(geo, m, 0, 0, z0, Math.PI/2); return o; };   // lathe axis +y → +z (nose at z0, tail behind it)
    const wingGeo = (span, root, tip, sweep, th) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(span, sweep); s.lineTo(span, sweep + tip); s.lineTo(0, root); s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, {depth: th, bevelEnabled: false}); geo.rotateX(Math.PI/2); geo.translate(0, th/2, 0); return geo; };   // x = span, z = chord (backwards)
    if (type === 'c172') {
      lathe([[0, 0], [0.35, 0.05], [0.55, 0.5], [0.62, 1.4], [0.62, 3.2], [0.45, 5.4], [0.2, 7.4], [0.05, 7.8], [0, 7.8]], white, -1.9);   // nose at z=-1.9, tail at 5.9
      add(new THREE.BoxGeometry(1.08, 0.5, 1.5), glass, 0, 0.62, -0.25);
      add(new THREE.BoxGeometry(1.26, 0.07, 0.5), blue, 0, 0.0, 1.0);
      for (const sd of [-1, 1]) { add(wingGeo(5.5, 1.5, 1.1, 0.2, 0.14), white, 0, 1.0, -0.6, 0, 0, 0).scale.set(sd, 1, 1);
        add(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 6), grey, sd*0.9, 0.2, -0.1, 0, 0, sd*0.55); }
      add(wingGeo(1.7, 0.95, 0.6, 0.25, 0.08), white, 0, 0.18, 4.9).scale.set(1, 1, 1); add(wingGeo(1.7, 0.95, 0.6, 0.25, 0.08), white, 0, 0.18, 4.9).scale.set(-1, 1, 1);
      const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(1.25, 0); fin.lineTo(1.2, 1.5); fin.lineTo(0.55, 1.5); fin.closePath();
      const fg = new THREE.ExtrudeGeometry(fin, {depth: 0.08, bevelEnabled: false}); fg.rotateY(-Math.PI/2); fg.translate(0.04, 0.25, 4.6); const fm = new THREE.Mesh(fg, blue); g.add(fm);
      prop = new THREE.Group(); prop.position.set(0, 0, -2.05); g.add(prop); const bl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.85, 0.04), dark); prop.add(bl);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), new THREE.MeshBasicMaterial({color: 0x222222, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false})); prop.add(disc); prop.userData.disc = disc; prop.userData.blade = bl;
      add(new THREE.SphereGeometry(0.16, 10, 8), red, 0, 0, -2.1);
      for (const [x, z] of [[-1.15, 0.4], [1.15, 0.4], [0, -1.5]]) { add(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12), dark, x, -1.0, z, 0, 0, Math.PI/2); add(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 6), grey, x*0.75, -0.6, z, 0, 0, x*0.4); }
    } else {
      lathe([[0, 0], [0.9, 0.5], [1.55, 1.6], [1.9, 3.6], [1.95, 6], [1.95, 26], [1.75, 30], [1.1, 33.5], [0.4, 35.5], [0, 36]], white, -18);
      add(new THREE.BoxGeometry(3.94, 0.55, 30), blue, 0, -0.85, 3.2);
      for (let k = 0; k < 26; k++) add(new THREE.BoxGeometry(3.96, 0.32, 0.26), glass, 0, 0.55, -11 + k*1.05);
      add(new THREE.BoxGeometry(2.6, 0.5, 1.1), glass, 0, 0.75, -15.6, -0.5);
      for (const sd of [-1, 1]) { add(wingGeo(16.5, 7.4, 1.6, 9, 0.5), white, sd*1.2, -1.2, -3.4).scale.set(sd, 1, 1);
        const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.85, 4.6, 18), grey); eng.rotation.x = Math.PI/2; eng.position.set(sd*5.2, -2.1, -4.6); g.add(eng);
        add(new THREE.CircleGeometry(0.85, 18), dark, sd*5.2, -2.1, -6.92, 0, Math.PI);
        add(new THREE.BoxGeometry(0.35, 1.0, 2.4), grey, sd*5.2, -1.4, -3.6);
        add(wingGeo(6.2, 3.6, 1.2, 3.4, 0.25), white, 0, 1.0, 13.3).scale.set(sd, 1, 1);
        add(new THREE.BoxGeometry(0.06, 0.6, 0.25), red, sd*17.7, -0.95, 5.8); }
      const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(5.8, 0); fin.lineTo(6.6, 7.6); fin.lineTo(4.3, 7.6); fin.closePath();
      const fg = new THREE.ExtrudeGeometry(fin, {depth: 0.35, bevelEnabled: false}); fg.rotateY(-Math.PI/2); fg.translate(0.17, 1.4, 11.5); g.add(new THREE.Mesh(fg, red));
      for (const [x, z] of [[-2.9, 1.5], [2.9, 1.5], [0, -13]]) { for (const dx of [-0.3, 0.3]) add(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14), dark, x + dx, -3.3, z, 0, 0, Math.PI/2); add(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8), grey, x, -2.5, z); }
      prop = null;
    }
    for (const m of [white, blue, red, dark, glass, grey]) m.side = THREE.DoubleSide;     // the mirrored halves (scale -1) turn their faces inside out
    // navigation lights
    const span = type === 'c172' ? 5.5 : 17.8, ly = type === 'c172' ? 1.07 : -0.95, lz = type === 'c172' ? -0.2 : 6;
    for (const [x, c] of [[-span, 0xff2020], [span, 0x20ff40]]) { const l = new THREE.Mesh(new THREE.SphereGeometry(type === 'c172' ? 0.08 : 0.2, 6, 4), new THREE.MeshBasicMaterial({color: c})); l.position.set(x, ly, lz); g.add(l); }
    const bc = new THREE.Mesh(new THREE.SphereGeometry(type === 'c172' ? 0.1 : 0.3, 6, 4), new THREE.MeshBasicMaterial({color: 0xff3030})); bc.position.set(0, type === 'c172' ? 1.8 : 9.2, type === 'c172' ? 5.6 : 17.5); g.add(bc); g.userData.beacon = bc;
    return g; }
  function setPlane(type){ if (planeG) { scene.remove(planeG); planeG.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } st.plane = type; planeG = buildPlane(type); scene.add(planeG); }

  // ---------- scene ----------
  function build(){
    renderer = new THREE.WebGLRenderer({antialias: !MOBILE, logarithmicDepthBuffer: true, powerPreference: 'high-performance'});
    renderer.setPixelRatio(Math.min(MOBILE ? 1.5 : 2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.domElement.id = 'flycv'; ui.prepend(renderer.domElement);
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.5, 1.2e6);
    root = new THREE.Group(); scene.add(root);                       // the world moves, the aircraft stays near the origin (no jitter far from the centre)
    hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5a6b3a, 1.1); scene.add(hemi); sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(0.4, 1, 0.25); scene.add(sun);
    fog = new THREE.Fog(0xbcd6ee, 30000, 260000); scene.fog = fog;
    skyMat = new THREE.ShaderMaterial({side: THREE.BackSide, depthWrite: false, fog: false, uniforms: {top: {value: new THREE.Color(0x3d7fd6)}, hor: {value: new THREE.Color(0xcfe3f5)}, bot: {value: new THREE.Color(0x9fb8c9)}},
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); gl_Position.z = gl_Position.w*0.99999; }',
      fragmentShader: 'uniform vec3 top, hor, bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h*2.2, 0.0, 1.0), 0.6)) : mix(hor, bot, clamp(-h*6.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }'});
    sky = new THREE.Mesh(new THREE.SphereGeometry(5e5, 32, 16), skyMat); sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
    sea = new THREE.Mesh(new THREE.PlaneGeometry(1.4e6, 1.4e6, 112, 112),          // small cells: depth stays exact next to a 3 m coast
      new THREE.MeshLambertMaterial({color: 0x2a6f9e, transparent: true, opacity: 0.93})); sea.rotation.x = -Math.PI/2; sea.position.set(toX(110), 0, toZ(-7.3)); root.add(sea);
    buildTerrain(); buildRoads(); buildAirports(); buildClouds();
    for (const t of A.towns) label(t.name, toX(t.lon), groundAt(toX(t.lon), toZ(t.lat)).h + 60, toZ(t.lat), '#ffffff', 1);
    for (const v of VOL) label('▲ ' + v.name + ` ${v.h} m`, v.x, v.h + 80, v.z, '#e9f2d8', 0.85);
    setPlane(st.plane); built = true;
  }

  // ---------- UI ----------
  const css = document.createElement('style'); css.textContent = `
  #fly{position:fixed;inset:0;z-index:60;background:#9fc3e6;font-family:Archivo,system-ui,sans-serif;color:#fff;user-select:none;-webkit-user-select:none;touch-action:none}
  #fly[hidden]{display:none} #flycv{position:absolute;inset:0;width:100%;height:100%;display:block}
  #fly .hud{position:absolute;inset:0;pointer-events:none} #fly .hud canvas{position:absolute;inset:0;width:100%;height:100%}
  #fly .bx{position:absolute;background:rgba(10,18,28,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:6px 10px;text-shadow:0 1px 2px rgba(0,0,0,.5)}
  #fly .bx small{display:block;font-size:10px;letter-spacing:.08em;opacity:.75;font-weight:700} #fly .bx b{font-size:24px;font-variant-numeric:tabular-nums;font-weight:800;line-height:1.1}
  #fly .spd{left:14px;top:50%;transform:translateY(-50%);min-width:92px} #fly .alt{right:14px;top:50%;transform:translateY(-50%);min-width:110px;text-align:right}
  #fly .alt i{display:block;font-style:normal;font-size:12px;font-weight:700;opacity:.9}
  #fly .loc{left:14px;top:12px;max-width:min(52vw,520px);pointer-events:none} #fly .loc b{font-size:15px;display:block} #fly .loc span{font-size:12px;opacity:.9}
  #fly .thr{left:14px;bottom:16px;width:150px} #fly .thr .bar{height:8px;border-radius:4px;background:rgba(255,255,255,.2);margin-top:4px;overflow:hidden} #fly .thr .bar i{display:block;height:100%;background:linear-gradient(90deg,#4ade80,#facc15,#f97316)}
  #fly .thr span{font-size:11px;font-weight:700;opacity:.9}
  #fly .warn{left:50%;top:22%;transform:translateX(-50%);background:rgba(200,20,30,.85);font-size:18px;font-weight:900;letter-spacing:.12em;display:none;border-color:#fff}
  #fly .msg{left:50%;bottom:22%;transform:translateX(-50%);font-size:14px;font-weight:700;display:none;text-align:center;max-width:80vw}
  #fly .mm{right:14px;bottom:16px;width:min(210px,32vw);height:min(210px,32vw);padding:0;overflow:hidden;border-radius:14px;border:2px solid rgba(255,255,255,.7);pointer-events:auto;cursor:pointer}
  #fly .mm canvas{width:100%;height:100%;display:block}
  #fly .tb{position:absolute;right:12px;top:12px;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:62vw}
  #fly button{font:inherit;font-size:12.5px;font-weight:700;color:#fff;background:rgba(10,18,28,.6);border:1px solid rgba(255,255,255,.3);border-radius:20px;padding:7px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;backdrop-filter:blur(6px)}
  #fly button:hover{background:rgba(30,50,80,.75)} #fly button.pri{background:#1a73e8;border-color:#1a73e8} #fly button svg{width:16px;height:16px}
  #fly .dlg{position:absolute;inset:0;display:grid;place-items:center;background:rgba(5,12,22,.45);z-index:3}
  #fly .dlg[hidden]{display:none}
  #fly .card{width:min(520px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:rgba(14,22,34,.92);border:1px solid rgba(255,255,255,.2);border-radius:18px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
  #fly .card h2{margin:0 0 4px;font-size:22px;display:flex;align-items:center;gap:8px} #fly .card h2 svg{width:24px;height:24px} #fly .card p{margin:0 0 12px;font-size:13px;opacity:.85;line-height:1.45} #fly .card h3{margin:12px 0 6px;font-size:13px;letter-spacing:.06em;opacity:.8}
  #fly .opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
  #fly .opts button{border-radius:12px;justify-content:flex-start;text-align:left;padding:9px 10px;flex-direction:column;align-items:flex-start;gap:1px}
  #fly .opts button small{font-weight:500;opacity:.75;font-size:11px} #fly .opts button.on{background:#1a73e8;border-color:#8ab4f8}
  #fly .go{display:flex;gap:8px;margin-top:14px;justify-content:flex-end;flex-wrap:wrap}
  #fly .keys{font-size:11.5px;opacity:.8;line-height:1.6;margin-top:10px} #fly kbd{background:rgba(255,255,255,.15);border-radius:4px;padding:1px 5px;font:inherit;font-weight:700}
  #fly .stick{position:absolute;left:18px;bottom:110px;width:130px;height:130px;border-radius:50%;background:rgba(10,18,28,.35);border:2px solid rgba(255,255,255,.35);display:none;pointer-events:auto;touch-action:none}
  #fly .stick i{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px;border-radius:50%;background:rgba(255,255,255,.75)}
  #fly .tslide{position:absolute;right:20px;bottom:min(250px,calc(32vw + 40px));width:46px;height:150px;border-radius:23px;background:rgba(10,18,28,.4);border:2px solid rgba(255,255,255,.35);display:none;pointer-events:auto;touch-action:none}
  #fly .tslide i{position:absolute;left:3px;right:3px;height:36px;border-radius:18px;background:#4ade80}
  #fly.touch .stick, #fly.touch .tslide{display:block} #fly.touch .thr{bottom:250px}
  @media (max-width:700px){ #fly .bx b{font-size:19px} #fly .spd{top:40%} #fly .alt{top:40%} #fly .loc{max-width:46vw} #fly .loc b{font-size:13px} }
  `; document.head.appendChild(css);
  const ui = document.createElement('div'); ui.id = 'fly'; ui.hidden = true; ui.innerHTML = `
    <div class="hud"><canvas class="hc"></canvas>
      <div class="bx loc"><b class="l1">—</b><span class="l2"></span></div>
      <div class="bx spd"><small>KECEPATAN</small><b class="v">0</b><small>KNOT · <span class="gs">0</span> km/j</small></div>
      <div class="bx alt"><small>KETINGGIAN</small><b class="h">0</b><small>KAKI · <span class="hm">0</span> m</small><i class="vsi">↕ 0 ft/mnt</i></div>
      <div class="bx thr"><small>GAS <span class="tp">0%</span></small><div class="bar"><i></i></div><span class="st">—</span></div>
      <div class="bx warn">STALL</div><div class="bx msg"></div></div>
    <div class="bx mm" title="Peta"><canvas></canvas></div>
    <div class="stick"><i></i></div><div class="tslide"><i></i></div>
    <div class="tb"><button class="bcam">${A.icon('Video')} Kamera</button><button class="bwarp">${A.icon('FastForward')} 1×</button><button class="bmenu">${A.icon('Plane')} Pesawat &amp; bandara</button><button class="bexit pri">${A.icon('Car')} Kembali menyetir</button></div>
    <div class="dlg"><div class="card">
      <h2>${A.icon('Plane')} Mode Terbang</h2><p>Terbang bebas di atas Pulau Jawa dan Madura. Semua jalan tol (oranye), jalan nasional, provinsi dan jalan akses terlihat dari udara, lengkap dengan kota, gunung dan bandara.</p>
      <h3>PESAWAT</h3><div class="opts pl"></div>
      <h3>MULAI DARI</h3><div class="opts sp"></div>
      <div class="keys"><kbd>↓</kbd>/<kbd>↑</kbd> tarik/dorong (naik/turun) · <kbd>←</kbd>/<kbd>→</kbd> miring (belok) · <kbd>A</kbd>/<kbd>D</kbd> rudder & setir di darat · <kbd>W</kbd>/<kbd>S</kbd> gas · <kbd>B</kbd> rem · <kbd>C</kbd> kamera · <kbd>T</kbd> percepat waktu · <kbd>I</kbd> balik naik/turun<br>Di HP: tuas kiri untuk kemudi, geser kanan untuk gas.</div>
      <label style="display:flex;gap:6px;align-items:center;font-size:12.5px;margin-top:8px"><input type="checkbox" class="inv"> Balik sumbu naik/turun (↑ = naik)</label>
      <div class="go"><button class="bexit2">${A.icon('Car')} Kembali menyetir</button><button class="pri bgo">${A.icon('PlaneTakeoff')} Terbang</button></div></div></div>`;
  document.body.appendChild(ui);
  const q = s => ui.querySelector(s), hc = q('.hc'), mm = q('.mm canvas');
  let pick = {plane: 'c172', start: 'air'};
  function fillDlg(){
    q('.pl').innerHTML = Object.entries(PLANES).map(([k, p]) => `<button data-p="${k}" class="${pick.plane === k ? 'on' : ''}"><b>${p.name}</b><small>${k === 'c172' ? 'Pesawat latih, lambat & mudah' : 'Jet penumpang, cepat'} · maks ${Math.round(p.vmax*KT)} kt</small></button>`).join('');
    q('.sp').innerHTML = `<button data-s="air" class="${pick.start === 'air' ? 'on' : ''}"><b>Di udara</b><small>Di atas posisi kendaraanmu</small></button>` + APT.map(a => `<button data-s="${a.code}" class="${pick.start === a.code ? 'on' : ''}"><b>${a.code} · ${esc(a.name)}</b><small>${esc(a.city)} · landasan ${a.rws.map(r => r.id).join(', ')} · ${Math.round(a.main.len).toLocaleString('id-ID')} m</small></button>`).join('');
    q('.inv').checked = st.invert; }
  ui.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.p) { pick.plane = b.dataset.p; fillDlg(); } else if (b.dataset.s) { pick.start = b.dataset.s; fillDlg(); }
    else if (b.classList.contains('bgo')) { q('.dlg').hidden = true; spawn(pick.start, pick.plane); }
    else if (b.classList.contains('bexit') || b.classList.contains('bexit2')) exit();
    else if (b.classList.contains('bmenu')) { fillDlg(); q('.dlg').hidden = false; }
    else if (b.classList.contains('bcam')) cycleCam();
    else if (b.classList.contains('bwarp')) cycleWarp(); });
  q('.inv').onchange = e => { st.invert = e.target.checked; };
  q('.mm').onclick = () => { mmZ = mmZ > 600 ? 120 : mmZ*2.2; };
  let mmZ = 260;
  const cycleCam = () => { st.cam = st.cam === 'chase' ? 'cockpit' : st.cam === 'cockpit' ? 'side' : 'chase'; flash({chase: 'Kamera belakang', cockpit: 'Kamera kokpit (HUD)', side: 'Kamera samping'}[st.cam]); };
  const cycleWarp = () => { st.warp = st.warp === 1 ? 2 : st.warp === 2 ? 4 : st.warp === 4 ? 8 : 1; q('.bwarp').lastChild.textContent = ` ${st.warp}×`; flash(st.warp === 1 ? 'Waktu normal' : `Waktu dipercepat ${st.warp}×`); };
  const flash = (t, s = 2.6) => { const m = q('.msg'); m.textContent = t; m.style.display = 'block'; st.msgT = s; };

  // keyboard (only while flying; the driving keys are ignored by main.js then)
  addEventListener('keydown', e => { if (!on) return; if (e.target.closest && e.target.closest('input,select,textarea')) return; const k = e.key.toLowerCase(); key[k] = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (e.repeat) return;
    if (k === 'c') cycleCam(); else if (k === 't') cycleWarp(); else if (k === 'i') { st.invert = !st.invert; flash(st.invert ? '↑ = naik' : '↓ = naik (seperti joystick)'); }
    else if (k === 'escape') { if (q('.dlg').hidden) { fillDlg(); q('.dlg').hidden = false; } else if (st.start) q('.dlg').hidden = true; } });
  addEventListener('keyup', e => { key[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in key) key[k] = false; });
  // touch: a stick for pitch and roll, a slider for the throttle
  const stick = {x: 0, y: 0, id: null}, sEl = q('.stick'), sKn = q('.stick i'), tEl = q('.tslide'), tKn = q('.tslide i');
  sEl.onpointerdown = e => { stick.id = e.pointerId; sEl.setPointerCapture(e.pointerId); moveStick(e); };
  sEl.onpointermove = e => { if (stick.id === e.pointerId) moveStick(e); };
  sEl.onpointerup = sEl.onpointercancel = () => { stick.id = null; stick.x = stick.y = 0; sKn.style.transform = ''; };
  function moveStick(e){ const r = sEl.getBoundingClientRect(), dx = (e.clientX - r.left - r.width/2)/(r.width/2), dy = (e.clientY - r.top - r.height/2)/(r.height/2), l = Math.max(1, Math.hypot(dx, dy));
    stick.x = dx/l; stick.y = dy/l; sKn.style.transform = `translate(${stick.x*38}px,${stick.y*38}px)`; }
  const tMove = e => { const r = tEl.getBoundingClientRect(); st.thr = clamp(1 - (e.clientY - r.top - 18)/(r.height - 36), 0, 1); };
  tEl.onpointerdown = e => { tEl.setPointerCapture(e.pointerId); tMove(e); tEl.onpointermove = tMove; };
  tEl.onpointerup = tEl.onpointercancel = () => { tEl.onpointermove = null; };
  addEventListener('pointerdown', e => { if (on && e.pointerType === 'touch') ui.classList.add('touch'); });
  addEventListener('resize', () => { if (!built) return; renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); });

  // ---------- start, crash, exit ----------
  function spawn(where, type){
    if (type && type !== st.plane) setPlane(type);
    const P = PLANES[st.plane]; st.start = where; st.crashed = false; if (camera) camera.userData.init = false; st.sink = 0; st.roll = 0;
    if (where === 'air') { const h = A.here(); st.x = toX(h.lon); st.z = toZ(h.lat); st.hd = h.hd; const gh = groundAt(st.x, st.z).h; st.y = gh + (st.plane === 'c172' ? 600 : 1500); st.v = P.vs*(st.plane === 'c172' ? 1.9 : 2.6); st.pitch = 0; st.thr = 0.72; st.ground = false; }
    else { const a = APT.find(o => o.code === where), r = a.main; st.hd = r.hd; st.x = r.ax + r.ux*70; st.z = r.az + r.uz*70; st.y = a.elev + 0.4 + P.gear; st.v = 0; st.pitch = 0; st.thr = 0; st.ground = true;
      flash(`Siap lepas landas di ${a.code} ${a.name}, landasan ${r.id.split('/')[0]} (${Math.round(r.len).toLocaleString('id-ID')} m). Gas penuh (W), lalu tarik (↓) di ${Math.round(P.vr*KT)} kt.`, 6); }
    A.sfx && A.sfx('ok');
  }
  function crash(why){ if (st.crashed) return; st.crashed = true; st.v = 0; st.thr = 0; flash(`${why}. Tekan Kamera atau tunggu, pesawat diulang…`, 3.2); A.sfx && A.sfx('err'); setTimeout(() => { if (on && st.crashed) spawn(st.start || 'air'); }, 3200); }
  function enter(){ if (on) return; if (!built) { const m = document.createElement('div'); m.textContent = 'Menyiapkan peta Jawa & Madura…'; m.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;z-index:70;background:rgba(10,18,28,.8);color:#fff;font:700 18px Archivo,sans-serif'; document.body.appendChild(m);
      return setTimeout(() => { try { build(); } catch (err) { m.remove(); console.error(err); A.toast('Mode Terbang gagal dimuat', 'warn'); return; } m.remove(); enter(); }, 50); }
    on = true; ui.hidden = false; A.onEnter && A.onEnter(); fillDlg(); q('.dlg').hidden = false; if (!st.start) spawn('air', pick.plane); last = performance.now(); renderer.setAnimationLoop(frame); audio(true); }
  function exit(){ if (!on) return; on = false; ui.hidden = true; renderer.setAnimationLoop(null); audio(false); A.onExit && A.onExit(); }

  // ---------- sound: engine and wind ----------
  let AC = null, eng = null;
  function audio(go){ try { if (!go) { if (eng) eng.g.gain.setTargetAtTime(0, AC.currentTime, 0.1); return; } if (!A.soundOn()) return;
      if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), o2 = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain();
        o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g); g.connect(AC.destination); o.start(); o2.start();
        const nb = AC.createBuffer(1, AC.sampleRate*2, AC.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;
        const ns = AC.createBufferSource(); ns.buffer = nb; ns.loop = true; const nf = AC.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; const ng = AC.createGain(); ng.gain.value = 0; ns.connect(nf); nf.connect(ng); ng.connect(AC.destination); ns.start();
        eng = {o, o2, f, g, ng, nf}; }
      AC.resume(); } catch (e) { eng = null; } }
  function sound(){ if (!eng || !AC) return; const t = AC.currentTime, P = PLANES[st.plane], r = st.crashed ? 0 : st.thr;
    if (st.plane === 'c172') { eng.o.frequency.setTargetAtTime(38 + r*52, t, 0.2); eng.o2.frequency.setTargetAtTime(76 + r*104, t, 0.2); eng.f.frequency.setTargetAtTime(380 + r*700, t, 0.2); eng.g.gain.setTargetAtTime(st.crashed ? 0 : 0.035 + r*0.05, t, 0.2); }
    else { eng.o.frequency.setTargetAtTime(90 + r*160, t, 0.4); eng.o2.frequency.setTargetAtTime(1800 + r*2600, t, 0.4); eng.f.frequency.setTargetAtTime(900 + r*2600, t, 0.4); eng.g.gain.setTargetAtTime(st.crashed ? 0 : 0.02 + r*0.035, t, 0.3); }
    eng.ng.gain.setTargetAtTime(st.crashed ? 0 : clamp(st.v/P.vmax, 0, 1)*0.05, t, 0.3); eng.nf.frequency.setTargetAtTime(500 + st.v*8, t, 0.3); }

  // ---------- flight model ----------
  function physics(dt){
    if (st.crashed) return; const P = PLANES[st.plane];
    const inv = st.invert ? -1 : 1, kb = (a, b) => (key[a] ? 1 : 0) - (key[b] ? 1 : 0);
    const pitchIn = clamp((kb('arrowdown', 'arrowup') + stick.y)*inv, -1, 1);   // + = nose up: pull back (↓, stick towards you)
    const rollIn = clamp(kb('arrowright', 'arrowleft') + stick.x, -1, 1), yawIn = kb('d', 'a');
    if (key.w || key.shift) st.thr = Math.min(1, st.thr + dt*0.6); if (key.s || key.control) st.thr = Math.max(0, st.thr - dt*0.6);
    st.brake = !!(key.b || key[' ']);
    const eff = clamp(st.v/P.vs, 0.15, 1.3), L = clamp((st.v/P.vs)**2, 0, 1.6);
    // speed: thrust, drag, the slope of the path; rolling friction and brakes on the ground
    const Dk = P.acc/(P.vmax*P.vmax); let dv = st.thr*P.acc - Dk*st.v*st.v - G*Math.sin(st.pitch);
    if (st.ground) dv -= (0.15 + (st.brake ? 3.2 : 0))*(st.v > 0.2 ? 1 : 0);
    st.v = Math.max(0, st.v + dv*dt);
    if (st.ground) {
      const gr = groundAt(st.x, st.z); st.roll *= Math.exp(-6*dt);
      st.hd += yawIn*0.45*clamp(st.v/6, 0, 1)*(1 - clamp(st.v/(P.vr*1.2), 0, 0.8))*dt + rollIn*0.15*clamp(st.v/6, 0, 1)*dt;
      if (pitchIn > 0 && st.v > P.vr*0.92) st.pitch = Math.min(st.pitch + P.pitch*0.5*D2R*dt*pitchIn, 12*D2R); else st.pitch = Math.max(0, st.pitch - 4*D2R*dt);
      st.y = gr.h + P.gear + 0.4;
      if (st.pitch > 4*D2R && st.v > P.vs*1.02) { st.ground = false; st.y += 0.5; flash('Lepas landas! Naikkan ketinggian, lalu atur gas.'); }
      if (gr.sea) crash('Pesawat masuk ke laut');
      const nx = st.x + Math.sin(st.hd)*st.v*dt, nz = st.z - Math.cos(st.hd)*st.v*dt, g2 = groundAt(nx, nz);
      if (st.v > 25 && Math.abs(g2.h - gr.h) > st.v*dt*0.35 && !nearApt(st.x, st.z)) crash('Pesawat menabrak medan');
      st.x = nx; st.z = nz; st.vs = 0; return;
    }
    // in the air: controls work with the airflow, a stall drops the nose
    st.pitch += pitchIn*P.pitch*D2R*eff*dt; if (!pitchIn) st.pitch -= st.pitch*Math.min(1, 0.45*dt*Math.min(1, L));   // hands off: the aircraft settles back towards level flight
    st.roll += rollIn*P.roll*D2R*eff*dt; if (!rollIn) st.roll *= Math.exp(-0.35*dt);
    st.roll = clamp(st.roll, -80*D2R, 80*D2R); st.pitch = clamp(st.pitch, -60*D2R, 60*D2R);
    const stall = st.v < P.vs*0.98; st.stallT = stall ? st.stallT + dt : 0;
    if (stall) { st.pitch -= (1 - L)*28*D2R*dt + 4*D2R*dt; st.roll += Math.sin(performance.now()*0.003)*12*D2R*dt*(1 - L); }
    // in a bank the lift turns the aircraft (and costs a little height)
    st.hd += (G*Math.tan(st.roll)/Math.max(st.v, 15))*Math.min(1, L)*dt + yawIn*5*D2R*dt;
    st.pitch -= (1/Math.cos(st.roll) - 1)*0.04*dt*Math.max(0, 1 - pitchIn);
    const want = (1 - Math.min(1, L))*30; st.sink += (want - st.sink)*Math.min(1, 1.6*dt);
    const vh = st.v*Math.cos(st.pitch); st.vs = st.v*Math.sin(st.pitch) - st.sink;
    st.x += Math.sin(st.hd)*vh*dt; st.z -= Math.cos(st.hd)*vh*dt; st.y += st.vs*dt;
    if (st.y > 13700) { st.y = 13700; st.pitch = Math.min(st.pitch, 0); }
    // touching the ground: a landing, or not
    const gr = groundAt(st.x, st.z);
    if (st.y - P.gear <= gr.h + 0.4) {
      if (gr.sea) return crash('Pesawat jatuh ke laut');
      const fpm = st.vs*FT*60, apt = nearApt(st.x, st.z);
      if (st.vs > -4.6 && st.pitch > -4*D2R && Math.abs(st.roll) < 14*D2R) { st.ground = true; st.sink = 0; st.y = gr.h + P.gear + 0.4; st.pitch = Math.max(0, st.pitch);
        flash(apt ? `Mendarat di ${apt.code} · ${Math.round(fpm)} ft/mnt ${fpm > -250 ? '— mulus sekali!' : fpm > -500 ? '— bagus' : '— agak keras'}` : `Mendarat darurat di luar bandara (${Math.round(fpm)} ft/mnt)`, 4); A.sfx && A.sfx('ok'); }
      else crash(Math.abs(st.roll) >= 14*D2R ? 'Sayap menghantam tanah' : 'Pesawat jatuh (turun terlalu cepat)'); }
  }
  const nearApt = (x, z) => APT.find(a => Math.hypot(a.x - x, a.z - z) < a.r);

  // ---------- camera, sky, HUD ----------
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpV = new THREE.Vector3(), eul = new THREE.Euler(0, 0, 0, 'YXZ'), quat = new THREE.Quaternion();
  function place(dt){
    const P = PLANES[st.plane];
    root.position.set(-st.x, -st.y, -st.z);                      // floating origin: the aircraft is at (0,0,0)
    eul.set(st.pitch, -st.hd, -st.roll); planeG.quaternion.setFromEuler(eul); planeG.position.set(0, 0, 0); planeG.visible = st.cam !== 'cockpit';
    if (prop) { const r = st.crashed ? 0 : 20 + st.thr*80; prop.rotation.z += r*dt; prop.userData.blade.visible = r < 35; prop.userData.disc.material.opacity = clamp((r - 30)/50, 0, 0.18); }
    planeG.userData.beacon.visible = (performance.now() % 1200) < 120;
    if (st.cam === 'cockpit') { const e = P.eye; tmpV.set(e[0], e[1], e[2]).applyQuaternion(planeG.quaternion); camera.position.copy(tmpV); camera.quaternion.copy(planeG.quaternion); camera.fov = 68; }
    else { const side = st.cam === 'side', d = P.camD*(side ? 1.6 : 1), yaw = st.hd + (side ? Math.PI/2.3 : 0), pz = side ? 0 : st.pitch*0.6;
      camPos.set(-Math.sin(yaw)*Math.cos(pz)*d, (side ? P.camH*0.5 : P.camH) + Math.sin(-pz)*d*0.6*(side ? 0 : 1), Math.cos(yaw)*Math.cos(pz)*d);
      if (!camera.userData.init) { camera.position.copy(camPos); camera.userData.init = true; } else camera.position.lerp(camPos, 1 - Math.exp(-(side ? 3 : 5)*dt));
      const g = groundAt(st.x + camera.position.x, st.z + camera.position.z).h - st.y + 2; if (camera.position.y < g) camera.position.y = g;
      if (side) camLook.set(0, 0, 0); else camLook.set(Math.sin(st.hd)*P.camD*0.4, P.camH*0.25, -Math.cos(st.hd)*P.camD*0.4); camera.up.set(0, 1, 0); camera.lookAt(camLook); camera.fov = 60; }
    camera.updateProjectionMatrix(); sky.position.copy(camera.position);
    // the horizon grows with height; line widths and labels with the view
    const agl = Math.max(0, st.y - groundAt(st.x, st.z).h); fog.near = 15000 + agl*12; fog.far = clamp(90000 + agl*90, 90000, 520000);
    const w = clamp(1.4 + 900/Math.max(80, agl)*0.6, 1.4, 6); roadsT.material.linewidth = w*1.35; roads[0].material.linewidth = w; roads[1].material.linewidth = w*0.75; roads[2].material.linewidth = w*0.55;
    for (const l of [...roads, roadsT]) l.material.resolution.set(innerWidth, innerHeight);
    roads[2].visible = agl < 3500; roads[1].visible = agl < 9000;
    for (const sp of labels) { const dx = sp.position.x - st.x, dz = sp.position.z - st.z, d = Math.hypot(dx, dz); sp.visible = d < clamp(25000 + agl*25, 25000, 160000) && d > 300; }
    sea.position.set(st.x, 0, st.z);
    for (const a of APT) a.G.visible = Math.hypot(a.x - st.x, a.z - st.z) < (a.big ? 70000 : 35000) + agl*8;
  }
  function timeOfDay(){ const h = A.hour(), day = sstep(5.3, 7, h)*(1 - sstep(17.6, 19, h)), dusk = Math.max(0, 1 - Math.abs(h - 18.1)/1.1) + Math.max(0, 1 - Math.abs(h - 5.9)/0.9);
    const top = new THREE.Color(0x0b1430).lerp(new THREE.Color(0x3d7fd6), day), hor = new THREE.Color(0x1a2440).lerp(new THREE.Color(0xcfe3f5), day).lerp(new THREE.Color(0xf2a35e), clamp(dusk, 0, 1)*0.75);
    skyMat.uniforms.top.value.copy(top); skyMat.uniforms.hor.value.copy(hor); skyMat.uniforms.bot.value.copy(hor).multiplyScalar(0.8); fog.color.copy(hor);
    hemi.intensity = 0.25 + day*0.9; sun.intensity = 0.15 + day*2.1; sun.color.set(dusk > 0.3 ? 0xffc28a : 0xffffff);
    const a = (h - 6)/12*Math.PI; sun.position.set(Math.cos(a), Math.max(0.15, Math.sin(a)), 0.25);
    lights.material.opacity = 1 - day; lights.visible = day < 0.95; for (const a of APT) { a.lights.visible = day < 0.75; a.lights.material.opacity = 1 - day; } clouds.material.color.set(day > 0.5 ? 0xffffff : dusk > 0.3 ? 0xffd2b0 : 0x5a6275); }
  let hudT = 0;
  function hud(dt){
    const P = PLANES[st.plane], agl = st.y - groundAt(st.x, st.z).h - (st.ground ? P.gear + 0.4 : P.gear);
    q('.v').textContent = Math.round(st.v*KT); q('.gs').textContent = Math.round(st.v*3.6);
    q('.h').textContent = Math.round(st.y*FT).toLocaleString('id-ID'); q('.hm').textContent = Math.round(st.y).toLocaleString('id-ID');
    q('.vsi').textContent = `${st.vs >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(st.vs*FT*60/10)*10)} ft/mnt · AGL ${Math.max(0, Math.round(agl*FT)).toLocaleString('id-ID')} ft`;
    q('.tp').textContent = Math.round(st.thr*100) + '%'; q('.thr .bar i').style.width = st.thr*100 + '%'; tKn.style.top = (1 - st.thr)*(150 - 40) + 'px';
    q('.st').textContent = st.crashed ? 'Jatuh' : st.ground ? (st.v < 1 ? 'Diam di darat' : st.brake ? 'Mengerem' : 'Meluncur di darat') : `Terbang · ${P.name}`;
    const w = q('.warn'); w.style.display = !st.ground && !st.crashed && (st.stallT > 0.2 || (st.v < P.vs*1.08 && st.y > 50)) ? 'block' : !st.ground && !st.crashed && agl < 150 && st.vs < -9 ? 'block' : 'none';
    w.textContent = st.v < P.vs*1.08 ? 'STALL' : 'PULL UP';
    if (st.msgT > 0 && (st.msgT -= dt) <= 0) q('.msg').style.display = 'none';
    if ((hudT -= dt) <= 0) { hudT = 0.25; const lat = toLat(st.z), lon = toLon(st.x), r = roadBelow(st.x, st.z), t = townNear(st.x, st.z);
      q('.l1').textContent = r ? `Di bawah: ${r.name}` : t && t.d < 9000 ? `Di atas ${t.t.name}` : groundAt(st.x, st.z).sea ? 'Di atas laut' : 'Di atas Pulau Jawa';
      q('.l2').textContent = `${t ? `${(t.d/1000).toFixed(t.d < 10000 ? 1 : 0).replace('.', ',')} km dari ${t.t.name} · ` : ''}${Math.abs(lat).toFixed(3)}° LS, ${lon.toFixed(3)}° BT · arah ${String(Math.round((st.hd*R2D % 360 + 360) % 360)).padStart(3, '0')}°`;
      A.gmap(mm, {lat, lon, z: mmZ, me: {lat, lon, hd: st.hd, plane: true}, noRoute: true}); }
    drawHud();
  }
  // heading tape, and in the cockpit a head-up display with the horizon and pitch ladder
  function drawHud(){ const dpr = Math.min(2, devicePixelRatio), W = innerWidth, H = innerHeight; if (hc.width !== Math.round(W*dpr)) { hc.width = Math.round(W*dpr); hc.height = Math.round(H*dpr); }
    const x = hc.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    const hdg = (st.hd*R2D % 360 + 360) % 360, cx = W/2, tw = Math.min(420, W*0.6), y0 = W < 700 ? 58 : 16;
    x.fillStyle = 'rgba(10,18,28,.5)'; x.fillRect(cx - tw/2, y0, tw, 34); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 1.5; x.font = '700 12px Archivo, sans-serif'; x.textAlign = 'center';
    for (let d = -60; d <= 60; d += 5) { const a = Math.round(hdg/5)*5 + d, px = cx + (a - hdg)*tw/120; if (px < cx - tw/2 + 6 || px > cx + tw/2 - 6) continue; const aa = (a % 360 + 360) % 360;
      x.beginPath(); x.moveTo(px, y0 + 34); x.lineTo(px, y0 + (aa % 10 ? 28 : 24)); x.stroke();
      if (aa % 30 === 0) x.fillText({0: 'U', 90: 'T', 180: 'S', 270: 'B'}[aa] || String(aa/10).padStart(2, '0'), px, y0 + 15); }
    x.fillStyle = '#ffd400'; x.beginPath(); x.moveTo(cx - 7, y0 + 34); x.lineTo(cx + 7, y0 + 34); x.lineTo(cx, y0 + 26); x.fill();
    if (st.cam !== 'cockpit') return;
    x.save(); x.translate(cx, H/2); x.rotate(st.roll); const ppd = H/68; x.strokeStyle = '#7dff9a'; x.fillStyle = '#7dff9a'; x.lineWidth = 2; x.font = '700 12px Archivo, sans-serif';
    for (let p = -30; p <= 30; p += 5) { const py = (st.pitch*R2D - p)*ppd, w = p === 0 ? W*0.7 : 70; if (Math.abs(py) > H*0.36) continue;
      x.setLineDash(p < 0 ? [8, 6] : []); x.beginPath(); x.moveTo(-w/2, py); x.lineTo(-24, py); x.moveTo(24, py); x.lineTo(w/2, py); x.stroke(); if (p) { x.fillText(Math.abs(p), -w/2 - 14, py + 4); x.fillText(Math.abs(p), w/2 + 14, py + 4); } }
    x.restore(); x.setLineDash([]); x.strokeStyle = '#7dff9a'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(cx - 40, H/2); x.lineTo(cx - 14, H/2); x.lineTo(cx - 7, H/2 + 7); x.lineTo(cx, H/2); x.lineTo(cx + 7, H/2 + 7); x.lineTo(cx + 14, H/2); x.lineTo(cx + 40, H/2); x.stroke();
  }
  let last = 0;
  function frame(now){ const raw = Math.min(0.1, (now - last)/1000 || 0.016); last = now; const dt = Math.min(raw, 0.05);
    const n = st.warp, sub = Math.ceil(n*dt/0.02); if (q('.dlg').hidden) for (let i = 0; i < sub; i++) physics(dt*n/sub);
    place(dt); timeOfDay(); hud(dt); sound();
    renderer.render(scene, camera); }

  return {dbg: () => ({sea, terrain, root, camera, scene}), enter, exit, get on(){ return on; }, st, spawn, groundAt: (lat, lon) => built ? groundAt(toX(lon), toZ(lat)) : null, airports: APT, step: (n, dt = 1/30) => { for (let i = 0; i < n; i++) physics(dt); place(dt); timeOfDay(); hud(dt); renderer.render(scene, camera); }, key};
}
