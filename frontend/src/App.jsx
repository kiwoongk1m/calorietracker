// ---------------------------------------------------------------------------
// App orchestration (Task D builds out the full capture + correction UX on top
// of the Task A skeleton):
//   capture (upload OR camera snapshot) -> preview
//     -> /api/recognize -> detected dish + correctable candidates
//     -> /api/nutrition -> calc -> nutrition card
//   grams input toggles weighed vs typical-serving; basis is always visible.
//
// Every async step has an explicit loading and error state. The seams are
// unchanged: this file only talks to services/api.js and lib/calc.js.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { recognizeDish, fetchNutrition } from './services/api.js';
import { calculateNutrition } from './lib/calc.js';
import { downscaleDataUrl } from './lib/image.js';
import {
  addEntry,
  deleteEntry,
  getEntries,
  getGoal,
  setGoal as persistGoal,
  sumNutrition,
  dayKey,
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
import NutritionCard from './components/NutritionCard.jsx';
import CameraCapture from './components/CameraCapture.jsx';
import MealLog from './components/MealLog.jsx';
import WeightTracker from './components/WeightTracker.jsx';

// A hard-coded stand-in "photo" for the sample button. The mock recognizer
// ignores the bytes; a real image flows through unchanged with the real
// providers enabled.
const SAMPLE_IMAGE = 'sample-food-photo';

export default function App() {
  // idle | recognizing | looking-up | ready | unrecognized | error
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const [preview, setPreview] = useState(null); // data URL shown to the user
  const [recognition, setRecognition] = useState(null); // {label, candidates, confidence}
  const [label, setLabel] = useState(''); // chosen (possibly corrected) label
  const [nutrition, setNutrition] = useState(null); // contract nutrition object
  const [grams, setGrams] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); // text food search
  const [correctionDraft, setCorrectionDraft] = useState(''); // fix a misrecognized dish by name

  // Meal log + daily tracking (persisted in localStorage via lib/log.js).
  const [entries, setEntries] = useState(() => getEntries());
  const [goal, setGoalState] = useState(() => getGoal());
  const [view, setView] = useState('estimate'); // 'estimate' | 'log' | 'weight'
  const [justLogged, setJustLogged] = useState(false);

  // Body-weight tracking (persisted in localStorage via lib/weight.js).
  const [weights, setWeights] = useState(() => getWeights());
  const [weightUnit, setWeightUnit] = useState(() => getUnit());

  const todayKcal = useMemo(() => {
    const today = dayKey(new Date());
    return sumNutrition(entries.filter((e) => dayKey(e.timestamp) === today)).kcal;
  }, [entries]);

  // Recompute the card whenever nutrition or grams change. Pure + cheap.
  const result = useMemo(() => {
    if (!nutrition) return null;
    const g = parseFloat(grams);
    return calculateNutrition({
      per100g: nutrition.per100g,
      grams: Number.isFinite(g) ? g : undefined,
      defaultServingGrams: nutrition.defaultServingGrams,
    });
  }, [nutrition, grams]);

  function resetResults() {
    setRecognition(null);
    setLabel('');
    setNutrition(null);
    setGrams('');
    setError(null);
    setJustLogged(false);
    setCorrectionDraft('');
  }

  function startOver() {
    resetResults();
    setPreview(null);
    setSearchQuery('');
    setStatus('idle');
  }

  // Text search: skip recognition, go straight to the nutrition lookup -> card.
  async function searchFood(e) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    resetResults();
    setPreview(null);
    await lookUp(q);
  }

  async function lookUp(query) {
    setStatus('looking-up');
    setError(null);
    try {
      const data = await fetchNutrition(query);
      setNutrition(data);
      setStatus('ready');
    } catch (e) {
      setNutrition(null);
      setError(e.message);
      setStatus('error');
    }
  }

  async function runPipeline(imageBase64, previewUrl) {
    resetResults();
    setPreview(previewUrl || null);
    setStatus('recognizing');
    try {
      const rec = await recognizeDish(imageBase64);
      if (!rec || rec.unrecognized || !rec.label) {
        setStatus('unrecognized');
        return;
      }
      setRecognition(rec);
      setLabel(rec.label);
      await lookUp(rec.label);
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
        // API's size limit (and upload fast). Falls back to the original if the
        // resize fails for any reason.
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
    // Allow re-selecting the same file later.
    e.target.value = '';
  }

  function onCameraCapture(dataUrl) {
    setCameraOpen(false);
    runPipeline(dataUrl, dataUrl);
  }

  function onPickCandidate(candidate) {
    if (candidate === label) return;
    setLabel(candidate);
    lookUp(candidate);
  }

  // Correct a misrecognized dish by typing the right name; keeps the photo
  // context and just re-runs the nutrition lookup.
  function submitCorrection(e) {
    e.preventDefault();
    const q = correctionDraft.trim();
    if (!q) return;
    setLabel(q);
    lookUp(q);
    setCorrectionDraft('');
  }

  function logCurrentMeal() {
    if (!result || !nutrition) return;
    const stored = addEntry({
      name: nutrition.name,
      fdcId: nutrition.fdcId,
      grams: result.grams,
      basis: result.basis,
      kcal: result.kcal,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
    });
    setEntries((prev) => [...prev, stored]);
    setJustLogged(true);
  }

  function handleDeleteEntry(id) {
    setEntries(deleteEntry(id));
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

  const wStats = weightStats(weights);
  const weightBadge = wStats
    ? `${kgToUnit(wStats.latest, weightUnit).toFixed(1)} ${weightUnit}`
    : 'no data';

  const busy = status === 'recognizing' || status === 'looking-up';
  const allCandidates = recognition
    ? [recognition.label, ...(recognition.candidates || [])].filter(
        (c, i, arr) => c && arr.indexOf(c) === i
      )
    : [];

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
          <span className="tab-badge">{todayKcal.toLocaleString()} kcal today</span>
        </button>
        <button
          className={`tab ${view === 'weight' ? 'tab-active' : ''}`}
          onClick={() => setView('weight')}
        >
          Weight
          <span className="tab-badge">{weightBadge}</span>
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
            <span>or search by name</span>
          </div>

          <form className="search" onSubmit={searchFood}>
            <input
              type="text"
              placeholder="e.g. grilled chicken breast"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={busy}
              aria-label="Search a food by name"
            />
            <button
              type="submit"
              className="btn"
              disabled={busy || !searchQuery.trim()}
            >
              Search
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
        <p className="state state-busy">Identifying the dish…</p>
      )}
      {status === 'looking-up' && (
        <p className="state state-busy">Looking up nutrition…</p>
      )}

      {status === 'unrecognized' && (
        <div className="state state-warn" role="status">
          <p>
            Couldn&rsquo;t recognize a dish in that image. Try another photo —
            we won&rsquo;t show made-up numbers.
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

      {(recognition || nutrition) && (
        <section className="result-controls" aria-label="Adjust the estimate">
          {recognition ? (
            <>
              <div className="detected">
                <span className="detected-label">Detected</span>
                <strong className="detected-value">{label}</strong>
                {typeof recognition.confidence === 'number' &&
                  recognition.confidence > 0 &&
                  label === recognition.label && (
                    <span className="confidence">
                      {Math.round(recognition.confidence * 100)}% sure
                    </span>
                  )}
              </div>

              <div className="candidates">
                <span className="candidates-label">
                  {allCandidates.length > 1
                    ? 'Not right? Pick another or type it:'
                    : 'Not right? Type the correct food:'}
                </span>
                {allCandidates.length > 1 && (
                  <div className="chips">
                    {allCandidates.map((c) => (
                      <button
                        key={c}
                        className={`chip ${c === label ? 'chip-active' : ''}`}
                        onClick={() => onPickCandidate(c)}
                        disabled={busy}
                        aria-pressed={c === label}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                <form className="correct" onSubmit={submitCorrection}>
                  <input
                    type="text"
                    placeholder="type the correct food"
                    value={correctionDraft}
                    onChange={(e) => setCorrectionDraft(e.target.value)}
                    disabled={busy}
                    aria-label="Correct the food by name"
                  />
                  <button
                    type="submit"
                    className="btn btn-sm"
                    disabled={busy || !correctionDraft.trim()}
                  >
                    Use
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="detected">
              <span className="detected-label">Found</span>
              <strong className="detected-value">{nutrition.name}</strong>
            </div>
          )}

          <label className="grams">
            <span className="grams-label">Weight in grams</span>
            <input
              type="number"
              min="0"
              inputMode="decimal"
              placeholder="leave blank for a typical serving"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              disabled={busy}
            />
            <span className="grams-hint">
              Weigh the food only — tare the plate first.
            </span>
          </label>
        </section>
      )}

      {result && nutrition && (
        <NutritionCard name={nutrition.name} result={result} />
      )}

      {result && nutrition && (
        <button
          className={`btn btn-block ${justLogged ? 'btn-ghost' : ''}`}
          onClick={justLogged ? () => setView('log') : logCurrentMeal}
        >
          {justLogged ? 'Logged ✓ — View log' : 'Log this meal'}
        </button>
      )}

          {(preview || nutrition) && status !== 'idle' && (
            <button className="btn btn-ghost btn-block" onClick={startOver}>
              {recognition ? 'New photo' : 'New search'}
            </button>
          )}
        </>
      )}

      {view === 'log' && (
        <MealLog
          entries={entries}
          goal={goal}
          onDelete={handleDeleteEntry}
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
    </main>
  );
}
