'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const base=process.env.PUBLIC_BASE_URL||pathToFileURL(path.resolve(__dirname,'../dist')+'/').href;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
  const failures=[];
  try {
    for(const chapter of ['DEMO-01','DEMO-02','DEMO-04','DEMO-05','DEMO-06','DEMO-07','DEMO-08','DEMO-09','DEMO-10','DEMO-11'])for(const width of [320,360,390])for(const edition of ['teacher','student']){
      const page=await browser.newPage({viewport:{width,height:850}});
      await page.goto(new URL(`chapters/${chapter}-${edition}.html`,base).href);
      await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
      await page.locator('.solution').evaluateAll(nodes=>nodes.forEach(n=>{n.open=true;}));
      await page.evaluate(async()=>{await BookMath.renderAll();await document.fonts.ready;});
      const bad=await page.locator('.math').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+1)
        .map(n=>({tex:n.querySelector('annotation')?.textContent,width:n.scrollWidth,available:n.clientWidth})));
      const mathErrors=await page.evaluate(()=>BookMath.errors);
      const pageOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
      if(bad.length||mathErrors.length||pageOverflow)failures.push({chapter,width,edition,bad,mathErrors,pageOverflow});
      await page.close();
      console.log(`${chapter} ${width} ${edition}: ${bad.length||mathErrors.length||pageOverflow?'FAILED':'all formulas fit'}`);
    }
    // Keep the full cross-platform failure list instead of stopping at the first lesson.
    assert.deepEqual(failures,[],JSON.stringify(failures,null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
