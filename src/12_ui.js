/* ============================================================
   JIZURA — editor UI
   ============================================================ */
(() => {
'use strict';
if (!document.getElementById('app')) return;          // engine-only pages (tests)
const $ = id => document.getElementById(id);
const LS_KEY = 'jizura.project.v1';
const HUD_CHARS = '0123456789:./-_()【】・No.LYRICRECUNTITLEDXYlinebpminterlude—─／ ';
const ICON = {
  dice: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor"/><circle cx="10.5" cy="10.5" r="1" fill="currentColor"/><circle cx="10.5" cy="5.5" r="1" fill="currentColor"/><circle cx="5.5" cy="10.5" r="1" fill="currentColor"/></svg>',
  lock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>',
};

const S = { project: null, plan: null, audio: null, renderer: new J.Renderer(), playing: false, t: 0, t0: 0, loop: true, need: true, exporting: null, tap: null, slow: false, lineEls: [], curLine: -2, timelineZoom: 1.0, timelineScroll: 0, tlDrag: null, selectedBlock: null };
window.S = S;

/* WebAudio player (works inside sandboxed pages where blob media may be blocked) */
const AP = {
  ctx: null, src: null, startAt: 0, gain: null, vol: 0.8, muted: false,
  play(buffer, offset) {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stop();
    if (!this.gain) { this.gain = this.ctx.createGain(); this.gain.connect(this.ctx.destination); this.applyVol(); }
    const s = this.ctx.createBufferSource(); s.buffer = buffer; s.connect(this.gain);
    const off = Math.max(0, Math.min(offset, buffer.duration - 0.01));
    s.start(0, off); this.src = s; this.startAt = this.ctx.currentTime - off;
  },
  stop() { if (this.src) { try { this.src.stop(); } catch (e) {} try { this.src.disconnect(); } catch (e) {} this.src = null; } },
  time() { return this.ctx ? this.ctx.currentTime - this.startAt : 0; },
  /* preview volume only (exports keep the original level) */
  setVol(v, muted) { if (v != null) this.vol = Math.max(0, Math.min(1, v)); if (muted != null) this.muted = !!muted; this.applyVol(); },
  applyVol() { if (!this.gain) return; const v = this.muted ? 0 : this.vol * this.vol; try { this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.015); } catch (e) { this.gain.gain.value = v; } },
};
/* プレビュー音量: remembered per browser */
function initVolume() {
  const el = $('vol'), mb = $('btnMute'); if (!el || !mb) return;
  let v = 0.8, m = false;
  try { const o = JSON.parse(localStorage.getItem('jizura.previewVolume') || 'null'); if (o) { v = +o.v; m = !!o.m; } } catch (e) {}
  if (!(v >= 0 && v <= 1)) v = 0.8;
  const show = () => { el.value = Math.round(AP.vol * 100); mb.textContent = AP.muted || AP.vol === 0 ? '消音' : '音量'; mb.setAttribute('aria-pressed', String(AP.muted)); el.title = '音量 ' + Math.round(AP.vol * 100) + '%'; };
  const save = () => { try { localStorage.setItem('jizura.previewVolume', JSON.stringify({ v: AP.vol, m: AP.muted })); } catch (e) {} };
  AP.setVol(v, m); show();
  el.addEventListener('input', () => { AP.setVol(el.value / 100, false); show(); save(); });
  mb.addEventListener('click', () => { AP.setVol(null, !AP.muted); show(); save(); });
}

/* ---------------- project persistence ---------------- */
function mergeProject(p) {
  const d = J.defaultProject();
  const o = Object.assign(d, p || {});
  o.fx = Object.assign(J.defaultProject().fx, (p && p.fx) || {});
  o.timing = Object.assign(J.defaultProject().timing, (p && p.timing) || {});
  o.bgMedia = Object.assign(J.defaultProject().bgMedia || {}, (p && p.bgMedia) || {});
  const en = J.defaultProject().enabled;
  for (const g of Object.keys(en)) en[g] = Object.assign(en[g], ((p && p.enabled) || {})[g] || {});
  o.enabled = en;
  o.overrides = (p && p.overrides) || {};
  o.rowCache = (p && p.rowCache) || {};
  o.colors = Object.assign({ enabled: false }, (p && p.colors) || {});
  o.fonts = (p && p.fonts) || {};
  o.userFonts = (p && p.userFonts) || [];
  for (const uf of o.userFonts) if (!J.FONTS[uf.key]) J.addUserFont(uf.key, uf.label, uf.family, uf.weight || 400);
  return o;
}
function setBadges(d) {
  return (d && d.extra ? '<span class="set-badge ex" title="最初の公開版のあとに追加">追加</span>' : '') + (d && d.wa ? '<span class="set-badge" title="和風の演出">和</span>' : '');
}
function loadLocal() { try { const s = localStorage.getItem(LS_KEY); if (s) return mergeProject(JSON.parse(s)); } catch (e) {} return mergeProject(null); }
let saveTimer = 0;
function autosave() { clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 700); }
function flushSave() { clearTimeout(saveTimer); try { localStorage.setItem(LS_KEY, JSON.stringify(S.project)); } catch (e) {} }
window.addEventListener('pagehide', () => { if (S.project) flushSave(); });

/* ---------------- planning ---------------- */
function audioLike() {
  const T = S.project.timing;
  if (S.audio) {
    const a = Object.assign({}, S.audio);
    if (T.bpm > 0) a.beats = J.beatGrid(T.bpm, T.beatOffset || 0, S.audio.duration);
    return a;
  }
  if (T.bpm > 0) return { beats: J.beatGrid(T.bpm, T.beatOffset || 0, 600) };
  return null;
}
/* 自動判定のとき、判定結果を言語欄の横に出す */
function langNote() {
  const el = $('langNote'); if (!el) return;
  el.textContent = (S.project.lang || 'auto') === 'auto' ? '→ ' + J.LANG_LABEL[J.resolveLang(S.project)] : '';
  if (langNote.last !== undefined && langNote.last !== J.lang) { try { renderFontRoles(); } catch (e) {} }   // font menus show the language's faces
  langNote.last = J.lang;
}
function replan() {
  S.plan = J.plan(S.project, audioLike());
  if (S.project.timing && Array.isArray(S.project.timing.cutTimes) && S.project.timing.cutTimes.length > 0) {
    const ct = S.project.timing.cutTimes;
    S.plan.cuts.forEach((cut, i) => {
      if (ct[i] && typeof ct[i].start === 'number' && typeof ct[i].end === 'number') {
        cut.start = ct[i].start;
        cut.end = ct[i].end;
        cut.dur = Math.max(0.01, cut.end - cut.start);
      }
    });
    if (S.plan.lines) {
      S.plan.lines.forEach(ln => {
        const lnCuts = S.plan.cuts.filter(c => c.line === ln.index);
        if (lnCuts.length) {
          ln.start = lnCuts[0].start;
          ln.end = lnCuts[lnCuts.length - 1].end;
          ln.visEnd = ln.end;
        }
      });
    }
    if (S.plan.titleLine && S.plan.cuts.length && S.plan.cuts[0].line === -1) {
      S.plan.titleLine.start = S.plan.cuts[0].start;
      S.plan.titleLine.end = S.plan.cuts[0].end;
    }
  }
  langNote();
  if (S.t > S.plan.duration) S.t = 0;
  renderLines(); sizeViewport(); drawTimeline(); updateTimeUI(); updateCutInfo();
  S.need = true; autosave(); ensureFonts(); drawSwatch(); showNow();
  clearTimeout(warmTimer); warmTimer = setTimeout(warm, 450);
}
/* pre-decompose glyphs used by piece animations while the editor is idle, so playback does not hitch */
let warmTimer = 0, warmJob = 0;
function warm() {
  const job = ++warmJob;
  const cuts = S.plan.cuts.filter(c => c.enter === 'assemble' || ['explode', 'fall', 'drift'].includes(c.exit));
  const src = $('view');
  const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const ctx = cv.getContext('2d');
  let i = 0;
  const idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 400 }) : (f) => setTimeout(() => f(null), 40);
  const step = (deadline) => {
    if (job !== warmJob || S.exporting) return;
    do {
      const c = cuts[i++]; if (!c) break;
      const ts = [];
      if (c.enter === 'assemble') ts.push(c.start + Math.min(c.inDur * 0.3, c.dur * 0.2));
      if (c.outDur > 0) ts.push(c.end - c.outDur * 0.5);
      for (const t of ts) { try { S.renderer.frame(ctx, S.plan, t, { scale: cv.width / S.plan.W, fast: true, noHud: true, noGhost: true }); } catch (e) {} }
    } while (i < cuts.length && deadline && deadline.timeRemaining() > 10);
    if (i < cuts.length) idle(step);
  };
  idle(step);
}
let replanTimer = 0;
const replanSoon = (ms = 220) => { clearTimeout(replanTimer); replanTimer = setTimeout(replan, ms); };
let fontKey = '';
let thumbFonts = null;
async function ensureFonts() {
  const txt = S.project.lyrics + (S.project.title || '') + (S.project.artist || '') + HUD_CHARS;
  const keys = J.fontsOfPlan(S.plan);                       // only the faces this plan draws with
  const key = txt + '|' + keys.join(',') + '|' + Object.keys(J.FONTS).length;
  if (key === fontKey) return;
  fontKey = key;
  showMsg('フォントを読み込み中…');
  try { await J.ensureFonts(txt, keys); } catch (e) {}
  showMsg(null); S.need = true; drawStyleGrid(); loadThumbFonts();
}
// style thumbnails need two glyphs of every style's display face — fetched only once the style grid is actually shown
function loadThumbFonts() {
  if (thumbFonts || !$('styleGrid').offsetParent) return;
  thumbFonts = J.ensureFonts('字面', [...new Set(J.STYLE_ORDER.map(k => J.STYLES[k].fonts.display[0]))]).then(() => drawStyleGrid()).catch(() => {});
}
function showMsg(m) { const el = $('viewMsg'); if (!m) { el.hidden = true; return; } el.textContent = m; el.hidden = false; }

/* ---------------- viewport & drawing ---------------- */
function sizeViewport() {
  const vp = $('viewport'), c = $('view');
  const ar = S.plan.W / S.plan.H;
  let cssW = vp.clientWidth || 800, cssH = cssW / ar;
  const maxH = Math.max(220, window.innerHeight * 0.68);
  if (cssH > maxH) { cssH = maxH; cssW = cssH * ar; }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.round(Math.min(S.plan.W, cssW * dpr)), ph = Math.round(pw / ar);
  if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
  c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
  S.need = true;
}
function draw() {
  const c = $('view'), ctx = c.getContext('2d');
  const t0 = performance.now();
  S.renderer.frame(ctx, S.plan, S.t, { scale: c.width / S.plan.W, fast: S.playing && S.slow });
  const dt = performance.now() - t0;
  S.slow = S.playing ? (dt > 30 ? true : dt < 14 ? false : S.slow) : false;
  updateTimeUI(); drawTimeline(); updateCutInfo(); syncBlockInspector();
}
function tick(now) {
  requestAnimationFrame(tick);
  if (S.exporting) return;
  if (S.playing) {
    // rAF timestamps can precede the moment play()/seek() stamped t0 → clamp so t never goes negative
    let t = Math.max(0, S.audio ? AP.time() : (now - S.t0) / 1000);
    if (t >= S.plan.duration - 1e-3) {
      if (S.loop && !S.tap) { seek(0); t = 0; }
      else { pause(); t = S.plan.duration - 1e-3; if (S.tap) stopTap(); }
    }
    S.t = t; S.need = true;
  }
  if (S.playing && typeof J !== 'undefined' && J.bgMedia && J.bgMedia.type === 'video') S.need = true;
  if (S.need) { S.need = false; draw(); }
}
function updateTimeUI() {
  $('timeNow').textContent = J.fmtTime(S.t);
  $('timeDur').textContent = J.fmtTime(S.plan.duration);
  if (!S.scrubbing) $('scrub').value = String(Math.round(S.t / Math.max(0.001, S.plan.duration) * 10000));
}
function play() {
  if (S.audio) AP.play(S.audio.buffer, S.t);
  else S.t0 = performance.now() - S.t * 1000;
  if (typeof J !== 'undefined' && J.bgMedia && J.bgMedia.element && J.bgMedia.element.play) {
    const v = J.bgMedia.element;
    if (isFinite(v.duration) && v.duration > 0) v.currentTime = S.t % v.duration;
    v.play().catch(() => {});
  }
  S.playing = true; $('btnPlay').textContent = '❚❚'; $('btnPlay').setAttribute('aria-label', '一時停止');
}
function pause() {
  S.playing = false; AP.stop();
  if (typeof J !== 'undefined' && J.bgMedia && J.bgMedia.element && J.bgMedia.element.pause) {
    J.bgMedia.element.pause();
  }
  $('btnPlay').textContent = '▶'; $('btnPlay').setAttribute('aria-label', '再生'); S.need = true;
}
function seek(t) {
  S.t = J.clamp(t, 0, Math.max(0, S.plan.duration - 1e-3));
  if (typeof J !== 'undefined' && J.bgMedia && J.bgMedia.element && isFinite(J.bgMedia.element.duration) && J.bgMedia.element.duration > 0) {
    J.bgMedia.element.currentTime = S.t % J.bgMedia.element.duration;
  }
  if (S.audio) { if (S.playing) AP.play(S.audio.buffer, S.t); }
  else S.t0 = performance.now() - S.t * 1000;
  S.need = true;
}

/* ---------------- timeline ---------------- */
const layoutHue = k => (J.LAYOUT_ORDER.indexOf(k) * 37 + 30) % 360;

const tlVisSec = () => Math.max(0.1, (S.plan ? S.plan.duration : 10) / Math.max(1, S.timelineZoom || 1));
const tlTimeFromPx = (px, w) => {
  const vis = tlVisSec();
  return Math.max(0, Math.min(S.plan ? S.plan.duration : 0, (px / w) * vis + S.timelineScroll));
};
const tlPxFromTime = (t, w) => {
  const vis = tlVisSec();
  return ((t - S.timelineScroll) / vis) * w;
};
function snapStep(vis) {
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
  for (const s of steps) if (vis / s <= 14) return s;
  return 60;
}
function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

function getTrackLayout(h, dpr) {
  const rulerH = 16 * dpr;
  const t0Top = 18 * dpr, t0H = 42 * dpr, t0Bot = t0Top + t0H;
  const t1Top = 62 * dpr, t1H = 40 * dpr, t1Bot = t1Top + t1H;
  const t2Top = 104 * dpr, t2H = 40 * dpr, t2Bot = t2Top + t2H;
  return { rulerH, t0Top, t0Bot, t1Top, t1Bot, t2Top, t2Bot };
}

