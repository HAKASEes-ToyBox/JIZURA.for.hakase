// Browser regression: real video seeks/PNG storage, deterministic inference worker.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {timelineAction}=require('./ui_helpers.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const locale of ['', 'en/']){
  const page=await browser.newPage(),url='http://localhost:8765/'+locale,errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(locale+'index.html')}):r.abort());await page.goto(url);
  const result=await page.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=96;c.height=64;const x=c.getContext('2d'),target=new Mp4Muxer.ArrayBufferTarget(),muxer=new Mp4Muxer.Muxer({target,video:{codec:'avc',width:96,height:64,frameRate:4},fastStart:'in-memory',firstTimestampBehavior:'offset'});
   const encoder=new VideoEncoder({output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),error:e=>{throw e;}});encoder.configure({codec:'avc1.42001e',width:96,height:64,framerate:4,bitrate:300000});
   for(let i=0;i<16;i++){x.fillStyle=`hsl(${i*20},100%,50%)`;x.fillRect(0,0,96,64);const frame=new VideoFrame(c,{timestamp:i*250000,duration:250000});encoder.encode(frame,{keyFrame:i===0});frame.close();}
   await encoder.flush();encoder.close();muxer.finalize();const file=new File([target.buffer],'range.mp4',{type:'video/mp4'}),item={id:'range-video',name:file.name,type:'video'};await J.attachMedia(item,file);
   const sourceDuration=J.mediaAssets.get(item.id).element.duration,NativeWorker=window.Worker,nativeSeek=J.seekMediaVideo;
   let stats={workers:0,frames:[],resets:0,seeks:[],progress:[]},sourceSlot=0;
   J.seekMediaVideo=async(v,time,...args)=>{stats.seeks.push(time);sourceSlot=Math.round(time*4);return nativeSeek(v,time,...args);};
   window.Worker=class{
    constructor(){stats.workers++;this.stopped=false;}
    postMessage(m){let data;
     if(m.type==='init')data={type:'ready',backend:'Test'};
     else if(m.type==='reset'){stats.resets++;data={type:'reset'};}
     else{stats.inputSize=[m.width,m.height];stats.frames.push(sourceSlot);const alpha=new Uint8Array(m.width*m.height);for(let y=0;y<m.height;y++)for(let z=0;z<m.width;z++)alpha[y*m.width+z]=(sourceSlot%2?z>=m.width/2:z<m.width/2)?255:0;data={type:'matte',width:m.width,height:m.height,alpha:alpha.buffer};}
     setTimeout(()=>{if(!this.stopped)this.onmessage?.({data});},0);
    }
    terminate(){this.stopped=true;}
   };
   const run=async(cut,fps=4)=>{stats={workers:0,frames:[],resets:0,seeks:[],progress:[]};const ref=await J.generatePersonMask(cut,{fps,onProgress:p=>stats.progress.push(p)}),entry=await J.loadPersonMask(ref);return {ref,entry,stats:{...stats},slots:[...entry.slots.keys()]};};
   const bytes=async(entry,slot)=>{const f=entry.meta.frames[entry.slots.get(slot)];return Array.from(new Uint8Array(await entry.blob.slice(entry.start+f.offset,entry.start+f.offset+f.size).arrayBuffer()));};
   let keepWorker=false;
   try{
    const cut={itemId:item.id,name:item.name,type:'video',start:10,end:10.5,videoStart:1,videoLoop:false};
    const cases=[
     {end:10.5,videoStart:1,videoLoop:false},
     {end:11,videoStart:1,videoLoop:false},
     {end:10.25,videoStart:1.125,videoLoop:false},
     {end:10.5,videoStart:3.75,videoLoop:true},
     {end:20,videoStart:3.75,videoLoop:true},
     {end:12,videoStart:20,videoLoop:false},
    ].map(v=>J.personMaskTargets({...cut,...v},4,4));
    const first=await run(cut),originalBytes=await bytes(first.entry,4);first.ref.display='only';first.ref.behindLyrics=true;first.ref.behindForeground=true;
    const wider={...cut,end:12.5,videoStart:.5,personCutout:first.ref},extended=await run(wider),oldFrameKept=JSON.stringify(originalBytes)===JSON.stringify(await bytes(extended.entry,4));
    const short=await run({...wider,end:10.25,videoStart:1,personCutout:extended.ref}),repeat=await run({...wider,personCutout:short.ref});
    const late=await run({...cut,videoStart:3,personCutout:repeat.ref}),loop=await run({...cut,videoStart:3.75,videoLoop:true,personCutout:late.ref});
    const playback={...cut,videoStart:3.75,videoLoop:true,personCutout:loop.ref};await J.preparePersonMask(playback,10,true);const atTail=!!J.personMaskFrame(playback,10);await J.preparePersonMask(playback,10.25,true);const atLoop=!!J.personMaskFrame(playback,10.25);
    const gap={...cut,videoStart:3.5,personCutout:loop.ref};const missingNull=J.personMaskFrame(gap,10)===null;let strictReject=false;try{await J.preparePersonMask(gap,10,true);}catch(e){strictReject=true;}
    const all=await run({...cut,end:20,videoLoop:true,personCutout:loop.ref}),allRepeat=await run({...cut,end:30,videoLoop:true,personCutout:all.ref}),changedFps=await run({...cut,end:20,videoLoop:true,personCutout:all.ref},2);
    // Stored PNG mattes from a retired inference engine still round-trip, but
    // new inference always uses RVM and cannot append incompatible results.
    const former={...first.ref,maskId:'person_former_engine',model:'former-engine'};
    const formerFrames=first.entry.meta.frames.map(f=>first.entry.blob.slice(first.entry.start+f.offset,first.entry.start+f.offset+f.size,'image/png'));
    const formerBlob=J.packPersonMask({sourceId:item.id,model:former.model,fps:4,width:96,height:64,duration:4,indices:[4,5]},formerFrames);
    await J.storeMedia(former.maskId,formerBlob);await J.attachPersonMask(former,formerBlob);
    const regenerated=await run({...cut,personCutout:former}),regeneratedRepeat=await run({...cut,personCutout:regenerated.ref});
    const formerProject=J.defaultProject();formerProject.media.items=[item];formerProject.media.cutOverrides={0:{itemId:item.id,personCutout:former}};
    const formerPortable=await J.unpackProject(await J.packProject(formerProject)),formerEntry=await J.readPersonMask(formerPortable.files.find(f=>f.kind==='person').file,former);
    const legacy={...first.ref,maskId:'person_legacy',frameCount:16},onePng=first.entry.blob.slice(first.entry.start,first.entry.start+first.entry.meta.frames[0].size,'image/png');await J.attachPersonMask(legacy,J.packPersonMask({sourceId:item.id,model:'rvm',fps:4,width:96,height:64,duration:4},Array(16).fill(onePng)));
    const old=await run({...cut,personCutout:legacy});
    const aborter=new AbortController();stats={workers:0,frames:[],resets:0,seeks:[],progress:[]};let aborted=false;
    try{await J.generatePersonMask({...cut,videoStart:0,end:14,personCutout:first.ref},{fps:4,signal:aborter.signal,onProgress:p=>{if(p.phase==='analyze')aborter.abort();}});}catch(e){aborted=e.name==='AbortError';}
    const cancelledKept=JSON.stringify(originalBytes)===JSON.stringify(await bytes(await J.loadPersonMask(first.ref),4));
    const bad=[J.packPersonMask({sourceId:item.id,model:'rvm',fps:4,width:96,height:64,duration:4,indices:[4,4]},[onePng,onePng]),J.packPersonMask({sourceId:item.id,model:'rvm',fps:4,width:96,height:64,duration:4,indices:[16]},[onePng])];let invalidRejected=0;for(const blob of bad)try{await J.readPersonMask(blob,first.ref);}catch(e){invalidRejected++;}
    const p=J.defaultProject();p.lyrics='[00:00]range';p.durationOverride=4;p.media.items=[item];p.media.manualCuts=true;p.media.cutCount=1;p.media.cutOverrides={0:{itemId:item.id,personCutout:loop.ref}};const portable=await J.unpackProject(await J.packProject(p)),portableEntry=await J.readPersonMask(portable.files.find(f=>f.kind==='person').file,loop.ref);
    p.media.cutOverrides[0]={itemId:item.id,technique:'none',videoStart:1,videoLoop:false,untilNext:false,endTime:.5,personCutout:first.ref};J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();
    const generate=J.generatePersonMask;window.rangeUICalls=[];J.generatePersonMask=async(cut,options)=>{stats={workers:0,frames:[],resets:0,seeks:[],progress:[]};const job={cut:{...cut},done:false};rangeUICalls.push(job);const ref=await generate(cut,options);job.stats={...stats};job.ref=ref;job.done=true;return ref;};
    window.rangeFixture=async()=>Array.from(new Uint8Array(await (await J.packProject(J.ui.project)).arrayBuffer()));keepWorker=true;
    const simplify=v=>({ref:v.ref,stats:v.stats,slots:v.slots,version:v.entry.meta.version});
    return {sourceDuration,cases,first:simplify(first),extended:simplify(extended),short:simplify(short),repeat:simplify(repeat),late:simplify(late),loop:simplify(loop),all:simplify(all),allRepeat:simplify(allRepeat),changedFps:simplify(changedFps),regenerated:simplify(regenerated),regeneratedRepeat:simplify(regeneratedRepeat),portableFormer:{model:formerEntry.meta.model,slots:[...formerEntry.slots.keys()]},old:simplify(old),oldFrameKept,atTail,atLoop,missingNull,strictReject,aborted,cancelledKept,invalidRejected,portableSlots:[...portableEntry.slots.keys()]};
   }finally{if(!keepWorker){window.Worker=NativeWorker;J.seekMediaVideo=nativeSeek;}}
  });
  assert.equal(result.sourceDuration,4);assert.deepEqual(result.cases,[[4,5],[4,5,6,7],[4,5],[0,15],Array.from({length:16},(_,i)=>i),[15]]);
  assert.deepEqual(result.first.stats.frames,[4,5]);assert.deepEqual(result.first.slots,[4,5]);assert.equal(result.first.version,2);
  assert.deepEqual(result.extended.stats.frames,[2,3,6,7,8,9,10,11]);assert.equal(result.extended.stats.resets,1);assert.equal(result.oldFrameKept,true);assert.equal(result.extended.ref.display,'only');assert.equal(result.extended.ref.behindLyrics,true);assert.equal(result.extended.ref.behindForeground,true);
  for(const v of [result.short,result.repeat,result.allRepeat,result.old]){assert.equal(v.stats.workers,0);assert.deepEqual(v.stats.seeks,[]);assert.deepEqual(v.stats.frames,[]);assert.equal(v.stats.progress[0].missing,0);}
  assert.equal(result.short.ref.maskId,result.extended.ref.maskId);assert.equal(result.old.version,1);
  assert.deepEqual(result.late.stats.frames,[12,13]);assert.deepEqual(result.loop.stats.frames,[0,15]);assert.equal(result.loop.stats.resets,1);assert.deepEqual(result.all.stats.frames,[1,14]);assert.equal(result.all.ref.frameCount,16);
  assert.deepEqual(result.changedFps.stats.frames,[0,2,4,6,8,10,12,14]);assert.equal(result.changedFps.ref.frameCount,8);assert.equal(result.regenerated.ref.model,'rvm');assert.deepEqual(result.regenerated.stats.frames,[4,5]);assert.equal(result.regenerated.stats.progress[0].reused,0);assert.equal(result.regeneratedRepeat.stats.workers,0);assert.deepEqual(result.portableFormer,{model:'former-engine',slots:[4,5]});assert.deepEqual(result.regenerated.stats.inputSize,[96,64]);
  assert.equal(result.atTail,true);assert.equal(result.atLoop,true);assert.equal(result.missingNull,true);assert.equal(result.strictReject,true);assert.equal(result.aborted,true);assert.equal(result.cancelledKept,true);assert.equal(result.invalidRejected,2);assert.deepEqual(result.portableSlots,result.loop.slots);
  if(process.env.PERSON_TEST_OUTPUT&&!locale)fs.writeFileSync(process.env.PERSON_TEST_OUTPUT+'/person-range-fixture.jizuraichi',Buffer.from(await page.evaluate(()=>rangeFixture())));
  const modal=page.locator('#cutDetailsDialog');await timelineAction(page,'[data-layer="media"][data-index="0"]','details');await modal.locator('[data-detail-tab="basic"]').click();await modal.locator('[data-detail-field="endTime"]').fill('1.5');await modal.locator('[data-detail-field="endTime"]').press('Tab');await modal.locator('[data-detail-tab="personCutout"]').click();
  await page.waitForFunction(()=>document.getElementById('cutDetailsDialog').cutPreview.cut.end===1.5);assert.match(await modal.locator('[data-person-status]').textContent(),/4/);
  await modal.locator('[data-person-run]').click();await page.waitForFunction(()=>rangeUICalls[0]?.done);await modal.locator('[data-person-display]').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[data-person-display]').disabled);
  const uiFirst=await page.evaluate(()=>rangeUICalls[0]);assert.equal(uiFirst.cut.end,1.5);assert.deepEqual(uiFirst.stats.frames,[6,7,8,9]);assert.equal(uiFirst.ref.frameCount,6);assert.equal(await modal.locator('[data-person-display]').isChecked(),true);
  await modal.locator('button[type=submit]').click();await timelineAction(page,'[data-layer="media"][data-index="0"]','details');await modal.locator('[data-detail-tab="personCutout"]').click();await modal.locator('[data-person-run]').click();await page.waitForFunction(()=>rangeUICalls[1]?.done);await page.waitForFunction(()=>!document.querySelector('[data-person-display]').disabled);assert.equal(await page.evaluate(()=>rangeUICalls[1].stats.workers),0);assert.match(await modal.locator('[data-person-status]').textContent(),locale?/No additional inference/:/追加の解析は行っていません/);
  await modal.locator('[data-detail-tab="basic"]').click();await modal.locator('[data-detail-field="videoStart"]').fill('2.5');await modal.locator('[data-detail-field="videoStart"]').press('Tab');await modal.locator('[data-detail-tab="personCutout"]').click();await modal.locator('[data-person-run]').click();await page.waitForFunction(()=>rangeUICalls[2]?.done);assert.equal(await page.evaluate(()=>rangeUICalls[2].cut.videoStart),2.5);assert.deepEqual(await page.evaluate(()=>rangeUICalls[2].stats.frames),[10,11,12,13,14,15]);
  await modal.locator('button[type=submit]').click();const packedBytes=await page.evaluate(()=>rangeFixture()),fresh=await browser.newPage();
  await fresh.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(locale+'index.html')}):r.abort());await fresh.goto(url);
  await fresh.evaluate(async bytes=>J.uiApi.openProjectFile(new File([new Uint8Array(bytes)],'range.jizuraichi')),packedBytes);
  const restored=await fresh.evaluate(async()=>{const cut=J.ui.plan.media.cuts[0],entry=await J.loadPersonMask(cut.personCutout);await J.preparePersonMask(cut,.5,true);let missing;const ref=await J.generatePersonMask(cut,{fps:4,onProgress:p=>{if(p.phase==='plan')missing=p.missing;}});return {version:entry.meta.version,slots:[...entry.slots.keys()],missing,maskId:ref.maskId,originalId:cut.personCutout.maskId,visible:!!J.personMaskFrame(cut,.5)};});
  assert.equal(restored.version,2);assert.deepEqual(restored.slots,Array.from({length:12},(_,i)=>i+4));assert.equal(restored.missing,0);assert.equal(restored.maskId,restored.originalId);assert.equal(restored.visible,true);
  await fresh.reload();await fresh.waitForFunction(()=>J.mediaAssets.size===1);assert.equal(await fresh.evaluate(async()=>{const cut=J.ui.plan.media.cuts[0];await J.preparePersonMask(cut,.5,true);return !!J.personMaskFrame(cut,.5);}),true,'sparse masks survive browser reload');await fresh.close();
  assert.deepEqual(errors,[]);await page.close();console.log('PASS '+(locale||'ja')+' cut range, append-only inference, trim/reuse, loops, sparse lookup/export, legacy masks, settings, cancellation, portable sparse storage and detail UI reruns');
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
