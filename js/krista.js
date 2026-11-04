// Krista's page: progress, inbox, messages and the weekly topic.
import { connect, isConfigured } from './fb.js';
import { loadContent, baseUnits, keyOf } from './content.js';
import { gardenSvg } from './garden.js';
import { validateUnit, parseUnitText, promptFor } from './validate.js';
import { esc, dayKey, hintHtml, weekStats, readJoin, randomId, lvCount } from './util.js';

const LS = 'angludarzs-family';
const statusEl = document.getElementById('status');
const body = document.getElementById('k-body');

let conn = null;
let fam = null;
let learner = null;
let messages = [];
let weekly = [];
let rawContent = null;
const markedRead = new Set();
const drafts = {};

const fmtTime = (ms) => (ms ? new Date(ms).toLocaleString('lv-LV', { dateStyle: 'medium', timeStyle: 'short' }) : '');

function setStatus(t) {
  statusEl.textContent = t;
}

async function boot() {
  const joined = readJoin();
  if (joined) localStorage.setItem(LS, joined);
  fam = localStorage.getItem(LS);
  rawContent = await loadContent();

  if (!isConfigured()) {
    setStatus('Firebase vēl nav iestatīts: aizpildi config.js.');
    body.innerHTML = setupHelp();
    wireSetup();
    return;
  }
  if (!fam) {
    setStatus('Šai ierīcei vēl nav ģimenes atslēgas.');
    body.innerHTML = setupHelp();
    wireSetup();
    return;
  }
  try {
    conn = await connect();
  } catch (e) {
    setStatus('Neizdevās pieslēgties: ' + (e?.message || e));
    return;
  }
  setStatus('Savienots.');
  render();
  subscribe();
}

function setupHelp() {
  return `<section class="k-section">
    <h2>Iestatīšana</h2>
    <p>Izveido slepenu ģimenes atslēgu (familyId). Tā nedrīkst nonākt repozitorijā.</p>
    <div class="k-row"><button class="k-btn main" id="gen">Izveidot jaunu atslēgu</button></div>
    <div id="gen-out"></div>
    <p class="muted">Ja atslēga jau ir, atver šo lapu ar <span class="k-code">krista.html#join=ATSLĒGA</span>.</p>
  </section>`;
}

function wireSetup() {
  document.getElementById('gen')?.addEventListener('click', () => {
    const id = randomId(32);
    const base = location.href.replace(/krista\.html.*$/, '');
    document.getElementById('gen-out').innerHTML = `
      <p>Atslēga: <span class="k-code">${id}</span></p>
      <p>Mammas telefonā (Chrome) atver:<br><span class="k-code">${esc(base)}#join=${id}</span></p>
      <p>Savā ierīcē atver:<br><span class="k-code">${esc(base)}krista.html#join=${id}</span></p>
      <p class="muted">Saglabā atslēgu drošā vietā. Bez tās jauns telefons nevar pievienoties.</p>`;
  });
}

function subscribe() {
  const { F, db } = conn;
  F.onSnapshot(F.doc(db, 'families', fam, 'learner', 'state'), (snap) => {
    learner = snap.exists() ? snap.data() : null;
    renderProgress();
  }, (e) => setStatus('Kļūda: ' + e.message));
  F.onSnapshot(F.query(F.collection(db, 'families', fam, 'messages'), F.orderBy('createdAt', 'desc'), F.limit(100)), (snap) => {
    messages = [];
    snap.forEach((d) => messages.push({ ...d.data(), id: d.id }));
    renderInbox();
    markLearnerMessagesRead();
  }, (e) => setStatus('Kļūda: ' + e.message));
  F.onSnapshot(F.collection(db, 'families', fam, 'units'), (snap) => {
    weekly = [];
    snap.forEach((d) => d.data()?.unit && weekly.push({ ...d.data().unit, createdAt: d.data().createdAt || 0, weekly: true }));
    weekly.sort((a, b) => b.createdAt - a.createdAt);
    renderProgress();
    renderPublished();
  });
}

function markLearnerMessagesRead() {
  const { F, db } = conn;
  for (const m of messages) {
    if (m.from === 'learner' && !m.readAt && !markedRead.has(m.id)) {
      markedRead.add(m.id);
      F.updateDoc(F.doc(db, 'families', fam, 'messages', m.id), { readAt: Date.now() }).catch(() => markedRead.delete(m.id));
    }
  }
}

