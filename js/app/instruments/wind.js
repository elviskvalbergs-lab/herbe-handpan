// Ocarina, flute and recorder: the instrument screen, Chords, Practice.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { NOTE_NAMES, createLayoutFromScale, displayNote, notePC, noteToMidi } from '../../data.js';
import { HELP_SCREENS } from '../../features.js';
import { icon } from '../../icons.js';
import { findAllChords, identifyChord, mainChordsInKey } from '../../chords.js';
import { playablePairs } from '../../ocarina.js';
import { instrumentFromChart } from '../../charts.js';
import { findTuning, layoutInstrument } from '../../layoutfamilies.js';
import { linkFor, linkTitle, parseLink } from '../../links.js';
import { copySharedInstrument, getInstrument, getInstruments, instrumentStatus, midiToNoteName, saveInstrument, usesLayout, windWord } from '../../instruments.js';
import { initAudio, playNote, playScale, playSequence, setVoice } from '../../audio.js';
import { arpeggioOrder, fingeringFor, fingeringMoves, fitChordToInstrument, nextVoicing, ocarinaToLayout, playableMidis, renderFingering, renderHandLegend } from '../../ocarina-ui.js';
import { isChordBookmarkedAnyVoicing } from '../../storage.js';
import { logEvent } from '../../auth.js';

// State of the ocarina / flute views; reset when switching instrument.
function newOcState() {
  return {
    tab: 'chords', selected: null, previous: null, scaleFilter: 'All', handLegend: false,
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
// A chord found by Tap notes (idx -1: the notes tapped, no known chord).
function ocIdChord(idx) {
  const names = (state.oc.idNotes ?? []).map(midiToNoteName); // in the order ocIdentifyParts reads them
  if (names.length < 2) return null;
  if (idx >= 0) return identifyChord(names)[idx] ?? null;
  return { id: 'custom', rootName: getNoteName(names[0]), rootNote: names[0], type: { name: 'Custom', category: 'Custom' }, notes: names };
}
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
  // Each chord found can be saved to a playlist and played (its notes in
  // turn), as on a handpan; one this instrument lists also opens.
  const trail = (saved, data) => `${chordSaveBtn(saved, { action: 'oc-id-bookmark', data })}${uiIconBtn('play', 'Play chord', { action: 'oc-id-chord-play', data })}`;
  const list = picked.length < 2 ? '<p class="hp-hint">Select 2 or more notes to identify a chord.</p>'
    : !matches.length ? `<div class="list">${uiRow({ title: 'Custom combination', meta: `Not a recognized chord type · ${picked.length} notes`, trail: trail(false, { 'match-idx': -1 }) })}</div>`
    : `<div class="list">${matches.map((m, idx) => uiRow({
      title: `${displayNote(m.rootName, uf, us)} ${escHtml(m.type.name)}`,
      meta: `${escHtml(m.type.category)} · ${m.notes.map(n => escHtml(displayNote(n, uf, us))).join(', ')}`,
      trail: trail(isChordBookmarkedAnyVoicing(ocLayoutId(inst), m.id), { 'match-idx': idx }),
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
    help: uiHelp('chords', 'filters'), key: 'oc-filters', close: 'oc-filters-close', clear: 'oc-filters-clear',
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
    help: uiHelp('chords', 'more'), key: 'oc-more', title: `${displayNote(card.rootName, uf, us)} ${card.typeName}`, close: 'oc-more-close',
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
    help: uiHelp('fingerings', 'fingers'), key: 'hand', title: 'Which finger is which', close: 'oc-hand-close',
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
            <span>${legendHole('c')} covered</span><span>${legendHole('o')} open</span><span>${legendHole('h')} half</span>${uiHelp('fingerings', 'read')}
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

// ── Click: Tap notes and Listen on an ocarina, flute or recorder ──
registerActions({
  'listen-oc-note': (el, e, action) => {
    listenUi().ocNote = parseInt(el.dataset.midi, 10);
    initAudio();
    playNote(midiToNoteName(listenUi().ocNote));
    render();
    return;
  },
  'oc-listen-mode': (el, e, action) => {
    const want = el.dataset.value;
    const now = state.oc.listen ? 'listen' : state.oc.identify ? 'identify' : 'browse';
    if (want === now) return;
    state.oc.listen = want === 'listen';
    state.oc.identify = want === 'identify';
    state.oc.idNotes = [];
    render();
    return;
  },
  'oc-id-note': (el, e, action) => {
    const m = parseInt(el.dataset.midi, 10);
    const list = state.oc.idNotes ?? (state.oc.idNotes = []);
    const i = list.indexOf(m);
    if (i >= 0) list.splice(i, 1); else list.push(m);
    if (i < 0) { initAudio(); playNote(midiToNoteName(m)); }
    render();
    return;
  },
  'oc-id-clear': (el, e, action) => { state.oc.idNotes = []; render(); return; },
  'oc-id-play': (el, e, action) => {
    const names = [...(state.oc.idNotes ?? [])].sort((a, b) => a - b).map(midiToNoteName);
    if (names.length >= 2) { initAudio(); playSequence(names, () => {}, 0.55); }
    return;
  },
  'oc-id-bookmark, oc-id-chord-play': (el, e, action) => {
    const chord = ocIdChord(parseInt(el.dataset.matchIdx, 10));
    const inst = currentInstrument();
    if (!chord || !inst) return;
    const names = chord.notes;
    if (action === 'oc-id-chord-play') {
      initAudio();
      const root = names.find(n => notePC(n) === notePC(chord.rootNote ?? names[0])) ?? names[0];
      const seq = arpeggioOrder(names, root).map(midiToNoteName);
      playSequence(seq, () => {});
      return;
    }
    // Into a playlist, as the chord's own ♡ does (ocarina, flute, recorder).
    if (inst.id === SHARED_ID && !inst.link) { showToast('Add it to My instruments to keep its chords'); return; }
    state.pickerChordFavId = ocFavId(inst, chord.id, names, chord.id === 'custom' ? null : chord.notes);
    state.pickerChordObj = { id: chord.id, rootName: chord.rootName, notes: names, noteCount: names.length, type: { name: chord.type.name, category: chord.type.category } };
    state.pickerNewPlaylist = false;
    state.pickerInstrumentId = inst.id;
    render();
    return;
  },
  'oc-id-open': (el, e, action) => {
    // The chord found, in Browse: its fingerings in playing order, playlists, octaves.
    Object.assign(state.oc, { identify: false, idNotes: [], expanded: el.dataset.id, root: 'All', category: 'All', scaleFilter: 'All', counts: [] });
    render();
    return;
  },
});
