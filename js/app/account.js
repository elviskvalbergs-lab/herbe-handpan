// Accounts: the save sheet, signing in, Settings › Account, leaving unsaved work.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { APP_NAME } from '../links.js';
import { DATA_KEYS, accountMatch, accountUserOnDevice, carryOverVisit, clearAccountData, hasAccountOnDevice, safeSetItem, setAccountUserOnDevice, visitHasWork } from '../datastore.js';
import { addChordToPlaylist, getFavorites, getPlaylists, getProgressions, getSavedLayouts, mergePlaylistsIntoProgressions } from '../storage.js';
import { deleteMyAccount, exportAccountRows, fetchAccess, fetchAccountCounts, getAuthProviders, getUserEmail, hasStoredSession, importLegacyData, isLoggedIn, logEvent, scheduleSave, sendOtp, signInWithProvider, signOut, touchLastSeen, verifyOtp } from '../auth.js';
import { syncBases } from '../localdb.js';
import { offline } from '../offline.js';
import { alsoSavedText, dropPendingSave, keepPendingSave, saveText, takePendingSave } from '../store.js';

// ── Accounts: save, sync and offline (docs/free-to-play.md) ─────────────────
// A guest plays everything and keeps nothing between visits (js/datastore.js
// puts their work in this tab only). Saving opens the save sheet; signing in
// moves this visit's work into the account, completes the started save,
// syncs item by item (js/sync.js) and turns offline on (js/offline.js).

const BUILD_HASH = 'dev'; // build.py writes the build's hash: the offline cache version
const PRIVACY_URL = '/privacy'; // the website's, on the same domain (vercel.json sends the app's own address there)
const FEEDBACK_URL = '/request?kind=feedback'; // the website's request form, opened on "Feedback"
const PRIVACY_VERSION = '2026-11';

function accountOn() { return hasAccountOnDevice(); }

// Building ocarinas (the "I'm making one" path, the Build tab, clay bodies)
// is for chosen accounts only: profiles.can_build, ticked by the owner in
// Supabase. Kept on the device so it works offline; cleared at sign-out.
function canBuild() {
  try { return accountOn() && localStorage.getItem('hp-can-build') === '1'; } catch { return false; }
}
function refreshAccess() {
  fetchAccess().then(a => {
    if (!a || !accountOn()) return; // offline or not set up: keep what we knew
    const before = canBuild();
    if (a.canBuild) safeSetItem(localStorage, 'hp-can-build', '1'); else localStorage.removeItem('hp-can-build');
    if (canBuild() !== before) render();
  });
}

// Every saved list read again (after a sync, a carry-over or a sign-out).
function reloadSaved() {
  state.savedLayouts = getSavedLayouts();
  // A playlist that came in from sync (another device, an older version of
  // the app) moves into the one kind of list too.
  mergePlaylistsIntoProgressions();
  state.playlists = getPlaylists();
  state.favorites = getFavorites();
  state.progressions = getProgressions();
  refreshInstruments();
}

// ── The save sheet (§3, §6) ─────────────────────────────────────────────────
// state.saveSheet = { what, step: 'start' | 'code', email, error, busy, providers }

// A guest's save: keep what they started (it survives the Google redirect
// in this tab) and show the sheet. Returns true when it went ahead.
function guestSave(intent) {
  if (accountOn()) return true;
  logEvent('save_tap', { what: intent.what, account: 'guest' });
  keepPendingSave({ ...intent, path: location.pathname + location.search + location.hash });
  openSaveSheet(intent.what);
  return false;
}

function openSaveSheet(what) {
  state.saveSheet = { what, step: 'start', email: state.authEmail || '', error: '', busy: false, providers: null };
  logEvent('signup_shown', { what });
  getAuthProviders().then(p => { if (state.saveSheet) { state.saveSheet.providers = p; render(); } });
  render();
}