function render() {
  body.innerHTML = `
    <section class="k-section" id="progress"><h2>Mammas progress</h2><p class="muted">Gaida datus…</p></section>
    <section class="k-section">
      <h2>Sūtīt ziņu</h2>
      <p class="muted">Ziņa parādīsies mammas sākuma ekrānā.</p>
      <textarea id="msg" rows="3" placeholder="Labrīt, mammu! …"></textarea>
      <div class="k-row"><button class="k-btn main" id="send-msg">Sūtīt</button><span id="msg-status"></span></div>
    </section>
    <section class="k-section"><h2>Iesūtne</h2><div id="inbox"><p class="muted">Gaida datus…</p></div></section>
    <section class="k-section" id="weekly">
      <h2>Nedēļas tēma (sestdienā)</h2>
      <label for="topic">Tēma</label>
      <input type="text" id="topic" placeholder="piem. Pie ārsta">
      <div class="k-row"><button class="k-btn" id="copy-prompt">Kopēt uzvedni Claude</button><span id="copy-status"></span></div>
      <label for="unit-json" style="display:block;margin-top:12px">Ielīmē Claude atbildi (JSON)</label>
      <textarea id="unit-json" class="json" spellcheck="false"></textarea>
      <div class="k-row">
        <button class="k-btn" id="preview">Priekšskatīt</button>
        <button class="k-btn main" id="publish" disabled>Publicēt</button>
        <span id="pub-status"></span>
      </div>
      <div id="preview-out"></div>
      <h3>Publicētās tēmas</h3>
      <ul id="published" class="k-units"></ul>
    </section>`;
  document.getElementById('send-msg').addEventListener('click', sendText);
  document.getElementById('copy-prompt').addEventListener('click', copyPrompt);
  document.getElementById('preview').addEventListener('click', preview);
  document.getElementById('publish').addEventListener('click', publish);
  document.getElementById('unit-json').addEventListener('input', () => {
    document.getElementById('publish').disabled = true;
  });
  document.getElementById('inbox').addEventListener('click', onInboxClick);
  document.getElementById('inbox').addEventListener('input', (e) => {
    if (e.target.dataset.reply) drafts[e.target.dataset.reply] = e.target.value;
  });
}

/* ---------- progress ---------- */

function renderProgress() {
  const el = document.getElementById('progress');
  if (!el) return;
  if (!learner) {
    el.innerHTML = '<h2>Mammas progress</h2><p class="muted">Vēl nav datu. Tie parādīsies pēc mammas pirmās nodarbības.</p>';
    return;
  }
  const ws = weekStats(learner.stats?.byDay || {});
  const phrases = learner.phrases || {};
  const units = [...baseUnits(), ...[...weekly].reverse()];
  let flowers = 0;
  let growing = 0;
  const rows = units.map((u) => {
    const speak = u.phrases.filter((p) => !p.listenOnly);
    const f = speak.filter((p) => (phrases[keyOf(u.id, p.id)]?.level || 0) >= 4).length;
    const g = speak.filter((p) => (phrases[keyOf(u.id, p.id)]?.level || 0) >= 1).length;
    flowers += f;
    growing += g;
    const intro = learner.units?.[u.id]?.introduced || 0;
    return `<li>${esc(u.pic || '')} ${esc(u.titleLv || u.id)}: ievadīti ${intro}/${u.phrases.length}, aug ${g}, zied ${f}</li>`;
  });
  el.innerHTML = `<h2>Mammas progress${learner.name ? ': ' + esc(learner.name) : ''}</h2>
    <div class="k-grid">
      <div class="k-stat"><b>${ws.sentences}</b>${lvCount(ws.sentences, 'teikums', 'teikumi')} šonedēļ</div>
      <div class="k-stat"><b>${ws.days}</b>${lvCount(ws.days, 'diena', 'dienas')} šonedēļ</div>
      <div class="k-stat"><b>${learner.stats?.sentencesTotal || 0}</b>${lvCount(learner.stats?.sentencesTotal || 0, 'teikums', 'teikumi')} kopā</div>
      <div class="k-stat"><b>${flowers}</b>ziedi · ${growing} augi</div>
    </div>
    <ul class="k-units">${rows.join('')}</ul>
    <div class="k-garden">${gardenSvg(phrases, new Set(), { units })}</div>
    ${troubleHtml(learner.trouble || {}, units, learner.name || 'Mamma')}
    <p class="muted">Atjaunināts: ${esc(fmtTime(learner.updatedAt))}</p>`;
}

const lvDay = (k) => {
  if (!k) return '';
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('lv-LV', { day: 'numeric', month: 'long' });
};

