const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/']){
const p=await b.newPage({viewport:{width:1800,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url()==='http://localhost/'?r.fulfill({contentType:'text/html',body:fs.readFileSync(lang+'index.html')}):r.abort());await p.goto('http://localhost/');
await p.evaluate(()=>{const q=J.defaultProject();q.lyrics='# comment\n[00:00]first/part\n\n{\n[00:02]group one\n[00:04]group two\n}\n[00:06]end\n'+Array.from({length:25},(_,i)=>`[00:${String(8+i*2).padStart(2,'0')}]long line ${i} `+'wrapped text '.repeat(10)).join('\n');q.durationOverride=60;q.overrides=Object.fromEntries(Array.from({length:29},(_,i)=>[i,{single:true}]));q.lyricCutOptions={'3:0':{removed:true}};J.ui.project=q;J.uiApi.syncUI();J.uiApi.replan();J.uiApi.seek(.5);});
const rows=()=>p.locator('#lyricPlaybackHighlight .is-current').evaluateAll(es=>es.map(e=>Array.from(e.parentNode.children).indexOf(e)));
await p.waitForFunction(()=>document.querySelector('#lyricPlaybackHighlight .is-current'));assert.deepEqual(await rows(),[1]);
await p.evaluate(()=>J.uiApi.seek(4.5));await p.waitForFunction(()=>document.querySelectorAll('#lyricPlaybackHighlight .is-current').length===2);assert.deepEqual(await rows(),[4,5]);
await p.locator('#lyrics').focus();await p.locator('#lyrics').evaluate(e=>{e.setSelectionRange(8,12);e.scrollTop=0;});await p.evaluate(()=>J.uiApi.seek(50.5));await p.waitForTimeout(100);assert.equal(await p.locator('#lyricPlaybackHighlight').isHidden(),true);assert.deepEqual(await p.locator('#lyrics').evaluate(e=>[e.selectionStart,e.selectionEnd,e.scrollTop]),[8,12,0]);
await p.locator('#lyrics').evaluate(e=>e.blur());await p.waitForFunction(()=>document.querySelector('#lyrics').scrollTop>0);assert.equal(await p.locator('#lyricPlaybackHighlight').isVisible(),true);assert.deepEqual(await rows(),[29]);
await p.evaluate(()=>J.uiApi.seek(6.5));await p.waitForFunction(()=>document.querySelector('#lyricPlaybackHighlight').hidden);
await p.evaluate(()=>J.uiApi.seek(4.5));await p.waitForFunction(()=>!document.querySelector('#lyricPlaybackHighlight').hidden);assert.deepEqual(await rows(),[4,5]);
for(const id of ['timeline','foregroundTimeline','mediaTimeline']){
 await p.locator('#lyrics').focus();
 const box=await p.locator('#'+id).boundingBox();
 await p.mouse.click(box.x+box.width*.45,box.y+box.height-3);
 assert.equal(await p.evaluate(()=>document.activeElement===document.getElementById('lyrics')),false,id+' releases lyric focus');
 assert.ok(await p.evaluate(()=>J.ui.t>20&&J.ui.t<35),id+' still seeks');
}
await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>J.ui.playing),true,'space controls playback after timeline click');
await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>J.ui.playing),false);
assert.deepEqual(errors,[]);console.log(lang||'ja','source rows, groups, wrapping/scroll, focus selection, blank interval passed');await p.close();
}}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
