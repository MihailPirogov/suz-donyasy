// node render_svg.js in.svg out.png W H  -> transparent PNG via headless Chrome
const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => { const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const p = await b.newPage();
  for (const [src, out, w, h] of jobs) {
    await p.setViewportSize({ width: w, height: h });
    const svg = fs.readFileSync(src, 'utf8');
    await p.setContent(`<html><body style="margin:0;background:transparent"><img style="display:block;width:${w}px;height:${h}px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`);
    await p.waitForTimeout(80); await p.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  } await b.close(); })();
