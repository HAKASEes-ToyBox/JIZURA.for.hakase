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
// Sources with cropped edges (見切れ辺) bleed off those stage edges, so their compositions are built around
// the edges: the lyric zone sits on the free side. Written for the left edge / the bottom-left corner
// and mirrored; opposite edges span the stage as a band (or fill it). The cropped axes are anchored to
// the stage edge by autoMediaPlacement, so fg.x / fg.y matter only on free axes.
const SINGLE_EDGE = [// left edge
  { id: 'mid', fg: { x: .3, y: .5, size: [.5, .66] }, zone: { x: .52, y: .14, w: .44, h: .72 }, weight: 1.4 },
  { id: 'high', fg: { x: .26, y: .32, size: [.36, .5] }, zone: { x: .44, y: .4, w: .52, h: .52 }, weight: 1 },
  { id: 'low', fg: { x: .26, y: .68, size: [.36, .5] }, zone: { x: .44, y: .08, w: .52, h: .52 }, weight: 1 },
  { id: 'giant', fg: { x: .4, y: .5, size: [.78, .9] }, zone: { x: .68, y: .56, w: .29, h: .38 }, weight: .6 },
  { id: 'peek', fg: { x: .12, y: .5, size: [.2, .28] }, zone: { x: .26, y: .14, w: .7, h: .72 }, weight: .7 },
];
const CORNER = [// bottom-left corner
  { id: 'corner', fg: { x: .26, y: .7, size: [.4, .54] }, zone: { x: .44, y: .06, w: .52, h: .52 }, weight: 1.4 },
  { id: 'big', fg: { x: .34, y: .64, size: [.64, .78] }, zone: { x: .64, y: .06, w: .33, h: .38 }, weight: .8 },
  { id: 'peek', fg: { x: .12, y: .86, size: [.2, .28] }, zone: { x: .24, y: .1, w: .7, h: .62 }, weight: .7 },
];
const BAND = [// left + right: a horizontal band across the stage
  { id: 'bandLow', fg: { x: .5, y: .72, size: [.5, .7] }, zone: { x: .08, y: .06, w: .84, h: .38 }, weight: 1.2 },
  { id: 'bandHigh', fg: { x: .5, y: .28, size: [.5, .7] }, zone: { x: .08, y: .56, w: .84, h: .38 }, weight: 1 },
];
const mirrorX = r => r && { ...r, x: 1 - r.x - (r.w || 0) }, mirrorY = r => r && { ...r, y: 1 - r.y - (r.h || 0) };
const swap = r => r && { ...r, x: r.y, y: r.x, ...(r.w != null ? { w: r.h, h: r.w } : {}) };
const transform = (list, f) => list.map(c => ({ ...c, fg: { ...f({ x: c.fg.x, y: c.fg.y }), size: c.fg.size }, zone: f(c.zone) }));
const croppedCache = new Map();
J.croppedCompositions = edges => {
  const e = ['left', 'right', 'top', 'bottom'].filter(k => edges?.[k] === true);
  if (!e.length) return null;
  const key = e.join('+');
  if (croppedCache.has(key)) return croppedCache.get(key);
  const has = k => e.includes(k), h = has('left') && has('right'), v = has('top') && has('bottom');
  let list;
  if (h && v) list = [{ id: 'fill', fg: { x: .5, y: .5, size: [.9, .9] }, zone: { x: .1, y: .2, w: .8, h: .6 }, weight: 1 }];
  else if (h) list = has('top') ? BAND.slice(1, 2) : has('bottom') ? BAND.slice(0, 1) : BAND;
  else if (v) list = transform(BAND, r => swap(r)).map(c => has('left') ? c : has('right') ? transform([c], mirrorX)[0] : c)
    .filter(c => has('left') ? c.fg.x < .5 : has('right') ? c.fg.x > .5 : true);
  else if (e.length === 2) list = transform(CORNER, r => { r = has('right') ? mirrorX(r) : r; return has('top') ? mirrorY(r) : r; });
  else list = transform(SINGLE_EDGE, r => has('left') ? r : has('right') ? mirrorX(r) : has('top') ? swap(r) : mirrorY(swap(r)));
  list = list.map(c => ({ ...c, id: 'crop:' + key + ':' + c.id, weight: [c.weight, c.weight], cropped: key }));
  for (const c of list) J.COMPOSITION_BY_ID[c.id] = c;
  croppedCache.set(key, list);
  return list;
};
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
// 「画面中央を避ける」: the middle of the stage that automatic lyric areas keep clear (not for *emphasis*).
J.CENTER_AVOID = { x: .32, y: .3, w: .36, h: .4 };
// Zones filling the strips around it (the lyric area is fitted to the strip rather than shrunk).
J.CENTER_FREE_ZONES = [
  { id: 'top', zone: { x: .04, y: .035, w: .92, h: .245 }, weight: 1, size: [.2, .5, .3] },
  { id: 'bottom', zone: { x: .04, y: .72, w: .92, h: .245 }, weight: 1.6, size: [.2, .5, .3] },
  { id: 'left', zone: { x: .03, y: .06, w: .27, h: .88 }, weight: .8, size: [.3, .5, .2] },
  { id: 'right', zone: { x: .7, y: .06, w: .27, h: .88 }, weight: .8, size: [.3, .5, .2] },
  { id: 'topLeft', zone: { x: .03, y: .035, w: .46, h: .245 }, weight: .5, size: [.5, .5, 0] },
  { id: 'bottomRight', zone: { x: .51, y: .72, w: .46, h: .245 }, weight: .5, size: [.5, .5, 0] },
];
J.pickSoloZone = (cut, { avoidCenter = false } = {}) => {
  const rng = J.rng(J.h(J.placementSeed(cut), 893));
  if (avoidCenter && !cut.emphasis) return rng.wpick(J.CENTER_FREE_ZONES.map(z => [z, cut.suppressed && /^(top|bottom)$/.test(z.id) ? z.weight * .5 : z.weight]));
  return rng.wpick(J.SOLO_ZONES.map(z => [z, cut.emphasis ? EMPHASIS_ZONES[z.id] || 0 : cut.suppressed ? SUPPRESSED_ZONES[z.id] || 0 : z.weight]));
};
J.LYRIC_SIZE_CLASSES = { small: [.58, .76], medium: [.86, 1.04], large: [1.14, 1.36] };
J.lyricSizeScale = (cut, rng, weights = [.3, .45, .25]) => {
  const w = cut.emphasis ? [0, .25, .75] : cut.suppressed ? [.5, .5, 0] : weights;
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
J.pickComposition = (cut, plan, layer = 'foreground', edges = null) => {
  const portrait = (plan?.W || 1920) < (plan?.H || 1080);
  const memo = plan && typeof plan === 'object' ? (lastPick.get(plan) || (lastPick.set(plan, {}), lastPick.get(plan))) : {};
  const last = memo[layer]?.index === cut.index - 1 ? memo[layer] : null;
  const pool = J.croppedCompositions(edges) || J.COMPOSITIONS;
  const pick = (seed, avoid) => { const list = pool.filter(c => c.id !== avoid); return J.rng(J.h(seed, 881)).wpick((list.length ? list : pool).map(c => [c, c.weight[portrait ? 1 : 0]])); };
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
// avoid: an area (the stage centre) that cuts other than *emphasis* must stay out of. Arrangements are
// tried in a seeded order; if none keeps it clear as designed, slots inside it are pushed to its edges.
J.arrangeLyricGroup = (cuts, boxes, { seed, maxOverlap = 0, avoid = null } = {}) => {
  const n = cuts.length, names = Object.keys(J.LYRIC_ARRANGEMENTS), rng = J.rng(J.h(seed, 991));
  const first = Math.floor(rng() * names.length);
  if (!avoid) return arrangeWith(cuts, names[first], maxOverlap, null, false);
  // Every arrangement (as designed, or with its central slots pushed out) is scored by the size it keeps;
  // one of those within 70% of the best is picked, so the lyrics do not shrink just to clear the centre.
  const results = [];
  for (const [name, A] of Object.entries(J.CENTER_FREE_ARRANGEMENTS)) { const result = arrangeWith(cuts, name, maxOverlap, avoid, false, A); if (result) results.push(result); }
  for (const name of names) for (const pushed of [false, true]) {
    const result = arrangeWith(cuts, name, maxOverlap, avoid, pushed);
    if (result) { results.push(result); break; }
  }
  if (!results.length) return null;
  const best = Math.max(...results.map(r => r.scale));
  const good = results.filter(r => r.scale >= best * .7);
  return good[(first + Math.floor(rng() * good.length)) % good.length];
};
const pushOut = (cx, cy, box, pad = .03) => {
  if (cx <= box.x || cx >= box.x + box.w || cy <= box.y || cy >= box.y + box.h) return [cx, cy];
  const moves = [[box.x - pad - cx, 0], [box.x + box.w + pad - cx, 0], [0, box.y - pad - cy], [0, box.y + box.h + pad - cy]];
  const [dx, dy] = moves.reduce((a, b) => Math.hypot(...b) < Math.hypot(...a) ? b : a);
  return [cx + dx, cy + dy];
};
// Arrangements around a kept-clear centre: cells live in the strips (top / bottom bands, side columns).
const bandSlot = (band, j, m) => [.05 + (j + .5) * .9 / m, band ? .845 : .155, 1];
const columnSlot = (side, j, m) => [side ? .835 : .165, .06 + (j + .5) * .88 / m, 1];
J.CENTER_FREE_ARRANGEMENTS = {
  bands: { slot: (i, n) => bandSlot(i % 2, i >> 1, i % 2 ? n >> 1 : (n + 1) >> 1), cell: n => [.86 / Math.max(1, (n + 1) >> 1), .22] },
  sides: { slot: (i, n) => columnSlot(i % 2, i >> 1, i % 2 ? n >> 1 : (n + 1) >> 1), cell: n => [.25, .84 / Math.max(1, (n + 1) >> 1)] },
  corners: { slot: i => [[.22, .155, 1], [.78, .845, 1], [.78, .155, 1], [.22, .845, 1]][i % 4], cell: () => [.4, .22] },
  topRow: { slot: (i, n) => bandSlot(0, i, n), cell: n => [.86 / n, .22] },
  bottomRow: { slot: (i, n) => bandSlot(1, i, n), cell: n => [.86 / n, .22] },
  lShape: { slot: (i, n) => { const m = (n + 1) >> 1; return i < m ? [.05 + (i + .5) * .62 / m, .845, 1] : columnSlot(1, n - 1 - i, n - m + 1); },
    cell: n => [.6 / Math.max(1, (n + 1) >> 1), .22] },
};
const arrangeWith = (cuts, name, maxOverlap, avoid, pushed, A = J.LYRIC_ARRANGEMENTS[name]) => {
  const n = cuts.length, margin = .03, gap = maxOverlap ? 0 : .012;
  const heroIndex = A.hero ? A.hero(n) : 0;
  const layout = s => cuts.map((_, i) => {
    let [cx, cy, k] = A.slot(i, n, n > 1 ? i / (n - 1) : .5), [bw, bh] = A.small && i !== heroIndex ? A.small(n) : A.cell(n);
    if (pushed && avoid && !cuts[i].emphasis) [cx, cy] = pushOut(cx, cy, avoid);
    const strength = cuts[i].emphasis ? 1.45 : cuts[i].suppressed ? .75 : 1;
    const w = Math.min(bw * k * s * strength, 1 - 2 * margin), h = Math.min(bh * k * s * strength, 1 - 2 * margin);
    const x = J.clamp(cx - w / 2, margin, 1 - margin - w), y = J.clamp(cy - h / 2, margin, 1 - margin - h);
    return { x, y, w, h };
  });
  const fits = rects => rects.every((a, i) => (!avoid || cuts[i].emphasis || overlap(a, avoid) <= 1e-9) && rects.slice(i + 1).every(b => {
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
J.composeLyricArea = (cut, { w, h, obstacles = [], zone = null, fgCenter = null, fixedSize = false, minSize = null }) => {
  const rng = J.rng(J.h(J.placementSeed(cut), 889)), margin = .03, anchors = [1 / 3, .5, 2 / 3];
  if (!zone && !obstacles.length) zone = J.pickSoloZone(cut).zone;
  let best = null;
  // minSize: the smallest area this lyric may shrink to (keeps suppressed lyrics readable).
  for (const k of fixedSize ? [1] : [1, .86, .72, .6, .5, .4].filter(k => k === 1 || !minSize || w * k >= minSize.w && h * k >= minSize.h)) {
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
