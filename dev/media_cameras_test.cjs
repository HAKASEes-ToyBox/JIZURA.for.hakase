const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const lang of ['','en/']){const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://localhost:8765/'+lang;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,lang,'index.html'))}):r.abort());await page.goto(url);
const result=await page.evaluate(()=>{
const failures=[],check=(ok,m)=>{if(!ok)failures.push(m)},keys=J.MEDIA_CAMERA_KEYS,en=document.documentElement.lang==='en',jp=/[\u3040-\u30ff\u4e00-\u9fff]/;
check(keys.length===J.CAMERA_ORDER.length&&keys.length>=30,'camera count '+keys.length);
const optional=keys.filter(k=>!J.randomOk(J.defaultProject(),'cam',k.slice(4)));
for(const key of keys){const def=J.MEDIA_TECH[key],cam=J.CAMERA[def?.camera];check(def&&def.group==='cinema'&&!def.stage&&def.hold===key,'registered '+key);
 check(def.name===(en?'Camera: ':'カメラ：')+cam.name,key+' name '+def.name);check(en?!jp.test(def.name):jp.test(def.name),key+' language '+def.name);}
// Motion: finite, visible and moving over the cut; beat-driven cameras follow the song grid.
const source=document.createElement('canvas');source.width=160;source.height=90;const sx=source.getContext('2d');sx.fillStyle='#39c';sx.fillRect(40,20,80,50);
const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d'),beats=J.beatGrid(120,.25,12);
const media=(hold,withBeats=true)=>{const c={start:2,end:10,index:1,seed:7,enter:'cut',hold,exit:'cut',treat:'none',effectSettings:{motion:1,treatment:1}};Object.defineProperty(c,'songBeats',{value:withBeats?beats:[],configurable:true});return c;};
for(const key of keys){const cut=media(key),states=[.05,.2,.4,1,2.6,4.1,5.5,7.8].map(lt=>J.mediaCameraState(cut,lt/8,160,90));
 check(states.every(s=>s&&Object.values(s).every(Number.isFinite)),key+' nonfinite');check(new Set(states.map(JSON.stringify)).size>1,key+' static');
 for(const lt of [.1,3.3]){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,320,180);ctx.translate(160,90);J.paintMediaEffect(ctx,source,[160,90],cut,lt/8,1,1);check(ctx.getImageData(0,0,320,180).data.some((v,i)=>i%4===3&&v>8),key+' invisible '+lt);}}
{const a=media('cam_beatPunch'),b=media('cam_beatPunch',false);check(JSON.stringify(J.mediaCameraState(a,.2,160,90))!==JSON.stringify(J.mediaCameraState(b,.2,160,90)),'beatPunch ignores song beats');}
// Defaults follow the lyric random rules: 追加分 / off part sets are opt-in; Auto never picks them unless enabled.
const project=J.defaultProject();for(const layer of ['foreground','media']){const s=J.mediaEffectSettings(project,layer);
 for(const key of keys)check(optional.includes(key)?s.enabled[key]===false:s.enabled[key]!==false,layer+' default '+key);
 for(let seed=1;seed<=200;seed++){const k=J.mediaTechnique(project,{seed},J.rng(seed),layer).technique;check(!optional.includes(k),layer+' auto picked '+k);}}
// Planning with an explicit camera on both layers, and the song beat grid attached to the cut.
for(const layer of ['foreground','media'])for(const key of keys){const p=J.defaultProject(),m=p[layer];m.items=[{id:'a',name:'a.png',type:'image',width:160,height:90}];m.manualCuts=true;m.cutCount=1;m.cutOverrides={0:{itemId:'a',technique:key,entrance:'none',departure:'none'}};
 const plan=J.plan(p);plan.beats=beats;const cut=J.planMedia(p,plan,null,layer).cuts[0];check(cut.technique===key&&cut.hold===key&&cut.songBeats===beats,layer+' plan '+key);check(!JSON.stringify(cut).includes('songBeats'),'serialized beats');}
// Themes: each camera is reachable through some theme (with 追加分 on), following the lyric camera pool.
const covered=new Set();for(const id of Object.keys(J.THEMES)){const p=J.defaultProject();p.themes=[id];p.extra=true;const pools=J.themeCandidates(p,id);
 check(pools.lyrics.cam.every(c=>pools.media.includes('cam_'+c)),id+' camera pool');pools.media.filter(k=>k.startsWith('cam_')).forEach(k=>covered.add(k));
 const look=J.omakase(p,J.rng(3));for(const layer of ['foreground','media'])check(Object.entries(look[layer].effects.enabled).every(([k,on])=>!on||pools.media.includes(k)),id+' outside theme');}
for(const key of keys)check(covered.has(key),'no theme for '+key);
check(J.themeCandidates(J.defaultProject(),'pop').media.every(k=>!optional.includes(k)),'pop includes opt-in cameras');
{const p=J.defaultProject();p.extra=true;check(J.mediaEffectSettings(p,'media').enabled[optional.find(k=>J.CAMERA[k.slice(4)].extra)]!==false,'extra switch ignored');}
// Full renderer through the isolated preview plan.
const img=document.createElement('canvas');img.width=160;img.height=90;img.getContext('2d').drawImage(source,0,0);J.mediaAssets.set('__cam__',{element:img,type:'image'});
const out=document.createElement('canvas');out.width=320;out.height=180;const renderer=new J.Renderer();
for(const key of keys.slice(0,40))for(const layer of ['foreground','media']){const plan=J.makeEffectPreviewPlan('media',key,layer,'__cam__');check(plan[layer].cuts[0].hold===key,'preview '+key);for(const t of [.3,2.2])renderer.frame(out.getContext('2d'),plan,t,{scale:320/plan.W,noHud:true});}
J.mediaAssets.delete('__cam__');
return {failures:[...new Set(failures)],count:keys.length,optional:optional.length};});
assert.deepEqual(result.failures,[]);
await page.locator('#modePro').click();await page.locator('[data-tab="mediaFx"]').click();
const cinema=page.locator('#mediaEffectsPanel [data-media-group="cinema"]');assert.equal((await cinema.locator('.tg-name').textContent()).trim(),lang?'Camera':'カメラ');await cinema.locator('summary').click();
const row=cinema.locator('[data-media-tech="cam_orbitDrift"] + span');assert.ok((await row.textContent()).startsWith(lang?'Camera: ':'カメラ：'));
// Themes now decide the candidates; the default check follows the random rule (no hidden pack switches).
assert.equal(await cinema.locator('[data-media-tech="cam_hrNervous"]').isChecked(),await page.evaluate(()=>J.randomOk(J.defaultProject(),'cam','hrNervous')));
assert.deepEqual(errors,[]);console.log(lang||'ja',JSON.stringify({count:result.count,optional:result.optional,cinema:await cinema.locator('.tg-cnt').textContent()}));await page.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
