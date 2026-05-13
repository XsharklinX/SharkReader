const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    pickBookFiles: () => ipcRenderer.invoke('pick-book-files'),
    pickBookFolder: () => ipcRenderer.invoke('pick-book-folder'),
    startFolderImport: () => ipcRenderer.invoke('start-folder-import'),
    cancelFolderImport: (sessionId) => ipcRenderer.invoke('cancel-folder-import', sessionId),
    readBookFile: (filePath) => ipcRenderer.invoke('read-book-file', filePath),
    pickFolder: () => ipcRenderer.invoke('pick-folder'),
    writeSyncFile: (folder, content) => ipcRenderer.invoke('write-sync-file', folder, content),
    readSyncFile: (folder) => ipcRenderer.invoke('read-sync-file', folder),
    registerFileAssociations: () => ipcRenderer.invoke('register-file-associations'),
    removeFileAssociations: () => ipcRenderer.invoke('remove-file-associations'),
    onOpenFile: (handler) => ipcRenderer.on('open-file', (_e, filePath) => handler(filePath)),
    offOpenFile: () => ipcRenderer.removeAllListeners('open-file'),
    onFolderImportProgress: (handler) => ipcRenderer.on('folder-import-progress', (_e, payload) => handler(payload)),
    offFolderImportProgress: () => ipcRenderer.removeAllListeners('folder-import-progress'),
    onFolderImportBatch: (handler) => ipcRenderer.on('folder-import-batch', (_e, payload) => handler(payload)),
    offFolderImportBatch: () => ipcRenderer.removeAllListeners('folder-import-batch'),
    onFolderImportDone: (handler) => ipcRenderer.on('folder-import-done', (_e, payload) => handler(payload)),
    offFolderImportDone: () => ipcRenderer.removeAllListeners('folder-import-done'),
});
