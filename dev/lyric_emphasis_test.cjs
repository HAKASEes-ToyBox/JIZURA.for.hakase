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
for(const fg of [false,true]){const a={e:[],n:[],s:[]},patterns=new Set();let overlayCover=1,minEmph=1;
 for(let seed=1;seed<=40;seed++){const p=make(seed,true,fg),pl=J.plan(p);const box=fg?J.foregroundBounds(p,pl,J.planMedia(p,pl,null,'foreground').cuts[0]):null;
  for(const cut of pl.cuts.filter(c=>c.line>=0)){const r=cut.area;a[kind(cut)].push(r.w*r.h);check(!cut.emphasis||r.x>=.029&&r.y>=.029&&r.x+r.w<=.971&&r.y+r.h<=.971,'margins '+seed);
   if(cut.emphasis){minEmph=Math.min(minEmph,r.w*r.h);check(cut.contentScale===1,'area carries emphasis size');check(cut.frontmost,'emphasis in front');
    if(fg){patterns.add(cut.lyricPattern);if(cut.lyricPattern==='overlay')overlayCover=Math.min(overlayCover,ov(r,box)/(box.w*box.h));}}}}
 const e=avg(a.e),n=avg(a.n),s=avg(a.s);stats[fg?'fg':'solo']={e:+e.toFixed(3),n:+n.toFixed(3),s:+s.toFixed(3),minEmph:+minEmph.toFixed(3)};
 check(e>=2*n,'emphasis larger '+fg);check(s<=.5*n,'suppressed smaller '+fg);check(minEmph>=.3,'every emphasis large '+fg+' '+minEmph.toFixed(3));
 if(fg){check(patterns.has('overlay')&&patterns.has('counter'),'fg emphasis patterns '+[...patterns]);check(overlayCover>=.5,'overlay covers the foreground '+overlayCover.toFixed(2));}}
// Designed arrangements give the emphasised lyric a larger cell and the suppressed one a smaller cell.
{let bigger=0,smaller=0,count=0;for(let seed=1;seed<=30;seed++){const cuts=J.plan(make(seed,true,false,'{-夜明けの色を/*覚えてる*/ほどけた声が/~遠くで鳴った~-}')).cuts.filter(c=>c.group===0&&Number.isInteger(c.part));
  if(!cuts[0].arrangement)continue;count++;const size=c=>c.area.w*c.area.h,e=cuts.find(c=>c.emphasis),s=cuts.find(c=>c.suppressed),n=cuts.filter(c=>!c.emphasis&&!c.suppressed);
  if(size(e)>Math.max(...n.map(size)))bigger++;if(size(s)<Math.min(...n.map(size)))smaller++;}
 check(count>=25&&bigger>=count*.7&&smaller>=count*.7,`arrangement strength ${bigger}/${smaller}/${count}`);stats.arranged=[bigger,smaller,count];}
return {failures,stats};});
assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);console.log(lang||'ja',JSON.stringify(result.stats));await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
