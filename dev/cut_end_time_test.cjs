// カットの終了時間: 「次カット再生まで」 (default) ends a cut at the next start; off, the cut ends at its own time,
// which may pass later cuts. Overlapping cuts stack in translucent lanes whose starts and ends stay draggable.
// 「再生位置で編集」 is a two-level menu; 無表示カット is retired (old projects migrate to end times).
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{for(const lang of ['','en/']){
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());
 await page.goto(url);await page.locator('#modePro').click();
 const setup=(extra={})=>page.evaluate(extra=>{const P=J.ui.project;P.lyrics=['夜明けの色を覚えてる','ほどけた声が遠くで鳴った','ねえまだ間に合うかな','透明なままじゃ終われない'].join('\n');
  P.timing={...P.timing,lineTimes:{0:1,1:5,2:9,3:13},cutTimes:{}};P.durationOverride=18;P.lyricCutOptions={};P.overrides={};P.fx.density=0;
  for(const [layer,id,color] of [['foreground','fg','#e33'],['media','bg','#33e']]){const c=document.createElement('canvas');c.width=400;c.height=300;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,400,300);J.mediaAssets.set(id,{element:c,type:'image'});
   P[layer]={...P[layer],items:[{id,name:id+'.png',type:'image',width:400,height:300}],manualCuts:true,cutCount:4,timing:{lineTimes:{0:1,1:5,2:9,3:13}},cutOverrides:Object.fromEntries([0,1,2,3].map(i=>[i,{itemId:id,technique:null}]))};}
  Object.assign(P,JSON.parse(JSON.stringify(extra)));J.uiApi.syncUI();J.uiApi.replan();J.uiApi.pause();J.uiApi.seek(0);},extra);
 const cuts=layer=>page.evaluate(layer=>(layer==='lyrics'?J.ui.plan.cuts.filter(c=>c.line>=0&&Number.isInteger(c.part)):J.ui.plan[layer].cuts).map(c=>({key:layer==='lyrics'?`${c.line}:${c.part}`:c.index,start:+c.start.toFixed(3),end:+c.end.toFixed(3),manual:!!c.manualEnd})),layer);
 const seek=t=>page.evaluate(t=>{J.uiApi.pause();J.uiApi.seek(t);},t);
 // Defaults: every cut runs until the next one starts.
 await setup();
 for(const layer of ['lyrics','foreground','media']){const list=await cuts(layer);assert.ok(list.every(c=>!c.manual),layer+' default');
  if(layer!=='lyrics')for(let i=0;i+1<list.length;i++)assert.equal(list[i].end,list[i+1].start,layer+' ends at the next start');}
 // Details: 「次カット再生まで」 on keeps the end field read-only; off, the end may pass the next start.
 await seek(1.2);await page.locator('.item-frame-action[data-action="details"][data-layer="foreground"]').first().click();await page.waitForTimeout(300);
 const until=page.locator('#cutDetailsDialog [data-detail-field="untilNext"]'),end=page.locator('#cutDetailsDialog [data-detail-field="endTime"]');
 assert.equal(await until.isChecked(),true);assert.equal(await end.isDisabled(),true);assert.equal(+await end.inputValue(),5);
 await until.uncheck();assert.equal(await end.isDisabled(),false);await end.fill('7.5');await end.dispatchEvent('change');
 await page.locator('#cutDetailsDialog button[type=submit]').click();await page.waitForTimeout(300);
 let fg=await cuts('foreground');assert.deepEqual([fg[0].end,fg[0].manual,fg[1].start],[7.5,true,5],'foreground overlaps the next cut');
 assert.equal(await page.evaluate(()=>J.mediaCutsAt(J.ui.plan,6,'foreground').length),2,'both foreground cuts show in the overlap');
 assert.equal(await page.evaluate(()=>J.mediaAt(J.ui.plan,6,'foreground').index),1,'the later cut is on top');
 // Lyrics: end a line's last cut after the next line starts.
 await page.evaluate(()=>{const c=J.ui.plan.cuts.filter(c=>c.line===0&&Number.isInteger(c.part)).at(-1);J.ui.project.lyricCutOptions[`0:${c.part}`]={untilNext:false,endTime:6.5};J.uiApi.replan();});
 assert.equal(await page.evaluate(()=>J.lyricCutsAt(J.ui.plan,6).filter(c=>c.line>=0).length),2,'both lyric cuts show in the overlap');
 await page.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=180;const r=new J.Renderer();for(const t of [5.5,6,7])r.frame(c.getContext('2d'),J.ui.plan,t,{scale:320/J.ui.plan.W});});
 // Timeline: overlapping cuts stack in lanes (the layer grows) and the end handle drags the end.
 const box=id=>page.locator('#'+id).boundingBox();
 assert.ok((await box('foregroundTimeline')).height>52,'foreground row grows for a second lane');
 const dragX=async(id,fromT,toT,lane,lanes)=>{const b=await box(id),D=await page.evaluate(()=>J.ui.plan.duration);
  const band=id==='timeline'?{top:b.height*.3,bottom:b.height-8}:{top:17,bottom:b.height-3},h=(band.bottom-band.top)/lanes,y=b.y+band.top+h*(lane+.5);
  await page.mouse.move(b.x+fromT/D*b.width,y);await page.mouse.down();await page.mouse.move(b.x+toT/D*b.width,y,{steps:6});await page.mouse.up();await page.waitForTimeout(200);};
 await dragX('foregroundTimeline',7.5,8.25,0,2);
 fg=await cuts('foreground');assert.ok(Math.abs(fg[0].end-8.25)<.1,'end handle dragged to '+fg[0].end);assert.equal(fg[1].start,5,'next start untouched');
 // The overlapped cut's start (lower lane) still drags.
 await dragX('foregroundTimeline',5,5.6,1,2);
 fg=await cuts('foreground');assert.ok(Math.abs(fg[1].start-5.6)<.1,'overlapped start dragged to '+fg[1].start);assert.ok(Math.abs(fg[0].end-8.25)<.1,'end kept');
 // More overlap patterns: one cut spanning several, a nested cut, a chain; starts < ends, lanes consistent.
 for(const pattern of [{0:12},{0:16,2:10},{0:6,1:10,2:14}]){
  await page.evaluate(pattern=>{const o=J.ui.project.media.cutOverrides;for(const i of [0,1,2,3]){delete o[i].untilNext;delete o[i].endTime;}for(const [i,e] of Object.entries(pattern))Object.assign(o[i],{untilNext:false,endTime:e});J.uiApi.replan();},pattern);
  const bg=await cuts('media');for(const [i,e] of Object.entries(pattern))assert.equal(bg[i].end,e,'pattern end');assert.ok(bg.every(c=>c.end>c.start),'valid cuts');
  const overlap=await page.evaluate(()=>Math.max(...[1,3,5,7,9,11,13,15,17].map(t=>J.mediaCutsAt(J.ui.plan,t,'media').length)));
  const lanes=Math.round(((await box('mediaTimeline')).height-52)/24)+1;assert.equal(lanes,overlap,'lanes follow the deepest overlap');
  await page.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=180;const r=new J.Renderer();for(const t of [2,6,10,14])r.frame(c.getContext('2d'),J.ui.plan,t,{scale:320/J.ui.plan.W});});
 }
 // Shortening leaves a gap with nothing shown for that layer.
 await page.evaluate(()=>{const o=J.ui.project.media.cutOverrides;for(const i of [0,1,2,3]){delete o[i].untilNext;delete o[i].endTime;}Object.assign(o[1],{untilNext:false,endTime:6});J.uiApi.replan();});
 assert.equal(await page.evaluate(()=>J.mediaAt(J.ui.plan,7,'media')),null,'gap after an early end');
 // 再生位置で編集: two levels, greyed-out buttons, ここまで再生 / 次カットまで再生.
 await setup();await seek(3);
 assert.equal(await page.locator('.playhead-secondary').isHidden(),true);
 await page.locator('[data-playhead-menu="split"]').click();
 assert.equal(await page.locator('#splitForegroundCut').isVisible(),true);assert.equal(await page.locator('#insertLyricAtPlayhead').isVisible(),false,'only the split layers');
 await page.locator('[data-playhead-menu="endHere"]').click();
 assert.equal(await page.locator('#endLyricHere').isDisabled(),false);
 await page.locator('#endForegroundHere').click();
 fg=await cuts('foreground');assert.deepEqual([fg[0].end,fg[0].manual],[3,true],'ここまで再生 ends the cut at the playhead');
 assert.equal(await page.locator('.playhead-secondary').isHidden(),true,'menu closes after acting');
 await seek(4);await page.locator('[data-playhead-menu="endHere"]').click();await page.locator('#endForegroundHere').click();
 fg=await cuts('foreground');assert.equal(fg[0].end,4,'ここまで再生 in a gap extends the previous cut');
 await page.locator('[data-playhead-menu="untilNext"]').click();
 assert.equal(await page.locator('#untilNextLyric').isDisabled(),true,'nothing to restore for lyrics');
 await page.locator('#untilNextForeground').click();
 fg=await cuts('foreground');assert.deepEqual([fg[0].end,fg[0].manual],[5,false],'次カットまで再生 restores the default');
 assert.equal(await page.locator('[data-playhead-menu="untilNext"]').isDisabled(),true,'greyed out when nothing applies');
 assert.equal((await page.locator('#relayoutAtPlayhead').textContent()).trim(),lang?'Shuffle layout':'配置をシャッフル');
 assert.equal((await page.locator('#playheadMenuLabel').textContent()).trim(),lang?'Edit at playhead:':'再生位置で編集：');
 // 1シーン: the group's cuts end with its last line.
 await setup({lyrics:['夜明けの色を覚えてる','{','ほどけた声が','遠くで鳴った','}','ねえまだ間に合うかな'].join('\n')});
 const group=await page.evaluate(()=>J.ui.plan.cuts.filter(c=>c.group!=null&&Number.isInteger(c.part)).map(c=>c.end));
 assert.ok(group.length>=2&&group.every(e=>e===group.at(-1)),'group cuts end together');
 // 無表示カット: retired; old projects keep the gap as the lyric's end time.
 assert.equal(await page.locator('#insertBlankAtPlayhead').count(),0);
 assert.equal(await page.locator('#lineList .media-cut-insert').count(),0,'no blank-cut buttons in the line list');
 const migrated=await page.evaluate(()=>{const p=J.defaultProject();p.lyrics='夜明けの色を覚えてる\nほどけた声が遠くで鳴った';p.timing.lineTimes={0:1,1:6};p.lyricBlankCuts=[{id:'b',start:3.5,beforeLine:1,untilNextCut:true}];
  J.uiApi.replaceProject(p,null,null,new Map());return {blank:J.ui.project.lyricBlankCuts,ends:J.ui.plan.cuts.filter(c=>c.manualEnd).map(c=>c.end),shown:J.lyricCutsAt(J.ui.plan,4.5).filter(c=>c.line>=0).length};});
 assert.equal(migrated.blank,undefined);assert.deepEqual(migrated.ends,[3.5]);assert.equal(migrated.shown,0,'the old blank span stays empty');
 assert.deepEqual(errors,[]);console.log(lang||'ja','cut end time passed');await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
