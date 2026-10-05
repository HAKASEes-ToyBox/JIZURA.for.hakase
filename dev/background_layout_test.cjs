// Dynamic background layouts (詳細 → 背景 → 背景をダイナミックに配置): automatic backgrounds may be masked into
// windows (circle, half, band…) that the source fills; lyrics and the foreground compose around them.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {proMode,timelineAction}=require('./ui_helpers.cjs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const locale of ['', 'en/']){
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const url='http://127.0.0.1:8765/'+locale;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',locale,'index.html'))}):r.abort());await page.goto(url);
await page.evaluate(()=>{for(const [id,color] of [['bg','#335'],['fg','#e33'],['bg2','#583']]){const c=document.createElement('canvas');c.width=400;c.height=300;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,400,300);g.fillStyle='#fc6';g.fillRect(150,100,100,100);J.mediaAssets.set(id,{element:c,type:'image'});}});
// ---- the setting: on by default, in the background tab only, off without automatic placement
await proMode(page);
assert.equal(await page.evaluate(()=>J.mediaEffectSettings(J.ui.project,'media').dynamicBackground),true);
await page.locator('#settingsDrawer').waitFor({state:'hidden'});
await page.locator('#modePro').click();await page.locator('[data-tab="mediaFx"]').click();
const row=page.locator('#mediaEffectsPanel [data-media-setting="dynamicBackground"]');
assert.equal(await row.isChecked(),true);assert.equal(await row.isEnabled(),true);
assert.match(await row.locator('xpath=..').innerText(),locale?/Dynamic background framing/:/背景をダイナミックに配置/);
assert.equal(await page.locator('#foregroundEffectsPanel [data-media-setting="dynamicBackground"]').count(),0);
await row.uncheck();assert.equal(await page.evaluate(()=>J.mediaEffectSettings(J.ui.project,'media').dynamicBackground),false);
await row.check();
await page.locator('#mediaEffectsPanel [data-media-setting="autoPlacement"]').uncheck();
assert.equal(await page.locator('#mediaEffectsPanel [data-media-setting="dynamicBackground"]').isDisabled(),true);
await page.locator('#mediaEffectsPanel [data-media-setting="autoPlacement"]').check();
await page.locator('#closeSettingsDrawer').click();

