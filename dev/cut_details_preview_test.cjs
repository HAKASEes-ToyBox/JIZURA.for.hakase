const {chromium}=require('playwright');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try { for(const locale of ['', 'en/']) for(const viewport of [{width:1500,height:900},{width:720,height:820}]) {
  const page=await browser.newPage({viewport}),errors=[],narrow=viewport.width<860;
  page.on('pageerror',e=>errors.push(e.message));
  const url='http://127.0.0.1:8765/'+locale;
  await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',locale,'index.html'))}):r.abort());
  await page.goto(url);
  await page.evaluate(()=>{
    const p=J.defaultProject();p.lyrics='[00:00]最初の歌詞/次の歌詞\n[00:04]最後の歌詞';p.durationOverride=8;
    // Foreground: a small green block (transparent elsewhere); background: solid blue.
    for(const [id,color,rect] of [['fg','#0c0',[20,30,40,30]],['bg','#00d',[0,0,160,90]]]){const img=document.createElement('canvas');img.width=160;img.height=90;const g=img.getContext('2d');g.fillStyle=color;g.fillRect(...rect);J.mediaAssets.set(id,{element:img,type:'image'});}
    for(const [layer,id] of [['foreground','fg'],['media','bg']])p[layer]={...p[layer],items:[{id,name:id+'.png',type:'image',width:160,height:90}],manualCuts:true,cutCount:2,timing:{lineTimes:{0:0,1:4}},cutOverrides:{0:{itemId:id,technique:'none'},1:{itemId:id,technique:'none'}}};
    J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();
  });
  const modal=page.locator('#cutDetailsDialog'),pane=modal.locator('.cut-details-preview'),form=modal.locator('.cut-details-form');
  const state=()=>page.evaluate(()=>{const c=document.querySelector('#cutDetailsDialog').cutPreview.cut;return {text:c.text,opacity:c.opacity,hold:c.hold,technique:c.technique,start:c.start,end:c.end};});
  const original=await page.evaluate(()=>JSON.stringify(J.ui.project));
  // Lyrics: preview shows this cut, updates before Apply and never touches the project.
  await page.locator('#timelineLinks [data-action="details"][data-layer="lyrics"]').first().dispatchEvent('pointerdown',{button:0});
  assert.equal(await pane.isVisible(),true);
  assert.equal(await pane.locator('h2').textContent(),(locale?'Edit cut details — Lyrics':'カットの詳細編集 — 歌詞')+' 1 / 1');
  await page.waitForTimeout(400);
  const drawn=await pane.locator('canvas').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=16)if(d[i]+d[i+1]+d[i+2]>200)n++;return {w:c.width,h:c.height,bright:n};});
  assert.ok(drawn.w>=320&&Math.abs(drawn.w/drawn.h-16/9)<.02&&drawn.bright>20,'canvas '+JSON.stringify(drawn));
  const first=await state();assert.equal(await pane.locator('.effect-preview-dur').textContent(),await page.evaluate(t=>J.fmtTime(t+1e-6),first.end-first.start));
  assert.notEqual(await pane.locator('.effect-preview-now').textContent(),'00:00.00');
  await modal.locator('[data-detail-field="text"]').fill('プレビュー反映');await modal.locator('[data-detail-field="text"]').dispatchEvent('change');
  await modal.locator('[data-detail-field="opacity"]').fill('42');await modal.locator('[data-detail-field="opacity"]').dispatchEvent('change');
  await page.waitForTimeout(250);
  assert.deepEqual([(await state()).text,(await state()).opacity],['プレビュー反映',42]);
  await modal.locator('[data-detail-field="hold"]').selectOption('still');assert.equal((await state()).hold,'still');
  assert.equal(await page.evaluate(()=>JSON.stringify(J.ui.project)),original);
  // Scrolling the settings keeps the preview in the same place, fully in view.
  const before=await pane.locator('canvas').boundingBox();
  await form.evaluate(el=>{el.scrollTop=el.scrollHeight;});await page.waitForTimeout(100);
  assert.ok(await form.evaluate(el=>el.scrollTop>0),'settings scroll');
  const after=await pane.locator('canvas').boundingBox();
  assert.deepEqual([Math.round(after.x),Math.round(after.y)],[Math.round(before.x),Math.round(before.y)]);
  assert.ok(after.y>=0&&after.y+after.height<=viewport.height&&after.height>40,'preview visible '+JSON.stringify(after));
  assert.equal(await modal.getByRole('button',{name:locale?'Apply':'適用',exact:true}).isVisible(),true);
  if(narrow)assert.ok(after.height<=viewport.height*.31,'narrow preview height');
  await modal.getByRole('button',{name:locale?'Cancel':'キャンセル',exact:true}).click();
  await modal.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>JSON.stringify(J.ui.project)),original);
  // Foreground / background: technique changes show in the preview, Apply saves them.
  for(const layer of ['foreground','media']){
    await page.locator(`#timelineLinks [data-action="details"][data-layer="${layer}"]`).first().dispatchEvent('pointerdown',{button:0});
    await modal.locator('[data-detail-field="technique"]').selectOption('kenBurns');
    assert.equal((await state()).technique,'kenBurns');
    assert.equal(await page.evaluate(()=>{const d=document.querySelector('#cutDetailsDialog');return d.cutPreview.plan!==J.ui.plan;}),true);
    await modal.getByRole('button',{name:locale?'Apply':'適用',exact:true}).click();
    assert.equal(await page.evaluate(layer=>J.ui.plan[layer].cuts[0].technique,layer),'kenBurns');
  }
  // "Show the edited cut only": other layers and lyric cuts disappear; the choice is remembered.
  const colors=()=>pane.locator('canvas').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let green=0,blue=0;for(let i=0;i<d.length;i+=8){if(d[i+1]>150&&d[i]<80&&d[i+2]<80)green++;if(d[i+2]>150&&d[i]<80&&d[i+1]<80)blue++;}return {green,blue};});
  const open=async layer=>{await page.locator(`#timelineLinks [data-action="details"][data-layer="${layer}"]`).first().dispatchEvent('pointerdown',{button:0});await page.waitForTimeout(350);};
  const close=async()=>{await modal.getByRole('button',{name:locale?'Cancel':'キャンセル',exact:true}).click();await modal.waitFor({state:'detached'});};
  await open('lyrics');const solo=modal.locator('[data-preview-solo]');
  assert.equal((await modal.locator('.cut-details-solo span').textContent()),locale?'Show the edited cut only':'編集対象単体を表示');
  assert.equal(await solo.isChecked(),false);let seen=await colors();assert.ok(seen.green>0&&seen.blue>0,'all layers '+JSON.stringify(seen));
  await solo.check();await page.waitForTimeout(300);seen=await colors();assert.deepEqual(seen,{green:0,blue:0});await close();
  await open('foreground');assert.equal(await solo.isChecked(),true);seen=await colors();assert.ok(seen.green>0&&seen.blue===0,'foreground only '+JSON.stringify(seen));await close();
  await open('media');seen=await colors();assert.ok(seen.blue>0&&seen.green===0,'background only '+JSON.stringify(seen));
  await solo.uncheck();await page.waitForTimeout(300);seen=await colors();assert.ok(seen.green>0&&seen.blue>0,'solo off '+JSON.stringify(seen));await close();
  // "Focus on the edited cut": the cut is enlarged to fill the preview; full-frame cuts stay as they are.
  const share=()=>pane.locator('canvas').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let green=0,blue=0,bright=0,n=0;for(let i=0;i<d.length;i+=8){n++;if(d[i+1]>150&&d[i]<80&&d[i+2]<80)green++;if(d[i+2]>150&&d[i]<80&&d[i+1]<80)blue++;if(d[i]>170&&d[i+1]>170&&d[i+2]>170)bright++;}return {green:green/n,blue:blue/n,bright:bright/n};});
  await open('foreground');const focus=modal.locator('[data-preview-focus]');
  assert.equal(await modal.locator('.cut-details-focus span').textContent(),locale?'Focus on the edited cut':'編集対象にフォーカス');
  assert.equal(await focus.isChecked(),false);const wide=await share();assert.ok(wide.green>.02&&wide.green<.15,'foreground unfocused '+JSON.stringify(wide));
  await focus.check();await page.waitForTimeout(300);const close_=await share();assert.ok(close_.green>.4&&close_.green>wide.green*4,'foreground focused '+JSON.stringify(close_));await close();
  await open('media');assert.equal(await focus.isChecked(),true);const full=await share();assert.ok(full.blue>.6,'full-frame background '+JSON.stringify(full));await close();
  await open('lyrics');await modal.locator('[data-preview-solo]').check();await focus.uncheck();await page.waitForTimeout(300);
  let small=0,large=0;for(let i=0;i<6;i++){small=Math.max(small,(await share()).bright);await page.waitForTimeout(60);}
  await focus.check();await page.waitForTimeout(300);for(let i=0;i<6;i++){large=Math.max(large,(await share()).bright);await page.waitForTimeout(60);}
  assert.ok(large>small*1.5&&large>0,'lyrics focused '+small+' -> '+large);
  await focus.uncheck();await modal.locator('[data-preview-solo]').uncheck();await close();
  assert.deepEqual(errors,[]);console.log(locale||'ja',viewport.width,'cut details preview passed');await page.close();
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
