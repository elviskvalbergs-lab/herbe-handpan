// What every video's still scenes share (the makers video, the overview), in
// 16:9 and 9:16: the app's font, colours, logo and instrument pictures, the
// layout of the words, the phone frame that compose.py lays a recording into, and the
// screenshot helper. Each video's scenes.js only says what is in its scenes.
const fs = require('fs');
const path = require('path');
const R = path.resolve(__dirname, '../..') + '/';

const font = w => `@font-face{font-family:Oakhum;font-weight:${w};src:url(file://${R}fonts/oakhum-text-${w}.woff2) format('woff2')}`;
const pic = n => `file://${R}brand/instruments/${n}.webp`;
const brand = n => `file://${R}brand/${n}`;

// The two formats (docs/video-plan.md §1, rule 10). 16:9: words on the left,
// the phone on the right. 9:16: words in a band at the top, the phone below,
// both clear of the top 220 px and (for the words) the bottom 320 px, where
// Reels, Shorts and TikTok put their own buttons. `screen` is where compose.py
// (videokit.GEOM) lays a phone recording: 780 x 1688 scaled to w x h.
const FORMATS = {
  '16x9': { W: 1920, H: 1080, phone: { x: 1180, y: 60, w: 460, h: 952, r: 64, screen: { x: 1200, y: 82, w: 420, h: 909, r: 44 } },
    copy: '.copy{position:absolute;left:140px;top:0;bottom:0;width:900px;display:flex;flex-direction:column;justify-content:center;gap:28px}'
      + '.big{font-size:84px;font-weight:700;letter-spacing:-.025em;line-height:1.04} .sub{font-size:42px;color:#6B5E48;line-height:1.3}' },
  '9x16': { W: 1080, H: 1920, phone: { x: 268, y: 548, w: 544, h: 1126, r: 72, screen: { x: 290, y: 570, w: 500, h: 1082, r: 50 } },
    copy: '.copy{position:absolute;left:70px;right:70px;top:230px;height:300px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:16px}'
      + '.big{font-size:72px;font-weight:700;letter-spacing:-.025em;line-height:1.06} .sub{font-size:38px;color:#6B5E48;line-height:1.3}' },
};

function kit(fmt = '16x9') {
  const F = FORMATS[fmt];
  const P = F.phone;
  const css = `${font(400)}${font(600)}${font(700)}
  *{box-sizing:border-box} html,body{margin:0;width:${F.W}px;height:${F.H}px;overflow:hidden}
  body{font-family:Oakhum,sans-serif;color:#2A2820;background:#F2E6D3;position:relative}
  ${F.copy}
  .n{width:84px;height:84px;border-radius:50%;background:#B3633F;color:#fff;font-size:46px;font-weight:600;display:flex;align-items:center;justify-content:center}
  .phone{position:absolute;left:${P.x}px;top:${P.y}px;width:${P.w}px;height:${P.h}px;border-radius:${P.r}px;background:#1C1B16;box-shadow:0 30px 80px rgba(42,40,32,.28)}
  .screen{position:absolute;left:${P.screen.x}px;top:${P.screen.y}px;width:${P.screen.w}px;height:${P.screen.h}px;border-radius:${P.screen.r}px;overflow:hidden;background:#F2E6D3}
  .screen img{width:100%;height:100%;object-fit:cover}
  .svg svg{width:100%;height:auto;display:block}`;
  // A page of the format's size that writes each scene to OUT/<name>.png. Scenes
  // are written to a file first, so the page may load the local fonts and pictures.
  async function shooter(browser, OUT) {
    const p = await browser.newPage({ viewport: { width: F.W, height: F.H } });
    const shot = async (name, html) => {
      fs.writeFileSync(OUT + name + '.html', `<!doctype html><meta charset="utf-8"><style>${css}</style>${html}`);
      await p.goto('file://' + OUT + name + '.html', { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: OUT + name + '.png' });
    };
    return { page: p, shot };
  }
  return { fmt, W: F.W, H: F.H, PHONE: P, css, shooter };
}

// The 16:9 kit, as the makers video uses it.
const { PHONE, css, shooter } = kit('16x9');

const copy = (big, sub, n) => `<div class="copy">${n ? `<div class="n">${n}</div>` : ''}<div class="big">${big}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
const phone = inner => `<div class="phone"></div><div class="screen">${inner ?? ''}</div>`;
const logo = fs.readFileSync(R + 'brand/horizontal_ink.svg', 'utf8');
const leaf = fs.readFileSync(R + 'brand/leaf_only_clay.svg', 'utf8');

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

module.exports = { R, PHONE, css, pic, brand, copy, phone, logo, leaf, shooter, qrSvg, appShot, kit, FORMATS };
