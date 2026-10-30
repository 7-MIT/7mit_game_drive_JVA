import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

import {JUMAY_PARKS, JUMAY_LANDMARK} from './jumay-sites.js';
export {JUMAY_PARKS, JUMAY_LANDMARK} from './jumay-sites.js';

export const JUMAY_PARK_PLAN = Object.freeze({
  boulevard: Object.freeze({width: 32, length: 570, lanesPerDirection: 3}),
  headquarters: Object.freeze({x: -100, z: -175, width: 88, depth: 72}),
  offices: Object.freeze([
    Object.freeze({x: 105, z: -205, width: 64, depth: 58, height: 56}),
    Object.freeze({x: 105, z: -100, width: 72, depth: 62, height: 38})
  ]),
  factories: Object.freeze([-105, 105].flatMap(x => [65, 205].map(z =>
    Object.freeze({x, z, width: 100, depth: 60, height: 16}))))
});

// Keep procedural roadside buildings outside the campus and its perimeter.
export function jumayParkOverlaps(x, z, width, depth, site = JUMAY_LANDMARK) {
  return Math.abs(x) < site.radius + width / 2 + 10 && Math.abs(z) < site.halfDepth + 10 + depth / 2;
}

export function buildJumayPark(parent, site = JUMAY_LANDMARK) {
  const headquarters = new THREE.Group();
  buildJumayHeadquarters(headquarters, site);
  headquarters.position.set(JUMAY_PARK_PLAN.headquarters.x, 0, JUMAY_PARK_PLAN.headquarters.z);
  parent.add(headquarters);
  const materials = {
    ground: new THREE.MeshStandardMaterial({color: 0x71806a, roughness: .95}),
    road: new THREE.MeshStandardMaterial({color: 0x343b43, roughness: .95}),
    pavement: new THREE.MeshStandardMaterial({color: 0xbec4c6, roughness: .85}),
    white: new THREE.MeshStandardMaterial({color: 0xf5f4eb, roughness: .8}),
    glass: new THREE.MeshStandardMaterial({color: 0x37647c, roughness: .25, metalness: .5}),
    metal: new THREE.MeshStandardMaterial({color: 0x92a5b0, roughness: .6, metalness: .3}),
    garden: new THREE.MeshStandardMaterial({color: 0x3d7046, roughness: .95})
  };
  const batches = new Map();
  const box = (kind, w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    if (!batches.has(kind)) batches.set(kind, []);
    batches.get(kind).push(g);
  };
  box('ground', 380, .08, 590, 0, .04, 0);
  const road = (w, d, x, z) => box('road', w, .08, d, x, .12, z);
  // Jumay Boulevard: six lanes with a planted median and broad sidewalks.
  road(32, 570, 0, 0);
  for (const x of [-19, 19]) box('pavement', 5, .22, 570, x, .19, 0);
  // Cross streets connect every office and factory plot to the boulevard.
  for (const z of [-10, 135]) {
    road(340, 16, 0, z);
    for (const side of [-1, 1]) box('pavement', 145, .22, 3, side * 95, .19, z + 10);
  }
  for (const {x, z, width, depth} of [JUMAY_PARK_PLAN.headquarters, ...JUMAY_PARK_PLAN.offices]) {
    const entrance = z + depth / 2 + 8;
    road(Math.abs(x), 12, x / 2, entrance);
    box('pavement', width + 8, .24, 12, x, .2, entrance + 12);
  }
  for (const f of JUMAY_PARK_PLAN.factories) {
    road(120, 25, f.x, f.z + 45);
    road(Math.abs(f.x), 12, f.x / 2, f.z + 45);
  }
  // Leave the junctions and plot entrances clear of median and lane dashes.
  const openings = [-10, 135, ...[JUMAY_PARK_PLAN.headquarters, ...JUMAY_PARK_PLAN.offices].map(p => p.z + p.depth / 2 + 8), 110, 250];
  for (let z = -275; z < 280; z += 12) {
    if (openings.some(j => Math.abs(z - j) < 15)) continue;
    box('pavement', 3, .32, 10, 0, .28, z);
    box('garden', 2.6, .25, 9.6, 0, .565, z);
    for (const x of [-10.8, -6.2, 6.2, 10.8]) box('white', .16, .025, 5, x, .175, z);
  }
  for (const x of [-15.5, 15.5]) box('white', .18, .025, 570, x, .175, 0);
  for (const o of JUMAY_PARK_PLAN.offices) {
    box('pavement', o.width + 8, .4, o.depth + 8, o.x, .28, o.z);
    box('glass', o.width, o.height, o.depth, o.x, o.height / 2 + .48, o.z);
    for (let y = 4; y < o.height; y += 4) box('metal', o.width + .3, .25, o.depth + .3, o.x, y, o.z);
    box('metal', o.width + 2, 1, o.depth + 2, o.x, o.height + .98, o.z);
  }
  for (const f of JUMAY_PARK_PLAN.factories) {
    box('pavement', f.width + 8, .4, f.depth + 8, f.x, .28, f.z);
    box('white', f.width, f.height, f.depth, f.x, f.height / 2 + .48, f.z);
    box('metal', f.width + 3, 1.2, f.depth + 3, f.x, f.height + 1.08, f.z);
    // Loading bays, roof vents and separate utility stacks distinguish the factories.
    for (const dx of [-32, -12, 12, 32]) {
      box('metal', 12, 7, .3, f.x + dx, 4, f.z + 30.2);
      box('metal', 9, 2, 6, f.x + dx, f.height + 2.6, f.z);
    }
    box('metal', 4, 27, 4, f.x + 40, 13.98, f.z - 20);
  }
  // Perimeter planting and the main entrance portal.
  for (const x of [-180, 180]) for (let z = -270; z < 290; z += 40) {
    box('pavement', 8, .6, 12, x, .38, z);
    box('garden', 7, 2, 11, x, 1.68, z);
  }
  for (const x of [-24, 24]) box('metal', 2, 10, 2, x, 5.08, 278);
  box('metal', 50, 1, 2, 0, 10.58, 278);
  for (const [kind, geos] of batches) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), materials[kind]);
    geos.forEach(g => g.dispose());
    mesh.receiveShadow = true;
    mesh.castShadow = !['road', 'ground', 'white'].includes(kind);
    parent.add(mesh);
  }
  const sign = (title, subtitle, x, y, z, w = 40, h = 8) => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#162b3e'; ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 74px sans-serif'; ctx.fillText(title, 512, 85);
    ctx.font = '30px sans-serif'; ctx.fillText(subtitle, 512, 184);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.userData.keep = true;
    const mat = new THREE.MeshStandardMaterial({map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: .4});
    const geometry = new THREE.PlaneGeometry(w, h);
    for (const side of [-1, 1]) {
      const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z + side * .12);
      mesh.rotation.y = side > 0 ? 0 : Math.PI; parent.add(mesh);
    }
  };
  sign(`JUMAY PARK ${site.city.toUpperCase()}`, 'KAWASAN PERKANTORAN & INDUSTRI JUMAY CORPORATION', 0, 8.5, 278, 44, 5);
  sign('JUMAY BOULEVARD', 'DIBANGUN OLEH JUMAY CORPORATION', 0, 8.5, -278, 32, 6);
  JUMAY_PARK_PLAN.offices.forEach((o, i) => sign(`JUMAY OFFICE ${i + 1}`, 'PERKANTORAN JUMAY CORPORATION', o.x, o.height - 6, o.z + o.depth / 2 + .25, 45, 7));
  JUMAY_PARK_PLAN.factories.forEach((f, i) => sign(`JUMAY FACTORY ${i + 1}`, 'PABRIK JUMAY CORPORATION', f.x, 13, f.z + f.depth / 2 + .4, 46, 6));
  parent.userData.jumayPark = true;
  parent.userData.siteId = site.id;
  parent.userData.landArea = site.landArea;
  parent.scale.set(site.landScale, 1, site.landScale);
}

export function buildJumayHeadquarters(parent, site = JUMAY_LANDMARK) {
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
  ctx.font = '32px sans-serif'; ctx.fillText(site.headquarters ? 'KANTOR PUSAT JUMAY CORPORATION' : `KANTOR REGIONAL ${site.city.toUpperCase()}`, 512, 184);
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
  parent.userData.jumayHeadquarters = site.headquarters;
  parent.userData.jumayRegionalOffice = !site.headquarters;
}
