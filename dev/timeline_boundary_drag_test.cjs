const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
for(const lang of ['','en/']){
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>r.request().url()==='http://localhost:8765/'?r.fulfill({contentType:'text/html',body:fs.readFileSync(lang+'index.html')}):r.abort());await page.goto('http://localhost:8765/');
async function setup(times){await page.evaluate(times=>{const p=J.ui.project;p.lyrics='First\nSecond\nThird';p.durationOverride=10;p.timing.lineTimes=Object.fromEntries(times.map((t,i)=>[i,t]));p.timing.cutTimes={};p.overrides={0:{single:true},1:{single:true},2:{single:true}};J.uiApi.syncUI();J.uiApi.replan();},times);}
async function drag(line,time){const pos=await page.evaluate(line=>{const c=document.getElementById('timeline'),r=c.getBoundingClientRect(),cut=J.ui.plan.cuts.find(c=>c.line===line&&c.part===0);return {x:r.x+cut.start/J.ui.plan.duration*r.width,y:r.bottom-5,left:r.left,width:r.width,duration:J.ui.plan.duration};},line);await page.mouse.move(pos.x,pos.y);await page.mouse.down();await page.mouse.move(pos.left+time/pos.duration*pos.width,pos.y,{steps:8});await page.mouse.up();const actual=await page.evaluate(line=>J.ui.plan.lines[line].start,line);assert.ok(Math.abs(actual-time)<.02,`${lang} line ${line}: expected ${time}, got ${actual}`);}
// Short adjacent lines previously produced max < min, making the boundary ungrabbable.
await setup([0,.2,.4]);await drag(1,.1);
// Imported/out-of-order lines must use chronological neighbours, not source index.
await setup([0,6,3]);await drag(1,4);
// Explicit adjacent internal timings survive planning (the next natural boundary was used before).
await page.evaluate(()=>{const p=J.ui.project;p.lyrics='AA/BB/CC';p.overrides={};p.timing.lineTimes={0:0};p.timing.cutTimes={'0:1':1.6,'0:2':1.9};J.uiApi.syncUI();J.uiApi.replan();});
const cuts=await page.evaluate(()=>J.ui.plan.cuts.filter(c=>c.line===0&&Number.isInteger(c.part)).map(c=>c.start));assert.ok(Math.abs(cuts[1]-1.6)<.01,JSON.stringify(cuts));assert.ok(Math.abs(cuts[2]-1.9)<.01,JSON.stringify(cuts));
await setup([0,4,8]);
await page.evaluate(()=>{const p=J.ui.project;for(const layer of ['foreground','media']){p[layer].manualCuts=true;p[layer].cutCount=3;p[layer].timing.lineTimes={0:0,1:4,2:8};}p.timelineLinks=[{a:'l:1:0',b:'f:1'},{a:'f:1',b:'m:1'}];J.uiApi.replan();});
await drag(1,2);
assert.deepEqual(await page.evaluate(()=>[J.ui.plan.foreground.cuts[1].start,J.ui.plan.media.cuts[1].start]),[2,2]);
assert.deepEqual(errors,[]);console.log(lang||'ja','boundary drag passed');await page.close();}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});


