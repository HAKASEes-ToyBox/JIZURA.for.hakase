/* Rhythmic media pack. Absolute song time keeps adjacent cuts on the same beat. */
(() => {
'use strict';
const L=J.mediaLabel, TAU=Math.PI*2;
J.mediaBpmHoldAliases=Object.fromEntries(['float','breathe','pulse','rock','swing','orbit','rotate','shake','figureEight','dollyOrbit','hopSteps','zigzagStep'].map(key=>[key,'sync_'+key]));
for(const def of Object.values(J.MEDIA_TECH)) {
  if(!J.mediaBpmHoldAliases[def.hold])continue;
  def.hold=J.mediaBpmHoldAliases[def.hold];
  if(!def.stage) {def.group='bpm';def.name+=L('（BPM同期）',' (BPM sync)');}
}
J.MEDIA_RHYTHM_KEYS=[];
for(const [key,ja,en] of [
 ['beatSideHop','ビート・サイドホップ','Beat side hop'],
 ['beatPendulum','ビート・振り子','Beat pendulum'],
 ['beatBox','4拍スクエア移動','Four-beat square'],
 ['beatDiamond','4拍ダイヤ移動','Four-beat diamond'],
 ['beatZoomSteps','4拍ステップズーム','Four-beat zoom steps'],
 ['beatSpring','ビート・スプリング','Beat spring'],
 ['beatSquash','ビート・スクワッシュ','Beat squash'],
 ['beatStretch','ビート・縦ストレッチ','Beat vertical stretch'],
 ['beatTwistHop','ツイスト・ホップ','Twist hop'],
 ['beatWaltz','3拍ワルツ','Three-beat waltz'],
 ['beatSpiral','4拍スパイラル','Four-beat spiral'],
 ['beatSwayZoom','スウェイ・ズーム','Sway zoom'],
]) {
 J.MEDIA_RHYTHM_KEYS.push(key);
 J.MEDIA_TECH[key]={name:L(ja,en),group:'bpm',enter:'cut',hold:key,exit:'cut',treat:'none',trans:'none'};
}
const previous=J.mediaBeatState;
J.mediaBeatState=(cut,p,w,h)=>{
 const hold=J.mediaBpmHoldAliases[cut.hold]||cut.hold;
 const v=previous(cut,p,w,h);v.sx=1;v.sy=1;
 const beat=(cut.start+p*(cut.end-cut.start)-(cut.beatOffset||0))*(cut.bpm||120)/60;
 const mod=(n,d)=>((n%d)+d)%d, phase=mod(beat,1), t=beat*TAU;
 const pulse=Math.exp(-phase*8), ease=q=>q*q*(3-2*q);
 const path=points=>{const i=Math.floor(mod(beat,points.length)),q=ease(phase),a=points[i],b=points[(i+1)%points.length];v.x=(a[0]+(b[0]-a[0])*q)*w;v.y=(a[1]+(b[1]-a[1])*q)*h;};
 switch(hold){
  case 'sync_float':v.x=Math.sin(t/4)*w*.025;v.y=Math.sin(t/2)*h*.035;v.rotation=Math.sin(t/4)*.025;break;
  case 'sync_breathe':v.scale=1+(1-Math.cos(t/4))*.0325;break;
  case 'sync_pulse':v.scale=1+pulse*.09;break;
  case 'sync_rock':v.rotation=Math.sin(t/2)*.06;break;
  case 'sync_swing':v.rotation=Math.sin(t/2)*.11;break;
  case 'sync_orbit':v.x=Math.sin(t/4)*w*.05;v.y=Math.cos(t/4)*h*.05;break;
  case 'sync_rotate':v.rotation=Math.sin(t/8)*.15;break;
  case 'sync_shake':v.x=Math.sin(phase*61)*w*.009*pulse;v.y=Math.cos(phase*73)*h*.009*pulse;break;
  case 'sync_figureEight':v.x=Math.sin(t/4)*w*.16;v.y=Math.sin(t/2)*h*.11;break;
  case 'sync_dollyOrbit':v.x=Math.sin(t/4)*w*.17;v.y=Math.cos(t/4)*h*.08;v.scale=1+Math.cos(t/4)*.16;break;
  case 'sync_hopSteps':v.x=Math.sin(t/4)*w*.2;v.y=-Math.abs(Math.sin(beat*Math.PI))*h*.18;v.rotation=Math.sin(t/2)*.035;break;
  case 'sync_zigzagStep':path([[-.2,.12],[0,-.12],[.2,.12],[0,-.12]]);break;
  case 'beatSideHop':v.x=Math.cos(t/2)*w*.14;v.y=-Math.abs(Math.sin(beat*Math.PI))*h*.12;break;
  case 'beatPendulum':v.rotation=Math.sin(t/4)*.24;v.x=Math.sin(v.rotation)*w*.18;v.y=(1-Math.cos(v.rotation))*h*.5;break;
  case 'beatBox':path([[-.12,-.12],[.12,-.12],[.12,.12],[-.12,.12]]);break;
  case 'beatDiamond':path([[0,-.18],[.18,0],[0,.18],[-.18,0]]);break;
  case 'beatZoomSteps':{const values=[1,1.08,1.16,1.08],i=Math.floor(mod(beat,4));v.scale=values[i]+(values[(i+1)%4]-values[i])*ease(Math.min(1,phase*4));break;}
  case 'beatSpring':v.y=-Math.sin(phase*Math.PI*3)*Math.pow(1-phase,2)*h*.16;v.scale=1+.08*pulse;break;
  case 'beatSquash':v.sx=1+.18*pulse;v.sy=1/(1+.18*pulse);break;
  case 'beatStretch':v.sy=1+.24*pulse;v.sx=1/(1+.24*pulse);v.y=-h*.04*pulse;break;
  case 'beatTwistHop':v.y=-Math.abs(Math.sin(beat*Math.PI))*h*.14;v.rotation=Math.sin(t/2)*.18;break;
  case 'beatWaltz':v.x=Math.sin(t/3)*w*.12;v.y=Math.cos(t/3)*h*.07;v.rotation=Math.sin(t/3)*.08;v.scale=1+.06*Math.exp(-mod(beat,3)*4);break;
  case 'beatSpiral':{const radius=.04+.06*(1-Math.cos(t/4));v.x=Math.cos(t/4)*w*radius;v.y=Math.sin(t/4)*h*radius;v.scale=1+.1*Math.sin(t/4);break;}
  case 'beatSwayZoom':v.x=Math.sin(t/4)*w*.06;v.rotation=Math.sin(t/4)*.06;v.scale=1+.12*pulse;break;
 }
 return v;
};
})();
