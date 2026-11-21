// Account data safety in a real browser (stand-in Supabase, tests/e2e/harness.mjs):
// what this device holds belongs to one account, and a session that ends
// by itself never costs anyone their things.
//
//   python3 build.py && node tests/e2e/account-safety.e2e.mjs
//
// Covers: a session that dies (expired or revoked, nobody pressed Sign out)
// keeps the data and offers "Sign in again"; the same person signing in
// again keeps everything, unsynced changes included; a different person
// signing in on the same device gets their own things only (not the
// previous account's items, and a pull from the start, not from the
// previous account's last sync), and nothing of the previous account is
// written into theirs; a full device (storage quota) says so.
import assert from 'node:assert/strict';
import { chromium, serveApp, fakeServer, newDevice, toast, runner } from './harness.mjs';

const app = await serveApp();
const server = fakeServer();
const browser = await chromium.launch();
const run = runner();
const d = await newDevice(browser, server, 'shared tablet', { base: app.base, serviceWorkers: 'block' });
const p = d.page;
p.setDefaultTimeout(8000);
const step = (name, fn) => run.step(name, fn, p);
const local = key => p.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), key);
const serverRows = email => { const uid = server.users.get(email); return [...server.rows.values()].filter(r => r.owner_id === uid); };

async function signIn(email) {
  await p.fill('#save-email-input', email);
  await p.click('[data-action="save-send-code"]');
  await p.fill('#save-code-input', '12345678');
}
async function openSettings() {
  await p.goto(`${app.base}/play#settings`);
  await p.locator('[data-action="set-theme"]').first().waitFor();
}

let failed = false;
try {
  // Bea has an account from another device, with one ocarina in it. It was
  // saved before anything Ada does here, so its updated_at is older than
  // Ada's last pull.
  const bea = server.signIn('bea@example.com').user.id;
  server.saveItem(bea, { p_kind: 'instrument', p_id: 'oc-bea', p_data: { id: 'oc-bea', family: 'ocarina', name: 'Bea’s ocarina', notes: [60, 62], createdAt: '2026-11-01T09:00:00Z', updatedAt: '2026-11-01T09:00:00Z' }, p_base_version: 0, p_deleted: false });
  // Well before Ada's last pull (sync re-reads the last ten seconds, no more).
  for (const r of server.rows.values()) r.updated_at = '2026-11-01T09:00:00.000Z';

  await step('Ada signs in and saves an instrument; it syncs', async () => {
    await p.goto(`${app.base}/ocarina/alto-c-12`);
    await p.locator('.banner [data-action="shared-add"]').click();
    await signIn('ada@example.com');
    await toast(p).filter({ hasText: /added to My instruments/ }).waitFor();
    for (let i = 0; i < 40 && serverRows('ada@example.com').filter(r => r.kind === 'instrument').length < 1; i++) await p.waitForTimeout(100);
    assert.equal(serverRows('ada@example.com').filter(r => r.kind === 'instrument').length, 1);
  });

  await step('the session ends by itself: the data stays and Settings offers "Sign in again"', async () => {
    await openSettings();
    await p.evaluate(() => window.__dropSession());
    await p.locator('[data-action="account-sign-in-again"]').waitFor();
    assert.equal(await p.getByText('Connecting…').count(), 0, 'no endless "Connecting…"');
    assert.equal((await local('hp-instruments')).length, 1, 'Ada’s instrument is still on the device');
    await p.reload();
    await p.locator('[data-action="account-sign-in-again"]').waitFor();
  });

  await step('a change made meanwhile waits; Ada signs in again and it syncs, nothing lost', async () => {
    await p.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('hp-instruments'));
      list[0].name = 'Ada’s alto (renamed)';
      list[0].updatedAt = new Date().toISOString();
      localStorage.setItem('hp-instruments', JSON.stringify(list));
      window.dispatchEvent(new Event('hp-instruments-changed'));
    });
    await p.click('[data-action="account-sign-in-again"]');
    await signIn('ada@example.com');
    await p.locator('.sheet-root[data-sheet="save"]').waitFor({ state: 'detached' });
    assert.equal((await local('hp-instruments'))[0].name, 'Ada’s alto (renamed)');
    for (let i = 0; i < 40 && !serverRows('ada@example.com').some(r => r.data?.name === 'Ada’s alto (renamed)'); i++) await p.waitForTimeout(100);
    assert.ok(serverRows('ada@example.com').some(r => r.data?.name === 'Ada’s alto (renamed)'), 'the change reached Ada’s account');
  });

  await step('the session ends again and Bea signs in: she gets her things, not Ada’s', async () => {
    await openSettings();
    await p.evaluate(() => window.__dropSession());
    await p.click('[data-action="account-sign-in-again"]');
    await signIn('bea@example.com');
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('hp-instruments') || '[]').some(i => i.id === 'oc-bea'));
    const names = (await local('hp-instruments')).filter(i => !i.deletedAt).map(i => i.name);
    assert.deepEqual(names, ['Bea’s ocarina'], 'only Bea’s instrument is on the device');
    await p.waitForTimeout(600); // a sync round
    const beaKinds = serverRows('bea@example.com').filter(r => r.kind === 'instrument').map(r => r.data.name);
    assert.deepEqual(beaKinds, ['Bea’s ocarina'], 'nothing of Ada’s was written into Bea’s account');
    assert.ok(serverRows('ada@example.com').some(r => r.data?.name === 'Ada’s alto (renamed)'), 'Ada’s account still has hers');
  });

  await step('a full device says so instead of failing silently', async () => {
    await p.goto(`${app.base}/ocarina/alto-c-12`);
    await p.locator('.appbar').first().waitFor();
    await p.evaluate(() => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (String(k).startsWith('hp-')) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        return real.call(this, k, v);
      };
    });
    await p.locator('.banner [data-action="shared-add"]').click();
    await toast(p).filter({ hasText: /out of space/i }).waitFor();
  });
  assert.deepEqual(d.problems.filter(x => !/QuotaExceeded/.test(x)), [], 'the page reported problems');
} catch (err) {
  failed = true;
  console.error(err?.stack ?? err);
} finally {
  await browser.close();
  await app.close();
}
console.log(`\n${run.passed} passed${failed ? ', 1 failed' : ''}`);
process.exit(failed ? 1 : 0);
