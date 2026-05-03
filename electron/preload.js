const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('talkApi', {
  listHistory: (limit = 100) => ipcRenderer.invoke('history:list', { limit }),
  getState: () => ipcRenderer.invoke('state:get'),
  toggleDictation: () => ipcRenderer.invoke('dictation:toggle'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  openSettings: () => ipcRenderer.invoke('settings:open'),
  closeSettings: () => ipcRenderer.invoke('settings:close'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
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
  onPartialTranscript: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('transcript:partial', listener);
    return () => ipcRenderer.removeListener('transcript:partial', listener);
  },
});
