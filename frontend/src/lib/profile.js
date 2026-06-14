// ---------------------------------------------------------------------------
// User profile + daily calorie target estimation.
//
// Stores body stats (sex, age, height, weight) canonically (cm + kg), plus an
// activity level and a weight goal, and estimates a recommended daily calorie
// intake using the Mifflin-St Jeor BMR × an activity factor, adjusted for the
// goal. Persisted client-side via ./storage.js. The math helpers are pure and
// unit-tested.
// ---------------------------------------------------------------------------

import { storage } from './storage.js';

const PROFILE_KEY = 'calorie-snap.profile.v1';

export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary — little or no exercise', factor: 1.2 },
  { id: 'light', label: 'Light — 1–3 days/week', factor: 1.375 },
  { id: 'moderate', label: 'Moderate — 3–5 days/week', factor: 1.55 },
  { id: 'active', label: 'Active — 6–7 days/week', factor: 1.725 },
  { id: 'athlete', label: 'Very active — hard exercise / physical job', factor: 1.9 },
];

// Goal adjustment in kcal/day (~500 ≈ 0.45 kg / 1 lb per week).
export const GOALS = [
  { id: 'lose', label: 'Lose weight', delta: -500 },
  { id: 'maintain', label: 'Maintain weight', delta: 0 },
  { id: 'gain', label: 'Gain weight', delta: 500 },
];

const DEFAULT_PROFILE = {
  sex: 'male', // 'male' | 'female'
  age: '',
  heightCm: '',
  weightKg: '',
  activity: 'moderate',
  goal: 'maintain',
};

export function getProfile() {
  try {
    const raw = storage().getItem(PROFILE_KEY);
    const p = raw ? JSON.parse(raw) : null;
    return { ...DEFAULT_PROFILE, ...(p && typeof p === 'object' ? p : {}) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function setProfile(profile) {
  storage().setItem(PROFILE_KEY, JSON.stringify(profile));
  return getProfile();
}

function activityFactor(activity) {
  return (ACTIVITY_LEVELS.find((a) => a.id === activity) || {}).factor || 1.2;
}
function goalDelta(goal) {
  return (GOALS.find((g) => g.id === goal) || {}).delta || 0;
}

/**
 * Mifflin-St Jeor basal metabolic rate (kcal/day). Pure.
 * Returns null if age/height/weight aren't all positive numbers.
 */
export function bmr({ sex, age, heightCm, weightKg } = {}) {
  const a = Number(age);
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!(a > 0 && h > 0 && w > 0)) return null;
  const base = 10 * w + 6.25 * h - 5 * a;
  return sex === 'female' ? base - 161 : base + 5;
}

/** Total daily energy expenditure (BMR × activity). Pure. null if incomplete. */
export function tdee(profile) {
  const b = bmr(profile);
  return b == null ? null : b * activityFactor(profile.activity);
}

/**
 * Recommended daily calories = TDEE + goal delta, rounded to the nearest 10 and
 * floored at a safe minimum (1500 kcal male / 1200 female). Pure. null if the
 * profile is incomplete.
 */
export function recommendedCalories(profile) {
  const t = tdee(profile);
  if (t == null) return null;
  const target = t + goalDelta(profile.goal);
  const floor = profile?.sex === 'female' ? 1200 : 1500;
  return Math.max(floor, Math.round(target / 10) * 10);
}
