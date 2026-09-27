/* Scene composition: designed, coordinated placements instead of independent random spots.
   A foreground cut picks a composition (split, corner, inset, hero…) that fixes its own slot and the
   zone its lyrics should use; lyrics then choose aligned positions scored for that zone, the
   foreground overlap (avoidance strength), balance against the foreground, and margins. */
(() => {
'use strict';
// fg: centre and size (largest extent, stage fractions, before the size-scale setting).
// zone: where lyrics sit in that composition. weight: [landscape, portrait].
J.COMPOSITIONS = [
  { id: 'left', fg: { x: .3, y: .5, size: .52 }, zone: { x: .54, y: .14, w: .42, h: .72 }, weight: [1, .35] },
  { id: 'right', fg: { x: .7, y: .5, size: .52 }, zone: { x: .04, y: .14, w: .42, h: .72 }, weight: [1, .35] },
  { id: 'top', fg: { x: .5, y: .31, size: .48 }, zone: { x: .1, y: .6, w: .8, h: .34 }, weight: [.6, 1] },
  { id: 'bottom', fg: { x: .5, y: .69, size: .48 }, zone: { x: .1, y: .06, w: .8, h: .34 }, weight: [.6, 1] },
  { id: 'cornerBL', fg: { x: .28, y: .66, size: .42 }, zone: { x: .46, y: .08, w: .5, h: .52 }, weight: [.8, .7] },
  { id: 'cornerBR', fg: { x: .72, y: .66, size: .42 }, zone: { x: .04, y: .08, w: .5, h: .52 }, weight: [.8, .7] },
  { id: 'cornerTL', fg: { x: .28, y: .34, size: .42 }, zone: { x: .46, y: .4, w: .5, h: .52 }, weight: [.8, .7] },
  { id: 'cornerTR', fg: { x: .72, y: .34, size: .42 }, zone: { x: .04, y: .4, w: .5, h: .52 }, weight: [.8, .7] },
  { id: 'insetTR', fg: { x: .8, y: .24, size: .3 }, zone: { x: .06, y: .26, w: .62, h: .6 }, weight: [.55, .5] },
  { id: 'insetBL', fg: { x: .2, y: .76, size: .3 }, zone: { x: .32, y: .14, w: .62, h: .6 }, weight: [.55, .5] },
  { id: 'hero', fg: { x: .5, y: .44, size: .72 }, zone: { x: .08, y: .74, w: .84, h: .22 }, weight: [.5, .6] },
  { id: 'heroTop', fg: { x: .5, y: .56, size: .72 }, zone: { x: .08, y: .04, w: .84, h: .22 }, weight: [.35, .5] },
];
J.COMPOSITION_BY_ID = Object.fromEntries(J.COMPOSITIONS.map(c => [c.id, c]));
// Lyric-only scenes: calm, aligned zones rather than arbitrary corners.
J.SOLO_ZONES = [
  { id: 'center', zone: { x: .1, y: .2, w: .8, h: .6 }, weight: 3 },
  { id: 'lower', zone: { x: .08, y: .56, w: .84, h: .38 }, weight: 1.4 },
  { id: 'upper', zone: { x: .08, y: .06, w: .84, h: .38 }, weight: .9 },
  { id: 'left', zone: { x: .05, y: .14, w: .56, h: .72 }, weight: 1 },
  { id: 'right', zone: { x: .39, y: .14, w: .56, h: .72 }, weight: 1 },
];
const lastPick = new WeakMap();
// Deterministic per cut seed; avoids repeating the previous cut's composition in the same plan and layer.
J.pickComposition = (cut, plan, layer = 'foreground') => {
  const portrait = (plan?.W || 1920) < (plan?.H || 1080), rng = J.rng(J.h(cut.seed, 881));
  const memo = plan && typeof plan === 'object' ? (lastPick.get(plan) || (lastPick.set(plan, {}), lastPick.get(plan))) : {};
  const prev = memo[layer]?.index === cut.index - 1 ? memo[layer].id : null;
  const pool = J.COMPOSITIONS.filter(c => c.id !== prev).map(c => [c, c.weight[portrait ? 1 : 0]]);
  const comp = rng.wpick(pool);
  memo[layer] = { index: cut.index, id: comp.id };
  return comp;
};
// Placement for a foreground source of fitted size fit (stage fractions) in a composition's slot.
J.compositionPlacement = (comp, cut, fit, sizeScale, dynamic) => {
  const rng = J.rng(J.h(cut.seed, 883));
  let extent = comp.fg.size * sizeScale * (dynamic ? .85 : 1) * rng.range(.94, 1.06);
  let s = extent / Math.max(fit.w, fit.h), w = fit.w * s, h = fit.h * s;
  // Keep the base frame inside the safe area (motion may still move it).
  const k = Math.min(1, .95 / w, .95 / h); w *= k; h *= k;
  const inside = (c, e) => J.clamp(c, e / 2 + .026, .974 - e / 2);// just inside the .025 safe edge
  return { cx: inside(comp.fg.x + rng.range(-.02, .02), w), cy: inside(comp.fg.y + rng.range(-.02, .02), h), w, h, lockAspect: true, angle: 0 };
};

const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
// Aligned lyric position for a w × h area: thirds, centre and margin-flush anchors, scored.
// Overlapping an obstacle is avoided whenever any candidate can; returns null when none can (the caller
// then falls back to searching free regions).
J.composeLyricArea = (cut, { w, h, obstacles = [], zone = null, fgCenter = null, fixedSize = false }) => {
  const rng = J.rng(J.h(cut.seed, 889)), margin = .03, anchors = [1 / 3, .5, 2 / 3];
  if (!zone && !obstacles.length) zone = rng.wpick(J.SOLO_ZONES.map(z => [z.zone, cut.emphasis && z.id === 'center' ? 6 : z.weight]));
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
