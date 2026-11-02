// Angļu dārzs: the learner's app. All interface text is Latvian.
import { load, save } from './store.js';
import {
  loadContent, lessonOrder, gardenUnits, unitById, keyOf, phraseByKey, resolvePhrase, soundsIn, soundLessons,
} from './content.js';
import {
  speak, cancelSpeech, RATE, canRecognise, canRecord, listen, stopListening, startRecording, cancelRecording, playUrl,
} from './speech.js';
import { isUnderstood } from './check.js';
import * as srs from './srs.js';
import { gardenSvg } from './garden.js';
import { startSync, sendMessage, markRead, pushProgress, syncEnabled } from './sync.js';
import { esc, dayKey, withName, hintHtml, lvCount, weekStats, readJoin } from './util.js';

const app = document.getElementById('app');
let S = null;
let handlers = {};
let gen = 0; // bumps on every screen change, so old async flows stop
let screenName = '';

const MSG = {
  listening: 'Klausos… Runā tagad.',
  ok: 'Sapratu!',
  again: 'Pamēģini vēlreiz.',
  moveOn: 'Lieliski, ejam tālāk.',
  fallback: 'Pasaki skaļi angliski un tad piespied «Pateicu».',
  saidOk: 'Labi!',
};

/* ---------- small building blocks ---------- */

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = handlers[el.dataset.act];
  if (fn) {
    e.preventDefault();
    fn(el, e);
  }
});

app.addEventListener('submit', (e) => {
  e.preventDefault();
  handlers.submit?.(e.target);
});

