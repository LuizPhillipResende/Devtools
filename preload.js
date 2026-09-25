const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFileDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  captureScreen: () => ipcRenderer.invoke('desktop:captureScreen'),
  readClipboardImage: () => ipcRenderer.invoke('clipboard:readImage'),
  readClipboardText: () => ipcRenderer.invoke('clipboard:readText'),
  writeClipboardText: (text) => ipcRenderer.invoke('clipboard:writeText', text),
  storageGet: (keys) => ipcRenderer.invoke('storage:get', keys),
  storageSet: (items) => ipcRenderer.invoke('storage:set', items),
  storageClear: () => ipcRenderer.invoke('storage:clear'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized')
});
