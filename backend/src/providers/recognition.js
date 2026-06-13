// ---------------------------------------------------------------------------
// Recognition provider — THE SWAP SEAM.
//
// This is the ONLY part of the app that changes between stages. Everything
// downstream (nutrition lookup, calc, card) consumes the contract below and
// never needs to know which provider produced it.
//
// Contract (shared API, section 4):
//   recognizeDish({ imageBase64 }) -> {
//     label: string,
//     confidence: number (0..1),
//     candidates: string[]
//   }
//   When unsure, return the "unrecognized" state (label: null, candidates: []).
//
// To add the real Stage 2 implementation: write a `visionLLMRecognizer`
// function with the same signature, register it in PROVIDERS below, and set
// RECOGNITION_PROVIDER=visionllm. No route, calc, or UI code changes.
// ---------------------------------------------------------------------------

import { recognizeWithVisionLLM } from './visionllm.js';

export const UNRECOGNIZED = Object.freeze({
  label: null,
  confidence: 0,
  candidates: [],
  unrecognized: true,
});

/**
 * Stage 1 mock. Ignores the image bytes and returns a plausible, fixed result
 * so the rest of the pipeline has real-shaped data to render. It validates that
 * an image was actually supplied, so the unrecognized path is exercisable.
 */
async function mockRecognizer({ imageBase64 }) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return { ...UNRECOGNIZED };
  }

  // A tiny "looks like nothing" escape hatch so the unrecognized state can be
  // demoed end-to-end without a real model: send imageBase64 === "non-food".
  if (imageBase64.trim().toLowerCase() === 'non-food') {
    return { ...UNRECOGNIZED };
  }

  return {
    label: 'spaghetti carbonara',
    confidence: 0.82,
    candidates: ['spaghetti bolognese', 'fettuccine alfredo', 'cacio e pepe'],
    unrecognized: false,
  };
}

/**
 * Stage 2 real recognizer (Task B). Delegates to the vision-LLM module, which
 * sends the image to a vision-capable Claude model, parses JSON-only output,
 * validates it, and returns either a recognition or this UNRECOGNIZED state.
 * The implementation lives in ./visionllm.js so its pure parsing/validation
 * helpers can be unit-tested without a key. It throws only when misconfigured
 * (no VISION_LLM_API_KEY), which the route turns into a clean 502.
 */
async function visionLLMRecognizer(input) {
  return recognizeWithVisionLLM(input, UNRECOGNIZED);
}

const PROVIDERS = {
  mock: mockRecognizer,
  visionllm: visionLLMRecognizer,
};

/**
 * Resolve the active recognizer from env and run it. Always returns the
 * contract shape; never throws for normal "unsure" results.
 */
export async function recognizeDish(input) {
  const name = (process.env.RECOGNITION_PROVIDER || 'mock').toLowerCase();
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`Unknown RECOGNITION_PROVIDER "${name}".`);
  }
  return provider(input);
}
