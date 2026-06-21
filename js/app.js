import {
  SCALES, CHORD_TYPES, CHORD_CATEGORIES, createLayoutFromScale,
  getAllNotes, NOTE_NAMES, notePC, getNoteName, noteToMidi, displayNote,
} from './data.js';
import {
  getSavedLayouts, saveLayout, deleteLayout,
  getFavorites, toggleFavorite, isFavorite,
} from './storage.js';
import { findAllChords, getRelatedChords } from './chords.js';
import { initAudio, playNote, playChord, playScale } from './audio.js';
import { renderPan, PAN_SVG_ID, updatePanHighlight, updatePanShellMode, updatePanPlaying } from './pan.js';

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  view: 'selector',        // 'selector' | 'editor' | 'chords'
  layout: null,            // current Layout object
  shellMode: 'both',       // 'top' | 'bottom' | 'both'
  ringRotated: false,      // false = standard; true = rotated half-slot
  noteCountFilter: 'all',     // 'all' | '9' | '10' | '11+'
  scaleSearch: '',            // filter text for scale selector
  selectedChord: null,        // ChordResult or null
  chords: [],                 // computed from layout
  chordFilter: { category: 'All', root: 'All' },
  useFlats: false,           // false = sharp (C#, F#, G#…); true = flat (Db, Gb, Ab…)
  savedLayouts: getSavedLayouts(),
  favorites: getFavorites(),
  chordCountFilter: 'simple', // 'simple' (≤3 notes) | 'all'
  pendingSlot: null,       // { shell: 'top'|'bottom'|'ding', index: number }
};

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  if (state.view === 'selector') app.innerHTML = viewSelector();
  else if (state.view === 'editor') app.innerHTML = viewEditor();
  else if (state.view === 'chords') app.innerHTML = viewChords();
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

  const savedSection = savedLayouts.length === 0 ? '' : `
    <div class="pwa-section">
      <div class="pwa-section-title">My Layouts</div>
      <div class="pwa-scroll">
        ${savedLayouts.map(l => `
          <div class="saved-card" data-action="load-saved" data-id="${escHtml(l.id)}">
            <div class="saved-card-name">${escHtml(l.name)}</div>
            <div class="saved-card-meta">${l.noteCount} notes</div>
            <button class="saved-del" data-action="delete-saved" data-id="${escHtml(l.id)}" title="Remove">×</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const favsSection = favorites.length === 0 ? '' : `
    <div class="pwa-section">
      <div class="pwa-section-title">My Chords</div>
      <div class="pwa-scroll">
        ${favorites.map(f => `
          <div class="fav-chip" data-action="open-favorite" data-id="${escHtml(f.id)}">
            <div class="fav-chip-chord">${escHtml(displayNote(f.rootName, useFlats))} ${escHtml(f.typeName)}</div>
            <div class="fav-chip-scale">${escHtml(f.scaleName)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  return `
    <div class="app-header">
      <div class="app-title">Handpan Chords</div>
    </div>
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
        <a data-action="back-selector">← Scales</a>
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
            ⟳ Rotate
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
              ${isSaved ? '✓ Saved' : '⬇ Save'}
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

        <button class="btn btn-primary" data-action="go-chords" style="width:100%;margin-top:4px">
          Find Chords →
        </button>
      </div>
    </div>

    ${state.pendingSlot ? renderNotePicker() : ''}
  `;
}

