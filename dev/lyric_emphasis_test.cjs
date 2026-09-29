const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/']){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());await page.goto(url);
const result=await page.evaluate(()=>{
const failures=[],check=(ok,m)=>{if(!ok)failures.push(m)},stats={};
const ov=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const c=document.createElement('canvas');c.width=400;c.height=300;J.mediaAssets.set('fgA',{element:c,type:'image'});
const withFg=p=>{p.foreground={...p.foreground,items:[{id:'fgA',name:'a.png',type:'image',width:400,height:300}],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:'fgA',technique:null}}};return p;};
const make=(seed,auto,fg,lyrics='夜明けの色を覚えてる\n*ほどけた声が*\n~遠くで鳴った~')=>{const p=J.defaultProject();p.seed=seed;p.lyrics=lyrics;p.lyricEffects={autoPlacement:auto};return fg?withFg(p):p;};
const kind=c=>c.emphasis?'e':c.suppressed?'s':'n',avg=x=>x.reduce((a,b)=>a+b,0)/x.length;
// Without automatic placement the text scale carries the strength.
{const cuts=J.plan(make(1,false,false)).cuts.filter(c=>c.line>=0),by=k=>cuts.find(c=>kind(c)===k);
 check(by('e').contentScale>1&&by('n').contentScale===1&&by('s').contentScale<1,'text scale '+cuts.map(c=>kind(c)+c.contentScale));}
// Automatic placement: emphasis clearly larger, suppression clearly smaller.
for(const fg of [false,true]){const a={e:[],n:[],s:[]},patterns=new Set();let overlayCover=1,minEmph=1,suppOk=0,suppN=0;
 for(let seed=1;seed<=40;seed++){const p=make(seed,true,fg),pl=J.plan(p);const box=fg?J.foregroundBounds(p,pl,J.planMedia(p,pl,null,'foreground').cuts[0]):null;
  for(const cut of pl.cuts.filter(c=>c.line>=0)){const r=cut.area;a[kind(cut)].push(r.w*r.h);check(!cut.emphasis||r.x>=.029&&r.y>=.029&&r.x+r.w<=.971&&r.y+r.h<=.971,'margins '+seed);
   if(cut.suppressed){suppN++;if(r.w>=.3-1e-9&&r.h>=.17-1e-9)suppOk++;check(cut.contentScale===1,'suppressed area not shrunk twice');}
   if(cut.emphasis){minEmph=Math.min(minEmph,r.w*r.h);check(cut.contentScale===1,'area carries emphasis size');check(cut.frontmost,'emphasis in front');
    if(fg){patterns.add(cut.lyricPattern);if(cut.lyricPattern==='overlay')overlayCover=Math.min(overlayCover,ov(r,box)/(box.w*box.h));}}}}
 const e=avg(a.e),n=avg(a.n),s=avg(a.s);stats[fg?'fg':'solo']={e:+e.toFixed(3),n:+n.toFixed(3),s:+s.toFixed(3),minEmph:+minEmph.toFixed(3),suppOk:suppOk+'/'+suppN};
 check(e>=2*n,'emphasis larger '+fg);check(s<=.7*n,'suppressed smaller '+fg);check(s>=.2*n,'suppressed not too small '+fg+' '+(s/n).toFixed(2));check(suppOk>=suppN*(fg?.9:1),'suppressed readable '+fg+' '+suppOk+'/'+suppN);check(minEmph>=.3,'every emphasis large '+fg+' '+minEmph.toFixed(3));
 if(fg){check(patterns.has('overlay')&&patterns.has('counter'),'fg emphasis patterns '+[...patterns]);check(overlayCover>=.5,'overlay covers the foreground '+overlayCover.toFixed(2));}}
// Foreground + emphasis: sometimes both go large (large foreground, large lyric over it); never without emphasis.
{let both=0,plain=0;for(let seed=1;seed<=60;seed++){const p=make(seed,true,true),pl=J.plan(p),f=J.planMedia(p,pl,null,'foreground').cuts[0],box=J.foregroundBounds(p,pl,f),e=pl.cuts.find(c=>c.emphasis);
  if(f.composition!=='bothLarge'){check(e.lyricPattern!=='bothLarge','both-large lyric needs the composition '+seed);continue;}both++;
  check(Math.max(box.w,box.h)>=.6,'large foreground '+seed+' '+Math.max(box.w,box.h).toFixed(2));check(e.lyricPattern==='bothLarge'&&e.area.w*e.area.h>=.4,'large lyric '+seed);
  check(ov(e.area,box)>=.5*box.w*box.h,'lyric over the foreground '+seed);check(e.frontmost,'lyric in front '+seed);}
 for(let seed=1;seed<=60;seed++){const p=make(seed,true,true,'夜明けの色を覚えてる\nほどけた声が'),pl=J.plan(p);if(J.planMedia(p,pl,null,'foreground').cuts[0].composition==='bothLarge')plain++;}
 check(both>=10&&both<=40,'both-large share '+both);check(plain===0,'both-large only with emphasis');stats.bothLarge=both;}
// Designed arrangements give the emphasised lyric a larger cell and the suppressed one a smaller cell.
{let bigger=0,smaller=0,count=0;for(let seed=1;seed<=30;seed++){const cuts=J.plan(make(seed,true,false,'{-夜明けの色を/*覚えてる*/ほどけた声が/~遠くで鳴った~-}')).cuts.filter(c=>c.group===0&&Number.isInteger(c.part));
  if(!cuts[0].arrangement)continue;count++;const size=c=>c.area.w*c.area.h,e=cuts.find(c=>c.emphasis),s=cuts.find(c=>c.suppressed),n=cuts.filter(c=>!c.emphasis&&!c.suppressed);
  if(size(e)>Math.max(...n.map(size)))bigger++;if(size(s)<Math.min(...n.map(size)))smaller++;}
 check(count>=25&&bigger>=count*.7&&smaller>=count*.7,`arrangement strength ${bigger}/${smaller}/${count}`);stats.arranged=[bigger,smaller,count];}
return {failures,stats};});
assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);console.log(lang||'ja',JSON.stringify(result.stats));await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
