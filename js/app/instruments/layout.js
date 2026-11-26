// Handpan, tongue drum and kalimba: the Chords tab and its helpers.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { NOTE_NAMES, displayNote, getAllNotes, getNoteName, notePC, noteToMidi } from '../../data.js';
import { icon } from '../../icons.js';
import { getRelatedChords, identifyChord, mainChordsInKey } from '../../chords.js';
import { LISTEN_DEFAULTS, listenTracker } from '../../listen-detect.js';
import { layoutFamilyInfo, layoutInstrument } from '../../layoutfamilies.js';
import { handpanInstrumentId, midiToNoteName } from '../../instruments.js';
import { initAudio, playChord, playNote, playScale, playSequence } from '../../audio.js';
import { renderPan, updatePanPlaying } from '../../pan.js';
import { getSavedLayouts, isChordBookmarkedAnyVoicing, saveLayout } from '../../storage.js';
import { scheduleSave } from '../../auth.js';

// Id that playlist entries of the handpan on screen carry, or null.
function hpCurrentLayoutId() {
  const l = state.layout;
  return l ? (l.isCustom ? (l.savedId || l.id) : l.id) : null;
}

function viewHandpanPlaylists() {
  return `${instrumentAppBar(null, 'playlists')}${playlistsTabHtml(null)}`;
}
function viewHandpanSongs() {
  return `${instrumentAppBar(null, 'songs')}${songsTabHtml(null)}`;
}

// ── View 3: Chord Explorer ───────────────────────────────────────────────────
// Handpan Chords tab (§6.7). Phone: the pan and the selected-chord bar stay
// on screen (sticky) while the list scrolls under them. ≥600px: the list is
// a column of its own at the left, the pan and a full chord card at the right.

// The chords shown under the current filters, in display order: the
// playlist's order while a playlist filter is on, otherwise by root, then
// the bigger chords first.
function hpFilteredChords() {
  const { chords, chordFilter, layout } = state;
  // Root options: NOTE_NAMES[i] is at PC i — filter by which PCs have chords.
  const ROOT_ORDER = NOTE_NAMES;
  const roots = chordRootsOf(chords);

  // Apply filters — compare root by PC to handle G# ↔ Ab equivalence.
  const layoutId = layout.isCustom ? (layout.savedId || layout.id) : layout.id;
  const filtered = chords.filter(c => {
    if (state.chordCountSet.size > 0 && !state.chordCountSet.has(chordCountKey(c.noteCount))) return false;
    if (chordFilter.category !== 'All' && c.type.category !== chordFilter.category) return false;
    if (chordFilter.root !== 'All') {
      const filterPC = ROOT_ORDER.indexOf(chordFilter.root);
      if (notePC(c.rootNote) !== filterPC) return false;
    }
    return true;
  });
  filtered.sort((a, b) => {
    const rA = notePC(a.rootNote), rB = notePC(b.rootNote);
    return rA !== rB ? rA - rB : b.noteCount - a.noteCount;
  });
  const narrowed = chordFilter.category !== 'All' || chordFilter.root !== 'All' || state.chordCountSet.size > 0;
  const main = chordsMainOn(filtered, narrowed) && !!layout.top.ding;
  const all = filtered.length;
  return { filtered: main ? mainChordsInKey(filtered, notePC(layout.top.ding), layoutPitchClasses(layout)) : filtered, roots, layoutId, main, all };
}

// The playlist entry the selected chord was opened from, and whether its
// voicing has since changed (then "Save this voicing" is offered).
function hpSourceEntry() {
  const chord = state.selectedChord;
  const pl = state.sourcePlaylistId ? state.playlists.find(p => p.id === state.sourcePlaylistId) : null;
  const entry = pl ? pl.chords.find(c => c.id === state.sourceEntryId) : null;
  const canUpdate = !!(chord && entry && entry.chordId === chord.id && entry.notes.join(',') !== chord.notes.join(','));
  return { pl, canUpdate };
}

// Filters set in the Filters sheet (the root chips don't count).
function hpFilterCount() {
  const f = state.chordFilter;
  return (state.chordCountSet.size > 0 ? 1 : 0) + (f.category !== 'All' ? 1 : 0) + (f.root !== 'All' ? 1 : 0);
}

function hpChordName(c) {
  return `${displayNote(c.rootName, state.useFlats, state.useSolfege)} ${c.type.name}`;
}
function hpNotesText(notes) {
  return notes.map(n => displayNote(n, state.useFlats, state.useSolfege)).join(' · ');
}

