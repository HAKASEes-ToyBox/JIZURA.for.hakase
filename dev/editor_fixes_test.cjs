// Ctrl+S saves the project; the zoomed timeline follows the playhead while playing; base colours set in the
// Style tab reach every scheme of the style (opposite-tone schemes take them inverted).
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--autoplay-policy=no-user-gesture-required']});
try{for(const lang of ['','en/']){
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());
 await page.goto(url);await page.locator('#modePro').click();
 // Ctrl+S opens the save dialog, also while typing in the lyrics, and keeps the browser's page save away.
 for(const target of ['body','#lyrics']){
  await page.locator(target).first().focus();
  await page.evaluate(()=>{window.__saveKey=null;window.addEventListener('keydown',e=>{if(e.code==='KeyS')window.__saveKey=e.defaultPrevented;});});
  await page.keyboard.press('Control+s');await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>document.getElementById('filenameDlg').open),true,`Ctrl+S from ${target}`);
  assert.equal(await page.evaluate(()=>window.__saveKey),true,'browser save prevented');
  await page.keyboard.press('Escape');await page.waitForTimeout(100);
 }
 // The zoomed timeline follows the playhead while playing.
 await page.evaluate(()=>{J.ui.project.lyrics=Array.from({length:12},(_,i)=>'歌詞の行 '+(i+1)).join('\n');J.ui.project.durationOverride=40;J.uiApi.syncUI();J.uiApi.replan();J.uiApi.pause();J.uiApi.seek(0);});
 for(let i=0;i<4;i++)await page.locator('#timelineZoomIn').click();
 const visible=()=>page.evaluate(()=>{const box=document.getElementById('timelineScroll').getBoundingClientRect(),line=document.getElementById('timeline').getBoundingClientRect();const x=line.left+line.width*J.ui.t/J.ui.plan.duration;return x>=box.left&&x<=box.right;});
 await page.evaluate(()=>{J.uiApi.seek(0);document.getElementById('btnPlay').click();});
 for(const t of [12,25,37]){await page.evaluate(t=>J.uiApi.seek(t),t);await page.waitForTimeout(250);assert.equal(await visible(),true,'playhead in view at '+t);}
 // A manual scroll pauses the follow for a moment.
 await page.evaluate(()=>J.uiApi.seek(20));await page.waitForTimeout(250);
 await page.locator('#timelineScroll').dispatchEvent('wheel');await page.evaluate(()=>{document.getElementById('timelineScroll').scrollLeft=0;J.uiApi.seek(22);});await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>document.getElementById('timelineScroll').scrollLeft),0,'user scroll respected');
 await page.evaluate(()=>J.uiApi.pause());
 // Base colours reach every scheme.
 const colours=await page.evaluate(()=>{const failures=[];
  for(const style of Object.keys(J.STYLES)){
   const base=J.STYLES[style].schemes,st=J.resolveStyle({style,colors:{enabled:true,bg:'#FF0000',fg:'#00FF00'}});
   st.schemes.forEach((s,i)=>{const hasBg=s.bg==='#FF0000'||s.fg==='#FF0000',hasFg=s.fg==='#00FF00'||s.bg==='#00FF00';if(!hasBg||!hasFg)failures.push(`${style}[${i}] ignores the colours`);
    if(base[i].ink===base[i].fg&&s.ink!==s.fg)failures.push(`${style}[${i}] ink does not follow the text colour`);});
   const only=J.resolveStyle({style,colors:{enabled:true,bg:'#202020'}});
   only.schemes.forEach((s,i)=>{if(i&&J.contrast(s.fg,s.bg)<2.9)failures.push(`${style}[${i}] unreadable ${s.fg} on ${s.bg}`);});}
  return failures;});
 assert.deepEqual(colours,[]);
 // Through the Style tab: a cut on the second scheme picks up the new background colour.
 const second=await page.evaluate(async()=>{J.ui.project.style='noir';J.ui.project.lyrics='夜明けの色を覚えてる';J.ui.project.lyricCutOptions={'0:0':{details:{scheme:1}}};delete J.ui.project.durationOverride;J.uiApi.syncUI();J.uiApi.replan();
  const i=document.querySelector('#colorRow input');i.value='#ff0000';i.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,400));
  const cut=J.ui.plan.cuts.find(c=>c.line===0&&c.part===0),sc=J.ui.plan.style.schemes[cut.scheme];return {scheme:cut.scheme,colours:[sc.bg,sc.fg,sc.ink]};});
 assert.equal(second.scheme,1);assert.ok(second.colours.includes('#FF0000'),'second scheme follows the colour '+second.colours);
 assert.deepEqual(errors,[]);console.log(lang||'ja','editor fixes passed');await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
