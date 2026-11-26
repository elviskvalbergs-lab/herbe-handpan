// Draws a link-preview card (og/<family>.jpg, 1200 × 630) in the style of
// the others: the logo, the instrument's name and line on cream, and its
// picture from the app's own drawing on the right. Uses Playwright.
//   node scripts/og-card.mjs tongue-drum "Tongue drum" "Every tuning: chords, arpeggios and play-along" TD-D-Kurd-9
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [family, title, line, tuningId] = process.argv.slice(2);
const { renderPan } = await import(join(ROOT, 'js/pan.js'));
const { createLayoutFromScale } = await import(join(ROOT, 'js/data.js'));
const { findTuning } = await import(join(ROOT, 'js/layoutfamilies.js'));
// An ocarina, flute or recorder: "chart:<chartId>/<keyId>[@note]" draws one of
// its fingerings (the lowest note unless a note is given).
//   node scripts/og-card.mjs recorder "Recorder" "Every note's fingering, and chords as arpeggios" chart:recorder-baroque/soprano@G5
const chartArg = /^chart:([^/]+)\/([^@]+)(?:@(.+))?$/.exec(tuningId ?? '');
let pan, css;
if (chartArg) {
  const { instrumentFromChart } = await import(join(ROOT, 'js/charts.js'));
  const { renderFingering } = await import(join(ROOT, 'js/ocarina-ui.js'));
  const { noteToMidi } = await import(join(ROOT, 'js/data.js'));
  const inst = instrumentFromChart(chartArg[1], chartArg[2]);
  pan = renderFingering(inst, chartArg[3] ? noteToMidi(chartArg[3]) : inst.chambers[0].notes[0], { size: 'large', useFlats: true });
  css = ':root{--surface-0:#EADBC3;--border:#E0CFB4;--border-strong:#BBA584;--text-1:#28271F;--text-2:#46432F;--text-3:#66614B;--accent:#B3633F;--accent-text:#9A5333;--move-lift:#2F6F73;--move-cover:#8A5A00;--hole-covered:#28271F;--hole-open:#FBF6EC}'
    + readFileSync(join(ROOT, 'css/fingering.css'), 'utf8') + '.r svg.fingering{width:460px;height:auto}';
} else {
  pan = renderPan(createLayoutFromScale(findTuning(tuningId)), {});
  css = readFileSync(join(ROOT, 'css/pan-drawing.css'), 'utf8');
}
const logo = readFileSync(join(ROOT, 'brand/horizontal_oak_olive.svg'), 'utf8');
const font = w => `@font-face{font-family:T;font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(join(ROOT, `fonts/oakhum-text-${w}.woff2`)).toString('base64')})}`;
const html = `<!doctype html><style>${font(400)}${font(600)}
:root{--pan-g0:#FBF6EC;--pan-g1:#E9DCC5;--pan-g2:#D1BE9F;--pan-i0:#F6EEDF;--pan-i1:#E2D3B9;--pan-rim:#A48F6E;--pan-groove:#BBA584;--pan-guide:#BBA584;--pan-note-stroke:#B09A78;--note-rest-bg:#FBF6EC;--note-rest-text:#5A553F;--note-empty-border:#A48F6E}
${css}
body{margin:0;width:1200px;height:630px;display:flex;font-family:T,sans-serif;background:#F2E6D3}
.l{width:700px;padding:80px;box-sizing:border-box;display:flex;flex-direction:column}
.logo svg{height:44px;width:auto}
h1{margin:110px 0 18px;font-size:76px;font-weight:600;color:#28271F;letter-spacing:-.01em}
p{margin:0;font-size:31px;line-height:1.35;color:#46432F}
.cta{margin-top:auto;color:#9A5333;font-size:28px;font-weight:600}
.r{flex:1;background:#EADBC3;display:flex;align-items:center;justify-content:center}.r svg{width:380px;height:380px}</style>
<div class="l"><div class="logo">${logo}</div><h1>${title}</h1><p>${line}</p><div class="cta">Free · open it and play</div></div><div class="r">${pan}</div>`;
const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html);
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: join(ROOT, `og/${family}.jpg`), type: 'jpeg', quality: 88 });
await b.close();
console.log(`og/${family}.jpg`);
