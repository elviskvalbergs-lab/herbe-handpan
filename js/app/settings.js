// Settings and clay bodies.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { featureName } from '../features.js';
import { brandLogo } from '../brand.js';
import { getClayBodies, saveClayBodies, usesLayout } from '../instruments.js';

function openSettings({ push = true } = {}) {
  stopAutoplay();
  Object.assign(state, { view: 'settings', clayEdit: null, menu: false });
  refreshAccountCounts();
  state.oc.handLegend = false;
  if (push) navPush('#settings'); else navReplace('#settings');
  render();
}

// Settings (#settings): everything that is set once (docs/design-system.md
// §6.19). Every row writes an existing pref through savePrefs(), so it
// persists and syncs as before.
const AUTOPLAY_SECONDS = [3, 4, 5, 6, 8, 10];

// Which instrument families the person plays: the ones in My instruments and
// the one open now. Settings shows a family's rows only to those who play it.
function settingsFamilies() {
  const fams = new Set(state.instruments.map(i => (usesLayout(i) ? 'layout' : 'wind')));
  if (state.layout) fams.add('layout');
  if (state.currentInstrumentId && !state.layout && currentInstrument()) fams.add('wind');
  return fams;
}

function viewSettings() {
  const secIdx = AUTOPLAY_SECONDS.indexOf(state.autoplaySeconds);
  const clays = getClayBodies();
  const fams = settingsFamilies();
  return `${backAppBar('Settings')}
    <div class="settings">
      <h2 class="list-title">Notes and display</h2>
      <div class="list">
        ${uiSetRow({ label: 'Theme', control: uiSeg([
          { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'auto', label: 'Auto' },
        ], state.theme, { action: 'set-theme', label: 'Theme' }) })}
        ${uiSetRow({ label: 'Note names', help: 'Auto writes each instrument the way its scale is written: B♭ on a D Kurd, F# on a D major whistle', control: uiSeg([
          { value: 'auto', label: 'Auto' }, { value: 'sharps', label: 'C#' }, { value: 'flats', label: 'D♭' },
        ], state.noteNames, { action: 'set-flats', label: 'Note names' }) })}
        ${uiSetRow({ label: 'Note style', control: uiSeg([
          { value: 'letters', label: 'C D E' }, { value: 'solfege', label: 'Do Re Mi' },
        ], state.useSolfege ? 'solfege' : 'letters', { action: 'set-solfege', label: 'Note style' }) })}
      </div>

      <h2 class="list-title">Playing</h2>
      <div class="list">
        ${uiSetRow({ label: 'Speed', help: 'How fast chords, scales and fingerings play, everywhere', wide: true, control: tempoControlHtml() })}
        ${uiSetRow({ label: 'Seconds per chord in auto-play', control: uiStepper({
          value: `${state.autoplaySeconds} s`, label: 'Seconds per chord', action: 'set-autoplay-step',
          min: secIdx === 0, max: secIdx === AUTOPLAY_SECONDS.length - 1,
        }) })}
      </div>

      ${fams.has('layout') ? `<h2 class="list-title">Handpans and drums</h2>
      <div class="list">
        ${uiSetRow({ label: 'Ring orientation', help: 'Rotated puts the two lowest notes towards you', control: uiSeg([
          { value: 'standard', label: 'Standard' }, { value: 'rotated', label: 'Rotated' },
        ], state.ringRotated ? 'rotated' : 'standard', { action: 'set-rotation', label: 'Ring orientation' }) })}
      </div>` : ''}

      ${fams.has('wind') ? `<h2 class="list-title">Ocarinas and flutes</h2>
      <div class="list">
        ${uiSwitchRow({ label: 'Finger labels in holes', help: 'R4, L1, LT inside each hole', on: state.showFingers, action: 'oc-toggle-fingers' })}
        ${canBuild() || state.showSizes ? uiSwitchRow({ label: 'Hole sizes in mm', help: 'The builder always shows sizes', on: state.showSizes, action: 'oc-toggle-sizes' }) : ''}
        ${uiSwitchRow({ label: 'Close-up of flute holes', help: 'Zoom in on the holes when a flute’s fingering is shown', on: state.closeUp, action: 'toggle-closeup' })}
        ${uiRow({ title: 'Which finger is which', action: 'oc-hand-open', chevron: true })}
        ${uiRow({ title: 'Show the diagram legend again', meta: 'The hole and finger legends show once more', action: 'reset-legends' })}
      </div>` : ''}

      ${canBuild() ? `<h2 class="list-title">Building</h2>
      <div class="list">
        ${uiRow({ title: 'Clay bodies', meta: `${clays.length} clay bod${clays.length === 1 ? 'y' : 'ies'} · shrinkage used by the builder`, action: 'open-clay-bodies', chevron: true })}
        ${uiRow({ title: 'Microphone readings', meta: 'What Listen hears: note strengths, chord guesses, confidence, thresholds', action: 'open-listen-debug', chevron: true })}
      </div>` : ''}
      ${makerSettingsHtml()}

      <h2 class="list-title">Account and about</h2>
      <div class="list">
        ${accountSettingsHtml()}
        ${uiRow({ title: featureName('help'), meta: 'How to set up, play, save and share. Works offline', action: 'help-open', data: { id: '' }, lead: 'info', chevron: true })}
        ${uiRow({ title: 'Send feedback', meta: 'Something confusing, wrong or missing? Tell us, it really helps', action: 'open-feedback', lead: 'message-square', chevron: true })}
        ${uiRow({ title: 'Check for updates', meta: 'Reloads the latest app version and synced data', action: 'check-updates', lead: 'refresh' })}
        <div class="brand-about">${brandLogo()}<span class="brand-about-line">Notes, chords and scales for handpan, tongue drum, kalimba, ocarina and flute.</span></div>
      </div>
    </div>`;
}

