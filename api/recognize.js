// Vercel serverless function: POST /api/recognize
// Thin HTTP adapter over the shared recognition provider — the same code the
// Express dev server uses, so dev and prod behave identically.

import { recognizeDish } from '../backend/src/providers/recognition.js';
import { applyCors } from './_cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST')) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  try {
    const { imageBase64 } = req.body ?? {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required in the request body.' });
    }
    const result = await recognizeDish({ imageBase64 });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[recognize] error:', err);
    return res.status(502).json({ error: 'Recognition failed. Please try again.' });
  }
}
