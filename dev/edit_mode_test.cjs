const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {timelineAction}=require('./ui_helpers.cjs');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const locale of ['', 'en/'])for(const width of [1500,390]){
 const page=await b.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://localhost/';await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(locale+'index.html')}));await page.goto(url);
 await page.evaluate(()=>{const p=J.defaultProject();p.lyrics='[00:00]Edit me';p.durationOverride=8;p.overrides={0:{single:true,area:{x:.2,y:.2,w:.6,h:.6,angle:0},layout:'center'}};
 for(const layer of ['foreground','media']){const c=document.createElement('canvas');c.width=400;c.height=200;c.getContext('2d').fillRect(0,0,400,200);J.mediaAssets.set(layer,{element:c,type:'image'});Object.assign(p[layer],{items:[{id:layer,name:layer+'.png',type:'image',width:400,height:200}],manualCuts:true,cutCount:1,cutOverrides:{0:{itemId:layer,technique:'none',placement:{cx:.5,cy:.5,w:.5,h:.4,angle:0}}}})}
 J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();J.uiApi.seek(.3);});
 for(const layer of ['foreground','lyrics','media']){
  const original=await page.evaluate(()=>JSON.stringify(J.ui.project)),time=await page.evaluate(()=>J.ui.t);
  await page.locator(`.item-frame-name[data-select-layer="${layer}"]`).first().click();
  assert.equal(await page.evaluate(()=>J.ui.t),time,'preview selection preserves time');assert.equal(await page.locator('#itemFrames').isVisible(),true);
  assert.equal(await page.locator('#btnPlay').evaluate(el=>!!el.closest('[inert]')),true,'transport inert during selection');
  const bounds=await page.locator('#viewport').boundingBox(),controls=await page.locator('#areaEditControls').boundingBox();
  assert.ok(controls.y>=bounds.y+bounds.height && controls.y-bounds.y-bounds.height<16,'controls immediately under preview');
  const rect=await page.locator('#areaEditRect').boundingBox(),before=await page.evaluate(()=>({...J.ui.areaEdit.draft}));
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+10,rect.y+rect.height/2+5);await page.mouse.up();
  assert.ok(await page.evaluate(x=>Math.abs(J.ui.areaEdit.draft.x-x)>.001,before.x),'drag moves');
  const corner=await page.locator('.area-edit-handle.se').boundingBox(),w0=await page.evaluate(()=>J.ui.areaEdit.draft.w);
  await page.mouse.move(corner.x+corner.width/2,corner.y+corner.height/2);await page.mouse.down();await page.mouse.move(corner.x+corner.width/2+10,corner.y+corner.height/2+8);await page.mouse.up();
  assert.ok(await page.evaluate(w=>J.ui.areaEdit.draft.w>w,w0),'corner resizes');
  const h=await page.locator('.area-rotate-handle.n').boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+25,h.y+h.height/2+10);await page.mouse.up();
  assert.ok(await page.evaluate(()=>Math.abs(J.ui.areaEdit.angle)>1),'rotation handle rotates');
  await page.locator('#mediaAreaAngleReset').click();assert.equal(await page.evaluate(()=>J.ui.areaEdit.angle),0);
  await page.locator('#areaCancel').click();assert.equal(await page.evaluate(()=>JSON.stringify(J.ui.project)),original);assert.equal(await page.locator('#btnPlay').evaluate(el=>!!el.closest('[inert]')),false);
 }
 await page.locator('#showItemFrames').uncheck();await timelineAction(page,'[data-layer="lyrics"]','area');assert.equal(await page.locator('#showItemFrames').isChecked(),true);
 await page.locator('#mediaAreaAngle').fill('30');await page.locator('#mediaAreaAngle').dispatchEvent('input');await page.locator('#areaApplyOne').click();
 assert.equal(await page.locator('#showItemFrames').isChecked(),false,'temporary edit mode restored');assert.equal(await page.evaluate(()=>J.ui.project.overrides[0].area.angle),30);
 await page.locator('#showItemFrames').check();
 await page.locator('.item-frame-name[data-select-layer="lyrics"]').click();
 await page.locator('#mediaAreaAngle').fill('45');await page.locator('#mediaAreaAngle').dispatchEvent('input');
 const clearCorners=await page.evaluate(()=>{const tools=document.querySelector('.item-frame-tools.lyrics').getBoundingClientRect(),svg=document.querySelector('.item-frame-outline.lyrics'),box=svg.getBoundingClientRect();return [...svg.querySelector('polygon').points].every(p=>p.x+box.x<tools.left-4||p.x+box.x>tools.right+4||p.y+box.y<tools.top-4||p.y+box.y>tools.bottom+4)});
 assert.ok(clearCorners,'rotated corners do not overlap menu');
 for(const layer of ['lyrics','foreground','media']){
  const lock=page.locator(`.item-frame-action[data-layer="${layer}"][data-action="lock"]`),before=await lock.getAttribute('aria-pressed');await lock.click();assert.notEqual(await lock.getAttribute('aria-pressed'),before);
 }
 const seed=await page.evaluate(()=>J.ui.plan.foreground.cuts[0].seed);
 await page.locator('.item-frame-action[data-layer="foreground"][data-action="dice"]').click();assert.notEqual(await page.evaluate(()=>J.ui.plan.foreground.cuts[0].seed),seed);
 assert.equal(await page.evaluate(()=>J.ui.areaEdit.angle),45,'menu preserves placement draft');
 await page.locator('.item-frame-action[data-layer="media"][data-action="details"]').click();await page.locator('#cutDetailsDialog').getByRole('button',{name:locale?'Cancel':'キャンセル',exact:true}).click();
 assert.equal(await page.evaluate(()=>J.ui.areaEdit.angle),45,'details dialog keeps selection');
 await page.locator('.item-frame-action[data-layer="lyrics"][data-action="remove"]').click();assert.equal(await page.evaluate(()=>J.ui.areaEdit),null,'delete exits selection');
 assert.equal(await page.locator('#btnPlay').evaluate(el=>!!el.closest('[inert]')),false,'delete restores interaction');
 assert.deepEqual(errors,[]);console.log(locale||'ja',width,'selection, move, resize, rotation, cancel and timeline restoration passed');await page.close();
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