// Settings › Clay bodies (#settings/clay): name and shrinkage of each clay
// body the builder offers. A row opens a sheet to edit it.
function viewClayBodies() {
  const clays = getClayBodies();
  return `${backAppBar('Clay bodies', { fallback: 'settings' })}
    <div class="settings">
      <p class="settings-intro">The builder lowers each hole's target by the clay's shrinkage, and learns it from every finished build.</p>
      <div class="list">
        ${clays.map(c => uiRow({
          lead: 'circle-dot', title: c.name, chevron: true, action: 'clay-edit', data: { id: c.id },
          meta: `${Number(c.shrinkPct).toFixed(1)}% shrinkage${c.builds ? ` · learned from ${c.builds} build${c.builds !== 1 ? 's' : ''}` : ''}`,
        })).join('')}
        ${uiRow({ lead: 'plus', title: 'Add a clay body', action: 'clay-edit', data: { id: '__new__' } })}
      </div>
    </div>`;
}

// The edit sheet of a clay body (state.clayEdit = { id, name, pct, error }).
function clayEditSheet() {
  const c = state.clayEdit;
  const isNew = c.id === '__new__';
  return uiSheet({
    key: 'clay', title: isNew ? 'Add a clay body' : 'Edit clay body', close: 'clay-cancel',
    body: `
      <div class="set-form is-sheet">
        ${uiField({ label: 'Name', id: 'clay-name-input', error: c.error === 'name' ? 'Give it a name' : '',
          control: `<input class="input" id="clay-name-input" value="${escHtml(c.name)}" placeholder="Stoneware, Earthenware…">` })}
        ${uiField({ label: 'Shrinkage, leather-hard to fired', id: 'clay-pct-input', error: c.error === 'pct' ? 'Between 0 and 30%' : '',
          help: 'From the clay\'s data sheet, or 11% if you don\'t know it',
          control: `<span class="input-unit"><input class="input" id="clay-pct-input" type="number" inputmode="decimal" step="0.1" min="0" max="30" value="${escHtml(c.pct)}"><span class="input-unit-label">%</span></span>` })}
      </div>`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="clay-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" data-action="clay-save">${isNew ? 'Add' : 'Save'}</button>`,
  });
}

// ── Click: Settings ───────────────────────────────────────────────────────
registerActions({
  'set-theme': (el, e, action) => { state.theme = el.dataset.value; applyTheme(); savePrefs(); render(); return; },
  'set-flats': (el, e, action) => { state.noteNames = ['auto', 'sharps', 'flats'].includes(el.dataset.value) ? el.dataset.value : 'auto'; savePrefs(); render(); return; },
  'set-solfege': (el, e, action) => { state.useSolfege = el.dataset.value === 'solfege'; savePrefs(); render(); return; },
  'tempo-set': (el, e, action) => { setTempo(parseInt(el.dataset.value, 10), { preview: true }); render(); return; },
  'speed-open': (el, e, action) => { state.speedSheet = true; state.hpMore = false; state.oc.chordMore = false; render(); return; },
  'speed-close': (el, e, action) => { state.speedSheet = false; render(); return; },
  'set-rotation': (el, e, action) => { state.ringRotated = el.dataset.value === 'rotated'; savePrefs(); render(); return; },
  'set-autoplay-step': (el, e, action) => {
    const i = AUTOPLAY_SECONDS.indexOf(state.autoplaySeconds);
    const next = AUTOPLAY_SECONDS[Math.max(0, Math.min(AUTOPLAY_SECONDS.length - 1, (i < 0 ? 1 : i) + parseInt(el.dataset.delta, 10)))];
    state.autoplaySeconds = next;
    savePrefs();
    render();
    return;
  },
  'reset-legends': (el, e, action) => {
    state.ocLegendSeen = false;
    state.handLegendSeen = false;
    savePrefs();
    showToast('The legend will show again');
    return;
  },
  'open-clay-bodies': (el, e, action) => {
    state.view = 'clay';
    navPush('#settings/clay');
    render();
    return;
  },
  'clay-edit': (el, e, action) => {
    const c = getClayBodies().find(x => x.id === el.dataset.id);
    state.clayEdit = c
      ? { id: c.id, name: c.name, pct: String(c.shrinkPct), error: null }
      : { id: '__new__', name: '', pct: '11', error: null };
    render();
    return;
  },
  'clay-cancel': (el, e, action) => { state.clayEdit = null; render(); return; },
  'clay-save': (el, e, action) => {
    const c = state.clayEdit;
    if (!c) return;
    c.name = (document.getElementById('clay-name-input')?.value ?? c.name).trim();
    c.pct = document.getElementById('clay-pct-input')?.value ?? c.pct;
    const pct = parseFloat(c.pct);
    c.error = !c.name ? 'name' : !(pct >= 0 && pct <= 30) ? 'pct' : null;
    if (c.error) { render(); return; }
    const list = getClayBodies();
    if (c.id === '__new__') list.push({ id: 'clay-' + Date.now().toString(36), name: c.name, shrinkPct: pct, builds: 0 });
    else Object.assign(list.find(x => x.id === c.id) ?? {}, { name: c.name, shrinkPct: pct });
    saveClayBodies(list);
    state.clayEdit = null;
    showToast(`${c.name} saved`);
    render();
    return;
  },
  'check-updates': (el, e, action) => {
    navigator.serviceWorker?.getRegistration?.().then(r => r?.update()).catch(() => {});
    if (accountOn()) syncNow();
    showToast(accountOn() ? 'Checked for updates and synced' : 'Checked for updates');
    return;
  },
});

// ── Change: Settings ──────────────────────────────────────────────────────
registerActions({
  'set-autoplay-seconds': (el, e, action) => {
    state.autoplaySeconds = parseInt(el.value, 10);
    savePrefs();
    if (state.autoplayOn && _autoplayTimer) {
      clearInterval(_autoplayTimer);
      _autoplayTimer = setInterval(advanceAutoplay, state.autoplaySeconds * 1000);
    }
  },
}, CHANGE_ACTIONS);
