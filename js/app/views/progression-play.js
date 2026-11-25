// Playing a progression: on the handpan, and the play levels.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { CHORD_TYPES, createLayoutFromScale, displayNote, getAllNotes, notePC, noteToMidi } from '../../data.js';
import { findAllChords } from '../../chords.js';
import { stackVoicing, strikePattern, windPattern } from '../../chordsheet.js';
import { findTuning } from '../../layoutfamilies.js';
import { getInstrument, handpanInstrumentId, midiToNoteName, usesLayout } from '../../instruments.js';
import { initAudio, playClick, playNote } from '../../audio.js';
import { updatePanPlaying } from '../../pan.js';
import { arpeggioOrder, ocarinaToLayout, renderFingering } from '../../ocarina-ui.js';
import { nextProgressionStep, progressionLevel, progressionStepBeats, progressionStepMs } from '../../storage.js';

// ── View 5: Progression ──────────────────────────────────────────────────────
// Progression detail (#prog/<id>): chords in order with repeats, a tempo,
// beats per bar and bars per step (docs/ocarina-mode.md, "Progressions").
// Play runs the steps in time on the instrument on screen: a handpan,
// tongue drum or kalimba shows each one on its picture, an ocarina or flute
// (one note at a time) shows the fingering of the note being blown, and
// Practice still walks each step's arpeggio at your own pace. Steps of
// other instruments are listed with their instrument's name and skipped.

// A playlist as it plays here: its chords found again on the instrument on
// screen when they were added on another one (progVoiced). Edits go by id,
// so they always change the stored playlist, never these copies.
function progFind(id = state.activeProgressionId) {
  const prog = state.progressions.find(p => p.id === id) ?? null;
  if (!prog) return null;
  const ctx = progContext(prog);
  return ctx && !ctx.load && !ctx.open ? progVoiced(prog, ctx) : prog;
}

// ── Playing a playlist on any instrument that has its chords ─────────────
// A chord added on one instrument plays on another when that one has the
// same chord (the same root and type), in its own notes or fingering: by
// the notes, not the key. A chord it lacks stays, marked for the instrument
// it was added on.
function progChordsOn(ctx) {
  if (ctx.kind === 'hp') return state.chords ?? [];
  const layout = ocarinaToLayout(ctx.inst);
  return layout.top.ding ? findAllChords(layout) : [];
}
function progStepOn(s, ctx, chords = progChordsOn(ctx)) {
  if (!s || s.missing) return null;
  if (ctx.isHere(s)) return s;
  const typeId = s.chordId?.slice(s.chordId.indexOf('-') + 1);
  const root = String(s.rootName ?? '').replace(/-?\d+$/, '');
  if (!typeId || !root) return null;
  const pc = notePC(root + '4');
  const c = chords.find(x => x.type.id === typeId && notePC(String(x.rootName).replace(/-?\d+$/, '') + '4') === pc);
  if (!c) return null;
  const voiced = { ...s, chordId: c.id, rootName: c.rootName, typeName: c.type.name, notes: c.notes, noteCount: c.notes.length, addedOn: s.scaleName };
  if (ctx.kind === 'hp') return { ...voiced, layoutId: ctx.layoutId, layoutData: null, instrumentId: undefined, family: undefined, scaleName: ctx.name };
  return { ...voiced, layoutId: ocLayoutId(ctx.inst), instrumentId: entryInstId(ctx.inst), family: ctx.inst.family, scaleName: ctx.inst.name };
}
function progVoiced(prog, ctx) {
  const chords = progChordsOn(ctx);
  return { ...prog, steps: prog.steps.map(s => progStepOn(s, ctx, chords) ?? s) };
}
// How many of a playlist's chords play on this instrument (the oc instrument,
// or the handpan, drum or kalimba on screen).
function progHereCount(prog, inst) {
  const ctx = inst ? progOcContext(inst) : state.layout ? progHpContext(hpCurrentLayoutId(), state.layout.name) : null;
  if (!ctx) return 0;
  const chords = progChordsOn(ctx);
  return prog.steps.filter(s => progStepOn(s, ctx, chords)).length;
}

function progStepTitle(s) {
  if (s.missing && s.symbol) return s.symbol; // a chord sheet chord the instrument lacks
  return `${displayNote(s.rootName, state.useFlats, state.useSolfege)} ${s.typeName}`;
}

// The layout a handpan step was saved on (a copy), or null when it's gone.
function progStepLayout(s) {
  if (s.layoutData) return JSON.parse(JSON.stringify(s.layoutData));
  const saved = state.savedLayouts.find(l => l.id === s.layoutId);
  if (saved) return JSON.parse(JSON.stringify(saved.layout));
  const scale = findTuning(s.layoutId);
  return scale ? createLayoutFromScale(scale) : null;
}

