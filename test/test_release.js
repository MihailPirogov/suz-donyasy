// Tests the Yandex release build with a mocked SDK. Usage: node test_release.js
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, 'release/build/yandex'), SHOTS = path.join(ROOT, 'release/test_shots');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = u === '/sdk.js' ? path.join(__dirname, 'mock_yandex_sdk.js') : path.join(DIR, u);
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
}).listen(8765);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push('http ' + r.status() + ' ' + r.url()); });
  const log = () => page.evaluate(() => window.__ya.log.slice());
  await page.goto('http://127.0.0.1:8765/'); await sleep(1500);
  const info = await page.evaluate(() => ({ hooks: typeof window.suzDonyasy, name: Platform.name, links: Platform.links, share: Platform.shareUrl, badge: !!document.getElementById('testBadge'),
    robots: !!document.querySelector('meta[name=robots]'), href: document.getElementById('hBrand').getAttribute('href'), brand: document.getElementById('hBrand').textContent, extLinks: document.querySelectorAll('a[href^="http"]').length }));
  console.log('  ', JSON.stringify(info));
  ok(info.hooks === 'undefined', 'no test hooks (window.suzDonyasy)'); ok(info.name === 'yandex', 'yandex adapter selected');
  ok(!info.badge && !info.robots, 'no test badge / noindex'); ok(!info.href && info.extLinks === 0 && !/\./.test(info.brand), 'no external links on home (' + info.brand + ')');
  let L = await log(); ok(L.filter(x => x === 'LoadingAPI.ready').length === 1 && L.indexOf('YaGames.init') < L.indexOf('LoadingAPI.ready'), 'init -> LoadingAPI.ready once');
  ok(L.includes('on game_api_pause') && L.includes('getPlayer'), 'pause handlers + player');
  ok(!L.includes('GameplayAPI.start'), 'no gameplay on home');
  ok(await page.isVisible('#tut') && !L.includes('adv.showBannerAdv') && !L.includes('adv.showFullscreenAdv'), 'first launch: tutorial, no banner/fullscreen before it ends');
  await page.screenshot({ path: path.join(SHOTS, 'y_tutorial.png') });
  await page.click('#tutSkip'); await sleep(300); L = await log();
  ok(L.filter(x => x === 'adv.showBannerAdv').length === 1 && await page.isHidden('#tut'), 'tutorial skipped → sticky banner via API');
  await page.screenshot({ path: path.join(SHOTS, 'y_home.png') });
  // play
  await page.click('#hPlay'); await sleep(1000);
  L = await log(); ok(L[L.length - 1] === 'GameplayAPI.start', 'GameplayAPI.start on game screen');
  ok(await page.isVisible('#bAd'), '🎬 rewarded button visible');
  await page.screenshot({ path: path.join(SHOTS, 'y_game.png') });
  await page.click('#bAd'); await sleep(500);
  L = await log(); ok(L[L.length - 1] === 'GameplayAPI.stop', 'gameplay stop when confirm modal opens');
  ok(/реклам/i.test(await page.textContent('#sheet')), 'rewarded confirm explains ad + reward');
  await page.screenshot({ path: path.join(SHOTS, 'y_adconfirm.png') });
  const hints0 = await page.$$eval('#grid .hint', a => a.length);
  await page.click('#adGo'); await sleep(1200);
  const da = await page.evaluate(() => window.__ya.duringAd); L = await log();
  ok(L.includes('adv.showRewardedVideo'), 'showRewardedVideo called'); ok(da && da.musicPaused === true, 'music paused during rewarded ad');
  ok(await page.evaluate(() => !Music.paused), 'music resumed after ad');
  ok((await page.$$eval('#grid .hint', a => a.length)) === hints0 + 1, 'reward: one letter revealed');
  ok(L[L.length - 1] === 'GameplayAPI.start', 'gameplay restarted after ad');
  // game_api_pause from platform
  await page.evaluate(() => window.__ysdk._emit('game_api_pause')); ok(await page.evaluate(() => Music.paused), 'game_api_pause pauses audio');
  await page.evaluate(() => window.__ysdk._emit('game_api_resume')); ok(await page.evaluate(() => !Music.paused), 'game_api_resume resumes audio');
  await page.click('#gBack'); await sleep(600); L = await log(); ok(L[L.length - 1] === 'GameplayAPI.stop', 'GameplayAPI.stop on leaving game');
  await sleep(3500); L = await log(); ok(L.includes('player.setData'), 'cloud save via player.setData');
  // about/credits must have no links
  await page.click('#hSettings'); await sleep(400);
  ok(!(await page.$('[data-lang]')), 'no UI language switch');
  await page.click('#sHowTo'); await sleep(400); L = await log();
  ok(await page.isVisible('#tut') && L[L.length - 1] === 'adv.hideBannerAdv', '«Как играть» replays the tutorial and hides the banner');
  await page.click('#tutSkip'); await sleep(300); L = await log(); ok(L[L.length - 1] === 'adv.showBannerAdv', 'banner back after the replay');
  await page.click('#hSettings'); await sleep(400);
  const ab = await page.$('[data-about], #sAbout, .about-btn'); if (ab) { await ab.click(); await sleep(400); }
  ok((await page.$$eval('#sheet a[href]', a => a.length)) === 0, 'no links in settings/credits');
  if (ab) ok(/Политика конфиденциальности/.test(await page.textContent('#sheet')), 'credits mention privacy policy (no link)');
  await page.screenshot({ path: path.join(SHOTS, 'y_settings.png') });
  // interstitial cadence: debug build variant (hooks on) to win levels fast
  await page.close();  // its visibility-change save would overwrite p2's fresh localStorage
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p2 = await ctx2.newPage(); p2.on('pageerror', e => errors.push('p2 pageerror: ' + e.message));
  await p2.addInitScript(() => { const n = Date.now.bind(Date); window.__dt = 0; Date.now = () => n() + window.__dt; });
  await p2.route('**/index.html', async r => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace('window.RELEASE=true;', '') }); });
  await p2.goto('http://127.0.0.1:8765/index.html'); await p2.evaluate(() => localStorage.clear()); await p2.reload(); await sleep(1200);
  { // tutorial NOT finished: no fullscreen ads even after 200 s and 3 wins, no rewarded extras
    await p2.evaluate(() => { window.__dt = 200000; }); await p2.click('#hPlay'); await sleep(800);
    for (let i = 0; i < 3; i++) { const ws = await p2.evaluate(() => suzDonyasy.game.lv.w.map(x => x[0])); for (const w of ws) { await p2.evaluate(w => suzDonyasy.submit(w, []), w); await sleep(80); }
      await p2.waitForSelector('#wNext', { timeout: 5000 }); await sleep(500); if (i === 0) ok(!(await p2.isVisible('#wDouble')), 'no «double coins» offer during the tutorial'); await p2.click('#wNext'); await sleep(900);
      if (await p2.isVisible('#scrHome')) { await p2.evaluate(() => suzDonyasy.startGame('main', suzDonyasy.state.level)); await sleep(800); } }
    const L0 = await p2.evaluate(() => window.__ya.log.slice()); ok(!L0.includes('adv.showFullscreenAdv') && !L0.includes('adv.showBannerAdv'), 'no ads at all before the tutorial is finished');
    await p2.evaluate(() => { localStorage.clear(); window.__dt = 0; }); await p2.reload(); await sleep(1200); await p2.evaluate(() => { window.__ya.log.length = 0; }); }
  await p2.evaluate(() => suzDonyasy.tutSkip());
  const winLevel = async () => { const ws = await p2.evaluate(() => suzDonyasy.game.lv.w.map(x => x[0])); for (const w of ws) { await p2.evaluate(w => suzDonyasy.submit(w, []), w); await sleep(80); } await p2.waitForSelector('#wNext', { timeout: 5000 }); await sleep(500); await p2.click('#wNext'); await sleep(900); };
  await p2.click('#hPlay'); await sleep(800);
  for (let i = 0; i < 3; i++) await winLevel();
  let L2 = await p2.evaluate(() => window.__ya.log.slice()); ok(!L2.includes('adv.showFullscreenAdv'), 'no fullscreen ad before 150 s of play');
  await p2.evaluate(() => { window.__dt = 200000; });
  for (let i = 0; i < 3; i++) await winLevel();
  L2 = await p2.evaluate(() => window.__ya.log.slice()); const fs1 = await p2.evaluate(() => window.__ya.duringFs);
  ok(L2.filter(x => x === 'adv.showFullscreenAdv').length === 1, 'fullscreen ad between levels (every 3rd win, >=150 s)');
  ok(fs1 && fs1.musicPaused === true, 'music paused during fullscreen ad');
  { const gi = await p2.evaluate(() => [suzDonyasy.game.id, suzDonyasy.state.level, document.querySelector('.screen.on').id]); console.log('  after ad', JSON.stringify(gi)); ok(await p2.isVisible('#scrGame') && gi[0] === gi[1], 'next level starts after the ad'); }
  { // rewarded: double coins after a level
    const ws = await p2.evaluate(() => suzDonyasy.game.lv.w.map(x => x[0])); for (const w of ws) { await p2.evaluate(w => suzDonyasy.submit(w, []), w); await sleep(80); }
    await p2.waitForSelector('#wDouble', { timeout: 5000 }); await sleep(900);
    const c0 = await p2.evaluate(() => suzDonyasy.state.coins), rw = +(await p2.textContent('#wDouble')).match(/\+(\d+)/)[1];
    await p2.screenshot({ path: path.join(SHOTS, 'y_win_double.png') });
    await p2.click('#wDouble'); await sleep(1500);
    const c1 = await p2.evaluate(() => suzDonyasy.state.coins); const L3 = await p2.evaluate(() => window.__ya.log.slice());
    ok(L3[L3.length - 1] === 'adv.showRewardedVideo' || L3.includes('adv.showRewardedVideo'), 'double coins → rewarded video');
    ok(c1 === c0 + rw && await p2.isDisabled('#wDouble'), 'double coins credited once (+' + rw + ')');
    await p2.click('#wNext'); await sleep(900); }
  { // rewarded: extra fortune-wheel spin
    await p2.evaluate(() => { const s = suzDonyasy.state; s.spin.last = suzDonyasy.dayKey(); suzDonyasy.state = s; suzDonyasy.goHome(); suzDonyasy.openSpin(); }); await sleep(500);
    ok(await p2.isDisabled('#spBtn') && await p2.isVisible('#spAd'), 'daily spin used → «spin for an ad» offered');
    const sp0 = await p2.evaluate(() => suzDonyasy.state.stats.spins);
    await p2.click('#spAd'); await sleep(6500);
    const st2 = await p2.evaluate(() => suzDonyasy.state); ok(st2.stats.spins === sp0 + 1 && st2.spin.adN === 1 && await p2.isVisible('#spinPrize'), 'ad spin happened and was counted');
    await p2.screenshot({ path: path.join(SHOTS, 'y_spin_ad.png') });
    await p2.evaluate(() => { const s = suzDonyasy.state; s.spin.adN = 3; suzDonyasy.state = s; suzDonyasy.openSpin(); }); await sleep(400);
    ok(await p2.isHidden('#spAd'), 'max 3 ad spins per day'); await p2.evaluate(() => suzDonyasy.closeModal()); }
  console.log('  errors:', errors.length ? errors.join('\n  ') : 'none');
  ok(!errors.filter(e => !/favicon|404/.test(e)).length, 'no JS errors');
  await browser.close(); srv.close();
  console.log(fails ? `FAILED ${fails}` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
