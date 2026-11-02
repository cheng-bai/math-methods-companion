'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {pathToFileURL}=require('node:url');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const root=path.resolve(__dirname,'..'),base=process.env.PUBLIC_BASE_URL||pathToFileURL(path.join(root,'dist')+'/').href;
  const files=['demo.json','functions.json','sequences.json','trigonometry.json','vectors.json','stereometry.json','conics.json','probability.json','complex.json','counting.json'];
  const chapters=await Promise.all(files.map(async f=>JSON.parse(await fs.readFile(path.join(root,'content',f),'utf8'))));
  const types=chapters.flatMap(c=>[...new Set(c.questions.map(q=>q.type_id))].map(id=>({chapter:c.id,id})));
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
  try{
    for(const width of [320,390,1100]){
      const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(new URL('types.html',base).href);
      assert.equal(await page.locator('.type-index-item').count(),types.length);
      const links=await page.locator('.type-index-item nav a').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')));
      for(const t of types)for(const edition of ['teacher','student'])assert.ok(links.includes(`chapters/${t.chapter}-${edition}.html#type-${t.id}`));
      await page.locator('#type-query').fill('Q901');
      assert.equal(await page.locator('.type-index-item:visible').count(),1);
      assert.match(await page.locator('#type-count').textContent(),new RegExp(`1 / ${types.length}`));
      await page.reload();assert.equal(await page.locator('#type-query').inputValue(),'Q901');
      await page.locator('.type-index-item:visible a').first().click();
      await page.waitForFunction(()=>document.documentElement?.dataset.ready==='true');
      assert.equal(await page.locator('.type-group:target').count(),1);
      assert.equal(await page.locator('.type-group:target').evaluate(n=>n.closest('details').open),true);
      await page.locator('.page-footer a[href^="../types.html"]').click();
      assert.equal(new URL(page.url()).hash,'#lesson-DEMO-09');
      await page.locator('#type-query').fill('不存在XYZ');
      assert.equal(await page.locator('.type-index-item:visible').count(),0);
      assert.equal(await page.locator('#type-empty').isVisible(),true);
      await page.locator('#type-clear').click();
      assert.equal(await page.locator('.type-index-item:visible').count(),types.length);
      await page.selectOption('#type-volume','11 概率与统计');
      assert.equal(await page.locator('.type-index-volume:visible').count(),1);
      assert.equal(await page.locator('.type-index-item:visible').count(),2);
      await page.locator('#type-clear').click();
      await page.locator('#type-query').fill('Q1004');
      assert.equal(await page.locator('.type-index-item:visible').count(),1);
      await page.locator('.type-index-item:visible a').filter({hasText:'学生版'}).click();
      await page.waitForFunction(()=>document.documentElement?.dataset.ready==='true');
      assert.ok(page.url().includes('DEMO-10-student.html#type-'));
      assert.equal(await page.locator('.solution').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      assert.deepEqual(errors,[]);await page.close();console.log(`type index ${width}: passed`);
    }
    const nojs=await browser.newPage({javaScriptEnabled:false});await nojs.goto(new URL('types.html',base).href);
    assert.equal(await nojs.locator('.type-index-item:visible').count(),types.length);
    assert.equal(await nojs.locator('.type-index-item nav a').count(),types.length*2);await nojs.close();
    console.log(`type index no JS: ${types.length} types visible`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
