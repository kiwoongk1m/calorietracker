// Meal log view: today's intake vs goal (with progress), plus full history
// grouped by day. Presentational — entries/goal come from App, mutations go
// back up via callbacks.

import { useState } from 'react';
import { groupByDay, dayKey } from '../lib/log.js';

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

export default function MealLog({ entries, goal, onDelete, onSetGoal }) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(goal));

  const groups = groupByDay(entries);
  const today = dayKey(new Date());
  const todayGroup = groups.find((g) => g.day === today);
  const todayKcal = todayGroup ? todayGroup.totals.kcal : 0;
  const pct = goal > 0 ? Math.min(100, Math.round((todayKcal / goal) * 100)) : 0;
  const over = todayKcal > goal;

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
            {todayKcal.toLocaleString()}
          </span>
          <span className="log-today-unit">
            / {goal.toLocaleString()} kcal
          </span>
        </div>

        <div className="progress" role="progressbar" aria-valuenow={todayKcal} aria-valuemax={goal}>
          <div
            className={`progress-bar ${over ? 'is-over' : ''}`}
            style={{ width: `${pct}%` }}
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
        <p className="log-empty">No meals logged yet. Estimate a meal and tap “Log this meal”.</p>
      ) : (
        <div className="log-history">
          {groups.map((g) => (
            <div key={g.day} className="log-day">
              <div className="log-day-head">
                <span className="log-day-name">{formatDay(g.day)}</span>
                <span className="log-day-total">{g.totals.kcal.toLocaleString()} kcal</span>
              </div>
              <ul className="log-entries">
                {g.entries.map((e) => (
                  <li key={e.id} className="log-entry">
                    <div className="log-entry-main">
                      <span className="log-entry-name">{e.name}</span>
                      <span className="log-entry-meta">
                        {e.grams} g · {e.basis} · {e.kcal} kcal
                      </span>
                    </div>
                    <button
                      className="log-entry-del"
                      onClick={() => onDelete(e.id)}
                      aria-label={`Delete ${e.name}`}
                      title="Delete"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
