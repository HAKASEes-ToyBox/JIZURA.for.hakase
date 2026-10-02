/* Cut masks: shapes (circles, rectangles, stars…) whose union shows the cut (or hides it when inverted).
   target 'source': frame = the media source image, or the lyric display area (moves with the camera);
   target 'cut':    frame = the stage, applied to the finished cut after its effects. */
(() => {
'use strict';
const num = (v, d) => Number.isFinite(+v) ? +v : d;
J.MASK_SHAPES = ['ellipse', 'rect', 'roundRect', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'heart'];
// Mask motion reuses the media techniques that only move or reveal (no colour / panel effects).
J.MASK_MOTION_GROUPS = ['cinema', 'dynamic', 'bpm'];
const motionTechnique = key => { const d = J.MEDIA_TECH?.[key]; return !!d && !d.stage && J.MASK_MOTION_GROUPS.includes(d.group); };
J.normalizeMaskMotion = m => ({
  technique: motionTechnique(m?.technique) ? m.technique : 'none',
  entrance: J.MEDIA_TECH?.[m?.entrance]?.stage === 'enter' ? m.entrance : 'none',
  departure: J.MEDIA_TECH?.[m?.departure]?.stage === 'exit' ? m.departure : 'none',
  amount: J.clamp(num(m?.amount, 1), 0, 2), duration: J.clamp(num(m?.duration, .45), .05, 1.5),
});
J.maskMotionActive = m => !!m && (m.technique !== 'none' || m.entrance !== 'none' || m.departure !== 'none');
J.normalizeMask = m => {
  if (!m || typeof m !== 'object') return null;
  const shapes = (Array.isArray(m.shapes) ? m.shapes : []).filter(s => s && J.MASK_SHAPES.includes(s.type)).map(s => ({
    type: s.type, cx: num(s.cx, .5), cy: num(s.cy, .5), w: Math.max(0, num(s.w, .5)), h: Math.max(0, num(s.h, .5)), angle: J.clamp(num(s.angle, 0), -180, 180), lockAspect: s.lockAspect !== false,
  })).filter(s => s.w > 0 && s.h > 0);
  return { enabled: m.enabled === true, target: m.target === 'cut' ? 'cut' : 'source', invert: m.invert === true, opacity: J.clamp(num(m.opacity, 100), 0, 100), feather: J.clamp(num(m.feather, 0), 0, 100), shapes, motion: J.normalizeMaskMotion(m.motion) };
};
// The editor previews the unmasked reference while it is drawn.
J.masksSuspended = false;
J.activeMask = cut => {
  if (J.masksSuspended || !cut?.mask) return null;
  const mask = J.normalizeMask(cut.mask);
  return mask && mask.enabled && mask.shapes.length ? mask : null;
};
// Outlines in unit coordinates ([-1, 1] on both axes), stretched to the shape's width and height.
const regular = (n, inner = 1) => Array.from({ length: n * (inner < 1 ? 2 : 1) }, (_, i) => {
  const r = inner < 1 && i % 2 ? inner : 1, a = -Math.PI / 2 + i * Math.PI * 2 / (n * (inner < 1 ? 2 : 1));
  return [Math.cos(a) * r, Math.sin(a) * r];
});
const HEART = Array.from({ length: 72 }, (_, i) => {
  const t = i / 72 * Math.PI * 2;
  return [Math.pow(Math.sin(t), 3), -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) + 2.5) / 14.5];
});
const OUTLINES = { rect: [[-1, -1], [1, -1], [1, 1], [-1, 1]], triangle: [[0, -1], [1, 1], [-1, 1]], diamond: [[0, -1], [1, 0], [0, 1], [-1, 0]], pentagon: regular(5), hexagon: regular(6), star: regular(5, .45), heart: HEART };
// Trace the shapes in a frame of fw × fh units (the caller's transform maps units to pixels).
// Works on a canvas context or a Path2D (hit testing in the editor).
J.maskShapePath = (ctx, shapes, fw, fh) => {
  if (ctx.beginPath) ctx.beginPath();
  for (const s of shapes) {
    const cx = s.cx * fw, cy = s.cy * fh, rx = s.w * fw / 2, ry = s.h * fh / 2, a = (s.angle || 0) * Math.PI / 180;
    const cos = Math.cos(a), sin = Math.sin(a), pt = (x, y) => [cx + x * cos - y * sin, cy + x * sin + y * cos];
    if (s.type === 'ellipse') { ctx.moveTo(cx + rx * cos, cy + rx * sin); ctx.ellipse(cx, cy, rx, ry, a, 0, Math.PI * 2); continue; }
    if (s.type === 'roundRect') {
      // Rotation is rigid, so arcTo keeps circular corners.
      const r = Math.min(rx, ry) * .5, c = [[-rx, -ry], [rx, -ry], [rx, ry], [-rx, ry]].map(([x, y]) => pt(x, y)), mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const start = mid(c[3], c[0]); ctx.moveTo(start[0], start[1]);
      for (let i = 0; i < 4; i++) { const p = c[i], q = c[(i + 1) % 4]; ctx.arcTo(p[0], p[1], q[0], q[1], r); }
      ctx.closePath(); continue;
    }
    (OUTLINES[s.type] || OUTLINES.rect).map(([x, y]) => pt(x * rx, y * ry)).forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
  }
};
const scratch = new Map();
const buffer = (name, w, h) => {
  let c = scratch.get(name); if (!c) { c = document.createElement('canvas'); scratch.set(name, c); }
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, c.width, c.height);
  return [c, x];
};
// A media-cut-like description of the mask's motion at time t, timed over the masked cut.
const motionState = (motion, { cut, t, plan }) => {
  const start = cut.start, end = cut.end, d = Math.max(.04, end - start), beats = cut.songBeats || plan?.beats || [];
  const c = {
    start, end, seed: cut.seed | 0, index: cut.index | 0, technique: motion.technique, treat: 'none', trans: 'none',
    enter: J.MEDIA_TECH[motion.entrance]?.motion || 'cut', exit: J.MEDIA_TECH[motion.departure]?.motion || 'cut', hold: J.MEDIA_TECH[motion.technique]?.hold || 'still',
    bpm: cut.bpm || (beats.length > 1 ? 60 / Math.max(.05, beats[1] - beats[0]) : 120), beatOffset: cut.beatOffset ?? beats[0] ?? 0,
    effectSettings: { motion: motion.amount, treatment: 0, duration: motion.duration },
  };
  Object.defineProperty(c, 'songBeats', { value: beats });
  const phase = Math.min(motion.duration, d * .3);
  return { c, p: J.clamp((t - start) / d, 0, 1), fade: J.clamp((t - start) / phase, 0, 1), out: J.clamp((end - t) / phase, 0, 1) };
};
// Keep (or, inverted, remove) the union of the shapes on a whole canvas. matrix maps frame units to pixels;
// timing ({cut, t, plan}) animates the mask when it has a motion.
J.applyMaskToCanvas = (canvas, mask, matrix, fw, fh, timing) => {
  let [m, mx] = buffer('shapes', canvas.width, canvas.height);
  if (timing && J.maskMotionActive(mask.motion) && J.paintMediaEffect) {
    // Draw the shapes as a white image and move it with the media painter (phases, holds, beats, cameras).
    const sx = Math.hypot(matrix.a, matrix.b), sy = Math.hypot(matrix.c, matrix.d), k = Math.min(1, 2048 / Math.max(fw * sx, fh * sy, 1));
    const [shapes, sc] = buffer('motionShapes', fw * sx * k, fh * sy * k); sc.fillStyle = '#fff';
    for (const s of mask.shapes) { J.maskShapePath(sc, [s], shapes.width, shapes.height); sc.fill(); }
    const { c, p, fade, out } = motionState(mask.motion, timing);
    // Reveal phases clip the context; save/restore keeps that clip off this reused buffer's later frames.
    mx.save(); mx.setTransform(matrix); mx.translate(fw / 2, fh / 2);
    try { J.paintMediaEffect(mx, shapes, [fw, fh], c, p, fade, out); } catch (e) { console.warn('mask motion', e); }
    mx.restore();
  } else {
    mx.setTransform(matrix); mx.fillStyle = '#fff';
    // Each shape is filled on its own so overlaps always add up (a true union, whatever the winding).
    for (const s of mask.shapes) { J.maskShapePath(mx, [s], fw, fh); mx.fill(); }
  }
  // Blur the completed union (including motion) before inversion and opacity.
  // A size-relative radius keeps preview and export consistent at any resolution.
  const feather = J.clamp(num(mask.feather, 0), 0, 100);
  if (feather > 0) {
    const [soft, sx] = buffer('feather', canvas.width, canvas.height);
    sx.filter = `blur(${Math.min(canvas.width, canvas.height) * feather / 1000}px)`;
    sx.drawImage(m, 0, 0); sx.filter = 'none';
    m = soft; mx = sx;
  }
  const opacity = J.clamp(num(mask.opacity, 100), 0, 100) / 100;
  // Interpolate the mask coverage with an unmasked frame. Fill the union once,
  // so overlapping shapes do not multiply the opacity.
  if (!mask.invert && opacity < 1) {
    mx.setTransform(1, 0, 0, 1, 0, 0); mx.globalCompositeOperation = 'destination-over';
    mx.globalAlpha = 1 - opacity; mx.fillStyle = '#fff'; mx.fillRect(0, 0, m.width, m.height);
  }
  const x = canvas.getContext('2d'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = mask.invert ? opacity : 1; x.filter = 'none';
  x.globalCompositeOperation = mask.invert ? 'destination-out' : 'destination-in'; x.drawImage(m, 0, 0); x.restore();
};
const dims = src => [src.videoWidth || src.naturalWidth || src.width || 0, src.videoHeight || src.naturalHeight || src.height || 0];
// "素材": mask the media source in its own frame, before any technique uses it.
J.maskMediaSource = (source, cut, t, plan) => {
  const mask = J.activeMask(cut); if (!mask || mask.target !== 'source') return source;
  const [sw, sh] = dims(source); if (!sw || !sh) return source;
  const k = Math.min(1, 2048 / Math.max(sw, sh)), [c, x] = buffer('source', sw * k, sh * k);
  x.drawImage(source, 0, 0, c.width, c.height);
  // Rotate in source pixels before placement rotates the finished material.
  J.applyMaskToCanvas(c, mask, new DOMMatrix(), c.width, c.height, Number.isFinite(t) ? { cut, t, plan } : null);
  return c;
};
// "カット": mask a finished media layer canvas in stage fractions.
J.maskMediaLayer = (canvas, cut, t, plan) => {
  const mask = J.activeMask(cut); if (!mask || mask.target !== 'cut') return;
  J.applyMaskToCanvas(canvas, mask, new DOMMatrix(), canvas.width, canvas.height, Number.isFinite(t) ? { cut, t, plan } : null);
};
})();
