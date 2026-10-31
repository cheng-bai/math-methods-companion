'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// Independent samples supplement the separately reviewed proofs and boundary cases.
function checkParameters() {
  for (const r of [.01, .2, .4, .40001, 1, 10]) {
    const minimum = r <= .4 ? 49/9 : (29+25*r+4/r)/9;
    const optimum = Math.max(.4, r);
    const f = t => (29+25*t+4/t)/9;
    assert.ok(Math.abs(f(optimum)-minimum)<1e-9);
    for (const t of [r, r+.01, r+1, r+10]) assert.ok(f(t)>=minimum-1e-9);
  }
  for (const b of [2.1, 3, 4, 4.0001, 7]) {
    const f = x => x*x/(x-2);
    const bound = b<=4 ? f(b) : 8;
    for (const u of [.01, .1, .5, .9, .99999]) {
      const x=2+(b-2)*u;
      assert.ok(f(x)>=bound-1e-9);
      if (b<=4) assert.ok(f(x)>bound);
    }
    assert.ok(Math.abs(f(b<=4?b:4)-bound)<1e-9);
  }
}

(async () => {
  checkParameters();
  const root=path.resolve(__dirname,'..');
  const demo=JSON.parse(await fs.readFile(path.join(root,'content/demo.json'),'utf8'));
  assert.deepEqual(demo.questions.slice(3).map(q=>q.id),['Q04','Q05']);
  const bases=[pathToFileURL(path.join(root,'dist')+path.sep).href];
  if(process.env.PUBLIC_BASE_URL) bases.push(process.env.PUBLIC_BASE_URL.replace(/\/?$/, '/'));
  const browser=await chromium.launch({headless:true,
    ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  try {
    for(const base of bases) for(const width of [1100,390]) for(const edition of ['teacher','student']) {
      const page=await browser.newPage({viewport:{width,height:900}});
      await page.goto(new URL(`chapters/DEMO-01-${edition}.html`,base).href);
      await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
      await page.evaluate(async()=>{await document.fonts.ready;document.documentElement.style.scrollBehavior='auto';});
      assert.equal(await page.locator('.question').count(),5);
      assert.equal(await page.locator('#q03 .question-related a').count(),0);
      for(const [from,to] of [['01','04'],['04','01'],['02','05'],['05','02']]) {
        await page.locator(`#q${from} .question-related a[href="#q${to}"]`).click();
        assert.equal(new URL(page.url()).hash,`#q${to}`);
        // A short final card cannot always align at 85px because the page ends.
        const top=await page.locator(`#q${to}`).evaluate(e=>e.getBoundingClientRect().top);
        assert.ok(top>=65 && top<840, `target heading not visible: ${top}`);
        const atBottom=await page.evaluate(()=>Math.abs(scrollY-(document.documentElement.scrollHeight-innerHeight))<2);
        assert.ok(Math.abs(top-85)<4 || atBottom, `unexpected scroll position: ${top}`);
      }
      for(const n of ['04','05']) {
        const q=page.locator(`#q${n}`);
        assert.equal(await q.getAttribute('data-role'),'自编训练');
        assert.equal(await q.locator('.solution').count(),edition==='teacher'?1:0);
        if(edition==='teacher') await q.locator('.solution summary').click();
        if(edition==='student') {
          assert.equal((await q.innerHTML()).includes('取等检查'),false);
          assert.equal(await q.locator('.note-tip').count(),0);
        }
      }
      const math=await page.evaluate(()=>{BookMath.renderAll();return {total:BookMath.total,rendered:BookMath.rendered,errors:BookMath.errors};});
      assert.equal(math.total,math.rendered);assert.deepEqual(math.errors,[]);
      if(edition==='teacher') {
        for(const [n,tokens] of [['04',['0<r\\le\\frac25','r>\\frac25','29+25r+\\frac4r']],
                                 ['05',['2<b\\le4','b>4','b=4','x=4']]]) {
          const tex=(await page.locator(`#q${n} annotation[encoding="application/x-tex"]`).allTextContents())
            .join(' ').replace(/\s+/g,'').replaceAll('\\dfrac','\\frac');
          for(const token of tokens) assert.ok(tex.includes(token),`missing rendered boundary: ${n} ${token}`);
        }
        assert.match(await page.locator('#q05 .solution').innerText(),/没有最小值/);
        assert.match(await page.locator('#q05 .solution').innerText(),/下确界/);
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      if(process.env.SCREENSHOT_DIR && edition==='teacher') {
        await fs.mkdir(process.env.SCREENSHOT_DIR,{recursive:true});
        await page.locator('#q04').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`${base.startsWith('file:')?'local':'online'}-${width}-q04.png`)});
      }
      console.log(`${base.startsWith('file:')?'local':'online'} ${width} ${edition}: five questions, paired links, formulas and isolation passed`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
