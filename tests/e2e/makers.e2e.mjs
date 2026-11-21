// End-to-end check of the makers programme (docs/makers-programme.md) in a
// real browser, with the real database functions: the page's supabase-js is
// replaced by a small stand-in whose every call runs in a throwaway local
// Postgres (the migrations, as tests/makers-sql.test.mjs applies them).
// Not part of `node --test` (it needs Playwright, a browser and Postgres):
//
//   python3 build.py && HP_TEST_DATABASE_URL=postgresql://postgres:…@localhost:5432/postgres node tests/e2e/makers.e2e.mjs
//
// Covers: a guest's "Create your maker page" through sign-in to the request;
// the admin approving it; the maker sharing an instrument; a buyer opening
// the code and seeing "Made by"; reporting; suspension.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js';
const ADMIN_URL = process.env.HP_TEST_DATABASE_URL;
if (!ADMIN_URL) { console.log('Set HP_TEST_DATABASE_URL to run (see the top of this file).'); process.exit(0); }

// ── A throwaway database with every migration ───────────────────────────────
const DB = `hp_e2e_${Date.now().toString(36)}`;
function psqlRun(url, args, input) {
  const r = spawnSync('psql', [url, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', ...args], { encoding: 'utf8', input });
  if (r.status !== 0) throw new Error(r.stderr.trim());
  return r.stdout.trim();
}
psqlRun(ADMIN_URL, ['-c', `create database ${DB}`]);
const dbUrl = Object.assign(new URL(ADMIN_URL), { pathname: '/' + DB }).toString();
for (const f of ['supabase/tests/stubs.sql', ...readdirSync(join(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort().map(f => 'supabase/migrations/' + f)]) {
  psqlRun(dbUrl, ['-1', '-f', join(ROOT, f)]);
}
export const sql = text => psqlRun(dbUrl, ['-f', '-'], text);
const lit = v => (v == null ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v)
  : Array.isArray(v) && v.every(x => typeof x === 'string') ? `array[${v.map(x => `'${x.replace(/'/g, "''")}'`).join(', ')}]::text[]`
  : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`);
// As PostgREST would: the caller's id in request.jwt.claim.sub, the API role, the request's headers.
const as = (uid, headers = {}) => `select set_config('request.jwt.claim.sub', ${lit(uid ?? '')}, false);
  select set_config('request.headers', ${lit(JSON.stringify(headers))}, false);
  set role ${uid ? 'authenticated' : 'anon'};\n`;

const users = new Map();
const server = {
  signIn(email) {
    if (!users.has(email)) {
      const id = `00000000-0000-0000-0000-${String(users.size + 1).padStart(12, '0')}`;
      users.set(email, id);
      sql(`insert into auth.users (id, email) values (${lit(id)}, ${lit(email)});`);
    }
    return { user: { id: users.get(email), email, created_at: new Date().toISOString() }, access_token: 't' };
  },
  rpc(uid, name, args, headers) {
    if (!/^[a-z_]+$/.test(name)) throw new Error('bad function name');
    const named = Object.entries(args ?? {}).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
    try {
      const out = sql(`${as(uid, headers)}select coalesce(to_jsonb(public.${name}(${named})), 'null'::jsonb);`);
      return { data: JSON.parse(out.split('\n').pop()) };
    } catch (e) { return { error: { message: String(e.message).split('\n')[0] } }; }
  },
  select(uid, table) {
    if (!/^[a-z_]+$/.test(table)) throw new Error('bad table');
    return JSON.parse(sql(`${as(uid)}select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.${table} t;`).split('\n').pop());
  },
  upsertInstruments(uid, rows) {
    try {
      for (const r of rows) {
        sql(`${as(uid)}insert into public.instruments (owner_id, id, public_id, data, deleted_at) values (${lit(r.owner_id)}, ${lit(r.id)}, ${lit(r.public_id)}, ${lit(r.data)}, ${lit(r.deleted_at)})
          on conflict (owner_id, id) do update set public_id = excluded.public_id, data = excluded.data, deleted_at = excluded.deleted_at;`);
      }
      return { error: null };
    } catch (e) { return { error: { message: e.message, code: /duplicate key/.test(e.message) ? '23505' : 'x' } }; }
  },
};

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

// The page side: a tiny supabase-js with the calls the app makes.
const FAKE_SUPABASE = `
window.supabase = { createClient() {
  const KEY = 'sb-fake-auth-token';
  let session = JSON.parse(localStorage.getItem(KEY) || 'null');
  const listeners = [];
  const emit = (ev) => listeners.forEach(cb => cb(ev, session));
  const call = (op, args) => window.__supa(op, { uid: session?.user?.id ?? null, ...args });
  const query = (table) => {
    const q = { then(res, rej) { return call('select', { table }).then(data => ({ data, error: null })).then(res, rej); } };
    q.select = () => q; q.order = () => q; q.gt = () => q;
    q.maybeSingle = () => call('select', { table }).then(rows => ({ data: rows[0] ?? null, error: null }));
    q.upsert = (rows) => call('upsert', { table, rows });
    return q;
  };
  return {
    auth: {
      onAuthStateChange(cb) { listeners.push(cb); },
      async getSession() { return { data: { session } }; },
      async signInWithOtp() { return { error: null }; },
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
    async rpc(name, args) { const r = await call('rpc', { name, args }); return { data: r.data ?? null, error: r.error ?? null }; },
  };
} };`;

const browser = await chromium.launch();
export async function device(name, { headers = {}, viewport = { width: 390, height: 844 } } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.exposeFunction('__supa', (op, a) => {
    if (op === 'signIn') return server.signIn(a.email);
    if (op === 'select') return server.select(a.uid, a.table);
    if (op === 'upsert') return a.table === 'instruments' ? server.upsertInstruments(a.uid, a.rows) : { error: null };
    if (op === 'rpc') return server.rpc(a.uid, a.name, a.args, headers);
    return null;
  });
  await ctx.route(SUPABASE_JS, r => r.fulfill({ contentType: 'text/javascript', body: FAKE_SUPABASE }));
  await ctx.route('https://gvcfrnbnenqfhofvzgoz.supabase.co/**', r => r.fulfill({ contentType: 'application/json', body: '{"external":{"google":false,"apple":false}}' }));
  await ctx.route(/posthog|sentry-cdn|ingest/, r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log(`[${name}] page error:`, e.message); process.exitCode = 1; });
  return { ctx, page };
}
export async function signIn(page, email) {
  await page.fill('#save-email-input', email);
  await page.click('[data-action="save-send-code"]');
  await page.fill('#save-code-input', '12345678');
}
const SHOTS = process.env.HP_E2E_SHOTS; // a folder: keep a picture of each screen
export async function shot(page, name) { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) }); }

const toast = page => page.locator('.toast.show .toast-msg');
let passed = 0;
async function step(name, fn) { await fn(); passed++; console.log(`ok - ${name}`); }

try {
  // ── The maker ─────────────────────────────────────────────────────────────
  const maker = await device('maker');
  const m = maker.page;

  await step('a guest opens #maker and gets the sign-in sheet with maker words', async () => {
    await m.goto(`${BASE}/#maker`);
    await m.locator('.maker-pitch-title').waitFor();
    await shot(m, '01-pitch');
    await m.click('[data-action="maker-start"]');
    await m.locator('.sheet-root[data-sheet="save"]').waitFor();
    assert.match(await m.locator('.sheet-title').innerText(), /Set up your maker page/);
  });

  await step('after sign-in the profile form opens; bad input is caught on the device', async () => {
    await signIn(m, 'ilze@example.com');
    await m.locator('#maker-name').waitFor();
    await m.click('[data-action="maker-save"]');
    await m.locator('.field.has-error').first().waitFor();
    await m.fill('#maker-name', 'Ilze Pans');
    assert.equal(await m.inputValue('#maker-slug'), 'ilze-pans', 'the address follows the name');
    await m.click('[data-action="maker-family"][data-family="handpan"]');
    await m.fill('#maker-place', 'Cēsis');
    await m.selectOption('#maker-country', 'LV');
    await m.fill('#maker-website', 'ilzepans.example');
    await m.fill('#maker-story', 'I build handpans one at a time in an old brewery.');
    await m.fill('#maker-note', 'About 40 a year, most to order.');
    await shot(m, '02-form');
  });

  await step('sending the request shows it as waiting', async () => {
    await m.click('[data-action="maker-save"]');
    await toast(m).filter({ hasText: 'Request sent' }).waitFor();
    await m.locator('.maker-status.is-wait').waitFor();
    assert.match(await m.locator('.maker-status-title').innerText(), /looking at your request/);
    assert.equal(sql("select status || '|' || website || '|' || country from public.makers where slug = 'ilze-pans';"), 'pending|https://ilzepans.example|LV');
    await shot(m, '03-pending');
  });

  await step('the maker saves a D Kurd and shares it', async () => {
    await m.goto(`${BASE}/handpan/d-kurd`);
    await m.click('[data-action="save-layout"]');
    await toast(m).filter({ hasText: 'Saved to My instruments' }).waitFor();
    await m.click('[data-action="menu-open"]');
    await m.click('[data-action="share-instrument"]');
    await m.locator('.share-code').waitFor();
  });
  const code = (await m.locator('.share-code').innerText()).trim();
  assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/);

  // ── A buyer, before approval ──────────────────────────────────────────────
  const buyer = await device('buyer');
  const b = buyer.page;
  await step('before approval the code opens the instrument without "Made by"', async () => {
    await b.goto(`${BASE}/s/${code}`);
    await b.locator('.pan-note').first().waitFor();
    assert.equal(await b.locator('.made-by').count(), 0);
  });

  // ── The admin ─────────────────────────────────────────────────────────────
  const admin = await device('admin');
  const a = admin.page;
  await step('the admin sees the request and approves it', async () => {
    await a.goto(`${BASE}/#settings`);
    await a.click('[data-action="open-sign-in"]');
    await signIn(a, 'oak@example.com');
    await a.waitForFunction(() => !!localStorage.getItem('sb-fake-auth-token'));
    sql(`insert into public.profiles (user_id, is_admin) values (${lit(users.get('oak@example.com'))}, true) on conflict (user_id) do update set is_admin = true;`);
    await a.goto(`${BASE}/#maker`);
    await a.locator('[data-action="maker-review-open"]').waitFor();
    await a.click('[data-action="maker-review-open"]');
    await a.locator('.maker-review-card').waitFor();
    assert.match(await a.locator('.maker-review-card').innerText(), /Ilze Pans[\s\S]*About 40 a year/);
    await shot(a, '04-review');
    await a.click('[data-action="maker-review"][data-status="approved"]');
    await toast(a).filter({ hasText: 'Approved' }).waitFor();
    assert.equal(sql("select m.status || '|' || p.is_maker from public.makers m join public.profiles p on p.user_id = m.owner_id where m.slug = 'ilze-pans';"), 'approved|true');
  });

  await step('the maker now sees the page is live, and what a buyer sees', async () => {
    await m.goto(`${BASE}/#maker`);
    await m.locator('.maker-status.is-ok').waitFor();
    await shot(m, '05-approved');
    await m.click('[data-action="maker-preview"]');
    await m.locator('.sheet-root[data-sheet="made-by"]').waitFor();
    assert.match(await m.locator('.maker-card').innerText(), /Ilze Pans[\s\S]*Maker · Cēsis, Latvia/);
    await m.click('[data-action="made-by-close"]');
  });

  // ── The buyer, after approval ─────────────────────────────────────────────
  await step('the buyer opens the code and sees "Made by Ilze Pans"', async () => {
    await b.goto(`${BASE}/s/${code}`);
    await b.locator('.made-by').waitFor();
    assert.match(await b.locator('.made-by').innerText(), /Made by\s+Ilze Pans/);
    await shot(b, '06-buyer');
    await b.click('[data-action="go-chords"]');
    await b.locator('.made-by').waitFor(); // on every tab of the instrument
    await b.click('[data-action="made-by-open"]');
    await b.locator('.sheet-root[data-sheet="made-by"]').waitFor();
    const text = await b.locator('.sheet').innerText();
    assert.match(text, /old brewery/);
    assert.match(text, /ilzepans\.example/);
    assert.equal(await b.locator('.maker-card-links a').first().getAttribute('href'), 'https://ilzepans.example');
    await shot(b, '07-made-by-sheet');
  });

  await step('a claim of a maker inside shared data is ignored', async () => {
    sql(`update public.instruments set data = jsonb_set(data, '{layout,madeBy}', '{"slug":"famous","name":"Someone Famous"}') where public_id = ${lit(code)};`);
    await b.goto(`${BASE}/s/${code}`);
    await b.locator('.made-by').waitFor();
    assert.match(await b.locator('.made-by').innerText(), /Ilze Pans/);
    assert.doesNotMatch(await b.locator('.made-by').innerText(), /Famous/);
  });

  await step('the buyer reports the profile; the admin sees it and suspends', async () => {
    await b.click('[data-action="made-by-open"]');
    await b.click('[data-action="maker-report-open"]');
    await b.click('[data-action="maker-report-reason"][data-reason="not-them"]');
    await b.fill('#maker-report-detail', 'Not their logo');
    await b.click('[data-action="maker-report-send"]');
    await b.getByText('Thank you').waitFor();
    await a.goto(`${BASE}/#maker/review`);
    await a.getByText('Not their logo').waitFor();
    await shot(a, '08-report');
    await a.click('[data-action="maker-review-note"][data-status="suspended"]');
    await a.fill('#maker-reject-note', 'Please send us your own logo');
    await a.click('[data-action="maker-reject-ok"]');
    await toast(a).filter({ hasText: 'Suspended' }).waitFor();
  });

  await step('suspended: the code still opens, "Made by" is gone, the maker is told why', async () => {
    await b.goto(`${BASE}/s/${code}`);
    await b.locator('.pan-note').first().waitFor();
    await b.waitForTimeout(300);
    assert.equal(await b.locator('.made-by').count(), 0);
    await m.goto(`${BASE}/#maker`);
    await m.getByText('Please send us your own logo').waitFor();
  });

  // ── Phase 2: instruments, codes, cards, importing, counting ───────────────
  sql("update public.makers set status = 'approved', status_note = null where slug = 'ilze-pans';");
  const counts = c => JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(d) - 'day' order by d.via, d.country), '[]'::jsonb) from public.maker_scan_days d where d.code = ${lit(c)};`));

  await step('the maker screen lists the instrument with its code', async () => {
    await m.goto(`${BASE}/#maker`);
    await m.locator('[data-action="maker-inst-open"]').first().waitFor();
    assert.match(await m.locator('[data-action="maker-inst-open"]').first().innerText(), new RegExp(code));
    await shot(m, '09-instruments');
    await m.click('[data-action="maker-inst-open"]');
    await m.locator('.maker-code').waitFor();
    assert.equal((await m.locator('.maker-code').innerText()).trim(), code);
  });

  await step('serial numbers each get a code; a range is filled in', async () => {
    await m.click('[data-action="maker-serials-open"]');
    await m.fill('#maker-serials-input', '9-7');
    await m.click('[data-action="maker-serials-ok"]');
    await m.getByText('runs backwards').waitFor();
    await m.fill('#maker-serials-input', '101-103, A-07');
    await m.click('[data-action="maker-serials-ok"]');
    await toast(m).filter({ hasText: '4 serial numbers added' }).waitFor();
    assert.equal(await m.locator('[data-action="maker-code-retire"]').count(), 4);
    assert.equal(sql('select count(*) from public.maker_codes;'), '4');
    await shot(m, '10-codes');
  });
  const serialCode = sql("select code from public.maker_codes where serial = '102';");

  await step('the QR card: a preview, an SVG, and a print page of every card', async () => {
    await m.click(`[data-action="maker-card-open"][data-code="${serialCode}"]`);
    await m.locator('.maker-card-preview svg').waitFor({ timeout: 10000 });
    const svg = await m.locator('.maker-card-preview').innerHTML();
    assert.match(svg, /No\. 102/);
    assert.match(svg, /Ilze Pans/);
    await shot(m, '11-card');
    const [dl] = await Promise.all([m.waitForEvent('download'), m.click('[data-action="maker-card-svg"]')]);
    assert.match(dl.suggestedFilename(), /^oakhum-d-kurd-102-card\.svg$/);
    await m.click('.sheet-head [data-action="maker-card-close"]');
    await m.click('[data-action="maker-card-open"][data-code="all"]');
    await m.locator('.maker-card-preview svg').waitFor();
    await m.click('[data-action="maker-card-format"][data-value="label"]');
    await m.locator('.maker-card-preview svg').waitFor();
    const [popup] = await Promise.all([maker.ctx.waitForEvent('page'), m.click('[data-action="maker-card-print"]')]);
    await popup.waitForLoadState();
    await popup.locator('svg').first().waitFor();
    assert.equal(await popup.locator('svg').count(), 1, 'four stickers fit one sheet');
    assert.equal(await popup.locator('svg > g').count(), 4);
    if (SHOTS) await popup.screenshot({ path: join(SHOTS, '12-sheet.png') });
    await popup.close();
    await m.click('.sheet-head [data-action="maker-card-close"]');
  });

  await step('the NFC sheet gives a link that says it came from a tag', async () => {
    await m.click(`[data-action="maker-nfc-open"][data-code="${serialCode}"]`);
    assert.equal(await m.locator('.sheet .share-url').inputValue(), `${BASE}/s/${serialCode}?via=nfc`);
    await m.click('.sheet-head [data-action="maker-nfc-close"]');
  });

  await step('a buyer scans the serial code: Made by, the code stays in the address, and it is counted', async () => {
    await b.goto(`${BASE}/s/${serialCode}?via=qr`);
    await b.locator('.made-by').waitFor();
    await b.waitForFunction(c => location.pathname === `/s/${c}`, serialCode);
    await b.click('[data-action="go-chords"]');
    await b.waitForFunction(c => location.pathname === `/s/${c}/chords`, serialCode);
    for (let i = 0; i < 3; i++) await b.locator('[data-action="select-chord"]').nth(i).click();
    await b.evaluate(() => makerFlushPlayed());
    await b.waitForTimeout(400);
    const d = counts(serialCode);
    assert.equal(d.length, 1, JSON.stringify(d));
    assert.deepEqual({ via: d[0].via, opens: d[0].opens, devices: d[0].devices, chord_visits: d[0].chord_visits, chords: d[0].chords }, { via: 'qr', opens: 1, devices: 1, chord_visits: 1, chords: 3 });
    await b.reload();
    await b.locator('.made-by').waitFor();
    await b.waitForTimeout(300);
    // Opened again without the card's mark: a second open (as a plain link), the same device.
    const sum = k => counts(serialCode).reduce((n, r) => n + r[k], 0);
    assert.equal(sum('opens'), 2);
    assert.equal(sum('devices'), 1);
  });

  await step('the maker opening their own code is not counted', async () => {
    await m.goto(`${BASE}/s/${serialCode}?via=qr`);
    await m.locator('.pan-note').first().waitFor();
    await m.waitForTimeout(400);
    assert.equal(counts(serialCode).reduce((n, r) => n + r.opens, 0), 2);
  });

  await step('a retired code opens nothing', async () => {
    await m.goto(`${BASE}/#maker`);
    await m.click('[data-action="maker-inst-open"]');
    await m.locator(`[data-action="maker-code-retire"][data-code="${serialCode}"]`).click();
    await toast(m).filter({ hasText: 'Retired' }).waitFor();
    await b.goto(`${BASE}/s/${serialCode}`);
    await b.waitForTimeout(500);
    assert.equal(await b.locator('.made-by').count(), 0);
    assert.equal(await b.locator('.pan-note').count(), 0);
  });

  await step('"Made by" can be switched off for one instrument', async () => {
    await m.click('[data-action="maker-hide-toggle"]');
    await m.waitForTimeout(400);
    await b.goto(`${BASE}/s/${code}`);
    await b.locator('.pan-note').first().waitFor();
    await b.waitForTimeout(300);
    assert.equal(await b.locator('.made-by').count(), 0);
    await m.click('[data-action="maker-hide-toggle"]');
  });

  await step('importing a list: bad rows are named, good ones become instruments with codes', async () => {
    await m.goto(`${BASE}/#maker`);
    await m.click('[data-action="maker-import-open"]');
    await m.fill('#maker-import-text', [
      'name,instrument,scale,ding,top,bottom,serials',
      'Celtic nine,handpan,d-celtic-minor,,,,201-203',
      'Low Pygmy special,handpan,,F3,G3 Ab3 C4 Eb4 F4 G4 Ab4 C5,C3 Eb3,204',
      'Odd one,handpan,d-kurdd,,,,',
      'Wrong note,handpan,,D3,A3 H3,,',
      'Little whistle,flute,tin-whistle-d,,,,',
    ].join('\n'));
    await m.click('[data-action="maker-import-check"]');
    await m.getByText('Preview · 5 rows').waitFor();
    assert.match(await m.locator('.row.is-bad').first().innerText(), /No such scale: d-kurdd\. Did you mean d-kurd\?/);
    assert.match(await m.locator('.row.is-bad').nth(1).innerText(), /H3 isn’t a note/);
    await shot(m, '13-import');
    await m.click('[data-action="maker-import-go"]');
    await m.getByText('3 instruments added').waitFor({ timeout: 15000 });
    assert.equal(sql('select count(*) from public.instruments where public_id is not null;'), '4');
    assert.equal(sql("select count(*) from public.maker_codes where serial in ('201','202','203','204');"), '4');
    await m.click('[data-action="open-maker"]');
    await m.getByText('Low Pygmy special').waitFor();
    await shot(m, '14-after-import');
  });

  await step('an imported custom handpan opens for a buyer with its notes and maker', async () => {
    const c = sql("select code from public.maker_codes where serial = '204';");
    await b.goto(`${BASE}/s/${c}?via=nfc`);
    await b.locator('.made-by').waitFor();
    assert.match(await b.locator('.appbar').innerText(), /Low Pygmy special/);
    assert.ok(await b.locator('.pan-note[data-note="Eb3"], .pan-note[data-note="D#3"]').count() >= 1, 'the bottom note is on the picture');
    await b.waitForTimeout(300);
    assert.equal(counts(c)[0].via, 'nfc');
  });

  // ── Phase 3: stats ────────────────────────────────────────────────────────
  await step('the stats screen adds up the maker\'s codes: tiles, a bar a day, sources, instruments, CSV', async () => {
    // A month of scans on the model code, so the chart has something to show.
    sql(`insert into public.maker_scan_days (code, day, country, via, opens, devices, saves, chord_visits, chords)
         select ${lit(code)}, (now() at time zone 'utc')::date - g, case when g % 3 = 0 then 'DE' else 'LV' end, case when g % 4 = 0 then 'nfc' else 'qr' end,
                1 + (g * 7) % 9, 1 + (g * 7) % 4, (g % 6 = 0)::int, 1, 5 + g
           from generate_series(1, 40) g;`);
    await m.goto(`${BASE}/#maker`);
    await m.locator('.maker-tile').first().waitFor();
    await shot(m, '15-home-stats');
    await m.click('[data-action="maker-stats-open"]');
    await m.locator('.maker-bars').waitFor();
    assert.equal(await m.locator('.maker-bar').count(), 30);
    const expected = sql(`select sum(d.opens) from public.maker_scan_days d where d.day > (now() at time zone 'utc')::date - 30
      and d.code in (select public_id from public.instruments union select code from public.maker_codes);`);
    assert.equal((await m.locator('.maker-tile-value').first().innerText()).replace(/,/g, ''), expected);
    assert.match(await m.locator('.maker-screen').innerText(), /QR code[\s\S]*NFC tag[\s\S]*Latvia[\s\S]*Germany[\s\S]*D Kurd/);
    await m.locator('.maker-bar').nth(10).hover();
    await shot(m, '16-stats');
    await m.click('[data-action="maker-stats-days"][data-value="90"]');
    await m.waitForFunction(() => document.querySelectorAll('.maker-bar').length === 90);
    const [dl] = await Promise.all([m.waitForEvent('download'), m.click('[data-action="maker-stats-csv"]')]);
    assert.match(dl.suggestedFilename(), /^oakhum-stats-\d{4}-\d\d-\d\d-to-\d{4}-\d\d-\d\d\.csv$/);
    const csv = readFileSync(await dl.path(), 'utf8');
    assert.match(csv.split('\n')[0], /^instrument,serial,code,scans/);
    assert.ok(csv.includes(`,${code},`));
    await m.click('[data-action="maker-inst-open"]');
    await m.locator('.maker-code-stat').waitFor();
    assert.match(await m.locator('.maker-code-stat').innerText(), /scans · saved/);
    await shot(m, '17-inst-stats');
  });

  await step('a buyer\'s account sees no numbers of the maker\'s', async () => {
    const res = server.rpc(users.get('oak@example.com'), 'maker_stats', { p_days: 90 }, {});
    assert.equal(res.data.totals.opens, 0);
    assert.deepEqual(res.data.by_code, []);
  });

  // ── Phase 5: the embed code ───────────────────────────────────────────────
  await step('the instrument screen gives the code for the maker\'s own website', async () => {
    await m.goto(`${BASE}/#maker`);
    await m.locator('[data-action="maker-inst-open"]').filter({ hasText: 'Low Pygmy special' }).click();
    await m.click('[data-action="maker-embed-open"]');
    const html = await m.locator('#maker-embed-code').inputValue();
    const c = sql("select public_id from public.instruments where data->>'name' = 'Low Pygmy special';");
    assert.equal(html, `<iframe src="${BASE}/embed/s/${c}" title="Low Pygmy special by Ilze Pans, playable" width="100%" height="740" style="border:0;max-width:520px" loading="lazy"></iframe>`);
    await shot(m, '18-embed');
    // An open from the embed counts under its own source.
    assert.equal(server.rpc(null, 'log_maker_event', { p_code: c, p_event: 'open', p_via: 'embed' }, { 'x-forwarded-for': '203.0.113.200', 'user-agent': 'Shop visitor' }).error, undefined);
    assert.equal(sql(`select via || ':' || opens from public.maker_scan_days where code = ${lit(c)};`), 'embed:1');
  });

  if (typeof globalThis.makersMoreSteps === 'function') await globalThis.makersMoreSteps({ step, device, signIn, sql, lit, BASE, toast, shot, users, maker, buyer, admin, code });
  console.log(`\n${passed} steps passed`);
} finally {
  await browser.close();
  http.close();
  psqlRun(ADMIN_URL, ['-c', `drop database if exists ${DB} with (force)`]);
}