function hitTestTimeline(px, py, w, h, dpr) {
  if (!S.plan) return null;
  const L = getTrackLayout(h, dpr);
  const handleW = 6 * dpr;

  // Track 0: 文字PV cuts
  if (py >= L.t0Top && py <= L.t0Bot && S.plan.cuts) {
    for (let i = S.plan.cuts.length - 1; i >= 0; i--) {
      const cut = S.plan.cuts[i];
      const x0 = tlPxFromTime(cut.start, w), x1 = tlPxFromTime(cut.end, w);
      if (Math.abs(px - x0) <= handleW) return { type: 'trim-start', target: 'cut', cut, index: i, x: x0 };
      if (Math.abs(px - x1) <= handleW) return { type: 'trim-end', target: 'cut', cut, index: i, x: x1 };
      if (px >= x0 && px <= x1) return { type: 'move', target: 'cut', cut, index: i };
    }
  }

  // Track 1: 背景画像
  const images = (S.project && S.project.tracks && S.project.tracks.images) || [];
  if (py >= L.t1Top && py <= L.t1Bot) {
    for (let i = images.length - 1; i >= 0; i--) {
      const b = images[i];
      const x0 = tlPxFromTime(b.start, w), x1 = tlPxFromTime(b.end, w);
      if (Math.abs(px - x0) <= handleW) return { type: 'trim-start', target: 'block', track: 'images', block: b, index: i, x: x0 };
      if (Math.abs(px - x1) <= handleW) return { type: 'trim-end', target: 'block', track: 'images', block: b, index: i, x: x1 };
      if (px >= x0 && px <= x1) return { type: 'move', target: 'block', track: 'images', block: b, index: i };
    }
  }

  // Track 2: 背景動画
  const videos = (S.project && S.project.tracks && S.project.tracks.videos) || [];
  if (py >= L.t2Top && py <= L.t2Bot) {
    for (let i = videos.length - 1; i >= 0; i--) {
      const b = videos[i];
      const x0 = tlPxFromTime(b.start, w), x1 = tlPxFromTime(b.end, w);
      if (Math.abs(px - x0) <= handleW) return { type: 'trim-start', target: 'block', track: 'videos', block: b, index: i, x: x0 };
      if (Math.abs(px - x1) <= handleW) return { type: 'trim-end', target: 'block', track: 'videos', block: b, index: i, x: x1 };
      if (px >= x0 && px <= x1) return { type: 'move', target: 'block', track: 'videos', block: b, index: i };
    }
  }

  return { type: 'seek' };
}

function drawTimeline() {
  const c = $('timeline');
  if (!c || !S.plan) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(10, Math.round(c.clientWidth * dpr)), h = Math.max(10, Math.round(c.clientHeight * dpr));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext('2d'), D = Math.max(0.001, S.plan.duration);
  const vis = tlVisSec();
  // clamp scroll
  S.timelineScroll = Math.max(0, Math.min(S.timelineScroll, Math.max(0, D - vis)));

  const L = getTrackLayout(h, dpr);

  // 背景全体
  x.fillStyle = '#131316'; x.fillRect(0, 0, w, h);

  // トラック背景
  x.fillStyle = '#17171d'; x.fillRect(0, L.t0Top, w, L.t0Bot - L.t0Top);
  x.fillStyle = '#14181c'; x.fillRect(0, L.t1Top, w, L.t1Bot - L.t1Top);
  x.fillStyle = '#191522'; x.fillRect(0, L.t2Top, w, L.t2Bot - L.t2Top);

  // トラック境界線
  x.strokeStyle = '#272733'; x.lineWidth = 1;
  [L.rulerH, L.t0Bot, L.t1Bot, L.t2Bot].forEach(y => {
    x.beginPath(); x.moveTo(0, y + 0.5); x.lineTo(w, y + 0.5); x.stroke();
  });

  // グリッド＆時間目盛り
  const step = snapStep(vis);
  const tStart = Math.floor(S.timelineScroll / step) * step;
  x.strokeStyle = '#22222a'; x.lineWidth = 1;
  x.fillStyle = '#6e6a74'; x.font = `${9 * dpr}px monospace`;
  for (let t = tStart; t <= S.timelineScroll + vis + step; t += step) {
    const px = Math.round(tlPxFromTime(t, w));
    if (px < 0 || px > w) continue;
    x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h); x.stroke();
    x.fillText(fmtTime(t), px + 2 * dpr, 10 * dpr);
  }

  // Track 0 (文字PV) 内の音声波形
  if (S.audio && S.audio.peaks) {
    const pk = S.audio.peaks, n = pk.length, sd = S.audio.duration;
    const t0Mid = (L.t0Top + L.t0Bot) / 2;
    const maxH = (L.t0Bot - L.t0Top) * 0.7;
    x.fillStyle = '#2b2b36';
    for (let i = 0; i < w; i += 2) {
      const t = tlTimeFromPx(i, w);
      if (t > sd) break;
      const v = pk[Math.min(n - 1, Math.floor(t / sd * n))];
      const hh = v * maxH;
      x.fillRect(i, t0Mid - hh / 2, 1.5, hh);
    }
  }

  // Track 0 内のビート
  const beats = S.plan.beats || [];
  x.fillStyle = '#3a3a48';
  for (const b of beats) {
    const px = Math.round(tlPxFromTime(b, w));
    if (px >= 0 && px <= w) x.fillRect(px, L.t0Bot - 5 * dpr, 1, 5 * dpr);
  }

  // Track 0: 文字PVカット
  for (const cut of (S.plan.cuts || [])) {
    const x0 = tlPxFromTime(cut.start, w), x1 = tlPxFromTime(cut.end, w);
    if (x1 < 0 || x0 > w) continue;
    const hue = layoutHue(cut.layout);
    x.fillStyle = `hsla(${hue},70%,58%,0.32)`; x.fillRect(x0, L.t0Top, Math.max(1, x1 - x0 - 1), L.t0Bot - L.t0Top);
    x.fillStyle = `hsla(${hue},80%,62%,0.95)`; x.fillRect(x0, L.t0Top, Math.max(1, 2 * dpr), L.t0Bot - L.t0Top);
    // handles
    x.fillStyle = 'rgba(255,255,255,0.7)';
    x.fillRect(x0, L.t0Top, 2 * dpr, L.t0Bot - L.t0Top);
    x.fillRect(Math.max(x0, x1 - 2 * dpr), L.t0Top, 2 * dpr, L.t0Bot - L.t0Top);

    if (x1 - x0 > 34 * dpr) {
      x.fillStyle = 'rgba(236,231,225,0.85)'; x.font = `${10 * dpr}px monospace`;
      x.save(); x.beginPath(); x.rect(x0 + 2 * dpr, L.t0Top, Math.max(0, x1 - x0 - 4 * dpr), L.t0Bot - L.t0Top); x.clip();
      const cutLabel = (J.LAYOUTS[cut.layout] || {}).name || cut.layout;
      x.fillText(`${cutLabel} ${cut.text || ''}`, x0 + 5 * dpr, L.t0Top + 13 * dpr); x.restore();
    }
  }

  const drawKeyframeMarkers = (kfs, top, bot, isSel) => {
    if (!kfs || !kfs.length) return;
    const midY = (top + bot) / 2;
    for (const kf of kfs) {
      const kx = Math.round(tlPxFromTime(kf.t, w));
      if (kx < 0 || kx > w) continue;
      const isCur = Math.abs(S.t - kf.t) <= 0.06;
      x.save();
      x.fillStyle = isCur ? '#ffffff' : (isSel ? '#16f4d4' : '#ffcf40');
      x.strokeStyle = '#101014';
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(kx, midY - 4 * dpr);
      x.lineTo(kx + 4 * dpr, midY);
      x.lineTo(kx, midY + 4 * dpr);
      x.lineTo(kx - 4 * dpr, midY);
      x.closePath();
      x.fill();
      x.stroke();
      x.restore();
    }
  };

  // Track 1: 背景画像ブロック
  const imgBlocks = (S.project && S.project.tracks && S.project.tracks.images) || [];
  for (let i = 0; i < imgBlocks.length; i++) {
    const b = imgBlocks[i];
    const x0 = tlPxFromTime(b.start, w), x1 = tlPxFromTime(b.end, w);
    if (x1 < 0 || x0 > w) continue;
    const isSel = S.selectedBlock && S.selectedBlock.track === 'images' && S.selectedBlock.block === b;
    x.fillStyle = isSel ? 'rgba(22, 244, 212, 0.25)' : 'rgba(20, 150, 180, 0.35)';
    x.fillRect(x0, L.t1Top + 2 * dpr, Math.max(1, x1 - x0 - 1), L.t1Bot - L.t1Top - 4 * dpr);
    x.strokeStyle = isSel ? '#16f4d4' : 'rgba(22, 210, 244, 0.8)';
    x.lineWidth = isSel ? 2 * dpr : 1;
    x.strokeRect(x0 + 0.5, L.t1Top + 2 * dpr + 0.5, Math.max(1, x1 - x0 - 1), L.t1Bot - L.t1Top - 4 * dpr);

    // handles
    x.fillStyle = isSel ? '#16f4d4' : 'rgba(255,255,255,0.6)';
    x.fillRect(x0, L.t1Top + 2 * dpr, 2.5 * dpr, L.t1Bot - L.t1Top - 4 * dpr);
    x.fillRect(Math.max(x0, x1 - 2.5 * dpr), L.t1Top + 2 * dpr, 2.5 * dpr, L.t1Bot - L.t1Top - 4 * dpr);

    if (x1 - x0 > 24 * dpr) {
      x.fillStyle = isSel ? '#ffffff' : 'rgba(210, 245, 255, 0.9)';
      x.font = `${9.5 * dpr}px monospace`;
      x.save(); x.beginPath(); x.rect(x0 + 3 * dpr, L.t1Top, Math.max(0, x1 - x0 - 6 * dpr), L.t1Bot - L.t1Top); x.clip();
      x.fillText(`🖼️ ${b.name || '画像'} [${b.blendMode || 'normal'}]`, x0 + 5 * dpr, L.t1Top + 14 * dpr);
      x.restore();
    }
    drawKeyframeMarkers(b.keyframes, L.t1Top, L.t1Bot, isSel);
  }

  // Track 2: 背景動画ブロック
  const vidBlocks = (S.project && S.project.tracks && S.project.tracks.videos) || [];
  for (let i = 0; i < vidBlocks.length; i++) {
    const b = vidBlocks[i];
    const x0 = tlPxFromTime(b.start, w), x1 = tlPxFromTime(b.end, w);
    if (x1 < 0 || x0 > w) continue;
    const isSel = S.selectedBlock && S.selectedBlock.track === 'videos' && S.selectedBlock.block === b;
    x.fillStyle = isSel ? 'rgba(22, 244, 212, 0.25)' : 'rgba(160, 60, 220, 0.35)';
    x.fillRect(x0, L.t2Top + 2 * dpr, Math.max(1, x1 - x0 - 1), L.t2Bot - L.t2Top - 4 * dpr);
    x.strokeStyle = isSel ? '#16f4d4' : 'rgba(190, 90, 255, 0.8)';
    x.lineWidth = isSel ? 2 * dpr : 1;
    x.strokeRect(x0 + 0.5, L.t2Top + 2 * dpr + 0.5, Math.max(1, x1 - x0 - 1), L.t2Bot - L.t2Top - 4 * dpr);

    // handles
    x.fillStyle = isSel ? '#16f4d4' : 'rgba(255,255,255,0.6)';
    x.fillRect(x0, L.t2Top + 2 * dpr, 2.5 * dpr, L.t2Bot - L.t2Top - 4 * dpr);
    x.fillRect(Math.max(x0, x1 - 2.5 * dpr), L.t2Top + 2 * dpr, 2.5 * dpr, L.t2Bot - L.t2Top - 4 * dpr);

    if (x1 - x0 > 24 * dpr) {
      x.fillStyle = isSel ? '#ffffff' : 'rgba(240, 215, 255, 0.9)';
      x.font = `${9.5 * dpr}px monospace`;
      x.save(); x.beginPath(); x.rect(x0 + 3 * dpr, L.t2Top, Math.max(0, x1 - x0 - 6 * dpr), L.t2Bot - L.t2Top); x.clip();
      x.fillText(`🎬 ${b.name || '動画'} [${b.blendMode || 'normal'}]`, x0 + 5 * dpr, L.t2Top + 14 * dpr);
      x.restore();
    }
    drawKeyframeMarkers(b.keyframes, L.t2Top, L.t2Bot, isSel);
  }

  // トラック名バッジ（左端オーバーレイ）
  const drawTrackBadge = (label, top, bot, color) => {
    x.fillStyle = 'rgba(10, 10, 14, 0.75)';
    x.fillRect(0, top + 1, 56 * dpr, bot - top - 2);
    x.fillStyle = color;
    x.font = `bold ${9 * dpr}px sans-serif`;
    x.fillText(label, 6 * dpr, top + 13 * dpr);
  };
  drawTrackBadge('文字PV', L.t0Top, L.t0Bot, '#e6a030');
  drawTrackBadge('背景画像', L.t1Top, L.t1Bot, '#16c4e0');
  drawTrackBadge('背景動画', L.t2Top, L.t2Bot, '#c060ee');

  // line markers
  x.font = `${10 * dpr}px monospace`;
  for (const ln of (S.plan.lines || [])) {
    const lx = Math.round(tlPxFromTime(ln.start, w));
    if (lx >= 0 && lx <= w) {
      x.fillStyle = '#ffb52a'; x.fillRect(lx, 0, 1.5 * dpr, L.t0Top);
      x.fillStyle = '#ffb52a'; x.fillText(String(ln.index + 1).padStart(2, '0'), lx + 3 * dpr, 10 * dpr);
    }
  }

  // playhead (全トラック縦断)
  const px = Math.round(tlPxFromTime(S.t, w));
  if (px >= 0 && px <= w) {
    x.fillStyle = '#16f4d4'; x.fillRect(px - dpr, 0, 2 * dpr, h);
    x.beginPath(); x.moveTo(px - 4 * dpr, 0); x.lineTo(px + 4 * dpr, 0); x.lineTo(px, 6 * dpr); x.fill();
  }

  // ドラッグ操作中のビジュアルオーバーレイ（入れ替えハイライト & 削除ゾーン表示）
  if (S.tlDrag) {
    if (S.tlDrag.isDeleting) {
      // 削除ゾーン警告バー（タイムライン上部）
      x.fillStyle = 'rgba(235, 45, 70, 0.92)';
      x.fillRect(0, 0, w, 22 * dpr);
      x.fillStyle = '#ffffff';
      x.font = `bold ${11 * dpr}px sans-serif`;
      x.fillText('🗑️ 離して削除（直前の要素を延長して尺を自動補間）', 12 * dpr, 15 * dpr);

      // 削除対象要素の赤オーバーレイ
      let rx0 = 0, rx1 = 0, ry0 = 0, ry1 = 0;
      if (S.tlDrag.target === 'cut' && S.tlDrag.cut) {
        rx0 = tlPxFromTime(S.tlDrag.cut.start, w); rx1 = tlPxFromTime(S.tlDrag.cut.end, w);
        ry0 = L.t0Top; ry1 = L.t0Bot;
      } else if (S.tlDrag.target === 'block' && S.tlDrag.block) {
        rx0 = tlPxFromTime(S.tlDrag.block.start, w); rx1 = tlPxFromTime(S.tlDrag.block.end, w);
        ry0 = S.tlDrag.track === 'images' ? L.t1Top : L.t2Top;
        ry1 = S.tlDrag.track === 'images' ? L.t1Bot : L.t2Bot;
      }
      x.fillStyle = 'rgba(255, 50, 70, 0.45)';
      x.fillRect(rx0, ry0, Math.max(2, rx1 - rx0), ry1 - ry0);
      x.strokeStyle = '#ff334b';
      x.lineWidth = 2 * dpr;
      x.strokeRect(rx0 + 1, ry0 + 1, Math.max(2, rx1 - rx0 - 2), ry1 - ry0 - 2);
    } else if (S.tlDrag.swapCandidate) {
      // スワップ対象のハイライト
      const sc = S.tlDrag.swapCandidate;
      let sx0 = 0, sx1 = 0, sy0 = 0, sy1 = 0;
      if (sc.type === 'cut' && sc.cut) {
        sx0 = tlPxFromTime(sc.cut.start, w); sx1 = tlPxFromTime(sc.cut.end, w);
        sy0 = L.t0Top; sy1 = L.t0Bot;
      } else if (sc.type === 'block' && sc.block) {
        sx0 = tlPxFromTime(sc.block.start, w); sx1 = tlPxFromTime(sc.block.end, w);
        sy0 = S.tlDrag.track === 'images' ? L.t1Top : L.t2Top;
        sy1 = S.tlDrag.track === 'images' ? L.t1Bot : L.t2Bot;
      }
      x.save();
      x.strokeStyle = '#f5a50c';
      x.lineWidth = 2.5 * dpr;
      x.setLineDash([4 * dpr, 3 * dpr]);
      x.strokeRect(sx0 + 1, sy0 + 1, Math.max(4, sx1 - sx0 - 2), sy1 - sy0 - 2);
      x.fillStyle = 'rgba(245, 165, 12, 0.2)';
      x.fillRect(sx0, sy0, Math.max(2, sx1 - sx0), sy1 - sy0);
      x.fillStyle = '#f5a50c';
      x.font = `bold ${10 * dpr}px sans-serif`;
      x.fillText('⇄ 入れ替え', sx0 + 6 * dpr, sy0 + 14 * dpr);
      x.restore();
    }
  }

  syncBlockInspector();
}
window.drawTimeline = drawTimeline;
window.syncBlockInspector = syncBlockInspector;

