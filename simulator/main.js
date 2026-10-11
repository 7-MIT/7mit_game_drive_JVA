// Simulator Tol Trans-Jawa — mengemudi di jaringan tol Pulau Jawa (lajur kiri).
// Dunia 3D dibangun di sepanjang rute yang dipilih: koordinat u = meter sepanjang rute.
// Kamera memakai floating origin: z dunia = camU - u, sehingga mobil pemain selalu di dekat z = 0.
// Sisi sd = +1 adalah arah perjalanan pemain (bergerak ke -z, x < 0), sd = -1 adalah jalur arah berlawanan.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {CORR, CORRIDORS, NODES, placeList, buildTrip, findRoute, tripFromLegs, walkFree, choicesAt, edgesFrom, turnDeg, fmtKm, nodeLabel, JAVA} from './network.js';

const MOBILE = matchMedia('(pointer:coarse)').matches || innerWidth < 700;
const LW = 3.6, MED = 1.2, CH = 120, OPEN_HW = 35, OVH = 7.5, PRC = 328, BACK = 460, FWD = 720;
const DEF = {mode:'mix', cam:'chase', den:1, tod:'day', lanes:'auto', closed:{'1':[1], '-1':[]}, cf:0, cfk:2, ovl:2, scale:5, veh:'car',
  from:'Bekasi Barat', to:'Pasteur', auto:false, trip:'route'};
let cfg; try { cfg = {...DEF, ...JSON.parse(localStorage.getItem('tj_cfg1') || '{}')}; } catch(e) { cfg = {...DEF}; }
const saveCfg = () => { try { localStorage.setItem('tj_cfg1', JSON.stringify(cfg)); } catch(e) {} };
const mod = (a, n) => ((a % n) + n) % n;
const rnd = (a, b) => a + Math.random()*(b - a);
const pick = a => a[Math.floor(Math.random()*a.length)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const KMH = v => Math.round(v*3.6);
let camU = 0, signI = 0.12, lampI = 0, clock = 0;

// lane 0 = fast lane next to the median; negative lanes = contraflow lanes on the opposite carriageway
function posX(side, lx){ const c = MED + LW/2;
  if (lx >= 0) return side*(c + lx*LW);
  if (lx >= -1) return side*c*(1 + 2*lx);
  return -side*(c + (-lx-1)*LW); }

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({antialias:!MOBILE, preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('stage').prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb9c8d3, 120, 420);
scene.background = new THREE.Color(0xb9c8d3);
const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.3, 1600);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI*0.48; controls.enabled = false;

const hemi = new THREE.HemisphereLight(0xdfeaf5, 0x55603a, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.castShadow = true; const smz = MOBILE ? 1024 : 2048; sun.shadow.mapSize.set(smz, smz);
Object.assign(sun.shadow.camera, {left:-90,right:90,top:90,bottom:-90,near:1,far:400});
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.2, 0.5, 0.9);
composer.addPass(bloom); composer.addPass(new OutputPass());

// ---------- gentle curves: vertex-shader bend, straight at the camera ----------
const CU = {uW:{value:0}, uCz:{value:0}, uB0:{value:0}, uB1:{value:0}};
const gC = u => 45*Math.sin(u/450) + 20*Math.sin(u/200+1.3);
const gD = u => 45/450*Math.cos(u/450) + 20/200*Math.cos(u/200+1.3);
const BEND_HEAD = 'uniform float uW; uniform float uCz; uniform float uB0; uniform float uB1;\nfloat bendX(float z){ return 45.0*sin((uW - z)/450.0) + 20.0*sin((uW - z)/200.0 + 1.3) - uB0 - uB1*(z - uCz); }\n';
const BEND_CHUNK = THREE.ShaderChunk.project_vertex.replace('mvPosition = modelViewMatrix * mvPosition;',
  'vec4 bwp = modelMatrix * mvPosition; bwp.x += bendX(bwp.z); mvPosition = viewMatrix * bwp;');
const WORLD_CHUNK = '#include <worldpos_vertex>\n#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0\nworldPosition.x += bendX(worldPosition.z);\n#endif';
function patchMat(m){ if (!m || m.userData.bent) return; m.userData.bent = true;
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, CU);
    sh.vertexShader = BEND_HEAD + sh.vertexShader.replace('#include <project_vertex>', BEND_CHUNK).replace('#include <worldpos_vertex>', WORLD_CHUNK); };
  m.needsUpdate = true; }
const depthMat = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking}); patchMat(depthMat);
const bendAt = z => gC(camU - z) - CU.uB0.value - CU.uB1.value*(z - CU.uCz.value);
function bendObj(g){ g.traverse(o => { if (!o.isMesh) return; o.frustumCulled = false; (Array.isArray(o.material) ? o.material : [o.material]).forEach(patchMat); if (o.castShadow) o.customDepthMaterial = depthMat; }); }
function updateBend(){ const cz = camera.position.z; CU.uW.value = camU; CU.uCz.value = cz; CU.uB0.value = gC(camU - cz); CU.uB1.value = -gD(camU - cz); }

// ---------- materials & primitives ----------
const M = (c, o={}) => new THREE.MeshStandardMaterial({color:c, roughness:0.9, ...o});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), M(0x6f8a4a));
ground.rotation.x = -Math.PI/2; ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);

const asphalt = M(0x3b3d40, {roughness:0.95});
const concrete = M(0xa9a59c);
const white = new THREE.MeshBasicMaterial({color:0xe9e7df});
const yellowLine = new THREE.MeshBasicMaterial({color:0xe8c21a});
const railMat = M(0x9aa1a6, {metalness:0.6, roughness:0.4, side:THREE.DoubleSide});
const lampMat = M(0x8c9196, {metalness:0.5, roughness:0.5});
const lampHeadMat = new THREE.MeshStandardMaterial({color:0x222222, emissive:0xffc98a, emissiveIntensity:0});
const signBackMat = M(0x8f969b, {metalness:0.4, roughness:0.5});
const grassBank = M(0x7d8a55);
const vergeMat = M(0x8b8a7c), medianMat = M(0x55574f), barMat = M(0xb8b4aa), prVerge = M(0x9a8d6e);
const asphaltDS = asphalt.clone(); asphaltDS.side = THREE.DoubleSide;
const whiteDS = white.clone(); whiteDS.side = THREE.DoubleSide;
const lotMat = M(0x46484b, {side: THREE.DoubleSide});
const fasciaMat = M(0xa9a59c, {side: THREE.DoubleSide});
const tm = new THREE.Matrix4();

const segs = d => d > 40 ? Math.ceil(d/6) : 1;
function flat(w, d, mat, x, y, z){ const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, segs(d)), mat); m.rotation.x = -Math.PI/2; m.position.set(x,y,z); m.receiveShadow = true; return m; }
function solid(w,h,d,mat,x,y,z){ const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d,1,1,segs(d)), mat); m.position.set(x,y,z); m.castShadow = m.receiveShadow = true; return m; }
function dispose(g){ g.traverse(o => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); if (o.material && o.material.map && !o.material.map.userData.keep) o.material.map.dispose(); if (o.material && o.material.userData.own) o.material.dispose(); }); if (g.parent) g.parent.remove(g); }
function instanced(geo, mat, pts, y=0){ const m = new THREE.InstancedMesh(geo, mat, Math.max(1, pts.length)); m.count = pts.length;
  pts.forEach(([x,z], i) => { tm.makeTranslation(x, y, z); m.setMatrixAt(i, tm); }); return m; }
