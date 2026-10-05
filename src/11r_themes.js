/* Local, curated theme presets. No network or audio classification required. */
(() => {
'use strict';
const L = J.mediaLabel;
const presets = {
  typo: { category:'taste', name:L('文字PV','Typography'), set:'typo', moods:['editorial','graphic'], styles:['mono','paper','specimen'], media:['panorama','pushIn','drift'], phases:['wipe','enter_slide','enter_fade'], motion:[.35,.8], duration:[.25,.65], flash:false },
  kinetic: { category:'taste', name:L('キネティック','Kinetic'), set:'kinetic', moods:['pop','glitch'], styles:['magenta','caution','mono'], media:['tumble','pulse','beatBounce','beatTurn'], phases:['pop','enter_zoom','enter_slide'], motion:[.8,1.4], duration:[.15,.4], flash:true },
  wa: { category:'taste', name:L('和風','Japanese'), wa:true, moods:['editorial','calm'], styles:['sakura','sumi'], media:['pushIn','drift','panorama'], phases:['enter_fade','curtain','enter_blur'], motion:[.2,.6], duration:[.5,1], flash:false },
  horror: { category:'taste', name:L('ホラー','Horror'), moods:['horror'], styles:['hrRuin','hrNightRec','hrCurse'], media:['glitch','rackFocus','drift'], phases:['enter_blur','enter_glitch'], motion:[.35,.65], duration:[.3,.8], flash:false },
  pop: { category:'genre', name:L('ポップ','Pop'), moods:['pop'], styles:['magenta','caution','transit','rouge'], media:['pulse','swing','orbit','beatBounce','beatPulse'], phases:['pop','iris','enter_slide','enter_zoom'], motion:[.7,1.2], duration:[.2,.45], flash:true },
  ballad: { category:'genre', name:L('バラード','Ballad'), moods:['calm','emotional'], styles:['paper','specimen','noir'], media:['pushIn','pullOut','drift','rackFocus','beatBreathe'], phases:['enter_fade','enter_blur','curtain'], motion:[.25,.55], duration:[.65,1.2], flash:false },
  rock: { category:'genre', name:L('ロック','Rock'), moods:['glitch','emotional'], styles:['crimson','noir','mono'], media:['pulse','tumble','glitch','chromaticSplit','beatShake','beatTurn'], phases:['impact','whip','enter_glitch'], motion:[1,1.6], duration:[.12,.3], flash:true },
  dance: { category:'genre', name:L('ダンス・EDM','Dance / EDM'), moods:['glitch','graphic'], styles:['mint','blueprint','hud','magenta'], media:['beatPulse','beatTurn','beatStep','beatFade','chromaticSplit','neonContour'], phases:['tiles','scan','enter_flipX'], motion:[.8,1.4], duration:[.12,.35], flash:true },
  hiphop: { category:'genre', name:L('ヒップホップ','Hip-hop'), moods:['graphic','glitch'], styles:['mono','caution','crimson'], media:['beatStep','beatSway','beatPulse','panorama','glitch'], phases:['wipe','enter_slide','enter_squeezeX'], motion:[.6,1.1], duration:[.2,.4], flash:false },
  jazz: { category:'genre', name:L('ジャズ','Jazz'), moods:['editorial','calm'], styles:['specimen','noir','paper'], media:['panorama','drift','pullOut','beatSway'], phases:['enter_fade','wipe','enter_blur'], motion:[.3,.65], duration:[.4,.8], flash:false },
  acoustic: { category:'genre', name:L('アコースティック','Acoustic'), moods:['calm','editorial'], styles:['paper','specimen'], media:['pushIn','drift','rise','beatBreathe'], phases:['enter_fade','enter_rise','curtain'], motion:[.2,.5], duration:[.55,1], flash:false },
  cool: { category:'taste', name:L('クール','Cool'), moods:['graphic','editorial'], styles:['noir','mono','blueprint','hud'], media:['panorama','diagonal','rackFocus','beatStep'], phases:['wipe','scan','enter_slide'], motion:[.4,.8], duration:[.25,.5], flash:false },
  cute: { category:'taste', name:L('可愛い','Cute'), moods:['pop'], styles:['magenta','rouge'], media:['swing','orbit','beatBounce','beatHeart','drift'], phases:['pop','iris','enter_squeezeY'], motion:[.5,.9], duration:[.3,.6], flash:false },
  elegant: { category:'taste', name:L('上品','Elegant'), moods:['editorial','calm'], styles:['specimen','paper','mono'], media:['pushIn','pullOut','rackFocus','drift'], phases:['enter_fade','enter_blur','curtain'], motion:[.2,.45], duration:[.7,1.2], flash:false },
  dreamy: { category:'taste', name:L('幻想的','Dreamy'), moods:['calm','emotional'], styles:['hud','noir','magenta'], media:['drift','orbit','rackFocus','beatBreathe'], phases:['enter_blur','iris','enter_fade'], motion:[.3,.7], duration:[.65,1.3], flash:false },
  retro: { category:'taste', name:L('レトロ','Retro'), moods:['editorial','graphic'], styles:['paper','caution','transit'], media:['panorama','pullOut','filmstrip','stipplePrint','beatSway'], phases:['blinds','wipe','enter_fade'], motion:[.35,.7], duration:[.35,.7], flash:false },
};
// Mask pack (background only): framing that suits each theme's pace.
const masksByTheme = {
  typo: ['maskCinemascope','maskSplitScreen','maskSlashParallax'],
  kinetic: ['maskBeatWindows','maskShutterBeat','maskSlashParallax','maskDetailGrid'],
  wa: ['maskCinemascope','maskDoubleExposure'],
  horror: ['maskCinemascope','maskShutterBeat'],
  pop: ['maskShapeZoom','maskDotMatrix','maskBeatWindows','maskDetailGrid'],
  ballad: ['maskDoubleExposure','maskCinemascope','maskRings'],
  rock: ['maskShutterBeat','maskSlashParallax','maskBeatWindows'],
  dance: ['maskBeatWindows','maskShutterBeat','maskDotMatrix','maskRings','maskDetailGrid'],
  hiphop: ['maskSplitScreen','maskDetailGrid','maskBeatWindows'],
  jazz: ['maskCinemascope','maskSplitScreen'],
  acoustic: ['maskDoubleExposure','maskCinemascope'],
  cool: ['maskSplitScreen','maskSlashParallax','maskCinemascope','maskDetailGrid'],
  cute: ['maskShapeZoom','maskDotMatrix','maskRings'],
  elegant: ['maskCinemascope','maskDoubleExposure','maskRings'],
  dreamy: ['maskDoubleExposure','maskShapeZoom','maskRings'],
  retro: ['maskDotMatrix','maskSplitScreen','maskCinemascope'],
};
for (const [key, masks] of Object.entries(masksByTheme)) presets[key].media.push(...masks);
// Curated additions from the rhythmic media pack; keep gentle themes restrained.
const rhythmByTheme = {
  pop: ['beatSideHop','beatZoomSteps','beatSpring','beatSquash','beatTwistHop','beatSwayZoom'],
  ballad: ['beatPendulum','beatWaltz'],
  rock: ['beatSpring','beatStretch','beatTwistHop','beatZoomSteps'],
  dance: ['beatBox','beatDiamond','beatZoomSteps','beatSquash','beatStretch','beatSpiral','beatSwayZoom'],
  hiphop: ['beatSideHop','beatBox','beatZoomSteps','beatSquash','beatSwayZoom'],
  jazz: ['beatPendulum','beatWaltz','beatSwayZoom'],
  acoustic: ['beatPendulum','beatWaltz'],
  cool: ['beatBox','beatDiamond','beatZoomSteps'],
  cute: ['beatSideHop','beatSpring','beatSquash','beatTwistHop','beatWaltz'],
  elegant: ['beatPendulum','beatWaltz'],
  dreamy: ['beatPendulum','beatSpiral','beatSwayZoom'],
  retro: ['beatSideHop','beatPendulum','beatWaltz'],
};
for (const [key, motions] of Object.entries(rhythmByTheme)) presets[key].media.push(...motions);
// Third media pack: main techniques/transitions, then entrances (exits follow).
const scenesByTheme = {
  horror: [['dutchTilt','handheld','filmGrain','vignette','scanlines','thermal','glassShards'],['flicker','shakeIn']],
  pop: [['rollAcross','zoomStages','beatJelly','beatTilt','beatFlip','beatBounceWall','tileScroll'],['dropBounce','elasticZoom','starIris','heartIris','dotGrid']],
  ballad: [['kenBurns','craneUp','lightLeak','vignette','softBloom','transition_blinds'],['brushStroke']],
  rock: [['dutchTilt','handheld','slamZoom','beatKick','beatTilt','beatDrop','zoomTunnel','stutterEcho','splitShift','glassShards','transition_sliceShift'],['flicker','shakeIn','stretchSnap','randomBars','diagonalSplit']],
  dance: [['slamZoom','turnOnce','zoomStages','beatKick','beatSlide','beatFlip','beatDrop','hueCycle','scanlines','zoomTunnel','columnWave','stutterEcho','transition_sliceShift','transition_pixelate'],['elasticZoom','swirl','stretchSnap','randomBars']],
  hiphop: [['handheld','slamZoom','zoomStages','beatKick','beatTilt','beatSlide','stutterEcho','splitShift','transition_sliceShift'],['dropBounce','shakeIn','stretchSnap','diagonalSplit']],
  jazz: [['kenBurns','filmGrain','vignette','cyanotype','transition_blinds','transition_tyRuleWipe'],['foldUp','clockReveal','brushStroke']],
  acoustic: [['kenBurns','handheld','lightLeak','transition_tyRuleWipe'],['brushStroke']],
  cool: [['dutchTilt','zoomStages','beatSlide','scanlines','thermal','cyanotype','splitShift','glassShards','transition_tyGridCells'],['foldUp','clockReveal','randomBars','diagonalSplit']],
  cute: [['rollAcross','beatJelly','beatBounceWall','softBloom','tileScroll'],['dropBounce','elasticZoom','swirl','starIris','heartIris','dotGrid']],
  elegant: [['kenBurns','craneUp','vignette','softBloom','cyanotype','transition_blinds'],['foldUp','brushStroke']],
  dreamy: [['craneUp','turnOnce','lightLeak','hueCycle','softBloom','zoomTunnel','columnWave'],['swirl','starIris']],
  retro: [['kenBurns','beatBounceWall','lightLeak','filmGrain','scanlines','tileScroll','transition_blinds','transition_pixelate','transition_tyRuleWipe','transition_tyGridCells'],['foldUp','clockReveal','dotGrid']],
};
for (const [key, [media, phases]] of Object.entries(scenesByTheme)) { presets[key].media.push(...media); presets[key].phases.push(...phases.map(id => 'enter_' + id)); }
const descriptions = {
  typo:L('文字を主役にした構成・文字PVの演出','Type-led layouts and typographic effects'),
  kinetic:L('文字が跳ねる・動きの強い演出','Bouncy type and energetic motion'),
  wa:L('和紙・筆・和柄を使った演出','Japanese paper, brushwork and traditional motifs'),
  horror:L('暗い配色・不穏な文字と映像','Dark colors and unsettling typography'),
  pop:L('明るい配色・弾む動き','Bright colors and bouncy motion'), ballad:L('落ち着いた配色・ゆっくりした余韻','Quiet colors and lingering motion'),
  rock:L('強いコントラスト・激しい動き','Strong contrast and energetic motion'), dance:L('鮮やかな配色・ビート同期','Vivid colors and beat-driven motion'),
  hiphop:L('太い文字・リズミカルな切り替え','Bold type and rhythmic cuts'), jazz:L('端正な文字・滑らかな動き','Refined type and smooth motion'),
  acoustic:L('紙のような色味・穏やかな動き','Paper tones and gentle motion'), cool:L('寒色・シャープな構成','Cool tones and sharp composition'),
  cute:L('ピンク系・柔らかく弾む動き','Pink tones and soft bounce'), elegant:L('整った文字・控えめな動き','Elegant type and subtle motion'),
  dreamy:L('ぼかし・浮遊感・ゆっくりした動き','Blur, floating and slow motion'), retro:L('紙・フィルム・ドットの質感','Paper, film and print textures'),
};
for (const [key,theme] of Object.entries(presets)) theme.description = descriptions[key];
J.THEMES = presets;
J.themeIds = project => [...new Set((Array.isArray(project.themes) ? project.themes : []).filter(key=>Object.hasOwn(presets,key)))];
const neutral = {layout:['center'],enter:['cut'],exit:['cut'],hold:['still'],decor:[],treat:['none'],bg:['none'],cam:['push'],fx:[],trans:[]};
J.themeCandidates = (project,key) => {
  const theme = presets[key]; if (!theme) return null;
  const themedProject = key === 'horror' ? {...project,horror:true} : project;
  const allowed = (group,id) => !J.randomOk || J.randomOk(themedProject,group,id);
  const lyrics = {};
  for (const group of J.GROUP_KEYS) {
    const wanted = new Set(neutral[group] || []);
    for (const mood of theme.moods) {
      for (const id of J.taggedWith(group,mood)) wanted.add(id);
      if (Array.isArray(J.MOODS[mood][group])) for (const id of J.MOODS[mood][group]) wanted.add(id);
    }
    if(theme.set||theme.wa){
      wanted.clear();
      for(const id of neutral[group]||[])wanted.add(id);
      for(const id of J.order(group))if(theme.set?J.setOf(group,id)===theme.set:J.isWa(group,id))wanted.add(id);
    }
    lyrics[group] = J.order(group).filter(id=>wanted.has(id) && !J.registry(group)[id]?.special && allowed(group,id));
  }
  const phases = theme.phases.flatMap(id=>[id,id.startsWith('enter_') ? 'exit_'+id.slice(6) : 'exit_'+id]);
  // Media layers share the theme's lyric camera pool (詳細 → 手法 → カメラ).
  const cameras = (lyrics.cam || []).map(id=>'cam_'+id);
  return {styles:theme.styles.filter(id=>J.STYLES[id] && allowed('style',id)),lyrics,media:[...new Set([...theme.media,...phases,...cameras])].filter(id=>J.MEDIA_TECH[id])};
};
const unrestricted = J.omakase;
J.omakase = (project,rnd=Math.random,choices={}) => {
  const ids = J.themeIds(project); if (!ids.length) return {...unrestricted(project,rnd,choices),appliedTheme:null};
  const pick = a=>a[Math.min(a.length-1,Math.floor(rnd()*a.length))];
  const key = pick(ids), theme = presets[key], pools = J.themeCandidates(project,key);
  const mood = pick(theme.moods), styles = pools.styles.filter(id=>id!==project.style);
  const themeProject = key === 'horror' ? {...project,horror:true} : project;
  const look = unrestricted(themeProject,rnd,{mood,style:pick(styles.length ? styles : pools.styles)});
  // No out-of-theme "sprinkle" or random palette/font override.
  look.fonts = {}; look.colors = {...project.colors,enabled:false,accentOn:false};
  look.fx.flash = theme.flash && rnd()<.5;
  look.fx.motion = Math.min(1,J.lerp(...theme.motion,rnd()));
  if (!theme.flash) {look.fx.glitch=Math.min(look.fx.glitch,.2);look.fx.chroma=Math.min(look.fx.chroma,.4);}
  for (const group of J.GROUP_KEYS) {
    const pool = pools.lyrics[group], selected = pool.filter(()=>rnd()<(project.themeBalance==='unified'?.4:.75));
    if (!selected.length && pool.length) selected.push(pick(pool));
    for (const id of neutral[group] || []) if (pool.includes(id)) selected.push(id);
    const enabled = new Set(selected);
    look.enabled[group] = Object.fromEntries(J.order(group).map(id=>[id,enabled.has(id)]));
  }
  for (const layer of ['foreground','media']) {
    const settings = J.mediaEffectSettings(project,layer), on = new Set();
    // Preserve a usable independent pool for main motion, entrance and exit.
    for (const stage of [undefined,'enter','exit']) {
      const pool = pools.media.filter(id=>J.MEDIA_TECH[id].stage===stage && J.mediaTechAllowed(id,layer));
      for (const id of pool) if (rnd()<(project.themeBalance==='unified'?.3:.65)) on.add(id);
      if (pool.length && !pool.some(id=>on.has(id))) on.add(pick(pool));
    }
    settings.enabled = Object.fromEntries(Object.keys(J.MEDIA_TECH).filter(id=>J.mediaTechAllowed(id,layer)).map(id=>[id,on.has(id)]));
    // Media decorations follow the theme's lyric decoration pool (front ones only).
    settings.decorEnabled = Object.fromEntries(J.order('decor').filter(id=>J.DECOR[id]).map(id=>[id,!!look.enabled.decor?.[id] && J.DECOR[id].layer==='front']));
    settings.motion = J.lerp(...theme.motion,rnd()); settings.duration = J.lerp(...theme.duration,rnd());
    look[layer] = {...project[layer],effects:settings};
  }
  if (key === 'horror') look.horror = true;
  look.appliedTheme = key;
  return look;
};
})();
