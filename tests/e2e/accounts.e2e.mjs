// End-to-end check of accounts (docs/free-to-play.md Phase 4 steps 2–5) in
// a real browser, against a stand-in for Supabase that runs in this
// process (save_item's version rules, email codes, sessions). Not part of
// `node --test` (it needs Playwright and a browser):
//
//   python3 build.py && node tests/e2e/accounts.e2e.mjs
//
// Covers: the save sheet and Not now, sign-in completing the started save,
// carry-over of this visit's work, a second device getting everything,
// offline (reload with no network, the Offline pill, edits syncing when
// back), the guest offline card, and sign-out clearing the device.
import assert from 'node:assert/strict';
import { chromium, serveApp, fakeServer, newDevice, toast, runner } from './harness.mjs';

const app = await serveApp();
const BASE = app.base;
const server = fakeServer();
const { rows } = server;
const browser = await chromium.launch();
const run = runner();
const device = async name => {
  const d = await newDevice(browser, server, name, { base: BASE });
  d.page.setDefaultTimeout(15000);
  d.page.on('pageerror', e => console.log(`[${name}] page error:`, e.message));
  return d;
};
let _page = null;
const step = (name, fn) => run.step(name, fn, _page);

const phone = await device('phone');
let p = _page = phone.page;

await step('a guest plays a deep link with nothing in the way', async () => {
  await p.goto(`${BASE}/handpan/d-kurd/chords`);
  await p.locator('.chord-row, .row').first().waitFor();
  assert.equal(await p.locator('.sheet-root').count(), 0);
});

await step('a guest ☆ opens the save sheet; Not now changes nothing', async () => {
  await p.locator('[data-action="show-playlist-picker"]').first().click();
  await p.locator('.sheet-root[data-sheet="save"]').waitFor();
  assert.match(await p.locator('.sheet-title').innerText(), /Keep this chord/);
  await p.click('.sheet-foot [data-action="save-not-now"]');
  assert.equal(await p.locator('.sheet-root').count(), 0);
  assert.equal(await p.evaluate(() => localStorage.getItem('hp-playlists')), null);
});

await step('the guest builds something this visit (kept in the tab only)', async () => {
  await p.evaluate(() => sessionStorage.setItem('hp-instruments', JSON.stringify([{ id: 'oc-visit', family: 'ocarina', name: 'Clay G', notes: [67, 69], createdAt: '2026-11-16T09:00:00Z', updatedAt: '2026-11-16T09:00:00Z' }])));
});

await step('sign-in completes the save, carries the visit over, and turns offline on', async () => {
  await p.locator('[data-action="show-playlist-picker"]').first().click();
  await p.fill('#save-email-input', 'a@example.com');
  await p.click('[data-action="save-send-code"]');
  await p.fill('#save-code-input', '12345678');
  await toast(p).filter({ hasText: 'Saved to Favourites' }).waitFor();
  await toast(p).filter({ hasText: 'Also saved: Clay G' }).waitFor({ timeout: 6000 });
  const fav = await p.evaluate(() => JSON.parse(localStorage.getItem('hp-playlists')).find(x => x.id === 'favorites').chords.length);
  assert.equal(fav, 1);
  assert.equal(await p.evaluate(() => sessionStorage.getItem('hp-instruments')), null);
  await p.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.getRegistration().then(Boolean), null, { timeout: 10000 });
  await p.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 10000 });
  await p.waitForTimeout(2500); // the first sync round
  const kinds = [...rows.values()].map(r => r.kind).sort();
  assert.ok(kinds.includes('playlist') && kinds.includes('instrument'), `server has ${kinds}`);
});

const tablet = await device('tablet');
const t = tablet.page;
await step('a second device gets everything after signing in', async () => {
  await t.goto(`${BASE}/`);
  await t.click('[data-action="open-settings"]');
  await t.click('[data-action="open-sign-in"]');
  await t.fill('#save-email-input', 'a@example.com');
  await t.click('[data-action="save-send-code"]');
  await t.fill('#save-code-input', '12345678');
  await t.waitForFunction(() => (JSON.parse(localStorage.getItem('hp-instruments') || '[]')).some(i => i.name === 'Clay G'), null, { timeout: 8000 });
  await t.waitForFunction(() => (JSON.parse(localStorage.getItem('hp-playlists') || '[]')).find(x => x.id === 'favorites')?.chords.length === 1);
});

