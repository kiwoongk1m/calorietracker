// Meal log view: today's intake vs goal (with progress), plus full history
// grouped by day. Presentational — entries/goal come from App, mutations go
// back up via callbacks.

import { useEffect, useState } from 'react';
import { groupByDay, groupIntoMeals, dayKey } from '../lib/log.js';
import { useCountUp, prefersReducedMotion } from '../hooks/useCountUp.js';

function formatDay(key) {
  const today = dayKey(new Date());
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = dayKey(d);
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return new Date(key + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function LoggedMeal({ meal, index, onDelete, onDeleteMeal, onAddToMeal }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  function submitAdd(e) {
    e.preventDefault();
    const q = draft.trim();
    if (q) onAddToMeal(meal.mealId, meal.meal, q);
    setDraft('');
    setAdding(false);
  }

  return (
    <div className="log-meal" style={{ '--i': index }}>
      <div className="log-meal-head">
        <span className="log-meal-type">{meal.meal || 'meal'}</span>
        <span className="log-meal-time">{formatTime(meal.timestamp)}</span>
        <span className="log-meal-total">
          {meal.totals.kcal.toLocaleString()} kcal
        </span>
        {meal.mealId && (
          <button
            className="log-meal-del"
            onClick={() => onDeleteMeal(meal.mealId)}
            aria-label={`Delete ${meal.meal || 'meal'}`}
            title="Delete whole meal"
          >
            ×
          </button>
        )}
      </div>
      <ul className="log-entries">
        {meal.entries.map((e) => (
          <li key={e.id} className="log-entry">
            <div className="log-entry-main">
              <span className="log-entry-name">{e.name}</span>
              <span className="log-entry-meta">
                {e.grams != null
                  ? `${e.grams} g · ${e.basis} · ${e.kcal} kcal`
                  : `${e.kcal} kcal · ${e.basis || 'estimate'}`}
              </span>
            </div>
            <button
              className="log-entry-del"
              onClick={() => onDelete(e.id)}
              aria-label={`Delete ${e.name}`}
              title="Delete food"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {meal.mealId &&
        (adding ? (
          <form className="log-meal-add" onSubmit={submitAdd}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="add a food by name…"
              aria-label="Add a food to this meal"
              autoFocus
            />
            <button type="submit" className="btn btn-sm" disabled={!draft.trim()}>
              Add
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button className="log-meal-add-btn" onClick={() => setAdding(true)}>
            + Add food
          </button>
        ))}
    </div>
  );
}

export default function MealLog({
  entries,
  goal,
  onDelete,
  onDeleteMeal,
  onAddToMeal,
  onSetGoal,
}) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(goal));

  const groups = groupByDay(entries);
  const today = dayKey(new Date());
  const todayGroup = groups.find((g) => g.day === today);
  const todayKcal = todayGroup ? todayGroup.totals.kcal : 0;
  const pct = goal > 0 ? Math.min(100, Math.round((todayKcal / goal) * 100)) : 0;
  const over = todayKcal > goal;

  const todayDisplay = useCountUp(todayKcal, { decimals: 0 });

  // Fill the progress bar from 0 on mount (and animate on change) via the
  // existing CSS width transition.
  const [barPct, setBarPct] = useState(prefersReducedMotion() ? pct : 0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setBarPct(pct);
      return;
    }
    const id = requestAnimationFrame(() => setBarPct(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  function saveGoal() {
    onSetGoal(goalDraft);
    setEditingGoal(false);
  }

  return (
    <section className="log" aria-label="Meal log">
      <div className="log-today">
        <div className="log-today-head">
          <span className="log-today-label">Today</span>
          {editingGoal ? (
            <span className="goal-edit">
              <input
                type="number"
                min="1"
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                aria-label="Daily calorie goal"
              />
              <button className="btn btn-sm" onClick={saveGoal}>
                Save
              </button>
            </span>
          ) : (
            <button
              className="goal-display"
              onClick={() => {
                setGoalDraft(String(goal));
                setEditingGoal(true);
              }}
              title="Edit daily goal"
            >
              goal {goal.toLocaleString()} kcal ✎
            </button>
          )}
        </div>

        <div className="log-today-total">
          <span className={`log-today-kcal ${over ? 'is-over' : ''}`}>
            {todayDisplay.toLocaleString()}
          </span>
          <span className="log-today-unit">
            / {goal.toLocaleString()} kcal
          </span>
        </div>

        <div className="progress" role="progressbar" aria-valuenow={todayKcal} aria-valuemax={goal}>
          <div
            className={`progress-bar ${over ? 'is-over' : ''}`}
            style={{ width: `${barPct}%` }}
          />
        </div>

        {todayGroup && (
          <div className="log-today-macros">
            <span>P {todayGroup.totals.protein} g</span>
            <span>C {todayGroup.totals.carbs} g</span>
            <span>F {todayGroup.totals.fat} g</span>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="log-empty">No meals logged yet. Estimate a meal and tap “Log meal”.</p>
      ) : (
        <div className="log-history">
          {groups.map((g) => (
            <div key={g.day} className="log-day">
              <div className="log-day-head">
                <span className="log-day-name">{formatDay(g.day)}</span>
                <span className="log-day-total">{g.totals.kcal.toLocaleString()} kcal</span>
              </div>

              {groupIntoMeals(g.entries).map((m, mi) => (
                <LoggedMeal
                  key={m.mealId || m.entries[0].id}
                  meal={m}
                  index={mi}
                  onDelete={onDelete}
                  onDeleteMeal={onDeleteMeal}
                  onAddToMeal={onAddToMeal}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
