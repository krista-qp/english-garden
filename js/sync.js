// Learner-side sync with Firestore. Everything works without it; the outbox waits until it can send.
import { connect, isConfigured } from './fb.js';
import { getState, save } from './store.js';
import { randomId } from './util.js';

let conn = null;
let flushing = false;
let onChange = () => {};
let starting = false;

export function syncEnabled() {
  return isConfigured() && !!getState().familyId;
}

export function isOnline() {
  return !!conn && navigator.onLine;
}

export async function startSync(changed) {
  if (changed) onChange = changed;
  if (!syncEnabled() || conn || starting) return;
  starting = true;
  try {
    const c = await connect();
    conn = c;
    subscribe();
    await restoreIfNew();
    flush();
  } catch (e) {
    console.info('sync not available yet', e?.message || e);
  } finally {
    starting = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => (conn ? flush() : startSync()));
}

function fam() {
  return getState().familyId;
}

function subscribe() {
  const { F, db } = conn;
  const msgs = F.query(F.collection(db, 'families', fam(), 'messages'), F.where('from', '==', 'krista'), F.limit(100));
  F.onSnapshot(msgs, (snap) => {
    const s = getState();
    const inbox = {};
    snap.forEach((d) => {
      const m = d.data();
      const local = s.inbox[d.id];
      inbox[d.id] = { ...m, id: d.id, readAt: m.readAt || local?.readAt || null };
    });
    s.inbox = inbox;
    save();
    onChange('inbox');
  }, (e) => console.warn('messages', e));

  F.onSnapshot(F.collection(db, 'families', fam(), 'units'), (snap) => {
    const s = getState();
    const w = {};
    snap.forEach((d) => {
      const v = d.data();
      if (v?.unit?.id && Array.isArray(v.unit.phrases)) w[v.unit.id] = { unit: v.unit, createdAt: v.createdAt || 0 };
    });
    s.weeklyUnits = w;
    save();
    onChange('units');
  }, (e) => console.warn('units', e));
}

/** On a new phone, take the review state mirrored at the end of the last session. */
async function restoreIfNew() {
  const s = getState();
  if (s.restored || Object.keys(s.phrases).length) {
    if (!s.restored) {
      s.restored = true;
      save();
    }
    return;
  }
  const { F, db } = conn;
  const snap = await F.getDoc(F.doc(db, 'families', fam(), 'learner', 'state'));
  s.restored = true;
  if (snap.exists()) {
    const r = snap.data();
    if (r.phrases) s.phrases = r.phrases;
    if (r.stats) s.stats = { sentencesTotal: 0, byDay: {}, ...r.stats };
    if (r.units) s.units = r.units;
    if (r.seenSounds) s.seenSounds = r.seenSounds;
    if (!s.profile?.name && r.name) s.profile = { name: r.name };
  }
  save();
  onChange('restore');
}

/** Queues a message for Krista. Returns true if it is likely to go out right away. */
export function sendMessage(data) {
  const s = getState();
  s.outbox.push({ id: randomId(), op: 'add', data: { ...data, from: 'learner', createdAt: Date.now() } });
  save();
  flush();
  return isOnline();
}

export function markRead(id) {
  const s = getState();
  if (s.inbox[id]) s.inbox[id].readAt = Date.now();
  s.outbox.push({ id: randomId(), op: 'read', msgId: id });
  save();
  flush();
}

export async function flush() {
  if (!conn || flushing) return;
  flushing = true;
  const { F, db } = conn;
  try {
    const s = getState();
    while (s.outbox.length) {
      const job = s.outbox[0];
      if (job.op === 'add') {
        // A client-side id makes a resend after a lost reply harmless.
        await F.setDoc(F.doc(db, 'families', fam(), 'messages', job.id), job.data);
      } else if (job.op === 'read') {
        await F.updateDoc(F.doc(db, 'families', fam(), 'messages', job.msgId), { readAt: Date.now() }).catch((e) => {
          if (e?.code !== 'not-found') throw e;
        });
      }
      s.outbox.shift();
      save();
    }
  } catch (e) {
    console.info('outbox waits', e?.message || e);
  } finally {
    flushing = false;
  }
}

/** Mirrors progress to learner/state so Krista can see it and a new phone can restore it. */
export async function pushProgress() {
  if (!conn) return;
  const s = getState();
  const { F, db } = conn;
  try {
    await F.setDoc(F.doc(db, 'families', fam(), 'learner', 'state'), {
      name: s.profile?.name || '',
      stats: s.stats,
      units: s.units,
      phrases: s.phrases,
      seenSounds: s.seenSounds,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.info('progress not sent', e?.message || e);
  }
}
