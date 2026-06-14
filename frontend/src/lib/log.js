// ---------------------------------------------------------------------------
// Meal log + daily intake tracking.
//
// Entries are persisted client-side (localStorage) so there is no auth/DB to
// stand up and it works offline and inside the Android WebView. Storage I/O is
// isolated in ./storage.js; the grouping/summing logic is pure and unit-tested.
// A future cloud-sync backend can replace that module without touching callers.
//
// Entry shape:
//   { id, timestamp, name, fdcId?, grams, basis, kcal, protein, carbs, fat }
// ---------------------------------------------------------------------------

import { storage, newId } from './storage.js';

const ENTRIES_KEY = 'calorie-snap.log.v1';
const GOAL_KEY = 'calorie-snap.goal.v1';
const DEFAULT_GOAL = 2000;

// --- pure helpers (unit-tested) ---------------------------------------------

/** Local-timezone calendar day key, e.g. "2026-06-13". Pure. */
export function dayKey(timestamp) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const round1 = (n) => Math.round(n * 10) / 10;

/** Sum calories + macros across entries. Pure. */
export function sumNutrition(entries = []) {
  const total = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + (Number(e.kcal) || 0),
      protein: acc.protein + (Number(e.protein) || 0),
      carbs: acc.carbs + (Number(e.carbs) || 0),
      fat: acc.fat + (Number(e.fat) || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  return {
    kcal: Math.round(total.kcal),
    protein: round1(total.protein),
    carbs: round1(total.carbs),
    fat: round1(total.fat),
  };
}

/**
 * Group entries by calendar day, newest day first and newest entry first within
 * a day, each day carrying its summed totals. Pure.
 * @returns {Array<{day:string, entries:object[], totals:object}>}
 */
export function groupByDay(entries = []) {
  const byDay = new Map();
  for (const e of entries) {
    const key = dayKey(e.timestamp);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(e);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // day desc
    .map(([day, list]) => {
      const sorted = [...list].sort((a, b) =>
        a.timestamp < b.timestamp ? 1 : -1
      );
      return { day, entries: sorted, totals: sumNutrition(sorted) };
    });
}

// --- persisted operations ---------------------------------------------------

export function getEntries() {
  try {
    const raw = storage().getItem(ENTRIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEntries(entries) {
  storage().setItem(ENTRIES_KEY, JSON.stringify(entries));
}

/**
 * Append a meal to the log. Fills in id + timestamp if absent. Returns the
 * stored entry.
 */
export function addEntry(entry) {
  const stored = {
    id: entry.id || newId(),
    timestamp: entry.timestamp || new Date().toISOString(),
    name: entry.name || 'Unknown dish',
    fdcId: entry.fdcId,
    grams: entry.grams,
    basis: entry.basis,
    kcal: entry.kcal,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
  };
  const all = getEntries();
  all.push(stored);
  writeEntries(all);
  return stored;
}

/** Remove an entry by id. Returns the remaining entries. */
export function deleteEntry(id) {
  const remaining = getEntries().filter((e) => e.id !== id);
  writeEntries(remaining);
  return remaining;
}

export function clearAll() {
  storage().removeItem(ENTRIES_KEY);
}

/** Today's summed totals. */
export function getTodayTotals(now = new Date()) {
  const today = dayKey(now);
  return sumNutrition(getEntries().filter((e) => dayKey(e.timestamp) === today));
}

// --- daily goal -------------------------------------------------------------

export function getGoal() {
  const raw = storage().getItem(GOAL_KEY);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_GOAL;
}

export function setGoal(value) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) {
    storage().setItem(GOAL_KEY, String(Math.round(n)));
  }
  return getGoal();
}
