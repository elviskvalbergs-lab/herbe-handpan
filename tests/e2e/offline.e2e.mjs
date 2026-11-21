// Offline (sw.js, js/offline.js) in a real browser:
//
//   python3 build.py && node tests/e2e/offline.e2e.mjs
//
// Covers: the service worker's install fails when the app's page cannot be
// cached, and Settings does not say "Ready" then; it recovers at the next
// start; with the app cached, a connection that hangs opens the cached app
// after a short wait instead of a blank page; with no connection at all the
// app opens on a deep link too.
import assert from 'node:assert/strict';
import { chromium, serveApp, fakeServer, newDevice, runner, signInWithCode } from './harness.mjs';

const app = await serveApp();
const server = fakeServer();
const browser = await chromium.launch();
const run = runner();
const d = await newDevice(browser, server, 'phone', { base: app.base });
const p = d.page;
p.setDefaultTimeout(10000);
const step = (name, fn) => run.step(name, fn, p);
const swState = () => p.evaluate(async () => ({
  active: !!(await navigator.serviceWorker.getRegistration())?.active,
  cached: !!(await caches.match('/play')),
}));
const offlineRow = () => p.locator('.row', { hasText: 'Offline' }).filter({ hasText: /Ready|Getting ready/ }).first();

let failed = false;
try {
  await step('the app page cannot be fetched at install: no worker, and Settings does not say Ready', async () => {
    await p.goto(`${app.base}/play`);
    // From here on the page answers 503 (the app itself is loaded already).
    app.intercept = (path, res) => path === '/play' && (res.writeHead(503).end('down'), true);
    await p.click('[data-action="open-settings"]');
    await p.click('[data-action="open-sign-in"]');
    await signInWithCode(p, 'a@example.com');
    await p.locator('[data-action="account-signout"]').waitFor();
    await p.waitForTimeout(1500); // the install has failed by now
    assert.deepEqual(await swState(), { active: false, cached: false });
    assert.match(await offlineRow().innerText(), /Getting ready/);
  });

  await step('at the next start the install succeeds: the page is cached and Settings says Ready', async () => {
    app.intercept = null;
    d.problems.splice(0); // the 503 above was the point
    await p.reload(); // still on Settings
    await p.locator('.row', { hasText: 'Ready: the app opens without a connection' }).waitFor();
    assert.deepEqual(await swState(), { active: true, cached: true });
  });

  await step('a connection that hangs: the cached app opens after a short wait', async () => {
    const held = [];
    app.intercept = (path, res) => path === '/play' && (held.push(res), true); // never answers
    const t = Date.now();
    await p.goto(`${app.base}/play`);
    await p.locator('.appbar, .setup-tile').first().waitFor();
    const took = Date.now() - t;
    assert.ok(took >= 3500 && took < 9000, `opened after ${took} ms`);
    held.forEach(res => res.destroy());
    app.intercept = null;
  });

  await step('no connection at all: a deep link opens from the cache', async () => {
    await d.ctx.setOffline(true);
    await p.goto(`${app.base}/handpan/d-kurd/chords`);
    await p.locator('.pan-wrap svg').first().waitFor();
    await p.locator('.offline-pill').waitFor();
    await d.ctx.setOffline(false);
  });
} catch (err) {
  failed = true;
  console.error(err?.stack ?? err);
} finally {
  await browser.close();
  await app.close();
}
console.log(`\n${run.passed} passed${failed ? ', 1 failed' : ''}`);
process.exit(failed ? 1 : 0);
