// Small screens with Android sticky banner (native view below WebView => WebView height shrinks by banner).
// Checks: grid inside #gridWrap, preview pill not overlapping grid, wheel fully on screen, no overlap preview/wheel.
const { chromium } = require('playwright-core'); const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const OUT = process.argv[2] || '/workspace/tatar-wow/shots/small';
require('fs').mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  for (const [w, h] of [[320, 568], [360, 640], [360, 720], [390, 844]]) for (const ban of [0, 50, 60]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h - ban }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + path.resolve(__dirname, '../index.html')); await sleep(700);
    await page.evaluate(() => suzDonyasy.tutSkip()).catch(() => {});
    let worst = null;
    for (const lvl of [5, 60, 200, 400]) {
      const ok = await page.evaluate(l => { try { const s = suzDonyasy.state; s.tut = { done: true }; s.cur = null; suzDonyasy.state = s; suzDonyasy.startGame('main', l); return true; } catch (e) { return false; } }, lvl);
      if (!ok) continue; await sleep(700);
      await page.evaluate(() => { const p = document.querySelector('#preview span'); if (p) p.textContent = 'СҮЗЛӘР'; });
      const m = await page.evaluate(() => { const R = id => document.getElementById(id).getBoundingClientRect(); const g = R('grid'), gw = R('gridWrap'), p = document.querySelector('#preview span').getBoundingClientRect(), wh = R('wheel');
        const top = document.elementFromPoint(p.left + p.width / 2, p.top + p.height / 2);
        return { rc: suzDonyasy.game.lv.r + 'x' + suzDonyasy.game.lv.c, gridOver: Math.round(g.bottom - p.top), gridOut: Math.round(Math.max(gw.top - g.top, g.bottom - gw.bottom)), wheelOut: Math.round(wh.bottom - innerHeight), pillTop: !!(top && top.closest('#preview')) }; });
      const bad = m.gridOver > 0 || m.gridOut > 1 || m.wheelOut > 0 || !m.pillTop;
      if (!worst || bad) worst = { lvl, ...m, bad };
      if (bad) break;
    }
    await page.screenshot({ path: `${OUT}/${w}x${h}_b${ban}.png` });
    check(!worst.bad && !errs.length, `${w}x${h} banner ${ban}: ${JSON.stringify(worst)} ${errs.join('|')}`);
    await ctx.close();
  }
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