// Add to a playlist: opens the Add to playlist sheet. A
// bookmark, filled when the chord is in one; not a heart, it is no one-tap
// favourite.
function chordSaveBtn(on, opts) {
  return uiIconBtn('bookmark', on ? 'In a playlist. Add to another' : 'Add to a playlist', { ...opts, cls: `chord-save${on ? ' is-on' : ''}` });
}

// "Same type, other roots" and "Shares 2+ notes" chips for a chord.
function hpRelatedHtml(chord) {
  const { sameType, sharedNotes } = getRelatedChords(chord, state.chords);
  const chip = c => `<button type="button" class="chip" data-action="select-chord" data-id="${escHtml(c.id)}">${escHtml(hpChordName(c))}</button>`;
  return `
    ${sameType.length ? `<div class="overline">Same type, other roots</div><div class="chips">${sameType.map(chip).join('')}</div>` : ''}
    ${sharedNotes.length ? `<div class="overline">Shares 2+ notes</div><div class="chips">${sharedNotes.slice(0, 10).map(chip).join('')}</div>` : ''}`;
}

function viewChords() {
  const { filtered, roots, layoutId, main, all } = hpFilteredChords();
  // A chord is always shown, as on every instrument: the first one until
  // another is picked.
  if (!state.selectedChord && !state.discoverMode && !state.hpListen && filtered.length) state.selectedChord = filtered[0];
  const { chords, chordFilter, selectedChord, layout } = state;
  const uf = state.useFlats;
  const us = state.useSolfege;

  const selectedFavId = selectedChord ? favIdForChord(layoutId, selectedChord, chords) : null;
  const selectedInAny = selectedChord ? isChordBookmarkedAnyVoicing(layoutId, selectedChord.id) : false;
  // Show a "save voicing" button only when the selected chord came from a
  // playlist entry (same abstract chord) and its notes have since diverged.
  const { pl: sourcePl, canUpdate: canUpdateEntry } = hpSourceEntry();
  const saveVoicingBtn = cls => uiIconBtn('save', `Save this voicing to ${sourcePl.name}`, { action: 'update-playlist-entry', cls });

  const discoverMatches = state.discoverMode ? identifyChord(state.discoverNotes) : [];
  // Listen: the chord heard, lit on the pan (docs/listen-mode.md).
  const heard = state.hpListen ? listenHeardOn(getAllNotes(layout).map(noteToMidi)) : null;

  // Discover mode's clicked notes get the same treatment as a selected chord's
  // notes: exact matches highlighted, other same-pitch-class positions dimmed.
  const panName = m => getAllNotes(layout).find(n => noteToMidi(n) === m);
  // The root first, so it gets the root's colour on the pan.
  const activeNotes = heard ? (heard.fit ? [...heard.fit.voicing].sort((a, b) => ((a - heard.chord.rootPC) % 12 === 0 ? 0 : 1) - ((b - heard.chord.rootPC) % 12 === 0 ? 0 : 1)).map(panName) : [])
    : state.discoverMode ? state.discoverNotes : (selectedChord ? selectedChord.notes : null);
  const highlightNotes = activeNotes || [];
  const chordPCs = activeNotes ? new Set(activeNotes.map(n => notePC(n))) : new Set();
  const altHighlightNotes = activeNotes
    ? getAllNotes(layout).filter(n => chordPCs.has(notePC(n)) && !activeNotes.includes(n))
    : [];
  const panSvg = renderPan(layout, { shellMode: 'both', highlightNotes, altHighlightNotes, rotated: state.ringRotated, useFlats: uf, useSolfege: us });

  // The selected chord: a bar on phones (More opens a sheet), a full card
  // with every action and the related chords from 600px.
  const card = state.hpListen ? listenCardHtml(heard) : state.discoverMode ? '' : selectedChord ? chordCardHtml({
    title: escHtml(hpChordName(selectedChord)),
    metas: [[escHtml(hpNotesText(selectedChord.notes))], [`${escHtml(selectedChord.type.category)} · ${chordNotesWord(selectedChord.noteCount)}`, 'hp-wide']],
    actions: `
          ${canUpdateEntry ? saveVoicingBtn('hp-wide') : ''}
          <button type="button" class="btn btn-primary hp-play" data-action="play-chord">${icon('play')} Chord</button>
          ${speedBtnHtml()}
          <button type="button" class="btn btn-secondary hp-wide" data-action="play-scale">${icon('play')} Scale</button>
          ${chordSaveBtn(selectedInAny, { action: 'show-playlist-picker', data: { 'chord-id': selectedChord.id, 'chord-fav-id': selectedFavId } })}
          ${uiIconBtn('ellipsis', 'More: the scale, progressions', { action: 'hp-more-open', attrs: 'aria-haspopup="dialog"' })}`,
    below: `${goesWithLineHtml()}<div class="hp-related hp-wide">${hpRelatedHtml(selectedChord)}</div>`,
  }) : `
    <div class="hp-card is-empty">
      <span class="hp-card-hint">Tap a chord to see it on the ${layoutFamilyInfo(layoutInstrument(state.layout)).word}</span>
      <button type="button" class="btn btn-secondary" data-action="play-scale">${icon('play')} Scale</button>
    </div>`;


  const nFilters = hpFilterCount();
  const browseHead = `
    ${chordListLineHtml({ shown: filtered.length, all, main, open: 'hp-filters-open', count: nFilters })}`;

  const rows = filtered.length === 0
    ? uiEmpty({
      icon: 'sliders-horizontal', title: 'No chords match these filters',
      action: '<button type="button" class="btn btn-secondary" data-action="hp-filters-clear" data-all="1">Clear filters</button>',
    })
    : `<div class="list chord-rows">${filtered.map(c => {
      return chordRowHtml({
        title: hpChordName(c), meta: `${escHtml(c.type.category)} · ${chordNotesWord(c.noteCount)}`,
        action: 'select-chord', data: { id: c.id }, current: selectedChord?.id === c.id,
        saved: isChordBookmarkedAnyVoicing(layoutId, c.id),
      });
    }).join('')}</div>`;

  // Identify: notes tapped on the pan, and the chords they make.
  const dn = state.discoverNotes;
  let matches = '';
  if (dn.length < 2) {
    matches = `<p class="hp-hint">Select 2 or more notes to identify a chord.</p>`;
  } else if (discoverMatches.length === 0) {
    matches = `<div class="list">${uiRow({
      title: 'Custom combination',
      meta: `Not a recognized chord type · ${dn.length} notes: ${escHtml(dn.map(n => displayNote(n, uf, us)).join(', '))}`,
      trail: `${chordSaveBtn(false, { action: 'discover-bookmark-custom' })}${uiIconBtn('play', 'Play chord', { action: 'discover-play-custom' })}`,
    })}</div>`;
  } else {
    matches = `<div class="list">${discoverMatches.map((m, idx) => uiRow({
      title: hpChordName(m),
      meta: `${escHtml(m.type.category)} · ${m.noteCount} notes: ${escHtml(m.notes.map(n => displayNote(n, uf, us)).join(', '))}`,
      trail: `${chordSaveBtn(isChordBookmarkedAnyVoicing(layoutId, m.id), { action: 'discover-bookmark', data: { 'match-idx': idx } })}${uiIconBtn('play', 'Play chord', { action: 'discover-play', data: { 'match-idx': idx } })}`,
    })).join('')}</div>`;
  }
  const identify = `
    <div class="hp-identify">
      <p class="hp-hint">Tap notes on the ${layoutFamilyInfo(layoutInstrument(state.layout)).word} to build a chord. Tap again to remove one.</p>
      ${dn.length ? `
        <div class="hp-identify-notes">
          <div class="chips">${dn.map(n => `<span class="chip is-selected hp-note-chip">${escHtml(displayNote(n, uf, us))}</span>`).join('')}</div>
          <button type="button" class="btn btn-secondary btn-sm" data-action="discover-clear">Clear</button>
        </div>` : ''}
      ${matches}
    </div>`;

  return `
    ${instrumentAppBar(null, 'chords')}${chordsScreenHtml({
    cls: state.discoverMode ? ' is-identify' : '',
    picture: `<div class="pan-wrap hp-pan">${panRotateBtn()}${panSvg}</div>`,
    card,
    listHead: `${chordModeSegHtml(state.hpListen ? 'listen' : state.discoverMode ? 'identify' : 'browse', 'toggle-discover-mode')}
          ${state.discoverMode || state.hpListen ? '' : browseHead}`,
    list: state.hpListen ? listenHistoryHtml() : state.discoverMode ? identify : rows,
  })}`;
}

