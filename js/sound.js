/* Tiny WebAudio synth – no external assets. */
(function () {
  'use strict';
  let ctx = null, master = null, on = true;
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, t0, dur, type, vol, slide) {
    const c = ac(); if (!c || !on) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, c.currentTime + t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + t0 + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.5, c.currentTime + t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
    o.connect(g); g.connect(master); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.02);
  }
  document.addEventListener('visibilitychange', () => { if (ctx) document.hidden ? ctx.suspend() : ctx.resume(); });
  if (window.Platform && Platform.audio) Platform.audio.on(on => { if (ctx) on ? ctx.resume() : ctx.suspend(); });
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1568];  // pentatonic – Tatar folk melodies are pentatonic too
  const Sound = {
    set enabled(v) { on = !!v; }, get enabled() { return on; },
    unlock() { ac(); },
    tap(i) { tone(PENTA[Math.min(i, PENTA.length - 1)], 0, 0.12, 'triangle', 0.35); },
    click() { tone(660, 0, 0.05, 'square', 0.12); },
    ok() { [0, 2, 4].forEach((k, j) => tone(PENTA[k] , j * 0.07, 0.25, 'triangle', 0.4)); },
    bonus() { tone(1046.5, 0, 0.12, 'sine', 0.35); tone(1568, 0.08, 0.2, 'sine', 0.3); },
    bad() { tone(220, 0, 0.18, 'sawtooth', 0.15, 150); },
    dup() { tone(440, 0, 0.1, 'sine', 0.2); tone(440, 0.12, 0.1, 'sine', 0.2); },
    coin() { tone(1318.5, 0, 0.07, 'square', 0.12); tone(1975, 0.05, 0.12, 'square', 0.1); },
    combo(n) { for (let k = 0; k < Math.min(n + 1, 5); k++) tone(PENTA[k + 2], k * 0.05, 0.12, 'triangle', 0.3); },
    win() { [0, 2, 4, 5, 7].forEach((k, j) => tone(PENTA[k], j * 0.11, 0.4, 'triangle', 0.4)); tone(261.6, 0, 0.9, 'sine', 0.25); },
    reward() { [4, 5, 7, 8].forEach((k, j) => tone(PENTA[k], j * 0.08, 0.3, 'sine', 0.35)); },
  };
  window.Sound = Sound;
})();
