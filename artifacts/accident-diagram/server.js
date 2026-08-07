/**
 * Crash Scene Diagram Tool — standalone production server
 *
 * Serves the pre-built Vite frontend (./public) and proxies Overpass API
 * requests to avoid browser CORS restrictions.
 *
 * Requirements: Node.js 18+
 * Usage:        node server.js
 * Port:         Reads PORT env var, defaults to 3000
 */

'use strict';

const express = require('express');
const path = require('path');
const app = express();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT   = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');

// Overpass API mirrors — raced in parallel; first successful response wins
const OVERPASS_ENDPOINTS = [
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// ---------------------------------------------------------------------------
// Overpass proxy
// ---------------------------------------------------------------------------
async function queryOverpass(query) {
  const fetchOne = async (base) => {
    const url = `${base}?data=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: { Accept: '*/*', 'User-Agent': 'AccidentDiagramTool/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${base}`);
    const data = await res.json();
    if (!Array.isArray(data.elements)) throw new Error(`Bad payload from ${base}`);
    return data;
  };
  return Promise.any(OVERPASS_ENDPOINTS.map(fetchOne));
}

app.get('/api/overpass', async (req, res) => {
  const query = req.query.data;
  if (!query) return res.status(400).json({ error: "Missing 'data' parameter" });
  try {
    const data = await queryOverpass(query);
    res.json(data);
  } catch (err) {
    const msg = err instanceof AggregateError
      ? err.errors.map(String).join('; ')
      : String(err);
    console.error('[overpass]', msg);
    res.status(502).json({ error: `All Overpass endpoints failed: ${msg}` });
  }
});

// ---------------------------------------------------------------------------
// Static frontend + SPA fallback
// ---------------------------------------------------------------------------
app.use(express.static(PUBLIC));

// Any unmatched route returns index.html so client-side routing works
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Crash Scene Diagram Tool running at http://localhost:${PORT}`);
});
