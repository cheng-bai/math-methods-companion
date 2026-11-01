'use strict';
const input=document.querySelector('#global-query');
const status=document.querySelector('#search-status');
const results=document.querySelector('#search-results');
const knowledgeResults=document.querySelector('#knowledge-search-results');
const volume=document.querySelector('#search-volume');
const role=document.querySelector('#search-role');
const difficulty=document.querySelector('#search-difficulty');
const edition=document.querySelector('#search-edition');
const pagination=document.querySelector('.search-pagination');
const pageLabel=document.querySelector('#search-page');
const prev=document.querySelector('#search-prev');
const next=document.querySelector('#search-next');
const pageSize=30;
let loading, serial=0, page=0, found=[], timer, browsing=false;
let searchable, knowledgeSearchable;
const initial=new URLSearchParams(location.search);
const catalogQuery=document.querySelector('#catalog-query');
const catalogStatus=document.querySelector('#catalog-status');
const catalogVolumes=[...document.querySelectorAll('.catalog-volume')];
const catalogItems=catalogVolumes.flatMap(section=>[...section.querySelectorAll('.public-catalog-item')].map(item=>({
  item, section, text:(section.querySelector('h2').textContent+' '+item.querySelector('b').textContent+' '+item.querySelector('span').textContent).toLocaleLowerCase()
})));
catalogQuery.value=initial.get('catalog') || '';
input.value=initial.get('q') || '';
for(const [control,key] of [[volume,'v'],[role,'r'],[difficulty,'d'],[edition,'e']]) {
  const value=initial.get(key);
  if(value!==null && [...control.options].some(option=>option.value===value)) control.value=value;
}
browsing=initial.get('all')==='1';
const initialPage=/^\d+$/.test(initial.get('page') || '') ? Math.max(0,Number(initial.get('page'))-1) : 0;
page=initialPage;
function remember(){
  const url=new URL(location.href);
  const values={q:input.value.trim(),v:volume.value,r:role.value,d:difficulty.value,
    e:edition.value==='teacher'?'':edition.value,all:browsing?'1':'',page:page>0?String(page+1):'',
    catalog:catalogQuery.value.trim()};
  for(const [key,value] of Object.entries(values)) value ? url.searchParams.set(key,value) : url.searchParams.delete(key);
  history.replaceState(null,'',url);
}
function filterCatalog(updateUrl=true){
  const words=catalogQuery.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  let count=0;
  for(const {item,text} of catalogItems){item.hidden=!words.every(word=>text.includes(word));if(!item.hidden)count++;}
  for(const section of catalogVolumes) section.hidden=![...section.querySelectorAll('.public-catalog-item')].some(item=>!item.hidden);
  catalogStatus.textContent=`显示 ${count} / ${catalogItems.length} 讲目录；正文暂未公开。`;
  if(updateUrl) remember();
}
catalogQuery.addEventListener('input',()=>filterCatalog());
document.querySelector('#catalog-clear').addEventListener('click',()=>{catalogQuery.value='';filterCatalog();catalogQuery.focus();});
filterCatalog(false);
function loadIndex(){
  if(!loading) loading=new Promise((resolve,reject)=>{
    const script=document.createElement('script'); script.src='assets/search-index.js';
    script.onload=()=>{
      try{
        if(!Array.isArray(window.BOOK_SEARCH_INDEX)||!Array.isArray(window.BOOK_KNOWLEDGE_INDEX))throw new Error('索引版本不匹配');
        searchable = window.BOOK_SEARCH_INDEX.map(q => [q.chapter,q.id,q.volume,q.chapter_title,
          q.title,q.method,q.submethod,q.stem,q.type_family,q.type_title,q.type_note]
          .join(' ').toLocaleLowerCase());
        knowledgeSearchable = window.BOOK_KNOWLEDGE_INDEX.map(card =>
          [card.title,card.volume,card.section,card.formula,card.recognize,card.caution].join(' ').toLocaleLowerCase());
        resolve(window.BOOK_SEARCH_INDEX);
      }catch(error){loading=null;script.remove();reject(error);}
    };
    script.onerror=()=>{loading=null; script.remove(); reject(new Error('检索索引加载失败'));};
    document.head.append(script);
  });
  return loading;
}
function showKnowledge(words){
  knowledgeResults.replaceChildren();
  // Example-specific filters must not be presented as filters on knowledge cards.
  knowledgeResults.hidden=(!words.length&&!volume.value)||!!role.value||!!difficulty.value;
  if(knowledgeResults.hidden)return;
  const cards=window.BOOK_KNOWLEDGE_INDEX.filter((card,i)=>
    (!volume.value||card.volume===volume.value)&&words.every(word=>knowledgeSearchable[i].includes(word)));
  // Title matches should precede incidental mentions inside explanatory notes.
  const score=card=>words.reduce((total,word)=>total+(card.title.toLocaleLowerCase().includes(word)?4:0)
    +(card.section.toLocaleLowerCase().includes(word)?1:0),0);
  cards.sort((a,b)=>score(b)-score(a));
  const title=document.createElement('h3');title.textContent=`知识卡 · ${cards.length} 张`;
  const intro=document.createElement('p');intro.textContent='知识概括与例题分开列出；未命中不代表没有相关知识。';
  const list=document.createElement('div');list.className='home-knowledge-list';
  for(const card of cards.slice(0,5)){
    const link=document.createElement('a');link.href=`knowledge.html#${card.id}`;
    const name=document.createElement('strong');name.textContent=card.title.replaceAll('$','');
    const detail=document.createElement('small');detail.textContent=`${card.volume} / ${card.section}`;
    link.append(name,detail);list.append(link);
  }
  knowledgeResults.append(title,intro,list);
  if(cards.length>5){
    const params=new URLSearchParams();if(input.value.trim())params.set('q',input.value.trim());if(volume.value)params.set('v',volume.value);
    const all=document.createElement('a');all.className='all-knowledge-results';all.href=`knowledge.html?${params}`;
    all.textContent=`查看全部 ${cards.length} 张匹配知识卡 ↗`;knowledgeResults.append(all);
  }
}
function showPage(){
  results.replaceChildren();
  const total=Math.ceil(found.length/pageSize);
  pagination.hidden=total<=1;
  page=Math.max(0,Math.min(page,Math.max(0,total-1)));
  pageLabel.textContent=`第 ${page+1} / ${total} 页`;
  prev.disabled=page===0; next.disabled=page+1>=total;
  const fragment=document.createDocumentFragment();
  found.slice(page*pageSize,(page+1)*pageSize).forEach(q=>{
    const link=document.createElement('a');link.className='search-result';
    link.href=`chapters/${q.chapter}-${edition.value}.html#${q.id.toLowerCase()}`;
    const id=document.createElement('b');id.textContent=`${q.chapter} · ${q.id}`;
    const title=document.createElement('strong');title.textContent=q.title;
    const note=document.createElement('small');note.textContent=`${q.volume} / ${q.type_title} · ${q.role} · ${q.difficulty}`;
    link.append(id,title,note);fragment.append(link);
  });
  results.append(fragment);
}
async function search(restorePage=0){
  const query=input.value.trim().toLocaleLowerCase();const request=++serial;
  found=[];results.replaceChildren();knowledgeResults.replaceChildren();knowledgeResults.hidden=true;pagination.hidden=true;
  if(!query&&!volume.value&&!role.value&&!difficulty.value&&!browsing){
    page=0;remember();status.textContent='输入关键词或选择条件检索；也可浏览全部公开演示。';return;
  }
  status.textContent='正在检索…';
  try{
    const index=await loadIndex();if(request!==serial)return;
    const words=query.split(/\s+/).filter(Boolean);
    found=index.filter((q,i)=>{
      if(volume.value&&q.volume!==volume.value)return false;
      if(role.value&&q.role!==role.value)return false;
      if(difficulty.value&&q.difficulty!==difficulty.value)return false;
      return words.every(word=>searchable[i].includes(word));
    });
    showKnowledge(words);
    page=restorePage;status.textContent=`公开例训：找到 ${found.length} 个题块${found.length>pageSize?'，可翻页查看':''}。${role.value||difficulty.value?'例题类型和难度筛选不适用于知识卡。':''}`;
    showPage();remember();
  }catch(e){if(request===serial)status.textContent='检索索引加载失败，请检查本地文件是否完整。';}
}
input.addEventListener('input',()=>{
  clearTimeout(timer);++serial;found=[];results.replaceChildren();
  knowledgeResults.replaceChildren();knowledgeResults.hidden=true;pagination.hidden=true;
  status.textContent='正在准备检索…';timer=setTimeout(search,120);
});
for(const control of [volume,role,difficulty])control.addEventListener('change',()=>{clearTimeout(timer);search();});
edition.addEventListener('change',()=>{showPage();remember();});
document.querySelector('#search-all').addEventListener('click',()=>{clearTimeout(timer);input.value='';volume.value='';role.value='';difficulty.value='';browsing=true;search();});
prev.addEventListener('click',()=>{page--;showPage();remember();});
next.addEventListener('click',()=>{page++;showPage();remember();});
if(input.value || volume.value || role.value || difficulty.value || browsing) search(initialPage);
