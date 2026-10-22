import test from 'node:test'; import assert from 'node:assert/strict';
import {routeOSM} from '../osm-route.js';
const road = (k, pts) => { const xy = new Float32Array(pts.length*2); pts.forEach(([la, lo], i) => { xy[i*2] = lo; xy[i*2 + 1] = la; });
  return {k, xy, bb: [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]}; };

test('crossing roads without a shared vertex are joined', () => {
  // a west–east road and a south–north road that cross mid-segment
  const R = [road('n', [[-6.40, 106.70], [-6.40, 106.80]]), road('p', [[-6.45, 106.75], [-6.35, 106.75]])];
  const r = routeOSM(R, {lat: -6.40, lon: 106.70}, {lat: -6.35, lon: 106.75});
  assert.ok(r, 'route found');
  assert.ok(r.some(q => Math.abs(q.lat + 6.40) < 1e-3 && Math.abs(q.lon - 106.75) < 1e-3), 'goes through the crossing');
});

test('a T-junction ending next to another road is joined', () => {
  // the side road stops 15 m short of the main road
  const R = [road('n', [[-6.40, 106.70], [-6.40, 106.80]]), road('s', [[-6.3999, 106.75], [-6.35, 106.75]])];
  assert.ok(routeOSM(R, {lat: -6.40, lon: 106.70}, {lat: -6.35, lon: 106.75}));
});

test('no route through roads that do not connect, and none over toll roads', () => {
  const R = [road('n', [[-6.40, 106.70], [-6.40, 106.74]]), road('n', [[-6.40, 106.76], [-6.40, 106.80]]), road('t', [[-6.40, 106.74], [-6.40, 106.76]])];
  assert.equal(routeOSM(R, {lat: -6.40, lon: 106.70}, {lat: -6.40, lon: 106.80}, {snapKm: 0.5}), null);
});

import {routeCorridor} from '../osm-route.js';
test('a town off the fastest road is not a detour: it is placed where the road passes closest', () => {
  // the main road runs straight north; the "town" point sits 5 km east, reachable only by a side road
  const R = [road('n', [[-6.50, 106.75], [-6.40, 106.75], [-6.30, 106.75]]), road('c', [[-6.40, 106.75], [-6.40, 106.795]])];
  const P = [{lat: -6.50, lon: 106.75}, {lat: -6.40, lon: 106.795}, {lat: -6.30, lon: 106.75}];
  const segs = routeCorridor(R, P);
  assert.ok(segs[0] && segs[1], 'both stretches routed');
  assert.ok(segs[0].every(q => Math.abs(q.lon - 106.75) < 1e-3) && segs[1].every(q => Math.abs(q.lon - 106.75) < 1e-3), 'stays on the main road');
});
