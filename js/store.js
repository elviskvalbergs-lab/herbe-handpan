// The save moment (docs/free-to-play.md §3). Every action that saves goes
// through the app's save(intent, apply): with an account it just applies;
// a guest gets the save sheet, and the started action is completed after
// sign-in. The pieces here are pure so they can be tested; the sheet and
// the sign-in live in app.js.

// What each tap is saving, by data-action (§"Every action that saves
// something today"). Edits of things a guest can't have (a playlist, a
// progression) need no entry: only the first save of each kind does.
// Building an instrument (the wizard, set-up readings) isn't a save: a
// guest builds it in this visit, and Save keeps it.
export const SAVE_ACTIONS = {
  'save-layout': 'instrument',
  'shared-add': 'instrument',
  'visit-save': 'instrument',
  'pl-new-open': 'playlist',
  'prog-new-open': 'progression',
  'show-new-progression-input': 'progression',
  'confirm-new-progression': 'progression',
  'add-to-progression': 'progression',
  'pl-copy-progression': 'progression',
  'prog-keep': 'song',
  'share-instrument': 'share',
  'maker-start': 'maker',
};
// A pasted chord sheet is not here: a guest plays it straight away (it
// lives in this tab, like an instrument being tried), and 'prog-keep', the
// Save on its "Not saved" banner, is the save moment.
// Chords (☆ / add to playlist, Identify's bookmark) all open the playlist
// picker; for a guest the app turns that into the save sheet, and after
// sign-in the chord goes into Favourites (the picker's entry is plain data,
// so it survives the Google redirect: { what: 'chord', entry }).

// The headline and line of the sheet for each intent (§3's table).
export const SAVE_TEXTS = {
  chord: { title: 'Keep this chord', line: 'Keep your favourite chords one tap away, on any device.' },
  playlist: { title: 'Start a playlist', line: 'Put the chords for a song together and play them on any device.' },
  instrument: { title: 'Keep your instrument', line: 'Set it up once and it’s ready every time, on every device. Without a free account it’s gone when you close this page.' },
  heard: { title: 'Keep what you heard', line: 'Save this as a playlist and play along with it any time.' },
  progression: { title: 'Save this song', line: 'Keep the song’s chords and play along any time, on any device.' },
  song: { title: 'Save this song', line: 'Keep the song’s chords and play along any time, on any device.' },
  share: { title: 'Share your instrument', line: 'Anyone with the link can play it. Your setup stays yours.' },
  leave: { title: 'Save your instrument?', line: 'Without a free account it’s gone when you close this page.' },
  offline: { title: 'Play offline', line: 'With a free account the app opens without a connection, with everything you saved.' },
  maker: { title: 'Set up your maker page', line: 'Free: your profile, a code for every instrument, and how they are used.' },
  signin: { title: 'Sign in', line: 'Your instruments, chords and songs on every device, and offline.' },
};

export function saveText(what) { return SAVE_TEXTS[what] ?? SAVE_TEXTS.signin; }

// What a tap saves for a guest, or null when it needs no account.
export function saveIntentFor(action, { guest }) {
  if (!guest) return null;
  return SAVE_ACTIONS[action] ?? null;
}

// The started action survives a reload, a magic link or the Google
// redirect in this tab: { what, action, data, entry, path }. Cleared once done.
const PENDING_KEY = 'hp-pending-save';
function stSession() { try { return globalThis.sessionStorage ?? null; } catch { return null; } }

export function keepPendingSave(intent) {
  const ss = stSession();
  if (!ss) return;
  // (A full device: the save still completes in this tab, just not after a redirect.)
  try { ss.setItem(PENDING_KEY, JSON.stringify({ what: intent.what, action: intent.action ?? null, data: intent.data ?? {}, entry: intent.entry ?? null, path: intent.path ?? null, at: Date.now() })); } catch { /* not kept */ }
}

// The waiting intent, or null; older than an hour counts as abandoned.
export function takePendingSave(now = Date.now()) {
  const ss = stSession();
  if (!ss) return null;
  const raw = ss.getItem(PENDING_KEY);
  ss.removeItem(PENDING_KEY);
  try {
    const p = JSON.parse(raw);
    if (!p || now - (p.at ?? 0) > 3600000) return null;
    return p;
  } catch { return null; }
}

export function peekPendingSave() {
  try { return JSON.parse(stSession()?.getItem(PENDING_KEY) || 'null'); } catch { return null; }
}

export function dropPendingSave() { stSession()?.removeItem(PENDING_KEY); }

// The data-* attributes of a tapped element worth replaying (no functions,
// no DOM): a plain copy of its dataset.
export function plainDataset(ds = {}) {
  const out = {};
  for (const k of Object.keys(ds)) if (k !== 'action' && typeof ds[k] === 'string') out[k] = ds[k];
  return out;
}

// "Also saved: Low D ocarina and D Kurd" after a carry-over (§5).
export function alsoSavedText(names) {
  const list = names.filter(Boolean);
  if (!list.length) return '';
  const shown = list.slice(0, 3);
  const more = list.length - shown.length;
  const joined = shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0];
  return `Also saved: ${joined}${more > 0 ? ` and ${more} more` : ''}`;
}
