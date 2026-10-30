import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from 'three';
import {JUMAY_LANDMARK, buildJumayHeadquarters} from '../jumay-landmark.js';

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

test('landmark is registered and placed safely beside a Central Jakarta route in either direction', () => {
  const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
  const registry = source.slice(source.indexOf('const LMK = ['), source.indexOf('const stoneMat'));
  const landmarks = runInNewContext(registry + '\nLMK', {JUMAY_LANDMARK});
  assert.ok(landmarks.some(l => l[0] === JUMAY_LANDMARK.name && l[3] === 'jumay'));
  assert.match(source, /jumay: buildJumayHeadquarters/);
  const layout = source.slice(source.indexOf('function layoutLandmarks()'), source.indexOf('function updateLandmarks()'));
  const {lat, lon, name} = JUMAY_LANDMARK;
  const near = [{lat: lat - .01, lon: lon - .001, u: 0}, {lat: lat + .01, lon: lon - .001, u: 2200}];
  for (const EV of [near, near.toReversed().map((p, i) => ({...p, u: i * 2200}))]) {
    const LMS = [], context = {EV, LMS, LMK: landmarks, JUMAY_LANDMARK, SEA: false,
      clamp: (x, a, b) => Math.min(b, Math.max(a, x)), lmEV: null};
    runInNewContext(layout + '\nlayoutLandmarks()', context);
    const headquarters = LMS.find(l => l.name === name);
    assert.ok(Math.abs(headquarters.u - 1100) < 1);
    assert.ok(headquarters.off >= JUMAY_LANDMARK.radius + 45);
    assert.equal(headquarters.side, EV === near ? 1 : -1);
    context.EV = [{lat: -7, lon: 110, u: 0}, {lat: -7.01, lon: 110, u: 1000}];
    runInNewContext('layoutLandmarks()', context);
    assert.equal(headquarters.u, null);
  }
});
