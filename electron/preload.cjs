const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sumAPI', {
  pickAudio: () => ipcRenderer.invoke('dialog:pick-audio'),
  pickAudioFolder: () => ipcRenderer.invoke('dialog:pick-audio-folder'),
  pickImages: () => ipcRenderer.invoke('dialog:pick-images'),
  pickOutputDir: () => ipcRenderer.invoke('dialog:pick-output-dir'),
  readImage: (filePath) => ipcRenderer.invoke('file:read-image', filePath),
  probeAudio: (filePath) => ipcRenderer.invoke('audio:probe', filePath),
  saveThumbnail: (input) => ipcRenderer.invoke('thumbnail:save', input),
  saveTextFile: (input) => ipcRenderer.invoke('file:write-text', input),
  renderPlaylist: (input) => ipcRenderer.invoke('playlist:render', input),
  cancelRender: (jobId) => ipcRenderer.invoke('playlist:cancel', jobId),
  exportCapcutKit: (input) => ipcRenderer.invoke('capcut:export-kit', input),
  buildChapters: (tracks) => ipcRenderer.invoke('chapters:build', tracks),
  openPath: (targetPath) => ipcRenderer.invoke('shell:open-path', targetPath),
  loadBrandTemplates: () => ipcRenderer.invoke('brand:load-templates'),
  saveBrandTemplate: (template) => ipcRenderer.invoke('brand:save-template', template),
  deleteBrandTemplate: (channelPreset) => ipcRenderer.invoke('brand:delete-template', channelPreset),
  loadAISettings: () => ipcRenderer.invoke('settings:load-ai'),
  saveAISettings: (settings) => ipcRenderer.invoke('settings:save-ai', settings),
  generateAIBackground: (input) => ipcRenderer.invoke('ai:generate-background', input),
  inspectBackground: (input) => ipcRenderer.invoke('ai:inspect-background', input),
  pickChecklistXlsx: () => ipcRenderer.invoke('dialog:pick-xlsx'),
  loadChecklistXlsx: (filePath) => ipcRenderer.invoke('checklist:load-xlsx', filePath),
  copyText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
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
