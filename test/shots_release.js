// Store screenshots WITHOUT ads (no banner, no ad dialogs), real gameplay scenes.
//   node shots_release.js            -> Yandex build: release/yandex_assets/screenshot_{mobile 1080x1920, desktop 1920x1080}_N_*.png
//   node shots_release.js play       -> Android www build: release/play_assets/screenshots/phone_N_*.png (1080x1920)
// Test hooks are re-enabled only for scene setup (RELEASE flag stripped in the served HTML).
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const PLAY = process.argv[2] === 'play';
const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, PLAY ? 'android/app/src/main/assets/www' : 'release/build/yandex');
const OUT = path.join(ROOT, PLAY ? 'release/play_assets/screenshots' : 'release/yandex_assets');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = u === '/sdk.js' ? path.join(__dirname, 'mock_yandex_sdk.js') : path.join(DIR, u);
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); }).listen(8766);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LEVEL = 151;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/^(screenshot_|phone_).*\.png$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const sets = PLAY ? [['phone', { width: 360, height: 640 }, 3]] : [['mobile', { width: 360, height: 640 }, 3], ['desktop', { width: 1280, height: 720 }, 1.5]];
  for (const [tag, vp, dpr] of sets) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr, reducedMotion: 'no-preference' });
    await ctx.route('**/index.html', async r => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace('window.RELEASE=true;', '') }); });
    await ctx.addInitScript(() => { window.__yaNoBanner = true; });
    if (PLAY) await ctx.addInitScript(() => { window.AndroidBridge = { vibrate() {}, share() {}, shareImage() {}, openUrl() {}, rewardedAvailable: () => false, showRewarded: cb => window[cb](false),
      interstitialAvailable: () => false, showInterstitial: cb => window[cb](), bannerAvailable: () => false, showBanner() {}, hideBanner() {} }; });
    const name = (n, s) => PLAY ? `phone_${n}_${s}.png` : `screenshot_${tag}_${n}_${s}.png`;
    const page = await ctx.newPage();
    const shot = async (n, s, wait = 900) => { await sleep(wait); await page.screenshot({ path: path.join(OUT, name(n, s)) }); console.log(tag, n, s); };
    const noAds = () => page.evaluate(() => !document.querySelector('.adSim,#adSimBanner') && (!window.__ya || !window.__ya.log.some(x => /Banner|Fullscreen|Rewarded/.test(x))));
    // 1) tutorial step on a fresh install: animated finger over the real letters (frozen mid-swipe)
    await page.goto('http://127.0.0.1:8766/index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(1500);
    await page.click('#hPlay'); await sleep(2200);
    await page.evaluate(() => { const f = document.querySelector('#tut .tutFinger'); f.getAnimations().forEach(a => { a.pause(); a.currentTime = a.effect.getTiming().duration * 0.55; }); });
    await shot(1, 'tutorial', 300);
    // progress for the other scenes
    await page.evaluate(L => { const s = suzDonyasy.state; s.tut = { done: true, step: 0 }; s.level = L; s.coins = 340; s.freeHints = 2;
      suzDonyasy.data.levels.slice(0, L).forEach(l => l.w.forEach(x => { const g = l.g[x[0]]; s.learned[x[0]] = { d: 0, g: g ? g[0].slice(0, 60) : '', s: g ? g[1] : '' }; }));
      s.streak = { last: suzDonyasy.dayKey(), count: 5, best: 5, claimed: suzDonyasy.dayKey(), cycle: 0 }; s.stats.words = 640; s.cur = null; suzDonyasy.state = s; }, LEVEL);
    await page.reload(); await sleep(1800);
    // 2) game: wheel with the ornament, crossword partly filled
    await page.click('#hPlay'); await sleep(1500);
    const ws = await page.evaluate(() => suzDonyasy.game.lv.w.map(x => x[0]));
    for (const w of ws.slice(0, Math.ceil(ws.length / 2))) { await page.evaluate(w => suzDonyasy.submit(w, []), w); await sleep(300); }
    await page.evaluate(() => { document.getElementById('toast').classList.remove('show'); }); await sleep(3500);
    await page.evaluate(() => document.getElementById('toast').classList.remove('show'));
    await shot(2, 'game', 600);
    // 3) word card (tap a found word)
    { // tap the cell of a found word with a rich, neutral card
      const w = await page.evaluate(async () => { const g = suzDonyasy.game, ok = []; for (const x of g.lv.w) { if (!g.found.has(x[0])) continue; const c = await suzDonyasy.withCard(x[0]);
        const txt = c ? JSON.stringify(c.m) : ''; if (c && !/вер[аы]|бог|молит|свящ|религ|церк/i.test(txt)) ok.push([x[0], txt.length]); } ok.sort((a, b) => b[1] - a[1]); return ok.length ? ok[0][0] : g.lv.w.find(x => g.found.has(x[0]))[0]; });
      const xy = await page.evaluate(w => { const g = suzDonyasy.game, x = g.lv.w.find(y => y[0] === w); const [r, c] = [x[1], x[2] + (x[3] === 'h' ? 1 : 0)]; const rr = (x[3] === 'h' ? [x[1], x[2] + Math.min(1, w.length - 1)] : [x[1] + Math.min(1, w.length - 1), x[2]]);
        const el = g.cells[rr[0] + ',' + rr[1]].el, b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, w);
      await page.evaluate(w => { suzDonyasy.game.lastFound = w; }, w);
      await page.mouse.click(xy[0], xy[1]); await page.waitForSelector('#cardModal:not([hidden])'); console.log('  card word', w); await shot(3, 'card', 1200); }
    await page.click('#cardSheet [data-cclose]'); await sleep(300);
    // 4) map
    await page.evaluate(() => suzDonyasy.openMap()); await sleep(1500); await shot(4, 'map', 600);
    // 5) daily puzzle in progress
    await page.evaluate(() => { suzDonyasy.goHome(); suzDonyasy.startGame('daily', suzDonyasy.dailyIndex()); }); await sleep(1500);
    const dw = await page.evaluate(() => suzDonyasy.game.lv.w.map(x => x[0]));
    for (const w of dw.slice(0, Math.max(1, Math.floor(dw.length / 2)))) { await page.evaluate(w => suzDonyasy.submit(w, []), w); await sleep(300); }
    await sleep(3500); await page.evaluate(() => document.getElementById('toast').classList.remove('show')); await shot(5, 'daily', 600);
    // 6) fortune wheel with a prize
    await page.evaluate(() => { const s = suzDonyasy.state; s.spin = { last: null, adDay: null, adN: 0 }; suzDonyasy.state = s; suzDonyasy.goHome(); }); await sleep(800);
    await page.evaluate(() => suzDonyasy.openSpin()); await sleep(600); await page.click('#spBtn'); await sleep(7000); await page.evaluate(() => { const b = document.getElementById('spAd'); if (b) b.remove(); }); await shot(6, 'spin', 200);
    await page.evaluate(() => suzDonyasy.closeModal());
    // 7) home
    await page.evaluate(() => { const s = suzDonyasy.state; s.spin.last = null; suzDonyasy.state = s; suzDonyasy.renderHome(); }); await sleep(400); await shot(7, 'home', 1200);
    if (!(await noAds())) { console.error('ads appeared in screenshots!'); process.exit(1); }
    await ctx.close();
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
