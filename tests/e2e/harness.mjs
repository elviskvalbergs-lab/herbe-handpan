// What the browser tests share (tests/e2e/*.e2e.mjs): the built app served
// like Vercel serves it, a stand-in for Supabase that runs in this process
// (save_item's version rules, email codes, sessions), and a browser context
// ("device") with every outside host cut off, so the tests need no network
// and never write to the real project.
//
// Playwright and Chromium are expected to be installed already (the Claude
// cloud image, the Playwright container in CI); nothing is downloaded here.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { LINK_FAMILIES } from '../../js/links.js';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js';

// ── The app, served like Vercel (deep links fall back to index.html) ────────
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
// Paths the app answers on Vercel (vercel.json rewrites). Anything else that
// isn't a file is a 404, as it is in production: a missing picture or font
// then fails the smoke suite instead of quietly getting the app's HTML.
// The families come from the app's own list, so a new instrument's links work here too.
const APP_PATHS = new RegExp(`^/(|play|(${[...LINK_FAMILIES, 's'].join('|')})(/.*)?)$`);

// The response headers production sends (vercel.json), with one change: the
// Content-Security-Policy that is report-only there is ENFORCED here, so
// anything the tests do that the policy would block is a console error and
// fails the run. That is how the policy is checked on every tested path
// before it is enforced for real.
const VERCEL_HEADERS = Object.fromEntries(JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')).headers
  .find(h => h.source === '/(.*)').headers
  .map(h => [h.key === 'Content-Security-Policy-Report-Only' ? 'Content-Security-Policy' : h.key, h.value]));

export async function serveApp({ headers = {} } = {}) {
  if (!existsSync(join(ROOT, 'index.html'))) throw new Error('index.html is missing: run python3 build.py first');
  const app = { intercept: null };
  const http = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // A test can stand in for a bad network: app.intercept(path, res) answers
    // (or delays) the request itself and returns true.
    if (app.intercept?.(path, res)) return;
    // Vercel serves its Web Analytics script itself (build.py adds the tag): here it is an empty script.
    if (path === '/_vercel/insights/script.js') { res.writeHead(200, { 'content-type': 'text/javascript' }).end(''); return; }
    let file = join(ROOT, path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (APP_PATHS.test(path)) file = join(ROOT, 'index.html');
    else if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
    const isPage = file.endsWith('index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store', ...VERCEL_HEADERS, ...(isPage ? headers : {}) });
    // The tests swap supabase-js for a stand-in, which its integrity hash
    // would (rightly) refuse: the attribute is left out of the served page.
    res.end(isPage ? readFileSync(file, 'utf8').replace(/ integrity="sha384-[^"]+"/, '') : readFileSync(file));
  });
  await new Promise(r => http.listen(0, '127.0.0.1', r));
  Object.assign(app, { http, base: `http://localhost:${http.address().port}`, close: () => new Promise(r => { http.closeAllConnections?.(); http.close(r); }) });
  return app;
}

