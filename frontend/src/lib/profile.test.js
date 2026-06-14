import { describe, it, expect, beforeEach } from 'vitest';
import {
  bmr,
  tdee,
  recommendedCalories,
  getProfile,
  setProfile,
} from './profile.js';

// A 30yo, 180cm, 80kg male.
const male = { sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'maintain' };
// A 30yo, 165cm, 65kg female.
const female = { sex: 'female', age: 30, heightCm: 165, weightKg: 65, activity: 'sedentary', goal: 'lose' };

describe('bmr (Mifflin-St Jeor)', () => {
  it('computes male BMR', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(bmr(male)).toBe(1780);
  });
  it('computes female BMR', () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 650 + 1031.25 - 150 - 161 = 1370.25
    expect(bmr(female)).toBeCloseTo(1370.25, 2);
  });
  it('returns null for incomplete input', () => {
    expect(bmr({ sex: 'male', age: 0, heightCm: 180, weightKg: 80 })).toBeNull();
    expect(bmr({})).toBeNull();
  });
});

describe('tdee', () => {
  it('applies the activity factor', () => {
    expect(tdee(male)).toBeCloseTo(1780 * 1.55, 2); // moderate
  });
  it('is null when the profile is incomplete', () => {
    expect(tdee({ ...male, weightKg: '' })).toBeNull();
  });
});

describe('recommendedCalories', () => {
  it('maintain ≈ TDEE, rounded to nearest 10', () => {
    expect(recommendedCalories(male)).toBe(Math.round((1780 * 1.55) / 10) * 10); // 2760
  });
  it('subtracts ~500 for weight loss', () => {
    const maintain = recommendedCalories({ ...male, goal: 'maintain' });
    const lose = recommendedCalories({ ...male, goal: 'lose' });
    expect(maintain - lose).toBe(500);
  });
  it('adds ~500 for weight gain', () => {
    const maintain = recommendedCalories({ ...male, goal: 'maintain' });
    const gain = recommendedCalories({ ...male, goal: 'gain' });
    expect(gain - maintain).toBe(500);
  });
  it('floors at a safe minimum', () => {
    const tiny = { sex: 'female', age: 80, heightCm: 150, weightKg: 40, activity: 'sedentary', goal: 'lose' };
    expect(recommendedCalories(tiny)).toBe(1200);
  });
  it('is null when incomplete', () => {
    expect(recommendedCalories({ ...male, age: '' })).toBeNull();
  });
});

describe('persistence', () => {
  beforeEach(() => setProfile({ sex: 'male', age: '', heightCm: '', weightKg: '', activity: 'moderate', goal: 'maintain' }));
  it('round-trips a profile', () => {
    setProfile(male);
    expect(getProfile()).toMatchObject(male);
  });
  it('fills defaults for missing keys', () => {
    setProfile({ age: 25 });
    const p = getProfile();
    expect(p.age).toBe(25);
    expect(p.activity).toBe('moderate'); // default
    expect(p.sex).toBe('male'); // default
  });
});
