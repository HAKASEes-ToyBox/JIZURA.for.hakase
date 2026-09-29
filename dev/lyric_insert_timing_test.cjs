// Adding lyrics mid-song (typing in the lyrics box, or "Insert lyrics" at the playhead) keeps every line's
// cuts on the timeline: no line collapses to a sliver, starts stay ordered, the new line stays findable.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
const LINES=['夜明けの色を覚えてる','ほどけた声が遠くで鳴った','ねえまだ間に合うかな','透明なままじゃ終われない','この歌で夜をこえてく'];
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{for(const lang of ['','en/']){
 const failures=[],check=(ok,m)=>{if(!ok)failures.push(m)};
 const scenario=async(name,setup,act,expect=()=>{})=>{
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());
  await page.goto(url);await page.locator('#modePro').click();
  await page.evaluate(({lines,setup})=>{const P=J.ui.project;P.lyrics=setup.lyrics||lines.join('\n');P.timing.lineTimes={};P.overrides=setup.overrides||{};P.lyricCutOptions={};P.lyricBlankCuts=[];delete P.durationOverride;
   if(setup.tapped)P.lyrics.split('\n').forEach((_,i)=>P.timing.lineTimes[i]=1+i*4);
   J.uiApi.syncUI();J.uiApi.replan();},{lines:LINES,setup});
  await page.waitForTimeout(200);
  await act(page);await page.waitForTimeout(500);
  const r=await page.evaluate(()=>{const P=J.ui.plan,issues=[];
   for(const l of P.lines){const cuts=P.cuts.filter(c=>c.line===l.index&&Number.isInteger(c.part));const dur=cuts.reduce((s,c)=>s+c.end-c.start,0);
    if(!cuts.length)issues.push(`line ${l.index} has no cut`);else if(dur<.3)issues.push(`line ${l.index} only ${dur.toFixed(2)}s`);
    if(l.start>=P.duration-.04)issues.push(`line ${l.index} starts after the end`);}
   for(let i=1;i<P.lines.length;i++)if(P.lines[i].start<P.lines[i-1].start-1e-6)issues.push(`line ${i} starts before line ${i-1}`);
   const lines=P.lines.map(l=>({text:l.text,start:+l.start.toFixed(3)}));
   const cutsOf=text=>{const l=P.lines.find(l=>l.text===text);return l?P.cuts.filter(c=>c.line===l.index&&Number.isInteger(c.part)).map(c=>({start:c.start,end:c.end,text:c.text})):[];};
   return {issues,lines,cuts:Object.fromEntries(P.lines.map(l=>[l.text,cutsOf(l.text)]))};});
  for(const i of r.issues)check(false,`${name}: ${i}`);
  expect(r,(ok,m)=>check(ok,`${name}: ${m}`));
  check(!errors.length,`${name}: page errors ${errors}`);await page.close();};
 const typeAt=async(p,{line,where='end',text,enterFirst=true})=>{await p.evaluate(({line,where})=>{const el=document.getElementById('lyrics'),rows=el.value.split('\n');let pos=0;for(let i=0;i<line;i++)pos+=rows[i].length+1;if(where==='end')pos+=rows[line].length;el.focus();el.setSelectionRange(pos,pos);},{line,where});
  if(enterFirst){await p.keyboard.press('Enter');await p.keyboard.type(text,{delay:10});}else{await p.keyboard.type(text,{delay:10});await p.keyboard.press('Enter');}};
 const insertAt=async(p,t,text)=>{await p.evaluate(t=>{J.uiApi.pause();J.uiApi.seek(t);},t);await p.waitForTimeout(100);await p.locator('[data-playhead-menu="insert"]').click();await p.locator('#insertLyricAtPlayhead').click();await p.locator('#insertCutDialog textarea').fill(text);await p.locator('#insertCutDialog button[type=submit]').click();await p.waitForTimeout(300);};
 const startOf=(r,text)=>r.lines.find(l=>l.text===text)?.start;
 const span=(r,text)=>{const c=r.cuts[text]||[];return c.length?[Math.min(...c.map(x=>x.start)),Math.max(...c.map(x=>x.end))]:[NaN,NaN];};
 // Typing
 await scenario('type new line (auto)',{},p=>typeAt(p,{line:1,text:'新しい行'}),(r,ok)=>ok(startOf(r,'新しい行')>startOf(r,LINES[1])&&startOf(r,'新しい行')<startOf(r,LINES[2]),'between its neighbours'));
 await scenario('type new line (tapped)',{tapped:true},p=>typeAt(p,{line:1,text:'新しい行'}),(r,ok)=>{ok(startOf(r,'新しい行')===7,'midway');ok(startOf(r,LINES[2])===9,'following line kept');});
 await scenario('type then Enter before a line',{tapped:true},p=>typeAt(p,{line:2,where:'start',text:'新しい行',enterFirst:false}));
 await scenario('split a line',{tapped:true},async p=>{await p.evaluate(()=>{const el=document.getElementById('lyrics'),i=el.value.indexOf('遠くで');el.focus();el.setSelectionRange(i,i);});await p.keyboard.press('Enter');});
 // Insert at playhead
 await scenario('insert mid line',{tapped:true},p=>insertAt(p,6.3,'挿入した歌詞'),(r,ok)=>{
  const [s,e]=span(r,'挿入した歌詞');ok(Math.abs(s-6.3)<1e-6&&Math.abs(e-9)<1e-6,`runs to the next line ${s}-${e}`);
  const host=r.cuts[LINES[1]];ok(host.every(c=>c.end<=6.3+1e-6),'previous line ends at the playhead');
  ok(host.map(c=>c.text).join('').includes('鳴った'),'previous line keeps all of its words');});
 await scenario('insert twice in one line',{tapped:true},async p=>{await insertAt(p,5.5,'挿入A');await insertAt(p,7.1,'挿入B');},(r,ok)=>{
  ok(span(r,'挿入A')[1]===7.1&&span(r,'挿入B')[1]===9,'each insert runs to the next line');});
 await scenario('insert at a line start',{tapped:true},p=>insertAt(p,9,'境界に挿入'),(r,ok)=>{ok(startOf(r,'境界に挿入')===9&&startOf(r,LINES[2])===11,'takes the first half of that line');});
 await scenario('insert then retime it',{tapped:true},async p=>{await insertAt(p,6.3,'挿入した歌詞');await p.evaluate(()=>{const i=J.ui.plan.lines.find(l=>l.text==='挿入した歌詞').index;J.ui.project.timing.lineTimes[i]=8;J.uiApi.replan();});},
  (r,ok)=>{const [s,e]=span(r,'挿入した歌詞');ok(s===8&&e===9,'follows its new start');});
 await scenario('insert then type around it',{tapped:true},async p=>{await insertAt(p,6.3,'挿入した歌詞');await typeAt(p,{line:1,text:'その前に入力'});await typeAt(p,{line:3,text:'その後に入力'});},
  (r,ok)=>{for(const t of ['その前に入力','その後に入力']){const c=r.cuts[t];ok(c.length&&c.every((x,i,a)=>!i||x.start>=a[i-1].end-1e-6),t+' cuts stay together');}});
 await scenario('insert in a 1シーン group',{tapped:true,lyrics:['夜明けの色を覚えてる','{','ほどけた声が','遠くで鳴った','}','ねえまだ間に合うかな'].join('\n')},p=>insertAt(p,6.1,'挿入した歌詞'));
 // Projects saved with the old absolute insertion end still work, and stop squeezing the line once retimed.
 await scenario('legacy insertion end',{tapped:true,overrides:{2:{single:true,insertionEnd:10}}},async()=>{},(r,ok)=>{const c=r.cuts[LINES[2]];ok(c.length===1&&c[0].end===10,'kept while valid');});
 await scenario('legacy insertion end after retiming',{tapped:true,overrides:{2:{single:true,insertionEnd:10}}},async p=>{await p.evaluate(()=>{J.ui.project.timing.lineTimes[2]=11;J.uiApi.replan();});},(r,ok)=>{const [s,e]=span(r,LINES[2]);ok(s===11&&e===13,'falls back to line timing '+s+'-'+e);});
 assert.deepEqual(failures,[]);console.log(lang||'ja','lyric insert timing passed');}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
