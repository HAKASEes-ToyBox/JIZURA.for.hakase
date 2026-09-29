// Hand-set changes to a line (layout, effect, display area) must not change its palette, and a palette chosen in the
// cut details wins over the colour set captured by a lock.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const url='http://127.0.0.1:8765/';await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..','index.html'))}):r.abort());await page.goto(url);
const result=await page.evaluate(()=>{
 const T=String.fromCharCode(10),failures=[],check=(ok,m)=>{if(!ok&&failures.length<20)failures.push(m)};
 const lyrics=['[00:00]夜明けの色を覚えてる遠くで声が鳴った','[00:06]ほどけた声が遠くで鳴った夜をこえて','[00:12]ねえまだ間に合うかな光る窓を数えながら'].join(T);
 const schemes=P=>J.plan(P).cuts.filter(c=>c.line>=0&&Number.isInteger(c.part)).map(c=>c.line+':'+c.part+'='+c.scheme).join();
 let changed=0,total=0;
 for(const style of ['noir','pop','neon'])for(let seed=1;seed<=12;seed++){
  const P=J.defaultProject();P.seed=seed;P.style=J.STYLES[style]?style:P.style;P.lyrics=lyrics;P.durationOverride=20;
  const base=schemes(P);
  for(const ov of [{layout:'stack'},{enter:'fade'},{area:{x:.1,y:.1,w:.5,h:.4,angle:0,lockAspect:true}},{hold:'still',treat:'none'}]){
   const Q={...P,overrides:{1:ov}};total++;if(schemes(Q)!==base)changed++;}
 }
 check(changed===0,'palette changed by hand-set values '+changed+'/'+total);
 // a palette number chosen in the details replaces a locked colour set
 {const P=J.defaultProject();P.seed=2;P.lyrics=lyrics;P.durationOverride=20;
  const pl=J.plan(P),cut=pl.cuts.find(c=>c.line===1&&Number.isInteger(c.part)),n=pl.style.schemes.length;
  P.overrides={1:{lock:true,lockedSeed:pl.lines[1].seed,lockedEffects:{[cut.part]:J.cutLockSnapshot(cut,'lyrics',pl)}}};
  const want=(cut.scheme+1)%n;P.lyricCutOptions={['1:'+cut.part]:{details:{scheme:want,palette:null}}};
  const c2=J.plan(P).cuts.find(c=>c.line===1&&c.part===cut.part);
  check(c2.scheme===want&&!c2.palette,'details palette number is used over the locked colours');}
 return failures;
});
assert.deepEqual(result,[]);assert.deepEqual(errors,[]);await page.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
