const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const locale of ['', 'en/'])for(const ios of [false,true]){
 const page=await browser.newPage(ios?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_2 like Mac OS X) AppleWebKit/605.1.15 CriOS/154.0.8037.55 Mobile/15E148 Safari/604.1'}:{});await page.route('**/*',r=>r.request().url()==='http://127.0.0.1/'?r.fulfill({contentType:'text/html',body:fs.readFileSync(locale+'index.html')}):r.abort());await page.goto('http://127.0.0.1/');
 const result=await page.evaluate(async()=>{
  J.ui.exporting={};const nativeTimeout=setTimeout;window.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,ms===15000?1000:ms,...args);
  // Model a mobile decoder that needs playback for frames after metadata and
  // after a rewind. Pausing before that seek finishes leaves seeking=true.
  class Video extends EventTarget{
   constructor(){super();this.readyState=1;this.duration=5;this.paused=true;this.seeking=false;this.error=null;this.time=0;this.playCalls=0;this.seekCalls=0;}
   get currentTime(){return this.time;}
   set currentTime(time){this.time=time;this.seeking=true;this.seekCalls++;nativeTimeout(()=>{if(this.paused||this.readyState<2)return;this.seeking=false;this.dispatchEvent(new Event('seeked'));},20);}
   pause(){this.paused=true;}
   play(){this.playCalls++;this.paused=false;return new Promise(resolve=>nativeTimeout(()=>{if(this.paused)return;this.readyState=2;this.seeking=false;this.time+=.05;this.dispatchEvent(new Event('loadeddata'));resolve();},50));}
  }
  const out=[];
  for(const target of [0,.75]){const video=new Video();try{await J.seekMediaVideo(video,target);out.push({target,time:video.currentTime,paused:video.paused,seeking:video.seeking,playCalls:video.playCalls,seekCalls:video.seekCalls});}catch(error){out.push({target,error:error.message});}}
  const video=new Video(),asset={type:'video',element:video};J.mediaAssets.set('mobile-seek',asset);const cut={index:0,itemId:'mobile-seek',type:'video',start:0,end:4,videoStart:0,videoLoop:false},plan={media:{cuts:[cut]},foreground:{cuts:[]}};
  for(const target of [.75,1.25]){
   const complete=new Promise(resolve=>window.addEventListener('jizura-media-ready',resolve,{once:true}));J.syncMediaPreview(plan,target,false);const refresh=setInterval(()=>J.syncMediaPreview(plan,target,false),5);await complete;clearInterval(refresh);
   out.push({target,time:video.currentTime,paused:video.paused,seeking:video.seeking,error:asset.previewError||undefined,playCalls:video.playCalls});
  }
  J.mediaAssets.delete('mobile-seek');
  class QuietVideo extends Video{
   constructor(){super();this.readyState=4;}
   get currentTime(){return this.time;}
   set currentTime(time){this.time=time-.0002703;this.seeking=true;this.seekCalls++;nativeTimeout(()=>{this.seeking=false;},20);}
   play(){this.playCalls++;this.paused=false;return Promise.resolve();}
  }
  const quiet=new QuietVideo();quiet.playbackRate=1.2368;let quietError;try{await J.seekMediaVideo(quiet,2.15);}catch(error){quietError=error.message;}
  class LateVideo extends QuietVideo{
   get currentTime(){return this.time;}
   set currentTime(time){this.time=time;this.seeking=true;this.seekCalls++;}
   play(){this.playCalls++;this.paused=false;nativeTimeout(()=>{this.seeking=false;},20);return new Promise(resolve=>nativeTimeout(resolve,100));}
  }
  const late=new LateVideo();await J.seekMediaVideo(late,1);late.play();await new Promise(resolve=>nativeTimeout(resolve,130));
  const running=new QuietVideo(),runningAsset={type:'video',element:running};J.mediaAssets.set('mobile-seek',runningAsset);J.syncMediaPreview(plan,.75,true);const pausedDuringSeek=running.paused;J.syncMediaPreview(plan,.8,true);await new Promise(resolve=>nativeTimeout(resolve,30));J.syncMediaPreview(plan,.8,true);const stillPlaying=!running.paused;J.mediaAssets.delete('mobile-seek');
  // Reproduce small clock drift during continuous playback. iOS must keep one
  // speed instead of disturbing the decoder with a rate change every frame.
  const steady=new QuietVideo();steady.paused=false;steady.playbackRate=1;const steadyAsset={type:'video',element:steady,previewCut:cut,previewTime:1};J.mediaAssets.set('mobile-seek',steadyAsset);const rates=[];
  for(let i=0;i<60;i++){const t=1+i/60;steady.time=t-(.25+.05*Math.sin(i));J.syncMediaPreview(plan,t,true);rates.push(steady.playbackRate);}
  const steadySeeks=steady.seekCalls;steady.time=1;J.syncMediaPreview(plan,3,true);const largeDriftSeeks=steady.seekCalls;J.mediaAssets.delete('mobile-seek');
  window.setTimeout=nativeTimeout;return {seeks:out,quietError,quietTime:quiet.currentTime,quietRate:quiet.playbackRate,quietPlayCalls:quiet.playCalls,latePlayCalls:late.playCalls,latePaused:late.paused,pausedDuringSeek,stillPlaying,rates,steadySeeks,largeDriftSeeks};
 });
 for(const [i,r] of result.seeks.entries()){assert.equal(r.error,undefined,JSON.stringify(r));assert.ok(Math.abs(r.time-r.target)<.002);assert.equal(r.paused,true);assert.equal(r.seeking,false);assert.equal(r.playCalls,i===3?2:1);}
 assert.equal(result.quietError,undefined,'A completed seek without events must not time out');assert.ok(Math.abs(result.quietTime-2.15)<.002);assert.equal(result.quietRate,1,'Frame preparation must reset the previous correction speed');assert.equal(result.quietPlayCalls,0,'An ordinary paused seek must not restart playback');assert.equal(result.latePlayCalls,2,'A stalled paused seek needs decoder playback and then a newer play request');assert.equal(result.latePaused,false,'A late preparation promise must not stop newer playback');assert.equal(result.pausedDuringSeek,false);assert.equal(result.stillPlaying,true,'Sync must keep playback running during seeks');
 assert.equal(result.steadySeeks,0,'Small drift must not trigger repeated seeks');assert.equal(result.largeDriftSeeks,1,'Large drift must still be corrected');if(ios)assert.ok(result.rates.every(rate=>rate===1),'iOS must keep a steady playback rate');else assert.ok(result.rates.some(rate=>rate>1),'Desktop rate correction is retained');
 console.log('PASS mobile decoder seek '+(locale||'ja')+' '+(ios?'iPhone':'desktop'));await page.close();
 }}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
