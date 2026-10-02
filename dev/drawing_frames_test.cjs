// Drawing programs stay intact when the display area or the lyric size changes:
//   units:"short" keeps w/h proportional (round circles in any aspect), frame:"text" places decor on the
//   lyric's resting text box, ox/oy offset in short-edge units, and layout programs report the text box
//   they drew so stock decor and frame:"text" components can follow custom layouts; {param,mul} scales a
//   parameter so one size value can resize a multi-part shape.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://localhost:8765/';await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'index.html'))}):r.continue());
 await page.goto(url);
 const r=await page.evaluate(async()=>{
  // bounding box of pixels whose green channel dominates
  const greenBox=cv=>{const {data}=cv.getContext('2d').getImageData(0,0,cv.width,cv.height);let b=null;
   for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){const i=(y*cv.width+x)*4;if(data[i+1]>200&&data[i]<80&&data[i+2]<80){b=b?{x0:Math.min(b.x0,x),y0:Math.min(b.y0,y),x1:Math.max(b.x1,x+1),y1:Math.max(b.y1,y+1)}:{x0:x,y0:y,x1:x+1,y1:y+1};}}return b;};
  const canvas=(w,h)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;};
  const out={};
  // 1 units:"short" circle is round on a portrait canvas; area units stretch it
  for(const units of ['short','frame']){const cv=canvas(180,320);J.drawProgram(cv.getContext('2d'),{version:1,mode:'overlay',nodes:[{type:'ellipse',x:.5,y:.5,w:.5,h:.5,units,fill:'#00ff00'}]},{W:180,H:320});const b=greenBox(cv);out[units]=[b.x1-b.x0,b.y1-b.y0];}
  // 2 frame:"text" + ox/oy: a rect filling the given text box, shifted by half its height
  {const cv=canvas(400,300);J.drawProgram(cv.getContext('2d'),{version:1,mode:'overlay',nodes:[{type:'rect',frame:'text',x:0,y:0,w:1,h:1,ox:.5,fill:'#00ff00'}]},{W:400,H:300,box:{x0:100,y0:120,x1:300,y1:160}});out.text=greenBox(cv);}
  // without a box, frame:"text" falls back to the area
  {const cv=canvas(200,100);J.drawProgram(cv.getContext('2d'),{version:1,mode:'overlay',nodes:[{type:'rect',frame:'text',x:.25,y:.25,w:.5,h:.5,fill:'#00ff00'}]},{W:200,H:100});out.fallback=greenBox(cv);}
  // 3 layout programs return the box of the text they drew (here: the stub's local box, translated)
  {const cv=canvas(400,200);out.drawn=J.drawProgram(cv.getContext('2d'),{version:1,mode:'replace',nodes:[{type:'text',text:'$text',x:.5,y:.5,w:1,size:.2}]},{W:400,H:200,text:'AB',drawText:()=>({x0:-30,y0:-10,x1:30,y1:10})});}
  // 4 validation; parameter references scaled by mul (one size parameter resizes a multi-part shape)
  out.mul=[J.drawingValue({param:'size',mul:.5},0,{size:4}),J.drawingValue({param:'size',default:2,mul:3},0,{}),J.drawingValue({value:{param:'size',mul:2},amplitude:0},0,{size:1.5})];
  out.badMul=(()=>{try{J.validateDrawing({version:1,mode:'overlay',nodes:[{type:'rect',x:{param:'size',mul:'2'}}]});return false;}catch{return true;}})();
  out.badFrame=(()=>{try{J.validateDrawing({version:1,mode:'overlay',nodes:[{type:'rect',frame:'screen'}]});return false;}catch{return true;}})();
  out.badUnits=(()=>{try{J.validateDrawing({version:1,mode:'overlay',nodes:[{type:'rect',units:'px'}]});return false;}catch{return true;}})();
  // 5 a decor component on the text box follows the lyric in landscape and portrait, and at a smaller scale
  const deco={version:1,id:'custom_test_textbox',group:'decor',name:'文字枠',nameEn:'Text box',tags:['pop'],layer:'back',program:{version:1,mode:'overlay',nodes:[{type:'rect',frame:'text',x:0,y:0,w:1,h:1,fill:'#00ff00'}]}};
  out.decor=[];
  for(const [w,h,scale] of [[640,360,1],[360,640,1],[640,360,.6]]){
   const p=J.defaultProject();J.importCustomEffects(p,[deco]);p.lyrics='[00:00]テスト';p.durationOverride=3;p.videoSize={w,h};p.aspect=w>h?'16:9':'9:16';p.res=Math.max(w,h);p.fx={...p.fx,texture:0,glitch:0,chroma:0,hud:'off'};p.lyricEffects={...p.lyricEffects,autoPlacement:false};
   p.overrides={0:{single:true,layout:'center',enter:'cut',hold:'still',exit:'cut',treat:'none',bg:'none',decor:['custom_test_textbox']}};
   if(scale!==1)p.lyricCutOptions={'0:0':{details:{contentScale:scale}}};
   const plan=J.plan(p);plan.media=J.planMedia(p,plan,null,'media');plan.foreground=J.planMedia(p,plan,null,'foreground');
   const cv=canvas(plan.W,plan.H);new J.Renderer().frame(cv.getContext('2d'),plan,.9,{scale:1,noHud:true});
   out.decor.push({W:plan.W,H:plan.H,box:greenBox(cv)});
  }
  return out;
 });
 const [sw,sh]=r.short,[fw,fh]=r.frame;
 assert.ok(Math.abs(sw-sh)<=2&&Math.abs(sw-90)<=2,'short units keep a circle round: '+r.short);
 assert.ok(fh>fw*1.5,'frame units still stretch with the area: '+r.frame);
 assert.deepEqual(r.text,{x0:120,y0:120,x1:320,y1:160},'frame text + ox: '+JSON.stringify(r.text));
 assert.deepEqual(r.fallback,{x0:50,y0:25,x1:150,y1:75},'falls back to the area');
 assert.deepEqual(r.drawn,{x0:170,y0:90,x1:230,y1:110},'layout program reports the drawn text box');
 assert.ok(r.badFrame&&r.badUnits,'invalid frame/units rejected');
 assert.deepEqual(r.mul,[2,6,3],'param × mul');
 assert.ok(r.badMul,'non-numeric mul rejected');
 for(const {W,H,box} of r.decor){
  assert.ok(box,'decor drawn on the text box '+W+'x'+H);
  const cx=(box.x0+box.x1)/2,cy=(box.y0+box.y1)/2;
  assert.ok(Math.abs(cx-W/2)<W*.12&&Math.abs(cy-H/2)<H*.15,'text box decor is centred on the lyric: '+JSON.stringify(box));
  assert.ok(box.x1-box.x0<W*.95&&box.y1-box.y0<H*.6,'text box decor is the text, not the whole area: '+JSON.stringify(box));
 }
 const [land,,small]=r.decor;
 assert.ok(small.box.x1-small.box.x0<(land.box.x1-land.box.x0)*.8,'decor shrinks with the lyric');
 assert.deepEqual(errors,[]);
 console.log('drawing frames test passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
