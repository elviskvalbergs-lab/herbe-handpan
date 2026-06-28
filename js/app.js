import {
  SCALES, CHORD_TYPES, CHORD_CATEGORIES, createLayoutFromScale,
  getAllNotes, NOTE_NAMES, notePC, getNoteName, noteToMidi, displayNote,
} from './data.js';
import {
  getSavedLayouts, saveLayout, deleteLayout,
  getFavorites, isFavorite,
  getPlaylists, addPlaylist, renamePlaylist, deletePlaylist,
  addChordToPlaylist, removeChordFromPlaylist, reorderChordInPlaylist,
  isChordInAnyPlaylist,
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
};

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  if (state.view === 'selector') app.innerHTML = viewSelector();
  else if (state.view === 'editor') app.innerHTML = viewEditor();
  else if (state.view === 'chords') app.innerHTML = viewChords();
  else if (state.view === 'playlist') app.innerHTML = viewPlaylist();
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

  const authBar = isLoggedIn()
    ? `<div class="auth-bar">
         <span class="hint auth-user">${escHtml(getUserEmail())}</span>
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
           <button class="btn btn-secondary btn-sm" data-action="auth-cancel">✕</button>
         </div>
       </div>`
    : `<div class="auth-bar">
         <input class="auth-email-input" id="auth-email-input" type="email"
           placeholder="Email to sync playlists across devices" value="${escHtml(state.authEmail)}">
         <button class="btn btn-secondary btn-sm" data-action="auth-send-link">Sync ↑</button>
       </div>`;

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

  const favsSection = state.playlists.length === 0 ? '' : `
    <div class="pwa-section">
      <div class="pwa-section-title">My Playlists</div>
      <div class="pwa-scroll">
        ${state.playlists.map(pl => `
          <div class="playlist-card" data-action="open-playlist-chords" data-id="${escHtml(pl.id)}">
            <div class="playlist-card-name">${escHtml(pl.name)}</div>
            <div class="playlist-card-meta">${pl.chords.length} chord${pl.chords.length !== 1 ? 's' : ''}</div>
            <div class="playlist-card-edit" data-action="open-playlist" data-id="${escHtml(pl.id)}" title="Edit playlist">✎</div>
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
  const playlistChordIds = chordFilter.playlist !== 'All'
    ? new Set((state.playlists.find(p => p.id === chordFilter.playlist)?.chords ?? []).map(c => c.id))
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
    if (playlistChordIds !== null) {
      const favId = `${layoutId}-${c.id}`;
      if (!playlistChordIds.has(favId)) return false;
    }
    return true;
  });
  // Preserve playlist order when a playlist filter is active
  if (chordFilter.playlist !== 'All') {
    const pl = state.playlists.find(p => p.id === chordFilter.playlist);
    if (pl) {
      const orderMap = new Map(pl.chords.map((c, i) => [c.id, i]));
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

  const selectedFavId = selectedChord ? `${layoutId}-${selectedChord.id}` : null;
  const selectedInAny = selectedFavId ? isChordInAnyPlaylist(selectedFavId) : false;

  const highlightNotes = selectedChord ? selectedChord.notes : [];
  const chordPCs = selectedChord ? new Set(selectedChord.notes.map(n => notePC(n))) : new Set();
  const altHighlightNotes = selectedChord
    ? getAllNotes(layout).filter(n => chordPCs.has(notePC(n)) && !selectedChord.notes.includes(n))
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
        <a data-action="back-selector">← Scales</a>
        <span>/</span>
        <a data-action="back-editor">← ${escHtml(layout.name)}</a>
        <span>/</span>
        <span>Chords</span>
      </div>
      <div style="display:flex;gap:6px;margin-left:auto;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn btn-secondary btn-sm" data-action="toggle-rotation"
          title="Rotate the ring so two lowest notes face you instead of one">
          ${state.ringRotated ? '⟳ Standard' : '⟳ Rotate'}
        </button>
        <button class="btn ${uf ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="toggle-flats"
          title="Switch between sharp (C#) and flat (Db) notation">♭ Flats</button>
        <button class="btn ${us ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="toggle-solfege"
          title="Switch between letter names (C, D) and solfège (Do, Re)">Do-Re-Mi</button>
        <button class="btn btn-secondary btn-sm" data-action="copy-url">Copy URL</button>
      </div>
    </div>

    <div class="explorer-layout">
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
              ${chordFilter.playlist !== 'All' ? `<option value="__edit__">✎ Edit playlist</option>` : ''}
            </select>
          </div>
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
              const inAny = isChordInAnyPlaylist(favId);
              return `<div class="chord-item ${selectedChord?.id === c.id ? 'selected' : ''}"
                data-action="select-chord" data-id="${c.id}">
                <div>
                  <div class="chord-item-name">${displayNote(c.rootName, uf, us)} ${c.type.name}</div>
                  <div class="chord-item-type">${c.type.category}</div>
                </div>
                <div class="chord-item-right">
                  <button class="fav-btn ${inAny ? 'active' : ''}"
                    data-action="show-playlist-picker" data-chord-id="${c.id}" data-chord-fav-id="${escHtml(favId)}" title="Add to playlist">♥</button>
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
                data-chord-fav-id="${escHtml(selectedFavId)}" title="Add to playlist">♥</button>
              <button class="btn btn-primary btn-sm" data-action="play-chord">▶ Chord</button>
              <button class="btn btn-secondary btn-sm" data-action="play-scale">▶ Scale</button>
            </div>
          </div>
          ${relatedHtml}
        ` : `
          <div class="chord-panel-empty">
            <span class="hint">Select a chord to see it on the pan</span>
            <button class="btn btn-secondary btn-sm" data-action="play-scale">▶ Scale</button>
          </div>
        `}
      </div>

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
            <span class="picker-check">${inPl ? '✓' : ''}</span>
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
               <span class="picker-check">+</span>
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
        <a data-action="back-selector">← Scales</a>
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
            Use ♥ in the chord explorer to add chords here.</div>`
        : pl.chords.map((chord, idx) => `
          <div class="playlist-item">
            <div class="playlist-item-reorder">
              <button class="btn-icon" data-action="move-chord-up" data-idx="${idx}"
                ${idx === 0 ? 'disabled' : ''}>↑</button>
              <button class="btn-icon" data-action="move-chord-down" data-idx="${idx}"
                ${idx === pl.chords.length - 1 ? 'disabled' : ''}>↓</button>
            </div>
            <div class="playlist-item-info" data-action="open-playlist-chord" data-idx="${idx}">
              <div class="playlist-item-name">${escHtml(displayNote(chord.rootName, uf, us))} ${escHtml(chord.typeName)}</div>
              <div class="playlist-item-scale">${escHtml(chord.scaleName)}</div>
              <div class="playlist-item-notes hint">${chord.notes.map(n => displayNote(n, uf, us)).join(' · ')}</div>
            </div>
            <button class="playlist-item-remove" data-action="remove-playlist-chord" data-idx="${idx}">×</button>
          </div>
        `).join('')
      }
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

// ── Preferences (persist across sessions) ────────────────────────────────────
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('hp-prefs') || '{}');
    if (typeof p.ringRotated === 'boolean') state.ringRotated = p.ringRotated;
    if (typeof p.useFlats === 'boolean') state.useFlats = p.useFlats;
    if (typeof p.useSolfege === 'boolean') state.useSolfege = p.useSolfege;
  } catch {}
}

function savePrefs() {
  localStorage.setItem('hp-prefs', JSON.stringify({
    ringRotated: state.ringRotated,
    useFlats: state.useFlats,
    useSolfege: state.useSolfege,
  }));
  scheduleSave();
}

// ── Auth sync ─────────────────────────────────────────────────────────────────
async function handleLogin(event, session) {
  if (!session || event === 'TOKEN_REFRESHED') { render(); return; }
  const cloud = await loadCloudData();
  if (cloud) {
    if (cloud.playlists?.length > 0) {
      localStorage.setItem('hp-playlists', JSON.stringify(cloud.playlists));
      state.playlists = cloud.playlists;
      state.favorites = getFavorites();
    }
    if (cloud.layouts?.length > 0) {
      localStorage.setItem('hp-layouts', JSON.stringify(cloud.layouts));
      state.savedLayouts = getSavedLayouts();
    }
    if (cloud.prefs && Object.keys(cloud.prefs).length > 0) {
      localStorage.setItem('hp-prefs', JSON.stringify(cloud.prefs));
      loadPrefs();
    }
  } else {
    scheduleSave(); // first login: upload local data to cloud
  }
  render();
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
loadPrefs();
loadFromHash();
render();

// Pre-warm AudioContext on the very first user touch.
// Both pointerdown and touchstart are registered: iOS Chrome (WKWebView) requires
// a user-gesture-initiated ctx.resume(); touchstart is the historically reliable
// trigger on older iOS while pointerdown covers desktop and modern iOS.
// initAudio() is idempotent so firing both for the same touch is harmless.
initSupabase(handleLogin);

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

  if (action === 'auth-signout') {
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
    const chord = state.chords.find(c => c.id === chordId);
    if (!chord) return;
    state.pickerChordFavId = favId;
    state.pickerChordObj = chord;
    state.pickerNewPlaylist = false;
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
      const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
      addChordToPlaylist(playlistId, {
        id: favId, layoutId,
        layoutData: state.layout.isCustom ? JSON.parse(JSON.stringify(state.layout)) : null,
        scaleName: state.layout.name,
        chordId: chord.id, rootName: chord.rootName,
        typeName: chord.type.name, category: chord.type.category,
        notes: chord.notes, noteCount: chord.noteCount,
      });
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
      const chord = state.pickerChordObj;
      const favId = state.pickerChordFavId;
      const layoutId = state.layout.isCustom ? (state.layout.savedId || state.layout.id) : state.layout.id;
      addChordToPlaylist(newId, {
        id: favId, layoutId,
        layoutData: state.layout.isCustom ? JSON.parse(JSON.stringify(state.layout)) : null,
        scaleName: state.layout.name,
        chordId: chord.id, rootName: chord.rootName,
        typeName: chord.type.name, category: chord.type.category,
        notes: chord.notes, noteCount: chord.noteCount,
      });
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
    // Load the first chord's scale and set the playlist filter
    const first = pl.chords[0];
    if (first.layoutData) {
      state.layout = first.layoutData;
    } else {
      const saved = state.savedLayouts.find(l => l.id === first.layoutId);
      if (saved) { state.layout = saved.layout; }
      else {
        const scale = SCALES.find(s => s.id === first.layoutId);
        if (!scale) { showToast('Scale not found'); return; }
        state.layout = createLayoutFromScale(scale);
      }
    }
    state.chords = findAllChords(state.layout);
    state.selectedChord = state.chords.find(c => c.id === first.chordId) || null;
    state.shellMode = 'both';
    state.chordFilter = { category: 'All', root: 'All', playlist: pl.id };
    state.view = 'chords';
    history.pushState(null, '', stateToHash());
    render();
    return;
  }

  if (action === 'open-playlist') {
    state.activePlaylistId = el.dataset.id;
    state.view = 'playlist';
    render();
    return;
  }

  if (action === 'delete-playlist') {
    if (state.activePlaylistId === 'favorites') return;
    deletePlaylist(state.activePlaylistId);
    state.playlists = getPlaylists();
    state.view = 'selector';
    state.activePlaylistId = null;
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
    const fav = pl.chords[idx];
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
    state.chordFilter = { category: 'All', root: 'All', playlist: 'All' };
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

  if (action === 'copy-url') {
    const url = location.origin + location.pathname + stateToHash();
    navigator.clipboard.writeText(url).then(() => showToast('URL copied!'));
    return;
  }
});


// ── Change delegation (selects) ───────────────────────────────────────────────
document.addEventListener('change', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action } = el.dataset;
  if (action === 'select-playlist-filter') {
    if (el.value === '__edit__') {
      state.activePlaylistId = state.chordFilter.playlist;
      state.view = 'playlist';
    } else {
      state.chordFilter.playlist = el.value;
    }
    render();
  }
  if (action === 'filter-category') { state.chordFilter.category = el.value; render(); }
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
    view: 'selector', layout: null, selectedChord: null,
    pendingSlot: null, chords: [], shellMode: 'both',
    chordFilter: { category: 'All', root: 'All', playlist: 'All' },
  });
  loadFromHash();
  render();
});
