// Lesson content: content.json plus Krista's weekly units (from sync, cached in state).
import { getState } from './store.js';

let base = null;

export async function loadContent(url = 'content.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error('content ' + res.status);
  base = await res.json();
  return base;
}

export function soundLessons() {
  return base?.soundLessons || {};
}

export function baseUnits() {
  return base?.units || [];
}

/** Weekly units, newest first. */
export function weeklyUnits() {
  const w = getState()?.weeklyUnits || {};
  const baseIds = new Set(baseUnits().map((u) => u.id));
  return Object.values(w)
    .filter((x) => x?.unit?.id && Array.isArray(x.unit.phrases) && !baseIds.has(x.unit.id))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map((x) => ({ ...x.unit, weekly: true, createdAt: x.createdAt || 0 }));
}

/** Garden order: base units, then weekly ones oldest first. */
export function gardenUnits() {
  return [...baseUnits(), ...weeklyUnits().reverse()];
}

/** Lesson order: newest weekly unit, then u1 → u2 → u3, then older weekly units. */
export function lessonOrder() {
  const w = weeklyUnits();
  return [...w.slice(0, 1), ...baseUnits(), ...w.slice(1)];
}

export function unitById(id) {
  return gardenUnits().find((u) => u.id === id) || null;
}

export const keyOf = (unitId, phraseId) => `${unitId}:${phraseId}`;

export function phraseByKey(key) {
  const i = key.indexOf(':');
  const unit = unitById(key.slice(0, i));
  const phrase = unit?.phrases.find((p) => p.id === key.slice(i + 1));
  return phrase ? { unit, phrase, key } : null;
}

/** Finds a phrase by id, looking in the given unit first, then in all others. */
export function resolvePhrase(phraseId, preferUnitId) {
  const units = gardenUnits();
  const pref = units.find((u) => u.id === preferUnitId);
  for (const u of [pref, ...units].filter(Boolean)) {
    const p = u.phrases.find((x) => x.id === phraseId);
    if (p) return { unit: u, phrase: p, key: keyOf(u.id, p.id) };
  }
  return null;
}

/** Which sound mini-lessons a phrase needs, from its hint brackets. */
export function soundsIn(phrase) {
  const h = phrase.hint || '';
  const out = [];
  if (/\[(s|z)\]/.test(h)) out.push('th');
  if (/\[w\]/.test(h)) out.push('w');
  return out;
}

export const UNIT_COLOURS = ['#d9467a', '#e0892b', '#8a5cd6', '#2f8fd8', '#c23b3b', '#1f9e8a'];

export function unitColour(unit) {
  if (unit.color) return unit.color;
  const i = gardenUnits().findIndex((u) => u.id === unit.id);
  return UNIT_COLOURS[(i < 0 ? 0 : i) % UNIT_COLOURS.length];
}
