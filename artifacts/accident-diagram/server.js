/**
 * Crash Scene Diagram Tool — standalone production server
 *
 * Serves the pre-built Vite frontend (./public).
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
