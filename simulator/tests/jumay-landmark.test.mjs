import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from 'three';
import {jumayBoulevardPlacement} from '../jumay-sites.js';
import {JUMAY_PARKS, JUMAY_LANDMARK, JUMAY_PARK_PLAN, buildJumayHeadquarters, buildJumayPark, jumayParkOverlaps} from '../jumay-landmark.js';

test('headquarters has grounded, finite geometry and a small draw-call budget', () => {
  const previous = globalThis.document, labels = [];
  globalThis.document = {createElement: () => ({getContext: () => ({
    fillRect() {}, fillText(text) { labels.push(text); }
  })})};
  try {
    const root = new THREE.Group();
    buildJumayHeadquarters(root);
    const bounds = new THREE.Box3().setFromObject(root);
    assert.ok(Math.abs(bounds.min.y) < 1e-5);
    assert.ok(bounds.max.y > 140 && bounds.max.y < 150);
    assert.ok(bounds.max.x <= JUMAY_LANDMARK.radius);
    assert.equal(root.children.length, 7);
    let triangles = 0;
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      for (const n of mesh.geometry.attributes.position.array) assert.ok(Number.isFinite(n));
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    });
    assert.ok(triangles < 1000);
    assert.deepEqual(labels, ['JUMAY', 'KANTOR PUSAT JUMAY CORPORATION']);
    const signs = root.children.filter(mesh => mesh.geometry.type === 'PlaneGeometry');
    assert.equal(signs.length, 2);
    assert.equal(signs[0].material, signs[1].material);
    assert.equal(signs[0].material.map.colorSpace, THREE.SRGBColorSpace);
    assert.ok(signs[0].material.emissiveIntensity > 0);
    assert.equal(Math.abs(signs[0].rotation.y - signs[1].rotation.y), Math.PI);
  } finally { globalThis.document = previous; }
});

test('all five parks are registered and placed safely beside their city routes in either direction', () => {
  const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
  const registry = source.slice(source.indexOf('const LMK = ['), source.indexOf('const stoneMat'));
  const landmarks = runInNewContext(registry + '\nLMK', {JUMAY_PARKS});
  assert.equal(landmarks.filter(l => l[3] === 'jumay').length, 5);
  assert.ok(landmarks.some(l => l[0] === JUMAY_LANDMARK.name && l[3] === 'jumay'));
  assert.match(source, /jumay: buildJumayPark/);
  const layout = source.slice(source.indexOf('function layoutLandmarks()'), source.indexOf('function updateLandmarks()'));
  for (const site of JUMAY_PARKS) {
  const {lat, lon, name} = site;
  const near = [{lat: lat - .01, lon: lon - .001, u: 0}, {lat: lat + .01, lon: lon - .001, u: 2200}];
  for (const EV of [near, near.toReversed().map((p, i) => ({...p, u: i * 2200}))]) {
    const LMS = [], context = {EV, LMS, LMK: landmarks, JUMAY_LANDMARK, jumayBoulevardPlacement, SEA: false,
      clamp: (x, a, b) => Math.min(b, Math.max(a, x)), lmEV: null};
    runInNewContext(layout + '\nlayoutLandmarks()', context);
    const headquarters = LMS.find(l => l.name === name);
    assert.ok(Math.abs(headquarters.u - 1100) < 1);
    assert.ok(headquarters.off >= site.radius + 45);
    assert.equal(headquarters.o, site);
    assert.equal(LMS.filter(l => l.kind === 'jumay' && l.u != null).length, 1);
    assert.equal(headquarters.side, EV === near ? 1 : -1);
    context.EV = [{lat: -7, lon: 110, u: 0}, {lat: -7.01, lon: 110, u: 1000}];
    runInNewContext('layoutLandmarks()', context);
    assert.equal(headquarters.u, null);
  }
  }
});

test('Jumay Park includes its headquarters, dense offices and warehouses within safe roadside bounds', () => {
  const previous = globalThis.document, labels = [];
  globalThis.document = {createElement: () => ({getContext: () => ({
    fillRect() {}, fillText(text) { labels.push(text); }
  })})};
  try {
    const root = new THREE.Group(); buildJumayPark(root);
    assert.equal(root.userData.jumayPark, true);
    assert.equal(root.userData.officeCount, 10);
    assert.equal(root.userData.warehouseCount, 16);
    const headquarters = root.children.find(o => o.userData.jumayHeadquarters);
    assert.ok(headquarters);
    assert.equal(headquarters.position.x, JUMAY_PARK_PLAN.headquarters.x);
    assert.equal(headquarters.position.z, JUMAY_PARK_PLAN.headquarters.z);
    const bounds = new THREE.Box3().setFromObject(root);
    assert.ok(bounds.min.x >= -JUMAY_LANDMARK.radius);
    assert.ok(bounds.max.x <= JUMAY_LANDMARK.radius);
    assert.ok(bounds.min.z >= -300 && bounds.max.z <= 300);
    assert.ok(Math.abs(bounds.min.y) < 1e-5);
    let triangles = 0, drawCalls = 0;
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      drawCalls++;
      for (const n of mesh.geometry.attributes.position.array) assert.ok(Number.isFinite(n));
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    });
    assert.ok(triangles < 12000, `${triangles} triangles`);
    assert.ok(drawCalls <= 32, `${drawCalls} draw calls`);
    assert.ok(labels.includes('JUMAY PARK JAKARTA'));
    assert.ok(labels.includes('DIBANGUN OLEH JUMAY CORPORATION'));
    for (let i = 1; i <= 4; i++) assert.ok(labels.includes(`JUMAY FACTORY ${i}`));
    for (let i = 1; i <= 2; i++) assert.ok(labels.includes(`JUMAY OFFICE ${i}`));
  } finally { globalThis.document = previous; }
});

