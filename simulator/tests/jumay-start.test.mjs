import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from 'three';
import {JUMAY_PARKS, jumayBoulevardPlacement} from '../jumay-sites.js';
import {NODES, CORR, placeList, buildTrip, walkFree, tripFromLegs, findRoute} from '../network.js';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
test('every city offers a boulevard start and begins both free driving and navigation on that road', () => {
  for (const site of JUMAY_PARKS) {
    const key = 'JUMAY-BOULEVARD:' + site.id, id = 'jumay-boulevard-' + site.id;
    const option = placeList().find(p => p.key === key);
    assert.ok(option.name.includes('Jalan Boulevard Jumay Park Utama'));
    assert.equal(option.group, 'Jumay Park · Mulai di boulevard');
    assert.equal(CORR[id].lanes, 3); assert.equal(CORR[id].custom, true);
    const free = tripFromLegs(key, walkFree(key, null, null, null, 60));
    const routed = buildTrip(key, 'N:' + site.city);
    for (const trip of [free, routed]) {
      assert.ok(trip);
      assert.equal(trip.ev[0].key, key);
      assert.equal(trip.ev[0].cNext, id);
      assert.equal(trip.legs[0].c, id);
      assert.ok(trip.allLegs.length > 1, 'continues from boulevard to city roads');
    }
    assert.ok(findRoute(key, 'Bekasi Barat'));
  }
});

test('boulevard world length and campus centre remain aligned at every distance scale and in reverse', () => {
  const block = source.slice(source.indexOf('  const sc = cfg.scale; let lastRW'), source.indexOf('  layoutElev(); segT = 0;'));
  for (const site of JUMAY_PARKS) for (const scale of [1, 5, 20]) for (const reverse of [false, true]) {
    const key = 'JUMAY-BOULEVARD:' + site.id, end = 'JUMAY:' + site.id;
    const from = reverse ? end : key, to = reverse ? key : end;
    const trip = buildTrip(from, to), EV = trip.ev.slice(0, 2).map(e => ({...e}));
    const context = {EV, CORR, cfg: {scale}, RW_EVERY: 1e6, CF_EVERY: 1e6};
    runInNewContext(block, context);
    assert.equal(EV[1].u, 570 * site.landScale);
    assert.equal(context.ZONES.length, 0, 'no random works on campus boulevard');
    const placement = jumayBoulevardPlacement(EV, site);
    assert.equal(placement.u, EV[1].u / 2);
    assert.equal(placement.reverse, reverse);
    assert.ok(30 < EV[1].u, 'spawn point is inside the boulevard');
  }
});

test('player spawns in a driving lane on the selected boulevard', () => {
  const fn = source.slice(source.indexOf('function spawnPlayer(){'), source.indexOf('// ================================================================\n// JOBS'));
  for (const site of JUMAY_PARKS) {
    const context = {THREE, PLR: null, camU: 0, vehicles: [], rampers: [],
      EV: [{...NODES.get('JUMAY-BOULEVARD:' + site.id)}], cfg: {veh: 'car'},
      MODS: () => ({paint: 0xffffff}), VEH: {car: {}},
      makeVehicle: () => ({g: {}, type: 'car'}), detailPlayerVehicle() {}, applyMods() {},
      nAvail: () => 3, limitAt: () => 40 / 3.6,
      posX: (sd, lane) => sd * (1.2 / 2 + (lane + .5) * 3.6),
      scene: {add() {}}, sirenUI() {}, uiNeeds() {}};
    runInNewContext(fn + '\nspawnPlayer()', context);
    assert.equal(context.PLR.p, 30);
    assert.equal(context.PLR.lane, 2);
    assert.ok(Math.abs(context.PLR.x) < 16 * site.landScale);
    assert.equal(context.camU, 30);
  }
});
