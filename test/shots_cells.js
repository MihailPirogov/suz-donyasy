// Readability check: partially solved levels on bright/dark photo backgrounds. Serve project on :8765 first. node shots_cells.js [tag]
const { chromium } = require('playwright-core'); const path = require('path');
const OUT = path.join(path.resolve(__dirname, '..'), 'screens'); const url = process.env.URL || 'http://localhost:8765/index.html'; const tag = process.argv[2] || 'cells';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800); await p.click('#tutSkip'); await sleep(300);
  for (const n of [18, 5, 23, 41, 13, 26]) {
    const st = await p.evaluate(n => suzDonyasy.data.chapters[n - 1].start, n);
    await p.evaluate(i => suzDonyasy.startGame('main', i), st + 2); await sleep(1600);
    const info = await p.evaluate(() => { const w = suzDonyasy.game.lv.w; const k = Math.max(1, Math.floor(w.length / 2)); for (const x of w.slice(0, k)) suzDonyasy.submit(Array.isArray(x) ? x[0] : String(x).split(',')[0]); return { words: w.length, solved: k, letters: suzDonyasy.game.lv.l || '' }; });
    await sleep(900);
    // reveal one hint cell via the hint button if present
    await p.click('#bHint').catch(() => {}); await sleep(700);
    // show a preview word state (simulate typing the first unsolved word's letters)
    await p.evaluate(() => { const pv = document.getElementById('word'); if (pv) pv.className = ''; const w = suzDonyasy.game.lv.w; if (pv) { const x = w[w.length - 1]; pv.textContent = Array.isArray(x) ? x[0] : String(x).split(',')[0]; } });
    await sleep(200);
    const f = tag + '_ch' + String(n).padStart(2, '0') + '.png'; await p.screenshot({ path: path.join(OUT, f) }); console.log(f, JSON.stringify(info));
  }
  await b.close();
})();
