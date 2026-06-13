// Unit tests for the USDA provider's PURE logic — no network, no key.
// Covers cooked-vs-raw preference, best-match selection, nutrient mapping into
// the contract shape, and default-serving estimation.

import { describe, it, expect } from 'vitest';
import {
  scoreFood,
  selectBestFood,
  mapFoodToNutrition,
  estimateServingGrams,
} from './usda.js';

function food(description, opts = {}) {
  return {
    fdcId: opts.fdcId ?? 1,
    description,
    dataType: opts.dataType ?? 'SR Legacy',
    servingSize: opts.servingSize,
    servingSizeUnit: opts.servingSizeUnit,
    foodNutrients: opts.foodNutrients ?? [],
  };
}

describe('scoreFood — cooked vs raw', () => {
  it('prefers a cooked entry over a raw one for the same dish', () => {
    const cooked = food('Chicken breast, grilled, cooked');
    const raw = food('Chicken breast, raw');
    expect(scoreFood(cooked, 'grilled chicken breast')).toBeGreaterThan(
      scoreFood(raw, 'grilled chicken breast')
    );
  });

  it('rewards exact description match', () => {
    const exact = food('margherita pizza');
    const partial = food('pizza, cheese, with extra toppings');
    expect(scoreFood(exact, 'margherita pizza')).toBeGreaterThan(
      scoreFood(partial, 'margherita pizza')
    );
  });

  it('returns -Infinity for an empty/invalid food', () => {
    expect(scoreFood(null, 'x')).toBe(-Infinity);
    expect(scoreFood({ description: '' }, 'x')).toBe(-Infinity);
  });
});

describe('selectBestFood', () => {
  it('picks the cooked entry from a mixed result set', () => {
    const foods = [
      food('Chicken, broilers or fryers, breast, meat only, raw'),
      food('Chicken, broilers or fryers, breast, meat only, cooked, roasted'),
      food('Chicken spread, canned'),
    ];
    const best = selectBestFood(foods, 'chicken breast');
    expect(best.description).toContain('cooked');
  });

  it('returns null for an empty result set', () => {
    expect(selectBestFood([], 'x')).toBeNull();
    expect(selectBestFood(undefined, 'x')).toBeNull();
  });
});

describe('mapFoodToNutrition', () => {
  it('maps USDA nutrient numbers into the per-100g contract', () => {
    const f = food('Spaghetti, cooked', {
      fdcId: 9999,
      foodNutrients: [
        { nutrientNumber: '208', value: 158 },
        { nutrientNumber: '203', value: 5.8 },
        { nutrientNumber: '205', value: 30.9 },
        { nutrientNumber: '204', value: 0.93 },
      ],
    });
    const out = mapFoodToNutrition(f);
    expect(out).toEqual({
      fdcId: '9999',
      name: 'Spaghetti, cooked',
      per100g: { kcal: 158, protein: 5.8, carbs: 30.9, fat: 0.9 },
      defaultServingGrams: 200,
    });
  });

  it('treats missing nutrients as zero', () => {
    const out = mapFoodToNutrition(food('Mystery food', { foodNutrients: [] }));
    expect(out.per100g).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('reads nutrients from the nested nutrient.number shape too', () => {
    const f = food('Rice, cooked', {
      foodNutrients: [{ nutrient: { number: '208' }, amount: 130 }],
    });
    expect(mapFoodToNutrition(f).per100g.kcal).toBe(130);
  });
});

describe('estimateServingGrams', () => {
  it('uses USDA gram serving size when present', () => {
    expect(estimateServingGrams(food('x', { servingSize: 140, servingSizeUnit: 'g' }))).toBe(140);
  });

  it('ignores non-gram serving units and falls back', () => {
    expect(estimateServingGrams(food('x', { servingSize: 1, servingSizeUnit: 'cup' }))).toBe(200);
  });

  it('falls back to a generic serving when no metadata', () => {
    expect(estimateServingGrams(food('x'))).toBe(200);
  });
});
