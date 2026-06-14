// Profile: body stats (sex, age, height, weight), activity, and weight goal ->
// an estimated daily calorie target (Mifflin-St Jeor TDEE). The user can apply
// the estimate as their daily log goal. Weight/height units follow the shared
// kg/lb preference (kg => cm, lb => ft+in). Profile is stored canonically
// (cm + kg) in App; this component edits via local display strings.

import { useEffect, useState } from 'react';
import { ACTIVITY_LEVELS, GOALS, recommendedCalories } from '../lib/profile.js';
import { useCountUp } from '../hooks/useCountUp.js';

const LB = 2.2046226218;
const round1 = (n) => Math.round(n * 10) / 10;

function deriveStrings(profile, unit, latestWeightKg) {
  const wKg =
    Number(profile.weightKg) > 0
      ? Number(profile.weightKg)
      : Number(latestWeightKg) > 0
        ? Number(latestWeightKg)
        : 0;
  const weightStr = wKg ? String(round1(unit === 'lb' ? wKg * LB : wKg)) : '';
  const cm = Number(profile.heightCm);
  let cmStr = '';
  let ftStr = '';
  let inStr = '';
  if (cm > 0) {
    cmStr = String(Math.round(cm));
    const totIn = cm / 2.54;
    ftStr = String(Math.floor(totIn / 12));
    inStr = String(Math.round(totIn - Math.floor(totIn / 12) * 12));
  }
  return { ageStr: profile.age ? String(profile.age) : '', weightStr, cmStr, ftStr, inStr };
}

export default function Profile({
  profile,
  unit,
  latestWeightKg,
  goal,
  onChange,
  onSetUnit,
  onApplyGoal,
}) {
  const [f, setF] = useState(() => deriveStrings(profile, unit, latestWeightKg));
  const metric = unit !== 'lb';

  // Re-derive display strings when the unit flips (canonical lives in App).
  useEffect(() => {
    setF(deriveStrings(profile, unit, latestWeightKg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  function build(strings, cats) {
    const weightKg = strings.weightStr
      ? metric
        ? Number(strings.weightStr)
        : Number(strings.weightStr) / LB
      : '';
    const heightCm = metric
      ? strings.cmStr
        ? Number(strings.cmStr)
        : ''
      : strings.ftStr || strings.inStr
        ? (Number(strings.ftStr || 0) * 12 + Number(strings.inStr || 0)) * 2.54
        : '';
    return {
      sex: cats.sex,
      age: strings.ageStr ? Number(strings.ageStr) : '',
      heightCm,
      weightKg,
      activity: cats.activity,
      goal: cats.goal,
    };
  }

  function setNum(field, value) {
    const next = { ...f, [field]: value };
    setF(next);
    onChange(build(next, profile));
  }
  function setCat(patch) {
    onChange(build(f, { ...profile, ...patch }));
  }

  const recommended = recommendedCalories(build(f, profile));
  const animated = useCountUp(recommended || 0, { decimals: 0 });
  const isGoalApplied = recommended != null && recommended === goal;

  return (
    <section className="profile" aria-label="Profile and calorie target">
      <div className="profile-card">
        <div className="field-row">
          <label className="field">
            <span className="field-label">Sex</span>
            <div className="seg" role="group" aria-label="Sex">
              {['male', 'female'].map((s) => (
                <button
                  key={s}
                  className={`seg-btn ${profile.sex === s ? 'seg-active' : ''}`}
                  onClick={() => setCat({ sex: s })}
                  aria-pressed={profile.sex === s}
                >
                  {s}
                </button>
              ))}
            </div>
          </label>

          <label className="field field-narrow">
            <span className="field-label">Age</span>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={f.ageStr}
              onChange={(e) => setNum('ageStr', e.target.value)}
              placeholder="yrs"
            />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field-label">Height</span>
            {metric ? (
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={f.cmStr}
                onChange={(e) => setNum('cmStr', e.target.value)}
                placeholder="cm"
              />
            ) : (
              <div className="ft-in">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={f.ftStr}
                  onChange={(e) => setNum('ftStr', e.target.value)}
                  placeholder="ft"
                  aria-label="Height feet"
                />
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={f.inStr}
                  onChange={(e) => setNum('inStr', e.target.value)}
                  placeholder="in"
                  aria-label="Height inches"
                />
              </div>
            )}
          </label>

          <label className="field">
            <span className="field-label">Weight</span>
            <input
              type="number"
              min="0"
              inputMode="decimal"
              value={f.weightStr}
              onChange={(e) => setNum('weightStr', e.target.value)}
              placeholder={unit}
            />
          </label>

          <div className="field field-narrow">
            <span className="field-label">Units</span>
            <div className="seg" role="group" aria-label="Units">
              {['kg', 'lb'].map((u) => (
                <button
                  key={u}
                  className={`seg-btn ${unit === u ? 'seg-active' : ''}`}
                  onClick={() => onSetUnit(u)}
                  aria-pressed={unit === u}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="field">
          <span className="field-label">Activity</span>
          <select
            value={profile.activity}
            onChange={(e) => setCat({ activity: e.target.value })}
          >
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Goal</span>
          <div className="seg" role="group" aria-label="Weight goal">
            {GOALS.map((g) => (
              <button
                key={g.id}
                className={`seg-btn ${profile.goal === g.id ? 'seg-active' : ''}`}
                onClick={() => setCat({ goal: g.id })}
                aria-pressed={profile.goal === g.id}
              >
                {g.label.replace(' weight', '')}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="card target-card">
        <span className="target-label">Recommended daily intake</span>
        {recommended != null ? (
          <>
            <div className="kcal">
              <span className="kcal-value">{animated.toLocaleString()}</span>
              <span className="kcal-label">kcal / day</span>
            </div>
            <button
              className={`btn btn-block ${isGoalApplied ? 'btn-ghost' : ''}`}
              onClick={() => onApplyGoal(recommended)}
              disabled={isGoalApplied}
            >
              {isGoalApplied
                ? '✓ This is your daily goal'
                : `Use as daily goal (now ${goal.toLocaleString()})`}
            </button>
            <p className="target-note">
              Estimated with the Mifflin-St Jeor equation. A rough starting
              point — adjust as you track real results.
            </p>
          </>
        ) : (
          <p className="target-note">
            Fill in your age, height, and weight to see an estimate.
          </p>
        )}
      </div>
    </section>
  );
}