// A handpan's Filters: the shared sheet.
function hpFiltersSheet() {
  const f = state.chordFilter;
  return chordFiltersSheet({
    help: uiHelp('chords', 'filters'), key: 'hp-filters', close: 'hp-filters-close', clear: 'hp-filters-clear',
    roots: chordRootsOf(state.chords), root: f.root, rootAction: 'filter-root',
    counts: state.chordCountSet, countAction: 'toggle-note-count', category: f.category, categoryAction: 'filter-category',
  });
}

// A handpan chord's ⋯: the shared sheet, with the scale, the link and the
// related chords.
function hpMoreSheet() {
  const chord = state.selectedChord;
  const { pl, canUpdate } = hpSourceEntry();
  return chordMoreSheet({
    help: uiHelp('chords', 'more'), key: 'hp-more', variant: 'hpmore', title: hpChordName(chord), close: 'hp-more-close',
    rows: [
      uiRow({ lead: 'play', title: 'Play the scale', meta: 'Every note, from the lowest up', action: 'play-scale' }),
      canUpdate ? uiRow({ lead: 'save', title: `Save this voicing to "${pl.name}"`, action: 'update-playlist-entry' }) : '',
      uiRow({ lead: 'link', title: 'Copy link to this chord', action: 'copy-url' }),
    ],
    extra: `<div class="hp-related">${hpRelatedHtml(chord)}</div>`,
  });
}

