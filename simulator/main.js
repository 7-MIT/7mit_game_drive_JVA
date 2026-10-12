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
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CORR, CORRIDORS, NODES, placeList, buildTrip, findRoute, tripFromLegs, walkFree, choicesAt, edgesFrom, turnDeg, fmtKm, nodeLabel, JAVA, MADURA, corrGeo, corrLL, RULES} from './network.js';

const MOBILE = matchMedia('(pointer:coarse)').matches || innerWidth < 700;
const LW = 3.6, MED = 1.2, CH = 120, OPEN_HW = 35, OVH = 7.5, PRC = 328, BACK = 460, FWD = 720;
let VIEWX = 0;   // extra metres of road and scenery built ahead (Jarak pandang: jauh)
const DEF = {mode:'mix', gfx:'auto', cam:'chase', den:1, tod:'day', lanes:'auto', closed:{'1':[1], '-1':[]}, cf:0, cfk:2, ovl:2, scale:5, veh:'car', tspd:1, steerAssist:false, weather:'cerah', roadStyle:'data', view:'normal', autoSteer:false, sound:true, clean:false,
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
const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.3, 2400);
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
// The road bends sideways (and, in the mountains, up and down) in the vertex shader. uSeg holds up to 6 stretches of road
// near the car with their own winding (z, metres) and hill (w, metres) amplitude: the Lintas Selatan and other mountain
// roads wind (kelak-kelok) and climb, Cipularang / Semarang–Solo / Bocimi roll over the hills.
const SEG_N = 6, segU = Array.from({length: SEG_N}, () => new THREE.Vector4(0, -1, 0, 0));
const EL_N = 3, elU = Array.from({length: EL_N}, () => new THREE.Vector4(0, -1, 0, 1));
const CU = {uW:{value:0}, uCz:{value:0}, uB0:{value:0}, uB1:{value:0}, vB0:{value:0}, vB1:{value:0}, uSeg:{value:segU}, uX:{value:new THREE.Vector3(1, 0, 0)}, uEl:{value:elU}};   // uX: base bend × , extra winding, extra hills
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };
function segAmp(u){ let w = CU.uX.value.y, h = CU.uX.value.z; for (const q of segU) { if (q.y <= q.x) continue; const k = sstep(q.x, q.x + 400, u)*(1 - sstep(q.y - 400, q.y, u)); w += k*q.z; h += k*q.w; } return [w, h]; }
const gC = u => { const w = segAmp(u)[0]; return CU.uX.value.x*(45*Math.sin(u/450) + 20*Math.sin(u/200+1.3)) + w*(Math.sin(u/80 + 0.7) + 0.45*Math.sin(u/45 + 2.1)); };
const gY = u => { const h = segAmp(u)[1]; return h*(0.7*Math.sin(u/520) + 0.3*Math.sin(u/230 + 2)); };
const gD = u => gC(u + 0.5) - gC(u - 0.5), gYD = u => gY(u + 0.5) - gY(u - 0.5);
const BEND_HEAD = `uniform float uW; uniform float uCz; uniform float uB0; uniform float uB1; uniform float vB0; uniform float vB1; uniform vec4 uSeg[${SEG_N}]; uniform vec3 uX; uniform vec4 uEl[${EL_N}];
float segK(vec4 q, float u){ if (q.y <= q.x) return 0.0; return smoothstep(q.x, q.x + 400.0, u)*(1.0 - smoothstep(q.y - 400.0, q.y, u)); }
float bendX(float z){ float u = uW - z, w = uX.y; for (int i = 0; i < ${SEG_N}; i++) w += segK(uSeg[i], u)*uSeg[i].z;
  return uX.x*(45.0*sin(u/450.0) + 20.0*sin(u/200.0 + 1.3)) + w*(sin(u/80.0 + 0.7) + 0.45*sin(u/45.0 + 2.1)) - uB0 - uB1*(z - uCz); }
float bendY(float z){ float u = uW - z, h = uX.z; for (int i = 0; i < ${SEG_N}; i++) h += segK(uSeg[i], u)*uSeg[i].w;
  return h*(0.7*sin(u/520.0) + 0.3*sin(u/230.0 + 2.0)) - vB0 - vB1*(z - uCz); }
float elevY(float z){ float u = uW - z, e = 0.0; for (int i = 0; i < ${EL_N}; i++){ vec4 q = uEl[i]; if (q.y > q.x) e += q.z*smoothstep(q.x, q.x + q.w, u)*(1.0 - smoothstep(q.y - q.w, q.y, u)); } return e; }
`;
const BEND_CHUNK = THREE.ShaderChunk.project_vertex.replace('mvPosition = modelViewMatrix * mvPosition;',
  'vec4 bwp = modelMatrix * mvPosition; bwp.x += bendX(bwp.z); bwp.y += bendY(bwp.z);\n#ifdef TERRAIN\nbwp.y -= elevY(bwp.z);\n#endif\nmvPosition = viewMatrix * bwp;');
const WORLD_CHUNK = '#include <worldpos_vertex>\n#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0\nworldPosition.x += bendX(worldPosition.z); worldPosition.y += bendY(worldPosition.z);\n#ifdef TERRAIN\nworldPosition.y -= elevY(worldPosition.z);\n#endif\n#endif';
// winding / hill amplitude per road
const ROADFORM = {selatan1: [24, 18], garut: [24, 20], pansela1: [22, 14], pansela2: [26, 18], pansela3: [18, 10], pansela4: [22, 16], pansela5: [24, 16],
  puncak: [26, 22], sindang: [26, 20], kuningan: [20, 14], wonosobo: [24, 20], magelang: [16, 12], batu: [24, 20], pelratu: [22, 14], sukabumi: [16, 12],
  banjar: [16, 8], malsel: [20, 14], ponorogo: [20, 14], wonogiri: [20, 14], lembang: [22, 18], tegal: [14, 10], jasinga: [14, 8], sumedang: [18, 14],
  cipularang: [6, 14], semsol: [5, 12], bocimi: [6, 12], cisumdawu: [6, 14], gempan: [4, 8], soroja: [4, 8]};
// jalan layang: these toll roads run on a viaduct (deck height in metres)
const ELEVATED = {juanda: 10, mbz: 16, becakayu: 18, wiyoto: 12};
let ELV = [];
function layoutElev(){ ELV = [];
  for (let i = 0; i < EV.length - 1; i++) { const H = ELEVATED[EV[i].cNext]; if (!H) continue; let a = EV[i].u, b = EV[i + 1].u; const last = ELV[ELV.length - 1];
    if (EV[i].cNext === 'mbz') { const g = mbzGeom(a, b); if (!g) continue; const r = Math.min(300, g.RL - 120); ELV.push([g.uH - r, g.uE + r, H, r]); continue; }   // up on its ramps (see layoutMbz)
    if (last && Math.abs(last[1] - a) < 1 && last[2] === H) last[1] = b; else ELV.push([a, b, H]); }
  // Jembatan Suramadu: the Madura road crosses the strait on a 12 m deck
  SEA = null;
  for (let i = 0; i < EV.length - 1; i++) { const a = EV[i], b = EV[i + 1]; if (a.cNext !== 'madura') continue;
    const n = CORR.madura.nodes.find(n => n.key === a.key), ka = n ? n.km : a.km, kb = b.km; if (Math.abs(kb - ka) < 0.01) continue;
    const uOf = km => a.u + (km - ka)/(kb - ka)*(b.u - a.u), p = uOf(SURAMADU[0]), q = uOf(SURAMADU[1]), lo = Math.min(p, q), hi = Math.max(p, q);
    if (hi > a.u - 1 && lo < b.u + 1 && hi - lo > 200) { SEA = [lo, hi]; ELV.push([lo - 160, hi + 160, 12, 160]); } }
  ELV.sort((p, q) => p[0] - q[0]);
  for (const q of ELV) if (q[3] == null) q[3] = Math.min(700, (q[1] - q[0])/3); }
// KM range of the Madura road on the Suramadu bridge (Surabaya at KM 0), and its span in route u when the route crosses it
const SURAMADU = [4.5, 9.7]; let SEA = null;
const onSea = u => !!SEA && u > SEA[0] && u < SEA[1];
function elevAt(u){ let e = 0; for (const [a, b, H, r] of ELV) if (u > a && u < b) e += H*sstep(a, a + r, u)*(1 - sstep(b - r, b, u)); return e; }
let segT = 0;
function updateSegs(){
  for (const q of elU) q.set(0, -1, 0, 1);
  ELV.filter(q => q[1] > camU - 3000 && q[0] < camU + 4000).slice(0, EL_N).forEach((q, j) => elU[j].set(...q));
  for (const q of segU) q.set(0, -1, 0, 0);
  if (!EV.length) return;
  const out = []; let i0 = Math.max(0, evAt(camU - 2600)), i1 = Math.min(EV.length - 1, evAt(camU + 3200) + 1);
  for (let i = i0; i < i1; i++) { const f = ROADFORM[EV[i].cNext]; if (!f) continue; const a = EV[i].u, b = EV[i + 1].u, last = out[out.length - 1];
    if (last && Math.abs(last[1] - a) < 1 && last[2] === f[0] && last[3] === f[1]) last[1] = b; else out.push([a, b, f[0], f[1]]); }
  out.sort((p, q) => Math.abs((p[0] + p[1])/2 - camU) - Math.abs((q[0] + q[1])/2 - camU)).slice(0, SEG_N).forEach((q, j) => segU[j].set(...q));
}
function patchMat(m){ if (!m || m.userData.bent) return; m.userData.bent = true; if (m.userData.terrain) m.defines = {...(m.defines || {}), TERRAIN: ''};
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, CU);
    sh.vertexShader = BEND_HEAD + sh.vertexShader.replace('#include <project_vertex>', BEND_CHUNK).replace('#include <worldpos_vertex>', WORLD_CHUNK); };
  m.needsUpdate = true; }
const depthMat = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking}); patchMat(depthMat);
const depthMatT = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking}); depthMatT.userData.terrain = true; patchMat(depthMatT);
const bendAt = z => gC(camU - z) - CU.uB0.value - CU.uB1.value*(z - CU.uCz.value);
function bendObj(g){ g.traverse(o => { if (!o.isMesh) return; o.frustumCulled = false; (Array.isArray(o.material) ? o.material : [o.material]).forEach(patchMat); if (o.castShadow) o.customDepthMaterial = (Array.isArray(o.material) ? o.material[0] : o.material).userData.terrain ? depthMatT : depthMat; }); }
function updateBend(){ const cz = camera.position.z; if (--segT <= 0) { segT = 20; updateSegs(); }
  CU.uW.value = camU; CU.uCz.value = cz; CU.uB0.value = gC(camU - cz); CU.uB1.value = -gD(camU - cz); CU.vB0.value = gY(camU - cz); CU.vB1.value = -gYD(camU - cz); }

// ---------- materials & primitives ----------
const M = (c, o={}) => new THREE.MeshStandardMaterial({color:c, roughness:0.9, ...o});
// the ground follows the same hills as the road (vertex shader), so it is finely divided along the road
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 40, 200), M(0x6f8a4a));
ground.rotation.x = -Math.PI/2; ground.position.y = -0.05; ground.receiveShadow = true; ground.frustumCulled = false; patchMat(ground.material); scene.add(ground);

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
const concreteD = concrete.clone(), barMatD = barMat.clone(); concreteD.side = barMatD.side = THREE.DoubleSide;
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
// strip / wall whose height follows u (ramps); drawn double sided
function ribbonY(us, fa, fb, fy, mat, Z){
  const pos = [], idx = [];
  us.forEach((u, i) => { const y = fy(u); pos.push(fa(u), y, Z(u), fb(u), y, Z(u)); if (i) { const j = (i-1)*2; idx.push(j, j+1, j+2, j+1, j+3, j+2); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m; }
function wallY(us, fx, fy0, fy1, mat, Z){
  const pos = [], idx = [];
  us.forEach((u, i) => { pos.push(fx(u), fy0(u), Z(u), fx(u), fy1(u), Z(u)); if (i) { const j = (i-1)*2; idx.push(j, j+1, j+2, j+1, j+3, j+2); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; return m; }
const cut = ([a,b], gaps) => { let s = [[a,b]]; for (const [g0,g1] of gaps) s = s.flatMap(([x,y]) => g1 <= x || g0 >= y ? [[x,y]] : [[x,g0],[g1,y]].filter(([p,q]) => q-p > 0.5)); return s; };
function rng(seed){ let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- traffic signs (rambu) ----------
const MATC = new Map();
function signMat(key, w, h, draw, px=256){ if (!MATC.has(key)) { const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px*h/w);
  draw(c.getContext('2d'), c.width, c.height); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.keep = true;
  const m = new THREE.MeshStandardMaterial({map:t, emissive:0xffffff, emissiveMap:t, emissiveIntensity:signI, roughness:0.6}); m.userData.sign = true; patchMat(m); MATC.set(key, m); } return MATC.get(key); }
// road signs are lettered in the highway typeface (Overpass, the open version of Highway Gothic; the real one if the device has it)
const SIGN_FONT = "'Highway Gothic', 'Overpass', Archivo, sans-serif";
function fit(x, text, maxW, size, weight=700){ let s = size; do { x.font = `${weight} ${s}px ${SIGN_FONT}`; s -= 4; } while (x.measureText(text).width > maxW && s > 20); }
const drawSpeed = (n, min) => (x, w) => { const r = w/2; x.beginPath(); x.arc(r,r,r-2,0,Math.PI*2); x.fillStyle = min ? '#1d4fa3' : '#fff'; x.fill();
  x.lineWidth = min ? 6 : w*0.11; x.strokeStyle = min ? '#fff' : '#d0202a'; x.beginPath(); x.arc(r,r, min ? r-12 : r-2-w*0.055, 0, Math.PI*2); x.stroke();
  x.fillStyle = min ? '#fff' : '#111'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 ${n >= 100 ? w*0.36 : w*0.44}px ${SIGN_FONT}`; x.fillText(String(n), r, r + w*0.02); };
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
// pictograms on the road signs: vector icons drawn straight into the sign texture (white tiles with a dark symbol, as on real signs)
const PICTO = {fuel: 'Fuel', food: 'Utensils', mosque: 'MoonStar', wc: 'Toilet', parking: 'CircleParking', cart: 'ShoppingCart', wrench: 'Wrench', atm: 'Banknote', plug: 'PlugZap',
  coffee: 'Coffee', toll: 'CreditCard', split: 'Split', city: 'Building2', pin: 'MapPin', car: 'Car', bridge: 'Waves', left: 'ArrowUpLeft', route: 'Route', exit: 'LogOut'};
const REST_ICONS = ['fuel', 'food', 'mosque', 'wc', 'cart'];
const OWN_ICONS = {road: [['path', {d: 'M12 17v4'}], ['path', {d: 'M12 5V3'}], ['path', {d: 'M12 9v3'}], ['path', {d: 'M2.077 18.449A2 2 0 0 0 4 21h16a2 2 0 0 0 1.924-2.55l-4-14A2 2 0 0 0 16 3H8a2 2 0 0 0-1.924 1.45z'}]]};
function drawIcon(x, key, cx, cy, size, col = '#1b1b1b'){
  const L = window.lucide && window.lucide.icons, node = OWN_ICONS[key] ? [0, 0, OWN_ICONS[key]] : L && L[PICTO[key] || key]; if (!node) return false;
  x.save(); x.translate(cx - size/2, cy - size/2); x.scale(size/24, size/24); x.strokeStyle = col; x.lineWidth = 2.1; x.lineCap = x.lineJoin = 'round';
  for (const [tag, a] of node[2]) { if (tag === 'path') { x.stroke(new Path2D(a.d)); continue; }
    x.beginPath();
    if (tag === 'line') { x.moveTo(+a.x1, +a.y1); x.lineTo(+a.x2, +a.y2); }
    else if (tag === 'circle') x.arc(+a.cx, +a.cy, +a.r, 0, Math.PI*2);
    else if (tag === 'ellipse') x.ellipse(+a.cx, +a.cy, +a.rx, +a.ry, 0, 0, Math.PI*2);
    else if (tag === 'rect') x.roundRect(+a.x, +a.y, +a.width, +a.height, +(a.rx || 0));
    else { const q = String(a.points).trim().split(/[\s,]+/).map(Number); for (let i = 0; i < q.length; i += 2) i ? x.lineTo(q[i], q[i + 1]) : x.moveTo(q[i], q[i + 1]); if (tag === 'polygon') x.closePath(); }
    x.stroke(); }
  x.restore(); return true; }
function iconTile(x, key, x0, y0, S){ if (!OWN_ICONS[key] && !(window.lucide && window.lucide.icons)) return 0; x.fillStyle = '#fff'; x.beginPath(); x.roundRect(x0, y0, S, S, S*0.14); x.fill(); drawIcon(x, key, x0 + S/2, y0 + S/2, S*0.7); return S; }
// a row of tiles ending at xr; returns its width
function iconRow(x, keys, xr, y0, S){ if (!keys || !keys.length) return 0; const g = S*0.16, w = keys.length*S + (keys.length - 1)*g;
  keys.forEach((k, i) => iconTile(x, k, xr - w + i*(S + g), y0, S)); return w; }
const iconFor = t => /rest|spbu/i.test(t) ? 'fuel' : /jct|simpang/i.test(t) ? 'split' : /tol\b|gt |gerbang|exit|layang/i.test(t) ? 'road' : 'city';
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
  const iw = iconTile(x, tag === 'JCT' ? 'split' : 'road', 254, 44, 78);
  x.fillStyle = '#fff'; x.font = `700 56px ${SIGN_FONT}`; if (dist) x.fillText(dist, iw ? 352 : 262, 85);
  arrow(x, 120, H2*0.66, 130, -Math.PI/4);
  if (sub) { fit(x, name, W2 - 270, 88); x.fillText(name, 220, H2*0.58); fit(x, sub, W2 - 270, 52, 600); x.fillText(sub, 220, H2*0.82); }
  else { fit(x, name, W2 - 270, 104); x.fillText(name, 220, H2*0.68); }
}); }
function destPanel(w, h, lines){ return canvasTex(w, h, (x, W2, H2) => {
  base(x, W2, H2); x.fillStyle = '#fff'; x.textBaseline = 'middle';
  arrow(x, 110, H2/2, 170, 0);
  const lh = (H2 - 80) / lines.length;
  lines.forEach((t, i) => { const y = 40 + lh*(i+0.5), S = Math.min(lh*0.72, 96), iw = iconTile(x, iconFor(t), 196, y - S/2, S), tx = iw ? 196 + S + 26 : 200;
    x.fillStyle = '#fff'; fit(x, t, W2 - tx - 50, 100); x.fillText(t, tx, y); });
}); }
function boardPanel(w, h, rows, col=SIGN_GREEN){ return canvasTex(w, h, (x, W2, H2) => {
  base(x, W2, H2, col); x.fillStyle = '#fff'; x.textBaseline = 'middle';
  const lh = (H2 - 80) / rows.length;
  rows.forEach(([t, d], i) => { const y = 40 + lh*(i+0.5); x.textAlign = 'right'; x.font = `700 84px ${SIGN_FONT}`; x.fillText(d, W2 - 56, y);
    const S = Math.min(lh*0.7, 86), iw = iconTile(x, iconFor(t), 52, y - S/2, S), tx = iw ? 52 + S + 22 : 56;
    x.fillStyle = '#fff'; x.textAlign = 'left'; fit(x, t, W2 - 344 - (tx - 56), 84); x.fillText(t, tx, y); });
}); }
function textPanel(w, h, bg, l1, l2, icons = null){ return canvasTex(w, h, (x, W2, H2) => { x.fillStyle = bg; x.fillRect(0,0,W2,H2); x.strokeStyle = '#fff'; x.lineWidth = 10; x.strokeRect(16,16,W2-32,H2-32); x.textBaseline = 'middle';
  // with a second line the icons get a row of their own between the two lines
  if (l2 && icons && icons.length && H2 > 300) { const S = Math.min(H2*0.26, 150); iconRow(x, icons, 50 + Math.min(W2 - 100, icons.length*S*1.16), H2*0.53 - S/2, S); x.fillStyle = '#fff';
    fit(x, l1, W2 - 100, H2*0.24, 800); x.fillText(l1, 50, H2*0.22); fit(x, l2, W2 - 100, H2*0.13, 600); x.fillText(l2, 50, H2*0.83); return; }
  const S = l2 ? Math.min(H2*0.3, 130) : H2*0.62, iw = iconRow(x, icons, W2 - 46, l2 ? H2*0.38 - S/2 : (H2 - S)/2, S), room = W2 - 100 - (iw ? iw + 30 : 0); x.fillStyle = '#fff';
  if (l2) { fit(x, l1, room, H2*0.32, 800); x.fillText(l1, 50, H2*0.38); fit(x, l2, W2-100, H2*0.18, 600); x.fillText(l2, 50, H2*0.72); } else { fit(x, l1, room, H2*0.5, 800); x.fillText(l1, 50, H2/2); } }); }
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
const lbOff = M(0x3a3a40, {roughness:0.5}), ambStripe = M(0xd8201a, {roughness:0.4}), ambOrange = M(0xf08a1a, {roughness:0.4}), ladderMat = M(0xc8ccd0, {metalness:0.7, roughness:0.35}), angkotStripe = M(0xf4f4f2, {roughness:0.4});
const SHARED = new Set([headMat, tailMat, brakeMat, glassMat, tyreMat, polRed, polBlue, polStripe, lbOff, ambStripe, ambOrange, ladderMat, angkotStripe]);
// light bar: a dark housing that is always there, and red/blue lamps shown only while the siren runs (they flash in place())
function lightBar(g, w, y, z){ box(w, 0.12, 0.3, lbOff, 0, y, z, g); const a = box(w*0.45, 0.15, 0.32, polRed, -w*0.26, y + 0.01, z, g), b = box(w*0.45, 0.15, 0.32, polBlue, w*0.26, y + 0.01, z, g); a.visible = b.visible = false; return [a, b]; }
const EMERG = new Set(['ambulance', 'damkar', 'police']);
const towAmber = new THREE.MeshStandardMaterial({color: 0x553300, emissive: 0xffa000, emissiveIntensity: 3}); SHARED.add(towAmber);
const taxiSignTex = canvasTex(1, 0.36, (x, w, h) => { x.fillStyle = '#fff9e0'; x.fillRect(0, 0, w, h); x.fillStyle = '#1e4f9a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 230px Archivo, sans-serif'; x.fillText('TAXI', w/2, h/2 + 10); });
const taxiSignMat = new THREE.MeshStandardMaterial({map: taxiSignTex, emissive: 0xffffff, emissiveMap: taxiSignTex, emissiveIntensity: 0.6}); SHARED.add(taxiSignMat);
const wheelGeo = new THREE.CylinderGeometry(1,1,1,14); wheelGeo.rotateZ(Math.PI/2); wheelGeo.userData.keep = true;
const PAINT = [0xf4f4f2,0xf4f4f2,0x1b1c1f,0x1b1c1f,0x8d939a,0x8d939a,0x5d6670,0xb22a26,0x1f3f73,0x2f5a4a,0xcfc4ae,0x6a1d2b,0xd77b2b];
const geoCache = new Map();
const bgeo = (w,h,d) => { const k = `${w}|${h}|${d}`; if (!geoCache.has(k)) { const g = new THREE.BoxGeometry(w,h,d); g.userData.keep = true; geoCache.set(k, g); } return geoCache.get(k); };
function box(w,h,d,mat,x,y,z,g){ const m = new THREE.Mesh(bgeo(w,h,d),mat); m.position.set(x,y,z); m.castShadow = true; g.add(m); return m; }

// ---------- realistic low-poly vehicles: side profiles extruded across the width (shared, cached geometry) ----------
const busSignMat = M(0x111111, {emissive: 0xffa000, emissiveIntensity: 0.6}), bedMat = M(0x8a8f93, {metalness: 0.6}); SHARED.add(busSignMat); SHARED.add(bedMat);
const extCache = new Map(), rimMat = M(0xc9ccd0, {metalness: 0.85, roughness: 0.25}), trimMat = M(0x1c1d1f, {roughness: 0.7}), plateMat = M(0xf4f4f0, {roughness: 0.5}),
  grilleMat = M(0x121314, {roughness: 0.5, metalness: 0.4}), chromeMat = M(0xd9dcdf, {metalness: 0.9, roughness: 0.2});
[rimMat, trimMat, plateMat, grilleMat, chromeMat].forEach(m => SHARED.add(m));
const rimGeo = new THREE.CylinderGeometry(1, 1, 1, 14); rimGeo.rotateZ(Math.PI/2); rimGeo.userData.keep = true;
function ext(key, pts, width, bevel = 0.05){
  const k = key + '|' + width; let geo = extCache.get(k);
  if (!geo) { const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))), d = Math.max(0.01, width - 2*bevel);
    geo = new THREE.ExtrudeGeometry(sh, {depth: d, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4});
    geo.translate(0, 0, -d/2); geo.rotateY(-Math.PI/2); geo.computeVertexNormals(); geo.userData.keep = true; extCache.set(k, geo); }
  return geo; }
function part(g, geo, mat, shadow = true){ const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; g.add(m); return m; }
function wheels(g, pts, r, w){ return pts.map(([x,z]) => { const m = new THREE.Mesh(wheelGeo, tyreMat); m.scale.set(w, r, r); m.position.set(x, r, z);
  const rim = new THREE.Mesh(rimGeo, rimMat); rim.scale.set(1.06, 0.6, 0.6); m.add(rim); g.add(m); return m; }); }
// lamps, bumpers, grille, plates and mirrors common to cars
function carDetails(g, {w, len, yL, yT, yB, zF = len/2, zR = -len/2, mirY, mirZ, tail, grille = 0.5}){
  for (const s2 of [-1, 1]) { box(0.44, 0.13, 0.08, headMat, s2*w*0.33, yL, zF - 0.02, g); box(0.36, 0.15, 0.06, tail, s2*w*0.38, yT, zR + 0.02, g);
    box(0.08, 0.1, 0.2, trimMat, s2*(w/2 + 0.07), mirY, mirZ, g); }
  box(w*grille, 0.2, 0.06, grilleMat, 0, yL - 0.12, zF - 0.01, g);
  box(w + 0.04, 0.2, 0.22, trimMat, 0, yB, zF - 0.08, g); box(w + 0.04, 0.2, 0.22, trimMat, 0, yB, zR + 0.08, g);
  box(0.46, 0.14, 0.03, plateMat, 0, yB + 0.02, zF + 0.04, g); box(0.46, 0.14, 0.03, plateMat, 0, yB + 0.17, zR - 0.04, g); }

// ---------- Indonesian number plates: region code + number + letters, expiry month · year; colour by category ----------
const PLATE_STYLE = {pribadi: ['#f6f6f2', '#111111'], umum: ['#f2c21b', '#111111'], dinas: ['#c4161c', '#ffffff'], polri: ['#1b1b1b', '#ffffff'],
  diplomatik: ['#1f4fa8', '#ffffff'], fta: ['#1e8a4a', '#111111'], listrik: ['#f6f6f2', '#111111']};
const PLATE_NAME = {pribadi: 'Pribadi (putih)', umum: 'Umum / angkutan (kuning)', dinas: 'Dinas pemerintah (merah)', polri: 'Polri (hitam)', diplomatik: 'Korps diplomatik (biru)', fta: 'Kawasan perdagangan bebas (hijau)', listrik: 'Kendaraan listrik (strip biru)'};
// region code from where the vehicle is (Samsat areas, simplified by longitude/latitude)
function regionCode(lat, lon){
  if (lon < 106.4) return pick(['A', 'A', 'B']);
  if (lon < 106.98 && lat > -6.45) return 'B';
  if (lon < 107.05) return pick(['F', 'F', 'B']);
  if (lon < 107.55 && lat > -6.5) return pick(['T', 'T', 'B']);
  if (lon < 108.05) return pick(['D', 'D', 'Z', 'F']);
  if (lon < 108.8) return pick(['E', 'E', 'Z']);
  if (lon < 109.5) return pick(['G', 'R', 'R']);
  if (lon < 110.15) return pick(['G', 'AA', 'H']);
  if (lon < 110.55) return lat < -7.5 ? pick(['AB', 'AB', 'AA']) : pick(['H', 'H', 'K']);
  if (lon < 111.2) return lat < -7.3 ? pick(['AD', 'AD', 'AB']) : pick(['K', 'H']);
  if (lon < 112.0) return pick(['AE', 'AG', 'S']);
  if (lon < 112.9) return lat < -7.6 ? pick(['N', 'AG']) : pick(['L', 'L', 'W', 'S']);
  return pick(['P', 'N', 'M']);
}
const L3 = () => Array.from({length: 1 + Math.floor(Math.random()*3)}, () => 'ABCDEFGHJKLMNPRSTUVWXYZ'[Math.floor(Math.random()*23)]).join('');
function randPlate(cat, reg){
  if (cat === 'polri') return [`${1000 + Math.floor(Math.random()*8999)}-${pick(['I','II','VII','VIII','IX','X'])}`, 'POLRI'];
  if (cat === 'diplomatik') return [`CD ${10 + Math.floor(Math.random()*80)} ${10 + Math.floor(Math.random()*80)}`, ''];
  if (cat === 'dinas') return [`${reg} ${1 + Math.floor(Math.random()*999)} ${pick(['', 'A', 'B', 'D'])}`.trim(), 'DINAS'];
  const y = 25 + Math.floor(Math.random()*5), mo = String(1 + Math.floor(Math.random()*12)).padStart(2, '0');
  return [`${reg} ${1 + Math.floor(Math.random()*9998)} ${L3()}`, `${mo} · ${y}`];
}
function plateCanvas(main, sub, cat){
  const [bg, fg] = PLATE_STYLE[cat] || PLATE_STYLE.pribadi, c = document.createElement('canvas'); c.width = 320; c.height = 92; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 320, 92); x.strokeStyle = fg; x.lineWidth = 5; x.strokeRect(5, 5, 310, 82);
  if (cat === 'listrik') { x.fillStyle = '#1f5fbf'; x.fillRect(8, 70, 304, 14); }
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; fit(x, main, 290, 54, 800); x.fillText(main, 160, sub ? 36 : 47);
  if (sub) { x.font = '700 20px Archivo, sans-serif'; x.fillStyle = cat === 'listrik' ? '#fff' : fg; x.fillText(sub, 160, 75); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// AI plates: a pool of ready-made plate materials per category + region, reused across vehicles
// (capped: at most 8 plates per category + region and 160 plate textures in all, so long trips do not pile up GPU memory)
const platePool = new Map(); let plateCount = 0;
function plateMatFor(cat, reg){
  const k = cat + reg; let pool = platePool.get(k); if (!pool) platePool.set(k, pool = []);
  if (!pool.length && plateCount >= 160) { const any = [...platePool.entries()].filter(([kk, pp]) => kk.startsWith(cat) && pp.length).map(([, pp]) => pp); if (any.length) return pick(pick(any)); }
  if (pool.length < 8 && plateCount < 160 || !pool.length) { plateCount++; const [m1, m2] = randPlate(cat, reg), mat = new THREE.MeshStandardMaterial({map: plateCanvas(m1, m2, cat), roughness: 0.45}); mat.userData.plate = true; SHARED.add(mat); pool.push(mat); return mat; }
  return pick(pool);
}
const plateCatOf = type => type === 'police' ? 'polri' : type === 'damkar' ? 'dinas' : ['taxi', 'angkot', 'bus', 'truck', 'derek'].includes(type) ? 'umum'
  : type === 'pickup' || type === 'van' ? (Math.random() < 0.3 ? 'umum' : 'pribadi') : Math.random() < 0.03 ? 'dinas' : Math.random() < 0.02 ? 'listrik' : Math.random() < 0.004 ? 'diplomatik' : 'pribadi';
function plateVehicle(g, type){
  const ll = EV.length ? latLonAt(camU) : {lat: -6.2, lon: 106.8}, mat = plateMatFor(plateCatOf(type), regionCode(ll.lat, ll.lon));
  g.traverse(o => { if (o.isMesh && o.material === plateMat) o.material = mat; });
}

// ---------- performance: AI vehicles are merged into a few meshes (one per material), cached per model ----------
// A built vehicle is ~30 small meshes; drawing 150 of them costs thousands of draw calls. After building, all parts that
// share a material are merged into one geometry (the result is cached and shared by every vehicle with the same model),
// and each wheel becomes one mesh with tyre + rim in vertex colours.
const wheelVCGeo = (() => { const t = wheelGeo.clone().toNonIndexed(), r = rimGeo.clone().toNonIndexed(); r.scale(1.06, 0.6, 0.6);
  const col = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n*3); const k = new THREE.Color(c); for (let i = 0; i < n; i++) { a[i*3] = k.r; a[i*3+1] = k.g; a[i*3+2] = k.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); };
  col(t, 0x161616); col(r, 0xb9bcc0); for (const g of [t, r]) g.deleteAttribute('uv'); const m = mergeGeometries([t, r]); m.userData.keep = true; return m; })();
const wheelVCMat = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.55, metalness: 0.35}); SHARED.add(wheelVCMat);
const mergeCache = new Map(), _mInv = new THREE.Matrix4(), _mRel = new THREE.Matrix4();
// small dark/trim parts share one vertex-coloured material, so they cost a single draw call per vehicle
const detailVCMat = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.4, metalness: 0.45}); SHARED.add(detailVCMat);
const DETAIL = new Set([glassMat, trimMat, grilleMat, chromeMat, lbOff, angkotStripe, ladderMat, ambStripe, ambOrange, polStripe, bedMat, signBackMat]);
function mergeVehicle(v){
  const g = v.g, keep = new Set([...(v.wh || []), ...(v.lights || [])]); g.updateMatrixWorld(true); _mInv.copy(g.matrixWorld).invert();
  const parts = []; g.traverse(o => { if (!o.isMesh || keep.has(o) || keep.has(o.parent)) return; parts.push(o); });
  if (parts.length < 4) return;
  // materials in first-seen order; shared ones by identity, per-vehicle ones by their slot number
  const keyOf = o => DETAIL.has(o.material) ? 'D' : o.material, mats = [], slot = new Map();
  for (const o of parts) { const k = keyOf(o); if (!slot.has(k)) { slot.set(k, mats.length); mats.push(k === 'D' ? detailVCMat : o.material); } }
  const sig = v.type + '|' + parts.map(o => `${o.geometry.id}:${DETAIL.has(o.material) ? 'D' + o.material.id : SHARED.has(o.material) || !o.material.userData.own ? 's' + o.material.id : 'o' + slot.get(keyOf(o))}:${o.position.x.toFixed(2)},${o.position.y.toFixed(2)},${o.position.z.toFixed(2)},${o.rotation.x.toFixed(2)}`).join(';');
  let tpl = mergeCache.get(sig);
  if (!tpl) { tpl = mats.map((m, i) => { const geos = parts.filter(o => slot.get(keyOf(o)) === i).map(o => { _mRel.multiplyMatrices(_mInv, o.matrixWorld); const gg = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(_mRel);
        for (const a of Object.keys(gg.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv') gg.deleteAttribute(a); if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count*2), 2));
        if (m === detailVCMat) { const n = gg.attributes.position.count, ca = new Float32Array(n*3), c = o.material.color; for (let j = 0; j < n; j++) { ca[j*3] = c.r; ca[j*3+1] = c.g; ca[j*3+2] = c.b; } gg.setAttribute('color', new THREE.BufferAttribute(ca, 3)); }
        gg.clearGroups(); return gg; });
      const mg = geos.length === 1 ? geos[0] : mergeGeometries(geos); if (mg) mg.userData.keep = true; return mg; }); mergeCache.set(sig, tpl); }
  if (tpl.some(gm => !gm)) return;
  for (const o of parts) o.parent.remove(o);
  tpl.forEach((gm, i) => { const m = new THREE.Mesh(gm, mats[i]); m.castShadow = i === 0; g.add(m); });
  for (const w of v.wh) { w.geometry = wheelVCGeo; w.material = wheelVCMat; w.clear(); w.castShadow = false; }
}

function makeVehicle(type, color, noMerge = false){
  const g = new THREE.Group(); let len, wh, r, v0;
  const own = c => { const m = M(c, {roughness:0.4, metalness:0.3}); m.userData.own = true; return m; };
  const paint = own(color ?? (type==='taxi' ? 0x1e5aa8 : type==='derek' ? 0xf2b705 : type==='police' || type==='ambulance' ? 0xf6f6f4 : type==='damkar' ? 0xc8160f : type==='angkot' ? pick([0x2a6fd1,0x2f9a4a,0x2f9a4a,0xd23a2a,0xe8c22a,0x3a9fd8,0x8a2bb0]) : pick(PAINT))); paint.roughness = 0.3; paint.metalness = 0.45;
  const tail = color != null ? brakeMat : tailMat; let lights = null;
  if (type==='car' || type==='police' || type==='taxi'){
    // sedan: sloping hood and windscreen, glasshouse, roof, short boot
    len = 4.5; r = 0.32; const w = 1.78;
    part(g, ext('sedL', [[-2.25,0.3],[2.18,0.3],[2.27,0.5],[2.24,0.74],[1.1,0.93],[-1.55,0.98],[-2.18,0.94],[-2.27,0.66]], w), paint);
    part(g, ext('sedG', [[1.08,0.9],[0.28,1.37],[-0.98,1.39],[-1.62,0.96]], w*0.86, 0.03), glassMat, false);
    part(g, ext('sedR', [[0.32,1.34],[-1.0,1.36],[-0.98,1.43],[0.26,1.41]], w*0.88, 0.03), paint);
    box(w*0.87, 0.42, 0.09, paint, 0, 1.15, -0.32, g);                                   // B-pillar
    carDetails(g, {w, len, yL: 0.7, yT: 0.86, yB: 0.42, mirY: 1.0, mirZ: 0.95, tail});
    if (type==='police') { box(w+0.03, 0.14, len*0.86, polStripe, 0, 0.72, 0, g); lights = lightBar(g, 1.2, 1.5, -0.35); }
    if (type==='taxi') { box(0.62, 0.22, 0.24, taxiSignMat, 0, 1.54, -0.3, g); box(w+0.03, 0.08, len*0.86, angkotStripe, 0, 0.8, 0, g); }
    wh = wheels(g, [[-w/2+0.14,1.38],[w/2-0.14,1.38],[-w/2+0.14,-1.33],[w/2-0.14,-1.33]], r, 0.24); v0 = rnd(24, 27.5);
  } else if (type==='suv'){
    len = 4.75; r = 0.38; const w = 1.92;
    part(g, ext('suvL', [[-2.35,0.42],[2.3,0.42],[2.38,0.68],[2.33,0.98],[1.25,1.1],[-2.33,1.14],[-2.38,0.72]], w), paint);
    part(g, ext('suvG', [[1.22,1.06],[0.42,1.6],[-2.2,1.64],[-2.3,1.1]], w*0.9, 0.03), glassMat, false);
    part(g, ext('suvR', [[0.45,1.57],[-2.22,1.61],[-2.2,1.7],[0.38,1.66]], w*0.92, 0.03), paint);
    for (const z of [-0.45, -1.5]) box(w*0.91, 0.5, 0.1, paint, 0, 1.36, z, g);
    for (const s2 of [-1, 1]) box(0.05, 0.05, 2.3, chromeMat, s2*w*0.38, 1.75, -0.9, g);   // roof rails
    carDetails(g, {w, len, yL: 0.88, yT: 1.0, yB: 0.55, mirY: 1.18, mirZ: 1.1, tail, grille: 0.6});
    wh = wheels(g, [[-w/2+0.15,1.45],[w/2-0.15,1.45],[-w/2+0.15,-1.45],[w/2-0.15,-1.45]], r, 0.27); v0 = rnd(24, 27.5);
  } else if (type==='pickup'){
    len = 4.9; r = 0.36; const w = 1.76;
    part(g, ext('pkL', [[-2.45,0.4],[2.38,0.4],[2.46,0.64],[2.4,0.92],[1.35,1.04],[-2.45,1.04],[-2.5,0.62]], w), paint);
    part(g, ext('pkG', [[1.32,1.0],[0.66,1.55],[-0.42,1.57],[-0.46,1.02]], w*0.9, 0.03), glassMat, false);
    part(g, ext('pkR', [[0.68,1.53],[-0.46,1.55],[-0.46,1.62],[0.62,1.6]], w*0.92, 0.03), paint);
    for (const s2 of [-1, 1]) box(0.07, 0.38, 1.95, paint, s2*(w/2 - 0.04), 1.23, -1.45, g);
    box(w, 0.38, 0.07, paint, 0, 1.23, -2.42, g); box(w*0.9, 0.04, 1.9, trimMat, 0, 1.05, -1.45, g);
    carDetails(g, {w, len, yL: 0.8, yT: 1.05, yB: 0.52, mirY: 1.12, mirZ: 1.2, tail});
    wh = wheels(g, [[-w/2+0.14,1.55],[w/2-0.14,1.55],[-w/2+0.14,-1.45],[w/2-0.14,-1.45]], r, 0.25); v0 = rnd(21, 25);
  } else if (type==='van' || type==='ambulance' || type==='angkot'){
    // one-box minibus (Hiace / Elf / Carry): short sloping nose, tall body, window band
    const A = type === 'angkot'; len = A ? 4.3 : 5.4; r = A ? 0.3 : 0.36; const w = A ? 1.66 : 1.95, hl = len/2, top = A ? 1.92 : 2.22;
    part(g, ext(type + 'B', [[-hl,r + 0.05],[hl - 0.08,r + 0.05],[hl,r + 0.35],[hl - 0.06,1.05],[hl - 0.55,1.2],[hl - 0.95,top],[-hl + 0.05,top + 0.02],[-hl,top - 0.1]], w, 0.07), paint);
    for (const s2 of [-1, 1]) box(0.02, 0.5, len - 1.5, glassMat, s2*(w/2 + 0.075), top - 0.62, -0.35, g);       // side window band
    box(w*0.9, 0.62, 0.05, glassMat, 0, top - 0.55, hl - 0.74, g).rotation.x = -0.55;                                 // windscreen
    box(w*0.8, 0.45, 0.04, glassMat, 0, top - 0.55, -hl - 0.05, g);
    carDetails(g, {w, len, yL: 0.72, yT: 0.95, yB: r + 0.15, mirY: 1.25, mirZ: hl - 0.5, tail, grille: 0.45});
    if (type === 'ambulance') { box(w + 0.03, 0.22, len - 1.1, ambStripe, 0, 1.0, -0.4, g); box(w + 0.03, 0.08, len - 1.1, ambOrange, 0, 1.18, -0.4, g); lights = lightBar(g, 1.3, top + 0.12, hl - 1.2); }
    if (A) { box(w + 0.03, 0.08, len - 0.4, angkotStripe, 0, 1.0, 0, g); box(0.05, 1.0, 0.9, trimMat, w/2 + 0.03, 0.95, -0.2, g); box(w*0.85, 0.2, 0.45, angkotStripe, 0, top + 0.12, hl - 1.1, g); }
    wh = wheels(g, [[-w/2+0.14,hl - 0.85],[w/2-0.14,hl - 0.85],[-w/2+0.14,-hl + 0.9],[w/2-0.14,-hl + 0.9]], r, A ? 0.2 : 0.25);
    v0 = A ? rnd(13, 17) : type === 'ambulance' ? rnd(25, 28) : rnd(22, 25.5);
  } else if (type==='moto'){
    len = 2; r = 0.3;
    box(0.12, 0.12, 1.2, trimMat, 0, r + 0.25, 0, g); box(0.28, 0.32, 0.6, paint, 0, r + 0.55, 0.15, g); box(0.26, 0.1, 0.62, trimMat, 0, r + 0.72, -0.3, g);
    box(0.5, 0.06, 0.06, chromeMat, 0, r + 0.95, 0.6, g); box(0.1, 0.5, 0.08, chromeMat, 0, r + 0.55, 0.62, g);
    box(0.44, 0.58, 0.4, own(pick([0x1f3f73,0x2a2a2a,0x6a1d2b,0x3e5a3a,0x8a6a3a])), 0, r + 1.05, -0.2, g);
    box(0.3, 0.32, 0.32, own(pick([0x111111,0xf2f2f2,0xc81e1e,0x1f3f73])), 0, r + 1.5, -0.12, g); box(0.24, 0.1, 0.04, glassMat, 0, r + 1.5, 0.05, g);
    for (const s2 of [-1, 1]) box(0.1, 0.45, 0.12, trimMat, s2*0.18, r + 0.5, 0.0, g);
    box(0.14, 0.1, 0.06, headMat, 0, r + 0.7, 0.68, g); box(0.14, 0.08, 0.06, tail, 0, r + 0.58, -0.68, g);
    wh = wheels(g, [[0,0.66],[0,-0.62]], r, 0.11); v0 = rnd(11, 15);
  } else if (type==='truck' || type==='damkar' || type==='derek'){
    // cab-over truck cab with rounded front edges, then a box trailer (truck), a body with ladder (fire engine) or a flat bed (tow truck)
    const T = type === 'truck'; len = T ? 16 : type === 'damkar' ? 9 : 8.6; r = T ? 0.5 : 0.46; const w = T ? 2.5 : 2.4, hl = len/2;
    const cab = T ? (color != null ? paint : own(pick([0xf4f4f2,0x1f3f73,0xb22a26,0x2f5a4a,0x1b1c1f,0xe0a020]))) : paint;
    const cg = new THREE.Group(); cg.position.z = hl - 2.4; g.add(cg);
    part(cg, ext('cab' + w, [[0,r + 0.3],[2.35,r + 0.3],[2.42,r + 0.75],[2.42,2.5],[2.25,3.05],[0.05,3.15],[0,2.9]], w, 0.12), cab);
    box(w*0.9, 0.85, 0.06, glassMat, 0, 2.55, 2.5, cg).rotation.x = -0.1; for (const s2 of [-1, 1]) box(0.05, 0.6, 0.9, glassMat, s2*(w/2 + 0.1), 2.5, 1.6, cg);
    box(w*0.6, 0.5, 0.06, grilleMat, 0, 1.35, 2.54, cg); box(w + 0.06, 0.3, 0.25, trimMat, 0, r + 0.35, 2.45, cg);
    for (const s2 of [-1, 1]) { box(0.35, 0.18, 0.06, headMat, s2*0.85, r + 0.75, 2.55, cg); box(0.08, 0.55, 0.16, trimMat, s2*(w/2 + 0.2), 2.4, 2.35, cg); }
    box(0.5, 0.12, 0.03, plateMat, 0, r + 0.4, 2.6, cg);
    box(w*0.86, 0.35, len - 2.6, trimMat, 0, r + 0.55, -1.2, g);                                   // chassis
    if (T) { const tr = own(pick([0xe8e8e4,0xdcdcd6,0x9aa1a6,0x3a5f8f,0xc4462a])); tr.roughness = 0.7;
      part(g, ext('trl', [[-hl,r + 0.75],[hl - 2.7,r + 0.75],[hl - 2.7,4.0],[-hl,4.0]], w, 0.05), tr);
      for (const s2 of [-1, 1]) box(0.05, 0.3, 6, chromeMat, s2*(w/2 - 0.05), r + 0.45, -1.5, g); }
    else if (type === 'damkar') { box(w, 2.1, len - 2.6, paint, 0, r + 1.5, -1.2, g); box(w + 0.03, 0.18, len - 2.6, angkotStripe, 0, r + 1.2, -1.2, g);
      for (let k = 0; k < 4; k++) box(0.04, 1.4, 1.1, chromeMat, w/2 + 0.02, r + 1.6, -hl + 1 + k*1.2, g);
      box(0.9, 0.16, len - 1.2, ladderMat, 0, r + 2.7, -0.7, g); for (const s2 of [-1,1]) box(0.08, 0.3, len - 1.2, ladderMat, s2*0.45, r + 2.75, -0.7, g);
      lights = lightBar(cg, 1.8, 3.25, 1.2); }
    else { box(w, 0.25, len - 2.6, bedMat, 0, r + 0.95, -1.2, g); box(0.5, 0.7, 0.5, trimMat, 0, r + 1.4, hl - 2.9, g);
      lights = [box(0.5, 0.15, 0.3, towAmber, -0.4, 3.25, 1.2, cg), box(0.5, 0.15, 0.3, towAmber, 0.4, 3.25, 1.2, cg)]; lights.forEach(l => l.visible = false); }
    for (const s2 of [-1, 1]) box(0.25, 0.25, 0.06, tail, s2*1.05, r + 0.9, -hl, g);
    wh = wheels(g, T ? [[-1.1,6.6],[1.1,6.6],[-1.1,4.6],[1.1,4.6],[-1.1,-4.6],[1.1,-4.6],[-1.1,-6],[1.1,-6]] : [[-1.05,hl - 1.3],[1.05,hl - 1.3],[-1.05,-hl + 2.3],[1.05,-hl + 2.3],[-1.05,-hl + 1.1],[1.05,-hl + 1.1]], r, 0.36);
    v0 = T ? rnd(18, 21.5) : type === 'damkar' ? rnd(21, 24) : rnd(20, 23);
  } else {
    // city / intercity bus: rounded front, deep window band, livery stripe, destination board
    len = 12.5; r = 0.5; const w = 2.5, hl = len/2;
    const body = color != null ? paint : own(pick([0xf4f4f2,0x1f3f73,0x2f5a4a,0x5d6670,0xb22a26]));
    part(g, ext('bus', [[-hl,0.5],[hl - 0.05,0.5],[hl,0.95],[hl,2.9],[hl - 0.25,3.45],[-hl + 0.1,3.5],[-hl,3.3]], w, 0.12), body);
    for (const s2 of [-1, 1]) box(0.03, 1.05, len - 1.6, glassMat, s2*(w/2 + 0.115), 2.35, -0.4, g);
    box(w*0.92, 1.4, 0.05, glassMat, 0, 2.35, hl + 0.11, g); box(w*0.7, 0.28, 0.05, busSignMat, 0, 3.2, hl + 0.12, g);
    box(w + 0.25, 0.25, len - 0.6, angkotStripe, 0, 1.3, 0, g); box(0.04, 2.1, 1.0, trimMat, w/2 + 0.12, 1.55, hl - 1.6, g);
    for (const s2 of [-1, 1]) { box(0.4, 0.18, 0.06, headMat, s2*0.9, 0.95, hl + 0.1, g); box(0.25, 0.4, 0.06, tail, s2*1.05, 1.2, -hl - 0.1, g); box(0.08, 0.5, 0.16, trimMat, s2*(w/2 + 0.25), 2.6, hl - 0.1, g); }
    box(0.52, 0.12, 0.03, plateMat, 0, 0.65, hl + 0.12, g);
    wh = wheels(g, [[-1.1,4.2],[1.1,4.2],[-1.1,-3.4],[1.1,-3.4],[-1.1,-4.8],[1.1,-4.8]], r, 0.38); v0 = rnd(21, 23.5);
  }
  plateVehicle(g, type);
  const res = {g, len, wh, front: null, r, v0, type, lights};
  if (!noMerge && color == null) mergeVehicle(res);
  bendObj(g);
  g.rotation.order = 'YXZ';
  const front = wh.filter(w => w.position.z > 0); for (const w of front) w.rotation.order = 'YXZ'; res.front = front;
  return res;
}
const LEN = t => t === 'truck' ? 16 : t === 'bus' ? 12.5 : t === 'damkar' ? 9 : t === 'derek' ? 8.6 : 6;
function killVehicle(v){ if (v.g.parent) v.g.parent.remove(v.g); v.g.traverse(o => { if (!o.isMesh) return; if (!SHARED.has(o.material) && o.material.userData.own) { if (o.material.map && !o.material.userData.plate) o.material.map.dispose(); o.material.dispose(); } if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); }); v.dead = true; }
const rm = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); };
const heavy = v => v.type==='truck' || v.type==='bus';
const heavyMin = n => n >= 5 ? 2 : n >= 2 ? 1 : 0;

// ================================================================
// TRIP LAYOUT — route events placed along u
// ================================================================
let trip = null, EV = [], SITES = [], RSITES = [], PLAZAS = [], KSITES = [], ZONES = [], OVS = [], OPENS = [], OBJ = [], CHG = [];
const laneSegs = {'1': [], '-1': []};
const nCorr = c => cfg.lanes === 'auto' ? CORR[c].lanes : +cfg.lanes;   // the lane setting applies to every road
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
      if (nCorr(EV[i].c) < 2) { if (ty === 'rw') lastRW = due; else lastCF = due; continue; }
      if (pos + ZEXT[ty] > a + gap) { if (due > a + gap) break; gap = pos + ZEXT[ty] - a; }
      ZONES.push(oldZ.find(z => z.type === ty && Math.abs(z.u - pos) < 0.5) || {type: ty, u: pos}); if (ty === 'rw') lastRW = pos; else lastCF = pos;
      cur = pos + 1500;
    }
    EV[i].u = a + gap;
  }
  layoutElev(); segT = 0;
  for (const z of oldZ) if (z.user && !ZONES.includes(z)) ZONES.push(z);
  ZONES.sort((a, b) => a.u - b.u);
  // corridor KM of each event on the corridor that LEAVES it
  for (const e of EV) { const n = CORR[e.cNext].nodes.find(n => n.key === e.key); e.kmOut = n ? n.km : e.km; }
  layoutMbz();
  // no roadworks or contraflow on or next to the MBZ ramps
  if (MBZG) { const G = MBZG; ZONES = ZONES.filter(z => z.user || !((z.u > G.F - 900 && z.u < G.uH + 600) || (z.u > G.uE - 600 && z.u < G.M + 900))); }
  // lane changes between corridors: taper over the 150 m before c
  CHG = []; let n = nCorr(EV[0].c); const nStart = n;
  for (const e of EV) {
    // the MBZ's road has Japek's lanes again past the end of the deck (hidden there: the cars use the side ramps)
    const G = MBZG && MBZG.frame === 'mbz' ? MBZG : null;
    if (G && e.c === 'mbz' && e.i > 0 && EV[e.i - 1].cNext === 'mbz') { const nj = nCorr('japek'); if (nj !== n) { CHG.push({c: G.uE + 150, n0: n, n1: nj}); n = nj; } }
    const n1 = nCorr(e.cNext); if (n1 !== n) { CHG.push({c: G && e.cNext === 'mbz' ? G.uH : e.u + 450, n0: n, n1}); n = n1; } }
  laneSegs['1'] = [{p: -Infinity, n: nStart}]; laneSegs['-1'] = [{p: -Infinity, n}];
  for (const c of CHG) laneSegs['1'].push({p: c.n1 < c.n0 ? c.c - 150 : c.c, n: c.n1});
  for (const c of [...CHG].reverse()) laneSegs['-1'].push({p: c.n0 < c.n1 ? -c.c : -(c.c - 150), n: c.n0});
  SITES = EV.filter(e => SITEK.has(e.kind));
  RSITES = SITES.filter(e => RAMPK.has(e.kind)); PLAZAS = SITES.filter(e => PLZK.has(e.kind)); KSITES = SITES.filter(e => e.kind === 'k');
  for (const s of SITES) { s.id = 's' + s.i; if (!s.bays) s.bays = {'1': null, '-1': null}; if (s.phase == null) s.phase = Math.random()*SIG_CYCLE; }
  // overpasses and closed U-turn openings in the empty stretches
  const clear = (u, r) => isToll(u) && !mbzNoOv(u) && !SITES.some(s => Math.abs(s.u - u) < 780 + r) && !ZONES.some(z => Math.abs(z.u - u) < ZEXT[z.type] - 400 + r);
  const lastU = EV[EV.length-1].u;
  // overpasses over toll roads every ~1.5 km, over national roads (outside towns) every ~3 km
  const clearOv = (u, r) => (isToll(u) || nAt(u) >= 2) && !mbzNoOv(u) && elevAt(u) < 0.5 && elevAt(u + 300) < 0.5 && elevAt(u - 300) < 0.5 && !SITES.some(s => Math.abs(s.u - u) < 780 + r) && !ZONES.some(z => Math.abs(z.u - u) < ZEXT[z.type] - 400 + r);
  OVS = []; for (let u = -2600, j = 0; u < lastU + 6000; u += 1450, j++) { let v = u; for (let k = 0; k < 8 && !clearOv(v, 0); k++) v += 180; if (clearOv(v, 0) && (isToll(v) || j % 2 === 0)) OVS.push(oldV.find(o => Math.abs(o.u - v) < 0.5) || {u: v}); }
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
function addBlock(d, l, a, len, fork = false){ const k = key(d,l); if (!blocks.has(k)) blocks.set(k, []); blocks.get(k).push([a, len, fork]); }
function zoneCap(d, front){ let c = 40;
  for (const [zd, a, len, vl] of SPZ) { if (zd !== d) continue;
    if (front - a >= 0 && front - a < len) c = Math.min(c, vl); else { const dist = a - front; if (dist > 0 && dist < 400) c = Math.min(c, Math.sqrt(vl*vl + 3*dist)); } }
  return c; }
function postedCap(d, front){ let c = 40; for (const [zd, a, len, vl] of SPZ) if (zd === d && front - a >= 0 && front - a < len) c = Math.min(c, vl); return c; }
function cfAt(sd, p){ for (const z of CFA) if (z.A === sd && p >= z.CF_IN - 260 && p <= z.CF_END + 40) return z; return null; }
function laneExists(d, l, p){ if (l >= 0) return l < nAvail(d, p);
  for (const z of CFA) if (z.A === d && -l <= z.k && p >= z.CF_IN - 40 && p <= z.CF_END) return true; return false; }
function blockAhead(d, l, front, skipFork = false){
  if (!laneExists(d, l, front)) return 0;
  let best = Infinity;
  if (l < 0) { for (const z of CFA) if (z.A === d && front >= z.CF_IN - 40 && front <= z.CF_END) best = Math.min(best, z.CF_END - front); return best; }
  best = dropAhead(d, l, front);
  const b = blocks.get(key(d,l)); if (!b) return best;
  for (const [a, len, fk] of b) { if (skipFork && fk) continue; if (front - a >= 0 && front - a < len) return 0; const dd = a - front; if (dd > 0 && dd < best) best = dd; }
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
// the footprint of each interchange (trumpet + stem + link road to town, cloverleaf loops, rest area): nothing is built there,
// on the toll road and on the road you join after leaving it. o: distance out from the road edge
function rampFoot(o, u, w = 0){
  for (const st of RSITES) { const du = Math.abs(st.u - u) - w/2; if (du > 720) continue;
    if (st.kind === 'x' && du < 200 && o - w/2 < 350) return true;
    if (st.kind === 'x' && du < 700 && o - w/2 < 335) return true;     // room for the link road to town
    if (st.kind === 'j' && du < 220 && o - w/2 < 700) return true;
    if (st.kind === 'r' && du < 280 && o - w/2 < 70) return true; }
  return false; }

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
  x.fillStyle = '#111'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 200px ${SIGN_FONT}`; x.fillText('KM', w/2, h*0.3); fit(x, txt, w - 80, 300, 800); x.fillText(txt, w/2, h*0.66); }); }

// ---------- national road (jalan nasional) chunk ----------
const uPoleMat = M(0x9a948a), uBarMat = M(0x6b6660), curbMat = M(0xc9c4b8), shrubMat = M(0x4f7a3a, {flatShading:true}), shoulderMat = M(0x8f8a76), roofMat = M(0x8a4b35), roofMat2 = M(0x6b3b2a);
const RUKO = [0xe8d9b5, 0xd9c3a0, 0xf0e6d2, 0xc9d6c3, 0xe3c8c0, 0xd2d8e0, 0xf2efe8, 0xe6b98a].map(c => M(c));
const AWN = [0x2a6fb5, 0xc8342b, 0xe0a020, 0x2f8a4a, 0x7a3fa0].map(c => M(c, {roughness:0.6}));
// sawah: rows of rice and the raised bunds (pematang) between plots, young green, ripe yellow, and flooded at planting time
const paddyTex = (base, row, water) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = water || base; x.fillRect(0, 0, 128, 128); x.strokeStyle = row; x.lineWidth = 3; for (let i = 4; i < 128; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); }
  x.fillStyle = '#8c7a52'; x.fillRect(0, 0, 128, 5); x.fillRect(0, 0, 5, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 6); t.anisotropy = 4; t.userData.keep = true; t.colorSpace = THREE.SRGBColorSpace; return t; };
const PADDY = [M(0xffffff, {map: paddyTex('#7fb83a', '#5f9628')}), M(0xffffff, {map: paddyTex('#c9c24a', '#a89b2e')}), M(0xffffff, {map: paddyTex('#6fa3a0', '#7fbf4a', '#7aa9b0'), roughness: 0.35})];
const shrubGeo = new THREE.IcosahedronGeometry(0.7, 0); shrubGeo.translate(0, 0.6, 0); shrubGeo.userData.keep = true;
const uPoleGeo = new THREE.CylinderGeometry(0.1, 0.13, 9, 6); uPoleGeo.translate(0, 4.5, 0); uPoleGeo.userData.keep = true;
const uBarGeo = new THREE.BoxGeometry(1.6, 0.1, 0.1); uBarGeo.translate(0, 8.4, 0); uBarGeo.userData.keep = true;
const sPoleGeo = new THREE.CylinderGeometry(0.08, 0.11, 8, 6); sPoleGeo.translate(0, 4, 0); sPoleGeo.userData.keep = true;
const roofGeo = new THREE.ConeGeometry(4.6, 2.4, 4); roofGeo.rotateY(Math.PI/4); roofGeo.userData.keep = true;
const unitBox = new THREE.BoxGeometry(1, 1, 1); unitBox.userData.keep = true;
function ubox(mat, x, y, z, w, h, d){ const m = new THREE.Mesh(unitBox, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; }
const townNear = (u, r = TOWN_R) => KSITES.find(t => Math.abs(t.u - u) < r);
// Jembatan Suramadu: sea on both sides, the deck on piers, parapets and lamps, and the cable-stayed main span with its two pylons
const seaMat = M(0x3d6f84, {roughness: 0.3, metalness: 0.1}); seaMat.userData.terrain = true;
const cableMat = new THREE.LineBasicMaterial({color: 0xd8dde0});
function suramaduBridge(g, u0, u1, Z){
  const [s0, s1] = SEA, a = Math.max(u0, s0), b = Math.min(u1, s1), e = eAt((u0 + u1)/2);
  if (b - a > 0.5) g.add(flat(6000, b - a, seaMat, 0, 0.05, Z((a + b)/2)));
  const p = Math.max(u0, s0 - 160), q = Math.min(u1, s1 + 160); if (q - p < 0.5) return;
  g.add(solid(2*(e + 3.0), 1.2, q - p, concrete, 0, -0.7, Z((p + q)/2)));
  for (const sx of [-1, 1]) g.add(solid(0.35, 1.1, q - p, barMat, sx*(e + 2.8), 0.55, Z((p + q)/2)));
  for (let u = Math.ceil(p/50)*50; u < q; u += 50) { const h = elevAt(u); if (h < 2) continue;
    for (const sx of [-1, 1]) { const m = new THREE.Mesh(viaPierGeo, concrete); m.position.set(sx*(e - 1), -h/2 - 0.6, Z(u)); m.scale.set(0.9, h, 0.9); g.add(m); }
    g.add(solid(2*e + 4, 1.0, 2, concrete, 0, -1.6, Z(u))); }
  const lp = []; for (let u = Math.ceil(p/40)*40 + 20; u < q; u += 40) for (const sx of [-1, 1]) lp.push([sx*(e + 2.75), Z(u)]);
  g.add(instanced(sPoleGeo, lampMat, lp), instanced(headGeo, lampHeadMat, lp.map(([x, z]) => [x - Math.sign(x)*0.9, z]), 7.9));
  // main span: two H pylons 434 m apart in the middle of the strait, stay cables fanning down to the deck
  const mid = (s0 + s1)/2, H = 120, pts = [];
  for (const pu of [mid - 217, mid + 217]) { if (pu < u0 - 260 || pu > u1 + 260) continue;
    if (pu >= u0 && pu < u1) { for (const sx of [-1, 1]) g.add(solid(2.6, H + elevAt(pu), 3.2, concrete, sx*(e + 4.4), (H - elevAt(pu))/2, Z(pu)));
      for (const y of [-2, 40, H - 4]) g.add(solid(2*(e + 4.4), 2.2, 2.6, concrete, 0, y, Z(pu))); }
    for (let d = -200; d <= 200; d += 20) { if (Math.abs(d) < 15) continue; const ud = pu + d; if (ud < u0 || ud > u1) continue;
      const top = H - 8 + Math.abs(d)/200*6; for (const sx of [-1, 1]) pts.push(sx*(e + 4.4), top, Z(pu), sx*(e + 2.9), 1.2, Z(ud)); } }
  if (pts.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.add(new THREE.LineSegments(geo, cableMat)); }
}
function buildChunkNat(i){
  const u0 = i*CH, u1 = u0 + CH, g = new THREE.Group(), R = rng(i*7919 + 29);
  g.userData.u0 = u0; const Z = u => -(u - u0);
  const us = []; for (let u = u0; u <= u1 + 0.01; u += 10) us.push(u);
  const divided = nAt(u0 + CH/2) >= 1.5, town = townNear(u0 + CH/2, TOWN_R + 80);
  const xGap = u => KSITES.some(t => Math.abs(t.u - u) < XW/2 + 9);
  const sea = SEA && u1 > SEA[0] - 200 && u0 < SEA[1] + 200;    // the Suramadu bridge and its approaches: no land use here
  if (sea) suramaduBridge(g, u0, u1, Z);
  for (const s of [-1, 1]) {
    g.add(strip(us, u => s*(MED - 0.05), u => s*(eAt(u) + 0.8), 0, asphalt, Z));
    g.add(strip(us, u => s*(eAt(u) + 0.8), u => s*(eAt(u) + (town ? 5 : 2.6)), 0.004, town ? curbMat : shoulderMat, Z));
    g.add(strip(us, u => s*(eAt(u) - 0.08), u => s*(eAt(u) + 0.08), 0.012, white, Z));
    const dp = []; for (let l = 1; l < 7; l++) for (let u = Math.ceil(u0/9)*9; u < u1; u += 9) if (l < nAt(u + 1.5) - 0.3 && l < nAt(u) - 0.3) dp.push([s*(MED + l*LW), Z(u + 1.5)]);
    g.add(instanced(dashGeo, white, dp, 0.012));
    const ku = u0 + 60;
    if (EV.length && !xGap(ku)) { const p = panelMesh(0.5, 0.7, kmPostTex(kmAt(ku).toFixed(1).replace('.', ','))); p.position.set(s*(eAt(ku) + 3.2), 1.1, Z(ku)); p.rotation.y = s < 0 ? 0 : Math.PI; g.add(p);
      addSolid(g, 'Menabrak patok KM', ku - 0.3, ku + 0.3, s*(eAt(ku) + 3.2) - 0.3, s*(eAt(ku) + 3.2) + 0.3); }
    if (sea) continue;
    if (town) {
      // shophouses (ruko) with coloured awnings, gaps for side streets
      let u = u0 + R()*4;
      while (u < u1) { const w = 7 + R()*5, h = 6 + R()*5, d = 12, x = s*(eAt(u) + 6 + d/2);
        if (!xGap(u) && !xGap(u + w) && R() > 0.08 && !rampFoot(6, u + w/2, w)) {
          g.add(ubox(RUKO[Math.floor(R()*RUKO.length)], x, h/2, Z(u + w/2), d, h, w - 0.4));
          g.add(ubox(AWN[Math.floor(R()*AWN.length)], s*(eAt(u) + 5.4), 3.1, Z(u + w/2), 1.6, 0.15, w - 0.6));
          g.add(ubox(roofMat2, x, h + 0.2, Z(u + w/2), d + 0.4, 0.4, w)); }
        u += w; }
      const lp = []; for (let u2 = Math.ceil((u0 - 20)/40)*40 + 20; u2 < u1; u2 += 40) if (!xGap(u2)) { lp.push([s*(eAt(u2) + 3.4), Z(u2)]); addSolid(g, 'Menabrak tiang lampu', u2 - 0.25, u2 + 0.25, s*(eAt(u2) + 3.4) - 0.25, s*(eAt(u2) + 3.4) + 0.25); }
      g.add(instanced(sPoleGeo, lampMat, lp), instanced(headGeo, lampHeadMat, lp.map(([x, z]) => [x - s*0.9, z]), 7.9));
    } else {
      if (regionAt(u0 + CH/2) === 'paddy') for (let k = 0; k < 2; k++) { const w = 30 + R()*120, o = 14 + R()*40;
        g.add(flat(w, CH*(0.4 + R()*0.6), PADDY[Math.floor(R()*3)], s*(eAt(u0) + o + w/2), 0.002, -CH/2)); }
      for (let u = u0 + R()*30; u < u1; u += 30 + R()*40) { if (R() < 0.45) continue; const o = 9 + R()*14, x = s*(eAt(u) + o + 3); if (rampFoot(o, u, 8)) continue;
        g.add(ubox(RUKO[Math.floor(R()*RUKO.length)], x, 1.6, Z(u), 6, 3.2, 7));
        const rf = new THREE.Mesh(roofGeo, R() < 0.5 ? roofMat : roofMat2); rf.position.set(x, 4.4, Z(u)); rf.scale.set(1, 1, 1.2); rf.castShadow = true; g.add(rf); }
    }
    if (!town && s > 0) roadside(g, u0, u1, Z, R, false);
    // PLN distribution poles (tiang listrik) with their wires, in towns and outside
    const pp = [], wires = [];
    for (let u2 = Math.ceil(u0/40)*40; u2 < u1; u2 += 40) { if (!plnPole(u2)) continue; const x = s*plnX(u2);
      pp.push([x, Z(u2)]); addSolid(g, 'Menabrak tiang listrik', u2 - 0.25, u2 + 0.25, x - 0.25, x + 0.25);
      const u3 = plnPole(u2 + 40) ? u2 + 40 : plnPole(u2 + 80) ? u2 + 80 : null; if (u3 == null) continue;
      const x3 = s*plnX(u3);
      for (const [ox, y, sag] of PLN_WIRES) wireSpan(wires, x + s*ox, y, Z(u2), x3 + s*ox, y, Z(u3), sag*(u3 - u2)/40, 6); }
    g.add(instanced(uPoleGeo, uPoleMat, pp), instanced(uBarGeo, uBarMat, pp), instanced(insGeo, insMat, pp.flatMap(([x, z]) => [[x - 0.7, z], [x + 0.7, z]]), 8.5));
    g.add(wireMesh(wires, distWireMat));
  }
  if (!sea) addSutet(g, u0, u1, Z);
  if (divided) {
    g.add(solid(2*MED - 0.4, 0.25, CH, curbMat, 0, 0.125, -CH/2));
    const sp = []; for (let u = Math.ceil(u0/6)*6; u < u1; u += 6) if (!xGap(u)) sp.push([0, Z(u)]);
    g.add(instanced(shrubGeo, shrubMat, sp, 0.2));
  } else {
    g.add(strip(us, u => -MED, u => MED, 0.002, asphalt, Z));
    for (const o of [-0.18, 0.18]) g.add(strip(us, u => o - 0.06, u => o + 0.06, 0.012, yellowLine, Z));
  }
  const per = MOBILE ? 7 : 12, pts = [];
  for (let k = 0; k < (sea ? 0 : per*2); k++) { const s = k % 2 ? 1 : -1, u = u0 + R()*CH, o = (town ? 24 : 40) + R()*260; if (rampFoot(o, u, 6)) continue;
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
  // where the route runs on the MBZ, its ramp zones are drawn by mbzStack (Japek on the land, the side ramps): no main road there
  const vis = cut([u0, u1], mbzHidRanges()), runsOf = (a, b) => { const r = []; for (let u = a; u <= b + 0.01; u += 10) r.push(Math.min(u, b)); return r; };
  const lineRuns = cut([u0, u1], RSITES.filter(s => Math.abs(s.u - (u0 + u1)/2) < 260).map(s => [s.u - 180, s.u + 180]).concat(mbzHidRanges()));
  const railRuns = runs => runs.flatMap(r => cut(r, mbzGapRanges()));
  const shW = u => mbzSide(u) ? 0.3 : 3, inVis = u => vis.some(([a, b]) => u >= a && u < b);
  for (const s of [-1, 1]) {
    for (const [a, b] of vis) { const ru = runsOf(a, b);
      g.add(strip(ru, u => s*(MED - 0.05), u => s*(eAt(u) + shW(u)), 0, asphalt, Z), strip(ru, u => s*(MED + 0.13), u => s*(MED + 0.27), 0.012, white, Z));
      for (const [c, d] of cut([a, b], mbzSideRanges())) g.add(strip(runsOf(c, d), u => s*(eAt(u) + 3), u => s*(eAt(u) + 7), 0.004, vergeMat, Z));
      // on the MBZ deck: a concrete parapet instead of shoulder and guard rail
      for (const [c, d] of mbzSideRanges()) { const pa = Math.max(a, c), pb = Math.min(b, d); if (pb - pa > 0.5) g.add(solid(0.3, 1.1, pb - pa, barMat, s*(MED + 2*LW + 0.15), 0.55, Z((pa + pb)/2))); } }
    for (const [a, b] of lineRuns) { const ru = runsOf(a, b);
      g.add(strip(ru, u => s*(eAt(u) - 0.1), u => s*(eAt(u) + 0.1), 0.012, white, Z));
      for (const [ra, rb] of railRuns(cut([a, b], mbzSideRanges()))) { const rr = runsOf(ra, rb);
        g.add(wall(rr, u => s*(eAt(u) + 2.8), 0.55, 0.85, railMat, Z));
        const pp = []; for (let u = Math.ceil(ra/4)*4; u < rb; u += 4) pp.push([s*(eAt(u) + 2.85), Z(u)]);
        g.add(instanced(postGeo, railMat, pp, 0.4)); } }
    // lane dashes
    const dp = []; for (let l = 1; l < 7; l++) for (let u = Math.ceil(u0/9)*9; u < u1; u += 9) if (l < nAt(u + 1.5) - 0.3 && l < nAt(u) - 0.3 && inVis(u) && inVis(u + 3)) dp.push([s*(MED + l*LW), Z(u + 1.5)]);
    g.add(instanced(dashGeo, white, dp, 0.012));
    // parallel road (Jalan Nasional, 2 lajur per arah)
    const pr = u => eAt(u) + PRC;
    g.add(strip(us, u => s*(pr(u) - 7.2), u => s*(pr(u) + 7.2), 0.004, prAsphalt, Z));
    g.add(strip(us, u => s*(pr(u) + 7.2), u => s*(pr(u) + 10), 0.003, prVerge, Z));
    g.add(strip(us, u => s*(pr(u) - 9.5), u => s*(pr(u) - 7.2), 0.003, prVerge, Z));
    for (const o of [-6.9, 6.9]) g.add(strip(us, u => s*(pr(u) + o - 0.07), u => s*(pr(u) + o + 0.07), 0.012, prWhite, Z));
    for (const o of [-0.15, 0.15]) g.add(strip(us, u => s*(pr(u) + o - 0.06), u => s*(pr(u) + o + 0.06), 0.012, prYellow, Z));
    const np = []; for (const o of [-3.5, 3.5]) for (let u = Math.ceil(u0/8)*8; u < u1; u += 8) np.push([s*(pr(u) + o), Z(u + 1.5)]);
    g.add(instanced(prDashGeo, prWhite, np, 0.012));
    // KM post (patok KM)
    const ku = u0 + 60;
    if (!rampSiteNear(ku, 200) && EV.length && !mbzSide(ku) && inVis(ku) && !mbzGap(ku)) { const p = panelMesh(0.5, 0.7, kmPostTex(kmAt(ku).toFixed(1).replace('.', ','))); p.position.set(s*(eAt(ku) + 4.2), 1.1, Z(ku)); p.rotation.y = s < 0 ? 0 : Math.PI; g.add(p, solid(0.1, 0.75, 0.1, signBackMat, s*(eAt(ku) + 4.2), 0.375, Z(ku) + 0.1*(s<0?-1:1))); }
  }
  for (const [a, b] of vis) g.add(strip(runsOf(a, b), u => -MED, u => MED, 0.003, medianMat, Z));
  // median barrier with U-turn openings
  const opens = OPENS.filter(o => o.u > u0 - 40 && o.u < u1 + 40).map(o => [o.u - OPEN_HW, o.u + OPEN_HW]);
  for (const [a, b] of cut([u0, u1], opens.concat(mbzHidRanges()))) g.add(solid(0.6, 0.9, b - a, barMat, 0, 0.45, Z((a + b)/2)));
  // median lamps
  const covered = u => !inVis(u) || mbzUnder(u) || OVS.some(o => Math.abs(o.u - u) < 16) || SITES.some(t => (t.kind === 'j' && Math.abs(t.u - u) < 20) || (PLZK.has(t.kind) && Math.abs(t.u - u) < 14));
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
    if (eAt(u) + o < mbzClear(u) + 3) continue;
    if (PLAZAS.some(p => Math.abs(p.u - u) < 60) && o < 30) continue;
    pts.push({x: s*(eAt(u) + o), z: Z(u), k: 0.7 + R()*0.8, h: 0.85 + R()*0.4, r: R()*6.28}); }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pts.length), crowns = new THREE.InstancedMesh(crownGeo, crownMat, Math.ceil(pts.length/2)), blobs = new THREE.InstancedMesh(blobGeo, blobMat, Math.ceil(pts.length/2));
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), upv = new THREE.Vector3(0,1,0);
  pts.forEach((p, j) => { pv.set(p.x, 0, p.z); sc.set(p.k, p.k*p.h, p.k); q.setFromAxisAngle(upv, p.r); tm.compose(pv, q, sc); trunks.setMatrixAt(j, tm); (j % 2 ? crowns : blobs).setMatrixAt(j >> 1, tm); });
  crowns.count = pts.filter((_, j) => j % 2).length; blobs.count = pts.length - crowns.count;
  for (const m of [trunks, crowns, blobs]) { m.castShadow = true; g.add(m); }
  roadside(g, u0, u1, Z, R, true);
  viaduct(g, u0, u1, Z);
  mbzStack(g, u0, u1, Z);
  addSutet(g, u0, u1, Z);
  bendObj(g); scene.add(g); return g;
}

// ================================================================
// LANDSCAPE: what lines the road depends on where you are (researched per corridor):
// Jabodetabek and the big cities are built up (no rice fields), Cikarang–Karawang and Cilegon are industrial,
// Pantura, Cipali and the Trans-Jawa plains are rice fields with villages, Cipularang, Bawen–Salatiga, Bocimi,
// Cisumdawu and Pandaan–Malang run through hills and forest. Volcanoes stand on the horizon where they really are.
// ================================================================
const CITIES = [[-6.917, 107.61, 11], [-6.99, 110.42, 10], [-7.26, 112.75, 13], [-7.80, 110.37, 9], [-7.57, 110.82, 8], [-7.98, 112.63, 8], [-6.72, 108.55, 6], [-6.12, 106.15, 6], [-7.33, 108.22, 5], [-7.42, 109.24, 5], [-6.87, 109.13, 5], [-6.89, 109.67, 4]];
const HILLS = new Set(['cipularang', 'semsol', 'bocimi', 'gempan', 'cisumdawu', 'soroja', 'puncak', 'magelang', 'wonosobo', 'batu', 'pelratu', 'garut', 'lembang']);
const kmTo = (la1, lo1, la2, lo2) => Math.hypot((la1 - la2)*111, (lo1 - lo2)*110.4);
function regionAt(u){
  if (!EV.length) return 'paddy';
  const p = latLonAt(u), c = corrAt(u);
  if (HILLS.has(c) || (ROADFORM[c] && ROADFORM[c][1] >= 10)) return 'hills';    // mountain roads (Lintas Selatan, Pansela, Puncak …)
  if (p.lon > 106.45 && p.lon < 107.12 && p.lat > -6.72 && p.lat < -6.05) return 'urban';            // Jabodetabek
  if ((p.lon > 107.05 && p.lon < 107.42 && p.lat > -6.42 && p.lat < -6.22) || (p.lon < 106.12 && p.lat > -6.1)) return 'industrial';   // Cikarang–Karawang, Cilegon
  for (const [la, lo, r] of CITIES) if (kmTo(p.lat, p.lon, la, lo) < r) return 'urban';
  return 'paddy';
}
const bldMat = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.85}), bldRoof = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.8});
const WALLS = [0xe8d9b5, 0xd9c3a0, 0xf0e6d2, 0xc9d6c3, 0xe3c8c0, 0xd2d8e0, 0xf2efe8, 0xe6b98a, 0xbfc7cc, 0xdedad0].map(c => new THREE.Color(c));
const ROOFS = [0x8a4b35, 0x6b3b2a, 0x9a5a3a, 0x7c7f83, 0x4f6f8a, 0xa3402f].map(c => new THREE.Color(c));
const hillGeo = (() => { const g = new THREE.IcosahedronGeometry(1, 1); g.scale(1, 0.38, 1); g.translate(0, -0.05, 0); g.userData.keep = true; return g; })();
const hillMat = M(0x5f7d45, {flatShading: true});
// buildings / fields / hills on both sides of a chunk; toll = keep clear of ramps, the parallel road and plazas
function roadside(g, u0, u1, Z, R, toll){
  const reg = regionAt(u0 + CH/2), boxes = [], roofs = [], fields = [];
  const free = (o, u, w) => { if (eAt(u) + o - w/2 < mbzClear(u) + 3) return false;    // never build on Japek under/beside the MBZ
    if (rampFoot(o, u, w)) return false;
    if (!toll) return o > 9 && !KSITES.some(t => Math.abs(t.u - u) < TOWN_R + 60);
    if (Math.abs(o - PRC) < 16 + w/2) return false;
    if (OVS.some(ov => Math.abs(ov.u - u) < 30 + w/2)) return false; if (PLAZAS.some(p => Math.abs(p.u - u) < 90) && o < 60) return false;
    const k = Math.round(u/SPAN); for (const kk of [k - 1, k, k + 1]) { const t = sutetTower(kk); if (t && Math.abs(t.u - u) < 14 + w/2 && Math.abs(Math.abs(t.x) - (eAt(u) + o)) < 14 + w/2) return false; }
    return true; };
  const house = (s, u, o, w, d, h, roof = true, wc, rc) => { const x = s*(eAt(u) + o);
    if (o < 70) addSolid(g, 'Menabrak bangunan', u - w/2, u + w/2, x - d/2, x + d/2);     // buildings near the road are solid when you drive off it
    boxes.push([x, h/2, Z(u), d, h, w, wc ?? WALLS[Math.floor(R()*WALLS.length)]]);
    if (roof) roofs.push([x, h + 1.0*Math.min(w, d)/6, Z(u), d*0.78, Math.min(w, d)/3, w*0.78, rc ?? ROOFS[Math.floor(R()*ROOFS.length)]]); };
  for (const s of toll ? [-1, 1] : [-1, 1]) {
    if (reg === 'urban') {
      // dense kampung / housing estates close to the road, ruko and apartment towers further out
      for (let u = u0 + R()*6; u < u1; u += 8 + R()*5) for (const o0 of toll ? [18, 30, 44, 58] : [26, 38]) {
        const o = o0 + R()*4, w = 6 + R()*3, d = 7 + R()*3, h = 3 + R()*(R() < 0.25 ? 6 : 2.5);
        if (R() < 0.12 || !free(o, u, w)) continue; house(s, u, o, w, d, h); }
      if (R() < 0.55) { const u = u0 + R()*CH, o = 90 + R()*200, w = 22 + R()*14, h = 30 + R()*70; if (free(o, u, w)) house(s, u, o, w, w*0.8, h, false, WALLS[Math.floor(R()*4) + 6]); }
    } else if (reg === 'industrial') {
      for (let u = u0 + R()*20; u < u1; u += 50 + R()*30) { const o = 30 + R()*150, w = 40 + R()*30, d = 30 + R()*40, h = 9 + R()*6;
        if (free(o + d/2, u, w)) house(s, u, o + d/2, w, d, h, false, new THREE.Color(R() < 0.5 ? 0xd7dadc : 0xb9c3cc)); }
      for (let u = u0 + R()*10; u < u1; u += 14 + R()*10) { const o = 18 + R()*6; if (free(o, u, 7)) house(s, u, o, 7, 8, 3.2); }
    } else if (reg === 'paddy') {
      // rice fields (sawah) right up to the fence, a village every few hundred metres
      for (let k = 0; k < 3; k++) { const o = 16 + k*70 + R()*20, w = 50 + R()*40; for (const h of [0, 1]) if (free(o + w/2, u0 + 30 + h*60, 60)) fields.push([s, o + w/2, w, h]); }
      if (R() < 0.3) { const uc = u0 + R()*CH, oc = 60 + R()*160; for (let j = 0; j < 7; j++) { const u = uc + (R() - 0.5)*50, o = oc + (R() - 0.5)*40; if (free(o, u, 8)) house(s, u, o, 6 + R()*2, 7, 3 + R()); } }
    } else {
      // hills: rolling green slopes beside the road, terraced rice (terasering) on the lower slopes
      if (R() < 0.5) { const o = 20 + R()*40, w = 30 + R()*30; for (const h of [0, 1]) if (free(o + w/2, u0 + 30 + h*60, 60)) fields.push([s, o + w/2, w, h]); }
      for (let k = 0; k < 3; k++) { const u = u0 + R()*CH, o = 70 + R()*230, r = 50 + R()*90; if (free(o, u, r)) { const m = new THREE.Mesh(hillGeo, hillMat); m.position.set(s*(eAt(u) + o + r*0.4), 0, Z(u)); m.scale.set(r, r*(0.6 + R()*0.6), r*1.4); m.receiveShadow = true; g.add(m); } }
    }
  }
  for (const [s, o, w, h] of fields) g.add(flat(w, CH/2, PADDY[Math.floor(R()*3)], s*(eAt(u0 + CH/2) + o), 0.003, -(30 + h*60)));
  if (boxes.length) { const m = new THREE.InstancedMesh(unitBox, bldMat, boxes.length);
    boxes.forEach(([x, y, z, sx, sy, sz, c], j) => { tm.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)); m.setMatrixAt(j, tm); m.setColorAt(j, c); });
    m.castShadow = m.receiveShadow = true; g.add(m); }
  if (roofs.length) { const m = new THREE.InstancedMesh(roofGeo, bldRoof, roofs.length);
    roofs.forEach(([x, y, z, sx, sy, sz, c], j) => { tm.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx/4.6, sy/2.4, sz/4.6)); m.setMatrixAt(j, tm); m.setColorAt(j, c); });
    m.castShadow = true; g.add(m); }
}

// materials that belong to the land: they drop below an elevated toll road
const prAsphalt = asphalt.clone(), prWhite = white.clone(), prYellow = yellowLine.clone(), prRail = railMat.clone(), prBar = barMat.clone(), gorMat = M(0xf2c230);
for (const m of [ground.material, vergeMat, prVerge, prAsphalt, prWhite, prYellow, prRail, prBar, trunkMat, crownMat, blobMat, shrubMat, roofMat, roofMat2, ...RUKO, ...PADDY, bldMat, bldRoof, hillMat, uPoleMat, uBarMat]) m.userData.terrain = true;
ground.material.userData.bent = false; ground.material.needsUpdate = true; patchMat(ground.material);

// volcanoes on the horizon at their real bearing; height scaled to the real angle they fill
const VOLCANO = [['Karang', -6.27, 106.04, 1778], ['Halimun', -6.73, 106.47, 1929], ['Salak', -6.715, 106.73, 2211], ['Gede-Pangrango', -6.78, 106.98, 3019],
  ['Burangrang', -6.75, 107.53, 2050], ['Tangkuban Perahu', -6.77, 107.6, 2084], ['Patuha', -7.16, 107.40, 2434], ['Malabar', -7.13, 107.65, 2343], ['Papandayan', -7.32, 107.73, 2665],
  ['Cikuray', -7.32, 107.86, 2821], ['Galunggung', -7.25, 108.06, 2168], ['Ciremai', -6.89, 108.40, 3078], ['Slamet', -7.24, 109.21, 3428], ['Sindoro', -7.30, 109.99, 3136],
  ['Sumbing', -7.38, 110.07, 3371], ['Ungaran', -7.18, 110.35, 2050], ['Merbabu', -7.45, 110.44, 3145], ['Merapi', -7.54, 110.45, 2930], ['Muria', -6.62, 110.88, 1602],
  ['Lawu', -7.63, 111.19, 3265], ['Wilis', -7.81, 111.76, 2563], ['Kelud', -7.93, 112.31, 1731], ['Penanggungan', -7.61, 112.62, 1653], ['Welirang', -7.73, 112.57, 3156],
  ['Arjuno', -7.76, 112.59, 3339], ['Semeru', -8.11, 112.92, 3676], ['Bromo', -7.94, 112.95, 2329], ['Argopuro', -7.97, 113.57, 3088], ['Raung', -8.12, 114.04, 3332], ['Ijen', -8.06, 114.24, 2799]];
const volGeo = (() => { const pts = [[1, 0], [0.62, 0.12], [0.38, 0.33], [0.22, 0.6], [0.12, 0.88], [0.07, 1]].map(([r, y]) => new THREE.Vector2(r, y)); const g = new THREE.LatheGeometry(pts, 32); g.userData.keep = true; return g; })();
const volcanoes = VOLCANO.map(([name, lat, lon, h]) => { const m = new THREE.Mesh(volGeo, new THREE.MeshBasicMaterial({color: 0x6f8696, fog: false})); m.visible = false; m.renderOrder = -1; scene.add(m); return {name, lat, lon, h, m}; });
let volT = 0;
function updateVolcanoes(dt){
  volT -= dt; if (volT > 0 && dt) return; volT = 0.25;
  if (!PLR || !EV.length) return;
  const u = uOfV(PLR), p = latLonAt(u), i = Math.max(0, Math.min(EV.length - 2, evAt(u))), a = EV[i], b = EV[i + 1];
  const head = Math.atan2((b.lon - a.lon)*Math.cos(p.lat*Math.PI/180), b.lat - a.lat), D = 1450, sky = scene.background;
  for (const v of volcanoes) {
    const dy = (v.lat - p.lat)*111, dx = (v.lon - p.lon)*110.4, d = Math.hypot(dx, dy);
    if (d > 95 || d < 4) { v.m.visible = false; continue; }
    const rel = Math.atan2(dx, dy) - head, H = Math.min(200, D*(v.h - 250)/(d*1000));
    v.m.visible = true; v.m.position.set(camera.position.x + D*Math.sin(rel), -2, camera.position.z - D*Math.cos(rel));
    v.m.scale.set(H*3.1, H, H*3.1);
    v.m.material.color.setHex(0x55707e).lerp(sky, clamp(0.25 + d/120, 0, 0.85));
  }
}

// ---------- landmarks: monuments, temples, mosques, towers and bridges near the road, at their real place ----------
// Each one is placed beside the route at the point of closest approach (on the correct side), at a distance that grows
// with the real distance from the road, so you pass it the way you would on the real drive. Simple low-poly models, real heights.
const LMK = [
  ['Monas', -6.1754, 106.8272, 'monas'], ['Masjid Istiqlal', -6.1702, 106.8310, 'mosque', {dome: 45, color: 0xe9e6dc, min: 1, mh: 90}],
  ['Bundaran HI', -6.1950, 106.8230, 'tugu', {h: 30}], ['Masjid Kubah Emas', -6.3833, 106.7690, 'mosque', {dome: 30, color: 0xd9b23a, min: 4, mh: 40}],
  ['Tugu Kujang', -6.6010, 106.8050, 'tugu', {h: 25}], ['Istana Bogor', -6.5980, 106.7970, 'palace'],
  ['Masjid Agung Banten', -6.0360, 106.1550, 'menara', {h: 24, color: 0xf2f2ee}],
  ['Keraton Kasepuhan', -6.7260, 108.5700, 'bentar'], ['Masjid Raya Al Jabbar', -6.9530, 107.7030, 'mosque', {dome: 50, color: 0xdfe6ea, min: 4, mh: 99, glass: true}],
  ['Gedung Sate', -6.9025, 107.6188, 'sate'], ['Lawang Sewu', -6.9840, 110.4100, 'sewu'], ['Tugu Muda', -6.9845, 110.4090, 'tugu', {h: 18}],
  ['Masjid Agung Jawa Tengah', -6.9830, 110.4450, 'mosque', {dome: 30, color: 0xe7e2d2, min: 4, mh: 99}], ['Sam Poo Kong', -6.9960, 110.3980, 'pagoda', {tiers: 3, h: 22}],
  ['Pagoda Avalokitesvara (Watugong)', -7.0790, 110.4110, 'pagoda', {tiers: 7, h: 45}], ['Menara Kudus', -6.8040, 110.8320, 'menara', {h: 18, color: 0xa4553a}],
  ['Candi Borobudur', -7.6079, 110.2038, 'borobudur'], ['Candi Prambanan', -7.7520, 110.4915, 'prambanan'], ['Tugu Yogyakarta', -7.7829, 110.3671, 'tugu', {h: 15}],
  ['Masjid Raya Sheikh Zayed', -7.5560, 110.8500, 'mosque', {dome: 32, color: 0xf4f4f0, min: 4, mh: 60}],
  ['Candi Brahu', -7.5420, 112.3730, 'candi', {h: 25}], ['Candi Bajang Ratu', -7.5670, 112.4000, 'candi', {h: 16}],
  ['Tugu Pahlawan', -7.2458, 112.7378, 'tugu', {h: 41}], ['Monumen Kapal Selam', -7.2650, 112.7500, 'kapal'], ['Jembatan Suramadu', -7.1800, 112.7800, 'suramadu'],
  ['Masjid Al-Akbar Surabaya', -7.3370, 112.7150, 'mosque', {dome: 40, color: 0x3f8f6e, min: 1, mh: 99}]];
const stoneMat = M(0x77736a, {flatShading: true}), brickMat = M(0xa4553a), whiteStone = M(0xf2f0ea), goldMat = M(0xd9b23a, {metalness: 0.7, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.4}),
  redLac = M(0xb5261e), roofTile = M(0x4a3a2e), lmSteel = M(0xe8ecef, {metalness: 0.5, roughness: 0.4}), glassBlue = M(0x7fa8c8, {metalness: 0.6, roughness: 0.2});
const cyl = (r0, r1, h, mat, x, y, z, g, seg = 16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, seg), mat); m.position.set(x, y + h/2, z); m.castShadow = true; g.add(m); return m; };
const dome = (r, mat, x, y, z, g) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI*2, 0, Math.PI/2), mat); m.position.set(x, y, z); g.add(m); return m; };
const bell = (r, x, y, z, g) => { dome(r, stoneMat, x, y, z, g); cyl(r*0.25, 0.02, r*1.1, stoneMat, x, y + r*0.9, z, g, 6); };
const pramMat = M(0x6e6a62, {flatShading: true});
const LMK_BUILD = {
  monas(g){ box(46, 3, 46, whiteStone, 0, 1.5, 0, g); cyl(22, 14, 14, whiteStone, 0, 3, 0, g, 4).rotation.y = Math.PI/4; box(48, 1.2, 48, whiteStone, 0, 17.6, 0, g);
    cyl(5.2, 3.6, 98, whiteStone, 0, 18, 0, g, 4).rotation.y = Math.PI/4; box(7, 3, 7, whiteStone, 0, 117, 0, g); cyl(2.6, 0.5, 14, goldMat, 0, 118, 0, g, 8); },
  mosque(g, o){ const r = o.dome; box(r*2.6, r*0.55, r*2.6, whiteStone, 0, r*0.275, 0, g); cyl(r*1.05, r*1.05, r*0.25, whiteStone, 0, r*0.55, 0, g, 24);
    dome(r, o.glass ? glassBlue : M(o.color, {metalness: o.color === 0xd9b23a ? 0.6 : 0.1, roughness: 0.4}), 0, r*0.8, 0, g); cyl(0.6, 0.1, r*0.3, goldMat, 0, r*1.78, 0, g, 6);
    const mins = o.min === 1 ? [[r*1.6, r*1.6]] : [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [a*r*1.45, b*r*1.45]);
    for (const [x, z] of mins) { cyl(r*0.09, r*0.07, o.mh, whiteStone, x, 0, z, g, 8); cyl(r*0.12, r*0.12, 1.5, whiteStone, x, o.mh*0.8, z, g, 8); cyl(r*0.08, 0.05, r*0.25, goldMat, x, o.mh, z, g, 8); } },
  tugu(g, o){ box(o.h*0.35, o.h*0.06, o.h*0.35, whiteStone, 0, o.h*0.03, 0, g); cyl(o.h*0.07, o.h*0.035, o.h, whiteStone, 0, o.h*0.06, 0, g, 4).rotation.y = Math.PI/4; cyl(o.h*0.03, 0.05, o.h*0.12, goldMat, 0, o.h*1.06, 0, g, 6); },
  menara(g, o){ const mat = M(o.color); box(6, o.h*0.75, 6, mat, 0, o.h*0.375, 0, g); box(7.5, 0.6, 7.5, mat, 0, o.h*0.75, 0, g); for (let k = 0; k < 2; k++) cyl(4.6 - k*1.6, 2 - k*1.2, 3, roofTile, 0, o.h*0.75 + 0.6 + k*2.6, 0, g, 4).rotation.y = Math.PI/4; },
  palace(g){ box(70, 10, 18, whiteStone, 0, 5, 0, g); for (let k = -3; k <= 3; k++) cyl(0.7, 0.7, 10, whiteStone, k*5, 0, 9.8, g, 8); box(22, 6, 3, whiteStone, 0, 13, 9, g); box(78, 0.8, 22, roofTile, 0, 10.4, 0, g); },
  bentar(g){ for (const s of [-1, 1]) for (let k = 0; k < 5; k++) box(7 - k*1.1, 2.4, 4 - k*0.4, brickMat, s*(6 + k*0.55), 1.2 + k*2.4, 0, g); box(40, 3, 1.2, brickMat, 0, 1.5, 0, g); },
  sate(g){ box(90, 13, 18, whiteStone, 0, 6.5, 0, g); box(94, 1, 20, roofTile, 0, 13.5, 0, g); box(14, 10, 14, whiteStone, 0, 14, 0, g);
    for (let k = 0; k < 3; k++) cyl(10 - k*3, 6 - k*2.4, 4, roofTile, 0, 24 + k*4, 0, g, 4).rotation.y = Math.PI/4; cyl(0.4, 0.1, 9, goldMat, 0, 36, 0, g, 6);
    for (let k = 0; k < 6; k++) bell(0.5, -1.2 + k*0.5, 37 + k*0.9, 0, g); },
  sewu(g){ box(110, 16, 16, whiteStone, 0, 8, 0, g); box(114, 2.5, 18, M(0xb04a32), 0, 17, 0, g); for (const s of [-1, 1]) { box(10, 26, 10, whiteStone, s*12, 13, 6, g); dome(5.5, M(0x5a4a42), s*12, 26, 6, g); }
    for (let k = -10; k <= 10; k++) box(2.4, 6, 0.4, glassMat, k*5, 8, 8.05, g); },
  pagoda(g, o){ const n = o.tiers, th = o.h/n; for (let k = 0; k < n; k++) { const w = 12 - k*(8/n); box(w*0.7, th*0.65, w*0.7, M(0xe9d7b4), 0, k*th + th*0.32, 0, g); cyl(w*0.75, w*0.35, th*0.35, redLac, 0, k*th + th*0.65, 0, g, 8).rotation.y = Math.PI/8; } cyl(0.5, 0.1, 4, goldMat, 0, o.h, 0, g, 6); },
  candi(g, o){ const h = o.h; for (let k = 0; k < 6; k++) box(14 - k*2, h/7, 14 - k*2, brickMat, 0, k*h/7 + h/14, 0, g); cyl(2.2, 0.3, h/7*1.4, brickMat, 0, h*6/7, 0, g, 8); },
  borobudur(g){ for (let k = 0; k < 6; k++) { const w = 123 - k*16; box(w, 4.2, w, stoneMat, 0, k*4.2 + 2.1, 0, g); }
    for (const [r, n, y] of [[26, 32, 25.2], [20, 24, 28.2], [14, 16, 31.2]]) { cyl(r + 3, r + 3, 3, stoneMat, 0, y - 3, 0, g, 24); for (let k = 0; k < n; k++) { const a = k/n*Math.PI*2; bell(2, Math.cos(a)*r, y, Math.sin(a)*r, g); } }
    cyl(9, 9, 3, stoneMat, 0, 31, 0, g, 20); bell(8, 0, 34, 0, g); },
  prambanan(g){ box(110, 2, 110, stoneMat, 0, 1, 0, g);
    const tower = (x, z, h) => { const w = h*0.42; for (let k = 0; k < 5; k++) box(w*(1 - k*0.13), h*0.12, w*(1 - k*0.13), pramMat, x, 2 + k*h*0.12 + h*0.06, z, g);
      for (let k = 0; k < 6; k++) cyl(w*(0.34 - k*0.05), w*(0.28 - k*0.05), h*0.07, pramMat, x, 2 + h*0.6 + k*h*0.065, z, g, 8); cyl(w*0.06, 0.05, h*0.1, stoneMat, x, 2 + h*0.99, z, g, 6); };
    tower(0, 0, 47); tower(-26, 0, 33); tower(26, 0, 33); for (const x of [-26, 0, 26]) tower(x, 26, 25); for (let k = 0; k < 16; k++) { const a = k/16*Math.PI*2; tower(Math.cos(a)*48, Math.sin(a)*48, 12); } },
  kapal(g){ const hull = new THREE.Mesh(new THREE.CapsuleGeometry(3.2, 70, 6, 12), M(0x3d4a52, {metalness: 0.4})); hull.rotation.z = Math.PI/2; hull.position.y = 5; g.add(hull); box(5, 6, 9, M(0x3d4a52), 0, 10, 0, g).rotation.y = Math.PI/2; },
  suramadu(g){ box(400, 2, 30, M(0x8a8a86), 0, 30, 0, g); for (const x of [-90, 90]) { for (const z of [-12, 12]) box(4, 146, 4, lmSteel, x, 73, z, g); box(4, 4, 28, lmSteel, x, 140, 0, g); box(4, 4, 28, lmSteel, x, 34, 0, g);
    for (let k = 1; k <= 8; k++) for (const s of [-1, 1]) { const c = box(0.3, 0.3, 1, lmSteel, 0, 0, 0, g), x1 = x + s*k*11, y0 = 135 - k*2, dx = x1 - x, dy = 31 - y0, L = Math.hypot(dx, dy);
      c.scale.set(1, 1, 1); c.geometry = new THREE.BoxGeometry(0.3, L, 0.3); c.position.set(x + dx/2, y0 + dy/2, 0); c.rotation.z = Math.atan2(-dx, dy); } }
    for (let k = -12; k <= 12; k++) if (Math.abs(k) !== 8) box(5, 30, 5, M(0x8a8a86), k*16, 15, 0, g); }
};
let lmEV = null; const LMS = [];
function layoutLandmarks(){
  lmEV = EV; for (const l of LMS) { if (l.g) l.g.visible = false; l.u = null; }
  for (const [name, lat, lon, kind, o] of LMK) {
    let l = LMS.find(x => x.name === name); if (!l) { l = {name, lat, lon, kind, o: o || {}}; LMS.push(l); }
    let best = Infinity, bu = 0, bs = 1;
    for (let i = 0; i < EV.length - 1; i++) { const a = EV[i], b = EV[i + 1]; if (a.lat == null || b.lat == null || b.u - a.u < 1) continue;
      const k = Math.cos(a.lat*Math.PI/180), ax = 0, ay = 0, bx = (b.lon - a.lon)*111*k, by = (b.lat - a.lat)*111, px = (lon - a.lon)*111*k, py = (lat - a.lat)*111;
      const L2 = bx*bx + by*by; if (L2 < 1e-6) continue; const f = clamp((px*bx + py*by)/L2, 0, 1), d = Math.hypot(px - f*bx, py - f*by);
      if (d < best) { best = d; bu = a.u + f*(b.u - a.u); bs = bx*py - by*px > 0 ? -1 : 1; } }
    if (kind === 'suramadu' && SEA) best = Infinity;     // driving over it: the bridge itself is drawn
    if (best < 9) { const rad = {monas: 26, borobudur: 64, prambanan: 56, suramadu: 30, sate: 48, sewu: 58, palace: 40, kapal: 40, mosque: (l.o.dome || 30)*1.7}[kind] || 15; l.u = bu; l.side = bs; l.off = clamp(70 + best*70, rad + 45, 640); l.km = best; l.told = false; } }
}
function updateLandmarks(){
  if (!EV.length) return; if (lmEV !== EV) layoutLandmarks();
  for (const l of LMS) { if (l.u == null) continue; const z = camU - l.u, vis = Math.abs(z) < 2600;
    if (vis && !l.g) { l.g = new THREE.Group(); const inner = new THREE.Group(); LMK_BUILD[l.kind](inner, l.o); if (l.kind === 'suramadu') inner.rotation.y = Math.PI/2; l.g.add(inner); bendObj(l.g); scene.add(l.g); }
    if (!l.g) continue; l.g.visible = vis; if (!vis) continue;
    const x = l.side*(eAt(l.u) + l.off); l.g.position.set(x, 0, z);
    if (!l.told && z < 900 && z > 0 && $('plan').hidden) { l.told = true; toast(`${l.name} · ${l.side > 0 ? 'kanan' : 'kiri'} jalan`); } }
}

// ---------- route signs: province borders and the start of each toll road (with its name) ----------
function provinceAt(lat, lon){
  if (lat > -6.37 && lat < -6.08 && lon > 106.69 && lon < 106.975) return 'DKI Jakarta';
  if (lon < 106.35 || (lon < 106.69 && lat > -6.42)) return 'Banten';
  if (lon < 108.8) return 'Jawa Barat';
  if (lat < -7.55 && lon > 110.0 && lon < 110.84) return 'DI Yogyakarta';
  if ((lat < -7.3 && lon > 111.15) || lon > 111.65) return 'Jawa Timur';
  return 'Jawa Tengah';
}
function bigBoard(w, h, bg, lines, fg = '#fff', icon = null){ return canvasTex(w, h, (x, W2, H2) => { x.fillStyle = bg; x.fillRect(0, 0, W2, H2); x.strokeStyle = fg; x.lineWidth = 12; x.strokeRect(18, 18, W2 - 36, H2 - 36);
  const S = Math.min(H2*0.5, 230), iw = icon ? iconTile(x, icon, 60, (H2 - S)/2, S) : 0, cx = iw ? (W2 + iw + 60)/2 : W2/2, room = W2 - 120 - (iw ? iw + 40 : 0);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; const n = lines.length;
  lines.forEach(([t, k], i) => { fit(x, t, room, H2*(k || 0.2), k > 0.24 ? 800 : 600); x.fillText(t, cx, H2*(i + 0.5)/n + (i - (n - 1)/2)*4); }); x.textAlign = 'left'; }); }
let rsEV = null; const RSIGNS = [];
function layoutRoadSigns(){
  rsEV = EV; for (const r of RSIGNS) if (r.g) { scene.remove(r.g); r.g.traverse(o => { if (o.material && o.material.userData.own) { o.material.map && o.material.map.dispose(); o.material.dispose(); } }); } RSIGNS.length = 0;
  const prov = u => { const p = latLonAt(u); return p.lat == null ? null : provinceAt(p.lat, p.lon); };
  for (let i = 0; i < EV.length - 1; i++) { const a = EV[i], b = EV[i + 1]; if (a.lat == null || b.lat == null) continue;
    // province border: bisect the segment where the province changes
    const pa = provinceAt(a.lat, a.lon), pb = provinceAt(b.lat, b.lon);
    if (pa !== pb) { let lo = a.u, hi = b.u; for (let k = 0; k < 18; k++) { const m = (lo + hi)/2; if (prov(m) === pa) lo = m; else hi = m; }
      RSIGNS.push({u: hi + 40, side: 1, lines: [['SELAMAT DATANG DI', 0.16], ['PROVINSI', 0.16], [pb.toUpperCase(), 0.3]], bg: SIGN_BLUE, w: 8, h: 3.6, icon: 'pin'});
      RSIGNS.push({u: hi - 40, side: -1, lines: [['SELAMAT DATANG DI', 0.16], ['PROVINSI', 0.16], [pa.toUpperCase(), 0.3]], bg: SIGN_BLUE, w: 8, h: 3.6, icon: 'pin'});
      RSIGNS.push({u: hi, side: 1, small: true, lines: [['BATAS PROVINSI', 0.3], [`${pa} | ${pb}`, 0.22]], bg: '#f4f4f0', fg: '#111', w: 4.2, h: 1.8}); }
    // start of a toll road: after the gate, or after joining it at a junction
    const cN = CORR[a.cNext], cP = CORR[a.c]; if (!cN || cN.cls !== 't') continue;
    if (i === 0 || !cP || cP.cls !== 't' || a.c !== a.cNext) {
      const mbz = a.cNext === 'mbz', lines = [['SELAMAT DATANG DI', 0.15], ['JALAN TOL', 0.17], [cN.name.replace(/^Tol\s+/i, '').toUpperCase(), 0.26]];
      if (mbz) lines.push(['Khusus Gol I: sedan, SUV, pickup · Bus & truk dilarang', 0.12]);
      if (!mbz) RSIGNS.push({u: a.u + (a.kind === 'j' ? 430 : 260), side: 1, lines, bg: SIGN_GREEN, w: 8.4, h: 3.6, icon: 'road'}); } }
  if (SEA) { RSIGNS.push({u: SEA[0] - 260, side: 1, lines: [['JEMBATAN SURAMADU', 0.24], ['Surabaya – Madura · 5,4 km', 0.16]], bg: SIGN_GREEN, w: 8, h: 3, icon: 'bridge'});
    RSIGNS.push({u: SEA[1] + 260, side: -1, lines: [['JEMBATAN SURAMADU', 0.24], ['Madura – Surabaya · 5,4 km', 0.16]], bg: SIGN_GREEN, w: 8, h: 3, icon: 'bridge'}); }
  // MBZ: an overhead sign over the two right lanes before the fork on Japek, a welcome gantry on the MBZ itself
  const G = MBZG; if (G && (G.si >= 0 || G.frame === 'mbz')) {
    RSIGNS.push({u: G.F - 350, side: 1, lines: [['TOL LAYANG MBZ', 0.28], ['← Lajur kiri · 350 m', 0.17], ['Khusus Gol I: sedan, SUV, pickup', 0.13]], bg: SIGN_GREEN, w: 8, h: 3.6, icon: 'left'});
    if (G.frame === 'mbz') RSIGNS.push({u: G.uH + 80, side: 1, lines: [['SELAMAT DATANG DI', 0.15], ['TOL LAYANG MBZ', 0.28], ['Khusus Gol I: sedan, SUV, pickup', 0.14]], bg: SIGN_GREEN, icon: 'road', w: 6.6, h: 3.2}); }
}
function updateRoadSigns(){
  if (!EV.length) return; if (rsEV !== EV) layoutRoadSigns();
  for (const r of RSIGNS) { const z = camU - r.u, vis = Math.abs(z) < 700;
    // beside the MBZ (Japek right next to it) a sign hangs over the MBZ's lanes from a gantry on the median and the parapet
    if (vis && !r.g && !r.posts && mbzSide(r.u)) { r.posts = [0.75, MED + 2*LW + 0.15]; r.w = Math.min(r.w, 6.6); }
    if (vis && !r.g) { r.g = new THREE.Group(); const ov = !!r.posts, top = ov ? 7.2 : r.small ? 2.6 : 5.6, b = panelMesh(r.w, r.h, bigBoard(r.w, r.h, r.bg, r.lines, r.fg, r.icon || (r.small ? null : 'pin'))); b.position.set(ov ? -(MED + LW) : 0, top, 0); r.g.add(b);
      if (ov) { const [p0, p1] = r.posts; for (const px of r.posts) r.g.add(solid(0.3, top + 0.3, 0.3, signBackMat, -px, (top + 0.3)/2, -0.3));
        r.g.add(solid(p1 - p0, 0.35, 0.35, signBackMat, -(p0 + p1)/2, top, -0.3)); }
      else for (const dx of r.small ? [0] : [-r.w*0.32, r.w*0.32]) r.g.add(solid(0.2, top - r.h/2 + 0.1, 0.2, signBackMat, dx, (top - r.h/2)/2, -0.15));
      applySign([r.g]); bendObj(r.g); scene.add(r.g); }
    if (!r.g) continue; r.g.visible = vis; if (!vis) continue;
    const hid = mbzHid(r.u) || (mbzRampAt(r.u) && !r.posts), e = hid ? MBZ_EJ : eAt(r.u), off = hid ? 16 : elevAt(r.u) > 1 ? 2.2 : r.small ? 3.4 : 6.5, x = r.posts ? 0 : r.side > 0 ? -(e + off) : e + off;
    r.g.position.set(x, hid ? -elevAt(r.u) : 0, z); r.g.rotation.y = r.side > 0 ? 0 : Math.PI; }
}

// ---------- mirrors (spion): rear-facing cameras rendered to small textures and shown flipped, like real mirrors ----------
// chase view: the interior mirror at the top centre; cockpit view: interior mirror plus the left and right door mirrors
const MIR_Q = MOBILE ? 0.75 : 1, mirScene = new THREE.Scene(), mirCam2 = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
const MIRRORS = ['c', 'l', 'r'].map(k => {
  const rt = new THREE.WebGLRenderTarget(Math.round((k === 'c' ? 512 : 256)*MIR_Q), Math.round((k === 'c' ? 150 : 170)*MIR_Q)); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.PerspectiveCamera(k === 'c' ? 34 : 30, k === 'c' ? 512/150 : 256/170, 0.4, 260);
  const geo = new THREE.PlaneGeometry(1, 1); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));   // mirror image
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({color: 0x111111, toneMapped: false}));
  const face = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map: rt.texture, toneMapped: false})); face.position.z = 0.1;
  mirScene.add(frame, face); return {k, rt, cam, frame, face, on: false};
});
let mirT = 0, mirBox = null, mirN = 0;
function layoutMirrors(){
  const W = innerWidth, H = innerHeight, top = $('top').getBoundingClientRect(), mp = $('map').getBoundingClientRect();
  const midL = top.right < W*0.6 ? top.right : 0, midR = mp.left > W*0.4 ? mp.left : W, cw = Math.min(380, (midR - midL)*0.6, W*0.5), ch = cw*150/512;
  const y0 = top.right >= W*0.6 || top.left <= W/2 && top.right >= W/2 ? top.bottom + 8 : 10;
  const sw = Math.min(170, W*0.18), sh = sw*170/256, sy = H*0.5;
  mirBox = {c: [midL + (midR - midL - cw)/2, y0, cw, ch], l: [Math.max(8, midL + 8), sy, sw, sh], r: [Math.min(W - sw - 8, midR - sw - 8), sy, sw, sh]};
  mirCam2.right = W; mirCam2.top = H; mirCam2.updateProjectionMatrix();
}
addEventListener('resize', () => setTimeout(layoutMirrors, 150));
function drawMirrors(dt){
  const v = PLR, want = cfg.mirror !== false && QUAL.level < 4 && v && !foot && (camMode === 'chase' || camMode === 'cockpit') && $('plan').hidden && $('atlas').hidden;
  if (!want) return; if (!mirBox) layoutMirrors();
  if ((mirT -= dt) < 0) { mirT = 1; layoutMirrors(); }
  const g = v.g, fwd = headV, up = 1.25 + (v.q ? v.q.h || 0 : 0) + (heavy(v) ? 1.3 : v.type === 'suv' || v.type === 'van' || v.type === 'angkot' ? 0.35 : 0);
  const right = tmpV2.set(-fwd.z, 0, fwd.x);
  const W = innerWidth, H = innerHeight, redraw = (mirN = (mirN + 1) % (QUAL.level >= 2 || MOBILE ? 3 : 2)) === 0;
  for (const m of MIRRORS) { m.on = m.k === 'c' || camMode === 'cockpit'; m.frame.visible = m.face.visible = m.on; if (!m.on) continue;
    const side = m.k === 'l' ? -1 : m.k === 'r' ? 1 : 0, hw = (HW[v.type] || 0.92) + 0.15;
    m.cam.position.set(g.position.x + right.x*side*hw + fwd.x*(m.k === 'c' ? -0.2 : 0.6), up + (side ? -0.25 : 0.2), g.position.z + right.z*side*hw + fwd.z*(m.k === 'c' ? -0.2 : 0.6));
    m.cam.lookAt(m.cam.position.x - fwd.x*40 + right.x*side*6, up - (side ? 1.2 : 0.5), m.cam.position.z - fwd.z*40 + right.z*side*6);
    if (redraw) { g.visible = m.k !== 'c'; if (CKP) CKP.g.visible = false; renderer.setRenderTarget(m.rt); renderer.render(scene, m.cam); g.visible = camMode !== 'cockpit'; if (CKP) CKP.g.visible = camMode === 'cockpit' && !foot && !tow; }    // the interior mirror looks out through the rear window
    const [x, y, w, h] = mirBox[m.k]; m.face.scale.set(w, h, 1); m.face.position.set(x + w/2, H - y - h/2, 0.1); m.frame.scale.set(w + 6, h + 6, 1); m.frame.position.set(x + w/2, H - y - h/2, 0); }
  renderer.setRenderTarget(null); const ac = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(mirScene, mirCam2); renderer.autoClear = ac;
}
const tmpV2 = new THREE.Vector3();

function viaduct(g, u0, u1, Z){
  const hm = Math.max(elevAt(u0), elevAt(u1), elevAt(u0 + CH/2)); if (hm < 0.4) return;
  const e = eAt(u0 + CH/2), mz = MBZG && MBZG.frame === 'mbz' && corrAt(u0 + CH/2) === 'mbz';
  // the MBZ: a narrow deck over Japek's inner lanes on one column per pier in Japek's median, only between its side ramps
  const [da, db] = mz ? [Math.max(u0, MBZG.uH), Math.min(u1, MBZG.uE)] : [u0, u1], single = mz; if (db - da < 0.5) return;
  g.add(solid(2*(e + (single ? 0.3 : 3.2)), 0.9, db - da, concrete, 0, -0.75, Z((da + db)/2)));
  if (!single) for (const s of [-1, 1]) g.add(solid(0.35, 1.3, CH, fasciaMat, s*(e + 3.3), -0.4, -CH/2));
  const step = single ? 40 : 32;
  for (let u = Math.ceil(da/step)*step; u < db; u += step) { const h = elevAt(u); if (h < 1.2) continue;
    if (single) { if (h < 3 || OPENS.some(o => Math.abs(o.u - u) < OPEN_HW + 3)) continue;
      const c = new THREE.Mesh(viaPierGeo, concrete); c.position.set(0, -h/2 - 0.6, Z(u)); c.scale.set(1, h, 1); c.castShadow = true; g.add(c);
      g.add(solid(2*MBZ_W - 1, 1.4, 2.4, concrete, 0, -1.9, Z(u))); continue; }
    for (const s of [-1, 1]) { const x = s*(MED + (e - MED)/2), c = new THREE.Mesh(viaPierGeo, concrete); c.position.set(x, -h/2 - 0.6, Z(u)); c.scale.set(1, h, 1); c.castShadow = true; g.add(c);
      g.add(solid(e - MED + 1, 1.0, 2.2, concrete, x, -1.6, Z(u))); } }
}
// ---------- Tol Layang MBZ stacked over Jakarta–Cikampek (KM 10 Cikunir – KM 46 Karawang Barat) ----------
// The same layout whichever road you drive (Japek or the MBZ), in route u of the current trip (lo, hi: the two MBZ end nodes):
//   F = lo + 450: a two-lane ramp leaves Japek on the LEFT, like an exit, climbs beside it outside the guard rail and, once high
//   enough to clear the traffic, swings over Japek to the deck above the median (reached at uH = F + RL). The deck runs on one
//   column per pier in Japek's median to uE = M - RL, where each direction swings out to the side again and comes down onto
//   Japek's left lane at M = hi - 450. On the MBZ the ramps are driven like any ramp (with the world switching at the deck).
const MBZ_K = [10, 46], MBZ_H = ELEVATED.mbz, MBZ_W = MED + 2*LW + 0.3, MBZ_EJ = MED + 4*LW;   // deck half width, Japek's edge
const MBZ_KEYS = ['JCT Cikunir', 'Karawang Barat'];
function mbzGeom(lo, hi){ const F = lo + 450, M = hi - 450; if (M - F < 1400) return null;
  const RL = clamp((M - F - 600)/2, 300, 840); return {lo, hi, F, M, RL, uH: F + RL, uE: M - RL}; }
// a side ramp, tt = metres from where it leaves Japek (0) to the deck over the median (RL): centre line |x| and height
const mbzRX = (tt, RL) => { const ts = RL*0.52; return tt < ts ? 12 + 11.6*sstep(0, 80, tt) : 23.6 - 18.8*sstep(ts, RL, tt); };
const mbzRH = (tt, RL) => MBZ_H*sstep(20, RL, tt);
let MBZG = null;
function layoutMbz(){
  MBZG = null; let lo, hi, frame, si = -1;
  const i = EV.findIndex((e, k) => e.cNext === 'mbz' && EV[k + 1]);
  if (i >= 0) { lo = EV[i].u; hi = EV[i + 1].u; frame = 'mbz'; si = i; }
  else {
    const jk = []; for (let k = 0; k < EV.length - 1; k++) if (EV[k].cNext === 'japek') jk.push(k);
    if (!jk.length) return;
    // u of a Japek KM on this route (extrapolated past the ends of the route's Japek stretch)
    const uOf = km => { for (const k of jk) { const a = EV[k], b = EV[k + 1]; if (a.kmOut !== b.km && (km - a.kmOut)*(km - b.km) <= 0) return a.u + (b.u - a.u)*(km - a.kmOut)/(b.km - a.kmOut); }
      const f = EV[jk[0]], l = EV[jk[jk.length - 1] + 1], s = (l.u - f.u)/((l.km - f.kmOut) || 1);
      return Math.abs(km - f.kmOut) < Math.abs(km - l.km) ? f.u + (km - f.kmOut)*s : l.u + (km - l.km)*s; };
    const a = uOf(MBZ_K[0]), b = uOf(MBZ_K[1]); lo = Math.min(a, b); hi = Math.max(a, b); frame = 'japek';
    si = EV.findIndex(e => Math.abs(e.u - lo) < 1 && MBZ_KEYS.includes(e.key) && e.cNext === 'japek'); }
  const g = mbzGeom(lo, hi); if (!g) return;
  MBZG = {...g, frame, si};
}
// side ramp at u, on the side of travel direction d (the up ramp near lo, the down ramp near hi): {tt, x, h} or null
function mbzRampAt(u){ const G = MBZG; if (!G) return null;
  if (u >= G.F && u <= G.uH) return {tt: u - G.F, x: mbzRX(u - G.F, G.RL), h: mbzRH(u - G.F, G.RL)};
  if (u >= G.uE && u <= G.M) return {tt: G.M - u, x: mbzRX(G.M - u, G.RL), h: mbzRH(G.M - u, G.RL)};
  return null; }
const mbzDeck = u => !!MBZG && u >= MBZG.uH && u <= MBZG.uE;                        // the deck over the median
const mbzSide = u => mbzDeck(u) && MBZG.frame === 'mbz';                           // driving on the deck
const mbzUnder = u => !!MBZG && MBZG.frame === 'japek' && u >= MBZG.F && u <= MBZG.M;  // driving Japek under / beside the MBZ
const mbzHid = u => !!MBZG && MBZG.frame === 'mbz' && ((u > MBZG.F && u < MBZG.uH) || (u > MBZG.uE && u < MBZG.M));
const mbzHidRanges = () => MBZG && MBZG.frame === 'mbz' ? [[MBZG.F, MBZG.uH], [MBZG.uE, MBZG.M]] : [];
const mbzSideRanges = () => MBZG && MBZG.frame === 'mbz' ? [[MBZG.uH, MBZG.uE]] : [];
// gaps in Japek's left guard rail where the ramps leave / join it
const mbzGapRanges = () => MBZG ? [[MBZG.F - 10, MBZG.F + 90], [MBZG.M - 90, MBZG.M + 10]] : [];
const mbzGap = u => mbzGapRanges().some(([a, b]) => u > a && u < b);
// keep houses and trees off Japek and the ramps (measured from the centre line)
const mbzClear = u => { const G = MBZG; if (!G) return 0; if ((u > G.F - 60 && u < G.uH + 60) || (u > G.uE - 60 && u < G.M + 60)) return 32;
  return mbzSide(u) ? MBZ_EJ + 7 : 0; };
const mbzOK = () => !RULES.noMbz;
// no overpass or U-turn opening on the ramps, or along the MBZ while Japek is drawn on the land
const mbzNoOv = u => { const G = MBZG; if (!G) return false; if (G.frame === 'mbz') return u > G.lo - 200 && u < G.M + 300;
  return (u > G.lo && u < G.uH + 300) || (u > G.uE - 300 && u < G.M + 300); };
const ghosts = new Set();   // chunk groups carrying "ghost" traffic lanes (other levels of a stacked road)
const canalMat = M(0x4f7f86, {roughness: 0.25, metalness: 0.1}), bankMat = M(0x8f8f86); canalMat.userData.terrain = bankMat.userData.terrain = true;
// Becakayu stands on piers in the Kalimalang canal, with Jalan Kalimalang (Jl. KH Noer Ali) one-way on each bank
function kalimalangUnder(g, u0, u1, Z){
  if (Math.max(elevAt(u0), elevAt(u1)) < 1) return;
  const us = []; for (let u = u0; u <= u1 + 0.01; u += 10) us.push(u);
  const W = 11, R0 = W + 1.8;   // canal half width, start of the road on each bank
  g.add(strip(us, u => -W, u => W, -0.6, canalMat, Z));
  for (const sx of [-1, 1]) { g.add(strip(us, u => sx*W, u => sx*R0, 0.02, bankMat, Z), strip(us, u => sx*R0, u => sx*(R0 + 2*LW + 1), 0.01, prAsphalt, Z));
    g.add(strip(us, u => sx*(R0 + LW - 0.07), u => sx*(R0 + LW + 0.07), 0.02, prWhite, Z)); }
  const lanes = []; for (let l = 0; l < 2; l++) for (const d of [1, -1]) lanes.push({x: -d*(R0 + (l + 0.5)*LW), y: u => -elevAt(u) + 0.02, dir: d, vel: 11 + l*3, gap: (55 + l*20)*(MOBILE ? 1.6 : 1), ph: l*19 + (d > 0 ? 0 : 9)});
  ghostTraffic(g, u0, u1, Z, lanes);
}
function ghostTraffic(g, u0, u1, Z, lanes){
  const pool = []; for (const L of lanes) for (let k = 0; k < Math.ceil(CH/L.gap) + 1; k++) { const t = Math.random(), v = makeVehicle(t < 0.25 ? 'van' : t < 0.4 ? 'suv' : t < 0.5 ? 'bus' : 'car');
    v.g.rotation.y = L.dir > 0 ? Math.PI : 0; bendObj(v.g); g.add(v.g); pool.push({L, v, k}); }
  g.userData.ghost = {u0, u1, Z, pool}; ghosts.add(g);
}
function mbzStack(g, u0, u1, Z){
  const c = corrAt(u0 + CH/2); if (c === 'becakayu') return kalimalangUnder(g, u0, u1, Z);
  const G = MBZG; if (!G) return;
  const a = Math.max(u0, G.F), b = Math.min(u1, G.M); if (b - a < 1) return;
  if (G.frame === 'japek' && !(corrAt(a) === 'japek' || corrAt(b) === 'japek')) return;
  const onMbz = G.frame === 'mbz', off = u => onMbz ? -elevAt(u) : 0;    // driving the MBZ the land (and all this) sits below the road
  const lanes = [], gp = MOBILE ? 1.6 : 1;
  const span = (p, q) => { const r = []; for (let u = p; u < q; u += 5) r.push(u); r.push(q); return r; };
  // ---- the side ramps (two lanes each), both carriageways
  for (const [ra, rb] of [[G.F, G.uH], [G.uE, G.M]]) { const p = Math.max(a, ra), q = Math.min(b, rb); if (q - p < 1) continue;
    const ds = span(p, q), X = u => mbzRampAt(u).x, H = u => mbzRampAt(u).h + off(u) + 0.02, tt = u => mbzRampAt(u).tt;
    for (const sx of [-1, 1]) {
      g.add(ribbonY(ds, u => sx*(X(u) - 3.9), u => sx*(X(u) + 3.9), H, asphaltDS, Z), ribbonY(ds, u => sx*(X(u) - 3.9), u => sx*(X(u) + 3.9), u => H(u) - 1.2, concreteD, Z));
      for (const lat of [-3.75, 3.75]) g.add(ribbonY(ds, u => sx*(X(u) + lat - 0.07), u => sx*(X(u) + lat + 0.07), u => H(u) + 0.03, whiteDS, Z));
      // parapets: the outer one from the start, the inner one once the ramp has left Japek's carriageway
      const outer = ds.filter(u => tt(u) > 8), inner = ds.filter(u => X(u) - 3.9 > MBZ_EJ + 0.4 || mbzRampAt(u).h > 1.2);
      for (const [pts, lat] of [[outer, 3.9], [inner, -3.9]]) for (const r of contig(pts)) {
        g.add(wallY(r, u => sx*(X(u) + lat), u => H(u) - 1.2, u => H(u) + 1.0, concreteD, Z), ribbonY(r, u => sx*(X(u) + lat - 0.15*Math.sign(lat)), u => sx*(X(u) + lat), u => H(u) + 1.0, barMatD, Z)); }
      const dm = new THREE.InstancedMesh(dashGeo, white, ds.length); let n = 0;
      for (let u = Math.ceil(p/9)*9; u < q - 3; u += 9) { tm.makeTranslation(sx*X(u + 1.5), H(u + 1.5) + 0.04, Z(u + 1.5)); dm.setMatrixAt(n++, tm); } dm.count = n; g.add(dm);
      if (ra === G.F && G.F >= u0 && G.F < u1) g.add(solid(0.8, 0.9, 3, gorMat, sx*(MBZ_EJ + 0.6), off(G.F + 30) + 0.45, Z(G.F + 30)));
      // ramp traffic (travelling with the carriageway on this side)
      for (const lat of [1.8, -1.8]) lanes.push({x: u => { const r = mbzRampAt(u); return r ? sx*(r.x + lat) : 0; }, y: u => { const r = mbzRampAt(u); return r ? r.h + off(u) + 0.02 : 0; },
        ok: u => { const r = mbzRampAt(u); return !!r && r.h > 1.5; }, mbz: true, dir: -sx, vel: 16, gap: 120*gp, ph: (lat > 0 ? 11 : 47) + (sx > 0 ? 23 : 0)}); }
    // piers: a single column under the ramp beside Japek, a full-width bent (columns in the median and outside Japek) where it crosses over
    for (let u = Math.ceil(p/40)*40; u < q; u += 40) { const r = mbzRampAt(u); if (!r || r.h < 3) continue; const y0 = off(u), top = y0 + r.h - 1.2;
      if (r.x - 3.9 > MBZ_EJ + 3.5) { for (const sx of [-1, 1]) { const m = new THREE.Mesh(viaPierGeo, concrete); m.position.set(sx*r.x, y0 + (r.h - 1.2)/2, Z(u)); m.scale.set(0.9, r.h - 1.2, 0.9); m.castShadow = true; g.add(m); g.add(solid(7, 1.0, 2, concrete, sx*r.x, top - 0.5, Z(u))); } continue; }
      if (OPENS.some(o => Math.abs(o.u - u) < OPEN_HW + 3) || RSITES.some(s => s.kind !== 'j' && Math.abs(s.u - u) < 260)) continue;
      const W = MBZ_EJ + 4.5;
      for (const x of [-W, 0, W]) { const m = new THREE.Mesh(viaPierGeo, concrete); m.position.set(x, y0 + (r.h - 2.2)/2, Z(u)); m.scale.set(0.8, r.h - 2.2, 0.8); m.castShadow = true; g.add(m); }
      g.add(solid(2*W + 2, 1.0, 2, concrete, 0, top - 0.5, Z(u))); }
  }
  // ---- driving Japek: the deck over the median, its single columns and lamps, its traffic
  if (!onMbz) { const p = Math.max(a, G.uH), q = Math.min(b, G.uE);
    if (q - p > 1) { const ds = span(p, q), H = () => MBZ_H + 0.02, W = MBZ_W;
      g.add(ribbonY(ds, u => -W, u => W, H, asphaltDS, Z), ribbonY(ds, u => -W, u => W, () => H() - 1.5, concreteD, Z));
      g.add(ribbonY(ds, u => -0.25, u => 0.25, () => H() + 0.9, barMatD, Z), wallY(ds, u => -0.25, H, () => H() + 0.9, barMatD, Z), wallY(ds, u => 0.25, H, () => H() + 0.9, barMatD, Z));
      for (const sx of [-1, 1]) {
        g.add(wallY(ds, u => sx*W, () => H() - 1.5, () => H() + 1.1, concreteD, Z), wallY(ds, u => sx*(W - 0.3), H, () => H() + 1.1, barMatD, Z), ribbonY(ds, u => sx*(W - 0.3), u => sx*W, () => H() + 1.1, barMatD, Z));
        for (const x of [MED + 0.2, MED + 2*LW - 0.1]) g.add(ribbonY(ds, u => sx*(x - 0.07), u => sx*(x + 0.07), () => H() + 0.05, whiteDS, Z)); }
      for (let u = Math.ceil(p/40)*40; u < q; u += 40) { if (OPENS.some(o => Math.abs(o.u - u) < OPEN_HW + 3)) continue;
        const m = new THREE.Mesh(viaPierGeo, concrete); m.position.set(0, (MBZ_H - 1.5)/2, Z(u)); m.scale.set(1, MBZ_H - 1.5, 1); m.castShadow = true; g.add(m);
        g.add(solid(2*MBZ_W - 1, 1.4, 2.4, concrete, 0, MBZ_H - 2.1, Z(u))); }
      for (let u = Math.ceil(p/45)*45 + 20; u < q; u += 45) { const pl = new THREE.Mesh(poleGeo, lampMat), ar = new THREE.Mesh(armGeo, lampMat); pl.position.set(0, MBZ_H, Z(u)); ar.position.set(0, MBZ_H, Z(u)); g.add(pl, ar);
        for (const sx of [-1, 1]) { const hd = new THREE.Mesh(headGeo, lampHeadMat); hd.position.set(sx*2.8, MBZ_H + 10.8, Z(u)); g.add(hd); } } }
    for (let l = 0; l < 2; l++) for (const d of [1, -1]) lanes.push({x: -d*(MED + (l + 0.5)*LW), y: () => MBZ_H + 0.02, ok: mbzDeck, mbz: true, dir: d, vel: 22 + l*3, gap: (85 + l*30)*gp, ph: l*31 + (d > 0 ? 0 : 17)});
  } else {
    // ---- driving the MBZ: Japek on the land below (both carriageways, barrier, rails with the ramp gaps) and its traffic
    const us = []; for (let u = a; u < b; u += 10) us.push(u); us.push(b);
    const X = l => MED + l*LW, rails = cut([a, b], mbzGapRanges());
    for (const sx of [-1, 1]) {
      g.add(strip(us, u => sx*MED, u => sx*(X(4) + 3), 0.01, prAsphalt, Z), strip(us, u => sx*(X(4) + 3), u => sx*(X(4) + 7), 0.006, prVerge, Z));
      for (const x of [MED + 0.2, X(4)]) g.add(strip(us, u => sx*(x - 0.08), u => sx*(x + 0.08), 0.02, prWhite, Z));
      for (const [p, q] of rails) { const r = []; for (let u = p; u < q; u += 10) r.push(u); r.push(q); if (q - p > 1) g.add(wall(r, u => sx*(X(4) + 2.8), 0.55, 0.85, prRail, Z)); }
      const dp = []; for (let u = Math.ceil(a/9)*9; u < b - 3; u += 9) for (let l = 1; l < 4; l++) dp.push([sx*X(l), Z(u + 1.5)]);
      g.add(instanced(prDashGeo, prWhite, dp, 0.02)); }
    g.add(strip(us, u => -MED, u => MED, 0.008, prVerge, Z), solid(0.6, 0.9, b - a, prBar, 0, 0.45, Z((a + b)/2)));
    for (let l = 0; l < 4; l++) for (const d of [1, -1]) lanes.push({x: -d*(MED + (l + 0.5)*LW), y: u => -elevAt(u) + 0.02, dir: d, vel: 18 + l*4, gap: (80 + l*15)*gp, ph: l*13 + (d > 0 ? 0 : 7)});
  }
  // moving traffic: car positions follow one global pattern (u = phase + n·gap + v·t), so they flow seamlessly from chunk to chunk
  const pool = []; for (const L of lanes) for (let k = 0; k < Math.ceil(CH/L.gap) + 1; k++) { const t = Math.random();
    const v = makeVehicle(L.mbz ? (t < 0.25 ? 'pickup' : t < 0.5 ? 'suv' : 'car') : t < 0.15 ? 'truck' : t < 0.22 ? 'bus' : t < 0.4 ? 'suv' : 'car');
    v.g.rotation.y = L.dir > 0 ? Math.PI : 0; bendObj(v.g); g.add(v.g); pool.push({L, v, k}); }
  g.userData.ghost = {u0, u1, Z, pool}; ghosts.add(g);
}
// split a sorted list of u (5 m apart) into contiguous runs
function contig(us){ const out = []; let r = []; for (const u of us) { if (r.length && u - r[r.length - 1] > 5.5) { if (r.length > 1) out.push(r); r = []; } r.push(u); } if (r.length > 1) out.push(r); return out; }
function animGhosts(){
  for (const g of ghosts) { if (!g.parent) { ghosts.delete(g); continue; } const {u0, u1, Z, pool} = g.userData.ghost;
    for (const {L, v, k} of pool) { const base = mod(L.ph + L.dir*L.vel*clock - u0, L.gap), u = u0 + base + k*L.gap;
      if (u >= u1 || (L.ok && !L.ok(u))) { v.g.visible = false; continue; } v.g.visible = true; v.g.position.set(typeof L.x === 'function' ? L.x(u) : L.x, L.y(u), Z(u)); } }
}
const viaPierGeo = (() => { const g = new THREE.CylinderGeometry(0.9, 1.0, 1, 12); g.userData.keep = true; return g; })();

// ================================================================
// POWER LINES: PLN distribution poles along national roads, SUTET 500 kV transmission towers
// ================================================================
const distWireMat = new THREE.LineBasicMaterial({color: 0x26282a}), hvWireMat = new THREE.LineBasicMaterial({color: 0x3a3d40});
distWireMat.userData.terrain = hvWireMat.userData.terrain = true; patchMat(distWireMat); patchMat(hvWireMat);
const insMat = M(0xd8d2c4, {roughness: 0.5}); insMat.userData.terrain = true;
const insGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.35, 6); insGeo.userData.keep = true;
// [lateral offset from the pole, height, sag over a 40 m span]: three phase wires on the cross-arm, neutral on the pole top, telecom cable lower down
const PLN_WIRES = [[-0.7, 8.7, 0.55], [0, 9.0, 0.5], [0.7, 8.7, 0.55], [0, 7.2, 0.6], [0.15, 5.6, 0.7]];
const plnPole = u => !KSITES.some(t => Math.abs(t.u - u) < XW/2 + 9);
const plnX = u => eAt(u) + (townNear(u, TOWN_R + 80) ? 4.3 : 3.6);
// a sagging wire from A to B as line segments (parabola, n pieces)
function wireSpan(out, x0, y0, z0, x1, y1, z1, sag, n){
  let px = x0, py = y0, pz = z0;
  for (let i = 1; i <= n; i++) { const t = i/n, x = x0 + (x1 - x0)*t, z = z0 + (z1 - z0)*t, y = y0 + (y1 - y0)*t - 4*sag*t*(1 - t);
    out.push(px, py, pz, x, y, z); px = x; py = y; pz = z; } }
function wireMesh(arr, mat){ const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  const l = new THREE.LineSegments(geo, mat); l.frustumCulled = false; return l; }

// lattice tower (double circuit, ~56 m): legs, girts, X-bracing, three cross-arms per side and an earth-wire peak; arms along local x
const steelMat = M(0x8b9196, {metalness: 0.55, roughness: 0.45}); steelMat.userData.terrain = true;
const SUTET_ARMS = [[32, 9], [40, 11.5], [48, 9]], SUTET_EARTH = [[56, 4]];
const towerGeo = (() => {
  const parts = [], up = new THREE.Vector3(0, 1, 0);
  const beam = (a, b, t) => { const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(); const g = new THREE.BoxGeometry(t, L, t); g.translate(0, L/2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.normalize())); g.translate(a[0], a[1], a[2]); parts.push(g); };
  const lv = [0, 7, 14, 21, 27, 32, 36, 40, 44, 48, 52], hw = y => y <= 27 ? 5.2 - (5.2 - 1.5)*y/27 : y <= 50 ? 1.5 : 1.5 - (y - 50)*0.12;
  const C = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  for (let i = 0; i < lv.length; i++) { const y = lv[i], h = hw(y);
    for (let c = 0; c < 4; c++) { const [ax, az] = C[c], [bx, bz] = C[(c + 1) % 4];
      if (i > 0) beam([ax*h, y, az*h], [bx*h, y, bz*h], 0.16);
      if (i < lv.length - 1) { const y2 = lv[i+1], h2 = hw(y2); beam([ax*h, y, az*h], [ax*h2, y2, az*h2], 0.34);
        beam([ax*h, y, az*h], [bx*h2, y2, bz*h2], 0.12); beam([bx*h, y, bz*h], [ax*h2, y2, az*h2], 0.12); } } }
  const top = 52, ht = hw(top); for (const [ax, az] of C) beam([ax*ht, top, az*ht], [0, 57, 0], 0.2);
  for (const [y, L] of [...SUTET_ARMS, ...SUTET_EARTH]) { const h = hw(y);
    for (const sx of [-1, 1]) { beam([sx*h, y, -h], [sx*L, y, 0], 0.16); beam([sx*h, y, h], [sx*L, y, 0], 0.16); beam([sx*h, y + 2.4, 0], [sx*L, y, 0], 0.14);
      beam([sx*h, y + 2.4, -h*0.6], [sx*h, y + 2.4, h*0.6], 0.12); } }
  const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); g.userData.keep = true; return g;
})();
const strGeo = (() => { const g = new THREE.CylinderGeometry(0.22, 0.22, 4, 6); g.translate(0, -2, 0); g.userData.keep = true; return g; })();   // insulator string
// conductor attachment points in tower coordinates [x along the arms, y]
const SUTET_PTS = [...SUTET_ARMS.flatMap(([y, L]) => [[-L, y - 4], [L, y - 4]]), ...SUTET_EARTH.flatMap(([y, L]) => [[-L, y], [L, y]])];
const SPAN = 400, PBLK = 6000;
const hsh = (n, k) => { const r = rng((n + 100000)*92821 + k*7 + 1); r(); return r(); };
const lineOn = b => hsh(b, 2) < 0.55;
function lineRun(b){ let a = b; for (let k = 0; k < 40 && lineOn(a - 1); k++) a--; let e = b; for (let k = 0; k < 40 && lineOn(e + 1); k++) e++; return [a*PBLK, (e + 1)*PBLK, hsh(a, 1) < 0.5 ? 1 : -1]; }
function siteDist(u){ let lo = 0, hi = SITES.length; while (lo < hi) { const m = (lo + hi) >> 1; if (SITES[m].u < u) lo = m + 1; else hi = m; }
  let d = Infinity; for (const j of [lo - 1, lo]) if (SITES[j]) d = Math.min(d, Math.abs(SITES[j].u - u)); return d; }
// parallel line: tower k stands at u = k*SPAN (nudged off overpasses) at distance D from the carriageway edge
function sutetTower(k){
  const b = Math.floor(k*SPAN/PBLK); if (!lineOn(b)) return null;
  const [ra, rb, side] = lineRun(b); let u = k*SPAN;
  const ov = OVS.find(o => Math.abs(o.u - u) < 45); if (ov) u = ov.u + (u >= ov.u ? 1 : -1)*45;
  const w = clamp((1150 - siteDist(u))/450, 0, 1), de = Math.min(u - ra, rb - u);
  let D = 150 + 330*w*w*(3 - 2*w);
  if (de < 2*SPAN) D += 1400*Math.pow(1 - de/(2*SPAN), 2);       // the line swings away from the road where it ends
  if (isToll(u) && Math.abs(D - PRC) < 18) D = PRC + 18;            // never on the parallel road
  return {u, x: side*(eAt(u) + D)};
}
function addSutet(g, u0, u1, Z){
  if (!EV.length) return;
  const T = [], ins = [], wires = [];
  const place = (x, u, rot) => { tm.compose(new THREE.Vector3(x, 0, Z(u)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(1, 1, 1)); T.push(tm.clone());
    for (const [ax, ay] of SUTET_PTS) if (ay < 50) { const c = Math.cos(rot), s2 = Math.sin(rot); tm.compose(new THREE.Vector3(x + ax*c, ay + 4, Z(u) - ax*s2), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); ins.push(tm.clone()); } };
  // attachment point j of a tower at (x, z) whose arms point along angle rot
  const att = (x, z, rot, j) => { const [ax, ay] = SUTET_PTS[j]; return [x + ax*Math.cos(rot), ay, z - ax*Math.sin(rot)]; };
  const rotOf = (a, c) => Math.atan2(c.x - a.x, Z(c.u) - Z(a.u));   // arms perpendicular to the line
  for (let k = Math.ceil((u0 - 60)/SPAN); k*SPAN < u1 + 60; k++) {
    const t = sutetTower(k); if (!t || t.u < u0 || t.u >= u1) continue;
    const p = sutetTower(k - 1), n = sutetTower(k + 1), a = p || t, c = n || t, rot = rotOf(a, c);
    place(t.x, t.u, rot);
    if (n) { const n2 = sutetTower(k + 2), rn = rotOf(t, n2 || n);
      for (let j = 0; j < SUTET_PTS.length; j++) { const A = att(t.x, Z(t.u), rot, j), B = att(n.x, Z(n.u), rn, j), L = Math.hypot(B[0] - A[0], B[2] - A[2]);
        wireSpan(wires, A[0], A[1], A[2], B[0], B[1], B[2], (j >= 6 ? 0.022 : 0.03)*L, 24); } } }
  // a line crossing the road once in some blocks, well away from interchanges and overpasses
  const b = Math.floor((u0 + u1)/2/PBLK), uc = (b + 0.5)*PBLK;
  if (uc >= u0 && uc < u1 && hsh(b, 3) < 0.4 && siteDist(uc) > 1300 && !OVS.some(o => Math.abs(o.u - uc) < 140)) {
    const e = eAt(uc), xs = [-1, 1].flatMap(s => [0, 1, 2, 3].map(j => s*(e + 45 + j*390))).sort((p, q) => p - q), rot = Math.PI/2;
    for (const x of xs) place(x, uc, rot);
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < SUTET_PTS.length; j++) { const A = att(xs[i], Z(uc), rot, j), B = att(xs[i+1], Z(uc), rot, j), L = Math.abs(B[0] - A[0]);
      wireSpan(wires, A[0], A[1], A[2], B[0], B[1], B[2], (j >= 6 ? 0.022 : 0.03)*L, 24); } }
  if (!T.length && !wires.length) return;
  if (T.length) { const m = new THREE.InstancedMesh(towerGeo, steelMat, T.length); T.forEach((x, i) => m.setMatrixAt(i, x)); m.castShadow = true; g.add(m);
    const s = new THREE.InstancedMesh(strGeo, insMat, ins.length); ins.forEach((x, i) => s.setMatrixAt(i, x)); g.add(s); }
  if (wires.length) g.add(wireMesh(wires, hvWireMat));
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
const jLink = () => [[1.8,50],[1.8,150],[2.5,190],[6,224.6],[16,250],[24,272],[28,298],[26,336],[7,348],[1.8,356]];
function prof(p, keys){ const c = [0]; for (let i=1; i<p.length; i++) c.push(c[i-1] + Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]));
  return p.map((q, i) => { let h; const K = keys.length;
    if (i <= keys[0][0]) h = keys[0][1]; else if (i >= keys[K-1][0]) h = keys[K-1][1];
    else { let j = 0; while (keys[j+1][0] < i) j++; const [a, ha] = keys[j], [b, hb] = keys[j+1]; h = ha + (hb-ha)*vcurve((c[i]-c[a])/((c[b]-c[a]) || 1)); }
    return [q[0], q[1], h]; }); }
// trumpet interchange with a toll gate on the stem road (exit to Jalan Nasional)
const TR_H = 6.8, GATE_O = 200, PR_IN = PRC - 7.2 + 3;
// the player's exit when the trip carries on into town: through the gate on the stem, then a link road that curves forward
// and joins the main axis, which beyond this exit is already the road to town (no teleport, no reload)
const xLink = () => [[1.8,50],[2.6,58],[4.5,66],[8,75],[40,108],[62,130],[74,146],[82,162],[90,174],[100,178.25],[296,178.25],[309,186],[313,200],[310,235],[290,290],[245,345],[190,400],[135,450],[85,495],[45,530],[18,562],[6,592],[1.8,630],[1.8,700]];
const xLinkHere = s => s.kind === 'x' && EV[s.i] && EV[s.i + 1] && CORR[EV[s.i].cNext] && CORR[EV[s.i].cNext].cls !== 't' && s.i !== trip.destIdx;
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
// pieces of a path for dashed lines: on metres drawn, off metres skipped
function dashRuns(p, on, off){ const out = []; let acc = 0, cur = [p[0]];
  for (let i = 1; i < p.length; i++) { acc += Math.hypot(p[i][0] - p[i-1][0], p[i][1] - p[i-1][1]); const draw = acc % (on + off) < on;
    if (draw) cur.push(p[i]); else { if (cur.length > 1) out.push(cur); cur = [p[i]]; } }
  if (cur.length > 1) out.push(cur); return out; }
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
// two: where the ramp has a second lane (on the right of the travel direction, the path itself is the left lane)
function ramp3(g, raw, e, keep = () => true, zs = SC, two = null, twoL = null){
  const piers = [], q0 = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), upv = new THREE.Vector3(0, 1, 0);
  const W = q => !!two && two(q), WL = q => !!twoL && twoL(q);
  for (const p of runsOf(smooth(raw), q => q[0] > -2 && !onDeckQ(q))) {
    g.add(ribbon(p, e, 4.2, asphaltDS, -0.006, 0, zs));
    for (const r of runsOf(p, WL)) { g.add(ribbon(r, e, 3.8, asphaltDS, -0.004, 3.95, zs), ribbon(r, e, 0.15, whiteDS, 0.012, 5.65, zs));
      for (const d of dashRuns(r, 3, 6)) g.add(ribbon(d, e, 0.14, whiteDS, 0.014, 2.1, zs)); }
    for (const r of runsOf(p, W)) { g.add(ribbon(r, e, 3.8, asphaltDS, -0.004, -3.95, zs));
      for (const d of dashRuns(r, 3, 6)) g.add(ribbon(d, e, 0.14, whiteDS, 0.014, -2.1, zs)); }
    for (const r of runsOf(p, q => (q[0] > 3.3 || Hh(q) > 0.5) && keep(q) && !WL(q))) g.add(ribbon(r, e, 0.15, whiteDS, 0.012, 1.95, zs));
    for (const r of runsOf(p, q => (q[0] > 3.3 || Hh(q) > 0.5) && keep(q) && !W(q))) g.add(ribbon(r, e, 0.15, whiteDS, 0.012, -1.95, zs));
    for (const r of runsOf(p, q => keep(q) && W(q))) g.add(ribbon(r, e, 0.15, whiteDS, 0.012, -5.65, zs));
    // the right edge of each stretch: one lane or two
    for (const [f, R] of [[q => !W(q), 2.35], [W, 5.95]]) for (const p2 of runsOf(p, f)) {
      for (const r of runsOf(p2, q => Hh(q) > 0.6)) for (const [sd, w] of [[-1, R], [1, 2.35]]) {
        if (sd === 1 && R > 3) continue;     // the left parapet is drawn once, with the one-lane stretches
        g.add(sideStrip(r, e, sd*w, -0.05, sd*w, 0.9, parapetMat, zs), sideStrip(r, e, sd*(w - 0.25), 0.9, sd*w, 0.9, parapetMat, zs)); }
      // embankment (fill) up to 5.5 m, slopes 1:1.5
      for (const r of runsOf(p2, q => Hh(q) > 0.05 && Hh(q) <= 5.6)) g.add(sideStrip(r, e, -R, -0.05, h => -(R + 1.5*h), 0, slopeMat, zs, true, false));
      // viaduct above that: deck edge + piers with crossbeams
      for (const r of runsOf(p2, q => Hh(q) > 5.2)) g.add(sideStrip(r, e, -R, -1.0, -R, -0.05, fasciaMat, zs), sideStrip(r, e, -R, -1.0, 2.35, -1.0, fasciaMat, zs)); }
    for (const r of runsOf(p, W)) for (const q of r) if (Hh(q) > 0.6) { g.add(sideStrip(r.filter(q => Hh(q) > 0.6), e, 2.35, -0.05, 2.35, 0.9, parapetMat, zs), sideStrip(r.filter(q => Hh(q) > 0.6), e, 2.1, 0.9, 2.35, 0.9, parapetMat, zs)); break; }
    for (const r of runsOf(p, q => Hh(q) > 0.05 && Hh(q) <= 5.6)) g.add(sideStrip(r, e, 2.35, -0.05, h => 2.35 + 1.5*h, 0, slopeMat, zs, true, false));
    for (const r of runsOf(p, q => Hh(q) > 5.2)) g.add(sideStrip(r, e, 2.35, -1.0, 2.35, -0.05, fasciaMat, zs));
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
const boothMat = M(0xe4e9ec);
function stemPlaza(g, e, name){ const x = e + GATE_O;
  g.add(flat(36, 17, asphaltDS, x, -0.004, 0), solid(8, 0.6, 17, M(0xf2f2f2), x, 5.8, 0), solid(8.2, 0.6, 17.2, M(0x0c6a3c), x, 6.4, 0));
  for (const du of [-7.9, -3.8, 0, 3.8, 7.9]) g.add(solid(3.2, 2.6, 1.3, boothMat, x, 1.3, du), solid(0.3, 4.4, 0.3, concrete, x, 3.8, du));
  for (const sd of [1, -1]) { const p = panelMesh(7.6, 1.2, textPanel(7.6, 1.2, SIGN_GREEN, 'GT ' + name.toUpperCase(), '', ['road'])); p.position.set(x + sd*4.15, 6.1, 0); p.rotation.y = sd*Math.PI/2; g.add(p); }
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
  // more services: minimarket, coffee kiosk, toilets, ATM, workshop, EV chargers, each with its own sign
  const LBLI = {MINIMARKET: 'cart', 'FOOD COURT': 'food', MUSALA: 'mosque', KOPI: 'coffee', TOILET: 'wc', ATM: 'atm', BENGKEL: 'wrench', SPKLU: 'plug'};
  const lbl = (txt, bg, x, y, zz, w2 = 5) => { const q = panelMesh(w2 + 0.9, 0.9, textPanel(w2 + 0.9, 0.9, bg, txt, '', [LBLI[txt]])); q.position.set(x, y, zz); q.rotation.y = -Math.PI/2; g.add(q); };
  g.add(solid(12, 3.8, 13, M(0xf4f4f2), ex(66), 1.9, z(194)), solid(12.4, 0.5, 13.4, M(0x1f5fbf), ex(66), 4.0, z(194)), solid(0.1, 2.2, 10, glassMat, ex(59.95), 1.4, z(194)));
  lbl('MINIMARKET', '#1f5fbf', ex(59.8), 3.2, z(194)); lbl('FOOD COURT', '#9a3b2a', ex(59.8), 3.6, z(168), 6); lbl('MUSALA', '#2f7a55', ex(62.4), 3.4, z(140), 4);
  g.add(solid(5, 3, 4, M(0x6b4a2e), ex(58), 1.5, z(150)), solid(5.6, 0.3, 4.6, M(0x3a2a1c), ex(58), 3.1, z(150))); lbl('KOPI', '#3a2a1c', ex(55.4), 2.4, z(150), 3);
  g.add(solid(6, 3, 9, M(0xd9d4c8), ex(66), 1.5, z(124))); lbl('TOILET', SIGN_BLUE, ex(62.9), 2.6, z(124), 3.4);
  g.add(solid(1.6, 2.4, 1.6, M(0xc8d2dc), ex(58), 1.2, z(132))); lbl('ATM', '#0d5a8a', ex(57.1), 2.2, z(132), 1.6);
  g.add(flat(16, 22, lotMat, ex(66), -0.002, z(252)), solid(10, 4.5, 16, M(0xb9bec4), ex(68), 2.25, z(252)), solid(0.1, 3.6, 12, M(0x2a2c2e), ex(62.95), 1.8, z(252)));
  lbl('BENGKEL', '#c8341f', ex(62.8), 4.0, z(252), 4.4);
  for (const dz of [-3, 0, 3]) g.add(solid(0.6, 1.6, 0.4, M(0x1e8a4a), ex(52), 0.8, z(236 + dz)), solid(0.62, 0.3, 0.42, M(0xf2f2f2), ex(52), 1.75, z(236 + dz)));
  lbl('SPKLU', '#1e8a4a', ex(51.6), 2.6, z(236), 2.6);
  const p = panelMesh(6.4, 3.6, textPanel(6.4, 3.6, SIGN_BLUE, 'REST AREA', 'SPBU · Musala · Kuliner · Minimarket · Bengkel · ATM · SPKLU · Toilet', REST_ICONS)); p.position.set(ex(18), 6.5, z(128)); p.rotation.y = Math.PI;
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
// toll roads the junction ramps lead to (every toll road at the node except the one the carriageway continues as), seen from side sd
const thruOf = (s, sd) => sd > 0 ? s.cNext : s.c;
function jctTargets(s, sd = 1){
  const N = NODES.get(s.key), thru = thruOf(s, sd), from = sd > 0 ? s.c : s.cNext, ends = id => [CORR[id].nodes[0], CORR[id].nodes[CORR[id].nodes.length - 1]].some(n => n.key === s.key);
  const ids = [...N.corr].filter(id => CORR[id].cls === 't' && id !== thru && (id !== from || !ends(id)));
  if (!ids.length) return {name: nodeLabel(s), sub: ''};
  const c = CORR[ids[0]], a = c.nodes[0], b = c.nodes[c.nodes.length-1];
  return {name: corrLabel(ids[0]) + (ids[1] ? ' · ' + CORR[ids[1]].short : ''), sub: ids[1] ? nodeLabel(s).replace('Simpang Susun ', 'JCT ') : `${(NODES.get(a.key).city || a.name)} / ${(NODES.get(b.key).city || b.name)}`}; }

// overhead gantry + boards for one side of a site (local frame)
function siteSigns(g, s, sd, e){
  const roadW = e + 3, rot = Math.PI, i = s.i;
  const kind = s.kind, half = (e - MED)/2, pw = Math.max(5, half - 0.6), ph = 3.2;
  // advance board 500 m
  const adv = kind === 'r' ? textPanel(5, 2.6, SIGN_BLUE, 'REST AREA', `${nodeLabel(s).replace('Rest Area ', '')} · 500 m`, ['fuel', 'food', 'wc'])
    : kind === 'j' ? exitPanel(5.6, 3.2, jctTargets(s, sd).name, 'JCT', '1 km', SIGN_GREEN, jctTargets(s, sd).sub)
    : kind === 'x' ? exitPanel(5.6, 3.2, s.name, 'EXIT', '500 m')
    : textPanel(5.6, 2.6, SIGN_GREEN, nodeLabel(s).toUpperCase(), '500 m · Siapkan kartu e-Toll', ['road', 'toll']);
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
  const t = jctTargets(s, sd);
  const exTex = kind === 'r' ? textPanel(pw, ph, SIGN_BLUE, 'REST AREA', 'SPBU · Musala · Kuliner', ['fuel', 'food', 'mosque'])
    : kind === 'j' ? exitPanel(pw, ph, t.name, 'JCT', '', SIGN_GREEN, t.sub) : exitPanel(pw, ph, s.name, 'EXIT', '');
  const cs = citiesAhead(i, sd), dl = cs.map(c => c.e.city); if (!dl.length) dl.push('Akhir rute');
  // through lanes at a junction: name the toll road the carriageway continues as
  if (kind === 'j' && CORR[thruOf(s, sd)].cls === 't') { dl.unshift(corrLabel(thruOf(s, sd))); dl.length = Math.min(dl.length, 3); }
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
  const wel = panelMesh(5, 2.2, textPanel(5, 2.2, SIGN_GREEN, 'SELAMAT DATANG', `di ${s.name}`, ['city'])); wel.position.set(roadW + 3.5, 3.6, -TOWN_R + 10); wel.rotation.y = rot; g.add(wel);
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
    else if (s.kind === 'j') { for (const kd of ['outC','outA','inC','inB']) ramp3(g, ssPath(kd, e), e); ramp3(g, jLink(), e); }
    else { const keep = q => q[0] < PRC - 12;
      // two lanes all the way: a second lane on the right of the ramps (clear of the loop), and one more each way on the stem to the gate
      const twoOut = q => q[0] > 7 && (q[1] > 200 || q[0] < 85), twoIn = q => q[0] > 7 && q[1] > 200, stem = q => q[0] >= 100 && Math.abs(q[1] - 180) < 4;
      ramp3(g, [[1.8,12], ...trOut()], e, keep, SC, twoOut, stem); ramp3(g, trIn(), e, keep, SC, twoIn, stem); stemPlaza(g, e, s.name); if (sd === 1 && xLinkHere(s)) ramp3(g, xLink(), e, q => q[1] < 176 || q[1] > 186, SC, twoOut, stem); }
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
  for (const sd of [1, -1]) { const p = panelMesh((e - MED)*0.85, 2.4, textPanel((e - MED)*0.85, 2.4, SIGN_GREEN, nodeLabel(s), t.name !== nodeLabel(s) ? t.name : '', ['road']));
    p.position.set(-sd*(MED + (e - MED)/2), H - 0.2, sd*(dw/2 + 0.25)); p.rotation.y = sd > 0 ? 0 : Math.PI; g.add(p); }
  // through traffic on the crossing toll road
  g.userData.fly = [];
  for (let i=0; i<6; i++) { if (i % 3 === 2) continue; const dx = i<3 ? 1 : -1, zz = (dx>0 ? -1 : 1)*(2.4 + 3.6*(i%3)), vel = rnd(20, 27); let p = rnd(0, 40);
    while (p < W2) { const t2 = Math.random(), v = makeVehicle(t2<.12?'truck':t2<.2?'bus':t2<.32?'van':t2<.56?'suv':'car');
      Object.assign(v, {dx, p, vel, zz, W2}); v.g.rotation.y = dx*Math.PI/2; g.add(v.g); g.userData.fly.push(v); p += v.len + rnd(30, 120)/cfg.den; } }
  return g; }
function mainPlaza(s, e){ const g = worldGroup(s.u), wTot = 2*(e + 3);
  g.add(solid(wTot, 0.7, 14, M(0xf2f2f2), 0, 6.2, 0), solid(wTot + 0.2, 0.6, 14.2, M(0x0c6a3c), 0, 6.85, 0));
  for (const sd of [1, -1]) { const p = panelMesh(Math.min(wTot*0.6, 22), 1.5, textPanel(Math.min(wTot*0.6, 22), 1.5, SIGN_GREEN, nodeLabel(s).toUpperCase(), '', ['road']));
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
  x.font = `800 130px ${SIGN_FONT}`; x.fillText(dist, 60, h*0.76); }); }
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
// budget: while driving, build at most a couple of chunks and one interchange per frame, nearest first, so the
// frame rate stays smooth; everything far ahead is built a little later, long before it comes into view
function updateWorld(budget = false){
  const lo = Math.floor((camU - BACK - 140)/CH), hi = Math.floor((camU + FWD + 340 + VIEWX)/CH), c0 = Math.floor(camU/CH);
  for (const [i, g] of chunks) if (i < lo || i > hi) { dropSolids([g]); dispose(g); chunks.delete(i); }
  let nC = budget ? (MOBILE || QUAL.level >= 2 ? 1 : 2) : Infinity;
  for (let d = 0; d <= Math.max(c0 - lo, hi - c0) && nC > 0; d++) for (const i of d ? [c0 + d, c0 - d] : [c0]) {
    if (i < lo || i > hi || chunks.has(i) || nC <= 0) continue; chunks.set(i, buildChunk(i)); applySign([chunks.get(i)]); nC--; }
  const a = camU - BACK - 200, b = camU + FWD + 500 + VIEWX;
  for (const [o, gs] of built) if (o.u + o.r < a || o.u - o.r > b) { freeObj(gs); built.delete(o); if (o.type === 'site') o.s.bays = {'1': null, '-1': null}; }
  let nO = budget ? 1 : Infinity;
  for (const o of OBJ) { if (o.u - o.r > b || nO <= 0) break; if (o.u + o.r < a || built.has(o)) continue; built.set(o, buildObj(o)); nO--; }
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
  if (p != null && corrAt(sd*p) === 'mbz') { const t = Math.random(); return t < 0.01 ? 'police' : t < 0.55 ? 'car' : t < 0.85 ? 'suv' : 'pickup'; }
  if (Math.random() < 0.06) return 'pickup';
  if (p != null && Math.random() < (regionAt(sd*p) === 'urban' ? 0.12 : 0.03)) return 'taxi';
  { const e = Math.random(); if (e < 0.012) return e < 0.005 ? 'ambulance' : e < 0.009 ? 'police' : 'damkar'; }
  if (p != null && !isToll(sd*p)) { const t = Math.random(), outer = lane === n - 1;
    if (Math.random() < (outer ? 0.2 : 0.08)) return 'angkot';
    return outer ? (t < .38 ? 'moto' : t < .5 ? 'van' : t < .62 ? 'truck' : t < .67 ? 'bus' : t < .85 ? 'car' : 'suv') : (t < .5 ? 'car' : t < .75 ? 'suv' : t < .9 ? 'van' : 'moto'); }
  const t = Math.random(), outer = lane >= n - 2 && lane >= heavyMin(n);
  let type = lane === 0 ? (t<.2?'suv':'car') : outer ? (t<.3?'truck':t<.4?'bus':t<.55?'van':t<.78?'suv':'car') : (t<.1?'van':t<.4?'suv':'car');
  if (heavy({type}) && lane < heavyMin(n)) type = 'car'; return type; }
function addVehicle(sd, lane, p, type, vel){
  const v = makeVehicle(type);
  if (lane === 0 && !EMERG.has(type)) v.v0 = Math.min(v.v0 + 2, 27.7);
  // emergency vehicles: an ambulance is on a call about half the time, a fire engine mostly, police sometimes
  if (EMERG.has(type)) v.em = Math.random() < (type === 'damkar' ? 0.75 : type === 'ambulance' ? 0.5 : 0.35);
  if (type === 'angkot') v.ngT = rnd(15, 45);
  Object.assign(v, {sd, lane, lx: lane, p, vel: vel ?? v.v0*0.85, cd: rnd(0, 4), yaw: 0, cfWant: !heavy(v) && Math.random() < 0.65});
  v.x = posX(-sd, lane); scene.add(v.g); vehicles.push(v); return v;
}
function windowP(sd){ const lo = camU - BACK, hi = camU + FWD; return sd > 0 ? [lo, hi] : [-hi, -lo]; }
function oneWayB(sd, p){ return CFA.some(z => z.oneWay && z.B === sd && p > z.bStart - 1500 && p < z.bEnd + 240); }
// a toll road ending into a narrower non-toll road ahead: through traffic stays on the toll road in reality, so it leaves the scene
function funnelAhead(sd, p){ for (const s of PLAZAS) { if (!((s.kind === 'te' && sd > 0) || (s.kind === 'ti' && sd < 0))) continue; const d = sd*s.u - p; if (d > -60 && d < 900) return true; } return false; }
function spawnOK(sd, lane, p, len){ return !mbzHid(sd*p) && !funnelAhead(sd, p) && spanFree(sd, lane, p - len/2 - 3, p + len/2 + 3) && blockAhead(sd, lane, p) > 80 && !oneWayB(sd, p); }
function fillTraffic(){
  vehicles.filter(v => !v.player).forEach(killVehicle); vehicles = vehicles.filter(v => v.player);
  for (const sd of [1, -1]) { const [lo, hi] = windowP(sd);
    for (let lane = 0; lane < 5; lane++) { let p = lo + rnd(0, 20);
      while (p < hi - 10) { const n = nAvail(sd, p);
        if (lane >= n) { p += 30; continue; }
        const type = pickType(lane, n, p, sd), len = LEN(type);
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
        const type = pickType(lane, n, p, sd), len = LEN(type);
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
    if (v.player) { v.rampEdge = rampEdge(site); side = v.rampEdge && v.rampEdge.turn === 'Kanan' ? 'outC' : 'outA'; v.jSwap = !!v.rampEdge && seamlessTurn(site, v.rampEdge.e); }
    raw = ssPath(side, e); end = 'kill';
    // the player's junction ramp: a short link that leaves and rejoins the carriageway, which from here on is the chosen road (no dead end, no reload)
    if (v.player && v.jSwap) { raw = jLink(); end = 'merge'; mergeAt = 346; } }
  else { raw = trOut(); end = 'pr';
    if (v.player) { v.xSwap = seamlessExit(site);
      if (v.xSwap) { raw = xLink(); end = 'merge'; mergeAt = 628; v.xSwap = false; v.xl = true;
        // draw the link road now if the site was built before this exit was chosen
        for (const [o, gs] of [...built]) if (o.type === 'site' && Math.abs(o.u - site.u) < 1) { freeObj(gs); built.delete(o); }
        updateWorld(); } } }
  v.rp = {P: mkPath([...head, ...raw]), d: 0, i: 0, pc: v.sd*site.u, sd: v.sd, e, shift: SC, end, park, kind, site, mergeAt, xl: !!v.xl}; v.rpOff = 0; v.xl = false;
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
// posted limits on ramps (m/s): rest area and exit ramps 40 km/h, junction ramps 60, the MBZ ramps 80
const rampLimit = rp => rp.kind === 'mbz' ? 80/3.6 : rp.kind === 'j' ? 60/3.6 : rp.kind === 'detour' ? 50/3.6 : rp.parked ? 10/3.6 : 40/3.6;
let rampSpdT = 0;
function capAt(v, q){ const k = v.rp.kind;
  if (k === 'mbz') return 22;
  if (k === 'r' && q.o > 26 && q.u > 112 && q.u < 242) return 5;
  if (k === 'x' && Math.abs(q.o - GATE_O) < 14 && Math.abs(q.u - SC) < 6) return 3.5;
  if (k === 'x' && q.o > PRC - 30) return 7;
  if (k === 'detour' && q.o > PRC - 30) return 13;
  return q.o < 3 ? 22 : 11.1; }
function tryMerge(v){
  const sd = v.rp.sd, p = v.rp.pc + v.q.u - v.rp.shift, n = nAvail(sd, p), front = p + v.len/2;
  const outerFree = spanFree(sd, n-1, p - v.len/2 - 2, front + 2), nl = outerFree ? n-1 : n-2;
  if (v.player && !cfg.auto) { v.p = p; rm(rampers, v); Object.assign(v, {sd, lane: n - 1, lx: n - 0.4, rp: null, siteId: null, yaw: 0, hd: 0, steer: 0}); v.x = posX(-sd, v.lx); vehicles.push(v); toast('Masuk jalur utama'); hudLane(); return; }
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
    // traffic coming in from town waits at the end of the stem while the player crosses it on the link road
    if (!v.player && v.rp.kind === 'x' && v.rp.end === 'merge' && PLR && PLR.rp && PLR.rp.xl && PLR.rp.site === v.rp.site && PLR.q && PLR.q.u < 205 && q.o > 316) acc = Math.min(acc, v.vel > 0.1 ? -4 : 0);
    if (v.player && v.rp.kind === 'x' && !v.rp.paid) { const dg = GATE_O - 1 - q.o; if (dg > -1 && q.u > 170) acc = Math.min(acc, idm(v, STOP, Math.max(0, dg) + 2, cap)); }
    if (v.player && !cfg.auto) { acc = playerAcc(v, dt); const st = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      v.rpOff = clamp((v.rpOff || 0) + st*Math.min(Math.abs(v.vel), 12)*0.14*dt, -1.6, 1.6); }
    v.acc = acc; }
  for (const v of [...rampers]) { const rp = v.rp;
    if (rp.parked) { rp.park.t -= dt; if (rp.park.t <= 0) { const occ = rp.site.bays[rp.sd]; if (occ) occ[rp.park.i] = null; rp.P = mkPath(restPath('leave', BAYS[rp.park.i])); rp.d = 0; rp.i = 0; rp.parked = false; rp.park = null; if (v.player) { setRest(false); toast('Keluar dari rest area'); } } continue; }
    v.vel = v.player && !cfg.auto ? Math.min((VEH[v.type] || VEH.car).vmax, Math.max(-5, v.vel + v.acc*dt)) : Math.max(0, v.vel + v.acc*dt); rp.d = Math.max(0, rp.d + v.vel*dt);
    for (const w of v.wh) w.rotation.x += v.vel*dt / v.r;
    const q = v.q = pathAt(rp.P, rp.d, rp.i); rp.i = q.i;
    v.p = rp.pc + q.u - rp.shift;
    if (v.player && !cfg.auto) { v.x = -rp.sd*(rp.e + q.o + (v.rpOff || 0)*q.hu); playerCollide(v);
      const lim = rampLimit(rp); rampSpdT = Math.abs(v.vel) > lim + 2.8 ? rampSpdT + dt : 0; if (rampSpdT > 2.5) { rampSpdT = 0; violation(`melebihi batas ${KMH(lim)} km/j di ramp`); } }
    if (v.player && rp.kind === 'x' && !rp.paid && q.o > GATE_O - 5 && q.u > 170 && Math.abs(v.vel) < 0.5) { rp.paid = true; payToll(rp.site); }
    if (v.player && rp.kind === 'x' && !rp.paid && q.o > GATE_O + 3 && q.u > 170) { rp.paid = true; violation('menerobos gerbang tol'); }
    if (rp.park && rp.d >= rp.P.len - 0.3) { rp.parked = true; v.vel = 0; if (v.player) setRest(true); }
    else if (rp.end === 'merge' && q.u >= rp.mergeAt) tryMerge(v);
    else if (rp.d >= rp.P.len) { rm(rampers, v);
      if (rp.kind === 'mbz') { mbzRampEnd(v, rp); continue; }
      if (v.player && v.jSwap && rp.kind === 'j') { const jk = rp.P.pts[rp.P.pts.length - 1][0] > 0 ? 'inC' : 'inB';
        v.rp = {P: cachedPath(jk + rp.e, () => ssPath(jk, rp.e)), d: 0, i: 0, pc: rp.pc, sd: rp.sd, e: rp.e, shift: SC, end: 'merge', kind: 'j', site: rp.site, mergeAt: jk === 'inC' ? 340 : 300};
        v.q = pathAt(v.rp.P, 0, 0); v.p = v.rp.pc + v.q.u - v.rp.shift; v.jSwap = false; rampers.push(v); blink();
        toast(`${CORR[EV[rp.site.i].cNext].name} · arah ${v.rampEdge ? v.rampEdge.toward : ''}`); continue; }
      if (v.player && v.xSwap && rp.kind === 'x') { v.xSwap = false; if (rp.site.i === trip.destIdx) { stats.done = true; arrive(rp.site, null); }
        // the stem road joins the road to town: carry on there at the same speed
        const sd = rp.sd, p = rp.pc + 380, n = nAvail(sd, p); Object.assign(v, {sd, p, lane: n - 1, lx: n - 1, rp: null, siteId: null, yaw: 0, hd: 0, steer: 0}); v.x = posX(-sd, v.lx);
        for (const o of [...vehicles]) if (o.sd === sd && Math.abs(o.p - p) < 45) { rm(vehicles, o); killVehicle(o); }
        vehicles.push(v); camU = uOfV(v); blink(); hudLane(); toast(`${CORR[EV[rp.site.i].cNext].name}`); continue; }
      // exit with no road to town: turn round at the toll gate and rejoin the toll road (never a dead end)
      if (v.player && rp.kind === 'x' && rp.site.i !== trip.destIdx) {
        v.rp = {P: cachedPath('trIn', trIn), d: 0, i: 0, pc: rp.pc, sd: rp.sd, e: rp.e, shift: SC, end: 'merge', kind: 'xin', site: rp.site, mergeAt: 300};
        v.q = pathAt(v.rp.P, 0, 0); v.p = v.rp.pc + v.q.u - v.rp.shift; rampers.push(v); blink(); toast('Tidak ada jalan ke kota di sini: kembali ke jalan tol'); continue; }
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

// ---------- emergency vehicles ----------
// A vehicle with its siren on gets a free path: traffic ahead of it moves aside (lane 0 toward the median, the others outward)
// and slows, opening a corridor between lanes. In a jam on a toll road it takes the shoulder; on a national road it
// runs against the flow on the centre line while oncoming traffic pulls over and stops.
const sirenOn = v => !!(v.em || (v.player && cfg.siren && EMERG.has(v.type)));
const EM_NAME = {ambulance: 'Ambulans', damkar: 'Damkar', police: 'Polisi'};
let EMS = [];
function pathLead(e, x = e.x){
  let best = null, bd = Infinity; const hw = HW[e.type] || 1;
  for (const o of vehicles) { if (o === e || o.sd !== e.sd) continue; const d = o.p - e.p - (o.len + e.len)/2;
    if (d < -1 || d > 160 || d >= bd) continue; if (Math.abs(o.x - x) < hw + (HW[o.type] || 1) + 0.3) { bd = d; best = o; } }
  return {lead: best, ld: bd};
}
function emergencyPlan(dt){
  EMS = vehicles.filter(sirenOn);
  for (const v of vehicles) v.yxT = v.ngStop ? 0.3 : 0;
  for (const e of EMS) {
    const u = uOfV(e), toll = isToll(u), n = nAvail(e.sd, e.p);
    if (!e.player) { e.escT = (e.escT || 0) - dt;
      if (e.escT <= 0) { e.escT = 0.5; const {lead, ld} = pathLead(e, posX(-e.sd, e.lane)), slow = lead && ld < 90 && lead.vel < e.vel + 1, jam = lead && lead.vel < 6;
        if (slow) { e.clearT = 0;
          if (toll && (jam || n < 2)) { e.esc = 'sh'; e.escX = n - 0.2; }
          else if (!toll && (jam || n < 2)) { e.esc = 'cf'; e.escX = -0.7; }
          else if (e.esc !== 'sh' && e.esc !== 'cf') { e.esc = 'gap'; e.escX = clamp(Math.floor(e.lx), 0, n - 2) + 0.5; } }
        else if (e.esc && (e.clearT = (e.clearT || 0) + 0.5) > 4) e.esc = null; } }
    const ex = e.esc ? posX(-e.sd, e.escX) : e.x;
    for (const o of vehicles) { if (o === e || (o.player && !cfg.auto) || o.lx < 0 || EMS.includes(o)) continue;
      const d = e.sd*o.sd*o.p - e.p, side = -o.sd;
      if (o.sd === e.sd) { if (d < -6 || d > 170 || Math.abs(o.x - ex) > 3.4) continue;
        let t = side*Math.sign(o.x - ex || side)*0.4; if (o.lane === 0 && t < 0) t = -0.22; if (e.esc === 'sh' && t > 0) t = 0;
        if (Math.abs(t) > Math.abs(o.yxT)) o.yxT = t; o.yieldT = clock + 0.8; o.yieldV = 8; }
      else if (e.esc === 'cf' && d > -10 && d < 220) { o.yxT = 0.45; o.yieldT = clock + 0.8; o.yieldV = 1.5; } }
    // warn the player once when an emergency vehicle comes up behind
    if (!e.player && PLR && !e.warned) { const d = e.sd*PLR.sd*PLR.p - e.p; if ((PLR.sd === e.sd && d > 10 && d < 150) || (e.esc === 'cf' && PLR.sd !== e.sd && d > 20 && d < 220)) {
      e.warned = true; toast(`${EM_NAME[e.type]} darurat ${PLR.sd === e.sd ? 'dari belakang' : 'melawan arus di depan'}: menepi & beri jalan`, 'warn'); } }
  }
}
function sirenUI(){ const b = $('sirb'); if (!b) return; const ok = !!PLR && EMERG.has(PLR.type); b.hidden = !ok; b.setAttribute('aria-pressed', ok && cfg.siren ? 'true' : 'false'); }

// ================================================================
// ON FOOT: get out of the car (E or the "Keluar mobil" button) and walk around; traffic stops for you
// ================================================================
let foot = null;
const skinMat = M(0xc68e62), hairMat = M(0x1d1712), pantsMat = M(0x2b3442), shoeMat = M(0x161616);
function makePerson(){
  const g = new THREE.Group(), shirt = M(pick([0xe23b2e, 0x2a6fd1, 0xf2f2ee, 0x2f9a4a, 0xf0b429]));
  const part = (w, h, d, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(bgeo(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const legs = [-1, 1].map(s2 => { const p = new THREE.Group(); p.position.set(s2*0.1, 0.9, 0); part(0.15, 0.82, 0.17, pantsMat, 0, -0.41, 0, p); part(0.16, 0.08, 0.27, shoeMat, 0, -0.86, 0.05, p); g.add(p); return p; });
  part(0.42, 0.62, 0.24, shirt, 0, 1.22, 0);
  const arms = [-1, 1].map(s2 => { const p = new THREE.Group(); p.position.set(s2*0.27, 1.5, 0); part(0.11, 0.6, 0.12, shirt, 0, -0.27, 0, p); part(0.1, 0.12, 0.1, skinMat, 0, -0.62, 0, p); g.add(p); return p; });
  part(0.22, 0.25, 0.23, skinMat, 0, 1.68, 0); part(0.24, 0.09, 0.25, hairMat, 0, 1.83, -0.01);
  bendObj(g); return {g, legs, arms};
}
function footToggle(){
  if (!PLR || !trip) return;
  if (!foot) {
    if (PLR.rp || Math.abs(PLR.vel) > 1) { toast('Berhenti dulu sebelum keluar dari mobil', 'warn'); return; }
    cfg.auto = false; hudAuto && hudAuto(); input.gas = input.brake = input.left = input.right = false; PLR.vel = 0;
    const u = uOfV(PLR), m = makePerson(), sd = PLR.sd;
    foot = {u: u - sd*0.3, x: PLR.x + sd*1.4, hd: 0, ph: 0, vel: 0, down: 0, ...m};
    scene.add(m.g); camMode0 = camMode; if (camMode === 'cockpit') camMode = 'chase';
    document.body.classList.add('onfoot'); $('walkb').querySelector('.bl').textContent = 'Masuk mobil';
    toast('Jalan kaki: ↑/↓ jalan, ←/→ belok, Shift lari, E masuk mobil. Hati-hati lalu lintas!');
  } else {
    const du = foot.u - uOfV(PLR), dx = foot.x - PLR.x;
    if (Math.hypot(du, dx) > 5) { toast('Dekati mobilmu dulu (≤ 5 m) untuk masuk', 'warn'); return; }
    scene.remove(foot.g); foot = null; camMode = camMode0 || camMode; document.body.classList.remove('onfoot'); $('walkb').querySelector('.bl').textContent = 'Keluar mobil'; toast('Kembali di dalam mobil');
  }
}
let camMode0 = null;
function stepFoot(dt){
  const f = foot; if (!f) return; cfg.auto = false;
  if (f.down > 0) { f.down -= dt; f.g.rotation.x = -Math.PI/2*Math.min(1, (2.6 - f.down)*4); if (f.down <= 0) { f.g.rotation.x = 0; toast('Bangun lagi… hati-hati!'); } return; }
  const run = input.run, want = (input.gas ? 1 : 0) - (input.brake ? 0.6 : 0);
  f.hd = wrapA(f.hd + ((input.right ? 1 : 0) - (input.left ? 1 : 0))*2.4*dt);
  f.vel += clamp(want*(run ? 5.5 : 1.5) - f.vel, -6*dt, 4*dt);
  f.u += Math.cos(f.hd)*f.vel*dt*(PLR.sd || 1); f.x += Math.sin(f.hd)*f.vel*dt*(PLR.sd || 1);
  // stay within the built world (about 400 m from the car) and on the land
  const u0 = uOfV(PLR); f.u = clamp(f.u, u0 - 380, u0 + 380); f.x = clamp(f.x, -(eAt(f.u) + 60), eAt(f.u) + 60);
  f.ph += f.vel*dt*3.2; const sw = Math.sin(f.ph)*Math.min(0.7, Math.abs(f.vel)*0.35);
  f.legs[0].rotation.x = sw; f.legs[1].rotation.x = -sw; f.arms[0].rotation.x = -sw*0.8; f.arms[1].rotation.x = sw*0.8;
  // hit by a vehicle?
  for (const v of vehicles) { if (v.player) continue; const du = v.sd*v.p - f.u, dx = v.x - f.x;
    if (Math.abs(du) < v.len/2 + 0.3 && Math.abs(dx) < (HW[v.type] || 1) + 0.25 && v.vel > 1.5) { f.down = 2.6; f.vel = 0; stats.crashes++; crash('Tertabrak kendaraan!'); crashSound(v.vel*0.6); shake = 0.8; v.vel *= 0.4; v.crashT = clock + 6; break; } }
}
// AI drivers brake for a pedestrian in their lane
function footBlocks(v, front){
  const f = foot; if (!f) return Infinity; const side = -v.sd, lxF = (f.x*side - (MED + LW/2))/LW;
  if (Math.abs(lxF - v.lx) > 0.75) return Infinity; const d = v.sd*f.u - front; return d > -1 && d < 70 ? d : Infinity;
}
function placeFoot(){ if (!foot) return; const f = foot, sd = PLR.sd || 1; f.g.position.set(f.x, 0, camU - f.u); f.g.rotation.y = (sd > 0 ? Math.PI : 0) - f.hd; }

// ================================================================
// TRIP NEEDS: fuel, cash and e-Toll balance, drowsiness; services at rest areas and in towns
// ================================================================
const TANK = {moto: 4, car: 42, taxi: 42, police: 50, suv: 55, pickup: 45, van: 55, ambulance: 60, angkot: 40, bus: 200, truck: 300, damkar: 150, derek: 120};
const KM_L = {moto: 40, car: 13, taxi: 13, police: 11, suv: 9, pickup: 10, van: 9, ambulance: 8, angkot: 11, bus: 4, truck: 3.5, damkar: 3, derek: 5};
const WAL = Object.assign({cash: 750000, etoll: 300000, fuel: null, sleep: 0}, cfg.wal || {});
const rp$ = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const rpS = n => { const a = Math.abs(n), sg = n < 0 ? '−' : ''; return sg + (a >= 1e6 ? (a/1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + 'jt' : Math.round(a/1000) + 'rb'); };
let walT = 0, lowFuelSaid = false, sleepSaid = 0, msT = 0;
function tankOf(){ return TANK[PLR ? PLR.type : cfg.veh] || 42; }
function tickNeeds(dt){
  if (!PLR || !trip) return; if (WAL.fuel == null || WAL.fuel > tankOf()) WAL.fuel = tankOf();
  if (!foot && !tow) { const km = Math.abs(PLR.vel)*dt*cfg.scale/1000; WAL.fuel = Math.max(0, WAL.fuel - km/(KM_L[PLR.type] || 12)*(input.gas || cfg.auto ? 1 : 0.6));
    if (Math.abs(PLR.vel) > 1) { WAL.sleep = Math.min(100, WAL.sleep + dt*(100/9000)*(gameH < 5 || gameH > 22 ? 1.6 : 1)); driveEarn(dt, km); } }
  const f = WAL.fuel/tankOf();
  if (f < 0.15 && !lowFuelSaid) { lowFuelSaid = true; toast('BBM menipis: isi di SPBU rest area atau kota berikutnya', 'warn'); } if (f > 0.3) lowFuelSaid = false;
  if (WAL.fuel <= 0 && !PLR.noFuel) { PLR.noFuel = true; toast('BBM habis! Panggil derek untuk mengantar BBM', 'bad'); }
  if (WAL.fuel > 0) PLR.noFuel = false;
  for (const lv of [70, 90]) if (WAL.sleep >= lv && sleepSaid < lv) { sleepSaid = lv; toast(lv >= 90 ? 'Sangat mengantuk! Segera istirahat di rest area' : 'Mulai mengantuk: istirahat sejenak di rest area', 'warn'); }
  if (WAL.sleep < 60) sleepSaid = 0;
  // microsleep at 100 %: the hands drift off the wheel for a moment
  if (WAL.sleep >= 100 && !cfg.auto && !foot && (msT -= dt) < 0) { msT = rnd(15, 30); PLR.steer = (PLR.steer || 0) + (Math.random() - 0.5)*0.12; toast('Microsleep! Anda tertidur sesaat', 'bad'); shake = 0.3; }
  if ((walT -= dt) < 0) { walT = 0.5; cfg.wal = {...WAL}; saveCfgSoon(); uiNeeds(); }
}
// money for driving (only while the car is moving): Rp 30.000 every 1–2 minutes, Rp 50.000 every 5 minutes, Rp 100.000 every 2 km
function driveEarn(dt, km){
  const E = WAL.earn || (WAL.earn = {a: 0, aT: rnd(60, 120), b: 0, km: 0});
  E.a += dt; E.b += dt; E.km += km;
  if (E.a >= E.aT) { E.a = 0; E.aT = rnd(60, 120); earn(30000, 'berkendara 1–2 menit'); }
  if (E.b >= 300) { E.b -= 300; earn(50000, 'berkendara 5 menit'); }
  if (E.km >= 2) { E.km -= 2; earn(100000, 'menempuh 2 km'); }
}
function earn(n, why){ WAL.cash += n; stats.earned = (stats.earned || 0) + n; toast(`+${rp$(n)} · ${why}`); uiNeeds(); sfxCoin(); }
function uiNeeds(){
  if (WAL.fuel == null || WAL.fuel > tankOf()) WAL.fuel = tankOf();
  const f = Math.round(WAL.fuel/tankOf()*100), fb = $('fuelb'), sb = $('sleepb');
  fb.style.width = clamp(f, 0, 100) + '%'; fb.classList.toggle('low', f < 15); sb.style.width = Math.round(WAL.sleep) + '%'; sb.classList.toggle('low', WAL.sleep > 70);
  $('cash').textContent = rpS(WAL.cash); $('etoll').textContent = rpS(WAL.etoll); $('cash').title = rp$(WAL.cash); $('etoll').title = rp$(WAL.etoll);
  $('fuelb').parentElement.title = `BBM ${f}% (${WAL.fuel.toFixed(1)} L)`; $('sleepb').parentElement.title = `Kantuk ${Math.round(WAL.sleep)}%`;
  const ctx = svcContext(); $('svcb').hidden = !ctx; if (!ctx && !$('svc').hidden) $('svc').hidden = true;
  $('towb').hidden = !PLR || tow || !((PLR.dmg || 0) >= 40 || PLR.noFuel || PLR.deadT);
}
// where services are available: parked or walking in a rest area, or stopped / walking in a town on a national road
function svcContext(){
  if (!PLR || !trip) return null;
  if (rest) return 'rest';
  const u = foot ? foot.u : uOfV(PLR);
  if (foot) { const s = RSITES.find(s2 => s2.kind === 'r' && Math.abs(s2.u - u) < 140); if (s && Math.abs(foot.x) > eAt(u) + 18) return 'rest'; }
  if (!isToll(u) && townNear(u) && (foot || (!PLR.rp && Math.abs(PLR.vel) < 0.5))) return 'town';
  return null;
}
const SVC = [
  {id: 'bbm', t: 'SPBU · isi BBM penuh', d: () => `${Math.max(0, tankOf() - WAL.fuel).toFixed(1)} L × Rp 10.000`, price: () => Math.ceil(Math.max(0, tankOf() - WAL.fuel))*10000, ok: () => WAL.fuel < tankOf() - 0.5,
    act: () => { WAL.fuel = tankOf(); PLR.noFuel = false; return 'Tangki penuh. Terima kasih, sudah diisi dari nol!'; }},
  {id: 'angin', t: 'Isi angin ban', d: () => 'Tekanan ban dicek & ditambah', price: () => 5000, act: () => 'Tekanan ban sudah pas'},
  {id: 'makan', t: 'Makan di food court', d: () => 'Nasi goreng / soto / sate, kantuk −40', price: () => 45000, act: () => { WAL.sleep = Math.max(0, WAL.sleep - 40); return 'Kenyang! Siap lanjut'; }},
  {id: 'kopi', t: 'Ngopi', d: () => 'Kopi susu / teh manis, kantuk −30', price: () => 25000, act: () => { WAL.sleep = Math.max(0, WAL.sleep - 30); return 'Segar kembali'; }},
  {id: 'mini', t: 'Minimarket · camilan & minum', d: () => 'Air mineral, roti, permen, kantuk −10', price: () => 30000, act: () => { WAL.sleep = Math.max(0, WAL.sleep - 10); return 'Belanja selesai'; }},
  {id: 'topup', t: 'Isi saldo e-Toll Rp 100.000', d: () => 'Di kasir minimarket (+ biaya Rp 1.500)', price: () => 101500, act: () => { WAL.etoll += 100000; return 'Saldo e-Toll bertambah Rp 100.000'; }},
  {id: 'atm', t: 'ATM · tarik tunai Rp 300.000', d: () => 'Dari rekening bank', price: () => 0, act: () => { WAL.cash += 300000; return 'Uang tunai bertambah Rp 300.000'; }},
  {id: 'bengkel', t: 'Bengkel · perbaiki kendaraan', d: () => `Kerusakan ${Math.round(PLR.dmg || 0)}%`, price: () => 50000 + Math.round((PLR.dmg || 0)*9000/1000)*1000, ok: () => (PLR.dmg || 0) >= 1,
    act: () => { repairPlayer(); return 'Kendaraan sudah diperbaiki seperti baru'; }},
  {id: 'toilet', t: 'Toilet', d: () => 'Bersih & gratis air', price: () => 2000, act: () => 'Lega!'},
  {id: 'musala', t: 'Musala · sholat', d: () => 'Kantuk −10', price: () => 0, act: () => { WAL.sleep = Math.max(0, WAL.sleep - 10); return 'Sudah sholat, hati tenang'; }},
  {id: 'tidur', t: 'Tidur 30 menit', d: () => 'Kantuk hilang, jam maju 30 menit', price: () => 0, only: 'rest', act: () => { WAL.sleep = 0; gameH = mod(gameH + 0.5, 24); todT = 0; tickClock(0); return 'Bangun segar setelah tidur 30 menit'; }},
  {id: 'spklu', t: 'SPKLU · cas mobil listrik', d: () => 'Hanya untuk mobil listrik', price: () => 0, only: 'rest', ok: () => false, act: () => ''},
];
function repairPlayer(){ const v = PLR; v.dmg = 0; v.deadT = 0; v.dentZ = v.dentX = 0; v.g.scale.set(1, 1, 1); v.g.rotation.z = 0; v.pull = 0; }
function openSvc(){
  const ctx = svcContext(); if (!ctx) return; const list = $('svc-list'); list.innerHTML = '';
  $('svc-title').textContent = ctx === 'rest' ? 'Layanan rest area' : 'Layanan di kota';
  $('svc-stat').textContent = `Tunai ${rp$(WAL.cash)} · e-Toll ${rp$(WAL.etoll)} · BBM ${Math.round(WAL.fuel/tankOf()*100)}% · Kantuk ${Math.round(WAL.sleep)}% · Kerusakan ${Math.round(PLR.dmg || 0)}%`;
  for (const sv of SVC) { if (sv.only && sv.only !== ctx) continue; const b = document.createElement('button'), pr = sv.price();
    b.innerHTML = `<b>${sv.t}</b><span>${sv.d()}</span><span>${pr ? rp$(pr) : 'Gratis'}</span>`; b.disabled = sv.ok ? !sv.ok() : false;
    b.onclick = () => { const pr2 = sv.price(); if (pr2 > WAL.cash) { toast('Uang tunai tidak cukup: tarik tunai di ATM', 'warn'); return; } WAL.cash -= pr2; const msg = sv.act(); if (msg) toast(msg); uiNeeds(); openSvc(); };
    list.append(b); }
  $('svc').hidden = false;
}

// ================================================================
// TOW TRUCK (derek): called after a crash, an engine failure or an empty tank. It comes along the shoulder, stops in
// front of the car, loads it onto the bed and takes it to the nearest workshop (or just brings emergency fuel).
// ================================================================
let tow = null;
function callTow(auto = false){
  const P = PLR; if (!P || tow) return; if (foot) { toast('Masuk ke kendaraan dulu', 'warn'); return; }
  if (P.rp) { toast('Derek datang setelah kendaraan berada di jalur utama', 'warn'); return; }
  const v = makeVehicle('derek'), n = nAvail(P.sd, P.p);
  // it comes in traffic: in the left lane, at a gap behind the car (never dropped into another vehicle)
  let p0 = P.p - 380; for (let k = 0; k < 20 && !spanFree(P.sd, n - 1, p0 - v.len/2 - 12, p0 + v.len/2 + 12); k++) p0 -= 25;
  Object.assign(v, {sd: P.sd, p: p0, lx: n - 1, vel: 18, lane: n - 1, tow: true}); v.x = posX(-P.sd, v.lx); scene.add(v.g);
  tow = {v, phase: 'come', t: 0, fuelOnly: !!P.noFuel && (P.dmg || 0) < 40 && !P.deadT};
  cfg.auto = false; hudAuto(); input.gas = input.brake = input.left = input.right = false;
  toast(`${auto ? 'Mesin mati. ' : ''}Derek ${tow.fuelOnly ? 'membawa BBM darurat' : 'dalam perjalanan'}: tiba ± 30 detik`, 'warn'); uiNeeds();
}
// the tow truck drives by the rules: in a lane at the speed limit, keeping its distance and queueing behind traffic, stopping at the
// toll gate and at red lights; it uses the shoulder only right at the broken-down car (and when it drops it off again)
function towDrive(d, dt, vmax){
  const n = nAvail(d.sd, d.p), front = d.p + d.len/2;
  // the left-most lane that is open ahead (roadworks close the left lane now and then)
  let want = n - 1; while (want > 0 && blockAhead(d.sd, want, front) < 160) want--;
  if (want !== d.lane && spanFree(d.sd, want, d.p - d.len/2 - 8, front + 8)) d.lane = want;
  d.lx += clamp(d.lane - d.lx, -0.6*dt, 0.6*dt);
  const g = gapInfo(d, laneList(d.sd, d.lane)); let acc = idm(d, g.lead, g.ld, Math.min(vmax, limitAt(uOfV(d))*0.95));
  const pz = plazaAhead(d.sd, front);
  if (pz && d.paid !== pz.s.id) { acc = Math.min(acc, idm(d, STOP, pz.d + 2, vmax));
    if (pz.d < 2.5 && d.vel < 0.6 && (d.payT = (d.payT || 0) + dt) > 1.5) { d.paid = pz.s.id; d.payT = 0; } }
  const la = lightAhead(d.sd, front); if (la) { const st = sigMain(la.s); if (st === 'R' || (st === 'Y' && la.d > Math.max(6, d.vel*d.vel/6))) acc = Math.min(acc, idm(d, STOP, la.d + 2.2, vmax)); }
  const bd = blockAhead(d.sd, d.lane, front); if (bd < Infinity) acc = Math.min(acc, idm(d, STOP, bd - 1.5, vmax));
  d.vel = Math.max(0, d.vel + acc*dt); d.p += d.vel*dt;
}
function stepTow(dt){
  if (!tow || !PLR) return; const T = tow, d = T.v, P = PLR, n = nAvail(P.sd, P.p), sh = n - 0.15; T.t += dt;
  if (T.phase === 'come') {
    // the car waits on the shoulder; the truck comes in the left lane behind the traffic, passes it, then pulls onto the shoulder ahead
    P.lx += clamp(sh - P.lx, -0.7*dt, 0.7*dt); P.lane = Math.round(P.lx); P.vel = Math.max(0, P.vel - 5*dt); P.hd = 0; P.steer = 0;
    const past = d.p - d.len/2 > P.p + P.len/2 + 3;
    if (!past) towDrive(d, dt, d.p < P.p - 120 ? 22 : 11);
    else { const target = P.p + (P.len + d.len)/2 + 14, gap = target - d.p; d.vel = Math.min(d.vel, 10, Math.sqrt(2*2.5*Math.max(0, gap))); d.p = Math.min(target, d.p + d.vel*dt);
      d.lx += clamp(sh - d.lx, -0.8*dt, 0.8*dt); d.lane = n - 1;
      if (gap < 0.4 && Math.abs(d.lx - sh) < 0.05) { T.phase = 'back'; T.t = 0; toast('Derek tiba · mundur ke depan kendaraan Anda'); } } }
  else if (T.phase === 'back') {
    // on the shoulder, reverse slowly up to the car
    const target = P.p + (P.len + d.len)/2 + 3; d.vel = -Math.min(2, Math.max(0.3, (d.p - target)*0.8)); d.p = Math.max(target, d.p + d.vel*dt); d.lx = sh;
    P.lx += clamp(sh - P.lx, -0.7*dt, 0.7*dt); P.vel = 0;
    if (d.p - target < 0.05 && Math.abs(P.lx - sh) < 0.05) { d.vel = 0; T.phase = T.fuelOnly ? 'fuel' : 'load'; T.t = 0; T.p0 = P.p; P.vel = 0;
      toast(T.fuelOnly ? 'Petugas derek mengisi BBM darurat 10 L…' : 'Kendaraan dinaikkan ke truk derek…'); } }
  else if (T.phase === 'fuel') { P.vel = 0; if (T.t > 4) { WAL.fuel = Math.max(WAL.fuel, 10); P.noFuel = false; WAL.cash -= 150000; toast(`BBM darurat 10 L diisi · biaya ${rp$(150000)}`); T.phase = 'leave'; T.t = 0; } }
  else if (T.phase === 'load') { const k = sstep(0, 1, Math.min(1, T.t/4)); P.vel = 0; P.lift = 1.2*k; P.p = T.p0 + (d.p - 1.2 - T.p0)*k;
    if (T.t > 4.2) { T.phase = 'tow'; T.t = 0; T.dur = 26; d.lane = n - 1; toast('Diderek ke bengkel terdekat…'); } }
  else if (T.phase === 'tow') {
    // back into the traffic when there is a gap, then on in its lane like everybody else
    if (d.lx > n - 1 + 0.05) { d.vel = Math.min(d.vel + 1.5*dt, 8); d.p += d.vel*dt; if (spanFree(d.sd, n - 1, d.p - d.len/2 - 15, d.p + d.len/2 + 10)) d.lx += clamp(n - 1 - d.lx, -0.5*dt, 0.5*dt); }
    else towDrive(d, dt, 20);
    P.p = d.p - 1.2; P.lx = d.lx; P.lane = Math.round(d.lx); P.vel = d.vel; P.lift = 1.2;
    if (T.t > T.dur && !plazaAhead(d.sd, d.p + d.len/2 + 60) && !lightAhead(d.sd, d.p + d.len/2)) { T.phase = 'drop'; T.t = 0; } }
  else if (T.phase === 'drop') {
    // pull over onto the shoulder and stop, then the repaired car is put down behind the truck
    d.vel = Math.max(0, d.vel - 3*dt); d.p += d.vel*dt; d.lx += clamp(sh - d.lx, -0.5*dt, 0.5*dt); P.p = d.p - 1.2; P.lx = d.lx; P.vel = d.vel;
    if (d.vel < 0.05 && Math.abs(d.lx - sh) < 0.05) { const cost = 250000 + Math.round((P.dmg || 0)*6000/1000)*1000; WAL.cash -= cost; repairPlayer(); P.lift = 0; P.vel = 0;
      P.lx = sh; P.lane = n - 1; P.p = d.p - d.len/2 - P.len/2 - 6;
      gameH = mod(gameH + 0.75, 24); todT = 0; tickClock(0); blink(); toast(`Kendaraan sudah diperbaiki di bengkel · biaya derek & bengkel ${rp$(cost)}`); T.phase = 'leave'; T.t = 0; } }
  else if (T.phase === 'leave') {
    // off the shoulder only into a gap, then away with the traffic
    if (d.lx > n - 1 + 0.05) { d.vel = Math.min(d.vel + 1.5*dt, 8); d.p += d.vel*dt; if (spanFree(d.sd, n - 1, d.p - d.len/2 - 15, d.p + d.len/2 + 10)) d.lx += clamp(n - 1 - d.lx, -0.4*dt, 0.4*dt); }
    else towDrive(d, dt, 22);
    if (T.t > 30 || Math.abs(d.p - P.p) > 450) { scene.remove(d.g); killVehicle(d); tow = null; uiNeeds(); } }
  if (tow) P.x = posX(-P.sd, P.lx);
}
function placeTow(){ if (!tow) return; const d = tow.v; d.x = posX(-d.sd, d.lx); d.g.position.set(d.x, 0, camU - d.sd*d.p); d.g.rotation.y = d.sd > 0 ? Math.PI : 0;
  const ph = (clock*2.6) % 1; if (d.lights) { d.lights[0].visible = ph < 0.5; d.lights[1].visible = ph >= 0.5; } for (const w of d.wh) w.rotation.x += d.vel*0.016/d.r; }

// ================================================================
// VEHICLE MODS: paint, rims, window tint, spoiler, lowered suspension, sport stripes, number plate
// ================================================================
const MOD_DEF = {paint: '#ec3013', paint2: '#f4f4f2', livery: 'polos', rim: '#c9ccd0', tint: 0, plate: '', plateCat: '', spoiler: false, low: false, stripe: false};
const MODS = () => Object.assign({}, MOD_DEF, cfg.mod || {});
const PAINTS = ['#ec3013', '#f4f4f2', '#1b1c1f', '#8d939a', '#1f3f73', '#2f5a4a', '#e0a020', '#6a1d2b', '#3a9fd8', '#f07a1a'], RIMS = ['#c9ccd0', '#1b1c1f', '#d4af37', '#b02020', '#3a6fd8'];
// body liveries: a 4 m tile painted in the two colours, mapped onto the body panels
const LIVERY = {polos: 'Polos', balap: 'Garis balap', api: 'Api', kamo: 'Kamuflase', batik: 'Batik kawung', karbon: 'Karbon', gradasi: 'Gradasi', kotak: 'Kotak balap', polkadot: 'Polkadot'};
const LIVTEX = new Map();
function liveryTex(kind, c1, c2){
  const k = kind + c1 + c2; if (LIVTEX.has(k)) return LIVTEX.get(k);
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), R = rng(kind.length*977 + 7);
  x.fillStyle = c1; x.fillRect(0, 0, S, S); x.fillStyle = c2; x.strokeStyle = c2;
  if (kind === 'balap') { x.fillRect(0, S*0.42, S, S*0.06); x.fillRect(0, S*0.52, S, S*0.06); x.save(); x.translate(S*0.5, S*0.25); x.rotate(-0.5); x.fillRect(-S, -12, S*2, 24); x.restore(); }
  else if (kind === 'api') { for (let i = 0; i < 6; i++) { const y0 = S*(0.55 + 0.07*Math.sin(i)); x.beginPath(); x.moveTo(0, y0 + 40); for (let k2 = 0; k2 <= 8; k2++) { const xx = S*k2/8, tip = k2 % 2 ? -60 - 50*R() : 10; x.quadraticCurveTo(xx - S/16, y0 + tip*0.4, xx, y0 + tip); } x.lineTo(S, S); x.lineTo(0, S); x.closePath(); x.globalAlpha = 0.55; x.fill(); } x.globalAlpha = 1; }
  else if (kind === 'kamo') { for (let i = 0; i < 26; i++) { x.beginPath(); const cx = R()*S, cy = R()*S; for (let a = 0; a < 7; a++) { const r = 30 + R()*45, t = a/7*Math.PI*2; a ? x.lineTo(cx + Math.cos(t)*r, cy + Math.sin(t)*r) : x.moveTo(cx + Math.cos(t)*r, cy + Math.sin(t)*r); } x.closePath(); x.globalAlpha = i % 2 ? 0.85 : 0.45; x.fill(); } x.globalAlpha = 1; }
  else if (kind === 'batik') { const n = 4, q = S/n; x.lineWidth = 6; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const cx = (i + 0.5)*q, cy = (j + 0.5)*q;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { x.beginPath(); x.ellipse(cx + dx*q*0.22, cy + dy*q*0.22, dx ? q*0.2 : q*0.11, dx ? q*0.11 : q*0.2, 0, 0, Math.PI*2); x.fill(); }
      x.fillStyle = c1; x.beginPath(); x.arc(cx, cy, q*0.06, 0, Math.PI*2); x.fill(); x.fillStyle = c2; } }
  else if (kind === 'karbon') { const q = 16; for (let i = 0; i < S/q; i++) for (let j = 0; j < S/q; j++) { x.globalAlpha = (i + j) % 2 ? 0.7 : 0.25; x.fillRect(i*q, j*q, q, q); } x.globalAlpha = 1; }
  else if (kind === 'gradasi') { const gr = x.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, c2); gr.addColorStop(0.5, c1); gr.addColorStop(1, c2); x.fillStyle = gr; x.fillRect(0, 0, S, S); }
  else if (kind === 'kotak') { const q = S/8; for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) x.fillRect(i*q, S*0.44 + j*q*0.5, q, q*0.5); }
  else if (kind === 'polkadot') { const q = S/6; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { x.beginPath(); x.arc((i + 0.5 + (j % 2)*0.5)*q, (j + 0.5)*q, q*0.22, 0, Math.PI*2); x.fill(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.25, 0.25); t.anisotropy = 4;
  if (LIVTEX.size > 24) { const [k0, t0] = LIVTEX.entries().next().value; t0.dispose(); LIVTEX.delete(k0); }
  LIVTEX.set(k, t); return t;
}
// applies the mods to a vehicle model (own copies of the shared materials, so nothing else changes)
function applyMods(v, m){
  if (!v || !m) return; const g = v.g; let rimM = null, glassM = null, plateM = null;
  g.traverse(o => { if (!o.isMesh) return;
    if (o.material === rimMat) { rimM = rimM || Object.assign(rimMat.clone(), {userData: {own: true}}); rimM.color.set(m.rim); o.material = rimM; }
    else if (o.material === glassMat && m.tint) { glassM = glassM || Object.assign(glassMat.clone(), {userData: {own: true}}); glassM.color.set(m.tint > 1 ? 0x05070a : 0x10161c); glassM.metalness = 0.8; o.material = glassM; }
    else if (o.material && o.material.userData && o.material.userData.plate) {
      if (!plateM) { const cat = m.plateCat || plateCatOf(v.type), d = new Date(), def = randPlate(cat, 'B');
        plateM = new THREE.MeshStandardMaterial({map: plateCanvas((m.plate || def[0]).toUpperCase(), cat === 'polri' ? 'POLRI' : cat === 'dinas' ? 'DINAS' : cat === 'diplomatik' ? '' : `${String(d.getMonth() + 1).padStart(2, '0')} · ${String((d.getFullYear() + 5) % 100).padStart(2, '0')}`, cat), roughness: 0.45});
        plateM.userData.own = true; } o.material = plateM; } });
  // livery on the body paint
  const bodyM = g.children.find(o => o.isMesh && o.material && o.material.userData && o.material.userData.own && o.material !== rimM && o.material !== glassM && o.material !== plateM)?.material;
  if (bodyM && bodyM.isMeshStandardMaterial) { const lv = m.livery && m.livery !== 'polos' && LIVERY[m.livery] ? m.livery : null;
    if (bodyM.userData.paint == null) bodyM.userData.paint = bodyM.color.getHex();
    bodyM.map = lv ? liveryTex(lv, '#' + new THREE.Color(bodyM.userData.paint).getHexString(), m.paint2 || '#f4f4f2') : null; bodyM.color.set(lv ? 0xffffff : bodyM.userData.paint); bodyM.needsUpdate = true; }
  const box3 = new THREE.Box3().setFromObject(g), top = box3.max.y, len = v.len, w = (HW[v.type] || 0.92)*2;
  if (m.spoiler && !heavy(v) && v.type !== 'moto') { const sp = new THREE.Group(); const pm = g.children.find(o => o.isMesh && o.material && o.material.userData.own && o.material !== rimM)?.material || trimMat;
    const zR = -len/2 + 0.25, yR = v.type === 'car' || v.type === 'taxi' || v.type === 'police' ? 1.02 : top - 0.05;
    const at = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; sp.add(o); };
    for (const s2 of [-0.5, 0.5]) at(bgeo(0.06, 0.18, 0.1), trimMat, s2*w*0.6, yR + 0.09, zR);
    at(bgeo(w*0.92, 0.04, 0.32), pm, 0, yR + 0.2, zR - 0.04); g.add(sp); }
  if (m.stripe && v.type !== 'moto') for (const s2 of [-0.18, 0.18]) { const o = new THREE.Mesh(bgeo(0.16, 0.012, len*0.92), angkotStripe); o.position.set(s2, top + 0.002, 0); g.add(o); }
  v.lowered = m.low ? 0.07 : 0;
  bendObj(g);
}
function buildModUI(){
  const m = MODS(), set = (k, val) => { cfg.mod = {...MODS(), [k]: val}; saveCfg(); buildModUI(); };
  const sw = (el, list, key) => { el.innerHTML = ''; for (const c of list) { const b = document.createElement('button'); b.style.background = c; b.title = c; b.setAttribute('aria-pressed', m[key] === c ? 'true' : 'false'); b.onclick = e => { e.preventDefault(); set(key, c); }; el.append(b); } };
  sw($('paintsel'), PAINTS, 'paint'); sw($('rimsel'), RIMS, 'rim');
  sw($('paint2sel'), PAINTS, 'paint2');
  const lv = $('m-livery'); if (!lv.options.length) for (const [k, l] of Object.entries(LIVERY)) lv.append(new Option(l, k)); lv.value = m.livery || 'polos'; lv.onchange = e => set('livery', e.target.value);
  $('m-paint').value = m.paint; $('m-paint').oninput = e => set('paint', e.target.value);
  $('m-tint').value = String(m.tint); $('m-tint').onchange = e => set('tint', +e.target.value);
  $('m-plate').value = m.plate; $('m-plate').onchange = e => set('plate', e.target.value.toUpperCase().replace(/[^A-Z0-9 \-]/g, '').replace(/\s+/g, ' ').slice(0, 12));
  const pc = $('m-platecat'); if (!pc.options.length) for (const [k, l] of [['', 'Otomatis (sesuai kendaraan)'], ...Object.entries(PLATE_NAME)]) pc.append(new Option(l, k));
  pc.value = m.plateCat || ''; pc.onchange = e => set('plateCat', e.target.value);
  for (const k of ['spoiler', 'low', 'stripe']) { $('m-' + k).checked = !!m[k]; $('m-' + k).onchange = e => set(k, e.target.checked); }
}

// ================================================================
// MULTIPLAYER on server.7mit (Supabase Realtime: WebSocket broadcast + presence; voice chat over WebRTC)
// Positions are exchanged as road + km + direction + lane, so every player sees the others on their own copy of the road.
// ================================================================
const MP_URL = 'https://lajzrempjyoqkubkumhb.supabase.co', MP_KEY = 'sb_publishable_yGZ90Bkv3yreqc9pA55bpw_YKKBhWRw', MP_SPAWN = 'Semanggi', MP_MAX = 12;
const mp = {on: false, ready: false, ch: null, sb: null, id: null, peers: new Map(), sendT: 0, voice: false, mic: null, chatT: 0, fake: null};
const mpName = () => (cfg.name || '').trim() || 'Pemain-' + (mp.id || '0000').slice(0, 4);
const mpEsc = t => String(t).slice(0, 200);
function mpStatus(t){ $('mp-stat').textContent = t; }
function mpLine(txt, cls){ const d = document.createElement('div'); d.textContent = txt; if (cls) d.className = cls; const L = $('mp-log'); L.append(d); while (L.children.length > 60) L.firstChild.remove(); L.scrollTop = L.scrollHeight; }
function mpMe(){ return {name: mpName(), type: PLR ? PLR.type : cfg.veh, mod: MODS()}; }
async function mpConnect(){
  if (mp.on) return; mp.on = true;
  if (!cfg.mpId || !/^[a-z0-9]{6,40}$/i.test(cfg.mpId)) { cfg.mpId = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 12); saveCfg(); }
  mp.id = cfg.mpId;
  $('mpbox').hidden = false; mpStatus('Menghubungkan ke server.7mit…'); mpLine(`Anda: ${mpName()} · mulai di GT Semanggi`, 'sys');
  let ch;
  if (window.__mpFake) ch = mp.fake = window.__mpFake(mp);                 // test transport
  else { try { const {createClient} = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
      mp.sb = createClient(MP_URL, MP_KEY, {realtime: {params: {eventsPerSecond: 20}}}); ch = mp.sb.channel('tj-world', {config: {broadcast: {self: false}, presence: {key: mp.id}}}); }
    catch (e) { mpStatus('Gagal terhubung (periksa internet)'); mp.on = false; return; } }
  mp.ch = ch;
  const pres = await mpPresence('join'); if (pres && pres.banned) { mp.on = false; mpKicked(true, pres.reason); return; }
  ch.on('broadcast', {event: 'kickhint'}, ({payload}) => { if (payload && payload.id === mp.id) mpCheckKick(); });
  ch.on('broadcast', {event: 'st'}, ({payload}) => mpState(payload));
  ch.on('broadcast', {event: 'chat'}, ({payload}) => { if (payload && payload.id !== mp.id) mpLine(`${mpEsc(payload.name)}: ${mpEsc(payload.text)}`); });
  ch.on('broadcast', {event: 'rtc'}, ({payload}) => mpRtc(payload));
  ch.on('broadcast', {event: 'srv'}, ({payload}) => srvApply(payload));
  ch.on('presence', {event: 'sync'}, () => mpSync());
  ch.on('presence', {event: 'join'}, ({key, newPresences}) => { if (key !== mp.id) mpLine(`${mpEsc((newPresences[0] || {}).name || 'Pemain')} bergabung`, 'sys'); });
  ch.on('presence', {event: 'leave'}, ({key, leftPresences}) => { if (key !== mp.id) { mpLine(`${mpEsc((leftPresences[0] || {}).name || 'Pemain')} keluar`, 'sys'); mpDrop(key); } });
  ch.subscribe(async st => { if (st === 'SUBSCRIBED') { mp.ready = true; mpStatus('Online'); await ch.track(mpMe()); mpSync(); setTimeout(mpSlot, 600); srvPull(); renderUI(); }
    else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { mp.ready = false; mpStatus('Koneksi terputus, mencoba lagi…'); } });
}
// multiplayer spawn: parked on the shoulder after GT Semanggi, spread a little so players do not start inside each other
function mpSpawnShoulder(){
  const v = PLR; if (!v) return; mp.spawnP = v.p; mp.slotDone = false; const n = nAvail(v.sd, v.p);
  Object.assign(v, {lane: n - 1, lx: n - 0.2, vel: 0, hd: 0, steer: 0, thr: 0}); v.x = posX(-v.sd, v.lx); camU = uOfV(v);
  for (const o of [...vehicles]) if (o !== v && o.sd === v.sd && Math.abs(o.p - v.p) < 25 && o.lane >= n - 1) { rm(vehicles, o); killVehicle(o); }
  toast('Multiplayer: Anda di bahu jalan Semanggi. Nyalakan sein, lalu masuk lajur saat aman');
}
// players line up on the shoulder: each newcomer takes the next slot behind the ones already online (9 m apart)
function mpSlot(){
  const v = PLR; if (!v || mp.slotDone || mp.spawnP == null || Math.abs(v.vel) > 0.5 || Math.abs(v.p - mp.spawnP) > 2) return; mp.slotDone = true;
  const slot = mp.peers.size % 30; v.p = mp.spawnP + 120 - slot*9; camU = uOfV(v);
  for (const o of [...vehicles]) if (o !== v && o.sd === v.sd && Math.abs(o.p - v.p) < 25 && o.lane >= nAvail(v.sd, v.p) - 1) { rm(vehicles, o); killVehicle(o); }
  if (slot) mpLine(`Anda di barisan ke-${slot + 1} di bahu jalan`, 'sys');
}
function mpLeave(){
  if (!mp.on) return; try { mp.ch && mp.ch.untrack && mp.ch.untrack(); mp.sb ? mp.sb.removeChannel(mp.ch) : mp.ch && mp.ch.unsubscribe && mp.ch.unsubscribe(); } catch (e) {}
  for (const id of [...mp.peers.keys()]) mpDrop(id); mpMicOff(); mp.on = mp.ready = mp.admin = false; mp.adminPin = null; mp.ch = null; $('mpbox').hidden = true; renderUI();
}
function mpPeer(id){ let p = mp.peers.get(id); if (!p) { p = {id, name: 'Pemain', type: 'car', mod: null, st: null, rt: 0, u: null}; mp.peers.set(id, p); } return p; }
function mpSync(){
  const ps = mp.ch.presenceState ? mp.ch.presenceState() : {}, seen = new Set();
  for (const [key, arr] of Object.entries(ps)) { if (key === mp.id || !arr.length) continue; seen.add(key); const m = arr[0], p = mpPeer(key);
    if (p.type !== m.type || JSON.stringify(p.mod) !== JSON.stringify(m.mod)) mpModel(p, null); p.name = String(m.name || 'Pemain').slice(0, 16); p.type = VEH[m.type] ? m.type : 'car'; p.mod = m.mod || null;
    if (mp.voice && mp.id < key && !p.pc && mp.peers.size <= MP_MAX) mpPc(p, true); }
  for (const id of [...mp.peers.keys()]) if (!seen.has(id)) mpDrop(id);
  const names = [mpName() + ' (Anda)', ...[...mp.peers.values()].map(p => p.name)];
  $('mp-list').textContent = `${names.length} online: ${names.join(', ')}`; if (mp.ready) mpStatus(`Online · ${names.length} pemain`);
}
function mpDrop(id){ const p = mp.peers.get(id); if (!p) return; mpModel(p, null); if (p.pc) { try { p.pc.close(); } catch (e) {} } if (p.audio) { p.audio.pause(); p.audio.srcObject = null; } mp.peers.delete(id); }
// where is my car, in shared terms
function mpTick(dt){
  if (!mp.ready || !PLR || !EV.length) return; if ((mp.srvT = (mp.srvT || 0) - dt) < 0) { mp.srvT = 60; if (!mp.admin) srvPull(); }
  if ((mp.kickT = (mp.kickT ?? 30) - dt) < 0) { mp.kickT = 30; mpCheckKick(); }
  if ((mp.sendT -= dt) > 0) return; mp.sendT = 0.25;
  const u = foot ? foot.u : (PLR.rp ? PLR.rp.sd*PLR.p : uOfV(PLR)), i = clamp(evAt(u), 0, EV.length - 2), a = EV[i], b = EV[i + 1], ll = latLonAt(u);
  mp.ch.send({type: 'broadcast', event: 'st', payload: {id: mp.id, name: mpName(), type: PLR.type, c: a.cNext, km: +kmAt(u).toFixed(4), dir: (Math.sign(b.km - a.kmOut) || 1)*(PLR.sd || 1),
    lx: +(PLR.lx || 0).toFixed(2), v: +(foot ? 0 : PLR.vel).toFixed(1), lat: +ll.lat.toFixed(5), lon: +ll.lon.toFixed(5), em: sirenOn(PLR)}});
}
function mpState(p){ if (!p || p.id === mp.id || typeof p.km !== 'number') return; const q = mpPeer(p.id); q.st = p; q.rt = performance.now(); if (p.name) q.name = String(p.name).slice(0, 16);
  if (p.type && p.type !== q.type && VEH[p.type]) { q.type = p.type; mpModel(q, null); } }
// the place on my route that corresponds to a road + km, and whether they drive my way (sd = 1) or towards me
function uForCK(c, km){ for (let i = 0; i < EV.length - 1; i++) { const a = EV[i], b = EV[i + 1]; if (a.cNext !== c) continue; const k0 = a.kmOut, k1 = b.km;
    if ((km - k0)*(km - k1) > 1e-9) continue; return {u: a.u + (km - k0)/((k1 - k0) || 1)*(b.u - a.u), kdir: Math.sign(k1 - k0) || 1}; } return null; }
const nameTagCache = new Map();
function mpModel(p, build){
  if (p.v) { scene.remove(p.v.g); killVehicle(p.v); p.v = null; }
  if (!build) return; const md = p.mod || MOD_DEF, fixed = ['taxi', 'police', 'ambulance', 'damkar', 'angkot'].includes(p.type);
  p.v = makeVehicle(p.type, fixed ? null : new THREE.Color(md.paint || '#3a6fd8').getHex(), true); applyMods(p.v, md);
  const tex = canvasTex(1, 0.22, (x, w, h) => { x.fillStyle = 'rgba(20,20,22,0.82)'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; fit(x, p.name, w - 40, h*0.7, 800); x.fillText(p.name, w/2, h/2 + 4); });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.57), new THREE.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false})); tag.material.userData.own = true;
  tag.position.y = (heavy(p.v) || p.type === 'damkar' || p.type === 'derek' ? 4.4 : 2.6); tag.renderOrder = 5; p.v.g.add(tag); p.tag = tag; bendObj(tag); scene.add(p.v.g);
}
function mpPlace(){
  if (!mp.on) return; const now = performance.now();
  for (const p of mp.peers.values()) { const st = p.st; if (!st) continue; const m = uForCK(st.c, st.km);
    if (!m) { if (p.v) p.v.g.visible = false; p.u = null; continue; }
    const sd = st.dir === m.kdir ? 1 : -1, age = Math.min(1, (now - p.rt)/1000), tu = m.u + sd*st.v*age;
    p.u = p.u == null || Math.abs(p.u - tu) > 60 ? tu : p.u + (tu - p.u)*0.25; p.sd = sd;
    const z = camU - p.u, vis = Math.abs(z) < 900; if (vis && !p.v) mpModel(p, true); if (!p.v) continue; p.v.g.visible = vis; if (!vis) continue;
    p.v.g.position.set(posX(-sd, st.lx), 0, z); p.v.g.rotation.y = sd > 0 ? Math.PI : 0; for (const w of p.v.wh) w.rotation.x += st.v*0.016/p.v.r;
    if (p.v.lights) { const ph = (clock*3.2) % 1; p.v.lights[0].visible = st.em && ph < 0.5; p.v.lights[1].visible = st.em && ph >= 0.5; }
    if (p.tag) p.tag.rotation.y = Math.atan2(camera.position.x - p.v.g.position.x, camera.position.z - p.v.g.position.z) - p.v.g.rotation.y;
    if (p.audio) p.audio.volume = clamp(1 - Math.abs(z)/900, 0.3, 1); }
}
function mpDrawMap(x, P, big = false){ if (!mp.on) return; x.font = `${big ? 700 : 600} ${big ? 12 : 10}px Archivo, sans-serif`; x.textBaseline = 'alphabetic';
  for (const p of mp.peers.values()) { if (!p.st || p.st.lat == null) continue; const [a, b] = P(p.st.lat, p.st.lon), r = big ? 6 : 4;
    x.fillStyle = '#1f5fbf'; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(a, b, r, 0, Math.PI*2); x.fill(); x.stroke();
    if (big) { x.lineWidth = 3; x.strokeStyle = 'rgba(244,241,234,0.92)'; x.strokeText(p.name, a + r + 3, b + 4); }
    x.fillStyle = '#1f5fbf'; x.fillText(p.name, a + r + 3, b + 4); } }
function mpSay(text){ text = String(text).trim().slice(0, 200); if (!text || !mp.ready) return; if (clock - mp.chatT < 0.7) { toast('Tunggu sebentar sebelum mengirim lagi', 'warn'); return; } mp.chatT = clock;
  mp.ch.send({type: 'broadcast', event: 'chat', payload: {id: mp.id, name: mpName(), text}}); mpLine(`${mpName()}: ${text}`); }
// ---- voice: one WebRTC connection per player; the lower id makes the offer; the mic track is swapped in and out without renegotiation
const ICE = [{urls: 'stun:stun.l.google.com:19302'}, {urls: 'stun:stun1.l.google.com:19302'}];
function mpPc(p, initiate){
  if (p.pc) return p.pc; const pc = new RTCPeerConnection({iceServers: ICE}); p.pc = pc;
  if (initiate) { p.tx = pc.addTransceiver('audio', {direction: 'sendrecv'}); if (mp.mic) p.tx.sender.replaceTrack(mp.mic.getAudioTracks()[0]); }
  pc.onicecandidate = e => { if (e.candidate) mp.ch.send({type: 'broadcast', event: 'rtc', payload: {from: mp.id, to: p.id, kind: 'ice', cand: e.candidate.toJSON()}}); };
  pc.ontrack = e => { if (!p.audio) { p.audio = new Audio(); p.audio.autoplay = true; } p.audio.srcObject = e.streams[0] || new MediaStream([e.track]); p.audio.muted = !mp.voice; p.audio.play().catch(() => {}); };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { try { pc.close(); } catch (e) {} p.pc = null; } };
  if (initiate) pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => mp.ch.send({type: 'broadcast', event: 'rtc', payload: {from: mp.id, to: p.id, kind: 'offer', sdp: pc.localDescription.toJSON()}})).catch(() => {});
  return pc;
}
function mpPcReset(p){ if (p.pc) { try { p.pc.close(); } catch (e) {} } p.pc = null; p.tx = null; }
async function mpRtc(m){
  if (!m || !mp.voice || m.from === mp.id) return;
  // someone switched voice on: rebuild the link with them (the lower id makes the offer)
  if (m.kind === 'hello') { const p = mpPeer(m.from); mpPcReset(p); if (mp.id < m.from) mpPc(p, true); return; }
  if (m.to !== mp.id) return; const p = mpPeer(m.from);
  try { if (m.kind === 'offer') { if (p.pc && p.pc.signalingState !== 'stable') mpPcReset(p); const pc = mpPc(p, false); await pc.setRemoteDescription(m.sdp);
      // answer on the offer's own audio line: send our mic on it too
      p.tx = pc.getTransceivers()[0]; if (p.tx) { p.tx.direction = 'sendrecv'; if (mp.mic) await p.tx.sender.replaceTrack(mp.mic.getAudioTracks()[0]); }
      const a = await pc.createAnswer(); await pc.setLocalDescription(a);
      mp.ch.send({type: 'broadcast', event: 'rtc', payload: {from: mp.id, to: p.id, kind: 'answer', sdp: pc.localDescription.toJSON()}}); }
    else if (m.kind === 'answer' && p.pc) await p.pc.setRemoteDescription(m.sdp);
    else if (m.kind === 'ice' && p.pc) await p.pc.addIceCandidate(m.cand); } catch (e) {}
}
function mpVoice(on){ mp.voice = on; $('mp-voice').setAttribute('aria-pressed', on ? 'true' : 'false');
  for (const p of mp.peers.values()) { if (p.audio) p.audio.muted = !on; if (on) { mpPcReset(p); if (mp.id < p.id) mpPc(p, true); } else mpPcReset(p); }
  if (on && mp.ready) mp.ch.send({type: 'broadcast', event: 'rtc', payload: {from: mp.id, to: '*', kind: 'hello'}});
  if (!on) mpMicOff(); mpLine(on ? 'Suara pemain lain dinyalakan' : 'Suara dimatikan', 'sys'); }
async function mpMicOn(){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('Mikrofon tidak didukung browser ini', 'warn'); return; }
  try { mp.mic = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}}); } catch (e) { toast('Izin mikrofon ditolak', 'warn'); return; }
  if (!mp.voice) mpVoice(true); const tr = mp.mic.getAudioTracks()[0]; for (const p of mp.peers.values()) { if (!p.pc && mp.id < p.id) mpPc(p, true); if (p.tx) p.tx.sender.replaceTrack(tr); }
  $('mp-mic').setAttribute('aria-pressed', 'true'); mpLine('Mikrofon aktif: pemain lain bisa mendengar Anda', 'sys'); }
function mpMicOff(){ if (mp.mic) { mp.mic.getTracks().forEach(t => t.stop()); mp.mic = null; } for (const p of mp.peers.values()) if (p.tx) p.tx.sender.replaceTrack(null); $('mp-mic').setAttribute('aria-pressed', 'false'); }

// ---------- headlights at night: a pool of light on the road in front of every nearby vehicle, plus real spotlights for the player ----------
const beamTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 256, 0, 0); g.addColorStop(0, 'rgba(255,240,205,0.6)'); g.addColorStop(0.3, 'rgba(255,236,190,0.3)'); g.addColorStop(1, 'rgba(255,230,180,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 256); const h = x.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.3, 'rgba(0,0,0,0)'); h.addColorStop(0.7, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 64, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const beamMat = new THREE.MeshBasicMaterial({map: beamTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -3});
const beamGeo = (() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI/2); g.translate(0, 0, -0.5); return g; })();   // extends forward (−z) from its origin
const beamM = new THREE.InstancedMesh(beamGeo, beamMat, 220); beamM.count = 0; beamM.frustumCulled = false; beamM.renderOrder = 2; patchMat(beamMat); scene.add(beamM);
const plSpots = [-0.6, 0.6].map(dx => { const L = new THREE.SpotLight(0xfff1d6, 0, 60, 0.42, 0.6, 2); L.userData.dx = dx; scene.add(L, L.target); return L; });
let headK = 0;
function placeBeams(){
  beamMat.opacity = 0.2*headK; if (headK < 0.02) { beamM.count = 0; for (const L of plSpots) L.intensity = 0; return; }
  let i = 0; const add = (x, z, ry, len, w) => { if (i >= 220) return; fxDummy.position.set(x, 0.03, z); fxDummy.rotation.set(0, ry, 0); fxDummy.scale.set(w, 1, len); fxDummy.updateMatrix(); beamM.setMatrixAt(i++, fxDummy.matrix); };
  const list = vehicles.concat(rampers).filter(v => v.g.visible && !v.lift && v.g.position.z < 40 && v.g.position.z > -160).sort((a, b) => Math.abs(a.g.position.z) - Math.abs(b.g.position.z)).slice(0, 60);
  for (const v of list) { const p = v.g.position;
    const ry = v.g.rotation.y, fz = -Math.cos(ry), fx = -Math.sin(ry), off = v.len/2;
    // the group's forward is local +z: the beam starts at the front bumper and points ahead
    add(p.x + Math.sin(ry)*off, p.z + Math.cos(ry)*off, ry + Math.PI, heavy(v) ? 22 : v.type === 'moto' ? 12 : 18, heavy(v) ? 3.6 : v.type === 'moto' ? 1.8 : 3.0); }
  beamM.count = i; beamM.instanceMatrix.needsUpdate = true;
  const P = PLR; if (P && !foot) { const p = P.g.position, ry = P.g.rotation.y, fx = Math.sin(ry), fz = Math.cos(ry);
    for (const L of plSpots) { const dx = L.userData.dx; L.position.set(p.x + fx*P.len*0.5 + fz*dx, 0.75 + (P.lift || 0), p.z + fz*P.len*0.5 - fx*dx); L.target.position.set(L.position.x + fx*40, 0, L.position.z + fz*40); L.intensity = 14*headK; } }
  else for (const L of plSpots) L.intensity = 0;
}

// ================================================================
// ANGRY DRIVERS: after you hit a car, it pulls over onto the shoulder; the driver gets out and lets you know,
// with a speech bubble. Stop nearby and apologise (pay for the damage) to settle it.
// ================================================================
const RANTS = ['Woi! Bisa nyetir gak sih?!', 'Mata ditaruh di mana?!', 'Mobil saya penyok nih!', 'Ganti rugi pokoknya!', 'Jangan kabur ya!', 'Astaga… baru keluar bengkel!',
  'Turun! Tanggung jawab!', 'Saya foto plat nomornya!', 'Ngebut terus sih!', 'Lihat nih, lecet semua!', 'SIM-nya nembak ya?!', 'Pelan-pelan dong!'];
const angry = [];
function bubbleTex(text){ const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.strokeStyle = '#1b1b1b'; x.lineWidth = 6; x.beginPath(); x.roundRect(8, 8, 496, 112, 26); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(230, 118); x.lineTo(256, 154); x.lineTo(282, 118); x.closePath(); x.fill(); x.stroke(); x.fillRect(232, 108, 48, 12);
  x.fillStyle = '#c4161c'; x.textAlign = 'center'; x.textBaseline = 'middle'; fit(x, text, 460, 44, 800); x.fillText(text, 256, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function startAngry(o, dv){
  if (o.em || o.player || o.angry || angry.length >= 3 || o.type === 'moto' || o.type === 'derek') return;
  const n = nAvail(o.sd, o.p); o.angry = {phase: 'pull', t: 0, dv, cost: Math.round((150000 + dv*30000)/10000)*10000}; o.esc = 'po'; o.escX = n - 0.2; o.crashT = clock + 600; angry.push(o);
  setTimeout(() => horn(o.type, 20, panOf(o), 0.9), 600);
}
function endAngry(o){ const a = o.angry; if (!a) return; if (a.person) { scene.remove(a.person.g); a.person.g.traverse(m => { if (m.material && m.material.userData.own) { m.material.map && m.material.map.dispose(); m.material.dispose(); } }); }
  o.angry = null; o.esc = null; o.crashT = clock; rm(angry, o); }
function stepAngry(dt){
  const P = PLR; let near = null;
  for (const o of [...angry]) { const a = o.angry; if (!a || o.dead || !vehicles.includes(o)) { if (a) endAngry(o); else rm(angry, o); continue; } a.t += dt;
    const ou = o.sd*o.p, pu = P ? (foot ? foot.u : uOfV(P)) : ou, px = P ? (foot ? foot.x : P.x) : 0, dist = Math.abs(pu - ou);
    if (a.phase === 'pull') { if ((o.vel < 0.3 && Math.abs(o.lx - o.escX) < 0.12) || a.t > 8) {
        const m = makePerson(), side = -o.sd;                      // out of the door on the shoulder side
        a.person = {...m, u: ou + o.sd*0.6, x: o.x + side*((HW[o.type] || 1) + 0.7), hd: 0, ph: 0};
        const bt = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.81), new THREE.MeshBasicMaterial({map: bubbleTex(pick(RANTS)), transparent: true, depthWrite: false}));
        bt.material.userData.own = true; bt.position.y = 2.6; bt.renderOrder = 6; m.g.add(bt); a.bubble = bt; bendObj(bt); scene.add(m.g);
        a.phase = 'rant'; a.t = 0; a.say = 0; } continue; }
    const pr = a.person; if (!pr) continue;
    if (a.phase === 'rant') {
      if ((a.say += dt) > 2.6) { a.say = 0; const old = a.bubble.material.map; a.bubble.material.map = bubbleTex(a.calm ? a.calm : pick(RANTS)); old.dispose(); a.bubble.material.needsUpdate = true; }
      // walk up to the player's car if it stopped close by, otherwise stand by the car and gesture
      const stopped = P && Math.abs(P.vel) < 1 && dist < 45;
      if (stopped && !a.calm) { const tu = pu - o.sd*((P.len || 4)/2 + 1.6), tx = px - o.sd*((HW[P.type] || 1) + 0.9), du = tu - pr.u, dx = tx - pr.x, d = Math.hypot(du, dx);
        if (d > 0.5) { const sp = Math.min(1.5, d)*dt; pr.u += du/d*sp; pr.x += dx/d*sp; pr.ph += dt*6; } }
      if (stopped && (dist < 14 || Math.hypot(pr.u - pu, pr.x - px) < 7)) near = o;
      if (a.calm && a.t > 3.2) { a.phase = 'back'; a.t = 0; }
      if (!stopped && dist > 260) a.away = (a.away || 0) + dt; else a.away = 0;
      if (a.away > 4 || a.t > 70) { a.phase = 'back'; a.t = 0; } }
    if (a.phase === 'back') { const du = (ou + o.sd*0.6) - pr.u, dx = (o.x - o.sd*((HW[o.type] || 1) + 0.7)) - pr.x, d = Math.hypot(du, dx);
      if (d > 0.4 && a.t < 12) { const sp = 1.6*dt; pr.u += du/d*sp; pr.x += dx/d*sp; pr.ph += dt*6; } else { endAngry(o); continue; } }
    // pose: arms up and waving while ranting, a walk cycle while walking
    const wave = a.phase === 'rant' && !a.calm ? Math.sin(clock*9) : 0, sw = Math.sin(pr.ph)*0.5;
    pr.arms[0].rotation.x = a.calm ? 0 : -2.4 + wave*0.5; pr.arms[1].rotation.x = a.calm ? 0 : -1.2 - wave*0.6; pr.legs[0].rotation.x = sw; pr.legs[1].rotation.x = -sw; }
  $('peaceb').hidden = !near || !!near.angry.calm; peaceTarget = near;
}
let peaceTarget = null;
function placeAngry(){ for (const o of angry) { const a = o.angry, pr = a && a.person; if (!pr) continue; const z = camU - pr.u, P = PLR;
  pr.g.position.set(pr.x, 0, z); pr.g.visible = Math.abs(z) < 400 && o.g.visible;
  const tx = P ? (foot ? foot.x : P.x) : pr.x, tz = P ? camU - (foot ? foot.u : uOfV(P)) : z - 1; pr.g.rotation.y = Math.atan2(tx - pr.x, tz - z);
  if (a.bubble) a.bubble.rotation.y = Math.atan2(camera.position.x - pr.g.position.x, camera.position.z - pr.g.position.z) - pr.g.rotation.y; } }
function makePeace(){ const o = peaceTarget; if (!o || !o.angry) return; const a = o.angry;
  if (WAL.cash < a.cost) { toast(`Uang tunai kurang (perlu ${rp$(a.cost)}): tarik tunai di ATM`, 'warn'); return; }
  WAL.cash -= a.cost; a.calm = pick(['Ya sudah, saya maafkan.', 'Oke, lain kali hati-hati!', 'Baik, kita damai saja.']); a.t = 0; a.say = 99;
  toast(`Anda minta maaf dan membayar ganti rugi ${rp$(a.cost)}`); uiNeeds(); $('peaceb').hidden = true; }

// ---------- multiplayer server settings: one set of weather / time / road settings for everyone, changed only by the admin ----------
// Stored in server.7mit (table drive7_server); the admin PIN is checked by the server (function drive7_set_settings).
const SRV_KEYS = ['den', 'weather', 'roadStyle', 'tod', 'tspd', 'lanes', 'close:1', 'close:-1', 'cf', 'cfk', 'ovl', 'scale'];
// in multiplayer an ordinary player cannot change any setting; only personal ones (camera, sound, HUD, steering aids) stay free
const MP_FREE = ['cam', 'sound', 'clean', 'autoSteer', 'steerAssist', 'gfx'];   // personal: kept on this device, never sent to the server
const srvLocked = id => mp.on && !mp.admin && !MP_FREE.includes(id);
function srvCollect(){ return {den: cfg.den, weather: cfg.weather, roadStyle: cfg.roadStyle, lanes: cfg.lanes, closed: cfg.closed, cf: cfg.cf, cfk: cfg.cfk, ovl: cfg.ovl, scale: cfg.scale,
  clock: {h: +gameH.toFixed(3), t: Date.now(), spd: +cfg.tspd || 0}}; }
let srvApplying = false;
function srvApply(S){
  if (!S || typeof S !== 'object') return; srvApplying = true;
  try { for (const k of ['den', 'weather', 'roadStyle', 'cf', 'cfk', 'ovl', 'lanes', 'scale']) if (S[k] != null && String(cfg[k]) !== String(S[k])) apply(k, S[k], true);
    if (S.closed && JSON.stringify(S.closed) !== JSON.stringify(cfg.closed)) { cfg.closed = S.closed; saveCfg(); applyTraffic(['rw']); updateWorld(); }
    if (S.clock && typeof S.clock.h === 'number') { cfg.tspd = S.clock.spd; gameH = mod(S.clock.h + (Date.now() - S.clock.t)/60000*S.clock.spd, 24); todT = 0; lastSign = -1; tickClock(0); }
    renderUI(); } finally { srvApplying = false; }
}
async function srvPull(){ if (!mp.sb) return; try { const {data} = await mp.sb.from('drive7_server').select('settings,updated_at').eq('id', 1).maybeSingle(); if (data && data.settings && Object.keys(data.settings).length) srvApply(data.settings); } catch (e) {} }
async function srvPush(){
  if (!mp.admin || !mp.sb) return; const S = srvCollect();
  try { const {data, error} = await mp.sb.rpc('drive7_set_settings', {p_pin: mp.adminPin, p_settings: S});
    if (error || !data) { toast('Gagal menyimpan pengaturan server (PIN ditolak?)', 'bad'); return; }
    mp.ch.send({type: 'broadcast', event: 'srv', payload: S}); toast('Pengaturan server disimpan untuk semua pemain'); } catch (e) { toast('Gagal terhubung ke server', 'bad'); }
}
function srvAdminLogin(){ $('pin-in').value = ''; $('pin').hidden = false; setTimeout(() => $('pin-in').focus(), 50); }
async function srvAdminCheck(pin){
  pin = String(pin || '').trim(); if (!pin) return; $('pin').hidden = true;
  if (!mp.sb) { toast('Belum terhubung ke server', 'warn'); return; }
  try { const {data} = await mp.sb.rpc('drive7_check_pin', {p_pin: pin});
    if (data === true) { mp.admin = true; mp.adminPin = pin; toast('Mode admin server aktif: perubahan berlaku untuk semua pemain'); mpLine('Anda masuk sebagai admin server', 'sys'); renderUI(); }
    else toast('PIN salah (atau terlalu banyak percobaan, tunggu 10 menit)', 'bad'); } catch (e) { toast('Gagal memeriksa PIN', 'bad'); }
}

// ---------- kick & ban (admin): presence is recorded by the server (name, IP, device, OS, browser) ----------
function devInfo(){ const ua = navigator.userAgent || '', touch = navigator.maxTouchPoints > 1;
  const os = /iPad/.test(ua) || (/Macintosh/.test(ua) && touch) ? 'iPadOS' : /iPhone|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'ChromeOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Lainnya';
  const browser = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Lainnya';
  const device = os === 'iPadOS' || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'Tablet' : os === 'iOS' || /Mobile/.test(ua) ? 'HP' : 'Desktop/Laptop';
  return {device, os, browser}; }
async function mpPresence(action){ if (!mp.sb || !mp.sb.functions) return {ok: true};
  try { const {data, error} = await mp.sb.functions.invoke('drive7-presence', {body: {action, id: mp.id, name: mpName(), ...devInfo()}}); return error ? {ok: true} : (data || {ok: true}); } catch (e) { return {ok: true}; } }
function mpKicked(banned, reason){ mpLeave(); toast(banned ? `Anda diblokir dari server multiplayer${reason ? ': ' + reason : ''}` : 'Anda dikeluarkan dari multiplayer oleh admin', 'bad');
  cfg.trip = 'free'; saveCfg(); setTimeout(openPlanner, 600); }
async function mpCheckKick(){ if (!mp.on || !mp.sb) return; const r = await mpPresence('check'); if (r && (r.kicked || r.banned)) mpKicked(!!r.banned, r.reason); }
// admin panel
const fmtT = t => { try { return new Date(t).toLocaleString('id-ID', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'}); } catch (e) { return ''; } };
async function admLoad(){
  if (!mp.admin || !mp.sb) return; const pl = $('adm-players'), bl = $('adm-bans'); pl.textContent = 'Memuat…'; bl.textContent = '';
  const [{data: players}, {data: bans}] = await Promise.all([mp.sb.rpc('drive7_admin_players', {p_pin: mp.adminPin}), mp.sb.rpc('drive7_admin_bans', {p_pin: mp.adminPin})]).catch(() => [{}, {}]);
  pl.textContent = ''; bl.textContent = '';
  const online = new Set([...mp.peers.keys(), mp.id]);
  for (const p of players || []) { const row = document.createElement('div'); row.className = 'adm-row'; const info = document.createElement('div');
    const b = document.createElement('b'); b.textContent = `${p.name || '(tanpa nama)'}${p.player_id === mp.id ? ' (Anda)' : ''}${online.has(p.player_id) ? ' · online' : ''}`;
    const sm = document.createElement('small'); sm.textContent = `${p.device || '?'} · ${p.os || '?'} · ${p.browser || '?'} · IP ${p.ip || '?'} · terakhir ${fmtT(p.last_seen)}`;
    const ua = document.createElement('small'); ua.textContent = p.user_agent || ''; ua.style.opacity = '.5'; info.append(b, sm, ua);
    const acts = document.createElement('div'); acts.className = 'acts';
    if (p.player_id !== mp.id) for (const [label, mins, bad] of [['Kick', null, false], ['Ban 1 jam', 60, true], ['Ban permanen', 0, true]]) {
      const x = document.createElement('button'); x.textContent = label; if (bad) x.className = 'bad';
      x.onclick = async () => { if (mins !== null && !confirm(`${label} untuk ${p.name || p.player_id}?`)) return;
        const r = mins === null ? await mp.sb.rpc('drive7_admin_kick', {p_pin: mp.adminPin, p_player: p.player_id}) : await mp.sb.rpc('drive7_admin_ban', {p_pin: mp.adminPin, p_player: p.player_id, p_minutes: mins, p_reason: 'Diblokir admin'});
        if (r && r.data) { mp.ch.send({type: 'broadcast', event: 'kickhint', payload: {id: p.player_id}}); toast(`${label}: ${p.name || p.player_id}`); admLoad(); } else toast('Gagal (PIN?)', 'bad'); };
      acts.append(x); }
    row.append(info, acts); pl.append(row); }
  if (!(players || []).length) pl.textContent = 'Belum ada pemain.';
  for (const bn of bans || []) { const row = document.createElement('div'); row.className = 'adm-row'; const info = document.createElement('div');
    const b = document.createElement('b'); b.textContent = bn.name || bn.player_id || bn.ip; const sm = document.createElement('small'); sm.textContent = `IP ${bn.ip || '?'} · ${bn.until ? 'sampai ' + fmtT(bn.until) : 'permanen'}${bn.reason ? ' · ' + bn.reason : ''}`; info.append(b, sm);
    const acts = document.createElement('div'); acts.className = 'acts'; const x = document.createElement('button'); x.textContent = 'Buka blokir';
    x.onclick = async () => { const r = await mp.sb.rpc('drive7_admin_unban', {p_pin: mp.adminPin, p_ban: bn.id}); if (r && r.data) { toast('Blokir dibuka'); admLoad(); } else toast('Gagal', 'bad'); };
    acts.append(x); row.append(info, acts); bl.append(row); }
  if (!(bans || []).length) bl.textContent = 'Tidak ada.';
}
function admOpen(){ $('adm').hidden = false; admLoad(); }

// ================================================================
// MUSIC: paste a link (YouTube, YouTube Music, Spotify, SoundCloud, Apple Music, Deezer, an audio file) or search a song
// ================================================================
const music = {on: false, recent: Array.isArray(cfg.musRecent) ? cfg.musRecent : []};
function parseMusic(raw){
  const s = String(raw || '').trim(); let u; try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { return null; }
  if (!/\./.test(u.hostname) || /\s/.test(s)) return null; const h = u.hostname.replace(/^www\.|^m\./, ''), P = u.pathname;
  if (/(^|\.)youtube\.com$|^youtu\.be$|^music\.youtube\.com$/.test(h)) {
    const id = h === 'youtu.be' ? P.slice(1, 12) : (u.searchParams.get('v') || (P.match(/\/(?:shorts|embed|live)\/([\w-]{11})/) || [])[1]), list = u.searchParams.get('list');
    if (id) return {kind: 'iframe', h: 186, src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1${list ? '&list=' + encodeURIComponent(list) : ''}`, title: 'YouTube'};
    if (list) return {kind: 'iframe', h: 186, src: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}&autoplay=1&playsinline=1`, title: 'YouTube · playlist'}; }
  if (h === 'open.spotify.com' || h === 'spotify.link') { const m = P.match(/(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/);
    if (m) return {kind: 'iframe', h: m[1] === 'track' || m[1] === 'episode' ? 152 : 352, src: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`, title: 'Spotify · ' + m[1]}; }
  if (/soundcloud\.com$/.test(h)) return {kind: 'iframe', h: 140, src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.href)}&auto_play=true&visual=false`, title: 'SoundCloud'};
  if (h === 'music.apple.com') return {kind: 'iframe', h: 175, src: 'https://embed.music.apple.com' + P + u.search, title: 'Apple Music'};
  if (/deezer\.com$/.test(h)) { const m = P.match(/(track|album|playlist)\/(\d+)/); if (m) return {kind: 'iframe', h: 152, src: `https://widget.deezer.com/widget/auto/${m[1]}/${m[2]}`, title: 'Deezer'}; }
  if (/\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)$/i.test(P)) return {kind: 'audio', src: u.href, title: decodeURIComponent(P.split('/').pop())};
  return null;
}
function musPlay(item, label){
  const box = $('mus-player'); box.textContent = '';
  if (item.kind === 'iframe') { const f = document.createElement('iframe'); f.src = item.src; f.height = item.h; f.allow = 'autoplay; encrypted-media; clipboard-write; picture-in-picture; fullscreen';
    f.referrerPolicy = 'strict-origin-when-cross-origin'; f.loading = 'eager'; f.title = label || item.title; box.append(f); }
  else { const a = document.createElement('audio'); a.src = item.src; a.controls = true; a.autoplay = true; box.append(a); a.play().catch(() => {}); }
  music.on = true; $('mus-now').textContent = label || item.title; $('musb').setAttribute('aria-pressed', 'true');
  const rec = {label: label || item.title, item}; music.recent = [rec, ...music.recent.filter(r => r.item.src !== item.src)].slice(0, 4); cfg.musRecent = music.recent; saveCfg(); musRecentUI();
}
function musStop(){ $('mus-player').textContent = ''; music.on = false; $('mus-now').textContent = ''; $('musb').setAttribute('aria-pressed', 'false'); }
function musRow(img, title, sub, actions){ const r = document.createElement('div'); r.className = 'mus-item'; const im = document.createElement('img'); if (img) im.src = img; im.alt = '';
  const t = document.createElement('div'), b = document.createElement('b'), sm = document.createElement('small'); b.textContent = title; sm.textContent = sub || ''; t.append(b, sm);
  const acts = document.createElement('div'); for (const [lbl, fn] of actions) { const x = document.createElement('button'); x.textContent = lbl; x.onclick = fn; acts.append(x); } r.append(im, t, acts); return r; }
function musRecentUI(){ const el = $('mus-recent'); el.textContent = ''; if (!music.recent.length) return; const h = document.createElement('div'); h.className = 'mus-note'; h.textContent = 'Terakhir diputar'; el.append(h);
  for (const r of music.recent) el.append(musRow('', r.label, r.item.title, [['Putar', () => musPlay(r.item, r.label)]])); }
const fetchT = (url, ms = 5000) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); return fetch(url, {signal: c.signal}).finally(() => clearTimeout(t)); };
const fmtDur = s => s ? `${Math.floor(s/60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '';
// search: full songs from YouTube through public no-key mirrors; if none answers, 30-second previews from the iTunes catalogue
const YT_MIRRORS = [q => `https://inv.nadeko.net/api/v1/search?type=video&q=${q}`, q => `https://invidious.nerdvpn.de/api/v1/search?type=video&q=${q}`, q => `https://pipedapi.kavin.rocks/search?filter=music_songs&q=${q}`, q => `https://api.piped.private.coffee/search?filter=videos&q=${q}`];
async function musSearch(q){
  const res = $('mus-results'), tok = music.tok = (music.tok || 0) + 1, stale = () => tok !== music.tok; res.textContent = 'Mencari…'; const enc = encodeURIComponent(q);
  for (const m of YT_MIRRORS) { try { const r = await fetchT(m(enc)); if (!r.ok) continue; const j = await r.json(); const arr = Array.isArray(j) ? j : j.items || [];
      const items = arr.map(v => ({id: v.videoId || (v.url || '').split('v=')[1], title: v.title, by: v.author || v.uploaderName || '', dur: v.lengthSeconds || v.duration, img: (v.videoThumbnails && v.videoThumbnails[0] && v.videoThumbnails[0].url) || v.thumbnail}))
        .filter(v => v.id && /^[\w-]{11}$/.test(v.id)).slice(0, 10);
      if (!items.length) continue; if (stale()) return; res.textContent = '';
      for (const v of items) res.append(musRow(v.img && !/^\//.test(v.img) ? v.img : `https://i.ytimg.com/vi/${v.id}/default.jpg`, v.title, `${v.by}${v.dur ? ' · ' + fmtDur(v.dur) : ''}`,
        [['Putar', () => musPlay({kind: 'iframe', h: 186, src: `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&playsinline=1`, title: 'YouTube'}, v.title)]]));
      return; } catch (e) {} }
  if (stale()) return;
  try { const r = await fetchT(`https://itunes.apple.com/search?media=music&entity=song&limit=10&term=${enc}`, 7000), j = await r.json(); if (stale()) return; res.textContent = '';
    const note = document.createElement('div'); note.className = 'mus-note'; note.textContent = 'Pencarian YouTube sedang tidak tersedia: ini cuplikan 30 detik. Untuk lagu penuh, tempel link YouTube/Spotify.'; res.append(note);
    for (const t of (j.results || []).filter(t => t.previewUrl)) res.append(musRow(t.artworkUrl60, t.trackName, `${t.artistName} · cuplikan`, [
      ['Cuplikan', () => musPlay({kind: 'audio', src: t.previewUrl, title: 'Cuplikan 30 detik'}, `${t.trackName} · ${t.artistName}`)],
      ['YouTube', () => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(t.artistName + ' ' + t.trackName)}`, '_blank', 'noopener')]]));
    if (!(j.results || []).length) res.append(Object.assign(document.createElement('div'), {className: 'mus-note', textContent: 'Lagu tidak ditemukan.'}));
  } catch (e) { if (!stale()) res.textContent = 'Pencarian gagal (periksa internet). Tempel link lagu langsung.'; }
}
function musSubmit(){ const v = $('mus-in').value.trim(); if (!v) return; const it = parseMusic(v); if (it) { music.tok = (music.tok || 0) + 1; musPlay(it); $('mus-results').textContent = ''; } else musSearch(v); $('mus-in').blur(); }

// ---------- crash effects: debris and glass, sparks, smoke and fire, dents, skid marks ----------
// Particles live in road coordinates (u, x, y) so they stay put as the world scrolls; drawn with instanced meshes.
const FXN = 420, fxDummy = new THREE.Object3D(), fxCol = new THREE.Color();
const mkFx = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); patchMat(mat); scene.add(m); return m; };
const debrisM = mkFx(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.6, metalness: 0.3}), FXN);
const sparkM = mkFx(new THREE.BoxGeometry(0.06, 0.06, 0.4), new THREE.MeshStandardMaterial({color: 0xffc060, emissive: 0xff8a20, emissiveIntensity: 4}), 200);
const smokeM = mkFx(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({color: 0x9a9a9a, transparent: true, opacity: 0.42, depthWrite: false, roughness: 1}), 220);
const fireM = mkFx(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 3, transparent: true, opacity: 0.85, depthWrite: false}), 80);
const skidM = mkFx(new THREE.PlaneGeometry(0.24, 1).rotateX(-Math.PI/2), new THREE.MeshStandardMaterial({color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2}), 600);
const FX = {debris: [], spark: [], smoke: [], fire: [], skid: []};
function fxAdd(list, max, p){ if (list.length >= max) list.shift(); list.push(p); }
// an impact at road position (u, x, y): debris in the paint colour and glass, sparks, a puff of dust; more and faster with the speed change
function crashFx(u, x, y, dv, paint, dir = 0){
  const n = Math.min(40, Math.round(dv*2.2)), rnd2 = () => Math.random()*2 - 1;
  for (let k = 0; k < n; k++) { const glass = Math.random() < 0.35, sp = 1.5 + Math.random()*dv*0.45;
    fxAdd(FX.debris, FXN, {u, x, y: y + 0.6, vu: rnd2()*sp + dir*dv*0.3, vx: rnd2()*sp, vy: 1 + Math.random()*sp*0.8, s: glass ? 0.05 + Math.random()*0.08 : 0.08 + Math.random()*0.22, rot: Math.random()*6, w: rnd2()*12,
      c: glass ? 0x9fc6d8 : Math.random() < 0.25 ? 0x222222 : (paint ?? 0xb0b0b0), t: 6 + Math.random()*6}); }
  for (let k = 0; k < Math.min(30, dv*2); k++) fxAdd(FX.spark, 200, {u, x, y: y + 0.4, vu: rnd2()*6 + dir*4, vx: rnd2()*6, vy: Math.random()*4, t: 0.35 + Math.random()*0.4});
  for (let k = 0; k < Math.min(8, 2 + dv*0.4); k++) fxAdd(FX.smoke, 220, {u: u + rnd2(), x: x + rnd2(), y: y + 0.5, vu: rnd2()*0.6, vx: rnd2()*0.6, vy: 0.6 + Math.random(), s: 0.6, g: 1.4, t: 2 + Math.random()*1.5, T: 3.5});
}
function scrapeFx(u, x, y, side){ for (let k = 0; k < 3; k++) fxAdd(FX.spark, 200, {u, x, y: y + 0.35, vu: -(1 + Math.random()*4), vx: side*Math.random()*2, vy: Math.random()*2.5, t: 0.25 + Math.random()*0.3}); }
// damage: dents the body (shorter at the front or back, narrower at the side), smoke from the engine, fire when wrecked
function damage(v, dv, where){ if (!v || !v.g) return; v.dmg = Math.min(100, (v.dmg || 0) + dv*(v.player ? 3.2 : 2.6));
  v.dentZ = Math.min(0.14, (v.dentZ || 0) + (where === 'side' ? 0.004 : 0.011)*dv); v.dentX = Math.min(0.1, (v.dentX || 0) + (where === 'side' ? 0.012 : 0.002)*dv);
  v.g.scale.set(1 - v.dentX, 1 - v.dentZ*0.25, 1 - v.dentZ); if (dv > 6) v.g.rotation.z += (Math.random() - 0.5)*0.04; }
let skidT = 0;
function updateFx(dt){
  const G = 9.81, ground = 0.03;
  for (const p of FX.debris) { if (p.y > ground + 0.01 || p.vy > 0) { p.vy -= G*dt; p.u += p.vu*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.rot += p.w*dt;
      if (p.y < ground) { p.y = ground; p.vy = -p.vy*0.3; p.vu *= 0.6; p.vx *= 0.6; p.w *= 0.5; if (Math.abs(p.vy) < 0.4) p.vy = 0; } } p.t -= dt; }
  for (const p of FX.spark) { p.vy -= G*dt; p.u += p.vu*dt; p.x += p.vx*dt; p.y = Math.max(ground, p.y + p.vy*dt); p.t -= dt; }
  for (const p of FX.smoke) { p.u += p.vu*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.s += p.g*dt; p.t -= dt; }
  for (const p of FX.fire) { p.y += p.vy*dt; p.s *= 1 - dt*1.5; p.t -= dt; }
  for (const p of FX.skid) p.t -= dt;
  for (const k in FX) FX[k] = FX[k].filter(p => p.t > 0 && Math.abs(p.u - camU) < 700);
  // damaged vehicles smoke from the engine; wrecks burn
  for (const v of vehicles.concat(rampers)) { if (!(v.dmg > 35) || !v.g.visible) continue; const u = v.rp ? v.rp.sd*v.p : uOfV(v), sd = v.rp ? v.rp.sd : v.sd, fu = u + sd*v.len*0.38;
    if (Math.random() < dt*(v.dmg - 25)*0.12) fxAdd(FX.smoke, 220, {u: fu, x: v.x, y: 1.1, vu: sd*v.vel*0.2 + (Math.random() - 0.5)*0.4, vx: (Math.random() - 0.5)*0.4, vy: 0.8 + Math.random()*0.6, s: 0.25, g: 0.55, t: 2.2, T: 2.2, dark: v.dmg > 70});
    if (v.dmg > 85 && Math.random() < dt*14) fxAdd(FX.fire, 80, {u: fu, x: v.x + (Math.random() - 0.5)*1.2, y: 0.9, vy: 1.5 + Math.random(), s: 0.45 + Math.random()*0.3, t: 0.5}); }
  // skid marks: hard braking (ABS still leaves marks) or sliding sideways
  const P = PLR; if (P && !P.rp && !cfg.auto && Math.abs(P.vel) > 4 && (P.brk > 0.85 || P.slide > 0.4) && (skidT -= dt) < 0) { skidT = 0.03;
    const u = uOfV(P), hw = (HW[P.type] || 0.92)*0.82; for (const s2 of [-1, 1]) fxAdd(FX.skid, 600, {u: u - P.sd*P.len*0.3, x: P.x + s2*hw, ang: P.hd || 0, l: Math.abs(P.vel)*0.035 + 0.3, t: 40}); }
  // draw
  const put = (m, list, f) => { let i = 0; for (const p of list) { if (!f(p)) continue; fxDummy.updateMatrix(); m.setMatrixAt(i, fxDummy.matrix); if (m === debrisM) m.setColorAt(i, fxCol.setHex(p.c)); i++; } m.count = i; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; };
  put(debrisM, FX.debris, p => { fxDummy.position.set(p.x, p.y, camU - p.u); fxDummy.rotation.set(p.rot, p.rot*0.7, 0); fxDummy.scale.set(p.s, p.s*0.4, p.s*1.3); return true; });
  put(sparkM, FX.spark, p => { fxDummy.position.set(p.x, p.y, camU - p.u); fxDummy.rotation.set(0, Math.atan2(p.vx, -p.vu), 0); fxDummy.scale.set(1, 1, 1); return true; });
  put(smokeM, FX.smoke, p => { fxDummy.position.set(p.x, p.y, camU - p.u); fxDummy.rotation.set(0, 0, 0); const k = Math.min(1, p.t/(p.T || 2)); fxDummy.scale.setScalar(p.s*(0.4 + 0.6*k)); return true; });
  put(fireM, FX.fire, p => { fxDummy.position.set(p.x, p.y, camU - p.u); fxDummy.rotation.set(clock*3, clock*2, 0); fxDummy.scale.setScalar(p.s); return true; });
  put(skidM, FX.skid, p => { fxDummy.position.set(p.x, 0.02, camU - p.u); fxDummy.rotation.set(0, (PLR ? PLR.sd : 1) > 0 ? p.ang : -p.ang, 0); fxDummy.scale.set(1, 1, p.l); return true; });
}

// ---------- main sim step ----------
const EXIT_P = {x: 0.13, j: 0.15, r: 0.07};
let mergeReq = [];
function sim(dt){
  const reqs = mergeReq; mergeReq = [];
  lanesOf.clear();
  const reg = (k, v) => { let a = lanesOf.get(k); if (!a) lanesOf.set(k, a = []); a.push(v); };
  emergencyPlan(dt);
  for (const v of vehicles){ if (v.player && !cfg.auto) continue; if (v.esc && Math.abs(v.lx - v.lane) > 0.45) continue; reg(key(v.sd, v.lane), v); }
  if (tow && Math.abs(tow.v.lx - Math.round(tow.v.lx)) < 0.45) reg(key(tow.v.sd, Math.round(tow.v.lx)), tow.v);
  if (PLR && !PLR.rp && !cfg.auto && !tow && vehicles.includes(PLR)) { const v = PLR, z = cfAt(v.sd, v.p);
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
    let {lead, ld} = v.em ? pathLead(v) : gapInfo(v, laneList(v.sd, v.lane));
    for (const r of reqs) if (r.v !== v && r.v.sd === v.sd && r.lane === v.lane) { const g2 = r.v.p - v.p - (r.v.len + v.len)/2; if (g2 > -1 && g2 < 18 && g2 < ld) { ld = Math.max(g2, 0.1); lead = r.v; } }
    const z = cfAt(v.sd, v.p), nearEntry = !!z && v.cfWant && !v.player && v.lane >= 0 && z.CF_IN + 30 - v.p >= 0 && z.CF_IN + 30 - v.p < 260;
    const limU = Math.min(limitAt(uOfV(v)), limitAt(uOfV(v) + v.sd*250));
    let v0 = Math.min(v.player ? limU - 0.6 : Math.min(v.v0, limU + 1), zoneCap(v.sd, front) - (v.player ? 0.6 : 0));
    if (v.em) v0 = Math.min(v.esc === 'sh' ? 22 : v.esc === 'cf' ? 17 : 36, limU + 9);
    else if (v.player && (v.noFuel || tow)) v0 = 0;
    else if (v.lane < 0 || v.lx < 0 || (nearEntry && v.lane === 0)) v0 = Math.min(v0, 16.7);
    if (v.yieldT > clock && (!v.player || cfg.auto)) v0 = Math.min(v0, v.yieldV);
    // angkot stop for passengers at the kerb now and then (ngetem)
    if (v.type === 'angkot' && !v.player) { if (v.ngStop) { if (clock > v.ngStop) { v.ngStop = 0; v.ngT = rnd(25, 60); } }
      else if ((v.ngT -= dt) < 0 && v.lane === n - 1 && !isToll(uOfV(v))) v.ngStop = clock + rnd(4, 10); else if (v.ngT < 0) v.ngT = 5; }
    const pz = plazaAhead(v.sd, front);
    if (pz && v.paid !== pz.s.id) { v0 = Math.min(v0, Math.sqrt(25 + 1.2*Math.max(0, pz.d))); }
    v.v0e = v0;
    if (manual && (foot || tow)) v.acc = tow ? 0 : -v.vel/dt;
    else if (manual) { v.acc = playerAcc(v, dt); steerPlayer(v, dt); }
    else {
      v.acc = idm(v, lead, ld, v0);
      if (pz && v.paid !== pz.s.id) v.acc = Math.min(v.acc, idm(v, STOP, pz.d + 2.0, v0));
      // traffic lights: stop on red, and on amber unless too close to stop safely
      const la = lightAhead(v.sd, front);
      if (la && !v.em) { const st = sigMain(la.s); if (st === 'R' || (st === 'Y' && la.d > Math.max(6, v.vel*v.vel/6))) v.acc = Math.min(v.acc, idm(v, STOP, la.d + 2.2, v0)); }
    }
    if (foot && !manual) { const fd = footBlocks(v, front); if (fd < Infinity) { v.acc = Math.min(v.acc, idm(v, STOP, fd - 2.5, v0)); if (fd < 25 && v.vel < 1 && Math.random() < dt*0.25) horn(v.type, Math.abs(uOfV(v) - foot.u), panOf(v)); } }
    const bd = blockAhead(v.sd, v.lane, front);
    if (!manual && bd < Infinity && !(v.esc && Math.abs(v.lx - v.lane) > 0.45)) v.acc = Math.min(v.acc, idm(v, STOP, bd - 1.5, v0));
    if (v.ngStop) v.acc = Math.min(v.acc, v.vel > 0.2 ? -2.5 : -v.vel/dt);
    // paying at the gate: AI stop right at the line; the player may stop anywhere in the last 9 m as long as nobody is between them and the gate
    const atGate = pz && v.paid !== pz.s.id && Math.abs(v.vel) < 0.6 && (pz.d < 2.5 || (v.player && pz.d < 9 && !laneList(v.sd, v.lane).some(o => o !== v && o.p > v.p && o.p - o.len/2 < v.sd*pz.s.u)));
    if (atGate) { v.payT = (v.payT || 0) + dt; if (v.payT > (v.player ? 0.7 : 1.2)) { v.paid = pz.s.id; v.payT = 0; if (v.player) payToll(pz.s); } } else if (v.player) v.payT = 0;
    if (!manual && v.crashT > clock) { v.acc = v.angry && v.angry.phase === 'pull' ? (v.vel > 0.2 ? -3 : -v.vel/dt) : v.vel > 0.2 ? -6.5 : -v.vel/dt; continue; }
    if (manual || v.esc || v.ngStop || v.yieldT > clock) continue;
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
    // a lane picked by the player: autopilot moves there and holds it for a while
    if (v.player && v.prefLane != null) { if (clock > v.prefT) { v.prefLane = null; hudLane(); }
      else { const tl = clamp(v.prefLane, 0, n - 1); if (tl !== v.lane) { const nl = v.lane + Math.sign(tl - v.lane); v.cd = 0.4; if (tryNormal(v, nl)) { v.lane = nl; hudLane(); } } continue; } }
    if (v.player && cfg.auto && v.lane === 0 && n > 1 && Math.random() < 0.3) { if (tryNormal(v, 1)) { v.lane = 1; continue; } }
    discretionary(v, lead, nearEntry);
  }
  for (const v of vehicles){
    const man = v.player && !cfg.auto;
    if (man) { v.vel = Math.min((VEH[v.type] || VEH.car).vmax, Math.max(-5, v.vel + (v.acc || 0)*dt)); v.p += v.vel*Math.cos(v.hd || 0)*dt; }
    else {
      v.vel = Math.max(0, v.vel + v.acc*dt);
      let step = v.vel*dt;
      const bd = blockAhead(v.sd, v.lane, v.p + v.len/2);
      if (step > bd - 0.5) { step = Math.max(0, bd - 0.5); v.vel = 0; }
      v.p += step;
      if (v.player) { const g = gapInfo(v, laneList(v.sd, v.lane)); if (g.lead && g.ld < 0) { v.p -= Math.min(step, -g.ld + 0.2); if (v.vel - g.lead.vel > 2 && Math.abs(g.lead.lx - g.lead.lane) < 0.05) crash('Tabrakan dari belakang'); v.vel = Math.min(v.vel, g.lead.vel*0.7); } }
      const crossing = (v.lane === -1 && v.lx > -1) || (v.lane === 0 && v.lx < 0);
      const err = (v.esc ? v.escX : v.lane) - v.lx, vmx = v.esc ? 0.9 : crossing ? 0.7 : v.player ? 0.8 : 0.45, want = Math.sign(err)*Math.min(vmx, Math.sqrt(2*0.45*Math.abs(err)));
      v.lvel = (v.lvel || 0) + clamp(want - (v.lvel || 0), -0.75*dt, 0.75*dt);
      v.lx += v.lvel*dt; if (!v.esc && Math.abs(v.lane - v.lx) < 0.01 && Math.abs(v.lvel) < 0.08) { v.lx = v.lane; v.lvel = 0; }
    }
    v.yx = (v.yx || 0) + clamp((v.yxT || 0) - (v.yx || 0), -0.7*dt, 0.7*dt);
    const x = posX(-v.sd, v.lx) - v.sd*v.yx*LW, lat = (x - v.x)/dt, y0 = v.yaw; v.x = x;
    v.yaw += (Math.atan2(lat*Math.sign(v.vel || 1), Math.max(Math.abs(v.vel), 1)) - v.yaw) * Math.min(1, dt*6);
    if (v.player && man) v.yaw = -(v.hd || 0);
    else if (v.crashT > clock && v.spinY) v.yaw = v.spinY; else if (v.spinY) v.spinY = 0;
    bodyMotion(v, wrapA(v.yaw - y0)/dt, dt);
    for (const w of v.wh) w.rotation.x += v.vel*dt / v.r;
  }
  if (PLR && !cfg.auto && !foot && !tow && vehicles.includes(PLR)) { const P = PLR, [lo, hi] = lxBounds(P), hd0 = P.hd || 0; playerCollide(P);
    // a hit never throws the car through the median barrier or the guard rail, and does not spin it right round
    P.lx = clamp(P.lx, lo, hi); P.lane = Math.round(P.lx); P.x = posX(-P.sd, P.lx); P.hd = clamp(P.hd || 0, hd0 - 0.15, hd0 + 0.15); }
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
// vehicles behind the camera are not drawn (bent geometry cannot be frustum-culled), except as far as the mirrors look back
const visZ = () => camMode === 'chase' || camMode === 'cockpit' ? (cfg.mirror !== false && QUAL.level < 4 ? 220 : 40) : 900;
function place(){
  const zb = visZ(), zf = QUAL.level >= 3 ? 600 : 900;
  const ph = (clock*3.2) % 1;
  for (const v of vehicles.concat(rampers)) if (v.lights) { const on = sirenOn(v); v.lights[0].visible = on && ph < 0.5; v.lights[1].visible = on && ph >= 0.5; }
  for (const v of vehicles){ const u = v.sd*v.p, z = camU - u;
    v.g.position.set(v.x, (v.lift || 0) - (v.lowered || 0), z); v.g.rotation.y = (v.sd > 0 ? Math.PI : 0) - v.yaw*v.sd; v.g.visible = z < zb && z > -zf && !(v.player && camMode === 'cockpit' && !foot && !tow);
    // level of detail: far away the wheels are not drawn (hidden under the body at that distance anyway)
    const near = Math.abs(z) < 140 || v.player; if (v.lod !== near) { v.lod = near; for (const w of v.wh) w.visible = near; }
    if (v.g.visible && Math.abs(z) < 300) { v.g.rotation.x = v.pit || 0; v.g.rotation.z = v.rol || 0; for (const w of v.front || []) w.rotation.y = v.stv || 0; } }
  for (const v of rampers){ const q = v.q; if (!q) continue; const rp = v.rp, u = rp.sd*v.p, z = camU - u;
    v.x = -rp.sd*(rp.e + q.o + (v.player ? (v.rpOff || 0)*q.hu : 0)); v.g.position.set(v.x, q.h || 0, z);
    v.g.rotation.y = Math.atan2(-rp.sd*q.ho, -rp.sd*q.hu); v.g.visible = z < zb && z > -zf; v.g.rotation.x = v.pit || 0; v.g.rotation.z = 0; }
  for (const v of locals){ const z = camU - v.u, out = v.dir === v.side; v.g.visible = isToll(v.u) && z < zb && z > -zf;
    v.g.position.set(-v.side*(eAt(v.u) + PRC + (out ? 1 : -1)*(1.75 + v.lane*3.5)), 0, z); v.g.rotation.y = v.dir > 0 ? Math.PI : 0; }
}

// ================================================================
// PLAYER
// ================================================================
const VEH = {car:{label:'Sedan', vmax:52, acc:3.2, gol:'Gol I', rate:1000}, suv:{label:'SUV', vmax:48, acc:2.8, gol:'Gol I', rate:1000},
  bus:{label:'Bus', vmax:33, acc:1.3, gol:'Gol I', rate:1000}, truck:{label:'Truk', vmax:28, acc:0.9, gol:'Gol III', rate:1650},
  pickup:{label:'Pickup', vmax:42, acc:2.4, gol:'Gol I', rate:1000}, taxi:{label:'Taksi', vmax:50, acc:3.1, gol:'Gol I', rate:1000},
  moto:{label:'Motor', vmax:33, acc:3.8, gol:'non-tol', rate:0}, angkot:{label:'Angkot', vmax:31, acc:2.3, gol:'Gol I', rate:1000}, ambulance:{label:'Ambulans', vmax:44, acc:2.6, gol:'Gol I', rate:1000},
  damkar:{label:'Damkar', vmax:31, acc:1.3, gol:'Gol II', rate:1500}, police:{label:'Polisi', vmax:52, acc:3.4, gol:'Gol I', rate:1000}};
const input = {gas:false, brake:false, left:false, right:false};
const stats = {t0: 0, toll: 0, viol: 0, crashes: 0, lastPay: 0, missed: false, done: false, log: []};
let offT = 0, shoulderT = 0, speedT = 0, heavyT = 0, violCd = 0, crashCd = 0, shake = 0;
function spawnPlayer(){
  if (PLR) { const i = vehicles.indexOf(PLR); if (i >= 0) vehicles.splice(i, 1); const j = rampers.indexOf(PLR); if (j >= 0) rampers.splice(j, 1); killVehicle(PLR); }
  const md = MODS(), pc = new THREE.Color(md.paint).getHex(), fixed = ['taxi', 'police', 'ambulance', 'damkar', 'angkot'].includes(cfg.veh);
  const v = makeVehicle(VEH[cfg.veh] ? cfg.veh : 'car', fixed ? null : pc, true); v.player = true; v.paint = fixed ? 0xf4f4f2 : pc; v.dmg = 0; applyMods(v, md);
  const o = EV[0], n = nAvail(1, 0), startP = o.kind === 't' || o.kind === 'g' ? 160 : o.kind === 'k' || o.kind === 'n0' ? 30 : 320;
  Object.assign(v, {sd: 1, lane: Math.max(0, n - 1), p: startP, vel: o.kind === 'k' || o.kind === 'n0' ? 8 : 16, cd: 0, yaw: 0, cfWant: false, v0: limitAt(startP)});
  v.lx = v.lane; v.x = posX(-1, v.lane); v.paid = o.kind === 't' || o.kind === 'g' ? o.id : null;
  scene.add(v.g); vehicles.push(v); PLR = v; camU = startP; sirenUI(); uiNeeds();
}
// ================================================================
// JOBS (mode pekerjaan): ojek online, food delivery, taxi, bus, angkot, freight truck. Stops are marked by the road;
// pull over next to the marker and stop to pick up / drop off. Pay goes to the cash wallet, with a rating for how you drove.
// ================================================================
const JOBS = {
  ojek:   {name: 'Ojek online', veh: 'moto', desc: 'Jemput penumpang di pinggir jalan, antar ke tujuan', pay: 'Rp 9.000 + Rp 2.500/km', base: 9000, perKm: 2500, kind: 'ride', who: 'penumpang'},
  food:   {name: 'Antar makanan', veh: 'moto', desc: 'Ambil pesanan di warung, antar ke pelanggan', pay: 'Rp 10.000 + Rp 2.500/km', base: 10000, perKm: 2500, kind: 'ride', who: 'pesanan'},
  taksi:  {name: 'Sopir taksi', veh: 'taxi', desc: 'Antar penumpang dengan argo', pay: 'Rp 7.500 + Rp 6.500/km', base: 7500, perKm: 6500, kind: 'ride', who: 'penumpang'},
  bus:    {name: 'Sopir bus', veh: 'bus', desc: 'Berhenti di setiap halte: penumpang naik dan turun', pay: 'Rp 8.000 per penumpang', perPax: 8000, kind: 'line', stops: 5, gap: [380, 720]},
  angkot: {name: 'Sopir angkot', veh: 'angkot', desc: 'Banyak penumpang jarak pendek', pay: 'Rp 5.000 per penumpang', perPax: 5000, kind: 'line', stops: 6, gap: [200, 420]},
  truk:   {name: 'Sopir truk ekspedisi', veh: 'truck', desc: 'Muat barang di gudang, antar ke tujuan; muatan rusak dipotong', pay: 'Rp 250.000 + Rp 9.000/km', base: 250000, perKm: 9000, kind: 'ride', who: 'muatan'},
};
let job = null;
// swap the player's vehicle in place (same spot, lane and speed), without rebuilding the world
function swapPlayerVeh(type){
  const old = PLR; if (!old || old.rp || foot || tow) return false;
  const md = MODS(), fixed = ['taxi', 'police', 'ambulance', 'damkar', 'angkot'].includes(type), pc = new THREE.Color(md.paint).getHex();
  const v = makeVehicle(type, fixed ? null : pc, true); v.player = true; v.paint = fixed ? 0xf4f4f2 : pc; v.dmg = 0; applyMods(v, md);
  for (const k of ['sd', 'p', 'lane', 'lx', 'vel', 'hd', 'yaw', 'steer', 'cd', 'paid', 'x', 'v0']) v[k] = old[k];
  const i = vehicles.indexOf(old); if (i >= 0) vehicles[i] = v; else vehicles.push(v); killVehicle(old); scene.add(v.g); PLR = v;
  cfg.veh = type; saveCfg(); RULES.noMbz = !MBZ_OK.has(type); RULES.noToll = type === 'moto'; sirenUI(); uiNeeds(); return true;
}
// a spot by the road from u on: not at a junction, gate, rest area, town crossing or on the MBZ ramps
function jobSpot(u, noToll = cfg.veh === 'moto'){ for (let k = 0; k < 120; k++, u += 40) { const bad = (noToll && isToll(u)) || RSITES.some(s => Math.abs(s.u - u) < 420) || PLAZAS.some(s => Math.abs(s.u - u) < 300) || KSITES.some(s => Math.abs(s.u - u) < 40)
    || mbzHid(u) || mbzGap(u) || (MBZG && MBZG.frame === 'japek' && u > MBZG.F - 60 && u < MBZG.F + 120) || elevAt(u) > 0.5 || onSea(u); if (!bad) return u; } return u; }
function jobStart(k){
  const J = JOBS[k], P = PLR; if (!J || !P || !trip) return;
  if (P.rp || foot || tow) return toast('Kembali ke jalan utama dulu', 'warn');
  const u = uOfV(P), last = EV[EV.length - 1].u;
  if (J.veh === 'moto' && isToll(u)) return toast('Sepeda motor tidak boleh di jalan tol: mulai dari jalan non-tol', 'warn');
  if (k === 'angkot' && isToll(u)) return toast('Angkot tidak beroperasi di jalan tol: mulai dari jalan non-tol', 'warn');
  if (corrAt(u) === 'mbz' && !MBZ_OK.has(J.veh)) return toast('Kendaraan ini tidak boleh di Tol Layang MBZ', 'warn');
  if (cfg.veh !== J.veh && !swapPlayerVeh(J.veh)) return;
  // a motorbike may not use toll roads: the road ahead is planned again without them
  if (J.veh === 'moto') { const i0 = Math.max(0, evAt(u)); if (EV.slice(i0, EV.length - 1).some(e => CORR[e.cNext] && CORR[e.cNext].cls === 't')) { const i = replanIdx(u), e = EV[i];
      if (trip.dest) setNav(trip.dest, true); else if (e) { const tail = walkFree(e.key, prevKeyOf(e), e.c, null, 50, 'mix'); if (tail) replan(i, tail, null); } } }
  const stops = [];
  if (J.kind === 'ride') { const a = jobSpot(u + rnd(350, 700)), b = jobSpot(a + rnd(600, 1500)); stops.push({u: a, kind: 'pick'}, {u: b, kind: 'drop'}); }
  else { let x = u; for (let i = 0; i < J.stops; i++) { x = jobSpot(x + rnd(J.gap[0], J.gap[1])); stops.push({u: x, kind: 'halte', on: 1 + Math.floor(Math.random()*(k === 'bus' ? 9 : 4)), off: 0}); } }
  if (stops[stops.length - 1].u > last - 100) return toast('Rute di depan terlalu pendek untuk pekerjaan ini: pilih tujuan yang lebih jauh', 'warn');
  job = {k, J, stops, i: 0, earned: 0, pax: 0, hold: 0, viol0: stats.viol, crash0: stats.crashes, dmg0: P.dmg || 0, t0: clock};
  $('jobdlg').hidden = true; jobMarker(); jobUI(); toast(`${J.name}: ${jobGoal()}`);
}
function jobStop(){ if (!job) return; if (job.mk) { scene.remove(job.mk); job.mk.traverse(o => o.geometry && o.geometry.dispose()); } job = null; jobUI(); }
const JOB_COL = {pick: 0x2fa84f, drop: 0xec3013, halte: 0x1f5fbf};
// the marker: a glowing post and a waiting person (or a bus-stop shelter) on the verge
function jobMarker(){
  if (job.mk) { scene.remove(job.mk); job.mk.traverse(o => o.geometry && o.geometry.dispose()); job.mk = null; }
  const st = job.stops[job.i]; if (!st) return; const g = new THREE.Group(), col = JOB_COL[st.kind];
  const glow = new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.55}), solidM = M(col);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 9, 12, 1, true), glow); post.position.y = 4.5; g.add(post);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 28), solidM); ring.rotation.x = Math.PI/2; ring.position.y = 0.15; g.add(ring);
  if (st.kind === 'halte') { g.add(solid(3.4, 0.12, 1.6, M(0x1f5fbf), 0, 2.5, 0), solid(0.1, 2.5, 0.1, M(0x8a8f96), -1.6, 1.25, -0.7), solid(0.1, 2.5, 0.1, M(0x8a8f96), 1.6, 1.25, -0.7), solid(3.2, 0.1, 0.5, M(0xc9ccd0), 0, 0.5, -0.5)); }
  const n = st.kind === 'halte' ? Math.min(4, st.on) : 1;
  for (let i = 0; i < n; i++) { const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.8, 4, 8), M([0x2f4f7a, 0x7a2f3a, 0x3a6a3a, 0x6a5a2f][i % 4])), head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), M(0xc58c5c));
    body.position.set(-0.9 + i*0.6, 0.7, 0.2); head.position.set(-0.9 + i*0.6, 1.42, 0.2); g.add(body, head);
    if (st.kind === 'pick' && job.k === 'food') { body.visible = head.visible = false; g.add(solid(1.6, 2.2, 1.4, M(0xd9a24a), 0, 1.1, 0), solid(1.8, 0.2, 1.6, M(0x9a3b2a), 0, 2.3, 0)); }
    if (st.kind === 'pick' && job.k === 'truk') { body.visible = head.visible = false; for (let b = 0; b < 3; b++) g.add(solid(1.1, 1.1, 1.1, M(0xb8894a), -1 + b*1.15, 0.55, 0)); } }
  bendObj(g); scene.add(g); job.mk = g;
}
function placeJob(){ if (!job || !job.mk) return; const st = job.stops[job.i]; if (!st) return; const sd = 1, e = eAt(st.u);
  job.mk.position.set(-sd*(e + (isToll(st.u) ? 4.2 : 3.4)), 0, camU - st.u); job.mk.visible = Math.abs(camU - st.u) < 900; }
function jobGoal(){ if (!job) return ''; const st = job.stops[job.i]; if (!st) return ''; const d = st.u - (PLR.p + PLR.len/2), dk = fmtKm(Math.max(0, d)/1000*cfg.scale);
  if (st.kind === 'pick') return `${job.k === 'food' ? 'Ambil pesanan di warung' : job.k === 'truk' ? 'Muat barang di gudang' : 'Jemput penumpang'} · ${dk}`;
  if (st.kind === 'drop') return `${job.k === 'food' ? 'Antar pesanan' : job.k === 'truk' ? 'Antar muatan' : 'Antar penumpang'} ke tujuan · ${dk}`;
  return `Halte ${job.i + 1}/${job.stops.length} · ${dk} · ${job.pax} penumpang di dalam`; }
function jobUI(){ const c = $('jobcard'); c.hidden = !job; $('jobb').setAttribute('aria-pressed', job ? 'true' : 'false'); if (!job) return;
  $('jc-name').textContent = job.J.name; $('jc-goal').textContent = jobGoal() + (job.hold > 0 ? ' · berhenti…' : ''); $('jc-pay').textContent = `Pendapatan pekerjaan ini ${rp$(job.earned)} · menepi di samping penanda lalu berhenti`; }
function jobStars(){ const s = clamp(5 - (stats.viol - job.viol0) - 2*(stats.crashes - job.crash0), 1, 5); return s; }
function jobTick(dt){
  if (!job || !PLR) return; const P = PLR, st = job.stops[job.i]; if (!st) return jobStop();
  if (P.rp || foot || tow) { job.hold = 0; return; }
  const front = P.p + P.len/2, d = st.u - front, n = nAvail(P.sd, P.p);
  if (d < -150) { toast(job.J.kind === 'line' ? 'Halte terlewat: penumpang menunggu bus berikutnya' : 'Titik terlewat! Putar balik atau batalkan pekerjaan', 'bad'); if (job.J.kind === 'line') { job.i++; jobMarker(); } else { job.stops[job.i].u = jobSpot(front + 400); } return; }
  const there = d > -14 && d < 14 && Math.abs(P.vel) < 1.2 && P.lx > n - 1 - 0.35;
  job.hold = there ? job.hold + dt : 0;
  if (job.hold > 1.0) { job.hold = 0;
    if (st.kind === 'pick') { job.pickU = st.u; toast(job.k === 'food' ? 'Pesanan diambil · antar ke pelanggan' : job.k === 'truk' ? 'Barang dimuat · antar ke tujuan' : 'Penumpang naik · antar ke tujuan'); job.i++; jobMarker(); }
    else if (st.kind === 'drop') { const km = Math.max(0.5, (st.u - job.pickU)/1000*cfg.scale), stars = jobStars();
      let fare = Math.round((job.J.base + job.J.perKm*km)/500)*500;
      if (job.k === 'truk') { const dd = Math.max(0, (P.dmg || 0) - job.dmg0); if (dd > 2) { fare = Math.round(fare*(1 - Math.min(0.6, dd/100))/500)*500; } }
      const tip = stars === 5 && job.k !== 'truk' ? 5000 : 0; job.earned += fare + tip;
      earn(fare + tip, `${job.J.name} · ${fmtKm(km)} · ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}${tip ? ' · tip ' + rp$(tip) : ''}`);
      // next order straight away
      const a = jobSpot(front + rnd(350, 700)), b = jobSpot(a + rnd(600, 1500)); if (b < EV[EV.length - 1].u - 100) { job.stops = [{u: a, kind: 'pick'}, {u: b, kind: 'drop'}]; job.i = 0; job.viol0 = stats.viol; job.crash0 = stats.crashes; job.dmg0 = P.dmg || 0; jobMarker(); setTimeout(() => job && toast(`Order baru: ${jobGoal()}`), 2800); }
      else { toast('Tidak ada order lagi di rute ini · pekerjaan selesai'); jobStop(); return; } }
    else { const off = Math.min(job.pax, 1 + Math.floor(Math.random()*Math.max(1, job.pax))), on = st.on; job.pax = job.pax - off + on;
      const fare = on*job.J.perPax; job.earned += fare; earn(fare, `${job.J.name} · ${off} turun, ${on} naik`); job.i++;
      if (job.i >= job.stops.length) { let x = front; for (let i = 0; i < job.J.stops; i++) { x = jobSpot(x + rnd(job.J.gap[0], job.J.gap[1])); job.stops.push({u: x, kind: 'halte', on: 1 + Math.floor(Math.random()*(job.k === 'bus' ? 9 : 4))}); }
        if (job.stops[job.stops.length - 1].u > EV[EV.length - 1].u - 100) { toast('Trayek selesai'); jobStop(); return; } }
      jobMarker(); } }
  if ((job.uiT = (job.uiT || 0) - dt) < 0) { job.uiT = 0.3; jobUI(); }
}
function openJobs(){
  const L = $('job-list'); L.innerHTML = '';
  for (const [k, J] of Object.entries(JOBS)) { const b = document.createElement('button'), bt = document.createElement('b'), sp = document.createElement('span'), pp = document.createElement('span');
    bt.textContent = J.name; sp.textContent = `${J.desc} · ${VEH[J.veh].label}`; pp.textContent = J.pay; b.append(bt, sp, pp); b.setAttribute('aria-pressed', job && job.k === k ? 'true' : 'false');
    b.onclick = () => { if (job) jobStop(); jobStart(k); }; L.append(b); }
  $('job-stat').textContent = job ? `Sedang bekerja: ${job.J.name} · ${jobGoal()} · pendapatan ${rp$(job.earned)}` : `Pilih pekerjaan. Kendaraan diganti otomatis sesuai pekerjaan. Tunai ${rp$(WAL.cash)}`;
  $('job-stop').hidden = !job; $('jobdlg').hidden = false;
}
const slopeG = v => v.rp ? 0 : 9.81*(v.sd || 1)*gYD(uOfV(v))*Math.cos(v.hd || 0);    // g · grade along the direction of travel
const GEAR_UP = [5.5, 11, 17.5, 25, 33], GEAR_K = [1, 0.8, 0.64, 0.52, 0.43, 0.36];
const gearOf = vel => 1 + GEAR_UP.filter(x => vel >= x).length;
function playerAcc(v, dt){
  if (v.noFuel && !input.brake) { input.gas = false; v.thr = 0; }     // empty tank: the engine has stopped, the car only rolls
  let a = playerAcc0(v, dt);
  // on grass: much more rolling resistance, and the car bumps along
  if (v.offroad && Math.abs(v.vel) > 0.3) { a -= Math.sign(v.vel)*(1.3 + 0.0016*v.vel*v.vel); shake = Math.max(shake, Math.min(0.25, Math.abs(v.vel)*0.012)); }
  if (v.vel >= 0 && v.vel + a*dt < 0 && !(input.brake && input.brakeT > 0.6)) return -v.vel/dt;
  if (v.vel < 0 && v.vel + a*dt > 0 && !input.gas) return -v.vel/dt;
  return a;
}
const muOf = v => (v.offroad ? 0.6 : 1)*(heavy(v) || v.type === 'damkar' ? 0.62 : 0.92)*((WEATHER[cfg.weather] || {}).rain ? 0.68 : 1)*(1 - Math.min(0.25, (v.dmg || 0)*0.0025));
function playerAcc0(v, dt){
  const sp0 = VEH[v.type] || VEH.car, dk = 1 - Math.min(0.6, (v.dmg || 0)*0.006), spec = {...sp0, vmax: sp0.vmax*dk, acc: sp0.acc*dk}, hv = heavy(v) ? 0.6 : 1;
  if ((v.dmg || 0) >= 100) { if (!v.deadT) { v.deadT = clock; toast('Mesin mati: kendaraan rusak berat. Derek dipanggil…', 'bad'); }
    if (clock - v.deadT > 2.5 && !tow) callTow(true);
    return v.vel > 0.05 ? -4 : v.vel < -0.05 ? 4 : -v.vel/dt; }
  v.thr = (v.thr || 0) + clamp((input.gas ? 1 : 0) - (v.thr || 0), -4*dt, 2.5*dt);
  v.brk = input.brake ? Math.min(1, (v.brk || 0) + 3*dt) : 0;
  const g = gearOf(Math.max(0, v.vel)/hv); if (g > (v.gear || 1) && v.thr > 0.2) v.shiftT = 0.28; v.gear = g; v.shiftT = Math.max(0, (v.shiftT || 0) - dt);
  const drag = 0.00042*v.vel*Math.abs(v.vel) + 0.12*Math.sign(v.vel);
  if (input.brake) {
    if (v.vel > 0.3) { input.brakeT = 0; return Math.max(-(1.2 + 7.3*v.brk), -muOf(v)*9.81) - drag; }
    input.brakeT = (input.brakeT || 0) + dt;                        // hold the brake at a standstill to reverse
    return input.brakeT > 0.6 ? (v.vel > -5 ? -1.6 : 0) : -v.vel/dt;
  }
  input.brakeT = 0;
  if (input.gas || v.thr > 0.02) { if (v.vel < -0.2) return 6;
    let a = spec.acc*1.75*GEAR_K[g - 1]*v.thr*(1 - Math.pow(Math.max(0, v.vel)/spec.vmax, 2)); if (v.shiftT > 0) a *= 0.25;
    return a - drag - slopeG(v); }
  const coast = v.vel > 0.05 ? -0.25 - 0.18*Math.min(1, v.vel/8) - drag : v.vel < -0.05 ? 0.8 : -v.vel/dt;   // rolling + engine braking
  return Math.abs(v.vel) > 0.3 ? coast - slopeG(v) : coast;
}
// body pitch under braking / acceleration, roll in turns, and the steered front wheels
function bodyMotion(v, yawRate, dt){
  const k = Math.min(1, dt*5);
  v.pit = (v.pit || 0) + (clamp(-(v.acc || 0)*0.0065, -0.03, 0.05) - (v.pit || 0))*k;
  const rolT = v.type === 'moto' ? clamp(yawRate*Math.abs(v.vel)*0.1, -0.7, 0.7) : clamp(-yawRate*Math.abs(v.vel)*0.011*(heavy(v) ? 1.4 : 1), -0.07, 0.07);   // a motorbike leans into the bend
  v.rol = (v.rol || 0) + (rolT - (v.rol || 0))*k;
  v.stv = v.player && !cfg.auto ? (v.steer || 0) : clamp(-yawRate*wheelbase(v)/Math.max(Math.abs(v.vel), 2), -0.5, 0.5);
}
// is there a gap in the guard rail beside the player (around exits, junctions and rest areas, as drawn in siteEdge)?
function railGap(v){ const i = siteNearIdx(uOfV(v)); if (mbzGap(uOfV(v)) && !mbzSide(uOfV(v))) return true;
  for (const j of [i - 1, i, i + 1]) { const s = RSITES[j]; if (!s) continue; const t = v.p - v.sd*s.u + SC; if (t < 0 || t > 360) continue;
    if ((s.kind === 'j' ? [[10, 352]] : [[10, 80], [285, 352]]).some(([a, b]) => t > a && t < b)) return true; }
  return false; }
// lateral room for the player: guard rail and median barrier on toll roads, buildings in towns; where nothing stops
// the car (a gap in the rail, open country beside a national road) it can leave the road onto the verge and grass
const OFFROAD = 60;
function lxBounds(v){
  const u = uOfV(v), toll = isToll(u), e = eAt(u), c = MED + LW/2, nn = Math.round(nAt(u));
  const inTown = !toll && townNear(u), high = elevAt(u) > 0.5, open = !high && (toll ? railGap(v) : !inTown);
  let hi = open ? (e + (toll ? OFFROAD : 8.6) - c)/LW : toll ? (e + 1.7 - c)/LW : (e + (inTown ? 4.4 : 7.5) - c)/LW, lo = -nn - 0.35;
  const sa = siteAhead(v.sd, v.p);
  if (toll && !open && sa && sa.t > -280 && sa.t < -100) hi += 1.6;
  // already out on the grass beyond the guard rail (or beyond the kerb in town): the barrier now stops the car from the outside
  const wall = toll ? e + 2.8 : e + (inTown ? 4.4 : 8.6), xNow = c + v.lx*LW;
  if (!open && !high && xNow > wall + 0.3) return [(wall + 0.25 + (HW[v.type] || 0.92) - c)/LW, Math.max(v.lx, (e + (toll ? OFFROAD : 8.6) - c)/LW)];          // gap in the guard rail at the exit
  // the median opening is only for a deliberate U-turn (or a contraflow on this side): driving straight you cannot drift across into oncoming traffic
  if (toll) { const z = cfAt(v.sd, v.p), cf = z && z.A === v.sd, atOpen = OPENS.some(o => Math.abs(o.u - u) < OPEN_HW - 4) && (cf || Math.abs(v.hd || 0) > 0.9 || v.lx < -0.5);
    if (!atOpen) { if (v.lx < -0.5) hi = Math.min(hi, -0.71); else lo = -0.29; } }
  // on the MBZ deck: its parapet
  if (toll && mbzSide(u)) hi = Math.min(hi, (MED + 2*LW - (HW[v.type] || 0.92) - c)/LW);
  return [lo, hi];
}
// steering like a real car (bicycle model): the wheel turns gradually, less at speed; the car's heading follows
// from speed, wheelbase and steering angle, limited by tyre grip; the sideways speed is speed × sin(heading)
const wheelbase = v => v.type === 'moto' ? 1.35 : v.type === 'derek' ? 4.4 : heavy(v) ? 6.2 : v.type === 'damkar' ? 4.6 : v.type === 'angkot' ? 2.4 : v.type === 'suv' || v.type === 'van' ? 2.9 : 2.7;
// ---------- the MBZ ramps: taken like an exit on the left; on the deck the world switches from Japek to the MBZ ----------
// travel coordinate (p = sd·u) where the ramps of travel direction sd start: up from Japek to the deck, down from the deck to Japek
function mbzStarts(sd){ const G = MBZG; return sd > 0 ? {up: G.F, down: G.uE} : {up: -G.M, down: -G.uH}; }
// path (o from Japek's edge, metres along, height above this world's road) of a ramp from t0 on; x0: |x| of the car now
function mbzPathFor(sd, kind, x0, t0){
  const G = MBZG, ps = mbzStarts(sd)[kind], pts = [];
  for (let t = t0; t <= G.RL + 0.01; t += 10) { const tt = kind === 'up' ? t : G.RL - t;
    let x = mbzRX(tt, G.RL) + 1.8; if (t - t0 < 40) x = x0 + (x - x0)*sstep(0, 40, t - t0);
    pts.push([x - MBZ_EJ, t, mbzRH(tt, G.RL) - elevAt(sd*(ps + t))]); }
  return pts; }
function toMbzRamp(v, kind){
  const sd = v.sd, ps = mbzStarts(sd)[kind], x0 = Math.abs(v.x ?? posX(-sd, v.lx)), t0 = clamp(v.p - ps, 0, MBZG.RL - 40);
  v.rp = {P: mkPath(mbzPathFor(sd, kind, x0, t0)), d: 0, i: 0, pc: ps, sd, e: MBZ_EJ, shift: 0, end: 'mbz', kind: 'mbz', up: kind === 'up', site: null, mergeAt: Infinity};
  v.rpOff = 0; v.exitWant = false; v.q = pathAt(v.rp.P, 0, 0); v.p = ps + v.q.u;
  rm(vehicles, v); rampers.push(v); if (v.player) hudLane();
}
// end of an MBZ ramp: onto the deck (driving Japek, the world becomes the MBZ's here) or back onto Japek's left lane
function mbzRampEnd(v, rp){
  const G = MBZG, sd = rp.sd, last = rp.P.pts[rp.P.pts.length - 1], p = rp.pc + last[1], x = rp.e + last[0];
  if (v.player && rp.up && G && G.frame === 'japek') { const s = EV[G.si], to = s && MBZ_KEYS.find(k => k !== s.key);
    if (s) seamlessTurn(s, {to, c: 'mbz'}); }
  const n = nAvail(sd, p), lx = clamp((x - (MED + LW/2))/LW, 0, n - 1);
  if (!v.player && !spanFree(sd, Math.round(lx), p - v.len/2 - 3, p + v.len/2 + 3)) { killVehicle(v); return; }
  Object.assign(v, {sd, p, lane: Math.round(lx), lx, rp: null, siteId: null, yaw: 0, hd: 0, steer: 0}); v.x = posX(-sd, v.lx);
  if (v.player) for (const o of [...vehicles]) if (o.sd === sd && o.lane === v.lane && Math.abs(o.p - p) < 30) { rm(vehicles, o); killVehicle(o); }
  vehicles.push(v);
  if (v.player) { camU = uOfV(v); blink(); hudLane(); toast(rp.up ? 'Tol Layang Mohammed bin Zayed' : 'Kembali ke Tol Jakarta–Cikampek'); }
}
// the player at the MBZ: steer off to the left at the fork to go up (autopilot on an MBZ route does it by itself);
// on an MBZ route but kept on Japek, the route carries on along Japek; at the end of the deck every lane goes down
function mbzSwitch(v){
  const G = MBZG; if (!G || v.rp || v.sd !== 1 || v.vel <= 0) return;
  const f = v.p + v.len/2, n = nAvail(1, v.p);
  if (f > G.F - 30 && f < G.F + 70 && Math.abs(v.hd || 0) < 0.4 && (v.lx > n - 1 + 0.6 || (cfg.auto && G.frame === 'mbz'))) {
    if (!mbzOK()) { if (!v.mbzWarn) { v.mbzWarn = true; toast('Kendaraan Anda dilarang masuk Tol Layang MBZ', 'warn'); } return; }
    if (G.frame === 'mbz' || (G.si >= 0 && corrAt(f) === 'japek')) { toMbzRamp(v, 'up'); toast('Ramp naik Tol Layang MBZ'); return; } }
  if (G.frame !== 'mbz') return;
  if (f >= G.F + 70 && f < G.uH) { const s = EV[G.si], o = s && choicesAt(s.key, prevKeyOf(s), 'mix').find(o => o.e.c === 'japek');
    if (o && seamlessTurn(s, o.e)) { hudLane(); toast('Tetap di Tol Jakarta–Cikampek · rute dihitung ulang'); } else toMbzRamp(v, 'up'); return; }
  if (f >= G.uE && f < G.uE + 80) toMbzRamp(v, 'down');
}
// traffic on the MBZ's road: from Japek's left lane some go up the ramp (the rest stay on Japek, drawn below), all come down at the end
function mbzTraffic(){
  const G = MBZG; if (!G || G.frame !== 'mbz') return;
  for (const v of [...vehicles]) { if (v.player) continue; const s = mbzStarts(v.sd), p = v.p;
    if (p >= s.up && p < s.up + 40) { if (v.lane === nAvail(v.sd, p) - 1 && MBZ_OK.has(v.type) && rampers.length < 90) toMbzRamp(v, 'up'); else { rm(vehicles, v); killVehicle(v); } continue; }
    if (p >= s.down && p < s.down + 40) { if (rampers.length < 90) toMbzRamp(v, 'down'); else { rm(vehicles, v); killVehicle(v); } continue; }
    if (mbzHid(v.sd*p)) { rm(vehicles, v); killVehicle(v); } }
}
function mbzHint(v){
  const G = MBZG; if (!G || cfg.auto || !v || v.rp) return ''; const f = v.p + v.len/2;
  if (f > G.F - 800 && f < G.F + 60) { if (G.frame === 'mbz') return 'Ke Tol Layang MBZ: ambil lajur paling kiri, lalu arahkan ke kiri di ramp';
    if (G.si >= 0 && corrAt(f) === 'japek' && mbzOK()) return 'Tol Layang MBZ: ambil lajur paling kiri, lalu arahkan ke kiri di ramp (khusus Gol I)'; }
  if (G.frame === 'mbz' && f > G.uE - 800 && f < G.uE) return 'Tol Layang MBZ berakhir: turun ke Tol Jakarta–Cikampek';
  return '';
}
function steerPlayer(v, dt){
  mbzSwitch(v);
  let st = (input.left ? 1 : 0) - (input.right ? 1 : 0); const spd = Math.abs(v.vel);
  // Setir otomatis: keeps the car centred in its lane (pedals stay yours); steering by hand picks the new lane
  if (cfg.autoSteer) { if (st) v.autoLane = null; else { if (v.autoLane == null) v.autoLane = clamp(Math.round(v.lx), 0, nAvail(v.sd, v.p) - 1);
    const want = clamp((v.autoLane - v.lx)*0.3, -0.12, 0.12), e = want - (v.hd || 0); st = Math.abs(e) > 0.003 ? clamp(e*14, -1, 1) : 0; } }
  // full lock gives at most ~4 m/s² sideways at speed (a firm lane change), but the full 30° when parking
  const maxS = clamp(4.2*wheelbase(v)/Math.max(spd*spd, 1), 0.01, 0.55);
  v.steer = v.steer || 0; v.hd = v.hd || 0;
  const tgt = st*maxS, rate = (st ? 1.6 : 3)*Math.max(maxS, 0.05); v.steer += clamp(tgt - v.steer, -rate*dt, rate*dt);   // ~0.6 s to full lock
  // friction circle: the grip left for cornering is what braking or accelerating does not use
  const aMax = muOf(v)*9.81, aLong = Math.min(Math.abs(v.acc || 0), aMax*0.95), aLat = Math.sqrt(aMax*aMax - aLong*aLong)*(heavy(v) ? 0.75 : 0.85);
  const grip = aLat/Math.max(spd, 1), want = v.vel/wheelbase(v)*Math.tan(v.steer); let yr = clamp(want, -grip, grip);
  v.slide = Math.abs(want) > grip ? Math.min(1, (Math.abs(want) - grip)/grip) : 0;
  // damage pulls the car to one side
  if ((v.dmg || 0) > 20) yr += (v.pull || (v.pull = Math.random() < 0.5 ? -1 : 1))*(v.dmg - 20)*0.00004*spd;
  if (spd > 3 && Math.abs(want) > grip*1.15 && clock - (v.skidT || 0) > 3) { v.skidT = clock; toast('Ban selip! Kurangi setir', 'warn'); }
  v.hd = wrapA(v.hd + yr*dt);
  if (!st && cfg.steerAssist && Math.abs(v.hd) < 0.6) v.hd -= v.hd*Math.min(1, dt*1.1);   // the driver straightens up after a lane change (Asisten setir); a U-turn is left alone
  v.vel -= Math.sign(v.vel)*Math.abs(v.steer)*spd*0.05*dt;                 // tyre scrub in turns
  let lx = v.lx + v.vel*Math.sin(v.hd)/LW*dt;
  const [lo, hi] = lxBounds(v), side = Math.abs(v.vel*Math.sin(v.hd)), fast = Math.abs(v.vel) > 6 && side > 1.2;
  const wallHit = msg => { const a = Math.abs(Math.sin(v.hd)); hitFx(side*1.4, msg, 'side'); v.vel *= 1 - Math.min(0.85, a*1.8); v.hd *= 0.15; v.steer *= 0.3; };
  if (lx > hi) { lx = hi; if (v.hd*Math.sign(v.vel) > 0) wallHit(isToll(uOfV(v)) ? 'Menyerempet pagar pengaman' : townNear(uOfV(v)) ? 'Menabrak bangunan di tepi jalan' : 'Masuk parit di tepi jalan'); }
  if (lx < lo) { lx = lo; if (v.hd*Math.sign(v.vel) < 0) wallHit(isToll(uOfV(v)) ? 'Menyerempet median beton' : 'Keluar badan jalan'); }
  v.lx = lx; v.lane = Math.round(lx);
  { const n0 = nAvail(v.sd, v.p), was = v.offroad; v.offroad = !v.rp && lx > n0 - 1 + (2.9 + LW/2)/LW;
    if (v.offroad && !was && clock - (v.offT || -9) > 4) { v.offT = clock; toast('Keluar dari jalan: rumput, laju berkurang', 'warn'); } }
  if (Math.abs(v.hd) > 2.3 && lx < -0.7 && Math.abs(v.vel) > 0.3 && clock - (v.uT || 0) > 2) { v.uT = clock; v.wantU = true; }   // done at the start of the next tick
  if (Math.abs(v.hd) > 1) return;      // turning around: no ramps or turns
  // leaving the road on the left: exit ramp, rest area, detour or turn at an intersection
  const n = nAvail(v.sd, v.p), front = v.p + v.len/2;
  if (lx > n - 1 + 0.65 && v.vel > 0) {
    const sa = siteAhead(v.sd, v.p);
    if (sa && sa.t > -250 && sa.t < -110 && lx < n - 1 + 1.6 && Math.abs(v.hd) < 0.32) { toRamp(v, sa.s, sa.s.kind); toast(sa.s.kind === 'r' ? `Masuk ${sa.s.name}` : sa.s.kind === 'j' ? `Masuk ramp ${nodeLabel(sa.s)}` : `Keluar di ${sa.s.name}`); hudLane(); return; }
    const ow = CFA.find(z => z.oneWay && z.B === v.sd && v.p - z.bStart > -330 && v.p - z.bStart < -40);
    if (ow) { toDetour(v, ow); toast('Pengalihan lewat Jalan Nasional'); hudLane(); return; }
    const ks = KSITES.find(k => { const d = v.sd*k.u - SL - front; return d > -4 && d < 25; });
    if (ks && lx > n - 1 + 1.1) { const le = leftEdge(ks);
      if (!le) { v.lx = n - 1 + 0.6; toast('Tidak ada jalan ke kiri di simpang ini', 'warn'); return; }
      if (sigMain(ks) === 'R' && !sirenOn(v)) violation('menerobos lampu merah');
      if (ks.i === trip.destIdx) { stats.done = true; v.vel = 0; arrive(ks, le); } else if (!seamlessLeft(v, ks, le)) continueFrom(ks, le); }
  }
}
const HW = {taxi:0.92, derek:1.15, pickup:0.95, moto:0.4, car:0.92, suv:0.98, van:1.0, police:0.92, truck:1.25, bus:1.25, angkot:0.85, ambulance:1.0, damkar:1.25};
// masses (kg) for collisions: momentum is shared, a small restitution bounces the cars apart
const MASS = {taxi: 1300, derek: 8000, pickup: 1750, moto: 220, car: 1300, suv: 1850, van: 2100, police: 1500, bus: 11000, truck: 15000, angkot: 1150, ambulance: 2700, damkar: 13000};
const RESTI = 0.04;
function impact1D(v1, m1, v2, m2){ const P = m1*v1 + m2*v2, Mt = m1 + m2; return [(P + m2*RESTI*(v2 - v1))/Mt, (P + m1*RESTI*(v1 - v2))/Mt]; }
function hitAI(o, dv, side){ o.crashT = clock + Math.min(25, 5 + dv*1.2); if (dv > 3) startAngry(o, dv); if (dv > 8) o.spinY = (side || (Math.random() < 0.5 ? 1 : -1))*Math.min(0.3, dv*0.015); }
function hitFx(dv, msg, where = 'front', o = null){
  if (dv > 1.5) crash(dv > 14 ? msg + ' (parah)' : msg);
  const v = PLR, u = v.rp ? v.rp.sd*v.p : uOfV(v), sd = v.rp ? v.rp.sd : v.sd, fw = Math.sign(v.vel || 1)*sd;
  const pu = where === 'side' ? u : u + (where === 'back' ? -fw : fw)*v.len*0.5, px = where === 'side' && o ? (v.x + o.x)/2 : v.x, py = v.rp ? (v.q.h || 0) : 0;
  if (dv > 0.8 && clock - (hitFx.t || -9) > 0.25) { hitFx.t = clock; crashSound(dv); crashFx(pu, px, py, dv, v.paint, where === 'back' ? -fw*0.3 : fw*0.3); damage(v, dv, where); if (o) damage(o, dv*(MASS[v.type] || 1300)/(MASS[o.type] || 1300), where); }
  else if (dv > 0.2) scrapeFx(u, v.x, py, 1);
  shake = Math.max(shake, Math.min(1.6, dv*0.08)); }
// collisions from real positions, so side swipes, rear-ends and head-ons all count
// heading of a vehicle in world (x, u) terms, for oriented collision tests
function headW(o){
  if (o.rp && o.q) { const sd = o.rp.sd; return [-sd*(o.q.ho || 0), sd*(o.q.hu || 1)]; }
  const sd = o.sd || 1, hd = o.player ? (o.hd || 0) : 0; return [-sd*Math.sin(hd), sd*Math.cos(hd)];
}
function playerCollide(v){
  const onRamp = !!v.rp, uP = onRamp ? v.rp.sd*v.p : uOfV(v), hP = onRamp ? (v.q.h || 0) : 0, hwP = HW[v.type] || 1;
  const fwd = Math.sign((onRamp ? v.rp.sd : v.sd)*(v.vel || 1));
  const pushBack = d => { if (onRamp) { v.rp.d = Math.max(0, v.rp.d - d); v.q = pathAt(v.rp.P, v.rp.d, v.rp.i); v.p = v.rp.pc + v.q.u - v.rp.shift; } else v.p -= v.sd*fwd*d; };
  // other vehicles, on the main road and on ramps
  for (const o of vehicles.concat(rampers)) { if (o === v || o.x == null) continue;
    const ou = o.rp ? o.rp.sd*o.p : o.sd*o.p, oh = o.rp ? (o.q && o.q.h) || 0 : 0;
    const du = ou - uP; if (Math.abs(du) > 25 || Math.abs(oh - hP) > 2.5) continue;
    const dx = o.x - v.x, px = hwP + (HW[o.type] || 1) - Math.abs(dx), pu = (v.len + o.len)/2 - Math.abs(du);
    // on ramps and stem roads vehicles point every which way: test the two boxes in the player's own heading frame
    if (onRamp || o.rp) { const hA = headW(v), hB = headW(o), hwO = HW[o.type] || 1, al = dx*hA[0] + du*hA[1], la = dx*hA[1] - du*hA[0];
      const c = Math.abs(hA[0]*hB[0] + hA[1]*hB[1]), sn = Math.sqrt(Math.max(0, 1 - c*c)), extA = v.len/2 + o.len/2*c + hwO*sn, extL = hwP + hwO*c + o.len/2*sn;
      if (Math.abs(al) >= extA - 0.1 || Math.abs(la) >= extL - 0.1) continue;
      const ahead = al*Math.sign(v.vel || 1) > 0; if (!ahead) continue;
      const vo = Math.max(0, o.vel*(hA[0]*hB[0] + hA[1]*hB[1])*Math.sign(v.vel || 1)), closing = Math.abs(v.vel) - vo;
      pushBack(extA - Math.abs(al) + 0.05);
      if (closing > 0) { const [a1] = impact1D(Math.abs(v.vel), MASS[v.type] || 1300, vo, MASS[o.type] || 1300), a2 = closing < 3 ? Math.min(Math.abs(v.vel), vo) : a1, dv = Math.abs(a2 - Math.abs(v.vel));
        v.vel = Math.sign(v.vel || 1)*a2; hitFx(dv, 'Tabrakan dari belakang', 'front', o); }
      continue; }
    if (px <= 0 || pu <= 0) continue;
    const osd = o.rp ? o.rp.sd : o.sd, vsd = onRamp ? v.rp.sd : v.sd, mP = MASS[v.type] || 1300, mO = MASS[o.type] || 1300;
    if (!onRamp && px < pu*0.6) {
      // side swipe: separate, trade sideways momentum, both lose speed by friction, the lighter car is knocked off line
      const side = Math.sign(-dx || 1); v.lx += side*(px + 0.05)/(-v.sd*LW); v.lane = Math.round(v.lx); v.x = posX(-v.sd, v.lx);
      const latV = Math.abs(v.vel*Math.sin(v.hd || 0)) + Math.abs(v.vel - (osd === vsd ? o.vel : -o.vel))*0.15, share = mO/(mP + mO);
      v.hd = (v.hd || 0)*(1 - 0.6*share); v.vel *= 1 - 0.05*share - 0.01;
      if (!o.player && !o.rp) { o.vel *= 0.95; if (latV > 2) hitAI(o, latV*2, -side); }
      hitFx(latV*1.5, 'Tabrakan samping', 'side', o);
    } else {
      // frontal / rear-end / head-on: 1D impact along the road with both masses
      const vo = osd === vsd ? o.vel : -o.vel, ahead = du*vsd > 0, closing = ahead ? v.vel - vo : vo - v.vel;
      if (ahead) pushBack(pu + 0.05); else if (!onRamp) v.p += pu + 0.05;
      if (closing > 0) { const [a0, b] = impact1D(v.vel, mP, vo, mO), a = closing < 3 ? Math.min(v.vel, vo + 0.0) : a0, dv = Math.abs(a - v.vel);
        v.vel = ahead ? a : Math.max(v.vel, a); const off = clamp(dx/(hwP + (HW[o.type] || 1)), -1, 1); if (dv > 10) v.hd = (v.hd || 0) - off*Math.min(0.12, dv*0.006);
        if (!o.player && !o.rp) { o.vel = Math.max(0, osd === vsd ? b : -b); hitAI(o, Math.abs(b - vo)*1.2 + dv*0.3, off > 0 ? 1 : -1); }
        hitFx(dv, osd !== vsd ? 'Tabrakan adu banteng!' : ahead ? 'Tabrakan dari belakang' : 'Ditabrak dari belakang', ahead ? 'front' : 'back', o); } } }
  if (onRamp) return;
  // cross-street traffic at intersections
  for (const [o, gs] of built) { if (o.type !== 'site' || o.s.kind !== 'k') continue; const s2 = o.s; if (Math.abs(s2.u - uP) > 40) continue;
    for (const g of gs) if (g.userData.cross) for (const c of g.userData.cross) {
      const cu = s2.u - c.g.position.z, cx = c.g.position.x, px = hwP + c.len/2 - Math.abs(cx - v.x), pu = v.len/2 + (HW[c.type] || 1) - Math.abs(cu - uP);
      if (px > 0 && pu > 0) { const [a] = impact1D(v.vel, MASS[v.type] || 1300, 0, MASS[c.type] || 1300), dv = Math.abs(a - v.vel); hitFx(dv + c.vel*0.5, 'Tabrakan di persimpangan', 'front', c.g ? c : null);
        pushBack(pu + 0.05); v.vel = Math.max(0, a*0.5); c.vel = 0; c.hold = 4; } } }
  // solid objects: plaza islands, works vehicles and barriers, poles
  for (const so of SOLIDS) { if (so.u1 < uP - 30 || so.u0 > uP + 30) continue;
    const pu = Math.min(uP + v.len/2, so.u1) - Math.max(uP - v.len/2, so.u0), px = Math.min(v.x + hwP, so.x1) - Math.max(v.x - hwP, so.x0);
    if (pu <= 0 || px <= 0) continue;
    if (px < pu*0.5) { const dirx = v.x > (so.x0 + so.x1)/2 ? 1 : -1, latV = Math.abs(v.vel*Math.sin(v.hd || 0));
      // scraping along it: pushed clear, a little friction, the nose turned away; only a real hit counts as a crash
      v.lx += dirx*(px + 0.05)/(-v.sd*LW); v.lane = Math.round(v.lx); v.x = posX(-v.sd, v.lx);
      if (latV > 0.3) { v.vel *= 1 - Math.min(0.3, latV*0.06); v.hd = (v.hd || 0)*0.15; } hitFx(latV*1.3, so.name, 'side'); }
    else { const dv = Math.abs(v.vel); pushBack(pu + 0.05); v.vel = 0; hitFx(dv, so.name); } }
}
function crash(msg){ if (crashCd > 0) return; crashCd = 3; stats.crashes++; shake = 0.6; toast(msg, 'bad'); stats.log.push(msg); }
const violAt = new Map();
function violation(msg){ const k = msg.split(' ')[0] + msg.length; if (clock - (violAt.get(k) ?? -99) < 10) return; violAt.set(k, clock); stats.viol++; toast('Pelanggaran: ' + msg, 'bad'); stats.log.push(msg); }
function payToll(s){
  tone({fs: [1850], type: 'sine', dur: 0.12, gain: 0.07}); tone({fs: [2350], type: 'sine', dur: 0.16, gain: 0.07, at: 0.14});
  if (s.kind === 'ti') { stats.lastPay = rkAt(PLR.sd*PLR.p); toast(`Tap masuk ${nodeLabel(s)}`); return; }
  const rk = rkAt(PLR.sd*PLR.p), km = Math.max(0, rk - stats.lastPay), rp = Math.max(500, Math.round(km*(VEH[cfg.veh] || VEH.car).rate/500)*500);
  stats.lastPay = rk; stats.toll += rp; WAL.etoll -= rp;
  toast(`Tap e-Toll ${nodeLabel(s)} · Rp ${rp.toLocaleString('id-ID')} · sisa saldo ${rp$(WAL.etoll)}`);
  if (WAL.etoll < 0) setTimeout(() => toast('Saldo e-Toll minus! Isi ulang di minimarket rest area', 'bad'), 1600);
  if ((s.kind === 't' || s.kind === 'te') && s.i === trip.destIdx) { stats.done = true; setTimeout(() => arrive(s), 1200); }
}
function playerRules(dt){
  const v = PLR; if (!v || v.rp || foot || tow) return;
  if (cfg.auto) mbzSwitch(v);
  violCd -= dt; crashCd -= dt;
  const lim = Math.min(limitAt(uOfV(v)), postedCap(v.sd, v.p + v.len/2), v.lane < 0 ? 16.7 : 99);
  speedT = Math.abs(v.vel) > lim + 1.4 && !sirenOn(v) ? speedT + dt : 0;
  if (speedT > 2.5) { violation(`melebihi batas ${KMH(lim)} km/j`); speedT = 0; }
  const n = nAvail(v.sd, v.p);
  heavyT = heavy(v) && v.lane >= 0 && v.lane < heavyMin(n) ? heavyT + dt : 0;
  if (heavyT > 5) { violation('kendaraan berat wajib di lajur kiri'); heavyT = 0; }
  const pz = plazaAhead(v.sd, v.p + v.len/2);
  if (!pz) for (const s of PLAZAS) { const d = v.sd*s.u - (v.p + v.len/2); if (d < -2 && d > -40 && v.paid !== s.id) { v.paid = s.id; violation('menerobos gerbang tol'); if ((s.kind === 't' || s.kind === 'te') && s.i === trip.destIdx) { stats.done = true; setTimeout(() => arrive(s), 1200); } } }
  const front = v.p + v.len/2;
  if (!cfg.auto) {
    const z = cfAt(v.sd, v.p), legitCf = z && z.A === v.sd && v.lane < 0 && -v.lane <= z.k;
    if (v.lx < -0.5 && !legitCf && !sirenOn(v) && Math.abs(v.hd || 0) < Math.PI/2) violation('melawan arus');
    if (v.lx > -0.5 && Math.abs(v.hd || 0) > 2 && Math.abs(v.vel) > 3) violation('melawan arus');
    if (v.lx > n - 1 + 1.3) { offT += dt; if (offT > 1 && !v.offV) { v.offV = true; violation('keluar badan jalan'); } } else { offT = 0; v.offV = false; }
    if (v.lx > n - 1 + 0.5 && v.lx <= n - 1 + 1.3 && !siteAhead(v.sd, v.p) && !sirenOn(v)) { shoulderT += dt; if (shoulderT > 2) { violation('berkendara di bahu jalan'); shoulderT = 0; } } else shoulderT = 0;
    if (isToll(uOfV(v)) && v.lx < -0.4 && v.lx > -0.8 && !(z && z.A === v.sd)) violation('melintasi putaran balik khusus petugas');
    const inBlock = v.lane >= 0 && v.lane < n && blockAhead(v.sd, v.lane, front, mbzOK()) === 0;
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
// ---------- game clock: morning, noon, afternoon, evening and night follow the in-game hour ----------
const TODK = {
  dawn: {sky:0xc9a49a, fog:[110,470], hemi:0.6, sun:1.3, sunCol:0xffb07a, head:1.6, tail:1.2, lamp:1.0, bloom:0.45, exp:1.0, sign:0.3},
  morning: {sky:0xc2d2dc, fog:[180,600], hemi:0.95, sun:2.1, sunCol:0xffe8c8, head:0.15, tail:0.3, lamp:0, bloom:0.18, exp:1.0, sign:0.12},
  afternoon: {sky:0xc9c5b4, fog:[180,600], hemi:0.95, sun:2.2, sunCol:0xffd9a4, head:0.15, tail:0.3, lamp:0, bloom:0.2, exp:1.0, sign:0.12},
};
// [hour, preset]; between two keys the light is blended
const TOD_KEYS = [[0, 'night'], [4.7, 'night'], [5.6, 'dawn'], [6.7, 'morning'], [9, 'day'], [15, 'day'], [16.5, 'afternoon'], [17.6, 'dusk'], [18.6, 'dusk'], [19.4, 'night'], [24, 'night']];
const TOD_NAME = h => h < 4 ? 'Dini hari' : h < 10 ? 'Pagi' : h < 15 ? 'Siang' : h < 18.5 ? 'Sore' : 'Malam';
const TOD_JUMP = {day: 12, dusk: 17.8, night: 21, morning: 7, dawn: 5.8};
let gameH = cfg.gh ?? 7.5, todT = 0, lastSign = -1;
const cA = new THREE.Color(), cB = new THREE.Color();
function todAt(h){
  const P = k => TODK[k] || TOD[k];
  let j = 0; while (j < TOD_KEYS.length - 2 && TOD_KEYS[j + 1][0] <= h) j++;
  const [h0, k0] = TOD_KEYS[j], [h1, k1] = TOD_KEYS[j + 1], f = clamp((h - h0)/((h1 - h0) || 1), 0, 1), a = P(k0), b = P(k1), L = (x, y) => x + (y - x)*f;
  const col = (x, y) => cA.set(x).lerp(cB.set(y), f).getHex();
  const t = {sky: col(a.sky, b.sky), fog: [L(a.fog[0], b.fog[0]), L(a.fog[1], b.fog[1])], sunCol: col(a.sunCol, b.sunCol)};
  for (const k of ['hemi', 'sun', 'head', 'tail', 'lamp', 'bloom', 'exp', 'sign']) t[k] = L(a[k], b[k]);
  // the sun rises in the east around 05:45 and sets around 18:00 (near the equator); the moon lights the night
  const e = Math.sin(Math.PI*(h - 5.9)/12.2);
  if (e > 0.02) { const az = Math.PI*(h - 5.9)/12.2; t.sunPos = [Math.cos(az)*150, 25 + e*110, 50]; }
  else t.sunPos = [40, 90, 60];
  t.night = clamp(t.lamp/4, 0, 1);
  return t;
}
const WEATHER = {cerah: {cloud: 0.3, fog: 1, sun: 1, grey: 0}, berawan: {cloud: 0.66, fog: 0.85, sun: 0.5, grey: 0.35},
  hujan: {cloud: 0.95, fog: 0.5, sun: 0.22, grey: 0.6, rain: true}, kabut: {cloud: 0.55, fog: 0.28, sun: 0.55, grey: 0.45}};
function applyTod(t){
  const W = WEATHER[cfg.weather] || WEATHER.cerah, far = (VIEWX ? 1.9 : 1)*W.fog;
  t.sky = cA.set(t.sky).lerp(cB.set(0x8d969c).multiplyScalar(1 - 0.8*t.night), W.grey).getHex();
  scene.background.set(t.sky); scene.fog.color.set(t.sky); scene.fog.near = t.fog[0]*Math.min(1, W.fog*1.2); scene.fog.far = t.fog[1]*far;
  skyU.hor.value.set(t.sky); skyU.top.value.set(t.sky).lerp(cB.set(t.night > 0.5 ? 0x03060d : 0x3f78bf), 0.5*(1 - W.grey*0.8));
  skyU.sunDir.value.copy(sunOff).normalize(); skyU.sunCol.value.set(t.sunCol).multiplyScalar((1 - t.night)*W.sun);
  skyU.cloud.value = W.cloud; skyU.night.value = t.night; skyU.cloudCol.value.set(0xffffff).lerp(cB.set(t.sky), 0.35 + W.grey*0.5).multiplyScalar(1 - 0.85*t.night);
  asphalt.roughness = W.rain ? 0.3 : 0.95; asphalt.color.set(W.rain ? 0x2b2d30 : 0x3b3d40);
  hemi.intensity = t.hemi*(0.75 + 0.25*W.sun); sun.intensity = t.sun*W.sun; sun.color.set(t.sunCol); sunOff.set(...t.sunPos);
  headK = clamp((t.head - 0.15)/4.85, 0, 1); headMat.emissiveIntensity = t.head*1.2; tailMat.emissiveIntensity = t.tail; lampHeadMat.emissiveIntensity = t.lamp; lampI = t.lamp*60;
  bloom.strength = MOBILE ? t.bloom*0.7 : t.bloom; renderer.toneMappingExposure = t.exp;
  signI = t.sign; if (Math.abs(signI - lastSign) > 0.02) { lastSign = signI; applySign(); }
  ground.material.color.set(cA.set(0x6f8a4a).lerp(cB.set(0x2c3a24), t.night));
}
const hhmm = h => { const m = Math.floor(mod(h, 24)*60); return `${String(Math.floor(m/60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
// sky dome: gradient, sun, drifting clouds (cover follows the weather) and stars at night
const skyU = {top: {value: new THREE.Color()}, hor: {value: new THREE.Color()}, sunDir: {value: new THREE.Vector3(0, 1, 0)}, sunCol: {value: new THREE.Color()},
  cloud: {value: 0.3}, night: {value: 0}, time: {value: 0}, cloudCol: {value: new THREE.Color()}};
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(2200, 32, 16), new THREE.ShaderMaterial({uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top, hor, sunCol, cloudCol, sunDir; uniform float cloud, night, time; varying vec3 vD;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a*n(p); p *= 2.03; a *= 0.5; } return s; }
    void main(){ vec3 d = normalize(vD); float y = max(d.y, 0.0);
      vec3 col = mix(hor, top, pow(y, 0.5));
      float sd = max(dot(d, normalize(sunDir)), 0.0);
      col += sunCol*(pow(sd, 1200.0)*5.0*(1.0 - cloud*0.85) + pow(sd, 10.0)*0.22);
      if (night > 0.05 && d.y > 0.02) { vec2 sp = floor(d.xz/(d.y + 0.3)*420.0); col += vec3(step(0.9972, h(sp))*night*(1.0 - cloud)); }
      if (d.y > 0.0) { vec2 cp = d.xz/(d.y + 0.15)*1.7 + vec2(time*0.012, time*0.005);
        float cov = smoothstep(1.05 - cloud, 1.25 - cloud*0.6, fbm(cp))*smoothstep(0.0, 0.1, d.y); col = mix(col, cloudCol, cov*0.92); }
      else col = hor;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`}));
skyDome.renderOrder = -2; skyDome.frustumCulled = false; scene.add(skyDome);
// rain: streaks falling around the camera
const RAIN_N = MOBILE ? 700 : 1800, rainPos = new Float32Array(RAIN_N*6), rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({color: 0xd5dee8, transparent: true, opacity: 0.7, fog: false}));
rain.frustumCulled = false; rain.visible = false; scene.add(rain);
for (let i = 0; i < RAIN_N; i++) { rainPos[i*6] = rnd(-35, 35); rainPos[i*6 + 1] = rnd(0, 26); rainPos[i*6 + 2] = rnd(-60, 15); }
function updateSky(dt){
  skyDome.position.copy(camera.position); skyU.time.value += dt;
  const on = !!(WEATHER[cfg.weather] || {}).rain; rain.visible = on; if (!on) return;
  const fall = 22*dt, v = PLR ? Math.max(0, PLR.vel)*dt : 0;
  for (let i = 0; i < RAIN_N; i++) { const k = i*6; let y = rainPos[k + 1] - fall, z = rainPos[k + 2] + v;
    if (y < 0) { y += 26; rainPos[k] = rnd(-35, 35); } if (z > 15) z -= 75;
    rainPos[k + 1] = y; rainPos[k + 2] = z; rainPos[k + 3] = rainPos[k] + 0.05; rainPos[k + 4] = y + 0.9; rainPos[k + 5] = z - 0.25 - v*0.6; }
  rainGeo.attributes.position.needsUpdate = true; rain.position.set(camera.position.x, camera.position.y - 6, camera.position.z);
}
function setRoadStyle(){ const k = {data: [1, 0, 0], kelok: [1.25, 16, 9], lurus: [0.35, 0, 0]}[cfg.roadStyle] || [1, 0, 0]; CU.uX.value.set(...k); }
function setView(){ VIEWX = cfg.view === 'jauh' ? 900 : 0; }
function setClean(){ document.body.classList.toggle('clean', !!cfg.clean); $('hudb').setAttribute('aria-pressed', cfg.clean ? 'true' : 'false'); }

// ---------- sound: engine (rpm from speed and gear), wind, tyres and traffic, weather (rain, thunder), ambience
// (city hum, birds by day, crickets at night), horns that react to jams, sirens with Doppler, crashes and toll beeps.
// Everything starts on the first tap or key press (browsers block audio before that).
let AC = null, snd = null, sndT = 0, hornCd = 0, thunderT = 18, chirpT = 0;
// a short coin chime when money comes in
function sfxCoin(){ if (!AC || !snd) return; const t = AC.currentTime;
  for (const [f, d] of [[988, 0], [1319, 0.09]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35); o.connect(g); g.connect(snd.master); o.start(t + d); o.stop(t + d + 0.4); } }
function audioStart(){
  if (AC || !cfg.sound) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
  const eng = AC.createOscillator(), eng2 = AC.createOscillator(), lp = AC.createBiquadFilter(), eg = AC.createGain();
  eng.type = 'sawtooth'; eng2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = 700; eg.gain.value = 0;
  eng.connect(lp); eng2.connect(lp); lp.connect(eg); eg.connect(master); eng.start(); eng2.start();
  const buf = AC.createBuffer(1, AC.sampleRate*2, AC.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;
  const mk = (f, q, type = 'bandpass') => { const src = AC.createBufferSource(); src.buffer = buf; src.loop = true; const bp = AC.createBiquadFilter(); bp.type = type; bp.frequency.value = f; bp.Q.value = q;
    const g = AC.createGain(); g.gain.value = 0; src.connect(bp); bp.connect(g); g.connect(master); src.start(); return g; };
  // two siren voices (the two nearest emergency vehicles), each panned left/right
  const voice = () => { const o = AC.createOscillator(), g = AC.createGain(), p = AC.createStereoPanner ? AC.createStereoPanner() : AC.createGain(); o.type = 'triangle'; g.gain.value = 0; o.connect(g); g.connect(p); p.connect(master); o.start(); return {o, g, p}; };
  snd = {master, eng, eng2, lp, eg, buf, wind: mk(500, 0.6), rain: mk(2500, 0.4), rainLo: mk(700, 0.5), tyre: mk(260, 0.7), traffic: mk(180, 0.6), hum: mk(90, 0.8, 'lowpass'), sir: [voice(), voice()]};
}
const panOf = o => { if (!PLR || o.x == null) return 0; return clamp((o.x - PLR.x)/22*(PLR.sd || 1), -1, 1); };
const attOf = dist => Math.pow(clamp(1 - dist/260, 0, 1), 1.6);
function sndOut(g, pan){ if (!AC.createStereoPanner) { g.connect(snd.master); return; } const p = AC.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(snd.master); }
// a tone burst (horn, beep, chirp): several partials through a low-pass, with a short attack and release
function tone({fs, type = 'square', dur = 0.3, gain = 0.1, pan = 0, lp = 2400, at = 0, sweep = 1}){
  if (!snd || gain < 0.003) return; const t = AC.currentTime + at, g = AC.createGain(), f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.015); g.gain.setValueAtTime(gain, t + dur - 0.04); g.gain.linearRampToValueAtTime(0, t + dur);
  f.connect(g); sndOut(g, pan);
  for (const fr of fs) { const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(fr, t); if (sweep !== 1) o.frequency.exponentialRampToValueAtTime(fr*sweep, t + dur); o.connect(f); o.start(t); o.stop(t + dur + 0.05); }
}
// a noise burst (crash, thunder)
function noise({gain = 0.3, lp = 1200, dur = 0.5, pan = 0, at = 0}){
  if (!snd) return; const t = AC.currentTime + at, src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); src.buffer = snd.buf; f.type = 'lowpass'; f.frequency.value = lp;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); sndOut(g, pan); src.start(t, Math.random()); src.stop(t + dur + 0.1);
}
// horns: a car's two-tone horn, a deep air horn on trucks and buses, a thin beep on motorbikes; impatient drivers tap twice or lean on it
function horn(type, dist = 0, pan = 0, mood = Math.random()){
  const g = 0.16*attOf(dist), fs = type === 'truck' || type === 'bus' || type === 'damkar' ? [233, 294, 349] : type === 'moto' ? [620, 740] : type === 'angkot' ? [470, 560] : [415, 523];
  const lp = 1400 + 1200*attOf(dist);
  if (mood < 0.45) tone({fs, dur: 0.22, gain: g, pan, lp});
  else if (mood < 0.8) { tone({fs, dur: 0.14, gain: g, pan, lp}); tone({fs, dur: 0.18, gain: g, pan, lp, at: 0.22}); }
  else tone({fs, dur: 0.9 + Math.random()*0.6, gain: g*0.9, pan, lp});
}
function crashSound(dv){ if (!snd) return; noise({gain: Math.min(0.6, 0.12 + dv*0.025), lp: 900 + dv*60, dur: 0.35 + Math.min(0.6, dv*0.03)}); tone({fs: [180, 260], type: 'sawtooth', dur: 0.12, gain: Math.min(0.15, dv*0.01), lp: 900}); }
function thunder(){ const far = Math.random(); noise({gain: 0.5 - far*0.3, lp: 160 + (1 - far)*200, dur: 3 + far*2, at: 0.3 + far*2});
  hemi.intensity *= 3; setTimeout(() => { hemi.intensity /= 3; }, 110); setTimeout(() => { hemi.intensity *= 2; setTimeout(() => { hemi.intensity /= 2; }, 70); }, 230); }
function updateSound(){
  if (!snd) return; const t = AC.currentTime, v = PLR ? Math.abs(PLR.vel) : 0, hv = PLR && heavy(PLR) ? 0.6 : 1;
  const dt = Math.min(0.1, clock - sndT); sndT = clock;
  snd.master.gain.setTargetAtTime(cfg.sound && $('plan').hidden ? (music.on ? 0.22 : 0.5) : 0, t, 0.1);   // game sound ducks under the music
  const g = gearOf(v/hv), lo = g > 1 ? GEAR_UP[g - 2]*hv : 0, hi = (GEAR_UP[g - 1] || 45)*hv, rpm = 850 + clamp((v - lo)/(hi - lo), 0, 1)*4200*(g === 1 ? 1 : 0.75) + (input.gas ? 300 : 0);
  const f = rpm/60*(heavy(PLR || {}) ? 1.5 : 2);
  snd.eng.frequency.setTargetAtTime(f, t, 0.05); snd.eng2.frequency.setTargetAtTime(f*0.5, t, 0.05); snd.lp.frequency.setTargetAtTime(400 + rpm*0.25 + (input.gas ? 500 : 0), t, 0.08);
  snd.eg.gain.setTargetAtTime(0.05 + (input.gas || cfg.auto ? 0.06 : 0.02) + rpm/90000, t, 0.1);
  const W = WEATHER[cfg.weather] || {}, uP = PLR ? uOfV(PLR) : camU, reg = regionAt(uP), night = gameH < 5.6 || gameH > 18.6;
  snd.wind.gain.setTargetAtTime(Math.min(0.5, v*v/2600) + (cfg.weather === 'berawan' ? 0.04 : 0), t, 0.2);
  // tyres on the road: louder with speed, a hiss on a wet road
  snd.tyre.gain.setTargetAtTime(Math.min(0.12, v*0.0035)*(W.rain ? 1.7 : 1), t, 0.2);
  snd.rain.gain.setTargetAtTime(W.rain ? 0.2 + Math.min(0.08, v*0.003) : 0, t, 0.6);
  snd.rainLo.gain.setTargetAtTime(W.rain ? 0.09 : 0, t, 0.6);
  // traffic around: the more moving vehicles close by, the louder the passing roar; a city hum in towns
  let near = 0, jam = 0; for (const o of vehicles) { if (o.player) continue; const d = Math.abs(o.sd*o.p - uP); if (d < 120) { near += Math.min(1, o.vel/12)*(1 - d/120)*(heavy(o) ? 2 : 1); if (o.vel < 2.5 && d < 80) jam++; } }
  snd.traffic.gain.setTargetAtTime(Math.min(0.14, near*0.012), t, 0.3);
  snd.hum.gain.setTargetAtTime(reg === 'urban' || reg === 'industrial' ? 0.05 : 0.01, t, 1);
  // weather: thunder in the rain
  if (W.rain && (thunderT -= dt) < 0) { thunderT = rnd(14, 40); thunder(); }
  // ambience: crickets at night and birds by day, away from towns
  if ((chirpT -= dt) < 0 && reg !== 'urban' && !W.rain) {
    if (night) { chirpT = rnd(0.25, 0.9); for (let k = 0; k < 3; k++) tone({fs: [4300 + Math.random()*300], type: 'sine', dur: 0.03, gain: 0.018, pan: Math.random()*2 - 1, at: k*0.06}); }
    else { chirpT = rnd(1.2, 4.5); const f0 = 2400 + Math.random()*1600, pn = Math.random()*2 - 1; for (let k = 0; k < 2 + (Math.random()*3 | 0); k++) tone({fs: [f0], type: 'sine', dur: 0.09, gain: 0.02, pan: pn, at: k*0.13, sweep: 1.35}); } }
  // horns: drivers stuck in a jam honk now and then, more on national roads, and at whoever blocks them (the player too)
  hornCd -= dt;
  if (hornCd <= 0 && PLR) { let best = null;
    for (const o of vehicles) { if (o.player || o.em) continue; const d = Math.abs(o.sd*o.p - uP); if (d > 160) continue;
      o.stuckT = o.vel < 2.5 ? (o.stuckT || 0) + 0.25 : 0;
      const toll = isToll(o.sd*o.p), blockedByMe = PLR.sd === o.sd && PLR.p - o.p > 0 && PLR.p - o.p < 16 && Math.abs(PLR.lx - o.lx) < 0.6 && PLR.vel < 1 && o.stuckT > 1.5 && !lightAhead(o.sd, o.p + o.len/2);
      const pr = blockedByMe ? 0.06 : o.stuckT > 4 ? (toll ? 0.002 : 0.006)*(o.type === 'moto' || o.type === 'angkot' ? 1.8 : 1)*Math.min(3, 1 + jam/8) : 0;
      if (Math.random() < pr) { best = o; break; } }
    if (best) { horn(best.type, Math.abs(best.sd*best.p - uP), panOf(best)); hornCd = rnd(0.3, 1.2); } else hornCd = 0.25; }
  // sirens: the two nearest, with hi-lo (ambulance), wail (fire engine) or yelp (police), panned and Doppler-shifted
  const em = EMS.map(e => [e.player ? 0 : Math.abs(uOfV(e) - uP), e]).sort((a, b) => a[0] - b[0]);
  snd.sir.forEach((sv, k) => { const it = em[k];
    if (!it || !cfg.sound) { sv.g.gain.setTargetAtTime(0, t, 0.15); return; }
    const [dist, e] = it, ph = clock + k*0.37;
    let fr = e.type === 'police' ? 700 + 700*Math.abs(Math.sin(ph*Math.PI*3)) : e.type === 'damkar' ? 520 + 760*(0.5 + 0.5*Math.sin(ph*Math.PI*0.45)) : (Math.floor(ph*1.6) % 2 ? 960 : 760);
    if (!e.player && PLR) { const du = uOfV(e) - uP, ve = e.sd*e.vel, vp = PLR.sd*PLR.vel, app = -(ve - vp)*Math.sign(du || 1); fr *= 343/(343 - clamp(app, -60, 60)); }
    sv.o.frequency.setTargetAtTime(fr, t, 0.02); sv.g.gain.setTargetAtTime(e.player ? 0.045 : 0.15*attOf(dist*0.8), t, 0.1);
    if (sv.p.pan) sv.p.pan.setTargetAtTime(e.player ? 0 : panOf(e), t, 0.1); });
}
// the player's own horn: sounds as long as K or the Klakson button is held; drivers ahead in the lane move over if they can
let myHorn = null;
function playerHorn(on = true){
  audioStart(); if (!snd || !PLR) return;
  if (!on) { if (myHorn) { const t = AC.currentTime; myHorn.g.gain.setTargetAtTime(0, t, 0.02); myHorn.os.forEach(o => o.stop(t + 0.15)); myHorn = null; } return; }
  if (myHorn) return;
  const ty = PLR.type, fs = ty === 'truck' || ty === 'bus' || ty === 'damkar' ? [233, 294, 349] : ty === 'angkot' ? [470, 560] : [415, 523];
  const g = AC.createGain(), f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600; g.gain.value = 0; g.gain.setTargetAtTime(0.13, AC.currentTime, 0.01); f.connect(g); g.connect(snd.master);
  myHorn = {g, os: fs.map(fr => { const o = AC.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(f); o.start(); return o; })};
  for (const o of vehicles) if (!o.player && o.sd === PLR.sd && Math.abs(o.lx - PLR.lx) < 0.6 && o.p - PLR.p > 0 && o.p - PLR.p < 60) o.cd = Math.min(o.cd, 0.1);
}
let fsOK = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function toggleFull(){ const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else { const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el, {navigationUI: 'hide'}); if (r && r.catch) r.catch(() => toast('Layar penuh tidak didukung browser ini', 'warn'));
    try { screen.orientation && screen.orientation.lock && MOBILE && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} } }
addEventListener('pointerdown', audioStart);
// touching the screen brings the on-screen steering and pedals back
addEventListener('pointerdown', e => { if (e.pointerType === 'touch' || e.pointerType === 'pen') document.body.classList.remove('kbd'); }); addEventListener('keydown', audioStart);

function tickClock(dt){
  gameH = mod(gameH + dt*(+cfg.tspd || 0)/60, 24);
  todT -= dt; if (todT > 0) return; todT = 0.5;
  applyTod(todAt(gameH));
  const el = $('clockt'), nm = TOD_NAME(gameH); if (el.textContent !== hhmm(gameH)) el.textContent = hhmm(gameH);
  if ($('todn').textContent !== nm) { $('todn').textContent = nm; document.body.dataset.tod = nm; }
  cfg.gh = Math.round(gameH*100)/100; saveCfgSoon();
}
let saveT = 0; function saveCfgSoon(){ if (clock - saveT > 10) { saveT = clock; saveCfg(); } }
// legacy presets jump the clock
function setTod(k){ if (k in TOD_JUMP) gameH = TOD_JUMP[k]; todT = 0; lastSign = -1; tickClock(0); }
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
// ---------- cockpit interior: dashboard, steering wheel (turning with the wheels), live instrument cluster, pillars, headliner, the bonnet ----------
// right-hand drive as in Indonesia; it rides with the camera, so it is drawn without the road bend
let CKP = null;
function buildCockpit(){
  const g = new THREE.Group(), dash = M(0x26272a, {roughness: 0.85}), trim = M(0x3a3b3f, {roughness: 0.6}), lining = M(0x8f8c86, {roughness: 0.95}), chrome = M(0xb8bcc2, {metalness: 0.8, roughness: 0.3});
  const add = (w, h, d, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); g.add(m); return m; };
  add(2.0, 0.07, 0.62, dash, -0.48, -0.33, -0.97);             // top of the dashboard
  add(2.0, 0.34, 0.06, dash, -0.48, -0.51, -0.67);             // its face
  add(0.48, 0.12, 0.22, dash, 0, -0.26, -0.79);                // hood over the instruments
  add(0.32, 0.26, 0.62, dash, -0.6, -0.74, -0.42);             // centre console
  add(0.3, 0.12, 0.02, trim, -0.6, -0.43, -0.665);              // air vents and radio
  add(0.36, 0.14, 0.02, M(0x101214, {roughness: 0.3, metalness: 0.4}), -0.6, -0.59, -0.665);
  add(0.05, 0.95, 0.05, trim, -1.32, 0.0, -0.86, 0, -0.42);   // A-pillars at the edges of the windscreen, leaning in at the top
  add(0.05, 0.95, 0.05, trim, 0.62, 0.0, -0.86, 0, 0.42);
  add(2.1, 0.06, 1.0, lining, -0.48, 0.36, -0.3);              // headliner
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), new THREE.MeshBasicMaterial({map: tex, toneMapped: false})); scr.position.set(0, -0.325, -0.675); g.add(scr);
  const wheel = new THREE.Group(); wheel.position.set(0, -0.41, -0.53); wheel.rotation.x = -0.38; g.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 10, 40), trim));
  for (const a of [Math.PI/2, -Math.PI/2, Math.PI]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.018), trim); sp.position.set(Math.cos(a)*0.09, Math.sin(a)*0.09, 0); sp.rotation.z = a; wheel.add(sp); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.05, 20), trim); hub.rotation.x = Math.PI/2; wheel.add(hub);
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), chrome); logo.position.z = 0.027; wheel.add(logo);
  add(0.05, 0.05, 0.22, trim, 0, -0.49, -0.62, 0.4);            // steering column
  const hood = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.5), new THREE.MeshStandardMaterial({color: 0xec3013, roughness: 0.35, metalness: 0.35}));
  hood.rotation.x = -Math.PI/2 + 0.12; hood.position.set(-0.48, -0.47, -2.0); g.add(hood);
  g.traverse(o => { o.frustumCulled = false; });
  CKP = {g, wheel, cv, tex, hood, t: 0};
  if (!camera.parent) scene.add(camera); camera.add(g);
}
function drawCluster(v){
  const x = CKP.cv.getContext('2d'), W = 512, H = 160, kmh = Math.round(Math.abs(v.vel)*3.6);
  x.fillStyle = '#07090b'; x.fillRect(0, 0, W, H); x.strokeStyle = '#2b3138'; x.lineWidth = 4; x.strokeRect(2, 2, W - 4, H - 4);
  // speed arc
  x.lineWidth = 10; x.strokeStyle = '#1d2329'; x.beginPath(); x.arc(110, 120, 80, Math.PI, 2*Math.PI); x.stroke();
  x.strokeStyle = kmh > KMH(limitAt(uOfV(v))) + 5 ? '#ec3013' : '#3ab0ff'; x.beginPath(); x.arc(110, 120, 80, Math.PI, Math.PI*(1 + Math.min(1, kmh/180))); x.stroke();
  x.fillStyle = '#f2f4f6'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.font = `800 58px ${SIGN_FONT}`; x.fillText(String(kmh), 110, 128);
  x.font = `600 18px ${SIGN_FONT}`; x.fillStyle = '#9aa4ad'; x.fillText('km/jam', 110, 152);
  x.textAlign = 'left'; x.fillStyle = '#f2c230'; x.font = `800 40px ${SIGN_FONT}`; x.fillText($('gear').textContent, 230, 70);
  const f = WAL.fuel != null ? clamp(WAL.fuel/tankOf(), 0, 1) : 1; x.fillStyle = '#9aa4ad'; x.font = `600 18px ${SIGN_FONT}`; x.fillText('BBM', 230, 110);
  x.fillStyle = '#1d2329'; x.fillRect(280, 96, 200, 16); x.fillStyle = f < 0.15 ? '#ec3013' : '#46c37b'; x.fillRect(280, 96, 200*f, 16);
  x.fillStyle = '#9aa4ad'; x.fillText(`${String(Math.floor(gameH)).padStart(2, '0')}:${String(Math.floor(gameH%1*60)).padStart(2, '0')}`, 330, 70);
  CKP.tex.needsUpdate = true;
}
function updateCockpit(dt){
  const on = camMode === 'cockpit' && !!PLR && !foot && !tow;
  if (!CKP) { if (!on) return; buildCockpit(); }
  CKP.g.visible = on; const near = on ? 0.05 : 0.3; if (camera.near !== near) { camera.near = near; camera.updateProjectionMatrix(); }
  if (!on) return;
  CKP.wheel.rotation.z = clamp((PLR.steer || 0)*6, -3, 3);
  if (CKP.paint !== PLR.paint) { CKP.paint = PLR.paint; CKP.hood.material.color.setHex(PLR.paint || 0xec3013); }
  if ((CKP.t -= dt) <= 0) { CKP.t = 0.15; drawCluster(PLR); }
}
function updateCam(dt){
  updateCockpit(dt);
  const v0 = PLR; if (!v0) return; const v = foot ? {g: foot.g, q: null, sd: v0.sd, len: 0.5, type: 'car'} : v0;
  pPos.copy(v.g.position); if (foot) pPos.y = 0;
  if (foot && camMode === 'chase') { const hy = foot.g.rotation.y, hdv = tmpV.set(Math.sin(hy), 0, Math.cos(hy)); headV.lerp(hdv, Math.min(1, dt*4)).normalize();
    const want = new THREE.Vector3().copy(pPos).addScaledVector(headV, -4.2); want.y = 2.3; camera.position.lerp(want, Math.min(1, dt*6));
    camera.lookAt(pPos.x + headV.x*6, 1.4, pPos.z + headV.z*6); camera.fov = fovFor(62); camera.updateProjectionMatrix();
    camera.getWorldDirection(tmpV); focus.copy(camera.position).addScaledVector(tmpV, 50); focus.y = 0; sun.target.position.copy(focus); sun.position.copy(focus).add(sunOff); return; }
  const hy = v.g.rotation.y, hd = tmpV.set(Math.sin(hy), 0, Math.cos(hy));
  headV.lerp(hd, Math.min(1, dt*3)).normalize();
  const shk = shake > 0 ? (shake -= dt, (Math.random() - 0.5)*shake) : 0;
  if (camMode === 'chase') {
    const want = new THREE.Vector3().copy(pPos).addScaledVector(headV, -13); want.y = (v.q ? v.q.h || 0 : 0) + 4.4;
    camera.position.lerp(want, Math.min(1, dt*5)); camera.position.x += shk;
    camera.lookAt(pPos.x + headV.x*20, 1.4 + (v.q ? v.q.h || 0 : 0), pPos.z + headV.z*20); camera.fov = fovFor(58);
  } else if (camMode === 'cockpit') {
    const h = (v.type === 'bus' || v.type === 'truck') ? 2.6 : v.type === 'suv' ? 1.6 : 1.3;
    camera.position.copy(pPos).addScaledVector(headV, v.len*0.05); camera.position.y = h + (v.q ? v.q.h || 0 : 0); camera.position.x += v.sd*0.36 + shk;   // the driver sits on the right
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
function hudAuto(){ if (tow || foot) cfg.auto = false; $('auto').setAttribute('aria-pressed', cfg.auto ? 'true' : 'false'); document.body.classList.toggle('auto', cfg.auto); }
function hudLane(){ const v = PLR; if (!v) return; const n = Math.round(nAvail(v.sd, v.p)), el = $('lanes'); el.innerHTML = '';
  const neg = []; for (const z of CFA) if (z.A === v.sd && Math.abs(v.p - z.o1) < 900) for (let j = z.k; j >= 1; j--) neg.push(-j);
  const all = [...Array.from({length: n}, (_, i) => n - 1 - i), ...neg.sort((a, b) => b - a)];
  for (const l of all) { const d = document.createElement('i'); if (l < 0) d.className = 'cf'; else d.dataset.l = l; if (v.rp ? false : l === v.lane) d.className += ' on'; if (l === v.prefLane) d.className += ' pick'; el.append(d); } }
let rest = false;
function setRest(on){ rest = on; $('resume').hidden = !on; if (on) { toast('Parkir di rest area. Pilih layanan, lalu tekan "Lanjut perjalanan".'); if (!cfg.auto) setTimeout(openSvc, 400); } else $('svc').hidden = true; }
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
  const gr = v.vel < -0.3 ? 'R' : Math.abs(v.vel) < 0.3 && !input.gas ? 'N' : 'D' + (cfg.auto || !v.gear ? gearOf(Math.max(0, v.vel)/(heavy(v) ? 0.6 : 1)) : v.gear); if ($('gear').textContent !== gr) $('gear').textContent = gr;
  const lim = v.rp ? rampLimit(v.rp) : Math.min(limitAt(u), postedCap(v.sd, v.p + v.len/2), v.lane < 0 ? 16.7 : 99);
  const limK = Math.round(KMH(lim)/10)*10; if ($('lim').dataset.v !== String(limK)) { $('lim').dataset.v = limK; $('lim').textContent = limK; replay($('lim'), 'chg'); }
  $('spdbox').classList.toggle('over', v.vel > lim + 1.4);
  $('corr').textContent = CORR[corrAt(u)].name;
  $('kmpost').textContent = `KM ${kmAt(u).toFixed(1).replace('.', ',')}`;
  $('left').textContent = !dest ? 'Bebas' : stats.done ? 'Tiba' : fmtKm(Math.max(0, dest.rk - rk));
  updateChoice(u);
  $('toll').textContent = 'Rp ' + stats.toll.toLocaleString('id-ID');
  $('viol').textContent = stats.viol; $('crash').textContent = stats.crashes + (PLR && PLR.dmg >= 1 ? ` · ${Math.round(PLR.dmg)}%` : '');
  const ne = nextEvents(), list = $('next'), nk = ne.map(x => x.e.i + (x.e.i === trip.destIdx ? 'd' : '')).join();
  // rebuild only when the list changes, so new rows slide in and distances just tick
  if (list.dataset.k === nk) ne.forEach(({d}, j) => { const em = list.children[j] && list.children[j].lastChild; if (em && em.textContent !== fmtKm(d)) em.textContent = fmtKm(d); });
  else { list.dataset.k = nk; list.innerHTML = '';
  for (const {e, d} of ne) { const li = document.createElement('li'); if (e.i === trip.destIdx) li.className = 'dest';
    const tag = document.createElement('b'); tag.textContent = e.i === trip.destIdx ? 'TUJUAN' : ICON[e.kind]; tag.className = 'k-' + e.kind;
    const nm = document.createElement('span'); nm.textContent = e.kind === 'te' ? `${e.name} (keluar tol)` : e.kind === 'ti' ? `${e.name} (masuk tol)` : e.kind === 'j' ? nodeLabel(e).replace('Simpang Susun ', '') + (e.turn ? ` → ${CORR[e.cNext].short}` : '') : e.kind === 'r' || e.kind === 'x' ? e.name : nodeLabel(e).replace('Gerbang Tol ', 'GT ');
    const dd = document.createElement('em'); dd.textContent = fmtKm(d); li.append(tag, nm, dd); list.append(li); } }
  // instruction line
  const sa = siteAhead(v.sd, v.p); let ins = '';
  if (v.rp) ins = v.rp.parked ? 'Parkir di rest area' : v.rp.kind === 'mbz' ? (v.rp.up ? 'Ramp naik Tol Layang MBZ' : 'Turun ke Tol Jakarta–Cikampek') : v.rp.kind === 'x' ? 'Di ramp keluar. Berhenti di gerbang tol.' : v.rp.kind === 'detour' ? 'Pengalihan lewat Jalan Nasional' : 'Di ramp';
  else if (!cfg.auto && v.lx < -0.5 && !(cfAt(v.sd, v.p) && cfAt(v.sd, v.p).A === v.sd)) ins = 'Anda melawan arus!';
  else if (!cfg.auto && v.lx > nAvail(v.sd, v.p) - 1 + 1.3) ins = 'Anda keluar badan jalan';
  else if (!cfg.auto && !tow && v.lx > nAvail(v.sd, v.p) - 1 + 0.5 && !(sa && sa.t > -280)) ins = tow ? '' : 'Anda di bahu jalan';
  else if (sa && sa.s.i === trip.destIdx && sa.s.kind === 'x') ins = sa.t > -270 ? '← Arahkan ke kiri sekarang untuk keluar' : `Exit tujuan ${fmtKm(-(sa.t + 150)/1000*cfg.scale)} lagi. Ambil lajur paling kiri.`;
  else if (sa && sa.s.kind === 'r' && sa.t > -270) ins = '← Arahkan ke kiri sekarang untuk masuk rest area';
  else if (lightAhead(v.sd, v.p + v.len/2) && lightAhead(v.sd, v.p + v.len/2).d < 140) { const la = lightAhead(v.sd, v.p + v.len/2), st = sigMain(la.s);
    ins = st === 'R' ? `Lampu merah di ${la.s.name}: berhenti di garis stop (${Math.round(la.d)} m)` : st === 'Y' ? 'Lampu kuning: bersiap berhenti' : `Lampu hijau di ${la.s.name}${la.s.i === trip.destIdx ? ' · tujuan Anda' : ''}`; }
  else if (!cfg.auto && plazaAhead(v.sd, v.p + v.len/2) && plazaAhead(v.sd, v.p + v.len/2).d < 160 && v.paid !== plazaAhead(v.sd, v.p + v.len/2).s.id) { const pz = plazaAhead(v.sd, v.p + v.len/2);
    ins = pz.d < 9 ? (Math.abs(v.vel) < 0.6 ? 'Tap e-Toll…' : 'Berhenti untuk tap e-Toll') : `Gerbang tol ${Math.round(pz.d*cfg.scale/10)*10} m: antre dan berhenti di depan palang untuk tap e-Toll`; }
  else if (mbzHint(v)) ins = mbzHint(v);
  else { const bd = blockAhead(v.sd, v.lane, v.p + v.len/2, mbzOK() && !cfg.auto), z = cfAt(v.sd, v.p);
    const ow = CFA.find(z => z.oneWay && z.B === v.sd && v.p - z.bStart > -700 && v.p - z.bStart < -236);
    if (ow) ins = v.p - ow.bStart > -330 ? '← Jalan ditutup: belok kiri ke pengalihan sekarang' : 'Jalan ditutup (one way). Ambil lajur paling kiri untuk pengalihan.';
    else if (bd < 450) ins = v.lane < 0 ? `Contraflow berakhir ${Math.round(bd)} m lagi. Kembali ke jalur kiri.` : `Lajur berakhir/ditutup ${Math.round(bd)} m lagi. Pindah lajur!`;
    else if (z && v.lane === 0 && v.p < z.CF_IN + 30 && v.p > z.CF_IN - 250) ins = 'Contraflow: tekan → di bukaan median untuk masuk';
    else { const nj = ne.find(x => x.e.turn || (x.e.end && x.e.cNext !== x.e.c && x.e.kind !== 'te' && x.e.kind !== 'ti')); if (nj && nj.d < 6) ins = `${nj.e.kind === 'k' ? 'Di ' + nj.e.name + ', jalan' : 'Lurus'} terus ke ${CORR[nj.e.cNext].name}`; } }
  if ($('ins').textContent !== ins) { $('ins').textContent = ins; if (ins) replay($('ins'), 'flash'); } $('ins').hidden = !ins;
  if (!cfg.auto && v.prefLane != null && (Math.round(v.lx) === v.prefLane || clock > v.prefT)) { v.prefLane = null; hudLane(); lgSig = ''; }
  laneGuide(v);
  hudLane();
}

// restart a CSS animation class
function replay(el, cls){ el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// ---------- lane guidance: which lanes to be in for the next manoeuvre (exit, closed lanes, lane drop, heavy vehicles) ----------
const ARROW = {up: 'M12 21V5M6 11l6-6 6 6', exit: 'M15 21v-6c0-4-2-6-7-8M6 2.5 8 7l-4.6 1.4', mergeR: 'M9 21v-6c0-4 2-6 7-8M18 2.5 16 7l4.6 1.4', mergeL: 'M15 21v-6c0-4-2-6-7-8M6 2.5 8 7l-4.6 1.4', x: 'M6 6l12 12M18 6 6 18'};
let lgSig = '';
function guideFor(v){
  if (!v || v.rp || !trip || stats.done) return null;
  const n = Math.round(nAvail(v.sd, v.p)), front = v.p + v.len/2; if (n < 2) return null;
  const info = Array.from({length: n}, () => ({a: 'up', st: ''})); let rec = new Set(info.map((_, l) => l)), title = '', d = Infinity, real = false;
  // closed or ending lanes in the next 700 m
  const sk = mbzOK() && !cfg.auto;
  for (let l = 0; l < n; l++) { const bd = blockAhead(v.sd, l, front, sk); if (bd > 700) continue;
    const end = dropAhead(v.sd, l, front) <= bd + 1; info[l].st = end ? 'end' : 'closed'; rec.delete(l); d = Math.min(d, bd);
    title = title || (end ? 'Lajur berkurang' : 'Lajur ditutup'); }
  if (title && rec.size) for (let l = 0; l < n; l++) if (info[l].st) { const tgt = [...rec].sort((a, b) => Math.abs(a - l) - Math.abs(b - l))[0]; info[l].a = tgt < l ? 'mergeR' : 'mergeL'; }
  // destination exit: outer (leftmost) lane
  const sa = siteAhead(v.sd, v.p);
  if (sa && sa.s.i === trip.destIdx && sa.s.kind === 'x') { const de = Math.max(0, -sa.t - 200);
    if (de < d) { d = de; title = `Exit tujuan ${sa.s.name}`; real = true; } rec = new Set([n - 1]); info[n - 1].a = 'exit'; info[n - 1].st = ''; }
  if (!title) return null;
  if (heavy(v) && [...rec].some(l => l >= heavyMin(n))) for (const l of [...rec]) if (l < heavyMin(n)) rec.delete(l);
  if (!rec.size) rec = new Set(info.map((_, l) => l).filter(l => !info[l].st));
  return {n, info, rec, title, d, real};
}
function laneGuide(v){
  const el = $('lg'), g = guideFor(v);
  if (!g) { if (!el.hidden) el.hidden = true; lgSig = ''; return; }
  const sig = g.n + g.title + g.info.map((x, l) => x.a + x.st + (g.rec.has(l) ? 'r' : '')).join() + (v.prefLane ?? '');
  if (sig !== lgSig) { lgSig = sig; const box = $('lg-lanes'); box.innerHTML = ''; box.style.gridTemplateColumns = `repeat(${g.n}, minmax(0, 1fr))`;
    for (let l = g.n - 1; l >= 0; l--) { const x = g.info[l], b = document.createElement('button');
      b.className = 'ln' + (g.rec.has(l) ? ' rec' : ' dim') + (x.st ? ' ' + x.st : '') + (v.prefLane === l ? ' pick' : '');
      b.dataset.l = l; b.setAttribute('aria-label', `Lajur ${g.n - l}${g.rec.has(l) ? ' (disarankan)' : x.st === 'closed' ? ' (ditutup)' : x.st === 'end' ? ' (berakhir)' : ''}`);
      b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"><path d="${ARROW[x.st === 'closed' ? 'x' : x.a]}"/></svg><small>${g.n - l}</small>`;
      box.append(b); }
    const me = document.createElement('i'); me.className = 'me'; box.append(me);
    $('lg-title').textContent = g.title; if (el.hidden) { el.hidden = false; } }
  // exits use the route's real distance (like the other instructions); closures are measured on the road itself
  $('lg-d').textContent = g.real ? fmtKm(g.d*cfg.scale/1000) : `${Math.round(g.d/10)*10} m`;
  // the car marker follows the real lateral position
  const me = $('lg-lanes').querySelector('.me'); if (me) me.style.left = `${clamp((g.n - 1 - v.lx + 0.5)/g.n, 0, 1)*100}%`;
  const cur = Math.round(v.lx), ok = g.rec.has(cur), tgt = [...g.rec].sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur))[0];
  const hint = ok ? '✓ Sudah di lajur yang tepat' : `${tgt > cur ? '← Pindah ke kiri' : 'Pindah ke kanan →'} · lajur ${g.n - tgt}`;
  const h = $('lg-hint'); if (h.textContent !== hint) { h.textContent = hint; h.className = ok ? 'ok' : tgt > cur ? 'go l' : 'go r'; }
}
// tap a lane (guidance panel or dashboard): autopilot moves there, manual driving gets a pointer
function pickLane(l){
  const v = PLR; if (!v || v.rp) return; const n = Math.round(nAvail(v.sd, v.p)); if (l < 0 || l >= n) return;
  if (blockAhead(v.sd, l, v.p + v.len/2) < 120) return toast(`Lajur ${n - l} ditutup di depan`, 'warn');
  v.prefLane = l; v.prefT = clock + 45; lgSig = '';
  toast(cfg.auto ? `Autopilot pindah ke lajur ${n - l}` : `Lajur ${n - l}: setir ${l > Math.round(v.lx) ? 'ke kiri' : l < Math.round(v.lx) ? 'ke kanan' : 'lurus'}`);
  hudLane();
}
$('lg-lanes').addEventListener('click', e => { const b = e.target.closest('.ln'); if (b) pickLane(+b.dataset.l); });
$('lanes').addEventListener('click', e => { const b = e.target.closest('i[data-l]'); if (b) pickLane(+b.dataset.l); });

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
  // the island and its roads: drawn once into a cached layer for the whole-island view, every time when zoomed in on the car
  const base = y => { y.fillStyle = 'rgba(32,30,29,0.06)'; for (const isl of [JAVA, MADURA]) { y.beginPath(); isl.forEach(([lo, la], i) => { const [a, b] = P(la, lo); i ? y.lineTo(a, b) : y.moveTo(a, b); }); y.closePath(); y.fill(); }
    y.lineJoin = 'round';
    for (const c of CORRIDORS) { if (c.cls === 'a' || !roadInView(c.id, P, W, H)) continue; y.lineWidth = c.prov ? 0.7 : c.cls === 'n' ? 1 : 1.5; y.strokeStyle = c.prov ? 'rgba(160,120,70,0.45)' : c.cls === 'n' ? 'rgba(138,90,40,0.55)' : 'rgba(32,30,29,0.45)'; y.setLineDash(c.planned ? [3, 3] : []); strokeRoad(y, P, c.id); }
    y.setLineDash([]); };
  if (mapBig) base(x);
  else { const k = `${W}x${H}x${dpr}`; if (!drawMap.cache || drawMap.key !== k) { const c = document.createElement('canvas'); c.width = Math.round(W*dpr); c.height = Math.round(H*dpr);
      const y = c.getContext('2d'); y.setTransform(dpr, 0, 0, dpr, 0, 0); base(y); drawMap.cache = c; drawMap.key = k; }
    x.drawImage(drawMap.cache, 0, 0, W, H); }
  if (trip) { const u0 = PLR ? uOfV(PLR) : 0, i0 = Math.max(0, evAt(u0)), i1 = trip.destIdx >= 0 ? trip.destIdx : Math.min(EV.length - 1, i0 + 60);
    x.lineWidth = 3; x.strokeStyle = acc; x.beginPath(); routeLL(u0, i1).forEach((e, i) => { const [a, b] = P(e.lat, e.lon); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.stroke();
    const d = EV[trip.destIdx]; if (d) { const [dx, dy] = P(d.lat, d.lon); x.fillStyle = ink; x.fillRect(dx - 3, dy - 3, 6, 6); }
    if (PLR) { const p = latLonAt(uOfV(PLR)), [px, py] = P(p.lat, p.lon); x.fillStyle = acc; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(px, py, 5, 0, Math.PI*2); x.fill(); x.stroke(); } }
  x.fillStyle = ink; x.font = '600 9px Archivo, sans-serif';
  const labels = mapBig ? [...new Set(EV.filter(e => e.city && e.kind !== 'n0').map(e => e.key))].map(k => NODES.get(k)) : ['JCT Cawang','GT Banyumanik','JCT Waru','Merak','JCT Pasir Koja','GT Palimanan','Colomadu','Malang','Ketapang'].map(k => NODES.get(k));
  for (const n of labels) { if (!n) continue; const [a, b] = P(n.lat, n.lon); if (a < 0 || b < 0 || a > W || b > H) continue; x.fillText(n.city || n.name, a + 4, b - 3); }
  mpDrawMap(x, P);
}
// where u is on the map: along the curve of the road it is on
function latLonAt(u){ const i = evAt(u); if (i < 0) return EV[0]; if (i >= EV.length - 1) return EV[EV.length - 1];
  const a = EV[i], b = EV[i+1], q = corrLL(a.cNext, kmAt(u)); if (q) return {lat: q.lat, lon: q.lon};
  const f = clamp((u - a.u)/(b.u - a.u), 0, 1); return {lat: a.lat + (b.lat - a.lat)*f, lon: a.lon + (b.lon - a.lon)*f}; }
// roads drawn along their curves, the route along the curves of the roads it uses
function strokeRoad(x, P, id){ const g = corrGeo(id); if (!g || g.length < 2) return; x.beginPath(); g.forEach((q, i) => { const [a, b] = P(q.lat, q.lon); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.stroke(); }
const RBOX = new Map();
function roadInView(id, P, W, H){ let bb = RBOX.get(id); if (!bb) { const g = corrGeo(id) || []; bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const q of g) { bb[0] = Math.min(bb[0], q.lat); bb[1] = Math.min(bb[1], q.lon); bb[2] = Math.max(bb[2], q.lat); bb[3] = Math.max(bb[3], q.lon); } RBOX.set(id, bb); }
  const [a0, b0] = P(bb[2], bb[1]), [a1, b1] = P(bb[0], bb[3]); return a1 > -20 && a0 < W + 20 && b1 > -20 && b0 < H + 20; }
function routeLL(u0, i1){ const out = [latLonAt(u0)], i0 = Math.max(0, evAt(u0));
  for (let i = i0; i < Math.min(i1, EV.length - 1); i++) { const a = EV[i], b = EV[i + 1], ka = i === i0 ? kmAt(u0) : a.kmOut, kb = b.km, n = Math.max(1, Math.ceil(Math.abs(kb - ka)/1.5));
    for (let k = 1; k <= n; k++) { const q = corrLL(a.cNext, ka + (kb - ka)*k/n); out.push(q && k < n ? q : {lat: b.lat, lon: b.lon}); } }
  return out; }
map.onclick = () => openAtlas();

// ---------- full-screen atlas: every road of the network, pan / zoom / search / navigate ----------
const NET = {t: CORRIDORS.filter(c => c.cls === 't'), n: CORRIDORS.filter(c => c.cls === 'n'), a: CORRIDORS.filter(c => c.cls === 'a')};
const NAVABLE = [...NODES.values()].filter(n => edgesFrom(n.key).length);
const NAV_COUNT = NAVABLE.length;
const NET_SUMMARY = `${NET.t.length} ruas tol, ${NET.n.filter(c => !c.prov).length} ruas jalan nasional, ${NET.n.filter(c => c.prov).length} ruas jalan provinsi/kabupaten, ${NET.a.length} jalan akses, ${NAVABLE.filter(n => n.kind === 'k').length} kota, ${NAVABLE.filter(n => n.kind === 'j').length} simpang susun, ${NAVABLE.filter(n => n.kind === 'x' || n.kind === 't' || n.kind === 'g').length} gerbang tol`;
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
  $('lg-t').textContent = `Jalan tol · ${NET.t.length} ruas`; $('lg-n').textContent = `Jalan nasional · ${NET.n.filter(c => !c.prov).length} ruas · provinsi/kabupaten · ${NET.n.filter(c => c.prov).length} ruas`; $('lg-a').textContent = `Jalan akses gerbang tol · ${NET.a.length}`;
  const d = trip && EV[trip.destIdx];
  $('at-nav').textContent = d ? `Navigasi ke ${d.name} · ${fmtKm(Math.max(0, d.rk - rkAt(uOfV(PLR))))}` : 'Rute di depan (keliling bebas)';
}
function zoomAt(x, y, f){ const p = atInv(x, y); AT.k = clamp(AT.k*f, AT.kMin, AT.kMax); const q = atInv(x, y); AT.lon += p.lon - q.lon; AT.lat += p.lat - q.lat; reqAtlas(); }
function drawAtlas(){
  if (atlas.hidden) return;
  const dpr = atSize(), x = actx, W = AT.W, H = AT.H, k = AT.k; x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.fillStyle = '#d5e2ea'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#f4f1ea'; x.strokeStyle = '#9fb3bf'; x.lineWidth = 1.2; for (const isl of [JAVA, MADURA]) { x.beginPath(); isl.forEach(([lo, la], i) => { const [a, b] = atP(la, lo); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); x.fill(); x.stroke(); }
  const inView = (a, b, m = 40) => a > -m && b > -m && a < W + m && b < H + m;
  const line = c => { if (roadInView(c.id, atP, W, H)) strokeRoad(x, atP, c.id); };
  x.lineCap = 'round'; x.lineJoin = 'round';
  const z = Math.log2(k/100);   // 0 = whole island
  x.setLineDash([4, 4]); x.strokeStyle = 'rgba(80,88,94,0.75)'; x.lineWidth = clamp(0.6 + z*0.35, 0.6, 2.2); for (const c of NET.a) line(c);
  x.setLineDash([]); x.strokeStyle = '#c49a62'; x.lineWidth = clamp(0.7 + z*0.45, 0.7, 3.2); for (const c of NET.n) if (c.prov) line(c);
  x.strokeStyle = '#a0682e'; x.lineWidth = clamp(1 + z*0.6, 1, 4.5); for (const c of NET.n) if (!c.prov) line(c);
  for (const c of NET.t) { x.setLineDash(c.planned ? [7, 5] : []); x.strokeStyle = '#fff'; x.lineWidth = clamp(2.4 + z*0.9, 2.4, 8); line(c); x.strokeStyle = c.planned ? '#6d6a66' : '#201e1d'; x.lineWidth = clamp(1.4 + z*0.7, 1.4, 6); line(c); }
  x.setLineDash([]);
  // the route ahead (navigation or free driving plan)
  const acc = '#ec3013';
  if (trip && PLR) { const u = uOfV(PLR), i0 = Math.max(0, evAt(u)), i1 = trip.destIdx >= 0 ? trip.destIdx : Math.min(EV.length - 1, i0 + 80), p = latLonAt(u);
    x.strokeStyle = acc; x.globalAlpha = 0.85; x.lineWidth = clamp(3 + z*0.8, 3, 9); x.beginPath();
    routeLL(u, i1).forEach((e, j) => { const [a, b] = atP(e.lat, e.lon); j ? x.lineTo(a, b) : x.moveTo(a, b); }); x.stroke(); x.globalAlpha = 1; }
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
  // the other players (multiplayer)
  mpDrawMap(x, atP, true);
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
    ['weather', 'Cuaca', [['cerah','Cerah'],['berawan','Berawan'],['hujan','Hujan'],['kabut','Kabut']]],
    ['roadStyle', 'Gaya jalan', [['data','Sesuai medan'],['kelok','Lebih berkelok & berbukit'],['lurus','Lebih lurus']]],
    ['view', 'Jarak pandang', [['normal','Normal'],['jauh','Jauh (lebih berat)']]],
    ['gfx', 'Grafis', [['auto','Otomatis'],['hemat','Hemat (paling ringan)'],['sedang','Sedang'],['tinggi','Tinggi']]],
    ['autoSteer', 'Setir otomatis', [[false,'Mati'],[true,'Aktif (gas & rem tetap manual)']]],
    ['sound', 'Suara', [[true,'Nyala'],[false,'Mati']]],
    ['clean', 'Tampilan HUD', [[false,'Normal'],[true,'Ringkas (lebih kecil, tekan H)']]],
    ['tod', 'Atur jam', [['morning','Pagi 07:00'],['day','Siang 12:00'],['dusk','Sore 17:48'],['night','Malam 21:00']]],
    ['steerAssist', 'Asisten setir', [[false,'Mati (setir penuh, harus balas setir)'],[true,'Aktif (mobil lurus lagi saat setir dilepas)']]],
    ['tspd', 'Jalannya jam', [[0,'Berhenti'],[0.5,'1 jam = 2 menit'],[1,'1 jam = 1 menit'],[6,'1 jam = 10 detik']]],
    ['lanes', 'Jumlah lajur per arah (semua jalan)', [['auto','Sesuai data'],['1','1'],['2','2'],['3','3'],['4','4'],['5','5']]],
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
        b.onclick = () => { if (srvLocked(id)) return; cfg.closed[d] = on ? sel.filter(x => x !== v) : [...sel, v]; saveCfg(); renderUI(); if (mp.on && mp.admin) srvPush();
          const z = (cfg.closed[d] || []).length && PLR ? zoneAhead('rw') : null; applyTraffic(['rw']); updateWorld();
          toast(`Lajur ${v} ${on ? 'dibuka' : 'ditutup'} (${d === '1' ? 'arah saya' : 'arah lawan'})${z ? ` · pekerjaan jalan ${Math.round((z.u - uOfV(PLR))/10)*10} m di depan` : ''}`); };
        cell.append(b); });
      const h = document.createElement('div'); h.className = 'hint'; h.textContent = 'Lajur 1 = paling kiri. Lajur yang tidak ada di ruas itu diabaikan, dan minimal satu lajur tetap dibuka.'; cell.append(h);
    } else opts.forEach(([v, t]) => { const b = btn(t, String(cfg[id]) === String(v)); b.onclick = () => apply(id, v); cell.append(b); });
    if (srvLocked(id)) { for (const b of cell.querySelectorAll('button')) b.disabled = true; const h = document.createElement('div'); h.className = 'hint'; h.textContent = 'Terkunci di multiplayer (hanya admin server)'; cell.append(h); }
    else if (mp.on && mp.admin && SRV_KEYS.includes(id)) lbl.textContent = 'Server · ' + label;
    ctrl.append(lbl, cell);
  }
  if (mp.on) { const l2 = document.createElement('div'); l2.className = 'lbl'; l2.textContent = 'Pengaturan server';
    const c2 = document.createElement('div'); c2.className = 'cell'; const b2 = btn(mp.admin ? 'Admin aktif · keluar' : 'Masuk admin (PIN)', mp.admin);
    b2.onclick = () => { if (mp.admin) { mp.admin = false; mp.adminPin = null; renderUI(); toast('Keluar dari mode admin'); } else srvAdminLogin(); }; c2.append(b2);
    if (mp.admin) { const b3 = btn('Kelola pemain (kick / ban)', false); b3.onclick = admOpen; c2.append(b3); }
    ctrl.append(l2, c2); }
  const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = 'Rute';
  const cell = document.createElement('div'); cell.className = 'cell'; const b = btn('Ganti rute', false); b.onclick = () => openPlanner(); cell.append(b);
  ctrl.append(lbl, cell);
  ctrl.scrollTop = sc;
}
function applyTraffic(types){ setupBlocks(true); rebuildObjects(types); }
// a roadworks / contraflow zone in front of the car, so a changed setting can be seen right away
function zoneAhead(type){
  const u0 = uOfV(PLR), r = ZEXT[type] - 450, have = ZONES.find(z => z.type === type && z.u - u0 > 250 + r && z.u - u0 < 1600);
  if (have) return have;
  const ok = u => nAt(u) >= 2 && nAt(u + 400) >= 2 && nAt(u - 400) >= 2
    && !SITES.some(s => Math.abs(s.u - u) < r + 150) && !ZONES.some(z => Math.abs(z.u - u) < (ZEXT[z.type] + ZEXT[type])/2 + 150)
    && !OVS.some(o => Math.abs(o.u - u) < 420) && !OPENS.some(o => !o.cf && Math.abs(o.u - u) < 260);
  // no free slot: take the first place clear of interchanges/overpasses and move other zones out of the way
  let at = null; for (let u = u0 + 420 + r; u < u0 + 9000 && at == null; u += 40) if (ok(u)) at = u;
  if (at == null) for (let u = u0 + 420 + r; u < u0 + 9000 && at == null; u += 40)
    if (nAt(u) >= 2 && nAt(u + 400) >= 2 && nAt(u - 400) >= 2 && !SITES.some(s => Math.abs(s.u - u) < r + 150) && !OVS.some(o => Math.abs(o.u - u) < 420) && !OPENS.some(o => !o.cf && Math.abs(o.u - u) < 260)) at = u;
  if (at != null) for (const z of ZONES.filter(z => Math.abs(z.u - at) < (ZEXT[z.type] + ZEXT[type])/2 + 150)) dropZone(z);
  for (let u = at ?? Infinity; u < u0 + 9000; u += 40) {
    const z = {type, u, user: true}; ZONES.push(z); ZONES.sort((a, b) => a.u - b.u);
    const add = [{u, r, type, z}];
    if (type === 'cf') for (const du of [-200, 200]) { const o = {u: u + du, cf: z}; OPENS.push(o); add.push({u: o.u, r: 60, type: 'ut', o}); }
    OPENS.sort((a, b) => a.u - b.u); OBJ.push(...add); OBJ.sort((a, b) => a.u - b.u);
    return z; }
  return null;
}
function dropZone(z){
  ZONES = ZONES.filter(q => q !== z); OPENS = OPENS.filter(o => o.cf !== z);
  for (const o of OBJ.filter(o => o.z === z || (o.o && o.o.cf === z))) { const gs = built.get(o); if (gs) { freeObj(gs); built.delete(o); } }
  OBJ = OBJ.filter(o => o.z !== z && !(o.o && o.o.cf === z));
}
function apply(id, v, fromServer = false){
  if (!fromServer && srvLocked(id)) { toast('Di multiplayer pengaturan hanya bisa diubah admin server', 'warn'); return; }
  cfg[id] = v; saveCfg();
  if (!fromServer && mp.on && mp.admin && SRV_KEYS.includes(id)) setTimeout(srvPush, 50);
  const ahead = type => { if (!PLR) return ''; const z = zoneAhead(type); return z ? ` · ${type === 'cf' ? 'zona contraflow' : 'pekerjaan jalan'} ${Math.round((z.u - uOfV(PLR))/10)*10} m di depan` : ' · berlaku di zona berikutnya'; };
  const label = () => { const row = rowsSpec().find(r => r[0] === id), o = row && row[2].find(x => String(x[0]) === String(v)); return o ? o[1] : v; };
  if (id === 'cam') { setCam(v); toast(`Kamera: ${label()}`); }
  else if (id === 'tod') { setTod(v); cfg.tod = ''; saveCfg(); toast(`Jam game diatur ke ${hhmm(gameH)}`); }
  else if (id === 'tspd') toast(`Jam game: ${label()}`);
  else if (id === 'weather') { lastSign = -1; tickClock(0); toast(`Cuaca: ${label()}`); }
  else if (id === 'roadStyle') { setRoadStyle(); toast(`Gaya jalan: ${label()}`); }
  else if (id === 'view') { setView(); updateWorld(); tickClock(0); toast(`Jarak pandang: ${label()}`); }
  else if (id === 'autoSteer') { if (PLR) PLR.autoLane = null; toast(`Setir otomatis: ${v ? 'aktif, gas & rem manual' : 'mati'}`); }
  else if (id === 'sound') { if (v) audioStart(); toast(`Suara: ${v ? 'nyala' : 'mati'}`); }
  else if (id === 'clean') setClean();
  else if (id === 'gfx') { applyGfx(); toast(`Grafis: ${label()}`); }
  else if (id === 'steerAssist') toast(`Asisten setir: ${v ? 'aktif' : 'mati'}`);
  else if (id === 'den') { fillTraffic(); rebuildObjects(['site', 'ov']); toast(`Lalu lintas: ${label()}`); }
  else if (id === 'cf' || id === 'cfk') { const msg = cfg.cf ? ahead('cf') : ''; applyTraffic(['cf', 'ut']); fillTraffic(); updateWorld(); toast(`Contraflow: ${cfg.cf ? (cfg.cfk >= 9 ? 'semua lajur' : cfg.cfk + ' lajur') + (cfg.cf > 0 ? ' untuk arah saya' : ' untuk arah lawan') : 'mati'}${msg}`); }
  else if (id === 'ovl') { rebuildObjects(['ov']); toast(`Jalan overpass: ${label()}`); }
  else if (id === 'lanes' || id === 'scale') { toast(id === 'lanes' ? `Jumlah lajur: ${label()}` : `Skala jarak: ${label()}`); setTimeout(() => startDrive({from: trip.from, legs: trip.dest ? trip.legs : trip.allLegs, dest: trip.dest, keepPos: true}), 30); }
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
  ['Bekasi → Bogor', 'Bekasi Barat', 'Bogor'], ['Bandung → Cirebon', 'Buahbatu', 'Kedawung'], ['Semarang → Solo', 'Krapyak', 'Colomadu'], ['Surabaya → Malang', 'Dupak', 'Malang'],
  ['JORR 2: Bandara → Pamulang', 'Bandara Soekarno-Hatta', 'Pamulang', 'toll'], ['JORR 2: Pamulang → Setu', 'Pamulang', 'Setu', 'toll']];
const legHours = legs => legs.reduce((a, l) => { const c = CORR[l.c], km = Math.abs(c.nodes.find(n => n.key === l.b).km - c.nodes.find(n => n.key === l.a).km); return a + km/({t: 90, n: 50, a: 30}[c.cls]); }, 0);
let firstPick = null;
function planPreview(){
  const free = cfg.trip === 'free' || cfg.trip === 'santai' || cfg.trip === 'mp', el = $('preview');
  $('mp-field').hidden = cfg.trip !== 'mp'; $('from').disabled = cfg.trip === 'mp'; if (cfg.trip === 'mp' && [...$('from').options].some(o => o.value === MP_SPAWN)) $('from').value = MP_SPAWN;
  $('to-field').hidden = $('swap').hidden = $('presets-field').hidden = free; $('first-field').hidden = !free;
  [...$('tripsel').children].forEach(c => c.setAttribute('aria-pressed', c.dataset.t === (cfg.trip || 'route') ? 'true' : 'false'));
  if (free) {
    const from = $('from').value, ch = choicesAt(from, null, 'mix'), fs = $('firstsel'); fs.innerHTML = '';
    if (firstPick && !ch.some(o => o.e === firstPick)) firstPick = null;
    const a = btn('Otomatis', !firstPick); a.onclick = () => { firstPick = null; planPreview(); }; fs.append(a);
    for (const o of ch) { const b = btn(`${o.road} → ${o.toward}`, firstPick === o.e); b.onclick = () => { firstPick = o.e; planPreview(); }; fs.append(b); }
    const t = tripFromLegs(from, walkFree(from, null, null, firstPick, 60, 'mix'), null, 'mix'); $('go').disabled = !t;
    el.innerHTML = '';
    const d = document.createElement('div'); d.className = 'big'; d.textContent = cfg.trip === 'santai' ? 'Santai' : 'Keliling bebas'; el.append(d);
    if (cfg.trip === 'santai') { const s0 = document.createElement('div'); s0.textContent = 'Jalan tanpa ujung untuk bersantai: autopilot, HUD ringkas (tekan H), jalan lebih berkelok dan berbukit, jarak pandang jauh, lalu lintas sepi, sore hari. Cuaca bisa diganti di Pengaturan.'; el.append(s0); }
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
  for (const [k, l] of [['route', 'Rute (A → B)'], ['free', 'Keliling bebas'], ['santai', 'Santai (ala Slow Roads)'], ['mp', 'Multiplayer']]) { const x = btn(l, (cfg.trip || 'route') === k); x.dataset.t = k; x.onclick = () => { cfg.trip = k; saveCfg(); planPreview(); }; ts.append(x); }
  const pr = $('presets'); pr.innerHTML = '';
  for (const [label, a, b, m] of PRESETS) { const x = btn(label, false); x.onclick = () => { $('from').value = a; $('to').value = b; setMode(m || 'mix'); planPreview(); }; pr.append(x); }
  const ms = $('modesel'); ms.innerHTML = '';
  for (const [k, l] of MODES) { const x = btn(l, cfg.mode === k); x.dataset.m = k; x.onclick = () => { setMode(k); planPreview(); }; ms.append(x); }
  buildModUI(); $('mp-field').hidden = cfg.trip !== 'mp'; $('m-name').value = cfg.name || '';
  $('m-name').onchange = e => { cfg.name = e.target.value.replace(/[^\w .\-]/g, '').slice(0, 16).trim(); saveCfg(); };
  const vs = $('vehsel'); vs.innerHTML = '';
  for (const [k, s] of Object.entries(VEH)) { const x = btn(`${s.label} · ${s.gol}`, cfg.veh === k); x.onclick = () => { cfg.veh = k; [...vs.children].forEach(c => c.setAttribute('aria-pressed', 'false')); x.setAttribute('aria-pressed', 'true'); }; vs.append(x); }
  firstPick = null; planPreview(); $('plan').hidden = false; $('done').hidden = true;
}
$('from').onchange = () => { firstPick = null; planPreview(); }; $('to').onchange = planPreview;
$('swap').onclick = () => { const a = $('from').value; $('from').value = $('to').value; $('to').value = a; planPreview(); };
$('go').onclick = () => { $('plan').hidden = true; cfg.from = $('from').value; if (cfg.trip !== 'free') cfg.to = $('to').value; saveCfg();
  if (cfg.trip === 'santai') { Object.assign(cfg, {auto: true, clean: true, roadStyle: 'kelok', view: 'jauh', den: 0.6}); gameH = 16.4; saveCfg(); setRoadStyle(); setView(); setClean(); hudAuto(); setTod(null); }
  if (cfg.trip === 'mp') { cfg.auto = false; hudAuto(); startDrive({from: MP_SPAWN}); mpSpawnShoulder(); mpConnect(); if (mp.ready) mp.ch.track(mpMe()); return; }
  mpLeave();
  if (cfg.trip === 'free' || cfg.trip === 'santai') startDrive({from: cfg.from, first: firstPick}); else startTrip(cfg.from, cfg.to); };
$('plan-close').onclick = () => { if (trip) $('plan').hidden = true; };

// leaving the route on a ramp or at an intersection keeps you driving: the trip continues from that place
function finishExit(site){
  const v = PLR;
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
  if (PLR) { PLR.hd = 0; PLR.steer = 0; }
  if (cfg.auto && PLR && !PLR.rp) { const n = nAvail(PLR.sd, PLR.p); PLR.lane = clamp(Math.round(PLR.lx), 0, n - 1); if (PLR.vel < 0) PLR.vel = 0; }
  toast(cfg.auto ? 'Autopilot aktif: mengikuti rute dan aturan sampai tujuan' : 'Kemudi manual: bebas, pelanggaran tetap dicatat'); };
$('mapb').onclick = () => openAtlas();
{ const hb = $('hornb'); hb.addEventListener('pointerdown', e => { e.preventDefault(); playerHorn(true); hb.setPointerCapture && hb.setPointerCapture(e.pointerId); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) hb.addEventListener(ev, () => playerHorn(false)); }
$('mp-in').addEventListener('keydown', e => { if (e.key === 'Escape' || (!e.target.value && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key))) { e.target.blur(); e.preventDefault(); } });
renderer.domElement.addEventListener('pointerdown', () => { const a = document.activeElement; if (a && a.blur && (a.tagName === 'INPUT' || a.tagName === 'SELECT')) a.blur(); });
$('mp-form').onsubmit = e => { e.preventDefault(); mpSay($('mp-in').value); $('mp-in').value = ''; $('mp-in').blur(); };
$('mp-voice').onclick = () => mpVoice(!mp.voice); $('mp-mic').onclick = () => mp.mic ? (mpMicOff(), mpLine('Mikrofon dimatikan', 'sys')) : mpMicOn();
// the chat / voice panel can be dragged by its title bar (mouse or touch); the place is remembered
{ const box = $('mpbox'), place = (x, y) => { const r = box.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    x = clamp(x, 4, Math.max(4, W - r.width - 4)); y = clamp(y, 4, Math.max(4, H - r.height - 4)); Object.assign(box.style, {left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto'}); return [x, y]; };
  let d = null;
  const start = e => { if (e.button > 0) return; const r = box.getBoundingClientRect(); d = {dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId}; box.classList.add('drag'); e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); e.preventDefault(); };
  for (const el of [$('mp-grip'), box.querySelector('.mp-head b')]) { el.addEventListener('pointerdown', start);
    el.addEventListener('pointermove', e => { if (d && e.pointerId === d.id) place(e.clientX - d.dx, e.clientY - d.dy); });
    for (const ev of ['pointerup', 'pointercancel']) el.addEventListener(ev, () => { if (!d) return; d = null; box.classList.remove('drag'); const r = box.getBoundingClientRect(); cfg.mpPos = [Math.round(r.left), Math.round(r.top)]; saveCfg(); }); }
  const restore = () => { if (cfg.mpPos && !box.hidden) place(cfg.mpPos[0], cfg.mpPos[1]); };
  addEventListener('resize', restore); new MutationObserver(restore).observe(box, {attributes: true, attributeFilter: ['hidden']}); }
$('mp-min').onclick = () => { $('mpbox').classList.toggle('min'); $('mp-min').title = $('mpbox').classList.contains('min') ? 'Besarkan' : 'Kecilkan'; };
addEventListener('beforeunload', () => mpLeave());
try { window.lucide && window.lucide.createIcons(); } catch (e) {}
$('pin-form').onsubmit = e => { e.preventDefault(); srvAdminCheck($('pin-in').value); }; $('pin-close').onclick = () => { $('pin').hidden = true; };
$('adm-close').onclick = () => { $('adm').hidden = true; }; $('adm-refresh').onclick = admLoad;
$('musb').onclick = () => { const m = $('music'); m.hidden = !m.hidden; m.classList.remove('min'); if (!m.hidden) { musRecentUI(); setTimeout(() => $('mus-in').focus(), 30); } };
$('mus-form').onsubmit = e => { e.preventDefault(); musSubmit(); };
$('mus-min').onclick = () => $('music').classList.toggle('min'); $('mus-close').onclick = () => { musStop(); $('music').hidden = true; };
$('mus-in').addEventListener('keydown', e => { if (e.key === 'Escape' || (!e.target.value && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key))) { e.target.blur(); e.preventDefault(); } });
{ const box = $('music'), grip = $('mus-grip'); let d = null;
  grip.addEventListener('pointerdown', e => { const r = box.getBoundingClientRect(); d = {dx: e.clientX - r.left, dy: e.clientY - r.top}; grip.setPointerCapture(e.pointerId); e.preventDefault(); });
  grip.addEventListener('pointermove', e => { if (!d) return; const r = box.getBoundingClientRect(); Object.assign(box.style, {left: clamp(e.clientX - d.dx, 4, innerWidth - r.width - 4) + 'px', top: clamp(e.clientY - d.dy, 4, innerHeight - 40) + 'px', right: 'auto'}); });
  for (const ev of ['pointerup', 'pointercancel']) grip.addEventListener(ev, () => { d = null; }); }
$('jobb').onclick = openJobs; $('job-close').onclick = () => { $('jobdlg').hidden = true; }; $('job-stop').onclick = () => { jobStop(); $('jobdlg').hidden = true; toast('Berhenti bekerja'); };
$('peaceb').onclick = makePeace; $('svcb').onclick = openSvc; $('svc-close').onclick = () => { $('svc').hidden = true; }; $('towb').onclick = () => callTow();
$('mirb').onclick = () => { cfg.mirror = cfg.mirror === false; saveCfg(); $('mirb').setAttribute('aria-pressed', cfg.mirror !== false ? 'true' : 'false'); toast(cfg.mirror !== false ? 'Spion menyala (kokpit: spion kiri, tengah, kanan)' : 'Spion dimatikan'); };
$('mirb').setAttribute('aria-pressed', cfg.mirror !== false ? 'true' : 'false');
$('fsb').hidden = !fsOK; $('fsb').onclick = toggleFull; $('walkb').onclick = footToggle;
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => { const on = !!(document.fullscreenElement || document.webkitFullscreenElement); $('fsb').setAttribute('aria-pressed', on ? 'true' : 'false'); $('fsb').querySelector('.bl').textContent = on ? 'Keluar layar penuh' : 'Layar penuh'; setTimeout(() => dispatchEvent(new Event('resize')), 120); });
$('sirb').onclick = () => { cfg.siren = !cfg.siren; saveCfg(); sirenUI(); toast(cfg.siren ? 'Sirene & rotator menyala — kendaraan lain memberi jalan' : 'Sirene dimatikan'); };
$('hudb').onclick = () => { cfg.clean = !cfg.clean; saveCfg(); setClean(); renderUI(); toast(cfg.clean ? 'HUD ringkas' : 'HUD normal'); };
$('camb').onclick = () => { const order = ['chase', 'cockpit', 'drone', 'ic', 'orbit'], m = order[(order.indexOf(cfg.cam) + 1) % order.length]; apply('cam', m); };
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('atlas').hidden) { closeAtlas(); return; }
  if (e.target.closest && e.target.closest('select,input')) return;
  const k = e.key.toLowerCase();
  if (k === 'enter' && mp.on && !$('mpbox').hidden) { $('mpbox').classList.remove('min'); $('mp-in').focus(); e.preventDefault(); return; }
  if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(k) && !document.body.classList.contains('kbd')) document.body.classList.add('kbd');
  if (k === 'arrowup' || k === 'w') { input.gas = true; manualNow(); e.preventDefault(); }
  else if (k === 'arrowdown' || k === 's') { input.brake = true; manualNow(); e.preventDefault(); }
  else if (k === 'arrowleft' || k === 'a') { input.left = true; manualNow(); e.preventDefault(); }
  else if (k === 'arrowright' || k === 'd') { input.right = true; manualNow(); e.preventDefault(); }
  else if (k === 'p' && !e.repeat) $('auto').click();
  else if (k === 'h' && !e.repeat) $('hudb').click();
  else if (k === 'c' && !e.repeat) $('camb').click();
  else if (k === 'v' && !e.repeat) $('mirb').click();
  else if (k === 'u' && !e.repeat) $('musb').click();
  else if (k === 'j' && !e.repeat) { if ($('jobdlg').hidden) openJobs(); else $('jobdlg').hidden = true; }
  else if (k === 'l' && !e.repeat && !$('svcb').hidden) openSvc();
  else if (k === 't' && !e.repeat && !$('towb').hidden) callTow();
  else if (k === 'k' && !e.repeat) playerHorn(true);
  else if (k === 'e' && !e.repeat) footToggle();
  else if (k === 'shift') input.run = true;
  else if (k === 'f' && !e.repeat && fsOK) toggleFull();
  else if (k === 'n' && !e.repeat && PLR && EMERG.has(PLR.type)) $('sirb').click();
  else if (k === 'm' && !e.repeat) { if ($('atlas').hidden) openAtlas(); else closeAtlas(); } });
addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (k === 'k') playerHorn(false); if (k === 'shift') input.run = false; if (k === 'arrowup' || k === 'w') input.gas = false; if (k === 'arrowdown' || k === 's') input.brake = false;
  if (k === 'arrowleft' || k === 'a') input.left = false; if (k === 'arrowright' || k === 'd') input.right = false; });
addEventListener('blur', () => { input.gas = input.brake = input.left = input.right = false; playerHorn(false); });
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
const MBZ_OK = new Set(['car', 'suv', 'pickup', 'police', 'taxi']);
function startDrive({from, first = null, dest = null, legs = null, keepPos = false, cont = false, prev = null, home}){
  if (job) jobStop();
  RULES.noMbz = !MBZ_OK.has(cfg.veh || 'car'); RULES.noToll = cfg.veh === 'moto';     // motorbikes may not use toll roads
  legs = legs || legsFor(from, first, dest, prev);
  const t = legs && legs.length ? tripFromLegs(from, legs, dest, cfg.mode) : null; if (!t) { toast('Rute tidak ditemukan', 'bad'); return false; }
  t.home = home !== undefined ? home : (cont || keepPos) && trip ? trip.home : (dest ? from : null);
  const keepU = keepPos && PLR ? rkAt(uOfV(PLR)) : null;
  clearWorld(); vehicles.forEach(killVehicle); rampers.forEach(killVehicle); locals.forEach(killVehicle); vehicles = []; rampers = []; locals = []; PLR = null; PCACHE.clear();
  EV = []; ZONES = []; OVS = []; OPENS = [];
  layoutTrip(t);
  if (!cont && !keepPos) { Object.assign(stats, {t0: clock, toll: 0, viol: 0, crashes: 0, lastPay: 0, km0: 0, log: []}); WAL.fuel = null; WAL.sleep = 0; }
  Object.assign(stats, {missed: false, done: false});
  spawnPlayer();
  setTimeout(precompile, 1500);
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
  const vel = PLR ? Math.max(0, PLR.vel) : 0; blink();
  const ok = startDrive({from: site.key, first: ed, dest, cont: true, prev: prevKeyOf(site)});
  if (!ok) return;
  if (vel > 1) PLR.vel = Math.min(vel, limitAt(uOfV(PLR)));
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
function relayout(t, keepN, keepSite = false){
  const s0 = EV[keepN], before = s0 && [s0.kind, s0.cNext, !!s0.turn].join();
  layoutTrip(t, keepN);
  const s1 = EV[keepN], changed = !s0 || before !== [s1.kind, s1.cNext, !!s1.turn].join(), cut = s1.u;
  const byRef = new Map(OBJ.map(o => [o.s || o.z || o.o, o]));
  for (const [o, gs] of [...built]) { built.delete(o); const n = byRef.get(o.s || o.z || o.o);
    if (n && n.type === o.type && !(changed && o.s === s1 && !keepSite)) { built.set(n, gs); continue; }
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
function replan(i, tail, dest, keepSite = false, fix = null){
  const e = EV[i], legs = trip.allLegs.slice(0, e.legIdx + 1).concat(tail);
  const t = tripFromLegs(trip.from, legs, dest, cfg.mode); if (!t) return false;
  if (fix) fix(t);
  t.home = trip.home; relayout(t, i, keepSite); return true;
}
// the player took a junction ramp: from here on the main road is the road that ramp leads to
function seamlessTurn(s, ed){
  const nl = trip.allLegs[s.legIdx + 1];
  if (nl && nl.b === ed.to && nl.c === ed.c) return true;            // already the plan
  const dest = trip.dest && trip.dest !== s.key ? trip.dest : null;
  const rest = dest ? (ed.to === dest ? [] : legsFor(ed.to, null, dest, s.key)) : walkFree(ed.to, s.key, ed.c, null, 50, 'mix');
  if (!rest) return false;
  return replan(s.i, [{a: s.key, b: ed.to, c: ed.c}].concat(rest), dest, true);
}
// exit ramp taken: the road after this exit becomes the access road to town (the site stays a normal exit)
function seamlessExit(s){
  if (s.i === trip.destIdx) return false;            // the destination: arrive at the end of the ramp
  const ed = exitEdge(s); if (!ed) return false;
  const dest = trip.dest && trip.dest !== s.key ? trip.dest : null;
  const rest = dest ? (ed.to === dest ? [] : legsFor(ed.to, null, dest, s.key)) : walkFree(ed.to, s.key, ed.c, null, 50, 'mix');
  if (!rest) return false;
  return replan(s.i, [{a: s.key, b: ed.to, c: ed.c}].concat(rest), dest, true, t => { t.ev[s.i].kind = s.kind; });
}
// left turn at a town intersection: the main road continues as the road to the left
function seamlessLeft(v, ks, le){
  const dest = trip.dest && trip.dest !== ks.key ? trip.dest : null;
  const rest = dest ? (le.to === dest ? [] : legsFor(le.to, null, dest, ks.key)) : walkFree(le.to, ks.key, le.c, null, 50, 'mix');
  if (!rest || !replan(ks.i, [{a: ks.key, b: le.to, c: le.c}].concat(rest), dest, true)) return false;
  const n = nAvail(v.sd, v.p); v.p = Math.max(v.p, v.sd*ks.u + SL + 8); v.lane = n - 1; v.lx = n - 1; v.x = posX(-v.sd, v.lx); v.hd = 0; v.steer = 0;
  for (const o of [...vehicles]) if (o !== v && o.sd === v.sd && Math.abs(o.p - v.p) < 30) { rm(vehicles, o); killVehicle(o); }
  blink(); hudLane(); toast(`Belok kiri · ${CORR[EV[ks.i].cNext].name}`); return true;
}
// a full U-turn: the trip now runs back the other way from the place ahead, and the car keeps its spot, speed and lane
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
function uTurn(v){
  const u0 = uOfV(v), i = evAt(u0); let ia = -1;
  for (let j = Math.max(i + 1, 1); j < EV.length; j++) if (EV[j].end) { ia = j; break; }
  if (ia < 0) return false;
  const A = EV[ia], leg = trip.allLegs[A.legIdx]; if (!leg) return false;
  const rev = {a: A.key, b: leg.a, c: leg.c}, dest = trip.dest && trip.dest !== A.key ? trip.dest : null;
  const rest = dest ? (rev.b === dest ? [] : legsFor(rev.b, null, dest, A.key)) : walkFree(rev.b, A.key, rev.c, null, 50, 'mix');
  if (!rest) return false;
  const dRk = A.rk - rkAt(u0), owed = isToll(u0) ? Math.max(0, rkAt(u0) - stats.lastPay) : 0;
  const vel = v.vel, lane = Math.max(0, Math.round(-v.lx - 1)), hd = wrapA(v.hd - Math.PI*Math.sign(v.hd));
  stats.km0 = (stats.km0 || 0) + rkAt(u0) - dRk;
  blink();
  if (!startDrive({from: A.key, legs: [rev, ...rest], dest, cont: true})) return false;
  const P = PLR; let u = 0;
  for (let j = 1; j < EV.length; j++) if (EV[j].rk >= dRk) { const a = EV[j-1], b = EV[j]; u = a.u + (b.u - a.u)*(dRk - a.rk)/((b.rk - a.rk) || 1); break; }
  P.p = Math.max(5, u); camU = P.p; const n = nAvail(1, P.p);
  Object.assign(P, {lane: Math.min(lane, n - 1), vel: Math.max(0, vel), acc: 0, hd, steer: 0, yaw: -hd}); P.lx = P.lane; P.x = posX(-1, P.lx);
  for (const o of [...vehicles]) if (o !== P && o.sd === 1 && Math.abs(o.p - P.p) < 45) { rm(vehicles, o); killVehicle(o); }
  stats.lastPay = dRk - owed;
  setupBlocks(true); updateWorld(); fillTraffic(); hudLane(); toast('Putar balik');
  return true;
}
function blink(){ const f = $('fade'); if (!f) return; f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 260); }
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
let choiceSig = '', chT = 0;
function chOpen(on){ $('ch-opts').hidden = !on; $('ch-sum').setAttribute('aria-expanded', on ? 'true' : 'false'); $('ch-sum').querySelector('u').textContent = on ? 'Tutup' : 'Ubah';
  clearTimeout(chT); if (on) chT = setTimeout(() => chOpen(false), 12000); }
$('ch-sum').onclick = () => chOpen($('ch-opts').hidden);
function updateChoice(u){
  const el = $('choice');
  const di = trip && !trip.dest && !stats.done && PLR && !PLR.rp ? replanIdx(u, true) : -1;
  if (di < 0) { el.hidden = true; choiceSig = ''; return; }
  const e = EV[di], prev = prevKeyOf(e), nl = trip.allLegs[e.legIdx + 1], ch = choicesAt(e.key, prev, 'mix');
  const d = Math.max(0, e.rk - rkAt(u));
  $('ch-d').textContent = fmtKm(d);
  const sig = e.i + '|' + (nl ? nl.b + nl.c : '');
  if (sig === choiceSig && !el.hidden) return;
  if (!choiceSig.startsWith(e.i + '|')) chOpen(false);    // a new place: start collapsed
  choiceSig = sig;
  const cur = ch.find(o => nl && nl.b === o.e.to && nl.c === o.e.c); $('ch-pick').textContent = cur ? `${cur.turn} → ${cur.toward}` : '';
  $('ch-name').textContent = e.kind === 'j' ? nodeLabel(e) : e.kind === 'k' ? 'Simpang ' + e.name : e.kind === 'x' || e.kind === 'te' ? 'Exit ' + e.name : e.name;
  const box = $('ch-opts'); box.innerHTML = '';
  for (const o of ch.sort((a, b) => turnDeg(prev, e.key, a.e.to) - turnDeg(prev, e.key, b.e.to))) {
    const on = nl && nl.b === o.e.to && nl.c === o.e.c, b = btn('', on);
    const t = document.createElement('b'); t.textContent = o.turn; const r = document.createElement('span'); r.textContent = `${o.road} → ${o.toward}`;
    b.append(t, r); b.onclick = () => { if (!on) chooseAt(e.i, o.e); chOpen(false); };
    box.append(b); }
  el.hidden = false;
}

try { await Promise.race([Promise.all(['700 64px Archivo', '600 64px Overpass', '700 64px Overpass', '800 64px Overpass'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]); } catch(e) {}
setRoadStyle(); setView(); setClean(); setTod(null);
if (cfg.trip === 'free' || cfg.trip === 'santai') startDrive({from: NODES.has(cfg.from) ? cfg.from : DEF.from}); else startTrip(NODES.has(cfg.from) ? cfg.from : DEF.from, NODES.has(cfg.to) ? cfg.to : DEF.to);
if (!localStorage.getItem('tj_seen')) { try { localStorage.setItem('tj_seen', '1'); } catch(e) {} openPlanner(); }
window.__tj = {get PLR(){ return PLR; }, get EV(){ return EV; }, get trip(){ return trip; }, get clock(){ return clock; }, get vehicles(){ return vehicles; }, get rampers(){ return rampers; }, cfg, camera, startTrip, input, geo: () => ({OVS, ssPath, trOut, trIn, restPath, offPts, onPts, smooth, detourOut, detourIn, RE, SC, PRC, PR_IN, DK, FAR, GATE_O, MED, LW}), look: (...a) => { window.__tjCam = a; camMode = 'dbg'; }, siteU: name => EV.find(e => e.name === name), get camU(){ return camU; }, get frames(){ return frames; }, dbg: () => { const v = PLR; if (v.rp) { const sd = v.rp.sd, p = v.rp.pc + v.q.u - v.rp.shift, n = nAvail(sd, p), fr = p + v.len/2; return {rp: true, p, n, qu: v.q.u, mergeAt: v.rp.mergeAt, len: v.rp.P.len, d: v.rp.d, sf: [n-1, n-2].map(l => spanFree(sd, l, p - v.len/2 - 2, fr + 2)), ba: [n-1, n-2].map(l => blockAhead(sd, l, fr)), g: [n-1,n-2].map(l => { const g = gapInfo(v, laneList(sd, l)); return [g.ld, g.fd]; }), CFA: CFA.map(z => ({A: z.A, bStart: z.bStart, bEnd: z.bEnd, oneWay: z.oneWay})), near: vehicles.filter(o => o.sd === sd && Math.abs(o.p - p) < 80).map(o => [Math.round(o.p), o.lane, +o.vel.toFixed(1)]) }; } const g = gapInfo(v, laneList(v.sd, v.lane)); return {ba: blockAhead(v.sd, v.lane, v.p + v.len/2), ld: g.ld, lead: g.lead && {p: g.lead.p, vel: g.lead.vel, type: g.lead.type, lane: g.lead.lane}, n: nAvail(1, v.p), acc: v.acc, CFA: CFA.length, blocks: [...blocks.keys()], zones: ZONES.slice(0,4)}; }, get stats(){ return stats; }, get built(){ return built; }, setCam, startDrive, setNav, clearNav, chooseAt, replanIdx, openAtlas, closeAtlas, atTap, AT, get chunks(){ return chunks; }, get OBJ(){ return OBJ; }, sutetTower, setHour: h => { gameH = h; todT = 0; lastSign = -1; tickClock(0); }, get gameH(){ return gameH; }, volcanoes, updateVolcanoes, regionAt, latLonAt, get ELV(){ return ELV; }, elU, elevAt, get LMS(){ return LMS; }, angry, startAngry, mp, mpConnect, mpSay, get render(){ return {...renderer.info.render}; }, get QUAL(){ return QUAL; }, get mem(){ return {...renderer.info.memory, veh: vehicles.length, ramp: rampers.length, loc: locals.length, chunks: chunks.size, built: built.size}; }, callTow, get tow(){ return tow; }, WAL, openSvc, updateLandmarks, updateRoadSigns, RSIGNS, FX, footToggle, get foot(){ return foot; }};

let last = performance.now(), mapT = 0, frames = 0;
function tick(dt){
  clock += dt;
  if (PLR && PLR.wantU) { PLR.wantU = false; uTurn(PLR); }
  stepFoot(dt); tickNeeds(dt); stepTow(dt); stepAngry(dt); mpTick(dt); sim(dt); mbzTraffic(); rampStep(dt); jobTick(dt); maintainTraffic(dt); simLocals(dt); playerRules(dt); tickClock(dt);
  if (PLR) camU = foot ? foot.u : uOfV(PLR);
  ensureAhead();
  setupBlocks(false); updateWorld(true); updateSignals(); animGhosts();
}
window.__tj.jobs = {start: k => jobStart(k), get job(){ return job; }, stop: () => jobStop()}; window.__tj.signTex = {exitPanel, textPanel, bigBoard, destPanel, boardPanel}; window.__tj.mbz = () => MBZG; window.__tj.mbzRampAt = mbzRampAt; window.__tj.NODES = NODES; window.__tj.kmAt = kmAt; window.__tj.addVehicle = addVehicle; window.__tj.nAvail = nAvail; window.__tj.isToll = isToll;
window.__tj.jump = u => { PLR.p = u; camU = u; PLR.lane = PLR.lx = Math.min(PLR.lane, nAvail(1, u) - 1); PLR.vel = 20; setupBlocks(true); updateWorld(); fillTraffic(); for (const v of [...vehicles]) if (!v.player && v.lane === PLR.lane && Math.abs(v.p - PLR.p) < 40) { rm(vehicles, v); killVehicle(v); } };
// test hook: advance the simulation without rendering
window.__tj.step = (n, dt = 1/20) => { for (let i = 0; i < n; i++) tick(dt); updateSegs(); placeGroups(); place(); for (let k = 0; k < 40; k++) updateCam(dt); updateBend(); hudT = 0; updateHud(dt); drawMap(); };
// automatic quality: if the frame rate stays low, step down (shadows less often, lower resolution, no bloom, shorter view)
const QUAL = {level: 0, acc: 0, n: 0, slow: 0, t: 0, pr0: renderer.getPixelRatio()};
function govern(rawDt, force = false){
  if (!force) { QUAL.acc += rawDt; QUAL.n++; QUAL.t += rawDt; } if (QUAL.t < 1) return;
  const fps = force ? 0 : QUAL.n/QUAL.acc; QUAL.acc = QUAL.n = QUAL.t = 0; if (document.hidden && !force) return;
  if (cfg.gfx === 'tinggi' && !force) return;
  QUAL.slow = fps < 38 ? QUAL.slow + 1 : 0; if (QUAL.slow < 3 || QUAL.level >= 5) return; QUAL.slow = 0; const L = ++QUAL.level;
  if (L === 1) { renderer.shadowMap.autoUpdate = false; }
  if (L === 2) { renderer.setPixelRatio(Math.max(0.75, QUAL.pr0*0.7)); composer.setSize(innerWidth, innerHeight); }
  if (L === 3) { bloom.enabled = false; }
  if (L === 4) { sun.castShadow = false; renderer.shadowMap.enabled = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
  if (L === 5) { renderer.setPixelRatio(Math.max(0.6, QUAL.pr0*0.5)); composer.setSize(innerWidth, innerHeight); scene.fog.far *= 0.8; }
  if (!force) toast(`Grafis diturunkan otomatis agar lancar (tingkat ${L})`);
}
// graphics preset (a personal setting): Hemat starts at the lightest level, Sedang in the middle; Otomatis / Tinggi let the governor decide
function applyGfx(){ const want = {hemat: 5, sedang: 2}[cfg.gfx] || 0;
  if (want > QUAL.level) { while (QUAL.level < want) { QUAL.slow = 3; QUAL.t = 1; govern(0, true); } } }
applyGfx();
// shaders compiled up front, so new objects do not stutter the first time they appear
let precompiled = false;
function precompile(){ if (precompiled) return; precompiled = true; try { renderer.compile(scene, camera); } catch (e) {} }
let shadowFrame = 0;
renderer.setAnimationLoop(now => {
  const rawDt = (now - last)/1000, dt = Math.min(0.05, rawDt); last = now; frames++; if (rawDt > 0 && rawDt < 1) govern(rawDt);
  if (QUAL.level >= 1 && renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = (shadowFrame = (shadowFrame + 1) % 3) === 0;
  if ((!$('plan').hidden && trip && !stats.done) || !$('atlas').hidden) { composer.render(); return; }
  tick(dt);
  placeGroups(); place(); placeFoot(); placeTow(); placeJob(); mpPlace(); placeBeams(); placeAngry(); updateCam(dt); updateVolcanoes(dt); updateLandmarks(); updateRoadSigns(); updateFx(dt); updateSky(dt); updateSound(); flash(); updateBend(); updateHud(dt);
  mapT -= dt; if (mapT <= 0) { mapT = 0.5; drawMap(); if (mp.on && !atlas.hidden) reqAtlas(); }
  composer.render(); drawMirrors(dt);
});
addEventListener('resize', () => { camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); composer.setSize(innerWidth,innerHeight); drawMap(); reqAtlas(); });
