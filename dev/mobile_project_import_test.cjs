const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const lang of ['', 'en/']){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.route('**/*',r=>r.request().url()==='http://192.168.10.112/'?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',lang,'index.html'))}):r.abort());
  await page.goto('http://192.168.10.112/');
  const fixture=Buffer.from(await page.evaluate(async()=>{
   const project=J.defaultProject();project.title='Metadata-only video';
   project.media.items=[{id:'metadata-video',name:'sample.mp4',type:'video'}];
   project.media.manualCuts=true;project.media.cutCount=1;project.media.cutOverrides={0:{itemId:'metadata-video',technique:'none'}};
   J.mediaAssets.set('metadata-video',{file:new File(['test'],'sample.mp4',{type:'video/mp4'})});
   const blob=await J.packProject(project,null);J.mediaAssets.delete('metadata-video');
   const original=document.createElement.bind(document);
   document.createElement=function(tag,...args){
    const el=original(tag,...args);
    if(tag==='video')Object.defineProperties(el,{
     videoWidth:{value:120},videoHeight:{value:80},duration:{value:4},readyState:{value:1,writable:true},
     src:{set(){setTimeout(()=>el.dispatchEvent(new Event('loadedmetadata')),30);}}
    });
    return el;
   };
   return [...new Uint8Array(await blob.arrayBuffer())];
  }));
  await page.locator('#fileProject').setInputFiles({name:'pc.jizuraichi',mimeType:'application/octet-stream',buffer:fixture});
  await page.waitForFunction(()=>J.ui.project.title==='Metadata-only video'&&!J.ui.projectBusy,null,{timeout:5000});
  assert.equal(await page.locator('#projectLoadingDialog').count(),0);
  assert.equal(await page.evaluate(()=>J.mediaAssets.get('metadata-video').element.readyState),1);
  // A metadata-only decoder has a valid fallback, even before iOS produces frames.
  await page.waitForFunction(()=>{const img=document.querySelector('#mediaList img[data-media-thumb="metadata-video"]');return img?.complete&&img.naturalWidth===96;});
  assert.match(await page.locator('#mediaList img').getAttribute('src'),/^data:image\/svg\+xml,/);
  // When the delayed frame arrives, update existing list/cut thumbnails in place.
  await page.evaluate(()=>{
    const video=J.mediaAssets.get('metadata-video').element,draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(source===video){this.fillStyle='red';this.fillRect(0,0,this.canvas.width,this.canvas.height);}else draw.call(this,source,...args);};
    video.readyState=2;video.dispatchEvent(new Event('loadeddata'));
  });
  await page.waitForFunction(()=>{const img=document.querySelector('#mediaList img[data-media-thumb="metadata-video"]');return img?.src.startsWith('data:image/png')&&img.complete&&img.naturalWidth===96;});
  assert.equal(await page.locator('.media-ln-thumb[data-media-thumb="metadata-video"]').getAttribute('src'),await page.locator('#mediaList img').getAttribute('src'));
  await page.locator('#fileProject').setInputFiles({name:'broken.jizuraichi',mimeType:'application/octet-stream',buffer:fixture.subarray(0,10)});
  await page.waitForFunction(()=>!J.ui.projectBusy);
  assert(await page.locator('#projectLoadingDialog').isVisible());
  assert.equal(await page.evaluate(()=>J.ui.project.title),'Metadata-only video');
  await page.locator('#projectLoadingDialog button').tap();
  console.log((lang||'ja')+': metadata-only import and visible failure passed');await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
