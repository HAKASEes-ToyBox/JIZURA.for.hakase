/* Person mattes are source assets, not effect snapshots. Only small references
   enter project JSON / undo; compressed, source-timed frames live in Blob storage. */
(() => {
'use strict';
const L = (...args) => J.mediaLabel(...args), entries = new Map(), loading = new Map();
const animeWeightsUrl='https://huggingface.co/skytnt/anime-seg/resolve/a0a563c41338cbe0d23dfb4bfc3e243c518e5768/isnetis.onnx';
J.PERSON_MODELS = {
  rvm: {label: ['実写向け（RVM MobileNetV3）','Live action (RVM MobileNetV3)'], size: '~4 MB',
    url: 'https://raw.githubusercontent.com/PeterL1n/RobustVideoMatting/72ed518756950796f10eea6eb6b301df97cef277/model/model.json'},
  anime512: {label: ['アニメ向け（ISNet 512×512・軽量）','Anime (ISNet 512×512, faster)'], size: '176 MB', inputSize:512,
    url:animeWeightsUrl, graph:'__ANIME512_GRAPH__',
    weightsSha256:'f15622d853e8260172812b657053460e20806f04b9e05147d49af7bed31a6e99'},
  anime: {label: ['アニメ向け（ISNet 1024×1024・従来版）','Anime (ISNet 1024×1024, original)'], size: '176 MB', inputSize:1024,
    url:animeWeightsUrl},
};
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width=w; c.height=h; return c; };
const dims = s => [s.videoWidth || s.naturalWidth || s.width, s.videoHeight || s.naturalHeight || s.height];
J.personCutout = cut => {
  const p=cut?.personCutout;
  return p && p.sourceId===cut.itemId && typeof p.maskId==='string' && J.PERSON_MODELS[p.model] ? p : null;
};
J.personMaskReferences = project => {
  const refs=new Map();
  for(const layer of ['media','foreground'])for(const options of Object.values(project[layer]?.cutOverrides || {})) {
    const p=options.personCutout;
    if(p?.maskId && p.sourceId && J.PERSON_MODELS[p.model])refs.set(p.maskId,p);
  }
  return refs;
};
const planMedia=J.planMedia;
J.planMedia=function(project,plan,audioDuration,layer='media'){
  const result=planMedia(project,plan,audioDuration,layer);
  for(const cut of result.cuts){const ref=project[layer]?.cutOverrides?.[cut.index]?.personCutout;cut.personCutout=ref?.sourceId===cut.itemId?{...ref}:null;}
  return result;
};
const encode = new TextEncoder(), decode = new TextDecoder();
const MAX_MASK_FRAMES=216000;
const sourceFrame = (time,fps,duration) => J.clamp(Math.floor(time*fps+1e-6),0,Math.max(0,Math.ceil(duration*fps)-1));
// Source-frame slots are stable when a cut is moved, trimmed, extended or looped.
J.personMaskTargets = (cut,duration,fps) => {
  if(cut.type!=='video' || !duration)return [0];
  const length=cut.end-cut.start;
  if(!Number.isFinite(length) || length<=0)throw new Error(L('カットの再生時間を指定してください','Specify the cut playback duration'));
  const slots=new Set(),offset=J.mediaVideoTime(cut,cut.start,duration),last=sourceFrame(Math.max(0,duration-.001),fps,duration);
  const add=(from,to)=>{
    const first=sourceFrame(from,fps,duration),end=Math.min(last,Math.max(first,Math.ceil(to*fps-1e-7)-1));
    if(end-first+1>MAX_MASK_FRAMES)throw new Error(L('解析範囲が長すぎます。カットを短くしてください。','Analysis range is too long. Shorten the cut.'));
    for(let i=first;i<=end;i++)slots.add(i);
  };
  if(cut.videoLoop && length>=duration)add(0,duration);
  else if(cut.videoLoop && offset+length>duration){add(offset,duration);add(0,offset+length-duration);}
  else add(offset,Math.min(duration,offset+length));
  if(slots.size>MAX_MASK_FRAMES)throw new Error(L('解析範囲が長すぎます。カットを短くしてください。','Analysis range is too long. Shorten the cut.'));
  return [...slots].sort((a,b)=>a-b);
};
J.personMaskCoverage = (cut,entry) => {
  const targets=J.personMaskTargets(cut,entry.meta.duration,entry.meta.fps),missing=targets.filter(i=>!entry.slots.has(i));
  return {total:targets.length,reused:targets.length-missing.length,missing:missing.length};
};
J.packPersonMask = (meta, frames) => {
  let offset=0;const {indices,...base}=meta;
  const index=frames.map((f,i)=>{const entry={...(indices?{index:indices[i]}:{}),offset,size:f.size};offset+=f.size;return entry;});
  const bytes=encode.encode(JSON.stringify({...base,version:indices?2:1,frames:index})), header=new Uint8Array(12);
  header.set(encode.encode('JIZMAT01'));new DataView(header.buffer).setUint32(8,bytes.length,true);
  return new Blob([header,bytes,...frames],{type:'application/x-jizura-matte'});
};
J.readPersonMask = async (blob, ref) => {
  const fail=()=>new Error(L('人物マスクが不正です','Invalid person mask'));
  if(!(blob instanceof Blob) || blob.size<12)throw fail();
  const head=new Uint8Array(await blob.slice(0,12).arrayBuffer()),length=new DataView(head.buffer).getUint32(8,true),start=12+length;
  if(decode.decode(head.slice(0,8))!=='JIZMAT01' || length>8*1024*1024 || start>blob.size)throw fail();
  const meta=JSON.parse(await blob.slice(12,start).text());
  if(![1,2].includes(meta.version) || meta.sourceId!==ref.sourceId || meta.model!==ref.model || !Number.isFinite(meta.duration) || meta.duration<0 || !Number.isFinite(meta.fps) || meta.fps<1 || meta.fps>60 || !Number.isInteger(meta.width) || !Number.isInteger(meta.height) || meta.width<1 || meta.height<1 || meta.width>1024 || meta.height>1024 || !Array.isArray(meta.frames) || !meta.frames.length || meta.frames.length>MAX_MASK_FRAMES)throw fail();
  let end=0,last=-1;const slots=new Map(),limit=Math.max(0,Math.ceil(meta.duration*meta.fps)-1);
  for(const [i,f] of meta.frames.entries()){
    const index=meta.version===2?f.index:i;
    if(!Number.isSafeInteger(index)||index<=last||meta.version===2&&index>limit||!Number.isSafeInteger(f.offset)||f.offset!==end||!Number.isSafeInteger(f.size)||f.size<1||start+end+f.size>blob.size)throw fail();
    slots.set(index,i);last=index;end+=f.size;
  }
  if(start+end!==blob.size)throw fail();
  return {blob,meta,start,slots,decoded:new Map(),pending:new Map()};
};
J.attachPersonMask = async (ref,blob) => {
  const entry=await J.readPersonMask(blob,ref),old=entries.get(ref.maskId);
  if(old)for(const frame of old.decoded.values())frame.close?.();
  entries.set(ref.maskId,entry);return entry;
};
J.loadPersonMask = ref => {
  if(entries.has(ref.maskId))return Promise.resolve(entries.get(ref.maskId));
  if(!loading.has(ref.maskId)){
    const work=(async()=>{const blob=await J.loadMedia(ref.maskId);return blob ? J.attachPersonMask(ref,blob) : null;})();
    loading.set(ref.maskId,work);work.finally(()=>loading.delete(ref.maskId)).catch(()=>{});
  }
  return loading.get(ref.maskId);
};
J.personMaskBlob = async ref => (await J.loadPersonMask(ref))?.blob;
const frameIndex = (entry,cut,t) => {
  const time=cut.type==='video'?J.mediaVideoTime(cut,t,entry.meta.duration):0;
  return entry.slots.get(cut.type==='video'?sourceFrame(time,entry.meta.fps,entry.meta.duration):0);
};
const cachedFrame = (entry,i) => {
  const img=entry.decoded.get(i);
  if(img){entry.decoded.delete(i);entry.decoded.set(i,img);}
  return img;
};
const previewFrames=new WeakMap();
const holdFrame = (entry,cut,i,img) => {
  let held=previewFrames.get(cut);
  if(!held || held.entry!==entry){held={entry,index:-1,canvas:canvas(entry.meta.width,entry.meta.height)};previewFrames.set(cut,held);}
  if(held.index!==i){const x=held.canvas.getContext('2d');x.clearRect(0,0,held.canvas.width,held.canvas.height);x.drawImage(img,0,0);held.index=i;}
  return held;
};
const decodeFrame = (entry,i) => {
  const cached=cachedFrame(entry,i);if(cached)return Promise.resolve(cached);
  if(!entry.pending.has(i)){
    const f=entry.meta.frames[i],blob=entry.blob.slice(entry.start+f.offset,entry.start+f.offset+f.size,'image/png');
    const work=(async()=>{
      let img;
      if(typeof createImageBitmap==='function')img=await createImageBitmap(blob);
      else {img=new Image();const url=URL.createObjectURL(blob);try{img.src=url;await img.decode();}finally{URL.revokeObjectURL(url);}}
      entry.decoded.set(i,img);
      while(entry.decoded.size>12){const key=entry.decoded.keys().next().value;entry.decoded.get(key).close?.();entry.decoded.delete(key);}
      window.dispatchEvent(new Event('jizura-person-mask'));return img;
    })();
    entry.pending.set(i,work);work.finally(()=>entry.pending.delete(i)).catch(()=>{});
  }
  return entry.pending.get(i);
};
J.preparePersonMask = async (cut,t,strict=false) => {
  const ref=J.personCutout(cut);if(!ref)return;
  const entry=await J.loadPersonMask(ref);
  if(!entry){if(strict && (ref.display!=='none'||ref.behindLyrics||ref.behindForeground))throw new Error(L('人物マスクが見つかりません。人物切り抜きで再作成してください：','Person mask is missing. Generate it again: ')+cut.name);return;}
  const i=frameIndex(entry,cut,t);
  if(i===undefined){if(strict && (ref.display!=='none'||ref.behindLyrics||ref.behindForeground))throw new Error(L('再生範囲の人物マスクが不足しています。人物切り抜きを再実行してください：','Person masks are missing for this playback range. Run person cutout again: ')+cut.name);return;}
  const img=await decodeFrame(entry,i);
  if(strict)holdFrame(entry,cut,i,img);
};
const prefetchFrames = (entry,cut,t) => {
  if(cut.type!=='video')return;
  for(let n=1;n<=2;n++){
    const next=t+n/entry.meta.fps;if(next>=cut.end)break;
    const i=frameIndex(entry,cut,next);if(i===undefined)break;
    if(!entry.decoded.has(i) && !entry.pending.has(i))decodeFrame(entry,i).catch(()=>{});
  }
};
J.personMaskFrame = (cut,t) => {
  const ref=J.personCutout(cut);if(!ref){if(cut)previewFrames.delete(cut);return null;}
  const entry=entries.get(ref.maskId);
  if(!entry){previewFrames.delete(cut);J.preparePersonMask(cut,t).catch(()=>{});return null;}
  const i=frameIndex(entry,cut,t);
  // An absent source slot is a genuinely missing mask, not a PNG decode delay.
  if(i===undefined){previewFrames.delete(cut);return null;}
  const img=cachedFrame(entry,i),held=img?holdFrame(entry,cut,i,img):previewFrames.get(cut);
  if(!img)decodeFrame(entry,i).catch(()=>{});
  prefetchFrames(entry,cut,t);
  // Keep a canvas copy: the bounded decoded cache may close the old ImageBitmap.
  // Strict export preparation still awaits the exact source slot above.
  return img || (held?.entry===entry?held.canvas:null);
};
const sources=new WeakMap();
J.personMaskSource = (source,cut,t) => {
  const ref=J.personCutout(cut);if(!ref || !['only','remove'].includes(ref.display))return source;
  const matte=J.personMaskFrame(cut,t);if(!matte)return source;
  const [sw,sh]=dims(source),k=Math.min(1,2048/Math.max(sw,sh));
  let c=sources.get(source);if(!c){c=canvas(1,1);sources.set(source,c);}c.width=Math.max(1,Math.round(sw*k));c.height=Math.max(1,Math.round(sh*k));
  const x=c.getContext('2d');x.drawImage(source,0,0,c.width,c.height);x.globalCompositeOperation=ref.display==='only'?'destination-in':'destination-out';x.drawImage(matte,0,0,c.width,c.height);x.globalCompositeOperation='source-over';return c;
};
const occlusionCanvas=canvas(1,1),occlusionLayer=canvas(1,1),occlusionOwner={ensure(c,w,h){if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;return c;},personMaskPass:true};
J.personOccluders = (plan,t,mode,exclude) => ['media','foreground'].flatMap(layer=>plan.layerVisibility?.[layer]===false?[]:J.mediaCutsAt(plan,t,layer).filter(c=>{
  if(c===exclude || c.opacity<=0)return false;
  const enabled=c=>J.personCutout(c)?.[mode] && J.personCutout(c)?.display!=='remove',prev=plan[layer].cuts[c.index-1];
  return enabled(c) || prev && c.trans && t-c.start<c.transDur && Math.abs(prev.end-c.start)<.06 && enabled(prev);
}).map(c=>({layer,cut:c})));
J.maskBehindPersons = (target,plan,t,mode,exclude) => {
  const cuts=J.personOccluders(plan,t,mode,exclude);if(!cuts.length)return;
  occlusionOwner.personMaskMode=mode;
  const w=target.width,h=target.height;occlusionOwner.ensure(occlusionCanvas,w,h);occlusionOwner.ensure(occlusionLayer,w,h);
  const mx=occlusionCanvas.getContext('2d'),lx=occlusionLayer.getContext('2d');mx.clearRect(0,0,w,h);
  for(const {layer,cut} of cuts){
    lx.setTransform(1,0,0,1,0,0);lx.globalAlpha=1;lx.globalCompositeOperation='source-over';lx.filter='none';lx.clearRect(0,0,w,h);
    J.drawMedia(lx,plan,t,occlusionOwner,layer,false,cut);
    if(J.maskMediaLayer && occlusionOwner.maskHandled!==cut)J.maskMediaLayer(occlusionLayer,cut,t,plan);
    mx.globalAlpha=cut.opacity/100;mx.drawImage(occlusionLayer,0,0);
  }
  mx.globalAlpha=1;
  const x=target.getContext('2d');x.save();x.setTransform(1,0,0,1,0,0);x.filter='none';x.globalAlpha=1;x.globalCompositeOperation='destination-out';x.drawImage(occlusionCanvas,0,0);x.restore();
};
window.addEventListener('jizura-person-mask',()=>{if(J.ui)J.ui.need=true;});
const prepareMedia=J.prepareMediaFrame;
J.prepareMediaFrame=async (plan,t,signal) => {
  await prepareMedia(plan,t,signal);
  for(const layer of ['media','foreground'])if(plan.layerVisibility?.[layer]!==false)for(const cut of J.mediaCutsAt(plan,t,layer)){
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    await J.preparePersonMask(cut,t,true);
    const prev=plan[layer].cuts[cut.index-1];
    if(prev && cut.trans && t-cut.start<cut.transDur && Math.abs(prev.end-cut.start)<.06)await J.preparePersonMask(prev,prev.end-.001,true);
  }
};
// Everything below runs in an isolated worker. No video, model, or matte uploads.
function personWorker(){
  let engine,model,states,ratio,backend;
  const progress=(phase,data={})=>postMessage({type:'progress',phase,...data});
  const fetchModel=async url=>{
    let cache;try{cache=await caches.open('jizura-person-models-v1');const hit=await cache.match(url);if(hit){progress('download',{cached:true,url});return await hit.arrayBuffer();}}catch(e){}
    const response=await fetch(url);if(!response.ok)throw new Error('Model download: HTTP '+response.status);
    const total=+(response.headers.get('Content-Length')||0),parts=[];let loaded=0,lastReport=0;
    if(response.body){const reader=response.body.getReader();for(;;){const {value,done}=await reader.read();if(done)break;parts.push(value);loaded+=value.length;if(performance.now()-lastReport>=100){lastReport=performance.now();progress('download',{loaded,total,url});}}}
    else {const bytes=new Uint8Array(await response.arrayBuffer());parts.push(bytes);loaded=bytes.length;}
    progress('download',{loaded,total,url});
    const blob=new Blob(parts);if(cache)try{await cache.put(url,new Response(blob));}catch(e){progress('cache-unavailable');}
    return await blob.arrayBuffer();
  };
  onmessage=async event=>{
    const m=event.data;
    try{
      if(m.type==='init'){
        engine=m.model;
        if(engine==='rvm'){
          importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
          try{await tf.setBackend('webgl');await tf.ready();backend='WebGL';}catch(e){await tf.setBackend('cpu');await tf.ready();backend='CPU';}
          const json=JSON.parse(new TextDecoder().decode(await fetchModel(m.url))),specs=[],parts=[];
          for(const group of json.weightsManifest){specs.push(...group.weights);for(const path of group.paths)parts.push(await fetchModel(new URL(path,m.url).href));}
          const weights=new Uint8Array(parts.reduce((n,b)=>n+b.byteLength,0));let offset=0;for(const part of parts){weights.set(new Uint8Array(part),offset);offset+=part.byteLength;}
          progress('initialize');model=await tf.loadGraphModel({load:async()=>({modelTopology:json.modelTopology,weightSpecs:specs,weightData:weights.buffer,format:json.format,signature:json.signature})});
          states=[tf.scalar(0),tf.scalar(0),tf.scalar(0),tf.scalar(0)];ratio=tf.scalar(.5);
        }else{
          importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.all.min.js');
          ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';ort.env.wasm.numThreads=1;
          const bytes=await fetchModel(m.url);progress('initialize');
          const options={executionProviders:['wasm']};let graph=bytes;
          if(m.graph){
            // The compact 512 graph references unchanged weights at verified
            // offsets inside the original ONNX, sharing its existing cache.
            const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
            if(hash!==m.weightsSha256)throw new Error('ISNet model checksum mismatch. Clear the model cache and retry.');
            graph=Uint8Array.from(atob(m.graph),c=>c.charCodeAt(0));
            options.externalData=[{path:'isnetis.onnx',data:new Uint8Array(bytes)}];
          }
          // ISNet's ceil-mode MaxPool is unsupported by this WebGPU runtime;
          // some devices silently produce invalid masks instead of rejecting it.
          model=await ort.InferenceSession.create(graph,options);backend='CPU';
        }
        postMessage({type:'ready',backend});
      }else if(m.type==='reset'){
        if(engine==='rvm'){tf.dispose(states);states=[tf.scalar(0),tf.scalar(0),tf.scalar(0),tf.scalar(0)];}
        postMessage({type:'reset'});
      }else if(m.type==='frame'){
        let alpha,w=m.width,h=m.height;
        if(engine==='rvm'){
          const src=tf.tensor(new Float32Array(m.pixels),[1,h,w,3]);let output;
          try{
            output=await model.executeAsync({src,r1i:states[0],r2i:states[1],r3i:states[2],r4i:states[3],downsample_ratio:ratio},['pha','r1o','r2o','r3o','r4o']);
            alpha=await output[0].data();w=output[0].shape[2];h=output[0].shape[1];tf.dispose(states);states=output.slice(1);
          }finally{src.dispose();output?.[0].dispose();}
        }else{
          const input=new ort.Tensor('float32',new Float32Array(m.pixels),[1,3,h,w]);let out;
          try{
            out=await model.run({[model.inputNames[0]]:input});
            const tensor=out[model.outputNames[0]];alpha=tensor.data;h=tensor.dims.at(-2);w=tensor.dims.at(-1);
          }
          finally{input.dispose();}
          const data=new Uint8Array(alpha.length);for(let i=0;i<data.length;i++)data[i]=Math.round(Math.max(0,Math.min(1,alpha[i]))*255);
          for(const value of Object.values(out))value.dispose();postMessage({type:'matte',width:w,height:h,alpha:data.buffer},[data.buffer]);return;
        }
        const data=new Uint8Array(w*h);for(let i=0;i<data.length;i++)data[i]=Math.round(Math.max(0,Math.min(1,alpha[i]))*255);
        postMessage({type:'matte',width:w,height:h,alpha:data.buffer},[data.buffer]);
      }
    }catch(error){postMessage({type:'error',message:error.message || String(error)});}
  };
}
const makeWorker=report=>{
  const url=URL.createObjectURL(new Blob(['('+personWorker.toString()+')()'],{type:'text/javascript'})),worker=new Worker(url);URL.revokeObjectURL(url);
  let pending;
  const fail=error=>{if(pending){pending.reject(error);clearTimeout(pending.timer);pending=null;}};
  const refreshTimeout=()=>{if(pending){clearTimeout(pending.timer);pending.timer=setTimeout(()=>fail(new Error(L('処理がタイムアウトしました。再実行してください。','Processing timed out. Please try again.'))),180000);}};
  worker.onmessage=({data})=>{
    if(data.type==='progress'){refreshTimeout();report(data);return;}
    if(data.type==='error'){fail(new Error(data.message));return;}
    if(pending){clearTimeout(pending.timer);pending.resolve(data);pending=null;}
  };
  worker.onerror=e=>fail(new Error(e.message || 'Person inference worker failed'));
  return {request(message,transfer=[]){return new Promise((resolve,reject)=>{pending={resolve,reject};refreshTimeout();worker.postMessage(message,transfer);});},stop(){fail(new DOMException('Cancelled','AbortError'));worker.terminate();}};
};
J.generatePersonMask = async (cut,modelId,{fps=24,signal,onProgress=()=>{}}={}) => {
  const asset=J.mediaAssets.get(cut.itemId),def=J.PERSON_MODELS[modelId];
  if(!asset || !def || J.isMediaCopy(cut.itemId))throw new Error(L('画像・動画素材を指定してください','Select an image or video asset'));
  let worker;const abort=()=>worker?.stop();signal?.addEventListener('abort',abort,{once:true});
  let source,url;
  try{
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    // A separate decoder leaves detail-preview playback and the main editor untouched.
    if(asset.type==='video'){
      if(!asset.file)throw new Error(L('動画素材を再読み込みしてください','Please import the video again'));
      source=document.createElement('video');source.muted=true;source.playsInline=true;source.preload='auto';url=URL.createObjectURL(asset.file);source.src=url;
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(new Error('Video metadata timed out')),30000);const finish=error=>{clearTimeout(timer);source.onloadedmetadata=source.onerror=null;signal?.removeEventListener('abort',cancel);error?reject(error):resolve();};const cancel=()=>finish(new DOMException('Cancelled','AbortError'));source.onloadedmetadata=()=>finish();source.onerror=()=>finish(new Error('Cannot decode source video'));signal?.addEventListener('abort',cancel,{once:true});});
    }else source=asset.element;
    const [sw,sh]=dims(source),duration=asset.type==='video'?source.duration:0;
    if(!sw||!sh||!Number.isFinite(duration))throw new Error(L('素材のサイズ・長さを取得できません','Cannot read source dimensions or duration'));
    fps=J.clamp(Math.round(fps),1,60);
    const k=Math.min(1,512/Math.max(sw,sh)),mw=Math.max(1,Math.round(sw*k)),mh=Math.max(1,Math.round(sh*k));
    const prior=J.personCutout(cut),loaded=prior?.model===modelId?await J.loadPersonMask(prior).catch(()=>null):null;
    const existing=loaded && loaded.meta.model===modelId && loaded.meta.fps===fps && loaded.meta.width===mw && loaded.meta.height===mh && Math.abs(loaded.meta.duration-duration)<1e-6?loaded:null;
    const targets=J.personMaskTargets(cut,duration,fps),missing=targets.filter(i=>!existing?.slots.has(i)),frames=new Map();
    if(existing)for(const [slot,i] of existing.slots){const f=existing.meta.frames[i];frames.set(slot,existing.blob.slice(existing.start+f.offset,existing.start+f.offset+f.size,'image/png'));}
    if(frames.size+missing.length>MAX_MASK_FRAMES)throw new Error(L('保存するマスクが多すぎます。解析枚数を下げて再作成してください。','Too many saved masks. Reduce the analysis rate and regenerate.'));
    const reused=targets.length-missing.length;
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    onProgress({phase:'plan',total:targets.length,reused,missing:missing.length});
    if(!missing.length)return {...prior};
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    worker=makeWorker(onProgress);onProgress({phase:'download',loaded:0,total:0});const ready=await worker.request({type:'init',model:modelId,url:def.url,graph:def.graph,weightsSha256:def.weightsSha256});
    const iw=def.inputSize||mw,ih=def.inputSize||mh,input=canvas(iw,ih),ix=input.getContext('2d',{willReadFrequently:true}),output=canvas(mw,mh),ox=output.getContext('2d'),alphaCanvas=canvas(iw,ih),ax=alphaCanvas.getContext('2d');
    const fit=def.inputSize?Math.min(iw/sw,ih/sh):k,fw=Math.min(iw,Math.round(sw*fit)),fh=Math.min(ih,Math.round(sh*fit)),px=Math.floor((iw-fw)/2),py=Math.floor((ih-fh)/2);
    for(const [n,i] of missing.entries()){
      if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
      if(n && i!==missing[n-1]+1 && modelId==='rvm')await worker.request({type:'reset'});
      if(duration)await J.seekMediaVideo(source,Math.min(i/fps,duration-.001),signal,cut.name);
      ix.clearRect(0,0,iw,ih);ix.drawImage(source,px,py,fw,fh);const rgba=ix.getImageData(0,0,iw,ih).data,pixels=new Float32Array(iw*ih*3);
      for(let n=0;n<iw*ih;n++)for(let c=0;c<3;c++)pixels[def.inputSize?c*iw*ih+n:n*3+c]=rgba[n*4+c]/255;
      const inferenceStart=performance.now(),result=await worker.request({type:'frame',width:iw,height:ih,pixels:pixels.buffer},[pixels.buffer]),inferenceMs=Math.round(performance.now()-inferenceStart);
      alphaCanvas.width=result.width;alphaCanvas.height=result.height;const image=ax.createImageData(result.width,result.height),alpha=new Uint8Array(result.alpha);
      for(let n=0;n<alpha.length;n++){image.data[n*4]=image.data[n*4+1]=image.data[n*4+2]=255;image.data[n*4+3]=alpha[n];}ax.putImageData(image,0,0);
      ox.clearRect(0,0,mw,mh);ox.drawImage(alphaCanvas,px,py,fw,fh,0,0,mw,mh);
      frames.set(i,await new Promise((resolve,reject)=>output.toBlob(blob=>blob?resolve(blob):reject(new Error('Cannot encode person mask')),'image/png')));
      onProgress({phase:'analyze',completed:n+1,total:missing.length,reused,required:targets.length,sourceFrame:i,backend:ready.backend,inferenceMs});
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    onProgress({phase:'save'});
    const indices=[...frames.keys()].sort((a,b)=>a-b);
    const ref={...(existing?prior:{}),maskId:'person_'+crypto.randomUUID(),sourceId:cut.itemId,model:modelId,display:existing?prior.display:'none',behindLyrics:existing?!!prior.behindLyrics:false,behindForeground:existing?!!prior.behindForeground:false,fps,width:mw,height:mh,frameCount:frames.size,duration};
    const blob=J.packPersonMask({sourceId:ref.sourceId,model:modelId,fps,width:mw,height:mh,duration,indices},indices.map(i=>frames.get(i)));
    await J.storeMedia(ref.maskId,blob);await J.attachPersonMask(ref,blob);await J.preparePersonMask({...cut,personCutout:ref},cut.start);return ref;
  }finally{worker?.stop();signal?.removeEventListener('abort',abort);if(url){source.pause();source.removeAttribute('src');source.load();URL.revokeObjectURL(url);}}
};
})();
