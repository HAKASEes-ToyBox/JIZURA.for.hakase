/* Second media pack. Pure time/seed animation; all paint stays alpha-aware. */
(() => {
'use strict';
const L = J.mediaLabel, TAU = Math.PI * 2;
J.MEDIA_VARIATION_KEYS = [];
const add = (key, ja, en, group, enter, hold, exit, treat = 'none') => {
  J.MEDIA_VARIATION_KEYS.push(key);
  J.MEDIA_TECH[key] = { name: L(ja, en), group, enter, hold, exit, treat, trans: 'none' };
};
add('arcTravel', 'アーチトラベル', 'Arch travel', 'cinema', 'fade', 'arcTravel', 'fade');
add('figureEight', '8の字フロート', 'Figure eight', 'cinema', 'fade', 'figureEight', 'fade');
add('dollyOrbit', '奥行きオービット', 'Depth orbit', 'cinema', 'fade', 'dollyOrbit', 'fade');
add('spiralApproach', 'スパイラル着地', 'Spiral landing', 'dynamic', 'spiralApproach', 'breathe', 'spiralApproach');
add('rubberLaunch', 'スリングショット', 'Slingshot', 'dynamic', 'rubberLaunch', 'still', 'rubberLaunch');
add('hopSteps', 'ホッピングステップ', 'Hopping steps', 'dynamic', 'fade', 'hopSteps', 'fade');
add('zigzagStep', 'ジグザグステップ', 'Zigzag steps', 'dynamic', 'fade', 'zigzagStep', 'fade');
add('boomerang', 'ブーメラン', 'Boomerang', 'dynamic', 'boomerang', 'rock', 'boomerang');
add('diagonalSlats', '斜めスリット', 'Diagonal slits', 'mask', 'diagonalSlats', 'still', 'diagonalSlats');
add('radialFan', '扇状オープン', 'Radial fan', 'mask', 'radialFan', 'rotate', 'radialFan');
add('crossOpen', 'クロスオープン', 'Cross reveal', 'mask', 'crossOpen', 'push', 'crossOpen');
add('honeycomb', 'ハニカム出現', 'Honeycomb reveal', 'mask', 'honeycomb', 'still', 'honeycomb');
add('waveCurtain', 'ウェーブカーテン', 'Wave curtain', 'mask', 'waveCurtain', 'still', 'waveCurtain');
add('pixelScatter', 'ピクセル散開', 'Pixel scatter', 'mask', 'pixelScatter', 'still', 'pixelScatter');
add('radialRings', '同心円リビール', 'Concentric reveal', 'mask', 'radialRings', 'breathe', 'radialRings');
add('shutterStrips', '交互シャッター', 'Alternating shutters', 'mask', 'shutterStrips', 'still', 'shutterStrips');
add('chevron', 'シェブロンワイプ', 'Chevron wipe', 'mask', 'chevron', 'still', 'chevron');
add('mosaicDiagonal', '対角モザイク', 'Diagonal mosaic', 'mask', 'mosaicDiagonal', 'still', 'mosaicDiagonal');
add('scanWave', 'ウェーブスライス', 'Wave slices', 'graphic', 'fade', 'still', 'fade', 'scanWave');
add('radialEcho', 'ズーム残響', 'Zoom echoes', 'graphic', 'zoom', 'still', 'shrink', 'radialEcho');
add('fourPanels', '4分割ミラー', 'Four mirror panels', 'graphic', 'curtain', 'still', 'curtain', 'fourPanels');
add('filmstrip', 'フィルムストリップ', 'Film strip', 'graphic', 'fade', 'still', 'fade', 'filmstrip');
add('kaleidoscope', '回転万華鏡', 'Turning kaleidoscope', 'graphic', 'fade', 'still', 'fade', 'kaleidoscope');
add('mirrorPair', 'ミラーデュオ', 'Mirror duo', 'graphic', 'split', 'still', 'split', 'mirrorPair');
add('orbitSatellites', 'サテライト', 'Satellites', 'graphic', 'fade', 'still', 'fade', 'orbitSatellites');
add('pixelMosaic', 'ピクセルモザイク', 'Pixel mosaic', 'graphic', 'fade', 'still', 'fade', 'pixelMosaic');
add('ribbonFold', 'リボン分解', 'Ribbon separation', 'graphic', 'fade', 'still', 'fade', 'ribbonFold');
add('chromaticSplit', 'RGB分離', 'RGB separation', 'graphic', 'fade', 'still', 'fade', 'chromaticSplit');
add('silhouetteInk', 'インクシルエット', 'Ink silhouette', 'texture', 'waveCurtain', 'still', 'waveCurtain', 'silhouetteInk');
add('gradientDuotone', 'グラデーション染め', 'Gradient tint', 'texture', 'fade', 'still', 'fade', 'gradientDuotone');
add('neonContour', 'ネオン輪郭', 'Neon contour', 'texture', 'fade', 'still', 'fade', 'neonContour');
add('spotlightScan', 'ライトスイープ', 'Light sweep', 'texture', 'fade', 'still', 'fade', 'spotlightScan');
add('stipplePrint', 'ドットプリント', 'Dot print', 'texture', 'fade', 'still', 'fade', 'stipplePrint');

const clamp = n => J.clamp(n, 0, 1);
const ease = q => q * q * (3 - 2 * q);
J.mediaVariationState = (cut, p, fade, out, w, h) => {
  const v = { x: 0, y: 0, rotation: 0, scale: 1, alpha: 1 }, t = p * TAU;
  const phase = (type, q, sign) => {
    const a = 1 - ease(clamp(q));
    if (type === 'spiralApproach') {
      v.x += Math.cos(q * TAU * 1.3) * a * w * .45 * sign;
      v.y += Math.sin(q * TAU * 1.3) * a * h * .45;
      v.rotation += a * Math.PI * sign; v.scale *= 1 - a * .7; v.alpha *= clamp(q * 5);
    } else if (type === 'rubberLaunch') {
      const spring = q >= 1 ? 0 : Math.pow(1 - q, 2) * Math.cos(q * 12);
      v.x += spring * w * .8 * sign; v.rotation += spring * .12 * sign; v.alpha *= clamp(q * 6);
    } else if (type === 'boomerang') {
      v.x += a * w * .7 * sign; v.y -= Math.sin(q * Math.PI) * h * .38;
      v.rotation += a * .9 * sign; v.alpha *= clamp(q * 5);
    }
  };
  phase(cut.enter, fade, 1); phase(cut.exit, out, -1);
  switch (cut.hold) {
    case 'arcTravel': v.x += (p - .5) * w * .42; v.y += (.5 - Math.sin(p * Math.PI)) * h * .15; break;
    case 'figureEight': v.x += Math.sin(t) * w * .16; v.y += Math.sin(t * 2) * h * .11; break;
    case 'dollyOrbit': v.x += Math.sin(t) * w * .17; v.y += Math.cos(t) * h * .08; v.scale *= 1 + Math.cos(t) * .16; break;
    case 'hopSteps': v.x += (p - .5) * w * .4; v.y -= Math.abs(Math.sin(t * 1.5)) * h * .18; v.rotation += Math.sin(t * 1.5) * .035; break;
    case 'zigzagStep': {
      const vertices = [[-.25,.12],[-.125,-.12],[0,.12],[.125,-.12],[.25,.12]];
      const index = Math.min(3, Math.floor(p * 4)), q = ease(p * 4 - index);
      v.x += (vertices[index][0] * (1 - q) + vertices[index + 1][0] * q) * w;
      v.y += (vertices[index][1] * (1 - q) + vertices[index + 1][1] * q) * h;
      break;
    }
  }
  return v;
};

J.mediaVariationMask = (ctx, type, q, w, h, seed) => {
  const a = ease(clamp(q)), radius = Math.hypot(w, h) / 2;
  switch (type) {
    case 'diagonalSlats': {
      const spacing = (w + h) / 12, band = spacing * a;
      for (let i = -12; i <= 12; i++) {
        const x = i * spacing; ctx.moveTo(x - h / 2, -h / 2); ctx.lineTo(x - h / 2 + band, -h / 2);
        ctx.lineTo(x + h / 2 + band, h / 2); ctx.lineTo(x + h / 2, h / 2); ctx.closePath();
      } break;
    }
    case 'radialFan':
      for (let i = 0; i < 6; i++) { const angle = i * TAU / 6; ctx.moveTo(0, 0); ctx.arc(0, 0, radius, angle, angle + TAU / 6 * a); ctx.closePath(); } break;
    case 'crossOpen': ctx.rect(-w * a / 2, -h / 2, w * a, h); ctx.rect(-w / 2, -h * a / 2, w, h * a); break;
    case 'honeycomb': {
      const r = Math.min(w, h) / 9, dy = Math.sqrt(3) * r;
      for (let col = -Math.ceil(w / (r * 3)); col <= Math.ceil(w / (r * 3)); col++) for (let row = -Math.ceil(h / dy); row <= Math.ceil(h / dy); row++) {
        const cx = col * r * 1.5, cy = (row + (col % 2) * .5) * dy;
        for (let k = 0; k < 6; k++) { const x = cx + Math.cos(k * TAU / 6) * r * a, y = cy + Math.sin(k * TAU / 6) * r * a; if (!k) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath();
      } break;
    }
    case 'waveCurtain':
      ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(-w / 2 + a * w, -h / 2);
      for (let i = 0; i <= 48; i++) { const y = (i / 48 - .5) * h; ctx.lineTo(-w / 2 + a * w + Math.sin(i / 48 * TAU * 2 + q * 3) * w * .12 * Math.sin(q * Math.PI), y); }
      ctx.lineTo(-w / 2, h / 2); ctx.closePath(); break;
    case 'pixelScatter': {
      const rng = J.rng(J.h(seed, 492));
      for (let y = 0; y < 9; y++) for (let x = 0; x < 12; x++) {
        const s = clamp(q * 2 - rng() * .95), dx = w / 12, dy = h / 9;
        ctx.rect(-w / 2 + (x + (1 - s) / 2) * dx, -h / 2 + (y + (1 - s) / 2) * dy, dx * s, dy * s);
      } break;
    }
    case 'radialRings':
      for (let i = 0; i < 8; i++) { const r = (i + 1) * radius / 8, inner = Math.max(0, r - radius / 8 * a); ctx.moveTo(r, 0); ctx.arc(0, 0, r, 0, TAU); ctx.moveTo(inner, 0); ctx.arc(0, 0, inner, 0, TAU, true); } break;
    case 'shutterStrips':
      for (let i = 0; i < 10; i++) ctx.rect(-w / 2 + i * w / 10, i % 2 ? h / 2 - h * a : -h / 2, w / 10, h * a); break;
    case 'chevron': {
      const tip = -w / 2 + a * w * 1.5, tail = tip - w * .5;
      ctx.moveTo(-w, -h / 2); ctx.lineTo(tail, -h / 2); ctx.lineTo(tip, 0); ctx.lineTo(tail, h / 2); ctx.lineTo(-w, h / 2); ctx.closePath(); break;
    }
    case 'mosaicDiagonal':
      for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) {
        const s = ease(clamp(q * 2.8 - (x + y) / 8));
        ctx.rect(-w / 2 + x * w / 10, -h / 2 + y * h / 6, w / 10 * s, h / 6 * s);
      } break;
    default: return false;
  }
  return true;
};

// A fixed scratch pool, bounded independently of cut count and input video dimensions.
const buffers = new Map();
const surface = (name, w, h) => {
  let c = buffers.get(name); if (!c) { c = document.createElement('canvas'); buffers.set(name, c); }
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, w, h); x.imageSmoothingEnabled = true;
  return [c, x];
};
const renderTexture = (source, fit, type, p, amount) => {
  const res = Math.min(1, 1536 / Math.max(...fit));
  const [c, x] = surface('texture', fit[0] * res, fit[1] * res), w = c.width, h = c.height;
  x.drawImage(source, 0, 0, w, h);
  x.globalCompositeOperation = 'source-atop';
  if (type === 'silhouetteInk') { x.globalAlpha = amount; x.fillStyle = '#eef3ff'; x.fillRect(0, 0, w, h); }
  if (type === 'gradientDuotone') {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#51f6ff'); g.addColorStop(.5 + Math.sin(p * TAU) * .2, '#8966ff'); g.addColorStop(1, '#ff5fa6');
    x.globalAlpha = amount; x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
  if (type === 'spotlightScan') {
    const center = (-.25 + p * 1.5) * w, g = x.createLinearGradient(center - w * .22, 0, center + w * .22, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(255,255,255,${amount * .9})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
  if (type === 'stipplePrint') {
    const step = Math.max(w, h) / 48; x.globalAlpha = amount * .8; x.fillStyle = '#0d1530';
    for (let y = step / 2; y < h; y += step) for (let col = 0; col < Math.ceil(w / step); col++) { const xx = (col + .5) * step; x.beginPath(); x.arc(xx, y, step * (.15 + .26 * (Math.sin(xx / w * 5 + p * TAU) + 1) / 2), 0, TAU); x.fill(); }
  }
  if (type === 'neonContour') {
    // Form an outline from the source alpha; no solid canvas rectangle is introduced.
    x.globalCompositeOperation = 'source-in'; x.fillStyle = '#75f4ff'; x.fillRect(0, 0, w, h);
    const [outline, ox] = surface('outline', w, h), r = Math.max(1, w * .004);
    for (let i = 0; i < 8; i++) ox.drawImage(c, Math.cos(i * TAU / 8) * r, Math.sin(i * TAU / 8) * r);
    ox.globalCompositeOperation = 'destination-out'; ox.drawImage(source, 0, 0, w, h); ox.globalCompositeOperation = 'source-over';
    x.globalCompositeOperation = 'copy'; x.globalAlpha = 1; x.drawImage(source, 0, 0, w, h);
    x.globalCompositeOperation = 'source-atop'; x.globalAlpha = amount * .82; x.fillStyle = '#071327'; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = amount;
    x.filter = `blur(${w * .008}px)`; x.drawImage(outline, 0, 0); x.filter = 'none'; x.drawImage(outline, 0, 0);
  }
  return c;
};

J.drawMediaVariation = (ctx, source, fit, cut, p, amount) => {
  const type = cut.treat;
  if (!['scanWave', 'radialEcho', 'fourPanels', 'filmstrip', 'kaleidoscope', 'mirrorPair', 'orbitSatellites', 'pixelMosaic', 'ribbonFold', 'chromaticSplit', 'silhouetteInk', 'gradientDuotone', 'neonContour', 'spotlightScan', 'stipplePrint'].includes(type) || amount <= 0) return false;
  const [w, h] = fit, t = p * TAU;
  const draw = (x = 0, y = 0, scale = 1, rotation = 0, flip = false) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(flip ? -scale : scale, scale); ctx.drawImage(source, -w / 2, -h / 2, w, h); ctx.restore();
  };
  const strip = (i, count, dx, rotation = 0) => {
    ctx.save(); ctx.translate(dx, 0); ctx.rotate(rotation); ctx.beginPath(); ctx.rect(-w / 2, -h / 2 + i * h / count, w, h / count + .25); ctx.clip(); draw(); ctx.restore();
  };
  ctx.save();
  if (['fourPanels', 'filmstrip', 'kaleidoscope', 'mirrorPair', 'orbitSatellites'].includes(type) && amount < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - amount; draw(); ctx.restore(); ctx.globalAlpha *= amount;
  }
  if (type === 'scanWave') {
    for (let i = 0; i < 48; i++) strip(i, 48, Math.sin(i / 48 * TAU * 2 + t * 2) * w * .075 * amount);
  } else if (type === 'ribbonFold') {
    for (let i = 0; i < 10; i++) strip(i, 10, Math.sin(t + i * .6) * w * .1 * amount, Math.sin(t + i * .4) * .045 * amount);
  } else if (type === 'radialEcho') {
    for (let i = 4; i > 0; i--) { ctx.save(); ctx.globalAlpha *= .14 * amount * (1 - p); draw(0, 0, 1 + i * .09 * amount); ctx.restore(); } draw();
  } else if (type === 'fourPanels') {
    for (const y of [-1, 1]) for (const x of [-1, 1]) draw(x * w * .255 * amount, y * h * .255 * amount, 1 - amount * .53, 0, x < 0);
  } else if (type === 'filmstrip') {
    ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
    for (let i = -2; i <= 2; i++) draw((i - p) * w * .38, 0, .34);
    ctx.restore();
  } else if (type === 'kaleidoscope') {
    for (let i = 0; i < 6; i++) { const angle = i * TAU / 6 + t * .22; draw(Math.cos(angle) * w * .27, Math.sin(angle) * h * .27, .34, angle, i % 2 === 0); }
  } else if (type === 'mirrorPair') {
    const dx = (.22 + Math.sin(t) * .05) * w; draw(-dx, 0, .55, 0, true); draw(dx, 0, .55);
  } else if (type === 'orbitSatellites') {
    draw(0, 0, .65);
    for (let i = 0; i < 3; i++) { const angle = t + i * TAU / 3; ctx.save(); ctx.globalAlpha *= amount; draw(Math.cos(angle) * w * .38, Math.sin(angle) * h * .38, .19); ctx.restore(); }
  } else if (type === 'pixelMosaic') {
    const pixels = 12 + Math.round((1 - amount) * 100 + (1 + Math.sin(t)) * 8);
    const [c, x] = surface('mosaic', pixels, pixels * h / w); x.drawImage(source, 0, 0, c.width, c.height);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(c, -w / 2, -h / 2, w, h); ctx.restore();
  } else if (type === 'chromaticSplit') {
    const res = Math.min(1, 1024 / Math.max(w, h));
    for (const [i, color] of [[-1, '#ff405c'], [1, '#43e9ff']]) {
      const [c, x] = surface('channel', w * res, h * res); x.drawImage(source, 0, 0, c.width, c.height); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
      ctx.save(); ctx.globalAlpha *= .65 * amount; ctx.drawImage(c, -w / 2 + i * (.02 + .025 * Math.sin(t)) * w * amount, -h / 2, w, h); ctx.restore();
    } draw();
  } else ctx.drawImage(renderTexture(source, fit, type, p, amount), -w / 2, -h / 2, w, h);
  ctx.restore(); return true;
};
})();
