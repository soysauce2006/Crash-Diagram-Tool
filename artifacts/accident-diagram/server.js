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
// OSM tile proxy — avoids rate-limiting when the browser hits OSM directly
// ---------------------------------------------------------------------------
app.get('/api/tiles/:z/:x/:y', async (req, res) => {
  const { z, x } = req.params;
  const y = req.params.y.replace(/\.png$/i, '');
  if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
    return res.status(400).send('Invalid tile coordinates');
  }
  try {
    const upstream = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        'User-Agent': 'CrashSceneDiagramTool/1.0 (accident reconstruction)',
        'Referer':    'https://www.openstreetmap.org/',
        'Accept':     'image/png,image/*',
      },
    });
    if (!upstream.ok) return res.status(upstream.status).send(`Upstream: ${upstream.status}`);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.set('Content-Type', 'image/png').set('Cache-Control', 'public, max-age=86400').send(buf);
  } catch (err) {
    res.status(502).send(`Tile fetch failed: ${String(err)}`);
  }
});

// ---------------------------------------------------------------------------
// Nominatim geocoding proxy — avoids CORS and OSM rate-limiting
// ---------------------------------------------------------------------------
app.get('/api/nominatim', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Missing 'q' parameter" });
  try {
    const upstream = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      {
        signal: AbortSignal.timeout(10_000),
        headers: {
          'User-Agent':      'CrashSceneDiagramTool/1.0 (accident reconstruction)',
          'Accept-Language': 'en-US,en',
          'Accept':          'application/json',
          'Referer':         'https://www.openstreetmap.org/',
        },
      }
    );
    if (!upstream.ok) return res.status(upstream.status).json({ error: `Upstream: ${upstream.status}` });
    const data = await upstream.json();
    res.set('Cache-Control', 'public, max-age=3600').json(data);
  } catch (err) {
    res.status(502).json({ error: `Nominatim fetch failed: ${String(err)}` });
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
