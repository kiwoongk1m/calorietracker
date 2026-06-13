# Calorie Snap — food calorie estimator (Stage 1 MVP)

Estimate the calories and macros of a meal from a photo. Take or upload a
picture, the app identifies the dish, and you get calories + protein / carbs /
fat — either accurately (enter the food's weight in grams) or as a typical
serving estimate.

The full pipeline runs end-to-end on **mock data by default** (no API keys
needed), and real recognition (vision LLM) and nutrition (USDA) providers drop
in behind the same seams via two env vars — no route, calc, or UI changes.

## The core design decision

We deliberately **do not estimate portion size from the image** — that's an
open research problem, and guessing grams from pixels produces confidently wrong
numbers. Instead:

1. Identify the **dish** from the photo (a vision LLM, zero-shot).
2. Look up its **per-100g** nutrition from USDA FoodData Central.
3. Multiply by a weight:
   - **Weighed path** — the user enters grams → an accurate number.
   - **Serving path** — no grams → fall back to a typical serving, clearly
     labelled as an estimate.

The basis (weighed vs serving) is always shown, so the number is never presented
as more precise than it is.

## Architecture

```
Capture (upload / snapshot)
      │
      ▼
/api/recognize   vision-LLM → dish label        ← the ONLY part that changes
      │                                            between stages
      ▼
/api/nutrition   label → USDA per-100g entry
      │
      ▼
calc module      weighed:  grams/100 × per100g
                 serving:  defaultServingGrams/100 × per100g
      │
      ▼
Nutrition card   calories + protein / carbs / fat
```

Everything downstream of recognition (lookup, calc, card) is built once here and
reused unchanged in later stages.

### The swap seam

Recognition and nutrition each live behind a **provider** selected by an env
var. Stage 1 ships `mock` for both, so the app runs with no API keys. To go live
with the real implementations you add a provider function and flip an env var —
no route, calc, or UI changes:

| Step        | Env var                | Stage 1 | Later        | Owner  |
| ----------- | ---------------------- | ------- | ------------ | ------ |
| Recognition | `RECOGNITION_PROVIDER` | `mock`  | `visionllm`  | Task B |
| Nutrition   | `NUTRITION_PROVIDER`   | `mock`  | `usda`       | Task C |

The providers are in [`backend/src/providers/`](backend/src/providers/). Each is
a pure function returning the shared contract shape.

- **`mock`** (default for both): fixed cooked-dish data so the app always runs
  keyless.
- **`visionllm`** ([`visionllm.js`](backend/src/providers/visionllm.js)): sends
  the image to a vision-capable Claude model, asks for JSON-only output (best
  label + 2–3 alternates + confidence), validates it, and falls back to the
  unrecognized state when unsure or for non-food images. The key
  (`VISION_LLM_API_KEY`) is read server-side only.
- **`usda`** ([`usda.js`](backend/src/providers/usda.js)): queries USDA
  FoodData Central, **prefers cooked entries over raw**, maps to the per-100g
  contract, estimates a serving size, and caches results in-process. Key:
  `USDA_API_KEY` (server-side only).

The pure logic in each real provider (image/JSON parsing, validation, USDA
selection/mapping/serving estimate) is unit-tested without a key in
`*.test.js` next to it.

## Project layout

```
frontend/         React + Vite app
  src/lib/calc.js        shared calculation module (+ calc.test.js)
  src/services/api.js    client adapters for the two endpoints
  src/components/        NutritionCard
  src/App.jsx            pipeline orchestration + capture + states
backend/          Express server (dev runtime + provider home)
  src/server.js          /api/recognize, /api/nutrition
  src/providers/         the swap seam (recognition + nutrition)
api/              Vercel serverless functions wrapping the same providers
```

## Shared API contract

`POST /api/recognize`
- Request: `{ "imageBase64": "<string>" }`
- Response: `{ "label": "spaghetti carbonara", "confidence": 0.82, "candidates": ["..."] }`
- Unsure → `{ "label": null, "confidence": 0, "candidates": [], "unrecognized": true }`

`GET /api/nutrition?query=<label>`
- Response:
  ```json
  {
    "fdcId": "mock-0001",
    "name": "Spaghetti carbonara, cooked",
    "per100g": { "kcal": 160, "protein": 6.5, "carbs": 18, "fat": 7 },
    "defaultServingGrams": 250
  }
  ```
- No match → `404 { "error": "..." }`

Calculation module (`calc.js`):
- Input: `{ per100g, grams?, defaultServingGrams }`
- Output: `{ grams, kcal, protein, carbs, fat, basis: "weighed" | "serving" }`
- Formula: `value = (grams / 100) * per100g[nutrient]`

## Running locally

```bash
npm install              # installs both workspaces
cp .env.example .env     # optional; mocks are the defaults
npm run dev              # backend (:3001) + frontend (:5173) together
npm test                 # unit tests: frontend calc + backend provider logic
npm run build            # production build of the frontend
```

Open http://localhost:5173. **Upload a photo** or **Use camera** (live snapshot
via getUserMedia, with preview); click **Try a sample** to run the full pipeline
on mock data, **Try a non-food image** to see the graceful unrecognized state,
and enter a weight to switch from the serving estimate to the weighed number.

