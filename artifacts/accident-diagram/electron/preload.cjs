'use strict';

const { contextBridge } = require('electron');

// No IPC APIs are currently exposed to the renderer.
// Keep this file as a placeholder so webPreferences.preload continues to work.
contextBridge.exposeInMainWorld('electronAPI', {});
