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

test('phrase ids are unique across all units', () => {
  const seen = new Map();
  for (const u of content.units) {
    for (const p of u.phrases) {
      assert.ok(!seen.has(p.id), `${p.id} in ${u.id} and ${seen.get(p.id)}`);
      seen.set(p.id, u.id);
    }
  }
});

test('every phrase has Latvian, hint, German and a picture', () => {
  for (const u of content.units) {
    for (const p of u.phrases) {
      for (const f of ['en', 'lv', 'hint', 'de', 'pic']) assert.ok(p[f], `${u.id}/${p.id} missing ${f}`);
    }
  }
});

test('hints mark th and spoken w', () => {
  // Words where w is written but not spoken, or spoken without a w.
  const silentW = /\b(write|wr\w*|who|whom|whose|answer|two|sword|flowers?|towers?|showers?)\b/gi;
  const spokenW = /\b(one|once)\b|tw(?!o\b)|sw|qu/i;
  for (const u of content.units) {
    for (const p of u.phrases) {
      const en = p.en.replace('{name}', '').toLowerCase();
      if (/th/.test(en)) assert.match(p.hint, /\[(s|z)\]/, `${u.id}/${p.id}: th without [s]/[z]`);
      const w = en.replace(silentW, '');
      if (/w/.test(w.replace(/(ow|aw|ew)(?![aeiou])/g, '')) || spokenW.test(w)) assert.match(p.hint, /\[w\]/, `${u.id}/${p.id}: w without [w]`);
    }
  }
});
