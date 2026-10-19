// Regression: swiping a word through the *other* copy of a duplicated wheel letter must work (touch, normal play + tutorial).
const { chromium } = require('playwright-core'); const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROOT = process.env.URL || ('file://' + (process.env.ROOT || path.resolve(__dirname, '..')) + '/index.html');
const perms = (word, L) => { const out = []; const rec = (k, used, acc) => { if (k === word.length) return out.push(acc.slice()); for (let j = 0; j < L.length; j++) if (!used.has(j) && L[j] === word[k]) { used.add(j); acc.push(j); rec(k + 1, used, acc); acc.pop(); used.delete(j); } }; rec(0, new Set(), []); return out; };
// first-copy order = what the old code / finger hint used; we want any order that uses a non-first copy
const firstCopy = (w, L) => { const used = new Set(); return Array.from(w).map(c => { const j = L.findIndex((x, k) => x === c && !used.has(k)); used.add(j); return j; }); };
let fails = 0; const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page); const errs = []; page.on('pageerror', e => errs.push(e.message));
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const xyOf = () => page.evaluate(() => suzDonyasy.game.letterEls.map(e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
  async function swipe(ord) { const xy = await xyOf(); await touch('touchStart', ...xy[ord[0]]);
    for (let k = 1; k < ord.length; k++) { const [x0, y0] = xy[ord[k - 1]], [x1, y1] = xy[ord[k]]; for (let t = 1; t <= 8; t++) await touch('touchMove', x0 + (x1 - x0) * t / 8, y0 + (y1 - y0) * t / 8); await sleep(15); }
    const typed = await page.evaluate(() => document.getElementById('word').textContent); await touch('touchEnd'); await sleep(250); return typed; }
  const open = async (id, tut) => { await page.evaluate(([i, tut]) => { const s = suzDonyasy.state; s.cur = null; if (tut) s.tut = { done: false, step: tut }; suzDonyasy.state = s; suzDonyasy.startGame('main', i); }, [id, tut]); await sleep(900); };
  await page.goto(ROOT); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(800);
  await page.evaluate(() => suzDonyasy.tutSkip());
  // Fixed case: level 416 'саанне', word 'асанне' starting from the 2nd «а» (chord с→1st «а» runs next to the already used 2nd «а»)
  const L416 = await page.evaluate(() => { const D = window.TT_DATA; return D.levels.findIndex(lv => lv.w.some(x => new Set(x[0]).size < x[0].length)); }); await open(L416);
  const info = await page.evaluate(() => ({ L: suzDonyasy.game.letters, w: suzDonyasy.game.lv.w.map(x => x[0]) }));
  const cases = [];
  for (const w of info.w.filter(w => new Set(w).size < w.length)) { const f = firstCopy(w, info.L).join(); for (const o of perms(w, info.L)) if (o.join() !== f) { cases.push([w, o]); break; } }
  check(cases.length > 0, `level ${L416 + 1} [${info.L.join('')}] has duplicate-letter words: ${cases.map(c => c[0]).join(', ')}`);
  for (const [w, o] of cases) { await page.evaluate(() => suzDonyasy.game.found.clear());
    const typed = await swipe(o); const ok = await page.evaluate(w => suzDonyasy.game.found.has(w), w);
    check(ok, `normal play: ${w} via other copy ${JSON.stringify(o)} (typed "${typed}")`); await page.evaluate(() => suzDonyasy.closeModal()); }
  // Normal swipe (first-copy order) and backtrack by finger
  { const w = info.w[0], o = firstCopy(w, info.L); await page.evaluate(() => suzDonyasy.game.found.clear()); const typed = await swipe(o);
    check(await page.evaluate(w => suzDonyasy.game.found.has(w), w), `normal swipe: ${w} ${JSON.stringify(o)} (typed "${typed}")`); await page.evaluate(() => suzDonyasy.closeModal());
    const xy = await xyOf(); const [p, q, r] = [0, 1, 2]; const mv = async (a, b2) => { for (let t = 1; t <= 8; t++) await touch('touchMove', a[0] + (b2[0] - a[0]) * t / 8, a[1] + (b2[1] - a[1]) * t / 8); await sleep(15); };
    await touch('touchStart', ...xy[p]); await mv(xy[p], xy[q]); await mv(xy[q], xy[r]); const t3 = await page.evaluate(() => suzDonyasy.game.sel.length);
    await mv(xy[r], xy[q]); const t2 = await page.evaluate(() => suzDonyasy.game.sel.slice()); await touch('touchEnd'); await sleep(250);
    check(t3 === 3 && t2.length === 2 && t2[1] === q, `backtrack: 3 letters → back to 2nd → sel ${JSON.stringify(t2)}`); }
  // Explicit chord past the used copy: асанне = [1,0,2,...]
  { const o = [1, 0, 2, 3, 4, 5].map(i => i); const w = o.map(i => info.L[i]).join('');
    if (info.w.includes(w)) { await page.evaluate(() => suzDonyasy.game.found.clear()); const typed = await swipe(o);
      check(await page.evaluate(w => suzDonyasy.game.found.has(w), w), `normal play: ${w} order ${JSON.stringify(o)} (typed "${typed}")`); await page.evaluate(() => suzDonyasy.closeModal()); } }
  // Tutorial: 'swipe' step must accept a word swiped through the non-hinted copy and advance to 'grid'
  await open(L416, 1); await page.evaluate(() => suzDonyasy.game.found.clear()); await sleep(500);
  const before = await page.evaluate(() => suzDonyasy.tutStep);
  if (before === 'swipe') { const [w, o] = cases[0]; const typed = await swipe(o); await sleep(1300);
    const after = await page.evaluate(() => suzDonyasy.tutStep); const ok = await page.evaluate(w => suzDonyasy.game.found.has(w), w);
    check(ok && after === 'grid', `tutorial: ${w} via other copy ${JSON.stringify(o)} typed "${typed}" → step ${before}→${after}`);
  } else check(false, `tutorial did not reach swipe step (at ${before})`);
  check(errs.length === 0, 'no JS errors ' + errs.slice(0, 2).join(' | '));
  console.log(fails ? `DUP TEST FAILED (${fails})` : 'DUP TEST PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})();
