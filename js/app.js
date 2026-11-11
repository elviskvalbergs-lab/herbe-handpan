import {
  SCALES, CHORD_TYPES, CHORD_CATEGORIES, createLayoutFromScale,
  getAllNotes, NOTE_NAMES, notePC, getNoteName, noteToMidi, displayNote,
} from './data.js';
import {
  getSavedLayouts, saveLayout, deleteLayout,
  getFavorites, isFavorite,
  getPlaylists, addPlaylist, renamePlaylist, deletePlaylist,
  addChordToPlaylist, removeChordFromPlaylist, reorderChordInPlaylist,
  isChordBookmarkedAnyVoicing, updatePlaylistChordVoicing,
} from './storage.js';
import { findAllChords, getRelatedChords, identifyChord } from './chords.js';
import { icon } from './icons.js';
import { initAudio, playNote, playChord, playScale, playSequence } from './audio.js';
import { renderPan, PAN_SVG_ID, updatePanHighlight, updatePanShellMode, updatePanPlaying } from './pan.js';
import { noteWindows, chambersNeeded, scaleToMidis } from './ocarina.js';
import {
  renderFingering, renderHandLegend, fingeringMoves, playableMidis,
  ocarinaToLayout, arpeggioOrder, fitChordToInstrument, nextVoicing,
} from './ocarina-ui.js';
import { playablePairs, centsBetween, midiToHz } from './ocarina.js';
import { startTuner } from './tuner.js';
import {
  STAGE_ORDER, STAGE_TITLES, buildShrink, chamberBuild, stageTargets, noteAdvice,
  leatherHolePlan, bodyPlan, nextStage, finishBuild, updateClayBody,
  defaultCustomHoles, calibrateChamber,
} from './builder.js';
import { buildScaleChambers, OC_FINGER_ORDER } from './ocarina.js';
import { chartsForFamily, getChart, instrumentFromChart } from './charts.js';
import {
  INSTRUMENT_FAMILIES, getInstruments, getInstrument, saveInstrument, deleteInstrument,
  touchInstrument, syncHandpanInstruments, isOnboarded, setOnboarded, handpanInstrumentId,
  createScaleOcarina, createCustomOcarina, instrumentStatus, midiToNoteName,
  getClayBodies, saveClayBodies, getInstrumentsRaw, writeInstrumentsRaw,
  newPublicId, mergeInstruments, copySharedInstrument,
} from './instruments.js';

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  view: 'selector',        // 'home' | 'wizard' | 'instrument' | 'selector' | 'editor' | 'chords' | 'playlist'
  instruments: [],         // My instruments (instruments.js), most recently played first
  currentInstrumentId: null, // instrument being played; null = browsing the catalogue
  wizard: null,            // add-instrument wizard state, see viewWizard()
  tuner: { on: false, reading: null, error: null, lastAdvance: 0 }, // microphone tuner
  shared: null,            // instrument opened from a share link (#p/<code>), read-only
  sharedStatus: null,      // 'loading' | 'missing' while a share link loads
  shareModal: null,        // { code, url, qr } while the share dialog is open
  oc: newOcState(),        // ocarina / flute views, see newOcState()
  showFingers: false,      // finger labels (R4, L1…) inside ocarina holes
  showSizes: false,        // hole sizes in mm on ocarina diagrams
  ocLegendSeen: false,     // the hole-state legend line has been dismissed
  handLegendSeen: false,   // the finger legend has been shown once
  layout: null,            // current Layout object
  shellMode: 'both',       // 'top' | 'bottom' | 'both'
  ringRotated: false,      // false = standard; true = rotated half-slot
  noteCountFilter: 'all',     // 'all' | '9' | '10' | '11+'
  scaleSearch: '',            // filter text for scale selector
  selectedChord: null,        // ChordResult or null
  chords: [],                 // computed from layout
  chordFilter: { category: 'All', root: 'All', playlist: 'All' },
  useFlats: false,           // false = sharp (C#, F#, G#…); true = flat (Db, Gb, Ab…)
  useSolfege: false,         // false = letters (C, D, E…); true = solfège (Do, Re, Mi…)
  savedLayouts: getSavedLayouts(),
  favorites: getFavorites(),
  playlists: getPlaylists(),
  activePlaylistId: null,
  pickerChordFavId: null,
  pickerChordObj: null,
  pickerNewPlaylist: false,
  chordCountSet: new Set(), // empty = all; values: '2','3','4','5+'
  pendingSlot: null,       // { shell: 'top'|'bottom'|'ding', index: number }
  authEmail: '',
  authLinkSent: false,
  authCode: '',
  autoplayOn: false,
  autoplayPlaylistId: null,
  autoplaySeconds: 4,
  discoverMode: false,
  discoverNotes: [],       // ordered note-with-octave strings clicked on the pan
  sourcePlaylistId: null,  // playlist the current chord was opened from, if any
  sourceEntryId: null,     // that entry's id at load time — lets "update" find it after a swap
};

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  if (state.view === 'home') app.innerHTML = viewHome();
  else if (state.view === 'wizard') app.innerHTML = viewWizard();
  else if (state.view === 'instrument') app.innerHTML = viewInstrument();
  else if (state.view === 'selector') app.innerHTML = viewSelector();
  else if (state.view === 'editor') app.innerHTML = viewEditor();
  else if (state.view === 'chords') app.innerHTML = viewChords();
  else if (state.view === 'playlist') app.innerHTML = viewPlaylist();
  if (state.shareModal) app.insertAdjacentHTML('beforeend', shareModalHtml());
  if (state.tuner.on) app.insertAdjacentHTML('beforeend', `<div id="tuner-panel" class="tuner-panel">${tunerPanelInner()}</div>`);
}

// ── View 1: Scale Selector ───────────────────────────────────────────────────
function viewSelector() {
  const q = state.scaleSearch.trim().toLowerCase();
  const filtered = SCALES.filter(s => {
    const total = 1 + s.top.notes.length + s.bottom.notes.length;
    if (state.noteCountFilter === '9' && total !== 9) return false;
    if (state.noteCountFilter === '10' && total !== 10) return false;
    if (state.noteCountFilter === '11+' && total < 11) return false;
    if (q && !s.name.toLowerCase().includes(q) && !s.family.toLowerCase().includes(q) && !s.desc.toLowerCase().includes(q)) return false;
    return true;
  });

  const { savedLayouts, favorites, useFlats } = state;

  const authBar = authBarHtml();
  const favsSection = playlistsSectionHtml();

  const savedSection = savedLayouts.length === 0 ? '' : `
    <div class="pwa-section">
      <div class="pwa-section-title">My Layouts</div>
      <div class="pwa-scroll">
        ${savedLayouts.map(l => `
          <div class="saved-card" data-action="load-saved" data-id="${escHtml(l.id)}">
            <div class="saved-card-name">${escHtml(l.name)}</div>
            <div class="saved-card-meta">${l.noteCount} notes</div>
            <button class="saved-del" data-action="delete-saved" data-id="${escHtml(l.id)}" title="Remove">${icon('x')}</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  return `
    <div class="app-header">
      <div class="breadcrumb">
        <a data-action="back-home">← My instruments</a>
        <span>/</span>
        <span>Other instrument</span>
      </div>
    </div>
    <div class="hint" style="margin:-12px 0 16px">Try any handpan scale without saving it. Save a layout to add it to My instruments.</div>
    <div class="selector-controls">
      <input class="scale-search" id="scale-search-input" type="text"
        placeholder="Search scales by name or family…"
        value="${escHtml(state.scaleSearch)}">
      <div class="pills">
        ${['all', '9', '10', '11+'].map(f => `
          <button class="pill ${state.noteCountFilter === f ? 'active' : ''}"
            data-action="filter-notes" data-val="${f}">
            ${f === 'all' ? 'All' : f + ' notes'}
          </button>
        `).join('')}
        <button class="pill ${useFlats ? 'active' : ''}"
          data-action="toggle-flats" title="Switch between sharp (C#) and flat (Db) notation">
          ♭ Flats
        </button>
      </div>
    </div>
    ${authBar}
    ${savedSection}${favsSection}
    <div class="scale-grid">
      ${filtered.length === 0
        ? '<div class="empty-state">No scales match your search</div>'
        : filtered.map(s => `
          <div class="scale-card" data-action="select-scale" data-id="${s.id}">
            <div class="family-badge">${s.family}</div>
            <div class="scale-card-name">${s.name}</div>
            <div class="scale-card-meta">${1 + s.top.notes.length} notes · ${displayNote(s.top.ding, useFlats)} ding</div>
            <div class="scale-card-desc">${s.desc}</div>
          </div>
        `).join('')
      }
    </div>
  `;
}


// Sync sign-in bar, shared by My instruments and the scale catalogue.
function authBarHtml() {
  return isLoggedIn()
    ? `<div class="auth-bar">
         <span class="hint auth-user">${escHtml(getUserEmail())}</span>
         <button class="btn btn-secondary btn-sm icon-btn" data-action="auth-sync" title="Sync now">${icon('refresh')}</button>
         <button class="btn btn-secondary btn-sm" data-action="auth-signout">Sign out</button>
       </div>`
    : state.authLinkSent
    ? `<div class="auth-bar auth-bar--code">
         <span class="hint" style="color:var(--primary);font-size:12px">Code sent to ${escHtml(state.authEmail)}</span>
         <div class="auth-code-row">
           <input class="auth-code-input" id="auth-code-input" type="text"
             inputmode="numeric" pattern="[0-9]*" maxlength="8"
             placeholder="Code from email" value="${escHtml(state.authCode)}"
             autocomplete="one-time-code">
           <button class="btn btn-primary btn-sm" data-action="auth-verify">Verify</button>
           <button class="btn btn-secondary btn-sm icon-btn" data-action="auth-cancel">${icon('x')}</button>
         </div>
       </div>`
    : `<div class="auth-bar">
         <input class="auth-email-input" id="auth-email-input" type="email"
           placeholder="Email to sync playlists across devices" value="${escHtml(state.authEmail)}">
         <button class="btn btn-secondary btn-sm" data-action="auth-send-link">${icon('refresh')} Sync</button>
       </div>`;

}

