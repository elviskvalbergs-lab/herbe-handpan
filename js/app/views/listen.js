// Listen: a chord heard, shown on my instrument (docs/listen-mode.md).
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { CHORD_TYPES, NOTE_NAMES, displayNote } from '../../data.js';
import { icon } from '../../icons.js';
import { yinPitch } from '../../tuner.js';
import { LISTEN_DEFAULTS, listenChordOnNotes, listenOverallConfidence, listenTracker } from '../../listen-detect.js';
import { startListening } from '../../listen-audio.js';
import { midiToNoteName } from '../../instruments.js';
import { ensureAudioOutput } from '../../audio.js';
import { playableMidis, renderFingering } from '../../ocarina-ui.js';

// ── Listen: a chord heard, shown on my instrument (docs/listen-mode.md) ─────
// Step 1 of the plan: one chord at a time with its confidence, on the
// handpan and on ocarinas and flutes, plus the debug view. Detection lives
// in js/listen-detect.js (no instrument), the mic in js/listen-audio.js.
let _listenStopFn = null, _listenTrack = null;
const LISTEN_SILENCE_MS = 60000;
const LISTEN_MIN_MS = 700;
const LISTEN_SUFFIX = { maj: '', min: 'm', dom7: '7', maj7: 'maj7', min7: 'm7', sus2: 'sus2', sus4: 'sus4', dim: 'dim' };

function newListenUi() {
  return { on: false, starting: false, error: null, stopped: '', chord: null, chordAt: 0, candidates: [], heard: false,
    lastHeard: 0, history: [], tune: { ...LISTEN_DEFAULTS }, ocNote: null };
}
function listenUi() { return (state.listenUi ??= newListenUi()); }

// Is a Listen screen showing? (The mic turns off as soon as it isn't.)
function listenScreenOn() {
  return (state.view === 'chords' && state.hpListen)
    || (state.view === 'instrument' && state.oc.tab === 'chords' && state.oc.listen)
    || state.view === 'listen-debug';
}

function listenRootName(pc) { return displayNote(NOTE_NAMES[pc], state.useFlats, state.useSolfege); }
function listenChordLabel(c) { return `${listenRootName(c.rootPC)}${LISTEN_SUFFIX[c.typeId] ?? ''}`; }

// What to show for the chord heard: sure or likely → its name; unsure but
// the root is clear → the root and "?"; otherwise "?".
function listenShownName(c) {
  if (c.level !== 'unsure') return listenChordLabel(c);
  return (c.rootConfidence ?? 0) >= 0.6 ? `${listenRootName(c.rootPC)} ?` : '?';
}

// The chord heard on the notes an instrument can play.
function listenHeardOn(playable) {
  const L = listenUi();
  const c = L.chord;
  return { L, chord: c, fit: c ? listenChordOnNotes(c.rootPC, c.typeId, playable) : null };
}

async function listenStart() {
  const L = listenUi();
  if (L.on || L.starting) return;
  if (state.tuner.on) await toggleTuner();   // one microphone session at a time
  Object.assign(L, { starting: true, error: null, stopped: '', lastHeard: performance.now() });
  _listenTrack = listenTracker(L.tune);
  render();
  try {
    _listenStopFn = await startListening(listenOnFrame, { tune: L.tune });
    L.on = true;
  } catch (err) {
    L.error = err?.name === 'NotAllowedError'
      ? 'Microphone access was refused. Allow it in the browser settings to use Listen.'
      : `Listening can't start: ${err?.message || err}`;
  }
  L.starting = false;
  render();
}

function listenStop(stopped = '') {
  const L = listenUi();
  _listenStopFn?.();
  _listenStopFn = null;
  if (L.chord && performance.now() - L.chordAt >= LISTEN_MIN_MS) L.history.push({ ...L.chord, ms: performance.now() - L.chordAt });
  Object.assign(L, { on: false, starting: false, chord: null, candidates: [], heard: false, stopped });
  ensureAudioOutput();
  render();
}

function listenOnFrame(frame) {
  const L = listenUi();
  if (!L.on || !_listenTrack) return;
  ensureMicWave();
  const r = _listenTrack.push(frame);
  const now = performance.now();
  if (r.heard) L.lastHeard = now;
  if (state.view === 'listen-debug') listenDebugUpdate(frame, r);
  const before = L.chord ? `${L.chord.rootPC}-${L.chord.typeId}-${L.chord.level}` : '';
  const wasHeard = L.heard;
  // A chord heard for under 0.7 s is a passing blip (the last chord still
  // ringing into the next): it isn't kept in the history.
  if (r.changed && L.chord && now - L.chordAt >= LISTEN_MIN_MS) L.history.push({ ...L.chord, ms: now - L.chordAt });
  if (r.changed) L.chordAt = now;
  L.chord = r.chord;
  L.candidates = r.candidates.length ? r.candidates : L.candidates;
  L.heard = r.heard;
  const after = L.chord ? `${L.chord.rootPC}-${L.chord.typeId}-${L.chord.level}` : '';
  if (now - L.lastHeard > LISTEN_SILENCE_MS) { listenStop('Stopped: nothing heard for a minute.'); return; }
  if ((before !== after || wasHeard !== L.heard) && state.view !== 'listen-debug') render();
}

