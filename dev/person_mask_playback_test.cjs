// Exercise PNG decoding delays at mask-frame boundaries using a real 30 fps video.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const locale of ['', 'en/']){
  const page=await browser.newPage(),url='http://localhost:8765/'+locale,errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(locale+'index.html')}):r.abort());await page.goto(url);
  const result=await page.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=96;c.height=64;const x=c.getContext('2d'),target=new Mp4Muxer.ArrayBufferTarget(),muxer=new Mp4Muxer.Muxer({target,video:{codec:'avc',width:96,height:64,frameRate:30},fastStart:'in-memory',firstTimestampBehavior:'offset'});
   const encoder=new VideoEncoder({output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),error:e=>{throw e;}});encoder.configure({codec:'avc1.42001e',width:96,height:64,framerate:30,bitrate:300000});
   x.fillStyle='red';x.fillRect(0,0,96,64);for(let i=0;i<120;i++){const frame=new VideoFrame(c,{timestamp:Math.round(i/30*1e6),duration:Math.round(1e6/30)});encoder.encode(frame,{keyFrame:i===0});frame.close();}await encoder.flush();encoder.close();muxer.finalize();
   const item={id:'mask-playback-video',type:'video',name:'30fps.mp4'};await J.attachMedia(item,new File([target.buffer],item.name,{type:'video/mp4'}));const video=J.mediaAssets.get(item.id).element;await J.seekMediaVideo(video,0);
   const output=document.createElement('canvas');output.width=96;output.height=64;const ox=output.getContext('2d'),nativeBitmap=window.createImageBitmap;let blocked=false,waiters=[],decodeCount=0;
   window.createImageBitmap=async(...args)=>{decodeCount++;if(blocked)await new Promise(resolve=>waiters.push(resolve));return nativeBitmap(...args);};
   const release=async entry=>{blocked=false;waiters.splice(0).forEach(resolve=>resolve());await Promise.all([...entry.pending.values()]);};
   const png=c=>new Promise(resolve=>c.toBlob(resolve,'image/png'));
   const makeRef=async(fps,indices)=>{const frames=[];for(const slot of indices){x.clearRect(0,0,96,64);x.fillStyle='white';x.fillRect(slot%2?48:0,0,48,64);frames.push(await png(c));}const ref={maskId:'person_playback_'+crypto.randomUUID(),sourceId:item.id,model:'rvm',fps,width:96,height:64,duration:4,frameCount:indices.length,display:'only',behindLyrics:true,behindForeground:true};return {ref,entry:await J.attachPersonMask(ref,J.packPersonMask({sourceId:item.id,model:'rvm',fps,width:96,height:64,duration:4,indices},frames))};};
   const cutFor=ref=>({itemId:item.id,type:'video',name:item.name,start:10,end:14,videoStart:0,videoLoop:true,layout:'cover',technique:'legacy',enter:'cut',exit:'cut',hold:'still',treat:'none',opacity:100,personCutout:ref});
   const alpha=()=>[ox.getImageData(24,32,1,1).data[3],ox.getImageData(72,32,1,1).data[3]];
   const paint=(cut,t,mode)=>{ox.clearRect(0,0,96,64);if(mode==='only'){cut.personCutout.display=mode;J.drawMediaCut(ox,cut,t);}else{cut.personCutout.display='none';ox.fillStyle='white';ox.fillRect(0,0,96,64);J.maskBehindPersons(output,{media:{cuts:[cut]},foreground:{cuts:[]}},t,mode);}return alpha();};
   const rates=[];
   try{
    for(const [fps,renderFps] of [[7,30],[4,60]]){
     const {ref,entry}=await makeRef(fps,Array.from({length:fps*4},(_,i)=>i)),cut=cutFor(ref);await J.preparePersonMask(cut,10,true);
     // Pause all upcoming PNG decodes: playback must keep its matte during the delay.
     blocked=true;const warm=J.personMaskFrame(cut,10),samples=[];
     for(let frame=0;frame<Math.ceil(renderFps*3/fps);frame++){const t=10+1/fps+frame/renderFps+1e-5;for(const mode of ['only','behindLyrics','behindForeground'])samples.push(paint(cut,t,mode));}
     const during={warm:!!warm,samples,cacheSize:entry.decoded.size};await release(entry);
     await J.preparePersonMask(cut,10+3/fps+1e-5,true);const exact=paint(cut,10+3/fps+1e-5,'only');
     // The held matte must survive eviction of its decoded ImageBitmap.
     const heldIndex=entry.slots.get(3);for(let slot=4;slot<fps*4;slot++)await J.preparePersonMask(cut,10+slot/fps+1e-5,true);
     const evicted=!entry.decoded.has(heldIndex),bounded=entry.decoded.size<=12;blocked=true;const afterEviction=paint(cut,10+2/fps+1e-5,'only');
     // Export waits for the actual frame; preview fallback cannot satisfy strict preparation.
     let exportReady=false;const prepare=J.preparePersonMask(cut,10+2/fps+1e-5,true).then(()=>{exportReady=true;});await new Promise(resolve=>setTimeout(resolve,0));const exportWaited=!exportReady;await release(entry);await prepare;const exported=paint(cut,10+2/fps+1e-5,'only');
     const counts={before:decodeCount};blocked=true;for(let i=0;i<20;i++)paint(cut,10,'only');counts.after=decodeCount;await release(entry);await J.preparePersonMask(cut,10,true);const loop=paint(cut,10,'only');
     // Preparing other cuts sharing this matte can evict the frame already prepared for export.
     await J.preparePersonMask(cut,10+2/fps+1e-5,true);for(let slot=3;slot<fps*4;slot++)await J.preparePersonMask({...cut},10+slot/fps+1e-5,true);
     blocked=true;const preparedEvicted=!entry.decoded.has(entry.slots.get(2)),preparedExport=paint(cut,10+2/fps+1e-5,'only');await release(entry);
     rates.push({fps,renderFps,during,exact,evicted,bounded,afterEviction,exportWaited,exported,counts,loop,preparedEvicted,preparedExport});
    }
    const {ref,entry}=await makeRef(4,[0,2]),cut=cutFor(ref);await J.preparePersonMask(cut,10,true);J.personMaskFrame(cut,10);const missing=J.personMaskFrame(cut,10.25)===null;let strictReject=false;try{await J.preparePersonMask(cut,10.25,true);}catch(e){strictReject=true;}
    blocked=true;const afterGap=J.personMaskFrame(cut,10.5)===null;await release(entry);
    const other={...cut,itemId:'different-source'},sourceChanged=J.personMaskFrame(other,10)===null;
    return {rates,missing,strictReject,afterGap,sourceChanged};
   }finally{blocked=false;waiters.splice(0).forEach(resolve=>resolve());window.createImageBitmap=nativeBitmap;}
  });
  for(const r of result.rates){assert.equal(r.during.warm,true);for(const a of r.during.samples)assert.ok(a[0]+a[1]===255,`${r.fps} fps masks / ${r.renderFps} fps playback must stay masked while decoding: ${a}`);assert.deepEqual(r.exact,[0,255]);assert.equal(r.evicted,true);assert.equal(r.bounded,true);assert.deepEqual(r.afterEviction,[0,255]);assert.equal(r.exportWaited,true);assert.deepEqual(r.exported,[255,0]);assert.ok(r.counts.after-r.counts.before<=3,'repeated renders share decode requests');assert.deepEqual(r.loop,[255,0]);assert.equal(r.preparedEvicted,true);assert.deepEqual(r.preparedExport,[255,0]);}
  assert.equal(result.missing,true);assert.equal(result.strictReject,true);assert.equal(result.afterGap,true);assert.equal(result.sourceChanged,true);assert.deepEqual(errors,[]);await page.close();console.log('PASS '+(locale||'ja')+' mismatched fps: all three cutout effects, delayed decoding, cache eviction, looping, sparse gaps and exact export');
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