const result=await page.evaluate(()=>{
 const failures=[],check=(ok,m)=>{if(!ok)failures.push(m)};
 const sizes={landscape:'16:9',portrait:'9:16',square:'1:1'};
 const inside=(r,b,tol=1e-6)=>r.x<=b.x+tol&&r.y<=b.y+tol&&r.x+r.w>=b.x+b.w-tol&&r.y+r.h>=b.y+b.h-tol;
 const setup=(seed,aspect,layer='media',extra={})=>{const p=J.defaultProject();p.seed=seed;p.aspect=aspect;p.lyrics='[00:00]夜明けの色を覚えてる\n[00:04]ほどけた声が遠くで鳴った\n[00:08]ねえまだ間に合うかな';p.durationOverride=12;
  p.media={...p.media,items:[{id:'bg',name:'bg.png',type:'image',width:400,height:300}],manualCuts:true,cutCount:3,timing:{lineTimes:{0:0,1:4,2:8}},cutOverrides:Object.fromEntries([0,1,2].map(i=>[i,{itemId:'bg',technique:'pushIn'}]))};
  if(layer==='both')p.foreground={...p.foreground,items:[{id:'fg',name:'fg.png',type:'image',width:400,height:300}],manualCuts:true,cutCount:3,timing:{lineTimes:{0:0,1:4,2:8}},cutOverrides:Object.fromEntries([0,1,2].map(i=>[i,{itemId:'fg',technique:'pushIn'}]))};
  Object.assign(p,extra);return p;};
 const plan=(p)=>{const pl=J.plan(p);pl.media=J.planMedia(p,pl,null,'media');pl.foreground=J.planMedia(p,pl,null,'foreground');return pl;};
 // ---- every layout on every stage shape: a valid window filled by the source, valid scene data
 const real=J.backgroundLayoutPool,ids=J.BACKGROUND_LAYOUTS.map(l=>l.id);
 check(ids.length>=26,'layouts '+ids.length);
 for(const [name,aspect] of Object.entries(sizes))for(const id of ids)for(const seed of [1,2,3]){
  const def=J.BACKGROUND_LAYOUTS.find(l=>l.id===id);J.backgroundLayoutPool=()=>[{...def,weight:1e7}];
  const p=setup(seed,aspect),pl=plan(p),W=pl.W,H=pl.H,cut=pl.media.cuts.find(c=>c.bgLayout?.id===id);
  if(!cut){check(false,'layout not picked '+id+' '+name);continue;}
  const tag=id+' '+name+' '+seed,m=cut.mask;
  check(m&&m.enabled&&m.target==='cut'&&m.shapes.length>=1,'mask '+tag);
  check(cut.bgLayout.sig===JSON.stringify(m),'signature '+tag);
  const r=J.mediaPlacementRect(cut.placement,400,300,W,H);
  check(Math.abs(r.w*W/(r.h*H)-400/300)<1e-8,'aspect '+tag);
  const bb=J.maskBounds(m.shapes,W/H),stage={x:0,y:0,w:1,h:1},win={x:Math.max(0,bb.x),y:Math.max(0,bb.y),w:Math.min(1,bb.x+bb.w)-Math.max(0,bb.x),h:Math.min(1,bb.y+bb.h)-Math.max(0,bb.y)};
  check(inside(r,m.invert?stage:win),'source covers the window '+tag+' '+JSON.stringify(r)+JSON.stringify(win));
  for(const box of [...cut.bgLayout.obstacles,cut.bgLayout.zone].filter(Boolean))check(box.x>=-1e-6&&box.y>=-1e-6&&box.x+box.w<=1+1e-6&&box.y+box.h<=1+1e-6&&box.w>0&&box.h>0,'scene box in the stage '+tag+JSON.stringify(box));
  check(win.w>=.05&&win.h>=.05,'window size '+tag);
  if(cut.bgLayout.comps.length)check(cut.bgLayout.comps.every(c=>c.zone&&c.fg.box.w>0&&c.fg.box.h>0),'comps '+tag);
  // the window keeps its pixel proportions on the stage: a "disc" stays round
  if(['orb','orbSide','emblem','duo','trio','pair','porthole'].includes(id)){const s=m.shapes.find(s=>s.type==='ellipse');if(s)check(Math.abs(s.w*W-s.h*H)<1,'round '+tag);}
 }
 J.backgroundLayoutPool=real;
 // ---- the lottery: layouts are a real share of automatic backgrounds, plain framings stay
 let layouts=0,total=0;const used=new Set(),plain=new Set();
 for(let seed=1;seed<=40;seed++){const cuts=plan(setup(seed,'16:9')).media.cuts;for(const c of cuts){total++;if(c.bgLayout){layouts++;used.add(c.bgLayout.id);}else plain.add(c.composition);}}
 check(layouts/total>.25&&layouts/total<.7,'layout share '+layouts+'/'+total);check(used.size>=14,'layout variety '+used.size);check(plain.size>=6,'plain framings remain '+plain.size);
 // ---- off / no effect / manual placement / cropped edges / mask techniques / short cuts: no layout
 const none=(p,label,only=()=>true)=>{for(const seed of [1,2,3,4,5,6,7,8]){p.seed=seed;const cuts=plan(p).media.cuts.filter(only);check(cuts.length&&cuts.every(c=>!c.bgLayout&&!c.mask),label+' '+seed);}};
 {const p=setup(1,'16:9');p.media.effects={...J.mediaEffectSettings(p,'media'),dynamicBackground:false};none(p,'dynamic off');}
 {const p=setup(1,'16:9');p.media.effects={...J.mediaEffectSettings(p,'media'),autoPlacement:false};none(p,'auto placement off');}
 {const p=setup(1,'16:9');for(const i of [0,1,2])p.media.cutOverrides[i].technique='none';none(p,'no effect');}
 {const p=setup(1,'16:9');for(const i of [0,1,2])p.media.cutOverrides[i].placement={cx:.5,cy:.5,w:.6,lockAspect:true,angle:0};none(p,'manual placement');}
 {const p=setup(1,'16:9');p.media.items[0].croppedEdges={left:true};none(p,'cropped edges');}
 {const p=setup(1,'16:9');for(const i of [0,1,2])p.media.cutOverrides[i].technique='maskRings';none(p,'mask techniques');}
 {const p=setup(1,'16:9');p.media.timing={lineTimes:{0:0,1:1,2:2}};none(p,'short cuts',c=>c.end-c.start<1.5);}
 // ---- lyrics keep clear of the window and sit in its zone
 for(const id of ['orbSide','halfSplit','pair','orb','panel','capStrip']){
  const def=J.BACKGROUND_LAYOUTS.find(l=>l.id===id);J.backgroundLayoutPool=()=>[{...def,weight:1e7}];
  let tested=0,clear=0,inZone=0;
  for(let seed=1;seed<=6;seed++){const pl=plan(setup(seed,'16:9')),cut=pl.media.cuts[0],ob=cut.bgLayout?.obstacles||[],zone=cut.bgLayout?.zone;
   for(const c of pl.cuts.filter(c=>c.line>=0&&c.area&&c.end<=cut.end&&c.start>=cut.start&&!c.emphasis)){tested++;
    const a=c.area,ov=b=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    if(ob.every(b=>ov(b)<.05*a.w*a.h))clear++;if(zone&&ov(zone)>=.6*a.w*a.h)inZone++;}}
  check(tested>=6&&clear/tested>=.85,'lyrics clear of the window '+id+' '+clear+'/'+tested);check(!['orbSide','halfSplit','panel','capStrip'].includes(id)||inZone/tested>=.6,'lyrics in the zone '+id+' '+inZone+'/'+tested);
 }
 // ---- the foreground sits in the window (or breaks out of its frame) and its lyrics zone is the layout's
 for(const id of ['orbSide','halfSplit','orb','dome','emblem']){
  const def=J.BACKGROUND_LAYOUTS.find(l=>l.id===id);J.backgroundLayoutPool=()=>[{...def,weight:1e7}];let tested=0,ok=0,comp=0;
  for(let seed=1;seed<=6;seed++){const pl=plan(setup(seed,'16:9','both')),bg=pl.media.cuts[0],fg=pl.foreground.cuts[0];if(!bg.bgLayout)continue;tested++;
   comp+=/^bgfit:/.test(fg.composition)&&JSON.stringify(fg.compositionZone)===JSON.stringify(bg.bgLayout.zone)?1:0;
   const bb=J.maskBounds(bg.mask.shapes,pl.W/pl.H),c={x:fg.placement.cx,y:fg.placement.cy};if(c.x>=bb.x-.02&&c.x<=bb.x+bb.w+.02&&c.y>=bb.y-.02&&c.y<=bb.y+bb.h+.02)ok++;}
  check(tested>=5&&comp===tested,'foreground composition follows the layout '+id+' '+comp+'/'+tested);check(ok===tested,'foreground centred in the window '+id+' '+ok+'/'+tested);
 }
 J.backgroundLayoutPool=real;
 // ---- scenes: automatic layouts only; a hand-edited mask is no longer the layout
 {const def=J.BACKGROUND_LAYOUTS.find(l=>l.id==='halfSplit');J.backgroundLayoutPool=()=>[{...def,weight:1e7}];
  // (the same layout never repeats back to back, so the middle cut is a plain framing)
  const p=setup(3,'16:9'),pl=plan(p),n=J.backgroundScenes(p,pl,null).length;check(n>=2&&pl.media.cuts[0].bgLayout,'scenes '+n);
  p.media.cutOverrides[0].details={mask:{enabled:true,target:'source',invert:false,shapes:[{type:'ellipse',cx:.5,cy:.5,w:.5,h:.5}]}};
  const edited=plan(p);check(J.backgroundScenes(p,edited,null).length===n-1,'edited mask leaves the scene list');
  check(edited.media.cuts[0].mask.target==='source'&&edited.media.cuts[0].placement,'manual mask wins');
  J.backgroundLayoutPool=real;}
 // ---- the manual mask editor reads the automatic window as its starting point
 {const def=J.BACKGROUND_LAYOUTS.find(l=>l.id==='orb');J.backgroundLayoutPool=()=>[{...def,weight:1e7}];const pl=plan(setup(2,'16:9'));const m=J.normalizeMask(pl.media.cuts[0].mask);check(m.enabled&&m.target==='cut'&&m.shapes.length===1&&m.shapes[0].type==='ellipse','mask editor input');J.backgroundLayoutPool=real;}
 // ---- reroll / relayout re-pick, deterministic otherwise
 {const p=setup(5,'16:9'),a=plan(p).media.cuts.map(c=>c.composition+JSON.stringify(c.placement)).join(),b=plan(p).media.cuts.map(c=>c.composition+JSON.stringify(c.placement)).join();check(a===b,'deterministic');
  p.media.cutOverrides[1].placementSeed=7;const c=plan(p).media.cuts;check(c.map(x=>x.composition+JSON.stringify(x.placement)).join()!==a,'relayout changes the cut');}
 return failures;
});
assert.deepEqual(result,[]);

