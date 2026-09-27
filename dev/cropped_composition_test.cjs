const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/']){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());await page.goto(url);
const result=await page.evaluate(()=>{
const failures=[],check=(ok,m)=>{if(!ok)failures.push(m)},stats={};
const ov=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const names=['left','right','top','bottom'];let inZone=0,total=0;
for(let mask=1;mask<16;mask++){const edges=Object.fromEntries(names.map((e,i)=>[e,!!(mask&(1<<i))])),key=names.filter(e=>edges[e]).join('+'),list=J.croppedCompositions(edges);
 check(list.length>=1,'patterns '+key);
 // The lyric zone sits on the free side, away from each cropped edge (opposite pairs cancel).
 for(const c of list){const zx=c.zone.x+c.zone.w/2,zy=c.zone.y+c.zone.h/2;
  if(edges.left&&!edges.right)check(zx>c.fg.x,'zone right of '+c.id);if(edges.right&&!edges.left)check(zx<c.fg.x,'zone left of '+c.id);
  if(edges.top&&!edges.bottom)check(zy>c.fg.y,'zone below '+c.id);if(edges.bottom&&!edges.top)check(zy<c.fg.y,'zone above '+c.id);}
 if(mask===1||mask===2||mask===4||mask===8)check(list.length>=5,'single-edge variety '+key);if([5,6,9,10].includes(mask))check(list.length>=3,'corner variety '+key);
 const used=new Set();
 for(let seed=1;seed<=30;seed++){const p=J.defaultProject();p.seed=seed;p.lyrics='夜明けの色を覚えてる';p.lyricEffects={autoPlacement:true};
  const c=document.createElement('canvas');c.width=400;c.height=300;J.mediaAssets.set('fgA',{element:c,type:'image'});
  p.foreground={...p.foreground,items:[{id:'fgA',name:'a.png',type:'image',width:400,height:300,croppedEdges:edges}],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:'fgA',technique:null}}};
  const pl=J.plan(p),f=J.planMedia(p,pl,null,'foreground').cuts[0],r=J.mediaPlacementRect(f.placement,400,300,pl.W,pl.H);used.add(f.composition);
  check(f.composition.startsWith('crop:'+key+':'),'cropped composition '+key+' '+f.composition);
  check(!edges.left||-r.x/r.w>=.2-1e-8,'bleeds left '+key);check(!edges.right||(r.x+r.w-1)/r.w>=.2-1e-8,'bleeds right '+key);check(!edges.top||-r.y/r.h>=.2-1e-8,'bleeds top '+key);check(!edges.bottom||(r.y+r.h-1)/r.h>=.2-1e-8,'bleeds bottom '+key);
  if([1,2,4,8,5,6,9,10].includes(mask)){check(edges.left||r.x>=0,'free left '+key);check(edges.right||r.x+r.w<=1+1e-9,'free right '+key);check(edges.top||r.y>=0,'free top '+key);check(edges.bottom||r.y+r.h<=1+1e-9,'free bottom '+key);}
  const lc=pl.cuts.find(c=>c.line>=0),a=lc.area,zone=J.lyricScene(lc,[{cut:f,box:J.foregroundBounds(p,pl,f)}]).zone;
  // Opposite edges can grow a narrow source over the whole stage; only scenes with a free zone count.
  if(!zone||ov(zone,r)>.5*zone.w*zone.h)continue;total++;if(ov(a,zone)/(a.w*a.h)>=.6)inZone++;}
 if(list.length>=3)check(used.size>=3,'used variety '+key+' '+used.size);}
check(inZone/total>=.75,'lyrics in the free-side zone '+(inZone/total).toFixed(2));stats.inZone=+(inZone/total).toFixed(2);stats.total=total;
// A wide source cropped on both sides forms a band that leaves its zone free for the lyric.
{let n=0,z=0;for(let seed=1;seed<=20;seed++){const p=J.defaultProject();p.seed=seed;p.lyrics='夜明けの色を覚えてる';p.lyricEffects={autoPlacement:true};const c=document.createElement('canvas');c.width=1200;c.height=300;J.mediaAssets.set('wide',{element:c,type:'image'});
  p.foreground={...p.foreground,items:[{id:'wide',name:'w.png',type:'image',width:1200,height:300,croppedEdges:{left:true,right:true}}],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:'wide',technique:null}}};
  const pl=J.plan(p),f=J.planMedia(p,pl,null,'foreground').cuts[0],r=J.mediaPlacementRect(f.placement,1200,300,pl.W,pl.H),a=pl.cuts.find(c=>c.line>=0).area,zone=J.lyricScene(pl.cuts.find(c=>c.line>=0),[{cut:f,box:J.foregroundBounds(p,pl,f)}]).zone;
  n++;check(ov(zone,r)<=.25*zone.w*zone.h,'band leaves its zone '+f.composition);if(ov(a,zone)/(a.w*a.h)>=.6)z++;}
 check(z/n>=.8,'band lyrics in zone '+z+'/'+n);stats.band=z+'/'+n;}
// Sources without cropped edges keep the regular compositions.
{const p=J.defaultProject();p.lyrics='a';const c=document.createElement('canvas');J.mediaAssets.set('fgB',{element:c,type:'image'});p.foreground={...p.foreground,items:[{id:'fgB',name:'b.png',type:'image',width:400,height:300}],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:'fgB',technique:null}}};
 check(!J.planMedia(p,J.plan(p),null,'foreground').cuts[0].composition.startsWith('crop:'),'regular without cropped edges');}
return {failures,stats};});
assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);console.log(lang||'ja',JSON.stringify(result.stats));await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
