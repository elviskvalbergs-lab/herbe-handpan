// Chord sheet → progression.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { icon } from '../../icons.js';
import { findAllChords } from '../../chords.js';
import { coverageBand, matchSheetChord, parseChordSheet, rankTranspositions, sheetCoverage, stepLength, transposeChordSymbol } from '../../chordsheet.js';
import { getInstrument, getInstruments, usesLayout } from '../../instruments.js';
import { ocarinaToLayout, playableMidis } from '../../ocarina-ui.js';
import { PROG_DEFAULTS, addProgression, fillProgression, getProgressions, newProgressionStep } from '../../storage.js';

// ── Chord sheet → progression ────────────────────────────────────────────────
// "Paste a chord sheet" (Playlists tab, an empty progression): a ChordPro or
// chord-over-lyrics sheet is parsed (js/chordsheet.js), fitted to an
// instrument in the best few keys, and saved as a progression. Chords the
// instrument lacks stay in as steps marked "not on this instrument".

function csHpTarget(layoutId, layout, name = layout.name) {
  return { key: 'hp:' + layoutId, kind: 'hp', name, layoutId, layout };
}
function csOcTarget(inst) {
  return { key: 'oc:' + inst.id, kind: 'oc', name: inst.name, inst, layout: ocarinaToLayout(inst) };
}

// Instruments a sheet can be fitted to: the one on screen first, then My
// instruments (ocarinas and flutes with a playable chart).
function csTargets() {
  const out = [];
  const add = t => { if (t && !out.some(x => x.key === t.key)) out.push(t); };
  const cur = state.currentInstrumentId && state.currentInstrumentId !== SHARED_ID ? getInstrument(state.currentInstrumentId) : null;
  if (cur && !usesLayout(cur) && playableMidis(cur).length) add(csOcTarget(cur));
  if (state.layout && (!cur || usesLayout(cur))) add(csHpTarget(hpCurrentLayoutId(), state.layout));
  for (const inst of getInstruments()) {
    if (usesLayout(inst)) {
      const saved = state.savedLayouts.find(l => l.id === inst.layoutId);
      if (saved) add(csHpTarget(saved.id, saved.layout, inst.name));
    } else if (playableMidis(inst).length) add(csOcTarget(inst));
  }
  return out;
}

function csOpen(progId = null) {
  const targets = csTargets();
  let target = targets[0]?.key ?? null;
  const prog = progId ? progFind(progId) : null;
  const ctx = prog ? progContext(prog) : null;
  if (ctx?.kind === 'hp' && targets.some(t => t.key === 'hp:' + ctx.layoutId)) target = 'hp:' + ctx.layoutId;
  if (ctx?.kind === 'oc' && targets.some(t => t.key === 'oc:' + ctx.inst.id)) target = 'oc:' + ctx.inst.id;
  state.chordSheet = { step: 'paste', text: '', target, semis: 0, name: '', progId, error: '' };
  render();
}

function csModel(cs = state.chordSheet) {
  const sheet = parseChordSheet(cs.text);
  const target = csTargets().find(t => t.key === cs.target) ?? null;
  const chords = target?.layout.top.ding ? findAllChords(target.layout) : [];
  return { sheet, target, chords };
}

function csShiftLabel(semis) {
  if (!semis) return 'As written';
  return `${semis > 0 ? 'Up' : 'Down'} ${Math.abs(semis)} semitone${Math.abs(semis) !== 1 ? 's' : ''}`;
}

function csFmtBars(bars) {
  const r = Math.round(bars * 10) / 10;
  return `${r} bar${r !== 1 ? 's' : ''}`;
}

