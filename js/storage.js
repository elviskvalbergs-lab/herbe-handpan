const LAYOUTS_KEY = 'hp-layouts';
const FAVS_KEY = 'hp-favorites'; // legacy, migrated into hp-playlists on first access
const PLAYLISTS_KEY = 'hp-playlists';

function safeParse(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}

function now() { return new Date().toISOString(); }

// ── Saved layouts ────────────────────────────────────────────────────────────

// Raw: includes soft-deleted entries (needed for cloud sync)
function getAllLayoutsRaw() { return safeParse(LAYOUTS_KEY); }

export function getSavedLayouts() {
  return getAllLayoutsRaw().filter(l => !l.deletedAt);
}

export function saveLayout(entry) {
  const all = getAllLayoutsRaw();
  const idx = all.findIndex(l => l.id === entry.id);
  const stamped = { ...entry, updatedAt: now() };
  if (idx >= 0) all[idx] = stamped;
  else all.unshift(stamped);
  localStorage.setItem(LAYOUTS_KEY, JSON.stringify(all));
}

export function deleteLayout(id) {
  const all = getAllLayoutsRaw();
  const layout = all.find(l => l.id === id);
  if (layout) {
    const ts = now();
    layout.deletedAt = ts;
    layout.updatedAt = ts;
    localStorage.setItem(LAYOUTS_KEY, JSON.stringify(all));
  }
}

// ── Playlists ────────────────────────────────────────────────────────────────

// Raw: includes soft-deleted entries (needed for cloud sync)
function getAllPlaylistsRaw() {
  const raw = localStorage.getItem(PLAYLISTS_KEY);
  if (raw !== null) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  // First run: create default Favorites playlist, migrate old favorites if any
  const old = safeParse(FAVS_KEY);
  const playlists = [{ id: 'favorites', name: 'Favorites', chords: old, updatedAt: now() }];
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  return playlists;
}

export function getPlaylists() {
  return getAllPlaylistsRaw().filter(p => !p.deletedAt);
}

export function addPlaylist(name) {
  const playlists = getAllPlaylistsRaw();
  const id = 'pl-' + Date.now();
  playlists.push({ id, name, chords: [], updatedAt: now() });
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  return id;
}

export function renamePlaylist(id, name) {
  const playlists = getAllPlaylistsRaw();
  const pl = playlists.find(p => p.id === id);
  if (pl) { pl.name = name; pl.updatedAt = now(); localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists)); }
}

export function deletePlaylist(id) {
  if (id === 'favorites') return;
  const playlists = getAllPlaylistsRaw();
  const pl = playlists.find(p => p.id === id);
  if (pl) {
    const ts = now();
    pl.deletedAt = ts;
    pl.updatedAt = ts;
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  }
}

export function addChordToPlaylist(playlistId, chord) {
  const playlists = getAllPlaylistsRaw();
  const pl = playlists.find(p => p.id === playlistId && !p.deletedAt);
  if (!pl || pl.chords.some(c => c.id === chord.id)) return false;
  pl.chords.unshift(chord);
  pl.updatedAt = now();
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  return true;
}

// Overwrites an existing entry's voicing in place (same array position),
// rather than adding a new one. Used when a chord opened from a playlist
// gets its notes swapped and the user wants to save that change back.
export function updatePlaylistChordVoicing(playlistId, oldFavId, updates) {
  const playlists = getAllPlaylistsRaw();
  const pl = playlists.find(p => p.id === playlistId);
  if (!pl) return false;
  const idx = pl.chords.findIndex(c => c.id === oldFavId);
  if (idx < 0) return false;
  pl.chords[idx] = { ...pl.chords[idx], ...updates };
  pl.updatedAt = now();
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  return true;
}

export function removeChordFromPlaylist(playlistId, chordFavId) {
  const playlists = getAllPlaylistsRaw();
  const pl = playlists.find(p => p.id === playlistId);
  if (!pl) return;
  pl.chords = pl.chords.filter(c => c.id !== chordFavId);
  pl.updatedAt = now();
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
}

export function reorderChordInPlaylist(playlistId, fromIdx, toIdx) {
  const playlists = getAllPlaylistsRaw();
  const pl = playlists.find(p => p.id === playlistId);
  if (!pl || fromIdx === toIdx || toIdx < 0 || toIdx >= pl.chords.length) return;
  const [item] = pl.chords.splice(fromIdx, 1);
  pl.chords.splice(toIdx, 0, item);
  pl.updatedAt = now();
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
}

export function isChordInPlaylist(playlistId, chordFavId) {
  const pl = getPlaylists().find(p => p.id === playlistId);
  return !!(pl && pl.chords.some(c => c.id === chordFavId));
}

export function isChordInAnyPlaylist(chordFavId) {
  return getPlaylists().some(p => p.chords.some(c => c.id === chordFavId));
}

