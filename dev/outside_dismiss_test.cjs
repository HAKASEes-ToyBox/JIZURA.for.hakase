const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/']){
const p=await b.newPage({viewport:{width:1500,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url()==='http://localhost/'?r.fulfill({contentType:'text/html',body:fs.readFileSync(lang+'index.html')}):r.abort());await p.goto('http://localhost/');
for(const id of ['termsDlg','newProjectDlg','themesDlg','exportDlg','filenameDlg']){
 await p.evaluate(id=>document.getElementById(id).showModal(),id);const r=await p.locator('#'+id).boundingBox();await p.mouse.click(r.x+2,r.y+2);assert.equal(await p.locator('#'+id).evaluate(e=>e.open),true,id+' padding');
 await p.mouse.move(r.x+20,r.y+20);await p.mouse.down();await p.mouse.move(1,999);await p.mouse.up();assert.equal(await p.locator('#'+id).evaluate(e=>e.open),true,id+' drag');
 await p.mouse.click(1,999);assert.equal(await p.locator('#'+id).evaluate(e=>e.open),false,id+' outside');
}
await p.evaluate(()=>J.openEffectFavorites({project:J.ui.project,changed(){},closed(){}}));await p.mouse.click(1,999);await p.waitForFunction(()=>!document.querySelector('#effectFavoritesDialog'));
// A dynamic child only dismisses itself; existing cancel guards remain effective.
await p.evaluate(()=>{document.querySelector('#termsDlg').showModal();const d=document.createElement('dialog');d.id='dismiss-child';d.textContent='child';document.body.append(d);d.showModal();d.addEventListener('cancel',e=>{if(d.dataset.busy)e.preventDefault()});d.dataset.busy='1';});
await p.mouse.click(1,999);assert.equal(await p.locator('#dismiss-child').evaluate(e=>e.open),true);await p.evaluate(()=>delete document.querySelector('#dismiss-child').dataset.busy);await p.mouse.click(1,999);assert.equal(await p.locator('#dismiss-child').evaluate(e=>e.open),false);assert.equal(await p.locator('#termsDlg').evaluate(e=>e.open),true);await p.mouse.click(1,999);
await p.locator('#modePro').click();assert.equal(await p.locator('#settingsDrawer').isVisible(),true);await p.locator('#settingsDrawerTitle').click();assert.equal(await p.locator('#settingsDrawer').isVisible(),true);await p.locator('#timeNow').click();assert.equal(await p.locator('#settingsDrawer').isVisible(),false);
await p.setViewportSize({width:390,height:844});await p.waitForTimeout(150);await p.locator('#sourceLyrics').click();assert.equal(await p.locator('#lyrics').isVisible(),true);await p.locator('#sourceDrawerTitle').click();assert.equal(await p.locator('#lyrics').isVisible(),true);await p.mouse.click(385,830);assert.equal(await p.locator('#lyrics').isVisible(),false);
assert.deepEqual(errors,[]);console.log(lang||'ja','all static dialogs, dynamic/nested dialogs, cancel guards, drag guard, right/left panels passed');await p.close();
}}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