/** The phrases the speech check missed most, with what the phone heard instead. */
function troubleHtml(trouble, units, name) {
  const byKey = new Map(units.flatMap((u) => u.phrases.map((p) => [keyOf(u.id, p.id), p])));
  const rows = Object.entries(trouble)
    .map(([k, t]) => ({ p: byKey.get(k), t, score: (t.misses || 0) + 2 * (t.giveUps || 0) }))
    .filter((r) => r.p && r.score > 0)
    .sort((a, b) => b.score - a.score || (b.t.last || '').localeCompare(a.t.last || ''))
    .slice(0, 10);
  const body = rows.length
    ? `<ol class="k-trouble">${rows.map(({ p, t }) => `<li>
        <p><b lang="en-GB">${esc(p.en.replaceAll('{name}', name))}</b> <span class="muted">${esc(p.lv.replaceAll('{name}', name))}</span></p>
        <p class="k-meta">Nesaprata ${t.misses || 0}×${t.giveUps ? ` · pārgāja tālāk ${t.giveUps}×` : ''}${t.last ? ` · pēdējo reizi ${esc(lvDay(t.last))}` : ''}</p>
        ${t.heard?.length ? `<p class="k-heard">Telefons dzirdēja: ${t.heard.map((h) => `«<span lang="en">${esc(h)}</span>»`).join(', ')}</p>` : ''}
      </li>`).join('')}</ol>`
    : '<p class="muted">Pagaidām nav. Runas pārbaude visu saprata.</p>';
  return `<h3>Grūtākie teikumi</h3>
    <p class="muted">Teikumi, ko runas pārbaude visbiežāk nesaprata. Ja telefons dzird ko līdzīgu, vainīga var būt izruna vai pati pārbaude.</p>
    ${body}`;
}

/* ---------- inbox ---------- */

function renderInbox() {
  const el = document.getElementById('inbox');
  if (!el) return;
  if (!messages.length) {
    el.innerHTML = '<p class="muted">Vēl nav ziņu.</p>';
    return;
  }
  el.innerHTML = messages.map((m) => {
    const when = esc(fmtTime(m.createdAt));
    if (m.from === 'krista') {
      return `<div class="k-msg mine"><p class="k-meta">Tu · ${when} · ${m.readAt ? '✓ izlasīts' : 'vēl nav izlasīts'}</p><p>${esc(m.text || '')}</p></div>`;
    }
    let content = '';
    if (m.kind === 'audio') {
      content = `<p class="k-meta">🎙️ Atbilde · ${when}</p>${m.text ? `<p lang="en-GB"><b>${esc(m.text)}</b></p>` : ''}${m.audio?.startsWith('data:audio/') ? `<audio controls preload="none" src="${esc(m.audio)}"></audio>` : ''}`;
    } else if (m.kind === 'request') {
      content = `<p class="k-meta">💡 Gribu iemācīties · ${when}</p><p>${esc(m.text || '')}</p>`;
    } else {
      content = `<p class="k-meta">${when}</p><p>${esc(m.text || '')}</p>`;
    }
    return `<div class="k-msg">${content}
      <div class="k-reply"><textarea rows="1" data-reply="${esc(m.id)}" placeholder="Atbildēt…">${esc(drafts[m.id] || '')}</textarea>
      <button class="k-btn" data-send-reply="${esc(m.id)}">Atbildēt</button></div></div>`;
  }).join('');
}

async function addMessage(data) {
  const { F, db } = conn;
  await F.setDoc(F.doc(db, 'families', fam, 'messages', randomId()), { ...data, from: 'krista', kind: 'text', createdAt: Date.now() });
}

async function onInboxClick(e) {
  const id = e.target.dataset?.sendReply;
  if (!id) return;
  const ta = document.querySelector(`textarea[data-reply="${CSS.escape(id)}"]`);
  const text = ta.value.trim();
  if (!text) return ta.focus();
  e.target.disabled = true;
  try {
    await addMessage({ text, replyTo: id });
    delete drafts[id];
  } catch (err) {
    alert('Neizdevās nosūtīt: ' + err.message);
    e.target.disabled = false;
  }
}

async function sendText() {
  const ta = document.getElementById('msg');
  const st = document.getElementById('msg-status');
  const text = ta.value.trim();
  if (!text) return ta.focus();
  try {
    await addMessage({ text });
    ta.value = '';
    st.innerHTML = '<span class="k-ok">Nosūtīts.</span>';
  } catch (err) {
    st.innerHTML = `<span class="k-err">${esc(err.message)}</span>`;
  }
}

