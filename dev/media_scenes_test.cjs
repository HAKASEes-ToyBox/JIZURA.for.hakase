const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/']){const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());await page.goto(url);
const result=await page.evaluate(()=>{
const MEDIA_GROUP_NAMES=Object.fromEntries(['enter','exit','cinema','dynamic','bpm','texture','graphic','transition'].map(g=>[g,1]));
const failures=[],check=(ok,m)=>{if(!ok)failures.push(m)},keys=J.MEDIA_SCENE_KEYS;
// Transparent source: an opaque rect inside a transparent 160x90 frame.
const source=document.createElement('canvas');source.width=160;source.height=90;const sx=source.getContext('2d');sx.fillStyle='#39c';sx.fillRect(40,20,80,50);sx.fillStyle='#fd4';sx.fillRect(60,30,20,20);
const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');
const base={start:2,end:10,seed:7,bpm:120,beatOffset:.25,enter:'cut',hold:'still',exit:'cut',treat:'none',effectSettings:{motion:1,treatment:1}};
const paint=(cut,p,fade=1,out=1)=>{ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.filter='none';ctx.clearRect(0,0,320,180);ctx.translate(160,90);J.paintMediaEffect(ctx,source,[160,90],cut,p,fade,out);ctx.restore();return ctx.getImageData(0,0,320,180).data;};
const alphaOutside=(d,x0,y0,x1,y1)=>{let n=0;for(let y=0;y<180;y++)for(let x=0;x<320;x++)if((x<x0||x>=x1||y<y0||y>=y1)&&d[(y*320+x)*4+3]>8)n++;return n;};
const visible=d=>d.some((v,i)=>i%4===3&&v>8), same=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<=2);
check(keys.length>=60,'pack size '+keys.length);
for(const key of keys){const def=J.MEDIA_TECH[key];check(!!def,'missing '+key);if(!def)continue;
 check(!!MEDIA_GROUP_NAMES[def.group],key+' group '+def.group);
 if(document.documentElement.lang==='en')check(!/[\u3040-\u30ff\u4e00-\u9fff]/.test(def.name),key+' english name '+def.name);
 else check(/[\u3040-\u30ff\u4e00-\u9fff]/.test(def.name),key+' japanese name '+def.name);}
const still=paint(base,.5);
for(const key of keys){const def=J.MEDIA_TECH[key];
 if(def.stage){const field=def.stage==='enter'?'enter':'exit',cut={...base,[field]:def.motion};
  const done=def.stage==='enter'?paint(cut,.5,1,1):paint(cut,.5,1,1),mid=def.stage==='enter'?paint(cut,.5,.3,1):paint(cut,.5,1,.3);
  check(same(done,still),key+' does not settle');check(!same(mid,still),key+' static phase');continue;}
 if(def.group==='transition')continue;
 const cut={...base,hold:def.hold,treat:def.treat},frames=[.1,.37,.52,.8].map(p=>paint(cut,p));
 frames.forEach((d,i)=>check(visible(d),key+' invisible '+i));
 check(new Set(frames.map(d=>d.join(','))).size>1||def.group==='texture'&&['vignette','cyanotype','thermal','softBloom'].includes(key),key+' static');
 if(def.group==='texture'){for(const d of frames){check(alphaOutside(d,80,45,240,135)===0,key+' paints outside frame');if(key!=='softBloom')check(alphaOutside(d,118,63,202,117)===0,key+' fills transparent area');}}
 if(def.group==='bpm'){for(const time of [2.4,3.1,4.55]){const a=J.mediaBeatState(cut,(time-2)/8,160,90),b=J.mediaBeatState({...cut,start:0,end:20},time/20,160,90);for(const k of Object.keys(a))check(Number.isFinite(a[k])&&Math.abs(a[k]-b[k])<1e-9,key+' beat clock '+k);}}
}
// Transitions composite A/B only: transparent foreground areas get at most thin accent lines, never solid fills.
const A=document.createElement('canvas'),B=document.createElement('canvas');for(const [c,color,x] of [[A,'red',20],[B,'blue',200]]){c.width=320;c.height=180;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(x,40,100,100);}
const st=J.ui.plan.style,coverage={},backdrop={};
// Share of the empty area painted with a colour other than the (possibly moved or dimmed) red/blue content.
const measure=(key,transparent)=>{let worst=0;const P=J.TRANS[key].plan?J.TRANS[key].plan(J.rng(5),st):{};
 for(const p of [.15,.35,.5,.65,.85]){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.clearRect(0,0,320,180);J.TRANS[key].draw(ctx,A,B,p,{cw:320,ch:180,sc:st.schemes[0],scPrev:st.schemes[0],st,P,step:3,t:1,scale:1,allowFilter:true,seed:7,transparent,tmp:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c}});ctx.restore();
  const d=ctx.getImageData(0,0,320,180).data;let n=0,total=0;for(let y=0;y<180;y++)for(let x=0;x<320;x++){if(y>=34&&y<146&&(x>=14&&x<126||x>=194&&x<306))continue;total++;const i=(y*320+x)*4,[r,g,b]=[d[i],d[i+1],d[i+2]];if(d[i+3]>8&&!(r>g+60&&r>b+60)&&!(b>r+60&&b>g+60))n++;}worst=Math.max(worst,n/total);}
 return +worst.toFixed(3);};
