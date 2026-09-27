/* Scene composition: designed, coordinated placements instead of independent random spots.
   A foreground cut picks a composition (split, corner, inset, hero…) that fixes its own slot and the
   zone its lyrics should use; lyrics then choose aligned positions scored for that zone, the
   foreground overlap (avoidance strength), balance against the foreground, and margins. */
(() => {
'use strict';
// fg: centre and size range [min, max] (largest extent, stage fractions): the size contrast is part of
// the pattern (tiny insets, giant heroes) rather than a user setting. zone: where the lyrics sit.
// weight: [landscape, portrait].
J.COMPOSITIONS = [
  { id: 'left', fg: { x: .3, y: .5, size: [.44, .6] }, zone: { x: .54, y: .14, w: .42, h: .72 }, weight: [1, .35] },
  { id: 'right', fg: { x: .7, y: .5, size: [.44, .6] }, zone: { x: .04, y: .14, w: .42, h: .72 }, weight: [1, .35] },
  { id: 'top', fg: { x: .5, y: .31, size: [.4, .56] }, zone: { x: .1, y: .6, w: .8, h: .34 }, weight: [.6, 1] },
  { id: 'bottom', fg: { x: .5, y: .69, size: [.4, .56] }, zone: { x: .1, y: .06, w: .8, h: .34 }, weight: [.6, 1] },
  { id: 'cornerBL', fg: { x: .28, y: .66, size: [.34, .5] }, zone: { x: .46, y: .08, w: .5, h: .52 }, weight: [.8, .7] },
  { id: 'cornerBR', fg: { x: .72, y: .66, size: [.34, .5] }, zone: { x: .04, y: .08, w: .5, h: .52 }, weight: [.8, .7] },
  { id: 'cornerTL', fg: { x: .28, y: .34, size: [.34, .5] }, zone: { x: .46, y: .4, w: .5, h: .52 }, weight: [.8, .7] },
  { id: 'cornerTR', fg: { x: .72, y: .34, size: [.34, .5] }, zone: { x: .04, y: .4, w: .5, h: .52 }, weight: [.8, .7] },
  { id: 'insetTR', fg: { x: .8, y: .24, size: [.24, .32] }, zone: { x: .06, y: .26, w: .62, h: .6 }, weight: [.55, .5] },
  { id: 'insetBL', fg: { x: .2, y: .76, size: [.24, .32] }, zone: { x: .32, y: .14, w: .62, h: .6 }, weight: [.55, .5] },
  { id: 'hero', fg: { x: .5, y: .44, size: [.66, .8] }, zone: { x: .08, y: .74, w: .84, h: .22 }, weight: [.5, .6] },
  { id: 'heroTop', fg: { x: .5, y: .56, size: [.66, .8] }, zone: { x: .08, y: .04, w: .84, h: .22 }, weight: [.35, .5] },
  // Strong size contrast: a tiny accent against large lyrics, or a giant foreground with a small caption.
  { id: 'miniTL', fg: { x: .15, y: .2, size: [.14, .2] }, zone: { x: .2, y: .22, w: .74, h: .66 }, weight: [.45, .45] },
  { id: 'miniBR', fg: { x: .85, y: .8, size: [.14, .2] }, zone: { x: .06, y: .12, w: .74, h: .66 }, weight: [.45, .45] },
  { id: 'miniTR', fg: { x: .85, y: .2, size: [.14, .2] }, zone: { x: .06, y: .22, w: .74, h: .66 }, weight: [.35, .35] },
  { id: 'giantLeft', fg: { x: .4, y: .5, size: [.82, .92] }, zone: { x: .7, y: .6, w: .27, h: .34 }, weight: [.35, .2] },
  { id: 'giantRight', fg: { x: .6, y: .5, size: [.82, .92] }, zone: { x: .03, y: .06, w: .27, h: .34 }, weight: [.35, .2] },
  // Thirds with a mid-size subject and a narrow lyric column.
  { id: 'thirdLeft', fg: { x: .36, y: .46, size: [.5, .64] }, zone: { x: .69, y: .2, w: .28, h: .62 }, weight: [.6, .3] },
  { id: 'thirdRight', fg: { x: .64, y: .54, size: [.5, .64] }, zone: { x: .03, y: .18, w: .28, h: .62 }, weight: [.6, .3] },
  { id: 'centerSmall', fg: { x: .5, y: .5, size: [.22, .3] }, zone: { x: .08, y: .68, w: .84, h: .28 }, weight: [.4, .5] },
];
// Only for scenes with an emphasised lyric (*…*): a large foreground with a large lyric laid over it.
J.EMPHASIS_COMPOSITION = { id: 'bothLarge', fg: { x: .5, y: .5, size: [.72, .88] }, zone: { x: .04, y: .1, w: .92, h: .8 }, weight: [0, 0] };
J.COMPOSITION_BY_ID = Object.fromEntries([...J.COMPOSITIONS, J.EMPHASIS_COMPOSITION].map(c => [c.id, c]));
// Lyric-only scenes: aligned zones; size gives the chance of small / medium / large lyric areas there.
J.SOLO_ZONES = [
  { id: 'center', zone: { x: .1, y: .2, w: .8, h: .6 }, weight: 3, size: [.2, .45, .35] },
  { id: 'lower', zone: { x: .08, y: .56, w: .84, h: .38 }, weight: 1.4, size: [.35, .5, .15] },
  { id: 'upper', zone: { x: .08, y: .06, w: .84, h: .38 }, weight: .9, size: [.35, .5, .15] },
  { id: 'left', zone: { x: .05, y: .14, w: .56, h: .72 }, weight: 1, size: [.3, .5, .2] },
  { id: 'right', zone: { x: .39, y: .14, w: .56, h: .72 }, weight: 1, size: [.3, .5, .2] },
  { id: 'lowerLeft', zone: { x: .05, y: .5, w: .5, h: .44 }, weight: .7, size: [.6, .4, 0] },
  { id: 'upperRight', zone: { x: .45, y: .06, w: .5, h: .44 }, weight: .7, size: [.6, .4, 0] },
  { id: 'band', zone: { x: .04, y: .36, w: .92, h: .28 }, weight: .8, size: [.2, .5, .3] },
  { id: 'column', zone: { x: .34, y: .06, w: .32, h: .88 }, weight: .6, size: [.3, .5, .2] },
  { id: 'full', zone: { x: .04, y: .06, w: .92, h: .88 }, weight: .8, size: [0, .3, .7] },
];
// Lyric size classes (multipliers of the base lyric area) replace the old manual size range.
// Emphasis (*…*) takes the wide central zones; suppression (~…~) keeps to the edges and corners.
const EMPHASIS_ZONES = { center: 6, full: 3, band: 1.5 }, SUPPRESSED_ZONES = { lower: 1.4, upper: .9, lowerLeft: 1.2, upperRight: 1.2, left: .5, right: .5 };
J.pickSoloZone = cut => J.rng(J.h(J.placementSeed(cut), 893)).wpick(J.SOLO_ZONES.map(z => [z, cut.emphasis ? EMPHASIS_ZONES[z.id] || 0 : cut.suppressed ? SUPPRESSED_ZONES[z.id] || 0 : z.weight]));
J.LYRIC_SIZE_CLASSES = { small: [.58, .76], medium: [.86, 1.04], large: [1.14, 1.36] };
J.lyricSizeScale = (cut, rng, weights = [.3, .45, .25]) => {
  const w = cut.emphasis ? [0, .25, .75] : cut.suppressed ? [.8, .2, 0] : weights;
  const kind = rng.wpick([['small', w[0]], ['medium', w[1]], ['large', w[2]]].filter(e => e[1] > 0));
  return rng.range(...J.LYRIC_SIZE_CLASSES[kind]);
};
// Background framing patterns. zoom is relative to filling the stage (0 = the whole source, letterboxed);
// ax / ay anchor the crop (0 = left/top edge, .5 = centre, 1 = right/bottom edge; null = random).
J.BACKGROUND_PATTERNS = [
  { id: 'whole', zoom: [0, 0], ax: .5, ay: .5, weight: .9 },
  { id: 'fill', zoom: [1, 1.06], ax: .5, ay: .5, weight: 1.2 },
  { id: 'zoomCenter', zoom: [1.18, 1.38], ax: .5, ay: .5, weight: 1 },
  { id: 'focusLeft', zoom: [1.22, 1.5], ax: 0, ay: .5, weight: .8 },
  { id: 'focusRight', zoom: [1.22, 1.5], ax: 1, ay: .5, weight: .8 },
  { id: 'focusTop', zoom: [1.22, 1.5], ax: .5, ay: 0, weight: .7 },
  { id: 'focusBottom', zoom: [1.22, 1.5], ax: .5, ay: 1, weight: .7 },
  { id: 'cornerTL', zoom: [1.3, 1.6], ax: 0, ay: 0, weight: .5 },
  { id: 'cornerBR', zoom: [1.3, 1.6], ax: 1, ay: 1, weight: .5 },
  { id: 'detail', zoom: [1.7, 2.1], ax: null, ay: null, weight: .45 },
  { id: 'thirds', zoom: [1.12, 1.3], ax: null, ay: .5, weight: .7 },
];
// fit: the source fitted to the stage (stage fractions). Never smaller than the whole source, never an
// exposed edge on an enlarged axis, never cropped on a smaller one.
J.backgroundPlacement = (cut, plan, fit) => {
  const memo = plan && typeof plan === 'object' ? (lastPick.get(plan) || (lastPick.set(plan, {}), lastPick.get(plan))) : {};
  const last = memo.background?.index === cut.index - 1 ? memo.background : null;
  const pick = (seed, avoid) => J.rng(J.h(seed, 877)).wpick(J.BACKGROUND_PATTERNS.filter(p => p.id !== avoid).map(p => [p, p.weight]));
  const base = pick(cut.seed, last?.baseId), pattern = Number.isFinite(cut.placementSeed) ? pick(J.placementSeed(cut), last?.id) : base;
  memo.background = { index: cut.index, id: pattern.id, baseId: base.id };
  const rng = J.rng(J.h(J.placementSeed(cut), 879)), fill = Math.max(1 / fit.w, 1 / fit.h);
  // mediaPlacementRect caps a side at 4x the stage, so stay under it or the rect shrinks and exposes an edge.
  const scale = pattern.zoom[1] <= 0 ? 1 : Math.max(1, Math.min(fill * rng.range(...pattern.zoom), 4 / Math.max(fit.w, fit.h)));
  const w = fit.w * scale, h = fit.h * scale;
  const anchor = a => a == null ? rng.pick([.2, .35, .5, .65, .8]) : a;
  const at = (a, extent) => extent >= 1 ? .5 + (a - .5) * (extent - 1) : .5;
  cut.composition = pattern.id;
  return { cx: at(anchor(pattern.ax), w), cy: at(anchor(pattern.ay), h), w, h, lockAspect: true, angle: 0 };
};// A per-cut placement seed (set by 再配置) re-rolls placement only; techniques keep using cut.seed.
J.placementSeed = cut => Number.isFinite(cut?.placementSeed) ? J.h(cut.seed, cut.placementSeed | 0, 887) : cut.seed;
const lastPick = new WeakMap();
// Deterministic per cut seed; avoids repeating the previous cut's composition in the same plan and layer.
// The chain runs on each cut's own seed ("base"), so re-laying out one cut (placement seed) never
// changes its neighbours; that cut alone re-picks, avoiding the previous cut's actual composition.
J.pickComposition = (cut, plan, layer = 'foreground') => {
  const portrait = (plan?.W || 1920) < (plan?.H || 1080);
  const memo = plan && typeof plan === 'object' ? (lastPick.get(plan) || (lastPick.set(plan, {}), lastPick.get(plan))) : {};
  const last = memo[layer]?.index === cut.index - 1 ? memo[layer] : null;
  const pick = (seed, avoid) => J.rng(J.h(seed, 881)).wpick(J.COMPOSITIONS.filter(c => c.id !== avoid).map(c => [c, c.weight[portrait ? 1 : 0]]));
  const base = pick(cut.seed, last?.baseId);
  let comp = Number.isFinite(cut.placementSeed) ? pick(J.placementSeed(cut), last?.id) : base;
  // A foreground shown with an emphasised lyric sometimes goes large together with it.
  const emphasised = layer === 'foreground' && plan?.cuts?.some(c => c.emphasis && c.line >= 0 && c.start < cut.end && c.end > cut.start);
  if (emphasised && last?.id !== J.EMPHASIS_COMPOSITION.id && J.rng(J.h(J.placementSeed(cut), 885))() < .4) comp = J.EMPHASIS_COMPOSITION;
  memo[layer] = { index: cut.index, id: comp.id, baseId: base.id };
  return comp;
};
// Placement for a foreground source of fitted size fit (stage fractions) in a composition's slot.
J.compositionPlacement = (comp, cut, fit, dynamic) => {
  const rng = J.rng(J.h(J.placementSeed(cut), 883));
  let extent = rng.range(...comp.fg.size) * (dynamic ? .85 : 1);
  let s = extent / Math.max(fit.w, fit.h), w = fit.w * s, h = fit.h * s;
  // Keep the base frame inside the safe area (motion may still move it).
  const k = Math.min(1, .95 / w, .95 / h); w *= k; h *= k;
  const inside = (c, e) => J.clamp(c, e / 2 + .026, .974 - e / 2);// just inside the .025 safe edge
  return { cx: inside(comp.fg.x + rng.range(-.02, .02), w), cy: inside(comp.fg.y + rng.range(-.02, .02), h), w, h, lockAspect: true, angle: 0 };
};

// Several lyrics on screen with no foreground: a designed arrangement (cascade, zigzag, hero, columns,
// scatter, wave, stack) with size rhythm, instead of a uniform grid.
// slot(i, n, t) -> [cx, cy, relative scale]; cell(n) -> the arrangement's base area [w, h] per lyric,
// sized so the pattern uses the stage well (layouts re-plan for the area's proportions).
const span = .84; // usable stage extent between the margins
J.LYRIC_ARRANGEMENTS = {
  diagonalDown: { slot: (i, n, t) => [.3 + .4 * t, .1 + span * (i + .5) / n, 1], cell: n => [.52, span / n] },
  diagonalUp: { slot: (i, n, t) => [.3 + .4 * t, .9 - span * (i + .5) / n, 1], cell: n => [.52, span / n] },
  zigzag: { slot: (i, n) => [i % 2 ? .7 : .3, .1 + span * (i + 1) / (n + 1), i % 2 ? .92 : 1], cell: n => [.46, Math.min(.5, 2 * span / (n + 1))] },
  cascade: { slot: (i, n, t) => [.36 + .28 * t, .1 + span * (i + .5) / n, 1 - .1 * t], cell: n => [.6, span / n] },
  heroFirst: { slot: (i, n) => i === 0 ? [.5, .3, 1] : [.08 + .84 * (i - .5) / (n - 1), .76, 1], cell: n => [.84, .4], small: n => [.84 / (n - 1), .26] },
  heroLast: { slot: (i, n) => i === n - 1 ? [.5, .68, 1] : [.08 + .84 * (i + .5) / (n - 1), .24, 1], cell: n => [.84, .4], small: n => [.84 / (n - 1), .26], hero: n => n - 1 },
  columns: { slot: (i, n) => { const rows = Math.ceil(n / 2), row = Math.floor(i / 2), col = i % 2; return [col ? .72 : .28, .1 + span * (row + .5 + col * .35) / (rows + .35), 1]; }, cell: n => [.44, span / (Math.ceil(n / 2) + .35)] },
  scatter: { slot: (i, n) => [.25 + .5 * ((.5 + i * .618034) % 1), .1 + span * (i + .5) / n, 1 - .2 * ((i * .381966) % 1)], cell: n => [.46, Math.min(.5, 1.5 * span / n)] },
  wave: { slot: (i, n, t) => [.08 + .84 * (i + .5) / n, .5 + .22 * Math.sin(t * Math.PI * 1.6 - .8), i % 2 ? .88 : 1], cell: n => [.84 / n, .42] },
  stack: { slot: (i, n) => [.5, .1 + span * (i + .5) / n, i % 2 ? .84 : 1], cell: n => [.72, span / n] },
  cascadeRight: { slot: (i, n, t) => [.64 - .28 * t, .1 + span * (i + .5) / n, 1 - .1 * t], cell: n => [.6, span / n] },
  pyramid: { slot: (i, n) => { const p = pyramidRows(n); let row = 0, idx = i; while (idx >= p.sizes[row]) idx -= p.sizes[row++]; const c = p.sizes[row]; return [.5 + (idx - (c - 1) / 2) * (.84 / p.widest), .1 + span * (row + .5) / p.sizes.length, row ? .9 : 1.05]; },
    cell: n => { const p = pyramidRows(n); return [.84 / p.widest * .96, span / p.sizes.length]; } },
  splitHero: { slot: (i, n) => i === 0 ? [.29, .5, 1] : [.76, .1 + span * (i - .5) / (n - 1), 1], cell: n => [.5, .72], small: n => [.4, span / Math.max(1, n - 1)] },
  radial: { slot: (i, n) => { const a = -Math.PI / 2 + i * Math.PI * 2 / n; return [.5 + .3 * Math.cos(a), .5 + .31 * Math.sin(a), i === 0 ? 1.1 : 1]; }, cell: n => [Math.min(.42, 1.6 / n), Math.min(.3, 1.1 / n)] },
  bigSmall: { slot: (i, n, t) => [.3 + .4 * t, .1 + span * (i + .5) / n, i % 2 ? .62 : 1.12], cell: n => [.5, Math.min(.44, 1.25 * span / n)] },
  frame: { slot: i => [[.26, .22], [.74, .22], [.74, .78], [.26, .78], [.5, .5], [.5, .16], [.5, .84], [.14, .5], [.86, .5]][i % 9].concat(i === 4 ? 1.1 : 1), cell: n => n <= 4 ? [.44, .36] : [.3, .24] },
};
// Rows of 1, 2, 3… for the pyramid; the last row takes what is left.
function pyramidRows(n) { const sizes = []; let left = n; for (let k = 1; left > 0; k++) { sizes.push(Math.min(k, left)); left -= k; } return { sizes, widest: Math.max(...sizes) }; }
// Returns target areas, or null when the chosen arrangement cannot fit.
// maxOverlap: allowed share of the smaller area (0 = none, with a small gap).
J.arrangeLyricGroup = (cuts, boxes, { seed, maxOverlap = 0 } = {}) => {
  const n = cuts.length, names = Object.keys(J.LYRIC_ARRANGEMENTS), rng = J.rng(J.h(seed, 991));
  const name = names[Math.floor(rng() * names.length)], A = J.LYRIC_ARRANGEMENTS[name], margin = .03, gap = maxOverlap ? 0 : .012;
  const heroIndex = A.hero ? A.hero(n) : 0;
  const layout = s => cuts.map((_, i) => {
    const [cx, cy, k] = A.slot(i, n, n > 1 ? i / (n - 1) : .5), [bw, bh] = A.small && i !== heroIndex ? A.small(n) : A.cell(n);
    const strength = cuts[i].emphasis ? 1.45 : cuts[i].suppressed ? .6 : 1;
    const w = Math.min(bw * k * s * strength, 1 - 2 * margin), h = Math.min(bh * k * s * strength, 1 - 2 * margin);
    const x = J.clamp(cx - w / 2, margin, 1 - margin - w), y = J.clamp(cy - h / 2, margin, 1 - margin - h);
    return { x, y, w, h };
  });
  const fits = rects => rects.every((a, i) => rects.slice(i + 1).every(b => {
    const grown = r => ({ x: r.x - gap / 2, y: r.y - gap / 2, w: r.w + gap, h: r.h + gap });
    return overlap(grown(a), grown(b)) <= maxOverlap * Math.min(a.w * a.h, b.w * b.h) + 1e-12;
  }));
  // Largest uniform scale (up to the current size) at which the arrangement fits.
  let lo = .12, hi = 1;
  if (!fits(layout(lo))) return null;
  if (fits(layout(hi))) lo = hi; else for (let k = 0; k < 22; k++) { const mid = (lo + hi) / 2; if (fits(layout(mid))) lo = mid; else hi = mid; }
  return { name, rects: layout(lo), scale: lo };
};
const overlap = (a, b) =>Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
// Aligned lyric position for a w × h area: thirds, centre and margin-flush anchors, scored.
// Overlapping an obstacle is avoided whenever any candidate can; returns null when none can (the caller
// then falls back to searching free regions).
J.composeLyricArea = (cut, { w, h, obstacles = [], zone = null, fgCenter = null, fixedSize = false }) => {
  const rng = J.rng(J.h(J.placementSeed(cut), 889)), margin = .03, anchors = [1 / 3, .5, 2 / 3];
  if (!zone && !obstacles.length) zone = J.pickSoloZone(cut).zone;
  let best = null;
  for (const k of fixedSize ? [1] : [1, .86, .72, .6, .5, .4]) {
    const cw = Math.max(.04, w * k), ch = Math.max(.04, h * k);
    const xs = new Set([...anchors, cw / 2 + margin, 1 - cw / 2 - margin, ...(zone ? [zone.x + cw / 2, zone.x + zone.w / 2, zone.x + zone.w - cw / 2] : [])]);
    const ys = new Set([...anchors, .72, .28, ch / 2 + margin, 1 - ch / 2 - margin, ...(zone ? [zone.y + ch / 2, zone.y + zone.h / 2, zone.y + zone.h - ch / 2] : [])]);
    for (const cx of xs) for (const cy of ys) {
      const x = J.clamp(cx - cw / 2, cw >= 1 - 2 * margin ? (1 - cw) / 2 : margin, cw >= 1 - 2 * margin ? (1 - cw) / 2 : 1 - margin - cw);
      const y = J.clamp(cy - ch / 2, ch >= 1 - 2 * margin ? (1 - ch) / 2 : margin, ch >= 1 - 2 * margin ? (1 - ch) / 2 : 1 - margin - ch);
      const r = { x, y, w: cw, h: ch }, area = cw * ch, covered = obstacles.reduce((sum, b) => sum + overlap(r, b), 0) / area;
      let score = 6 * covered;
      if (zone) score += 2 * (1 - overlap(r, zone) / area);
      if (fgCenter) score -= .8 * Math.hypot(x + cw / 2 - fgCenter.x, y + ch / 2 - fgCenter.y);
      // Prefer the thirds grid; smaller areas cost a little.
      score += .25 * Math.min(...anchors.map(a => Math.abs(x + cw / 2 - a))) + .25 * Math.min(...[...anchors, .72, .28].map(a => Math.abs(y + ch / 2 - a)));
      score += (1 - k) * 1.6 + rng() * .35;
      const clear = covered <= 1e-9;
      if (!best || clear && !best.clear || clear === best.clear && score < best.score) best = { score, r, clear };
    }
  }
  if (obstacles.length && !best.clear) return null;
  return { ...best.r, angle: 0, lockAspect: true };
};
})();
