// The built app in a real browser, for scripts that need to look at it
// (scripts/help-screenshots.mjs). Serves the repository root the way Vercel
// does (deep links fall back to index.html), gives the page a fake
// microphone, and stands in for Supabase so a script can sign in and reach
// the screens an account unlocks. Nothing leaves this machine.
//
// The Supabase stand-in follows tests/e2e/accounts.e2e.mjs (same calls, same
// sign-in code); that file keeps its own copy because it also tests two
// devices and version conflicts.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUPABASE_JS = /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wav': 'audio/wav' };

const FAKE_SUPABASE = `
window.supabase = { createClient() {
  const KEY = 'sb-fake-auth-token';
  let session = JSON.parse(localStorage.getItem(KEY) || 'null');
  const listeners = [];
  const emit = (ev) => listeners.forEach(cb => cb(ev, session));
  const call = (op, args) => window.__supa(op, { uid: session?.user?.id ?? null, ...args });
  const query = (table) => {
    const q = { since: null, then(res, rej) { return call('select', { table, since: q.since }).then(data => ({ data, error: null })).then(res, rej); } };
    q.select = () => q; q.order = () => q; q.gt = (_c, v) => { q.since = v; return q; };
    q.maybeSingle = () => Promise.resolve({ data: table === 'profiles' ? { can_build: false } : null, error: null });
    q.upsert = () => Promise.resolve({ error: null });
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
      async signInWithOAuth() { return { error: { message: 'not here' } }; },
    },
    from: query,
    async rpc(name, args) { return { data: await call(name, args), error: null }; },
  };
} };`;

/** Starts the server and the browser. `await app.close()` when done. */
export async function openApp() {
  if (!existsSync(join(ROOT, 'index.html'))) throw new Error('index.html is missing: run python3 build.py first');
  const http = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // Vercel's analytics script only exists on Vercel: an empty one here.
    if (path === '/_vercel/insights/script.js') { res.writeHead(200, { 'content-type': 'text/javascript' }).end(''); return; }
    let file = join(ROOT, path);
    if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    // supabase-js is swapped for a stand-in, which its integrity hash would
    // refuse: the page is served without the hash (as tests/e2e/harness.mjs does).
    res.end(file.endsWith('index.html') ? readFileSync(file, 'utf8').replace(/ integrity="sha384-[^"]+"/, '') : readFileSync(file));
  });
  await new Promise(r => http.listen(0, '127.0.0.1', r));
  const base = `http://localhost:${http.address().port}`;
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });

  /** A fresh visitor (own storage, own stand-in account store). */
  async function visitor({ width = 390, height = 844, scale = 1 } = {}) {
    const rows = new Map();
    let clock = 0;
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, permissions: ['microphone'], serviceWorkers: 'block' });
    await ctx.exposeFunction('__supa', (op, a) => {
      if (op === 'signIn') return { user: { id: 'u1', email: a.email, created_at: '2026-01-01T00:00:00Z' }, access_token: 't' };
      if (op === 'select') return a.table === 'saved_items' ? [...rows.values()].filter(r => !a.since || r.updated_at > a.since) : [];
      if (op === 'save_item') {
        const key = `${a.p_kind}|${a.p_id}`;
        const cur = rows.get(key);
        if (cur && cur.version !== a.p_base_version) return { ok: false, current: cur };
        const ts = new Date(Date.UTC(2026, 0, 1, 12) + ++clock).toISOString();
        const row = { kind: a.p_kind, id: a.p_id, data: a.p_data, version: (cur?.version ?? 0) + 1, updated_at: ts, deleted_at: a.p_deleted ? ts : null, device_kind: a.p_device_kind };
        rows.set(key, row);
        return { ok: true, version: row.version, updated_at: ts };
      }
      return null;
    });
    await ctx.route(SUPABASE_JS, r => r.fulfill({ contentType: 'text/javascript', body: FAKE_SUPABASE }));
    await ctx.route(/\.supabase\.co\//, r => r.fulfill({ contentType: 'application/json', body: '{"external":{"google":false,"apple":false}}' }));
    await ctx.route(/posthog|sentry|ingest/, r => r.abort());
    const page = await ctx.newPage();
    const go = async (path) => { await page.goto(base + path); await page.waitForTimeout(500); };
    /** Signs in through the app's own save sheet (which must be open). */
    const signIn = async () => {
      await page.fill('#save-email-input', 'player@example.com');
      await page.click('[data-action="save-send-code"]');
      await page.fill('#save-code-input', '12345678');
      await page.waitForTimeout(1200);
    };
    return { page, go, signIn, close: () => ctx.close() };
  }

  return { base, visitor, close: async () => { await browser.close(); http.close(); } };
}
