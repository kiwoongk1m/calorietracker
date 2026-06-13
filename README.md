# Calorie Snap — food calorie estimator (Stage 1 MVP)

Estimate the calories and macros of a meal from a photo. Take or upload a
picture, the app identifies the dish, and you get calories + protein / carbs /
fat — either accurately (enter the food's weight in grams) or as a typical
serving estimate.

This repository is the **Stage 1 skeleton** (Task A): the full pipeline runs
end-to-end on **mock data**, with clean seams so the real recognition and
nutrition providers drop in later without touching the rest of the app.

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
a pure function returning the shared contract shape; the placeholder real
providers throw a clear "not implemented yet" error rather than returning
garbage.

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
npm test                 # calc module unit tests (Vitest)
```

Open http://localhost:5173. Click **Try a sample** to run the full pipeline,
**Try a non-food image** to see the graceful unrecognized state, and enter a
weight to switch from the serving estimate to the weighed number.

## Deploying

Configured for a single Vercel deploy: the static frontend builds to
`frontend/dist` and `api/*.js` run as serverless functions sharing the same
providers (see [`vercel.json`](vercel.json)). Set `RECOGNITION_PROVIDER`,
`NUTRITION_PROVIDER`, and any real keys as environment variables in the host.
**The vision-LLM and USDA keys are server-side only and never reach the browser
bundle.** (Public URL + CI are Task F.)

## Known limitations (read this — it's the honest part)

- **Composite dishes are averaged estimates.** "Carbonara" is many ingredients
  in varying ratios, so even an exact gram weight gives an averaged number.
  Single-ingredient foods (grilled chicken, an apple) are far more accurate.
- **Cooked, not raw.** You weigh a finished plate, so nutrition is matched
  against *cooked* entries — 100 g of cooked chicken has more calories than
  100 g raw. (Task C must prefer cooked USDA entries.)
- **Tare the plate.** The number assumes you weighed the food only, not the
  plate.
- **One dish per photo.** Multi-item plates, tap-to-select, live camera
  detection, and image-based portion estimation are deferred to Stage 2/3.

## Stage status

Stage 1 = single photo, upload or snapshot. The whole point of the seam above is
that the jump to Stage 2 (live camera detection, tap-to-select) is a recognition
swap — nothing downstream moves.
