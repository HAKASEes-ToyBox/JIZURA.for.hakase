// 1シーン / 重ねず1シーン composed as one scene, over every combination: lyric count, 強調 / 抑制, overlap allowed
// or not, foreground, background window, stage shape. Each scene: composed, inside the margins, no collisions,
// clear of the foreground and the window, readable type, emphasis larger and suppression smaller, varied.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const locale of ['', 'en/']){
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const url='http://127.0.0.1:8765/'+locale;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',locale,'index.html'))}):r.abort());await page.goto(url);
const result=await page.evaluate(()=>{
 const failures=[],stats={},check=(ok,m)=>{if(!ok&&failures.length<40)failures.push(m)};
 for(const id of ['bg','fg']){const c=document.createElement('canvas');c.width=400;c.height=300;const g=c.getContext('2d');g.fillStyle=id==='bg'?'#335':'#e33';g.fillRect(0,0,400,300);g.fillStyle='#fc6';g.fillRect(150,100,100,100);J.mediaAssets.set(id,{element:c,type:'image'});}
 const TEXT=['夜明け前の街を抜けて','走る','まだ知らない明日へ','きみの名前を呼んでみる','光る窓','ほどけた声が遠くで鳴った','ねえ','透明なままじゃ終われない','もう一度','風の音'];
 const ov=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 const real=J.backgroundLayoutPool,layoutIds=['halfSplit','orbSide','orb','capStrip','panel'];
 const build=(n,{avoid=false,emph=[],soft=[],fg=false,bg=null,aspect='16:9',seed=1,extra={}})=>{
  const p=J.defaultProject();p.seed=seed*17+3;p.aspect=aspect;
  p.lyrics=Array.from({length:n},(_,i)=>{let t=TEXT[i%TEXT.length];if(emph.includes(i))t='*'+t+'*';if(soft.includes(i))t='~'+t+'~';return `[00:0${(i*1.2).toFixed(1)}]`+(i===0?(avoid?'{-':'{'):'')+t+(i===n-1?(avoid?'-}':'}'):'');}).join(String.fromCharCode(10));
  p.durationOverride=Math.ceil(n*1.2+3);
  if(fg)p.foreground={...p.foreground,seed,items:[{id:'fg',name:'fg.png',type:'image',width:400,height:300}],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:'fg',technique:'pushIn'}}};
  if(bg){const def=J.BACKGROUND_LAYOUTS.find(l=>l.id===bg);J.backgroundLayoutPool=()=>[{...def,weight:1e7}];p.media={...p.media,seed,items:[{id:'bg',name:'bg.png',type:'image',width:400,height:300}],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:'bg',technique:'pushIn'}}};}else J.backgroundLayoutPool=real;
  return Object.assign(p,extra);};
 const run=p=>{const pl=J.plan(p);pl.media=J.planMedia(p,pl,null,'media');pl.foreground=J.planMedia(p,pl,null,'foreground');return pl;};
 const group=pl=>pl.cuts.filter(c=>c.group===0&&Number.isInteger(c.part));
 const chars=t=>[...t.replace(/\s/g,'')].length;
 // font proxy of a text-fitted box (stage heights): the box holds n glyph cells of about f² each
 const lenFactor=c=>Math.min(1.28,Math.max(.84,1.28-.045*chars(c.text)));
 const fontOf=(c,S)=>Math.sqrt(c.area.w*S*c.area.h/(Math.max(1,chars(c.text))*1.5))/Math.min(1,S);
 const relFont=(c,S)=>fontOf(c,S)/lenFactor(c);
 let smallCommon=0,commonScenes=0,tiny=0,scenes=0,composed=0,small=0,relaxedScenes=0,names=new Set(),hierE=[0,0],hierS=[0,0];
 const shapes={'16:9':16/9,'9:16':9/16,'1:1':1};
 const counts=[2,3,4,5,7,10],variants={plain:{},emph:{emph:[1]},soft:{soft:[0]},mix:{emph:[0],soft:[1]},mix2:{emph:[1,2],soft:[3]}};
 for(const [aspect,S] of Object.entries(shapes))for(const n of counts)for(const avoid of [false,true])for(const [vname,v] of Object.entries(variants)){
  if(vname==='mix2'&&n<5)continue;
  for(const ctx of ['none','fg','bg','bgfg'])for(let seed=1;seed<=2;seed++){
   const emph=(v.emph||[]).filter(i=>i<n),soft=(v.soft||[]).filter(i=>i<n);
   const p=build(n,{avoid,emph,soft,fg:ctx.includes('fg'),bg:ctx.startsWith('bg')?layoutIds[(seed+n)%layoutIds.length]:null,aspect,seed}),pl=run(p),G=group(pl),tag=`${aspect} n${n} ${avoid?'avoid':'shared'} ${vname} ${ctx} s${seed}`;
   scenes++;if(G.length<2){check(false,'group '+tag);continue;}
   if(!G.every(c=>c.arrangement)){check(false,'not composed '+tag);continue;}
   composed++;names.add(G[0].arrangement);
   check(G.every(c=>c.arrangement===G[0].arrangement),'one arrangement '+tag);
   check(G.every(c=>c.areaMode===(avoid?'group':'auto')),'area mode '+tag);
   // inside the margins
   for(const c of G){const a=c.area;check(a.x>=.029&&a.y>=.029&&a.x+a.w<=.971&&a.y+a.h<=.971,'margins '+tag);}
   // collisions between lyrics
   for(let i=0;i<G.length;i++)for(let j=i+1;j<G.length;j++){const a=G[i].area,b=G[j].area,o=ov(a,b);
    check(avoid?o<1e-9:o<=.17*Math.min(a.w*a.h,b.w*b.h),'lyric overlap '+tag+' '+G[0].arrangement);}
   // clear of the foreground and the window (emphasised lyrics may lie over them)
   const obstacles=[];
   if(ctx.includes('fg'))for(const f of pl.foreground.cuts){const b=J.foregroundBounds(p,pl,f);if(b)obstacles.push(b);}
   if(ctx.startsWith('bg'))for(const s of J.backgroundScenes(p,pl,null))obstacles.push(...s.boxes);
   // (a scene with no readable room around them, under about 36 px type, may lie over them as little as possible)
   let over=0;for(const c of G.filter(c=>!c.emphasis))for(const o of obstacles)if(ov(c.area,o)>=1e-6)over++;
   if(over){relaxedScenes++;if(Math.min(...G.map(c=>fontOf(c,S)))<.03)stats.relaxedTiny=(stats.relaxedTiny||0)+1;}
   // readability and hierarchy (by type size, not box area: boxes hug their text)
   const fonts=G.map(c=>fontOf(c,S)),minFont=Math.min(...fonts);
   if(minFont<.043){small++;if(n<=5)smallCommon++;}
   if(n<=5)commonScenes++;
   if(minFont<.028){tiny++;const k=`${aspect} n${n} ${ctx}`;(stats.tinyBy||(stats.tinyBy={}))[k]=((stats.tinyBy||{})[k]||0)+1;}
   const norm=G.filter(c=>!c.emphasis&&!c.suppressed).map(c=>relFont(c,S)).sort((a,b)=>a-b),med=norm.length?norm[Math.floor(norm.length/2)]:null;
   if(med){for(const c of G.filter(c=>c.emphasis)){hierE[1]++;if(relFont(c,S)>=med*1.15)hierE[0]++;else{(stats.samples||(stats.samples=[])).length<14&&stats.samples.push([tag,G[0].arrangement,c.text,+(relFont(c,S)/med).toFixed(2),+med.toFixed(3)]);const k=`${aspect} n${n} ${ctx} ${G[0].arrangement}`;(stats.emphBy||(stats.emphBy={}))[k]=((stats.emphBy||{})[k]||0)+1;}}
    for(const c of G.filter(c=>c.suppressed)){hierS[1]++;if(relFont(c,S)<=med*.92)hierS[0]++;}}
  }}
 stats.scenes=scenes;stats.relaxed=relaxedScenes;stats.tiny=tiny;stats.composed=composed;stats.arrangements=names.size;stats.small=[small,smallCommon+'/'+commonScenes];stats.hier=[hierE.join('/'),hierS.join('/')];
 check(relaxedScenes<=scenes*.03,'lyrics over the foreground/window '+relaxedScenes+'/'+scenes);check(tiny<=scenes*.03,'unreadably small '+tiny+'/'+scenes);
 check(composed>=scenes*.985,'composed '+composed+'/'+scenes);check(names.size>=14,'arrangement variety '+names.size);
 check(smallCommon<=commonScenes*.06,'small type in scenes of up to five lyrics '+smallCommon+'/'+commonScenes);check(hierE[1]&&hierE[0]>=hierE[1]*.9,'emphasis larger '+hierE.join('/'));check(hierS[1]&&hierS[0]>=hierS[1]*.9,'suppression smaller '+hierS.join('/'));
 // variety for one fixed scene across seeds; the placement seed (配置をシャッフル) re-rolls it; deterministic otherwise
 {const seen=new Set();for(let s=1;s<=20;s++)seen.add(group(run(build(5,{seed:s})))[0].arrangement);check(seen.size>=6,'variety across seeds '+seen.size);stats.varietyN5=seen.size;
  const p=build(5,{seed:4}),a=JSON.stringify(group(run(p)).map(c=>c.area)),b=JSON.stringify(group(run(p)).map(c=>c.area));check(a===b,'deterministic');
  let changed=0;for(let s=1;s<=12;s++){const q=build(5,{seed:4});q.lyricCutOptions={'0:0':{placementSeed:s}};if(JSON.stringify(group(run(q)).map(c=>c.area))!==a)changed++;}check(changed>=9,'re-roll changes the scene '+changed);}
 // manual areas skip the composition; a locked line keeps its area and the rest keeps clear of it
 {const p=build(4,{seed:2,avoid:true,extra:{overrides:{0:{area:{x:.1,y:.1,w:.5,h:.4,angle:0,lockAspect:true}}}}});check(group(run(p)).every(c=>!c.arrangement),'manual area skips');}
 {const base=build(4,{seed:3});const first=group(run(base)),locked=first.filter(c=>c.line===0).map(c=>c.area);
  const p=build(4,{seed:3});p.overrides={0:{lock:true,lockedAreas:Object.fromEntries(first.filter(c=>c.line===0).map(c=>[c.part,c.area])),lockedUnits:{text:TEXT[0],groups:[],recap:false}}};
  const pl=run(p),G=group(pl);check(G.filter(c=>c.line===0).every((c,i)=>JSON.stringify(c.area)===JSON.stringify(locked[i])),'locked area kept');}
 // without automatic placement, or with only one lyric, nothing is composed
 {const p=build(4,{seed:1,extra:{lyricEffects:{autoPlacement:false}}});check(group(run(p)).every(c=>!c.arrangement),'no auto placement');}
 J.backgroundLayoutPool=real;
 return {failures,stats};
});
if(process.env.STATS)console.log(JSON.stringify(result.stats,null,0));assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);console.log(locale||'ja','lyric scenes:',JSON.stringify(result.stats));await page.close();}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
