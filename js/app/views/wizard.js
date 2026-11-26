// The add-instrument wizard and chart key detection.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { createLayoutFromScale, displayNote, noteToMidi } from '../../data.js';
import { noteSearchWords } from '../../pickmatch.js';
import { icon } from '../../icons.js';
import { brandLogo } from '../../brand.js';
import { chambersNeeded, noteWindows, scaleToMidis } from '../../ocarina.js';
import { clearMicTakes } from '../../tuner.js';
import { CHART_ROOTS, chartDefaultKey, chartKeyFor, chartsForFamily, detectChartKey, detectLowestKey, getChart, instrumentFromChart } from '../../charts.js';
import { findTuning, isLayoutFamily } from '../../layoutfamilies.js';
import { INSTRUMENT_FAMILIES, createCustomFlute, createCustomOcarina, createScaleOcarina, handpanInstrumentId, midiToNoteName, saveInstrument, setOnboarded } from '../../instruments.js';
import { renderFingering } from '../../ocarina-ui.js';
import { getSavedLayouts, saveLayout } from '../../storage.js';
import { scheduleSave } from '../../auth.js';

// ── Add-instrument wizard ────────────────────────────────────────────────────
// First run asks which families the user plays, then walks through one step
// per ticked family. Instruments added on the way are toasted on Home.
function newWizard(firstRun) {
  return {
    firstRun,
    step: 'families',
    families: [],
    queue: [],
    history: [],       // steps behind this one, for Back
    added: [],         // [{ id, name }] added in this wizard
    notice: null,      // "D Kurd added." on the step after adding it
    search: '',
    noteFilter: 'all',
    oc: { path: null, scaleId: 'D-Kurd', transpose: 0, includeGu: true, chambers: null, windowStart: null, name: '', holeCount: 12, chartId: 'custom', keyId: null, detect: null },
    fl: { chartId: chartsForFamily('flute')[0]?.id ?? null, keyId: null, name: '', holeCount: 6, detect: null },
  };
}

function wizardNext() {
  const w = state.wizard;
  const next = w.queue.shift();
  w.notice = null;
  if (next) { w.history.push(w.step); w.step = next; render(); return; }
  setOnboarded();
  state.wizard = null;
  refreshInstruments();
  state.view = 'home';
  navReplace('/');
  render();
  if (w.added.length) {
    const names = w.added.map(a => a.name);
    const msg = `${names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]} added`;
    const only = w.added.length === 1 ? w.added[0] : null;
    showToast(msg, only ? { action: { label: 'Open', run: () => { if (openInstrument(only.id)) render(); } } } : {});
  }
}

// An instrument was added: remember it for Home, say so on the next step.
function wizardAdded(id, name) {
  const w = state.wizard;
  w.added.push({ id, name });
  wizardNext();
  if (state.wizard) state.wizard.notice = `${name} added.`;
  render();
}

// Notes for the ocarina being designed in the wizard, with the chamber and
// note-window choice applied.
function wizardOcarinaPlan() { return planOcarina(state.wizard.oc); }

// Notes of a scale-built ocarina from its design choices: scale, transpose,
// gu notes, chamber count (with the note window when fewer chambers than
// the full scale needs) and single notes switched off.
function planOcarina(oc) {
  const scale = findTuning(oc.scaleId);
  const all = scaleToMidis(scale, { transpose: oc.transpose, includeGu: oc.includeGu });
  const needed = chambersNeeded(all);
  const chambers = Math.min(oc.chambers ?? needed, needed);
  let windows = [];
  let notes = all;
  if (chambers < needed) {
    windows = noteWindows(all, chambers);
    const ding = noteToMidi(scale.top.ding) + oc.transpose;
    const chosen = windows.find(win => win.start === oc.windowStart)
      ?? windows.find(win => win.start === ding)
      ?? windows[0];
    notes = chosen.notes;
    windows = windows.map(win => ({ ...win, chosen: win === chosen, fromDing: win.start === ding }));
  }
  const excluded = oc.excluded ?? [];
  const kept = notes.filter(m => !excluded.includes(m));
  if (kept.length >= 2) notes = kept;
  return { scale, all, needed, chambers, windows, notes, excluded };
}

// The wizard's frame: step count, question, content and the action bar.
// bar = { left: markup, right: markup, help: text above the bar }.
function wizardFrame(w, { title, sub = '', body, bar }) {
  const order = INSTRUMENT_FAMILIES.map(f => f.id).filter(f => w.families.includes(f));
  const total = 1 + order.length;
  const at = w.step === 'families' ? 1 : order.indexOf(w.step) + 2;
  const header = w.firstRun
    ? uiAppBar({ title: 'Welcome' })
    : uiAppBar({ title: 'Add instrument', back: { action: 'back-home', label: 'My instruments' } });
  return stepFrame({ header, hero: w.firstRun && at === 1, notice: w.notice, count: `Step ${Math.max(1, at)} of ${Math.max(total, at)}`, title, sub, body, bar });
}

