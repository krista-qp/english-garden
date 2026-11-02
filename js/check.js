// Speech check: was the phrase understood? Never a score, only yes or no.

const CONTRACTIONS = [
  [/\bi'm\b/g, 'i am'],
  [/\bdon't\b/g, 'do not'],
  [/\bit's\b/g, 'it is'],
  [/\bwhat's\b/g, 'what is'],
  [/\bthat's\b/g, 'that is'],
];

const HELLO = new Set(['hello', 'hallo', 'hullo']);

export function normalise(text) {
  let t = String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'");
  for (const [re, full] of CONTRACTIONS) t = t.replace(re, full);
  t = t.replace(/[^a-z0-9'\s]/g, ' ').replace(/'/g, '');
  return t.split(/\s+/).filter(Boolean);
}

function same(a, b) {
  return a === b || (HELLO.has(a) && HELLO.has(b));
}

/**
 * @param {string} expected  phrase as written in content.json (may contain {name})
 * @param {string[]} alternatives  recogniser transcripts
 * @param {string} name  learner's name
 */
export function isUnderstood(expected, alternatives, name = '') {
  const nameTokens = new Set(normalise(name));
  // The name is optional: recognisers rarely get Latvian names right,
  // so only the rest of the phrase has to match.
  const exp = normalise(String(expected).replaceAll('{name}', ' ')).filter((t) => !nameTokens.has(t));
  if (exp.length === 0) return alternatives.some((a) => normalise(a).length > 0);
  for (const alt of alternatives) {
    const got = normalise(alt);
    const hits = exp.filter((t) => got.some((g) => same(g, t))).length;
    if (exp.length <= 2 ? hits === exp.length : hits / exp.length >= 0.6) return true;
  }
  return false;
}
