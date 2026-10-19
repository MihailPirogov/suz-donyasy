// Renders every background theme (phone + desktop) and the icon into screens/art/ + screens/backgrounds_sheet.jpg (via python)
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'), OUT = process.env.SHOTS || path.join(ROOT, 'screens/art');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.goto('file://' + path.join(ROOT, 'index.html')); await new Promise(r => setTimeout(r, 500));
  const themes = await p.evaluate(() => Art.themes);
  for (const [w, h, wide] of [[390, 844, 0], [1280, 720, 1]]) {
    await p.setViewportSize({ width: w, height: h });
    for (const t of themes) {
      await p.evaluate(([t, wd]) => { let d = document.getElementById('artv'); if (!d) { d = document.createElement('div'); d.id = 'artv'; d.style.cssText = 'position:fixed;inset:0;z-index:99999;background-size:cover;background-position:center'; document.body.appendChild(d); } d.style.backgroundImage = Art.bg(t, 5, wd); }, [t, wide]);
      await new Promise(r => setTimeout(r, 150));
      await p.screenshot({ path: path.join(OUT, `bg_${t}${wide ? '_wide' : ''}.png`) });
    }
  }
  await p.setViewportSize({ width: 512, height: 512 });
  await p.goto('file://' + path.join(ROOT, 'img/icon.svg')); await p.screenshot({ path: path.join(ROOT, 'img/icon.png'), omitBackground: true });
  console.log('themes', themes.join(',')); await b.close();
})();
