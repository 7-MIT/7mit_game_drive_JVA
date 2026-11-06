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
