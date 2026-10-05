// テーマ設定の「統一感重視 / にぎやかさ重視」: the switch at the top of the dialog (with the note of the side that is
// on), and what 統一感重視 does: fewer effects switched on by おまかせ, repeats favoured, and lyrics of one block
// (a 1シーン group, or the lyrics between blank lines) with the same emphasis sharing their effects.
const {proMode,openSource}=require('./ui_helpers.cjs');
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const locale of ['', 'en/']){
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const url='http://127.0.0.1:8765/'+locale;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',locale,'index.html'))}):r.abort());await page.goto(url);
const en=!!locale;
// ---- the dialog: the old sentence is gone, a two-way switch sits at the top, the note describes the active side
await proMode(page);await openSource(page,'lyrics');
await page.locator('#btnThemes').click();
const dlg=page.locator('#themesDlg');await dlg.waitFor({state:'visible'});
assert.equal(await dlg.locator('form > p:not(#themeBalanceNote)').count(),0,'the old explanation is removed');
assert.doesNotMatch(await dlg.innerText(),/複数選択できます|Select multiple themes/);
const radios=dlg.locator('input[name=themeBalance]');assert.equal(await radios.count(),2);
const labels=await dlg.locator('.theme-balance span').allTextContents();assert.deepEqual(labels,en?['Unified look','Lively look']:['統一感重視','にぎやかさ重視']);
assert.equal(await dlg.locator('input[name=themeBalance][value=lively]').isChecked(),true,'lively (the standard) is the default');
const livelyNote=await page.locator('#themeBalanceNote').innerText();assert.ok(livelyNote.length>20);
// the switch sits above the theme choices
const order=await page.evaluate(()=>{const s=document.querySelector('.theme-balance').getBoundingClientRect(),c=document.getElementById('themeChoices').getBoundingClientRect();return s.bottom<=c.top+1;});assert.equal(order,true,'switch above the choices');
await dlg.locator('.theme-balance label').first().click();
assert.equal(await dlg.locator('input[name=themeBalance][value=unified]').isChecked(),true);
const unifiedNote=await page.locator('#themeBalanceNote').innerText();assert.notEqual(unifiedNote,livelyNote,'the note follows the switch');
assert.match(unifiedNote,en?/same effects|repeating/:/同じ演出/);assert.doesNotMatch(unifiedNote,en?/standard behaviour/:/標準の挙動/,'only the active side is described');
await dlg.locator('.theme-balance label').nth(1).click();assert.equal(await page.locator('#themeBalanceNote').innerText(),livelyNote,'and back');
await dlg.locator('.theme-balance label').first().click();
await page.locator('#btnApplyThemes').click();
assert.equal(await page.evaluate(()=>J.ui.project.themeBalance),'unified');
assert.match(await page.locator('#themeLabels').innerText(),en?/Unified look/:/統一感重視/);
// reopening shows the saved side; cancelling changes nothing
await openSource(page,'lyrics');await page.locator('#btnThemes').click();assert.equal(await dlg.locator('input[name=themeBalance][value=unified]').isChecked(),true);
await dlg.locator('.theme-balance label').nth(1).click();await dlg.locator('button[value=cancel]').click();assert.equal(await page.evaluate(()=>J.ui.project.themeBalance),'unified','cancel keeps it');
await openSource(page,'lyrics');await page.locator('#btnThemes').click();await dlg.locator('.theme-balance label').nth(1).click();await page.locator('#btnApplyThemes').click();
assert.equal(await page.evaluate(()=>J.ui.project.themeBalance),'lively');assert.doesNotMatch(await page.locator('#themeLabels').innerText(),en?/Unified look/:/統一感重視/);
// saved with the project settings; unknown values fall back to the standard
const persisted=await page.evaluate(()=>{const p=JSON.parse(JSON.stringify(J.ui.project));p.themeBalance='unified';const a=J.uiApi?.replaceProject?null:null;return J.mergeProject?null:null;});void persisted;
const merged=await page.evaluate(()=>{const S=J.ui;const keep=S.project;S.project={...keep,themeBalance:'unified'};J.uiApi.flushSave();const saved=JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/jizura/i.test(k)&&localStorage.getItem(k).includes('themeBalance'))||'')||'{}').themeBalance;S.project=keep;return saved;});assert.equal(merged,'unified','autosaved with the project');

