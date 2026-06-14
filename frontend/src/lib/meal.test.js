import { describe, it, expect } from 'vitest';
import { mealItemResult, sumMeal, PORTIONS } from './meal.js';

const usda = (over = {}) => ({
  state: 'ready',
  portion: 1,
  grams: '',
  nutrition: {
    per100g: { kcal: 200, protein: 10, carbs: 20, fat: 8 },
    defaultServingGrams: 100,
  },
  ...over,
});

const custom = (over = {}) => ({
  state: 'ready',
  portion: 1,
  nutrition: {
    custom: true,
    per100g: { kcal: 400, protein: 25, carbs: 30, fat: 18 },
  },
  ...over,
});

describe('mealItemResult', () => {
  it('returns null for a non-ready item', () => {
    expect(mealItemResult({ state: 'loading' })).toBeNull();
  });

  it('USDA: uses the default serving at portion 1', () => {
    const r = mealItemResult(usda());
    expect(r).toMatchObject({ grams: 100, basis: 'serving', kcal: 200 });
  });

  it('USDA: scales by the portion multiplier', () => {
    const r = mealItemResult(usda({ portion: 0.5 }));
    expect(r.kcal).toBe(100);
    expect(r.grams).toBe(50);
    expect(r.protein).toBe(5);
  });

  it('USDA: weighed grams override the serving, then scale by portion', () => {
    const r = mealItemResult(usda({ grams: '150', portion: 2 }));
    expect(r.basis).toBe('weighed');
    expect(r.grams).toBe(300); // 150 * 2
    expect(r.kcal).toBe(600); // 200/100 * 150 * 2
  });

  it('custom: uses the per-serving estimate, no grams, scaled by portion', () => {
    const r = mealItemResult(custom({ portion: 0.5 }));
    expect(r).toMatchObject({ grams: null, basis: 'estimate', kcal: 200 });
    expect(r.protein).toBe(12.5);
  });
});

describe('sumMeal', () => {
  it('sums results and skips nulls', () => {
    const total = sumMeal([
      mealItemResult(usda()),
      mealItemResult(custom()),
      null,
    ]);
    expect(total.kcal).toBe(600); // 200 + 400
    expect(total.protein).toBe(35); // 10 + 25
  });
});

describe('PORTIONS', () => {
  it('includes 1 and common fractions', () => {
    const values = PORTIONS.map((p) => p.value);
    expect(values).toContain(1);
    expect(values).toContain(0.5);
    expect(PORTIONS.find((p) => p.label === '½').value).toBe(0.5);
  });
});
