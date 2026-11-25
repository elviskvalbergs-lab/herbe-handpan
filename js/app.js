import { brandLogo } from './brand.js';
import {
  SCALES, CHORD_TYPES, CHORD_CATEGORIES, createLayoutFromScale,
  getAllNotes, NOTE_NAMES, notePC, getNoteName, noteToMidi, displayNote, preferFlats,
} from './data.js';
import {
  getSavedLayouts, saveLayout, deleteLayout,
  getFavorites, isFavorite,
  getPlaylists, addPlaylist, renamePlaylist, deletePlaylist,
  addChordToPlaylist, removeChordFromPlaylist, reorderChordInPlaylist,
  isChordBookmarkedAnyVoicing, updatePlaylistChordVoicing, mergePlaylistsIntoProgressions,
  PROG_DEFAULTS, PROG_LIMITS, newProgressionStep, progressionStepMs, progressionTotals,
  nextProgressionStep, getProgressions, getProgressionsRaw, writeProgressionsRaw,
  addProgression, renameProgression, deleteProgression, setProgressionTiming, addStepToProgression,
  duplicateProgressionStep, moveProgressionStep, removeProgressionStep, setProgressionStepBars,
  progressionStepBeats, progressionLevel, setProgressionLevel, fillProgression,
} from './storage.js';
import {
  parseChordSheet, matchSheetChord, rankTranspositions, sheetCoverage, coverageBand, transposeChordSymbol,
  stepLength, stackVoicing, strikePattern, strikeNumbers, PLAY_LEVELS, WIND_PLAY_LEVELS, windPlayLevel, windPattern,
} from './chordsheet.js';
import { findAllChords, getRelatedChords, identifyChord, mainChordsInKey } from './chords.js';
import { instrumentKey, goesWellWith } from './harmony.js';
import { songFit, songsInOrder, songLoopTap, songInLoop, songNextIndex, songWaitTarget, songWaitHeard, songCoverage, SONGS, SONG_ORIGINS, SONG_LICENCE, songNotes, playableSongs, songKeyOn, songsThatGoTogether, christmasSongs, christmasSeason, songsForFilter, SONG_COLLECTION_ORIGINS, songBars, songHands, songTimeLabel, songLyrics } from './songs.js';
import { icon } from './icons.js';
import { initAudio, playNote, playChord, playScale, playSequence, playClick, setPlaybackTempo, ensureAudioOutput, setVoice, onFirstSound } from './audio.js';
import { kalimbaNumbers } from './kalimbas.js';
import { renderPan, panPlaces, PAN_SVG_ID, updatePanHighlight, updatePanShellMode, updatePanPlaying, settlePanPlace } from './pan.js';
import { noteWindows, chambersNeeded, scaleToMidis } from './ocarina.js';
import {
  renderFingering, renderHandLegend, fingeringMoves, playableMidis, fingeringFor,
  ocarinaToLayout, arpeggioOrder, fitChordToInstrument, nextVoicing,
} from './ocarina-ui.js';
import { playablePairs, centsBetween, midiToHz, hzToMidi, pitchLabel, parsePitch, predictFingeringHz } from './ocarina.js';
import { startTuner, yinPitch, openMic, drawMicWave, recordMic, micTakes, clearMicTakes, micRecordingSupported } from './tuner.js';
import {
  listenTracker, listenOverallConfidence, listenChordOnNotes, LISTEN_DEFAULTS,
} from './listen-detect.js';
import { startListening } from './listen-audio.js';
import { rankScalesByNotes, addHeardNote, heardNoteName } from './scalefinder.js';
import { setupRoots, setupScalesFor, setupTopScales, setupFirstChord, setupHeardEnough, setupKeyNote, chartSetupTunings, preferCommonChart, tuningOffsetCents, noteOnTuning, a4ForOffset, collectHeardNote, setupMatch, scaleFits } from './setup.js';
import {
  STAGE_ORDER, STAGE_TITLES, buildShrink, chamberBuild, stageTargets, noteAdvice,
  leatherHolePlan, bodyPlan, nextStage, finishBuild, updateClayBody,
  defaultCustomHoles, calibrateChamber, withHoleCount, holeSpot, usesHoleMap, withFixedFingerings, reverseHandFingers, holeDisplayOrder, holeLabel, cropRect, duplicateFingers, withSubLayout, SUB_LAYOUTS, fluteHoles, fluteStepStates, fluteChamberFromReadings,
} from './builder.js';
import { buildScaleChambers, OC_FINGER_ORDER, applyHoleSizes } from './ocarina.js';
import { chartsForFamily, getChart, instrumentFromChart, chartDefaultKey, chartKeyFor, detectChartKey, detectLowestKey, CHART_ROOTS } from './charts.js';
import { parseLink, linkFor, linkSlug, linkTitle, linkPreview, APP_NAME, layoutFromCustomParams, panPosToParam } from './links.js';
import { TONGUE_DRUMS, isTongueDrumId } from './tonguedrums.js';
import { LAYOUT_FAMILIES, findTuning, layoutInstrument, isLayoutFamily, layoutFamilyInfo, safeLayout } from './layoutfamilies.js';
import {
  INSTRUMENT_FAMILIES, isTubeFamily, windWord, getInstruments, getInstrument, saveInstrument, deleteInstrument,
  touchInstrument, syncHandpanInstruments, isOnboarded, setOnboarded, handpanInstrumentId, usesLayout,
  createScaleOcarina, createCustomOcarina, createCustomFlute, instrumentStatus, midiToNoteName,
  getClayBodies, saveClayBodies, getInstrumentsRaw, writeInstrumentsRaw,
  newPublicId, copySharedInstrument,
} from './instruments.js';
import { dataStore, DATA_KEYS, hasAccountOnDevice, carryOverVisit, clearAccountData, visitHasWork, safeSetItem, accountUserOnDevice, setAccountUserOnDevice, accountMatch } from './datastore.js';
import { syncRound, syncKey, pendingChanges } from './sync.js';
import {
  initSupabase, isLoggedIn, getUserEmail, sendOtp, verifyOtp, signOut, scheduleSave, logEvent,
  getAuthProviders, signInWithProvider, deviceKind, syncApi, touchLastSeen, importLegacyData, fetchAccountCounts, exportAccountRows,
  deleteMyAccount, saveCloudInstruments, fetchSharedInstrument, fetchAccess, getUserId, hasStoredSession,
} from './auth.js';
import { syncBases } from './localdb.js';
import { offline } from './offline.js';
import { saveIntentFor, saveText, keepPendingSave, takePendingSave, dropPendingSave, plainDataset, alsoSavedText } from './store.js';

// State of the ocarina / flute views; reset when switching instrument.
function newOcState() {
  return {
    tab: 'notes', selected: null, previous: null, scaleFilter: 'All', handLegend: false,
    category: 'All', playlistId: 'All', expanded: null, voicings: {}, practice: null,
    missingOpen: false, buildChamber: 0, fingersSheet: false, chordMore: false,
    filtersOpen: false, root: 'All', counts: [],
    holeMap: null,         // { sel } while marking where the holes are on the photo
    fgEdit: null,          // { midi, states } while changing a note's fingering by hand
  };
}

// Playlist-entry identity for an ocarina chord, mirroring favIdForChord():
// the plain form for the default voicing, a notes suffix for any other.
function ocLayoutId(inst) { return 'oc:' + entryInstId(inst); }

// The instrument id a playlist or progression entry carries. A saved
// instrument's own id; an ocarina or flute opened from a link (not saved)
// gets its chart and key, as a handpan scale is known by its scale id, so
// what is added to a playlist finds it again: opened from the link later,
// or saved from that chart.
function entryInstId(inst) {
  return inst.id === SHARED_ID && inst.link ? `chart:${inst.link.chartId}/${inst.link.keyId}` : inst.id;
}
function chartEntryId(inst) { return inst.kind === 'traditional' && inst.type ? `chart:${inst.type}/${inst.key}` : null; }
function entryIsFor(en, inst) {
  return !!en?.instrumentId && !!inst && (en.instrumentId === entryInstId(inst) || en.instrumentId === chartEntryId(inst));
}
// The instrument an entry plays on: the saved one, else a saved one from the
// same chart and key, else that chart opened as a visiting instrument.
function entryInstrument(en) {
  const id = en?.instrumentId;
  if (!id) return null;
  const own = getInstrument(id);
  if (own) return own;
  const m = /^chart:([^/]+)\/(.+)$/.exec(id);
  if (!m) return null;
  const saved = getInstruments().find(i => chartEntryId(i) === id);
  if (saved) return saved;
  try {
    const link = { chartId: m[1], keyId: m[2] };
    return { ...instrumentFromChart(m[1], m[2], { name: linkTitle(parseLink(linkFor(link))) }), id: SHARED_ID, link };
  } catch { return null; }
}
function ocFavId(inst, chordId, noteNames, canonicalNames) {
  const base = `${ocLayoutId(inst)}-${chordId}`;
  const sorted = names => [...names].sort((a, b) => noteToMidi(a) - noteToMidi(b)).join(',');
  return canonicalNames && sorted(canonicalNames) === sorted(noteNames) ? base : `${base}-${noteNames.join(',')}`;
}

// Chords playable on the instrument (through the scale filter), each with
// its current voicing as MIDI notes, plus the source scale's chords that
// don't fit. Source scale = the filter, or the scale an ocarina was built from.
function ocChordModel(inst) {
  const oc = state.oc;
  const pcs = oc.scaleFilter !== 'All' ? scalePitchClasses(oc.scaleFilter) : null;
  const layout = ocarinaToLayout(inst, pcs);
  const chords = layout.top.ding ? findAllChords(layout) : [];
  const counts = new Set(oc.counts ?? []);
  const listed = chords
    .filter(c => oc.category === 'All' || c.type.category === oc.category)
    .filter(c => !counts.size || counts.has(chordCountKey(c.noteCount)))
    .filter(c => !oc.root || oc.root === 'All' || notePC(c.rootNote) === NOTE_NAMES.indexOf(oc.root))
    .sort((a, b) => notePC(a.rootNote) - notePC(b.rootNote) || b.noteCount - a.noteCount);
  const main = chordsMainOn(listed, oc.category !== 'All' || counts.size > 0 || (oc.root && oc.root !== 'All'));
  const all = listed.length;
  const items = (main ? mainChordsInKey(listed, notePC(layout.top.ding), layoutPitchClasses(layout)) : listed)
    .map(c => ({ chord: c, midis: oc.voicings[c.id] ?? c.notes.map(noteToMidi).sort((a, b) => a - b) }));
  const sourceId = oc.scaleFilter !== 'All' ? oc.scaleFilter : inst.scaleId;
  const source = findTuning(sourceId);
  const have = new Set(chords.map(c => `${notePC(c.rootNote)}-${c.type.id}`));
  const missing = !source ? [] : findAllChords(createLayoutFromScale(source))
    .filter(c => !have.has(`${notePC(c.rootNote)}-${c.type.id}`))
    .filter(c => oc.category === 'All' || c.type.category === oc.category)
    .map(c => ({ chord: c, fit: fitChordToInstrument(inst, c.notes) }))
    .filter(x => x.fit.missing.length > 0);
  return { chords, items, missing, source, main, all };
}

