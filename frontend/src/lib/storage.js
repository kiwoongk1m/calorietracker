// ---------------------------------------------------------------------------
// Shared client-side key/value storage. Wraps localStorage with an in-memory
// fallback for private mode / SSR / unit tests, so callers never touch the
// global directly. A future cloud-sync backend can replace this one module.
// ---------------------------------------------------------------------------

let memory = {};

export function storage() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // accessing localStorage can throw in sandboxed contexts — fall through
  }
  return {
    getItem: (k) => (k in memory ? memory[k] : null),
    setItem: (k, v) => {
      memory[k] = String(v);
    },
    removeItem: (k) => {
      delete memory[k];
    },
  };
}

/** Best-effort unique id (crypto.randomUUID when available). */
export function newId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
