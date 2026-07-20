import { useCallback, useEffect, useRef } from 'react';
import { buildPortableBackup, mergeBackupData } from '../backupMerge';
import { validateBackupData } from '../backupValidation';
import { stripBookAssetsForSync, toStoredBookRecord } from '../bookModel';
import { saveAppData, saveBooksToDB, saveSetting } from '../db';
import { migrateWorkshopData } from '../workshopModules';

const buildBookSignature = (record) => JSON.stringify({
    updatedAt: record.updatedAt || 0,
    progressUpdatedAt: record.progressUpdatedAt || 0,
    metadataUpdatedAt: record.metadataUpdatedAt || 0,
    annotationsUpdatedAt: record.annotationsUpdatedAt || 0,
    progress: record.progress || 0,
    lastLocation: record.lastLocation || null,
    bookmarks: record.bookmarks || [],
    notes: record.notes || '',
    isFav: !!record.isFav,
    rating: record.rating || 0,
    category: record.category || null,
    customTitle: record.customTitle || '',
    customAuthor: record.customAuthor || '',
    customCover: record.customCover || null,
    readerPreferences: record.readerPreferences || null,
});

export function useAppPersistence(state) {
    const persistTimerRef = useRef(null);
    const idleSaveHandleRef = useRef(null);
    const persistedBookSignaturesRef = useRef(new Map());
    const persistSettingsRef = useRef(null);
    const persistUserRef = useRef(null);
    const persistAddonsRef = useRef(null);
    const syncTimerRef = useRef(null);
    const syncDirtyRef = useRef(false);
    const syncSnapshotRef = useRef(null);
    const webdavSyncTimerRef = useRef(null);

    const resetPersistenceRuntime = useCallback(() => {
        clearTimeout(persistTimerRef.current);
        clearTimeout(persistSettingsRef.current);
        clearTimeout(persistUserRef.current);
        clearTimeout(persistAddonsRef.current);
        clearTimeout(syncTimerRef.current);
        clearTimeout(webdavSyncTimerRef.current);
        if (idleSaveHandleRef.current != null && 'cancelIdleCallback' in window) {
            window.cancelIdleCallback(idleSaveHandleRef.current);
        }
        idleSaveHandleRef.current = null;
        persistedBookSignaturesRef.current.clear();
        syncDirtyRef.current = false;
        syncSnapshotRef.current = null;
    }, []);

    useEffect(() => {
        if (!state.isDbLoaded || !state.isStateHydrated || state.isResettingRef.current) return;
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = setTimeout(() => {
            const doSave = async () => {
                idleSaveHandleRef.current = null;
                if (state.isResettingRef.current) return;
                const changedRecords = [];
                const liveIds = new Set();
                state.books.forEach(book => {
                    if (book.loading) return;
                    liveIds.add(book.id);
                    const record = toStoredBookRecord(book, {}, { includeFile: false });
                    const signature = buildBookSignature(record);
                    if (persistedBookSignaturesRef.current.get(book.id) !== signature) {
                        persistedBookSignaturesRef.current.set(book.id, signature);
                        changedRecords.push(record);
                    }
                });
                persistedBookSignaturesRef.current.forEach((_, bookId) => {
                    if (!liveIds.has(bookId)) persistedBookSignaturesRef.current.delete(bookId);
                });
                const results = await Promise.all([
                    changedRecords.length ? saveBooksToDB(changedRecords) : true,
                    saveSetting('categories', state.customCategories),
                    saveSetting('collections', state.manualCollections),
                ]);
                if (results.some(result => result === false)) {
                    console.warn('[SharkReader] Persistencia parcial fallida: libros/categorias/colecciones');
                }
            };
            if ('requestIdleCallback' in window) {
                idleSaveHandleRef.current = window.requestIdleCallback(doSave, { timeout: 5000 });
            } else {
                doSave();
            }
        }, 2000);
        return () => clearTimeout(persistTimerRef.current);
    }, [state.books, state.customCategories, state.manualCollections, state.isDbLoaded, state.isStateHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!state.isDbLoaded || !state.isStateHydrated || state.isResettingRef.current || !state.syncFolder || !window.electronAPI) return;
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(async () => {
            const bookRecords = state.books.filter(book => !book.loading).map(stripBookAssetsForSync);
            const localBackup = buildPortableBackup({
                books: bookRecords,
                deletedBooks: state.deletedBookTombstones,
                categories: state.customCategories,
                collections: state.manualCollections,
                stats: state.stats,
                user: state.userProfile || {},
                workshop: migrateWorkshopData({
                    addons: state.addons,
                    addonConfig: state.addonConfig,
                    externalSources: state.externalSources,
                }),
                achievements: state.achievements,
                settingsUpdatedAt: state.settingsUpdatedAt,
            });
            let backupToWrite = localBackup;
            if (window.electronAPI.readSyncFile) {
                try {
                    const existing = await window.electronAPI.readSyncFile(state.syncFolder);
                    if (existing?.content) {
                        if (existing.recoveredFromBackup) {
                            console.warn('[SharkReader] Sync local recuperado desde la copia .bak.');
                        }
                        const incomingBackup = validateBackupData(JSON.parse(existing.content)).backup;
                        backupToWrite = mergeBackupData(localBackup, incomingBackup);
                    }
                } catch (error) {
                    console.warn('[SharkReader] No se pudo fusionar backup de sync existente:', error);
                }
            }
            const writeResult = await window.electronAPI.writeSyncFile(state.syncFolder, JSON.stringify(backupToWrite)).catch(error => ({
                ok: false,
                msg: error?.message,
            }));
            if (writeResult?.ok) {
                syncDirtyRef.current = false;
                state.onSyncStatusChange?.('synced');
            } else {
                console.warn('[SharkReader] No se pudo escribir el sync local:', writeResult?.msg || 'Error desconocido');
                state.onSyncStatusChange?.('error');
            }
        }, 5000);
        syncDirtyRef.current = true;
        state.onSyncStatusChange?.('syncing');
        syncSnapshotRef.current = {
            books: state.books,
            deletedBookTombstones: state.deletedBookTombstones,
            customCategories: state.customCategories,
            manualCollections: state.manualCollections,
            stats: state.stats,
            userProfile: state.userProfile,
            addons: state.addons,
            addonConfig: state.addonConfig,
            externalSources: state.externalSources,
            syncFolder: state.syncFolder,
            achievements: state.achievements,
            settingsUpdatedAt: state.settingsUpdatedAt,
        };
        return () => clearTimeout(syncTimerRef.current);
    }, [
        state.books,
        state.deletedBookTombstones,
        state.customCategories,
        state.manualCollections,
        state.stats,
        state.userProfile,
        state.addons,
        state.addonConfig,
        state.externalSources,
        state.achievements,
        state.settingsUpdatedAt,
        state.isDbLoaded,
        state.isStateHydrated,
        state.syncFolder,
    ]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!state.isDbLoaded || !state.isStateHydrated || state.isResettingRef.current || !state.webdavConfig?.url || !window.electronAPI?.webdavWriteSyncFile) return;
        clearTimeout(webdavSyncTimerRef.current);
        webdavSyncTimerRef.current = setTimeout(async () => {
            const bookRecords = state.books.filter(book => !book.loading).map(stripBookAssetsForSync);
            const localBackup = buildPortableBackup({
                books: bookRecords,
                deletedBooks: state.deletedBookTombstones,
                categories: state.customCategories,
                collections: state.manualCollections,
                stats: state.stats,
                user: state.userProfile || {},
                workshop: migrateWorkshopData({
                    addons: state.addons,
                    addonConfig: state.addonConfig,
                    externalSources: state.externalSources,
                }),
                achievements: state.achievements,
                settingsUpdatedAt: state.settingsUpdatedAt,
            });
            let backupToWrite = localBackup;
            try {
                const existing = await window.electronAPI.webdavReadSyncFile(state.webdavConfig);
                if (existing?.ok && existing.content) {
                    const incomingBackup = validateBackupData(JSON.parse(existing.content)).backup;
                    backupToWrite = mergeBackupData(localBackup, incomingBackup);
                }
            } catch (error) {
                console.warn('[SharkReader] No se pudo fusionar backup de WebDAV existente:', error);
            }
            const writeResult = await window.electronAPI.webdavWriteSyncFile(state.webdavConfig, JSON.stringify(backupToWrite)).catch(error => ({
                ok: false,
                msg: error?.message,
            }));
            if (!writeResult?.ok) {
                console.warn('[SharkReader] No se pudo escribir el sync WebDAV:', writeResult?.msg || 'Error desconocido');
                state.onSyncStatusChange?.('error');
            } else {
                state.onSyncStatusChange?.('synced');
            }
        }, 5000);
        state.onSyncStatusChange?.('syncing');
        return () => clearTimeout(webdavSyncTimerRef.current);
    }, [
        state.books,
        state.deletedBookTombstones,
        state.customCategories,
        state.manualCollections,
        state.stats,
        state.userProfile,
        state.addons,
        state.addonConfig,
        state.externalSources,
        state.achievements,
        state.settingsUpdatedAt,
        state.isDbLoaded,
        state.isStateHydrated,
        state.webdavConfig,
    ]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const flushSyncOnClose = () => {
            const snapshot = syncSnapshotRef.current;
            if (!syncDirtyRef.current || !snapshot?.syncFolder || !window.electronAPI?.writeSyncFile) return;
            try {
                const backup = buildPortableBackup({
                    books: snapshot.books.filter(book => !book.loading).map(stripBookAssetsForSync),
                    deletedBooks: snapshot.deletedBookTombstones,
                    categories: snapshot.customCategories,
                    collections: snapshot.manualCollections,
                    stats: snapshot.stats,
                    user: snapshot.userProfile || {},
                    workshop: migrateWorkshopData({
                        addons: snapshot.addons,
                        addonConfig: snapshot.addonConfig,
                        externalSources: snapshot.externalSources,
                    }),
                    achievements: snapshot.achievements,
                    settingsUpdatedAt: snapshot.settingsUpdatedAt,
                });
                window.electronAPI.writeSyncFile(snapshot.syncFolder, JSON.stringify(backup)).catch(() => {});
                syncDirtyRef.current = false;
            } catch (_) {}
        };
        window.addEventListener('beforeunload', flushSyncOnClose);
        return () => window.removeEventListener('beforeunload', flushSyncOnClose);
    }, []);

    useEffect(() => {
        if (!state.isDbLoaded || !state.isStateHydrated || state.isResettingRef.current) return;
        localStorage.setItem('sharkreader_theme', JSON.stringify(state.theme));
        localStorage.setItem('sharkreader_auto_dark_mode', JSON.stringify(state.autoDarkMode));
        localStorage.setItem('sharkreader_lang', JSON.stringify(state.lang));
        localStorage.setItem('sharkreader_flow', JSON.stringify(state.readFlow));
        localStorage.setItem('sharkreader_layout', JSON.stringify(state.readLayout));
        localStorage.setItem('sharkreader_warm', JSON.stringify(state.warmMode));
        localStorage.setItem('sharkreader_libview', JSON.stringify(state.libraryView));
    }, [
        state.theme,
        state.autoDarkMode,
        state.lang,
        state.readFlow,
        state.readLayout,
        state.warmMode,
        state.libraryView,
        state.isDbLoaded,
        state.isStateHydrated,
    ]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!state.isDbLoaded || !state.isStateHydrated || state.isResettingRef.current) return;
        clearTimeout(persistSettingsRef.current);
        persistSettingsRef.current = setTimeout(() => {
            Promise.all([
                saveAppData('theme', state.theme),
                saveAppData('autoDarkMode', state.autoDarkMode),
                saveAppData('tutorialEnabled', state.tutorialEnabled),
                saveAppData('tutorialSeen', !state.showWelcomeTutorial),
                saveAppData('tutorialSeenHints', state.tutorialSeenHints),
                saveAppData('lang', state.lang),
                saveAppData('readFlow', state.readFlow),
                saveAppData('readLayout', state.readLayout),
                saveAppData('pageTransition', state.pageTransition),
                saveAppData('warmMode', state.warmMode),
                saveAppData('libraryView', state.libraryView),
                saveAppData('accentColor', state.accentColor),
            ]).then(results => {
                if (results.some(result => result === false)) {
                    console.warn('[SharkReader] Persistencia parcial fallida: settings');
                }
            });
        }, 1000);
        return () => clearTimeout(persistSettingsRef.current);
    }, [
        state.theme,
        state.autoDarkMode,
        state.tutorialEnabled,
        state.showWelcomeTutorial,
        state.tutorialSeenHints,
        state.lang,
        state.readFlow,
        state.readLayout,
        state.pageTransition,
        state.warmMode,
        state.libraryView,
        state.accentColor,
        state.isDbLoaded,
        state.isStateHydrated,
    ]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!state.isDbLoaded || !state.isStateHydrated || state.isResettingRef.current) return;
        clearTimeout(persistUserRef.current);
        persistUserRef.current = setTimeout(() => {
            Promise.all([
                saveAppData('userProfile', state.userProfile),
                saveAppData('vocabulary', state.vocabulary),
                saveAppData('dailyGoalMins', state.dailyGoalMins),
                saveAppData('weeklyGoalMins', state.weeklyGoalMins),
                saveAppData('yearlyGoal', state.yearlyGoal),
                saveAppData('achievements', state.achievements),
                saveAppData('journalEntries', state.journalEntries),
                saveAppData('challenges', state.challenges),
                saveAppData('currentFilter', state.currentFilter),
                saveAppData('sortBy', state.sortBy),
                saveAppData('categoryColors', state.categoryColors),
                saveAppData('deletedBookTombstones', state.deletedBookTombstones),
            ]).then(results => {
                if (results.some(result => result === false)) {
                    console.warn('[SharkReader] Persistencia parcial fallida: usuario/stats');
                }
            });
        }, 1500);
        return () => clearTimeout(persistUserRef.current);
    }, [
        state.userProfile,
        state.vocabulary,
        state.dailyGoalMins,
        state.weeklyGoalMins,
        state.yearlyGoal,
        state.achievements,
        state.journalEntries,
        state.challenges,
        state.currentFilter,
        state.sortBy,
        state.categoryColors,
        state.deletedBookTombstones,
        state.isDbLoaded,
        state.isStateHydrated,
    ]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!state.isDbLoaded || !state.isStateHydrated || state.isResettingRef.current) return;
        clearTimeout(persistAddonsRef.current);
        persistAddonsRef.current = setTimeout(() => {
            Promise.all([
                saveAppData('aiProvider', state.aiProvider),
                saveAppData('aiApiKey', state.aiApiKey),
                saveAppData('syncFolder', state.syncFolder),
                saveAppData('webdavConfig', state.webdavConfig),
                saveAppData('externalSources', state.externalSources),
                saveAppData('addons', state.addons),
                saveAppData('addonConfig', state.addonConfig),
                saveAppData('workshop', migrateWorkshopData({
                    addons: state.addons,
                    addonConfig: state.addonConfig,
                    externalSources: state.externalSources,
                })),
                saveAppData('settingsUpdatedAt', state.settingsUpdatedAt || 0),
            ]).then(results => {
                if (results.some(result => result === false)) {
                    console.warn('[SharkReader] Persistencia parcial fallida: addons/IA');
                }
            });
        }, 1500);
        return () => clearTimeout(persistAddonsRef.current);
    }, [
        state.aiProvider,
        state.aiApiKey,
        state.syncFolder,
        state.webdavConfig,
        state.externalSources,
        state.addons,
        state.addonConfig,
        state.settingsUpdatedAt,
        state.isDbLoaded,
        state.isStateHydrated,
    ]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => resetPersistenceRuntime, [resetPersistenceRuntime]);

    return { resetPersistenceRuntime };
}