// A progression step for one sheet step on the target, moved by semis.
function csProgressionStep(s, target, chords, semis, beatsPerBar) {
  const match = matchSheetChord(s.chord, chords, semis);
  const symbol = transposeChordSymbol(s.chord, semis);
  const chord = match
    ? { chordId: match.id, rootName: match.rootName, typeName: match.type.name, category: match.type.category, notes: match.notes, noteCount: match.noteCount }
    : { chordId: null, rootName: symbol.match(/^[A-G][#b]?/)?.[0] ?? '', typeName: s.chord.type?.name ?? s.chord.suffix, category: s.chord.type?.category ?? '', notes: [], noteCount: 0, missing: true };
  const where = target.kind === 'hp'
    ? { layoutId: target.layoutId, layoutData: target.layout.isCustom ? JSON.parse(JSON.stringify(target.layout)) : null, scaleName: target.name }
    : { layoutId: ocLayoutId(target.inst), layoutData: null, scaleName: target.inst.name, family: target.inst.family, instrumentId: entryInstId(target.inst) };
  const len = stepLength(s.beats, beatsPerBar);
  const step = newProgressionStep({ ...chord, ...where, symbol, section: s.section ?? null }, { bars: len.bars });
  if (len.beats != null) step.beats = len.beats;
  return step;
}

function csKeyRow(c, selected, firstSym) {
  const band = coverageBand(c.score);
  const badge = band === 'plays' ? uiBadge('Plays', 'success') : band === 'swaps' ? uiBadge('A few missing', 'warning') : uiBadge('Breaks down');
  const meta = `${Math.round(c.score * 100)}% · ${c.playable} of ${c.total} steps · starts on ${escHtml(firstSym)}`
    + (c.missing.length ? ` · missing ${escHtml(c.missing.slice(0, 4).join(', '))}${c.missing.length > 4 ? '…' : ''}` : '');
  return `
    <button type="button" class="row cs-key${selected ? ' is-current' : ''}" role="radio" aria-checked="${selected ? 'true' : 'false'}"
      data-action="cs-semis" data-semis="${c.semis}">
      <span class="row-lead"><span class="row-check">${selected ? icon('check') : ''}</span></span>
      <span class="row-text"><span class="row-title">${escHtml(csShiftLabel(c.semis))}</span><span class="row-meta">${meta}</span></span>
      <span class="row-trail">${badge}</span>
    </button>`;
}

function chordSheetSheet() {
  const cs = state.chordSheet;
  const targets = csTargets();
  if (cs.step === 'paste') {
    const targetField = targets.length
      ? uiField({
        label: 'Play on', id: 'cs-target',
        control: uiPicker({
          id: 'cs-target', value: cs.target, label: 'Play on', action: 'cs-target',
          options: targets.map(t => ({ value: t.key, label: `${t.name}${t.kind === 'oc' ? ` (${t.inst.family})` : ''}`, keywords: [t.kind === 'oc' ? t.inst.family : 'handpan'] })),
        }),
      })
      : '<p class="cs-note">Add an instrument first: the chords are fitted to one.</p>';
    return uiSheet({
      key: 'chordsheet', title: 'Paste a chord sheet', close: 'cs-cancel',
      body: `<div class="hp-sheet-form">
        ${uiField({
          label: 'Chord sheet', id: 'cs-text', error: cs.error,
          help: 'ChordPro ([Am] in the words, {title}, {tempo}, {time: 3/4}, {soc}…{eoc}) or chords over lyrics. Bars split on |; lyrics are left out.',
          control: `<textarea class="input cs-text" id="cs-text" rows="9" spellcheck="false" autocapitalize="off" autocomplete="off"
            placeholder="{title: My song}&#10;{tempo: 90}&#10;| Am | Dm | Am | Bbm |&#10;[F]Words with [C]chords in them">${escHtml(cs.text)}</textarea>`,
        })}
        ${targetField}
      </div>`,
      footer: `
        <button type="button" class="btn btn-ghost" data-action="cs-cancel">Cancel</button>
        <button type="button" class="btn btn-primary" data-action="cs-next" ${targets.length ? '' : 'disabled'}>Next</button>`,
    });
  }

  // Fit: name, the best keys with their coverage, and the chords in order.
  const { sheet, target, chords } = csModel(cs);
  const ranked = rankTranspositions(sheet.steps, chords);
  const shown = ranked.slice(0, 3);
  if (!shown.some(c => c.semis === 0)) shown.push(ranked.find(c => c.semis === 0));
  if (!shown.some(c => c.semis === cs.semis)) shown.push(ranked.find(c => c.semis === cs.semis));
  const first = sheet.steps[0]?.chord;
  const bars = sheet.steps.reduce((n, s) => n + s.beats, 0) / sheet.beatsPerBar;
  const facts = [
    `${sheet.steps.length} chord${sheet.steps.length !== 1 ? 's' : ''}`, csFmtBars(bars),
    `${sheet.beatsPerBar}/${sheet.beatUnit}`, sheet.bpm ? `${sheet.bpm} BPM` : `${PROG_DEFAULTS.bpm} BPM (none given)`,
  ].join(' · ');
  const missingNow = new Set(sheet.steps.filter(s => !matchSheetChord(s.chord, chords, cs.semis)).map(s => s.symbol));
  const preview = sheet.steps.slice(0, 64).map((s, i) => {
    const sym = transposeChordSymbol(s.chord, cs.semis);
    const miss = missingNow.has(s.symbol);
    const sec = s.section && s.section !== sheet.steps[i - 1]?.section ? `<span class="cs-sec">${escHtml(s.section)}</span>` : '';
    return `${sec}<span class="chip is-static${miss ? ' is-off' : ''}"${miss ? ' title="Not on this instrument"' : ''}>${escHtml(sym)}${miss ? '<span class="sr-only"> (not on this instrument)</span>' : ''}</span>`;
  }).join('') + (sheet.steps.length > 64 ? `<span class="chip is-static">+${sheet.steps.length - 64}</span>` : '');
  return uiSheet({
    key: 'chordsheet', title: `Fit to ${target?.name ?? 'instrument'}`, close: 'cs-cancel',
    body: `<div class="hp-sheet-form">
      ${uiField({ label: 'Name', id: 'cs-name', control: `<input class="input" id="cs-name" value="${escHtml(cs.name)}" placeholder="Playlist name" autocomplete="off">` })}
      <p class="cs-facts">${escHtml(facts)}${sheet.sections.length ? `<br>Sections: ${escHtml(sheet.sections.join(', '))}` : ''}</p>
      ${sheet.unknown.length ? `<p class="cs-note">${icon('info')}<span>Not in the app's chord list: ${escHtml(sheet.unknown.join(', '))}. They stay in, marked, and are skipped when playing.</span></p>` : ''}
      <div>
        <h3 class="cs-label" id="cs-key-label">Key</h3>
        <div class="list" role="radiogroup" aria-labelledby="cs-key-label">${shown.map(c => csKeyRow(c, c.semis === cs.semis, transposeChordSymbol(first, c.semis))).join('')}</div>
      </div>
      <div>
        <h3 class="cs-label">Chords${cs.semis ? ` (${escHtml(csShiftLabel(cs.semis).toLowerCase())})` : ''}</h3>
        <div class="chips cs-preview">${preview}</div>
      </div>
    </div>`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="cs-back">Back</button>
      <button type="button" class="btn btn-primary" data-action="cs-save">Save playlist</button>`,
  });
}

// Next: parse; with chords, pick the best key and go on to fitting.
function csNext() {
  const cs = state.chordSheet;
  cs.text = document.getElementById('cs-text')?.value ?? cs.text;
  const { sheet, chords } = csModel(cs);
  if (!sheet.steps.length) {
    cs.error = cs.text.trim() ? 'No chords found. Put chords on lines of their own, or in [brackets] inside the words.' : 'Paste a chord sheet first';
    render();
    return;
  }
  const best = rankTranspositions(sheet.steps, chords)[0];
  const asWritten = sheetCoverage(sheet.steps, chords, 0);
  Object.assign(cs, { step: 'fit', error: '', semis: best.score > asWritten.score ? best.semis : 0, name: cs.name || sheet.title || 'Chord sheet' });
  render();
}

function csSave() {
  const cs = state.chordSheet;
  cs.name = document.getElementById('cs-name')?.value ?? cs.name;
  const { sheet, target, chords } = csModel(cs);
  if (!target || !sheet.steps.length) return;
  const steps = sheet.steps.map(s => csProgressionStep(s, target, chords, cs.semis, sheet.beatsPerBar));
  const extra = { bpm: sheet.bpm ?? PROG_DEFAULTS.bpm, beatsPerBar: sheet.beatsPerBar, transpose: cs.semis, source: 'chordsheet' };
  if (target.kind === 'hp') extra.level = 'arpeggio';
  const name = cs.name.trim() || sheet.title || 'Chord sheet';
  const into = cs.progId ? progFind(cs.progId) : null;
  let id;
  if (into && !into.steps.length && fillProgression(into.id, steps, extra)) id = into.id;
  else id = addProgression(name, steps, extra);
  state.progressions = getProgressions();
  state.chordSheet = null;
  // Put the instrument it was fitted to on screen, so the progression plays.
  if (target.kind === 'oc' && state.currentInstrumentId !== target.inst.id) openInstrument(target.inst.id, { push: false });
  if (target.kind === 'hp' && (hpCurrentLayoutId() !== target.layoutId || (state.currentInstrumentId && !usesLayout(getInstrument(state.currentInstrumentId))))) {
    progLoadHandpan({ layoutId: target.layoutId, layoutData: target.layout.isCustom ? target.layout : null, scaleName: target.name });
  }
  const cov = sheetCoverage(sheet.steps, chords, cs.semis);
  if (state.view === 'progression' && state.activeProgressionId === id) render();
  else openProgression(id);
  showToast(cov.playable === cov.total ? `Saved: all ${cov.total} steps play on ${target.name}` : `Saved: ${cov.playable} of ${cov.total} steps play on ${target.name}`);
}

// ── Change: Chord sheet ───────────────────────────────────────────────────
registerActions({
  'cs-target': (el, e, action) => { if (!(state.chordSheet)) return; state.chordSheet.target = el.value; return; },
}, CHANGE_ACTIONS);
