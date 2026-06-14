// ---------------------------------------------------------------------------
// Body-weight tracking. Weights are stored canonically in kilograms (with a
// separate display-unit preference), one entry per calendar day — logging again
// on the same day replaces that day's value. Persisted client-side via
// ./storage.js, same as the meal log. Pure helpers (conversion, stats, chart
// scaling) are unit-tested.
//
// Entry shape: { id, timestamp, kg }
// ---------------------------------------------------------------------------

import { storage, newId } from './storage.js';
import { dayKey } from './log.js';

const WEIGHTS_KEY = 'calorie-snap.weights.v1';
const UNIT_KEY = 'calorie-snap.weight-unit.v1';
const LB_PER_KG = 2.2046226218;

const round1 = (n) => Math.round(n * 10) / 10;

// --- unit conversion (pure) -------------------------------------------------
export function kgToUnit(kg, unit) {
  return unit === 'lb' ? kg * LB_PER_KG : kg;
}
export function unitToKg(value, unit) {
  return unit === 'lb' ? value / LB_PER_KG : value;
}

// --- unit preference --------------------------------------------------------
export function getUnit() {
  return storage().getItem(UNIT_KEY) === 'lb' ? 'lb' : 'kg';
}
export function setUnit(unit) {
  if (unit === 'kg' || unit === 'lb') storage().setItem(UNIT_KEY, unit);
  return getUnit();
}

// --- persisted operations ---------------------------------------------------
export function getWeights() {
  try {
    const raw = storage().getItem(WEIGHTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWeights(list) {
  storage().setItem(WEIGHTS_KEY, JSON.stringify(list));
}

/**
 * Record a weight in kilograms for a day (defaults to now). One entry per
 * calendar day — a second log on the same day replaces the first. Ignores
 * non-positive values. Returns the full list, newest first.
 */
export function addWeight({ kg, timestamp } = {}) {
  const value = Number(kg);
  if (!Number.isFinite(value) || value <= 0) return getWeights();
  const ts = timestamp || new Date().toISOString();
  const day = dayKey(ts);
  const list = getWeights().filter((e) => dayKey(e.timestamp) !== day);
  list.push({ id: newId(), timestamp: ts, kg: round1(value) });
  list.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)); // newest first
  writeWeights(list);
  return list;
}

export function deleteWeight(id) {
  const remaining = getWeights().filter((e) => e.id !== id);
  writeWeights(remaining);
  return remaining;
}

export function clearWeights() {
  storage().removeItem(WEIGHTS_KEY);
}

// --- pure derived data ------------------------------------------------------
/** Oldest-first copy, for charting and stats. Pure. */
export function chronological(weights = []) {
  return [...weights].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
}

/** Latest weight + change since start / previous entry (all kg). Pure. */
export function weightStats(weights = []) {
  const chrono = chronological(weights);
  if (chrono.length === 0) return null;
  const latest = chrono[chrono.length - 1].kg;
  const first = chrono[0].kg;
  const previous = chrono.length > 1 ? chrono[chrono.length - 2].kg : null;
  return {
    latest,
    first,
    changeSinceStart: round1(latest - first),
    changeSincePrevious: previous != null ? round1(latest - previous) : null,
    count: chrono.length,
  };
}

/**
 * Map weights to {x, y, kg} points within a width×height box (oldest→newest,
 * left→right; higher weight → higher up). Pure, for the SVG sparkline.
 */
export function chartPoints(weights, width, height, pad = 8) {
  const chrono = chronological(weights);
  if (chrono.length === 0) return [];
  const kgs = chrono.map((e) => e.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const range = max - min || 1;
  const n = chrono.length;
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;
  return chrono.map((e, i) => ({
    x: round1(n === 1 ? width / 2 : pad + (i / (n - 1)) * innerW),
    y: round1(pad + (1 - (e.kg - min) / range) * innerH),
    kg: e.kg,
  }));
}

// --- time-ranged views ------------------------------------------------------

const DAY_MS = 86400000;

export const WEIGHT_RANGES = [
  { id: '1W', label: '1W', days: 7 },
  { id: '1M', label: '1M', days: 30 },
  { id: '3M', label: '3M', days: 90 },
  { id: '1Y', label: '1Y', days: 365 },
];

/** Entries within the last `days` (null = all). Pure given `now`. */
export function weightsInRange(weights = [], days, now = Date.now()) {
  if (!days) return [...weights];
  const cutoff = now - days * DAY_MS;
  return weights.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
}

/** Summary stats over a set of weigh-ins (all kg). Pure. null if empty. */
export function rangeStats(weights = []) {
  const chrono = chronological(weights);
  if (chrono.length === 0) return null;
  const kgs = chrono.map((e) => e.kg);
  const latest = chrono[chrono.length - 1].kg;
  const first = chrono[0].kg;
  return {
    count: chrono.length,
    first,
    latest,
    change: round1(latest - first),
    min: Math.min(...kgs),
    max: Math.max(...kgs),
    avg: round1(kgs.reduce((a, b) => a + b, 0) / kgs.length),
  };
}

/**
 * Time-mapped chart series: x positioned by actual timestamp (so gaps in
 * logging show as gaps), y by weight within [min, max]. Returns the points plus
 * the min/max and first/last timestamps for axis labels. Pure.
 */
export function chartSeries(weights, width, height, pad = 12) {
  const chrono = chronological(weights);
  if (chrono.length === 0) {
    return { points: [], min: null, max: null, firstTs: null, lastTs: null };
  }
  const kgs = chrono.map((e) => e.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const range = max - min || 1;
  const t0 = new Date(chrono[0].timestamp).getTime();
  const t1 = new Date(chrono[chrono.length - 1].timestamp).getTime();
  const tspan = t1 - t0 || 1;
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;
  const points = chrono.map((e) => {
    const t = new Date(e.timestamp).getTime();
    const x =
      chrono.length === 1 ? width / 2 : pad + ((t - t0) / tspan) * innerW;
    const y = pad + (1 - (e.kg - min) / range) * innerH;
    return { x: round1(x), y: round1(y), kg: e.kg, timestamp: e.timestamp };
  });
  return {
    points,
    min,
    max,
    firstTs: chrono[0].timestamp,
    lastTs: chrono[chrono.length - 1].timestamp,
  };
}
