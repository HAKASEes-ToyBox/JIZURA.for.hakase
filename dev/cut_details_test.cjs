const {chromium}=require('playwright');
const {openSettings,closeSettings,proMode,timelineAction}=require('./ui_helpers.cjs');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try { for(const locale of ['', 'en/']) {
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
  const url='http://127.0.0.1:8765/'+locale;
  await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',locale,'index.html'))}):r.abort());
  await page.goto(url);
  await page.evaluate(()=>{
    const p=J.defaultProject();p.lyrics='[00:00]最初の歌詞/次の歌詞\n[00:04]最後の歌詞';p.durationOverride=8;
    for(const layer of ['foreground','media'])p[layer]={...p[layer],manualCuts:true,cutCount:2,timing:{lineTimes:{0:0,1:4}},cutOverrides:{0:{technique:'none'},1:{technique:'none'}}};
    J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();
  });
  assert.deepEqual(errors,[]);
  const original=await page.evaluate(()=>JSON.stringify(J.ui.project));
  await timelineAction(page,'[data-layer="lyrics"]','details');
  const modal=page.locator('#cutDetailsDialog');
  await modal.locator('[data-detail-field="text"]').fill('変更キャンセル');
  await modal.getByRole('button',{name:locale?'Cancel':'キャンセル',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.stringify(J.ui.project)),original);
  await page.locator('#lineList .cut-details-open').first().click();
  await modal.locator('[data-detail-field="text"]').fill('編集したカット');
  await modal.locator('[data-detail-field="opacity"]').fill('42');
  await modal.locator('[data-detail-field="blend"]').selectOption('overlay');
  await modal.locator('[data-detail-tab="motion"]').click();
  await modal.locator('[data-detail-field="hold"]').selectOption('still');
  await modal.locator('[data-detail-tab="placement"]').click();
  await modal.locator('[data-detail-field="area.w"]').fill('0.6');
  await modal.getByRole('button',{name:locale?'Apply':'適用',exact:true}).click();
  const saved=await page.evaluate(()=>{J.uiApi.replan();return J.ui.plan.cuts.filter(c=>c.line>=0&&Number.isInteger(c.part)).map(c=>({text:c.text,opacity:c.opacity,blend:c.blend,area:c.area}));});
  assert.equal(saved[0].text,'編集したカット');assert.equal(saved[0].opacity,42);assert.equal(saved[0].blend,'overlay');assert.equal(saved[0].area.w,.6);assert.notEqual(saved[1].text,saved[0].text);
  for(const layer of ['foreground','media']){
    await timelineAction(page,`[data-layer="${layer}"]`,'details');
    await modal.locator('[data-detail-tab="motion"]').click();
  await modal.locator('[data-detail-field="technique"]').selectOption('beatPulse');
    await modal.locator('[data-detail-tab="other"]').click();
  await modal.locator('[data-detail-field="bpm"]').fill('90');
    await modal.locator('[data-detail-tab="placement"]').click();
  await modal.locator('[data-detail-field="placement.angle"]').fill('25');
    await modal.getByRole('button',{name:locale?'Apply':'適用',exact:true}).click();
    const value=await page.evaluate(layer=>{J.uiApi.replan();return J.ui.plan[layer].cuts[0];},layer);
    assert.equal(value.technique,'beatPulse');assert.equal(value.bpm,90);assert.equal(value.placement.angle,25);
  }
  await page.evaluate(()=>{J.ui.project.timelineLinks=[{a:'l:1:0',b:'f:1'}];J.uiApi.replan();});
  await timelineAction(page,'[data-layer="foreground"][data-index="1"]','details');
  await modal.locator('[data-detail-field="start"]').fill('4.5');
  await modal.getByRole('button',{name:locale?'Apply':'適用',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>[J.ui.plan.cuts.find(c=>c.line===1&&c.part===0).start,J.ui.plan.foreground.cuts[1].start]),[4.5,4.5]);
  await page.locator('#btnUndo').click();
  assert.deepEqual(await page.evaluate(()=>[J.ui.plan.cuts.find(c=>c.line===1&&c.part===0).start,J.ui.plan.foreground.cuts[1].start]),[4,4]);
  await page.evaluate(()=>J.uiApi.flushSave());await page.reload();
  await page.waitForFunction(()=>J.ui.plan);
  assert.equal(await page.evaluate(()=>J.ui.plan.cuts.find(c=>c.line===0&&c.part===0).text),'編集したカット');
  assert.equal(await page.evaluate(()=>J.ui.plan.media.cuts[0].bpm),90);
  assert.deepEqual(errors,[]);console.log(locale||'ja', 'cut details passed');await page.close();
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});


