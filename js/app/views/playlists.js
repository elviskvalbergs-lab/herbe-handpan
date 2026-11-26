// Playlists: lists, the playlist picker, a playlist, playing its chords.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { createLayoutFromScale, displayNote, notePC } from '../../data.js';
import { icon } from '../../icons.js';
import { findAllChords } from '../../chords.js';
import { findTuning } from '../../layoutfamilies.js';
import { getInstrument, handpanInstrumentId, usesLayout } from '../../instruments.js';
import { initAudio, playChord } from '../../audio.js';
import { updatePanPlaying } from '../../pan.js';
import { playableMidis } from '../../ocarina-ui.js';
import { addChordToPlaylist, addPlaylist, addProgression, deletePlaylist, getFavorites, getPlaylists, getProgressions, removeChordFromPlaylist, renamePlaylist, renameProgression, updatePlaylistChordVoicing } from '../../storage.js';
import { scheduleSave } from '../../auth.js';

function removePlaylist(id) {
  if (id === 'favorites') { render(); return; }
  deletePlaylist(id);
  state.playlists = getPlaylists();
  if (state.view === 'playlist' && state.activePlaylistId === id) {
    state.view = 'home';
    state.activePlaylistId = null;
    navPush('/');
  }
  scheduleSave();
  render();
}

function playlistsListHtml(inst) {
  const newBtn = `<button type="button" class="btn btn-ghost pl-new" data-action="pl-new-open">${icon('plus')} New playlist</button>`;
  if (state.playlists.length === 0) {
    return uiEmpty({
      icon: 'list-music', title: 'No playlists yet', body: 'Tap the bookmark on any chord to start one.',
      action: `<button class="btn btn-secondary" data-action="${inst ? 'oc-tab' : 'go-chords'}" data-tab="chords">Go to Chords</button>`,
    }) + newBtn;
  }
  const layoutId = !inst ? hpCurrentLayoutId() : null;
  const hereOf = pl => pl.chords.filter(c => (inst ? entryIsFor(c, inst) : !c.instrumentId && c.layoutId === layoutId)).length;
  // Playlists with nothing for this instrument wait behind "Show … from
  // other instruments" (listsOtherHtml); an empty one stays in view.
  const isOther = pl => pl.chords.length > 0 && hereOf(pl) === 0;
  const other = state.playlists.filter(isOther).length;
  const shown = state.playlists.filter(pl => state.listsShowOther || !isOther(pl));
  return `
    <div class="list">
      ${shown.map(pl => {
        const here = hereOf(pl);
        const trail = inst
          ? `<button type="button" class="btn btn-primary btn-sm" data-action="oc-practice-start" data-id="${escHtml(pl.id)}" ${here ? '' : 'disabled'}>${icon('play')} Practice</button>`
          : `<button type="button" class="btn btn-primary btn-sm" data-action="hp-play-playlist" data-id="${escHtml(pl.id)}" ${here ? '' : 'disabled'}>${icon('play')} Play</button>`;
        return uiRow({
          lead: 'list-music', title: pl.name, chevron: true, action: 'open-playlist', data: { id: pl.id }, trail,
          meta: `${here} chord${here !== 1 ? 's' : ''} here · ${pl.chords.length} in total`,
        });
      }).join('')}
      ${listsOtherHtml(other, 'playlist')}
    </div>
    ${newBtn}`;
}
// The row that shows (or hides again) the lists made on other instruments.
function listsOtherHtml(other, word) {
  if (!other) return '';
  const what = `${other} ${word}${other !== 1 ? 's' : ''}`;
  return state.listsShowOther
    ? uiRow({ lead: 'chevron-up', title: `Hide the ${what} with chords this instrument doesn’t have`, action: 'lists-other' })
    : uiRow({ lead: 'chevron-down', title: `Show ${what} with chords this instrument doesn’t have`, meta: 'They play the chords it does have', action: 'lists-other' });
}

