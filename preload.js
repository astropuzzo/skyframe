'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cielo', {
  loadProfiles: () => ipcRenderer.invoke('profiles:load'),
  saveProfiles: (data) => ipcRenderer.invoke('profiles:save', data),
  exportProfiles: (data) => ipcRenderer.invoke('profiles:export', data),
  importProfiles: () => ipcRenderer.invoke('profiles:import'),
  copy: (text) => ipcRenderer.invoke('clipboard:write', String(text)),
  lpLookup: (lat, lon) => ipcRenderer.invoke('lp:lookup', lat, lon),
  geoSearch: (q) => ipcRenderer.invoke('geo:search', q),
  lpmAllSky: (lat, lon) => ipcRenderer.invoke('lpm:allsky', lat, lon),
  elevation: (lat, lon) => ipcRenderer.invoke('geo:elevation', lat, lon),
  onUpdate: (cb) => ipcRenderer.on('update', (_e, m) => cb(m)),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  openUpdate: () => ipcRenderer.invoke('update:open'),
  noTour: !!(process.env.SKYFRAME_SMOKE || process.env.SKYFRAME_EVAL), // prove automatiche: niente guida al primo avvio
});
