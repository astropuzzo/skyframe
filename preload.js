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
  elevation: (lat, lon) => ipcRenderer.invoke('geo:elevation', lat, lon),
});
