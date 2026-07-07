// SharkReader - App Component (v2 — Tabs + Optimizations + Series + Vocab + AI)
import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense, startTransition, useDeferredValue } from 'react';
import JSZip from 'jszip';
import { Icons, renderAvatar } from './icons';
import { translations, languageNames, RANDOM_EMOJIS } from './translations';
import { safeParse, loadBooksFromDB, saveBookToDB, saveBooksToDB, saveAppData, loadAppData, saveSetting, resetAllAppDataVerified, getAppDataCounts, saveCache, loadCacheByPrefix } from './db';
import { extractEpubMeta } from './epubMeta';
import { RARITY } from './achievements';
import { DEFAULT_EXTERNAL_SOURCES, migrateWorkshopData, normalizeAddonConfig, normalizeAddonState, validateAddonToggle } from './workshopModules';
import {
    applyImportedBookData,
    getBookDedupKey,
    getBookTitleDedupKey,
    hydrateStoredBook,
    stripBookFilesForExport,
    toStoredBookRecord,
    updateBookInList,
} from './bookModel';
import { buildPortableBackup, mergeBackupData } from './backupMerge';
import { clearDiagnosticEntries, getDiagnosticEntries, installDiagnostics } from './diagnostics';
import { readerXp, readerLevelFromXp } from './readingProgress';
import SettingsPanel from './SettingsPanel';
import TabBar from './TabBar';
import LoginModal from './LoginModal';
import EditProfileModal from './EditProfileModal';
import AnniversaryModal from './AnniversaryModal';
import StreakModal from './StreakModal';
import BookInfoModal from './BookInfoModal';
import UserMenu from './UserMenu';
import WorkshopPanel from './WorkshopPanel';
import { SharkyProvider } from './SharkyContext';
import SharkyWidget from './SharkyWidget';
import BookfinSprite from './SharkySprite';
import OnboardingTutorial from './OnboardingTutorial';
import { EpubReaderBoundary, ErrorBoundary, PanelErrorBoundary } from './ErrorBoundaries';
import { useBookImport } from './hooks/useBookImport';
import { useBookActions } from './hooks/useBookActions';
import { useOnboarding } from './hooks/useOnboarding';
import { useReadingSession } from './hooks/useReadingSession';
import { useStats } from './hooks/useStats';
import { useUI } from './hooks/useUI';
import { useLibrary } from './hooks/useLibrary';
import { useReaderTabSummaries } from './hooks/useReaderTabSummaries';
import { useStableReaderBook } from './hooks/useStableReaderBook';
import { useReaderPerformance } from './hooks/useReaderPerformance';
import { buildBookContentExcerpt, buildBookContentIndex, CONTENT_INDEX_CACHE_PREFIX } from './contentIndex';
import Sidebar from './Sidebar';
import LibraryView from './LibraryView';
import { sounds } from './sounds';

const EpubReader = lazy(() => import('./EpubReader'));
const PdfReader = lazy(() => import('./PdfReader'));
const AnalyticsView = lazy(() => import('./AnalyticsView'));

const panelLoader = (label = 'Cargando panel...') => (
    <div className="flex items-center justify-center py-8 px-6 text-sm font-semibold opacity-70">
        <div className="w-2.5 h-2.5 rounded-full bg-[var(--highlight)] animate-pulse mr-3"></div>
        <span>{label}</span>
    </div>
);
const readerLoader = (label = 'Preparando lector...') => (
    <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
                <Icons.BookOpen />
            </div>
            <p className="mt-4 text-base font-black">{label}</p>
            <p className="mt-1 text-sm opacity-60">Cargando visor y herramientas del libro...</p>
        </div>
    </div>
);

