'use strict';

const { app, BrowserWindow, ipcMain, protocol, net, dialog } = require('electron');
const path = require('path');
const https = require('https');
const { autoUpdater } = require('electron-updater');

// ---------------------------------------------------------------------------
// Register the tile:// custom scheme BEFORE app.whenReady().
// This lets the renderer use fetch('tile://z/x/y.png') without any CORS or
// Referer restrictions — all network I/O happens in Node.js, not Chromium.
// ---------------------------------------------------------------------------
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'tile',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true,
    },
  },
]);

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

// Geocode an address via Nominatim entirely in Node.js — no CORS / Referer issues.
ipcMain.handle('nominatim-search', async (_event, address) => {
  return new Promise((resolve, reject) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'CrashSceneDiagramTool/1.0 (accident reconstruction)',
          'Referer': 'https://www.openstreetmap.org/',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en',
        },
        timeout: 15_000,
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Nominatim timeout')); });
  });
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  // ---------------------------------------------------------------------------
  // Auto-updater — checks GitHub Releases for a newer version on every launch.
  // Silent in the background; only prompts when an update has been downloaded.
  // ---------------------------------------------------------------------------
  const isDev = process.env.ELECTRON_DEV === '1';
  if (!isDev) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', () => {
      // Update found — downloading silently in the background (no prompt needed).
    });

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version has been downloaded.',
        detail: 'The update will be installed automatically when you close the app. You can also restart now to apply it immediately.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
    });

    autoUpdater.on('error', (err) => {
      // Log silently — don't bother the user if update check fails (e.g. offline).
      console.error('[auto-updater] error:', err?.message);
    });

    // Delay the first check slightly so the main window has time to appear.
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  }

  // Proxy tile:// URLs to tile.openstreetmap.org via Electron's net module.
  // The renderer uses tile://z/x/y.png instead of https://tile.openstreetmap.org/z/x/y.png
  // so all tile requests go through Node.js where we control every header.
  protocol.handle('tile', async (request) => {
    const tilePath = request.url.slice('tile://'.length); // e.g. "17/34567/89012.png"
    const osmUrl = `https://tile.openstreetmap.org/${tilePath}`;
    try {
      const resp = await net.fetch(osmUrl, {
        headers: {
          'User-Agent': 'CrashSceneDiagramTool/1.0 (accident reconstruction)',
          'Referer': 'https://www.openstreetmap.org/',
          'Accept': 'image/png,image/*',
        },
      });
      return resp;
    } catch {
      return new Response(null, { status: 503 });
    }
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
