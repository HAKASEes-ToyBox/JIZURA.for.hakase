const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const locale of ['','en/']){
const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://127.0.0.1:8765/'+locale;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',locale,'index.html'))}):r.abort());await page.goto(url);await page.locator('#modePro').click();
const en=!!locale,sliders=page.locator('#effectPreviewDialog [data-preview-setting]'),settings=page.locator('#effectPreviewDialog .effect-preview-settings');
// Lyric previews have no media sliders.
await page.evaluate(()=>J.openEffectPreview('layout','center'));await page.waitForTimeout(300);assert.equal(await settings.isHidden(),true);
for(const layer of ['foreground','media']){
 // Sliders start from the layer's Details values; the project is never touched.
 await page.evaluate(layer=>{J.ui.project[layer].effects={...J.mediaEffectSettings(J.ui.project,layer),motion:.6,treatment:.35,duration:.8};},layer);
 const before=await page.evaluate(()=>JSON.stringify(J.ui.project));
 await page.evaluate(layer=>J.openEffectPreview('media','vignette',layer),layer);await page.waitForFunction(()=>J.mediaAssets.has('__jizura_effect_preview__'));
 assert.equal(await settings.isVisible(),true);assert.equal(await sliders.count(),3);
 assert.deepEqual(await sliders.evaluateAll(els=>els.map(e=>[e.dataset.previewSetting,+e.value])),[['motion',.6],['treatment',.35],['duration',.8]]);
 assert.deepEqual((await settings.locator('.slider span').allTextContents()),en?['Motion intensity','Treatment intensity','Entrance / exit (s)']:['動きの強さ','加工の強さ','登場・退場時間']);
 for(const [key,value] of [['motion','1.8'],['treatment','0'],['duration','1.5']]){await sliders.and(page.locator(`[data-preview-setting="${key}"]`)).fill(value);}
 assert.deepEqual(await settings.locator('output').allTextContents(),['1.8','0','1.5']);
 assert.equal(await page.evaluate(()=>JSON.stringify(J.ui.project)),before);
 await page.locator('.effect-preview-close').click();await page.waitForFunction(()=>!J.mediaAssets.has('__jizura_effect_preview__'));
}
// The preview plan reflects the values: per-cut settings, longer cuts for long phases, and visible differences.
const report=await page.evaluate(()=>{const failures=[],check=(ok,m)=>{if(!ok)failures.push(m)};
 const img=document.createElement('canvas');img.width=320;img.height=180;const g=img.getContext('2d');g.fillStyle='#39c';g.fillRect(40,30,240,120);J.mediaAssets.set('__pv__',{element:img,type:'image'});
 const out=document.createElement('canvas');out.width=320;out.height=180;const ctx=out.getContext('2d');
 const frame=(key,layer,settings,t)=>{const plan=J.makeEffectPreviewPlan('media',key,layer,'__pv__',settings);ctx.clearRect(0,0,320,180);new J.Renderer().frame(ctx,plan,t,{scale:320/plan.W,noHud:true});return out.toDataURL();};
 for(const layer of ['foreground','media']){
  const plan=J.makeEffectPreviewPlan('media','kenBurns',layer,'__pv__',{motion:1.7,treatment:.4,duration:1.5});
  check(plan[layer].cuts.every(c=>c.effectSettings.motion===1.7&&c.effectSettings.treatment===.4&&c.effectSettings.duration===1.5),layer+' settings');
  check(plan[layer].cuts[1].start===5&&plan[layer].cuts[1].end===10,layer+' long cuts '+plan[layer].cuts.map(c=>c.end));
  check(J.makeEffectPreviewPlan('media','kenBurns',layer,'__pv__',{motion:1,treatment:1,duration:.45})[layer].cuts[1].start===3,layer+' default length');
  check(frame('kenBurns',layer,{motion:0,treatment:1,duration:.45},2)!==frame('kenBurns',layer,{motion:2,treatment:1,duration:.45},2),layer+' motion');
  check(frame('vignette',layer,{motion:1,treatment:0,duration:.45},1.5)!==frame('vignette',layer,{motion:1,treatment:1,duration:.45},1.5),layer+' treatment');
  check(frame('enter_fade',layer,{motion:1,treatment:1,duration:.1},.3)!==frame('enter_fade',layer,{motion:1,treatment:1,duration:1.5},.3),layer+' duration');
 }
 J.mediaAssets.delete('__pv__');return failures;});
assert.deepEqual(report,[]);assert.deepEqual(errors,[]);console.log(locale||'ja','ok');await page.close();}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