// The chord card on a Listen screen: Start (with the one-sentence privacy
// note), or the chord heard with its confidence and what's missing.
function listenCardHtml(heard, { below = '' } = {}) {
  const L = listenUi();
  if (!L.on) {
    return chordCardHtml({
      title: 'Listen to someone playing',
      metas: [],
      actions: `<button type="button" class="btn btn-primary hp-play" data-action="hear-start" ${L.starting ? 'disabled' : ''}>${icon('mic')} ${L.starting ? 'Starting…' : 'Listen'}</button>`,
      below: `<p class="hear-note">Listen uses the microphone to hear the chords nearby; the sound stays on this phone and isn't recorded. Works best with one instrument, the phone 1–2 m from it.</p>
        ${L.error ? `<p class="hear-note is-danger">${escHtml(L.error)}</p>` : ''}${L.stopped ? `<p class="hear-note">${escHtml(L.stopped)}</p>` : ''}`,
    });
  }
  const c = heard?.chord;
  const stop = `<button type="button" class="btn btn-secondary hp-play" data-action="hear-stop">${icon('square')} Stop</button>`;
  if (!c) {
    return chordCardHtml({
      title: `<span class="hear-dot" aria-hidden="true"></span>Listening…`,
      metas: [['Play a chord near the phone']], actions: stop,
    });
  }
  const levelText = { sure: 'Sure', likely: 'Likely', unsure: 'Unsure: ask them to play it again, clearer' }[c.level];
  const other = c.level !== 'sure' ? L.candidates.find(x => `${x.rootPC}-${x.typeId}` !== `${c.rootPC}-${c.typeId}`) : null;
  const type = CHORD_TYPES.find(t => t.id === c.typeId);
  const fit = heard.fit;
  const nn = m => displayNote(midiToNoteName(m), state.useFlats, state.useSolfege);
  const missing = fit && fit.missing.length
    ? `<p class="hear-note">No ${fit.missing.map(listenRootName).join(' or ')} on this instrument${fit.voicing.length ? `: plays as <b>${fit.voicing.map(nn).join(' – ')}</b>` : ''}.</p>` : '';
  return chordCardHtml({
    title: `<span class="hear-name${L.heard ? '' : ' is-faded'}">${escHtml(listenShownName(c))}</span>`,
    metas: [[`${escHtml(`${listenRootName(c.rootPC)} ${type?.name ?? ''}`)}${other ? ` · or ${escHtml(listenChordLabel(other))}?` : ''}`]],
    actions: stop,
    below: `
      <div class="hear-conf is-${c.level}" role="img" aria-label="Confidence: ${levelText}">
        <span class="hear-conf-bars"><i></i><i></i><i></i></span><span>${escHtml(levelText)}</span>
      </div>
      ${missing}${below}`,
  });
}

// Under the Listen card: the chords heard so far (newest last) and how
// clearly the whole session was heard.
function listenHistoryHtml() {
  const L = listenUi();
  const now = performance.now();
  const items = [...L.history, ...(L.chord ? [{ ...L.chord, ms: now - L.chordAt, current: true }] : [])];
  if (!items.length) return `<p class="hp-hint">The chords heard show up here, in order.</p>`;
  const overall = listenOverallConfidence(items);
  return `
    <div class="hear-history">
      <div class="hear-overall is-${overall.level}">${escHtml(overall.text)}</div>
      <div class="chips">${items.slice(-16).map(c => `<span class="chip hear-chip is-${c.level}${c.current ? ' is-current' : ''}">${escHtml(listenShownName(c))}</span>`).join('')}</div>
      ${!L.on ? '<button type="button" class="btn btn-ghost btn-sm" data-action="hear-clear">Clear</button>' : ''}
    </div>`;
}

