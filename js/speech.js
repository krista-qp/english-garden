// Speaking and listening: speech synthesis, speech recognition and recording.
// Recognition and recording share one microphone lock and never run together.

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const hasTts = typeof window !== 'undefined' && 'speechSynthesis' in window;

export const RATE = { normal: 0.9, slow: 0.6, fast: 1.05 };

let voices = [];
function loadVoices() {
  voices = speechSynthesis.getVoices();
}
if (hasTts) {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

// Female British voices by name (Android/Chrome, iPhone, Windows). English prefers these.
const FEMALE = /female|woman|kate|serena|martha|stephanie|fiona|moira|tessa|libby|sonia|hazel|susan|maisie|mia|abbi|bella|hollie|olivia|\bgba\b|gbc|gbg/i;
const MALE = /\bmale\b|daniel|arthur|oliver|ryan|george|thomas|alfie|elliot|noah|\bgbb\b|gbd|rjs/i;

function pickVoice(lang) {
  const want = lang.toLowerCase();
  const exact = voices.filter((v) => v.lang.replace('_', '-').toLowerCase() === want);
  if (want.startsWith('en')) {
    const female = exact.filter((v) => FEMALE.test(v.name) && !/\bmale\b/i.test(v.name));
    const notMale = exact.filter((v) => !MALE.test(v.name));
    const pool = female.length ? female : notMale.length ? notMale : exact;
    return pool.find((v) => /google/i.test(v.name)) || pool.find((v) => v.localService) || pool[0] || null;
  }
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
