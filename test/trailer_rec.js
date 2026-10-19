// Records raw gameplay frames (CDP screencast) for the Yandex Games horizontal promo video.
// Output: /tmp/trailer/frames/*.jpg + frames.json (timestamps) + marks.json (scene markers)
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, 'release/build/yandex');
const OUT = '/tmp/trailer'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT + '/frames', { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = u === '/sdk.js' ? path.join(__dirname, 'mock_yandex_sdk.js') : path.join(DIR, u);
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); }).listen(8767);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LEVEL = +(process.env.LEVEL || 200);
(async () => {
  const XG = process.env.XGRAB; // ":99" -> headful Chrome on an Xvfb 1920x1080 screen at 1.5x (CSS 1280x720), captured by ffmpeg x11grab
  const browser = XG ? await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false, env: { ...process.env, DISPLAY: XG }, ignoreDefaultArgs: ['--enable-automation'],
      args: ['--no-sandbox', '--test-type', '--kiosk', '--force-device-scale-factor=1.5', '--window-position=0,0', '--window-size=1280,720', '--disable-features=Translate,TranslateUI', '--lang=ru', '--disable-infobars', '--noerrdialogs', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'] })
    : await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = XG ? await browser.newContext({ viewport: null, reducedMotion: 'no-preference' }) : await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, reducedMotion: 'no-preference' });
  await ctx.route('**/index.html', async r => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace('window.RELEASE=true;', '').replace('<head>', '<head><meta name="google" content="notranslate">') }); });
  await ctx.addInitScript(() => { window.__yaNoBanner = true;
    // touch indicator (finger dot) that follows the mouse while it is "on screen"
    addEventListener('DOMContentLoaded', () => { const d = document.createElement('div'); d.id = '__tdot';
      d.style.cssText = 'position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(255,255,255,.55);border:3px solid rgba(255,255,255,.95);box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;z-index:2147483647;opacity:0;transition:opacity .2s,transform .12s;';
      document.body.appendChild(d);
      addEventListener('pointermove', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
      addEventListener('pointerdown', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; d.style.transform = 'scale(.8)'; }, true);
      addEventListener('pointerup', () => { d.style.transform = 'none'; }, true);
      window.__dot = v => d.style.opacity = v ? 1 : 0; }); });
  const page = ctx.pages()[0] || await ctx.newPage(); if (XG) { for (const p of ctx.pages()) if (p !== page) await p.close(); }
  if (XG) { const bc = await browser.newBrowserCDPSession(); const pc = await ctx.newCDPSession(page); const { targetInfo } = await pc.send('Target.getTargetInfo');
    const { windowId } = await bc.send('Browser.getWindowForTarget', { targetId: targetInfo.targetId }); await bc.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } }); await sleep(800); }
  if (process.env.PROBE) { await page.goto('http://127.0.0.1:8767/index.html'); await sleep(2500); console.log(await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio])); await sleep(+process.env.PROBE); await browser.close(); srv.close(); return; }
  // progress state
  await page.goto('http://127.0.0.1:8767/index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(1200);
  await page.evaluate(L => { const s = suzDonyasy.state; s.tut = { done: true, step: 0 }; s.level = L; s.coins = 340; s.freeHints = 2;
    suzDonyasy.data.levels.slice(0, L).forEach(l => l.w.forEach(x => { const g = l.g[x[0]]; s.learned[x[0]] = { d: 0, g: g ? g[0].slice(0, 60) : '', s: g ? g[1] : '' }; }));
    s.streak = { last: suzDonyasy.dayKey(), count: 5, best: 5, claimed: suzDonyasy.dayKey(), cycle: 0 }; s.stats.words = 640; s.cur = null;
    s.spin = { last: null, adDay: null, adN: 0 }; suzDonyasy.state = s; }, LEVEL);
  await page.reload(); await sleep(2500);
  const cdp = await ctx.newCDPSession(page); const frames = []; let n = 0; const marks = [];
  let ff = null; if (XG) { ff = require('child_process').spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30', '-video_size', '1920x1080', '-i', XG + '.0+0,0',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '8', '-pix_fmt', 'yuv444p', OUT + '/xgrab.mkv'], { stdio: ['pipe', 'inherit', 'inherit'] }); await sleep(800); }
  cdp.on('Page.screencastFrame', async f => { const i = n++; fs.writeFileSync(`${OUT}/frames/${String(i).padStart(6, '0')}.jpg`, Buffer.from(f.data, 'base64'));
    frames.push([i, f.metadata.timestamp]); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (_) {} });
  const t0 = Date.now() / 1000; const mark = m => { marks.push([m, Date.now() / 1000]); console.log('mark', m, (Date.now() / 1000 - t0).toFixed(2)); };
  if (!XG) await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  // keep the compositor producing frames even on still screens
  await page.evaluate(() => { const k = document.createElement('div'); k.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;opacity:.01;pointer-events:none;z-index:2147483646'; document.body.appendChild(k);
    let t = 0; (function f() { k.style.transform = 'translateX(' + ((t++ % 2) * 0.5) + 'px)'; requestAnimationFrame(f); })(); });
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  let cur = [640, 600];
  const moveTo = async (x, y, ms, down) => { const steps = Math.max(6, Math.round(ms / 28)); const [sx, sy] = cur;
    for (let k = 1; k <= steps; k++) { const e = ease(k / steps); await page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e); await sleep(ms / steps); } cur = [x, y]; };
  const tap = async (x, y) => { await page.evaluate(() => __dot(1)); await moveTo(x, y, 380); await sleep(120); await page.mouse.down(); await sleep(110); await page.mouse.up(); await sleep(150); await page.evaluate(() => __dot(0)); };
  const letterXY = () => page.evaluate(() => suzDonyasy.game.letterEls.map(e => { const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }));
  const swipe = async w => { const L = await page.evaluate(() => suzDonyasy.game.letters); const xy = await letterXY(); const used = new Set(); const pts = [];
    for (const ch of w) { const i = L.findIndex((c, j) => !used.has(j) && c === ch); used.add(i); pts.push(xy[i]); }
    await page.evaluate(() => __dot(1)); await moveTo(pts[0][0], pts[0][1], 320); await sleep(80); await page.mouse.down(); await sleep(90);
    const wc = await page.evaluate(() => { const b = document.getElementById('wheel').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, b.width]; });
    const segD = (a, b, c) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(a[0] + t * dx - c[0], a[1] + t * dy - c[1]); };
    for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], p = pts[k];
      // route through the wheel centre if the straight line would brush another letter (that would select/deselect it)
      if (xy.some(c => c !== a && c !== p && segD(a, p, c) < wc[2] * 0.16)) { await moveTo(wc[0] + (a[0] + p[0] - 2 * wc[0]) * .15, wc[1] + (a[1] + p[1] - 2 * wc[1]) * .15, 150); await moveTo(p[0], p[1], 150); }
      else await moveTo(p[0] + (Math.random() - .5) * 6, p[1] + (Math.random() - .5) * 6, 170 + Math.random() * 50);
      await sleep(40); }
    await sleep(120); await page.mouse.up(); await sleep(60); await page.evaluate(() => __dot(0)); };
  // --- scene 1: home
  mark('home'); await sleep(2600);
  const pb = await page.evaluate(() => { const b = document.getElementById('hPlay').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  cur = [pb[0] + 200, pb[1] + 160]; await tap(pb[0], pb[1]);
  mark('game'); await sleep(1500);
  // --- scene 2: swipe words
  const words = await page.evaluate(() => suzDonyasy.game.lv.w.map(x => x[0]));
  console.log('words', words.join(' '));
  const want = (process.env.WORDS || 'йол,ола,шола,йолташ').split(','); let pick = want.filter(w => words.includes(w));
  if (pick.length < 3) pick = words.slice().sort((a, b) => a.length - b.length).slice(0, words.length - 2);
  cur = [900, 640];
  for (const w of pick) { await swipe(w); await sleep(450); }
  mark('swiped'); await sleep(1600); await page.evaluate(() => document.getElementById('toast').classList.remove('show'));
  // --- scene 3: word card (tap a found word cell)
  const cw = process.env.CARD && (await page.evaluate(w => suzDonyasy.game.found.has(w), process.env.CARD)) ? process.env.CARD : await page.evaluate(async () => { const g = suzDonyasy.game, ok = []; for (const x of g.lv.w) { if (!g.found.has(x[0])) continue; const c = await suzDonyasy.withCard(x[0]);
    const txt = c ? JSON.stringify(c.m) : ''; if (c && !/вер[аы]|бог|молит|свящ|религ|церк/i.test(txt)) ok.push([x[0], txt.length]); } ok.sort((a, b) => b[1] - a[1]); return ok.length ? ok[0][0] : [...g.found][0]; });
  const cxy = await page.evaluate(w => { const g = suzDonyasy.game, x = g.lv.w.find(y => y[0] === w); const rr = (x[3] === 'h' ? [x[1], x[2] + Math.min(1, w.length - 1)] : [x[1] + Math.min(1, w.length - 1), x[2]]);
    const b = g.cells[rr[0] + ',' + rr[1]].el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, cw);
  console.log('card word', cw); await page.evaluate(w => { suzDonyasy.game.lastFound = w; }, cw);
  await tap(cxy[0], cxy[1]); await page.waitForSelector('#cardModal:not([hidden])'); mark('card'); await sleep(3200);
  await page.click('#cardSheet [data-cclose]'); await sleep(400);
  // --- scene 4: map
  await page.evaluate(() => suzDonyasy.openMap()); mark('map'); await sleep(1400);
  await page.mouse.move(640, 400); await page.mouse.wheel(0, 500); await sleep(1600);
  // --- scene 5: daily puzzle
  await page.evaluate(() => { suzDonyasy.goHome(); suzDonyasy.startGame('daily', suzDonyasy.dailyIndex()); }); mark('daily'); await sleep(1300);
  const dw = await page.evaluate(() => suzDonyasy.game.lv.w.map(x => x[0]).sort((a, b) => b.length - a.length));
  console.log('daily words', dw.join(' ')); cur = [900, 640];
  await swipe(dw[Math.min(1, dw.length - 1)]); await sleep(700); await swipe(dw[0]); await sleep(1500);
  // --- scene 6: fortune wheel
  await page.evaluate(() => { suzDonyasy.goHome(); }); await sleep(300);
  await page.evaluate(() => suzDonyasy.openSpin()); mark('spin'); await sleep(700);
  const sb = await page.evaluate(() => { const b = document.getElementById('spBtn').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await page.evaluate(() => { const kill = () => { const b = document.getElementById('spAd'); if (b) b.remove(); }; new MutationObserver(kill).observe(document.body, { childList: true, subtree: true }); kill(); });
  cur = [sb[0] + 150, sb[1] + 120]; await tap(sb[0], sb[1]); await sleep(6500);
  await page.evaluate(() => { const b = document.getElementById('spAd'); if (b) b.remove(); }); await sleep(1500);
  // --- scene 7: home end
  await page.evaluate(() => { suzDonyasy.closeModal(); const s = suzDonyasy.state; s.spin.last = null; suzDonyasy.state = s; suzDonyasy.renderHome(); }); mark('end'); await sleep(3000);
  mark('stop');
  if (XG) { ff.stdin.write('q'); await new Promise(r => ff.on('exit', r)); } else await cdp.send('Page.stopScreencast'); await sleep(300);
  const noAds = await page.evaluate(() => !document.querySelector('.adSim,#adSimBanner') && (!window.__ya || !window.__ya.log.some(x => /Banner|Fullscreen|Rewarded/.test(x))));
  fs.writeFileSync(OUT + '/frames.json', JSON.stringify(frames)); fs.writeFileSync(OUT + '/marks.json', JSON.stringify(marks));
  console.log('frames', frames.length, 'noAds', noAds);
  await browser.close(); srv.close(); if (!noAds) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
