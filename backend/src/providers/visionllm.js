// ---------------------------------------------------------------------------
// Task B — real vision-LLM recognizer.
//
// Sends the captured image to a vision-capable Claude model and asks for
// JSON-only structured output: one best dish label + 2-3 alternates +
// confidence. We then VALIDATE and NORMALIZE that output into the shared
// recognition contract (see recognition.js), falling back to the unrecognized
// state whenever the model is unsure, the image is not food, or the response
// can't be trusted.
//
// SECURITY: the key lives in VISION_LLM_API_KEY and is read server-side only.
// This module runs in the Express server / Vercel function, never in the
// browser bundle. The base64 image is forwarded as-is to the Anthropic API.
//
// The pure helpers (data-URL parsing, JSON extraction, result validation) are
// exported so they can be unit-tested WITHOUT a network call or an API key —
// see visionllm.test.js. recognizeWithVisionLLM itself needs a key to run.
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';

// A current vision-capable Claude model. Server-side only; overridable via env.
const DEFAULT_MODEL = 'claude-opus-4-8';

// Confidence at/under which we treat recognition as "not sure enough" and fall
// back to the unrecognized state rather than guessing.
const MIN_CONFIDENCE = 0.2;

const SUPPORTED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// The prompt is strict about JSON-only output AND about the non-food / unsure
// escape hatch, so the model itself can decline rather than hallucinate a dish.
const SYSTEM_PROMPT = `You are a food recognition system. You are given a single photo.

Identify the most likely prepared dish or food item in the photo.

Respond with a SINGLE JSON object and NOTHING else — no prose, no markdown, no
code fences. The JSON object must have exactly these keys:

{
  "isFood": boolean,            // false if the image is not food (a person, a
                                //   landscape, a screenshot, an empty plate...)
  "label": string | null,      // the single best dish name, lowercase, concise
                                //   (e.g. "grilled chicken breast", "margherita
                                //   pizza"). null if isFood is false or you are
                                //   not reasonably sure.
  "confidence": number,        // 0..1, your calibrated confidence in "label".
  "candidates": string[]       // 2-3 plausible ALTERNATIVE dish names, lowercase,
                                //   excluding "label". [] if isFood is false.
}

Rules:
- Prefer the name of the finished/cooked dish, not raw ingredients.
- If it is clearly not food, set isFood=false, label=null, confidence=0,
  candidates=[].
- If it is food but you cannot identify it with reasonable confidence, set
  label=null and a low confidence; still suggest candidates if you have guesses.
- Never invent a precise dish you are not actually seeing. Honest uncertainty is
  better than a confident wrong answer.`;

/**
 * Split a data URL or raw base64 string into { mediaType, data } suitable for
 * the Anthropic image source block. Returns null if it can't produce a
 * supported image payload.
 *
 * Accepts:
 *   - "data:image/png;base64,AAAA..."  (browser FileReader / canvas output)
 *   - raw base64 with no prefix        (defaults mediaType to image/jpeg)
 */
export function parseImagePayload(imageBase64) {
  if (typeof imageBase64 !== 'string') return null;
  const trimmed = imageBase64.trim();
  if (!trimmed) return null;

  const dataUrlMatch = /^data:([^;,]+)(;base64)?,(.*)$/is.exec(trimmed);
  if (dataUrlMatch) {
    const mediaType = dataUrlMatch[1].toLowerCase();
    const isBase64 = Boolean(dataUrlMatch[2]);
    const data = dataUrlMatch[3];
    if (!isBase64) return null; // we only forward base64-encoded images
    if (!SUPPORTED_MEDIA_TYPES.has(mediaType)) return null;
    if (!data) return null;
    return { mediaType, data };
  }

  // No data-URL prefix: assume raw base64 JPEG bytes.
  return { mediaType: 'image/jpeg', data: trimmed };
}

/**
 * Pull the first balanced top-level JSON object out of a model response. The
 * prompt asks for JSON-only, but this tolerates accidental prose or code fences
 * around it. Returns the parsed object, or null if none can be parsed.
 */
export function extractJsonObject(text) {
  if (typeof text !== 'string') return null;

  // Fast path: the whole thing is JSON.
  const direct = tryParse(text.trim());
  if (direct && typeof direct === 'object') return direct;

  // Otherwise scan for the first balanced {...} run.
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return tryParse(text.slice(start, i + 1));
      }
    }
  }
  return null;
}

function tryParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function cleanLabel(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validate + normalize a raw parsed model object into the recognition contract
 * shape, or return the unrecognized state. Pure — no I/O. `unrecognized` is the
 * frozen UNRECOGNIZED object passed in by the caller so this module doesn't have
 * to import recognition.js (avoids a cycle) and stays trivially testable.
 *
 * @returns {{label, confidence, candidates, unrecognized:boolean}}
 */
export function normalizeRecognition(raw, unrecognized) {
  const unsure = { ...unrecognized };
  if (!raw || typeof raw !== 'object') return unsure;

  // Explicit non-food signal.
  if (raw.isFood === false) return unsure;

  const label = cleanLabel(raw.label);
  if (!label) return unsure;

  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.min(1, Math.max(0, confidence));
  if (confidence <= MIN_CONFIDENCE) return unsure;

  const seen = new Set([label]);
  const candidates = [];
  if (Array.isArray(raw.candidates)) {
    for (const c of raw.candidates) {
      const cleaned = cleanLabel(c);
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        candidates.push(cleaned);
      }
      if (candidates.length >= 3) break;
    }
  }

  return { label, confidence, candidates, unrecognized: false };
}

/**
 * The real recognizer. Resolves a client lazily so the module imports fine
 * without a key (the mock stays the default). Throws if called without a key —
 * the route turns that into a clean 502, and RECOGNITION_PROVIDER=mock remains
 * the safe default.
 *
 * @param {{imageBase64:string}} input
 * @param {object} unrecognized  the frozen UNRECOGNIZED contract object
 */
export async function recognizeWithVisionLLM({ imageBase64 }, unrecognized) {
  const apiKey = process.env.VISION_LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'VISION_LLM_API_KEY (or ANTHROPIC_API_KEY) is not set. Set it ' +
        '(server-side) to use the visionllm recognition provider, or ' +
        'RECOGNITION_PROVIDER=mock.'
    );
  }

  const image = parseImagePayload(imageBase64);
  if (!image) {
    // Unusable / non-image payload — treat as unrecognized, don't spend a call.
    return { ...unrecognized };
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.VISION_LLM_MODEL || DEFAULT_MODEL;

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: image.mediaType,
              data: image.data,
            },
          },
          { type: 'text', text: 'Identify the food in this photo.' },
        ],
      },
    ],
  });

  const text = (response.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const parsed = extractJsonObject(text);
  return normalizeRecognition(parsed, unrecognized);
}
