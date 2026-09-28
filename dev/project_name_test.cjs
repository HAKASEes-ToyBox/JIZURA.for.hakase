// Project name: shown next to the song title / artist, set by saving (without the optional date) and used
// as the next save's default; 「ファイル名に日時を追加」 appends _yyyyMMddHHmm and is remembered.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{for(const lang of ['','en/']){
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());
 await page.goto(url);
 // Capture saves instead of writing files.
 await page.evaluate(()=>{window.__saves=[];J.saveFile=async name=>{window.__saves.push(name);};const pack=J.packProject;J.packProject=async(project,audio)=>{window.__packedName=project.projectName;return pack(project,audio);};
  J.ui.project.title='夜明けの歌';J.ui.project.projectName='';J.uiApi.syncUI();});
 assert.equal(await page.locator('#projectName').inputValue(),'');
 assert.equal(await page.locator('#projectName').getAttribute('placeholder'),lang?'Project name':'プロジェクト名');
 const save=async({name,date})=>{
  await page.locator('#projectMenu summary').click();await page.locator('#btnSave').click();
  const shown=await page.locator('#saveFilename').inputValue();
  if(name!=null)await page.locator('#saveFilename').fill(name);
  const box=page.locator('#saveFilenameDate');if(await box.isChecked()!==date)await box.click();
  const preview=await page.locator('#saveFilenamePreview').textContent();
  await page.locator('#filenameDlg button[value="save"]').click();await page.waitForTimeout(300);
  return {shown,preview,file:await page.evaluate(()=>window.__saves.at(-1)),projectName:await page.evaluate(()=>J.ui.project.projectName),header:await page.locator('#projectName').inputValue(),packed:await page.evaluate(()=>window.__packedName)};};
 // First save: the default comes from the song title; the date is added but not kept in the name.
 let r=await save({name:'my-project',date:true});
 assert.equal(r.shown,'夜明けの歌.jizuraichi');
 assert.match(r.file,/^my-project_\d{12}\.jizuraichi$/);assert.match(r.preview,/my-project_\d{12}\.jizuraichi/);
 const stamp=r.file.match(/_(\d{12})\./)[1],now=new Date();assert.equal(stamp.slice(0,8),`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`);
 assert.equal(r.projectName,'my-project');assert.equal(r.header,'my-project');assert.equal(r.packed,'my-project','saved file carries the name');
 // Next save: the project name is the default and the date option is remembered.
 r=await save({name:null,date:false});
 assert.equal(r.shown,'my-project.jizuraichi');assert.equal(r.file,'my-project.jizuraichi');assert.equal(r.preview,'');
 await page.locator('#projectMenu summary').click();await page.locator('#btnSave').click();
 assert.equal(await page.locator('#saveFilenameDate').isChecked(),false,'remembered off');await page.keyboard.press('Escape');
 // Editing the header name changes the default; cancelling a save keeps everything.
 await page.locator('#projectName').fill('renamed');
 assert.equal(await page.evaluate(()=>J.ui.project.projectName),'renamed');
 await page.locator('#projectMenu summary').click();await page.locator('#btnSave').click();
 assert.equal(await page.locator('#saveFilename').inputValue(),'renamed.jizuraichi');await page.keyboard.press('Escape');await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>window.__saves.length),2);
 // Settings export still works and does not rename the project.
 await page.locator('#projectMenu summary').click();await page.locator('#btnSaveSettings').click();await page.locator('#filenameDlg button[value="save"]').click();await page.waitForTimeout(300);
 assert.match(await page.evaluate(()=>window.__saves.at(-1)),/_settings\.jizuraichi$/);assert.equal(await page.evaluate(()=>J.ui.project.projectName),'renamed');
 // A new project starts without a name.
 await page.evaluate(()=>{J.ui.project.projectName='x';});
 await page.locator('#projectMenu summary').click();await page.locator('#btnNew').click();await page.locator('#btnCreateProject').click();await page.waitForTimeout(300);
 await page.evaluate(()=>{const d=document.getElementById('themesDlg');if(d.open)d.close();});
 assert.equal(await page.locator('#projectName').inputValue(),'');
 assert.deepEqual(errors,[]);console.log(lang||'ja','project name passed');await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
