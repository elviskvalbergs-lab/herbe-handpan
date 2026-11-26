// The scale selector and finding a handpan scale by ear.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { SCALES, createLayoutFromScale, displayNote } from '../../data.js';
import { icon } from '../../icons.js';
import { findAllChords } from '../../chords.js';
import { rankScalesByNotes } from '../../scalefinder.js';
import { collectHeardNote } from '../../setup.js';
import { TUNER_MIN_RMS, recordMic } from '../../tuner.js';
import { findTuning } from '../../layoutfamilies.js';
import { midiToNoteName } from '../../instruments.js';

// ── View 1: Scale Selector ───────────────────────────────────────────────────
// Scales matching a search and a note-count filter ('all' | '9' | '10' | '11+').
function filterScales(query, count, { inDesc = true } = {}) {
  const q = query.trim().toLowerCase();
  return SCALES.filter(s => {
    const total = 1 + s.top.notes.length + s.bottom.notes.length;
    if (count === '9' && total !== 9) return false;
    if (count === '10' && total !== 10) return false;
    if (count === '11+' && total < 11) return false;
    if (q && !s.name.toLowerCase().includes(q) && !s.family.toLowerCase().includes(q)
      && !(inDesc && s.desc.toLowerCase().includes(q))) return false;
    return true;
  });
}

// Search field and note-count chips, sticky under the app bar.
function scaleToolsHtml({ inputId, value, placeholder, count, action }) {
  return `
    <div class="scale-tools">
      <div class="search-field">
        ${icon('search')}
        <input class="input" id="${inputId}" type="search" placeholder="${escHtml(placeholder)}"
          value="${escHtml(value)}" aria-label="${escHtml(placeholder)}" autocomplete="off">
      </div>
      <div class="chips-scroll" role="group" aria-label="Number of notes">
        ${['all', '9', '10', '11+'].map(f => `
          <button type="button" class="chip" data-action="${action}" data-val="${f}" aria-pressed="${count === f ? 'true' : 'false'}">
            ${f === 'all' ? 'All' : f === '9' ? '9 notes' : f}</button>`).join('')}
      </div>
    </div>`;
}

// Scales grouped under their family (in SCALES order), one row each.
function scaleGroupsHtml(scales, rowHtml) {
  const groups = new Map();
  for (const sc of scales) {
    if (!groups.has(sc.family)) groups.set(sc.family, []);
    groups.get(sc.family).push(sc);
  }
  return [...groups].map(([family, list]) => `
    <h2 class="list-title">${escHtml(family)}</h2>
    <div class="list scale-list">${list.map(rowHtml).join('')}</div>`).join('');
}

function viewSelector() {
  const filtered = filterScales(state.scaleSearch, state.noteCountFilter);
  const uf = state.useFlats, us = state.useSolfege;
  return `
    ${uiAppBar({ title: 'Try a scale', back: { action: 'back-home', label: 'My instruments' }, actions: [tunerAppBtn()] })}
    <p class="screen-intro">Try any handpan scale without saving it. Save it from the Pan tab to add it to My instruments.</p>
    ${scaleToolsHtml({ inputId: 'scale-search-input', value: state.scaleSearch, placeholder: 'Search scales by name or family…', count: state.noteCountFilter, action: 'filter-notes' })}
    ${listenPanelHtml('selector')}
    ${listenHasNotes('selector') ? listenMatchesHtml(filtered, 'select-scale')
      : filtered.length === 0
      ? uiEmpty({ icon: 'search', title: 'No scales match your search', body: 'Try another name, or All.' })
      : scaleGroupsHtml(filtered, s => uiRow({
        title: s.name, chevron: true, action: 'select-scale', data: { id: s.id }, cls: 'scale-row',
        meta: `${1 + s.top.notes.length} notes · ${escHtml(displayNote(s.top.ding, uf, us))} ding`,
        meta2: escHtml(s.desc),
      }))}`;
}

// ── Listen: find a handpan scale by ear ──────────────────────────────────────
// On Try a scale and the wizard's handpan step. The player strikes the ding,
// then the other notes; each new steady note from the tuner is collected
// (scalefinder.js) and the scales are ranked live. Listening stops on Stop,
// on picking a scale, on leaving the screen, or after 60 s without a new
// note; the tuner goes back to how it was.
const LISTEN_IDLE_MS = 60000;
let _listenTimer = null;

