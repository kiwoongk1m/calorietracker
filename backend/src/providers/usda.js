// ---------------------------------------------------------------------------
// Task C — real USDA FoodData Central nutrition provider.
//
// Given a dish label, query USDA FDC search, pick the best matching entry
// (PREFERRING COOKED over raw — the user weighs a finished plate), map its
// per-100g nutrients into the shared nutrition contract, and pick a sensible
// defaultServingGrams. Results are cached in-process so repeated lookups for
// the same label don't re-hit the API. On no match → null (route → 404). On a
// transport/HTTP failure → throws (route → clean 502 JSON).
//
// SECURITY: USDA_API_KEY is read server-side only.
//
// The pure helpers (scoring/selection, nutrient mapping, serving estimate) are
// exported for unit testing WITHOUT a network call or a key — see usda.test.js.
// ---------------------------------------------------------------------------

const FDC_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// USDA nutrient numbers (stable identifiers, independent of unit naming).
const NUTRIENT_NUMBERS = {
  kcal: '208', // Energy (kcal)
  protein: '203', // Protein
  carbs: '205', // Carbohydrate, by difference
  fat: '204', // Total lipid (fat)
};

// Words that signal a cooked/finished preparation (what we want — preferred).
const COOKED_WORDS = [
  'cooked',
  'roasted',
  'grilled',
  'baked',
  'boiled',
  'fried',
  'broiled',
  'braised',
  'steamed',
  'sauteed',
  'sautéed',
  'prepared',
  'grilled',
];
// Words that signal a raw/uncooked entry (penalized — we weigh cooked food).
const RAW_WORDS = ['raw', 'uncooked', 'dry', 'dried', 'frozen, unprepared'];

// Data types preference: Foundation/SR Legacy are clean reference entries;
// Survey (FNDDS) holds many composite prepared dishes; Branded is noisiest.
const DATA_TYPE_SCORE = {
  Foundation: 3,
  'SR Legacy': 3,
  'Survey (FNDDS)': 2,
  Branded: 1,
};

function normalize(query) {
  return String(query || '').trim().toLowerCase();
}

/**
 * Score a single USDA food entry for how well it matches `query`, biased toward
 * cooked finished dishes. Higher is better. Pure.
 */
export function scoreFood(food, query) {
  if (!food) return -Infinity;
  const desc = String(food.description || '').toLowerCase();
  if (!desc) return -Infinity;
  const q = normalize(query);

  let score = 0;

  // Exact / prefix / substring description match.
  if (desc === q) score += 10;
  else if (desc.startsWith(q)) score += 6;
  else if (desc.includes(q)) score += 4;

  // Term overlap, so "grilled chicken" still scores on "chicken, grilled".
  const qTerms = q.split(/\s+/).filter(Boolean);
  const matched = qTerms.filter((t) => desc.includes(t)).length;
  if (qTerms.length > 0) score += (matched / qTerms.length) * 3;

  // Cooked vs raw bias — the core gotcha.
  if (COOKED_WORDS.some((w) => desc.includes(w))) score += 3;
  if (RAW_WORDS.some((w) => desc.includes(w))) score -= 3;

  // Prefer cleaner data types.
  score += DATA_TYPE_SCORE[food.dataType] || 0;

  // Shorter descriptions tend to be the canonical entry, not a variant.
  score -= Math.min(2, desc.length / 120);

  return score;
}

/**
 * Pick the best entry from a USDA search `foods` array. Pure. Returns the food
 * object or null.
 */
export function selectBestFood(foods, query) {
  if (!Array.isArray(foods) || foods.length === 0) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const food of foods) {
    const s = scoreFood(food, query);
    if (s > bestScore) {
      bestScore = s;
      best = food;
    }
  }
  return best;
}

/** Read a per-100g nutrient amount from a USDA food's foodNutrients array. */
function readNutrient(food, number) {
  const list = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  for (const n of list) {
    // Search results expose nutrientNumber + value at the top level.
    const num = String(n.nutrientNumber ?? n.nutrient?.number ?? '');
    if (num === number) {
      const val = Number(n.value ?? n.amount);
      return Number.isFinite(val) ? val : 0;
    }
  }
  return 0;
}

/**
 * Estimate a sensible default serving size in grams from USDA serving metadata,
 * falling back to a generic plate-portion. Pure.
 */
export function estimateServingGrams(food) {
  if (food && typeof food === 'object') {
    const size = Number(food.servingSize);
    const unit = String(food.servingSizeUnit || '').toLowerCase();
    if (Number.isFinite(size) && size > 0 && (unit === 'g' || unit === 'gram')) {
      return Math.round(size);
    }
  }
  // Generic cooked-dish serving when USDA gives no usable gram serving.
  return 200;
}

/**
 * Map a selected USDA food into the shared nutrition contract shape. Pure.
 *
 * @returns {{fdcId, name, per100g:{kcal,protein,carbs,fat}, defaultServingGrams}}
 */
export function mapFoodToNutrition(food) {
  return {
    fdcId: String(food.fdcId),
    name: food.description,
    per100g: {
      kcal: round1(readNutrient(food, NUTRIENT_NUMBERS.kcal)),
      protein: round1(readNutrient(food, NUTRIENT_NUMBERS.protein)),
      carbs: round1(readNutrient(food, NUTRIENT_NUMBERS.carbs)),
      fat: round1(readNutrient(food, NUTRIENT_NUMBERS.fat)),
    },
    defaultServingGrams: estimateServingGrams(food),
  };
}

const round1 = (n) => Math.round(n * 10) / 10;

// Simple in-process cache: normalized query -> nutrition object | null.
// Survives across requests within a single server/function instance, so
// repeated lookups (e.g. re-picking the same candidate) don't re-hit USDA.
const cache = new Map();
const CACHE_MAX = 500;

export function _clearCache() {
  cache.clear();
}

/**
 * The real USDA lookup. Throws on misconfiguration (no key) or transport
 * failure; returns null on a genuine no-match.
 */
export async function lookupWithUSDA({ query }) {
  const q = normalize(query);
  if (!q) return null;

  if (cache.has(q)) return cache.get(q);

  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    throw new Error(
      'USDA_API_KEY is not set. Set it (server-side) to use the usda ' +
        'nutrition provider, or NUTRITION_PROVIDER=mock.'
    );
  }

  const url = new URL(FDC_SEARCH_URL);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', q);
  url.searchParams.set('pageSize', '25');
  // Bias the candidate pool toward cooked/reference data; selection still
  // applies the cooked-vs-raw scoring on top.
  url.searchParams.set(
    'dataType',
    'Foundation,SR Legacy,Survey (FNDDS),Branded'
  );

  let res;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (err) {
    throw new Error(`USDA request failed: ${err.message}`);
  }

  if (res.status === 404) {
    setCache(q, null);
    return null;
  }
  if (!res.ok) {
    throw new Error(`USDA returned HTTP ${res.status}`);
  }

  const body = await res.json();
  const best = selectBestFood(body.foods, q);
  if (!best) {
    setCache(q, null);
    return null;
  }

  const nutrition = mapFoodToNutrition(best);
  setCache(q, nutrition);
  return nutrition;
}

function setCache(key, value) {
  if (cache.size >= CACHE_MAX) {
    // Evict oldest insertion (Map preserves insertion order).
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}