// The playlist picker for a guest becomes the save sheet; after sign-in the
// chord goes into Favourites. Called at the start of render().
function guestPickerToSave() {
  if (accountOn() || !state.pickerChordFavId || !state.pickerChordObj || state.saveSheet) return;
  const entry = playlistEntryFor(state.pickerChordObj, state.pickerChordFavId);
  Object.assign(state, { pickerChordFavId: null, pickerChordObj: null, pickerNewPlaylist: false, pickerNewProgression: false });
  guestSave({ what: 'chord', entry });
}

function saveSheetHtml() {
  const s = state.saveSheet;
  const t = saveText(s.what);
  const p = s.providers ?? {};
  const legal = `<p class="save-legal">Free. We only keep your email and what you save. <a href="${PRIVACY_URL}" target="_blank" rel="noopener">Privacy notice</a></p>`;
  let body;
  if (s.step === 'code') {
    body = `
      <p class="sheet-text">We sent a code to <strong>${escHtml(s.email)}</strong>. Type it here, or open the link in the same email.</p>
      ${uiField({
        label: 'Code from the email', id: 'save-code-input', error: s.error,
        control: `<input class="input" id="save-code-input" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="8"
          placeholder="6–8 digits" value="${escHtml(state.authCode)}" autocomplete="one-time-code">`,
      })}
      <button type="button" class="btn btn-primary btn-block" data-action="save-verify"${s.busy ? ' disabled' : ''}>${s.busy ? 'Checking…' : 'Continue'}</button>
      <button type="button" class="btn btn-ghost btn-block" data-action="save-other-email">Use another email</button>`;
  } else {
    const providers = [
      p.google ? `<button type="button" class="btn btn-secondary btn-block" data-action="save-provider" data-provider="google">Continue with Google</button>` : '',
      p.apple ? `<button type="button" class="btn btn-secondary btn-block" data-action="save-provider" data-provider="apple">Continue with Apple</button>` : '',
    ].join('');
    body = `
      <p class="sheet-text save-line">${escHtml(t.line)}</p>
      <p class="save-free">Free · takes seconds · also lets you play offline</p>
      ${providers}
      ${providers ? '<div class="save-or" role="separator"><span>or</span></div>' : ''}
      ${uiField({
        label: 'Email', id: 'save-email-input', error: s.error,
        control: `<input class="input" id="save-email-input" type="email" autocomplete="email" placeholder="you@example.com" value="${escHtml(s.email)}">`,
      })}
      <button type="button" class="btn btn-primary btn-block" data-action="save-send-code"${s.busy ? ' disabled' : ''}>${s.busy ? 'Sending…' : 'Send code'}</button>
      ${legal}`;
  }
  return uiSheet({
    help: uiHelp('accounts-and-saving', 'why'), key: 'save', title: t.title, close: 'save-not-now', body,
    footer: `<button type="button" class="btn btn-ghost" data-action="save-not-now">Not now</button>`,
  });
}

