// Weight tab: current weight (count-up, kg/lb toggle), a 1W/1M/3M/1Y range
// selector that drives a time-based trend chart + range summary, an input to
// log today's weight, and a deletable history. Weights are stored in kg; this
// component converts to the chosen display unit.

import { useState } from 'react';
import {
  kgToUnit,
  unitToKg,
  weightStats,
  weightsInRange,
  rangeStats,
  chartSeries,
  WEIGHT_RANGES,
} from '../lib/weight.js';
import { useCountUp } from '../hooks/useCountUp.js';

const CW = 340; // full SVG width
const CH = 120; // plot height
const PAD = 14;
const GUTTER = 34; // left column reserved for y-axis labels
const PLOT_W = CW - GUTTER; // width the data is plotted across

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function ChangePill({ deltaUnit, unit, suffix }) {
  if (deltaUnit == null) return null;
  const dir = deltaUnit < -0.05 ? 'down' : deltaUnit > 0.05 ? 'up' : 'flat';
  const arrow = dir === 'down' ? '↓' : dir === 'up' ? '↑' : '→';
  return (
    <span className={`weight-change weight-change-${dir}`}>
      {arrow} {Math.abs(deltaUnit).toFixed(1)} {unit}
      {suffix ? ` ${suffix}` : ''}
    </span>
  );
}

function WeightChart({ series, unit }) {
  const { points, min, max } = series;
  if (points.length < 2) {
    return (
      <div className="weight-chart-empty">
        Not enough data in this range yet — keep logging.
      </div>
    );
  }
  const baseline = CH - PAD;
  const line = points.map((p) => `${p.x},${p.y}`).join(' ');
  const area =
    `M ${points[0].x},${baseline} ` +
    points.map((p) => `L ${p.x},${p.y}`).join(' ') +
    ` L ${points[points.length - 1].x},${baseline} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      className="weight-chart"
      viewBox={`0 0 ${CW} ${CH + 22}`}
      role="img"
      aria-label="Weight trend"
    >
      <defs>
        <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* y-axis labels live in the left gutter, clear of the plot */}
      <text className="chart-axis" x={GUTTER - 6} y={PAD + 4} textAnchor="end">
        {kgToUnit(max, unit).toFixed(1)}
      </text>
      <text className="chart-axis" x={GUTTER - 6} y={baseline} textAnchor="end">
        {kgToUnit(min, unit).toFixed(1)}
      </text>

      {/* plot is shifted right by the gutter */}
      <g transform={`translate(${GUTTER}, 0)`}>
        {[PAD, (PAD + baseline) / 2, baseline].map((y, i) => (
          <line
            key={i}
            x1="0"
            y1={y}
            x2={PLOT_W}
            y2={y}
            stroke="var(--line)"
            strokeWidth="1"
          />
        ))}

        <path className="weight-area" d={area} fill="url(#weight-fill)" />
        <polyline
          className="weight-line"
          points={line}
          pathLength="1"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            className="weight-dot"
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 4 : 2.5}
            fill={i === points.length - 1 ? 'var(--accent-deep)' : 'var(--card)'}
            stroke="var(--accent)"
            strokeWidth="2"
          />
        ))}
        <text
          className="chart-value"
          x={Math.min(PLOT_W, last.x)}
          y={Math.max(12, last.y - 8)}
          textAnchor="end"
        >
          {kgToUnit(last.kg, unit).toFixed(1)}
        </text>
      </g>

      {/* x-axis start/end dates */}
      <text className="chart-axis" x={GUTTER} y={CH + 16} textAnchor="start">
        {fmtDate(series.firstTs)}
      </text>
      <text className="chart-axis" x={CW} y={CH + 16} textAnchor="end">
        {fmtDate(series.lastTs)}
      </text>
    </svg>
  );
}

export default function WeightTracker({ weights, unit, onAdd, onDelete, onSetUnit }) {
  const [draft, setDraft] = useState('');
  const [range, setRange] = useState('1M');

  const overall = weightStats(weights);
  const animated = useCountUp(overall ? kgToUnit(overall.latest, unit) : 0, {
    decimals: 1,
  });

  const rangeDef = WEIGHT_RANGES.find((r) => r.id === range) || WEIGHT_RANGES[1];
  const inRange = weightsInRange(weights, rangeDef.days);
  const stats = rangeStats(inRange);
  const series = chartSeries(inRange, PLOT_W, CH, PAD);

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

        {overall ? (
          <div className="weight-today-value">
            <span className="weight-kg">{animated.toFixed(1)}</span>
            <span className="weight-unit">{unit}</span>
          </div>
        ) : (
          <p className="weight-empty-inline">
            Log your weight below to start tracking.
          </p>
        )}

        {overall && (
          <>
            <div className="weight-ranges" role="group" aria-label="Time range">
              {WEIGHT_RANGES.map((r) => (
                <button
                  key={r.id}
                  className={`range-btn ${range === r.id ? 'range-active' : ''}`}
                  onClick={() => setRange(r.id)}
                  aria-pressed={range === r.id}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {stats && stats.count > 1 ? (
              <div className="weight-range-summary">
                <span className="weight-delta-item">
                  {rangeDef.label} change
                  <ChangePill deltaUnit={kgToUnit(stats.change, unit)} unit={unit} />
                </span>
                <span className="weight-range-extra">
                  avg {kgToUnit(stats.avg, unit).toFixed(1)} · range{' '}
                  {kgToUnit(stats.min, unit).toFixed(1)}–
                  {kgToUnit(stats.max, unit).toFixed(1)} {unit}
                </span>
              </div>
            ) : (
              <p className="weight-range-summary weight-range-extra">
                One weigh-in in this range — log more to see a trend.
              </p>
            )}

            <WeightChart key={range} series={series} unit={unit} />
          </>
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
