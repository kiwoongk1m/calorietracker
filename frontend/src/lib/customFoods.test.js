import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCustomFoods,
  addCustomFood,
  removeCustomFood,
  clearCustomFoods,
  customToNutrition,
} from './customFoods.js';

beforeEach(() => clearCustomFoods());

describe('customFoods', () => {
  it('adds a custom food (newest first) requiring name + positive kcal', () => {
    addCustomFood({ name: "Grandma's stew", kcal: 420, protein: 25, carbs: 30, fat: 18 });
    const list = getCustomFoods();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Grandma's stew", kcal: 420, protein: 25 });
    expect(list[0].id).toBeTruthy();
  });

  it('rejects empty name or non-positive calories', () => {
    addCustomFood({ name: '', kcal: 100 });
    addCustomFood({ name: 'x', kcal: 0 });
    expect(getCustomFoods()).toHaveLength(0);
  });

  it('replaces a same-name food instead of duplicating', () => {
    addCustomFood({ name: 'Smoothie', kcal: 200 });
    addCustomFood({ name: 'smoothie', kcal: 250 }); // same name, new value
    const list = getCustomFoods();
    expect(list).toHaveLength(1);
    expect(list[0].kcal).toBe(250);
  });

  it('removes by id', () => {
    addCustomFood({ name: 'A', kcal: 100 });
    addCustomFood({ name: 'B', kcal: 200 });
    const id = getCustomFoods()[0].id;
    const remaining = removeCustomFood(id);
    expect(remaining).toHaveLength(1);
  });

  it('converts to a custom meal-item nutrition shape', () => {
    const n = customToNutrition({ name: 'Pie', kcal: 300, protein: 4, carbs: 40, fat: 14 });
    expect(n).toMatchObject({
      name: 'Pie',
      fdcId: null,
      custom: true,
      per100g: { kcal: 300, protein: 4, carbs: 40, fat: 14 },
    });
  });
});
