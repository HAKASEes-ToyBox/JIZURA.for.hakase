const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{for(const lang of ['', 'en/']){
 const page=await browser.newPage();
 await page.route('**/*',r=>r.request().url()==='http://127.0.0.1/'?r.fulfill({contentType:'text/html',body:fs.readFileSync(lang+'index.html')}):r.abort());await page.goto('http://127.0.0.1/');
 const result=await page.evaluate(async()=>{
  const project=J.defaultProject();Object.assign(project,{lyrics:'stream',videoSize:{w:480,h:270},fps:60,durationOverride:1.2,quality:'qp',exportQP:0});J.ui.project=project;J.uiApi.replan();const plan=J.ui.plan;
  const originalRenderer=J.Renderer,originalTarget=Mp4Muxer.ArrayBufferTarget,previousRes=J.glyphs.maxRes,originalNow=Date.now;const fixedNow=Date.now();Date.now=()=>fixedNow;
  Mp4Muxer.ArrayBufferTarget=class{constructor(){throw Error('Whole-movie buffer allocated');}};
  J.Renderer=class{frame(ctx,plan,time){const pixels=ctx.createImageData(480,270);let seed=1+Math.round(time*60);for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels.data[i]=128+40*Math.sin(i/200)+(seed&15);pixels.data[i+1]=100+40*Math.cos(i/400)+((seed>>>8)&15);pixels.data[i+2]=200;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);}};
  const audio={buffer:new AudioBuffer({numberOfChannels:1,length:57600,sampleRate:48000})};const samples=audio.buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=.1*Math.sin(i*2*Math.PI*440/48000);
  const writer=()=>({writes:[],closed:false,aborted:false,pending:0,maxPending:0,async write(w){this.pending++;this.maxPending=Math.max(this.maxPending,this.pending);await new Promise(r=>setTimeout(r,1));this.writes.push({position:w.position,data:new Uint8Array(w.data)});this.pending--;},async close(){this.closed=true;},async abort(){this.aborted=true;}});
  const decode=async blob=>{const video=document.createElement('video'),url=URL.createObjectURL(blob);try{video.src=url;await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(Error('MP4 decode failed'));});await new Promise(resolve=>{video.onseeked=resolve;video.currentTime=.5;});if(video.videoWidth!==480||video.videoHeight!==270||Math.abs(video.duration-1.2)>.05)throw Error('Bad MP4 dimensions/duration');}finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}};
  try{
   const fallback=await J.exportMP4({project,plan,audio});await decode(fallback.blob);if(!fallback.audio||fallback.saved||fallback.size!==fallback.blob.size)throw Error('Fallback result');
   const stream=writer();let wroteDuringFrames=false;const direct=await J.exportMP4({project,plan,audio,fileStream:stream,onProgress:p=>{if(p<.99&&stream.writes.length)wroteDuringFrames=true;}});
   if(!direct.saved||direct.blob!==null||!stream.closed||stream.aborted||stream.maxPending!==1||!wroteDuringFrames)throw Error('File writes were not incremental/sequential '+JSON.stringify({direct,closed:stream.closed,aborted:stream.aborted,maxPending:stream.maxPending,wroteDuringFrames,writes:stream.writes.length}));
   const bytes=new Uint8Array(direct.size);for(const w of stream.writes)bytes.set(w.data,w.position);await decode(new Blob([bytes],{type:'video/mp4'}));
   const fallbackBytes=new Uint8Array(await fallback.blob.arrayBuffer());
   if(bytes.length!==fallbackBytes.length||bytes.some((value,i)=>value!==fallbackBytes[i]))throw Error('Positional file writes differ from Blob output');
   if(!stream.writes.some((write,i)=>i>0&&write.position<stream.writes[i-1].position))throw Error('Headers not patched');
   const broken=writer();broken.write=async()=>{throw Error('Disk full');};let rejected=false;try{await J.exportMP4({project,plan,fileStream:broken});}catch(e){rejected=e.message==='Disk full';}if(!rejected||!broken.aborted||broken.closed)throw Error('Write error not cleaned up');
   const cancelled=writer(),abort=new AbortController();rejected=false;try{await J.exportMP4({project,plan,fileStream:cancelled,signal:abort.signal,onProgress:p=>{if(p>.05)abort.abort();}});}catch{rejected=true;}if(!rejected||!cancelled.aborted||cancelled.closed)throw Error('Cancel not cleaned up');
   if(J.glyphs.maxRes!==previousRes)throw Error('Renderer resolution leaked');
   return {fallbackBytes:fallback.size,fileBytes:direct.size,writes:stream.writes.length,audio:direct.audio};
  }finally{Date.now=originalNow;J.Renderer=originalRenderer;Mp4Muxer.ArrayBufferTarget=originalTarget;}
 });
 console.log('PASS streamed QP0 MP4, audio, decode, write failure, cancellation '+(lang||'ja'),result);
 await page.evaluate(()=>{J.ui.project.durationOverride=.1;J.ui.project.videoSize={w:320,h:180};J.uiApi.replan();J.ensureFonts=async()=>{};J.saveFile=async()=>{throw Error('Download fallback incorrectly used');};window.testWriter={write:async()=>{},close:async()=>{window.testSaved=true;},abort:async()=>{}};window.showSaveFilePicker=async options=>{window.testFilename=options.suggestedName;return {createWritable:async()=>window.testWriter};};document.querySelector('[data-export-dialog="mp4"]').click();});
 await page.waitForFunction(()=>!document.getElementById('btnMP4').disabled);await page.locator('#btnMP4').click();await page.waitForFunction(()=>window.testSaved&&!J.ui.exporting);assert((await page.evaluate(()=>window.testFilename)).endsWith('.mp4'));
 await page.evaluate(()=>{window.showSaveFilePicker=async()=>{throw new DOMException('Cancelled','AbortError');};});await page.locator('#btnMP4').click();await page.waitForFunction(()=>!J.ui.exporting);assert(!/エラー:|Error:/.test(await page.locator('#exportDlg .exp-text').textContent()));
 console.log('PASS native save dialog and cancellation '+(lang||'ja'));await page.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
