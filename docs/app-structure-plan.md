# Splitting `js/app.js`

**Status: built in part** (25 Nov 2026). Section 2 (the action registry) and section 4 (the modules) are **built**: `js/app.js` is gone, and the app is the files in `js/app/` listed below. Section 3 (one instrument adapter), section 7 (esbuild) and section 8 (`// @ts-check`) are still **plan**. The rest of this document is the plan as written before the move (its line numbers are of the old `js/app.js`); where the build departed from it, "What was built" says so, and the code wins.

## What was built

One pull request (`refactor/split-app-js`), one commit per file, each built and tested (unit tests, browser tests). A script checked every step: every top-level statement of the old file is in exactly one new file, unchanged; every branch of the old click and change listeners is one registry entry with the same body; the statements that run while the page loads (calls, listeners) run in the same order.

| File | Lines | What it holds |
|---|---|---|
| `state.js` | 127 | `state` and the note spelling |
| `actions.js` | 28 | `registerActions`, `runAction`; tables `ACTIONS`, `EARLY_ACTIONS`, `CHANGE_ACTIONS` |
| `render.js` | 295 | `render()`, focus across re-renders, `sheetHtml`, the ⋯ menu, confirm |
| `util.js` | 40 | `escHtml`, the toast |
| `ui.js` | 187 | `ui*` primitives, the app bar's buttons |
| `picker.js` | 231 | the searchable picker |
| `router.js` | 361 | navigation, URLs, deep links, `openInstrument`, `openStartView` |
| `measure.js` | 58 | measurement |
| `help.js` | 54 | the Help sheet (`helpScreenKey`) |
| `share.js` | 118 | sharing, `currentInstrument` |
| `settings.js` | 204 | Settings, clay bodies |
| `tuner-ui.js` | 316 | tuner strip, record fields |
| `views/chords.js` | 267 | the shared Chords screen parts, Goes well with |
| `views/home.js` | 262 | My instruments, Play, the row menu |
| `views/instrument.js` | 121 | the instrument screen's shared tabs, app bar, banner, Playlists and Songs tabs |
| `views/listen.js` | 225 | Listen (a chord heard) |
| `views/listen-report.js` | 208 | listening reports |
| `views/selector.js` | 260 | scale selector, find a scale by ear |
| `views/setup.js` | 984 | the beginner setup and its guided rounds |
| `views/songs.js` | 328 | Songs to learn: list, open, share |
| `views/song-tab.js` | 444 | a song's tab and practising it |
| `views/wizard.js` | 671 | add-instrument wizard, chart key detection |
| `views/playlists.js` | 548 | playlists, the playlist picker, playlist chord navigation and autoplay |
| `views/progression-play.js` | 349 | playing a progression, play levels |
| `views/progression.js` | 532 | the progression screen |
| `views/sheet-import.js` | 214 | chord sheet → progression |
| `views/builder.js` | 1008 | builder and set-up |
| `views/inst-edit.js` | 554 | photo, hole layout, fingering by hand |
| `instruments/layout-editor.js` | 359 | the layout editor (Pan / Drum / Keys tab) |
| `instruments/layout.js` | 572 | handpan, tongue drum, kalimba: Chords tab and helpers |
| `instruments/wind.js` | 829 | ocarina, flute, recorder: instrument screen, Chords, Practice |
| `install.js` | 53 | add to home screen |
| `prefs.js` | 113 | preferences, speed |
| `sync-ui.js` | 205 | sync and offline |
| `account.js` | 461 | the save sheet, signing in, Settings › Account |
| `main.js` | 323 | bootstrap and the listeners |