test('six-lane boulevard and cross streets remain clear of office and factory footprints', () => {
  const {boulevard, headquarters, offices, factories} = JUMAY_PARK_PLAN;
  assert.equal(boulevard.lanesPerDirection, 3);
  assert.ok(boulevard.width >= 30 && boulevard.length >= 500);
  const plots = [headquarters, ...offices, ...factories];
  for (const plot of plots) {
    assert.ok(Math.abs(plot.x) - plot.width / 2 > boulevard.width / 2 + 5);
    for (const z of [-10, 135]) assert.ok(Math.abs(plot.z - z) - plot.depth / 2 > 8);
    for (const other of plots) {
      if (plot === other) continue;
      assert.ok(Math.abs(plot.x - other.x) > (plot.width + other.width) / 2 ||
        Math.abs(plot.z - other.z) > (plot.depth + other.depth) / 2);
    }
  }
});

test('procedural building exclusion includes buildings straddling the campus boundary', () => {
  assert.ok(jumayParkOverlaps(0, 0, 10, 10));
  assert.ok(jumayParkOverlaps(205, 300, 30, 30));
  assert.equal(jumayParkOverlaps(250, 0, 20, 20), false);
  assert.equal(jumayParkOverlaps(0, 350, 20, 20), false);
});

test('Jakarta has the largest land footprint, while every branch retains offices, boulevard and factories', () => {
  const previous = globalThis.document;
  let labels;
  globalThis.document = {createElement: () => ({getContext: () => ({
    fillRect() {}, fillText(text) { labels.push(text); }
  })})};
  try {
    assert.deepEqual(JUMAY_PARKS.map(s => s.city), ['Jakarta', 'Bandung', 'Semarang', 'Yogyakarta', 'Surabaya']);
    let jakartaArea;
    for (const site of JUMAY_PARKS) {
      labels = [];
      const root = new THREE.Group(); buildJumayPark(root, site);
      const bounds = new THREE.Box3().setFromObject(root), size = bounds.getSize(new THREE.Vector3());
      const area = size.x * size.z;
      assert.ok(Math.abs(size.x - site.landWidth) < .001);
      assert.ok(Math.abs(size.z - site.landDepth) < .001);
      assert.ok(Math.abs(area - site.landArea) < .01);
      assert.ok(bounds.max.y > 147 && bounds.max.y < 148, 'land changes independently of height');
      if (site.headquarters) jakartaArea = area;
      else assert.ok(area < jakartaArea, site.city + ' has less land than Jakarta');
      assert.equal(root.userData.siteId, site.id);
      assert.ok(labels.includes(`JUMAY PARK ${site.city.toUpperCase()}`));
      assert.equal(labels.includes('KANTOR PUSAT JUMAY CORPORATION'), site.headquarters);
      if (!site.headquarters) assert.ok(labels.includes(`KANTOR REGIONAL ${site.city.toUpperCase()}`));
      assert.ok(labels.includes('BOULEVARD JUMAY PARK UTAMA'));
      for (let i = 1; i <= 4; i++) assert.ok(labels.includes(`JUMAY FACTORY ${i}`));
      assert.ok(jumayParkOverlaps(site.radius + 5, 0, 10, 10, site));
      assert.equal(jumayParkOverlaps(site.radius + 40, 0, 10, 10, site), false);
      root.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    }
  } finally { globalThis.document = previous; }
});

test('live boulevard has no second campus asphalt or ground slab over its driving lanes',()=>{
 const old=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
 try{
  for(const site of JUMAY_PARKS){
   const root=new THREE.Group();buildJumayPark(root,site,{onRoute:true});
   assert.equal(root.userData.onRoute,true);
   root.traverse(o=>{
    if(!o.isMesh||![0x343b43,0x71806a].includes(o.material.color?.getHex()))return;
    const p=o.geometry.attributes.position;
    for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getX(i))>=24,'campus surfaces leave the live road clear');
   });
  }
 }finally{globalThis.document=old;}
});
