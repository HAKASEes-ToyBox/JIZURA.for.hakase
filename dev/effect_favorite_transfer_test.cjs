// Saving a cut's effects as a favorite and applying it to another cut transfers only the effects: the
// target keeps its own text, area and timing. Applying is undoable, persists, and a later re-roll drops
// the transferred effects but keeps the text and area. (Formerly effect_clipboard_test: the system
// clipboard copy/paste was replaced by named favorites.)
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {proMode,timelineAction}=require('./ui_helpers.cjs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const locale of ['', 'en/']){
const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://127.0.0.1:8765/'+locale;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',locale,'index.html'))}):r.abort());await page.goto(url);
await page.evaluate(()=>{
const p=J.defaultProject();p.lyrics='[00:00]元の歌詞\n[00:04]貼り付け先の長い歌詞';p.durationOverride=8;
p.overrides={0:{area:{x:.1,y:.1,w:.7,h:.5,angle:30}},1:{area:{x:.4,y:.6,w:.4,h:.3,angle:-20}}};
p.lyricCutOptions={'0:0':{blend:'screen',opacity:43,details:{layout:'center',enter:'wipe',hold:'still',exit:'blur',treat:'none',bg:'none',cam:'push',trans:'none'}},'1:0':{details:{text:'本文は維持する',area:{x:.4,y:.6,w:.4,h:.3,angle:-20}}}};
for(const layer of ['foreground','media'])p[layer]={...p[layer],manualCuts:true,cutCount:1,cutOverrides:{0:{technique:layer==='foreground'?'beatPulse':'none',placement:{cx:layer==='foreground'?.2:.7,cy:.5,w:.3,h:.4,angle:layer==='foreground'?10:40,lockAspect:false},details:{effectSettings:{motion:1.6,treatment:.8,duration:.7}}}},timing:{lineTimes:{0:0}}};
J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();J.uiApi.seek(.2);
});
await page.evaluate(()=>J.uiApi.flushSave());await page.reload();
await proMode(page);const cuts=page.locator('.lyric-cut-option');
const favorites=()=>page.evaluate(()=>JSON.parse(JSON.stringify(J.ui.project.effectFavorites||[])));
// ☆ on a cut: name the favorite and save it; returns the saved entry.
const save=async(button,name)=>{const count=(await favorites()).length;await button.click();const dialog=page.locator('#favoriteNameDialog');await dialog.locator('input').fill(name);await dialog.locator('[value=save]').click();await page.waitForFunction(n=>(J.ui.project.effectFavorites||[]).length===n,count+1);return (await favorites()).at(-1);};
// ←☆ on a cut opens the favorites list for it; apply the named favorite from its card.
const apply=async(button,favorite)=>{await button.click();await page.locator(`.favorite-card[data-favorite-id="${favorite.id}"] .favorite-apply`).click();};
const closeFavorites=async()=>{const close=page.locator('dialog[open] .favorite-close');if(await close.count())await close.click();};

const target=await page.evaluate(()=>JSON.parse(JSON.stringify(J.ui.plan.cuts.find(c=>c.line===1&&c.part===0))));
const lyricFavorite=await save(cuts.first().locator('.effect-copy'),'lyric look');const payload=lyricFavorite.payload;
assert.equal(payload.kind,'lyrics');assert.equal(payload.details.area,undefined);assert.equal(payload.details.text,undefined);assert.ok(payload.details.params);assert.ok(Number.isFinite(payload.details.seed));assert.ok(Array.isArray(payload.details.effectEvents));assert.ok(payload.details.fonts);assert.ok(payload.details.palette);assert.ok(payload.details.fontParams.length);
// Global fonts / colours change after saving; the favorite still carries the saved ones.
await page.evaluate(()=>{J.ui.project.fonts.display='mono';J.ui.project.colors={enabled:true,bg:'#ffffff',fg:'#112233',accent:'#998877'};J.uiApi.replan()});
await apply(page.locator('.lyric-cut-option[data-line="1"][data-part="0"] .effect-paste'),lyricFavorite);await page.waitForFunction(()=>J.ui.project.lyricCutOptions['1:0'].opacity===43);
const pasted=await page.evaluate(()=>JSON.parse(JSON.stringify(J.ui.plan.cuts.find(c=>c.line===1&&c.part===0))));assert.deepEqual(pasted.area,target.area);assert.equal(pasted.text,target.text);assert.equal(pasted.start,target.start);assert.equal(pasted.end,target.end);assert.equal(pasted.enter,'wipe');assert.equal(pasted.opacity,43);assert.deepEqual(pasted.params,payload.details.params);assert.equal(pasted.seed,payload.details.seed);assert.deepEqual(pasted.effectEvents,payload.details.effectEvents);assert.deepEqual(pasted.fonts,payload.details.fonts);assert.deepEqual(pasted.palette,payload.details.palette);assert.equal(pasted.params.font,payload.details.fontParams.find(e=>e.path.join('.')==='font').font);
await closeFavorites();
await page.locator('#btnUndo').click();assert.equal(await page.evaluate(()=>J.ui.project.lyricCutOptions['1:0'].opacity),undefined);await page.locator('#btnRedo').click();assert.equal(await page.evaluate(()=>J.ui.project.lyricCutOptions['1:0'].opacity),43);
// Media: a foreground favorite applied to a background cut keeps the target's item, placement and timing.
await page.locator('#sourceForeground').click();const mediaFavorite=await save(page.locator('#mediaLineList .effect-copy').first(),'media look');assert.equal(mediaFavorite.payload.kind,'media');
await page.locator('#sourceMedia').click();const before=await page.evaluate(()=>({...J.ui.plan.media.cuts[0]}));
await apply(page.locator('#mediaLineList .effect-paste').first(),mediaFavorite);await page.waitForFunction(()=>J.ui.plan.media.cuts[0].technique==='beatPulse');
const media=await page.evaluate(()=>J.ui.plan.media.cuts[0]);assert.deepEqual(media.placement,before.placement);assert.equal(media.itemId,before.itemId);assert.equal(media.start,before.start);assert.equal(media.end,before.end);assert.equal(media.effectSettings.motion,1.6);
await closeFavorites();
// A lyric cut only offers lyric favorites.
await page.locator('#sourceLyrics').click();await cuts.first().locator('.effect-paste').click();
assert.equal(await page.locator(`.favorite-card[data-favorite-id="${mediaFavorite.id}"]`).count(),0);assert.equal(await page.locator(`.favorite-card[data-favorite-id="${lyricFavorite.id}"]`).count(),1);
await closeFavorites();
// The same actions are in the timeline cut menu and on the preview item frames.
await timelineAction(page,'[data-layer="lyrics"][data-index="0"]','copy');assert.ok(await page.locator('#favoriteNameDialog').isVisible());await page.locator('#favoriteNameDialog input').press('Escape');
assert.ok(await page.locator('#itemFrames [data-action="paste"]').count()>0);
await page.evaluate(()=>{const cv=document.createElement('canvas');cv.width=320;cv.height=180;for(const t of [.2,4.3])new J.Renderer().frame(cv.getContext('2d'),J.ui.plan,t,{scale:320/J.ui.plan.W});J.uiApi.flushSave()});
await page.reload();assert.equal(await page.evaluate(()=>J.ui.project.lyricCutOptions['1:0'].opacity),43);const pastedBefore=await page.evaluate(()=>JSON.parse(JSON.stringify(J.ui.project.lyricCutOptions['1:0'])));
const seedBefore=await page.evaluate(()=>J.ui.plan.cuts.find(c=>c.line===1&&c.part===0).seed);
await timelineAction(page,'[data-layer="lyrics"][data-index="1"]','dice');
assert.equal(await page.evaluate(()=>J.ui.project.lyricCutOptions['1:0'].details.seed),undefined);
assert.notEqual(await page.evaluate(()=>J.ui.plan.cuts.find(c=>c.line===1&&c.part===0).seed),seedBefore);
assert.deepEqual(await page.evaluate(()=>J.ui.project.lyricCutOptions['1:0'].details),{text:pastedBefore.details.text,area:pastedBefore.details.area});
await page.locator('#btnUndo').click();assert.deepEqual(await page.evaluate(()=>J.ui.project.lyricCutOptions['1:0']),pastedBefore);
await page.locator('#btnRedo').click();assert.equal(await page.evaluate(()=>J.ui.project.lyricCutOptions['1:0'].details.seed),undefined);
// Global randomization respects locked lines and old pasted projects without a marker.
await page.evaluate(()=>{const p=J.ui.project;p.lyricCutOptions['0:0'].details={seed:42,effectEvents:[],text:'keep'};delete p.lyricCutOptions['0:0'].pastedEffects;p.overrides[0].lock=true;J.clearPastedLyricEffects(p);if(p.lyricCutOptions['0:0'].details.seed!==42)throw Error('locked paste cleared');p.overrides[0].lock=false;J.clearPastedLyricEffects(p);if(p.lyricCutOptions['0:0'].details.seed!==undefined||p.lyricCutOptions['0:0'].details.text!=='keep')throw Error('legacy paste not cleared')});
assert.deepEqual(errors,[]);console.log(locale||'ja','favorite save/apply, isolation, media transfer, undo and persistence passed');await page.close();}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
