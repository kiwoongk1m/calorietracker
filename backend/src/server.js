// ---------------------------------------------------------------------------
// Backend HTTP server. Implements the shared API contract (section 4) and
// keeps any real API keys server-side. Route handlers are thin: they validate
// input, call a provider, and shape the response. All swappable logic lives in
// ./providers/*, so later stages change providers, not routes.
// ---------------------------------------------------------------------------

import express from 'express';
import cors from 'cors';

import { recognizeDish } from './providers/recognition.js';
import { lookupNutrition } from './providers/nutrition.js';

const app = express();
app.use(cors());
// Base64 images are large; bump the JSON body limit accordingly.
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    recognition: (process.env.RECOGNITION_PROVIDER || 'mock').toLowerCase(),
    nutrition: (process.env.NUTRITION_PROVIDER || 'mock').toLowerCase(),
  });
});

// POST /api/recognize  { imageBase64 } -> { label, confidence, candidates }
app.post('/api/recognize', async (req, res) => {
  try {
    const { imageBase64 } = req.body ?? {};
    if (!imageBase64) {
      return res
        .status(400)
        .json({ error: 'imageBase64 is required in the request body.' });
    }
    const result = await recognizeDish({ imageBase64 });
    return res.json(result);
  } catch (err) {
    console.error('[recognize] error:', err);
    return res
      .status(502)
      .json({ error: 'Recognition failed. Please try again.' });
  }
});

// GET /api/nutrition?query=<label> -> nutrition object (or 404 JSON)
app.get('/api/nutrition', async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) {
      return res
        .status(400)
        .json({ error: 'query parameter is required.' });
    }
    const result = await lookupNutrition({ query });
    if (!result) {
      return res
        .status(404)
        .json({ error: `No nutrition match found for "${query}".` });
    }
    return res.json(result);
  } catch (err) {
    console.error('[nutrition] error:', err);
    return res
      .status(502)
      .json({ error: 'Nutrition lookup failed. Please try again.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
  console.log(
    `[backend] providers: recognition=${
      process.env.RECOGNITION_PROVIDER || 'mock'
    } nutrition=${process.env.NUTRITION_PROVIDER || 'mock'}`
  );
});

export default app;
