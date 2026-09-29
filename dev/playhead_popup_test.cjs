const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/'])for(const width of [1400,390]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://localhost:8765/'+lang;
 await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',lang,'index.html'))}):r.abort());await page.goto(url);
 await page.evaluate(()=>{const p=J.ui.project;p.lyrics='Test lyrics';p.durationOverride=8;p.foreground.manualCuts=true;p.foreground.cutCount=1;p.foreground.timing.lineTimes={0:0};J.uiApi.syncUI();J.uiApi.replan();J.uiApi.seek(1);});
 const trigger=page.locator('[data-playhead-menu="insert"]'),popup=page.locator('#playheadPopup');await trigger.scrollIntoViewIfNeeded();const before=await page.locator('#timeline').boundingBox();await trigger.click();await popup.waitFor({state:'visible'});
 assert.equal(await popup.evaluate(e=>getComputedStyle(e).position),'fixed');assert.equal(await popup.locator('button:visible').count(),3);assert.equal(await popup.locator('button:visible svg').count(),3);
 const after=await page.locator('#timeline').boundingBox();assert.equal(before.y,after.y);const box=await popup.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.y+box.height<=901);
 await page.mouse.click(1,1);assert.equal(await popup.isVisible(),false);await trigger.click();await page.keyboard.press('Escape');assert.equal(await popup.isVisible(),false);
 await trigger.click();await page.locator('[data-playhead-menu="split"]').click();assert.equal(await popup.locator('button:visible').count(),2);await page.locator('#splitForegroundCut').click();assert.equal(await popup.isVisible(),false);assert.equal(await page.locator('dialog[open]').count(),1);await page.keyboard.press('Escape');
 await trigger.click();await page.locator('#insertLyricAtPlayhead').click();assert.equal(await popup.isVisible(),false);assert.equal(await page.locator('dialog[open]').count(),1);await page.keyboard.press('Escape');
 await page.locator('[data-playhead-menu="endHere"]').click();await page.locator('#endForegroundHere').click();assert.equal(await popup.isVisible(),false);assert.equal(await page.evaluate(()=>J.ui.project.foreground.cutOverrides[0].endTime),1);
 assert.deepEqual(errors,[]);console.log(lang||'ja',width,'playhead popup passed');await page.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

