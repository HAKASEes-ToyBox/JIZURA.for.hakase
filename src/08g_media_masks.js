/* Mask pack (詳細 → 背景の演出 → マスク): background techniques built on moving masks, the way MVs frame a
   shot through shapes, windows, bands and rings. Inside the mask the source plays in full colour; outside
   it stays visible as a dimmed, desaturated, softened copy (never a solid fill, so the source alpha is kept).
   Background only: foreground cuts never draw them (J.mediaTechnique / the technique lists skip them). */
(() => {
'use strict';
const L = J.mediaLabel, TAU = Math.PI * 2;
const clamp = n => J.clamp(n, 0, 1), ease = q => q * q * (3 - 2 * q), mod = (n, d) => ((n % d) + d) % d;
const MASKS = [
  ['maskShapeZoom', 'シェイプ・ズームスルー', 'Shape zoom-through'],
  ['maskBeatWindows', 'ビート・ウィンドウ', 'Beat windows'],
  ['maskSlashParallax', 'スラッシュ・パララックス', 'Slash parallax'],
  ['maskRings', '回転リング', 'Rotating rings'],
  ['maskDoubleExposure', '二重露光', 'Double exposure'],
  ['maskSplitScreen', 'スプリットスクリーン', 'Split screen'],
  ['maskCinemascope', 'シネマスコープ', 'Cinemascope'],
  ['maskShutterBeat', 'ビート・シャッター', 'Beat shutters'],
  ['maskDotMatrix', 'ドット・マスク', 'Dot matrix'],
  ['maskDetailGrid', 'ディテール・グリッド', 'Detail grid'],
];
J.MEDIA_MASK_KEYS = MASKS.map(([key]) => key);
for (const [key, ja, en] of MASKS) J.MEDIA_TECH[key] = { name: L(ja, en), group: 'maskFx', backgroundOnly: true, enter: 'fade', hold: 'still', exit: 'fade', treat: key, trans: 'none' };
// Which techniques a layer may use (masks are for the background only).
J.mediaTechAllowed = (key, layer) => !J.MEDIA_TECH[key]?.backgroundOnly || layer === 'media';

const SHAPES = ['ellipse', 'star', 'heart', 'diamond', 'hexagon', 'roundRect'];
const songTime = (cut, p) => (cut.start || 0) + p * ((cut.end || 0) - (cut.start || 0));
// Beat clock: index of the current beat and the time since it, on the project's BPM grid.
const beatAt = (cut, p) => {
  const bpm = cut.bpm > 0 ? cut.bpm : 120, b = (songTime(cut, p) - (cut.beatOffset || 0)) * bpm / 60;
  return { index: Math.floor(b), frac: mod(b, 1), beat: 60 / bpm };
};
const MASK = new Set(J.MEDIA_MASK_KEYS);
const previousDraw = J.drawMediaVariation;
J.drawMediaVariation = (ctx, source, fit, cut, p, amount) => {
  const type = cut.treat;
  if (!MASK.has(type) || amount <= 0) return previousDraw ? previousDraw(ctx, source, fit, cut, p, amount) : false;
  const [w, h] = fit, seed = cut.seed | 0, t = p * TAU, motion = cut.effectSettings?.motion ?? 1;
  const draw = (x = 0, y = 0, scale = 1, rotation = 0) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(scale, scale); ctx.drawImage(source, -w / 2, -h / 2, w, h); ctx.restore(); };
  // The outside of every mask: the same shot, dimmed and softened (strength = 加工の強さ).
  const under = (scale = 1) => {
    ctx.save(); ctx.filter = `grayscale(${.85 * amount}) brightness(${1 - .5 * amount}) blur(${Math.round(7 * amount * w / 1920)}px)`;
    draw(0, 0, scale); ctx.restore();
  };
  // Draw inside a clip traced by path(); the path is in frame pixels around the centre.
  const inside = (path, paint = () => draw()) => { ctx.save(); ctx.beginPath(); path(); ctx.clip(); paint(); ctx.restore(); };
  // A cut-mask shape (08j_cut_mask) given in frame fractions; the path keeps the transform it was traced with.
  const shapePath = shape => { ctx.save(); ctx.translate(-w / 2, -h / 2); J.maskShapePath(ctx, [shape], w, h); ctx.restore(); };
  const frame = () => { ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip(); };
  ctx.save(); frame();
  switch (type) {
    case 'maskShapeZoom': {
      // A shape opens from the centre and flies past the camera, twice per cut; the shot inside pushes in.
      const round = Math.floor(p * 2), shape = SHAPES[Math.floor(J.r(seed, round, 901) * SHAPES.length)], cycle = mod(p * 2, 1), k = ease(cycle) * .75 + Math.pow(cycle, 4) * .25;
      const size = .22 + k * 2.4, spin = (J.r(seed, 902) - .5) * .6 * motion * cycle;
      under(1.05);
      inside(() => shapePath({ type: shape, cx: .5, cy: .5, w: size * h / w, h: size, angle: spin * 180 / Math.PI }),
        () => draw(0, 0, 1 + .12 * cycle * motion));
      break;
    }
    case 'maskBeatWindows': {
      // Each beat opens 1–3 windows at seeded places; they pop open and settle.
      under();
      const { index, frac } = beatAt(cut, p), pop = 1 + .18 * Math.exp(-frac * 9) * motion;
      const count = 1 + Math.floor(J.r(seed, index, 911) * 3);
      inside(() => {
        for (let i = 0; i < count; i++) {
          const bw = w * (.22 + .22 * J.r(seed, index, i, 912)) * pop, bh = h * (.25 + .3 * J.r(seed, index, i, 913)) * pop;
          const cx = (J.r(seed, index, i, 914) - .5) * (w - bw), cy = (J.r(seed, index, i, 915) - .5) * (h - bh);
          ctx.rect(cx - bw / 2, cy - bh / 2, bw, bh);
        }
      });
      break;
    }
    case 'maskSlashParallax': {
      // Diagonal bands, each sliding the shot along the slash at its own speed.
      under();
      const n = 4 + Math.floor(J.r(seed, 921) * 3), angle = (J.r(seed, 922) < .5 ? -1 : 1) * (.35 + .2 * J.r(seed, 923));
      const span = Math.hypot(w, h), step = span / n, gap = step * .12 * amount;
      for (let i = 0; i < n; i++) {
        const speed = (i % 2 ? -1 : 1) * (.5 + J.r(seed, i, 924)), shift = (p - .5) * w * .35 * speed * motion;
        inside(() => { ctx.rotate(angle); ctx.rect(-span, -span / 2 + i * step + gap / 2, span * 2, step - gap); ctx.rotate(-angle); },
          () => draw(Math.cos(angle) * shift, Math.sin(angle) * shift, 1.3 + .08 * (i % 3)));
      }
      break;
    }
    case 'maskRings': {
      // Concentric rings, each a copy of the shot turning its own way, around a still centre disc.
      under();
      const n = 5, r0 = Math.hypot(w, h) / 2 / n, pulse = 1 + .06 * Math.exp(-beatAt(cut, p).frac * 7) * motion;
      for (let i = n - 1; i >= 0; i--) {
        const r1 = (i + 1) * r0 * pulse, r2 = Math.max(0, r1 - r0 * (1 - .12 * amount)), turn = (i % 2 ? -1 : 1) * (i ? t * .08 * (1 + i * .3) * motion : 0);
        inside(() => { ctx.arc(0, 0, r1, 0, TAU); ctx.moveTo(r2, 0); ctx.arc(0, 0, r2, 0, TAU, true); }, () => draw(0, 0, Math.max(1 + i * .04, r1 * 2 / Math.min(w, h) + .02), turn));
      }
      break;
    }
    case 'maskDoubleExposure': {
      // The shot, with an enlarged drifting copy of itself exposed inside a big silhouette shape.
      draw();
      const shape = SHAPES[Math.floor(J.r(seed, 931) * SHAPES.length)], size = .95 + .08 * Math.sin(t);
      const dx = Math.sin(t * .7 + seed) * w * .06 * motion, dy = Math.cos(t * .5) * h * .05 * motion;
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha *= .75 * amount;
      inside(() => shapePath({ type: shape, cx: .5 + (J.r(seed, 932) - .5) * .3, cy: .5, w: size * h / w, h: size, angle: 0 }),
        () => draw(dx, dy, 1.7));
      ctx.restore();
      break;
    }
    case 'maskSplitScreen': {
      // Two or three slanted panels, each a different crop of the shot, sliding in and drifting apart.
      under();
      const n = 2 + Math.floor(J.r(seed, 941) * 2), slant = (J.r(seed, 942) - .5) * w * .25, open = ease(clamp(p * 4)), gap = w * .012 * amount;
      for (let i = 0; i < n; i++) {
        const x0 = -w / 2 + i * w / n, x1 = x0 + w / n, from = (i % 2 ? 1 : -1) * h * (1 - open);
        const zoom = 1.15 + .35 * J.r(seed, i, 943), fx = (J.r(seed, i, 944) - .5) * w * .3, fy = (J.r(seed, i, 945) - .5) * h * .3;
        inside(() => { ctx.moveTo(x0 + gap + slant, -h / 2 + from); ctx.lineTo(x1 - gap + slant, -h / 2 + from); ctx.lineTo(x1 - gap - slant, h / 2 + from); ctx.lineTo(x0 + gap - slant, h / 2 + from); ctx.closePath(); },
          () => draw(fx + (p - .5) * w * .05 * (i % 2 ? -1 : 1) * motion, fy + from, zoom));
      }
      break;
    }
    case 'maskCinemascope': {
      // A 2.39:1 window closes in from the full frame and glides a little; the shot inside pushes in.
      under(1.08);
      const band = Math.min(h, w / 2.39), close = ease(clamp(p * 5)), bh = h - (h - band) * close * amount;
      const y = Math.sin(t * .5 + seed) * (h - bh) * .35 * motion;
      inside(() => ctx.rect(-w / 2, y - bh / 2, w, bh), () => draw(0, 0, 1.04 + .08 * p * motion));
      break;
    }
    case 'maskShutterBeat': {
      // Horizontal slats that snap open from alternate sides on every beat.
      under();
      const { index, frac } = beatAt(cut, p), n = 6 + 2 * Math.floor(J.r(seed, 951) * 3), open = ease(clamp(frac * 3));
      inside(() => {
        for (let i = 0; i < n; i++) {
          const y0 = -h / 2 + i * h / n, grow = (index + i) % 2 ? open : 1 - open * .35, sw = w * grow;
          ctx.rect((i + index) % 2 ? w / 2 - sw : -w / 2, y0, sw, h / n * (1 - .1 * amount));
        }
      });
      break;
    }
    case 'maskDotMatrix': {
      // A grid of dots whose size ripples out from a seeded point, a halftone window onto the shot.
      under();
      const cols = 16, cell = w / cols, rows = Math.ceil(h / cell) + 1, ox = (J.r(seed, 961) - .5) * w * .6, oy = (J.r(seed, 962) - .5) * h * .6;
      inside(() => {
        for (let j = 0; j < rows; j++) for (let i = 0; i <= cols; i++) {
          const cx = -w / 2 + (i + (j % 2) * .5) * cell, cy = -h / 2 + j * cell, d = Math.hypot(cx - ox, cy - oy) / Math.hypot(w, h);
          const r = cell * .5 * (.35 + .75 * clamp(.5 + .5 * Math.sin(d * 18 - t * 2 * motion)));
          ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU);
        }
      }, () => draw(0, 0, 1.03));
      break;
    }
    case 'maskDetailGrid': {
      // A 3×3 grid of close-ups of the shot; on each beat one cell swaps to the full view.
      under();
      const cols = 3, rows = 3, gap = Math.min(w, h) * .012 * (.5 + amount), cw = w / cols, ch = h / rows, { index, frac } = beatAt(cut, p);
      const hero = Math.floor(J.r(seed, index, 971) * cols * rows);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const k = j * cols + i, x0 = -w / 2 + i * cw, y0 = -h / 2 + j * ch, zoom = 1.6 + J.r(seed, k, 972) * 1.4;
        const fx = (J.r(seed, k, 973) - .5) * w * .5, fy = (J.r(seed, k, 974) - .5) * h * .5, drift = (p - .5) * cw * .15 * motion * (k % 2 ? 1 : -1);
        inside(() => ctx.rect(x0 + gap / 2, y0 + gap / 2, cw - gap, ch - gap),
          () => k === hero ? draw(x0 + cw / 2, y0 + ch / 2, (1 / cols) * (1 + .08 * Math.exp(-frac * 8))) : draw(x0 + cw / 2 + fx / zoom + drift, y0 + ch / 2 + fy / zoom, zoom / cols));
      }
      break;
    }
  }
  ctx.restore();
  return true;
};
})();
