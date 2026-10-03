const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {openSource}=require('./ui_helpers.cjs');
const wav=Buffer.alloc(44+16000*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const locale of ['', 'en/'])for(const width of [1500,390]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url()==='http://127.0.0.1/'?r.fulfill({contentType:'text/html',body:fs.readFileSync(locale+'index.html')}):r.abort());await page.goto('http://127.0.0.1/');
 const video=await page.evaluate(async bytes=>{
  const snapshot=J.snapshotMediaFile,progress=[];await snapshot(new Blob([new Uint8Array(9*1024*1024)]),(loaded,total)=>progress.push([loaded,total]));
  if(JSON.stringify(progress.map(p=>p[0]))!==JSON.stringify([0,4194304,8388608,9437184]))throw Error('Incorrect byte progress');
  const audio=await J.analyzeAudio(new File([new Uint8Array(bytes)],'fixture.wav',{type:'audio/wav'}));
  window.importStage='';window.importFailure='';window.releaseImport=()=>{const f=window.continueImport;window.continueImport=null;f();};
  const delay=async stage=>{importStage=stage;await new Promise(resolve=>{window.continueImport=resolve;});if(importFailure===stage)throw Error('test '+stage+' failure');};
  const attach=J.attachMedia,store=J.storeMedia;
  J.analyzeAudio=async(file,report=()=>{})=>{report({phase:'decode'});await delay('decode');report({phase:'analyze'});await delay('analyze');return {...audio,name:file.name};};
  J.videoFileDuration=async()=>{await delay('duration');return 2;};
  J.attachMedia=async(...args)=>{await delay('attach');return attach(...args);};
  J.storeMedia=async(id,file)=>{await delay(id.startsWith('audio_')?'save-audio':'save-video');return store(id,file);};
  const c=document.createElement('canvas');c.width=64;c.height=36;const stream=c.captureStream(10),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),parts=[];recorder.ondataavailable=e=>parts.push(e.data);const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();c.getContext('2d').fillRect(0,0,64,36);await new Promise(resolve=>setTimeout(resolve,200));recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());return Array.from(new Uint8Array(await new Blob(parts).arrayBuffer()));
 },Array.from(wav));
 const loading=page.locator('#audioLoadingDialog');
 const waitStage=async(stage,label)=>{await page.waitForFunction(s=>window.importStage===s,stage);assert.equal(await loading.isVisible(),true);assert.ok((await loading.locator('[role=status]').textContent()).includes(label));assert.equal(await loading.locator('progress').getAttribute('value'),null);};
 const release=()=>page.evaluate(()=>releaseImport());
 for(const background of [true,false]){
  await openSource(page,'lyrics');const name=background?'background.webm':'audio-only.webm';await page.locator('#audioFile').setInputFiles({name,mimeType:'video/webm',buffer:Buffer.from(video)});const options=page.locator('#audioImportDialog');if(!background){await options.locator('[name=background]').uncheck();await options.locator('[name=matchDuration]').uncheck();}
  await options.locator('button[type=submit]').click();await waitStage('decode',locale?'Decoding audio':'音声を展開中');assert.ok((await loading.locator('[role=status]').textContent()).includes(name));assert.equal(await page.evaluate(()=>J.ui.projectBusy),true);
  if(background&&width===390&&!locale&&process.env.JIZURA_TEST_SCREENSHOT_ROOT)await page.screenshot({path:require('node:path').join(process.env.JIZURA_TEST_SCREENSHOT_ROOT,'video-import-progress-mobile.png')});
  for(let i=0;i<3;i++){await page.keyboard.press('Escape');assert.equal(await loading.isVisible(),true);}await page.mouse.click(2,2);assert.equal(await loading.isVisible(),true);
  assert.equal(await page.evaluate(()=>J.uiApi.loadAudioFile(new File(['x'],'other.mp4',{type:'video/mp4'}))),false,'A concurrent host import must not replace the modal');
  await release();await waitStage('analyze',locale?'Analyzing beats':'拍・波形を解析中');await release();await waitStage('duration',locale?'Checking video duration':'動画の長さを確認中');await release();
  if(background){await waitStage('attach',locale?'Preparing background':'背景動画を準備中');await release();await waitStage('save-video',locale?'Saving background':'背景動画をブラウザに保存中');await release();}
  await waitStage('save-audio',locale?'Saving audio':'音声をブラウザに保存中');const oldName=await page.evaluate(()=>J.ui.audio?.name);assert.notEqual(oldName,name,'Import must wait for storage before committing');await release();await loading.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>J.ui.projectBusy),false);assert.equal(await page.evaluate(()=>J.ui.audio.name),name);assert.equal(await page.evaluate(()=>J.ui.project.media.items.length),1);assert.equal(await page.evaluate(()=>J.ui.project.durationOverride),2);
 }
 // A decode failure preserves the previous song and always releases the modal.
 await page.evaluate(()=>importFailure='decode');await page.locator('#audioFile').setInputFiles({name:'bad.webm',mimeType:'video/webm',buffer:Buffer.from(video)});await page.locator('#audioImportDialog [name=background]').uncheck();await page.locator('#audioImportDialog button[type=submit]').click();await waitStage('decode',locale?'Decoding audio':'音声を展開中');await release();await loading.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>J.ui.projectBusy),false);assert.equal(await page.evaluate(()=>J.ui.audio.name),'audio-only.webm');assert.ok((await page.locator('#toast').textContent()).includes('test decode failure'));
 await page.evaluate(()=>{importFailure='save-audio';importStage='';});await page.locator('#audioFile').setInputFiles({name:'save-failure.webm',mimeType:'video/webm',buffer:Buffer.from(video)});await page.locator('#audioImportDialog [name=background]').uncheck();await page.locator('#audioImportDialog button[type=submit]').click();
 for(const [stage,label] of [['decode',locale?'Decoding audio':'音声を展開中'],['analyze',locale?'Analyzing beats':'拍・波形を解析中'],['duration',locale?'Checking video duration':'動画の長さを確認中'],['save-audio',locale?'Saving audio':'音声をブラウザに保存中']]){await waitStage(stage,label);await release();}
 await loading.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>J.ui.projectBusy),false);assert.equal(await page.evaluate(()=>J.ui.audio.name),'audio-only.webm');assert.ok((await page.locator('#toast').textContent()).includes('test save-audio failure'));
 // Silent or unsupported audio tracks must not prevent a valid background video.
 const oldAudio=await page.evaluate(()=>J.ui.project.audioAsset.id);await page.evaluate(()=>{importFailure='decode';importStage='';});await page.locator('#audioFile').setInputFiles({name:'silent.webm',mimeType:'video/webm',buffer:Buffer.from(video)});await page.locator('#audioImportDialog button[type=submit]').click();
 for(const [stage,label] of [['decode',locale?'Decoding audio':'音声を展開中'],['duration',locale?'Checking video duration':'動画の長さを確認中'],['attach',locale?'Preparing background':'背景動画を準備中'],['save-video',locale?'Saving background':'背景動画をブラウザに保存中']]){await waitStage(stage,label);await release();}
 await loading.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>J.ui.projectBusy),false);assert.equal(await page.evaluate(()=>J.ui.audio.name),'audio-only.webm');assert.equal(await page.evaluate(()=>J.ui.project.audioAsset.id),oldAudio);assert.equal(await page.evaluate(()=>J.ui.project.media.items.length),2);assert.equal(await page.evaluate(()=>J.ui.project.media.items.at(-1).name),'silent.webm');assert.ok((await page.locator('#toast').textContent()).includes(locale?'Audio could not be extracted':'音声を取り出せなかった'));
 // Verify the real audio-only decode/analyze path in the storage/project tests too.
 assert.deepEqual(errors,[]);console.log('PASS audio/video loading '+(locale||'ja')+' '+width);await page.close();
 }}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
