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
