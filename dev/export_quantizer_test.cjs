const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{for(const lang of ['', 'en/'])for(const width of [1500,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url()==='http://127.0.0.1/'?r.fulfill({contentType:'text/html',body:fs.readFileSync(lang+'index.html')}):r.abort());await page.goto('http://127.0.0.1/');
 await page.evaluate(()=>{const p=J.defaultProject();p.lyrics='QP';p.videoSize={w:320,h:180};p.fps=60;p.durationOverride=.1;p.exportBitrate=160000000;J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();document.querySelector('[data-export-dialog="mp4"]').click();});
 await page.locator('#outQuality').selectOption('qp');assert(await page.locator('#outQP').isVisible());assert(await page.locator('#outQPNote').isVisible());assert(await page.locator('#outBitrate').isHidden());assert.equal(await page.locator('#outQP').inputValue(),'12');
 assert(await page.locator('#outQP').evaluate(el=>{const a=el.getBoundingClientRect(),b=document.getElementById('exportDlg').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right;}),'QP input fits dialog');
 await page.locator('#outQP').fill('8');await page.waitForFunction(()=>!document.getElementById('btnMP4').disabled);
 const metrics=await page.evaluate(async()=>{
  const project=J.ui.project,plan=J.ui.plan;
  const loaded=await J.unpackProject(await J.packProject(project,null));if(loaded.project.exportQP!==8||loaded.project.quality!=='qp'||J.applyProjectSettings(J.defaultProject(),project).exportQP!==8)throw Error('QP not persisted');
  for(const qp of [-1,52,1.5,NaN]){let rejected=false;try{J.videoQuantizer({...project,exportQP:qp});}catch{rejected=true;}if(!rejected)throw Error('invalid QP accepted');}
  if(J.videoQuantizer({exportQP:0})!==0||J.videoQuantizer({exportQP:51})!==51)throw Error('QP endpoints lost');
  // Older implementations may ignore bitrateMode; never claim QP support then.
  const Original=VideoEncoder;window.VideoEncoder=class extends Original{static async isConfigSupported(config){return {supported:true,config:{...config,bitrateMode:'variable'}};}};
  try{if(await J.pickVideoCodec(320,180,60,undefined,{bitrateMode:'quantizer'}))throw Error('silent fallback');let rejected=false;try{await J.exportMP4({project,plan});}catch(e){rejected=/QP/.test(e.message);}if(!rejected)throw Error('unsupported QP not reported');}finally{window.VideoEncoder=Original;}
  const Renderer=J.Renderer,configs=[],options=[];window.VideoEncoder=class extends Original{configure(config){configs.push(config);super.configure(config);}encode(frame,opts){options.push(opts);super.encode(frame,opts);}};
  const fixture=document.createElement('canvas');fixture.width=320;fixture.height=180;const fc=fixture.getContext('2d'),pixels=fc.createImageData(320,180);
  for(let y=0;y<180;y++)for(let x=0;x<320;x++){const i=(y*320+x)*4;pixels.data[i]=165+35*Math.sin(x/23)+10*Math.sin(y/13);pixels.data[i+1]=100+50*y/180+8*Math.cos(x/7);pixels.data[i+2]=210+25*x/320;pixels.data[i+3]=255;}fc.putImageData(pixels,0,0);fc.strokeStyle='#21142f';fc.lineWidth=1;for(let x=10;x<320;x+=17){fc.beginPath();fc.moveTo(x,0);fc.lineTo(x+35,180);fc.stroke();}const reference=fc.getImageData(0,0,320,180).data;
  J.Renderer=class{frame(ctx){ctx.drawImage(fixture,0,0);}};
  try{
   const result=[];
   for(const qp of [8,38]){
    const out=await J.exportMP4({project:{...project,exportQP:qp},plan}),url=URL.createObjectURL(out.blob),video=document.createElement('video');
    try{video.src=url;await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(Error('MP4 decode failed'));});await new Promise(resolve=>{video.onseeked=resolve;video.currentTime=.03;});fc.drawImage(video,0,0);const decoded=fc.getImageData(0,0,320,180).data;let mse=0;for(let i=0;i<decoded.length;i+=4)for(let c=0;c<3;c++)mse+=(decoded[i+c]-reference[i+c])**2;mse/=320*180*3;result.push({qp,bytes:out.blob.size,mse});}finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
   }
   if(configs.some(c=>c.bitrateMode!=='quantizer'||'bitrate'in c))throw Error('QP encoding still uses bitrate');if(options.some(o=>!o.avc||![8,38].includes(o.avc.quantizer)))throw Error('frame QP missing');
   if(!(result[0].bytes>result[1].bytes&&result[0].mse<result[1].mse))throw Error('QP does not affect actual quality: '+JSON.stringify(result));return result;
  }finally{window.VideoEncoder=Original;J.Renderer=Renderer;}
 });
 await page.locator('#outQP').fill('52');await page.waitForFunction(()=>document.getElementById('btnMP4').disabled);assert(!(await page.locator('#outQP').evaluate(el=>el.checkValidity())));
 await page.locator('#outQP').fill('0');await page.waitForFunction(()=>!document.getElementById('btnMP4').disabled);assert.equal(await page.evaluate(()=>J.ui.project.exportQP),0);
 await page.locator('#outQuality').selectOption('custom');assert(await page.locator('#outQP').isHidden());assert.equal(await page.locator('#outBitrate').inputValue(),'160');await page.locator('#outQuality').selectOption('qp');
 await page.evaluate(()=>{document.getElementById('exportDlg').close();document.querySelector('[data-export-dialog="png"]').click();});assert(await page.locator('#outQP').isHidden());assert(await page.locator('#outQPNote').isHidden());assert.deepEqual(errors,[]);
 console.log('PASS QP export, decoded quality, support, persistence '+(lang||'ja')+' '+width,JSON.stringify(metrics));await page.close();
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
