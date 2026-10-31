'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL, fileURLToPath} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const dist = path.resolve(process.env.DIST_DIR || path.join(root, 'dist'));
const normalize = value => value.replace(/\\[()[\]]|\$|\s+/g, '');
const expected = [
  {id:'q01', stem:'已知$x,y>0$，且$x+y=9$，求$\\dfrac4x+\\dfrac{25}y$的最小值。', answer:'\\dfrac{49}{9}', equality:['5x=2y', 'x=\\dfrac{18}{7}', 'y=\\dfrac{45}{7}']},
  {id:'q02', stem:'已知$x>2$，求$\\dfrac{x^2}{x-2}$的最小值。', answer:'8', equality:['t=2', 'x=4']},
  {id:'q03', stem:'已知$a,b>0$，且$ab=1$，求$a^2+b^2+a+b$的最小值。', answer:'4', equality:['s=2', 'a=b=1']},
];

// Independent numeric checks supplement, rather than replace, the algebraic review.
function checkMathematics() {
  const close = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);
  for (const x of [.1, .5, 1, 18/7, 4, 6, 8.9]) {
    const y=9-x, target=4/x+25/y;
    close(9*target, 49+(5*x-2*y)**2/(x*y));
    assert.ok(target>=49/9-1e-12);
  }
  close(4/(18/7)+25/(45/7), 49/9);
  for (const t of [.01,.2,1,2,5,50]) {
    const x=t+2;
    close(x*x/(x-2), t+4+4/t);
    assert.ok(x*x/(x-2)>=8-1e-12);
  }
  close(4*4/(4-2),8);
  for (const a of [.01,.2,.5,1,2,10]) {
    const b=1/a, s=a+b, target=a*a+b*b+a+b;
    close(target-4,(s-2)*(s+3));
    assert.ok(target>=4-1e-12);
  }
  close(1+1+1+1,4);
}

