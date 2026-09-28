const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/']){const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());await page.goto(url);
const result=await page.evaluate(()=>{
const failures=[],check=(ok,m)=>{if(!ok)failures.push(m)};
for(const [id,color] of [['bl','#1030ff'],['gr','#10ff30']]){const c=document.createElement('canvas');c.width=160;c.height=90;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,160,90);J.mediaAssets.set(id,{element:c,type:'image'});}
const out=document.createElement('canvas');out.width=320;out.height=180;const ctx=out.getContext('2d'),renderer=new J.Renderer();
const project=(opts={})=>{const p=J.defaultProject();p.lyrics=opts.lyrics||'';p.title='';p.durationOverride=8;p.lyricEffects={...p.lyricEffects,autoPlacement:false};p.overrides={0:{single:true,layout:'center'}};// one full-stage, centred cut
p.fx={...p.fx,hud:'off',texture:0,chroma:0,glitch:0,flash:false};
 for(const [layer,id,ov] of [['media','bl',opts.media],['foreground','gr',opts.foreground]]){if(!ov)continue;p[layer]={...p[layer],items:[{id,name:id+'.png',type:'image',width:160,height:90}],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:id,technique:'none',entrance:'none',departure:'none',...ov}}};}
 // The line splits into several automatic cuts; give each the same details.
 if(opts.lyric)p.lyricCutOptions=Object.fromEntries(Array.from({length:8},(_,k)=>['0:'+k,{details:JSON.parse(JSON.stringify(opts.lyric))}]));return p;};
