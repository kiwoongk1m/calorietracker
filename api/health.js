// Vercel serverless function: GET /api/health
// Mirrors the dev Express server's health check so production has one too —
// useful for uptime checks and confirming which providers are active.

import { applyCors } from './_cors.js';

export default function handler(req, res) {
  if (applyCors(req, res, 'GET')) return;
  res.status(200).json({
    ok: true,
    recognition: (process.env.RECOGNITION_PROVIDER || 'mock').toLowerCase(),
    nutrition: (process.env.NUTRITION_PROVIDER || 'mock').toLowerCase(),
  });
}
