// API interna mínima para addons del Workshop — evita que la lógica de cada
// addon dependa directamente de window.electronAPI o de los setters de App.jsx.
// Namespaces: reader, library, storage, audio, notifications, sharky.

export function createWorkshopApi({ openBook, showNoticeToast, setStats }) {
    const electron = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

    return {
        reader: {
            open: (bookId) => openBook?.(bookId),
        },
        library: {
            listBooks: (books) => (books || []).filter(book => !book.loading),
        },
        storage: {
            canImportFolder: () => !!electron()?.startFolderImportPath,
            startFolderImportPath: (folder) => electron()?.startFolderImportPath?.(folder),
            canWriteSyncFile: () => !!electron()?.writeSyncFile,
            writeSyncFile: (folder, content) => electron()?.writeSyncFile?.(folder, content),
        },
        audio: {
            canPlay: () => !!electron()?.playSound,
            play: (soundId) => electron()?.playSound?.(soundId),
        },
        notifications: {
            notify: (message, kind = 'info') => showNoticeToast?.(message, kind),
        },
        sharky: {
            bumpStat: (key, delta = 1) => setStats?.(prev => ({ ...prev, [key]: (prev?.[key] || 0) + delta })),
        },
    };
}