// strip along u (chunk-local z = -(u - u0)); fa/fb give world x at u
function strip(us, fa, fb, y, mat, Z){
  const pos = [], nor = [], idx = [], up = fb(us[0]) - fa(us[0]) > 0;
  us.forEach((u, i) => { pos.push(fa(u), y, Z(u), fb(u), y, Z(u)); nor.push(0,1,0, 0,1,0);
    if (i) { const j = (i-1)*2; if (up) idx.push(j, j+1, j+2, j+1, j+3, j+2); else idx.push(j, j+2, j+1, j+1, j+2, j+3); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m; }
function wall(us, fx, y0, y1, mat, Z){
  const pos = [], idx = [];
  us.forEach((u, i) => { pos.push(fx(u), y0, Z(u), fx(u), y1, Z(u)); if (i) { const j = (i-1)*2; idx.push(j, j+1, j+2, j+1, j+3, j+2); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; return m; }
const cut = ([a,b], gaps) => { let s = [[a,b]]; for (const [g0,g1] of gaps) s = s.flatMap(([x,y]) => g1 <= x || g0 >= y ? [[x,y]] : [[x,g0],[g1,y]].filter(([p,q]) => q-p > 0.5)); return s; };
function rng(seed){ let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- traffic signs (rambu) ----------
const MATC = new Map();
function signMat(key, w, h, draw, px=256){ if (!MATC.has(key)) { const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px*h/w);
  draw(c.getContext('2d'), c.width, c.height); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.keep = true;
  const m = new THREE.MeshStandardMaterial({map:t, emissive:0xffffff, emissiveMap:t, emissiveIntensity:signI, roughness:0.6}); m.userData.sign = true; patchMat(m); MATC.set(key, m); } return MATC.get(key); }
function fit(x, text, maxW, size, weight=700){ let s = size; do { x.font = `${weight} ${s}px Archivo, sans-serif`; s -= 4; } while (x.measureText(text).width > maxW && s > 20); }
const drawSpeed = (n, min) => (x, w) => { const r = w/2; x.beginPath(); x.arc(r,r,r-2,0,Math.PI*2); x.fillStyle = min ? '#1d4fa3' : '#fff'; x.fill();
  x.lineWidth = min ? 6 : w*0.11; x.strokeStyle = min ? '#fff' : '#d0202a'; x.beginPath(); x.arc(r,r, min ? r-12 : r-2-w*0.055, 0, Math.PI*2); x.stroke();
  x.fillStyle = min ? '#fff' : '#111'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 ${n >= 100 ? w*0.36 : w*0.44}px Archivo, sans-serif`; x.fillText(String(n), r, r + w*0.02); };
const drawNoU = (x, w) => { const r = w/2; x.beginPath(); x.arc(r,r,r-2,0,Math.PI*2); x.fillStyle = '#fff'; x.fill();
  x.lineWidth = w*0.07; x.strokeStyle = '#111'; x.beginPath(); x.moveTo(r+w*0.12, r+w*0.24); x.lineTo(r+w*0.12, r-w*0.02); x.arc(r, r-w*0.02, w*0.12, 0, Math.PI, true); x.lineTo(r-w*0.12, r+w*0.1); x.stroke();
  x.fillStyle = '#111'; x.beginPath(); x.moveTo(r-w*0.21, r+w*0.08); x.lineTo(r-w*0.03, r+w*0.08); x.lineTo(r-w*0.12, r+w*0.24); x.closePath(); x.fill();
  x.lineWidth = w*0.11; x.strokeStyle = '#d0202a'; x.beginPath(); x.arc(r,r,r-2-w*0.055,0,Math.PI*2); x.stroke();
  x.lineWidth = w*0.08; x.beginPath(); x.moveTo(r - r*0.62, r - r*0.62); x.lineTo(r + r*0.62, r + r*0.62); x.stroke(); };
const drawPlate = (lines, bg, fg) => (x, w, h) => { x.fillStyle = bg; x.fillRect(0,0,w,h); x.strokeStyle = fg; x.lineWidth = 8; x.strokeRect(10,10,w-20,h-20);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; const lh = (h-30)/lines.length;
  lines.forEach((t, i) => { fit(x, t, w-50, lh*0.8, 700); x.fillText(t, w/2, 15 + lh*(i+0.5)); }); };
const SP = n => ({d:0.9, m: signMat('sp'+n, 1, 1, drawSpeed(n, false))});
const MN = n => ({d:0.75, m: signMat('mn'+n, 1, 1, drawSpeed(n, true))});
const NU = () => ({d:0.9, m: signMat('nu', 1, 1, drawNoU)});
const PL = (lines, bg='#fff', fg='#111', w=1.4, h=0.55) => ({w, h, m: signMat('pl'+lines.join('|')+bg+w+h, w, h, drawPlate(lines, bg, fg), 512)});
const discGeo = new THREE.CircleGeometry(0.5, 32); discGeo.userData.keep = true;
const backDiscGeo = discGeo.clone(); backDiscGeo.rotateY(Math.PI); backDiscGeo.translate(0, 0, -0.02); backDiscGeo.userData.keep = true;
const postGeoS = new THREE.BoxGeometry(0.09, 1, 0.09); postGeoS.translate(0, 0.5, 0); postGeoS.userData.keep = true;
const PGC = new Map(); const pgeo = (w,h) => { const k = w+'|'+h; if (!PGC.has(k)) { const g = new THREE.PlaneGeometry(w,h); g.userData.keep = true; PGC.set(k, g); } return PGC.get(k); };
function signPost(parent, x, z, rot, items, y0=0, sc=1){
  const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = rot; g.scale.setScalar(sc);
  let y = 1.9; const placed = [];
  for (let i = items.length-1; i >= 0; i--) { const h = items[i].d || items[i].h; placed.push([items[i], y + h/2]); y += h + 0.08; }
  const post = new THREE.Mesh(postGeoS, signBackMat); post.scale.y = y - 0.08; post.position.z = -0.07; post.castShadow = true; g.add(post);
  for (const [it, cy] of placed) {
    if (it.d) { const f = new THREE.Mesh(discGeo, it.m), b = new THREE.Mesh(backDiscGeo, signBackMat); f.scale.setScalar(it.d); b.scale.setScalar(it.d); f.position.y = b.position.y = cy; g.add(f, b); }
    else { const f = new THREE.Mesh(pgeo(it.w, it.h), it.m), b = new THREE.Mesh(pgeo(it.w, it.h), signBackMat); f.position.y = cy; b.rotation.y = Math.PI; b.position.set(0, cy, -0.02); g.add(f, b); }
  }
  parent.add(g); return g;
}

// ---------- green guide signs ----------
const SIGN_GREEN = '#0c6a3c', SIGN_BLUE = '#0d3b7a';
function canvasTex(w, h, draw){
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024*h/w);
  const x = c.getContext('2d'); draw(x, c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function base(x, w, h, col=SIGN_GREEN){ x.fillStyle = col; x.fillRect(0,0,w,h); x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); x.roundRect(14,14,w-28,h-28,22); x.stroke(); }
function arrow(x, cx, cy, len, ang){
  x.save(); x.translate(cx, cy); x.rotate(ang); x.fillStyle = '#fff';
  const sw = len*0.16, hw = len*0.32, hl = len*0.38;
  x.fillRect(-sw/2, -len/2 + hl - 2, sw, len - hl + 2);
  x.beginPath(); x.moveTo(0, -len/2); x.lineTo(hw, -len/2 + hl); x.lineTo(-hw, -len/2 + hl); x.closePath(); x.fill(); x.restore();
}
function exitPanel(w, h, name, tag='EXIT', dist='', col=SIGN_GREEN, sub=''){ return canvasTex(w, h, (x, W2, H2) => {
  base(x, W2, H2, col);
  x.fillStyle = '#f2c230'; x.fillRect(48, 44, 190, 78); x.fillStyle = '#111'; fit(x, tag, 160, 56, 800); x.textBaseline = 'middle'; x.fillText(tag, 64, 85);
  x.fillStyle = '#fff'; x.font = '700 56px Archivo, sans-serif'; if (dist) x.fillText(dist, 262, 85);
  arrow(x, 120, H2*0.66, 130, -Math.PI/4);
  if (sub) { fit(x, name, W2 - 270, 88); x.fillText(name, 220, H2*0.58); fit(x, sub, W2 - 270, 52, 600); x.fillText(sub, 220, H2*0.82); }
  else { fit(x, name, W2 - 270, 104); x.fillText(name, 220, H2*0.68); }
}); }
function destPanel(w, h, lines){ return canvasTex(w, h, (x, W2, H2) => {
  base(x, W2, H2); x.fillStyle = '#fff'; x.textBaseline = 'middle';
  arrow(x, 110, H2/2, 170, 0);
  const lh = (H2 - 80) / lines.length;
  lines.forEach((t, i) => { fit(x, t, W2 - 250, 100); x.fillText(t, 200, 40 + lh*(i+0.5)); });
}); }
function boardPanel(w, h, rows, col=SIGN_GREEN){ return canvasTex(w, h, (x, W2, H2) => {
  base(x, W2, H2, col); x.fillStyle = '#fff'; x.textBaseline = 'middle';
  const lh = (H2 - 80) / rows.length;
  rows.forEach(([t, d], i) => { const y = 40 + lh*(i+0.5); x.textAlign = 'right'; x.font = '700 84px Archivo, sans-serif'; x.fillText(d, W2 - 56, y);
    x.textAlign = 'left'; fit(x, t, W2 - 400, 84); x.fillText(t, 56, y); });
}); }
function textPanel(w, h, bg, l1, l2){ return canvasTex(w, h, (x, W2, H2) => { x.fillStyle = bg; x.fillRect(0,0,W2,H2); x.strokeStyle = '#fff'; x.lineWidth = 10; x.strokeRect(16,16,W2-32,H2-32); x.fillStyle = '#fff'; x.textBaseline = 'middle';
  if (l2) { fit(x, l1, W2-100, H2*0.32, 800); x.fillText(l1, 50, H2*0.38); fit(x, l2, W2-100, H2*0.18, 600); x.fillText(l2, 50, H2*0.72); } else { fit(x, l1, W2-100, H2*0.5, 800); x.fillText(l1, 50, H2/2); } }); }
function panelMesh(w, h, tex){
  const g = new THREE.Group();
  g.add(solid(w+0.1, h+0.1, 0.12, signBackMat, 0, 0, -0.08));
  const mat = new THREE.MeshStandardMaterial({roughness:0.6, emissive:0xffffff, emissiveIntensity:signI, map:tex, emissiveMap:tex});
  mat.userData.sign = true; mat.userData.own = true;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); g.add(face); g.face = face; return g;
}

// ---------- vehicles ----------
const headMat = new THREE.MeshStandardMaterial({color:0xf2f2ee, emissive:0xfff6e0, emissiveIntensity:0.2});
const tailMat = new THREE.MeshStandardMaterial({color:0x8a1010, emissive:0xff2a1a, emissiveIntensity:0.3});
const brakeMat = new THREE.MeshStandardMaterial({color:0x8a1010, emissive:0xff2a1a, emissiveIntensity:0.3});
const glassMat = new THREE.MeshStandardMaterial({color:0x1d2630, roughness:0.15, metalness:0.6});
const tyreMat = M(0x161616);
const polRed = new THREE.MeshStandardMaterial({color:0x550008, emissive:0xff1020, emissiveIntensity:3});
const polBlue = new THREE.MeshStandardMaterial({color:0x000a55, emissive:0x1040ff, emissiveIntensity:3});
const polStripe = M(0x1f3f9a, {roughness:0.4});
const SHARED = new Set([headMat, tailMat, brakeMat, glassMat, tyreMat, polRed, polBlue, polStripe]);
const wheelGeo = new THREE.CylinderGeometry(1,1,1,14); wheelGeo.rotateZ(Math.PI/2); wheelGeo.userData.keep = true;
const PAINT = [0xf4f4f2,0xf4f4f2,0x1b1c1f,0x1b1c1f,0x8d939a,0x8d939a,0x5d6670,0xb22a26,0x1f3f73,0x2f5a4a,0xcfc4ae,0x6a1d2b,0xd77b2b];
const geoCache = new Map();
const bgeo = (w,h,d) => { const k = `${w}|${h}|${d}`; if (!geoCache.has(k)) { const g = new THREE.BoxGeometry(w,h,d); g.userData.keep = true; geoCache.set(k, g); } return geoCache.get(k); };
function box(w,h,d,mat,x,y,z,g){ const m = new THREE.Mesh(bgeo(w,h,d),mat); m.position.set(x,y,z); m.castShadow = true; g.add(m); return m; }
function wheels(g, pts, r, w){ return pts.map(([x,z]) => { const m = new THREE.Mesh(wheelGeo,tyreMat); m.scale.set(w,r,r); m.position.set(x,r,z); g.add(m); return m; }); }

function makeVehicle(type, color){
  const g = new THREE.Group(); let len, wh, r, v0;
  const own = c => { const m = M(c, {roughness:0.4, metalness:0.3}); m.userData.own = true; return m; };
  const paint = own(color ?? (type==='police' ? 0xf6f6f4 : pick(PAINT))); paint.roughness = 0.35; paint.metalness = 0.4;
  const tail = color != null ? brakeMat : tailMat;
  if (type==='car' || type==='suv' || type==='police'){
    const suv = type==='suv'; len = suv?4.8:4.5; const w = suv?1.95:1.8, h = suv?0.95:0.75; r = suv?0.38:0.33;
    box(w, h, len, paint, 0, r+h/2, 0, g);
    const ch = suv?0.75:0.55, cl = suv?2.9:2.3, cz = suv?-0.3:-0.2;
    box(w*0.9, ch, cl, paint, 0, r+h+ch/2, cz, g);
    box(w*0.92, ch*0.75, cl*0.98, glassMat, 0, r+h+ch*0.48, cz, g);
    for (const s of [-1,1]){ box(0.42,0.14,0.06,headMat, s*w*0.33, r+h*0.7, len/2, g); box(0.4,0.14,0.06,tail, s*w*0.35, r+h*0.75, -len/2, g); }
    if (type==='police') { box(w+0.02, 0.16, len*0.9, polStripe, 0, r+h*0.55, 0, g);
      box(0.55,0.14,0.3, polRed, -0.3, r+h+ch+0.07, cz, g); box(0.55,0.14,0.3, polBlue, 0.3, r+h+ch+0.07, cz, g); }
    wh = wheels(g, [[-w/2+0.12,len*0.32],[w/2-0.12,len*0.32],[-w/2+0.12,-len*0.32],[w/2-0.12,-len*0.32]], r, 0.24);
    v0 = rnd(24, 27.5);
  } else if (type==='moto'){
    len = 2; r = 0.3;
    box(0.32, 0.45, 1.8, paint, 0, r+0.3, 0, g);
    box(0.48, 0.6, 0.42, own(pick([0x1f3f73,0x2a2a2a,0x6a1d2b,0x3e5a3a,0x8a6a3a])), 0, r+0.95, -0.15, g);
    box(0.3, 0.3, 0.32, own(pick([0x111111,0xf2f2f2,0xc81e1e,0x1f3f73])), 0, r+1.4, -0.1, g);
    box(0.14,0.1,0.06,headMat, 0, r+0.55, 0.92, g); box(0.14,0.08,0.06,tail, 0, r+0.5, -0.92, g);
    wh = wheels(g, [[0,0.62],[0,-0.62]], r, 0.12); v0 = rnd(11,15);
  } else if (type==='van'){
    len = 5.6; r = 0.36; const w = 2;
    box(w, 1.9, len-1, paint, 0, r+1.1, -0.5, g); box(w, 1.1, 1.2, paint, 0, r+0.7, len/2-0.6, g);
    box(w*0.96, 0.6, 0.9, glassMat, 0, r+1.5, len/2-1.1, g);
    for (const s of [-1,1]){ box(0.35,0.14,0.06,headMat, s*0.7, r+0.75, len/2, g); box(0.2,0.4,0.06,tail, s*0.85, r+1, -len/2, g); }
    wh = wheels(g, [[-0.88,1.8],[0.88,1.8],[-0.88,-1.8],[0.88,-1.8]], r, 0.25); v0 = rnd(22, 25.5);
  } else if (type==='truck'){
    len = 16; r = 0.5; const w = 2.5;
    const cab = color != null ? paint : own(pick([0xf4f4f2,0x1f3f73,0xb22a26,0x2f5a4a,0x1b1c1f,0xe0a020]));
    box(w, 2.6, 2.4, cab, 0, r+1.6, len/2-1.2, g); box(w*0.96, 0.9, 0.08, glassMat, 0, r+2.3, len/2+0.01, g);
    const trailer = own(pick([0xe8e8e4,0xdcdcd6,0x9aa1a6,0x3a5f8f,0xc4462a])); trailer.roughness = 0.7;
    box(w, 3, 13, trailer, 0, r+2.2, -1.2, g); box(w*0.9, 0.4, len, tyreMat, 0, r+0.4, 0, g);
    for (const s of [-1,1]){ box(0.35,0.18,0.06,headMat, s*0.9, r+0.6, len/2, g); box(0.25,0.2,0.06,tail, s*1.05, r+0.8, -7.7, g); }
    wh = wheels(g, [[-1.1,6.6],[1.1,6.6],[-1.1,4.6],[1.1,4.6],[-1.1,-4.6],[1.1,-4.6],[-1.1,-6],[1.1,-6]], r, 0.38); v0 = rnd(18, 21.5);
  } else {
    len = 12.5; r = 0.5; const w = 2.5;
    const body = color != null ? paint : own(pick([0xf4f4f2,0x1f3f73,0x2f5a4a,0x5d6670,0xb22a26]));
    box(w, 3, len, body, 0, r+1.6, 0, g); box(w*1.01, 0.9, len*0.92, glassMat, 0, r+2.3, 0.2, g);
    for (const s of [-1,1]){ box(0.4,0.18,0.06,headMat, s*0.9, r+0.6, len/2, g); box(0.25,0.3,0.06,tail, s*1.05, r+1, -len/2, g); }
    wh = wheels(g, [[-1.1,4.2],[1.1,4.2],[-1.1,-3.4],[1.1,-3.4],[-1.1,-4.8],[1.1,-4.8]], r, 0.38); v0 = rnd(21, 23.5);
  }
  bendObj(g);
  return {g, len, wh, r, v0, type};
}
function killVehicle(v){ if (v.g.parent) v.g.parent.remove(v.g); v.g.traverse(o => { if (o.isMesh && !SHARED.has(o.material) && o.material.userData.own) o.material.dispose(); }); v.dead = true; }
const rm = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); };
const heavy = v => v.type==='truck' || v.type==='bus';
const heavyMin = n => n >= 5 ? 2 : n >= 2 ? 1 : 0;

// ================================================================
// TRIP LAYOUT — route events placed along u
// ================================================================
let trip = null, EV = [], SITES = [], RSITES = [], PLAZAS = [], KSITES = [], ZONES = [], OVS = [], OPENS = [], OBJ = [], CHG = [];
const laneSegs = {'1': [], '-1': []};
const nCorr = c => cfg.lanes === 'auto' || CORR[c].cls !== 't' ? CORR[c].lanes : +cfg.lanes;
const PLZK = new Set(['g', 't', 'te', 'ti']), RAMPK = new Set(['x', 'j', 'r']), SITEK = new Set(['x', 'j', 'r', 'g', 't', 'te', 'ti', 'k']);
const RW_EVERY = 5600, CF_EVERY = 9400, ZEXT = {rw: 1150, cf: 1380};

// keepN: when re-planning ahead, events 0..keepN keep their identity (and u) so the world already built stays valid
function layoutTrip(t, keepN = -1){
  const old = EV, oldZ = ZONES, oldV = OVS, oldO = OPENS;
  trip = t; EV = t.ev.map((e, i) => { const o = old[i];
    if (i > keepN || !o || o.key !== e.key) return {...e, i};
    for (const k of ['dest', 'tail', 'others', 'origin', 'turn']) delete o[k];
    return Object.assign(o, e, {i}); });
  const sc = cfg.scale; let lastRW = -RW_EVERY + 2600, lastCF = -CF_EVERY + 4400;
  ZONES = []; EV[0].u = 0;
  for (let i = 1; i < EV.length; i++) {
    const a = EV[i-1].u; let gap = Math.max(1150, (EV[i].rk - EV[i-1].rk)*1000/sc), cur = a + 1150;
    for (let guard = 0; guard < 50; guard++) {
      const dueRW = lastRW + RW_EVERY, dueCF = lastCF + CF_EVERY, ty = dueRW <= dueCF ? 'rw' : 'cf', due = Math.min(dueRW, dueCF);
      const pos = Math.max(cur + (ty === 'cf' ? 230 : 0), due);
      // contraflow needs a divided toll road; roadworks need at least two lanes
      if ((ty === 'cf' && CORR[EV[i].c].cls !== 't') || (ty === 'rw' && nCorr(EV[i].c) < 2)) { if (ty === 'rw') lastRW = due; else lastCF = due; continue; }
      if (pos + ZEXT[ty] > a + gap) { if (due > a + gap) break; gap = pos + ZEXT[ty] - a; }
      ZONES.push(oldZ.find(z => z.type === ty && Math.abs(z.u - pos) < 0.5) || {type: ty, u: pos}); if (ty === 'rw') lastRW = pos; else lastCF = pos;
      cur = pos + 1500;
    }
    EV[i].u = a + gap;
  }
  // corridor KM of each event on the corridor that LEAVES it
  for (const e of EV) { const n = CORR[e.cNext].nodes.find(n => n.key === e.key); e.kmOut = n ? n.km : e.km; }
  // lane changes between corridors: taper over the 150 m before c
  CHG = []; let n = nCorr(EV[0].c); const nStart = n;
  for (const e of EV) { const n1 = nCorr(e.cNext); if (n1 !== n) { CHG.push({c: e.u + 450, n0: n, n1}); n = n1; } }
  laneSegs['1'] = [{p: -Infinity, n: nStart}]; laneSegs['-1'] = [{p: -Infinity, n}];
  for (const c of CHG) laneSegs['1'].push({p: c.n1 < c.n0 ? c.c - 150 : c.c, n: c.n1});
  for (const c of [...CHG].reverse()) laneSegs['-1'].push({p: c.n0 < c.n1 ? -c.c : -(c.c - 150), n: c.n0});
  SITES = EV.filter(e => SITEK.has(e.kind));
  RSITES = SITES.filter(e => RAMPK.has(e.kind)); PLAZAS = SITES.filter(e => PLZK.has(e.kind)); KSITES = SITES.filter(e => e.kind === 'k');
  for (const s of SITES) { s.id = 's' + s.i; if (!s.bays) s.bays = {'1': null, '-1': null}; if (s.phase == null) s.phase = Math.random()*SIG_CYCLE; }
  // overpasses and closed U-turn openings in the empty stretches
  const clear = (u, r) => isToll(u) && !SITES.some(s => Math.abs(s.u - u) < 780 + r) && !ZONES.some(z => Math.abs(z.u - u) < ZEXT[z.type] - 400 + r);
  const lastU = EV[EV.length-1].u;
  OVS = []; for (let u = -2600; u < lastU + 6000; u += 1450) { let v = u; for (let k = 0; k < 8 && !clear(v, 0); k++) v += 180; if (clear(v, 0)) OVS.push(oldV.find(o => Math.abs(o.u - v) < 0.5) || {u: v}); }
  OPENS = [];
  const reuse = o => oldO.find(q => q.cf === o.cf && Math.abs(q.u - o.u) < 0.5) || o;
  for (const z of ZONES) if (z.type === 'cf') OPENS.push(reuse({u: z.u - 200, cf: z}), reuse({u: z.u + 200, cf: z}));
  for (let u = -1800; u < lastU + 6000; u += 2900) if (clear(u, 60) && !OVS.some(o => Math.abs(o.u - u) < 160)) OPENS.push(reuse({u}));
  OPENS.sort((a, b) => a.u - b.u);
  // build list of placeable objects
  OBJ = [...SITES.map(s => ({u: s.u, r: s.kind === 'j' ? 700 : s.kind === 'k' ? 560 : 680, type: 'site', s})),
    ...ZONES.map(z => ({u: z.u, r: ZEXT[z.type] - 450, type: z.type, z})),
    ...OVS.map(o => ({u: o.u, r: 340, type: 'ov', o})),
    ...OPENS.map(o => ({u: o.u, r: 60, type: 'ut', o}))].sort((a, b) => a.u - b.u);
}
function evAt(u){ let lo = 0, hi = EV.length - 1; if (u < EV[0].u) return -1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (EV[m].u <= u) lo = m; else hi = m - 1; } return lo; }
function rkAt(u){ const i = evAt(u); if (i < 0) return EV[0].rk; if (i >= EV.length - 1) return EV[EV.length-1].rk;
  const a = EV[i], b = EV[i+1]; return a.rk + (b.rk - a.rk)*(u - a.u)/(b.u - a.u); }
function kmAt(u){ const i = evAt(u); if (i < 0 || i >= EV.length - 1) return (i < 0 ? EV[0].kmOut : EV[EV.length-1].km);
  const a = EV[i], b = EV[i+1]; return a.kmOut + (b.km - a.kmOut)*(u - a.u)/(b.u - a.u); }
function corrAt(u){ const i = evAt(u); return i < 0 ? EV[0].c : EV[i].cNext; }
const limitAt = u => CORR[corrAt(u)].limit/3.6;
const isToll = u => CORR[corrAt(u)].cls === 't';
// traffic lights at town intersections: mainline green 26 s, amber 3 s, all-red 2 s, cross-street green 15 s, amber 3 s, all-red 2 s
const SIG_CYCLE = 51, XW = 11, SL = XW/2 + 4.5;
function sigMain(s){ const t = mod(clock + s.phase, SIG_CYCLE); return t < 26 ? 'G' : t < 29 ? 'Y' : 'R'; }
function sigCross(s){ const t = mod(clock + s.phase, SIG_CYCLE); return t >= 31 && t < 46 ? 'G' : t >= 46 && t < 49 ? 'Y' : 'R'; }
function lightAhead(sd, front){ for (const s of KSITES) { const d = sd*s.u - SL - front; if (d > -1 && d < 160) return {s, d}; } return null; }
function nAt(u){ let n = laneSegs['1'][0].n; for (const c of CHG) { if (u >= c.c) n = c.n1; else { if (u > c.c - 150) n = c.n0 + (c.n1 - c.n0)*(u - c.c + 150)/150; break; } } return n; }
const eAt = u => MED + nAt(u)*LW;
function nAvail(sd, p){ const S = laneSegs[sd]; let n = S[0].n; for (const s of S) { if (s.p <= p) n = s.n; else break; } return n; }
function dropAhead(sd, l, front){ const S = laneSegs[sd]; if (nAvail(sd, front) <= l) return 0; for (const s of S) if (s.p > front && s.n <= l) return s.p - front; return Infinity; }

// ================================================================
// CLOSURES: roadworks + contraflow (blocked intervals per lane in each side's own p = sd*u)
// ================================================================
const ZONE = 200, TAPER = 60, STOP = {vel:0};
const blocks = new Map(), SPZ = []; let CFA = [];
const key = (d,l) => d*100 + l;
function addBlock(d, l, a, len){ const k = key(d,l); if (!blocks.has(k)) blocks.set(k, []); blocks.get(k).push([a, len]); }
function zoneCap(d, front){ let c = 40;
  for (const [zd, a, len, vl] of SPZ) { if (zd !== d) continue;
    if (front - a >= 0 && front - a < len) c = Math.min(c, vl); else { const dist = a - front; if (dist > 0 && dist < 400) c = Math.min(c, Math.sqrt(vl*vl + 3*dist)); } }
  return c; }
function postedCap(d, front){ let c = 40; for (const [zd, a, len, vl] of SPZ) if (zd === d && front - a >= 0 && front - a < len) c = Math.min(c, vl); return c; }
function cfAt(sd, p){ for (const z of CFA) if (z.A === sd && p >= z.CF_IN - 260 && p <= z.CF_END + 40) return z; return null; }
function laneExists(d, l, p){ if (l >= 0) return l < nAvail(d, p);
  for (const z of CFA) if (z.A === d && -l <= z.k && p >= z.CF_IN - 40 && p <= z.CF_END) return true; return false; }
function blockAhead(d, l, front){
  if (!laneExists(d, l, front)) return 0;
  let best = Infinity;
  if (l < 0) { for (const z of CFA) if (z.A === d && front >= z.CF_IN - 40 && front <= z.CF_END) best = Math.min(best, z.CF_END - front); return best; }
  best = dropAhead(d, l, front);
  const b = blocks.get(key(d,l)); if (!b) return best;
  for (const [a, len] of b) { if (front - a >= 0 && front - a < len) return 0; const dd = a - front; if (dd > 0 && dd < best) best = dd; }
  return best;
}
function spanFree(d, l, x0, x1){
  if (!laneExists(d, l, x0) || !laneExists(d, l, x1)) return false;
  if (l >= 0 && dropAhead(d, l, x0) < x1 - x0) return false;
  const b = blocks.get(key(d,l)); if (!b) return true;
  for (const [a, len] of b) if ((a >= x0 && a < x1) || (x0 >= a && x0 < a + len)) return false;
  return true;
}
function closedBlocks(d, n){
  const idx = [...new Set(cfg.closed[d] || [])].map(k => n - k).filter(i => i >= 0 && i < n).sort((a,b) => a-b);
  if (idx.length >= n) return [];
  const out = [];
  for (const i of idx) { const last = out[out.length-1]; if (last && last.b === i-1) last.b = i; else out.push({a:i, b:i}); }
  for (const blk of out) { blk.fromOuter = blk.b === n-1 || blk.a !== 0;
    blk.order = []; if (blk.fromOuter) for (let l=blk.b; l>=blk.a; l--) blk.order.push(l); else for (let l=blk.a; l<=blk.b; l++) blk.order.push(l); }
  return out;
}
function cfGeom(z){
  const n = Math.round(nAt(z.u)), A = cfg.cf, k = Math.min(cfg.cfk, n), o1 = A*z.u - 200, o2 = A*z.u + 200;
  const CF_IN = o1 - OPEN_HW, CF_OUT = o2 - OPEN_HW, CF_END = o2 + 30, taper = 25*k + 20;
  const bStart = -(CF_END + 10) - taper, bEnd = 30 - CF_IN;
  return {z, n, A, B: -A, k, oneWay: k >= n, o1, o2, CF_IN, CF_OUT, CF_END, taper, bStart, bEnd};
}
let blockKey = '';
function setupBlocks(force){
  const near = ZONES.filter(z => Math.abs(z.u - camU) < 4000), towns = KSITES.filter(t => Math.abs(t.u - camU) < 4000);
  const k = near.map(z => z.u).join(',') + '|' + towns.map(t => t.u).join(',');
  if (!force && k === blockKey) return; blockKey = k;
  blocks.clear(); SPZ.length = 0; CFA = [];
  for (const z of near) {
    if (z.type === 'rw') { const n = Math.round(nAt(z.u));
      for (const d of [1, -1]) { const B = closedBlocks(d, n); if (!B.length) continue;
        const p0 = d > 0 ? z.u - 100 : -(z.u + 100);
        SPZ.push([d, p0 - 290, 200, 16.7], [d, p0 - 90, ZONE + 160, 11.1]);
        for (const blk of B) { const m = blk.order.length; blk.order.forEach((l, j) => addBlock(d, l, p0 + TAPER*j/m, ZONE + 20 - TAPER*j/m)); } } }
    else if (cfg.cf) { const c = cfGeom(z); CFA.push(c);
      SPZ.push([c.B, c.bStart - 290, c.bEnd - c.bStart + 330, 16.7], [c.A, c.o1 - 290, c.CF_END - c.o1 + 330, 16.7]);
      for (let j = 0; j < c.k; j++) { const a = c.bStart + c.taper*j/c.k; addBlock(c.B, j, a, c.bEnd - a); } }
  }
  // 50 km/h inside towns on the national roads
  for (const t of towns) for (const d of [1, -1]) SPZ.push([d, d*t.u - TOWN_R, 2*TOWN_R, 50/3.6]);
}
const TOWN_R = 460;

// ================================================================
// WORLD: road chunks (every CH metres) + placed objects
// ================================================================
const chunks = new Map(), built = new Map();
// solid roadside/roadway objects the player can hit: boxes in (u, x) with an owner group for cleanup
let SOLIDS = [];
function addSolid(owner, name, uA, uB, xA, xB){ SOLIDS.push({owner, name, u0: Math.min(uA, uB), u1: Math.max(uA, uB), x0: Math.min(xA, xB), x1: Math.max(xA, xB)}); }
// box given in a frame group's local coords (x outward, z along travel of side sd, origin at u0)
function addLocalSolid(owner, sd, u0, name, x0, x1, z0, z1){ addSolid(owner, name, u0 + sd*z0, u0 + sd*z1, -sd*x0, -sd*x1); }
function dropSolids(gs){ const set = new Set(gs); SOLIDS = SOLIDS.filter(o => !set.has(o.owner)); }
const trunkGeo = new THREE.CylinderGeometry(0.2,0.3,2,6); trunkGeo.translate(0,1,0); trunkGeo.userData.keep = true;
const crownGeo = new THREE.ConeGeometry(2.2,6,7); crownGeo.translate(0,4.8,0); crownGeo.userData.keep = true;
const blobGeo = new THREE.IcosahedronGeometry(2.6,0); blobGeo.translate(0,4,0); blobGeo.userData.keep = true;
const trunkMat = M(0x5a4330), crownMat = M(0x3f5f34), blobMat = M(0x587a3a, {flatShading:true});
const dashGeo = new THREE.PlaneGeometry(0.15, 3); dashGeo.rotateX(-Math.PI/2); dashGeo.userData.keep = true;
const prDashGeo = new THREE.PlaneGeometry(0.12, 3); prDashGeo.rotateX(-Math.PI/2); prDashGeo.userData.keep = true;
const poleGeo = new THREE.CylinderGeometry(0.12,0.16,11,8); poleGeo.translate(0,5.5,0); poleGeo.userData.keep = true;
const armGeo = new THREE.BoxGeometry(6, 0.14, 0.14); armGeo.translate(0,10.9,0); armGeo.userData.keep = true;
const headGeo = new THREE.BoxGeometry(0.9,0.18,0.4); headGeo.userData.keep = true;
const postGeo = new THREE.BoxGeometry(0.12,0.8,0.12); postGeo.userData.keep = true;
const gateGeo = new THREE.BoxGeometry(0.6, 0.85, 1.05); gateGeo.userData.keep = true;
const rampSiteNear = (u, r = 180) => RSITES.find(s => Math.abs(s.u - u) < r);

function kmPostTex(txt){ return canvasTex(0.5, 0.7, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0,0,w,h); x.strokeStyle = '#111'; x.lineWidth = 24; x.strokeRect(12,12,w-24,h-24);
  x.fillStyle = '#111'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 200px Archivo, sans-serif'; x.fillText('KM', w/2, h*0.3); fit(x, txt, w - 80, 300, 800); x.fillText(txt, w/2, h*0.66); }); }

// ---------- national road (jalan nasional) chunk ----------
const uPoleMat = M(0x9a948a), uBarMat = M(0x6b6660), curbMat = M(0xc9c4b8), shrubMat = M(0x4f7a3a, {flatShading:true}), shoulderMat = M(0x8f8a76), roofMat = M(0x8a4b35), roofMat2 = M(0x6b3b2a);
const RUKO = [0xe8d9b5, 0xd9c3a0, 0xf0e6d2, 0xc9d6c3, 0xe3c8c0, 0xd2d8e0, 0xf2efe8, 0xe6b98a].map(c => M(c));
const AWN = [0x2a6fb5, 0xc8342b, 0xe0a020, 0x2f8a4a, 0x7a3fa0].map(c => M(c, {roughness:0.6}));
const PADDY = [M(0x9fb35a), M(0x7fa046), M(0xb8b768)];
const shrubGeo = new THREE.IcosahedronGeometry(0.7, 0); shrubGeo.translate(0, 0.6, 0); shrubGeo.userData.keep = true;
const uPoleGeo = new THREE.CylinderGeometry(0.1, 0.13, 9, 6); uPoleGeo.translate(0, 4.5, 0); uPoleGeo.userData.keep = true;
const uBarGeo = new THREE.BoxGeometry(1.6, 0.1, 0.1); uBarGeo.translate(0, 8.4, 0); uBarGeo.userData.keep = true;
const sPoleGeo = new THREE.CylinderGeometry(0.08, 0.11, 8, 6); sPoleGeo.translate(0, 4, 0); sPoleGeo.userData.keep = true;
const roofGeo = new THREE.ConeGeometry(4.6, 2.4, 4); roofGeo.rotateY(Math.PI/4); roofGeo.userData.keep = true;
const unitBox = new THREE.BoxGeometry(1, 1, 1); unitBox.userData.keep = true;
function ubox(mat, x, y, z, w, h, d){ const m = new THREE.Mesh(unitBox, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; }
const townNear = (u, r = TOWN_R) => KSITES.find(t => Math.abs(t.u - u) < r);
function buildChunkNat(i){
  const u0 = i*CH, u1 = u0 + CH, g = new THREE.Group(), R = rng(i*7919 + 29);
  g.userData.u0 = u0; const Z = u => -(u - u0);
  const us = []; for (let u = u0; u <= u1 + 0.01; u += 10) us.push(u);
  const divided = nAt(u0 + CH/2) >= 1.5, town = townNear(u0 + CH/2, TOWN_R + 80);
  const xGap = u => KSITES.some(t => Math.abs(t.u - u) < XW/2 + 9);
  for (const s of [-1, 1]) {
    g.add(strip(us, u => s*(MED - 0.05), u => s*(eAt(u) + 0.8), 0, asphalt, Z));
    g.add(strip(us, u => s*(eAt(u) + 0.8), u => s*(eAt(u) + (town ? 5 : 2.6)), 0.004, town ? curbMat : shoulderMat, Z));
    g.add(strip(us, u => s*(eAt(u) - 0.08), u => s*(eAt(u) + 0.08), 0.012, white, Z));
    const dp = []; for (let l = 1; l < 5; l++) for (let u = Math.ceil(u0/9)*9; u < u1; u += 9) if (l < nAt(u + 1.5) - 0.3 && l < nAt(u) - 0.3) dp.push([s*(MED + l*LW), Z(u + 1.5)]);
    g.add(instanced(dashGeo, white, dp, 0.012));
    const ku = u0 + 60;
    if (EV.length && !xGap(ku)) { const p = panelMesh(0.5, 0.7, kmPostTex(kmAt(ku).toFixed(1).replace('.', ','))); p.position.set(s*(eAt(ku) + 3.2), 1.1, Z(ku)); p.rotation.y = s < 0 ? 0 : Math.PI; g.add(p);
      addSolid(g, 'Menabrak patok KM', ku - 0.3, ku + 0.3, s*(eAt(ku) + 3.2) - 0.3, s*(eAt(ku) + 3.2) + 0.3); }
    if (town) {
      // shophouses (ruko) with coloured awnings, gaps for side streets
      let u = u0 + R()*4;
      while (u < u1) { const w = 7 + R()*5, h = 6 + R()*5, d = 12, x = s*(eAt(u) + 6 + d/2);
        if (!xGap(u) && !xGap(u + w) && R() > 0.08) {
          g.add(ubox(RUKO[Math.floor(R()*RUKO.length)], x, h/2, Z(u + w/2), d, h, w - 0.4));
          g.add(ubox(AWN[Math.floor(R()*AWN.length)], s*(eAt(u) + 5.4), 3.1, Z(u + w/2), 1.6, 0.15, w - 0.6));
          g.add(ubox(roofMat2, x, h + 0.2, Z(u + w/2), d + 0.4, 0.4, w)); }
        u += w; }
      const lp = []; for (let u2 = Math.ceil(u0/40)*40; u2 < u1; u2 += 40) if (!xGap(u2)) { lp.push([s*(eAt(u2) + 3.4), Z(u2)]); addSolid(g, 'Menabrak tiang lampu', u2 - 0.25, u2 + 0.25, s*(eAt(u2) + 3.4) - 0.25, s*(eAt(u2) + 3.4) + 0.25); }
      g.add(instanced(sPoleGeo, lampMat, lp), instanced(headGeo, lampHeadMat, lp.map(([x, z]) => [x - s*0.9, z]), 7.9));
    } else {
      for (let k = 0; k < 2; k++) { const w = 30 + R()*120, o = 14 + R()*40;
        g.add(flat(w, CH*(0.4 + R()*0.6), PADDY[Math.floor(R()*3)], s*(eAt(u0) + o + w/2), 0.002, -CH/2)); }
      for (let u = u0 + R()*30; u < u1; u += 30 + R()*40) { if (R() < 0.45) continue; const o = 9 + R()*14, x = s*(eAt(u) + o + 3);
        g.add(ubox(RUKO[Math.floor(R()*RUKO.length)], x, 1.6, Z(u), 6, 3.2, 7));
        const rf = new THREE.Mesh(roofGeo, R() < 0.5 ? roofMat : roofMat2); rf.position.set(x, 4.4, Z(u)); rf.scale.set(1, 1, 1.2); rf.castShadow = true; g.add(rf); }
      const pp = []; for (let u2 = Math.ceil(u0/40)*40; u2 < u1; u2 += 40) { pp.push([s*(eAt(u2) + 3.6), Z(u2)]); addSolid(g, 'Menabrak tiang listrik', u2 - 0.25, u2 + 0.25, s*(eAt(u2) + 3.6) - 0.25, s*(eAt(u2) + 3.6) + 0.25); }
      g.add(instanced(uPoleGeo, uPoleMat, pp), instanced(uBarGeo, uBarMat, pp));
    }
  }
  if (divided) {
    g.add(solid(2*MED - 0.4, 0.25, CH, curbMat, 0, 0.125, -CH/2));
    const sp = []; for (let u = Math.ceil(u0/6)*6; u < u1; u += 6) if (!xGap(u)) sp.push([0, Z(u)]);
    g.add(instanced(shrubGeo, shrubMat, sp, 0.2));
  } else {
    g.add(strip(us, u => -MED, u => MED, 0.002, asphalt, Z));
    for (const o of [-0.18, 0.18]) g.add(strip(us, u => o - 0.06, u => o + 0.06, 0.012, yellowLine, Z));
  }
  const per = MOBILE ? 7 : 12, pts = [];
  for (let k = 0; k < per*2; k++) { const s = k % 2 ? 1 : -1, u = u0 + R()*CH, o = (town ? 24 : 40) + R()*260;
    pts.push({x: s*(eAt(u) + o), z: Z(u), k: 0.7 + R()*0.8, h: 0.85 + R()*0.4, r: R()*6.28}); }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(1, pts.length)), blobs = new THREE.InstancedMesh(blobGeo, blobMat, Math.max(1, pts.length));
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), upv = new THREE.Vector3(0,1,0);
  pts.forEach((p, j) => { pv.set(p.x, 0, p.z); sc.set(p.k, p.k*p.h, p.k); q.setFromAxisAngle(upv, p.r); tm.compose(pv, q, sc); trunks.setMatrixAt(j, tm); blobs.setMatrixAt(j, tm); });
  trunks.count = blobs.count = pts.length;
  for (const m of [trunks, blobs]) { m.castShadow = true; g.add(m); }
  bendObj(g); scene.add(g); return g;
}

function buildChunk(i){
  if (EV.length && !isToll(i*CH + CH/2)) return buildChunkNat(i);
  const u0 = i*CH, u1 = u0 + CH, g = new THREE.Group(), R = rng(i*7919 + 13);
  g.userData.u0 = u0; const Z = u => -(u - u0);
  const us = []; for (let u = u0; u <= u1 + 0.01; u += 10) us.push(u);
  const lineRuns = cut([u0, u1], RSITES.filter(s => Math.abs(s.u - (u0 + u1)/2) < 260).map(s => [s.u - 180, s.u + 180]));
  for (const s of [-1, 1]) {
    g.add(strip(us, u => s*(MED - 0.05), u => s*(eAt(u) + 3), 0, asphalt, Z));
    g.add(strip(us, u => s*(eAt(u) + 3), u => s*(eAt(u) + 7), 0.004, vergeMat, Z));
    g.add(flat(0.15, CH, white, s*(MED+0.2), 0.012, -CH/2));
    for (const [a, b] of lineRuns) { const ru = []; for (let u = a; u <= b + 0.01; u += 10) ru.push(Math.min(u, b));
      g.add(strip(ru, u => s*(eAt(u) - 0.1), u => s*(eAt(u) + 0.1), 0.012, white, Z));
      const rail = wall(ru, u => s*(eAt(u) + 2.8), 0.55, 0.85, railMat, Z); g.add(rail);
      const pp = []; for (let u = Math.ceil(a/4)*4; u < b; u += 4) pp.push([s*(eAt(u) + 2.85), Z(u)]);
      g.add(instanced(postGeo, railMat, pp, 0.4)); }
    // lane dashes
    const dp = []; for (let l = 1; l < 5; l++) for (let u = Math.ceil(u0/9)*9; u < u1; u += 9) if (l < nAt(u + 1.5) - 0.3 && l < nAt(u) - 0.3) dp.push([s*(MED + l*LW), Z(u + 1.5)]);
    g.add(instanced(dashGeo, white, dp, 0.012));
    // parallel road (Jalan Nasional, 2 lajur per arah)
    const pr = u => eAt(u) + PRC;
    g.add(strip(us, u => s*(pr(u) - 7.2), u => s*(pr(u) + 7.2), 0.004, asphalt, Z));
    g.add(strip(us, u => s*(pr(u) + 7.2), u => s*(pr(u) + 10), 0.003, prVerge, Z));
    g.add(strip(us, u => s*(pr(u) - 9.5), u => s*(pr(u) - 7.2), 0.003, prVerge, Z));
    for (const o of [-6.9, 6.9]) g.add(strip(us, u => s*(pr(u) + o - 0.07), u => s*(pr(u) + o + 0.07), 0.012, white, Z));
    for (const o of [-0.15, 0.15]) g.add(strip(us, u => s*(pr(u) + o - 0.06), u => s*(pr(u) + o + 0.06), 0.012, yellowLine, Z));
    const np = []; for (const o of [-3.5, 3.5]) for (let u = Math.ceil(u0/8)*8; u < u1; u += 8) np.push([s*(pr(u) + o), Z(u + 1.5)]);
    g.add(instanced(prDashGeo, white, np, 0.012));
    // KM post (patok KM)
    const ku = u0 + 60;
    if (!rampSiteNear(ku, 200) && EV.length) { const p = panelMesh(0.5, 0.7, kmPostTex(kmAt(ku).toFixed(1).replace('.', ','))); p.position.set(s*(eAt(ku) + 4.2), 1.1, Z(ku)); p.rotation.y = s < 0 ? 0 : Math.PI; g.add(p, solid(0.1, 0.75, 0.1, signBackMat, s*(eAt(ku) + 4.2), 0.375, Z(ku) + 0.1*(s<0?-1:1))); }
  }
  g.add(strip(us, u => -MED, u => MED, 0.003, medianMat, Z));
  // median barrier with U-turn openings
  const opens = OPENS.filter(o => o.u > u0 - 40 && o.u < u1 + 40).map(o => [o.u - OPEN_HW, o.u + OPEN_HW]);
  for (const [a, b] of cut([u0, u1], opens)) g.add(solid(0.6, 0.9, b - a, barMat, 0, 0.45, Z((a + b)/2)));
  // median lamps
  const covered = u => OVS.some(o => Math.abs(o.u - u) < 16) || SITES.some(t => (t.kind === 'j' && Math.abs(t.u - u) < 20) || (PLZK.has(t.kind) && Math.abs(t.u - u) < 14));
  const lz = []; for (let u = Math.ceil(u0/45)*45; u < u1; u += 45) if (!opens.some(([a, b]) => u > a - 3 && u < b + 3) && !covered(u)) lz.push(u);
  const poles = instanced(poleGeo, lampMat, lz.map(u => [0, Z(u)])), arms = instanced(armGeo, lampMat, lz.map(u => [0, Z(u)]));
  const heads = instanced(headGeo, lampHeadMat, lz.flatMap(u => [[-2.8, Z(u)], [2.8, Z(u)]]), 10.8);
  poles.castShadow = true; g.add(poles, arms, heads);
  // trees
  const per = MOBILE ? 9 : 16, pts = [];
  for (let k = 0; k < per*2; k++) { const s = k % 2 ? 1 : -1, u = u0 + R()*CH, near = rampSiteNear(u, 430);
    let o = near ? 345 + R()*90 : 14 + R()*310;
    if (o > PRC - 13 && o < PRC + 13) o += 26;
    if (OVS.some(ov => Math.abs(ov.u - u) < 24)) continue;
    if (PLAZAS.some(p => Math.abs(p.u - u) < 60) && o < 30) continue;
    pts.push({x: s*(eAt(u) + o), z: Z(u), k: 0.7 + R()*0.8, h: 0.85 + R()*0.4, r: R()*6.28}); }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pts.length), crowns = new THREE.InstancedMesh(crownGeo, crownMat, Math.ceil(pts.length/2)), blobs = new THREE.InstancedMesh(blobGeo, blobMat, Math.ceil(pts.length/2));
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), upv = new THREE.Vector3(0,1,0);
  pts.forEach((p, j) => { pv.set(p.x, 0, p.z); sc.set(p.k, p.k*p.h, p.k); q.setFromAxisAngle(upv, p.r); tm.compose(pv, q, sc); trunks.setMatrixAt(j, tm); (j % 2 ? crowns : blobs).setMatrixAt(j >> 1, tm); });
  crowns.count = pts.filter((_, j) => j % 2).length; blobs.count = pts.length - crowns.count;
  for (const m of [trunks, crowns, blobs]) { m.castShadow = true; g.add(m); }
  bendObj(g); scene.add(g); return g;
}

// frame groups: local x = outward from the median, local z = travel direction of side sd; u = u0 + sd*z
function frameGroup(sd, u0){ const g = new THREE.Group(); g.rotation.y = sd > 0 ? Math.PI : 0; g.userData.u0 = u0; return g; }
function worldGroup(u0){ const g = new THREE.Group(); g.userData.u0 = u0; return g; }

// ---------- ramps (paths in site-local o/u coordinates; site centre at u = 180) ----------
const ss = t => { t = Math.min(1, Math.max(0, t)); return t*t*(3-2*t); };
const RE = 24, SC = 180, FAR = 650;
const Hh = q => q[2] || 0;
function chaikin(p){ for (let k=0; k<2; k++){ const q = [p[0]]; for (let i=0; i<p.length-1; i++){ const a = p[i], b = p[i+1]; q.push([a[0]*.75+b[0]*.25, a[1]*.75+b[1]*.25, Hh(a)*.75+Hh(b)*.25], [a[0]*.25+b[0]*.75, a[1]*.25+b[1]*.75, Hh(a)*.25+Hh(b)*.75]); } q.push(p[p.length-1]); p = q; } return p; }
function dens(p, step=5){ const q = [p[0]]; for (let i=1; i<p.length; i++){ const a = p[i-1], b = p[i], n = Math.max(1, Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1])/step)); for (let j=1; j<=n; j++) q.push([a[0]+(b[0]-a[0])*j/n, a[1]+(b[1]-a[1])*j/n, Hh(a)+(Hh(b)-Hh(a))*j/n]); } return q; }
const smooth = p => dens(chaikin(p.filter((x,i) => !i || Math.hypot(x[0]-p[i-1][0], x[1]-p[i-1][1]) > 0.05)));
const offPts = R => { const p = [[1.8, 50]]; for (let u=55; u<=110; u+=5) p.push([1.8 + (R-1.8)*ss((u-50)/60), u]); return p; };
const onPts = R => { const p = []; for (let u=240; u<=300; u+=5) p.push([R - (R-1.8)*ss((u-240)/60), u]); p.push([1.8, 352]); return p; };
// junction bridge: the crossing toll road sits on an 8 m deck (5.1 m clearance plus structure)
const DECK_H = 8, DK = DECK_H + 0.72, DECK_HW = 12.6;
const inFoot = q => q[1] > SC - DECK_HW - 2.8 && q[1] < SC + DECK_HW + 2.8;
function arcP(co, cu, R, a0, a1){ const n = Math.max(2, Math.ceil(R*Math.abs(a1-a0)/4)), p = []; for (let i=0; i<=n; i++){ const a = a0 + (a1-a0)*i/n; p.push([co + R*Math.cos(a), cu + R*Math.sin(a)]); } return p; }
// vertical profile: constant grade in the middle with parabolic vertical curves over the first and last 20 %
const vcurve = x => { x = Math.min(1, Math.max(0, x)); const b = 0.2, k = 1/(1 - b); return x < b ? k*x*x/(2*b) : x > 1 - b ? 1 - k*(1 - x)*(1 - x)/(2*b) : k*(x - b/2); };
function grade(p, i0, i1, h0, h1){ const c = [0]; for (let i=1; i<p.length; i++) c.push(c[i-1] + Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]));
  return p.map((q, i) => [q[0], q[1], i <= i0 ? h0 : i >= i1 ? h1 : h0 + (h1-h0)*vcurve((c[i]-c[i0])/(c[i1]-c[i0]))]); }
const firstIn = p => p.findIndex(inFoot);
const lastInFromStart = p => { let i = 0; while (i < p.length - 1 && inFoot(p[i + 1])) i++; return i; };
// Cikunir-style cloverleaf (per side): outer connector exit (outC) and loop entry (inB) before the bridge,
// loop exit (outA) and outer connector entry (inC) after it. Each outer connector wraps around its loop,
// loops reach deck height before passing under the deck footprint, and nothing crosses at grade.
function ssPath(kind, e){ const far = FAR, nfar = -FAR - 2*e, P = Math.PI;
  if (kind === 'outC') { const p = [...offPts(80), [80,145], ...arcP(105.4,145,25.4,P,P/2)]; const i1 = firstIn(p); p.push([far,170.4]); return grade(p, 1, i1, 0, DK); }
  if (kind === 'outA') { const p = [[1.8,50],[1.8,196],[3,208],[6,224.6]]; const i0 = p.length - 1; p.push(...arcP(41,224.6,35,P,-P/2));
    let i1 = p.length - 1; while (i1 > i0 && inFoot(p[i1 - 1])) i1--; p.push([nfar,189.6]); return grade(p, i0, i1, 0, DK); }
  if (kind === 'inC') { const p = [[far,189.6],[140,189.6], ...arcP(140,219.6,30,-P/2,-P), [110,250], [103,270], [88,292], [58,316], [26,336], [7,348], [1.8,356]];
    const i0 = lastInFromStart(p), i1 = p.findIndex(q => q[1] >= 300); return grade(p, i0, i1, DK, 0); }
  const p = [[nfar,170.4], ...arcP(37.5,136.4,34,P/2,-P)]; const i0 = lastInFromStart(p), i1 = p.length - 1; p.push([1.8,165],[1.8,356]); return grade(p, i0, i1, DK, 0); }
function prof(p, keys){ const c = [0]; for (let i=1; i<p.length; i++) c.push(c[i-1] + Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]));
  return p.map((q, i) => { let h; const K = keys.length;
    if (i <= keys[0][0]) h = keys[0][1]; else if (i >= keys[K-1][0]) h = keys[K-1][1];
    else { let j = 0; while (keys[j+1][0] < i) j++; const [a, ha] = keys[j], [b, hb] = keys[j+1]; h = ha + (hb-ha)*vcurve((c[i]-c[a])/((c[b]-c[a]) || 1)); }
    return [q[0], q[1], h]; }); }
// trumpet interchange with a toll gate on the stem road (exit to Jalan Nasional)
const TR_H = 6.8, GATE_O = 200, PR_IN = PRC - 7.2 + 3;
const trOut = () => [[1.8,50],[2.6,58],[4.5,66],[8,75],[40,108],[62,130],[74,146],[82,162],[90,174],[100,178.25],[PR_IN,178.25]];
function trIn(){ const head = [[PR_IN,181.75],[40,181.75]], p = [...head, ...arcP(35,156.75,25,Math.PI/2,Math.PI*2)], i0 = head.length;
  p.push([60,181.75]); const i1 = p.length-1; p.push([60,215], ...onPts(60)); const i2 = p.findIndex(q => q[1] >= 285); p.push([1.8,352]);
  return prof(p, [[i0,0],[i1,TR_H],[i2,0]]); }
const BAYS = Array.from({length:20}, (_,i) => 146 + i*4), STATIC = BAYS.map((_,i) => [0,2,3,6,9,10,13,15,18].includes(i));
function restPath(part, bay){
  if (part === 'out') return bay == null ? [...offPts(RE), [30,125], [34,138], [34,228], [28,236], ...onPts(RE)] : [...offPts(RE), [30,125], [34,138], [34,bay-7], [40,bay]];
  return [[40,bay], [46,bay+7], [46,228], [30,236], ...onPts(RE)];
}
function mkPath(raw){ const pts = smooth(raw), c = [0]; for (let i=1; i<pts.length; i++) c.push(c[i-1] + Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1])); return {pts, c, len: c[c.length-1]}; }
function pathAt(P, d, i){ i = Math.min(i||0, P.pts.length-2); while (i < P.pts.length-2 && P.c[i+1] < d) i++; while (i > 0 && P.c[i] > d) i--;
  const a = P.pts[i], b = P.pts[i+1], l = (P.c[i+1]-P.c[i]) || 1, f = Math.min(1, Math.max(0, (d-P.c[i])/l));
  return {o: a[0]+(b[0]-a[0])*f, u: a[1]+(b[1]-a[1])*f, h: Hh(a)+(Hh(b)-Hh(a))*f, ho: (b[0]-a[0])/l, hu: (b[1]-a[1])/l, i}; }
const PCACHE = new Map(); const cachedPath = (k, f) => PCACHE.get(k) || (PCACHE.set(k, mkPath(f())), PCACHE.get(k));

// local-frame ribbons (x = e + o, z = u - zs)
function ribbon(pts, e, w, mat, y, lat=0, zs=SC){ const pos = [], idx = [];
  for (let i=0; i<pts.length; i++){ const a = pts[Math.max(0,i-1)], b = pts[Math.min(pts.length-1,i+1)];
    let dO = b[0]-a[0], dU = b[1]-a[1]; const l = Math.hypot(dO,dU) || 1; dO /= l; dU /= l;
    for (const sd of [-1,1]) { const k = lat + sd*w/2; pos.push(e + pts[i][0] + k*dU, y + Hh(pts[i]), pts[i][1] - k*dO - zs); }
    if (i) { const j = (i-1)*2; idx.push(j, j+1, j+2, j+1, j+3, j+2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m; }
const pierGeo = new THREE.CylinderGeometry(0.55,0.55,1,10); pierGeo.translate(0,0.5,0); pierGeo.userData.keep = true;
const runsOf = (p, f) => { const out = []; let r = []; for (const q of p) { if (f(q)) r.push(q); else { if (r.length > 1) out.push(r); r = []; } } if (r.length > 1) out.push(r); return out; };
// a lateral strip along a path: from (lat0, y0) to (lat1, y1) relative to the road surface (y relative to the path height when rel)
function sideStrip(pts, e, lat0, y0, lat1, y1, mat, zs, rel0 = true, rel1 = true){ const pos = [], idx = [];
  for (let i=0; i<pts.length; i++){ const a = pts[Math.max(0,i-1)], b = pts[Math.min(pts.length-1,i+1)];
    let dO = b[0]-a[0], dU = b[1]-a[1]; const l = Math.hypot(dO,dU) || 1; dO /= l; dU /= l; const h = Hh(pts[i]);
    const L0 = typeof lat0 === 'function' ? lat0(h) : lat0, L1 = typeof lat1 === 'function' ? lat1(h) : lat1;
    pos.push(e + pts[i][0] + L0*dU, (rel0 ? h : 0) + y0, pts[i][1] - L0*dO - zs, e + pts[i][0] + L1*dU, (rel1 ? h : 0) + y1, pts[i][1] - L1*dO - zs);
    if (i) { const j = (i-1)*2; idx.push(j, j+1, j+2, j+1, j+3, j+2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = true; return m; }
const parapetMat = M(0xc9c4b8, {side: THREE.DoubleSide}), slopeMat = M(0x7d8a55, {side: THREE.DoubleSide});
const capGeo = new THREE.BoxGeometry(6.2, 1.0, 1.6); capGeo.userData.keep = true;
const onDeckQ = q => inFoot(q) && Hh(q) > DK - 0.9;
// ramps: low sections sit on a grassed embankment, high sections on a viaduct (piers with crossbeams);
// every raised section has concrete parapets
function ramp3(g, raw, e, keep = () => true, zs = SC){
  const piers = [], q0 = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), upv = new THREE.Vector3(0, 1, 0);
  for (const p of runsOf(smooth(raw), q => q[0] > -2 && !onDeckQ(q))) {
    g.add(ribbon(p, e, 4.2, asphaltDS, -0.006, 0, zs));
    for (const lat of [1.95, -1.95]) for (const r of runsOf(p, q => (q[0] > 3.3 || Hh(q) > 0.5) && keep(q))) g.add(ribbon(r, e, 0.15, whiteDS, 0.012, lat, zs));
    for (const r of runsOf(p, q => Hh(q) > 0.6)) for (const sd of [-1, 1]) {
      g.add(sideStrip(r, e, sd*2.35, -0.05, sd*2.35, 0.9, parapetMat, zs), sideStrip(r, e, sd*2.1, 0.9, sd*2.35, 0.9, parapetMat, zs));
    }
    // embankment (fill) up to 5.5 m, slopes 1:1.5
    for (const r of runsOf(p, q => Hh(q) > 0.05 && Hh(q) <= 5.6)) for (const sd of [-1, 1]) g.add(sideStrip(r, e, sd*2.35, -0.05, h => sd*(2.35 + 1.5*h), 0, slopeMat, zs, true, false));
    // viaduct above that: deck edge + piers with crossbeams
    for (const r of runsOf(p, q => Hh(q) > 5.2)) { for (const sd of [-1, 1]) g.add(sideStrip(r, e, sd*2.35, -1.0, sd*2.35, -0.05, fasciaMat, zs));
      g.add(sideStrip(r, e, -2.35, -1.0, 2.35, -1.0, fasciaMat, zs)); }
    let acc = 0; for (let i=1; i<p.length; i++) { acc += Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]); if (acc > 24 && Hh(p[i]) > 5.6) { acc = 0; const a2 = p[i-1], b2 = p[Math.min(p.length-1, i+1)]; piers.push([p[i], Math.atan2(b2[0]-a2[0], b2[1]-a2[1])]); } }
  }
  const pm = new THREE.InstancedMesh(pierGeo, concrete, Math.max(1, piers.length)), cm = new THREE.InstancedMesh(capGeo, concrete, Math.max(1, piers.length)); pm.count = cm.count = piers.length;
  piers.forEach(([q, th], i) => { tm.compose(p3.set(e + q[0], 0, q[1] - zs), q0, s3.set(1.2, Hh(q) - 1.9, 1.2)); pm.setMatrixAt(i, tm);
    tm.compose(p3.set(e + q[0], Hh(q) - 1.5, q[1] - zs), new THREE.Quaternion().setFromAxisAngle(upv, th), s3.set(1, 1, 1)); cm.setMatrixAt(i, tm); });
  pm.castShadow = cm.castShadow = true; g.add(pm, cm);
}
function road(g, raw, e){ const p = smooth(raw); g.add(ribbon(p, e, 4.2, asphaltDS, -0.006));
  for (const lat of [1.95, -1.95]) { let run = []; const flush = () => { if (run.length > 1) g.add(ribbon(run, e, 0.15, whiteDS, 0.012, lat)); run = []; };
    for (const q of p) { if (lat > 0 ? q[0] > 1 : q[0] > 4.2) run.push(q); else flush(); } flush(); } }
function stemPlaza(g, e, name){ const x = e + GATE_O;
  g.add(flat(36, 17, asphaltDS, x, -0.004, 0), solid(8, 0.6, 17, M(0xf2f2f2), x, 5.8, 0), solid(8.2, 0.6, 17.2, M(0x0c6a3c), x, 6.4, 0));
  for (const du of [-4.4, 0, 4.4]) g.add(solid(3.2, 2.6, 1.3, M(0xe4e9ec), x, 1.3, du), solid(0.3, 4.4, 0.3, concrete, x, 3.8, du));
  for (const sd of [1, -1]) { const p = panelMesh(7.6, 1.2, textPanel(7.6, 1.2, SIGN_GREEN, 'GT ' + name.toUpperCase())); p.position.set(x + sd*4.15, 6.1, 0); p.rotation.y = sd*Math.PI/2; g.add(p); }
  const et = [SP(20), PL(['Siapkan', 'kartu e-Toll'], '#fff', '#111', 1.3, 0.55)];
  signPost(g, e + GATE_O - 30, -5.6, -Math.PI/2, et); signPost(g, e + GATE_O + 30, 5.6, Math.PI/2, et); }
function restArea(g, e){ const ex = o => e + o, th = Math.atan2(6, 7), z = u => u - SC;
  g.add(flat(34, 128, lotMat, ex(39), -0.003, z(176)), flat(18, 36, lotMat, ex(65), -0.003, z(222)), flat(3.5, 40, M(0xb5b0a5), ex(58), -0.001, z(168)));
  const bl = new THREE.PlaneGeometry(0.12, 8); bl.rotateX(-Math.PI/2); bl.rotateY(th);
  g.add(instanced(bl, white, [...BAYS.map(b => [ex(40), z(b-2)]), [ex(40), z(BAYS[BAYS.length-1]+2)]], 0.01));
  STATIC.forEach((st, i) => { if (!st) return; const v = makeVehicle(pick(['car','car','suv','van'])); v.g.position.set(ex(40), 0, z(BAYS[i])); v.g.rotation.y = th; g.add(v.g); });
  for (const u of [150, 172, 194]) { const v = makeVehicle('truck'); v.g.position.set(ex(52.5), 0, z(u)); g.add(v.g); }
  g.add(solid(12, 4.2, 34, M(0xe9e2d4), ex(66), 2.1, z(168)), solid(13.6, 0.5, 36, M(0x9a3b2a), ex(66), 4.45, z(168)), solid(0.1, 2, 30, glassMat, ex(59.95), 1.6, z(168)));
  g.add(solid(7, 4, 7, M(0xf2efe6), ex(66), 2, z(140))); const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 8, 0, Math.PI*2, 0, Math.PI/2), M(0x2f7a55)); dome.position.set(ex(66), 4, z(140)); g.add(dome);
  g.add(solid(10, 0.8, 16, M(0xf4f4f4), ex(66), 5.6, z(222)), solid(10.2, 0.45, 16.2, M(0xd0202a), ex(66), 5.05, z(222)));
  for (const dx of [-3.5, 3.5]) for (const dz of [-5, 5]) g.add(solid(0.35, 5.2, 0.35, M(0xf4f4f4), ex(66)+dx, 2.6, z(222+dz)));
  for (const dz of [-4, 4]) g.add(solid(0.8, 1.6, 1.4, M(0xd0202a), ex(66), 0.8, z(222+dz)));
  const p = panelMesh(6, 3.2, textPanel(6, 3.2, SIGN_BLUE, 'REST AREA', 'SPBU · Musala · Kuliner')); p.position.set(ex(18), 6.5, z(128)); p.rotation.y = Math.PI;
  g.add(p, solid(0.4, 5, 0.4, signBackMat, ex(18), 2.5, z(128.4))); }

// events seen ahead from event i, travelling on side sd
function ahead(i, sd){ const out = [], E = EV[i];
  if (sd > 0) for (let j = i + 1; j < EV.length; j++) out.push({e: EV[j], d: EV[j].rk - E.rk});
  else for (let j = i - 1; j >= 0; j--) out.push({e: EV[j], d: E.rk - EV[j].rk});
  return out; }
function citiesAhead(i, sd, k = 2){ const out = [], own = EV[i].city;
  for (const a of ahead(i, sd)) { if (a.e.city && a.e.city !== own && !out.some(o => o.e.city === a.e.city)) out.push(a); if (out.length >= k) break; }
  return out; }
const corrLabel = id => 'Tol ' + CORR[id].short;
function jctTargets(s){ const ids = s.others && s.others.length ? s.others : [];
  if (!ids.length) return {name: nodeLabel(s), sub: ''};
  const c = CORR[ids[0]], a = c.nodes[0], b = c.nodes[c.nodes.length-1];
  return {name: corrLabel(ids[0]) + (ids[1] ? ' · ' + CORR[ids[1]].short : ''), sub: `${(NODES.get(a.key).city || a.name)} / ${(NODES.get(b.key).city || b.name)}`}; }

// overhead gantry + boards for one side of a site (local frame)
function siteSigns(g, s, sd, e){
  const roadW = e + 3, rot = Math.PI, i = s.i;
  const kind = s.kind, half = (e - MED)/2, pw = Math.max(5, half - 0.6), ph = 3.2;
  // advance board 500 m
  const adv = kind === 'r' ? textPanel(5, 2.6, SIGN_BLUE, 'REST AREA', `${nodeLabel(s).replace('Rest Area ', '')} · 500 m`)
    : kind === 'j' ? exitPanel(5.6, 3.2, jctTargets(s).name, 'JCT', '1 km', SIGN_GREEN, jctTargets(s).sub)
    : kind === 'x' ? exitPanel(5.6, 3.2, s.name, 'EXIT', '500 m')
    : textPanel(5.6, 2.6, SIGN_GREEN, nodeLabel(s).toUpperCase(), '500 m · Siapkan kartu e-Toll');
  const ab = panelMesh(kind === 'r' ? 5 : 5.6, kind === 'r' ? 2.6 : (kind === 'j' || kind === 'x') ? 3.2 : 2.6, adv);
  ab.position.set(roadW + 3, 4.4, -640); ab.rotation.y = rot; g.add(ab);
  for (const dx of [-2, 2]) g.add(solid(0.18, 4.6, 0.18, signBackMat, roadW + 3 + dx, 2.3, -639.85));
  if (PLZK.has(kind)) {
    signPost(g, roadW + 2.5, -380, rot, [SP(60)], 0, 1.4);
    signPost(g, roadW + 2.5, -230, rot, [SP(40), PL(['Siapkan', 'kartu e-Toll'], '#fff', '#111', 1.4, 0.55)], 0, 1.4);
    signPost(g, roadW + 2.5, -110, rot, [SP(20)], 0, 1.4);
    if ((kind === 't' || kind === 'te') && sd > 0) signPost(g, roadW + 2.5, 140, rot, [PL(['Akhir', 'jalan tol'], '#fff', '#111', 1.5, 0.6)], 0, 1.4);
    else signPost(g, roadW + 2.5, 160, rot, [SP(Math.round(limitAt(s.u + sd*200)*3.6)), MN(60)], 0, 1.4);
    return;
  }
  // gantry over the carriageway 130 m before the diverge
  const gz = -270;
  for (const x of [0.75, roadW + 0.6]) g.add(solid(0.35, 9, 0.35, signBackMat, x, 4.5, gz));
  g.add(solid(roadW - 0.15, 0.3, 0.3, signBackMat, 0.75 + (roadW - 0.15)/2, 8.9, gz));
  const t = jctTargets(s);
  const exTex = kind === 'r' ? textPanel(pw, ph, SIGN_BLUE, 'REST AREA', 'SPBU · Musala · Kuliner')
    : kind === 'j' ? exitPanel(pw, ph, t.name, 'JCT', '', SIGN_GREEN, t.sub) : exitPanel(pw, ph, s.name, 'EXIT', '');
  const cs = citiesAhead(i, sd), dl = cs.map(c => c.e.city); if (!dl.length) dl.push('Akhir rute');
  const ex = panelMesh(pw, ph, exTex), de = panelMesh(pw, ph, destPanel(pw, ph, dl));
  ex.position.set(MED + half*1.5, 7.6, gz - 0.3); de.position.set(MED + half*0.5, 7.6, gz - 0.3); ex.rotation.y = de.rotation.y = rot; g.add(ex, de);
  // gore sign
  signPost(g, 8 + e, -95, rot, [PL([kind === 'r' ? 'REST AREA' : 'EXIT', '←'], kind === 'r' ? SIGN_BLUE : '#f2c230', kind === 'r' ? '#fff' : '#111', 1.2, 0.7)], 0, 1.3);
  signPost(g, roadW + 2.5, -150, rot, [SP(kind === 'r' ? 40 : 60)], 0, 1.3);
  // km board after the merge
  const nxt = ahead(i, sd).find(a => 'xjt'.includes(a.e.kind));
  const rows = []; if (nxt) rows.push([nxt.e.kind === 'j' ? nodeLabel(nxt.e).replace('Simpang Susun', 'JCT') : nxt.e.name, fmtKm(nxt.d)]);
  for (const c of cs) if (!rows.some(r => r[0] === c.e.city)) rows.push([c.e.city, fmtKm(c.d)]);
  if (!rows.length) rows.push(['Akhir rute', '']);
  const bd = panelMesh(5.6, 3.6, boardPanel(5.6, 3.6, rows.slice(0, 3)));
  bd.position.set(roadW + 3, 4.4, 235); bd.rotation.y = rot; g.add(bd);
  for (const dx of [-1.8, 1.8]) g.add(solid(0.18, 4.6, 0.18, signBackMat, roadW + 3 + dx, 2.3, 235.15));
  signPost(g, roadW + 2.5, 300, rot, [SP(Math.round(limitAt(s.u + sd*300)*3.6)), MN(60), PL(['Kendaraan berat', 'lajur kiri'], '#fff', '#111', 1.5, 0.6)], 0, 1.5);
}
// edge line, gore dashes and guard rail inside a ramp site (local frame, t in [-180,180])
function siteEdge(g, kind, e){
  const ss2 = kind === 'j', dash = ss2 ? [[15,180],[180,350]] : [[15,55],[298,350]], gap = ss2 ? [[10,180],[180,352]] : [[10,80],[285,352]];
  for (const [a,b] of cut([0,360], dash)) g.add(flat(0.2, b-a, white, e, 0.012, (a+b)/2 - SC));
  const dp = []; for (const [a,b] of dash) for (let u=a; u<b; u+=6) dp.push([e, u + 1.5 - SC]);
  const dg = new THREE.PlaneGeometry(0.3, 3); dg.rotateX(-Math.PI/2); g.add(instanced(dg, white, dp, 0.012));
  const pp = [];
  for (const [a,b] of cut([0,360], gap)) { g.add(solid(0.08, 0.32, b-a, railMat, e + 2.8, 0.7, (a+b)/2 - SC)); for (let u=a; u<b; u+=4) pp.push([e + 2.85, u - SC]); }
  g.add(instanced(postGeo, railMat, pp, 0.4));
}
// ---------- town intersection with traffic lights ----------
const housingGeo = new THREE.BoxGeometry(0.42, 1.15, 0.3); housingGeo.translate(0, 0, -0.16); housingGeo.userData.keep = true;
const lampDisc = new THREE.CircleGeometry(0.13, 16); lampDisc.userData.keep = true;
const zebraGeo = new THREE.PlaneGeometry(0.5, 3); zebraGeo.rotateX(-Math.PI/2); zebraGeo.userData.keep = true;
const housingMat = M(0x1d1f22), SIGCOL = [0xff2a1a, 0xffb000, 0x22d36a];
function sigMats(){ return SIGCOL.map(c => { const m = new THREE.MeshStandardMaterial({color: 0x222222, emissive: c, emissiveIntensity: 0.05}); m.userData.own = true; return m; }); }
function sigHead(g, mats, x, y, z, rot){ const h = new THREE.Group(); h.position.set(x, y, z); h.rotation.y = rot;
  h.add(new THREE.Mesh(housingGeo, housingMat)); mats.forEach((m, k) => { const d = new THREE.Mesh(lampDisc, m); d.position.set(0, 0.36 - k*0.36, 0.001); h.add(d); }); g.add(h); }
function dirPanel(rows){ return canvasTex(5.6, 3.4, (x, W2, H2) => { base(x, W2, H2); x.fillStyle = '#fff'; x.textBaseline = 'middle';
  const lh = (H2 - 80)/rows.length; rows.forEach(([ang, t], k) => { const y = 40 + lh*(k + 0.5); arrow(x, 110, y, Math.min(120, lh*0.8), ang); fit(x, t, W2 - 250, Math.min(96, lh*0.7)); x.fillText(t, 200, y); }); }); }
function crossNames(s){ const N = NODES.get(s.key), out = [];
  for (const id of N.corr) { const c = CORR[id]; if (c.cls !== 'n' || id === s.c || id === s.cNext) continue;
    const i = c.nodes.findIndex(n => n.key === s.key); for (const j of [i - 1, i + 1]) if (c.nodes[j]) out.push(c.nodes[j].name); }
  return out; }
function intersection(s, e){
  const g = worldGroup(s.u), L = e + 140, n = Math.round((e - MED)/LW);
  g.add(flat(2*L, XW, asphalt, 0, 0.008, 0));
  for (const sx of [-1, 1]) { const len = L - e - 3, cx = sx*(e + 3 + len/2);
    for (const o of [-0.13, 0.13]) g.add(flat(len, 0.1, yellowLine, cx, 0.014, o));
    for (const o of [-1, 1]) g.add(flat(len, 0.14, white, cx, 0.014, o*(XW/2 - 0.3)));
    g.add(flat(0.45, XW/2 - 0.4, white, sx*(e + 6), 0.016, sx*XW/4)); }
  const zp = [];
  for (const sd of [1, -1]) { const sx = -sd, zz = sd > 0 ? 1 : -1;
    g.add(flat(n*LW, 0.45, white, sx*(MED + n*LW/2), 0.016, zz*SL));
    for (let x = -e + 0.4; x < e; x += 1.1) zp.push([x, zz*(XW/2 + 2)]); }
  g.add(instanced(zebraGeo, white, zp, 0.015));
  s.sig = {main: sigMats(), cross: sigMats()};
  for (const sd of [1, -1]) { const sx = -sd, zz = sd > 0 ? 1 : -1, rot = sd > 0 ? 0 : Math.PI;
    g.add(solid(0.18, 6.2, 0.18, lampMat, sx*(e + 1.6), 3.1, zz*(SL + 1)), solid(n*LW + 1.6, 0.14, 0.14, lampMat, sx*(e + 1.6 - (n*LW + 1.6)/2), 6.1, zz*(SL + 1)));
    addSolid(g, 'Menabrak tiang lampu lalu lintas', s.u - zz*(SL + 1) - 0.25, s.u - zz*(SL + 1) + 0.25, sx*(e + 1.6) - 0.25, sx*(e + 1.6) + 0.25);
    sigHead(g, s.sig.main, sx*(e + 1.6), 3.2, zz*(SL + 1) + zz*0.1, rot);
    sigHead(g, s.sig.main, sx*(MED + n*LW/2), 5.4, zz*(SL + 1) + zz*0.1, rot); }
  for (const dx of [1, -1]) { const x = -dx*(e + 7), z = dx > 0 ? -(XW/2 + 1.4) : XW/2 + 1.4;
    g.add(solid(0.18, 4, 0.18, lampMat, x, 2, z)); sigHead(g, s.sig.cross, x, 3.2, z, dx > 0 ? -Math.PI/2 : Math.PI/2); }
  // cross-street traffic, which obeys its own light
  g.userData.cross = [];
  for (const dx of [1, -1]) { let p = rnd(0, 30);
    while (p < 2*L) { const t = Math.random(), v = makeVehicle(t < .35 ? 'moto' : t < .7 ? 'car' : t < .82 ? 'suv' : t < .93 ? 'van' : 'truck');
      Object.assign(v, {dx, p, vel: 9, L, stopP: L - (e + 6), zz: dx > 0 ? -XW/4 : XW/4}); v.g.rotation.y = dx*Math.PI/2; g.add(v.g); g.userData.cross.push(v); p += v.len + rnd(12, 60)/cfg.den; } }
  g.userData.site = s;
  return g;
}
function townSigns(g, s, sd, e){
  const roadW = e + 2, rot = Math.PI, cs = citiesAhead(s.i, sd, 1), side = crossNames(s);
  const wel = panelMesh(5, 2.2, textPanel(5, 2.2, SIGN_GREEN, 'SELAMAT DATANG', `di ${s.name}`)); wel.position.set(roadW + 3.5, 3.6, -TOWN_R + 10); wel.rotation.y = rot; g.add(wel);
  for (const dx of [-2, 2]) g.add(solid(0.16, 3.8, 0.16, signBackMat, roadW + 3.5 + dx, 1.9, -TOWN_R + 10.15));
  signPost(g, roadW + 1.5, -TOWN_R, rot, [SP(50)], 0, 1.3);
  const rows = [[0, cs[0] ? cs[0].e.city : 'Pusat Kota']]; if (side[0]) rows.push([-Math.PI/2, side[0]]); if (side[1]) rows.push([Math.PI/2, side[1]]);
  if (rows.length < 2) rows.push([-Math.PI/2, 'Pusat Kota']);
  const dp = panelMesh(5.6, 3.4, dirPanel(rows)); dp.position.set(roadW + 3.2, 4.6, -150); dp.rotation.y = rot; g.add(dp);
  for (const dx of [-2, 2]) g.add(solid(0.18, 4.8, 0.18, signBackMat, roadW + 3.2 + dx, 2.4, -149.85));
  signPost(g, roadW + 1.5, -90, rot, [PL(['Hati-hati', 'lampu lalu lintas'], '#f2c230', '#111', 1.4, 0.6)], 0, 1.2);
  signPost(g, roadW + 1.5, TOWN_R + 10, rot, [SP(Math.round(limitAt(s.u + sd*(TOWN_R + 40))*3.6)), PL(['Akhir', 'batas kota'], '#fff', '#111', 1.4, 0.55)], 0, 1.3);
}
function updateSignals(){
  for (const [o, gs] of built) { if (o.type !== 'site' || o.s.kind !== 'k' || !o.s.sig) continue; const s = o.s;
    const m = sigMain(s), c = sigCross(s);
    s.sig.main.forEach((mt, k) => mt.emissiveIntensity = 'RYG'[k] === m ? 3.5 : 0.05);
    s.sig.cross.forEach((mt, k) => mt.emissiveIntensity = 'RYG'[k] === c ? 3.5 : 0.05); }
}
function simCross(g, dt){
  const s = g.userData.site, st = sigCross(s);
  for (const dx of [1, -1]) { const L = g.userData.cross.filter(v => v.dx === dx).sort((a, b) => b.p - a.p);
    L.forEach((v, k) => { let tgt = v.type === 'moto' ? 11 : 9.5; if (v.hold > 0) { v.hold -= dt; tgt = 0; }
      const front = v.p + v.len/2, lead = L[k - 1];
      let lim = Infinity; if (lead) lim = lead.p - lead.len/2 - 2.5 - front;
      if (st !== 'G' && front <= v.stopP + 0.5 && front > v.stopP - 30) lim = Math.min(lim, v.stopP - front);
      v.vel = lim < 0.3 || tgt === 0 ? 0 : Math.min(tgt, v.vel + 2.5*dt, Math.sqrt(2*3*Math.max(0, lim)));
      v.p += v.vel*dt;
      if (v.p > 2*v.L) v.p -= 2*v.L + rnd(5, 40);
      v.g.position.set(v.dx > 0 ? -v.L + v.p : v.L - v.p, 0, v.zz);
      for (const w of v.wh) w.rotation.x += v.vel*dt / v.r; }); }
}

function buildSite(s){
  const e = MED + Math.round(nAt(s.u))*LW, groups = [];
  if ('xjr'.includes(s.kind)) for (const sd of [1, -1]) {
    const g = frameGroup(sd, s.u); groups.push(g);
    siteEdge(g, s.kind, e);
    if (s.kind === 'r') { road(g, [[1.8,12], ...offPts(RE)], e); road(g, onPts(RE), e); restArea(g, e); s.bays[sd] = STATIC.map(x => x ? 'static' : null); }
    else if (s.kind === 'j') { for (const kd of ['outC','outA','inC','inB']) ramp3(g, ssPath(kd, e), e); }
    else { const keep = q => q[0] < PRC - 12; ramp3(g, [[1.8,12], ...trOut()], e, keep); ramp3(g, trIn(), e, keep); stemPlaza(g, e, s.name); }
    siteSigns(g, s, sd, e);
  } else if (s.kind === 'k') { for (const sd of [1, -1]) { const g = frameGroup(sd, s.u); groups.push(g); townSigns(g, s, sd, e); } groups.push(intersection(s, e)); }
  else for (const sd of [1, -1]) { const g = frameGroup(sd, s.u); groups.push(g); siteSigns(g, s, sd, e); }
  if (s.kind === 'j') groups.push(flyover(s, e));
  if (PLZK.has(s.kind)) groups.push(mainPlaza(s, e));
  return groups;
}
// world-space points where a site's ramps meet the deck edge, so the deck parapet opens exactly there
function deckJoins(e){ const out = {'1': [], '-1': []};
  for (const sd of [1, -1]) for (const k of ['outC', 'outA', 'inC', 'inB']) { const pts = smooth(ssPath(k, e));
    for (let i = 1; i < pts.length; i++) { const a = pts[i-1], b = pts[i], ta = a[1] - SC, tb = b[1] - SC;
      for (const edge of [-DECK_HW, DECK_HW]) if ((ta - edge)*(tb - edge) < 0 && Hh(a) > DK - 1.5) { const f = (edge - ta)/(tb - ta), o = a[0] + (b[0]-a[0])*f;
        const x = -sd*(e + o), z = -sd*edge; out[Math.sign(z)].push(x); } } }
  return out; }
function flyover(s, e){ const g = worldGroup(s.u), H = DECK_H, dw = 25.2, W2 = 2*(e + FAR + 10);
  g.add(solid(W2, 1.4, dw, concrete, 0, H, 0), flat(W2, 23, asphalt, 0, H+0.71, 0), solid(W2, 0.9, 0.5, M(0xb8b4aa), 0, H+1.15, 0));
  for (const zz of [-8, 0, 8]) g.add(solid(W2, 1.1, 1.6, fasciaMat, 0, H - 1.2, zz));                      // box girders under the deck
  const joins = deckJoins(e);
  for (const sz of [-1,1]) { const gaps = joins[sz].map(x => [x - 9, x + 9]);
    for (const [a,b] of cut([-W2/2, W2/2], gaps)) g.add(solid(b-a, 1.1, 0.35, concrete, (a+b)/2, H+1.25, sz*(dw/2-0.2))); }
  const dg = new THREE.PlaneGeometry(3, 0.15); dg.rotateX(-Math.PI/2); const dp = [];
  for (const sz of [-1,1]) { for (const kk of [1,2]) for (let x=-W2/2; x<W2/2; x+=9) dp.push([x, sz*(0.6 + kk*3.6)]); for (const ed of [0.5, 11.3]) g.add(flat(W2, 0.15, white, 0, H+0.73, sz*ed)); }
  g.add(instanced(dg, white, dp, H+0.73));
  // pier bents: two columns and a crossbeam, spaced along the bridge, never on a road below
  const below = x => { const a = Math.abs(x); return a < e + 5 || Math.abs(a - (e + PRC)) < 12; };
  for (let x = -W2/2 + 20; x < W2/2 - 10; x += 38) { if (below(x)) continue;
    for (const zz of [-7.5, 7.5]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.85,0.85,H - 1.7,12), concrete); c.position.set(x, (H - 1.7)/2, zz); c.castShadow = true; g.add(c); }
    g.add(solid(2, 1.2, dw - 2, concrete, x, H - 1.6, 0)); }
  for (const sx of [-1, 1]) for (const zz of [-7.5, 7.5]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.85,0.85,H - 1.7,12), concrete); c.position.set(sx*(e + 6.5), (H - 1.7)/2, zz); c.castShadow = true; g.add(c); }
  for (const sx of [-1, 1]) g.add(solid(2, 1.2, dw - 2, concrete, sx*(e + 6.5), H - 1.6, 0));
  const t = jctTargets(s);
  for (const sd of [1, -1]) { const p = panelMesh((e - MED)*0.85, 2.4, textPanel((e - MED)*0.85, 2.4, SIGN_GREEN, nodeLabel(s), t.sub ? t.name : ''));
    p.position.set(-sd*(MED + (e - MED)/2), H - 0.2, sd*(dw/2 + 0.25)); p.rotation.y = sd > 0 ? 0 : Math.PI; g.add(p); }
  // through traffic on the crossing toll road
  g.userData.fly = [];
  for (let i=0; i<6; i++) { if (i % 3 === 2) continue; const dx = i<3 ? 1 : -1, zz = (dx>0 ? -1 : 1)*(2.4 + 3.6*(i%3)), vel = rnd(20, 27); let p = rnd(0, 40);
    while (p < W2) { const t2 = Math.random(), v = makeVehicle(t2<.12?'truck':t2<.2?'bus':t2<.32?'van':t2<.56?'suv':'car');
      Object.assign(v, {dx, p, vel, zz, W2}); v.g.rotation.y = dx*Math.PI/2; g.add(v.g); g.userData.fly.push(v); p += v.len + rnd(30, 120)/cfg.den; } }
  return g; }
function mainPlaza(s, e){ const g = worldGroup(s.u), wTot = 2*(e + 3);
  g.add(solid(wTot, 0.7, 14, M(0xf2f2f2), 0, 6.2, 0), solid(wTot + 0.2, 0.6, 14.2, M(0x0c6a3c), 0, 6.85, 0));
  for (const sd of [1, -1]) { const p = panelMesh(Math.min(wTot*0.6, 22), 1.5, textPanel(Math.min(wTot*0.6, 22), 1.5, SIGN_GREEN, nodeLabel(s).toUpperCase()));
    p.position.set(0, 6.6, sd*7.2); p.rotation.y = sd > 0 ? 0 : Math.PI; g.add(p); }
  const n = Math.round((e - MED)/LW);
  for (const s2 of [-1, 1]) {
    for (let l = 0; l <= n; l++) { const x = s2*(MED + l*LW) + (l === 0 ? s2*0.2 : l === n ? -s2*0.2 : 0), hw2 = l === 0 || l === n ? 0.3 : 0.45;
      g.add(solid(hw2*2, 0.25, 18, concrete, x, 0.12, 0)); addSolid(g, 'Menabrak pulau gerbang tol', s.u - 9, s.u + 9, x - hw2, x + hw2);
      if (l > 0 && l < n) { g.add(solid(0.8, 2.4, 2.2, M(0xe4e9ec), x, 1.45, s2*1.4), solid(0.25, 6, 0.25, concrete, x, 3, s2*-5)); } }
    g.add(flat(n*LW, 0.45, white, s2*(MED + n*LW/2), 0.014, s2 > 0 ? -0.6 : 0.6)); }
  return g; }

// ---------- overpass (jalan raya 1–4 lajur) ----------
const OV_RUN = 170;
function ovHeight(x, e){ const a = Math.abs(x), d0 = e + 25, d1 = e + 25 + OV_RUN; return a <= d0 ? OVH + 0.62 : a >= d1 ? 0 : (OVH + 0.62)*(1 - ss((a - d0)/(d1 - d0))); }
function buildOverpass(o){
  const g = worldGroup(o.u), e = eAt(o.u), ovl = cfg.ovl, rw = ovl*3.5, dw = rw + 2.4, xe = e + PRC - 7.2;
  g.add(solid(2*(e + 25), 1.2, dw, concrete, 0, OVH, 0));
  for (const sz of [-1,1]) g.add(solid(2*(e + 25), 1, 0.3, concrete, 0, OVH + 1.1, sz*(dw/2 - 0.15)));
  for (const zz of [-dw/4, dw/4]) g.add(solid(2*(e + 25), 0.9, 1.2, fasciaMat, 0, OVH - 1.0, zz));
  for (const x of [0, -(e + 3.6), e + 3.6]) { for (const dz of [-1,1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,OVH - 1.4,12), concrete); c.position.set(x, (OVH - 1.4)/2, dz*Math.max(0.9, dw/2 - 1.4)); c.castShadow = true; g.add(c); }
    g.add(solid(1.4, 1.0, dw - 0.6, concrete, x, OVH - 1.2, 0)); }
  for (const sx of [-1, 1]) g.add(solid(1.2, OVH + 0.6, dw + 3, concrete, sx*(e + 25), (OVH + 0.6)/2, 0));
  g.add(flat(2*(e + 25), rw, asphalt, 0, OVH + 0.62, 0));
  for (const s of [-1, 1]) {
    const xs = []; for (let k = 0; k <= 34; k++) xs.push(s*(e + 25 + OV_RUN*k/34));
    // trapezoid earth fill: flat top under the road, 1:1.5 side slopes down to the ground
    { const pos = [], idx = [], hw = dw/2 + 0.6;
      xs.forEach((x, k) => { const h = Math.max(0, ovHeight(x, e) - 0.02); pos.push(x, 0, -(hw + 1.5*h), x, h, -hw, x, h, hw, x, 0, hw + 1.5*h);
        if (k) { const j = (k-1)*4; for (const [a2, b2] of [[0,1],[1,2],[2,3]]) idx.push(j+a2, j+b2, j+4+a2, j+b2, j+4+b2, j+4+a2); } });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const fill = new THREE.Mesh(geo, slopeMat); fill.receiveShadow = true; g.add(fill); }
    const top = (fx, w2, mat, y = 0.02) => { const pos = [], idx = []; xs.forEach((x, k) => { const h = ovHeight(x, e) + y; pos.push(x, h, -w2/2 + fx, x, h, w2/2 + fx); if (k) { const j = (k-1)*2; if (s > 0) idx.push(j, j+2, j+1, j+1, j+2, j+3); else idx.push(j, j+1, j+2, j+1, j+3, j+2); } });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return new THREE.Mesh(geo, mat); };
    g.add(top(0, rw, asphaltDS)); for (const ez of [-1, 1]) g.add(top(ez*(rw/2 - 0.2), 0.15, whiteDS, 0.04));
    g.add(flat(xe - (e + 25 + OV_RUN), rw, asphalt, s*(e + 25 + OV_RUN + (xe - e - 25 - OV_RUN)/2), 0.006, 0));
    signPost(g, s*(e + 60), s*(rw/2 + 0.9), s > 0 ? Math.PI/2 : -Math.PI/2, [SP(40)], ovHeight(e + 60, e));
  }
  for (const ez of [-1, 1]) g.add(flat(2*(e + 25), 0.15, white, 0, OVH + 0.64, ez*(rw/2 - 0.2)));
  const ovDir = i => i < Math.ceil(ovl/2) ? 1 : -1, ovZ = i => (i - (ovl-1)/2)*3.5;
  for (let k = 1; k < ovl; k++) { const zb = (k - ovl/2)*3.5; if (ovDir(k-1) !== ovDir(k)) for (const of of [-0.13, 0.13]) g.add(flat(2*(e+25), 0.1, yellowLine, 0, OVH + 0.645, zb + of)); }
  g.userData.ov = []; const span = 2*xe;
  for (let i = 0; i < ovl; i++) { const dx = ovDir(i), vel = rnd(9, 12); let p = rnd(0, 30);
    while (p < span - 10) { const t = Math.random(), type = t<.35?'moto':t<.7?'car':t<.82?'suv':t<.92?'van':'truck';
      const v = makeVehicle(type); Object.assign(v, {dx, p, vel, span, zz: ovZ(i), e}); v.g.rotation.y = dx*Math.PI/2; g.add(v.g); g.userData.ov.push(v); p += v.len + rnd(15, 90)/cfg.den; } }
  return [g];
}

// ---------- U-turn openings (putaran balik, khusus petugas) ----------
function buildOpening(o){
  if (o.cf && cfg.cf) return [];
  const g = worldGroup(o.u), gp = []; for (let z = -OPEN_HW + 0.6; z < OPEN_HW - 0.5; z += 1.15) gp.push([0, z]);
  const gates = instanced(gateGeo, new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.6}), gp, 0.425);
  gates.material.userData.own = true;
  const cA = new THREE.Color(0xf05a14), cB = new THREE.Color(0xf2f2f2); gp.forEach((_, i) => gates.setColorAt(i, i%2 ? cA : cB)); gates.castShadow = true; g.add(gates);
  for (const sd of [1, -1]) signPost(g, 0, sd*(OPEN_HW + 3), sd > 0 ? 0 : Math.PI, [NU(), PL(['Khusus', 'petugas'], '#fff', '#111', 1, 0.5)], 0.9, 1.2);
  return [g];
}

// ---------- roadworks & contraflow visuals ----------
const coneGeo = new THREE.ConeGeometry(0.42, 1.4, 12); coneGeo.translate(0, 0.76, 0); coneGeo.userData.keep = true;
const bandGeo = new THREE.CylinderGeometry(0.22, 0.3, 0.26, 12); bandGeo.translate(0, 0.86, 0); bandGeo.userData.keep = true;
const coneBaseGeo = new THREE.BoxGeometry(0.8, 0.08, 0.8); coneBaseGeo.translate(0, 0.04, 0); coneBaseGeo.userData.keep = true;
const lampGeo = new THREE.BoxGeometry(0.22, 0.18, 0.1); lampGeo.translate(0, 1.6, 0); lampGeo.userData.keep = true;
const barGeo = new THREE.BoxGeometry(0.55, 0.9, 1.9); barGeo.translate(0, 0.45, 0); barGeo.userData.keep = true;
const amberMat = new THREE.MeshStandardMaterial({color:0xffb21a, emissive:0xffa000, emissiveIntensity:1});
const orange = M(0xf05a14, {roughness:0.6});
const bandMat = new THREE.MeshStandardMaterial({color:0xf4f4f4, emissive:0xffffff, emissiveIntensity:0.2});
const barA = M(0xf05a14, {roughness:0.5}), barB = M(0xf4f4f2, {roughness:0.5}), worksYellow = M(0xe8c21a, {roughness:0.5});
const arrowMats = new Set();
function arrowTex(right){ return canvasTex(2.4, 1.4, (x, w, h) => {
  x.fillStyle = '#111'; x.fillRect(0,0,w,h); x.fillStyle = '#ffb21a'; x.save(); x.translate(w/2, h/2); if (!right) x.scale(-1, 1);
  x.fillRect(-320, -45, 400, 90); x.beginPath(); x.moveTo(400, 0); x.lineTo(70, -220); x.lineTo(70, 220); x.closePath(); x.fill(); x.restore(); }); }
function warnTex(l1, l2, dist){ return canvasTex(3, 2.4, (x, w, h) => {
  x.fillStyle = '#f28c00'; x.fillRect(0,0,w,h); x.strokeStyle = '#111'; x.lineWidth = 14; x.strokeRect(24,24,w-48,h-48);
  x.fillStyle = '#111'; x.textBaseline = 'middle';
  fit(x, l1, w-120, 110, 800); x.fillText(l1, 60, h*0.28);
  fit(x, l2, w-120, 70, 600); x.fillText(l2, 60, h*0.5);
  x.font = '800 130px Archivo, sans-serif'; x.fillText(dist, 60, h*0.76); }); }
function cones(g, pts){ for (const [geo, mat] of [[coneGeo, orange], [bandGeo, bandMat], [coneBaseGeo, orange]]) { const m = instanced(geo, mat, pts); m.castShadow = true; g.add(m); }
  g.add(instanced(lampGeo, amberMat, pts.filter((_, i) => i % 3 === 0))); }
function barriers(g, x, z0, z1){ const a = [], b = []; for (let z = z0, i = 0; z < z1; z += 2, i++) (i % 2 ? b : a).push([x, z]);
  for (const [p, m] of [[a, barA], [b, barB]]) { const im = instanced(barGeo, m, p); im.castShadow = true; g.add(im); } }
function line(pts, x0, z0, x1, z1, step){ const n = Math.max(1, Math.round(Math.hypot(x1-x0, z1-z0)/step)); for (let i=0; i<=n; i++) pts.push([x0 + (x1-x0)*i/n, z0 + (z1-z0)*i/n]); }
function arrowBoard(g, x, z, right){
  const at = arrowTex(right);
  g.add(solid(1.8, 0.9, 3, worksYellow, x, 0.75, z + 1.5), solid(2.5, 1.5, 0.1, M(0x222222), x, 2.6, z + 0.05));
  const mat = new THREE.MeshStandardMaterial({map:at, emissive:0xffffff, emissiveMap:at, emissiveIntensity:0.9}); mat.userData.own = true; mat.userData.arrow = true;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), mat); face.position.set(x, 2.6, z - 0.02); face.rotation.y = Math.PI; g.add(face);
}
function warnBoard(g, roadW, z, l1, l2, dist){
  const sx = roadW + 2.5;
  for (const dx of [-1.2, 1.2]) g.add(solid(0.12, 3.2, 0.12, signBackMat, sx + dx, 1.6, z));
  const p = panelMesh(3, 2.4, warnTex(l1, l2, dist)); p.position.set(sx, 3, z - 0.1); p.rotation.y = Math.PI; g.add(p);
}
const laneB = l => MED + l*LW;
function buildRoadworks(z){
  const n = Math.round(nAt(z.u)), e = MED + n*LW, roadW = e + 3, groups = [];
  for (const d of [1, -1]) {
    const blks = closedBlocks(d, n); if (!blks.length) continue;
    const p0 = d > 0 ? z.u - 100 : -(z.u + 100), g = frameGroup(d, d*p0), pts = []; groups.push(g);
    for (const blk of blks) {
      const xa = laneB(blk.a), xb = laneB(blk.b + 1), se = blk.fromOuter ? xb : xa, ot = blk.fromOuter ? xa : xb, sg = Math.sign(ot - se);
      line(pts, se + sg*0.4, 0, ot - sg*0.3, TAPER, 2.5);
      line(pts, ot - sg*0.3, TAPER + 3, ot - sg*0.3, ZONE, 3);
      barriers(g, ot - sg*1.1, TAPER + 4, ZONE - 2);
      if (blk.fromOuter && blk.b < n-1) line(pts, se + sg*0.3, 4, se + sg*0.3, ZONE, 5);
      line(pts, ot - sg*0.3, ZONE + 5, se + sg*0.4, ZONE + 30, 5);
      g.add(flat(xb - xa - 0.4, ZONE - TAPER, M(0x4c4b47), (xa + xb)/2, 0.008, (ZONE + TAPER)/2));
      arrowBoard(g, laneB(blk.order[0]) + LW/2, 4.5, blk.fromOuter);
      const tz = ZONE*0.6, cx = (xa + xb)/2, U0 = d*p0;
      addLocalSolid(g, d, U0, 'Menabrak barrier pekerjaan jalan', ot - sg*1.1 - 0.3, ot - sg*1.1 + 0.3, TAPER + 3, ZONE - 1);
      addLocalSolid(g, d, U0, 'Menabrak truk proyek', cx - 1.25, cx + 1.25, tz - 3.6, tz + 4.2);
      addLocalSolid(g, d, U0, 'Menabrak papan panah', laneB(blk.order[0]) + LW/2 - 0.95, laneB(blk.order[0]) + LW/2 + 0.95, 4.4, 7.6);
      g.add(solid(2.4, 2.6, 2.2, worksYellow, cx, 1.6, tz + 3), solid(2.4, 1.2, 5, M(0xd9d6cc), cx, 1.0, tz - 1));
      for (let k=0; k<5; k++) g.add(solid(0.6, 1, 0.6, orange, cx + rnd(-0.8, 0.8), 0.5, tz - 9 - k*3));
    }
    cones(g, pts);
    warnBoard(g, roadW, -320, 'PEKERJAAN JALAN', 'Lajur ditutup', '300 m');
    warnBoard(g, roadW, -120, 'PEKERJAAN JALAN', 'Lajur ditutup', '100 m');
    signPost(g, roadW+2.5, -290, Math.PI, [SP(60)], 0, 1.4);
    signPost(g, roadW+2.5, -90, Math.PI, [SP(40), PL(['Hati-hati'], '#f2c230', '#111', 1.2, 0.45)], 0, 1.4);
    signPost(g, roadW+2.5, ZONE+70, Math.PI, [SP(100), PL(['Akhir', 'pekerjaan jalan'], '#fff', '#111', 1.5, 0.6)], 0, 1.4);
  }
  return groups;
}
// detour for a one-way contraflow: the opposite traffic leaves via a temporary ramp to the Jalan Nasional and comes back after
const detourOut = () => [[1.8,-232],[2.6,-224],[4.5,-216],[8,-207],[20,-192],[45,-167],[90,-133],[160,-98],[240,-74],[300,-60],[PR_IN,-55]];
const detourIn = len => [[PR_IN,len+50],[300,len+55],[240,len+70],[160,len+95],[90,len+130],[45,len+165],[20,len+190],[8,len+205],[4.5,len+214],[2.6,len+222],[1.8,len+232],[1.8,len+300]];
function buildContraflow(z){
  if (!cfg.cf) return [];
  const c = cfGeom(z), e = MED + c.n*LW, roadW = e + 3, groups = [];
  const len = c.bEnd - c.bStart, tb = c.taper, k = c.k;
  const g = frameGroup(c.B, c.B*c.bStart), pts = []; groups.push(g);
  if (!c.oneWay) {
    line(pts, MED + 0.4, 0, laneB(k) - 0.3, tb, 4);
    line(pts, laneB(k) - 0.3, tb + 9, laneB(k) - 0.3, len - 30, 9);
    line(pts, laneB(k) - 0.3, len - 25, MED + 0.4, len, 5);
    arrowBoard(g, MED + LW/2, 4.5, false);
  } else {
    line(pts, MED + 0.4, 0, e - 0.4, 0, 1.3);
    line(pts, MED + 0.4, len, e - 0.4, len, 1.3);
    for (let l=0; l<c.n; l+=2) arrowBoard(g, laneB(l) + LW/2, -6, true);
    const keep = q => q[0] < PRC - 12;
    ramp3(g, detourOut(), e, keep, 0); ramp3(g, detourIn(len), e, keep, 0);
    warnBoard(g, roadW, -520, 'JALAN DITUTUP', 'Lewat Jalan Nasional', '500 m');
  }
  cones(g, pts);
  for (const [x, z2, r] of [[MED + LW/2, Math.min(tb*0.5 + 10, tb + 4), 0], [MED + LW/2, len - 14, 0], [laneB(Math.min(k, c.n-1)) + 1.4, (tb + len)/2, 0.15]]) {
    const p = makeVehicle('police'); p.g.position.set(x, 0, z2); p.g.rotation.y = r; g.add(p.g); addLocalSolid(g, c.B, c.B*c.bStart, 'Menabrak mobil polisi', x - 1, x + 1, z2 - 2.3, z2 + 2.3); }
  const t1 = c.oneWay ? 'ONE WAY' : 'CONTRAFLOW', t2 = c.oneWay ? 'Lewat Jalan Nasional' : `${k} lajur kanan ditutup`;
  warnBoard(g, roadW, -320, t1, t2, '300 m'); warnBoard(g, roadW, -120, t1, t2, '100 m');
  signPost(g, roadW+2.5, -290, Math.PI, [SP(60)], 0, 1.4);
  signPost(g, roadW+2.5, len+40, Math.PI, [SP(100)], 0, 1.4);
  // beneficiary carriageway: police at the entry opening
  const gA = frameGroup(c.A, c.A*(c.o1 - 60)); groups.push(gA);
  const pA = makeVehicle('police'); pA.g.position.set(MED + 1.6, 0, 6); pA.g.rotation.y = -0.2; gA.add(pA.g);
  warnBoard(gA, roadW, -260, 'CONTRAFLOW', 'Ambil lajur kanan', '200 m');
  signPost(gA, roadW+2.5, -230, Math.PI, [SP(60)], 0, 1.4);
  return groups;
}

function buildObj(o){
  const gs = o.type === 'site' ? buildSite(o.s) : o.type === 'rw' ? buildRoadworks(o.z) : o.type === 'cf' ? buildContraflow(o.z) : o.type === 'ov' ? buildOverpass(o.o) : buildOpening(o.o);
  for (const g of gs) { bendObj(g); g.traverse(m => { if (m.material && m.material.userData.arrow) arrowMats.add(m.material); }); scene.add(g); }
  applySign(gs);
  return gs;
}
function freeObj(gs){ dropSolids(gs); for (const g of gs) { g.traverse(m => { if (m.material) arrowMats.delete(m.material); }); dispose(g); } }
function updateWorld(){
  const lo = Math.floor((camU - BACK - 140)/CH), hi = Math.floor((camU + FWD + 340)/CH);
  for (const [i, g] of chunks) if (i < lo || i > hi) { dropSolids([g]); dispose(g); chunks.delete(i); }
  for (let i = lo; i <= hi; i++) if (!chunks.has(i)) { chunks.set(i, buildChunk(i)); applySign([chunks.get(i)]); }
  const a = camU - BACK - 200, b = camU + FWD + 500;
  for (const [o, gs] of built) if (o.u + o.r < a || o.u - o.r > b) { freeObj(gs); built.delete(o); if (o.type === 'site') o.s.bays = {'1': null, '-1': null}; }
  for (const o of OBJ) { if (o.u - o.r > b) break; if (o.u + o.r < a || built.has(o)) continue; built.set(o, buildObj(o)); }
}
function rebuildObjects(types){ for (const [o, gs] of [...built]) if (!types || types.includes(o.type)) { freeObj(gs); built.delete(o); } updateWorld(); }
function clearWorld(){ SOLIDS = []; for (const [, g] of chunks) dispose(g); chunks.clear(); for (const [, gs] of built) freeObj(gs); built.clear(); }
function placeGroups(){
  for (const [, g] of chunks) g.position.z = camU - g.userData.u0;
  for (const [, gs] of built) for (const g of gs) g.position.z = camU - g.userData.u0;
}

// ================================================================
// TRAFFIC
// ================================================================
let vehicles = [], rampers = [], locals = [], PLR = null;
const lanesOf = new Map();
const laneList = (d,l) => lanesOf.get(key(d,l)) || [];
const uOfV = v => v.sd*v.p;
function siteNearIdx(u){ let lo = 0, hi = RSITES.length; while (lo < hi) { const m = (lo + hi) >> 1; if (RSITES[m].u < u) lo = m + 1; else hi = m; } return lo; }
// nearest ramp site whose diverge is still ahead of the vehicle: t = centre-relative position along travel
function siteAhead(sd, p){ const u = sd*p, i = siteNearIdx(u);
  for (const j of sd > 0 ? [i - 1, i, i + 1] : [i, i - 1, i - 2]) { const s = RSITES[j]; if (!s) continue; const t = p - sd*s.u; if (t > -1300 && t < -150) return {s, t}; }
  return null; }
function plazaAhead(sd, front){ for (const s of PLAZAS) { const d = sd*s.u - front; if (d > -2 && d < 420) return {s, d}; } return null; }
function gapInfo(v, list){
  let lead=null, ld=Infinity, fol=null, fd=Infinity;
  for (const o of list){ if (o===v) continue;
    const d = o.p - v.p, gap = Math.abs(d) - (o.len+v.len)/2;
    if (d >= 0 && gap < ld){ ld = gap; lead = o; } else if (d < 0 && gap < fd){ fd = gap; fol = o; } }
  return {lead, ld, fol, fd};
}
function idm(v, lead, gap, v0){
  const a = v.player ? 2.2 : 1.4, b=2.2, s0=2.5, Th=1.3;
  let acc = a*(1-Math.pow(v.vel/Math.max(v0, 0.1),4));
  if (lead){ const sd = s0 + v.vel*Th + v.vel*(v.vel-lead.vel)/(2*Math.sqrt(a*b)); acc -= a*Math.pow(sd/Math.max(gap,0.1),2); }
  return Math.max(acc, -9);
}
function gapsOK(v, nl, relaxed){
  const g = gapInfo(v, laneList(v.sd, nl)), dv = g.fol ? Math.max(0, g.fol.vel - v.vel) : 0;
  if (relaxed) { const need = v.vel < 4 ? 1.5 : 4 + v.vel*0.25; return g.ld > need && g.fd > need + dv*0.8 ? g : null; }
  return g.ld > 8 && g.fd > 6 + dv*2.5 ? g : null;
}
function transitionOK(v, nl){
  const z = cfAt(v.sd, v.p); if (!z) return nl >= 0 || false;
  if (v.lane === -1 && nl === 0) return v.p - z.CF_OUT >= 0 && v.p - z.CF_OUT < 40;
  if (v.lane === 0 && nl === -1) return !heavy(v) && v.p - z.CF_IN >= 0 && v.p - z.CF_IN < 30;
  return true;
}
function tryNormal(v, nl){
  const n = nAvail(v.sd, v.p);
  if (nl < 0 || nl >= n) return null;
  if (heavy(v) && nl < heavyMin(n)) return null;
  const front = v.p + v.len/2;
  if (!spanFree(v.sd, nl, v.p - v.len/2 - 3, front + 3) || blockAhead(v.sd, nl, front) < 500) return null;
  return gapsOK(v, nl, false);
}
function mandatory(v, bd, front){
  const n = nAvail(v.sd, v.p), c = v.lane < 0 ? [v.lane+1] : [v.lane-1, v.lane+1].filter(nl => nl >= 0 && nl < n);
  // score a neighbouring lane by the best lane reachable through it, so several lanes ending together still funnel toward the open one
  const reach = nl => { let best = 0; for (let l = nl; l >= 0 && l < n; l += Math.sign(nl - v.lane)) best = Math.max(best, blockAhead(v.sd, l, front)); return best; };
  const opts = c.map(nl => [nl, v.lane < 0 ? blockAhead(v.sd, nl, front) : reach(nl)]).filter(([nl, b]) => v.lane < 0 || b > bd + 15).sort((a,b) => b[1]-a[1]);
  for (const [nl] of opts) {
    if (!transitionOK(v, nl)) continue;
    if (!spanFree(v.sd, nl, v.p - v.len/2 - 2, front + 2)) continue;
    if (gapsOK(v, nl, true)) { v.lane = nl; return; }
  }
}
function discretionary(v, lead, nearEntry){
  if (v.lane < 0) {
    for (const nl of [v.lane-1, v.lane+1]) { if (nl > -1 || !laneExists(v.sd, nl, v.p)) continue;
      const g = gapsOK(v, nl, false); if (g && idm(v, g.lead, g.ld, v.v0e) > v.acc + 0.25) { v.lane = nl; return; } }
    return;
  }
  if (nearEntry) {
    if (v.lane === 0) { if (transitionOK(v, -1) && spanFree(v.sd, -1, v.p - v.len/2 - 2, v.p + v.len/2 + 2) && gapsOK(v, -1, true)) v.lane = -1; return; }
    if (tryNormal(v, v.lane-1)) v.lane--;
    return;
  }
  const right = tryNormal(v, v.lane-1);
  if (right && idm(v, right.lead, right.ld, v.v0e) > v.acc + 0.4 && lead && lead.vel < v.v0-2) { v.lane--; return; }
  const left = tryNormal(v, v.lane+1);
  if (left && idm(v, left.lead, left.ld, v.v0e) > v.acc - 0.15 && left.ld > 40) v.lane++;
}
function pickType(lane, n, p, sd){
  if (p != null && !isToll(sd*p)) { const t = Math.random(), outer = lane === n - 1;
    return outer ? (t < .38 ? 'moto' : t < .5 ? 'van' : t < .62 ? 'truck' : t < .67 ? 'bus' : t < .85 ? 'car' : 'suv') : (t < .5 ? 'car' : t < .75 ? 'suv' : t < .9 ? 'van' : 'moto'); }
  const t = Math.random(), outer = lane >= n - 2 && lane >= heavyMin(n);
  let type = lane === 0 ? (t<.2?'suv':'car') : outer ? (t<.3?'truck':t<.4?'bus':t<.55?'van':t<.78?'suv':'car') : (t<.1?'van':t<.4?'suv':'car');
  if (heavy({type}) && lane < heavyMin(n)) type = 'car'; return type; }
function addVehicle(sd, lane, p, type, vel){
  const v = makeVehicle(type);
  if (lane === 0) v.v0 = Math.min(v.v0 + 2, 27.7);
  Object.assign(v, {sd, lane, lx: lane, p, vel: vel ?? v.v0*0.85, cd: rnd(0, 4), yaw: 0, cfWant: !heavy(v) && Math.random() < 0.65});
  v.x = posX(-sd, lane); scene.add(v.g); vehicles.push(v); return v;
}
function windowP(sd){ const lo = camU - BACK, hi = camU + FWD; return sd > 0 ? [lo, hi] : [-hi, -lo]; }
function oneWayB(sd, p){ return CFA.some(z => z.oneWay && z.B === sd && p > z.bStart - 1500 && p < z.bEnd + 240); }
// a toll road ending into a narrower non-toll road ahead: through traffic stays on the toll road in reality, so it leaves the scene
function funnelAhead(sd, p){ for (const s of PLAZAS) { if (!((s.kind === 'te' && sd > 0) || (s.kind === 'ti' && sd < 0))) continue; const d = sd*s.u - p; if (d > -60 && d < 900) return true; } return false; }
function spawnOK(sd, lane, p, len){ return !funnelAhead(sd, p) && spanFree(sd, lane, p - len/2 - 3, p + len/2 + 3) && blockAhead(sd, lane, p) > 80 && !oneWayB(sd, p); }
function fillTraffic(){
  vehicles.filter(v => !v.player).forEach(killVehicle); vehicles = vehicles.filter(v => v.player);
  for (const sd of [1, -1]) { const [lo, hi] = windowP(sd);
    for (let lane = 0; lane < 5; lane++) { let p = lo + rnd(0, 20);
      while (p < hi - 10) { const n = nAvail(sd, p);
        if (lane >= n) { p += 30; continue; }
        const type = pickType(lane, n, p, sd), len = type === 'truck' ? 16 : type === 'bus' ? 12.5 : 6;
        if (!spawnOK(sd, lane, p, len) || (PLR && PLR.sd === sd && PLR.lane === lane && Math.abs(PLR.p - p) < 30)) { p += 12; continue; }
        const v = addVehicle(sd, lane, p, type); p += v.len + rnd(18, 60)/cfg.den; } } }
}
let spawnT = 0;
function maintainTraffic(dt){
  spawnT -= dt; if (spawnT > 0) return; spawnT = 0.25;
  for (const sd of [1, -1]) { const [lo, hi] = windowP(sd);
    for (let lane = 0; lane < 5; lane++) {
      const L = vehicles.filter(v => v.sd === sd && v.lane === lane);
      for (const [edge, p] of [['up', lo + 6], ['down', hi - 6]]) {
        const n = nAvail(sd, p); if (lane >= n) continue;
        let near = null, gap = Infinity; for (const o of L) { const g2 = Math.abs(o.p - p) - o.len/2; if (g2 < gap) { gap = g2; near = o; } }
        const want = 10 + rnd(18, 60)/cfg.den;
        if (gap < want) continue;
        const type = pickType(lane, n, p, sd), len = type === 'truck' ? 16 : type === 'bus' ? 12.5 : 6;
        if (!spawnOK(sd, lane, p, len)) continue;
        const vel = near ? Math.min(near.vel + (edge === 'up' ? 1 : -1), 27) : undefined;
        addVehicle(sd, lane, p, type, vel); } } }
}

// ---------- ramps ----------
let entryT = 0;
function rampFrame(s){ return {pc: 0, e: MED + Math.round(nAt(s.u))*LW, shift: SC}; }
function toRamp(v, site, kind){
  const e = MED + Math.round(nAt(site.u))*LW, t = v.p - v.sd*site.u, u0 = t + SC, head = [[-1.8, u0], [1.8, Math.min(u0 + 25, 48)]];
  let raw, end = 'merge', park = null, mergeAt = 300;
  if (kind === 'r') { const occ = site.bays[v.sd] || (site.bays[v.sd] = STATIC.map(x => x ? 'static' : null)), free = occ.map((_, i) => i).filter(i => !occ[i]);
    if (free.length && (v.player || Math.random() < 0.75)) { const i = pick(free); occ[i] = v; raw = restPath('out', BAYS[i]); park = {i, t: v.player ? Infinity : rnd(10, 35)}; } else raw = restPath('out'); }
  else if (kind === 'j') { let side = Math.random() < 0.5 ? 'outA' : 'outC';
    if (v.player) { v.rampEdge = rampEdge(site); side = v.rampEdge && v.rampEdge.turn === 'Kanan' ? 'outC' : 'outA'; }
    raw = ssPath(side, e); end = 'kill'; }
  else { raw = trOut(); end = 'pr'; }
  v.rp = {P: mkPath([...head, ...raw]), d: 0, i: 0, pc: v.sd*site.u, sd: v.sd, e, shift: SC, end, park, kind, site, mergeAt};
  v.exitWant = false; v.q = pathAt(v.rp.P, 0, 0);
  rm(vehicles, v); rampers.push(v);
}
function toDetour(v, z){
  const e = MED + z.n*LW, t = v.p - z.bStart, len = z.bEnd - z.bStart, n = nAvail(v.sd, v.p), o0 = -1.8 - (n - 1 - Math.max(0, v.lane))*LW;
  let rest = detourOut().filter(q => q[1] > t + 30);
  if (rest.length < 4) rest = [[8, t + 30], [40, t + 55], [120, t + 80], [220, t + 98], [PR_IN, t + 112]];
  v.rp = {P: mkPath([[o0, t], [Math.max(o0 + 3.6, 1.8), t + 25], ...rest, ...detourIn(len)]), d: 0, i: 0, pc: z.bStart, sd: v.sd, e, shift: 0, end: 'merge', kind: 'detour', mergeAt: len + 226};
  v.exitWant = false; v.detour = null; v.q = pathAt(v.rp.P, 0, 0);
  rm(vehicles, v); rampers.push(v);
}
function capAt(v, q){ const k = v.rp.kind;
  if (k === 'r' && q.o > 26 && q.u > 112 && q.u < 242) return 5;
  if (k === 'x' && Math.abs(q.o - GATE_O) < 14 && Math.abs(q.u - SC) < 6) return 3.5;
  if (k === 'x' && q.o > PRC - 30) return 7;
  if (k === 'detour' && q.o > PRC - 30) return 13;
  return q.o < 3 ? 22 : 11.1; }
function tryMerge(v){
  const sd = v.rp.sd, p = v.rp.pc + v.q.u - v.rp.shift, n = nAvail(sd, p), front = p + v.len/2;
  const outerFree = spanFree(sd, n-1, p - v.len/2 - 2, front + 2), nl = outerFree ? n-1 : n-2;
  if (v.player && !cfg.auto) { v.p = p; rm(rampers, v); Object.assign(v, {sd, lane: n - 1, lx: n - 0.4, rp: null, siteId: null, yaw: 0}); v.x = posX(-sd, v.lx); vehicles.push(v); toast('Masuk jalur utama'); hudLane(); return; }
  if (nl < 0 || (heavy(v) && nl < heavyMin(n))) return;
  v.p = p;
  if (!spanFree(sd, nl, p - v.len/2 - 2, front + 2) || blockAhead(sd, nl, front) < 40) return;
  if (!gapsOK(v, nl, v.rp.P.len - v.rp.d < 30)) return;
  rm(rampers, v);
  Object.assign(v, {sd, lane: nl, lx: n, cd: rnd(2,4), yaw: 0, cfWant: false, exitWant: false, rp: null, siteId: null});
  v.x = posX(-sd, n); vehicles.push(v);
  if (v.player) { toast('Bergabung ke jalur utama'); hudLane(); }
}
function rampStep(dt){
  for (const v of rampers) { if (v.rp.parked) { v.acc = 0; continue; }
    const q = v.q, su = v.rp.pc + q.u - v.rp.shift; let gap = Infinity, lead = null;
    for (const o of rampers) { if (o === v || o.rp.sd !== v.rp.sd || o.rp.parked) continue;
      const du = (o.rp.pc + o.q.u - o.rp.shift) - su, dO = o.q.o - q.o, d = dO*q.ho + du*q.hu;
      if (d > 0 && d < 40 && Math.abs(dO*q.hu - du*q.ho) < 2.2 && Math.abs((o.q.h||0) - (q.h||0)) < 3) { const g2 = d - (v.len + o.len)/2; if (g2 < gap) { gap = g2; lead = o; } } }
    const cap = capAt(v, q); let acc = idm(v, lead, gap, cap);
    if (v.rp.park || v.rp.end === 'merge') acc = Math.min(acc, idm(v, STOP, v.rp.P.len - v.rp.d - (v.rp.park ? 0.1 : 1), cap));
    if (v.player && v.rp.kind === 'x' && !v.rp.paid) { const dg = GATE_O - 1 - q.o; if (dg > -1 && q.u > 170) acc = Math.min(acc, idm(v, STOP, Math.max(0, dg) + 2, cap)); }
    if (v.player && !cfg.auto) acc = playerAcc(v, dt);
    v.acc = acc; }
  for (const v of [...rampers]) { const rp = v.rp;
    if (rp.parked) { rp.park.t -= dt; if (rp.park.t <= 0) { const occ = rp.site.bays[rp.sd]; if (occ) occ[rp.park.i] = null; rp.P = mkPath(restPath('leave', BAYS[rp.park.i])); rp.d = 0; rp.i = 0; rp.parked = false; rp.park = null; if (v.player) { setRest(false); toast('Keluar dari rest area'); } } continue; }
    v.vel = v.player && !cfg.auto ? Math.min((VEH[v.type] || VEH.car).vmax, Math.max(-5, v.vel + v.acc*dt)) : Math.max(0, v.vel + v.acc*dt); rp.d = Math.max(0, rp.d + v.vel*dt);
    for (const w of v.wh) w.rotation.x += v.vel*dt / v.r;
    const q = v.q = pathAt(rp.P, rp.d, rp.i); rp.i = q.i;
    v.p = rp.pc + q.u - rp.shift;
    if (v.player && !cfg.auto) { v.x = -rp.sd*(rp.e + q.o); playerCollide(v); }
    if (v.player && rp.kind === 'x' && !rp.paid && q.o > GATE_O - 5 && q.u > 170 && Math.abs(v.vel) < 0.5) { rp.paid = true; payToll(rp.site); }
    if (v.player && rp.kind === 'x' && !rp.paid && q.o > GATE_O + 3 && q.u > 170) { rp.paid = true; violation('menerobos gerbang tol'); }
    if (rp.park && rp.d >= rp.P.len - 0.3) { rp.parked = true; v.vel = 0; if (v.player) setRest(true); }
    else if (rp.end === 'merge' && q.u >= rp.mergeAt) tryMerge(v);
    else if (rp.d >= rp.P.len) { rm(rampers, v);
      if (v.player) { finishExit(rp.site); continue; }
      if (rp.end === 'pr') { const pr = {kind:'pr', side: rp.sd, dir: Math.random() < 0.5 ? 1 : -1, lane: 0, u: rp.sd*v.p, vel: rnd(12, 15), g: v.g, wh: v.wh, r: v.r, len: v.len, type: v.type}; v.g.rotation.y = 0; locals.push(pr); }
      else killVehicle(v); } }
  // vehicles entering from interchanges and detours
  entryT -= dt;
  if (entryT <= 0) { entryT = rnd(0.8, 2.6)/Math.sqrt(cfg.den);
    const cand = RSITES.filter(s => s.kind !== 'r' && Math.abs(s.u - camU) < 900);
    for (const c of CFA) if (c.oneWay && Math.abs(c.B*c.bEnd - camU) < 900) cand.push({cf: c});
    if (cand.length) { const s = pick(cand);
      const sd = s.cf ? s.cf.B : pick([1, -1]), t = Math.random(), v = makeVehicle(t<.12?'truck':t<.18?'bus':t<.3?'van':t<.55?'suv':'car');
      let rp;
      if (s.cf) { const z = s.cf, len = z.bEnd - z.bStart; rp = {P: cachedPath('dIn' + len, () => detourIn(len)), d: 0, i: 0, pc: z.bStart, sd, e: MED + z.n*LW, shift: 0, end: 'merge', kind: 'detour', mergeAt: len + 226}; }
      else { const e = MED + Math.round(nAt(s.u))*LW;
        const jk = Math.random() < 0.5 ? 'inC' : 'inB';
        rp = {P: s.kind === 'j' ? cachedPath(jk + e, () => ssPath(jk, e)) : cachedPath('trIn', trIn), d: 0, i: 0, pc: sd*s.u, sd, e, shift: SC, end: 'merge', kind: s.kind, site: s, mergeAt: s.kind === 'j' && jk === 'inC' ? 340 : 300}; }
      const u0 = rp.P.pts[0][1];
      if (rampers.length < 90 && !rampers.some(o => o.rp.sd === sd && o.rp.pc === rp.pc && o.rp.kind === rp.kind && Math.hypot(o.q.u - u0, o.q.o - rp.P.pts[0][0]) < 25)) {
        Object.assign(v, {vel: 12, rp}); v.q = pathAt(rp.P, 0, 0); v.p = rp.pc + v.q.u - rp.shift; scene.add(v.g); rampers.push(v); }
      else killVehicle(v); } }
  // drop far-away ramp vehicles
  for (const v of [...rampers]) if (!v.player && Math.abs(v.rp.sd*v.p - camU) > 1100) { rm(rampers, v); killVehicle(v); }
}

// ---------- main sim step ----------
const EXIT_P = {x: 0.13, j: 0.15, r: 0.07};
let mergeReq = [];
function sim(dt){
  const reqs = mergeReq; mergeReq = [];
  lanesOf.clear();
  const reg = (k, v) => { let a = lanesOf.get(k); if (!a) lanesOf.set(k, a = []); a.push(v); };
  for (const v of vehicles){ if (v.player && !cfg.auto) continue; reg(key(v.sd, v.lane), v); }
  if (PLR && !PLR.rp && !cfg.auto && vehicles.includes(PLR)) { const v = PLR, z = cfAt(v.sd, v.p);
    for (const l of new Set([Math.floor(v.lx), Math.ceil(v.lx)])) {
      if (l >= 0 || (z && z.A === v.sd && -l <= z.k)) reg(key(v.sd, l), v);
      else { const j = -l - 1; reg(key(-v.sd, j), {p: -v.sd*uOfV(v), vel: 0, len: v.len, lane: j, lx: j, phantom: true}); } } }
  for (const v of vehicles){
    const front = v.p + v.len/2, n = nAvail(v.sd, v.p), manual = v.player && !cfg.auto;
    // interchange decisions
    const sa = siteAhead(v.sd, v.p);
    if (sa && v.siteId !== sa.s.id) { v.siteId = sa.s.id;
      if (v.player) v.exitWant = !!(cfg.auto && sa.s.i === trip.destIdx && sa.s.kind !== 'j');
      else v.exitWant = v.lane >= 0 && !(cfAt(v.sd, v.p) && v.cfWant) && (sa.s.kind !== 'r' || !heavy(v) || Math.random() < 0.5) && Math.random() < EXIT_P[sa.s.kind]; }
    const ow = CFA.find(z => z.oneWay && z.B === v.sd && z.bStart - v.p > 0 && z.bStart - v.p < 1200);
    v.detour = ow && (!v.player || cfg.auto) ? ow : null;
    let {lead, ld} = gapInfo(v, laneList(v.sd, v.lane));
    for (const r of reqs) if (r.v !== v && r.v.sd === v.sd && r.lane === v.lane) { const g2 = r.v.p - v.p - (r.v.len + v.len)/2; if (g2 > -1 && g2 < 18 && g2 < ld) { ld = Math.max(g2, 0.1); lead = r.v; } }
    const z = cfAt(v.sd, v.p), nearEntry = !!z && v.cfWant && !v.player && v.lane >= 0 && z.CF_IN + 30 - v.p >= 0 && z.CF_IN + 30 - v.p < 260;
    const limU = Math.min(limitAt(uOfV(v)), limitAt(uOfV(v) + v.sd*250));
    let v0 = Math.min(v.player ? limU - 0.6 : Math.min(v.v0, limU + 1), zoneCap(v.sd, front) - (v.player ? 0.6 : 0));
    if (v.lane < 0 || v.lx < 0 || (nearEntry && v.lane === 0)) v0 = Math.min(v0, 16.7);
    const pz = plazaAhead(v.sd, front);
    if (pz && v.paid !== pz.s.id) { v0 = Math.min(v0, Math.sqrt(25 + 1.2*Math.max(0, pz.d))); }
    v.v0e = v0;
    if (manual) { v.acc = playerAcc(v, dt); steerPlayer(v, dt); }
    else {
      v.acc = idm(v, lead, ld, v0);
      if (pz && v.paid !== pz.s.id) v.acc = Math.min(v.acc, idm(v, STOP, pz.d + 2.0, v0));
      // traffic lights: stop on red, and on amber unless too close to stop safely
      const la = lightAhead(v.sd, front);
      if (la) { const st = sigMain(la.s); if (st === 'R' || (st === 'Y' && la.d > Math.max(6, v.vel*v.vel/6))) v.acc = Math.min(v.acc, idm(v, STOP, la.d + 2.2, v0)); }
    }
    const bd = blockAhead(v.sd, v.lane, front);
    if (!manual && bd < Infinity) v.acc = Math.min(v.acc, idm(v, STOP, bd - 1.5, v0));
    if (pz && v.paid !== pz.s.id && pz.d < 2.5 && v.vel < 0.6) { v.payT = (v.payT || 0) + dt; if (v.payT > (v.player ? 0.9 : 1.2)) { v.paid = pz.s.id; v.payT = 0; if (v.player) payToll(pz.s); } }
    if (manual) continue;
    if (pz && pz.d < 150) continue;   // no lane changes in front of the toll plaza
    { const la = lightAhead(v.sd, front); if (la && la.d < 40) continue; }
    const mustD = v.lane < 0 ? 120 + 60*(-v.lane-1) : 450;
    v.cd -= dt;
    if (bd < mustD || nearEntry) v.cd = Math.min(v.cd, 0.2);
    if (v.cd > 0 || Math.abs(v.lx - v.lane) > 0.05) continue;
    v.cd = rnd(1.5, 4);
    if (bd < mustD) { v.cd = 0.25; const was = v.lane; mandatory(v, bd, front);
      if (v.lane === was && bd < 60 && v.vel < 3 && v.lane >= 0) { const n2 = nAvail(v.sd, v.p), opts = [v.lane - 1, v.lane + 1].filter(l => l >= 0 && l < n2 && blockAhead(v.sd, l, front) >= bd);
        if (opts.length) mergeReq.push({v, lane: opts[0]}); }
      continue; }
    if ((v.exitWant && sa) || v.detour) { const t = v.detour ? v.p - v.detour.bStart : sa.t, lim = v.detour ? [-1150, -236] : [v.player ? -1250 : -360, -158];
      if (t > lim[0] && t < lim[1] && v.lane >= 0) { v.cd = 0.5; const nl = v.lane + 1;
        if (nl < n && spanFree(v.sd, nl, v.p - v.len/2 - 3, front + 3) && blockAhead(v.sd, nl, front) > 80 && gapsOK(v, nl, t > lim[1] - 120)) v.lane = nl;
        continue; } }
    if (v.player && cfg.auto && v.lane === 0 && n > 1 && Math.random() < 0.3) { if (tryNormal(v, 1)) { v.lane = 1; continue; } }
    discretionary(v, lead, nearEntry);
  }
  for (const v of vehicles){
    const man = v.player && !cfg.auto;
    if (man) { v.vel = Math.min((VEH[v.type] || VEH.car).vmax, Math.max(-5, v.vel + v.acc*dt)); v.p += v.vel*dt; }
    else {
      v.vel = Math.max(0, v.vel + v.acc*dt);
      let step = v.vel*dt;
      const bd = blockAhead(v.sd, v.lane, v.p + v.len/2);
      if (step > bd - 0.5) { step = Math.max(0, bd - 0.5); v.vel = 0; }
      v.p += step;
      if (v.player) { const g = gapInfo(v, laneList(v.sd, v.lane)); if (g.lead && g.ld < 0) { v.p -= Math.min(step, -g.ld + 0.2); if (v.vel - g.lead.vel > 2 && Math.abs(g.lead.lx - g.lead.lane) < 0.05) crash('Tabrakan dari belakang'); v.vel = Math.min(v.vel, g.lead.vel*0.7); } }
      const crossing = (v.lane === -1 && v.lx > -1) || (v.lane === 0 && v.lx < 0);
      v.lx += Math.sign(v.lane - v.lx) * Math.min(Math.abs(v.lane - v.lx), dt*(crossing ? 0.7 : v.player ? 0.8 : 0.45));
    }
    const x = posX(-v.sd, v.lx), lat = (x - v.x)/dt; v.x = x;
    v.yaw += (Math.atan2(lat*Math.sign(v.vel || 1), Math.max(Math.abs(v.vel), 1)) - v.yaw) * Math.min(1, dt*6);
    for (const w of v.wh) w.rotation.x += v.vel*dt / v.r;
  }
  if (PLR && !cfg.auto && vehicles.includes(PLR)) playerCollide(PLR);
  for (let i = vehicles.length-1; i >= 0; i--) { const v = vehicles[i];
    if (v.player && !(cfg.auto && (v.exitWant || v.detour))) continue;
    if (v.detour && !v.player && v.p - v.detour.bStart > -420 && Math.abs(v.sd*v.p - camU) > 330) { rm(vehicles, v); killVehicle(v); continue; }
    if (v.detour && Math.abs(v.lx - v.lane) < 0.05) { const t = v.p - v.detour.bStart, outer = v.lane === nAvail(v.sd, v.p) - 1;
      if ((outer && t >= -330 && t <= -236) || (t > -236 && t < -40 && v.vel < 3)) { toDetour(v, v.detour); continue; } }
    if (v.exitWant) {
      const s = RSITES.find(s2 => s2.id === v.siteId); if (!s) continue; const t = v.p - v.sd*s.u;
      if (t > -150) { v.exitWant = false; continue; }
      if (v.lane === nAvail(v.sd, v.p) - 1 && Math.abs(v.lx - v.lane) < 0.05 && t >= -175 && t <= -155) toRamp(v, s, s.kind); } }
  for (let i = vehicles.length-1; i >= 0; i--) { const v = vehicles[i]; if (v.player) continue; const [lo, hi] = windowP(v.sd);
    if (v.p < lo - 60 || v.p > hi + 60 || (Math.abs(v.sd*v.p - camU) > 260 && funnelAhead(v.sd, v.p))) { vehicles.splice(i, 1); killVehicle(v); } }
}

// ---------- parallel roads & overpasses ----------
let prT = 0;
function simLocals(dt){
  for (const v of locals) { v.u += v.dir*v.vel*dt; for (const w of v.wh) w.rotation.x += v.vel*dt / v.r; }
  for (let i = locals.length - 1; i >= 0; i--) { const v = locals[i]; if (v.u < camU - BACK - 80 || v.u > camU + FWD + 80) { locals.splice(i, 1); killVehicle(v); } }
  prT -= dt; if (prT <= 0) { prT = 0.4;
    for (const side of [1, -1]) for (const dir of [1, -1]) for (let lane = 0; lane < 2; lane++) {
      const L = locals.filter(v => v.side === side && v.dir === dir && v.lane === lane), up = dir > 0 ? camU - BACK : camU + FWD;
      if (!isToll(up)) continue;
      const near = L.reduce((m, v) => Math.min(m, Math.abs(v.u - up)), Infinity);
      const diverted = CFA.some(z => z.oneWay && z.B === side*1 && side === dir && Math.abs(z.B*z.bStart - camU) < 1500);
      const k = (MOBILE ? 0.7 : 1)*cfg.den*(diverted ? 2.5 : 1);
      if (near < 12 + rnd(10, 70)/k) continue;
      const t = Math.random(); let type = lane === 1 ? (t<.45?'moto':t<.6?'van':t<.72?'truck':t<.78?'bus':'car') : (t<.6?'car':t<.85?'suv':'van');
      const v = makeVehicle(type); Object.assign(v, {kind:'pr', side, dir, lane, u: up + dir*rnd(0, 6), vel: (lane === 0 ? rnd(14, 16.5) : rnd(10, 12))*(diverted ? 0.6 : 1)});
      scene.add(v.g); locals.push(v); } }
  for (const [o, gs] of built) for (const g of gs) {
    if (g.userData.cross) simCross(g, dt);
    if (g.userData.fly) for (const v of g.userData.fly) { v.p += v.vel*dt; const m = mod(v.p, v.W2); v.g.position.set(v.dx > 0 ? -v.W2/2 + m : v.W2/2 - m, DECK_H + 0.71, v.zz); for (const w of v.wh) w.rotation.x += v.vel*dt / v.r; }
    if (g.userData.ov) for (const v of g.userData.ov) { v.p += v.vel*dt; const m = mod(v.p, v.span), x = v.dx > 0 ? -v.span/2 + m : v.span/2 - m; v.g.position.set(x, ovHeight(x, v.e), v.zz); for (const w of v.wh) w.rotation.x += v.vel*dt / v.r; }
  }
}

// ---------- placement ----------
function place(){
  for (const v of vehicles){ const u = v.sd*v.p, z = camU - u;
    v.g.position.set(v.x, 0, z); v.g.rotation.y = (v.sd > 0 ? Math.PI : 0) - v.yaw*v.sd; v.g.visible = Math.abs(z) < 900; }
  for (const v of rampers){ const q = v.q; if (!q) continue; const rp = v.rp, u = rp.sd*v.p, z = camU - u;
    v.x = -rp.sd*(rp.e + q.o); v.g.position.set(v.x, q.h || 0, z);
    v.g.rotation.y = Math.atan2(-rp.sd*q.ho, -rp.sd*q.hu); v.g.visible = Math.abs(z) < 900; }
  for (const v of locals){ const z = camU - v.u, out = v.dir === v.side; v.g.visible = isToll(v.u);
    v.g.position.set(-v.side*(eAt(v.u) + PRC + (out ? 1 : -1)*(1.75 + v.lane*3.5)), 0, z); v.g.rotation.y = v.dir > 0 ? Math.PI : 0; }
}

// ================================================================
// PLAYER
// ================================================================
const VEH = {car:{label:'Sedan', vmax:52, acc:3.2, gol:'Gol I', rate:1000}, suv:{label:'SUV', vmax:48, acc:2.8, gol:'Gol I', rate:1000},
  bus:{label:'Bus', vmax:33, acc:1.3, gol:'Gol I', rate:1000}, truck:{label:'Truk', vmax:28, acc:0.9, gol:'Gol III', rate:1650}};
const input = {gas:false, brake:false, left:false, right:false};
const stats = {t0: 0, toll: 0, viol: 0, crashes: 0, lastPay: 0, missed: false, done: false, log: []};
let offT = 0, shoulderT = 0, speedT = 0, heavyT = 0, violCd = 0, crashCd = 0, shake = 0;
function spawnPlayer(){
  if (PLR) { const i = vehicles.indexOf(PLR); if (i >= 0) vehicles.splice(i, 1); const j = rampers.indexOf(PLR); if (j >= 0) rampers.splice(j, 1); killVehicle(PLR); }
  const v = makeVehicle(cfg.veh, 0xec3013); v.player = true;
  const o = EV[0], n = nAvail(1, 0), startP = o.kind === 't' || o.kind === 'g' ? 160 : o.kind === 'k' || o.kind === 'n0' ? 30 : 320;
  Object.assign(v, {sd: 1, lane: Math.max(0, n - 1), p: startP, vel: o.kind === 'k' || o.kind === 'n0' ? 8 : 16, cd: 0, yaw: 0, cfWant: false, v0: limitAt(startP)});
  v.lx = v.lane; v.x = posX(-1, v.lane); v.paid = o.kind === 't' || o.kind === 'g' ? o.id : null;
  scene.add(v.g); vehicles.push(v); PLR = v; camU = startP;
}
function playerAcc(v, dt){
  const spec = VEH[v.type] || VEH.car;
  if (input.brake) {
    if (v.vel > 0.3) { input.brakeT = 0; return -7.5; }
    input.brakeT = (input.brakeT || 0) + dt;                        // hold the brake at a standstill to reverse
    return input.brakeT > 0.6 ? (v.vel > -5 ? -1.6 : 0) : -v.vel/dt;
  }
  input.brakeT = 0;
  if (input.gas) return v.vel < -0.2 ? 6 : spec.acc*(1 - Math.pow(Math.max(0, v.vel)/spec.vmax, 2));
  return v.vel > 0.05 ? -0.25 - 0.0004*v.vel*v.vel : v.vel < -0.05 ? 0.8 : -v.vel/dt;
}
// lateral room for the player: guard rail and median barrier on toll roads, buildings and the far kerb on national roads
function lxBounds(v){
  const u = uOfV(v), toll = isToll(u), e = eAt(u), c = MED + LW/2, nn = Math.round(nAt(u));
  const inTown = !toll && townNear(u);
  let hi = toll ? (e + 1.7 - c)/LW : (e + (inTown ? 4.4 : 7.5) - c)/LW, lo = -nn - 0.35;
  const sa = siteAhead(v.sd, v.p);
  if (toll && sa && sa.t > -280 && sa.t < -100) hi += 1.6;          // gap in the guard rail at the exit
  if (toll) { const atOpen = OPENS.some(o => o.cf && cfg.cf && Math.abs(o.u - u) < OPEN_HW - 4);
    if (!atOpen) { if (v.lx < -0.5) hi = Math.min(hi, -0.71); else lo = -0.29; } }
  return [lo, hi];
}
function steerPlayer(v, dt){
  const st = (input.left ? 1 : 0) - (input.right ? 1 : 0), rate = 1.15*Math.min(1, Math.abs(v.vel)/8);
  let lx = v.lx + st*rate*dt;
  const [lo, hi] = lxBounds(v), fast = Math.abs(v.vel) > 6;
  if (lx > hi) { lx = hi; if (st > 0 && fast) { crash(isToll(uOfV(v)) ? 'Menyerempet pagar pengaman' : townNear(uOfV(v)) ? 'Menabrak bangunan di tepi jalan' : 'Masuk parit di tepi jalan'); v.vel *= 0.8; } }
  if (lx < lo) { lx = lo; if (st < 0 && fast) { crash(isToll(uOfV(v)) ? 'Menyerempet median beton' : 'Keluar badan jalan'); v.vel *= 0.8; } }
  v.lx = lx; v.lane = Math.round(lx);
  // leaving the road on the left: exit ramp, rest area, detour or turn at an intersection
  const n = nAvail(v.sd, v.p), front = v.p + v.len/2;
  if (lx > n - 1 + 0.65 && v.vel > 0) {
    const sa = siteAhead(v.sd, v.p);
    if (sa && sa.t > -250 && sa.t < -110) { toRamp(v, sa.s, sa.s.kind); toast(sa.s.kind === 'r' ? `Masuk ${sa.s.name}` : sa.s.kind === 'j' ? `Masuk ramp ${nodeLabel(sa.s)}` : `Keluar di ${sa.s.name}`); hudLane(); return; }
    const ow = CFA.find(z => z.oneWay && z.B === v.sd && v.p - z.bStart > -330 && v.p - z.bStart < -40);
    if (ow) { toDetour(v, ow); toast('Pengalihan lewat Jalan Nasional'); hudLane(); return; }
    const ks = KSITES.find(k => { const d = v.sd*k.u - SL - front; return d > -4 && d < 25; });
    if (ks && lx > n - 1 + 1.1) { const le = leftEdge(ks);
      if (!le) { v.lx = n - 1 + 0.6; toast('Tidak ada jalan ke kiri di simpang ini', 'warn'); return; }
      if (sigMain(ks) === 'R') violation('menerobos lampu merah');
      if (ks.i === trip.destIdx) { stats.done = true; v.vel = 0; arrive(ks, le); } else continueFrom(ks, le); }
  }
}
const HW = {moto:0.4, car:0.92, suv:0.98, van:1.0, police:0.92, truck:1.25, bus:1.25};
// collisions from real positions, so side swipes, rear-ends and head-ons all count
function playerCollide(v){
  const onRamp = !!v.rp, uP = onRamp ? v.rp.sd*v.p : uOfV(v), hP = onRamp ? (v.q.h || 0) : 0, hwP = HW[v.type] || 1;
  const fwd = Math.sign((onRamp ? v.rp.sd : v.sd)*(v.vel || 1));
  const pushBack = d => { if (onRamp) { v.rp.d = Math.max(0, v.rp.d - d); v.q = pathAt(v.rp.P, v.rp.d, v.rp.i); v.p = v.rp.pc + v.q.u - v.rp.shift; } else v.p -= v.sd*fwd*d; };
  // other vehicles, on the main road and on ramps
  for (const o of vehicles.concat(rampers)) { if (o === v || o.x == null) continue;
    const ou = o.rp ? o.rp.sd*o.p : o.sd*o.p, oh = o.rp ? (o.q && o.q.h) || 0 : 0;
    const du = ou - uP; if (Math.abs(du) > 25 || Math.abs(oh - hP) > 2.5) continue;
    const dx = o.x - v.x, px = hwP + (HW[o.type] || 1) - Math.abs(dx), pu = (v.len + o.len)/2 - Math.abs(du);
    if (px <= 0 || pu <= 0) continue;
    const osd = o.rp ? o.rp.sd : o.sd, vsd = onRamp ? v.rp.sd : v.sd;
    if (!onRamp && px < pu*0.6) {
      v.lx += Math.sign(-dx || 1)*(px + 0.05)/(-v.sd*LW); v.lane = Math.round(v.lx); v.x = posX(-v.sd, v.lx);
      if (Math.abs(v.vel) > 1) crash('Tabrakan samping'); v.vel *= 0.85;
    } else if (osd !== vsd) { crash('Tabrakan adu banteng!'); pushBack(pu + 0.05); v.vel = 0; o.vel = 0; }
    else { const ahead = du*vsd > 0; if (Math.abs(v.vel - o.vel) > 1.5) crash(ahead ? 'Tabrakan dari belakang' : 'Ditabrak dari belakang');
      if (ahead === (v.vel >= 0)) pushBack(pu + 0.05); v.vel = ahead ? Math.min(v.vel, o.vel*0.6) : Math.max(v.vel, o.vel*0.6); } }
  if (onRamp) return;
  // cross-street traffic at intersections
  for (const [o, gs] of built) { if (o.type !== 'site' || o.s.kind !== 'k') continue; const s2 = o.s; if (Math.abs(s2.u - uP) > 40) continue;
    for (const g of gs) if (g.userData.cross) for (const c of g.userData.cross) {
      const cu = s2.u - c.g.position.z, cx = c.g.position.x, px = hwP + c.len/2 - Math.abs(cx - v.x), pu = v.len/2 + (HW[c.type] || 1) - Math.abs(cu - uP);
      if (px > 0 && pu > 0) { if (Math.abs(v.vel) > 1 || c.vel > 1) crash('Tabrakan di persimpangan'); pushBack(pu + 0.05); v.vel = 0; c.vel = 0; c.hold = 2.5; } } }
  // solid objects: plaza islands, works vehicles and barriers, poles
  for (const so of SOLIDS) { if (so.u1 < uP - 30 || so.u0 > uP + 30) continue;
    const pu = Math.min(uP + v.len/2, so.u1) - Math.max(uP - v.len/2, so.u0), px = Math.min(v.x + hwP, so.x1) - Math.max(v.x - hwP, so.x0);
    if (pu <= 0 || px <= 0) continue;
    if (Math.abs(v.vel) > 1) crash(so.name);
    if (px < pu*0.5) { const dirx = v.x > (so.x0 + so.x1)/2 ? 1 : -1; v.lx += dirx*(px + 0.05)/(-v.sd*LW); v.lane = Math.round(v.lx); v.x = posX(-v.sd, v.lx); v.vel *= 0.8; }
    else { pushBack(pu + 0.05); v.vel = 0; } }
}
function crash(msg){ if (crashCd > 0) return; crashCd = 3; stats.crashes++; shake = 0.6; toast(msg, 'bad'); stats.log.push(msg); }
const violAt = new Map();
function violation(msg){ const k = msg.split(' ')[0] + msg.length; if (clock - (violAt.get(k) ?? -99) < 10) return; violAt.set(k, clock); stats.viol++; toast('Pelanggaran: ' + msg, 'bad'); stats.log.push(msg); }
function payToll(s){
  if (s.kind === 'ti') { stats.lastPay = rkAt(PLR.sd*PLR.p); toast(`Tap masuk ${nodeLabel(s)}`); return; }
  const rk = rkAt(PLR.sd*PLR.p), km = Math.max(0, rk - stats.lastPay), rp = Math.max(500, Math.round(km*(VEH[cfg.veh] || VEH.car).rate/500)*500);
  stats.lastPay = rk; stats.toll += rp;
  toast(`Tap e-Toll ${nodeLabel(s)} · Rp ${rp.toLocaleString('id-ID')}`);
  if ((s.kind === 't' || s.kind === 'te') && s.i === trip.destIdx) { stats.done = true; setTimeout(() => arrive(s), 1200); }
}
function playerRules(dt){
  const v = PLR; if (!v || v.rp) return;
  violCd -= dt; crashCd -= dt;
  const lim = Math.min(limitAt(uOfV(v)), postedCap(v.sd, v.p + v.len/2), v.lane < 0 ? 16.7 : 99);
  speedT = Math.abs(v.vel) > lim + 1.4 ? speedT + dt : 0;
  if (speedT > 2.5) { violation(`melebihi batas ${KMH(lim)} km/j`); speedT = 0; }
  const n = nAvail(v.sd, v.p);
  heavyT = heavy(v) && v.lane >= 0 && v.lane < heavyMin(n) ? heavyT + dt : 0;
  if (heavyT > 5) { violation('kendaraan berat wajib di lajur kiri'); heavyT = 0; }
  const pz = plazaAhead(v.sd, v.p + v.len/2);
  if (!pz) for (const s of PLAZAS) { const d = v.sd*s.u - (v.p + v.len/2); if (d < -2 && d > -40 && v.paid !== s.id) { v.paid = s.id; violation('menerobos gerbang tol'); if ((s.kind === 't' || s.kind === 'te') && s.i === trip.destIdx) { stats.done = true; setTimeout(() => arrive(s), 1200); } } }
  const front = v.p + v.len/2;
  if (!cfg.auto) {
    const z = cfAt(v.sd, v.p), legitCf = z && z.A === v.sd && v.lane < 0 && -v.lane <= z.k;
    if (v.lx < -0.5 && !legitCf) violation('melawan arus');
    if (v.lx > n - 1 + 1.3) { offT += dt; if (offT > 1) { violation('keluar badan jalan'); offT = 0; } } else offT = 0;
    if (v.lx > n - 1 + 0.5 && v.lx <= n - 1 + 1.3 && !siteAhead(v.sd, v.p)) { shoulderT += dt; if (shoulderT > 2) { violation('berkendara di bahu jalan'); shoulderT = 0; } } else shoulderT = 0;
    if (isToll(uOfV(v)) && v.lx < -0.4 && v.lx > -0.8 && !(z && z.A === v.sd)) violation('melintasi putaran balik khusus petugas');
    const inBlock = v.lane >= 0 && v.lane < n && blockAhead(v.sd, v.lane, front) === 0;
    if (inBlock && !v.inBlock) { violation('masuk area pekerjaan jalan / lajur ditutup'); if (Math.abs(v.vel) > 3) { crash('Menabrak cone'); v.vel *= 0.7; } }
    v.inBlock = inBlock;
  }
  for (const s of KSITES) { const ls = v.sd*s.u - SL; if (v.lastFront != null && v.lastFront < ls && front >= ls && sigMain(s) === 'R') violation('menerobos lampu merah'); }
  v.lastFront = front;
  const dest = EV[trip.destIdx]; if (!dest || stats.done) return;
  if (dest.kind !== 'x' && dest.kind !== 't' && dest.kind !== 'te') { if (v.p >= dest.u - (dest.kind === 'k' ? SL : 0)) { stats.done = true; setTimeout(() => arrive(dest), 600); } return; }
  // missed the destination: recalculate from the next place the route can still change (GPS style)
  if (!stats.missed && v.p - dest.u > (dest.kind === 'x' ? -150 : 60)) { stats.missed = true; toast(`${dest.kind === 'x' ? 'Exit ' : ''}${dest.name} terlewat. Menghitung ulang rute…`, 'bad'); setNav(trip.dest, true); }
}

// ================================================================
// TIME OF DAY
// ================================================================
const TOD = {
  day:  {sky:0xb9c8d3, fog:[200,640], hemi:1.1, sun:2.4, sunCol:0xfff1dc, sunPos:[60,90,40], head:0.15, tail:0.3, lamp:0, bloom:0.15, exp:1.0, sign:0.12},
  dusk: {sky:0xd79a7a, fog:[90,420],  hemi:0.55, sun:1.6, sunCol:0xff9a5a, sunPos:[-120,25,-160], head:2, tail:1.5, lamp:1.2, bloom:0.55, exp:0.95, sign:0.35},
  night:{sky:0x0d1420, fog:[60,340],  hemi:0.12, sun:0.18, sunCol:0x8aa0ff, sunPos:[40,90,60], head:5, tail:3, lamp:4, bloom:1.0, exp:1.1, sign:0.55},
};
const sunOff = new THREE.Vector3(60,90,40);
const lampLights = [];
for (let i=0;i<(MOBILE?4:6);i++){ const p = new THREE.PointLight(0xffc98a, 0, 40, 1.6); scene.add(p); lampLights.push(p); }
function setTod(k){
  const t = TOD[k]; scene.background.set(t.sky); scene.fog.color.set(t.sky); scene.fog.near=t.fog[0]; scene.fog.far=t.fog[1];
  hemi.intensity=t.hemi; sun.intensity=t.sun; sun.color.set(t.sunCol); sunOff.set(...t.sunPos);
  headMat.emissiveIntensity=t.head; tailMat.emissiveIntensity=t.tail; lampHeadMat.emissiveIntensity=t.lamp; lampI = t.lamp*60;
  bloom.strength = MOBILE ? t.bloom*0.7 : t.bloom; renderer.toneMappingExposure=t.exp; signI = t.sign; applySign();
  ground.material.color.set(k==='night'?0x2c3a24:0x6f8a4a);
}
function applySign(list){ const f = o => { if (o.material && o.material.userData && o.material.userData.sign) o.material.emissiveIntensity = signI; };
  if (list) list.forEach(g => g.traverse(f)); else scene.traverse(f); }

// ================================================================
// CAMERA
// ================================================================
const tmpV = new THREE.Vector3(), focus = new THREE.Vector3(), headV = new THREE.Vector3(0,0,-1), pPos = new THREE.Vector3();
let camMode = cfg.cam;
function setCam(m){ camMode = m; controls.enabled = m === 'orbit'; controls.autoRotate = false;
  if (m === 'orbit') { camera.position.set(pPos.x - 30, 18, pPos.z + 30); controls.target.copy(pPos); } }
function fovFor(base){ const a = camera.aspect; return a < 1.3 ? Math.min(75, 2*Math.atan(Math.tan(base*Math.PI/360)*1.3/a)*180/Math.PI) : base; }
function updateCam(dt){
  const v = PLR; if (!v) return;
  pPos.copy(v.g.position);
  const hy = v.g.rotation.y, hd = tmpV.set(Math.sin(hy), 0, Math.cos(hy));
  headV.lerp(hd, Math.min(1, dt*3)).normalize();
  const shk = shake > 0 ? (shake -= dt, (Math.random() - 0.5)*shake) : 0;
  if (camMode === 'chase') {
    const want = new THREE.Vector3().copy(pPos).addScaledVector(headV, -13); want.y = (v.q ? v.q.h || 0 : 0) + 4.4;
    camera.position.lerp(want, Math.min(1, dt*5)); camera.position.x += shk;
    camera.lookAt(pPos.x + headV.x*20, 1.4 + (v.q ? v.q.h || 0 : 0), pPos.z + headV.z*20); camera.fov = fovFor(58);
  } else if (camMode === 'cockpit') {
    const h = (v.type === 'bus' || v.type === 'truck') ? 2.6 : v.type === 'suv' ? 1.6 : 1.3;
    camera.position.copy(pPos).addScaledVector(headV, v.len*0.12); camera.position.y = h + (v.q ? v.q.h || 0 : 0); camera.position.x += -v.sd*0.35 + shk;
    camera.lookAt(camera.position.x + headV.x*30, camera.position.y - 0.6, camera.position.z + headV.z*30); camera.fov = fovFor(66);
  } else if (camMode === 'drone') {
    const pt = camera.aspect < 1, want = new THREE.Vector3().copy(pPos).addScaledVector(headV, pt ? -38 : -48); want.y = (pt ? 24 : 32) + Math.sin(clock*0.2)*3; want.x += Math.sin(clock*0.15)*(pt ? 8 : 18);
    camera.position.lerp(want, Math.min(1, dt*2)); camera.lookAt(pPos.x + headV.x*(pt ? 30 : 20), 0, pPos.z + headV.z*(pt ? 30 : 20)); camera.fov = fovFor(50);
  } else if (camMode === 'ic') {
    const s = RSITES.concat(PLAZAS, KSITES).reduce((b, s2) => !b || Math.abs(s2.u - camU) < Math.abs(b.u - camU) ? s2 : b, null);
    const cz = s ? camU - s.u : -100, cx = s && RAMPK.has(s.kind) ? -(eAt(s.u) + 75) : 0, a = clock*0.06, r = camera.aspect < 1 ? 210 : 170;
    camera.position.set(cx + bendAt(cz) + r*Math.cos(a), camera.aspect < 1 ? 190 : 130, cz + r*Math.sin(a)); camera.lookAt(cx + bendAt(cz), 0, cz); camera.fov = fovFor(50);
  } else if (camMode === 'dbg') { const d = window.__tjCam; camera.position.set(d[0], d[1], d[2]); camera.lookAt(d[3], d[4], d[5]); camera.fov = d[6] || 55;
  } else { controls.target.lerp(pPos, Math.min(1, dt*4)); controls.update(); camera.fov = fovFor(50); }
  camera.updateProjectionMatrix();
  camera.getWorldDirection(tmpV); focus.copy(camera.position).addScaledVector(tmpV, 50); focus.y = 0;
  sun.target.position.copy(focus); sun.position.copy(focus).add(sunOff);
  const fu = camU - focus.z, base = Math.round(fu/45)*45, lamps = [];
  for (let k = -2; k <= 2; k++) { const u = base + k*45; if (OPENS.some(o => Math.abs(o.u - u) < OPEN_HW + 3)) continue; lamps.push(u); }
  lamps.sort((a, b) => Math.abs(a - fu) - Math.abs(b - fu));
  lampLights.forEach((l, i) => { const u = lamps[i >> 1] ?? base, z = camU - u; l.position.set((i % 2 ? 3.6 : -3.6) + bendAt(z), 10, z); l.intensity = lampI; });
}
function flash(){
  const ph = Math.floor(clock*5) % 2;
  polRed.emissiveIntensity = ph ? 6 : 0.2; polBlue.emissiveIntensity = ph ? 0.2 : 6;
  const on = Math.floor(clock*1.6) % 2 ? 1.2 : 0.15; for (const m of arrowMats) m.emissiveIntensity = on;
  amberMat.emissiveIntensity = Math.floor(clock*2.4) % 2 ? 3 : 0.3;
  brakeMat.emissiveIntensity = PLR && (input.brake || (PLR.acc < -1.5)) ? 6 : tailMat.emissiveIntensity;
}

// ================================================================
// UI
// ================================================================
const $ = id => document.getElementById(id);
const PLACES = placeList();
let toastT = null;
function toast(msg, kind=''){ const el = $('toast'); el.textContent = msg; el.className = 'show ' + kind; clearTimeout(toastT); toastT = setTimeout(() => el.className = '', 2600); }
function hudAuto(){ $('auto').setAttribute('aria-pressed', cfg.auto ? 'true' : 'false'); document.body.classList.toggle('auto', cfg.auto); }
function hudLane(){ const v = PLR; if (!v) return; const n = Math.round(nAvail(v.sd, v.p)), el = $('lanes'); el.innerHTML = '';
  const neg = []; for (const z of CFA) if (z.A === v.sd && Math.abs(v.p - z.o1) < 900) for (let j = z.k; j >= 1; j--) neg.push(-j);
  const all = [...Array.from({length: n}, (_, i) => n - 1 - i), ...neg.sort((a, b) => b - a)];
  for (const l of all) { const d = document.createElement('i'); if (l < 0) d.className = 'cf'; if (v.rp ? false : l === v.lane) d.className += ' on'; el.append(d); } }
let rest = false;
function setRest(on){ rest = on; $('resume').hidden = !on; if (on) toast('Parkir di rest area. Tekan "Lanjut perjalanan" saat siap.'); }
function nextEvents(){
  const u = uOfV(PLR), out = [];
  for (let i = Math.max(0, evAt(u)); i < EV.length && out.length < 4; i++) { const e = EV[i]; if (e.u < u - 120) continue; if (e.origin || (e.kind === 'n0' && i !== trip.destIdx)) continue;
    out.push({e, d: Math.max(0, e.rk - rkAt(u))}); }
  return out;
}
const ICON = {x:'EXIT', j:'JCT', r:'REST', g:'GT', t:'GT', te:'GT', ti:'GT', k:'KOTA', n0:'•'};
let hudT = 0;
function updateHud(dt){
  hudT -= dt; if (hudT > 0 || !PLR) return; hudT = 0.15;
  const v = PLR, u = uOfV(v), rk = rkAt(u), dest = EV[trip.destIdx];
  $('spd').textContent = v.vel < -0.3 ? 'R ' + KMH(-v.vel) : KMH(Math.abs(v.vel));
  const lim = Math.min(limitAt(u), postedCap(v.sd, v.p + v.len/2), v.lane < 0 ? 16.7 : 99);
  const limK = Math.round(KMH(lim)/10)*10; if ($('lim').dataset.v !== String(limK)) { $('lim').dataset.v = limK; $('lim').textContent = limK; }
  $('spdbox').classList.toggle('over', v.vel > lim + 1.4);
  $('corr').textContent = CORR[corrAt(u)].name;
  $('kmpost').textContent = `KM ${kmAt(u).toFixed(1).replace('.', ',')}`;
  $('left').textContent = !dest ? 'Bebas' : stats.done ? 'Tiba' : fmtKm(Math.max(0, dest.rk - rk));
  updateChoice(u);
  $('toll').textContent = 'Rp ' + stats.toll.toLocaleString('id-ID');
  $('viol').textContent = stats.viol; $('crash').textContent = stats.crashes;
  const ne = nextEvents(), list = $('next'); list.innerHTML = '';
  for (const {e, d} of ne) { const li = document.createElement('li'); if (e.i === trip.destIdx) li.className = 'dest';
    const tag = document.createElement('b'); tag.textContent = e.i === trip.destIdx ? 'TUJUAN' : ICON[e.kind]; tag.className = 'k-' + e.kind;
    const nm = document.createElement('span'); nm.textContent = e.kind === 'te' ? `${e.name} (keluar tol)` : e.kind === 'ti' ? `${e.name} (masuk tol)` : e.kind === 'j' ? nodeLabel(e).replace('Simpang Susun ', '') + (e.turn ? ` → ${CORR[e.cNext].short}` : '') : e.kind === 'r' || e.kind === 'x' ? e.name : nodeLabel(e).replace('Gerbang Tol ', 'GT ');
    const dd = document.createElement('em'); dd.textContent = fmtKm(d); li.append(tag, nm, dd); list.append(li); }
  // instruction line
  const sa = siteAhead(v.sd, v.p); let ins = '';
  if (v.rp) ins = v.rp.parked ? 'Parkir di rest area' : v.rp.kind === 'x' ? 'Di ramp keluar. Berhenti di gerbang tol.' : v.rp.kind === 'detour' ? 'Pengalihan lewat Jalan Nasional' : 'Di ramp';
  else if (!cfg.auto && v.lx < -0.5 && !(cfAt(v.sd, v.p) && cfAt(v.sd, v.p).A === v.sd)) ins = 'Anda melawan arus!';
  else if (!cfg.auto && v.lx > nAvail(v.sd, v.p) - 1 + 1.3) ins = 'Anda keluar badan jalan';
  else if (!cfg.auto && v.lx > nAvail(v.sd, v.p) - 1 + 0.5 && !(sa && sa.t > -280)) ins = 'Anda di bahu jalan';
  else if (sa && sa.s.i === trip.destIdx && sa.s.kind === 'x') ins = sa.t > -270 ? '← Arahkan ke kiri sekarang untuk keluar' : `Exit tujuan ${fmtKm(-(sa.t + 150)/1000*cfg.scale)} lagi. Ambil lajur paling kiri.`;
  else if (sa && sa.s.kind === 'r' && sa.t > -270) ins = '← Arahkan ke kiri sekarang untuk masuk rest area';
  else if (lightAhead(v.sd, v.p + v.len/2) && lightAhead(v.sd, v.p + v.len/2).d < 140) { const la = lightAhead(v.sd, v.p + v.len/2), st = sigMain(la.s);
    ins = st === 'R' ? `Lampu merah di ${la.s.name}: berhenti di garis stop (${Math.round(la.d)} m)` : st === 'Y' ? 'Lampu kuning: bersiap berhenti' : `Lampu hijau di ${la.s.name}${la.s.i === trip.destIdx ? ' · tujuan Anda' : ''}`; }
  else { const bd = blockAhead(v.sd, v.lane, v.p + v.len/2), z = cfAt(v.sd, v.p);
    const ow = CFA.find(z => z.oneWay && z.B === v.sd && v.p - z.bStart > -700 && v.p - z.bStart < -236);
    if (ow) ins = v.p - ow.bStart > -330 ? '← Jalan ditutup: belok kiri ke pengalihan sekarang' : 'Jalan ditutup (one way). Ambil lajur paling kiri untuk pengalihan.';
    else if (bd < 450) ins = v.lane < 0 ? `Contraflow berakhir ${Math.round(bd)} m lagi. Kembali ke jalur kiri.` : `Lajur berakhir/ditutup ${Math.round(bd)} m lagi. Pindah lajur!`;
    else if (z && v.lane === 0 && v.p < z.CF_IN + 30 && v.p > z.CF_IN - 250) ins = 'Contraflow: tekan → di bukaan median untuk masuk';
    else { const nj = ne.find(x => x.e.turn || (x.e.end && x.e.cNext !== x.e.c && x.e.kind !== 'te' && x.e.kind !== 'ti')); if (nj && nj.d < 6) ins = `${nj.e.kind === 'k' ? 'Di ' + nj.e.name + ', jalan' : 'Lurus'} terus ke ${CORR[nj.e.cNext].name}`; } }
  $('ins').textContent = ins; $('ins').hidden = !ins;
  hudLane();
}

// ---------- mini-map ----------
const map = $('map'), mctx = map.getContext('2d');
let mapBig = false;
function drawMap(){
  const dpr = Math.min(2, devicePixelRatio), W = map.clientWidth, H = map.clientHeight; if (!W) return;
  if (map.width !== Math.round(W*dpr)) { map.width = Math.round(W*dpr); map.height = Math.round(H*dpr); }
  const x = mctx; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
  const cs = getComputedStyle(document.body), ink = cs.getPropertyValue('--color-text').trim() || '#201e1d', acc = cs.getPropertyValue('--color-accent').trim() || '#ec3013';
  let lon0 = 105.2, lon1 = 114.7, lat0 = -5.7, lat1 = -8.9;
  if (mapBig && PLR) { const u = uOfV(PLR), p = latLonAt(u); lon0 = p.lon - 0.9; lon1 = p.lon + 0.9; const h = 1.8*H/W; lat0 = p.lat + h/2; lat1 = p.lat - h/2; }
  const sx = Math.min(W/(lon1 - lon0), H/Math.abs(lat1 - lat0)), ox = (W - sx*(lon1 - lon0))/2, oy = (H - sx*Math.abs(lat1 - lat0))/2;
  const P = (lat, lon) => [ox + (lon - lon0)*sx, oy + (lat0 - lat)*sx];
  x.fillStyle = 'rgba(32,30,29,0.06)'; x.beginPath(); JAVA.forEach(([lo, la], i) => { const [a, b] = P(la, lo); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); x.fill();
  x.lineWidth = 1.5; x.strokeStyle = 'rgba(32,30,29,0.45)';
  for (const c of CORRIDORS) { if (c.cls === 'a') continue; x.lineWidth = c.cls === 'n' ? 1 : 1.5; x.strokeStyle = c.cls === 'n' ? 'rgba(138,90,40,0.55)' : 'rgba(32,30,29,0.45)'; x.setLineDash(c.planned ? [3, 3] : []); x.beginPath(); c.nodes.forEach((n, i) => { const N = NODES.get(n.key); const [a, b] = P(N.lat, N.lon); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.stroke(); }
  x.setLineDash([]);
  if (trip) { const i0 = PLR ? Math.max(0, evAt(uOfV(PLR))) : 0, i1 = trip.destIdx >= 0 ? trip.destIdx : Math.min(EV.length - 1, i0 + 60);
    x.lineWidth = 3; x.strokeStyle = acc; x.beginPath(); EV.slice(i0, i1 + 1).forEach((e, i) => { const [a, b] = P(e.lat, e.lon); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.stroke();
    const d = EV[trip.destIdx]; if (d) { const [dx, dy] = P(d.lat, d.lon); x.fillStyle = ink; x.fillRect(dx - 3, dy - 3, 6, 6); }
    if (PLR) { const p = latLonAt(uOfV(PLR)), [px, py] = P(p.lat, p.lon); x.fillStyle = acc; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(px, py, 5, 0, Math.PI*2); x.fill(); x.stroke(); } }
  x.fillStyle = ink; x.font = '600 9px Archivo, sans-serif';
  const labels = mapBig ? [...new Set(EV.filter(e => e.city && e.kind !== 'n0').map(e => e.key))].map(k => NODES.get(k)) : ['JCT Cawang','GT Banyumanik','JCT Waru','Merak','JCT Pasir Koja','GT Palimanan','Colomadu','Malang','Ketapang'].map(k => NODES.get(k));
  for (const n of labels) { if (!n) continue; const [a, b] = P(n.lat, n.lon); if (a < 0 || b < 0 || a > W || b > H) continue; x.fillText(n.city || n.name, a + 4, b - 3); }
}
function latLonAt(u){ const i = evAt(u); if (i < 0) return EV[0]; if (i >= EV.length - 1) return EV[EV.length - 1];
  const a = EV[i], b = EV[i+1], f = clamp((u - a.u)/(b.u - a.u), 0, 1); return {lat: a.lat + (b.lat - a.lat)*f, lon: a.lon + (b.lon - a.lon)*f}; }
map.onclick = () => openAtlas();

// ---------- full-screen atlas: every road of the network, pan / zoom / search / navigate ----------
const NET = {t: CORRIDORS.filter(c => c.cls === 't'), n: CORRIDORS.filter(c => c.cls === 'n'), a: CORRIDORS.filter(c => c.cls === 'a')};
const NAVABLE = [...NODES.values()].filter(n => edgesFrom(n.key).length);
const NAV_COUNT = NAVABLE.length;
const NET_SUMMARY = `${NET.t.length} ruas tol, ${NET.n.length} ruas jalan nasional, ${NET.a.length} jalan akses, ${NAVABLE.filter(n => n.kind === 'k').length} kota, ${NAVABLE.filter(n => n.kind === 'j').length} simpang susun, ${NAVABLE.filter(n => n.kind === 'x' || n.kind === 't' || n.kind === 'g').length} gerbang tol`;
const KIND_NAME = {x: 'Gerbang tol (exit)', t: 'Gerbang tol (ujung tol)', g: 'Gerbang tol utama', j: 'Simpang susun', r: 'Rest area', k: 'Kota / persimpangan'};
const KIND_TAG = {x: 'EXIT', t: 'GT', g: 'GT', j: 'JCT', r: 'REST', k: 'KOTA'};
const atlas = $('atlas'), acv = $('atlas-map'), actx = acv.getContext('2d');
const COSL = Math.cos(7.2*Math.PI/180);
const AT = {lon: 110, lat: -7.2, k: 100, sel: null, W: 0, H: 0, kMin: 40, kMax: 9000};
const atP = (lat, lon) => [AT.W/2 + (lon - AT.lon)*AT.k*COSL, AT.H/2 + (AT.lat - lat)*AT.k];
const atInv = (x, y) => ({lon: AT.lon + (x - AT.W/2)/(AT.k*COSL), lat: AT.lat - (y - AT.H/2)/AT.k});
const nodeLL = key => NODES.get(key);
let atRaf = 0;
const reqAtlas = () => { if (!atRaf) atRaf = requestAnimationFrame(() => { atRaf = 0; drawAtlas(); }); };
function atSize(){ const W = acv.clientWidth, H = acv.clientHeight, dpr = Math.min(2, devicePixelRatio);
  if (acv.width !== Math.round(W*dpr) || acv.height !== Math.round(H*dpr)) { acv.width = Math.round(W*dpr); acv.height = Math.round(H*dpr); }
  AT.W = W; AT.H = H; AT.kMin = Math.min(W/(10.5*COSL), H/4.5); return dpr; }
function playerLL(){ if (!PLR || !trip) return null; const u = uOfV(PLR), p = latLonAt(u), i = Math.max(0, evAt(u)), nx = EV[Math.min(EV.length - 1, i + 1)];
  return {...p, hd: Math.atan2((nx.lon - p.lon)*COSL, nx.lat - p.lat)}; }
function openAtlas(){
  atlas.hidden = false; atSize();
  if (!AT.opened) { AT.opened = true; const p = playerLL(); if (p) { AT.lon = p.lon; AT.lat = p.lat; } AT.k = clamp(AT.W/(2.6*COSL), AT.kMin, AT.kMax); }
  legendText(); drawAtlas();
}
function closeAtlas(){ atlas.hidden = true; $('at-res').hidden = true; $('at-q').blur(); }
function legendText(){
  $('lg-t').textContent = `Jalan tol · ${NET.t.length} ruas`; $('lg-n').textContent = `Jalan nasional · ${NET.n.length} ruas`; $('lg-a').textContent = `Jalan akses gerbang tol · ${NET.a.length}`;
  const d = trip && EV[trip.destIdx];
  $('at-nav').textContent = d ? `Navigasi ke ${d.name} · ${fmtKm(Math.max(0, d.rk - rkAt(uOfV(PLR))))}` : 'Rute di depan (keliling bebas)';
}
function zoomAt(x, y, f){ const p = atInv(x, y); AT.k = clamp(AT.k*f, AT.kMin, AT.kMax); const q = atInv(x, y); AT.lon += p.lon - q.lon; AT.lat += p.lat - q.lat; reqAtlas(); }
function drawAtlas(){
  if (atlas.hidden) return;
  const dpr = atSize(), x = actx, W = AT.W, H = AT.H, k = AT.k; x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.fillStyle = '#d5e2ea'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#f4f1ea'; x.strokeStyle = '#9fb3bf'; x.lineWidth = 1.2; x.beginPath(); JAVA.forEach(([lo, la], i) => { const [a, b] = atP(la, lo); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); x.fill(); x.stroke();
  const inView = (a, b, m = 40) => a > -m && b > -m && a < W + m && b < H + m;
  const line = (c) => { x.beginPath(); c.nodes.forEach((n, i) => { const N = nodeLL(n.key); const [a, b] = atP(N.lat, N.lon); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.stroke(); };
  x.lineCap = 'round'; x.lineJoin = 'round';
  const z = Math.log2(k/100);   // 0 = whole island
  x.setLineDash([4, 4]); x.strokeStyle = 'rgba(80,88,94,0.75)'; x.lineWidth = clamp(0.6 + z*0.35, 0.6, 2.2); for (const c of NET.a) line(c);
  x.setLineDash([]); x.strokeStyle = '#a0682e'; x.lineWidth = clamp(1 + z*0.6, 1, 4.5); for (const c of NET.n) line(c);
  for (const c of NET.t) { x.setLineDash(c.planned ? [7, 5] : []); x.strokeStyle = '#fff'; x.lineWidth = clamp(2.4 + z*0.9, 2.4, 8); line(c); x.strokeStyle = c.planned ? '#6d6a66' : '#201e1d'; x.lineWidth = clamp(1.4 + z*0.7, 1.4, 6); line(c); }
  x.setLineDash([]);
  // the route ahead (navigation or free driving plan)
  const acc = '#ec3013';
  if (trip && PLR) { const u = uOfV(PLR), i0 = Math.max(0, evAt(u)), i1 = trip.destIdx >= 0 ? trip.destIdx : Math.min(EV.length - 1, i0 + 80), p = latLonAt(u);
    x.strokeStyle = acc; x.globalAlpha = 0.85; x.lineWidth = clamp(3 + z*0.8, 3, 9); x.beginPath(); const [a0, b0] = atP(p.lat, p.lon); x.moveTo(a0, b0);
    for (const e of EV.slice(i0 + 1, i1 + 1)) { const [a, b] = atP(e.lat, e.lon); x.lineTo(a, b); } x.stroke(); x.globalAlpha = 1; }
  // nodes + labels (priority order, no overlaps)
  const show = n => n.kind === 'j' ? z > 0.6 : n.kind === 'k' ? (n.city && n.city === n.name ? true : z > 0.9) : n.kind === 'r' ? z > 3.2 : z > 1.6;
  const pts = [];
  for (const n of NODES.values()) { if (n.lat == null || !show(n)) continue; const [a, b] = atP(n.lat, n.lon); if (!inView(a, b)) continue; pts.push({n, a, b}); }
  for (const {n, a, b} of pts) { x.fillStyle = n.kind === 'k' ? '#fff' : n.kind === 'j' ? '#0c6a3c' : n.kind === 'r' ? '#0d3b7a' : '#f2c230'; x.strokeStyle = '#201e1d'; x.lineWidth = 1.2;
    const r = n.kind === 'k' ? clamp(2.5 + z*0.6, 2.5, 5.5) : clamp(2 + z*0.5, 2, 5);
    x.beginPath(); if (n.kind === 'j') x.rect(a - r, b - r, 2*r, 2*r); else x.arc(a, b, r, 0, Math.PI*2); x.fill(); x.stroke(); }
  const pri = n => n.kind === 'k' && n.city === n.name ? 0 : n.kind === 'j' ? 2 : n.kind === 'k' ? 1 : n.kind === 'r' ? 4 : 3;
  const boxes = []; x.textBaseline = 'middle';
  for (const {n, a, b} of pts.sort((p, q) => pri(p.n) - pri(q.n))) {
    const big = pri(n) === 0, txt = n.kind === 'j' ? n.name : n.kind === 'x' || n.kind === 't' || n.kind === 'g' ? (n.name.startsWith('GT ') ? n.name : 'GT ' + n.name) : n.name;
    x.font = `${big ? 800 : 600} ${big ? 13 : 11}px Archivo, sans-serif`; const w = x.measureText(txt).width + 4, h = big ? 15 : 13;
    const bx = [a + 7, b - h/2, w, h];
    if (boxes.some(q => bx[0] < q[0] + q[2] && bx[0] + bx[2] > q[0] && bx[1] < q[1] + q[3] && bx[1] + bx[3] > q[1])) continue;
    boxes.push(bx); x.lineWidth = 3; x.strokeStyle = 'rgba(244,241,234,0.92)'; x.strokeText(txt, a + 8, b); x.fillStyle = n.kind === 'j' ? '#0c6a3c' : '#201e1d'; x.fillText(txt, a + 8, b); }
  // destination and player
  const d = trip && EV[trip.destIdx]; if (d) { const [a, b] = atP(d.lat, d.lon); x.fillStyle = acc; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(a, b); x.lineTo(a, b - 22); x.lineTo(a + 13, b - 17); x.lineTo(a, b - 12); x.stroke(); x.fill(); }
  const sel = AT.sel && nodeLL(AT.sel); if (sel) { const [a, b] = atP(sel.lat, sel.lon); x.strokeStyle = acc; x.lineWidth = 3; x.beginPath(); x.arc(a, b, 11, 0, Math.PI*2); x.stroke(); }
  const pl = playerLL(); if (pl) { const [a, b] = atP(pl.lat, pl.lon); x.save(); x.translate(a, b); x.rotate(pl.hd); x.fillStyle = acc; x.strokeStyle = '#fff'; x.lineWidth = 2.5;
    x.beginPath(); x.moveTo(0, -12); x.lineTo(8, 9); x.lineTo(0, 4); x.lineTo(-8, 9); x.closePath(); x.stroke(); x.fill(); x.restore(); }
  // scale bar
  const kmPx = k/111, nice = [1, 2, 5, 10, 20, 50, 100, 200].find(v => v*kmPx > 60) || 200; x.fillStyle = '#201e1d'; x.fillRect(W - 20 - nice*kmPx, H - 22, nice*kmPx, 3);
  x.font = '600 11px Archivo, sans-serif'; x.textAlign = 'right'; x.fillText(`${nice} km`, W - 20, H - 32); x.textAlign = 'left';
  legendText();
}
// tap: nearest place, otherwise nearest road
function atTap(px, py){
  let best = null, bd = 18;
  for (const n of NODES.values()) { if (n.lat == null) continue; const [a, b] = atP(n.lat, n.lon), d = Math.hypot(a - px, b - py); if (d < bd) { bd = d; best = n; } }
  if (best) return showNode(best.key);
  let road = null, rd = 10, near = null;
  for (const c of CORRIDORS) for (let i = 0; i < c.nodes.length - 1; i++) { const A = nodeLL(c.nodes[i].key), B = nodeLL(c.nodes[i+1].key);
    const [ax, ay] = atP(A.lat, A.lon), [bx, by] = atP(B.lat, B.lon), dx = bx - ax, dy = by - ay, L = dx*dx + dy*dy || 1, f = clamp(((px - ax)*dx + (py - ay)*dy)/L, 0, 1), d = Math.hypot(ax + dx*f - px, ay + dy*f - py);
    if (d < rd) { rd = d; road = c; near = f < 0.5 ? c.nodes[i] : c.nodes[i+1]; } }
  if (road) return showRoad(road, near);
  AT.sel = null; $('at-card').hidden = true; reqAtlas();
}
function cardActions(key){
  const act = $('at-act'); act.innerHTML = '';
  const add = (t, f, pri) => { const b = document.createElement('button'); b.textContent = t; if (pri) b.className = 'pri'; b.onclick = f; act.append(b); };
  if (key && edgesFrom(key).length && trip && trip.dest !== key) add('Navigasi ke sini', () => { if (setNav(key)) { $('at-card').hidden = true; drawAtlas(); } }, true);
  if (trip && trip.dest) add('Hapus navigasi', () => { clearNav(); $('at-card').hidden = true; drawAtlas(); });
  if (key && edgesFrom(key).length) add('Mulai keliling dari sini', () => { closeAtlas(); $('done').hidden = true; startDrive({from: key}); });
}
function showNode(key){
  const n = nodeLL(key); AT.sel = key;
  $('at-title').textContent = n.kind === 'j' ? nodeLabel(n) : n.name;
  const roads = [...n.corr].map(id => CORR[id]).filter(c => c.cls !== 'a').map(c => (c.cls === 'n' ? 'Jl. Nasional ' : 'Tol ') + c.short);
  const acc = [...n.corr].map(id => CORR[id]).filter(c => c.cls === 'a').map(c => c.nodes.find(q => q.key !== key)).map(q => (q.kind === 'k' ? 'kota ' : 'GT ') + q.name);
  let info = `${KIND_NAME[n.kind] || ''}${n.city && n.city !== n.name ? ' · ' + n.city : ''}. ${roads.join(', ')}${acc.length ? '. Akses: ' + acc.join(', ') : ''}.`;
  if (PLR && trip && edgesFrom(key).length) { const u = uOfV(PLR), i = replanIdx(u), e = EV[i], legs = e.key === key ? [] : legsFor(e.key, null, key, prevKeyOf(e));
    if (legs) { const km = Math.max(0, e.rk - rkAt(u)) + legs.reduce((a, l) => a + Math.abs(CORR[l.c].nodes.find(q => q.key === l.b).km - CORR[l.c].nodes.find(q => q.key === l.a).km), 0);
      const h = legHours(legs) + Math.max(0, e.rk - rkAt(u))/70;
      info += ` Dari posisi Anda ±${fmtKm(km)} (±${h >= 1.5 ? Math.round(h) + ' jam' : Math.max(1, Math.round(h*60)) + ' menit'} nyata).`; } }
  if (!edgesFrom(key).length) info += ' Rest area tidak bisa dijadikan tujuan; masuk saat lewat.';
  $('at-info').textContent = info; cardActions(key); $('at-card').hidden = false; reqAtlas();
}
function showRoad(c, near){
  AT.sel = near.key;
  const km = Math.abs(c.nodes[c.nodes.length - 1].km - c.nodes[0].km);
  $('at-title').textContent = c.cls === 'a' ? c.name : (c.cls === 'n' ? 'Jalan Nasional ' : '') + c.name;
  $('at-info').textContent = `${c.cls === 't' ? 'Jalan tol' : c.cls === 'n' ? 'Jalan nasional' : 'Jalan akses'} · ${fmtKm(km)} · ${c.lanes} lajur per arah · batas ${c.limit} km/jam${c.planned ? ' · rencana' : ''}. ${c.nodes[0].name} – ${c.nodes[c.nodes.length - 1].name}, ${c.nodes.filter(q => q.kind !== 'r').length} titik. Terdekat: ${near.name}.`;
  cardActions(edgesFrom(near.key).length ? near.key : null); $('at-card').hidden = false; reqAtlas();
}
// pointer: drag = pan, two fingers = pinch zoom, tap = select
const ptrs = new Map(); let moved = 0, pinch = null;
acv.addEventListener('pointerdown', e => { acv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x: e.offsetX, y: e.offsetY}); if (ptrs.size === 1) moved = 0; acv.classList.add('drag');
  if (ptrs.size === 2) { const [p, q] = [...ptrs.values()]; pinch = {d: Math.hypot(p.x - q.x, p.y - q.y), mx: (p.x + q.x)/2, my: (p.y + q.y)/2}; } });
acv.addEventListener('pointermove', e => { const o = ptrs.get(e.pointerId); if (!o) return; const dx = e.offsetX - o.x, dy = e.offsetY - o.y; o.x = e.offsetX; o.y = e.offsetY;
  if (ptrs.size === 1) { moved += Math.abs(dx) + Math.abs(dy); AT.lon -= dx/(AT.k*COSL); AT.lat += dy/AT.k; reqAtlas(); }
  else if (ptrs.size === 2 && pinch) { moved = 99; const [p, q] = [...ptrs.values()], d = Math.hypot(p.x - q.x, p.y - q.y), mx = (p.x + q.x)/2, my = (p.y + q.y)/2;
    AT.lon -= (mx - pinch.mx)/(AT.k*COSL); AT.lat += (my - pinch.my)/AT.k; zoomAt(mx, my, d/(pinch.d || d)); pinch = {d, mx, my}; } });
const ptrUp = e => { if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
  if (!ptrs.size) { acv.classList.remove('drag'); if (moved < 7 && e.type === 'pointerup') atTap(e.offsetX, e.offsetY); } };
for (const t of ['pointerup', 'pointercancel']) acv.addEventListener(t, ptrUp);
acv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY*(e.deltaMode ? 0.05 : 0.0018))); }, {passive: false});
$('at-in').onclick = () => zoomAt(AT.W/2, AT.H/2, 1.6); $('at-out').onclick = () => zoomAt(AT.W/2, AT.H/2, 1/1.6);
$('at-me').onclick = () => { const p = playerLL(); if (p) { AT.lon = p.lon; AT.lat = p.lat; AT.k = Math.max(AT.k, 400); reqAtlas(); } };
$('at-close').onclick = closeAtlas;
// search every place of the network
const norm = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
$('at-q').oninput = () => { const q = norm($('at-q').value.trim()), ul = $('at-res'); ul.innerHTML = '';
  if (q.length < 2) { ul.hidden = true; return; }
  const hits = [...NODES.values()].filter(n => n.lat != null && (norm(n.name).includes(q) || (n.city && norm(n.city).includes(q))))
    .sort((a, b) => (norm(b.name).startsWith(q) - norm(a.name).startsWith(q)) || ((a.kind === 'k' ? 0 : 1) - (b.kind === 'k' ? 0 : 1)) || a.name.localeCompare(b.name)).slice(0, 14);
  for (const n of hits) { const li = document.createElement('li'), b = document.createElement('button'), t = document.createElement('b'), sp = document.createElement('span'), sm = document.createElement('small');
    t.textContent = KIND_TAG[n.kind] || '•'; sp.textContent = n.kind === 'j' ? nodeLabel(n) : n.name;
    sm.textContent = [...n.corr].map(id => CORR[id]).filter(c => c.cls !== 'a').map(c => c.short).join(' · '); sp.append(sm);
    b.append(t, sp); b.onclick = () => { ul.hidden = true; AT.lon = n.lon; AT.lat = n.lat; AT.k = Math.max(AT.k, 700); showNode(n.key); }; li.append(b); ul.append(li); }
  if (!hits.length) { const li = document.createElement('li'); li.style.padding = '10px'; li.textContent = 'Tidak ditemukan'; ul.append(li); }
  ul.hidden = false; };
$('at-q').onkeydown = e => { if (e.key === 'Enter') { const b = $('at-res').querySelector('button'); if (b) b.click(); } };

// ---------- settings panel ----------
const hud = $('top'), ctrl = $('ctrl');

$('toggle').onclick = () => hud.classList.toggle('open');
function curN(){ return PLR ? Math.round(nAvail(1, PLR.p)) : 4; }
function rowsSpec(){
  const n = 5, laneOpts = Array.from({length:n}, (_,i) => [i+1, `Lajur ${i+1}`]);
  return [
    ['cam', 'Kamera', [['chase','Belakang'],['cockpit','Kokpit'],['drone','Drone'],['ic','Simpang susun'],['orbit','Orbit']]],
    ['den', 'Lalu lintas', [[0.6,'Sepi'],[1,'Normal'],[1.7,'Padat'],[2.6,'Macet']]],
    ['tod', 'Waktu', [['day','Siang'],['dusk','Senja'],['night','Malam']]],
    ['lanes', 'Lajur tol', [['auto','Sesuai data'],['2','2'],['3','3'],['4','4'],['5','5']]],
    ['close:1', 'Tutup lajur · arah saya', laneOpts, true],
    ['close:-1', 'Tutup lajur · arah lawan', laneOpts, true],
    ['cf', 'Contraflow', [[0,'Mati'],[1,'Untuk arah saya'],[-1,'Untuk arah lawan']]],
    ['cfk', 'Lajur contraflow', [[1,'1 lajur'],[2,'2 lajur'],[3,'3 lajur'],[9,'Semua (one way)']]],
    ['ovl', 'Jalan overpass', [[1,'1 lajur'],[2,'2 lajur'],[3,'3 lajur'],[4,'4 lajur']]],
    ['scale', 'Skala jarak', [[1,'Nyata 1:1'],[5,'Ringkas 1:5'],[20,'Cepat 1:20']]],
  ];
}
function btn(text, on){ const b = document.createElement('button'); b.className = 'opt'; b.textContent = text; b.setAttribute('aria-pressed', on ? 'true' : 'false'); return b; }
function renderUI(){
  const sc = ctrl.scrollTop; ctrl.innerHTML = '';
  for (const [id, label, opts, multi] of rowsSpec()) {
    if (id === 'cfk' && !cfg.cf) continue;
    const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = label;
    const cell = document.createElement('div'); cell.className = 'cell';
    if (multi) {
      const d = id.split(':')[1], sel = cfg.closed[d] || [];
      opts.forEach(([v, t]) => { const on = sel.includes(v), b = btn(t, on);
        b.disabled = !on && sel.length >= 4;
        b.onclick = () => { cfg.closed[d] = on ? sel.filter(x => x !== v) : [...sel, v]; saveCfg(); renderUI(); applyTraffic(['rw']); };
        cell.append(b); });
      const h = document.createElement('div'); h.className = 'hint'; h.textContent = 'Lajur 1 = paling kiri. Lajur yang tidak ada di ruas itu diabaikan, dan minimal satu lajur tetap dibuka.'; cell.append(h);
    } else opts.forEach(([v, t]) => { const b = btn(t, String(cfg[id]) === String(v)); b.onclick = () => apply(id, v); cell.append(b); });
    ctrl.append(lbl, cell);
  }
  const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = 'Rute';
  const cell = document.createElement('div'); cell.className = 'cell'; const b = btn('Ganti rute', false); b.onclick = () => openPlanner(); cell.append(b);
  ctrl.append(lbl, cell);
  ctrl.scrollTop = sc;
}
function applyTraffic(types){ setupBlocks(true); rebuildObjects(types); }
function apply(id, v){
  cfg[id] = v; saveCfg();
  if (id === 'cam') setCam(v);
  else if (id === 'tod') setTod(v);
  else if (id === 'den') { fillTraffic(); rebuildObjects(['site', 'ov']); }
  else if (id === 'cf' || id === 'cfk') { applyTraffic(['cf', 'ut']); fillTraffic(); }
  else if (id === 'ovl') rebuildObjects(['ov']);
  else if (id === 'lanes' || id === 'scale') startDrive({from: trip.from, legs: trip.dest ? trip.legs : trip.allLegs, dest: trip.dest, keepPos: true});
  renderUI();
}

// ---------- route planner ----------
function fillSelect(sel, val){
  sel.innerHTML = ''; const groups = new Map();
  for (const p of PLACES) { if (!groups.has(p.group)) groups.set(p.group, []); groups.get(p.group).push(p); }
  for (const [gname, list] of groups) { const og = document.createElement('optgroup'); og.label = gname;
    for (const p of list) { const o = document.createElement('option'); o.value = p.key; o.textContent = p.name + (p.planned ? ' (rencana)' : ''); og.append(o); } sel.append(og); }
  sel.value = val;
}
const PRESETS = [['Jakarta → Surabaya (Pantura)', 'N:Jakarta', 'N:Surabaya', 'nr'], ['Bandung → Yogyakarta (Lintas Selatan)', 'N:Bandung', 'N:Yogyakarta', 'nr'],
  ['Jakarta → Puncak → Bandung', 'N:Jakarta', 'N:Bandung', 'nr'], ['Jakarta (kota) → Malang', 'N:Jakarta', 'N:Malang', 'mix'],['Jakarta → Bandung', 'Halim', 'Pasteur'], ['Jakarta → Surabaya', 'Halim', 'Dupak'], ['Merak → Banyuwangi', 'Merak', 'Ketapang'],
  ['Bekasi → Bogor', 'Bekasi Barat', 'Bogor'], ['Bandung → Cirebon', 'Buahbatu', 'Kedawung'], ['Semarang → Solo', 'Krapyak', 'Colomadu'], ['Surabaya → Malang', 'Dupak', 'Malang']];
const legHours = legs => legs.reduce((a, l) => { const c = CORR[l.c], km = Math.abs(c.nodes.find(n => n.key === l.b).km - c.nodes.find(n => n.key === l.a).km); return a + km/({t: 90, n: 50, a: 30}[c.cls]); }, 0);
let firstPick = null;
function planPreview(){
  const free = cfg.trip === 'free', el = $('preview');
  $('to-field').hidden = $('swap').hidden = $('presets-field').hidden = free; $('first-field').hidden = !free;
  [...$('tripsel').children].forEach(c => c.setAttribute('aria-pressed', c.dataset.t === (free ? 'free' : 'route') ? 'true' : 'false'));
  if (free) {
    const from = $('from').value, ch = choicesAt(from, null, 'mix'), fs = $('firstsel'); fs.innerHTML = '';
    if (firstPick && !ch.some(o => o.e === firstPick)) firstPick = null;
    const a = btn('Otomatis', !firstPick); a.onclick = () => { firstPick = null; planPreview(); }; fs.append(a);
    for (const o of ch) { const b = btn(`${o.road} → ${o.toward}`, firstPick === o.e); b.onclick = () => { firstPick = o.e; planPreview(); }; fs.append(b); }
    const t = tripFromLegs(from, walkFree(from, null, null, firstPick, 60, 'mix'), null, 'mix'); $('go').disabled = !t;
    el.innerHTML = '';
    const d = document.createElement('div'); d.className = 'big'; d.textContent = 'Keliling bebas'; el.append(d);
    const s1 = document.createElement('div'); s1.textContent = `Mulai dari ${NODES.get(from).name}${t ? ' lewat ' + CORR[t.legs[0].c].name : ''}. Tanpa tujuan: jalan terus mengikuti jalan, dan Anda memilih arah di tiap simpang susun, exit atau persimpangan (panel "Arah di").`; el.append(s1);
    const s2 = document.createElement('div'); s2.className = 'path'; s2.textContent = `Buka Peta (tombol Peta / tombol M) untuk navigasi ke salah satu dari ${NAV_COUNT} tempat: ${NET_SUMMARY}.`; el.append(s2);
    return;
  }
  const t = buildTrip($('from').value, $('to').value, cfg.mode);
  if (!t) { el.textContent = $('from').value === $('to').value ? 'Pilih tujuan yang berbeda.' : 'Rute tidak ditemukan.'; $('go').disabled = true; return; }
  $('go').disabled = false;
  const jcts = t.ev.slice(0, t.destIdx + 1).filter(e => e.turn).length, exits = t.ev.slice(1, t.destIdx).filter(e => e.kind === 'x').length, towns = t.ev.slice(1, t.destIdx + 1).filter(e => e.kind === 'k').length;
  const hrs = legHours(t.legs);
  const planned = t.corridors.some(c => CORR[c].planned);
  el.innerHTML = '';
  const d = document.createElement('div'); d.className = 'big'; d.textContent = fmtKm(t.total); el.append(d);
  const s = document.createElement('div'); s.textContent = `${t.tollKm ? 'Tol ' + fmtKm(t.tollKm) : 'Tanpa tol'} · ${t.total - t.tollKm > 0.5 ? 'jalan nasional/akses ' + fmtKm(t.total - t.tollKm) : 'tanpa jalan nasional'} · ${exits} exit · ${jcts} simpang susun · ${towns} kota · ±${hrs >= 1.5 ? Math.round(hrs) + ' jam' : Math.max(1, Math.round(hrs*60)) + ' menit'} nyata`; el.append(s);
  const r = document.createElement('div'); r.className = 'path'; r.textContent = t.corridors.map(c => CORR[c].short).join(' → '); el.append(r);
  if (planned) { const w = document.createElement('div'); w.className = 'warn'; w.textContent = 'Sebagian ruas masih rencana (belum beroperasi).'; el.append(w); }
}
const MODES = [['mix', 'Tol + jalan nasional (tercepat)'], ['toll', 'Utamakan tol'], ['nr', 'Jalan nasional saja']];
function setMode(m){ cfg.mode = m; saveCfg(); [...$('modesel').children].forEach(c => c.setAttribute('aria-pressed', c.dataset.m === m ? 'true' : 'false')); }
function openPlanner(){
  fillSelect($('from'), trip ? trip.from : cfg.from); fillSelect($('to'), trip && trip.dest && [...$('to').options].some(o => o.value === trip.dest) ? trip.dest : cfg.to);
  const ts = $('tripsel'); ts.innerHTML = '';
  for (const [k, l] of [['route', 'Rute (A → B)'], ['free', 'Keliling bebas']]) { const x = btn(l, (cfg.trip || 'route') === k); x.dataset.t = k; x.onclick = () => { cfg.trip = k; saveCfg(); planPreview(); }; ts.append(x); }
  const pr = $('presets'); pr.innerHTML = '';
  for (const [label, a, b, m] of PRESETS) { const x = btn(label, false); x.onclick = () => { $('from').value = a; $('to').value = b; setMode(m || 'mix'); planPreview(); }; pr.append(x); }
  const ms = $('modesel'); ms.innerHTML = '';
  for (const [k, l] of MODES) { const x = btn(l, cfg.mode === k); x.dataset.m = k; x.onclick = () => { setMode(k); planPreview(); }; ms.append(x); }
  const vs = $('vehsel'); vs.innerHTML = '';
  for (const [k, s] of Object.entries(VEH)) { const x = btn(`${s.label} · ${s.gol}`, cfg.veh === k); x.onclick = () => { cfg.veh = k; [...vs.children].forEach(c => c.setAttribute('aria-pressed', 'false')); x.setAttribute('aria-pressed', 'true'); }; vs.append(x); }
  firstPick = null; planPreview(); $('plan').hidden = false; $('done').hidden = true;
}
$('from').onchange = () => { firstPick = null; planPreview(); }; $('to').onchange = planPreview;
$('swap').onclick = () => { const a = $('from').value; $('from').value = $('to').value; $('to').value = a; planPreview(); };
$('go').onclick = () => { $('plan').hidden = true; cfg.from = $('from').value; if (cfg.trip !== 'free') cfg.to = $('to').value; saveCfg();
  if (cfg.trip === 'free') startDrive({from: cfg.from, first: firstPick}); else startTrip(cfg.from, cfg.to); };
$('plan-close').onclick = () => { if (trip) $('plan').hidden = true; };

// leaving the route on a ramp or at an intersection keeps you driving: the trip continues from that place
function finishExit(site){
  const v = PLR; v.vel = 0;
  if (site.i === trip.destIdx) { stats.done = true; return arrive(site, site.kind === 'j' ? v.rampEdge && v.rampEdge.e : exitEdge(site)); }
  const ed = site.kind === 'j' ? v.rampEdge && v.rampEdge.e : exitEdge(site);
  if (!ed) { stats.done = true; return arrive(site, null); }
  continueFrom(site, ed);
}
function arrive(site, onward){
  stats.done = true; const d = $('done'), mins = Math.round((clock - stats.t0)/60), routeTrip = !!trip.home && trip.home !== site.key;
  $('done-title').textContent = `Tiba di ${site.name}`;
  $('done-body').textContent = `${fmtKm(rkAt(site.u) + (stats.km0 || 0))} ditempuh dalam ${mins} menit simulasi. Tarif tol (perkiraan): Rp ${stats.toll.toLocaleString('id-ID')}. Pelanggaran: ${stats.viol}. Tabrakan: ${stats.crashes}.`;
  // keep driving from here without a destination
  $('done-free').onclick = () => { d.hidden = true; stats.done = false;
    if (onward !== undefined && onward) continueFrom(site, onward, true); else clearNav(); };
  $('done-go').hidden = !routeTrip;
  $('done-go').textContent = 'Kembali ke asal'; $('done-go').onclick = () => { d.hidden = true; const home = trip.home; stats.done = false;
    if (onward) continueFrom(site, onward, true, home); else setNav(home); };
  d.hidden = false;
}
$('done-new').onclick = () => { $('done').hidden = true; openPlanner(); };
$('resume').onclick = () => { if (PLR && PLR.rp && PLR.rp.parked) PLR.rp.park.t = 0; };

// ---------- driving controls ----------
function manualNow(){ if (cfg.auto) { cfg.auto = false; saveCfg(); hudAuto(); toast('Kemudi manual: bebas, pelanggaran tetap dicatat'); } }
const hold = (el, k) => { const on = e => { e.preventDefault(); input[k] = true; manualNow(); }, off = () => input[k] = false;
  el.addEventListener('pointerdown', on); for (const ev of ['pointerup','pointerleave','pointercancel']) el.addEventListener(ev, off); };
hold($('gas'), 'gas'); hold($('brake'), 'brake'); hold($('lft'), 'left'); hold($('rgt'), 'right');
$('auto').onclick = () => { cfg.auto = !cfg.auto; saveCfg(); hudAuto();
  if (cfg.auto && PLR && !PLR.rp) { const n = nAvail(PLR.sd, PLR.p); PLR.lane = clamp(Math.round(PLR.lx), 0, n - 1); if (PLR.vel < 0) PLR.vel = 0; }
  toast(cfg.auto ? 'Autopilot aktif: mengikuti rute dan aturan sampai tujuan' : 'Kemudi manual: bebas, pelanggaran tetap dicatat'); };
$('mapb').onclick = () => openAtlas();
$('camb').onclick = () => { const order = ['chase', 'cockpit', 'drone', 'ic', 'orbit'], m = order[(order.indexOf(cfg.cam) + 1) % order.length]; apply('cam', m); };
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('atlas').hidden) { closeAtlas(); return; }
  if (e.target.closest && e.target.closest('select,input')) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowup' || k === 'w') { input.gas = true; manualNow(); e.preventDefault(); }
  else if (k === 'arrowdown' || k === 's') { input.brake = true; manualNow(); e.preventDefault(); }
  else if (k === 'arrowleft' || k === 'a') { input.left = true; manualNow(); e.preventDefault(); }
  else if (k === 'arrowright' || k === 'd') { input.right = true; manualNow(); e.preventDefault(); }
  else if (k === 'p' && !e.repeat) $('auto').click();
  else if (k === 'c' && !e.repeat) $('camb').click();
  else if (k === 'm' && !e.repeat) { if ($('atlas').hidden) openAtlas(); else closeAtlas(); } });
addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (k === 'arrowup' || k === 'w') input.gas = false; if (k === 'arrowdown' || k === 's') input.brake = false;
  if (k === 'arrowleft' || k === 'a') input.left = false; if (k === 'arrowright' || k === 'd') input.right = false; });
addEventListener('blur', () => { input.gas = input.brake = input.left = input.right = false; });
renderer.domElement.addEventListener('pointerdown', () => { if (MOBILE && camMode !== 'orbit') hud.classList.remove('open'); });

// ================================================================
// TRIP START
// ================================================================
const LOCK = 1100;   // world metres: closer than this the road ahead is already built and the plan can no longer change
const prevKeyOf = e => { const l = trip.allLegs[e.legIdx]; return l ? l.a : null; };
const isFree = () => !trip.dest;
function legsFor(from, first, dest, prev = null){
  if (!dest) return walkFree(from, prev, null, first, 60, 'mix');
  const head = first ? [{a: from, b: first.to, c: first.c}] : [], s0 = first ? first.to : from;
  if (s0 === dest) return head;
  const ban = first ? from : prev, r = findRoute(s0, dest, cfg.mode, ban) || findRoute(s0, dest, cfg.mode) || findRoute(s0, dest, 'mix', ban) || findRoute(s0, dest, 'mix');
  return r ? head.concat(r) : null;
}
function startDrive({from, first = null, dest = null, legs = null, keepPos = false, cont = false, prev = null, home}){
  legs = legs || legsFor(from, first, dest, prev);
  const t = legs && legs.length ? tripFromLegs(from, legs, dest, cfg.mode) : null; if (!t) { toast('Rute tidak ditemukan', 'bad'); return false; }
  t.home = home !== undefined ? home : (cont || keepPos) && trip ? trip.home : (dest ? from : null);
  const keepU = keepPos && PLR ? rkAt(uOfV(PLR)) : null;
  clearWorld(); vehicles.forEach(killVehicle); rampers.forEach(killVehicle); locals.forEach(killVehicle); vehicles = []; rampers = []; locals = []; PLR = null; PCACHE.clear();
  EV = []; ZONES = []; OVS = []; OPENS = [];
  layoutTrip(t);
  if (!cont && !keepPos) Object.assign(stats, {t0: clock, toll: 0, viol: 0, crashes: 0, lastPay: 0, km0: 0, log: []});
  Object.assign(stats, {missed: false, done: false});
  spawnPlayer();
  if (keepU != null) { let u = 0; for (let i = 1; i < EV.length; i++) if (EV[i].rk >= keepU) { const a = EV[i-1], b = EV[i]; u = a.u + (b.u - a.u)*(keepU - a.rk)/((b.rk - a.rk) || 1); break; }
    const rs = RSITES.concat(PLAZAS).find(s => Math.abs(s.u - u) < 400); if (rs) u = rs.u + 420;
    PLR.p = Math.max(PLR.p, u); camU = PLR.p; }
  setupBlocks(true); updateWorld(); fillTraffic();
  rm(vehicles, PLR);
  for (let i = 0; i < 120; i++) { sim(1/20); rampStep(1/20); }
  for (const v of [...vehicles]) if (v.lane === PLR.lane && Math.abs(v.p - PLR.p) < 40) { rm(vehicles, v); killVehicle(v); }
  for (const v of [...rampers]) if (v.rp.sd === PLR.sd && Math.abs(v.p - PLR.p) < 60) { rm(rampers, v); killVehicle(v); }
  vehicles.push(PLR);
  setTitle(); choiceSig = '';
  $('plan').hidden = true; setRest(false); hudAuto(); hudLane(); renderUI(); setCam(cfg.cam); drawMap();
  if (!cont) toast(dest ? `${CORR[EV[0].cNext].name} · ${fmtKm(t.total)} ke ${EV[t.destIdx].name}` : `Keliling bebas dari ${EV[0].name}: pilih arah di tiap simpang, buka Peta untuk navigasi`);
  return true;
}
function startTrip(from, to, keepPos){ return startDrive({from, dest: to, keepPos}); }
function setTitle(){ const d = EV[trip.destIdx];
  $('route').textContent = d ? `${trip.home && trip.home !== trip.from ? NODES.get(trip.home).name : EV[0].name} → ${d.name}` : `Keliling bebas · ${NODES.get(trip.home || trip.from).name}`; }

// continue driving from a site along edge ed (after an exit/junction ramp or a turn at an intersection)
function continueFrom(site, ed, quiet = false, dest = trip.dest){
  if (dest === site.key) dest = null;
  const rkHere = rkAt(site.u), toll = CORR[ed.c].cls === 't';
  stats.km0 = (stats.km0 || 0) + rkHere;
  const owed = toll ? Math.max(0, rkHere - stats.lastPay) : 0;
  const ok = startDrive({from: site.key, first: ed, dest, cont: true, prev: prevKeyOf(site)});
  if (!ok) return;
  stats.lastPay = -owed;
  if (!quiet) toast(`${ed.cls === 'a' ? (site.kind === 'k' ? 'Menuju gerbang tol ' + NODES.get(ed.to).name : 'Jalan akses ke ' + NODES.get(ed.to).name) : CORR[ed.c].name + ' arah ' + towardOfEdge(site.key, ed)}${dest ? ' · rute dihitung ulang' : ''}`);
}
const towardOfEdge = (key, ed) => { const o = choicesAt(key, null, 'mix').find(o => o.e.to === ed.to && o.e.c === ed.c); return o ? o.toward : NODES.get(ed.to).name; };
// the road a junction ramp leads to: the planned turn if there is one, otherwise the road to the left
function rampEdge(s){
  const opts = choicesAt(s.key, prevKeyOf(s), 'mix').filter(o => o.e.c !== s.c && CORR[o.e.c].cls === 't'); if (!opts.length) return null;
  const nl = trip.allLegs[s.legIdx + 1], planned = nl && opts.find(o => o.e.to === nl.b && o.e.c === nl.c);
  return planned || opts.find(o => o.turn === 'Kiri') || opts[0];
}
function exitEdge(s){
  const a = edgesFrom(s.key).find(e => CORR[e.c].cls === 'a'); if (a) return a;
  const o = choicesAt(s.key, prevKeyOf(s), 'mix').find(o => o.e.c !== s.c); return o ? o.e : null;
}
function leftEdge(s){
  const prev = prevKeyOf(s), opts = choicesAt(s.key, prev, 'mix').map(o => ({o, d: turnDeg(prev, s.key, o.e.to)})).filter(x => x.d < -35 && x.d > -160);
  if (!opts.length) return null;
  return opts.sort((a, b) => Math.abs(a.d + 90) - Math.abs(b.d + 90))[0].o.e;
}

// ---------- re-planning the road ahead without rebuilding the world ----------
function relayout(t, keepN){
  const s0 = EV[keepN], before = s0 && [s0.kind, s0.cNext, !!s0.turn].join();
  layoutTrip(t, keepN);
  const s1 = EV[keepN], changed = !s0 || before !== [s1.kind, s1.cNext, !!s1.turn].join(), cut = s1.u;
  const byRef = new Map(OBJ.map(o => [o.s || o.z || o.o, o]));
  for (const [o, gs] of [...built]) { built.delete(o); const n = byRef.get(o.s || o.z || o.o);
    if (n && n.type === o.type && !(changed && o.s === s1)) { built.set(n, gs); continue; }
    freeObj(gs);
    if (o.type === 'site') { o.s.bays = {'1': null, '-1': null}; for (const v of [...rampers]) if (!v.player && v.rp.site === o.s) { rm(rampers, v); killVehicle(v); } } }
  for (const [ci, g] of [...chunks]) if ((ci + 1)*CH > cut - 1) { dropSolids([g]); dispose(g); chunks.delete(ci); }
  setupBlocks(true); updateWorld();
  for (const v of [...vehicles]) if (!v.player && v.sd*v.p > cut - 200 && v.lane >= nAvail(v.sd, v.p)) { rm(vehicles, v); killVehicle(v); }
  choiceSig = ''; setTitle(); drawMap(); if (!$('atlas').hidden) drawAtlas();
}
// first route event far enough ahead that the road after it can still change
function replanIdx(u, needChoice = false){
  for (let i = Math.max(1, evAt(u) + 1); i < EV.length; i++) { const e = EV[i];
    if (!e.end || e.u < u + LOCK) continue;
    if (!needChoice || choicesAt(e.key, prevKeyOf(e), 'mix').length >= 2) return i;
    if (e.u > u + 80000) break; }
  return needChoice ? -1 : EV.length - 1;
}
function replan(i, tail, dest){
  const e = EV[i], legs = trip.allLegs.slice(0, e.legIdx + 1).concat(tail);
  const t = tripFromLegs(trip.from, legs, dest, cfg.mode); if (!t) return false;
  t.home = trip.home; relayout(t, i); return true;
}
function ensureAhead(){
  if (!trip || !PLR) return;
  const u = uOfV(PLR), lastE = EV[EV.length - 1]; if (lastE.u - u > 16000) return;
  const last = trip.allLegs[trip.allLegs.length - 1], tail = walkFree(last.b, last.a, last.c, null, 60, 'mix');
  // past the destination (arrived, or still on the tail): keep the destination where it is and extend the road
  const keep = trip.dest, dl = keep ? EV[trip.destIdx].legIdx : -1, done = stats.done;
  if (!tail.length || !replan(EV.length - 1, tail, null) || !keep) return;
  const j = EV.findIndex(e => e.key === keep && e.legIdx === dl && e.end); if (j >= 0) markDest(j, true); stats.done = done;
}
// Maps navigation: route from the next changeable place to dest (any node of the network)
function setNav(dest, quiet = false){
  if (!trip || !PLR || !NODES.has(dest)) return false;
  const u = uOfV(PLR), i = replanIdx(u);
  // the destination is already on the road ahead: just mark it
  for (let j = Math.max(1, evAt(u) + 1); j <= i; j++) if (EV[j].key === dest && EV[j].end && EV[j].u > u + 30) return markDest(j);
  const e = EV[i], tail = e.key === dest ? [] : legsFor(e.key, null, dest, prevKeyOf(e));
  if (!tail) { toast('Rute ke ' + NODES.get(dest).name + ' tidak ditemukan', 'bad'); return false; }
  if (!replan(i, tail, dest)) return false;
  if (!trip.home) trip.home = trip.from;
  Object.assign(stats, {missed: false, done: false});
  if (!quiet) toast(`Navigasi ke ${NODES.get(dest).name} · ${fmtKm(Math.max(0, EV[trip.destIdx].rk - rkAt(u)))}`);
  setTitle(); return true;
}
function markDest(j, quiet = false){
  for (const e of EV) delete e.dest;
  trip.dest = EV[j].key; trip.destIdx = j; trip.total = EV[j].rk; trip.free = false; EV[j].dest = true;
  trip.legs = trip.allLegs.slice(0, EV[j].legIdx + 1);
  Object.assign(stats, {missed: false, done: false}); setTitle(); drawMap(); if (!quiet) toast(`Navigasi ke ${EV[j].name} · ${fmtKm(EV[j].rk - rkAt(uOfV(PLR)))}`);
  return true;
}
function clearNav(){
  for (const e of EV) delete e.dest;
  trip.dest = null; trip.destIdx = -1; trip.free = true; trip.legs = trip.allLegs; stats.done = false;
  setTitle(); drawMap(); toast('Navigasi dimatikan · keliling bebas');
}
// pick the road to take at route event i (free driving)
function chooseAt(i, ed){
  const e = EV[i]; if (!e || e.u < uOfV(PLR) + LOCK - 50) return toast('Terlalu dekat untuk ganti arah', 'warn');
  const tail = [{a: e.key, b: ed.to, c: ed.c}].concat(walkFree(ed.to, e.key, ed.c, null, 50, 'mix'));
  replan(i, tail, null);
}
let choiceSig = '';
function updateChoice(u){
  const el = $('choice');
  const di = trip && !trip.dest && !stats.done && PLR && !PLR.rp ? replanIdx(u, true) : -1;
  if (di < 0) { el.hidden = true; choiceSig = ''; return; }
  const e = EV[di], prev = prevKeyOf(e), nl = trip.allLegs[e.legIdx + 1], ch = choicesAt(e.key, prev, 'mix');
  const d = Math.max(0, e.rk - rkAt(u));
  $('ch-d').textContent = fmtKm(d);
  const sig = e.i + '|' + (nl ? nl.b + nl.c : '');
  if (sig === choiceSig && !el.hidden) return; choiceSig = sig;
  $('ch-name').textContent = e.kind === 'j' ? nodeLabel(e) : e.kind === 'k' ? 'Simpang ' + e.name : e.kind === 'x' || e.kind === 'te' ? 'Exit ' + e.name : e.name;
  const box = $('ch-opts'); box.innerHTML = '';
  for (const o of ch.sort((a, b) => turnDeg(prev, e.key, a.e.to) - turnDeg(prev, e.key, b.e.to))) {
    const on = nl && nl.b === o.e.to && nl.c === o.e.c, b = btn('', on);
    const t = document.createElement('b'); t.textContent = o.turn; const r = document.createElement('span'); r.textContent = `${o.road} → ${o.toward}`;
    b.append(t, r); b.onclick = () => { if (!on) chooseAt(e.i, o.e); };
    box.append(b); }
  el.hidden = false;
}

try { await Promise.race([document.fonts.load('700 64px Archivo'), new Promise(r => setTimeout(r, 2500))]); } catch(e) {}
setTod(cfg.tod);
if (cfg.trip === 'free') startDrive({from: NODES.has(cfg.from) ? cfg.from : DEF.from}); else startTrip(NODES.has(cfg.from) ? cfg.from : DEF.from, NODES.has(cfg.to) ? cfg.to : DEF.to);
if (!localStorage.getItem('tj_seen')) { try { localStorage.setItem('tj_seen', '1'); } catch(e) {} openPlanner(); }
window.__tj = {get PLR(){ return PLR; }, get EV(){ return EV; }, get trip(){ return trip; }, get clock(){ return clock; }, get vehicles(){ return vehicles; }, get rampers(){ return rampers; }, cfg, camera, startTrip, input, geo: () => ({OVS, ssPath, trOut, trIn, restPath, offPts, onPts, smooth, detourOut, detourIn, RE, SC, PRC, PR_IN, DK, FAR, GATE_O, MED, LW}), look: (...a) => { window.__tjCam = a; camMode = 'dbg'; }, siteU: name => EV.find(e => e.name === name), get camU(){ return camU; }, get frames(){ return frames; }, dbg: () => { const v = PLR; if (v.rp) { const sd = v.rp.sd, p = v.rp.pc + v.q.u - v.rp.shift, n = nAvail(sd, p), fr = p + v.len/2; return {rp: true, p, n, qu: v.q.u, mergeAt: v.rp.mergeAt, len: v.rp.P.len, d: v.rp.d, sf: [n-1, n-2].map(l => spanFree(sd, l, p - v.len/2 - 2, fr + 2)), ba: [n-1, n-2].map(l => blockAhead(sd, l, fr)), g: [n-1,n-2].map(l => { const g = gapInfo(v, laneList(sd, l)); return [g.ld, g.fd]; }), CFA: CFA.map(z => ({A: z.A, bStart: z.bStart, bEnd: z.bEnd, oneWay: z.oneWay})), near: vehicles.filter(o => o.sd === sd && Math.abs(o.p - p) < 80).map(o => [Math.round(o.p), o.lane, +o.vel.toFixed(1)]) }; } const g = gapInfo(v, laneList(v.sd, v.lane)); return {ba: blockAhead(v.sd, v.lane, v.p + v.len/2), ld: g.ld, lead: g.lead && {p: g.lead.p, vel: g.lead.vel, type: g.lead.type, lane: g.lead.lane}, n: nAvail(1, v.p), acc: v.acc, CFA: CFA.length, blocks: [...blocks.keys()], zones: ZONES.slice(0,4)}; }, get stats(){ return stats; }, get built(){ return built; }, setCam, startDrive, setNav, clearNav, chooseAt, replanIdx, openAtlas, closeAtlas, atTap, AT, get chunks(){ return chunks; }, get OBJ(){ return OBJ; }};

let last = performance.now(), mapT = 0, frames = 0;
function tick(dt){
  clock += dt;
  sim(dt); rampStep(dt); maintainTraffic(dt); simLocals(dt); playerRules(dt);
  if (PLR) camU = uOfV(PLR);
  ensureAhead();
  setupBlocks(false); updateWorld(); updateSignals();
}
window.__tj.jump = u => { PLR.p = u; camU = u; PLR.lane = PLR.lx = Math.min(PLR.lane, nAvail(1, u) - 1); PLR.vel = 20; setupBlocks(true); updateWorld(); fillTraffic(); for (const v of [...vehicles]) if (!v.player && v.lane === PLR.lane && Math.abs(v.p - PLR.p) < 40) { rm(vehicles, v); killVehicle(v); } };
// test hook: advance the simulation without rendering
window.__tj.step = (n, dt = 1/20) => { for (let i = 0; i < n; i++) tick(dt); placeGroups(); place(); for (let k = 0; k < 40; k++) updateCam(dt); updateBend(); hudT = 0; updateHud(dt); drawMap(); };
renderer.setAnimationLoop(now => {
  const dt = Math.min(0.05, (now - last)/1000); last = now; frames++;
  if ((!$('plan').hidden && trip && !stats.done) || !$('atlas').hidden) { composer.render(); return; }
  tick(dt);
  placeGroups(); place(); updateCam(dt); flash(); updateBend(); updateHud(dt);
  mapT -= dt; if (mapT <= 0) { mapT = 0.5; drawMap(); }
  composer.render();
});
addEventListener('resize', () => { camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); composer.setSize(innerWidth,innerHeight); drawMap(); reqAtlas(); });
