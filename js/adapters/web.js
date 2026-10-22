/* Plain-browser adapter: Yandex Advertising Network (RSYA) web units, modelled on the Mari game's web adapter.
 * IDs: js/ads-config.js (window.SUZ_WEB_ADS = {banner, fullscreen}); an empty ID switches that unit off.
 * Never active in the Android WebView (AndroidBridge) or Yandex Games (YaGames); also off with ?adsim=1.
 * - banner -> Floor Ad (sticky bottom), same show/hide points as the apps; #app shrinks so the letter wheel stays uncovered
 * - interstitial -> Fullscreen unit (app keeps its caps: every 3rd win, >=150 s)
 * - rewarded «Подсказка ×1» -> web has no rewarded format: the Fullscreen unit, hint granted after it closes,
 *   or at once if the ad is blocked / not filled / errors. Timeouts everywhere: gameplay never hangs. */
(function () {
  if (window.YaGames || window.AndroidBridge || Platform.name !== 'web' || /[?&]adsim=1\b/.test(location.search)) return;
  const C = window.SUZ_WEB_ADS || {}, ID = k => (typeof C[k] === 'string' && /^R-A-\d+-\d+$/.test(C[k].trim())) ? C[k].trim() : '';
  const BANNER = ID('banner'), FULL = ID('fullscreen');
  if (!BANNER && !FULL) return;
  window.yaContextCb = window.yaContextCb || [];
  let loaded = null; const waiters = [];
  (function load() {
    const s = document.createElement('script'); s.async = true; s.src = 'https://yandex.ru/ads/system/context.js';
    const done = ok => { if (loaded !== null) return; loaded = ok; waiters.splice(0).forEach(f => f(ok)); };
    s.onload = () => done(!!(window.Ya && Ya.Context && Ya.Context.AdvManager)); s.onerror = () => done(false);
    setTimeout(() => done(!!(window.Ya && Ya.Context && Ya.Context.AdvManager)), 10000);
    (document.head || document.documentElement).appendChild(s);
  })();
  const ready = () => loaded !== null ? Promise.resolve(loaded) : new Promise(r => waiters.push(r));
  const mgr = () => (window.Ya && Ya.Context && Ya.Context.AdvManager) || null;
  const plat = () => { try { const p = mgr().getPlatform(); if (p) return p === 'desktop' ? 'desktop' : 'touch'; } catch (e) {}
    return (matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) ? 'touch' : 'desktop'; };
  const log = (...a) => { try { console.info('[webads]', ...a); } catch (e) {} };

  /* ---- Floor Ad ---- */
  let bannerWanted = false, bannerLive = false, bannerClosed = false;
  const R = document.documentElement;
  // reserve the real height of the floor ad (fallback 64px) so it never covers the wheel
  function fit() { let h = 0; const W = innerWidth, H = innerHeight;
    for (const x of [W * .5, W * .2, W * .8]) for (let el = document.elementFromPoint(x, H - 2); el && el !== document.body && el !== R; el = el.parentElement) {
      if (getComputedStyle(el).position === 'fixed' && !document.getElementById('app').contains(el)) { h = Math.max(h, H - el.getBoundingClientRect().top); break; } }
    R.style.setProperty('--webBannerH', Math.min(Math.max(h || 64, 50), 140) + 'px'); }
  const bannerCls = on => { R.classList.toggle('withWebBanner', on); if (on) { fit(); setTimeout(fit, 800); } };
  function renderBanner() {
    const M = mgr(); if (!M || !bannerWanted || bannerLive || bannerClosed) return; bannerLive = true;
    window.yaContextCb.push(() => {
      if (!bannerWanted) { bannerLive = false; return; }
      try { M.render({ blockId: BANNER, type: 'floorAd', platform: plat(),
        onRender: () => { if (bannerWanted) bannerCls(true); },
        onClose: () => { bannerClosed = true; bannerCls(false); },   // user closed it: not again this session
        onError: d => { log('banner', d && d.code); bannerCls(false); } }); } catch (e) { bannerLive = false; }
    });
  }
  function destroyBanner() { bannerCls(false); if (!bannerLive) return; bannerLive = false;
    try { const M = mgr(); M && M.destroy && M.destroy({ blockId: BANNER }); } catch (e) {} }

  /* ---- Fullscreen ---- */
  let fsBusy = false;
  function showFullscreen() {
    if (!FULL || fsBusy) return Promise.resolve(false); fsBusy = true;
    return ready().then(ok => new Promise(res => {
      const M = mgr(); if (!ok || !M) return res(false);
      let shown = false, fin = false, t1, t2;
      const end = v => { if (fin) return; fin = true; clearTimeout(t1); clearTimeout(t2); if (shown) try { Platform.audio.resume('ad'); } catch (e) {} res(v); };
      t1 = setTimeout(() => { if (!shown) end(false); }, 5000);   // no fill / silence -> continue
      window.yaContextCb.push(() => {
        try { M.render({ blockId: FULL, type: 'fullscreen', platform: plat(),
          onRender: () => { if (fin) return; shown = true; clearTimeout(t1); try { Platform.audio.suspend('ad'); } catch (e) {} t2 = setTimeout(() => end(true), 90000); },
          onClose: () => end(true),
          onError: d => { log('fullscreen', d && d.code); if (!d || d.type !== 'warning') end(false); } }); } catch (e) { end(false); }
      });
    })).catch(() => false).finally(() => { fsBusy = false; });
  }

  Platform.use({
    name: 'web-rsya',
    ads: {
      rewardedAvailable() { return !!FULL; },                       // hint always granted (after close, or at once on no-fill)
      async showRewarded() { await showFullscreen(); return true; },
      interstitialAvailable() { return !!FULL && loaded !== false; },
      async showInterstitial() { await showFullscreen(); },
      bannerAvailable() { return !!BANNER && loaded !== false && !bannerClosed; },
      showBanner() { if (!BANNER) return; bannerWanted = true; ready().then(ok => ok && renderBanner()); },
      hideBanner() { bannerWanted = false; destroyBanner(); },
    },
  });
})();
