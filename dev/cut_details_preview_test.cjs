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
    const img=document.createElement('canvas');img.width=160;img.height=90;const g=img.getContext('2d');g.fillStyle='#e33';g.fillRect(0,0,160,90);J.mediaAssets.set('pv',{element:img,type:'image'});
    for(const layer of ['foreground','media'])p[layer]={...p[layer],items:[{id:'pv',name:'pv.png',type:'image',width:160,height:90}],manualCuts:true,cutCount:2,timing:{lineTimes:{0:0,1:4}},cutOverrides:{0:{itemId:'pv',technique:'none'},1:{itemId:'pv',technique:'none'}}};
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
  assert.deepEqual(errors,[]);console.log(locale||'ja',viewport.width,'cut details preview passed');await page.close();
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
