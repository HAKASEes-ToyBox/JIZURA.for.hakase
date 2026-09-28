const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/'])for(const width of [1400,390]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://localhost:8765/'+lang;
 await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',lang,'index.html'))}):r.abort());await page.goto(url);
 const drawer=page.locator('#settingsDrawer'),easy=page.locator('#modeEasy'),pro=page.locator('#modePro');assert.equal(await drawer.isVisible(),false);
 assert.ok((await easy.boundingBox()).y<(await pro.boundingBox()).y);assert.equal(await page.locator('header #modeEasy').count(),0);
 const stage=await page.locator('.col-stage').boundingBox();if(width>1180)assert.ok(stage.width>900);
 await easy.click();assert.equal(await drawer.isVisible(),true);assert.equal(await page.locator('#easyPanel').isVisible(),true);assert.equal(await easy.getAttribute('aria-expanded'),'true');
 const box=await drawer.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width-40);assert.equal(await drawer.evaluate(e=>getComputedStyle(e).overflowY),'auto');
 await pro.click();assert.equal(await drawer.isVisible(),true);assert.equal(await page.locator('#easyPanel').isVisible(),false);assert.equal(await pro.getAttribute('aria-expanded'),'true');
 if(!lang&&width===1400&&process.env.JIZURA_DRAWER_SCREENSHOT)await page.screenshot({path:process.env.JIZURA_DRAWER_SCREENSHOT});
 await pro.click();assert.equal(await drawer.isVisible(),false);await easy.click();await page.locator('#closeSettingsDrawer').click();assert.equal(await drawer.isVisible(),false);
 await pro.click();await page.keyboard.press('Escape');assert.equal(await drawer.isVisible(),false);await page.reload();assert.equal(await drawer.isVisible(),false);
 assert.deepEqual(errors,[]);console.log(lang||'ja',width,'drawer passed');await page.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
