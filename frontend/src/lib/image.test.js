import { describe, it, expect } from 'vitest';
import { fitWithin, MAX_EDGE } from './image.js';

describe('fitWithin', () => {
  it('leaves an already-small image unchanged', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('never upscales a tiny image', () => {
    expect(fitWithin(100, 50)).toEqual({ width: 100, height: 50 });
  });

  it('caps a large landscape image to MAX_EDGE on the long side', () => {
    const out = fitWithin(4000, 3000);
    expect(out.width).toBe(MAX_EDGE);
    expect(out.height).toBe(Math.round(3000 * (MAX_EDGE / 4000)));
    expect(Math.max(out.width, out.height)).toBe(MAX_EDGE);
  });

  it('caps a large portrait image to MAX_EDGE on the long side', () => {
    const out = fitWithin(3000, 4000);
    expect(out.height).toBe(MAX_EDGE);
    expect(Math.max(out.width, out.height)).toBe(MAX_EDGE);
  });

  it('preserves aspect ratio within rounding', () => {
    const out = fitWithin(4000, 2000);
    expect(out.width / out.height).toBeCloseTo(2, 1);
  });

  it('honors a custom maxEdge', () => {
    expect(fitWithin(2000, 1000, 500)).toEqual({ width: 500, height: 250 });
  });

  it('handles zero dimensions without dividing by zero', () => {
    expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 });
  });
});