// Ocarina / flute Listen: the fingering of one of the chord's notes, and the
// chord's notes this instrument can play as chips to pick from.
function listenOcStageParts(inst) {
  const heard = listenHeardOn(playableMidis(inst));
  const L = heard.L;
  const uf = state.useFlats, us = state.useSolfege;
  const notes = heard.fit ? heard.fit.voicing : [];
  const shown = notes.includes(L.ocNote) ? L.ocNote : notes[0] ?? null;
  const picture = shown != null
    ? `<div class="oc-stage-fg"><div class="oc-pstage is-current"><button type="button" class="oc-pstage-fg" data-action="oc-play-note" data-midi="${shown}">
        ${renderFingering(inst, shown, { size: 'medium', useFlats: uf, useSolfege: us, showFingers: true, noteLabel: false })}</button></div></div>`
    : `<div class="oc-stage-fg hear-empty-fg">${icon('mic')}</div>`;
  const chips = notes.length ? `
    <div class="oc-player-notes" role="group" aria-label="Notes of the chord you can play">
      ${notes.map(m => `<button type="button" class="oc-pnote${m === shown ? ' is-current' : ''}" data-action="listen-oc-note" data-midi="${m}">${escHtml(displayNote(midiToNoteName(m), uf, us))}</button>`).join('')}
    </div>` : '';
  return { picture, card: listenCardHtml(heard, { below: chips }), key: '' };
}

// Settings › Listen debug: what the detection sees, live, and its knobs.
function viewListenDebug() {
  const L = listenUi();
  const t = L.tune;
  const slider = (key, label, min, max, step) => `
    <label class="ld-slider-row"><span>${label} <b id="ld-v-${key}">${t[key]}</b></span>
      <input type="range" class="ld-slider" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${t[key]}"></label>`;
  return `${backAppBar('Microphone readings', { fallback: 'settings' })}
    <div class="settings listen-debug">
      <p class="settings-intro">For tuning detection with real instruments. The sound stays on this device unless you send a report.</p>
      <div class="row-btns">${L.on
        ? `<button type="button" class="btn btn-secondary" data-action="hear-stop">${icon('square')} Stop</button>`
        : `<button type="button" class="btn btn-primary" data-action="hear-start">${icon('mic')} Start listening</button>`}</div>
      ${L.error ? `<p class="hear-note is-danger">${escHtml(L.error)}</p>` : ''}
      <h2 class="list-title">Chroma (note strengths)</h2>
      <div class="ld-chroma" id="ld-chroma">${NOTE_NAMES.map(n => `<div class="ld-bar"><span style="height:0%"></span><em>${escHtml(displayNote(n, state.useFlats, state.useSolfege))}</em></div>`).join('')}</div>
      <h2 class="list-title">Now</h2>
      <div class="ld-lines">
        <div>Chord: <b id="ld-chord">—</b></div>
        <div>Pitch (YIN): <span id="ld-pitch">—</span></div>
        <div>Level <span id="ld-level">—</span> · peaks <span id="ld-peaks">—</span></div>
      </div>
      <h2 class="list-title">Chord guesses</h2>
      <table class="ld-table" id="ld-cands"><tbody><tr><td>—</td></tr></tbody></table>
      <h2 class="list-title">Thresholds</h2>
      <div class="ld-sliders">
        ${slider('peakRatio', 'Peak above noise floor ×', 1.5, 8, 0.5)}
        ${slider('smoothFrames', 'Frames before a chord shows', 1, 10, 1)}
        ${slider('alpha', 'Smoothing (0 none, 0.9 long)', 0, 0.9, 0.05)}
        ${slider('silenceRatio', 'Silence below × loudest', 0, 0.4, 0.02)}
        <button type="button" class="btn btn-ghost btn-sm" data-action="listen-tune-reset">Reset to defaults</button>
      </div>
    </div>`;
}

// Live update of the debug view, in place (about 10 times a second).
function listenDebugUpdate(frame, r) {
  const bars = document.querySelectorAll('#ld-chroma .ld-bar span');
  if (bars.length === 12) bars.forEach((b, i) => { b.style.height = `${Math.round((frame.chroma?.[i] ?? 0) * 100)}%`; });
  const set = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };
  const c = r.chord;
  set('ld-chord', c ? `${escHtml(listenChordLabel(c))} · ${Math.round(c.confidence * 100)}% (${c.level}) · root ${Math.round((c.rootConfidence ?? 0) * 100)}%${r.heard ? '' : ' · quiet'}` : '—');
  const y = frame.timeBuf ? yinPitch(frame.timeBuf, frame.sampleRate) : null;
  set('ld-pitch', y ? `${y.hz.toFixed(1)} Hz · ${escHtml(displayNote(midiToNoteName(Math.round(69 + 12 * Math.log2(y.hz / 440))), state.useFlats, state.useSolfege))} · clarity ${y.clarity.toFixed(2)}` : '—');
  set('ld-level', `${(10 * Math.log10((frame.energy || 1e-12))).toFixed(0)} dB`);
  set('ld-peaks', String(frame.peaks ?? 0));
  set('ld-cands', `<tbody>${(r.candidates || []).map(x => `<tr><td>${escHtml(listenChordLabel(x))}</td><td>${x.score.toFixed(2)}</td></tr>`).join('') || '<tr><td>—</td></tr>'}</tbody>`);
}
