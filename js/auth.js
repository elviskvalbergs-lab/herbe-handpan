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

export async function sendMagicLink(email) {
  if (!_sb) return 'No connection';
  const { error } = await _sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split('#')[0] },
  });
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
    .select('playlists,layouts,prefs')
    .single();
  if (error) return null; // PGRST116 = no row yet; others = real error
  return data;
}

export function scheduleSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    if (!_sb || !_session) return;
    _sb.from('user_data').upsert({
      user_id: _session.user.id,
      playlists: JSON.parse(localStorage.getItem('hp-playlists') || '[]'),
      layouts:   JSON.parse(localStorage.getItem('hp-layouts')   || '[]'),
      prefs:     JSON.parse(localStorage.getItem('hp-prefs')     || '{}'),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }).then(({ error }) => {
      if (error) console.error('Sync error:', error);
    });
  }, 1500);
}