function focusLineInList(lineIdx, smooth = true) {
  let targetEl = null;
  if (lineIdx === -1 && S.titleLineEl) {
    targetEl = S.titleLineEl;
  } else if (lineIdx >= 0 && S.lineEls && S.lineEls[lineIdx]) {
    targetEl = S.lineEls[lineIdx];
  }
  if (targetEl) {
    if (S.titleLineEl) S.titleLineEl.classList.toggle('cur', lineIdx === -1);
    S.lineEls.forEach((el, i) => el.classList.toggle('cur', i === lineIdx));
    S.curLine = lineIdx;
    try {
      targetEl.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
    } catch (e) {
      targetEl.scrollIntoView(false);
    }
  }
}

function timelineSeek(ev) {
  const c = $('timeline');
  const r = c.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const px = (ev.clientX - r.left) * dpr;
  const w = c.width || (c.clientWidth * dpr);
  const t = tlTimeFromPx(px, w);
  seek(t);
  if (S.plan) {
    const cut = J.cutAt(S.plan, t);
    if (cut) focusLineInList(cut.line);
  }
}

/* ---------------- cut info ---------------- */
let lastCutIdx = -2;
function updateCutInfo() {
  const cut = J.cutAt(S.plan, S.t);
  const idx = cut ? cut.index : -1;
  const li = cut ? cut.line : -2;
  if (li !== S.curLine) {
    if (S.titleLineEl) S.titleLineEl.classList.toggle('cur', li === -1);
    S.lineEls.forEach((el, i) => el.classList.toggle('cur', i === li));
    S.curLine = li;
  }
  if (idx === lastCutIdx) return;
  lastCutIdx = idx;
  const el = $('cutInfo');
  if (!cut) { el.innerHTML = '<span class="hint">この位置にカットはありません</span>'; return; }
  const chip = (cls, k, v) => `<span class="chip ${cls}"><b>${k}</b>${v}</span>`;
  const n = (tbl, k) => (tbl[k] ? tbl[k].name : k);
  el.innerHTML = [
    `<span class="chip mono">${cut.line === -1 ? '#00 (タイトル)' : '#' + String(cut.index + 1).padStart(2, '0')}</span>`,
    chip('l', 'レイアウト', n(J.LAYOUTS, cut.layout)), chip('e', '登場', n(J.ENTER, cut.enter)), chip('h', '保持', n(J.HOLD, cut.hold)), chip('x', '退場', n(J.EXIT, cut.exit)),
    cut.decor && cut.decor.length ? chip('', '装飾', cut.decor.map(d => n(J.DECOR, d.id)).join('・')) : '',
    cut.treat && cut.treat !== 'none' ? chip('t', '加工', n(J.TREAT, cut.treat)) : '',
    cut.bg && cut.bg !== 'none' ? chip('b', '背景', n(J.BG, cut.bg)) : '',
    cut.cam && cut.cam !== 'push' ? chip('c', 'カメラ', n(J.CAMERA, cut.cam)) : '',
    cut.trans ? chip('c', 'つなぎ', n(J.TRANS, cut.trans)) : '',
  ].join('');
}

