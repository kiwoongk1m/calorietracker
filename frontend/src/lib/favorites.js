// ---------------------------------------------------------------------------
// Favorite foods — a small user-curated list of foods to re-add in one tap.
// Stored as { name, fdcId } (the USDA name re-resolves to the same entry on
// lookup). Persisted client-side via ./storage.js. Pure helpers are testable.
// ---------------------------------------------------------------------------

import { storage } from './storage.js';

const FAV_KEY = 'calorie-snap.favorites.v1';

const key = (name) => String(name || '').trim().toLowerCase();

export function getFavorites() {
  try {
    const raw = storage().getItem(FAV_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFavorites(list) {
  storage().setItem(FAV_KEY, JSON.stringify(list));
}

/** True if a food with this name is favorited. Pure given `favs`. */
export function isFavorite(name, favs = getFavorites()) {
  const k = key(name);
  return favs.some((f) => key(f.name) === k);
}

/** Add or remove a food from favorites (by name). Returns the new list. */
export function toggleFavorite(food) {
  if (!food || !key(food.name)) return getFavorites();
  const k = key(food.name);
  const favs = getFavorites();
  const next = favs.some((f) => key(f.name) === k)
    ? favs.filter((f) => key(f.name) !== k)
    : [...favs, { name: food.name, fdcId: food.fdcId }];
  writeFavorites(next);
  return next;
}

export function clearFavorites() {
  storage().removeItem(FAV_KEY);
}
