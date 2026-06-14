// Weight tracking view: current weight (with kg/lb toggle and count-up), trend
// sparkline, an input to log today's weight, and a deletable history list.
// Presentational — data + mutations come from App. Weights are stored in kg;
// this component converts to the chosen display unit.

import { useState } from 'react';
import { kgToUnit, unitToKg, weightStats, chartPoints } from '../lib/weight.js';
import { useCountUp } from '../hooks/useCountUp.js';

const CW = 320;
const CH = 110;
const PAD = 12;

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function ChangePill({ deltaUnit, unit }) {
  if (deltaUnit == null) return null;
  const dir = deltaUnit < -0.05 ? 'down' : deltaUnit > 0.05 ? 'up' : 'flat';
  const arrow = dir === 'down' ? '↓' : dir === 'up' ? '↑' : '→';
  return (
    <span className={`weight-change weight-change-${dir}`}>
      {arrow} {Math.abs(deltaUnit).toFixed(1)} {unit}
    </span>
  );
}

export default function WeightTracker({ weights, unit, onAdd, onDelete, onSetUnit }) {
  const [draft, setDraft] = useState('');
  const stats = weightStats(weights);
  const animated = useCountUp(stats ? kgToUnit(stats.latest, unit) : 0, {
    decimals: 1,
  });

  const pts = chartPoints(weights, CW, CH, PAD);
  const linePts = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath =
    pts.length >= 2
      ? `M ${pts[0].x},${CH - PAD} ` +
        pts.map((p) => `L ${p.x},${p.y}`).join(' ') +
        ` L ${pts[pts.length - 1].x},${CH - PAD} Z`
      : '';

  function submit(e) {
    e.preventDefault();
    const v = parseFloat(draft);
    if (Number.isFinite(v) && v > 0) {
      onAdd(unitToKg(v, unit));
      setDraft('');
    }
  }

  return (
    <section className="weight" aria-label="Weight tracking">
      <div className="weight-today">
        <div className="weight-today-head">
          <span className="weight-today-label">Current weight</span>
          <div className="unit-toggle" role="group" aria-label="Weight unit">
            {['kg', 'lb'].map((u) => (
              <button
                key={u}
                className={`unit-btn ${unit === u ? 'unit-btn-active' : ''}`}
                onClick={() => onSetUnit(u)}
                aria-pressed={unit === u}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {stats ? (
          <>
            <div className="weight-today-value">
              <span className="weight-kg">{animated.toFixed(1)}</span>
              <span className="weight-unit">{unit}</span>
            </div>
            {stats.count > 1 && (
              <div className="weight-deltas">
                <span className="weight-delta-item">
                  vs last{' '}
                  <ChangePill
                    deltaUnit={kgToUnit(stats.changeSincePrevious, unit)}
                    unit={unit}
                  />
                </span>
                <span className="weight-delta-item">
                  since start{' '}
                  <ChangePill
                    deltaUnit={kgToUnit(stats.changeSinceStart, unit)}
                    unit={unit}
                  />
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="weight-empty-inline">
            Log your weight below to start tracking.
          </p>
        )}

        {pts.length >= 2 && (
          <svg
            className="weight-chart"
            viewBox={`0 0 ${CW} ${CH}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Weight trend over time"
          >
            <defs>
              <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#weight-fill)" />
            <polyline
              points={linePts}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {pts.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i === pts.length - 1 ? 4 : 2.5}
                fill={i === pts.length - 1 ? 'var(--accent-deep)' : 'var(--card)'}
                stroke="var(--accent)"
                strokeWidth="2"
              />
            ))}
          </svg>
        )}
      </div>

      <form className="weight-input" onSubmit={submit}>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          placeholder={`Today's weight (${unit})`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={`Today's weight in ${unit}`}
        />
        <button type="submit" className="btn">
          Log weight
        </button>
      </form>

      {weights.length === 0 ? (
        <p className="log-empty">No weigh-ins yet.</p>
      ) : (
        <ul className="log-entries weight-history">
          {weights.map((e, i) => (
            <li key={e.id} className="log-entry" style={{ '--i': i }}>
              <div className="log-entry-main">
                <span className="log-entry-name">
                  {kgToUnit(e.kg, unit).toFixed(1)} {unit}
                </span>
                <span className="log-entry-meta">{fmtDate(e.timestamp)}</span>
              </div>
              <button
                className="log-entry-del"
                onClick={() => onDelete(e.id)}
                aria-label="Delete weigh-in"
                title="Delete"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