// Rotate button overlaid on the pan drawing (Chords and Pan).
function panRotateBtn() {
  // Tongue drums and kalimbas are drawn the way makers lay them out: no rotation.
  if (layoutInstrument(state.layout) !== 'handpan') return '';
  return uiIconBtn('rotate', 'Rotate the ring so the two lowest notes face you', {
    action: 'toggle-rotation', pressed: state.ringRotated, cls: 'tonal pan-rotate',
  });
}

// ── Click: Saved layouts ──────────────────────────────────────────────────
registerActions({
  'save-layout': (el, e, action) => {
    if (state.layout.isCustom && !state.layout.savedId) {
      state.layout.savedId = 'c-' + Date.now();
    }
    const id = state.layout.isCustom ? state.layout.savedId : state.layout.id;
    const total = 1 + state.layout.top.slots.filter(s => s.note).length
                    + state.layout.bottom.slots.filter(s => s.note).length;
    saveLayout({
      id,
      name: state.layout.name,
      noteCount: total,
      layout: JSON.parse(JSON.stringify(state.layout)),
      savedAt: Date.now(),
    });
    state.savedLayouts = getSavedLayouts();
    scheduleSave();
    refreshInstruments();
    state.currentInstrumentId = handpanInstrumentId(id);
    showToast('Saved to My instruments');
    render();
    return;
  },
});

// ── Click: Pan rotation ───────────────────────────────────────────────────
registerActions({
  'chords-scope': (el, e, action) => { state.chordsAll = !state.chordsAll; savePrefs(); render(); return; },
  'toggle-rotation': (el, e, action) => {
    state.ringRotated = !state.ringRotated;
    savePrefs();
    render();
    return;
  },
});

// ── Click: Chord explorer ─────────────────────────────────────────────────
registerActions({
  'hp-filters-open': (el, e, action) => { state.hpFilters = true; render(); return; },
  'hp-filters-close': (el, e, action) => { state.hpFilters = false; render(); return; },
  'hp-more-open': (el, e, action) => { state.hpMore = true; render(); return; },
  'hp-more-close': (el, e, action) => { state.hpMore = false; render(); return; },
  'hp-filters-clear': (el, e, action) => {
    // The sheet's filters; the empty list's "Clear filters" also clears the root.
    state.chordCountSet.clear();
    state.chordFilter.category = 'All';
    if (el.dataset.all) state.chordFilter.root = 'All';
    render();
    return;
  },
  'toggle-note-count': (el, e, action) => {
    const count = el.dataset.count;
    if (state.chordCountSet.has(count)) state.chordCountSet.delete(count);
    else state.chordCountSet.add(count);
    render();
    return;
  },
  'filter-root': (el, e, action) => {
    state.chordFilter.root = el.dataset.root;
    render();
    return;
  },
  'select-chord': (el, e, action) => {
    const chord = state.chords.find(c => c.id === el.dataset.id);
    if (!chord) return;

    // If the chord list is filtered to a playlist, clicking a row is the
    // same as opening that entry — show its saved voicing (it may differ
    // from canonical) and track it so a swap can be saved back.
    const pl = state.chordFilter.playlist !== 'All' ? state.playlists.find(p => p.id === state.chordFilter.playlist) : null;
    const entry = pl ? pl.chords.find(c => c.chordId === chord.id) : null;
    if (pl && entry) {
      state.selectedChord = Array.isArray(entry.notes) ? { ...chord, notes: entry.notes } : chord;
      state.sourcePlaylistId = pl.id;
      state.sourceEntryId = entry.id;
    } else {
      state.selectedChord = chord;
      state.sourcePlaylistId = null;
      state.sourceEntryId = null;
    }

    navReplace(stateToHash());
    // Preserve chord list scroll position across render
    const chordList = document.querySelector('.chord-list');
    const savedScroll = chordList?.scrollTop ?? 0;
    render();
    const newChordList = document.querySelector('.chord-list');
    if (newChordList) newChordList.scrollTop = savedScroll;
    // Arpeggiate then play together; show playing animation at the "together" moment
    initAudio();
    playChord(state.selectedChord.notes,
      note => updatePanPlaying([note]),
      notes => updatePanPlaying(notes)
    );
    return;
  },
  'play-chord': (el, e, action) => {
    if (!state.selectedChord) return;
    initAudio();
    playChord(state.selectedChord.notes,
      note => updatePanPlaying([note]),
      notes => updatePanPlaying(notes)
    );
    return;
  },
  'play-scale': (el, e, action) => {
    const allNotes = getAllNotes(state.layout);
    initAudio();
    playScale(allNotes, note => updatePanPlaying([note]));
    return;
  },
});