// ---- a locked window survives: same layout, mask, placement and scene after re-planning
await page.evaluate(()=>{const def=J.BACKGROUND_LAYOUTS.find(l=>l.id==='pair');J.backgroundLayoutPool=()=>[{...def,weight:1e7}];
 const p=J.defaultProject();p.seed=4;p.lyrics='[00:00]夜明けの色を覚えてる\n[00:04]ほどけた声が遠くで鳴った';p.durationOverride=8;
 p.media={...p.media,items:[{id:'bg',name:'bg.png',type:'image',width:400,height:300}],manualCuts:true,cutCount:2,timing:{lineTimes:{0:0,1:4}},cutOverrides:{0:{itemId:'bg',technique:'pushIn'},1:{itemId:'bg',technique:'pushIn'}}};
 J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();});
const before=await page.evaluate(()=>{const c=J.ui.plan.media.cuts[0];return JSON.stringify({id:c.bgLayout.id,sig:c.bgLayout.sig,placement:c.placement,zone:c.bgLayout.zone,obstacles:c.bgLayout.obstacles});});
await timelineAction(page,'[data-layer="media"][data-index="0"]','lock');
assert.equal(await page.evaluate(()=>!!J.ui.project.media.cutOverrides[0].lock&&!!J.ui.project.media.cutOverrides[0].lockedLayout),true);
await page.evaluate(()=>{J.ui.project.seed=999;J.ui.project.media.seed=42;J.uiApi.replan();});
assert.equal(await page.evaluate(()=>{const c=J.ui.plan.media.cuts[0];return JSON.stringify({id:c.bgLayout.id,sig:c.bgLayout.sig,placement:c.placement,zone:c.bgLayout.zone,obstacles:c.bgLayout.obstacles});}),before,'locked layout kept');
assert.equal(await page.evaluate(()=>JSON.stringify(J.ui.plan.media.cuts[0].mask)===J.ui.plan.media.cuts[0].bgLayout.sig),true);