for(const key of [...J.MEDIA_TRANS_KEYS,...J.MEDIA_TRANS_EXTRA_KEYS]){coverage[key]=measure(key,true);check(coverage[key]<.2,key+' covers transparent foreground area '+coverage[key]);}
// End to end through J.drawMedia: foreground corners stay clear mid-transition, the background keeps its fill.
J.mediaAssets.set('__ta__',{element:A,type:'image'});J.mediaAssets.set('__tb__',{element:B,type:'image'});
for(const key of ['cover','uncover','zoomThrough','flashCross','blockDissolve'])for(const layer of ['foreground','media']){
 const project=J.defaultProject(),m=project[layer];m.items=[{id:'__ta__',name:'a.png',type:'image',width:320,height:180},{id:'__tb__',name:'b.png',type:'image',width:320,height:180}];m.manualCuts=true;m.cutCount=2;m.timing.lineTimes={0:0,1:3};
 m.effects={...J.mediaEffectSettings(project,layer),autoPlacement:false};m.cutOverrides={0:{itemId:'__ta__',technique:'none'},1:{itemId:'__tb__',technique:'transition_'+key,entrance:'none',departure:'none'}};
 const plan=J.plan(project);plan[layer]=J.planMedia(project,plan,null,layer);const cut=plan[layer].cuts[1];check(cut.trans===key,layer+' planned '+key);
 ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,320,180);J.drawMedia(ctx,plan,cut.start+cut.transDur*.5,{},layer);ctx.restore();
 const d=ctx.getImageData(0,0,320,180).data,corners=[[2,2],[317,2],[2,177],[317,177]].map(([x,y])=>d[(y*320+x)*4+3]);
 check(layer==='foreground'?corners.every(a=>a===0):corners.every(a=>a===255),layer+' '+key+' corners '+corners);}
J.mediaAssets.delete('__ta__');J.mediaAssets.delete('__tb__');
// Background and lyric callers pass no flag: their backdrop fills are unchanged.
for(const key of ['cover','uncover','zoomThrough','flashCross']){backdrop[key]=measure(key,undefined);check(backdrop[key]>.9,key+' lost its backdrop fill '+backdrop[key]);}
// Planning: explicit selections on both layers, explicit-only transitions, unchanged legacy pool.
for(const layer of ['foreground','media'])for(const key of keys){const def=J.MEDIA_TECH[key],project=J.defaultProject(),m=project[layer];
 m.items=[{id:'a',name:'a.png',type:'image',width:160,height:90},{id:'b',name:'b.png',type:'image',width:160,height:90}];m.manualCuts=true;m.cutCount=2;m.timing.lineTimes={0:0,1:3};
 const ov=def.stage==='enter'?{technique:'none',entrance:key,departure:'none'}:def.stage==='exit'?{technique:'none',entrance:'none',departure:key}:{technique:key,entrance:'none',departure:'none'};
 m.cutOverrides={0:{itemId:'a',...ov},1:{itemId:'b',...ov}};const cuts=J.planMedia(project,J.plan(project),null,layer).cuts;
 if(def.stage)check(cuts[0][def.stage==='enter'?'entrance':'departure']===key&&cuts[0][def.stage]===def.motion,layer+' phase '+key);
 else check(cuts[0].technique===key&&cuts[0].hold===def.hold&&cuts[0].treat===def.treat,layer+' technique '+key);
 if(def.group==='transition')check(cuts[1].trans===def.trans,layer+' transition '+key);
 const plan=J.makeEffectPreviewPlan('media',key,layer,'__preview__');check(plan[layer].cuts.length===2,'preview '+layer+' '+key);}
for(let seed=1;seed<=80;seed++){const project=J.defaultProject(),m=project.media;m.seed=seed;m.items=[{id:'a',name:'a.png',type:'image'},{id:'b',name:'b.png',type:'image'}];m.manualCuts=true;m.cutCount=2;m.timing.lineTimes={0:0,1:3};m.cutOverrides={0:{itemId:'a',enter:'fade'},1:{itemId:'b',enter:'fade'}};
 const trans=J.planMedia(project,J.plan(project),null,'media').cuts[1].trans;check(!trans||trans==='crossfade'||J.MEDIA_TRANS_KEYS.includes(trans),'legacy transition '+trans);}
// Themes: every addition reachable, and themed omakase stays inside the theme pool.
const covered=new Set();for(const id of Object.keys(J.THEMES)){const project=J.defaultProject();project.themes=[id];const pool=J.themeCandidates(project,id).media;pool.forEach(k=>covered.add(k));
 for(let seed=1;seed<=8;seed++){const look=J.omakase(project,J.rng(seed));for(const layer of ['foreground','media'])check(Object.entries(look[layer].effects.enabled).every(([k,on])=>!on||pool.includes(k)),id+' outside theme');}}
for(const key of keys)check(covered.has(key),'no theme for '+key);
return {failures:[...new Set(failures)],count:keys.length,coverage,groups:Object.fromEntries(Object.keys(MEDIA_GROUP_NAMES).map(g=>[g,Object.values(J.MEDIA_TECH).filter(d=>d.group===g).length]))};
});
assert.deepEqual(result.failures,[]);
await page.locator('#modePro').click();await page.locator('[data-tab="foregroundFx"]').click();
const dynamic=page.locator('#foregroundEffectsPanel [data-media-group="dynamic"]');assert.equal(await dynamic.locator('.tg-cnt').textContent(),'4/4');
await dynamic.locator('summary').click();assert.equal((await dynamic.locator('[data-media-tech="slamZoom"] + span').textContent()).trim(),lang?'Slam zoom':'スラムズーム');
assert.deepEqual(errors,[]);console.log(lang||'ja',JSON.stringify({count:result.count,groups:result.groups,coverage:result.coverage}));await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
