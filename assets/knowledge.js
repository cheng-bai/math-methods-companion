'use strict';
const cards=[...document.querySelectorAll('.knowledge-card')];
const groups=[...document.querySelectorAll('.knowledge-group')];
const query=document.querySelector('#knowledge-query');
const volume=document.querySelector('#knowledge-volume');
const status=document.querySelector('#knowledge-count');
const initial=new URLSearchParams(location.search);
query.value=initial.get('q')||'';
if([...volume.options].some(o=>o.value===initial.get('v'))) volume.value=initial.get('v');
let renderer;
const errors=[];
function loadMath(){
  if(renderer) return renderer;
  renderer=new Promise((resolve,reject)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='assets/katex/katex.min.css';
    const script=document.createElement('script');script.src='assets/katex/katex.min.js';
    const fail=()=>{css.remove();script.remove();renderer=null;reject(new Error('公式资源加载失败，请检查离线资源或网络，重新展开可重试。'));};
    let loaded=0;
    const done=()=>{if(++loaded===2) resolve();};
    css.onload=done;script.onload=done;css.onerror=fail;script.onerror=fail;
    document.head.append(css,script);
  });
  return renderer;
}
async function renderCard(card){
  const state=card.querySelector('.math-state');
  const detail=card.querySelector('.knowledge-detail');
  const nodes=[...card.querySelectorAll('.math:not([data-math-rendered])')];
  if(!nodes.length) return;
  detail.classList.add('is-math-loading');
  state.textContent='正在排版公式…';
  try{
    await loadMath();
    for(const node of nodes){
      if(node.dataset.mathRendered) continue;
      const raw=node.textContent.trim();
      const tex=/^\\\([\s\S]*\\\)$|^\\\[[\s\S]*\\\]$/.test(raw)?raw.slice(2,-2):raw;
      try{window.katex.render(tex,node,{displayMode:node.classList.contains('display'),throwOnError:true,strict:'error'});}
      catch(error){node.classList.add('math-error');errors.push({card:card.id,tex,error:String(error)});}
      node.dataset.mathRendered='true';
    }
    await document.fonts.ready;
    state.textContent=card.querySelector('.math-error')?'部分公式排版失败，当前显示源码。':'';
  }catch(error){state.textContent=String(error.message);}
  finally{detail.classList.remove('is-math-loading');}
}
for(const card of cards) card.addEventListener('toggle',()=>{if(card.open) renderCard(card);});
function filter(remember=true){
  const words=query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  let count=0;
  for(const card of cards){
    card.hidden=Boolean(volume.value&&card.closest('.knowledge-group').dataset.volume!==volume.value)||!words.every(w=>card.dataset.search.includes(w));
    if(!card.hidden) count++;
  }
  for(const group of groups) group.hidden=![...group.querySelectorAll('.knowledge-card')].some(card=>!card.hidden);
  status.textContent=`显示 ${count} / ${cards.length} 张知识卡；卡片不等于配套练习已完成。`;
  document.querySelector('#knowledge-empty').hidden=count>0;
  if(remember){
    const url=new URL(location.href);
    for(const [key,value] of [['q',query.value.trim()],['v',volume.value]]) value?url.searchParams.set(key,value):url.searchParams.delete(key);
    history.replaceState(null,'',url);
  }
}
query.addEventListener('input',()=>filter());volume.addEventListener('change',()=>filter());
document.querySelector('#knowledge-clear').addEventListener('click',()=>{query.value='';volume.value='';filter();query.focus();});
function revealHash(){
  const target=document.getElementById(location.hash.slice(1));
  if(!target) return;
  if(target.hidden){query.value='';volume.value='';filter();}
  if(target.matches('.knowledge-card')){target.open=true;renderCard(target);}
  requestAnimationFrame(()=>target.scrollIntoView({block:'start',behavior:'instant'}));
}
// Category links are navigational: a previous search must not hide their target.
document.querySelector('.knowledge-nav nav').addEventListener('click',event=>{
  if(!event.target.closest('a')) return;
  query.value='';volume.value='';filter();
});
window.addEventListener('hashchange',revealHash);
window.addEventListener('popstate',()=>{
  const params=new URLSearchParams(location.search);query.value=params.get('q')||'';volume.value=params.get('v')||'';filter(false);revealHash();
});
window.KnowledgeMath={errors,renderAll:()=>Promise.all(cards.map(renderCard)),get rendered(){return document.querySelectorAll('[data-math-rendered]').length;},get total(){return document.querySelectorAll('.math').length;}};
filter(false);revealHash();
document.documentElement.dataset.ready='true';
