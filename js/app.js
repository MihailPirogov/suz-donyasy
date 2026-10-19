/* Сүз дөньясы (Tatar word game, fork of «Мут тӱня») — main app. Depends on: Platform, Sound, I18N, Art, TT_DATA. */
(function () {
  'use strict';
  const DATA = window.TT_DATA || { levels: [], chapters: [], daily: [], wotd: [], meta: {} };
  const LEVELS = DATA.levels, CHAPTERS = DATA.chapters, DAILY = DATA.daily, WOTD = DATA.wotd;
  const KEY = 'suzDonyasy.v1';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------- dates (local calendar day) ---------------- */
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dayNum(k) { const [y, m, d] = (k || dayKey()).split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); }
  function seeded(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  /* ---------------- state ---------------- */
  function fresh() {
    return { v: 2, level: 0, coins: 60, freeHints: 1, settings: { sound: true, vib: true }, tut: { done: false, step: 0 },
      cur: null, done: {}, stats: { levels: 0, words: 0, bonus: 0, hints: 0, cards: 0, daily: 0, comboMax: 0, noHint: 0, chests: 0, spins: 0 },
      learned: {}, jar: 0, streak: { last: null, count: 0, best: 0, claimed: null, cycle: 0 }, dailyDone: {},
      quests: { date: null, list: [], prog: {}, claimed: {} }, ach: {}, spin: { last: null, adDay: null, adN: 0 }, chests: {}, wotdSeen: {} };
  }
  const firstRun = !Platform.storage.load(KEY);
  let st = Object.assign(fresh(), Platform.storage.load(KEY) || {});
  function migrate() {
    st.settings = Object.assign(fresh().settings, st.settings); st.stats = Object.assign(fresh().stats, st.stats);
    delete st.settings.lang;  // UI is Russian only (inherited from the Mari game)
    st.spin = Object.assign(fresh().spin, st.spin);
    // tutorial: players who already have progress are not forced through it (they can replay it from Settings)
    if (!st.tut || typeof st.tut !== 'object') st.tut = { done: st.level > 0 || st.stats.levels > 0, step: 0 };
  }
  migrate();
  let saveT = null;
  function save() { Platform.storage.save(KEY, st); clearTimeout(saveT); saveT = setTimeout(() => Platform.cloud.available && Platform.cloud.push(st), 3000); }
  const T = k => I18N.ru[k] || k;
  Sound.enabled = st.settings.sound;
  // background music: none yet (no licensed tracks). Fill js/tracks.js + this map with CC0/licensed tracks to enable.
  const MUSIC_FOR = {};
  const HAS_MUSIC = (window.MUSIC_TRACKS || []).length > 0;
  const musicOn = () => st.settings.music !== false, musicVol = () => (st.settings.musicVol == null ? 0.3 : st.settings.musicVol);
  if (window.Music) Music.configure({ enabled: musicOn(), volume: musicVol() });
  function updMusicBtn() { const b = document.getElementById('hMusic'); if (b) { b.textContent = musicOn() ? '🎵' : '🔇'; b.classList.toggle('off', !musicOn()); } }
  function haptic(ms) { if (st.settings.vib) Platform.haptic(ms); }

  /* ---------------- word cards (lazy chunks by first letter) ---------------- */
  const CARDS = {}; const loaded = {}; const waiting = {};
  window.TT_CARDS_PUSH = obj => Object.assign(CARDS, obj);
  function loadChunk(w) {
    const k = w.codePointAt(0);
    if (loaded[k]) return loaded[k];
    if ((DATA.meta.card_chunks || []).indexOf(k) < 0) return (loaded[k] = Promise.resolve());
    return (loaded[k] = new Promise(res => { const s = document.createElement('script'); s.src = 'data/cards/c' + k + '.js' + (window.BUILD_V ? '?v=' + window.BUILD_V : ''); s.onload = res; s.onerror = res; document.head.appendChild(s); }));
  }
  function withCard(w) { return loadChunk(w).then(() => CARDS[w] || null); }

  /* ---------------- level access ---------------- */
  function chapterOf(i) { return CHAPTERS.find(c => i + 1 >= c.start && i + 1 <= c.end) || CHAPTERS[CHAPTERS.length - 1] || { n: 1, tt: '', ru: '', theme: 'meadow', start: 1, end: 1 }; }
  function dailyIndex(k) { return DAILY.length ? ((dayNum(k) % DAILY.length) + DAILY.length) % DAILY.length : 0; }
  function getLevel(kind, id) { return kind === 'daily' ? DAILY[id] : LEVELS[id % LEVELS.length]; }
  function chapName(c) { return c.ru === c.tt ? c.ru : c.tt + ' · ' + c.ru; }

  /* ---------------- screens ---------------- */
  let screen = 'home', adShowing = false, gpOn = false;
  // gameplay markup (Yandex GameplayAPI.start/stop): active only on the game screen with no modal/ad and a visible tab
  function gp() {
    const on = screen === 'game' && $('modal').hidden && $('cardModal').hidden && !adShowing && !document.hidden;
    if (on === gpOn) return; gpOn = on; try { on ? Platform.gameplay.start() : Platform.gameplay.stop(); } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => gp());
  async function withAd(fn) { adShowing = true; gp(); try { return await fn(); } finally { adShowing = false; gp(); } }
  /* ads policy (all platforms): nothing before the tutorial is finished, never during swipe input.
   * fullscreen: only between levels; banner: sticky, outside the game area (Yandex platform / native Android view);
   * rewarded: only on the player's tap (🎬 hint, double coins after a level, extra fortune-wheel spin). */
  const adsOk = () => !!(st.tut && st.tut.done);
  const canAd = () => adsOk() && Platform.ads.rewardedAvailable();
  let bannerOn = false;
  function updBanner() {
    const want = adsOk() && Platform.ads.bannerAvailable();
    if (want === bannerOn) return; bannerOn = want;
    try { want ? Platform.ads.showBanner() : Platform.ads.hideBanner(); } catch (e) {}
  }
  let adLevels = 0, adLast = Date.now();
  // fullscreen ad only in a logical pause (between levels): every 3rd win and >= 150 s since the last ad / session start
  async function maybeInterstitial() {
    if (!adsOk()) return;
    adLevels++;
    if (!Platform.ads.interstitialAvailable() || adLevels < 3 || Date.now() - adLast < 150000) return;
    adLevels = 0; adLast = Date.now();
    try { await withAd(() => Platform.ads.showInterstitial()); } catch (e) {}
    adLast = Date.now();
  }
  function show(name) {
    screen = name; setTimeout(gp, 0);
    ['Home', 'Map', 'Game'].forEach(n => $('scr' + n).classList.toggle('on', n.toLowerCase() === name));
    const ch = name === 'game' && game.kind === 'daily' ? { theme: 'dawn', n: 99 } : chapterOf(name === 'game' ? game.id : st.level);
    setBg(ch.theme, ch.n);
    refreshCoins();
  }
  let curBg = '';
  // photo backgrounds (img/bg/chNN.webp, listed in js/bgimages.js) load lazily; procedural SVG shows instantly meanwhile / as fallback
  const BGI = new Set(window.BG_IMAGES || []), bgReady = {};
  const LAND = window.matchMedia('(orientation: landscape) and (min-aspect-ratio: 5/4)');
  // per-chapter photos: img/bg/chNN.webp (portrait) and chNN_l.webp (wide); BG_IMAGES lists available chapter numbers
  function bgFile(theme, n) { const c = n === 99 ? 15 : n; return BGI.has(c) ? 'ch' + String(c).padStart(2, '0') : BGI.has(theme) ? theme : null; }
  function bgImage(theme, wide, n) {
    const base = bgFile(theme, n); if (!base) return Promise.resolve(null);
    const f = base + (wide ? '_l' : '');
    return bgReady[f] || (bgReady[f] = new Promise(res => { const im = new Image(); const u = 'img/bg/' + f + '.webp' + (window.BUILD_V ? '?v=' + window.BUILD_V : '');
      im.onload = () => res('url("' + u + '")'); im.onerror = () => res(null); im.src = u; }));
  }
  function paintBg(el, theme, n, isCur, wide) { el.style.backgroundImage = Art.bg(theme, n, wide == null ? LAND.matches : wide); bgImage(theme, wide == null ? LAND.matches : wide, n).then(u => { if (isCur && el.id === 'bg') document.body.classList.toggle('photoBg', !!u); if (u && (!isCur || isCur())) el.style.backgroundImage = u; }); }
  let bgTheme = null;
  (LAND.addEventListener ? LAND.addEventListener('change', reBg) : LAND.addListener(reBg));
  function reBg() { if (bgTheme) { const [t, n] = bgTheme, k = curBg; paintBg($('bg'), t, n, () => curBg === k); } }
  function setBg(theme, n) { const k = theme + n; if (k === curBg) return; curBg = k; bgTheme = [theme, n]; if (window.Music) Music.play(MUSIC_FOR[theme] || ''); const b = $('bg'); b.style.opacity = .3; setTimeout(() => { paintBg(b, theme, n, () => curBg === k); b.style.opacity = 1; }, 150); }
  function refreshCoins() { document.querySelectorAll('#hCoins b,.coinsVal').forEach(e => e.textContent = st.coins); }

  /* ---------------- toast / modal ---------------- */
  let toastT, toastWord = null;
  function toast(title, sub, word) {
    const el = $('toast'); toastWord = word || null;
    el.innerHTML = '<b>' + esc(title) + '</b>' + (sub ? '<div>' + sub + '</div>' : '') + (word ? '<div class="more">' + T('tapCard') + '</div>' : '');
    el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), word ? 3000 : 2000);
  }
  $('toast').addEventListener('click', e => { if (!e.target.closest('.more')) return; if (toastWord) openCard(toastWord); $('toast').classList.remove('show'); });
  let onModalClose = null;
  function modal(html, opts) {
    opts = opts || {};
    const m = $('modal'), s = $('sheet');
    m.classList.toggle('center', !!opts.center);
    s.innerHTML = (opts.noX ? '' : '<button class="x" data-close>✕</button>') + html;
    s.style.setProperty('--orn', Art.ornament('#e9b949', '#b8202f', 10));
    m.hidden = false; s.scrollTop = 0; onModalClose = opts.onClose || null; gp();
    return s;
  }
  function closeModal() { $('modal').hidden = true; const f = onModalClose; onModalClose = null; if (f) f(); gp(); }
  $('modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) { Sound.click(); closeModal(); } });

  /* ---------------- coins fx ---------------- */
  function addCoins(n, fromEl) {
    if (!n) return;
    st.coins = Math.max(0, st.coins + n); save();
    if (n > 0 && fromEl) flyCoins(fromEl, Math.min(n, 8)); else refreshCoins();
  }
  function flyCoins(fromEl, k) {
    const fr = fromEl.getBoundingClientRect();
    const target = document.querySelector('.screen.on .pill.coins') || $('hCoins'); const tr = target.getBoundingClientRect();
    for (let i = 0; i < k; i++) {
      const c = document.createElement('i'); c.className = 'coin flyc'; $('fly').appendChild(c);
      const x0 = fr.left + fr.width / 2 + (Math.random() - .5) * 40, y0 = fr.top + fr.height / 2 + (Math.random() - .5) * 30;
      c.style.left = x0 + 'px'; c.style.top = y0 + 'px';
      const a = c.animate([{ transform: 'translate(0,0) scale(.6)', opacity: 0 }, { transform: `translate(${(Math.random() - .5) * 60}px,-40px) scale(1.2)`, opacity: 1, offset: .3 },
        { transform: `translate(${tr.left + 10 - x0}px,${tr.top + 8 - y0}px) scale(.8)`, opacity: 1 }], { duration: 700 + i * 70, easing: 'cubic-bezier(.5,0,.6,1)' });
      a.onfinish = () => { c.remove(); if (i === k - 1) { refreshCoins(); target.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 250 }); } Sound.coin(); };
    }
  }
  /* confetti */
  function confetti(n) {
    const cv = $('fx'), cx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
    const cols = ['#1c9a6c', '#f8c94f', '#ffffff', '#43c46b', '#5fb8e8', '#ff8fb8'];
    const ps = Array.from({ length: n || 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .45, vx: (Math.random() - .5) * 14, vy: -Math.random() * 16 - 4, r: Math.random() * 360, vr: (Math.random() - .5) * 20, w: 6 + Math.random() * 6, h: 8 + Math.random() * 10, c: cols[Math.random() * cols.length | 0], diamond: Math.random() < .4 }));
    let t = 0;
    (function step() {
      cx.clearRect(0, 0, cv.width, cv.height); t++;
      ps.forEach(p => { p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r * Math.PI / 180); cx.fillStyle = p.c;
        if (p.diamond) { cx.beginPath(); cx.moveTo(0, -p.h / 2); cx.lineTo(p.w / 2, 0); cx.lineTo(0, p.h / 2); cx.lineTo(-p.w / 2, 0); cx.fill(); } else cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * .5);
        cx.restore(); });
      if (t < 160) requestAnimationFrame(step); else cx.clearRect(0, 0, cv.width, cv.height);
    })();
  }

  /* ================= GAME ================= */
  const game = { kind: 'main', id: 0, lv: null, found: new Set(), bonus: new Set(), hints: new Set(), cells: {}, letters: [], sel: [], dragging: false, combo: 0, lastT: 0, usedHint: false };
  function cellsOf(w) { const out = []; for (let i = 0; i < w[0].length; i++) out.push(w[3] === 'h' ? [w[1], w[2] + i] : [w[1] + i, w[2]]); return out; }
  function glossOf(w) { const g = game.lv && game.lv.g && game.lv.g[w]; return g || null; }
  function glossHtml(w, g) { g = g || glossOf(w); if (!g) return '<span class="en">' + T('noTr') + '</span>'; const t = String(g[0]).replace(/^[\s,;:.]+/, ''); return g[1] === 'en' ? '<span class="en">(англ.) ' + esc(t) + '</span>' : esc(t); }

  function startGame(kind, id) {
    game.kind = kind; game.id = id; game.lv = getLevel(kind, id);
    if (!game.lv) return;
    const c = st.cur && st.cur.kind === kind && st.cur.id === id ? st.cur : { kind, id, found: [], bonus: [], hints: [], usedHint: false };
    st.cur = c; save();
    game.found = new Set(c.found); game.bonus = new Set(c.bonus); game.hints = new Set(c.hints); game.usedHint = c.usedHint; game.combo = 0;
    game.letters = Array.from(game.lv.l); game.lastFound = null;
    if (kind === 'daily') { $('gTitle').textContent = T('daily'); $('gSub').textContent = dayKey(); }
    else { const ch = chapterOf(id); $('gTitle').textContent = T('level') + ' ' + (id + 1); $('gSub').textContent = chapName(ch) + ' · ' + (id + 2 - ch.start) + '/' + (ch.end - ch.start + 1); }
    show('game');
    requestAnimationFrame(() => { buildGrid(); buildWheel(true); updProg(); updJar(); updHintBtns(); });
    // preload cards for this level
    new Set(game.lv.w.map(x => x[0].codePointAt(0))).forEach(k => loadChunk(String.fromCodePoint(k)));
  }
  function persist() { st.cur = { kind: game.kind, id: game.id, found: [...game.found], bonus: [...game.bonus], hints: [...game.hints], usedHint: game.usedHint }; save(); }

  function buildGrid() {
    const g = $('grid'), lv = game.lv; g.innerHTML = ''; game.cells = {};
    const wr = $('gridWrap').getBoundingClientRect();
    const size = Math.max(22, Math.min(56, Math.floor(Math.min((wr.width - 28) / lv.c, (wr.height - 28) / lv.r) - 4)));
    g.style.gridTemplateColumns = `repeat(${lv.c}, ${size}px)`; g.style.gridTemplateRows = `repeat(${lv.r}, ${size}px)`;
    for (let r = 0; r < lv.r; r++) for (let c = 0; c < lv.c; c++) { const d = document.createElement('div'); d.className = 'cell'; d.style.fontSize = (size * .6) + 'px'; g.appendChild(d); game.cells[r + ',' + c] = { el: d, ch: null }; }
    lv.w.forEach(w => cellsOf(w).forEach(([r, c], i) => { const m = game.cells[r + ',' + c]; m.ch = w[0][i]; m.el.classList.add('on'); }));
    game.hints.forEach(k => { const m = game.cells[k]; if (m && m.ch) { m.el.textContent = m.ch; m.el.classList.add('hint'); } });
    lv.w.forEach(w => { if (game.found.has(w[0])) revealWord(w, false); });
  }
  // tap a found word in the crossword -> its translation card
  $('grid').addEventListener('click', e => {
    const el = e.target.closest('.cell.found'); if (!el || !game.lv) return;
    const hits = game.lv.w.filter(x => game.found.has(x[0]) && cellsOf(x).some(([r, c]) => game.cells[r + ',' + c].el === el));
    if (!hits.length) return;
    const w = hits.find(x => x[0] === game.lastFound) || hits[0];
    Sound.click(); openCard(w[0], glossOf(w[0]));
  });
  function revealCell(m, ch) { m.el.textContent = ch; m.el.classList.remove('hint'); m.el.classList.add('found'); }
  function revealWord(w, anim, fromIdx) {
    cellsOf(w).forEach(([r, c], i) => {
      const m = game.cells[r + ',' + c];
      if (!anim) return revealCell(m, w[0][i]);
      const srcEl = fromIdx && game.letterEls[fromIdx[i]] ? game.letterEls[fromIdx[i]] : $('word');
      const a = srcEl.getBoundingClientRect(), b = m.el.getBoundingClientRect();
      const f = document.createElement('div'); f.className = 'flyl'; f.textContent = w[0][i];
      f.style.cssText = `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px;font-size:${b.width * .56}px`;
      $('fly').appendChild(f);
      const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
      const an = f.animate([{ transform: `translate(${dx}px,${dy}px) scale(.7)`, opacity: .3 }, { transform: 'translate(0,0) scale(1.15)', opacity: 1, offset: .8 }, { transform: 'none', opacity: 1 }],
        { duration: 420, delay: i * 55, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
      an.onfinish = () => { f.remove(); revealCell(m, w[0][i]); if (i === w[0].length - 1) haptic(8); };
    });
  }
  // wheel ornament: brief brighter pulse when a word is found (CSS-only animation, see .wheelOrn)
  function ornPulse() { const o = document.querySelector('#wheel .ornP'); if (!o) return; o.classList.remove('pulse'); void o.getBoundingClientRect(); o.classList.add('pulse'); }
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('hiddenTab', document.hidden));
  function buildWheel(anim) {
    const wh = $('wheel'); wh.querySelectorAll('.let').forEach(e => e.remove());
    const lowLand = innerWidth > innerHeight && innerHeight <= 540;  // phone landscape: wheel sits in the right column
    const D = lowLand ? Math.max(150, Math.min(innerHeight - 180, 250)) : Math.max(170, Math.min(innerWidth - 150, innerHeight * .34, 290)); wh.style.width = wh.style.height = D + 'px'; game.R = D / 2;
    $('lines').setAttribute('viewBox', `0 0 ${D} ${D}`);
    const n = game.letters.length; game.letterEls = [];
    const rad = n <= 3 ? .52 : n <= 5 ? .64 : .7;
    game.letters.forEach((ch, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n, e = document.createElement('div');
      e.className = 'let' + (anim ? ' in' : ''); e.textContent = ch; e.style.animationDelay = (i * 45) + 'ms';
      e.style.left = (50 + 50 * rad * Math.cos(a)) + '%'; e.style.top = (50 + 50 * rad * Math.sin(a)) + '%';
      e.style.fontSize = (D * (n > 6 ? .115 : .14)) + 'px'; wh.appendChild(e); game.letterEls.push(e);
    });
  }
  function centerOf(i) { const wr = $('wheel').getBoundingClientRect(), r = game.letterEls[i].getBoundingClientRect(); return [r.left + r.width / 2 - wr.left, r.top + r.height / 2 - wr.top]; }
  function hit(x, y) { for (let i = 0; i < game.letterEls.length; i++) { const r = game.letterEls[i].getBoundingClientRect(); if (Math.hypot(x - r.left - r.width / 2, y - r.top - r.height / 2) < r.width * .62) return i; } return -1; }
  function drawLines(px, py) {
    const pts = game.sel.map(centerOf); let s = '';
    if (pts.length) { let d = 'M' + pts.map(p => p.join(',')).join(' L'); if (px != null) { const wr = $('wheel').getBoundingClientRect(); d += ` L${px - wr.left},${py - wr.top}`; }
      s = `<path d="${d}" fill="none" stroke="#b8202f" stroke-width="${game.R * .075}" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>`; }
    $('lines').innerHTML = s;
  }
  const curWord = () => game.sel.map(i => game.letters[i]).join('');
  function updSel() { game.letterEls.forEach((e, i) => e.classList.toggle('sel', game.sel.includes(i))); const w = $('word'); w.className = ''; w.textContent = curWord(); }
  const wheel = $('wheel');
  wheel.addEventListener('pointerdown', e => { Sound.unlock(); const i = hit(e.clientX, e.clientY); if (i < 0) return; game.dragging = true; game.sel = [i]; updSel(); Sound.tap(0); haptic(5); drawLines(e.clientX, e.clientY); try { wheel.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
  wheel.addEventListener('pointermove', e => { if (!game.dragging) return; const i = hit(e.clientX, e.clientY);
    if (i >= 0) { if (!game.sel.includes(i)) { game.sel.push(i); updSel(); Sound.tap(game.sel.length - 1); haptic(5); } else if (game.sel.length > 1 && game.sel[game.sel.length - 2] === i) { game.sel.pop(); updSel(); } }
    drawLines(e.clientX, e.clientY); });
  const endDrag = () => { if (!game.dragging) return; game.dragging = false; const w = curWord(), idx = game.sel.slice(); game.sel = []; drawLines(); game.letterEls.forEach(e => e.classList.remove('sel')); if (w.length) submit(w, idx); };
  wheel.addEventListener('pointerup', endDrag); wheel.addEventListener('pointercancel', endDrag);

  function clearPreview(ms) { setTimeout(() => { if (!game.dragging) { const s = $('word'); s.textContent = ''; s.className = ''; } }, ms || 650); }
  function learn(w, g0) { if (!st.learned[w]) { const g = g0 || glossOf(w); st.learned[w] = { d: dayNum(), g: g ? g[0].slice(0, 60) : '', s: g ? g[1] : '' }; } }
  function submit(w, idx) {
    const span = $('word'); span.textContent = w; const lv = game.lv;
    const target = lv.w.find(x => x[0] === w);
    if (target) {
      if (game.found.has(w)) { span.className = 'dup'; Sound.dup(); flashWord(target); toast(w, T('already')); return clearPreview(); }
      span.className = 'good'; game.found.add(w); learn(w); st.stats.words++; quest('words', 1);
      const now = Date.now(); game.combo = now - game.lastT < 7000 ? game.combo + 1 : 1; game.lastT = now;
      revealWord(target, true, idx); Sound.ok(); haptic(15); ornPulse(); updProg(); persist(); game.lastFound = w; tutEvent('word');
      if (game.combo >= 2) { showCombo(game.combo); addCoins(game.combo - 1, $('combo')); st.stats.comboMax = Math.max(st.stats.comboMax, game.combo); quest('combo', 0, game.combo); }
      toast(w, glossHtml(w), w); clearPreview();
      if (lv.w.every(x => game.found.has(x[0]))) setTimeout(win, 1000);
      checkAch(); return;
    }
    if (w.length >= 3 && lv.b.includes(w)) {
      if (game.bonus.has(w)) { span.className = 'dup'; Sound.dup(); toast(w, T('already')); return clearPreview(); }
      game.bonus.add(w); learn(w); st.stats.bonus++; st.jar++; quest('bonus', 1); Sound.bonus(); haptic(10);
      span.className = 'good'; persist(); updJar(true); toast('+ ' + w, T('bonusWord') + ' · ' + glossHtml(w), w); clearPreview(); checkAch(); return;
    }
    span.className = 'bad'; Sound.bad(); haptic(30); game.combo = 0; clearPreview(450);
  }
  function flashWord(t) { cellsOf(t).forEach(([r, c]) => { const el = game.cells[r + ',' + c].el; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }); }
  function showCombo(n) { const c = $('combo'); c.textContent = T('combo') + ' ×' + n; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); Sound.combo(n); }
  function updProg() { const lv = game.lv; $('gProg').style.width = (100 * lv.w.filter(x => game.found.has(x[0])).length / lv.w.length) + '%'; }
  function updJar(bump) { const n = st.jar % 10, full = st.jar >= 10; $('jarBadge').textContent = full ? '!' : n; $('jarRing').style.strokeDashoffset = 100.5 * (1 - (full ? 1 : n / 10)); if (bump) $('bJar').animate([{ transform: 'scale(1.25) rotate(-8deg)' }, { transform: 'none' }], { duration: 350 }); }
  function updHintBtns() { const f = $('freeBadge'); f.hidden = !st.freeHints; f.textContent = st.freeHints; $('bAd').hidden = !Platform.ads.rewardedAvailable(); }

  function openCells() { return game.lv.w.filter(x => !game.found.has(x[0])); }
  function autoComplete() {
    game.lv.w.forEach(x => { if (!game.found.has(x[0]) && cellsOf(x).every(([r, c]) => game.hints.has(r + ',' + c) || game.cells[r + ',' + c].el.classList.contains('found'))) { game.found.add(x[0]); learn(x[0]); revealWord(x, true); } });
    updProg(); persist(); if (game.lv.w.every(x => game.found.has(x[0]))) setTimeout(win, 900);
  }
  function payHint(cost) {
    if (st.freeHints > 0) { st.freeHints--; updHintBtns(); return true; }
    if (st.coins < cost) { toast(T('notEnough'), T('needCoins') + cost); Sound.bad(); return false; }
    addCoins(-cost); return true;
  }
  function hintLetter(free) {
    const open = openCells(); if (!open.length) return;
    const cands = []; open.forEach(x => cellsOf(x).forEach(([r, c]) => { const k = r + ',' + c; if (!game.hints.has(k) && !game.cells[k].el.classList.contains('found')) cands.push(k); }));
    if (!cands.length) return;
    if (!free && !payHint(25)) return;
    const k = cands[Math.random() * cands.length | 0]; game.hints.add(k); const m = game.cells[k];
    m.el.textContent = m.ch; m.el.classList.add('hint', 'flash'); Sound.click(); haptic(10);
    game.usedHint = true; st.stats.hints++; autoComplete();
  }
  function hintWord() {
    const open = openCells(); if (!open.length) return;
    if (!payHint(60)) return;
    const w = open[Math.random() * open.length | 0]; game.found.add(w[0]); learn(w[0]); revealWord(w, true); Sound.ok();
    game.usedHint = true; st.stats.hints++; toast(w[0], glossHtml(w[0]), w[0]); updProg(); persist();
    if (game.lv.w.every(x => game.found.has(x[0]))) setTimeout(win, 1000);
  }
  $('bHint').onclick = () => hintLetter(false);
  $('bWord').onclick = hintWord;
  $('bAd').onclick = () => {
    Sound.click();
    if (!canAd()) return toast('🎬', T('adFail'));  // button kept visible on purpose; plain web has no ad network
    modal(`<div style="font-size:48px">🎬</div><h2>${T('adTitle')}</h2><div class="sub">${T('adInfo')}</div>
      <div style="text-align:center"><button class="big green" id="adGo">🎬 ${T('adWatch')}</button></div>`, { center: true });
    $('adGo').onclick = async () => {
      closeModal();
      const ok = await withAd(() => Platform.ads.showRewarded());
      if (ok) hintLetter(true); else toast(T('adFail'));
    };
  };
  $('bShuffle').onclick = () => { Sound.click(); const a = game.letters; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } buildWheel(true); };
  $('bJar').onclick = () => openJar();
  $('gBack').onclick = () => { Sound.click(); goHome(); };

  function win() {
    if (!$('modal').hidden && $('sheet').dataset.kind === 'win') return;
    const lv = game.lv, isDaily = game.kind === 'daily';
    let reward = isDaily ? 40 : 10 + Math.max(0, lv.l.length - 5) * 2;
    if (!game.usedHint) { st.stats.noHint++; quest('nohint', 1); }
    st.stats.levels++; quest('levels', 1);
    if (isDaily) { if (!st.dailyDone[dayKey()]) { st.dailyDone[dayKey()] = 1; st.stats.daily++; quest('daily', 1); } else reward = 0; }
    else { if (st.done[game.id]) reward = 2; st.done[game.id] = 1; if (game.id === st.level) st.level++; }
    st.cur = null; save();
    Platform.leaderboard.available && Platform.leaderboard.submit('levels', st.level);
    Sound.win(); haptic(40); confetti();
    const titles = [T('win1'), T('win2'), T('win3'), T('win4')];
    const s = modal(`<div style="font-size:44px">🌻</div><h2>${titles[(game.id + 1) % 4]}</h2>
      <div class="sub">${isDaily ? T('daily') : T('level') + ' ' + (game.id + 1)} ${T('passed')}${reward ? ' · +' + reward + ' <i class="coin"></i>' : ''}</div>
      <ul class="list">${lv.w.map(x => `<li data-w="${esc(x[0])}"><b>${esc(x[0])}</b><span class="gl">${glossHtml(x[0])}</span>📖</li>`).join('')}</ul>
      ${reward > 2 && canAd() ? `<button class="big blue" id="wDouble" style="white-space:nowrap">🎬 ${T('adDouble')}: +${reward} <i class="coin"></i></button>` : ''}
      <button class="big" id="wNext">${isDaily ? T('ok') : T('next') + ' ➜'}</button>`, { center: true, noX: true });
    s.dataset.kind = 'win'; tutEvent('win');
    const btn = $('wNext'); setTimeout(() => addCoins(reward, btn), 400);
    const dbl = $('wDouble');
    if (dbl) dbl.onclick = async () => {   // rewarded: double the level reward (player-initiated, once per win)
      Sound.click(); dbl.disabled = true; btn.disabled = true;
      const ok = await withAd(() => Platform.ads.showRewarded());
      btn.disabled = false;
      if (ok) { addCoins(reward, dbl); Sound.reward(); dbl.innerHTML = '✓ ' + T('adDoubled'); } else { dbl.disabled = false; toast('🎬', T('adFail')); }
    };
    btn.onclick = () => {
      Sound.click(); s.dataset.kind = ''; closeModal();
      const ch = chapterOf(game.id);
      if (!isDaily && game.id + 1 === ch.end && !st.chests[ch.n]) return openChest(ch, () => afterWin(isDaily));
      afterWin(isDaily);
    };
    checkAch();
  }
  async function afterWin(isDaily) {
    if (tutActive() && TUT[st.tut.step].scr === 'home') return goHome();  // tutorial continues on the home screen
    await maybeInterstitial();
    if (isDaily) return goHome();
    if (st.level >= LEVELS.length) { toast(T('allDone')); return goHome(); }
    startGame('main', st.level);
  }
  function openChest(ch, then) {
    st.chests[ch.n] = 1; st.stats.chests++; st.freeHints += 2; save();
    const s = modal(`<div style="font-size:64px;animation:pop .6s">🎁</div><h2>${T('chest')}</h2><div class="sub">${esc(chapName(ch))} — ${T('chestInfo')}</div>
      <div class="stat"><div>+50 <i class="coin"></i></div><div>+2 💡</div></div><button class="big" id="cOk">${T('claim')}</button>`, { center: true, noX: true });
    Sound.reward(); confetti(90);
    $('cOk').onclick = () => { addCoins(50, $('cOk')); setTimeout(() => { closeModal(); then && then(); }, 600); };
  }
  function openJar() {
    const full = st.jar >= 10;
    const words = [...game.bonus];
    const s = modal(`<h2>🏺 ${T('jar')}</h2><div class="sub">${T('jarInfo')}</div>
      <div class="stat"><div>${Math.min(st.jar, 10)}/10<small>${T('jar')}</small></div><div>${game.bonus.size}/${game.lv.b.length}<small>${T('bonus')}</small></div></div>
      ${full ? `<div style="text-align:center"><button class="big green" id="jClaim">${T('claim')} 25 <i class="coin"></i></button></div>` : ''}
      <ul class="list">${words.length ? words.map(w => `<li data-w="${esc(w)}"><b>${esc(w)}</b><span class="gl">${glossHtml(w)}</span></li>`).join('') : `<li>${T('noBonus')}</li>`}</ul>`);
    if (full) $('jClaim').onclick = () => { st.jar -= 10; addCoins(25, $('jClaim')); Sound.reward(); updJar(); setTimeout(closeModal, 500); };
  }
  $('sheet').addEventListener('click', e => { const li = e.target.closest('[data-w]'); if (li && li.dataset.w) openCard(li.dataset.w, glossOf(li.dataset.w)); });

  /* ================= CREDITS ================= */
  const GAME_VERSION = '0.9.3';
  function creditsHtml() {
    const ver = GAME_VERSION + (window.BUILD_V ? ' (' + window.BUILD_V + ')' : '') + (document.getElementById('testBadge') ? ' · ' + T('crTest') : '');
    return `<div class="about credits">
      <p><b>Сүз дөньясы</b> — © 2026 Михаил Пирогов, ${Platform.links ? '<a href="https://pirogovlab.ru" target="_blank" rel="noopener">PirogovLab</a>' : 'PirogovLab'}</p>
      <p><b>${T('crIdea')}:</b> Михаил Пирогов</p>
      <p><b>${T('crDict')}:</b></p>
      <ul>
        <li>Викисловарь (ru.wiktionary.org), татарские статьи: переводы, примеры, формы слов — CC BY-SA 4.0; извлечение данных — Wiktextract / kaikki.org</li>
        <li>English Wiktionary (en.wiktionary.org) — CC BY-SA 4.0 (дополнительные слова)</li>
        <li>Частоты слов: татарская Википедия (tt.wikipedia.org)</li>
      </ul>
      <p><b>${T('crMusic')}.</b></p>
      <p>${Platform.links ? '<a href="https://pirogovlab.ru/suz-donyasy/privacy/" target="_blank" rel="noopener">Политика конфиденциальности</a>' : 'Политика конфиденциальности — на сайте PirogovLab'}</p>
      <p>${LEVELS.length} ${T('levels')} · ${CHAPTERS.length} ${T('chapter').toLowerCase()} · ${T('crVersion')} ${esc(ver)} · ${Platform.name}</p></div>`;
  }

  /* ================= SHARE CARD IMAGE ================= */
  const SHARE_URL = Platform.shareUrl || '';
  const POS = { 'сущ.': 'существительное', 'прил.': 'прилагательное', 'нареч.': 'наречие', 'числ.': 'числительное', 'мест.': 'местоимение', 'межд.': 'междометие', 'послелог': 'послелог', 'частица': 'частица', 'союз': 'союз' };
  function posOf(c) {
    if (!c) return '';
    const g = (c.g || '').trim();
    if (/^-?ам\b/.test(g)) return 'глагол · I спряжение';
    if (/^-?ем\b/.test(g)) return 'глагол · II спряжение';
    const lab = ((c.m[0] && c.m[0][0] && c.m[0][0].l) || '').toLowerCase();
    for (const k in POS) if (lab.includes(k)) return POS[k];
    return '';
  }
  const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const cssUrl = u => (u || '').replace(/^url\("?/, '').replace(/"?\)$/, '');
  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/), lines = []; let cur = '';
    for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  async function shareCanvas(w, c, g, kicker) {
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    const FONT = '"Nunito","Segoe UI",Roboto,"Noto Sans",Arial,sans-serif';
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
    const ch = game.lv && screen === 'game' && game.kind === 'main' ? chapterOf(game.id) : chapterOf(Math.min(st.level, LEVELS.length - 1));
    // background: painted art (same-origin only; file:// would taint the canvas) else procedural SVG
    let bg = null;
    if (location.protocol !== 'file:' && bgFile(ch.theme, ch.n)) bg = await loadImg('img/bg/' + bgFile(ch.theme, ch.n) + '.webp' + (window.BUILD_V ? '?v=' + window.BUILD_V : ''));
    if (!bg) bg = await loadImg(cssUrl(Art.bg(ch.theme, ch.n)));
    ctx.fillStyle = '#0f2e2a'; ctx.fillRect(0, 0, W, H);
    if (bg) { const s = Math.max(W / bg.width, H / bg.height), bw = bg.width * s, bh = bg.height * s; ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh); }
    let gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(4,26,24,.15)'); gr.addColorStop(.45, 'rgba(4,26,24,.35)'); gr.addColorStop(1, 'rgba(4,26,24,.8)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // ornament bands
    const orn = await loadImg(cssUrl(Art.ornament('#e9b949', '#b8202f', 36)));
    const band = (y) => { if (!orn) return; ctx.save(); ctx.globalAlpha = .95; ctx.fillStyle = ctx.createPattern(orn, 'repeat-x'); ctx.translate(0, y); ctx.fillRect(0, 0, W, 36); ctx.restore(); };
    band(40); band(H - 44);
    // logo
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    ctx.font = `900 92px ${FONT}`; ctx.fillText('Сүз дөньясы', W / 2, 190);
    ctx.font = `700 34px ${FONT}`; ctx.fillStyle = '#ffe07a'; ctx.fillText(kicker || 'Мир татарских слов', W / 2, 245);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // content block, measured first so the glass panel fits it and sits centred between logo and link
    const px = 70, pw = W - 140, tx = px + 64, tw = pw - 128;
    const senses = c ? c.m.flat().filter(x => x.d && x.d.length > 1).slice(0, 3) : [];
    const means = senses.length ? senses.map(x => x.d.replace(/[.;,]\s*$/, '')) : [g ? g[0] : T('noTr')];
    const ex = c ? c.m.flat().map(x => (x.e || [])[0]).find(e => e && e[0] && e[1] && e[0].length < 120) : null;
    const pos = posOf(c) || (c && c.g ? 'спр. ' + c.g : '');
    const head = (c && c.s) || w, hsize = head.length > 12 ? 84 : head.length > 9 ? 100 : 120;
    function body(draw, y0) {
      let y = y0 + 40 + hsize; const T2 = (txt, x, yy) => draw && ctx.fillText(txt, x, yy);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffe07a'; ctx.font = `900 ${hsize}px ${FONT}`; T2(head, W / 2, y);
      y += 62; if (pos) { ctx.font = `italic 600 34px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.75)'; T2(pos, W / 2, y); y += 30; }
      if (draw) { ctx.strokeStyle = 'rgba(248,201,79,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W / 2 - 90, y); ctx.lineTo(W / 2 + 90, y); ctx.stroke(); }
      y += 70; ctx.textAlign = 'left';
      means.forEach((m, k) => { ctx.font = `700 42px ${FONT}`; ctx.fillStyle = '#fff';
        wrap(ctx, (means.length > 1 ? (k + 1) + '. ' : '') + m, tw).slice(0, 2).forEach(l => { T2(l, tx, y); y += 54; }); y += 8; });
      if (ex) {
        y += 22; const top = y - 40;
        ctx.font = `italic 600 36px ${FONT}`; ctx.fillStyle = '#ffe9a8'; wrap(ctx, ex[0].replace(/[;,]\s*$/, ''), tw - 30).slice(0, 2).forEach(l => { T2(l, tx + 30, y); y += 46; });
        ctx.font = `500 34px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.82)'; wrap(ctx, ex[1].replace(/[;,]\s*$/, ''), tw - 30).slice(0, 2).forEach(l => { T2(l, tx + 30, y); y += 44; });
        if (draw) { ctx.fillStyle = '#f8c94f'; ctx.fillRect(tx, top, 6, y - top - 30); }
      }
      y += 20; ctx.textAlign = 'center'; ctx.font = `600 24px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.55)';
      T2('Викисловарь, CC BY-SA 4.0', W / 2, y);
      return y + 46;
    }
    const ph = Math.min(880, body(false, 0)), py = 290 + Math.max(0, (880 - ph) / 2);
    ctx.save(); rrect(ctx, px, py, pw, ph, 48); ctx.fillStyle = 'rgba(6,40,34,.72)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.stroke(); ctx.restore();
    ctx.save(); rrect(ctx, px, py, pw, ph, 48); ctx.clip(); body(true, py); ctx.restore();
    // footer link pill
    ctx.font = `800 40px ${FONT}`; const link = SHARE_URL ? SHARE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'Сүз дөньясы', lw = ctx.measureText(link).width + 80;
    rrect(ctx, (W - lw) / 2, 1186, lw, 70, 35); ctx.fillStyle = '#f8c94f'; ctx.fill(); ctx.fillStyle = '#3b2300'; ctx.fillText(link, W / 2, 1235);
    ctx.font = `700 26px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText('PirogovLab · Михаил Пирогов', W / 2, 1290);
    return cv;
  }
  async function shareWord(w, c, g, kicker) {
    if (c === undefined) c = await withCard(w);
    const cv = await shareCanvas(w, c, g, kicker);
    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    const first = c && c.m.flat().find(x => x.d);
    const url = SHARE_URL ? SHARE_URL + '#word=' + encodeURIComponent(w) : '';
    const text = `${(c && c.s) || w} — ${first ? first.d : (g ? g[0] : '')}\nСүз дөньясы — татарская игра в слова`;
    const r = await Platform.shareImage({ blob, filename: 'suz-donyasy-' + w + '.png', title: 'Сүз дөньясы: ' + w, text, url });
    if (r === 'downloaded') toast(T('shareSaved'), T('shareCopied'));
    quest('share', 1); save();
    return r;
  }
  function openFromHash() {
    const m = /(?:^#|&)word=([^&]+)/.exec(location.hash || ''); if (!m) return;
    let w; try { w = decodeURIComponent(m[1]).toLowerCase().trim(); } catch (e) { return; }
    if (w) openCard(w);
  }
  window.addEventListener('hashchange', openFromHash);
  // the page itself must never scroll (focus / scrollIntoView on small screens could shift the whole UI up)
  document.body.addEventListener('scroll', () => { if (document.body.scrollTop) document.body.scrollTop = 0; }, { passive: true });

  /* ================= WORD CARD ================= */
  function cardHtml(w, c, g) {
    let h = '<h2>' + esc(c && c.s ? c.s : w) + '</h2>';
    const meta = []; if (c && c.g) meta.push(esc(c.g));
    if (meta.length) h += '<div class="meta">' + meta.join(' · ') + '</div>';
    if (c) {
      c.m.forEach((hom, hi) => {
        if (c.m.length > 1) h += '<div class="homn">' + ['I', 'II', 'III'][hi] + '</div>';
        hom.forEach(s => {
          const sub = String(s.n).includes(')');
          h += '<div class="sense"' + (sub ? ' style="margin-left:12px"' : '') + '>' + (hom.length > 1 ? '<span class="num">' + (sub ? String(s.n).split('.').pop() : s.n + '.') + '</span>' : '') + (s.l ? '<span class="lab">' + esc(s.l) + '</span> ' : '') + esc(s.d) + '</div>';
          (s.e || []).forEach(e => { h += '<div class="ex"><i>' + esc(e[0]) + '</i>' + (e[1] ? '<span>' + esc(e[1]) + '</span>' : '') + (e[2] ? '<small>' + esc(e[2]) + '</small>' : '') + '</div>'; });
        });
      });
      (c.x || []).forEach(x => { h += '<div class="xtra"><b>' + esc(x.k) + ':</b> ' + x.i.map(esc).join(', ') + '</div>'; });
      const src = 'Викисловарь (ru.wiktionary.org), CC BY-SA 4.0';
      h += '<div class="csrc">' + T('source') + ': ' + src + '</div>';
    } else {
      h += '<div class="sense">' + (g ? (g[1] === 'en' ? '<span class="lab">(англ.)</span> ' : '') + esc(g[0]) : T('noCard')) + '</div>';
      if (g) h += '<div class="csrc">' + T('source') + ': ' + (g[1] === 'en' ? 'en.wiktionary.org' : g[1] === 'ud' ? 'ru.wiktionary.org' : 'ru.wiktionary.org') + '</div>';
    }
    return h;
  }
  function openCard(w, g) {
    if (!g && st.learned[w] && st.learned[w].g) g = [st.learned[w].g, st.learned[w].s];
    withCard(w).then(c => {
      $('cardSheet').innerHTML = '<button class="x" data-cclose>✕</button>' + cardHtml(w, c, g) + `<div class="cardBtns"><button class="big blue" id="cShare">📤 ${T('share')}</button><button class="big" data-cclose>${T('ok')}</button></div>`;
      $('cShare').onclick = () => { Sound.click(); shareWord(w, c, g); };
      $('cardSheet').style.setProperty('--orn', Art.ornament('#e9b949', '#b8202f', 10));
      $('cardModal').hidden = false; $('cardSheet').scrollTop = 0; gp(); tutEvent('card');
      st.stats.cards++; quest('cards', 1); save(); checkAch();
    });
  }
  $('cardModal').addEventListener('click', e => { if (e.target.id === 'cardModal' || e.target.closest('[data-cclose]')) { Sound.click(); $('cardModal').hidden = true; gp(); } });

  /* ================= DAILY SYSTEMS ================= */
  const REWARDS = [10, 15, 20, 25, 30, 40, 'chest'];
  function touchStreak() {
    const today = dayKey(), y = new Date(); y.setDate(y.getDate() - 1);
    if (st.streak.last === today) return;
    st.streak.count = st.streak.last === dayKey(y) ? st.streak.count + 1 : 1;
    st.streak.best = Math.max(st.streak.best, st.streak.count); st.streak.last = today; save();
  }
  const rewardDay = () => (st.streak.count - 1) % 7;
  const rewardAvailable = () => st.streak.claimed !== dayKey();
  function openRewards() {
    const di = rewardDay();
    const cells = REWARDS.map((r, i) => { const cls = i < di || (i === di && !rewardAvailable()) ? 'got' : i === di ? 'today' : '';
      return `<div class="d ${cls} ${r === 'chest' ? 'chest' : ''}">${T('day')} ${i + 1}<span class="ic">${r === 'chest' ? '🎁' : '<i class="coin lg"></i>'}</span>${r === 'chest' ? '60 + 2💡' : r}</div>`; }).join('');
    modal(`<h2>📅 ${T('rewardsTitle')}</h2><div class="sub">🔥 ${st.streak.count} ${T('streak')} · ${T('rewardsInfo')}</div><div class="cal">${cells}</div>
      <div style="text-align:center"><button class="big green" id="rClaim" ${rewardAvailable() ? '' : 'disabled'}>${rewardAvailable() ? T('claim') : T('claimed')}</button></div>`);
    $('rClaim').onclick = () => {
      if (!rewardAvailable()) return;
      const r = REWARDS[di]; st.streak.claimed = dayKey();
      if (r === 'chest') { st.freeHints += 2; addCoins(60, $('rClaim')); confetti(80); } else addCoins(r, $('rClaim'));
      Sound.reward(); save(); setTimeout(() => { openRewards(); renderHome(); }, 700);
    };
  }
  /* quests */
  const QUESTS = [
    { t: 'bonus', n: 3, r: 20, ic: '🏺' }, { t: 'bonus', n: 6, r: 35, ic: '🏺' }, { t: 'levels', n: 2, r: 20, ic: '⭐' }, { t: 'levels', n: 4, r: 40, ic: '⭐' },
    { t: 'daily', n: 1, r: 30, ic: '🌅' }, { t: 'cards', n: 3, r: 15, ic: '📖' }, { t: 'words', n: 15, r: 20, ic: '🔤' }, { t: 'words', n: 30, r: 35, ic: '🔤' },
    { t: 'nohint', n: 1, r: 25, ic: '🧠' }, { t: 'combo', n: 3, r: 20, ic: '⚡' },
  ];
  function ensureQuests() {
    const k = dayKey(); if (st.quests.date === k) return;
    const r = seeded(dayNum(k)); const pool = QUESTS.map((q, i) => i); const pick = [];
    while (pick.length < 3 && pool.length) { const i = pool.splice(r() * pool.length | 0, 1)[0]; if (!pick.some(j => QUESTS[j].t === QUESTS[i].t)) pick.push(i); }
    st.quests = { date: k, list: pick, prog: {}, claimed: {} }; save();
  }
  function quest(type, inc, value) {
    ensureQuests();
    st.quests.list.forEach(i => { const q = QUESTS[i]; if (q.t !== type) return; const p = st.quests.prog[i] || 0;
      st.quests.prog[i] = value != null ? Math.max(p, value) : p + inc; });
  }
  const questsReady = () => { ensureQuests(); return st.quests.list.filter(i => (st.quests.prog[i] || 0) >= QUESTS[i].n && !st.quests.claimed[i]).length; };
  function openQuests() {
    ensureQuests();
    const html = st.quests.list.map(i => { const q = QUESTS[i], p = Math.min(st.quests.prog[i] || 0, q.n), done = p >= q.n, got = st.quests.claimed[i];
      return `<div class="q ${got ? 'done' : ''}"><span class="ic">${q.ic}</span><div class="t">${esc(T('quest_' + q.t).replace('{n}', q.n))}<div class="pb"><i style="width:${100 * p / q.n}%"></i></div></div>
        ${got ? '✓' : done ? `<button data-q="${i}">+${q.r}</button>` : `<span class="r">${p}/${q.n}</span>`}</div>`; }).join('');
    const s = modal(`<h2>🎯 ${T('questsTitle')}</h2><div class="sub">${T('questsInfo')}</div>${html}`);
    s.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const i = +b.dataset.q; if (st.quests.claimed[i]) return; st.quests.claimed[i] = 1; addCoins(QUESTS[i].r, b); Sound.reward(); save(); setTimeout(() => { openQuests(); renderHome(); }, 600); });
  }
  /* achievements */
  const ACH = [
    ['l10', '⭐', 'Уровень 10', s => s.level >= 10], ['l50', '🌟', 'Уровень 50', s => s.level >= 50], ['l100', '🏅', 'Уровень 100', s => s.level >= 100],
    ['l250', '🥈', 'Уровень 250', s => s.level >= 250], ['l500', '🥇', 'Уровень 500', s => s.level >= 500], ['lall', '👑', 'Все уровни', s => s.level >= LEVELS.length],
    ['w100', '🔤', '100 слов', s => Object.keys(s.learned).length >= 100], ['w500', '📚', '500 слов', s => Object.keys(s.learned).length >= 500], ['w1000', '🎓', '1000 слов', s => Object.keys(s.learned).length >= 1000],
    ['b25', '🏺', '25 бонусов', s => s.stats.bonus >= 25], ['b200', '💎', '200 бонусов', s => s.stats.bonus >= 200], ['c5', '⚡', 'Комбо ×5', s => s.stats.comboMax >= 5],
    ['s3', '🔥', '3 дня подряд', s => s.streak.best >= 3], ['s7', '🔥', 'Неделя подряд', s => s.streak.best >= 7], ['s30', '🌋', 'Месяц подряд', s => s.streak.best >= 30],
    ['d1', '🌅', 'Первая задача дня', s => s.stats.daily >= 1], ['d10', '🌄', '10 задач дня', s => s.stats.daily >= 10], ['k20', '📖', '20 карточек', s => s.stats.cards >= 20],
    ['nh10', '🧠', '10 уровней без подсказок', s => s.stats.noHint >= 10], ['ch3', '🎁', '3 главы', s => s.stats.chests >= 3], ['ch10', '🗺️', '10 глав', s => s.stats.chests >= 10],
  ];
  function checkAch() {
    ACH.forEach(([id, ic, name, f]) => { if (!st.ach[id] && f(st)) { st.ach[id] = dayNum(); save(); setTimeout(() => { toast('🏆 ' + name, T('achievements')); Sound.reward(); }, 1200); } });
  }
  function openAch() {
    const n = ACH.filter(a => st.ach[a[0]]).length;
    modal(`<h2>🏆 ${T('achTitle')}</h2><div class="sub">${n}/${ACH.length}</div><div class="ach">${ACH.map(([id, ic, name]) => `<div class="a ${st.ach[id] ? 'got' : ''}"><span class="ic">${ic}</span>${esc(name)}</div>`).join('')}</div>`);
  }
  /* spin */
  const PRIZES = [{ c: 10 }, { c: 20 }, { h: 1 }, { c: 15 }, { c: 50 }, { c: 25 }, { h: 2 }, { c: 30 }];
  const spinAvailable = () => st.spin.last !== dayKey();
  const AD_SPINS = 3;  // extra spins for a rewarded ad per day
  const adSpinsLeft = () => AD_SPINS - (st.spin.adDay === dayKey() ? st.spin.adN || 0 : 0);
  // prize wheel: one SVG disk rotated as a single compositor layer (labels never transform individually)
  const SPIN_COLS = ['#b8202f', '#fbf1dc', '#0e5a3f', '#fbf1dc', '#c98a1c', '#fbf1dc', '#0e5a3f', '#fbf1dc'];
  function wheelSvg() {
    const n = PRIZES.length, R = 100, step = 360 / n, rad = d => (d - 90) * Math.PI / 180, pt = (r, d) => [r * Math.cos(rad(d)), r * Math.sin(rad(d))];
    let s = `<svg viewBox="-120 -120 240 240" class="spinDisk" id="spinDisk"><defs>
      <radialGradient id="sgShade"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>
      <radialGradient id="sgCoin" cx=".35" cy=".3"><stop offset="0" stop-color="#fff7c4"/><stop offset=".5" stop-color="#f8c94f"/><stop offset="1" stop-color="#e09a1c"/></radialGradient>
      <radialGradient id="sgHub" cx=".4" cy=".35"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e9dcc0"/></radialGradient></defs>
      <circle r="117" fill="#0e3a33"/><circle r="112" fill="none" stroke="#f8c94f" stroke-width="3"/>`;
    PRIZES.forEach((p, i) => {
      const a0 = i * step - step / 2, a1 = a0 + step, [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), gold = p.c >= 50;
      const fill = gold ? '#f8c94f' : SPIN_COLS[i % SPIN_COLS.length], dark = fill === '#fff4dc' || gold;
      s += `<path d="M0 0 L${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${fill}"/>`;
      const ink = dark ? '#3b2300' : '#ffffff';
      s += `<g transform="rotate(${i * step})">` + (p.c
        ? `<circle cx="0" cy="-74" r="9.5" fill="url(#sgCoin)" stroke="#a8670c" stroke-width="1.4"/><circle cx="0" cy="-74" r="5.5" fill="none" stroke="#c9840f" stroke-width="1"/>`
        : `<text x="0" y="-67.5" text-anchor="middle" font-size="19">💡</text>`)
        + `<text x="0" y="-45" text-anchor="middle" font-family="Nunito,system-ui,sans-serif" font-weight="900" font-size="19" fill="${ink}">${p.c ? p.c : '×' + p.h}</text></g>`;
    });
    PRIZES.forEach((p, i) => { const [x, y] = pt(R, i * step - step / 2); s += `<line x1="0" y1="0" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="#0e3a33" stroke-width="2.2"/>`; });
    s += `<circle r="${R}" fill="url(#sgShade)"/><path id="spinWin" d="" fill="#fff" opacity="0"/>`;
    for (let k = 0; k < n * 2; k++) { const [x, y] = pt(108.5, k * step / 2 - step / 2); s += `<circle class="bulb ${k % 2 ? 'b2' : 'b1'}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.6"/>`; }
    return s + `<circle r="20" fill="url(#sgHub)" stroke="#1c9a6c" stroke-width="4"/><circle r="7" fill="#1c9a6c"/></svg>`;
  }
  let spinAngle = 0;
  function openSpin() {
    const avail = spinAvailable();
    modal(`<h2>🎡 ${T('spinTitle')}</h2><div class="sub">${T('spinInfo')}</div>
      <div class="spinwrap"><div class="spinGlow"></div>${wheelSvg()}<svg class="ptr" id="spinPtr" viewBox="0 0 40 52"><path d="M20 50 L4 14 A17 17 0 1 1 36 14 Z" fill="#1c9a6c" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><circle cx="20" cy="17" r="6" fill="#fff"/></svg>
      <div class="spinPrize" id="spinPrize" hidden></div></div>
      <div style="text-align:center"><button class="big" id="spBtn" ${avail ? '' : 'disabled'}>${avail ? T('spinBtn') : T('spinTomorrow')}</button>
      ${canAd() ? `<button class="big blue" id="spAd" ${avail || adSpinsLeft() <= 0 ? 'hidden' : ''}>🎬 ${T('adSpin')}</button>` : ''}</div>`);
    const disk = $('spinDisk'); disk.style.transform = `rotate(${spinAngle % 360}deg)`;
    $('spBtn').onclick = () => {
      if (!spinAvailable()) return; st.spin.last = dayKey(); st.stats.spins++; save();
      runSpin();
    };
    const sa = $('spAd');
    if (sa) sa.onclick = async () => {
      if (adSpinsLeft() <= 0 || document.body.classList.contains('spinning')) return;
      Sound.click(); sa.disabled = true;
      const ok = await withAd(() => Platform.ads.showRewarded());
      if (!ok) { sa.disabled = false; return toast('🎬', T('adFail')); }
      const k = dayKey(); st.spin.adN = st.spin.adDay === k ? (st.spin.adN || 0) + 1 : 1; st.spin.adDay = k; st.stats.spins++; save();
      runSpin();
    };
  }
  function runSpin() {
    {
      const disk = $('spinDisk'), sa = $('spAd'); if (!disk) return; if (sa) sa.disabled = true;
      const n = PRIZES.length, step = 360 / n, i = Math.random() * n | 0; $('spBtn').disabled = true;
      const start = spinAngle % 360, jitter = (Math.random() - .5) * step * .6;
      const target = start + 360 * 6 + (((-i * step - start) % 360) + 360) % 360 + jitter;
      const D = 4600, t0 = performance.now(), ease = t => 1 - Math.pow(1 - t, 4), ptr = $('spinPtr');
      let lastPeg = Math.floor((start + step / 2) / step);
      document.body.classList.add('spinning');
      const frame = now => {
        const t = Math.min(1, (now - t0) / D), a = start + (target - start) * ease(t); spinAngle = a;
        disk.style.transform = `rotate(${a.toFixed(3)}deg)`;
        const peg = Math.floor((a + step / 2) / step);
        if (peg !== lastPeg) { lastPeg = peg; ptr.classList.remove('tick'); void ptr.getBoundingClientRect(); ptr.classList.add('tick'); if (t < .97) { Sound.tap(peg % 5); haptic(3); } }
        if (t < 1) return requestAnimationFrame(frame);
        document.body.classList.remove('spinning'); spinDone(i);
      };
      requestAnimationFrame(frame);
    }
  }
  function spinDone(i) {
    const p = PRIZES[i], step = 360 / PRIZES.length, rad = d => (d - 90) * Math.PI / 180, R = 100;
    const a0 = i * step - step / 2, a1 = a0 + step, w = $('spinWin');
    if (w) { w.setAttribute('d', `M0 0 L${R * Math.cos(rad(a0))} ${R * Math.sin(rad(a0))} A${R} ${R} 0 0 1 ${R * Math.cos(rad(a1))} ${R * Math.sin(rad(a1))} Z`); w.classList.add('win'); }
    if (p.c) addCoins(p.c, $('spBtn')); else { st.freeHints += p.h; save(); }
    Sound.reward(); haptic(30); confetti(70);
    const pz = $('spinPrize'); if (pz) setTimeout(() => { pz.innerHTML = `<div class="pi">${p.c ? '<i class="coin lg"></i>' : '💡'}</div><b>+${p.c || p.h}</b><small>${p.c ? T('coinsWon') : T('hintsWon')}</small>`; pz.hidden = false; }, 1100);
    const btn = $('spBtn'); if (btn) { btn.textContent = T('spinTomorrow'); btn.disabled = true; }
    const sa = $('spAd'); if (sa) { sa.hidden = adSpinsLeft() <= 0; sa.disabled = false; }
    renderHome();
  }
  /* word of the day */
  const wotdWord = () => WOTD.length ? WOTD[((dayNum() % WOTD.length) + WOTD.length) % WOTD.length] : null;
  function openWotd() {
    const w = wotdWord(); if (!w) return;
    withCard(w).then(c => {
      st.wotdSeen[dayKey()] = 1; save();
      const first = c && c.m[0] && c.m[0][0] ? c.m[0].find(s => s.d) || c.m[0][0] : null;
      learn(w, first && first.d ? [first.d, 'ud'] : null); save();
      modal(`<h2>☀️ ${T('wotd')}</h2><div class="sub">${T('wotdInfo')}</div><div style="text-align:center"><div class="wotdbig">${esc(c && c.s ? c.s : w)}</div>
        </div><div class="wcard">${cardHtml(w, c, null).replace(/<h2>.*?<\/h2>/, '')}</div>
        <div style="text-align:center"><button class="big" id="wShare">📤 ${T('share')}</button></div>`);
      $('wShare').onclick = () => shareWord(w, c, null, T('wotd'));
      st.stats.cards++; quest('cards', 1); save(); renderHome();
    });
  }
  /* collection */
  function openCollection(filter, q) {
    const all = Object.keys(st.learned).sort((a, b) => a.localeCompare(b, 'ru'));
    const letters = [...new Set(all.map(w => w[0]))];
    let list = all; if (filter) list = list.filter(w => w[0] === filter); if (q) list = list.filter(w => w.includes(q.toLowerCase()) || (st.learned[w].g || '').toLowerCase().includes(q.toLowerCase()));
    const s = modal(`<div class="coll"><h2>📚 ${T('collTitle')}</h2><div class="stat"><div>${all.length}<small>${T('learned')}</small></div><div>${st.stats.cards}<small>📖</small></div><div>${st.level}<small>${T('level')}</small></div></div>
      <input id="cSearch" placeholder="${T('search')}" value="${esc(q || '')}"><div class="letters">${letters.map(l => `<button data-l="${esc(l)}" class="${l === filter ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
      <ul class="list">${list.slice(0, 300).map(w => `<li data-w="${esc(w)}"><b>${esc(w)}</b><span class="gl">${st.learned[w].g ? (st.learned[w].s === 'en' ? '<span class="en">' + esc(st.learned[w].g) + '</span>' : esc(st.learned[w].g)) : ''}</span>📖</li>`).join('') || `<li>${T('noBonus')}</li>`}</ul></div>`);
    s.querySelectorAll('[data-l]').forEach(b => b.onclick = () => openCollection(b.dataset.l === filter ? null : b.dataset.l, q));
    const inp = $('cSearch'); inp.onchange = () => openCollection(filter, inp.value);
  }
  /* settings */
  function openSettings() {
    const sw = (id, on) => `<button class="sw ${on ? 'on' : ''}" id="${id}"></button>`;
    modal(`<h2>⚙️ ${T('settings')}</h2>
      <div class="row">${T('sound')} ${sw('sSound', st.settings.sound)}</div>
      <div class="row">${T('vibration')} ${sw('sVib', st.settings.vib)}</div>
      ${HAS_MUSIC ? `<div class="row">${T('music')} ${sw('sMusic', musicOn())}</div>
      <div class="row">${T('musicVol')} <input type="range" id="sMusicVol" min="0" max="100" step="5" value="${Math.round(musicVol() * 100)}" ${musicOn() ? '' : 'disabled'}></div>` : ''}
      <div class="row">${T('howTo')} <button class="ghost" id="sHowTo">▶ ${T('howTo')}</button></div>
      <div class="row">${T('about')}</div>${creditsHtml()}
      <div style="text-align:center;margin-top:12px"><button class="ghost" id="sReset">${T('reset')}</button></div>`);
    $('sSound').onclick = () => { st.settings.sound = !st.settings.sound; Sound.enabled = st.settings.sound; save(); openSettings(); Sound.click(); };
    if (HAS_MUSIC) $('sMusic').onclick = () => { st.settings.music = !musicOn(); save(); Music.unlock(); Music.setEnabled(musicOn()); updMusicBtn(); openSettings(); Sound.click(); };
    if (HAS_MUSIC) $('sMusicVol').oninput = e => { st.settings.musicVol = e.target.value / 100; Music.setVolume(st.settings.musicVol); };
    if (HAS_MUSIC) $('sMusicVol').onchange = () => save();
    $('sVib').onclick = () => { st.settings.vib = !st.settings.vib; save(); haptic(20); openSettings(); };
    $('sHowTo').onclick = () => { Sound.click(); closeModal(); tutReplay(); };
    $('sReset').onclick = () => { if (confirm(T('resetQ'))) { const keep = st.settings; st = fresh(); st.settings = keep; touchStreak(); save(); closeModal(); renderHome(); updBanner(); tutStart(); } };
  }
  /* daily puzzle */
  function openDaily() {
    const done = !!st.dailyDone[dayKey()];
    const lv = DAILY[dailyIndex()];
    modal(`<h2>🌅 ${T('dailyTitle')}</h2><div class="sub">${dayKey()} · ${T('dailyInfo')}</div>
      <div style="text-align:center;font-size:30px;font-weight:900;letter-spacing:6px;text-transform:uppercase;margin:12px 0">${lv ? esc(Array.from(lv.l).map(() => '?').join('')) : ''}</div>
      <div class="sub">${lv ? lv.l.length + ' букв · ' + lv.w.length + ' слов' : ''} · ${T('dailyReward')}</div>
      <div style="text-align:center"><button class="big ${done ? 'green' : ''}" id="dGo">${done ? T('solved') + ' ✓' : T('playDaily')}</button></div>`, { center: true });
    $('dGo').onclick = () => { closeModal(); if (!done) startGame('daily', dailyIndex()); };
  }

  /* ================= HOME & MAP ================= */
  function applyLang() {
    $('tTitle').textContent = T('title'); $('hBrand').textContent = T('brand'); if (!Platform.links) { $('hBrand').removeAttribute('href'); $('hBrand').removeAttribute('target'); } $('tSub').textContent = T('subtitle'); $('hPlayTxt').textContent = T('play'); $('mTitle').textContent = T('map');
    document.documentElement.lang = 'ru'; renderHome();
  }
  function renderHome() {
    ensureQuests(); refreshCoins();
    $('hStreak').querySelector('b').textContent = st.streak.count;
    const i = Math.min(st.level, LEVELS.length - 1), ch = chapterOf(i);
    $('hPlayLvl').textContent = st.level >= LEVELS.length ? T('allDone') : T('level') + ' ' + (st.level + 1);
    $('hChapter').innerHTML = `🗺️ ${T('chapter')} ${ch.n}: <b>${esc(chapName(ch))}</b> · ${Math.max(0, st.level + 1 - ch.start)}/${ch.end - ch.start + 1}`;
    const dDone = !!st.dailyDone[dayKey()], w = wotdWord();
    const dot = c => c ? '<span class="dot"></span>' : '';
    $('hTiles').innerHTML = `
      <button class="tile wide" id="tDaily">${dot(!dDone)}<span class="ic">🌅</span><span><b>${T('daily')}</b><small>${dDone ? T('dailyDone') : dayKey()}</small></span></button>
      <button class="tile wide" id="tWotd">${dot(!st.wotdSeen[dayKey()])}<span class="ic">☀️</span><span><b>${T('wotd')}</b><small style="text-transform:uppercase">${w ? esc(w) : ''}</small></span></button>
      <button class="tile" id="tRewards">${dot(rewardAvailable())}<span class="ic">📅</span>${T('rewards')}</button>
      <button class="tile" id="tQuests">${dot(questsReady())}<span class="ic">🎯</span>${T('quests')}</button>
      <button class="tile" id="tSpin">${dot(spinAvailable())}<span class="ic">🎡</span>${T('spin')}</button>
      <button class="tile" id="tMap"><span class="ic">🗺️</span>${T('map')}</button>
      <button class="tile wide" id="tColl"><span class="ic">📚</span><span><b>${T('collection')}</b><small>${Object.keys(st.learned).length} ${T('learned')}</small></span></button>
      <button class="tile" id="tAch"><span class="ic">🏆</span>${T('achievements')}</button>
      <button class="tile" id="tJarH"><span class="ic">🏺</span>${T('jar')} ${Math.min(st.jar, 10)}/10</button>`;
    const on = (id, f) => { $(id).onclick = () => { Sound.unlock(); Sound.click(); f(); }; };
    on('tDaily', openDaily); on('tWotd', openWotd); on('tRewards', openRewards); on('tQuests', openQuests); on('tSpin', openSpin);
    on('tMap', openMap); on('tColl', () => openCollection()); on('tAch', openAch);
    on('tJarH', () => { modal(`<h2>🏺 ${T('jar')}</h2><div class="sub">${T('jarInfo')}</div><div class="stat"><div>${Math.min(st.jar, 10)}/10</div></div>` + (st.jar >= 10 ? `<div style="text-align:center"><button class="big green" id="jc2">${T('claim')} 25 <i class="coin"></i></button></div>` : ''));
      if (st.jar >= 10) $('jc2').onclick = () => { st.jar -= 10; addCoins(25, $('jc2')); Sound.reward(); setTimeout(() => { closeModal(); renderHome(); }, 500); }; });
    $('hSettings').onclick = () => { Sound.click(); openSettings(); };
    if (!HAS_MUSIC) $('hMusic').style.display = 'none';
    $('hMusic').onclick = () => { st.settings.music = !musicOn(); save(); Music.unlock(); Music.setEnabled(musicOn()); updMusicBtn(); Sound.click(); toast(musicOn() ? '🎵 ' + T('musicOn') : '🔇 ' + T('musicOff')); };
    updMusicBtn();
    $('hStreak').onclick = () => { Sound.click(); openRewards(); };
    $('hChapter').onclick = () => { Sound.click(); openMap(); };
    $('hPlay').onclick = () => { Sound.unlock(); Sound.click(); if (st.level >= LEVELS.length) return toast(T('allDone')); startGame('main', st.level); };
  }
  function goHome() { show('home'); renderHome(); }
  function openMap() {
    show('map');
    const list = $('mList'); const curCh = chapterOf(Math.min(st.level, LEVELS.length - 1)).n;
    list.innerHTML = CHAPTERS.map(c => {
      const done = clamp(st.level + 1 - c.start, 0, c.end - c.start + 1), total = c.end - c.start + 1, locked = st.level + 1 < c.start;
      return `<button class="chap ${locked ? 'locked' : ''} ${c.n === curCh ? 'cur' : ''}" data-ch="${c.n}">
        <div class="in"><b>${esc(c.tt)}</b><small>${esc(c.ru)} · ${T('level')} ${c.start}–${c.end}</small><div class="bar"><i style="width:${100 * done / total}%"></i></div></div><span class="num">${c.n}</span></button>`;
    }).join('');
    list.querySelectorAll('[data-ch]').forEach(b => { const c = CHAPTERS[b.dataset.ch - 1]; paintBg(b, c.theme, c.n, null, true); });
    list.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { Sound.click(); const c = CHAPTERS[b.dataset.ch - 1]; if (st.level + 1 < c.start) { toast('🔒 ' + T('locked')); return; } openChapter(c); });
    const cur = list.querySelector('.cur'); if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center' }), 50);
  }
  function openChapter(c) {
    let h = '';
    for (let i = c.start - 1; i < c.end; i++) h += `<button class="lvl ${i < st.level ? 'done' : i === st.level ? 'cur' : 'lock'}" data-lv="${i}">${i + 1}</button>`;
    const s = modal(`<h2>${esc(c.tt)}</h2><div class="sub">${esc(c.ru)} · ${T('chapter')} ${c.n}</div><div class="lvlgrid">${h}</div>`);
    s.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { const i = +b.dataset.lv; if (i > st.level) return; closeModal(); startGame('main', i); });
  }
  $('mBack').onclick = () => { Sound.click(); goHome(); };

  /* ================= TUTORIAL (interactive coach marks) =================
   * Shown once on first launch (st.tut, saved locally + cloud), replay from Settings → «Как играть».
   * Steps run on the real UI: a spotlight hole over the target, blockers everywhere else, a bubble with text,
   * «Пропустить» always, «Дальше» only where no action is needed. No ads until st.tut.done. */
  const TUT = [
    { id: 'play', scr: 'home', el: () => [$('hPlay')], act: 'click' },
    { id: 'swipe', scr: 'game', el: () => [$('wheel')], act: 'word', finger: true },
    { id: 'grid', scr: 'game', el: () => tutCells(), act: 'next' },
    { id: 'shuffle', scr: 'game', el: () => [$('bShuffle')], act: 'click' },
    { id: 'hint', scr: 'game', el: () => [$('bHint')], act: 'click' },
    { id: 'coins', scr: 'game', el: () => [$('gCoins')], act: 'next' },
    { id: 'ad', scr: 'game', el: () => [$('bAd')], act: 'next', skip: () => !isShown($('bAd')) },
    { id: 'bonus', scr: 'game', el: () => [$('bJar')], act: 'next' },
    { id: 'card', scr: 'game', el: () => tutCells(), act: 'card' },
    { id: 'free', scr: 'game', el: () => [], act: 'next' },
    { id: 'wait', scr: 'game', act: 'win', hidden: true },  // the player finishes the level alone
    { id: 'map', scr: 'home', el: () => [$('tMap')], act: 'next' },
    { id: 'daily', scr: 'home', el: () => [$('tDaily')], act: 'next' },
    { id: 'spin', scr: 'home', el: () => [$('tSpin')], act: 'next' },
    { id: 'rewards', scr: 'home', el: () => [$('tRewards')], act: 'next' },
    { id: 'end', scr: 'home', el: () => [$('hPlay')], act: 'click' },
  ];
  const tutIdx = id => TUT.findIndex(s => s.id === id);
  const isShown = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const tutActive = () => !!(st.tut && !st.tut.done && TUT[st.tut.step]);
  function tutCells() {
    if (!game.lv) return [];
    const w = game.lv.w.find(x => x[0] === game.lastFound) || game.lv.w.find(x => game.found.has(x[0]));
    return w ? cellsOf(w).map(([r, c]) => game.cells[r + ',' + c].el) : [$('grid')];
  }
  let tutEl = null, tutRaf = 0, tutKey = '', tutFingerAnim = null, tutFingerKey = '';
  function tutDom() {
    if (tutEl) return tutEl;
    tutEl = document.createElement('div'); tutEl.id = 'tut'; tutEl.hidden = true;
    tutEl.innerHTML = '<div class="tutB" data-b="t"></div><div class="tutB" data-b="b"></div><div class="tutB" data-b="l"></div><div class="tutB" data-b="r"></div>'
      + '<div class="tutB" data-b="c"></div><div class="tutHole"></div><svg class="tutPath"><path/></svg><div class="tutFinger"><i></i><b>👆</b></div>'
      + `<div class="tutTip" role="dialog" aria-live="polite"><div class="tutTx"></div><div class="tutBtns"><button class="tutSkip" id="tutSkip">${T('skip')}</button>`
      + `<button class="tutNext" id="tutNext">${T('next')} ➜</button></div><div class="tutN"></div></div>`;
    document.body.appendChild(tutEl);
    $('tutSkip').onclick = () => { Sound.click(); tutSkip(); };
    $('tutNext').onclick = () => { Sound.click(); tutAdvance(); };
    return tutEl;
  }
  function tutStart() { if (!tutActive()) return; tutDom(); tutKey = ''; if (!tutRaf) tutRaf = requestAnimationFrame(tutFrame); }
  function tutStop() { if (tutRaf) cancelAnimationFrame(tutRaf); tutRaf = 0; if (tutEl) tutEl.hidden = true; if (tutFingerAnim) { tutFingerAnim.cancel(); tutFingerAnim = null; } tutFingerKey = ''; }
  function tutSet(i) {
    while (TUT[i] && TUT[i].skip && TUT[i].skip()) i++;
    if (i >= TUT.length) return tutFinish();
    st.tut.step = i; save(); tutKey = ''; tutStart();
  }
  function tutAdvance() { if (tutActive()) tutSet(st.tut.step + 1); }
  function tutFinish() { st.tut = { done: true, step: 0 }; save(); tutStop(); updBanner(); }
  function tutSkip() { tutFinish(); }
  function tutReplay() { st.tut = { done: false, step: 0 }; save(); updBanner(); goHome(); tutStart(); }
  function tutVisible() { return !!(tutEl && !tutEl.hidden); }
  // player actions reported by the game
  function tutEvent(ev) {
    if (!tutActive()) return; const s = TUT[st.tut.step];
    if (ev === 'word' && s.act === 'word') setTimeout(tutAdvance, 700);   // let the letters fly into the grid first
    else if (ev === 'card' && s.act === 'card') tutAdvance();             // bubble returns after the card is closed
    else if (ev === 'win' && st.tut.step < tutIdx('map')) tutSet(tutIdx('map'));
  }
  document.addEventListener('click', e => {   // 'click' steps: advance after the target's own handler ran
    if (!tutActive() || !tutVisible()) return; const s = TUT[st.tut.step];
    if (s.act === 'click' && s.el().some(el => el && el.contains(e.target))) setTimeout(() => { if (s.id === 'end') tutFinish(); else tutAdvance(); }, 30);
  }, true);
  function tutRect(els) {
    let L = 1e9, Tp = 1e9, Rr = -1e9, B = -1e9;
    els.forEach(el => { if (!isShown(el)) return; const r = el.getBoundingClientRect(); L = Math.min(L, r.left); Tp = Math.min(Tp, r.top); Rr = Math.max(Rr, r.right); B = Math.max(B, r.bottom); });
    if (L > Rr) return null;
    const p = 8; return { l: L - p, t: Tp - p, r: Rr + p, b: B + p };
  }
  function tutFrame() {
    tutRaf = requestAnimationFrame(tutFrame);
    if (!tutActive()) return tutStop();
    const s = TUT[st.tut.step], el = tutDom();
    const can = !s.hidden && screen === s.scr && $('modal').hidden && $('cardModal').hidden && !adShowing && !document.body.classList.contains('spinning')
      && $('scr' + s.scr[0].toUpperCase() + s.scr.slice(1)).classList.contains('on');
    if (!can) { if (!el.hidden) { el.hidden = true; tutKey = ''; } return; }
    const els = s.el(), rc = els.length ? tutRect(els) : null;
    if (rc && (rc.t < 0 || rc.b > innerHeight) && els[0] && els[0].scrollIntoView) { els[0].scrollIntoView({ block: 'center' }); return; }
    if (els.length && !rc) return;  // target not laid out yet (screen still building)
    const W = innerWidth, H = innerHeight;
    const key = s.id + '|' + W + 'x' + H + '|' + (rc ? [rc.l, rc.t, rc.r, rc.b].map(Math.round).join(',') : '-');
    el.querySelector('.tutFinger').style.opacity = game.dragging ? 0 : 1;
    el.querySelector('.tutPath').style.opacity = game.dragging ? 0 : 1;
    if (key === tutKey) return; tutKey = key;
    el.hidden = false; el.dataset.step = s.id;
    const pass = s.act !== 'next';      // the spotlighted element is interactive only for action steps
    const set = (b, x, y, w, h) => { const d = el.querySelector('[data-b="' + b + '"]'); d.style.cssText = `left:${x}px;top:${y}px;width:${Math.max(0, w)}px;height:${Math.max(0, h)}px`; };
    const hole = el.querySelector('.tutHole');
    if (rc) {
      set('t', 0, 0, W, rc.t); set('b', 0, rc.b, W, H - rc.b); set('l', 0, rc.t, rc.l, rc.b - rc.t); set('r', rc.r, rc.t, W - rc.r, rc.b - rc.t);
      set('c', rc.l, rc.t, pass ? 0 : rc.r - rc.l, pass ? 0 : rc.b - rc.t);
      const round = s.id === 'swipe' ? '50%' : '18px';
      hole.style.cssText = `left:${rc.l}px;top:${rc.t}px;width:${rc.r - rc.l}px;height:${rc.b - rc.t}px;border-radius:${round}`; hole.hidden = false;
    } else { set('t', 0, 0, W, H); ['b', 'l', 'r', 'c'].forEach(b => set(b, 0, 0, 0, 0)); hole.hidden = true; }
    el.classList.toggle('noHole', !rc);
    // bubble text + buttons
    const tip = el.querySelector('.tutTip');
    tip.querySelector('.tutTx').textContent = T('tut_' + s.id);
    $('tutNext').hidden = s.act !== 'next';
    const shownSteps = TUT.filter(x => !x.hidden), n = shownSteps.indexOf(s) + 1;
    tip.querySelector('.tutN').textContent = n + ' / ' + shownSteps.length;
    // place the bubble: below / above the hole, else beside it (landscape), else centred
    tip.style.left = tip.style.top = '0px'; tip.style.width = ''; tip.className = 'tutTip';
    let tw = tip.offsetWidth, th = tip.offsetHeight; const m = 14;
    let x, y, side = 'mid';
    if (rc) {
      const cx = (rc.l + rc.r) / 2;
      const fitSide = sp => { const w = Math.min(330, sp - m * 2); if (w < 190) return false; tip.style.width = w + 'px'; tw = tip.offsetWidth; th = tip.offsetHeight; return true; };
      if (H - rc.b >= th + m * 2) { y = rc.b + m; side = 'below'; }
      else if (rc.t >= th + m * 2) { y = rc.t - th - m; side = 'above'; }
      else if (W - rc.r >= rc.l && fitSide(W - rc.r)) { x = rc.r + m; y = (rc.t + rc.b) / 2 - th / 2; side = 'right'; }
      else if (fitSide(rc.l)) { x = rc.l - tw - m; y = (rc.t + rc.b) / 2 - th / 2; side = 'left'; }
      else if (fitSide(W - rc.r)) { x = rc.r + m; y = (rc.t + rc.b) / 2 - th / 2; side = 'right'; }
      else { tip.style.width = ''; tw = tip.offsetWidth; th = tip.offsetHeight; y = H - th - m; side = 'mid'; }
      if (x == null) x = cx - tw / 2;
      x = clamp(x, 8, W - tw - 8); y = clamp(y, 8, H - th - 8);
      tip.style.setProperty('--ax', clamp(cx - x, 24, tw - 24) + 'px');
      tip.style.setProperty('--ay', clamp((rc.t + rc.b) / 2 - y, 20, th - 20) + 'px');
    } else { x = (W - tw) / 2; y = (H - th) / 2; }
    tip.classList.add(side); tip.style.left = x + 'px'; tip.style.top = y + 'px';
    tutFinger(s, el);
  }
  // animated finger tracing the letters of a real word on the wheel
  function tutFinger(s, el) {
    const f = el.querySelector('.tutFinger'), path = el.querySelector('.tutPath');
    if (!s.finger || !game.lv) { f.hidden = true; path.style.display = 'none'; if (tutFingerAnim) { tutFingerAnim.cancel(); tutFingerAnim = null; } tutFingerKey = ''; return; }
    const open = game.lv.w.filter(x => !game.found.has(x[0])).sort((a, b) => a[0].length - b[0].length);
    const w = open[0] && open[0][0]; if (!w) return;
    const used = new Set(), pts = [];
    for (const ch of Array.from(w)) {
      const i = game.letterEls.findIndex((e, j) => !used.has(j) && game.letters[j] === ch); if (i < 0) return;
      used.add(i); const r = game.letterEls[i].getBoundingClientRect(); pts.push([r.left + r.width / 2, r.top + r.height / 2]);
    }
    const k = w + pts.map(p => p.map(Math.round).join(',')).join(';'); if (k === tutFingerKey) return; tutFingerKey = k;
    path.style.display = ''; path.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
    path.querySelector('path').setAttribute('d', 'M' + pts.map(p => p.join(',')).join(' L'));
    f.hidden = false; if (tutFingerAnim) tutFingerAnim.cancel();
    const seg = 650, hold = 500, total = hold + seg * (pts.length - 1) + hold + 400;
    const fr = [{ transform: `translate(${pts[0][0]}px,${pts[0][1]}px) scale(1.15)`, opacity: 0, offset: 0 },
      { transform: `translate(${pts[0][0]}px,${pts[0][1]}px) scale(1)`, opacity: 1, offset: hold / total }];
    pts.slice(1).forEach((p, i) => fr.push({ transform: `translate(${p[0]}px,${p[1]}px) scale(1)`, opacity: 1, offset: (hold + seg * (i + 1)) / total }));
    const last = pts[pts.length - 1];
    fr.push({ transform: `translate(${last[0]}px,${last[1]}px) scale(1)`, opacity: 1, offset: (total - 400) / total });
    fr.push({ transform: `translate(${last[0]}px,${last[1]}px) scale(1.1)`, opacity: 0, offset: 1 });
    tutFingerAnim = f.animate(fr, { duration: total, iterations: Infinity, easing: 'ease-in-out' });
  }
  window.addEventListener('resize', () => { tutKey = ''; tutFingerKey = ''; });

  /* ================= INIT ================= */
  window.addEventListener('resize', () => { if (screen === 'game' && game.lv) { buildGrid(); buildWheel(false); } });
  Platform.onPause(() => save());
  document.querySelector('.logo-orn').style.backgroundImage = Art.ornament('#e9b949', '#b8202f', 18);
  // Tatar folk UI decoration: embroidered bands, panel corners, ichigi-mosaic wheel ring (all generated SVG, js/art.js)
  { const R = document.documentElement.style; R.setProperty('--band', Art.band('#e9b949', '#b8202f')); R.setProperty('--bandC', Art.band('#b8202f', '#0e5a3f'));
    ['tl', 'tr', 'bl', 'br'].forEach(k => R.setProperty('--c' + k, Art.corner(k, '#e9b949', '#b8202f'))); R.setProperty('--wheelBg', Art.wheel()); }
  (async function init() {
    try { await Platform.init(); } catch (e) {}
    if (Platform.cloud.available) { try { const c = await Platform.cloud.pull(); if (c && c.v === 2 && (c.level || 0) > st.level) { st = Object.assign(fresh(), c); migrate(); } } catch (e) {} }
    // UI language: Russian only (no auto-detect; Platform.lang() is ignored)
    touchStreak(); ensureQuests(); applyLang(); show('home');
    Platform.gameReady();
    updBanner(); tutStart();
    openFromHash();
  })();
  // Android back button (native shell calls this; false = let the app close)
  window.__appBack = function () {
    if (tutVisible()) { tutSkip(); return true; }
    if (!$('cardModal').hidden) { $('cardModal').hidden = true; gp(); return true; }
    if (!$('modal').hidden) { if ($('sheet').dataset.kind === 'win') $('wNext').click(); else closeModal(); return true; }
    if (screen !== 'home') { goHome(); return true; }
    return false;
  };
  // no long-press context menu (Yandex rule 1.6.1.8), except in text inputs
  document.addEventListener('contextmenu', e => { if (!e.target.closest('input,textarea')) e.preventDefault(); });
  // test/debug hooks (stripped from release builds: window.RELEASE)
  if (!window.RELEASE) window.suzDonyasy = { MUSIC_FOR, toast, setBg, shareWord, shareCanvas, withCard, get state() { return st; }, set state(v) { st = v; save(); }, game, startGame, openCard, openRewards, openWotd, openCollection, openQuests, openSpin, openAch, openSettings, openMap, openDaily,
    submit, goHome, closeModal, data: DATA, dayKey, dailyIndex, wotdWord, renderHome,
    tutSkip, tutReplay, get tutStep() { return tutActive() ? TUT[st.tut.step].id : null; }, tutVisible, updBanner };
})();