// Which Listen screen is showing: 'selector', 'wizard' or null.
function listenScreen() {
  if (state.view === 'selector') return 'selector';
  if (state.view === 'wizard' && state.wizard?.step === 'handpan') return 'wizard';
  if (state.view === 'setup' && state.setup?.step === 'listen') return 'setup';
  return null;
}

function listenHasNotes(where) {
  return state.listen?.where === where && state.listen.notes.length > 0;
}

function startListen() {
  const where = listenScreen();
  if (!where) return;
  const notes = state.listen?.where === where ? state.listen.notes : [];
  const raw = state.listen?.where === where ? state.listen.raw : undefined;
  state.listen = { where, listening: true, notes, raw, lastSince: null, startedTuner: !state.tuner.on || !!state.tuner.error, error: null, stopped: '', startedAt: performance.now(), heardAt: null };
  recordMic(true);
  armListenIdle();
  if (state.listen.startedTuner) {
    if (state.tuner.error) { stopTunerMic(); state.tuner.on = false; }
    toggleTuner().then(() => {
      if (state.tuner.error && state.listen?.listening) stopListen({ error: state.tuner.error });
    });
    return;
  }
  render();
}

function armListenIdle() {
  clearTimeout(_listenTimer);
  _listenTimer = setTimeout(() => {
    if (state.listen?.listening) stopListen({ stopped: 'Stopped: no new note for a minute.' });
  }, LISTEN_IDLE_MS);
}

// Stops listening (the notes stay) and turns the tuner off if Listen
// turned it on.
function stopListen(extra = {}) {
  clearTimeout(_listenTimer);
  const L = state.listen;
  recordMic(false);
  if (!L?.listening) return;
  const startedTuner = L.startedTuner;
  Object.assign(L, { listening: false, startedTuner: false }, extra);
  if (startedTuner && state.tuner.on && !state.tuner.error) { toggleTuner(); return; }
  render();
}

// What the microphone hears right now, under the listening status: a level
// meter and the note, or what to do when nothing comes through. Updated in
// place about 20 times a second (no re-render).
function listenLiveHtml(reading = state.tuner.reading, L = state.listen) {
  if (!L?.listening) return '';
  const level = reading?.level ?? 0;
  const now = performance.now();
  let text;
  if (reading?.hz > 0) text = `Hearing ${escHtml(displayNote(midiToNoteName(Math.round(reading.midi)), state.useFlats, state.useSolfege))}`;
  else if (level >= TUNER_MIN_RMS) text = 'Hearing sound · strike one note and let it ring';
  else if (now - (L.heardAt ?? L.startedAt) > 5000) text = 'Can’t hear anything. Hold the phone closer, about a hand away, and check that this site may use the microphone.';
  else text = 'Waiting for a note…';
  return `<span class="listen-live-text">${text}</span>`;
}

function updateListenLive(reading, L = state.listen) {
  const el = document.getElementById('listen-live');
  if (el) el.innerHTML = listenLiveHtml(reading, L);
}

// A tuner reading while listening: a steady note that began after the last
// one collected and isn't one already collected (a ringing note heard again)
// is added.
function onListenReading(reading) {
  const L = state.listen;
  if (!reading.stable || !(reading.hz > 0) || reading.since === L.lastSince) return false;
  L.lastSince = reading.since;
  if (L.where === 'setup' && state.setup?.windGuide && state.setup.step === 'listen') {
    armListenIdle();
    setupWindOnNote(reading.midi);
    return true;
  }
  if (L.where === 'setup' && state.setup?.guide && state.setup.step === 'listen') {
    armListenIdle();
    setupGuideOnNote(reading.midi);
    return true;
  }
  // Named on the instrument's own tuning, as in the guided round.
  const next = collectHeardNote(L, reading.midi, { tuned: L.where === 'setup' });
  if (!next) return false;
  L.raw = next.raw;
  L.notes = next.notes;
  if (L.where === 'setup' && state.setup) state.setup.tuningCents = next.offset;
  armListenIdle();
  render();
  setupOnHeard();
  return true;
}

