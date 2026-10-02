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
   p.effectFavorites=[{id:'first',name:'First',payload:J.cutEffectsPayload(J.ui.plan.foreground.cuts[0],'foreground',J.ui.plan)},{id:'second',name:'Second',payload:J.cutEffectsPayload(J.ui.plan.media.cuts[0],'media',J.ui.plan)}];
   window.syncCalls=[];const sync=J.syncMediaPreview;J.syncMediaPreview=(plan,t,playing)=>{if(document.querySelector('#effectFavoritesDialog')?.open)syncCalls.push({main:plan===J.ui.plan,t,playing});return sync(plan,t,playing);};
  });
  const modal=page.locator('#effectFavoritesDialog');
  for(const layer of ['foreground','media']){
   await timelineAction(page,`[data-layer="${layer}"][data-index="0"]`,'paste');
   await page.waitForFunction(()=>document.querySelector('#effectFavoritesDialog')?.favoritePreview);
   const check=()=>page.evaluate(()=>{const call=syncCalls.at(-1),d=document.querySelector('#effectFavoritesDialog'),plan=d.favoritePreview.plan,t=call.t;return ['foreground','media'].map(layer=>{const c=J.mediaAt(plan,t,layer),v=J.mediaAssets.get(c.itemId).element,target=J.mediaVideoTime(c,t,v.duration),gap=Math.abs(v.currentTime-target);return {time:v.currentTime,target,paused:v.paused,gap:c.videoLoop?Math.min(gap,Math.abs(v.duration-gap)):gap};});});
   await page.waitForTimeout(650);
   assert.equal(await page.evaluate(()=>syncCalls.filter(c=>c.main).length),0,'main does not reset gallery videos');
   for(const v of await check()){assert.ok(v.gap<.3,JSON.stringify(v));assert.equal(v.paused,false);}
   await modal.locator('.favorite-play').nth(1).click();await page.waitForTimeout(650);
   for(const v of await check()){assert.ok(v.gap<.3,JSON.stringify(v));assert.equal(v.paused,false);}
   await page.waitForTimeout(2700);for(const v of await check())assert.ok(v.gap<.3,'loop '+JSON.stringify(v));
   await modal.locator('.favorite-close').click();await modal.waitFor({state:'detached'});await page.waitForTimeout(200);
   assert.equal(await page.evaluate(()=>J.ui.t),4,'main playhead preserved');
   const restored=await page.evaluate(()=>['foreground','media'].map(layer=>{const c=J.mediaAt(J.ui.plan,J.ui.t,layer),v=J.mediaAssets.get(c.itemId).element;return {gap:Math.abs(v.currentTime-J.mediaVideoTime(c,J.ui.t,v.duration)),paused:v.paused};}));restored.forEach(v=>{assert.ok(v.gap<.1,'restore '+JSON.stringify(v));assert.equal(v.paused,true);});
  }
  assert.deepEqual(errors,[]);await page.close();console.log('PASS favorite video playback '+(locale||'ja'));
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
