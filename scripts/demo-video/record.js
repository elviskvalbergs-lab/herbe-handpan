// Records the live app on D Kurd: the scale, then a Dm – Bb – F – C progression.
// The app's own Web Audio output is tapped inside the page (every connection to
// the destination also goes to a MediaStreamDestination) and saved with
// MediaRecorder, because Playwright's screen video has no sound.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __dirname + '/';

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  });
  await ctx.addInitScript(() => {
    const orig = AudioNode.prototype.connect;
    const taps = new WeakMap();
    AudioNode.prototype.connect = function (target, ...rest) {
      if (target instanceof AudioDestinationNode) {
        const ac = target.context;
        let tap = taps.get(ac);
        if (!tap) {
          tap = ac.createMediaStreamDestination();
          taps.set(ac, tap);
          window.__tapStream = tap.stream;
          if (window.__wantRec) window.__startRec();
        }
        orig.call(this, tap);
      }
      return orig.call(this, target, ...rest);
    };
    window.__chunks = [];
    window.__startRec = () => {
      if (window.__rec || !window.__tapStream) return;
      const r = new MediaRecorder(window.__tapStream, { mimeType: 'audio/webm;codecs=opus' });
      r.ondataavailable = e => e.data.size && window.__chunks.push(e.data);
      r.start(250);
      window.__rec = r; window.__recStart = Date.now();
    };
  });
  const page = await ctx.newPage();
  // Frames straight from Chrome at device pixels (780 x 1688), each with its time.
  fs.rmSync(OUT + 'frames', { recursive: true, force: true }); fs.mkdirSync(OUT + 'frames');
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  // Screenshots in a loop (device pixels: 780 x 1688), each with the time it was taken.
  let shooting = true, shooter;
  const startShooting = () => { shooter = (async () => {
    while (shooting) {
      const t = Date.now();
      const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, optimizeForSpeed: true, clip: { x: 0, y: 0, width: 390, height: 844, scale: 2 } }).catch(() => null);
      if (!r) continue;
      const file = `frames/${String(frames.length).padStart(5, '0')}.jpg`;
      frames.push({ file, t });
      fs.writeFileSync(OUT + file, Buffer.from(r.data, 'base64'));
    }
  })(); };
  const videoStart = Date.now();
  const marks = [];
  const mark = (name) => marks.push({ name: String(name), t: (Date.now() - videoStart) / 1000 });

  await page.goto('https://oakhum.com/handpan/d-kurd/chords', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  startShooting();
  // Wake the audio context (first gesture) so the recorder runs from here on.
  await page.mouse.click(5, 300);
  await page.evaluate(() => { window.__wantRec = true; window.__startRec(); });
  await page.waitForTimeout(800);

  mark('scale');
  await page.getByRole('button', { name: 'Scale' }).click();
  await page.waitForTimeout(6000);

  // Filter by root first, so the chord's row is on screen without scrolling the page.
  const chord = async (root, label, wait = 4200) => {
    await page.locator(`[data-action="filter-root"][data-root="${root}"]`).click();
    await page.waitForTimeout(700);
    const row = page.locator('[data-action="select-chord"]', { hasText: label }).first();
    mark(label);
    await row.click();
    await page.waitForTimeout(wait);
  };
  await chord('D', /^\s*D Minor\s*Minor/);
  await chord('Bb', /^\s*A# Major\s*Major/);
  await chord('F', /^\s*F Major\s*Major/);
  await chord('C', /^\s*C Major\s*Major/, 5000);
  mark('end');

  const audio = await page.evaluate(async () => {
    if (!window.__rec) return { start: null, data: null };
    await new Promise(res => { window.__rec.onstop = res; window.__rec.stop(); });
    const blob = new Blob(window.__chunks, { type: 'audio/webm' });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { start: window.__recStart, data: btoa(s) };
  });
  shooting = false; await shooter;
  console.log('fps', (frames.length / ((frames.at(-1).t - frames[0].t) / 1000)).toFixed(1));
  await ctx.close();
  // ffconcat list: each frame lasts until the next one (Chrome sends frames only when something changes).
  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => {
    const next = frames[i + 1]?.t ?? f.t + 500;
    lines.push(`file ${f.file}`, `duration ${((next - f.t) / 1000).toFixed(3)}`);
  });
  lines.push(`file ${frames[frames.length - 1].file}`);
  fs.writeFileSync(OUT + 'frames.ffconcat', lines.join('\n'));
  marks.unshift({ name: 'firstFrame', t: (frames[0].t - videoStart) / 1000 });
  if (audio.data) fs.writeFileSync(OUT + 'audio.webm', Buffer.from(audio.data, 'base64'));
  fs.writeFileSync(OUT + 'timeline.json', JSON.stringify({ audioOffset: audio.start ? (audio.start - videoStart) / 1000 : null, marks }, null, 2));
  console.log(JSON.stringify({ audioOffset: audio.start && (audio.start - videoStart) / 1000, marks }));
  await b.close();
})();
