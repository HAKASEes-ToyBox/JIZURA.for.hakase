const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {timelineAction}=require('./ui_helpers.cjs');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const locale of ['', 'en/']){
 const page=await b.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(locale+'index.html')}));await page.goto('http://test/');
 await page.evaluate(()=>{const p=J.defaultProject();p.lyrics='[00:00]プレビュー|ルビ';p.durationOverride=8;p.overrides={0:{single:true,layout:'center'}};
  for(const layer of ['foreground','media'])Object.assign(p[layer],{items:[{id:layer+'asset',type:'image',name:'Image',width:200,height:100}],manualCuts:true,cutCount:1,cutOverrides:{0:{technique:'none',entrance:'none',departure:'none'}}});
  J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();window.drawingSource=document.createElement('canvas');drawingSource.width=200;drawingSource.height=100;drawingSource.getContext('2d').fillStyle='#ff0000';drawingSource.getContext('2d').fillRect(0,0,200,100);
 });
 const dialog=page.locator('#cutDetailsDialog');
 const field=path=>dialog.locator(`[data-detail-field="${path}"]`);
 const edit=async(path,value)=>{await field(path).fill(String(value));await field(path).dispatchEvent('change');};
 const show=async(path)=>{await dialog.locator(`[data-detail-section="${path}"] > summary`).click();};
 await timelineAction(page,'[data-layer=lyrics]','details');await dialog.locator('[data-detail-tab=style]').click();
 for(const path of ['fonts','palette','effectStyle'])assert.equal(await dialog.locator(`[data-detail-section=${path}]`).count(),1,'default '+path+' is visible');
 assert.equal(await dialog.locator('[data-detail-section=fontParams]').count(),0,'internal font pointers are not editable fields');
 await show('palette');await field('palette.fg').fill('#ff00ff');await field('palette.fg').dispatchEvent('change');
 await show('fonts');await show('fonts.display');assert.equal(await field('fonts.display.0').evaluate(x=>x.tagName),'SELECT');
 for(const f of await dialog.locator('[data-detail-section="fonts.display"] select').all())await f.selectOption('mono');
 await show('effectStyle');assert.equal(await dialog.locator('[data-detail-field="effectStyle.name"]').count(),0,'non-render style metadata is excluded');await edit('effectStyle.glow',0);
 await dialog.locator('[data-detail-tab=effects]').click();await show('effectFx');await edit('effectFx.texture',0);await edit('effectFx.koma',0);
 assert.equal(await field('effectFx.bgSwitch').count(),0,'planner-only knob is not a misleading per-cut control');
 await dialog.locator('[data-detail-tab=basic]').click();await edit('note','変更したルビ');
 await dialog.locator('button[type=submit]').click();
 let result=await page.evaluate(()=>{const c=J.ui.plan.cuts.find(c=>c.line===0);return {palette:c.palette.fg,note:c.note,glow:c.effectStyle.glow,fonts:c.fonts.display,texture:c.effectFx.texture,koma:c.effectFx.koma,params:J.cutFontParams(c.params)}});
 assert.equal(result.palette,'#ff00ff');assert.equal(result.note,'変更したルビ');assert.equal(result.glow,0);assert.ok(result.fonts.every(x=>x==='mono'));assert.equal(result.texture,0);assert.equal(result.koma,0);assert.ok(result.params.some(e=>e.font==='mono'),'font edits rebuild layout font choices');
 // Captured font pointers from favorites must not overwrite a manual layout-font change.
 await page.evaluate(()=>{const c=J.ui.plan.cuts.find(c=>c.line===0),opt=J.ui.project.lyricCutOptions['0:0'];opt.details.fontParams=J.cutFontParams(c.params);J.uiApi.replan()});
 await timelineAction(page,'[data-layer=lyrics]','details');await dialog.locator('[data-detail-tab=style]').click();await show('params');
 const param=await field('params.font').count()?'params.font':await dialog.locator('select[data-detail-field^="params."]').first().getAttribute('data-detail-field');
 await field(param).selectOption('gothic_black');await dialog.locator('button[type=submit]').click();
 assert.equal(await page.evaluate(path=>{let v=J.ui.plan.cuts.find(c=>c.line===0);for(const k of path.split('.'))v=v[k];return v},param),'gothic_black','manual font beats captured font pointers');
 // Lock snapshots must not restore the old font after editing the font roles.
 await page.evaluate(()=>{const c=J.ui.plan.cuts.find(c=>c.line===0);J.ui.project.overrides[0].lock=true;J.ui.project.overrides[0].lockedEffects={0:J.cutEffectsPayload(c,'lyrics',J.ui.plan).details};J.uiApi.replan()});
 await timelineAction(page,'[data-layer=lyrics]','details');await dialog.locator('[data-detail-tab=style]').click();await show('fonts');await show('fonts.display');
 for(const f of await dialog.locator('[data-detail-section="fonts.display"] select').all())await f.selectOption('zenkaku');
 await dialog.locator('button[type=submit]').click();assert.equal(await page.evaluate(()=>J.ui.plan.cuts.find(c=>c.line===0).params.font),'zenkaku','locked font snapshot does not defeat edited font roles');
 for(const layer of ['foreground','media']){
  await timelineAction(page,`[data-layer="${layer}"]`,'details');assert.equal(await field('blend').count(),1);assert.equal(await field('opacity').count(),1);
  await field('blend').selectOption('screen');await edit('opacity',25);
  await dialog.locator('[data-detail-tab=motion]').click();
  const enterValues=await field('enter').locator('option').evaluateAll(xs=>xs.map(x=>x.value));assert.ok(enterValues.includes('fade'));assert.ok(!enterValues.includes('assemble'),'media entrance cannot select unsupported lyric effect');
  await field('enter').selectOption('fade');await dialog.locator('button[type=submit]').click();
  const rendered=await page.evaluate(layer=>{const c=J.ui.plan[layer].cuts[0],canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;const ctx=canvas.getContext('2d');J.drawMediaCut(ctx,c,c.start+.05,{source:drawingSource});const phaseAlpha=ctx.getImageData(100,50,1,1).data[3];
   J.mediaAssets.set(c.itemId,{element:drawingSource});const isolated={...J.ui.plan,layerVisibility:{lyrics:false,media:layer==='media',foreground:layer==='foreground'}};const renderer=new J.Renderer();canvas.height=Math.round(200*isolated.H/isolated.W);const sample=()=>{renderer.frame(ctx,isolated,c.start+.05,{scale:200/isolated.W,noHud:true,noPost:true});return ctx.getImageData(100,Math.floor(canvas.height/2),1,1).data[0]};const red=sample();c.opacity=100;const fullRed=sample();c.opacity=25;return {blend:c.blend,opacity:c.opacity,enter:c.enter,phaseAlpha,red,fullRed};},layer);
  assert.equal(rendered.blend,'screen');assert.equal(rendered.opacity,25);assert.equal(rendered.enter,'fade');assert.ok(rendered.phaseAlpha>0&&rendered.phaseAlpha<255,'edited entrance fades the source');assert.ok(rendered.fullRed>rendered.red+20,'edited opacity affects final composite pixels');
 }
 // The details UI must describe all generated parameter keys without raw variable names.
 const unmapped=await page.evaluate(()=>{const keys=new Set(),scan=obj=>{if(!obj||typeof obj!=='object')return;for(const [k,v]of Object.entries(obj)){if(!/^\d+$/.test(k)&&k.length>1&&!J.detailFieldNames[k])keys.add(k);scan(v)}};for(const [name,registry] of Object.entries({params:J.LAYOUTS,treatP:J.TREAT,bgP:J.BG,camP:J.CAMERA,transP:J.TRANS}))for(const def of Object.values(registry))scan(name==='params'?def.plan?.(J.rng(1),{text:'プレビュー|ルビ',n:8,W:1280,H:720,dur:5},J.ui.plan.style):def.plan?.(J.rng(1),J.ui.plan.style));return [...keys]});
 assert.deepEqual(unmapped,[],'generated layout, treatment, camera, background and transition parameters have display labels');
 const seedResult=await page.evaluate(()=>{const p=J.defaultProject();p.lyrics='[00:00]Seed variation';p.overrides={0:{layout:'center',single:true}};const plan=J.plan(p),cut=plan.cuts.find(c=>c.line===0),before=JSON.stringify(cut.params);J.applyCutDetails(cut,{seed:123456},plan,'lyrics');const expected=J.LAYOUTS.center.plan(J.rng(123456),{text:cut.text,n:[...cut.text.replace(/\s/g,'')].length,W:plan.W*(cut.area?.w??1),H:plan.H*(cut.area?.h??1),dur:cut.dur},plan.style);return {actual:cut.params,expected,changed:JSON.stringify(cut.params)!==before}});
 assert.deepEqual(seedResult.actual,seedResult.expected,'editing the seed rebuilds generated effect parameters');assert.ok(seedResult.changed);

 await timelineAction(page,'[data-layer=foreground]','details');await dialog.locator('[data-detail-tab=effects]').click();await show('effectSettings');await edit('effectSettings.duration',0);await dialog.locator('button[type=submit]').click();
 assert.equal(await page.evaluate(()=>{const c=J.ui.plan.foreground.cuts[0],canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;J.drawMediaCut(canvas.getContext('2d'),c,c.start+.05,{source:drawingSource});return canvas.getContext('2d').getImageData(100,50,1,1).data[3]}),255,'zero phase duration is instantaneous');
 assert.deepEqual(errors,[]);console.log(locale||'ja','default settings visibility, font/palette/texture edits, media blend/opacity and entrance rendering passed');await page.close();
}}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
