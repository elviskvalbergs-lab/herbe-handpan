// The tuner strip and record fields.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { displayNote } from '../data.js';
import { icon } from '../icons.js';
import { centsBetween, midiToHz, pitchLabel } from '../ocarina.js';
import { TUNER_MIN_RMS, drawMicWave, openMic, startTuner } from '../tuner.js';
import { midiToNoteName, saveInstrument } from '../instruments.js';
import { holeDisplayOrder, holeLabel, holeSpot } from '../builder.js';
import { ensureAudioOutput } from '../audio.js';

// ── Tuner ────────────────────────────────────────────────────────────────────
// A panel pinned to the bottom of the screen while the tuner is on. It is
// updated in place ~20 times a second; only a practice-mode advance
// re-renders the page.

let _tunerStop = null;

// The record field armed to take the tuner's next steady reading (§5.3).
// auto: armed by itself after a capture on Set up, so it waits for a new note.
function newRecState() {
  return { armed: null, armedAt: 0, auto: false, slow: false, captured: null, error: null };
}

// The note the player should be playing right now, if any.
function tunerTarget() {
  if (state.view !== 'instrument') return null;
  const inst = currentInstrument();
  if (!inst) return null;
  const oc = state.oc;
  if (oc.practice) {
    const src = practiceSource(inst, oc.practice);
    const steps = src ? practiceSteps(src.entries) : [];
    return steps.length ? steps[oc.practice.idx % steps.length].midi : null;
  }
  if (oc.tab === 'notes') return oc.selected;
  return null;
}

// The docked strip (§5.13): the heard note and cents, a status line, the
// meter, and close. Its parts are redrawn in place on every reading; the
// close button and the screen-reader line stay put.
// Where a set-up reading path is in its sequence: { label, n, total, hole }
// (hole: index on the photo map, for an ocarina's single-hole reading).
function setupStepInfo(inst, path) {
  if (path.startsWith('f:')) {
    const setup = fluteSetupOf(inst);
    const paths = fluteSetupPaths(setup);
    const k = parseInt(path.slice(2), 10);
    return { label: fluteStepLabel(setup.holes.length, k), n: paths.indexOf(path) + 1, total: paths.length, hole: null };
  }
  const setup = setupOf(inst);
  const paths = ['s:f0', ...holeDisplayOrder(setup.holes).map(i => `s:${i}`)];
  const hole = path === 's:f0' ? null : parseInt(path.slice(2), 10);
  return {
    label: hole == null ? 'All holes closed' : `Only ${holeLabel(setup.holes, hole)} open`,
    n: paths.indexOf(path) + 1, total: paths.length, hole,
  };
}

// While set-up readings are being recorded one after another: a bar over
// the tuner with the step, what to blow now (on the photo when the holes are
// marked), the reading just recorded, and Stop.
function recGuideHtml() {
  const path = state.rec.armed;
  if (!path || !/^[sf]:/.test(path) || state.view !== 'instrument' || state.oc.tab !== 'setup' || !state.tuner.on) return '';
  const inst = currentInstrument();
  if (!inst) return '';
  const step = setupStepInfo(inst, path);
  const last = state.recLast && Date.now() - state.recLast.at < 4000 ? state.recLast : null;
  const map = step.hole != null && holeSpot(inst, step.hole) ? `<span class="rec-guide-map" aria-hidden="true">${holeMapSvg(inst, { highlight: step.hole, mini: true })}</span>` : '';
  return `
    <div class="rec-guide" role="status" aria-live="polite">
      ${last ? `<div class="rec-guide-done">${icon('check')} ${escHtml(last.label)}: <strong>${escHtml(last.text)}</strong></div>` : ''}
      <div class="rec-guide-row">
        ${map}
        <div class="rec-guide-text">
          <div class="rec-guide-step">Step ${step.n} of ${step.total}${last ? ' · next' : ''}</div>
          <div class="rec-guide-now">Now blow: <strong>${escHtml(step.label)}</strong></div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-action="b-record" data-path="${escHtml(path)}">Stop</button>
      </div>
    </div>`;
}

