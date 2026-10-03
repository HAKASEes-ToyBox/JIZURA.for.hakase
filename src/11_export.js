/* ============================================================
   JIZURA — export: MP4 (WebCodecs + mp4-muxer), PNG sequence ZIP,
   file saving (artifact download capability or plain browser download)
   ============================================================ */
(() => {
'use strict';

/* ---------- saving ---------- */
J.exportFilename = (value, extension, fallback = 'jizura') => {
  let name = String(value || '').trim().replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '_').replace(/[. ]+$/g, '');
  if (name.toLowerCase().endsWith(extension.toLowerCase())) name = name.slice(0, -extension.length);
  name = name.replace(/[. ]+$/g, '').slice(0, 160) || fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_' + name;
  return name + extension;
};
J.saveFile = async (filename, data) => {
  const blob = data instanceof Blob ? data : new Blob([data]);
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      const dl = await window.claude.use('downloads');
      if (dl) { await dl.save({ filename, data: blob }); return 'saved'; }
    }
  } catch (e) {
    if (e && e.code === 'declined') return 'declined';
    if (e && e.code && e.code !== 'unavailable' && e.code !== 'not_granted') throw e;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'saved';
};

/* ---------- codec negotiation ---------- */
J.pickVideoCodec = async (w, h, fps, bitrate, {bitrateMode='variable'}={}) => {
  if (typeof VideoEncoder === 'undefined') return null;
  const cands = [
    { codec: 'avc1.640033', mux: 'avc', label: 'H.264 High' },
    { codec: 'avc1.4d0033', mux: 'avc', label: 'H.264 Main' },
    { codec: 'avc1.42003e', mux: 'avc', label: 'H.264 Baseline' },
    { codec: 'vp09.00.51.08', mux: 'vp9', label: 'VP9' },
    { codec: 'av01.0.12M.08', mux: 'av1', label: 'AV1' },
  ];
  for (const c of cands) {
    // Keep H.264's 0–51 QP scale; never substitute another codec or bitrate mode.
    if(bitrateMode==='quantizer'&&c.mux!=='avc')continue;
    const cfg = { codec: c.codec, width: w, height: h, framerate: fps, bitrateMode, latencyMode:'quality' };
    if(bitrateMode!=='quantizer')cfg.bitrate=bitrate;
    if (c.mux === 'avc') cfg.avc = { format: 'avc' };
    try { const s = await VideoEncoder.isConfigSupported(cfg); if (s.supported && (bitrateMode!=='quantizer'||s.config.bitrateMode==='quantizer')) return Object.assign({}, c, { cfg }); } catch (e) {}
  }
  return null;
};
J.pickAudioCodec = async (sr, chn) => {
  if (typeof AudioEncoder === 'undefined') return null;
  for (const c of [{ codec: 'mp4a.40.2', mux: 'aac', sr: 48000 }, { codec: 'opus', mux: 'opus', sr: 48000 }]) {
    try { const s = await AudioEncoder.isConfigSupported({ codec: c.codec, sampleRate: c.sr, numberOfChannels: chn, bitrate: 192000 }); if (s.supported) return c; } catch (e) {}
  }
  return null;
};

async function resample(buffer, sr, duration, start = 0) {
  const chn = Math.min(2, buffer.numberOfChannels);
  const len = Math.ceil(duration * sr);
  const oc = new OfflineAudioContext(chn, len, sr);
  const src = oc.createBufferSource(); src.buffer = buffer; src.connect(oc.destination); if(start<buffer.duration)src.start(0,start);
  return oc.startRendering();
}

