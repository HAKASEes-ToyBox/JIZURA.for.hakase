/* Named, portable effect presets. Preview drafts never mutate the editor project. */
(() => {
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v));
J.favoriteId=()=>globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2);
J.normalizeEffectFavorites=value=>{
  if(!Array.isArray(value))return [];
  const ids=new Set();
  return value.flatMap(entry=>{
    try{
      const payload=J.readCutEffects(JSON.stringify(entry.payload));
      let id=typeof entry.id==='string'?entry.id:J.favoriteId();
      if(ids.has(id))id=J.favoriteId();ids.add(id);
      return [{id,name:typeof entry.name==='string'&&entry.name.trim()?entry.name:'Favorite',payload}];
    }catch{return [];}
  });
};
J.requestFavoriteName=initial=>new Promise(resolve=>{
  const L=J.mediaLabel,dialog=document.createElement('dialog');dialog.id='favoriteNameDialog';dialog.className='terms';
  dialog.innerHTML='<form method="dialog"><h2></h2><label class="field filename-field"><span></span><input type="text" maxlength="200" autocomplete="off"></label><div class="terms-foot"><button value="cancel"></button><button value="save" class="primary"></button></div></form>';
  dialog.querySelector('h2').textContent=L('演出をお気に入りに追加','Add effects to favorites');
  dialog.querySelector('label span').textContent=L('お気に入りの名前','Favorite name');
  dialog.setAttribute('aria-label',L('演出をお気に入りに追加','Add effects to favorites'));
  dialog.querySelector('[value="cancel"]').textContent=L('キャンセル','Cancel');dialog.querySelector('[value="save"]').textContent=L('保存','Save');
  const input=dialog.querySelector('input');input.value=initial;
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();dialog.close('save');}});
  dialog.addEventListener('close',()=>{const value=dialog.returnValue==='save'?(input.value.trim()||initial):null;dialog.remove();resolve(value);},{once:true});
  document.body.append(dialog);dialog.showModal();input.select();
});
J.exportEffectFavorites=project=>{
  const preset=J.defaultProject();preset.lyrics='';preset.effectFavorites=clone(project.effectFavorites||[]);preset.favoriteSequence=project.favoriteSequence||0;
  preset.userFonts=clone(project.userFonts||[]);preset.compositeFonts=clone(project.compositeFonts||[]);
  return J.packProject(preset,null);
};
J.readEffectFavorites=async file=>{
  const loaded=await J.unpackProject(file),raw=loaded.project.effectFavorites||[];
  if(!Array.isArray(raw))throw Error(J.mediaLabel('お気に入りの形式が不正です','Invalid favorites format'));
  const favorites=J.normalizeEffectFavorites(raw);
  if(favorites.length!==raw.length)throw Error(J.mediaLabel('読み込めない演出が含まれています','Some favorite effects cannot be imported'));
  return {...loaded,favorites};
};
J.chooseFavoriteImport=count=>new Promise(resolve=>{
  const L=J.mediaLabel,d=document.createElement('dialog');d.id='favoriteImportDialog';d.className='terms';
  d.innerHTML='<form method="dialog"><h2></h2><p></p><div class="terms-foot"><button value="append" class="primary"></button><button value="replace"></button><button value="cancel"></button></div></form>';
  d.querySelector('h2').textContent=L('お気に入りをインポート','Import favorites');
  d.querySelector('p').textContent=L(`${count}件のお気に入りを取り込みます。上書きすると現在のお気に入りをすべて置き換えます。`, `Import ${count} favorites. Replace overwrites all current favorites.`);
  for(const [value,ja,en] of [['cancel','キャンセル','Cancel'],['replace','上書き','Replace'],['append','追加','Append']])d.querySelector(`[value="${value}"]`).textContent=L(ja,en);
  d.addEventListener('close',()=>{const mode=d.returnValue;d.remove();resolve(['append','replace'].includes(mode)?mode:null);},{once:true});document.body.append(d);d.showModal();
});
J.settingsFromFavorites=project=>{
  const pools=Object.fromEntries(J.GROUP_KEYS.map(g=>[g,new Set()])),media=new Set(),decor=new Set();
  let custom=0;
  for(const favorite of project.effectFavorites||[]){
    const {kind,details:d,native:n}=J.readCutEffects(JSON.stringify(favorite.payload));
    if(d.drawing)custom++;
    if(kind==='lyrics'){
      for(const g of J.GROUP_KEYS)if(typeof d[g]==='string'&&Object.hasOwn(J.registry(g),d[g]))pools[g].add(d[g]);
      for(const item of d.decor||[])pools.decor.add(item.id);
      for(const event of d.effectEvents||[])pools.fx.add(event.type);
    }else{
      for(const key of [n.technique,n.entrance,n.departure])if(J.MEDIA_TECH[key])media.add(key);
      // Resolve legacy/detail-only media choices to corresponding registry recipes.
      if(!J.MEDIA_TECH[n.technique]&&n.technique!=='none')for(const [key,def] of Object.entries(J.MEDIA_TECH)){
        const fields=['hold','treat','trans'].filter(k=>d[k]&& !['none','still'].includes(d[k]));
        if(!def.stage&&fields.length&&fields.every(k=>def[k]===d[k]))media.add(key);
      }
      for(const [field,stage] of [['enter','enter'],['exit','exit']])if(d[field]&&!['none','cut'].includes(d[field]))for(const [key,def] of Object.entries(J.MEDIA_TECH))if(def.stage===stage&&def.motion===d[field])media.add(key);
      for(const item of d.decor||[])decor.add(item.id);
    }
  }
  project.enabled=Object.fromEntries(J.GROUP_KEYS.map(g=>[g,Object.fromEntries(J.order(g).map(key=>[key,pools[g].has(key)]))]));
  for(const layer of ['foreground','media']){
    const settings=J.mediaEffectSettings(project,layer);
    settings.enabled=Object.fromEntries(Object.keys(J.MEDIA_TECH).map(key=>[key,media.has(key)]));
    settings.decorEnabled=Object.fromEntries(Object.keys(J.DECOR).map(key=>[key,decor.has(key)]));settings.decor=decor.size>0;
    project[layer].effects=settings;
  }
  return {custom};
};
J.openEffectFavorites=({project,target,compose,changed,configure,apply,closed})=>{
  const L=J.mediaLabel,dialog=document.createElement('dialog');dialog.id='effectFavoritesDialog';
  dialog.innerHTML='<header><h2></h2><button type="button" class="favorite-import"></button><button type="button" class="favorite-export"></button><button type="button" class="favorite-configure"></button><input type="file" class="favorite-file" hidden accept=".jizuraichifav,.jizuraichi,.json"><button type="button" class="favorite-close">×</button></header><p class="favorite-help"></p><div class="favorite-groups"></div>';
  J.configurePortableFileInput(dialog.querySelector('.favorite-file'));
  dialog.querySelector('h2').textContent=L('お気に入り演出','Favorite effects');
  dialog.setAttribute('aria-label',L('お気に入り演出','Favorite effects'));
  dialog.querySelector('.favorite-close').setAttribute('aria-label',L('閉じる','Close'));
  dialog.querySelector('.favorite-close').onclick=()=>dialog.close();
  document.body.append(dialog);
  const list=project.effectFavorites ||= [],host=dialog.querySelector('.favorite-groups');
  let active=null,frame=0,dead=false,token=0,sampleId=null;
  let busy=false;
  const importButton=dialog.querySelector('.favorite-import'),exportButton=dialog.querySelector('.favorite-export'),fileInput=dialog.querySelector('.favorite-file');
  importButton.textContent=L('インポート','Import');exportButton.textContent=L('エクスポート','Export');
  const configureButton=dialog.querySelector('.favorite-configure');configureButton.textContent=L('お気に入りを元に設定変更','Use favorites for settings');
  configureButton.onclick=()=>{const result=J.settingsFromFavorites(project);configure?.();changed();status.textContent=L('お気に入りで使われている演出のみを抽選対象に設定しました。','Random choices now use only effects present in favorites.')+(result.custom?L(' 独自描画プログラムは抽選項目を持たないため、カットへの直接適用をご利用ください。',' Custom drawing programs have no random-pool entries; apply them directly to cuts.'):'');};
  const status=document.createElement('p');status.className='favorite-transfer-status';status.setAttribute('role','status');dialog.append(status);
  function transferBusy(value){busy=value;importButton.disabled=exportButton.disabled=value;configureButton.disabled=value||!list.length;}
  exportButton.onclick=async()=>{
    if(busy)return;transferBusy(true);status.textContent='';
    try{await J.saveFile('favorites.jizuraichifav',await J.exportEffectFavorites(project));}
    catch(e){status.textContent=L('書き出せませんでした：','Could not export: ')+e.message;}
    finally{transferBusy(false);}
  };
  importButton.onclick=()=>{if(!busy)fileInput.click();};
  fileInput.onchange=()=>{const file=fileInput.files?.[0];fileInput.value='';importFile(file);};
  async function importFile(file){
    if(!file||busy||dead)return;
    transferBusy(true);status.textContent='';
    try{
      const loaded=await J.readEffectFavorites(file);if(dead)return;
      const mode=await J.chooseFavoriteImport(loaded.favorites.length);if(!mode||dead)return;
      // Existing song, cuts and material stay intact. Restore only missing font dependencies.
      const fonts=(loaded.project.userFonts||[]).filter(f=>!(project.userFonts||[]).some(old=>old.key===f.key));
      for(const entry of loaded.files)if(entry.kind==='font'&&fonts.some(f=>f.key===entry.id))await J.saveFontFile(entry.id,entry.file);
      await J.restoreFontFiles(fonts);if(dead)return;
      project.userFonts=[...(project.userFonts||[]),...fonts];
      for(const f of fonts)if(!J.FONTS[f.key])J.addUserFont(f.key,f.label,f.family,f.weight||400);
      project.compositeFonts=[...(project.compositeFonts||[]),...(loaded.project.compositeFonts||[]).filter(f=>!(project.compositeFonts||[]).some(old=>old.key===f.key))];
      J.setCompositeFonts(project.compositeFonts);
      if(mode==='replace')list.length=0;
      list.push(...loaded.favorites.map(f=>({...f,id:J.favoriteId()})));
      project.favoriteSequence=Math.max(project.favoriteSequence||0,loaded.project.favoriteSequence||0,list.length);
      changed();await ensureSample();if(dead)return;render();
      status.textContent=L(`${loaded.favorites.length}件をインポートしました`, `Imported ${loaded.favorites.length} favorites`);
    }catch(e){status.textContent=L('読み込めませんでした：','Could not import: ')+e.message;}
    finally{transferBusy(false);}
  };
  let dragDepth=0;
  const isFileDrag=event=>Array.from(event.dataTransfer?.types||[]).includes('Files');
  dialog.addEventListener('dragenter',event=>{
    if(!isFileDrag(event))return;event.preventDefault();event.stopPropagation();
    dragDepth++;if(!busy)dialog.classList.add('favorite-drop-active');
  });
  dialog.addEventListener('dragover',event=>{
    if(!isFileDrag(event))return;event.preventDefault();event.stopPropagation();
    event.dataTransfer.dropEffect=busy?'none':'copy';
  });
  dialog.addEventListener('dragleave',event=>{
    if(!isFileDrag(event))return;event.preventDefault();event.stopPropagation();
    if(--dragDepth<=0){dragDepth=0;dialog.classList.remove('favorite-drop-active');}
  });
  dialog.addEventListener('drop',event=>{
    if(!isFileDrag(event))return;event.preventDefault();event.stopPropagation();
    dragDepth=0;dialog.classList.remove('favorite-drop-active');if(busy)return;
    const files=Array.from(event.dataTransfer.files);
    if(files.length!==1){status.textContent=L('ファイルを1つずつドロップしてください。','Drop one file at a time.');return;}
    if(!/\.(jizuraichifav|jizuraichi|json)$/i.test(files[0].name)){status.textContent=L('お気に入りファイルまたはプロジェクトファイルを指定してください。','Choose a favorites or project file.');return;}
    importFile(files[0]);
  });
  async function ensureSample(){
    if(target||sampleId||!list.some(f=>f.payload.kind==='media'))return;
    const image=J.effectPreviewImage;await image.decode();if(dead)return;
    sampleId='__favorite_preview_'+J.favoriteId();J.mediaAssets.set(sampleId,{element:image,type:'image'});
  }

  const renderer=new J.Renderer(),queue=[];
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);queue.push(entry.target);}}, {root:dialog});
  let armedDelete=null;
  const disarm=()=>{if(armedDelete){armedDelete.textContent='×';armedDelete.setAttribute('aria-label',L('削除を確認','Confirm deletion'));armedDelete=null;}};
  document.addEventListener('click',outsideDelete,true);
  function outsideDelete(event){if(armedDelete&&!armedDelete.contains(event.target))disarm();}
  dialog.addEventListener('close',()=>{document.removeEventListener('click',outsideDelete,true);dead=true;token++;cancelAnimationFrame(frame);observer.disconnect();active=null;queue.length=0;if(sampleId)J.mediaAssets.delete(sampleId);dialog.remove();closed();});
  Object.defineProperty(dialog,'favoritePreview',{get:()=>active&&({plan:active.plan,cut:active.cut})});
  function sample(kind){
    const p=J.defaultProject();p.title='';p.lyrics=kind==='lyrics'?'[00:00]プレビュー|ルビ':'';p.durationOverride=3;p.aspect='16:9';p.res=640;
    p.overrides={0:{single:true}};
    if(kind==='media'){
      const m=p.media=J.normalizeMedia(null);m.items=[{id:sampleId,name:'Preview',type:'image'}];m.manualCuts=true;m.cutCount=1;m.timing.lineTimes={0:0};m.cutOverrides={0:{itemId:sampleId}};
    }
    return p;
  }
  function draft(favorite){
    const layer=target?.layer||(favorite.payload.kind==='lyrics'?'lyrics':'media');
    const p=target?clone({...project,effectFavorites:[]}):sample(favorite.payload.kind);
    const find=plan=>layer==='lyrics'?plan.cuts.find(c=>c.line===(target?.index||0)&&c.part===(target?.part||0)):plan[layer].cuts[target?.index||0];
    p.layerVisibility={...p.layerVisibility,[layer]:true};
    const base=compose(p),cut=find(base);if(!cut)throw Error(L('プレビュー対象がありません','No preview target'));
    J.pasteCutEffects(p,base,layer,cut,favorite.payload);
    const plan=compose(p),result=find(plan);
    if(!result)throw Error(L('プレビュー対象がありません','No preview target'));
    return {plan,cut:result,lyric:favorite.payload.kind==='lyrics'};
  }
  const probe=document.createElement('canvas'),zoom=document.createElement('canvas');
  function focus(state){
    if(!state.lyric)return null;
    const {plan,cut}=state,ratio=plan.W/plan.H;
    probe.width=Math.max(1,Math.round(Math.min(240,240*ratio)));probe.height=Math.max(1,Math.round(probe.width/ratio));
    const ctx=probe.getContext('2d',{willReadFrequently:true}),w=probe.width,h=probe.height;
    const solo={...plan,cuts:[cut],retainedCutIndices:[],events:[]};
    const end=Math.min(cut.end,plan.duration),settle=(cut.inDur||0)+(cut.stagger||0)*Math.max(0,[...(cut.text||'')].length-1);
    let from=cut.start+settle,to=end-(cut.outDur||0);if(to-from<.05){from=cut.start;to=end;}
    let x0=w,y0=h,x1=-1,y1=-1;
    for(let k=0;k<6;k++){
      ctx.clearRect(0,0,w,h);
      renderer.frame(ctx,solo,from+(to-from)*(k+.5)/6,{scale:w/plan.W,noHud:true,noMedia:true,noForeground:true,noPost:true,noTrans:true,transparent:true});
      const data=ctx.getImageData(0,0,w,h).data;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    }
    if(x1<0)return null;
    const size=Math.min(1,Math.max((x1-x0+1)/w,(y1-y0+1)/h,.06)*1.25);
    return {size,x:J.clamp((x0+x1+1)/w/2-size/2,0,1-size),y:J.clamp((y0+y1+1)/h/2-size/2,0,1-size)};
  }
  function paint(canvas,state,t){
    const ratio=state.plan.W/state.plan.H,w=Math.max(1,Math.round(Math.min(480,360*ratio))),h=Math.max(1,Math.round(w/ratio));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    if(state.focus===undefined)state.focus=focus(state);
    const view=state.focus;
    if(!view||view.size>=1){renderer.frame(canvas.getContext('2d'),state.plan,t,{scale:w/state.plan.W,noHud:true});return;}
    const zw=Math.max(1,Math.round(Math.min(1280,1280*ratio,w/view.size))),zh=Math.max(1,Math.round(zw/ratio));
    if(zoom.width!==zw||zoom.height!==zh){zoom.width=zw;zoom.height=zh;}
    renderer.frame(zoom.getContext('2d'),state.plan,t,{scale:zw/state.plan.W,noHud:true});
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);ctx.drawImage(zoom,view.x*zw,view.y*zh,view.size*zw,view.size*zh,0,0,w,h);
  }
  function error(card,e){card.querySelector('.favorite-error').textContent=L('プレビューを再生できません：','Could not preview: ')+e.message;}
  async function start(card,favorite){
    const id=++token;active=null;
    try{
      const state=draft(favorite);
      await J.ensureFonts((state.cut.text||'')+J.drawingText(state.plan),J.fontsOfPlan(state.plan));
      if(dead||id!==token||!card.isConnected)return;
      for(const other of host.querySelectorAll('.favorite-card'))other.classList.toggle('active',other===card);
      active={...state,card,canvas:card.querySelector('canvas'),started:performance.now()};
    }catch(e){error(card,e);}
  }
  function render(){
    configureButton.disabled=busy||!list.length;
    disarm();active=null;token++;observer.disconnect();queue.length=0;host.replaceChildren();
    const items=list.filter(f=>!target||f.payload.kind===(target.layer==='lyrics'?'lyrics':'media'));
    dialog.querySelector('.favorite-help').textContent=items.length
      ?''
      :L('カットの☆から演出を保存すると、ここに表示されます。保存した演出は←☆から好きなカットに適用できます。歌詞用と画像・動画用はそれぞれ対応するカットに適用できます。','Save effects using ☆ on a cut to see them here. Use ←☆ to apply them to any compatible cut. Lyrics and image/video favorites are shown separately.');
    for(const kind of ['lyrics','media']){
      const matches=items.filter(f=>f.payload.kind===kind);if(!matches.length)continue;
      const section=document.createElement('section'),title=document.createElement('h3'),grid=document.createElement('div');grid.className='favorite-grid';
      title.textContent=kind==='lyrics'?L('歌詞用','Lyrics'):L('画像・動画用','Images / videos');section.append(title,grid);host.append(section);
      for(const favorite of matches){
        const card=document.createElement('article');card.className='favorite-card';card.dataset.favoriteId=favorite.id;
        card.innerHTML='<button type="button" class="favorite-play"><canvas width="320" height="180"></canvas><span>▶</span></button><input type="text" class="favorite-name"><div class="favorite-actions"></div><p class="favorite-error" role="status"></p>';
        const name=card.querySelector('input');name.value=favorite.name;name.setAttribute('aria-label',L('お気に入りの名前','Favorite name'));name.maxLength=200;
        name.onchange=()=>{favorite.name=name.value.trim()||favorite.name;name.value=favorite.name;changed();};
        const play=card.querySelector('.favorite-play');play.setAttribute('aria-label',L('プレビューを再生','Play preview'));play.onclick=()=>start(card,favorite);
        card.addEventListener('click',event=>{if(!event.target.closest('button,input,label'))start(card,favorite);});
        const actions=card.querySelector('.favorite-actions');
        if(target){const button=document.createElement('button');button.type='button';button.className='favorite-apply primary';button.textContent=L('←☆ 適用','←☆ Apply');button.onclick=()=>{if(apply(favorite.payload))dialog.close();};actions.append(button);}
        const remove=document.createElement('button');remove.type='button';remove.className='favorite-delete';remove.textContent='×';remove.setAttribute('aria-label',L('削除を確認','Confirm deletion'));remove.onclick=()=>{if(armedDelete!==remove){disarm();armedDelete=remove;remove.textContent=L('削除','Delete');remove.setAttribute('aria-label',L('削除','Delete'));return;}list.splice(list.indexOf(favorite),1);changed();render();};actions.append(remove);
        card.favorite=favorite;grid.append(card);observer.observe(card);
      }
    }
  }
  function tick(now){
    if(dead)return;
    const card=queue.shift();
    if(card?.isConnected){try{const state=draft(card.favorite);paint(card.querySelector('canvas'),state,state.cut.start+Math.min(.7,(state.cut.end-state.cut.start)/2));}catch(e){error(card,e);}}
    if(active){try{const duration=Math.max(.1,Math.min(active.cut.end,active.plan.duration)-active.cut.start),t=active.cut.start+((now-active.started)/1000)%duration;J.syncMediaPreview(active.plan,t,true);paint(active.canvas,active,t);}catch(e){error(active.card,e);active=null;}}
    frame=requestAnimationFrame(tick);
  }
  dialog.showModal();
  (async()=>{
    try{await ensureSample();}catch(e){if(!dead)status.textContent=e.message;return;}
    if(dead)return;render();const first=host.querySelector('.favorite-card');if(first)start(first,first.favorite);frame=requestAnimationFrame(tick);
  })();
};
})();
