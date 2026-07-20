const { contextBridge, ipcRenderer } = require('electron');

const subscriptions = new Map();
let nextSubscriptionId = 1;

const subscribe = (channel, handler, selectPayload = (_event, payload) => payload) => {
    if (typeof handler !== 'function') return null;
    const subscriptionId = `${channel}:${nextSubscriptionId++}`;
    const listener = (...args) => handler(selectPayload(...args));
    subscriptions.set(subscriptionId, { channel, listener });
    ipcRenderer.on(channel, listener);
    return subscriptionId;
};

const unsubscribe = (subscriptionId) => {
    const subscription = subscriptions.get(subscriptionId);
    if (!subscription) return false;
    ipcRenderer.removeListener(subscription.channel, subscription.listener);
    subscriptions.delete(subscriptionId);
    return true;
};

contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => ipcRenderer.invoke('app-version'),
    fetchOpenLibrary: (query) => ipcRenderer.invoke('fetch-openlibrary', query),
    pickBookFiles: () => ipcRenderer.invoke('pick-book-files'),
    pickBookFolder: () => ipcRenderer.invoke('pick-book-folder'),
    startFolderImport: () => ipcRenderer.invoke('start-folder-import'),
    startFolderImportPath: (folderPath) => ipcRenderer.invoke('start-folder-import-path', folderPath),
    cancelFolderImport: (sessionId) => ipcRenderer.invoke('cancel-folder-import', sessionId),
    readBookFile: (filePath) => ipcRenderer.invoke('read-book-file', filePath),
    rendererReady: () => ipcRenderer.invoke('renderer-ready'),
    fetchExternalCatalog: (sourceUrl, options) => ipcRenderer.invoke('fetch-external-catalog', sourceUrl, options),
    downloadExternalBook: (downloadUrl, fallbackName, options) => ipcRenderer.invoke('download-external-book', downloadUrl, fallbackName, options),
    pickFolder: () => ipcRenderer.invoke('pick-folder'),
    writeSyncFile: (folder, content) => ipcRenderer.invoke('write-sync-file', folder, content),
    readSyncFile: (folder) => ipcRenderer.invoke('read-sync-file', folder),
    // ── Sync WebDAV (Nextcloud/ownCloud/servidor propio) ──
    webdavTestConnection: (config) => ipcRenderer.invoke('webdav-test-connection', config),
    webdavWriteSyncFile: (config, content) => ipcRenderer.invoke('webdav-write-sync-file', config, content),
    webdavReadSyncFile: (config) => ipcRenderer.invoke('webdav-read-sync-file', config),
    registerFileAssociations: () => ipcRenderer.invoke('register-file-associations'),
    removeFileAssociations: () => ipcRenderer.invoke('remove-file-associations'),
    onOpenFile: (handler) => subscribe('open-file', handler),
    offOpenFile: unsubscribe,
    onFolderImportProgress: (handler) => subscribe('folder-import-progress', handler),
    offFolderImportProgress: unsubscribe,
    onFolderImportBatch: (handler) => subscribe('folder-import-batch', handler),
    offFolderImportBatch: unsubscribe,
    onFolderImportDone: (handler) => subscribe('folder-import-done', handler),
    offFolderImportDone: unsubscribe,
    // ── TTS neuronal ──
    synthesizeNeuralTts: (payload) => ipcRenderer.invoke('tts-synthesize', payload),
    // ── System tray ──
    updateTrayInfo: (payload) => ipcRenderer.send('update-tray-info', payload),
    onTrayContinueReading: (handler) => subscribe('tray-continue-reading', handler, () => undefined),
    offTrayContinueReading: unsubscribe,
    // ── Auto-updater ──
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
    onUpdateStatus: (handler) => subscribe('update-status', handler),
    offUpdateStatus: unsubscribe,
});