const frame=(p,t=1.5)=>{const plan=J.plan(p);plan.media=J.planMedia(p,plan,null,'media');plan.foreground=J.planMedia(p,plan,null,'foreground');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,320,180);renderer.frame(ctx,plan,t,{scale:320/plan.W,noHud:true});return ctx.getImageData(0,0,320,180).data;};
const at=(d,u,v)=>{const i=(Math.round(v*179)*320+Math.round(u*319))*4;return [d[i],d[i+1],d[i+2]];};
const blue=px=>px[2]>200&&px[0]<80,green=px=>px[1]>200&&px[0]<80&&px[2]<120;
const mask=(target,shapes,invert=false)=>({mask:{enabled:true,target,invert,shapes}});
const ellipse=(cx,cy,w,h)=>({type:'ellipse',cx,cy,w,h,angle:0});
// Media "source" vs "cut": the image sits on the left half; the same ellipse lands in different places.
const left={placement:{cx:.25,cy:.5,w:.5,h:.5,angle:0,lockAspect:true}};
let d=frame(project({media:{...left,details:mask('source',[ellipse(.5,.5,.3,.3)])}}));
check(blue(at(d,.25,.5))&&!blue(at(d,.1,.5))&&!blue(at(d,.45,.5)),'media source mask follows the image');
d=frame(project({media:{...left,details:mask('cut',[ellipse(.5,.5,.3,.3)])}}));
check(!blue(at(d,.25,.5))&&blue(at(d,.4,.5))&&!blue(at(d,.6,.5)),'media cut mask uses the stage');
d=frame(project({media:{details:mask('source',[ellipse(.5,.5,.5,.5)],true)}}));
check(!blue(at(d,.5,.5))&&blue(at(d,.03,.05)),'inverted source mask');
// Union: overlapping rectangles leave no hole.
d=frame(project({media:{details:mask('cut',[{type:'rect',cx:.4,cy:.5,w:.3,h:.3,angle:0},{type:'rect',cx:.55,cy:.5,w:.3,h:.3,angle:0}])}}));
check(blue(at(d,.3,.5))&&blue(at(d,.47,.5))&&blue(at(d,.65,.5))&&!blue(at(d,.85,.5)),'union of shapes');
d=frame(project({media:{details:mask('cut',[{type:'rect',cx:.4,cy:.5,w:.3,h:.3,angle:0},{type:'rect',cx:.55,cy:.5,w:.3,h:.3,angle:0}],true)}}));
check(!blue(at(d,.47,.5))&&blue(at(d,.85,.5)),'inverted union');
// Foreground: masked-out areas show the layers below.
d=frame(project({media:{},foreground:{details:mask('cut',[ellipse(.5,.5,.4,.4)])}}));
check(green(at(d,.5,.5))&&blue(at(d,.05,.5)),'foreground mask reveals background');
d=frame(project({media:{},foreground:{details:mask('source',[ellipse(.5,.5,.4,.4)],true)}}));
check(blue(at(d,.5,.5))&&green(at(d,.05,.5)),'foreground inverted source mask');
// Disabled or empty masks change nothing.
const plainMedia=frame(project({media:{}}));
check(frame(project({media:{details:{mask:{enabled:false,target:'cut',shapes:[ellipse(.5,.5,.1,.1)]}}}})).every((v,i)=>v===plainMedia[i]),'disabled mask');
check(frame(project({media:{details:{mask:{enabled:true,target:'cut',shapes:[]}}}})).every((v,i)=>v===plainMedia[i]),'empty mask');
// Lyrics: "cut" masks the finished cut in stage units; "source" masks within the display area.
const bright=(d,u0,u1)=>{let n=0;for(let y=0;y<180;y++)for(let x=Math.round(u0*320);x<Math.round(u1*320);x++){const i=(y*320+x)*4;if(d[i]>150&&d[i+1]>150&&d[i+2]>150)n++;}return n;};
const lyrics='[00:00]マスクの確認用の長い歌詞です\n[00:04]二行目';
const leftHalf=[{type:'rect',cx:.25,cy:.5,w:.5,h:1,angle:0}];
const plain=frame(project({lyrics}));check(bright(plain,0,.45)>20&&bright(plain,.6,1)>20,'lyric fixture visible '+bright(plain,0,.45)+'/'+bright(plain,.6,1));
for(const target of ['cut','source']){
 d=frame(project({lyrics,lyric:mask(target,leftHalf)}));check(bright(d,.6,1)===0&&bright(d,0,.4)>20,'lyric '+target+' mask');
 d=frame(project({lyrics,lyric:mask(target,leftHalf,true)}));check(bright(d,0,.4)===0&&bright(d,.6,1)>20,'lyric '+target+' inverted');
}
// A source mask sits in the display area: moving the area moves the visible part.
d=frame(project({lyrics,lyric:{area:{x:.5,y:0,w:.5,h:1,angle:0,lockAspect:false},...mask('source',leftHalf)}}));
check(bright(d,0,.45)===0&&bright(d,.5,.74)>0&&bright(d,.78,1)===0,'lyric source mask follows the display area');
// Every shape type masks its centre in and the stage corners out.
for(const type of J.MASK_SHAPES){d=frame(project({media:{details:mask('cut',[{type,cx:.5,cy:.5,w:.5,h:.6,angle:15}])}}));check(blue(at(d,.5,.5))&&!blue(at(d,.03,.05))&&!blue(at(d,.97,.95)),'shape '+type);}
check(J.normalizeMask({shapes:[{type:'star',cx:.5,cy:.5,w:.2,h:.2}]}).shapes[0].lockAspect===true&&J.normalizeMask({shapes:[{type:'bogus',w:.2,h:.2}]}).shapes.length===0,'normalize shapes');
// Mask motion: off by default, only moving / revealing techniques, timed over the cut.
{const n=J.normalizeMask({shapes:[ellipse(.5,.5,.2,.2)]}).motion;check(n.technique==='none'&&n.entrance==='none'&&n.departure==='none'&&n.amount===1&&n.duration===.45,'motion defaults');
 const bad=J.normalizeMaskMotion({technique:'vignette',entrance:'exit_fade',departure:'enter_fade',amount:9});check(bad.technique==='none'&&bad.entrance==='none'&&bad.departure==='none'&&bad.amount===2,'motion validation');
 check(J.normalizeMaskMotion({technique:'cam_orbitDrift'}).technique==='cam_orbitDrift'&&J.normalizeMaskMotion({technique:'beatJelly'}).technique==='beatJelly','motion techniques');}
