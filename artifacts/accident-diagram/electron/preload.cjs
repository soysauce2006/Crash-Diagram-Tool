'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, narrow API to the renderer (no full Node/Electron access).
contextBridge.exposeInMainWorld('electronAPI', {
  /** Call the Overpass API through the main process (bypasses CORS). */
  overpass: (query) => ipcRenderer.invoke('overpass', query),

  /** Geocode an address via Nominatim through the main process (bypasses CORS/Referer). */
  nominatimSearch: (address) => ipcRenderer.invoke('nominatim-search', address),
});
