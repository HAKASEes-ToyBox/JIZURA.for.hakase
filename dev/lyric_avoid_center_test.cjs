// 「画面中央を避ける」: automatic lyric areas (single lines, sized lines, arrangements, packing) keep the stage
// centre clear, except *emphasised* cuts. The easy-mode and Details > Techniques switches are one setting.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/']){
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());await page.goto(url);
const result=await page.evaluate(()=>{
const failures=[],check=(ok,m)=>{if(!ok)failures.push(m)},stats={},C=J.CENTER_AVOID;
const ov=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
check(J.lyricEffectSettings({}).avoidCenter===false,'off by default');
const cv=document.createElement('canvas');cv.width=400;cv.height=300;J.mediaAssets.set('fgA',{element:cv,type:'image'});
const withFg=p=>{p.foreground={...p.foreground,items:[{id:'fgA',name:'a.png',type:'image',width:400,height:300}],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:'fgA',technique:null}}};return p;};
const plan=(lyrics,seed,avoidCenter,fg)=>{const p=J.defaultProject();p.seed=seed;p.lyrics=lyrics;p.lyricEffects={autoPlacement:true,avoidCenter};return J.plan(fg?withFg(p):p);};
const lyricCuts=pl=>pl.cuts.filter(c=>c.line>=0&&Number.isInteger(c.part)&&c.area);
const cases={
 single:'夜明けの色を覚えてる\n*ほどけた声が*\n~遠くで鳴った~\nねえまだ間に合うかな',
 sized:'30:夜明けの色を\n45:覚えてる',
 separate:'{-夜明けの色を/覚えてる/ほどけた声が/遠くで鳴った-}',
 shared:'{夜明けの色を/覚えてる/ほどけた声が/*遠くで鳴った*}',
};
for(const [name,lyrics] of Object.entries(cases))for(const fg of [false,true]){
 let clear=0,total=0,offHit=0,emphHit=0,emph=0;const arrangements=new Set();
 for(let seed=1;seed<=30;seed++){
  const on=plan(lyrics,seed,true,fg);
  for(const c of lyricCuts(on)){const a=c.area;
   check(a.x>=-1e-9&&a.y>=-1e-9&&a.x+a.w<=1+1e-9&&a.y+a.h<=1+1e-9,`${name} fg=${fg} inside the stage ${seed}`);
   if(c.emphasis){emph++;if(ov(a,C)>1e-9)emphHit++;continue;}
   // A notation size too large for the strips around the centre keeps its size but stays off the centre point.
   const fits=a.w<=.3||a.h<=.28;
   total++;if(fits?ov(a,C)<=1e-9:!(a.x<.5&&a.x+a.w>.5&&a.y<.5&&a.y+a.h>.5))clear++;if(c.arrangement)arrangements.add(c.arrangement);}
  for(const c of lyricCuts(plan(lyrics,seed,false,fg)))if(!c.emphasis&&ov(c.area,C)>1e-9)offHit++;}
 stats[`${name}${fg?'+fg':''}`]={clear:`${clear}/${total}`,offHit,emphHit:`${emphHit}/${emph}`,arrangements:arrangements.size};
 check(total>0&&clear===total,`${name} fg=${fg}: non-emphasis clear of the centre ${clear}/${total}`);
 check(offHit>0,`${name} fg=${fg}: the centre is used when the option is off`);
 if(emph)check(emphHit>0,`${name} fg=${fg}: emphasis may still use the centre`);
 if(!fg&&name!=='single'&&name!=='sized')check(arrangements.size>=3,`${name}: arrangement variety ${arrangements.size}`);}
// Without automatic placement the option has no effect (full-stage lyrics).
{const p=J.defaultProject();p.lyrics='夜明けの色を覚えてる';p.lyricEffects={autoPlacement:false,avoidCenter:true};check(J.plan(p).cuts.filter(c=>c.line>=0).every(c=>!c.area),'no effect without automatic placement');}
return {failures,stats};});
assert.deepEqual(result.failures,[]);
// UI: the easy-mode and Details switches mirror one setting.
await page.evaluate(()=>{J.ui.project.lyricEffects={...J.lyricEffectSettings(J.ui.project),autoPlacement:false,avoidCenter:false};J.uiApi.syncUI();});
assert.equal(await page.locator('#lyricAvoidCenter').isDisabled(),true,'disabled without automatic placement');
await page.locator('#eLyricAvoidCenter').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
let s=await page.evaluate(()=>J.ui.project.lyricEffects);assert.equal(s.avoidCenter,true);assert.equal(s.autoPlacement,true,'easy switch enables automatic placement');
assert.equal(await page.locator('#lyricAvoidCenter').isChecked(),true);assert.equal(await page.locator('#lyricAutoPlacement').isChecked(),true);
await page.locator('#lyricAvoidCenter').evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));});
s=await page.evaluate(()=>J.ui.project.lyricEffects);assert.equal(s.avoidCenter,false);assert.equal(await page.locator('#eLyricAvoidCenter').isChecked(),false,'mirrored back');
// Undo restores it, and the labels are localized.
await page.locator('#btnUndo').click();assert.equal(await page.locator('#eLyricAvoidCenter').isChecked(),true,'undo');
const label=(await page.locator('label:has(#eLyricAvoidCenter)').textContent());assert.ok(lang?label.includes('Keep lyrics out of the centre'):label.includes('歌詞が画面中央を避ける'),label);
assert.deepEqual(errors,[]);console.log(lang||'ja',JSON.stringify(result.stats));await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
