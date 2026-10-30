import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {JUMAY_PARKS} from '../jumay-sites.js';
import {NODES, CORR, RULES, edgesFrom, placeList, findRoute, buildTrip, corrGeo} from '../network.js';
import {snapCorridor, createMapNodes} from '../map-data.js';

test('all parks are searchable trip destinations with connected non-toll approaches', () => {
  const places = placeList();
  for (const site of JUMAY_PARKS) {
    const key = 'JUMAY:' + site.id, node = NODES.get(key), corridor = CORR['jumay-' + site.id];
    assert.equal(node.city, site.city);
    assert.equal(node.poi, 'jumay');
    assert.equal(node.headquarters, site.headquarters);
    assert.equal(node.lat, site.lat); assert.equal(node.lon, site.lon);
    assert.ok(places.some(p => p.key === key));
    assert.equal(corridor.cls, 'n'); assert.equal(corridor.planned, false);
    assert.ok(edgesFrom(key).some(e => e.to === 'N:' + site.city));
    for (const start of ['Bekasi Barat', 'N:' + site.city]) {
      const trip = buildTrip(start, key);
      assert.ok(trip, site.city + ' reachable from ' + start);
      assert.equal(trip.ev[trip.destIdx].key, key);
      assert.equal(trip.ev[trip.destIdx].name, node.name);
      assert.ok(Number.isFinite(trip.total) && trip.total > 0);
      assert.ok(findRoute(key, start));
    }
    RULES.noToll = true;
    try {
      const route = findRoute('N:Jakarta', key, 'nr');
      assert.ok(route, site.city + ' reachable without tolls');
      assert.ok(route.every(l => CORR[l.c].cls !== 't'));
    } finally { RULES.noToll = false; }
  }
});

test('map coordinates and the short Yogyakarta approach stay fixed with OSM enabled', () => {
  for (const site of JUMAY_PARKS) {
    const node = NODES.get('JUMAY:' + site.id), c = CORR['jumay-' + site.id], points = corrGeo(c.id);
    const last = points.at(-1);
    assert.equal(last.lat, site.lat); assert.equal(last.lon, site.lon);
    assert.ok(points.length >= 2);
    assert.notEqual(points[0].lat, last.lat);
    assert.equal(snapCorridor({ready: true, snap() { throw Error('Custom road snapped to OSM'); }}, last, c, ['n'], 1.5), last);
    const map = createMapNodes({nodes: NODES, corridors: CORR, corrLL() { throw Error('POI moved'); }, snap() { throw Error('POI snapped'); }});
    assert.equal(map.point(node), node);
  }
});

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
test('phone Maps search lists all five Jumay Parks and gives each result a regional or headquarters label', () => {
  const start = source.indexOf('  places(qs, filter){'), end = source.indexOf('  placeName:', start);
  const placeSub = source.slice(source.indexOf('const placeSub ='), source.indexOf('\n', source.indexOf('const placeSub =')));
  const api = runInNewContext(placeSub + '\n({' + source.slice(start, end) + '})', {
    NAVABLE: [...NODES.values()].filter(n => edgesFrom(n.key).length), PLR: null, EV: [],
    norm: s => s.toLowerCase(), haversine: () => 1, nodeLabel: n => n.name, KIND_NAME: {}
  });
  const hits = api.places('Jumay Park'); assert.equal(hits.length, 5);
  assert.equal(new Set(hits.map(n => n.key)).size, 5);
  for (const site of JUMAY_PARKS) {
    const hit = hits.find(n => n.key === 'JUMAY:' + site.id);
    assert.ok(hit.sub.includes(site.headquarters ? 'Kantor pusat' : 'Kantor regional'));
    assert.equal(api.places('Jumay Park ' + site.city, 'nontol').length, 1);
  }
});

test('Maps setNav activates a route ending at every Jumay Park', () => {
  const navigation = source.slice(source.indexOf('function setNav('), source.indexOf('function markDest('));
  for (const site of JUMAY_PARKS) {
    const key = 'JUMAY:' + site.id, state = {trip: {}, PLR: {}, NODES,
      EV: [{key: 'N:Bekasi', rk: 0}], stats: {}, uOfV: () => 0, replanIdx: () => 0, evAt: () => 0,
      legsFor: (from, unused, dest) => findRoute(from, dest), prevKeyOf: () => null,
      rkAt: () => 0, fmtKm: String, toast() {}, setTitle() {}, CORR};
    state.replan = (i, tail, dest) => { const trip = buildTrip(state.EV[i].key, dest); if (!trip) return false;
      state.trip = trip; state.EV = trip.ev; return true; };
    runInNewContext(navigation, state);
    assert.equal(runInNewContext(`setNav(${JSON.stringify(key)})`, state), true);
    assert.equal(state.trip.dest, key);
    assert.equal(state.EV[state.trip.destIdx].name, 'Jumay Park ' + site.city);
    assert.equal(state.stats.done, false);
  }
});
