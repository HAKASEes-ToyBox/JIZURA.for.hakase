const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
for(const lang of ['','en/'])for(const device of [{name:'iPhone Chrome',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140 Mobile Safari/604.1',platform:'iPhone',touch:5,ios:true},{name:'iPad desktop mode',ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/605.1.15',platform:'MacIntel',touch:5,ios:true},{name:'desktop Mac',ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',platform:'MacIntel',touch:0,ios:false}]){
const page=await browser.newPage({userAgent:device.ua});await page.addInitScript(d=>{Object.defineProperty(navigator,'platform',{get:()=>d.platform});Object.defineProperty(navigator,'maxTouchPoints',{get:()=>d.touch});},device);
await page.route('**/*',r=>r.request().url()==='http://localhost/'?r.fulfill({contentType:'text/html',body:fs.readFileSync(lang+'index.html')}):r.abort());await page.goto('http://localhost/');
await page.evaluate(()=>J.openEffectFavorites({project:J.ui.project,changed(){},closed(){}}));
for(const sel of ['#fileProject','#fileSettings','.favorite-file'])assert.equal(await page.locator(sel).getAttribute('accept')===null,device.ios);
await page.evaluate(()=>document.querySelector('#effectFavoritesDialog').close());
// The old public picker permits .json, and the reader detects portable bytes by header.
const bytes=Buffer.from(await page.evaluate(async()=>{const p=J.defaultProject();p.title='Compatibility import';p.lyrics='test';return [...new Uint8Array(await (await J.packProject(p)).arrayBuffer())];}));
await page.locator('#fileProject').setInputFiles({name:'compat.json',mimeType:'application/json',buffer:bytes});await page.waitForFunction(()=>J.ui.project.title==='Compatibility import'&&!J.ui.projectBusy);
console.log(lang||'ja',device.name,'filters and portable .json import passed');await page.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