const splitBookTags = (value) => String(value || '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);

    // ─────────────────────────────────────────
    // APP PRINCIPAL
    // ─────────────────────────────────────────
    const App = () => {
        useEffect(() => {
            installDiagnostics();
        }, []);


        // ── LIBROS ──
        const [books, setBooks] = useState([]);
        const [isDbLoaded, setIsDbLoaded] = useState(false);
        const [isStateHydrated, setIsStateHydrated] = useState(false);

        // ── NAVEGACIÓN / TABS ──
        const [view, setView] = useState('library');
        const [tabs, setTabs] = useState([]);
        const [activeTabId, setActiveTabId] = useState(null);
        const [tabTargetCfi, setTabTargetCfi] = useState({});
        const [lastReadId, setLastReadId] = useState(null);

        // ── MULTI-PANEL ──
        const [panelMode, setPanelMode] = useState(false);
        const [rightTabId, setRightTabId] = useState(null);

        // ── BIBLIOTECA ──
        const [searchTerm, setSearchTerm] = useState('');
        const deferredSearchTerm = useDeferredValue(searchTerm);
        const [customCategories, setCustomCategories] = useState(() => {
            const s = safeParse('sharkreader_categories', null);
            return (s && Array.isArray(s)) ? s.filter(c => c.toLowerCase() !== 'favoritos') : ['Pendientes', 'Estudio'];
        });
        const [manualCollections, setManualCollections] = useState([]);
        const [currentFilter, setCurrentFilter] = useState('all');
        const [sortBy, setSortBy] = useState('lastRead');
        const [showTagSection, setShowTagSection] = useState(false);
        const [showRatingSection, setShowRatingSection] = useState(false);
        const [annotationSearch, setAnnotationSearch] = useState('');
        const [annotationBookFilter, setAnnotationBookFilter] = useState('all');
        const [categoryColors, setCategoryColors] = useState(() => safeParse('sharkreader_cat_colors', {}));
        const [contentIndexMap, setContentIndexMap] = useState({});
        const [activeBookModal, setActiveBookModal] = useState(null);

        // ── v2.9: MULTI-SELECT / BULK / COMBINED FILTERS / QUICK EDIT ──
        const [selectedBookIds, setSelectedBookIds] = useState(() => new Set());
        const [isSelecting, setIsSelecting] = useState(false);
        const [filterTags, setFilterTags] = useState([]);
        const [filterAuthors, setFilterAuthors] = useState([]);
        const [quickEditBookId, setQuickEditBookId] = useState(null);
        const [renamingCollectionId, setRenamingCollectionId] = useState(null);
        const [renamingCollectionValue, setRenamingCollectionValue] = useState('');

        // ── USUARIO / STATS ──
        const [userProfile, setUserProfile] = useState(null);
        const isResettingRef = useRef(false);
        const { stats, setStats, currentWeekMins, persistStatsRef } = useStats({ isDbLoaded, isStateHydrated, isResettingRef });

        // ── UI ──
        const {
            sidebarOpen, setSidebarOpen,
            settingsOpen, setSettingsOpen,
            isFullscreen,
            showLoginModal, setShowLoginModal,
            showUserMenu, setShowUserMenu,
            tempLoginName, setTempLoginName,
            tempLoginAvatar, setTempLoginAvatar,
            showEditProfileModal, setShowEditProfileModal,
            tempEditName, setTempEditName,
            tempEditAvatar, setTempEditAvatar,
            showStreakModal, setShowStreakModal,
            showWorkshop, setShowWorkshop,
            showJournalModal, setShowJournalModal,
            showVocabPanel, setShowVocabPanel,
            vocabSearch, setVocabSearch,
            showAuthorSection, setShowAuthorSection,
            contextMenu, setContextMenu,
            draggedBookId, setDraggedBookId,
            dropTargetCat, setDropTargetCat,
            noticeToast,
            showNoticeToast,
            noticeToastTimerRef,
            handleRandomEmoji,
            resetUI,
        } = useUI();

        const [libraryView, setLibraryView] = useState(() => safeParse('sharkreader_libview', 'grid'));

        // ── PREFERENCIAS ──
        const [theme, setTheme] = useState(() => safeParse('sharkreader_theme', 'dark'));
        const [autoDarkMode, setAutoDarkMode] = useState(() => safeParse('sharkreader_auto_dark_mode', false));
        const [themeClock, setThemeClock] = useState(() => Date.now());
        const [lang, setLang] = useState(() => {
            const storedLang = safeParse('sharkreader_lang', 'es');
            return translations[storedLang] ? storedLang : 'es';
        });
        const [readFlow, setReadFlow] = useState(() => safeParse('sharkreader_flow', 'paginated'));
        const [readLayout, setReadLayout] = useState(() => safeParse('sharkreader_layout', 'none'));
        const [pageTransition, setPageTransition] = useState('slide');
        const [warmMode, setWarmMode] = useState(() => safeParse('sharkreader_warm', false));

        // ── VOCABULARIO ──
        const [vocabulary, setVocabulary] = useState([]);

        // ── AI ──
        const [aiProvider, setAiProvider] = useState('groq');
        const [aiApiKey, setAiApiKey] = useState('');

        const {
            tutorialEnabled, setTutorialEnabled,
            showWelcomeTutorial,
            tutorialQueue,
            tutorialStepIndex,
            tutorialSeenHints,
            activeTutorialHint,
            dismissTutorialHints,
            restartTutorial,
            handleTutorialNext,
            completeWelcomeTutorial,
            skipWelcomeTutorial,
            resetTutorialCooldown,
        } = useOnboarding({ view, booksCount: books.length });

        // ── SYNC CARPETA LOCAL ──
        const [syncFolder, setSyncFolder] = useState('');

        // ── ACCENT COLOR ──
        const [accentColor, setAccentColor] = useState(() => safeParse('sharkreader_accent', null));

        // ── ANIVERSARIOS ──
        const [anniversaryInfo, setAnniversaryInfo] = useState(null);

        // ── OBJETIVOS ──
        const [dailyGoalMins, setDailyGoalMins] = useState(30);
        const [yearlyGoal, setYearlyGoal] = useState(12);
        const [weeklyGoalMins, setWeeklyGoalMins] = useState(120);

        // ── REFS ──
        const fileInputRef = useRef(null);
        const folderInputRef = useRef(null);
        const importInputRef = useRef(null);
        const avatarInputRef = useRef(null);
        const coverInputRef = useRef(null);
        const libraryScrollRef = useRef(null);
        const booksRef = useRef([]); // To safely access books in async effects without dependencies
        const contentIndexQueueRef = useRef([]);
        const contentIndexRunningRef = useRef(false);
        const contentIndexMapRef = useRef({});
        const contentIndexQueuedRef = useRef(new Set());
        const persistTimerRef = useRef(null);       // books debounce
        const persistedBookSignaturesRef = useRef(new Map());
        const persistSettingsRef = useRef(null);    // display prefs → IndexedDB debounce
        const persistUserRef = useRef(null);        // user data & goals debounce
        const persistAddonsRef = useRef(null);      // addons & AI config debounce
        const syncTimerRef = useRef(null);
        const activeBookIdRef = useRef(null);
        const metadataRepairingRef = useRef(new Set());
        const bookDedupKeysRef = useRef(new Set());
        const bookTitleDedupKeysRef = useRef(new Set());
        const activeObjectUrlsRef = useRef(new Set());
        const progressUpdateThrottleRef = useRef(new Map());
        const watchedFolderTimerRef = useRef(null);
        const watchedFolderLastRunRef = useRef(0);
        const openBookNotifyTimerRef = useRef(null);

        // ── LOGROS / WORKSHOP / ANALYTICS ──
        const [achievements, setAchievements] = useState({});
        const [achievementToast, setAchievementToast] = useState(null);
        const [addons, setAddons] = useState({});
        const [addonConfig, setAddonConfig] = useState(() => normalizeAddonConfig({}));
        const [externalSources, setExternalSources] = useState(DEFAULT_EXTERNAL_SOURCES);
        const [externalCatalogState, setExternalCatalogState] = useState({ loading: false, error: '', catalog: null, importingId: null });
        const [rouletteBook, setRouletteBook] = useState(null);
        const sharkyActionsRef = useRef(null);
        const addonsRef = useRef({});
        const [journalEntries, setJournalEntries] = useState([]);
        const [libraryViewport, setLibraryViewport] = useState({ width: 0, height: 0, scrollTop: 0 });

        const t = translations[lang] || translations['es'];
        const appliedTheme = useMemo(() => {
            if (!autoDarkMode) return theme;
            const hour = new Date(themeClock).getHours();
            return hour >= 19 || hour < 7 ? 'dark' : 'light';
        }, [autoDarkMode, theme, themeClock]);

        const booksById = useMemo(() => new Map(books.map(book => [book.id, book])), [books]);
        const readerTabBooks = useReaderTabSummaries(tabs, booksById);
        const { handleReaderPageTurn } = useReaderPerformance({ setStats, addonsRef, addonConfig });
        const readerLevel = useMemo(() => {
            const xp = readerXp({
                minutesRead: stats.timeRead || 0,
                booksFinished: books.filter(book => book.isFinished).length,
                bookmarks: books.reduce((sum, book) => sum + (book.bookmarks?.length || 0), 0),
                notedBooks: books.reduce((sum, book) => sum + (book.notes ? 1 : 0), 0),
            });
            return readerLevelFromXp(xp, addonConfig.levelSystem?.xpPerLevel || 100);
        }, [addonConfig.levelSystem?.xpPerLevel, books, stats.timeRead]);

        const bookPayloadsToFiles = useCallback((payloads = []) => {
            return payloads.map(payload => {
                const rawBase64 = payload.dataBase64 || payload.data || '';
                if (!rawBase64) return null;
                const binary = atob(payload.dataBase64 || payload.data || '');
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i += 1) {
                    bytes[i] = binary.charCodeAt(i);
                }
                const file = new File([bytes], payload.name, {
                    type: payload.type || '',
                    lastModified: payload.lastModified || Date.now()
                });
                file.sourcePath = payload.path;
                if (payload.meta) file.nativeMeta = payload.meta;
                return file;
            }).filter(Boolean);
        }, []);

        // ─────────────────────────────────────────
        // HOOKS EXTRAÍDOS
        // ─────────────────────────────────────────
        const {
            isDragging,
            setIsDragging,
            folderImport,
            setFolderImport,
            failedImportRetryQueue,
            setFailedImportRetryQueue,
            beginFolderImportSession,
            handleDragOver,
            handleDragLeave,
            handleDrop,
            openFilePicker,
            openFolderPicker,
            handleFilesUpload,
            processFiles,
            importExternalCatalogEntry,
            cancelActiveFolderImport,
            retryFailedFolderImports,
            resetImportState,
        } = useBookImport({
            setBooks,
            activeObjectUrlsRef,
            bookDedupKeysRef,
            bookTitleDedupKeysRef,
            fileInputRef,
            folderInputRef,
            showNoticeToast,
            view,
            t,
            externalCatalogState,
            setExternalCatalogState,
            bookPayloadsToFiles,
        });

        // ─────────────────────────────────────────
        // EFECTOS
        // ─────────────────────────────────────────
        useEffect(() => {
            booksRef.current = books;
            bookDedupKeysRef.current = new Set(books.map(getBookDedupKey));
            bookTitleDedupKeysRef.current = new Set(books.map(getBookTitleDedupKey));
        }, [books]);

        useEffect(() => {
            contentIndexMapRef.current = contentIndexMap;
        }, [contentIndexMap]);

        useEffect(() => {
            if (!isDbLoaded || !isStateHydrated) return;
            const searchNeedle = deferredSearchTerm.trim();
            if (searchNeedle.length < 3) return;
            const candidates = books
                .filter(book => !book.loading && book.type === 'epub' && book.file)
                .filter(book => !contentIndexMapRef.current[book.id]?.text && !contentIndexQueuedRef.current.has(book.id))
                .slice(0, 12)
                .map(book => book.id);
            if (!candidates.length) return;
            candidates.forEach(bookId => {
                contentIndexQueuedRef.current.add(bookId);
                contentIndexQueueRef.current.push(bookId);
            });
            if (contentIndexRunningRef.current) return;

            let cancelled = false;
            const run = async () => {
                contentIndexRunningRef.current = true;
                let pendingIndexUpdates = {};
                let pendingIndexCount = 0;

                const flushPendingIndexUpdates = () => {
                    if (cancelled || pendingIndexCount === 0) return;
                    const updates = pendingIndexUpdates;
                    pendingIndexUpdates = {};
                    pendingIndexCount = 0;
                    setContentIndexMap(prev => {
                        let changed = false;
                        const next = { ...prev };
                        Object.entries(updates).forEach(([indexedBookId, payload]) => {
                            if (next[indexedBookId]?.text !== payload.text) {
                                next[indexedBookId] = payload;
                                changed = true;
                            }
                        });
                        if (!changed) return prev;
                        contentIndexMapRef.current = next;
                        return next;
                    });
                };

                while (!cancelled && contentIndexQueueRef.current.length > 0) {
                    const bookId = contentIndexQueueRef.current.shift();
                    if (!bookId || contentIndexMapRef.current[bookId]?.text) {
                        contentIndexQueuedRef.current.delete(bookId);
                        continue;
                    }
                    const book = booksRef.current.find(item => item.id === bookId);
                    if (!book?.file || (book.type !== 'epub' && book.type !== 'pdf')) {
                        contentIndexQueuedRef.current.delete(bookId);
                        continue;
                    }
                    try {
                        const startedAt = performance.now();
                        const text = await buildBookContentIndex(book);
                        const payload = {
                            text,
                            excerpt: buildBookContentExcerpt(text),
                            indexedAt: Date.now(),
                        };
                        await saveCache(`${CONTENT_INDEX_CACHE_PREFIX}${bookId}`, payload);
                        const elapsed = Math.round(performance.now() - startedAt);
                        if (elapsed > 1500) {
                            console.info(`[SharkReader] Indexado lento: ${book.name || bookId} (${elapsed}ms)`);
                        }
                        if (!cancelled && contentIndexMapRef.current[bookId]?.text !== payload.text) {
                            pendingIndexUpdates[bookId] = payload;
                            pendingIndexCount += 1;
                            if (pendingIndexCount >= 2) flushPendingIndexUpdates();
                        }
                    } catch (error) {
                        console.warn(`[SharkReader] No se pudo indexar contenido para ${book?.name || bookId}:`, error);
                    } finally {
                        contentIndexQueuedRef.current.delete(bookId);
                    }
                    await new Promise(resolve => setTimeout(resolve, 180));
                }
                flushPendingIndexUpdates();
                contentIndexRunningRef.current = false;
            };

            run();
            return () => {
                cancelled = true;
            };
        }, [books, deferredSearchTerm, isDbLoaded, isStateHydrated]);

        useEffect(() => {
            if (view !== 'library') return;
            const node = libraryScrollRef.current;
            if (!node) return;

            let frame = 0;
            const syncViewport = () => {
                cancelAnimationFrame(frame);
                frame = requestAnimationFrame(() => {
                    const next = {
                        width: Math.round(node.clientWidth),
                        height: Math.round(node.clientHeight),
                        scrollTop: Math.round(node.scrollTop / 48) * 48,
                    };
                    setLibraryViewport(prev => {
                        if (prev.width === next.width && prev.height === next.height && prev.scrollTop === next.scrollTop) {
                            return prev;
                        }
                        return next;
                    });
                });
            };

            syncViewport();
            node.addEventListener('scroll', syncViewport, { passive: true });
            const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncViewport) : null;
            resizeObserver?.observe(node);

            return () => {
                cancelAnimationFrame(frame);
                node.removeEventListener('scroll', syncViewport);
                resizeObserver?.disconnect();
            };
        }, [view]);

        useEffect(() => {
            libraryScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }, [currentFilter, filterTags.length, filterAuthors.length]);

        useEffect(() => {
            document.body.className = `theme-${appliedTheme}`;
            setStats(prev => {
                const used = new Set(prev.themesUsed || []);
                used.add(appliedTheme);
                if (used.size === (prev.themesUsed || []).length) return prev;
                return { ...prev, themesUsed: [...used] };
            });
        }, [appliedTheme]);

        useEffect(() => {
            if (!autoDarkMode) return;
            const timer = setInterval(() => setThemeClock(Date.now()), 60000);
            return () => clearInterval(timer);
        }, [autoDarkMode]);

        // Apply accent color CSS variables
        useEffect(() => {
            const root = document.documentElement;
            if (accentColor) {
                root.style.setProperty('--highlight', accentColor.value);
                root.style.setProperty('--progress-bg', accentColor.value);
                root.style.setProperty('--topbar-bg', accentColor.topbar);
                localStorage.setItem('sharkreader_accent', JSON.stringify(accentColor));
            } else {
                root.style.removeProperty('--highlight');
                root.style.removeProperty('--progress-bg');
                root.style.removeProperty('--topbar-bg');
                localStorage.removeItem('sharkreader_accent');
            }
        }, [accentColor]);

        // Cargar libros desde IndexedDB
        useEffect(() => {
            let cancelled = false;
            let didFallback = false;
            let didResolve = false;

            const hideLoader = () => {
                if (typeof window !== 'undefined' && typeof window.__hideSharkPreloader === 'function') {
                    window.__hideSharkPreloader();
                    return;
                }
                const loader = document.getElementById('shark-preloader');
                if (!loader) return;
                loader.style.opacity = '0';
                setTimeout(() => {
                    loader.style.visibility = 'hidden';
                    loader.style.pointerEvents = 'none';
                    loader.style.display = 'none';
                }, 160);
            };

            const fallbackTimer = setTimeout(() => {
                if (cancelled || didResolve) return;
                didFallback = true;
                console.warn('[SharkReader] La base de datos tardo demasiado al iniciar; continuando sin bloquear la UI.');
                setIsDbLoaded(true);
                hideLoader();
            }, 9000);

            loadBooksFromDB().then(async storedBooks => {
                if (cancelled) return;
                didResolve = true;
                if (sessionStorage.getItem('sharkreader_pending_reset_verify') === 'true') {
                    const counts = await getAppDataCounts();
                    const hasResidualData = Object.values(counts).some(count => Number(count) > 0);
                    if (hasResidualData) {
                        console.warn('[SharkReader] Reset incompleto detectado al arrancar; limpiando stores restantes.', counts);
                        const resetResult = await resetAllAppDataVerified({ retries: 1 });
                        if (!resetResult.ok) {
                            console.error('[SharkReader] Reset verificado fallo al arrancar:', resetResult.counts);
                        }
                        storedBooks = [];
                    }
                    sessionStorage.removeItem('sharkreader_pending_reset_verify');
                    setIsStateHydrated(true);
                }
                const loaded = storedBooks.map(hydrateStoredBook);
                activeObjectUrlsRef.current = new Set(loaded.map(b => b.url).filter(Boolean));
                setBooks(loaded);
                setIsDbLoaded(true);
                clearTimeout(fallbackTimer);
                if (!didFallback) {
                    setTimeout(hideLoader, 180);
                }
            }).catch((err) => {
                console.error('[SharkReader] Error cargando libros desde IndexedDB:', err);
                if (cancelled) return;
                didResolve = true;
                if (sessionStorage.getItem('sharkreader_pending_reset_verify') === 'true') {
                    resetAllAppDataVerified({ retries: 1 }).finally(() => {
                        sessionStorage.removeItem('sharkreader_pending_reset_verify');
                        setIsStateHydrated(true);
                    });
                }
                clearTimeout(fallbackTimer);
                setIsDbLoaded(true);
                hideLoader();
            });

            return () => {
                cancelled = true;
                clearTimeout(fallbackTimer);
            };
        }, []);

        // Cargar estado crítico desde IndexedDB; localStorage solo se usa como migración legacy.
        useEffect(() => {
            if (sessionStorage.getItem('sharkreader_pending_reset_verify') === 'true') return;
            let cancelled = false;
            const legacyFallbacks = {
                stats: () => safeParse('sharkreader_stats', null),
                journalEntries: () => safeParse('sharkreader_journal', null),
                vocabulary: () => safeParse('sharkreader_vocab', null),
                categories: () => safeParse('sharkreader_categories', null),
                currentFilter: () => safeParse('sharkreader_current_filter', null),
                sortBy: () => safeParse('sharkreader_sort_by', null),
                readerSession: () => safeParse('sharkreader_reader_session', null),
                userProfile: () => safeParse('sharkreader_user', null),
                aiProvider: () => safeParse('sharkreader_ai_provider', null),
                aiApiKey: () => safeParse('sharkreader_ai_key', null),
                syncFolder: () => safeParse('sharkreader_sync_folder', null),
                dailyGoalMins: () => safeParse('sharkreader_daily_goal', null),
                yearlyGoal: () => safeParse('sharkreader_yearly_goal', null),
                weeklyGoalMins: () => safeParse('sharkreader_weekly_goal', null),
                achievements: () => safeParse('sharkreader_achievements', null),
                addons: () => safeParse('sharkreader_addons', null),
                addonConfig: () => safeParse('sharkreader_addon_config', null),
                externalSources: () => safeParse('sharkreader_external_sources', null),
                autoDarkMode: () => safeParse('sharkreader_auto_dark_mode', null),
            };
            const applyStoredValue = async (key, setter, validator = value => value !== null && value !== undefined) => {
                let value = await loadAppData(key);
                if ((value === null || value === undefined) && legacyFallbacks[key]) {
                    value = legacyFallbacks[key]();
                    if (value !== null && value !== undefined) saveAppData(key, value);
                }
                if (!cancelled && validator(value)) setter(value);
            };

            const loadStoredState = async () => {
                await Promise.all([
                    applyStoredValue('stats', setStats),
                    applyStoredValue('journalEntries', setJournalEntries, Array.isArray),
                    applyStoredValue('vocabulary', setVocabulary, Array.isArray),
                    applyStoredValue('categories', value => setCustomCategories(value.filter(cat => String(cat).toLowerCase() !== 'favoritos')), Array.isArray),
                    applyStoredValue('collections', setManualCollections, Array.isArray),
                    applyStoredValue('currentFilter', setCurrentFilter),
                    applyStoredValue('sortBy', setSortBy),
                    applyStoredValue('readerSession', value => {
                        setTabs(Array.isArray(value?.tabs) ? value.tabs : []);
                        setActiveTabId(value?.activeTabId || null);
                        setTabTargetCfi(value?.tabTargetCfi || {});
                        setPanelMode(!!value?.panelMode);
                        setRightTabId(value?.rightTabId || null);
                    }, value => value && typeof value === 'object'),
                    applyStoredValue('userProfile', setUserProfile),
                    applyStoredValue('theme', setTheme),
                    applyStoredValue('autoDarkMode', value => setAutoDarkMode(!!value), value => typeof value === 'boolean'),
                    applyStoredValue('lang', value => setLang(translations[value] ? value : 'es')),
                    applyStoredValue('readFlow', setReadFlow),
                    applyStoredValue('readLayout', setReadLayout),
                    applyStoredValue('pageTransition', setPageTransition),
                    applyStoredValue('warmMode', setWarmMode, value => typeof value === 'boolean'),
                    applyStoredValue('aiProvider', setAiProvider),
                    applyStoredValue('aiApiKey', setAiApiKey),
                    applyStoredValue('syncFolder', setSyncFolder),
                    applyStoredValue('libraryView', setLibraryView),
                    applyStoredValue('dailyGoalMins', setDailyGoalMins, value => Number.isFinite(Number(value))),
                    applyStoredValue('yearlyGoal', setYearlyGoal, value => Number.isFinite(Number(value))),
                    applyStoredValue('weeklyGoalMins', setWeeklyGoalMins, value => Number.isFinite(Number(value))),
                    applyStoredValue('achievements', setAchievements),
                    applyStoredValue('addons', value => setAddons(normalizeAddonState(value))),
                    applyStoredValue('addonConfig', value => setAddonConfig(normalizeAddonConfig(value))),
                    applyStoredValue('externalSources', setExternalSources, Array.isArray),
                    applyStoredValue('accentColor', setAccentColor),
                ]);
            };

            loadStoredState().catch((error) => {
                if (!cancelled) {
                    console.error('[SharkReader] Error cargando estado desde IndexedDB:', error);
                }
            }).finally(() => {
                if (!cancelled) setIsStateHydrated(true);
            });

            return () => {
                cancelled = true;
            };
        }, []);

        useEffect(() => {
            if (!isDbLoaded) return;
            let cancelled = false;
            loadCacheByPrefix(CONTENT_INDEX_CACHE_PREFIX).then((entries) => {
                if (cancelled || !Array.isArray(entries) || !entries.length) return;
                const next = {};
                entries.forEach(({ key, value }) => {
                    const bookId = String(key || '').slice(CONTENT_INDEX_CACHE_PREFIX.length);
                    if (!bookId || !value?.text) return;
                    next[bookId] = value;
                });
                if (Object.keys(next).length) setContentIndexMap(next);
            }).catch((error) => {
                console.warn('[SharkReader] No se pudo cargar el indice de contenido:', error);
            });
            return () => {
                cancelled = true;
            };
        }, [isDbLoaded]);

        // Re-extracción de metadata en background para libros sin autor real o portada
        // NOTE: dependency is [isDbLoaded] only — 'books' is read via ref to avoid infinite loops
        useEffect(() => {
            if (!isDbLoaded) return;

            // Delay metadata repair so startup and first library render stay responsive.
            const timer = setTimeout(async () => {
                const UNKNOWN = ['Autor desconocido', 'Unknown Author', 'Autor Desconocido', 'unknown author'];

                // En Electron instalado, un File de IDB puede fallar si perdió el permiso.
                const currentBooks = booksRef.current || [];
                const needsMeta = currentBooks
                    .filter(b =>
                        b.type === 'epub' &&
                        b.file &&
                        (!b.coverUrl || UNKNOWN.some(u => u.toLowerCase() === (b.originalAuthor || '').toLowerCase())) &&
                        !metadataRepairingRef.current.has(b.id)
                    )
                    .slice(0, 8);

                if (!needsMeta.length) {
                    console.log('[SharkReader] No hay libros que necesiten re-extracción');
                    return;
                }

                console.log(`[SharkReader] Re-extrayendo metadata para ${needsMeta.length} libro(s)...`);
                needsMeta.forEach(book => metadataRepairingRef.current.add(book.id));

                const withTimeout = (p, ms, def = null) =>
                    Promise.race([Promise.resolve(p).catch(e => { console.error('[SharkReader] extractEpubMeta error:', e); return def; }), new Promise(r => setTimeout(() => r(def), ms))]);

                for (const book of needsMeta) {
                    await new Promise(r => setTimeout(r, 450));
                    try {
                        console.log(`[SharkReader] Extrayendo: ${book.originalTitle} (file size: ${book.file?.size})`);
                        let meta = null;
                        let repairFile = book.file;

                        if (book.sourcePath && window.electronAPI?.readBookFile) {
                            const payload = await window.electronAPI.readBookFile(book.sourcePath);
                            const files = bookPayloadsToFiles(payload ? [payload] : []);
                            if (files[0]) {
                                repairFile = files[0];
                                meta = files[0].nativeMeta || null;
                            }
                        }

                        if (!meta) {
                            meta = await withTimeout(extractEpubMeta(repairFile), 20000, null);
                        }

                        if (!meta) {
                            console.warn(`[SharkReader] extractEpubMeta devolvió null para: ${book.originalTitle}`);
                            metadataRepairingRef.current.delete(book.id);
                            continue;
                        }

                        console.log(`[SharkReader] OK: title=${meta.title}, creator=${meta.creator}, hasCover=${!!meta.coverBase64}`);

                        const realTitle  = (meta.title || '').trim() || book.originalTitle;
                        const realAuthor = (meta.creator || '').trim() || book.originalAuthor;
                        const coverBase64 = meta.coverBase64 || null;
                        const finalCover = book.coverUrl || coverBase64;
                        const now = Date.now();

                        startTransition(() => {
                            setBooks(prev => updateBookInList(prev, book.id, (b) => ({
                                ...b,
                                file:           repairFile,
                                sourcePath:     repairFile.sourcePath || b.sourcePath || null,
                                name:           b.name === b.originalTitle ? realTitle : b.name,
                                author:         UNKNOWN.some(u => u.toLowerCase() === (b.author || '').toLowerCase()) ? realAuthor : b.author,
                                originalTitle:  realTitle,
                                originalAuthor: realAuthor,
                                coverUrl:       finalCover,
                                description:    b.description || meta.description || '',
                                publisher:      b.publisher  || meta.publisher || '',
                                tags:           b.tags       || meta.subject || '',
                                metadataUpdatedAt: now,
                                updatedAt: now,
                            })));
                        });
                        await saveBookToDB(toStoredBookRecord({
                            ...book,
                            file: repairFile,
                            sourcePath: repairFile.sourcePath || book.sourcePath || null,
                            originalTitle: realTitle,
                            originalAuthor: realAuthor,
                            coverBase64,
                            coverUrl: finalCover,
                            description: book.description || meta.description || '',
                            publisher: book.publisher || meta.publisher || '',
                            tags: book.tags || meta.subject || '',
                            metadataUpdatedAt: now,
                            updatedAt: now,
                        }));
                    } catch (err) {
                        console.error(`[SharkReader] Error procesando ${book.originalTitle}:`, err);
                    } finally {
                        metadataRepairingRef.current.delete(book.id);
                    }
                }

                console.log('[SharkReader] Re-extracción completada');
            }, 12000);

            return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [isDbLoaded]);

        // ── PERSIST: books + categories (debounce 2000ms + idle so it never blocks reading)
        useEffect(() => {
            if (!isDbLoaded || !isStateHydrated || isResettingRef.current) return;
            clearTimeout(persistTimerRef.current);
            persistTimerRef.current = setTimeout(() => {
                // Use requestIdleCallback so JSON serialization doesn't block page turns
                const doSave = async () => {
                    const changedRecords = [];
                    const liveIds = new Set();
                    books.forEach(book => {
                        if (book.loading) return;
                        liveIds.add(book.id);
                        const record = toStoredBookRecord(book, {}, { includeFile: false });
                        const signature = JSON.stringify({
                            updatedAt: record.updatedAt || 0,
                            progressUpdatedAt: record.progressUpdatedAt || 0,
                            metadataUpdatedAt: record.metadataUpdatedAt || 0,
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
                        });
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
                        saveSetting('categories', customCategories),
                        saveSetting('collections', manualCollections),
                    ]);
                    if (results.some(result => result === false)) {
                        console.warn('[SharkReader] Persistencia parcial fallida: libros/categorias/colecciones');
                    }
                };
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(doSave, { timeout: 5000 });
                } else {
                    doSave();
                }
            }, 2000);
            return () => clearTimeout(persistTimerRef.current);
        }, [books, customCategories, manualCollections, isDbLoaded, isStateHydrated]);

        useEffect(() => {
            if (!isDbLoaded || !isStateHydrated || isResettingRef.current || !syncFolder || !window.electronAPI) return;
            clearTimeout(syncTimerRef.current);
            syncTimerRef.current = setTimeout(async () => {
                const bookRecords = books.filter(b => !b.loading).map(b => toStoredBookRecord(b, {}, { includeFile: false }));
                const localBackup = buildPortableBackup({
                    books: bookRecords.map(({ file, ...record }) => record),
                    categories: customCategories,
                    collections: manualCollections,
                    stats,
                    user: userProfile || {},
                    workshop: migrateWorkshopData({ addons, addonConfig, externalSources }),
                });
                let backupToWrite = localBackup;
                if (window.electronAPI.readSyncFile) {
                    try {
                        const existing = await window.electronAPI.readSyncFile(syncFolder);
                        if (existing) {
                            backupToWrite = mergeBackupData(localBackup, JSON.parse(existing));
                        }
                    } catch (err) {
                        console.warn('[SharkReader] No se pudo fusionar backup de sync existente:', err);
                    }
                }
                const syncData = JSON.stringify(backupToWrite, null, 2);
                window.electronAPI.writeSyncFile(syncFolder, syncData).catch(() => {});
            }, 5000);
            return () => clearTimeout(syncTimerRef.current);
        }, [books, customCategories, manualCollections, stats, userProfile, addons, addonConfig, externalSources, isDbLoaded, isStateHydrated, syncFolder]);

        // ── PERSIST: display prefs → localStorage (fast startup path, fires synchronously)
        useEffect(() => {
            if (!isDbLoaded || !isStateHydrated || isResettingRef.current) return;
            localStorage.setItem('sharkreader_theme', JSON.stringify(theme));
            localStorage.setItem('sharkreader_auto_dark_mode', JSON.stringify(autoDarkMode));
            localStorage.setItem('sharkreader_lang', JSON.stringify(lang));
            localStorage.setItem('sharkreader_flow', JSON.stringify(readFlow));
            localStorage.setItem('sharkreader_layout', JSON.stringify(readLayout));
            localStorage.setItem('sharkreader_warm', JSON.stringify(warmMode));
            localStorage.setItem('sharkreader_libview', JSON.stringify(libraryView));
        }, [theme, autoDarkMode, lang, readFlow, readLayout, warmMode, libraryView, isDbLoaded, isStateHydrated]);

        // ── PERSIST: display prefs → IndexedDB (debounce 1000ms)
        useEffect(() => {
            if (!isDbLoaded || !isStateHydrated || isResettingRef.current) return;
            clearTimeout(persistSettingsRef.current);
            persistSettingsRef.current = setTimeout(() => {
                Promise.all([
                    saveAppData('theme', theme),
                    saveAppData('autoDarkMode', autoDarkMode),
                    saveAppData('tutorialEnabled', tutorialEnabled),
                    saveAppData('tutorialSeen', !showWelcomeTutorial),
                    saveAppData('tutorialSeenHints', tutorialSeenHints),
                    saveAppData('lang', lang),
                    saveAppData('readFlow', readFlow),
                    saveAppData('readLayout', readLayout),
                    saveAppData('pageTransition', pageTransition),
                    saveAppData('warmMode', warmMode),
                    saveAppData('libraryView', libraryView),
                    saveAppData('accentColor', accentColor),
                ]).then(results => {
                    if (results.some(result => result === false)) console.warn('[SharkReader] Persistencia parcial fallida: settings');
                });
            }, 1000);
            return () => clearTimeout(persistSettingsRef.current);
        }, [theme, autoDarkMode, tutorialEnabled, showWelcomeTutorial, tutorialSeenHints, lang, readFlow, readLayout, pageTransition, warmMode, libraryView, accentColor, isDbLoaded, isStateHydrated]);

        // ── PERSIST: user data & goals → IndexedDB (debounce 1500ms)
        useEffect(() => {
            if (!isDbLoaded || !isStateHydrated || isResettingRef.current) return;
            clearTimeout(persistUserRef.current);
            persistUserRef.current = setTimeout(() => {
                Promise.all([
                    saveAppData('userProfile', userProfile),
                    saveAppData('vocabulary', vocabulary),
                    saveAppData('dailyGoalMins', dailyGoalMins),
                    saveAppData('weeklyGoalMins', weeklyGoalMins),
                    saveAppData('yearlyGoal', yearlyGoal),
                    saveAppData('achievements', achievements),
                    saveAppData('journalEntries', journalEntries),
                    saveAppData('currentFilter', currentFilter),
                    saveAppData('sortBy', sortBy),
                    saveAppData('categoryColors', categoryColors),
                ]).then(results => {
                    if (results.some(result => result === false)) console.warn('[SharkReader] Persistencia parcial fallida: usuario/stats');
                });
            }, 1500);
            return () => clearTimeout(persistUserRef.current);
        }, [userProfile, vocabulary, dailyGoalMins, weeklyGoalMins, yearlyGoal, achievements, journalEntries, currentFilter, sortBy, categoryColors, isDbLoaded, isStateHydrated]);

        // ── PERSIST: addons & AI config → IndexedDB (debounce 1500ms)
        useEffect(() => {
            if (!isDbLoaded || !isStateHydrated || isResettingRef.current) return;
            clearTimeout(persistAddonsRef.current);
            persistAddonsRef.current = setTimeout(() => {
                Promise.all([
                    saveAppData('aiProvider', aiProvider),
                    saveAppData('aiApiKey', aiApiKey),
                    saveAppData('syncFolder', syncFolder),
                    saveAppData('externalSources', externalSources),
                    saveAppData('addons', addons),
                    saveAppData('addonConfig', addonConfig),
                    saveAppData('workshop', migrateWorkshopData({ addons, addonConfig, externalSources })),
                ]).then(results => {
                    if (results.some(result => result === false)) console.warn('[SharkReader] Persistencia parcial fallida: addons/IA');
                });
            }, 1500);
            return () => clearTimeout(persistAddonsRef.current);
        }, [aiProvider, aiApiKey, syncFolder, externalSources, addons, addonConfig, isDbLoaded, isStateHydrated]);

        // Cleanup incremental de ObjectURL para portadas/libros hidratados desde IndexedDB.
        useEffect(() => {
            const nextUrls = new Set(books.map(book => book.url).filter(Boolean));
            activeObjectUrlsRef.current.forEach(url => {
                if (!nextUrls.has(url)) URL.revokeObjectURL(url);
            });
            activeObjectUrlsRef.current = nextUrls;
        }, [books]);

        useEffect(() => {
            return () => {
                clearTimeout(openBookNotifyTimerRef.current);
                openBookNotifyTimerRef.current = null;
                activeObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
                activeObjectUrlsRef.current.clear();
            };
        }, []);

        useEffect(() => {
            if (!isStateHydrated || isResettingRef.current) return;
            const session = {
                tabs,
                activeTabId,
                tabTargetCfi,
                panelMode,
                rightTabId,
            };
            saveAppData('readerSession', session).then(ok => {
                if (ok === false) console.warn('[SharkReader] No se pudo persistir la sesion del lector');
            });
            localStorage.setItem('sharkreader_reader_session', JSON.stringify(session));
        }, [tabs, activeTabId, tabTargetCfi, panelMode, rightTabId, isStateHydrated]);

        useEffect(() => {
            if (!isDbLoaded || !isStateHydrated || isResettingRef.current) return;
            if (!books.length && tabs.length === 0) return;
            const validBookIds = new Set(books.map(book => book.id));
            const validTabs = tabs.filter(tab => validBookIds.has(tab.bookId));
            if (validTabs.length !== tabs.length) {
                setTabs(validTabs);
            }
            if (activeTabId && !validTabs.some(tab => tab.id === activeTabId)) {
                setActiveTabId(validTabs[0]?.id || null);
            }
            if (rightTabId && !validTabs.some(tab => tab.id === rightTabId)) {
                setRightTabId(null);
                setPanelMode(false);
            }
            setTabTargetCfi(prev => {
                const next = Object.fromEntries(Object.entries(prev).filter(([tabId]) => validTabs.some(tab => tab.id === tabId)));
                return Object.keys(next).length === Object.keys(prev).length ? prev : next;
            });
        }, [books, tabs, activeTabId, rightTabId, isDbLoaded, isStateHydrated]);

        // ─────────────────────────────────────────
        // TABS
        // ─────────────────────────────────────────
        const openBook = useCallback((bookId, cfi = null) => {
            const bookToOpen = booksRef.current.find(book => book.id === bookId);
            const existing = tabs.find(t => t.bookId === bookId);
            if (existing) {
                setActiveTabId(existing.id);
                if (cfi) setTabTargetCfi(p => ({ ...p, [existing.id]: cfi }));
                setView('reader');
                return;
            }
            const tabId = 'tab_' + Date.now();
            const startMinutes = bookToOpen?.readingMinutes || 0;
            const startProgress = bookToOpen?.progress || 0;
            setTabs(prev => [...prev, { id: tabId, bookId, startMinutes, startProgress }]);
            setActiveTabId(tabId);
            if (cfi) setTabTargetCfi(p => ({ ...p, [tabId]: cfi }));
            setLastReadId(bookId);
            setBooks(prev => prev.map(b => {
                if (b.id !== bookId) return b;
                const now = Date.now();
                return { ...b, lastReadDate: now, dateStarted: b.dateStarted || now, progressUpdatedAt: now, updatedAt: now };
            }));
            setView('reader');
            const isNew = !bookToOpen?.lastReadDate;
            clearTimeout(openBookNotifyTimerRef.current);
            openBookNotifyTimerRef.current = setTimeout(() => {
                openBookNotifyTimerRef.current = null;
                sharkyActionsRef.current?.notifyBookOpened({
                    bookName: bookToOpen?.name || '',
                    progress: startProgress,
                    lastReadDate: bookToOpen?.lastReadDate || null,
                    isNew,
                    hour: new Date().getHours(),
                });
            }, 800);
        }, [tabs, showNoticeToast, sharkyActionsRef]);

        const closeTab = useCallback((tabId, e) => {
            if (e) { e.stopPropagation(); e.preventDefault(); }
            if (!tabId) return;
            // On close: Reading Journal + Auto Bookmark + Sharky session summary
            setBooks(booksSnap => {
                const closingTab = tabs.find(t => t.id === tabId);
                if (closingTab) {
                    const book = booksSnap.find(b => b.id === closingTab.bookId);
                    if (book) {
                        if (addonsRef.current.readingJournal && book.readingMinutes > 0) {
                            addJournalEntry(book.name, book.readingMinutes, book.progress || 0);
                        }
                        if (addonsRef.current.autoBookmark && book.lastLocation) {
                            const alreadyBookmarked = book.bookmarks?.some(bm => bm.cfi === book.lastLocation);
                            if (!alreadyBookmarked) {
                                const autoMark = { cfi: book.lastLocation, note: `📌 Auto — ${new Date().toISOString().slice(0, 10)}`, date: new Date().toISOString().slice(0, 10) };
                                return booksSnap.map(b => b.id === closingTab.bookId ? { ...b, bookmarks: [...(b.bookmarks || []), autoMark], metadataUpdatedAt: Date.now(), updatedAt: Date.now() } : b);
                            }
                        }
                        const sessionMins = Math.round((book.readingMinutes || 0) - (closingTab.startMinutes || 0));
                        const startProgress = closingTab.startProgress ?? 0;
                        const endProgress = book.progress || 0;
                        const progressDelta = Math.max(0, endProgress - startProgress);
                        sharkyActionsRef.current?.notifySessionEnd({
                            bookName: book.name,
                            sessionMins,
                            startProgress,
                            endProgress,
                            progressDelta,
                        });
                    }
                }
                return booksSnap;
            });
            setTabs(prev => {
                const newTabs = prev.filter(t => t.id !== tabId);
                if (activeTabId === tabId) {
                    if (newTabs.length > 0) { setActiveTabId(newTabs[newTabs.length - 1].id); setView('reader'); }
                    else { setActiveTabId(null); setView('library'); }
                }
                if (rightTabId === tabId) { setPanelMode(false); setRightTabId(null); }
                return newTabs;
            });
            setTabTargetCfi(prev => { const n = { ...prev }; delete n[tabId]; return n; });
        }, [activeTabId, rightTabId, tabs, addonsRef, sharkyActionsRef]);

        const closeBook = useCallback(() => {
            closeTab(activeTabId);
            if (document.fullscreenElement) document.exitFullscreen();
        }, [activeTabId, closeTab]);

        const switchReaderTab = useCallback((id) => {
            setActiveTabId(id);
            setView('reader');
        }, []);

        const toggleSpreadLayout = useCallback(() => {
            setReadLayout(prev => prev === 'auto' ? 'none' : 'auto');
        }, []);

        const activeTab = tabs.find(t => t.id === activeTabId);
        const currentBookData = useMemo(() => activeTab ? booksById.get(activeTab.bookId) || null : null, [activeTab, booksById]);
        const stableCurrentBookData = useStableReaderBook(currentBookData);
        const currentTargetCfi = tabTargetCfi[activeTabId] || null;
        const rightBookData = useMemo(() => {
            if (!panelMode || !rightTabId) return null;
            const rt = tabs.find(t => t.id === rightTabId);
            return rt ? booksById.get(rt.bookId) || null : null;
        }, [panelMode, rightTabId, tabs, booksById]);
        const stableRightBookData = useStableReaderBook(rightBookData);

        useEffect(() => {
            if (!isDbLoaded || !isStateHydrated || isResettingRef.current || view !== 'reader') return;
            if (!currentBookData) {
                setView('library');
                return;
            }
            if (!currentBookData.file) {
                showNoticeToast('Ese libro no tiene un archivo disponible. Se mantuvo en biblioteca.', 'warning');
                setView('library');
            }
        }, [currentBookData, isDbLoaded, isStateHydrated, showNoticeToast, view]);

        const persistPdfZoom = useCallback((bookId, pdfScale) => {
            setBooks(prev => updateBookInList(prev, bookId, book => {
                if (book.pdfScale === pdfScale) return book;
                const now = Date.now();
                return { ...book, pdfScale, metadataUpdatedAt: now, updatedAt: now };
            }));
        }, []);

        const {
            handleContextMenu,
            toggleFavorite,
            markFinished,
            deleteBook,
            updateBookLocation,
            toggleBookmarkInApp,
            saveWordToVocab,
            getAnnotationEntries,
            exportAnnotations,
            addNewCategory,
            removeCategory,
        } = useBookActions({
            books,
            booksById,
            setBooks,
            tabs,
            closeTab,
            lastReadId,
            setLastReadId,
            progressUpdateThrottleRef,
            sharkyActionsRef,
            addonsRef,
            setTabTargetCfi,
            setContextMenu,
            setVocabulary,
            customCategories,
            setCustomCategories,
            currentFilter,
            setCurrentFilter,
            t,
            addons,
            addonConfig,
        });

        useReadingSession({
            view,
            userProfile,
            tabs,
            activeTabId,
            setBooks,
            setStats,
            setAnniversaryInfo,
            setAchievements,
            setAchievementToast,
            setView,
            isDbLoaded,
            isStateHydrated,
            stats,
            books,
            vocabulary,
            achievements,
            addons,
            addonConfig,
            yearlyGoal,
            booksById,
            lastReadId,
            activeBookIdRef,
            sharkyActionsRef,
        });

        // ─────────────────────────────────────────
        // USUARIO
        // ─────────────────────────────────────────
        const handleLogin = () => {
            if (!tempLoginName.trim()) { alert("Ingresa un nombre."); return; }
            setUserProfile({ name: tempLoginName.trim(), avatar: tempLoginAvatar });
            setShowLoginModal(false);
        };
        const handleAvatarUpload = (e) => {
            const f = e.target.files[0];
            if (f) { const r = new FileReader(); r.onload = ev => setTempLoginAvatar(ev.target.result); r.readAsDataURL(f); }
        };

        const openEditProfile = () => {
            if (!userProfile) return;
            setTempEditName(userProfile.name);
            setTempEditAvatar(userProfile.avatar);
            setShowEditProfileModal(true);
            setShowUserMenu(false);
        };
        const handleEditAvatarUpload = (e) => {
            const f = e.target.files[0];
            if (f) { const r = new FileReader(); r.onload = ev => setTempEditAvatar(ev.target.result); r.readAsDataURL(f); }
        };
        const saveEditProfile = () => {
            if (!tempEditName.trim()) return;
            setUserProfile({ ...userProfile, name: tempEditName.trim(), avatar: tempEditAvatar });
            setShowEditProfileModal(false);
        };

        const handleCoverUpload = useCallback((event) => {
            const file = event.target.files?.[0];
            if (!file || !activeBookModal) return;
            const reader = new FileReader();
            reader.onload = ev => {
                const now = Date.now();
                setActiveBookModal(prev => prev ? {
                    ...prev,
                    coverUrl: ev.target.result,
                    customCover: ev.target.result,
                    metadataUpdatedAt: now,
                    updatedAt: now,
                } : prev);
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }, [activeBookModal]);

        const restoreOriginalMetadata = useCallback(() => {
            const now = Date.now();
            setActiveBookModal(prev => prev ? {
                ...prev,
                name: prev.originalTitle || prev.name,
                author: prev.originalAuthor || prev.author,
                coverUrl: prev.coverBase64 || null,
                customCover: null,
                metadataUpdatedAt: now,
                updatedAt: now,
            } : prev);
        }, []);

        const saveActiveBookMetadata = useCallback(() => {
            if (!activeBookModal) return;
            const now = Date.now();
            const nextBook = { ...activeBookModal, metadataUpdatedAt: now, updatedAt: now };
            setBooks(prev => updateBookInList(prev, activeBookModal.id, nextBook));
            saveBookToDB(toStoredBookRecord(nextBook, {}, { includeFile: false }));
            setActiveBookModal(null);
        }, [activeBookModal]);

        const deleteAccountAndData = useCallback(async () => {
            isResettingRef.current = true;
            sessionStorage.setItem('sharkreader_pending_reset_verify', 'true');

            const keysToDelete = [
                'sharkreader_tutorial_seen',
                'sharkreader_tutorial_enabled',
                'sharkreader_tutorial_hints',
                'sharkreader_tutorial_pos',
                'sharkreader_cat_colors',
                'sharkreader_auto_dark_mode',
                'sharkreader_user',
                'sharkreader_meta',
                'sharkreader_stats',
                'sharkreader_categories',
                'sharkreader_achievements',
                'sharkreader_addons',
                'sharkreader_addon_config',
                'sharkreader_external_sources',
                'sharkreader_journal',
                'sharkreader_vocab',
                'sharkreader_last_open',
                'sharkreader_prev_open',
                'sharkreader_lastReadId',
                'sharkreader_migrated_v2',
                'sharkreader_migrated_v5',
                'sharkreader_lang',
                'sharkreader_theme',
                'sharkreader_flow',
                'sharkreader_layout',
                'sharkreader_warm',
                'sharkreader_ai_provider',
                'sharkreader_ai_key',
                'sharkreader_sync_folder',
                'sharkreader_libview',
                'sharkreader_daily_goal',
                'sharkreader_yearly_goal',
                'sharkreader_accent',
                'sharkreader_readFlow',
                'sharkreader_readLayout',
                'sharkreader_pageTransition',
                'sharkreader_libraryView',
                'sharkreader_sortBy',
                'sharkreader_current_filter',
                'sharkreader_sort_by',
                'sharkreader_reader_session',
                'sharkreader_toc_cache',
                'sharkreader_content_index',
                'sr_obsidian_exported',
                'page_transition',
            ];

            clearTimeout(persistTimerRef.current);
            clearTimeout(persistStatsRef.current);
            clearTimeout(persistSettingsRef.current);
            clearTimeout(persistUserRef.current);
            clearTimeout(persistAddonsRef.current);
            clearTimeout(syncTimerRef.current);
            clearTimeout(openBookNotifyTimerRef.current);
            openBookNotifyTimerRef.current = null;
            resetTutorialCooldown();

            try {
                booksRef.current.forEach((book) => {
                    if (book?.url) URL.revokeObjectURL(book.url);
                });
                activeObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
                activeObjectUrlsRef.current.clear();
            } catch (err) {
                console.warn('[SharkReader] URL cleanup during reset failed:', err);
            }

            keysToDelete.forEach((key) => localStorage.removeItem(key));
            bookDedupKeysRef.current.clear();
            bookTitleDedupKeysRef.current.clear();
            metadataRepairingRef.current.clear();
            resetImportState();
            activeBookIdRef.current = null;
            resetUI();
            setAchievementToast(null);
            setAchievements({});
            setStats({
                timeRead: 0, pagesTurned: 0, streak: 0, lastStreakDate: '',
                currentDailyMins: 0, lastActiveDate: '', streakSavers: 0, history: {}, minutesByDay: {}
            });
            setVocabulary([]);
            setJournalEntries([]);
            setAddons(normalizeAddonState({}));
            setAddonConfig(normalizeAddonConfig({}));
            setExternalSources(DEFAULT_EXTERNAL_SOURCES);
            setCustomCategories(['Pendientes', 'Estudio']);
            setTabs([]);
            setActiveTabId(null);
            setRightTabId(null);
            setPanelMode(false);
            setLastReadId(null);
            setCurrentFilter('all');
            setView('library');
            setUserProfile(null);
            setBooks([]);

            const resetResult = await resetAllAppDataVerified({ retries: 1 });
            if (!resetResult.ok) {
                console.error('[SharkReader] Reset total no pudo limpiar todos los stores:', resetResult.counts);
                showNoticeToast('No se pudieron borrar todos los datos. Se reintentara al reiniciar.', 'warning');
            }
            window.location.replace(window.location.pathname);
        }, [resetImportState, resetTutorialCooldown, resetUI, showNoticeToast]);

        const assignBookCategory = useCallback((bookId, category) => {
            const now = Date.now();
            setBooks(prev => prev.map(b => b.id === bookId ? { ...b, category, metadataUpdatedAt: now, updatedAt: now } : b));
            setDraggedBookId(null);
            setDropTargetCat(null);
        }, []);

        const createManualCollection = useCallback((initialName = '') => {
            const name = (initialName || prompt('Nombre de la colección:') || '').trim();
            if (!name) return null;
            const existing = manualCollections.find(collection => collection.name.toLowerCase() === name.toLowerCase());
            if (existing) return existing.id;
            const nextCollection = {
                id: `collection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                name,
                bookIds: [],
            };
            setManualCollections(prev => [...prev, nextCollection].sort((a, b) => a.name.localeCompare(b.name)));
            return nextCollection.id;
        }, [manualCollections]);

        const removeManualCollection = useCallback((collectionId) => {
            const target = manualCollections.find(collection => collection.id === collectionId);
            if (!target) return;
            if (!window.confirm(`Eliminar la colección "${target.name}"?`)) return;
            setManualCollections(prev => prev.filter(collection => collection.id !== collectionId));
            if (currentFilter === `collection:${collectionId}`) setCurrentFilter('all');
        }, [currentFilter, manualCollections]);

        const toggleBookInCollection = useCallback((bookId, collectionId) => {
            setManualCollections(prev => prev.map(collection => {
                if (collection.id !== collectionId) return collection;
                const hasBook = (collection.bookIds || []).includes(bookId);
                return {
                    ...collection,
                    bookIds: hasBook
                        ? collection.bookIds.filter(id => id !== bookId)
                        : [...(collection.bookIds || []), bookId],
                };
            }));
        }, []);

        // ── v2.9 CALLBACKS ──

        const clearSelection = useCallback(() => {
            setSelectedBookIds(new Set());
            setIsSelecting(false);
        }, []);

        const toggleSelectBook = useCallback((bookId) => {
            setSelectedBookIds(prev => {
                const next = new Set(prev);
                if (next.has(bookId)) next.delete(bookId); else next.add(bookId);
                return next;
            });
        }, []);

        const bulkAssignCategory = useCallback((category) => {
            const now = Date.now();
            setBooks(prev => prev.map(b => selectedBookIds.has(b.id) ? { ...b, category, updatedAt: now, metadataUpdatedAt: now } : b));
        }, [selectedBookIds]);

        const bulkAssignTag = useCallback((tag) => {
            if (!tag) return;
            const now = Date.now();
            setBooks(prev => prev.map(b => {
                if (!selectedBookIds.has(b.id)) return b;
                const tagList = splitBookTags(b.tags);
                if (tagList.map(t => t.toLowerCase()).includes(tag.toLowerCase())) return b;
                return { ...b, tags: [...tagList, tag].join(', '), updatedAt: now, metadataUpdatedAt: now };
            }));
        }, [selectedBookIds]);

        const bulkMarkFinished = useCallback((isFinished) => {
            const now = Date.now();
            setBooks(prev => prev.map(b => !selectedBookIds.has(b.id) ? b : { ...b, isFinished, dateFinished: isFinished ? Date.now() : null, updatedAt: now }));
            clearSelection();
        }, [selectedBookIds, clearSelection]);

        const bulkToggleFav = useCallback(() => {
            const now = Date.now();
            const allFav = [...selectedBookIds].every(id => books.find(b => b.id === id)?.isFav);
            setBooks(prev => prev.map(b => !selectedBookIds.has(b.id) ? b : { ...b, isFav: !allFav, updatedAt: now }));
        }, [selectedBookIds, books]);

        const bulkAddToCollection = useCallback((collectionId) => {
            setManualCollections(prev => prev.map(col => {
                if (col.id !== collectionId) return col;
                const existing = new Set(col.bookIds || []);
                [...selectedBookIds].forEach(id => existing.add(id));
                return { ...col, bookIds: [...existing] };
            }));
        }, [selectedBookIds]);

        const bulkDeleteBooks = useCallback(() => {
            if (!selectedBookIds.size) return;
            if (!window.confirm(`¿Eliminar ${selectedBookIds.size} libro(s) seleccionado(s)? Esta acción no se puede deshacer.`)) return;
            const idsToDelete = new Set(selectedBookIds);
            setBooks(prev => prev.filter(b => !idsToDelete.has(b.id)));
            clearSelection();
        }, [selectedBookIds, clearSelection]);

        const toggleFilterTag = useCallback((tag) => {
            setFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
        }, []);

        const toggleFilterAuthor = useCallback((author) => {
            setFilterAuthors(prev => prev.includes(author) ? prev.filter(a => a !== author) : [...prev, author]);
        }, []);

        const renameManualCollection = useCallback((id, name) => {
            if (!name.trim()) return;
            setManualCollections(prev => prev.map(c => c.id === id ? { ...c, name: name.trim() } : c));
            setRenamingCollectionId(null);
            setRenamingCollectionValue('');
        }, []);

        const moveManualCollection = useCallback((id, direction) => {
            setManualCollections(prev => {
                const idx = prev.findIndex(c => c.id === id);
                if (idx === -1) return prev;
                const next = [...prev];
                const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
                if (targetIdx < 0 || targetIdx >= next.length) return prev;
                [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
                return next;
            });
        }, []);

        const setCollectionEmoji = useCallback((id, emoji) => {
            setManualCollections(prev => prev.map(c => c.id === id ? { ...c, emoji: emoji || '🗂️' } : c));
        }, []);

        const saveQuickEdit = useCallback((bookId, patch) => {
            const now = Date.now();
            setBooks(prev => prev.map(b => b.id === bookId ? { ...b, ...patch, updatedAt: now, metadataUpdatedAt: now } : b));
            setQuickEditBookId(null);
        }, []);

        const toggleAddon = (id, options = {}) => {
            setAddons(prev => {
                const validation = validateAddonToggle(id, !prev[id], { userProfile, lang, allowExperimental: !!options.allowExperimental });
                if (!validation.ok) {
                    showNoticeToast(validation.reason, 'warning');
                    return prev;
                }
                const updated = { ...normalizeAddonState(prev), [id]: validation.enabled };
                addonsRef.current = updated;
                saveAppData('addons', updated);
                return updated;
            });
        };

        const updateAddonConfig = useCallback((id, patch) => {
            setAddonConfig(prev => {
                const updated = normalizeAddonConfig({
                    ...prev,
                    [id]: { ...(prev?.[id] || {}), ...patch },
                });
                saveAppData('addonConfig', updated);
                return updated;
            });
        }, []);

        // Live config update without DB save — for high-frequency operations like drag
        const setAddonConfigLive = useCallback((id, patch) => {
            setAddonConfig(prev => normalizeAddonConfig({
                ...prev,
                [id]: { ...(prev?.[id] || {}), ...patch },
            }));
        }, []);

        useEffect(() => {
            const sharkyConfig = addonConfig.sharkyMascot || {};
            const patch = {};
            if (aiProvider && !sharkyConfig.aiProvider) patch.aiProvider = aiProvider;
            if (aiApiKey && !sharkyConfig.aiKey) patch.aiKey = aiApiKey;
            if (Object.keys(patch).length > 0) updateAddonConfig('sharkyMascot', patch);
        }, [addonConfig.sharkyMascot, aiApiKey, aiProvider, updateAddonConfig]);

        const pickAddonFolder = useCallback(async (addonId, key = 'folder') => {
            if (!window.electronAPI?.pickFolder) {
                showNoticeToast('Selector de carpeta no disponible.', 'warning');
                return;
            }
            const folder = await window.electronAPI.pickFolder();
            if (!folder) return;
            updateAddonConfig(addonId, { [key]: folder });
        }, [showNoticeToast, updateAddonConfig]);

        const browseExternalCatalogUrl = useCallback(async (url, options = {}) => {
            if (!window.electronAPI?.fetchExternalCatalog) {
                setExternalCatalogState({ loading: false, error: 'Integracion externa no disponible en este entorno.', catalog: null, importingId: null });
                return;
            }
            setExternalCatalogState(prev => ({ ...prev, loading: true, error: '', importingId: null }));
            const result = await window.electronAPI.fetchExternalCatalog(url, {
                allowPrivateNetwork: !!options.allowPrivateNetwork,
            });
            if (!result?.ok) {
                setExternalCatalogState({ loading: false, error: result?.msg || 'No se pudo cargar la fuente.', catalog: null, importingId: null });
                return;
            }
            setExternalCatalogState({
                loading: false,
                error: '',
                catalog: {
                    ...result.catalog,
                    allowPrivateNetwork: !!options.allowPrivateNetwork,
                    sourceName: options.sourceName || result.catalog?.title || '',
                },
                importingId: null,
            });
        }, []);

        const browseExternalSource = useCallback((source) => {
            if (!source?.enabled) {
                showNoticeToast('Activa la fuente antes de explorarla.', 'warning');
                return;
            }
            browseExternalCatalogUrl(source.url, {
                allowPrivateNetwork: !!source.allowPrivateNetwork || source.type === 'calibre',
                sourceName: source.name,
            });
        }, [browseExternalCatalogUrl, showNoticeToast]);

        // Keep addonsRef in sync
        useEffect(() => { addonsRef.current = addons; }, [addons]);

        // ── REMINDER DIARIO ──────────────────────────────────────────────────────
        // Track session open times so the reminder can measure elapsed time
        useEffect(() => {
            const prev = localStorage.getItem('sharkreader_last_open');
            if (prev) localStorage.setItem('sharkreader_prev_open', prev);
            localStorage.setItem('sharkreader_last_open', Date.now().toString());
        }, []);

        useEffect(() => {
            if (!addons.reminders || !userProfile) return;
            if (!('Notification' in window)) return;
            const todayStr = new Date().toLocaleDateString();
            if (stats.lastActiveDate === todayStr) return;
            const prevOpen = parseInt(localStorage.getItem('sharkreader_prev_open') || '0', 10);
            const hoursSincePrev = prevOpen ? (Date.now() - prevOpen) / 3600000 : Infinity;
            const minHoursSinceLastOpen = addonConfig.reminders?.minHoursSinceLastOpen || 1;
            // Only remind if more than 1 hour has passed since last session
            if (hoursSincePrev < minHoursSinceLastOpen) return;
            const fire = () => {
                Notification.requestPermission().then(perm => {
                    if (perm !== 'granted') return;
                    new Notification('¡Hora de leer! 📚', {
                        body: `${userProfile.name}, llevas más de un día sin abrir un libro. ¿Un capítulo hoy?`,
                        silent: false,
                    });
                });
            };
            const t = setTimeout(fire, 4000);
            return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [addons.reminders, userProfile, addonConfig.reminders]);


        useEffect(() => {
            clearInterval(watchedFolderTimerRef.current);
            const folder = addonConfig.watchedFolder?.folder;
            if (!addons.watchedFolder || !folder || !window.electronAPI?.startFolderImportPath) return;

            const runScan = async () => {
                if (folderImport || Date.now() - watchedFolderLastRunRef.current < 60000) return;
                watchedFolderLastRunRef.current = Date.now();
                try {
                    const session = await window.electronAPI.startFolderImportPath(folder);
                    if (session?.sessionId) {
                        beginFolderImportSession(session, 'Carpeta vigilada');
                        showNoticeToast('Carpeta vigilada: escaneo iniciado.', 'info');
                    }
                } catch (error) {
                    console.warn('[SharkReader] Error escaneando carpeta vigilada:', error);
                }
            };

            const intervalMs = Math.max(5, addonConfig.watchedFolder?.intervalMinutes || 30) * 60000;
            watchedFolderTimerRef.current = setInterval(runScan, intervalMs);
            return () => clearInterval(watchedFolderTimerRef.current);
        }, [addonConfig.watchedFolder?.folder, addonConfig.watchedFolder?.intervalMinutes, addons.watchedFolder, beginFolderImportSession, folderImport, showNoticeToast]);

        useEffect(() => {
            const folder = addonConfig.autoBackup?.folder;
            if (!addons.autoBackup || !folder || !window.electronAPI?.writeSyncFile || !isDbLoaded || !isStateHydrated) return;
            const everyMs = Math.max(1, addonConfig.autoBackup?.everyDays || 7) * 86400000;
            const lastBackupAt = Number(addonConfig.autoBackup?.lastBackupAt || 0);
            if (Date.now() - lastBackupAt < everyMs) return;

            const backup = buildPortableBackup({
                books: books.filter(b => !b.loading).map(stripBookFilesForExport),
                categories: customCategories,
                collections: manualCollections,
                stats,
                user: userProfile || {},
                workshop: migrateWorkshopData({ addons, addonConfig, externalSources }),
            });
            window.electronAPI.writeSyncFile(folder, JSON.stringify(backup, null, 2))
                .then(() => {
                    updateAddonConfig('autoBackup', { lastBackupAt: Date.now() });
                    showNoticeToast('Backup automatico guardado.', 'info');
                })
                .catch(() => showNoticeToast('No se pudo guardar el backup automatico.', 'warning'));
        }, [addonConfig, addons, books, customCategories, manualCollections, externalSources, isDbLoaded, isStateHydrated, stats, updateAddonConfig, userProfile, showNoticeToast]);

        const addJournalEntry = (bookName, minutes, progress) => {
            if (!addons.readingJournal) return;
            const entry = {
                id: Date.now().toString(),
                date: new Date().toLocaleDateString(),
                dateTs: Date.now(),
                bookName, minutes, progress
            };
            setJournalEntries(prev => [entry, ...prev].slice(0, 100));
        };

        const spinBookRoulette = useCallback(() => {
            const cfg = addonConfig.bookRoulette || {};
            let pool = books.filter(book => !book.loading);
            if (cfg.onlyUnread !== false) pool = pool.filter(b => !b.isFinished);
            if (cfg.onlyFavorites) pool = pool.filter(b => b.isFavorite);
            if (cfg.filterTag) {
                const tag = cfg.filterTag.toLowerCase();
                pool = pool.filter(b => (b.tags || []).some(t => t.toLowerCase().includes(tag)));
            }
            if (!pool.length) {
                showNoticeToast('No hay libros disponibles para la ruleta.', 'warning');
                return;
            }
            const selected = pool[Math.floor(Math.random() * pool.length)];
            setRouletteBook(selected);
            setStats(prev => ({ ...prev, rouletteSpins: (prev.rouletteSpins || 0) + 1 }));
        }, [addonConfig.bookRoulette, books, showNoticeToast]);

        // ── v3.5: OpenLibrary metadata fetch ───────────────────────────────────
        const fetchOpenLibraryMeta = useCallback(async (book) => {
            if (!window.electronAPI?.fetchOpenLibrary) return;
            showNoticeToast('Buscando en OpenLibrary…', 'info');
            try {
                const result = await window.electronAPI.fetchOpenLibrary({ title: book.name, author: book.author });
                if (!result) { showNoticeToast('No se encontró información para este libro.', 'warning'); return; }
                const now = Date.now();
                setBooks(prev => prev.map(b => b.id !== book.id ? b : {
                    ...b,
                    ...(result.coverUrl && !b.coverUrl ? { coverUrl: result.coverUrl } : {}),
                    ...(result.description && !b.description ? { description: result.description } : {}),
                    metadataUpdatedAt: now, updatedAt: now,
                }));
                showNoticeToast(`Información encontrada${result.coverUrl ? ' · portada aplicada' : ''}.`, 'success');
            } catch (e) {
                showNoticeToast('Error al buscar en OpenLibrary.', 'warning');
            }
        }, [setBooks, showNoticeToast]);

        const exportAllData = () => {
            if (!userProfile) { alert("Inicia sesión para exportar."); return; }
            const data = buildPortableBackup({
                books: books.filter(b => !b.loading).map(stripBookFilesForExport),
                categories: customCategories,
                collections: manualCollections,
                stats,
                user: userProfile || {},
                workshop: migrateWorkshopData({ addons, addonConfig, externalSources }),
            });
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            const a = document.createElement('a'); a.href = url; a.download = `SharkReader_Backup_${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url);
        };

        const downloadBlob = useCallback((blob, filename) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 500);
        }, []);

        const exportDiagnostics = useCallback(() => {
            const payload = {
                app: 'SharkReader',
                exportedAt: new Date().toISOString(),
                version: '3.6.0',
                userAgent: navigator.userAgent,
                diagnostics: getDiagnosticEntries(),
                snapshot: {
                    books: booksRef.current?.length || 0,
                    tabs: tabs.length,
                    view,
                    addons,
                    workshop: migrateWorkshopData({ addons, addonConfig, externalSources }),
                },
            };
            downloadBlob(
                new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
                `SharkReader_Diagnostico_${new Date().toISOString().slice(0, 10)}.json`
            );
        }, [addonConfig, addons, downloadBlob, externalSources, tabs.length, view]);

        const clearDiagnostics = useCallback(() => {
            clearDiagnosticEntries();
            showNoticeToast('Diagnostico limpiado.', 'info');
        }, [showNoticeToast]);

        const exportZipBackup = useCallback(async () => {
            const backup = buildPortableBackup({
                books: booksRef.current.filter(b => !b.loading).map(stripBookFilesForExport),
                categories: customCategories,
                collections: manualCollections,
                stats,
                user: userProfile || {},
                workshop: migrateWorkshopData({ addons, addonConfig, externalSources }),
            });

            const zip = new JSZip();
            zip.file('sharkreader-backup.json', JSON.stringify(backup, null, 2));
            zip.file('books-metadata.json', JSON.stringify(backup.books || [], null, 2));
            zip.file('progress-and-stats.json', JSON.stringify({ stats, books: (backup.books || []).map(book => ({
                id: book.id,
                title: book.customTitle || book.originalTitle || book.name,
                progress: book.progress || 0,
                lastLocation: book.lastLocation || null,
                readingMinutes: book.readingMinutes || 0,
                progressUpdatedAt: book.progressUpdatedAt || book.updatedAt || null,
            })) }, null, 2));
            zip.file('settings-workshop.json', JSON.stringify({
                categories: customCategories,
                collections: manualCollections,
                workshop: backup.workshop,
                externalSources,
            }, null, 2));
            zip.file('diagnostics.json', JSON.stringify(getDiagnosticEntries(), null, 2));
            zip.file('README.txt', [
                'SharkReader backup ZIP',
                `Exportado: ${new Date().toISOString()}`,
                '',
                'Este ZIP contiene datos de biblioteca, metadata, progreso, configuracion y diagnostico.',
                'No incluye archivos EPUB/PDF completos para evitar duplicar contenido protegido.',
            ].join('\n'));

            const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            downloadBlob(blob, `SharkReader_Backup_${new Date().toISOString().slice(0, 10)}.zip`);
        }, [addonConfig, addons, customCategories, downloadBlob, externalSources, manualCollections, stats, userProfile]);

        const importData = (e) => {
            const f = e.target.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = ev => {
                try {
                    const d = JSON.parse(ev.target.result);
                    let nextBooks = books;

                    if (Array.isArray(d.books)) {
                        const byId = new Map(d.books.filter(book => book?.id).map(book => [book.id, book]));
                        const bySourcePath = new Map(d.books.filter(book => book?.sourcePath).map(book => [book.sourcePath, book]));
                        const byLegacyKey = new Map(d.books.map(book => [`${book.originalTitle || ''}|${book.originalAuthor || ''}`, book]));

                        nextBooks = books.map(book => {
                            const imported = byId.get(book.id)
                                || (book.sourcePath ? bySourcePath.get(book.sourcePath) : null)
                                || byLegacyKey.get(`${book.originalTitle || ''}|${book.originalAuthor || ''}`);
                            return applyImportedBookData(book, imported);
                        });
                    } else if (d.meta) {
                        nextBooks = books.map(book => applyImportedBookData(book, d.meta[`${book.originalTitle || ''}|${book.originalAuthor || ''}`]));
                    }

                    if (d.categories) {
                        const nextCategories = Array.isArray(d.categories) ? d.categories.filter(cat => String(cat).toLowerCase() !== 'favoritos') : customCategories;
                        setCustomCategories(nextCategories);
                        saveSetting('categories', nextCategories);
                    }
                    if (Array.isArray(d.collections)) {
                        setManualCollections(d.collections);
                        saveSetting('collections', d.collections);
                    }
                    if (d.stats) {
                        setStats(d.stats);
                        saveAppData('stats', d.stats);
                    }
                    if (d.user) {
                        setUserProfile(d.user);
                        saveAppData('userProfile', d.user);
                    }
                    if (d.workshop) {
                        const migratedWorkshop = migrateWorkshopData(d.workshop);
                        setAddons(migratedWorkshop.addons);
                        setAddonConfig(migratedWorkshop.addonConfig);
                        setExternalSources(migratedWorkshop.externalSources);
                        saveAppData('workshop', migratedWorkshop);
                    }

                    setBooks(nextBooks);
                    saveBooksToDB(nextBooks.filter(book => !book.loading).map(book => toStoredBookRecord(book, {}, { includeFile: false })));
                    alert("Datos restaurados.");
                } catch (_) { alert("Archivo inválido."); }
            };
            r.readAsText(f); e.target.value = '';
        };


        const {
            displayedBooks,
            searchResultsWithMatches,
            libraryDerived,
            virtualLibrary,
            annotationBookOptions,
            annotationGroups,
            annotationSummary,
            openBookIds,
            folderImportOverlay,
        } = useLibrary({
            books,
            contentIndexMap,
            currentFilter,
            deferredSearchTerm,
            searchTerm,
            manualCollections,
            sortBy,
            filterTags,
            filterAuthors,
            customCategories,
            netflixView: addons.netflixView,
            libraryView,
            libraryViewport,
            getAnnotationEntries,
            shouldComputeAnnotations: sidebarOpen,
            annotationSearch,
            annotationBookFilter,
            tabs,
            folderImport,
        });

        const selectAll = useCallback(() => {
            setSelectedBookIds(new Set(displayedBooks.map(b => b.id)));
        }, [displayedBooks]);


        const exportQuotesAsImage = () => {
            const allQuotes = books.flatMap(b =>
                (b.bookmarks || [])
                    .filter(bm => bm.note && bm.note.includes('[Subrayado]'))
                    .map(bm => ({
                        text: bm.note.replace('[Subrayado] ', '').replace(/^"(.*?)"\.\.\.$/, '$1').replace(/^"(.*?)"$/, '$1'),
                        book: b.name, author: b.author || '', date: bm.date || ''
                    }))
            );
            if (!allQuotes.length) { alert('No tienes subrayados guardados. Selecciona texto mientras lees y activa el modo Subrayar.'); return; }

            const W = 820, PAD = 32, GAP = 14;
            const ctx2 = document.createElement('canvas').getContext('2d');
            ctx2.font = '14px system-ui, sans-serif';

            // Medir altura de cada cita (texto con wrap)
            const measured = allQuotes.map(q => {
                const words = q.text.split(' ');
                const maxW = W - PAD * 2 - 56;
                let line = '', lines = 0;
                for (const w of words) {
                    const test = line + w + ' ';
                    if (ctx2.measureText(test).width > maxW && line) { lines++; line = w + ' '; } else line = test;
                }
                if (line.trim()) lines++;
                const textH = Math.min(lines, 4) * 22;
                return Math.max(90, textH + 56);
            });

            const totalH = PAD * 2 + measured.reduce((s, h) => s + h + GAP, 0) - GAP + 48;
            const canvas = document.createElement('canvas');
            canvas.width = W; canvas.height = totalH;
            const ctx = canvas.getContext('2d');

            // Fondo
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, W, totalH);

            // Header
            ctx.fillStyle = '#3b82f6';
            ctx.font = 'bold 13px system-ui, sans-serif';
            ctx.fillText('🦈 Shark Reader — Mis Subrayados', PAD, 28);
            ctx.fillStyle = '#334155';
            ctx.fillRect(PAD, 36, W - PAD * 2, 1);

            let y = PAD + 36;
            allQuotes.forEach((q, i) => {
                const cardH = measured[i];
                // Card bg
                ctx.fillStyle = '#1e293b';
                ctx.beginPath();
                ctx.roundRect(PAD, y, W - PAD * 2, cardH, 12);
                ctx.fill();
                // Línea izquierda de color
                ctx.fillStyle = '#3b82f6';
                ctx.fillRect(PAD, y, 4, cardH);

                // Comilla
                ctx.font = 'bold 34px Georgia, serif';
                ctx.fillStyle = '#3b82f680';
                ctx.fillText('“', PAD + 14, y + 34);

                // Texto con wrap (máx 4 líneas)
                ctx.fillStyle = '#e2e8f0';
                ctx.font = '14px system-ui, sans-serif';
                const words = q.text.split(' ');
                const maxW = W - PAD * 2 - 56;
                let line = '', lineY = y + 24, lineCount = 0;
                for (const word of words) {
                    const test = line + word + ' ';
                    if (ctx.measureText(test).width > maxW && line) {
                        if (lineCount < 3) { ctx.fillText(line.trim(), PAD + 48, lineY); }
                        else { ctx.fillText(line.trim().slice(0, -3) + '…', PAD + 48, lineY); break; }
                        line = word + ' '; lineY += 22; lineCount++;
                    } else line = test;
                }
                if (line.trim() && lineCount < 4) ctx.fillText(line.trim(), PAD + 48, lineY);

                // Pie: libro · autor · fecha
                ctx.fillStyle = '#64748b';
                ctx.font = 'italic 11px system-ui, sans-serif';
                ctx.fillText(`— ${q.book}${q.author ? ' · ' + q.author : ''}  ${q.date}`, PAD + 14, y + cardH - 12);

                y += cardH + GAP;
            });

            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'Mis_Subrayados.png'; a.click();
                URL.revokeObjectURL(url);
            }, 'image/png');
            setStats(prev => ({ ...prev, quoteExported: true }));
        };

        const exportSingleQuote = useCallback((text, bookName, author, theme) => {
            const W = 640, H = 360, PAD = 40;
            const canvas = document.createElement('canvas');
            canvas.width = W; canvas.height = H;
            const ctx = canvas.getContext('2d');
            const isDark = theme === 'dark' || theme === 'sepia';
            const bg = theme === 'sepia' ? '#f5f0e8' : theme === 'dark' ? '#0f172a' : '#ffffff';
            const accent = 'var(--highlight)' === 'var(--highlight)' ? '#3b82f6' : '#3b82f6';
            const textColor = isDark ? '#e2e8f0' : '#1e293b';
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            // Left accent bar
            ctx.fillStyle = accent; ctx.fillRect(0, 0, 5, H);
            // Quote mark
            ctx.font = 'bold 80px Georgia, serif';
            ctx.fillStyle = accent + '33';
            ctx.fillText('"', PAD, PAD + 50);
            // Wrap text
            ctx.font = '18px system-ui, sans-serif';
            ctx.fillStyle = textColor;
            const maxW = W - PAD * 2 - 20;
            const words = text.split(' ');
            let line = '', y = PAD + 70, lineCount = 0;
            for (const word of words) {
                const test = line + word + ' ';
                if (ctx.measureText(test).width > maxW && line) {
                    if (lineCount < 6) { ctx.fillText(line.trim(), PAD + 20, y); y += 28; lineCount++; } else break;
                    line = word + ' ';
                } else line = test;
            }
            if (line.trim() && lineCount < 7) ctx.fillText(line.trim(), PAD + 20, y);
            // Footer
            ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
            ctx.font = 'italic 13px system-ui, sans-serif';
            ctx.fillText(`— ${bookName}${author ? ' · ' + author : ''}`, PAD, H - 20);
            ctx.font = 'bold 11px system-ui, sans-serif';
            ctx.fillStyle = accent;
            ctx.textAlign = 'right';
            ctx.fillText('🦈 Shark Reader', W - PAD, H - 20);
            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `Quote_${bookName.replace(/\s+/g,'_').slice(0,20)}.png`; a.click(); URL.revokeObjectURL(url);
            }, 'image/png');
            setStats(prev => ({ ...prev, quoteExported: true }));
        }, [theme, setStats]);



        // ─────────────────────────────────────────
        // RENDER
        // ─────────────────────────────────────────
        const addonClassName = [
            addons.dyslexiaMode ? 'addon-dyslexia' : '',
            addons.dynamicCovers ? 'addon-dynamic-covers' : '',
        ].filter(Boolean).join(' ');

        return (
            <div className={`w-full h-screen flex flex-col relative ${addonClassName}`}
                style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>

                {/* Warm overlay */}
                {warmMode && <div style={{ position: 'fixed', inset: 0, zIndex: 999997, backgroundColor: 'rgba(255,140,30,0.10)', pointerEvents: 'none', mixBlendMode: 'multiply' }} />}

                {addons.sharkyMascot && userProfile && (
                    <SharkyProvider
                        actionsRef={sharkyActionsRef}
                        addons={addons}
                        addonConfig={addonConfig}
                        updateAddonConfig={updateAddonConfig}
                        stats={stats}
                        readerLevel={readerLevel}
                        books={books}
                        booksById={booksById}
                        dailyGoalMins={dailyGoalMins}
                        lang={lang}
                        globalAiProvider={aiProvider}
                        globalAiApiKey={aiApiKey}
                        lastReadId={lastReadId}
                        view={view}
                        userProfile={userProfile}
                        achievementToast={achievementToast}
                        onPet={() => {
                            setStats(prev => ({ ...prev, sharkyPets: (prev.sharkyPets || 0) + 1 }));
                            if (addons.soundFeedback && addonConfig.soundFeedback?.sharky !== false) {
                                sounds.sharkyChirp((addonConfig.soundFeedback?.volume || 50) / 100 * 0.15);
                            }
                        }}
                        setAddonConfigLive={setAddonConfigLive}
                        openBook={openBook}
                        spinBookRoulette={spinBookRoulette}
                        setView={setView}
                        setSidebarOpen={setSidebarOpen}
                    >
                        <SharkyWidget />
                    </SharkyProvider>
                )}

                {(showWelcomeTutorial || (isStateHydrated && !userProfile)) && (
                    <OnboardingTutorial
                        onComplete={() => completeWelcomeTutorial()}
                        onSkip={skipWelcomeTutorial}
                        onActivateSharky={() => toggleAddon('sharkyMascot')}
                        onCreateProfile={(name, avatar) => setUserProfile({ name, avatar })}
                        hasProfile={!!userProfile}
                        bookCount={books.length}
                        isInReader={view === 'reader'}
                    />
                )}

                {tutorialEnabled && !showWelcomeTutorial && activeTutorialHint && userProfile && (
                    <div key={activeTutorialHint.id} className="fixed bottom-5 right-5 z-[670] w-full max-w-[320px] rounded-[28px] border shadow-2xl backdrop-blur-xl overflow-hidden" style={{ backgroundColor: 'color-mix(in srgb, var(--surface-bg) 95%, transparent)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-sky-600 via-sky-400 to-blue-500" />
                        <div className="p-5">
                            <div className="flex items-start gap-3 mb-3">
                                <BookfinSprite size={36} mood="idle" expression="happy" stage="reader" className="flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-sky-400/70">Tip</p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {activeTutorialHint.icon && (
                                            <span className="text-base leading-none">{activeTutorialHint.icon}</span>
                                        )}
                                        <h3 className="text-sm font-black leading-tight">{activeTutorialHint.title}</h3>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs opacity-65 leading-relaxed mb-4">{activeTutorialHint.body}</p>
                            <div className="flex items-center justify-between gap-3">
                                <button onClick={dismissTutorialHints} className="text-[11px] font-bold opacity-40 hover:opacity-70 transition">Omitir todos</button>
                                <button onClick={handleTutorialNext} className="rounded-2xl px-4 py-2 text-[11px] font-black text-white transition" style={{ backgroundColor: 'var(--highlight)' }}>
                                    Entendido ✓
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Drag & drop overlay */}
                {isDragging && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-[var(--highlight)]/20 backdrop-blur-sm border-4 border-dashed border-[var(--highlight)] pointer-events-none fade-in">
                        <div className="text-center">
                            <div className="text-6xl mb-4">📚</div>
                            <p className="text-2xl font-black" style={{ color: 'var(--highlight)' }}>Suelta los libros aquí</p>
                            <p className="text-sm opacity-60 mt-2">EPUB y PDF soportados</p>
                        </div>
                    </div>
                )}

                {/* ── LIBRARY TOPBAR ── */}
                {folderImportOverlay && (
                    <div className="fixed inset-x-0 bottom-0 z-[640] flex justify-end p-4 md:p-6 pointer-events-none">
                        <div className="folder-import-overlay pointer-events-auto w-full max-w-md rounded-[28px] border shadow-2xl backdrop-blur-xl fade-in" style={{ backgroundColor: 'color-mix(in srgb, var(--surface-bg) 95%, transparent)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                            <div className="p-5 md:p-6">
                                <div className="flex items-start gap-4">
                                    <div className="folder-import-icon flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: 'color-mix(in srgb, var(--highlight) 15%, transparent)', color: 'var(--highlight)' }}>
                                        <Icons.FolderPlus />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-black uppercase tracking-[0.24em] opacity-60" style={{ color: 'var(--highlight)' }}>
                                            {folderImportOverlay.folderName || 'Importacion'}
                                        </p>
                                        <h3 className="mt-1 text-lg font-black leading-tight">
                                            {folderImportOverlay.title}
                                        </h3>
                                        <p className="mt-2 text-sm opacity-70">
                                            {folderImportOverlay.detail}
                                        </p>
                                    </div>
                                    {folderImportOverlay.canCancel && (
                                        <button
                                            onClick={cancelActiveFolderImport}
                                            className="rounded-xl border px-3 py-2 text-xs font-bold opacity-85 transition hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                                            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}
                                            disabled={folderImportOverlay.isCancelling}
                                        >
                                            {folderImportOverlay.isCancelling ? 'Cancelando...' : 'Cancelar'}
                                        </button>
                                    )}
                                </div>

                                <div className="mt-5">
                                    <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] opacity-45">
                                        <span>{folderImportOverlay.phase === 'metadata' ? 'Metadatos' : folderImportOverlay.phase === 'importing' ? 'Importacion' : 'Estado'}</span>
                                        <span>{folderImportOverlay.progress}%</span>
                                    </div>
                                    <div className="folder-import-progress">
                                        <div
                                            className={folderImportOverlay.indeterminate ? 'folder-import-progress-bar indeterminate' : 'folder-import-progress-bar'}
                                            style={folderImportOverlay.indeterminate ? undefined : { width: `${Math.max(6, folderImportOverlay.progress)}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-4 gap-3">
                                    {[
                                        { label: 'Detectados', value: folderImportOverlay.total || folderImportOverlay.discovered || 0 },
                                        { label: 'Importados', value: folderImportOverlay.imported || 0 },
                                        { label: 'Listos', value: folderImportOverlay.metadataProcessed || 0 },
                                        { label: 'Omitidos', value: (folderImportOverlay.skippedDuplicates || 0) + (folderImportOverlay.failedCount || 0) },
                                    ].map(stat => (
                                        <div key={stat.label} className="rounded-2xl border bg-black/5 dark:bg-white/[0.04] px-3 py-3" style={{ borderColor: 'var(--border-color)' }}>
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">{stat.label}</p>
                                            <p className="mt-2 text-lg font-black">{stat.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {(folderImportOverlay.failedCount || 0) > 0 && (
                                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
                                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-200">Fallidos</p>
                                        <div className="mt-2 max-h-20 overflow-y-auto text-xs opacity-70">
                                            {(folderImportOverlay.failedFiles || []).slice(0, 6).map((item, index) => (
                                                <div key={`${item.name}-${index}`} className="truncate">{item.name} — {item.reason}</div>
                                            ))}
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                            <button onClick={retryFailedFolderImports} className="rounded-xl bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 hover:bg-amber-200">Reintentar fallidos</button>
                                            <button onClick={() => { setFolderImport(null); setFailedImportRetryQueue([]); }} className="rounded-xl border px-3 py-2 text-xs font-bold opacity-80 hover:opacity-100" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}>Cerrar</button>
                                        </div>
                                    </div>
                                )}

                                    </div>
                                </div>
                            </div>
                )}

                {view === 'library' && (
                    <div className="flex-shrink-0 flex items-center justify-between px-6 text-white shadow-lg topbar-glow z-20 h-16" style={{ backgroundColor: 'var(--topbar-bg)' }}>
                        <div className="flex items-center gap-5">
                            <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-black/20 rounded-full transition"><Icons.Menu /></button>
                            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setCurrentFilter('all')}>
                                <span className="text-2xl transition-transform group-hover:scale-110 duration-300 inline-block drop-shadow-md">🦈</span>
                                <div className="flex flex-col leading-none">
                                    <span className="font-black text-xl tracking-tighter text-blue-300 uppercase">Shark</span>
                                    <span className="font-black text-xl tracking-tighter text-white uppercase -mt-1">Reader</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 justify-end flex-1">
                            <div className="flex items-center bg-black/20 rounded-xl border border-white/10 focus-within:bg-black/30 focus-within:border-white/30 transition-all w-52 md:w-64 lg:w-80 overflow-hidden relative">
                                <div className="absolute left-3 opacity-50 pointer-events-none"><Icons.Search /></div>
                                <input type="text" placeholder="Título, autor, serie, tags..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-transparent text-white placeholder-white/40 pl-10 pr-8 py-2 outline-none text-sm" />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="absolute right-2 opacity-50 hover:opacity-100 transition text-white text-xl leading-none">×</button>
                                )}
                            </div>
                            <div className="hidden md:flex gap-3 mr-2 items-center">
                                {books.length > 0 && (
                                    <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                                        <option value="lastRead">{t.sortLastRead}</option>
                                        <option value="added">{t.sortAdded}</option>
                                        <option value="name">{t.sortName}</option>
                                        <option value="progress">{t.sortProgress}</option>
                                        <option value="rating">Valoración</option>
                                        <option value="series">Serie</option>
                                    </select>
                                )}
                                <div className="flex bg-black/20 rounded-xl p-0.5 border border-white/10">
                                    <button onClick={() => setLibraryView('grid')} title="Vista cuadrícula"
                                        className={`px-2 py-1 rounded-lg text-xs font-bold transition ${libraryView === 'grid' ? 'bg-white/20' : 'opacity-50 hover:opacity-80'}`}>⊞</button>
                                    <button onClick={() => setLibraryView('list')} title="Vista lista"
                                        className={`px-2 py-1 rounded-lg text-xs font-bold transition ${libraryView === 'list' ? 'bg-white/20' : 'opacity-50 hover:opacity-80'}`}>☰</button>
                                    <button onClick={() => setLibraryView('series')} title="Vista series"
                                        className={`px-2 py-1 rounded-lg text-xs font-bold transition ${libraryView === 'series' ? 'bg-white/20' : 'opacity-50 hover:opacity-80'}`}>📚</button>
                                    <button onClick={() => { setIsSelecting(p => { if (p) clearSelection(); return !p; }); }} title="Selección múltiple"
                                        className={`px-2 py-1 rounded-lg text-xs font-bold transition ${isSelecting ? 'bg-white/25' : 'opacity-50 hover:opacity-80'}`}>☑</button>
                                </div>
                                <div className="w-px h-6 bg-white/20 mx-1"></div>
                                <button onClick={openFilePicker} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition font-semibold text-sm whitespace-nowrap"><Icons.Plus /> <span className="hidden xl:inline">{t.addBook}</span></button>
                                <button onClick={openFolderPicker} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition font-semibold text-sm whitespace-nowrap"><Icons.FolderPlus /> <span className="hidden xl:inline">{t.addFolder}</span></button>
                            </div>
                            {lastReadId && (
                                <button onClick={() => openBook(lastReadId)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-400 text-white shadow-md mr-2 whitespace-nowrap">
                                    <Icons.Play /> <span className="hidden lg:inline">{t.continueReading}</span>
                                </button>
                            )}
                            {addons.bookRoulette && books.length > 0 && (
                                <button onClick={spinBookRoulette} className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-cyan-500 hover:bg-cyan-400 text-white shadow-md mr-2 whitespace-nowrap">
                                    🎲 <span className="hidden lg:inline">{lang === 'en' ? 'Roulette' : 'Ruleta'}</span>
                                </button>
                            )}
                            <div className="relative z-50">
                                {!userProfile ? (
                                    <button onClick={() => setShowLoginModal(true)} className="bg-orange-500 hover:bg-orange-400 text-white font-bold py-2 px-4 rounded-full shadow-lg transition text-sm whitespace-nowrap">{t.loginBtn}</button>
                                ) : (
                                    <>
                                        <button onClick={e => { e.stopPropagation(); setShowUserMenu(p => !p); }} className="p-1 hover:bg-black/20 rounded-full transition flex items-center justify-center">
                                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-lg shadow-md border-2 border-white/20 overflow-hidden">{renderAvatar(userProfile.avatar)}</div>
                                        </button>
                                        {showUserMenu && (
                                            <UserMenu
                                                userProfile={userProfile}
                                                stats={stats}
                                                achievements={achievements}
                                                books={books}
                                                onNavigate={(v) => { setView(v); setShowUserMenu(false); }}
                                                onExport={() => { exportAllData(); setShowUserMenu(false); }}
                                                onImport={() => { importInputRef.current.click(); setShowUserMenu(false); }}
                                                onLogout={() => { setUserProfile(null); setShowUserMenu(false); }}
                                                onShowWorkshop={() => { setShowWorkshop(true); setShowUserMenu(false); }}
                                                onEditProfile={openEditProfile}
                                                importInputRef={importInputRef}
                                                lang={lang}
                                                levelSystemEnabled={!!addons.levelSystem}
                                                readerLevel={readerLevel}
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {view === 'library' && (filterTags.length > 0 || filterAuthors.length > 0) && (
                    <div className="flex-shrink-0 px-4 py-2 border-b border-black/5 dark:border-white/5 flex flex-wrap items-center gap-1.5" style={{ backgroundColor: 'color-mix(in srgb, var(--topbar-bg) 82%, transparent)' }}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/50">Filtros:</span>
                        {filterTags.map(tag => (
                            <button key={tag} onClick={() => toggleFilterTag(tag)}
                                className="flex items-center gap-1 bg-purple-500/80 text-white rounded-full px-2.5 py-1 text-xs font-bold hover:bg-purple-600 transition">
                                🏷️ {tag} ×
                            </button>
                        ))}
                        {filterAuthors.map(author => (
                            <button key={author} onClick={() => toggleFilterAuthor(author)}
                                className="flex items-center gap-1 bg-sky-500/80 text-white rounded-full px-2.5 py-1 text-xs font-bold hover:bg-sky-600 transition">
                                👤 {author} ×
                            </button>
                        ))}
                        <button onClick={() => { setFilterTags([]); setFilterAuthors([]); }}
                            className="text-xs font-bold text-white/50 hover:text-white/80 transition px-1">
                            Limpiar ×
                        </button>
                    </div>
                )}

                {/* ── TAB BAR — solo en biblioteca, muestra libros abiertos ── */}
                {view === 'library' && tabs.length > 0 && (
                    <TabBar
                        tabs={tabs}
                        activeTabId={activeTabId}
                        books={books}
                        onSwitch={(id) => { setActiveTabId(id); setView('reader'); }}
                        onClose={closeTab}
                        onGoToLibrary={() => setView('library')}
                    />
                )}

                {/* Inputs ocultos */}
                <input type="file" accept=".epub,.pdf" multiple ref={fileInputRef} className="hidden" onChange={handleFilesUpload} />
                <input type="file" multiple ref={folderInputRef} accept=".epub,.pdf" className="hidden" onChange={handleFilesUpload} webkitdirectory="" directory="" />
                <input type="file" accept=".json" ref={importInputRef} className="hidden" onChange={importData} />
                <input type="file" accept="image/*" ref={avatarInputRef} className="hidden" onChange={handleAvatarUpload} />
                <input type="file" accept="image/*" ref={coverInputRef} className="hidden" onChange={handleCoverUpload} />

                {/* ── MODALS ── */}

                <LoginModal
                    show={showLoginModal} onClose={() => setShowLoginModal(false)}
                    tempLoginName={tempLoginName} setTempLoginName={setTempLoginName}
                    tempLoginAvatar={tempLoginAvatar} avatarInputRef={avatarInputRef}
                    handleRandomEmoji={handleRandomEmoji} handleLogin={handleLogin}
                    t={t}
                />

                {/* ── MODAL EDITAR PERFIL ── */}
                <EditProfileModal
                    show={showEditProfileModal} onClose={() => setShowEditProfileModal(false)}
                    userProfile={userProfile}
                    tempEditAvatar={tempEditAvatar} setTempEditAvatar={setTempEditAvatar}
                    tempEditName={tempEditName} setTempEditName={setTempEditName}
                    handleEditAvatarUpload={handleEditAvatarUpload} saveEditProfile={saveEditProfile}
                />

                {/* ── MODAL ANIVERSARIO ── */}
                <AnniversaryModal anniversaryInfo={anniversaryInfo} onClose={() => setAnniversaryInfo(null)} />

                {/* ── SIDEBAR ── */}
                <Sidebar
                    open={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    stats={stats}
                    lastReadId={lastReadId}
                    openBook={openBook}
                    currentFilter={currentFilter}
                    setCurrentFilter={setCurrentFilter}
                    setView={setView}
                    libraryDerived={libraryDerived}
                    filterAuthors={filterAuthors}
                    toggleFilterAuthor={toggleFilterAuthor}
                    showAuthorSection={showAuthorSection}
                    setShowAuthorSection={setShowAuthorSection}
                    filterTags={filterTags}
                    toggleFilterTag={toggleFilterTag}
                    showTagSection={showTagSection}
                    setShowTagSection={setShowTagSection}
                    showRatingSection={showRatingSection}
                    setShowRatingSection={setShowRatingSection}
                    manualCollections={manualCollections}
                    createManualCollection={createManualCollection}
                    removeManualCollection={removeManualCollection}
                    renameManualCollection={renameManualCollection}
                    moveManualCollection={moveManualCollection}
                    renamingCollectionId={renamingCollectionId}
                    setRenamingCollectionId={setRenamingCollectionId}
                    renamingCollectionValue={renamingCollectionValue}
                    setRenamingCollectionValue={setRenamingCollectionValue}
                    customCategories={customCategories}
                    categoryColors={categoryColors}
                    setCategoryColors={setCategoryColors}
                    addNewCategory={addNewCategory}
                    removeCategory={removeCategory}
                    vocabulary={vocabulary}
                    setVocabulary={setVocabulary}
                    showVocabPanel={showVocabPanel}
                    setShowVocabPanel={setShowVocabPanel}
                    vocabSearch={vocabSearch}
                    setVocabSearch={setVocabSearch}
                    annotationSearch={annotationSearch}
                    setAnnotationSearch={setAnnotationSearch}
                    annotationBookFilter={annotationBookFilter}
                    setAnnotationBookFilter={setAnnotationBookFilter}
                    annotationBookOptions={annotationBookOptions}
                    annotationSummary={annotationSummary}
                    annotationGroups={annotationGroups}
                    exportAnnotations={exportAnnotations}
                    exportSingleQuote={exportSingleQuote}
                    exportQuotesAsImage={exportQuotesAsImage}
                    addons={addons}
                    toggleBookmarkInApp={toggleBookmarkInApp}
                    appliedTheme={appliedTheme}
                    journalEntries={journalEntries}
                    userProfile={userProfile}
                    t={t}
                    setShowStreakModal={setShowStreakModal}
                    setShowWorkshop={setShowWorkshop}
                    setShowJournalModal={setShowJournalModal}
                    setSettingsOpen={setSettingsOpen}
                />

                {/* ── MODAL RACHA ── */}
                <StreakModal
                    show={showStreakModal} onClose={() => setShowStreakModal(false)}
                    userProfile={userProfile} stats={stats}
                    dailyGoalMins={dailyGoalMins} setDailyGoalMins={setDailyGoalMins}
                    weeklyGoalMins={weeklyGoalMins} setWeeklyGoalMins={setWeeklyGoalMins}
                    yearlyGoal={yearlyGoal} setYearlyGoal={setYearlyGoal}
                    currentWeekMins={currentWeekMins} books={books}
                />

                {/* ── BIBLIOTECA ── */}
                {view === 'library' && (
                    <LibraryView
                        ref={libraryScrollRef}
                        searchTerm={searchTerm}
                        searchResultsWithMatches={searchResultsWithMatches}
                        displayedBooks={displayedBooks}
                        books={books}
                        currentFilter={currentFilter}
                        setCurrentFilter={setCurrentFilter}
                        setSearchTerm={setSearchTerm}
                        openBook={openBook}
                        handleContextMenu={handleContextMenu}
                        openBookIds={openBookIds}
                        openFilePicker={openFilePicker}
                        openFolderPicker={openFolderPicker}
                        libraryView={libraryView}
                        virtualLibrary={virtualLibrary}
                        addons={addons}
                        isSelecting={isSelecting}
                        selectedBookIds={selectedBookIds}
                        toggleSelectBook={toggleSelectBook}
                        selectAll={selectAll}
                        clearSelection={clearSelection}
                        quickEditBookId={quickEditBookId}
                        setQuickEditBookId={setQuickEditBookId}
                        saveQuickEdit={saveQuickEdit}
                        draggedBookId={draggedBookId}
                        setDraggedBookId={setDraggedBookId}
                        dropTargetCat={dropTargetCat}
                        setDropTargetCat={setDropTargetCat}
                        bulkToggleFav={bulkToggleFav}
                        bulkMarkFinished={bulkMarkFinished}
                        bulkAssignCategory={bulkAssignCategory}
                        bulkDeleteBooks={bulkDeleteBooks}
                        bulkAddToCollection={bulkAddToCollection}
                        customCategories={customCategories}
                        manualCollections={manualCollections}
                    />
                )}
                {/* ── CONTEXT MENU ── */}
                {contextMenu && (
                    <div className="absolute shadow-2xl rounded-2xl py-2 z-50 text-sm border backdrop-blur-xl fade-in" style={{ top: contextMenu.y, left: contextMenu.x, backgroundColor: 'var(--surface-bg)', color: 'var(--text-color)', borderColor: 'var(--border-color)', minWidth: '220px' }}>
                        <button onClick={() => { setActiveBookModal(contextMenu.book); setContextMenu(null); }} className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 font-semibold transition"><Icons.Info /> {t.bookInfo}</button>
                        <button onClick={() => { fetchOpenLibraryMeta(contextMenu.book); setContextMenu(null); }} className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 font-semibold transition">🔍 Buscar info (OpenLibrary)</button>
                        <button onClick={() => { toggleFavorite(contextMenu.book.id); setContextMenu(null); }} className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 font-semibold transition"><Icons.Heart fill={contextMenu.book.isFav ? '#ef4444' : 'none'} className={contextMenu.book.isFav ? 'text-red-500' : ''} /> {contextMenu.book.isFav ? t.remFav : t.addFav}</button>
                        <button onClick={() => { markFinished(contextMenu.book.id); setContextMenu(null); }} className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 font-semibold transition">
                            {contextMenu.book.isFinished ? '↩️' : '✅'} {contextMenu.book.isFinished ? 'Marcar como leyendo' : 'Marcar como terminado'}
                        </button>
                        <div className="border-t my-1" style={{ borderColor: 'var(--border-color)' }}></div>
                        <button onClick={() => { deleteBook(contextMenu.book.id); setContextMenu(null); }} className="w-full text-left px-5 py-3 flex items-center gap-3 text-red-500 hover:bg-red-500/10 font-bold transition"><Icons.Trash /> {t.deleteBook}</button>
                    </div>
                )}

                {/* ── MODAL INFO LIBRO ── */}
                <BookInfoModal
                    book={activeBookModal} onChange={setActiveBookModal} onClose={() => setActiveBookModal(null)}
                    onSave={saveActiveBookMetadata} onMarkFinished={markFinished} onRestoreOriginal={restoreOriginalMetadata}
                    onToggleCollection={toggleBookInCollection}
                    onCreateCollection={createManualCollection}
                    coverInputRef={coverInputRef} customCategories={customCategories} manualCollections={manualCollections} t={t}
                />

                {/* ── MODAL SETTINGS (extracted) ── */}
                {settingsOpen && (
                    <SettingsPanel
                        open={settingsOpen} onClose={() => setSettingsOpen(false)}
                        theme={theme} setTheme={setTheme}
                        autoDarkMode={autoDarkMode} setAutoDarkMode={setAutoDarkMode}
                        warmMode={warmMode} setWarmMode={setWarmMode}
                        readFlow={readFlow} setReadFlow={setReadFlow}
                        readLayout={readLayout} setReadLayout={setReadLayout}
                        pageTransition={pageTransition} setPageTransition={setPageTransition}
                        lang={lang} setLang={setLang}
                        aiProvider={aiProvider} setAiProvider={setAiProvider}
                        aiApiKey={aiApiKey} setAiApiKey={setAiApiKey}
                        syncFolder={syncFolder} setSyncFolder={setSyncFolder}
                        accentColor={accentColor} setAccentColor={setAccentColor}
                        tutorialEnabled={tutorialEnabled} setTutorialEnabled={setTutorialEnabled}
                        onRestartTutorial={restartTutorial}
                        onExportDiagnostics={exportDiagnostics}
                        onClearDiagnostics={clearDiagnostics}
                        onExportZipBackup={exportZipBackup}
                        onDeleteAccount={deleteAccountAndData}
                        t={t}
                    />
                )}

                {/* ── ANALYTICS VIEW ── */}
                {(view === 'analytics' || view === 'achievements') && (
                    <div className="flex-1 overflow-hidden">
                        <Suspense fallback={panelLoader('Cargando analiticas...')}>
                            <AnalyticsView
                                stats={stats}
                                books={books}
                                vocabulary={vocabulary}
                                achievements={achievements}
                                addons={addons}
                                addonConfig={addonConfig}
                                yearlyGoal={yearlyGoal}
                                dailyGoalMins={dailyGoalMins}
                                weeklyGoalMins={weeklyGoalMins}
                                currentWeekMins={currentWeekMins}
                                readerLevel={readerLevel}
                                journalEntries={journalEntries}
                                initialTab={view === 'achievements' ? 'achievements' : 'stats'}
                                onBack={() => setView('library')}
                                onReadingPlanSet={() => setStats(prev => prev.readingPlanSet ? prev : { ...prev, readingPlanSet: true })}
                            />
                        </Suspense>
                    </div>
                )}

                {/* ── READER ── */}
                {view === 'reader' && currentBookData && stableCurrentBookData && (
                    <div className="flex-1 flex overflow-hidden relative w-full" style={{ backgroundColor: 'var(--bg-color)' }}>
                        {/* Panel izquierdo / principal */}
                        <div className={`flex flex-col ${panelMode && rightBookData ? 'w-1/2 border-r border-white/10' : 'w-full'} overflow-hidden`}>
                            {currentBookData.type === 'epub' ? (
                                <EpubReaderBoundary onClose={closeBook} resetKey={currentBookData.id}>
                                    <Suspense fallback={readerLoader(`Abriendo ${currentBookData.name || 'libro'}...`)}>
                                        <EpubReader
                                            bookData={stableCurrentBookData}
                                            targetCfi={currentTargetCfi}
                                            theme={appliedTheme} t={t} lang={lang}
                                            readFlow={readFlow} readLayout={readLayout}
                                            updateLocationAndProgress={updateBookLocation}
                                            toggleBookmark={toggleBookmarkInApp}
                                            isFullscreen={isFullscreen}
                                            focusMode={addons.focusMode}
                                            pageTransition={pageTransition}
                                            smartTocAddon={addons.smartToc}
                                            dyslexiaAddon={addons.dyslexiaMode}
                                            dyslexiaModeActive={!!addonConfig.dyslexiaMode?.readerEnabled}
                                            onToggleDyslexiaMode={() => updateAddonConfig('dyslexiaMode', { readerEnabled: !addonConfig.dyslexiaMode?.readerEnabled })}
                                            onClose={closeBook}
                                            onOpenSettings={() => setSettingsOpen(true)}
                                            onStatsUpdate={handleReaderPageTurn}
                                            onOpenBookInfo={() => setActiveBookModal(booksById.get(currentBookData.id) || currentBookData)}
                                            onSaveWord={saveWordToVocab}
                                            aiProvider={aiProvider}
                                            aiApiKey={aiApiKey}
                                            tabs={tabs}
                                            activeTabId={activeTabId}
                                            allBooks={readerTabBooks}
                                            onSwitchTab={switchReaderTab}
                                            onCloseTab={closeTab}
                                            onGoToLibrary={() => setView('library')}
                                            onToggleSpread={toggleSpreadLayout}
                                        />
                                    </Suspense>
                                </EpubReaderBoundary>
                            ) : (
                                <EpubReaderBoundary onClose={closeBook} resetKey={currentBookData.id}>
                                    <Suspense fallback={readerLoader(`Abriendo ${currentBookData.name || 'documento'}...`)}>
                                        <PdfReader
                                        bookData={stableCurrentBookData}
                                        theme={appliedTheme} t={t} lang={lang}
                                        isFullscreen={isFullscreen}
                                        focusMode={addons.focusMode}
                                        onClose={closeBook}
                                        onOpenSettings={() => setSettingsOpen(true)}
                                        onOpenBookInfo={() => setActiveBookModal(booksById.get(currentBookData.id) || currentBookData)}
                                        onPersistPdfZoom={persistPdfZoom}
                                        updateLocationAndProgress={updateBookLocation}
                                        toggleBookmark={toggleBookmarkInApp}
                                        onStatsUpdate={handleReaderPageTurn}
                                        tabs={tabs} activeTabId={activeTabId} allBooks={readerTabBooks}
                                        onSwitchTab={switchReaderTab}
                                        onCloseTab={closeTab}
                                        onGoToLibrary={() => setView('library')}
                                        />
                                    </Suspense>
                                </EpubReaderBoundary>
                            )}
                        </div>

                        {/* Panel derecho (multi-panel) */}
                        {panelMode && rightBookData && stableRightBookData && (
                            <div className="w-1/2 flex flex-col overflow-hidden">
                                {/* Selector de qué tab mostrar en el panel derecho */}
                                <div className="flex-shrink-0 flex items-center gap-1 px-2 h-9 overflow-x-auto" style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    {tabs.filter(tb => tb.id !== activeTabId).map(tb => {
                                        const bk = booksById.get(tb.bookId);
                                        return (
                                            <button key={tb.id} onClick={() => setRightTabId(tb.id)}
                                                className={`flex-shrink-0 px-3 py-1 rounded-lg text-[11px] font-semibold text-white transition ${rightTabId === tb.id ? 'bg-white/20' : 'hover:bg-white/10 opacity-60'}`}>
                                                {bk?.name || 'Libro'}
                                            </button>
                                        );
                                    })}
                                    <button onClick={() => { setPanelMode(false); setRightTabId(null); }} className="ml-auto px-2 text-white/40 hover:text-white transition text-lg">×</button>
                                </div>
                                {rightBookData.type === 'epub' ? (
                                    <EpubReaderBoundary onClose={() => { setPanelMode(false); setRightTabId(null); }} resetKey={rightBookData.id}>
                                        <Suspense fallback={readerLoader(`Abriendo ${rightBookData.name || 'libro'}...`)}>
                                            <EpubReader
                                            bookData={stableRightBookData}
                                            targetCfi={tabTargetCfi[rightTabId] || null}
                                            theme={appliedTheme} t={t} lang={lang}
                                            readFlow={readFlow} readLayout={readLayout}
                                            updateLocationAndProgress={updateBookLocation}
                                            toggleBookmark={toggleBookmarkInApp}
                                            isFullscreen={false}
                                            focusMode={addons.focusMode}
                                            pageTransition={pageTransition}
                                            smartTocAddon={addons.smartToc}
                                            dyslexiaAddon={addons.dyslexiaMode}
                                            dyslexiaModeActive={!!addonConfig.dyslexiaMode?.readerEnabled}
                                            onToggleDyslexiaMode={() => updateAddonConfig('dyslexiaMode', { readerEnabled: !addonConfig.dyslexiaMode?.readerEnabled })}
                                            onClose={() => { setPanelMode(false); setRightTabId(null); }}
                                            onOpenSettings={() => setSettingsOpen(true)}
                                            onStatsUpdate={handleReaderPageTurn}
                                            onOpenBookInfo={() => setActiveBookModal(booksById.get(rightBookData.id) || rightBookData)}
                                            onSaveWord={saveWordToVocab}
                                            aiProvider={aiProvider}
                                            aiApiKey={aiApiKey}
                                            onToggleSpread={toggleSpreadLayout}
                                            />
                                        </Suspense>
                                    </EpubReaderBoundary>
                                ) : (
                                    <EpubReaderBoundary onClose={() => { setPanelMode(false); setRightTabId(null); }} resetKey={rightBookData.id}>
                                        <Suspense fallback={readerLoader(`Abriendo ${rightBookData.name || 'documento'}...`)}>
                                            <PdfReader
                                            bookData={stableRightBookData}
                                            theme={appliedTheme} t={t} lang={lang}
                                            isFullscreen={false}
                                            onClose={() => { setPanelMode(false); setRightTabId(null); }}
                                            onOpenSettings={() => setSettingsOpen(true)}
                                            onOpenBookInfo={() => setActiveBookModal(booksById.get(rightBookData.id) || rightBookData)}
                                            onPersistPdfZoom={persistPdfZoom}
                                            updateLocationAndProgress={updateBookLocation}
                                            toggleBookmark={toggleBookmarkInApp}
                                            onStatsUpdate={handleReaderPageTurn}
                                            />
                                        </Suspense>
                                    </EpubReaderBoundary>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {/* ── WORKSHOP ── */}
                {showWorkshop && (
                    <PanelErrorBoundary name="Workshop" label="Workshop" onClose={() => setShowWorkshop(false)}>
                        <WorkshopPanel
                            addons={addons}
                            addonConfig={addonConfig}
                            externalSources={externalSources}
                            onToggle={toggleAddon}
                            onUpdateAddonConfig={updateAddonConfig}
                            onUpdateExternalSources={setExternalSources}
                            catalogState={externalCatalogState}
                            onBrowseSource={browseExternalSource}
                            onNavigateCatalog={(url) => browseExternalCatalogUrl(url, {
                                allowPrivateNetwork: !!externalCatalogState.catalog?.allowPrivateNetwork,
                                sourceName: externalCatalogState.catalog?.sourceName,
                            })}
                            onImportCatalogEntry={importExternalCatalogEntry}
                            onPickAddonFolder={pickAddonFolder}
                            onClose={() => setShowWorkshop(false)}
                            lang={lang}
                        />
                    </PanelErrorBoundary>
                )}

                {rouletteBook && (
                    <div className="fixed inset-0 z-[650] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm fade-in" onClick={() => setRouletteBook(null)}>
                        <div className="book-roulette-modal" onClick={e => e.stopPropagation()}>
                            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-300">{lang === 'en' ? 'Book Roulette' : 'Ruleta de Libros'}</p>
                            <h2 className="mt-2 text-2xl font-black">{lang === 'en' ? 'Your next read' : 'Tu próxima lectura'}</h2>
                            <div className="mt-6 flex items-center gap-5">
                                <div className="h-40 w-28 overflow-hidden rounded-2xl bg-slate-800 shadow-xl">
                                    {rouletteBook.coverUrl ? <img src={rouletteBook.coverUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs font-black">{rouletteBook.name}</div>}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-xl font-black leading-tight">{rouletteBook.name}</h3>
                                    <p className="mt-1 text-sm opacity-60">{rouletteBook.author}</p>
                                    <p className="mt-4 text-xs font-bold opacity-50">{rouletteBook.progress || 0}% {lang === 'en' ? 'read' : 'leído'}</p>
                                </div>
                            </div>
                            <div className="mt-6 flex gap-3">
                                <button onClick={() => openBook(rouletteBook.id)} className="flex-1 rounded-xl bg-[var(--highlight)] px-4 py-3 text-sm font-black text-white">{lang === 'en' ? 'Read now' : 'Leer ahora'}</button>
                                <button onClick={spinBookRoulette} className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15">{lang === 'en' ? 'Again' : 'Otra vez'}</button>
                                <button onClick={() => setRouletteBook(null)} className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15">{lang === 'en' ? 'Close' : 'Cerrar'}</button>
                            </div>
                        </div>
                    </div>
                )}


                {/* ── DRAG & DROP ZONE ── */}
                {draggedBookId && (
                    <div className="fixed bottom-0 left-0 right-0 z-[500] flex items-center gap-2 p-3 justify-center fade-in"
                        style={{ backgroundColor: 'var(--surface-bg)', borderTop: '1px solid var(--border-color)', boxShadow: '0 -4px 24px rgba(0,0,0,0.2)' }}>
                        <span className="text-xs font-black opacity-50 mr-1">Mover a:</span>
                        {[...customCategories].map(cat => (
                            <div key={cat}
                                onDragOver={e => { e.preventDefault(); setDropTargetCat(cat); }}
                                onDragLeave={() => setDropTargetCat(null)}
                                onDrop={e => { e.preventDefault(); assignBookCategory(draggedBookId, cat); }}
                                className="px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition flex-shrink-0"
                                style={{
                                    backgroundColor: dropTargetCat === cat ? 'var(--highlight)' : 'var(--bg-color)',
                                    color: dropTargetCat === cat ? 'white' : 'var(--text-color)',
                                    border: `2px solid ${dropTargetCat === cat ? 'var(--highlight)' : 'var(--border-color)'}`,
                                    transform: dropTargetCat === cat ? 'scale(1.05)' : 'scale(1)',
                                }}>
                                📁 {cat}
                            </div>
                        ))}
                        {customCategories.length === 0 && (
                            <span className="text-xs opacity-40 italic">No tienes categorías. Créalas en el menú lateral.</span>
                        )}
                        <button onClick={() => setDraggedBookId(null)} className="ml-2 opacity-40 hover:opacity-100 transition text-lg leading-none">×</button>
                    </div>
                )}

                {/* ── ACHIEVEMENT TOAST ── */}
                {achievementToast && userProfile && (() => {
                    const r = RARITY[achievementToast.rarity];
                    return (
                        <div className="fixed top-6 right-6 z-[9999]" style={{ animation: 'fadeInUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                            <div className="achievement-toast-card flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border"
                                style={{ backgroundColor: 'var(--surface-bg)', borderColor: r.border, minWidth: 260, maxWidth: 320, '--achievement-color': r.color }}>
                                <div className="text-3xl flex-shrink-0" style={{ animation: 'sharkyBounce 0.6s ease' }}>{achievementToast.emoji}</div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: r.color }}>¡Logro desbloqueado!</span>
                                    </div>
                                    <p className="font-black text-sm leading-tight">{achievementToast.name}</p>
                                    <p className="text-[11px] opacity-60 mt-0.5">{achievementToast.desc}</p>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {noticeToast && (
                    <div className="fixed bottom-6 left-6 z-[9998]" style={{ animation: 'fadeInUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                        <div
                            className="notice-toast-card relative overflow-hidden flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl border max-w-sm"
                            style={{
                                backgroundColor: 'var(--surface-bg)',
                                borderColor: noticeToast.tone === 'warning' ? 'rgba(251,191,36,0.45)' : 'rgba(59,130,246,0.35)',
                                '--notice-color': noticeToast.tone === 'warning' ? '#fbbf24' : noticeToast.tone === 'success' ? '#22c55e' : 'var(--highlight)',
                            }}
                        >
                            <div className="text-xl leading-none">{noticeToast.tone === 'warning' ? '⚠️' : 'ℹ️'}</div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-55">
                                    {noticeToast.tone === 'warning' ? 'Importacion' : 'Aviso'}
                                </p>
                                <p className="mt-1 text-sm font-semibold opacity-85">{noticeToast.message}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── READING JOURNAL MODAL ── */}
                {showJournalModal && (
                    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-in" onClick={() => setShowJournalModal(false)}>
                        <div className="bg-[var(--surface-bg)] w-full max-w-md rounded-3xl shadow-2xl border border-[var(--border-color)] flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-6 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                                <h2 className="font-black text-xl flex items-center gap-2">📓 Reading Journal</h2>
                                <button onClick={() => setShowJournalModal(false)} className="p-2 opacity-60 hover:opacity-100 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition">✕</button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                {journalEntries.length === 0 ? (
                                    <p className="text-center opacity-40 italic text-sm py-8">Aún no hay entradas. Lee y cierra un libro para generar la primera.</p>
                                ) : journalEntries.map(entry => (
                                    <div key={entry.id} className="p-4 rounded-2xl border" style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}>
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <p className="font-black text-sm flex-1 leading-tight">{entry.bookName}</p>
                                            <span className="text-[10px] opacity-40 font-bold flex-shrink-0">{entry.date}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px]">
                                            <span className="opacity-60">⏱️ {entry.minutes >= 60 ? `${Math.floor(entry.minutes/60)}h ${entry.minutes%60}m` : `${entry.minutes}m`}</span>
                                            <span className="opacity-60">📈 {entry.progress}% completado</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {journalEntries.length > 0 && (
                                <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                                    <button onClick={() => {
                                        let md = '# 📓 Reading Journal — Shark Reader\n\n';
                                        journalEntries.forEach(e => { md += `### ${e.date} — ${e.bookName}\n- Tiempo: ${e.minutes}min\n- Progreso: ${e.progress}%\n\n`; });
                                        const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
                                        const a = document.createElement('a'); a.href = url; a.download = 'ReadingJournal.md'; a.click(); URL.revokeObjectURL(url);
                                    }} className="w-full py-2.5 rounded-xl font-bold text-white text-sm transition hover:brightness-110" style={{ backgroundColor: 'var(--highlight)' }}>
                                        Exportar .MD
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        );
    };

const AppWithErrorBoundary = () => <ErrorBoundary><App /></ErrorBoundary>;
export default AppWithErrorBoundary;