function renderNotePicker() {
  const allNotes = getAllNotes(state.layout);
  const usedPCs = new Set(allNotes.map(notePC));
  const octaves = [2, 3, 4, 5];

  const rows = octaves.map(oct => {
    const cols = NOTE_NAMES.map((name, i) => {
      const noteStr = `${name}${oct}`;
      const inUse = usedPCs.has(i); // NOTE_NAMES index = pitch class
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
      <div class="modal" onclick="event.stopPropagation()">
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

  // Root options: NOTE_NAMES[i] is at PC i — filter by which PCs have chords.
  const ROOT_ORDER = NOTE_NAMES;
  const usedRootPCs = new Set(chords.map(c => notePC(c.rootNote)));
  const roots = ['All', ...ROOT_ORDER.filter((_, i) => usedRootPCs.has(i))];

  // Apply filters — compare root by PC to handle G# ↔ Ab equivalence.
  const filtered = chords.filter(c => {
    if (state.chordCountFilter === 'simple' && c.noteCount > 3) return false;
    if (chordFilter.category !== 'All' && c.type.category !== chordFilter.category) return false;
    if (chordFilter.root !== 'All') {
      const filterPC = ROOT_ORDER.indexOf(chordFilter.root);
      if (notePC(c.rootNote) !== filterPC) return false;
    }
    return true;
  }).sort((a, b) => {
    const rA = notePC(a.rootNote), rB = notePC(b.rootNote);
    return rA !== rB ? rA - rB : b.noteCount - a.noteCount;
  });

  const highlightNotes = selectedChord ? selectedChord.notes : [];
  const panSvg = renderPan(layout, { shellMode: 'both', highlightNotes, rotated: state.ringRotated, useFlats: uf });

  let relatedHtml = '';
  if (selectedChord) {
    const { sameType, sharedNotes } = getRelatedChords(selectedChord, chords);
    const sameTypeChips = sameType.map(c =>
      `<span class="related-chip" data-action="select-chord" data-id="${c.id}">
        ${displayNote(c.rootName, uf)} ${c.type.name}
      </span>`
    ).join('');
    const sharedChips = sharedNotes.slice(0, 10).map(c =>
      `<span class="related-chip" data-action="select-chord" data-id="${c.id}">
        ${displayNote(c.rootName, uf)} ${c.type.name}
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
        <a data-action="back-selector">← Scales</a>
        <span>/</span>
        <a data-action="back-editor">← ${escHtml(layout.name)}</a>
        <span>/</span>
        <span>Chords</span>
      </div>
      <div style="display:flex;gap:6px;margin-left:auto;flex-shrink:0">
        <button class="btn btn-secondary btn-sm" data-action="toggle-rotation"
          title="Rotate the ring so two lowest notes face you instead of one">
          ${state.ringRotated ? '⟳ Standard' : '⟳ Rotate'}
        </button>
        <button class="btn btn-secondary btn-sm" data-action="copy-url">
          Copy URL
        </button>
      </div>
    </div>

    <div class="explorer-layout">
      <div class="chord-list">
        <div class="chord-list-header">
          <div class="pills" style="margin-bottom:8px">
            <button class="pill ${state.chordCountFilter === 'simple' ? 'active' : ''}"
              data-action="filter-chord-count" data-val="simple">2–3 notes</button>
            <button class="pill ${state.chordCountFilter === 'all' ? 'active' : ''}"
              data-action="filter-chord-count" data-val="all">All</button>
            <button class="pill ${uf ? 'active' : ''}"
              data-action="toggle-flats" title="Switch between sharp (C#) and flat (Db) notation">
              ♭ Flats
            </button>
          </div>
          <div class="pills" style="margin-bottom:8px">
            ${CHORD_CATEGORIES.map(cat => `
              <button class="pill ${chordFilter.category === cat ? 'active' : ''}"
                data-action="filter-category" data-cat="${cat}">${cat}</button>
            `).join('')}
          </div>
          <div class="flex-row" style="margin-top:8px">
            <select class="select-input" data-action="filter-root">
              ${roots.map(r => `<option value="${r}" ${chordFilter.root === r ? 'selected' : ''}>
                ${r === 'All' ? 'All' : displayNote(r, uf)}
              </option>`).join('')}
            </select>
            <span class="hint">${filtered.length} chord${filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        ${(() => {
          const layoutId = layout.isCustom ? (layout.savedId || layout.id) : layout.id;
          const favIds = new Set(state.favorites.map(f => f.id));
          return filtered.length === 0
            ? '<div class="empty-state">No chords match these filters</div>'
            : filtered.map(c => {
              const favId = `${layoutId}-${c.id}`;
              return `<div class="chord-item ${selectedChord?.id === c.id ? 'selected' : ''}"
                data-action="select-chord" data-id="${c.id}">
                <div>
                  <div class="chord-item-name">${displayNote(c.rootName, uf)} ${c.type.name}</div>
                  <div class="chord-item-type">${c.type.category}</div>
                </div>
                <div class="chord-item-right">
                  <button class="fav-btn ${favIds.has(favId) ? 'active' : ''}"
                    data-action="toggle-favorite" data-chord-id="${c.id}" title="Save to My Chords">♥</button>
                  <span class="chord-count">${c.noteCount}</span>
                </div>
              </div>`;
            }).join('');
        })()}
      </div>

      <div>
        <div class="pan-wrap" style="margin-bottom:16px">
          ${panSvg}
        </div>
        <div class="chord-panel">
          ${selectedChord ? `
            <div class="chord-panel-title">${displayNote(selectedChord.rootName, uf)} ${selectedChord.type.name}</div>
            <div class="chord-panel-sub">
              ${selectedChord.type.category} · ${selectedChord.noteCount} notes:
              ${selectedChord.notes.map(n => displayNote(n, uf)).join(', ')}
            </div>
            <div class="chord-actions">
              <button class="btn btn-primary" data-action="play-chord">▶ Play Chord</button>
              <button class="btn btn-secondary" data-action="play-scale">▶ Play Scale</button>
            </div>
            ${relatedHtml}
          ` : `
            <div class="empty-state">
              Select a chord from the list<br>to see and hear it on the pan
            </div>
            <div class="chord-actions" style="margin-top:16px">
              <button class="btn btn-secondary" data-action="play-scale">▶ Play Scale</button>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
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

  if (hash.startsWith('#scale=')) {
    const raw = hash.slice(7);
    const [scaleId, ...rest] = raw.split('&chord=');
    chordId = rest[0] || null;
    const scale = SCALES.find(s => s.id === scaleId);
    if (scale) {
      state.layout = createLayoutFromScale(scale);
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

// ── Bootstrap ────────────────────────────────────────────────────────────────
loadFromHash();
render();

// Pre-warm AudioContext on the very first user touch so that by the time
// the user taps Play, the context is already running and there is no
// resume-induced delay in the audio output.
document.addEventListener('pointerdown', () => initAudio(), { once: true });

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
    showToast('Saved to My Layouts');
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
    render();
    return;
  }

  if (action === 'delete-saved') {
    deleteLayout(el.dataset.id);
    state.savedLayouts = getSavedLayouts();
    render();
    return;
  }

  // ── Favorites ─────────────────────────────────────────────────────────────
  if (action === 'toggle-favorite') {
    const chordId = el.dataset.chordId;
    const chord = state.chords.find(c => c.id === chordId);
    if (!chord || !state.layout) return;
    const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
    const favId = `${layoutId}-${chord.id}`;
    const added = toggleFavorite({
      id: favId,
      layoutId,
      layoutData: state.layout.isCustom ? JSON.parse(JSON.stringify(state.layout)) : null,
      scaleName: state.layout.name,
      chordId: chord.id,
      rootName: chord.rootName,
      typeName: chord.type.name,
      category: chord.type.category,
      notes: chord.notes,
      noteCount: chord.noteCount,
    });
    state.favorites = getFavorites();
    showToast(added ? '♥ Added to My Chords' : 'Removed from My Chords');
    render();
    return;
  }

  if (action === 'open-favorite') {
    const fav = state.favorites.find(f => f.id === el.dataset.id);
    if (!fav) return;
    if (fav.layoutData) {
      state.layout = fav.layoutData;
    } else {
      const saved = state.savedLayouts.find(l => l.id === fav.layoutId);
      if (saved) {
        state.layout = saved.layout;
      } else {
        const scale = SCALES.find(s => s.id === fav.layoutId);
        if (!scale) { showToast('Scale not found'); return; }
        state.layout = createLayoutFromScale(scale);
      }
    }
    state.chords = findAllChords(state.layout);
    state.selectedChord = state.chords.find(c => c.id === fav.chordId) || null;
    state.shellMode = 'both';
    state.chordFilter = { category: 'All', root: 'All' };
    state.view = 'chords';
    history.pushState(null, '', stateToHash());
    render();
    return;
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  if (action === 'back-selector') {
    state.view = 'selector';
    state.layout = null;
    state.selectedChord = null;
    state.pendingSlot = null;
    history.pushState(null, '', location.pathname);
    render();
    return;
  }

  if (action === 'back-editor') {
    state.view = 'editor';
    state.selectedChord = null;
    history.replaceState(null, '', stateToHash());
    render();
    return;
  }

  // ── Pan rotation ──────────────────────────────────────────────────────────
  if (action === 'toggle-rotation') {
    state.ringRotated = !state.ringRotated;
    render();
    return;
  }

  if (action === 'toggle-flats') {
    state.useFlats = !state.useFlats;
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
    state.chordFilter = { category: 'All', root: 'All' };
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

  // Note picker: cancel
  if (action === 'close-picker') {
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
  if (action === 'filter-category') {
    state.chordFilter.category = el.dataset.cat;
    render();
    return;
  }

  if (action === 'select-chord') {
    const chord = state.chords.find(c => c.id === el.dataset.id);
    if (!chord) return;
    state.selectedChord = chord;
    history.replaceState(null, '', stateToHash());
    // Preserve chord list scroll position across render
    const chordList = document.querySelector('.chord-list');
    const savedScroll = chordList?.scrollTop ?? 0;
    render();
    const newChordList = document.querySelector('.chord-list');
    if (newChordList) newChordList.scrollTop = savedScroll;
    // Arpeggiate then play together; show playing animation at the "together" moment
    initAudio();
    playChord(chord.notes,
      note => updatePanPlaying([note]),
      notes => updatePanPlaying(notes)
    );
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

  if (action === 'filter-chord-count') {
    state.chordCountFilter = el.dataset.val;
    render();
    return;
  }

  if (action === 'copy-url') {
    const url = location.origin + location.pathname + stateToHash();
    navigator.clipboard.writeText(url).then(() => showToast('URL copied!'));
    return;
  }
});

// ── Change delegation (select dropdowns) ─────────────────────────────────────
document.addEventListener('change', e => {
  if (e.target.dataset.action === 'filter-root') {
    state.chordFilter.root = e.target.value;
    render();
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
  if (e.target.id === 'custom-name-input' && state.layout) {
    state.layout.name = e.target.value;
  }
});

// ── Browser back/forward ──────────────────────────────────────────────────────
window.addEventListener('popstate', () => {
  Object.assign(state, {
    view: 'selector', layout: null, selectedChord: null,
    pendingSlot: null, chords: [], shellMode: 'both',
    chordFilter: { category: 'All', root: 'All' },
  });
  loadFromHash();
  render();
});
