// Integration test: the actual pinned models and public inference runtimes.
// Run explicitly; this downloads the 176 MB anime model on first use.
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-unsafe-webgpu']});
 try{
  const page=await browser.newPage(),url='http://localhost:8765/';
  page.on('console',m=>console.log(m.type()+': '+m.text()));page.on('pageerror',e=>console.error('PAGE: '+e.message));
  await page.route(url,r=>r.fulfill({contentType:'text/html',body:fs.readFileSync('index.html')}));
  const samples={anime:'https://raw.githubusercontent.com/SkyTNT/anime-segmentation/main/doc/banner.jpg',rvm:'https://storage.googleapis.com/tfjs-models/assets/posenet/tennis_in_crowd.jpg'};
  let sample;await page.route('**/person-test.png',r=>r.fulfill({contentType:'image/jpeg',body:sample}));await page.goto(url);
  const seen=new Set();
  for(const model of process.argv.slice(2).length?process.argv.slice(2):['rvm','anime','rvm-video','anime']){
   const start=Date.now();console.log('START '+model);
   const engine=model.replace('-video',''),response=await fetch(samples[engine]);assert.ok(response.ok);sample=Buffer.from(await response.arrayBuffer());
   const result=await page.evaluate(async model=>{
    const response=await fetch('/person-test.png');let file=new File([await response.blob()],'person-test.jpg',{type:'image/jpeg'}),type='image';
    const engine=model.replace('-video','');
    if(model.endsWith('-video')){
      const img=await createImageBitmap(file),c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),target=new Mp4Muxer.ArrayBufferTarget(),muxer=new Mp4Muxer.Muxer({target,video:{codec:'avc',width:256,height:256,frameRate:4},fastStart:'in-memory',firstTimestampBehavior:'offset'});
      const encoder=new VideoEncoder({output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),error:e=>{throw e;}});encoder.configure({codec:'avc1.42001e',width:256,height:256,framerate:4,bitrate:600000});
      for(let i=0;i<3;i++){x.fillStyle='black';x.fillRect(0,0,256,256);x.drawImage(img,i*4,0,256,256);const frame=new VideoFrame(c,{timestamp:i*250000,duration:250000});encoder.encode(frame,{keyFrame:i===0});frame.close();}
      await encoder.flush();encoder.close();muxer.finalize();img.close();file=new File([target.buffer],'person-test.mp4',{type:'video/mp4'});type='video';
    }
    const item={id:'real-person-test',type,name:file.name};await J.attachMedia(item,file);
    let last='',cached=false;const report=p=>{const key=p.phase==='download'?p.phase+':'+Math.floor((p.loaded||0)/10485760):p.phase;if(key!==last || p.cached){last=key;console.log('PERSON '+JSON.stringify(p));}cached ||= !!p.cached;};
    const cut={itemId:item.id,name:item.name,type,start:0,end:type==='video'?.25:3,videoStart:type==='video'?.25:0,videoLoop:true};let ref=await J.generatePersonMask(cut,engine,{fps:4,onProgress:report});
    let incremental;
    if(type==='video'){
      const initial=await J.loadPersonMask(ref),initialSlots=[...initial.slots.keys()];ref.display='only';ref.behindLyrics=true;
      const progress=[];ref=await J.generatePersonMask({...cut,end:.75,personCutout:ref},engine,{fps:4,onProgress:p=>{progress.push(p);report(p);}});
      const added=progress.filter(p=>p.phase==='analyze').map(p=>p.sourceFrame);incremental={initialSlots,added,preserved:ref.display==='only'&&ref.behindLyrics};
    }
    await J.preparePersonMask({...cut,personCutout:ref},0);const matte=J.personMaskFrame({...cut,personCutout:ref},0),cv=document.createElement('canvas');cv.width=ref.width;cv.height=ref.height;cv.getContext('2d').drawImage(matte,0,0);const data=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let min=255,max=0;for(let i=3;i<data.length;i+=4){min=Math.min(min,data[i]);max=Math.max(max,data[i]);}
    return {ref,min,max,cached,incremental,png:cv.toDataURL('image/png')};
   },model);
   assert.equal(result.ref.frameCount,model.endsWith('-video')?3:1);assert.ok(result.min<result.max,'model outputs a nonconstant alpha mask: '+JSON.stringify({min:result.min,max:result.max}));
   if(model.endsWith('-video'))assert.deepEqual(result.incremental,{initialSlots:[1],added:[0,2],preserved:true});
   if(seen.has(engine))assert.equal(result.cached,true,'reuse persisted model cache');seen.add(engine);
   if(process.env.PERSON_TEST_OUTPUT)fs.writeFileSync(process.env.PERSON_TEST_OUTPUT+'/person-'+model+'-matte.png',Buffer.from(result.png.split(',')[1],'base64'));
   console.log('PASS '+model+' '+JSON.stringify({...result,png:undefined,elapsedMs:Date.now()-start}));
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
