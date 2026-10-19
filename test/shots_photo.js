// Fresh screenshots with photo backgrounds. Serve the project first: (cd .. && python3 -m http.server 8765) ; then node shots_photo.js
const { chromium } = require('playwright-core'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'screens'); const url = process.env.URL || 'http://localhost:8765/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  async function prep(vp, level) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: vp.width < 600 ? 2 : 1 }); const p = await ctx.newPage();
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
    await p.click('#tutSkip'); await sleep(200);
    await p.evaluate(l => { const s = JSON.parse(localStorage.getItem('suzDonyasy.v1')); s.level = l; s.coins = 340; localStorage.setItem('suzDonyasy.v1', JSON.stringify(s)); }, level);
    await p.reload(); await sleep(2000); return [ctx, p];
  }
  let [c, p] = await prep({ width: 390, height: 844 }, 140); await p.screenshot({ path: path.join(OUT, 'photo_home.png') }); console.log('photo_home.png');
  for (const n of [8, 21, 26, 38]) {
    const st = await p.evaluate(n => suzDonyasy.data.chapters[n - 1].start, n);
    await p.evaluate(i => suzDonyasy.startGame('main', i), st - 1); await sleep(2000);
    const f = 'photo_game_ch' + String(n).padStart(2, '0') + '.png'; await p.screenshot({ path: path.join(OUT, f) }); console.log(f);
  }
  await c.close();
  [c, p] = await prep({ width: 1280, height: 720 }, 340); await p.screenshot({ path: path.join(OUT, 'photo_desktop_home.png') });
  const st = await p.evaluate(() => suzDonyasy.data.chapters[17].start); await p.evaluate(i => suzDonyasy.startGame('main', i), st - 1); await sleep(2000);
  await p.screenshot({ path: path.join(OUT, 'photo_desktop_game_ch18.png') }); console.log('photo_desktop_*.png'); await c.close(); await b.close();
})();
