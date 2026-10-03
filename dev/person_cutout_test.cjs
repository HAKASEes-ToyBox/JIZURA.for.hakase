const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {timelineAction}=require('./ui_helpers.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const locale of ['', 'en/']){
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));const url='http://localhost:8765/'+locale;
  await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(locale+'index.html')}):r.abort());await page.goto(url);
  const result=await page.evaluate(async()=>{
   const make=(color)=>{const c=document.createElement('canvas');c.width=c.height=100;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,100,100);return c;};
   const png=c=>new Promise(resolve=>c.toBlob(resolve,'image/png'));
   const p=J.defaultProject();p.lyrics='[00:00]test';p.durationOverride=4;p.videoSize={width:100,height:100};p.videoSizeMode='custom';p.fx.texture=0;p.fx.chroma=0;
   for(const [layer,color] of [['media','red'],['foreground','blue']]){
    const src=make(color),file=new File([await png(src)],layer+'.png',{type:'image/png'});
    await J.attachMedia({id:layer,type:'image',name:file.name},file);
    p[layer]={...J.normalizeMedia(null),items:[{id:layer,type:'image',name:file.name,width:100,height:100}],manualCuts:true,cutCount:1,cutOverrides:{0:{itemId:layer,technique:'none',entrance:'none',departure:'none',layout:'cover'}},opacity:100};
   }
   const matte=make('white');matte.getContext('2d').clearRect(50,0,50,100);
   const ref={maskId:'person_test_'+crypto.randomUUID(),sourceId:'media',model:'rvm',display:'none',behindLyrics:false,behindForeground:false,fps:24,width:100,height:100,frameCount:1,duration:0};
   const blob=J.packPersonMask({sourceId:'media',model:'rvm',fps:24,width:100,height:100,duration:0},[await png(matte)]);await J.storeMedia(ref.maskId,blob);await J.attachPersonMask(ref,blob);
   p.media.cutOverrides[0].personCutout=ref;J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();
   const plan=J.ui.plan;plan.W=plan.H=100;plan.style.schemes.forEach(s=>s.bg='#000000');const cut=plan.media.cuts[0];await J.preparePersonMask(cut,.5);
   const c=make('black'),x=c.getContext('2d'),r=new J.Renderer(),sample=()=>[[...x.getImageData(25,50,1,1).data],[...x.getImageData(75,50,1,1).data]];
   const sourceDraw=()=>{x.clearRect(0,0,100,100);J.drawMediaCut(x,cut,.5);return sample();};
   cut.personCutout.display='only';const only=sourceDraw();cut.personCutout.display='remove';const legacyDisplay=sourceDraw();
   cut.personCutout.display='only';cut.placement={cx:.75,cy:.5,w:.5,h:.5,lockAspect:true,angle:0};const moved=sourceDraw();cut.placement=null;
   cut.personCutout.display='none';cut.personCutout.behindForeground=true;r.frame(x,plan,.5,{scale:1,noLyrics:true,noHud:true,noPost:true});const front=sample();
   plan.foreground.cuts=[];cut.personCutout.behindLyrics=true;for(const c of plan.cuts)c.area=null;r.drawCut=env=>{env.ctx.setTransform(1,0,0,1,0,0);env.ctx.fillStyle='yellow';env.ctx.fillRect(0,0,100,100);};r.frame(x,plan,.5,{scale:1,noHud:true,noPost:true,noGhost:true});const lyrics=sample();
   // The silhouette follows the identical rotated placement, motion and duplicated-source effect.
   cut.personCutout.display='only';cut.placement={cx:.5,cy:.5,w:.7,h:.8,lockAspect:false,angle:32};cut.hold='rock';cut.treat='mirrorPair';sourceDraw();const displayed=x.getImageData(0,0,100,100).data;
   const hidden=make('white');J.maskBehindPersons(hidden,plan,.5,'behindForeground');const behind=hidden.getContext('2d').getImageData(0,0,100,100).data;let followError=0;for(let i=3;i<displayed.length;i+=4)followError=Math.max(followError,Math.abs(displayed[i]+behind[i]-255));
   // Source settings survive appearance changes, source changes never reuse a stale matte.
   p.media.cutOverrides[0].placement={cx:.2,cy:.3,w:.8,angle:35,lockAspect:true};p.media.cutOverrides[0].technique='beatPulse';J.uiApi.replan();const kept=J.ui.plan.media.cuts[0].personCutout.maskId===ref.maskId;
   p.media.cutOverrides[0].itemId='foreground';J.uiApi.replan();const stale=J.ui.plan.media.cuts[0].personCutout;p.media.cutOverrides[0].itemId='media';p.media.cutOverrides[0].technique='none';delete p.media.cutOverrides[0].placement;J.uiApi.replan();
   const packed=await J.packProject(p),loaded=await J.unpackProject(packed),entry=loaded.files.find(f=>f.kind==='person');const portable=entry?.file.size===blob.size && loaded.project.media.cutOverrides[0].personCutout.maskId===ref.maskId;
   const corrupt=new Blob([blob.slice(0,blob.size-1)]);let rejected=false;try{await J.readPersonMask(corrupt,ref);}catch(e){rejected=true;}
   // Deterministic frame choice is source-timed, including loops and non-looping tails.
   const second=make('white');second.getContext('2d').clearRect(0,0,50,100);const videoRef={...ref,maskId:ref.maskId+'_video',duration:2,fps:1,frameCount:2};
   await J.attachPersonMask(videoRef,J.packPersonMask({sourceId:'media',model:'rvm',fps:1,width:100,height:100,duration:2},[await png(matte),await png(second)]));
   const v={...cut,type:'video',start:10,videoStart:1,videoLoop:true,personCutout:videoRef};await J.preparePersonMask(v,10);const cv=make('black');cv.getContext('2d').clearRect(0,0,100,100);cv.getContext('2d').drawImage(J.personMaskFrame(v,10),0,0);const offset=cv.getContext('2d').getImageData(25,50,1,1).data[3];await J.preparePersonMask(v,11);cv.getContext('2d').clearRect(0,0,100,100);cv.getContext('2d').drawImage(J.personMaskFrame(v,11),0,0);const loop=cv.getContext('2d').getImageData(25,50,1,1).data[3];
   J.uiApi.replan();return {only,legacyDisplay,moved,front,lyrics,followError,kept,stale,portable,rejected,offset,loop};
  });
  assert.equal(result.only[0][3],255);assert.equal(result.only[1][3],0);assert.equal(result.legacyDisplay[0][3],255);assert.equal(result.legacyDisplay[1][3],255,'retired removal mode displays the original source');
  assert.equal(result.moved[0][3],0);assert.equal(result.moved[1][3],0,'source left half moves to x=50..75');
  assert.deepEqual(result.front[0],[255,0,0,255]);assert.deepEqual(result.front[1],[0,0,255,255]);
  assert.deepEqual(result.lyrics[0],[255,0,0,255]);assert.deepEqual(result.lyrics[1],[255,255,0,255]);
  assert.ok(result.followError<=1,'mask follows placement, rotation, motion and source effects');
  assert.equal(result.kept,true);assert.equal(result.stale,null);assert.equal(result.portable,true);assert.equal(result.rejected,true);assert.equal(result.offset,0);assert.equal(result.loop,255);
  await timelineAction(page,'[data-layer="media"][data-index="0"]','details');const modal=page.locator('#cutDetailsDialog');await modal.locator('[data-detail-tab="personCutout"]').click();
  assert.equal(await modal.locator('[data-person-model]').count(),0);assert.equal(await modal.locator('[data-person-display]').getAttribute('type'),'checkbox');assert.equal(await modal.locator('.person-cutout-options h4').textContent(),locale?'Cutout effects':'切り抜き効果');assert.equal(await modal.getByText(locale?'Remove person (leave a hole)':'人物を削除（背景に穴が開く）',{exact:true}).count(),0);
  assert.equal(await modal.locator('.person-cutout-editor > .hint').first().textContent(),locale?'Generate masks only for the range played in this cut. Run again after changing its duration or source start.':'カット内で再生する範囲だけ人物マスクを作成します。再生時間・開始位置を変えた後は再実行してください');
  assert.equal(await modal.locator('.person-cutout-editor > .hint').last().textContent(),locale?'Lowering the analysis rate finishes the cutout sooner, but masks are more likely to misalign during fast motion.':'解析枚数を下げると切り抜きが早く完了しますが、速い動きでマスクがズレやすくなります。');await modal.locator('[data-person-display]').check();await modal.locator('[data-person-option="behindLyrics"]').check();
  // Exercise UI progress and completion without downloading models in this regression suite.
  await page.evaluate(()=>{J.generatePersonMask=async(c,o)=>{o.onProgress({phase:'analyze',completed:1,total:2,backend:'Test'});await new Promise(resolve=>{window.finishPersonTest=resolve;});const ref=J.ui.project.media.cutOverrides[0].personCutout;return {...ref};};});
  const assertBusy=async()=>{
   const state=await modal.evaluate(d=>({open:d.open,busy:d.classList.contains('person-cutout-busy'),otherDisabled:[...d.querySelectorAll('input,select,textarea,button')].filter(e=>!e.closest('.person-cutout-editor')).every(e=>e.disabled),groups:[...d.querySelectorAll('.cut-details-preview,.cut-details-history,.cut-details-tabs,.cut-details-actions')].map(e=>({inert:e.inert,opacity:+getComputedStyle(e).opacity})),stopActive:!d.querySelector('[data-person-cancel]').disabled&&!d.querySelector('[data-person-cancel]').closest('[inert]')}));
   assert.equal(state.open,true);assert.equal(state.busy,true);assert.equal(state.otherDisabled,true);assert.equal(state.stopActive,true);assert.equal(state.groups.length,4);assert.ok(state.groups.every(e=>e.inert&&e.opacity<1),'preview, history, tabs and footer are inert and greyed out');
   assert.equal(await modal.locator('.cut-details-actions button').first().isDisabled(),true);assert.equal(await modal.locator('.cut-details-actions button').last().isDisabled(),true);
   const projectBefore=await page.evaluate(()=>JSON.stringify(J.ui.project));
   await modal.evaluate(d=>d.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   assert.equal(await page.evaluate(()=>JSON.stringify(J.ui.project)),projectBefore,'implicit/form submission cannot Apply during generation');
   await page.mouse.click(1,1);assert.equal(await modal.evaluate(d=>d.open),true,'backdrop cannot dismiss a running job');
   for(let i=0;i<3;i++){await page.keyboard.press('Escape');assert.equal(await modal.evaluate(d=>d.open),true,'repeated Escape cannot dismiss a running job');}
   await page.keyboard.press('Control+z');assert.equal(await modal.locator('button[type=submit]').isDisabled(),true,'undo cannot change the source during generation');
  };
  const assertIdle=async()=>{
   await page.waitForFunction(()=>!document.querySelector('#cutDetailsDialog').classList.contains('person-cutout-busy'));
   assert.equal(await modal.evaluate(d=>[...d.querySelectorAll('[inert]')].length),0);assert.equal(await modal.locator('.cut-details-actions button').first().isDisabled(),false);assert.equal(await modal.locator('.cut-details-actions button').last().isDisabled(),false);
   assert.equal(await modal.locator('[data-cut-preview-play]').isDisabled(),false);assert.equal(await modal.locator('[data-detail-field="endTime"]').isDisabled(),true,'an originally disabled field remains disabled');
   await page.waitForFunction(()=>!document.querySelector('[data-person-display]').disabled);
  };
  await modal.locator('[data-person-run]').click();assert.match(await modal.locator('[data-person-status]').textContent(),/50%/);assert.equal(await modal.locator('[data-person-display]').isDisabled(),true);
  await assertBusy();await page.setViewportSize({width:390,height:844});await assertBusy();
  if(process.env.PERSON_TEST_OUTPUT)await modal.screenshot({path:process.env.PERSON_TEST_OUTPUT+'/person-cutout-'+(locale?'en':'ja')+'-busy-mobile.png'});
  await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>finishPersonTest());await assertIdle();await modal.locator('[data-person-display]').check();await modal.locator('[data-person-option="behindLyrics"]').check();
  await page.evaluate(()=>{J.generatePersonMask=async(c,o)=>{o.onProgress({phase:'analyze',completed:1,total:10,backend:'Test'});return new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true}));};});
  await page.setViewportSize({width:390,height:844});await modal.locator('[data-person-run]').click();await assertBusy();await modal.locator('[data-person-cancel]').click();await assertIdle();assert.equal(await modal.locator('[data-person-display]').isChecked(),true,'cancellation preserves existing settings');await page.setViewportSize({width:1280,height:900});
  await page.evaluate(()=>{J.generatePersonMask=()=>new Promise((resolve,reject)=>{window.failPersonTest=()=>reject(new Error('Test inference failure'));});});
  await modal.locator('[data-person-run]').click();await assertBusy();await page.evaluate(()=>failPersonTest());await assertIdle();assert.match(await modal.locator('[data-person-status]').textContent(),/Test inference failure/);assert.equal(await modal.locator('[data-person-display]').isChecked(),true,'failure preserves existing settings');
  if(process.env.PERSON_TEST_OUTPUT){await page.setViewportSize({width:390,height:844});await modal.locator('.cut-details-form').evaluate(e=>{e.scrollTop=e.scrollHeight;});await modal.screenshot({path:process.env.PERSON_TEST_OUTPUT+'/person-cutout-'+(locale?'en':'ja')+'-mobile.png'});await page.setViewportSize({width:1280,height:900});}
  await modal.locator('[data-person-display]').uncheck();await page.waitForFunction(()=>document.querySelector('#cutDetailsDialog').cutPreview.cut.personCutout.display==='none');await modal.locator('[data-person-display]').check();
  await modal.locator('button[type=submit]').click();assert.equal(await page.evaluate(()=>J.ui.plan.media.cuts[0].personCutout.display),'only');
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await (await J.packProject(J.ui.project)).arrayBuffer()))),fresh=await browser.newPage();
  await fresh.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(locale+'index.html')}):r.abort());await fresh.goto(url);
  await fresh.evaluate(async bytes=>J.uiApi.openProjectFile(new File([new Uint8Array(bytes)],'person.jizuraichi')) ,bytes);
  const restored=await fresh.evaluate(async()=>{const cut=J.ui.plan.media.cuts[0];await J.preparePersonMask(cut,0,true);return [cut.personCutout.display,!!J.personMaskFrame(cut,0),J.mediaAssets.size];});assert.deepEqual(restored,['only',true,2]);
  await fresh.reload();await fresh.waitForFunction(()=>J.mediaAssets.size===2);assert.equal(await fresh.evaluate(async()=>{const cut=J.ui.plan.media.cuts[0];await J.preparePersonMask(cut,0,true);return !!J.personMaskFrame(cut,0);}),true,'mask survives browser reload');await fresh.close();
  await timelineAction(page,'[data-layer="foreground"][data-index="0"]','details');await page.locator('[data-detail-tab="personCutout"]').click();assert.equal(await page.locator('[data-person-display]').isDisabled(),true);await page.locator('#cutDetailsDialog .cut-details-actions button').last().click();
  await timelineAction(page,'[data-layer="media"][data-index="0"]','details');await page.mouse.click(1,1);await page.waitForFunction(()=>!document.querySelector('#cutDetailsDialog'),'idle modal still dismisses via backdrop');
  assert.deepEqual(errors,[]);await page.close();console.log('PASS '+(locale||'ja')+' person masks: pixels, transforms, source timing, links, portable persistence, UI progress, busy modal guards, mobile Stop and completion/cancel/failure unlock');
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
