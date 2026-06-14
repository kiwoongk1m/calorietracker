// ---------------------------------------------------------------------------
// App orchestration. A meal is a LIST of foods, so capture/search builds an
// editable meal:
//   capture (upload/camera/sample) -> /api/recognize -> N detected foods
//     -> each looked up via /api/nutrition -> editable meal item
//   search/add by name -> one more meal item
//   each item: grams (weighed vs serving), rename, remove
//   -> running meal total -> log the whole meal (one log entry per item)
//
// The seams are unchanged: this file only talks to services/api.js, lib/calc.js,
// lib/log.js, and lib/weight.js.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { recognizeDish, fetchNutrition } from './services/api.js';
import { calculateNutrition } from './lib/calc.js';
import { downscaleDataUrl } from './lib/image.js';
import { newId } from './lib/storage.js';
import {
  addEntry,
  deleteEntry,
  deleteMeal,
  getEntries,
  getGoal,
  setGoal as persistGoal,
  sumNutrition,
  dayKey,
  defaultMealType,
  MEAL_TYPES,
} from './lib/log.js';
import {
  getWeights,
  addWeight,
  deleteWeight,
  getUnit,
  setUnit as persistUnit,
  weightStats,
  kgToUnit,
} from './lib/weight.js';
import {
  getProfile,
  setProfile as persistProfile,
  recommendedCalories,
} from './lib/profile.js';
import CameraCapture from './components/CameraCapture.jsx';
import MealBuilder from './components/MealBuilder.jsx';
import MealLog from './components/MealLog.jsx';
import WeightTracker from './components/WeightTracker.jsx';
import Profile from './components/Profile.jsx';

// A hard-coded stand-in "photo" for the sample button. The mock recognizer
// ignores the bytes; a real image flows through unchanged with real providers.
const SAMPLE_IMAGE = 'sample-food-photo';

