const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
 for(const locale of ['', 'en/']){
  const page=await browser.newPage({viewport:{width:1500,height:1000},hasTouch:true}),errors=[],url='http://127.0.0.1/';page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(locale+'index.html')}):r.abort());await page.goto(url);
  const composition=await page.evaluate(()=>{
   const source=document.createElement('canvas');source.width=192;source.height=108;const x=source.getContext('2d');x.fillStyle='red';x.fillRect(0,0,192,36);x.fillStyle='#00ff00';x.fillRect(0,36,192,36);x.fillStyle='blue';x.fillRect(0,72,192,36);
   const canvas=document.createElement('canvas');canvas.width=144;canvas.height=256;const ctx=canvas.getContext('2d'),renderer=new J.ShortFrameRenderer(),samples=[];
   const rgb=(xx,yy)=>[...ctx.getImageData(xx,yy,1,1).data].slice(0,3);
   for(const mode of ['zoom','tile','ambient'])for(const blur of [0,100]){renderer.frame(ctx,source,{mode,blur});samples.push({mode,blur,center:rgb(72,128),top:rgb(72,20),bottom:rgb(72,236)});}
   // Strong blur smooths stripes in the fill without blurring the central video.
   for(let i=0;i<192;i++){x.fillStyle=i%8<4?'white':'black';x.fillRect(i,0,1,108);}const contrast=[];
   for(const blur of [0,100]){renderer.frame(ctx,source,{mode:'ambient',blur});const values=[];for(let i=8;i<136;i++)values.push(rgb(i,40)[0]);const mean=values.reduce((a,b)=>a+b,0)/values.length;contrast.push(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length);}
   const invalid=[];for(const settings of [{start:2,end:1},{start:0,end:4},{start:3,end:3}]){try{J.shortExportRange({duration:3},settings);invalid.push(false);}catch{invalid.push(true);}}
   return {samples,contrast,invalid,bounded:renderer.background.height<=384,defaults:J.shortExportSettings(null)};
  });
  for(const sample of composition.samples)assert.deepEqual(sample.center,[0,255,0],'The center must remain sharp for every mode and blur level');const ambient=composition.samples.find(s=>s.mode==='ambient'&&!s.blur);assert.ok(ambient.top[0]>100&&ambient.top[2]===0);assert.ok(ambient.bottom[2]>100&&ambient.bottom[0]===0);assert.ok(composition.contrast[1]<composition.contrast[0]/8,'Blur must smooth the fill');assert.ok(composition.bounded);assert.ok(composition.invalid.every(Boolean));assert.equal(composition.defaults.res,1080);
  const encoded=await page.evaluate(async()=>{
   // Verify source times and audible content using a real AAC/H.264 file.
   const project={...J.defaultProject(),fps:24,videoSize:{w:320,h:180},durationOverride:2,quality:'standard'},plan=J.plan(project),audio={buffer:new AudioBuffer({length:96000,numberOfChannels:1,sampleRate:48000})};
   const samples=audio.buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=.1*Math.sin(2*Math.PI*(i<48000?440:880)*i/48000);
   const OriginalRenderer=J.Renderer,prepare=J.prepareMediaFrame,times=[],out=[];J.ui.exporting={};
   J.Renderer=class{frame(ctx,p,t){times.push(t);ctx.fillStyle=t<1?'#ff0000':'#00ff00';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);}};J.prepareMediaFrame=async(p,t)=>{};
   try{
    for(const mode of ['zoom','tile','ambient']){
     times.length=0;const result=await J.exportMP4({project,plan,audio,short:{start:1,end:1.25,mode,blur:60,res:720}}),video=document.createElement('video'),src=URL.createObjectURL(result.blob);video.muted=true;video.src=src;
     await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(Error('Cannot decode Shorts MP4'));});video.currentTime=.08;await new Promise(resolve=>{video.onseeked=resolve;});const c=document.createElement('canvas');c.width=144;c.height=256;const x=c.getContext('2d');x.drawImage(video,0,0,144,256);const center=[...x.getImageData(72,128,1,1).data].slice(0,3);
     const context=new AudioContext(),pcm=await context.decodeAudioData(await result.blob.arrayBuffer()),data=pcm.getChannelData(0),start=Math.floor(.05*pcm.sampleRate),end=Math.floor(.18*pcm.sampleRate);let crossings=0;for(let i=start;i<end;i++)if(data[i]<=0&&data[i+1]>0)crossings++;await context.close();
     out.push({mode,width:video.videoWidth,height:video.videoHeight,duration:video.duration,center,times:[...times],audio:result.audio,frequency:crossings/((end-start)/pcm.sampleRate)});video.removeAttribute('src');video.load();URL.revokeObjectURL(src);
    }
   }finally{J.Renderer=OriginalRenderer;J.prepareMediaFrame=prepare;J.ui.exporting=null;}
   return out;
  });
  for(const result of encoded){assert.equal(result.width,720);assert.equal(result.height,1280);assert.ok(Math.abs(result.duration-.25)<.08);assert.ok(result.center[1]>220&&result.center[0]<20);assert.equal(result.times.length,6);assert.equal(result.times[0],1);assert.ok(result.times.at(-1)<1.25);assert.ok(result.audio);assert.ok(Math.abs(result.frequency-880)<35,JSON.stringify(result));}
  await page.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=160;c.height=90;const x=c.getContext('2d'),target=new Mp4Muxer.ArrayBufferTarget(),muxer=new Mp4Muxer.Muxer({target,video:{codec:'avc',width:160,height:90,frameRate:24},fastStart:'in-memory',firstTimestampBehavior:'offset'}),encoder=new VideoEncoder({output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),error:e=>{throw e;}});encoder.configure({codec:'avc1.42001e',width:160,height:90,framerate:24,bitrate:400000});
   for(let i=0;i<72;i++){x.fillStyle='red';x.fillRect(0,0,160,30);x.fillStyle=`rgb(0,${120+i},0)`;x.fillRect(0,30,160,30);x.fillStyle='blue';x.fillRect(0,60,160,30);const frame=new VideoFrame(c,{timestamp:Math.round(i/24*1e6),duration:Math.round(1e6/24)});encoder.encode(frame,{keyFrame:i%24===0});frame.close();}await encoder.flush();encoder.close();muxer.finalize();
   const p=J.defaultProject(),item={id:'short-video',type:'video',name:'short.mp4'};p.lyrics='';p.videoSize={w:320,h:180};p.durationOverride=3;p.quality='standard';p.shortExport={start:1,end:1.25,mode:'ambient',blur:35,res:720};await J.attachMedia(item,new File([target.buffer],item.name,{type:'video/mp4'}));
   p.media={...p.media,items:[item],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},effects:{autoPlacement:false,applyLyricBackground:false,decor:false},cutOverrides:{0:{itemId:item.id,technique:'legacy',enter:'cut',exit:'cut',hold:'still',placement:{cx:.5,cy:.5,w:1,h:1,lockAspect:true}}}};
   J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();J.uiApi.seek(.5);J.ensureFonts=async()=>{};window.showSaveFilePicker=undefined;
  });
  for(const width of [1500,390]){
   await page.setViewportSize({width,height:width===390?844:1000});await page.locator('#outputMenu summary').click();await page.locator('#menuShort').click();await page.waitForFunction(()=>!document.querySelector('#btnShort').disabled);
   assert.equal(await page.locator('#shortExportOptions').isVisible(),true);assert.equal(await page.locator('#outAspect').isVisible(),false);assert.equal(await page.locator('#outVideoSize').isVisible(),false);assert.equal(await page.locator('#outQuality').isVisible(),true);assert.equal(await page.locator('#outAudio').isVisible(),true);
   assert.equal(await page.locator('#exportDlgTitle').evaluate(el=>el.nextElementSibling.id),'shortExportDescription');assert.equal(await page.locator('#shortExportDescription').isVisible(),true);
   const bar=await page.locator('#shortRange').boundingBox(),at=t=>bar.x+10+(bar.width-20)*t/3;
   await page.mouse.move(at(1),bar.y+22);await page.mouse.down();await page.mouse.move(at(.75),bar.y+22,{steps:5});await page.mouse.up();assert.ok(Math.abs(Number(await page.locator('#shortStart').inputValue())-.75)<.015);
   await page.mouse.move(at(1.25),bar.y+22);await page.mouse.down();await page.mouse.move(at(2.5),bar.y+22,{steps:5});await page.mouse.up();assert.ok(Math.abs(Number(await page.locator('#shortEnd').inputValue())-2.5)<.015);
   await page.locator('#shortStart').focus();await page.keyboard.press('End');assert.ok(Number(await page.locator('#shortStart').inputValue())<Number(await page.locator('#shortEnd').inputValue()),'The start thumb must not cross the end thumb');
   await page.locator('#shortEnd').focus();await page.keyboard.press('Home');assert.ok(Number(await page.locator('#shortEnd').inputValue())>Number(await page.locator('#shortStart').inputValue()),'The end thumb must not cross the start thumb');
   const tightStart=Number(await page.locator('#shortStart').inputValue());await page.mouse.move(at(tightStart)-1,bar.y+22);await page.mouse.down();await page.mouse.move(at(.5),bar.y+22,{steps:5});await page.mouse.up();assert.ok(Math.abs(Number(await page.locator('#shortStart').inputValue())-.5)<.015,'Overlapping thumbs must still allow the range to expand');
   await page.locator('#shortStart').fill('1');await page.locator('#shortEnd').fill('1.25');
   const touch=await page.context().newCDPSession(page);await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:at(1.25),y:bar.y+22}]});await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:at(2),y:bar.y+22}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();assert.ok(Math.abs(Number(await page.locator('#shortEnd').inputValue())-2)<.015);await page.locator('#shortEnd').fill('1.25');
   assert.equal(await page.locator('#shortStartValue').textContent(),'1.000');assert.equal(await page.locator('#shortEndValue').textContent(),'1.250');
   await page.locator('#shortBlur').fill('0');await page.locator('#shortFill').selectOption('tile');await page.waitForTimeout(80);await page.locator('#shortFill').selectOption('ambient');await page.locator('#shortBlur').fill('65');
   await page.locator('#shortPreviewSeek').fill('1.125');await page.waitForFunction(()=>Math.abs(J.mediaAssets.get('short-video').element.currentTime-1.125)<.025);assert.equal(await page.evaluate(()=>J.ui.t),.5,'Preview must preserve the editor clock');
   await page.locator('#shortPreviewPlay').click();await page.waitForTimeout(180);assert.equal(await page.locator('#shortPreviewPlay').innerText(),'❚❚');await page.locator('#shortPreviewPlay').click();
   const geometry=await page.locator('#shortExportPreview').boundingBox();assert.ok(geometry.width<=234&&geometry.width>100);assert.ok(Math.abs(geometry.height/geometry.width-16/9)<.03);
   await page.locator('#shortEnd').fill('0.5');assert.ok(Number(await page.locator('#shortEnd').inputValue())>Number(await page.locator('#shortStart').inputValue()));await page.locator('#shortEnd').fill('1.25');await page.waitForFunction(()=>!document.querySelector('#btnShort').disabled);
   if(process.env.JIZURA_QA_DIR)await page.screenshot({path:process.env.JIZURA_QA_DIR+'/short-export-'+(locale?'en':'ja')+'-'+width+'.png',scale:'css'});
   await page.locator('#btnCloseExport').click();await page.waitForFunction(()=>Math.abs(J.mediaAssets.get('short-video').element.currentTime-.5)<.025);assert.deepEqual(await page.evaluate(()=>J.outputSize(J.ui.project)),[320,180]);
   await page.locator('#outputMenu summary').click();await page.locator('#menuMP4').click();assert.equal(await page.locator('#shortExportOptions').isVisible(),false);assert.equal(await page.locator('#shortExportDescription').isVisible(),false);assert.equal(await page.locator('#outVideoSize').isVisible(),true);assert.equal(await page.locator('#btnShort').isVisible(),false);await page.locator('#btnCloseExport').click();
  }
  await page.locator('#outputMenu summary').click();await page.locator('#menuShort').click();await page.waitForFunction(()=>!document.querySelector('#btnShort').disabled);
  await page.evaluate(()=>{window.realShortExport=J.exportMP4;J.exportMP4=async opts=>{opts.onProgress(.3,'working');await new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new Error('Cancelled')),{once:true}));};});await page.locator('#btnShort').click();await page.waitForFunction(()=>!!J.ui.exporting);assert.equal(await page.locator('#shortStart').isDisabled(),true);assert.equal(await page.locator('#shortFill').isDisabled(),true);assert.equal(await page.locator('#shortPreviewPlay').isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#exportDlg').evaluate(el=>el.open),true);await page.locator('#exportDlg .exp-cancel').click();await page.waitForFunction(()=>!J.ui.exporting);assert.equal(await page.locator('#shortStart').isEnabled(),true);assert.ok((await page.locator('#exportDlg .exp-text').textContent()).includes(locale?'Cancelled':'キャンセル'));await page.evaluate(()=>{J.exportMP4=window.realShortExport;});await page.waitForFunction(()=>!document.querySelector('#btnShort').disabled);
  const ready=page.waitForEvent('download');await page.locator('#btnShort').click();const download=await ready;assert.equal(download.suggestedFilename(),'jizura_short.mp4');await page.waitForFunction(()=>!J.ui.exporting);assert.equal(await page.locator('#shortStart').isEnabled(),true);assert.equal(await page.locator('#btnCloseExport').isEnabled(),true);assert.deepEqual(await page.evaluate(()=>J.outputSize(J.ui.project)),[320,180]);assert.equal(await page.evaluate(()=>J.projectSettings(J.ui.project).shortExport.blur),65);
  assert.deepEqual(errors,[]);console.log('PASS '+(locale||'ja')+' fills, blur, timed AAC/MP4, mouse/touch/keyboard range, mobile dialog, preview, restore, cancellation and download');await page.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1);});
