// The garden drawing: one bed per unit, one plant per speakable phrase.
// Stage follows level: 0 bare soil, 1 sprout, 2 leaves, 3 bud, 4–5 flower.
import { esc } from './util.js';
import { gardenUnits, keyOf, unitColour } from './content.js';

const W = 340;
const CELL = 40;
const ROW_H = 58;
const PER_ROW = 8;

function leaf(x, y, rx, ry, angle) {
  return `<ellipse class="leaf" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${angle} ${x} ${y})"/>`;
}

function plant(stage, colour, x, y) {
  const soil = '';
  if (stage <= 0) {
    return soil + `<circle class="seed" cx="${x - 4}" cy="${y - 1}" r="1.3"/><circle class="seed" cx="${x + 3}" cy="${y}" r="1.3"/>`;
  }
  if (stage === 1) {
    return soil + `<path class="stem" d="M${x} ${y} V${y - 11}"/>` + leaf(x - 4, y - 11, 4.5, 2.2, -30) + leaf(x + 4, y - 11, 4.5, 2.2, 30);
  }
  const h = stage === 2 ? 26 : 36;
  let s = soil + `<path class="stem" d="M${x} ${y} V${y - h}"/>`;
  s += leaf(x - 6, y - 10, 7, 3, -25) + leaf(x + 6, y - 15, 7, 3, 25);
  if (stage === 2) return s + leaf(x - 5, y - 22, 6, 2.6, -30);
  if (stage === 3) {
    return s + `<ellipse class="bud" cx="${x}" cy="${y - h - 4}" rx="4.2" ry="6"/><ellipse cx="${x}" cy="${y - h - 8}" rx="2.4" ry="3" fill="${colour}"/>`;
  }
  const r = stage >= 5 ? 6.5 : 5.5;
  const cy = y - h - 7;
  let petals = '';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    petals += `<circle cx="${(x + Math.cos(a) * r * 1.15).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 1.15).toFixed(1)}" r="${r}" fill="${colour}"/>`;
  }
  return s + petals + `<circle class="centre" cx="${x}" cy="${cy}" r="${r * 0.65}"/>`;
}

export function stageOf(level) {
  return Math.min(4, Math.max(0, level || 0));
}

/**
 * @param {object} phrases  review state map
 * @param {Set<string>} grown  keys to highlight (grew this session)
 */
export function gardenSvg(phrases, grown = new Set(), { onlyStarted = false, units: given } = {}) {
  let units = (given || gardenUnits()).filter((u) => u.phrases.some((p) => !p.listenOnly));
  if (onlyStarted) units = units.filter((u) => u.phrases.some((p) => phrases[keyOf(u.id, p.id)]));
  // Weekly beds appear once she has started them.
  units = units.filter((u) => !u.weekly || u.phrases.some((p) => phrases[keyOf(u.id, p.id)]));
  let y = 6;
  let body = '';
  let flowers = 0;
  let growing = 0;
  for (const u of units) {
    const speakable = u.phrases.filter((p) => !p.listenOnly);
    const rows = Math.ceil(speakable.length / PER_ROW);
    const colour = unitColour(u);
    body += `<text class="bed-label" x="8" y="${y + 16}">${esc(u.pic || '')} ${esc(u.titleLv || u.id)}</text>`;
    y += 26;
    const bedH = rows * ROW_H + 8;
    body += `<rect class="bed" x="4" y="${y}" width="${W - 8}" height="${bedH}" rx="14"/>`;
    speakable.forEach((p, i) => {
      const row = Math.floor(i / PER_ROW);
      const col = i % PER_ROW;
      const inRow = Math.min(PER_ROW, speakable.length - row * PER_ROW);
      const startX = (W - inRow * CELL) / 2 + CELL / 2;
      const x = Math.round(startX + col * CELL);
      const by = y + (row + 1) * ROW_H - 4;
      const k = keyOf(u.id, p.id);
      const st = stageOf(phrases[k]?.level);
      if (st >= 4) flowers++;
      else if (st >= 1) growing++;
      const cls = grown.has(k) ? 'plant grew' : 'plant';
      body += `<ellipse class="soil" cx="${x}" cy="${by}" rx="13" ry="4.5"/><g class="${cls}"><title>${esc(p.lv)}</title>${plant(st, colour, x, by)}</g>`;
    });
    y += bedH + 12;
  }
  const label = `Dārzs: ${flowers} ziedi, ${growing} augi aug`;
  return `<svg class="garden" viewBox="0 0 ${W} ${y}" role="img" aria-label="${esc(label)}">${body}</svg>`;
}
