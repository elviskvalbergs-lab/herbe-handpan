// ── Supabase auth + cloud sync ────────────────────────────────────────────────
const _SUPA_URL = 'https://gvcfrnbnenqfhofvzgoz.supabase.co';
const _SUPA_KEY = 'sb_publishable_WGLxN9-CFdCrlEPiqNn7Dg_T1wKKluA';

let _sb = null;
let _session = null;
let _saveTimer = null;

export function initSupabase(onAuthChange) {
  if (!window.supabase) return;
  _sb = window.supabase.createClient(_SUPA_URL, _SUPA_KEY);
  _sb.auth.onAuthStateChange((event, session) => {
    _session = session;
    onAuthChange(event, session);
  });
  _sb.auth.getSession().then(({ data: { session } }) => {
    if (session) { _session = session; onAuthChange('INITIAL_SESSION', session); }
  });
}

// ── Measurement: PostHog EU (docs/free-to-play.md §9) ───────────────────────
// Off until _PH_KEY is filled in (the project's public key, like _SUPA_KEY).
// Set up for no consent banner: memory-only persistence (no cookie, no stored
// id, each visit counts on its own), no person profiles for guests, session
// recording off. Errors are captured for bug fixing; taps are autocaptured for
// heatmaps. Events before PostHog has loaded wait in a short queue, and every
// failure is silent, so measuring never gets in the way of playing.
const _PH_KEY = '';
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
        api_host: _PH_HOST, persistence: 'memory', person_profiles: 'identified_only',
        autocapture: true, capture_pageview: 'history_change', capture_exceptions: true,
        disable_session_recording: true,
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
  const { error } = await _sb.auth.signInWithOtp({ email });
  return error?.message ?? null;
}

export async function verifyOtp(email, token) {
  if (!_sb) return 'No connection';
  const { error } = await _sb.auth.verifyOtp({ email, token: token.trim(), type: 'email' });
  return error?.message ?? null;
}

export async function signOut() {
  if (_sb) await _sb.auth.signOut();
  _session = null;
}

export async function loadCloudData() {
  if (!_sb || !_session) return null;
  const { data, error } = await _sb
    .from('user_data')
    .select('playlists,layouts,prefs,updated_at')
    .single();
  if (error) return null; // PGRST116 = no row yet; others = real error
  return data;
}

export function scheduleSave() {
  // Stamp local immediately so the timestamp reflects when data changed,
  // not when the cloud write eventually fires.
  const ts = new Date().toISOString();
  localStorage.setItem('hp-updated-at', ts);

  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    if (!_sb || !_session) return;
    _sb.from('user_data').upsert({
      user_id: _session.user.id,
      playlists: JSON.parse(localStorage.getItem('hp-playlists') || '[]'),
      layouts:   JSON.parse(localStorage.getItem('hp-layouts')   || '[]'),
      prefs:     JSON.parse(localStorage.getItem('hp-prefs')     || '{}'),
      updated_at: localStorage.getItem('hp-updated-at'),
    }, { onConflict: 'user_id' }).then(({ error }) => {
      if (error) console.error('Sync error:', error);
    });
  }, 1500);
}

// ── Instruments (needs supabase/migrations/20261111_instruments.sql) ─────────
// Every call fails soft: null / false when signed out, offline, or before the
// migration has been run, so the rest of sync is never affected.

export async function loadCloudInstruments() {
  if (!_sb || !_session) return null;
  const { data, error } = await _sb.from('instruments').select('id,public_id,data,updated_at,deleted_at');
  if (error) { console.warn('Instruments sync unavailable:', error.message); return null; }
  return data;
}

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

// ── Progressions (needs supabase/migrations/20261111_progressions.sql) ───────
// Kept in their own user_data column and their own requests, so the main
// upsert above never names it: until the migration has been run these fail
// soft (null / false) and nothing else in sync is affected.

export async function loadCloudProgressions() {
  if (!_sb || !_session) return null;
  const { data, error } = await _sb.from('user_data').select('progressions').single();
  if (error) { console.warn('Progressions sync unavailable:', error.message); return null; }
  return Array.isArray(data?.progressions) ? data.progressions : [];
}

export async function saveCloudProgressions(list) {
  if (!_sb || !_session) return false;
  const { error } = await _sb.from('user_data').update({ progressions: list }).eq('user_id', _session.user.id);
  if (error) { console.warn('Progressions sync error:', error.message); return false; }
  return true;
}
