/* Background music: looped tracks audio/<id>.mp3 listed in js/tracks.js (currently Suno tracks — see README "Music"; do not run tools/make_music.py).
 * Lazy-loaded, seamless WebAudio loops with crossfade between tracks, quiet by default, ducks under SFX,
 * starts only after the first user gesture (autoplay rules), pauses when the tab is hidden or an ad is shown
 * (Platform.audio.suspend/resume — Yandex Games / Android adapters call these around ads). */
(function () {
  'use strict';
  const TR = {}; (window.MUSIC_TRACKS || []).forEach(t => TR[t.id] = t);
  const FADE = 2.5;
  let ctx = null, master = null, duckG = null, cur = null, want = null, enabled = true, vol = 0.3, unlocked = false;
  const bufs = {}, held = new Set(); let el = null; // <audio> fallback (file:// or no WebAudio decode)
  const ver = () => (window.BUILD_V ? '?v=' + window.BUILD_V : '');
  const curve = v => Math.pow(Math.max(0, Math.min(1, v)), 1.6) * 0.9;
  function ac() {
    if (ctx) return ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    master = ctx.createGain(); duckG = ctx.createGain(); master.gain.value = enabled ? curve(vol) : 0;
    duckG.connect(master); master.connect(ctx.destination); return ctx;
  }
  function load(id) {
    if (bufs[id]) return bufs[id];
    return (bufs[id] = (location.protocol === 'file:' ? Promise.reject(new Error('file')) : fetch('audio/' + id + '.mp3' + ver()).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }))
      .then(ab => new Promise((res, rej) => ac().decodeAudioData(ab, res, rej))));
  }
  function startBuf(id, buf) {
    const c = ac(), now = c.currentTime, g = c.createGain(), src = c.createBufferSource(), L = (TR[id] && TR[id].len) || buf.duration;
    src.buffer = buf; src.loop = true;
    const lead = Math.max(0, Math.min(0.06, buf.duration - L)); src.loopStart = lead; src.loopEnd = Math.min(buf.duration, lead + L);
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(1, now + FADE);
    src.connect(g); g.connect(duckG); src.start(now, lead);
    if (cur && cur.g) { const o = cur; o.g.gain.cancelScheduledValues(now); o.g.gain.setValueAtTime(o.g.gain.value || 1, now); o.g.gain.exponentialRampToValueAtTime(0.0001, now + FADE); setTimeout(() => { try { o.src.stop(); } catch (e) {} }, FADE * 1000 + 200); }
    cur = { id, src, g };
  }
  function startEl(id) { // fallback: crossfade two <audio> elements by volume
    const a = new Audio('audio/' + id + '.mp3' + ver()); a.loop = true; a.volume = 0; const old = el; el = a; a._id = id;
    const target = () => (enabled ? curve(vol) : 0) * (a._duck || 1);
    a.play().catch(() => {});
    let k = 0; const iv = setInterval(() => { k++; const f = Math.min(1, k / 25); a.volume = target() * f; if (old) old.volume = Math.max(0, old.volume * (1 - f)); if (f >= 1) { clearInterval(iv); if (old) old.pause(); } }, FADE * 40);
    cur = { id, el: a };
  }
  function apply() {
    if (!unlocked || !want || !enabled || held.size) return;
    if (cur && cur.id === want) return;
    const id = want;
    load(id).then(buf => { if (want === id && (!cur || cur.id !== id)) startBuf(id, buf); }).catch(() => { if (want === id && (!cur || cur.id !== id)) startEl(id); });
  }
  function setGain() {
    const v = enabled && !held.size ? curve(vol) : 0;
    if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.15);
    if (el) el.volume = v;
  }
  const Music = {
    tracks: TR,
    get enabled() { return enabled; }, get paused() { return held.size > 0; },
    info() { return { mode: cur ? (cur.el ? 'element' : 'webaudio') : null, id: cur && cur.id, dur: cur && cur.src ? cur.src.buffer.duration : null, loopStart: cur && cur.src ? cur.src.loopStart : null, loopEnd: cur && cur.src ? cur.src.loopEnd : null, ctx: ctx && ctx.state }; }, get volume() { return vol; }, get current() { return cur && cur.id; }, get wanted() { return want; },
    configure(o) { if (o.enabled != null) enabled = !!o.enabled; if (o.volume != null) vol = +o.volume; setGain(); if (enabled) apply(); },
    setEnabled(v) { enabled = !!v; setGain(); if (enabled) { if (ctx && ctx.state === 'suspended' && !held.size) ctx.resume(); apply(); } },
    setVolume(v) { vol = Math.max(0, Math.min(1, +v)); setGain(); },
    unlock() { if (unlocked) return; unlocked = true; const c = ac(); if (c && c.state === 'suspended' && !held.size) c.resume(); apply(); },
    play(id) { if (!TR[id]) return; want = id; apply(); },
    duck() { // lower the music briefly under a sound effect
      if (duckG && ctx) { const t = ctx.currentTime; duckG.gain.cancelScheduledValues(t); duckG.gain.setTargetAtTime(0.45, t, 0.03); duckG.gain.setTargetAtTime(1, t + 0.35, 0.25); }
      else if (el) { el._duck = 0.45; setGain(); clearTimeout(el._dt); el._dt = setTimeout(() => { el._duck = 1; el.volume = enabled ? curve(vol) : 0; }, 500); }
    },
    suspend(reason) { held.add(reason || 'x'); setGain(); if (ctx && ctx.state === 'running') ctx.suspend(); if (el) el.pause(); },
    resume(reason) { held.delete(reason || 'x'); if (held.size) return; if (ctx && unlocked) ctx.resume(); if (el && enabled) el.play().catch(() => {}); setGain(); apply(); },
  };
  window.Music = Music;
  // first user gesture unlocks audio
  const first = () => { Music.unlock(); window.removeEventListener('pointerdown', first, true); window.removeEventListener('keydown', first, true); };
  window.addEventListener('pointerdown', first, true); window.addEventListener('keydown', first, true);
  // tab hidden -> silence (Yandex Games requirement)
  document.addEventListener('visibilitychange', () => document.hidden ? Music.suspend('hidden') : Music.resume('hidden'));
  // ads / platform interruptions
  if (window.Platform && Platform.audio) Platform.audio.on((on, reason) => on ? Music.resume(reason) : Music.suspend(reason));
  // duck under every sound effect
  if (window.Sound) Object.keys(Sound).forEach(k => { const f = Sound[k]; if (typeof f === 'function' && !['unlock'].includes(k)) Sound[k] = function () { Music.duck(); return f.apply(this, arguments); }; });
})();
