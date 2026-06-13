// ---------------------------------------------------------------------------
// Shared calculation module (shared API contract, section 4).
//
// Pure, dependency-free, and the single source of truth for turning a per-100g
// nutrition entry into a portion estimate. Used by the nutrition card and is
// the easiest piece to unit-test, so it is covered by calc.test.js.
//
//   Input:  { per100g, grams?, defaultServingGrams }
//   Output: { grams, kcal, protein, carbs, fat, basis }
//   Formula: value = (grams / 100) * per100g[nutrient]
//
//   basis === "weighed"  -> user supplied a real gram weight (accurate)
//   basis === "serving"  -> no weight given, fell back to a typical serving
// ---------------------------------------------------------------------------

const round1 = (n) => Math.round(n * 10) / 10;

/** True only for a finite, strictly positive number. */
function isUsableWeight(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Compute calories + macros for a portion.
 *
 * @param {object}  args
 * @param {{kcal:number, protein:number, carbs:number, fat:number}} args.per100g
 * @param {number=} args.grams                 weighed mass of the food (optional)
 * @param {number}  args.defaultServingGrams   typical serving, used when grams absent
 * @returns {{grams:number, kcal:number, protein:number, carbs:number, fat:number, basis:"weighed"|"serving"}}
 */
export function calculateNutrition({ per100g, grams, defaultServingGrams } = {}) {
  if (!per100g) {
    throw new Error('calculateNutrition: per100g is required.');
  }

  const weighed = isUsableWeight(grams);
  const effectiveGrams = weighed ? grams : defaultServingGrams;

  if (!isUsableWeight(effectiveGrams)) {
    throw new Error(
      'calculateNutrition: need a positive grams or defaultServingGrams.'
    );
  }

  const factor = effectiveGrams / 100;

  return {
    grams: effectiveGrams,
    kcal: Math.round((per100g.kcal || 0) * factor),
    protein: round1((per100g.protein || 0) * factor),
    carbs: round1((per100g.carbs || 0) * factor),
    fat: round1((per100g.fat || 0) * factor),
    basis: weighed ? 'weighed' : 'serving',
  };
}