await step('signed in and offline: a reload opens the app, with the Offline pill', async () => {
  await phone.ctx.setOffline(true);
  await p.reload();
  await p.locator('.appbar').first().waitFor();
  await p.locator('.offline-pill').waitFor();
});

await step('an edit made offline waits, then syncs when back online', async () => {
  await p.goto(`${BASE}/#settings`).catch(() => {});
  await p.locator('.appbar').first().waitFor();
  await p.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('hp-instruments'));
    list.find(i => i.id === 'oc-visit').name = 'Clay G (tuned)';
    list.find(i => i.id === 'oc-visit').updatedAt = new Date().toISOString();
    localStorage.setItem('hp-instruments', JSON.stringify(list));
    window.dispatchEvent(new Event('hp-instruments-changed'));
  });
  await p.getByText(/1 change will sync when you're online/).waitFor();
  await phone.ctx.setOffline(false);
  await p.waitForFunction(() => !document.querySelector('.offline-pill'));
  await t.waitForTimeout(2500);
  await t.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await t.waitForFunction(() => JSON.parse(localStorage.getItem('hp-instruments')).some(i => i.name === 'Clay G (tuned)'), null, { timeout: 8000 });
});

await step('sign-out: no service worker, no caches, no saved data', async () => {
  await p.goto(`${BASE}/#settings`);
  await p.click('[data-action="account-signout"]');
  await p.click('[data-action="account-signout-ok"]');
  await toast(p).filter({ hasText: 'Signed out' }).waitFor();
  const left = await p.evaluate(async () => ({
    regs: (await navigator.serviceWorker.getRegistrations()).length,
    caches: (await caches.keys()).length,
    data: ['hp-playlists', 'hp-layouts', 'hp-instruments', 'hp-progressions', 'hp-account'].filter(k => localStorage.getItem(k) != null),
  }));
  assert.deepEqual(left, { regs: 0, caches: 0, data: [] });
});

await step('a guest who goes offline sees the card and keeps the screen', async () => {
  await p.goto(`${BASE}/handpan/d-kurd`);
  await p.locator('.appbar').first().waitFor();
  const before = await p.url();
  await phone.ctx.setOffline(true);
  await p.locator('.offline-card').waitFor();
  assert.equal(await p.url(), before);
  await p.click('[data-action="offline-remind"]');
  await phone.ctx.setOffline(false);
  await p.locator('.sheet-root[data-sheet="save"]').waitFor();
  assert.match(await p.locator('.sheet-title').innerText(), /Play offline/);
});

await step('a guest saves a visiting ocarina: after sign-in it is in My instruments', async () => {
  await p.click('.sheet-foot [data-action="save-not-now"]');
  await p.goto(`${BASE}/ocarina/alto-c-12`);
  await p.locator('.banner [data-action="shared-add"]').click();
  assert.match(await p.locator('.sheet-title').innerText(), /Save your instrument/);
  await p.screenshot({ path: process.env.SHOT ?? '/dev/null' }).catch(() => {});
  await p.fill('#save-email-input', 'b@example.com');
  await p.click('[data-action="save-send-code"]');
  await p.fill('#save-code-input', '12345678');
  await toast(p).filter({ hasText: /added to My instruments/ }).waitFor();
  const names = await p.evaluate(() => JSON.parse(localStorage.getItem('hp-instruments')).map(i => i.family));
  assert.deepEqual(names, ['ocarina']);
});

await step('building is hidden unless the owner ticked can_build', async () => {
  await p.goto(`${BASE}/#settings`);
  await p.locator('.appbar').first().waitFor();
  assert.equal(await p.getByText('Clay bodies').count(), 0);
  // The owner ticks can_build: the app reads it from profiles at start.
  await p.addInitScript(() => { window.__canBuild = true; });
  await p.reload();
  await p.getByText('Clay bodies').waitFor({ timeout: 8000 });
});

await browser.close();
await app.close();
console.log(`\n${run.passed} passed`);
