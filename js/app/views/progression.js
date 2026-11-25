// The progression screen.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { displayNote, noteToMidi } from '../../data.js';
import { icon } from '../../icons.js';
import { PLAY_LEVELS, WIND_PLAY_LEVELS, strikeNumbers, windPlayLevel } from '../../chordsheet.js';
import { initAudio, playSequence } from '../../audio.js';
import { renderPan } from '../../pan.js';
import { playableMidis } from '../../ocarina-ui.js';
import { PROG_LIMITS, addProgression, addStepToProgression, deleteProgression, duplicateProgressionStep, getFavorites, getPlaylists, getProgressions, moveProgressionStep, newProgressionStep, nextProgressionStep, progressionLevel, progressionTotals, removeChordFromPlaylist, removeProgressionStep, reorderChordInPlaylist, setProgressionLevel, setProgressionStepBars, setProgressionTiming } from '../../storage.js';
import { scheduleSave } from '../../auth.js';

// ── The screen ──
// A step's length: "2 bars", or "2 beats" for part of a bar.
function progStepLenText(s) {
  if (s.beats != null) return `${s.beats} beat${s.beats !== 1 ? 's' : ''}`;
  return `${s.bars} bar${s.bars !== 1 ? 's' : ''}`;
}

function progStepRow(s, idx, { here, current, last }) {
  const uf = state.useFlats, us = state.useSolfege;
  const no = idx + 1;
  const sec = s.section ? `${escHtml(s.section)} · ` : '';
  return `
    <div class="row prog-step${current ? ' is-current' : ''}${here ? '' : ' is-other'}${s.missing ? ' is-missing' : ''}" role="button" tabindex="0" data-action="prog-step-tap" data-idx="${idx}">
      <span class="row-lead tile prog-num"><span class="sr-only">Step </span>${no}</span>
      <span class="row-title prog-step-title">${escHtml(progStepTitle(s))}</span>
      <span class="prog-step-meta">
        ${s.missing
          ? `<span class="row-meta">${sec}<span class="prog-missing">Not on ${escHtml(s.scaleName ?? 'this instrument')}</span></span>`
          : `<span class="row-meta">${sec}${escHtml(s.notes.map(n => displayNote(n, uf, us)).join(' · '))}</span>
        ${here ? '' : `<span class="row-meta">${escHtml(s.scaleName ?? '')} · skipped here</span>`}`}
      </span>
      <span class="prog-bars" role="group" aria-label="Bars for step ${no}">
        ${uiIconBtn('minus', `Fewer bars (step ${no})`, { action: 'prog-step-bars', data: { idx, delta: -1 }, cls: 'tonal', disabled: s.bars <= PROG_LIMITS.bars[0] })}
        <span class="prog-bars-val">${progStepLenText(s)}</span>
        ${uiIconBtn('plus', `More bars (step ${no})`, { action: 'prog-step-bars', data: { idx, delta: 1 }, cls: 'tonal', disabled: s.bars >= PROG_LIMITS.bars[1] })}
      </span>
      <span class="row-trail">${uiIconBtn('ellipsis', `Chord ${no}: duplicate, move or remove`, { action: 'prog-row-menu', data: { idx }, attrs: 'aria-haspopup="dialog"' })}</span>
    </div>`;
}

