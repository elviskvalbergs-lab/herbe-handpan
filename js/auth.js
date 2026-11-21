// ── Supabase auth + cloud sync ────────────────────────────────────────────────
const _SUPA_URL = 'https://gvcfrnbnenqfhofvzgoz.supabase.co';
const _SUPA_KEY = 'sb_publishable_WGLxN9-CFdCrlEPiqNn7Dg_T1wKKluA';

let _sb = null;
let _session = null;

export function initSupabase(onAuthChange) {
  if (!window.supabase) return;
  _sb = window.supabase.createClient(_SUPA_URL, _SUPA_KEY);
  _sb.auth.onAuthStateChange((event, session) => {
    _session = session;
    onAuthChange(event, session);
  });
  _sb.auth.getSession().then(({ data: { session }, error }) => {
    if (session) { _session = session; onAuthChange('INITIAL_SESSION', session); }
    // No session and nothing went wrong reading it: the app is told too, so
    // an account whose session ended can offer "Sign in again".
    else if (!error) onAuthChange('INITIAL_SESSION', null);
  }).catch(() => {});
}

// Is a session still kept on this device (supabase-js stores it under
// sb-…-auth-token)? While it is, a missing session may come back by itself
// (offline, a token being refreshed). Once it is gone, only signing in again
// brings one back.
export function hasStoredSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (/^sb-.*-auth-token$/.test(localStorage.key(i) || '')) return true;
    }
  } catch { /* no storage */ }
  return false;
}

// ── Measurement: PostHog EU (docs/free-to-play.md §9) ───────────────────────
// _PH_KEY is the project's public key (like _SUPA_KEY); empty turns it off.
// Set up for no consent banner: cookieless mode (nothing stored on the device;
// PostHog's server counts a visitor with a daily hash of IP and browser, and
// the project discards IPs), no person profiles for guests, session
// recording off. PostHog is for usage only: taps are autocaptured for
// heatmaps, while errors and performance go to Sentry, not here. Events before PostHog has loaded wait in a short queue, and every
// failure is silent, so measuring never gets in the way of playing.
const _PH_KEY = 'phc_nh2iTHkNwrRJm9cvptxc5MUErcozvXSzfgpo3eCyg9cP';
const _PH_HOST = 'https://eu.i.posthog.com';
const _eventQueue = [];
let _phState = 'off'; // 'off' | 'loading' | 'ready'
function _loadPosthog() {
  if (!_PH_KEY || _phState !== 'off' || typeof document === 'undefined') return;
  _phState = 'loading';
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://eu-assets.i.posthog.com/static/array.js';
  s.onload = () => {
    try {
      window.posthog.init(_PH_KEY, {
        api_host: _PH_HOST, cookieless_mode: 'always', persistence: 'memory', person_profiles: 'identified_only',
        autocapture: true, capture_pageview: 'history_change', capture_exceptions: false,
        capture_performance: false, disable_session_recording: true,
      });
      _phState = 'ready';
      while (_eventQueue.length) { const [n, p] = _eventQueue.shift(); logEvent(n, p); }
    } catch (e) { _phState = 'off'; }
  };
  s.onerror = () => { _phState = 'off'; };
  document.head.appendChild(s);
}
export function logEvent(name, props = {}) {
  if (!_PH_KEY) return;
  if (_phState !== 'ready') { if (_eventQueue.length < 50) _eventQueue.push([name, props]); _loadPosthog(); return; }
  try { window.posthog.capture(name, { ...props, signed_in: !!_session }); } catch (e) { /* never in the way */ }
}

export function isLoggedIn() { return !!_session; }
export function getUserEmail() { return _session?.user?.email ?? null; }

export async function sendOtp(email) {
  if (!_sb) return 'No connection';
  // The same email has a link too, for someone on this browser (§6).
  const { error } = await _sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
  return error?.message ?? null;
}

export async function verifyOtp(email, token) {
  if (!_sb) return 'No connection';
  const { error } = await _sb.auth.verifyOtp({ email, token: token.trim(), type: 'email' });
  return error?.message ?? null;
}

export async function signOut() {
  // 'local' ends this device's session only, and still clears it offline.
  if (_sb) { try { await _sb.auth.signOut({ scope: 'local' }); } catch { /* cleared below */ } }
  _session = null;
}

// Something saved changed: the app's sync (js/sync.js) picks it up a moment
// later. The name stays from the old whole-blob sync, so callers don't change.
export function scheduleSave() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('hp-data-changed'));
}

// ── Sign-in methods (docs/free-to-play.md §6) ───────────────────────────────
// Google and Apple are offered only when switched on in Supabase (the owner
// sets up the OAuth clients; supabase/README.md). Supabase lists the enabled
// providers in its public auth settings.
let _providers = null;
export async function getAuthProviders() {
  if (_providers) return _providers;
  try {
    const res = await fetch(`${_SUPA_URL}/auth/v1/settings`, { headers: { apikey: _SUPA_KEY } });
    const ext = (await res.json())?.external ?? {};
    _providers = { google: !!ext.google, apple: !!ext.apple };
  } catch {
    return { google: false, apple: false };
  }
  return _providers;
}

// Google or Apple: leaves the page and comes back to it signed in (the
// started save waits in sessionStorage, js/store.js).
export async function signInWithProvider(provider) {
  if (!_sb) return 'No connection';
  const { error } = await _sb.auth.signInWithOAuth({ provider, options: { redirectTo: location.href } });
  return error?.message ?? null;
}

