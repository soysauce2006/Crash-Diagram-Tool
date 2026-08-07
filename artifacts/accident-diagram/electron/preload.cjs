'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Subscribe to download-progress events from the main process.
   * Callback receives: { percent, transferred, total, bytesPerSecond }
   * Returns a cleanup function to remove the listener.
   */
  onUpdateProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('update-progress', handler);
    return () => ipcRenderer.removeListener('update-progress', handler);
  },

  /**
   * Subscribe to the update-downloaded event so the banner can dismiss itself.
   * Returns a cleanup function to remove the listener.
   */
  onUpdateDownloaded: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
});
