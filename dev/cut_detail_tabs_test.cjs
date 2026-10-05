const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {timelineAction}=require('./ui_helpers.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const lang of ['', 'en/'])for(const width of [1500,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const url='http://localhost:8765/'+lang;
  await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(lang+'index.html')}):r.abort());
  await page.goto(url);
  await page.evaluate(()=>{
   const p=J.defaultProject();p.lyrics='[00:00]Preview lyrics';p.durationOverride=8;
   for(const layer of ['foreground','media'])Object.assign(p[layer],{manualCuts:true,cutCount:1,cutOverrides:{0:{technique:'none'}}});
   J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();
  });
  for(const layer of ['lyrics','foreground','media']){
   await timelineAction(page,`[data-layer="${layer}"]`,'details');
   const modal=page.locator('#cutDetailsDialog');
   assert.equal(await modal.locator('[role=tab][aria-selected=true]').getAttribute('data-detail-tab'),'basic');
   for(const id of await modal.locator('[role=tab]').evaluateAll(xs=>xs.map(x=>x.dataset.detailTab))){
    await modal.locator(`[data-detail-tab="${id}"]`).click();
    assert.equal(await modal.locator('[role=tabpanel]:visible').count(),1);
    assert.equal(await modal.locator(`[data-detail-tab-panel="${id}"]`).isVisible(),true);
   }
   assert.equal(await modal.locator('.cut-details-actions button').nth(0).getAttribute('class'),'primary');
   await modal.locator('[data-detail-tab="placement"]').click();
   const sizeField=layer==='lyrics'?'area.w':'placement.w';
   await modal.locator(`[data-detail-field="${sizeField}"]`).fill('65');
   await modal.locator(`[data-detail-field="${sizeField}"]`).dispatchEvent('change');
   await modal.locator('[data-detail-tab="motion"]').click();
   const field=layer==='lyrics'?'hold':'technique';
   await modal.locator(`[data-detail-field="${field}"]`).selectOption(layer==='lyrics'?'still':'beatPulse');
   assert.equal(await modal.locator('[role=tab][aria-selected=true]').getAttribute('data-detail-tab'),'motion','tab survives form rebuild');
   await modal.locator('[data-detail-tab="mask"]').click();
   assert.equal(await modal.locator('[data-detail-section="mask"] > summary').count(),0);
   await modal.locator('[data-mask-field="enabled"]').check();
   await modal.locator('[data-mask-field="opacity"]').fill('35');
   await modal.locator('[data-detail-tab="basic"]').click();
   await modal.locator('[data-detail-tab="basic"]').press('ArrowRight');
   assert.equal(await modal.locator('[role=tab][aria-selected=true]').getAttribute('data-detail-tab'),await modal.locator('[role=tab]').nth(1).getAttribute('data-detail-tab'));
   await modal.locator('[data-detail-tab="mask"]').click();
   assert.equal(await modal.locator('[data-mask-field="opacity"]').inputValue(),'35');
   const bounds=await modal.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
   assert.ok(bounds.scroll<=bounds.width+1,'dialog does not overflow horizontally');
   await modal.locator('button[type=submit]').click();
   assert.equal(await page.evaluate(layer=>(layer==='lyrics'?J.ui.plan.cuts.find(c=>c.line===0):J.ui.plan[layer].cuts[0]).mask.opacity,layer),35);
   assert.equal(await page.evaluate(layer=>layer==='lyrics'?J.ui.project.lyricCutOptions['0:0'].details.area.w:J.ui.project[layer].cutOverrides[0].placement.w,layer),.65);
  }
  assert.deepEqual(errors,[]);console.log(lang||'ja',width,'detail tabs, editing, persistence, keyboard and mobile passed');await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
