// The garden drawing: one planter per unit, one plant per speakable phrase.
// Stage follows level: 0 seeds, 1 sprout, 2 leaves, 3 bud, 4 flower, 5 flower with a second bloom.
// Colours come from CSS classes (theme) and the unit colour (flowers).
import { esc } from './util.js';
import { gardenUnits, keyOf, unitColour } from './content.js';

const W = 340;
const CELL = 38;
const ROW_H = 60;
const PER_ROW = 8;

const f1 = (n) => n.toFixed(1);

function leaf(x, y, len, angle) {
  // A pointed leaf drawn from its base at (x, y).
  const rad = (angle * Math.PI) / 180;
  const tx = x + Math.cos(rad) * len;
  const ty = y + Math.sin(rad) * len;
  const nx = -Math.sin(rad) * len * 0.38;
  const ny = Math.cos(rad) * len * 0.38;
  const mx = (x + tx) / 2;
  const my = (y + ty) / 2;
  return `<path class="leaf" d="M${f1(x)} ${f1(y)} Q${f1(mx + nx)} ${f1(my + ny)} ${f1(tx)} ${f1(ty)} Q${f1(mx - nx)} ${f1(my - ny)} ${f1(x)} ${f1(y)}Z"/>`;
}

function bloom(x, cy, r, colour) {
  let petals = '';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    petals += `<ellipse cx="${f1(x + Math.cos(a) * r)}" cy="${f1(cy + Math.sin(a) * r)}" rx="${f1(r * 0.95)}" ry="${f1(r * 0.62)}" transform="rotate(${f1((a * 180) / Math.PI)} ${f1(x + Math.cos(a) * r)} ${f1(cy + Math.sin(a) * r)})" fill="${colour}"/>`;
  }
  return `<g class="bloom">${petals}<circle class="centre" cx="${x}" cy="${f1(cy)}" r="${f1(r * 0.6)}"/></g>`;
}

function plant(stage, colour, x, y) {
  if (stage <= 0) {
    return `<circle class="seed" cx="${x - 4}" cy="${y - 1}" r="1.5"/><circle class="seed" cx="${x + 3}" cy="${y}" r="1.5"/><circle class="seed" cx="${x}" cy="${y - 2.5}" r="1.2"/>`;
  }
  if (stage === 1) {
    return `<path class="stem" d="M${x} ${y} q1 -6 0 -12"/>` + leaf(x, y - 11, 7, -150) + leaf(x, y - 11, 7, -30);
  }
  const h = stage === 2 ? 26 : 36;
  let s = `<path class="stem" d="M${x} ${y} q-3 ${-h / 2} 0 ${-h}"/>`;
  s += leaf(x - 1, y - 9, 11, -160) + leaf(x - 1, y - 15, 11, -20);
  if (stage === 2) return s + leaf(x, y - h + 2, 8, -120) + leaf(x, y - h + 2, 8, -60);
  s += leaf(x - 1, y - 24, 9, -150);
  if (stage === 3) {
    return s + `<path class="bud" d="M${x} ${y - h - 13} q6 7 0 13 q-6 -6 0 -13Z"/><path d="M${x} ${y - h - 13} q3 4 0 7 q-3 -3 0 -7Z" fill="${colour}"/>`;
  }
  s += bloom(x, y - h - 6, stage >= 5 ? 6.2 : 5.4, colour);
  if (stage >= 5) s += `<path class="stem" d="M${x} ${y - 20} q8 -4 9 -12"/>` + bloom(x + 9, y - 34, 3.8, colour);
  return s;
}

export function stageOf(level) {
  return Math.min(5, Math.max(0, level || 0));
}

/**
 * @param {object} phrases  review state map
 * @param {Set<string>} grown  keys to highlight (grew this session)
 */
export function gardenSvg(phrases, grown = new Set(), { units: given } = {}) {
  let units = (given || gardenUnits()).filter((u) => u.phrases.some((p) => !p.listenOnly));
  // Weekly beds appear once she has started them.
  units = units.filter((u) => !u.weekly || u.phrases.some((p) => phrases[keyOf(u.id, p.id)]));
  let y = 0;
  let body = '';
  let flowers = 0;
  let growing = 0;
  for (const u of units) {
    const speakable = u.phrases.filter((p) => !p.listenOnly);
    const rows = Math.ceil(speakable.length / PER_ROW);
    const colour = unitColour(u);
    const done = speakable.filter((p) => stageOf(phrases[keyOf(u.id, p.id)]?.level) >= 4).length;
    body += `<text class="bed-label" x="2" y="${y + 13}">${esc((u.titleLv || u.id).toUpperCase())}</text>`;
    body += `<text class="bed-count" x="${W - 2}" y="${y + 13}" text-anchor="end">${done} / ${speakable.length}</text>`;
    y += 22;
    const bedH = rows * ROW_H + 6;
    body += `<rect class="planter" x="0.5" y="${y}" width="${W - 1}" height="${bedH}" rx="12"/>`;
    speakable.forEach((p, i) => {
      const row = Math.floor(i / PER_ROW);
      const col = i % PER_ROW;
      const inRow = Math.min(PER_ROW, speakable.length - row * PER_ROW);
      const startX = (W - inRow * CELL) / 2 + CELL / 2;
      const x = Math.round(startX + col * CELL);
      const by = y + (row + 1) * ROW_H - 6;
      if (col === 0) body += `<line class="row-line" x1="14" x2="${W - 14}" y1="${by + 0.5}" y2="${by + 0.5}"/>`;
      const k = keyOf(u.id, p.id);
      const st = stageOf(phrases[k]?.level);
      if (st >= 4) flowers++;
      else if (st >= 1) growing++;
      const cls = grown.has(k) ? 'plant grew' : 'plant';
      body += `<g class="${cls}"><title>${esc(p.lv)}</title>${plant(st, colour, x, by)}</g>`;
    });
    y += bedH + 18;
  }
  const label = `Dārzs: ${flowers} ziedi, ${growing} augi aug`;
  return `<svg class="garden" viewBox="0 0 ${W} ${Math.max(1, y - 18)}" role="img" aria-label="${esc(label)}">${body}</svg>`;
}