// The moves line (§5.14): "Lift R3 and R2", with "lift …" and "cover …" in
// the colours of their arrows. Built from fingeringMoves(), so the words are
// the same as its text. lower: start in lower case (after "Next: ").
function ocMovesHtml(moves, { lower = false } = {}) {
  if (!moves?.text) return '';
  if (moves.text === 'No change') return lower ? 'same fingering' : 'No change';
  const join = l => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`);
  const parts = [];
  const chamber = moves.text.match(/^Blow chamber \d+/);
  if (chamber) parts.push(['', chamber[0].toLowerCase()]);
  if (moves.cover.length) parts.push(['move-cover', `cover ${join(moves.cover)}`]);
  if (moves.lift.length) parts.push(['move-lift', `lift ${join(moves.lift)}`]);
  if (moves.half?.length) parts.push(['move-cover', `half-cover ${join(moves.half)}`]);
  return parts.map(([cls, text], i) => {
    const t = i === 0 && !lower ? text[0].toUpperCase() + text.slice(1) : text;
    return cls ? `<span class="${cls}">${escHtml(t)}</span>` : escHtml(t);
  }).join(', ');
}

// The handpan-scale filter of the ocarina Notes and Chords tabs.
function ocScaleSelect(title) {
  return uiPicker({
    id: 'oc-scale-filter', value: state.oc.scaleFilter, label: 'Scale', hint: title, action: 'oc-scale-filter',
    options: scalePickerOptions([{ value: 'All', label: 'All notes', keywords: ['none', 'off'] }]),
  });
}

// While a chord's arpeggio plays: the step being played is highlighted
// (no re-render; the list may not be on screen). The last one clears itself.
let _ocStepTimer = null;
function ocShowStep(key, i) {
  (state.oc.chordStep ??= {})[key] = i;
  for (const box of document.querySelectorAll('.oc-player')) {
    if (box.dataset.key !== key) continue;
    box.querySelectorAll('.oc-pnote').forEach((b, k) => { b.classList.toggle('is-current', k === i); b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
    box.querySelectorAll('.oc-pstage, .oc-pmove').forEach(st => st.classList.toggle('is-current', Number(st.dataset.i) === i));
  }
}
function ocHighlightStep(key, i, last) {
  clearTimeout(_ocStepTimer);
  ocShowStep(key, i);
  document.querySelectorAll('.oc-player.is-playing').forEach(b => b.classList.remove('is-playing'));
  for (const box of document.querySelectorAll('.oc-player')) if (box.dataset.key === key) box.classList.add('is-playing');
  if (last) _ocStepTimer = setTimeout(() => document.querySelectorAll('.oc-player.is-playing').forEach(b => b.classList.remove('is-playing')), 900);
}

// What a chord card shows, worked out once for the row and its detail.
function ocChordParts(inst, { key, chordId, midis, rootPC }) {
  const names = midis.map(midiToNoteName);
  const rootName = names.find(n => notePC(n) === rootPC) ?? names[0];
  return {
    arp: arpeggioOrder(names, rootName),
    inAny: isChordBookmarkedAnyVoicing(ocLayoutId(inst), chordId),
    pairs: inst.chambers.length > 1 ? playablePairs(inst.chambers, midis) : [],
    key,
  };
}




function viewOcarinaChords(inst) {
  const oc = state.oc;
  const uf = state.useFlats, us = state.useSolfege;
  const model = ocChordModel(inst);
  const cardArgs = ({ chord, midis }) => ({
    key: chord.id, chordId: chord.id, canonical: chord.notes,
    title: `${displayNote(chord.rootName, uf, us)} ${escHtml(chord.type.name)}`, sub: escHtml(chord.type.category),
    midis, rootPC: notePC(chord.rootNote),
    favId: ocFavId(inst, chord.id, midis.map(midiToNoteName), chord.notes),
  });
  // Same pattern as the handpan's Chords: the instrument and the chord on
  // top (sticky on phones), the chord list under it. A chord is always
  // shown: the first one until another is picked.
  const selected = model.items.find(x => x.chord.id === oc.expanded) ?? model.items[0] ?? null;
  if (selected && oc.expanded !== selected.chord.id) oc.expanded = selected.chord.id;
  const rows = model.items.length === 0
    ? uiEmpty({ icon: 'music', title: 'No chords match these filters', action: oc.category !== 'All' || oc.scaleFilter !== 'All' || oc.counts?.length || (oc.root && oc.root !== 'All') ? '<button type="button" class="btn btn-secondary" data-action="oc-filters-clear" data-all="1">Clear filters</button>' : '' })
    : `<div class="list chord-rows">${model.items.map(x => {
      const a = cardArgs(x);
      const parts = ocChordParts(inst, a);
      return chordRowHtml({
        title: a.title, titleHtml: true,
        meta: `${parts.pairs.length ? uiBadge('Together', 'accent') + ' ' : ''}${a.sub} · ${chordNotesWord(x.midis.length)}`,
        action: 'oc-chord-select', data: { key: a.key }, current: x === selected, saved: parts.inAny,
      });
    }).join('')}</div>`;
  const missing = model.missing.length ? `
    <details class="oc-missing" ${oc.missingOpen ? 'open' : ''}>
      <summary data-action="oc-missing-toggle">${icon('chevron-right')} Not on this ${windWord(inst)} (${model.missing.length})</summary>
      ${model.source ? `<p class="oc-hint">Chords of ${escHtml(model.source.name)} that need a note it doesn't have.</p>` : ''}
      <div class="list">
        ${model.missing.map(({ chord, fit }) => uiRow({
          title: `${displayNote(chord.rootName, uf, us)} ${chord.type.name}`,
          meta: `missing ${fit.missing.map(n => displayNote(n, uf, us)).join(', ')}`,
        })).join('')}
      </div>
    </details>` : '';
  const nFilters = (oc.counts?.length ? 1 : 0) + (oc.category !== 'All' ? 1 : 0) + (oc.scaleFilter !== 'All' ? 1 : 0) + (oc.root && oc.root !== 'All' ? 1 : 0);
  const listHead = chordListLineHtml({ shown: model.items.length, all: model.all, main: model.main, open: 'oc-filters-open', count: nFilters });
  const stage = oc.listen ? listenOcStageParts(inst)
    : oc.identify ? ocIdentifyParts(inst, model)
    : selected ? ocChordStageParts(inst, cardArgs(selected)) : { picture: '', card: '', key: '' };
  const modeSeg = chordModeSegHtml(oc.listen ? 'listen' : oc.identify ? 'identify' : 'browse', 'oc-listen-mode');
  return `${instrumentAppBar(inst, 'chords')}${chordsScreenHtml({
    cls: ` oc-chords${oc.identify ? ' is-identify' : ''}`, stageCls: ' oc-stage oc-player', stageAttrs: ` data-key="${stage.key}"`,
    picture: stage.picture, card: stage.card,
    listHead: `${modeSeg}${oc.listen || oc.identify ? '' : listHead}`,
    list: oc.listen ? listenHistoryHtml() : oc.identify ? stage.list : rows + missing,
  })}`;
}

// Identify on an ocarina or flute, as on a handpan: tap notes, see the
// chords they make. The picture is the instrument's own notes to tap, with
// the fingering of the last one; a chord found opens in Browse, where its
// fingerings, playlists and octaves are.
function ocIdentifyParts(inst, model) {
  const oc = state.oc;
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const picked = oc.idNotes ?? [];
  const last = picked[picked.length - 1];
  const picture = `
      <div class="oc-id">
        ${last != null ? `<div class="oc-id-fg">${renderFingering(inst, last, { size: 'medium', useFlats: uf, useSolfege: us })}</div>` : ''}
        <div class="chips oc-id-notes" role="group" aria-label="Notes of this instrument">
          ${playableMidis(inst).map(m => `<button type="button" class="chip${picked.includes(m) ? ' is-selected' : ''}" data-action="oc-id-note" data-midi="${m}" aria-pressed="${picked.includes(m)}">${escHtml(nn(m))}</button>`).join('')}
        </div>
      </div>`;
  const card = chordCardHtml({
    title: picked.length ? picked.map(nn).join(' · ') : 'Tap notes to name a chord',
    metas: [[picked.length < 2 ? 'Tap two or more notes. Tap again to remove one.' : `${picked.length} notes`]],
    actions: picked.length ? `
          <button type="button" class="btn btn-primary hp-play" data-action="oc-id-play"${picked.length < 2 ? ' disabled' : ''}>${icon('play')} Play</button>
          <button type="button" class="btn btn-secondary" data-action="oc-id-clear">Clear</button>` : '',
  });
  const matches = picked.length >= 2 ? identifyChord(picked.map(midiToNoteName)) : [];
  const known = new Set(model.items.map(x => x.chord.id));
  const list = picked.length < 2 ? '<p class="hp-hint">Select 2 or more notes to identify a chord.</p>'
    : !matches.length ? `<div class="list">${uiRow({ title: 'Custom combination', meta: `Not a recognized chord type · ${picked.length} notes` })}</div>`
    : `<div class="list">${matches.map(m => uiRow({
      title: `${displayNote(m.rootName, uf, us)} ${escHtml(m.type.name)}`,
      meta: `${escHtml(m.type.category)} · ${m.notes.map(n => escHtml(displayNote(n, uf, us))).join(', ')}`,
      ...(known.has(m.id) ? { chevron: true, action: 'oc-id-open', data: { id: m.id } } : {}),
    })).join('')}</div>`;
  return { picture, card, list, key: 'identify' };
}

// What ocarina / flute put into the shared Chords screen: the picture (one
// fingering, the note on show or being played) and the chord card with the
// notes in playing order and what to change for each.
function ocChordStageParts(inst, a) {
  const parts = ocChordParts(inst, a);
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const key = escHtml(a.key);
  const sel = Math.min(state.oc.chordStep?.[a.key] ?? 0, parts.arp.length - 1);
  const opts = { useFlats: uf, useSolfege: us, size: 'medium', showFingers: true, noteLabel: false, closeUp: state.closeUp };
  const picture = `
      <div class="oc-stage-fg">
        ${parts.arp.map((m, i) => `
          <div class="oc-pstage${i === sel ? ' is-current' : ''}" data-i="${i}">
            <button type="button" class="oc-pstage-fg" data-action="oc-play-note" data-midi="${m}" aria-label="Play ${escHtml(nn(m))}">
              ${renderFingering(inst, m, { ...opts, previousMidi: i > 0 ? parts.arp[i - 1] : null })}</button>
          </div>`).join('')}
      </div>`;
  const card = chordCardHtml({
    title: a.title,
    metas: [[`${a.sub} · ${a.midis.map(nn).join(' · ')}`]],
    actions: `
          <button type="button" class="btn btn-primary hp-play" data-action="oc-play-arp" data-key="${key}">${icon('play')} Chord</button>
          ${speedBtnHtml()}
          ${chordSaveBtn(parts.inAny, { action: 'oc-show-playlist-picker', data: { key: a.key } })}
          ${uiIconBtn('ellipsis', 'More: octaves, what the holes mean', { action: 'oc-more-open', attrs: 'aria-haspopup="dialog"' })}`,
    // One note at a time: the notes in playing order, and what to change
    // for the one on show.
    below: `
        ${goesWithLineHtml()}
        <div class="oc-player-notes" role="group" aria-label="Notes of the chord, in playing order">
          ${parts.arp.map((m, i) => `
            <button type="button" class="oc-pnote${i === sel ? ' is-current' : ''}" data-action="oc-step" data-key="${key}" data-i="${i}" data-midi="${m}"
              aria-pressed="${i === sel ? 'true' : 'false'}"><span class="oc-pnote-num">${i + 1}</span>${escHtml(nn(m))}</button>
            ${i < parts.arp.length - 1 ? `<span class="oc-pnote-sep" aria-hidden="true">${icon('chevron-right')}</span>` : ''}`).join('')}
        </div>
        ${parts.arp.map((m, i) => `
          <div class="oc-pmove${i === sel ? ' is-current' : ''}" data-i="${i}"><strong>${escHtml(nn(m))}</strong> · ${i === 0 ? 'start with this fingering' : ocMovesHtml(fingeringMoves(inst, parts.arp[i - 1], m), { lower: true })}</div>`).join('')}`,
  });
  return { picture, card, key };
}

// An ocarina's or flute's Filters: the shared sheet, with the handpan-scale
// filter in place of the playlist.
function ocFiltersSheet() {
  const oc = state.oc;
  const inst = currentInstrument();
  return chordFiltersSheet({
    key: 'oc-filters', close: 'oc-filters-close', clear: 'oc-filters-clear',
    roots: chordRootsOf(inst ? ocChordModel(inst).chords : []), root: oc.root ?? 'All', rootAction: 'oc-filter-root',
    counts: new Set(oc.counts ?? []), countAction: 'oc-toggle-count', category: oc.category, categoryAction: 'oc-category',
    extra: uiField({ label: 'Scale', id: 'oc-scale-filter', control: ocScaleSelect('Only chords made of this scale\'s notes'), help: 'Only chords made of the scale\'s notes.' }),
  });
}

// An ocarina's or flute's chord ⋯: the shared sheet, with its octaves, the two-note pairs of a
// multi-chamber ocarina, and what the hole pictures mean.
function ocChordMoreSheet() {
  const inst = currentInstrument();
  if (!inst) return '';
  const key = state.oc.expanded;
  const card = key && ocCardData(inst, key);
  if (!card) return '';
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const pairs = inst.chambers.length > 1 ? playablePairs(inst.chambers, card.midis) : [];
  const hasHalf = card.midis.some(m => fingeringFor(inst, m)?.states?.includes('h'));
  return chordMoreSheet({
    key: 'oc-more', title: `${displayNote(card.rootName, uf, us)} ${card.typeName}`, close: 'oc-more-close',
    extra: `
      <div class="field oc-more-octaves">
        <span class="field-label">Octaves</span>
        <div class="chips">${card.midis.map(m => `<button type="button" class="chip" data-action="oc-voicing" data-key="${escHtml(key)}" data-midi="${m}"
          aria-label="Move ${nn(m)} to another octave">${nn(m)}</button>`).join('')}</div>
        <div class="field-help">Tap a note to move it to another octave.</div>
      </div>
      ${pairs.map(p => `
        <button type="button" class="oc-pair" data-action="oc-play-pair" data-a="${p.a.midi}" data-b="${p.b.midi}">
          <span class="oc-pair-text">${uiBadge('Together', 'accent')} <span>${nn(p.a.midi)} + ${nn(p.b.midi)}: blow both chambers</span></span>
          <span class="fg-mini">${renderFingering(inst, p.a.midi, { useFlats: uf, useSolfege: us, size: 'mini', blowBoth: p.b.midi })}</span>
        </button>`).join('')}
      <div class="fg-legend oc-steps-legend">
        <span>${legendHole('c')} covered</span><span>${legendHole('o')} open</span>
        ${hasHalf ? `<span>${legendHole('h')} half</span>` : ''}
        <span>${legendHole('x')} changes</span>
      </div>
      <div class="list">${uiRow({ lead: 'hand', title: 'Which finger is which', action: 'oc-hand-open', chevron: true })}</div>`,
  });
}

// Practice mode: autoplay on an ocarina playlist or progression, one
// arpeggio note at a time. The large diagram shows the current note with
// arrows for what to lift or cover to reach the next one; tap to move on.

// What is being practised (state.oc.practice is { playlistId, idx } or
// { progressionId, idx }): its name, what one entry is called, and the
// entries for this instrument, each with an id (a progression step's id is
// its stepId, so a repeated chord is still its own entry). null when gone.
function practiceSource(inst, pr = state.oc.practice) {
  if (!inst || !pr) return null;
  if (pr.progressionId) {
    const raw = state.progressions.find(p => p.id === pr.progressionId);
    if (!raw) return null;
    const prog = progVoiced(raw, progOcContext(inst));
    return { name: prog.name, unit: 'Chord', entries: prog.steps.filter(s => entryIsFor(s, inst) && !s.missing).map(s => ({ ...s, id: s.stepId })) };
  }
  const pl = state.playlists.find(p => p.id === pr.playlistId);
  if (!pl) return null;
  return { name: pl.name, unit: 'Chord', entries: pl.chords.filter(c => entryIsFor(c, inst)) };
}

function practiceSteps(entries) {
  const steps = [];
  for (const en of entries) {
    const rootName = en.notes.find(n => notePC(n) === notePC(en.rootName + '4')) ?? en.notes[0];
    for (const m of arpeggioOrder(en.notes, rootName)) steps.push({ entryId: en.id, midi: m });
  }
  return steps;
}

// Practice (§6.12): a full-screen focus view with no tab bar. ✕ stops, the
// mic turns on the tuner (which moves on by itself), Back and Next sit at
// the bottom.
function viewOcarinaPractice(inst) {
  const pr = state.oc.practice;
  const src = practiceSource(inst, pr);
  const steps = src ? practiceSteps(src.entries) : [];
  if (steps.length === 0) { state.oc.practice = null; return viewInstrument(); }
  const idx = Math.min(pr.idx, steps.length - 1);
  const cur = steps[idx];
  const next = steps[(idx + 1) % steps.length];
  const entries = src.entries;
  const en = entries.find(c => c.id === cur.entryId);
  const chordNo = entries.indexOf(en) + 1;
  const ofChord = steps.filter(s => s.entryId === cur.entryId);
  const noteNo = idx - steps.indexOf(ofChord[0]) + 1;
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const opts = { useFlats: uf, useSolfege: us, showFingers: state.showFingers, showSizes: state.showSizes, closeUp: state.closeUp };
  const moves = fingeringMoves(inst, cur.midi, next.midi);
  const nextEn = entries.find(c => c.id === next.entryId);
  const progress = Math.round(((idx + 1) / steps.length) * 100);
  return `
    ${uiAppBar({
      title: `Practice · ${src.name}`,
      back: { action: 'oc-practice-stop', label: 'Stop practice', icon: 'x' },
      actions: [tunerAppBtn()],
    })}
    <div class="practice">
      <div class="practice-head">
        <h2 class="practice-title">${displayNote(en.rootName, uf, us)} ${escHtml(en.typeName)}</h2>
        <div class="practice-sub">${src.unit} ${chordNo} of ${entries.length} · note ${noteNo} of ${ofChord.length}</div>
        <div class="practice-progress" role="progressbar" aria-label="Practice progress" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="${idx + 1}">
          <span style="width:${progress}%"></span>
        </div>
      </div>
      <div class="fg-stage is-practice">
        <button type="button" class="fg-stage-play" data-action="oc-practice-next" title="Tap for the next note">
          ${renderFingering(inst, cur.midi, { ...opts, size: 'large', nextMidi: next.midi })}
        </button>
        <div class="fg-moves-row">
          <span></span>
          <div class="fg-moves">Next: ${ocMovesHtml(moves, { lower: true })}</div>
          ${state.showFingers ? uiIconBtn('hand', 'Which finger is which', { action: 'oc-hand-open' }) : '<span></span>'}
        </div>
      </div>
      <div class="practice-next">
        <span class="fg-mini is-next" aria-hidden="true">${renderFingering(inst, next.midi, { ...opts, size: 'mini' })}</span>
        <span>Up next: ${nn(next.midi)}${nextEn && nextEn.id !== en.id ? ` · ${displayNote(nextEn.rootName, uf, us)} ${escHtml(nextEn.typeName)}` : ''}</span>
      </div>
      <p class="practice-status">${state.tuner.on ? `Listening for ${nn(cur.midi)} · play the note` : 'Tap the diagram or Next to move on'}</p>
      <div class="actionbar practice-bar">
        ${uiIconBtn('rewind', 'Back to the first note', { action: 'oc-practice-restart', cls: 'btn-lg' })}
        <button type="button" class="btn btn-secondary btn-lg" data-action="oc-practice-prev">${icon('chevron-left')} Back</button>
        <button type="button" class="btn btn-primary btn-lg" data-action="oc-practice-next">Next ${icon('chevron-right')}</button>
      </div>
    </div>`;
}

function handLegendModal() {
  if (!state.oc.handLegend) return '';
  return uiSheet({
    key: 'hand', title: 'Which finger is which', close: 'oc-hand-close',
    body: `<p class="sheet-text">As you hold the instrument, looking at the backs of your hands.</p>${renderHandLegend()}`,
    footer: `<button class="btn btn-secondary" data-action="oc-hand-close">Close</button>`,
  });
}

// An ocarina or flute: the Notes view (fingering chart), or the tab chosen.
function viewInstrument() {
  if (state.currentInstrumentId === SHARED_ID && !state.shared) {
    return `
      ${backAppBar('Shared instrument')}
      ${state.sharedStatus === 'loading'
        ? uiEmpty({ icon: 'share-2', title: 'Opening the shared instrument…' })
        : uiEmpty({ icon: 'share-2', title: 'No shared instrument has that code', body: 'Check the code and try again.' })}`;
  }
  const inst = currentInstrument();
  if (!inst) return viewHome();
  const uf = state.useFlats, us = state.useSolfege;
  const midis = playableMidis(inst);
  if (state.oc.tab === 'builder' && !canBuild()) state.oc.tab = 'notes';
  if (state.oc.tab === 'builder' && inst.kind === 'scale') return viewBuilder(inst);
  if (state.oc.tab === 'setup' || (inst.kind === 'custom' && midis.length === 0)) return viewSetup(inst);

  if (midis.length === 0) {
    return `${instrumentAppBar(inst, 'notes')}
      ${uiEmpty({ icon: 'family-ocarina', title: 'No fingering chart yet', body: escHtml(instrumentStatus(inst)) })}`;
  }

  const oc = state.oc;
  if (oc.practice) return viewOcarinaPractice(inst);
  if (oc.tab === 'chords') return viewOcarinaChords(inst);
  if (oc.tab === 'playlists') return `${instrumentAppBar(inst, 'playlists')}${playlistsTabHtml(inst)}`;
  if (oc.tab === 'songs') return `${instrumentAppBar(inst, 'songs')}${songsTabHtml(inst)}`;
  if (!midis.includes(oc.selected)) { oc.selected = midis[0]; oc.previous = null; }
  const pcs = oc.scaleFilter !== 'All' ? scalePitchClasses(oc.scaleFilter) : null;
  const inScale = m => !pcs || pcs.has(((m % 12) + 12) % 12);
  const opts = { useFlats: uf, useSolfege: us, showFingers: state.showFingers, showSizes: state.showSizes, closeUp: state.closeUp };
  const moves = oc.previous != null && oc.previous !== oc.selected ? fingeringMoves(inst, oc.previous, oc.selected) : null;

  return `${instrumentAppBar(inst, 'notes')}
    <div class="oc-notes">
      <div class="oc-notes-side">
        <div class="oc-context">
          ${ocScaleSelect('Dim notes outside a scale')}
          <button type="button" class="btn btn-secondary" data-action="oc-play-scale">${icon('play')} Scale</button>
        </div>
        <div class="fg-stage-wrap">
          ${oc.fgEdit?.midi === oc.selected ? fgEditStageHtml(inst, opts) : `
          <div class="fg-stage">
            <button type="button" class="fg-stage-play" data-action="oc-play-selected" title="Play this note">
              ${renderFingering(inst, oc.selected, { ...opts, size: 'large', previousMidi: oc.previous })}
            </button>
            <div class="fg-moves-row">
              <span></span>
              <div class="fg-moves">${moves ? ocMovesHtml(moves) : ''}</div>
              ${state.showFingers ? uiIconBtn('hand', 'Which finger is which', { action: 'oc-hand-open' }) : '<span></span>'}
            </div>
            ${inst.setup?.fixed?.[oc.selected] ? `<p class="fg-yours">${uiBadge('Your fingering', 'accent')}</p>` : ''}
            ${fgEditable(inst) ? `<button type="button" class="btn btn-ghost btn-sm fg-edit-open" data-action="fg-edit-open">${icon('pencil')} ${inst.setup?.fixed?.[oc.selected] ? 'Change your fingering' : 'Not how you play it? Change the fingering'}</button>` : ''}
          </div>`}
        </div>
        ${recordedCentsHtml(inst, oc.selected)}
        ${state.ocLegendSeen ? '' : `
          <div class="fg-legend">
            <span>${legendHole('c')} covered</span><span>${legendHole('o')} open</span><span>${legendHole('h')} half</span>
            <button type="button" class="btn btn-ghost btn-sm" data-action="oc-legend-dismiss">Got it</button>
          </div>`}
      </div>
      <div class="oc-notes-main">
        <div class="fg-grid">
          ${midis.map(m => `
            <button type="button" class="fg-cell${inScale(m) ? '' : ' is-dim'}" aria-pressed="${m === oc.selected ? 'true' : 'false'}" data-action="oc-select-note" data-midi="${m}">
              ${renderFingering(inst, m, { ...opts, size: 'medium', closeUp: false })}
            </button>`).join('')}
        </div>
        <p class="oc-count">${escHtml(instrumentStatus(inst))}</p>
      </div>
    </div>`;
}

// A recorded flute: how far the note it plays is from the charted note.
function recordedCentsHtml(inst, midi) {
  const c = inst.family === 'flute' && inst.kind === 'custom' ? inst.calibration?.cents?.[midi] : null;
  if (c == null) return '';
  const off = c === 0 ? 'in tune' : `${c > 0 ? '+' : '−'}${Math.abs(c)} ¢ (${c > 0 ? 'sharp' : 'flat'})`;
  return `<p class="b-meta fl-recorded">Your flute played this ${off} when you recorded it.</p>`;
}

function legendHole(state) {
  const body = state === 'x' ? '<g class="fg-changed"><circle class="fg-o" cx="8" cy="8" r="5.5"/></g>'
    : state === 'c' ? '<circle class="fg-c" cx="8" cy="8" r="6"/>'
    : state === 'o' ? '<circle class="fg-o" cx="8" cy="8" r="6"/>'
    : '<circle class="fg-o" cx="8" cy="8" r="6"/><path class="fg-c" d="M 2 8 A 6 6 0 0 0 14 8 Z"/>';
  return `<svg class="fingering" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${body}</svg>`;
}


// Everything a chord card's buttons need, looked up by its key: a chord id
// in the plain list, or 'e:' + entry id when a playlist is selected.
// The instrument a chord card belongs to: an entry's own (cards in a
// playlist), otherwise the instrument on screen.
function ocCardInstrument(key) {
  const en = key?.startsWith('e:') ? state.playlists.flatMap(p => p.chords).find(c => 'e:' + c.id === key) : null;
  return (en?.instrumentId && entryInstrument(en)) || currentInstrument();
}

function ocCardData(inst, key) {
  if (key.startsWith('e:')) {
    const en = state.playlists.flatMap(p => p.chords).find(c => 'e:' + c.id === key);
    if (!en) return null;
    return {
      entry: en, chordId: en.chordId, rootName: en.rootName, typeName: en.typeName, category: en.category,
      midis: (state.oc.voicings[key] ?? en.notes.map(noteToMidi)).sort((a, b) => a - b),
      rootPC: notePC(en.rootName + '4'), canonical: null,
    };
  }
  const item = ocChordModel(inst).items.find(x => x.chord.id === key);
  if (!item) return null;
  const c = item.chord;
  return {
    chordId: c.id, rootName: c.rootName, typeName: c.type.name, category: c.type.category,
    midis: item.midis, rootPC: notePC(c.rootNote), canonical: c.notes,
  };
}

// Which sound the next notes use: the open ocarina or flute sounds like
// one (a whistle-bodied flute like a tin whistle); everything else, the
// handpan screens included, keeps the handpan sound.
function voiceForState() {
  // A handpan, tongue drum or kalimba on screen sounds like itself.
  if (state.layout && ['editor', 'chords', 'hp-playlists', 'hp-songs', 'progression', 'playlist'].includes(state.view)) return layoutInstrument(state.layout);
  if (state.view === 'setup') return setupFamilyInfo(state.setup?.family).voice;
  if (state.view === 'song') {
    const inst = songInstrument();
    if (!inst) return state.layout ? layoutInstrument(state.layout) : 'handpan';
    return windVoice(inst);
  }
  if (!['instrument', 'progression', 'playlist'].includes(state.view) || !state.currentInstrumentId) return 'handpan';
  const inst = currentInstrument();
  if (!inst) return 'handpan';
  if (usesLayout(inst)) return inst.family;
  return windVoice(inst);
}
// The voice of a one-note instrument: an ocarina, a recorder, a tin whistle or a wooden flute.
function windVoice(inst) {
  if (inst.family === 'ocarina' || inst.family === 'recorder') return inst.family;
  return String(inst.type ?? '').startsWith('tin-whistle') ? 'whistle' : 'flute';
}

function playPracticeStep() {
  setVoice(voiceForState());
  const inst = currentInstrument();
  const src = practiceSource(inst);
  if (!src) return;
  const steps = practiceSteps(src.entries);
  const step = steps[state.oc.practice.idx % steps.length];
  if (step) { initAudio(); playNote(midiToNoteName(step.midi)); }
}

// An ocarina or flute entry opens its instrument, showing the playlist with
// that instrument's chord cards (entry expanded) and Practice.
function openPlaylistEntryOnInstrument(pl, entry) {
  const inst = entryInstrument(entry);
  if (inst?.id === SHARED_ID) openChartLink(inst.link);
  else if (!inst || !openInstrument(inst.id, { push: false })) { showToast('That instrument is no longer in My instruments'); return false; }
  // Like a handpan entry: the chord opens on the instrument's Chords screen,
  // in the voicing saved in the playlist, with the filters cleared so it's there.
  Object.assign(state.oc, { tab: 'chords', scaleFilter: 'All', category: 'All', expanded: entry.chordId, chordStep: {}, practice: null });
  state.oc.voicings[entry.chordId] = entry.notes.map(noteToMidi).sort((a, b) => a - b);
  navPush(instUrl(state.currentInstrumentId, 'chords'));
  return true;
}

// ── Speed ─────────────────────────────────────────────────────────────────
// One speed for everything that plays (arpeggios, scales, fingerings shown
// note by note, previews), 25–150% of normal: a slider with presets, in
// Settings and behind the "1×" button on every chord card. Remembered and
// synced (the tempo preference).
const TEMPO_PRESETS = [25, 50, 75, 100, 125];
function clampTempo(v) { return Math.min(150, Math.max(25, Math.round((Number(v) || 100) / 5) * 5)); }
function tempoLabel(t = state.tempo) { return `${(t / 100).toFixed(2).replace(/\.?0+$/, '')}×`; }
let _tempoSave = null;
function setTempo(v, { preview = false } = {}) {
  state.tempo = clampTempo(v);
  setPlaybackTempo(state.tempo);
  clearTimeout(_tempoSave);
  _tempoSave = setTimeout(savePrefs, 400);
  document.querySelectorAll('.tempo-value').forEach(e => { e.textContent = `${state.tempo}%`; });
  document.querySelectorAll('.speed-btn-label').forEach(e => { e.textContent = tempoLabel(); });
  document.querySelectorAll('.tempo-presets [data-value]').forEach(e => e.setAttribute('aria-pressed', String(+e.dataset.value === state.tempo)));
  if (preview) { initAudio(); playScale(['C4', 'E4', 'G4']); }
}
function tempoControlHtml() {
  return `<div class="tempo">
      <div class="tempo-row">
        <input type="range" class="tempo-slider" min="25" max="150" step="5" value="${state.tempo}" aria-label="Speed, percent of normal">
        <span class="tempo-value">${state.tempo}%</span>
      </div>
      <div class="chips tempo-presets" role="group" aria-label="Speed presets">
        ${TEMPO_PRESETS.map(v => `<button type="button" class="chip" data-action="tempo-set" data-value="${v}" aria-pressed="${v === state.tempo}">${v === 100 ? 'Normal' : `${v}%`}</button>`).join('')}
      </div>
    </div>`;
}
// The card's speed button: "1×", "0.75×".
function speedBtnHtml() {
  return `<button type="button" class="btn btn-secondary speed-btn" data-action="speed-open" aria-haspopup="dialog" aria-label="Speed ${state.tempo}%" title="Speed"><span class="speed-btn-label">${tempoLabel()}</span></button>`;
}
function speedSheet() {
  return uiSheet({
    key: 'speed', title: 'Speed', close: 'speed-close',
    body: `<p class="sheet-text">How fast chords, scales and fingerings play, on every instrument. Slower is easier to follow.</p>${tempoControlHtml()}`,
    footer: '<button type="button" class="btn btn-primary" data-action="speed-close">Done</button>',
  });
}

// ── Add to home screen ─────────────────────────────────────────────────────
// The app works best installed: full screen, its own icon, offline. A slim
// banner on the start screens says so; Android browsers give us their own
// install dialog (beforeinstallprompt), iPhones don't, so there the button
// shows the steps. Hidden in the installed app, and for 30 days after ×
// (a per-device convenience, so localStorage).
let _installEvent = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); _installEvent = e; render(); });
window.addEventListener('appinstalled', () => { _installEvent = null; state.installHelp = false; render(); });
const INSTALL_DISMISS_KEY = 'hp-install-dismissed';
const INSTALL_QUIET_MS = 30 * 24 * 3600 * 1000;

function runningInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
// Not before the visitor got something out of the app: it shows once a sound
// was played in this visit, or an instrument is saved.
let _heardSound = false;
function installBannerHtml() {
  if (runningInstalled()) return '';
  if (!_heardSound && !state.instruments.length) return '';
  try { if (Date.now() - Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0) < INSTALL_QUIET_MS) return ''; } catch {}
  return `
      <div class="banner install-banner">
        <span>${icon('smartphone')} Add Oakhum to your home screen: it opens like an app, full screen, and works offline.</span>
        <span class="install-banner-actions">
          <button type="button" class="btn btn-primary btn-sm" data-action="install-app">Add</button>
          ${uiIconBtn('x', 'Not now', { action: 'install-dismiss' })}
        </span>
      </div>`;
}
function installHelpSheet() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const steps = ios
    ? (/CriOS|FxiOS|EdgiOS/.test(ua)
      ? ['Tap the Share button in the address bar (a square with an arrow).', 'Choose <b>Add to Home Screen</b>.', 'Tap <b>Add</b>.']
      : ['Tap the Share button (a square with an arrow) at the bottom of Safari.', 'Scroll down and choose <b>Add to Home Screen</b>.', 'Tap <b>Add</b>.'])
    : /SamsungBrowser/.test(ua)
    ? ['Open the menu (the three lines at the bottom).', 'Choose <b>Add page to</b>, then <b>Home screen</b>.']
    : ['Open the browser menu (⋮ or ≡).', 'Choose <b>Add to Home screen</b> or <b>Install app</b>.'];
  return uiSheet({
    key: 'install', title: 'Add Oakhum to your home screen', close: 'install-help-close',
    body: `<ol class="install-steps">${steps.map(t => `<li>${t}</li>`).join('')}</ol>
      <p class="sheet-text">Then open Oakhum from its icon: full screen, quicker to reach, and with an account it works offline.</p>`,
    footer: '<button type="button" class="btn btn-primary" data-action="install-help-close">Done</button>',
  });
}

// ── Preferences (persist across sessions) ────────────────────────────────────
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('hp-prefs') || '{}');
    if (typeof p.ringRotated === 'boolean') state.ringRotated = p.ringRotated;
    // Note names: the three-way setting, or the C# / D♭ switch it replaced
    // (D♭ was a choice and stays; C# was also the default, so it becomes Auto).
    if (['auto', 'sharps', 'flats'].includes(p.noteNames)) state.noteNames = p.noteNames;
    else if (p.useFlats === true) state.noteNames = 'flats';
    if (typeof p.useSolfege === 'boolean') state.useSolfege = p.useSolfege;
    if (typeof p.autoplaySeconds === 'number') state.autoplaySeconds = p.autoplaySeconds;
    // The speed, or the Slow / Normal / Fast it replaced.
    if (Number.isFinite(p.tempo)) state.tempo = clampTempo(p.tempo);
    else if (p.playbackSpeed === 'slow') state.tempo = 70;
    else if (p.playbackSpeed === 'fast') state.tempo = 140;
    if (typeof p.showFingers === 'boolean') state.showFingers = p.showFingers;
    if (typeof p.showSizes === 'boolean') state.showSizes = p.showSizes;
    if (typeof p.closeUp === 'boolean') state.closeUp = p.closeUp;
    if (typeof p.chordsAll === 'boolean') state.chordsAll = p.chordsAll;
    if (typeof p.showLyrics === 'boolean') state.showLyrics = p.showLyrics;
    if (typeof p.ocLegendSeen === 'boolean') state.ocLegendSeen = p.ocLegendSeen;
    if (typeof p.handLegendSeen === 'boolean') state.handLegendSeen = p.handLegendSeen;
    if (['dark', 'light', 'auto'].includes(p.theme)) state.theme = p.theme;
  } catch {}
  applyTheme();
  setPlaybackTempo(state.tempo);
}

// The theme pref on <html data-theme> (the CSS does the rest) and the
// browser chrome colour to match. Auto follows the OS as it changes.
const THEME_COLORS = { dark: '#1C1B16', light: '#F2E6D3' };
const _themeQuery = window.matchMedia?.('(prefers-color-scheme: light)');
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const resolved = state.theme === 'auto' ? (_themeQuery?.matches ? 'light' : 'dark') : state.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
}
_themeQuery?.addEventListener?.('change', applyTheme);

// Settings sync with an account (as the 'prefs' item): updatedAt stamps the
// edit, and lastPath (rememberLastPath) is kept.
function savePrefs() {
  let kept = {};
  try { const p = JSON.parse(localStorage.getItem('hp-prefs') || '{}'); if (p.lastPath) kept = { lastPath: p.lastPath }; } catch {}
  safeSetItem(localStorage, 'hp-prefs', JSON.stringify({
    ...kept,
    updatedAt: new Date().toISOString(),
    ringRotated: state.ringRotated,
    noteNames: state.noteNames,
    useFlats: state.noteNames === 'flats', // for app versions from before Auto
    useSolfege: state.useSolfege,
    autoplaySeconds: state.autoplaySeconds,
    tempo: state.tempo,
    showFingers: state.showFingers,
    showSizes: state.showSizes,
    closeUp: state.closeUp,
    chordsAll: state.chordsAll,
    showLyrics: state.showLyrics,
    ocLegendSeen: state.ocLegendSeen,
    handLegendSeen: state.handLegendSeen,
    theme: state.theme,
  }));
  scheduleSave();
}

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
    key: 'save', title: t.title, close: 'save-not-now', body,
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
  _sharedPushed = new Map();
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

// ── Sync ────────────────────────────────────────────────────────────────────
// The items on this device, for syncRound (js/sync.js). Handpan instruments
// are left out: they're made from the saved layouts, which sync themselves.
const SYNC_LISTS = { playlist: 'hp-playlists', progression: 'hp-progressions', layout: 'hp-layouts', instrument: 'hp-instruments' };
const SYNC_PREFS = ['ringRotated', 'useFlats', 'noteNames', 'useSolfege', 'autoplaySeconds', 'tempo', 'showFingers', 'showSizes', 'chordsAll', 'showLyrics', 'closeUp', 'ocLegendSeen', 'handLegendSeen', 'theme', 'lastPath', 'updatedAt'];

function syncReadList(key) {
  try { const v = JSON.parse(dataStore().getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function syncReadPrefs() {
  try { return JSON.parse(localStorage.getItem('hp-prefs') || '{}') || {}; } catch { return {}; }
}

const syncLocal = {
  items() {
    const m = new Map();
    for (const [kind, key] of Object.entries(SYNC_LISTS)) {
      for (const data of syncReadList(key)) {
        if (!data?.id || (kind === 'instrument' && usesLayout(data))) continue;
        m.set(syncKey(kind, data.id), { kind, id: data.id, data });
      }
    }
    const p = syncReadPrefs();
    if (p.updatedAt) {
      const data = { id: 'prefs' };
      for (const f of SYNC_PREFS) if (p[f] !== undefined) data[f] = p[f];
      m.set(syncKey('prefs', 'prefs'), { kind: 'prefs', id: 'prefs', data });
    }
    return m;
  },
  write(kind, id, data) {
    if (kind === 'prefs') {
      const { id: _id, ...rest } = data;
      safeSetItem(localStorage, 'hp-prefs', JSON.stringify({ ...syncReadPrefs(), ...rest }));
      return;
    }
    const key = SYNC_LISTS[kind];
    if (!key) return;
    const list = syncReadList(key);
    const i = list.findIndex(x => x.id === id);
    if (i >= 0) list[i] = data; else list.push(data);
    safeSetItem(dataStore(), key, JSON.stringify(list));
  },
  add(kind, data) { this.write(kind, data.id, data); },
};

let _syncTimer = null;
const _syncRejectedTold = new Set();
let _syncRunning = false;
let _syncAgain = false;

function syncSoon(ms = 2000) {
  if (!accountOn()) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(syncNow, ms);
}

async function syncNow() {
  if (!accountOn()) return;
  if (!isLoggedIn()) { state.syncPending = await pendingCount(); return; }
  // Only ever with the account this device's things belong to.
  if (_syncHold || accountMatch(accountUserOnDevice(), getUserId()) === 'other') return;
  if (_syncRunning) { _syncAgain = true; return; }
  _syncRunning = true;
  const before = state.syncPending;
  try {
    const r = await syncRound({ local: syncLocal, bases: syncBases, api: syncApi, device: deviceKind() });
    state.syncPending = r.pending;
    state.syncError = null;
    state.lastSynced = Date.now();
    if (r.pulled || r.copies.length) {
      const prevTheme = state.theme;
      loadPrefs();
      if (state.theme !== prevTheme) applyTheme();
      reloadSaved();
      render();
    } else if (before !== r.pending) render();
    if (state.legacyImported && r.pulled) {
      showToast(`Brought over ${state.legacyImported} item${state.legacyImported !== 1 ? 's' : ''} from your earlier account`);
      state.legacyImported = 0;
    } else if (r.copies.length) showToast(`Changed on two devices, so both are kept: ${r.copies[0]}`);
    else if (before > 0 && r.pending === 0 && r.pushed) showToast('Synced');
    if (r.pushed) pushSharedInstruments();
    // An item over the server's size cap stays on this device: said once.
    const big = r.rejected.find(x => !_syncRejectedTold.has(`${x.kind}:${x.id}`));
    if (big) {
      _syncRejectedTold.add(`${big.kind}:${big.id}`);
      showToast(`${big.name ? `“${big.name}”` : 'One item'} is too large to sync, so it stays on this device only. A smaller photo usually fixes it.`);
    }
  } catch (err) {
    state.syncError = navigator.onLine === false ? 'offline' : 'error';
    state.syncPending = await pendingCount();
  } finally {
    _syncRunning = false;
    if (_syncAgain) { _syncAgain = false; syncSoon(500); }
  }
}

// Changes waiting for the server (Settings › Account, the Offline pill).
async function pendingCount() {
  try { return pendingChanges(syncLocal.items(), await syncBases.getAll()).length; } catch { return 0; }
}

// A shared code is read from the instruments table, so shared instruments
// are written there as well after they change (docs/free-to-play.md, data model).
let _sharedPushed = new Map();
function pushSharedInstruments() {
  const shared = getInstrumentsRaw().filter(i => i.publicId && _sharedPushed.get(i.id) !== i.updatedAt);
  if (!shared.length) return;
  saveCloudInstruments(shared).then(ok => { if (ok === true) shared.forEach(i => _sharedPushed.set(i.id, i.updatedAt)); });
}

for (const ev of ['hp-data-changed', 'hp-instruments-changed', 'hp-progressions-changed']) {
  window.addEventListener(ev, () => {
    if (!accountOn()) return;
    pendingCount().then(n => { if (n !== state.syncPending) { state.syncPending = n; if (state.view === 'settings') render(); else refreshStatusUi(); } });
    syncSoon();
  });
}

// A write to this device's storage failed (js/datastore.js safeSetItem):
// say so once, instead of a save that silently did nothing.
let _storageFullAt = 0;
window.addEventListener('hp-storage-full', () => {
  if (Date.now() - _storageFullAt < 5000) return;
  _storageFullAt = Date.now();
  logEvent('storage_full');
  // After the tap's own handler, so its "Saved" doesn't cover this.
  setTimeout(() => showToast('This device is out of space for saved things, so that wasn’t saved. Remove an instrument photo or something you no longer use, then try again.'), 0);
});

let _syncPoll = null;
function startSyncPoll() {
  if (_syncPoll) return;
  _syncPoll = setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 30000);
}
function stopSyncPoll() {
  if (_syncPoll) { clearInterval(_syncPoll); _syncPoll = null; }
}

// ── Offline (§4) ────────────────────────────────────────────────────────────
function enableOffline() {
  if (!accountOn()) return;
  offline.enable(BUILD_HASH).then(ok => { state.offlineReady = ok; if (state.view === 'settings') render(); });
}

// The Offline pill in the app bar, accounts only: quiet, never covering anything.
function offlinePillHtml() {
  if (!state.isOffline || !accountOn()) return '';
  const n = state.syncPending;
  return `<span class="offline-pill" role="status" title="${n ? `${n} change${n !== 1 ? 's' : ''} will sync when you're online` : 'Everything you saved works offline'}">${icon('cloud-off')}<span>Offline</span></span>`;
}

// A guest who loses the connection: a friendly card, once per drop.
function guestOfflineCardHtml() {
  if (!state.guestOfflineCard || accountOn()) return '';
  return `
    <div class="card offline-card" role="status">
      <div class="tip-title">You're offline</div>
      <div class="tip-body">You can keep playing here. To open the app offline any time, create a free account; it takes seconds.</div>
      <div class="set-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-action="offline-remind">Remind me when I'm back online</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="offline-card-ok">OK</button>
      </div>
    </div>`;
}

// The pill and card change without a full render (they don't move focus).
function refreshStatusUi() {
  const right = document.querySelector('.appbar-right');
  if (right) {
    right.querySelector('.offline-pill')?.remove();
    const pill = offlinePillHtml();
    if (pill) right.insertAdjacentHTML('afterbegin', pill);
  }
  document.querySelector('.offline-card')?.remove();
  const card = guestOfflineCardHtml();
  if (card) document.getElementById('app')?.insertAdjacentHTML('beforeend', card);
}

window.addEventListener('offline', () => {
  state.isOffline = true;
  if (!accountOn()) { state.guestOfflineCard = true; logEvent('guest_offline', { step: 'shown' }); }
  else if (!_offlineSessionLogged) { _offlineSessionLogged = true; logEvent('offline_session'); }
  refreshStatusUi();
});
window.addEventListener('online', () => {
  state.isOffline = false;
  state.guestOfflineCard = false;
  refreshStatusUi();
  if (state.remindSignup && !accountOn()) { state.remindSignup = false; openSaveSheet('offline'); }
  syncSoon(0);
});
let _offlineSessionLogged = false;

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

// ── Bootstrap ────────────────────────────────────────────────────────────────
loadPrefs();
refreshInstruments();
state.isOffline = navigator.onLine === false;
// Guests never keep a service worker (§4): one left from the old version,
// or from a sign-out in another tab, is removed.
if (!accountOn()) offline.disable();
if (urlIsLink()) loadFromUrl();
else openStartView();
render();

// Pre-warm AudioContext on the very first user touch.
// Both pointerdown and touchstart are registered: iOS Chrome (WKWebView) requires
// a user-gesture-initiated ctx.resume(); touchstart is the historically reliable
// trigger on older iOS while pointerdown covers desktop and modern iOS.
// initAudio() is idempotent so firing both for the same touch is harmless.
initSupabase(handleLogin);
// An account works offline before (or without) its session coming back.
if (accountOn()) startAccount();
measureOpen();

// The Content-Security-Policy is report-only for now (vercel.json): what it
// would have blocked is counted here, by directive and host only, so the
// policy can be enforced once this stays quiet.
const _cspSeen = new Set();
document.addEventListener('securitypolicyviolation', e => {
  let host = e.blockedURI || '';
  try { host = new URL(host).host || host; } catch { /* 'inline', 'eval', 'data' */ }
  const key = `${e.effectiveDirective}|${host}`;
  if (_cspSeen.has(key) || _cspSeen.size >= 10) return;
  _cspSeen.add(key);
  logEvent('csp_violation', { directive: e.effectiveDirective, host: String(host).slice(0, 80), enforced: e.disposition === 'enforce' });
});

// Sync when the user brings the app back to the foreground (tab switch, PWA resume).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && state.tuner.on) toggleTuner();
  if (document.visibilityState === 'visible') syncSoon(0);
});

document.addEventListener('pointerdown', () => initAudio(), { once: true });
document.addEventListener('touchstart', () => initAudio(), { once: true, passive: true });

// Every tap first picks the sound for whatever it may play (capture phase,
// so it runs before the handlers below).
document.addEventListener('click', () => setVoice(voiceForState()), true);

// ── Click: Ocarina Notes view ─────────────────────────────────────────────
registerActions({
  'oc-select-note': (el, e, action) => {
    const m = parseInt(el.dataset.midi, 10);
    if (m !== state.oc.selected) { state.oc.previous = state.oc.selected; state.oc.selected = m; }
    initAudio();
    playNote(midiToNoteName(m));
    render();
    return;
  },
  'oc-play-selected': (el, e, action) => {
    initAudio();
    playNote(midiToNoteName(state.oc.selected));
    return;
  },
  'oc-play-scale': (el, e, action) => {
    const inst = currentInstrument();
    if (!inst) return;
    const pcs = state.oc.scaleFilter !== 'All' ? scalePitchClasses(state.oc.scaleFilter) : null;
    const notes = playableMidis(inst).filter(m => !pcs || pcs.has(((m % 12) + 12) % 12)).map(midiToNoteName);
    playScale(notes, n => {
      const m = noteToMidi(n);
      if (state.view !== 'instrument') return;
      state.oc.previous = state.oc.selected;
      state.oc.selected = m;
      render();
    });
    return;
  },
  'oc-toggle-fingers': (el, e, action) => {
    state.showFingers = !state.showFingers;
    // The finger legend opens by itself the first time labels are switched on.
    if (state.showFingers && !state.handLegendSeen) { state.handLegendSeen = true; state.oc.handLegend = true; }
    savePrefs(); render(); return;
  },
  'oc-toggle-sizes': (el, e, action) => { state.showSizes = !state.showSizes; savePrefs(); render(); return; },
  'toggle-closeup': (el, e, action) => { state.closeUp = !state.closeUp; savePrefs(); render(); return; },
  'oc-legend-dismiss': (el, e, action) => { state.ocLegendSeen = true; savePrefs(); render(); return; },
  'oc-hand-open': (el, e, action) => { state.oc.handLegend = true; state.oc.chordMore = false; render(); return; },
  'oc-hand-close': (el, e, action) => { state.oc.handLegend = false; render(); return; },
  'tuner-toggle': (el, e, action) => { toggleTuner(); return; },
  'install-app': (el, e, action) => {
    if (_installEvent) {
      const ev = _installEvent;
      _installEvent = null;
      ev.prompt();
      ev.userChoice?.then(c => { logEvent('install', { outcome: c?.outcome ?? 'unknown' }); render(); });
    } else {
      state.installHelp = true;
      logEvent('install', { outcome: 'help' });
      render();
    }
    return;
  },
  'install-help-close': (el, e, action) => { state.installHelp = false; render(); return; },
  'help-close': (el, e, action) => { state.help = null; render(); return; },
  'help-open': (el, e, action) => {
    // A row or link names the article; the menu's row asks for this screen's; '' is the list.
    const id = el.dataset.id ?? HELP_SCREENS[helpScreenKey()];
    state.help = { id: id || null };
    logEvent('help', { article: id || 'index' });
    render();
    const top = el.dataset.anchor ? document.getElementById(`help-${el.dataset.anchor}`) : document.querySelector('.sheet-root[data-sheet="help"] .sheet-body');
    if (el.dataset.anchor) top?.scrollIntoView(); else if (top) top.scrollTop = 0;
    return;
  },
  'install-dismiss': (el, e, action) => {
    try { localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch {}
    render();
    return;
  },
  'share-instrument': (el, e, action) => { shareInstrument(el.dataset.id); return; },
  'share-close': (el, e, action) => { state.shareModal = null; render(); return; },
  'link-sheet-close': (el, e, action) => { state.linkSheet = null; render(); return; },
  'share-copy': (el, e, action) => {
    navigator.clipboard?.writeText(state.shareModal?.url ?? state.linkSheet?.url ?? '').then(() => showToast('Link copied'), () => showToast('Copy the link from the box'));
    return;
  },
  'shared-add': (el, e, action) => {
    if (!state.shared) return;
    // A visiting chart instrument (a deep link) is made afresh; a shared
    // one is copied with its setup.
    const copy = state.shared.link ? instrumentFromChart(state.shared.link.chartId, state.shared.link.keyId, { name: state.shared.name }) : copySharedInstrument(state.shared);
    saveInstrument(copy);
    refreshInstruments();
    state.shared = null;
    openInstrument(copy.id);
    showToast(`${copy.name} added to My instruments`);
    render();
    return;
  },
});

// ── Click: Ocarina Chords view and practice ───────────────────────────────
registerActions({
  'oc-tab': (el, e, action) => {
    state.oc.tab = el.dataset.tab;
    state.oc.practice = null;
    navReplace(instUrl(state.currentInstrumentId, state.oc.tab));
    render();
    return;
  },
  'oc-chord-select': (el, e, action) => {
    if (e.target.closest('.row-trail button')) return;
    // Like a handpan chord: pick it, and hear it.
    state.oc.expanded = el.dataset.key;
    state.oc.chordStep = {};
    const list = document.querySelector('.chord-list');
    const saved = list?.scrollTop ?? 0;
    render();
    const again = document.querySelector('.chord-list');
    if (again) again.scrollTop = saved;
    document.querySelector('.oc-stage [data-action="oc-play-arp"]')?.click();
    return;
  },
  'oc-more-open': (el, e, action) => { state.oc.chordMore = true; render(); return; },
  'oc-filters-open': (el, e, action) => { state.oc.filtersOpen = true; render(); return; },
  'oc-filters-close': (el, e, action) => { state.oc.filtersOpen = false; render(); return; },
  'oc-filter-root': (el, e, action) => { state.oc.root = el.dataset.root; render(); return; },
  'oc-toggle-count': (el, e, action) => {
    const set = new Set(state.oc.counts ?? []);
    if (set.has(el.dataset.count)) set.delete(el.dataset.count); else set.add(el.dataset.count);
    state.oc.counts = [...set];
    render();
    return;
  },
  'oc-more-close': (el, e, action) => { state.oc.chordMore = false; render(); return; },
  'oc-missing-toggle': (el, e, action) => {
    // The <details> opens by itself; remember it across re-renders.
    state.oc.missingOpen = !el.closest('details').open;
    return;
  },
  'oc-filters-clear': (el, e, action) => {
    // The sheet's filters; the empty list's "Clear filters" also clears the root.
    Object.assign(state.oc, { scaleFilter: 'All', category: 'All', counts: [] });
    if (el.dataset.all) state.oc.root = 'All';
    render();
    return;
  },
  'oc-play-arp, oc-voicing, oc-show-playlist-picker': (el, e, action) => {
    e.stopPropagation();
    const inst = ocCardInstrument(el.dataset.key);
    if (!inst) return;
    const key = el.dataset.key;
    const card = ocCardData(inst, key);
    if (!card) return;
    if (action === 'oc-play-arp') {
      const names = card.midis.map(midiToNoteName);
      const rootName = names.find(n => notePC(n) === card.rootPC) ?? names[0];
      const seq = arpeggioOrder(names, rootName).map(midiToNoteName);
      playSequence(seq, (n, i) => ocHighlightStep(key, i, i === seq.length - 1));
      return;
    }
    if (action === 'oc-voicing') {
      const m = parseInt(el.dataset.midi, 10);
      const voiced = nextVoicing(inst, card.midis, m);
      if (voiced.join() === card.midis.join()) { showToast('No other octave of this note on the instrument'); return; }
      state.oc.voicings[key] = voiced;
      playNote(midiToNoteName(voiced.find(x => !card.midis.includes(x)) ?? m));
      render();
      return;
    }
    // Playlist picker, reusing the handpan one. Someone's instrument shared
    // by code is read-only: its chords go into playlists once it's added.
    if (inst.id === SHARED_ID && !inst.link) { showToast('Add it to My instruments to keep its chords'); return; }
    const names = card.midis.map(midiToNoteName);
    state.pickerChordFavId = card.entry
      ? (card.midis.join() === card.entry.notes.map(noteToMidi).join() ? card.entry.id : ocFavId(inst, card.chordId, names, null))
      : ocFavId(inst, card.chordId, names, card.canonical);
    state.pickerChordObj = {
      id: card.chordId, rootName: card.rootName, notes: names, noteCount: names.length,
      type: { name: card.typeName, category: card.category },
    };
    state.pickerNewPlaylist = false;
    state.pickerInstrumentId = inst.id;
    render();
    return;
  },
  'oc-step': (el, e, action) => {
    initAudio();
    playNote(midiToNoteName(parseInt(el.dataset.midi, 10)));
    ocHighlightStep(el.dataset.key, parseInt(el.dataset.i, 10), true);
    return;
  },
  'oc-play-note': (el, e, action) => {
    initAudio();
    playNote(midiToNoteName(parseInt(el.dataset.midi, 10)));
    const stage = el.closest('.oc-pstage');
    if (stage) ocHighlightStep(stage.closest('.oc-player').dataset.key, parseInt(stage.dataset.i, 10), true);
    return;
  },
  'oc-play-pair': (el, e, action) => {
    initAudio();
    playNote(midiToNoteName(parseInt(el.dataset.a, 10)));
    playNote(midiToNoteName(parseInt(el.dataset.b, 10)));
    return;
  },
  'oc-practice-start': (el, e, action) => {
    if (el.dataset.id) state.oc.playlistId = el.dataset.id;
    state.oc.practice = { playlistId: state.oc.playlistId, idx: 0 };
    playPracticeStep();
    render();
    return;
  },
  'oc-practice-stop': (el, e, action) => { state.oc.practice = null; render(); return; },
  'oc-practice-restart': (el, e, action) => {
    if (!state.oc.practice) return;
    state.oc.practice.idx = 0;
    state.tuner.lastAdvance = performance.now();
    playPracticeStep();
    render();
    return;
  },
  'oc-practice-next, oc-practice-prev': (el, e, action) => {
    const src = practiceSource(currentInstrument());
    if (!src) return;
    const n = practiceSteps(src.entries).length;
    state.oc.practice.idx = (state.oc.practice.idx + (action === 'oc-practice-next' ? 1 : n - 1)) % n;
    state.tuner.lastAdvance = performance.now();
    playPracticeStep();
    render();
    return;
  },
});

// ── Change: Ocarina chords ────────────────────────────────────────────────
registerActions({
  'oc-scale-filter': (el, e, action) => { state.oc.scaleFilter = el.value; state.oc.voicings = {}; render(); },
  'oc-category': (el, e, action) => { state.oc.category = el.value; render(); },
}, CHANGE_ACTIONS);

// ── Global click delegation ───────────────────────────────────────────────────
document.addEventListener('click', e => {
  // ── Pan note click — must be checked BEFORE the data-action early return ──
  const noteEl = e.target.closest('.pan-note');
  // The guided setup: tapping a place says "this is the one I'm playing".
  if (noteEl && state.view === 'setup' && state.setup?.guide && noteEl.closest('.setup-guide-pan')) {
    const id = noteEl.dataset.noteId;
    const g = state.setup.guide;
    const i = id === 'ding' ? 0 : id?.startsWith('ring-') ? parseInt(id.slice(5), 10) + 1 : id?.startsWith('gu-') ? g.count + parseInt(id.slice(3), 10) : -1;
    if (i >= 0 && i < guideTotal(g)) {
      g.active = i;
      Object.assign(g, { msg: g.notes[i] != null ? `Play ${setupSlotLabel(state.setup.family, i)} again to change it.` : '', tone: '' });
      render();
    }
    return;
  }
  if (noteEl && edArranging() && noteEl.closest('.ed-pan')) return; // moving, not editing
  if (noteEl && state.layout) {
    const noteId = noteEl.dataset.noteId;
    const isEmpty = noteEl.classList.contains('empty');
    const isCustom = state.layout.isCustom;

    if (!isEmpty) {
      const noteToPlay = noteEl.dataset.note;
      if (noteToPlay) {
        initAudio();
        playNote(noteToPlay);
        setTimeout(() => updatePanPlaying([noteToPlay]), 0);
      }
    }

    if (state.view !== 'editor') return;
    if (!isCustom) return;

    if (isEmpty) {
      if (noteId === 'ding') state.pendingSlot = { shell: 'ding', index: -1 };
      else if (noteId?.startsWith('ring-')) state.pendingSlot = { shell: 'top', index: parseInt(noteId.split('-')[1]) };
      else if (noteId?.startsWith('gu-')) state.pendingSlot = { shell: 'bottom', index: parseInt(noteId.split('-')[1]) };
      render();
      return;
    }

    if (noteId === 'ding') { state.pendingSlot = { shell: 'ding', index: -1 }; render(); return; }
    if (noteId?.startsWith('ring-') && (state.shellMode === 'top' || state.shellMode === 'both')) {
      const idx = parseInt(noteId.split('-')[1]);
      state.layout.top.slots[idx].note = null;
      state.chords = findAllChords(state.layout);
      render();
      return;
    }
    if (noteId?.startsWith('gu-') && (state.shellMode === 'bottom' || state.shellMode === 'both')) {
      const idx = parseInt(noteId.split('-')[1]);
      if (state.layout.bottom.slots[idx]) { state.layout.bottom.slots[idx].note = null; state.chords = findAllChords(state.layout); render(); }
      return;
    }
    return;
  }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  measureFeature(action, el);
  // The save moment (§3): a guest's save opens the save sheet instead, and
  // the tap is completed after sign-in.
  const saveWhat = saveIntentFor(action, { guest: !accountOn() });
  if (saveWhat) { guestSave({ what: saveWhat, action, data: plainDataset(el.dataset) }); return; }
  if (el.matches('.tab[aria-selected="true"]')) return; // already on that tab
  if (!el.closest('.sheet-root')) _lastTrigger = focusKeyOf(el);
  // The actions each screen registers (js/app/actions.js). These come before
  // the steps below that close a sheet when one of its rows is tapped.
  if (runAction(action, el, e, EARLY_ACTIONS)) return;
  if (makerClick(action, el)) return; // makers and "Made by" (js/makers-ui.js)
  // A menu row closes the menu, then does what it says.
  if (state.menu && el.closest('.sheet-menu, .sheet-rowmenu')) { state.menu = false; render(); }
  if (state.hpMore && el.closest('.sheet-hpmore') && action !== 'hp-more-close') { state.hpMore = false; render(); }
  if (state.plRowMenu != null && el.closest('.sheet-plrow') && action !== 'pl-row-close') { state.plRowMenu = null; render(); }
  if (state.progRowMenu != null && el.closest('.sheet-progrow') && action !== 'prog-row-close') { state.progRowMenu = null; render(); }
  if (runAction(action, el, e)) return;
  // Screens that handle a group of actions in one function.
  if (songAction(action, el)) return;
  if (listenReportAction(action)) return;
  if (goesWithAction(action, el)) return;
  if (setupAction(action, el)) return;
  if (saveSheetAction(action, el)) return;
  if (accountAction(action)) return;
});

// ── Pan note clicks (Discover mode note-picking + voicing swap) ────────────────
// Pan circles are plain SVG, not [data-action] elements, so they get their own
// delegation rather than going through the action router above.
document.addEventListener('click', e => {
  const noteEl = e.target.closest('.pan-note');
  if (!noteEl || state.view !== 'chords') return;
  const note = noteEl.dataset.note;
  if (!note) return; // empty slot

  if (state.discoverMode) {
    const idx = state.discoverNotes.indexOf(note);
    if (idx >= 0) state.discoverNotes.splice(idx, 1);
    else state.discoverNotes.push(note);
    render();
    initAudio();
    playNote(note);
    return;
  }

  if (noteEl.classList.contains('alt-highlight') && state.selectedChord) {
    stopAutoplay();
    state.selectedChord = swapChordNoteVoicing(state.selectedChord, note);
    navReplace(stateToHash());
    render();
    initAudio();
    playNote(note);
  }
});

// ── Change delegation (selects) ───────────────────────────────────────────────
document.addEventListener('change', e => {
  if (makerChange(e.target)) return; // the maker profile form (js/makers-ui.js)
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action } = el.dataset;
  runAction(action, el, e, CHANGE_ACTIONS);
});

// ── Input delegation ──────────────────────────────────────────────────────────
document.addEventListener('input', e => {
  if (makerInput(e.target)) return; // the maker profile form (js/makers-ui.js)
  if (e.target.classList?.contains('tempo-slider')) { setTempo(e.target.value); return; }
  if (e.target.classList?.contains('ld-slider')) {
    const L = listenUi();
    const key = e.target.dataset.key;
    L.tune[key] = parseFloat(e.target.value);
    const v = document.getElementById(`ld-v-${key}`);
    if (v) v.textContent = e.target.value;
    _listenTrack = listenTracker(L.tune);   // the chroma side reads L.tune live
    return;
  }
  if (e.target.classList?.contains('crop-zoom') && state.photoCrop) {
    state.photoCrop.zoom = parseFloat(e.target.value) || 1;
    layoutCrop();
    return;
  }
  if (e.target.id === 'scale-search-input') {
    state.scaleSearch = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const input = document.getElementById('scale-search-input');
    if (input) { input.focus(); input.setSelectionRange(pos, pos); }
    return;
  }
  if (e.target.id === 'wizard-search-input' && state.wizard) {
    state.wizard.search = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const input = document.getElementById('wizard-search-input');
    if (input) { input.focus(); input.setSelectionRange(pos, pos); }
    return;
  }
  if (e.target.id === 'wizard-fl-name' && state.wizard) {
    state.wizard.fl.name = e.target.value;
    return;
  }
  if (e.target.id === 'wizard-oc-name' && state.wizard) {
    state.wizard.oc.name = e.target.value;
    return;
  }
  if (e.target.id === 'custom-name-input' && state.layout) {
    state.layout.name = e.target.value;
    const barName = document.querySelector('.appbar-switcher-name');
    if (barName) barName.textContent = e.target.value;
    const actions = document.querySelector('.ed-actions');
    if (actions) actions.innerHTML = edActionsHtml();
  }
  if (e.target.id === 'pl-name-input' && state.plName) { state.plName.value = e.target.value; return; }
  if (e.target.id === 'cs-text' && state.chordSheet) {
    state.chordSheet.text = e.target.value;
    if (state.chordSheet.error) { // the error goes once there's something new to read
      state.chordSheet.error = '';
      const field = e.target.closest('.field');
      field?.classList.remove('has-error');
      field?.querySelector('.field-error')?.remove();
    }
    return;
  }
  if (e.target.id === 'cs-name' && state.chordSheet) { state.chordSheet.name = e.target.value; return; }
  if (e.target.id === 'clay-name-input' && state.clayEdit) { state.clayEdit.name = e.target.value; return; }
  if (e.target.id === 'clay-pct-input' && state.clayEdit) { state.clayEdit.pct = e.target.value; return; }
  if (e.target.id === 'save-email-input' && state.saveSheet) {
    state.saveSheet.email = e.target.value;
    state.authEmail = e.target.value;
  }
  if (e.target.id === 'save-code-input') {
    state.authCode = e.target.value.replace(/\D/g, '').slice(0, 8);
    e.target.value = state.authCode;
    if (state.authCode.length === 8) {
      document.querySelector('[data-action="save-verify"]')?.click();
    }
  }
});

document.addEventListener('keydown', e => {
  // Rows that hold buttons of their own are divs with role=button: let the
  // keyboard activate them like real buttons.
  // A note of the pan, drum or kalimba picture (js/pan.js): Enter or Space
  // is a tap on it.
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.pan-note[role="button"]')) {
    e.preventDefault();
    e.target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"][data-action]')) {
    e.preventDefault();
    e.target.click();
    return;
  }
  const enterAction = { 'save-email-input': 'save-send-code', 'save-code-input': 'save-verify', 'account-delete-input': 'account-delete-ok', 'clay-name-input': 'clay-save', 'clay-pct-input': 'clay-save', 'pl-name-input': 'pl-name-save', 'cs-name': 'cs-save' }[e.target.id];
  if (e.key === 'Enter' && enterAction) {
    e.preventDefault();
    document.querySelector(`[data-action="${enterAction}"]`)?.click();
    return;
  }
  if (e.key === 'Enter' && e.target.id === 'new-progression-input') {
    e.preventDefault();
    document.querySelector('[data-action="confirm-new-progression"]')?.click();
  }
  if (e.key === 'Enter' && e.target.id === 'new-playlist-input') {
    // preventDefault: focus moves back to the heart button as the sheet
    // closes, and Enter's default action would press it again.
    e.preventDefault();
    document.querySelector('[data-action="confirm-new-playlist"]')?.click();
  }
  const sheet = document.querySelector('.sheet-root .sheet');
  if (!sheet) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    sheet.querySelector('[data-sheet-close]')?.click();
    return;
  }
  if (e.key === 'Tab') {
    const items = [...sheet.querySelectorAll('button:not([disabled]), input, select, textarea, [tabindex="0"]')]
      .filter(x => x.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0], last = items[items.length - 1];
    if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// ── Browser back/forward ──────────────────────────────────────────────────────
window.addEventListener('popstate', () => {
  Object.assign(state, {
    view: 'home', layout: null, selectedChord: null,
    pendingSlot: null, chords: [], shellMode: 'both',
    chordFilter: { category: 'All', root: 'All', playlist: 'All' },
    currentInstrumentId: null, wizard: null, chordSheet: null,
  });
  refreshInstruments();
  if (urlIsLink()) loadFromUrl();
  else state.view = state.instruments.length ? 'home' : 'play';
  const hpTab = history.state?.hpTab;
  if ((hpTab === 'playlists' || hpTab === 'songs') && state.layout && (state.view === 'editor' || state.view === 'chords')) state.view = hpTab === 'songs' ? 'hp-songs' : 'hp-playlists';
  render();
});