// Add to playlist: tick playlists, or start a new one. Its Progression
// segment appends the chord as a step instead (repeats allowed).
// ♡ of a chord: add it to a playlist (at the end; the same chord can go in
// more than once). A ✓ shows the playlists it is in already.
function renderPlaylistPicker() {
  const chord = state.pickerChordObj;
  const entry = chord && state.pickerChordFavId ? playlistEntryFor(chord, state.pickerChordFavId) : null;
  const rows = state.progressions.map(p => {
    const n = entry ? p.steps.filter(st => st.chordId === entry.chordId && st.layoutId === entry.layoutId).length : 0;
    return uiRow({
      lead: `<span class="row-check">${icon(n ? 'check' : 'plus')}</span>`, title: p.name,
      meta: p.steps.length ? escHtml(p.steps.slice(-3).map(progStepTitle).join(' · ')) : 'No chords yet',
      trail: `<span class="chord-count">${p.steps.length}</span>`, cls: n ? 'is-current' : '',
      action: 'add-to-progression', data: { 'prog-id': p.id },
    });
  }).join('');
  const create = state.pickerNewProgression
    ? `<div class="picker-new-row">
         <input class="input" id="new-progression-input" placeholder="Playlist name" aria-label="New playlist name">
         <button class="btn btn-primary" data-action="confirm-new-progression">Create</button>
       </div>`
    : uiRow({ lead: `<span class="row-check">${icon('plus')}</span>`, title: 'New playlist', action: 'show-new-progression-input' });
  return uiSheet({
    help: uiHelp('playlists', 'start'), key: 'picker', title: 'Add to playlist', close: 'close-playlist-picker',
    body: `<p class="picker-hint">Adds the chord at the end. The same chord can go in more than once; ✓ marks the playlists it is in already.</p><div class="list">${rows}${create}</div>`,
  });
}

// ── View 4: Playlist ─────────────────────────────────────────────────────────
// Playlist detail (§6.9): Play or Practice on the instrument you came from,
// the chords (handpan rows, ocarina and flute entries as their instrument's
// chord cards), an Order mode to rearrange, and Rename / Delete in ⋯.

// The instrument the playlist was opened from and how many entries are its.
function plHere(pl) {
  const inst = state.currentInstrumentId ? currentInstrument() : null;
  if (inst && !usesLayout(inst)) {
    return { kind: 'oc', name: inst.name, n: pl.chords.filter(c => entryIsFor(c, inst)).length };
  }
  const layoutId = hpCurrentLayoutId();
  if (!layoutId) return null;
  return { kind: 'hp', name: state.layout.name, n: pl.chords.filter(c => !c.instrumentId && c.layoutId === layoutId).length };
}

function plEntryTitle(en) {
  return `${displayNote(en.rootName, state.useFlats, state.useSolfege)} ${en.typeName}`;
}
function plEntryMeta(en) {
  return escHtml(`${en.scaleName} · ${en.notes.map(n => displayNote(n, state.useFlats, state.useSolfege)).join(' · ')}`);
}

function viewPlaylist() {
  const pl = state.playlists.find(p => p.id === state.activePlaylistId);
  if (!pl) return viewSelector();
  const uf = state.useFlats, us = state.useSolfege;
  const here = plHere(pl);
  const order = state.plMode === 'order';
  const last = pl.chords.length - 1;

  const play = !here?.n ? '' : here.kind === 'oc'
    ? `<button type="button" class="btn btn-primary btn-lg btn-block" data-action="pl-practice">${icon('play')} Practice on ${escHtml(here.name)}</button>`
    : `<button type="button" class="btn btn-primary btn-lg btn-block" data-action="hp-play-playlist" data-id="${escHtml(pl.id)}">${icon('play')} Play</button>`;

  let entries;
  if (pl.chords.length === 0) {
    entries = uiEmpty({
      icon: 'bookmark', title: 'No chords yet', body: 'Tap the bookmark on any chord to add it here.',
      action: here ? '<button type="button" class="btn btn-secondary" data-action="pl-go-chords">Go to Chords</button>' : '',
    });
  } else if (order) {
    entries = `<div class="list">${pl.chords.map((en, idx) => uiRow({
      title: plEntryTitle(en), meta: plEntryMeta(en), cls: 'pl-order-row',
      trail: `
        ${uiIconBtn('chevron-up', 'Move up', { action: 'move-chord-up', data: { idx }, disabled: idx === 0 })}
        ${uiIconBtn('chevron-down', 'Move down', { action: 'move-chord-down', data: { idx }, disabled: idx === last })}
        ${uiIconBtn('x', 'Remove from playlist', { action: 'remove-playlist-chord', data: { idx } })}`,
    })).join('')}</div>`;
  } else {
    entries = `<div class="pl-entries">${pl.chords.map((en, idx) => {
      const inst = en.instrumentId ? entryInstrument(en) : null;
      if (inst && playableMidis(inst).length) {
        // Same row as a handpan entry: it opens the chord on its instrument.
        return `<div class="list">${uiRow({
          title: `${displayNote(en.rootName, uf, us)} ${en.typeName}`,
          meta: escHtml(`${inst.name}${en.category ? ' · ' + en.category : ''} · ${en.notes.map(n => displayNote(n, uf, us)).join(' · ')}`),
          action: 'open-playlist-chord', data: { idx }, chevron: false,
          trail: uiIconBtn('ellipsis', 'Move or remove', { action: 'pl-row-menu', data: { idx }, attrs: 'aria-haspopup="dialog"' }),
        })}</div>`;
      }
      return `<div class="list">${uiRow({
        title: plEntryTitle(en),
        meta: en.instrumentId ? `${escHtml(en.scaleName)} · no longer in My instruments` : plEntryMeta(en),
        action: en.instrumentId ? '' : 'open-playlist-chord', data: { idx },
        trail: uiIconBtn('ellipsis', 'Move or remove', { action: 'pl-row-menu', data: { idx }, attrs: 'aria-haspopup="dialog"' }),
      })}</div>`;
    }).join('')}</div>`;
  }

  return `
    ${backAppBar(pl.name, { actions: [tunerAppBtn(), menuAppBtn()] })}
    <div class="playlist-view">
      ${play}
      ${pl.chords.length > 1 ? uiSeg([{ value: 'chords', label: 'Chords' }, { value: 'order', label: 'Order' }], state.plMode, { action: 'pl-mode', label: 'Show' }) : ''}
      ${entries}
    </div>
  `;
}