/* ---------- MP4 ---------- */
// One source for the UI labels, codec probe and actual video encoder (bits/s).
J.videoBitrate = (project, quality=project.quality||'high', fps=project.fps) => {
  const [w,h]=J.outputSize(project),px=w*h*fps;
  const bitrate=quality==='custom' ? (project.exportBitrate ?? px*.28)
    : px*(quality==='max' ? .42 : quality==='high' ? .28 : .16);
  if(!Number.isFinite(bitrate)||bitrate<1||bitrate>Number.MAX_SAFE_INTEGER)throw new Error(J.mediaLabel('ビットレートは正の数で指定してください。','Enter a positive bitrate.'));
  return Math.round(bitrate);
};
J.videoQuantizer = project => {
  const qp=project.exportQP ?? 12;
  if(!Number.isInteger(qp)||qp<0||qp>51)throw new Error(J.mediaLabel('QPは0～51の整数で指定してください。','Enter an integer QP from 0 to 51.'));
  return qp;
};
// The muxer patches earlier headers. Keep positional writes and avoid a single
// allocation proportional to the entire movie (especially large QP0 exports).
J.createMP4Output = fileStream => {
  let parts=[],size=0,queue=Promise.resolve(),error=null;
  const write=(data,position)=>{
    const append=position===size;
    size=Math.max(size,position+data.byteLength);
    if(fileStream){queue=queue.then(()=>fileStream.write({type:'write',position,data})).catch(e=>{error ||= e;});return;}
    if(append){parts.push({start:position,end:size,blob:new Blob([data])});return;}
    const end=position+data.byteLength,next=[];
    for(const part of parts){
      if(part.end<=position||part.start>=end){next.push(part);continue;}
      if(part.start<position)next.push({start:part.start,end:position,blob:part.blob.slice(0,position-part.start)});
      if(part.end>end)next.push({start:end,end:part.end,blob:part.blob.slice(end-part.start)});
    }
    next.push({start:position,end,blob:new Blob([data])});parts=next.sort((a,b)=>a.start-b.start);
  };
  const drain=async()=>{await queue;if(error)throw error;};
  return {
    target:new Mp4Muxer.StreamTarget({onData:write,chunked:true,chunkSize:1024*1024}),
    drain,
    async finish(){
      await drain();
      if(fileStream){await fileStream.close();return {saved:true,size,blob:null};}
      let at=0;for(const part of parts){if(part.start!==at)throw Error('Incomplete MP4 output');at=part.end;}
      const blob=new Blob(parts.map(part=>part.blob),{type:'video/mp4'});parts=[];
      return {saved:false,size:blob.size,blob};
    },
    async abort(){parts=[];await queue;if(fileStream)try{await fileStream.abort();}catch{}}
  };
};
J.exportMP4 = async ({ plan, project, audio, quality = project.quality||'high', onProgress, signal, fileStream, short }) => {
  if(short)project=J.shortExportProject(project,short);
  const range=short?J.shortExportRange(plan,short):{start:0,end:plan.duration},duration=range.end-range.start;
  J.mediaTransitionFrame = null;
  J.foregroundTransitionFrame = null;
  const [w, h] = J.outputSize(project);
  const fps = plan.fps;
  const qp=quality==='qp'?J.videoQuantizer(project):null;
  const bitrate = qp==null ? J.videoBitrate(project,quality,fps) : undefined;
  const vc = await J.pickVideoCodec(w, h, fps, bitrate,{bitrateMode:qp==null?'variable':'quantizer'});
  if(!vc&&qp!=null)throw new Error(J.mediaLabel('このブラウザは画質優先（QP指定）に対応していません。別の画質設定または連番PNGを使用してください。','This browser does not support QP encoding. Choose another quality setting or a PNG sequence.'));
  if (!vc) throw new Error('このブラウザは動画エンコード（WebCodecs）に対応していません。Chrome か Edge の最新版で開いてください。');
  let ac = null;
  if (audio && audio.buffer && project.includeAudio !== false) ac = await J.pickAudioCodec(48000, Math.min(2, audio.buffer.numberOfChannels));
  const output=J.createMP4Output(fileStream);
  let venc,aenc,completed=false;
  try {
  const muxOpts = { target:output.target, video: { codec: vc.mux, width: w, height: h, frameRate: fps }, fastStart: false, firstTimestampBehavior: 'offset' };
  if (ac) muxOpts.audio = { codec: ac.mux, numberOfChannels: Math.min(2, audio.buffer.numberOfChannels), sampleRate: ac.sr };
  const muxer = new Mp4Muxer.Muxer(muxOpts);
  let err = null;
  venc = new VideoEncoder({ output: (chunk, meta) => {try{muxer.addVideoChunk(chunk,meta);}catch(e){err=e;}}, error: e => { err = e; } });
  venc.configure(Object.assign({}, vc.cfg, { latencyMode: 'quality' }));
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  const R = new J.Renderer();
  const total = Math.max(1, Math.round(duration * fps));
  const source=short?document.createElement('canvas'):canvas;
  if(short){const fit=Math.min(w/plan.W,h/plan.H);source.width=Math.max(1,Math.round(plan.W*fit));source.height=Math.max(1,Math.round(plan.H*fit));}
  const sourceCtx=short?source.getContext('2d',{alpha:false}):ctx,portrait=short?new J.ShortFrameRenderer():null;
  const scale = source.width / plan.W;
  const prevRes = J.glyphs.maxRes; J.glyphs.maxRes = h >= 1000 ? 768 : 512;
  try {
  for (let i = 0; i < total; i++) {
    if (signal && signal.aborted) { try { venc.close(); } catch (e) {} throw new Error('キャンセルしました'); }
    if (err) throw err;
    const time=range.start+i/fps;
    await J.prepareMediaFrame(plan, time, signal);
    R.frame(sourceCtx, plan, time, { scale });
    if(portrait)portrait.frame(ctx,source,short);
    const vf = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
    try{venc.encode(vf, { keyFrame: i % (fps * 2) === 0,...(qp==null?{}:{avc:{quantizer:qp}}) });}
    finally{vf.close();}
    while (venc.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 2));
    await output.drain();
    if (i % 3 === 0) { onProgress && onProgress(i / total, `フレーム ${i + 1}/${total}`); await new Promise(r => setTimeout(r, 0)); }
  }
  } finally { J.glyphs.maxRes = prevRes; }
  await venc.flush(); venc.close();
  if(err)throw err;
  await output.drain();
  if (ac) {
    onProgress && onProgress(0.99, '音声をエンコード中');
    const rs = await resample(audio.buffer, ac.sr, duration, range.start);
    const chn = rs.numberOfChannels;
    aenc = new AudioEncoder({ output: (chunk, meta) => {try{muxer.addAudioChunk(chunk,meta);}catch(e){err=e;}}, error: e => { err = e; } });
    aenc.configure({ codec: ac.codec, sampleRate: ac.sr, numberOfChannels: chn, bitrate: 192000 });
    const frames = rs.length, block = 4800;
    for (let off = 0; off < frames; off += block) {
      const n = Math.min(block, frames - off);
      const data = new Float32Array(n * chn);
      for (let c = 0; c < chn; c++) data.set(rs.getChannelData(c).subarray(off, off + n), c * n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: ac.sr, numberOfFrames: n, numberOfChannels: chn, timestamp: Math.round(off * 1e6 / ac.sr), data });
      aenc.encode(ad); ad.close();
      if (aenc.encodeQueueSize > 16) await new Promise(r => setTimeout(r, 1));
      await output.drain();
      if(signal?.aborted)throw new Error('キャンセルしました');
      if(err)throw err;
    }
    await aenc.flush(); aenc.close();
    if (err) throw err;
  }
  muxer.finalize();
  if(signal?.aborted)throw new Error('キャンセルしました');
  const saved=await output.finish();completed=true;
  onProgress && onProgress(1, '完了');
  return { ...saved, codec: vc.label, audio: ac ? ac.mux : null, width: w, height: h };
  } finally {
    if(venc&&venc.state!=='closed')try{venc.close();}catch{}
    if(aenc&&aenc.state!=='closed')try{aenc.close();}catch{}
    if(!completed)await output.abort();
  }
};

