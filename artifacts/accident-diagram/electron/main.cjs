'use strict';

const { app, BrowserWindow, dialog, Menu, MenuItem } = require('electron');
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

// Tracks whether an update check is currently in flight so the menu item
// can be disabled while the check is pending.
let checkingForUpdates = false;

// The "Check for Updates" menu item — kept at module scope so the
// autoUpdater event handlers can enable/disable it at any time.
let checkForUpdatesMenuItem = null;

/**
 * Trigger a manual update check.
 * Disables the menu item while the check is in progress and re-enables it
 * once the result is known (update found, up-to-date, or error).
 */
function triggerManualUpdateCheck() {
  if (checkingForUpdates) return;
  checkingForUpdates = true;
  if (checkForUpdatesMenuItem) {
    checkForUpdatesMenuItem.enabled = false;
    checkForUpdatesMenuItem.label = 'Checking for Updates…';
  }
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[auto-updater] manual check error:', err?.message);
    resetCheckForUpdatesMenuItem();
  });
}

/** Restore the menu item to its default enabled state. */
function resetCheckForUpdatesMenuItem() {
  checkingForUpdates = false;
  if (checkForUpdatesMenuItem) {
    checkForUpdatesMenuItem.enabled = true;
    checkForUpdatesMenuItem.label = 'Check for Updates…';
  }
}

// ---------------------------------------------------------------------------
// Native application menu
// ---------------------------------------------------------------------------
function buildAppMenu() {
  checkForUpdatesMenuItem = new MenuItem({
    label: 'Check for Updates…',
    click: triggerManualUpdateCheck,
  });

  const template = [
    // macOS expects the first menu to carry the app name.
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        checkForUpdatesMenuItem,
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  // ---------------------------------------------------------------------------
  // Auto-updater — checks GitHub Releases for a newer version on every launch.
  //
  // Flow:
  //   1. App starts → waits 3 s → silently checks for updates.
  //   2. If a newer version exists → dialog asks whether to download.
  //   3. User confirms → download begins (progress logged to console).
  //   4. Download complete → dialog offers "Restart Now" or "Later".
  //   5. On "Later" the new installer runs automatically when the app quits.
  //
  // Works with and without a code-signing certificate.  electron-updater
  // validates downloads via the sha512 hash in latest.yml; OS-level signature
  // warnings (e.g. Windows SmartScreen) are separate and unaffected by this
  // logic.
  // ---------------------------------------------------------------------------
  const isDev = process.env.ELECTRON_DEV === '1';
  if (!isDev) {
    // Do NOT auto-download — ask the user first.
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Step 2 — update found: ask the user whether to download.
    autoUpdater.on('update-available', (info) => {
      // A check (manual or automatic) completed with a result — re-enable the
      // menu item so the user can check again later if they choose.
      resetCheckForUpdatesMenuItem();

      dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available.`,
        detail: 'Would you like to download and install it now? The app will restart automatically when the download is complete.',
        buttons: ['Download Update', 'Not Now'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) {
          console.log('[auto-updater] user accepted download for v' + info.version);
          autoUpdater.downloadUpdate();
        } else {
          console.log('[auto-updater] user deferred update to v' + info.version);
        }
      });
    });

    // No update available — show a brief "you're up to date" notice when the
    // check was triggered manually so the user gets clear feedback.
    autoUpdater.on('update-not-available', (info) => {
      const wasManual = checkingForUpdates;
      resetCheckForUpdatesMenuItem();

      if (wasManual) {
        dialog.showMessageBox({
          type: 'info',
          title: "You're Up to Date",
          message: `You're running the latest version (${info.version}).`,
          buttons: ['OK'],
          defaultId: 0,
        });
      }
    });

    // Step 3 — log download progress and forward it to the renderer.
    autoUpdater.on('download-progress', (progress) => {
      console.log(
        `[auto-updater] downloading… ${Math.round(progress.percent)}%` +
        ` (${Math.round(progress.transferred / 1024)} / ${Math.round(progress.total / 1024)} KB)`
      );
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.webContents.send('update-progress', {
          percent: progress.percent,
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond,
        });
      }
    });

    // Step 4 — download complete: notify renderer so the progress banner can
    // transition to its "done" state, then offer immediate restart.
    autoUpdater.on('update-downloaded', (info) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.webContents.send('update-downloaded', { version: info.version });

      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} is ready to install.`,
        detail: 'Restart now to apply the update, or choose Later — the update will be installed automatically when you next close the app.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
    });

    // Errors are logged silently — a failed update check (e.g. offline, no
    // GH_TOKEN) should never interrupt normal app use.
    autoUpdater.on('error', (err) => {
      console.error('[auto-updater] error:', err?.message);
      resetCheckForUpdatesMenuItem();
    });

    // Delay the first check slightly so the main window has time to appear.
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  }

  buildAppMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
