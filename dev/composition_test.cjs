const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/']){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());await page.goto(url);
const result=await page.evaluate(()=>{
const failures=[],check=(ok,m)=>{if(!ok)failures.push(m)},stats={};
const ov=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const setup=(seed,{cuts=4,lyricEffects={},fgEffects={},lyrics}={})=>{const p=J.defaultProject();p.seed=seed;if(lyrics)p.lyrics=lyrics;p.lyricEffects={...p.lyricEffects,autoPlacement:true,...lyricEffects};
 p.foreground={...p.foreground,items:[{id:'fg',name:'fg.png',type:'image',width:400,height:300}],manualCuts:true,cutCount:cuts,seed:1,timing:{lineTimes:Object.fromEntries(Array.from({length:cuts},(_,i)=>[i,i*2.5]))},cutOverrides:Object.fromEntries(Array.from({length:cuts},(_,i)=>[i,{itemId:'fg',technique:null}]))};
 p.foreground.effects={...J.mediaEffectSettings(p,'foreground'),...fgEffects};return p;};
const planOf=p=>{const plan=J.plan(p);plan.foreground=J.planMedia(p,plan,null,'foreground');return plan;};
// Foreground compositions: varied, never repeated back to back, inside the safe area, sized by the settings.
const ids=new Set();let sizeChecks=0;
// Old size-range settings are ignored: sizes come from each composition's own range.
for(let seed=1;seed<=40;seed++){const plan=planOf(setup(seed,{cuts:6,fgEffects:{sizeMin:500,sizeMax:500}}));const fg=plan.foreground.cuts;
 fg.forEach((c,i)=>{ids.add(c.composition);if(i)check(c.composition!==fg[i-1].composition,'repeat '+seed);
  const r=J.mediaPlacementRect(c.placement,400,300,plan.W,plan.H);check(r.x>=.025&&r.y>=.025&&r.x+r.w<=.975&&r.y+r.h<=.975,'safe '+seed+' '+c.composition);
  const comp=J.COMPOSITION_BY_ID[c.composition],ext=Math.max(r.w,r.h),group=J.MEDIA_TECH[c.technique]?.group,dyn=group==='dynamic'||group==='graphic'?.85:1;if(ext<.94){sizeChecks++;check(ext>=comp.fg.size[0]*dyn-1e-6&&ext<=comp.fg.size[1]*dyn+1e-6,'pattern size '+seed+' '+c.composition+' '+ext.toFixed(3));}});}
check(ids.size>=17,'compositions used '+ids.size);check(sizeChecks>50,'size samples');stats.compositions=ids.size;
// Lyrics with avoidance: never on the foreground, mostly in the composition zone and on the far side of it.
let inZone=0,opposite=0,splits=0,total=0;
for(let seed=1;seed<=40;seed++){const p=setup(seed),plan=planOf(p);
 for(const cut of plan.cuts.filter(c=>c.line>=0&&Number.isInteger(c.part)&&!c.emphasis&&c.area&&c.areaMode==='auto')){
  const shown=plan.foreground.cuts.filter(f=>f.start<cut.end&&f.end+.6>cut.start);
  for(const f of shown)check(ov(cut.area,J.foregroundBounds(p,plan,f))<1e-8,'lyric overlaps foreground '+seed);
  const main=shown.reduce((a,f)=>!a||Math.min(f.end,cut.end)-Math.max(f.start,cut.start)>Math.min(a.end,cut.end)-Math.max(a.start,cut.start)?f:a,null);if(!main)continue;
  const zone=J.COMPOSITION_BY_ID[main.composition].zone;total++;if(ov(cut.area,zone)/(cut.area.w*cut.area.h)>=.6)inZone++;
  if(['left','right'].includes(main.composition)){splits++;const b=J.foregroundBounds(p,plan,main);if(Math.sign(cut.area.x+cut.area.w/2-.5)===-Math.sign(b.x+b.w/2-.5))opposite++;}}}
check(total>40&&inZone/total>=.75,'lyrics in zone '+inZone+'/'+total);check(splits>5&&opposite/splits>=.8,'balanced splits '+opposite+'/'+splits);stats.inZone=+(inZone/total).toFixed(2);stats.opposite=+(opposite/splits).toFixed(2);
// Without avoidance the composition still guides the lyrics.
{let z=0,n=0;for(let seed=1;seed<=20;seed++){const p=setup(seed,{lyricEffects:{avoidForeground:false}}),plan=planOf(p);
 for(const cut of plan.cuts.filter(c=>c.areaMode==='auto'&&!c.emphasis)){const f=plan.foreground.cuts.find(f=>f.start<cut.end&&f.end>cut.start);if(!f)continue;n++;if(ov(cut.area,J.COMPOSITION_BY_ID[f.composition].zone)/(cut.area.w*cut.area.h)>=.6)z++;}}
 check(n>10&&z/n>=.7,'zone without avoidance '+z+'/'+n);}
// The size notation is kept exactly; only the position is composed.
for(let seed=1;seed<=10;seed++){const p=setup(seed,{lyrics:'30:夜明けの色を覚えてる\n45:ほどけた声'}),plan=planOf(p);
 for(const cut of plan.cuts.filter(c=>c.line>=0&&Number.isInteger(c.part))){const s=cut.line===0?.3:.45;check(Math.abs(cut.area.w-s)<1e-9&&Math.abs(cut.area.h-s)<1e-9,'size notation '+seed);
  check(cut.area.x>=-1e-9&&cut.area.y>=-1e-9&&cut.area.x+cut.area.w<=1+1e-9&&cut.area.y+cut.area.h<=1+1e-9,'notation inside '+seed);}}
// Lyric-only scenes use aligned, varied positions inside the margins.
{const centers=new Set();for(let seed=1;seed<=24;seed++){const p=J.defaultProject();p.seed=seed;p.lyricEffects={...p.lyricEffects,autoPlacement:true};
 for(const cut of J.plan(p).cuts.filter(c=>c.areaMode==='auto')){const a=cut.area;check(a.x>=.029&&a.y>=.029&&a.x+a.w<=.971&&a.y+a.h<=.971,'solo margins '+seed);centers.add((a.x+a.w/2).toFixed(2)+':'+(a.y+a.h/2).toFixed(2));}}
 check(centers.size>=6,'solo variety '+centers.size);stats.soloPositions=centers.size;}
// Retained groups pack inside the composition zone.
{let z=0,n=0;for(let seed=1;seed<=12;seed++){const p=setup(seed,{cuts:1,lyrics:'{-夜明けの/色を/覚えてる-}'});p.foreground.cutCount=1;const plan=planOf(p),f=plan.foreground.cuts[0];
 for(const cut of plan.cuts.filter(c=>c.areaMode==='group')){n++;if(ov(cut.area,J.COMPOSITION_BY_ID[f.composition].zone)/(cut.area.w*cut.area.h)>=.6)z++;}}
 check(n>=12&&z/n>=.7,'groups in zone '+z+'/'+n);}
// Variation: Shuffle (layer seed) and Randomize (project seed) change the compositions; same input, same result.
{const p=setup(5,{cuts:6}),a=planOf(p).foreground.cuts.map(c=>c.composition).join();check(a===planOf(p).foreground.cuts.map(c=>c.composition).join(),'deterministic');
 p.foreground.seed=2;const b=planOf(p).foreground.cuts.map(c=>c.composition).join();p.seed=99;const c=planOf(p).foreground.cuts.map(c=>c.composition).join();check(a!==b&&b!==c,'shuffle/randomize variation');}
// Backgrounds: framing patterns, varied, never smaller than the whole source and never exposing an edge.
{const used=new Set();for(let seed=1;seed<=30;seed++){const p=J.defaultProject();p.seed=seed;
  p.media={...p.media,items:[{id:'bg',name:'bg.png',type:'image',width:400,height:300}],manualCuts:true,cutCount:6,timing:{lineTimes:{0:0,1:2,2:4,3:6,4:8,5:10}},cutOverrides:Object.fromEntries(Array.from({length:6},(_,i)=>[i,{itemId:'bg',technique:null}]))};
  const plan=J.plan(p),cuts=J.planMedia(p,plan,null,'media').cuts,fit=J.mediaPlacementRect(null,400,300,plan.W,plan.H);
  cuts.forEach((c,i)=>{used.add(c.composition);if(i)check(c.composition!==cuts[i-1].composition,'background repeat '+seed);const r=J.mediaPlacementRect(c.placement,400,300,plan.W,plan.H);
   check(r.w>=fit.w-1e-9&&r.h>=fit.h-1e-9,'background smaller than whole '+seed);
   for(const [s,e] of [[r.x,r.w],[r.y,r.h]])check(e>=1?s<=1e-9&&s+e>=1-1e-9:s>=-1e-9&&s+e<=1+1e-9,'background edge '+seed+' '+c.composition);});}
 check(used.size>=9,'background patterns '+used.size);stats.backgrounds=used.size;}
// Lyric sizes: small/medium/large classes give real contrast (old manual range ignored).
{const areas=[];for(let seed=1;seed<=30;seed++){const p=J.defaultProject();p.seed=seed;p.lyricEffects={autoPlacement:true,sizeMin:100,sizeMax:100};for(const c of J.plan(p).cuts.filter(c=>c.areaMode==='auto'&&!c.emphasis&&!c.suppressed))areas.push(c.area.w*c.area.h);}
 const ratio=Math.max(...areas)/Math.min(...areas);check(ratio>=2.5,'lyric size contrast '+ratio.toFixed(2));stats.lyricSizeRatio=+ratio.toFixed(2);}
// Manual placements and background framing are untouched by compositions.
{const p=setup(3,{cuts:2});p.foreground.cutOverrides[0].placement={cx:.2,cy:.3,w:.2,h:.2,lockAspect:true,angle:0};const plan=planOf(p);
 check(plan.foreground.cuts[0].placement.cx===.2&&!plan.foreground.cuts[0].composition,'manual kept');
 const m=J.defaultProject();m.media={...m.media,items:[{id:'bg',name:'bg.png',type:'image',width:400,height:300}],cutCount:2,cutOverrides:{0:{itemId:'bg',technique:null},1:{itemId:'bg',technique:null}}};
 check(J.planMedia(m,J.plan(m),null,'media').cuts.every(c=>J.BACKGROUND_PATTERNS.some(b=>b.id===c.composition)),'background uses framing patterns');}
return {failures,stats};});
assert.deepEqual(result.failures,[]);
// The manual size-range sliders are gone from Details.
assert.equal(await page.locator('#lyricAutoSizeMin,#lyricAutoSizeMax,[data-media-size],[data-media-size-range]').count(),0);
assert.deepEqual(errors,[]);console.log(lang||'ja',JSON.stringify(result.stats));await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
