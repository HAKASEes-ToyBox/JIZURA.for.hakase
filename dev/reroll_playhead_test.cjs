const {chromium}=require('playwright');
const assert=require('node:assert/strict'), fs=require('node:fs');
const {proMode,openSource,timelineAction}=require('./ui_helpers.cjs');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try { for(const locale of ['', 'en/']) {
    const page=await browser.newPage({viewport:{width:1500,height:1100}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const url='http://127.0.0.1:8765/'+locale;
    await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(locale+'index.html')}):r.abort());
    await page.goto(url);await proMode(page);
    await page.evaluate(()=>{
      const p=J.defaultProject();p.lyrics='[00:00]First line\n[00:04]Second line';p.durationOverride=8;
      for(const layer of ['foreground','media'])Object.assign(p[layer],{manualCuts:true,cutCount:2,timing:{lineTimes:{0:0,1:4}},cutOverrides:{0:{technique:'pushIn'},1:{technique:'beatPulse'}}});
      J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();
    });
    for(const layer of ['lyrics','foreground','media']) {
      for(const action of ['dice','disableReroll']) {
        await page.evaluate(()=>J.uiApi.seek(6.25));
        const seed=await page.evaluate(layer=>(layer==='lyrics'?J.ui.plan.lines:J.ui.plan[layer].cuts)[0].seed,layer);
        await timelineAction(page,`[data-layer="${layer}"][data-index="0"]`,action);
        assert.equal(await page.evaluate(()=>J.ui.t),6.25,`${layer} ${action} preserves playhead outside target`);
        assert.notEqual(await page.evaluate(layer=>(layer==='lyrics'?J.ui.plan.lines:J.ui.plan[layer].cuts)[0].seed,layer),seed);
      }
      await openSource(page,layer);
      await page.evaluate(()=>J.uiApi.seek(2.25));
      await page.locator(layer==='lyrics'?'#lineList .dice':'#mediaLineList .dice').first().click();
      assert.equal(await page.evaluate(()=>J.ui.t),2.25,`${layer} list reroll preserves playhead inside target`);
    }
    assert.deepEqual(errors,[]);console.log(locale||'ja','reroll and disable-reroll preserve playhead across all layers');await page.close();
  }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
