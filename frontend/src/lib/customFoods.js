// ---------------------------------------------------------------------------
// Custom foods — user-created foods that aren't in the USDA database, with
// manually-estimated per-serving calories/macros. Saved to localStorage so they
// can be re-added in the future. Pure helpers are unit-tested.
//
// Shape: { id, name, kcal, protein, carbs, fat }  (all per one serving)
// ---------------------------------------------------------------------------

import { storage, newId } from './storage.js';

const KEY = 'calorie-snap.customfoods.v1';

const round1 = (n) => {
  const x = Number(n);
  return Number.isFinite(x) && x >= 0 ? Math.round(x * 10) / 10 : 0;
};

export function getCustomFoods() {
  try {
    const raw = storage().getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCustomFoods(list) {
  storage().setItem(KEY, JSON.stringify(list));
}

/**
 * Save a custom food (newest first; replaces an existing one with the same
 * name). Requires a name and positive calories. Returns the new list.
 */
export function addCustomFood({ name, kcal, protein, carbs, fat } = {}) {
  const nm = String(name || '').trim();
  const k = Number(kcal);
  if (!nm || !(k > 0)) return getCustomFoods();
  const food = {
    id: newId(),
    name: nm,
    kcal: Math.round(k),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
  };
  const rest = getCustomFoods().filter(
    (f) => f.name.toLowerCase() !== nm.toLowerCase()
  );
  const list = [food, ...rest];
  writeCustomFoods(list);
  return list;
}

export function removeCustomFood(id) {
  const remaining = getCustomFoods().filter((f) => f.id !== id);
  writeCustomFoods(remaining);
  return remaining;
}

export function clearCustomFoods() {
  storage().removeItem(KEY);
}

/**
 * Convert a custom food into the meal-item nutrition shape. Per-serving values
 * are carried in `per100g` with a `custom` flag, so a meal item can render it
 * as an estimate (no weighing). Pure.
 */
export function customToNutrition(food) {
  return {
    name: food.name,
    fdcId: null,
    custom: true,
    per100g: {
      kcal: food.kcal,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
    },
    defaultServingGrams: 100,
  };
}
