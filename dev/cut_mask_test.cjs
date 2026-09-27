const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/']){const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());await page.goto(url);
const result=await page.evaluate(()=>{
const failures=[],check=(ok,m)=>{if(!ok)failures.push(m)};
for(const [id,color] of [['bl','#1030ff'],['gr','#10ff30']]){const c=document.createElement('canvas');c.width=160;c.height=90;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,160,90);J.mediaAssets.set(id,{element:c,type:'image'});}
const out=document.createElement('canvas');out.width=320;out.height=180;const ctx=out.getContext('2d'),renderer=new J.Renderer();
const project=(opts={})=>{const p=J.defaultProject();p.lyrics=opts.lyrics||'';p.title='';p.durationOverride=8;p.fx={...p.fx,hud:'off',texture:0,chroma:0,glitch:0,flash:false};
 for(const [layer,id,ov] of [['media','bl',opts.media],['foreground','gr',opts.foreground]]){if(!ov)continue;p[layer]={...p[layer],items:[{id,name:id+'.png',type:'image',width:160,height:90}],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:id,technique:'none',entrance:'none',departure:'none',...ov}}};}
 // The line splits into several automatic cuts; give each the same details.
 if(opts.lyric)p.lyricCutOptions=Object.fromEntries(Array.from({length:8},(_,k)=>['0:'+k,{details:JSON.parse(JSON.stringify(opts.lyric))}]));return p;};
const frame=p=>{const plan=J.plan(p);plan.media=J.planMedia(p,plan,null,'media');plan.foreground=J.planMedia(p,plan,null,'foreground');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,320,180);renderer.frame(ctx,plan,1.5,{scale:320/plan.W,noHud:true});return ctx.getImageData(0,0,320,180).data;};
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
await section.locator('[data-mask-field="enabled"]').check();assert.equal(await section.locator('[data-mask-shape="w"]').inputValue(),'0.6');
await section.locator('[data-mask-add="rect"]').click();
const box=await section.locator('canvas').boundingBox();
const before=+await section.locator('[data-mask-shape="cx"]').inputValue();
await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+box.width*.2,box.y+box.height/2,{steps:4});await page.mouse.up();
const after=+await section.locator('[data-mask-shape="cx"]').inputValue();assert.ok(Math.abs(after-before-.2)<.03,'drag moved '+before+' -> '+after);
await section.locator('[data-mask-field="invert"]').check();await section.locator('[data-mask-field="target"]').selectOption('cut');
assert.ok((await section.locator('.hint').textContent()).startsWith(lang?'Cut:':'カット：'));
await modal.getByRole('button',{name:lang?'Apply':'適用',exact:true}).click();
const saved=await page.evaluate(()=>{const m=J.ui.project.media.cutOverrides[0].details.mask;return {enabled:m.enabled,target:m.target,invert:m.invert,types:m.shapes.map(s=>s.type),plan:!!J.ui.plan.media.cuts[0].mask};});
assert.deepEqual(saved,{enabled:true,target:'cut',invert:true,types:['ellipse','rect'],plan:true});
// Lyric cut details show the mask section with the display-area hint.
await page.locator('#lineList .cut-details-open').first().click();await section.locator('summary').click();
assert.ok((await section.locator('.hint').textContent()).startsWith(lang?'Source: masks the lyric':'素材：表示範囲'));
await modal.getByRole('button',{name:lang?'Cancel':'キャンセル',exact:true}).click();
assert.deepEqual(errors,[]);console.log(lang||'ja','cut mask passed');await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
