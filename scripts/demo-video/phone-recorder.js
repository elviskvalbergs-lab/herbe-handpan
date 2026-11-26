// Records the live app on a phone-sized page (390 x 844 at 2x) with its own
// sound, for any video: frames straight from Chrome with their times, the
// page's Web Audio output tapped and saved with MediaRecorder (Playwright's
// screen video has no sound), and the times of the taps. The same technique
// as ./record.js, which made the makers video's recording.
//
//   const { recordPhone } = require('../phone-recorder');
//   await recordPhone(OUT + 'chords/', 'https://oakhum.com/handpan/d-kurd/chords', async (page, mark) => {
//     mark('D Minor'); await page.click(...); await page.waitForTimeout(3000);
//   }, { mic: 'guitar.wav' });
//
// Writes <out>/frames/, <out>/frames.ffconcat, <out>/audio.webm (when the page
// made a sound) and <out>/timeline.json ({ audioOffset, marks }), which
// videokit.Phone(<out>) reads.
//   mic: a WAV the page hears as its microphone (Listen, Play my notes). Chromium
//        plays it from the moment the page opens the microphone, and loops it.
const { chromium } = require('playwright');
const fs = require('fs');

function tapAudio() {
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
}

async function recordPhone(OUT, url, steps, { mic, settle = 1500, prepare } = {}) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT + 'frames', { recursive: true });
  const args = ['--autoplay-policy=no-user-gesture-required'];
  if (mic) args.push('--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${mic}`);
  const b = await chromium.launch({ args });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: mic ? ['microphone'] : [] });
  await ctx.addInitScript(tapAudio);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  let shooting = true;
  const videoStart = Date.now();
  const marks = [];
  const mark = (name) => marks.push({ name: String(name), t: (Date.now() - videoStart) / 1000 });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(settle);
  if (prepare) await prepare(page);
  // Screenshots in a loop (device pixels: 780 x 1688), each with the time it was taken.
  const shooter = (async () => {
    while (shooting) {
      const t = Date.now();
      // What is on screen, at device pixels. A clip is in page coordinates,
      // so it follows the page's scroll (a playing song scrolls the page).
      const sc = await cdp.send('Runtime.evaluate', { expression: '[scrollX, scrollY]', returnByValue: true }).catch(() => null);
      const [x, y] = sc?.result?.value ?? [0, 0];
      const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, optimizeForSpeed: true, clip: { x, y, width: 390, height: 844, scale: 2 } }).catch(() => null);
      if (!r) continue;
      const file = `frames/${String(frames.length).padStart(5, '0')}.jpg`;
      frames.push({ file, t });
      fs.writeFileSync(OUT + file, Buffer.from(r.data, 'base64'));
    }
  })();
  await page.evaluate(() => { window.__wantRec = true; window.__startRec(); });
  await page.waitForTimeout(500);
  mark('start');
  await steps(page, mark);
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
  await b.close();
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
  const timeline = { audioOffset: audio.start ? (audio.start - videoStart) / 1000 : null, marks };
  fs.writeFileSync(OUT + 'timeline.json', JSON.stringify(timeline, null, 2));
  console.log(OUT, `${frames.length} frames`, JSON.stringify(marks.map(m => `${m.name} ${m.t.toFixed(1)}`)));
  return timeline;
}

module.exports = { recordPhone };
