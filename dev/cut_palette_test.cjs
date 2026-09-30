const {chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['', 'en/']){const p=await b.newPage({viewport:{width:1500,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(lang+'index.html')}));await p.goto('http://localhost/');
for(const custom of ['plain','palette','global']){
 await p.evaluate(custom=>{const q=J.defaultProject();q.lyrics='[00:00]Preview';q.title='';q.style='crimson';q.durationOverride=6;q.fx={...q.fx,texture:0,glitch:0,chroma:0,flash:false,hud:'off'};q.overrides={0:{single:true,layout:'center',enter:'cut',hold:'still',exit:'cut',cam:'none',bg:'none',treat:'none'}};if(custom==='global')q.colors={enabled:true,allSchemes:true,bg:'#0C1317',fg:'#F1F3F4',sub:'#95999C',dim:'#2c3236',accentOn:true,accent:'#009DFF',accent2:'#F66C15'};if(custom==='palette')q.lyricCutOptions={'0:0':{details:{palette:{...J.STYLES.crimson.schemes[0],fg:'#00ff00'}}}};J.ui.project=q;J.uiApi.syncUI();J.uiApi.replan();},custom);
 await p.locator('#lineList .cut-details-open').first().click();await p.locator('[data-detail-tab="style"]').click();
 const hashes=[];
 for(const value of ['0','1','2']){
  await p.locator('[data-detail-field="scheme"]').click();await p.locator('.detail-search-option[data-value="'+value+'"]').click();
  const state=await p.evaluate(()=>{const d=document.querySelector('#cutDetailsDialog'),plan=d.cutPreview.plan,c=d.cutPreview.cut;const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const x=canvas.getContext('2d');new J.Renderer().frame(x,plan,(c.start+c.end)/2,{scale:320/plan.W,noHud:true,noPost:true,noMedia:true,noForeground:true});return {scheme:c.scheme,palette:c.palette,expected:J.STYLES.crimson.schemes[c.scheme],image:canvas.toDataURL()};});
  assert.equal(state.scheme,Number(value));assert.deepEqual(state.palette,state.expected);hashes.push(state.image);
 }
 assert.equal(new Set(hashes).size,3,'each scheme changes rendered pixels');
 await p.locator('#cutDetailsDialog button[type=submit]').click();assert.equal(await p.evaluate(()=>J.ui.plan.cuts[0].scheme),2);assert.deepEqual(await p.evaluate(()=>J.ui.plan.cuts[0].palette),await p.evaluate(()=>J.STYLES.crimson.schemes[2]));
}
assert.deepEqual(errors,[]);console.log(lang||'ja','scheme selection, pixel changes and saved palette passed with and without custom colors');await p.close();}}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