// My Playlists strip, shared by My instruments and the scale catalogue.
function playlistsSectionHtml() {
  return state.playlists.length === 0 ? '' : `
    <div class="pwa-section">
      <div class="pwa-section-title">My Playlists</div>
      <div class="pwa-scroll">
        ${state.playlists.map(pl => `
          <div class="playlist-card" data-action="open-playlist-chords" data-id="${escHtml(pl.id)}">
            <div class="playlist-card-name">${escHtml(pl.name)}</div>
            <div class="playlist-card-meta">${pl.chords.length} chord${pl.chords.length !== 1 ? 's' : ''}</div>
            <div class="playlist-card-edit" data-action="open-playlist" data-id="${escHtml(pl.id)}" title="Edit playlist">${icon('pencil')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

}

// ── My instruments ───────────────────────────────────────────────────────────

// First breadcrumb on the handpan views: back to My instruments when playing
// one of them, back to the scale catalogue when just browsing.
function backCrumb() {
  return state.currentInstrumentId
    ? `<a data-action="back-home">← My instruments</a>`
    : `<a data-action="back-selector">← Scales</a>`;
}

function refreshInstruments() {
  syncHandpanInstruments(getSavedLayouts());
  state.instruments = getInstruments();
  if (state.instruments.length > 0) setOnboarded();
}

function viewHome() {
  const cards = state.instruments.map(inst => `
    <div class="scale-card instrument-card" data-action="open-instrument" data-id="${escHtml(inst.id)}">
      <div class="family-badge">${escHtml(INSTRUMENT_FAMILIES.find(f => f.id === inst.family)?.name ?? inst.family)}</div>
      <div class="scale-card-name">${escHtml(inst.name)}</div>
      <div class="scale-card-meta">${escHtml(instrumentStatus(inst))}</div>
      <button class="saved-del" data-action="delete-instrument" data-id="${escHtml(inst.id)}" title="Remove">${icon('x')}</button>
    </div>
  `).join('');

  return `
    <div class="app-header">
      <div class="app-title">My instruments</div>
      <div style="display:flex;gap:6px;margin-left:auto">
        <button class="btn btn-primary btn-sm" data-action="add-instrument">${icon('plus')} Add instrument</button>
        <button class="btn btn-secondary btn-sm" data-action="other-instrument">Other instrument</button>
        ${tunerButton()}
      </div>
    </div>
    ${authBarHtml()}
    ${state.instruments.length === 0
      ? `<div class="empty-state">No instruments yet. Add the ones you play, or open “Other instrument” to try any scale.</div>`
      : `<div class="scale-grid">${cards}</div>`}
    ${playlistsSectionHtml()}
  `;
}

// The add-instrument wizard. First run asks which families the user plays,
// then walks through one step per ticked family.
function newWizard(firstRun) {
  return {
    firstRun,
    step: 'families',
    families: [],
    queue: [],
    search: '',
    oc: { path: null, scaleId: 'D-Kurd', transpose: 0, includeGu: true, chambers: null, windowStart: null, name: '', holeCount: 12, chartId: 'custom', keyId: null },
    fl: { chartId: chartsForFamily('flute')[0]?.id ?? null, keyId: null, name: '' },
  };
}

function wizardNext() {
  const w = state.wizard;
  const next = w.queue.shift();
  if (next) { w.step = next; render(); return; }
  setOnboarded();
  state.wizard = null;
  refreshInstruments();
  state.view = 'home';
  history.replaceState(null, '', location.pathname);
  render();
}

// Notes for the ocarina being designed in the wizard, with the chamber and
// note-window choice applied.
function wizardOcarinaPlan() { return planOcarina(state.wizard.oc); }

// Notes of a scale-built ocarina from its design choices: scale, transpose,
// gu notes, chamber count (with the note window when fewer chambers than
// the full scale needs) and single notes switched off.
function planOcarina(oc) {
  const scale = SCALES.find(sc => sc.id === oc.scaleId);
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

function viewWizard() {
  const w = state.wizard;
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const header = `
    <div class="app-header">
      <div class="breadcrumb">
        ${w.firstRun ? `<span>Welcome</span>` : `<a data-action="back-home">← My instruments</a><span>/</span><span>Add instrument</span>`}
      </div>
    </div>`;

  if (w.step === 'families') {
    return `${header}
      <div class="wizard">
        <div class="wizard-title">Which instruments do you play?</div>
        <div class="pills">
          ${INSTRUMENT_FAMILIES.map(f => {
            const unavailable = f.id === 'flute' && chartsForFamily('flute').length === 0;
            return `
            <button class="pill ${w.families.includes(f.id) ? 'active' : ''}" data-action="wizard-family" data-family="${f.id}"
              ${unavailable ? 'disabled title="Flute fingering charts are still being sourced"' : ''}>${f.name}${unavailable ? ' (soon)' : ''}</button>`;
          }).join('')}
        </div>
        <div class="wizard-actions">
          <button class="btn btn-primary" data-action="wizard-families-next" ${w.families.length ? '' : 'disabled'}>Next →</button>
          ${w.firstRun ? `<button class="btn btn-secondary" data-action="wizard-skip">Skip, just browse scales</button>` : ''}
        </div>
      </div>`;
  }

  if (w.step === 'handpan') {
    const q = w.search.trim().toLowerCase();
    const list = SCALES.filter(sc => !q || sc.name.toLowerCase().includes(q) || sc.family.toLowerCase().includes(q));
    return `${header}
      <div class="wizard">
        <div class="wizard-title">Which handpan do you have?</div>
        <div class="hint">Pick its scale. For a custom layout, use Other instrument → Clone &amp; Customize, then Save.</div>
        <input class="scale-search" id="wizard-search-input" type="text" placeholder="Search scales…" value="${escHtml(w.search)}">
        <div class="scale-grid">
          ${list.map(sc => `
            <div class="scale-card" data-action="wizard-pick-handpan" data-id="${sc.id}">
              <div class="family-badge">${sc.family}</div>
              <div class="scale-card-name">${sc.name}</div>
              <div class="scale-card-meta">${1 + sc.top.notes.length + sc.bottom.notes.length} notes · ${displayNote(sc.top.ding, uf, us)} ding</div>
            </div>`).join('')}
        </div>
        <div class="wizard-actions"><button class="btn btn-secondary" data-action="wizard-skip-step">Skip</button></div>
      </div>`;
  }

  if (w.step === 'ocarina') {
    const oc = w.oc;
    if (!oc.path) {
      return `${header}
        <div class="wizard">
          <div class="wizard-title">Add an ocarina</div>
          <div class="wizard-choices">
            <div class="scale-card" data-action="wizard-oc-path" data-path="have">
              <div class="scale-card-name">I have one</div>
              <div class="scale-card-desc">A bought ocarina. You'll set it up by playing it into the tuner, so the maker doesn't matter.</div>
            </div>
            <div class="scale-card" data-action="wizard-oc-path" data-path="make">
              <div class="scale-card-name">I'm making one</div>
              <div class="scale-card-desc">A clay ocarina tuned to a handpan scale.</div>
            </div>
          </div>
          <div class="wizard-actions"><button class="btn btn-secondary" data-action="wizard-skip-step">Skip</button></div>
        </div>`;
    }
    if (oc.path === 'have') {
      return `${header}
        <div class="wizard">
          <div class="wizard-title">Your ocarina</div>
          <label class="wizard-field">Name
            <input class="name-input" id="wizard-oc-name" value="${escHtml(oc.name)}" placeholder="My ocarina">
          </label>
          ${chartsForFamily('ocarina').length ? `
            <label class="wizard-field">Type
              <select class="select-input" data-action="wizard-chart" data-fam="oc">
                <option value="custom" ${oc.chartId === 'custom' ? 'selected' : ''}>Unknown or other: chart it with the tuner</option>
                ${chartsForFamily('ocarina').map(c => `<option value="${c.id}" ${oc.chartId === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
              </select>
            </label>` : ''}
          ${oc.chartId !== 'custom' && getChart(oc.chartId) ? wizardKeySelect('oc', getChart(oc.chartId), oc.keyId) : `
          <label class="wizard-field">Number of holes, thumb holes included
            <select class="select-input" data-action="wizard-oc-holes">
              ${[4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(n => `<option value="${n}" ${oc.holeCount === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </label>
          <div class="hint">Its fingering chart is worked out from the instrument itself: you blow it into the tuner with all holes closed and then each hole open on its own.</div>`}
          <div class="wizard-actions">
            <button class="btn btn-primary" data-action="wizard-oc-create">Add ocarina</button>
            <button class="btn btn-secondary" data-action="wizard-oc-path" data-path="">Back</button>
          </div>
        </div>`;
    }
    const plan = wizardOcarinaPlan();
    const hasGu = plan.scale.bottom.notes.length > 0;
    return `${header}
      <div class="wizard">
        <div class="wizard-title">Design an ocarina</div>
        <label class="wizard-field">Handpan scale
          <select class="select-input" data-action="wizard-oc-scale">
            ${SCALES.map(sc => `<option value="${sc.id}" ${sc.id === oc.scaleId ? 'selected' : ''}>${escHtml(sc.name)}</option>`).join('')}
          </select>
        </label>
        <div class="wizard-row">
          <label class="wizard-field">Transpose
            <select class="select-input" data-action="wizard-oc-transpose">
              ${Array.from({ length: 13 }, (_, i) => i - 6).map(t => `<option value="${t}" ${t === oc.transpose ? 'selected' : ''}>${t > 0 ? '+' + t : t} semitones</option>`).join('')}
            </select>
          </label>
          ${hasGu ? `<label class="wizard-check"><input type="checkbox" data-action="wizard-oc-gu" ${oc.includeGu ? 'checked' : ''}> Include gu notes</label>` : ''}
        </div>
        <div class="wizard-field">
          <div>The full scale needs ${plan.needed} chamber${plan.needed !== 1 ? 's' : ''}. Build with:</div>
          <div class="pills">
            ${Array.from({ length: plan.needed }, (_, i) => i + 1).map(n => `
              <button class="pill ${n === plan.chambers ? 'active' : ''}" data-action="wizard-oc-chambers" data-n="${n}">${n} chamber${n !== 1 ? 's' : ''}</button>`).join('')}
          </div>
        </div>
        ${plan.windows.length ? `
          <div class="wizard-field">
            <div>Which notes? ${plan.chambers} chamber${plan.chambers !== 1 ? 's' : ''} hold${plan.chambers === 1 ? 's' : ''} part of the scale:</div>
            <div class="pills">
              ${plan.windows.map(win => `
                <button class="pill ${win.chosen ? 'active' : ''}" data-action="wizard-oc-window" data-start="${win.start}">
                  ${nn(win.notes[0])}–${nn(win.notes[win.notes.length - 1])} · ${win.notes.length} notes${win.fromDing ? ' · from the ding' : ''}
                </button>`).join('')}
            </div>
          </div>` : ''}
        <div class="wizard-notes">
          ${plan.all.map(m => `<span class="pill ${plan.notes.includes(m) ? 'active' : ''}">${nn(m)}</span>`).join('')}
        </div>
        <div class="hint">${plan.notes.length} notes · ${plan.notes.length - plan.chambers} holes</div>
        <label class="wizard-field">Name
          <input class="name-input" id="wizard-oc-name" value="${escHtml(oc.name)}" placeholder="${escHtml(plan.scale.name)} ocarina">
        </label>
        <div class="wizard-actions">
          <button class="btn btn-primary" data-action="wizard-oc-create">Start building</button>
          <button class="btn btn-secondary" data-action="wizard-oc-path" data-path="">Back</button>
        </div>
      </div>`;
  }
  if (w.step === 'flute') {
    const fl = w.fl;
    const charts = chartsForFamily('flute');
    const chart = getChart(fl.chartId) ?? charts[0];
    return `${header}
      <div class="wizard">
        <div class="wizard-title">Your flute</div>
        <label class="wizard-field">Name
          <input class="name-input" id="wizard-fl-name" value="${escHtml(fl.name)}" placeholder="${escHtml(chart ? chart.name : 'My flute')}">
        </label>
        <label class="wizard-field">Type
          <select class="select-input" data-action="wizard-chart" data-fam="fl">
            ${charts.map(c => `<option value="${c.id}" ${chart?.id === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
          </select>
        </label>
        ${chart ? wizardKeySelect('fl', chart, fl.keyId) : ''}
        <div class="wizard-actions">
          <button class="btn btn-primary" data-action="wizard-fl-create" ${chart ? '' : 'disabled'}>Add flute</button>
          <button class="btn btn-secondary" data-action="wizard-skip-step">Skip</button>
        </div>
      </div>`;
  }
  return header;
}

function wizardKeySelect(fam, chart, keyId) {
  return `
    <label class="wizard-field">Key
      <select class="select-input" data-action="wizard-key" data-fam="${fam}">
        ${chart.keys.map(k => `<option value="${k.id}" ${(keyId ?? chart.keys[0].id) === k.id ? 'selected' : ''}>${escHtml(k.name)}</option>`).join('')}
      </select>
    </label>
    <div class="hint">Chart source: ${chart.source.map(u => `<a href="${escHtml(u)}" target="_blank" rel="noopener">${escHtml(new URL(u).hostname)}</a>`).join(', ')}</div>`;
}

// Pitch classes of a scale from data.js, for the Notes and Chords filter.
function scalePitchClasses(scaleId) {
  const scale = SCALES.find(sc => sc.id === scaleId);
  if (!scale) return null;
  return new Set(scaleToMidis(scale).map(m => ((m % 12) + 12) % 12));
}

function ocTabs(inst) {
  const tabs = [];
  if (playableMidis(inst).length > 0) tabs.push(['notes', 'Notes'], ['chords', 'Chords']);
  if (inst.id === SHARED_ID) return tabs;
  if (inst.kind === 'scale') tabs.push(['builder', 'Builder']);
  if (inst.kind === 'custom') tabs.push(['setup', 'Set up']);
  return tabs;
}

function ocHeader(inst, view) {
  const tabs = ocTabs(inst);
  const shared = inst.id === SHARED_ID;
  return `
    ${shared ? `
      <div class="shared-bar">
        <span>Shared instrument ${escHtml(inst.publicId)} · read-only</span>
        <button class="btn btn-primary btn-sm" data-action="shared-add">${icon('plus')} Add to My instruments</button>
      </div>` : ''}
    <div class="app-header">
      <div class="breadcrumb">
        <a data-action="back-home">← My instruments</a>
        <span>/</span>
        <span>${escHtml(inst.name)}</span>
        ${shared ? '' : `<button class="btn-icon" data-action="share-instrument" title="Share: code, link and QR code">${inst.publicId ? escHtml(inst.publicId) : 'Share'}</button>`}
      </div>
      ${tabs.length > 1 ? `
        <div class="pills oc-tabs">
          ${tabs.map(([id, name]) => `<button class="pill ${view === id ? 'active' : ''}" data-action="oc-tab" data-tab="${id}">${name}</button>`).join('')}
        </div>` : ''}
    </div>`;
}

// State of the ocarina / flute views; reset when switching instrument.
function newOcState() {
  return {
    tab: 'notes', selected: null, previous: null, scaleFilter: 'All', handLegend: false,
    category: 'All', playlistId: 'All', expanded: null, voicings: {}, practice: null,
  };
}

// Playlist-entry identity for an ocarina chord, mirroring favIdForChord():
// the plain form for the default voicing, a notes suffix for any other.
function ocLayoutId(inst) { return 'oc:' + inst.id; }
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
  const items = chords
    .filter(c => oc.category === 'All' || c.type.category === oc.category)
    .sort((a, b) => notePC(a.rootNote) - notePC(b.rootNote) || b.noteCount - a.noteCount)
    .map(c => ({ chord: c, midis: oc.voicings[c.id] ?? c.notes.map(noteToMidi).sort((a, b) => a - b) }));
  const sourceId = oc.scaleFilter !== 'All' ? oc.scaleFilter : inst.scaleId;
  const source = SCALES.find(sc => sc.id === sourceId);
  const have = new Set(chords.map(c => `${notePC(c.rootNote)}-${c.type.id}`));
  const missing = !source ? [] : findAllChords(createLayoutFromScale(source))
    .filter(c => !have.has(`${notePC(c.rootNote)}-${c.type.id}`))
    .filter(c => oc.category === 'All' || c.type.category === oc.category)
    .map(c => ({ chord: c, fit: fitChordToInstrument(inst, c.notes) }))
    .filter(x => x.fit.missing.length > 0);
  return { chords, items, missing, source };
}

// One chord card: name, notes (tap to move a note to another octave),
// arpeggio as mini diagrams with the moves between them, two-note pairs.
function ocChordCard(inst, { key, chordId, title, sub, midis, rootPC, favId, canonical, entry }) {
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const names = midis.map(midiToNoteName);
  const rootName = names.find(n => notePC(n) === rootPC) ?? names[0];
  const arp = arpeggioOrder(names, rootName);
  const expanded = state.oc.expanded === key;
  const inAny = isChordBookmarkedAnyVoicing(ocLayoutId(inst), chordId);
  const opts = { useFlats: uf, useSolfege: us, size: 'mini' };
  const pairs = inst.chambers.length > 1 ? playablePairs(inst.chambers, midis) : [];
  return `
    <div class="oc-chord ${expanded ? 'expanded' : ''}">
      <div class="oc-chord-head" data-action="oc-chord-toggle" data-key="${escHtml(key)}">
        <div>
          <div class="chord-item-name">${title}</div>
          <div class="chord-item-type">${sub}</div>
        </div>
        <div class="chord-item-right">
          ${pairs.length ? `<span class="oc-badge" title="Two notes can sound together on different chambers">play together</span>` : ''}
          <button class="fav-btn ${inAny ? 'active' : ''}" data-action="oc-show-playlist-picker" data-key="${escHtml(key)}" title="Add to playlist">${icon('heart')}</button>
          <button class="btn-icon" data-action="oc-play-arp" data-key="${escHtml(key)}" title="Play arpeggio">${icon('play')}</button>
        </div>
      </div>
      ${expanded ? `
        <div class="oc-chord-notes">
          ${midis.map(m => `<button class="pill" data-action="oc-voicing" data-key="${escHtml(key)}" data-midi="${m}" title="Move to another octave">${nn(m)}</button>`).join('')}
          <span class="hint">Tap a note to move it to another octave</span>
        </div>
        <div class="oc-arp">
          ${arp.map((m, i) => `
            ${i > 0 ? `<div class="oc-arp-move">${escHtml(fingeringMoves(inst, arp[i - 1], m).text)}</div>` : ''}
            <div class="oc-arp-cell" data-action="oc-play-note" data-midi="${m}">${renderFingering(inst, m, { ...opts, previousMidi: i > 0 ? arp[i - 1] : null })}</div>
          `).join('')}
        </div>
        ${pairs.map(p => `
          <div class="oc-pair">
            <div class="oc-arp-cell" data-action="oc-play-pair" data-a="${p.a.midi}" data-b="${p.b.midi}">${renderFingering(inst, p.a.midi, { ...opts, blowBoth: p.b.midi })}</div>
            <div><span class="oc-badge">play together</span> ${nn(p.a.midi)} + ${nn(p.b.midi)}: blow both chambers</div>
          </div>`).join('')}
      ` : ''}
    </div>`;
}

function viewOcarinaChords(inst) {
  const oc = state.oc;
  if (oc.practice) return viewOcarinaPractice(inst);
  const uf = state.useFlats, us = state.useSolfege;
  const model = ocChordModel(inst);
  const playlists = state.playlists;
  const pl = oc.playlistId !== 'All' ? playlists.find(p => p.id === oc.playlistId) : null;
  let cards;
  if (pl) {
    const entries = pl.chords.filter(c => c.instrumentId === inst.id);
    cards = entries.length === 0
      ? `<div class="empty-state">No chords for ${escHtml(inst.name)} in this playlist yet.</div>`
      : entries.map(en => ocChordCard(inst, {
          key: 'e:' + en.id, chordId: en.chordId, entry: en, favId: en.id,
          title: `${displayNote(en.rootName, uf, us)} ${escHtml(en.typeName)}`, sub: escHtml(en.category ?? ''),
          midis: (oc.voicings['e:' + en.id] ?? en.notes.map(noteToMidi)).sort((a, b) => a - b),
          rootPC: notePC(en.rootName + '4'),
        })).join('');
  } else {
    cards = model.items.length === 0
      ? `<div class="empty-state">No chords match these filters</div>`
      : model.items.map(({ chord, midis }) => ocChordCard(inst, {
          key: chord.id, chordId: chord.id, canonical: chord.notes,
          title: `${displayNote(chord.rootName, uf, us)} ${chord.type.name}`, sub: chord.type.category,
          midis, rootPC: notePC(chord.rootNote),
          favId: ocFavId(inst, chord.id, midis.map(midiToNoteName), chord.notes),
        })).join('');
  }
  const practiceable = pl && pl.chords.some(c => c.instrumentId === inst.id);
  return `${ocHeader(inst, 'chords')}
    <div class="instrument-view">
      <div class="oc-toolbar">
        <select class="select-input" data-action="oc-scale-filter" title="Only notes of a handpan scale">
          <option value="All" ${oc.scaleFilter === 'All' ? 'selected' : ''}>All notes</option>
          ${SCALES.map(sc => `<option value="${sc.id}" ${oc.scaleFilter === sc.id ? 'selected' : ''}>${escHtml(sc.name)}</option>`).join('')}
        </select>
        <select class="select-input" data-action="oc-category">
          <option value="All" ${oc.category === 'All' ? 'selected' : ''}>All types</option>
          ${CHORD_CATEGORIES.filter(c => c !== 'All').map(cat => `<option value="${cat}" ${oc.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
        </select>
        <select class="select-input" data-action="oc-playlist">
          <option value="All" ${oc.playlistId === 'All' ? 'selected' : ''}>All chords</option>
          ${playlists.map(p => `<option value="${escHtml(p.id)}" ${oc.playlistId === p.id ? 'selected' : ''}>${escHtml(p.name)}</option>`).join('')}
        </select>
        ${practiceable ? `<button class="btn btn-primary btn-sm" data-action="oc-practice-start">${icon('play')} Practice</button>` : ''}
        ${tunerButton()}
      </div>
      <div class="hint">${pl ? '' : `${model.items.length} chord${model.items.length !== 1 ? 's' : ''} · `}Tap a chord to see its fingerings.</div>
      <div class="oc-chords">${cards}</div>
      ${!pl && model.missing.length ? `
        <div class="pwa-section-title mt-16">Not on this ocarina${model.source ? ` (from ${escHtml(model.source.name)})` : ''}</div>
        <div class="oc-missing">
          ${model.missing.map(({ chord, fit }) => `
            <div class="chord-item">
              <div>
                <div class="chord-item-name">${displayNote(chord.rootName, uf, us)} ${chord.type.name}</div>
                <div class="chord-item-type">missing ${fit.missing.map(n => displayNote(n, uf, us)).join(', ')}</div>
              </div>
            </div>`).join('')}
        </div>` : ''}
    </div>
    ${state.pickerChordFavId ? renderPlaylistPicker() : ''}
    ${handLegendModal()}`;
}

// Practice mode: autoplay on an ocarina playlist, one arpeggio note at a
// time. The large diagram shows the current note with arrows for what to
// lift or cover to reach the next one; tap to move on.
function practiceSteps(inst, pl) {
  const steps = [];
  for (const en of pl.chords.filter(c => c.instrumentId === inst.id)) {
    const rootName = en.notes.find(n => notePC(n) === notePC(en.rootName + '4')) ?? en.notes[0];
    for (const m of arpeggioOrder(en.notes, rootName)) steps.push({ entryId: en.id, midi: m });
  }
  return steps;
}

function viewOcarinaPractice(inst) {
  const pr = state.oc.practice;
  const pl = state.playlists.find(p => p.id === pr.playlistId);
  const steps = pl ? practiceSteps(inst, pl) : [];
  if (steps.length === 0) { state.oc.practice = null; return viewOcarinaChords(inst); }
  const idx = Math.min(pr.idx, steps.length - 1);
  const cur = steps[idx];
  const next = steps[(idx + 1) % steps.length];
  const entries = pl.chords.filter(c => c.instrumentId === inst.id);
  const en = entries.find(c => c.id === cur.entryId);
  const chordNo = entries.indexOf(en) + 1;
  const uf = state.useFlats, us = state.useSolfege;
  const opts = { useFlats: uf, useSolfege: us, showFingers: state.showFingers, showSizes: state.showSizes };
  const moves = fingeringMoves(inst, cur.midi, next.midi);
  const nextEn = entries.find(c => c.id === next.entryId);
  return `${ocHeader(inst, 'chords')}
    <div class="instrument-view">
      <div class="oc-practice-head">
        <div>
          <div class="chord-panel-title">${displayNote(en.rootName, uf, us)} ${escHtml(en.typeName)}</div>
          <div class="chord-panel-sub">${escHtml(pl.name)} · chord ${chordNo} of ${entries.length}</div>
        </div>
        <div style="display:flex;gap:6px">${tunerButton()}<button class="btn btn-secondary btn-sm" data-action="oc-practice-stop">Stop</button></div>
      </div>
      <div class="fg-large" data-action="oc-practice-next" title="Tap for the next note">
        ${renderFingering(inst, cur.midi, { ...opts, size: 'large', nextMidi: next.midi })}
        <div class="fg-moves">Next: ${escHtml(moves.text === 'No change' ? 'same fingering' : moves.text.charAt(0).toLowerCase() + moves.text.slice(1))}</div>
      </div>
      <div class="oc-practice-next">
        <div class="oc-arp-cell">${renderFingering(inst, next.midi, { ...opts, size: 'mini' })}</div>
        <div class="hint">Up next${nextEn && nextEn.id !== en.id ? `: ${displayNote(nextEn.rootName, uf, us)} ${escHtml(nextEn.typeName)}` : ''}</div>
      </div>
      <div class="hint">${state.tuner.on ? 'Play the note: the tuner moves on when it hears it.' : 'Tap Next, or turn on the tuner to move on when you play the note.'}</div>
      <div class="wizard-actions">
        <button class="btn btn-secondary" data-action="oc-practice-prev">← Back</button>
        <button class="btn btn-primary" data-action="oc-practice-next">Next →</button>
      </div>
    </div>`;
}

function handLegendModal() {
  if (!state.oc.handLegend) return '';
  return `
    <div class="modal-overlay" data-action="oc-hand-close">
      <div class="modal">
        <div class="modal-title">Which finger is which</div>
        <div class="modal-sub">As you hold the instrument, looking at the backs of your hands.</div>
        ${renderHandLegend()}
        <div class="modal-actions"><button class="btn btn-secondary btn-sm" data-action="oc-hand-close">Close</button></div>
      </div>
    </div>`;
}

// An ocarina or flute: the Notes view (fingering chart).
function viewInstrument() {
  if (state.currentInstrumentId === SHARED_ID && !state.shared) {
    return `
      <div class="app-header"><div class="breadcrumb"><a data-action="back-home">← My instruments</a></div></div>
      <div class="empty-state">${state.sharedStatus === 'loading' ? 'Opening the shared instrument…' : 'No shared instrument has that code. Check it and try again.'}</div>`;
  }
  const inst = currentInstrument();
  if (!inst) return viewHome();
  const uf = state.useFlats, us = state.useSolfege;
  const midis = playableMidis(inst);
  if (state.oc.tab === 'builder' && inst.kind === 'scale') return viewBuilder(inst);
  if (state.oc.tab === 'setup' || (inst.kind === 'custom' && midis.length === 0)) return viewSetup(inst);

  if (midis.length === 0) {
    return `${ocHeader(inst, 'notes')}
      <div class="instrument-view">
        <div class="scale-card-meta">${escHtml(instrumentStatus(inst))}</div>
        <div class="hint">This ocarina's fingering chart is worked out from the instrument itself: blow it with all holes closed, then with each hole open on its own, into the tuner. Setting it up arrives with the tuner update.</div>
      </div>`;
  }

  const oc = state.oc;
  if (oc.tab === 'chords') return viewOcarinaChords(inst);
  if (!midis.includes(oc.selected)) { oc.selected = midis[0]; oc.previous = null; }
  const pcs = oc.scaleFilter !== 'All' ? scalePitchClasses(oc.scaleFilter) : null;
  const inScale = m => !pcs || pcs.has(((m % 12) + 12) % 12);
  const opts = { useFlats: uf, useSolfege: us, showFingers: state.showFingers, showSizes: state.showSizes };
  const moves = oc.previous != null && oc.previous !== oc.selected ? fingeringMoves(inst, oc.previous, oc.selected) : null;

  return `${ocHeader(inst, 'notes')}
    <div class="instrument-view">
      <div class="oc-toolbar">
        <select class="select-input" data-action="oc-scale-filter" title="Dim notes outside a handpan scale">
          <option value="All" ${oc.scaleFilter === 'All' ? 'selected' : ''}>All notes</option>
          ${SCALES.map(sc => `<option value="${sc.id}" ${oc.scaleFilter === sc.id ? 'selected' : ''}>${escHtml(sc.name)}</option>`).join('')}
        </select>
        <button class="btn btn-secondary btn-sm" data-action="oc-play-scale">${icon('play')} Scale</button>
        ${tunerButton()}
        <button class="btn ${state.showFingers ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="oc-toggle-fingers" title="Show finger names in the holes">R4 L1</button>
        <button class="btn ${state.showSizes ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="oc-toggle-sizes" title="Show hole sizes in mm">mm</button>
        <button class="btn btn-secondary btn-sm" data-action="oc-hand-open" title="Which finger is which">✋ Fingers</button>
        <button class="btn ${uf ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="toggle-flats">♭ Flats</button>
      </div>
      ${state.ocLegendSeen ? '' : `
        <div class="oc-legend">
          <span>${legendHole('c')} covered</span><span>${legendHole('o')} open</span><span>${legendHole('h')} half-covered</span>
          <button class="btn-icon" data-action="oc-legend-dismiss" title="Got it">${icon('x')}</button>
        </div>`}
      <div class="fg-large" data-action="oc-play-selected">
        ${renderFingering(inst, oc.selected, { ...opts, size: 'large', previousMidi: oc.previous })}
        <div class="fg-moves">${moves ? escHtml(moves.text) : '&nbsp;'}</div>
      </div>
      <div class="fg-grid">
        ${midis.map(m => `
          <div class="fg-cell ${m === oc.selected ? 'selected' : ''} ${inScale(m) ? '' : 'dimmed'}" data-action="oc-select-note" data-midi="${m}">
            ${renderFingering(inst, m, { ...opts, size: 'medium' })}
          </div>`).join('')}
      </div>
      ${inst.kind === 'scale' ? `<div class="hint">${escHtml(instrumentStatus(inst))}</div>` : ''}
    </div>
    ${handLegendModal()}`;
}

function legendHole(state) {
  const body = state === 'c' ? '<circle class="fg-c" cx="8" cy="8" r="6"/>'
    : state === 'o' ? '<circle class="fg-o" cx="8" cy="8" r="6"/>'
    : '<circle class="fg-o" cx="8" cy="8" r="6"/><path class="fg-c" d="M 2 8 A 6 6 0 0 0 14 8 Z"/>';
  return `<svg class="fingering" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${body}</svg>`;
}


// Everything a chord card's buttons need, looked up by its key: a chord id
// in the plain list, or 'e:' + entry id when a playlist is selected.
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

function playPracticeStep() {
  const inst = currentInstrument();
  const pl = state.playlists.find(p => p.id === state.oc.practice?.playlistId);
  if (!inst || !pl) return;
  const steps = practiceSteps(inst, pl);
  const step = steps[state.oc.practice.idx % steps.length];
  if (step) { initAudio(); playNote(midiToNoteName(step.midi)); }
}

function openPlaylistEntryOnInstrument(pl, entry) {
  if (!openInstrument(entry.instrumentId)) { showToast('That ocarina is no longer in My instruments'); return false; }
  Object.assign(state.oc, { tab: 'chords', playlistId: pl.id, expanded: 'e:' + entry.id });
  history.replaceState(null, '', `#i/${entry.instrumentId}/chords`);
  return true;
}

// ── Sharing ──────────────────────────────────────────────────────────────────
// A shared instrument (#p/<code>) opens read-only under this id.
const SHARED_ID = '__shared__';

function currentInstrument() {
  return state.currentInstrumentId === SHARED_ID ? state.shared : getInstrument(state.currentInstrumentId);
}

function openSharedLink(code) {
  stopAutoplay();
  Object.assign(state, {
    view: 'instrument', layout: null, currentInstrumentId: SHARED_ID,
    shared: null, sharedStatus: 'loading', oc: newOcState(),
  });
  // Supabase is initialised just after the first render, so fetch next tick.
  setTimeout(async () => {
    const data = await fetchSharedInstrument(code);
    if (state.currentInstrumentId !== SHARED_ID) return;
    state.shared = data ? { ...data, id: SHARED_ID, publicId: code.toUpperCase() } : null;
    state.sharedStatus = data ? null : 'missing';
    render();
  }, 0);
}

let _qrLib = null;
function loadQrLib() {
  if (_qrLib) return _qrLib;
  _qrLib = new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    sc.onload = () => resolve(window.qrcode);
    sc.onerror = () => { _qrLib = null; reject(new Error('QR library unavailable')); };
    document.head.appendChild(sc);
  });
  return _qrLib;
}

async function shareInstrument() {
  const inst = currentInstrument();
  if (!inst || inst.id === SHARED_ID) return;
  if (!isLoggedIn()) { showToast('Sign in with Sync on My instruments to share'); return; }
  if (!inst.publicId) {
    let ok = false;
    for (let attempt = 0; attempt < 3 && ok !== true; attempt++) {
      inst.publicId = newPublicId();
      saveInstrument(inst);
      ok = await saveCloudInstruments([getInstrument(inst.id)]);
      if (ok !== '23505') break; // anything but a public-ID clash: stop retrying
    }
    if (ok !== true) {
      delete inst.publicId;
      saveInstrument(inst);
      showToast('Sharing isn\'t available on the server yet');
      return;
    }
  }
  const url = `${location.origin}${location.pathname}#p/${inst.publicId}`;
  state.shareModal = { code: inst.publicId, url, qr: null };
  render();
  try {
    const qrcode = await loadQrLib();
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    if (state.shareModal?.code === inst.publicId) { state.shareModal.qr = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); render(); }
  } catch { /* the link and code still work without the QR image */ }
}

function shareModalHtml() {
  const m = state.shareModal;
  if (!m) return '';
  return `
    <div class="modal-overlay" data-action="share-close">
      <div class="modal share-modal">
        <div class="modal-title">Share this instrument</div>
        <div class="modal-sub">Anyone with the code, link or QR code sees its fingering chart and chords, read-only, and can add it to their own instruments. Stamp the code into the clay or tie the QR code to it.</div>
        <div class="share-code">${escHtml(m.code)}</div>
        <div class="share-qr">${m.qr ?? '<span class="hint">QR code loading…</span>'}</div>
        <input class="name-input share-url" readonly value="${escHtml(m.url)}">
        <div class="modal-actions">
          <button class="btn btn-primary btn-sm" data-action="share-copy">Copy link</button>
          <button class="btn btn-secondary btn-sm" data-action="share-close">Close</button>
        </div>
      </div>
    </div>`;
}

// ── Instruments sync ─────────────────────────────────────────────────────────
// Two-way sync of ocarinas (not handpans, which come from the synced
// layouts) through the instruments table. Quietly does nothing until the
// migration has been run.

let _instrSyncTimer = null;
let _instrSyncing = false;

async function syncInstrumentsNow() {
  if (!isLoggedIn() || _instrSyncing) return;
  _instrSyncing = true;
  try {
    const rows = await loadCloudInstruments();
    if (!rows) return;
    const { local, toPush, changed } = mergeInstruments(getInstrumentsRaw(), rows);
    if (changed) writeInstrumentsRaw(local);
    if (toPush.length) await saveCloudInstruments(toPush);
    if (changed) { refreshInstruments(); render(); }
  } finally {
    _instrSyncing = false;
  }
}

window.addEventListener('hp-instruments-changed', () => {
  if (_instrSyncing || !isLoggedIn()) return;
  clearTimeout(_instrSyncTimer);
  _instrSyncTimer = setTimeout(syncInstrumentsNow, 2000);
});

// ── Builder ──────────────────────────────────────────────────────────────────
// A step-by-step project per scale-built ocarina. Each instrument remembers
// its stage; readings are kept per stage, so going back loses nothing.

function hzField(path, value, placeholder = 'Hz') {
  return `<span class="b-field">
    <input class="b-input" type="number" inputmode="decimal" step="0.1" min="0" data-action="b-input" data-path="${path}"
      value="${value > 0 ? (Math.round(value * 10) / 10) : ''}" placeholder="${placeholder}">
    <button class="btn btn-secondary btn-sm" data-action="b-record" data-path="${path}" title="Fill in from the tuner">🎤</button>
  </span>`;
}

function stepper(stage) {
  const idx = STAGE_ORDER.indexOf(stage);
  return `<div class="b-stepper">
    ${STAGE_ORDER.map((st, i) => `
      <button class="b-step ${i === idx ? 'current' : i < idx ? 'past' : ''}" data-action="b-stage" data-stage="${st}" title="${STAGE_TITLES[st]}">
        <span class="b-step-no">${i + 1}</span><span class="b-step-name">${STAGE_TITLES[st].split(' (')[0]}</span>
      </button>`).join('')}
  </div>`;
}

function shapeIcon(shape) {
  const body = shape === 'round' ? '<circle cx="12" cy="12" r="7"/>'
    : shape === 'oval' ? '<ellipse cx="12" cy="12" rx="9" ry="6"/>'
    : '<rect x="3" y="7" width="18" height="10" rx="1"/>';
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${body}</svg>`;
}

// Earlier builds with readings, offered as a starting point.
function earlierBuilds(inst) {
  return state.instruments.filter(i => i.kind === 'scale' && i.id !== inst.id);
}

function viewBuilder(inst) {
  const b = inst.build;
  const stage = b.stage;
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const shrink = buildShrink(inst);
  const from = b.fromId ? getInstrument(b.fromId) : null;
  let body = '';

  if (stage === 'design') {
    const plan = planOcarina(inst.design ?? { scaleId: inst.scaleId, transpose: inst.transpose, includeGu: inst.includeGu });
    const d = inst.design ?? {};
    const hasGu = plan.scale.bottom.notes.length > 0;
    body = `
      <div class="b-section">
        <label class="wizard-field">Handpan scale
          <select class="select-input" data-action="b-design" data-key="scaleId">
            ${SCALES.map(sc => `<option value="${sc.id}" ${sc.id === plan.scale.id ? 'selected' : ''}>${escHtml(sc.name)}</option>`).join('')}
          </select>
        </label>
        <div class="wizard-row">
          <label class="wizard-field">Transpose
            <select class="select-input" data-action="b-design" data-key="transpose">
              ${Array.from({ length: 13 }, (_, i) => i - 6).map(t => `<option value="${t}" ${t === (d.transpose ?? inst.transpose) ? 'selected' : ''}>${t > 0 ? '+' + t : t} semitones</option>`).join('')}
            </select>
          </label>
          ${hasGu ? `<label class="wizard-check"><input type="checkbox" data-action="b-design" data-key="includeGu" ${(d.includeGu ?? inst.includeGu) ? 'checked' : ''}> Include gu notes</label>` : ''}
        </div>
        <div class="wizard-field">
          <div>The full scale needs ${plan.needed} chamber${plan.needed !== 1 ? 's' : ''}. Build with:</div>
          <div class="pills">${Array.from({ length: plan.needed }, (_, i) => i + 1).map(n => `
            <button class="pill ${n === plan.chambers ? 'active' : ''}" data-action="b-design" data-key="chambers" data-value="${n}">${n} chamber${n !== 1 ? 's' : ''}</button>`).join('')}</div>
        </div>
        ${plan.windows.length ? `<div class="wizard-field"><div>Which notes?</div><div class="pills">${plan.windows.map(win => `
          <button class="pill ${win.chosen ? 'active' : ''}" data-action="b-design" data-key="windowStart" data-value="${win.start}">
            ${nn(win.notes[0])}–${nn(win.notes[win.notes.length - 1])} · ${win.notes.length} notes${win.fromDing ? ' · from the ding' : ''}</button>`).join('')}</div></div>` : ''}
        <div class="wizard-field"><div>Notes (tap one to leave it out)</div>
          <div class="wizard-notes">${plan.all.map(m => {
            const inWin = plan.windows.length === 0 || plan.windows.find(w => w.chosen).notes.includes(m);
            if (!inWin) return `<span class="pill">${nn(m)}</span>`;
            return `<button class="pill ${plan.notes.includes(m) ? 'active' : ''}" data-action="b-design" data-key="toggleNote" data-value="${m}">${nn(m)}</button>`;
          }).join('')}</div>
        </div>
        <div class="hint">${inst.chambers.map((ch, i) => `Chamber ${i + 1}: ${ch.notes.map(nn).join(' ')} · ${ch.holes.length} holes`).join('<br>')}</div>
        <div class="b-preview">${renderFingering(inst, inst.chambers[0].notes[0], { size: 'medium', useFlats: uf, useSolfege: us })}</div>
        ${earlierBuilds(inst).length ? `
          <label class="wizard-field">Start from an earlier build
            <select class="select-input" data-action="b-from">
              <option value="">—</option>
              ${earlierBuilds(inst).map(i => `<option value="${escHtml(i.id)}" ${b.fromId === i.id ? 'selected' : ''}>${escHtml(i.name)}</option>`).join('')}
            </select>
          </label>` : ''}
      </div>`;
  }

  if (stage === 'body') {
    const clays = getClayBodies();
    const plans = bodyPlan(inst);
    body = `
      <div class="b-section">
        <label class="wizard-field">Clay body
          <select class="select-input" data-action="b-clay">
            ${clays.map(c => `<option value="${escHtml(c.id)}" ${b.clayBody === c.id ? 'selected' : ''}>${escHtml(c.name)} · ${c.shrinkPct}%${c.builds ? ` (learned from ${c.builds} build${c.builds !== 1 ? 's' : ''})` : ''}</option>`).join('')}
            <option value="__new__">Add a clay body…</option>
          </select>
        </label>
        <details class="b-advanced"><summary>Advanced</summary>
          <label class="wizard-field">Shrinkage for this build, %
            <input class="b-input" type="number" step="0.1" min="0" max="30" data-action="b-shrink" value="${b.shrinkPct}">
          </label>
        </details>
      </div>
      ${inst.chambers.map((ch, ci) => {
        const win = plans[ci].window;
        const p = plans[ci];
        return `
        <div class="b-section">
          <div class="editor-section-title">Chamber ${ci + 1} · closed note ${nn(ch.notes[0])}</div>
          <div class="pills">${['rect', 'round', 'oval'].map(sh => `
            <button class="pill ${win.shape === sh ? 'active' : ''}" data-action="b-window" data-ci="${ci}" data-key="shape" data-value="${sh}">${shapeIcon(sh)} ${sh === 'rect' ? 'Rectangle' : sh === 'round' ? 'Round' : 'Oval'}</button>`).join('')}</div>
          <div class="wizard-row">
            <label class="wizard-field">${win.shape === 'round' ? 'Diameter' : 'Width'}, mm<input class="b-input" type="number" step="0.5" min="1" data-action="b-window" data-ci="${ci}" data-key="w" value="${win.w}"></label>
            ${win.shape === 'round' ? '' : `<label class="wizard-field">Length, mm<input class="b-input" type="number" step="0.5" min="1" data-action="b-window" data-ci="${ci}" data-key="l" value="${win.l}"></label>`}
            <label class="wizard-field">Wall, mm<input class="b-input" type="number" step="0.5" min="1" data-action="b-window" data-ci="${ci}" data-key="t" value="${win.t}"></label>
          </div>
          <div class="b-result">Inside volume <b>${Math.round(p.volume)} ml</b> · form around a ball <b>${Math.round(p.ballDiameter)} mm</b> across · about ${Math.round(p.firedVolume)} ml after firing</div>
          <div class="hint">A starting point: the finished pitch can land a couple of semitones away, which the next step corrects.</div>
        </div>`;
      }).join('')}`;
  }

  if (stage === 'leather') {
    body = inst.chambers.map((ch, ci) => {
      const cb = chamberBuild(inst, ci);
      const r = cb.readings.leather ?? {};
      const targets = stageTargets(ch, 'leather', shrink, b.a4);
      const plan = leatherHolePlan(ch, { f0: r.f0, d: r.d ?? cb.testHoleMm, f1: r.f1 }, shrink, b.a4);
      const old = from?.build?.perChamber?.[ci]?.readings?.leather;
      return `
        <div class="b-section">
          <div class="editor-section-title">Chamber ${ci + 1}</div>
          <div class="b-row"><span>1. Closed pitch (all holes covered), target ${nn(ch.notes[0])} ≈ ${targets[ch.notes[0]].toFixed(1)} Hz</span>${hzField(`${ci}:leather:f0`, r.f0)}${old?.f0 ? `<span class="hint">last build ${old.f0.toFixed(1)}</span>` : ''}</div>
          ${r.f0 > 0 ? (() => {
            const a = noteAdvice('leather', r.f0, targets[ch.notes[0]]);
            const text = a.status === 'ok' ? '✓ closed note in tune'
              : a.status === 'flat' ? `${Math.abs(a.cents)} cents flat: open the window slightly`
              : `${a.cents} cents sharp: the chamber is a little small for this note`;
            return `<div class="b-row"><span class="b-adv ${a.status}">${text}</span></div>`;
          })() : ''}
          <div class="b-row"><span>2. Drill a test hole of</span>
            <span class="b-field"><input class="b-input" type="number" step="0.5" min="1" data-action="b-input" data-path="${ci}:leather:d" value="${r.d ?? cb.testHoleMm}"> mm</span>
            <span>where ${ch.holes[0].finger} goes, then blow with only it open</span>${hzField(`${ci}:leather:f1`, r.f1)}</div>
          ${plan ? `
            <div class="b-holes">
              <div class="hint">Drill in this order. Hole sizes are at leather-hard; targets are already lowered by ${(shrink * 100).toFixed(1)}% for shrinkage.</div>
              ${plan.holes.map(h => {
                const midi = ch.notes[h.index + 1];
                const done = cb.holesDone.includes(h.index);
                const measured = r.notes?.[midi];
                const adv = measured > 0 ? noteAdvice('leather', measured, targets[midi]) : null;
                return `
                <div class="b-hole ${done ? 'done' : ''}">
                  <label class="wizard-check"><input type="checkbox" data-action="b-hole-done" data-ci="${ci}" data-index="${h.index}" ${done ? 'checked' : ''}>
                    <b>${h.finger}</b> ${h.parts.length > 1 ? `${['', '', 'two', 'three', 'four'][h.parts.length] ?? h.parts.length} holes of ${h.parts[0].toFixed(1)} mm` : `${h.mm.toFixed(1)} mm`}
                    ${h.index === plan.testHoleIndex ? '<span class="oc-badge">your test hole: enlarge it</span>' : ''}</label>
                  <span class="hint">${nn(midi)} → ${targets[midi].toFixed(1)} Hz</span>
                  ${hzField(`${ci}:leather:n:${midi}`, measured)}
                  ${adv ? `<span class="b-adv ${adv.status}">${escHtml(`${nn(midi)} is ${adv.text}`).replace(`${nn(midi)} is in tune`, `${nn(midi)} ✓ in tune`)}</span>` : ''}
                </div>`;
              }).join('')}
            </div>` : `<div class="hint">Record the closed pitch and the test-hole pitch to see every hole's size.</div>`}
        </div>`;
    }).join('');
  }

  if (['boneDry', 'bisque', 'final'].includes(stage)) {
    const intro = {
      boneDry: 'Blow every note once more. Pitch rises while the clay dries; small corrections are still possible with careful filing.',
      bisque: 'After the first firing the targets are concert pitch. Flat notes can be filed larger; sharp ones can\'t be lowered.',
      final: 'After the glaze firing, a last pass records the finished tuning.',
    }[stage];
    body = `<div class="hint">${intro}</div>` + inst.chambers.map((ch, ci) => {
      const cb = chamberBuild(inst, ci);
      const r = cb.readings[stage] ?? {};
      const leather = cb.readings.leather?.notes ?? {};
      const targets = stageTargets(ch, stage, shrink, b.a4);
      const old = from?.build?.perChamber?.[ci]?.readings?.[stage]?.notes ?? {};
      return `
        <div class="b-section">
          <div class="editor-section-title">Chamber ${ci + 1}</div>
          ${ch.notes.map(midi => {
            const measured = r.notes?.[midi];
            const adv = measured > 0 ? noteAdvice(stage, measured, targets[midi]) : null;
            const rise = stage === 'boneDry' && measured > 0 && leather[midi] > 0 ? Math.round(centsBetween(measured, leather[midi])) : null;
            return `
              <div class="b-hole">
                <span><b>${nn(midi)}</b> <span class="hint">${targets[midi].toFixed(1)} Hz</span></span>
                ${hzField(`${ci}:${stage}:n:${midi}`, measured)}
                ${rise != null ? `<span class="hint">rose ${rise >= 0 ? '+' : ''}${rise} cents since leather-hard</span>` : ''}
                ${old[midi] ? `<span class="hint">last build ${old[midi].toFixed(1)}</span>` : ''}
                ${adv ? `<span class="b-adv ${adv.status}">${adv.status === 'ok' ? '✓ in tune' : escHtml(adv.text)}</span>` : ''}
              </div>`;
          }).join('')}
        </div>`;
    }).join('');
  }

  if (stage === 'done') {
    const learned = b.learnedShrink;
    body = `
      <div class="b-section">
        <div class="wizard-title">${escHtml(inst.name)} is finished</div>
        <div class="hint">It's playable from the Notes and Chords tabs, with its hole sizes and measured pitches stored.</div>
        ${learned != null ? `<div class="b-result">This clay shrank <b>${(learned * 100).toFixed(1)}%</b> from leather-hard to fired; that's now the default for ${escHtml(getClayBodies().find(c => c.id === b.clayBody)?.name ?? 'this clay')}.</div>` : ''}
        ${inst.chambers.map((ch, ci) => {
          const byFinger = [];
          ch.holes.forEach(h => {
            const last = byFinger[byFinger.length - 1];
            if (last && last.finger === h.finger) last.n++; else byFinger.push({ finger: h.finger, n: 1, mm: h.sizeMm });
          });
          return `<div class="hint">Chamber ${ci + 1}: ${byFinger.map(g => `${g.finger} ${g.mm ? (g.n > 1 ? g.n + ' × ' : '') + g.mm.toFixed(1) + ' mm' : '—'}`).join(' · ')}</div>`;
        }).join('')}
      </div>`;
  }

  const nextLabel = stage === 'final' ? 'Finish' : stage === 'done' ? '' : `Next: ${STAGE_TITLES[nextStage(stage)]} →`;
  return `${ocHeader(inst, 'builder')}
    <div class="instrument-view">
      <div class="oc-toolbar">${tunerButton()}<span class="hint">${escHtml(instrumentStatus(inst))}</span></div>
      ${stepper(stage)}
      <div class="wizard-title">${STAGE_TITLES[stage]}</div>
      ${body}
      <div class="wizard-actions">
        ${nextLabel ? `<button class="btn btn-primary" data-action="b-next">${nextLabel}</button>` : ''}
        ${stage === 'bisque' ? `<button class="btn btn-secondary" data-action="b-unglazed">Unglazed: finish now</button>` : ''}
      </div>
    </div>`;
}

// Set-up for a bought ocarina: say which finger covers each hole, then
// record all-closed and each-hole-open pitches; the chart is worked out.
function viewSetup(inst) {
  const setup = inst.setup ?? { holes: defaultCustomHoles(inst.holeCount), f0: null, singles: [] };
  const fingers = OC_FINGER_ORDER;
  const ready = setup.f0 > 0 && setup.holes.every((_, i) => setup.singles[i] > 0);
  return `${ocHeader(inst, 'setup')}
    <div class="instrument-view">
      <div class="oc-toolbar">${tunerButton()}</div>
      <div class="hint">The ocarina charts itself: turn on the tuner, then blow each line below and tap 🎤 while the note sounds. Blow steadily at a medium breath.</div>
      <div class="b-section">
        <div class="editor-section-title">Holes and fingers</div>
        <div class="hint">Check which finger covers each hole. The order should be the order the holes open going up the scale.</div>
        ${setup.holes.map((h, i) => `
          <div class="b-row">
            <span>Hole ${i + 1}${h.sub ? ' (small sub-hole)' : ''}</span>
            <select class="select-input" data-action="s-finger" data-index="${i}">
              ${fingers.map(f => `<option value="${f}" ${h.finger === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>`).join('')}
      </div>
      <div class="b-section">
        <div class="editor-section-title">Readings</div>
        <div class="b-row"><span>All holes closed</span>${hzField('s:f0', setup.f0)}</div>
        ${setup.holes.map((h, i) => `<div class="b-row"><span>Only hole ${i + 1} (${h.finger}) open</span>${hzField(`s:${i}`, setup.singles[i])}</div>`).join('')}
      </div>
      <div class="wizard-actions">
        <button class="btn btn-primary" data-action="s-calibrate" ${ready ? '' : 'disabled'}>Work out the fingering chart</button>
      </div>
      ${inst.calibration ? `<div class="hint">Current chart: ${playableMidis(inst).length} notes. Predicted fingerings are within 20 cents; check them with the tuner.</div>` : ''}
    </div>`;
}

// Writes a reading into an instrument. Paths: "ci:stage:f0|d|f1",
// "ci:stage:n:<midi>", "s:f0", "s:<holeIndex>".
function setReading(inst, path, value) {
  const parts = path.split(':');
  if (parts[0] === 's') {
    const setup = inst.setup ?? { holes: defaultCustomHoles(inst.holeCount), f0: null, singles: [] };
    if (parts[1] === 'f0') setup.f0 = value; else setup.singles[parseInt(parts[1], 10)] = value;
    inst.setup = setup;
    return;
  }
  const ci = parseInt(parts[0], 10);
  const stage = parts[1];
  const per = inst.build.perChamber;
  per[ci] = per[ci] ?? {};
  per[ci].readings = per[ci].readings ?? {};
  const r = per[ci].readings[stage] = per[ci].readings[stage] ?? {};
  if (parts[2] === 'n') {
    r.notes = r.notes ?? {};
    r.notes[parts[3]] = value;
  } else {
    r[parts[2]] = value;
    // The closed pitch is also the reading of the chamber's lowest note.
    if (parts[2] === 'f0') { r.notes = r.notes ?? {}; r.notes[inst.chambers[ci].notes[0]] = value; }
  }
}

function applyDesign(inst) {
  const plan = planOcarina(inst.design);
  inst.scaleId = plan.scale.id;
  inst.transpose = inst.design.transpose ?? 0;
  inst.includeGu = inst.design.includeGu ?? true;
  inst.notes = plan.notes;
  inst.chambers = buildScaleChambers(plan.notes);
  inst.fullChambers = plan.needed;
}

function finishInstrumentBuild(inst) {
  const { inst: done, learned } = finishBuild(inst);
  if (learned != null && done.build.clayBody) {
    saveClayBodies(getClayBodies().map(c => (c.id === done.build.clayBody ? updateClayBody(c, learned) : c)));
  }
  return done;
}

// ── Tuner ────────────────────────────────────────────────────────────────────
// A panel pinned to the bottom of the screen while the tuner is on. It is
// updated in place ~20 times a second; only a practice-mode advance
// re-renders the page.

let _tunerStop = null;

function tunerButton() {
  return `<button class="btn ${state.tuner.on ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="tuner-toggle" title="Listen through the microphone">🎤 Tuner</button>`;
}

// The note the player should be playing right now, if any.
function tunerTarget() {
  if (state.view !== 'instrument') return null;
  const inst = currentInstrument();
  if (!inst) return null;
  const oc = state.oc;
  if (oc.practice) {
    const pl = state.playlists.find(p => p.id === oc.practice.playlistId);
    const steps = pl ? practiceSteps(inst, pl) : [];
    return steps.length ? steps[oc.practice.idx % steps.length].midi : null;
  }
  if (oc.tab === 'notes') return oc.selected;
  return null;
}

function tunerPanelInner() {
  const t = state.tuner;
  if (t.error) return `<div class="tuner-msg">${escHtml(t.error)}</div><button class="btn-icon" data-action="tuner-toggle">${icon('x')}</button>`;
  const r = t.reading;
  const uf = state.useFlats, us = state.useSolfege;
  const target = tunerTarget();
  const heard = r?.midi != null ? Math.round(r.midi) : null;
  let line = 'Listening…', cents = null, cls = '';
  if (heard != null) {
    const name = displayNote(midiToNoteName(heard), uf, us);
    if (target != null) {
      const tName = displayNote(midiToNoteName(target), uf, us);
      const off = Math.round(centsBetween(r.hz, midiToHz(target)));
      cents = off;
      if (Math.abs(off) <= 10) { line = `${tName} ✓ in tune`; cls = 'ok'; }
      else if (Math.abs(off) < 50) { line = `${tName} is ${Math.abs(off)} cents ${off < 0 ? 'flat' : 'sharp'}`; cls = 'near'; }
      else line = `Hearing ${name}, looking for ${tName}`;
    } else {
      cents = Math.round(centsBetween(r.hz, midiToHz(heard)));
      line = `${name} ${cents === 0 ? '' : (cents > 0 ? '+' : '') + cents + ' cents'}`;
    }
  }
  const pos = cents == null ? 50 : 50 + Math.max(-50, Math.min(50, cents));
  return `
    <div class="tuner-main">
      <div class="tuner-line ${cls}">${escHtml(line)}</div>
      <div class="tuner-hz">${r?.hz ? r.hz.toFixed(1) + ' Hz' : '&nbsp;'}</div>
    </div>
    <div class="tuner-bar"><div class="tuner-mid"></div>${cents == null ? '' : `<div class="tuner-needle ${cls}" style="left:${pos}%"></div>`}</div>
    <button class="btn-icon" data-action="tuner-toggle" title="Stop tuner">${icon('x')}</button>`;
}

function onTunerReading(reading) {
  state.tuner.reading = reading;
  // Practice mode: move on once the right note has held steady, but only for
  // a note started after the last advance (so a repeated note isn't skipped).
  const pr = state.oc.practice;
  const target = tunerTarget();
  if (pr && target != null && reading.stable && reading.since > state.tuner.lastAdvance
      && Math.abs(reading.midi - target) < 0.4) {
    state.tuner.lastAdvance = performance.now();
    const inst = currentInstrument();
    const pl = state.playlists.find(p => p.id === pr.playlistId);
    if (inst && pl) {
      pr.idx = (pr.idx + 1) % practiceSteps(inst, pl).length;
      render();
      return;
    }
  }
  const panel = document.getElementById('tuner-panel');
  if (panel) panel.innerHTML = tunerPanelInner();
}

async function toggleTuner() {
  if (state.tuner.on) {
    if (_tunerStop) { _tunerStop(); _tunerStop = null; }
    state.tuner = { on: false, reading: null, error: null, lastAdvance: 0 };
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
    render();
  }
}

function openInstrument(id, { push = true } = {}) {
  const inst = getInstrument(id);
  if (!inst) return false;
  stopAutoplay();
  touchInstrument(id);
  if (state.currentInstrumentId !== id) state.oc = newOcState();
  state.currentInstrumentId = id;
  state.selectedChord = null;
  state.sourcePlaylistId = null;
  state.sourceEntryId = null;
  if (inst.family === 'handpan') {
    const saved = state.savedLayouts.find(l => l.id === inst.layoutId);
    if (!saved) return false;
    state.layout = JSON.parse(JSON.stringify(saved.layout));
    state.chords = findAllChords(state.layout);
    state.shellMode = 'both';
    state.chordFilter = { category: 'All', root: 'All', playlist: 'All' };
    state.view = 'chords';
    if (push) history.pushState(null, '', stateToHash());
  } else {
    state.layout = null;
    state.view = 'instrument';
    if (inst.kind === 'scale' && inst.build && inst.build.stage !== 'done') state.oc.tab = 'builder';
    if (inst.kind === 'custom' && !inst.calibration) state.oc.tab = 'setup';
    if (push) history.pushState(null, '', `#i/${id}`);
  }
  return true;
}

// Where the app opens with no URL hash: the wizard on first run, otherwise
// My instruments — or straight into the only instrument there is.
function openStartView() {
  if (state.instruments.length === 0 && !isOnboarded()) {
    state.wizard = newWizard(true);
    state.view = 'wizard';
    return;
  }
  state.view = 'home';
  if (state.instruments.length === 1) openInstrument(state.instruments[0].id, { push: false });
}

// ── View 2: Layout Editor ────────────────────────────────────────────────────
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

  return `
    <div class="app-header">
      <div class="breadcrumb">
        ${backCrumb()}
        <span>/</span>
        ${isCustom
          ? `<input class="name-input" id="custom-name-input"
               value="${escHtml(layout.name)}" placeholder="Layout name">`
          : `<span>${escHtml(layout.name)}</span>`
        }
      </div>
    </div>

    <div class="editor-layout">
      <div>
        <div class="pills" style="margin-bottom:14px">
          ${['both', 'top', 'bottom'].map(m => `
            <button class="pill ${state.shellMode === m ? 'active' : ''}"
              data-action="shell-mode" data-mode="${m}">
              ${m === 'both' ? 'Both Shells' : m === 'top' ? 'Top Shell' : 'Bottom Shell'}
            </button>
          `).join('')}
          <button class="pill ${state.ringRotated ? 'active' : ''}"
            data-action="toggle-rotation"
            title="Rotate the ring so two lowest notes face you instead of one">
            ${icon('rotate')} Rotate
          </button>
          <button class="pill ${state.useFlats ? 'active' : ''}"
            data-action="toggle-flats" title="Switch between sharp (C#) and flat (Db) notation">
            ♭ Flats
          </button>
        </div>
        <div class="pan-wrap">
          ${panSvg}
        </div>
        ${isCustom ? `
          <p class="hint" style="text-align:center;margin-top:8px">
            Click a note to remove it · Click an empty slot (+) to add a note
          </p>
        ` : ''}
      </div>

      <div class="editor-sidebar">
        <div class="editor-secondary-actions">
          ${!isCustom ? `
            <button class="btn btn-secondary btn-sm" data-action="clone-layout" style="flex:1">
              Clone &amp; Customize
            </button>
          ` : ''}
          ${(() => {
            const savedId = isCustom ? layout.savedId : layout.id;
            const isSaved = savedId && state.savedLayouts.some(l => l.id === savedId);
            return `<button class="btn btn-secondary btn-sm" data-action="save-layout" style="flex:1">
              ${isSaved ? icon('check') + ' Saved' : icon('save') + ' Save'}
            </button>`;
          })()}
        </div>

        <div class="editor-shells">
          <div class="editor-section">
            <div class="editor-section-title">Top shell</div>
            <div class="capacity-control">
              <button class="btn-icon" data-action="adjust-capacity" data-shell="top" data-delta="-1"
                ${topEmpty === 0 && layout.top.slots.length > 0 ? 'disabled title="Remove a note first"' : ''}>−</button>
              <span class="capacity-val">${layout.top.capacity}</span>
              <button class="btn-icon" data-action="adjust-capacity" data-shell="top" data-delta="1">+</button>
            </div>
            <div class="hint" style="margin-top:6px">
              ${topFilled + 1} notes (incl. ding) · ${topEmpty} empty
            </div>
          </div>

          <div class="editor-section">
            <div class="editor-section-title">Bottom shell</div>
            <div class="capacity-control">
              <button class="btn-icon" data-action="adjust-capacity" data-shell="bottom" data-delta="-1"
                ${layout.bottom.slots.every(s => !s.note) && layout.bottom.capacity === 0 ? 'disabled' : ''}>−</button>
              <span class="capacity-val">${layout.bottom.capacity}</span>
              <button class="btn-icon" data-action="adjust-capacity" data-shell="bottom" data-delta="1">+</button>
            </div>
            <div class="hint" style="margin-top:6px">
              ${bottomFilled} note${bottomFilled !== 1 ? 's' : ''} · ${layout.bottom.capacity - bottomFilled} empty
            </div>
          </div>
        </div>

        <button class="btn btn-primary" data-action="go-chords" style="width:100%">
          Find Chords →
        </button>
      </div>
    </div>

    ${state.pendingSlot ? renderNotePicker() : ''}
  `;
}

function renderNotePicker() {
  const allNotes = new Set(getAllNotes(state.layout));
  const octaves = [2, 3, 4, 5];

  const rows = octaves.map(oct => {
    const cols = NOTE_NAMES.map(name => {
      const noteStr = `${name}${oct}`;
      const inUse = allNotes.has(noteStr);
      const label = displayNote(name, state.useFlats);
      return `<button class="note-btn ${inUse ? 'in-use' : ''}"
        data-action="pick-note" data-note="${noteStr}"
        ${inUse ? 'disabled' : ''}>${label}</button>`;
    }).join('');
    return `<div class="note-octave-row">
      <span class="octave-label">${oct}</span>
      ${cols}
    </div>`;
  }).join('');

  const slotLabel = state.pendingSlot.shell === 'ding'
    ? 'ding (center)'
    : `${state.pendingSlot.shell === 'top' ? 'ring' : 'gu'} slot ${state.pendingSlot.index + 1}`;

  return `
    <div class="modal-overlay" data-action="close-picker">
      <div class="modal">
        <div class="modal-title">Choose a note</div>
        <div class="modal-sub">For ${slotLabel} · Grayed notes already on instrument</div>
        ${rows}
        <div class="modal-actions">
          <button class="btn btn-secondary btn-sm" data-action="close-picker">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

// ── View 3: Chord Explorer ───────────────────────────────────────────────────
function viewChords() {
  const { chords, chordFilter, selectedChord, layout } = state;
  const uf = state.useFlats;
  const us = state.useSolfege;

  // Root options: NOTE_NAMES[i] is at PC i — filter by which PCs have chords.
  const ROOT_ORDER = NOTE_NAMES;
  const usedRootPCs = new Set(chords.map(c => notePC(c.rootNote)));
  const roots = ['All', ...ROOT_ORDER.filter((_, i) => usedRootPCs.has(i))];

  // Apply filters — compare root by PC to handle G# ↔ Ab equivalence.
  const layoutId = layout.isCustom ? (layout.savedId || layout.id) : layout.id;
  // Match by abstract chord identity (layoutId+chordId), not the entry's exact
  // stored id — that id gets a notes suffix once a voicing is saved, which
  // would otherwise make the chord silently drop out of this filtered list.
  const playlistChordKeys = chordFilter.playlist !== 'All'
    ? new Set((state.playlists.find(p => p.id === chordFilter.playlist)?.chords ?? []).map(c => `${c.layoutId}-${c.chordId}`))
    : null;

  const filtered = chords.filter(c => {
    if (state.chordCountSet.size > 0) {
      const k = c.noteCount >= 5 ? '5+' : String(c.noteCount);
      if (!state.chordCountSet.has(k)) return false;
    }
    if (chordFilter.category !== 'All' && c.type.category !== chordFilter.category) return false;
    if (chordFilter.root !== 'All') {
      const filterPC = ROOT_ORDER.indexOf(chordFilter.root);
      if (notePC(c.rootNote) !== filterPC) return false;
    }
    if (playlistChordKeys !== null) {
      if (!playlistChordKeys.has(`${layoutId}-${c.id}`)) return false;
    }
    return true;
  });
  // Preserve playlist order when a playlist filter is active
  if (chordFilter.playlist !== 'All') {
    const pl = state.playlists.find(p => p.id === chordFilter.playlist);
    if (pl) {
      const orderMap = new Map(pl.chords.map((c, i) => [`${c.layoutId}-${c.chordId}`, i]));
      filtered.sort((a, b) =>
        (orderMap.get(`${layoutId}-${a.id}`) ?? Infinity) - (orderMap.get(`${layoutId}-${b.id}`) ?? Infinity)
      );
    }
  } else {
    filtered.sort((a, b) => {
      const rA = notePC(a.rootNote), rB = notePC(b.rootNote);
      return rA !== rB ? rA - rB : b.noteCount - a.noteCount;
    });
  }

  const selectedFavId = selectedChord ? favIdForChord(layoutId, selectedChord, chords) : null;
  const selectedInAny = selectedChord ? isChordBookmarkedAnyVoicing(layoutId, selectedChord.id) : false;

  // Show a "save voicing" button only when the selected chord came from a
  // playlist entry (same abstract chord) and its notes have since diverged.
  const sourcePl = state.sourcePlaylistId ? state.playlists.find(p => p.id === state.sourcePlaylistId) : null;
  const sourceEntry = sourcePl ? sourcePl.chords.find(c => c.id === state.sourceEntryId) : null;
  const canUpdateEntry = !!(selectedChord && sourceEntry && sourceEntry.chordId === selectedChord.id
    && sourceEntry.notes.join(',') !== selectedChord.notes.join(','));

  const autoplayPl = chordFilter.playlist !== 'All' ? state.playlists.find(p => p.id === chordFilter.playlist) : null;
  const autoplayPos = autoplayPl && selectedFavId ? autoplayPl.chords.findIndex(c => c.id === selectedFavId) : -1;

  const discoverMatches = state.discoverMode ? identifyChord(state.discoverNotes) : [];

  // Discover mode's clicked notes get the same treatment as a selected chord's
  // notes: exact matches highlighted, other same-pitch-class positions dimmed.
  const activeNotes = state.discoverMode ? state.discoverNotes : (selectedChord ? selectedChord.notes : null);
  const highlightNotes = activeNotes || [];
  const chordPCs = activeNotes ? new Set(activeNotes.map(n => notePC(n))) : new Set();
  const altHighlightNotes = activeNotes
    ? getAllNotes(layout).filter(n => chordPCs.has(notePC(n)) && !activeNotes.includes(n))
    : [];
  const panSvg = renderPan(layout, { shellMode: 'both', highlightNotes, altHighlightNotes, rotated: state.ringRotated, useFlats: uf, useSolfege: us });

  let relatedHtml = '';
  if (selectedChord) {
    const { sameType, sharedNotes } = getRelatedChords(selectedChord, chords);
    const sameTypeChips = sameType.map(c =>
      `<span class="related-chip" data-action="select-chord" data-id="${c.id}">
        ${displayNote(c.rootName, uf, us)} ${c.type.name}
      </span>`
    ).join('');
    const sharedChips = sharedNotes.slice(0, 10).map(c =>
      `<span class="related-chip" data-action="select-chord" data-id="${c.id}">
        ${displayNote(c.rootName, uf, us)} ${c.type.name}
      </span>`
    ).join('');

    relatedHtml = `
      <div class="related-section">
        ${sameType.length > 0 ? `
          <div class="related-title">Same type, other roots</div>
          <div class="related-chips">${sameTypeChips}</div>
        ` : ''}
        ${sharedNotes.length > 0 ? `
          <div class="related-title mt-12">Shares 2+ notes</div>
          <div class="related-chips">${sharedChips}</div>
        ` : ''}
      </div>
    `;
  }

  return `
    <div class="app-header">
      <div class="breadcrumb">
        ${backCrumb()}
        <span>/</span>
        <a data-action="back-editor">← ${escHtml(layout.name)}</a>
        <span>/</span>
        <span>Chords</span>
      </div>
      <div style="display:flex;gap:6px;margin-left:auto;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn btn-secondary btn-sm" data-action="toggle-rotation"
          title="Rotate the ring so two lowest notes face you instead of one">
          ${icon('rotate')} ${state.ringRotated ? 'Standard' : 'Rotate'}
        </button>
        <button class="btn ${uf ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="toggle-flats"
          title="Switch between sharp (C#) and flat (Db) notation">♭ Flats</button>
        <button class="btn ${us ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="toggle-solfege"
          title="Switch between letter names (C, D) and solfège (Do, Re)">Do-Re-Mi</button>
        <button class="btn ${state.discoverMode ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="toggle-discover-mode"
          title="Click note fields on the pan to identify what chord they form">${icon('search')} Discover</button>
        <button class="btn btn-secondary btn-sm" data-action="copy-url">Copy URL</button>
      </div>
    </div>

    <div class="explorer-layout">
      ${state.discoverMode ? `
      <div class="chord-list">
        <div class="discover-panel">
          <div class="discover-hint">Click note fields on the pan to build a chord — click again to remove one.</div>
          ${state.discoverNotes.length > 0 ? `
            <div class="pills discover-selected">
              ${state.discoverNotes.map(n => `<span class="pill active">${displayNote(n, uf, us)}</span>`).join('')}
            </div>
            <button class="btn btn-secondary btn-sm" data-action="discover-clear">Clear</button>
          ` : ''}
        </div>
      </div>

      <div class="chord-panel">
        ${(() => {
          if (state.discoverNotes.length < 2) {
            return `<div class="chord-panel-empty"><span class="hint">Select 2 or more note fields to identify a chord</span></div>`;
          }
          if (discoverMatches.length === 0) {
            return `
              <div class="chord-panel-header">
                <div>
                  <div class="chord-panel-title">Custom combination</div>
                  <div class="chord-panel-sub">Not a recognized chord type · ${state.discoverNotes.length} notes: ${state.discoverNotes.map(n => displayNote(n, uf, us)).join(', ')}</div>
                </div>
                <div class="chord-play-btns">
                  <button class="fav-btn panel-fav" data-action="discover-bookmark-custom" title="Bookmark this combination">${icon('heart')}</button>
                  <button class="btn btn-primary btn-sm" data-action="discover-play-custom">${icon('play')} Chord</button>
                </div>
              </div>
            `;
          }
          return discoverMatches.map((m, idx) => {
            const favId = favIdForChord(layoutId, m, chords);
            const inAny = isChordBookmarkedAnyVoicing(layoutId, m.id);
            return `
              <div class="chord-panel-header">
                <div>
                  <div class="chord-panel-title">${displayNote(m.rootName, uf, us)} ${m.type.name}</div>
                  <div class="chord-panel-sub">${m.type.category} · ${m.noteCount} notes: ${m.notes.map(n => displayNote(n, uf, us)).join(', ')}</div>
                </div>
                <div class="chord-play-btns">
                  <button class="fav-btn panel-fav ${inAny ? 'active' : ''}"
                    data-action="discover-bookmark" data-match-idx="${idx}" title="Bookmark this voicing">${icon('heart')}</button>
                  <button class="btn btn-primary btn-sm" data-action="discover-play" data-match-idx="${idx}">${icon('play')} Chord</button>
                </div>
              </div>
            `;
          }).join('');
        })()}
      </div>
      ` : `
      <div class="chord-list">
        <div class="chord-list-header">
          <div class="chord-filter-dropdowns">
            <div class="count-pills">
              ${['2','3','4','5+'].map(n => `<button class="pill count-pill ${state.chordCountSet.has(n) ? 'active' : ''}" data-action="toggle-note-count" data-count="${n}">${n}</button>`).join('')}
            </div>
            <select class="select-input" data-action="filter-category">
              <option value="All" ${chordFilter.category === 'All' ? 'selected' : ''}>All types</option>
              ${CHORD_CATEGORIES.filter(c => c !== 'All').map(cat => `
                <option value="${cat}" ${chordFilter.category === cat ? 'selected' : ''}>${cat}</option>
              `).join('')}
            </select>
            <select class="select-input" data-action="select-playlist-filter">
              <option value="All" ${chordFilter.playlist === 'All' ? 'selected' : ''}>All lists</option>
              ${state.playlists.map(pl => `<option value="${escHtml(pl.id)}" ${chordFilter.playlist === pl.id ? 'selected' : ''}>${escHtml(pl.name)}</option>`).join('')}
              ${chordFilter.playlist !== 'All' ? `<option value="__edit__">Edit playlist</option>` : ''}
            </select>
          </div>
          ${autoplayPl ? `
            <div class="autoplay-bar">
              <button class="btn btn-sm ${state.autoplayOn ? 'btn-primary' : 'btn-secondary'}" data-action="toggle-autoplay">
                ${state.autoplayOn ? icon('pause') + ' Pause' : icon('play') + ' Auto-play'}
              </button>
              <select class="select-input select-sm" data-action="set-autoplay-seconds" title="Seconds per chord">
                ${[3, 4, 5, 6, 8, 10].map(s => `<option value="${s}" ${state.autoplaySeconds === s ? 'selected' : ''}>${s}s</option>`).join('')}
              </select>
              ${autoplayPos >= 0 ? `<span class="hint">${autoplayPos + 1} / ${autoplayPl.chords.length}</span>` : ''}
            </div>
          ` : ''}
          <div class="pills" style="margin-bottom:4px">
            ${roots.map(r => `<button class="pill ${chordFilter.root === r ? 'active' : ''}"
              data-action="filter-root" data-root="${r}">${r === 'All' ? 'All' : displayNote(r, uf, us)}</button>`).join('')}
          </div>
          <div style="margin-bottom:4px">
            <span class="hint">${filtered.length} chord${filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        ${(() => {
          return filtered.length === 0
            ? '<div class="empty-state">No chords match these filters</div>'
            : filtered.map(c => {
              const favId = `${layoutId}-${c.id}`;
              const inAny = isChordBookmarkedAnyVoicing(layoutId, c.id);
              return `<div class="chord-item ${selectedChord?.id === c.id ? 'selected' : ''}"
                data-action="select-chord" data-id="${c.id}">
                <div>
                  <div class="chord-item-name">${displayNote(c.rootName, uf, us)} ${c.type.name}</div>
                  <div class="chord-item-type">${c.type.category}</div>
                </div>
                <div class="chord-item-right">
                  <button class="fav-btn ${inAny ? 'active' : ''}"
                    data-action="show-playlist-picker" data-chord-id="${c.id}" data-chord-fav-id="${escHtml(favId)}" title="Add to playlist">${icon('heart')}</button>
                  ${canUpdateEntry && selectedChord?.id === c.id ? `
                    <button class="btn-icon row-save" data-action="update-playlist-entry" title="Save this voicing to ${escHtml(sourcePl.name)}">${icon('save')}</button>
                  ` : ''}
                  <span class="chord-count">${c.noteCount}</span>
                </div>
              </div>`;
            }).join('');
        })()}
      </div>

      <div class="chord-panel">
        ${selectedChord ? `
          <div class="chord-panel-header">
            <div>
              <div class="chord-panel-title">${displayNote(selectedChord.rootName, uf, us)} ${selectedChord.type.name}</div>
              <div class="chord-panel-sub">${selectedChord.type.category} · ${selectedChord.noteCount} notes: ${selectedChord.notes.map(n => displayNote(n, uf, us)).join(', ')}</div>
            </div>
            <div class="chord-play-btns">
              <button class="fav-btn panel-fav ${selectedInAny ? 'active' : ''}"
                data-action="show-playlist-picker" data-chord-id="${selectedChord.id}"
                data-chord-fav-id="${escHtml(selectedFavId)}" title="Add to playlist">${icon('heart')}</button>
              ${canUpdateEntry ? `
                <button class="btn-icon" data-action="update-playlist-entry" title="Save this voicing to ${escHtml(sourcePl.name)}">${icon('save')}</button>
              ` : ''}
              <button class="btn btn-primary btn-sm" data-action="play-chord">${icon('play')} Chord</button>
              <button class="btn btn-secondary btn-sm" data-action="play-scale">${icon('play')} Scale</button>
            </div>
          </div>
          ${relatedHtml}
        ` : `
          <div class="chord-panel-empty">
            <span class="hint">Select a chord to see it on the pan</span>
            <button class="btn btn-secondary btn-sm" data-action="play-scale">${icon('play')} Scale</button>
          </div>
        `}
      </div>
      `}

      <div class="pan-col">
        <div class="pan-wrap">
          ${panSvg}
        </div>
      </div>
    </div>
    ${state.pickerChordFavId ? renderPlaylistPicker() : ''}
  `;
}

// ── Playlist picker overlay ──────────────────────────────────────────────────
function renderPlaylistPicker() {
  const favId = state.pickerChordFavId;
  return `
    <div class="modal-overlay" data-action="close-playlist-picker">
      <div class="modal picker-modal">
        <div class="picker-title">Add to playlist</div>
        ${state.playlists.map(pl => {
          const inPl = pl.chords.some(c => c.id === favId);
          return `<div class="picker-row ${inPl ? 'in-playlist' : ''}"
            data-action="toggle-playlist-chord" data-playlist-id="${escHtml(pl.id)}">
            <span class="picker-check">${inPl ? icon('check') : ''}</span>
            <span class="picker-name">${escHtml(pl.name)}</span>
            <span class="picker-count">${pl.chords.length}</span>
          </div>`;
        }).join('')}
        ${state.pickerNewPlaylist
          ? `<div class="picker-new-row">
               <input class="name-input picker-new-input" id="new-playlist-input" placeholder="Playlist name…">
               <button class="btn btn-primary btn-sm" data-action="confirm-new-playlist">Create</button>
             </div>`
          : `<div class="picker-row picker-create" data-action="show-new-playlist-input">
               <span class="picker-check">${icon('plus')}</span>
               <span class="picker-name">New playlist</span>
             </div>`
        }
      </div>
    </div>
  `;
}

// ── View 4: Playlist ─────────────────────────────────────────────────────────
function viewPlaylist() {
  const pl = state.playlists.find(p => p.id === state.activePlaylistId);
  if (!pl) return viewSelector();
  const uf = state.useFlats;
  const us = state.useSolfege;

  return `
    <div class="app-header">
      <div class="breadcrumb">
        ${backCrumb()}
        <span>/</span>
        <span>${escHtml(pl.name)}</span>
      </div>
    </div>

    <div class="playlist-view">
      <div class="playlist-header">
        <input class="name-input" id="playlist-name-input" value="${escHtml(pl.name)}" placeholder="Playlist name">
        ${pl.id !== 'favorites' ? `
          <button class="btn btn-secondary btn-sm" data-action="delete-playlist"
            style="color:var(--error,#e05);border-color:var(--error,#e05)">Delete</button>
        ` : ''}
      </div>

      ${pl.chords.length === 0
        ? `<div class="empty-state" style="margin-top:40px">No chords yet.<br>
            Use the heart icon in the chord explorer to add chords here.</div>`
        : pl.chords.map((chord, idx) => `
          <div class="playlist-item">
            <div class="playlist-item-reorder">
              <button class="btn-icon" data-action="move-chord-up" data-idx="${idx}"
                ${idx === 0 ? 'disabled' : ''}>${icon('chevron-up')}</button>
              <button class="btn-icon" data-action="move-chord-down" data-idx="${idx}"
                ${idx === pl.chords.length - 1 ? 'disabled' : ''}>${icon('chevron-down')}</button>
            </div>
            <div class="playlist-item-info" data-action="open-playlist-chord" data-idx="${idx}">
              <div class="playlist-item-name">${escHtml(displayNote(chord.rootName, uf, us))} ${escHtml(chord.typeName)}</div>
              <div class="playlist-item-scale">${escHtml(chord.scaleName)}</div>
              <div class="playlist-item-notes hint">${chord.notes.map(n => displayNote(n, uf, us)).join(' · ')}</div>
            </div>
            <button class="playlist-item-remove" data-action="remove-playlist-chord" data-idx="${idx}">${icon('x')}</button>
          </div>
        `).join('')
      }
    </div>
  `;
}

// ── Playlist chord navigation (shared by manual open + autoplay) ────────────
function loadPlaylistChordAt(pl, idx) {
  const fav = pl.chords[idx];
  if (!fav || fav.instrumentId) return false; // ocarina / flute entries play on their own instrument
  if (fav.layoutData) {
    state.layout = fav.layoutData;
  } else {
    const saved = state.savedLayouts.find(l => l.id === fav.layoutId);
    if (saved) {
      state.layout = saved.layout;
    } else {
      const scale = SCALES.find(s => s.id === fav.layoutId);
      if (!scale) return false;
      state.layout = createLayoutFromScale(scale);
    }
  }
  state.chords = findAllChords(state.layout);
  const canonical = state.chords.find(c => c.id === fav.chordId) || null;
  if (canonical) {
    // Preserve the exact voicing saved with this playlist entry — it may differ
    // from the canonical (default) notes if the user swapped to an alt position.
    state.selectedChord = Array.isArray(fav.notes) ? { ...canonical, notes: fav.notes } : canonical;
  } else {
    // No canonical chord type (e.g. a Discover-mode "Custom" combination) —
    // rebuild a displayable chord object directly from what was saved.
    state.selectedChord = {
      id: fav.chordId, rootName: fav.rootName,
      type: { name: fav.typeName, category: fav.category },
      notes: fav.notes, noteCount: fav.noteCount,
    };
  }
  state.shellMode = 'both';
  const owned = getInstrument(handpanInstrumentId(fav.layoutId));
  state.currentInstrumentId = owned ? owned.id : null;
  // Remember where this chord came from so a later voicing swap can be
  // saved back into this exact entry instead of only adding a new one.
  state.sourcePlaylistId = pl.id;
  state.sourceEntryId = fav.id;
  return true;
}

// The playlist entry for a chord picked in the playlist picker. Handpan
// entries are unchanged; ocarina and flute entries also record the
// instrument they were saved from, so they play back as fingerings.
function playlistEntryFor(chord, favId) {
  const common = {
    id: favId, chordId: chord.id, rootName: chord.rootName,
    typeName: chord.type.name, category: chord.type.category,
    notes: chord.notes, noteCount: chord.noteCount,
  };
  const inst = state.view === 'instrument' ? currentInstrument() : null;
  if (inst) {
    return { ...common, layoutId: ocLayoutId(inst), layoutData: null, scaleName: inst.name, family: inst.family, instrumentId: inst.id };
  }
  const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
  return {
    ...common, layoutId,
    layoutData: state.layout.isCustom ? JSON.parse(JSON.stringify(state.layout)) : null,
    scaleName: state.layout.name,
  };
}

// Playlist-entry id for a chord. The canonical (default) voicing keeps the
// plain `${layoutId}-${chordId}` form used before per-voicing bookmarks existed,
// so existing playlists never need migrating. Only a chord swapped to a
// non-default voicing gets a notes-suffixed id, which can't collide with any
// id saved before this feature existed.
function favIdForChord(layoutId, chord, canonicalChords) {
  const canonical = canonicalChords.find(c => c.id === chord.id);
  const isCustomVoicing = !canonical || canonical.notes.join(',') !== chord.notes.join(',');
  return isCustomVoicing
    ? `${layoutId}-${chord.id}-${chord.notes.join(',')}`
    : `${layoutId}-${chord.id}`;
}

// Swap one note of a chord for an alternate same-pitch-class position elsewhere
// on the pan. Returns a new chord object — never mutates state.chords entries.
function swapChordNoteVoicing(chord, targetNote) {
  const targetPC = notePC(targetNote);
  const newNotes = chord.notes.map(n => notePC(n) === targetPC ? targetNote : n);
  return { ...chord, notes: newNotes };
}

let _autoplayTimer = null;

function stopAutoplay() {
  if (_autoplayTimer) { clearInterval(_autoplayTimer); _autoplayTimer = null; }
  state.autoplayOn = false;
  state.autoplayPlaylistId = null;
}

function playSelectedChordSound() {
  if (!state.selectedChord) return;
  initAudio();
  playChord(state.selectedChord.notes,
    note => updatePanPlaying([note]),
    notes => updatePanPlaying(notes)
  );
}

// Advance to the next chord in the autoplaying playlist, wrapping around.
// Bails out (and stops the timer) if autoplay was turned off or the playlist vanished.
function advanceAutoplay() {
  const pl = state.playlists.find(p => p.id === state.autoplayPlaylistId);
  if (!state.autoplayOn || state.view !== 'chords' || !pl || pl.chords.length === 0) {
    stopAutoplay();
    render();
    return;
  }
  const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
  const curFavId = state.selectedChord ? favIdForChord(layoutId, state.selectedChord, state.chords) : null;
  const curIdx = pl.chords.findIndex(c => c.id === curFavId);
  // Skip ocarina / flute entries: they play in that instrument's practice mode.
  let nextIdx = (curIdx + 1) % pl.chords.length;
  for (let n = 0; n < pl.chords.length && pl.chords[nextIdx].instrumentId; n++) nextIdx = (nextIdx + 1) % pl.chords.length;
  if (!loadPlaylistChordAt(pl, nextIdx)) { stopAutoplay(); render(); return; }
  history.replaceState(null, '', stateToHash());
  render();
  playSelectedChordSound();
}

function startAutoplay(pl) {
  if (pl.chords.length === 0) { showToast('No chords in playlist yet'); return; }
  stopAutoplay();
  state.autoplayOn = true;
  state.autoplayPlaylistId = pl.id;
  const layoutId = state.layout?.isCustom ? (state.layout.savedId || state.layout.id) : state.layout?.id;
  const curFavId = state.selectedChord && state.layout ? favIdForChord(layoutId, state.selectedChord, state.chords) : null;
  let startIdx = Math.max(0, pl.chords.findIndex(c => c.id === curFavId));
  for (let n = 0; n < pl.chords.length && pl.chords[startIdx].instrumentId; n++) startIdx = (startIdx + 1) % pl.chords.length;
  if (!loadPlaylistChordAt(pl, startIdx)) { stopAutoplay(); return; }
  history.replaceState(null, '', stateToHash());
  render();
  playSelectedChordSound();
  _autoplayTimer = setInterval(advanceAutoplay, state.autoplaySeconds * 1000);
}

// ── URL serialization ────────────────────────────────────────────────────────
function stateToHash() {
  if (!state.layout) return '';
  const chordSuffix = state.selectedChord ? `&chord=${state.selectedChord.id}` : '';

  if (!state.layout.isCustom) {
    return `#scale=${state.layout.id}${chordSuffix}`;
  }

  const topSlots = state.layout.top.slots.map(s => s.note ?? 'null').join(',');
  const bottomSlots = state.layout.bottom.slots.map(s => s.note ?? 'null').join(',');
  const params = new URLSearchParams({
    ding: state.layout.top.ding,
    top: topSlots,
    bottom: bottomSlots,
    tc: state.layout.top.capacity,
    bc: state.layout.bottom.capacity,
    name: state.layout.name,
  });
  return `#custom?${params}${chordSuffix}`;
}

function loadFromHash() {
  const hash = window.location.hash;
  if (!hash || hash === '#') return;

  let chordId = null;

  if (hash === '#scales') { state.view = 'selector'; return; }
  if (hash.startsWith('#p/')) { openSharedLink(decodeURIComponent(hash.slice(3))); return; }
  if (hash.startsWith('#i/')) {
    const [id, tab] = hash.slice(3).split('/');
    if (openInstrument(decodeURIComponent(id), { push: false }) && ['chords', 'notes', 'builder', 'setup'].includes(tab)) {
      state.oc.tab = tab;
    }
    return;
  }

  if (hash.startsWith('#scale=')) {
    const raw = hash.slice(7);
    const [scaleId, ...rest] = raw.split('&chord=');
    chordId = rest[0] || null;
    const scale = SCALES.find(s => s.id === scaleId);
    if (scale) {
      // Prefer the user's own saved copy, so it opens as that instrument.
      const owned = getInstrument(handpanInstrumentId(scaleId));
      const saved = owned && state.savedLayouts.find(l => l.id === scaleId);
      state.layout = saved ? JSON.parse(JSON.stringify(saved.layout)) : createLayoutFromScale(scale);
      state.currentInstrumentId = saved ? owned.id : null;
      state.chords = findAllChords(state.layout);
      state.view = chordId ? 'chords' : 'editor';
    }
  } else if (hash.startsWith('#custom?')) {
    const rawParams = hash.slice(8);
    const chordMarker = rawParams.indexOf('&chord=');
    const paramStr = chordMarker >= 0 ? rawParams.slice(0, chordMarker) : rawParams;
    chordId = chordMarker >= 0 ? rawParams.slice(chordMarker + 7) : null;

    const params = new URLSearchParams(paramStr);
    const topSlots = (params.get('top') || '').split(',').map(n => ({ note: n === 'null' ? null : n }));
    const bottomSlots = (params.get('bottom') || '').split(',').map(n => ({ note: n === 'null' ? null : n }));
    state.layout = {
      id: 'custom',
      name: params.get('name') || 'Custom Layout',
      isCustom: true,
      top: {
        ding: params.get('ding') || 'D3',
        slots: topSlots,
        capacity: parseInt(params.get('tc') || '8'),
      },
      bottom: {
        slots: bottomSlots,
        capacity: parseInt(params.get('bc') || '3'),
      },
    };
    state.chords = findAllChords(state.layout);
    state.view = chordId ? 'chords' : 'editor';
  }

  if (chordId && state.chords.length) {
    state.selectedChord = state.chords.find(c => c.id === chordId) || null;
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ── Preferences (persist across sessions) ────────────────────────────────────
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('hp-prefs') || '{}');
    if (typeof p.ringRotated === 'boolean') state.ringRotated = p.ringRotated;
    if (typeof p.useFlats === 'boolean') state.useFlats = p.useFlats;
    if (typeof p.useSolfege === 'boolean') state.useSolfege = p.useSolfege;
    if (typeof p.autoplaySeconds === 'number') state.autoplaySeconds = p.autoplaySeconds;
    if (typeof p.showFingers === 'boolean') state.showFingers = p.showFingers;
    if (typeof p.showSizes === 'boolean') state.showSizes = p.showSizes;
    if (typeof p.ocLegendSeen === 'boolean') state.ocLegendSeen = p.ocLegendSeen;
    if (typeof p.handLegendSeen === 'boolean') state.handLegendSeen = p.handLegendSeen;
  } catch {}
}

function savePrefs() {
  localStorage.setItem('hp-prefs', JSON.stringify({
    ringRotated: state.ringRotated,
    useFlats: state.useFlats,
    useSolfege: state.useSolfege,
    autoplaySeconds: state.autoplaySeconds,
    showFingers: state.showFingers,
    showSizes: state.showSizes,
    ocLegendSeen: state.ocLegendSeen,
    handLegendSeen: state.handLegendSeen,
  }));
  scheduleSave();
}

// ── Auth sync ─────────────────────────────────────────────────────────────────

// Merge two arrays of objects by id, keeping the newest version of each item.
// Items with deletedAt propagate deletes to the other device.
function mergeById(local, cloud) {
  const byId = new Map();
  for (const item of [...(local || []), ...(cloud || [])]) {
    const existing = byId.get(item.id);
    if (!existing || (item.updatedAt || '') > (existing.updatedAt || '')) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

// Returns true if two arrays have the same ids and updatedAt timestamps (order-independent).
function sameByTimestamp(a, b) {
  if (a.length !== b.length) return false;
  const bMap = new Map(b.map(x => [x.id, x.updatedAt || '']));
  return a.every(x => bMap.get(x.id) === (x.updatedAt || ''));
}

// Merge cloud data into local — per-item union, newest version of each wins.
// Returns true if anything changed locally (triggers re-render).
// Also uploads the merged result so the other device eventually sees our items.
function mergeCloudData(cloud) {
  if (!cloud) return false;

  const localPlaylists = JSON.parse(localStorage.getItem('hp-playlists') || '[]');
  const localLayouts   = JSON.parse(localStorage.getItem('hp-layouts')   || '[]');

  const mergedPlaylists = mergeById(localPlaylists, cloud.playlists);
  const mergedLayouts   = mergeById(localLayouts,   cloud.layouts);

  const playlistsSame = sameByTimestamp(mergedPlaylists, localPlaylists);
  const layoutsSame   = sameByTimestamp(mergedLayouts,   localLayouts);

  if (!playlistsSame) {
    localStorage.setItem('hp-playlists', JSON.stringify(mergedPlaylists));
    state.playlists    = mergedPlaylists.filter(p => !p.deletedAt);
    state.favorites    = getFavorites();
  }
  if (!layoutsSame) {
    localStorage.setItem('hp-layouts', JSON.stringify(mergedLayouts));
    state.savedLayouts = getSavedLayouts();
    refreshInstruments();
  }

  if (cloud.prefs && Object.keys(cloud.prefs).length > 0) {
    const localTs = localStorage.getItem('hp-updated-at') || '1970';
    if ((cloud.updated_at || '') > localTs) {
      localStorage.setItem('hp-prefs', JSON.stringify(cloud.prefs));
      loadPrefs();
    }
  }

  if (!playlistsSame || !layoutsSame) {
    // Push merged result back so other device sees our items too.
    scheduleSave();
    return true;
  }
  return false;
}

// Check cloud for changes — called on login, visibility restore, and poll.
async function checkForUpdates() {
  if (!isLoggedIn()) return;
  const cloud = await loadCloudData();
  if (mergeCloudData(cloud)) render();
  syncInstrumentsNow();
}

let _syncPoll = null;
function startSyncPoll() {
  if (_syncPoll) return;
  _syncPoll = setInterval(() => {
    if (document.visibilityState === 'visible') checkForUpdates();
  }, 30000);
}
function stopSyncPoll() {
  if (_syncPoll) { clearInterval(_syncPoll); _syncPoll = null; }
}

async function handleLogin(event, session) {
  if (!session || event === 'TOKEN_REFRESHED') { render(); return; }
  const cloud = await loadCloudData();
  mergeCloudData(cloud);
  scheduleSave(); // always push local on login — ensures cloud has our data
  syncInstrumentsNow();
  startSyncPoll();
  render();
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
loadPrefs();
refreshInstruments();
if (location.hash && location.hash !== '#') loadFromHash();
else openStartView();
render();

// Pre-warm AudioContext on the very first user touch.
// Both pointerdown and touchstart are registered: iOS Chrome (WKWebView) requires
// a user-gesture-initiated ctx.resume(); touchstart is the historically reliable
// trigger on older iOS while pointerdown covers desktop and modern iOS.
// initAudio() is idempotent so firing both for the same touch is harmless.
initSupabase(handleLogin);

// Sync when the user brings the app back to the foreground (tab switch, PWA resume).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && state.tuner.on) toggleTuner();
  if (document.visibilityState === 'visible') checkForUpdates();
});

document.addEventListener('pointerdown', () => initAudio(), { once: true });
document.addEventListener('touchstart', () => initAudio(), { once: true, passive: true });

// ── Global click delegation ───────────────────────────────────────────────────
document.addEventListener('click', e => {
  // ── Pan note click — must be checked BEFORE the data-action early return ──
  const noteEl = e.target.closest('.pan-note');
  if (noteEl && state.layout) {
    const noteId = noteEl.dataset.noteId;
    const isEmpty = noteEl.classList.contains('empty');
    const isCustom = state.layout.isCustom;

    if (!isEmpty) {
      const noteToPlay = noteEl.dataset.note;
      if (noteToPlay) {
        initAudio();
        playNote(noteToPlay);
        setTimeout(() => updatePanPlaying([noteToPlay]), 0);
      }
    }

    if (state.view !== 'editor') return;
    if (!isCustom) return;

    if (isEmpty) {
      if (noteId === 'ding') state.pendingSlot = { shell: 'ding', index: -1 };
      else if (noteId?.startsWith('ring-')) state.pendingSlot = { shell: 'top', index: parseInt(noteId.split('-')[1]) };
      else if (noteId?.startsWith('gu-')) state.pendingSlot = { shell: 'bottom', index: parseInt(noteId.split('-')[1]) };
      render();
      return;
    }

    if (noteId === 'ding') { state.pendingSlot = { shell: 'ding', index: -1 }; render(); return; }
    if (noteId?.startsWith('ring-') && (state.shellMode === 'top' || state.shellMode === 'both')) {
      const idx = parseInt(noteId.split('-')[1]);
      state.layout.top.slots[idx].note = null;
      state.chords = findAllChords(state.layout);
      render();
      return;
    }
    if (noteId?.startsWith('gu-') && (state.shellMode === 'bottom' || state.shellMode === 'both')) {
      const idx = parseInt(noteId.split('-')[1]);
      if (state.layout.bottom.slots[idx]) { state.layout.bottom.slots[idx].note = null; state.chords = findAllChords(state.layout); render(); }
      return;
    }
    return;
  }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  // ── My instruments ────────────────────────────────────────────────────────
  if (action === 'open-instrument') {
    if (e.target.closest('[data-action="delete-instrument"]')) return;
    if (openInstrument(el.dataset.id)) render();
    else showToast('Instrument not found');
    return;
  }
  if (action === 'delete-instrument') {
    e.stopPropagation();
    const inst = getInstrument(el.dataset.id);
    if (!inst || !confirm(`Remove ${inst.name} from My instruments?`)) return;
    if (inst.family === 'handpan') {
      // A handpan instrument is its saved layout: removing one removes both.
      deleteLayout(inst.layoutId);
      state.savedLayouts = getSavedLayouts();
      scheduleSave();
    } else {
      deleteInstrument(inst.id);
    }
    refreshInstruments();
    render();
    return;
  }
  if (action === 'back-home') {
    stopAutoplay();
    Object.assign(state, {
      view: 'home', layout: null, selectedChord: null, pendingSlot: null,
      sourcePlaylistId: null, sourceEntryId: null, currentInstrumentId: null,
      wizard: null, discoverMode: false, discoverNotes: [], shared: null, sharedStatus: null, shareModal: null,
    });
    refreshInstruments();
    history.pushState(null, '', location.pathname);
    render();
    return;
  }
  if (action === 'other-instrument') {
    state.currentInstrumentId = null;
    state.view = 'selector';
    history.pushState(null, '', '#scales');
    render();
    return;
  }
  if (action === 'add-instrument') {
    state.wizard = newWizard(false);
    state.view = 'wizard';
    render();
    return;
  }


  // ── Ocarina Notes view ────────────────────────────────────────────────────
  if (action === 'oc-select-note') {
    const m = parseInt(el.dataset.midi, 10);
    if (m !== state.oc.selected) { state.oc.previous = state.oc.selected; state.oc.selected = m; }
    initAudio();
    playNote(midiToNoteName(m));
    render();
    return;
  }
  if (action === 'oc-play-selected') {
    initAudio();
    playNote(midiToNoteName(state.oc.selected));
    return;
  }
  if (action === 'oc-play-scale') {
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
  }
  if (action === 'oc-toggle-fingers') {
    state.showFingers = !state.showFingers;
    // The finger legend opens by itself the first time labels are switched on.
    if (state.showFingers && !state.handLegendSeen) { state.handLegendSeen = true; state.oc.handLegend = true; }
    savePrefs(); render(); return;
  }
  if (action === 'oc-toggle-sizes') { state.showSizes = !state.showSizes; savePrefs(); render(); return; }
  if (action === 'oc-legend-dismiss') { state.ocLegendSeen = true; savePrefs(); render(); return; }
  if (action === 'oc-hand-open') { state.oc.handLegend = true; render(); return; }
  if (action === 'oc-hand-close') {
    if (e.target.closest('.modal') && !e.target.closest('[data-action="oc-hand-close"].btn')) return;
    state.oc.handLegend = false; render(); return;
  }


  if (action === 'tuner-toggle') { toggleTuner(); return; }
  if (action === 'share-instrument') { shareInstrument(); return; }
  if (action === 'share-close') {
    if (e.target.closest('.modal') && !e.target.closest('.btn')) return;
    state.shareModal = null; render(); return;
  }
  if (action === 'share-copy') {
    navigator.clipboard?.writeText(state.shareModal?.url ?? '').then(() => showToast('Link copied'), () => showToast('Copy the link from the box'));
    return;
  }
  if (action === 'shared-add') {
    if (!state.shared) return;
    const copy = copySharedInstrument(state.shared);
    saveInstrument(copy);
    refreshInstruments();
    state.shared = null;
    openInstrument(copy.id);
    showToast(`${copy.name} added to My instruments`);
    render();
    return;
  }

  // ── Builder and set-up ────────────────────────────────────────────────────
  if (action === 'b-record') {
    const r = state.tuner.reading;
    if (!state.tuner.on) { toggleTuner(); showToast('Tuner on: blow the note, then tap 🎤 again'); return; }
    if (!r?.stable || !r.hz) { showToast('No steady note yet: keep blowing'); return; }
    const inst = currentInstrument();
    if (!inst) return;
    setReading(inst, el.dataset.path, Math.round(r.hz * 10) / 10);
    saveInstrument(inst);
    render();
    return;
  }
  if (action === 'b-stage' || action === 'b-next' || action === 'b-unglazed') {
    let inst = currentInstrument();
    if (!inst) return;
    const target = action === 'b-stage' ? el.dataset.stage
      : action === 'b-unglazed' ? 'done' : nextStage(inst.build.stage);
    if (target === 'done' && inst.build.stage !== 'done') inst = finishInstrumentBuild(inst);
    else inst.build.stage = target;
    saveInstrument(inst);
    refreshInstruments();
    window.scrollTo(0, 0);
    render();
    return;
  }
  if (action === 'b-design') {
    const inst = currentInstrument();
    if (!inst || el.tagName === 'SELECT' || el.tagName === 'INPUT') return; // handled on change
    inst.design = inst.design ?? { scaleId: inst.scaleId, transpose: inst.transpose, includeGu: inst.includeGu };
    const key = el.dataset.key, v = parseInt(el.dataset.value, 10);
    if (key === 'chambers') Object.assign(inst.design, { chambers: v, windowStart: null, excluded: [] });
    if (key === 'windowStart') Object.assign(inst.design, { windowStart: v, excluded: [] });
    if (key === 'toggleNote') {
      const ex = inst.design.excluded ?? [];
      inst.design.excluded = ex.includes(v) ? ex.filter(x => x !== v) : [...ex, v];
    }
    applyDesign(inst);
    saveInstrument(inst);
    render();
    return;
  }
  if (action === 'b-hole-done') {
    const inst = currentInstrument();
    if (!inst) return;
    const ci = parseInt(el.dataset.ci, 10), idx = parseInt(el.dataset.index, 10);
    const per = inst.build.perChamber[ci] = inst.build.perChamber[ci] ?? {};
    const done = per.holesDone ?? [];
    per.holesDone = done.includes(idx) ? done.filter(x => x !== idx) : [...done, idx];
    saveInstrument(inst);
    render();
    return;
  }
  if (action === 'b-window' && el.tagName === 'BUTTON') {
    const inst = currentInstrument();
    if (!inst) return;
    const ci = parseInt(el.dataset.ci, 10);
    const per = inst.build.perChamber[ci] = inst.build.perChamber[ci] ?? {};
    per.window = { ...chamberBuild(inst, ci).window, shape: el.dataset.value };
    saveInstrument(inst);
    render();
    return;
  }
  if (action === 's-calibrate') {
    const inst = currentInstrument();
    if (!inst?.setup) return;
    const ch = calibrateChamber(inst.setup.holes, inst.setup.f0, inst.setup.singles);
    if (!ch || ch.notes.length < 2) { showToast('Those readings don\'t give a chart: check each hole raises the pitch'); return; }
    inst.chambers = [{ notes: ch.notes, holes: ch.holes, fingerings: ch.fingerings }];
    inst.calibration = ch.calibration;
    saveInstrument(inst);
    refreshInstruments();
    state.oc.tab = 'notes';
    showToast(`Chart ready: ${ch.notes.length} notes`);
    render();
    return;
  }


  // ── Ocarina Chords view and practice ──────────────────────────────────────
  if (action === 'oc-tab') {
    state.oc.tab = el.dataset.tab;
    state.oc.practice = null;
    history.replaceState(null, '', `#i/${state.currentInstrumentId}/${state.oc.tab}`);
    render();
    return;
  }
  if (action === 'oc-chord-toggle') {
    if (e.target.closest('.fav-btn, .btn-icon')) return;
    state.oc.expanded = state.oc.expanded === el.dataset.key ? null : el.dataset.key;
    render();
    return;
  }
  if (['oc-play-arp', 'oc-voicing', 'oc-show-playlist-picker'].includes(action)) {
    e.stopPropagation();
    const inst = currentInstrument();
    if (!inst) return;
    const key = el.dataset.key;
    const card = ocCardData(inst, key);
    if (!card) return;
    if (action === 'oc-play-arp') {
      const names = card.midis.map(midiToNoteName);
      const rootName = names.find(n => notePC(n) === card.rootPC) ?? names[0];
      playSequence(arpeggioOrder(names, rootName).map(midiToNoteName));
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
    // Playlist picker, reusing the handpan one.
    const names = card.midis.map(midiToNoteName);
    state.pickerChordFavId = card.entry
      ? (card.midis.join() === card.entry.notes.map(noteToMidi).join() ? card.entry.id : ocFavId(inst, card.chordId, names, null))
      : ocFavId(inst, card.chordId, names, card.canonical);
    state.pickerChordObj = {
      id: card.chordId, rootName: card.rootName, notes: names, noteCount: names.length,
      type: { name: card.typeName, category: card.category },
    };
    state.pickerNewPlaylist = false;
    render();
    return;
  }
  if (action === 'oc-play-note') {
    initAudio();
    playNote(midiToNoteName(parseInt(el.dataset.midi, 10)));
    return;
  }
  if (action === 'oc-play-pair') {
    initAudio();
    playNote(midiToNoteName(parseInt(el.dataset.a, 10)));
    playNote(midiToNoteName(parseInt(el.dataset.b, 10)));
    return;
  }
  if (action === 'oc-practice-start') {
    state.oc.practice = { playlistId: state.oc.playlistId, idx: 0 };
    playPracticeStep();
    render();
    return;
  }
  if (action === 'oc-practice-stop') { state.oc.practice = null; render(); return; }
  if (action === 'oc-practice-next' || action === 'oc-practice-prev') {
    const inst = currentInstrument();
    const pl = state.playlists.find(p => p.id === state.oc.practice?.playlistId);
    if (!inst || !pl) return;
    const n = practiceSteps(inst, pl).length;
    state.oc.practice.idx = (state.oc.practice.idx + (action === 'oc-practice-next' ? 1 : n - 1)) % n;
    state.tuner.lastAdvance = performance.now();
    playPracticeStep();
    render();
    return;
  }

  // ── Add-instrument wizard ─────────────────────────────────────────────────
  if (action === 'wizard-family') {
    const fams = state.wizard.families;
    const f = el.dataset.family;
    state.wizard.families = fams.includes(f) ? fams.filter(x => x !== f) : [...fams, f];
    render();
    return;
  }
  if (action === 'wizard-families-next') {
    state.wizard.queue = INSTRUMENT_FAMILIES.map(f => f.id).filter(f => state.wizard.families.includes(f));
    wizardNext();
    return;
  }
  if (action === 'wizard-skip') {
    setOnboarded();
    state.wizard = null;
    state.view = 'selector';
    history.replaceState(null, '', '#scales');
    render();
    return;
  }
  if (action === 'wizard-skip-step') { wizardNext(); return; }
  if (action === 'wizard-fl-create') {
    const fl = state.wizard.fl;
    const chart = getChart(fl.chartId) ?? chartsForFamily('flute')[0];
    if (!chart) return;
    const inst = instrumentFromChart(chart.id, fl.keyId ?? chart.keys[0].id, { name: fl.name.trim() });
    saveInstrument(inst);
    refreshInstruments();
    showToast(`${inst.name} added`);
    wizardNext();
    return;
  }
  if (action === 'wizard-pick-handpan') {
    const scale = SCALES.find(sc => sc.id === el.dataset.id);
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
    showToast(`${scale.name} added`);
    state.wizard.search = '';
    wizardNext();
    return;
  }
  if (action === 'wizard-oc-path') {
    state.wizard.oc.path = el.dataset.path || null;
    render();
    return;
  }
  if (action === 'wizard-oc-chambers') {
    state.wizard.oc.chambers = parseInt(el.dataset.n, 10);
    state.wizard.oc.windowStart = null;
    render();
    return;
  }
  if (action === 'wizard-oc-window') {
    state.wizard.oc.windowStart = parseInt(el.dataset.start, 10);
    render();
    return;
  }
  if (action === 'wizard-oc-create') {
    const oc = state.wizard.oc;
    const inst = oc.path === 'have' && oc.chartId !== 'custom' && getChart(oc.chartId)
      ? instrumentFromChart(oc.chartId, oc.keyId ?? getChart(oc.chartId).keys[0].id, { name: oc.name.trim() })
      : oc.path === 'have'
      ? createCustomOcarina({ name: oc.name.trim(), holeCount: oc.holeCount })
      : Object.assign(createScaleOcarina({
          scaleId: oc.scaleId, transpose: oc.transpose, includeGu: oc.includeGu,
          notes: wizardOcarinaPlan().notes, name: oc.name.trim(),
        }), { design: { scaleId: oc.scaleId, transpose: oc.transpose, includeGu: oc.includeGu, chambers: oc.chambers, windowStart: oc.windowStart, excluded: [] } });
    saveInstrument(inst);
    refreshInstruments();
    showToast(`${inst.name} added`);
    state.wizard.oc = newWizard(false).oc;
    wizardNext();
    return;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (action === 'auth-send-link') {
    const email = (document.getElementById('auth-email-input')?.value || '').trim();
    if (!email) return;
    state.authEmail = email;
    sendOtp(email).then(err => {
      if (err) { showToast(err); return; }
      state.authLinkSent = true;
      state.authCode = '';
      render();
      setTimeout(() => document.getElementById('auth-code-input')?.focus(), 0);
    });
    return;
  }

  if (action === 'auth-verify') {
    const code = (document.getElementById('auth-code-input')?.value || state.authCode).trim();
    if (code.length < 6) { showToast('Enter the code from the email'); return; }
    verifyOtp(state.authEmail, code).then(err => {
      if (err) { showToast('Invalid code — ' + err); return; }
      state.authLinkSent = false;
      state.authCode = '';
    });
    return;
  }

  if (action === 'auth-cancel') {
    state.authLinkSent = false;
    state.authCode = '';
    render();
    return;
  }

  if (action === 'auth-sync') {
    checkForUpdates();
    return;
  }

  if (action === 'auth-signout') {
    stopSyncPoll();
    signOut().then(() => { state.authLinkSent = false; render(); });
    return;
  }

  // ── Selector ──────────────────────────────────────────────────────────────
  if (action === 'filter-notes') {
    state.noteCountFilter = el.dataset.val;
    render();
    return;
  }

  if (action === 'select-scale') {
    const scale = SCALES.find(s => s.id === el.dataset.id);
    if (!scale) return;
    state.layout = createLayoutFromScale(scale);
    state.chords = findAllChords(state.layout);
    state.selectedChord = null;
    state.shellMode = 'both';
    state.chordFilter = { category: 'All', root: 'All' };
    state.view = 'editor';
    state.currentInstrumentId = null;
    history.pushState(null, '', stateToHash());
    render();
    return;
  }

  // ── Saved layouts ─────────────────────────────────────────────────────────
  if (action === 'save-layout') {
    if (state.layout.isCustom && !state.layout.savedId) {
      state.layout.savedId = 'c-' + Date.now();
    }
    const id = state.layout.isCustom ? state.layout.savedId : state.layout.id;
    const total = 1 + state.layout.top.slots.filter(s => s.note).length
                    + state.layout.bottom.slots.filter(s => s.note).length;
    saveLayout({
      id,
      name: state.layout.name,
      noteCount: total,
      layout: JSON.parse(JSON.stringify(state.layout)),
      savedAt: Date.now(),
    });
    state.savedLayouts = getSavedLayouts();
    scheduleSave();
    refreshInstruments();
    state.currentInstrumentId = handpanInstrumentId(id);
    showToast('Saved to My instruments');
    render();
    return;
  }

  if (action === 'load-saved') {
    const saved = state.savedLayouts.find(l => l.id === el.dataset.id);
    if (!saved) return;
    state.layout = saved.layout;
    state.chords = findAllChords(state.layout);
    state.selectedChord = null;
    state.shellMode = 'both';
    state.chordFilter = { category: 'All', root: 'All' };
    state.view = 'editor';
    state.currentInstrumentId = handpanInstrumentId(saved.id);
    touchInstrument(state.currentInstrumentId);
    render();
    return;
  }

  if (action === 'delete-saved') {
    deleteLayout(el.dataset.id);
    state.savedLayouts = getSavedLayouts();
    refreshInstruments();
    scheduleSave();
    render();
    return;
  }

  // ── Favorites ─────────────────────────────────────────────────────────────
  // ── Playlist picker ───────────────────────────────────────────────────────
  if (action === 'show-playlist-picker') {
    e.stopPropagation();
    const chordId = el.dataset.chordId;
    const favId = el.dataset.chordFavId;
    // Panel heart (matches the selected chord) preserves any voicing swap;
    // row hearts always use the canonical chord for that row.
    const chord = (state.selectedChord && state.selectedChord.id === chordId)
      ? state.selectedChord
      : state.chords.find(c => c.id === chordId);
    if (!chord) return;
    state.pickerChordFavId = favId;
    state.pickerChordObj = chord;
    state.pickerNewPlaylist = false;
    render();
    return;
  }

  if (action === 'update-playlist-entry') {
    if (!state.selectedChord || !state.sourcePlaylistId || !state.sourceEntryId) return;
    const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
    const newId = favIdForChord(layoutId, state.selectedChord, state.chords);
    const ok = updatePlaylistChordVoicing(state.sourcePlaylistId, state.sourceEntryId, {
      id: newId, notes: state.selectedChord.notes, noteCount: state.selectedChord.notes.length,
    });
    if (!ok) { showToast('That playlist entry no longer exists'); return; }
    state.sourceEntryId = newId;
    state.playlists = getPlaylists();
    state.favorites = getFavorites();
    scheduleSave();
    showToast('Saved to playlist');
    render();
    return;
  }

  if (action === 'close-playlist-picker') {
    if (e.target.closest('.modal')) return;
    state.pickerChordFavId = null;
    state.pickerChordObj = null;
    state.pickerNewPlaylist = false;
    render();
    return;
  }

  if (action === 'toggle-playlist-chord') {
    const playlistId = el.dataset.playlistId;
    const favId = state.pickerChordFavId;
    const chord = state.pickerChordObj;
    if (!chord || !favId) return;
    const pl = state.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    if (pl.chords.some(c => c.id === favId)) {
      removeChordFromPlaylist(playlistId, favId);
    } else {
      addChordToPlaylist(playlistId, playlistEntryFor(chord, favId));
    }
    state.playlists = getPlaylists();
    state.favorites = getFavorites();
    scheduleSave();
    render();
    return;
  }

  if (action === 'show-new-playlist-input') {
    state.pickerNewPlaylist = true;
    render();
    setTimeout(() => document.getElementById('new-playlist-input')?.focus(), 0);
    return;
  }

  if (action === 'confirm-new-playlist') {
    const input = document.getElementById('new-playlist-input');
    const name = (input?.value || '').trim();
    if (!name) return;
    const newId = addPlaylist(name);
    if (state.pickerChordObj && state.pickerChordFavId) {
      addChordToPlaylist(newId, playlistEntryFor(state.pickerChordObj, state.pickerChordFavId));
    }
    state.playlists = getPlaylists();
    state.pickerChordFavId = null;
    state.pickerChordObj = null;
    state.pickerNewPlaylist = false;
    scheduleSave();
    showToast('Playlist created');
    render();
    return;
  }

  // ── Playlist view ─────────────────────────────────────────────────────────
  if (action === 'open-playlist-chords') {
    const pl = state.playlists.find(p => p.id === el.dataset.id);
    if (!pl) return;
    if (pl.chords.length === 0) { showToast('No chords in playlist yet'); return; }
    if (pl.chords[0].instrumentId) {
      if (openPlaylistEntryOnInstrument(pl, pl.chords[0])) render();
      return;
    }
    if (!loadPlaylistChordAt(pl, 0)) { showToast('Scale not found'); return; }
    state.chordFilter = { category: 'All', root: 'All', playlist: pl.id };
    state.view = 'chords';
    history.pushState(null, '', stateToHash());
    render();
    return;
  }

  if (action === 'open-playlist') {
    stopAutoplay();
    state.activePlaylistId = el.dataset.id;
    state.view = 'playlist';
    render();
    return;
  }

  if (action === 'delete-playlist') {
    if (state.activePlaylistId === 'favorites') return;
    deletePlaylist(state.activePlaylistId);
    state.playlists = getPlaylists();
    state.view = 'home';
    state.activePlaylistId = null;
    history.pushState(null, '', location.pathname);
    scheduleSave();
    render();
    return;
  }

  if (action === 'move-chord-up') {
    const idx = parseInt(el.dataset.idx, 10);
    reorderChordInPlaylist(state.activePlaylistId, idx, idx - 1);
    state.playlists = getPlaylists();
    scheduleSave();
    render();
    return;
  }

  if (action === 'move-chord-down') {
    const idx = parseInt(el.dataset.idx, 10);
    reorderChordInPlaylist(state.activePlaylistId, idx, idx + 1);
    state.playlists = getPlaylists();
    scheduleSave();
    render();
    return;
  }

  if (action === 'remove-playlist-chord') {
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
  }

  if (action === 'open-playlist-chord') {
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
    history.pushState(null, '', stateToHash());
    render();
    return;
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  if (action === 'back-selector') {
    stopAutoplay();
    state.view = 'selector';
    state.layout = null;
    state.selectedChord = null;
    state.pendingSlot = null;
    state.sourcePlaylistId = null;
    state.sourceEntryId = null;
    state.currentInstrumentId = null;
    history.pushState(null, '', '#scales');
    render();
    return;
  }

  if (action === 'back-editor') {
    stopAutoplay();
    state.view = 'editor';
    state.selectedChord = null;
    state.sourcePlaylistId = null;
    state.sourceEntryId = null;
    history.replaceState(null, '', stateToHash());
    render();
    return;
  }

  // ── Pan rotation ──────────────────────────────────────────────────────────
  if (action === 'toggle-rotation') {
    state.ringRotated = !state.ringRotated;
    savePrefs();
    render();
    return;
  }

  if (action === 'toggle-flats') {
    state.useFlats = !state.useFlats;
    savePrefs();
    render();
    return;
  }

  if (action === 'toggle-solfege') {
    state.useSolfege = !state.useSolfege;
    savePrefs();
    render();
    return;
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  if (action === 'shell-mode') {
    state.shellMode = el.dataset.mode;
    render();
    return;
  }

  if (action === 'clone-layout') {
    state.currentInstrumentId = null;
    state.layout = {
      ...state.layout,
      isCustom: true,
      id: 'custom',
      name: state.layout.name + ' (Custom)',
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
  }

  if (action === 'go-chords') {
    state.chords = findAllChords(state.layout);
    state.selectedChord = null;
    state.chordFilter = { category: 'All', root: 'All', playlist: 'All' };
    state.view = 'chords';
    history.pushState(null, '', stateToHash());
    render();
    return;
  }

  if (action === 'adjust-capacity') {
    const shell = el.dataset.shell;
    const delta = parseInt(el.dataset.delta);
    const target = state.layout[shell];
    const newCap = Math.max(0, Math.min(12, target.capacity + delta));
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
  }

  // Note picker: cancel or overlay background click
  if (action === 'close-picker') {
    // Ignore clicks that landed inside the modal but not on the Cancel button
    if (el.classList.contains('modal-overlay') && e.target.closest('.modal')) return;
    state.pendingSlot = null;
    render();
    return;
  }

  // Note picker: pick a note
  if (action === 'pick-note') {
    const note = el.dataset.note;
    const slot = state.pendingSlot;
    if (!slot) return;

    if (slot.shell === 'ding') {
      state.layout.top.ding = note;
    } else if (slot.shell === 'top') {
      while (state.layout.top.slots.length <= slot.index) {
        state.layout.top.slots.push({ note: null });
      }
      state.layout.top.slots[slot.index].note = note;
    } else {
      while (state.layout.bottom.slots.length <= slot.index) {
        state.layout.bottom.slots.push({ note: null });
      }
      state.layout.bottom.slots[slot.index].note = note;
    }

    state.pendingSlot = null;
    state.chords = findAllChords(state.layout);
    initAudio();
    playNote(note);
    render();
    return;
  }

  // ── Chord explorer ─────────────────────────────────────────────────────────
  if (action === 'toggle-note-count') {
    const count = el.dataset.count;
    if (state.chordCountSet.has(count)) state.chordCountSet.delete(count);
    else state.chordCountSet.add(count);
    render();
    return;
  }

  if (action === 'filter-root') {
    state.chordFilter.root = el.dataset.root;
    render();
    return;
  }

  if (action === 'select-chord') {
    const chord = state.chords.find(c => c.id === el.dataset.id);
    if (!chord) return;
    stopAutoplay();

    // If the chord list is filtered to a playlist, clicking a row is the
    // same as opening that entry — show its saved voicing (it may differ
    // from canonical) and track it so a swap can be saved back.
    const pl = state.chordFilter.playlist !== 'All' ? state.playlists.find(p => p.id === state.chordFilter.playlist) : null;
    const entry = pl ? pl.chords.find(c => c.chordId === chord.id) : null;
    if (pl && entry) {
      state.selectedChord = Array.isArray(entry.notes) ? { ...chord, notes: entry.notes } : chord;
      state.sourcePlaylistId = pl.id;
      state.sourceEntryId = entry.id;
    } else {
      state.selectedChord = chord;
      state.sourcePlaylistId = null;
      state.sourceEntryId = null;
    }

    history.replaceState(null, '', stateToHash());
    // Preserve chord list scroll position across render
    const chordList = document.querySelector('.chord-list');
    const savedScroll = chordList?.scrollTop ?? 0;
    render();
    const newChordList = document.querySelector('.chord-list');
    if (newChordList) newChordList.scrollTop = savedScroll;
    // Arpeggiate then play together; show playing animation at the "together" moment
    initAudio();
    playChord(state.selectedChord.notes,
      note => updatePanPlaying([note]),
      notes => updatePanPlaying(notes)
    );
    return;
  }

  if (action === 'toggle-autoplay') {
    const pl = state.playlists.find(p => p.id === state.chordFilter.playlist);
    if (!pl) return;
    if (state.autoplayOn) { stopAutoplay(); render(); }
    else startAutoplay(pl);
    return;
  }

  if (action === 'play-chord') {
    if (!state.selectedChord) return;
    initAudio();
    playChord(state.selectedChord.notes,
      note => updatePanPlaying([note]),
      notes => updatePanPlaying(notes)
    );
    return;
  }

  if (action === 'play-scale') {
    const allNotes = getAllNotes(state.layout);
    initAudio();
    playScale(allNotes, note => updatePanPlaying([note]));
    return;
  }

  // ── Discover mode ────────────────────────────────────────────────────────
  if (action === 'toggle-discover-mode') {
    stopAutoplay();
    state.discoverMode = !state.discoverMode;
    state.discoverNotes = [];
    state.selectedChord = null;
    state.sourcePlaylistId = null;
    state.sourceEntryId = null;
    render();
    return;
  }

  if (action === 'discover-clear') {
    state.discoverNotes = [];
    render();
    return;
  }

  if (action === 'discover-bookmark') {
    const idx = parseInt(el.dataset.matchIdx, 10);
    const chord = identifyChord(state.discoverNotes)[idx];
    if (!chord) return;
    const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
    state.pickerChordFavId = favIdForChord(layoutId, chord, state.chords);
    state.pickerChordObj = chord;
    state.pickerNewPlaylist = false;
    render();
    return;
  }

  if (action === 'discover-bookmark-custom') {
    if (state.discoverNotes.length < 2) return;
    const notes = [...state.discoverNotes];
    // A shared, note-less id — the favId suffix (added below since no
    // canonical "custom" chord type exists) is what disambiguates combos.
    const chord = {
      id: 'custom', rootName: getNoteName(notes[0]),
      type: { name: 'Custom', category: 'Custom' }, notes, noteCount: notes.length,
    };
    const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
    state.pickerChordFavId = favIdForChord(layoutId, chord, state.chords);
    state.pickerChordObj = chord;
    state.pickerNewPlaylist = false;
    render();
    return;
  }

  if (action === 'discover-play') {
    const idx = parseInt(el.dataset.matchIdx, 10);
    const chord = identifyChord(state.discoverNotes)[idx];
    if (!chord) return;
    initAudio();
    playChord(chord.notes, note => updatePanPlaying([note]), notes => updatePanPlaying(notes));
    return;
  }

  if (action === 'discover-play-custom') {
    if (state.discoverNotes.length < 2) return;
    initAudio();
    playChord(state.discoverNotes, note => updatePanPlaying([note]), notes => updatePanPlaying(notes));
    return;
  }

  if (action === 'copy-url') {
    const url = location.origin + location.pathname + stateToHash();
    navigator.clipboard.writeText(url).then(() => showToast('URL copied!'));
    return;
  }
});

// ── Pan note clicks (Discover mode note-picking + voicing swap) ────────────────
// Pan circles are plain SVG, not [data-action] elements, so they get their own
// delegation rather than going through the action router above.
document.addEventListener('click', e => {
  const noteEl = e.target.closest('.pan-note');
  if (!noteEl || state.view !== 'chords') return;
  const note = noteEl.dataset.note;
  if (!note) return; // empty slot

  if (state.discoverMode) {
    const idx = state.discoverNotes.indexOf(note);
    if (idx >= 0) state.discoverNotes.splice(idx, 1);
    else state.discoverNotes.push(note);
    render();
    initAudio();
    playNote(note);
    return;
  }

  if (noteEl.classList.contains('alt-highlight') && state.selectedChord) {
    stopAutoplay();
    state.selectedChord = swapChordNoteVoicing(state.selectedChord, note);
    history.replaceState(null, '', stateToHash());
    render();
    initAudio();
    playNote(note);
  }
});

// ── Change delegation (selects) ───────────────────────────────────────────────
document.addEventListener('change', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action } = el.dataset;
  if (action === 'select-playlist-filter') {
    if (el.value === '__edit__') {
      stopAutoplay();
      state.activePlaylistId = state.chordFilter.playlist;
      state.view = 'playlist';
    } else {
      if (state.autoplayOn && el.value !== state.autoplayPlaylistId) stopAutoplay();
      state.chordFilter.playlist = el.value;
    }
    render();
  }
  if (action === 'filter-category') { state.chordFilter.category = el.value; render(); }
  if (action === 'oc-scale-filter') { state.oc.scaleFilter = el.value; state.oc.voicings = {}; render(); }
  if (action === 'b-input' || action === 'b-shrink' || (action === 'b-window' && el.tagName === 'INPUT')
      || action === 'b-clay' || action === 'b-from' || action === 's-finger'
      || (action === 'b-design' && (el.tagName === 'SELECT' || el.tagName === 'INPUT'))) {
    let inst = currentInstrument();
    if (!inst) return;
    const num = parseFloat(el.value);
    if (action === 'b-input') setReading(inst, el.dataset.path, num > 0 ? num : null);
    if (action === 'b-shrink' && num >= 0) inst.build.shrinkPct = num;
    if (action === 'b-window') {
      const ci = parseInt(el.dataset.ci, 10);
      const per = inst.build.perChamber[ci] = inst.build.perChamber[ci] ?? {};
      if (num > 0) per.window = { ...chamberBuild(inst, ci).window, [el.dataset.key]: num };
    }
    if (action === 'b-clay') {
      if (el.value === '__new__') {
        const name = (prompt('Name of the clay body') || '').trim();
        if (!name) { render(); return; }
        const pct = parseFloat(prompt('Its shrinkage in %, if known', '11')) || 11;
        const clay = { id: 'clay-' + Date.now().toString(36), name, shrinkPct: pct, builds: 0 };
        saveClayBodies([...getClayBodies(), clay]);
        inst.build.clayBody = clay.id;
        inst.build.shrinkPct = pct;
      } else {
        const clay = getClayBodies().find(c => c.id === el.value);
        inst.build.clayBody = el.value;
        if (clay) inst.build.shrinkPct = clay.shrinkPct;
      }
    }
    if (action === 'b-from') {
      const src = getInstrument(el.value);
      inst.build.fromId = src ? src.id : null;
      if (src) {
        inst.design = { ...(src.design ?? { scaleId: src.scaleId, transpose: src.transpose, includeGu: src.includeGu }) };
        applyDesign(inst);
        inst.build.clayBody = src.build.clayBody;
        const clay = getClayBodies().find(c => c.id === src.build.clayBody);
        inst.build.shrinkPct = clay ? clay.shrinkPct : src.build.shrinkPct;
        inst.build.perChamber = (src.build.perChamber ?? []).map(p => ({ window: p?.window, testHoleMm: p?.readings?.leather?.d }));
      }
    }
    if (action === 's-finger') {
      const setup = inst.setup ?? { holes: defaultCustomHoles(inst.holeCount), f0: null, singles: [] };
      const h = setup.holes[parseInt(el.dataset.index, 10)];
      h.finger = el.value;
      h.side = el.value.endsWith('T') ? 'bottom' : 'top';
      inst.setup = setup;
    }
    if (action === 'b-design') {
      inst.design = inst.design ?? { scaleId: inst.scaleId, transpose: inst.transpose, includeGu: inst.includeGu };
      const key = el.dataset.key;
      if (key === 'scaleId') Object.assign(inst.design, { scaleId: el.value, chambers: null, windowStart: null, excluded: [] });
      if (key === 'transpose') Object.assign(inst.design, { transpose: parseInt(el.value, 10), windowStart: null, excluded: [] });
      if (key === 'includeGu') Object.assign(inst.design, { includeGu: el.checked, chambers: null, windowStart: null, excluded: [] });
      applyDesign(inst);
      if (!inst.name || inst.name.endsWith(' ocarina')) inst.name = `${SCALES.find(sc => sc.id === inst.scaleId).name} ocarina`;
    }
    saveInstrument(inst);
    refreshInstruments();
    render();
  }

  if (action === 'oc-category') { state.oc.category = el.value; render(); }
  if (action === 'oc-playlist') { state.oc.playlistId = el.value; state.oc.expanded = null; render(); }
  if (action === 'wizard-chart') {
    const t = el.dataset.fam === 'oc' ? state.wizard.oc : state.wizard.fl;
    t.chartId = el.value; t.keyId = null; render();
  }
  if (action === 'wizard-key') {
    (el.dataset.fam === 'oc' ? state.wizard.oc : state.wizard.fl).keyId = el.value;
  }
  if (action === 'wizard-oc-holes') { state.wizard.oc.holeCount = parseInt(el.value, 10); }
  if (action === 'wizard-oc-scale') {
    Object.assign(state.wizard.oc, { scaleId: el.value, chambers: null, windowStart: null });
    render();
  }
  if (action === 'wizard-oc-transpose') {
    Object.assign(state.wizard.oc, { transpose: parseInt(el.value, 10), windowStart: null });
    render();
  }
  if (action === 'wizard-oc-gu') {
    Object.assign(state.wizard.oc, { includeGu: el.checked, chambers: null, windowStart: null });
    render();
  }
  if (action === 'set-autoplay-seconds') {
    state.autoplaySeconds = parseInt(el.value, 10);
    savePrefs();
    if (state.autoplayOn && _autoplayTimer) {
      clearInterval(_autoplayTimer);
      _autoplayTimer = setInterval(advanceAutoplay, state.autoplaySeconds * 1000);
    }
  }
});

// ── Input delegation ──────────────────────────────────────────────────────────
document.addEventListener('input', e => {
  if (e.target.id === 'scale-search-input') {
    state.scaleSearch = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const input = document.getElementById('scale-search-input');
    if (input) { input.focus(); input.setSelectionRange(pos, pos); }
    return;
  }
  if (e.target.id === 'wizard-search-input' && state.wizard) {
    state.wizard.search = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const input = document.getElementById('wizard-search-input');
    if (input) { input.focus(); input.setSelectionRange(pos, pos); }
    return;
  }
  if (e.target.id === 'wizard-fl-name' && state.wizard) {
    state.wizard.fl.name = e.target.value;
    return;
  }
  if (e.target.id === 'wizard-oc-name' && state.wizard) {
    state.wizard.oc.name = e.target.value;
    return;
  }
  if (e.target.id === 'custom-name-input' && state.layout) {
    state.layout.name = e.target.value;
  }
  if (e.target.id === 'playlist-name-input' && state.activePlaylistId) {
    renamePlaylist(state.activePlaylistId, e.target.value);
    state.playlists = getPlaylists();
    scheduleSave();
  }
  if (e.target.id === 'auth-email-input') {
    state.authEmail = e.target.value;
  }
  if (e.target.id === 'auth-code-input') {
    state.authCode = e.target.value.replace(/\D/g, '').slice(0, 8);
    e.target.value = state.authCode;
    if (state.authCode.length === 8) {
      document.querySelector('[data-action="auth-verify"]')?.click();
    }
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'new-playlist-input') {
    document.querySelector('[data-action="confirm-new-playlist"]')?.click();
  }
  if (e.key === 'Escape' && state.pickerChordFavId) {
    state.pickerChordFavId = null;
    state.pickerChordObj = null;
    state.pickerNewPlaylist = false;
    render();
  }
});

// ── Browser back/forward ──────────────────────────────────────────────────────
window.addEventListener('popstate', () => {
  Object.assign(state, {
    view: 'home', layout: null, selectedChord: null,
    pendingSlot: null, chords: [], shellMode: 'both',
    chordFilter: { category: 'All', root: 'All', playlist: 'All' },
    currentInstrumentId: null, wizard: null,
  });
  refreshInstruments();
  loadFromHash();
  render();
});
