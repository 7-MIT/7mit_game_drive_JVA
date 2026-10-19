import test from 'node:test';
import assert from 'node:assert/strict';
import {translate, DICT} from '../i18n.js';
test('English: exact strings keep their surrounding spaces, numbers stay as they are', () => {
  assert.equal(translate('  Pengaturan '), '  Settings '); assert.equal(translate('12:00'), null); assert.equal(translate('Jakarta'), null);
  assert.ok(Object.keys(DICT).length > 200);
});
test('English: patterns translate text with numbers and names', () => {
  assert.equal(translate('Tempuh 25 km'), 'Drive 25 km'); assert.equal(translate('Naik level 3 · Sopir Andal'), 'Level up 3 · Sopir Andal'); assert.equal(translate('Mesin maks'), 'Engine max');
  assert.equal(translate('Pulau Sumatera · Lajur kiri'), 'Sumatera · Keep left');
});
