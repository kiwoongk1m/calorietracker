// Editable meal: a list of foods (photo / search / custom), each with grams, a
// portion multiplier, and per-item calories, plus a running meal total and a
// single "log meal" action. Presentational — items + mutations come from App.

import { useState } from 'react';
import { mealItemResult, sumMeal, PORTIONS } from '../lib/meal.js';
import { useCountUp } from '../hooks/useCountUp.js';

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

function MealItemRow({ item, index, result, onSetGrams, onSetPortion, onRemove, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

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
  const custom = item.nutrition?.custom;
  const portion = Number(item.portion) > 0 ? Number(item.portion) : 1;

  return (
    <li className="meal-item" style={{ '--i': index }}>
      <div className="meal-item-top">
        <div className="meal-item-main">
          <span className="meal-item-name">
            <span className="meal-item-name-text">{name}</span>
            {custom && <span className="meal-item-tag">custom</span>}
          </span>
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
              {custom
                ? `≈ ${result.kcal} kcal`
                : `${result.kcal} kcal · ${
                    result.basis === 'weighed'
                      ? `${result.grams} g`
                      : `serving · ${result.grams} g`
                  }`}
            </span>
          )}
        </div>
        <button
          className="meal-item-btn"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
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
      </div>

      {item.state === 'ready' && (
        <div className="meal-item-controls">
          {!custom && (
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
          <div className="portion" role="group" aria-label="Portion">
            {PORTIONS.map((p) => (
              <button
                key={p.label}
                className={`portion-btn ${portion === p.value ? 'portion-active' : ''}`}
                onClick={() => onSetPortion(item.id, p.value)}
                aria-pressed={portion === p.value}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

export default function MealBuilder({
  items,
  mealType,
  mealTypes,
  onSetMealType,
  onSetGrams,
  onSetPortion,
  onRemove,
  onRename,
  onLogMeal,
  justLogged,
  onViewLog,
}) {
  const results = items.map(mealItemResult);
  const total = sumMeal(results);
  const readyCount = results.filter(Boolean).length;
  const anyLoading = items.some((it) => it.state === 'loading');
  const totalKcal = useCountUp(total.kcal, { decimals: 0 });

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
            onSetPortion={onSetPortion}
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
            <TotalMacro label="Protein" value={total.protein} />
            <TotalMacro label="Carbs" value={total.carbs} />
            <TotalMacro label="Fat" value={total.fat} />
          </div>
        </div>
      )}

      {readyCount > 0 && (
        <div className="meal-type" role="group" aria-label="Meal type">
          {mealTypes.map((t) => (
            <button
              key={t}
              className={`meal-type-btn ${t === mealType ? 'meal-type-active' : ''}`}
              onClick={() => onSetMealType(t)}
              aria-pressed={t === mealType}
            >
              {t}
            </button>
          ))}
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
            : `Log ${mealType} (${readyCount} item${readyCount > 1 ? 's' : ''})`}
        </button>
      )}
    </section>
  );
}
