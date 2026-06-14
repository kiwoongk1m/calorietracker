// Editable meal: a list of foods (from photo detection and/or name search),
// each with its own grams and per-item calories, plus a running meal total and
// a single "log meal" action. Presentational — items + mutations come from App.

import { useState } from 'react';
import { calculateNutrition } from '../lib/calc.js';
import { useCountUp } from '../hooks/useCountUp.js';

const round1 = (n) => Math.round(n * 10) / 10;

function itemResult(item) {
  if (item.state !== 'ready' || !item.nutrition) return null;
  const g = parseFloat(item.grams);
  return calculateNutrition({
    per100g: item.nutrition.per100g,
    grams: Number.isFinite(g) ? g : undefined,
    defaultServingGrams: item.nutrition.defaultServingGrams,
  });
}

function TotalMacro({ label, value }) {
  const v = useCountUp(value, { decimals: 1 });
  return (
    <div className="macro">
      <span className="macro-value">
        {v}
        <span className="macro-unit">g</span>
      </span>
      <span className="macro-label">{label}</span>
    </div>
  );
}

function MealItemRow({ item, index, result, onSetGrams, onRemove, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function startEdit() {
    setDraft(item.nutrition ? item.nutrition.name : item.query);
    setEditing(true);
  }
  function saveEdit(e) {
    e.preventDefault();
    const q = draft.trim();
    if (q) onRename(item.id, q);
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="meal-item" style={{ '--i': index }}>
        <form className="meal-item-edit" onSubmit={saveEdit}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Correct this food"
            autoFocus
          />
          <button type="submit" className="btn btn-sm" disabled={!draft.trim()}>
            Save
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </form>
      </li>
    );
  }

  const name =
    item.state === 'ready' && item.nutrition ? item.nutrition.name : item.query;

  return (
    <li className="meal-item" style={{ '--i': index }}>
      <div className="meal-item-main">
        <span className="meal-item-name">{name}</span>
        {item.state === 'loading' && (
          <span className="meal-item-meta">looking up…</span>
        )}
        {item.state === 'error' && (
          <span className="meal-item-meta meal-item-err">
            couldn&rsquo;t find — rename or remove
          </span>
        )}
        {item.state === 'ready' && result && (
          <span className="meal-item-meta">
            {result.kcal} kcal ·{' '}
            {result.basis === 'weighed'
              ? `${result.grams} g`
              : `serving · ${result.grams} g`}
          </span>
        )}
      </div>

      {item.state === 'ready' && (
        <input
          className="meal-item-grams"
          type="number"
          min="0"
          inputMode="decimal"
          placeholder="g"
          value={item.grams}
          onChange={(e) => onSetGrams(item.id, e.target.value)}
          aria-label={`Grams of ${name}`}
        />
      )}

      <button
        className="meal-item-btn"
        onClick={startEdit}
        title="Rename"
        aria-label={`Rename ${name}`}
      >
        ✎
      </button>
      <button
        className="meal-item-btn"
        onClick={() => onRemove(item.id)}
        title="Remove"
        aria-label={`Remove ${name}`}
      >
        ×
      </button>
    </li>
  );
}

export default function MealBuilder({
  items,
  onSetGrams,
  onRemove,
  onRename,
  onLogMeal,
  justLogged,
  onViewLog,
}) {
  const results = items.map(itemResult);
  const total = results.reduce(
    (acc, r) =>
      r
        ? {
            kcal: acc.kcal + r.kcal,
            protein: acc.protein + r.protein,
            carbs: acc.carbs + r.carbs,
            fat: acc.fat + r.fat,
          }
        : acc,
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const readyCount = results.filter(Boolean).length;
  const anyLoading = items.some((it) => it.state === 'loading');
  const totalKcal = useCountUp(Math.round(total.kcal), { decimals: 0 });

  return (
    <section className="meal" aria-label="Your meal">
      <ul className="meal-items">
        {items.map((it, i) => (
          <MealItemRow
            key={it.id}
            item={it}
            index={i}
            result={results[i]}
            onSetGrams={onSetGrams}
            onRemove={onRemove}
            onRename={onRename}
          />
        ))}
      </ul>

      {readyCount > 0 && (
        <div className="card meal-total">
          <div className="card-head">
            <h2 className="card-title">Meal total</h2>
            <span className="basis basis-weighed">
              {readyCount} item{readyCount > 1 ? 's' : ''}
            </span>
          </div>
          <div className="kcal">
            <span className="kcal-value">{totalKcal.toLocaleString()}</span>
            <span className="kcal-label">kcal</span>
          </div>
          <div className="macros">
            <TotalMacro label="Protein" value={round1(total.protein)} />
            <TotalMacro label="Carbs" value={round1(total.carbs)} />
            <TotalMacro label="Fat" value={round1(total.fat)} />
          </div>
        </div>
      )}

      {readyCount > 0 && (
        <button
          className={`btn btn-block ${justLogged ? 'btn-ghost' : ''}`}
          onClick={justLogged ? onViewLog : onLogMeal}
          disabled={anyLoading}
        >
          {justLogged
            ? 'Logged ✓ — View log'
            : `Log meal (${readyCount} item${readyCount > 1 ? 's' : ''})`}
        </button>
      )}
    </section>
  );
}
