const {chromium}=require('playwright');
const {timelineAction}=require('./ui_helpers.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const locale of ['', 'en/']){
  const page=await browser.newPage({viewport:{width:1500,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const url='http://test/'+locale;
  await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',locale,'index.html'))}):r.abort());
  await page.goto(url);
  await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
   const stream=canvas.captureStream(20),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];
   recorder.ondataavailable=e=>chunks.push(e.data);
   const recorded=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
   const draw=setInterval(()=>{const x=canvas.getContext('2d');x.fillStyle=`hsl(${performance.now()%360},100%,50%)`;x.fillRect(0,0,160,90);},50);
   await new Promise(resolve=>setTimeout(resolve,3200));recorder.stop();await recorded;clearInterval(draw);stream.getTracks().forEach(t=>t.stop());
   const blob=new Blob(chunks,{type:'video/webm'}),p=J.defaultProject();p.lyrics='[00:00]プレビュー';p.durationOverride=6;
   for(const [layer,id,offset] of [['foreground','fg',.3],['media','bg',.8]]){
    const item={id,name:id+'.webm',type:'video'};const v=await J.attachMedia(item,blob);
    // The real importer schedules a main-screen redraw whenever a seek finishes.
    v.addEventListener('seeked',()=>{J.ui.need=true;});
    p[layer]={...p[layer],items:[item],manualCuts:true,cutCount:2,timing:{lineTimes:{0:0,1:3}},cutOverrides:{0:{itemId:id,technique:'none',videoStart:offset,videoLoop:true},1:{itemId:id,technique:'none',videoStart:offset,videoLoop:true}}};
   }
   J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();J.uiApi.seek(4);
   window.syncCalls=[];const sync=J.syncMediaPreview;J.syncMediaPreview=(plan,t,playing)=>{if(document.querySelector('#cutDetailsDialog')?.open)syncCalls.push({main:plan===J.ui.plan,t,playing});return sync(plan,t,playing);};
  });
  const modal=page.locator('#cutDetailsDialog');
  for(const layer of ['foreground','media']){
   await timelineAction(page,`[data-layer="${layer}"][data-index="0"]`,'details');
   await page.waitForTimeout(650);
   const calls=await page.evaluate(()=>syncCalls.splice(0));
   assert.equal(calls.filter(c=>c.main).length,0,'main must not seek/pause detail-preview videos');
   const play=modal.locator('[data-cut-preview-play]'),seek=modal.locator('[data-cut-preview-seek]');
   await play.click();await seek.evaluate(el=>{el.value='600';el.dispatchEvent(new Event('input',{bubbles:true}));});
   await page.waitForTimeout(200);
   const check=()=>page.evaluate(()=>{const d=document.querySelector('#cutDetailsDialog'),t=d.cutPreview.cut.start+Number(d.querySelector('[data-cut-preview-seek]').value)/1000*(Math.min(d.cutPreview.cut.end,d.cutPreview.plan.duration)-d.cutPreview.cut.start);return ['foreground','media'].map(layer=>{const c=J.mediaAt(d.cutPreview.plan,t,layer),v=J.mediaAssets.get(c.itemId).element,target=J.mediaVideoTime(c,t,v.duration),gap=Math.abs(v.currentTime-target);return {time:v.currentTime,target,paused:v.paused,gap:c.videoLoop?Math.min(gap,Math.abs(v.duration-gap)):gap};});});
   for(const v of await check()){assert.ok(Math.abs(v.time-v.target)<.1,JSON.stringify(v));assert.equal(v.paused,true);}
   await play.click();await page.waitForTimeout(550);
   for(const v of await check()){assert.ok(v.gap<.3,JSON.stringify(v));assert.equal(v.paused,false);}
   // Cross the cut's loop boundary and check that both source offsets are restored.
   await seek.evaluate(el=>{el.value='970';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForTimeout(700);
   for(const v of await check())assert.ok(v.gap<.3,'loop '+JSON.stringify(v));
   await modal.getByRole('button',{name:locale?'Cancel':'キャンセル',exact:true}).click();await modal.waitFor({state:'detached'});await page.waitForTimeout(200);
   assert.equal(await page.evaluate(()=>J.ui.t),4,'main playhead is preserved');
   const restored=await page.evaluate(()=>['foreground','media'].map(layer=>{const c=J.mediaAt(J.ui.plan,J.ui.t,layer),v=J.mediaAssets.get(c.itemId).element;return Math.abs(v.currentTime-J.mediaVideoTime(c,J.ui.t,v.duration));}));
   restored.forEach(d=>assert.ok(d<.1,'restore '+d));
  }
  assert.deepEqual(errors,[]);await page.close();console.log('PASS detail video playback '+(locale||'ja'));
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
