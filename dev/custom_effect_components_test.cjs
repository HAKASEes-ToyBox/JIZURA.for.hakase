const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {openSettings,timelineAction}=require('./ui_helpers.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const locale of ['', 'en/']){
  const page=await browser.newPage({viewport:{width:1500,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&/^(layout|fx|bg|treat|media decor) /.test(m.text()))errors.push(m.text());});
  const url='http://test/'+locale;await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',locale,'index.html'))}):r.abort());await page.goto(url);
  const result=await page.evaluate(async()=>{
   const check=(v,m)=>{if(!v)throw Error(m);};
   const rect={version:1,mode:'overlay',nodes:[{type:'ellipse',x:.2,y:.2,w:.12,h:.12,fill:'#ff0000'}]};
   const defs=[J.customEffectSpec.example,...['enter','hold','exit','treat','cam'].map(group=>({version:1,id:'custom_'+group,group,name:'独自'+group,nameEn:'Custom '+group,tags:['pop'],base:({enter:'pop',hold:'still',exit:'shrink',treat:'none',cam:'push'})[group],params:{tilt:12},labels:{tilt:{ja:'独自傾き',en:'Custom tilt'}},motion:{rotation:{param:'tilt'}}})),
    ...['bg','fx','trans'].map(group=>({version:1,id:'custom_'+group,group,name:'独自'+group,nameEn:'Custom '+group,tags:['pop'],base:({bg:'none',fx:'invert',trans:'wipe'})[group],program:rect})),
    {version:1,id:'custom_layout',group:'layout',name:'独自アーチ',nameEn:'Custom arch',tags:['pop'],program:{version:1,mode:'replace',nodes:[{type:'arcText',text:'$text',x:.5,y:.55,w:.9,h:.8,size:.16,fill:'fg',contrast:.4}]}},
    ...[['media','pushIn'],['mediaEnter','enter_fade'],['mediaExit','exit_fade']].map(([group,base])=>({version:1,id:'custom_'+group,group,name:'独自'+group,nameEn:'Custom '+group,tags:['pop'],base,params:{shift:.1},labels:{shift:{ja:'移動量',en:'Shift'}},motion:{x:{param:'shift'}},program:rect}))];
   const p=J.defaultProject();J.importCustomEffects(p,defs);p.lyrics='[00:00]プレビュー|ルビ\n[00:03]次の歌詞';p.durationOverride=6;p.res=640;p.fx={...p.fx,texture:0,glitch:0,chroma:0,hud:'off'};
   p.overrides={0:{single:true,layout:'custom_layout',enter:'custom_enter',hold:'custom_hold',exit:'custom_exit',bg:'custom_bg',treat:'custom_treat',cam:'custom_cam',decor:['custom_pop_dots']},1:{single:true,layout:'center',enter:'cut',exit:'cut',hold:'still'}};
   for(const [layer,id] of [['foreground','fg'],['media','bg']]){const image=document.createElement('canvas');image.width=160;image.height=90;const x=image.getContext('2d');x.fillStyle='#0080ff';x.fillRect(0,0,160,90);J.mediaAssets.set(id,{element:image,type:'image',file:await new Promise(resolve=>image.toBlob(resolve))});p[layer]={...p[layer],items:[{id,name:id+'.png',type:'image',width:160,height:90}],manualCuts:true,cutCount:1,timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:id,technique:'custom_media',entrance:'custom_mediaEnter',departure:'custom_mediaExit'}}};}
   J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();
   const cute=J.themeCandidates(p,'cute'),calm=J.themeCandidates(p,'elegant');check(cute.lyrics.decor.includes('custom_pop_dots'),'theme includes custom');check(!calm.lyrics.decor.includes('custom_pop_dots'),'theme excludes inappropriate custom');check(cute.media.includes('custom_media'),'media theme includes custom');
   const cut=J.ui.plan.cuts[0];check(cut.enterP.tilt===12,'motion defaults');check(cut.decor.find(d=>d.id==='custom_pop_dots').radius===.08,'decor defaults');
   const draw=t=>{const cv=document.createElement('canvas');cv.width=640;cv.height=360;new J.Renderer().frame(cv.getContext('2d'),J.ui.plan,t,{scale:1,noHud:true});return cv.toDataURL();};check(draw(.2)!==draw(1.4),'standard phases animate');
   const payload=J.cutEffectsPayload(cut,'lyrics',J.ui.plan);check(payload.components.some(d=>d.group==='decor'),'portable dependencies');
   const valid=J.favoriteAPI.validate(payload);check(valid.details.layout==='custom_layout','validated standard slots');J.favoriteAPI.save(p,{name:'Custom composition',payload});
   const before=JSON.stringify(p);const image=await J.favoriteAPI.preview({payload,project:p,time:1,width:320});check(image.width===320&&image.data.length>100,'agent preview');check(JSON.stringify(p)===before,'preview does not mutate project');
   for(const method of ['settingsProject',null]){const source=method?J[method](p):p,loaded=await J.unpackProject(await J.packProject(source,null));check(JSON.stringify(loaded.project.customEffects)===JSON.stringify(defs),'project/settings definitions round trip');}
   const favorites=await J.exportEffectFavorites(p),fresh=J.defaultProject();J.activateCustomEffects(fresh);check(!J.DECOR.custom_pop_dots,'project isolation');await J.favoriteAPI.import(fresh,favorites,'replace');check(fresh.customEffects.length===defs.length,'favorite import carries components');check(fresh.effectFavorites[0].payload.details.layout==='custom_layout','favorite import validates custom IDs');
   const old=JSON.stringify(fresh);let rejected=false;try{J.importCustomEffects(fresh,[{...defs[0],name:'conflicting'}]);}catch{rejected=true;}check(rejected&&JSON.stringify(fresh)===old,'conflict is atomic');
   for(const invalid of [{...defs[0],id:'center'},{...defs[0],program:{...rect,nodes:[{type:'rect',x:'alert(1)'}]}},{...defs[0],group:'enter'},{...defs[0],params:{bad:Infinity}}]){let bad=false;try{J.validateCustomEffects([invalid]);}catch{bad=true;}check(bad,'invalid component rejected');}
   J.activateCustomEffects(p);J.uiApi.syncUI();J.uiApi.replan();
   window.components=defs;return {count:defs.length,preview:image.data.length};
  });
  assert.ok(result.count>=12);
  await openSettings(page,'pro');
  assert.equal(await page.locator('#techLists label').filter({hasText:locale?'Pop dots':'ポップのドット'}).locator('.set-badge.ex').count(),1);
  assert.equal(await page.locator('#techLists .set-badge.ex').count(),10,'only imported lyric components have Added badges');
  assert.equal(await page.locator('#foregroundEffectsPanel [data-media-tech="custom_media"]').count(),1);
  await page.locator('#closeSettingsDrawer').click();
  await timelineAction(page,'[data-layer="lyrics"][data-index="0"]','details');
  const modal=page.locator('#cutDetailsDialog');await modal.locator('[data-detail-tab="motion"]').click();
  const params=modal.locator('[data-detail-section="enterP"]');await params.evaluate(el=>el.open=true);
  assert.equal(await params.locator('[data-detail-field="enterP.tilt"]').inputValue(),'12');
  assert.ok((await params.textContent()).includes(locale?'Custom tilt':'独自傾き'));
  await params.locator('[data-detail-field="enterP.tilt"]').fill('30');await params.locator('[data-detail-field="enterP.tilt"]').dispatchEvent('change');await page.waitForTimeout(200);
  assert.equal(await modal.evaluate(d=>d.cutPreview.cut.enterP.tilt),30);
  await modal.locator('[data-preview-solo]').check();await page.waitForTimeout(200);
  const glyphs=await modal.locator('.cut-details-preview > canvas').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>180&&d[i+1]>180&&d[i+2]>180)n++;return n;});assert.ok(glyphs>50,'custom text rendered through standard pipeline');
  if(!locale)await page.screenshot({path:'F:/Codex/preview-test-temp/custom-components-preview.png'});
  await modal.getByRole('button',{name:locale?'Apply':'適用',exact:true}).click();
  assert.equal(await page.evaluate(()=>J.ui.plan.cuts[0].enterP.tilt),30);
  assert.deepEqual(errors,[]);await page.close();console.log('PASS custom effect components '+(locale||'ja'));
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
