const LAYOUTS_KEY = 'hp-layouts';
const FAVS_KEY = 'hp-favorites'; // legacy, migrated into hp-playlists on first access
const PLAYLISTS_KEY = 'hp-playlists';

function safeParse(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}

// ── Saved layouts ────────────────────────────────────────────────────────────

export function getSavedLayouts() { return safeParse(LAYOUTS_KEY); }

export function saveLayout(entry) {
  const all = getSavedLayouts();
  const idx = all.findIndex(l => l.id === entry.id);
  if (idx >= 0) all[idx] = entry;
  else all.unshift(entry);
  localStorage.setItem(LAYOUTS_KEY, JSON.stringify(all));
}

export function deleteLayout(id) {
  localStorage.setItem(LAYOUTS_KEY, JSON.stringify(getSavedLayouts().filter(l => l.id !== id)));
}

// ── Playlists ────────────────────────────────────────────────────────────────

function setPlaylists(playlists) {
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
}

export function getPlaylists() {
  const raw = localStorage.getItem(PLAYLISTS_KEY);
  if (raw !== null) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  // First run: create default Favorites playlist, migrate old favorites if any
  const old = safeParse(FAVS_KEY);
  const playlists = [{ id: 'favorites', name: 'Favorites', chords: old }];
  setPlaylists(playlists);
  return playlists;
}

export function addPlaylist(name) {
  const playlists = getPlaylists();
  const id = 'pl-' + Date.now();
  playlists.push({ id, name, chords: [] });
  setPlaylists(playlists);
  return id;
}

export function renamePlaylist(id, name) {
  const playlists = getPlaylists();
  const pl = playlists.find(p => p.id === id);
  if (pl) { pl.name = name; setPlaylists(playlists); }
}

export function deletePlaylist(id) {
  if (id === 'favorites') return;
  setPlaylists(getPlaylists().filter(p => p.id !== id));
}

export function addChordToPlaylist(playlistId, chord) {
  const playlists = getPlaylists();
  const pl = playlists.find(p => p.id === playlistId);
  if (!pl || pl.chords.some(c => c.id === chord.id)) return false;
  pl.chords.unshift(chord);
  setPlaylists(playlists);
  return true;
}

export function removeChordFromPlaylist(playlistId, chordFavId) {
  const playlists = getPlaylists();
  const pl = playlists.find(p => p.id === playlistId);
  if (!pl) return;
  pl.chords = pl.chords.filter(c => c.id !== chordFavId);
  setPlaylists(playlists);
}

export function reorderChordInPlaylist(playlistId, fromIdx, toIdx) {
  const playlists = getPlaylists();
  const pl = playlists.find(p => p.id === playlistId);
  if (!pl || fromIdx === toIdx || toIdx < 0 || toIdx >= pl.chords.length) return;
  const [item] = pl.chords.splice(fromIdx, 1);
  pl.chords.splice(toIdx, 0, item);
  setPlaylists(playlists);
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
