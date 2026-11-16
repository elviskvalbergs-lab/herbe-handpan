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
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js';

// ── The app, served like Vercel (deep links fall back to index.html) ────────
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const http = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(ROOT, path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise(r => http.listen(0, '127.0.0.1', r));
const BASE = `http://localhost:${http.address().port}`;

// ── Stand-in Supabase ───────────────────────────────────────────────────────
const users = new Map(); // email -> id
const rows = new Map();  // `${uid}|${kind}|${id}` -> row
let clock = 0;
const server = {
  signIn(email) { if (!users.has(email)) users.set(email, `u${users.size + 1}`); return { user: { id: users.get(email), email, created_at: new Date().toISOString() }, access_token: 't' }; },
  pull(uid, since) {
    return [...rows.values()].filter(r => r.owner_id === uid && (!since || r.updated_at > since)).map(({ owner_id, ...r }) => r);
  },
  saveItem(uid, a) {
    const key = `${uid}|${a.p_kind}|${a.p_id}`;
    const cur = rows.get(key);
    if (cur && cur.version !== a.p_base_version) { const { owner_id, ...c } = cur; return { ok: false, current: c }; }
    const ts = new Date(Date.UTC(2026, 10, 16, 12) + ++clock).toISOString();
    const row = { owner_id: uid, kind: a.p_kind, id: a.p_id, data: a.p_data, version: (cur?.version ?? 0) + 1, updated_at: ts, deleted_at: a.p_deleted ? ts : null, device_kind: a.p_device_kind };
    rows.set(key, row);
    return { ok: true, version: row.version, updated_at: ts };
  },
};

// The page side: a tiny supabase-js with the calls the app makes.
const FAKE_SUPABASE = `
window.supabase = { createClient() {
  const KEY = 'sb-fake-auth-token';
  let session = JSON.parse(localStorage.getItem(KEY) || 'null');
  const listeners = [];
  const emit = (ev) => listeners.forEach(cb => cb(ev, session));
  const call = (op, args) => window.__supa(op, { uid: session?.user?.id ?? null, ...args });
  const query = (table) => {
    const q = { since: null, then(res, rej) {
      if (!navigator.onLine) return Promise.resolve({ data: null, error: { message: 'offline' } }).then(res, rej);
      return call('select', { table, since: q.since }).then(data => ({ data, error: null })).then(res, rej);
    } };
    q.select = () => q; q.order = () => q; q.gt = (_c, v) => { q.since = v; return q; };
    q.maybeSingle = () => Promise.resolve({ data: null, error: null });
    q.upsert = () => Promise.resolve({ error: null });
    return q;
  };
  return {
    auth: {
      onAuthStateChange(cb) { listeners.push(cb); },
      async getSession() { return { data: { session } }; },
      async signInWithOtp({ email }) { return { error: navigator.onLine ? null : { message: 'offline' } }; },
      async verifyOtp({ email, token }) {
        if (token !== '12345678') return { error: { message: 'bad code' } };
        session = await call('signIn', { email });
        localStorage.setItem(KEY, JSON.stringify(session));
        setTimeout(() => emit('SIGNED_IN'), 0);
        return { error: null };
      },
      async signOut() { session = null; localStorage.removeItem(KEY); emit('SIGNED_OUT'); return { error: null }; },
      async signInWithOAuth() { return { error: { message: 'not in tests' } }; },
    },
    from: query,
    async rpc(name, args) {
      if (!navigator.onLine) return { data: null, error: { message: 'offline' } };
      return { data: await call(name, args), error: null };
    },
  };
} };`;

const browser = await chromium.launch();
async function device(name) {
  const ctx = await browser.newContext({ serviceWorkers: 'allow' });
  await ctx.exposeFunction('__supa', (op, a) => {
    if (op === 'signIn') return server.signIn(a.email);
    if (op === 'select') return a.table === 'saved_items' ? server.pull(a.uid, a.since) : [];
    if (op === 'save_item') return server.saveItem(a.uid, a);
    return null;
  });
  await ctx.route(SUPABASE_JS, r => r.fulfill({ contentType: 'text/javascript', body: FAKE_SUPABASE }));
  await ctx.route('https://gvcfrnbnenqfhofvzgoz.supabase.co/**', r => r.fulfill({ contentType: 'application/json', body: '{"external":{"google":false,"apple":false}}' }));
  await ctx.route(/posthog|sentry-cdn|ingest/, r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`[${name}] page error:`, e.message));
  return { ctx, page };
}

const toast = page => page.locator('.toast.show .toast-msg');
let passed = 0;
async function step(name, fn) { await fn(); passed++; console.log(`ok - ${name}`); }

const phone = await device('phone');
let p = phone.page;

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

await browser.close();
http.close();
console.log(`\n${passed} passed`);
