'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs/promises'), path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
function samples(){
  for(const a of [-3,0,.2,1,1.5,2,4]){
    const f=x=>x*x-2*a*x, min=a<0?0:a<=2?-a*a:4-4*a, max=Math.max(0,4-4*a);
    for(let i=0;i<=80;i++){const y=f(i/40);assert.ok(y>=min-1e-10&&y<=max+1e-10);}
  }
  for(const r of [-2,-1,-.9,-.5,0,.5,1,2]){
    let a=2;
    for(let n=1;n<=30;n++){
      const exact=r===1?3*n-1:r===0?(n===1?2:3):((2*r+1)*r**(n-1)-3)/(r-1);
      assert.ok(Math.abs(a-exact)<1e-6);if(r>=-1)assert.ok(a>0);a=r*a+3;
    }
  }
  let s=0,t=0;
  for(let n=1;n<=100;n++){
    s+=1/(n*(n+2));t+=n/((n+1)*(n+2)*(n+3));
    assert.ok(Math.abs(s-(.75-.5/(n+1)-.5/(n+2)))<1e-12);
    assert.ok(Math.abs(t-(.25-1/(n+2)+3/(2*(n+2)*(n+3))))<1e-12);
    assert.equal(s>2/3,n>=11);assert.ok(t<.25);
  }
}
(async()=>{
  samples();
  const root=path.resolve(__dirname,'..');
  const chapters=await Promise.all(['demo.json','functions.json','sequences.json','trigonometry.json','vectors.json'].map(async name=>JSON.parse(await fs.readFile(path.join(root,'content',name),'utf8'))));
  const base=process.env.PUBLIC_BASE_URL||pathToFileURL(path.join(root,'dist/')).href;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
  const records=[];
  try{
    for(const width of [1100,390]){
      const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'}),errors=[];
      page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(new URL('index.html',base).href);
      assert.deepEqual(await page.locator('.public-lesson').evaluateAll(nodes=>nodes.map(n=>n.dataset.chapter)),['DEMO-02','DEMO-01','DEMO-04','DEMO-05','DEMO-06']);
      assert.equal(await page.locator('.public-lesson a').count(),chapters.length*2);
      assert.equal(await page.evaluate(()=>!!window.BOOK_SEARCH_INDEX),false);
      for(const chapter of chapters.slice(1))for(const edition of ['teacher','student'])for(const q of chapter.questions){
        await page.goto(new URL(`index.html?q=${q.id}&e=${edition}`,base).href);
        await page.waitForFunction(()=>document.querySelectorAll('.search-result').length===1);
        await page.locator('.search-result').click();
        await page.waitForURL(url=>url.href.endsWith(`${chapter.id}-${edition}.html#${q.id.toLowerCase()}`));
        await page.waitForFunction(()=>document.documentElement?.dataset.ready==='true');
        assert.ok(page.url().endsWith(`${chapter.id}-${edition}.html#${q.id.toLowerCase()}`));
        assert.equal(await page.locator('.question').count(),4);
        assert.equal(await page.locator('.solution').count(),edition==='teacher'?4:0);
        assert.equal(await page.locator('.sidebar .chapter-link.active').count(),1);
        assert.equal(await page.locator('.sidebar a.chapter-link').count(),chapters.length);
        assert.ok((await page.locator('.position').textContent()).includes(chapter.title));
        const card=page.locator(`#${q.id.toLowerCase()}`),partner=chapter.questions.find(o=>o.id!==q.id&&o.type_id===q.type_id);
        assert.ok(partner);await card.locator(`.question-related a[href="#${partner.id.toLowerCase()}"]`).click();
        assert.equal(new URL(page.url()).hash,`#${partner.id.toLowerCase()}`);
        await page.evaluate(()=>BookMath.renderAll());
        assert.deepEqual(await page.evaluate(()=>BookMath.errors),[]);
        assert.equal(await page.evaluate(()=>BookMath.rendered===BookMath.total),true);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        if(edition==='teacher'){
          await card.locator('.solution>summary').click();
          await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
          assert.ok((await card.locator('.solution').textContent()).includes('条件与边界检查'));
          const oversized = await card.locator('.math').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>({width:n.scrollWidth,available:n.clientWidth,tex:n.querySelector('annotation')?.textContent,css: getComputedStyle(n).display})));
          assert.deepEqual(oversized,[],`${width} ${edition} ${q.id}: 公式不能依赖横向滚动`);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
          if(process.env.SCREENSHOT_DIR&&['Q102','Q202','Q204','Q302','Q304','Q402','Q404'].includes(q.id)){
            await fs.mkdir(process.env.SCREENSHOT_DIR,{recursive:true});await card.locator('h4').scrollIntoViewIfNeeded();
            await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`${width}-${q.id}.png`)});
            await card.locator('.solution').screenshot({path:path.join(process.env.SCREENSHOT_DIR,`${width}-${q.id}-solution.png`)});
          }
        }else assert.equal(await card.locator('.note-tip').count(),0);
      }
      // Exercise a real cross-chapter sidebar route; preserve the selected edition.
      if(await page.locator('.menu-toggle').isVisible())await page.locator('.menu-toggle').click();
      await page.locator('.sidebar .volume').filter({has:page.locator('a[href="DEMO-02-student.html"]')}).locator('summary').click();
      await page.locator('.sidebar a[href="DEMO-02-student.html"]').click();
      await page.waitForURL(url=>url.href.endsWith('DEMO-02-student.html'));
      assert.deepEqual(errors,[]);records.push({width,searchRoutes:chapters.slice(1).reduce((n,c)=>n+c.questions.length*2,0),mathErrors:0,overflow:false});await page.close();
    }
    console.log(JSON.stringify({base,records,samples:'pass'},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