const moving=(target,motion,shapes=[ellipse(.5,.5,.3,.3)])=>({mask:{enabled:true,target,invert:false,shapes,motion}});
for(const target of ['cut','source']){
 const roll=project({media:{details:moving(target,{technique:'rollAcross'})}}),early=frame(roll,.8),late=frame(roll,7.2);
 check(blue(at(early,.28,.5))&&!blue(at(early,.72,.5))&&blue(at(late,.72,.5))&&!blue(at(late,.28,.5)),'rolling mask '+target);
 const slide=project({media:{details:moving(target,{entrance:'enter_slide'})}});
 check(!blue(at(frame(slide,.05),.5,.5))&&blue(at(frame(slide,4),.5,.5)),'sliding entrance '+target);
 const fadeIn=frame(project({media:{details:moving(target,{entrance:'enter_fade'})}}),.12),mid=at(fadeIn,.5,.5);
 check(mid[2]>30&&mid[2]<220,'fading mask '+target+' '+mid);
}
{const still=frame(project({media:{details:moving('cut',{technique:'none'})}}),.8),none=frame(project({media:{details:mask('cut',[ellipse(.5,.5,.3,.3)])}}),.8);
 check(still.every((v,i)=>v===none[i]),'no motion = static mask');}
// Regression: a reveal entrance at its first frame (empty clip) must not leave the mask empty afterwards.
{const staticMask=frame(project({media:{details:mask('cut',[ellipse(.5,.5,.3,.3)])}}),3);
 for(const entrance of ['iris','wipe','diamond']){frame(project({media:{details:moving('cut',{entrance})}}),0.001);
  const after=frame(project({media:{details:moving('cut',{entrance:'none'})}}),3);check(after.every((v,i)=>v===staticMask[i]),'no leftover clip after '+entrance);
  const done=frame(project({media:{details:moving('cut',{entrance})}}),3);check(blue(at(done,.5,.5)),'reveal finished '+entrance);}}
{const lyr=project({lyrics,lyric:moving('cut',{entrance:'enter_slide'},leftHalf)});check(bright(frame(lyr,.03),0,.45)!==bright(frame(lyr,.5),0,.45),'lyric mask motion');}
// Effect paste keeps the target's own mask.
{const p=project({media:{details:mask('cut',[ellipse(.5,.5,.2,.2)])}}),plan=J.plan(p);plan.media=J.planMedia(p,plan,null,'media');
 const payload=J.readCutEffects(JSON.stringify(J.cutEffectsPayload({...plan.media.cuts[0],mask:undefined,technique:'kenBurns'},'media',plan)));
 check(payload.details.mask===undefined,'mask not in payload');J.pasteCutEffects(p,plan,'media',plan.media.cuts[0],payload);
 check(p.media.cutOverrides[0].details.mask?.shapes?.length===1,'mask kept on paste');}
return failures;});
assert.deepEqual(result,[]);
// Editor: enable (adds a circle), add a rectangle, drag it, invert, switch target, apply.
await page.locator('#modePro').click();
await page.evaluate(()=>{const p=J.ui.project;const c=document.createElement('canvas');c.width=160;c.height=90;c.getContext('2d').fillStyle='#e33';c.getContext('2d').fillRect(0,0,160,90);J.mediaAssets.set('mk',{element:c,type:'image'});
 p.media={...p.media,items:[{id:'mk',name:'mk.png',type:'image',width:160,height:90}],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:'mk',technique:'none'}}};J.uiApi.syncUI();J.uiApi.replan();});