// The Listen button, or while Listen is in use: status, Stop / Listen again,
// the notes heard as removable chips, Clear and the tip.
function listenPanelHtml(where) {
  const L = state.listen?.where === where ? state.listen : null;
  if (!L) {
    return `
      <div class="listen is-idle">
        <button type="button" class="btn btn-secondary" data-action="listen-start">${icon('mic')} Play my notes</button>
        <p class="listen-hint">Play your handpan to find its scale: strike the ding first.</p>
      </div>`;
  }
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const status = L.error ? `<span class="is-danger">${escHtml(L.error)}</span>`
    : L.listening ? (L.notes.length ? 'Listening… keep playing, one note at a time' : 'Listening… strike the ding')
    : L.stopped ? escHtml(L.stopped) : 'Stopped listening.';
  const chips = L.notes.map((m, i) => `
    <button type="button" class="chip listen-chip" data-action="listen-remove" data-midi="${m}" aria-label="Remove ${escHtml(nn(m))}" title="Remove ${escHtml(nn(m))}">
      ${escHtml(nn(m))}${i === 0 ? '<span class="listen-ding">ding</span>' : ''}${icon('x')}</button>`).join('');
  return `
    <section class="listen card${L.listening ? ' is-listening' : ''}" aria-label="Play my notes">
      <div class="listen-head">
        <p class="listen-status" aria-live="polite">${L.listening ? '<span class="listen-dot" aria-hidden="true"></span>' : ''}${status}</p>
        <div class="listen-actions">
          ${L.notes.length ? '<button type="button" class="btn btn-ghost" data-action="listen-clear">Clear</button>' : ''}
          ${L.listening
            ? `<button type="button" class="btn btn-secondary" data-action="listen-stop">${icon('square')} Stop</button>`
            : `<button type="button" class="btn btn-secondary" data-action="listen-start">${icon('mic')} ${L.notes.length ? 'Play again' : 'Play my notes'}</button>`}
        </div>
      </div>
      ${chips ? `<div class="chips listen-notes" aria-label="Notes heard">${chips}</div>` : ''}
      <p class="listen-hint">Most reliable: damp each note with your palm before playing the next one.</p>
      ${!L.listening && L.notes.length ? listenReportLinkHtml('Heard a note wrong?') : ''}
    </section>`;
}

// Scales ranked by the notes heard, among those the search and note-count
// chips leave. One note heard: every scale with that ding, then those with
// the ding an octave away. More: the best few, with why.
function listenMatchesHtml(scales, action) {
  const L = state.listen;
  const uf = state.useFlats, us = state.useSolfege;
  const name = m => displayNote(midiToNoteName(m), uf, us);
  const ranked = rankScalesByNotes(L.notes, scales, { name });
  const shown = L.notes.length === 1 ? ranked.filter(r => r.ding !== 'none') : ranked.slice(0, 6);
  const rows = shown.map(r => uiRow({
    title: r.scale.name, chevron: true, action, data: { id: r.scale.id }, cls: 'scale-row listen-match',
    meta: escHtml(`${r.total} notes · ${displayNote(r.scale.top.ding, uf, us)} ding`),
    meta2: escHtml(r.reasons.join(' · ')),
  })).join('');
  const title = L.notes.length === 1 ? `Scales with a ${name(L.notes[0])} ding` : 'Best matches';
  return shown.length
    ? `<h2 class="list-title">${escHtml(title)}</h2><div class="list listen-list">${rows}</div>`
    : uiEmpty({ icon: 'search', title: `No scale here has a ${name(L.notes[0])} ding`, body: 'Keep playing, or Clear and strike the ding first.' });
}

// ── Click: Selector ───────────────────────────────────────────────────────
registerActions({
  'filter-notes': (el, e, action) => {
    state.noteCountFilter = el.dataset.val;
    render();
    return;
  },
  'select-scale': (el, e, action) => {
    const scale = findTuning(el.dataset.id);
    if (!scale) return;
    state.layout = createLayoutFromScale(scale);
    state.chords = findAllChords(state.layout);
    state.selectedChord = null;
    state.shellMode = 'both';
    clearChordFilters();
    state.view = 'editor';
    state.currentInstrumentId = null;
    navPush(stateToHash());
    render();
    return;
  },
});
