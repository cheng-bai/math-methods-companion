'use strict';
document.addEventListener('DOMContentLoaded', async () => {
  const meta = JSON.parse(document.querySelector('#source-meta').textContent);
  const errors = [];
  const mathNodes = [...document.querySelectorAll('.math')];
  function renderMath(nodes) {
    for (const node of nodes) {
      if (node.dataset.mathRendered) continue;
      const text = node.textContent.trim();
      const tex = text.startsWith('\\(') && text.endsWith('\\)') ? text.slice(2,-2) : text.startsWith('\\[') && text.endsWith('\\]') ? text.slice(2,-2) : text;
      try { katex.render(tex, node, {displayMode:node.classList.contains('display'), throwOnError:true, strict:'error'}); }
      catch (e) { errors.push({tex,message:String(e)}); node.classList.add('math-error'); }
      node.dataset.mathRendered = 'true';
    }
  }
  // Closed solutions have no visible layout. Render them only when requested.
  const solutions = [...document.querySelectorAll('details.solution')];
  for (const details of solutions) details.addEventListener('toggle', () => {
    if (details.open) renderMath(details.querySelectorAll('.math'));
  });
  renderMath(mathNodes.filter(node => !node.closest('details.solution:not([open])')));
  // Audits explicitly render every formula; a fast initial read is not a full audit.
  window.BookMath = {renderAll: () => renderMath(mathNodes), errors,
    get rendered() { return mathNodes.filter(node => node.dataset.mathRendered).length; },
    total: mathNodes.length};
  await document.fonts.ready;
  const cards = [...document.querySelectorAll('.question')];
  const search = document.querySelector('#search');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  const count = document.querySelector('.live-count');
  const toggle = document.querySelector('.toggle-solutions');
  let filter = 'all';
  function applyFilter() {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    for (const card of cards) {
      const matchesKind = filter === 'all' || card.dataset.role === filter || card.dataset.difficulty === filter;
      card.hidden = !(matchesKind && card.dataset.search.includes(query));
      if (!card.hidden) visible++;
    }
    count.textContent = `${visible} / ${cards.length} 题块`;
  }
  filterButtons.forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    filterButtons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    applyFilter();
  }));
  search.addEventListener('input', applyFilter);
  if (toggle) toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-pressed') !== 'true';
    cards.forEach(card => {
      const solution = card.querySelector('.solution');
      if (open) renderMath(solution.querySelectorAll('.math'));
      solution.open = open;
    });
    toggle.setAttribute('aria-pressed', String(open));
    toggle.textContent = open ? '收起全部解析' : '展开全部解析';
  });
  function jumpTo(link) {
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    const family = target.closest('.type-family');
    if (family) family.open = true;
    history.pushState(null, '', link.getAttribute('href'));
    window.scrollTo({top: target.getBoundingClientRect().top + window.scrollY - 85, behavior:'instant'});
  }
  document.querySelectorAll('.question-index a, .type-links a, .question-related a').forEach(link => link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    search.value = ''; filter = 'all'; filterButtons.forEach(b => b.setAttribute('aria-pressed',String(b.dataset.filter === 'all'))); applyFilter();
    event.preventDefault(); jumpTo(link);
  }));
  document.querySelectorAll('.question-type-link').forEach(link => link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); jumpTo(link);
  }));
  const sidebar = document.querySelector('.sidebar'), backdrop = document.querySelector('.backdrop'), menu = document.querySelector('.menu-toggle');
  const editionLink = document.querySelector('.top-right a');
  const editionHref = editionLink.getAttribute('href');
  editionLink.addEventListener('click', () => {
    const sharedHash = /^#(?:q\d+|type-\d+-\d+)$/i.test(location.hash) ? location.hash : '';
    editionLink.setAttribute('href', editionHref + sharedHash);
  });
  function setMenu(open) {sidebar.classList.toggle('open',open);backdrop.hidden=!open;menu.setAttribute('aria-expanded',String(open));}
  menu.addEventListener('click',()=>setMenu(true));
  document.querySelector('.menu-close').addEventListener('click',()=>setMenu(false));
  backdrop.addEventListener('click',()=>setMenu(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);});
  document.querySelector('.jump-to-volume').addEventListener('click',()=>{const active=document.querySelector('.volume:has(.active)');active.open=true;if(innerWidth<=760)setMenu(true);active.scrollIntoView({block:'nearest'});});
  const outlineToggle = document.querySelector('.outline-toggle');
  outlineToggle.addEventListener('click', () => {
    const open = outlineToggle.getAttribute('aria-expanded') !== 'true';
    outlineToggle.setAttribute('aria-expanded', String(open));
    outlineToggle.textContent = open ? '收起本讲大纲与题号 ↑' : '展开本讲大纲与题号 ↓';
  });
  const outline = [...document.querySelectorAll('.outline a')];
  const headingNodes = outline.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const progress = document.querySelector('.reading-progress span');
  let scrollFrame = 0, activeHeading;
  function onScroll() {
    scrollFrame = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    const fraction = max > 0 ? scrollY / max : 0;
    let current = headingNodes[0];
    for (const heading of headingNodes) {
      if (heading.getBoundingClientRect().top <= 110) current = heading;
      else break;
    }
    progress.style.transformOrigin = 'left';
    progress.style.width = '100%';
    progress.style.transform = `scaleX(${fraction})`;
    if (current !== activeHeading) {
      activeHeading = current;
      outline.forEach(a => a.classList.toggle('current', a.hash === '#' + current?.id));
    }
  }
  function scheduleScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(onScroll);
  }
  addEventListener('scroll', scheduleScroll, {passive:true});
  addEventListener('resize', scheduleScroll, {passive:true});
  new ResizeObserver(scheduleScroll).observe(document.querySelector('.reading-column'));
  addEventListener('beforeprint', window.BookMath.renderAll);
  onScroll();
  window.__sample = {ready:true, errors, mathCount:document.querySelectorAll('.math').length, questions:cards.length, source:meta};
  document.documentElement.dataset.ready = 'true';
  // Anchor navigation from the dictionary must land after math has changed layout.
  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    const family = target?.closest('.type-family');
    if (family) family.open = true;
    if (target) window.scrollTo({top: target.getBoundingClientRect().top + window.scrollY - 85, behavior: 'instant'});
  }
});
