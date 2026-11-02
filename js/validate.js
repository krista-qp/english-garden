// Checks a weekly unit pasted by Krista before it is published.

export function parseUnitText(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(cleaned);
}

/** Returns a list of problems (Latvian), empty when the unit is fine. */
export function validateUnit(unit, baseUnits = []) {
  const errs = [];
  if (!unit || typeof unit !== 'object' || Array.isArray(unit)) return ['Tas nav viens JSON objekts.'];
  if (!unit.id || !/^[a-z0-9-]+$/i.test(unit.id)) errs.push('Trūkst "id" (piemēram "topic-2026-11-07").');
  if (baseUnits.some((u) => u.id === unit.id)) errs.push(`"id" ${unit.id} jau ir content.json.`);
  if (!unit.titleLv) errs.push('Trūkst "titleLv".');
  if (!Array.isArray(unit.phrases) || unit.phrases.length === 0) {
    errs.push('Trūkst "phrases" saraksta.');
    return errs;
  }
  const ids = new Set();
  unit.phrases.forEach((p, i) => {
    const n = i + 1;
    if (!p.id) errs.push(`${n}. teikumam trūkst "id".`);
    else if (ids.has(p.id)) errs.push(`"id" ${p.id} atkārtojas.`);
    ids.add(p.id);
    for (const f of ['en', 'lv']) if (!p[f]) errs.push(`${n}. teikumam (${p.id || '?'}) trūkst "${f}".`);
  });
  const known = new Set([...ids, ...baseUnits.flatMap((u) => u.phrases.map((p) => p.id))]);
  if (unit.dialogue) {
    if (!Array.isArray(unit.dialogue.lines)) errs.push('"dialogue.lines" nav saraksts.');
    else {
      unit.dialogue.lines.forEach((l, i) => {
        if (l.who === 'learner') {
          if (!known.has(l.phrase)) errs.push(`Sarunas ${i + 1}. rindā teikums "${l.phrase}" nav atrasts.`);
        } else if (!l.en) errs.push(`Sarunas ${i + 1}. rindai trūkst "en".`);
      });
    }
  }
  if (unit.question && (!unit.question.en || !unit.question.lv)) errs.push('"question" vajag gan "en", gan "lv".');
  return errs;
}

export function promptFor(topic, date) {
  return `Make one lesson unit for Angļu dārzs as JSON in exactly the shape of the units in content.json. Topic: «${topic}». Learner: Latvian, English A1, understands German. 6–8 short, useful British-English phrases; for each: en, lv, hint (Latvian-letter pronunciation, [s]/[z] for th, [w] for w), de (whole phrase in German), hook (English–German cognate, only if real), pic (one emoji). Add a dialogue of 6–10 lines that uses only these phrases or ones from units u1–u3 on the learner's turns, and a question that invites a spoken answer. id = "topic-${date}".`;
}