await page.locator('#timelineLinks [data-action="details"][data-layer="media"]').first().dispatchEvent('pointerdown',{button:0});
const modal=page.locator('#cutDetailsDialog'),section=modal.locator('[data-detail-section="mask"]');
assert.equal((await section.locator('summary').textContent()),lang?'Mask':'マスク');assert.equal(await section.evaluate(el=>el.open),false);
await section.locator('summary').click();
assert.equal(await section.locator('[data-mask-field="target"] option').allTextContents().then(x=>x.join('/')),lang?'Source/Cut':'素材/カット');
await section.locator('[data-mask-field="enabled"]').check();
// The first circle is round on screen: width × frame aspect = height.
const first=await page.evaluate(()=>{const c=document.querySelector('#cutDetailsDialog .cut-mask-canvas');return {w:+document.querySelector('[data-mask-shape="w"]').value,h:+document.querySelector('[data-mask-shape="h"]').value,aspect:c.width/c.height};});
assert.ok(Math.abs(first.w*first.aspect-first.h)<.01,'round circle '+JSON.stringify(first));
// "Add shape…" adds without touching the selected shape; the Shape field changes the selected one.
const names=lang?'Circle/Rectangle/Rounded rectangle/Triangle/Diamond/Pentagon/Hexagon/Star/Heart':'円/四角/角丸四角/三角/ひし形/五角形/六角形/星/ハート';
assert.equal((await section.locator('[data-mask-add] option').allTextContents()).slice(1).join('/'),names);
assert.equal((await section.locator('[data-mask-shape="type"] option').allTextContents()).join('/'),names);
await section.locator('[data-mask-add]').selectOption('star');assert.equal(await section.locator('[data-mask-add]').inputValue(),'');
assert.equal(await section.locator('[data-mask-shape="type"]').inputValue(),'star');
await section.locator('[data-mask-shape="type"]').selectOption('rect');
await section.locator('canvas').evaluate(el=>el.scrollIntoView({block:'center'}));// clear of the sticky action bar
const box=await section.locator('canvas').boundingBox();
const before=+await section.locator('[data-mask-shape="cx"]').inputValue();
await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+box.width*.2,box.y+box.height/2,{steps:4});await page.mouse.up();
const after=+await section.locator('[data-mask-shape="cx"]').inputValue();assert.ok(Math.abs(after-before-.2)<.03,'drag moved '+before+' -> '+after);
// Lock aspect (default on): width edits scale height; off: independent.
assert.equal(await section.locator('[data-mask-shape="lockAspect"]').isChecked(),true);
let ratio=+await section.locator('[data-mask-shape="h"]').inputValue()/ +await section.locator('[data-mask-shape="w"]').inputValue();
await section.locator('[data-mask-shape="w"]').fill('0.2');await section.locator('[data-mask-shape="w"]').dispatchEvent('change');
assert.ok(Math.abs(+await section.locator('[data-mask-shape="h"]').inputValue()-.2*ratio)<.002,'locked width edit');
// Resizing by the corner handle keeps the ratio too.
const shape=async()=>page.evaluate(()=>{const g=k=>+document.querySelector(`[data-mask-shape="${k}"]`).value;return {cx:g('cx'),cy:g('cy'),w:g('w'),h:g('h'),angle:g('angle')};});
let s=await shape();const cb=await section.locator('canvas').boundingBox(),toPage=(u,v)=>[cb.x+u*cb.width,cb.y+v*cb.height];
const rad=s.angle*Math.PI/180,hx=s.cx+(s.w/2*Math.cos(rad)*cb.width-s.h/2*Math.sin(rad)*cb.height)/cb.width,hy=s.cy+(s.w/2*Math.sin(rad)*cb.width+s.h/2*Math.cos(rad)*cb.height)/cb.height;
await page.mouse.move(...toPage(hx,hy));await page.mouse.down();await page.mouse.move(...toPage(hx+.08,hy+.02),{steps:4});await page.mouse.up();
let t=await shape();assert.ok(t.w>s.w*1.2&&Math.abs(t.h/t.w-s.h/s.w)<.01,'locked handle resize '+JSON.stringify([s,t]));
// Dragging around the shape rotates it (rotation cursor on hover); Shift snaps to 15°.
s=t;const ring=[s.cx+(s.w/2*cb.width+14)/cb.width,s.cy];await page.mouse.move(...toPage(...ring));
assert.equal(await section.locator('canvas').evaluate(c=>c.style.cursor),'var(--rotate-cursor)');
await page.mouse.down();await page.mouse.move(...toPage(s.cx,s.cy+(s.w/2*cb.width+14)/cb.height),{steps:8});await page.mouse.up();
t=await shape();assert.ok(Math.abs(t.angle-s.angle-90)<3,'rotated '+s.angle+' -> '+t.angle);assert.deepEqual([t.cx,t.cy,t.w,t.h],[s.cx,s.cy,s.w,s.h]);
await section.locator('[data-mask-shape="lockAspect"]').uncheck();const hBefore=+await section.locator('[data-mask-shape="h"]').inputValue();
await section.locator('[data-mask-shape="w"]').fill('0.3');await section.locator('[data-mask-shape="w"]').dispatchEvent('change');
assert.equal(+await section.locator('[data-mask-shape="h"]').inputValue(),hBefore);
// Motion: all None at first; pick a technique, an entrance (a reveal shape) and an exit.
assert.equal(await section.locator('.cut-mask-motion h4').textContent(),lang?'Mask motion':'マスクのモーション');
assert.deepEqual(await section.locator('select[data-mask-motion]').evaluateAll(els=>els.map(e=>e.value)),['none','none','none']);
await section.locator('[data-mask-motion="technique"]').selectOption('rollAcross');await section.locator('[data-mask-motion="entrance"]').selectOption('iris');await section.locator('[data-mask-motion="departure"]').selectOption('exit_fade');
await section.locator('[data-mask-motion="duration"]').fill('0.8');await section.locator('[data-mask-motion="duration"]').dispatchEvent('change');
await section.locator('[data-mask-field="invert"]').check();await section.locator('[data-mask-field="target"]').selectOption('cut');
assert.ok((await section.locator('.cut-mask-hint').textContent()).startsWith(lang?'Cut:':'カット：'));
await modal.getByRole('button',{name:lang?'Apply':'適用',exact:true}).click();
const saved=await page.evaluate(()=>{const m=J.ui.project.media.cutOverrides[0].details.mask;return {enabled:m.enabled,target:m.target,invert:m.invert,types:m.shapes.map(s=>s.type),plan:!!J.ui.plan.media.cuts[0].mask};});
assert.deepEqual(saved,{enabled:true,target:'cut',invert:true,types:['ellipse','rect'],plan:true});
assert.equal(await page.evaluate(()=>J.ui.project.media.cutOverrides[0].details.mask.shapes[1].lockAspect),false);
assert.deepEqual(await page.evaluate(()=>J.ui.project.media.cutOverrides[0].details.mask.motion),{technique:'rollAcross',entrance:'iris',departure:'exit_fade',amount:1,duration:.8});
// Setting a reveal entrance and back to None, with the default circle's un-rounded size, still applies and shows the source.
await page.evaluate(()=>{delete J.ui.project.media.cutOverrides[0].details.mask;J.uiApi.replan();});
await page.locator('#timelineLinks [data-action="details"][data-layer="media"]').first().dispatchEvent('pointerdown',{button:0});
await section.locator('summary').click();await section.locator('[data-mask-field="enabled"]').check();
await section.locator('[data-mask-motion="entrance"]').selectOption('iris');await page.waitForTimeout(400);await section.locator('[data-mask-motion="entrance"]').selectOption('none');
assert.equal(await modal.locator('form').evaluate(f=>f.checkValidity()),true);
await modal.getByRole('button',{name:lang?'Apply':'適用',exact:true}).click();await modal.waitFor({state:'detached'});
const shown=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');new J.Renderer().frame(x,J.ui.plan,3,{scale:320/J.ui.plan.W,noHud:true,noLyrics:true});const d=x.getImageData(0,0,320,180).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>180&&d[i+1]<90&&d[i+2]<90)n++;return {entrance:J.ui.project.media.cutOverrides[0].details.mask.motion.entrance,red:n/(d.length/4)};});
assert.equal(shown.entrance,'none');assert.ok(shown.red>.05,'source visible after reveal reset '+JSON.stringify(shown));
// Lyric cut details show the mask section with the display-area hint.
await page.locator('#lineList .cut-details-open').first().click();await section.locator('summary').click();
assert.ok((await section.locator('.cut-mask-hint').textContent()).startsWith(lang?'Source: masks the lyric':'素材：表示範囲'));
await modal.getByRole('button',{name:lang?'Cancel':'キャンセル',exact:true}).click();
assert.deepEqual(errors,[]);console.log(lang||'ja','cut mask passed');await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
