// Caption bands (1080 x 330) and an end card (1080 x 1920) in the app's own
// font, colours and logo, rendered as transparent PNGs for ffmpeg to overlay.
const { chromium } = require('playwright');
const fs = require('fs');
const R = require('path').resolve(__dirname, '../..') + '/';
const OUT = __dirname + '/';
const font = w => `@font-face{font-family:Oakhum;font-weight:${w};src:url(file://${R}fonts/oakhum-text-${w}.woff2) format('woff2')}`;
const css = `${font(400)}${font(600)}${font(700)}
  html,body{margin:0;background:transparent}
  body{font-family:Oakhum,sans-serif;color:#2A2820}`;
const logo = fs.readFileSync(R + 'brand/horizontal_ink.svg', 'utf8');

const captions = [
  ['c1', 'What can my handpan<br>actually play?', ''],
  ['c2', 'Pick your scale', 'Here: D Kurd, 9 notes'],
  ['c3', 'Tap a chord', 'It lights up on your own pan'],
  ['c4', 'Dm · B♭ · F · C', 'A whole song on 9 notes'],
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 330 } });
  for (const [id, big, small] of captions) {
    await p.setContent(`<style>${css}
      .band{height:330px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:14px}
      .big{font-size:76px;font-weight:700;letter-spacing:-.02em;line-height:1.05}
      .small{font-size:44px;font-weight:400;color:#6B5E48}</style>
      <div class="band"><div class="big">${big}</div>${small ? `<div class="small">${small}</div>` : ''}</div>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: OUT + id + '.png', omitBackground: true });
  }
  await p.setViewportSize({ width: 1080, height: 1920 });
  await p.setContent(`<style>${css}
    body{background:#F2E6D3;height:1920px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px;text-align:center}
    .logo svg{width:640px;height:auto}
    .line{font-size:64px;font-weight:600;line-height:1.2}
    .sub{font-size:46px;color:#6B5E48;line-height:1.4}
    .url{margin-top:24px;font-size:84px;font-weight:700;color:#A65A37;letter-spacing:-.01em}</style>
    <div class="logo">${logo}</div>
    <div class="line">Every chord your<br>instrument can play</div>
    <div class="sub">Handpan · tongue drum · kalimba<br>ocarina · flute</div>
    <div class="sub">Free in your browser. No sign-up.</div>
    <div class="url">oakhum.com</div>`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: OUT + 'end.png' });
  await b.close();
})();