function mount(name, html, h = {}) {
  gen++;
  screenName = name;
  cancelSpeech();
  stopListening();
  cancelRecording();
  app.innerHTML = html;
  handlers = h;
  window.scrollTo(0, 0);
  const title = app.querySelector('h1, h2');
  if (title) {
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
  return gen;
}

// Line icons (24×24, stroked with the text colour). Every button also has a word.
const ICONS = {
  '←': '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  '→': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  '▶': '<path d="M8 5v14l11-7z"/>',
  '⚙️': '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  '✅': '<path d="M20 6 9 17l-5-5"/>',
  '✓': '<path d="M20 6 9 17l-5-5"/>',
  '👍': '<path d="M20 6 9 17l-5-5"/>',
  '✕': '<path d="M18 6 6 18M6 6l12 12"/>',
  '🌱': '<path d="M12 21v-9M12 12C12 8 9.5 6 5 6c0 4 2.5 6 7 6ZM12 10c0-3.5 2.2-5.5 7-5.5 0 3.5-2.2 5.5-7 5.5Z"/>',
  '🎙️': '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  '🎤': '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  '🏡': '<path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>',
  '🐢': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  '👀': '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  '💌': '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  '📨': '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  '💡': '<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.8 10.6c.7.6 1.3 1.5 1.3 2.4h5c0-.9.6-1.8 1.3-2.4A6 6 0 0 0 12 3Z"/>',
  '💬': '<path d="M20.5 11.5a8 8 0 0 1-11.7 7.1L4 20l1.3-4.4a8 8 0 1 1 15.2-4.1Z"/>',
  '🔊': '<path d="M11 5 6.5 9H3.5v6h3L11 19z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18.5 6a8.5 8.5 0 0 1 0 12"/>',
  '🧳': '<path d="M5 4.5h11.5a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h11.5M9 8.5h6"/>',
};
const icon = (e) =>
  ICONS[e]
    ? `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[e]}</svg>`
    : `<span class="ic" aria-hidden="true">${e}</span>`;
const btn = (act, label, cls = '', extra = '') =>
  `<button type="button" class="btn ${cls}" data-act="${act}" ${extra}>${label}</button>`;
const nameOf = () => S.profile?.name || '';
const enOf = (p) => withName(p.en, nameOf());
const lvOf = (p) => withName(p.lv, nameOf());
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const topBar = (left, right = '') => `<header class="top">${left}<div class="top-right">${right}</div></header>`;
const backBtn = () => btn('back', `${icon('←')} Atpakaļ`, 'btn-quiet');
const endBtn = () => btn('end', `${icon('✕')} Beigt`, 'btn-quiet');

function stepCounter() {
  const ss = S.session;
  const total = ss.steps.length - 1; // the close screen is not counted
  return `<span class="step-count">${Math.min(ss.idx + 1, total)} / ${total}</span>`;
}

function setFb(text, cls = '') {
  const f = document.getElementById('fb');
  if (f) {
    f.textContent = text;
    f.className = 'fb ' + cls;
  }
}
const setSlot = (html) => {
  const s = document.getElementById('slot');
  if (s) s.innerHTML = html;
};
const setSlot2 = (html) => {
  const s = document.getElementById('slot2');
  if (s) s.innerHTML = html;
};

/* ---------- navigation (Android back button returns home) ---------- */

function pushNav() {
  if (!history.state?.inApp) history.pushState({ inApp: true }, '');
}
function goHome() {
  if (history.state?.inApp) history.back();
  else renderHome();
}
window.addEventListener('popstate', () => {
  if (S?.profile?.name) renderHome();
});

/* ---------- first run ---------- */

function renderFirst() {
  mount(
    'first',
    `<div class="screen first">
      <main class="content center">
        <p class="kicker">Angļu valoda</p>
        <h1 class="brand">Angļu dārzs</h1>
        <form id="name-form" class="stack">
          <label for="name" class="big-label">Kā tevi sauc?</label>
          <input id="name" class="input" autocomplete="given-name" autocapitalize="words" enterkeyhint="done" required>
        </form>
      </main>
      <footer class="actions">${btn('go', `Sākt ${icon('→')}`, 'primary')}</footer>
    </div>`,
    {
      go: () => saveName(),
      submit: () => saveName(),
    },
  );
  function saveName() {
    const input = document.getElementById('name');
    const name = input.value.trim();
    if (!name) return input.focus();
    S.profile = { name };
    save();
    renderHome();
  }
}

/* ---------- home: Mans dārzs ---------- */

function todayLabel() {
  const t = new Date().toLocaleDateString('lv-LV', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Labrīt';
  if (h >= 12 && h < 18) return 'Labdien';
  return 'Labvakar';
}

function canResume() {
  const ss = S.session;
  return !!ss && ss.day === dayKey() && ss.idx < ss.steps.length;
}

function renderHome() {
  const ws = weekStats(S.stats.byDay);
  const msg = Object.values(S.inbox)
    .filter((m) => m.kind === 'text' && m.text && !m.readAt)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  const resume = canResume();
  mount(
    'home',
    `<div class="screen home">
      ${topBar(`<div><p class="date">${esc(todayLabel())}</p><h1 class="greet">${greeting()}, ${esc(nameOf())}</h1></div>`, btn('settings', `${icon('⚙️')} Iestatījumi`, 'btn-quiet small'))}
      <main class="content">
        ${msg ? `<section class="card message">
            <p class="msg-from">Ziņa no Kristas</p>
            <p class="msg-text">${esc(msg.text)}</p>
            ${btn('read', `${icon('✓')} Izlasīju`, 'btn-secondary', `data-id="${esc(msg.id)}"`)}
          </section>` : ''}
        <section class="garden-wrap">
          <h2 class="sr-only">Mans dārzs</h2>
          ${gardenSvg(S.phrases)}
        </section>
        <div class="week" aria-label="Šonedēļ: ${ws.sentences} ${lvCount(ws.sentences, 'teikums', 'teikumi')} angliski, ${ws.days} ${lvCount(ws.days, 'diena', 'dienas')}">
          <p class="kicker">Šonedēļ</p>
          <div class="stats">
            <p><b>${ws.sentences}</b><span>${lvCount(ws.sentences, 'teikums', 'teikumi')} angliski</span></p>
            <p><b>${ws.days}</b><span>${lvCount(ws.days, 'diena', 'dienas')}</span></p>
          </div>
        </div>
        <div class="row-btns">
          ${btn('phrasebook', `${icon('🧳')} Ceļojuma vārdnīca`, 'btn-secondary')}
          ${btn('wish', `${icon('💡')} Gribu iemācīties…`, 'btn-secondary')}
        </div>
      </main>
      <footer class="actions">${btn('start', resume ? `${icon('▶')} Turpināt nodarbību` : `${icon('🌱')} Sākt nodarbību`, 'primary')}</footer>
    </div>`,
    {
      start: () => {
        if (!canResume()) S.session = buildSession();
        save();
        pushNav();
        runStep();
      },
      settings: () => {
        pushNav();
        renderSettings();
      },
      phrasebook: () => {
        pushNav();
        renderPhrasebook();
      },
      wish: () => {
        pushNav();
        renderWish();
      },
      read: (el) => {
        markRead(el.dataset.id);
        renderHome();
      },
    },
  );
}

/* ---------- session ---------- */

const introducedCount = (uid) => S.units[uid]?.introduced || 0;

function currentUnit() {
  return lessonOrder().find((u) => introducedCount(u.id) < u.phrases.length) || null;
}

function lastCompletedUnit() {
  let best = null;
  let t = -1;
  for (const [id, u] of Object.entries(S.units)) {
    if (u.completedAt && u.completedAt > t && unitById(id)) {
      best = id;
      t = u.completedAt;
    }
  }
  return best;
}

function isSpeakableKey(k) {
  const r = phraseByKey(k);
  return !!r && !r.phrase.listenOnly;
}

function buildSession() {
  const today = dayKey();
  const steps = srs.dueKeys(S.phrases, today, 5, isSpeakableKey).map((key) => ({ type: 'review', key }));
  const cur = currentUnit();
  let dlg = null;
  if (cur) {
    const from = introducedCount(cur.id);
    const fresh = cur.phrases.slice(from, from + 5);
    for (const p of fresh) steps.push({ type: 'new', key: keyOf(cur.id, p.id) });
    if (fresh.length && from + fresh.length >= cur.phrases.length) dlg = cur.id;
  }
  if (!dlg) dlg = lastCompletedUnit();
  if (dlg && unitById(dlg)?.dialogue?.lines?.length) steps.push({ type: 'dialogue', unitId: dlg });
  steps.push({ type: 'close' });
  return { day: today, steps, idx: 0, grown: [] };
}

function runStep() {
  const ss = S.session;
  if (!ss) return goHome();
  const st = ss.steps[ss.idx];
  if (!st) return finishSession();
  switch (st.type) {
    case 'review': return renderReview(st);
    case 'new': return renderNew(st);
    case 'dialogue': return renderDialogue(st);
    case 'words': return skipStep(); // removed step; may linger in a saved session
    default: return renderClose();
  }
}

function completeStep() {
  S.session.idx++;
  save();
}

function skipStep() {
  completeStep();
  runStep();
}

function endSession() {
  save();
  pushProgress();
  goHome();
}

function finishSession() {
  S.session = null;
  save();
  pushProgress();
  goHome();
}

function countSaid() {
  const d = dayKey();
  S.stats.sentencesTotal = (S.stats.sentencesTotal || 0) + 1;
  S.stats.byDay[d] = (S.stats.byDay[d] || 0) + 1;
  save();
}

function grew(key) {
  if (S.session && !S.session.grown.includes(key)) S.session.grown.push(key);
}

/* ---------- speaking: Runāt / Pateicu ---------- */

const useFallback = () => !S.settings.checkSpeech || !canRecognise();

function speakControls(hintText = '') {
  const fb = useFallback() ? MSG.fallback : hintText;
  return `<p class="fb" id="fb" role="status" aria-live="polite">${esc(fb)}</p>
    <div class="slot" id="slot">${useFallback() ? btn('said', `${icon('✅')} Pateicu`, 'primary') : btn('speak', `${icon('🎤')} Runāt`, 'primary')}</div>`;
}

async function recognise(expected) {
  const r = await listen();
  if (r.error) {
    if (r.error === 'not-allowed' || r.error === 'service-not-allowed') {
      S.settings.checkSpeech = false;
      save();
      return 'fallback';
    }
    if (['network', 'unavailable', 'audio-capture', 'language-not-supported', 'busy'].includes(r.error)) return 'fallback';
    return 'fail';
  }
  return isUnderstood(expected, r.alts, nameOf()) ? 'pass' : 'fail';
}

/**
 * Wires the speak/said handlers. Two tries, then move on. Speaking is never scored.
 * onAttempt(ok, last) runs after each try; onDone(passed) once at the end.
 */
function wireSpeaking(h, { expected, onAttempt, onDone, onNext }) {
  let tries = 0;
  let finished = false;
  const my = gen;
  const done = async (passed) => {
    finished = true;
    await onDone(passed);
    if (my !== gen) return;
    if (onNext) {
      setSlot(btn('next', `Tālāk ${icon('→')}`, 'primary'));
      h.next = onNext;
    }
  };
  h.speak = async (el) => {
    if (finished) return;
    el.disabled = true;
    el.classList.add('listening');
    setFb(MSG.listening, 'listening');
    const r = await recognise(expected);
    if (my !== gen) return;
    el.disabled = false;
    el.classList.remove('listening');
    if (r === 'fallback') {
      setFb(MSG.fallback);
      setSlot(btn('said', `${icon('✅')} Pateicu`, 'primary'));
      return;
    }
    if (r === 'pass') {
      setFb(MSG.ok, 'ok');
      countSaid();
      await onAttempt?.(true, true);
      return done(true);
    }
    tries++;
    if (tries >= 2) {
      setFb(MSG.moveOn, 'soft');
      await onAttempt?.(false, true);
      return done(false);
    }
    setFb(MSG.again, 'soft');
    await onAttempt?.(false, false);
  };
  h.said = async () => {
    if (finished) return;
    finished = true;
    setFb(MSG.saidOk, 'ok');
    countSaid();
    await onAttempt?.(true, true);
    finished = false;
    return done(true);
  };
}

async function compareVoice(el, text) {
  const my = gen;
  const fb = document.getElementById('fb');
  const before = fb ? [fb.textContent, fb.className] : null;
  el.disabled = true;
  try {
    setFb('Runā tagad…', 'listening');
    const rec = await startRecording({ maxMs: 4000 });
    const { url } = await rec.done;
    if (my !== gen) return;
    setFb('Tava balss…');
    await playUrl(url);
    URL.revokeObjectURL(url);
    if (my !== gen) return;
    setFb('Un tagad paraugs.');
    await speak(text);
    if (my === gen && before) setFb(before[0], before[1].replace('fb', '').trim());
  } catch {
    if (my === gen) setFb('Mikrofons nav pieejams.', 'soft');
  } finally {
    el.disabled = false;
  }
}

/* ---------- phrase card (new phrase) ---------- */

function cardBody(p) {
  const showHint = S.settings.showHints && p.hint;
  const de = S.settings.showDe && p.de;
  return `<div class="pic" aria-hidden="true">${esc(p.pic || '')}</div>
    <p class="en" lang="en-GB">${esc(enOf(p))}</p>
    ${showHint ? `<p class="hint"><span class="sr-only">Izruna: </span>${hintHtml(p.hint, nameOf())}</p>` : ''}
    <p class="lv">${esc(lvOf(p))}</p>
    ${de ? `<div class="de">
        <p><span class="de-label">Vāciski</span><span lang="de">${esc(withName(p.de, nameOf()))}</span></p>
        ${btn('de', `${icon('🔊')} Vāciski`, 'btn-small')}
        ${p.hook ? `<p class="hook">Līdzīgi vārdi: ${esc(p.hook)}</p>` : ''}
      </div>` : ''}`;
}

function renderNew(st) {
  const r = phraseByKey(st.key);
  if (!r) return skipStep();
  const { unit, phrase: p } = r;
  const need = soundsIn(p).find((s) => !S.seenSounds[s] && soundLessons()[s]);
  if (need) return renderSoundLesson(need, () => renderNew(st));

  const text = enOf(p);
  const h = {
    end: endSession,
    listen: () => speak(text),
    slow: () => speak(text, { rate: RATE.slow }),
    de: () => speak(withName(p.de, nameOf()), { lang: 'de-DE' }),
    compare: (el) => compareVoice(el, text),
  };
  const introduce = (passed) => {
    const idx = unit.phrases.findIndex((x) => x.id === p.id);
    const u = S.units[unit.id] || (S.units[unit.id] = { introduced: 0 });
    u.introduced = Math.max(u.introduced || 0, idx + 1);
    if (u.introduced >= unit.phrases.length && !u.completedAt) u.completedAt = Date.now();
    if (!S.phrases[st.key]) {
      S.phrases[st.key] = p.listenOnly ? { level: 0, listenOnly: true, firstSeen: dayKey() } : srs.introduce(passed, dayKey());
      if (!p.listenOnly) grew(st.key);
    }
    completeStep();
  };

  let footer;
  if (p.listenOnly) {
    footer = `<p class="fb" id="fb">Šo tikai klausies un saproti.</p>
      <div class="slot" id="slot">${btn('understood', `${icon('👍')} Sapratu`, 'primary')}</div>`;
    h.understood = () => {
      introduce(false);
      runStep();
    };
  } else {
    footer = speakControls();
  }

  const my = mount(
    'new',
    `<div class="screen card-screen">
      ${topBar(endBtn(), stepCounter())}
      <main class="content">
        <p class="kicker">${p.listenOnly ? 'Klausies' : 'Jauns teikums'}</p>
        ${cardBody(p)}
        <div class="row-btns">
          ${btn('listen', `${icon('🔊')} Klausīties`, 'btn-secondary')}
          ${btn('slow', `${icon('🐢')} Lēnāk`, 'btn-secondary')}
        </div>
        ${canRecord() && !p.listenOnly ? btn('compare', `${icon('🎙️')} Salīdzināt balsi`, 'btn-quiet wide') : ''}
      </main>
      <footer class="actions">${footer}</footer>
    </div>`,
    h,
  );
  if (!p.listenOnly) {
    wireSpeaking(h, {
      expected: p.en,
      onAttempt: async (ok, last) => {
        if (!ok && !last) await speak(text);
      },
      onDone: introduce,
      onNext: runStep,
    });
  }
  setTimeout(() => my === gen && speak(text), 350);
}

/* ---------- sound mini-lesson (th, w) ---------- */

function renderSoundLesson(id, cont) {
  const L = soundLessons()[id];
  const h = {
    end: endSession,
    ok: () => {
      S.seenSounds[id] = true;
      save();
      cont();
    },
  };
  L.examples.forEach((ex, i) => {
    h['ex' + i] = () => speak(ex, { rate: RATE.slow });
  });
  const marks = id === 'th' ? '<u>s</u> vai <u>z</u>' : '<u>w</u>';
  mount(
    'sound',
    `<div class="screen">
      ${topBar(endBtn(), S.session ? stepCounter() : '')}
      <main class="content">
        <p class="kicker">Jauna skaņa</p>
        <h2>${esc(L.title)}</h2>
        <p class="sound-big" lang="en-GB">${esc(id)}</p>
        <p class="lv-text">${esc(L.lv)}</p>
        <p class="muted">Izrunas norādēs šī skaņa ir pasvītrota: ${marks}.</p>
        <div class="examples">
          ${L.examples.map((ex, i) => btn('ex' + i, `${icon('🔊')} <span lang="en-GB">${esc(ex)}</span>`, 'btn-secondary')).join('')}
        </div>
      </main>
      <footer class="actions">${btn('ok', `Sapratu, turpinām ${icon('→')}`, 'primary')}</footer>
    </div>`,
    h,
  );
}

/* ---------- review card ---------- */

function renderReview(st) {
  const r = phraseByKey(st.key);
  if (!r) return skipStep();
  const p = r.phrase;
  const text = enOf(p);
  const h = {
    end: endSession,
    listen: () => speak(text),
    slow: () => speak(text, { rate: RATE.slow }),
  };
  mount(
    'review',
    `<div class="screen card-screen">
      ${topBar(endBtn(), stepCounter())}
      <main class="content">
        <p class="kicker">Atkārtojam</p>
        <div class="pic" aria-hidden="true">${esc(p.pic || '')}</div>
        <p class="lv lv-big">${esc(lvOf(p))}</p>
        <p class="prompt">Kā to pateikt angliski?</p>
        <div id="answer" hidden>
          <p class="en" lang="en-GB">${esc(text)}</p>
          <div class="row-btns">
            ${btn('listen', `${icon('🔊')} Klausīties`, 'btn-secondary')}
            ${btn('slow', `${icon('🐢')} Lēnāk`, 'btn-secondary')}
          </div>
        </div>
      </main>
      <footer class="actions">${speakControls()}</footer>
    </div>`,
    h,
  );
  wireSpeaking(h, {
    expected: p.en,
    onAttempt: async () => {
      const a = document.getElementById('answer');
      if (a) a.hidden = false;
      await speak(text);
    },
    onDone: (passed) => {
      const today = dayKey();
      const rec = S.phrases[st.key];
      S.phrases[st.key] = passed ? srs.pass(rec, today) : srs.fail(rec, today);
      if (passed) grew(st.key);
      completeStep();
    },
    onNext: runStep,
  });
}

/* ---------- dialogue ---------- */

const rateOf = (l) => (l.speed === 'fast' ? RATE.fast : l.speed === 'slow' ? RATE.slow : RATE.normal);

function renderDialogue(st) {
  const unit = unitById(st.unitId);
  const d = unit?.dialogue;
  if (!d?.lines?.length) return skipStep();
  const first = !((S.units[unit.id]?.dialogueRuns || 0) > 0);
  let i = 0;
  const h = {
    end: endSession,
    toggle: (el) => {
      const on = document.getElementById('chat').classList.toggle('show-lv');
      el.setAttribute('aria-pressed', String(on));
    },
    replay: (el) => {
      const l = d.lines[+el.dataset.i];
      speak(withName(l.en, nameOf()), { rate: rateOf(l) });
    },
  };
  const my = mount(
    'dialogue',
    `<div class="screen dialogue">
      ${topBar(endBtn(), stepCounter())}
      <main class="content">
        <p class="kicker">Saruna</p>
        <h2>${esc(d.titleLv || '')}</h2>
        ${btn('toggle', `${icon('💬')} Ko viņš teica?`, 'btn-quiet wide', 'aria-pressed="false"')}
        <div id="chat" class="chat"></div>
        <div id="turn" class="turn" aria-live="polite"></div>
      </main>
      <footer class="actions">
        <p class="fb" id="fb" role="status" aria-live="polite"></p>
        <div class="slot" id="slot"></div>
      </footer>
    </div>`,
    h,
  );
  const chat = document.getElementById('chat');
  const turn = document.getElementById('turn');
  const show = (node) => node?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const addOther = (l, idx) => {
    chat.insertAdjacentHTML(
      'beforeend',
      `<div class="bubble other">
        <p lang="en-GB">${esc(withName(l.en, nameOf()))}</p>
        <p class="lv">${esc(withName(l.lv || '', nameOf()))}</p>
        ${btn('replay', `${icon('🔊')} Vēlreiz`, 'btn-mini', `data-i="${idx}"`)}
      </div>`,
    );
    show(chat.lastElementChild);
  };
  const addMine = (text) => {
    chat.insertAdjacentHTML('beforeend', `<div class="bubble mine"><p lang="en-GB">${esc(text)}</p></div>`);
    show(chat.lastElementChild);
  };

  async function advance() {
    while (i < d.lines.length) {
      if (my !== gen) return;
      const l = d.lines[i];
      if (l.who === 'learner') return learnerTurn(l);
      addOther(l, i);
      await speak(withName(l.en, nameOf()), { rate: rateOf(l) });
      await wait(350);
      i++;
    }
    if (my !== gen) return;
    const u = S.units[unit.id] || (S.units[unit.id] = { introduced: 0 });
    u.dialogueRuns = (u.dialogueRuns || 0) + 1;
    completeStep();
    turn.innerHTML = '<p class="done">Saruna pabeigta.</p>';
    setFb('');
    setSlot(btn('next', `Tālāk ${icon('→')}`, 'primary'));
    h.next = runStep;
    show(turn);
  }

  function learnerTurn(l) {
    const r = resolvePhrase(l.phrase, unit.id);
    if (!r) {
      i++;
      return advance();
    }
    const p = r.phrase;
    const text = enOf(p);
    const speaking = () => {
      setFb(useFallback() ? MSG.fallback : 'Tagad pasaki to skaļi.');
      setSlot(useFallback() ? btn('said', `${icon('✅')} Pateicu`, 'primary') : btn('speak', `${icon('🎤')} Runāt`, 'primary'));
      wireSpeaking(h, {
        expected: p.en,
        onAttempt: async (ok, last) => {
          if (!ok && !last) await speak(text);
        },
        onDone: async (passed) => {
          turn.innerHTML = '';
          setSlot('');
          addMine(text);
          if (!passed) await speak(text);
          else await wait(400);
          if (my !== gen) return;
          setFb('');
          i++;
          advance();
        },
      });
    };

    if (first) {
      const pool = unit.phrases.filter((x) => !x.listenOnly && x.id !== p.id);
      const other = pool[Math.floor(Math.random() * pool.length)];
      const opts = [p, other].filter(Boolean).sort(() => Math.random() - 0.5);
      turn.innerHTML = `<p class="turn-q">Tava kārta. Ko tu teiksi?</p>
        ${opts.map((o) => btn('opt', `<span lang="en-GB">${esc(enOf(o))}</span>`, 'btn-option', `data-ok="${o === p ? 1 : 0}"`)).join('')}`;
      setFb('');
      setSlot('');
      h.opt = (el) => {
        if (el.dataset.ok === '1') {
          turn.innerHTML = `<p class="turn-q">Tava kārta:</p>
            <p class="en en-small" lang="en-GB">${esc(text)}</p>
            ${btn('hear', `${icon('🔊')} Klausīties`, 'btn-secondary')}`;
          h.hear = () => speak(text);
          speaking();
        } else {
          el.disabled = true;
          el.classList.add('dim');
          setFb('Gandrīz! Pamēģini otru.', 'soft');
        }
      };
    } else {
      turn.innerHTML = `<p class="turn-q">Tava kārta. Atbildi angliski.</p>
        ${btn('reveal', `${icon('👀')} Parādīt atbildi`, 'btn-quiet wide')}
        <p class="en en-small" id="ans" lang="en-GB" hidden>${esc(text)}</p>`;
      h.reveal = (el) => {
        document.getElementById('ans').hidden = false;
        el.remove();
        speak(text);
      };
      speaking();
    }
    show(turn);
  }

  setTimeout(() => my === gen && advance(), 350);
}

/* ---------- close ---------- */

function renderClose() {
  const n = S.stats.byDay[dayKey()] || 0;
  const grown = new Set(S.session?.grown || []);
  mount(
    'close',
    `<div class="screen">
      ${topBar(btn('done', `${icon('✕')} Beigt`, 'btn-quiet'))}
      <main class="content center-text">
        <h1 class="close-title">Šodien tu angliski pateici <span class="big-number">${n}</span> ${lvCount(n, 'teikumu', 'teikumus')}</h1>
        <p class="muted">${grown.size ? 'Paskaties, kas tavā siltumnīcā paaudzies.' : 'Lieliski pastrādāts.'}</p>
        <section class="garden-wrap">${gardenSvg(S.phrases, grown)}</section>
      </main>
      <footer class="actions">${btn('done', `${icon('🏡')} Uz dārzu`, 'primary')}</footer>
    </div>`,
    { done: finishSession },
  );
}

/* ---------- Ceļojuma vārdnīca ---------- */

function renderPhrasebook() {
  const sections = gardenUnits()
    .map((u) => {
      const met = u.phrases.slice(0, introducedCount(u.id));
      if (!met.length) return '';
      return `<section class="pb-unit">
        <h2 class="section-title">${esc(u.titleLv || u.id)}</h2>
        <ul class="pb-list">${met
          .map((p) => {
            const t = enOf(p);
            return `<li class="pb-row">
              <span class="pb-pic" aria-hidden="true">${esc(p.pic || '')}</span>
              <div class="pb-text">
                <p class="pb-en" lang="en-GB">${esc(t)}</p>
                ${S.settings.showHints && p.hint ? `<p class="hint small">${hintHtml(p.hint, nameOf())}</p>` : ''}
                <p class="pb-lv">${esc(lvOf(p))}</p>
              </div>
              <div class="pb-btns">
                ${btn('say', `${icon('🔊')} Klausīties`, 'btn-small', `data-t="${esc(t)}"`)}
                ${btn('slow', `${icon('🐢')} Lēnāk`, 'btn-small', `data-t="${esc(t)}"`)}
              </div>
            </li>`;
          })
          .join('')}</ul>
      </section>`;
    })
    .join('');
  mount(
    'phrasebook',
    `<div class="screen">
      ${topBar(backBtn())}
      <main class="content">
        <h1>Ceļojuma vārdnīca</h1>
        ${sections || '<p class="muted">Vēl nav neviena teikuma. Sāc nodarbību, un teikumi parādīsies šeit.</p>'}
      </main>
      <footer class="actions">${btn('back', `${icon('🏡')} Uz dārzu`, 'primary')}</footer>
    </div>`,
    {
      back: goHome,
      say: (el) => speak(el.dataset.t),
      slow: (el) => speak(el.dataset.t, { rate: RATE.slow }),
    },
  );
}

/* ---------- Gribu iemācīties… ---------- */

function renderWish() {
  const h = {
    back: goHome,
    send: () => {
      const ta = document.getElementById('wish');
      const text = ta.value.trim();
      if (!text) return ta.focus();
      sendMessage({ kind: 'request', text });
      ta.value = '';
      setFb(syncEnabled() && navigator.onLine ? 'Nosūtīts! Krista sagatavos jaunu tēmu.' : 'Saglabāts. Nosūtīsim Kristai, kad būs internets.', 'ok');
      setSlot(btn('back', `${icon('🏡')} Uz dārzu`, 'primary'));
    },
  };
  mount(
    'wish',
    `<div class="screen">
      ${topBar(backBtn())}
      <main class="content">
        <h1>Gribu iemācīties…</h1>
        <label for="wish" class="big-label">Ko tu gribētu iemācīties pateikt angliski?</label>
        <textarea id="wish" class="input" rows="4" placeholder="Piemēram: kā pasūtīt taksometru"></textarea>
      </main>
      <footer class="actions">
        <p class="fb" id="fb" role="status" aria-live="polite"></p>
        <div class="slot" id="slot">${btn('send', `${icon('📨')} Sūtīt Kristai`, 'primary')}</div>
      </footer>
    </div>`,
    h,
  );
}

/* ---------- settings ---------- */

function renderSettings() {
  const st = S.settings;
  const toggle = (id, label, on) => `<label class="toggle"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span>${label}</span></label>`;
  const link = syncEnabled() ? '✓ Savienots ar Kristu.' : 'Darbojas tikai šajā telefonā.';
  mount(
    'settings',
    `<div class="screen">
      ${topBar(backBtn())}
      <main class="content">
        <h1>Iestatījumi</h1>
        <form class="stack" id="settings-form">
          <label for="name" class="big-label">Tavs vārds</label>
          <input id="name" class="input" value="${esc(nameOf())}" autocomplete="given-name">
          ${toggle('showDe', 'Rādīt teikumu vāciski', st.showDe)}
          ${toggle('showHints', 'Rādīt izrunas norādes', st.showHints)}
          ${toggle('checkSpeech', 'Pārbaudīt runu ar mikrofonu', st.checkSpeech && canRecognise())}
        </form>
        <p class="muted">${link}</p>
      </main>
      <footer class="actions">${btn('save', `${icon('✓')} Saglabāt`, 'primary')}</footer>
    </div>`,
    {
      back: goHome,
      submit: () => handlers.save(),
      save: () => {
        const name = document.getElementById('name').value.trim();
        if (name) S.profile = { ...S.profile, name };
        st.showDe = document.getElementById('showDe').checked;
        st.showHints = document.getElementById('showHints').checked;
        st.checkSpeech = document.getElementById('checkSpeech').checked;
        save();
        goHome();
      },
    },
  );
}

/* ---------- start ---------- */

async function boot() {
  S = await load();
  const fam = readJoin();
  if (fam) {
    S.familyId = fam;
    save();
  }
  try {
    await loadContent();
  } catch {
    mount(
      'error',
      `<div class="screen"><main class="content center">
        <h1>Neizdevās ielādēt nodarbības</h1>
        <p>Pieslēdzies internetam un mēģini vēlreiz.</p>
      </main><footer class="actions">${btn('reload', 'Mēģināt vēlreiz', 'primary')}</footer></div>`,
      { reload: () => location.reload() },
    );
    return;
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  startSync((what) => {
    if (screenName === 'home') renderHome();
    else if (what === 'restore' && screenName === 'first' && S.profile?.name) renderHome();
  });
  if (!S.profile?.name) renderFirst();
  else renderHome();
}

boot();
