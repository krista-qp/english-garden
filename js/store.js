// All learner state lives in one IndexedDB record, kept in memory and written on every change.

const DB_NAME = 'angludarzs';
const STORE = 'kv';
const KEY = 'state';

let db = null;
let state = null;
const listeners = new Set();

export function defaults() {
  return {
    profile: null, // {name}
    settings: { showDe: true, showHints: true, checkSpeech: true },
    familyId: null,
    phrases: {}, // "unitId:phraseId" -> {level, due, timesSaid, firstSeen}
    stats: { sentencesTotal: 0, byDay: {} },
    units: {}, // unitId -> {introduced, dialogueRuns, completedAt}
    seenSounds: {},
    session: null,
    weeklyUnits: {}, // unitId -> {unit, createdAt}
    inbox: {}, // messages from Krista: id -> message
    outbox: [], // pending writes: {id, op:'add'|'read', data?}
    restored: false,
  };
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function load() {
  let saved = null;
  try {
    db = await openDb();
    saved = await new Promise((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } catch {
    db = null;
    try { saved = JSON.parse(localStorage.getItem(DB_NAME) || 'null'); } catch { saved = null; }
  }
  const d = defaults();
  state = { ...d, ...(saved || {}) };
  state.settings = { ...d.settings, ...(state.settings || {}) };
  state.stats = { ...d.stats, ...(state.stats || {}) };
  return state;
}

export function getState() {
  return state;
}

export function save() {
  if (!state) return;
  if (db) {
    try {
      db.transaction(STORE, 'readwrite').objectStore(STORE).put(state, KEY);
    } catch (e) {
      console.warn('save failed', e);
    }
  } else {
    try { localStorage.setItem(DB_NAME, JSON.stringify(state)); } catch { /* full or blocked */ }
  }
  for (const fn of listeners) fn(state);
}

export function onSave(fn) {
  listeners.add(fn);
}