// The sheet's buttons. Returns true when it handled the action.
function saveSheetAction(action, el) {
  const s = state.saveSheet;
  if (action === 'open-sign-in' || action === 'account-sign-in-again') { openSaveSheet('signin'); return true; }
  if (!s) return false;
  if (action === 'save-not-now') {
    // Nothing is lost: the screen stays as it was.
    state.saveSheet = null;
    state.authCode = '';
    dropPendingSave();
    render();
    return true;
  }
  if (action === 'save-send-code') {
    const email = (document.getElementById('save-email-input')?.value || s.email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { s.error = 'Type your email address'; render(); return true; }
    Object.assign(s, { email, error: '', busy: true });
    state.authEmail = email;
    logEvent('signup_method', { what: s.what, method: 'email' });
    render();
    sendOtp(email).then(err => {
      if (state.saveSheet !== s) return;
      s.busy = false;
      if (err) { s.error = navigator.onLine === false ? 'You\'re offline. Try again when you\'re connected.' : err; render(); return; }
      s.step = 'code';
      state.authCode = '';
      render();
    });
    return true;
  }
  if (action === 'save-verify') {
    const code = (document.getElementById('save-code-input')?.value || state.authCode).replace(/\D/g, '');
    if (code.length < 6) { s.error = 'Type the code from the email'; render(); return true; }
    Object.assign(s, { error: '', busy: true });
    _signInMethod = 'email';
    render();
    verifyOtp(s.email, code).then(err => {
      if (state.saveSheet !== s) return;
      s.busy = false;
      if (err) { s.error = 'That code didn\'t work. Check it, or send a new one.'; render(); }
      // On success handleLogin() takes over.
    });
    return true;
  }
  if (action === 'save-other-email') { Object.assign(s, { step: 'start', error: '' }); render(); return true; }
  if (action === 'save-provider') {
    const provider = el.dataset.provider;
    logEvent('signup_method', { what: s.what, method: provider });
    try { sessionStorage.setItem('hp-signin-method', provider); } catch { /* fine */ }
    signInWithProvider(provider).then(err => { if (err) { s.error = err; render(); } });
    return true;
  }
  return false;
}

let _signInMethod = null;

// Completes the started save after sign-in: a chord into Favourites, or the
// tapped action once more (now with an account, so it goes through).
function completePendingSave(pending) {
  if (!pending) return false;
  if (pending.what === 'chord' && pending.entry) {
    const added = addChordToPlaylist('favorites', pending.entry);
    reloadSaved();
    scheduleSave();
    showToast(added === false ? 'Already in Favourites' : 'Saved to Favourites');
    return true;
  }
  if (!pending.action) return false;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.hidden = true;
  btn.dataset.action = pending.action;
  Object.assign(btn.dataset, pending.data || {});
  document.getElementById('app').appendChild(btn);
  btn.click();
  btn.remove();
  return true;
}

// ── Signing in ──────────────────────────────────────────────────────────────
// A guest who signs in (this tab, a magic link or back from Google): their
// visit moves into the account (§5), the started save completes, and the
// account starts syncing. An account that was already here just starts.
async function handleLogin(event, session) {
  if (!session) {
    // The session is gone and nobody pressed Sign out here (it expired or
    // was revoked): everything stays on the device, and Settings offers
    // "Sign in again". While a session is still stored it may come back by
    // itself (offline, a token refresh), so that is not "lost".
    const lost = accountOn() && !_signingOut && !hasStoredSession();
    // "No session" as the page loads changes nothing for a guest: no render
    // (it would empty a field someone has started typing in).
    if (event === 'INITIAL_SESSION' && lost === state.sessionLost) return;
    if (lost) state.sessionLost = true;
    render();
    return;
  }
  const wasLost = state.sessionLost;
  state.sessionLost = false;
  if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') { if (wasLost) render(); return; }
  const uid = session.user?.id ?? null;
  if (!accountOn()) becomeAccount(session);
  else {
    // An account is on this device already. Someone else signing in must
    // not see its things, or sync from where it left off.
    if (accountMatch(accountUserOnDevice(), uid) === 'other') {
      _syncHold = true;
      try { await switchAccountOnDevice(); } finally { _syncHold = false; }
    }
    if (state.saveSheet) { state.saveSheet = null; state.authCode = ''; dropPendingSave(); showToast('Signed in'); }
    render();
  }
  setAccountUserOnDevice(uid);
  startAccount();
  syncSoon(0);
  refreshAccess();
  makerRefresh(); // the maker role and profile (js/makers-ui.js)
}

// A different person signed in on a device that held someone else's
// account: the previous account's saved things, its sync bases and its
// last-pull mark go (as at sign-out), so the new account pulls everything
// of its own from the start and nothing of the old one is pushed into it.
async function switchAccountOnDevice() {
  clearTimeout(_syncTimer);
  for (const key of DATA_KEYS) { try { localStorage.removeItem(key); } catch { /* no storage */ } }
  try { localStorage.removeItem('hp-can-build'); } catch { /* no storage */ }
  await syncBases.clear();
  forgetSharedPushed();
  Object.assign(state, { syncPending: 0, lastSynced: null, syncError: null, accountCounts: null });
  reloadSaved();
  if (state.view !== 'settings') { goHome({ push: false }); navReplace('/'); }
}
let _signingOut = false; // Sign out or Delete account is running: the session ending is expected
let _syncHold = false;   // nothing syncs while the device changes hands

function becomeAccount(session) {
  const pending = takePendingSave();
  const what = state.saveSheet?.what ?? pending?.what ?? 'signin';
  let method = _signInMethod;
  try { method = method ?? sessionStorage.getItem('hp-signin-method') ?? 'link'; sessionStorage.removeItem('hp-signin-method'); } catch { method = method ?? 'link'; }
  state.saveSheet = null;
  state.authCode = '';
  const moved = carryOverVisit();
  reloadSaved();
  const fresh = Date.now() - Date.parse(session.user?.created_at || 0) < 10 * 60 * 1000;
  logEvent('signup_done', { what, method, account: fresh ? 'new' : 'returning' });
  const done = completePendingSave(pending);
  if (done) logEvent('save_completed', { what });
  else render();
  // Everything else built in this visit came along too.
  const names = (moved['hp-instruments'] || []).map(i => i.name)
    .concat((moved['hp-progressions'] || []).map(p => p.name));
  const also = alsoSavedText(names.filter(n => !(pending?.what === 'instrument' && n === currentInstrument()?.name)));
  if (also) setTimeout(() => showToast(also), done ? 3200 : 0);
  else if (!done) showToast('Signed in');
  touchLastSeen({ privacyVersion: PRIVACY_VERSION, source: measurePathOf(pending?.path ?? location.pathname), intent: what });
}

let _accountStarted = false;
function startAccount() {
  if (_accountStarted) return;
  _accountStarted = true;
  touchLastSeen().then(refreshAccess);
  // An account from the first app versions: its instruments, playlists and
  // progressions are brought over once, then arrive with the first sync.
  importLegacyData().then(n => {
    if (n > 0) state.legacyImported = n;
    syncSoon(0);
  });
  startSyncPoll();
  enableOffline();
  render();
}

// ── Settings › Account (§7, §8) ─────────────────────────────────────────────
// What the account holds on the server and what this device holds, side by
// side, so a difference between two devices can be seen (and told to us).
function refreshAccountCounts() {
  if (!accountOn() || !isLoggedIn()) return;
  fetchAccountCounts().then(c => { state.accountCounts = c ?? 'error'; if (state.view === 'settings') render(); });
}
// Playlists are kept as kind 'progression' (the old kind 'playlist' holds only
// the backups of lists moved over, mergePlaylistsIntoProgressions).
const COUNT_WORDS = [['layout', 'handpan/drum/kalimba', 'handpans, drums and kalimbas'], ['instrument', 'ocarina or flute', 'ocarinas and flutes'], ['progression', 'playlist', 'playlists']];
function countsText(c) {
  const parts = COUNT_WORDS.map(([k, one, many]) => c[k] ? `${c[k]} ${c[k] === 1 ? one : many}` : '').filter(Boolean);
  return parts.length ? parts.join(' · ') : 'nothing yet';
}
function deviceCounts() {
  const c = {};
  for (const { kind, data } of syncLocal.items().values()) if (kind !== 'prefs' && !data?.deletedAt) c[kind] = (c[kind] ?? 0) + 1;
  return c;
}

function accountSettingsHtml() {
  if (!accountOn()) {
    return `
      ${uiRow({ lead: 'user', title: 'Sign in', meta: 'Save your instruments, chords and songs, on every device and offline. Free.', action: 'open-sign-in', chevron: true })}
      ${uiRow({ lead: 'shield', title: 'Privacy notice', meta: 'What we keep and why', action: 'open-privacy', chevron: true })}`;
  }
  const n = state.syncPending;
  const status = state.isOffline
    ? (n ? `${n} change${n !== 1 ? 's' : ''} will sync when you're online` : 'Offline · everything is on this device')
    : state.sessionLost ? 'Signed out on this device · your things are still here'
    : !isLoggedIn() ? 'Connecting…'
    : state.syncError === 'error' ? 'Couldn’t sync just now · tap ⟳ to try again'
    : n ? `${n} change${n !== 1 ? 's' : ''} waiting to sync`
    : state.lastSynced ? 'Everything is synced' : 'Getting your things…';
  const lost = state.sessionLost && !isLoggedIn();
  return `
    ${lost
      ? uiRow({ lead: 'user', title: 'Sign in again', meta: escHtml(`${status}. Sign in to sync ${n ? `${n} change${n !== 1 ? 's' : ''}` : 'again'}; nothing is lost.`), action: 'account-sign-in-again', chevron: true })
      : uiRow({ lead: 'user', title: getUserEmail() ?? 'Your account', meta: escHtml(status), trail: isLoggedIn() ? uiIconBtn('refresh', 'Sync now', { action: 'account-sync' }) : '' })}
    ${lost ? '' : uiRow({ lead: 'cloud', title: 'In your account', meta: state.accountCounts === 'error' ? 'Couldn’t be read just now' : state.accountCounts ? escHtml(countsText(state.accountCounts)) : 'Checking…' })}
    ${uiRow({ lead: 'smartphone', title: 'On this device', meta: escHtml(countsText(deviceCounts())) })}
    ${uiRow({ lead: 'cloud-off', title: 'Offline', meta: state.offlineReady ? 'Ready: the app opens without a connection on this device' : 'Getting ready on this device…' })}
    ${uiRow({ lead: 'download', title: 'Export my data', meta: 'Everything in your account, as one file', action: 'account-export', chevron: true })}
    ${uiRow({ lead: 'shield', title: 'Privacy notice', meta: 'What we keep and why', action: 'open-privacy', chevron: true })}
    ${uiRow({ lead: 'log-out', title: 'Sign out', meta: 'This device forgets your things; your account keeps them', action: 'account-signout' })}
    ${uiRow({ lead: 'trash-2', title: 'Delete account', meta: 'Deletes your account and everything in it', action: 'account-delete', cls: 'is-danger' })}`;
}

// Sign out or delete: confirm first (state.accountConfirm = 'signout' | 'delete').
function accountConfirmSheet() {
  const kind = state.accountConfirm;
  if (kind === 'delete') {
    return uiSheet({
      key: 'account-delete', title: 'Delete your account?', close: 'account-confirm-cancel', variant: 'confirm',
      body: `
        <p class="sheet-text">Your instruments, playlists and settings are deleted from the server and this device. This can't be undone. Export your data first if you want a copy.</p>
        ${uiField({ label: 'Type DELETE to confirm', id: 'account-delete-input', error: state.accountError ?? '',
          control: '<input class="input" id="account-delete-input" autocomplete="off" autocapitalize="characters">' })}`,
      footer: `
        <button type="button" class="btn btn-ghost" data-action="account-confirm-cancel">Cancel</button>
        <button type="button" class="btn btn-danger" data-action="account-delete-ok">Delete account</button>`,
    });
  }
  const n = state.syncPending;
  return uiSheet({
    key: 'account-signout', title: 'Sign out?', close: 'account-confirm-cancel', variant: 'confirm',
    body: `<p class="sheet-text">${n
      ? `${n} change${n !== 1 ? 's haven\'t' : ' hasn\'t'} synced yet${state.isOffline ? ' (you\'re offline)' : ''}. If you sign out now, ${n !== 1 ? 'they\'re' : 'it\'s'} lost.`
      : 'Your things stay in your account. This device forgets them, and the app no longer opens offline here.'}</p>`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="account-confirm-cancel">${n ? 'Wait' : 'Cancel'}</button>
      <button type="button" class="btn ${n ? 'btn-danger' : 'btn-primary'}" data-action="account-signout-ok">${n ? 'Sign out anyway' : 'Sign out'}</button>`,
  });
}

// This device forgets the account: saved data, sync bases, the offline
// cache and the service worker (§4 "On sign-out", §8).
async function forgetAccountOnDevice() {
  stopSyncPoll();
  clearTimeout(_syncTimer);
  _accountStarted = false;
  clearAccountData();
  localStorage.removeItem('hp-can-build');
  makerKeepAccess(null);
  if (state.mk) state.mk.info = null;
  await syncBases.clear();
  await offline.disable();
  Object.assign(state, { syncPending: 0, lastSynced: null, offlineReady: false, accountConfirm: null, accountError: null, sessionLost: false, accountCounts: null });
  _signingOut = false;
  reloadSaved();
  goHome({ push: false });
  navReplace('/');
  render();
}

async function exportMyData() {
  if (!isLoggedIn() || state.isOffline) { showToast('Export needs a connection'); return; }
  await syncNow();
  const rows = await exportAccountRows();
  if (!rows) { showToast('Couldn\'t export right now. Try again in a moment.'); return; }
  const file = { exportedAt: new Date().toISOString(), app: APP_NAME, ...rows };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `oakhum-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast('Exported');
}

function accountAction(action) {
  if (action === 'open-privacy') { window.open(PRIVACY_URL, '_blank', 'noopener'); return true; }
  if (action === 'open-feedback') { window.open(FEEDBACK_URL, '_blank', 'noopener'); return true; }
  if (action === 'account-sync') {
    syncNow().then(() => {
      refreshAccountCounts();
      showToast(state.syncError === 'error' ? 'Couldn’t sync just now' : state.syncPending ? 'Some changes are still waiting' : 'Synced');
    });
    return true;
  }
  if (action === 'account-export') { exportMyData(); return true; }
  if (action === 'account-signout') {
    pendingCount().then(n => { state.syncPending = n; state.accountConfirm = 'signout'; render(); });
    return true;
  }
  if (action === 'account-delete') {
    if (!isLoggedIn() || state.isOffline) { showToast('Deleting your account needs a connection'); return true; }
    state.accountConfirm = 'delete'; state.accountError = null; render(); return true;
  }
  if (action === 'account-confirm-cancel') { state.accountConfirm = null; state.accountError = null; render(); return true; }
  if (action === 'account-signout-ok') {
    state.accountConfirm = null;
    _signingOut = true;
    signOut().then(forgetAccountOnDevice).then(() => showToast('Signed out'));
    return true;
  }
  if (action === 'account-delete-ok') {
    const typed = (document.getElementById('account-delete-input')?.value || '').trim().toUpperCase();
    if (typed !== 'DELETE') { state.accountError = 'Type DELETE'; render(); return true; }
    _signingOut = true;
    deleteMyAccount().then(err => {
      if (err) { _signingOut = false; state.accountError = `Couldn't delete it: ${err}`; render(); return; }
      forgetAccountOnDevice().then(() => showToast('Your account is deleted'));
    });
    return true;
  }
  if (action === 'offline-remind') { state.remindSignup = true; state.guestOfflineCard = false; logEvent('guest_offline', { step: 'remind' }); refreshStatusUi(); return true; }
  if (action === 'offline-card-ok') { state.guestOfflineCard = false; refreshStatusUi(); return true; }
  return false;
}

// ── Leaving unsaved work (§3) ───────────────────────────────────────────────
// A guest who built something and goes back to Home or Play sees the save
// sheet once; closing the tab gets the browser's own "Leave site?".
function guestLeaving() {
  if (accountOn() || state.leaveWarned || !visitHasWork()) return false;
  state.leaveWarned = true;
  logEvent('save_tap', { what: 'leave-unsaved', account: 'guest' });
  openSaveSheet('leave');
  return true;
}
window.addEventListener('beforeunload', e => {
  if (!accountOn() && visitHasWork()) { e.preventDefault(); e.returnValue = ''; }
});
