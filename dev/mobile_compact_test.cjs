const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
 for(const lang of ['','en/'])for(const width of [320,390,430]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url='http://localhost/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',lang,'index.html'))}):r.abort());await page.goto(url);await page.waitForTimeout(250);
  async function fits(){const m=await page.evaluate(()=>{const r=document.querySelector('#view').getBoundingClientRect();return {client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,inner:innerWidth,left:r.left,right:r.right,width:r.width,height:r.height,ar:J.ui.plan.W/J.ui.plan.H}});assert.ok(m.scroll<=m.client+1,JSON.stringify(m));assert.equal(m.inner,m.client);assert.ok(m.left>=0&&m.right<=m.client,JSON.stringify(m));assert.ok(Math.abs(m.width/m.height-m.ar)<.02);}
  await fits();for(const id of ['sourceLyrics','sourceForeground','sourceMedia','modeEasy','modePro']){await page.locator('#'+id).click();await fits();}
  await page.locator('#closeSettingsDrawer').click();await page.locator('#sourceLyrics').click();await page.locator('#lyrics').fill('Mobile preview');await fits();await page.locator('#closeSourceDrawer').click();
  await page.evaluate(()=>{J.ui.plan.W=720;J.ui.plan.H=1280;window.dispatchEvent(new Event('resize'));});await page.waitForTimeout(150);await fits();assert.ok((await page.locator('#view').boundingBox()).height<=422);
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(150);await fits();
  await page.setViewportSize({width,height:844});await page.waitForTimeout(150);await fits();
  if(!lang&&width===390)await page.screenshot({path:'F:/Codex/preview-test-temp/mobile-after.png',scale:'css'});
  assert.deepEqual(errors,[]);console.log(lang||'ja',width,'phone layout passed');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
