import test from 'node:test';
import assert from 'node:assert/strict';
import { introduce, pass, fail, dueKeys } from '../js/srs.js';
import { addDays, lvCount, weekStats } from '../js/util.js';

test('schedule gaps 1, 3, 7, 14, 30', () => {
  const t = '2026-11-01';
  let r = introduce(true, t);
  assert.deepEqual([r.level, r.due, r.timesSaid], [1, '2026-11-02', 1]);
  r = pass(r, t);
  assert.deepEqual([r.level, r.due], [2, addDays(t, 3)]);
  r = pass(r, t); assert.equal(r.due, addDays(t, 7));
  r = pass(r, t); assert.equal(r.due, addDays(t, 14));
  r = pass(r, t); assert.equal(r.due, addDays(t, 30));
  r = pass(r, t); assert.equal(r.level, 5);
});

test('failing drops a level, never below 1, review tomorrow', () => {
  const t = '2026-11-01';
  assert.deepEqual(fail({ level: 3 }, t), { level: 2, due: '2026-11-02' });
  assert.equal(fail({ level: 1 }, t).level, 1);
});

test('dueKeys picks due phrases, most overdue first, up to the limit', () => {
  const ph = {
    'u1:a': { level: 2, due: '2026-10-30' },
    'u1:b': { level: 1, due: '2026-10-28' },
    'u1:c': { level: 1, due: '2026-11-05' },
    'u2:x': { level: 0, listenOnly: true },
  };
  assert.deepEqual(dueKeys(ph, '2026-11-01', 5), ['u1:b', 'u1:a']);
  assert.deepEqual(dueKeys(ph, '2026-11-01', 1), ['u1:b']);
});

test('Latvian number agreement and week stats', () => {
  assert.equal(lvCount(1, 'teikums', 'teikumi'), 'teikums');
  assert.equal(lvCount(21, 'teikums', 'teikumi'), 'teikums');
  assert.equal(lvCount(11, 'teikums', 'teikumi'), 'teikumi');
  assert.equal(lvCount(5, 'teikums', 'teikumi'), 'teikumi');
  // Wednesday 4 Nov 2026: week is Mon 2 – Wed 4.
  const ws = weekStats({ '2026-11-01': 9, '2026-11-02': 3, '2026-11-04': 4 }, new Date(2026, 10, 4));
  assert.deepEqual(ws, { sentences: 7, days: 2 });
});
