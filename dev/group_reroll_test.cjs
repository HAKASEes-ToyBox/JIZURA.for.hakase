// Re-rolling one lyric of a {} group (the 個別抽選 dice) keeps the group's placement and re-rolls only that lyric's effects.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const url='http://127.0.0.1:8765/';await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..','index.html'))}):r.abort());await page.goto(url);
const result=await page.evaluate(()=>{
 const T=String.fromCharCode(10),failures=[],stats={},check=(ok,m)=>{if(!ok&&failures.length<30)failures.push(m)};
 const texts=['夜明けの色を覚えてる','ほどけた声が遠くで鳴った','ねえまだ間に合うかな','光る窓をかぞえながら'];
 const variants={plain:['{',''],avoid:['{-','-}']};
 const snap=pl=>pl.cuts.filter(c=>c.line>=0&&Number.isInteger(c.part)).map(c=>({line:c.line,area:c.area&&[c.area.x,c.area.y,c.area.w,c.area.h].map(v=>+v.toFixed(4)).join(),fx:[c.layout,c.enter,c.hold,c.cam,c.treat,c.decor.map(d=>d.id).join('+')].join('/'),exit:c.exit}));
 for(const [name,[open,close]] of Object.entries(variants))for(const balance of ['lively','unified']){
  let selfChanged=0,total=0,otherFx=0,areaMoved=0;
  for(let seed=1;seed<=10;seed++)for(const line of [1,2,3,4]){
   const P=J.defaultProject();P.seed=seed;P.themeBalance=balance;P.durationOverride=20;
   P.lyrics=['[00:00]前の歌詞',open,...texts.map((t,i)=>`[00:${String(3+i*3).padStart(2,'0')}]${t}`),close,'[00:16]後ろの歌詞です'].filter(x=>x!=='').join(T);
   const a=snap(J.plan(P));P.overrides={[line]:{seed:1}};const b=snap(J.plan(P));
   a.forEach((x,i)=>{const y=b[i];if(x.line!==y.line)return;
    if(x.area!==y.area)areaMoved++;
    if(x.line===line){total++;if(x.fx!==y.fx)selfChanged++;}
    else if(x.fx!==y.fx)otherFx++;});
  }
  stats[name+' '+balance]={selfChanged,total,otherFx,areaMoved};
  check(areaMoved===0,name+' '+balance+': placement moved '+areaMoved);
  check(otherFx===0,name+' '+balance+': other lyrics changed effects '+otherFx);
  check(selfChanged>=total*.7,name+' '+balance+': the lyric itself is re-rolled '+selfChanged+'/'+total);
 }
 // locking one lyric of a group (also one that was re-rolled) changes neither the placement nor the effects of the others
 for(const [name,[open,close]] of Object.entries(variants))for(const balance of ['lively','unified']){
  let moved=0,changed=0;
  for(const rerolled of [false,true])for(let seed=1;seed<=8;seed++)for(const line of [1,2,3]){
   const P=J.defaultProject();P.seed=seed;P.themeBalance=balance;P.durationOverride=20;
   P.lyrics=['[00:00]前の歌詞',open,...texts.map((t,i)=>`[00:${String(3+i*3).padStart(2,'0')}]${t}`),close,'[00:16]後ろの歌詞です'].filter(x=>x!=='').join(T);
   const sd=rerolled?{seed:1}:{};if(rerolled)P.overrides={[line]:sd};
   const pl=J.plan(P),a=snap(pl),ln=pl.lines[line],cuts=pl.cuts.filter(c=>c.line===line&&Number.isInteger(c.part));
   P.overrides={[line]:{...sd,lock:true,lockedSeed:ln.seed,lockedAreas:Object.fromEntries(cuts.map(c=>[c.part,c.area||null])),lockedComposites:Object.fromEntries(cuts.map(c=>[c.part,{blend:c.blend,opacity:c.opacity}])),lockedEffects:Object.fromEntries(cuts.map(c=>[c.part,J.cutLockSnapshot(c,'lyrics',pl)])),lockedUnits:{text:ln.text,groups:cuts.filter(c=>!c.recap).map(c=>c.text),recap:cuts.some(c=>c.recap)}}};
   const b=snap(J.plan(P));a.forEach((x,i)=>{if(x.line===line)return;if(x.area!==b[i].area)moved++;if(x.fx!==b[i].fx)changed++;});
  }
  check(moved===0&&changed===0,'lock '+name+' '+balance+': placement moved '+moved+', effects changed '+changed);
 }
 // the ordinary (non-group) reroll and unrelated overrides are untouched
 {const P=J.defaultProject();P.seed=4;P.durationOverride=20;P.lyrics=['[00:00]一行目','[00:03]二行目','[00:06]三行目'].join(T);
  const a=snap(J.plan(P));P.overrides={1:{seed:1}};const b=snap(J.plan(P));check(a[1].fx!==b[1].fx||a[1].area!==b[1].area,'a plain line still re-rolls');}
 return {failures,stats};
});
console.log(JSON.stringify(result.stats));assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);await page.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
