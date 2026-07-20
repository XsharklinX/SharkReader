import { useCallback, useRef } from 'react';
import { resetAllAppDataVerified } from '../db';
import {
    DEFAULT_EXTERNAL_SOURCES,
    normalizeAddonConfig,
    normalizeAddonState,
} from '../workshopModules';

const EMPTY_STATS = {
    timeRead: 0,
    pagesTurned: 0,
    streak: 0,
    lastStreakDate: '',
    currentDailyMins: 0,
    lastActiveDate: '',
    streakSavers: 0,
    history: {},
    minutesByDay: {},
    maxStreak: 0,
};

export function useAccountReset(options) {
    const optionsRef = useRef(options);
    optionsRef.current = options;

    return useCallback(async () => {
        const {
            isResettingRef,
            refs,
            actions,
            setters,
        } = optionsRef.current;

        if (isResettingRef.current) return;
        isResettingRef.current = true;
        sessionStorage.clear();
        sessionStorage.setItem('sharkreader_pending_reset_verify', 'true');

        try {
            actions.resetPersistenceRuntime();
            clearTimeout(refs.persistStatsRef.current);
            clearTimeout(refs.openBookNotifyTimerRef.current);
            clearTimeout(refs.challengeToastTimerRef.current);
            clearInterval(refs.watchedFolderTimerRef.current);
            refs.openBookNotifyTimerRef.current = null;
            actions.resetTutorialCooldown();

            try {
                refs.booksRef.current.forEach(book => {
                    if (book?.url) URL.revokeObjectURL(book.url);
                });
                refs.activeObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
                refs.activeObjectUrlsRef.current.clear();
            } catch (error) {
                console.warn('[SharkReader] URL cleanup during reset failed:', error);
            }

            localStorage.clear();
            document.documentElement.style.removeProperty('--highlight');
            document.documentElement.style.removeProperty('--progress-bg');
            document.documentElement.style.removeProperty('--topbar-bg');

            refs.bookDedupKeysRef.current.clear();
            refs.bookTitleDedupKeysRef.current.clear();
            refs.metadataRepairingRef.current.clear();
            refs.contentIndexQueueRef.current = [];
            refs.contentIndexQueuedRef.current.clear();
            refs.contentIndexRunningRef.current = false;
            refs.contentIndexMapRef.current = {};
            refs.progressUpdateThrottleRef.current.clear();
            refs.activeBookIdRef.current = null;

            actions.resetImportState();
            actions.resetUI();
            actions.resetOnboardingState();
            actions.setIsDragging(false);

            setters.setAchievementToast(null);
            setters.setActiveTip(null);
            setters.setAchievements({});
            setters.setStats({ ...EMPTY_STATS });
            setters.setVocabulary([]);
            setters.setJournalEntries([]);
            setters.setChallenges([]);
            setters.setAddons(normalizeAddonState({}));
            setters.setAddonConfig(normalizeAddonConfig({}));
            setters.setExternalSources(DEFAULT_EXTERNAL_SOURCES);
            setters.setExternalCatalogState({ loading: false, error: '', catalog: null, importingId: null });
            setters.setCustomCategories(['Pendientes', 'Estudio']);
            setters.setManualCollections([]);
            setters.setDeletedBookTombstones({});
            setters.setCategoryColors({});
            setters.setContentIndexMap({});
            setters.setTabs([]);
            setters.setActiveTabId(null);
            setters.setTabTargetCfi({});
            setters.setRightTabId(null);
            setters.setPanelMode(false);
            setters.setLastReadId(null);
            setters.setCurrentFilter('all');
            setters.setSortBy('lastRead');
            setters.setSearchTerm('');
            setters.setFilterTags([]);
            setters.setFilterAuthors([]);
            setters.setSelectedBookIds(new Set());
            setters.setIsSelecting(false);
            setters.setActiveBookModal(null);
            setters.setShowComparison(false);
            setters.setShowLibraryIntel(false);
            setters.setShowAnnotationsModal(false);
            setters.setAnnotationSearch('');
            setters.setAnnotationBookFilter('all');
            setters.closeBookRoulette?.();
            setters.setTheme('dark');
            setters.setAutoDarkMode(false);
            setters.setLang('es');
            setters.setReadFlow('paginated');
            setters.setReadLayout('none');
            setters.setPageTransition('slide');
            setters.setWarmMode(false);
            setters.setLibraryView('grid');
            setters.setAccentColor(null);
            setters.setAiProvider('groq');
            setters.setAiApiKey('');
            setters.setSyncFolder('');
            setters.setWebdavConfig({ url: '', username: '', password: '' });
            setters.setDailyGoalMins(30);
            setters.setWeeklyGoalMins(120);
            setters.setYearlyGoal(12);
            setters.setAnniversaryInfo(null);
            setters.setView('library');
            setters.setUserProfile(null);
            setters.setBooks([]);

            const resetResult = await resetAllAppDataVerified({ retries: 1 });
            if (!resetResult.ok) {
                console.error('[SharkReader] Reset total no pudo limpiar todos los stores:', resetResult.counts);
                actions.showNoticeToast('No se pudieron borrar todos los datos. Se reintentará al reiniciar.', 'warning');
                return;
            }

            sessionStorage.removeItem('sharkreader_pending_reset_verify');
            actions.showNoticeToast('Cuenta y datos eliminados.', 'success');
        } catch (error) {
            console.error('[SharkReader] Error inesperado durante el reset total:', error);
            actions.showNoticeToast('El borrado no pudo completarse. Se reintentará al reiniciar.', 'warning');
        } finally {
            isResettingRef.current = false;
        }
    }, []);
}
