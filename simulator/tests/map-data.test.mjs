import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMapNodes, snapCorridor, collectMapTraffic, trafficLevel} from '../map-data.js';
import {CORR, NODES, corrLL} from '../network.js';

test('all mapped toll POIs use toll membership, including copied route events', () => {
  let calls = 0;
  const resolver = createMapNodes({nodes: NODES, corridors: CORR, corrLL, snap(q, id) {
    calls++; assert.equal(CORR[id].cls, 't'); return {...q, lat: q.lat + 0.001};
  }});
  for (const n of NODES.values()) {
    if (n.kind === 'k' || ![...n.corr].some(id => CORR[id].cls === 't')) continue;
    const p = resolver.point({...n, corr: undefined});
    assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lon), n.key);
    assert.equal(resolver.point(n), p);
    assert.equal(NODES.get(n.key).lat, n.lat); // graph coordinates stay intact
  }
  assert.ok(calls > 200);
  resolver.clear();
});
test('parallel road matching prefers Jakarta–Cikampek over closer MBZ', () => {
  const roads = [{name: 'Tol Layang MBZ', lat: 1, lon: 2}, {name: 'Jalan Tol Jakarta-Cikampek', lat: 3, lon: 4}];
  const osm = {ready: true, snap(la,lo,k,m,accept = () => true) {return roads.find(accept);}};
  assert.equal(snapCorridor(osm, {}, CORR.japek, ['t'], 5), roads[1]);
  const q = {lat: 1, lon: 2};
  assert.equal(snapCorridor({...osm, ready: false}, q, CORR.japek, ['t'], 5), q);
  assert.equal(snapCorridor(osm, q, {planned: true}, ['t'], 5), q);
});
test('speed bands, direction, unknown coverage and accident lifecycle', () => {
  assert.deepEqual([0.2,0.5,0.9].map(trafficLevel), ['heavy','slow','clear']);
  const v = (sd,p,vel,o={}) => ({sd,p,vel,lane:1,lx:1,...o});
  const opts = {clock:10,minU:0,maxU:2000,limitAt:()=>30,corridorAt:()=> 'japek'};
  const vehicles = [v(1,20,2),v(1,30,4), v(-1,-20,29),v(-1,-30,28),v(1,160,15),v(1,170,16),
    v(1,400,0,{player:true}),v(1,420,0,{rp:{}}),v(1,440,0,{esc:'po'}),v(1,900,0,{crashT:20,dmg:10})];
  let data = collectMapTraffic({...opts, vehicles});
  assert.deepEqual(data.segments.map(s => s.level), ['heavy','clear','slow']);
  assert.equal(data.incidents.length,1);
  assert.equal(data.segments.some(s => s.a >= 300),false);
  data = collectMapTraffic({...opts, clock:21, vehicles});
  assert.equal(data.incidents.length,0);
});

test('navigation colours lie on the destination polyline, including boundary cuts and bends', async () => {
  const {navigationStrokes} = await import('../map-data.js');
  const points = [{u:0,lat:0,lon:0},{u:100,lat:1,lon:1},{u:100,lat:1.2,lon:1.1},{u:200,lat:1,lon:2}];
  const segments = [{sd:1,a:50,b:100,level:'slow'},{sd:1,a:100,b:150,level:'heavy'},
    {sd:-1,a:0,b:200,level:'heavy'},{sd:1,a:250,b:300,level:'heavy'}];
  const strokes = navigationStrokes(points, segments);
  assert.deepEqual(strokes.map(s=>s.level), ['clear','slow','heavy','clear']);
  assert.deepEqual(strokes[0].points, [points[0],{u:50,lat:0.5,lon:0.5}]);
  assert.equal(strokes[1].points.at(-1), points[1]);
  assert.ok(strokes[2].points.includes(points[2]), 'OSM bend is preserved');
  assert.deepEqual(strokes[2].points.at(-1), {u:150,lat:1.1,lon:1.55});
  assert.equal(strokes.at(-1).points.at(-1),points[3]);
  assert.deepEqual(navigationStrokes(points, segments.filter(s=>s.sd===-1)).map(s=>s.level), ['clear']);
  assert.deepEqual(navigationStrokes(points, []).map(s=>s.level), ['clear']);
});