function progOcContext(inst) {
  return { kind: 'oc', inst, name: inst.name, isHere: s => entryIsFor(s, inst) && !s.missing };
}
function progHpContext(layoutId, name) {
  return { kind: 'hp', layoutId, name, isHere: s => !s.instrumentId && s.layoutId === layoutId && !s.missing };
}

// Where the progression plays: the instrument it was opened from, else the
// instrument of its first step that still exists (load / open: that
// handpan or ocarina is put on screen first). null when there is none.
function progContext(prog) {
  // currentInstrument: a visiting ocarina or flute (opened from a link) counts too.
  const cur = state.currentInstrumentId ? currentInstrument() : null;
  if (cur && !usesLayout(cur)) return progOcContext(cur);
  const layoutId = hpCurrentLayoutId();
  if (layoutId) return progHpContext(layoutId, state.layout.name);
  const first = prog?.steps.find(s => (s.instrumentId ? !!entryInstrument(s) : !!progStepLayout(s)));
  if (!first) return null;
  if (first.instrumentId) return { ...progOcContext(entryInstrument(first)), open: true };
  return { ...progHpContext(first.layoutId, first.scaleName), load: first };
}

// Puts a step's handpan on screen (as that instrument when it's saved).
function progLoadHandpan(s) {
  const owned = getInstrument(handpanInstrumentId(s.layoutId));
  const saved = owned && state.savedLayouts.find(l => l.id === s.layoutId);
  const layout = saved ? JSON.parse(JSON.stringify(saved.layout)) : progStepLayout(s);
  if (!layout) return false;
  state.layout = layout;
  state.chords = findAllChords(layout);
  state.currentInstrumentId = saved ? owned.id : null;
  return true;
}

// ── Playing on the handpan: one timer tick per beat, the chord on beat 1 ──
let _progTimer = null;

function progBeatMs(prog) { return progressionStepMs(prog.bpm, prog.beatsPerBar, 1) / prog.beatsPerBar; }

function progStop() {
  if (_progTimer) { clearInterval(_progTimer); _progTimer = null; }
  if (state.progPlay) state.progPlay.playing = false;
}

// The step on the pan: the one playing, or the last one tapped.
function progCurrentIdx(prog) {
  const pp = state.progPlay;
  if (!pp || pp.id !== prog.id) return -1;
  const idx = prog.steps.findIndex(s => s.stepId === pp.stepId);
  return idx >= 0 ? idx : -1;
}

function progStrike(s) {
  initAudio();
  for (const n of s.notes) playNote(n);
  updatePanPlaying(s.notes);
}

function progStart(prog, fromIdx = null) {
  progStop();
  let ctx = progContext(prog);
  if (ctx?.load) {
    if (!progLoadHandpan(ctx.load)) { showToast('Scale not found'); return; }
    ctx = progContext(prog);
  }
  if (ctx?.open) {
    // An ocarina or flute that isn't on screen yet: open it, stay here.
    if (ctx.inst.id === SHARED_ID && ctx.inst.link) openChartLink(ctx.inst.link);
    else if (!openInstrument(ctx.inst.id, { push: false })) { showToast('That instrument is no longer in My instruments'); return; }
    state.view = 'progression';
    prog = progFind(prog.id) ?? prog; // its chords as this instrument plays them
    ctx = progContext(prog);
  }
  if (!ctx) return;
  const idx = fromIdx != null && ctx.isHere(prog.steps[fromIdx]) ? fromIdx : nextProgressionStep(prog.steps, -1, ctx.isHere);
  if (idx < 0) { showToast(`None of these chords is on ${ctx.name}`); return; }
  // One note at a time has no whole chord to strike: always a level's pattern.
  if (ctx.kind === 'oc' || progressionLevel(prog) !== 'chord') { progStartLevel(prog, idx); return; }
  state.progPlay = { id: prog.id, stepId: prog.steps[idx].stepId, beat: 0, playing: true };
  render();
  progStrike(prog.steps[idx]);
  _progTimer = setInterval(progTick, progBeatMs(prog));
}

// A new tempo or time signature takes effect from the next beat.
function progRetime(prog) {
  if (!_progTimer || state.progPlay?.id !== prog.id) return;
  clearInterval(_progTimer);
  if (state.progPlay.half != null) { _progTimer = setInterval(progLevelTick, progBeatMs(prog) / 2); return; }
  _progTimer = setInterval(progTick, progBeatMs(prog));
}