To run against the **real** providers locally, set the env vars before
`npm run dev`:

```bash
# real recognition (needs an Anthropic key) and/or real nutrition (USDA key)
RECOGNITION_PROVIDER=visionllm VISION_LLM_API_KEY=... \
NUTRITION_PROVIDER=usda       USDA_API_KEY=...        npm run dev
```

Leave either unset to keep that step on the mock — the two providers are
independent.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push / PR:
`npm ci` → `npm test` (frontend calc + backend provider logic) → `npm run build`.
It needs **no secrets** — the mock providers are the default and the provider
tests cover pure logic only, so the build stays green keyless.

## Deploying

Configured for a single **Vercel** deploy: the static frontend builds to
`frontend/dist` and `api/*.js` run as serverless functions sharing the same
providers (see [`vercel.json`](vercel.json)). **The vision-LLM and USDA keys are
server-side only and never reach the browser bundle** (verified: a production
build contains no reference to the keys or the Anthropic SDK).

The exact steps (require your own accounts/credentials, which aren't available
in this environment):

1. Push this repo to GitHub:
   `git remote add origin <your-repo-url> && git push -u origin main`
2. Import the repo at [vercel.com/new](https://vercel.com/new) (it auto-detects
   `vercel.json`; build = `npm run build`, output = `frontend/dist`).
3. In **Project → Settings → Environment Variables**, add (Production):
   - `RECOGNITION_PROVIDER=visionllm` and `VISION_LLM_API_KEY=<your key>`
     (optional `VISION_LLM_MODEL`), **or** leave unset to ship the mock.
   - `NUTRITION_PROVIDER=usda` and `USDA_API_KEY=<your key>`
     ([free signup](https://fdc.nal.usda.gov/api-key-signup.html)), **or** leave
     unset for the mock.
4. Deploy → Vercel gives you a public `https://<project>.vercel.app` URL.

With no env vars set, the deploy still works end-to-end on the mock providers.

## Known limitations (read this — it's the honest part)

- **Composite dishes are averaged estimates.** "Carbonara" is many ingredients
  in varying ratios, so even an exact gram weight gives an averaged number.
  Single-ingredient foods (grilled chicken, an apple) are far more accurate.
- **Cooked, not raw.** You weigh a finished plate, so nutrition is matched
  against *cooked* entries — 100 g of cooked chicken has more calories than
  100 g raw — so the USDA provider prefers cooked entries, and the candidate-
  correction chips let you fix the worst mismatches (one label can map to
  several USDA entries).
- **Tare the plate.** The number assumes you weighed the food only, not the
  plate.
- **One dish per photo.** Multi-item plates, tap-to-select, live camera
  detection, and image-based portion estimation are deferred to Stage 2/3.
- **Real-provider verification needs keys.** The `visionllm` and `usda`
  providers are implemented in full against the documented APIs, but were
  verified only by (a) unit-testing their pure parsing/selection logic keyless,
  and (b) confirming they fail cleanly (HTTP 502 JSON, server stays up) when
  selected without a key. The live image-recognition accuracy and live USDA
  matching can't be exercised until `VISION_LLM_API_KEY` / `USDA_API_KEY` are
  set.

## Stage status

Stage 1 = single photo, upload or snapshot. The whole point of the seam above is
that the jump to Stage 2 (live camera detection, tap-to-select) is a recognition
swap — nothing downstream moves.
