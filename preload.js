const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => ipcRenderer.invoke('app-version'),
    fetchOpenLibrary: (query) => ipcRenderer.invoke('fetch-openlibrary', query),
    pickBookFiles: () => ipcRenderer.invoke('pick-book-files'),
    pickBookFolder: () => ipcRenderer.invoke('pick-book-folder'),
    startFolderImport: () => ipcRenderer.invoke('start-folder-import'),
    startFolderImportPath: (folderPath) => ipcRenderer.invoke('start-folder-import-path', folderPath),
    cancelFolderImport: (sessionId) => ipcRenderer.invoke('cancel-folder-import', sessionId),
    readBookFile: (filePath) => ipcRenderer.invoke('read-book-file', filePath),
    fetchExternalCatalog: (sourceUrl, options) => ipcRenderer.invoke('fetch-external-catalog', sourceUrl, options),
    downloadExternalBook: (downloadUrl, fallbackName, options) => ipcRenderer.invoke('download-external-book', downloadUrl, fallbackName, options),
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
    // ── TTS neuronal ──
    synthesizeNeuralTts: (payload) => ipcRenderer.invoke('tts-synthesize', payload),
    // ── System tray ──
    updateTrayInfo: (payload) => ipcRenderer.send('update-tray-info', payload),
    onTrayContinueReading: (handler) => ipcRenderer.on('tray-continue-reading', () => handler()),
    offTrayContinueReading: () => ipcRenderer.removeAllListeners('tray-continue-reading'),
    // ── Auto-updater ──
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
    onUpdateStatus: (handler) => ipcRenderer.on('update-status', (_e, payload) => handler(payload)),
    offUpdateStatus: () => ipcRenderer.removeAllListeners('update-status'),
});
