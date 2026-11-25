// The layout editor (the Pan / Drum / Keys tab).
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { NOTE_NAMES, displayNote, getAllNotes } from '../../data.js';
import { icon } from '../../icons.js';
import { findAllChords } from '../../chords.js';
import { a4ForOffset, noteOnTuning, tuningOffsetCents } from '../../setup.js';
import { TUNER_MIN_RMS } from '../../tuner.js';
import { layoutFamilyInfo, layoutInstrument } from '../../layoutfamilies.js';
import { getInstrument, midiToNoteName } from '../../instruments.js';
import { initAudio, playNote } from '../../audio.js';
import { renderPan, settlePanPlace } from '../../pan.js';
import { getSavedLayouts } from '../../storage.js';

// ── View 2: Layout Editor ────────────────────────────────────────────────────
// Handpan Pan tab, Set up once it is mine (§6.8): the pan, its name and photo, shells, capacities, Make my own copy and Save.

// Move notes: a custom handpan's tone fields dragged to where they are on
// the real one (layout.pos, drawn by pan.js, kept in saves and links).
function edArranging() {
  return !!state.edArrange && state.view === 'editor' && !!state.layout?.isCustom && layoutInstrument(state.layout) === 'handpan';
}
function edArrangeHtml() {
  if (!state.layout?.isCustom || layoutInstrument(state.layout) !== 'handpan') return '';
  if (!edArranging()) {
    return `<div class="ed-arrange"><button type="button" class="btn btn-secondary btn-sm" data-action="ed-arrange">${icon('move')} Move notes</button></div>`;
  }
  return `<div class="ed-arrange is-on">
      <p class="ed-hint">Drag each note to where it is on your handpan. The ones underneath go round it.</p>
      <div class="row-btns">
        ${state.layout.pos ? '<button type="button" class="btn btn-ghost btn-sm" data-action="ed-arrange-reset">Put them back</button>' : ''}
        <button type="button" class="btn btn-primary btn-sm" data-action="ed-arrange">Done</button>
      </div>
    </div>`;
}

// Dragging a tone field while moving notes: it follows the finger, and on
// release settles where it fits (pan.js settlePanPlace) or goes back.
let _edDrag = null;
document.addEventListener('pointerdown', e => {
  if (!edArranging()) return;
  const g = e.target.closest?.('.ed-pan .pan-note');
  const svg = g?.ownerSVGElement;
  if (!g || !svg) return;
  e.preventDefault();
  g.setPointerCapture?.(e.pointerId);
  const m = svg.getScreenCTM()?.inverse();
  if (!m) return;
  const pt = (cx, cy) => { const p = new DOMPoint(cx, cy).matrixTransform(m); return { x: p.x, y: p.y }; };
  _edDrag = { id: g.dataset.noteId, g, svg, pt, start: pt(e.clientX, e.clientY), x: +g.dataset.x, y: +g.dataset.y, r: +g.dataset.r, pointer: e.pointerId };
  g.classList.add('is-dragging');
});
document.addEventListener('pointermove', e => {
  const d = _edDrag;
  if (!d || e.pointerId !== d.pointer) return;
  const p = d.pt(e.clientX, e.clientY);
  d.dx = p.x - d.start.x; d.dy = p.y - d.start.y;
  d.g.setAttribute('transform', `translate(${d.dx} ${d.dy})`);
});
function endEdDrag(e) {
  const d = _edDrag;
  if (!d || e.pointerId !== d.pointer) return;
  _edDrag = null;
  if (!d.dx && !d.dy) { render(); return; }
  const others = [...d.svg.querySelectorAll('.pan-note')].filter(o => o !== d.g)
    .map(o => ({ x: +o.dataset.x, y: +o.dataset.y, r: +o.dataset.r }));
  const at = settlePanPlace(d.id, d.x + (d.dx ?? 0), d.y + (d.dy ?? 0), d.r, others);
  if (at) state.layout.pos = { ...(state.layout.pos ?? {}), [d.id]: at };
  render();
}
document.addEventListener('pointerup', endEdDrag);
document.addEventListener('pointercancel', endEdDrag);

// Is the layout on screen saved, unchanged, in My instruments?
function hpLayoutSaved() {
  const layout = state.layout;
  const savedId = layout.isCustom ? layout.savedId : layout.id;
  // Read fresh: a layout opened from a playlist can share its object with state.savedLayouts.
  const saved = savedId && getSavedLayouts().find(l => l.id === savedId);
  return !!saved && JSON.stringify(saved.layout) === JSON.stringify(layout);
}

