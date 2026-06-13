// Shared CORS handling for the serverless functions. The web build calls these
// same-origin (no CORS needed), but the Capacitor/Android build calls them
// cross-origin from the WebView, so we allow any origin and answer preflight.
// No credentials are used, so a wildcard origin is safe.

export function applyCors(req, res, methods) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true; // handled — caller should return
  }
  return false;
}
