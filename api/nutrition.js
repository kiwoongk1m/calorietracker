// Vercel serverless function: GET /api/nutrition?query=<label>
// Thin HTTP adapter over the shared nutrition provider.

import { lookupNutrition } from '../backend/src/providers/nutrition.js';
import { applyCors } from './_cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET')) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  try {
    const query = req.query.query;
    if (!query) {
      return res.status(400).json({ error: 'query parameter is required.' });
    }
    const result = await lookupNutrition({ query });
    if (!result) {
      return res.status(404).json({ error: `No nutrition match found for "${query}".` });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('[nutrition] error:', err);
    return res.status(502).json({ error: 'Nutrition lookup failed. Please try again.' });
  }
}
