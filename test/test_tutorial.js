// Interactive first-launch tutorial: full flow with real input, portrait + landscape, no ads before it ends.
// Usage: cd test && node test_tutorial.js   (URL=… to run against the deployed test site)
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'), SHOTS = process.env.SHOTS || path.join(ROOT, 'shots/tutorial');
const base = process.env.URL || ('file://' + path.join(ROOT, 'index.html'));
const url = base + (base.includes('?') ? '&' : '?') + 'adsim=1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

async function letterPts(page, w) {
  return page.evaluate(w => { const g = suzDonyasy.game, used = new Set(), out = [];
    for (const ch of Array.from(w)) { const i = g.letterEls.findIndex((e, j) => !used.has(j) && g.letters[j] === ch); used.add(i); const r = g.letterEls[i].getBoundingClientRect(); out.push([r.left + r.width / 2, r.top + r.height / 2]); }
    return out; }, w);
}
async function swipe(page, w) {
  const pts = await letterPts(page, w);
  await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p[0], p[1], { steps: 8 });
  await page.mouse.up();
}
// geometry checks for the current step: bubble inside viewport, not covering the spotlight
async function geo(page) {
  return page.evaluate(() => { const t = document.querySelector('#tut .tutTip').getBoundingClientRect(), h = document.querySelector('#tut .tutHole');
    const hr = h.hidden ? null : h.getBoundingClientRect(); const W = innerWidth, H = innerHeight;
    const inside = t.left >= 0 && t.top >= 0 && t.right <= W + 1 && t.bottom <= H + 1;
    const overlap = hr ? Math.max(0, Math.min(t.right, hr.right) - Math.max(t.left, hr.left)) * Math.max(0, Math.min(t.bottom, hr.bottom) - Math.max(t.top, hr.top)) : 0;
    return { inside, overlap: hr ? overlap / ((hr.width * hr.height) || 1) : 0, step: document.getElementById('tut').dataset.step }; });
}
const step = page => page.evaluate(() => suzDonyasy.tutStep);
const visible = page => page.evaluate(() => suzDonyasy.tutVisible());
async function waitStep(page, id, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await step(page) === id && await visible(page) && await page.evaluate(i => document.getElementById('tut').dataset.step === i, id)) { await sleep(400); return true; } await sleep(100); } return false; }