// ⋯ of a playlist entry: Move up, Move down, Remove.
function plRowMenuSheet() {
  const pl = state.playlists.find(p => p.id === state.activePlaylistId);
  const idx = state.plRowMenu;
  const en = pl?.chords[idx];
  if (!en) return '';
  const rows = [
    uiRow({ lead: 'chevron-up', title: 'Move up', action: 'move-chord-up', data: { idx }, cls: idx === 0 ? 'is-disabled' : '' }),
    uiRow({ lead: 'chevron-down', title: 'Move down', action: 'move-chord-down', data: { idx }, cls: idx === pl.chords.length - 1 ? 'is-disabled' : '' }),
    uiRow({ lead: 'trash-2', title: 'Remove from playlist', action: 'remove-playlist-chord', data: { idx }, cls: 'is-danger' }),
  ].join('');
  return uiSheet({ key: 'pl-row', variant: 'plrow', title: plEntryTitle(en), close: 'pl-row-close', body: `<div class="list">${rows}</div>` });
}

// New playlist / Rename playlist: one name field.
function plNameSheet() {
  const n = state.plName;
  const isNew = n.mode === 'new' || n.mode === 'prog-new';
  const what = 'playlist';
  return uiSheet({
    key: 'pl-name', title: `${isNew ? 'New' : 'Rename'} ${what}`, close: 'pl-name-cancel',
    body: `<div class="hp-sheet-form">${uiField({
      label: 'Name', id: 'pl-name-input', error: n.error ? 'Give it a name' : '',
      control: `<input class="input" id="pl-name-input" value="${escHtml(n.value)}" placeholder="${what === 'playlist' ? 'Playlist' : 'Progression'} name" autocomplete="off">`,
    })}</div>`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="pl-name-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" data-action="pl-name-save">${isNew ? 'Create' : 'Save'}</button>`,
  });
}

// Plays a playlist on the handpan on screen: opens its first chord for this
// handpan in Chords, filtered to the playlist, and turns auto-play on.
function hpPlayPlaylist(pl) {
  const layoutId = hpCurrentLayoutId();
  const idx = pl.chords.findIndex(c => !c.instrumentId && c.layoutId === layoutId);
  if (idx < 0) return;
  if (!loadPlaylistChordAt(pl, idx)) { showToast('Scale not found'); return; }
  state.chordFilter = { category: 'All', root: 'All', playlist: pl.id };
  state.view = 'chords';
  navPush(stateToHash());
  startAutoplay(pl);
}

// ── Playlist chord navigation (shared by manual open + autoplay) ────────────
function loadPlaylistChordAt(pl, idx) {
  const fav = pl.chords[idx];
  if (!fav || fav.instrumentId) return false; // ocarina / flute entries play on their own instrument
  if (fav.layoutData) {
    state.layout = fav.layoutData;
  } else {
    const saved = state.savedLayouts.find(l => l.id === fav.layoutId);
    if (saved) {
      state.layout = saved.layout;
    } else {
      const scale = findTuning(fav.layoutId);
      if (!scale) return false;
      state.layout = createLayoutFromScale(scale);
    }
  }
  state.chords = findAllChords(state.layout);
  const canonical = state.chords.find(c => c.id === fav.chordId) || null;
  if (canonical) {
    // Preserve the exact voicing saved with this playlist entry — it may differ
    // from the canonical (default) notes if the user swapped to an alt position.
    state.selectedChord = Array.isArray(fav.notes) ? { ...canonical, notes: fav.notes } : canonical;
  } else {
    // No canonical chord type (e.g. a Discover-mode "Custom" combination) —
    // rebuild a displayable chord object directly from what was saved.
    state.selectedChord = {
      id: fav.chordId, rootName: fav.rootName,
      type: { name: fav.typeName, category: fav.category },
      notes: fav.notes, noteCount: fav.noteCount,
    };
  }
  state.shellMode = 'both';
  const owned = getInstrument(handpanInstrumentId(fav.layoutId));
  state.currentInstrumentId = owned ? owned.id : null;
  // Remember where this chord came from so a later voicing swap can be
  // saved back into this exact entry instead of only adding a new one.
  state.sourcePlaylistId = pl.id;
  state.sourceEntryId = fav.id;
  return true;
}

// The playlist entry for a chord picked in the playlist picker. Handpan
// entries are unchanged; ocarina and flute entries also record the
// instrument they were saved from, so they play back as fingerings.
function playlistEntryFor(chord, favId) {
  const common = {
    id: favId, chordId: chord.id, rootName: chord.rootName,
    typeName: chord.type.name, category: chord.type.category,
    notes: chord.notes, noteCount: chord.noteCount,
  };
  // In a playlist, an ocarina entry's card adds to playlists for its own instrument.
  const inst = state.view === 'instrument' ? currentInstrument()
    : state.view === 'playlist' && state.pickerInstrumentId ? getInstrument(state.pickerInstrumentId) : null;
  if (inst) {
    return { ...common, layoutId: ocLayoutId(inst), layoutData: null, scaleName: inst.name, family: inst.family, instrumentId: entryInstId(inst) };
  }
  const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
  return {
    ...common, layoutId,
    layoutData: state.layout.isCustom ? JSON.parse(JSON.stringify(state.layout)) : null,
    scaleName: state.layout.name,
  };
}

// Playlist-entry id for a chord. The canonical (default) voicing keeps the
// plain `${layoutId}-${chordId}` form used before per-voicing bookmarks existed,
// so existing playlists never need migrating. Only a chord swapped to a
// non-default voicing gets a notes-suffixed id, which can't collide with any
// id saved before this feature existed.
function favIdForChord(layoutId, chord, canonicalChords) {
  const canonical = canonicalChords.find(c => c.id === chord.id);
  const isCustomVoicing = !canonical || canonical.notes.join(',') !== chord.notes.join(',');
  return isCustomVoicing
    ? `${layoutId}-${chord.id}-${chord.notes.join(',')}`
    : `${layoutId}-${chord.id}`;
}

// Swap one note of a chord for an alternate same-pitch-class position elsewhere
// on the pan. Returns a new chord object — never mutates state.chords entries.
function swapChordNoteVoicing(chord, targetNote) {
  const targetPC = notePC(targetNote);
  const newNotes = chord.notes.map(n => notePC(n) === targetPC ? targetNote : n);
  return { ...chord, notes: newNotes };
}

let _autoplayTimer = null;
// Autoplay running: the next chord after the new number of seconds.
function retimeAutoplay() {
  if (state.autoplayOn && _autoplayTimer) {
    clearInterval(_autoplayTimer);
    _autoplayTimer = setInterval(advanceAutoplay, state.autoplaySeconds * 1000);
  }
}

function stopAutoplay() {
  if (_autoplayTimer) { clearInterval(_autoplayTimer); _autoplayTimer = null; }
  state.autoplayOn = false;
  state.autoplayPlaylistId = null;
}

function playSelectedChordSound() {
  if (!state.selectedChord) return;
  initAudio();
  playChord(state.selectedChord.notes,
    note => updatePanPlaying([note]),
    notes => updatePanPlaying(notes)
  );
}

// Advance to the next chord in the autoplaying playlist, wrapping around.
// Bails out (and stops the timer) if autoplay was turned off or the playlist vanished.
function advanceAutoplay() {
  const pl = state.playlists.find(p => p.id === state.autoplayPlaylistId);
  if (!state.autoplayOn || state.view !== 'chords' || !pl || pl.chords.length === 0) {
    stopAutoplay();
    render();
    return;
  }
  const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
  const curFavId = state.selectedChord ? favIdForChord(layoutId, state.selectedChord, state.chords) : null;
  const curIdx = pl.chords.findIndex(c => c.id === curFavId);
  // Skip ocarina / flute entries: they play in that instrument's practice mode.
  let nextIdx = (curIdx + 1) % pl.chords.length;
  for (let n = 0; n < pl.chords.length && pl.chords[nextIdx].instrumentId; n++) nextIdx = (nextIdx + 1) % pl.chords.length;
  if (!loadPlaylistChordAt(pl, nextIdx)) { stopAutoplay(); render(); return; }
  navReplace(stateToHash());
  render();
  playSelectedChordSound();
}

function startAutoplay(pl) {
  if (pl.chords.length === 0) { showToast('No chords in playlist yet'); return; }
  stopAutoplay();
  state.autoplayOn = true;
  state.autoplayPlaylistId = pl.id;
  const layoutId = state.layout?.isCustom ? (state.layout.savedId || state.layout.id) : state.layout?.id;
  const curFavId = state.selectedChord && state.layout ? favIdForChord(layoutId, state.selectedChord, state.chords) : null;
  let startIdx = Math.max(0, pl.chords.findIndex(c => c.id === curFavId));
  for (let n = 0; n < pl.chords.length && pl.chords[startIdx].instrumentId; n++) startIdx = (startIdx + 1) % pl.chords.length;
  if (!loadPlaylistChordAt(pl, startIdx)) { stopAutoplay(); return; }
  navReplace(stateToHash());
  render();
  playSelectedChordSound();
  _autoplayTimer = setInterval(advanceAutoplay, state.autoplaySeconds * 1000);
}

// ── Click: Playlist picker ────────────────────────────────────────────────
registerActions({
  'show-playlist-picker': (el, e, action) => {
    e.stopPropagation();
    const chordId = el.dataset.chordId;
    const favId = el.dataset.chordFavId;
    // Panel heart (matches the selected chord) preserves any voicing swap;
    // row hearts always use the canonical chord for that row.
    const chord = (state.selectedChord && state.selectedChord.id === chordId)
      ? state.selectedChord
      : state.chords.find(c => c.id === chordId);
    if (!chord) return;
    state.pickerChordFavId = favId;
    state.pickerChordObj = chord;
    state.pickerNewPlaylist = false;
    render();
    return;
  },
  'update-playlist-entry': (el, e, action) => {
    if (!state.selectedChord || !state.sourcePlaylistId || !state.sourceEntryId) return;
    const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
    const newId = favIdForChord(layoutId, state.selectedChord, state.chords);
    const ok = updatePlaylistChordVoicing(state.sourcePlaylistId, state.sourceEntryId, {
      id: newId, notes: state.selectedChord.notes, noteCount: state.selectedChord.notes.length,
    });
    if (!ok) { showToast('That playlist entry no longer exists'); return; }
    state.sourceEntryId = newId;
    state.playlists = getPlaylists();
    state.favorites = getFavorites();
    scheduleSave();
    showToast('Saved to playlist');
    render();
    return;
  },
  'close-playlist-picker': (el, e, action) => {
    state.pickerChordFavId = null;
    state.pickerChordObj = null;
    state.pickerNewPlaylist = false;
    state.pickerNewProgression = false;
    render();
    return;
  },
  'toggle-playlist-chord': (el, e, action) => {
    const playlistId = el.dataset.playlistId;
    const favId = state.pickerChordFavId;
    const chord = state.pickerChordObj;
    if (!chord || !favId) return;
    const pl = state.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    if (pl.chords.some(c => c.id === favId)) {
      removeChordFromPlaylist(playlistId, favId);
    } else {
      addChordToPlaylist(playlistId, playlistEntryFor(chord, favId));
    }
    state.playlists = getPlaylists();
    state.favorites = getFavorites();
    scheduleSave();
    render();
    return;
  },
  'show-new-playlist-input': (el, e, action) => {
    state.pickerNewPlaylist = true;
    render();
    setTimeout(() => document.getElementById('new-playlist-input')?.focus(), 0);
    return;
  },
  'confirm-new-playlist': (el, e, action) => {
    const input = document.getElementById('new-playlist-input');
    const name = (input?.value || '').trim();
    if (!name) return;
    const newId = addPlaylist(name);
    if (state.pickerChordObj && state.pickerChordFavId) {
      addChordToPlaylist(newId, playlistEntryFor(state.pickerChordObj, state.pickerChordFavId));
    }
    state.playlists = getPlaylists();
    state.pickerChordFavId = null;
    state.pickerChordObj = null;
    state.pickerNewPlaylist = false;
    scheduleSave();
    showToast('Playlist created');
    render();
    return;
  },
});

// ── Click: Playlist view ──────────────────────────────────────────────────
registerActions({
  'open-playlist-chords': (el, e, action) => {
    const pl = state.playlists.find(p => p.id === el.dataset.id);
    if (!pl) return;
    if (pl.chords.length === 0) { showToast('No chords in playlist yet'); return; }
    if (pl.chords[0].instrumentId) {
      if (openPlaylistEntryOnInstrument(pl, pl.chords[0])) render();
      return;
    }
    if (!loadPlaylistChordAt(pl, 0)) { showToast('Scale not found'); return; }
    state.chordFilter = { category: 'All', root: 'All', playlist: pl.id };
    state.view = 'chords';
    navPush(stateToHash());
    render();
    return;
  },
});

// ── Click: Playlists tab and playlist detail ──────────────────────────────
registerActions({
  'hp-play-playlist': (el, e, action) => {
    const pl = state.playlists.find(p => p.id === el.dataset.id);
    if (pl) hpPlayPlaylist(pl);
    return;
  },
  'pl-practice': (el, e, action) => {
    const inst = currentInstrument();
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    if (!inst || !pl) return;
    state.view = 'instrument';
    state.oc.tab = 'playlists';
    state.oc.playlistId = pl.id;
    state.oc.practice = { playlistId: pl.id, idx: 0 };
    navPush(`#i/${inst.id}/playlists`);
    playPracticeStep();
    render();
    return;
  },
  'pl-go-chords': (el, e, action) => {
    if (state.layout) {
      state.chords = findAllChords(state.layout);
      state.selectedChord = null;
      state.chordFilter = { category: 'All', root: 'All', playlist: 'All' };
      state.view = 'chords';
      navPush(stateToHash());
    } else if (state.currentInstrumentId) {
      state.view = 'instrument';
      state.oc.tab = 'chords';
      navPush(instUrl(state.currentInstrumentId, 'chords'));
    }
    render();
    return;
  },
  'pl-mode': (el, e, action) => { state.plMode = el.dataset.value; render(); return; },
  'pl-row-menu': (el, e, action) => { e.stopPropagation(); state.plRowMenu = parseInt(el.dataset.idx, 10); render(); return; },
  'pl-row-close': (el, e, action) => { state.plRowMenu = null; render(); return; },
  'pl-new-open, pl-rename-open': (el, e, action) => {
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    state.plName = action === 'pl-new-open' ? { mode: 'new', value: '' } : { mode: 'rename', id: pl?.id, value: pl?.name ?? '' };
    render();
    setTimeout(() => document.getElementById('pl-name-input')?.focus(), 0);
    return;
  },
  'pl-name-cancel': (el, e, action) => { state.plName = null; render(); return; },
  'pl-name-save': (el, e, action) => {
    const n = state.plName;
    if (!n) return;
    const name = (document.getElementById('pl-name-input')?.value ?? n.value).trim();
    if (!name) { n.error = true; render(); document.getElementById('pl-name-input')?.focus(); return; }
    if (n.mode === 'prog-new' || n.mode === 'prog-rename') {
      const id = n.mode === 'prog-new' ? addProgression(name) : n.id;
      if (n.mode === 'prog-rename') renameProgression(id, name);
      state.progressions = getProgressions();
      state.plName = null;
      if (n.mode === 'prog-new') showToast('Playlist created', { action: { label: 'Open', run: () => openProgression(id) } });
      render();
      return;
    }
    if (n.mode === 'new') addPlaylist(name);
    else renamePlaylist(n.id, name);
    state.playlists = getPlaylists();
    state.plName = null;
    scheduleSave();
    if (n.mode === 'new') showToast('Playlist created');
    render();
    return;
  },
});

// ── Change: Playlists ─────────────────────────────────────────────────────
registerActions({
  'select-playlist-filter': (el, e, action) => {
    if (el.value === '__edit__') {
      stopAutoplay();
      state.activePlaylistId = state.chordFilter.playlist;
      state.view = 'playlist';
      navPush(`#pl/${encodeURIComponent(state.activePlaylistId)}`);
    } else {
      if (state.autoplayOn && el.value !== state.autoplayPlaylistId) stopAutoplay();
      state.chordFilter.playlist = el.value;
    }
    render();
  },
}, CHANGE_ACTIONS);
