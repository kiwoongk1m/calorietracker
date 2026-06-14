// Collapsible "add a custom food" form for foods not in the database. The user
// types a name and estimates the calories (macros optional). On save it's
// persisted and added to the current meal. Presentational — onSave does both.

import { useState } from 'react';

export default function CustomFoodForm({ onSave }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const valid = name.trim() && parseFloat(kcal) > 0;

  function reset() {
    setName('');
    setKcal('');
    setProtein('');
    setCarbs('');
    setFat('');
  }

  function submit(e) {
    e.preventDefault();
    if (!valid) return;
    onSave({
      name: name.trim(),
      kcal: parseFloat(kcal),
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
    });
    reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button className="custom-food-trigger" onClick={() => setOpen(true)}>
        + Add a custom food
      </button>
    );
  }

  return (
    <form className="custom-food-form" onSubmit={submit}>
      <input
        type="text"
        className="cf-name"
        placeholder="Food name (e.g. Mom's lasagna)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Custom food name"
        autoFocus
      />
      <div className="cf-macros">
        <label className="cf-field">
          <span>kcal*</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            aria-label="Calories per serving"
          />
        </label>
        <label className="cf-field">
          <span>P (g)</span>
          <input type="number" min="0" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} aria-label="Protein grams" />
        </label>
        <label className="cf-field">
          <span>C (g)</span>
          <input type="number" min="0" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} aria-label="Carb grams" />
        </label>
        <label className="cf-field">
          <span>F (g)</span>
          <input type="number" min="0" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} aria-label="Fat grams" />
        </label>
      </div>
      <p className="cf-hint">Per one serving — you estimate the values.</p>
      <div className="cf-actions">
        <button type="submit" className="btn btn-sm" disabled={!valid}>
          Save &amp; add
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
