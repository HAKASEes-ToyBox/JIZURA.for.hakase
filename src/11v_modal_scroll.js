/* Freeze the editor underneath any modal, preserving its scroll position on close. */
(() => {
'use strict';
if(typeof MutationObserver==='undefined'||typeof document==='undefined'||!document.getElementById?.('app'))return;
let saved=null;
const sync=()=>{
  const open=!!document.querySelector('dialog[open]');
  if(open===!!saved)return;
  const body=document.body;
  if(open){
    saved={x:scrollX,y:scrollY,styles:{}};
    for(const key of ['position','top','left','width','overflow'])saved.styles[key]=body.style[key];
    Object.assign(body.style,{position:'fixed',top:-saved.y+'px',left:-saved.x+'px',width:'100%',overflow:'hidden'});
  }else{
    const previous=saved;saved=null;Object.assign(body.style,previous.styles);window.scrollTo(previous.x,previous.y);
  }
};
new MutationObserver(sync).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
})();
