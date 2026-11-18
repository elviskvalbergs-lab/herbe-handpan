// The still scenes of the makers video (docs/video-script-makers.md), 1920 x 1080,
// in the app's font, colours, logo and instrument pictures. Scenes with a phone
// or a browser leave room for the recordings, which compose.py lays on top.
// Also renders the QR card a maker could print (a real code for the D Kurd page).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const R = path.resolve(__dirname, '../../..') + '/';
const OUT = __dirname + '/scenes/';
const LINK = 'https://oakhum.com/handpan/d-kurd';

// Where compose.py puts the phone recording (780 x 1688 scaled to 420 x 909).
const PHONE = { x: 1180, y: 60, w: 460, h: 952, screen: { x: 1200, y: 82, w: 420, h: 909 } };

const font = w => `@font-face{font-family:Oakhum;font-weight:${w};src:url(file://${R}fonts/oakhum-text-${w}.woff2) format('woff2')}`;
const pic = n => `file://${R}brand/instruments/${n}.webp`;
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

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();

  // The app as the buyer's phone shows it: the instrument's layout tab.
  const ph = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ph.goto(LINK, { waitUntil: 'load' });
  await ph.waitForTimeout(2500);
  await ph.screenshot({ path: OUT + 'app-pan.png' });

  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const shot = async (name, html) => {
    // From a file, so the page may load the local fonts and pictures.
    fs.writeFileSync(OUT + name + '.html', `<!doctype html><meta charset="utf-8"><style>${css}</style>${html}`);
    await p.goto('file://' + OUT + name + '.html', { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: OUT + name + '.png' });
  };

  // QR code for the card, with the same library the app uses for Share.
  await p.goto('about:blank');
  await p.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js' });
  const qr = await p.evaluate(link => { const q = qrcode(0, 'M'); q.addData(link); q.make(); return q.createSvgTag({ cellSize: 10, margin: 0, scalable: true }); }, LINK);
  const logo = fs.readFileSync(R + 'brand/horizontal_ink.svg', 'utf8');
  const leaf = fs.readFileSync(R + 'brand/leaf_only_clay.svg', 'utf8');

  // 1–3: why
  await shot('s1', `<img src="file://${R}brand/hero-sky-wide.webp" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:75% 100%">
    <div class="copy" style="width:820px">${'<div class="big">You put weeks into every instrument you make.</div>'}</div>`);
  await shot('s2', `${copy('But the first week is the hardest for many buyers.', 'They play the scale… and then, what next?')}
    <img src="${pic('handpan')}" style="position:absolute;left:1180px;top:300px;width:520px;filter:grayscale(.7);opacity:.55">
    <div style="position:absolute;left:1120px;top:770px;width:640px;height:14px;border-radius:7px;background:#CDBB9C"></div>`);
  await shot('s3', `${copy('Oakhum helps every buyer keep playing.', 'Even with no musical background. And people who keep playing tell their friends.')}
    <img src="${pic('kalimba')}" style="position:absolute;left:1090px;top:430px;width:300px">
    <img src="${pic('handpan')}" style="position:absolute;left:1260px;top:300px;width:460px">
    <img src="${pic('ocarina')}" style="position:absolute;left:1560px;top:470px;width:280px">`);

  // 4–5: how
  await shot('s4', `${copy('Set it up once', 'Exactly as you built it: your scale, your layout, every bottom note.', 1)}${phone(`<img src="file://${OUT}app-pan.png">`)}`);
  // 5a–5b: the QR code and the NFC tag, one idea each.
  const qrCard = (left, top, w, rot, label) => `<div style="position:absolute;left:${left}px;top:${top}px;width:${w}px;padding:${w * .09}px;border-radius:${w * .05}px;background:#FBF6EC;box-shadow:0 24px 60px rgba(42,40,32,.22);display:flex;flex-direction:column;align-items:center;gap:${w * .06}px;transform:rotate(${rot}deg)">
      <div class="svg" style="width:${w * .55}px">${logo}</div><div class="svg" style="width:${w * .62}px">${qr}</div>
      <div style="font-size:${w * .062}px;font-weight:600;text-align:center;line-height:1.25">${label}</div></div>`;
  const tag = (left, top, size) => `<div style="position:absolute;left:${left}px;top:${top}px;width:${size}px;height:${size}px;border-radius:50%;background:#2A2820;color:#F2E6D3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${size * .03}px;box-shadow:0 18px 44px rgba(42,40,32,.3)">
      <div class="svg" style="width:${size * .28}px">${leaf}</div><div style="font-size:${size * .15}px;font-weight:700;letter-spacing:.08em">NFC</div></div>`;
  const label = (left, top, text) => `<div style="position:absolute;left:${left}px;top:${top}px;font-size:30px;font-weight:600;color:#6B5E48">${text}</div>`;

  await shot('s5a', `${copy('Print its QR code', 'On a card in the case, on the certificate, or on a sticker inside the lid. It opens this exact instrument.', 2)}
    <div style="position:absolute;left:1090px;top:150px;width:440px;height:600px;background:#FBF6EC;border-radius:10px;box-shadow:0 24px 60px rgba(42,40,32,.18);padding:44px;transform:rotate(-4deg)">
      <div style="font-size:22px;letter-spacing:.2em;color:#6B5E48">CERTIFICATE</div>
      <div style="font-size:44px;font-weight:700;margin:14px 0 6px">D Kurd</div>
      <div style="font-size:24px;color:#6B5E48">D3 · A3 B♭3 C4 D4 E4 F4 G4 A4</div>
      ${[0, 1, 2, 3].map(i => `<div style="height:12px;border-radius:6px;background:#E7D9C2;margin-top:${i ? 18 : 40}px;width:${[92, 80, 86, 60][i]}%"></div>`).join('')}
      <div class="svg" style="position:absolute;right:44px;bottom:44px;width:130px">${qr}</div></div>
    ${qrCard(1450, 330, 380, 5, 'Scan to play<br>your D Kurd')}
    ${label(1130, 830, 'Opens oakhum.com/handpan/d-kurd')}`);

  await shot('s5b', `${copy('Or write it to an NFC tag', 'A sticker costs cents. Any free NFC app writes the link to it in a few seconds.', 2)}
    <div class="phone" style="left:1130px;top:120px;width:380px;height:780px;border-radius:56px"></div>
    <div class="screen" style="left:1148px;top:140px;width:344px;height:740px;border-radius:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:30px;text-align:center">
      <div style="font-size:26px;color:#6B5E48">Write to tag</div>
      <div style="font-size:30px;font-weight:600;word-break:break-all;background:#FBF6EC;border-radius:16px;padding:18px 16px;box-shadow:inset 0 0 0 2px #E7D9C2">oakhum.com/<br>handpan/d-kurd</div>
      <div style="width:150px;height:150px;border-radius:50%;box-shadow:0 0 0 14px rgba(179,99,63,.18),0 0 0 32px rgba(179,99,63,.09);background:#B3633F;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:600">Hold<br>near tag</div></div>
    ${tag(1560, 520, 230)}
    ${label(1560, 780, 'NFC sticker, 25 mm')}`);


  // 6–7: the buyer's phone (recording laid on top)
  await shot('s6', `${copy('One tap: their own instrument opens', 'No app store, no sign-up.', 3)}${phone()}`);
  await shot('s7', `${copy('Every chord it can play', 'Songs step by step, and help to join any jam.')}${phone()}`);

  // 8: the maker's shop (browser recording laid on top, 1536 x 864 at 192, 196)
  await shot('s8', `<div style="position:absolute;left:0;right:0;top:44px;text-align:center"><div class="big" style="font-size:64px">Link every scale you sell from your shop</div></div>
    <div style="position:absolute;left:176px;top:180px;width:1568px;height:896px;border-radius:22px;background:#1C1B16;box-shadow:0 30px 80px rgba(42,40,32,.25)"></div>`);

  // 9: ending
  await shot('s9', `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;text-align:center">
      <div class="svg" style="width:620px">${logo}</div>
      <div class="big" style="font-size:92px">Help your instruments get played</div>
      <div class="sub">For makers of handpans, kalimbas, flutes and more · Free</div>
      <div style="font-size:72px;font-weight:700;color:#A65A37">oakhum.com/makers</div></div>`);

  // The card on its own, for a maker to print (A6-ish, 2x).
  const card = await b.newPage({ viewport: { width: 600, height: 840 }, deviceScaleFactor: 2 });
  fs.writeFileSync(OUT + 'qr-card.html', `<!doctype html><meta charset="utf-8"><style>${css} html,body{width:600px;height:840px}</style>
    <div style="position:absolute;inset:0;background:#FBF6EC;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px">
      <div class="svg" style="width:300px">${logo}</div><div class="svg" style="width:340px">${qr}</div>
      <div style="font-size:34px;font-weight:600;text-align:center;line-height:1.25">Scan to play<br>your D Kurd</div>
      <div style="font-size:20px;color:#6B5E48">Every chord your handpan can play · free</div></div>`);
  await card.goto('file://' + OUT + 'qr-card.html', { waitUntil: 'load' });
  await card.evaluate(() => document.fonts.ready);
  await card.screenshot({ path: OUT + 'qr-card.png' });
  await b.close();
  console.log('scenes done');
})();
