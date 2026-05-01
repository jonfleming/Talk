const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flowApi', {
  listHistory: (limit = 100) => ipcRenderer.invoke('history:list', { limit }),
  getState: () => ipcRenderer.invoke('state:get'),
  toggleDictation: () => ipcRenderer.invoke('dictation:toggle'),
  onState: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.removeListener('state:changed', listener);
  },
  onTranscript: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('transcript:final', listener);
    return () => ipcRenderer.removeListener('transcript:final', listener);
  },
});