function tunerStripHtml() {
  const listening = !state.tuner.on && listenUi().on;
  return `
    <div id="tuner-panel" class="tuner" role="region" aria-label="${listening ? 'Listening' : 'Tuner'}">
      <canvas class="mic-wave tuner-wave" aria-hidden="true"></canvas>
      <div id="tuner-parts" class="tuner-parts">${listening ? listenStripInner() : tunerPanelInner()}</div>
      ${listening ? uiHelp('listen', 'tips') : uiHelp('tuner', 'needle')}
      ${uiIconBtn('x', listening ? 'Stop listening' : 'Stop the tuner', { action: listening ? 'hear-stop' : 'tuner-toggle', cls: 'tuner-close' })}
      <span id="tuner-live" class="sr-only" aria-live="polite"></span>
    </div>`;
}

// The listening bar while Listen hears chords: the chord, or what it's doing.
function listenStripInner() {
  const L = listenUi();
  const c = L.chord;
  return `
    <div class="tuner-note is-${c ? 'ok' : 'idle'}"><div class="tuner-name">${c ? escHtml(listenShownName(c)) : '—'}</div></div>
    <div class="tuner-mid"><div class="tuner-row"><span class="tuner-status">${c ? (L.heard ? 'Chord heard' : 'Last chord heard') : 'Listening for chords…'}</span></div></div>`;
}

// The live wave on every canvas.mic-wave while the microphone is open
// (tuner.js drawMicWave), one frame each screen refresh.
let _micWaveRaf = 0;
function ensureMicWave() {
  if (_micWaveRaf || !openMic()) return;
  const frame = t => {
    const mic = openMic();
    const canvases = document.querySelectorAll('canvas.mic-wave');
    if (!mic) { _micWaveRaf = 0; return; }
    const r = state.tuner.on ? state.tuner.reading : null;
    canvases.forEach(c => drawMicWave(c, mic, { hz: r?.hz > 0 ? r.hz : null, t }));
    _micWaveRaf = requestAnimationFrame(frame);
  };
  _micWaveRaf = requestAnimationFrame(frame);
}

