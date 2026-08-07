'use strict';

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const https = require('https');

// ---------------------------------------------------------------------------
// Overpass API — race multiple mirrors, return first successful response.
// No CORS restrictions here because we're in Node.js, not a browser.
// ---------------------------------------------------------------------------
const OVERPASS_ENDPOINTS = [
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function fetchOneEndpoint(base, query) {
  return new Promise((resolve, reject) => {
    const url = `${base}?data=${encodeURIComponent(query)}`;
    const req = https.get(
      url,
      { headers: { Accept: '*/*', 'User-Agent': 'AccidentDiagramTool/1.0' }, timeout: 30_000 },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} from ${base}`));
          res.resume();
          return;
        }
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (!Array.isArray(data.elements)) throw new Error('Missing elements array');
            resolve(data);
          } catch (e) {
            reject(e);
          }
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${base}`)); });
  });
}

function fetchOverpass(query) {
  return Promise.any(OVERPASS_ENDPOINTS.map((base) => fetchOneEndpoint(base, query)));
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Crash Scene Diagram Tool',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed so preload can use require
    },
  });

  // In production the renderer is a static build; in dev load the Vite server.
  const isDev = process.env.ELECTRON_DEV === '1';
  if (isDev) {
    const devPort = process.env.DEV_PORT || '5173';
    win.loadURL(`http://localhost:${devPort}`);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'electron-app', 'index.html'));
  }
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
ipcMain.handle('overpass', async (_event, query) => {
  return fetchOverpass(query);
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  // Patch headers for OSM tile/Nominatim requests so tile.openstreetmap.org
  // doesn't reject them with 403 (it blocks file:// referers).
  const OSM_FILTER = {
    urls: [
      'https://tile.openstreetmap.org/*',
      'https://nominatim.openstreetmap.org/*',
    ],
  };
  session.defaultSession.webRequest.onBeforeSendHeaders(OSM_FILTER, (details, callback) => {
    const headers = { ...details.requestHeaders };
    headers['Referer'] = 'https://www.openstreetmap.org/';
    headers['User-Agent'] = 'CrashSceneDiagramTool/1.0 (accident reconstruction; contact: support@example.com)';
    callback({ requestHeaders: headers });
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
