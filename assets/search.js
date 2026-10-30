'use strict';
const input=document.querySelector('#global-query');
const status=document.querySelector('#search-status');
const results=document.querySelector('#search-results');
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
let searchable;
const initial=new URLSearchParams(location.search);
input.value=initial.get('q') || '';
for(const [control,key] of [[volume,'v'],[role,'r'],[difficulty,'d'],[edition,'e']]) {
  const value=initial.get(key);
  if(value!==null && [...control.options].some(option=>option.value===value)) control.value=value;
}
browsing=initial.get('all')==='1';
const initialPage=/^\d+$/.test(initial.get('page') || '') ? Math.max(0,Number(initial.get('page'))-1) : 0;
function remember(){
  const url=new URL(location.href);
  const values={q:input.value.trim(),v:volume.value,r:role.value,d:difficulty.value,
    e:edition.value==='teacher'?'':edition.value,all:browsing?'1':'',page:page>0?String(page+1):''};
  for(const [key,value] of Object.entries(values)) value ? url.searchParams.set(key,value) : url.searchParams.delete(key);
  history.replaceState(null,'',url);
}
function loadIndex(){
  if(!loading) loading=new Promise((resolve,reject)=>{
    const script=document.createElement('script'); script.src='assets/search-index.js';
    script.onload=()=>{
      searchable = window.BOOK_SEARCH_INDEX.map(q => [q.chapter,q.id,q.volume,q.chapter_title,
        q.title,q.method,q.submethod,q.stem,q.type_family,q.type_title,q.type_note]
        .join(' ').toLocaleLowerCase());
      resolve(window.BOOK_SEARCH_INDEX);
    };
    script.onerror=()=>{loading=null; script.remove(); reject(new Error('检索索引加载失败'));};
    document.head.append(script);
  });
  return loading;
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
  results.replaceChildren();pagination.hidden=true;
  if(!query&&!volume.value&&!role.value&&!difficulty.value&&!browsing){
    page=0;remember();status.textContent='输入关键词或选择条件检索；也可浏览全书题目。';return;
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
    page=restorePage;status.textContent=`找到 ${found.length} 个题块${found.length>pageSize?'，可翻页查看':''}。`;
    showPage();remember();
  }catch(e){if(request===serial)status.textContent='检索索引加载失败，请检查本地文件是否完整。';}
}
input.addEventListener('input',()=>{clearTimeout(timer);++serial;timer=setTimeout(search,120);});
for(const control of [volume,role,difficulty])control.addEventListener('change',()=>{clearTimeout(timer);search();});
edition.addEventListener('change',()=>{showPage();remember();});
document.querySelector('#search-all').addEventListener('click',()=>{clearTimeout(timer);input.value='';volume.value='';role.value='';difficulty.value='';browsing=true;search();});
prev.addEventListener('click',()=>{page--;showPage();remember();});
next.addEventListener('click',()=>{page++;showPage();remember();});
if(input.value || volume.value || role.value || difficulty.value || browsing) search(initialPage);