// Whether ANY voicing of this chord (same layout+chordId, any notes) is
// bookmarked anywhere. Used for the heart glance-indicator, which should stay
// filled regardless of which specific voicing is currently being viewed —
// unlike the exact-id match above, which the playlist picker needs to decide
// whether to add or remove THIS specific voicing.
export function isChordBookmarkedAnyVoicing(layoutId, chordId) {
  return getPlaylists().some(p => p.chords.some(c => c.layoutId === layoutId && c.chordId === chordId));
}

// Legacy compat — keep old callers working
export function getFavorites() {
  return getPlaylists().find(p => p.id === 'favorites')?.chords ?? [];
}
export function toggleFavorite(fav) {
  if (isChordInPlaylist('favorites', fav.id)) {
    removeChordFromPlaylist('favorites', fav.id);
    return false;
  }
  return addChordToPlaylist('favorites', fav);
}
export function isFavorite(id) { return isChordInPlaylist('favorites', id); }

// ── Progressions ─────────────────────────────────────────────────────────────
// A progression is an ordered list of steps in which the same chord may come
// back any number of times (docs/ocarina-mode.md, "Progressions"). Each step
// has its own stepId and carries the chord the way a playlist entry does
// (chordId, rootName, typeName, category, notes, noteCount, and layoutId /
// layoutData for a handpan or instrumentId / family for an ocarina or flute),
// without the entry id, plus how many bars it lasts. Stored like playlists:
// soft deletes and updatedAt, under hp-progressions.
const PROGRESSIONS_KEY = 'hp-progressions';
export const PROG_DEFAULTS = { bpm: 80, beatsPerBar: 4, bars: 1 };
export const PROG_LIMITS = { bpm: [30, 240], beatsPerBar: [1, 12], bars: [1, 16] };

function progClamp(key, value) {
  const [lo, hi] = PROG_LIMITS[key];
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : PROG_DEFAULTS[key];
}

function progUid(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// A step for a chord, from a playlist entry (or the same shape): the entry
// id is dropped, since a step is known by its own stepId.
export function newProgressionStep(entry, { stepId = progUid('st'), bars = PROG_DEFAULTS.bars } = {}) {
  const { id, stepId: _old, bars: _bars, ...chord } = entry;
  return { stepId, bars: progClamp('bars', bars), ...chord };
}

// Fills in the defaults of a progression read from storage or sync.
export function normalizeProgression(p) {
  return {
    ...p,
    bpm: progClamp('bpm', p.bpm ?? PROG_DEFAULTS.bpm),
    beatsPerBar: progClamp('beatsPerBar', p.beatsPerBar ?? PROG_DEFAULTS.beatsPerBar),
    steps: (p.steps ?? []).map(s => {
      const step = { ...s, bars: progClamp('bars', s.bars ?? PROG_DEFAULTS.bars) };
      if (step.beats != null) {
        const b = Math.round(Number(step.beats));
        if (Number.isFinite(b) && b >= 1) step.beats = Math.min(b, PROG_LIMITS.bars[1] * PROG_LIMITS.beatsPerBar[1]);
        else delete step.beats;
      }
      return step;
    }),
  };
}

// A step's length in beats: its beats when set (part of a bar, from a chord
// sheet with two chords in a bar), otherwise its bars.
export function progressionStepBeats(step, beatsPerBar) {
  return step.beats != null ? step.beats : step.bars * beatsPerBar;
}

// How long one step lasts at the progression's tempo, in milliseconds.
export function progressionStepMs(bpm, beatsPerBar, bars) {
  return (progClamp('bars', bars) * progClamp('beatsPerBar', beatsPerBar) * 60000) / progClamp('bpm', bpm);
}

// Steps, bars and the length of one pass through the steps that play here
// (isHere(step), all steps when left out).
export function progressionTotals(p, isHere = () => true) {
  const n = normalizeProgression(p);
  const here = n.steps.filter(isHere);
  const beats = here.reduce((sum, s) => sum + progressionStepBeats(s, n.beatsPerBar), 0);
  const bars = beats / n.beatsPerBar;
  return { steps: here.length, bars, ms: (beats * 60000) / n.bpm };
}

// Index of the next step after `from` (wrapping round) that plays here, or
// -1 when none does. from = -1 finds the first.
export function nextProgressionStep(steps, from, isHere = () => true) {
  const n = steps.length;
  for (let k = 1; k <= n; k++) {
    const i = (((from + k) % n) + n) % n;
    if (isHere(steps[i])) return i;
  }
  return -1;
}

// Per-progression merge of the local list with the cloud's, newest
// updatedAt winning (deletes travel as soft deletes). needPush: the cloud
// is missing something or holds an older version.
export function mergeProgressionLists(local = [], cloud = []) {
  const byId = new Map();
  for (const p of [...local, ...cloud]) {
    const had = byId.get(p.id);
    if (!had || (p.updatedAt || '') > (had.updatedAt || '')) byId.set(p.id, p);
  }
  const merged = [...byId.values()];
  const differs = (list, other) => {
    const m = new Map(other.map(p => [p.id, p.updatedAt || '']));
    return list.length !== other.length || list.some(p => m.get(p.id) !== (p.updatedAt || ''));
  };
  return { merged, changedLocal: differs(merged, local), needPush: differs(merged, cloud) };
}

// Raw: includes soft-deleted progressions (needed for cloud sync).
export function getProgressionsRaw() {
  const list = safeParse(PROGRESSIONS_KEY);
  return Array.isArray(list) ? list : [];
}

export function writeProgressionsRaw(list) {
  localStorage.setItem(PROGRESSIONS_KEY, JSON.stringify(list));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('hp-progressions-changed'));
}

