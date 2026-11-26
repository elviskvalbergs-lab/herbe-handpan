// The still scenes of the overview video (the first cut of 19 Nov; the current script is docs/video-plan.md §4), 1920 x 1080,
// with the shared look (../scene-kit.js). The scene with a phone leaves room
// for the chords recording (../record.js), which compose.py lays on top.
const { chromium } = require('playwright');
const fs = require('fs');
const { pic, copy, phone, logo, shooter, appShot } = require('../scene-kit');
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

  // 1–3: why. Music is for everyone; the basics are easier than you think;
  // Oakhum adds the musician's know-how on your own instrument (2 and 3 lay
  // the chords recording into the phone).
  await shot('o1', `${copy('Music is for everyone', 'Play the way you feel. That’s music too.')}
    <img src="${pic('tongue-drum')}" style="position:absolute;left:1060px;top:520px;width:260px">
    <img src="${pic('kalimba')}" style="position:absolute;left:1180px;top:300px;width:260px">
    <img src="${pic('handpan')}" style="position:absolute;left:1330px;top:420px;width:420px">
    <img src="${pic('ocarina')}" style="position:absolute;left:1600px;top:300px;width:240px">
    <img src="${pic('native-american-flute')}" style="position:absolute;left:1540px;top:700px;width:320px">
    ${notes([[1130, 190, 80, .45], [1450, 150, 64, .3], [1700, 230, 96, .4]])}`);
  await shot('o2', `${copy('The basics are easier than you think', 'A few chords and a pattern you remember.')}${phone()}`);
  await shot('o3', `${copy('A musician’s know-how, on <em style="font-style:italic">your</em> instrument', 'Which notes go together, and where they are.')}${phone()}`);

  // 4: how; 5: what
  await shot('o4', `${copy('It starts from <em style="font-style:italic">your</em> instrument', 'Play its notes, and Oakhum works out what you have. Or pick it from the list.')}${phone(`<img src="file://${OUT}app-setup.png">`)}`);
  const card = (title, text) => `<div style="flex:1;background:#FBF6EC;border-radius:28px;padding:44px 40px;box-shadow:0 24px 60px rgba(42,40,32,.14);display:flex;flex-direction:column;gap:16px">
      <div style="font-size:52px;font-weight:700;letter-spacing:-.02em">${title}</div><div style="font-size:32px;color:#6B5E48;line-height:1.3">${text}</div></div>`;
  await shot('o5', `<div style="position:absolute;left:140px;right:140px;top:170px"><div class="big">Jam. Songs. Your own music.</div></div>
    <div style="position:absolute;left:140px;right:140px;top:430px;display:flex;gap:40px">
      ${card('Join a jam', 'A friend plays a chord, and Oakhum shows you where to join in.')}
      ${card('Learn a song', 'Paste its chords and play it step by step.')}
      ${card('Make your own', 'Put chords in an order you like and keep it.')}</div>`);

  // 6: ending
  await shot('o6', `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;text-align:center">
      <div class="svg" style="width:620px">${logo}</div>
      <div class="big" style="font-size:92px">Find the music hiding in your instrument</div>
      <div class="sub">Handpans, kalimbas, flutes and more · Free, in your browser</div>
      <div style="font-size:72px;font-weight:700;color:#A65A37">oakhum.com</div></div>`);
  await b.close();
  console.log('scenes done');
})();