/* ---------- weekly topic ---------- */

async function copyPrompt() {
  const topic = document.getElementById('topic').value.trim() || 'TOPIC';
  const reference = JSON.stringify({ units: rawContent.units }, null, 1);
  const text = `${promptFor(topic, dayKey())}\n\nFor reference, here is content.json (units u1–u3):\n${reference}`;
  const st = document.getElementById('copy-status');
  try {
    await navigator.clipboard.writeText(text);
    st.innerHTML = '<span class="k-ok">Nokopēts. Ielīmē to Claude.</span>';
  } catch {
    st.innerHTML = '';
    document.getElementById('preview-out').innerHTML = `<p>Nokopē pats:</p><textarea class="json" readonly>${esc(text)}</textarea>`;
  }
}

let pending = null;

function preview() {
  const out = document.getElementById('preview-out');
  const pubBtn = document.getElementById('publish');
  pubBtn.disabled = true;
  pending = null;
  let unit;
  try {
    unit = parseUnitText(document.getElementById('unit-json').value);
  } catch (e) {
    out.innerHTML = `<p class="k-err">JSON nav derīgs: ${esc(e.message)}</p>`;
    return;
  }
  const errs = validateUnit(unit, baseUnits());
  if (errs.length) {
    out.innerHTML = `<ul class="k-err">${errs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    return;
  }
  const name = learner?.name || 'Mamma';
  const all = [...unit.phrases, ...baseUnits().flatMap((u) => u.phrases)];
  const byId = (id) => all.find((p) => p.id === id);
  out.innerHTML = `<h3>${esc(unit.pic || '')} ${esc(unit.titleLv)} <span class="muted">(${esc(unit.id)})</span></h3>
    <div class="k-preview">${unit.phrases.map((p) => `<div class="pb-row">
      <span class="pb-pic">${esc(p.pic || '')}</span>
      <div class="pb-text">
        <p class="pb-en" lang="en-GB">${esc(p.en.replaceAll('{name}', name))}${p.listenOnly ? ' <span class="muted">(tikai klausīties)</span>' : ''}</p>
        ${p.hint ? `<p class="hint small">${hintHtml(p.hint, name)}</p>` : ''}
        <p class="pb-lv">${esc(p.lv.replaceAll('{name}', name))}</p>
        ${p.de ? `<p class="de-line">🇩🇪 ${esc(p.de)}${p.hook ? ` · ${esc(p.hook)}` : ''}</p>` : ''}
      </div></div>`).join('')}</div>
    ${unit.dialogue?.lines ? `<h3>Saruna: ${esc(unit.dialogue.titleLv || '')}</h3><ol class="k-dlg">${unit.dialogue.lines.map((l) =>
      l.who === 'learner' ? `<li><b>Mamma:</b> ${esc((byId(l.phrase)?.en || l.phrase).replaceAll('{name}', name))}</li>` : `<li>${esc(l.en)} <span class="muted">(${esc(l.lv || '')})</span></li>`).join('')}</ol>` : ''}
    ${unit.question ? `<p><b>Jautājums:</b> <span lang="en-GB">${esc(unit.question.en)}</span> · ${esc(unit.question.lv)}</p>` : ''}
    ${weekly.some((w) => w.id === unit.id) ? '<p class="k-err">Tēma ar šo id jau ir publicēta. Publicējot to aizstās.</p>' : ''}`;
  pending = unit;
  pubBtn.disabled = false;
}

async function publish() {
  if (!pending) return;
  const st = document.getElementById('pub-status');
  const { F, db } = conn;
  try {
    await F.setDoc(F.doc(db, 'families', fam, 'units', pending.id), { unit: pending, createdAt: Date.now() });
    st.innerHTML = '<span class="k-ok">Publicēts! Mamma to redzēs nākamajā nodarbībā.</span>';
    document.getElementById('publish').disabled = true;
    pending = null;
  } catch (e) {
    st.innerHTML = `<span class="k-err">${esc(e.message)}</span>`;
  }
}

function renderPublished() {
  const el = document.getElementById('published');
  if (!el) return;
  el.innerHTML = weekly.length
    ? weekly.map((u) => `<li>${esc(u.pic || '')} ${esc(u.titleLv || u.id)} <span class="muted">(${esc(u.id)}, ${esc(fmtTime(u.createdAt))})</span></li>`).join('')
    : '<li class="muted">Vēl nav.</li>';
}

boot().catch((e) => setStatus('Kļūda: ' + e.message));