// Make my own copy (of a scale's layout) and Save; once saved and unchanged, a status.
function edActionsHtml() {
  const saved = hpLayoutSaved();
  return `
    ${!state.layout.isCustom ? `<button type="button" class="btn btn-secondary" data-action="clone-layout">${icon('copy')} Make my own copy</button>` : ''}
    ${saved
      ? `<span class="ed-status" role="status">${icon('check')} Saved</span>
         <button type="button" class="btn btn-primary" data-action="save-layout" disabled>Saved</button>`
      : `<button type="button" class="btn btn-primary" data-action="save-layout">${icon('save')} Save</button>`}`;
}

function viewEditor() {
  const layout = state.layout;
  const isCustom = layout.isCustom;

  const panSvg = renderPan(layout, {
    shellMode: state.shellMode,
    highlightNotes: [],
    rotated: state.ringRotated,
    useFlats: state.useFlats,
  });

  const topFilled = layout.top.slots.filter(s => s.note).length;
  const topEmpty = layout.top.slots.filter(s => !s.note).length;
  const bottomFilled = layout.bottom.slots.filter(s => s.note).length;

  const fam = layoutInstrument(layout);
  const fi = layoutFamilyInfo(fam);
  const drum = fam !== 'handpan'; // one row of notes, no shells
  // Mine: its name and photo are set here too, as on an ocarina's Set up.
  const mine = state.currentInstrumentId ? getInstrument(state.currentInstrumentId) : null;
  return `
    ${instrumentAppBar(null, 'editor')}

    <div class="editor-layout">
      <div class="editor-main">
        ${drum ? '' : uiSeg([{ value: 'both', label: 'Both shells' }, { value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }],
          state.shellMode, { action: 'shell-mode', key: 'mode', label: 'Shells shown' })}
        <div class="pan-wrap ed-pan${edArranging() ? ' is-arranging' : ''}">
          ${edArranging() ? '' : panRotateBtn()}${panSvg}
        </div>
        ${edArrangeHtml()}
        ${isCustom && !edArranging() ? `<p class="ed-hint">Tap a note to remove it · tap + to add one</p>` : ''}
      </div>

      <div class="editor-sidebar">
        ${mine ? instSetupCardHtml(mine) : ''}
        ${isCustom ? '' : `<p class="ed-hint ed-template">These are the notes of the ${escHtml(layout.name)} as its makers tune it, so they stay as they are. Is yours different? Make your own copy: change a note, add one${fam === 'handpan' ? ', or move the notes to where they are on yours' : ''}.</p>`}
        <div class="card ed-card"${isCustom ? '' : ' hidden'}>
          ${isCustom && !mine ? uiField({ label: 'Name', id: 'custom-name-input', control: `<input class="input" id="custom-name-input" value="${escHtml(layout.name)}" placeholder="Layout name">` }) : ''}
          ${drum ? `<div class="ed-shell">
            <div class="overline">${fi.thing === 'key' ? 'Keys' : 'Tongues'}</div>
            ${uiStepper({
              value: layout.top.capacity + 1, label: fi.thing === 'key' ? 'Keys' : 'Tongues', action: 'adjust-capacity', data: { shell: 'top' },
              min: topEmpty === 0 && layout.top.slots.length > 0, max: layout.top.capacity >= fi.maxNotes,
              help: `${topFilled + 1} ${fi.thing}${topFilled ? 's' : ''} · ${topEmpty} empty`,
            })}
          </div>
          ${fam === 'tongue-drum' ? uiSwitchRow({ label: 'Lowest note in the middle', help: layout.centre ? 'A round tongue in the centre' : 'All tongues round the edge', on: !!layout.centre, action: 'ed-centre' }) : ''}` : `<div class="ed-shell">
            <div class="overline">Top shell</div>
            ${uiStepper({
              value: layout.top.capacity, label: 'Top shell', action: 'adjust-capacity', data: { shell: 'top' },
              min: topEmpty === 0 && layout.top.slots.length > 0, max: layout.top.capacity >= 12,
              help: `${topFilled + 1} notes incl. ding · ${topEmpty} empty`,
            })}
          </div>
          <div class="ed-shell">
            <div class="overline">Bottom shell</div>
            ${uiStepper({
              value: layout.bottom.capacity, label: 'Bottom shell', action: 'adjust-capacity', data: { shell: 'bottom' },
              min: layout.bottom.slots.every(s => !s.note) && layout.bottom.capacity === 0, max: layout.bottom.capacity >= 12,
              help: `${bottomFilled} note${bottomFilled !== 1 ? 's' : ''} · ${layout.bottom.capacity - bottomFilled} empty`,
            })}
          </div>`}
        </div>
        <div class="ed-actions">${edActionsHtml()}</div>
      </div>
    </div>
  `;
}