export function getUserId() { return _session?.user?.id ?? null; }

// ── This device ─────────────────────────────────────────────────────────────
// A random id per install, and what kind of device it is, only so a kept
// copy can be named "… (from your tablet)".
export function deviceId() {
  try {
    let id = localStorage.getItem('hp-device-id');
    if (!id) { id = Math.random().toString(36).slice(2, 12); localStorage.setItem('hp-device-id', id); }
    return id;
  } catch { return null; }
}
export function deviceKind(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(ua)) return 'phone';
  return 'computer';
}

// ── Sync by item (supabase/migrations/20261116_accounts.sql) ────────────────
// The api js/sync.js's syncRound talks to. pull() throws when the server
// can't be reached (the round stops, nothing changes); saveItem() returns
// null then, so the change stays in the outbox.
export const syncApi = {
  async pull(since) {
    if (!_sb || !_session) throw new Error('signed out');
    let q = _sb.from('saved_items').select('kind,id,data,version,updated_at,deleted_at,device_kind').order('updated_at');
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async saveItem({ kind, id, data, baseVersion, deleted, editedAt }) {
    if (!_sb || !_session) return null;
    const { data: res, error } = await _sb.rpc('save_item', {
      p_kind: kind, p_id: id, p_data: data, p_base_version: baseVersion, p_deleted: !!deleted,
      p_edited_at: editedAt, p_device_id: deviceId(), p_device_kind: deviceKind(),
    });
    if (error) { console.warn('Sync error:', error.message); return null; }
    return res;
  },
};

// Brings what an account saved with the first app versions (one user_data
// row, ocarinas and flutes in instruments) into saved_items, once per account
// (supabase/migrations/20261117_legacy_import.sql). Resolves to how many
// items were added; 0 when there was nothing, it already ran, or it failed.
export async function importLegacyData() {
  if (!_sb || !_session) return 0;
  const { data, error } = await _sb.rpc('import_legacy_data');
  if (error) { console.warn('import_legacy_data:', error.message); return 0; }
  return Number(data) || 0;
}

// The account was used today (profiles.last_seen_on), and on the first
// call where and why they signed up. Fails soft.
export async function touchLastSeen({ privacyVersion = null, source = null, intent = null } = {}) {
  if (!_sb || !_session) return;
  const { error } = await _sb.rpc('touch_last_seen', { p_privacy_version: privacyVersion, p_signup_source: source, p_signup_intent: intent });
  if (error) console.warn('touch_last_seen:', error.message);
}

// What this account may use beyond the app everyone gets: { canBuild }
// (profiles.can_build, set by the owner in Supabase). null when it can't be
// read (offline, or before the migration), so the caller keeps what it knew.
export async function fetchAccess() {
  if (!_sb || !_session) return null;
  const { data, error } = await _sb.from('profiles').select('can_build').maybeSingle();
  if (error) return null;
  return { canBuild: !!data?.can_build };
}

// What the account holds on the server, counted by kind ({ layout: 3, … }),
// deleted items left out; null when it can't be read. Settings › Account
// shows it next to what this device holds, to see where things are.
export async function fetchAccountCounts() {
  if (!_sb || !_session) return null;
  const { data, error } = await _sb.from('saved_items').select('kind,deleted_at');
  if (error) return null;
  const counts = {};
  for (const r of data ?? []) if (!r.deleted_at) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  return counts;
}

// Export my data: every row the account holds, as the server has it.
export async function exportAccountRows() {
  if (!_sb || !_session) return null;
  const [items, profile] = await Promise.all([
    _sb.from('saved_items').select('kind,id,data,version,updated_at,deleted_at'),
    _sb.from('profiles').select('created_at,privacy_version,signup_source,signup_intent,last_seen_on').maybeSingle(),
  ]);
  if (items.error) return null;
  return { email: getUserEmail(), profile: profile.data ?? null, items: items.data ?? [] };
}

// Deletes the account and everything in it (delete_my_account cascades).
export async function deleteMyAccount() {
  if (!_sb || !_session) return 'Not signed in';
  const { error } = await _sb.rpc('delete_my_account');
  if (error) return error.message;
  await _sb.auth.signOut().catch(() => {});
  _session = null;
  return null;
}

// ── Shared instruments (supabase/migrations/20261111_instruments.sql) ────────
// A shared code is served from the instruments table (get_shared_instrument),
// so a shared instrument is also written there, on sharing and on every
// change after that. Fails soft: false or the error code.
export async function saveCloudInstruments(list) {
  if (!_sb || !_session || list.length === 0) return true;
  const rows = list.map(inst => ({
    owner_id: _session.user.id,
    id: inst.id,
    public_id: inst.publicId ?? null,
    data: inst,
    updated_at: inst.updatedAt,
    deleted_at: inst.deletedAt ?? null,
  }));
  const { error } = await _sb.from('instruments').upsert(rows, { onConflict: 'owner_id,id' });
  if (error) { console.warn('Instruments sync error:', error.message); return error.code ?? false; }
  return true;
}

// Read-only fetch of a shared instrument; works signed out.
export async function fetchSharedInstrument(publicId) {
  if (!_sb) return null;
  const { data, error } = await _sb.rpc('get_shared_instrument', { p_public_id: publicId });
  if (error) { console.warn('Shared instrument unavailable:', error.message); return null; }
  return data;
}