/* ---------------- line list ---------------- */
function renderLines() {
  const ol = $('lineList'); ol.innerHTML = ''; S.lineEls = []; S.curLine = -2; S.titleLineEl = null;
  const ov = S.project.overrides;
  const layoutOpts = '<option value="">自動</option>' + J.LAYOUT_ORDER.map(k => `<option value="${k}">${J.LAYOUTS[k].name}</option>`).join('');

  // 先頭の曲タイトル行 (#00)
  if (S.plan && S.plan.titleLine) {
    const tln = S.plan.titleLine;
    const to = ov[-1] || {};
    const titleLayoutKeys = J.TITLE_LAYOUT_ORDER || ['title', 'title_l', 'title_huge', 'title_vsplit', 'title_cinema', 'title_stack', 'title_slash', 'title_corner'];
    const titleLayoutOpts = '<option value="">自動（サイコロで抽選）</option>' + titleLayoutKeys.map(k => `<option value="${k}">${(J.LAYOUTS[k] && J.LAYOUTS[k].name) || k}</option>`).join('');
    const tli = document.createElement('li');
    tli.className = 'ln ln-title';
    tli.innerHTML = `<span class="no">#00</span>
      <input class="time mono" type="text" value="0.00" disabled title="曲タイトル表示カード" aria-label="タイトル開始秒" style="opacity:0.6;cursor:default">
      <span class="txt" title="${escapeHtml(tln.text)}"><b>[タイトル]</b> ${escapeHtml(tln.text)}</span>
      <div class="meta"><span class="cuts"></span>
      <span class="tools">
        <select aria-label="タイトルレイアウト指定">${titleLayoutOpts}</select>
        <button class="icon ghost dice" title="タイトルの装飾・配置・演出を再抽選" ${to.lock ? 'disabled' : ''}>${ICON.dice}</button>
        <button class="icon ghost lock" title="タイトルの構成をロック" aria-pressed="${to.lock ? 'true' : 'false'}">${ICON.lock}</button>
      </span></div>`;
    tli.querySelector('select').value = to.layout || '';
    tli.querySelector('.txt').addEventListener('click', () => seek(0.001));
    tli.querySelector('select').addEventListener('change', e => { setOv(-1, { layout: e.target.value || undefined }); replan(); });
    tli.querySelector('.dice').addEventListener('click', () => {
      const cur = ov[-1] || {};
      if (cur.lock) return;
      remember();
      if (S.project.rowCache) delete S.project.rowCache[-1];
      setOv(-1, { seed: (cur.seed | 0) + 1, lock: false });
      replan();
      commit('タイトル再抽選');
      seek(0.001);
    });
    tli.querySelector('.lock').addEventListener('click', () => {
      const cur = ov[-1] || {};
      if (cur.lock) setOv(-1, { lock: false, lockedSeed: undefined });
      else setOv(-1, { lock: true, lockedSeed: tln.seed });
      replan();
    });
    const tcutsEl = tli.querySelector('.cuts');
    S.plan.cuts.filter(c => c.line === -1).forEach(c => {
      const sp = document.createElement('span');
      const layName = (J.LAYOUTS[c.layout] && J.LAYOUTS[c.layout].name) || c.layout;
      const decorNames = (c.decor && c.decor.length) ? c.decor.map(d => (J.DECOR[d.id] ? J.DECOR[d.id].name : d.id)).join('・') : '装飾なし';
      sp.textContent = `${layName} [${decorNames}]`;
      sp.title = `レイアウト: ${layName}｜装飾: ${decorNames}`;
      sp.style.borderColor = `hsla(180,70%,58%,0.7)`;
      sp.addEventListener('click', () => seek(0.001));
      tcutsEl.appendChild(sp);
    });
    ol.appendChild(tli);
    S.titleLineEl = tli;
  }

  S.plan.lines.forEach((ln, i) => {
    const o = ov[i] || {};
    const li = document.createElement('li'); li.className = 'ln';
    const manual = S.project.timing.lineTimes && S.project.timing.lineTimes[i] != null;
    li.innerHTML = `<span class="no">${String(i + 1).padStart(2, '0')}</span>
      <input class="time mono" type="number" step="0.01" min="0" value="${ln.start.toFixed(2)}" title="開始（秒）${manual ? '・手動' : '・自動'}" aria-label="${i + 1}行目の開始秒" style="${manual ? 'border-color:var(--cyan)' : ''}">
      <span class="txt" title="${escapeHtml(ln.text)}">${escapeHtml(ln.text)}</span>
      <div class="meta"><span class="cuts"></span>
      <span class="tools">
        <select aria-label="レイアウト指定">${layoutOpts}</select>
        <button class="icon ghost tap-from-here" title="この行からタップ同期を開始">⏱️</button>
        <button class="icon ghost dice" title="この行を再抽選">${ICON.dice}</button>
        <button class="icon ghost lock" title="この行の構成をロック" aria-pressed="${o.lock ? 'true' : 'false'}">${ICON.lock}</button>
      </span></div>`;
    li.querySelector('select').value = o.layout || '';
    li.querySelector('.time').addEventListener('change', e => {
      const v = parseFloat(e.target.value);
      if (!S.project.timing.lineTimes) S.project.timing.lineTimes = {};
      if (isFinite(v)) S.project.timing.lineTimes[i] = Math.max(0, v); else delete S.project.timing.lineTimes[i];
      replan();
    });
    li.querySelector('.txt').addEventListener('click', () => { S.curLine = i; seek(ln.start + 0.001); });
    li.querySelector('select').addEventListener('change', e => { setOv(i, { layout: e.target.value || undefined }); replan(); });
    li.querySelector('.tap-from-here').addEventListener('click', (e) => {
      e.stopPropagation();
      startTap(i);
    });
    li.querySelector('.dice').addEventListener('click', () => {
      const cur = ov[i] || {};
      if (cur.lock) return;
      remember();
      if (S.project.rowCache) delete S.project.rowCache[i];
      setOv(i, { seed: (cur.seed | 0) + 1, lock: false });
      replan();
      commit('行' + (i + 1) + '再抽選');
      seek(ln.start + 0.001);
    });
    li.querySelector('.lock').addEventListener('click', () => {
      const cur = ov[i] || {};
      if (cur.lock) setOv(i, { lock: false, lockedSeed: undefined });
      else setOv(i, { lock: true, lockedSeed: ln.seed });
      replan();
    });
    const cutsEl = li.querySelector('.cuts');
    S.plan.cuts.filter(c => c.line === i && J.LAYOUTS[c.layout] && !J.LAYOUTS[c.layout].special).forEach(c => {
      const sp = document.createElement('span'); sp.textContent = J.LAYOUTS[c.layout].name; sp.title = `${c.text}｜${J.ENTER[c.enter].name} → ${J.EXIT[c.exit].name}`;
      sp.style.borderColor = `hsla(${layoutHue(c.layout)},70%,58%,0.7)`;
      sp.addEventListener('click', () => seek(c.start + Math.min(c.dur * 0.5, c.inDur + 0.05)));
      cutsEl.appendChild(sp);
    });
    ol.appendChild(li); S.lineEls.push(li);
  });
  $('linesInfo').textContent = `${S.plan.lines.length}行 / ${S.plan.cuts.length}カット`;
  updateCutInfo();
}
function setOv(i, patch) {
  const cur = Object.assign({}, S.project.overrides[i] || {}, patch);
  for (const k of Object.keys(cur)) if (cur[k] === undefined || cur[k] === false || cur[k] === '') delete cur[k];
  if (Object.keys(cur).length) S.project.overrides[i] = cur; else delete S.project.overrides[i];
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------------- style tab ---------------- */
function drawStyleGrid() {
  const g = $('styleGrid');
  if (!g.children.length) {
    J.STYLE_ORDER.forEach(k => {
      const b = document.createElement('button'); b.className = 'stile'; b.dataset.k = k;
      b.title = J.STYLES[k].desc;
      b.innerHTML = `<canvas width="192" height="108"></canvas><span>${J.STYLES[k].name}</span><span class="badges">${setBadges(J.STYLES[k])}</span>`;
      b.addEventListener('click', () => { remember(); S.project.style = k; S.project.colors.enabled = false; S.project.rowCache = {}; syncUI(); replan(); commit(); });
      g.appendChild(b);
    });
  }
  [...g.children].forEach(b => {
    const k = b.dataset.k, st = J.STYLES[k], sc = st.schemes[0], cv = b.querySelector('canvas'), x = cv.getContext('2d');
    b.setAttribute('aria-pressed', S.project.style === k ? 'true' : 'false');
    const off = !J.randomOk(S.project, 'style', k);
    b.classList.toggle('set-off', off);
    b.title = st.desc + (off ? (st.extra && S.project.extra !== true ? '（追加分がオフのため、おまかせでは選ばれません）' : '（和風の演出がオフのため、おまかせでは選ばれません）') : '');
    x.fillStyle = sc.bg; x.fillRect(0, 0, 192, 108);
    st.schemes.slice(1, 4).forEach((s2, i) => { x.fillStyle = s2.bg; x.fillRect(192 - 14 * (i + 1), 0, 14, 10); });
    const f = st.fonts.display[0];
    x.font = J.fontCSS(f, 46); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = sc.ghostB; x.fillText('字面', 96 - 3, 54 - 1);
    x.fillStyle = sc.ghostA; x.fillText('字面', 96 + 3, 54 + 2);
    x.fillStyle = sc.fg; x.fillText('字面', 96, 54);
    x.fillStyle = sc.accent; x.fillRect(12, 90, 30, 4);
    x.font = J.fontCSS('mono', 9); x.textAlign = 'left'; x.fillStyle = sc.sub; x.fillText(k.toUpperCase(), 48, 93);
  });
}
function fontSelectOptions(sel) {
  return '<option value="">スタイルの既定</option>' + Object.entries(J.FONTS).map(([k, f]) => {
    const g = J.faceOf ? J.faceOf(k) : f, alt = g.label && g.label !== f.label ? ' → ' + g.label : '';   // the face actually used for the lyric language
    return `<option value="${k}" ${sel === k ? 'selected' : ''}>${escapeHtml(f.label + alt)}</option>`;
  }).join('');
}
function renderFontRoles() {
  const box = $('fontRoles'); box.innerHTML = '';
  [['display', '見出し'], ['serif', '明朝枠'], ['body', '小さな文字']].forEach(([role, label]) => {
    const row = document.createElement('div'); row.className = 'font-row';
    row.innerHTML = `<span class="muted">${label}</span><select aria-label="${label}のフォント">${fontSelectOptions(S.project.fonts[role])}</select>`;
    row.querySelector('select').addEventListener('change', e => { if (e.target.value) S.project.fonts[role] = e.target.value; else delete S.project.fonts[role]; fontKey = ''; replan(); });
    box.appendChild(row);
  });
}
const BASE_KEYS = [['bg', '背景'], ['fg', '文字'], ['sub', '補助']];
const ACCENT_KEYS = [['accent', 'アクセント'], ['ghostA', 'ズレ色A'], ['ghostB', 'ズレ色B']];
function renderColors() {
  const st = J.STYLES[S.project.style] || J.STYLES.noir, sc = st.schemes[0];
  const c = S.project.colors;
  $('colorOn').checked = !!c.enabled;
  $('accentOn').checked = !!c.accentOn;
  const fill = (rowId, keys, flag) => {
    const row = $(rowId); row.innerHTML = '';
    keys.forEach(([k, label]) => {
      const l = document.createElement('label');
      const v = (c[flag] && c[k]) || c[k] || sc[k];
      l.innerHTML = `${label}<input type="color" value="${toColorInput(v)}">`;
      l.querySelector('input').addEventListener('input', e => {
        c[k] = e.target.value.toUpperCase();
        if (!c[flag]) { c[flag] = true; $(flag === 'enabled' ? 'colorOn' : 'accentOn').checked = true; }
        replanSoon(60); drawSwatch();
      });
      row.appendChild(l);
    });
  };
  fill('colorRow', BASE_KEYS, 'enabled');
  fill('colorRowAccent', ACCENT_KEYS, 'accentOn');
  drawSwatch();
}
const toColorInput = v => { const h = String(v || '#000000'); return /^#[0-9a-f]{6}$/i.test(h) ? h.toLowerCase() : J.toHex(...J.hex(h)).toLowerCase(); };
function swatchHTML(cols) { return cols.map(c => `<i style="background:${c}" title="${c}"></i>`).join(''); }
function drawSwatch() {
  const sc = S.plan ? S.plan.style.schemes[0] : null; if (!sc) return;
  $('paletteSwatch').innerHTML = swatchHTML([sc.accent, sc.ghostA, sc.ghostB]);
}
function randomPalette() {
  remember();
  const c = S.project.colors;
  const sc0 = J.STYLES[S.project.style].schemes[0];
  const bg = c.enabled && c.bg ? c.bg : sc0.bg;
  let p, guard = 0;
  do { p = J.randomPalette(bg); } while (guard++ < 6 && p.ghostA === c.ghostA && p.ghostB === c.ghostB);
  Object.assign(c, { accent: p.accent, ghostA: p.ghostA, ghostB: p.ghostB, accentOn: true });
  renderColors(); replan(); commit();
  toast('配色：アクセント・ズレ色A/Bを変更', [p.accent, p.ghostA, p.ghostB]);
}

/* ---------------- history of looks (◀ ▶) ---------------- */
// only the "look" is tracked — lyrics, timing and output settings are never rolled back
const HKEYS = ['style', 'mood', 'seed', 'fx', 'enabled', 'fonts', 'colors', 'overrides'];
const H = { list: [], i: -1 };
const lookSnap = () => JSON.stringify(Object.fromEntries(HKEYS.map(k => [k, S.project[k] ?? null])));
function remember() {            // call before changing the look: makes sure the current look is on the stack
  const s = lookSnap();
  if (H.i >= 0 && H.list[H.i] === s) return;
  H.list = H.list.slice(0, H.i + 1); H.list.push(s); H.i = H.list.length - 1;
}
function commit(desc) {              // call after changing the look
  const s = lookSnap();
  if (H.list[H.i] !== s) { H.list = H.list.slice(0, H.i + 1); H.list.push(s); H.i = H.list.length - 1; }
  if (H.list.length > 80) { H.list.splice(0, H.list.length - 80); H.i = H.list.length - 1; }
  updateHist();
  if (typeof UndoRedo !== 'undefined') UndoRedo.commit(desc || '設定・デザイン変更');
}
function histGo(d) {
  if (S.exporting) return;
  remember();                    // hand edits made since the last step become a stop of their own
  const j = H.i + d; if (j < 0 || j >= H.list.length) return;
  H.i = j;
  Object.assign(S.project, JSON.parse(H.list[j]));
  fontKey = ''; syncUI(); replan(); updateHist();
  toast(`${j + 1} / ${H.list.length} 案目`);
  restartPreview();
}
function updateHist() {
  const canB = H.i > 0, canF = H.i < H.list.length - 1;
  ['btnPrev', 'btnPrev2'].forEach(id => { $(id).disabled = !canB; });
  ['btnNext', 'btnNext2'].forEach(id => { $(id).disabled = !canF; });
  $('histPos').textContent = H.list.length > 1 ? `${H.i + 1} / ${H.list.length}` : '';
}

/* ---------------- undo / redo (Ctrl+Z / Ctrl+Y) ---------------- */
const UndoRedo = {
  stack: [],
  index: -1,
  max: 15,
  isApplying: false,

  init(proj) {
    if (!proj) return;
    this.stack = [{ project: JSON.parse(JSON.stringify(proj)), desc: '初期状態' }];
    this.index = 0;
  },

  commit(desc = '変更') {
    if (this.isApplying || !S.project) return;
    const snap = JSON.parse(JSON.stringify(S.project));
    if (this.index >= 0 && this.stack[this.index]) {
      if (JSON.stringify(this.stack[this.index].project) === JSON.stringify(snap)) {
        return;
      }
    }
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }
    this.stack.push({ project: snap, desc, timestamp: Date.now() });
    if (this.stack.length > this.max) {
      this.stack.shift();
    } else {
      this.index++;
    }
  },

  undo() {
    if (!this.canUndo()) {
      toast('これ以上戻せません');
      return;
    }
    const curDesc = this.stack[this.index]?.desc || '操作';
    this.index--;
    this.apply(this.stack[this.index]);
    toast(`元に戻しました: ${curDesc}（残り ${this.index} 件）`);
  },

  redo() {
    if (!this.canRedo()) {
      toast('これ以上やり直せません');
      return;
    }
    this.index++;
    const nextDesc = this.stack[this.index]?.desc || '操作';
    this.apply(this.stack[this.index]);
    toast(`やり直しました: ${nextDesc}`);
  },

  canUndo() { return this.index > 0; },
  canRedo() { return this.index < this.stack.length - 1; },

  apply(entry) {
    if (!entry || !entry.project) return;
    this.isApplying = true;
    try {
      S.project = JSON.parse(JSON.stringify(entry.project));
      fontKey = '';
      syncUI();
      replan();
    } finally {
      this.isApplying = false;
    }
  }
};
window.UndoRedo = UndoRedo;
window.replan = replan;
window.seek = seek;

/* ---------------- おまかせ ---------------- */
function restartPreview() { seek(0); if (!S.playing && S.mode === 'easy') play(); }
function omakase() {
  if (S.exporting || S.tap) return;
  remember();
  const r = J.omakase(S.project);
  Object.assign(S.project, r);
  S.project.rowCache = {};
  if (S.project.timing) S.project.timing.cutTimes = null;
  fontKey = ''; syncUI(); replan(); commit();
  toast(`おまかせ：${J.STYLES[r.style].name} × ${J.MOODS[r.mood].name}`, r.colors.accentOn ? [r.colors.accent, r.colors.ghostA, r.colors.ghostB] : null);
  restartPreview();
}
// change just one aspect of the current look
function rerollPart(part) {
  if (S.exporting || S.tap) return;
  remember();
  const P = S.project;
  let msg = '';
  if (part === 'style') {
    let pool = J.STYLE_ORDER.filter(k => k !== P.style && J.randomOk(P, 'style', k));
    if (!pool.length) pool = J.STYLE_ORDER.filter(k => k !== P.style);
    P.style = pool[Math.floor(Math.random() * pool.length)];
    P.colors.enabled = false;
    P.rowCache = {};
    msg = `スタイル：${J.STYLES[P.style].name}`;
  } else if (part === 'mood') {
    const r = J.omakase(P);
    Object.assign(P, { mood: r.mood, fx: r.fx, enabled: r.enabled });
    P.rowCache = {};
    msg = `雰囲気：${J.MOODS[r.mood].name}`;
  } else if (part === 'cut') {
    P.seed = (Math.random() * 1e9) | 0;
    P.rowCache = {};
    if (P.timing) P.timing.cutTimes = null;
    msg = '構成：レイアウトと動きを再抽選';
  }
  fontKey = ''; syncUI(); replan(); commit();
  toast(msg);
  restartPreview();
}
function showNow() {
  const el = $('easyNow'); if (!el || !S.plan || el.closest('[hidden]')) return;
  const P = S.project, sc = S.plan.style.schemes[0];
  const moodName = P.mood && J.MOODS[P.mood] ? J.MOODS[P.mood].name : 'カスタム';
  const fk = S.plan.style.fonts.display[0];
  const fontName = J.FONTS[fk] ? J.FONTS[fk].label : fk;
  const cuts = S.plan.cuts.filter(c => c.line >= 0 && c.layout !== 'interlude');
  const kinds = new Set(cuts.map(c => c.layout)).size;
  const row = (k, v) => `<div class="now-row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  el.innerHTML = row('スタイル', `<b>${escapeHtml(J.STYLES[P.style].name)}</b>`)
    + row('雰囲気', escapeHtml(moodName))
    + row('配色', `<span class="swatches">${swatchHTML([sc.bg, sc.fg, sc.accent, sc.ghostA, sc.ghostB])}</span>${P.colors.accentOn ? '<span class="tagl">ランダム</span>' : ''}`)
    + row('見出し書体', escapeHtml(fontName))
    + row('構成', `${cuts.length} カット・レイアウト ${kinds} 種`)
    + row('演出', `加工 ${cuts.filter(c => c.treat && c.treat !== 'none').length}・背景 ${new Set(cuts.map(c => c.bg).filter(b => b && b !== 'none')).size}種・カメラ ${cuts.filter(c => c.cam && c.cam !== 'push').length}`);
}
let toastTimer = 0;
function toast(m, cols) {
  const el = $('toast'); if (!el) return;
  el.innerHTML = escapeHtml(m) + (cols ? `<span class="swatches">${swatchHTML(cols)}</span>` : '');
  el.hidden = false; el.classList.remove('out'); void el.offsetWidth; el.classList.add('in');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); toastTimer = setTimeout(() => { el.hidden = true; }, 260); }, 1700);
}

/* ---------------- かんたん / 詳細 ---------------- */
function setMode(m) {
  S.mode = m === 'easy' ? 'easy' : 'pro';
  const easy = S.mode === 'easy';
  $('app').classList.toggle('is-easy', easy);
  $('easyPanel').hidden = !easy;
  $('modeEasy').setAttribute('aria-pressed', String(easy));
  $('modePro').setAttribute('aria-pressed', String(!easy));
  try { localStorage.setItem('jizura.mode', S.mode); } catch (e) {}
  if (easy) { showNow(); syncOut(); codecNote(); }
  sizeViewport(); drawTimeline(); loadThumbFonts();
}

/* ---------------- fx tab ---------------- */
const FX = [['motion', '動きの強さ'], ['glitch', 'グリッチ'], ['chroma', '色ズレ'], ['decor', '装飾の量'], ['density', 'カットの細かさ'], ['texture', '質感'], ['bgSwitch', '背景の切替']];
function renderFx() {
  const box = $('fxSliders'); box.innerHTML = '';
  FX.forEach(([k, label]) => {
    const row = document.createElement('div'); row.className = 'slider';
    const v = S.project.fx[k] ?? 0.5;
    row.innerHTML = `<label for="fx_${k}">${label}</label><input id="fx_${k}" type="range" min="0" max="1" step="0.01" value="${v}"><output>${Math.round(v * 100)}</output>`;
    const inp = row.querySelector('input'), out = row.querySelector('output');
    inp.addEventListener('input', () => { S.project.fx[k] = +inp.value; S.project.mood = null; out.textContent = Math.round(inp.value * 100); replanSoon(120); });
    box.appendChild(row);
  });
  $('fxFlash').checked = !!S.project.fx.flash;
  $('fxKoma').value = String(J.komaOf(S.project.fx));
  $('fxHud').value = S.project.fx.hud || 'auto';
  $('seed').value = S.project.seed;
}

/* ---------------- technique tab ---------------- */
const GROUPS = [['layout', 'レイアウト'], ['enter', '登場'], ['hold', '保持'], ['exit', '退場'], ['decor', '装飾'], ['treat', '文字の加工'], ['bg', '背景'], ['cam', 'カメラ'], ['fx', '画面効果'], ['trans', 'カット間のつなぎ']];
const openGroups = new Set();
function techItems(g) { return J.order(g).filter(k => J.registry(g)[k] && !J.registry(g)[k].special); }
function renderTech() {
  const box = $('techLists'); box.innerHTML = '';
  const q = ($('techFilter').value || '').trim().toLowerCase();
  let total = 0, onAll = 0;
  GROUPS.forEach(([g, label]) => {
    const tbl = J.registry(g), items = techItems(g), en = S.project.enabled[g] || (S.project.enabled[g] = {});
    const shown = q ? items.filter(k => (tbl[k].name + ' ' + k).toLowerCase().includes(q)) : items;
    const onN = items.filter(k => en[k] !== false).length;
    total += items.length; onAll += onN;
    if (q && !shown.length) return;
    const d = document.createElement('details'); d.className = 'tgroup';
    d.open = !!q || openGroups.has(g);
    d.addEventListener('toggle', () => { if (d.open) openGroups.add(g); else openGroups.delete(g); });
    d.innerHTML = `<summary><span class="tg-name">${label}</span><span class="tg-cnt mono">${onN}/${items.length}</span></summary><div class="tg-tools"><button class="ghost small" data-a="on">すべてON</button><button class="ghost small" data-a="off">すべてOFF</button><button class="ghost small" data-a="flip">反転</button></div>`;
    const list = document.createElement('div'); list.className = 'checks';
    shown.forEach(k => {
      const l = document.createElement('label');
      l.title = k + (tbl[k].tags && tbl[k].tags.length ? '（' + tbl[k].tags.map(t => (J.MOODS[t] ? J.MOODS[t].name : t)).join('・') + '）' : '');
      if (!J.randomOk(S.project, g, k)) { l.classList.add('set-off'); l.title += tbl[k].extra && S.project.extra !== true ? '（追加分がオフのため、自動では選ばれません）' : '（和風の演出がオフのため、自動では選ばれません）'; }
      l.innerHTML = `<input type="checkbox" ${en[k] !== false ? 'checked' : ''}> ${escapeHtml(tbl[k].name)}${setBadges(tbl[k])}`;
      l.querySelector('input').addEventListener('change', e => { en[k] = e.target.checked; S.project.mood = null; d.querySelector('.tg-cnt').textContent = `${items.filter(x => en[x] !== false).length}/${items.length}`; replanSoon(60); });
      list.appendChild(l);
    });
    d.querySelectorAll('.tg-tools button').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.a;
      shown.forEach(k => { en[k] = a === 'on' ? true : a === 'off' ? false : en[k] === false; });
      // keep a fallback so the planner always has something to use
      if (g === 'layout' && !items.some(k => en[k] !== false)) en.center = true;
      if (g === 'enter') en.cut = true; if (g === 'exit') en.cut = true; if (g === 'hold') en.still = true;
      if (g === 'treat') en.none = true; if (g === 'bg') en.none = true; if (g === 'cam') en.push = true;
      S.project.mood = null; openGroups.add(g); renderTech(); replan();
    }));
    d.appendChild(list);
    box.appendChild(d);
  });
  $('techTotal').textContent = `${onAll}/${total}`;
}

/* ---------------- output tab ---------------- */
function syncOut() {
  $('outAspect').value = S.project.aspect; $('outRes').value = String(S.project.res); $('outFps').value = String(S.project.fps);
  $('eAspect').value = S.project.aspect; $('eRes').value = String(S.project.res); $('eFps').value = String(S.project.fps);
  $('outQuality').value = S.project.quality || 'high'; $('outAudio').checked = S.project.includeAudio !== false;
  const k = J.keyMode(S.project) || 'off';
  $('outKey').value = k; $('eKey').value = k;
  const kb = $('keyBadge');
  kb.hidden = k === 'off';
  if (k !== 'off') kb.innerHTML = `<i style="background:${J.KEY_BG[k]}"></i>${k === 'green' ? 'グリーンバック' : 'ブラックバック'}`;
}
async function codecNote() {
  const [w, h] = J.outputSize(S.project);
  const vc = await J.pickVideoCodec(w, h, S.project.fps, 12e6);
  $('codecNote').textContent = vc ? `このブラウザでは ${vc.label} で書き出します（${w}×${h} / ${S.project.fps}fps）。書き出し中はタブを開いたままにしてください。` : 'このブラウザは動画エンコード（WebCodecs）に対応していません。Chrome / Edge の最新版で開くか、連番PNGを使ってください。';
  $('btnMP4').disabled = !vc; $('eMP4').disabled = !vc;
  if (!vc) $('eMP4').title = 'このブラウザは MP4 書き出しに対応していません（Chrome / Edge 推奨）';
}
const EXP_BTNS = ['btnMP4', 'btnPNG', 'btnPNGA', 'btnPNGL', 'eMP4'];
function baseName() {
  const k = J.keyMode(S.project);
  return ((S.project.title || 'jizura').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'jizura') + (k ? (k === 'green' ? '_greenback' : '_blackback') : '');
}
async function runExport(kind) {
  if (S.exporting) return;
  pause();
  const ac = new AbortController(); S.exporting = ac;
  const boxes = [...document.querySelectorAll('.exp-box')];
  const setText = m => boxes.forEach(b => { b.querySelector('.exp-text').textContent = m; });
  const txt = { set textContent(m) { setText(m); }, get textContent() { return boxes[0].querySelector('.exp-text').textContent; } };
  boxes.forEach(b => { b.hidden = false; b.querySelector('.exp-bar').style.width = '0%'; });
  setText('準備中…');
  EXP_BTNS.forEach(id => { $(id).disabled = true; });
  const onProgress = (p, m) => { boxes.forEach(b => { b.querySelector('.exp-bar').style.width = (p * 100).toFixed(1) + '%'; }); setText(m); };
  const t0 = performance.now();
  try {
    await J.ensureFonts(S.project.lyrics + (S.project.title || '') + (S.project.artist || '') + HUD_CHARS, J.fontsOfPlan(S.plan));
    if (kind === 'mp4') {
      const r = await J.exportMP4({ plan: S.plan, project: S.project, audio: S.project.includeAudio !== false ? S.audio : null, quality: S.project.quality || 'high', onProgress, signal: ac.signal });
      txt.textContent = `完成 ${(r.blob.size / 1048576).toFixed(1)}MB・${r.codec}${r.audio ? ' + ' + r.audio.toUpperCase() : ''}・${((performance.now() - t0) / 1000).toFixed(0)}秒`;
      const res = await J.saveFile(baseName() + '.mp4', r.blob);
      if (res === 'declined') txt.textContent += '（保存はキャンセルされました）';
    } else {
      const blob = await J.exportPNGZip({ plan: S.plan, project: S.project, transparent: kind === 'pnga', layers: kind === 'pngl', onProgress, signal: ac.signal });
      txt.textContent = `完成 ${(blob.size / 1048576).toFixed(1)}MB`;
      await J.saveFile(baseName() + (kind === 'pnga' ? '_alpha' : kind === 'pngl' ? '_layers' : '') + '_png.zip', blob);
    }
  } catch (e) {
    txt.textContent = 'エラー: ' + (e && e.message ? e.message : e);
    console.error(e);
  } finally {
    S.exporting = null; S.need = true;
    EXP_BTNS.forEach(id => { $(id).disabled = false; });
    codecNote();
  }
}

/* ---------------- tap sync ---------------- */
function inferTapStartLine() {
  const lines = S.plan && S.plan.lines;
  if (!lines || !lines.length) return 0;
  if (S.curLine >= 0 && S.curLine < lines.length) {
    return S.curLine;
  }
  const curT = S.t || 0;
  if (curT <= 0.3) return 0;
  let bestIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (curT >= ln.start - 0.5 && curT <= ln.end) {
      return i;
    }
    if (ln.start > curT) {
      return i;
    }
    bestIdx = i;
  }
  return bestIdx;
}

function startTap(targetLineIdx = null) {
  if (!S.plan.lines.length) return;
  const startIdx = targetLineIdx != null ? targetLineIdx : inferTapStartLine();
  const ln = S.plan.lines[startIdx];
  if (!ln) return;

  remember();

  S.tap = { i: startIdx, startIdx };
  if (!S.project.timing.lineTimes) S.project.timing.lineTimes = {};

  // startIdx 以降の古いカット境界をクリアして新タップで再構築できるようにする（startIdx未満は完全保護）
  if (S.project.timing.cutTimes && Array.isArray(S.project.timing.cutTimes)) {
    S.project.timing.cutTimes = S.project.timing.cutTimes.filter(c => c.line < startIdx);
  }
  // startIdx 以降の古い lineTimes もクリア（上書き開始）
  for (let k = startIdx; k < S.plan.lines.length; k++) {
    delete S.project.timing.lineTimes[k];
  }

  $('tapPanel').hidden = false;
  $('btnTap').setAttribute('aria-pressed', 'true');

  const lineStart = ln.start || 0;
  const preRoll = startIdx > 0 ? 1.2 : 0;
  const seekT = Math.max(0, lineStart - preRoll);

  seek(seekT);
  play();
  updateTap();

  if (startIdx > 0) {
    toast(`第 ${startIdx + 1} 行「${ln.text.slice(0, 12)}…」からタップ同期を開始（${seekT.toFixed(1)}秒へ移動）`);
  }
  $('tapBtn').focus();
}

function tapNow() {
  if (!S.tap) return;
  const curIdx = S.tap.i;
  let tVal = +S.t.toFixed(3);

  if (curIdx > 0 && S.project.timing.lineTimes && S.project.timing.lineTimes[curIdx - 1] != null) {
    const prevT = S.project.timing.lineTimes[curIdx - 1];
    if (tVal <= prevT) {
      tVal = +(prevT + 0.05).toFixed(3);
    }
  }

  // 該当行のカット境界を確実にクリアして新タイミングで再導出
  if (S.project.timing.cutTimes && Array.isArray(S.project.timing.cutTimes)) {
    S.project.timing.cutTimes = S.project.timing.cutTimes.filter(c => c.line !== curIdx);
  }

  S.project.timing.lineTimes[curIdx] = tVal;
  S.tap.i++;
  replan();

  if (S.tap.i >= S.plan.lines.length) {
    stopTap();
    toast('全行のタップ同期が完了しました');
  } else {
    updateTap();
  }
}

function stopTap() {
  if (S.tap) {
    commit('タップ同期');
  }
  S.tap = null;
  $('tapPanel').hidden = true;
  $('btnTap').setAttribute('aria-pressed', 'false');
  replan();
}

function updateTap() {
  if (!S.tap) return;
  const ln = S.plan.lines[S.tap.i];
  const total = S.plan.lines.length;
  $('tapLine').textContent = ln ? `${S.tap.i + 1}/${total}. ${ln.text}` : '—';
}
window.startTap = startTap;
window.tapNow = tapNow;
window.stopTap = stopTap;

function syncBgMediaUI() {
  const bg = S.project.bgMedia || {};
  if ($('bgFit')) $('bgFit').value = bg.fit || 'cover';
  if ($('bgScale')) $('bgScale').value = bg.scale !== undefined ? bg.scale : 1.0;
  if ($('bgX')) $('bgX').value = bg.x || 0;
  if ($('bgY')) $('bgY').value = bg.y || 0;
  if ($('bgOpacity')) $('bgOpacity').value = bg.opacity !== undefined ? bg.opacity : 1.0;
  if ($('textBlendMode')) $('textBlendMode').value = bg.textBlendMode || 'normal';
  if ($('bgBlendMode')) $('bgBlendMode').value = bg.bgBlendMode || 'normal';
  const infoEl = $('bgMediaInfo');
  if (infoEl) {
    if (bg.type && bg.name) infoEl.textContent = `${bg.type === 'video' ? '動画' : '画像'}: ${bg.name}`;
    else if (typeof J !== 'undefined' && J.bgMedia && J.bgMedia.element) infoEl.textContent = `${J.bgMedia.type === 'video' ? '動画' : '画像'}: 読み込み済み`;
    else infoEl.textContent = '未選択';
  }
}

/* ---------------- block inspector ---------------- */
function syncBlockInspector() {
  const bar = $('blockInspectorBar');
  const btnDel = $('btnDelBlock');
  if (!bar) return;
  const sel = S.selectedBlock;
  if (!sel || !sel.block) {
    bar.hidden = true;
    if (btnDel) btnDel.disabled = true;
    return;
  }
  bar.hidden = false;
  if (btnDel) btnDel.disabled = false;
  const b = sel.block;
  if ($('selBlockLabel')) $('selBlockLabel').textContent = `${sel.track === 'images' ? '画像' : '動画'}: ${b.name || '無題'}`;

  // 現在時刻 S.t における補間値を取得
  const curTrans = (typeof J !== 'undefined' && J.getBlockTransform)
    ? J.getBlockTransform(b, S.t)
    : { x: b.x || 0, y: b.y || 0, scale: b.scale != null ? b.scale : 1.0, opacity: b.opacity != null ? b.opacity : 1.0 };

  // ユーザーが入力フィールドを編集中でなければ入力欄を更新
  const active = document.activeElement;
  const inInspector = bar.contains(active);
  if (!inInspector) {
    if ($('selBlockX')) $('selBlockX').value = Math.round(curTrans.x);
    if ($('selBlockY')) $('selBlockY').value = Math.round(curTrans.y);
    if ($('selBlockScale')) $('selBlockScale').value = parseFloat(curTrans.scale.toFixed(2));
    if ($('selBlockOpacity')) $('selBlockOpacity').value = parseFloat(curTrans.opacity.toFixed(2));
  }
  if ($('selBlockBlend')) $('selBlockBlend').value = b.blendMode || 'normal';

  // キーフレーム判定（現在時刻 S.t 近傍にキーフレームがあるか）
  const curT = S.t;
  const hasKey = b.keyframes && b.keyframes.some(k => Math.abs(k.t - curT) <= 0.05);
  const btnAddKey = $('btnBlockAddKey');
  const btnDelKey = $('btnBlockDelKey');
  if (btnAddKey) {
    btnAddKey.textContent = hasKey ? '◆更新' : '◆＋キー';
    btnAddKey.classList.toggle('active', !!hasKey);
    btnAddKey.title = hasKey ? `現在位置(${curT.toFixed(2)}s)のキーフレーム値を更新` : `現在位置(${curT.toFixed(2)}s)にキーフレームを追加`;
  }
  if (btnDelKey) {
    btnDelKey.disabled = !hasKey;
    btnDelKey.title = hasKey ? `現在位置(${curT.toFixed(2)}s)のキーフレームを削除` : '現在位置にキーフレームがありません';
  }
}

function deleteSelectedBlock() {
  if (!S.selectedBlock || !S.selectedBlock.block) return;
  remember();
  const { track, block } = S.selectedBlock;
  const list = S.project.tracks && S.project.tracks[track];
  if (list) {
    const idx = list.indexOf(block);
    if (idx >= 0) list.splice(idx, 1);
  }
  S.selectedBlock = null;
  syncBlockInspector();
  replan();
  drawTimeline();
  commit();
  flushSave();
  toast('ブロックを削除しました');
}

/* ---------------- sync all inputs from project ---------------- */
function syncUI() {
  $('songTitle').value = S.project.title || ''; $('songArtist').value = S.project.artist || '';
  $('lyrics').value = S.project.lyrics;
  $('bpm').value = S.project.timing.bpm > 0 ? S.project.timing.bpm : '';
  $('bpm').placeholder = S.audio ? `自動 ${S.audio.bpm}` : 'なし';
  $('offset').value = S.project.timing.offset ?? 0.4;
  $('lineScale').value = S.project.timing.lineScale ?? 1;
  $('snap').checked = !!S.project.timing.snap;
  document.querySelectorAll('.wa-toggle').forEach(el => { el.checked = S.project.wa !== false; });
  document.querySelectorAll('.extra-toggle').forEach(el => { el.checked = S.project.extra === true; });
  if ($('lyricLang') && J.LANG_LABEL) { $('lyricLang').value = J.LANG_LABEL[S.project.lang] ? S.project.lang : 'auto'; if (typeof langNote === 'function') langNote(); }
  renderFontRoles(); renderColors(); renderFx(); renderTech(); syncOut(); syncBgMediaUI(); syncBlockInspector(); drawStyleGrid();
}

/* ---------------- wiring ---------------- */
function bind() {
  let textCommitTimer = 0;
  const commitTextSoon = (desc) => {
    clearTimeout(textCommitTimer);
    textCommitTimer = setTimeout(() => {
      if (typeof UndoRedo !== 'undefined') UndoRedo.commit(desc);
    }, 600);
  };
  $('lyrics').addEventListener('input', e => { S.project.lyrics = e.target.value; S.project.rowCache = {}; if (S.project.timing) S.project.timing.cutTimes = null; replanSoon(260); commitTextSoon('歌詞編集'); });
  $('lyrics').addEventListener('blur', () => { clearTimeout(textCommitTimer); if (typeof UndoRedo !== 'undefined') UndoRedo.commit('歌詞確定'); });
  $('lyricLang').addEventListener('change', e => {
    remember();
    S.project.lang = e.target.value; replan(); renderFontRoles(); commit(); flushSave();
    const l = J.resolveLang(S.project);
    toast((S.project.lang === 'auto' ? '歌詞の言語：自動判定 → ' : '歌詞の言語：') + J.LANG_LABEL[l]);
  });
  $('songTitle').addEventListener('input', e => { S.project.title = e.target.value; replanSoon(300); commitTextSoon('タイトル編集'); });
  $('songTitle').addEventListener('blur', () => { clearTimeout(textCommitTimer); if (typeof UndoRedo !== 'undefined') UndoRedo.commit('タイトル確定'); });
  $('songArtist').addEventListener('input', e => { S.project.artist = e.target.value; replanSoon(300); commitTextSoon('アーティスト編集'); });
  $('songArtist').addEventListener('blur', () => { clearTimeout(textCommitTimer); if (typeof UndoRedo !== 'undefined') UndoRedo.commit('アーティスト確定'); });
  $('btnSyntax').addEventListener('click', e => { const s = $('syntax'); s.hidden = !s.hidden; e.target.setAttribute('aria-expanded', String(!s.hidden)); });
  $('bpm').addEventListener('change', e => { S.project.timing.bpm = Math.max(0, parseFloat(e.target.value) || 0); replan(); });
  $('offset').addEventListener('change', e => { S.project.timing.offset = Math.max(0, parseFloat(e.target.value) || 0); replan(); });
  $('lineScale').addEventListener('change', e => { S.project.timing.lineScale = J.clamp(parseFloat(e.target.value) || 1, 0.3, 4); replan(); });
  $('snap').addEventListener('change', e => { S.project.timing.snap = e.target.checked; replan(); });
  $('btnResetTimes').addEventListener('click', () => { S.project.timing.lineTimes = {}; replan(); });
  $('audioFile').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) loadAudioFile(f); });
  $('btnTap').addEventListener('click', () => (S.tap ? stopTap() : startTap()));
  $('tapBtn').addEventListener('click', tapNow);
  $('tapStop').addEventListener('click', () => { pause(); stopTap(); });
  if ($('tapFromStart')) $('tapFromStart').addEventListener('click', () => startTap(0));
  $('btnPlay').addEventListener('click', () => (S.playing ? pause() : play()));
  $('btnLoop').addEventListener('click', e => { S.loop = !S.loop; e.target.setAttribute('aria-pressed', String(S.loop)); });
  $('btnShuffle').addEventListener('click', () => { remember(); S.project.seed = (Math.random() * 1e9) | 0; $('seed').value = S.project.seed; S.project.rowCache = {}; if (S.project.timing) S.project.timing.cutTimes = null; replan(); commit(); });
  const sc = $('scrub');
  sc.addEventListener('input', () => { S.scrubbing = true; seek(sc.value / 10000 * S.plan.duration); });
  sc.addEventListener('change', () => { S.scrubbing = false; });
  const tl = $('timeline');
  let dragMode = null;
  let dragData = null;

  tl.addEventListener('pointerdown', e => {
    if (!S.plan) return;
    const r = tl.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = (e.clientX - r.left) * dpr;
    const py = (e.clientY - r.top) * dpr;
    const w = tl.width || (tl.clientWidth * dpr);
    const h = tl.height || (tl.clientHeight * dpr);
    const hit = hitTestTimeline(px, py, w, h, dpr);
    try { tl.setPointerCapture(e.pointerId); } catch (_) {}

    if (e.shiftKey || e.button === 1) {
      dragMode = 'pan';
      dragData = { startX: px, startScroll: S.timelineScroll };
      return;
    }

    if (hit && (hit.type === 'trim-start' || hit.type === 'trim-end')) {
      remember();
      dragMode = hit.type;
      if (hit.target === 'cut') {
        S.selectedBlock = null;
        syncBlockInspector();
        const c = hit.cut;
        seek(c.start);
        focusLineInList(c.line);
        dragData = {
          target: 'cut',
          cutIndex: hit.index,
          cut: c,
          startX: px,
          origStart: c.start,
          origEnd: c.end,
          origDur: c.end - c.start,
          lineIdx: c.line
        };
      } else {
        S.selectedBlock = { track: hit.track, block: hit.block, index: hit.index };
        syncBlockInspector();
        const b = hit.block;
        dragData = {
          target: 'block',
          track: hit.track,
          block: b,
          startX: px,
          origStart: b.start,
          origEnd: b.end,
          origDur: b.end - b.start
        };
      }
      tl.style.cursor = 'ew-resize';
      S.tlDrag = dragData;
      drawTimeline();
    } else if (hit && hit.type === 'move') {
      remember();
      dragMode = 'move';
      if (hit.target === 'cut') {
        S.selectedBlock = null;
        syncBlockInspector();
        const c = hit.cut;
        seek(c.start);
        focusLineInList(c.line);
        dragData = {
          target: 'cut',
          cutIndex: hit.index,
          cut: c,
          startX: px,
          origStart: c.start,
          origEnd: c.end,
          origDur: c.end - c.start,
          lineIdx: c.line,
          startTime: tlTimeFromPx(px, w),
          isDeleting: false,
          swapCandidate: null
        };
      } else {
        S.selectedBlock = { track: hit.track, block: hit.block, index: hit.index };
        syncBlockInspector();
        const b = hit.block;
        dragData = {
          target: 'block',
          track: hit.track,
          block: b,
          startX: px,
          origStart: b.start,
          origEnd: b.end,
          origDur: b.end - b.start,
          startTime: tlTimeFromPx(px, w),
          isDeleting: false,
          swapCandidate: null
        };
      }
      tl.style.cursor = 'grabbing';
      S.tlDrag = dragData;
      drawTimeline();
    } else {
      dragMode = 'seek';
      S.selectedBlock = null;
      syncBlockInspector();
      drawTimeline();
      timelineSeek(e);
    }
  });

  tl.addEventListener('pointermove', e => {
    const r = tl.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = (e.clientX - r.left) * dpr;
    const py = (e.clientY - r.top) * dpr;
    const w = tl.width || (tl.clientWidth * dpr);
    const h = tl.height || (tl.clientHeight * dpr);

    if (!dragMode) {
      const hit = hitTestTimeline(px, py, w, h, dpr);
      if (hit && (hit.type === 'trim-start' || hit.type === 'trim-end')) {
        tl.style.cursor = 'ew-resize';
      } else if (hit && hit.type === 'move') {
        tl.style.cursor = 'grab';
      } else {
        tl.style.cursor = 'crosshair';
      }
      return;
    }

    if (dragMode === 'pan') {
      const vis = tlVisSec();
      const dxTime = ((px - dragData.startX) / w) * vis;
      S.timelineScroll = Math.max(0, Math.min(dragData.startScroll - dxTime, Math.max(0, S.plan.duration - vis)));
      drawTimeline();
      return;
    }

    if (dragMode === 'seek') {
      timelineSeek(e);
      return;
    }

    // 上外へドラッグ判定（タイムラインキャンバスの上枠より上）
    const isAbove = py < -8 * dpr;
    if (dragMode === 'move') {
      if (isAbove) {
        dragData.isDeleting = true;
        dragData.swapCandidate = null;
        tl.style.cursor = 'no-drop';
        S.tlDrag = dragData;
        drawTimeline();
        return;
      } else {
        if (dragData.isDeleting) {
          dragData.isDeleting = false;
          tl.style.cursor = 'grabbing';
        }
      }
    }

    const curTime = tlTimeFromPx(px, w);

    if (dragData.target === 'cut') {
      const c = dragData.cut;
      const idx = dragData.cutIndex;
      const cuts = S.plan.cuts;
      const minDur = 0.08;

      if (dragMode === 'trim-start') {
        const prevCut = idx > 0 ? cuts[idx - 1] : null;
        let minT = prevCut ? prevCut.start + minDur : 0;
        let maxT = dragData.origEnd - minDur;
        let newT = Math.max(minT, Math.min(curTime, maxT));

        c.start = newT;
        c.dur = Math.max(minDur, c.end - c.start);

        if (prevCut) {
          prevCut.end = newT;
          prevCut.dur = Math.max(minDur, prevCut.end - prevCut.start);
        }
        if (c.line >= 0 && (!prevCut || prevCut.line !== c.line)) {
          if (!S.project.timing.lineTimes) S.project.timing.lineTimes = {};
          S.project.timing.lineTimes[c.line] = c.start;
          if (S.plan.lines[c.line]) S.plan.lines[c.line].start = c.start;
        }
        seek(c.start);
        drawTimeline();
      } else if (dragMode === 'trim-end') {
        const nextCut = idx < cuts.length - 1 ? cuts[idx + 1] : null;
        let minT = dragData.origStart + minDur;
        let maxT = nextCut ? nextCut.end - minDur : S.plan.duration;
        let newT = Math.max(minT, Math.min(curTime, maxT));

        c.end = newT;
        c.dur = Math.max(minDur, c.end - c.start);

        if (nextCut) {
          nextCut.start = newT;
          nextCut.dur = Math.max(minDur, nextCut.end - nextCut.start);
          if (nextCut.line >= 0 && nextCut.line !== c.line) {
            if (!S.project.timing.lineTimes) S.project.timing.lineTimes = {};
            S.project.timing.lineTimes[nextCut.line] = nextCut.start;
            if (S.plan.lines[nextCut.line]) S.plan.lines[nextCut.line].start = nextCut.start;
          }
        }
        seek(c.end);
        drawTimeline();
      } else if (dragMode === 'move') {
        // 他のカットとのスワップ判定
        let swapCut = null, swapIdx = -1;
        for (let i = 0; i < S.plan.cuts.length; i++) {
          if (i === dragData.cutIndex) continue;
          const other = S.plan.cuts[i];
          if (curTime >= other.start && curTime <= other.end) {
            swapCut = other;
            swapIdx = i;
            break;
          }
        }
        if (swapIdx >= 0) {
          dragData.swapCandidate = { type: 'cut', index: swapIdx, cut: swapCut };
        } else {
          dragData.swapCandidate = null;
          // 通常の平行移動
          const delta = curTime - dragData.startTime;
          let ns = dragData.origStart + delta;
          let ne = dragData.origEnd + delta;
          if (ns < 0) { ne -= ns; ns = 0; }
          if (ne > S.plan.duration) { ns -= (ne - S.plan.duration); ne = S.plan.duration; }
          c.start = Math.max(0, ns);
          c.end = Math.max(c.start + 0.1, ne);
          c.dur = c.end - c.start;
          if (c.line >= 0) {
            if (!S.project.timing.lineTimes) S.project.timing.lineTimes = {};
            const lnCuts = S.plan.cuts.filter(x => x.line === c.line);
            if (lnCuts.length && lnCuts[0] === c) {
              S.project.timing.lineTimes[c.line] = c.start;
              if (S.plan.lines[c.line]) S.plan.lines[c.line].start = c.start;
            }
          }
          seek(c.start);
        }
        S.tlDrag = dragData;
        drawTimeline();
      }
    } else if (dragData.target === 'block') {
      const b = dragData.block;
      if (dragMode === 'trim-start') {
        let ns = Math.max(0, Math.min(curTime, dragData.origEnd - 0.1));
        b.start = ns;
        seek(b.start);
        drawTimeline();
      } else if (dragMode === 'trim-end') {
        let ne = Math.min(S.plan.duration, Math.max(curTime, dragData.origStart + 0.1));
        b.end = ne;
        seek(b.end);
        drawTimeline();
      } else if (dragMode === 'move') {
        // 同トラック内の他ブロックとのスワップ判定
        const blocks = (S.project && S.project.tracks && S.project.tracks[dragData.track]) || [];
        let swapBlock = null, swapIdx = -1;
        for (let i = 0; i < blocks.length; i++) {
          if (i === dragData.index) continue;
          const other = blocks[i];
          if (curTime >= other.start && curTime <= other.end) {
            swapBlock = other;
            swapIdx = i;
            break;
          }
        }
        if (swapIdx >= 0) {
          dragData.swapCandidate = { type: 'block', index: swapIdx, block: swapBlock };
        } else {
          dragData.swapCandidate = null;
          const delta = curTime - dragData.startTime;
          let ns = dragData.origStart + delta;
          let ne = dragData.origEnd + delta;
          if (ns < 0) { ne -= ns; ns = 0; }
          if (ne > S.plan.duration) { ns -= (ne - S.plan.duration); ne = S.plan.duration; }
          b.start = Math.max(0, ns);
          b.end = Math.max(b.start + 0.1, ne);
          seek(b.start);
        }
        S.tlDrag = dragData;
        drawTimeline();
      }
    }
  });

  tl.addEventListener('pointerup', () => {
    if (dragMode && dragMode !== 'pan' && dragMode !== 'seek' && dragData) {
      if (dragData.isDeleting) {
        remember();
        if (dragData.target === 'cut') {
          const idx = dragData.cutIndex;
          const cut = dragData.cut;
          const cuts = S.plan.cuts;
          // 1. 直前の要素の終了時間を延長して隙間を自動補間（または直後要素の開始時間を前倒し）
          if (idx > 0) {
            const prev = cuts[idx - 1];
            prev.end = cut.end;
            prev.dur = prev.end - prev.start;
            // 歌詞テキストの合流（同一行ならテキストを直前カットに結合）
            if (prev.line === cut.line && cut.text) {
              if (!prev.text.includes(cut.text)) {
                prev.text = (prev.text + ' ' + cut.text).trim();
              }
            }
          } else if (cuts.length > 1) {
            cuts[1].start = cut.start;
            cuts[1].dur = cuts[1].end - cuts[1].start;
            if (cuts[1].line === cut.line && cut.text) {
              if (!cuts[1].text.includes(cut.text)) {
                cuts[1].text = (cut.text + ' ' + cuts[1].text).trim();
              }
            }
          }
          // 2. タイムラインカット配列から対象カットを削除（※ 歌詞テキスト lyrics には一切触れない！）
          cuts.splice(idx, 1);

          // 3. タイトルカード削除時の特別処理
          if (cut.line === -1) {
            if (S.plan.titleLine) S.plan.titleLine = null;
          }

          // 4. 残存カットリストを永続データとして記録
          if (!S.project.timing) S.project.timing = {};
          S.project.timing.cutTimes = cuts.map(c => ({
            start: +c.start.toFixed(3),
            end: +c.end.toFixed(3),
            line: c.line,
            text: c.text
          }));

          // 5. 該当行のrowCache整合（カット数が減ったため安全に再抽選）
          if (S.project.rowCache && S.project.rowCache[cut.line]) {
            delete S.project.rowCache[cut.line];
          }

          toast('演出を1つ削除し、前の演出で尺とテキストを補間しました');
        } else if (dragData.target === 'block') {
          const trackName = dragData.track;
          const blocks = (S.project && S.project.tracks && S.project.tracks[trackName]) || [];
          const idx = dragData.index;
          if (idx >= 0 && idx < blocks.length) {
            const removed = blocks[idx];
            if (idx > 0) {
              blocks[idx - 1].end = removed.end;
            } else if (blocks.length > 1) {
              blocks[1].start = removed.start;
            }
            blocks.splice(idx, 1);
            S.selectedBlock = null;
            toast('ブロックを削除し、前の要素で尺を補間しました');
          }
        }
      } else if (dragData.swapCandidate) {
        remember();
        if (dragData.target === 'cut' && dragData.swapCandidate.type === 'cut') {
          const idxA = dragData.cutIndex;
          const idxB = dragData.swapCandidate.index;
          const cA = S.plan.cuts[idxA];
          const cB = S.plan.cuts[idxB];
          const rawLines = S.project.lyrics.split('\n');

          if (cA.line >= 0 && cB.line >= 0 && cA.line !== cB.line) {
            // 異なる歌詞行同士のスワップ
            if (rawLines[cA.line] !== undefined && rawLines[cB.line] !== undefined) {
              const tmp = rawLines[cA.line];
              rawLines[cA.line] = rawLines[cB.line];
              rawLines[cB.line] = tmp;
              S.project.lyrics = rawLines.join('\n');
              if ($('lyrics')) $('lyrics').value = S.project.lyrics;

              if (S.project.overrides) {
                const ovA = S.project.overrides[cA.line];
                const ovB = S.project.overrides[cB.line];
                if (ovB) S.project.overrides[cA.line] = ovB; else delete S.project.overrides[cA.line];
                if (ovA) S.project.overrides[cB.line] = ovA; else delete S.project.overrides[cB.line];
              }
              if (S.project.rowCache) {
                const rcA = S.project.rowCache[cA.line];
                const rcB = S.project.rowCache[cB.line];
                if (rcB) S.project.rowCache[cA.line] = rcB; else delete S.project.rowCache[cA.line];
                if (rcA) S.project.rowCache[cB.line] = rcA; else delete S.project.rowCache[cB.line];
              }
            }
          } else if (cA.line >= 0 && cB.line >= 0 && cA.line === cB.line) {
            // 同一行内のカット（フレーズ）同士のスワップ
            const curL = rawLines[cA.line];
            if (curL && curL.includes('/')) {
              const parts = curL.split('/').map(p => p.trim()).filter(Boolean);
              const pIdxA = parts.findIndex(p => p.includes(cA.text) || cA.text.includes(p));
              const pIdxB = parts.findIndex(p => p.includes(cB.text) || cB.text.includes(p));
              if (pIdxA >= 0 && pIdxB >= 0 && pIdxA !== pIdxB) {
                const t = parts[pIdxA];
                parts[pIdxA] = parts[pIdxB];
                parts[pIdxB] = t;
                rawLines[cA.line] = parts.join('/');
                S.project.lyrics = rawLines.join('\n');
                if ($('lyrics')) $('lyrics').value = S.project.lyrics;
              }
            }
          } else if ((cA.line === -1 || cB.line === -1) && cA.line !== cB.line) {
            // タイトルカードと歌詞行のスワップ
            const lIdx = cA.line === -1 ? cB.line : cA.line;
            if (rawLines[lIdx] !== undefined) {
              const oldTitle = S.project.title || '';
              const oldLyric = rawLines[lIdx];
              S.project.title = oldLyric;
              rawLines[lIdx] = oldTitle;
              S.project.lyrics = rawLines.join('\n');
              if ($('songTitle')) $('songTitle').value = S.project.title;
              if ($('lyrics')) $('lyrics').value = S.project.lyrics;
              if (S.project.rowCache) {
                const rcTitle = S.project.rowCache[-1];
                const rcLyric = S.project.rowCache[lIdx];
                if (rcLyric) S.project.rowCache[-1] = rcLyric; else delete S.project.rowCache[-1];
                if (rcTitle) S.project.rowCache[lIdx] = rcTitle; else delete S.project.rowCache[lIdx];
              }
            }
          } else {
            const props = ['text', 'layout', 'enter', 'exit', 'hold', 'decor', 'treat', 'cam', 'scheme', 'seed'];
            for (const p of props) {
              const t = cA[p];
              cA[p] = cB[p];
              cB[p] = t;
            }
          }
          toast('カットを入れ替えました');
        } else if (dragData.target === 'block' && dragData.swapCandidate.type === 'block') {
          const blocks = (S.project && S.project.tracks && S.project.tracks[dragData.track]) || [];
          const bA = blocks[dragData.index];
          const bB = blocks[dragData.swapCandidate.index];
          const keys = ['dataUrl', 'name', 'type', 'blendMode', 'fit', 'opacity', 'scale', 'x', 'y', 'keyframes'];
          for (const k of keys) {
            const t = bA[k];
            bA[k] = bB[k];
            bB[k] = t;
          }
          toast('ブロックを入れ替えました');
        }
      }

      if (dragData.target === 'cut') {
        S.project.timing.cutTimes = S.plan.cuts.map(c => ({
          start: +c.start.toFixed(3),
          end: +c.end.toFixed(3),
          line: c.line,
          text: c.text
        }));
        if (!S.project.timing.lineTimes) S.project.timing.lineTimes = {};
        if (S.plan.lines) {
          S.plan.lines.forEach(ln => {
            const lnCuts = S.plan.cuts.filter(c => c.line === ln.index);
            if (lnCuts.length) {
              S.project.timing.lineTimes[ln.index] = lnCuts[0].start;
            }
          });
        }
        renderLines();
      }

      let actDesc = 'タイムライン操作';
      if (dragData.isDeleting) actDesc = dragData.target === 'cut' ? 'カット削除' : 'ブロック削除';
      else if (dragData.swapCandidate) actDesc = dragData.target === 'cut' ? 'カット入れ替え' : 'ブロック入れ替え';
      else if (dragMode === 'trim-start' || dragMode === 'trim-end') actDesc = dragData.target === 'cut' ? 'カット境界調整' : 'ブロックトリミング';
      else if (dragMode === 'move') actDesc = dragData.target === 'cut' ? 'カット移動' : 'ブロック移動';

      replan();
      commit(actDesc);
      flushSave();
    }
    dragMode = null;
    dragData = null;
    S.tlDrag = null;
    tl.style.cursor = 'default';
    drawTimeline();
  });

  tl.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.altKey) {
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      const oldZoom = S.timelineZoom || 1;
      setTlZoom(Math.max(1, Math.min(10, oldZoom * factor)));
    } else {
      const vis = tlVisSec();
      const shift = (e.deltaY || e.deltaX) * (vis / 800) * 0.4;
      S.timelineScroll = Math.max(0, Math.min(S.timelineScroll + shift, Math.max(0, S.plan.duration - vis)));
      drawTimeline();
    }
  }, { passive: false });

  function setTlZoom(z) {
    const oldVis = tlVisSec();
    const centerT = S.timelineScroll + oldVis / 2;
    S.timelineZoom = z;
    const inp = $('tlZoom'), val = $('tlZoomVal');
    if (inp) inp.value = z.toFixed(1);
    if (val) val.textContent = z.toFixed(1) + 'x';
    const newVis = tlVisSec();
    S.timelineScroll = Math.max(0, Math.min(centerT - newVis / 2, Math.max(0, S.plan.duration - newVis)));
    drawTimeline();
  }

  if ($('tlZoom')) $('tlZoom').addEventListener('input', e => setTlZoom(parseFloat(e.target.value) || 1));
  if ($('btnTlReset')) $('btnTlReset').addEventListener('click', () => {
    S.timelineScroll = 0;
    setTlZoom(1.0);
  });

  // マルチトラック：ブロック追加・削除
  if ($('btnAddImgBlock')) {
    $('btnAddImgBlock').addEventListener('click', () => {
      remember();
      if (!S.project.tracks) S.project.tracks = { images: [], videos: [] };
      if (!S.project.tracks.images) S.project.tracks.images = [];
      const start = S.t;
      const end = Math.min(S.plan.duration, start + 4.0);
      const block = {
        id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: '新規画像',
        start,
        end: Math.max(start + 0.5, end),
        x: 0, y: 0, scale: 1.0, opacity: 1.0,
        blendMode: 'normal',
        fit: 'cover',
        dataUrl: '',
        ready: false
      };
      S.project.tracks.images.push(block);
      S.selectedBlock = { track: 'images', block, index: S.project.tracks.images.length - 1 };
      syncBlockInspector();
      replan();
      drawTimeline();
      commit();
      flushSave();
      toast('画像ブロックを追加しました。素材を選択してください');
      if ($('selBlockFile')) $('selBlockFile').click();
    });
  }

  if ($('btnAddVidBlock')) {
    $('btnAddVidBlock').addEventListener('click', () => {
      remember();
      if (!S.project.tracks) S.project.tracks = { images: [], videos: [] };
      if (!S.project.tracks.videos) S.project.tracks.videos = [];
      const start = S.t;
      const end = Math.min(S.plan.duration, start + 5.0);
      const block = {
        id: 'vid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: '新規動画',
        start,
        end: Math.max(start + 0.5, end),
        x: 0, y: 0, scale: 1.0, opacity: 1.0,
        blendMode: 'normal',
        fit: 'cover',
        dataUrl: '',
        ready: false
      };
      S.project.tracks.videos.push(block);
      S.selectedBlock = { track: 'videos', block, index: S.project.tracks.videos.length - 1 };
      syncBlockInspector();
      replan();
      drawTimeline();
      commit();
      flushSave();
      toast('動画ブロックを追加しました。素材を選択してください');
      if ($('selBlockFile')) $('selBlockFile').click();
    });
  }

  if ($('btnDelBlock')) {
    $('btnDelBlock').addEventListener('click', () => deleteSelectedBlock());
  }

  // キーフレーム追加・更新
  if ($('btnBlockAddKey')) {
    $('btnBlockAddKey').addEventListener('click', () => {
      if (!S.selectedBlock || !S.selectedBlock.block) return;
      remember();
      const b = S.selectedBlock.block;
      if (!b.keyframes) b.keyframes = [];
      const curT = parseFloat(S.t.toFixed(3));
      const curVal = J.getBlockTransform(b, S.t);
      let kf = b.keyframes.find(k => Math.abs(k.t - curT) <= 0.05);
      const isUpdate = !!kf;
      if (!kf) {
        kf = { t: curT, x: curVal.x, y: curVal.y, scale: curVal.scale, opacity: curVal.opacity };
        b.keyframes.push(kf);
        b.keyframes.sort((p, q) => p.t - q.t);
      } else {
        kf.t = curT;
        kf.x = curVal.x;
        kf.y = curVal.y;
        kf.scale = curVal.scale;
        kf.opacity = curVal.opacity;
      }
      syncBlockInspector();
      replan();
      drawTimeline();
      commit();
      flushSave();
      toast(isUpdate ? `キーフレームを更新しました (${curT.toFixed(2)}s)` : `キーフレームを追加しました (${curT.toFixed(2)}s)`);
    });
  }

  // キーフレーム削除
  if ($('btnBlockDelKey')) {
    $('btnBlockDelKey').addEventListener('click', () => {
      if (!S.selectedBlock || !S.selectedBlock.block) return;
      const b = S.selectedBlock.block;
      if (!b.keyframes || !b.keyframes.length) return;
      const curT = S.t;
      const idx = b.keyframes.findIndex(k => Math.abs(k.t - curT) <= 0.05);
      if (idx >= 0) {
        remember();
        b.keyframes.splice(idx, 1);
        syncBlockInspector();
        replan();
        drawTimeline();
        commit();
        flushSave();
        toast('キーフレームを削除しました');
      }
    });
  }

  // ブロックインスペクタパラメータ入力（キーフレーム位置での直接編集 or ベース値編集）
  const onBlockParam = (prop, parser) => e => {
    if (!S.selectedBlock || !S.selectedBlock.block) return;
    remember();
    const b = S.selectedBlock.block;
    const val = parser(e.target.value);
    const curT = S.t;
    const kf = b.keyframes && b.keyframes.find(k => Math.abs(k.t - curT) <= 0.05);
    if (kf && prop !== 'blendMode') {
      kf[prop] = val;
    } else {
      b[prop] = val;
    }
    replan();
    drawTimeline();
    flushSave();
  };
  if ($('selBlockX')) $('selBlockX').addEventListener('input', onBlockParam('x', parseFloat));
  if ($('selBlockY')) $('selBlockY').addEventListener('input', onBlockParam('y', parseFloat));
  if ($('selBlockScale')) $('selBlockScale').addEventListener('input', onBlockParam('scale', parseFloat));
  if ($('selBlockOpacity')) $('selBlockOpacity').addEventListener('input', onBlockParam('opacity', parseFloat));
  if ($('selBlockBlend')) $('selBlockBlend').addEventListener('change', onBlockParam('blendMode', String));

  // ブロック素材ファイルの読み込み・差し替え
  if ($('selBlockFile')) {
    $('selBlockFile').addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if (!file || !S.selectedBlock || !S.selectedBlock.block) return;
      const b = S.selectedBlock.block;
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
      const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
      if (!isVideo && !isImg) { toast('画像または動画ファイルを選択してください'); return; }
      const url = URL.createObjectURL(file);
      b.name = file.name;
      b.url = url;
      if (isVideo) {
        const v = document.createElement('video');
        v.src = url; v.loop = true; v.muted = true; v.playsInline = true;
        await v.play().catch(() => {});
        b.element = v;
        b.ready = true;
      } else {
        const img = new Image();
        img.src = url;
        await new Promise(r => { img.onload = r; img.onerror = r; });
        b.element = img;
        b.ready = true;
      }
      syncBlockInspector();
      replan();
      drawTimeline();
      flushSave();
      toast(`素材「${file.name}」をブロックに設定しました`);
      e.target.value = '';
    });
  }

  // 背景メディアUIイベント
  if ($('bgMediaFile')) {
    $('bgMediaFile').addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
      const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
      if (!isVideo && !isImg) { toast('画像または動画ファイルを選択してください'); return; }
      const url = URL.createObjectURL(file);
      if (isVideo) {
        const v = document.createElement('video');
        v.src = url; v.loop = true; v.muted = true; v.playsInline = true;
        await v.play().catch(() => {});
        J.bgMedia = { type: 'video', element: v, ready: true, name: file.name, url };
      } else {
        const img = new Image();
        img.src = url;
        await new Promise(r => { img.onload = r; img.onerror = r; });
        J.bgMedia = { type: 'image', element: img, ready: true, name: file.name, url };
      }
      if (!S.project.bgMedia) S.project.bgMedia = {};
      S.project.bgMedia.enabled = true;
      S.project.bgMedia.type = isVideo ? 'video' : 'image';
      S.project.bgMedia.name = file.name;
      ['fit', 'scale', 'x', 'y', 'opacity', 'bgBlendMode', 'textBlendMode'].forEach(k => {
        if (S.project.bgMedia[k] !== undefined && J.bgMedia) J.bgMedia[k] = S.project.bgMedia[k];
      });
      syncBgMediaUI();
      replan();
      toast(`${isVideo ? '動画' : '画像'}背景を設定しました`);
    });
  }
  if ($('btnBgMediaClear')) {
    $('btnBgMediaClear').addEventListener('click', () => {
      if (typeof J !== 'undefined' && J.bgMedia && J.bgMedia.url) { try { URL.revokeObjectURL(J.bgMedia.url); } catch(err){} }
      if (typeof J !== 'undefined') J.bgMedia = null;
      if (S.project.bgMedia) {
        S.project.bgMedia.enabled = false;
        S.project.bgMedia.name = '';
        S.project.bgMedia.dataUrl = '';
      }
      syncBgMediaUI();
      replan();
      toast('背景メディアを解除しました');
    });
  }
  const onBgParam = (key, parser) => e => {
    if (!S.project.bgMedia) S.project.bgMedia = {};
    S.project.bgMedia[key] = parser(e.target.value);
    if (typeof J !== 'undefined' && J.bgMedia) J.bgMedia[key] = S.project.bgMedia[key];
    replan();
    flushSave();
  };
  if ($('bgFit')) $('bgFit').addEventListener('change', onBgParam('fit', String));
  if ($('bgScale')) $('bgScale').addEventListener('input', onBgParam('scale', parseFloat));
  if ($('bgX')) $('bgX').addEventListener('input', onBgParam('x', parseFloat));
  if ($('bgY')) $('bgY').addEventListener('input', onBgParam('y', parseFloat));
  if ($('bgOpacity')) $('bgOpacity').addEventListener('input', onBgParam('opacity', parseFloat));
  if ($('textBlendMode')) $('textBlendMode').addEventListener('change', onBgParam('textBlendMode', String));
  if ($('bgBlendMode')) $('bgBlendMode').addEventListener('change', onBgParam('bgBlendMode', String));
  if ($('btnBgResetTransform')) {
    $('btnBgResetTransform').addEventListener('click', () => {
      if (!S.project.bgMedia) S.project.bgMedia = {};
      Object.assign(S.project.bgMedia, { scale: 1.0, x: 0, y: 0, opacity: 1.0, fit: 'cover' });
      if (typeof J !== 'undefined' && J.bgMedia) Object.assign(J.bgMedia, { scale: 1.0, x: 0, y: 0, opacity: 1.0, fit: 'cover' });
      syncBgMediaUI();
      replan();
      toast('変形をリセットしました');
    });
  }
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('.tabpane').forEach(p => { p.hidden = p.dataset.pane !== b.dataset.tab; });
    if (b.dataset.tab === 'out') codecNote();
    loadThumbFonts();
  }));
  $('fxFlash').addEventListener('change', e => { S.project.fx.flash = e.target.checked; replan(); });
  $('techFilter').addEventListener('input', () => renderTech());
  const setSwitch = (cls, key, on, msgOn, msgOff) => document.querySelectorAll('.' + cls).forEach(el => el.addEventListener('change', e => {
    remember();
    S.project[key] = e.target.checked;
    document.querySelectorAll('.' + cls).forEach(x => { x.checked = e.target.checked; });
    renderTech(); drawStyleGrid(); replan(); commit(); flushSave();
    toast(e.target.checked ? msgOn : msgOff);
  }));
  setSwitch('extra-toggle', 'extra', true, '追加分の演出：使う', '追加分の演出：使わない（最初の公開版の演出だけ）');
  setSwitch('wa-toggle', 'wa', true, '和風の演出：使う', '和風の演出：使わない（おまかせ・シャッフルで選ばれません）');
  $('fxKoma').addEventListener('change', e => { const k = +e.target.value; S.project.fx.koma = k; S.project.fx.onTwos = k > 0; S.project.mood = null; replan(); });
  $('fxHud').addEventListener('change', e => { S.project.fx.hud = e.target.value; replan(); });
  $('seed').addEventListener('change', e => { remember(); S.project.seed = parseInt(e.target.value, 10) || 0; S.project.rowCache = {}; if (S.project.timing) S.project.timing.cutTimes = null; replan(); commit('シード変更'); });
  $('btnSeed').addEventListener('click', () => { remember(); S.project.seed = (Math.random() * 1e9) | 0; $('seed').value = S.project.seed; S.project.rowCache = {}; if (S.project.timing) S.project.timing.cutTimes = null; replan(); commit('シード再抽選'); });
  const colorToggle = (flag, keys) => e => {
    remember();
    const c = S.project.colors; c[flag] = e.target.checked;
    if (c[flag]) { const sc0 = J.STYLES[S.project.style].schemes[0]; keys.forEach(([k]) => { if (!c[k]) c[k] = sc0[k]; }); }
    renderColors(); replan(); commit();
  };
  $('colorOn').addEventListener('change', colorToggle('enabled', BASE_KEYS));
  $('accentOn').addEventListener('change', colorToggle('accentOn', ACCENT_KEYS));
  $('btnRandPalette').addEventListener('click', randomPalette);
  $('btnAddFont').addEventListener('click', () => {
    const name = $('localFont').value.trim(); if (!name) return;
    const key = 'local_' + name.replace(/\s+/g, '_');
    const weight = /bold|太|black|heavy|w[6-9]|[6-9]00/i.test(name) ? 700 : 400;
    J.addUserFont(key, name + '（PC）', name, weight);
    S.project.userFonts = (S.project.userFonts || []).filter(u => u.key !== key).concat([{ key, label: name + '（PC）', family: name, weight }]);
    S.project.fonts.display = key; $('localFont').value = '';
    fontKey = ''; renderFontRoles(); replan();
  });
  $('fontFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { const key = await J.loadFontFile(f); S.project.fonts.display = key; fontKey = ''; renderFontRoles(); replan(); }
    catch (err) { showMsg('フォントを読み込めませんでした'); setTimeout(() => showMsg(null), 2500); }
  });
  ['outAspect', 'eAspect'].forEach(id => $(id).addEventListener('change', e => { S.project.aspect = e.target.value; syncOut(); replan(); codecNote(); }));
  ['outRes', 'eRes'].forEach(id => $(id).addEventListener('change', e => { S.project.res = +e.target.value; syncOut(); autosave(); codecNote(); }));
  ['outFps', 'eFps'].forEach(id => $(id).addEventListener('change', e => { S.project.fps = +e.target.value; syncOut(); replan(); codecNote(); }));
  $('outQuality').addEventListener('change', e => { S.project.quality = e.target.value; autosave(); });
  ['outKey', 'eKey'].forEach(id => $(id).addEventListener('change', e => {
    S.project.keyBg = e.target.value; syncOut(); replan(); flushSave();
    const k = J.keyMode(S.project);
    toast(k ? `背景：${k === 'green' ? 'グリーンバック' : 'ブラックバック'}（白い文字と演出だけ）` : '背景：通常（スタイルの配色）');
  }));
  $('outAudio').addEventListener('change', e => { S.project.includeAudio = e.target.checked; autosave(); });
  $('btnMP4').addEventListener('click', () => runExport('mp4'));
  $('btnPNG').addEventListener('click', () => runExport('png'));
  $('btnPNGA').addEventListener('click', () => runExport('pnga'));
  $('btnPNGL').addEventListener('click', () => runExport('pngl'));
  document.querySelectorAll('.exp-cancel').forEach(b => b.addEventListener('click', () => { if (S.exporting) S.exporting.abort(); }));
  $('eMP4').addEventListener('click', () => runExport('mp4'));
  // かんたんモード
  $('modeEasy').addEventListener('click', () => setMode('easy'));
  $('modePro').addEventListener('click', () => setMode('pro'));
  $('btnOmakase').addEventListener('click', omakase);
  $('btnOmakaseBig').addEventListener('click', omakase);
  ['btnPrev', 'btnPrev2'].forEach(id => $(id).addEventListener('click', () => histGo(-1)));
  ['btnNext', 'btnNext2'].forEach(id => $(id).addEventListener('click', () => histGo(1)));
  $('eStyle').addEventListener('click', () => rerollPart('style'));
  $('eMood').addEventListener('click', () => rerollPart('mood'));
  $('eCut').addEventListener('click', () => rerollPart('cut'));
  $('ePalette').addEventListener('click', () => { randomPalette(); restartPreview(); });
  // 利用について（出力物の権利・ライセンス）
  const dlg = $('termsDlg');
  const openTerms = () => { if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', ''); };
  document.querySelectorAll('.terms-open').forEach(b => b.addEventListener('click', openTerms));
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close ? dlg.close() : dlg.removeAttribute('open'); });   // click on the backdrop
  $('btnSave').addEventListener('click', () => J.saveFile(baseName() + '.jizura.json', JSON.stringify(S.project, null, 1)));
  $('btnAE').addEventListener('click', () => J.saveFile(baseName() + '_ae.json', JSON.stringify(J.planForAE(S.plan, S.project), null, 1)));
  $('fileProject').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { S.project = mergeProject(JSON.parse(await f.text())); syncUI(); replan(); }
    catch (err) { showMsg('プロジェクトを読み込めませんでした'); setTimeout(() => showMsg(null), 2500); }
    e.target.value = '';
  });
  document.addEventListener('keydown', e => {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl) {
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        UndoRedo.undo();
        return;
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        UndoRedo.redo();
        return;
      }
    }
    const tag = (e.target && e.target.tagName) || '';
    const typing = /INPUT|TEXTAREA|SELECT/.test(tag) && e.target.type !== 'range' && e.target.type !== 'checkbox';
    if (S.tap && (e.code === 'Space' || e.code === 'Enter') && !typing) { e.preventDefault(); tapNow(); return; }
    if (S.tap && e.code === 'Escape') { pause(); stopTap(); return; }
    if (typing || $('termsDlg').open) return;
    if (e.code === 'Space') { e.preventDefault(); S.playing ? pause() : play(); }
    else if (e.code === 'ArrowRight') seek(S.t + (e.shiftKey ? 1 : 1 / S.plan.fps));
    else if (e.code === 'ArrowLeft') seek(S.t - (e.shiftKey ? 1 : 1 / S.plan.fps));
    else if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey && !e.altKey && !S.exporting) { e.preventDefault(); omakase(); }
    else if ((e.code === 'Delete' || e.code === 'Backspace') && S.selectedBlock) { e.preventDefault(); deleteSelectedBlock(); }
  });
  window.addEventListener('resize', () => { sizeViewport(); drawTimeline(); });
  if (window.ResizeObserver) new ResizeObserver(() => { sizeViewport(); drawTimeline(); }).observe($('viewport'));
}

/* song file -> beat analysis (file input, or a host such as the After Effects panel) */
async function loadAudioFile(f) {
  $('audioName').textContent = '解析中…';
  try {
    pause();
    S.audio = await J.analyzeAudio(f);
    $('audioName').textContent = `${f.name}（${J.fmtTime(S.audio.duration)}・約${S.audio.bpm}BPM）`;
    S.project.timing.snap = true;
    syncUI(); replan();
    return true;
  } catch (err) { $('audioName').textContent = '読み込めませんでした: ' + err.message; S.audio = null; return false; }
}

/* ---------------- boot ---------------- */
function boot() {
  S.project = loadLocal();
  if (typeof UndoRedo !== 'undefined') UndoRedo.init(S.project);
  bind(); initVolume(); syncUI(); replan();
  let mode = 'easy'; try { mode = localStorage.getItem('jizura.mode') || 'easy'; } catch (e) {}
  setMode(mode); commit();
  // open on a representative frame (end of the first cut's entrance)
  const c0 = S.plan.cuts.find(c => c.line >= 0);
  if (c0) seek(c0.start + Math.min(c0.dur * 0.6, c0.inDur + 0.25));
  requestAnimationFrame(tick);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
J.ui = S;
// hooks for hosts that embed the app (the After Effects CEP panel)
J.uiApi = { toast, replan, syncUI, pause, seek, flushSave, loadAudioFile, restartPreview, UndoRedo };
})();
