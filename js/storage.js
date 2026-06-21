const LAYOUTS_KEY = 'hp-layouts';
const FAVS_KEY = 'hp-favorites';

function safeParse(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}

export function getSavedLayouts() { return safeParse(LAYOUTS_KEY); }

export function saveLayout(entry) {
  const all = getSavedLayouts();
  const idx = all.findIndex(l => l.id === entry.id);
  if (idx >= 0) all[idx] = entry;
  else all.unshift(entry);
  localStorage.setItem(LAYOUTS_KEY, JSON.stringify(all));
}

export function deleteLayout(id) {
  localStorage.setItem(LAYOUTS_KEY,
    JSON.stringify(getSavedLayouts().filter(l => l.id !== id)));
}

export function getFavorites() { return safeParse(FAVS_KEY); }

// Adds if not present, removes if present. Returns true = added.
export function toggleFavorite(fav) {
  const all = getFavorites();
  const idx = all.findIndex(f => f.id === fav.id);
  if (idx >= 0) all.splice(idx, 1);
  else all.unshift(fav);
  localStorage.setItem(FAVS_KEY, JSON.stringify(all));
  return idx < 0;
}

export function isFavorite(id) {
  return getFavorites().some(f => f.id === id);
}
