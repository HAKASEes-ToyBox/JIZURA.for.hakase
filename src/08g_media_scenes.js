/* Third media pack: phases, camera moves, beat motions, textures and panels.
   Everything is time/seed driven and keeps the source alpha (no solid fills). */
(() => {
'use strict';
const L = J.mediaLabel, TAU = Math.PI * 2;
const clamp = n => J.clamp(n, 0, 1), ease = q => q * q * (3 - 2 * q), mod = (n, d) => ((n % d) + d) % d;
const bounce = q => {
  const n = 7.5625, d = 2.75;
  if (q < 1 / d) return n * q * q;
  if (q < 2 / d) return n * (q -= 1.5 / d) * q + .75;
  if (q < 2.5 / d) return n * (q -= 2.25 / d) * q + .9375;
  return n * (q -= 2.625 / d) * q + .984375;
};
const elastic = q => q <= 0 ? 0 : q >= 1 ? 1 : Math.pow(2, -10 * q) * Math.sin((q * 10 - .75) * TAU / 3) + 1;
const songTime = (cut, p) => (cut.start || 0) + p * ((cut.end || 0) - (cut.start || 0));
J.MEDIA_SCENE_KEYS = [];
const add = (key, def) => { J.MEDIA_SCENE_KEYS.push(key); J.MEDIA_TECH[key] = Object.assign({ enter: 'fade', hold: 'still', exit: 'fade', treat: 'none', trans: 'none' }, def); };

// Entrances / exits. Mask motions are clipped by mediaVariationMask below.
for (const [motion, ja, en, exitJa, exitEn] of [
  ['dropBounce', '落下バウンド', 'Drop and bounce', 'バウンドして落下', 'Bounce and drop'],
  ['elasticZoom', 'エラスティックズーム', 'Elastic zoom'],
  ['swirl', '渦巻き', 'Swirl'],
  ['foldUp', '起き上がり', 'Fold up', '折りたたみ', 'Fold down'],
  ['flicker', '明滅', 'Flicker'],
  ['shakeIn', 'シェイク', 'Shake'],
  ['stretchSnap', 'ゴムスナップ', 'Rubber snap'],
  ['clockReveal', '時計回りリビール', 'Clock reveal'],
  ['starIris', '星形アイリス', 'Star iris'],
  ['heartIris', 'ハート形アイリス', 'Heart iris'],
  ['randomBars', 'ランダムバー', 'Random bars'],
  ['brushStroke', '筆ストローク', 'Brush strokes'],
  ['dotGrid', '水玉リビール', 'Polka-dot reveal'],
  ['diagonalSplit', '対角スプリット', 'Diagonal split'],
]) for (const stage of ['enter', 'exit']) {
  const name = stage === 'enter' ? L('登場：', 'Enter: ') + L(ja, en) : L('退場：', 'Exit: ') + L(exitJa || ja, exitEn || en);
  add(stage + '_' + motion, { name, group: stage, stage, motion, enter: stage === 'enter' ? motion : 'cut', exit: stage === 'exit' ? motion : 'cut' });
}
// Main techniques. Periodic motions run on the beat clock like the rhythm pack.
for (const [key, ja, en, group, extra] of [
  ['kenBurns', 'ケン・バーンズ', 'Ken Burns', 'cinema'],
  ['dutchTilt', 'ダッチアングル', 'Dutch angle', 'cinema'],
  ['craneUp', 'クレーン上昇', 'Crane up', 'cinema'],
  ['handheld', '手持ちカメラ', 'Handheld camera', 'cinema'],
  ['rollAcross', 'ローリング横断', 'Roll across', 'dynamic'],
  ['slamZoom', 'スラムズーム', 'Slam zoom', 'dynamic'],
  ['turnOnce', 'ゆっくり1回転', 'Slow full turn', 'dynamic'],
  ['zoomStages', '3段ズーム', 'Three-step zoom', 'dynamic'],
  ['beatJelly', 'ビート・ゼリー', 'Beat jelly', 'bpm', { enter: 'cut', exit: 'cut' }],
  ['beatKick', 'キック・ズームアウト', 'Kick zoom out', 'bpm', { enter: 'cut', exit: 'cut' }],
  ['beatTilt', '拍ごとに左右傾き', 'Beat tilt', 'bpm', { enter: 'cut', exit: 'cut' }],
  ['beatSlide', '拍ごとに左右スライド', 'Beat side slide', 'bpm', { enter: 'cut', exit: 'cut' }],
  ['beatFlip', '4拍フリップ', 'Four-beat flip', 'bpm', { enter: 'cut', exit: 'cut' }],
  ['beatBounceWall', 'ビート・反射移動', 'Beat wall bounce', 'bpm', { enter: 'cut', exit: 'cut' }],
  ['beatDrop', '8拍ビルドアップ', 'Eight-beat build-up', 'bpm', { enter: 'cut', exit: 'cut' }],
]) add(key, Object.assign({ name: L(ja, en), group, hold: key }, extra));
for (const [key, ja, en, group] of [
  ['lightLeak', 'ライトリーク', 'Light leak', 'texture'],
  ['filmGrain', 'フィルムグレイン', 'Film grain', 'texture'],
  ['vignette', 'ビネット', 'Vignette', 'texture'],
  ['hueCycle', '色相サイクル', 'Hue cycle', 'texture'],
  ['scanlines', 'ブラウン管', 'CRT scanlines', 'texture'],
  ['thermal', 'サーモグラフィ', 'Thermal', 'texture'],
  ['softBloom', 'ソフトブルーム', 'Soft bloom', 'texture'],
  ['cyanotype', '青写真', 'Cyanotype', 'texture'],
  ['zoomTunnel', 'ズームトンネル', 'Zoom tunnel', 'graphic'],
  ['tileScroll', 'タイルスクロール', 'Tile scroll', 'graphic'],
  ['columnWave', '縦ウェーブスライス', 'Column wave', 'graphic'],
  ['stutterEcho', 'ストロボ残像', 'Strobe echoes', 'graphic'],
  ['splitShift', '帯ずらし', 'Band shift', 'graphic'],
  ['glassShards', 'ガラス破片', 'Glass shards', 'graphic'],
]) add(key, { name: L(ja, en), group, treat: key });
// Lyric transitions that only composite the two frames (thin accent lines at most);
// ones that paint solid areas, such as inkBlob, stay lyric-only.
J.MEDIA_TRANS_EXTRA_KEYS = [];
for (const [key, ja, en] of [
  ['blinds', 'ブラインド接続', 'Blinds transition'], ['sliceShift', '短冊ずらし接続', 'Slice shift transition'],
  ['pixelate', 'モザイク接続', 'Pixelate transition'],
  ['tyRuleWipe', '罫線ワイプ接続', 'Rule wipe transition'], ['tyGridCells', '升目送り接続', 'Grid cells transition'],
]) {
  J.MEDIA_TRANS_EXTRA_KEYS.push(key);
  add('transition_' + key, { name: L(ja, en), group: 'transition', trans: key });
}

const previousState = J.mediaVariationState;
J.mediaVariationState = (cut, p, fade, out, w, h) => {
  const v = previousState ? previousState(cut, p, fade, out, w, h) : { x: 0, y: 0, rotation: 0, scale: 1, alpha: 1 };
  v.sx = v.sx ?? 1; v.sy = v.sy ?? 1;
  const phase = (type, q, sign) => {
    q = clamp(q); if (q >= 1) return;
    const a = 1 - ease(q);
    switch (type) {
      case 'dropBounce': v.y -= (1 - bounce(q)) * h * 1.1 * sign; v.alpha *= clamp(q * 6); break;
      case 'elasticZoom': v.scale *= Math.max(.001, elastic(q)); v.alpha *= clamp(q * 6); break;
      case 'swirl': v.rotation += sign * a * TAU * 1.25; v.scale *= Math.max(.001, 1 - a * .9); v.x += Math.sin(q * Math.PI) * a * w * .18 * sign; v.alpha *= clamp(q * 3); break;
      case 'foldUp': { const s = Math.max(.001, ease(q)); v.sy *= s; v.y += (1 - s) * h / 2; v.alpha *= clamp(q * 3); break; }
      // Dim "off" frames keep the cut faintly visible, like every other phase.
      case 'flicker': { const f = [.12, .9, .12, .2, .5, 1, .12, .35, 1, .15, 1, .7, 1, 1]; v.alpha *= f[Math.min(f.length - 1, Math.floor(q * f.length))]; break; }
      case 'shakeIn': v.x += Math.sin(q * 57) * a * w * .07; v.y += Math.cos(q * 41) * a * h * .05; v.rotation += Math.sin(q * 33) * a * .05; v.alpha *= clamp(q * 5); break;
      case 'stretchSnap': v.sx *= 1 + a * 2.4; v.sy *= Math.max(.001, 1 - a * .85); v.x += sign * a * w * .55; v.alpha *= clamp(q * 4); break;
    }
  };
  phase(cut.enter, fade, 1); phase(cut.exit, out, -1);
  const seed = cut.seed | 0, e = ease(clamp(p));
  switch (cut.hold) {
    case 'kenBurns': {
      const angle = J.r(seed, 611) * TAU, zoomIn = J.r(seed, 612) < .6;
      v.scale *= zoomIn ? 1.06 + e * .16 : 1.22 - e * .16;
      v.x += Math.cos(angle) * (e - .5) * w * .1; v.y += Math.sin(angle) * (e - .5) * h * .1; break;
    }
    case 'dutchTilt': v.rotation += (J.r(seed, 613) < .5 ? -1 : 1) * (.035 + e * .07); v.scale *= 1.1 + e * .05; break;
    case 'craneUp': v.y += (.5 - e) * h * .2; v.scale *= 1.14 - e * .1; break;
    case 'handheld': {
      const t = songTime(cut, p);
      v.x += (Math.sin(t * 1.7) + .5 * Math.sin(t * 2.9 + 1)) * w * .009; v.y += (Math.sin(t * 2.3 + 2) + .5 * Math.sin(t * 3.7)) * h * .009;
      v.rotation += Math.sin(t * 1.3 + .5) * .007; v.scale *= 1.05; break;
    }
    case 'rollAcross': { const dx = (p - .5) * w * .55; v.x += dx; v.rotation += dx / (Math.min(w, h) / 2); break; }
    case 'slamZoom': { const k = 1 - ease(clamp(p / .12)); v.scale *= 1 + p * .06 + k * .38; v.rotation += k * .06; break; }
    case 'turnOnce': v.rotation += e * TAU; v.scale *= 1 - Math.sin(p * Math.PI) * .12; break;
    case 'zoomStages': {
      const steps = [1, 1.12, 1.26], i = Math.min(2, Math.floor(p * 3)), from = steps[Math.max(0, i - 1)];
      v.scale *= from + (steps[i] - from) * ease(clamp((p * 3 - i) / .25)); break;
    }
  }
  return v;
};

const previousBeat = J.mediaBeatState;
J.mediaBeatState = (cut, p, w, h) => {
  const v = previousBeat(cut, p, w, h);
  v.sx = v.sx ?? 1; v.sy = v.sy ?? 1;
  const beat = (songTime(cut, p) - (cut.beatOffset || 0)) * (cut.bpm || 120) / 60;
  const phase = mod(beat, 1), pulse = Math.exp(-phase * 8), snap = ease(Math.min(1, phase * 4));
  const tri = u => 1 - 4 * Math.abs(mod(u, 1) - .5);
  switch (cut.hold) {
    case 'beatJelly': { const k = pulse * Math.cos(phase * Math.PI * 6); v.sx = 1 + .14 * k; v.sy = 1 / (1 + .14 * k); break; }
    case 'beatKick': v.scale = 1 - .12 * pulse; break;
    case 'beatTilt': { const from = (mod(Math.floor(beat), 2) ? 1 : -1) * .09; v.rotation = from - 2 * from * snap; break; }
    case 'beatSlide': { const from = (mod(Math.floor(beat), 2) ? 1 : -1) * .07; v.x = (from - 2 * from * snap) * w; break; }
    case 'beatFlip': v.sx = Math.max(.02, Math.abs(Math.cos(ease(clamp(mod(beat, 4) - 3)) * Math.PI))); break;
    case 'beatBounceWall': v.x = tri(beat / 4) * w * .14; v.y = tri(beat / 6) * h * .12; break;
    case 'beatDrop': {
      const local = mod(beat, 8);
      v.scale = 1 + .16 * Math.pow(local / 8, 2) + (local < 1 ? .14 * pulse : 0);
      if (local > 7) { v.x = Math.sin(phase * 80) * w * .012; v.y = Math.cos(phase * 67) * h * .012; }
      break;
    }
  }
  return v;
};

const maskState = J.mediaVariationMask;
J.mediaVariationMask = (ctx, type, q, w, h, seed) => {
  const a = ease(clamp(q)), R = Math.hypot(w, h) / 2;
  switch (type) {
    case 'clockReveal': ctx.moveTo(0, 0); ctx.arc(0, 0, R + 2, -Math.PI / 2, -Math.PI / 2 + TAU * a); ctx.closePath(); break;
    case 'starIris': {
      const r = R * a * 1.9, spin = a * .6;
      for (let i = 0; i < 10; i++) { const angle = -Math.PI / 2 + spin + i * Math.PI / 5, k = i % 2 ? .48 : 1; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(angle) * r * k, Math.sin(angle) * r * k); }
      ctx.closePath(); break;
    }
    case 'heartIris': {
      const s = R * a * 1.9 / 16;
      for (let i = 0; i <= 64; i++) {
        const t = i / 64 * TAU, x = 16 * Math.pow(Math.sin(t), 3), y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        ctx[i ? 'lineTo' : 'moveTo'](x * s, (y + 2) * s);
      }
      ctx.closePath(); break;
    }
    case 'randomBars': {
      const n = 16, bw = w / n;
      for (let i = 0; i < n; i++) { const s = ease(clamp(q * 2 - J.r(seed | 0, i, 614))); ctx.rect(-w / 2 + (i + (1 - s) / 2) * bw, -h / 2, bw * s + .5, h); }
      break;
    }
    case 'brushStroke': {
      const n = 5, bh = h / n;
      for (let i = 0; i < n; i++) {
        const s = ease(clamp(q * 1.8 - i * .8 / n)), left = i % 2 === 0;
        ctx.rect(left ? -w / 2 : w / 2 - w * s, -h / 2 + i * bh - .5, w * s, bh + 1);
      }
      break;
    }
    case 'dotGrid': {
      const cols = 12, cell = w / cols, rows = Math.ceil(h / cell);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const cx = -w / 2 + (i + .5) * cell, cy = -h / 2 + (j + .5) * cell, d = Math.hypot(cx / w, cy / h) / .71;
        const r = cell * .75 * ease(clamp(q * 1.6 - d * .6));
        if (r > .1) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU); }
      }
      break;
    }
    case 'diagonalSplit': {
      const D = Math.hypot(w, h), ux = w / D, uy = h / D, d = a * w * h / D * 1.02;
      ctx.moveTo(-ux * D - uy * d, -uy * D + ux * d); ctx.lineTo(ux * D - uy * d, uy * D + ux * d);
      ctx.lineTo(ux * D + uy * d, uy * D - ux * d); ctx.lineTo(-ux * D + uy * d, -uy * D - ux * d); ctx.closePath(); break;
    }
    default: return maskState ? maskState(ctx, type, q, w, h, seed) : false;
  }
  return true;
};

