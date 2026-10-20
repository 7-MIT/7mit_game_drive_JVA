// The ferry crossing in 3D: a Ro-Ro ferry (KMP Nusantara Jaya) on the strait, filmed by a drone while the player's vehicle is on board.
// Built once on the first crossing (main.js, ferryVoyage) and drawn with the game's renderer instead of the road while the ship sails.
// The sky, sea and light follow the game clock: day, golden hour (morning and evening) and night.
import * as THREE from 'three';
const C = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

// colours and sun for an hour of the day
export function ferryLight(h){
  const day = h >= 8 && h < 16, gold = (h >= 5.6 && h < 8) || (h >= 16 && h < 18.4);
  const el = day ? 0.35 + 0.5*Math.sin((h - 8)/8*Math.PI) : gold ? 0.1 : 0.55, az = h < 12 ? 0.9 : -0.9;
  if (day) return {el, az, hz: 0xcfe0ee, zn: 0x3d7cc4, sea: 0x1d5a7a, sea2: 0x3f8fa3, sun: 0xfff4e2, si: 2.8, hemi: 1.1, cloud: [0.95, 0.96, 0.98], night: false};
  if (gold) return {el, az, hz: 0xf6c08a, zn: 0x2f6aa8, sea: 0x174a66, sea2: 0x3a8597, sun: 0xffd2a0, si: 3.0, hemi: 0.9, cloud: [1.0, 0.83, 0.62], night: false};
  return {el, az, hz: 0x2a3a56, zn: 0x070c18, sea: 0x0a1c2c, sea2: 0x163a52, sun: 0xa9bfe6, si: 0.9, hemi: 0.4, cloud: [0.18, 0.2, 0.26], night: true};
}
export function buildFerryScene({hour = 17, mobile = false} = {}){
  const LT = ferryLight(hour), sunElev = LT.el, sunAz = LT.az;
  const scene = new THREE.Scene();
  const sunDir = new THREE.Vector3(Math.cos(sunElev)*Math.sin(sunAz), Math.sin(sunElev), -Math.cos(sunElev)*Math.cos(sunAz)).normalize();
  const HORIZON = new THREE.Color(LT.hz), ZENITH = new THREE.Color(LT.zn), SEA = new THREE.Color(LT.sea), SEA2 = new THREE.Color(LT.sea2);
  // sky dome: zenith blue to a warm horizon, a glow around the sun
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), new THREE.ShaderMaterial({side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {sunDir: {value: sunDir}, hz: {value: HORIZON}, zn: {value: ZENITH}, cc0: {value: new THREE.Vector3(...LT.cloud)}, nite: {value: LT.night ? 1 : 0}},
    vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 sunDir, hz, zn, cc0; uniform float nite; varying vec3 vd;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a*n(p); p *= 2.03; a *= .5; } return s; }
      void main(){ float hh = max(vd.y, 0.); vec3 c = mix(hz, zn, pow(hh, .45)); float s = max(dot(vd, sunDir), 0.);
        c += (1. - nite)*vec3(1., .7, .4)*pow(s, 8.)*.6 + mix(vec3(1., .9, .7)*8., vec3(.9, .95, 1.)*2.5, nite)*pow(s, 900.);
        if (nite > .5) c += vec3(1.)*step(.9985, h(floor(vd.xz/(vd.y + .05)*240.)))*smoothstep(.05, .3, vd.y)*.8;
        if (vd.y > .005) { vec2 uv = vd.xz/(vd.y + .06)*1.6; float cl = smoothstep(.48, .78, fbm(uv + vec2(3.1, 1.7)));
          vec3 cc = mix(cc0*.65, cc0, pow(s, 3.)*.8 + .25); c = mix(c, cc, cl*.75*smoothstep(.0, .08, vd.y)); }
        else c = mix(hz*.9, vec3(.3,.35,.4), min(1., -vd.y*4.));
        gl_FragColor = vec4(c, 1.); }`}));
  scene.add(sky);
  // the sea: rolling swell and chop in the vertex shader, sky reflection with Fresnel, the sun's glitter path
  const W = {t: {value: 0}, sunDir: {value: sunDir}, hz: {value: HORIZON}, zn: {value: ZENITH}, deep: {value: SEA}, shal: {value: SEA2}, camPos: {value: new THREE.Vector3()}, shift: {value: 0}, nite: {value: LT.night ? 1 : 0}};
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000, mobile ? 200 : 400, mobile ? 200 : 400).rotateX(-Math.PI/2), new THREE.ShaderMaterial({uniforms: W,
    vertexShader: `uniform float t, shift; uniform vec3 camPos; varying vec3 wp; varying vec3 nrm;
      vec3 wave(vec2 p, vec2 d, float A, float L, float sp){ float k = 6.2832/L, f = k*(dot(d, p) - sp*t); return vec3(A*cos(f)*d.x*.6, A*sin(f), A*cos(f)*d.y*.6); }
      vec3 W(vec2 q){ return wave(q, normalize(vec2(1.,.3)), .9, 60., 6.) + wave(q, normalize(vec2(.2,1.)), .45, 23., 4.) + wave(q, normalize(vec2(-.7,.6)), .22, 11., 3.) + wave(q, normalize(vec2(.9,-.5)), .1, 5., 2.); }
      void main(){ vec3 p = position; p.xz += floor(camPos.xz/20.)*20.; vec2 q = p.xz - vec2(0., shift);
        vec3 o = W(q), ox = W(q + vec2(1.5, 0.)), oz = W(q + vec2(0., 1.5)); p += o;
        nrm = normalize(cross(vec3(0., oz.y - o.y, 1.5), vec3(1.5, ox.y - o.y, 0.)));
        wp = p; gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.); }`,
    fragmentShader: `uniform vec3 sunDir, hz, zn, deep, shal, camPos; uniform float t, shift, nite; varying vec3 wp; varying vec3 nrm;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){ vec3 v = normalize(camPos - wp); vec3 N = normalize(nrm + vec3(n((wp.xz - vec2(0., shift))*.35 + t*.4) - .5, 0., n((wp.zx - vec2(shift, 0.))*.35 - t*.3) - .5)*.18);
        float fr = .03 + .97*pow(1. - max(dot(N, v), 0.), 5.); vec3 r = reflect(-v, N); float rh = max(r.y, 0.);
        vec3 skyc = mix(hz, zn, pow(rh, .55)) + vec3(1., .75, .45)*pow(max(dot(r, sunDir), 0.), 12.)*.6;
        vec3 water = mix(deep, shal, .25 + .25*N.y);
        vec3 c = mix(water, skyc, .1 + .9*fr) + mix(vec3(1., .82, .55)*9., vec3(.8, .88, 1.)*2., nite)*pow(max(dot(r, sunDir), 0.), 350.);
        // foam: the wake fanning out behind the stern (z > 53), white water along the hull and the bow wave (z ≈ −55)
        vec2 fq = wp.xz - vec2(0., shift); float fn = n(fq*.55)*.55 + n(fq*1.9)*.3 + n(fq*5.3)*.15, ax = abs(wp.x), foam = 0.;
        float dz = wp.z - 53.; if (dz > 0.) { float w = 9.5 + dz*.16; foam = smoothstep(w, w*.4, ax)*smoothstep(.32 + dz*.0006, .75, fn)*exp(-dz/420.); foam = max(foam, smoothstep(4., 0., ax)*exp(-dz/60.)*.9); }
        else if (dz > -112.) { float side = smoothstep(2.6, 0., abs(ax - 10.2))*smoothstep(.35, .7, fn); float bw = smoothstep(16., 0., abs(wp.z + 50.))*smoothstep(14., 8., ax)*smoothstep(.3, .65, fn); foam = max(side*.8, bw); }
        c = mix(c, vec3(.93, .95, .96)*(.75 + .35*max(dot(N, sunDir), 0.)), clamp(foam, 0., 1.)*.9);
        float d = length(camPos - wp); c = mix(c, hz*.95, 1. - exp(-d*.00028)); gl_FragColor = vec4(c, 1.); }`}));
  scene.add(sea);
  scene.add(new THREE.HemisphereLight(0xbcd3ef, 0x334455, LT.hemi));
  const sun = new THREE.DirectionalLight(LT.sun, LT.si); sun.position.copy(sunDir).multiplyScalar(400); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); Object.assign(sun.shadow.camera, {left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 1200});
  scene.fog = new THREE.Fog(HORIZON.clone().multiplyScalar(.95), 900, 9000);

  // ---- the ferry: KMP Nusantara Jaya, about 110 m, cars and trucks on the main deck, three passenger decks, bridge forward ----
  const ship = new THREE.Group(); scene.add(ship);
  const L = 110, B = 19, FB = 6.5, DR = 4.5;
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({color: c, roughness: .55, metalness: .1, ...o});
  // hull lofted from cross-sections: bow tapers in the front 28 m, flat stern
  const hw = x => { const f = (x - (L/2 - 28))/28; return x < L/2 - 28 ? B/2 : B/2*Math.sqrt(Math.max(0, 1 - f*f)); };
  const hullGeo = (() => { const N = 60, M = 10, pos = [], idx = [];
    for (let i = 0; i <= N; i++) { const x = -L/2 + L*i/N, w = Math.max(hw(x), .05);
      for (let j = 0; j <= M; j++) { const a = j/M, y = FB - (FB + DR)*a, ww = w*(1 - .25*a*a*a); pos.push(x, y, ww); }
      for (let j = M; j >= 0; j--) { const a = j/M, y = FB - (FB + DR)*a, ww = w*(1 - .25*a*a*a); pos.push(x, y, -ww); } }
    const R = 2*(M + 1); for (let i = 0; i < N; i++) for (let j = 0; j < R - 1; j++) { const a = i*R + j, b = a + R; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; })();
  // hull paint: dark blue topsides with a white stripe and the name, red below the waterline
  const hullTex = C(2048, 256, (x, w, h) => { x.fillStyle = '#9a2a22'; x.fillRect(0, 0, w, h); x.fillStyle = '#16346a'; x.fillRect(0, 0, w, h*.58); x.fillStyle = '#f4f4f0'; x.fillRect(0, h*.13, w, h*.07);
    x.fillStyle = '#ffffff'; x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.fillText('KMP NUSANTARA JAYA', w*.5, h*.44); });
  const uv = []; const pp = hullGeo.attributes.position; for (let i = 0; i < pp.count; i++) uv.push(pp.getZ(i) >= 0 ? (pp.getX(i) + L/2)/L : 1 - (pp.getX(i) + L/2)/L, (pp.getY(i) + DR)/(FB + DR)); hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const hull = new THREE.Mesh(hullGeo, mat(0xffffff, {map: hullTex, side: THREE.DoubleSide})); hull.castShadow = hull.receiveShadow = true; ship.add(hull);
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; ship.add(o); return o; };
  const deck = mat(0x6f7478, {roughness: .9}); box(L - 30, .4, B - .6, deck, -12, FB, 0);
  // window bands for the superstructure
  const win = (n, rows = 1) => C(1024, 128*rows, (x, w, h) => { x.fillStyle = '#f2f1ec'; x.fillRect(0, 0, w, h); for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) { x.fillStyle = (i*7 + r) % 11 ? '#1d2b36' : '#c9a36a'; x.fillRect(i*w/n + 4, r*128 + 38, w/n - 8, 50); } });
  const supM = (n, rep) => { const t = win(n); t.wrapS = THREE.RepeatWrapping; t.repeat.set(rep, 1); return mat(0xffffff, {map: t, emissiveMap: t, emissive: 0xffc27a, emissiveIntensity: LT.night ? 0.45 : 0}); };
  const white = mat(0xf3f2ee);
  // car deck enclosure (open stern with the ramp), then three passenger decks stepping back, the bridge on top
  box(L - 34, 5.2, B - 1, white, -14, FB + 2.8, 0); for (const s of [-1, 1]) box(L - 40, 2.2, .1, mat(0x2a3640), -14, FB + 3, s*(B/2 - .45));
  box(62, 3, B - 1.6, supM(26, 3), -2, FB + 6.9, 0); box(54, 3, B - 2.4, supM(22, 3), 0, FB + 9.9, 0); box(36, 3, B - 4, supM(16, 2), 4, FB + 12.9, 0);
  const bridge = box(12, 3.2, B - 3, mat(0xf3f2ee), 26, FB + 15.9, 0); box(.2, 1.4, B - 3.4, mat(0x10202c, {metalness: .6, roughness: .2}), 32.05, FB + 16.3, 0);
  box(4, 1, B + 2.4, white, 26, FB + 14.6, 0);                                                     // bridge wings
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const lb = box(7, 1.6, 2.2, mat(0xf06a12), -24 + i*12, FB + 9.4, s*(B/2 - .2)); lb.rotation.x = s*.05; }   // lifeboats
  // funnels, mast with radar, the flag at the stern
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 7, 20), mat(0xf2f2ee)); f.position.set(-14, FB + 17, s*3.2); ship.add(f);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, 1.6, 20), mat(0x1d4fa0)); band.position.set(-14, FB + 18.6, s*3.2); ship.add(band);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, .8, 20), mat(0x15181b)); top.position.set(-14, FB + 20.7, s*3.2); ship.add(top); }
  box(.4, 9, .4, mat(0xdfe2e4), 24, FB + 22, 0); const rad = box(4.5, .3, .6, mat(0x222628), 24, FB + 25, 0);
  const flagTex = C(64, 42, (x, w, h) => { x.fillStyle = '#e1251b'; x.fillRect(0, 0, w, h/2); x.fillStyle = '#ffffff'; x.fillRect(0, h/2, w, h/2); });
  box(.15, 6, .15, mat(0xdddddd), -L/2 + 3, FB + 3, 0); const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.1, 12, 4), new THREE.MeshStandardMaterial({map: flagTex, side: THREE.DoubleSide}));
  flag.position.set(-L/2 + 1.4, FB + 5.1, 0); ship.add(flag);
  // the ramp folded up at the stern, railings along the decks
  box(1, 6, B - 6, mat(0x5b6168), -L/2 + 1.2, FB + 3, 0);
  for (const y of [FB + 8.6, FB + 11.6]) for (const s of [-1, 1]) box(52, .9, .06, mat(0xe8e8e4), 0, y, s*(B/2 - .7));
  // foam: the bow wave and a long white wake fanning out behind
  const foamTex = C(512, 512, (x, w, h) => { const g = x.createImageData(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = (j*w + i)*4, cx = Math.abs(i - w/2)/(w/2), n = Math.random();
      const a = Math.max(0, (1 - cx*cx)*(.35 + .65*n))*(.15 + .85*j/h); g.data[k] = g.data[k + 1] = g.data[k + 2] = 255; g.data[k + 3] = a*255; } x.putImageData(g, 0, 0); });
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 30), new THREE.MeshBasicMaterial({map: foamTex, transparent: true, depthWrite: false, opacity: 1, fog: false}));
  { const p = wake.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const v = p.getY(i) + .5; p.setX(i, p.getX(i)*(B + v*90)); p.setY(i, -v*600); } }
  wake.rotation.x = -Math.PI/2; wake.position.set(-L/2 + 2, .35, 0); wake.rotation.z = Math.PI/2; 
  const bow = new THREE.Mesh(new THREE.PlaneGeometry(26, 34), new THREE.MeshBasicMaterial({map: foamTex, transparent: true, depthWrite: false, opacity: .9}));
  bow.rotation.x = -Math.PI/2; bow.rotation.z = -Math.PI/2; 
  // ---- around: islands of the strait in the haze, a volcano cone (Anak Krakatau), a distant port and other ships ----
  const isl = mat(0x3f5f3c, {flatShading: true, roughness: 1});
  const island = (x, z, r, h, cone = false) => { const g = new THREE.ConeGeometry(r, h, cone ? 18 : 9, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { if (p.getY(i) > -h/2 + .1 && !cone) p.setY(i, p.getY(i)*(.55 + Math.random()*.5)); }
    g.computeVertexNormals(); const m = new THREE.Mesh(g, cone ? mat(0x4a4540, {flatShading: true, roughness: 1}) : isl); m.position.set(x, h/2 - 6, z); scene.add(m); return m; };
  island(-2600, -5200, 1100, 240); island(2200, -6400, 1500, 380); island(3600, -3800, 600, 150); island(-1200, -7600, 900, 520, true); island(-5600, 1800, 1800, 280); island(6000, 2400, 2400, 340);
  const other = new THREE.Group(); { const h = new THREE.Mesh(new THREE.BoxGeometry(80, 9, 16), mat(0x1d3a6b)); h.position.y = 2; other.add(h); const s2 = new THREE.Mesh(new THREE.BoxGeometry(48, 9, 14), white); s2.position.set(-4, 11, 0); other.add(s2); }
  other.position.set(-700, 0, -900); other.rotation.y = Math.PI; scene.add(other);
  const tug = new THREE.Group(); { const h = new THREE.Mesh(new THREE.BoxGeometry(22, 4, 7), mat(0x8a1f1f)); tug.add(h); const s2 = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 5), white); s2.position.set(2, 4, 0); tug.add(s2); }
  tug.position.set(320, 0, -1600); scene.add(tug);
  // gulls circling the ship
  const gulls = []; for (let i = 0; i < 9; i++) { const g = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.9, .25, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(.9, .25, 0)]), new THREE.LineBasicMaterial({color: 0x2a2a2a}));
    g.userData = {r: 30 + Math.random()*40, h: 22 + Math.random()*15, ph: Math.random()*6.28, sp: .2 + Math.random()*.15}; gulls.push(g); scene.add(g); }
  const far = scene.children.filter(o => o.isMesh && o.geometry.type === 'ConeGeometry').concat([other, tug]);
  const SPEED = 7.5; let T = 0;
  // the ship heads to −z; the scene is moved so the ship stays near the origin (keeps the numbers small)
  ship.rotation.y = Math.PI/2;
  wake.position.set(0, .35, L/2 - 2); wake.rotation.z = 0; bow.position.set(0, .45, -L/2 + 8); bow.rotation.z = 0;
  return {scene, ship, sun, sunDir, SPEED,
    update(dt, camera){ T += dt; W.t.value = T; W.shift.value = T*SPEED; W.camPos.value.copy(camera.position);
      // the ship rides the swell (heave, pitch, roll); it stays at the origin and the world drifts past (+z)
      ship.position.y = Math.sin(T*.6)*.35; ship.rotation.z = Math.sin(T*.45)*.012; ship.rotation.x = Math.sin(T*.37 + 1)*.02;
      for (const o of far) o.position.z += SPEED*dt;
      const f = flag.geometry.attributes.position; for (let i = 0; i < f.count; i++) { const x = f.getX(i) + 1.6; f.setZ(i, Math.sin(T*6 - x*2.2)*.25*x/3.2); } f.needsUpdate = true;
      rad.rotation.y = T*2.4;
      for (const g of gulls) { const u = g.userData, a = T*u.sp + u.ph; g.position.set(Math.cos(a)*u.r, u.h + Math.sin(T + u.ph)*2, Math.sin(a)*u.r - 20); g.rotation.y = -a; g.scale.set(1, 1 + .6*Math.sin(T*9 + u.ph), 1); } },
    sea};
}
