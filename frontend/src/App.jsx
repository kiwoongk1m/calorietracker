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
import NutritionCard from './components/NutritionCard.jsx';
import CameraCapture from './components/CameraCapture.jsx';

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
  }

  function startOver() {
    resetResults();
    setPreview(null);
    setStatus('idle');
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
    reader.onload = () => runPipeline(reader.result, reader.result);
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
          Estimate a meal&rsquo;s calories &amp; macros from a photo.
        </p>
      </header>

      {cameraOpen ? (
        <CameraCapture
          onCapture={onCameraCapture}
          onClose={() => setCameraOpen(false)}
          disabled={busy}
        />
      ) : (
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
          <button
            className="btn btn-ghost"
            onClick={() => runPipeline('non-food', null)}
            disabled={busy}
            title="Demonstrates the graceful unrecognized state"
          >
            Try a non-food image
          </button>
        </section>
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

      {recognition && (
        <section className="result-controls" aria-label="Adjust the estimate">
          <div className="detected">
            <span className="detected-label">Detected</span>
            <strong className="detected-value">{label}</strong>
            {typeof recognition.confidence === 'number' &&
              recognition.confidence > 0 && (
                <span className="confidence">
                  {Math.round(recognition.confidence * 100)}% sure
                </span>
              )}
          </div>

          {allCandidates.length > 1 && (
            <div className="candidates">
              <span className="candidates-label">Not right? Pick another:</span>
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

      {preview && status !== 'idle' && (
        <button className="btn btn-ghost btn-block" onClick={startOver}>
          New photo
        </button>
      )}
    </main>
  );
}
