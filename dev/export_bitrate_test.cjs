const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{for(const lang of ['', 'en/']){
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url()==='http://127.0.0.1/'?r.fulfill({contentType:'text/html',body:fs.readFileSync(lang+'index.html')}):r.abort());await page.goto('http://127.0.0.1/');
 await page.evaluate(()=>{const p=J.defaultProject();p.lyrics='bitrate';p.videoSize={w:320,h:180};p.videoSizeMode='custom';p.fps=24;p.durationOverride=.25;J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();document.querySelector('[data-export-dialog="mp4"]').click();});
 const labels=await page.locator('#outQuality option').allTextContents();
 for(const rate of [.221,.387,.581])assert(labels.some(label=>label.includes('('+rate+' Mbps)')),JSON.stringify(labels));
 assert(await page.locator('#outBitrate').isHidden());await page.locator('#outQuality').selectOption('custom');assert(await page.locator('#outBitrate').isVisible());await page.locator('#outBitrate').fill('5.5');
 assert.equal(await page.evaluate(()=>J.ui.project.exportBitrate),5500000);assert((await page.locator('#outQuality option[value=custom]').textContent()).includes('(5.5 Mbps)'));
 const result=await page.evaluate(async()=>{
   const p=J.ui.project,packed=await J.packProject(p,null),loaded=await J.unpackProject(packed),settings=J.projectSettings(p);
   if(loaded.project.exportBitrate!==5500000||settings.exportBitrate!==5500000||J.applyProjectSettings(J.defaultProject(),p).exportBitrate!==5500000)throw Error('bitrate not persisted');
   for(const value of [0,-1,Infinity]){let rejected=false;try{J.videoBitrate({...p,exportBitrate:value},'custom');}catch{rejected=true;}if(!rejected)throw Error('invalid bitrate accepted');}
   const configs=[],Original=VideoEncoder;window.VideoEncoder=class extends Original{configure(config){configs.push(config);super.configure(config);}};
   try{
     const output=await J.exportMP4({project:p,plan:J.ui.plan});
     if(configs[0]?.bitrate!==5500000)throw Error('encoder uses wrong bitrate');
     if(!output.blob.size)throw Error('empty MP4');
     const url=URL.createObjectURL(output.blob),video=document.createElement('video');
     try{video.src=url;await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(Error('MP4 decode failed'));});if(video.videoWidth!==320||video.videoHeight!==180)throw Error('incorrect export dimensions');}finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
     return output.blob.size;
   }finally{window.VideoEncoder=Original;}
 });assert(result>0);
 await page.locator('#outQuality').selectOption('high');assert(await page.locator('#outBitrate').isHidden());
 await page.locator('#outFps').selectOption('60');assert((await page.locator('#outQuality option[value=high]').textContent()).includes('(0.968 Mbps)'));
 await page.locator('#outQuality').selectOption('custom');assert.equal(await page.locator('#outBitrate').inputValue(),'5.5');
 await page.evaluate(()=>{document.getElementById('exportDlg').close();document.querySelector('[data-export-dialog="png"]').click();});assert(await page.locator('#outBitrate').isHidden());
 assert.deepEqual(errors,[]);console.log('PASS export bitrate labels, custom encoder, persistence '+(lang||'ja'));await page.close();
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
