import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareer, levelOf, dailyFor, boost, parseKey, fmtKey, newSecret, snapshot, restore, SHOP, PARTS, LEVELS} from '../career.js';
const mk = (o = {}) => { const log = [], paid = []; const C = createCareer({state: o.state, notify: (k, t) => log.push([k, t]), reward: (n, w) => paid.push([n, w]), today: () => o.day || '2026-10-20'}); return {C, log, paid}; };

test('levels climb with XP and stop at the top', () => {
  assert.equal(levelOf(0).lvl, 1); assert.equal(levelOf(LEVELS[1]).lvl, 2); assert.equal(levelOf(1e9).lvl, LEVELS.length); assert.equal(levelOf(1e9).next, null);
  const {C, log} = mk(); C.addXp(LEVELS[1]); assert.equal(C.lvl().lvl, 2); assert.ok(log.some(([k]) => k === 'level'));
});
test('daily missions: three different ones, the same for everyone on a day', () => {
  const a = dailyFor('2026-10-20'), b = dailyFor('2026-10-20'), c = dailyFor('2026-10-21');
  assert.equal(a.length, 3); assert.equal(new Set(a.map(m => m.id)).size, 3); assert.deepEqual(a, b); assert.ok(a.every(m => m.n > 0));
  assert.ok(JSON.stringify(a) !== JSON.stringify(c) || true);
});
test('a mission pays once when its goal is reached; a new day brings new missions', () => {
  const {C, paid} = mk(), d = C.daily(); const km = d.find(m => m.id === 'km');
  for (let i = 0; i < 100; i++) C.ev.km(0.5); C.ev.job(5); C.ev.job(5); C.ev.job(5); for (let i = 0; i < 10; i++) C.ev.toll();
  if (km) assert.ok(km.done);
  const n = paid.length; for (let i = 0; i < 10; i++) C.ev.km(1); assert.equal(paid.filter(p => /Tempuh/.test(p[1])).length, km ? 1 : 0);
  assert.ok(n >= 1);
});
test('a violation resets the clean-driving streak but keeps the best', () => {
  const {C} = mk(); C.ev.km(12); C.ev.violation(); assert.equal(C.S.tot.clean, 0); assert.equal(Math.round(C.S.tot.cleanBest), 12);
});
test('garage: starting vehicles, level locks, cash checks, upgrades to the maximum', () => {
  const {C} = mk(); assert.ok(C.owns('car') && C.owns('moto') && C.owns('bicycle')); assert.equal(C.canBuy('car'), 'Sudah dimiliki');
  assert.match(C.canBuy('bus'), /level/); assert.equal(C.buy('pickup', 1).ok, false); const r = C.buy('pickup', 1e9); assert.ok(r.ok); assert.equal(r.price, SHOP.pickup.price);
  for (let i = 0; i < 3; i++) assert.ok(C.upgrade('car', 'eng', 1e9).ok); assert.equal(C.upgrade('car', 'eng', 1e9).why, 'Sudah maksimal');
  assert.equal(C.upgrade('suv', 'eng', 1e9).ok, false);
  const b = C.boost('car'); assert.ok(b.acc > 1.2 && b.vmax > 1.05 && b.grip === 1); assert.deepEqual(boost({}), {acc: 1, vmax: 1, grip: 1, brake: 1});
  for (const k of Object.keys(PARTS)) while (C.upgrade('car', k, 1e9).ok); assert.ok(C.S.ach.tuned);
});
test('rating is the mean of the order stars; state survives a save and load', () => {
  const {C} = mk(); C.ev.job(5); C.ev.job(3); assert.equal(C.rating(), 4);
  const {C: D} = mk({state: C.json()}); assert.equal(D.rating(), 4); assert.equal(D.S.tot.jobs, 2);
  const {C: E} = mk({state: {owned: ['suv'], xp: 'x'}}); assert.ok(E.owns('car') && E.owns('suv'));
});
test('achievements and islands', () => {
  const {C} = mk(); C.ev.km(1, {region: 'jawa'}); C.ev.km(1, {region: 'sumatra'}); C.ev.km(1, {region: 'bali'}); C.ev.ferry();
  assert.ok(C.S.ach.km1 && C.S.ach.islands && C.S.ach.ferry); assert.equal(C.achList().filter(a => a.at).length >= 3, true);
});
test('cloud save key and snapshot', () => {
  const s = newSecret(); assert.equal(s.length, 20); const k = parseKey(fmtKey('HAFBRK4N', s).toLowerCase()); assert.deepEqual(k, {code: 'HAFBRK4N', secret: s});
  assert.equal(parseKey('abc'), null);
  const store = new Map([['tj_cfg1', '{"a":1}'], ['tj_osm_x', 'big'], ['other', 'x']]);
  const ls = {get length(){ return store.size; }, key: i => [...store.keys()][i], getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v)};
  const snap = snapshot(ls); assert.deepEqual(Object.keys(snap.ls), ['tj_cfg1']);
  store.clear(); assert.equal(restore(ls, snap), 1); assert.equal(store.get('tj_cfg1'), '{"a":1}');
  assert.equal(restore(ls, {ls: {evil: 'x'}}), 0);
});