function progTick() {
  const pp = state.progPlay;
  const prog = pp?.playing ? progFind(pp.id) : null;
  const ctx = prog && state.view === 'progression' && state.activeProgressionId === prog.id ? progContext(prog) : null;
  if (!ctx || ctx.kind !== 'hp' || ctx.load) { progStop(); if (state.view === 'progression') render(); return; }
  let idx = progCurrentIdx(prog);
  const step = prog.steps[idx];
  pp.beat += 1;
  if (step && pp.beat < progressionStepBeats(step, prog.beatsPerBar)) { progBeatUpdate(prog, step); return; }
  idx = nextProgressionStep(prog.steps, idx, ctx.isHere);
  if (idx < 0) { progStop(); render(); return; }
  Object.assign(pp, { stepId: prog.steps[idx].stepId, beat: 0 });
  render();
  progStrike(prog.steps[idx]);
}

// ── Play levels: Roots, Arpeggio, Groove ("From chord sheet to playing") ──
// A level plays a pattern from js/chordsheet.js instead of the whole chord,
// after one bar of count-in clicks (4-3-2-1 on screen). The timer ticks
// every half beat, for Groove's ghost taps. The Chord level is Play as it
// always was, with no count-in.

// The notes a level plays for a step on the pan on screen: its voicing as
// saved when that isn't the chord's default one, otherwise the chord
// stacked from its lowest root (the docs' table: F on D Kurd is C4 F4 A4).
function progStepVoicing(s) {
  if (!s || s.missing || !s.notes?.length) return [];
  const sorted = [...s.notes].sort((a, b) => noteToMidi(a) - noteToMidi(b));
  const type = CHORD_TYPES.find(t => t.id === s.chordId?.slice(s.chordId.indexOf('-') + 1));
  const canonical = state.chords.find(c => c.id === s.chordId);
  if (!type || !state.layout || (canonical && canonical.notes.join(',') !== s.notes.join(','))) return sorted;
  return stackVoicing(notePC(s.rootName + '4'), type.intervals, getAllNotes(state.layout)) ?? sorted;
}

// A step's notes on an ocarina or flute, in playing order: the root first.
function progWindNotes(s) {
  if (!s || s.missing || !s.notes?.length) return [];
  const rootName = s.notes.find(n => notePC(n) === notePC(s.rootName + '4')) ?? s.notes[0];
  return arpeggioOrder(s.notes, rootName).map(midiToNoteName);
}

function progPattern(prog, idx, ctx) {
  const s = prog.steps[idx];
  if (ctx.kind === 'oc') {
    const windNotes = progWindNotes(s);
    const pat = windPattern({
      notes: windNotes, beatsPerBar: prog.beatsPerBar, beats: progressionStepBeats(s, prog.beatsPerBar),
      bpm: prog.bpm, level: progressionLevel(prog),
    });
    return { ...pat, notes: windNotes, next: null };
  }
  const notes = progStepVoicing(s);
  const ni = nextProgressionStep(prog.steps, idx, ctx.isHere);
  const next = ni >= 0 ? progStepVoicing(prog.steps[ni]) : null;
  const root = notes.find(n => notePC(n) === notePC(s.rootName + '4')) ?? notes[0];
  const pat = strikePattern({
    notes, root, beatsPerBar: prog.beatsPerBar, beats: progressionStepBeats(s, prog.beatsPerBar),
    bpm: prog.bpm, level: progressionLevel(prog), next, section: s.section,
  });
  return { ...pat, notes, next: ni >= 0 && ni !== idx ? next : null };
}

// "1 C4 R · 2 F4 L · …": the first bar of a pattern, for reading and for
// screen readers.
function progPatternText(pat, beatsPerBar) {
  const first = pat.hits.filter(h => !h.ghost && h.beat < beatsPerBar);
  const beats = [...new Set(first.map(h => h.beat))];
  const uf = state.useFlats, us = state.useSolfege;
  const parts = beats.map((b, i) => {
    const at = first.filter(h => h.beat === b);
    return `${i + 1} ${at.map(h => `${displayNote(h.notes[0], uf, us)} ${h.hand}`).join(' + ')}`;
  });
  return parts.join(' · ') + (pat.hits.some(h => h.ghost) ? ' · ghost taps between' : '');
}

