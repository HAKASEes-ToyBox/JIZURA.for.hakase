/* Cut masks: circles and rectangles whose union shows the cut (or hides it when inverted).
   target 'source': frame = the media source image, or the lyric display area (moves with the camera);
   target 'cut':    frame = the stage, applied to the finished cut after its effects. */
(() => {
'use strict';
const num = (v, d) => Number.isFinite(+v) ? +v : d;
J.MASK_SHAPES = ['ellipse', 'rect'];
J.normalizeMask = m => {
  if (!m || typeof m !== 'object') return null;
  const shapes = (Array.isArray(m.shapes) ? m.shapes : []).filter(s => s && J.MASK_SHAPES.includes(s.type)).map(s => ({
    type: s.type, cx: num(s.cx, .5), cy: num(s.cy, .5), w: Math.max(0, num(s.w, .5)), h: Math.max(0, num(s.h, .5)), angle: J.clamp(num(s.angle, 0), -180, 180),
  })).filter(s => s.w > 0 && s.h > 0);
  return { enabled: m.enabled === true, target: m.target === 'cut' ? 'cut' : 'source', invert: m.invert === true, shapes };
};
// The editor previews the unmasked reference while it is drawn.
J.masksSuspended = false;
J.activeMask = cut => {
  if (J.masksSuspended || !cut?.mask) return null;
  const mask = J.normalizeMask(cut.mask);
  return mask && mask.enabled && mask.shapes.length ? mask : null;
};
// Trace the shapes in a frame of fw × fh units (the caller's transform maps units to pixels).
J.maskShapePath = (ctx, shapes, fw, fh) => {
  ctx.beginPath();
  for (const s of shapes) {
    const cx = s.cx * fw, cy = s.cy * fh, rx = s.w * fw / 2, ry = s.h * fh / 2, a = (s.angle || 0) * Math.PI / 180;
    if (s.type === 'ellipse') { ctx.moveTo(cx + rx * Math.cos(a), cy + rx * Math.sin(a)); ctx.ellipse(cx, cy, rx, ry, a, 0, Math.PI * 2); }
    else {
      const cos = Math.cos(a), sin = Math.sin(a), pt = (x, y) => [cx + x * cos - y * sin, cy + x * sin + y * cos];
      [[-rx, -ry], [rx, -ry], [rx, ry], [-rx, ry]].map(([x, y]) => pt(x, y)).forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath();
    }
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
// Keep (or, inverted, remove) the union of the shapes on a whole canvas. matrix maps frame units to pixels.
J.applyMaskToCanvas = (canvas, mask, matrix, fw, fh) => {
  const [m, mx] = buffer('shapes', canvas.width, canvas.height);
  mx.setTransform(matrix); mx.fillStyle = '#fff';
  // Each shape is filled on its own so overlaps always add up (a true union, whatever the winding).
  for (const s of mask.shapes) { J.maskShapePath(mx, [s], fw, fh); mx.fill(); }
  const x = canvas.getContext('2d'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.filter = 'none';
  x.globalCompositeOperation = mask.invert ? 'destination-out' : 'destination-in'; x.drawImage(m, 0, 0); x.restore();
};
const dims = src => [src.videoWidth || src.naturalWidth || src.width || 0, src.videoHeight || src.naturalHeight || src.height || 0];
// "素材": mask the media source in its own frame, before any technique uses it.
J.maskMediaSource = (source, cut) => {
  const mask = J.activeMask(cut); if (!mask || mask.target !== 'source') return source;
  const [sw, sh] = dims(source); if (!sw || !sh) return source;
  const k = Math.min(1, 2048 / Math.max(sw, sh)), [c, x] = buffer('source', sw * k, sh * k);
  x.drawImage(source, 0, 0, c.width, c.height);
  J.applyMaskToCanvas(c, mask, new DOMMatrix([c.width, 0, 0, c.height, 0, 0]), 1, 1);
  return c;
};
// "カット": mask a finished media layer canvas in stage fractions.
J.maskMediaLayer = (canvas, cut) => {
  const mask = J.activeMask(cut); if (!mask || mask.target !== 'cut') return;
  J.applyMaskToCanvas(canvas, mask, new DOMMatrix([canvas.width, 0, 0, canvas.height, 0, 0]), 1, 1);
};
})();
