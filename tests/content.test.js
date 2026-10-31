import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateUnit } from '../js/validate.js';

const content = JSON.parse(readFileSync(new URL('../content.json', import.meta.url)));

test('every unit in content.json passes the weekly-unit checks', () => {
  for (const u of content.units) {
    const others = content.units.filter((x) => x.id !== u.id);
    assert.deepEqual(validateUnit(u, others), [], u.id);
  }
});

test('validator catches broken units', () => {
  const errs = validateUnit({ id: 'topic-x', titleLv: 'X', phrases: [{ id: 'a', en: 'A' }], dialogue: { lines: [{ who: 'learner', phrase: 'nope' }] } }, content.units);
  assert.equal(errs.length, 2);
  assert.ok(validateUnit({ id: 'u1', titleLv: 'X', phrases: [{ id: 'a', en: 'a', lv: 'a' }] }, content.units).length === 1);
});
