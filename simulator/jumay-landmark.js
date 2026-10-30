import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Fictional headquarters placed in the Jakarta Pusat game area, near Thamrin.
export const JUMAY_LANDMARK = Object.freeze({
  name: 'Gedung Jumay — Kantor Pusat Jumay Corporation',
  lat: -6.1884, lon: 106.8233, kind: 'jumay', radius: 46
});

export function buildJumayHeadquarters(parent) {
  const materials = {
    stone: new THREE.MeshStandardMaterial({color: 0xd9dee3, roughness: .75}),
    glass: new THREE.MeshStandardMaterial({color: 0x37647c, metalness: .55, roughness: .22}),
    frame: new THREE.MeshStandardMaterial({color: 0xb7c8d3, metalness: .65, roughness: .35}),
    dark: new THREE.MeshStandardMaterial({color: 0x162b3e, roughness: .65}),
    garden: new THREE.MeshStandardMaterial({color: 0x477445, roughness: .95})
  };
  const batches = new Map();
  const box = (kind, w, h, d, x, y, z) => {
    const geo = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    if (!batches.has(kind)) batches.set(kind, []);
    batches.get(kind).push(geo);
  };
  // Raised plaza, landscaped planters and a two-storey entrance podium.
  box('stone', 88, .6, 72, 0, .3, 0);
  box('dark', 72, .12, 14, 0, .66, 25);
  box('stone', 62, 8, 42, 0, 4.6, -4);
  box('glass', 58, 6, .3, 0, 4.6, 17.2);
  box('dark', 17, 5.4, .4, 0, 3.6, 17.5);
  box('glass', 14, 4.9, .5, 0, 3.35, 17.8);
  box('frame', 24, .6, 10, 0, 6.4, 20);
  for (const x of [-10, 10]) box('frame', .5, 5.5, .5, x, 3.45, 23.5);
  for (const x of [-35, 35]) {
    box('stone', 8, 1, 38, x, 1.1, -4);
    box('garden', 7, .7, 37, x, 1.95, -4);
  }
  // Main glass tower with floor bands, vertical fins and a setback crown.
  box('glass', 40, 126, 32, 0, 71.6, -5);
  for (let y = 8.6; y <= 134.6; y += 3.5) box('frame', 40.4, .18, 32.4, 0, y, -5);
  for (const x of [-20, -10, 0, 10, 20]) box('frame', .32, 126, 32.5, x, 71.6, -5);
  for (const z of [-21, -13, -5, 3, 11]) box('frame', 40.5, 126, .32, 0, 71.6, z);
  box('dark', 40.6, 5, 32.6, 0, 137.1, -5);
  box('glass', 28, 7, 24, 0, 143.1, -5);
  box('frame', 29, .8, 25, 0, 147, -5);

  for (const [kind, geos] of batches) {
    const geometry = mergeGeometries(geos);
    geos.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(geometry, materials[kind]);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
  }
  // One reusable sign texture, on both sides so it is legible in either direction.
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#162b3e'; ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 100px sans-serif'; ctx.fillText('JUMAY', 512, 86);
  ctx.font = '32px sans-serif'; ctx.fillText('KANTOR PUSAT JUMAY CORPORATION', 512, 184);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.keep = true;
  const signMaterial = new THREE.MeshStandardMaterial({map: texture, emissiveMap: texture,
    emissive: 0xffffff, emissiveIntensity: .5, roughness: .65});
  const signGeometry = new THREE.PlaneGeometry(34, 8.5);
  for (const side of [-1, 1]) {
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, 124, -5 + side * 16.3);
    sign.rotation.y = side > 0 ? 0 : Math.PI;
    parent.add(sign);
  }
  parent.userData.jumayHeadquarters = true;
}
