const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {openSettings,closeSettings,proMode,timelineAction}=require('./ui_helpers.cjs');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/']){const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));await page.goto(url);
const result=await page.evaluate(()=>{
const failures=[],check=(ok,m)=>{if(!ok)failures.push(m)};
const hue=c=>J.toHsl(c)[0],sat=c=>J.toHsl(c)[1],light=c=>J.toHsl(c)[2],hueDiff=(a,b)=>{const d=Math.abs(a-b)%360;return Math.min(d,360-d);};
const inRanges=(h,ranges)=>ranges.some(([a,b])=>{const x=((h%360)+360)%360;return x>=a-1&&x<=b+1;});
check(J.COLOR_GENRE_ORDER.length===9&&J.COLOR_GENRE_ORDER[0]==='auto','genres');
for(const genre of J.COLOR_GENRE_ORDER)for(const color of [null,'#E0457B','#2FA84F'])for(let seed=1;seed<=25;seed++){
 const p=J.defaultProject();p.colorTheme={genre,color};const style=J.STYLE_ORDER[seed%J.STYLE_ORDER.length];
 const pal=J.themedPalette(p,style,J.rng(seed)),bg=pal.bg||J.STYLES[style].schemes[0].bg,tag=genre+'/'+color+'/'+seed;
 check(JSON.stringify(pal)===JSON.stringify(J.themedPalette(p,style,J.rng(seed))),'deterministic '+tag);
 check(J.contrast(pal.accent,bg)>=2.39&&J.contrast(pal.accent2,bg)>=2.39,'accent contrast '+tag);
 check(J.contrast(pal.ghostA,bg)>=1.34&&J.contrast(pal.ghostB,bg)>=1.34,'ghost contrast '+tag);
 if(pal.enabled)check(J.contrast(pal.fg,bg)>=6.9&&J.contrast(pal.sub,bg)>=3.4&&pal.allSchemes,'text contrast '+tag);
 check(genre==='auto'?!pal.enabled:pal.enabled,'base colours '+tag);
 if(color){check(hueDiff(hue(pal.accent),hue(color))<=8,'theme colour kept '+tag+' '+pal.accent);continue;}
 if(genre==='pastel')check(light(bg)>=.88&&[pal.accent,pal.ghostA,pal.ghostB].every(c=>sat(c)<=.75&&light(c)>=.35),'pastel '+tag);
 if(genre==='neon')check(light(bg)<=.06&&sat(pal.accent)>=.95,'neon '+tag);
 if(genre==='vivid')check(sat(pal.accent)>=.85,'vivid '+tag);
 if(genre==='dark')check(light(bg)<=.12,'dark '+tag);
 if(genre==='mono')check(sat(pal.accent)<=.02&&sat(pal.ghostA)<=.02&&sat(pal.ghostB)<=.02,'mono '+tag);
 if(['cool','earth','retro'].includes(genre))check([pal.accent,pal.ghostA,pal.ghostB].every(c=>inRanges(hue(c),J.COLOR_GENRES[genre].hues)),genre+' hues '+tag);
}
// The palette covers every scheme of the style.
{const p=J.defaultProject();p.style='noir';p.colorTheme={genre:'pastel',color:null};p.colors=J.themedColors(p,'noir',J.rng(3));const st=J.resolveStyle(p);
 check(st.schemes.length>1&&st.schemes.every(s=>s.bg===p.colors.bg&&s.fg===p.colors.fg),'all schemes');}
// Manual base colours survive a theme colour without a genre.
{const p=J.defaultProject();p.colors={enabled:true,bg:'#203040',fg:'#FFFFFF'};p.colorTheme={genre:'auto',color:'#FF8800'};const c=J.themedColors(p,'noir',J.rng(2));
 check(c.enabled&&c.bg==='#203040'&&hueDiff(hue(c.accent),hue('#FF8800'))<=8,'auto keeps base');}
// Randomize: the colour theme wins over music-genre / taste themes and over the plain random palette.
for(let seed=1;seed<=15;seed++){
 const p=J.defaultProject();p.themes=['rock'];p.colorTheme={genre:'pastel',color:'#3366FF'};const look=J.omakase(p,J.rng(seed));
 check(look.colors.enabled&&look.colors.allSchemes&&light(look.colors.bg)>=.88&&hueDiff(hue(look.colors.accent),hue('#3366FF'))<=8,'theme omakase '+seed);
 const plan=J.plan({...p,...look});check(plan.style.schemes.every(s=>s.bg===look.colors.bg),'plan uses palette '+seed);
 const q=J.defaultProject();q.colorTheme={genre:'neon',color:null};check(J.omakase(q,J.rng(seed)).colors.accentOn===true,'plain omakase '+seed);
 const r=J.defaultProject();r.themes=['rock'];const plain=J.omakase(r,J.rng(seed));check(!plain.colors.enabled&&!plain.colors.accentOn,'no colour theme unchanged '+seed);
}
// Settings export / import carry the colour theme.
{const p=J.defaultProject();p.colorTheme={genre:'retro',color:'#AA3300'};check(JSON.stringify(J.projectSettings(p).colorTheme)==='{"genre":"retro","color":"#AA3300"}','settings export');
 check(J.applyProjectSettings(J.defaultProject(),p).colorTheme.genre==='retro','settings import');
 check(JSON.stringify(J.normalizeColorTheme({genre:'nope',color:'red'}))==='{"genre":"auto","color":null}','normalize');}
return failures;});
assert.deepEqual(result,[]);
// Dialog: pick a genre and a theme colour, apply (recolours now), label, palette button, clear, undo.
await proMode(page);
const before=await page.evaluate(()=>JSON.stringify(J.ui.project.colors));
await page.locator('#btnThemes').click();const box=page.locator('#themeChoices .theme-colors');
assert.equal(await box.locator('legend').textContent(),lang?'Colour':'カラー');
assert.equal((await box.locator('#colorGenre option').allTextContents()).join('/'),lang?'Not specified/Vivid/Pastel/Neon/Dark/Monotone/Earth/Retro/Cool':'指定なし/ビビッド/パステル/ネオン/ダーク/モノトーン/アース/レトロ/クール');
await box.locator('#colorGenre').selectOption('pastel');assert.ok((await box.locator('#colorGenreNote').textContent()).length>3);
await box.locator('#colorThemeColor').fill('#3366ff');assert.equal(await box.locator('#colorThemeOn').isChecked(),true);
await page.locator('#btnApplyThemes').click();
const applied=await page.evaluate(()=>({theme:J.ui.project.colorTheme,colors:J.ui.project.colors,bg:J.ui.plan.style.schemes[0].bg,label:document.querySelector('#themeLabels .theme-color-label')?.textContent}));
assert.deepEqual(applied.theme,{genre:'pastel',color:'#3366FF'});assert.ok(applied.colors.enabled&&applied.colors.accentOn&&applied.bg===applied.colors.bg);
assert.equal(applied.label,lang?'Colour: Pastel':'カラー：パステル');
await page.locator('#btnRandPalette').click();
const again=await page.evaluate(()=>{const c=J.ui.project.colors,h=x=>J.toHsl(x)[0];return {bgLight:J.toHsl(c.bg)[2],hue:h(c.accent),changed:c.ghostA};});
assert.ok(again.bgLight>=.88&&Math.min(Math.abs(again.hue-225),360-Math.abs(again.hue-225))<=10,'palette button '+JSON.stringify(again));
await page.locator('#btnUndo').click();await page.locator('#btnUndo').click();
assert.equal(await page.evaluate(()=>JSON.stringify(J.ui.project.colors)),before);
await page.locator('#btnThemes').click();await page.locator('#btnClearThemes').click();
assert.equal(await box.locator('#colorGenre').inputValue(),'auto');assert.equal(await box.locator('#colorThemeOn').isChecked(),false);
await page.locator('#btnApplyThemes').click();assert.deepEqual(await page.evaluate(()=>J.ui.project.colorTheme),{genre:'auto',color:null});
assert.equal(await page.locator('#themeLabels .theme-color-label').count(),0);
assert.deepEqual(errors,[]);console.log(lang||'ja','colour theme passed');await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
