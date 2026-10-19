/* Procedural SVG art for «Сүз дөньясы»: Tatarstan landscapes (Idel/Volga, Chulman/Kama, forests, meadows, villages with painted gates,
   a generic white-stone kremlin wall with plain towers, Sabantuy pole with towels, kurai stems) drawn in a Tatar folk style:
   tulips, carnations and leaves like tambour embroidery (chain-stitch outlines) and ichigi leather mosaic.
   Deliberately NO religious imagery: no mosques, minarets, crescents, crosses, domes or spires; the moon is always full. All original code. */
(function () {
  'use strict';
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  // traditional colours
  const C = { green: '#0e5a3f', green2: '#083a2a', leaf: '#2f8a4e', red: '#b8202f', red2: '#7a0f1c', gold: '#e9b949', gold2: '#c98a1c',
    cream: '#fbf1dc', white: '#fffaf0', blue: '#2a7fa8', brown: '#8a5a32', plum: '#5a1f3a' };
  const P = {   // sky top/bottom, sun, far, mid, near, ground, acc + features
    meadow:   { sky: ['#5ab8cf', '#f6efd6'], sun: '#ffd970', far: '#8fbf8f', mid: '#4f9a5c', near: '#2b7a46', ground: '#1d5e38', acc: C.red, flowers: 1, trees: 'birch' },
    forest:   { sky: ['#3f9ab4', '#e8efd8'], sun: '#ffe7a0', far: '#5f9078', mid: '#2a6a4c', near: '#174d36', ground: '#0f3b29', acc: C.gold, trees: 'forest', flowers: .4 },
    lake:     { sky: ['#3a8fc0', '#eef3e0'], sun: '#fff0b8', far: '#5c9488', mid: '#2e6c5a', near: '#1c5244', ground: '#123d32', acc: C.cream, trees: 'pine', lake: 1, lilies: 1 },
    river:    { sky: ['#62b4d4', '#fbf0d4'], sun: '#ffd970', far: '#9cbc94', mid: '#5c9a62', near: '#367a4a', ground: '#255c38', acc: C.red, trees: 'birch', river: 1, flowers: .5 },
    idel:     { sky: ['#4aa6cf', '#fbeccc'], sun: '#ffd060', far: '#a6b896', mid: '#6f9a68', near: '#3f7a4c', ground: '#2a5e3a', acc: C.gold, idel: 1, boat: 1, gulls: 1 },
    hills:    { sky: ['#58a8cc', '#fde6c0'], sun: '#ffc860', far: '#b4ab92', mid: '#88a26e', near: '#567f50', ground: '#3a6040', acc: C.gold, trees: 'birch', kurai: .5 },
    field:    { sky: ['#7cc4e6', '#fff1c8'], sun: '#ffd34a', far: '#bfc884', mid: '#e0b950', near: '#cf9a34', ground: '#9c6c22', acc: C.red, wheat: 1, stacks: 1 },
    grove:    { sky: ['#8fd0dc', '#f8f4e0'], sun: '#ffffff', far: '#a8d0a0', mid: '#72b46c', near: '#46924e', ground: '#2f7440', acc: C.red, trees: 'birch', flowers: 1 },
    village:  { sky: ['#f4a868', '#fde8c4'], sun: '#fff0b0', far: '#b89a7a', mid: '#7c8a58', near: '#4c6040', ground: '#30402c', acc: C.gold, houses: 1, trees: 'birch' },
    kremlin:  { sky: ['#4f9fcc', '#fbeed2'], sun: '#ffd970', far: '#a4b89a', mid: '#6a9466', near: '#3d744a', ground: '#28583a', acc: C.gold, kremlin: 1, idel: .6, flowers: .4 },
    sabantuy: { sky: ['#5cbde0', '#fff4d6'], sun: '#ffd34a', far: '#9cc890', mid: '#5eaa60', near: '#348546', ground: '#226436', acc: C.red, sabantuy: 1, flowers: .7, trees: 'birch' },
    kurai:    { sky: ['#6ab0d0', '#fbe8c8'], sun: '#ffcf68', far: '#b0b48c', mid: '#8aa266', near: '#5c8048', ground: '#3e6034', acc: C.gold, kurai: 1, flowers: .3 },
    autumn:   { sky: ['#e0995a', '#fbe6c0'], sun: '#fff0c0', far: '#c8904a', mid: '#b0602c', near: '#7e3c20', ground: '#552818', acc: C.gold, trees: 'oak', leaves: 1 },
    winter:   { sky: ['#86b6d8', '#f2f6fa'], sun: '#ffffff', far: '#cddcea', mid: '#a8c4dc', near: '#e8f0f8', ground: '#ffffff', acc: C.red, trees: 'pinesnow', snow: 1 },
    spring:   { sky: ['#7ccbe6', '#f6fbe8'], sun: '#fff2b0', far: '#a6d49c', mid: '#74c072', near: '#4aa258', ground: '#358444', acc: C.red, trees: 'birch', flowers: 1.3 },
    summer:   { sky: ['#2fa0da', '#cdeefc'], sun: '#ffe060', far: '#7cc088', mid: '#46a05a', near: '#287e44', ground: '#1c6034', acc: C.gold, trees: 'oak', flowers: 1.1 },
    night:    { sky: ['#06182a', '#1c4258'], sun: '#f6eccc', far: '#1d3e4c', mid: '#14323c', near: '#0d262e', ground: '#071a20', acc: C.gold, trees: 'pine', stars: 1, moon: 1, lights: 1 },
    sunset:   { sky: ['#3c2448', '#f59a52'], sun: '#ffcf70', far: '#7c4658', mid: '#52304a', near: '#341f34', ground: '#211424', acc: C.gold, idel: 1, trees: 'pine' },
    dawn:     { sky: ['#eeb2a8', '#fff0d6'], sun: '#ffffff', far: '#c4aab2', mid: '#98a0a4', near: '#6c8884', ground: '#4c6864', acc: C.cream, trees: 'birch', mist: 1, river: 1 },
  };
  const f1 = n => Math.round(n * 10) / 10;
  function wave(r, y, amp, w, h, n) {
    let d = `M0 ${h} L0 ${f1(y)}`; const step = w / n;
    for (let i = 1; i <= n; i++) { const x = i * step; d += ` Q ${f1(x - step / 2)} ${f1(y - amp * (0.4 + r()))} ${f1(x)} ${f1(y + (r() - .5) * amp * .6)}`; }
    return d + ` L${w} ${h} Z`;
  }
  /* ---------- folk motifs ---------- */
  const ST = (c, w) => `stroke="${c}" stroke-width="${w || 1.2}" stroke-dasharray="${(w || 1.2) * 1.6} ${(w || 1.2) * 1.2}" stroke-linecap="round"`;   // chain-stitch outline
  function tulip(x, y, s, col, opt) {      // stem + two leaves + three-petal cup
    const o = opt || {}, lf = o.leaf || C.leaf, st = o.stitch || C.gold;
    return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${f1(s / 20 * 100) / 100})">` +
      `<path d="M0 0 C0 -8 0 -14 0 -20" stroke="${lf}" stroke-width="2" fill="none"/>` +
      `<path d="M0 -3 C-8 -4 -12 -10 -12 -16 C-6 -15 -2 -10 0 -3 Z M0 -6 C8 -7 11 -12 11 -18 C5 -17 1 -12 0 -6 Z" fill="${lf}"/>` +
      `<path d="M-7 -34 C-8 -26 -5 -20 0 -20 C5 -20 8 -26 7 -34 L3.5 -29.5 L0 -36 L-3.5 -29.5 Z" fill="${col}" ${ST(st, .9)}/>` +
      `<path d="M0 -31 L1.6 -27 L0 -23.5 L-1.6 -27 Z" fill="${st}"/></g>`;
  }
  function carnation(x, y, s, col, opt) {  // fan-shaped carnation with jagged edge and calyx
    const o = opt || {}, lf = o.leaf || C.leaf, st = o.stitch || C.gold;
    let fan = 'M-9 -26 '; for (let i = 0; i <= 6; i++) { const a = Math.PI * (1.12 + i * .127), r1 = 13, r2 = 10; fan += `L${f1(Math.cos(a) * r1)} ${f1(-22 + Math.sin(a) * r1)} L${f1(Math.cos(a + .063) * r2)} ${f1(-22 + Math.sin(a + .063) * r2)} `; }
    fan += 'L9 -26 Z';
    return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${f1(s / 20 * 100) / 100})">` +
      `<path d="M0 0 C0 -6 0 -12 0 -18" stroke="${lf}" stroke-width="2" fill="none"/>` +
      `<path d="M0 -4 C-7 -5 -10 -9 -10 -14 C-5 -12 -2 -9 0 -4 Z M0 -8 C7 -9 10 -13 10 -18 C5 -16 2 -13 0 -8 Z" fill="${lf}"/>` +
      `<path d="${fan}" fill="${col}" ${ST(st, .9)}/><path d="M-5 -20 Q0 -14 5 -20 L3 -26 L-3 -26 Z" fill="${lf}"/></g>`;
  }
  function bloom(x, y, s, col) {           // round rosette flower (meadow)
    let g = `<g transform="translate(${f1(x)} ${f1(y)}) scale(${f1(s / 20 * 100) / 100})"><path d="M0 0 L0 -14" stroke="${C.leaf}" stroke-width="2"/>`;
    for (let i = 0; i < 6; i++) g += `<ellipse cx="0" cy="-23" rx="2.6" ry="5" fill="${col}" transform="rotate(${i * 60} 0 -18)"/>`;
    return g + `<circle cx="0" cy="-18" r="2.6" fill="${C.gold}"/></g>`;
  }
  function folkSun(x, y, r, col, rays) {   // sun rosette with petal rays
    let g = `<g transform="translate(${f1(x)} ${f1(y)})">`;
    if (rays) for (let i = 0; i < 12; i++) g += `<path d="M0 ${-r - 4} C${r * .22} ${-r - 10} ${r * .1} ${-r - 20} 0 ${-r - 24} C${-r * .1} ${-r - 20} ${-r * .22} ${-r - 10} 0 ${-r - 4} Z" fill="${col}" opacity=".55" transform="rotate(${i * 30})"/>`;
    g += `<circle r="${r}" fill="${col}"/>`;
    if (rays) g += `<circle r="${r * .72}" fill="none" ${ST('#fff', 1.4)} opacity=".7"/>`;
    return g + '</g>';
  }
  function cloud(x, y, w, op) {             // scalloped cloud with a curl
    const h = w * .3;
    return `<g opacity="${op}" fill="#fffaf0"><ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(w * .5)}" ry="${f1(h * .55)}"/><circle cx="${f1(x - w * .2)}" cy="${f1(y - h * .35)}" r="${f1(h * .55)}"/>` +
      `<circle cx="${f1(x + w * .12)}" cy="${f1(y - h * .55)}" r="${f1(h * .7)}"/><path d="M${f1(x + w * .05)} ${f1(y - h * .5)} q ${f1(h * .3)} -${f1(h * .3)} ${f1(h * .45)} 0 q -${f1(h * .1)} ${f1(h * .25)} -${f1(h * .3)} ${f1(h * .1)}" fill="none" stroke="${C.gold}" stroke-width="1.4" opacity=".55"/></g>`;
  }
  function pine(x, y, s, col, snow) {
    let g = `<g fill="${col}"><rect x="${f1(x - s * .05)}" y="${f1(y - s * .2)}" width="${f1(s * .1)}" height="${f1(s * .22)}" fill="#3a2a1a"/>`;
    for (let k = 0; k < 3; k++) { const yy = y - s * (.15 + k * .27), ww = s * (.4 - k * .1); g += `<path d="M${f1(x - ww)} ${f1(yy)} L${f1(x)} ${f1(yy - s * .4)} L${f1(x + ww)} ${f1(yy)} Z"/>`; if (snow) g += `<path d="M${f1(x - ww * .45)} ${f1(yy - s * .22)} L${f1(x)} ${f1(yy - s * .4)} L${f1(x + ww * .45)} ${f1(yy - s * .22)} Z" fill="#fff" opacity=".92"/>`; }
    return g + '</g>';
  }
  function birch(x, y, s, leaf, r) {
    let g = `<rect x="${f1(x - s * .03)}" y="${f1(y - s)}" width="${f1(s * .06)}" height="${f1(s)}" fill="#f6f1e6"/>`;
    for (let k = 0; k < 5; k++) g += `<rect x="${f1(x - s * .03)}" y="${f1(y - s * (.15 + k * .17))}" width="${f1(s * (.025 + r() * .035))}" height="${f1(s * .018)}" fill="#2a2a2a"/>`;
    return g + `<ellipse cx="${f1(x)}" cy="${f1(y - s * .95)}" rx="${f1(s * .26)}" ry="${f1(s * .4)}" fill="${leaf}" opacity=".95"/>`;
  }
  function oak(x, y, s, leaf, r, acc) {
    let g = `<path d="M${f1(x - s * .05)} ${f1(y)} L${f1(x - s * .03)} ${f1(y - s * .55)} L${f1(x + s * .03)} ${f1(y - s * .55)} L${f1(x + s * .05)} ${f1(y)} Z" fill="#4a3220"/>`;
    for (let k = 0; k < 4; k++) g += `<circle cx="${f1(x + (r() - .5) * s * .5)}" cy="${f1(y - s * (.62 + r() * .3))}" r="${f1(s * (.2 + r() * .1))}" fill="${leaf}"/>`;
    if (acc) for (let k = 0; k < 4; k++) g += `<circle cx="${f1(x + (r() - .5) * s * .6)}" cy="${f1(y - s * (.6 + r() * .35))}" r="${f1(s * .03)}" fill="${acc}"/>`;
    return g;
  }
  function house(x, y, s, r) {            // Tatar village house: log walls, carved window frames, painted gate (капка)
    const wall = ['#9a6a3c', '#a8743e', '#7f5a36'][Math.floor(r() * 3)], roof = [C.green, '#2f6d8a', C.red2][Math.floor(r() * 3)], trim = [C.cream, '#7cc8d8', C.gold][Math.floor(r() * 3)];
    const w = s, h = s * .62;
    let g = `<g><rect x="${f1(x)}" y="${f1(y - h)}" width="${f1(w)}" height="${f1(h)}" fill="${wall}"/>`;
    for (let k = 1; k < 5; k++) g += `<line x1="${f1(x)}" y1="${f1(y - h * k / 5)}" x2="${f1(x + w)}" y2="${f1(y - h * k / 5)}" stroke="#00000033" stroke-width="1"/>`;
    g += `<path d="M${f1(x - w * .08)} ${f1(y - h)} L${f1(x + w / 2)} ${f1(y - h - w * .42)} L${f1(x + w * 1.08)} ${f1(y - h)} Z" fill="${roof}"/>` +
      `<path d="M${f1(x + w * .2)} ${f1(y - h - 1)} L${f1(x + w / 2)} ${f1(y - h - w * .3)} L${f1(x + w * .8)} ${f1(y - h - 1)} Z" fill="${trim}" opacity=".9"/>` +
      `<circle cx="${f1(x + w / 2)}" cy="${f1(y - h - w * .13)}" r="${f1(w * .06)}" fill="${wall}"/>`;
    for (const wx of [.18, .58]) {
      const X = x + w * wx, Y = y - h * .78, ww = w * .24, wh = h * .42;
      g += `<path d="M${f1(X - 2)} ${f1(Y)} q ${f1(ww / 2 + 2)} -${f1(wh * .45)} ${f1(ww + 4)} 0 Z" fill="${trim}"/><rect x="${f1(X)}" y="${f1(Y)}" width="${f1(ww)}" height="${f1(wh)}" fill="#ffe6a0" stroke="${trim}" stroke-width="2.5"/>` +
        `<line x1="${f1(X + ww / 2)}" y1="${f1(Y)}" x2="${f1(X + ww / 2)}" y2="${f1(Y + wh)}" stroke="${trim}" stroke-width="1.6"/><rect x="${f1(X - 2)}" y="${f1(Y + wh)}" width="${f1(ww + 4)}" height="2.5" fill="${trim}"/>`;
    }
    // gate with an arched top and a sun-ray pattern
    const gx = x + w + s * .08, gw = s * .55, gh = s * .62, gc = [C.green, '#2f7f9a', C.red][Math.floor(r() * 3)];
    g += `<rect x="${f1(gx)}" y="${f1(y - gh)}" width="${f1(gw)}" height="${f1(gh)}" fill="${gc}"/><path d="M${f1(gx - 2)} ${f1(y - gh)} Q ${f1(gx + gw / 2)} ${f1(y - gh - gw * .55)} ${f1(gx + gw + 2)} ${f1(y - gh)} Z" fill="${gc}"/>`;
    for (let k = 0; k < 7; k++) { const a = Math.PI * (1 + (k + .5) / 7); g += `<line x1="${f1(gx + gw / 2)}" y1="${f1(y - gh)}" x2="${f1(gx + gw / 2 + Math.cos(a) * gw * .42)}" y2="${f1(y - gh + Math.sin(a) * gw * .35)}" stroke="${C.gold}" stroke-width="1.4"/>`; }
    g += `<circle cx="${f1(gx + gw / 2)}" cy="${f1(y - gh)}" r="${f1(gw * .09)}" fill="${C.gold}"/><line x1="${f1(gx + gw / 2)}" y1="${f1(y - gh)}" x2="${f1(gx + gw / 2)}" y2="${f1(y)}" stroke="#00000044" stroke-width="1.2"/>` +
      `<rect x="${f1(gx + gw * .12)}" y="${f1(y - gh * .7)}" width="${f1(gw * .28)}" height="${f1(gh * .4)}" fill="none" stroke="${C.gold}" stroke-width="1.2"/><rect x="${f1(gx + gw * .6)}" y="${f1(y - gh * .7)}" width="${f1(gw * .28)}" height="${f1(gh * .4)}" fill="none" stroke="${C.gold}" stroke-width="1.2"/>`;
    return g + '</g>';
  }
  function kremlin(x0, x1, yb, s, r, dark) {   // generic white-stone wall with crenellations and plain towers (no domes/spires/finials)
    const stone = dark || '#f3e9d2', shade = dark ? '#00000055' : '#d8c8a4', roof = dark || C.green;
    let g = `<g><rect x="${f1(x0)}" y="${f1(yb - s * .5)}" width="${f1(x1 - x0)}" height="${f1(s * .5)}" fill="${stone}"/>`;
    for (let x = x0; x < x1 - 3; x += s * .16) g += `<rect x="${f1(x)}" y="${f1(yb - s * .6)}" width="${f1(s * .09)}" height="${f1(s * .11)}" fill="${stone}"/>`;
    g += `<rect x="${f1(x0)}" y="${f1(yb - s * .2)}" width="${f1(x1 - x0)}" height="${f1(s * .04)}" fill="${shade}"/>`;
    const n = Math.max(3, Math.round((x1 - x0) / (s * 1.3)));
    for (let i = 0; i <= n; i++) {
      const cx = x0 + (x1 - x0) * i / n, big = i === Math.floor(n / 2), tw = s * (big ? .42 : .3), th = s * (big ? 1.25 : .85 + r() * .2);
      g += `<rect x="${f1(cx - tw / 2)}" y="${f1(yb - th)}" width="${f1(tw)}" height="${f1(th)}" fill="${stone}"/><rect x="${f1(cx - tw / 2)}" y="${f1(yb - th)}" width="${f1(tw * .25)}" height="${f1(th)}" fill="${shade}" opacity=".6"/>`;
      if (i % 2 || big) g += `<path d="M${f1(cx - tw / 2 - 2)} ${f1(yb - th)} L${f1(cx)} ${f1(yb - th - tw * .8)} L${f1(cx + tw / 2 + 2)} ${f1(yb - th)} Z" fill="${roof}"/>`;   // low tent roof, no finial
      else for (let k = 0; k < 3; k++) g += `<rect x="${f1(cx - tw / 2 + k * tw * .38)}" y="${f1(yb - th - s * .08)}" width="${f1(tw * .24)}" height="${f1(s * .08)}" fill="${stone}"/>`;   // crenellated flat top
      g += `<rect x="${f1(cx - tw * .12)}" y="${f1(yb - th * .7)}" width="${f1(tw * .24)}" height="${f1(th * .16)}" rx="${f1(tw * .1)}" fill="${dark ? '#ffd37a' : '#5a4a3a'}" opacity="${dark ? .8 : .7}"/>`;
      if (big) g += `<path d="M${f1(cx - tw * .25)} ${f1(yb)} L${f1(cx - tw * .25)} ${f1(yb - s * .32)} Q ${f1(cx)} ${f1(yb - s * .5)} ${f1(cx + tw * .25)} ${f1(yb - s * .32)} L${f1(cx + tw * .25)} ${f1(yb)} Z" fill="${dark ? '#000' : '#4a3a2a'}" opacity=".75"/>`;
    }
    return g + '</g>';
  }
  function sabantuyPole(x, yb, h, r) {        // pole with embroidered towels (сөлге) and bunting
    let g = `<g><line x1="${f1(x)}" y1="${f1(yb)}" x2="${f1(x)}" y2="${f1(yb - h)}" stroke="#7a5230" stroke-width="5"/><circle cx="${f1(x)}" cy="${f1(yb - h)}" r="5" fill="${C.gold}"/>`;
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * .45, len = h * (.22 + r() * .06), x2 = x + Math.sin(a) * 22, y0 = yb - h + 8;
      g += `<path d="M${f1(x)} ${f1(y0)} Q ${f1(x + Math.sin(a) * 14)} ${f1(y0 + len * .5)} ${f1(x2)} ${f1(y0 + len)}" stroke="${C.white}" stroke-width="10" fill="none"/>` +
        `<path d="M${f1(x2 - 3.5)} ${f1(y0 + len - 6)} L${f1(x2 + 3.5)} ${f1(y0 + len - 6)}" stroke="${C.red}" stroke-width="5"/><path d="M${f1(x2 - 3.5)} ${f1(y0 + len - 12)} L${f1(x2 + 3.5)} ${f1(y0 + len - 12)}" stroke="${C.green}" stroke-width="2.5"/>`;
    }
    return g + '</g>';
  }
  function bunting(x0, y0, x1, y1, sag, r) {
    let g = `<path d="M${f1(x0)} ${f1(y0)} Q ${f1((x0 + x1) / 2)} ${f1((y0 + y1) / 2 + sag)} ${f1(x1)} ${f1(y1)}" stroke="#5a3a20" stroke-width="1.2" fill="none"/>`;
    const cols = [C.red, C.gold, C.green, C.cream];
    for (let i = 1; i < 12; i++) {
      const t = i / 12, x = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * (x0 + x1) / 2 + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * ((y0 + y1) / 2 + sag) + t * t * y1;
      g += `<path d="M${f1(x - 5)} ${f1(y)} L${f1(x + 5)} ${f1(y)} L${f1(x)} ${f1(y + 11)} Z" fill="${cols[i % 4]}"/>`;
    }
    return g;
  }
  function kuraiStem(x, yb, h, col, r) {      // tall umbellifer «курай» with umbrella heads
    let g = `<path d="M${f1(x)} ${f1(yb)} Q ${f1(x + (r() - .5) * 10)} ${f1(yb - h / 2)} ${f1(x + (r() - .5) * 6)} ${f1(yb - h)}" stroke="${col}" stroke-width="2.2" fill="none"/>`;
    const tx = x + (r() - .5) * 6, ty = yb - h;
    for (let k = 0; k < 9; k++) { const a = Math.PI * (1.1 + k * .1); g += `<line x1="${f1(tx)}" y1="${f1(ty)}" x2="${f1(tx + Math.cos(a) * 12)}" y2="${f1(ty + Math.sin(a) * 9)}" stroke="${col}" stroke-width="1"/><circle cx="${f1(tx + Math.cos(a) * 12)}" cy="${f1(ty + Math.sin(a) * 9)}" r="2" fill="#fff4d0"/>`; }
    return g;
  }
  function lily(x, y, s) {                    // water lily (төнбоек) on a pad
    let g = `<ellipse cx="${f1(x)}" cy="${f1(y + s * .25)}" rx="${f1(s * 1.1)}" ry="${f1(s * .32)}" fill="#2f7a4a"/>`;
    for (let i = -2; i <= 2; i++) g += `<ellipse cx="${f1(x + i * s * .22)}" cy="${f1(y - s * .05)}" rx="${f1(s * .16)}" ry="${f1(s * .42)}" fill="#fffaf0" transform="rotate(${i * 18} ${f1(x + i * s * .22)} ${f1(y + s * .2)})"/>`;
    return g + `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s * .14)}" fill="${C.gold}"/>`;
  }
  function snowflake(x, y, s) {               // floral snowflake: six arms with tulip-bud ends
    let g = `<g transform="translate(${f1(x)} ${f1(y)})" stroke="#fff" stroke-width="1.3" fill="#fff" opacity=".85">`;
    for (let i = 0; i < 6; i++) g += `<g transform="rotate(${i * 60})"><line x1="0" y1="0" x2="0" y2="${f1(-s)}"/><path d="M0 ${f1(-s)} l ${f1(s * .18)} ${f1(-s * .25)} l ${f1(-s * .18)} ${f1(s * .08)} l ${f1(-s * .18)} ${f1(-s * .08)} Z"/></g>`;
    return g + '</g>';
  }
  function spray(x, y, sc, flip, col, col2, op) {   // tambour-embroidery spray: curling stem with tulips, carnations and leaves
    const L = (cx, cy, a, k) => `<path d="M0 0 C4 -6 12 -8 18 -6 C12 -2 6 2 0 0 Z" fill="${col}" opacity=".85" transform="translate(${cx} ${cy}) rotate(${a}) scale(${k})"/>`;
    return `<g opacity="${op}" transform="translate(${f1(x)} ${f1(y)}) scale(${flip ? -sc : sc} ${sc})">` +
      `<path d="M0 0 C30 10 50 40 52 80 M20 8 C40 0 70 4 86 20 M36 30 C58 34 70 52 72 70" fill="none" ${ST(col, 2)}/>` +
      L(30, 14, 30, 1.2) + L(44, 52, 70, 1.1) + L(62, 8, -10, 1) + L(58, 36, 20, .9) +
      `<g transform="translate(52 80) rotate(160) scale(.9)">${tulipFlat(col2, col)}</g>` +
      `<g transform="translate(86 20) rotate(115) scale(.8)">${carnFlat(col2, col)}</g>` +
      `<g transform="translate(72 70) rotate(140) scale(.6)">${tulipFlat(col, col2)}</g>` +
      `<circle cx="10" cy="22" r="3" fill="${col2}"/><circle cx="24" cy="40" r="2.4" fill="${col}"/></g>`;
  }
  /* ---------- scene ---------- */
  function scene(theme, seed, wide) {
    const p = P[theme] || P.meadow, r = rng(seed * 9973 + 7), W = wide ? 800 : 400, H = 800, id = 'g' + theme + seed + (wide ? 'w' : '');
    const fx = x => x * W / 400;   // horizontal scale
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">` +
      `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient>` +
      `<radialGradient id="${id}g"><stop offset="0" stop-color="${p.sun}" stop-opacity=".85"/><stop offset="1" stop-color="${p.sun}" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[1]}"/><stop offset="1" stop-color="${p.sky[0]}"/></linearGradient></defs>` +
      `<rect width="${W}" height="${H}" fill="url(#${id}s)"/>`;
    if (p.stars) for (let i = 0; i < 90 * W / 400; i++) s += `<circle cx="${f1(r() * W)}" cy="${f1(r() * H * .5)}" r="${f1(r() * 1.6 + .3)}" fill="#fff" opacity="${f1(.4 + r() * .6)}"/>`;
    const sx = fx(80 + r() * 240), sy = 150 + r() * 110;
    s += `<circle cx="${f1(sx)}" cy="${f1(sy)}" r="120" fill="url(#${id}g)"/>`;
    s += p.moon ? `<circle cx="${f1(sx)}" cy="${f1(sy)}" r="30" fill="${p.sun}"/><circle cx="${f1(sx - 8)}" cy="${f1(sy - 6)}" r="6" fill="#00000010"/><circle cx="${f1(sx + 9)}" cy="${f1(sy + 7)}" r="4" fill="#00000010"/>`   // full moon only
                : folkSun(sx, sy, 32, p.sun, theme !== 'winter' && theme !== 'dawn');
    if (!p.stars) for (let i = 0; i < 4 * W / 400; i++) s += cloud(r() * W, 70 + r() * 210, 60 + r() * 60, f1(.55 + r() * .35));
    s += `<path d="${wave(r, 440, 60, W, H, Math.round(4 * W / 400))}" fill="${p.far}"/>`;
    if (p.mist) s += `<rect y="410" width="${W}" height="90" fill="#fff" opacity=".35"/>`;
    // Idel / Volga: wide river with the high far bank
    const riverY = p.idel ? 520 : 0;
    if (p.idel) {
      s += `<path d="M0 470 C ${fx(80)} 430, ${fx(160)} 455, ${fx(230)} 440 S ${fx(360)} 420, ${W} 450 L${W} 520 L0 520 Z" fill="${p.far}"/>`;
      s += `<rect y="505" width="${W}" height="110" fill="url(#${id}w)" opacity=".95"/>`;
      for (let i = 0; i < 18 * W / 400; i++) s += `<rect x="${f1(r() * W)}" y="${f1(512 + r() * 95)}" width="${f1(20 + r() * 60)}" height="2" fill="#fff" opacity=".55" rx="1"/>`;
      if (p.boat) { const bx = fx(60 + r() * 260); s += `<g><path d="M${f1(bx - 26)} 556 L${f1(bx + 26)} 556 L${f1(bx + 18)} 566 L${f1(bx - 18)} 566 Z" fill="${C.red2}"/><path d="M${f1(bx)} 554 L${f1(bx)} 512 L${f1(bx + 22)} 552 Z" fill="${C.cream}"/><path d="M${f1(bx - 2)} 552 L${f1(bx - 2)} 520 L${f1(bx - 18)} 552 Z" fill="${C.white}" opacity=".9"/></g>`; }
    }
    if (p.lights) s += kremlin(fx(40), fx(250), 452, 26, r, '#0b2228');
    if (p.gulls) for (let i = 0; i < 5; i++) { const gx = r() * W, gy = 300 + r() * 100; s += `<path d="M${f1(gx - 7)} ${f1(gy)} q 4 -5 7 0 q 3 -5 7 0" stroke="#fff" stroke-width="1.6" fill="none"/>`; }
    s += `<path d="${wave(r, p.idel ? 600 : 505, 42, W, H, Math.round(6 * W / 400))}" fill="${p.mid}"/>`;
    if (p.kremlin) { s += kremlin(fx(30), fx(370), 560, 70, r); s += `<path d="${wave(r, 575, 18, W, H, Math.round(5 * W / 400))}" fill="${p.near}"/>`; }
    // tree line
    if (p.trees && p.trees !== 'none' && !p.kremlin) for (let i = 0; i < 26 * W / 400; i++) {
      const x = i * 16 + r() * 8, y = (p.idel ? 610 : 512) + r() * 22, sz = 28 + r() * 34;
      const kind = p.trees === 'forest' ? (r() < .6 ? 'pine' : 'oak') : p.trees === 'mixed' ? (r() < .5 ? 'pine' : 'birch') : p.trees;
      if (kind === 'pine' || kind === 'pinesnow') s += pine(x, y, sz, p.near, kind === 'pinesnow');
      else if (kind === 'birch') s += birch(x, y, sz * .9, p.near, r);
      else if (kind === 'oak') s += oak(x, y, sz * .9, theme === 'autumn' ? ['#c4602a', '#e0952e', '#a0401e'][i % 3] : p.near, r, theme === 'autumn' ? C.red : null);
    }
    if (p.lake) {
      s += `<path d="M0 600 C ${fx(100)} 580, ${fx(300)} 590, ${W} 600 L${W} 712 L0 712 Z" fill="url(#${id}w)" opacity=".9"/>`;
      for (let i = 0; i < 14 * W / 400; i++) s += `<rect x="${f1(r() * W)}" y="${f1(606 + r() * 100)}" width="${f1(20 + r() * 50)}" height="2" fill="#fff" opacity=".5" rx="1"/>`;
      if (p.lilies) for (let i = 0; i < 5 * W / 400; i++) s += lily(fx(30) + r() * (W - fx(60)), 640 + r() * 60, 9 + r() * 5);
      for (let i = 0; i < 16 * W / 400; i++) { const x = r() * W; s += `<path d="M${f1(x)} 716 q ${f1((r() - .5) * 8)} -30 ${f1((r() - .5) * 10)} -${f1(36 + r() * 20)}" stroke="#2f5a30" stroke-width="2" fill="none"/>`; }
    }
    if (p.river) {
      s += `<path d="M0 640 C ${fx(120)} 600, ${fx(260)} 690, ${W} 620 L${W} 700 C ${fx(260)} 760, ${fx(120)} 660, 0 720 Z" fill="url(#${id}w)" opacity=".92"/>`;
      for (let i = 0; i < 10; i++) s += `<rect x="${f1(r() * W)}" y="${f1(645 + r() * 60)}" width="${f1(18 + r() * 40)}" height="2" fill="#fff" opacity=".55" rx="1"/>`;
    }
    if (p.houses) { const n = Math.round(3 * W / 400); for (let i = 0; i < n; i++) s += house(fx(10) + i * (W - fx(10)) / n + r() * 6, 650 + r() * 10, 64 + r() * 10, r); }
    if (p.kurai) { const n = Math.round((p.kurai >= 1 ? 22 : 9) * W / 400); for (let i = 0; i < n; i++) s += kuraiStem(r() * W, 690 + r() * 40, 110 + r() * 120, '#6a5a2a', r); }
    if (p.sabantuy) {
      const px = fx(200); s += bunting(-10, 430, px, 300, 40, r) + bunting(px, 300, W + 10, 440, 40, r) + sabantuyPole(px, 650, 360, r);
      for (let i = 0; i < 3; i++) s += bunting(fx(20 + i * 10), 520 + i * 30, W - fx(20), 525 + i * 32, 18, r);
    }
    s += `<path d="${wave(r, p.idel ? 690 : p.lake || p.river ? 720 : 650, 28, W, H, Math.round(5 * W / 400))}" fill="${p.ground}"/>`;
    if (p.wheat) { for (let i = 0; i < 10 * W / 400; i++) s += `<path d="M${f1(-50 + i * 60)} ${H} L${f1(150 + i * 40)} 560" stroke="${p.near}" stroke-width="10" opacity=".35"/>`;
      for (let i = 0; i < 50 * W / 400; i++) { const x = r() * W, y = 690 + r() * 110; s += `<path d="M${f1(x)} ${f1(y)} l 0 -22" stroke="#e8c050" stroke-width="1.6"/><ellipse cx="${f1(x)}" cy="${f1(y - 25)}" rx="2.2" ry="5" fill="#f4d060"/>`; } }
    if (p.stacks) for (let i = 0; i < 3 * W / 400; i++) { const x = fx(40) + r() * (W - fx(80)), y = 600 + r() * 30, z = 22 + r() * 10; s += `<path d="M${f1(x - z)} ${f1(y)} Q ${f1(x - z)} ${f1(y - z * 1.6)} ${f1(x)} ${f1(y - z * 1.7)} Q ${f1(x + z)} ${f1(y - z * 1.6)} ${f1(x + z)} ${f1(y)} Z" fill="#d8a83e"/><path d="M${f1(x - z * .7)} ${f1(y - z * .6)} L${f1(x + z * .7)} ${f1(y - z * .6)}" stroke="#a87a26" stroke-width="2"/>`; }
    // foreground ornamental flowers (embroidery style)
    if (p.flowers) {
      const n = Math.round(14 * p.flowers * W / 400), cols = [C.red, C.gold, C.cream, '#d8406a', C.red2];
      for (let i = 0; i < n; i++) {
        const x = r() * W, y = 705 + r() * 100, z = 24 + r() * 18, k = r(), col = cols[Math.floor(r() * cols.length)];
        s += k < .4 ? tulip(x, y, z, col) : k < .7 ? carnation(x, y, z, col) : bloom(x, y, z * .8, col);
      }
    }
    if (p.leaves) for (let i = 0; i < 30 * W / 400; i++) { const x = r() * W, y = r() * H, a = r() * 180; s += `<path d="M0 -7 C4 -4 4 4 0 7 C-4 4 -4 -4 0 -7 Z" fill="${r() < .5 ? C.gold : '#d0602a'}" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a)})" opacity=".85"/>`; }
    if (p.snow) { for (let i = 0; i < 70 * W / 400; i++) s += `<circle cx="${f1(r() * W)}" cy="${f1(r() * H)}" r="${f1(1 + r() * 2)}" fill="#fff" opacity=".85"/>`; for (let i = 0; i < 6 * W / 400; i++) s += snowflake(r() * W, 60 + r() * 600, 7 + r() * 6); }
    if (p.lights) for (let i = 0; i < 20 * W / 400; i++) s += `<circle cx="${f1(r() * W)}" cy="${f1(560 + r() * 220)}" r="${f1(1 + r() * 1.5)}" fill="#ffe680" opacity="${f1(.4 + r() * .5)}"/>`;
    const sc = theme === 'night' || theme === 'sunset' ? [C.gold, C.cream] : [C.cream, C.gold];
    s += spray(-4, 92, 1.25, false, sc[0], sc[1], .55) + spray(W + 4, 92, 1.25, true, sc[0], sc[1], .55);
    return s + '</svg>';
  }
  /* ---------- ornament tiles for UI ---------- */
  // square band tile: tulip with leaves, chain-stitch dots in the corners (used as repeat-x border)
  function ornamentTile(col, col2, size) {
    const z = size || 24;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${z}" height="${z}" viewBox="0 0 24 24">` +
      `<path d="M12 23 C12 19 12 16 12 13" stroke="${col}" stroke-width="1.5" fill="none"/>` +
      `<path d="M12 20 C8 20 5.5 17.5 5 14.5 C8 14.5 10.5 16.5 12 20 Z M12 20 C16 20 18.5 17.5 19 14.5 C16 14.5 13.5 16.5 12 20 Z" fill="${col}" opacity=".9"/>` +
      `<path d="M7.5 5 C7.5 9.5 9.2 13 12 13 C14.8 13 16.5 9.5 16.5 5 L14.2 7.4 L12 2.6 L9.8 7.4 Z" fill="${col}"/>` +
      `<path d="M12 6.4 L13.2 9 L12 11.2 L10.8 9 Z" fill="${col2}"/>` +
      `<circle cx="1.5" cy="12" r="1" fill="${col}"/><circle cx="22.5" cy="12" r="1" fill="${col}"/></svg>`;
  }
  // wide band: alternating tulip and carnation on a stitched line (for panel tops / logo)
  function bandSvg(col, col2, bg) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="20" viewBox="0 0 64 20">` + (bg ? `<rect width="64" height="20" fill="${bg}"/>` : '') +
      `<path d="M0 17 H64" ${ST(col, 1.2)}/>` +
      `<g transform="translate(16 17) scale(.42)">` + tulipFlat(col, col2) + `</g>` +
      `<g transform="translate(48 17) scale(.42)">` + carnFlat(col2 === '#ffffff' ? col : C.red, col) + `</g>` +
      `<path d="M27 11 c3 -4 7 -4 10 0 c-3 4 -7 4 -10 0 Z" fill="${col}" opacity=".7"/></svg>`;
  }
  function tulipFlat(col, col2) { return `<path d="M0 0 V-18" stroke="${col}" stroke-width="2.4"/><path d="M0 -4 C-8 -5 -12 -11 -12 -17 C-6 -16 -2 -11 0 -4 Z M0 -4 C8 -5 12 -11 12 -17 C6 -16 2 -11 0 -4 Z" fill="${col}"/><path d="M-8 -36 C-9 -27 -5 -20 0 -20 C5 -20 9 -27 8 -36 L4 -31 L0 -38 L-4 -31 Z" fill="${col}"/><path d="M0 -33 L2 -28 L0 -24 L-2 -28 Z" fill="${col2}"/>`; }
  function carnFlat(col, col2) { let fan = 'M-10 -26 '; for (let i = 0; i <= 6; i++) { const a = Math.PI * (1.12 + i * .127); fan += `L${f1(Math.cos(a) * 14)} ${f1(-22 + Math.sin(a) * 14)} L${f1(Math.cos(a + .063) * 10.5)} ${f1(-22 + Math.sin(a + .063) * 10.5)} `; }
    return `<path d="M0 0 V-16" stroke="${col2}" stroke-width="2.4"/><path d="${fan}L10 -26 Z" fill="${col}"/><path d="M-6 -19 Q0 -13 6 -19 L4 -26 L-4 -26 Z" fill="${col2}"/>`; }
  // corner motif for panels: carnation sprig with leaves, pos = tl|tr|bl|br
  function cornerSvg(col, col2, pos) {
    const t = { tl: '', tr: 'translate(48 0) scale(-1 1)', bl: 'translate(0 48) scale(1 -1)', br: 'translate(48 48) scale(-1 -1)' }[pos] || '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g transform="${t}">` +
      `<path d="M3 44 V12 Q3 3 12 3 H44" fill="none" stroke="${col}" stroke-width="1.6"/><path d="M7 40 V14 Q7 7 14 7 H40" fill="none" ${ST(col, 1.1)}/>` +
      `<g transform="translate(16 16) rotate(-45) scale(.5)">` + tulipFlat(col, col2) + `</g>` +
      `<path d="M22 9 c4 -3 8 -3 11 0 c-3 3 -7 3 -11 0 Z M9 22 c-3 4 -3 8 0 11 c3 -3 3 -7 0 -11 Z" fill="${col}" opacity=".8"/></g></svg>`;
  }
  // ichigi-style leather mosaic ring for the letter wheel (segments of red/green/gold/cream with stitched seams)
  function wheelSvg() {
    const N = 16, R1 = 50, R2 = 44, R3 = 40; let g = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100">`;
    g += `<circle r="50" fill="${C.red2}"/>`;
    g += `<defs><radialGradient id="wc" cx=".5" cy=".38"><stop offset="0" stop-color="#fffaf0"/><stop offset=".7" stop-color="#fbf1dc"/><stop offset="1" stop-color="#efdcb4"/></radialGradient></defs><circle r="44" fill="url(#wc)"/>`;
    const cols = [C.red, C.green, C.gold, C.green];
    for (let i = 0; i < N; i++) {
      const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, am = (a0 + a1) / 2;
      const P2 = (r, a) => `${f1(Math.cos(a) * r * 10) / 10} ${f1(Math.sin(a) * r * 10) / 10}`;
      g += `<path d="M${P2(R2, a0)} L${P2(R1 - .6, a0)} A${R1 - .6} ${R1 - .6} 0 0 1 ${P2(R1 - .6, a1)} L${P2(R2, a1)} A${R2} ${R2} 0 0 0 ${P2(R2, a0)} Z" fill="${cols[i % 4]}" stroke="${C.cream}" stroke-width=".35" stroke-dasharray=".7 .5"/>`;
      g += `<path d="M${P2(R2 + .6, am - .12)} Q ${P2(R1 - 1.2, am)} ${P2(R2 + .6, am + .12)} Z" fill="${i % 4 === 2 ? C.red : C.cream}" opacity=".9"/>`;
    }
    g += `<circle r="${R2}" fill="none" stroke="${C.gold}" stroke-width="1.2"/><circle r="${R3 + 1.6}" fill="none" stroke="${C.gold}" stroke-width=".5" stroke-dasharray="1 .7"/>`;
    return g + `</svg>`;
  }
  // app icon: ichigi mosaic medallion with a tulip and carnations
  function iconSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="ib" cx=".5" cy=".4"><stop offset="0" stop-color="#16774f"/><stop offset="1" stop-color="${C.green2}"/></radialGradient></defs>` +
      `<rect width="512" height="512" rx="112" fill="url(#ib)"/><rect x="22" y="22" width="468" height="468" rx="94" fill="none" ${ST(C.gold, 4)}/>` +
      `<g transform="translate(256 256) scale(4.3)">` + wheelSvg().replace(/^<svg[^>]*>/, '').replace('</svg>', '') + `<circle r="40" fill="${C.cream}"/></g>` +
      `<g transform="translate(256 360) scale(5.2)">` + tulipFlat(C.red, C.gold) + `</g>` +
      `<g transform="translate(186 352) rotate(-38) scale(2.6)">` + carnFlat(C.gold, C.leaf) + `</g><g transform="translate(326 352) rotate(38) scale(2.6)">` + carnFlat(C.gold, C.leaf) + `</g>` +
      `<path d="M256 362 v-90" stroke="${C.leaf}" stroke-width="0"/></svg>`;
  }
  function uri(svg) { return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")'; }
  const cache = {};
  window.Art = {
    themes: Object.keys(P), palette: t => P[t] || P.meadow, colors: C,
    scene, bg(theme, seed, wide) { const k = theme + ':' + seed + (wide ? ':w' : ''); return cache[k] || (cache[k] = uri(scene(theme, seed, wide))); },
    ornament(col, col2, size) { return uri(ornamentTile(col || C.gold, col2 || C.green, size)); },
    band(col, col2, bg) { return uri(bandSvg(col || C.gold, col2 || C.red, bg)); },
    corner(pos, col, col2) { return uri(cornerSvg(col || C.gold, col2 || C.red, pos)); },
    wheel() { return uri(wheelSvg()); }, iconSvg,
  };
})();
