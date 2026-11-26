// The app's state: one object every screen reads and changes.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { getAllNotes, preferFlats } from '../data.js';
import { midiToNoteName } from '../instruments.js';
import { playableMidis } from '../ocarina-ui.js';
import { getFavorites, getPlaylists, getProgressions, getSavedLayouts, mergePlaylistsIntoProgressions } from '../storage.js';

// ── State ────────────────────────────────────────────────────────────────────
// Old playlists become the one kind of list before anything reads them.
mergePlaylistsIntoProgressions();

const state = {
  view: 'selector',        // 'home' | 'wizard' | 'instrument' | 'selector' | 'editor' | 'chords' | 'playlist'
  instruments: [],         // My instruments (instruments.js), most recently played first
  currentInstrumentId: null, // instrument being played; null = browsing the catalogue
  wizard: null,            // add-instrument wizard state, see viewWizard()
  tuner: { on: false, reading: null, error: null, lastAdvance: 0 }, // microphone tuner
  rec: newRecState(),      // the armed record field, see uiHzField()
  theme: 'auto',           // 'dark' | 'light' | 'auto' (follows the OS; the default)
  clayEdit: null,          // { id, name, pct, error } while a clay body is edited
  shared: null,            // instrument opened from a share link (#p/<code>), read-only
  sharedStatus: null,      // 'loading' | 'missing' while a share link loads
  shareModal: null,        // { code, url, qr } while the share dialog is open
  help: null,              // the help sheet: { id, anchor } for an article, { id: null } for the list (js/helpdoc.js)
  installHelp: false,      // the "Add to home screen" steps sheet (no install prompt on this browser)
  menu: false,             // the instrument's ⋯ menu is open
  confirm: null,           // { kind: 'instrument' | 'playlist', id, title, body, ok } while confirming
  oc: newOcState(),        // ocarina / flute views, see newOcState()
  showFingers: false,      // finger labels (R4, L1…) inside ocarina holes
  showSizes: false,        // hole sizes in mm on ocarina diagrams
  closeUp: true,           // flute fingerings zoomed in on the holes
  chordsAll: false,        // Chords lists: every chord (true) or the main ones first (false)
  showLyrics: true,        // a song's words under its notes and tab
  ocLegendSeen: false,     // the hole-state legend line has been dismissed
  handLegendSeen: false,   // the finger legend has been shown once
  layout: null,            // current Layout object
  shellMode: 'both',       // 'top' | 'bottom' | 'both'
  ringRotated: false,      // false = standard; true = rotated half-slot
  noteCountFilter: 'all',     // 'all' | '9' | '10' | '11+'
  scaleSearch: '',            // filter text for scale selector
  selectedChord: null,        // ChordResult or null
  chords: [],                 // computed from layout
  chordFilter: { category: 'All', root: 'All', playlist: 'All' },
  noteNames: 'auto',         // 'auto' (as the instrument's scale is written), 'sharps' (C#) or 'flats' (Db); state.useFlats reads it
  useSolfege: false,         // false = letters (C, D, E…); true = solfège (Do, Re, Mi…)
  savedLayouts: getSavedLayouts(),
  favorites: getFavorites(),
  playlists: getPlaylists(),
  activePlaylistId: null,
  pickerChordFavId: null,
  pickerChordObj: null,
  pickerNewPlaylist: false,
  chordCountSet: new Set(), // empty = all; values: '2','3','4','5+'
  pendingSlot: null,       // { shell: 'top'|'bottom'|'ding', index: number }
  pickListen: null,        // the note picker's "Play it": { listening, startedTuner, startedAt, heardAt, error }
  authEmail: '',
  authCode: '',
  saveSheet: null,         // the save sheet (§3): { what, step, email, error, busy, providers }, see saveSheetHtml()
  accountConfirm: null,    // 'signout' | 'delete' while Settings › Account confirms
  accountError: null,
  accountCounts: null,     // Settings › Account: what the server holds, by kind (or 'error')
  legacyImported: 0,       // items brought over from the first app versions, for the toast
  syncPending: 0,          // changes waiting for the server
  lastSynced: null,
  syncError: null,
  sessionLost: false,      // the account's session ended by itself: Settings offers "Sign in again"
  offlineReady: false,     // the service worker is installed (accounts only)
  isOffline: false,
  guestOfflineCard: false, // "You're offline" card for a guest
  remindSignup: false,     // show the save sheet when the connection is back
  leaveWarned: false,      // the "leaving unsaved work" sheet was shown this visit
  autoplaySeconds: 4,
  tempo: 100,                // speed of arpeggios, scales and sequences, % of normal (25–150)
  discoverMode: false,
  hpListen: false,         // handpan Chords: the Listen segment (Browse / Identify / Listen)
  listenUi: null,          // the Listen session, see newListenUi()
  discoverNotes: [],       // ordered note-with-octave strings clicked on the pan
  sourcePlaylistId: null,  // playlist the current chord was opened from, if any
  sourceEntryId: null,     // that entry's id at load time — lets "update" find it after a swap
  hpFilters: false,        // the handpan Chords Filters sheet is open
  hpMore: false,           // the selected chord's More sheet is open (phones)
  pickerInstrumentId: null, // instrument of the ocarina card whose ♡ opened the picker
  plMode: 'chords',        // playlist detail: 'chords' (cards) | 'order' (reorder rows)
  plRowMenu: null,         // index of the playlist entry whose ⋯ menu is open
  instEdit: null,          // id of the instrument in the Edit instrument sheet
  photoCrop: null,
  recLast: null,           // { path, label, text, at }: the set-up reading just recorded, for the guide         // { id, src, iw, ih, ratio, zoom, cx, cy } while fitting a new photo
  plName: null,            // { mode: 'new' | 'rename' | 'prog-new' | 'prog-rename', id, value, error } while naming a playlist or progression
  progressions: getProgressions(), // chord progressions (storage.js): ordered steps, repeats allowed
  activeProgressionId: null, // progression detail (#prog/<id>)
  progMode: 'steps',       // progression detail: 'steps' | 'order' (reorder rows)
  progRowMenu: null,       // index of the step whose ⋯ menu is open
  progPlay: null,          // { id, idx, beat } while a progression plays on the handpan
  pickerMode: 'playlist',  // the ♡ sheet adds to a 'playlist' or a 'progression'
  pickerNewProgression: false, // the ♡ sheet's "New progression" field is open
  chordSheet: null,        // the "Paste a chord sheet" sheet: { step: 'paste' | 'fit', text, target, semis, name, progId, error }
  listen: null,            // Listen (find a scale by ear): { where: 'selector' | 'wizard', listening, notes: [midi], lastSince, startedTuner, error, stopped }
};

