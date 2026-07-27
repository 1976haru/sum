const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sumAPI', {
  pickAudio: () => ipcRenderer.invoke('dialog:pick-audio'),
  pickImages: () => ipcRenderer.invoke('dialog:pick-images'),
  pickOutputDir: () => ipcRenderer.invoke('dialog:pick-output-dir'),
  readImage: (filePath) => ipcRenderer.invoke('file:read-image', filePath),
  probeAudio: (filePath) => ipcRenderer.invoke('audio:probe', filePath),
  saveThumbnail: (input) => ipcRenderer.invoke('thumbnail:save', input),
  renderPlaylist: (input) => ipcRenderer.invoke('playlist:render', input),
  cancelRender: (jobId) => ipcRenderer.invoke('playlist:cancel', jobId),
  exportCapcutKit: (input) => ipcRenderer.invoke('capcut:export-kit', input),
  openPath: (targetPath) => ipcRenderer.invoke('shell:open-path', targetPath),
  onProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('job:progress', listener);
    return () => ipcRenderer.removeListener('job:progress', listener);
  },
  onLog: (callback) => {
    const listener = (_event, line) => callback(line);
    ipcRenderer.on('job:log', listener);
    return () => ipcRenderer.removeListener('job:log', listener);
  }
});
