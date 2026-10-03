/* ============================================================
   JIZURA — audio: decode, energy envelope, onset, BPM & beat grid
   ============================================================ */
(() => {
'use strict';

J.isVideoFile = file => file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm|ogv|mkv)$/i.test(file.name);
J.videoFileDuration = file => new Promise((resolve,reject) => {
  const video=document.createElement('video'),url=URL.createObjectURL(file);
  const finish=(error)=>{clearTimeout(timer);video.onloadedmetadata=video.ondurationchange=video.onerror=null;const duration=video.duration;video.removeAttribute('src');video.load();URL.revokeObjectURL(url);error?reject(error):resolve(duration);};
  const timer=setTimeout(()=>finish(new Error(J.mediaLabel('動画の読み込みがタイムアウトしました','Video loading timed out'))),30000);
  video.onloadedmetadata=()=>{video.onloadedmetadata=video.onerror=null;finish(Number.isFinite(video.duration)&&video.duration>0?null:new Error(J.mediaLabel('動画の長さを取得できませんでした','Could not read video duration')));};
  video.onerror=()=>{video.onloadedmetadata=video.onerror=null;finish(new Error(J.mediaLabel('この動画形式を読み込めません','Unsupported video format')));};
  video.preload='metadata';video.src=url;
});
// Save extracted sound as PCM WAV so project restore / export only needs audio.
J.audioWaveFile = (buffer,name) => {
  const channels=buffer.numberOfChannels,length=buffer.length,size=length*channels*2;
  if(size>0xffffffff-36)throw new Error('Audio is too large for WAV');
  const bytes=new ArrayBuffer(44+size),view=new DataView(bytes);
  const text=(at,value)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,36+size,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,size,true);
  const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
  for(let i=0,at=44;i<length;i++)for(let ch=0;ch<channels;ch++,at+=2){const sample=Math.max(-1,Math.min(1,data[ch][i]));view.setInt16(at,Math.round(sample*(sample<0?32768:32767)),true);}
  return new File([bytes],name.replace(/\.[^.]+$/,'')+'.wav',{type:'audio/wav'});
};
J.analyzeAudio = async (file, onProgress = () => {}) => {
  onProgress({phase:'read'});
  const buf = await file.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  let audioBuffer;
  onProgress({phase:'decode'});
  try { audioBuffer = await ac.decodeAudioData(buf.slice(0)); } finally { try { ac.close(); } catch (e) {} }
  onProgress({phase:'analyze'});
  // Paint the analysis stage before the synchronous beat / waveform calculation.
  await new Promise(resolve=>setTimeout(resolve,0));
  const sr = audioBuffer.sampleRate, len = audioBuffer.length, ch = audioBuffer.numberOfChannels;
  const mono = new Float32Array(len);
  for (let c = 0; c < ch; c++) { const d = audioBuffer.getChannelData(c); for (let i = 0; i < len; i++) mono[i] += d[i] / ch; }
  const rate = 50, hop = Math.round(sr / rate), n = Math.floor(len / hop);
  const energy = new Float32Array(n), flux = new Float32Array(n);
  let prevHP = 0, prevX = 0;
  for (let f = 0; f < n; f++) {
    let e = 0, eh = 0;
    for (let i = f * hop, end = Math.min(len, (f + 1) * hop); i < end; i++) {
      const x = mono[i]; e += x * x;
      const hp = 0.92 * (prevHP + x - prevX); prevHP = hp; prevX = x; eh += hp * hp;
    }
    energy[f] = Math.sqrt(e / hop);
    flux[f] = Math.sqrt(eh / hop);
  }
  // onset strength: positive change of log high-passed energy vs local mean
  const onset = new Float32Array(n);
  for (let f = 1; f < n; f++) {
    const cur = Math.log(1e-4 + flux[f]);
    let m = 0, k = 0; for (let j = Math.max(0, f - 4); j < f; j++) { m += Math.log(1e-4 + flux[j]); k++; }
    onset[f] = Math.max(0, cur - m / Math.max(1, k));
  }
  // tempo via autocorrelation (70..180 BPM)
  const minLag = Math.round(rate * 60 / 180), maxLag = Math.round(rate * 60 / 70);
  let best = 0, bestLag = Math.round(rate * 0.5);
  const scores = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0; for (let f = lag; f < n; f++) s += onset[f] * onset[f - lag];
    const bpm = 60 * rate / lag;
    const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 125) / 0.7, 2));
    s *= w; scores[lag] = s;
    if (s > best) { best = s; bestLag = lag; }
  }
  let lagF = bestLag;
  if (scores[bestLag - 1] != null && scores[bestLag + 1] != null) {
    const a = scores[bestLag - 1], b = scores[bestLag], c = scores[bestLag + 1];
    const d = (a - 2 * b + c); if (d !== 0) lagF = bestLag + 0.5 * (a - c) / d;
  }
  const period = lagF / rate;
  // phase
  let bestPh = 0, bestPS = -1;
  for (let ph = 0; ph < lagF; ph += 0.5) {
    let s = 0; for (let t = ph; t < n; t += lagF) s += onset[Math.round(t)] || 0;
    if (s > bestPS) { bestPS = s; bestPh = ph; }
  }
  const beats = [];
  for (let t = bestPh / rate; t < audioBuffer.duration; t += period) beats.push(+t.toFixed(4));
  // normalised energy (0..1, 95th percentile)
  const sorted = Array.from(energy).sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
  const energyN = new Float32Array(n);
  for (let f = 0; f < n; f++) energyN[f] = Math.min(1, energy[f] / p95);
  // waveform peaks for the timeline
  const bins = 1600, peaks = new Float32Array(bins), per = Math.max(1, Math.floor(len / bins));
  for (let b = 0; b < bins; b++) { let m = 0; for (let i = b * per, e = Math.min(len, (b + 1) * per); i < e; i += 4) { const v = Math.abs(mono[i]); if (v > m) m = v; } peaks[b] = m; }
  return {
    name: file.name, duration: audioBuffer.duration, sampleRate: sr, buffer: audioBuffer,
    bpm: Math.round(60 / period * 10) / 10, beats, energy: energyN, energyRate: rate, peaks,
  };
};

/* rebuild a beat grid from a user BPM + first-beat offset */
J.beatGrid = (bpm, offset, duration) => {
  const out = []; if (!(bpm > 0)) return out;
  const p = 60 / bpm;
  for (let t = offset; t < duration + 0.01; t += p) if (t >= 0) out.push(+t.toFixed(4));
  return out;
};
})();
