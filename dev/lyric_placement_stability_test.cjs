const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const locale of ['', 'en/']){
 const p=await b.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(locale+'index.html')}));await p.goto('http://test/');
 const fixture=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2],'utf8')):null;
 const result=await p.evaluate(fixture=>{
  const failures=[],check=(a,b,name)=>{if(JSON.stringify(a)!==JSON.stringify(b))failures.push(name)};
  const fields=['layout','enter','exit','hold','inDur','outDur','decor','scheme','seed','treat','treatP','bg','bgP','cam','camP','trans','transP','transDur','stagger','groupExit','groupOutDur'];
  const run=(q,line)=>{const audio={duration:q.durationOverride||200},before=J.plan(q,audio),source=before.cuts.find(c=>c.line===line),area=source.area||{x:0,y:0,w:1,h:1};
   for(const resize of [false,true]){const edited=structuredClone(q);edited.overrides[line]={...edited.overrides[line],lock:false,area:{...area,x:area.x+.08,y:area.y-.06,w:area.w*(resize?.8:1),h:area.h*(resize?.8:1)}};
    const after=J.plan(edited,audio);
    for(const cut of before.cuts.filter(c=>c.line>=0&&Number.isInteger(c.part))){const next=after.cuts.find(c=>c.line===cut.line&&c.part===cut.part);for(const key of fields)check(cut[key],next?.[key],line+':'+cut.line+':'+key);if(cut.line===line&&!resize)check(cut.params,next.params,'move preserves params '+line);}
   }
  };
  for(const style of ['noir','pop','neon'])for(let seed=1;seed<=8;seed++){
   const q=J.defaultProject();q.style=style;q.seed=seed;q.lyrics='[00:00]{\nI don’t know 愛/\nDon’t know why/\n}\n[00:06]次の歌詞の演出も維持する';q.durationOverride=12;q.overrides={};
   run(q,0);run(q,1);
  }
  if(fixture){const pl=J.plan(fixture,{duration:fixture.durationOverride||200}),cut=pl.cuts.find(c=>c.start<=53&&c.end>53&&c.text.includes('know'));if(!cut)failures.push('user cut missing');else {run(fixture,cut.line);const next=pl.cuts.find(c=>c.line===cut.line+1);if(next)run(fixture,next.line);}}
  return failures;
 },fixture);
 assert.deepEqual(result,[]);console.log(locale||'ja','unlocked placement preserves effect choices and movement preserves layout variants',fixture?'including user project':'');await p.close();
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
