import { describe, it, expect, beforeEach } from 'vitest';
import {
  dayKey,
  sumNutrition,
  groupByDay,
  groupIntoMeals,
  recentFoods,
  defaultMealType,
  addEntry,
  getEntries,
  deleteEntry,
  deleteMeal,
  clearAll,
  getTodayTotals,
  getGoal,
  setGoal,
} from './log.js';

// Tests run under the node env (no localStorage), so log.js uses its in-memory
// fallback. clearAll() resets it between tests.
beforeEach(() => {
  clearAll();
  setGoal(2000);
});

const meal = (over = {}) => ({
  name: 'Spaghetti carbonara',
  grams: 250,
  basis: 'weighed',
  kcal: 400,
  protein: 16.25,
  carbs: 45,
  fat: 17.5,
  ...over,
});

describe('dayKey', () => {
  it('formats a timestamp as a local YYYY-MM-DD key', () => {
    expect(dayKey('2026-06-13T10:00:00')).toBe('2026-06-13');
  });
  it('returns "unknown" for an invalid timestamp', () => {
    expect(dayKey('not-a-date')).toBe('unknown');
  });
});

describe('recentFoods', () => {
  it('returns distinct foods newest first, capped at the limit', () => {
    const entries = [
      { name: 'Apple', fdcId: '1', timestamp: '2026-06-14T08:00:00' },
      { name: 'Chicken', fdcId: '2', timestamp: '2026-06-14T12:00:00' },
      { name: 'apple', fdcId: '1', timestamp: '2026-06-14T18:00:00' }, // dup (case)
    ];
    const recent = recentFoods(entries, 8);
    expect(recent.map((r) => r.name)).toEqual(['apple', 'Chicken']);
  });
  it('respects the limit', () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({ name: `food ${i}`, fdcId: i }));
    expect(recentFoods(entries, 5)).toHaveLength(5);
  });
});

describe('defaultMealType', () => {
  it('maps hour of day to a meal type', () => {
    expect(defaultMealType(new Date('2026-06-14T08:00:00'))).toBe('breakfast');
    expect(defaultMealType(new Date('2026-06-14T13:00:00'))).toBe('lunch');
    expect(defaultMealType(new Date('2026-06-14T19:00:00'))).toBe('dinner');
    expect(defaultMealType(new Date('2026-06-14T23:30:00'))).toBe('snack');
  });
});

describe('groupIntoMeals', () => {
  it('groups entries that share a mealId into one meal with totals', () => {
    const meals = groupIntoMeals([
      { id: 'a', timestamp: '2026-06-14T12:00:00', mealId: 'm1', meal: 'lunch', kcal: 200, protein: 10, carbs: 20, fat: 5 },
      { id: 'b', timestamp: '2026-06-14T12:01:00', mealId: 'm1', meal: 'lunch', kcal: 300, protein: 5, carbs: 40, fat: 8 },
    ]);
    expect(meals).toHaveLength(1);
    expect(meals[0].mealId).toBe('m1');
    expect(meals[0].meal).toBe('lunch');
    expect(meals[0].entries).toHaveLength(2);
    expect(meals[0].totals.kcal).toBe(500);
  });

  it('treats entries without a mealId as their own single-item meals', () => {
    const meals = groupIntoMeals([
      { id: 'a', timestamp: '2026-06-14T09:00:00', kcal: 100 },
      { id: 'b', timestamp: '2026-06-14T10:00:00', kcal: 150 },
    ]);
    expect(meals).toHaveLength(2);
    expect(meals.every((m) => m.entries.length === 1)).toBe(true);
  });

  it('orders meals newest first', () => {
    const meals = groupIntoMeals([
      { id: 'a', timestamp: '2026-06-14T08:00:00', mealId: 'm1', kcal: 100 },
      { id: 'b', timestamp: '2026-06-14T19:00:00', mealId: 'm2', kcal: 200 },
    ]);
    expect(meals.map((m) => m.mealId)).toEqual(['m2', 'm1']);
  });
});

describe('sumNutrition', () => {
  it('sums and rounds calories (whole) and macros (1 dp)', () => {
    const out = sumNutrition([
      { kcal: 400, protein: 16.25, carbs: 45, fat: 17.5 },
      { kcal: 150, protein: 31, carbs: 0, fat: 3.6 },
    ]);
    expect(out).toEqual({ kcal: 550, protein: 47.3, carbs: 45, fat: 21.1 });
  });
  it('returns zeros for an empty list', () => {
    expect(sumNutrition([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe('groupByDay', () => {
  it('groups entries by day with per-day totals, newest day first', () => {
    const groups = groupByDay([
      { timestamp: '2026-06-12T08:00:00', kcal: 100, protein: 1, carbs: 2, fat: 3 },
      { timestamp: '2026-06-13T09:00:00', kcal: 200, protein: 4, carbs: 5, fat: 6 },
      { timestamp: '2026-06-13T12:00:00', kcal: 300, protein: 7, carbs: 8, fat: 9 },
    ]);
    expect(groups.map((g) => g.day)).toEqual(['2026-06-13', '2026-06-12']);
    expect(groups[0].totals.kcal).toBe(500);
    // newest entry first within the day
    expect(groups[0].entries[0].timestamp).toBe('2026-06-13T12:00:00');
  });
});

describe('add / get / delete', () => {
  it('adds an entry with a generated id and timestamp', () => {
    const stored = addEntry(meal());
    expect(stored.id).toBeTruthy();
    expect(stored.timestamp).toBeTruthy();
    expect(getEntries()).toHaveLength(1);
  });

  it('deletes an entry by id', () => {
    const a = addEntry(meal());
    addEntry(meal({ name: 'Grilled chicken' }));
    const remaining = deleteEntry(a.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('Grilled chicken');
  });

  it('persists mealId + meal type on an entry', () => {
    const stored = addEntry(meal({ mealId: 'm1', meal: 'dinner' }));
    expect(stored.mealId).toBe('m1');
    expect(stored.meal).toBe('dinner');
  });

  it('deleteMeal removes every entry in the meal, leaving others', () => {
    addEntry(meal({ name: 'Chicken', mealId: 'm1', meal: 'dinner' }));
    addEntry(meal({ name: 'Rice', mealId: 'm1', meal: 'dinner' }));
    addEntry(meal({ name: 'Apple', mealId: 'm2', meal: 'snack' }));
    const remaining = deleteMeal('m1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('Apple');
  });
});

describe('getTodayTotals', () => {
  it('counts only entries from the given day', () => {
    addEntry(meal({ timestamp: '2026-06-13T09:00:00', kcal: 200 }));
    addEntry(meal({ timestamp: '2026-06-13T18:00:00', kcal: 300 }));
    addEntry(meal({ timestamp: '2026-06-10T09:00:00', kcal: 999 }));
    expect(getTodayTotals(new Date('2026-06-13T20:00:00')).kcal).toBe(500);
  });
});

describe('goal', () => {
  it('defaults to 2000 and persists a valid new goal', () => {
    expect(getGoal()).toBe(2000);
    expect(setGoal(1800)).toBe(1800);
    expect(getGoal()).toBe(1800);
  });
  it('ignores invalid goals', () => {
    setGoal(1800);
    setGoal(-5);
    setGoal('abc');
    expect(getGoal()).toBe(1800);
  });
});
