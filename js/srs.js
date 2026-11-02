// Review schedule. Each phrase: {level 0–5, due, timesSaid, firstSeen}.
import { addDays } from './util.js';

export const GAPS = [0, 1, 3, 7, 14, 30]; // days until next review, by level

export function introduce(passed, today) {
  return { level: 1, due: addDays(today, 1), timesSaid: passed ? 1 : 0, firstSeen: today };
}

export function pass(rec, today) {
  const level = Math.min(5, (rec?.level || 0) + 1);
  return { ...rec, level, due: addDays(today, GAPS[level]), timesSaid: (rec?.timesSaid || 0) + 1 };
}

export function fail(rec, today) {
  const level = Math.max(1, (rec?.level || 1) - 1);
  return { ...rec, level, due: addDays(today, 1) };
}

/** Keys of phrases due for review, most overdue first. */
export function dueKeys(phrases, today, limit = 5, isSpeakable = () => true) {
  return Object.entries(phrases)
    .filter(([k, r]) => r && r.level >= 1 && r.due && r.due <= today && isSpeakable(k))
    .sort((a, b) => (a[1].due < b[1].due ? -1 : a[1].due > b[1].due ? 1 : a[1].level - b[1].level))
    .slice(0, limit)
    .map(([k]) => k);
}