// state.useFlats, read wherever a note is named: the Note names setting, and
// on Auto the spelling the instrument on screen is written in (D Kurd has a
// B♭, not an A#; data.js preferFlats).
let _spellKey = null, _spellFlats = false;
function noteSpellingNotes() {
  if (state.view === 'setup' && state.setup?.scaleId) {
    const t = setupTunings(state.setup).find(x => x.id === state.setup.scaleId);
    if (t) return { key: `setup:${t.id}`, notes: () => setupScaleNotes(t) };
  }
  const inst = state.view === 'song' ? songInstrument() : state.view === 'instrument' ? currentInstrument() : null;
  if (inst) return { key: `inst:${inst.id}:${inst.link?.keyId ?? ''}:${inst.updatedAt ?? ''}`, notes: () => playableMidis(inst).map(midiToNoteName) };
  if (state.layout) { const notes = getAllNotes(state.layout); return { key: `layout:${notes.join(',')}`, notes: () => notes }; }
  return null;
}
Object.defineProperty(state, 'useFlats', {
  enumerable: true,
  get() {
    if (state.noteNames !== 'auto') return state.noteNames === 'flats';
    const ctx = noteSpellingNotes();
    if (!ctx) return false;
    if (ctx.key !== _spellKey) { const notes = ctx.notes(); _spellKey = ctx.key; _spellFlats = preferFlats(notes, notes[0]); }
    return _spellFlats;
  },
  set(v) { state.noteNames = v ? 'flats' : 'sharps'; },
});
