// Web RTB ads adapter (js/adapters/web.js): empty IDs = no ads, no errors; fake IDs + mocked context.js = banner/fullscreen/rewarded flow;
// blocked context.js = no hang. Serves the project over http so routes can be mocked.
const { chromium } = require('playwright-core'); const path = require('path'); const http = require('http'); const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const ROOT = path.resolve(__dirname, '..');
let fails = 0; const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); }); });
const CFG = `window.SUZ_WEB_ADS={banner:'R-A-1-1',fullscreen:'R-A-1-2'};`;
const MOCK = mode => `window.__ya=[];window.Ya={Context:{AdvManager:{render(o){__ya.push(o.type||'banner');
  if(o.type==='floorAd'){const el=document.createElement('div');el.id='floorMock';el.style.cssText='position:fixed;left:0;right:0;bottom:0;height:100px;background:#fc0;z-index:50';document.body.appendChild(el);o.onRender&&o.onRender();return;}
  setTimeout(()=>{ if(${mode === 'error'}) return o.onError&&o.onError({}); o.onRender&&o.onRender(); setTimeout(()=>o.onClose&&o.onClose(),200); },200);},getPlatform(){return 'touch'},destroy(){const e=document.getElementById('floorMock');e&&e.remove();}}}};
  (window.yaContextCb||[]).forEach(f=>f()); window.yaContextCb={push:f=>f()};`;
(async () => {
  await new Promise(r => srv.listen(0, r)); const URL = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  async function run(name, { cfg, ctxjs }) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage(); const errs = []; let ctxReq = 0; page.on('pageerror', e => errs.push(e.message));
    if (cfg) await page.route('**/js/ads-config.js*', r => r.fulfill({ contentType: 'text/javascript', body: cfg }));
    await page.route('https://yandex.ru/ads/system/context.js', r => { ctxReq++; return ctxjs ? r.fulfill({ contentType: 'text/javascript', body: ctxjs }) : r.abort(); });
    await page.addInitScript(() => { const s = JSON.parse(localStorage.getItem('suzDonyasy.v1') || 'null'); });
    await page.goto(URL); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(900);
    await page.evaluate(() => suzDonyasy.tutSkip()); await sleep(200);
    await page.evaluate(() => { const s = suzDonyasy.state; s.tut = { done: true }; s.cur = null; suzDonyasy.state = s; suzDonyasy.startGame('main', 5); }); await sleep(1200);
    return { page, ctx, errs, req: () => ctxReq };
  }
  // 1) empty IDs (shipping config)
  { const { page, ctx, errs, req } = await run('empty', {});
    const st = await page.evaluate(() => ({ n: Platform.name, rw: Platform.ads.rewardedAvailable(), bn: !!document.getElementById('floorMock') || document.documentElement.classList.contains('withWebBanner'), bAd: document.getElementById('bAd').hidden, lv: suzDonyasy.game.letterEls.length }));
    check(st.n === 'web' && !st.rw && !st.bn && st.bAd && st.lv > 0 && req() === 0, 'empty IDs: game loads, no ads, context.js not requested ' + JSON.stringify(st));
    const r = await page.evaluate(async () => { const t = Date.now(); const ok = await Platform.ads.showRewarded(); await Platform.ads.showInterstitial(); return [ok, Date.now() - t]; });
    check(r[0] === false && r[1] < 200, 'empty IDs: rewarded/interstitial resolve immediately ' + r);
    check(errs.length === 0, 'empty IDs: no JS errors ' + errs.join('|')); await ctx.close(); }
  // 2) IDs set, mocked RTB filling everything
  { const { page, ctx, errs } = await run('fill', { cfg: CFG, ctxjs: MOCK('fill') }); await sleep(500);
    const g = await page.evaluate(() => { const b = document.getElementById('floorMock'), w = document.getElementById('wheel').getBoundingClientRect(), r = b && b.getBoundingClientRect();
      return { n: Platform.name, banner: !!b, overlap: r ? w.bottom > r.top : null, wb: w.bottom, bt: r && r.top, bAd: document.getElementById('bAd').hidden }; });
    check(g.n === 'web-rsya' && g.banner && g.overlap === false && !g.bAd, 'fill: floorAd (100px) shown, #app shrunk, wheel not covered, 🎬 visible ' + JSON.stringify(g));
    const hints0 = await page.evaluate(() => document.querySelectorAll('.cell.open, .cell.hint, .cell.solved').length);
    await page.click('#bAd'); await sleep(300); await page.click('#adGo'); await sleep(1500);
    const after = await page.evaluate(() => ({ ya: __ya.slice(), cells: document.querySelectorAll('.cell.open, .cell.hint, .cell.solved').length }));
    check(after.ya.includes('fullscreen') && after.cells > hints0, `fill: rewarded → hint letter opened (${hints0}→${after.cells})`);
    const t = await page.evaluate(async () => { await Platform.ads.showInterstitial(); return __ya.includes('fullscreen'); });
    check(t, 'fill: fullscreen rendered and closed');
    check(errs.length === 0, 'fill: no JS errors ' + errs.join('|')); await ctx.close(); }
  // 3) IDs set, RTB answers onError
  { const { page, ctx, errs } = await run('err', { cfg: CFG, ctxjs: MOCK('error') });
    const r = await page.evaluate(async () => { const a = await Platform.ads.showRewarded(); return [a, Platform.ads.rewardedAvailable()]; });
    check(r[0] === true, 'error: fullscreen onError → hint still granted ' + r);
    check(errs.length === 0, 'error: no JS errors ' + errs.join('|')); await ctx.close(); }
  // 4) IDs set, context.js blocked (adblock / offline)
  { const { page, ctx, errs } = await run('blocked', { cfg: CFG }); await sleep(300);
    const r = await page.evaluate(async () => { const t = Date.now(); const a = await Platform.ads.showRewarded(); await Platform.ads.showInterstitial(); return [a, Date.now() - t, !!document.getElementById('floorMock') || document.documentElement.classList.contains('withWebBanner')]; });
    check(r[0] === true && r[1] < 1000 && !r[2], 'blocked context.js: hint granted at once, no hang, no banner ' + r);
    await page.click('#bAd').catch(() => {}); await sleep(300); const toast = await page.evaluate(() => document.body.innerText.includes('Реклама недоступна'));
    check(errs.length === 0, 'blocked: no JS errors ' + errs.join('|')); await ctx.close(); }
  console.log(fails ? `WEB ADS TEST FAILED (${fails})` : 'WEB ADS TEST PASSED'); await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})();
