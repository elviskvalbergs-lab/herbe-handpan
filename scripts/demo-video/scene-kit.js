// What every 16:9 video's still scenes share (the makers video, the overview):
// the app's font, colours, logo and instrument pictures, the words-on-the-left
// layout, the phone frame that compose.py lays a recording into, and the
// screenshot helper. Each video's scenes.js only says what is in its scenes.
const fs = require('fs');
const path = require('path');
const R = path.resolve(__dirname, '../..') + '/';

// Where compose.py puts a phone recording (780 x 1688 scaled to 420 x 909).
const PHONE = { x: 1180, y: 60, w: 460, h: 952, screen: { x: 1200, y: 82, w: 420, h: 909 } };

const font = w => `@font-face{font-family:Oakhum;font-weight:${w};src:url(file://${R}fonts/oakhum-text-${w}.woff2) format('woff2')}`;
const pic = n => `file://${R}brand/instruments/${n}.webp`;
const brand = n => `file://${R}brand/${n}`;
const css = `${font(400)}${font(600)}${font(700)}
  *{box-sizing:border-box} html,body{margin:0;width:1920px;height:1080px;overflow:hidden}
  body{font-family:Oakhum,sans-serif;color:#2A2820;background:#F2E6D3;position:relative}
  .copy{position:absolute;left:140px;top:0;bottom:0;width:900px;display:flex;flex-direction:column;justify-content:center;gap:28px}
  .big{font-size:84px;font-weight:700;letter-spacing:-.025em;line-height:1.04}
  .sub{font-size:42px;color:#6B5E48;line-height:1.3}
  .n{width:84px;height:84px;border-radius:50%;background:#B3633F;color:#fff;font-size:46px;font-weight:600;display:flex;align-items:center;justify-content:center}
  .phone{position:absolute;left:${PHONE.x}px;top:${PHONE.y}px;width:${PHONE.w}px;height:${PHONE.h}px;border-radius:64px;background:#1C1B16;box-shadow:0 30px 80px rgba(42,40,32,.28)}
  .screen{position:absolute;left:${PHONE.screen.x}px;top:${PHONE.screen.y}px;width:${PHONE.screen.w}px;height:${PHONE.screen.h}px;border-radius:44px;overflow:hidden;background:#F2E6D3}
  .screen img{width:100%;height:100%;object-fit:cover}
  .svg svg{width:100%;height:auto;display:block}`;

const copy = (big, sub, n) => `<div class="copy">${n ? `<div class="n">${n}</div>` : ''}<div class="big">${big}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
const phone = inner => `<div class="phone"></div><div class="screen">${inner ?? ''}</div>`;
const logo = fs.readFileSync(R + 'brand/horizontal_ink.svg', 'utf8');
const leaf = fs.readFileSync(R + 'brand/leaf_only_clay.svg', 'utf8');

// A 1920 x 1080 page that writes each scene to OUT/<name>.png. Scenes are
// written to a file first, so the page may load the local fonts and pictures.
async function shooter(browser, OUT) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const shot = async (name, html) => {
    fs.writeFileSync(OUT + name + '.html', `<!doctype html><meta charset="utf-8"><style>${css}</style>${html}`);
    await p.goto('file://' + OUT + name + '.html', { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: OUT + name + '.png' });
  };
  return { page: p, shot };
}

// A QR code as SVG, with the same library the app uses for Share.
async function qrSvg(page, link) {
  await page.goto('about:blank');
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js' });
  return page.evaluate(l => { const q = qrcode(0, 'M'); q.addData(l); q.make(); return q.createSvgTag({ cellSize: 10, margin: 0, scalable: true }); }, link);
}

// The live app as a phone shows it, at `url`, after `wait` ms.
async function appShot(browser, url, file, { wait = 2500, before } = {}) {
  const ph = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ph.goto(url, { waitUntil: 'load' });
  await ph.waitForTimeout(wait);
  if (before) await before(ph);
  await ph.screenshot({ path: file });
  await ph.close();
}

module.exports = { R, PHONE, css, pic, brand, copy, phone, logo, leaf, shooter, qrSvg, appShot };
