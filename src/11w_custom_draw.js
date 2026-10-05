/* Portable drawing programs: deterministic Canvas2D commands, never executable JS. */
(() => {
'use strict';
const colors=['fg','bg','accent','accent2','sub','ink','dim'];
const types=['rect','ellipse','line','text','arcText','source'];
const numeric=['x','y','w','h','ox','oy','rotation','scale','opacity','lineWidth','size','arc','contrast','bounce'];
// frame: what x/y/w/h are fractions of — the display area, or (decor) the lyric's resting text box, or one axis of it.
// units:"short" measures w/h in the frame's shorter edge, so circles stay round in any aspect ratio.
const frames=['area','text','textX','textY'],unitModes=['frame','short'];
const allowed=new Set(['type',...numeric,'fill','stroke','text','font','frame','units']);
J.drawingSpec={version:1,mode:['replace','overlay'],nodes:types,colors,coordinates:'Normalized to the target display area / fitted material. Rotation in degrees. Text centered; size is fraction of the shorter edge.',frames:{frame:frames,units:unitModes,ox:'offset added after frame placement, in shorter-edge units',notes:'frame text/textX/textY (decor only) follow the resting lyric text box, so decorations track font size and area changes; other targets fall back to the area. units short keeps w/h proportional (aspect-safe shapes). size, lineWidth and bounce use the frame shorter edge.'},numericFields:numeric,numericValue:'A finite number, or {from,to,ease:"linear"|"in"|"out"|"inOut"}, or {value,amplitude,cycles,phase}. Numbers and animation endpoints may use {param:"amount",default:1}, optionally scaled by mul ({param:"size",default:1,mul:0.4} = size × 0.4). Animation progress spans the cut (0..1); sine phase in radians.',text:['$text','$note','literal string'],limits:{nodes:64,bytes:32768},example:{version:1,mode:'replace',nodes:[{type:'rect',x:.1,y:.35,w:.8,h:.3,fill:'accent',scale:{from:.8,to:1,ease:'out'}},{type:'text',text:'$text',x:.5,y:.5,size:.12,fill:'fg',rotation:{value:0,amplitude:3,cycles:1}}]}};
J.validateDrawing=program=>{
  const fail=message=>{throw Error('Drawing program: '+message);};
  if(!program||program.version!==1||!['replace','overlay'].includes(program.mode)||!Array.isArray(program.nodes)||program.nodes.length>64||JSON.stringify(program).length>32768)fail('invalid version, mode or node limit');
  for(const key of Object.keys(program))if(!['version','mode','nodes'].includes(key))fail('unknown field '+key);
  function number(v){
    if(typeof v==='number'){if(!Number.isFinite(v)||Math.abs(v)>10000)fail('number out of range');return;}
    if(!v||typeof v!=='object'||Array.isArray(v))fail('invalid numeric value');
    if('param' in v){if(typeof v.param!=='string'||!/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(v.param)||Object.keys(v).some(k=>!['param','default','mul'].includes(k))||v.default!==undefined&&!Number.isFinite(v.default)||v.mul!==undefined&&(!Number.isFinite(v.mul)||Math.abs(v.mul)>10000))fail('invalid parameter reference');return;}
    const lerp='from' in v,keys=lerp?['from','to','ease']:['value','amplitude','cycles','phase'];
    const scalar=n=>Number.isFinite(n)||n&&typeof n==='object'&&'param' in n;
    for(const [key,n] of Object.entries(v)){if(!keys.includes(key))fail('unknown animation field '+key);if(key==='ease'){if(!['linear','in','out','inOut'].includes(n))fail('invalid ease');}else{if(!scalar(n))fail('invalid animation number');number(n);}}
    if(lerp&&(!scalar(v.from)||!scalar(v.to))||!lerp&&!scalar(v.value))fail('missing animation endpoints');
  }
  for(const node of program.nodes){
    if(!node||!types.includes(node.type))fail('invalid node type');
    for(const [key,v] of Object.entries(node)){
      if(!allowed.has(key))fail('unknown node field '+key);
      if(numeric.includes(key))number(v);
      if(['fill','stroke'].includes(key)&&!colors.includes(v)&&!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v))fail('invalid color');
      if(key==='text'&&(typeof v!=='string'||v.length>4000))fail('invalid text');
      if(key==='font'&&(typeof v!=='string'||!v.length||v.length>200))fail('invalid font key');
      if(key==='frame'&&!frames.includes(v))fail('invalid frame');
      if(key==='units'&&!unitModes.includes(v))fail('invalid units');
    }
  }
  return JSON.parse(JSON.stringify(program));
};
const checked=new WeakSet();
J.drawingValue=(v,p=0,params={},fallback=0)=>{
  if(v===undefined)return fallback;if(typeof v==='number')return v;
  // {param,default,mul}: the parameter (or its default) times mul, so one size parameter can scale a whole shape
  if('param' in v){const n=Number.isFinite(params[v.param])?params[v.param]:(v.default??fallback);return v.mul===undefined?n:n*v.mul;}
  const scalar=(n,f)=>J.drawingValue(n,p,params,f);
  if('from' in v){let t=J.clamp(p);if(v.ease==='in')t*=t;else if(v.ease==='out')t=1-(1-t)**2;else if(v.ease==='inOut')t=t*t*(3-2*t);const from=scalar(v.from,0);return from+(scalar(v.to,0)-from)*t;}
  return scalar(v.value,0)+scalar(v.amplitude,0)*Math.sin(p*scalar(v.cycles,1)*Math.PI*2+scalar(v.phase,0));
};
J.drawProgram=(ctx,program,{W,H,p=0,text='',note='',source=null,sc={},font=null,params={},drawText=null,box=null})=>{
  if(!checked.has(program)){J.validateDrawing(program);checked.add(program);}
  const value=(v,fallback)=>J.drawingValue(v,p,params,fallback);
  const color=c=>sc[c]||c||sc.fg||'#ffffff';
  const area={x0:0,y0:0,x1:W,y1:H},tbox=box&&box.x1>box.x0&&box.y1>box.y0?box:null;
  // Layout programs report the box of the text they drew (in program coordinates) for decor and treatments.
  const base=drawText&&ctx.getTransform?ctx.getTransform().inverse():null;let drawn=null;
  const track=r=>{if(!base||!r||!(r.x1>r.x0))return;const m=base.multiply(ctx.getTransform());
    for(const [px,py] of [[r.x0,r.y0],[r.x1,r.y0],[r.x0,r.y1],[r.x1,r.y1]]){const q=m.transformPoint({x:px,y:py});drawn=drawn?{x0:Math.min(drawn.x0,q.x),y0:Math.min(drawn.y0,q.y),x1:Math.max(drawn.x1,q.x),y1:Math.max(drawn.y1,q.y)}:{x0:q.x,y0:q.y,x1:q.x,y1:q.y};}};
  for(const node of program.nodes){
    ctx.save();try{
      const f=node.frame&&node.frame!=='area'&&tbox?node.frame:'area';
      const fx=f==='text'||f==='textX'?tbox:area,fy=f==='text'||f==='textY'?tbox:area;
      const fw=fx.x1-fx.x0,fh=fy.y1-fy.y0,u=Math.max(1,Math.min(fw,fh)),short=node.units==='short';
      const x=fx.x0+value(node.x,.5)*fw+value(node.ox,0)*u,y=fy.y0+value(node.y,.5)*fh+value(node.oy,0)*u;
      const w=value(node.w,.5)*(short?u:fw),h=value(node.h,.5)*(short?u:fh);
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
          if(drawText)track(drawText({text:ch,font:node.font||font,size,color:color(node.fill),mi:i}));
          else{if(node.stroke)ctx.strokeText(ch,0,0);ctx.fillText(ch,0,0);}ctx.restore();
        });
      }else if(node.type==='text'){
        const str=node.text==='$note'?note:node.text==='$text'||node.text===undefined?text:node.text;
        const size=Math.max(1,Math.abs(value(node.size,.12)*u)),f=J.FONTS[node.font||font];
        ctx.font=`${f?.weight||600} ${size}px ${f?.family||'sans-serif'}`;ctx.textAlign='center';ctx.textBaseline='middle';
        // Fit uniformly, never squeeze the glyph aspect ratio.
        const fit=Math.min(1,Math.abs(w)/Math.max(1,ctx.measureText(str).width));ctx.scale(fit,fit);
        if(drawText)track(drawText({text:str,font:node.font||font,size,color:color(node.fill),mi:0}));else ctx.fillText(str,0,0);
      }else if(node.type==='source'){if(source){const sw=source.videoWidth||source.naturalWidth||source.width,sh=source.videoHeight||source.naturalHeight||source.height;if(sw&&sh){const fit=Math.min(Math.abs(w)/sw,Math.abs(h)/sh);ctx.drawImage(source,-sw*fit/2,-sh*fit/2,sw*fit,sh*fit);}}}
      else{ctx.beginPath();if(node.type==='rect')ctx.rect(0,0,w,h);else if(node.type==='ellipse')ctx.ellipse(0,0,Math.abs(w)/2,Math.abs(h)/2,0,0,Math.PI*2);else{ctx.moveTo(0,0);ctx.lineTo(w,h);}if(node.type!=='line'&&node.fill)ctx.fill();if(node.stroke||node.type==='line')ctx.stroke();}
    }finally{ctx.restore();}
  }
  return drawn;
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
