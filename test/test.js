// Headless Chrome test for Сүз дөньясы (new UI). Usage: cd test && node test.js
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'), SHOTS = process.env.SHOTS || path.join(ROOT, 'shots');
const url = process.env.URL || ('file://' + path.join(ROOT, 'index.html'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = async n => { await page.screenshot({ path: path.join(SHOTS, n + '.png') }); console.log('  shot ' + n + '.png'); };
  const S = () => page.evaluate(() => JSON.parse(JSON.stringify(suzDonyasy.state)));

  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(900);
  ok(await page.evaluate(() => suzDonyasy.tutVisible() && suzDonyasy.tutStep === 'play'), 'first launch shows the tutorial (full flow: test_tutorial.js)');
  await page.click('#tutSkip'); await sleep(200);
  if (process.env.URL) { const meta = await page.evaluate(() => ({ robots: (document.querySelector('meta[name=robots]') || {}).content, badge: (document.getElementById('testBadge') || {}).textContent })); ok(/noindex/.test(meta.robots || '') && meta.badge === 'тестовая версия', 'live: noindex + test badge'); }

  // ---- data validation
  const v = await page.evaluate(() => {
    const D = window.TT_DATA, bad = []; const cnt = s => { const m = {}; for (const c of s) m[c] = (m[c] || 0) + 1; return m; };
    const sub = (w, L) => { const a = cnt(w), b = cnt(L); return Object.keys(a).every(k => a[k] <= (b[k] || 0)); };
    const all = D.levels.concat(D.daily);
    all.forEach(lv => {
      const L = Array.from(lv.l), grid = {};
      lv.w.forEach(([w, r, c, d]) => { if (!sub(Array.from(w), L)) bad.push(lv.id + ' notsub ' + w);
        Array.from(w).forEach((ch, i) => { const k = (d === 'h' ? r : r + i) + ',' + (d === 'h' ? c + i : c); if (grid[k] && grid[k] !== ch) bad.push(lv.id + ' clash ' + w); grid[k] = ch; }); });
      if (new Set(lv.w.map(x => x[0])).size !== lv.w.length) bad.push(lv.id + ' dup');
      lv.b.forEach(b => { if (!sub(Array.from(b), L)) bad.push(lv.id + ' bonus ' + b); });
    });
    const ch = D.chapters; let contiguous = ch[0].start === 1 && ch[ch.length - 1].end === D.levels.length && ch.every((c, i) => !i || c.start === ch[i - 1].end + 1);
    const lens = {}; D.levels.forEach(l => lens[Array.from(l.l).length] = (lens[Array.from(l.l).length] || 0) + 1);
    const words = D.levels.flatMap(l => l.w.map(x => x[0])), withG = D.levels.reduce((a, l) => a + l.w.filter(x => l.g[x[0]]).length, 0);
    return { bad: bad.slice(0, 10), nbad: bad.length, levels: D.levels.length, chapters: ch.length, daily: D.daily.length, wotd: D.wotd.length, contiguous, lens, gridWords: words.length, cov: withG / words.length };
  });
  console.log('  data', JSON.stringify(v));
  ok(v.nbad === 0, 'levels valid ' + v.bad.join('; ')); ok(v.levels >= 500, 'level count ' + v.levels); ok(v.contiguous, 'chapters contiguous (' + v.chapters + ')');
  ok(v.daily >= 365 && v.wotd >= 365, 'daily/wotd pools'); ok(v.cov > .85, 'translation coverage ' + (v.cov * 100).toFixed(1) + '%');

  // ---- home
  ok(await page.isVisible('#scrHome'), 'home visible');
  { const bgs = await page.evaluate(() => window.BG_IMAGES || []); if (bgs.length) { await sleep(1200); const u = await page.evaluate(() => document.getElementById('bg').style.backgroundImage);
    const th = await page.evaluate(() => TT_DATA.chapters[0].theme); ok(!bgs.includes(th) || /\.webp/.test(u), 'painted background loaded (' + bgs.length + ' images)'); } }
  await shot('home');
  // ---- rewards
  const c0 = (await S()).coins;
  await page.click('#tRewards'); await sleep(400); await shot('rewards');
  await page.click('#rClaim'); await sleep(1200);
  ok((await S()).coins === c0 + 10, 'daily reward day1 = +10'); ok((await S()).streak.claimed === await page.evaluate(() => suzDonyasy.dayKey()), 'reward claimed today');
  ok(await page.isDisabled('#rClaim'), 'claim disabled after claim');
  await page.evaluate(() => suzDonyasy.closeModal());
  // streak continuation simulation
  const sc = await page.evaluate(() => { const s = suzDonyasy.state; const y = new Date(); y.setDate(y.getDate() - 1); s.streak.last = suzDonyasy.dayKey(y); s.streak.claimed = suzDonyasy.dayKey(y); suzDonyasy.state = s; return 1; });
  await page.reload(); await sleep(700);
  ok((await S()).streak.count === 2, 'streak continues next day');

  // ---- map
  await page.click('#tMap'); await sleep(500); ok(await page.isVisible('#scrMap'), 'map visible'); await shot('map');
  await page.click('.chap.cur'); await sleep(400); await shot('chapter');
  await page.click('.lvl.cur', { force: true }); await sleep(1000);
  ok(await page.isVisible('#scrGame'), 'game screen from map');

  // ---- gameplay: real swipe for first word
  const lv = await page.evaluate(() => suzDonyasy.game.lv);
  const w0 = lv.w[0][0];
  const pts = await page.evaluate(w => { const els = suzDonyasy.game.letterEls, used = new Set(), out = [];
    for (const ch of Array.from(w)) { const i = els.findIndex((e, j) => !used.has(j) && e.textContent === ch); used.add(i); const r = els[i].getBoundingClientRect(); out.push([r.left + r.width / 2, r.top + r.height / 2]); } return out; }, w0);
  await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
  for (const p of pts.slice(1)) { await page.mouse.move(p[0], p[1], { steps: 6 }); }
  await shot('swipe'); await page.mouse.up(); await sleep(450); await shot('toast');
  const tp = await page.evaluate(() => { const t = document.getElementById('toast'), r = t.getBoundingClientRect(); const e = document.elementFromPoint(r.left + 6, r.top + r.height / 2); return { vis: t.classList.contains('show'), through: !t.contains(e), h: r.height }; });
  ok(tp.vis && tp.through, 'toast is click-through (h=' + Math.round(tp.h) + ')');
  if (!process.env.URL) { // toast readability on all backgrounds
    for (const th of await page.evaluate(() => Art.themes)) {
      await page.evaluate(t => { document.getElementById('bg').style.backgroundImage = Art.bg(t, 3); suzDonyasy.toast('авыл', 'деревня, село', 'авыл'); }, th);
      await sleep(350); await page.screenshot({ path: path.join(SHOTS, 'toast_' + th + '.png'), clip: { x: 40, y: 50, width: 310, height: 110 } });
    }
    await sleep(2500);
  }
  await sleep(450);
  ok(await page.evaluate(w => suzDonyasy.game.found.has(w), w0), 'swipe found word ' + w0);
  if (lv.b.length) { await page.evaluate(b => suzDonyasy.submit(b, []), lv.b[0]); await sleep(200); ok((await S()).jar >= 1, 'bonus word to jar'); }
  await page.evaluate(() => suzDonyasy.submit('ъъъ', [])); await sleep(100);
  await shot('game'); await page.locator('#wheel').screenshot({ path: path.join(SHOTS, 'wheel.png') });
  for (const x of lv.w.slice(1)) { await page.evaluate(w => suzDonyasy.submit(w, []), x[0]); await sleep(150); }
  await page.waitForSelector('#wNext', { timeout: 5000 }); await sleep(700); await shot('win');
  ok((await S()).level === 1, 'level 1 complete');
  // card from win summary
  await page.click('#sheet li[data-w]'); await page.waitForSelector('#cardModal:not([hidden])'); await sleep(400);
  const cardTxt = await page.textContent('#cardSheet'); ok(cardTxt.length > 10, 'card opens from summary'); await shot('card');
  await page.click('#cardSheet [data-cclose]'); await sleep(200);
  ok(await page.isVisible('#wNext'), 'win summary survives card view');
  await page.click('#wNext'); await sleep(1100);
  ok(await page.evaluate(() => suzDonyasy.game.id) === 1, 'next level started');
  // hint
  const hc = await S(); await page.click('#bHint'); await sleep(300); const ha = await S();
  ok(ha.freeHints === hc.freeHints - 1 || ha.coins === hc.coins - 25, 'hint consumed');
  await page.click('#gBack'); await sleep(500); ok(await page.isVisible('#scrHome'), 'back to home');

  // ---- daily puzzle
  await page.click('#tDaily'); await sleep(300); await page.click('#dGo'); await sleep(900);
  const dl = await page.evaluate(() => suzDonyasy.game.lv); ok(dl.id.startsWith('d'), 'daily puzzle ' + dl.id);
  await shot('daily_game');
  for (const x of dl.w) { await page.evaluate(w => suzDonyasy.submit(w, []), x[0]); await sleep(120); }
  await page.waitForSelector('#wNext'); await sleep(600); await page.click('#wNext'); await sleep(600);
  ok(!!(await S()).dailyDone[await page.evaluate(() => suzDonyasy.dayKey())], 'daily marked done');
  const same = await page.evaluate(() => { const D = suzDonyasy.data; return D.daily[suzDonyasy.dailyIndex()].id; }); ok(same === dl.id, 'daily is deterministic by date');

  // ---- word of the day
  await page.click('#tWotd'); await sleep(900); ok(await page.isVisible('.wotdbig'), 'word of the day'); await shot('wotd');
  await page.evaluate(() => suzDonyasy.closeModal());
  // ---- quests
  await page.click('#tQuests'); await sleep(400); const nq = await page.$$eval('#sheet .q', e => e.length); ok(nq === 3, '3 daily quests'); await shot('quests');
  const qbtn = await page.$('#sheet [data-q]'); if (qbtn) { const c1 = (await S()).coins; await qbtn.click(); await sleep(900); ok((await S()).coins > c1, 'quest reward claimed'); }
  await page.evaluate(() => suzDonyasy.closeModal());
  // ---- spin
  await page.click('#tSpin'); await sleep(500); await shot('spin_before'); const s1 = await S(); await page.click('#spBtn'); await sleep(1300); await shot('spin_mid');
  const rot = await page.evaluate(() => document.getElementById('spinDisk').style.transform); ok(/rotate\(/.test(rot), 'wheel rotates as one layer');
  await sleep(3700); await shot('spin_highlight'); await sleep(1500); await shot('spin_result'); await shot('spin');
  ok(await page.isVisible('#spinPrize'), 'spin prize popup');
  const s2 = await S(); ok(s2.coins > s1.coins || s2.freeHints > s1.freeHints, 'spin prize'); ok(await page.isDisabled('#spBtn'), 'spin once per day');
  await page.evaluate(() => suzDonyasy.closeModal());
  // ---- collection
  await page.click('#tColl'); await sleep(400); const nl = await page.$$eval('#sheet .list li[data-w]', e => e.length); ok(nl >= lv.w.length, 'collection lists learned words (' + nl + ')'); await shot('collection');
  await page.click('#sheet .list li[data-w]'); await page.waitForSelector('#cardModal:not([hidden])'); await sleep(300); await shot('collection_card');
  // share card: image + fallback (download + clipboard) on desktop headless
  const shDlP = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await page.click('#cShare'); const shDl = await shDlP; ok(!!shDl, 'share fallback downloads PNG' + (shDl ? ' ' + shDl.suggestedFilename() : ''));
  await sleep(300);
  await page.click('#cardSheet [data-cclose]');
  await page.evaluate(() => suzDonyasy.closeModal());
  { const w = await page.evaluate(() => suzDonyasy.wotdWord());
    const png = await page.evaluate(async w => { const c = await suzDonyasy.withCard(w); const cv = await suzDonyasy.shareCanvas(w, c, null, 'Слово дня'); return cv.toDataURL('image/png'); }, w);
    fs.writeFileSync(path.join(SHOTS, 'share_card.png'), Buffer.from(png.split(',')[1], 'base64')); console.log('  shot share_card.png (' + w + ')');
    ok(png.length > 100000, 'share image rendered ' + Math.round(png.length / 1024) + ' KB b64');
    const dp = await ctx.newPage(); dp.on('pageerror', e => errors.push('deeplink: ' + e.message));
    await dp.goto(url + '#word=' + encodeURIComponent(w)); await dp.waitForSelector('#cardModal:not([hidden])', { timeout: 5000 }).catch(() => {});
    ok(await dp.isVisible('#cardModal'), 'deep link #word= opens card'); await dp.screenshot({ path: path.join(SHOTS, 'deeplink_card.png') }); await dp.close(); }
  // ---- achievements & settings
  await page.click('#tAch'); await sleep(300); await shot('achievements'); await page.evaluate(() => suzDonyasy.closeModal());
  ok(await page.isVisible('#hBrand') && (await page.getAttribute('#hBrand', 'href')) === 'https://pirogovlab.ru', 'home PirogovLab footer');
  ok((await page.getAttribute('meta[name=author]', 'content')) === 'Михаил Пирогов, PirogovLab', 'meta author');
  await page.click('#hSettings'); await sleep(300); await shot('settings');
  { const cr = await page.textContent('#sheet .credits'); ok(/© 2026 Михаил Пирогов/.test(cr) && /Викисловарь/.test(cr) && /CC BY-SA 4\.0/.test(cr) && /Wiktionary/.test(cr) && !/Suno/i.test(cr), 'credits block'); }
  ok(await page.$eval('#sheet .credits', el => !!el.querySelector('a[href="https://pirogovlab.ru/suz-donyasy/privacy/"]')), 'credits: privacy policy link');
  ok(!(await page.$('[data-lang]')) && !/Язык|Марла/.test(await page.textContent('#sheet')) && await page.isVisible('#sHowTo'), 'no language switch; «Как играть» in settings');
  ok(await page.evaluate(() => document.documentElement.lang === 'ru' && Object.keys(I18N).join() === 'ru'), 'UI is Russian only');
  await page.evaluate(() => suzDonyasy.closeModal());
  { // an old save with the Mari UI language and a platform reporting 'mhr' still gets the Russian UI
    await page.evaluate(() => { const s = suzDonyasy.state; s.settings.lang = 'mhr'; suzDonyasy.state = s; });
    await page.addInitScript(() => { Object.defineProperty(navigator, 'language', { get: () => 'mhr' }); });
    await page.reload(); await sleep(800);
    ok((await page.textContent('#hPlayTxt')) === 'Играть' && (await S()).settings.lang === undefined, 'saved/detected foreign UI language ignored → Russian'); }
  { // tap a found word in the crossword -> card
    await page.click('#hPlay'); await sleep(900); const w = await page.evaluate(() => suzDonyasy.game.lv.w[0][0]);
    await page.evaluate(w => suzDonyasy.submit(w, []), w); await sleep(1300);
    await page.click('#grid .cell.found'); await page.waitForSelector('#cardModal:not([hidden])', { timeout: 4000 }).catch(() => {});
    ok(await page.isVisible('#cardModal'), 'tap a found word in the grid opens its card'); await page.click('#cardSheet [data-cclose]'); await page.evaluate(() => suzDonyasy.goHome()); await sleep(300); }
  { // plain web: no ad network — 🎬 says «Реклама недоступна», no rewarded extras
    ok(await page.evaluate(() => !Platform.ads.rewardedAvailable() && !Platform.ads.bannerAvailable()), 'plain web: no ads configured'); }

  // ---- persistence
  const before = await S(); await page.reload(); await sleep(800); const after = await S();
  ok(after.level === before.level && Object.keys(after.learned).length === Object.keys(before.learned).length && after.coins === before.coins, 'state persists across reload');
  // resume in-progress level
  await page.click('#hPlay'); await sleep(900); const g = await page.evaluate(() => suzDonyasy.game.lv.w[0][0]); await page.evaluate(w => suzDonyasy.submit(w, []), g); await sleep(300);
  await page.reload(); await sleep(800); await page.click('#hPlay'); await sleep(900);
  ok(await page.evaluate(w => suzDonyasy.game.found.has(w), g), 'in-progress level resumes');
  // late level renders (long words)
  await page.evaluate(() => suzDonyasy.startGame('main', suzDonyasy.data.levels.length - 1)); await sleep(1000); await shot('game_late');
  const ov = await page.evaluate(() => { const r = document.getElementById('grid').getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1; }); ok(ov, 'late level grid fits screen');

  // ---- no background music in this build (no licensed tracks yet): UI hides the music controls
  { await page.evaluate(() => suzDonyasy.goHome()); await page.mouse.click(200, 300); await sleep(800);
    ok(await page.evaluate(() => (window.MUSIC_TRACKS || []).length === 0 && !Music.current), 'no music tracks shipped');
    ok(!(await page.isVisible('#hMusic')), 'home music button hidden');
    await page.click('#hSettings'); await sleep(300);
    ok(!(await page.$('#sMusic')) && !(await page.$('#sMusicVol')), 'no music controls in settings');
    await shot('settings_music'); await page.evaluate(() => suzDonyasy.closeModal()); }
  // ---- painted backgrounds as they appear in-game (phone), contact sheet bg_all.png
  if (!process.env.URL) {
    await page.evaluate(() => suzDonyasy.startGame('main', 3)); await sleep(1000);
    const themes = await page.evaluate(() => window.BG_IMAGES || []);
    for (const n of themes) {  // per-chapter photo backgrounds
      const th = await page.evaluate(n => suzDonyasy.data.chapters[n - 1].theme, n);
      await page.evaluate(([t, n]) => suzDonyasy.setBg(t, n), [th, n]); await sleep(700);
      const u = await page.evaluate(() => document.getElementById('bg').style.backgroundImage), f = 'ch' + String(n).padStart(2, '0');
      ok(u.includes('img/bg/' + f + '.webp'), 'phone bg ' + f);
      if (n % 10 === 1) await page.screenshot({ path: path.join(SHOTS, 'bg_' + f + '.png') });
    }
    // desktop landscape (Yandex Games on desktop)
    const dctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const dp = await dctx.newPage();
    dp.on('pageerror', e => errors.push('desktop pageerror: ' + e.message));
    await dp.goto(url); await sleep(900); await dp.screenshot({ path: path.join(SHOTS, 'desktop_home.png') });
    await dp.evaluate(() => suzDonyasy.startGame('main', 0)); await sleep(1400);
    const du = await dp.evaluate(() => document.getElementById('bg').style.backgroundImage);
    ok(!themes.length || /_l\.webp/.test(du), 'desktop uses landscape bg'); await dp.screenshot({ path: path.join(SHOTS, 'desktop_game.png') }); console.log('  shot desktop_game.png');
    await dctx.close();
  }
  // ---- platform adapters (stub SDK)
  const yp = await page.evaluate(async () => { window.YaGames = { init: async () => ({ features: { LoadingAPI: { ready() { window.__ready = 1; } } }, getPlayer: async () => ({ getData: async () => ({}), setData: async () => {} }), adv: { showRewardedVideo({ callbacks }) { callbacks.onRewarded(); callbacks.onClose(); }, showFullscreenAdv() {} }, getLeaderboards: async () => ({ setLeaderboardScore: async () => {} }), environment: { i18n: { lang: 'ru' } } }) };
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'js/adapters/yandex.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    await Platform.init(); Platform.gameReady(); const r = await Platform.ads.showRewarded(); return { name: Platform.name, r, ready: window.__ready || 0 }; });
  ok(yp.name === 'yandex' && yp.r === true, 'yandex adapter with stub SDK ' + JSON.stringify(yp));

  await page.goto(url); await sleep(1500);
  ok(errors.length === 0, 'no JS errors ' + errors.slice(0, 5).join(' | '));
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
