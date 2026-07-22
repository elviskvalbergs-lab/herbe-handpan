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