/* ---------- PNG sequence as ZIP (store, no compression) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
class ZipWriter {
  constructor() { this.parts = []; this.central = []; this.offset = 0; }
  add(name, u8) {
    const nb = new TextEncoder().encode(name), crc = crc32(u8);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, u8.length, true); lh.setUint32(22, u8.length, true);
    lh.setUint16(26, nb.length, true); lh.setUint16(28, 0, true);
    this.parts.push(lh.buffer, nb, u8);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, u8.length, true); ch.setUint32(24, u8.length, true);
    ch.setUint16(28, nb.length, true); ch.setUint32(42, this.offset, true);
    this.central.push(ch.buffer, nb);
    this.offset += 30 + nb.length + u8.length;
  }
  finish() {
    const cdSize = this.central.reduce((s, p) => s + (p.byteLength ?? p.length), 0);
    const n = this.central.length / 2;
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, n, true); end.setUint16(10, n, true); end.setUint32(12, cdSize, true); end.setUint32(16, this.offset, true);
    return new Blob([...this.parts, ...this.central, end.buffer], { type: 'application/zip' });
  }
}
J.exportPNGZip = async ({ plan, project, transparent, onProgress, signal, every = 1 }) => {
  J.mediaTransitionFrame = null;
  J.foregroundTransitionFrame = null;
  const [w, h] = J.outputSize(project);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const R = new J.Renderer();
  const fps = plan.fps, total = Math.max(1, Math.round(plan.duration * fps));
  const zip = new ZipWriter();
  const scale = w / plan.W;
  for (let i = 0; i < total; i += every) {
    if (signal && signal.aborted) throw new Error('キャンセルしました');
    await J.prepareMediaFrame(plan, i / fps, signal);
    R.frame(ctx, plan, i / fps, { scale, transparent });
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    zip.add(`jizura_${String(i).padStart(5, '0')}.png`, new Uint8Array(await blob.arrayBuffer()));
    onProgress && onProgress(i / total, `PNG ${i + 1}/${total}`);
  }
  onProgress && onProgress(1, '完了');
  return zip.finish();
};

/* ---------- plan JSON for the After Effects panel ---------- */
/* The After Effects panel implements the original expression set. Newer pack entries are exported as their
   closest original counterpart (the browser key is kept in web* fields so nothing is lost). */
