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


// New playlist / Rename playlist: one name field.
function plNameSheet() {
  const n = state.plName;
  const isNew = n.mode === 'prog-new';
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
    : null;
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

function playSelectedChordSound() {
  if (!state.selectedChord) return;
  initAudio();
  playChord(state.selectedChord.notes,
    note => updatePanPlaying([note]),
    notes => updatePanPlaying(notes)
  );
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
    render();
    return;
  },
  'close-playlist-picker': (el, e, action) => {
    state.pickerChordFavId = null;
    state.pickerChordObj = null;
    state.pickerNewProgression = false;
    render();
    return;
  },
});


// ── Click: Playlists tab and playlist detail ──────────────────────────────
registerActions({
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
    state.plName = null;
    render();
    return;
  },
});

