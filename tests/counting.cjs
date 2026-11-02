'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const root=path.resolve(__dirname,'..');const base=process.env.PUBLIC_BASE_URL||pathToFileURL(path.join(root,'dist')+path.sep).href;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
try{for(const width of [320,390,1100])for(const edition of ['teacher','student']){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(new URL(`chapters/DEMO-11-${edition}.html`,base).href);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 assert.equal(await page.locator('.question').count(),2);assert.equal(await page.locator('.solution').count(),edition==='teacher'?2:0);
 await page.locator('#search').fill('Q1102');assert.equal(await page.locator('.question:visible').count(),1);await page.locator('#search').fill('');
 await page.locator('#q1101 .question-related a[href="#q1102"]').click();assert.equal(new URL(page.url()).hash,'#q1102');
 await page.locator('#q1102 .question-related a[href="#q1101"]').click();assert.equal(new URL(page.url()).hash,'#q1101');
 await page.evaluate(()=>BookMath.renderAll());assert.deepEqual(await page.evaluate(()=>BookMath.errors),[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.locator('#q1101 .question-knowledge a[href="../knowledge.html#k-fa41bf2b"]').click();await page.waitForFunction(()=>document.querySelector('#k-fa41bf2b')?.open);
 const route=`chapters/DEMO-11-${edition}.html#q1101`;await page.locator(`#k-fa41bf2b .knowledge-examples a[href="${route}"]`).click();await page.waitForURL(u=>u.href.endsWith(route));
 assert.equal(await page.locator('.solution').count(),edition==='teacher'?2:0);assert.deepEqual(errors,[]);await page.close();console.log(`${width} ${edition}: filter, paired links, math, card return, isolation OK`);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
