/* Portable drawing programs: deterministic Canvas2D commands, never executable JS. */
(() => {
'use strict';
const colors=['fg','bg','accent','accent2','sub','ink','dim'];
const types=['rect','ellipse','line','text','arcText','source'];
const numeric=['x','y','w','h','rotation','scale','opacity','lineWidth','size','arc','contrast','bounce'];
const allowed=new Set(['type',...numeric,'fill','stroke','text','font']);
J.drawingSpec={version:1,mode:['replace','overlay'],nodes:types,colors,coordinates:'Normalized to the target display area / fitted material. Rotation in degrees. Text centered; size is fraction of the shorter edge.',numericFields:numeric,numericValue:'A finite number, or {from,to,ease:"linear"|"in"|"out"|"inOut"}, or {value,amplitude,cycles,phase}. Animation progress spans the cut (0..1); sine phase in radians.',text:['$text','$note','literal string'],limits:{nodes:64,bytes:32768},example:{version:1,mode:'replace',nodes:[{type:'rect',x:.1,y:.35,w:.8,h:.3,fill:'accent',scale:{from:.8,to:1,ease:'out'}},{type:'text',text:'$text',x:.5,y:.5,size:.12,fill:'fg',rotation:{value:0,amplitude:3,cycles:1}}]}};
J.validateDrawing=program=>{
  const fail=message=>{throw Error('Drawing program: '+message);};
  if(!program||program.version!==1||!['replace','overlay'].includes(program.mode)||!Array.isArray(program.nodes)||program.nodes.length>64||JSON.stringify(program).length>32768)fail('invalid version, mode or node limit');
  for(const key of Object.keys(program))if(!['version','mode','nodes'].includes(key))fail('unknown field '+key);
  function number(v){
    if(typeof v==='number'){if(!Number.isFinite(v)||Math.abs(v)>10000)fail('number out of range');return;}
    if(!v||typeof v!=='object'||Array.isArray(v))fail('invalid numeric value');
    const lerp='from' in v,keys=lerp?['from','to','ease']:['value','amplitude','cycles','phase'];
    for(const [key,n] of Object.entries(v)){if(!keys.includes(key))fail('unknown animation field '+key);if(key==='ease'){if(!['linear','in','out','inOut'].includes(n))fail('invalid ease');}else if(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>10000)fail('invalid animation number');}
    if(lerp&&(!Number.isFinite(v.from)||!Number.isFinite(v.to))||!lerp&&!Number.isFinite(v.value))fail('missing animation endpoints');
  }
  for(const node of program.nodes){
    if(!node||!types.includes(node.type))fail('invalid node type');
    for(const [key,v] of Object.entries(node)){
      if(!allowed.has(key))fail('unknown node field '+key);
      if(numeric.includes(key))number(v);
      if(['fill','stroke'].includes(key)&&!colors.includes(v)&&!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v))fail('invalid color');
      if(key==='text'&&(typeof v!=='string'||v.length>4000))fail('invalid text');
      if(key==='font'&&(typeof v!=='string'||!v.length||v.length>200))fail('invalid font key');
    }
  }
  return JSON.parse(JSON.stringify(program));
};
const checked=new WeakSet();
J.drawProgram=(ctx,program,{W,H,p=0,text='',note='',source=null,sc={},font=null})=>{
  if(!checked.has(program)){J.validateDrawing(program);checked.add(program);}
  const value=(v,fallback)=>{
    if(v===undefined)return fallback;if(typeof v==='number')return v;
    if('from' in v){let t=J.clamp(p);if(v.ease==='in')t*=t;else if(v.ease==='out')t=1-(1-t)**2;else if(v.ease==='inOut')t=t*t*(3-2*t);return v.from+(v.to-v.from)*t;}
    return v.value+(v.amplitude||0)*Math.sin(p*(v.cycles??1)*Math.PI*2+(v.phase||0));
  };
  const color=c=>sc[c]||c||sc.fg||'#ffffff',u=Math.min(W,H);
  for(const node of program.nodes){
    ctx.save();try{
      const x=value(node.x,.5)*W,y=value(node.y,.5)*H,w=value(node.w,.5)*W,h=value(node.h,.5)*H;
      ctx.translate(x,y);ctx.rotate(value(node.rotation,0)*Math.PI/180);const scale=value(node.scale,1);ctx.scale(scale,scale);ctx.globalAlpha*=J.clamp(value(node.opacity,1));
      ctx.fillStyle=color(node.fill);ctx.strokeStyle=color(node.stroke);ctx.lineWidth=Math.max(.01,value(node.lineWidth,.005)*u);
      if(node.type==='arcText'){
        const str=node.text==='$note'?note:node.text==='$text'||node.text===undefined?text:node.text;
        const chars=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(str)].map(s=>s.segment):[...str];
        const arc=J.clamp(value(node.arc,140),1,300)*Math.PI/180,rx=Math.abs(w)/2,ry=Math.abs(h)/2;
        const step=arc/Math.max(1,chars.length),base=Math.min(Math.abs(value(node.size,.15)*u),Math.min(rx,ry)*step*.82),contrast=J.clamp(value(node.contrast,.3),0,.6);
        const f=J.FONTS[node.font||font];ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
        chars.forEach((ch,i)=>{const angle=-Math.PI/2+(i-(chars.length-1)/2)*step;
          const pulse=Math.sin(p*Math.PI*6-i*.7)*value(node.bounce,.035)*u;
          const size=Math.max(1,base*(i%2===0?1+contrast:1-contrast));
          ctx.save();ctx.translate(Math.cos(angle)*(rx+pulse),Math.sin(angle)*(ry+pulse));ctx.rotate(angle+Math.PI/2);
          ctx.font=`${f?.weight||900} ${size}px ${f?.family||'sans-serif'}`;
          if(node.stroke)ctx.strokeText(ch,0,0);ctx.fillText(ch,0,0);ctx.restore();
        });
      }else if(node.type==='text'){
        const str=node.text==='$note'?note:node.text==='$text'||node.text===undefined?text:node.text;
        const size=Math.max(1,Math.abs(value(node.size,.12)*u)),f=J.FONTS[node.font||font];
        ctx.font=`${f?.weight||600} ${size}px ${f?.family||'sans-serif'}`;ctx.textAlign='center';ctx.textBaseline='middle';
        // Fit uniformly, never squeeze the glyph aspect ratio.
        const fit=Math.min(1,Math.abs(w)/Math.max(1,ctx.measureText(str).width));ctx.scale(fit,fit);ctx.fillText(str,0,0);
      }else if(node.type==='source'){if(source){const sw=source.videoWidth||source.naturalWidth||source.width,sh=source.videoHeight||source.naturalHeight||source.height;if(sw&&sh){const fit=Math.min(Math.abs(w)/sw,Math.abs(h)/sh);ctx.drawImage(source,-sw*fit/2,-sh*fit/2,sw*fit,sh*fit);}}}
      else{ctx.beginPath();if(node.type==='rect')ctx.rect(0,0,w,h);else if(node.type==='ellipse')ctx.ellipse(0,0,Math.abs(w)/2,Math.abs(h)/2,0,0,Math.PI*2);else{ctx.moveTo(0,0);ctx.lineTo(w,h);}if(node.type!=='line'&&node.fill)ctx.fill();if(node.stroke||node.type==='line')ctx.stroke();}
    }finally{ctx.restore();}
  }
};
const drawCut=J.Renderer.prototype.drawCut;
J.Renderer.prototype.drawCut=function(env){
  const program=env.cut.drawing;if(!program)return drawCut.call(this,env);
  if(program.mode==='overlay')drawCut.call(this,env);
  const sc=env.passColor?Object.fromEntries(colors.map(c=>[c,env.passColor])):env.sc;
  J.drawProgram(env.ctx,program,{W:env.W,H:env.H,p:J.clamp(env.lt/Math.max(.01,env.cut.end-env.cut.start)),text:env.cut.effectsOnly?'':env.cut.text,note:env.cut.note||'',sc,font:env.st.fonts.display?.[0]});
};
const paintMedia=J.paintMediaEffect;
J.paintMediaEffect=function(ctx,source,fit,cut,p,fade,out){
  if(!cut.drawing)return paintMedia(ctx,source,fit,cut,p,fade,out);
  if(cut.drawing.mode==='overlay')paintMedia(ctx,source,fit,cut,p,fade,out);
  ctx.save();try{ctx.translate(-fit[0]/2,-fit[1]/2);J.drawProgram(ctx,cut.drawing,{W:fit[0],H:fit[1],p,source,sc:{fg:'#ffffff',bg:'#000000',accent:'#f5a50c',accent2:'#16f4d4'}});}finally{ctx.restore();}
};
})();
