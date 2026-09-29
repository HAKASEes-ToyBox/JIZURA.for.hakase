// Custom drawing programs load their own fonts and the glyphs of their literal strings: a favorite with
// text nodes in Mochiy Pop One / Dela Gothic One and a fixed "SUMMER!" label must not fall back.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://localhost:8765/';await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'index.html'))}):r.continue());
 await page.goto(url);
 const result=await page.evaluate(async()=>{
  const drawing={version:1,mode:'replace',nodes:[{type:'text',text:'$text',font:'pop'},{type:'text',text:'SUMMER!',font:'dela'},{type:'arcText',text:'$text',font:'reggae'}]};
  const plan={style:{fonts:{display:['gothic_black']}},cuts:[{text:'夏',drawing}],media:{cuts:[{drawing:{version:1,mode:'overlay',nodes:[{type:'text',text:'海',font:'kiwi'}]}}]},foreground:{cuts:[]}};
  const keys=J.fontsOfPlan(plan),text=J.drawingText(plan);
  const payload={format:'jizura-cut-effects',version:1,kind:'lyrics',native:{},details:{drawing}};
  const loaded=[];const load=document.fonts.load.bind(document.fonts);document.fonts.load=(spec,str)=>{loaded.push([spec,str]);return load(spec,str);};
  const png=await J.favoriteAPI.preview({payload,time:1,width:320});document.fonts.load=load;
  return {keys,text,png:!!png.data,loaded:loaded.map(([s,t])=>s+'|'+t)};
 });
 for(const k of ['pop','dela','reggae','kiwi','gothic_black'])assert.ok(result.keys.includes(k),'font key '+k+' in '+result.keys);
 assert.equal(result.text,'SUMMER!海');
 assert.ok(result.png);
 assert.ok(result.loaded.some(s=>/Mochiy Pop One/.test(s)),'preview loads the drawing font: '+result.loaded.slice(0,5));
 assert.ok(result.loaded.some(s=>/Dela Gothic One/.test(s)&&/S/.test(s.split('|')[1]||'')),'literal glyphs requested');
 assert.deepEqual(errors,[]);
 console.log('drawing fonts test passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
