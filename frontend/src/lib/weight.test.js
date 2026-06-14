import { describe, it, expect, beforeEach } from 'vitest';
import {
  kgToUnit,
  unitToKg,
  getUnit,
  setUnit,
  addWeight,
  getWeights,
  deleteWeight,
  clearWeights,
  weightStats,
  chronological,
  chartPoints,
} from './weight.js';

beforeEach(() => {
  clearWeights();
  setUnit('kg');
});

describe('unit conversion', () => {
  it('round-trips kg <-> lb', () => {
    expect(kgToUnit(100, 'kg')).toBe(100);
    expect(kgToUnit(100, 'lb')).toBeCloseTo(220.462, 2);
    expect(unitToKg(220.462, 'lb')).toBeCloseTo(100, 2);
    expect(unitToKg(80, 'kg')).toBe(80);
  });
});

describe('unit preference', () => {
  it('defaults to kg and persists a valid unit', () => {
    expect(getUnit()).toBe('kg');
    expect(setUnit('lb')).toBe('lb');
    expect(getUnit()).toBe('lb');
  });
  it('ignores invalid units', () => {
    setUnit('lb');
    setUnit('stone');
    expect(getUnit()).toBe('lb');
  });
});

describe('addWeight', () => {
  it('stores a rounded kg value, newest first', () => {
    addWeight({ kg: 80.04, timestamp: '2026-06-10T08:00:00' });
    addWeight({ kg: 79.5, timestamp: '2026-06-12T08:00:00' });
    const all = getWeights();
    expect(all).toHaveLength(2);
    expect(all[0].kg).toBe(79.5); // newest first
    expect(all[1].kg).toBe(80); // 80.04 -> 80
  });

  it('replaces the entry for the same calendar day', () => {
    addWeight({ kg: 81, timestamp: '2026-06-12T08:00:00' });
    addWeight({ kg: 80.6, timestamp: '2026-06-12T20:00:00' });
    const all = getWeights();
    expect(all).toHaveLength(1);
    expect(all[0].kg).toBe(80.6);
  });

  it('ignores non-positive or non-numeric values', () => {
    addWeight({ kg: 0 });
    addWeight({ kg: -5 });
    addWeight({ kg: 'abc' });
    expect(getWeights()).toHaveLength(0);
  });

  it('deletes by id', () => {
    addWeight({ kg: 80, timestamp: '2026-06-10T08:00:00' });
    addWeight({ kg: 79, timestamp: '2026-06-11T08:00:00' });
    const id = getWeights()[0].id;
    const remaining = deleteWeight(id);
    expect(remaining).toHaveLength(1);
  });
});

describe('weightStats', () => {
  it('returns null with no data', () => {
    expect(weightStats([])).toBeNull();
  });
  it('computes latest and changes', () => {
    const w = [
      { id: 'a', timestamp: '2026-06-10T08:00:00', kg: 82 },
      { id: 'b', timestamp: '2026-06-11T08:00:00', kg: 81 },
      { id: 'c', timestamp: '2026-06-12T08:00:00', kg: 80.5 },
    ];
    const s = weightStats(w);
    expect(s.latest).toBe(80.5);
    expect(s.changeSinceStart).toBe(-1.5); // 80.5 - 82
    expect(s.changeSincePrevious).toBe(-0.5); // 80.5 - 81
    expect(s.count).toBe(3);
  });
});

describe('chronological & chartPoints', () => {
  const w = [
    { id: 'c', timestamp: '2026-06-12T08:00:00', kg: 80 },
    { id: 'a', timestamp: '2026-06-10T08:00:00', kg: 82 },
    { id: 'b', timestamp: '2026-06-11T08:00:00', kg: 81 },
  ];
  it('sorts oldest first', () => {
    expect(chronological(w).map((e) => e.kg)).toEqual([82, 81, 80]);
  });
  it('maps points left->right, higher weight higher up (smaller y)', () => {
    const pts = chartPoints(w, 100, 100, 0);
    expect(pts).toHaveLength(3);
    expect(pts[0].x).toBe(0); // oldest at left
    expect(pts[2].x).toBe(100); // newest at right
    expect(pts[0].y).toBe(0); // 82 = max -> top
    expect(pts[2].y).toBe(100); // 80 = min -> bottom
  });
  it('centers a single point', () => {
    const pts = chartPoints([{ id: 'x', timestamp: '2026-06-12', kg: 80 }], 100, 100, 0);
    expect(pts[0].x).toBe(50);
  });
  it('returns [] for no data', () => {
    expect(chartPoints([], 100, 100)).toEqual([]);
  });
});