// ---- what it does
const result=await page.evaluate(()=>{
 const failures=[],stats={},check=(ok,m)=>{if(!ok&&failures.length<30)failures.push(m)};
 const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
 const countOn=look=>Object.values(look.enabled).reduce((s,g)=>s+Object.values(g).filter(Boolean).length,0);
 const media=(p,layer)=>Object.values(J.randomMediaEffectSettings(p,layer,J.rng(3)).enabled).filter(Boolean).length;
 // おまかせ switches on far fewer effects (without and with themes)
 for(const themes of [[],['pop'],['ballad','cool']]){
  const on={lively:[],unified:[]},med={lively:[],unified:[]};
  for(const balance of ['lively','unified'])for(let seed=1;seed<=30;seed++){
   const p=J.defaultProject();p.themes=themes;p.themeBalance=balance;const look=J.omakase(p,J.rng(seed*11+1));on[balance].push(countOn(look));med[balance].push(look.media?Object.values(look.media.effects.enabled).filter(Boolean).length:0);}
  const key=themes.join('+')||'none';stats['effects '+key]=[Math.round(mean(on.lively)),Math.round(mean(on.unified)),Math.round(mean(med.lively)),Math.round(mean(med.unified))];
  check(mean(on.unified)<mean(on.lively)*.62,'omakase switches on fewer effects '+key+' '+stats['effects '+key]);
  check(mean(med.unified)<mean(med.lively)*.65,'and fewer media techniques '+key);
  check(Math.min(...on.unified)>=20,'a usable pool remains '+key+' '+Math.min(...on.unified));
 }
 // repeats: the same effect on consecutive cuts is far more common
 const lines=Array.from({length:12},(_,i)=>`[00:${String(i*3).padStart(2,'0')}]`+['夜明けの色を覚えてる','ほどけた声が遠くで鳴った','ねえまだ間に合うかな','光る窓をかぞえながら'][i%4]).join(String.fromCharCode(10));
 const repeat=balance=>{let same={layout:0,enter:0,cam:0},pairs=0;for(let seed=1;seed<=24;seed++){const p=J.defaultProject();p.seed=seed;p.lyrics=lines;p.durationOverride=40;p.themeBalance=balance;
   const cuts=J.plan(p).cuts.filter(c=>c.line>=0&&Number.isInteger(c.part));for(let i=1;i<cuts.length;i++){pairs++;for(const k of Object.keys(same))if(cuts[i][k]===cuts[i-1][k])same[k]++;}}
  return Object.fromEntries(Object.entries(same).map(([k,v])=>[k,+(v/pairs).toFixed(2)]));};
 const rl=repeat('lively'),ru=repeat('unified');stats.repeat=[rl,ru];
 check(ru.layout>=rl.layout*1.8&&ru.layout>=.3,'repeated layouts '+JSON.stringify([rl,ru]));check(ru.cam>=rl.cam*1.3,'repeated cameras');
 // blocks: a 1シーン group and the lyrics between blank lines share effects per emphasis
 const text=String.fromCharCode(10),block=`{${text}[00:00]夜明けの色を覚えてる${text}[00:03]ほどけた声が遠くで鳴った${text}[00:06]*ねえまだ間に合うかな*${text}[00:09]光る窓をかぞえながら${text}}${text}${text}[00:13]きみの名前を呼んでみる${text}[00:16]*透明なままじゃ終われない*${text}[00:19]ほどけた声が遠くで鳴った${text}[00:22]*もう一度だけ*`;
 const looks=cut=>JSON.stringify([cut.layout,cut.hold,cut.cam,cut.treat,cut.decor.map(d=>d.id).join('+')]);
 const shared=balance=>{let ok=0,total=0,byRole=0;for(let seed=1;seed<=40;seed++){const p=J.defaultProject();p.seed=seed;p.lyrics=block;p.durationOverride=30;p.themeBalance=balance;
   const cuts=J.plan(p).cuts.filter(c=>c.line>=0&&Number.isInteger(c.part));
   const groups=new Map();for(const c of cuts){const blockId=c.line<=3?'a':'b',role=c.emphasis?'e':c.suppressed?'s':'n',key=blockId+role;(groups.get(key)||groups.set(key,[]).get(key)).push(looks(c));}
   for(const [key,list] of groups){if(list.length<2)continue;total++;if(new Set(list).size===1)ok++;}
   // different roles / blocks may differ
   const a=groups.get('an'),b=groups.get('ae');if(a&&b&&a[0]!==b[0])byRole++;}
  return {ok,total,byRole};};
 const sl=shared('lively'),su=shared('unified');stats.blocks=[sl,su];
 check(su.total>=60&&su.ok>=su.total*.93,'unified: same look within a block and emphasis '+JSON.stringify(su));
 check(sl.ok<=sl.total*.5,'lively: not shared '+JSON.stringify(sl));
 check(su.byRole>=8,'roles still differ from each other '+su.byRole);
 // per-line overrides win over the shared look
 {const p=J.defaultProject();p.seed=3;p.lyrics=block;p.durationOverride=30;p.themeBalance='unified';p.overrides={1:{layout:'stack'}};
  const cuts=J.plan(p).cuts.filter(c=>c.line>=0&&Number.isInteger(c.part));check(cuts.filter(c=>c.line===1).every(c=>c.layout==='stack'),'per-line override kept');
  check(cuts.filter(c=>c.line===0).every(c=>c.layout===cuts.find(x=>x.line===0).layout),'other lines still share');}
 // deterministic; the standard behaviour is not changed by merely having the field
 {const p=J.defaultProject();p.seed=5;p.lyrics=block;p.durationOverride=30;const a=JSON.stringify(J.plan(p).cuts.map(c=>looks(c))),b=JSON.stringify(J.plan({...p,themeBalance:'lively'}).cuts.map(c=>looks(c)));check(a===b,'default is lively');
  p.themeBalance='unified';check(JSON.stringify(J.plan(p).cuts.map(c=>looks(c)))===JSON.stringify(J.plan(p).cuts.map(c=>looks(c))),'deterministic');
  const q={...p,themeBalance:'bogus'};check(J.plan(q).cuts.length>0,'plans with an unknown value');}
 return {failures,stats};
});
assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);console.log(locale||'ja','theme balance:',JSON.stringify(result.stats));await page.close();}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
