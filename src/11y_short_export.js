/* Portrait output of a selected interval, preserving the source composition. */
(() => {
'use strict';
J.shortExportSettings = value => {
  const s=value && typeof value==='object'?value:{};
  return {start:Number.isFinite(+s.start)?Math.max(0,+s.start):0,end:s.end==null?null:Number.isFinite(+s.end)?Math.max(0,+s.end):null,
    mode:['zoom','tile','ambient'].includes(s.mode)?s.mode:'zoom',blur:Number.isFinite(+s.blur)?J.clamp(+s.blur,0,100):35,
    res:[720,1080,1440,2160].includes(+s.res)?+s.res:1080};
};
J.shortExportRange = (plan, settings) => {
  const start=settings.start,end=settings.end==null?plan.duration:settings.end;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>plan.duration+.001||end<=start||start>=plan.duration)
    throw new Error(J.mediaLabel('開始・終了を動画の範囲内で指定し、終了を開始より後にしてください。','Choose a start and end within the video, with the end after the start.'));
  return {start,end:Math.min(end,plan.duration)};
};
J.shortExportProject = (project, settings=J.shortExportSettings(project.shortExport)) => ({...project,aspect:'9:16',res:settings.res,videoSize:{w:settings.res,h:Math.round(settings.res*16/9/2)*2}});

// Small, separable box-blur passes also work on Safari without canvas filters.
// The working image is bounded, so large output sizes do not multiply CPU work.
const blurPixels = (pixels,w,h,r,scratch) => {
  const span=r*2+1;
  for(let pass=0;pass<3;pass++){
    for(let y=0;y<h;y++){
      const row=y*w*4;let red=0,green=0,blue=0;
      for(let k=-r;k<=r;k++){const i=row+J.clamp(k,0,w-1)*4;red+=pixels[i];green+=pixels[i+1];blue+=pixels[i+2];}
      for(let x=0;x<w;x++){
        const i=row+x*4;scratch[i]=red/span;scratch[i+1]=green/span;scratch[i+2]=blue/span;scratch[i+3]=255;
        const a=row+J.clamp(x-r,0,w-1)*4,b=row+J.clamp(x+r+1,0,w-1)*4;
        red+=pixels[b]-pixels[a];green+=pixels[b+1]-pixels[a+1];blue+=pixels[b+2]-pixels[a+2];
      }
    }
    for(let x=0;x<w;x++){
      let red=0,green=0,blue=0;
      for(let k=-r;k<=r;k++){const i=(J.clamp(k,0,h-1)*w+x)*4;red+=scratch[i];green+=scratch[i+1];blue+=scratch[i+2];}
      for(let y=0;y<h;y++){
        const i=(y*w+x)*4;pixels[i]=red/span;pixels[i+1]=green/span;pixels[i+2]=blue/span;pixels[i+3]=255;
        const a=(J.clamp(y-r,0,h-1)*w+x)*4,b=(J.clamp(y+r+1,0,h-1)*w+x)*4;
        red+=scratch[b]-scratch[a];green+=scratch[b+1]-scratch[a+1];blue+=scratch[b+2]-scratch[a+2];
      }
    }
  }
};
class ShortFrameRenderer {
  constructor(){this.background=document.createElement('canvas');this.scratch=null;}
  frame(ctx,source,settings){
    const w=ctx.canvas.width,h=ctx.canvas.height,sw=source.width,sh=source.height,fit=Math.min(w/sw,h/sh),dw=sw*fit,dh=sh*fit,x=(w-dw)/2,y=(h-dh)/2;
    const blurred=settings.blur>0,k=blurred?Math.min(1,384/Math.max(w,h)):1,bw=Math.max(1,Math.round(w*k)),bh=Math.max(1,Math.round(h*k)),bg=this.background;
    if(bg.width!==bw||bg.height!==bh){bg.width=bw;bg.height=bh;}
    const bx=bg.getContext('2d',{willReadFrequently:true});bx.setTransform(1,0,0,1,0,0);bx.globalAlpha=1;bx.globalCompositeOperation='source-over';bx.fillStyle='#000';bx.fillRect(0,0,bw,bh);
    if(settings.mode==='ambient'){
      const edge=Math.max(1,sh*.08),top=y/h*bh,bottom=(y+dh)/h*bh;
      if(top>0)bx.drawImage(source,0,0,sw,edge,0,0,bw,top+1);
      if(bottom<bh)bx.drawImage(source,0,sh-edge,sw,edge,0,bottom-1,bw,bh-bottom+1);
    }else if(settings.mode==='tile'){
      const rh=sh*bw/sw,center=(bh-rh)/2;
      for(let yy=center-Math.ceil(center/rh)*rh;yy<bh;yy+=rh)bx.drawImage(source,0,yy,bw,rh);
    }else{
      const cover=Math.max(bw/sw,bh/sh),cw=sw*cover,ch=sh*cover;bx.drawImage(source,(bw-cw)/2,(bh-ch)/2,cw,ch);
    }
    if(blurred){
      const image=bx.getImageData(0,0,bw,bh);if(this.scratch?.length!==image.data.length)this.scratch=new Uint8ClampedArray(image.data.length);
      blurPixels(image.data,bw,bh,Math.max(1,Math.round(settings.blur/100*bw*.12)),this.scratch);bx.putImageData(image,0,0);
    }
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);ctx.drawImage(bg,0,0,w,h);
    if(settings.mode==='ambient'){
      const shade=(a,b)=>{if(b<=a)return;const g=ctx.createLinearGradient(0,a,0,b);g.addColorStop(0,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,a,w,b-a);};
      shade(0,y);ctx.save();ctx.translate(0,h);ctx.scale(1,-1);shade(0,y);ctx.restore();
    }
    ctx.drawImage(source,x,y,dw,dh);ctx.restore();
  }
}
J.ShortFrameRenderer=ShortFrameRenderer;
})();
