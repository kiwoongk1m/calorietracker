// ---------------------------------------------------------------------------
// Nutrition provider — second swap seam (Task C replaces the mock with USDA).
//
// Contract (shared API, section 4):
//   lookupNutrition({ query }) -> {
//     fdcId: string,
//     name: string,
//     per100g: { kcal, protein, carbs, fat },   // grams except kcal
//     defaultServingGrams: number
//   }
//   On no match, returns null (route turns this into a clean 404 JSON).
//
// GOTCHA baked in: per-100g values describe COOKED dishes, because the user
// weighs a finished plate. Task C must prefer cooked USDA entries over raw.
// ---------------------------------------------------------------------------

import { lookupWithUSDA } from './usda.js';

// Small fixed table of cooked-dish, per-100g values. Stand-in for USDA so the
// pipeline renders real-shaped numbers without a network call.
const MOCK_DB = {
  'spaghetti carbonara': {
    fdcId: 'mock-0001',
    name: 'Spaghetti carbonara, cooked',
    per100g: { kcal: 160, protein: 6.5, carbs: 18, fat: 7 },
    defaultServingGrams: 250,
  },
  'spaghetti bolognese': {
    fdcId: 'mock-0002',
    name: 'Spaghetti bolognese, cooked',
    per100g: { kcal: 130, protein: 7, carbs: 15, fat: 4.5 },
    defaultServingGrams: 300,
  },
  'grilled chicken breast': {
    fdcId: 'mock-0003',
    name: 'Chicken breast, grilled (cooked)',
    per100g: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
    defaultServingGrams: 150,
  },
  'caesar salad': {
    fdcId: 'mock-0004',
    name: 'Caesar salad with dressing',
    per100g: { kcal: 190, protein: 5, carbs: 6, fat: 16 },
    defaultServingGrams: 200,
  },
  'margherita pizza': {
    fdcId: 'mock-0005',
    name: 'Pizza, margherita, baked',
    per100g: { kcal: 270, protein: 11, carbs: 33, fat: 10 },
    defaultServingGrams: 300,
  },
};

function normalize(query) {
  return String(query || '').trim().toLowerCase();
}

/** Stage 1 mock lookup: exact match, then substring match, else null. */
async function mockNutrition({ query }) {
  const q = normalize(query);
  if (!q) return null;

  if (MOCK_DB[q]) return MOCK_DB[q];

  const partial = Object.keys(MOCK_DB).find(
    (key) => key.includes(q) || q.includes(key)
  );
  return partial ? MOCK_DB[partial] : null;
}

/**
 * Stage 2 real lookup (Task C). Delegates to the USDA module, which searches
 * FoodData Central, prefers cooked entries, maps to the per-100g contract, and
 * caches results. Implementation lives in ./usda.js so its pure
 * selection/mapping helpers can be unit-tested without a key. Returns null on a
 * genuine no-match (route → 404); throws only on misconfig / transport failure
 * (route → 502).
 */
async function usdaNutrition(input) {
  return lookupWithUSDA(input);
}

const PROVIDERS = {
  mock: mockNutrition,
  usda: usdaNutrition,
};

export async function lookupNutrition(input) {
  const name = (process.env.NUTRITION_PROVIDER || 'mock').toLowerCase();
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`Unknown NUTRITION_PROVIDER "${name}".`);
  }
  return provider(input);
}
