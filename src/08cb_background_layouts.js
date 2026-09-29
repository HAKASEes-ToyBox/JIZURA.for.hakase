/* Dynamic background layouts (詳細 → 背景 → 背景をダイナミックに配置).
   A layout frames the background through a mask window (circle, half, band, frame…) on the STAGE and
   places the source to fill that window. Lyrics and the foreground then compose around it: each layout
   carries the free zone for the lyrics, the boxes they keep clear of, and how the foreground sits in
   the window. Layouts join the automatic background framing lottery next to the plain zoom/pan patterns
   (J.BACKGROUND_PATTERNS) and are written to the cut as an ordinary cut mask (target 'cut'), so the
   manual mask editor shows and edits them like any other mask.
   All shapes below are written for a LANDSCAPE stage of aspect S (stage fractions); portrait stages get
   the transposed layout (halves become top / bottom, side strips become bands). */
(() => {
'use strict';
const clamp = J.clamp;
const shape = (type, cx, cy, w, h, angle = 0) => ({ type, cx, cy, w, h, angle, lockAspect: true });
// A pixel-square shape of diameter d (in stage heights on a landscape stage) centred at (cx, cy).
const disc = (S, cx, cy, d, type = 'ellipse') => { const m = Math.min(1, S); return shape(type, cx, cy, d * m / S, d * m); };
const rect = (x, y, w, h, type = 'rect') => shape(type, x + w / 2, y + h / 2, w, h);
const POLYGONS = new Set(['triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'heart']);
// Mirroring / transposing keeps polygons upright (a heart never turns over or on its side).
const XF = {
  mirrorX: { shape: s => ({ ...s, cx: 1 - s.cx, angle: POLYGONS.has(s.type) ? s.angle : -s.angle }), rect: r => r && { ...r, x: 1 - r.x - r.w } },
  mirrorY: { shape: s => ({ ...s, cy: 1 - s.cy, angle: POLYGONS.has(s.type) ? s.angle : -s.angle }), rect: r => r && { ...r, y: 1 - r.y - r.h } },
  // Swapping the axes swaps the sizes; a rotated shape's angle reflects to its negative (its axes swapped too).
  transpose: { shape: s => ({ ...s, cx: s.cy, cy: s.cx, w: s.h, h: s.w, angle: POLYGONS.has(s.type) ? s.angle : -s.angle }), rect: r => r && { x: r.y, y: r.x, w: r.h, h: r.w } },
};
// Bounding box of shapes in stage fractions, traced through the mask's own outline code.
const boundsOf = shapes => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const pt = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  J.maskShapePath({
    beginPath() {}, closePath() {}, moveTo: pt, lineTo: pt, arcTo: (x, y) => pt(x, y),
    ellipse(cx, cy, rx, ry, a) { const c = Math.cos(a), s = Math.sin(a), hx = Math.hypot(rx * c, ry * s), hy = Math.hypot(rx * s, ry * c); pt(cx - hx, cy - hy); pt(cx + hx, cy + hy); },
  }, shapes, 1, 1);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
J.maskBounds = boundsOf;
const clip = r => { const x = clamp(r.x, 0, 1), y = clamp(r.y, 0, 1), x2 = clamp(r.x + r.w, 0, 1), y2 = clamp(r.y + r.h, 0, 1); return { x, y, w: x2 - x, h: y2 - y }; };
const grow = (r, p) => clip({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });
const union = list => { const x = Math.min(...list.map(r => r.x)), y = Math.min(...list.map(r => r.y)); return { x, y, w: Math.max(...list.map(r => r.x + r.w)) - x, h: Math.max(...list.map(r => r.y + r.h)) - y }; };
const usable = r => r && r.w >= .08 && r.h >= .08 ? r : null;
const round = r => r && { x: +r.x.toFixed(4), y: +r.y.toFixed(4), w: +r.w.toFixed(4), h: +r.h.toFixed(4) };

// build(r, S) -> { shapes, invert?, zone?, obstacles?, fg?, center? }
//   zone       where the lyrics sit (stage rect)
//   obstacles  boxes the lyrics keep clear of (default: the window's box; [] = lyrics may overlay it)
//   fg         false = the foreground uses its usual compositions instead of sitting in the window
//   lyricIn    the lyrics live inside the window (no "keep away" balance)
// mirror: which flips are allowed ('xy' = both, 'x', 'y', '' = none).
// keep: on a portrait stage build the layout as written for it (caption strip, polaroid…) instead of
// transposing the landscape one.
const layout = (id, weight, build, mirror = 'xy', keep = false) => ({ layout: true, id, weight, build, mirror, keep });
const LAYOUTS = [
  // ---- a circle in the middle, lyrics around it
  layout('orb', [1.3, 1.1], (r, S) => {
    const d = r.range(.58, .74), hw = d / S / 2;
    return { shapes: [disc(S, .5, .5, d)], zone: { x: .03, y: .1, w: .5 - hw - .06, h: .8 } };
  }),
  layout('orbSide', [1.2, 1], (r, S) => {
    const d = r.range(.62, .8), cx = r.range(.27, .33), hw = d / S / 2, x = cx + hw + .05;
    return { shapes: [disc(S, cx, .5, d)], zone: { x, y: .14, w: .96 - x, h: .72 } };
  }),
  // a huge circle bleeding off the stage edge: only an arc shows
  layout('orbBleed', [.9, .8], (r, S) => {
    const d = r.range(1.3, 1.6), hw = d / S / 2, cx = r.range(.02, .14), edge = cx + hw, x = edge + .06;
    return { shapes: [disc(S, cx, .5, d)], zone: { x, y: .12, w: .94 - x, h: .76 } };
  }),
  // a rising dome (sunrise) with the lyrics in the sky
  layout('dome', [.8, .9], (r, S) => {
    const d = r.range(1.25, 1.5), v = r.range(.42, .56), cy = 1 - v + d / 2;
    return { shapes: [disc(S, .5, cy, d)], zone: { x: .08, y: .06, w: .84, h: 1 - v - .12 } };
  }),
  // ---- the stage split into a picture and a lyric side
  layout('halfSplit', [1.4, 1.1], r => {
    const x0 = r.range(.46, .52);
    return { shapes: [rect(x0, 0, 1 - x0, 1)], zone: { x: .05, y: .12, w: x0 - .09, h: .76 } };
  }),
  layout('sideSplit', [.8, .6], r => {
    const x0 = r.range(.3, .4);
    return { shapes: [rect(x0, 0, 1 - x0, 1)], zone: { x: .04, y: .14, w: x0 - .07, h: .72 } };
  }),
  layout('sideSplitWide', [.8, .6], r => {
    const x0 = r.range(.58, .66);
    return { shapes: [rect(x0, 0, 1 - x0, 1)], zone: { x: .04, y: .12, w: x0 - .08, h: .76 } };
  }),
  // an inset panel with a margin
  layout('panel', [1, .8], (r, S) => {
    const my = r.range(.09, .12), x = my / S * r.range(.9, 1.2), w = r.range(.44, .52), y = my, h = 1 - 2 * my, right = x + w;
    return { shapes: [rect(x, y, w, h, r.chance(.55) ? 'roundRect' : 'rect')], zone: { x: right + .05, y: .16, w: .95 - right - .05, h: .68 } };
  }),
  // a picture on top and a caption strip below
  layout('capStrip', [.9, .7], r => {
    const h = r.range(.62, .7);
    return { shapes: [rect(0, 0, 1, h)], zone: { x: .06, y: h + .04, w: .88, h: .94 - h - .04 } };
  }, 'xy', true),
  // letterbox: the lyrics in the band, or as a subtitle in the bar
  layout('cinema', [.9, .5], r => {
    const y = r.range(.15, .2), h = 1 - 2 * y;
    const zone = r.chance(.5) ? { x: .08, y: y + h * .55, w: .84, h: h * .38 } : { x: .08, y: y + h + .015, w: .84, h: y - .03 };
    return { shapes: [rect(0, y, 1, h)], obstacles: [], zone, fg: false };
  }, 'xy', true),
  // a slim vertical window (a door, a column of light)
  layout('column', [.7, .6], r => {
    const w = r.range(.14, .32), x = r.range(.36, .44);
    return { shapes: [rect(x, r.chance(.5) ? 0 : .05, w, r.chance(.5) ? 1 : .9, w > .24 ? 'roundRect' : 'rect')], zone: { x: .04, y: .16, w: x - .07, h: .68 } };
  }),
  // ---- shaped windows
  layout('emblem', [1, .9], (r, S) => {
    const type = r.wpick([['star', 1], ['heart', 1], ['hexagon', 1.3], ['diamond', 1.3], ['pentagon', .8]]), d = r.range(.66, .84), hw = d / S / 2;
    return { shapes: [disc(S, .5, .5, d, type)], zone: { x: .03, y: .1, w: .5 - hw - .06, h: .8 } };
  }, 'x'),
  layout('spotlight', [.8, .7], r => {
    const w = r.range(.7, .82), h = r.range(.5, .6);
    return { shapes: [shape('ellipse', .5, .4, w, h)], zone: { x: .1, y: .4 + h / 2 + .04, w: .8, h: .94 - (.4 + h / 2 + .04) } };
  }, 'xy', true),
  // ---- several windows
  layout('duo', [.8, .5], (r, S) => {
    const d = r.range(.44, .52), sep = r.range(.15, .2);
    return { shapes: [disc(S, .5 - sep, .4, d), disc(S, .5 + sep, .4, d)], zone: { x: .1, y: .4 + d / 2 + .06, w: .8, h: .94 - (.4 + d / 2 + .06) } };
  }),
  layout('trio', [.7, .35], (r, S) => {
    const d = r.range(.3, .36);
    return { shapes: [disc(S, .2, .4, d), disc(S, .5, .4, d), disc(S, .8, .4, d)], zone: { x: .08, y: .4 + d / 2 + .06, w: .84, h: .94 - (.4 + d / 2 + .06) } };
  }),
  // a large and a small circle on a diagonal, lyrics in the open corner
  layout('pair', [.8, .7], (r, S) => {
    const big = r.range(.6, .7), small = r.range(.28, .34), a = disc(S, .3, .55, big), b = disc(S, .72, .3, small);
    return { shapes: [a, b], obstacles: [grow(boundsOf([a]), .01), grow(boundsOf([b]), .01)], zone: { x: .53, y: .54, w: .42, h: .38 }, center: { x: .3, y: .55 } };
  }),
  // a slanted ribbon across the stage
  layout('slash', [.6, .5], (r, S) => {
    // The mask rotates in stage-fraction space; choose the angle that reads as the wanted slope on screen.
    const slope = -r.range(10, 18) * Math.PI / 180, angle = Math.atan(Math.tan(slope) * S) * 180 / Math.PI;
    const zone = r.chance(.5) ? { x: .04, y: .06, w: .36, h: .24 } : { x: .6, y: .7, w: .36, h: .24 };
    return { shapes: [shape('rect', .5, .5, 1.7, r.range(.3, .38), angle)], obstacles: [{ x: 0, y: .42, w: .42, h: .5 }, { x: .33, y: .28, w: .34, h: .44 }, { x: .58, y: .1, w: .42, h: .5 }], zone };
  }),
  // a small picture in the corner, the lyrics take the rest
  layout('card', [.6, .6], r => {
    const w = r.range(.3, .36), h = r.range(.36, .46), x = .94 - w, y = r.range(.08, .12);
    return { shapes: [rect(x, y, w, h, 'roundRect')], zone: { x: .05, y: y + h * .45, w: x - .1, h: .9 - (y + h * .45) }, fg: false };
  }),
  // ---- pictures the lyrics run over
  layout('porthole', [.6, .6], (r, S) => ({ shapes: [disc(S, .5, .5, r.range(.9, 1))], obstacles: [], zone: null, fg: false })),
  layout('frame', [1, .9], (r, S) => {
    const my = r.range(.06, .09), mx = my / S;
    return { shapes: [rect(mx, my, 1 - 2 * mx, 1 - 2 * my, r.chance(.4) ? 'roundRect' : 'rect')], obstacles: [], zone: null, fg: false };
  }),
  layout('polaroid', [.8, .7], (r, S) => {
    const my = r.range(.06, .08), mx = my / S, h = r.range(.62, .68), bottom = my + h;
    return { shapes: [rect(mx, my, 1 - 2 * mx, h)], zone: { x: mx + .02, y: bottom + .03, w: 1 - 2 * mx - .04, h: .95 - bottom - .03 } };
  }, 'x', true),
  layout('diptych', [.6, .6], (r, S) => {
    const gap = r.range(.02, .035), my = r.range(.08, .11), w = (1 - 2 * my / S - gap) / 2, x = my / S;
    return { shapes: [rect(x, my, w, 1 - 2 * my), rect(x + w + gap, my, w, 1 - 2 * my)], obstacles: [], zone: null, fg: false };
  }),
  layout('triptych', [.6, .5], (r, S) => {
    const gap = r.range(.02, .035), my = r.range(.08, .11), x = my / S, w = (1 - 2 * x - 2 * gap) / 3;
    return { shapes: [0, 1, 2].map(i => rect(x + i * (w + gap), my, w, 1 - 2 * my)), obstacles: [], zone: null, fg: false };
  }),
  layout('quad', [.45, .4], (r, S) => {
    const gap = r.range(.02, .03), m = r.range(.07, .09), mx = m / S, w = (1 - 2 * mx - gap / S * 1.4) / 2, h = (1 - 2 * m - gap) / 2, gx = gap / S * 1.4;
    return { shapes: [0, 1, 2, 3].map(i => rect(mx + (i % 2) * (w + gx), m + Math.floor(i / 2) * (h + gap), w, h)), obstacles: [], zone: null, fg: false };
  }),
  // ---- the picture everywhere except a clean window for the lyrics
  layout('voidCircle', [.8, .7], (r, S) => {
    const d = r.range(.5, .62), s = disc(S, .5, .5, d);
    return { shapes: [s], invert: true, obstacles: [], zone: grow(boundsOf([s]), -.03), fg: false, lyricIn: true };
  }),
  layout('voidBand', [.7, .6], r => {
    const h = r.range(.2, .3), y = r.range(.34, .4);
    return { shapes: [rect(0, y, 1, h)], invert: true, obstacles: [], zone: { x: .06, y: y + .02, w: .88, h: h - .04 }, fg: false, lyricIn: true };
  }),
  layout('voidRect', [.6, .55], r => {
    const w = r.range(.5, .62), h = r.range(.46, .58), x = (1 - w) / 2, y = (1 - h) / 2;
    return { shapes: [rect(x, y, w, h, r.chance(.5) ? 'roundRect' : 'rect')], invert: true, obstacles: [], zone: { x: x + .03, y: y + .04, w: w - .06, h: h - .08 }, fg: false, lyricIn: true };
  }),
];
J.BACKGROUND_LAYOUTS = LAYOUTS;
J.BACKGROUND_LAYOUT_SHARE = .45;// about this share of automatic backgrounds use a layout

// The layouts entering the framing lottery for a cut, weighted so that they take about BACKGROUND_LAYOUT_SHARE of it.
J.backgroundLayoutPool = (cut, plan) => {
  // Short cuts would flicker between windows; the mask techniques already are their own framing.
  if (cut.end - cut.start < 1.5 || J.MEDIA_TECH?.[cut.technique]?.group === 'maskFx') return [];
  const portrait = (plan?.W || 1920) < (plan?.H || 1080), list = LAYOUTS.filter(l => l.weight[portrait ? 1 : 0] > 0);
  const own = list.reduce((sum, l) => sum + l.weight[portrait ? 1 : 0], 0), classic = J.BACKGROUND_PATTERNS.reduce((sum, p) => sum + p.weight, 0);
  const k = classic * J.BACKGROUND_LAYOUT_SHARE / (1 - J.BACKGROUND_LAYOUT_SHARE) / own;
  return list.map(l => ({ ...l, weight: l.weight[portrait ? 1 : 0] * k }));
};

// Build the layout for a cut: the mask window, the source placement filling it, and the scene data the
// lyrics and the foreground compose against. Sets cut.mask / cut.bgLayout / cut.composition.
J.layoutPlacement = (def, cut, plan, fit) => {
  const W = plan?.W || 1920, H = plan?.H || 1080, S = W / H, portrait = S < 1, transposed = portrait && !def.keep;
  const rng = J.rng(J.h(J.placementSeed(cut), 891));
  // Built on a landscape stage of aspect Sv (a portrait stage is transposed afterwards), or as written for it.
  const o = def.build(rng, transposed ? 1 / S : S), flipX = rng.chance(.5) && def.mirror.includes('x'), flipY = rng.chance(.5) && def.mirror.includes('y');
  const ops = [...flipX ? ['mirrorX'] : [], ...flipY ? ['mirrorY'] : [], ...transposed ? ['transpose'] : []];
  const apply = (value, kind) => ops.reduce((v, op) => v && XF[op][kind](v), value);
  const shapes = o.shapes.map(s => apply(s, 'shape'));
  const window = clip(union(shapes.map(s => boundsOf([s]))));
  // Explicit obstacles are written like the shapes (landscape); the default is the finished window's box.
  const obstacles = (o.obstacles ? o.obstacles.map(r => apply(r, 'rect')) : [grow(window, .01)]).map(round);
  const zone = usable(round(o.zone && clip(apply(o.zone, 'rect'))));
  // The foreground sits in the largest window; among equals, the one nearest the middle of them all.
  const boxes = shapes.map(s => clip(boundsOf([s]))), most = Math.max(...boxes.map(b => b.w * b.h)), mid = { x: window.x + window.w / 2, y: window.y + window.h / 2 };
  const largest = boxes.filter(b => b.w * b.h >= most * .95).reduce((a, b) => Math.hypot(b.x + b.w / 2 - mid.x, b.y + b.h / 2 - mid.y) < Math.hypot(a.x + a.w / 2 - mid.x, a.y + a.h / 2 - mid.y) ? b : a);
  // Place the source over the window's box (over the whole stage for an inverted window), zoomed by a seeded amount.
  const cover = o.invert ? { x: 0, y: 0, w: 1, h: 1 } : window;
  const fill = Math.max(cover.w / fit.w, cover.h / fit.h), scale = Math.min(fill * rng.range(1, 1.5), 4 / Math.max(fit.w, fit.h));
  const w = fit.w * scale, h = fit.h * scale;
  // The source's centre sits at the window's centre, or drifts within the slack (never exposing an edge).
  const drift = rng.chance(.5) ? 0 : .85, at = (c, len, extent) => len >= extent ? c + rng.range(-1, 1) * drift * (len - extent) / 2 : c;
  const placement = { cx: at(cover.x + cover.w / 2, w, cover.w), cy: at(cover.y + cover.h / 2, h, cover.h), w, h, lockAspect: true, angle: 0 };
  const mask = J.normalizeMask({ enabled: true, target: 'cut', invert: !!o.invert, shapes });
  const movePoint = p => ops.reduce((v, op) => op === 'mirrorX' ? { x: 1 - v.x, y: v.y } : op === 'mirrorY' ? { x: v.x, y: 1 - v.y } : { x: v.y, y: v.x }, p);
  const centre = o.center ? movePoint(o.center) : { x: window.x + window.w / 2, y: window.y + window.h / 2 };
  const sitsIn = o.fg !== false && !o.invert && zone;
  const fgBox = { x: largest.x + largest.w / 2, y: largest.y + largest.h / 2, box: { w: largest.w, h: largest.h } };
  cut.mask = mask;
  cut.composition = 'layout:' + def.id;
  cut.bgLayout = {
    id: def.id, sig: JSON.stringify(mask), obstacles, zone,
    // Lyrics keep away from the window (balance) unless they live inside it.
    center: o.lyricIn || !obstacles.length ? null : { x: +centre.x.toFixed(4), y: +centre.y.toFixed(4) },
    // How the foreground sits with it: inside the window, or breaking out of its frame.
    comps: sitsIn ? [
      { id: `bgfit:${def.id}:in`, fg: { ...fgBox, size: [.7, .92] }, zone, weight: [1.2, 1.2], bg: true },
      { id: `bgfit:${def.id}:break`, fg: { ...fgBox, size: [1.02, 1.24] }, zone, weight: [.8, .8], bg: true },
    ] : [],
  };
  return placement;
};

// ---- scenes: what the lyrics and the foreground compose against
// The background plan as seen while the lyrics are still being planned (plan.media is not set yet then).
const planCache = new WeakMap();
const backgroundPlan = (project, plan, audioDuration) => {
  if (plan.media?.cuts) return plan.media;
  if (!project.media) return null;
  const cached = planCache.get(plan);
  if (cached && cached.project === project && cached.duration === plan.duration) return cached.result;
  let result = null;
  try { result = J.planMedia(project, plan, audioDuration, 'media'); } catch (e) { console.warn('background scenes', e); }
  planCache.set(plan, { project, duration: plan.duration, result });
  return result;
};
// Automatic layouts only: a cut whose mask was changed by hand (cut details) no longer is the layout.
J.backgroundScenes = (project, plan, audioDuration) => {
  const bg = backgroundPlan(project, plan, audioDuration);
  if (!bg) return [];
  return bg.cuts.filter(c => c.itemId && c.opacity > 0 && c.bgLayout && c.mask && JSON.stringify(c.mask) === c.bgLayout.sig)
    .map(c => ({ start: c.start, end: c.end, id: c.bgLayout.id, boxes: c.bgLayout.obstacles || [], zone: c.bgLayout.zone, center: c.bgLayout.center, comps: c.bgLayout.comps || [] }));
};
// The layout a foreground cut shares the most time with (null when it has none, or only a fleeting one).
J.backgroundSceneAt = (project, plan, start, end) => {
  const overlap = s => Math.min(s.end, end) - Math.max(s.start, start);
  const scenes = J.backgroundScenes(project, plan, null).filter(s => overlap(s) > Math.min(.3, (end - start) * .5));
  return scenes.length ? scenes.reduce((a, b) => overlap(b) > overlap(a) ? b : a) : null;
};
})();