// ── Click: Discover mode ──────────────────────────────────────────────────
registerActions({
  'hear-start': (el, e, action) => { listenStart(); return; },
  'hear-stop': (el, e, action) => { listenStop(); return; },
  'hear-clear': (el, e, action) => { Object.assign(listenUi(), { history: [], stopped: '' }); render(); return; },
  'toggle-discover-mode': (el, e, action) => {
    // From the Browse | Identify | Listen segment: only a change of mode toggles.
    const want = el.dataset.value ?? (state.discoverMode ? 'browse' : 'identify');
    const now = state.hpListen ? 'listen' : state.discoverMode ? 'identify' : 'browse';
    if (want === now) return;
    state.hpListen = want === 'listen';
    state.discoverMode = want === 'identify';
    state.discoverNotes = [];
    state.selectedChord = null;
    state.sourcePlaylistId = null;
    state.sourceEntryId = null;
    render();
    return;
  },
  'discover-clear': (el, e, action) => {
    state.discoverNotes = [];
    render();
    return;
  },
  'discover-bookmark': (el, e, action) => {
    const idx = parseInt(el.dataset.matchIdx, 10);
    const chord = identifyChord(state.discoverNotes)[idx];
    if (!chord) return;
    const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
    state.pickerChordFavId = favIdForChord(layoutId, chord, state.chords);
    state.pickerChordObj = chord;
    state.pickerNewPlaylist = false;
    render();
    return;
  },
  'discover-bookmark-custom': (el, e, action) => {
    if (state.discoverNotes.length < 2) return;
    const notes = [...state.discoverNotes];
    // A shared, note-less id — the favId suffix (added below since no
    // canonical "custom" chord type exists) is what disambiguates combos.
    const chord = {
      id: 'custom', rootName: getNoteName(notes[0]),
      type: { name: 'Custom', category: 'Custom' }, notes, noteCount: notes.length,
    };
    const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
    state.pickerChordFavId = favIdForChord(layoutId, chord, state.chords);
    state.pickerChordObj = chord;
    state.pickerNewPlaylist = false;
    render();
    return;
  },
  'discover-play': (el, e, action) => {
    const idx = parseInt(el.dataset.matchIdx, 10);
    const chord = identifyChord(state.discoverNotes)[idx];
    if (!chord) return;
    initAudio();
    playChord(chord.notes, note => updatePanPlaying([note]), notes => updatePanPlaying(notes));
    return;
  },
  'discover-play-custom': (el, e, action) => {
    if (state.discoverNotes.length < 2) return;
    initAudio();
    playChord(state.discoverNotes, note => updatePanPlaying([note]), notes => updatePanPlaying(notes));
    return;
  },
  'copy-url': (el, e, action) => {
    const url = location.origin + navUrl(currentPath());
    navigator.clipboard.writeText(url).then(() => showToast('URL copied!'), () => showToast('Copy the link from the address bar'));
    return;
  },
});

// ── Change: Chord explorer ────────────────────────────────────────────────
registerActions({
  'filter-category': (el, e, action) => { state.chordFilter.category = el.value; render(); },
}, CHANGE_ACTIONS);