// A step of a guided flow (the add-instrument wizard, the beginner setup):
// app bar, optional brand hero and notice, "Step n of m", title, text, the
// step's content and the action bar. bar = { left, right, help }.
// The beginner setup's four stages. A stage can be several screens (the
// notes are played, heard, then matched), so the frame shows where you are
// as dots and the stage's name, not a number that repeats.
const SETUP_STAGES = ['Instrument', 'How', 'Your notes', 'Ready'];
function stageDotsHtml(stage) {
  return `<div class="wizard-count wizard-stage" role="img" aria-label="Step ${stage} of ${SETUP_STAGES.length}: ${SETUP_STAGES[stage - 1]}">
        <span class="wizard-dots" aria-hidden="true">${SETUP_STAGES.map((_, i) => `<i${i < stage ? ' class="is-on"' : ''}></i>`).join('')}</span>
        <span aria-hidden="true">${SETUP_STAGES[stage - 1]}</span>
      </div>`;
}
function stepFrame({ header, hero = false, notice = '', count = '', stage = 0, help = '', title, sub = '', body, bar = {} }) {
  // The quiet hero (artwork, then the logo), docs/design-system.md "Brand".
  const heroHtml = hero ? `
      <div class="brand-hero">
        <img class="brand-hero-art" src="/brand/hero-wide-800.webp" srcset="/brand/hero-wide-800.webp 800w, /brand/hero-wide.webp 1600w"
          sizes="(min-width: 640px) 640px, 100vw" width="800" height="450" alt="">
        ${brandLogo()}
        <p class="brand-hero-line">Chords and songs for the instrument you own.</p>
      </div>` : '';
  const hasBar = bar.left || bar.right || bar.help;
  return `${header}
    <div class="wizard">
      ${heroHtml}
      ${notice ? `<p class="wizard-notice">${icon('check')} ${escHtml(notice)}</p>` : ''}
      ${stage ? `<div class="wizard-stage-row">${stageDotsHtml(stage)}${help}</div>` : count ? `<div class="wizard-count">${escHtml(count)}</div>` : ''}
      <h2 class="wizard-title">${escHtml(title)}</h2>
      ${sub ? `<p class="wizard-sub">${sub}</p>` : ''}
      ${body}
      ${hasBar ? `<div class="actionbar">
        ${bar.help ? `<div class="actionbar-help">${escHtml(bar.help)}</div>` : ''}
        <div class="actionbar-start">${bar.left ?? ''}</div>
        <div class="actionbar-end">${bar.right ?? ''}</div>
      </div>` : ''}
    </div>`;
}

const WIZARD_BACK = '<button type="button" class="btn btn-ghost" data-action="wizard-back">Back</button>';
const WIZARD_SKIP = '<button type="button" class="btn btn-secondary" data-action="wizard-skip-step">Skip</button>';

