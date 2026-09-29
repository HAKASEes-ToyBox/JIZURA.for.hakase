const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/'])for(const width of [1400,390]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',lang,'index.html'))}):r.abort());await page.goto(url);
 await page.evaluate(()=>{const p=J.ui.project;p.lyrics='First/line\nSecond line';p.durationOverride=8;p.foreground.manualCuts=true;p.foreground.cutCount=2;p.foreground.timing.lineTimes={0:0,1:4};J.uiApi.syncUI();J.uiApi.replan();});
 const expected=await page.evaluate(()=>J.ui.plan.cuts.filter(c=>c.line>=0&&Number.isInteger(c.part)).length+J.ui.plan.foreground.cuts.length+J.ui.plan.media.cuts.length);
 assert.equal(await page.locator('.timeline-action').count(),expected);assert.equal(await page.locator('.timeline-action:not([data-action="menu"])').count(),0);
 const trigger=page.locator('.timeline-action[data-layer="lyrics"]').first();await trigger.click();
 const menu=page.locator('#timelineCutMenu');await menu.waitFor();assert.equal(await menu.locator('button').count(),9);assert.equal(await menu.locator('button>svg').count(),9);
 const box=await menu.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=901);
 await menu.locator('[data-action="frontmost"]').click();assert.equal(await menu.count(),0);assert.equal(await page.evaluate(()=>J.ui.plan.cuts.find(c=>c.line===0&&c.part===0).frontmost),true);
 await trigger.click();assert.equal(await menu.locator('[data-action="frontmost"]').getAttribute('aria-checked'),'true');await page.keyboard.press('Escape');assert.equal(await menu.count(),0);
 await trigger.click();await page.mouse.click(1,1);assert.equal(await menu.count(),0);
 await trigger.focus();await page.keyboard.press('Enter');await menu.waitFor();await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'disableReroll');await page.keyboard.press('Escape');
 const media=page.locator('.timeline-action[data-layer="foreground"]').first();await media.click();assert.equal(await menu.locator('[data-action="frontmost"]').count(),0);await menu.locator('[data-action="remove"]').click();assert.equal(await page.evaluate(()=>J.ui.plan.foreground.cuts.length),1);
 assert.deepEqual(errors,[]);console.log(lang||'ja',width,'passed');await page.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