async function run(browser, tag, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = n => page.screenshot({ path: path.join(SHOTS, `${tag}_${n}.png`) });
  const adlog = () => page.evaluate(() => window.__adsim.slice());
  const chkGeo = async n => { const g = await geo(page); ok(g.inside && g.overlap < 0.05, `${tag}: bubble placed well on «${g.step}» ${JSON.stringify(g)}`); await shot(n); };
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(1200);

  ok(await waitStep(page, 'play'), tag + ': tutorial starts on first launch (home → «Играть»)');
  await chkGeo('01_play');
  ok(/Пропустить/.test(await page.textContent('#tutSkip')) && await page.isHidden('#tutNext'), tag + ': «Пропустить», no «Дальше» on an action step');
  // blocked outside the spotlight
  const blocked = await page.evaluate(() => { const r = document.getElementById('tMap').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && !!e.closest('#tut'); });
  ok(blocked, tag + ': taps outside the spotlight are blocked');
  await page.click('#hPlay'); await sleep(300);
  ok(await waitStep(page, 'swipe'), tag + ': game opened → swipe step');
  await sleep(1400); await chkGeo('02_swipe');
  const fing = await page.evaluate(() => { const f = document.querySelector('#tut .tutFinger'); return !f.hidden && f.getAnimations().length > 0 && !!document.querySelector('#tut .tutPath path').getAttribute('d'); });
  ok(fing, tag + ': animated finger path over the real letters');
  const backBlocked = await page.evaluate(() => { const r = document.getElementById('gBack').getBoundingClientRect(); const e = document.elementFromPoint(r.left + 10, r.top + 10); return e && e.classList.contains('tutB'); });
  ok(backBlocked, tag + ': other controls blocked during the swipe step');
  // a wrong swipe does not advance
  const lv = await page.evaluate(() => suzDonyasy.game.lv);
  await page.evaluate(() => suzDonyasy.submit('ъъъ', [])); await sleep(300); ok(await step(page) === 'swipe', tag + ': wrong word keeps the swipe step');
  const target = lv.w.slice().sort((a, b) => a[0].length - b[0].length)[0][0];
  await swipe(page, target); await sleep(200);
  ok(await page.evaluate(w => suzDonyasy.game.found.has(w), target), tag + ': player swiped «' + target + '»');
  ok(await waitStep(page, 'grid'), tag + ': → grid step (word in the crossword)');
  await sleep(500); await chkGeo('03_grid');
  ok(await page.isVisible('#tutNext'), tag + ': «Дальше» on an info step');
  const holeBlocked = await page.evaluate(() => { const r = document.querySelector('#tut .tutHole').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && e.classList.contains('tutB'); });
  ok(holeBlocked, tag + ': info step spotlight is not clickable');
  await page.click('#tutNext'); ok(await waitStep(page, 'shuffle'), tag + ': → shuffle'); await chkGeo('04_shuffle');
  const order0 = await page.evaluate(() => suzDonyasy.game.letters.join(''));
  await page.click('#bShuffle'); ok(await waitStep(page, 'hint'), tag + ': shuffle tapped → hint'); await chkGeo('05_hint');
  const s0 = await page.evaluate(() => suzDonyasy.state.freeHints), h0 = await page.$$eval('#grid .hint', a => a.length);
  await page.click('#bHint'); await sleep(200);
  ok(await page.evaluate(() => suzDonyasy.state.freeHints) === s0 - 1 && (await page.$$eval('#grid .hint, #grid .found', a => a.length)) > h0, tag + ': free hint opened a letter');
  ok(await waitStep(page, 'coins'), tag + ': → coins'); await chkGeo('06_coins'); await page.click('#tutNext');
  ok(await waitStep(page, 'ad'), tag + ': → 🎬 ad hint'); await chkGeo('07_ad'); await page.click('#tutNext');
  ok(await waitStep(page, 'bonus'), tag + ': → bonus words'); await chkGeo('08_bonus'); await page.click('#tutNext');
  ok(await waitStep(page, 'card'), tag + ': → word card'); await chkGeo('09_card');
  const cell = await page.evaluate(() => { const r = document.querySelector('#tut .tutHole').getBoundingClientRect(); return [r.left + 14, r.top + r.height / 2]; });
  await page.mouse.click(cell[0], cell[1]); await page.waitForSelector('#cardModal:not([hidden])', { timeout: 4000 }).catch(() => {});
  ok(await page.isVisible('#cardModal') && !(await visible(page)), tag + ': tapping the found word opens its card (overlay hides)');
  await sleep(500); await shot('10_card_open');
  await page.click('#cardSheet [data-cclose]'); ok(await waitStep(page, 'free'), tag + ': card closed → «find the rest»'); await chkGeo('11_free');
  await page.click('#tutNext'); await sleep(300); ok(!(await visible(page)) && await step(page) === 'wait', tag + ': overlay gone, player finishes alone');
  let L = await adlog(); ok(!L.length, tag + ': no ads during the game part of the tutorial ' + JSON.stringify(L));
  for (const x of lv.w) await page.evaluate(w => suzDonyasy.submit(w, []), x[0]);
  await page.waitForSelector('#wNext', { timeout: 6000 }); await sleep(800);
  ok(!(await page.isVisible('#wDouble')), tag + ': no rewarded «double coins» offer during the tutorial');
  await page.click('#wNext'); await sleep(400);
  ok(await waitStep(page, 'map') && await page.isVisible('#scrHome'), tag + ': after level 1 → home, map step');
  await chkGeo('12_map');
  for (const id of ['daily', 'spin', 'rewards', 'end']) { await page.click('#tutNext'); ok(await waitStep(page, id), tag + ': → ' + id); await chkGeo('13_' + id); }
  L = await adlog(); ok(!L.length, tag + ': still no ads (no banner, no fullscreen) before the tutorial ends');
  await page.click('#hPlay'); await sleep(600);
  ok(await page.evaluate(() => suzDonyasy.state.tut.done) && !(await visible(page)), tag + ': tutorial done after the last step');
  ok(await page.isVisible('#scrGame') && await page.evaluate(() => suzDonyasy.game.id) === 1, tag + ': level 2 starts');
  L = await adlog(); ok(L.includes('banner+'), tag + ': banner allowed once the tutorial is done ' + JSON.stringify(L));
  await page.reload(); await sleep(1000); ok(!(await visible(page)) && await step(page) === null, tag + ': shown once (persists across reload)');
  // replay from settings
  await page.click('#hSettings'); await sleep(300); ok(await page.isVisible('#sHowTo'), tag + ': «Как играть» in settings');
  await page.click('#sHowTo'); ok(await waitStep(page, 'play'), tag + ': replay starts at step 1');
  L = await adlog(); ok(L[L.length - 1] === 'banner-', tag + ': banner hidden while the tutorial replays');
  await page.click('#tutSkip'); await sleep(200);
  ok(await page.evaluate(() => suzDonyasy.state.tut.done) && !(await visible(page)), tag + ': «Пропустить» ends it');
  ok(!errors.length, tag + ': no JS errors ' + errors.join(' | '));
  await ctx.close();
}
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await run(browser, 'portrait', { width: 390, height: 844 });
  await run(browser, 'landscape', { width: 844, height: 390 });
  await run(browser, 'small', { width: 320, height: 568 });
  // skip on the very first step + existing players are not forced into it
  { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(900);
    await p.click('#tutSkip'); await sleep(200); ok(await p.evaluate(() => suzDonyasy.state.tut.done), 'skip on step 1');
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('suzDonyasy.v1')); delete s.tut; s.level = 12; localStorage.setItem('suzDonyasy.v1', JSON.stringify(s)); }); await p.reload(); await sleep(900);
    ok(await p.evaluate(() => suzDonyasy.state.tut.done && !suzDonyasy.tutVisible()), 'old save with progress: no forced tutorial');
    await ctx.close(); }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
