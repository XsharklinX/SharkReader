import { useEffect } from 'react';
import {
    getAppDataCounts,
    deleteBookFromDB,
    loadAppData,
    loadBooksFromDB,
    resetAllAppDataVerified,
    safeParse,
    saveAppData,
} from '../db';
import { hydrateStoredBook } from '../bookModel';
import { isBookDeletedByTombstone } from '../backupMerge';
import { normalizeAddonConfig, normalizeAddonState } from '../workshopModules';
import { normalizeReaderSession } from '../readerSession';
import { translations } from '../translations';

const LEGACY_STORAGE_KEYS = {
    stats: 'sharkreader_stats',
    journalEntries: 'sharkreader_journal',
    vocabulary: 'sharkreader_vocab',
    categories: 'sharkreader_categories',
    currentFilter: 'sharkreader_current_filter',
    sortBy: 'sharkreader_sort_by',
    readerSession: 'sharkreader_reader_session',
    userProfile: 'sharkreader_user',
    aiProvider: 'sharkreader_ai_provider',
    aiApiKey: 'sharkreader_ai_key',
    syncFolder: 'sharkreader_sync_folder',
    dailyGoalMins: 'sharkreader_daily_goal',
    yearlyGoal: 'sharkreader_yearly_goal',
    weeklyGoalMins: 'sharkreader_weekly_goal',
    achievements: 'sharkreader_achievements',
    addons: 'sharkreader_addons',
    addonConfig: 'sharkreader_addon_config',
    externalSources: 'sharkreader_external_sources',
    autoDarkMode: 'sharkreader_auto_dark_mode',
};

const hidePreloader = () => {
    if (typeof window.__hideSharkPreloader === 'function') {
        window.__hideSharkPreloader();
        return;
    }
    const loader = document.getElementById('shark-preloader');
    if (!loader) return;
    loader.style.opacity = '0';
    window.setTimeout(() => {
        loader.style.visibility = 'hidden';
        loader.style.pointerEvents = 'none';
        loader.style.display = 'none';
    }, 160);
};

