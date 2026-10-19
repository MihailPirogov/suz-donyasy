// Tests the Android www bundle in Chrome with a mocked window.AndroidBridge. Usage: node test_android_www.js
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, 'android/app/src/main/assets/www');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
  fs.readFile(path.join(DIR, u), (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(u)] || 'application/octet-stream' }); r.end(b); }); }).listen(8767);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { const L = window.__ab = [];
    window.AndroidBridge = { vibrate: ms => L.push('vibrate'), share: t => L.push('share'), shareImage: (b, f, t) => L.push('shareImage ' + b.length + ' ' + JSON.stringify(t)), openUrl: u => L.push('openUrl ' + u),
      rewardedAvailable: () => false, showRewarded: cb => setTimeout(() => window[cb](false), 10), interstitialAvailable: () => false, showInterstitial: cb => setTimeout(() => window[cb](), 10),
      bannerAvailable: () => false, showBanner: () => L.push('showBanner'), hideBanner: () => L.push('hideBanner') }; });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8767/index.html'); await sleep(1500);
  const i = await page.evaluate(() => ({ name: Platform.name, hooks: typeof window.suzDonyasy, badge: !!document.getElementById('testBadge'), share: Platform.shareUrl }));
  ok(i.name === 'android' && i.hooks === 'undefined' && !i.badge, 'android adapter, no hooks/badge ' + JSON.stringify(i));
  ok(await page.isVisible('#tut'), 'tutorial on first launch'); await page.click('#tutSkip'); await sleep(200);
  await page.click('#hPlay'); await sleep(1200);
  await page.click('#bAd'); await sleep(300); ok(await page.isHidden('#modal') && /Реклама/.test(await page.textContent('#toast')), '🎬 without ads: toast, no ad call');
  ok(await page.evaluate(() => window.__appBack()) === true && await page.isVisible('#scrHome'), 'back on game -> home');
  ok(await page.evaluate(() => window.__appBack()) === false, 'back on home -> exit app');
  await page.click('#hSettings'); await sleep(400);
  ok(await page.evaluate(() => window.__appBack()) === true && await page.isHidden('#modal'), 'back closes modal');
  // music unlock + suspend('app')
  await page.click('#hPlay'); await sleep(2500);
  await page.evaluate(() => Platform.audio.suspend('app')); ok(await page.evaluate(() => Music.paused), 'onPause -> music paused');
  await page.evaluate(() => Platform.audio.resume('app')); ok(await page.evaluate(() => !Music.paused), 'onResume -> music resumed');
  { const nt = await page.evaluate(() => (window.MUSIC_TRACKS || []).length), cur = await page.evaluate(() => Music.current); ok(nt ? cur !== null : cur === null, nt ? 'music track playing: ' + cur : 'no music tracks bundled -> none playing'); }
  // share a word card from the home "word of the day"
  await page.evaluate(() => window.__appBack()); await sleep(500);
  const wotd = await page.$('#tWotd'); if (wotd) { await wotd.click(); await sleep(800); }
  const sb = await page.$('[data-share], .share, #wShare, #cShare'); if (sb) { await sb.click(); await sleep(2500); }
  const L = await page.evaluate(() => window.__ab.slice()); console.log('  bridge:', L.map(x => x.slice(0, 90)).join(' | '));
  ok(L.some(x => x.startsWith('shareImage ') && +x.split(' ')[1] > 10000), 'word card PNG shared via native bridge');
  ok(L.some(x => /pirogovlab\.ru\/suz-donyasy/.test(x)), 'shared text has web link');
  // external link opens in system browser
  await page.evaluate(() => window.__appBack()); await page.click('#hBrand'); await sleep(300);
  ok((await page.evaluate(() => window.__ab.slice())).some(x => x.startsWith('openUrl https://pirogovlab.ru')), 'external link -> openUrl');
  { // native ads available (Yandex Mobile Ads loaded): banner after tutorial, rewarded hint, music paused during the ad
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await c2.addInitScript(() => { const L = window.__ab = [];
      window.AndroidBridge = { vibrate() {}, share() {}, shareImage() {}, openUrl() {},
        rewardedAvailable: () => true, showRewarded: cb => { L.push('showRewarded'); setTimeout(() => { L.push('musicPaused=' + Music.paused); window[cb](true); }, 300); },
        interstitialAvailable: () => true, showInterstitial: cb => { L.push('showInterstitial'); setTimeout(() => window[cb](), 50); },
        bannerAvailable: () => true, showBanner: () => L.push('showBanner'), hideBanner: () => L.push('hideBanner') }; });
    const p = await c2.newPage(); p.on('pageerror', e => errors.push('ads: ' + e.message));
    await p.goto('http://127.0.0.1:8767/index.html'); await sleep(1500);
    let B = await p.evaluate(() => window.__ab.slice()); ok(!B.includes('showBanner'), 'native banner not requested during the tutorial');
    await p.click('#tutSkip'); await sleep(200); B = await p.evaluate(() => window.__ab.slice()); ok(B.includes('showBanner'), 'native banner requested after the tutorial');
    await p.click('#hPlay'); await sleep(2500);
    const h0 = await p.$$eval('#grid .hint', a => a.length);
    await p.click('#bAd'); await sleep(300); await p.click('#adGo'); await sleep(900);
    B = await p.evaluate(() => window.__ab.slice());
    ok(B.includes('showRewarded') && B.includes('musicPaused=true') && (await p.$$eval('#grid .hint', a => a.length)) === h0 + 1, 'rewarded via native bridge: music paused, hint given');
    ok(await p.evaluate(() => !Music.paused), 'music resumes after the native ad');
    await c2.close(); }
  ok(!errors.length, 'no JS errors ' + errors.join('; '));
  await browser.close(); srv.close(); console.log(fails ? 'FAILED ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
