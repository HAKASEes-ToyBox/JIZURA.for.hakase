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
J.openEffectFavorites=({project,target,compose,changed,apply,closed})=>{
  const L=J.mediaLabel,dialog=document.createElement('dialog');dialog.id='effectFavoritesDialog';
  dialog.innerHTML='<header><h2></h2><button type="button" class="favorite-close">×</button></header><p class="favorite-help"></p><div class="favorite-groups"></div>';
  dialog.querySelector('h2').textContent=L('お気に入り演出','Favorite effects');
  dialog.setAttribute('aria-label',L('お気に入り演出','Favorite effects'));
  dialog.querySelector('.favorite-close').setAttribute('aria-label',L('閉じる','Close'));
  dialog.querySelector('.favorite-close').onclick=()=>dialog.close();
  document.body.append(dialog);
  const list=project.effectFavorites ||= [],host=dialog.querySelector('.favorite-groups');
  let active=null,frame=0,dead=false,token=0,sampleId=null;
  const renderer=new J.Renderer(),queue=[];
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);queue.push(entry.target);}}, {root:dialog});
  let pressedOutside=false;
  const outside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
  dialog.addEventListener('pointerdown',e=>{pressedOutside=e.target===dialog&&outside(e);});
  dialog.addEventListener('click',e=>{if(pressedOutside&&e.target===dialog&&outside(e))dialog.close();pressedOutside=false;});
  dialog.addEventListener('close',()=>{dead=true;token++;cancelAnimationFrame(frame);observer.disconnect();active=null;queue.length=0;if(sampleId)J.mediaAssets.delete(sampleId);dialog.remove();closed();});
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
    return {plan,cut:result};
  }
  function paint(canvas,state,t){
    const ratio=state.plan.W/state.plan.H,w=Math.max(1,Math.round(Math.min(320,240*ratio))),h=Math.max(1,Math.round(w/ratio));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    renderer.frame(canvas.getContext('2d'),state.plan,t,{scale:w/state.plan.W,noHud:true});
  }
  function error(card,e){card.querySelector('.favorite-error').textContent=L('プレビューを再生できません：','Could not preview: ')+e.message;}
  async function start(card,favorite){
    const id=++token;active=null;
    try{
      const state=draft(favorite);
      await J.ensureFonts(state.cut.text||'',J.fontsOfPlan(state.plan));
      if(dead||id!==token||!card.isConnected)return;
      for(const other of host.querySelectorAll('.favorite-card'))other.classList.toggle('active',other===card);
      active={...state,card,canvas:card.querySelector('canvas'),started:performance.now()};
    }catch(e){error(card,e);}
  }
  function render(){
    active=null;token++;observer.disconnect();queue.length=0;host.replaceChildren();
    const items=list.filter(f=>!target||f.payload.kind===(target.layer==='lyrics'?'lyrics':'media'));
    dialog.querySelector('.favorite-help').textContent=items.length
      ?L('▶でプレビューを再生。名前はその場で変更できます。','Play a preview with ▶. Edit names directly.')
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
        const actions=card.querySelector('.favorite-actions');
        if(target){const button=document.createElement('button');button.type='button';button.className='favorite-apply primary';button.textContent=L('←☆ 適用','←☆ Apply');button.onclick=()=>{if(apply(favorite.payload))dialog.close();};actions.append(button);}
        const remove=document.createElement('button');remove.type='button';remove.className='favorite-delete';remove.textContent=L('削除','Delete');remove.onclick=()=>{list.splice(list.indexOf(favorite),1);changed();render();};actions.append(remove);
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
    if(!target&&list.some(f=>f.payload.kind==='media')){
      const image=J.effectPreviewImage;
      try{await image.decode();if(dead)return;sampleId='__favorite_preview_'+J.favoriteId();J.mediaAssets.set(sampleId,{element:image,type:'image'});}catch(e){if(dead)return;dialog.querySelector('.favorite-help').textContent=e.message;return;}
    }
    if(dead)return;render();const first=host.querySelector('.favorite-card');if(first)start(first,first.favorite);frame=requestAnimationFrame(tick);
  })();
};
})();
