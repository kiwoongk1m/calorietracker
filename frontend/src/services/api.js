// ---------------------------------------------------------------------------
// Client-side API service. The frontend only ever talks to these two
// functions; it never knows or cares whether recognition is mocked or backed
// by a real vision LLM. That isolation is what lets the recognition step be
// swapped in later stages without touching the UI.
// ---------------------------------------------------------------------------

async function parseError(res, fallback) {
  try {
    const body = await res.json();
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

/**
 * POST /api/recognize
 * @param {string} imageBase64
 * @returns {Promise<{label:string|null, confidence:number, candidates:string[], unrecognized?:boolean}>}
 */
export async function recognizeDish(imageBase64) {
  const res = await fetch('/api/recognize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, 'Could not recognize the photo.'));
  }
  return res.json();
}

/**
 * GET /api/nutrition?query=<label>
 * @param {string} query
 * @returns {Promise<{fdcId:string, name:string, per100g:object, defaultServingGrams:number}>}
 */
export async function fetchNutrition(query) {
  const res = await fetch(`/api/nutrition?query=${encodeURIComponent(query)}`);
  if (!res.ok) {
    throw new Error(
      await parseError(res, `No nutrition data found for "${query}".`)
    );
  }
  return res.json();
}