// Sets the note picker's slot (tapped in the list, or heard).
function setPendingSlotNote(note) {
  const slot = state.pendingSlot;
  if (!slot || !note) return;
  stopPickListen();
  if (slot.shell === 'ding') {
    state.layout.top.ding = note;
  } else {
    const shell = slot.shell === 'top' ? state.layout.top : state.layout.bottom;
    while (shell.slots.length <= slot.index) shell.slots.push({ note: null });
    shell.slots[slot.index].note = note;
  }
  state.pendingSlot = null;
  state.chords = findAllChords(state.layout);
  initAudio();
  playNote(note);
  render();
}

// "Play it": the tuner listens, and the first steady note that starts after
// the tap sets the slot. The tuner is turned off again if this turned it on.
function startPickListen() {
  const startedTuner = !state.tuner.on || !!state.tuner.error;
  state.pickListen = { listening: true, startedTuner, startedAt: performance.now(), heardAt: null, error: null };
  if (startedTuner) {
    if (state.tuner.error) { if (_tunerStop) { _tunerStop(); _tunerStop = null; } state.tuner.on = false; }
    toggleTuner().then(() => {
      if (state.tuner.error && state.pickListen?.listening) { stopPickListen(); state.pickListen = { error: state.tuner.error }; render(); }
    });
    return;
  }
  render();
}

function stopPickListen() {
  const P = state.pickListen;
  state.pickListen = null;
  if (P?.listening && P.startedTuner && state.tuner.on && !state.tuner.error) toggleTuner();
}

// Notes set by playing them, one place at a time, are named on the
// instrument's own tuning, as in the guided round: what each place measured
// is kept per layout, and once three agree on an offset (a drum in 432 Hz)
// every note set this way is named on it. A note changed by hand since is
// left alone.
const _pickHeard = new WeakMap(); // layout → [{ shell, index, midi, named }]
function pickHeardNote(slot, midi) {
  const list = (_pickHeard.get(state.layout) ?? []).filter(h => h.shell !== slot.shell || h.index !== slot.index);
  const before = list.length ? tuningOffsetCents(list.map(h => h.midi)) : 0;
  const off = tuningOffsetCents([...list.map(h => h.midi), midi]);
  for (const h of list) {
    const shell = h.shell === 'ding' ? null : (h.shell === 'top' ? state.layout.top : state.layout.bottom);
    const cur = shell ? shell.slots[h.index]?.note : state.layout.top.ding;
    if (cur !== h.named) continue;
    h.named = midiToNoteName(noteOnTuning(h.midi, off));
    if (shell) shell.slots[h.index].note = h.named; else state.layout.top.ding = h.named;
  }
  const named = midiToNoteName(noteOnTuning(midi, off));
  _pickHeard.set(state.layout, [...list, { shell: slot.shell, index: slot.index, midi, named }]);
  if (off && !before) showToast(`Tuned to A = ${a4ForOffset(off)} Hz: Oakhum names your notes on that tuning`);
  return named;
}

// A tuner reading while "Play it" listens.
function onPickListenReading(reading) {
  const P = state.pickListen;
  if (reading.level >= TUNER_MIN_RMS) P.heardAt = performance.now();
  if (reading.stable && reading.hz > 0 && reading.since > P.startedAt && state.pendingSlot) {
    setPendingSlotNote(pickHeardNote(state.pendingSlot, reading.midi));
    return;
  }
  updateListenLive(reading, P);
}

