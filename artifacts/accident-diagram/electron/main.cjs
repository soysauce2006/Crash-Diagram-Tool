'use strict';

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

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

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