// Where to read how to allow the microphone, for the browsers that say.
function micHelpUrl() {
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return 'https://support.mozilla.org/kb/how-manage-your-camera-and-microphone-permissions';
  if (/Chrome\/|CriOS\//.test(ua)) return 'https://support.google.com/chrome/answer/2693767';
  return null;
}

// What the strip shows for the current reading: tone ok | near | far | idle.
function tunerReadout() {
  let r = state.tuner.reading;
  const uf = state.useFlats, us = state.useSolfege;
  const target = tunerTarget();
  // A struck note (handpan) fades fast: the last note heard stays up a
  // moment after the sound drops out instead of blinking away.
  const last = state.tuner.lastHeard;
  const held = r?.midi == null && last && performance.now() - last.at < TUNER_HOLD_MS;
  if (held) r = last.reading;
  const heard = r?.midi != null ? Math.round(r.midi) : null;
  if (heard == null) return { tone: 'idle', note: '—', cents: null, status: 'Listening…', hz: null };
  if (held) return { tone: 'idle', note: displayNote(midiToNoteName(heard), uf, us), cents: null, status: 'Last note heard', hz: r.hz };
  const name = displayNote(midiToNoteName(heard), uf, us);
  if (target != null) {
    const tName = displayNote(midiToNoteName(target), uf, us);
    const off = Math.round(centsBetween(r.hz, midiToHz(target)));
    if (Math.abs(off) <= 10) return { tone: 'ok', note: name, cents: off, status: `Target ${tName} · in tune`, hz: r.hz };
    if (Math.abs(off) < 50) return { tone: 'near', note: name, cents: off, status: `${tName} is ${Math.abs(off)} ¢ ${off < 0 ? 'flat' : 'sharp'}`, hz: r.hz };
    return { tone: 'far', note: name, cents: Math.max(-50, Math.min(50, off)), status: `Hearing ${name}, looking for ${tName}`, hz: r.hz };
  }
  // No target: the nearest note, in neutral colours.
  const cents = Math.round(centsBetween(r.hz, midiToHz(heard)));
  return { tone: 'far', note: name, cents, status: Math.abs(cents) <= 10 ? `${name} · in tune` : `${name} is ${Math.abs(cents)} ¢ ${cents < 0 ? 'flat' : 'sharp'}`, hz: r.hz };
}

function tunerPanelInner() {
  const t = state.tuner;
  if (t.error) {
    const help = micHelpUrl();
    return `<div class="tuner-err">${escHtml(t.error)}${help && /refused/.test(t.error) ? ` <a href="${help}" target="_blank" rel="noopener">How to allow the microphone</a>` : ''}</div>`;
  }
  const o = tunerReadout();
  const fmtCents = c => (c > 0 ? '+' : c < 0 ? '−' : '±') + Math.abs(c) + ' ¢';
  return `
    <div class="tuner-note is-${o.tone}">
      <div class="tuner-name">${escHtml(o.note)}</div>
      <div class="tuner-cents">${o.cents == null ? '&nbsp;' : fmtCents(o.cents)}</div>
    </div>
    <div class="tuner-mid">
      <div class="tuner-row"><span class="tuner-status is-${o.tone}">${escHtml(o.status)}</span><span class="tuner-hz">${o.hz ? o.hz.toFixed(1) + ' Hz' : ''}</span></div>
      <div class="tuner-meter" aria-hidden="true">
        <div class="tuner-band"></div><div class="tuner-tick"></div>
        ${o.cents == null ? '' : `<div class="tuner-needle is-${o.tone}" style="left:${50 + Math.max(-50, Math.min(50, o.cents))}%"></div>`}
      </div>
    </div>`;
}

let _tunerLiveAt = 0;
const TUNER_HOLD_MS = 2000;
function onTunerReading(reading) {
  state.tuner.reading = reading;
  ensureMicWave();
  if (reading.midi != null) state.tuner.lastHeard = { reading, at: performance.now() };
  // An armed record field takes the first steady reading. One armed by
  // itself after a capture waits for a note that started after it.
  if (state.view === 'wizard' && state.wizard?.fl?.detect?.listening && reading.stable && reading.hz > 0) {
    onFluteDetectReading(reading.hz);
    return;
  }
  if (state.view === 'wizard' && state.wizard?.oc?.detect?.listening && reading.stable && reading.hz > 0) {
    onFluteDetectReading(reading.hz, 'oc');
    return;
  }
  if (state.pickListen?.listening) {
    if (state.pendingSlot && state.view === 'editor') { onPickListenReading(reading); return; }
    stopPickListen(); // the picker was closed some other way
  }
  if (state.listen?.listening) {
    if (reading.level >= TUNER_MIN_RMS) state.listen.heardAt = performance.now();
    if (onListenReading(reading)) return;
    updateListenLive(reading);
  }
  if (songWaitReading(reading)) return;
  const rec = state.rec;
  if (rec.armed && reading.stable && reading.hz > 0 && (!rec.auto || reading.since > rec.armedAt)) {
    captureReading(reading.hz);
    return;
  }
  // Practice mode: move on once the right note has held steady, but only for
  // a note started after the last advance (so a repeated note isn't skipped).
  const pr = state.oc.practice;
  const target = tunerTarget();
  if (pr && target != null && reading.stable && reading.since > state.tuner.lastAdvance
      && Math.abs(reading.midi - target) < 0.4) {
    state.tuner.lastAdvance = performance.now();
    const src = practiceSource(currentInstrument(), pr);
    if (src) {
      pr.idx = (pr.idx + 1) % practiceSteps(src.entries).length;
      render();
      return;
    }
  }
  const parts = document.getElementById('tuner-parts');
  if (parts) parts.innerHTML = tunerPanelInner();
  // Screen readers hear steady readings only, at most every 1.5 s.
  const live = document.getElementById('tuner-live');
  if (live && reading.stable && performance.now() - _tunerLiveAt > 1500) {
    const text = tunerReadout().status;
    if (live.textContent !== text) { live.textContent = text; _tunerLiveAt = performance.now(); }
  }
}

async function toggleTuner() {
  if (state.tuner.on) {
    if (_tunerStop) { _tunerStop(); _tunerStop = null; ensureAudioOutput(); } // iOS: give the speaker back after the mic
    state.tuner = { on: false, reading: null, error: null, lastAdvance: 0 };
    disarmRecord();
    render();
    return;
  }
  state.tuner = { on: true, reading: null, error: null, lastAdvance: performance.now() };
  render();
  try {
    _tunerStop = await startTuner(onTunerReading);
  } catch (err) {
    state.tuner.error = err?.name === 'NotAllowedError'
      ? 'Microphone access was refused. Allow it in the browser settings to use the tuner.'
      : `The tuner can't start: ${err?.message || err}`;
    if (state.rec.armed) { const path = state.rec.armed; disarmRecord(); state.rec.error = { path, msg: state.tuner.error }; }
    render();
  }
}

// ── Record fields ────────────────────────────────────────────────────────────
let _recSlowTimer = null;

function armRecord(path, { auto = false } = {}) {
  clearTimeout(_recSlowTimer);
  state.rec = { ...newRecState(), armed: path, armedAt: performance.now(), auto };
  // After 8 s without a steady note, say what to do (in place, no re-render).
  _recSlowTimer = setTimeout(() => {
    if (state.rec.armed !== path) return;
    state.rec.slow = true;
    const help = document.querySelector(`.rec-field[data-rec="${CSS.escape(path)}"] .rec-help`);
    if (help) help.innerHTML = '<span class="is-warning">No steady note yet: keep blowing, or type the value</span>';
  }, 8000);
}

function disarmRecord() {
  clearTimeout(_recSlowTimer);
  state.rec = newRecState();
}

// Fills the armed field with a reading, saves, and on Set up arms the next
// empty reading. The mic shows a check for a second.
function captureReading(hz) {
  const path = state.rec.armed;
  disarmRecord();
  const inst = currentInstrument();
  if (!inst || inst.id === SHARED_ID) { render(); return; }
  // Set-up readings in a row: say what was just recorded (the guide shows it
  // while the next one is armed) and buzz where phones can.
  const step = /^[sf]:/.test(path) ? setupStepInfo(inst, path) : null;
  if (step) {
    state.recLast = { path, label: step.label, text: pitchLabel(hz, { useFlats: state.useFlats, useSolfege: state.useSolfege }).text, at: Date.now() };
    try { navigator.vibrate?.(40); } catch (_) {}
  }
  setReading(inst, path, Math.round(hz * 10) / 10);
  saveInstrument(inst);
  const setupPath = /^[sf]:/.test(path);
  if (!setupPath) bAdvanceChamber(inst);
  state.rec.captured = path;
  const next = setupPath ? nextEmptySetupPath(inst, path) : null;
  if (next) { armRecord(next, { auto: true }); state.rec.captured = path; }
  else if (step) showToast(`${step.label}: ${state.recLast.text}. Every reading is in.`);
  render();
  if (next) document.querySelector('.rec-field.is-armed')?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  setTimeout(() => {
    if (state.rec.captured !== path) return;
    state.rec.captured = null;
    const btn = document.querySelector(`.rec-btn[data-path="${CSS.escape(path)}"]`);
    if (btn) { btn.classList.remove('is-captured'); btn.querySelector('.ico')?.replaceWith(document.createRange().createContextualFragment(icon('mic'))); }
  }, 1000);
}

// The next Set up reading without a value after `fromPath`, wrapping round.
function nextEmptySetupPath(inst, fromPath) {
  const setup = inst.setup;
  if (!setup) return null;
  const flute = fromPath.startsWith('f:');
  const paths = flute ? fluteSetupPaths(setup) : ['s:f0', ...holeDisplayOrder(setup.holes).map(i => `s:${i}`)];
  const value = p => (flute ? setup.readings[parseInt(p.slice(2), 10)]
    : p === 's:f0' ? setup.f0 : setup.singles[parseInt(p.slice(2), 10)]);
  const at = paths.indexOf(fromPath);
  return [...paths.slice(at + 1), ...paths.slice(0, at)].find(p => !(value(p) > 0)) ?? null;
}
