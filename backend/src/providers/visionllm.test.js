// Unit tests for the vision-LLM provider's PURE logic — no network, no key.
// Verifies data-URL parsing, JSON extraction from model output, and the
// validation/normalization that gates the unrecognized fallback.

import { describe, it, expect } from 'vitest';
import {
  parseImagePayload,
  extractJsonObject,
  normalizeRecognition,
} from './visionllm.js';

const UNRECOGNIZED = Object.freeze({
  items: [],
  unrecognized: true,
});

describe('parseImagePayload', () => {
  it('parses a base64 data URL into mediaType + data', () => {
    const out = parseImagePayload('data:image/png;base64,AAAABBBB');
    expect(out).toEqual({ mediaType: 'image/png', data: 'AAAABBBB' });
  });

  it('treats a bare base64 string as image/jpeg', () => {
    const out = parseImagePayload('/9j/4AAQSkZJRg==');
    expect(out).toEqual({ mediaType: 'image/jpeg', data: '/9j/4AAQSkZJRg==' });
  });

  it('rejects unsupported media types', () => {
    expect(parseImagePayload('data:image/tiff;base64,AAAA')).toBeNull();
  });

  it('rejects non-base64 data URLs', () => {
    expect(parseImagePayload('data:image/png,not-base64')).toBeNull();
  });

  it('rejects empty / non-string input', () => {
    expect(parseImagePayload('')).toBeNull();
    expect(parseImagePayload('   ')).toBeNull();
    expect(parseImagePayload(null)).toBeNull();
    expect(parseImagePayload(undefined)).toBeNull();
  });
});

describe('extractJsonObject', () => {
  it('parses clean JSON', () => {
    expect(extractJsonObject('{"label":"pizza"}')).toEqual({ label: 'pizza' });
  });

  it('extracts JSON wrapped in prose / code fences', () => {
    const text = 'Here you go:\n```json\n{"label":"tacos","confidence":0.7}\n```';
    expect(extractJsonObject(text)).toEqual({ label: 'tacos', confidence: 0.7 });
  });

  it('handles braces inside strings', () => {
    expect(extractJsonObject('{"label":"a {weird} dish"}')).toEqual({
      label: 'a {weird} dish',
    });
  });

  it('returns null when there is no JSON object', () => {
    expect(extractJsonObject('no json here')).toBeNull();
    expect(extractJsonObject('')).toBeNull();
  });
});

describe('normalizeRecognition', () => {
  it('accepts multiple confident items, lowercased and deduped, order kept', () => {
    const out = normalizeRecognition(
      {
        isFood: true,
        items: [
          { label: 'Grilled Chicken Breast', confidence: 0.9 },
          { label: 'White Rice', confidence: 0.8 },
          { label: 'grilled chicken breast', confidence: 0.7 }, // dup
        ],
      },
      UNRECOGNIZED
    );
    expect(out.unrecognized).toBe(false);
    expect(out.items).toEqual([
      { label: 'grilled chicken breast', confidence: 0.9 },
      { label: 'white rice', confidence: 0.8 },
    ]);
  });

  it('drops items at/under the confidence floor, keeps the rest', () => {
    const out = normalizeRecognition(
      {
        isFood: true,
        items: [
          { label: 'caesar salad', confidence: 0.8 },
          { label: 'mystery garnish', confidence: 0.1 },
        ],
      },
      UNRECOGNIZED
    );
    expect(out.items).toEqual([{ label: 'caesar salad', confidence: 0.8 }]);
  });

  it('clamps out-of-range / garbage confidence', () => {
    const out = normalizeRecognition(
      { isFood: true, items: [{ label: 'pho', confidence: 5 }] },
      UNRECOGNIZED
    );
    expect(out.items[0].confidence).toBe(1);
  });

  it('caps items at 6', () => {
    const items = Array.from({ length: 9 }, (_, i) => ({
      label: `food ${i}`,
      confidence: 0.9,
    }));
    const out = normalizeRecognition({ isFood: true, items }, UNRECOGNIZED);
    expect(out.items).toHaveLength(6);
  });

  it('tolerates the legacy single-{label} shape', () => {
    const out = normalizeRecognition(
      { isFood: true, label: 'Tacos', confidence: 0.8 },
      UNRECOGNIZED
    );
    expect(out.items).toEqual([{ label: 'tacos', confidence: 0.8 }]);
  });

  it('falls back to unrecognized when isFood is false', () => {
    const out = normalizeRecognition({ isFood: false, items: [] }, UNRECOGNIZED);
    expect(out.unrecognized).toBe(true);
    expect(out.items).toEqual([]);
  });

  it('falls back when no item clears the floor', () => {
    const out = normalizeRecognition(
      { isFood: true, items: [{ label: 'blur', confidence: 0.05 }] },
      UNRECOGNIZED
    );
    expect(out.unrecognized).toBe(true);
  });

  it('falls back on null / non-object input', () => {
    expect(normalizeRecognition(null, UNRECOGNIZED).unrecognized).toBe(true);
    expect(normalizeRecognition('nope', UNRECOGNIZED).unrecognized).toBe(true);
  });
});