// ---- moving an automatic layout by hand keeps its window as the cut's own mask
await page.evaluate(()=>{J.ui.project.media.cutOverrides[0]={itemId:'bg',technique:'pushIn'};J.ui.project.media.seed=1;J.uiApi.replan();});
const beforeEdit=await page.evaluate(()=>{const c=J.ui.plan.media.cuts[0];return {sig:c.bgLayout?.sig,placement:c.placement};});
assert.ok(beforeEdit.sig,'layout cut to edit');
await page.locator('#modePro').click();await page.locator('#closeSettingsDrawer').click();
await page.locator('#sourceMedia').click().catch(()=>{});
await page.locator('#mediaLineList .foreground-placement-open').first().click();
// Applying an unchanged automatic placement keeps it automatic; make an actual edit.
await page.locator('#mediaAreaWidth').fill(String(+await page.locator('#mediaAreaWidth').inputValue()+1));
await page.locator('#mediaAreaWidth').dispatchEvent('change');
await page.locator('#areaApplyOne').click();
const edited=await page.evaluate(()=>{const o=J.ui.project.media.cutOverrides[0],c=J.ui.plan.media.cuts[0];return {manual:c.placementMode,mask:JSON.stringify(o.details?.mask&&J.normalizeMask(o.details.mask)),planMask:JSON.stringify(c.mask),bg:c.bgLayout};});
assert.equal(edited.manual,'manual');assert.equal(edited.mask,beforeEdit.sig,'the window is kept');assert.equal(edited.planMask,beforeEdit.sig);assert.equal(edited.bg,undefined,'no longer an automatic layout');
// ---- split freezes the window with the placement; shuffling the layout hands both back to automatic
await page.evaluate(()=>{const def=J.BACKGROUND_LAYOUTS.find(l=>l.id==='halfSplit');J.backgroundLayoutPool=()=>[{...def,weight:1e7}];
 const p=J.defaultProject();p.seed=4;p.lyrics='[00:00]夜明けの色を覚えてる';p.durationOverride=10;
 p.media={...p.media,items:[{id:'bg',name:'bg.png',type:'image',width:400,height:300}],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:'bg',technique:'pushIn'}}};
 J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();J.uiApi.seek(4);});