export function getProgressions() {
  return getProgressionsRaw().filter(p => !p.deletedAt).map(normalizeProgression);
}

// Applies fn to one live progression and stamps it; returns fn's result,
// or undefined when there is no such progression.
function editProgression(id, fn) {
  const all = getProgressionsRaw();
  const idx = all.findIndex(p => p.id === id && !p.deletedAt);
  if (idx < 0) return undefined;
  const p = normalizeProgression(all[idx]);
  const result = fn(p);
  if (result === false) return false;
  p.updatedAt = now();
  all[idx] = p;
  writeProgressionsRaw(all);
  return result;
}

// extra: more fields for the new progression (a chord sheet's bpm,
// beatsPerBar, level, transpose …).
export function addProgression(name, steps = [], extra = {}) {
  const all = getProgressionsRaw();
  const id = progUid('pr');
  all.push(normalizeProgression({ bpm: PROG_DEFAULTS.bpm, beatsPerBar: PROG_DEFAULTS.beatsPerBar, ...extra, id, name, steps, updatedAt: now() }));
  writeProgressionsRaw(all);
  return id;
}

export function renameProgression(id, name) {
  return editProgression(id, p => { p.name = name; return true; });
}

export function deleteProgression(id) {
  const all = getProgressionsRaw();
  const p = all.find(x => x.id === id);
  if (!p) return;
  const ts = now();
  p.deletedAt = ts;
  p.updatedAt = ts;
  writeProgressionsRaw(all);
}

// Tempo and time signature: { bpm, beatsPerBar }, each clamped to its range.
export function setProgressionTiming(id, { bpm, beatsPerBar }) {
  return editProgression(id, p => {
    if (bpm != null) p.bpm = progClamp('bpm', bpm);
    if (beatsPerBar != null) p.beatsPerBar = progClamp('beatsPerBar', beatsPerBar);
    return true;
  });
}

// Appends a step for a chord (repeats allowed); returns its step number (1-based).
export function addStepToProgression(id, entry) {
  return editProgression(id, p => { p.steps.push(newProgressionStep(entry)); return p.steps.length; });
}

// A copy of a step right after it.
export function duplicateProgressionStep(id, idx) {
  return editProgression(id, p => {
    const s = p.steps[idx];
    if (!s) return false;
    p.steps.splice(idx + 1, 0, newProgressionStep(s, { bars: s.bars }));
    return true;
  });
}

export function moveProgressionStep(id, fromIdx, toIdx) {
  return editProgression(id, p => {
    if (fromIdx === toIdx || !p.steps[fromIdx] || toIdx < 0 || toIdx >= p.steps.length) return false;
    const [s] = p.steps.splice(fromIdx, 1);
    p.steps.splice(toIdx, 0, s);
    return true;
  });
}

export function removeProgressionStep(id, idx) {
  return editProgression(id, p => {
    if (!p.steps[idx]) return false;
    p.steps.splice(idx, 1);
    return true;
  });
}

export function setProgressionStepBars(id, idx, bars) {
  return editProgression(id, p => {
    if (!p.steps[idx]) return false;
    p.steps[idx].bars = progClamp('bars', bars);
    delete p.steps[idx].beats; // whole bars from now on
    return true;
  });
}

// How a handpan progression is played (docs/ocarina-mode.md, "From chord
// sheet to playing"): 'chord' strikes the whole chord on beat 1 (what Play
// always did, and the default), or a level's pattern.
export const PROG_PLAY_LEVELS = ['chord', 'roots', 'arpeggio', 'groove'];

export function progressionLevel(p) {
  return PROG_PLAY_LEVELS.includes(p?.level) ? p.level : 'chord';
}

export function setProgressionLevel(id, level) {
  if (!PROG_PLAY_LEVELS.includes(level)) return false;
  return editProgression(id, p => { p.level = level; return true; });
}