export default function App() {
  // idle | recognizing | unrecognized | error
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const [preview, setPreview] = useState(null); // data URL shown to the user
  const [cameraOpen, setCameraOpen] = useState(false);
  const [addQuery, setAddQuery] = useState(''); // "add a food by name" box

  // The meal under construction: a list of { id, query, nutrition, grams, state }
  // where state is 'loading' | 'ready' | 'error'.
  const [mealItems, setMealItems] = useState([]);
  const [mealType, setMealType] = useState(() => defaultMealType());
  const [justLogged, setJustLogged] = useState(false);

  // Meal log + daily tracking (persisted in localStorage via lib/log.js).
  const [entries, setEntries] = useState(() => getEntries());
  const [goal, setGoalState] = useState(() => getGoal());
  const [view, setView] = useState('estimate'); // 'estimate' | 'log' | 'weight'

  // Body-weight tracking (persisted in localStorage via lib/weight.js).
  const [weights, setWeights] = useState(() => getWeights());
  const [weightUnit, setWeightUnit] = useState(() => getUnit());

  // Profile + calorie target (persisted in localStorage via lib/profile.js).
  const [profile, setProfileState] = useState(() => getProfile());

  const todayKcal = useMemo(() => {
    const today = dayKey(new Date());
    return sumNutrition(entries.filter((e) => dayKey(e.timestamp) === today)).kcal;
  }, [entries]);

  // --- meal building --------------------------------------------------------
  function addFoodToMeal(query) {
    const q = String(query || '').trim();
    if (!q) return;
    setJustLogged(false);
    const id = newId();
    setMealItems((prev) => [
      ...prev,
      { id, query: q, nutrition: null, grams: '', state: 'loading' },
    ]);
    fetchNutrition(q)
      .then((data) =>
        setMealItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, nutrition: data, state: 'ready' } : it
          )
        )
      )
      .catch(() =>
        setMealItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, state: 'error' } : it))
        )
      );
  }

  function renameMealItem(id, query) {
    const q = String(query || '').trim();
    if (!q) return;
    setJustLogged(false);
    setMealItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, query: q, nutrition: null, state: 'loading' } : it
      )
    );
    fetchNutrition(q)
      .then((data) =>
        setMealItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, nutrition: data, state: 'ready' } : it
          )
        )
      )
      .catch(() =>
        setMealItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, state: 'error' } : it))
        )
      );
  }

  function setItemGrams(id, grams) {
    setJustLogged(false);
    setMealItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, grams } : it))
    );
  }

  function removeMealItem(id) {
    setJustLogged(false);
    setMealItems((prev) => prev.filter((it) => it.id !== id));
  }

  function startOver() {
    setMealItems([]);
    setPreview(null);
    setAddQuery('');
    setError(null);
    setJustLogged(false);
    setMealType(defaultMealType());
    setStatus('idle');
  }

  async function runPipeline(imageBase64, previewUrl) {
    setMealItems([]);
    setJustLogged(false);
    setError(null);
    setPreview(previewUrl || null);
    setStatus('recognizing');
    try {
      const rec = await recognizeDish(imageBase64);
      const items = rec && Array.isArray(rec.items) ? rec.items : [];
      if (!rec || rec.unrecognized || items.length === 0) {
        setStatus('unrecognized');
        return;
      }
      setStatus('idle');
      items.forEach((it) => addFoodToMeal(it.label));
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        // Downscale before sending so large phone photos stay under the vision
        // API's size limit (and upload fast). Falls back to the original.
        const scaled = await downscaleDataUrl(reader.result);
        runPipeline(scaled, scaled);
      } catch {
        runPipeline(reader.result, reader.result);
      }
    };
    reader.onerror = () => {
      setError('Could not read that file. Try another photo.');
      setStatus('error');
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // allow re-selecting the same file
  }

  function onCameraCapture(dataUrl) {
    setCameraOpen(false);
    runPipeline(dataUrl, dataUrl);
  }

  function onAddSubmit(e) {
    e.preventDefault();
    addFoodToMeal(addQuery);
    setAddQuery('');
  }

  function logMeal() {
    const ready = mealItems.filter((it) => it.state === 'ready' && it.nutrition);
    if (ready.length === 0) return;
    // One mealId ties the foods together as a single meal in the log.
    const mealId = newId();
    for (const it of ready) {
      const g = parseFloat(it.grams);
      const r = calculateNutrition({
        per100g: it.nutrition.per100g,
        grams: Number.isFinite(g) ? g : undefined,
        defaultServingGrams: it.nutrition.defaultServingGrams,
      });
      addEntry({
        mealId,
        meal: mealType,
        name: it.nutrition.name,
        fdcId: it.nutrition.fdcId,
        grams: r.grams,
        basis: r.basis,
        kcal: r.kcal,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
      });
    }
    setEntries(getEntries());
    setJustLogged(true);
  }

  // --- log + weight handlers ------------------------------------------------
  function handleDeleteEntry(id) {
    setEntries(deleteEntry(id));
  }
  function handleDeleteMeal(mealId) {
    setEntries(deleteMeal(mealId));
  }
  // Add a food (by name) to an already-logged meal — uses a typical serving.
  function handleAddToMeal(mealId, meal, query) {
    const q = String(query || '').trim();
    if (!mealId || !q) return;
    fetchNutrition(q)
      .then((data) => {
        const r = calculateNutrition({
          per100g: data.per100g,
          defaultServingGrams: data.defaultServingGrams,
        });
        addEntry({
          mealId,
          meal,
          name: data.name,
          fdcId: data.fdcId,
          grams: r.grams,
          basis: r.basis,
          kcal: r.kcal,
          protein: r.protein,
          carbs: r.carbs,
          fat: r.fat,
        });
        setEntries(getEntries());
      })
      .catch(() => {
        /* no match — leave the meal unchanged */
      });
  }
  function handleSetGoal(value) {
    setGoalState(persistGoal(value));
  }
  function handleAddWeight(kg) {
    setWeights(addWeight({ kg }));
  }
  function handleDeleteWeight(id) {
    setWeights(deleteWeight(id));
  }
  function handleSetUnit(unit) {
    setWeightUnit(persistUnit(unit));
  }

  function handleProfileChange(p) {
    setProfileState(persistProfile(p));
  }
  function handleApplyGoal(kcal) {
    if (kcal) setGoalState(persistGoal(kcal));
  }

  const wStats = weightStats(weights);
  const weightBadge = wStats
    ? `${kgToUnit(wStats.latest, weightUnit).toFixed(1)} ${weightUnit}`
    : 'no data';
  const recommended = recommendedCalories(profile);
  const profileBadge = recommended ? `${recommended.toLocaleString()} kcal` : 'set up';

  const busy = status === 'recognizing';

  return (
    <main className="app">
      <header className="app-head">
        <h1>Calorie Snap</h1>
        <p className="tagline">
          Estimate a meal&rsquo;s calories &amp; macros from a photo or by name.
        </p>
      </header>

      <nav className="tabs" aria-label="Views">
        <button
          className={`tab ${view === 'estimate' ? 'tab-active' : ''}`}
          onClick={() => setView('estimate')}
        >
          Estimate
        </button>
        <button
          className={`tab ${view === 'log' ? 'tab-active' : ''}`}
          onClick={() => setView('log')}
        >
          Log
          <span className="tab-badge">{todayKcal.toLocaleString()} kcal</span>
        </button>
        <button
          className={`tab ${view === 'weight' ? 'tab-active' : ''}`}
          onClick={() => setView('weight')}
        >
          Weight
          <span className="tab-badge">{weightBadge}</span>
        </button>
        <button
          className={`tab ${view === 'profile' ? 'tab-active' : ''}`}
          onClick={() => setView('profile')}
        >
          Profile
          <span className="tab-badge">{profileBadge}</span>
        </button>
      </nav>

      {view === 'estimate' && (
        <>
          {cameraOpen ? (
            <CameraCapture
              onCapture={onCameraCapture}
              onClose={() => setCameraOpen(false)}
              disabled={busy}
            />
          ) : (
            <>
              <section className="capture" aria-label="Capture a photo">
                <label className={`btn ${busy ? 'is-disabled' : ''}`}>
                  Upload a photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onFile}
                    hidden
                    disabled={busy}
                  />
                </label>
                <button
                  className="btn"
                  onClick={() => setCameraOpen(true)}
                  disabled={busy}
                >
                  Use camera
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => runPipeline(SAMPLE_IMAGE, null)}
                  disabled={busy}
                >
                  Try a sample
                </button>
              </section>

              <div className="or-divider">
                <span>or add a food by name</span>
              </div>

              <form className="search" onSubmit={onAddSubmit}>
                <input
                  type="text"
                  placeholder="e.g. grilled chicken breast"
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  aria-label="Add a food by name"
                />
                <button type="submit" className="btn" disabled={!addQuery.trim()}>
                  Add
                </button>
              </form>
            </>
          )}

          {preview && (
            <figure className="preview">
              <img src={preview} alt="Captured food" className="preview-img" />
            </figure>
          )}

          {status === 'recognizing' && (
            <p className="state state-busy">Identifying the foods…</p>
          )}

          {status === 'unrecognized' && (
            <div className="state state-warn" role="status">
              <p>
                Couldn&rsquo;t recognize any food in that image. Try another
                photo, or add a food by name — we won&rsquo;t show made-up
                numbers.
              </p>
              <button className="btn btn-ghost btn-sm" onClick={startOver}>
                Try again
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="state state-error" role="alert">
              <p>{error || 'Something went wrong.'}</p>
              <button className="btn btn-ghost btn-sm" onClick={startOver}>
                Start over
              </button>
            </div>
          )}

          {mealItems.length > 0 && (
            <>
              <MealBuilder
                items={mealItems}
                mealType={mealType}
                mealTypes={MEAL_TYPES}
                onSetMealType={setMealType}
                onSetGrams={setItemGrams}
                onRemove={removeMealItem}
                onRename={renameMealItem}
                onLogMeal={logMeal}
                justLogged={justLogged}
                onViewLog={() => setView('log')}
              />
              <button className="btn btn-ghost btn-block" onClick={startOver}>
                Start over
              </button>
            </>
          )}
        </>
      )}

      {view === 'log' && (
        <MealLog
          entries={entries}
          goal={goal}
          onDelete={handleDeleteEntry}
          onDeleteMeal={handleDeleteMeal}
          onAddToMeal={handleAddToMeal}
          onSetGoal={handleSetGoal}
        />
      )}

      {view === 'weight' && (
        <WeightTracker
          weights={weights}
          unit={weightUnit}
          onAdd={handleAddWeight}
          onDelete={handleDeleteWeight}
          onSetUnit={handleSetUnit}
        />
      )}

      {view === 'profile' && (
        <Profile
          profile={profile}
          unit={weightUnit}
          latestWeightKg={wStats ? wStats.latest : null}
          goal={goal}
          onChange={handleProfileChange}
          onSetUnit={handleSetUnit}
          onApplyGoal={handleApplyGoal}
        />
      )}
    </main>
  );
}
