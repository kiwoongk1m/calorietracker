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
  label: null,
  confidence: 0,
  candidates: [],
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
  it('accepts a confident food result and lowercases/dedupes candidates', () => {
    const out = normalizeRecognition(
      {
        isFood: true,
        label: 'Grilled Chicken Breast',
        confidence: 0.9,
        candidates: ['Roast Chicken', 'grilled chicken breast', 'Chicken Salad'],
      },
      UNRECOGNIZED
    );
    expect(out.label).toBe('grilled chicken breast');
    expect(out.confidence).toBe(0.9);
    // duplicate of label removed, rest lowercased
    expect(out.candidates).toEqual(['roast chicken', 'chicken salad']);
    expect(out.unrecognized).toBe(false);
  });

  it('falls back to unrecognized when isFood is false', () => {
    const out = normalizeRecognition(
      { isFood: false, label: null, confidence: 0, candidates: [] },
      UNRECOGNIZED
    );
    expect(out.unrecognized).toBe(true);
    expect(out.label).toBeNull();
  });

  it('falls back when confidence is at/under the floor', () => {
    const out = normalizeRecognition(
      { isFood: true, label: 'mystery stew', confidence: 0.1, candidates: [] },
      UNRECOGNIZED
    );
    expect(out.unrecognized).toBe(true);
  });

  it('falls back when label is missing', () => {
    const out = normalizeRecognition(
      { isFood: true, label: null, confidence: 0.95, candidates: ['x'] },
      UNRECOGNIZED
    );
    expect(out.unrecognized).toBe(true);
  });

  it('clamps out-of-range / garbage confidence', () => {
    const out = normalizeRecognition(
      { isFood: true, label: 'pho', confidence: 5, candidates: [] },
      UNRECOGNIZED
    );
    expect(out.confidence).toBe(1);
    expect(out.unrecognized).toBe(false);
  });

  it('caps candidates at 3', () => {
    const out = normalizeRecognition(
      {
        isFood: true,
        label: 'soup',
        confidence: 0.8,
        candidates: ['a', 'b', 'c', 'd', 'e'],
      },
      UNRECOGNIZED
    );
    expect(out.candidates).toHaveLength(3);
  });

  it('falls back on null / non-object input', () => {
    expect(normalizeRecognition(null, UNRECOGNIZED).unrecognized).toBe(true);
    expect(normalizeRecognition('nope', UNRECOGNIZED).unrecognized).toBe(true);
  });
});