async function main() {
  checkMathematics();
  const demo = JSON.parse(await fs.readFile(path.join(root, 'content/demo.json'), 'utf8'));
  const questionCount = demo.questions.length;
  const publications = await Promise.all(['demo.json','functions.json','sequences.json'].map(async name => JSON.parse(await fs.readFile(path.join(root,'content',name),'utf8'))));
  const allQuestions = publications.flatMap(chapter => chapter.questions.map(q => ({...q, chapter:chapter.id})));
  const publicCount = allQuestions.length;
  const browser = await chromium.launch({headless:true,
    ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
  const bases=[{name:'file',url:pathToFileURL(dist+path.sep).href}];
  if(process.env.PUBLIC_BASE_URL) bases.push({name:'http',url:process.env.PUBLIC_BASE_URL.replace(/\/?$/, '/')});
  const records=[];
  const screenshots=process.env.SCREENSHOT_DIR && path.resolve(process.env.SCREENSHOT_DIR);
  if(screenshots) await fs.mkdir(screenshots,{recursive:true});
  try {
    for(const base of bases) for(const width of [1100,390]) {
      const page=await browser.newPage({viewport:{width,height:900}});
      const failures=[];
      page.on('pageerror',error=>failures.push(String(error)));
      page.on('response',response=>{if(response.status()>=400) failures.push(`${response.status()} ${response.url()}`);});
      const requests=[];
      page.on('request',request=>requests.push(request.url()));
      const goto=async(relative,chapter=false)=>{
        await page.goto(new URL(relative,base.url).href);
        if(chapter) await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
        await page.evaluate(async()=>{await document.fonts.ready;document.documentElement.style.scrollBehavior='auto';});
      };
      const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'整页横向溢出');
      const shot=async name=>{if(screenshots) await page.screenshot({path:path.join(screenshots,`${base.name}-${width}-${name}.png`)});};
      const linksWork=async()=>{
        const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.href));
        for(const href of new Set(links)) {
          const url=new URL(href), hash=decodeURIComponent(url.hash.slice(1));
          if(!['file:','http:','https:'].includes(url.protocol)) continue;
          url.hash='';
          let html;
          if(url.protocol==='file:') html=await fs.readFile(fileURLToPath(url),'utf8');
          else {const response=await page.request.get(url.href);assert.equal(response.ok(),true,url.href);html=await response.text();}
          if(hash) assert.ok(html.includes(`id="${hash}"`),`缺少跳转目标 ${href}`);
        }
      };
      await goto('index.html');
      await page.waitForTimeout(180);
      assert.equal(requests.some(url=>url.includes('search-index.js')),false,'首页过早下载检索索引');
      assert.equal(await page.evaluate(()=>typeof window.BOOK_SEARCH_INDEX),'undefined');
      assert.equal(await page.locator('.public-catalog-item').count(),45);
      assert.equal(await page.locator('.public-catalog-item a').count(),0);
      assert.equal(await page.locator('.public-catalog-item').filter({hasText:'正文暂未公开'}).count(),45);
      assert.equal(await page.locator('.home-volume').filter({has:page.locator('.public-catalog-item')}).count(),12);
      await noOverflow(); await linksWork(); await shot('home');
      await page.locator('#catalog-query').fill('b09 三角');
      assert.equal(await page.locator('.public-catalog-item:visible').count(),1);
      assert.match(await page.locator('.public-catalog-item:visible').innerText(),/B09-03/);
      assert.match(await page.locator('#catalog-status').innerText(),/显示 1 \/ 45.*正文暂未公开/);
      assert.equal(await page.evaluate(()=>typeof window.BOOK_SEARCH_INDEX),'undefined','目录筛选不应加载演示索引');
      await page.reload();
      assert.equal(await page.locator('#catalog-query').inputValue(),'b09 三角');
      assert.equal(await page.locator('.public-catalog-item:visible').count(),1);
      await page.locator('#catalog-query').fill('找不到的目录xyz');
      assert.equal(await page.locator('.public-catalog-item:visible').count(),0);
      assert.match(await page.locator('#catalog-status').innerText(),/显示 0 \/ 45/);
      await page.locator('#catalog-query').fill('正文暂未公开');
      assert.equal(await page.locator('.public-catalog-item:visible').count(),0,'状态文字不是目录检索字段');
      await page.click('#catalog-clear');
      assert.equal(await page.locator('.public-catalog-item:visible').count(),45);
      assert.equal(await page.locator('#catalog-query').evaluate(n=>document.activeElement===n),true);
      await page.locator('#catalog-query').fill('B09');
      await page.click('#search-all');
      await page.waitForFunction(count=>document.querySelectorAll('.search-result').length===count,Math.min(publicCount,30));
      assert.equal(await page.locator('.public-catalog-item:visible').count(),3,'演示检索不应重置目录筛选');
      assert.equal(await page.locator('.public-catalog-item a').count(),0);
      const index=await page.evaluate(()=>window.BOOK_SEARCH_INDEX);
      assert.equal(index.length,publicCount);
      assert.deepEqual(index.map(q=>[q.chapter,q.id]),allQuestions.map(q=>[q.chapter,q.id]));
      assert.ok(index.every(q=>publications.some(c=>c.id===q.chapter) && !('answer' in q) && !('solution' in q)));
      for(const edition of ['teacher','student']) for(const question of expected) {
        await goto(`index.html?q=${question.id}&e=${edition}`);
        await page.waitForFunction(()=>document.querySelectorAll('.search-result').length===1);
        await page.click('.search-result');
        await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
        assert.ok(page.url().endsWith(`DEMO-01-${edition}.html#${question.id}`));
        const renderedStem=await page.locator(`#${question.id}`).evaluate(card=>[...card.children]
          .filter(n=>n.tagName==='P'&&!n.className).map(n=>{
            const copy=n.cloneNode(true);
            copy.querySelectorAll('.math').forEach(m=>{m.textContent=m.querySelector('annotation')?.textContent||m.textContent;});
            return copy.textContent;
          }).join(''));
        assert.equal(normalize(renderedStem),normalize(question.stem),'题干与独立期望不符');
        assert.equal(await page.locator('.solution').count(),edition==='teacher'?questionCount:0);
        if(edition==='student') {
          assert.equal(await page.locator('.toggle-solutions').count(),0);
          assert.equal(await page.locator('.book-content').evaluate(n=>/取等检查|典型错解|解题笔记|<strong>答案/.test(n.innerHTML)),false);
        }
        await noOverflow();
        const returnHash=await page.locator(`#${question.id} .question-type-link`).getAttribute('href');
        await page.click(`#${question.id} .question-type-link`);
        await page.waitForFunction(hash=>location.hash===hash&&document.querySelector(hash).closest('.type-family').open,returnHash);
        await page.click(`${returnHash} .type-links a[href="#${question.id}"]`);
        assert.equal(new URL(page.url()).hash,`#${question.id}`);
      }
      // Published numeric links and persistent IDs survive direct entry and edition changes.
      for(const [legacy, typeId] of Object.entries(demo.legacy_type_anchors)) {
        for(const hash of [legacy, `type-${typeId}`]) {
          await goto(`chapters/DEMO-01-teacher.html#${hash}`,true);
          assert.equal(await page.locator(`#${hash}`).evaluate(n=>n.closest('.type-group').id),`type-${typeId}`);
          assert.equal(await page.locator(`#${hash}`).evaluate(n=>n.closest('.type-family').open),true);
          await page.click('.top-right a');
          await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
          assert.equal(new URL(page.url()).hash,`#${hash}`);
          assert.equal(await page.locator(`#${hash}`).evaluate(n=>n.closest('.type-family').open),true);
        }
      }
      await goto('chapters/DEMO-01-teacher.html',true);
      assert.equal(await page.locator('.sidebar .chapter-link:not(a)').count(),45);
      assert.equal(await page.locator('.sidebar .chapter-link:not(a)').filter({hasText:'正文暂未公开'}).count(),45);
      const initialMath=await page.evaluate(()=>({rendered:BookMath.rendered,total:BookMath.total,
        hiddenRendered:document.querySelectorAll('.solution .math[data-math-rendered]').length}));
      assert.ok(initialMath.rendered>0&&initialMath.rendered<initialMath.total);
      assert.equal(initialMath.hiddenRendered,0,'未展开答案提前渲染');
      await page.click('.toggle-solutions');
      await page.waitForFunction(count=>document.querySelectorAll('.solution[open]').length===count,questionCount);
      assert.equal(await page.evaluate(()=>BookMath.rendered===BookMath.total),true);
      for(const question of expected) {
        const text=await page.locator(`#${question.id} .solution`).evaluate(n=>{
          const copy=n.cloneNode(true);copy.querySelectorAll('.math').forEach(m=>{m.textContent=m.querySelector('annotation')?.textContent||m.textContent;});return copy.textContent;
        });
        for(const token of [question.answer,...question.equality]) assert.ok(normalize(text).includes(normalize(token)),`${question.id} 缺少答案或取等条件 ${token}`);
      }
      assert.deepEqual(await page.evaluate(()=>BookMath.errors),[]);
      assert.equal(await page.locator('.math-error,.katex-error').count(),0);
      const scrollFormulas=await page.evaluate(()=>[...document.querySelectorAll('.math.display')].filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>{
        n.scrollLeft=n.scrollWidth;return {mode:getComputedStyle(n).overflowX,left:n.scrollLeft,max:n.scrollWidth-n.clientWidth};
      }));
      for(const formula of scrollFormulas) {
        assert.ok(['auto','scroll'].includes(formula.mode));
        assert.ok(formula.left>0&&Math.abs(formula.left-formula.max)<=1,'长公式无法滚动至右端');
      }
      await page.evaluate(()=>document.querySelectorAll('.math.display').forEach(n=>{n.scrollLeft=0;}));
      await noOverflow();await linksWork();
      await page.locator('#q01').scrollIntoViewIfNeeded();await shot('teacher-answer');
      await page.click('.toggle-solutions');
      assert.equal(await page.locator('.solution[open]').count(),0);
      await goto('chapters/DEMO-01-student.html',true);
      await page.evaluate(()=>BookMath.renderAll());
      assert.deepEqual(await page.evaluate(()=>BookMath.errors),[]);
      await noOverflow();await linksWork();await shot('student');
      assert.deepEqual(failures,[]);
      records.push({transport:base.name,width,catalog:45,searchQuestions:questionCount,searchJumps:expected.length*2,
        typeRoundTrips:expected.length*2,lazyMath:initialMath,mathErrors:0,studentSolutions:0,pageOverflow:false,
        scrollableLongFormulas:scrollFormulas.length,brokenLinks:0});
      await page.close();
      const offlineIndex=await browser.newPage({viewport:{width,height:900}});
      await offlineIndex.route('**/assets/search-index.js',route=>route.abort());
      await offlineIndex.goto(new URL('index.html?all=1&page=2&catalog=B09',base.url).href);
      await offlineIndex.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('加载失败'));
      assert.equal(new URL(offlineIndex.url()).searchParams.get('page'),'2');
      await offlineIndex.locator('#catalog-query').fill('B09 复数');
      assert.equal(new URL(offlineIndex.url()).searchParams.get('page'),'2','目录筛选不应丢掉等待中或失败的演示分页');
      await offlineIndex.close();
    }
  } finally {await browser.close();}
  const report={passed:true,algebraAndEqualityIndependentlyReviewed:true,records};
  if(process.env.REPORT_PATH) await fs.writeFile(process.env.REPORT_PATH,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