function renderNotePicker() {
  const allNotes = new Set(getAllNotes(state.layout));
  const octaves = [2, 3, 4, 5];

  const rows = octaves.map(oct => {
    const cols = NOTE_NAMES.map(name => {
      const noteStr = `${name}${oct}`;
      const inUse = allNotes.has(noteStr);
      const label = displayNote(name, state.useFlats);
      return `<button class="chip note-chip ${inUse ? 'is-static' : ''}"
        data-action="pick-note" data-note="${noteStr}" aria-label="${escHtml(label + oct)}${inUse ? ', already on the instrument' : ''}"
        ${inUse ? 'disabled' : ''}>${label}</button>`;
    }).join('');
    return `<div class="note-octave-row">
      <span class="octave-label">${oct}</span>
      <div class="note-octave-notes">${cols}</div>
    </div>`;
  }).join('');

  const fam = layoutInstrument(state.layout);
  const fi = layoutFamilyInfo(fam);
  const slotLabel = fam !== 'handpan'
    ? (state.pendingSlot.shell === 'ding' ? 'lowest note' : `${fi.thing} ${state.pendingSlot.index + 2}`)
    : state.pendingSlot.shell === 'ding'
    ? 'ding (center)'
    : `${state.pendingSlot.shell === 'top' ? 'ring' : 'gu'} slot ${state.pendingSlot.index + 1}`;
  // First: play the note and Oakhum sets it. The list is for when you know it.
  const P = state.pickListen;
  const listen = P?.listening
    ? `<div class="pick-listen card"><p class="pick-listen-title"><span class="listen-dot" aria-hidden="true"></span> Play the ${escHtml(slotLabel)} once and let it ring</p>
        <canvas class="mic-wave pick-wave" aria-hidden="true"></canvas>
        <div class="listen-live" id="listen-live">${listenLiveHtml(state.tuner.reading, P)}</div>
        <button type="button" class="btn btn-ghost btn-sm" data-action="pick-listen-stop">Stop listening</button></div>`
    : `<button type="button" class="btn btn-primary btn-block pick-listen-btn" data-action="pick-listen">${icon('mic')} Play the note</button>
       ${P?.error ? `<p class="field-help is-danger">${escHtml(P.error)}</p>` : ''}`;

  return uiSheet({
    key: 'note', title: 'Set a note', close: 'close-picker',
    body: `${listen}<p class="sheet-text">Or choose it, for the ${escHtml(slotLabel)}. Greyed notes are already on the instrument.</p>${rows}`,
    footer: `<button class="btn btn-ghost" data-action="close-picker">Cancel</button>`,
  });
}

// ── Click: Editor ─────────────────────────────────────────────────────────
registerActions({
  'shell-mode': (el, e, action) => {
    state.shellMode = el.dataset.mode;
    render();
    return;
  },
  'clone-layout': (el, e, action) => {
    state.currentInstrumentId = null;
    state.layout = {
      ...state.layout,
      isCustom: true,
      id: 'custom',
      name: `My ${state.layout.name}`,
      top: {
        ...state.layout.top,
        slots: state.layout.top.slots.map(s => ({ ...s })),
      },
      bottom: {
        ...state.layout.bottom,
        slots: state.layout.bottom.slots.map(s => ({ ...s })),
      },
    };
    render();
    return;
  },
  'go-chords': (el, e, action) => {
    state.chords = findAllChords(state.layout);
    state.selectedChord = null;
    state.chordFilter = { category: 'All', root: 'All', playlist: 'All' };
    state.view = 'chords';
    navPush(stateToHash());
    render();
    return;
  },
  'ed-centre': (el, e, action) => {
    if (layoutInstrument(state.layout) !== 'tongue-drum') return;
    state.layout.centre = !state.layout.centre;
    state.chords = findAllChords(state.layout);
    navReplace(stateToHash());
    render();
    return;
  },
  'adjust-capacity': (el, e, action) => {
    const shell = el.dataset.shell;
    const delta = parseInt(el.dataset.delta);
    const target = state.layout[shell];
    const newCap = Math.max(0, Math.min(layoutFamilyInfo(layoutInstrument(state.layout)).maxNotes, target.capacity + delta));
    if (newCap === target.capacity) return;

    if (delta > 0) {
      target.slots.push({ note: null });
    } else {
      // Only remove last slot if it's empty
      const lastIdx = target.slots.length - 1;
      if (lastIdx >= 0 && target.slots[lastIdx].note === null) {
        target.slots.pop();
      } else {
        showToast('Remove the last note first');
        return;
      }
    }
    target.capacity = newCap;
    state.chords = findAllChords(state.layout);
    render();
    return;
  },
  // Note picker: cancel or overlay background click
  'close-picker': (el, e, action) => {
    stopPickListen();
    state.pendingSlot = null;
    render();
    return;
  },
  'pick-listen': (el, e, action) => { startPickListen(); return; },
  'pick-listen-stop': (el, e, action) => { stopPickListen(); render(); return; },
  // Note picker: pick a note
  'pick-note': (el, e, action) => { setPendingSlotNote(el.dataset.note); return; },
});
