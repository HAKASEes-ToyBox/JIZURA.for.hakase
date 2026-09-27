const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/']){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());await page.goto(url);
const result=await page.evaluate(()=>{
const failures=[],check=(ok,m)=>{if(!ok)failures.push(m)},stats={};
const ov=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const lyrics={avoid:'{-夜明けの色を/覚えてる/ほどけた声が/遠くで鳴った-}',shared:'{夜明けの色を/覚えてる/ほどけた声が/遠くで鳴った}',two:'{-夜明けの色を/覚えてる-}'};
const plan=(text,seed,extra={})=>{const p=J.defaultProject();p.seed=seed;p.lyrics=text;Object.assign(p,extra);return {p,plan:J.plan(p)};};
const group=pl=>pl.cuts.filter(c=>c.group===0&&Number.isInteger(c.part));
// 重ねず1シーン without a foreground: varied designed arrangements, no overlap, inside the margins, readable sizes.
const names=new Set();let minSide=1,count=0;
for(const auto of [false,true])for(let seed=1;seed<=40;seed++){
 const {plan:pl}=plan(lyrics.avoid,seed,{lyricEffects:{autoPlacement:auto}}),cuts=group(pl);count++;
 check(cuts.length>=2&&cuts.every(c=>c.arrangement&&c.arrangement===cuts[0].arrangement&&c.areaMode==='group'),'arranged '+seed);names.add(cuts[0].arrangement);
 for(let i=0;i<cuts.length;i++){const a=cuts[i].area;minSide=Math.min(minSide,Math.min(a.w,a.h));check(a.x>=.029&&a.y>=.029&&a.x+a.w<=.971&&a.y+a.h<=.971,'margins '+seed);
  for(let j=i+1;j<cuts.length;j++)check(ov(a,cuts[j].area)<1e-9,'overlap '+seed+' '+cuts[0].arrangement);}}
check(names.size>=8,'arrangement variety '+names.size);check(minSide>=.08,'readable sizes '+minSide.toFixed(3));stats.arrangements=names.size;stats.minSide=+minSide.toFixed(3);
// Two lyrics still get an arrangement; strength blends towards it.
{const {plan:pl}=plan(lyrics.two,5);check(group(pl).every(c=>c.arrangement),'two lyrics');
 const full=group(plan(lyrics.avoid,7).plan)[0].area,half=group(plan(lyrics.avoid,7,{lyricEffects:{lyricAvoidanceStrength:.5}}).plan)[0].area;check(half.w>full.w&&half.w<1,'intermediate strength');}
// 1シーン: arranged only with automatic lyric placement; overlap limited to a third of the smaller area.
for(let seed=1;seed<=20;seed++){
 const off=group(plan(lyrics.shared,seed,{lyricEffects:{autoPlacement:false}}).plan);check(off.every(c=>!c.arrangement),'1シーン untouched without auto placement '+seed);
 const cuts=group(plan(lyrics.shared,seed,{lyricEffects:{autoPlacement:true}}).plan);check(cuts.every(c=>c.arrangement&&c.areaMode==='auto'),'1シーン arranged '+seed);
 for(let i=0;i<cuts.length;i++)for(let j=i+1;j<cuts.length;j++){const a=cuts[i].area,b=cuts[j].area;check(ov(a,b)<=.33*Math.min(a.w*a.h,b.w*b.h)+1e-9,'shared overlap '+seed);}}
// Manual areas and scenes with a foreground keep their previous handling.
{const {plan:pl}=plan(lyrics.avoid,3,{overrides:{0:{area:{x:.1,y:.1,w:.5,h:.4,angle:0}}}});check(group(pl).every(c=>!c.arrangement),'manual areas skip arrangement');
 const p=J.defaultProject();p.lyrics=lyrics.avoid;p.lyricEffects={autoPlacement:true};const c=document.createElement('canvas');c.width=40;c.height=30;J.mediaAssets.set('fgA',{element:c,type:'image'});
 p.foreground={...p.foreground,items:[{id:'fgA',name:'a.png',type:'image',width:40,height:30}],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:'fgA',technique:null}}};
 check(group(J.plan(p)).every(c=>!c.arrangement),'foreground scenes use the composition zone');}
// Deterministic; Randomize / re-layout (placement seed) change the arrangement.
{const a=group(plan(lyrics.avoid,9).plan).map(c=>JSON.stringify(c.area)).join();check(a===group(plan(lyrics.avoid,9).plan).map(c=>JSON.stringify(c.area)).join(),'deterministic');
 const seen=new Set();for(let s=1;s<=12;s++){const {p}=plan(lyrics.avoid,9);p.lyricCutOptions={'0:0':{placementSeed:s}};seen.add(group(J.plan(p))[0].arrangement);}check(seen.size>=4,'placement seed varies arrangement '+seen.size);}
return {failures,stats};});
assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);console.log(lang||'ja',JSON.stringify(result.stats));await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
