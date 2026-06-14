// ---------------------------------------------------------------------------
// Meal-item math: turn a builder item (USDA or custom, with grams + a portion
// multiplier) into a concrete {grams, basis, kcal, protein, carbs, fat}. Shared
// by the meal builder (display + total) and App (logging) so they never drift.
// Pure; unit-tested.
//
// Item shape: { state, portion?, grams?, nutrition: { per100g, defaultServingGrams, custom? } }
// ---------------------------------------------------------------------------

import { calculateNutrition } from './calc.js';

const round1 = (n) => Math.round(n * 10) / 10;

export const PORTIONS = [
  { value: 0.25, label: '¼' },
  { value: 1 / 3, label: '⅓' },
  { value: 0.5, label: '½' },
  { value: 0.75, label: '¾' },
  { value: 1, label: '1' },
  { value: 1.5, label: '1½' },
  { value: 2, label: '2' },
];

/**
 * Concrete nutrition for a meal item, scaled by its portion multiplier.
 * - custom foods use their per-serving estimate directly (no weighing).
 * - USDA foods use grams (weighed) or the default serving.
 * Returns null if the item isn't ready.
 */
export function mealItemResult(item) {
  if (!item || item.state !== 'ready' || !item.nutrition) return null;
  const p = Number(item.portion) > 0 ? Number(item.portion) : 1;

  if (item.nutrition.custom) {
    const n = item.nutrition.per100g || {};
    return {
      grams: null,
      basis: 'estimate',
      kcal: Math.round((n.kcal || 0) * p),
      protein: round1((n.protein || 0) * p),
      carbs: round1((n.carbs || 0) * p),
      fat: round1((n.fat || 0) * p),
    };
  }

  const g = parseFloat(item.grams);
  const base = calculateNutrition({
    per100g: item.nutrition.per100g,
    grams: Number.isFinite(g) ? g : undefined,
    defaultServingGrams: item.nutrition.defaultServingGrams,
  });
  return {
    grams: round1(base.grams * p),
    basis: base.basis,
    kcal: Math.round(base.kcal * p),
    protein: round1(base.protein * p),
    carbs: round1(base.carbs * p),
    fat: round1(base.fat * p),
  };
}

/** Sum a list of mealItemResult outputs (skips nulls). Pure. */
export function sumMeal(results = []) {
  const t = results.reduce(
    (acc, r) =>
      r
        ? {
            kcal: acc.kcal + r.kcal,
            protein: acc.protein + r.protein,
            carbs: acc.carbs + r.carbs,
            fat: acc.fat + r.fat,
          }
        : acc,
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  return {
    kcal: Math.round(t.kcal),
    protein: round1(t.protein),
    carbs: round1(t.carbs),
    fat: round1(t.fat),
  };
}