function viewWizard() {
  const w = state.wizard;
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);

  if (w.step === 'families') {
    const meta = {
      handpan: 'Pick yours by scale',
      ocarina: 'Bought, or one you\'re making',
      flute: 'Tin whistle or Native American flute',
    };
    // The old multi-family step (unused since the beginner setup): the families with a wizard step.
    const tiles = INSTRUMENT_FAMILIES.filter(f => !isLayoutFamily(f.id) || f.id === 'handpan').map(f => {
      const unavailable = f.id === 'flute' && chartsForFamily('flute').length === 0;
      const on = w.families.includes(f.id);
      return `
        <button type="button" class="row family-tile${on ? ' is-on' : ''}${unavailable ? ' is-disabled' : ''}" role="checkbox"
          aria-checked="${on ? 'true' : 'false'}" data-action="wizard-family" data-family="${f.id}"
          ${unavailable ? 'disabled title="Flute fingering charts are still being sourced"' : ''}>
          <span class="row-lead tile">${icon(FAMILY_ICONS[f.id])}</span>
          <span class="row-text"><span class="row-title">${escHtml(f.name)}</span><span class="row-meta">${unavailable ? 'Coming soon' : meta[f.id]}</span></span>
          <span class="row-trail">${unavailable ? uiBadge('Soon') : `<span class="checkbox" aria-hidden="true">${on ? icon('check') : ''}</span>`}</span>
        </button>`;
    }).join('');
    return wizardFrame(w, {
      title: 'Which instruments do you play?',
      sub: 'Pick all that apply. You can add more later.',
      body: `<div class="list">${tiles}</div>`,
      bar: {
        help: w.families.length ? '' : 'Tick at least one',
        left: w.firstRun ? '<button type="button" class="btn btn-ghost" data-action="wizard-skip">Just browse scales</button>' : '',
        right: `<button type="button" class="btn btn-primary btn-lg" data-action="wizard-families-next" ${w.families.length ? '' : 'disabled'}>Next ${icon('chevron-right')}</button>`,
      },
    });
  }

  if (w.step === 'handpan') {
    const list = filterScales(w.search, w.noteFilter, { inDesc: false });
    return wizardFrame(w, {
      title: 'Which handpan do you have?',
      body: `
        ${scaleToolsHtml({ inputId: 'wizard-search-input', value: w.search, placeholder: 'Search scales…', count: w.noteFilter, action: 'wizard-filter-notes' })}
        ${listenPanelHtml('wizard')}
        ${listenHasNotes('wizard') ? listenMatchesHtml(list, 'wizard-pick-handpan')
          : list.length === 0 ? uiEmpty({ icon: 'search', title: 'No scales match your search' })
          : scaleGroupsHtml(list, sc => uiRow({
            title: sc.name, chevron: true, action: 'wizard-pick-handpan', data: { id: sc.id },
            meta: `${1 + sc.top.notes.length + sc.bottom.notes.length} notes · ${escHtml(displayNote(sc.top.ding, uf, us))} ding`,
          }))}
        <p class="wizard-foot">Custom layout? Add it later: open a scale, then Pan → Make my own copy.</p>`,
      bar: { left: w.history.length ? WIZARD_BACK : '', right: WIZARD_SKIP },
    });
  }

  if (w.step === 'ocarina') {
    const oc = w.oc;
    // Making a clay ocarina is for builders only (canBuild): everyone else
    // goes straight to "I have one".
    if (!oc.path && !canBuild()) oc.path = 'have';
    if (!oc.path) {
      return wizardFrame(w, {
        title: 'Add an ocarina',
        body: `<div class="list wizard-paths">
          ${uiRow({ lead: 'family-ocarina', title: 'I have one', meta: 'A bought ocarina. You\'ll chart it with the tuner, so the maker doesn\'t matter.', chevron: true, action: 'wizard-oc-path', data: { path: 'have' } })}
          ${uiRow({ lead: 'hammer', title: 'I\'m making one', meta: 'A clay ocarina tuned to a handpan scale.', chevron: true, action: 'wizard-oc-path', data: { path: 'make' } })}
        </div>`,
        bar: { left: w.history.length ? WIZARD_BACK : '', right: WIZARD_SKIP },
      });
    }
    const back = canBuild() ? '<button type="button" class="btn btn-ghost" data-action="wizard-oc-path" data-path="">Back</button>' : (w.history.length ? WIZARD_BACK : '');
    if (oc.path === 'have') {
      const chart = oc.chartId !== 'custom' ? getChart(oc.chartId) : null;
      return wizardFrame(w, {
        title: 'Your ocarina',
        body: `<div class="wizard-form">
          ${uiField({ label: 'Name', id: 'wizard-oc-name', control: `<input class="input" id="wizard-oc-name" value="${escHtml(oc.name)}" placeholder="My ocarina">` })}
          ${chartsForFamily('ocarina').length ? uiField({ label: 'Type', id: 'wizard-oc-chart', control: `
            <select class="select" id="wizard-oc-chart" data-action="wizard-chart" data-fam="oc">
              <option value="custom" ${oc.chartId === 'custom' ? 'selected' : ''}>Unknown or other: chart it with the tuner</option>
              ${chartsForFamily('ocarina').map(c => `<option value="${c.id}" ${oc.chartId === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
            </select>` }) : ''}
          ${chart ? (chart.tonicOffset != null ? wizardOcKeyHtml(chart, oc) : wizardKeySelect('oc', chart, oc.keyId)) : uiField({
            label: 'Holes, thumb holes included',
            control: uiStepper({ value: oc.holeCount, label: 'Holes', action: 'wizard-oc-holes-step', min: oc.holeCount <= 4, max: oc.holeCount >= 13 }),
            help: 'Its chart is worked out from the instrument: you blow it into the tuner with all holes closed, then with each hole open on its own.',
          })}
        </div>`,
        bar: { left: back, right: '<button type="button" class="btn btn-primary btn-lg" data-action="wizard-oc-create">Add ocarina</button>' },
      });
    }
    const plan = wizardOcarinaPlan();
    const hasGu = plan.scale.bottom.notes.length > 0;
    const holes = plan.notes.length - plan.chambers;
    let preview = '';
    try {
      const draft = createScaleOcarina({ scaleId: oc.scaleId, transpose: oc.transpose, includeGu: oc.includeGu, notes: plan.notes, name: 'Preview' });
      preview = `<div class="wizard-preview" aria-hidden="true">${renderFingering(draft, draft.chambers[0].notes[0], { size: 'medium', useFlats: uf, useSolfege: us })}</div>`;
    } catch { /* the preview is optional */ }
    return wizardFrame(w, {
      title: 'Design an ocarina',
      body: `<div class="wizard-design">
        <div class="wizard-form">
          ${uiField({ label: 'Handpan scale', id: 'wizard-oc-scale', control: uiPicker({
            id: 'wizard-oc-scale', value: oc.scaleId, label: 'Handpan scale', options: scalePickerOptions(), action: 'wizard-oc-scale',
          }) })}
          <div class="list">
            ${uiSetRow({ label: 'Transpose', control: uiStepper({
              value: oc.transpose > 0 ? '+' + oc.transpose : String(oc.transpose), label: 'Transpose', action: 'wizard-oc-transpose-step',
              min: oc.transpose <= -6, max: oc.transpose >= 6, help: 'semitones',
            }) })}
            ${hasGu ? uiSwitchRow({ label: 'Gu notes', help: 'Include the bottom-shell notes', on: oc.includeGu, action: 'wizard-oc-gu-toggle' }) : ''}
          </div>
          <div class="field">
            <div class="field-label">Chambers</div>
            <p class="wizard-sub">The full scale needs ${plan.needed} chamber${plan.needed !== 1 ? 's' : ''}.</p>
            ${uiSeg(Array.from({ length: plan.needed }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })), String(plan.chambers), { action: 'wizard-oc-chambers', key: 'n', label: 'Chambers' })}
          </div>
          ${plan.windows.length ? `
            <div class="field">
              <div class="field-label">Which notes?</div>
              <p class="wizard-sub">${plan.chambers === 1 ? 'One chamber holds' : `${plan.chambers} chambers hold`} ${plan.notes.length}.</p>
              ${noteStripHtml(plan, nn, { win: start => `data-action="wizard-oc-window" data-start="${start}"` })}
            </div>` : `<div class="chips note-strip">${plan.notes.map(m => `<span class="chip is-selected">${nn(m)}</span>`).join('')}</div>`}
          <p class="wizard-summary">${plan.notes.length} notes · ${holes} hole${holes !== 1 ? 's' : ''} · ${plan.chambers} chamber${plan.chambers !== 1 ? 's' : ''}</p>
          ${uiField({ label: 'Name', id: 'wizard-oc-name', control: `<input class="input" id="wizard-oc-name" value="${escHtml(oc.name)}" placeholder="${escHtml(plan.scale.name)} ocarina">` })}
        </div>
        ${preview}
      </div>`,
      bar: { left: back, right: '<button type="button" class="btn btn-primary btn-lg" data-action="wizard-oc-create">Start building</button>' },
    });
  }

  if (w.step === 'flute') {
    const fl = w.fl;
    const charts = chartsForFamily('flute');
    const custom = fl.chartId === 'custom';
    const chart = custom ? null : getChart(fl.chartId) ?? charts[0];
    const placeholder = custom ? 'My flute' : chart ? wizardFluteName(chart, fl.keyId) : 'My flute';
    return wizardFrame(w, {
      title: 'Your flute',
      sub: 'A Native American flute in a key not listed: pick an “any key” type and set its key. Another flute, or not sure what it is? Pick “Other flute: record its notes” and blow each fingering into the tuner.',
      body: `<div class="wizard-form">
        ${uiField({ label: 'Name', id: 'wizard-fl-name', control: `<input class="input" id="wizard-fl-name" value="${escHtml(fl.name)}" placeholder="${escHtml(placeholder)}">` })}
        ${uiField({ label: 'Type', id: 'wizard-fl-chart', control: `
          <select class="select" id="wizard-fl-chart" data-action="wizard-chart" data-fam="fl">
            ${charts.map(c => `<option value="${c.id}" ${chart?.id === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
            <option value="custom" ${custom ? 'selected' : ''}>Other flute: record its notes</option>
          </select>` })}
        ${custom ? uiField({
          label: 'Finger holes',
          control: uiStepper({ value: fl.holeCount, label: 'Finger holes', action: 'wizard-fl-holes-step', min: fl.holeCount <= 3, max: fl.holeCount >= 8 }),
          help: 'Its chart comes from the flute itself: on Set up you blow it into the tuner with all holes closed, then lift the holes one at a time from the bottom.',
        }) : chart?.octaves ? wizardFluteKeyHtml(chart, fl) : chart ? wizardKeySelect('fl', chart, fl.keyId) : ''}
      </div>`,
      bar: {
        left: w.history.length ? WIZARD_BACK : '',
        right: `<button type="button" class="btn btn-ghost" data-action="wizard-skip-step">Skip</button>
          <button type="button" class="btn btn-primary btn-lg" data-action="wizard-fl-create" ${chart || custom ? '' : 'disabled'}>Add flute</button>`,
      },
    });
  }
  return wizardFrame(w, { title: '', body: '', bar: {} });
}

// Name a flute from a chart gets unless the user types one: any-key charts
// say the key in the user's note spelling ("… in Bb (Bb3)").
function wizardFluteName(chart, keyId) {
  const key = chart.keys.find(k => k.id === (keyId ?? chartDefaultKey(chart))) ?? chart.keys[0];
  if (!chart.octaves) return chart.keys.length > 1 ? `${chart.name} (${key.lowest})` : chart.name;
  const uf = state.useFlats, us = state.useSolfege;
  return `${chart.shortName ?? chart.name} in ${displayNote(key.root, uf, us)} (${displayNote(key.lowest, uf, us)})`;
}

const FLUTE_OCTAVE_NAMES = { 3: 'Low', 4: 'Mid', 5: 'High' };

// Key and octave of an any-key flute chart: a Key select (12 roots in the
// user's spelling), Low · Mid · High, and Detect with tuner.
function wizardFluteKeyHtml(chart, fl) {
  const uf = state.useFlats, us = state.useSolfege;
  const key = chart.keys.find(k => k.id === (fl.keyId ?? chartDefaultKey(chart))) ?? chart.keys[0];
  const d = fl.detect;
  return `
    <div class="fl-key">
      ${uiField({
        label: 'Key', id: 'wizard-fl-root',
        control: uiPicker({
          id: 'wizard-fl-root', value: key.root, label: 'Key', action: 'wizard-fl-root',
          options: CHART_ROOTS.map(r => ({ value: r, label: displayNote(r, uf, us), keywords: noteSearchWords(r) })),
        }),
      })}
      <div class="field">
        <div class="field-label" id="wizard-fl-octave-label">Octave</div>
        ${uiSeg(chart.octaves.map(o => ({ value: String(o), label: FLUTE_OCTAVE_NAMES[o] ?? String(o) })), String(key.octave), { action: 'wizard-fl-octave', key: 'octave', label: 'Octave' })}
      </div>
    </div>
    ${chartDetectHtml('fl', d, 'Cover all holes and blow a steady note')}
    <p class="field-help">All holes closed sounds ${escHtml(displayNote(key.lowest, uf, us))}. Not sure which octave? Detect it, or check with the tuner.</p>
    ${chart.sourceName ? `<p class="field-help">Chart: ${escHtml(chart.sourceName)}</p>` : ''}`;
}

// Detect with tuner: the first steady reading sets the key (and octave) of
// the wizard's flute ('fl') or ocarina ('oc') chart. The tuner is turned on
// if it is off, and off again afterwards if the detection turned it on.
let _flDetectTimer = null;
let _chartDetecting = null; // { fam, t }: the target listening, kept if the wizard closes
function wizardChartTarget(fam) {
  return (fam === 'oc' ? state.wizard?.oc : state.wizard?.fl) ?? (_chartDetecting?.fam === fam ? _chartDetecting.t : null);
}
function startFluteDetect(fam = 'fl') {
  const t = wizardChartTarget(fam);
  if (!t) return;
  clearTimeout(_flDetectTimer);
  t.detect = { listening: true, startedTuner: !state.tuner.on || !!state.tuner.error };
  _chartDetecting = { fam, t };
  _flDetectTimer = setTimeout(() => {
    if (!wizardChartTarget(fam)?.detect?.listening) return;
    stopFluteDetect({ error: 'No steady note: blow a little longer' }, fam);
  }, 10000);
  if (t.detect.startedTuner) {
    if (state.tuner.error) { if (_tunerStop) { _tunerStop(); _tunerStop = null; } state.tuner.on = false; }
    toggleTuner().then(() => {
      if (state.tuner.error && wizardChartTarget(fam)?.detect?.listening) stopFluteDetect({ error: state.tuner.error }, fam);
    });
    return;
  }
  render();
}

// Ends a detection with a result or an error; turns the tuner off again
// if the detection turned it on.
function stopFluteDetect(result, fam = 'fl') {
  clearTimeout(_flDetectTimer);
  const t = wizardChartTarget(fam);
  if (!t?.detect) return;
  const startedTuner = t.detect.startedTuner;
  t.detect = result;
  if (_chartDetecting?.t === t) _chartDetecting = null;
  if (startedTuner && state.tuner.on && !state.tuner.error) { toggleTuner(); return; }
  render();
}

// The wizard step a chart detection belongs to is still on screen.
function chartDetectOnScreen(fam) {
  const w = state.wizard;
  return state.view === 'wizard' && !!w && (fam === 'oc' ? w.step === 'ocarina' && w.oc.path === 'have' : w.step === 'flute');
}

function onFluteDetectReading(hz, fam = 'fl') {
  if (fam === 'oc') { onOcarinaDetectReading(hz); return; }
  const fl = state.wizard.fl;
  const chart = getChart(fl.chartId);
  if (!chart?.octaves) { stopFluteDetect(null); return; }
  const r = detectChartKey(hz, { octaves: chart.octaves });
  fl.keyId = chartKeyFor(chart, r.root, r.octave).id;
  const uf = state.useFlats, us = state.useSolfege;
  const heard = displayNote(r.root + r.heardOctave, uf, us);
  const off = r.cents === 0 ? 'in tune' : `${Math.abs(r.cents)} ¢ ${r.cents > 0 ? 'sharp' : 'flat'}`;
  const oct = FLUTE_OCTAVE_NAMES[r.octave] ?? String(r.octave);
  let text = `Heard ${heard}, ${off}: key ${displayNote(r.root, uf, us)}, ${oct}`;
  if (r.outOfRange) text += ` (the nearest octave offered; your flute sounds ${r.heardOctave < r.octave ? 'lower' : 'higher'})`;
  stopFluteDetect({ text, warn: Math.abs(r.cents) > 30 ? 'This flute may not be tuned to A=440' : '' });
}

// Ocarina from a transposing chart: the note heard with every hole closed is
// the chart's lowest note, which sets the key.
function onOcarinaDetectReading(hz) {
  const oc = state.wizard.oc;
  const r = detectLowestKey(getChart(oc.chartId), hz);
  if (!r) { stopFluteDetect(null, 'oc'); return; }
  oc.keyId = r.key.id;
  const uf = state.useFlats, us = state.useSolfege;
  const heard = displayNote(r.root + r.heardOctave, uf, us);
  const off = r.cents === 0 ? 'in tune' : `${Math.abs(r.cents)} ¢ ${r.cents > 0 ? 'sharp' : 'flat'}`;
  let text = `Heard ${heard}, ${off}: key ${ocKeyLabel(r.key)}`;
  if (r.outOfRange) text += ` (the nearest octave offered; your ocarina sounds ${r.heardOctave < r.octave ? 'lower' : 'higher'})`;
  stopFluteDetect({ text, warn: Math.abs(r.cents) > 30 ? 'This ocarina may not be tuned to A=440' : '' }, 'oc');
}

// Group of a transposing chart's key in the Key picker: the octave of its
// lowest note, in the user's spelling ("Lowest note C4–B4").
function ocKeyOctaveName(key) {
  const o = parseInt(key.lowest.replace(/^\D+/, ''), 10);
  const uf = state.useFlats, us = state.useSolfege;
  return `Lowest note ${displayNote('C' + o, uf, us)}–${displayNote('B' + o, uf, us)}`;
}

// "G (lowest E4)" in the user's note spelling.
function ocKeyLabel(key) {
  const uf = state.useFlats, us = state.useSolfege;
  return `${displayNote(key.root, uf, us)} (lowest ${displayNote(key.lowest, uf, us)})`;
}

// Detect with tuner: the button and its status line.
function chartDetectHtml(fam, d, listeningText) {
  const status = !d ? ''
    : d.listening ? `<span>${icon('mic')} ${escHtml(listeningText)}</span>`
    : d.error ? `<span class="is-warning">${escHtml(d.error)}</span>`
    : `<span>${escHtml(d.text)}</span>${d.warn ? `<br><span class="is-warning">${escHtml(d.warn)}</span>` : ''}`;
  return `
    <div class="fl-detect">
      <button type="button" class="btn btn-secondary btn-sm" data-action="wizard-${fam}-detect" aria-pressed="${d?.listening ? 'true' : 'false'}">
        ${icon('mic')} ${d?.listening ? 'Listening…' : 'Play its lowest note'}</button>
      <div class="fl-detect-status field-help" aria-live="polite">${status}</div>
    </div>`;
}

// Key of a transposing ocarina chart (the 12-hole C chart in any key): a Key
// select named by tonic and lowest note, and Detect with tuner.
function wizardOcKeyHtml(chart, oc) {
  const key = chart.keys.find(k => k.id === (oc.keyId ?? chartDefaultKey(chart))) ?? chart.keys[0];
  return `
    ${uiField({
      label: 'Key', id: 'wizard-oc-key',
      control: uiPicker({
        id: 'wizard-oc-key', value: key.id, label: 'Key', action: 'wizard-key', data: { fam: 'oc' },
        options: chart.keys.map(k => ({
          value: k.id, label: ocKeyLabel(k), group: ocKeyOctaveName(k),
          keywords: [...noteSearchWords(k.root), ...noteSearchWords(k.lowest)],
        })),
      }),
      help: key.root === chart.writtenKey ? `The published chart is for ${escHtml(chart.writtenKey)}.`
        : `Same fingerings as the ${escHtml(chart.writtenKey)} chart, shifted to this key.`,
    })}
    ${chartDetectHtml('oc', oc.detect, 'Cover every hole, sub-holes too, and blow a steady note')}
    <p class="field-help">Not sure of the key? Detect it: every hole closed sounds the lowest note, ${escHtml(displayNote(key.lowest, state.useFlats, state.useSolfege))} in this key.</p>
    ${chart.sourceName ? `<p class="field-help">Chart: ${escHtml(chart.sourceName)}</p>` : ''}`;
}

function wizardKeySelect(fam, chart, keyId) {
  return uiField({
    label: 'Key', id: `wizard-${fam}-key`,
    control: `
      <select class="select" id="wizard-${fam}-key" data-action="wizard-key" data-fam="${fam}">
        ${chart.keys.map(k => `<option value="${k.id}" ${(keyId ?? chartDefaultKey(chart)) === k.id ? 'selected' : ''}>${escHtml(k.name)}</option>`).join('')}
      </select>`,
    help: chart.sourceName ? `Chart: ${escHtml(chart.sourceName)}` : '',
  });
}

// Pitch classes of a scale from data.js, for the Notes and Chords filter.
function scalePitchClasses(scaleId) {
  const scale = findTuning(scaleId);
  if (!scale) return null;
  return new Set(scaleToMidis(scale).map(m => ((m % 12) + 12) % 12));
}

// ── Click: Add-instrument wizard ──────────────────────────────────────────
registerActions({
  'wizard-family': (el, e, action) => {
    const fams = state.wizard.families;
    const f = el.dataset.family;
    state.wizard.families = fams.includes(f) ? fams.filter(x => x !== f) : [...fams, f];
    render();
    return;
  },
  'wizard-families-next': (el, e, action) => {
    if (!state.wizard.families.length) return;
    state.wizard.queue = INSTRUMENT_FAMILIES.map(f => f.id).filter(f => state.wizard.families.includes(f));
    state.wizard.history = [];
    wizardNext();
    return;
  },
  'wizard-skip': (el, e, action) => {
    setOnboarded();
    state.wizard = null;
    state.view = 'selector';
    navReplace('#scales');
    render();
    return;
  },
  'wizard-skip-step': (el, e, action) => { wizardNext(); return; },
  'wizard-fl-create': (el, e, action) => {
    const fl = state.wizard.fl;
    if (fl.detect?.listening) stopFluteDetect(null);
    const chart = fl.chartId === 'custom' ? null : getChart(fl.chartId) ?? chartsForFamily('flute')[0];
    if (!chart && fl.chartId !== 'custom') return;
    const inst = chart
      ? instrumentFromChart(chart.id, fl.keyId ?? chartDefaultKey(chart), { name: fl.name.trim() || wizardFluteName(chart, fl.keyId) })
      : createCustomFlute({ name: fl.name.trim(), holeCount: fl.holeCount });
    fl.detect = null;
    saveInstrument(inst);
    refreshInstruments();
    wizardAdded(inst.id, inst.name);
    return;
  },
  'wizard-pick-handpan': (el, e, action) => {
    const scale = findTuning(el.dataset.id);
    if (!scale) return;
    const layout = createLayoutFromScale(scale);
    saveLayout({
      id: scale.id, name: scale.name,
      noteCount: 1 + scale.top.notes.length + scale.bottom.notes.length,
      layout, savedAt: Date.now(),
    });
    state.savedLayouts = getSavedLayouts();
    scheduleSave();
    refreshInstruments();
    state.wizard.search = '';
    wizardAdded(handpanInstrumentId(scale.id), scale.name);
    return;
  },
  'wizard-oc-path': (el, e, action) => {
    if (state.wizard.oc.detect?.listening) stopFluteDetect(null, 'oc');
    state.wizard.oc.detect = null;
    state.wizard.oc.path = el.dataset.path || null;
    render();
    return;
  },
  'wizard-oc-chambers': (el, e, action) => {
    state.wizard.oc.chambers = parseInt(el.dataset.n, 10);
    state.wizard.oc.windowStart = null;
    render();
    return;
  },
  'wizard-oc-window': (el, e, action) => {
    state.wizard.oc.windowStart = parseInt(el.dataset.start, 10);
    render();
    return;
  },
  'wizard-oc-create': (el, e, action) => {
    const oc = state.wizard.oc;
    if (oc.detect?.listening) stopFluteDetect(null, 'oc');
    const inst = oc.path === 'have' && oc.chartId !== 'custom' && getChart(oc.chartId)
      ? instrumentFromChart(oc.chartId, oc.keyId ?? chartDefaultKey(getChart(oc.chartId)), { name: oc.name.trim() })
      : oc.path === 'have'
      ? createCustomOcarina({ name: oc.name.trim(), holeCount: oc.holeCount })
      : Object.assign(createScaleOcarina({
          scaleId: oc.scaleId, transpose: oc.transpose, includeGu: oc.includeGu,
          notes: wizardOcarinaPlan().notes, name: oc.name.trim(),
        }), { design: { scaleId: oc.scaleId, transpose: oc.transpose, includeGu: oc.includeGu, chambers: oc.chambers, windowStart: oc.windowStart, excluded: [] } });
    saveInstrument(inst);
    refreshInstruments();
    state.wizard.oc = newWizard(false).oc;
    wizardAdded(inst.id, inst.name);
    return;
  },
  'wizard-back': (el, e, action) => {
    const w = state.wizard;
    const prev = w.history.pop();
    if (prev) { w.queue.unshift(w.step); w.step = prev; w.notice = null; }
    render();
    return;
  },
  'wizard-filter-notes': (el, e, action) => { state.wizard.noteFilter = el.dataset.val; render(); return; },
  'wizard-fl-holes-step': (el, e, action) => {
    const fl = state.wizard.fl;
    fl.holeCount = Math.max(3, Math.min(8, fl.holeCount + parseInt(el.dataset.delta, 10)));
    render();
    return;
  },
  'wizard-fl-octave': (el, e, action) => {
    const fl = state.wizard.fl;
    const chart = getChart(fl.chartId);
    if (!chart?.octaves) return;
    const cur = chart.keys.find(k => k.id === (fl.keyId ?? chartDefaultKey(chart)));
    fl.keyId = chartKeyFor(chart, cur.root, parseInt(el.dataset.octave, 10))?.id ?? fl.keyId;
    render();
    return;
  },
  'wizard-fl-detect': (el, e, action) => { startFluteDetect(); return; },
  'listen-start': (el, e, action) => { startListen(); return; },
  'listen-stop': (el, e, action) => { stopListen(); return; },
  'listen-clear': (el, e, action) => {
    if (!state.listen) return;
    if (state.listen.listening) Object.assign(state.listen, { notes: [], raw: [], lastSince: null }); else state.listen = null;
    clearMicTakes();
    render();
    return;
  },
  'listen-remove': (el, e, action) => {
    if (!state.listen) return;
    const m = parseInt(el.dataset.midi, 10);
    state.listen.notes = state.listen.notes.filter(n => n !== m);
    if (!state.listen.notes.length && !state.listen.listening) state.listen = null;
    render();
    return;
  },
  'wizard-oc-detect': (el, e, action) => {
    if (state.wizard.oc.detect?.listening) stopFluteDetect(null, 'oc');
    else startFluteDetect('oc');
    return;
  },
  'wizard-oc-holes-step': (el, e, action) => {
    const oc = state.wizard.oc;
    oc.holeCount = Math.max(4, Math.min(13, oc.holeCount + parseInt(el.dataset.delta, 10)));
    render();
    return;
  },
  'wizard-oc-transpose-step': (el, e, action) => {
    const oc = state.wizard.oc;
    Object.assign(oc, { transpose: Math.max(-6, Math.min(6, oc.transpose + parseInt(el.dataset.delta, 10))), windowStart: null });
    render();
    return;
  },
  'wizard-oc-gu-toggle': (el, e, action) => {
    Object.assign(state.wizard.oc, { includeGu: !state.wizard.oc.includeGu, chambers: null, windowStart: null });
    render();
    return;
  },
});

// ── Change: Add-instrument wizard ─────────────────────────────────────────
registerActions({
  'wizard-chart': (el, e, action) => {
    const t = el.dataset.fam === 'oc' ? state.wizard.oc : state.wizard.fl;
    if (t.detect?.listening) stopFluteDetect(null, el.dataset.fam === 'oc' ? 'oc' : 'fl');
    t.chartId = el.value; t.keyId = null;
    t.detect = null;
    render();
  },
  'wizard-fl-root': (el, e, action) => {
    const fl = state.wizard.fl;
    const chart = getChart(fl.chartId);
    const cur = chart?.keys.find(k => k.id === (fl.keyId ?? chartDefaultKey(chart)));
    if (cur) fl.keyId = chartKeyFor(chart, el.value, cur.octave)?.id ?? fl.keyId;
    render();
  },
  'wizard-key': (el, e, action) => {
    (el.dataset.fam === 'oc' ? state.wizard.oc : state.wizard.fl).keyId = el.value;
  },
  'wizard-oc-scale': (el, e, action) => {
    Object.assign(state.wizard.oc, { scaleId: el.value, chambers: null, windowStart: null });
    render();
  },
}, CHANGE_ACTIONS);
