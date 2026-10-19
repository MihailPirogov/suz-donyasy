// Preview staged site pages: serves site_stage/out, other assets proxied from the live site (read-only GET).
const { chromium } = require('playwright-core'); const path = require('path'), fs = require('fs');
const OUT = path.resolve(__dirname, '../site_stage/out'), SH = path.resolve(__dirname, '../site_stage/preview');
fs.mkdirSync(SH, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const [vp, tag] of [[{ width: 1366, height: 900 }, 'desktop'], [{ width: 390, height: 844 }, 'mobile']]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: tag === 'mobile' ? 2 : 1 });
    await ctx.route('https://pirogovlab.ru/**', async r => { const u = new URL(r.request().url()); let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(OUT, p); if (fs.existsSync(f)) return r.fulfill({ path: f }); return r.continue(); });
    await ctx.route('https://mc.yandex.ru/**', r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    for (const [u, n] of [['suz-donyasy-igra/', 'landing'], ['en/suz-donyasy-igra/', 'landing_en'], ['blog/2026-10-19-suz-donyasy/', 'blog'], ['', 'home'], ['blog/', 'blogindex']]) {
      await p.goto('https://pirogovlab.ru/' + u, { waitUntil: 'networkidle' });
      if (n === 'landing' && tag === 'desktop') { const bx = await p.locator('.tilt').boundingBox(); await p.mouse.move(bx.x + bx.width * .85, bx.y + bx.height * .2); await p.waitForTimeout(400);
        await p.screenshot({ path: `${SH}/${n}_${tag}_tilt.png` }); await p.mouse.move(5, 5); await p.waitForTimeout(600); }
      await p.screenshot({ path: `${SH}/${n}_${tag}.png`, fullPage: n !== 'home' && n !== 'blogindex' });
    }
    console.log(tag, 'errors', errs.length ? errs : 'none'); await ctx.close();
  }
  await b.close();
})();
