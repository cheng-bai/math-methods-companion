'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const root = path.resolve(__dirname, '..');
  const links = JSON.parse(await fs.readFile(path.join(root, 'content/example-links.json'), 'utf8'));
  const base = process.env.PUBLIC_BASE_URL || pathToFileURL(path.join(root, 'dist/')).href;
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || undefined});
  const results = [];
  try {
    for (const width of [1100, 390]) {
      const page = await browser.newPage({viewport: {width, height: 950}});
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await page.goto(new URL('knowledge.html', base).href);
      assert.equal(await page.locator('.knowledge-examples').count(), 2);
      assert.equal(await page.locator('.knowledge-examples li').count(), 7);
      assert.equal(await page.evaluate(() => typeof window.katex), 'undefined');
      for (const row of links) {
        for (const edition of ['teacher', 'student']) {
          await page.goto(new URL(`knowledge.html#${row.card_id}`, base).href);
          const card = page.locator(`#${row.card_id}`);
          await page.waitForFunction(id => document.getElementById(id).open, row.card_id);
          const route = `chapters/DEMO-01-${edition}.html#${row.question_id.toLowerCase()}`;
          await card.locator(`.knowledge-examples a[href="${route}"]`).click();
          await page.waitForURL(url => url.href.endsWith(route));
          const question = page.locator(`#${row.question_id.toLowerCase()}`);
          await question.waitFor({state: 'visible'});
          assert.equal(await question.locator('.question-knowledge').count(), 1);
          if (edition === 'student') assert.equal(await page.locator('.solution').count(), 0);
          await question.locator(`.question-knowledge a[href="../knowledge.html#${row.card_id}"]`).click();
          await page.waitForFunction(id => document.getElementById(id)?.open, row.card_id);
          await page.waitForFunction(id => !!document.querySelector(`#${id} .katex`), row.card_id);
          assert.equal(await page.locator('.math-error').count(), 0);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        }
      }
      if (process.env.SCREENSHOT_DIR) {
        await fs.mkdir(process.env.SCREENSHOT_DIR, {recursive: true});
        await page.goto(new URL('knowledge.html#k-3b22fa72', base).href);
        await page.waitForFunction(() => !!document.querySelector('#k-3b22fa72 .katex'));
        await page.locator('#k-3b22fa72 .knowledge-examples').scrollIntoViewIfNeeded();
        await page.screenshot({path: path.join(process.env.SCREENSHOT_DIR, `knowledge-examples-${width}.png`)});
      }
      assert.deepEqual(errors, []);
      results.push({width, roundTrips: links.length * 2, mathErrors: 0, pageOverflow: false});
      await page.close();
    }
    const plain = await browser.newPage({javaScriptEnabled: false, reducedMotion: 'reduce'});
    await plain.goto(new URL('knowledge.html', base).href);
    await plain.locator('#k-3b22fa72 > summary').click();
    await plain.locator('#k-3b22fa72 a[href="chapters/DEMO-01-student.html#q04"]').click();
    await plain.waitForURL(url => url.href.endsWith('DEMO-01-student.html#q04'));
    await plain.locator('#q04 .question-knowledge a[href="../knowledge.html#k-3b22fa72"]').click();
    await plain.waitForURL(url => url.href.endsWith('knowledge.html#k-3b22fa72'));
    if (await plain.locator('#k-3b22fa72').getAttribute('open') === null) await plain.locator('#k-3b22fa72 > summary').click();
    assert.equal(await plain.locator('#k-3b22fa72 .knowledge-examples').isVisible(), true);
    console.log(JSON.stringify({base, results, noJS: 'pass'}, null, 2));
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exit(1);});
