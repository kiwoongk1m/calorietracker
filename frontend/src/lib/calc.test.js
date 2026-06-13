import { describe, it, expect } from 'vitest';
import { calculateNutrition } from './calc.js';

const per100g = { kcal: 160, protein: 6.5, carbs: 18, fat: 7 };

describe('calculateNutrition', () => {
  it('uses the weighed path when grams are supplied', () => {
    const out = calculateNutrition({ per100g, grams: 250, defaultServingGrams: 300 });
    expect(out.basis).toBe('weighed');
    expect(out.grams).toBe(250);
    expect(out.kcal).toBe(400); // 160 * 2.5
    expect(out.protein).toBe(16.3); // 6.5 * 2.5 = 16.25 -> 16.3
    expect(out.carbs).toBe(45); // 18 * 2.5
    expect(out.fat).toBe(17.5); // 7 * 2.5
  });

  it('falls back to the serving path when grams are absent', () => {
    const out = calculateNutrition({ per100g, defaultServingGrams: 300 });
    expect(out.basis).toBe('serving');
    expect(out.grams).toBe(300);
    expect(out.kcal).toBe(480); // 160 * 3
  });

  it('treats zero, negative, and non-numeric grams as "no weight"', () => {
    for (const grams of [0, -50, NaN, Infinity, '250', null]) {
      const out = calculateNutrition({ per100g, grams, defaultServingGrams: 200 });
      expect(out.basis).toBe('serving');
      expect(out.grams).toBe(200);
    }
  });

  it('handles a very small weight', () => {
    const out = calculateNutrition({ per100g, grams: 1 });
    expect(out.basis).toBe('weighed');
    expect(out.kcal).toBe(2); // 160 * 0.01 = 1.6 -> 2
    expect(out.protein).toBe(0.1); // 0.065 -> 0.1
  });

  it('handles a very large weight', () => {
    const out = calculateNutrition({ per100g, grams: 5000 });
    expect(out.basis).toBe('weighed');
    expect(out.kcal).toBe(8000); // 160 * 50
    expect(out.carbs).toBe(900); // 18 * 50
  });

  it('rounds kcal to whole numbers and macros to one decimal', () => {
    const out = calculateNutrition({
      per100g: { kcal: 123.456, protein: 1.234, carbs: 2.345, fat: 3.456 },
      grams: 100,
    });
    expect(out.kcal).toBe(123);
    expect(out.protein).toBe(1.2);
    expect(out.carbs).toBe(2.3);
    expect(out.fat).toBe(3.5);
  });

  it('throws when per100g is missing', () => {
    expect(() => calculateNutrition({ grams: 100 })).toThrow(/per100g/);
  });

  it('throws when neither a positive grams nor defaultServingGrams is available', () => {
    expect(() => calculateNutrition({ per100g })).toThrow(/positive grams/);
    expect(() => calculateNutrition({ per100g, grams: 0 })).toThrow(/positive grams/);
  });
});