// The same for one note at a time: "1–2 C5 · 3 E5 · 4 G5" (a held note
// names the beats it lasts).
function progWindPatternText(pat, beatsPerBar) {
  const uf = state.useFlats, us = state.useSolfege;
  return pat.hits.filter(h => h.beat < beatsPerBar).map(h => {
    const from = h.beat + 1, to = Math.min(beatsPerBar, h.beat + h.len);
    return `${to > from ? `${from}–${to}` : from} ${displayNote(h.notes[0], uf, us)}`;
  }).join(' · ');
}

// The fingering of the note being blown, and (in place, between renders)
// the change to it from the note before.
function progWindFingering(inst, midi, previousMidi = null) {
  return renderFingering(inst, midi, {
    useFlats: state.useFlats, useSolfege: state.useSolfege, size: 'medium', showFingers: true, closeUp: state.closeUp, previousMidi,
  });
}
function progWindShow(inst, note) {
  const pp = state.progPlay;
  if (!pp) return;
  const midi = noteToMidi(note);
  const box = document.querySelector('.prog-wind');
  if (box) box.innerHTML = progWindFingering(inst, midi, pp.windMidi ?? null);
  pp.windMidi = midi;
}

function progStartLevel(prog, idx) {
  state.progPlay = { id: prog.id, stepId: prog.steps[idx].stepId, beat: 0, half: 0, countIn: prog.beatsPerBar, playing: true };
  render();
  initAudio();
  playClick(true);
  _progTimer = setInterval(progLevelTick, progBeatMs(prog) / 2);
}

function progLevelStrike(prog, ctx, beat) {
  const idx = progCurrentIdx(prog);
  if (idx < 0) return;
  const hits = progPattern(prog, idx, ctx).hits.filter(h => h.beat === beat && !h.ghost);
  if (!hits.length) return;
  if (ctx.kind === 'oc') {
    // A blown note lasts as long as the pattern says, with a breath before the next.
    playNote(hits[0].notes[0], Math.max(0.15, hits[0].len * progBeatMs(prog) / 1000 * 0.9));
    progWindShow(ctx.inst, hits[0].notes[0]);
    return;
  }
  const notes = hits.flatMap(h => h.notes);
  for (const n of notes) playNote(n);
  updatePanPlaying(notes);
}

function progLevelTick() {
  const pp = state.progPlay;
  const prog = pp?.playing ? progFind(pp.id) : null;
  const ctx = prog && state.view === 'progression' && state.activeProgressionId === prog.id ? progContext(prog) : null;
  if (!ctx || ctx.load || ctx.open) { progStop(); if (state.view === 'progression') render(); return; }
  pp.half += 1;
  if (pp.countIn > 0) {
    if (pp.half % 2) return;
    pp.countIn -= 1;
    if (pp.countIn > 0) { playClick(false); progBeatUpdate(prog, null); return; }
    Object.assign(pp, { half: 0, beat: 0 });
    render();
    progLevelStrike(prog, ctx, 0);
    return;
  }
  let idx = progCurrentIdx(prog);
  const step = prog.steps[idx];
  if (step && pp.half < progressionStepBeats(step, prog.beatsPerBar) * 2) {
    if (pp.half % 2 === 0) { pp.beat = pp.half / 2; progBeatUpdate(prog, step); }
    progLevelStrike(prog, ctx, pp.half / 2);
    return;
  }
  idx = nextProgressionStep(prog.steps, idx, ctx.isHere);
  if (idx < 0) { progStop(); render(); return; }
  Object.assign(pp, { stepId: prog.steps[idx].stepId, beat: 0, half: 0 });
  render();
  progLevelStrike(prog, ctx, 0);
}

// Bar and beat of the step playing, updated in place between steps; the
// count-in's 4-3-2-1 before a level starts.
function progBeatHtml(prog, s) {
  const pp = state.progPlay;
  if (pp?.countIn > 0) {
    return `
      <span class="prog-count" aria-hidden="true">${pp.countIn}</span>
      <span class="prog-beat-text">Count-in</span>`;
  }
  const beat = pp?.beat ?? 0;
  const bar = Math.floor(beat / prog.beatsPerBar);
  const inBar = beat % prog.beatsPerBar;
  const bars = s.beats != null ? Math.max(1, Math.ceil(s.beats / prog.beatsPerBar)) : s.bars;
  return `
    <span class="prog-beat-dots" aria-hidden="true">${Array.from({ length: prog.beatsPerBar }, (_, i) => `<span class="${i === inBar ? 'is-on' : ''}"></span>`).join('')}</span>
    <span class="prog-beat-text">Bar ${bar + 1} of ${bars}</span>`;
}
function progBeatUpdate(prog, s) {
  const el = document.querySelector('.prog-beat');
  if (el) el.innerHTML = progBeatHtml(prog, s);
}
