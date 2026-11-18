// Records the website's playable handpan (oakhum.com/instruments/handpan, D Kurd)
// at 1920 x 1080 with its own sound: the "your shop links here" scene of the
// makers video. Same technique as ../record.js: screenshots at 1.5x in a loop,
// and the page's Web Audio output tapped and saved with MediaRecorder.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __dirname + '/shop/';

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT + 'frames', { recursive: true });
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    const orig = AudioNode.prototype.connect;
    const taps = new WeakMap();
    AudioNode.prototype.connect = function (target, ...rest) {
      if (target instanceof AudioDestinationNode) {
        let tap = taps.get(target.context);
        if (!tap) {
          tap = target.context.createMediaStreamDestination();
          taps.set(target.context, tap);
          const r = new MediaRecorder(tap.stream, { mimeType: 'audio/webm;codecs=opus' });
          window.__chunks = [];
          r.ondataavailable = e => e.data.size && window.__chunks.push(e.data);
          r.start(250);
          window.__rec = r; window.__recStart = Date.now();
        }
        orig.call(this, tap);
      }
      return orig.call(this, target, ...rest);
    };
  });
  const page = await ctx.newPage();
  await page.goto('https://oakhum.com/instruments/handpan', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(800);

  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  let shooting = true;
  const shooter = (async () => {
    while (shooting) {
      const t = Date.now();
      const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, optimizeForSpeed: true, clip: { x: 0, y: 0, width: 1280, height: 720, scale: 1.5 } }).catch(() => null);
      if (!r) continue;
      const file = `frames/${String(frames.length).padStart(5, '0')}.jpg`;
      frames.push({ file, t });
      fs.writeFileSync(OUT + file, Buffer.from(r.data, 'base64'));
    }
  })();
  const start = Date.now();
  const marks = [];
  await page.waitForTimeout(1200);
  for (const name of ['B♭', 'F', 'C', 'Dm']) {
    const btn = page.locator('button').filter({ hasText: new RegExp(`^${name}$`) }).first();
    const box = await btn.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
    marks.push({ name, t: (Date.now() - start) / 1000 });
    await btn.click();
    await page.waitForTimeout(2600);
  }
  shooting = false; await shooter;
  const audio = await page.evaluate(async () => {
    if (!window.__rec) return null;
    await new Promise(res => { window.__rec.onstop = res; window.__rec.stop(); });
    const buf = new Uint8Array(await new Blob(window.__chunks).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { start: window.__recStart, data: btoa(s) };
  });
  await b.close();
  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => lines.push(`file ${f.file}`, `duration ${(((frames[i + 1]?.t ?? f.t + 500) - f.t) / 1000).toFixed(3)}`));
  lines.push(`file ${frames.at(-1).file}`);
  fs.writeFileSync(OUT + 'frames.ffconcat', lines.join('\n'));
  if (audio) fs.writeFileSync(OUT + 'audio.webm', Buffer.from(audio.data, 'base64'));
  // Audio offset relative to the first frame (negative: the audio started earlier).
  fs.writeFileSync(OUT + 'timeline.json', JSON.stringify({ audioOffset: audio ? (audio.start - frames[0].t) / 1000 : null, firstFrame: (frames[0].t - start) / 1000, marks }, null, 2));
  console.log('shop frames', frames.length, 'audio', !!audio);
})();
