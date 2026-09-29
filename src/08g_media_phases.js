/* Independent media entrances/exits and motions on the project's beat clock. */
(() => {
'use strict';
const L = J.mediaLabel;
const moved = new Set(['dissolve', 'pop', 'spin', 'whip', 'impact', 'spiralApproach', 'rubberLaunch', 'boomerang']);
for (const [key, def] of Object.entries(J.MEDIA_TECH)) {
  if (def.group !== 'mask' && !moved.has(key)) continue;
  def.group = 'enter'; def.stage = 'enter'; def.motion = def.enter;
  J.MEDIA_TECH['exit_' + key] = { ...def, name: L('退場：', 'Exit: ') + def.name, group: 'exit', stage: 'exit', motion: def.exit };
}
for (const [motion, ja, en] of [
  ['fade', 'フェード', 'Fade'], ['slide', '右からスライド', 'Slide from right'],
  ['slideLeft', '左からスライド', 'Slide from left'], ['rise', '下からスライド', 'Slide from below'],
  ['fall', '上からスライド', 'Slide from above'], ['diagonal', '対角スライド', 'Diagonal slide'],
  ['zoom', 'ズーム', 'Zoom'], ['shrink', 'スケール', 'Scale'], ['blur', 'ぼかし', 'Blur'],
  ['swing', 'スイング', 'Swing'], ['glitch', 'グリッチ', 'Glitch'],
  ['flipX', '横フリップ', 'Horizontal flip'], ['flipY', '縦フリップ', 'Vertical flip'],
  ['squeezeX', '横ストレッチ', 'Horizontal stretch'], ['squeezeY', '縦ストレッチ', 'Vertical stretch'],
]) for (const stage of ['enter', 'exit']) {
  const name = stage === 'enter' ? L('登場：', 'Enter: ') : L('退場：', 'Exit: ');
  J.MEDIA_TECH[stage + '_' + motion] = { name: name + (stage === 'exit' && ({slide:1,slideLeft:1,rise:1,fall:1})[motion] ? ({slide:L('左へスライド','Slide to left'),slideLeft:L('右へスライド','Slide to right'),rise:L('上へスライド','Slide upward'),fall:L('下へスライド','Slide downward')})[motion] : L(ja, en)), group: stage, stage, motion,
    enter: stage === 'enter' ? motion : 'cut', exit: stage === 'exit' ? motion : 'cut', hold: 'still', treat: 'none', trans: 'none' };
}
for (const [key, ja, en] of [
  ['beatPulse', 'ビート・ズーム', 'Beat zoom'], ['beatBounce', 'ビート・バウンス', 'Beat bounce'],
  ['beatSway', 'ビート・スウェイ', 'Beat sway'], ['beatOrbit', 'ビート・オービット', 'Beat orbit'],
  ['beatTurn', '拍ごとに回転', 'Beat turn'], ['beatShake', 'ビート・シェイク', 'Beat shake'],
  ['beatHeart', 'ダブル・ハートビート', 'Double heartbeat'], ['beatBreathe', '2拍ブリーズ', 'Two-beat breathing'],
  ['beatStep', 'ビート・ステップ', 'Beat steps'], ['beatFade', 'ビート・フェード', 'Beat fade'],
]) J.MEDIA_TECH[key] = { name: L(ja, en), group: 'bpm', enter: 'cut', hold: key, exit: 'cut', treat: 'none', trans: 'none' };

J.mediaPhaseOptions = stage => Object.entries(J.MEDIA_TECH).filter(([, def]) => def.stage === stage);
J.applyMediaPhases = (project, cut, ov, layer) => {
  cut.bpm = Number.isFinite(+project.timing?.bpm) && +project.timing.bpm > 0 ? +project.timing.bpm : 120;
  cut.beatOffset = Number.isFinite(+project.timing?.beatOffset) ? +project.timing.beatOffset : 0;
  const settings = cut.effectSettings || J.mediaEffectSettings(project, layer);
  for (const [stage, field, lockedField, salt] of [['enter', 'entrance', 'lockedEntrance', 821], ['exit', 'departure', 'lockedDeparture', 823]]) {
    // Keep saved six-option recipes until this phase is explicitly changed.
    if (cut.technique === 'legacy' && ov[field] === undefined) continue;
    let key = ov.lock && ov[lockedField] != null ? ov[lockedField] : ov[field];
    // Old explicit reveal recipes remain readable without appearing in the
    // new main-motion menu. New cuts use independent automatic phase pools.
    if (key === undefined && J.MEDIA_TECH[ov.technique]?.stage === 'enter') key = stage === 'enter' ? ov.technique : 'exit_' + ov.technique;
    if (key !== 'none' && J.MEDIA_TECH[key]?.stage !== stage) {
      const pool = J.mediaPhaseOptions(stage).filter(([id]) => settings.enabled[id] !== false);
      key = pool.length ? J.rng(J.h(cut.seed, salt)).pick(pool)[0] : 'none';
    }
    cut[field] = key;
    cut[stage] = J.MEDIA_TECH[key]?.motion || 'cut';
    cut.independentPhases = true;
  }
  if (cut.independentPhases) cut.effectSettings = settings;
};

J.mediaBeatState = (cut, p, w, h) => {
  const v = { x: 0, y: 0, rotation: 0, scale: 1, alpha: 1 };
  const beat = (cut.start + p * (cut.end - cut.start) - (cut.beatOffset || 0)) * (cut.bpm || 120) / 60;
  const phase = ((beat % 1) + 1) % 1, a = Math.exp(-phase * 8), t = beat * Math.PI * 2;
  switch (cut.hold) {
    case 'beatPulse': v.scale = 1 + a * .18; break;
    case 'beatBounce': v.y = -Math.abs(Math.sin(beat * Math.PI)) * h * .16; break;
    case 'beatSway': v.rotation = Math.sin(t) * .12; break;
    case 'beatOrbit': v.x = Math.sin(t) * w * .08; v.y = Math.cos(t) * h * .08; break;
    case 'beatTurn': v.rotation = (Math.floor(beat) + 1 - Math.pow(1 - Math.min(1, phase * 4), 3)) * Math.PI / 2; break;
    case 'beatShake': v.x = Math.sin(phase * 61) * w * .025 * a; v.y = Math.cos(phase * 47) * h * .025 * a; break;
    case 'beatHeart': v.scale = 1 + .16 * Math.max(a, phase >= .3 ? .65 * Math.exp(-(phase - .3) * 14) : 0); break;
    case 'beatBreathe': v.scale = 1 + (1 - Math.cos(t / 2)) * .06; break;
    case 'beatStep': { const step = Math.floor(beat); v.x = J.rs(step, cut.seed, 11) * w * .12; v.y = J.rs(step, cut.seed, 12) * h * .12; break; }
    case 'beatFade': v.alpha = .4 + .6 * a; break;
  }
  return v;
};
})();