J.AE_MAP = {
  layout: { lowerThird: 'center', corners: 'mixed', staircase: 'mixed', zigzag: 'wave', arcTop: 'ring', spiral: 'ring', gridCells: 'labels', dropCap: 'mixed', justified: 'tile', frameBox: 'center', bubble: 'pill', subtitleBar: 'center', ticker: 'marquee', splitScreen: 'diag', mirror: 'stack', sideways: 'vcols', edgeFrame: 'marquee', perspective: 'stack', hanko: 'vcols', genkou: 'vcols', panels: 'diag', filmstrip: 'labels', quote: 'center', ruler: 'gloss', searchBar: 'type', chat: 'labels', notification: 'pill', ticket: 'pill',
    rain: 'tile', hanging: 'scatter', orbit: 'ring', tunnel: 'tile', wordCloud: 'scatter', bounceLine: 'mixed', elastic: 'condensed', crossBands: 'diag', stickerBomb: 'labels', neon: 'center', keycaps: 'labels', bubbles: 'scatter', slotMachine: 'labels', flipBoard: 'labels', credits: 'type', zoomRepeat: 'stack', splitHalves: 'stack', columnsBig: 'vcols', circleWords: 'ring', dotMatrix: 'type', depthStack: 'stack', typeSpecimen: 'stack', kanjiFocus: 'huge', halfVertical: 'vcols', curtain: 'center', equalizer: 'mixed', tape: 'diag' },
  enter: { riseMask: 'drop', dropMask: 'drop', slideL: 'wipe', slideR: 'wipe', slideWhole: 'stretch', flipX: 'spin', flipY: 'spin', domino: 'spin', fold: 'pop', unroll: 'wipe', strokeDraw: 'assemble', outlineFill: 'blur', splitJoin: 'slice', vSlice: 'slice', shutter: 'wipe', iris: 'zoom', diagWipe: 'wipe', blinds: 'slice', checker: 'flicker', randomOrder: 'flicker', bounceBig: 'drop', squashDrop: 'drop', rubber: 'stretch', glitchIn: 'scramble', echoIn: 'zoom', whip: 'stretch', skewIn: 'stretch', trackIn: 'blur', trackOut: 'blur', blurStagger: 'blur', fadeStagger: 'blur', waveIn: 'pop', spiralIn: 'spin', zoomOut: 'zoom', resolve: 'scramble', magnet: 'assemble', inkBleed: 'blur', neonOn: 'flicker', cursorSweep: 'type', stamp: 'zoom' },
  exit: { sinkMask: 'fall', riseOut: 'drift', slideOutL: 'stretch', slideOutR: 'stretch', flipOutX: 'shrink', flipOutY: 'fall', foldOut: 'shrink', squash: 'shrink', trackOutWide: 'blur', collapse: 'shrink', zoomThrough: 'blur', zoomFar: 'shrink', spinOut: 'scatter', twist: 'shrink', waveOut: 'scatter', blurOutStagger: 'blur', undraw: 'blur', outlineOut: 'blur', irisClose: 'shrink', diagWipeOut: 'wipe', blindsClose: 'slice', checkerOut: 'glitch', splitApart: 'slice', vSliceDrop: 'fall', melt: 'fall', dissolve: 'drift', backspace: 'wipe', scrambleOut: 'glitch', glitchDissolve: 'glitch', echoOut: 'blur', whipOut: 'stretch', gravity: 'fall', popOut: 'scatter', burn: 'drift', sweepCover: 'wipe', shatterLite: 'explode' },
  hold: { float: 'drift', sway: 'wave', pulse: 'breathe', shimmer: 'still', colorRun: 'still', rotateSlow: 'drift', trackBreathe: 'breathe', skewWobble: 'wave', beatHop: 'wave', hWave: 'wave', heartbeat: 'breathe', orbitSmall: 'jitter', jelly: 'breathe', scanBand: 'glitchtick', noiseDrift: 'drift', tilt: 'drift', zoomSlow: 'drift', stretchPulse: 'breathe', glitchJump: 'glitchtick', echoTrail: 'drift' },
  decor: { crosshair: 'brackets', cropMarks: 'brackets', reticle: 'rings', radar: 'rings', progressRing: 'rings', timecodeBar: 'barcode', rulerEdge: 'grid', dimension: 'leaders', indexNum: 'counter', dateStamp: 'barcode', qrBlock: 'barcode', glitchRects: 'bars', concentricSquares: 'shapes', triangleSpin: 'shapes', lineBurst: 'sparks', plusGrid: 'grid', guides: 'grid', waveLine: 'waveform', spiralLine: 'rings', halftonePatch: 'shapes', checkerStrip: 'stripes', beatRing: 'rings', orbitDots: 'dots', constellation: 'sparks', confetti: 'shapes', petals: 'shapes', rainStreaks: 'slash', snow: 'dots', lightLeak: 'blobs', bokeh: 'blobs', speedCorner: 'slash', risingParticles: 'sparks', twinkle: 'sparks', brushStroke: 'bars', tapePieces: 'bars', scribbleCircle: 'rings', scribbleUnder: 'slash', crossOut: 'slash', highlightMark: 'bars', heartsStars: 'shapes', watermarkKanji: 'counter', verticalStrip: 'leaders', romajiLine: 'leaders', bracketsJP: 'brackets', seal: 'shapes' },
  fx: { rgbSplit: 'chroma', smear: 'slice', vhsRoll: 'slice', trackingNoise: 'slice', waveWarp: 'slice', pixelDrift: 'slice', tileShift: 'block', gridRepeat: 'block', mirrorFlash: 'block', strobe: 'invert', blackFrame: 'invert', whiteFrame: 'flash', filmBurn: 'flash', lightSweep: 'flash', panelWipe: 'flash', zoomPunch: 'zoom', whipBlur: 'zoom', posterize: 'mosaic', hueShift: 'chroma', irisTrans: 'zoom', doors: 'slice', blindsTrans: 'slice', splitSlide: 'slice', crtOff: 'flash' },
};
// The plan goes to the After Effects panel as-is (version 2): the panel builds every key it implements and
// picks the closest counterpart itself (from the exported metadata / J.AE_MAP) for anything it lacks.
J.planForAE = (plan, project) => {
  const clean = JSON.parse(JSON.stringify(plan, (k, v) => (k === 'energy' || k === 'buffer' || k === 'peaks' ? undefined : v)));
  if(plan.layerVisibility?.lyrics===false){clean.cuts=[];clean.lines=[];clean.events=[];clean.retainedCutIndices=[];clean.hud=false;}
  for(const layer of ['foreground','media'])if(plan.layerVisibility?.[layer]===false && clean[layer])clean[layer].cuts=[];
  clean.version = 2;
  clean.width = J.outputSize(project)[0]; clean.height = J.outputSize(project)[1];
  clean.extra = project.extra === true; clean.wa = project.wa !== false;
  clean.fonts = {};
  for (const [role, keys] of Object.entries(plan.style.fonts)) clean.fonts[role] = keys.map(k => J.FONTS[k] ? J.FONTS[k].label : k);
  clean.fontTable = Object.fromEntries(Object.entries(J.FONTS).map(([k, f]) => [k, { label: f.label, family: f.family.replace(/"/g, ''), weight: f.weight, kind: f.kind }]));
  // lyric language: the face each key is drawn with in the browser for this plan (the panel maps keys → AE fonts per language)
  clean.lang = plan.lang || 'ja';
  if (J.setLang && J.faceOf && clean.lang !== 'ja') {
    J.setLang(clean.lang);
    for (const k of Object.keys(clean.fontTable)) { const f = J.faceOf(k); clean.fontTable[k].langFamily = f.family.replace(/"/g, ''); clean.fontTable[k].langWeight = f.weight; }
  }
  return clean;
};
})();
