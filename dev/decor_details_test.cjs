const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {timelineAction}=require('./ui_helpers.cjs');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const locale of ['', 'en/'])for(const width of [1500,390]){
 const page=await b.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(locale+'index.html')}));await page.goto('http://test/');
 await page.evaluate(()=>{const p=J.defaultProject();p.lyrics='[00:00]装飾のテスト';p.durationOverride=8;p.overrides={0:{single:true}};
  const ids=['grid','stripes','blobs','counter','indexNum','reticle','seal','scribbleCircle','sonarArcs'];
  p.lyricCutOptions={'0:0':{details:{decor:ids.map(id=>({id,...J.decorDetailDefaults(123),n:2,from:3,to:80,mode:'count'}))}}};
  for(const layer of ['foreground','media'])Object.assign(p[layer],{manualCuts:true,cutCount:1,cutOverrides:{0:{technique:'none',details:{decor:[{id:'grid',seed:1,n:4,right:true,mode:'count'}]}}}});
  J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();
 });
 const dialog=page.locator('#cutDetailsDialog'),field=path=>dialog.locator(`[data-detail-field="${path}"]`);
 await timelineAction(page,'[data-layer=lyrics]','details');await dialog.locator('[data-detail-tab=decor]').click();
 const shown=async i=>dialog.locator(`[data-detail-section="decor.${i}"] [data-detail-field]`).evaluateAll(xs=>xs.map(x=>x.dataset.detailField.split('.').at(-1)).sort());
 assert.equal(await dialog.locator('[data-detail-section="decor.0"] [data-detail-field]').first().getAttribute('data-detail-field'),'decor.0.id','decoration type is the first field');
 assert.deepEqual(await shown(0),['id','n']);assert.deepEqual(await shown(1),['accent','corner','id']);assert.deepEqual(await shown(2),['id','n','seed']);
 assert.deepEqual(await shown(5),['corner','id','low','r','right','v'],'positioning helper fields are included');assert.deepEqual(await shown(6),['corner','id','seed','v'],'overridden placement flags are excluded');assert.deepEqual(await shown(7),['accent','id','right','seed','v'],'handLoop helper reads are included');assert.deepEqual(await shown(8),['id']);
 for(const i of [3,4])await dialog.locator(`[data-detail-section="decor.${i}"]`).evaluate(el=>el.open=true);
 assert.equal(await field('decor.3.mode').evaluate(x=>x.tagName),'SELECT');assert.equal(await field('decor.3.mode').locator('option').count(),2);
 assert.ok(await field('decor.3.mode').locator('..').locator('small').textContent());assert.ok(await field('decor.4.mode').locator('..').locator('small').textContent());
 await field('decor.3.mode').selectOption('index');assert.equal(await field('decor.3.from').count(),0);assert.equal(await field('decor.3.to').count(),0);
 await dialog.locator('[data-detail-undo]').click();assert.equal(await field('decor.3.from').count(),1);assert.equal(await field('decor.3.mode').inputValue(),'count');
 await field('decor.3.mode').selectOption('index');await field('decor.4.mode').selectOption('index');
 assert.equal(await dialog.locator('[data-detail-section="decor.4"]').evaluate(x=>x.open),true,'foldout stays open after mode changes');
 // Changing a minimal grid to a counter initializes all newly required fields.
 await dialog.locator('[data-detail-section="decor.0"] > summary').click();await field('decor.0.id').selectOption('counter');await field('decor.0.mode').selectOption('count');
 assert.ok(await field('decor.0.from').count());assert.ok(await field('decor.0.to').count());
 await dialog.locator('button[type=submit]').click();
 const d=await page.evaluate(()=>J.ui.plan.cuts.find(c=>c.line===0).decor);assert.equal(d[3].mode,'index');assert.equal(d[4].mode,'index');assert.ok(Number.isFinite(d[0].from)&&Number.isFinite(d[0].to),'counter renderer receives finite ranges');assert.equal(d[0].seed,123,'unused options remain intact when type changes');
 const missing=await page.evaluate(()=>Object.keys(J.DECOR).filter(id=>!Object.hasOwn(J.DECOR_DETAIL_FIELDS,id)));assert.deepEqual(missing,[],'all stock decorations have parameter metadata');
 for(const layer of ['foreground','media']){await timelineAction(page,`[data-layer="${layer}"]`,'details');await dialog.locator('[data-detail-tab=decor]').click();assert.deepEqual(await shown(0),['id','n']);await dialog.getByRole('button',{name:locale?'Cancel':'キャンセル',exact:true}).click();}
 assert.deepEqual(errors,[]);console.log(locale||'ja',width,'decoration field filtering, mode choices/hints, undo, type changes, persistence and all layer editors passed');await page.close();
}}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
