// The still scenes of the overview video (docs/video-plan.md §1), 1920 x 1080,
// with the shared look (../scene-kit.js). The scene with a phone leaves room
// for the chords recording (../record.js), which compose.py lays on top.
const { chromium } = require('playwright');
const fs = require('fs');
const { pic, brand, copy, phone, logo, shooter, appShot } = require('../scene-kit');
const OUT = __dirname + '/scenes/';

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();

  // The app's first screen on a new phone: "What do you play?" and the tiles.
  await appShot(b, 'https://oakhum.com/play', OUT + 'app-setup.png', {
    wait: 3500,
    before: async (ph) => {
      const close = ph.getByRole('button', { name: /dismiss|close|not now/i }).first();
      if (await close.count()) await close.click().catch(() => {});
      await ph.getByText('What do you play?').first().scrollIntoViewIfNeeded();
      await ph.evaluate(() => window.scrollBy(0, 330));
      await ph.waitForTimeout(400);
    },
  });

  const { shot } = await shooter(b, OUT);
  const notes = (spots) => spots.map(([x, y, s, o]) => `<div style="position:absolute;left:${x}px;top:${y}px;font-size:${s}px;color:#B3633F;opacity:${o}">♪</div>`).join('');

  // 1–3: why
  await shot('o1', `<img src="${brand('hero-wide.webp')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:60% 100%">
    <div class="copy" style="width:1300px;justify-content:flex-start;padding-top:440px"><div class="big" style="font-size:76px">You fell in love with the sound</div></div>`);
  await shot('o2', `${copy('Nobody taught you music', 'So when friends start to jam, you listen.')}
    <img src="${pic('handpan')}" style="position:absolute;left:1240px;top:430px;width:420px;filter:grayscale(.6);opacity:.6">
    ${notes([[1180, 170, 90, .5], [1420, 120, 70, .35], [1640, 210, 110, .45], [1330, 280, 60, .25]])}`);
  await shot('o3', `${copy('Join in. Have fun.', 'No lessons, no theory: just you and your instrument.')}
    <img src="${pic('tongue-drum')}" style="position:absolute;left:1060px;top:520px;width:260px">
    <img src="${pic('kalimba')}" style="position:absolute;left:1180px;top:300px;width:260px">
    <img src="${pic('handpan')}" style="position:absolute;left:1330px;top:420px;width:420px">
    <img src="${pic('ocarina')}" style="position:absolute;left:1600px;top:300px;width:240px">
    <img src="${pic('native-american-flute')}" style="position:absolute;left:1540px;top:700px;width:320px">`);

  // 4: how; 5: what (the chords recording is laid into the phone)
  await shot('o4', `${copy('It starts from <em style="font-style:italic">your</em> instrument', 'Play its notes, and Oakhum works out what you have. Or pick it from the list.')}${phone(`<img src="file://${OUT}app-setup.png">`)}`);
  await shot('o5', `${copy('Every chord, right on your instrument', 'Tap one, and it lights up and plays. A friend plays a chord? Oakhum listens.')}${phone()}`);

  // 6: ending
  await shot('o6', `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;text-align:center">
      <div class="svg" style="width:620px">${logo}</div>
      <div class="big" style="font-size:92px">Find the music hiding in your instrument</div>
      <div class="sub">Handpans, kalimbas, flutes and more · Free, in your browser</div>
      <div style="font-size:72px;font-weight:700;color:#A65A37">oakhum.com</div></div>`);
  await b.close();
  console.log('scenes done');
})();
