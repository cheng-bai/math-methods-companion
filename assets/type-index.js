'use strict';
const input=document.querySelector('#type-query'),volume=document.querySelector('#type-volume');
const items=[...document.querySelectorAll('.type-index-item')];
const lessons=[...document.querySelectorAll('.type-index-lesson')],volumes=[...document.querySelectorAll('.type-index-volume')];
const status=document.querySelector('#type-count'),empty=document.querySelector('#type-empty');
const params=new URLSearchParams(location.search);
input.value=params.get('q')||'';
if([...volume.options].some(option=>option.value===params.get('v')))volume.value=params.get('v');
function filter(update=true){
  const words=input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  let count=0;
  for(const item of items){item.hidden=!!(volume.value&&item.dataset.volume!==volume.value)||!words.every(word=>item.dataset.search.includes(word));if(!item.hidden)count++;}
  for(const section of lessons)section.hidden=![...section.querySelectorAll('.type-index-item')].some(item=>!item.hidden);
  for(const section of volumes)section.hidden=![...section.querySelectorAll('.type-index-item')].some(item=>!item.hidden);
  status.textContent=`显示 ${count} / ${items.length} 个公开细题型。`;empty.hidden=count>0;
  if(update){const url=new URL(location.href);for(const [key,value] of [['q',input.value.trim()],['v',volume.value]])value?url.searchParams.set(key,value):url.searchParams.delete(key);history.replaceState(null,'',url);}
}
input.addEventListener('input',()=>filter());volume.addEventListener('change',()=>filter());
document.querySelector('#type-clear').addEventListener('click',()=>{input.value='';volume.value='';filter();input.focus();});
window.addEventListener('popstate',()=>{const p=new URLSearchParams(location.search);input.value=p.get('q')||'';volume.value=p.get('v')||'';filter(false);});
filter(false);
