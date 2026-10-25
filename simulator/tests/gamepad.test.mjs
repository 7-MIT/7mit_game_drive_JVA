import test from 'node:test'; import assert from 'node:assert/strict';
import {brandOf, buttonLabel, readBound, firstMove, padConf, DEFAULT_BIND} from '../gamepad.js';
const pad = (axes = [0, 0, 0, 0], pressed = {}) => ({mapping: 'standard', axes, buttons: Array.from({length: 17}, (_, i) => ({pressed: !!pressed[i], value: pressed[i] === true ? 1 : pressed[i] || 0}))});

test('controller brands from their ids', () => {
  assert.equal(brandOf('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'), 'xbox');
  assert.equal(brandOf('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), 'ps');
  assert.equal(brandOf('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)'), 'nintendo');
  assert.equal(brandOf('Logitech G29 Driving Force Racing Wheel'), 'wheel');
  assert.equal(brandOf('Some USB Joystick'), 'generic');
  assert.equal(buttonLabel('ps', 0), '✕'); assert.equal(buttonLabel('xbox', 7), 'RT'); assert.equal(buttonLabel('nintendo', 7), 'ZR');
});

test('default layout: stick steers, triggers are gas and brake, buttons fire actions', () => {
  const r = readBound(pad([0.6, 0, 0, 0], {7: 0.8, 6: 0, 5: true}), null);
  assert.ok(r.steer > 0.3 && r.steer <= 1); assert.equal(r.gas, 0.8); assert.equal(r.brake, 0); assert.equal(r.btn.up, true); assert.equal(r.btn.down, false);
  assert.equal(readBound(pad([0.05, 0, 0, 0]), null).steer, 0, 'inside the dead zone');
});

test('own layout: gas on the right stick up, steering inverted and from two buttons', () => {
  const C = padConf({bind: {...DEFAULT_BIND, gas: {t: 'a', i: 3, d: -1}, steerL: {t: 'b', i: 14}, steerR: {t: 'b', i: 15}}, invert: true, curve: 1, custom: true});
  const r = readBound(pad([0, 0, 0, -0.9], {15: true}), C);
  assert.ok(r.gas > 0.85); assert.equal(r.steer, -1);
});

test('binding picks the first control that moves', () => {
  assert.deepEqual(firstMove(pad([0, 0, 0, 0], {3: true})), {t: 'b', i: 3});
  assert.deepEqual(firstMove(pad([0, 0, 0.9, 0])), {t: 'a', i: 2, d: 1});
  assert.equal(firstMove(pad([0.2, 0, 0, 0])), null);
});
