const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    pickFolder: () => ipcRenderer.invoke('pick-folder'),
    writeSyncFile: (folder, content) => ipcRenderer.invoke('write-sync-file', folder, content),
    readSyncFile: (folder) => ipcRenderer.invoke('read-sync-file', folder),
    registerFileAssociations: () => ipcRenderer.invoke('register-file-associations'),
    removeFileAssociations: () => ipcRenderer.invoke('remove-file-associations'),
    onOpenFile: (handler) => ipcRenderer.on('open-file', (_e, filePath) => handler(filePath)),
    offOpenFile: () => ipcRenderer.removeAllListeners('open-file'),
});
