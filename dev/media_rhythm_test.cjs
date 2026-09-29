const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/']){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(lang+'index.html')}):r.abort());await page.goto(url);
const result=await page.evaluate(()=>{
const keys=[...J.MEDIA_RHYTHM_KEYS,...Object.values(J.mediaBpmHoldAliases)], failures=[];
const source=document.createElement('canvas');source.width=160;source.height=90;const x=source.getContext('2d');x.fillStyle='cyan';x.fillRect(20,20,90,40);
const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');
for(const hold of keys){const cut={start:0,end:8,hold,bpm:120,beatOffset:.25,seed:7,enter:'cut',exit:'cut',treat:'none',effectSettings:{motion:1,treatment:1}};
const state=(c,time)=>J.mediaBeatState(c,(time-c.start)/(c.end-c.start),160,90);
const samples=[.25,.33,.51,.75,1.2,1.8,2.9].map(time=>state(cut,time));
if(samples.some(s=>Object.values(s).some(v=>!Number.isFinite(v))))failures.push(hold+' nonfinite');
if(new Set(samples.map(JSON.stringify)).size<2)failures.push(hold+' static');
for(const time of [.33,.51,1.2]){
 const a=state(cut,time),b=state({...cut,start:-2,end:20},time),c=state({...cut,bpm:60,beatOffset:.5},time*2);
 for(const k of Object.keys(a))if(Math.abs(a[k]-b[k])>1e-9||Math.abs(a[k]-c[k])>1e-9)failures.push(hold+' timing '+k);
 ctx.save();ctx.clearRect(0,0,320,180);ctx.translate(160,90);J.paintMediaEffect(ctx,source,[160,90],cut,time/8,1,1);ctx.restore();
 if(!ctx.getImageData(0,0,320,180).data.some((v,i)=>i%4===3&&v))failures.push(hold+' invisible');
}
}
for(const layer of ['foreground','media']){const project=J.defaultProject();project[layer].manualCuts=true;project[layer].cutCount=1;project[layer].cutOverrides={0:{technique:'beatSquash',entrance:'none',departure:'none'}};project.timing.bpm=null;const cut=J.planMedia(project,J.plan(project),null,layer).cuts[0];if(cut.bpm!==120||cut.hold!=='beatSquash')failures.push(layer+' default tempo');}
const covered=new Set();
for(const key of Object.keys(J.THEMES)) {
 const project=J.defaultProject();project.themes=[key];
 const pool=J.themeCandidates(project,key).media;pool.forEach(id=>covered.add(id));
 const look=J.omakase(project,()=>.1);
 for(const layer of ['foreground','media']) {
  const enabled=Object.entries(look[layer].effects.enabled).filter(([,on])=>on).map(([id])=>id);
  if(enabled.some(id=>!pool.includes(id)))failures.push(key+' outside theme');
  for(const id of pool.filter(id=>J.MEDIA_RHYTHM_KEYS.includes(id)))if(!enabled.includes(id))failures.push(key+' missing '+id);
 }
}
for(const id of J.MEDIA_RHYTHM_KEYS)if(!covered.has(id))failures.push('No theme for '+id);
return {failures,count:keys.length,migrated:Object.values(J.MEDIA_TECH).filter(d=>d.group==='bpm'&&d.hold.startsWith('sync_')).length};
});assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);console.log(lang||'ja',result);await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
