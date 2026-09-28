const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/']){const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());await page.goto(url);await page.locator('#modePro').click();
const button=page.locator('#relayoutAtPlayhead');
// Placed last in the "At playhead" groups.
assert.equal(await page.locator('.playhead-primary button').last().getAttribute('id'),'relayoutAtPlayhead');
assert.equal((await button.textContent()).trim(),lang?'Shuffle layout':'配置をシャッフル');
await page.evaluate(()=>{const p=J.ui.project;p.lyrics='[00:00]夜明けの色を覚えてる\n[00:04]ほどけた声が遠くで鳴った\n[00:08]ねえまだ間に合うかな';p.durationOverride=12;p.lyricEffects={...p.lyricEffects,autoPlacement:true};
 for(const [layer,id,color] of [['foreground','fg','#e33'],['media','bg','#33e']]){const c=document.createElement('canvas');c.width=400;c.height=300;c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,400,300);J.mediaAssets.set(id,{element:c,type:'image'});
  p[layer]={...p[layer],items:[{id,name:id+'.png',type:'image',width:400,height:300}],manualCuts:true,cutCount:3,timing:{lineTimes:{0:0,1:4,2:8}},cutOverrides:{0:{itemId:id,technique:null},1:{itemId:id,technique:null},2:{itemId:id,technique:null}}};}
 J.uiApi.syncUI();J.uiApi.replan();J.uiApi.seek(5);});
const snap=()=>page.evaluate(()=>{const P=J.ui.plan,lyric=J.lyricCutsAt(P,5).find(c=>c.line>=0);return {
  lyricArea:JSON.stringify(lyric.area),lyricLayout:lyric.layout+'/'+lyric.enter+'/'+lyric.exit,
  fg:JSON.stringify(P.foreground.cuts[1].placement),fgFx:[P.foreground.cuts[1].technique,P.foreground.cuts[1].entrance,P.foreground.cuts[1].departure].join('/'),fgComp:P.foreground.cuts[1].composition,
  bg:JSON.stringify(P.media.cuts[1].placement),bgFx:P.media.cuts[1].technique,
  others:JSON.stringify([P.foreground.cuts[0].placement,P.foreground.cuts[2].placement,P.media.cuts[0].placement,J.lyricCutsAt(P,1).map(c=>c.area)])};});
assert.equal(await button.isEnabled(),true);
const before=await snap();
await button.click();
const after=await snap();
assert.notEqual(after.lyricArea,before.lyricArea,'lyric area re-laid out');
assert.notEqual(after.fg,before.fg,'foreground re-laid out');assert.notEqual(after.bg,before.bg,'background re-laid out');
assert.equal(after.lyricLayout,before.lyricLayout,'lyric effects kept');assert.equal(after.fgFx,before.fgFx,'foreground effects kept');assert.equal(after.bgFx,before.bgFx,'background technique kept');
assert.equal(after.others,before.others,'cuts away from the playhead unchanged');
// Repeated presses keep varying the layout.
const layouts=new Set([before.fg,after.fg]);for(let i=0;i<5;i++){await button.click();layouts.add((await snap()).fg);}assert.ok(layouts.size>=4,'variation '+layouts.size);
// Undo restores the previous layout.
const beforeUndo=await snap();await page.locator('#btnUndo').click();assert.notEqual((await snap()).fg,beforeUndo.fg);
// Manual placements become automatic again; locked cuts stay put.
await page.evaluate(()=>{const o=J.ui.project.foreground.cutOverrides[1];o.placement={cx:.2,cy:.2,w:.2,h:.15,lockAspect:true,angle:0};J.uiApi.replan();});
await button.click();assert.equal(await page.evaluate(()=>J.ui.plan.foreground.cuts[1].placementMode),'auto');
await page.evaluate(()=>{const c=J.ui.plan.foreground.cuts[1];Object.assign(J.ui.project.foreground.cutOverrides[1],{lock:true,lockedSeed:c.seed,lockedTechnique:c.technique,lockedPlacement:c.placement,lockedPlacementMode:'auto'});J.uiApi.replan();});
const locked=(await snap()).fg;await button.click();assert.equal((await snap()).fg,locked,'locked foreground unchanged');
// A lyric manual area gives way too.
await page.evaluate(()=>{const cut=J.lyricCutsAt(J.ui.plan,5).find(c=>c.line>=0);(J.ui.project.lyricCutOptions[cut.line+':'+cut.part] ||= {}).details={area:{x:.1,y:.1,w:.3,h:.3,angle:0,lockAspect:true}};J.uiApi.replan();});
assert.equal(await page.evaluate(()=>J.lyricCutsAt(J.ui.plan,5).find(c=>c.line>=0).areaMode),'manual');
await button.click();assert.equal(await page.evaluate(()=>J.lyricCutsAt(J.ui.plan,5).find(c=>c.line>=0).areaMode),'auto');
// Nothing to re-lay out when every cut at the playhead is locked.
await page.evaluate(()=>{const P=J.ui.plan;for(const layer of ['foreground','media']){const c=J.mediaAt(P,5,layer);Object.assign(J.ui.project[layer].cutOverrides[c.index],{lock:true,lockedSeed:c.seed,lockedTechnique:c.technique,lockedPlacement:c.placement,lockedPlacementMode:'auto'});}
 for(const c of J.lyricCutsAt(P,5).filter(c=>c.line>=0))J.ui.project.overrides[c.line]={...J.ui.project.overrides[c.line],lock:true};J.uiApi.replan();J.uiApi.seek(5);});
assert.equal(await button.isDisabled(),true);
assert.deepEqual(errors,[]);console.log(lang||'ja','relayout passed');await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
