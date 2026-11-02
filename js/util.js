// Small shared helpers. No DOM access here, so tests can import it in Node.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/** Day keys from Monday of the current week up to today. */
export function thisWeekKeys(now = new Date()) {
  const today = dayKey(now);
  const back = (now.getDay() + 6) % 7; // Monday = 0
  const keys = [];
  for (let i = back; i >= 0; i--) keys.push(addDays(today, -i));
  return keys;
}

export function weekStats(byDay = {}, now = new Date()) {
  let sentences = 0;
  let days = 0;
  for (const k of thisWeekKeys(now)) {
    const n = byDay[k] || 0;
    sentences += n;
    if (n > 0) days++;
  }
  return { sentences, days };
}

export function withName(s, name) {
  return String(s ?? '').replaceAll('{name}', name || '…');
}

/** Hint text as HTML: [x] becomes underlined x (sounds with no Latvian letter). */
export function hintHtml(hint, name) {
  return esc(withName(hint, name)).replace(/\[([^\]]+)\]/g, '<u>$1</u>');
}

/** Latvian number agreement: 1, 21, 31… take the singular form. */
export function lvCount(n, one, many) {
  return n % 10 === 1 && n % 100 !== 11 ? one : many;
}

export function randomId(len = 20) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

/** Reads `#join=<familyId>` from the URL, clears the hash, returns the id or null. */
export function readJoin() {
  const m = /^#join=([A-Za-z0-9_-]+)$/.exec(location.hash);
  if (!m) return null;
  history.replaceState(null, '', location.pathname + location.search);
  return m[1].length >= 24 ? m[1] : null;
}