const original=await page.evaluate(()=>JSON.stringify({sig:J.ui.plan.media.cuts[0].bgLayout?.sig,placement:J.ui.plan.media.cuts[0].placement}));
assert.ok(JSON.parse(original).sig,'layout to split');
await page.evaluate(()=>J.uiApi.splitMediaCut('media'));
const split=await page.evaluate(()=>{const o=J.ui.project.media.cutOverrides;return [0,1].map(i=>({mask:JSON.stringify(o[i].details?.mask&&J.normalizeMask(o[i].details.mask)),flag:o[i].layoutMask,placement:!!o[i].placement}));});
for(const half of split){assert.equal(half.placement,true);assert.equal(half.mask,JSON.parse(original).sig,'the split keeps the window');assert.equal(half.flag,half.mask,'and marks it as the layout window');}
await page.evaluate(()=>J.uiApi.seek(7));
await page.locator('#relayoutAtPlayhead').click();
const shuffled=await page.evaluate(()=>{const o=J.ui.project.media.cutOverrides,cuts=J.ui.plan.media.cuts;return {second:{mask:!!o[1].details?.mask,flag:o[1].layoutMask,placement:!!o[1].placement,auto:cuts[1].placementMode},first:{mask:!!o[0].details?.mask,flag:!!o[0].layoutMask,placement:!!o[0].placement},secondMask:cuts[1].mask?JSON.stringify(cuts[1].mask)===cuts[1].bgLayout?.sig:null};});
assert.deepEqual(shuffled.second,{mask:false,flag:undefined,placement:false,auto:'auto'},'the shuffled half is automatic again, window included');
assert.notEqual(shuffled.secondMask,false,'its mask is a fresh layout or none, never the old frozen one');
assert.deepEqual(shuffled.first,{mask:true,flag:true,placement:true},'the other half is untouched');
// ---- dissolving between two windows: each side keeps its own window until the end
const trans=await page.evaluate(()=>{
 const orb=J.BACKGROUND_LAYOUTS.find(l=>l.id==='orb'),card=J.BACKGROUND_LAYOUTS.find(l=>l.id==='card');J.backgroundLayoutPool=cut=>[{...(cut.index?card:orb),weight:1e7}];
 const p=J.defaultProject();p.lyrics='';p.durationOverride=12;p.seed=2;
 p.media={...p.media,items:[{id:'bg',name:'bg.png',type:'image',width:400,height:300},{id:'bg2',name:'bg2.png',type:'image',width:400,height:300}],manualCuts:true,cutCount:2,timing:{lineTimes:{0:0,1:6}},cutOverrides:{0:{itemId:'bg',technique:'dissolve'},1:{itemId:'bg2',technique:'dissolve'}}};
 J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();const plan=J.ui.plan,c1=plan.media.cuts[1];
 const cv=document.createElement('canvas');cv.width=320;cv.height=180;const x=cv.getContext('2d'),r=new J.Renderer(),px=t=>{r.frame(x,plan,t,{scale:320/plan.W});return [...x.getImageData(160,90,1,1).data];};
 const bg=px(1),mid=px(6+c1.transDur*.4),after=px(6+c1.transDur+.4);
 return {trans:c1.trans,transDur:c1.transDur,bg,before:px(5.9),mid,after,layouts:plan.media.cuts.map(c=>c.bgLayout?.id)};
});
assert.deepEqual(trans.layouts,['orb','card']);
const dist=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]);
assert.ok(dist(trans.before,trans.after)>60,'inside the old window before, outside the new one after');
assert.ok(dist(trans.mid,trans.before)>10&&dist(trans.mid,trans.after)>10,'old window is fading, not cut off: '+JSON.stringify(trans));
assert.deepEqual(errors,[]);console.log(locale||'ja','dynamic background layouts: setting, windows, lottery, lyrics, foreground, scenes, lock, dissolve passed');await page.close();}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
