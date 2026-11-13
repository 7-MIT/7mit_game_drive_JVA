import test from 'node:test';
import assert from 'node:assert/strict';
import {manualDrive, shiftOK, readPad, tiltSteer, GEAR_TOP} from '../controls.js';
import {segment, ADS} from '../radio.js';
test('manual gearbox: neutral and clutch give no drive, the limiter cuts at the top of a gear', () => {
  assert.equal(manualDrive({gear: 0, vel: 5}).k, 0); assert.equal(manualDrive({gear: 2, vel: 5, clutch: true}).k, 0);
  assert.ok(manualDrive({gear: 1, vel: 3}).k > 0.9); const lim = manualDrive({gear: 1, vel: GEAR_TOP[0] + 1}); assert.equal(lim.k, 0); assert.ok(lim.limiter);
});
test('manual gearbox: a high gear lugs at low speed and stalls only when the player works the clutch', () => {
  const lug = manualDrive({gear: 4, vel: 3}); assert.ok(lug.k < 0.2); assert.equal(lug.stall, false);
  assert.equal(manualDrive({gear: 4, vel: 1, clutchMode: true}).stall, true); assert.equal(manualDrive({gear: 1, vel: 0, clutchMode: true}).stall, false);
  assert.ok(manualDrive({gear: 3, vel: 15}).rpm > manualDrive({gear: 4, vel: 15}).rpm);
});
test('shifting needs the clutch only in clutch mode, except at a standstill', () => {
  assert.ok(shiftOK({clutchMode: false, clutch: false, vel: 20})); assert.equal(shiftOK({clutchMode: true, clutch: false, vel: 20}), false);
  assert.ok(shiftOK({clutchMode: true, clutch: true, vel: 20})); assert.ok(shiftOK({clutchMode: true, clutch: false, vel: 0}));
});
test('gamepads: standard mapping and a wheel whose pedals rest at +1', () => {
  const B = n => Array.from({length: 16}, (_, i) => ({pressed: false, value: i === n ? 0.7 : 0}));
  const r = readPad({mapping: 'standard', axes: [0.5, 0], buttons: B(7)}); assert.ok(r.steer > 0.4 && r.gas === 0.7 && r.brake === 0);
  const w = readPad({mapping: '', axes: [-0.2, 1, -1, 1], buttons: []}, [0, 1, 1, 1]); assert.ok(w.steer < 0); assert.equal(w.gas, 0); assert.equal(w.brake, 1); assert.equal(w.clutch, 0);
});
test('tilt steering follows the screen orientation, with a dead zone', () => {
  assert.equal(tiltSteer({beta: 2, gamma: 0}, 90), 0); assert.ok(tiltSteer({beta: 20, gamma: 0}, 90) > 0.6); assert.ok(tiltSteer({beta: 20, gamma: 0}, 270) < -0.6); assert.ok(tiltSteer({beta: 0, gamma: -30}, 0) === -1);
});
test('radio segments rotate: station, time & weather, traffic, ad, tip', () => {
  const S = {hour: 7.5, weather: 'cerah', rain: false, place: 'Cikampek', road: 'Tol Jakarta–Cikampek', jam: 9};
  assert.match(segment(0, S), /tujuh mit F M/); assert.match(segment(1, S), /07\.30/); assert.match(segment(2, S), /padat/); assert.ok(ADS.includes(segment(3, S)));
});
test('radio request line: one number, requests queue in the order they were sent, with limits', async () => {
  const {createRequests, RADIO_NO, PLAYLIST, shuffled, VID} = await import('../radio.js');
  assert.equal(RADIO_NO, '081313245123'); assert.ok(PLAYLIST.length >= 30); assert.equal(shuffled(PLAYLIST).length, PLAYLIST.length);
  const q = createRequests({max: 3, perUser: 2});
  assert.equal(q.add({id: 'AAAAAAAAAAA', by: 'Ani', t: 20, rid: 'a'}).pos, 1);
  assert.equal(q.add({id: 'BBBBBBBBBBB', by: 'Budi', t: 10, rid: 'b'}).pos, 1);                 // sent earlier: plays first on every player's copy
  assert.equal(q.add({id: 'AAAAAAAAAAA', by: 'Ani', t: 20, rid: 'a'}).why, 'dup');             // the same request arriving twice
  assert.equal(q.add({id: 'CCCCCCCCCCC', by: 'Ani', t: 30, rid: 'c'}).ok, true);
  assert.equal(q.add({id: 'DDDDDDDDDDD', by: 'Ani', t: 40, rid: 'd'}).why, 'full');
  assert.equal(q.add({id: 'not an id', by: 'X'}).why, 'bad'); assert.ok(VID.test('dQw4w9WgXcQ'));
  assert.deepEqual([q.shift().by, q.shift().by, q.shift().by, q.shift()], ['Budi', 'Ani', 'Ani', undefined]);
});
test('133 serves toll roads only; 151 (Dishub) serves every road and every mode of transport', async () => {
  const {DISPATCH, NOT_TOLL, fixedLines} = await import('../voice-lines.js');
  assert.match(DISPATCH['133'].greet, /hanya melayani ruas jalan tol/); assert.ok(!DISPATCH['133'].menu.some(m => m.k === 'modes'));
  assert.match(DISPATCH['151'].greet, /semua ruas jalan.*seluruh moda transportasi/); assert.ok(DISPATCH['151'].menu.some(m => m.k === 'modes'));
  assert.match(NOT_TOLL, /satu lima satu/); assert.ok(fixedLines().includes(NOT_TOLL));
});
test('radio station songs are fixed embeddable video ids, so the first one can start inside the tap that turns the radio on', async () => {
  const {TRACKS} = await import('../radio.js');
  assert.ok(TRACKS.length >= 30); assert.equal(new Set(TRACKS.map(t => t[0])).size, TRACKS.length); assert.ok(TRACKS.every(([id, label]) => /^[\w-]{11}$/.test(id) && label));
});
test('INADigital: services, game numbers, request status, fictional identity and QR pattern', async () => {
  const ina = await import('../phone-inadigital.js'), {DISPATCH} = await import('../voice-lines.js');
  assert.ok(ina.INA_SERVICES.length >= 15); assert.equal(new Set(ina.INA_SERVICES.map(s => s.id)).size, ina.INA_SERVICES.length);
  const cats = new Set(ina.INA_CATS.map(c => c[0])); for (const s of ina.INA_SERVICES) { assert.ok(cats.has(s.cat), s.id); assert.ok(s.game || (s.steps && s.steps.length && s.docs && s.docs.length), s.id); if (s.game) assert.ok(DISPATCH[s.game[0]], s.id); }
  assert.deepEqual([ina.inaStatus(3)[0], ina.inaStatus(20)[0], ina.inaStatus(90)[0]], ['Diterima', 'Diverifikasi', 'Selesai']);
  const n = ina.inaNik('081200001111'); assert.match(n, /^31\d{14}$/); assert.equal(n, ina.inaNik('081200001111')); assert.match(ina.maskNik(n), /^31\d\d •••• •••• \d{4}$/);
  const a = ina.qrCells('x:1'), b = ina.qrCells('x:2'); assert.ok(a.length > 150 && a.length < 330); assert.notDeepEqual(a, b); assert.ok(a.some(([x, y]) => x === 0 && y === 0));
  assert.ok(!/(^|\})\s*\.ina/.test(ina.INA_CSS) && ina.INA_CSS.includes('#phone .ina .btn'));
});