function progFmtLength(ms) {
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function viewProgression() {
  const prog = progFind();
  if (!prog) return viewHome();
  const uf = state.useFlats, us = state.useSolfege;
  const ctx = progContext(prog);
  const isHere = ctx ? ctx.isHere : () => false;
  const nHere = prog.steps.filter(isHere).length;
  const curIdx = progCurrentIdx(prog);
  const cur = curIdx >= 0 ? prog.steps[curIdx] : null;
  const playing = !!(state.progPlay?.playing && state.progPlay.id === prog.id);
  const order = state.progMode === 'order';
  const last = prog.steps.length - 1;
  const tot = progressionTotals(prog, ctx && nHere ? isHere : undefined);

  // Player: the pan with the step on it (handpan), or Practice (ocarina).
  let player = '';
  if (prog.steps.length === 0) {
    player = ''; // the empty state below says how to add steps
  } else if (ctx && !nHere) {
    player = `<p class="prog-now-hint">None of these chords is on ${escHtml(ctx.name)}. Open it on an instrument that has them.</p>`;
  } else if (ctx?.kind === 'hp' && !ctx.load) {
    const level = progressionLevel(prog);
    const shown = cur && isHere(cur);
    const panOpts = {
      shellMode: 'both', highlightNotes: shown ? cur.notes : [], altHighlightNotes: [],
      rotated: state.ringRotated, useFlats: uf, useSolfege: us,
    };
    let patternLine = '';
    if (level !== 'chord' && shown) {
      // The pattern's notes numbered in strike order with L/R, the next chord faint.
      const pat = progPattern(prog, curIdx, ctx);
      Object.assign(panOpts, {
        highlightNotes: pat.notes,
        faintNotes: (pat.next ?? []).filter(n => !pat.notes.includes(n)),
        strikeMarks: strikeNumbers(pat.hits, prog.beatsPerBar),
      });
      patternLine = `<div class="prog-now-pattern">${escHtml(progPatternText(pat, prog.beatsPerBar))}</div>`;
    }
    const pan = renderPan(state.layout, panOpts);
    const levelSeg = uiSeg([{ value: 'chord', label: 'Chord' }, ...PLAY_LEVELS.map(l => ({ value: l.id, label: l.name }))],
      level, { action: 'prog-level', label: 'Level' });
    player = `
      <div class="prog-player">
        <div class="pan-wrap prog-pan">${panRotateBtn()}${pan}</div>
        <div class="prog-now" aria-live="polite">
          ${shown ? `
            <div class="prog-now-text">
              <div class="prog-now-title">${escHtml(progStepTitle(cur))}</div>
              <div class="prog-now-meta">Chord ${curIdx + 1} of ${prog.steps.length}${cur.section ? ` · ${escHtml(cur.section)}` : ''} · ${escHtml((level !== 'chord' ? panOpts.highlightNotes : cur.notes).map(n => displayNote(n, uf, us)).join(' · '))}</div>
              ${patternLine}
            </div>
            ${playing ? `<div class="prog-beat">${progBeatHtml(prog, cur)}</div>` : ''}`
          : `<div class="prog-now-hint">${level === 'chord' ? 'Play runs the chords in order, in time. Tap a chord to hear it.' : 'Play counts in one bar, then shows each chord numbered in strike order with L and R hands, the next chord faint. Tap a chord to see it.'}</div>`}
        </div>
        <div class="prog-level">${levelSeg}</div>
        <div class="prog-play-row">
          ${uiIconBtn('rewind', 'Back to the first chord', { action: 'prog-restart', cls: 'btn-lg', disabled: !nHere || curIdx <= 0 })}
          ${playing
            ? `<button type="button" class="btn btn-secondary btn-lg btn-block" data-action="prog-stop">${icon('square')} Stop</button>`
            : `<button type="button" class="btn btn-primary btn-lg btn-block" data-action="prog-play" ${nHere ? '' : 'disabled'}>${icon('play')} ${curIdx > 0 ? 'Play from here' : 'Play'}</button>`}
        </div>
      </div>`;
  } else if (ctx?.kind === 'hp') {
    player = `<div class="prog-player"><button type="button" class="btn btn-primary btn-lg btn-block" data-action="prog-play">${icon('play')} Play on ${escHtml(ctx.name)}</button></div>`;
  } else if (ctx?.kind === 'oc') {
    const can = nHere > 0 && playableMidis(ctx.inst).length > 0;
    const practiceBtn = `<button type="button" class="btn btn-ghost btn-block" data-action="prog-practice">Practice chord by chord</button>`;
    if (!can) {
      player = `<div class="prog-player"><p class="prog-now-hint">None of these chords is on ${escHtml(ctx.name)}.</p></div>`;
    } else if (ctx.open) {
      player = `<div class="prog-player"><button type="button" class="btn btn-primary btn-lg btn-block" data-action="prog-play">${icon('play')} Play on ${escHtml(ctx.name)}</button></div>`;
    } else {
      // The same player as the handpan's, one note at a time: the fingering
      // of the note being blown in place of the pan, and the levels that
      // make sense without a whole chord (Roots, Arpeggio, Melody).
      const level = windPlayLevel(progressionLevel(prog));
      const shown = cur && isHere(cur);
      const pat = shown ? progPattern(prog, curIdx, ctx) : null;
      const pp = state.progPlay;
      const midi = !pat?.notes.length ? null : pp?.windMidi != null && pat.notes.some(n => noteToMidi(n) === pp.windMidi) ? pp.windMidi : noteToMidi(pat.notes[0]);
      const levelSeg = uiSeg(WIND_PLAY_LEVELS.map(l => ({ value: l.id, label: l.name })), level, { action: 'prog-level', label: 'Level' });
      player = `
      <div class="prog-player">
        ${midi != null ? `<div class="prog-wind">${progWindFingering(ctx.inst, midi)}</div>` : ''}
        <div class="prog-now" aria-live="polite">
          ${shown ? `
            <div class="prog-now-text">
              <div class="prog-now-title">${escHtml(progStepTitle(cur))}</div>
              <div class="prog-now-meta">Chord ${curIdx + 1} of ${prog.steps.length}${cur.section ? ` · ${escHtml(cur.section)}` : ''} · ${escHtml(pat.notes.map(n => displayNote(n, uf, us)).join(' · '))}</div>
              <div class="prog-now-pattern">${escHtml(progWindPatternText(pat, prog.beatsPerBar))}</div>
            </div>
            ${playing ? `<div class="prog-beat">${progBeatHtml(prog, cur)}</div>` : ''}`
          : `<div class="prog-now-hint">Play counts in one bar, then goes through the chords in time, one note at a time, with the fingering of each note. Tap a chord to hear it.</div>`}
        </div>
        <div class="prog-level">${levelSeg}</div>
        <div class="prog-play-row">
          ${uiIconBtn('rewind', 'Back to the first chord', { action: 'prog-restart', cls: 'btn-lg', disabled: !nHere || curIdx <= 0 })}
          ${playing
            ? `<button type="button" class="btn btn-secondary btn-lg btn-block" data-action="prog-stop">${icon('square')} Stop</button>`
            : `<button type="button" class="btn btn-primary btn-lg btn-block" data-action="prog-play">${icon('play')} ${curIdx > 0 ? 'Play from here' : 'Play'}</button>`}
        </div>
        ${playing ? '' : practiceBtn}
      </div>`;
    }
  }

  const timing = `
    <div class="list prog-timing">
      ${uiSetRow({ label: 'Tempo', help: 'Beats per minute', control: uiStepper({
        value: prog.bpm, label: 'Tempo', action: 'prog-bpm',
        min: prog.bpm <= PROG_LIMITS.bpm[0], max: prog.bpm >= PROG_LIMITS.bpm[1],
      }) })}
      ${uiSetRow({ label: 'Beats per bar', help: 'Time signature', control: uiStepper({
        value: `${prog.beatsPerBar}/4`, label: 'Beats per bar', action: 'prog-beats',
        min: prog.beatsPerBar <= PROG_LIMITS.beatsPerBar[0], max: prog.beatsPerBar >= PROG_LIMITS.beatsPerBar[1],
      }) })}
    </div>
    <p class="prog-summary">${tot.steps} chord${tot.steps !== 1 ? 's' : ''}${ctx && nHere ? ` on ${escHtml(ctx.name)}` : ''} · ${csFmtBars(tot.bars)} · ${progFmtLength(tot.ms)} at ${prog.bpm} BPM</p>`;

  let steps;
  if (prog.steps.length === 0) {
    steps = uiEmpty({
      icon: 'list-ordered', title: 'No chords yet',
      body: 'Tap the bookmark on any chord and pick this playlist. The same chord can go in more than once. Or paste a chord sheet.',
      action: `<div class="empty-actions">
        <button type="button" class="btn btn-secondary" data-action="cs-open" data-prog-id="${escHtml(prog.id)}">${icon('clipboard-paste')} Paste a chord sheet</button>
        ${ctx && !ctx.load && !ctx.open ? '<button type="button" class="btn btn-ghost" data-action="pl-go-chords">Go to Chords</button>' : ''}
      </div>`,
    });
  } else if (order) {
    steps = `<div class="list">${prog.steps.map((s, idx) => uiRow({
      lead: `<span class="tile prog-num"><span class="sr-only">Step </span>${idx + 1}</span>`, title: progStepTitle(s), cls: 'pl-order-row',
      meta: escHtml(s.missing ? `Not on ${s.scaleName ?? 'this instrument'}` : isHere(s) ? s.notes.map(n => displayNote(n, uf, us)).join(' · ') : `${s.scaleName ?? ''} · skipped here`),
      trail: `
        ${uiIconBtn('chevron-up', `Move step ${idx + 1} up`, { action: 'prog-step-up', data: { idx }, disabled: idx === 0 })}
        ${uiIconBtn('chevron-down', `Move step ${idx + 1} down`, { action: 'prog-step-down', data: { idx }, disabled: idx === last })}
        ${uiIconBtn('x', `Remove step ${idx + 1}`, { action: 'prog-step-remove', data: { idx } })}`,
    })).join('')}</div>`;
  } else {
    steps = `<div class="list prog-steps">${prog.steps.map((s, idx) => progStepRow(s, idx, { here: isHere(s), current: idx === curIdx, last })).join('')}</div>`;
  }

  return `
    ${backAppBar(prog.name, { actions: [tunerAppBtn(), menuAppBtn()] })}
    <div class="prog-view${/prog-pan|prog-wind/.test(player) ? ' has-pan' : ''}">
      <div class="prog-side">${player}</div>
      <div class="prog-main">
        ${timing}
        ${prog.steps.length > 1 ? uiSeg([{ value: 'steps', label: 'Chords' }, { value: 'order', label: 'Order' }], state.progMode, { action: 'prog-mode', label: 'Show' }) : ''}
        ${steps}
      </div>
    </div>`;
}

// ⋯ of a step: Duplicate, Move up, Move down, Remove.
function progRowMenuSheet() {
  const prog = progFind();
  const idx = state.progRowMenu;
  const s = prog?.steps[idx];
  if (!s) return '';
  const rows = [
    uiRow({ lead: 'copy', title: 'Duplicate step', meta: 'A copy right after this one', action: 'prog-step-dup', data: { idx } }),
    uiRow({ lead: 'chevron-up', title: 'Move up', action: 'prog-step-up', data: { idx }, cls: idx === 0 ? 'is-disabled' : '' }),
    uiRow({ lead: 'chevron-down', title: 'Move down', action: 'prog-step-down', data: { idx }, cls: idx === prog.steps.length - 1 ? 'is-disabled' : '' }),
    uiRow({ lead: 'trash-2', title: 'Remove step', action: 'prog-step-remove', data: { idx }, cls: 'is-danger' }),
  ].join('');
  return uiSheet({ key: 'prog-row', variant: 'progrow', title: `Chord ${idx + 1} · ${progStepTitle(s)}`, close: 'prog-row-close', body: `<div class="list">${rows}</div>` });
}

// Progressions on the Playlists tab (and Home): a row opens one; on a
// handpan Play opens it and plays, on an ocarina Practice starts.
function progressionRowsHtml(inst, { home = false } = {}) {
  // A playlist shows when this instrument has all its chords (by the notes,
  // progStepOn); the others wait behind "Show …" (listsOtherHtml).
  const hereOf = p => progHereCount(p, inst);
  const isOther = p => p.steps.length > 0 && hereOf(p) < p.steps.filter(st => !st.missing).length;
  const other = home ? 0 : state.progressions.filter(isOther).length;
  const list = home || state.listsShowOther ? state.progressions : state.progressions.filter(p => !isOther(p));
  return list.map(p => {
    const n = p.steps.length;
    if (home) {
      return uiRow({
        lead: 'list-ordered', title: p.name, chevron: true, action: 'open-progression', data: { id: p.id },
        meta: `${n} chord${n !== 1 ? 's' : ''} · ${p.bpm} BPM`,
      });
    }
    const here = hereOf(p);
    const trail = inst
      ? `<button type="button" class="btn btn-primary btn-sm" data-action="prog-practice" data-id="${escHtml(p.id)}" ${here ? '' : 'disabled'}>${icon('play')} Practice</button>`
      : `<button type="button" class="btn btn-primary btn-sm" data-action="prog-play" data-id="${escHtml(p.id)}" ${here ? '' : 'disabled'}>${icon('play')} Play</button>`;
    return uiRow({
      lead: 'list-ordered', title: p.name, chevron: true, action: 'open-progression', data: { id: p.id }, trail,
      meta: `${here === n ? `${n} chord${n !== 1 ? 's' : ''}` : `${here} of ${n} chords here`} · ${p.bpm} BPM`,
    });
  }).join('') + (home ? '' : listsOtherHtml(other, 'playlist'));
}

function openProgression(id, { push = true } = {}) {
  stopAutoplay();
  progStop();
  Object.assign(state, { view: 'progression', activeProgressionId: id, progMode: 'steps', progRowMenu: null, menu: false });
  if (state.progPlay?.id !== id) state.progPlay = null;
  if (push) navPush(`#prog/${encodeURIComponent(id)}`);
  render();
}

function removeProgression(id) {
  deleteProgression(id);
  state.progressions = getProgressions();
  if (state.view === 'progression' && state.activeProgressionId === id) {
    progStop();
    state.progPlay = null;
    if (history.state?.hp) { history.back(); return; }
    state.view = 'home';
    state.activeProgressionId = null;
    navPush('/');
  }
  render();
}

// ── Click: Progressions ───────────────────────────────────────────────────
registerActions({
  'picker-mode': (el, e, action) => {
    state.pickerMode = el.dataset.value === 'progression' ? 'progression' : 'playlist';
    state.pickerNewPlaylist = false;
    state.pickerNewProgression = false;
    render();
    return;
  },
  'add-to-progression': (el, e, action) => {
    const chord = state.pickerChordObj;
    const prog = progFind(el.dataset.progId);
    if (!chord || !prog) return;
    const no = addStepToProgression(prog.id, playlistEntryFor(chord, state.pickerChordFavId));
    if (!no) return;
    state.progressions = getProgressions();
    // The sheet closes so the toast doesn't cover it; ♡ opens it again on
    // Progression for the next chord.
    Object.assign(state, { pickerChordFavId: null, pickerChordObj: null, pickerNewProgression: false });
    showToast(`Added ${progStepTitle({ rootName: chord.rootName, typeName: chord.type.name })} to ${prog.name} (chord ${no})`);
    render();
    return;
  },
  'show-new-progression-input': (el, e, action) => {
    state.pickerNewProgression = true;
    render();
    setTimeout(() => document.getElementById('new-progression-input')?.focus(), 0);
    return;
  },
  'confirm-new-progression': (el, e, action) => {
    const name = (document.getElementById('new-progression-input')?.value || '').trim();
    const chord = state.pickerChordObj;
    if (!name || !chord) return;
    const id = addProgression(name, [newProgressionStep(playlistEntryFor(chord, state.pickerChordFavId))]);
    state.progressions = getProgressions();
    Object.assign(state, { pickerChordFavId: null, pickerChordObj: null, pickerNewProgression: false });
    showToast(`Added ${progStepTitle({ rootName: chord.rootName, typeName: chord.type.name })} to ${name} (chord 1)`);
    render();
    return;
  },
  'cs-open': (el, e, action) => { csOpen(el.dataset.progId || null); return; },
  'cs-cancel': (el, e, action) => { state.chordSheet = null; render(); return; },
  'cs-next': (el, e, action) => { csNext(); return; },
  'cs-back': (el, e, action) => {
    if (state.chordSheet) { state.chordSheet.name = document.getElementById('cs-name')?.value ?? state.chordSheet.name; state.chordSheet.step = 'paste'; }
    render();
    return;
  },
  'cs-semis': (el, e, action) => {
    if (!state.chordSheet) return;
    state.chordSheet.name = document.getElementById('cs-name')?.value ?? state.chordSheet.name;
    state.chordSheet.semis = parseInt(el.dataset.semis, 10) || 0;
    render();
    return;
  },
  'cs-save': (el, e, action) => { csSave(); return; },
  'prog-new-open, prog-rename-open': (el, e, action) => {
    const prog = progFind();
    state.plName = action === 'prog-new-open' ? { mode: 'prog-new', value: '' } : { mode: 'prog-rename', id: prog?.id, value: prog?.name ?? '' };
    render();
    setTimeout(() => document.getElementById('pl-name-input')?.focus(), 0);
    return;
  },
  'open-progression': (el, e, action) => {
    if (e.target.closest('.row-trail button')) return;
    openProgression(el.dataset.id);
    return;
  },
  'pl-copy-progression': (el, e, action) => {
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    if (!pl || !pl.chords.length) return;
    const id = addProgression(pl.name, pl.chords.map(c => newProgressionStep(c)));
    state.progressions = getProgressions();
    showToast(`Copied ${pl.name} as a progression`, { action: { label: 'Open', run: () => openProgression(id) } });
    render();
    return;
  },
  'prog-delete': (el, e, action) => {
    const prog = progFind();
    if (!prog) return;
    state.confirm = {
      kind: 'progression', id: prog.id, ok: 'Delete', title: `Delete ${prog.name}?`,
      body: 'The playlist is removed on this device and from sync. The chords stay on your instruments.',
    };
    render();
    return;
  },
  'prog-mode': (el, e, action) => { state.progMode = el.dataset.value === 'order' ? 'order' : 'steps'; render(); return; },
  'prog-row-menu': (el, e, action) => { e.stopPropagation(); state.progRowMenu = parseInt(el.dataset.idx, 10); render(); return; },
  'prog-row-close': (el, e, action) => { state.progRowMenu = null; render(); return; },
  'prog-step-up, prog-step-down, prog-step-remove, prog-step-dup, prog-step-bars': (el, e, action) => {
    const prog = progFind();
    const idx = parseInt(el.dataset.idx, 10);
    if (!prog || !prog.steps[idx]) return;
    if (action === 'prog-step-up') moveProgressionStep(prog.id, idx, idx - 1);
    if (action === 'prog-step-down') moveProgressionStep(prog.id, idx, idx + 1);
    if (action === 'prog-step-remove') removeProgressionStep(prog.id, idx);
    if (action === 'prog-step-dup') duplicateProgressionStep(prog.id, idx);
    if (action === 'prog-step-bars') {
      // A part-bar step (from a chord sheet) grows to a whole bar first.
      const st = prog.steps[idx];
      const d = parseInt(el.dataset.delta, 10);
      if (st.beats != null) { if (d > 0) setProgressionStepBars(prog.id, idx, 1); }
      else setProgressionStepBars(prog.id, idx, st.bars + d);
    }
    state.progressions = getProgressions();
    render();
    return;
  },
  'prog-bpm, prog-beats': (el, e, action) => {
    const prog = progFind();
    if (!prog) return;
    const d = parseInt(el.dataset.delta, 10);
    setProgressionTiming(prog.id, action === 'prog-bpm' ? { bpm: prog.bpm + d * 5 } : { beatsPerBar: prog.beatsPerBar + d });
    state.progressions = getProgressions();
    progRetime(progFind());
    render();
    return;
  },
  'prog-step-tap': (el, e, action) => {
    if (e.target.closest('.row-trail button, .prog-bars button')) return;
    const prog = progFind();
    const idx = parseInt(el.dataset.idx, 10);
    const s = prog?.steps[idx];
    if (!s) return;
    let ctx = progContext(prog);
    if (s.missing) { showToast(`${s.symbol ?? 'This chord'} isn't on ${s.scaleName ?? 'this instrument'}`); return; }
    if (!ctx || !ctx.isHere(s)) { showToast(`This chord isn’t on this instrument; it was added on ${s.scaleName ?? 'another instrument'}`); return; }
    if (ctx.kind === 'oc') {
      if (!ctx.open && state.progPlay?.playing && state.progPlay.id === prog.id) { progStart(prog, idx); return; }
      // The step goes on show (when its instrument is the one on screen) and plays as its arpeggio.
      if (!ctx.open) { state.progPlay = { id: prog.id, stepId: s.stepId, beat: 0, playing: false }; render(); }
      initAudio();
      playSequence(progWindNotes(s), n => { if (!ctx.open && state.progPlay?.stepId === s.stepId && !state.progPlay.playing) progWindShow(ctx.inst, n); });
      return;
    }
    if (ctx.load) {
      if (!progLoadHandpan(ctx.load)) { showToast('Scale not found'); return; }
      ctx = progContext(prog);
    }
    if (state.progPlay?.playing && state.progPlay.id === prog.id) { progStart(prog, idx); return; }
    state.progPlay = { id: prog.id, stepId: s.stepId, beat: 0, playing: false };
    render();
    progStrike(s);
    return;
  },
  'prog-play': (el, e, action) => {
    const prog = progFind(el.dataset.id || state.activeProgressionId);
    if (!prog) return;
    if (state.view !== 'progression') {
      // From the Playlists tab: the player lives on the progression's screen.
      stopAutoplay();
      Object.assign(state, { view: 'progression', activeProgressionId: prog.id, progMode: 'steps', progRowMenu: null });
      navPush(`#prog/${encodeURIComponent(prog.id)}`);
    }
    // From the chord it stopped on (the button says Play from here), else the first.
    const at = state.view === 'progression' ? progCurrentIdx(prog) : -1;
    progStart(prog, at > 0 ? at : null);
    return;
  },
  'prog-restart': (el, e, action) => {
    // Back to the first chord: playing goes on from there, stopped stays stopped.
    const prog = progFind();
    if (!prog) return;
    const ctx = progContext(prog);
    if (!ctx) return;
    const first = nextProgressionStep(prog.steps, -1, ctx.isHere);
    if (first < 0) return;
    if (state.progPlay?.playing && state.progPlay.id === prog.id) { progStart(prog, first); return; }
    state.progPlay = { id: prog.id, stepId: prog.steps[first].stepId, beat: 0, playing: false };
    render();
    progStrike(prog.steps[first]);
    return;
  },
  'prog-stop': (el, e, action) => { progStop(); render(); return; },
  'prog-level': (el, e, action) => {
    const prog = progFind();
    if (!prog || !setProgressionLevel(prog.id, el.dataset.value)) return;
    state.progressions = getProgressions();
    const pp = state.progPlay;
    if (pp?.playing && pp.id === prog.id) { const at = progCurrentIdx(prog); progStart(progFind(), at >= 0 ? at : null); return; }
    render();
    return;
  },
  'prog-practice': (el, e, action) => {
    const prog = progFind(el.dataset.id || state.activeProgressionId);
    if (!prog) return;
    const ctx = state.view === 'instrument' ? progOcContext(currentInstrument()) : progContext(prog);
    if (!ctx || ctx.kind !== 'oc') return;
    if (!(state.view === 'instrument' && state.currentInstrumentId === ctx.inst.id)) {
      if (ctx.open && !openInstrument(ctx.inst.id, { push: false })) { showToast('That ocarina is no longer in My instruments'); return; }
      state.view = 'instrument';
      state.oc.tab = 'playlists';
      navPush(`#i/${ctx.inst.id}/playlists`);
    }
    state.oc.practice = { progressionId: prog.id, idx: 0 };
    playPracticeStep();
    render();
    return;
  },
  'open-playlist': (el, e, action) => {
    stopAutoplay();
    state.plMode = 'chords';
    state.plRowMenu = null;
    state.activePlaylistId = el.dataset.id;
    state.view = 'playlist';
    navPush(`#pl/${encodeURIComponent(el.dataset.id)}`);
    render();
    return;
  },
  'delete-playlist': (el, e, action) => {
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    if (!pl || pl.id === 'favorites') return;
    state.confirm = {
      kind: 'playlist', id: pl.id, ok: 'Delete', title: `Delete ${pl.name}?`,
      body: 'The playlist is removed on this device and from sync. The chords stay on your instruments.',
    };
    render();
    return;
  },
  'move-chord-up': (el, e, action) => {
    const idx = parseInt(el.dataset.idx, 10);
    reorderChordInPlaylist(state.activePlaylistId, idx, idx - 1);
    state.playlists = getPlaylists();
    scheduleSave();
    render();
    return;
  },
  'move-chord-down': (el, e, action) => {
    const idx = parseInt(el.dataset.idx, 10);
    reorderChordInPlaylist(state.activePlaylistId, idx, idx + 1);
    state.playlists = getPlaylists();
    scheduleSave();
    render();
    return;
  },
  'remove-playlist-chord': (el, e, action) => {
    const idx = parseInt(el.dataset.idx, 10);
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    if (!pl) return;
    const chord = pl.chords[idx];
    if (!chord) return;
    removeChordFromPlaylist(state.activePlaylistId, chord.id);
    state.playlists = getPlaylists();
    state.favorites = getFavorites();
    scheduleSave();
    render();
    return;
  },
  'open-playlist-chord': (el, e, action) => {
    const idx = parseInt(el.dataset.idx, 10);
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    if (!pl) return;
    if (pl.chords[idx]?.instrumentId) {
      if (openPlaylistEntryOnInstrument(pl, pl.chords[idx])) render();
      return;
    }
    if (!loadPlaylistChordAt(pl, idx)) { showToast('Scale not found'); return; }
    state.chordFilter = { category: 'All', root: 'All', playlist: 'All' };
    state.view = 'chords';
    navPush(stateToHash());
    render();
    return;
  },
});