export function useAppHydration({
    setBooks,
    setIsDbLoaded,
    setIsStateHydrated,
    activeObjectUrlsRef,
    setters,
}) {
    useEffect(() => {
        let cancelled = false;
        let resolved = false;

        const fallbackTimer = window.setTimeout(() => {
            if (cancelled || resolved) return;
            console.warn('[SharkReader] La base de datos tardo demasiado al iniciar; continuando sin bloquear la UI.');
            setIsDbLoaded(true);
            hidePreloader();
        }, 9000);

        const readStateValue = async (key) => {
            let value = await loadAppData(key);
            if (value !== null && value !== undefined) return value;
            const legacyKey = LEGACY_STORAGE_KEYS[key];
            if (!legacyKey) return value;
            value = safeParse(legacyKey, null);
            if (value === null || value === undefined) return value;
            const migrated = await saveAppData(key, value);
            if (migrated !== false) localStorage.removeItem(legacyKey);
            return value;
        };

        const hydrateState = async () => {
            const [
                stats,
                journalEntries,
                challenges,
                vocabulary,
                categories,
                collections,
                deletedBookTombstones,
                currentFilter,
                sortBy,
                readerSession,
                userProfile,
                theme,
                autoDarkMode,
                lang,
                readFlow,
                readLayout,
                pageTransition,
                warmMode,
                aiProvider,
                aiApiKey,
                syncFolder,
                webdavConfig,
                libraryView,
                dailyGoalMins,
                yearlyGoal,
                weeklyGoalMins,
                achievements,
                addons,
                addonConfig,
                externalSources,
                accentColor,
                settingsUpdatedAt,
                backupHistory,
                addonHistory,
            ] = await Promise.all([
                readStateValue('stats'),
                readStateValue('journalEntries'),
                readStateValue('challenges'),
                readStateValue('vocabulary'),
                readStateValue('categories'),
                readStateValue('collections'),
                readStateValue('deletedBookTombstones'),
                readStateValue('currentFilter'),
                readStateValue('sortBy'),
                readStateValue('readerSession'),
                readStateValue('userProfile'),
                readStateValue('theme'),
                readStateValue('autoDarkMode'),
                readStateValue('lang'),
                readStateValue('readFlow'),
                readStateValue('readLayout'),
                readStateValue('pageTransition'),
                readStateValue('warmMode'),
                readStateValue('aiProvider'),
                readStateValue('aiApiKey'),
                readStateValue('syncFolder'),
                readStateValue('webdavConfig'),
                readStateValue('libraryView'),
                readStateValue('dailyGoalMins'),
                readStateValue('yearlyGoal'),
                readStateValue('weeklyGoalMins'),
                readStateValue('achievements'),
                readStateValue('addons'),
                readStateValue('addonConfig'),
                readStateValue('externalSources'),
                readStateValue('accentColor'),
                readStateValue('settingsUpdatedAt'),
                readStateValue('backupHistory'),
                readStateValue('addonHistory'),
            ]);

            if (cancelled) return;
            if (stats != null) setters.setStats(stats);
            if (Array.isArray(journalEntries)) setters.setJournalEntries(journalEntries);
            if (Array.isArray(challenges)) setters.setChallenges(challenges);
            if (Array.isArray(vocabulary)) setters.setVocabulary(vocabulary);
            if (Array.isArray(categories)) {
                setters.setCustomCategories(categories.filter(cat => String(cat).toLowerCase() !== 'favoritos'));
            }
            if (Array.isArray(collections)) setters.setManualCollections(collections);
            if (deletedBookTombstones && typeof deletedBookTombstones === 'object') {
                setters.setDeletedBookTombstones(deletedBookTombstones);
            }
            if (currentFilter != null) setters.setCurrentFilter(currentFilter);
            if (sortBy != null) setters.setSortBy(sortBy);
            if (readerSession && typeof readerSession === 'object') {
                const session = normalizeReaderSession(readerSession);
                setters.setTabs(session.tabs);
                setters.setActiveTabId(session.activeTabId);
                setters.setTabTargetCfi(session.tabTargetCfi);
                setters.setPanelMode(session.panelMode);
                setters.setRightTabId(session.rightTabId);
            }
            if (userProfile != null) setters.setUserProfile(userProfile);
            if (theme != null) setters.setTheme(theme);
            if (typeof autoDarkMode === 'boolean') setters.setAutoDarkMode(autoDarkMode);
            if (lang != null) setters.setLang(translations[lang] ? lang : 'es');
            if (readFlow != null) setters.setReadFlow(readFlow);
            if (readLayout != null) setters.setReadLayout(readLayout);
            if (pageTransition != null) setters.setPageTransition(pageTransition);
            if (typeof warmMode === 'boolean') setters.setWarmMode(warmMode);
            if (aiProvider != null) setters.setAiProvider(aiProvider);
            if (aiApiKey != null) setters.setAiApiKey(aiApiKey);
            if (syncFolder != null) setters.setSyncFolder(syncFolder);
            if (webdavConfig && typeof webdavConfig === 'object') setters.setWebdavConfig(webdavConfig);
            if (libraryView != null) setters.setLibraryView(libraryView);
            if (Number.isFinite(Number(dailyGoalMins))) setters.setDailyGoalMins(dailyGoalMins);
            if (Number.isFinite(Number(yearlyGoal))) setters.setYearlyGoal(yearlyGoal);
            if (Number.isFinite(Number(weeklyGoalMins))) setters.setWeeklyGoalMins(weeklyGoalMins);
            if (achievements != null) setters.setAchievements(achievements);
            if (addons != null) setters.setAddons(normalizeAddonState(addons));
            if (addonConfig != null) setters.setAddonConfig(normalizeAddonConfig(addonConfig));
            if (Array.isArray(externalSources)) setters.setExternalSources(externalSources);
            if (accentColor != null) setters.setAccentColor(accentColor);
            if (Number.isFinite(Number(settingsUpdatedAt))) setters.setSettingsUpdatedAt(Number(settingsUpdatedAt));
            if (Array.isArray(backupHistory)) setters.setBackupHistory(backupHistory);
            if (addonHistory && typeof addonHistory === 'object') setters.setAddonHistory(addonHistory);
            return {
                deletedBookTombstones: deletedBookTombstones && typeof deletedBookTombstones === 'object'
                    ? deletedBookTombstones
                    : {},
            };
        };

        const bootstrap = async () => {
            const pendingReset = sessionStorage.getItem('sharkreader_pending_reset_verify') === 'true';
            if (pendingReset) {
                const counts = await getAppDataCounts();
                const hasResidualData = Object.values(counts).some(count => Number(count) > 0);
                let resetOk = true;
                if (hasResidualData) {
                    console.warn('[SharkReader] Reset incompleto detectado al arrancar; limpiando stores restantes.', counts);
                    const resetResult = await resetAllAppDataVerified({ retries: 1 });
                    resetOk = resetResult.ok;
                    if (!resetOk) {
                        console.error('[SharkReader] Reset verificado fallo al arrancar:', resetResult.counts);
                    }
                }
                if (resetOk) sessionStorage.removeItem('sharkreader_pending_reset_verify');
                if (cancelled) return;
                setBooks([]);
                setIsStateHydrated(true);
                setIsDbLoaded(true);
                resolved = true;
                window.clearTimeout(fallbackTimer);
                hidePreloader();
                return;
            }

            const [storedBooks, hydratedState] = await Promise.all([
                loadBooksFromDB(),
                hydrateState(),
            ]);
            if (cancelled) return;
            const hydratedBooks = storedBooks.map(hydrateStoredBook);
            const deletedIds = hydratedBooks
                .filter(book => isBookDeletedByTombstone(book, hydratedState?.deletedBookTombstones))
                .map(book => book.id);
            const deletedIdSet = new Set(deletedIds);
            const loaded = hydratedBooks.filter(book => !deletedIdSet.has(book.id));
            if (deletedIds.length) {
                Promise.all(deletedIds.map(deleteBookFromDB)).catch(() => {});
            }
            activeObjectUrlsRef.current = new Set(loaded.map(book => book.url).filter(Boolean));
            setBooks(loaded);
            setIsStateHydrated(true);
            setIsDbLoaded(true);
            resolved = true;
            window.clearTimeout(fallbackTimer);
            window.setTimeout(hidePreloader, 180);
        };

        bootstrap().catch((error) => {
            if (cancelled) return;
            console.error('[SharkReader] Error durante la hidratacion inicial:', error);
            resolved = true;
            setIsStateHydrated(true);
            setIsDbLoaded(true);
            window.clearTimeout(fallbackTimer);
            hidePreloader();
        });

        return () => {
            cancelled = true;
            window.clearTimeout(fallbackTimer);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
