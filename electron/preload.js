const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, typed IPC bridge to the renderer world
contextBridge.exposeInMainWorld('electronAPI', {
  getEntries: (request) => ipcRenderer.invoke('get-entries', request),
  getAllEntries: () => ipcRenderer.invoke('get-all-entries'),
  addEntry: (request) => ipcRenderer.invoke('add-entry', request),
  getBalances: (request) => ipcRenderer.invoke('get-balances', request),
  exportCsv: (request) => ipcRenderer.invoke('export-csv', request),
  importCsv: (request) => ipcRenderer.invoke('import-csv', request),
  deleteEntry: (request) => ipcRenderer.invoke('delete-entry', request),
  resetDatabase: () => ipcRenderer.invoke('reset-database'),
  getAuthStatus: () => ipcRenderer.invoke('get-auth-status'),
  setupAuth: (request) => ipcRenderer.invoke('setup-auth', request),
  verifyAuthCode: (request) => ipcRenderer.invoke('verify-auth-code', request)
});
