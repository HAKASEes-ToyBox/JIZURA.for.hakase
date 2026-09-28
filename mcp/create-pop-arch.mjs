import {Runtime} from './runtime.mjs';
import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';
const out=path.resolve('mcp/output/pop-arch-v2');await mkdir(out,{recursive:true});
const nodes=[];const colors=['#ff5d91','#45e0e9','#bda0ff','#ff9359'];
const center={x:.5,y:.53};
for(let i=0;i<4;i++){
 const angle=(195+i*50)*Math.PI/180,dx=Math.cos(angle),dy=Math.sin(angle),sx=center.x+dx*.39,sy=center.y+dy*.47;
 const lengthX=-dx*.20,lengthY=-dy*.23,phase=-Math.PI/2-i*.45;
 const wave=(base,delta)=>({value:base+delta*.72,amplitude:delta*.24,cycles:3,phase});
 nodes.push({type:'line',x:sx,y:sy,w:wave(0,lengthX),h:wave(0,lengthY),stroke:colors[i],lineWidth:.032});
 // Arrowhead points back toward the tail; coordinates use stage aspect correction.
 const physicalAngle=Math.atan2(lengthY,lengthX*16/9),head=.085;
 for(const sign of [-1,1])nodes.push({type:'line',x:wave(sx,lengthX),y:wave(sy,lengthY),w:-Math.cos(physicalAngle+sign*.58)*head/(16/9),h:-Math.sin(physicalAngle+sign*.58)*head,stroke:colors[i],lineWidth:.032});
}
for(let i=0;i<6;i++){const x=.12+i*.15;nodes.push({type:'ellipse',x,y:.15+Math.sin(i*2)*.065,w:.006,h:.011,fill:colors[i%colors.length],scale:{value:1,amplitude:.6,cycles:3,phase:i}});}
nodes.push({type:'arcText',text:'$text',x:.5,y:.54,w:.79,h:.73,arc:142,size:.19,contrast:.32,bounce:.025,fill:'#ffdb48',stroke:'#fff9e9',lineWidth:.003,rotation:{value:0,amplitude:2,cycles:3}});
const payload={format:'jizura-cut-effects',version:1,kind:'lyrics',native:{opacity:100,blend:'normal'},details:{drawing:{version:1,mode:'replace',nodes},cam:'push',motionScale:0,bg:'none',treat:'none',enter:'cut',exit:'cut',hold:'still',decor:[],contentScale:1,effectFx:{motion:1,glitch:0,chroma:0,decor:0,texture:0,flash:false,onTwos:false,koma:0,hud:'off',bgSwitch:0}}};
await writeFile(path.join(out,'pop-arch.json'),JSON.stringify(payload,null,2));
const r=new Runtime();r.output=out;try{await r.start();const {session}=await r.create();await r.call(session,'favoriteSave',{name:'ポップ・アーチ＆集中アロー v2',payload});
 await r.call(session,'edit',{changes:[{path:['lyrics'],value:'ハジけるこの瞬間'},{path:['durationOverride'],value:3},{path:['lyricEffects','autoPlacement'],value:false},{path:['overrides'],value:{0:{single:true}}}]});
 const list=await r.call(session,'favoriteList',{});await r.call(session,'favoriteApply',{id:list[0].id,layer:'lyrics',index:0});
 const first=await r.call(session,'favoritePreview',{id:list[0].id,layer:'lyrics',index:0,time:0,width:800});
 for(let i=0;i<24;i++){const pic=await r.call(session,'favoritePreview',{id:list[0].id,layer:'lyrics',index:0,time:i*first.duration/24,width:800});await writeFile(path.join(out,`frame-${String(i).padStart(2,'0')}.png`),Buffer.from(pic.data,'base64'));}
 const job=await r.export(session,{kind:'favorites',filename:'pop-arch-v2.jizuraichifav'});while(job.status==='running')await new Promise(resolve=>setTimeout(resolve,100));if(job.status!=='completed')throw Error(job.error);console.log(out);
}finally{await r.close();}


