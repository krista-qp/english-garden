// Speaking and listening: speech synthesis, speech recognition and recording.
// Recognition and recording share one microphone lock and never run together.

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const hasTts = typeof window !== 'undefined' && 'speechSynthesis' in window;

export const RATE = { normal: 0.9, slow: 0.6, fast: 1.05 };

let voices = [];
let preferredUri = null;
const voiceListeners = new Set();
function loadVoices() {
  voices = speechSynthesis.getVoices();
  for (const fn of voiceListeners) fn();
}
if (hasTts) {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

const langOf = (v) => v.lang.replace('_', '-').toLowerCase();

/** British English voices on this device (falls back to any English voice). */
export function englishVoices() {
  const seen = new Set();
  const uniq = (list) => list.filter((v) => !seen.has(v.name) && seen.add(v.name));
  const gb = uniq(voices.filter((v) => langOf(v) === 'en-gb'));
  return gb.length ? gb : uniq(voices.filter((v) => langOf(v).startsWith('en')));
}

/** Calls fn whenever the device's voice list changes; returns an unsubscribe. */
export function onVoicesChanged(fn) {
  voiceListeners.add(fn);
  return () => voiceListeners.delete(fn);
}

/** The English voice to use, by voiceURI; null means the device default. */
export function setPreferredVoice(uri) {
  preferredUri = uri || null;
}

function pickVoice(lang) {
  const want = lang.toLowerCase();
  if (want.startsWith('en') && preferredUri) {
    const chosen = voices.find((v) => v.voiceURI === preferredUri);
    if (chosen) return chosen;
  }
  const exact = voices.filter((v) => langOf(v) === want);
  return exact.find((v) => /google/i.test(v.name)) || exact.find((v) => v.localService) || exact[0] || null;
}

export function cancelSpeech() {
  if (hasTts) speechSynthesis.cancel();
}

/** Speaks text; resolves when finished (or after a safety timeout). */
export function speak(text, { lang = 'en-GB', rate = RATE.normal } = {}) {
  return new Promise((resolve) => {
    if (!hasTts || !text) return resolve();
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const v = pickVoice(lang);
    if (v) {
      try { u.voice = v; } catch { /* keep the default voice */ }
    }
    u.onend = finish;
    u.onerror = finish;
    // Chrome sometimes drops an utterance queued straight after cancel().
    setTimeout(() => speechSynthesis.speak(u), 60);
    setTimeout(finish, 1500 + (text.length * 110) / rate);
  });
}

let micBusy = false;
let activeRec = null;
let activeRecorder = null;

export function canRecognise() {
  return !!SR;
}

export function canRecord() {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Listens once (tap to start, stops on silence).
 * Resolves {alts: string[]} or {error: string}.
 */
export function listen() {
  return new Promise((resolve) => {
    if (!SR) return resolve({ error: 'unavailable' });
    if (micBusy) return resolve({ error: 'busy' });
    micBusy = true;
    cancelSpeech();
    const r = new SR();
    r.lang = 'en-GB';
    r.maxAlternatives = 5;
    r.interimResults = false;
    r.continuous = false;
    const alts = [];
    let err = null;
    let settled = false;
    const end = () => {
      if (settled) return;
      settled = true;
      micBusy = false;
      activeRec = null;
      clearTimeout(guard);
      resolve(alts.length ? { alts } : { error: err || 'no-speech' });
    };
    r.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        for (let j = 0; j < res.length; j++) alts.push(res[j].transcript);
      }
    };
    r.onerror = (e) => {
      err = e.error;
    };
    r.onend = end;
    const guard = setTimeout(() => {
      try { r.abort(); } catch { /* ignore */ }
      end();
    }, 15000);
    activeRec = r;
    try {
      r.start();
    } catch {
      err = 'unavailable';
      end();
    }
  });
}

export function stopListening() {
  try { activeRec?.abort(); } catch { /* ignore */ }
}

function pickMime() {
  for (const m of ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

/**
 * Starts recording. Returns {stop(), cancel(), done: Promise<{blob, url}>}.
 * Throws if the microphone is unavailable or busy.
 */
export async function startRecording({ maxMs = 60000, onTick } = {}) {
  if (!canRecord()) throw new Error('unavailable');
  if (micBusy) throw new Error('busy');
  micBusy = true;
  cancelSpeech();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    micBusy = false;
    throw e;
  }
  const mimeType = pickMime();
  const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 24000 });
  const chunks = [];
  let cancelled = false;
  const started = Date.now();
  const tick = setInterval(() => onTick?.(Date.now() - started), 250);
  const limit = setTimeout(() => stop(), maxMs);
  const done = new Promise((resolve, reject) => {
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      clearInterval(tick);
      clearTimeout(limit);
      stream.getTracks().forEach((t) => t.stop());
      micBusy = false;
      activeRecorder = null;
      if (cancelled) return reject(new Error('cancelled'));
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' });
      resolve({ blob, url: URL.createObjectURL(blob) });
    };
  });
  function stop() {
    if (rec.state !== 'inactive') rec.stop();
  }
  const ctl = {
    stop,
    cancel() {
      cancelled = true;
      stop();
    },
    done,
  };
  activeRecorder = ctl;
  rec.start();
  return ctl;
}

export function cancelRecording() {
  activeRecorder?.cancel();
}

export function playUrl(url) {
  return new Promise((resolve) => {
    const a = new Audio(url);
    a.onended = a.onerror = () => resolve();
    a.play().catch(() => resolve());
  });
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}