Where the build departed from the plan:
- **One pull request**, not nineteen (the owner's choice), and no `tests/app-actions.test.mjs` / `tests/app-imports.test.mjs`: the move was checked by a script instead (above).
- **The six sub-dispatchers stay functions** (`songAction`, `listenReportAction`, `goesWithAction`, `setupAction`, `saveSheetAction`, `accountAction`, plus `makerClick` from `js/makers-ui.js`), called from the click listener after the registry. Turning them into entries means editing their bodies (shared preambles), which is not a move. Their names do not overlap the registry's, and when they don't handle a name they change nothing, so calling them after the registry rather than in the middle of the old chain does the same.
- **`EARLY_ACTIONS`**: `picker-open`, `menu-open`, `row-menu`, `visit-save`, `menu-close` ran before the steps that close a menu when one of its rows is tapped, so they are a table of their own, tried before those steps.
- **Handlers are `(el, e, action)`**: the old bodies use `e` and some read `action`. A branch with an extra condition (`fg-edit-hole`, `b-window`; the change listener's builder fields, `cs-target`) has it as its first line. A key may list several names (`'a, b'`) for one shared body.
- **Imports**: each file imports what it uses from the engine files (generated from what it uses, which also fixes the old list's missing and unused names). Names between `js/app/` files are shared through the bundle's one scope; no `export`s were added. Making them honest modules is part of section 7.
- **The `popstate` listener and the input/keydown listeners stay in `main.js`**, after the bootstrap, as before.
- **File order** follows where each file's load-time statements were in the old file, not the alphabetical order of section 4: `render.js` before `picker.js`, and `install.js`, `prefs.js`, `sync-ui.js`, `account.js` near the end.
- **Files the plan did not have**: `help.js`, `views/instrument.js` (the shared instrument screen parts from the navigation redesign), `views/song-tab.js`, `views/progression-play.js`, `views/selector.js` (with finding a scale by ear), `instruments/layout-editor.js`. No `instruments/adapter.js` yet (section 3).

The instrument shells, re-measured after the split (section 3's table is older than the navigation redesign):
- **Already one shared part**: the tabs and app bar (`instrumentTabs`, `instrumentAppBar`), the Playlists and Songs tabs (`playlistsTabHtml`, `songsTabHtml`), the Chords screen frame, card, rows, list line and mode switch (`chordsScreenHtml`, `chordCardHtml`, `chordRowHtml`, `chordListLineHtml`, `chordModeSegHtml`), the Filters and More sheets (`chordFiltersSheet`, `chordMoreSheet`).
- **Still two**: what goes into those parts (`viewChords` / `viewOcarinaChords` and their helpers), the two chords states (`chordFilter`, `chordCountSet`, `discoverMode`, `hpListen` / `state.oc`) and their action names, links (`stateToHash` / `instUrl`), opening, playing a playlist (Play / Practice). These differ in behaviour, not only in names: a handpan's Chords shows an empty card until a chord is tapped while a wind instrument always shows its first chord; a handpan's Tap notes bookmarks and plays the chords found while a wind instrument's opens them; autoplay is handpan-only, "Not on this ocarina" wind-only. Merging them means choosing one behaviour, which is the owner's call (section 5, pull requests 15–17).

The owner's choices (26 Nov 2026), built: every instrument's Chords shows its first chord until another is picked; a saved ocarina, flute or recorder opens on Chords, as a handpan does; the Playlists tab says Play on every instrument (a wind instrument's practice, chord by chord, stays on the playlist's screen). Still open: Tap notes (what a found chord does), the handpan-only playlist filter with its auto-play bar.

---

## The plan, as written before the move



`js/app.js` is 10,609 lines, 551 KB, 444 top-level functions. The other 31 files in `js/` together are 8,357 lines. It has no unit tests: no file in `tests/` imports it or reads it. Everything below was measured on `review/engineering-foundations` (commit `5e38eb7`); line numbers will drift as the feature branches merge, so re-run the counts in "Re-measuring" before starting.

The goal is not a rewrite. Every step is a move of existing code into a smaller file, or the replacement of one mechanism (the click handler, the two instrument shells) by one that does the same thing. No step changes what the user sees.

---

## 1. Where things stand

### Map of `js/app.js`

| Lines | Size | What it is |
|---|---|---|
| 1–68 | 68 | 32 `import` statements, 257 names. `build.py` strips them, so nothing checks them (see "Imports are not checked" below) |
| 70–157 | 88 | `const state = { … }`: 85 keys |
| 159–260 | 102 | `trackAppHeight()` (runs at load), `render()` (178–247), `watchChordsStage()` |
| 262–304 | 43 | Focus across re-renders: `focusKeyOf`, `focusByKey`, `settleFocus` |
| 306–410 | 105 | Navigation: `APP_HOME`, `navPush`, `navReplace`, `goHome`, `goSelector`, `openSettings`, `removeInstrument`, `removePlaylist`, `backAppBar`, `handpanAppBar` |
| 412–517 | 106 | Settings: `viewSettings`, `viewClayBodies`, `clayEditSheet` |
| 519–697 | 179 | UI primitives: `uiData`, `uiIconBtn`, `uiBadge`, `uiAppBar`, `uiTabBar`, `uiSheet`, `uiRow`, `uiField`, `uiSeg`, `uiEmpty`, `uiSwitchRow`, `uiSetRow`, `uiStepper` |
| 698–911 | 214 | The searchable picker: `uiPicker`, `pickerSheetHtml`, `openPicker` … `pickerChoose` |
| 913–973 | 61 | Scale catalogue: `viewSelector` |
| 975–1137 | 163 | Listen, find a scale by ear: `startListen`, `onListenReading`, `listenPanelHtml` |
| 1139–1331 | 193 | Listening reports: `openListenReport`, `listenReportSheet`, `sendListenReport`, `listenReportAction` |
| 1333–1361 | 29 | `refreshInstruments`, `instrumentRowHtml` |
| 1363–2311 | 949 | Beginner setup: `SETUP_TILES`, `setupFamilyInfo`, the guided rounds (`setupGuideOnNote` 1604, `setupWindOnNote` 1715), `viewBeginnerSetup` (1767–2060, 294 lines), `setupAction` (2073–2311, 239 lines) |
| 2313–2426 | 114 | `viewPlay`, `viewHome`, `rowMenuSheet` |
| 2428–2886 | 459 | Add-instrument wizard: `viewWizard` (2548–2710), chart key detection (`startFluteDetect`, `onFluteDetectReading`, `onOcarinaDetectReading`) |
| 2888–2969 | 82 | Instrument headers and tabs: `ocTabs`, `notSavedBannerHtml`, `ocHeader`, `handpanTabs`, `playlistsTabHtml` |
| 2971–3287 | 317 | Songs: `songsSectionHtml`, `viewSong`, `songTab`, `songTick`, `songAction` |
| 3289–3327 | 39 | `playlistsListHtml`, `viewHandpanPlaylists`, `viewOcarinaPlaylists` |
| 3329–3911 | 583 | Ocarina and flute views: `newOcState`, `ocChordModel`, `viewOcarinaChords`, `ocIdentifyParts`, `ocChordStageParts`, `ocFiltersSheet`, `ocChordMoreSheet`, `viewOcarinaPractice`, `viewInstrument` (3751–3821), `voiceForState` |
| 3913–4014 | 102 | Sharing: `openSharedLink`, `shareInstrument`, `shareModalHtml` |
| 4016–4642 | 627 | Builder and set-up: `uiHzField`, `viewBuilder` (4217–4469, 253 lines), `viewSetup`, `viewFluteSetup` |
| 4644–4981 | 338 | Photo and hole layout: `photoCropSheet`, `layoutCrop`, `finishCrop`, `instEditSheet`, `viewChartSetup`, `viewHoleMap` |
| 4983–5135 | 153 | Fingering by hand: `fgEditStageHtml`, `setupFingersSheet`, `setReading`, `applyDesign` |
| 5137–5440 | 304 | Tuner and record fields: `tunerStripHtml`, `onTunerReading`, `toggleTuner`, `armRecord`, `captureReading` |
| 5442–5486 | 45 | `openInstrument`, `openStartView` |
| 5488–5749 | 262 | Layout editor (the Pan / Drum / Keys tab): `viewEditor`, `renderNotePicker`, note picking by ear |
| 5751–5843 | 93 | Handpan chord helpers: `hpFilteredChords`, `hpSourceEntry`, `hpHeartBtn`, `hpRelatedHtml` |
| 5845–6057 | 213 | Listen, a chord heard: `listenStart`, `listenOnFrame`, `listenCardHtml`, `listenOcStageParts`, `viewListenDebug` |
| 6059–6082 | 24 | `chordsScreenHtml` |
| 6084–6124 | 41 | Speed: `setTempo`, `tempoControlHtml`, `speedSheet` |
| 6126–6228 | 103 | Goes well with: `goesWithSheet`, `goesWithAction` |
| 6230–6496 | 267 | Shared chord parts (`chordCardHtml`, `chordRowHtml`, `chordFilterRowHtml`, `chordCountField`, `chordTypeField`), then `viewChords` (6315–6450), `hpFiltersSheet`, `hpMoreSheet` |
| 6498–6541 | 44 | Add to home screen |
| 6543–6672 | 130 | `sheetHtml` (which sheet is open), `renderPlaylistPicker`, `menuSheet`, `confirmSheet` |
| 6674–6796 | 123 | Playlist detail: `plHere`, `viewPlaylist`, `plRowMenuSheet`, `plNameSheet` |
| 6798–7244 | 447 | Progressions: `progContext`, `progStart`, `progTick`, play levels, `viewProgression` (7069–7183) |
| 7246–7444 | 199 | Chord sheet import: `csTargets`, `chordSheetSheet`, `csSave` |
| 7446–7583 | 138 | Playlist chord navigation and autoplay: `loadPlaylistChordAt`, `favIdForChord`, `startAutoplay` |
| 7585–7799 | 215 | URLs: `stateToHash`, `instUrl`, `currentPath`, `loadFromUrl`, `openLink`, `loadFromHash` |
| 7801–7844 | 44 | Measurement: `measureOpen`, `MEASURE_FEATURES`, `measureFeature` |
| 7846–7942 | 97 | `escHtml`, `showToast`, `loadPrefs`, `applyTheme`, `savePrefs` |
| 7944–8528 | 585 | Accounts: `guestSave`, `saveSheetHtml`, `saveSheetAction`, `completePendingSave`, `handleLogin`, `becomeAccount`, `syncNow`, `enableOffline`, `accountSettingsHtml`, `accountAction`, `guestLeaving`, `rememberLastPath` |
| 8530–8562 | 33 | Bootstrap: `loadPrefs()`, `loadFromUrl()` or `openStartView()`, `render()`, `initSupabase(handleLogin)`, the first listeners |
| 8565–10280 | 1,716 | **The click handler** |
| 10285–10309 | 25 | A second click listener for pan notes on the Chords screen |
| 10312–10477 | 166 | The `change` handler (21 action names) |
| 10480–10594 | 115 | The `input` handler (dispatches on element id and class, not on action) and `keydown` |
| 10597–10609 | 13 | `popstate` |

The five event listeners are 2,046 lines, 19% of the file.

The section comments in the file do not always match what is under them. `viewChords` sits under "Goes well with", the ocarina views under "The song's tab", `openInstrument` under "Record fields". The table above goes by the functions, not the comments.

### The state object

One mutable object, `state` (line 71). The literal declares 85 keys; 13 more are added later by assignment (`setup`, `songCtx`, `songPlay`, `songView`, `songsAll`, `songsFilter`, `songPrinting`, `goesWith`, `listenReport`, `speedSheet`, `playFamily`, `playNotice`, `edArrange`), so 98 keys are in use. The most used: `state.layout` (170 references), `state.view` (143), `state.oc` (136), `state.tuner` (56), `state.wizard` (55).

Beside it are 32 module-level `let` variables (timers and handles: `_listenTimer`, `_songTimer`, `_progTimer`, `_autoplayTimer`, `_syncTimer`, `_tunerStop`, `_pickerOpen`, `_chartDetecting` …) and about 50 constants.

The state has two shapes for "the instrument on screen", and this is the root of section 3:

- a handpan, tongue drum or kalimba is `state.layout` (a copy of the layout), with `state.currentInstrumentId` set only when it is saved, and `state.view` one of `'chords'`, `'editor'`, `'hp-playlists'`;
- an ocarina or flute is `currentInstrument()` (line 3917: the saved instrument, or `state.shared` under the id `SHARED_ID`), with `state.view === 'instrument'` and the tab in `state.oc.tab`.

### How render works

`render()` (178–247) rebuilds the whole page:

1. `guestPickerToSave()`: a guest's playlist picker becomes the save sheet.
2. A 15-branch `if / else if` on `state.view` calls one view function (`viewHome`, `viewBeginnerSetup`, `viewPlay`, `viewWizard`, `viewInstrument`, `viewSelector`, `viewEditor`, `viewChords`, `viewHandpanPlaylists`, `viewPlaylist`, `viewProgression`, `viewSong`, `viewSettings`, `viewClayBodies`, `viewListenDebug`). Each returns an HTML string.
3. `app.innerHTML = …`, with everything after the `<!--appbar-end-->` marker wrapped in `<main>`.
4. Appended after the view: the tuner strip, the record guide, `sheetHtml()` (one sheet at most, chosen from 24 state flags at 6545–6571), the guest offline card.
5. Clean-up that depends on what is now on screen: disarm a record field that left the screen, stop Listen and chart detection, `watchChordsStage`, `layoutCrop`, `settleFocus`.

`render()` is called from about 340 places. There is no diffing; focus and scroll are put back by hand (`settleFocus`, and single cases such as `oc-chord-select` saving `scrollTop`).

### How actions are dispatched

Every control carries `data-action`. One listener on `document` (line 8565) handles all clicks:

1. Lines 8566–8626: pan note clicks (`.pan-note`), before anything else.
2. `el = e.target.closest('[data-action]')`, `action = el.dataset.action`.
3. `measureFeature(action, el)`.
4. **The guest save interception**: `saveIntentFor(action, { guest: !accountOn() })` (from `js/store.js`, table `SAVE_ACTIONS`, 11 actions). When it returns an intent, `guestSave({ what, action, data: plainDataset(el.dataset) })` opens the save sheet and the handler returns. After sign-in `completePendingSave()` (8108) replays the tap by creating a hidden button with the same `data-action` and dataset and calling `.click()` on it.
5. An already selected tab returns; `_lastTrigger` is remembered for focus.
6. Four "this sheet closes when one of its rows is tapped" steps (8647–8650) that do **not** return: the tap goes on to its own branch.
7. The chain: 211 top-level `if (action === '…') { …; return; }` statements, in 20 commented sections. Two of them carry a second condition (`fg-edit-hole` at 8918, `b-window` at 9083), and two grouped branches test a list (`['oc-play-arp', 'oc-voicing', 'oc-show-playlist-picker'].includes(action)` at 9173, the five `prog-step-*` at 9716).
8. Six sub-dispatchers are called from inside the chain, each returning `true` when it handled the action:

| Function | Lines | Action names | Called at |
|---|---|---|---|
| `songAction(action, el)` | 3262–3287 | 10 | 8747 |
| `listenReportAction(action)` | 1294–1309 | 5 | 8748 |
| `goesWithAction(action, el)` | 6208–6228 | 4 | 8749 |
| `setupAction(action, el)` | 2073–2311 | 28 | 8750 |
| `saveSheetAction(action, el)` | 8050–8102 | 6 | 9404 |
| `accountAction(action)` | 8459–8496 | 11 | 9405 |

In numbers: **316 distinct action names** in the file. 233 are handled in the click handler itself, 64 in the six sub-dispatchers, 21 in the `change` handler; `b-window` and `b-design` are handled by both click and change. The largest groups by prefix: `oc-` 34, `setup-` 28, `wizard-` 23, `b-` (builder) 18, `prog-` 18.

Other things the registry has to keep working: the handler uses the event itself in 12 places (`e.stopPropagation()` six times, `e.target.closest(…)` six times), and actions are triggered by synthetic clicks from five places besides the save replay (`oc-chord-select` clicks `oc-play-arp` at 9146; `keydown` clicks the sheet's primary action on Enter and `[data-sheet-close]` on Escape, 10559–10582; the code field clicks `save-verify` at 10549).

### Imports are not checked

`app.js` is never loaded as a module (the site does not import it, no test does), and `build.py` strips imports. So its import list is only documentation, and it has drifted:

- used but not imported: `pickIndex`, `pickMatches`, `noteSearchWords` (from `js/pickmatch.js`) and `TUNER_MIN_RMS` (from `js/tuner.js`);
- imported but not used: `isFavorite`, `usesHoleMap`, `updatePanHighlight`, `PAN_SVG_ID`, `isOnboarded`, `TONGUE_DRUMS`, `addHeardNote`, `writeProgressionsRaw`, `writeInstrumentsRaw`, `isTongueDrumId`, `getProgressionsRaw`, `updatePanShellMode`.

This works today because the bundle is one scope. It matters for the split: the new files must be honest ES modules, or the plan in section 7 (a real bundler, later) and section 8 (type checking) can never happen.

---

## 2. An action registry in place of the click handler

### Shape

A new file, `js/app/actions.js`, holds the table and the one listener. Each module registers its own actions next to the views that emit them.

```js
// js/app/actions.js
const ACTIONS = {};          // click
const CHANGE_ACTIONS = {};   // change (selects, checkboxes, file inputs)

// Registers handlers; a name registered twice stops the app at load, so a
// duplicate can never reach a user (the build's check catches it first).
export function registerActions(handlers, table = ACTIONS) {
  for (const [name, fn] of Object.entries(handlers)) {
    if (table[name]) throw new Error(`Action "${name}" is registered twice`);
    table[name] = fn;
  }
}

// Runs one action. Used by the listener, by keyboard shortcuts and by the
// replay of a guest's save, so none of them need a synthetic click.
export function runAction(name, el, ev) {
  const fn = ACTIONS[name];
  if (!fn) return false;
  fn(el, ev);
  return true;
}
```

```js
// js/app/views/songs.js
registerActions({
  'song-open': el => openSong(el.dataset.id),
  'song-play': () => { … },
});
```

A handler is `(el, ev) => void`. `el` is the element with `data-action`; `ev` is the DOM event, needed by the 12 places that call `ev.stopPropagation()` or look at `ev.target`. Handlers call `render()` themselves, as the branches do today: making the dispatcher render after every action would change behaviour (several branches deliberately do not render, for example `oc-missing-toggle` at 9161).

The listener keeps today's order exactly:

```js
document.addEventListener('click', e => {
  if (panNoteClick(e)) return;                      // lines 8566–8626, moved as one function
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  measureFeature(action, el);
  if (interceptGuestSave(action, el)) return;       // the one pre-dispatch save step
  if (el.matches('.tab[aria-selected="true"]')) return;
  if (!el.closest('.sheet-root')) setLastTrigger(el);
  closeRowSheets(action, el);                       // lines 8647–8650, do not return
  if (runAction(action, el, e)) return;
  legacyClick(action, el, e);                       // the old if-chain, while it lasts
});
```

### The guest save interception stays one step

`SAVE_ACTIONS` and `saveIntentFor` stay in `js/store.js` (they are pure and tested in `tests/accounts.test.mjs`). The step in the listener becomes a named function in `js/app/account.js`:

```js
function interceptGuestSave(action, el) {
  const what = saveIntentFor(action, { guest: !accountOn() });
  if (!what) return false;
  guestSave({ what, action, data: plainDataset(el.dataset) });
  return true;
}
```

It runs before `runAction`, for every action, as now. Handlers never check for a guest themselves. Two rules follow:

- The save intent is not moved into the registry entry (no `{ save: 'instrument', run }` objects). One table in `store.js` is easier to read against docs/free-to-play.md §3 than a flag spread over 30 files, and it is already under test.
- `completePendingSave()` keeps replaying by action name. Once the registry is complete it calls `runAction(pending.action, fakeEl)` where `fakeEl = { dataset: pending.data, closest: () => null, matches: () => false }`, in place of the hidden button. Until then the hidden button stays, because it also reaches the legacy chain. The names in `SAVE_ACTIONS` must not be renamed in the same release: a pending save sits in `sessionStorage` for up to an hour, across the Google redirect.

### Sub-dispatchers

The six `xxxAction(action, el)` functions are the registry already, one level down, and they move first because they need no untangling:

- Each `if (action === 'x') { …; return true; }` inside them becomes an entry in a `registerActions({ … })` call in the same file, and the function and its call in the chain are deleted.
- `setupAction` has shared preamble: `setup-open` is handled first, then `if (!st || !action.startsWith('setup-')) return false` (2082), then code that reads `state.setup` for every remaining branch. That becomes a small wrapper, `const withSetup = fn => (el, ev) => { const st = state.setup; if (st) fn(st, el, ev); }`, applied to the 27 other entries. The same pattern suits `listenReportAction` (needs `state.listenReport`) and `saveSheetAction` (needs `state.saveSheet`).
- Their position in the chain matters only if a name is handled both in a sub-dispatcher and in the chain. Measured: none is (the 64 names and the 233 do not overlap).
- `setupAction('setup-open', el)` is also called directly from the `add-instrument` branch (8746). That becomes `runAction('setup-open', el)`.

### The `change`, `input` and `keydown` handlers

- `change` (10312–10477) dispatches on `data-action` like click, but its branches do not return and two names (`b-window`, `b-design`) exist in both handlers with different meaning (a button and a select). It gets its own table, `CHANGE_ACTIONS`, registered with `registerActions(handlers, CHANGE_ACTIONS)`.
- `input` (10480–10552) dispatches on element id (12 ids) and class (`tempo-slider`, `ld-slider`, `crop-zoom`). It stays a short chain; each branch moves to a function in the module that owns the field, called from one listener. It is 73 lines and not worth a third table.
- `keydown` (10554–10594) stays as it is, but its synthetic clicks become `runAction(…)` calls once the registry is complete.
- The second click listener (10285–10309, pan notes on Chords) merges into `panNoteClick`.

### Migrating without a big bang

1. Add `actions.js` and the listener above. `legacyClick` is the existing chain, unchanged, wrapped in a function. At this point `ACTIONS` is empty and nothing behaves differently.
2. Move branches one section at a time (the 20 sections are listed in section 5, PR 9 onward). A branch moves by cut and paste: `if (action === 'x') { BODY; return; }` becomes `'x': (el, e) => { BODY }`, with inner `return;` kept. No body is edited in the same pull request.
3. The registry is tried first, so a moved branch must be deleted from the chain in the same pull request. The check below fails if it is not.
4. When the chain is empty, delete `legacyClick` and switch `completePendingSave` and `keydown` to `runAction`.

### The checks (added before the first branch moves)

A new unit test, `tests/app-actions.test.mjs`, reads the source files as text (no DOM, no dependencies, same style as the other tests):

1. **No name twice.** Collect every key of every `registerActions({ … })` call plus every `action === '…'` left in `legacyClick`; a name in two places fails. (The runtime `throw` in `registerActions` is the second line of defence; `tests/e2e/smoke.e2e.mjs` fails on the page error.)
2. **Every action in a template has a handler.** Collect action names from the templates and require each to be registered or still in the chain. Names appear in five forms today, all of which the test must read: `data-action="x"`, `action: 'x'` (the `ui*` helpers), `close: 'x'` (`uiSheet`), `open: 'x'` / `rootAction: 'x'` (`chordFilterRowHtml`), and names passed as arguments (`chordCountField(set, 'oc-toggle-count')`, `notSavedBannerHtml('shared-add')`, `hpHeartBtn(…, { action })`). The simplest rule that covers them: every string literal that equals a registered name counts as a use, and every literal after `data-action="` or `action:` must be a registered name. Two templates build the name from a variable (`data-action="${action}"` in `notSavedBannerHtml` and `chordFilterRowHtml`); they are covered by their call sites.
3. **No handler without a control.** A registered name that appears nowhere else as a string literal is dead code; the test lists it. On today's code this finds nothing unexpected, but it will catch branches orphaned by the navigation redesign.
4. **`SAVE_ACTIONS` and `MEASURE_FEATURES` name real actions.** Each key must be registered.

`build.py` already stops on a duplicate top-level name; nothing needs to change there for the registry.

The smoke suite gets one runtime step to match (section 6): on every screen it visits, each `data-action` in the DOM must be a key of `ACTIONS` or `CHANGE_ACTIONS`. (The bundle is a classic script, so `ACTIONS` is reachable by name from `page.evaluate`.)

---

## 3. One instrument adapter in place of two shells

CLAUDE.md says every instrument uses the same screens and plugs its content into shared parts. The parts are shared today (`chordsScreenHtml`, `chordCardHtml`, `chordRowHtml`, `chordFilterRowHtml`, `chordCountField`, `chordTypeField`, `playlistsTabHtml`, `notSavedBannerHtml`), but the code around them exists twice: once for instruments that are a layout (handpan, tongue drum, kalimba: `LAYOUT_FAMILIES` in `js/layoutfamilies.js`) and once for instruments with fingerings (ocarina, flute). The split is by state shape (`state.layout` versus `currentInstrument()` and `state.oc`), and 19 calls to `usesLayout(…)`, 33 comparisons of `.family ===` and 16 of `state.view === 'instrument'` keep the two apart.

### The parallel pairs

| What | Layout shell (handpan, tongue drum, kalimba) | Wind shell (ocarina, flute) |
|---|---|---|
| Which instrument is on screen | `state.layout`, `hpCurrentLayoutId()` (3315) | `currentInstrument()` (3917), `state.shared` |
| Screen selection | three `state.view` values: `'chords'`, `'editor'`, `'hp-playlists'` (in `render()`) | `state.view === 'instrument'` + `state.oc.tab`, in `viewInstrument()` (3751–3821) |
| App bar | `handpanAppBar(tabs)` (400–410) | `ocHeader(inst, view)` (2923–2938) |
| Tabs | `handpanTabs(current)` (2941–2947); actions `go-chords` (9994), `back-editor` (9882), `hp-playlists` (8662) | `ocTabs(inst)` (2896–2907); one action `oc-tab` (9129) |
| Chords screen | `viewChords()` (6315–6450) | `viewOcarinaChords(inst)` (3468–3521) |
| Chord list model | `hpFilteredChords()` (5759–5805) | `ocChordModel(inst)` (3381–3405) |
| Filter state | `state.chordFilter`, `state.chordCountSet`, `state.hpFilters` | `state.oc.category`, `.root`, `.counts`, `.scaleFilter`, `.filtersOpen` |
| Filters sheet | `hpFiltersSheet()` (6453–6472) | `ocFiltersSheet()` (3603–3617) |
| Filter actions | `hp-filters-open` / `-close` / `-clear` (10052–10056), `toggle-note-count` (10083), `filter-root` (10091), `filter-category` (change, 10328) | `oc-filters-open` / `-close` / `-clear` (9150, 9151, 9166), `oc-toggle-count` (9153), `oc-filter-root` (9152), `oc-category` (change, 10447) |
| Chord on top (picture + card) | built inline in `viewChords` | `ocChordStageParts(inst, a)` (3562–3599) |
| Select a chord | `select-chord` (10097) | `oc-chord-select` (9136) |
| Play the chord | `play-chord` (10141): all notes at once | `oc-play-arp` (9180): an arpeggio, a fingering per note |
| Play the scale | `play-scale` (10151) | `oc-play-scale` (8767) |
| More sheet | `hpMoreSheet()` (6475–6487), `state.hpMore`, `hp-more-open` / `-close` (10054, 10055) | `ocChordMoreSheet()` (3621–3652), `state.oc.chordMore`, `oc-more-open` / `-close` (9149, 9160) |
| Browse / Identify / Listen switch | `toggle-discover-mode` (10208); `state.discoverMode`, `state.hpListen` | `oc-listen-mode` (10169); `state.oc.identify`, `state.oc.listen` |
| Identify | `state.discoverNotes`, `discover-clear` (10224), `discover-play` (10259), the second click listener (10285–10309) | `ocIdentifyParts(inst, model)` (3527–3557), `oc-id-note` (10179), `oc-id-clear` (10188), `oc-id-play` (10189) |
| Listen stage | inline in `viewChords` | `listenOcStageParts(inst)` (5993–6008) |
| ♡ on a chord | `show-playlist-picker` (9454) | `oc-show-playlist-picker` (9173), `state.pickerInstrumentId` |
| Playlist entry identity | `entry.layoutId`; `favIdForChord()` (7515) | `entry.instrumentId`; `ocLayoutId()` (3342), `entryInstId()` (3349), `ocFavId()` (3372) |
| Playlists tab | `viewHandpanPlaylists()` (3320) | `viewOcarinaPlaylists(inst)` (3324) |
| Run a playlist | "Play": `hp-play-playlist` (9559), autoplay on the Chords screen | "Practice": `oc-practice-start` (9231), `viewOcarinaPractice` (3686–3739) |
| Playlist detail, whose entries are here | `plHere()` (6680) returns `kind: 'hp'` | the same function returns `kind: 'oc'` |
| Progression context | `progHpContext()` (6826) | `progOcContext()` (6823); both chosen in `progContext()` (6833) |
| Run a progression | `prog-play` (9770): `progStart`, `progTick` | `prog-practice` (9792) |
| Chord sheet target | `csHpTarget()` (7252) | `csOcTarget()` (7255); both listed in `csTargets()` (7261) |
| The link to this screen | `stateToHash()` (7589–7616) | `instUrl(id, tab)` (7620–7626); chosen in `currentPath()` (7629) |
| Open from a link | `openScaleLayout()` (7694), `openSharedLayout()` (7670), custom notes in `openLink()` (7704–7738) | `openChartLink()` (7659), `openSharedLink()` (3921) |
| Open a saved one | `openInstrument()` (5442–5469), the `usesLayout` half | the same function, the other half |
| Save | `save-layout` (9430) | `shared-add` (8820), `visit-save` (8637) |
| ⋯ menu | `menuSheet()` (6618–6657), the `state.layout` branch | the same function, the `state.view === 'instrument'` branch |
| Sound | `voiceForState()` (3871–3887), `layoutInstrument(state.layout)` | the same function, by `inst.family` and `inst.type` |
| Song tab | `songTab()` (3136) by `songTabFamily()` (3116): numbers for a handpan or drum, kalimba notation | fingerings in turn |
| Setup words and tunings | `layoutFamilyInfo()` in `setupFamilyInfo()` (1403) | `SETUP_WIND_WORDS` (1386), `chartSetupTunings()` |
| Guided round in setup | `setupGuideOnNote()` (1604) | `setupWindOnNote()` (1715) |
| Measurement | `measureFamily()` (7807), by `state.layout` | the same function, by `currentInstrument()` |

Some of these are already one function with a branch inside (`plHere`, `progContext`, `csTargets`, `menuSheet`, `openInstrument`, `voiceForState`, `currentPath`): the adapter turns each branch into a call. The Chords screen, its filters, its More sheet and the mode switch are true duplicates with different state and action names.

Parts that only one side has, and that stay instrument-specific: the layout editor (`viewEditor`, 5488–5749), the Notes tab, Practice, the builder, set-up, the hole map and fingering edits of the wind side.

### The adapter

One object per kind of instrument, in `js/app/instruments/layout.js` and `js/app/instruments/wind.js`, looked up by family. A third kind (say, a stringed instrument) is a third file; a new family of an existing kind (a steel tongue kalimba) is still only an entry in `LAYOUT_FAMILIES` or a chart.

First, one description of what is on screen, replacing the two state shapes for every reader outside the adapters:

```js
// js/app/instruments/adapter.js
// The instrument on screen, or null: { adapter, family, name, saved, visiting, inst, layout }
//   saved:    it is in My instruments (inst is set)
//   visiting: opened from a link or a share code, not saved
//   layout:   the layout, for layout families (wind adapters make one on demand: ocarinaToLayout)
export function onScreen() { … }
export function adapterFor(family) { return isLayoutFamily(family) ? LAYOUT_ADAPTER : WIND_ADAPTER; }
```

Then the interface both implement. Every member takes the subject from `onScreen()` (written `s`), so an adapter never reads "is this a handpan" from global state.

| Member | Returns | Layout adapter is today's | Wind adapter is today's |
|---|---|---|---|
| `families` | the family ids it serves | `LAYOUT_FAMILY_IDS` | `['ocarina', 'flute']` |
| `voice(s)` | the audio voice | `layoutInstrument(layout)` | `'ocarina'`, `'whistle'` or `'flute'` |
| `link(s, { tab, chord })` | the path for the address bar and Copy link | `stateToHash()` | `instUrl()` |
| `openLink(link)` | puts a parsed deep link on screen | scale / custom / shared-layout parts of `openLink` | `openChartLink`, `openSharedLink` |
| `openSaved(inst)` | puts a saved instrument on screen | first half of `openInstrument` | second half |
| `tabs(s)` | `[{ id, label, icon }]` | Chords, Pan / Drum / Keys, Playlists | Notes, Chords, Playlists, Build, Set up |
| `tabView(s, tab)` | HTML of a tab other than Chords and Playlists | `viewEditor` | Notes, `viewBuilder`, `viewSetup` |
| `switcher(s)`, `banner(s)`, `menuRows(s)` | app bar parts and ⋯ rows | `handpanAppBar`, the layout branch of `menuSheet` | `ocHeader`, the instrument branch |
| `entryId(s)` / `isHere(entry, s)` | the id playlist and progression entries carry; whether an entry belongs here | `hpCurrentLayoutId`, `!e.instrumentId && e.layoutId === id` | `entryInstId`, `entryIsFor` |
| `chordModel(s, filters)` | `{ items, all, main, roots, missing }` | `hpFilteredChords` | `ocChordModel` |
| `filterFields(s, filters)` | the extra field of the Filters sheet | the playlist picker | the scale select |
| `picture(s, shown)` | the instrument picture for the stage | `renderPan` + `panRotateBtn` | the fingerings of the arpeggio |
| `chordCard(s, item)` | `{ title, metas, actions, below }` for `chordCardHtml` | the card built in `viewChords` | the card in `ocChordStageParts` |
| `chordRow(s, item)` | arguments for `chordRowHtml` | rows in `viewChords` | rows in `viewOcarinaChords` |
| `moreRows(s, item)` | rows of the More sheet | `hpMoreSheet` | `ocChordMoreSheet` |
| `identify` | `{ picture(s), toggle(s, note), found(s) }` | discover mode | `ocIdentifyParts` |
| `listenStage(s, heard)` | `{ picture, card }` | inline in `viewChords` | `listenOcStageParts` |
| `playChord(s, item)` | plays it and lights the picture | `playSelectedChordSound` | the arpeggio of `oc-play-arp` |
| `playScale(s)` | plays the scale | `play-scale` | `oc-play-scale` |
| `runPlaylist` | `{ label, icon, start(s, playlist) }` | Play, autoplay | Practice |
| `runProgression` | `{ label, start(s, prog) }` | `progStart` | practice of the steps |
| `fitTarget(s)` | `{ key, name, layout }` for chord sheet fitting | `csHpTarget` | `csOcTarget` |
| `songTab(s, song)` | the song's tab | numbers / kalimba notation | fingerings |
| `setup` | `{ words, tunings, onNote }` for the beginner setup | `layoutFamilyInfo`, `setupGuideOnNote` | `SETUP_WIND_WORDS`, `setupWindOnNote` |
| `save(s)` | saves a visiting instrument | `save-layout` | `shared-add` |

With that, the shared side becomes single:

- one `viewInstrumentScreen()` that draws app bar, banner, tabs and the current tab for any instrument;
- one `viewChordsTab(s)` calling `chordsScreenHtml` with the adapter's picture, card and rows;
- one Filters sheet, one More sheet, one mode switch;
- one chords UI state, `state.chordsUi = { mode, counts, category, root, extra, selectedKey, filtersOpen, moreOpen }`, replacing `chordFilter`, `chordCountSet`, `hpFilters`, `hpMore`, `discoverMode`, `hpListen` and the matching keys of `state.oc`;
- one set of actions (`chords-select`, `chords-filters-open`, `chords-mode`, `chords-play`, `tab`, …) replacing the pairs in the table.

This is what "Adding an instrument" in CLAUDE.md asks for, made checkable: a new kind of instrument is done when its adapter has every member. A unit test asserts both adapters have the same keys.

### What the adapter must not do

- It does not merge the data models. A layout stays a layout and a chart instrument stays an instrument; `js/storage.js`, `js/instruments.js`, the sync format and playlist entries (`layoutId` versus `instrumentId`) do not change. Saved data and old links keep working with no migration.
- It does not change `js/links.js` or the URL scheme. Wind instruments of mine still use `#i/<id>/<tab>`.
- It does not touch `site/`. The website has its own, smaller version of the same idea in `site/src/lib/engine.ts` (`isPanFamily`, `handpanChords` / `windChords`, `panSvg` / `windFingering`). When the adapters exist as real modules the site can import `voice`, `chordModel` and `picture` from them and drop its copies, but that is a later, separate change.
- Renamed actions keep their old name as an alias for one release where the name is in `SAVE_ACTIONS` (`save-layout`, `shared-add`, `visit-save`) or `MEASURE_FEATURES` (`go-chords`, `play-chord`, `toggle-discover-mode`, `oc-play-arp`, `oc-practice-start`, `hp-play-playlist`), so pending saves replay and the feature counts in PostHog stay comparable.

---

## 4. The modules

### Constraints

- **One script scope.** `build.py` concatenates the files and strips `import` lines and the `export` keyword. Top-level names must be unique across all of `js/`, and the build stops when they are not. The check reads one name per line (`^function|const|let|class NAME`), so `let _listenStopFn = null, _listenTrack = null;` (line 5849) hides its second name: split such lines when moving them.
- **Only the import forms `build.py` can strip.** `import { a, b } from './x.js';` and nothing else: no default imports, no `import * as`, no `import { a as b }` (the alias would not exist in the bundle), no `export { … }` lists, no `export *`, no top-level `await`. A bare `import './x.js'` for its side effects is stripped too; load order comes only from `js_files`.
- **Load order.** Function declarations are hoisted across the whole bundle, so a function may call one from a later file. What must come after what it uses: top-level `const` and `let`, and statements that run at load. In `app.js` today those are the `state` literal (it calls `newRecState()`, `newOcState()`, `getSavedLayouts()`, `getFavorites()`, `getPlaylists()`, `getProgressions()`), `trackAppHeight()` at line 176, the bootstrap at 8531–8562 and the five `addEventListener` calls. In the split: `state.js` first, `actions.js` second (so every later file can call `registerActions` at load), `main.js` last.
- **Honest ES modules.** Every new file imports what it uses and exports what others use, even though the build ignores both. A `let` in one module cannot be assigned from another in a real module (imports are read-only), although the bundle allows it: each of the 32 `let` variables is written only in the file that declares it, and other files call a function (`stopListenTimer()`, not `clearTimeout(_listenTimer)`). Cycles between app modules are fine as long as only functions cross them (`views/*.js` import `render`; `render.js` imports the views).
- **`site/` imports nine engine modules** (`audio`, `brand`, `charts`, `data`, `kalimbas`, `layoutfamilies`, `ocarina-ui`, `pan`, `tonguedrums` and, through them, their imports) through the `@engine/*` path in `site/tsconfig.json`. None of the new `js/app/` files are imported by the site, and nothing moves out of or into those files in this plan. `site/src/lib/listenReport.ts` mentions `listenReportSheet in ../js/app.js` in a comment; update the path when that function moves.
- **File names.** `js/chordsheet.js` exists, so the import sheet is `js/app/views/sheet-import.js`, not another `chordsheet.js`. The service worker and `vercel.json` do not list files under `js/` (the app is one inline page), so new files need no change there.

### The files

All under `js/app/`. Sizes are today's lines for the functions named, plus the click and change branches that go with them.

| File | What moves in | Lines |
|---|---|---|
| `state.js` | `state`, `newOcState`, `newRecState`, `newListenUi`, `newSetup`; the 13 late keys declared in the literal | ~140 |
| `actions.js` | `ACTIONS`, `CHANGE_ACTIONS`, `registerActions`, `runAction` | ~40 |
| `util.js` | `escHtml`, `showToast`, `hideToast` | ~40 |
| `ui.js` | `uiData` … `uiStepper` (519–697), `backAppBar`, `tunerAppBtn`, `settingsAppBtn`, `menuAppBtn` | ~200 |
| `picker.js` | `uiPicker`, `scalePickerOptions`, `pickerSheetHtml`, `openPicker` … `pickerChoose` (698–911) | ~215 |
| `prefs.js` | `loadPrefs`, `applyTheme`, `savePrefs`, `THEME_COLORS`; tempo (`clampTempo`, `setTempo`, `tempoControlHtml`, `speedSheet`) | ~105 |
| `measure.js` | `measureFamily`, `measureOpen`, `MEASURE_FEATURES`, `measureFeature`, `measurePathOf` | ~55 |
| `render.js` | `trackAppHeight`, `render`, `watchChordsStage`, `focusKeyOf`, `focusByKey`, `settleFocus`, `sheetHtml`, `menuSheet`, `confirmSheet` | ~260 |
| `router.js` | `APP_HOME`, `isAppHome`, `navUrl`, `navPush`, `navReplace`, `goHome`, `goSelector`, `openInstrument`, `openStartView`, `stateToHash`, `instUrl`, `currentPath`, `loadFromUrl`, `urlIsLink`, `openLink`, `loadFromHash`, `rememberLastPath`, the `popstate` listener | ~390 |
| `account.js` | `accountOn`, `canBuild`, `refreshAccess`, `reloadSaved`, `guestSave`, `interceptGuestSave`, `openSaveSheet`, `guestPickerToSave`, `saveSheetHtml`, `completePendingSave`, `handleLogin`, `becomeAccount`, `startAccount`, `accountSettingsHtml`, `accountConfirmSheet`, `exportMyData`, `guestLeaving`; the 17 actions of `saveSheetAction` and `accountAction` | ~410 |
| `sync-ui.js` | `SYNC_LISTS`, `SYNC_PREFS`, `syncLocal`, `syncReadList`, `syncReadPrefs`, `syncSoon`, `syncNow`, `pendingCount`, `pushSharedInstruments`, `startSyncPoll`, `enableOffline`, `offlinePillHtml`, `guestOfflineCardHtml`, `refreshStatusUi` | ~180 |
| `settings.js` | `viewSettings`, `viewClayBodies`, `clayEditSheet`, `AUTOPLAY_SECONDS`; the Settings section of the click handler (9893–9955, 14 branches) | ~170 |
| `share.js` | `SHARED_ID`, `currentInstrument`, `openSharedLink`, `loadQrLib`, `shareInstrument`, `shareModalHtml` | ~120 |
| `install.js` | `runningInstalled`, `installBannerHtml`, `installHelpSheet` | ~55 |
| `tuner-ui.js` | `tunerTarget`, `recGuideHtml`, `tunerStripHtml`, `ensureMicWave`, `onTunerReading`, `toggleTuner`, `armRecord`, `disarmRecord`, `captureReading`, `uiHzField` | ~340 |
| `views/home.js` | `refreshInstruments`, `instrumentRowHtml`, `viewPlay`, `viewHome`, `rowMenuSheet`, `viewSelector`, `filterScales`; "My instruments" and "Selector" click sections | ~310 |
| `views/setup.js` | 1363–2311: `SETUP_TILES`, `setupFamilyInfo`, the guided rounds, `viewBeginnerSetup`, the 28 `setup-*` actions | ~950 |
| `views/wizard.js` | 2428–2886: `newWizard`, `viewWizard`, chart key detection; the wizard click section (9250–9402, 23 branches) | ~610 |
| `views/scale-listen.js` | 975–1137 | ~165 |
| `views/listen-report.js` | 1139–1331, with its 5 actions | ~195 |
| `views/listen.js` | 5845–6057: `listenStart`, `listenOnFrame`, `listenCardHtml`, `listenHistoryHtml`, `viewListenDebug` | ~215 |
| `views/songs.js` | 2971–3287, with its 10 actions | ~320 |
| `views/playlists.js` | `playlistsTabHtml`, `playlistsListHtml`, `renderPlaylistPicker`, `plHere`, `viewPlaylist`, `plRowMenuSheet`, `plNameSheet`, `loadPlaylistChordAt`, `playlistEntryFor`, `favIdForChord`, autoplay; the three playlist click sections (9453–9626, 16 branches) | ~560 |
| `views/progression.js` | 6798–7244; the Progressions click section (9627–9878, 29 branches) | ~700 |
| `views/sheet-import.js` | 7246–7444: `csTargets`, `chordSheetSheet`, `csNext`, `csSave` | ~200 |
| `views/chords.js` | `chordsScreenHtml`, `chordCardHtml`, `chordRowHtml`, `chordFilterRowHtml`, `chordsMainOn`, `chordCountLineHtml`, `chordRootsOf`, `chordCountField`, `chordTypeField`, goes-well-with (6126–6228) with its 4 actions; after section 3, the single Chords tab, Filters and More sheets | ~250, ~450 after the adapter |
| `views/builder.js` | 4016–4642 less `uiHzField`: `viewBuilder`, `viewSetup`, `viewFluteSetup`; the "Builder and set-up" click section (8834–9127, 28 branches) | ~900 |
| `views/inst-edit.js` | 4644–5135: photo crop, `instEditSheet`, `viewChartSetup`, `viewHoleMap`, fingering edit, `setReading`, `applyDesign` | ~500 |
| `instruments/adapter.js` | `onScreen`, `adapterFor` (new, section 3) | ~60 |
| `instruments/layout.js` | `handpanAppBar`, `handpanTabs`, `hpCurrentLayoutId`, `viewEditor` and the editor (5488–5749), `hpFilteredChords` and helpers (5751–5843), `viewChords`, `hpFiltersSheet`, `hpMoreSheet`, `panRotateBtn`, `openScaleLayout`, `openSharedLayout`, `renameSavedLayout`, `panNoteClick`; click sections Editor, Chord explorer, Discover mode, Pan rotation, Saved layouts (45 branches) | ~1,150 |
| `instruments/wind.js` | `ocTabs`, `ocHeader`, 3329–3911 (`ocChordModel`, `viewOcarinaChords`, `ocIdentifyParts`, `ocChordStageParts`, `ocFiltersSheet`, `ocChordMoreSheet`, `viewOcarinaPractice`, `viewInstrument`), `openChartLink`, `voiceForState` until the adapter replaces it; click sections "Ocarina Notes view" and "Ocarina Chords view and practice" (33 branches) | ~900 |
| `main.js` | the bootstrap (8531–8562) and the delegating `click`, `change`, `input`, `keydown` listeners | ~120 |

`js/app.js` is deleted at the end. Until then it shrinks with every pull request and stays last but one in `js_files`.

### Place in `build.py`'s `js_files`

The existing 31 engine files stay in their order (CLAUDE.md fixes parts of it). The new files replace `'js/app.js'` at the end of the list:

```
…, js/offline.js, js/store.js,
js/app/state.js, js/app/actions.js, js/app/util.js, js/app/ui.js, js/app/picker.js,
js/app/prefs.js, js/app/measure.js, js/app/share.js, js/app/install.js,
js/app/account.js, js/app/sync-ui.js, js/app/tuner-ui.js, js/app/settings.js,
js/app/views/*.js (alphabetical),
js/app/instruments/adapter.js, js/app/instruments/layout.js, js/app/instruments/wind.js,
js/app/router.js, js/app/render.js,
js/app.js   (what is left, while it lasts),
js/app/main.js
```

`state.js` and `actions.js` must be first and `main.js` last; the order between the others does not matter as long as no file runs code at load that needs a later file's `const`. Keep that true by rule: besides `registerActions(…)` and constant tables, no new file has top-level statements. `build.py`'s banner comment per file (`// ── js/app/ui.js ──`) already makes the bundle readable.

CLAUDE.md's Build section names the order of `js/ocarina.js`, `js/tuner.js` and `js/ocarina-ui.js`; add one line there for `js/app/` when the first file lands.

---

## 5. The order of moves

One pull request per row, each into `preview`, each a branch of its own (`structure/01-guards`, …). Lowest risk first. A move pull request contains moves only: if a function needs a change to be movable (a shared `let`, a missing import), that change is its own earlier pull request.

How to prove a move is only a move: before and after, list every top-level function with a hash of its body across all `js/` files (a 20-line Python script over the same regex `build.py` uses); the two lists must be equal as sets. Put the output in the pull request description. `git diff --color-moved=dimmed-zebra` shows the same thing to the reviewer.

| # | Pull request | Moves | Must not change |
|---|---|---|---|
| 0 | Guards | No moves. Add `tests/app-actions.test.mjs` (checks 2–4 of section 2, run against today's chain) and `tests/app-imports.test.mjs` (every name a file uses from another file is in its import list; no unused imports). Fix the 4 missing and 12 unused imports in `app.js`. Add the missing smoke steps of section 6 | Any behaviour. `index.html` must be byte-identical apart from the stripped import lines |
| 1 | State and string helpers | `state.js`, `util.js`, `ui.js`, `picker.js` | The `state` keys and their defaults (adding the 13 late keys as `null` is allowed only if every reader treats `undefined` and `null` alike: check each with `grep`); any HTML the `ui*` helpers return |
| 2 | Small features | `prefs.js`, `measure.js`, `install.js`, `share.js` | localStorage keys (`hp-prefs`), event names sent by `logEvent` |
| 3 | Leaf views | `settings.js`, `views/songs.js`, `views/listen-report.js`, `views/scale-listen.js`, `views/home.js` (views only; their click branches stay in the chain for now) | Markup and class names (the e2e suites select on them) |
| 4 | Large leaf views | `views/setup.js`, `views/wizard.js` | The setup flow's steps and texts; `SETUP_TILES` |
| 5 | Maker screens | `views/builder.js`, `views/inst-edit.js`, `tuner-ui.js` | Anything behind `canBuild()`; the readings format on instruments |
| 6 | Accounts and sync | `account.js`, `sync-ui.js` | `SAVE_ACTIONS`, the pending-save format in `sessionStorage`, the sync wire format, when the service worker is registered |
| 7 | Router | `router.js` | Every URL the app reads or writes; `tests/links.test.mjs` must pass untouched |
| 8 | The registry, empty | `actions.js`, `main.js` with the listener of section 2; the chain becomes `legacyClick`. Convert the six sub-dispatchers (64 names) | The order of the pre-dispatch steps; which branches render |
| 9 | Click sections, part 1 | `picker-open`, Sheets and confirm, My instruments, Selector, Settings, Navigation (37 branches) into `picker.js`, `render.js`, `views/home.js`, `settings.js`, `router.js` | Branch bodies |
| 10 | Part 2 | Playlist picker, Playlist view, Playlists tab, Progressions (45 branches) | Branch bodies |
| 11 | Part 3 | Add-instrument wizard, Builder and set-up (51 branches) | Branch bodies |
| 12 | Part 4 | Ocarina Notes, Ocarina Chords and practice (33 branches) into `instruments/wind.js`; Editor, Chord explorer, Discover mode, Pan rotation, Saved layouts (45 branches) into `instruments/layout.js`, with the views they belong to | Branch bodies |
| 13 | The other handlers | `change` into `CHANGE_ACTIONS`; `input` branches into owner functions; delete `legacyClick`; `completePendingSave` and `keydown` use `runAction` | The replay of a guest's save (run `tests/e2e/accounts.e2e.mjs`) |
| 14 | Adapter, wrapping | `instruments/adapter.js`; the members that are already one function with a branch (`voice`, `link`, `openSaved`, `entryId`, `isHere`, `fitTarget`, `runPlaylist`, `runProgression`, `menuRows`, `save`). Each old function becomes a one-line call into the adapter | State shape, action names, markup |
| 15 | Adapter, one chords state | `state.chordsUi` replaces the two sets of filter and mode keys | What the filters do; the default "main chords first" list |
| 16 | Adapter, one Chords tab | `viewChordsTab`, one Filters sheet, one More sheet, one mode switch; the paired actions merge (old names kept as aliases where section 3 says) | The look of either Chords screen: compare screenshots at 375 px and 1280 px for a handpan, a tongue drum, a kalimba, an ocarina and a flute |
| 17 | Adapter, one instrument screen | `viewInstrumentScreen`, one tab action; `state.view` values `'chords'`, `'editor'`, `'hp-playlists'` and `'instrument'` become one view with a tab | URLs, `history.state.hpTab` behaviour on back |
| 18 | Clean-up | Delete `js/app.js`; update `docs/design-system.md` ("Rule: one pattern per screen") and the "Adding an instrument" checklist in CLAUDE.md to name the adapter | — |

Pull requests 1–7 can be reordered among themselves. 8 needs 6 (for `interceptGuestSave`). 14–17 need 12. If a feature pull request is open against a section, move a different section that week.

Pull requests 15–17 are the only ones that are not mechanical. They are also the ones that deliver what CLAUDE.md's design rule asks for, so they are worth doing, but each needs the owner's look at the five instruments before merge.

---

## 6. How each step is verified

Every pull request runs `scripts/ci.sh`:

| Check | What it proves for this work |
|---|---|
| `node --test` | The engine modules are untouched; from PR 0, that every template action has a handler, no action is registered twice, and every file's imports are complete |
| `python3 build.py` | The bundle parses (`node --check`) and no top-level name is in two files. This is the check that catches a function left behind in `app.js` after being copied out |
| `cd site && pnpm test && pnpm build` | The website still builds against `js/`. Expected to be unaffected by every step, since no engine module changes; it is the proof of that |
| `tests/e2e/smoke.e2e.mjs` | The built page works in a browser. It opens one deep link per instrument family plus `/play`, runs the first-run setup through "Play my first chord", opens a song, the Playlists tab and Settings, fails on any page error or console error, and has the hostile-link regression test |
| `tests/e2e/accounts.e2e.mjs` | The save sheet and Not now, sign-in completing the started save, carry-over, a second device, offline, the guest offline card, sign-out |

The smoke suite, `tests/e2e/accounts.e2e.mjs` and `tests/e2e/account-safety.e2e.mjs` share `tests/e2e/harness.mjs` and are run by `scripts/e2e.sh`, which `scripts/ci.sh` calls after the build (it installs Playwright where it is missing). They came in with this plan (pull request #83); the plan assumes that pull request is merged before PR 0. The line numbers in this document were measured before #79–#81 merged into `preview`: re-measure (last section) before starting.

A moved function that is never called on a smoke path can still be broken (a name that existed only in `app.js` scope is still found in the bundle, so most mistakes are caught by the import test rather than at runtime). The table says which smoke step exercises each move, and where there is none.

| Move | Covered by | New smoke step needed first |
|---|---|---|
| `state.js`, `util.js`, `ui.js`, `render.js`, `main.js` | every step (a load-order mistake is a page error on the first screen) | none |
| `picker.js` | not covered | open a picker, type two letters, choose a row |
| `prefs.js` | Settings | change the theme in Settings, reload, the theme is kept |
| `measure.js`, `install.js` | load only | none (no behaviour to see; the import test covers them) |
| `share.js` | the hostile-link test | open a `/s/CODE` link served by the stand-in Supabase; in `accounts.e2e.mjs`: ⋯ → Share… shows a code |
| `settings.js` | Settings | open Clay bodies only if `canBuild`; otherwise none |
| `views/songs.js` | the song step | press Play on the song and stop it |
| `views/home.js` | `/play`; My instruments in `accounts.e2e.mjs` | none |
| `views/setup.js` | first-run setup through "Play my first chord" | the wind path: choose Ocarina → "I know my key" → a first chord |
| `views/scale-listen.js`, `views/listen.js`, `tuner-ui.js` | not covered | start the tuner and Listen with Chromium's fake microphone (`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`): the strip appears, stopping removes it, no page error |
| `views/listen-report.js` | not covered | open the report sheet from Listen and close it |
| `views/wizard.js` | not covered | add an ocarina from a chart through the wizard to its Notes tab |
| `views/builder.js`, `views/inst-edit.js` | not covered | with `hp-can-build` set in localStorage and an account in the fake server: open the Build tab of a scale ocarina; open Edit instrument; open Set up of a custom ocarina |
| `account.js`, `sync-ui.js` | `accounts.e2e.mjs`, all of it | none |
| `router.js` | the five deep links, `/play`, the hostile link | browser Back and Forward between two instruments; an old `#scale=D-Kurd` link ends on `/handpan/d-kurd` |
| The registry (PR 8) | every step | on each screen the suite visits: every `data-action` in the DOM is a key of `ACTIONS`, `CHANGE_ACTIONS` or still in the chain |
| Click sections (PRs 9–12) | Playlists tab, Settings, setup, song | ♡ on a chord as an account adds it to Favourites; open the playlist; create a progression, add a step, press Play, stop; paste a two-line chord sheet and save it; on a handpan open Filters, tick "3", Done; switch to Identify and tap two notes; the same four on an ocarina |
| `change` / `input` / `keydown` (PR 13) | not covered | type in the scale search; change a `<select>` (chord type filter); Enter in the save sheet's email field; Escape closes a sheet |
| Adapter (PRs 14–17) | the five deep links | for each of the five families: Chords tab → select the second chord → play it → Filters → Playlists tab → back to Chords, and compare a screenshot of the Chords screen with one taken before the pull request |

The new smoke steps are written against today's `app.js` first (PR 0) and must pass there. Only then do they mean anything for a move.

---

## 7. `build.py` or esbuild

### What `build.py` does today

150 lines of Python with no dependencies: runs `supabase/migrate.py` when `DATABASE_URL` is set (a failed migration stops the deploy); concatenates CSS and 32 JS files; strips imports and `export`; stops on a duplicate top-level name; swaps `_SUPA_URL` / `_SUPA_KEY` for Preview builds (`HP_SUPABASE_URL`, `HP_SUPABASE_KEY`); writes the Sentry environment and release; replaces `BUILD_HASH` with a hash of CSS + JS (the service worker's cache version, `sw.js?v=…`); asserts `sw.js` precaches the same supabase-js; writes one `index.html` with everything inline; runs `node --check` on the bundle.

The page is 1,135 KB (313 KB gzipped): about 1,000 KB of JS, 132 KB of CSS, 3 KB of HTML. Nothing is minified.

### What esbuild would give

| | Today | With esbuild |
|---|---|---|
| Sentry stack traces | Point at a line of the inline script in whatever URL the user was on (`/play`, `/handpan/d-kurd`, …). Readable, because nothing is minified, but the file name and line are of the bundle, not of the source file, and the page URL varies | A hashed `/app.<hash>.js` with a source map uploaded to Sentry: frames name `js/app/views/setup.js:212` |
| Size | 1,135 KB / 313 KB gzipped | Not measured. Minifiers do not shorten the HTML inside template literals, which is most of the views. A fair guess is 30–40% off the raw JS and 15–20% off the gzipped page |
| Module correctness | Imports are unchecked (section 1) | A missing import is a build error |
| Dead code | Stays | Unused exports are dropped |

### What it would cost

- **Every file must be a correct module first.** Today four names in `app.js` resolve only because of the shared scope, and the 32 module-level `let`s are assigned across what will become file borders. esbuild on today's code fails or, worse, builds something that breaks at runtime. This is the same work as "Honest ES modules" in section 4; after the split it is done, before it it is most of the cost.
- **The single inline page.** The service worker precaches `/play` and gets the whole app in one request; `sw.js` is a static file whose version comes from `?v=<hash>`. With an external script, `sw.js` must also precache `/app.<hash>.js` (it can build the name from its `v` parameter), `vercel.json` needs a long cache header for it, and the "is the app page" logic in `sw.js` and `tests/e2e/harness.mjs` must serve it. Keeping the script inline and still using esbuild is possible (bundle to a string, inline it) but then Sentry cannot apply the source map, which removes the main reason.
- **The build's other jobs stay in Python.** Migrations, the Supabase swap, the Sentry values, the hash and the HTML shell are not bundling; esbuild's `define` could replace three of the regex swaps, but `build.py` would still exist and call esbuild. So the result is two tools, not one replaced.
- **A dependency at the repository root.** Vercel's build image has Node, so `npx esbuild` works, but it needs a pinned version: a root `package.json` and lockfile, which the repository deliberately does not have (tests use only `node:test`; CLAUDE.md says "no dependencies, no package.json"). The alternative is to call the site's toolchain (`pnpm --dir site exec esbuild`), which ties the app's build to `site/node_modules` being installed in the app's Vercel project: today that project builds with `python3 build.py` and installs nothing.
- **Source maps need a secret.** Uploading to Sentry needs `SENTRY_AUTH_TOKEN` in Vercel and `sentry-cli` in the build.
- Estimated work, after the split: two to three days including the service worker change, the Vercel settings, the e2e harness and a careful release (an offline account on the old worker must update cleanly).

### Recommendation

**Keep `build.py`. Do not move to esbuild now, and do not make it part of this plan.**

Reasons:

1. The split does not need a bundler. Concatenation handles 60 files as well as 32.
2. The two things esbuild would check (complete imports, no duplicate names) can be checked without it: `build.py` already does the second, and `tests/app-imports.test.mjs` from PR 0 does the first, in about 40 lines with no dependency.
3. Changing how the page is delivered at the same time as moving 10,000 lines would make any regression hard to place. One kind of risk at a time.
4. The size gain is modest and unmeasured, and the page is cached by the service worker for accounts. For guests, 313 KB gzipped on first load is acceptable for an instrument app that then works without further requests.

Revisit after PR 18, for one reason only: Sentry stack traces. At that point every file is an honest module, so the remaining cost is the delivery change (external hashed script, service worker, source map upload). If Sentry reports are by then hard to act on, do it as its own project, with esbuild called from `build.py` and pinned through `site/`'s pnpm lockfile, and keep the "no package.json at the root" rule.

One cheap improvement that does not need esbuild and can go into PR 0: have `strip_modules` replace each stripped import line with an empty line instead of deleting it. Then a bundle line number minus the file's offset (printable by `build.py` as a small table, or kept in a comment at the top of the bundle) is the source line, and a Sentry frame can be traced to a file by hand in seconds.

---

## 8. `// @ts-check` on the pure modules

### What it is

TypeScript can type-check plain JavaScript from JSDoc comments, with no change to what ships: `// @ts-check` at the top of a file, `/** @param {Layout} layout */` on functions, `@typedef` for the shapes. Candidates are the modules with no DOM: `data.js`, `chords.js`, `harmony.js`, `chordsheet.js`, `scalefinder.js`, `setup.js`, `pickmatch.js`, `links.js`, `layoutfamilies.js`, `sync.js`, `store.js`, `charts.js`, `ocarina.js`, `builder.js`, `songs.js`, `listen-detect.js`. There is one JSDoc tag in all of `js/` today.

### What it would catch

- **Note names versus MIDI numbers.** The code passes notes as strings (`'D3'`), as MIDI numbers and as pitch classes, and converts between them in many places (`noteToMidi`, `midiToNoteName`, `notePC`). Passing one where another is expected is the most likely silent bug in this code base, and types catch it exactly.
- **`null` from lookups.** `findTuning`, `getChart`, `getInstrument`, `parseLink` return `null` for an unknown id. With `strictNullChecks` every unchecked use is listed.
- **Object shapes.** A layout (`top.ding`, `top.slots[].note`, `bottom`, `centre`, `pos`), a chord result (`rootNote`, `rootName`, `type.id`, `notes`), an instrument (`kind`, `family`, `chambers`, `setup.fixed`), a parsed link (`kind: 'scale' | 'chart' | 'shared' | 'custom' | 'unknown'`). A misspelt property is an error instead of `undefined`.
- **Imports.** tsc resolves them, so a missing or misspelt import is an error. That would replace the hand-written import test for the checked files.
- The website benefits directly: `site/` already compiles with `allowJs` and `strict`, and imports the engine through `src/lib/engine.ts`, where it re-declares `Tuning` and `Chord` by hand. Typed engine modules would give it the real types.

It would not catch anything in the views (HTML strings), in `state` (one bag of 98 keys) or in the event handlers, which is where most of `app.js`'s risk is. That is the registry's and the smoke suite's job.

### Cost

- About ten `@typedef`s (Layout, Shell, Slot, Scale / Tuning, ChordType, ChordResult, Instrument, Chamber, Chart, Link) in one file, `js/types.js`, which contains only comments (and so adds nothing to the bundle but must be in `js_files`, or be a `.d.ts` outside it).
- JSDoc on the exported functions of each module: 217 `export` lines across the 16 files.
- Fixing what the first run reports. Unknown until it is run; expect a few real bugs and many places where a `null` check or a cast comment is needed. Start with `strict: false` plus `strictNullChecks: true`, one module at a time, so the first pull request is small.
- One thing to watch in this build: `strip_modules` deletes any line that begins with `import`. JSDoc type references such as `{import('./types.js').Layout}` sit inside a comment line and are safe; a wrapped comment whose continuation line starts with the word `import` at column 0 would be deleted. Keep each type reference on one line.

### How it would run in CI

`tsc --noEmit --allowJs --checkJs` needs the `typescript` package. The root has no `package.json` and should stay that way; `site/` already has `typescript ^5` and a `typecheck` script. So:

- add `site/tsconfig.engine.json`: `{ "compilerOptions": { "allowJs": true, "checkJs": true, "noEmit": true, "strictNullChecks": true, "target": "ES2022", "module": "esnext", "moduleResolution": "bundler", "lib": ["es2022", "dom"] }, "include": ["../js/data.js", "../js/chords.js", …] }`, listing only files that carry `// @ts-check`;
- add `"typecheck:engine": "tsc -p tsconfig.engine.json"` to `site/package.json`;
- `scripts/ci.sh` runs it after `pnpm install`, next to `pnpm test`.

`node --test` stays dependency-free. The cost to CI is a few seconds.

### Recommendation

**Yes, but after the split, and starting with four files.** `data.js`, `chords.js`, `links.js` and `layoutfamilies.js` are imported by almost everything, are already covered by unit tests (so adding types cannot hide a behaviour change), and define the shapes the rest uses. Do those four in one pull request with the `site/` config above. If it finds real bugs or makes the next feature easier to write, continue module by module (`harmony.js`, `sync.js`, `store.js`, `chordsheet.js`, `setup.js`, then the rest); if it only produces cast comments, stop there with the shared typedefs in place, which are worth having as documentation alone.

Not before the split, because typing nothing in `app.js` while `app.js` is half the code gives a false sense of coverage, and because the adapter of section 3 is the natural place for the first types that cross from the engine into the app (`Subject`, `InstrumentAdapter`). Those two typedefs are worth writing as JSDoc when PR 14 lands, checked or not.

---

## Re-measuring

The numbers in this document, and how to get them again from the repository root:

```sh
wc -l js/*.js                                              # sizes
grep -cE '^(async )?function' js/app.js                    # top-level functions: 444
grep -nE '^// ── ' js/app.js                               # section comments
grep -n "addEventListener('click'" js/app.js               # the click handler starts at the second match
grep -oE "action === '[^']+'" js/app.js | sort -u | wc -l  # distinct action names tested with ===: 315 (+ oc-show-playlist-picker, tested in a list)
grep -cE "^  if \(action === '" js/app.js                  # top-level branches (click and change handlers together)
grep -cE '^let ' js/app.js                                 # module-level lets: 32
grep -c 'render()' js/app.js                               # render call sites
ls -l index.html && gzip -c index.html | wc -c             # page size after python3 build.py
```