// ── Stand-in Supabase ───────────────────────────────────────────────────────
export function fakeServer() {
  const users = new Map(); // email -> id
  const rows = new Map();  // `${uid}|${kind}|${id}` -> row
  let clock = 0;
  const shared = new Map(); // share code -> instrument (get_shared_instrument)
  return {
    users, rows, shared,
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
}

// The page side: a tiny supabase-js with the calls the app makes.
// window.__dropSession() ends the session the way an expired refresh token
// does: the session is gone but nobody pressed Sign out.
export const FAKE_SUPABASE = `
window.supabase = { createClient() {
  const KEY = 'sb-fake-auth-token';
  let session = JSON.parse(localStorage.getItem(KEY) || 'null');
  const listeners = [];
  const emit = (ev) => listeners.forEach(cb => cb(ev, session));
  const call = (op, args) => window.__supa(op, { uid: session?.user?.id ?? null, ...args });
  const query = (table) => {
    const q = { since: null, from: 0, then(res, rej) {
      if (!navigator.onLine) return Promise.resolve({ data: null, error: { message: 'offline' } }).then(res, rej);
      return call('select', { table, since: q.since }).then(data => ({ data: q.to != null ? (data || []).slice(q.from, q.to + 1) : data, error: null })).then(res, rej);
    } };
    q.select = () => q; q.order = () => q; q.gt = (_c, v) => { q.since = v; return q; };
    q.range = (a, b) => { q.from = a; q.to = b; return q; };
    q.maybeSingle = () => Promise.resolve({ data: table === 'profiles' ? { can_build: !!window.__canBuild } : null, error: null });
    q.upsert = () => Promise.resolve({ error: null });
    return q;
  };
  window.__dropSession = () => { session = null; localStorage.removeItem(KEY); emit('SIGNED_OUT'); };
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

// A browser context wired to the stand-in server. Every other outside host
// (Sentry, PostHog, fonts) is cut off. `problems` collects what the smoke
// suite fails on: uncaught errors, console errors, and requests for the
// app's own files that failed.
export async function newDevice(browser, server, name, { serviceWorkers = 'allow', base = '', contextOptions = {} } = {}) {
  const ctx = await browser.newContext({ serviceWorkers, ...contextOptions });
  await ctx.exposeFunction('__supa', (op, a) => {
    if (op === 'signIn') return server.signIn(a.email);
    if (op === 'select') return a.table === 'saved_items' ? server.pull(a.uid, a.since) : [];
    if (op === 'save_item') return server.saveItem(a.uid, a);
    if (op === 'get_shared_instrument') return server.shared.get(String(a.p_public_id).toUpperCase()) ?? null;
    // The same code with who made it (js/makers.js sharedOpening); no makers in this stand-in.
    if (op === 'open_shared_instrument') {
      const code = String(a.p_code).toUpperCase();
      const data = server.shared.get(code);
      return data ? { data, code, model_code: code, serial: null, maker: null } : null;
    }
    return null;
  });
  await ctx.route(SUPABASE_JS, r => r.fulfill({ contentType: 'text/javascript', body: FAKE_SUPABASE }));
  await ctx.route('https://gvcfrnbnenqfhofvzgoz.supabase.co/**', r => r.fulfill({ contentType: 'application/json', body: '{"external":{"google":false,"apple":false}}' }));
  // Everything else outside this machine: not in tests.
  await ctx.route(url => !/^(localhost|127\.0\.0\.1)$/.test(url.hostname) && url.href !== SUPABASE_JS && url.hostname !== 'gvcfrnbnenqfhofvzgoz.supabase.co' && /^https?:$/.test(url.protocol), r => r.abort());
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(`page error: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // The hosts cut off above (Sentry's loader, PostHog) fail by design.
    if (/net::ERR_FAILED|net::ERR_BLOCKED_BY_CLIENT/.test(text) && !/localhost|127\.0\.0\.1/.test(m.location()?.url ?? '')) return;
    problems.push(`console error: ${text}${m.location()?.url ? ` (${m.location().url})` : ''}`);
  });
  page.on('response', res => {
    if (res.status() >= 400 && base && res.url().startsWith(base)) problems.push(`${res.status()} for ${res.url()}`);
  });
  return { ctx, page, problems, name };
}

// Signs in through the save sheet (which must be open) with an emailed code.
// The sheet re-renders when the sign-in methods arrive, and a click that
// lands on a button being replaced is lost: so "Send code" is pressed until
// the code field shows.
export async function signInWithCode(page, email) {
  for (let i = 0; ; i++) {
    await page.fill('#save-email-input', email);
    await page.click('[data-action="save-send-code"]');
    try { await page.locator('#save-code-input').waitFor({ timeout: 1500 }); break; } catch (err) { if (i >= 3) throw err; }
  }
  await page.fill('#save-code-input', '12345678');
}

export const toast = page => page.locator('.toast.show .toast-msg');

// A tiny runner: steps run in order, the first failure stops the run with
// a non-zero exit code (and a screenshot under $E2E_SHOTS when it is set).
export function runner() {
  let passed = 0;
  return {
    async step(name, fn, page) {
      const t = Date.now();
      try { await fn(); } catch (err) {
        console.log(`not ok - ${name}`);
        if (page && process.env.E2E_SHOTS) await page.screenshot({ path: join(process.env.E2E_SHOTS, `${name.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.png`) }).catch(() => {});
        throw err;
      }
      passed++;
      console.log(`ok - ${name} (${Date.now() - t} ms)`);
    },
    get passed() { return passed; },
  };
}
