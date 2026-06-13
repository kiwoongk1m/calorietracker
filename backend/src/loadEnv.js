// Loads the repo-root .env into process.env for the local Express server.
// Resolved relative to this file so it works regardless of the cwd the server
// is started from. No-op when the file is absent (CI, and Vercel/serverless,
// where env vars come from the platform config instead).

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '../../.env'); // backend/src -> repo root

if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    console.warn(`[backend] could not load ${envPath}:`, err.message);
  }
}
