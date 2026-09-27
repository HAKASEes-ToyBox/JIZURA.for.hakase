/* Isolated technique previews: never replace or save the editor project. */
(() => {
'use strict';
// Label/export tooling also loads src files without browser APIs.
if (typeof Image === 'undefined') return;
let dialog, canvas, heading, frame=0, generation=0, assetId=null, current=null;
const image=new Image();image.src='__EFFECT_PREVIEW_IMAGE__';
// Media previews only: these values drive the preview, never the project.
const MEDIA_SLIDERS=[['motion','動きの強さ','Motion intensity',0,2],['treatment','加工の強さ','Treatment intensity',0,1],['duration','登場・退場時間','Entrance / exit (s)',.05,1.5]];
function stop(){generation++;cancelAnimationFrame(frame);frame=0;if(assetId)J.mediaAssets.delete(assetId);assetId=null;current=null;}
function ensureDialog(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='effectPreviewDialog';
  dialog.innerHTML='<form method="dialog"><button class="effect-preview-close" value="close">×</button></form><h2 id="effectPreviewName"></h2><canvas width="640" height="360"></canvas><div class="effect-preview-settings" hidden></div><p class="effect-preview-error" hidden></p>';
  dialog.setAttribute('aria-labelledby','effectPreviewName');
  dialog.querySelector('button').setAttribute('aria-label',J.mediaLabel('閉じる','Close'));
  document.body.append(dialog);canvas=dialog.querySelector('canvas');heading=dialog.querySelector('h2');
  dialog.addEventListener('close',stop);
  const outside = event => {
    const rect=dialog.getBoundingClientRect();
    return event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom;
  };
  let pressedOutside=false;
  dialog.addEventListener('pointerdown',event=>{pressedOutside=event.target===dialog && outside(event);});
  dialog.addEventListener('click',event=>{
    if(pressedOutside && event.target===dialog && outside(event))dialog.close();
    pressedOutside=false;
  });
}
J.makeEffectPreviewPlan=(group,key,layer='lyrics',id,settings)=>{
  // Media phases last at most 30% of a cut, so long entrance/exit times get longer preview cuts.
  const cutLength=layer!=='lyrics'&&settings?.duration>.9?Math.ceil(settings.duration/.3*10)/10:3;
  const project=J.defaultProject();project.lyrics='[00:00]プレビュー|ルビ\n[00:03]プレビュー|ルビ';project.durationOverride=cutLength*2;
  project.title='';project.aspect='16:9';project.res=640;project.fps=30;project.seed=2468;
  project.fx={...project.fx,hud:'off',texture:0,chroma:0,glitch:0,decor:0,onTwos:false,koma:0};
  for(const i of [0,1])project.overrides[i]={single:true,layout:'center',enter:'cut',hold:'still',exit:'cut',treat:'none',bg:'none',cam:'none',trans:'none',decor:group==='decor'?[key]:[]};
  if(layer!=='lyrics'){
    project.lyrics='';
    const def=J.MEDIA_TECH[key],m=project[layer]=J.normalizeMedia(null);
    m.items=[{id,name:'Preview',type:'image',width:image.naturalWidth,height:image.naturalHeight}];m.manualCuts=true;m.cutCount=2;m.timing.lineTimes={0:0,1:cutLength};
    m.effects={...J.mediaEffectSettings(project,layer),...(settings||{}),autoPlacement:false,applyLyricBackground:false};
    for(const i of [0,1])m.cutOverrides[i]={itemId:id,technique:def.stage?'none':key,entrance:'none',departure:'none',...(def.stage==='enter'?{entrance:key}:def.stage==='exit'?{departure:key}:{})};
  }
  if(group==='fx'&&key==='chroma')project.fx.chroma=.7;
  const plan=J.plan(project);
  plan.events=[];plan.beats=J.beatGrid(120,0,6);
  if(layer==='lyrics')for(const cut of plan.cuts){
    if(cut.line<0)continue;
    if(group!=='decor')cut.decor=[];cut.bg='none';cut.cam='none';cut.trans=null;
    const details={inDur:.8,outDur:.8};
    if(group==='decor')details.decor=cut.decor;
    else if(group==='fx'){plan.events.push({t:cut.start+.6,type:key,amp:1,dur:Math.max(.4,(J.FXE[key]?.dur||12)/24)});}
    else {details[group]=key;if(group==='trans')details.transDur=.9;}
    J.applyCutDetails(cut,details,plan,'lyrics');
  }
  else {plan.media=J.planMedia(project,plan,null,'media');plan.foreground=J.planMedia(project,plan,null,'foreground');}
  return plan;
};
const showError=err=>{const error=dialog.querySelector('.effect-preview-error');error.textContent=J.mediaLabel('プレビューを再生できませんでした：','Could not play preview: ')+err.message;error.hidden=false;};
// (Re)start the loop for the current preview; slider changes restart it from the beginning.
function run(){
  if(!current||!dialog.open)return;
  cancelAnimationFrame(frame);
  const token=++generation,{group,key,layer,def,settings}=current;
  try{
    const plan=J.makeEffectPreviewPlan(group,key,layer,assetId,settings);
    const renderer=new J.Renderer(),start=performance.now();
    let offset=0,cycle=layer==='lyrics'?6:plan[layer].cuts[plan[layer].cuts.length-1].end;
    if(layer==='lyrics'?group==='exit':def.stage==='exit'){
      const cut=layer==='lyrics'?plan.cuts[0]:plan[layer].cuts[0];
      const exitDuration=layer==='lyrics'?cut.outDur:Math.min(cut.effectSettings?.duration || .45,(cut.end-cut.start)*.3);
      offset=Math.max(cut.start,cut.end-exitDuration-.5);
      cycle=cut.end-offset;
    }
    const draw=now=>{if(token!==generation||!dialog.open)return;const t=offset+((now-start)/1000)%cycle;renderer.frame(canvas.getContext('2d'),plan,t,{scale:canvas.width/plan.W,noHud:true});frame=requestAnimationFrame(draw);};
    frame=requestAnimationFrame(draw);
  }catch(err){showError(err);}
}
function renderSettings(){
  const box=dialog.querySelector('.effect-preview-settings');box.innerHTML='';
  box.hidden=!current||current.layer==='lyrics';if(box.hidden)return;
  const L=J.mediaLabel;
  for(const [key,ja,en,min,max] of MEDIA_SLIDERS){
    const row=document.createElement('label');row.className='slider';
    row.innerHTML=`<span>${L(ja,en)}</span><input type="range" min="${min}" max="${max}" step="0.05" value="${current.settings[key]}" data-preview-setting="${key}"><output>${current.settings[key]}</output>`;
    row.querySelector('input').addEventListener('input',e=>{current.settings[key]=+e.target.value;row.querySelector('output').textContent=e.target.value;run();});
    box.appendChild(row);
  }
  const note=document.createElement('p');note.className='note';
  note.textContent=L('プレビューのみに反映されます。プロジェクトの設定は詳細 → 前景／背景で変更します。','Applies to this preview only. Change the project in Details → Foreground / Background.');
  box.appendChild(note);
}
J.openEffectPreview=async(group,key,layer='lyrics')=>{
  ensureDialog();stop();J.uiApi?.pause();
  const token=generation,def=layer==='lyrics'?J.registry(group)[key]:J.MEDIA_TECH[key];
  if(!def)return;
  // Media sliders start from the layer's current Details values.
  const s=layer!=='lyrics'?J.mediaEffectSettings(J.ui?.project||J.defaultProject(),layer):null;
  current={group,key,layer,def,settings:s?{motion:s.motion,treatment:s.treatment,duration:s.duration}:null};
  heading.textContent=def.name;canvas.setAttribute('aria-label',def.name);
  dialog.querySelector('.effect-preview-error').hidden=true;renderSettings();
  canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  if(!dialog.open)dialog.showModal();
  try{
    if(layer!=='lyrics'){await image.decode();if(token!==generation||!dialog.open)return;assetId='__jizura_effect_preview__';J.mediaAssets.set(assetId,{element:image,type:'image'});}
    await J.ensureFonts('プレビュールビ',J.fontsOfPlan(J.makeEffectPreviewPlan(group,key,layer,assetId,current.settings)));
    if(token!==generation||!dialog.open)return;
    run();
  }catch(err){if(token!==generation)return;showError(err);stop();}
};
J.effectPreviewButton=(group,key,layer='lyrics')=>{
  const button=document.createElement('button');button.type='button';button.className='effect-preview-play';button.textContent='▶';
  button.dataset.previewGroup=group;button.dataset.previewKey=key;button.dataset.previewLayer=layer;
  button.title=J.mediaLabel('プレビューを再生','Play preview');button.setAttribute('aria-label',button.title);
  button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();J.openEffectPreview(group,key,layer);});return button;
};
})();
