// Makes the pictures of the help articles from the app itself:
//
//   python3 build.py && node scripts/help-screenshots.mjs [name …]
//
// Reads help/screenshots.json, opens the built app in the pre-installed
// Chromium (scripts/lib/app-browser.mjs: a local server, a fake microphone
// and a stand-in account), follows each entry's steps and writes
// help/img/<name>.jpg. Pictures no entry makes are deleted. Run it whenever a
// screen that is pictured changes; tests/help.test.mjs checks that every
// picture an article shows is made here. Rules: docs/help-centre.md.
import { readFileSync, readdirSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { openApp, ROOT } from './lib/app-browser.mjs';

const spec = JSON.parse(readFileSync(join(ROOT, 'help', 'screenshots.json'), 'utf8'));
const only = process.argv.slice(2);
const OUT = join(ROOT, 'help', 'img');
mkdirSync(OUT, { recursive: true });

const app = await openApp();
let failed = 0;
for (const shot of spec.shots) {
  if (only.length && !only.includes(shot.name)) continue;
  const v = await app.visitor({ ...spec.viewport, scale: 2 });
  // A fixed day, so date-dependent lists (the season's songs) look the same every run.
  await v.page.clock?.setFixedTime?.(new Date('2026-06-15T10:00:00')).catch(() => {});
  try {
    for (const step of shot.steps) {
      if (step.go) await v.go(step.go);
      else if (step.tap) await v.page.locator(`[data-action="${step.tap}"]`).first().click({ timeout: 5000 });
      else if (step.text) await v.page.getByText(step.text, { exact: true }).first().click({ timeout: 5000 });
      else if (step.css) await v.page.locator(step.css).first().click({ timeout: 5000 });
      else if (step.signIn) await v.signIn();
      else if (step.wait) await v.page.waitForTimeout(step.wait);
      else throw new Error(`unknown step ${JSON.stringify(step)}`);
      await v.page.waitForTimeout(350);
    }
    // No toast and no install banner in a help picture.
    await v.page.addStyleTag({ content: '.toast, .install-banner { display: none !important; }' });
    const file = join(OUT, `${shot.name}.jpg`);
    await v.page.screenshot({ path: file, type: 'jpeg', quality: 72 });
    console.log(`ok   ${shot.name}  ${Math.round(statSync(file).size / 1024)} KB`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${shot.name}: ${e.message.split('\n')[0]}`);
  }
  await v.close();
}
await app.close();

if (!only.length) {
  const names = new Set(spec.shots.map(s => `${s.name}.jpg`));
  for (const f of readdirSync(OUT)) if (!names.has(f)) { rmSync(join(OUT, f)); console.log(`removed ${f}`); }
}
process.exit(failed ? 1 : 0);
