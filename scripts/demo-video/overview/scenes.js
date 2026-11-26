// The still scenes of the overview video, "What can your instrument play?"
// (docs/video-plan.md §4), 1920 x 1080, with the shared look (../scene-kit.js).
// o2–o5 are phone scenes: compose.py lays record.js's recordings into the phone.
const { chromium } = require('playwright');
const fs = require('fs');
const { pic, copy, phone, logo, shooter } = require('../scene-kit');
const OUT = __dirname + '/scenes/';

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const { shot } = await shooter(b, OUT);

  // 1: the hook. Three instruments, each with its own notes under it.
  const inst = (name, w, label, notes) => `<div style="display:flex;flex-direction:column;align-items:center;gap:22px;width:520px">
      <div style="height:330px;display:flex;align-items:flex-end"><img src="${pic(name)}" style="width:${w}px"></div>
      <div style="font-size:36px;font-weight:600">${label}</div>
      <div style="font-size:30px;color:#6B5E48;letter-spacing:.02em;text-align:center;line-height:1.35">${notes}</div></div>`;
  await shot('o1', `<div style="position:absolute;left:0;right:0;top:110px;text-align:center"><div class="big">What can <em style="font-style:italic">your</em> instrument play?</div></div>
    <div style="position:absolute;left:80px;right:80px;top:330px;display:flex;justify-content:space-around">
      ${inst('handpan', 380, 'D Kurd handpan', 'D · A B♭ C D E F G A')}
      ${inst('kalimba', 270, '17-key kalimba in C', 'C D E F G A B… from C4 to E6')}
      ${inst('ocarina', 300, 'Alto C ocarina', 'Twelve holes, a fingering for every note')}</div>`);

  // 2–5: words on the left, the recording in the phone.
  await shot('o2', `${copy('It starts from <em style="font-style:italic">your</em> instrument', 'Pick it, or play its notes')}${phone()}`);
  await shot('o3', `${copy('Every chord, on your own instrument')}${phone()}`);
  await shot('o4', `${copy('Songs your notes can play', 'With the tab')}${phone()}`);
  await shot('o5', `${copy('Join in', 'Oakhum hears the chord and shows it on yours')}${phone()}`);

  // 6: the end card (the plan's §2).
  await shot('o6', `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;text-align:center">
      <div class="svg" style="width:620px">${logo}</div>
      <div class="big" style="font-size:92px">Find the music hiding in your instrument</div>
      <div class="sub">Handpans, kalimbas, flutes and more</div>
      <div class="sub" style="color:#2A2820;font-weight:600">Free. No sign-up to try.</div>
      <div style="font-size:72px;font-weight:700;color:#A65A37">oakhum.com</div></div>`);
  await b.close();
  console.log('scenes done');
})();
