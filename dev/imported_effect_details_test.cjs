const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {timelineAction}=require('./ui_helpers.cjs');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const locale of ['', 'en/']){
 const page=await b.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url()==='http://test/'?r.fulfill({contentType:'text/html',body:fs.readFileSync(locale+'index.html')}):r.abort());await page.goto('http://test/');
 const result=await page.evaluate(()=>{
  const p=J.defaultProject();p.lyrics='[00:00]プレビュー';p.durationOverride=5;p.res=640;p.fx={...p.fx,chroma:0,texture:0,glitch:0,hud:'off',onTwos:false,koma:0};p.overrides={0:{single:true,lock:true,lockedEffects:{0:{treat:'hrEroded',treatP:{}}}}};
  p.lyricCutOptions={'0:0':{details:{layout:'center',enter:'cut',exit:'cut',hold:'still',bg:'none',bgP:{},trans:'none',transP:{},treat:'hrEroded',treatP:{},palette:{...J.STYLES[p.style].schemes[0],bg:'#FF4FA3'},effectStyle:{glow:0},effectEvents:[{type:'perspectiveTilt',offset:0,amp:1.275,dur:1/3}]}}};
  const image=document.createElement('canvas');image.width=640;image.height=360;const x=image.getContext('2d');x.fillStyle='#002200';x.fillRect(0,0,640,360);J.mediaAssets.set('test-media',{element:image,type:'image'});
  Object.assign(p.media,{items:[{id:'test-media',name:'background.png',type:'image',width:640,height:360}],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:'test-media',technique:'none',entrance:'none',departure:'none',placement:{cx:.5,cy:.5,w:1,h:1,angle:0,lockAspect:true}}}});
  J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();const cut=J.ui.plan.cuts[0],canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const r=new J.Renderer(),pixels=[];
  for(const t of [.02,.08,.2,.5]){r.frame(canvas.getContext('2d'),J.ui.plan,t,{scale:640/J.ui.plan.W,noHud:true});pixels.push([...canvas.getContext('2d').getImageData(2,2,1,1).data]);}
  const saved=JSON.stringify(p);J.uiApi.replan();if(saved!==JSON.stringify(p))throw Error('planning mutated project');
  const partial={...cut,treatP:{dens:1.75}};J.applyCutDetails(partial,{treatP:{dens:1.75}},J.ui.plan,'lyrics');
  return {pixels,params:cut.treatP,partial:partial.treatP};
 });
 assert.ok(Number.isFinite(result.params.dens));assert.equal(typeof result.params.scr,'boolean');assert.equal(result.partial.dens,1.75);assert.equal(typeof result.partial.scr,'boolean');for(const px of result.pixels)assert.deepEqual(px,[0,34,0,255],'post effect must leave background visible');
 await timelineAction(page,'[data-layer="lyrics"][data-index="0"]','details');const dialog=page.locator('#cutDetailsDialog');await dialog.locator('[data-detail-tab="effects"]').click();
 assert.equal(await dialog.locator('[data-detail-section="bgP"]').count(),0);assert.equal(await dialog.locator('[data-detail-section="transP"]').count(),0);
 await dialog.locator('[data-detail-section="treatP"]').evaluate(el=>el.open=true);const dens=dialog.locator('[data-detail-field="treatP.dens"]');assert.ok(Number.isFinite(+await dens.inputValue()));await dens.fill('1.5');await dens.dispatchEvent('change');await page.waitForTimeout(200);assert.equal(await dialog.evaluate(d=>d.cutPreview.cut.treatP.dens),1.5);
 await dialog.getByRole('button',{name:locale?'Apply':'適用',exact:true}).click();assert.equal(await page.evaluate(()=>J.ui.plan.cuts[0].treatP.dens),1.5);assert.deepEqual(errors,[]);await page.close();console.log('PASS imported parameter defaults and transparent perspective '+(locale||'ja'));
 }}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
