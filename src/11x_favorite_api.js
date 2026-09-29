/* Public browser API for agent-authored, portable favorite effects. */
(() => {
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
J.favoriteAPI={
  spec(){return {format:'jizura-cut-effects',version:1,kinds:['lyrics','media'],payload:{format:'jizura-cut-effects',version:1,kind:'lyrics',native:{},details:{drawing:J.drawingSpec.example}},drawing:J.drawingSpec,detailKeys:J.cutDetailKeys,workflow:['Read spec/catalog/theme candidates','Capture a compatible cut or author details.drawing','Validate','Save favorite','Preview multiple times','Revise','Export .jizuraichifav'],notes:['Payloads contain effects, not target lyrics, timing or placement.','drawing is a JSON drawing program, not JavaScript.','Theme checks cover stock effects; visually review custom drawings against the theme.']};},
  validate(payload){return J.readCutEffects(JSON.stringify(payload));},
  save(project,{name,payload,id}){
    const valid=this.validate(payload),list=project.effectFavorites ||= [];
    if(id&&!list.some(f=>f.id===id))throw Error('Favorite not found');
    const number=(project.favoriteSequence||0)+1;
    const entry={id:id||J.favoriteId(),name:typeof name==='string'&&name.trim()?name.trim():'Favorite '+number,payload:valid};
    if(entry.name.length>200)throw Error('Name exceeds 200 characters');
    if(id)list[list.findIndex(f=>f.id===id)]=entry;else{list.push(entry);project.favoriteSequence=number;}
    return clone(entry);
  },
  async import(project,file,mode='append'){
    if(!['append','replace'].includes(mode))throw Error('mode must be append or replace');
    const loaded=await J.readEffectFavorites(file),entries=loaded.favorites.map(f=>({...f,id:J.favoriteId()}));
    const fonts=(loaded.project.userFonts||[]).filter(f=>!(project.userFonts||[]).some(old=>old.key===f.key));
    for(const entry of loaded.files)if(entry.kind==='font'&&fonts.some(f=>f.key===entry.id))await J.saveFontFile(entry.id,entry.file);
    await J.restoreFontFiles(fonts);
    project.userFonts=[...(project.userFonts||[]),...fonts];
    for(const f of fonts)if(!J.FONTS[f.key])J.addUserFont(f.key,f.label,f.family,f.weight||400);
    project.compositeFonts=[...(project.compositeFonts||[]),...(loaded.project.compositeFonts||[]).filter(f=>!(project.compositeFonts||[]).some(old=>old.key===f.key))];J.setCompositeFonts(project.compositeFonts);
    project.effectFavorites=mode==='replace'?entries:[...(project.effectFavorites||[]),...entries];
    project.favoriteSequence=Math.max(project.favoriteSequence||0,loaded.project.favoriteSequence||0,project.effectFavorites.length);
    return {count:entries.length,ids:entries.map(f=>f.id)};
  },
  async preview({payload,project,target,time=1,width=640}){
    payload=this.validate(payload);
    if(!Number.isFinite(time)||time<0||!Number.isInteger(width)||width<160||width>1920)throw Error('Invalid time or width');
    const layer=target?.layer||(payload.kind==='lyrics'?'lyrics':'media');
    if(!['lyrics','foreground','media'].includes(layer)||payload.kind!==(layer==='lyrics'?'lyrics':'media'))throw Error('Incompatible preview target');
    const p=target?clone({...project,effectFavorites:[]}):J.defaultProject();let sampleId;
    try{
      if(!target){
        p.lyrics=payload.kind==='lyrics'?'[00:00]プレビュー|ルビ':'';p.title='';p.durationOverride=3;p.res=640;p.aspect='16:9';p.overrides={0:{single:true}};p.fx={...p.fx,hud:'off',texture:0,chroma:0,glitch:0,decor:0};p.lyricEffects.autoPlacement=false;
        if(layer!=='lyrics'){
          const image=J.effectPreviewImage;await image.decode();sampleId='__agent_favorite_'+J.favoriteId();J.mediaAssets.set(sampleId,{element:image,type:'image'});
          const m=p[layer];m.items=[{id:sampleId,name:'Preview',type:'image'}];m.manualCuts=true;m.cutCount=1;m.timing.lineTimes={0:0};m.cutOverrides={0:{itemId:sampleId}};
        }
      }
      p.layerVisibility={...p.layerVisibility,[layer]:true};
      const build=()=>{const plan=J.plan(p);plan.media=J.planMedia(p,plan,null,'media');plan.foreground=J.planMedia(p,plan,null,'foreground');return plan;};
      let plan=build();const find=()=>layer==='lyrics'?plan.cuts.filter(c=>c.line>=0)[target?.index||0]:plan[layer].cuts[target?.index||0];
      const original=find();if(!original)throw Error('Target cut not found');J.pasteCutEffects(p,plan,layer,original,payload);plan=build();const cut=find();
      const duration=Math.min(cut.end,plan.duration)-cut.start;if(time>=duration)throw Error('time must be less than cut duration '+duration);
      await J.ensureFonts((cut.text||'')+J.drawingText(plan),J.fontsOfPlan(plan));await document.fonts.ready;await J.prepareMediaFrame(plan,cut.start+time);
      const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(Math.min(width,1920*plan.W/plan.H)));cv.height=Math.max(1,Math.round(cv.width*plan.H/plan.W));
      new J.Renderer().frame(cv.getContext('2d'),plan,cut.start+time,{scale:cv.width/plan.W,noHud:true});
      return {data:cv.toDataURL('image/png').split(',')[1],width:cv.width,height:cv.height,time,duration};
    }finally{if(sampleId)J.mediaAssets.delete(sampleId);}
  }
};
})();