// Bounded scratch canvases, independent of cut count and source size.
const buffers = new Map();
const surface = (name, w, h) => {
  let c = buffers.get(name); if (!c) { c = document.createElement('canvas'); buffers.set(name, c); }
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext('2d', { willReadFrequently: name === 'thermal' }); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, w, h); x.imageSmoothingEnabled = true;
  return [c, x];
};
let noise = null;
const noiseTile = () => {
  if (noise) return noise;
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d'), img = g.createImageData(160, 160), rnd = J.rng(615);
  for (let i = 0; i < img.data.length; i += 4) { const v = rnd() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0); return noise = c;
};
const THERMAL = [[0, [12, 0, 60]], [.25, [96, 0, 170]], [.45, [230, 30, 90]], [.65, [255, 140, 0]], [.85, [255, 238, 70]], [1, [255, 255, 255]]];
const thermalColor = l => {
  let i = 1; while (i < THERMAL.length - 1 && l > THERMAL[i][0]) i++;
  const [p0, c0] = THERMAL[i - 1], [p1, c1] = THERMAL[i], k = clamp((l - p0) / (p1 - p0));
  return [0, 1, 2].map(n => c0[n] + (c1[n] - c0[n]) * k);
};
const TEXTURES = new Set(['lightLeak', 'filmGrain', 'vignette', 'hueCycle', 'scanlines', 'thermal', 'softBloom', 'cyanotype']);
const renderTexture = (source, fit, cut, p, amount) => {
  const type = cut.treat, res = Math.min(1, (type === 'thermal' ? 480 : 1536) / Math.max(...fit));
  const [c, x] = surface(type === 'thermal' ? 'thermal' : 'texture', fit[0] * res, fit[1] * res), w = c.width, h = c.height;
  const t = songTime(cut, p), seed = cut.seed | 0;
  // Blend, then trim back to the source alpha so transparent areas stay clear.
  const trim = () => { x.globalAlpha = 1; x.filter = 'none'; x.globalCompositeOperation = 'destination-in'; x.drawImage(source, 0, 0, w, h); };
  switch (type) {
    case 'lightLeak': {
      x.drawImage(source, 0, 0, w, h); x.globalCompositeOperation = 'screen';
      for (const [k, color] of [[0, '255,140,60'], [1, '255,60,130']]) {
        const cx = w * (-.2 + 1.4 * mod(p * .8 + J.r(seed, 616, k) + k * .5, 1)), cy = h * (.2 + .6 * J.r(seed, 617, k)), r = Math.max(w, h) * .55;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(${color},${.75 * amount})`); g.addColorStop(1, `rgba(${color},0)`);
        x.fillStyle = g; x.fillRect(0, 0, w, h);
      }
      trim(); break;
    }
    case 'filmGrain': {
      x.filter = `sepia(${.35 * amount}) contrast(${1 + .1 * amount})`; x.drawImage(source, 0, 0, w, h); x.filter = 'none';
      const frame = Math.floor(t * 24), tile = noiseTile(), size = 160, ox = J.r(frame, 618) * size, oy = J.r(frame, 619) * size;
      x.globalCompositeOperation = 'overlay'; x.globalAlpha = .45 * amount;
      for (let yy = -oy; yy < h; yy += size) for (let xx = -ox; xx < w; xx += size) x.drawImage(tile, xx, yy);
      if (J.r(frame, 620) < .35) { x.globalCompositeOperation = 'source-over'; x.globalAlpha = .35 * amount; x.fillStyle = '#f4ecd8'; x.fillRect(J.r(frame, 621) * w, 0, Math.max(1, w / 900), h); }
      trim(); break;
    }
    case 'vignette': {
      x.drawImage(source, 0, 0, w, h); x.globalCompositeOperation = 'source-atop';
      const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .25, w / 2, h / 2, Math.hypot(w, h) / 2);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${.82 * amount})`); x.fillStyle = g; x.fillRect(0, 0, w, h); break;
    }
    case 'hueCycle': x.filter = `hue-rotate(${Math.round(p * 540 * amount) % 360}deg) saturate(${1 + .35 * amount})`; x.drawImage(source, 0, 0, w, h); break;
    case 'scanlines': {
      x.filter = `contrast(${1 + .15 * amount}) saturate(${1 + .2 * amount})`; x.drawImage(source, 0, 0, w, h); x.filter = 'none';
      x.globalCompositeOperation = 'source-atop'; x.fillStyle = `rgba(0,0,0,${.38 * amount})`;
      const step = Math.max(2, h / 180); for (let y = 0; y < h; y += step * 2) x.fillRect(0, y, w, step);
      const band = mod(t * .25, 1) * h * 1.3 - h * .15, g = x.createLinearGradient(0, band - h * .08, 0, band + h * .08);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(255,255,255,${.14 * amount})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, band - h * .08, w, h * .16); break;
    }
    case 'thermal': {
      x.drawImage(source, 0, 0, w, h);
      try {
        const img = x.getImageData(0, 0, w, h), d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          if (!d[i + 3]) continue;
          const col = thermalColor((d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114) / 255);
          for (let n = 0; n < 3; n++) d[i + n] += (col[n] - d[i + n]) * amount;
        }
        x.putImageData(img, 0, 0);
      } catch { x.clearRect(0, 0, w, h); x.filter = `invert(${amount}) hue-rotate(${180 * amount}deg) saturate(${1 + 2 * amount})`; x.drawImage(source, 0, 0, w, h); }
      break;
    }
    case 'softBloom': {
      x.filter = `brightness(${1 + .06 * amount})`; x.drawImage(source, 0, 0, w, h);
      x.globalCompositeOperation = 'lighter'; x.globalAlpha = .45 * amount; x.filter = `blur(${Math.max(1, w * .012)}px)`; x.drawImage(source, 0, 0, w, h); break;
    }
    case 'cyanotype': {
      x.filter = `grayscale(${amount}) contrast(${1 + .2 * amount})`; x.drawImage(source, 0, 0, w, h); x.filter = 'none';
      x.globalAlpha = amount; x.globalCompositeOperation = 'multiply'; x.fillStyle = '#3d6fd1'; x.fillRect(0, 0, w, h);
      x.globalAlpha = amount * .6; x.globalCompositeOperation = 'screen'; x.fillStyle = '#0b1f4a'; x.fillRect(0, 0, w, h);
      trim(); break;
    }
  }
  return c;
};
const PANELS = new Set(['zoomTunnel', 'tileScroll', 'columnWave', 'stutterEcho', 'splitShift', 'glassShards']);
const previousDraw = J.drawMediaVariation;
J.drawMediaVariation = (ctx, source, fit, cut, p, amount) => {
  const type = cut.treat;
  if ((!TEXTURES.has(type) && !PANELS.has(type)) || amount <= 0) return previousDraw ? previousDraw(ctx, source, fit, cut, p, amount) : false;
  const [w, h] = fit, t = p * TAU, seed = cut.seed | 0;
  if (TEXTURES.has(type)) { ctx.drawImage(renderTexture(source, fit, cut, p, amount), -w / 2, -h / 2, w, h); return true; }
  const draw = (x = 0, y = 0, scale = 1, rotation = 0) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(scale, scale); ctx.drawImage(source, -w / 2, -h / 2, w, h); ctx.restore(); };
  const band = (x0, y0, bw, bh, dx, dy) => { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, bw, bh); ctx.clip(); draw(dx, dy); ctx.restore(); };
  ctx.save();
  if (amount < 1) { ctx.save(); ctx.globalAlpha *= 1 - amount; draw(); ctx.restore(); ctx.globalAlpha *= amount; }
  if (type === 'zoomTunnel') {
    ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
    const f = mod(p * 1.5, 1);
    // Enlarged copies fade before the frame clip can show a hard edge.
    for (let k = 2; k >= -5; k--) {
      const s = Math.pow(1.7, k - f); if (s > 2.2 || s < .03) continue;
      ctx.save(); ctx.globalAlpha *= clamp((s - .03) / .1) * clamp((2.2 - s) / .9); draw(0, 0, s); ctx.restore();
    }
  } else if (type === 'tileScroll') {
    ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
    const tw = w / 3, th = h / 3, o = mod(p * 1.5, 1);
    for (let j = -1; j <= 3; j++) for (let i = -1; i <= 3; i++) draw(-w / 2 + (i + .5 + o) * tw, -h / 2 + (j + .5 + o) * th, 1 / 3);
  } else if (type === 'columnWave') {
    const n = 40; for (let i = 0; i < n; i++) band(-w / 2 + i * w / n, -h, w / n + .25, h * 2, 0, Math.sin(i / n * TAU * 2 + t * 2) * h * .06);
  } else if (type === 'stutterEcho') {
    const at = k => Math.sin(t * 2 - k * .35) * w * .06;
    for (let k = 4; k > 0; k--) { ctx.save(); ctx.globalAlpha *= .5 * (1 - k / 5); draw(at(k)); ctx.restore(); }
    draw(at(0));
  } else if (type === 'splitShift') {
    const dx = Math.sin(t * 1.5) * w * .08; for (let i = 0; i < 3; i++) band(-w, -h / 2 + i * h / 3, w * 2, h / 3 + .25, i % 2 ? -dx : dx, 0);
  } else if (type === 'glassShards') {
    const cols = 5, rows = 4, cw = w / cols, ch = h / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) for (let k = 0; k < 2; k++) {
      const x0 = -w / 2 + i * cw, y0 = -h / 2 + j * ch, pts = k ? [[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch]] : [[x0, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]];
      const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3, sway = .6 + .4 * Math.sin(t + J.r(seed, i, j, k) * 6);
      const dx = J.rs(seed, i, j, k, 1) * w * .018 * sway, dy = J.rs(seed, i, j, k, 2) * h * .018 * sway, rot = J.rs(seed, i, j, k, 3) * .03 * sway;
      ctx.save(); ctx.beginPath(); ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy); ctx.lineTo(pts[1][0] + dx, pts[1][1] + dy); ctx.lineTo(pts[2][0] + dx, pts[2][1] + dy); ctx.closePath(); ctx.clip();
      ctx.translate(cx + dx, cy + dy); ctx.rotate(rot); ctx.drawImage(source, -w / 2 - cx, -h / 2 - cy, w, h); ctx.restore();
    }
  }
  ctx.restore(); return true;
};
})();
