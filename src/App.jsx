// SharkReader - App Component (v2 — Tabs + Optimizations + Series + Vocab + AI)
import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense, startTransition, useDeferredValue } from 'react';
import { Icons, renderAvatar } from './icons';
import { translations, languageNames, RANDOM_EMOJIS } from './translations';
import { safeParse, loadBooksFromDB, saveBookToDB, saveBooksToDB, saveAppData, loadAppData, saveSetting, resetAllAppData, getAppDataCounts, saveCache, loadCacheByPrefix } from './db';
import { extractEpubMeta } from './epubMeta';
import { RARITY } from './achievements';
import { DEFAULT_EXTERNAL_SOURCES, migrateWorkshopData, normalizeAddonConfig, normalizeAddonState, validateAddonToggle } from './workshopModules';
import {
    applyImportedBookData,
    getBookDedupKey,
    getBookSearchIndex,
    getBookTitleDedupKey,
    hydrateStoredBook,
    stripBookFilesForExport,
    toStoredBookRecord,
    updateBookInList,
} from './bookModel';
import { buildPortableBackup, mergeBackupData } from './backupMerge';
import { readerXp, readerLevelFromXp } from './readingProgress';
import BookCard from './BookCard';
import QuickEditCard from './QuickEditCard';
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
import { buildBookContentExcerpt, buildBookContentIndex, CONTENT_INDEX_CACHE_PREFIX } from './contentIndex';

const EpubReader = lazy(() => import('./EpubReader'));
const PdfReader = lazy(() => import('./PdfReader'));
const AnalyticsView = lazy(() => import('./AnalyticsView'));

const LIBRARY_VIRTUALIZE_THRESHOLD = 80;
const LIBRARY_SCROLL_OVERSCAN = 4;
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

const normalizeTagKey = (value) => String(value || '').trim().toLowerCase();
const ANNOTATION_COLOR_META = {
    yellow: { label: 'Importante', swatch: '#facc15' },
    green: { label: 'Idea', swatch: '#22c55e' },
    blue: { label: 'Duda', swatch: '#3b82f6' },
    pink: { label: 'Cita', swatch: '#f472b6' },
};
    // ─────────────────────────────────────────
    // APP PRINCIPAL
    // ─────────────────────────────────────────
    const App = () => {

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
        const goodreadsInputRef = useRef(null);
        const avatarInputRef = useRef(null);
        const coverInputRef = useRef(null);
        const libraryScrollRef = useRef(null);
        const booksRef = useRef([]); // To safely access books in async effects without dependencies
        const contentIndexQueueRef = useRef([]);
        const contentIndexRunningRef = useRef(false);
        const persistTimerRef = useRef(null);       // books debounce
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
            if (!isDbLoaded || !isStateHydrated) return;
            const candidates = books
                .filter(book => !book.loading && (book.type === 'epub' || book.type === 'pdf') && book.file)
                .filter(book => !contentIndexMap[book.id]?.text)
                .map(book => book.id);
            if (!candidates.length) return;
            contentIndexQueueRef.current = Array.from(new Set([...contentIndexQueueRef.current, ...candidates]));
            if (contentIndexRunningRef.current) return;

            let cancelled = false;
            const run = async () => {
                contentIndexRunningRef.current = true;
                while (!cancelled && contentIndexQueueRef.current.length > 0) {
                    const bookId = contentIndexQueueRef.current.shift();
                    if (!bookId || contentIndexMap[bookId]?.text) continue;
                    const book = booksRef.current.find(item => item.id === bookId);
                    if (!book?.file || (book.type !== 'epub' && book.type !== 'pdf')) continue;
                    try {
                        const text = await buildBookContentIndex(book);
                        const payload = {
                            text,
                            excerpt: buildBookContentExcerpt(text),
                            indexedAt: Date.now(),
                        };
                        await saveCache(`${CONTENT_INDEX_CACHE_PREFIX}${bookId}`, payload);
                        if (!cancelled) {
                            setContentIndexMap(prev => (prev[bookId]?.text === payload.text ? prev : { ...prev, [bookId]: payload }));
                        }
                    } catch (error) {
                        console.warn(`[SharkReader] No se pudo indexar contenido para ${book?.name || bookId}:`, error);
                    }
                }
                contentIndexRunningRef.current = false;
            };

            run();
            return () => {
                cancelled = true;
            };
        }, [books, contentIndexMap, isDbLoaded, isStateHydrated]);

        useEffect(() => {
            if (view !== 'library') return;
            const node = libraryScrollRef.current;
            if (!node) return;

            let frame = 0;
            const syncViewport = () => {
                cancelAnimationFrame(frame);
                frame = requestAnimationFrame(() => {
                    setLibraryViewport({
                        width: node.clientWidth,
                        height: node.clientHeight,
                        scrollTop: node.scrollTop,
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
                        await resetAllAppData();
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
                    resetAllAppData().finally(() => {
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

            // Small delay to let React finish the initial render
            const timer = setTimeout(async () => {
                const UNKNOWN = ['Autor desconocido', 'Unknown Author', 'Autor Desconocido', 'unknown author'];

                // En Electron instalado, un File de IDB puede fallar si perdió el permiso.
                const currentBooks = booksRef.current || [];
                const needsMeta = currentBooks.filter(b =>
                    b.type === 'epub' &&
                    b.file &&
                    // b.file.size > 0 && // No confiamos en file.size en Electron
                    (!b.coverUrl || UNKNOWN.some(u => u.toLowerCase() === (b.originalAuthor || '').toLowerCase())) &&
                    !metadataRepairingRef.current.has(b.id)
                );

                if (!needsMeta.length) {
                    console.log('[SharkReader] No hay libros que necesiten re-extracción');
                    return;
                }

                console.log(`[SharkReader] Re-extrayendo metadata para ${needsMeta.length} libro(s)...`);
                needsMeta.forEach(book => metadataRepairingRef.current.add(book.id));

                const withTimeout = (p, ms, def = null) =>
                    Promise.race([Promise.resolve(p).catch(e => { console.error('[SharkReader] extractEpubMeta error:', e); return def; }), new Promise(r => setTimeout(() => r(def), ms))]);

                for (const book of needsMeta) {
                    await new Promise(r => setTimeout(r, 80));
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
            }, 500);

            return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [isDbLoaded]);

        // ── PERSIST: books + categories (debounce 2000ms + idle so it never blocks reading)
        useEffect(() => {
            if (!isDbLoaded || !isStateHydrated || isResettingRef.current) return;
            clearTimeout(persistTimerRef.current);
            persistTimerRef.current = setTimeout(() => {
                // Use requestIdleCallback so JSON serialization doesn't block page turns
                const doSave = () => {
                    const bookRecords = books.filter(b => !b.loading).map(b => toStoredBookRecord(b, {}, { includeFile: false }));
                    saveBooksToDB(bookRecords);
                    saveSetting('categories', customCategories);
                    saveSetting('collections', manualCollections);
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
                saveAppData('theme', theme);
                saveAppData('autoDarkMode', autoDarkMode);
                saveAppData('tutorialEnabled', tutorialEnabled);
                saveAppData('tutorialSeen', !showWelcomeTutorial);
                saveAppData('tutorialSeenHints', tutorialSeenHints);
                saveAppData('lang', lang);
                saveAppData('readFlow', readFlow);
                saveAppData('readLayout', readLayout);
                saveAppData('pageTransition', pageTransition);
                saveAppData('warmMode', warmMode);
                saveAppData('libraryView', libraryView);
                saveAppData('accentColor', accentColor);
            }, 1000);
            return () => clearTimeout(persistSettingsRef.current);
        }, [theme, autoDarkMode, tutorialEnabled, showWelcomeTutorial, tutorialSeenHints, lang, readFlow, readLayout, pageTransition, warmMode, libraryView, accentColor, isDbLoaded, isStateHydrated]);

        // ── PERSIST: user data & goals → IndexedDB (debounce 1500ms)
        useEffect(() => {
            if (!isDbLoaded || !isStateHydrated || isResettingRef.current) return;
            clearTimeout(persistUserRef.current);
            persistUserRef.current = setTimeout(() => {
                saveAppData('userProfile', userProfile);
                saveAppData('vocabulary', vocabulary);
                saveAppData('dailyGoalMins', dailyGoalMins);
                saveAppData('weeklyGoalMins', weeklyGoalMins);
                saveAppData('yearlyGoal', yearlyGoal);
                saveAppData('achievements', achievements);
                saveAppData('journalEntries', journalEntries);
                saveAppData('currentFilter', currentFilter);
                saveAppData('sortBy', sortBy);
                saveAppData('categoryColors', categoryColors);
            }, 1500);
            return () => clearTimeout(persistUserRef.current);
        }, [userProfile, vocabulary, dailyGoalMins, weeklyGoalMins, yearlyGoal, achievements, journalEntries, currentFilter, sortBy, categoryColors, isDbLoaded, isStateHydrated]);

        // ── PERSIST: addons & AI config → IndexedDB (debounce 1500ms)
        useEffect(() => {
            if (!isDbLoaded || !isStateHydrated || isResettingRef.current) return;
            clearTimeout(persistAddonsRef.current);
            persistAddonsRef.current = setTimeout(() => {
                saveAppData('aiProvider', aiProvider);
                saveAppData('aiApiKey', aiApiKey);
                saveAppData('syncFolder', syncFolder);
                saveAppData('externalSources', externalSources);
                saveAppData('addons', addons);
                saveAppData('addonConfig', addonConfig);
                saveAppData('workshop', migrateWorkshopData({ addons, addonConfig, externalSources }));
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
            saveAppData('readerSession', session);
            localStorage.setItem('sharkreader_reader_session', JSON.stringify(session));
        }, [tabs, activeTabId, tabTargetCfi, panelMode, rightTabId, isStateHydrated]);

        useEffect(() => {
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
        }, [books, tabs, activeTabId, rightTabId]);

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
            setTimeout(() => {
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

        const toggleSpreadLayout = useCallback(() => {
            setReadLayout(prev => prev === 'auto' ? 'none' : 'auto');
        }, []);

        const activeTab = tabs.find(t => t.id === activeTabId);
        const currentBookData = useMemo(() => activeTab ? booksById.get(activeTab.bookId) || null : null, [activeTab, booksById]);
        const currentTargetCfi = tabTargetCfi[activeTabId] || null;
        const rightBookData = useMemo(() => {
            if (!panelMode || !rightTabId) return null;
            const rt = tabs.find(t => t.id === rightTabId);
            return rt ? booksById.get(rt.bookId) || null : null;
        }, [panelMode, rightTabId, tabs, booksById]);
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
                'page_transition',
            ];

            clearTimeout(persistTimerRef.current);
            clearTimeout(persistStatsRef.current);
            clearTimeout(persistSettingsRef.current);
            clearTimeout(persistUserRef.current);
            clearTimeout(persistAddonsRef.current);
            clearTimeout(syncTimerRef.current);
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
            folderImportQueueRef.current = [];
            folderImportProcessingRef.current = false;
            activeFolderImportIdRef.current = null;
            cancelFolderImportRef.current = true;
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
            setFolderImport(null);
            setFailedImportRetryQueue([]);
            setUserProfile(null);
            setBooks([]);

            await resetAllAppData();
            window.location.replace(window.location.pathname);
        }, []);

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

        const toggleAddon = (id) => {
            setAddons(prev => {
                const validation = validateAddonToggle(id, !prev[id], { userProfile, lang });
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
                const session = await window.electronAPI.startFolderImportPath(folder);
                if (session?.sessionId) {
                    beginFolderImportSession(session, 'Carpeta vigilada');
                    showNoticeToast('Carpeta vigilada: escaneo iniciado.', 'info');
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

        // ── v3.5: Import Goodreads CSV ──────────────────────────────────────────
        const importGoodreadsCSV = useCallback((e) => {
            const f = e.target.files[0]; if (!f) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const lines = ev.target.result.split('\n');
                    const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
                    const idx = (name) => header.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
                    const iTitle = idx('Title'), iAuthor = idx('Author'), iRating = idx('My Rating'),
                          iRead = idx('Date Read'), iAdded = idx('Date Added'), iShelf = idx('Exclusive Shelf'),
                          iISBN = idx('ISBN13');
                    let imported = 0, skipped = 0;
                    const now = Date.now();
                    const newBooks = [];
                    for (let i = 1; i < lines.length; i++) {
                        const cols = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,))/g) || lines[i].split(',');
                        const get = (j) => (cols[j] || '').replace(/^"|"$/g, '').trim();
                        const title = get(iTitle); if (!title) continue;
                        // Skip if already in library (title match)
                        const exists = books.some(b => b.name?.toLowerCase() === title.toLowerCase());
                        if (exists) { skipped++; continue; }
                        const rating = parseInt(get(iRating)) || 0;
                        const shelf = get(iShelf);
                        const dateRead = get(iRead) ? new Date(get(iRead)).getTime() || null : null;
                        const dateAdded = get(iAdded) ? new Date(get(iAdded)).getTime() || now : now;
                        const isbn = get(iISBN)?.replace(/[^0-9]/g, '') || null;
                        newBooks.push({
                            id: `gr-${Date.now()}-${i}`,
                            name: title, author: get(iAuthor), rating, type: 'epub',
                            isFinished: shelf === 'read',
                            dateAdded, dateFinished: dateRead || null,
                            coverUrl: isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg` : null,
                            tags: shelf && shelf !== 'to-read' && shelf !== 'read' ? [shelf] : [],
                            progress: shelf === 'read' ? 100 : 0,
                            bookmarks: [], readingMinutes: 0,
                            loading: false, file: null,
                            updatedAt: now, metadataUpdatedAt: now, progressUpdatedAt: now,
                            color: '#1e3a5f',
                            _goodreadsImport: true,
                        });
                        imported++;
                    }
                    if (newBooks.length) setBooks(prev => [...prev, ...newBooks]);
                    showNoticeToast(`Goodreads: ${imported} libros importados${skipped ? `, ${skipped} ya existían` : ''}.`, 'info');
                } catch (err) {
                    showNoticeToast('Error al leer el CSV de Goodreads. Comprueba el formato.', 'warning');
                }
            };
            reader.readAsText(f, 'utf-8');
            e.target.value = '';
        }, [books, setBooks, showNoticeToast]);

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


        const displayedBooks = useMemo(() => {
            const now = Date.now();
            const searchNeedle = deferredSearchTerm.trim().toLowerCase();
            const filtered = books.filter(b => {
                if (b.loading) return false;
                const contentIndex = contentIndexMap[b.id]?.text || '';
                if (currentFilter === 'favorites' && !b.isFav) return false;
                if (currentFilter === 'unfinished') return !b.isFinished;
                if (currentFilter === 'unstarted') return !b.lastReadDate && !b.isFinished;
                if (currentFilter === 'reading') return b.lastReadDate > 0 && !b.isFinished;
                if (currentFilter === 'finished') return b.isFinished === true;
                if (currentFilter === 'recents') return (b.dateAdded > now - 7 * 24 * 60 * 60 * 1000) || (b.lastReadDate > now - 14 * 24 * 60 * 60 * 1000);
                if (currentFilter.startsWith('collection:')) {
                    const collectionId = currentFilter.slice(11);
                    const collection = manualCollections.find(item => item.id === collectionId);
                    return !!collection?.bookIds?.includes(b.id);
                }
                if (currentFilter.startsWith('author:')) return b.author?.toLowerCase() === currentFilter.slice(7).toLowerCase();
                if (currentFilter.startsWith('tag:')) {
                    const tagNeedle = normalizeTagKey(currentFilter.slice(4));
                    return splitBookTags(b.tags).some(tag => normalizeTagKey(tag) === tagNeedle);
                }
                if (currentFilter.startsWith('rating:')) {
                    const requiredRating = Number(currentFilter.slice(7));
                    return Number(b.rating || 0) === requiredRating;
                }
                // Smart shelves (estanterías automáticas)
                if (currentFilter === 'shelf:abandoned') {
                    const now = Date.now();
                    return !b.isFinished && b.lastReadDate > 0 && (now - b.lastReadDate) > 180 * 86400000;
                }
                if (currentFilter === 'shelf:unopened') return !b.lastReadDate && !b.isFinished;
                if (currentFilter === 'shelf:almostdone') return !b.isFinished && (b.progress || 0) >= 80;
                if (currentFilter !== 'all' && currentFilter !== 'favorites' && b.category !== currentFilter) return false;
                // Combined multi-filters (AND logic across tag list and author list)
                if (filterTags.length > 0) {
                    const bookTagNorms = splitBookTags(b.tags).map(normalizeTagKey);
                    if (!filterTags.some(tag => bookTagNorms.includes(normalizeTagKey(tag)))) return false;
                }
                if (filterAuthors.length > 0) {
                    if (!filterAuthors.some(a => b.author?.toLowerCase() === a.toLowerCase())) return false;
                }
                if (searchNeedle) {
                    return getBookSearchIndex(b).includes(searchNeedle) || contentIndex.includes(searchNeedle);
                }
                return true;
            });
            return [...filtered].sort((a, b) => {
                if (sortBy === 'lastRead') return (b.lastReadDate || 0) - (a.lastReadDate || 0);
                if (sortBy === 'added') return (b.dateAdded || 0) - (a.dateAdded || 0);
                if (sortBy === 'name') return a.name.localeCompare(b.name);
                if (sortBy === 'progress') return (b.progress || 0) - (a.progress || 0);
                if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
                if (sortBy === 'series') {
                    const seriesCompare = (a.series || '').localeCompare(b.series || '');
                    if (seriesCompare !== 0) return seriesCompare;
                    const indexCompare = (a.seriesIndex || 0) - (b.seriesIndex || 0);
                    if (indexCompare !== 0) return indexCompare;
                    return a.name.localeCompare(b.name);
                }
                return 0;
            });
        }, [books, contentIndexMap, currentFilter, deferredSearchTerm, manualCollections, sortBy, filterTags, filterAuthors]);

        const selectAll = useCallback(() => {
            setSelectedBookIds(new Set(displayedBooks.map(b => b.id)));
        }, [displayedBooks]);

        const searchResultsWithMatches = useMemo(() => {
            if (!searchTerm) return null;
            const term = deferredSearchTerm.toLowerCase();
            return displayedBooks.map(b => ({
                ...b,
                contentMatch: (contentIndexMap[b.id]?.text || '').includes(term),
                matchedFields: [
                    b.name.toLowerCase().includes(term) && 'Título',
                    b.author.toLowerCase().includes(term) && 'Autor',
                    b.series && b.series.toLowerCase().includes(term) && 'Serie',
                    b.tags && b.tags.toLowerCase().includes(term) && 'Etiquetas',
                    b.description && b.description.toLowerCase().includes(term) && 'Sinopsis',
                    b.publisher && b.publisher.toLowerCase().includes(term) && 'Editorial',
                    (contentIndexMap[b.id]?.text || '').includes(term) && 'Contenido',
                ].filter(Boolean)
            }));
        }, [contentIndexMap, deferredSearchTerm, displayedBooks]);

        const libraryDerived = useMemo(() => {
            const now = Date.now();
            const authorsSet = new Set();
            const counts = {
                all: 0,
                reading: 0,
                unfinished: 0,
                unstarted: 0,
                finished: 0,
                favorites: 0,
                recents: 0,
                shelfAbandoned: 0,
                shelfUnopened: 0,
                shelfAlmostDone: 0,
            };
            const categoryCounts = new Map(customCategories.map(category => [category, 0]));
            const collectionCounts = new Map(manualCollections.map(collection => [collection.id, 0]));
            const authorCounts = new Map();
            const tagCounts = new Map();
            const ratingCounts = new Map([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);

            books.forEach(book => {
                if (book.loading) return;
                counts.all += 1;
                if (book.author) {
                    authorsSet.add(book.author);
                    authorCounts.set(book.author, (authorCounts.get(book.author) || 0) + 1);
                }
                if (book.lastReadDate > 0 && !book.isFinished) counts.reading += 1;
                if (!book.isFinished) counts.unfinished += 1;
                if (!book.lastReadDate && !book.isFinished) counts.unstarted += 1;
                if (book.isFinished) counts.finished += 1;
                if (book.isFav) counts.favorites += 1;
                if ((book.dateAdded > now - 7 * 24 * 60 * 60 * 1000) || (book.lastReadDate > now - 14 * 24 * 60 * 60 * 1000)) counts.recents += 1;
                if (!book.isFinished && book.lastReadDate > 0 && (now - book.lastReadDate) > 180 * 86400000) counts.shelfAbandoned += 1;
                if (!book.lastReadDate && !book.isFinished) counts.shelfUnopened += 1;
                if (!book.isFinished && (book.progress || 0) >= 80) counts.shelfAlmostDone += 1;
                if (book.category && categoryCounts.has(book.category)) {
                    categoryCounts.set(book.category, (categoryCounts.get(book.category) || 0) + 1);
                }
                manualCollections.forEach(collection => {
                    if (collection.bookIds?.includes(book.id)) {
                        collectionCounts.set(collection.id, (collectionCounts.get(collection.id) || 0) + 1);
                    }
                });
                splitBookTags(book.tags).forEach(tag => {
                    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
                });
                const rating = Number(book.rating || 0);
                if (rating >= 1 && rating <= 5) {
                    ratingCounts.set(rating, (ratingCounts.get(rating) || 0) + 1);
                }
            });

            return {
                authors: [...authorsSet].sort(),
                tags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
                counts,
                authorCounts,
                categoryCounts,
                collectionCounts,
                tagCounts,
                ratingCounts,
            };
        }, [books, customCategories, manualCollections]);

        const virtualLibrary = useMemo(() => {
            const total = displayedBooks.length;
            const enabled = !searchTerm && total > LIBRARY_VIRTUALIZE_THRESHOLD && libraryViewport.height > 0;
            if (!enabled) {
                return { enabled: false, items: displayedBooks, top: 0, totalHeight: 0, columns: 1 };
            }

            if (libraryView === 'list') {
                const itemHeight = 88;
                const startIndex = Math.max(0, Math.floor(libraryViewport.scrollTop / itemHeight) - LIBRARY_SCROLL_OVERSCAN);
                const visibleCount = Math.ceil(libraryViewport.height / itemHeight) + LIBRARY_SCROLL_OVERSCAN * 2;
                const endIndex = Math.min(total, startIndex + visibleCount);
                return {
                    enabled: true,
                    items: displayedBooks.slice(startIndex, endIndex),
                    top: startIndex * itemHeight,
                    totalHeight: total * itemHeight,
                    columns: 1,
                };
            }

            const horizontalPadding = libraryViewport.width >= 768 ? 96 : 32;
            const availableWidth = Math.max(260, libraryViewport.width - horizontalPadding);
            const minCardWidth = addons.netflixView ? 200 : 160;
            const columnGap = 24;
            const rowGap = addons.netflixView ? 32 : 40;
            const columns = Math.max(1, Math.floor((availableWidth + columnGap) / (minCardWidth + columnGap)));
            const cardWidth = (availableWidth - columnGap * (columns - 1)) / columns;
            const rowHeight = Math.ceil(cardWidth * 1.5 + 74 + rowGap);
            const rowCount = Math.ceil(total / columns);
            const startRow = Math.max(0, Math.floor(libraryViewport.scrollTop / rowHeight) - LIBRARY_SCROLL_OVERSCAN);
            const visibleRows = Math.ceil(libraryViewport.height / rowHeight) + LIBRARY_SCROLL_OVERSCAN * 2;
            const endRow = Math.min(rowCount, startRow + visibleRows);
            const startIndex = startRow * columns;
            const endIndex = Math.min(total, endRow * columns);

            return {
                enabled: true,
                items: displayedBooks.slice(startIndex, endIndex),
                top: startRow * rowHeight,
                totalHeight: rowCount * rowHeight,
                columns,
            };
        }, [addons.netflixView, displayedBooks, libraryView, libraryViewport.height, libraryViewport.scrollTop, libraryViewport.width, searchTerm]);

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

        const annotationEntries = useMemo(() => getAnnotationEntries(), [getAnnotationEntries]);
        const annotationBookOptions = useMemo(() => {
            const grouped = annotationEntries.reduce((acc, entry) => {
                if (!acc.has(entry.bookId)) {
                    acc.set(entry.bookId, { bookId: entry.bookId, bookName: entry.bookName, bookAuthor: entry.bookAuthor, total: 0 });
                }
                acc.get(entry.bookId).total += 1;
                return acc;
            }, new Map());
            return Array.from(grouped.values()).sort((a, b) => a.bookName.localeCompare(b.bookName, 'es'));
        }, [annotationEntries]);
        const filteredAnnotationEntries = useMemo(() => {
            const term = annotationSearch.trim().toLowerCase();
            return annotationEntries.filter(entry => {
                if (annotationBookFilter !== 'all' && entry.bookId !== annotationBookFilter) return false;
                if (!term) return true;
                return [
                    entry.text,
                    entry.bookName,
                    entry.bookAuthor,
                    entry.rawNote,
                    entry.colorLabel,
                    entry.kind,
                ].filter(Boolean).some(value => String(value).toLowerCase().includes(term));
            });
        }, [annotationBookFilter, annotationEntries, annotationSearch]);
        const annotationsByBook = useMemo(() => {
            return filteredAnnotationEntries.reduce((acc, entry) => {
                if (!acc[entry.bookId]) {
                    acc[entry.bookId] = {
                        bookId: entry.bookId,
                        bookName: entry.bookName,
                        bookAuthor: entry.bookAuthor,
                        total: 0,
                        highlights: 0,
                        notes: 0,
                        bookmarks: 0,
                        entries: [],
                    };
                }
                acc[entry.bookId].total += 1;
                if (entry.kind === 'highlight') acc[entry.bookId].highlights += 1;
                else if (entry.kind === 'note') acc[entry.bookId].notes += 1;
                else acc[entry.bookId].bookmarks += 1;
                acc[entry.bookId].entries.push(entry);
                return acc;
            }, {});
        }, [filteredAnnotationEntries]);
        const annotationGroups = useMemo(() => Object.values(annotationsByBook), [annotationsByBook]);
        const annotationSummary = useMemo(() => filteredAnnotationEntries.reduce((acc, entry) => {
            acc.total += 1;
            if (entry.kind === 'highlight') acc.highlights += 1;
            else if (entry.kind === 'note') acc.notes += 1;
            else acc.bookmarks += 1;
            return acc;
        }, { total: 0, highlights: 0, notes: 0, bookmarks: 0 }), [filteredAnnotationEntries]);
        const openBookIds = useMemo(() => new Set(tabs.map(t => t.bookId)), [tabs]);
        const folderImportOverlay = useMemo(() => {
            if (!folderImport) return null;

            const total = Math.max(folderImport.total || 0, folderImport.discovered || 0, 0);
            const imported = Math.min(folderImport.imported || 0, total || folderImport.imported || 0);
            const metadataProcessed = Math.min(folderImport.metadataProcessed || 0, total || folderImport.metadataProcessed || 0);
            const addedCount = Math.min(folderImport.addedCount || 0, metadataProcessed);
            const skippedDuplicates = folderImport.skippedDuplicates || 0;
            const failedCount = (folderImport.failedFiles || []).length;

            if (folderImport.phase === 'empty') {
                return { ...folderImport, title: 'No se encontraron libros', detail: 'La carpeta seleccionada no contiene EPUB ni PDF.', progress: 100, indeterminate: false, canCancel: false };
            }

            if (folderImport.phase === 'error') {
                return { ...folderImport, title: 'La importacion se detuvo', detail: folderImport.error || 'Ocurrio un error inesperado durante la importacion.', progress: 100, indeterminate: false, canCancel: false };
            }

            if (folderImport.phase === 'cancelled') {
                const skippedText = skippedDuplicates > 0 ? ` Se omitieron ${skippedDuplicates} duplicado(s).` : '';
                return { ...folderImport, title: 'Importacion cancelada', detail: `Se procesaron ${metadataProcessed} de ${total || imported || 0} libros antes de detenerse.${skippedText}`, progress: total > 0 ? Math.round((metadataProcessed / total) * 100) : 0, indeterminate: false, canCancel: false };
            }

            if (folderImport.phase === 'done') {
                const skippedText = skippedDuplicates > 0 ? ` Se omitieron ${skippedDuplicates} duplicado(s).` : '';
                const failedText = failedCount > 0 ? ` ${failedCount} archivo(s) fallaron.` : '';
                return { ...folderImport, title: failedCount > 0 ? 'Importacion completada con avisos' : 'Importacion completada', detail: `Se agregaron ${addedCount} libros${folderImport.folderName ? ` desde ${folderImport.folderName}` : ''}.${skippedText}${failedText}`, progress: 100, indeterminate: false, canCancel: false, failedCount };
            }

            if (folderImport.phase === 'metadata') {
                return { ...folderImport, title: 'Extrayendo portadas y metadatos', detail: `${metadataProcessed} de ${total || 0} libros listos.`, progress: total > 0 ? Math.round((metadataProcessed / total) * 100) : 0, indeterminate: false, canCancel: !folderImport.isCancelling };
            }

            if (folderImport.phase === 'importing') {
                return { ...folderImport, title: 'Importando libros en segundo plano', detail: `${imported} de ${total || 0} libros cargados desde disco.`, progress: total > 0 ? Math.round((imported / total) * 100) : 0, indeterminate: false, canCancel: !folderImport.isCancelling };
            }

            return { ...folderImport, title: 'Escaneando carpeta', detail: total > 0 ? `${total} libros detectados hasta ahora.` : 'Buscando archivos compatibles...', progress: 15, indeterminate: true, canCancel: !folderImport.isCancelling };
        }, [folderImport]);


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
                        onPet={() => setStats(prev => ({ ...prev, sharkyPets: (prev.sharkyPets || 0) + 1 }))}
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
                    <div key={activeTutorialHint.id} className="fixed bottom-5 right-5 z-[670] w-full max-w-[320px] rounded-[28px] border border-white/10 bg-slate-950/95 text-white shadow-2xl backdrop-blur-xl overflow-hidden">
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
                            <p className="text-xs text-white/65 leading-relaxed mb-4">{activeTutorialHint.body}</p>
                            <div className="flex items-center justify-between gap-3">
                                <button onClick={dismissTutorialHints} className="text-[11px] font-bold text-white/40 hover:text-white/70 transition">Omitir todos</button>
                                <button onClick={handleTutorialNext} className="rounded-2xl bg-sky-500 px-4 py-2 text-[11px] font-black text-slate-950 hover:bg-sky-400 transition">
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
                        <div className="folder-import-overlay pointer-events-auto w-full max-w-md rounded-[28px] border border-white/10 bg-slate-950/92 text-white shadow-2xl backdrop-blur-xl fade-in">
                            <div className="p-5 md:p-6">
                                <div className="flex items-start gap-4">
                                    <div className="folder-import-icon flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300">
                                        <Icons.FolderPlus />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-300/80">
                                            {folderImportOverlay.folderName || 'Importacion'}
                                        </p>
                                        <h3 className="mt-1 text-lg font-black leading-tight text-white">
                                            {folderImportOverlay.title}
                                        </h3>
                                        <p className="mt-2 text-sm text-white/70">
                                            {folderImportOverlay.detail}
                                        </p>
                                    </div>
                                    {folderImportOverlay.canCancel && (
                                        <button
                                            onClick={cancelActiveFolderImport}
                                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                            disabled={folderImportOverlay.isCancelling}
                                        >
                                            {folderImportOverlay.isCancelling ? 'Cancelando...' : 'Cancelar'}
                                        </button>
                                    )}
                                </div>

                                <div className="mt-5">
                                    <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
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
                                    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Detectados</p>
                                        <p className="mt-2 text-lg font-black text-white">{folderImportOverlay.total || folderImportOverlay.discovered || 0}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Importados</p>
                                        <p className="mt-2 text-lg font-black text-white">{folderImportOverlay.imported || 0}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Listos</p>
                                        <p className="mt-2 text-lg font-black text-white">{folderImportOverlay.metadataProcessed || 0}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Omitidos</p>
                                        <p className="mt-2 text-lg font-black text-white">{(folderImportOverlay.skippedDuplicates || 0) + (folderImportOverlay.failedCount || 0)}</p>
                                    </div>
                                </div>

                                {(folderImportOverlay.failedCount || 0) > 0 && (
                                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
                                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">Fallidos</p>
                                        <div className="mt-2 max-h-20 overflow-y-auto text-xs text-white/70">
                                            {(folderImportOverlay.failedFiles || []).slice(0, 6).map((item, index) => (
                                                <div key={`${item.name}-${index}`} className="truncate">{item.name} — {item.reason}</div>
                                            ))}
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                            <button onClick={retryFailedFolderImports} className="rounded-xl bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 hover:bg-amber-200">Reintentar fallidos</button>
                                            <button onClick={() => { setFolderImport(null); setFailedImportRetryQueue([]); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10">Cerrar</button>
                                        </div>
                                    </div>
                                )}

                                    </div>
                                </div>
                            </div>
                )}

                {view === 'library' && (
                    <div className="flex-shrink-0 flex items-center justify-between px-6 text-white shadow-lg z-20 h-16" style={{ backgroundColor: 'var(--topbar-bg)' }}>
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
                                <button onClick={() => goodreadsInputRef.current?.click()} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition font-semibold text-sm whitespace-nowrap" title="Importar CSV de Goodreads">
                                    <span className="text-sm leading-none">GR</span>
                                </button>
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
                <input type="file" accept=".csv" ref={goodreadsInputRef} className="hidden" onChange={importGoodreadsCSV} />
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
                {sidebarOpen && (
                    <div className="fixed inset-0 z-50 flex">
                        <div className="w-80 h-full shadow-2xl flex flex-col slide-in-left border-r" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
                            <div className="p-6 pb-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-color)' }}>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">🦈</span>
                                    <div className="flex flex-col leading-none">
                                        <span className="font-black text-lg tracking-tighter text-[var(--highlight)] uppercase">Shark</span>
                                        <span className="font-black text-lg tracking-tighter text-[var(--text-color)] uppercase -mt-1">Reader</span>
                                    </div>
                                </div>
                                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition"><Icons.Close /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto py-4 px-3">
                                <div className="px-3 mb-5 fade-in cursor-pointer" onClick={() => { setShowStreakModal(true); setSidebarOpen(false); }}>
                                    <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 hover:border-orange-500/60 transition p-4 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${stats.streak > 0 ? 'bg-orange-500 text-white shadow-lg streak-glow' : 'bg-gray-500/20 text-gray-500'}`}><Icons.Fire /></div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{t.streak}</p>
                                                <p className={`text-xl font-black ${stats.streak > 0 ? 'text-orange-500' : 'opacity-80'}`}>{stats.streak || 0} {t.streakDays}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {lastReadId && (
                                    <div className="px-3 mb-5 fade-in">
                                        <button onClick={() => { openBook(lastReadId); setSidebarOpen(false); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white shadow-md hover:shadow-lg transition" style={{ backgroundColor: 'var(--topbar-bg)' }}>
                                            <Icons.Play /> {t.continueReading}
                                        </button>
                                    </div>
                                )}
                                <div className="space-y-1">
                                    {[
                                        { filter: 'all', icon: <Icons.Library />, label: t.library, count: libraryDerived.counts.all },
                                        { filter: 'reading', icon: <span>📖</span>, label: 'Leyendo', count: libraryDerived.counts.reading },
                                        { filter: 'unstarted', icon: <span>📚</span>, label: 'Por leer', count: libraryDerived.counts.unstarted },
                                        { filter: 'finished', icon: <span>✅</span>, label: 'Terminados', count: libraryDerived.counts.finished },
                                        { filter: 'favorites', icon: <Icons.Heart className="text-red-500" />, label: t.favorites, count: libraryDerived.counts.favorites },
                                        { filter: 'recents', icon: <span>🕐</span>, label: 'Recientes', count: libraryDerived.counts.recents },
                                    ].map(item => (
                                        <button key={item.filter} onClick={() => { setCurrentFilter(item.filter); setView('library'); setSidebarOpen(false); }}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left font-semibold text-sm ${currentFilter === item.filter ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                            <span className="opacity-70 text-base">{item.icon}</span> {item.label}
                                            <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md">{item.count}</span>
                                        </button>
                                    ))}

                                    {/* Estanterías automáticas — solo se muestran si tienen libros */}
                                    {(libraryDerived.counts.shelfAbandoned > 0 || libraryDerived.counts.shelfAlmostDone > 0) && (
                                        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                            <p className="text-[9px] font-black uppercase tracking-widest opacity-30 px-1 mb-1">Estanterías</p>
                                            {[
                                                { filter: 'shelf:abandoned', icon: '⏸', label: 'Pausados +6 meses', count: libraryDerived.counts.shelfAbandoned },
                                                { filter: 'shelf:almostdone', icon: '🏁', label: 'Casi terminados', count: libraryDerived.counts.shelfAlmostDone },
                                            ].filter(s => s.count > 0).map(item => (
                                                <button key={item.filter} onClick={() => { setCurrentFilter(item.filter); setView('library'); setSidebarOpen(false); }}
                                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left font-semibold text-sm ${currentFilter === item.filter ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                                    <span className="opacity-70 text-base">{item.icon}</span> {item.label}
                                                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md">{item.count}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Por Autor */}
                                    {libraryDerived.authors.length > 0 && (() => {
                                        const authors = libraryDerived.authors;
                                        return (
                                            <div>
                                                <button onClick={() => setShowAuthorSection(p => !p)}
                                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left font-semibold text-sm hover:bg-black/5 dark:hover:bg-white/5">
                                                    <span className="opacity-70 text-base">👤</span> Por Autor
                                                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md">{authors.length}</span>
                                                    <span className="text-[10px] opacity-40">{showAuthorSection ? '▲' : '▼'}</span>
                                                </button>
                                                {showAuthorSection && (
                                                    <div className="ml-4 space-y-0.5 max-h-48 overflow-y-auto">
                                                        {authors.map(author => {
                                                            const active = filterAuthors.includes(author);
                                                            return (
                                                                <button key={author} onClick={() => { toggleFilterAuthor(author); setView('library'); }}
                                                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left text-sm ${active ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                                                    {active && <span className="text-sky-500 font-black text-xs">✓</span>}
                                                                    <span className="truncate flex-1 opacity-80">{author}</span>
                                                                    <span className="text-[10px] font-bold opacity-40 flex-shrink-0">{libraryDerived.authorCounts.get(author) || 0}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {libraryDerived.tags.length > 0 && (
                                        <div>
                                            <button onClick={() => setShowTagSection(prev => !prev)}
                                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left font-semibold text-sm hover:bg-black/5 dark:hover:bg-white/5">
                                                <span className="opacity-70 text-base">🏷️</span> Tags
                                                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md">{libraryDerived.tags.length}</span>
                                                <span className="text-[10px] opacity-40">{showTagSection ? '▲' : '▼'}</span>
                                            </button>
                                            {showTagSection && (
                                                <div className="ml-4 space-y-0.5 max-h-48 overflow-y-auto">
                                                    {libraryDerived.tags.map(([tag, count]) => {
                                                        const active = filterTags.includes(tag);
                                                        return (
                                                            <button key={tag} onClick={() => { toggleFilterTag(tag); setView('library'); }}
                                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left text-sm ${active ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                                                {active && <span className="text-purple-500 font-black text-xs">✓</span>}
                                                                <span className="truncate flex-1 opacity-80">{tag}</span>
                                                                <span className="text-[10px] font-bold opacity-40 flex-shrink-0">{count}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div>
                                        <button onClick={() => setShowRatingSection(prev => !prev)}
                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left font-semibold text-sm hover:bg-black/5 dark:hover:bg-white/5">
                                            <span className="opacity-70 text-base">⭐</span> Valoración
                                            <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md">
                                                {[1, 2, 3, 4, 5].filter(rating => (libraryDerived.ratingCounts.get(rating) || 0) > 0).length}
                                            </span>
                                            <span className="text-[10px] opacity-40">{showRatingSection ? '▲' : '▼'}</span>
                                        </button>
                                        {showRatingSection && (
                                            <div className="ml-4 space-y-0.5">
                                                {[5, 4, 3, 2, 1].map(rating => {
                                                    const count = libraryDerived.ratingCounts.get(rating) || 0;
                                                    if (!count) return null;
                                                    return (
                                                        <button key={rating} onClick={() => { setCurrentFilter(`rating:${rating}`); setView('library'); setSidebarOpen(false); }}
                                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left text-sm ${currentFilter === `rating:${rating}` ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                                            <span className="flex-1 opacity-80" style={{ color: '#f59e0b', letterSpacing: '-1px' }}>{'★'.repeat(rating)}</span>
                                                            <span className="text-[10px] font-bold opacity-40 flex-shrink-0">{count}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>


                                    {manualCollections.length > 0 && (
                                        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                            <div className="flex items-center justify-between px-4 mb-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest opacity-30">Colecciones</p>
                                                <button onClick={() => createManualCollection()} className="text-[10px] font-black opacity-50 hover:opacity-100 transition">+ Nueva</button>
                                            </div>
                                        </div>
                                    )}
                                    {manualCollections.map((collection, colIdx) => (
                                        <div key={collection.id} className={`flex items-center rounded-xl transition group ${currentFilter === `collection:${collection.id}` ? 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                            {renamingCollectionId === collection.id ? (
                                                <input
                                                    value={renamingCollectionValue}
                                                    onChange={e => setRenamingCollectionValue(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') renameManualCollection(collection.id, renamingCollectionValue);
                                                        if (e.key === 'Escape') { setRenamingCollectionId(null); setRenamingCollectionValue(''); }
                                                    }}
                                                    onBlur={() => renameManualCollection(collection.id, renamingCollectionValue || collection.name)}
                                                    className="flex-1 mx-3 my-1 text-sm font-bold rounded-lg px-2 py-1 outline-none border border-[var(--highlight)]"
                                                    style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}
                                                    autoFocus
                                                    onClick={e => e.stopPropagation()}
                                                />
                                            ) : (
                                                <button onClick={() => { setCurrentFilter(`collection:${collection.id}`); setView('library'); setSidebarOpen(false); }} className="flex-1 flex items-center gap-2 px-3 py-2 text-left text-sm font-semibold min-w-0">
                                                    <span className="text-base flex-shrink-0">{collection.emoji || '🗂️'}</span>
                                                    <span className="flex-1 truncate">{collection.name}</span>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md flex-shrink-0">{libraryDerived.collectionCounts.get(collection.id) || 0}</span>
                                                </button>
                                            )}
                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition flex-shrink-0 pr-1 gap-0.5">
                                                <button onClick={e => { e.stopPropagation(); moveManualCollection(collection.id, 'up'); }} disabled={colIdx === 0} className="p-1 text-xs disabled:opacity-20 hover:opacity-70 transition" title="Subir">↑</button>
                                                <button onClick={e => { e.stopPropagation(); moveManualCollection(collection.id, 'down'); }} disabled={colIdx === manualCollections.length - 1} className="p-1 text-xs disabled:opacity-20 hover:opacity-70 transition" title="Bajar">↓</button>
                                                <button onClick={e => { e.stopPropagation(); setRenamingCollectionId(collection.id); setRenamingCollectionValue(collection.name); }} className="p-1 text-xs hover:opacity-70 transition" title="Renombrar">✏️</button>
                                                <button onClick={(e) => { e.stopPropagation(); removeManualCollection(collection.id); }} className="p-1 text-red-500 hover:text-red-600 transition"><Icons.Trash className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {manualCollections.length === 0 && (
                                        <button onClick={() => createManualCollection()} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100 border border-dashed border-fuchsia-500/20 mt-1">
                                            <span className="opacity-70 text-base">🗂️</span> Crear Colección
                                        </button>
                                    )}

                                    {customCategories.length > 0 && (
                                        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                            <p className="text-[9px] font-black uppercase tracking-widest opacity-30 px-4 mb-1">Mis categorías</p>
                                        </div>
                                    )}
                                    {customCategories.map(cat => {
                                        const catColor = categoryColors[cat];
                                        return (
                                        <div key={cat} className={`flex items-center rounded-xl transition group ${currentFilter === cat ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                            <button onClick={() => { setCurrentFilter(cat); setView('library'); setSidebarOpen(false); }} className="flex-1 flex items-center gap-3 px-3 py-2 text-left text-sm font-semibold">
                                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/20" style={{ backgroundColor: catColor || 'var(--highlight)' }}></span>
                                                {cat}
                                                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md">{libraryDerived.categoryCounts.get(cat) || 0}</span>
                                            </button>
                                            <input type="color" value={catColor || '#6366f1'} title="Color de categoría"
                                                onChange={e => setCategoryColors(prev => ({ ...prev, [cat]: e.target.value }))}
                                                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 w-5 h-5 rounded cursor-pointer transition border-0 bg-transparent p-0 flex-shrink-0" />
                                            <button onClick={e => { e.stopPropagation(); removeCategory(cat); }} className="opacity-0 group-hover:opacity-100 p-3 text-red-500 hover:text-red-600 transition"><Icons.Trash className="w-4 h-4" /></button>
                                        </div>
                                        );
                                    })}
                                    <button onClick={addNewCategory} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100 border border-dashed border-gray-500/30 mt-1">
                                        <span className="opacity-70"><Icons.Plus /></span> Añadir Categoría
                                    </button>
                                </div>
                                <div className="my-5 border-t mx-3" style={{ borderColor: 'var(--border-color)' }}></div>

                                {/* Vocabulario */}
                                <div className="px-3 mb-4">
                                    <button onClick={() => setShowVocabPanel(p => !p)} className="w-full flex items-center justify-between px-1 py-2 opacity-70 hover:opacity-100 transition">
                                        <span className="font-black uppercase text-xs tracking-widest flex items-center gap-2">📖 Vocabulario</span>
                                        <span className="text-xs font-bold px-2 py-0.5 bg-black/5 dark:bg-white/10 rounded-lg">{vocabulary.length}</span>
                                    </button>
                                    {showVocabPanel && (
                                        <div className="mt-2">
                                            {vocabulary.length === 0 ? (
                                                <div className="text-center py-6 opacity-40">
                                                    <p className="text-2xl mb-1">📖</p>
                                                    <p className="text-xs font-medium">Selecciona palabras mientras lees para guardarlas aquí.</p>
                                                </div>
                                            ) : (
                                                <>
                                                    {vocabulary.length > 3 && (
                                                        <div className="flex items-center gap-1.5 mb-2 px-1">
                                                            <input
                                                                type="text"
                                                                value={vocabSearch}
                                                                onChange={e => setVocabSearch(e.target.value)}
                                                                placeholder="Buscar palabra..."
                                                                className="flex-1 bg-black/5 dark:bg-white/5 rounded-xl px-3 py-1.5 text-xs font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                                                style={{ color: 'var(--text-color)' }}
                                                            />
                                                            {vocabSearch && (
                                                                <button onClick={() => setVocabSearch('')} className="opacity-40 hover:opacity-100 transition text-base leading-none flex-shrink-0">×</button>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                                                        {vocabulary.slice().reverse()
                                                            .filter(v => !vocabSearch || v.word.toLowerCase().includes(vocabSearch.toLowerCase()) || v.definition.toLowerCase().includes(vocabSearch.toLowerCase()))
                                                            .map(v => (
                                                                <div key={v.id} className="group bg-black/5 dark:bg-white/5 rounded-xl p-3 hover:bg-black/8 dark:hover:bg-white/8 transition">
                                                                    <div className="flex justify-between items-start">
                                                                        <span className="font-black text-sm" style={{ color: 'var(--highlight)' }}>{v.word}</span>
                                                                        <button onClick={() => setVocabulary(prev => prev.filter(w => w.id !== v.id))} className="opacity-0 group-hover:opacity-40 hover:!opacity-100 text-red-500 transition ml-2 flex-shrink-0"><Icons.Trash className="w-3 h-3" /></button>
                                                                    </div>
                                                                    <p className="text-[11px] opacity-70 mt-1 leading-relaxed">{v.definition}</p>
                                                                    <p className="text-[9px] opacity-40 mt-1">{v.bookName} · {v.date}</p>
                                                                </div>
                                                            ))
                                                        }
                                                        {vocabulary.length > 0 && vocabulary.slice().reverse().filter(v => !vocabSearch || v.word.toLowerCase().includes(vocabSearch.toLowerCase()) || v.definition.toLowerCase().includes(vocabSearch.toLowerCase())).length === 0 && (
                                                            <p className="text-xs opacity-40 text-center py-4">Sin resultados para "{vocabSearch}"</p>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1.5 mt-2">
                                                        <button onClick={() => {
                                                            let md = '# 📖 Mi Vocabulario — Shark Reader\n\n';
                                                            vocabulary.forEach(v => { md += `## ${v.word}\n${v.definition}\n\n*${v.bookName} · ${v.date}*\n\n---\n\n`; });
                                                            const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
                                                            const a = document.createElement('a'); a.href = url; a.download = 'Mi_Vocabulario.md'; a.click(); URL.revokeObjectURL(url);
                                                        }} className="flex-1 text-xs font-bold py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:opacity-80 transition">.MD</button>
                                                        <button onClick={() => {
                                                            const rows = [['Palabra', 'Definición', 'Libro', 'Fecha'], ...vocabulary.map(v => [v.word, v.definition, v.bookName, v.date])];
                                                            const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                                                            const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
                                                            const a = document.createElement('a'); a.href = url; a.download = 'Mi_Vocabulario.csv'; a.click(); URL.revokeObjectURL(url);
                                                        }} className="flex-1 text-xs font-bold py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:opacity-80 transition">.CSV</button>
                                                        <button onClick={() => {
                                                            const url = URL.createObjectURL(new Blob([JSON.stringify(vocabulary, null, 2)], { type: 'application/json' }));
                                                            const a = document.createElement('a'); a.href = url; a.download = 'Mi_Vocabulario.json'; a.click(); URL.revokeObjectURL(url);
                                                        }} className="flex-1 text-xs font-bold py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:opacity-80 transition">.JSON</button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="px-3">
                                    <div className="flex items-center justify-between mb-3 pl-1">
                                        <span className="font-black uppercase text-xs tracking-widest flex items-center gap-2 opacity-50">
                                            <Icons.Bookmark /> Anotaciones
                                        </span>
                                        <div className="flex gap-1">
                                            <button onClick={() => exportAnnotations('txt', annotationBookFilter === 'all' ? {} : { bookId: annotationBookFilter })} className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">.TXT</button>
                                            <button onClick={() => exportAnnotations('md', annotationBookFilter === 'all' ? {} : { bookId: annotationBookFilter })} className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">.MD</button>
                                            <button onClick={() => exportAnnotations('html', annotationBookFilter === 'all' ? {} : { bookId: annotationBookFilter })} className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">.HTML</button>
                                            <button onClick={() => exportAnnotations('json', annotationBookFilter === 'all' ? {} : { bookId: annotationBookFilter })} className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">.JSON</button>
                                            {addons.quotePosters && <button onClick={exportQuotesAsImage} title="Exportar subrayados como imagen" className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">🖼️</button>}
                                        </div>
                                    </div>

                                    <div className="mb-3 space-y-2">
                                        <input
                                            type="text"
                                            value={annotationSearch}
                                            onChange={e => setAnnotationSearch(e.target.value)}
                                            placeholder="Buscar en notas y subrayados..."
                                            className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-3 py-2 text-xs font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                            style={{ color: 'var(--text-color)' }}
                                        />
                                        <select
                                            value={annotationBookFilter}
                                            onChange={e => setAnnotationBookFilter(e.target.value)}
                                            className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-3 py-2 text-xs font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                            style={{ color: 'var(--text-color)' }}
                                        >
                                            <option value="all">Toda la biblioteca</option>
                                            {annotationBookOptions.map(option => (
                                                <option key={option.bookId} value={option.bookId}>
                                                    {option.bookName} ({option.total})
                                                </option>
                                            ))}
                                        </select>
                                        <div className="grid grid-cols-4 gap-2 text-center">
                                            <div className="rounded-xl bg-black/5 dark:bg-white/5 px-2 py-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest opacity-35">Total</p>
                                                <p className="mt-1 text-sm font-black">{annotationSummary.total}</p>
                                            </div>
                                            <div className="rounded-xl bg-black/5 dark:bg-white/5 px-2 py-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest opacity-35">Subr.</p>
                                                <p className="mt-1 text-sm font-black">{annotationSummary.highlights}</p>
                                            </div>
                                            <div className="rounded-xl bg-black/5 dark:bg-white/5 px-2 py-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest opacity-35">Notas</p>
                                                <p className="mt-1 text-sm font-black">{annotationSummary.notes}</p>
                                            </div>
                                            <div className="rounded-xl bg-black/5 dark:bg-white/5 px-2 py-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest opacity-35">Marc.</p>
                                                <p className="mt-1 text-sm font-black">{annotationSummary.bookmarks}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {annotationGroups.length === 0 ? (
                                        <div className="text-center py-8 opacity-40">
                                            <p className="text-2xl mb-2">🔖</p>
                                            <p className="text-xs font-medium">{annotationSearch || annotationBookFilter !== 'all' ? 'No hay resultados para ese filtro.' : t.noBookmarks}</p>
                                        </div>
                                    ) : annotationGroups.map(group => (
                                        <div key={`annotation-${group.bookId}`} className="mb-4 fade-in">
                                            <div className="flex items-center gap-2 mb-2 px-1">
                                                <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--highlight)' }}></div>
                                                <button
                                                    onClick={() => setAnnotationBookFilter(prev => prev === group.bookId ? 'all' : group.bookId)}
                                                    className="text-[11px] font-black truncate flex-1 opacity-70 text-left hover:opacity-100 transition"
                                                >
                                                    {group.bookName}
                                                </button>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] font-bold opacity-30">{group.total}</span>
                                                    <button
                                                        onClick={() => exportAnnotations('md', { bookId: group.bookId })}
                                                        className="text-[9px] font-black px-1.5 py-0.5 rounded-lg opacity-30 hover:opacity-100 hover:text-[var(--highlight)] transition"
                                                        title="Exportar este libro"
                                                    >
                                                        .MD
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-1.5 px-1 mb-2">
                                                {group.highlights > 0 && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-black/5 dark:bg-white/5">Subrayados {group.highlights}</span>}
                                                {group.notes > 0 && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-black/5 dark:bg-white/5">Notas {group.notes}</span>}
                                                {group.bookmarks > 0 && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-black/5 dark:bg-white/5">Marcadores {group.bookmarks}</span>}
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                {group.entries.map(entry => {
                                                    const colorMeta = ANNOTATION_COLOR_META[entry.color] || ANNOTATION_COLOR_META.yellow;
                                                    const deleteNote = entry.kind === 'highlight'
                                                        ? `[Subrayado] "${entry.text}${entry.rawNote.endsWith('...') ? '...' : ''}"`
                                                        : entry.rawNote || entry.text;
                                                    return (
                                                        <div key={entry.id} className="group flex items-start gap-2 px-2 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition">
                                                            <div
                                                                className="w-0.5 rounded-full flex-shrink-0 mt-1 self-stretch"
                                                                style={{ backgroundColor: entry.kind === 'highlight' ? colorMeta.swatch : 'var(--highlight)', minHeight: 14 }}
                                                            />
                                                            <button
                                                                onClick={() => { openBook(group.bookId, entry.cfi); setSidebarOpen(false); }}
                                                                className="flex-1 text-left min-w-0"
                                                            >
                                                                <div className="flex items-center gap-1.5 mb-1">
                                                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-35">
                                                                        {entry.kind === 'highlight' ? 'Subrayado' : entry.kind === 'note' ? 'Nota' : 'Marcador'}
                                                                    </span>
                                                                    {entry.kind === 'highlight' && (
                                                                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${colorMeta.swatch}22`, color: colorMeta.swatch }}>
                                                                            {colorMeta.label}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className={`block leading-snug ${entry.kind === 'highlight' ? 'text-[11px] font-medium line-clamp-3 italic opacity-80' : 'text-[12px] font-semibold'} break-words`} style={{ color: 'var(--text-color)' }}>
                                                                    {entry.text || 'Sin texto'}
                                                                </span>
                                                                <span className="text-[9px] opacity-40 font-bold">{entry.date}</span>
                                                            </button>
                                                            {addons.quotePosters && entry.kind === 'highlight' && (
                                                                <button
                                                                    onClick={() => exportSingleQuote(entry.text, group.bookName, group.bookAuthor, appliedTheme)}
                                                                    title="Exportar como imagen"
                                                                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition text-[11px] flex-shrink-0 mt-0.5"
                                                                >
                                                                    🖼️
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => toggleBookmarkInApp(group.bookId, entry.cfi, deleteNote, true)}
                                                                className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition text-red-400 text-base leading-none flex-shrink-0 mt-0.5"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-4 border-t space-y-1.5" style={{ borderColor: 'var(--border-color)' }}>
                                <button onClick={() => { setView('analytics'); setSidebarOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition font-bold opacity-70 hover:opacity-100 text-sm">
                                    <span className="text-base">📊</span> Analíticas
                                </button>
                                {userProfile && (
                                <button onClick={() => { setView('achievements'); setSidebarOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition font-bold opacity-70 hover:opacity-100 text-sm">
                                    <span className="text-base">🏆</span> Logros
                                </button>
                                )}
                                <button onClick={() => { setShowWorkshop(true); setSidebarOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition font-bold opacity-70 hover:opacity-100 text-sm">
                                    <span className="text-base">🔧</span> Workshop
                                    {Object.values(addons).filter(Boolean).length > 0 && (
                                        <span className="ml-auto text-xs font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: '#22c55e' }}>
                                            {Object.values(addons).filter(Boolean).length} activos
                                        </span>
                                    )}
                                </button>
                                {addons.readingJournal && journalEntries.length > 0 && (
                                    <button onClick={() => { setShowJournalModal(true); setSidebarOpen(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition font-bold opacity-70 hover:opacity-100 text-sm">
                                        <span className="text-base">📓</span> Reading Journal
                                        <span className="ml-auto text-xs font-black px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10">{journalEntries.length}</span>
                                    </button>
                                )}
                                <button onClick={() => { setSettingsOpen(true); setSidebarOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition font-bold opacity-70 hover:opacity-100 text-sm">
                                    <Icons.Settings /> {t.settings}
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>
                    </div>
                )}

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
                    <div ref={libraryScrollRef} className="flex-1 library-container w-full relative overflow-y-auto">

                        {/* Vista de resultados de búsqueda */}
                        {searchTerm && searchResultsWithMatches && (
                            <div className="p-5 max-w-3xl mx-auto fade-in">
                                <p className="text-xs font-black uppercase tracking-widest opacity-40 mb-4">
                                    {searchResultsWithMatches.length} {searchResultsWithMatches.length === 1 ? 'resultado' : 'resultados'} para "{searchTerm}"
                                </p>
                                {searchResultsWithMatches.length === 0 ? (
                                    <div className="text-center py-16 opacity-40">
                                        <p className="text-5xl mb-4">🔍</p>
                                        <p className="font-black text-lg">Sin resultados</p>
                                        <p className="text-sm mt-2">Prueba con otro título, autor o etiqueta</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {searchResultsWithMatches.map(book => (
                                            <div key={book.id}
                                                className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition group border border-transparent hover:border-[var(--border-color)]"
                                                style={{ backgroundColor: 'var(--surface-bg)' }}
                                                onClick={() => openBook(book.id)}
                                                onContextMenu={(e) => handleContextMenu(e, book)}>
                                                <div className="w-12 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-lg flex items-center justify-center text-white text-xs font-bold text-center bg-cover bg-center"
                                                    style={{ backgroundImage: book.coverUrl ? `url(${book.coverUrl})` : 'none', backgroundColor: book.color }}>
                                                    {!book.coverUrl && book.name.charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-base leading-tight truncate">{book.name}</p>
                                                    <p className="text-sm opacity-60 truncate mt-0.5">{book.author}</p>
                                                    {book.series && <p className="text-xs opacity-40 italic mt-0.5 truncate">{book.series}{book.seriesIndex ? ` #${book.seriesIndex}` : ''}</p>}
                                                    <div className="flex gap-1 mt-2 flex-wrap">
                                                        {book.matchedFields.map(f => (
                                                            <span key={f} className="text-[10px] font-black px-2 py-0.5 rounded-full text-white opacity-90" style={{ backgroundColor: 'var(--highlight)' }}>{f}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pr-1">
                                                    <div className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ color: 'var(--highlight)', backgroundColor: 'color-mix(in srgb, var(--highlight) 15%, transparent)' }}>
                                                        {book.progress || 0}%
                                                    </div>
                                                    {book.rating > 0 && <span className="text-xs" style={{ color: '#f59e0b', letterSpacing: '-1px' }}>{'★'.repeat(book.rating)}</span>}
                                                    {openBookIds.has(book.id) && <span className="text-[10px] font-black text-green-400">● Abierto</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Vista de cuadrícula normal */}
                        {!searchTerm && (
                            <>
                                {displayedBooks.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center p-6 fade-in">
                                        <div className="empty-state-container max-w-2xl w-full p-12 rounded-[2rem] flex flex-col items-center text-center shadow-sm border-2 border-dashed" style={{ borderColor: 'var(--border-color)' }}>
                                            <div className="w-24 h-24 mb-6 rounded-full flex items-center justify-center shadow-inner" style={{ backgroundColor: 'var(--topbar-bg)', color: 'white' }}>
                                                {currentFilter === 'favorites' ? <Icons.Heart className="w-12 h-12" /> : <Icons.BookOpen />}
                                            </div>
                                            <h2 className="text-3xl font-black mb-3">{currentFilter === 'favorites' ? 'Sin Favoritos' : t.emptyTitle}</h2>
                                            <p className="text-lg opacity-70 mb-10 max-w-lg">{t.emptyDesc}</p>
                                            {currentFilter === 'all' && (
                                                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                                                    <button onClick={openFilePicker} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"><Icons.Plus /> {t.addBook}</button>
                                                    <button onClick={openFolderPicker} className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"><Icons.FolderPlus /> {t.addFolder}</button>
                                                </div>
                                            )}
                                            <div className="mt-6 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 text-left max-w-md">
                                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">💡 Nota:</p>
                                                <p className="text-[10px] opacity-70">{t.fileNote}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {displayedBooks.length > 0 && libraryView === 'grid' && (
                                    virtualLibrary.enabled ? (
                                        <div className="virtual-library-spacer" style={{ height: virtualLibrary.totalHeight }}>
                                            <div
                                                className={`books-grid virtual-books-grid ${addons.netflixView ? 'netflix-grid' : ''}`}
                                                style={{
                                                    transform: `translateY(${virtualLibrary.top}px)`,
                                                    gridTemplateColumns: `repeat(${virtualLibrary.columns}, minmax(0, 1fr))`,
                                                }}>
                                                {virtualLibrary.items.map(book => (
                                                    <div key={book.id} draggable={!isSelecting && quickEditBookId !== book.id}
                                                        onDragStart={e => { e.dataTransfer.setData('bookId', book.id); setDraggedBookId(book.id); }}
                                                        onDragEnd={() => { setDraggedBookId(null); setDropTargetCat(null); }}>
                                                        {quickEditBookId === book.id ? (
                                                            <QuickEditCard book={book} onSave={saveQuickEdit} onCancel={() => setQuickEditBookId(null)} />
                                                        ) : (
                                                            <BookCard book={book} isOpen={openBookIds.has(book.id)} onOpen={isSelecting ? toggleSelectBook : openBook} onContextMenu={handleContextMenu}
                                                                isSelecting={isSelecting} isSelected={selectedBookIds.has(book.id)} onSelect={toggleSelectBook}
                                                                onQuickEdit={setQuickEditBookId} isDynamic={!!addons.dynamicCovers} />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`books-grid fade-in ${addons.netflixView ? 'netflix-grid' : ''}`}>
                                            {displayedBooks.map(book => (
                                                <div key={book.id} draggable={!isSelecting && quickEditBookId !== book.id}
                                                    onDragStart={e => { e.dataTransfer.setData('bookId', book.id); setDraggedBookId(book.id); }}
                                                    onDragEnd={() => { setDraggedBookId(null); setDropTargetCat(null); }}>
                                                    {quickEditBookId === book.id ? (
                                                        <QuickEditCard book={book} onSave={saveQuickEdit} onCancel={() => setQuickEditBookId(null)} />
                                                    ) : (
                                                        <BookCard book={book} isOpen={openBookIds.has(book.id)} onOpen={isSelecting ? toggleSelectBook : openBook} onContextMenu={handleContextMenu}
                                                            isSelecting={isSelecting} isSelected={selectedBookIds.has(book.id)} onSelect={toggleSelectBook}
                                                            onQuickEdit={setQuickEditBookId} isDynamic={!!addons.dynamicCovers} />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}
                                {displayedBooks.length > 0 && libraryView === 'series' && (() => {
                                    const grouped = new Map();
                                    displayedBooks.forEach(book => {
                                        const key = book.series || '';
                                        if (!grouped.has(key)) grouped.set(key, []);
                                        grouped.get(key).push(book);
                                    });
                                    const seriesGroups = [...grouped.entries()]
                                        .map(([name, bks]) => ({ name, books: bks.sort((a, b) => (a.seriesIndex || 0) - (b.seriesIndex || 0)) }))
                                        .sort((a, b) => a.name ? (b.name ? a.name.localeCompare(b.name) : -1) : 1);
                                    return (
                                        <div className="p-4 md:p-6 space-y-8 fade-in max-w-5xl mx-auto w-full">
                                            {seriesGroups.map(({ name, books: grpBooks }) => {
                                                const finished = grpBooks.filter(b => b.isFinished).length;
                                                const pct = grpBooks.length > 0 ? Math.round((finished / grpBooks.length) * 100) : 0;
                                                const nextToRead = name ? grpBooks.filter(b => !b.isFinished && b.seriesIndex > 0).sort((a, b) => a.seriesIndex - b.seriesIndex)[0] : null;
                                                const seriesIdxSet = new Set(grpBooks.map(b => b.seriesIndex).filter(Boolean));
                                                const maxIdx = seriesIdxSet.size > 0 ? Math.max(...seriesIdxSet) : 0;
                                                const gaps = name && maxIdx > 1 ? Array.from({ length: maxIdx - 1 }, (_, i) => i + 1).filter(n => !seriesIdxSet.has(n)) : [];
                                                return (
                                                    <div key={name || '__noseries__'}>
                                                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                                                            {name ? (
                                                                <>
                                                                    <h3 className="font-black text-base" style={{ color: 'var(--text-color)' }}>{name}</h3>
                                                                    <span className="text-xs font-bold opacity-40">{finished}/{grpBooks.length} leídos</span>
                                                                    <div className="flex-1 h-1.5 rounded-full max-w-32" style={{ backgroundColor: 'var(--border-color)' }}>
                                                                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#22c55e' : 'var(--highlight)' }} />
                                                                    </div>
                                                                    {pct === 100 && <span className="text-xs font-black text-green-500">✓ Completa</span>}
                                                                    {nextToRead && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--highlight)' }}>📖 Siguiente: #{nextToRead.seriesIndex}</span>}
                                                                    {gaps.length > 0 && <span className="text-[10px] font-bold text-amber-500 opacity-80">⚠ Sin #{gaps.join(', #')}</span>}
                                                                </>
                                                            ) : (
                                                                <h3 className="font-black text-xs uppercase tracking-widest opacity-30">Sin serie</h3>
                                                            )}
                                                        </div>
                                                        <div className="books-grid">
                                                            {grpBooks.map(book => {
                                                                const isNext = nextToRead?.id === book.id;
                                                                return (
                                                                    <div key={book.id} draggable={!isSelecting}
                                                                        onDragStart={e => { e.dataTransfer.setData('bookId', book.id); setDraggedBookId(book.id); }}
                                                                        onDragEnd={() => { setDraggedBookId(null); setDropTargetCat(null); }}
                                                                        style={isNext ? { filter: 'drop-shadow(0 0 6px var(--highlight))' } : undefined}>
                                                                        {quickEditBookId === book.id ? (
                                                                            <QuickEditCard book={book} onSave={saveQuickEdit} onCancel={() => setQuickEditBookId(null)} />
                                                                        ) : (
                                                                            <BookCard book={book} isOpen={openBookIds.has(book.id)} onOpen={isSelecting ? toggleSelectBook : openBook} onContextMenu={handleContextMenu}
                                                                                isSelecting={isSelecting} isSelected={selectedBookIds.has(book.id)} onSelect={toggleSelectBook}
                                                                                onQuickEdit={setQuickEditBookId} isDynamic={!!addons.dynamicCovers} />
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                            {gaps.length > 0 && gaps.map(gapNum => (
                                                                <div key={`gap-${gapNum}`} className="book-container opacity-30 pointer-events-none" style={{ border: '2px dashed var(--border-color)', borderRadius: '8px' }}>
                                                                    <div className="book-cover flex items-center justify-center" style={{ backgroundColor: 'var(--surface-bg)' }}>
                                                                        <div className="text-center p-2">
                                                                            <div className="text-2xl mb-1">?</div>
                                                                            <div className="text-xs font-black opacity-60">#{gapNum}</div>
                                                                            <div className="text-[9px] opacity-40 mt-0.5">No importado</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="book-info-under"><div className="title opacity-40">Tomo #{gapNum}</div></div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                                {displayedBooks.length > 0 && libraryView === 'list' && (
                                    <div
                                        className={`p-4 flex flex-col gap-2 fade-in max-w-4xl mx-auto w-full ${virtualLibrary.enabled ? 'virtual-list-spacer' : ''}`}
                                        style={virtualLibrary.enabled ? { height: virtualLibrary.totalHeight } : undefined}>
                                        <div
                                            className="flex flex-col gap-2 w-full"
                                            style={virtualLibrary.enabled ? { transform: `translateY(${virtualLibrary.top}px)` } : undefined}>
                                        {(virtualLibrary.enabled ? virtualLibrary.items : displayedBooks).map(book => {
                                            const statusIcon = book.isFinished ? '✅' : book.lastReadDate > 0 ? '📖' : '📚';
                                            const listSelected = isSelecting && selectedBookIds.has(book.id);
                                            return (
                                                <div key={book.id}
                                                    className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer border transition group"
                                                    style={{ backgroundColor: listSelected ? 'color-mix(in srgb, var(--highlight) 12%, var(--surface-bg))' : 'var(--surface-bg)', borderColor: listSelected ? 'var(--highlight)' : 'transparent' }}
                                                    onClick={() => isSelecting ? toggleSelectBook(book.id) : openBook(book.id)}
                                                    onContextMenu={e => !isSelecting && handleContextMenu(e, book)}>
                                                    <div className="w-10 h-14 rounded-lg flex-shrink-0 bg-cover bg-center shadow-md flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                                                        style={{ backgroundImage: book.coverUrl ? `url(${book.coverUrl})` : 'none', backgroundColor: book.color }}>
                                                        {!book.coverUrl && book.name.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-sm truncate">{book.name}</span>
                                                            {openBookIds.has(book.id) && <span className="text-[10px] font-black text-green-400 flex-shrink-0">● Abierto</span>}
                                                        </div>
                                                        <div className="text-xs opacity-50 truncate">{book.author}{book.series ? ` · ${book.series}${book.seriesIndex ? ` #${book.seriesIndex}` : ''}` : ''}</div>
                                                        {book.tags && <div className="text-[10px] opacity-40 truncate mt-0.5">{book.tags}</div>}
                                                    </div>
                                                    <div className="flex items-center gap-3 flex-shrink-0">
                                                        {book.rating > 0 && <span className="text-xs" style={{ color: '#f59e0b', letterSpacing: '-1px' }}>{'★'.repeat(book.rating)}</span>}
                                                        <span className="text-[10px]">{statusIcon}</span>
                                                        <div className="text-right">
                                                            <div className="text-xs font-black" style={{ color: 'var(--highlight)' }}>{book.progress || 0}%</div>
                                                            <div className="w-16 h-1 rounded-full bg-black/10 dark:bg-white/10 mt-1">
                                                                <div className="h-full rounded-full" style={{ width: `${book.progress || 0}%`, backgroundColor: 'var(--highlight)' }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── BULK ACTION BAR ── */}
                        {isSelecting && (
                            <div className="fixed bottom-0 left-0 right-0 z-[200] shadow-2xl border-t" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
                                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2 flex-wrap">
                                    <span className="font-black text-sm flex-shrink-0" style={{ color: 'var(--text-color)' }}>
                                        {selectedBookIds.size} seleccionado{selectedBookIds.size !== 1 ? 's' : ''}
                                    </span>
                                    <button onClick={selectAll} className="text-xs font-bold px-3 py-1.5 rounded-lg transition hover:opacity-80" style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}>
                                        Todos ({displayedBooks.length})
                                    </button>
                                    <div className="flex-1 hidden sm:block" />
                                    <button onClick={bulkToggleFav} disabled={!selectedBookIds.size}
                                        className="text-xs font-bold px-3 py-1.5 rounded-xl bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/25 transition disabled:opacity-40">
                                        ❤️ Favorito
                                    </button>
                                    <button onClick={() => bulkMarkFinished(true)} disabled={!selectedBookIds.size}
                                        className="text-xs font-bold px-3 py-1.5 rounded-xl bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/25 transition disabled:opacity-40">
                                        ✅ Terminado
                                    </button>
                                    {customCategories.length > 0 && (
                                        <select onChange={e => { if (e.target.value) { bulkAssignCategory(e.target.value); e.target.value = ''; } }}
                                            disabled={!selectedBookIds.size}
                                            className="text-xs font-bold px-3 py-1.5 rounded-xl outline-none cursor-pointer disabled:opacity-40"
                                            style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}>
                                            <option value="">📁 Categoría…</option>
                                            {customCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    )}
                                    {manualCollections.length > 0 && (
                                        <select onChange={e => { if (e.target.value) { bulkAddToCollection(e.target.value); e.target.value = ''; } }}
                                            disabled={!selectedBookIds.size}
                                            className="text-xs font-bold px-3 py-1.5 rounded-xl outline-none cursor-pointer disabled:opacity-40"
                                            style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}>
                                            <option value="">🗂️ Colección…</option>
                                            {manualCollections.map(col => <option key={col.id} value={col.id}>{col.emoji || '🗂️'} {col.name}</option>)}
                                        </select>
                                    )}
                                    <button onClick={bulkDeleteBooks} disabled={!selectedBookIds.size}
                                        className="text-xs font-bold px-3 py-1.5 rounded-xl bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-500/25 transition disabled:opacity-40">
                                        🗑️ Eliminar
                                    </button>
                                    <button onClick={clearSelection} className="p-1.5 rounded-xl opacity-50 hover:opacity-100 transition" style={{ color: 'var(--text-color)' }}>
                                        <Icons.Close />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="md:hidden fixed bottom-6 right-6 flex flex-col gap-4 z-30">
                            <button onClick={openFolderPicker} className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl bg-slate-700 hover:scale-110 transition-transform"><Icons.FolderPlus /></button>
                            <button onClick={openFilePicker} className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 transition-transform" style={{ backgroundColor: 'var(--highlight)' }}><Icons.Plus /></button>
                        </div>
                    </div>
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
                            />
                        </Suspense>
                    </div>
                )}

                {/* ── READER ── */}
                {view === 'reader' && currentBookData && (
                    <div className="flex-1 flex overflow-hidden relative w-full" style={{ backgroundColor: 'var(--bg-color)' }}>
                        {/* Panel izquierdo / principal */}
                        <div className={`flex flex-col ${panelMode && rightBookData ? 'w-1/2 border-r border-white/10' : 'w-full'} overflow-hidden`}>
                            {currentBookData.type === 'epub' ? (
                                <EpubReaderBoundary onClose={closeBook}>
                                    <Suspense fallback={readerLoader(`Abriendo ${currentBookData.name || 'libro'}...`)}>
                                        <EpubReader
                                            bookData={currentBookData}
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
                                            onStatsUpdate={pages => setStats(prev => ({ ...prev, pagesTurned: prev.pagesTurned + pages }))}
                                            onOpenBookInfo={() => setActiveBookModal(currentBookData)}
                                            onSaveWord={saveWordToVocab}
                                            aiProvider={aiProvider}
                                            aiApiKey={aiApiKey}
                                            tabs={tabs}
                                            activeTabId={activeTabId}
                                            allBooks={books}
                                            onSwitchTab={(id) => setActiveTabId(id)}
                                            onCloseTab={closeTab}
                                            onGoToLibrary={() => setView('library')}
                                            onToggleSpread={toggleSpreadLayout}
                                        />
                                    </Suspense>
                                </EpubReaderBoundary>
                            ) : (
                                <Suspense fallback={readerLoader(`Abriendo ${currentBookData.name || 'documento'}...`)}>
                                    <PdfReader
                                        bookData={currentBookData}
                                        theme={appliedTheme} t={t} lang={lang}
                                        isFullscreen={isFullscreen}
                                        focusMode={addons.focusMode}
                                        onClose={closeBook}
                                        onOpenSettings={() => setSettingsOpen(true)}
                                        onOpenBookInfo={() => setActiveBookModal(currentBookData)}
                                        onPersistPdfZoom={persistPdfZoom}
                                        updateLocationAndProgress={updateBookLocation}
                                        toggleBookmark={toggleBookmarkInApp}
                                        onStatsUpdate={pages => setStats(prev => ({ ...prev, pagesTurned: prev.pagesTurned + pages }))}
                                        tabs={tabs} activeTabId={activeTabId} allBooks={books}
                                        onSwitchTab={id => setActiveTabId(id)}
                                        onCloseTab={closeTab}
                                        onGoToLibrary={() => setView('library')}
                                    />
                                </Suspense>
                            )}
                        </div>

                        {/* Panel derecho (multi-panel) */}
                        {panelMode && rightBookData && (
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
                                    <Suspense fallback={readerLoader(`Abriendo ${rightBookData.name || 'libro'}...`)}>
                                        <EpubReader
                                            bookData={rightBookData}
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
                                            onStatsUpdate={pages => setStats(prev => ({ ...prev, pagesTurned: prev.pagesTurned + pages }))}
                                            onOpenBookInfo={() => setActiveBookModal(rightBookData)}
                                            onSaveWord={saveWordToVocab}
                                            aiProvider={aiProvider}
                                            aiApiKey={aiApiKey}
                                            onToggleSpread={toggleSpreadLayout}
                                        />
                                    </Suspense>
                                ) : (
                                    <Suspense fallback={readerLoader(`Abriendo ${rightBookData.name || 'documento'}...`)}>
                                        <PdfReader
                                            bookData={rightBookData}
                                            theme={appliedTheme} t={t} lang={lang}
                                            isFullscreen={false}
                                            onClose={() => { setPanelMode(false); setRightTabId(null); }}
                                            onOpenSettings={() => setSettingsOpen(true)}
                                            onOpenBookInfo={() => setActiveBookModal(rightBookData)}
                                            onPersistPdfZoom={persistPdfZoom}
                                            updateLocationAndProgress={updateBookLocation}
                                            toggleBookmark={toggleBookmarkInApp}
                                            onStatsUpdate={pages => setStats(prev => ({ ...prev, pagesTurned: prev.pagesTurned + pages }))}
                                        />
                                    </Suspense>
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
                        <div className="fixed top-6 right-6 z-[9999] fade-in" style={{ animation: 'fadeInUp 0.4s ease' }}>
                            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border"
                                style={{ backgroundColor: 'var(--surface-bg)', borderColor: r.border, minWidth: 260, maxWidth: 320 }}>
                                <div className="text-3xl flex-shrink-0">{achievementToast.emoji}</div>
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
                    <div className="fixed bottom-6 left-6 z-[9998] fade-in" style={{ animation: 'fadeInUp 0.35s ease' }}>
                        <div
                            className="flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl border max-w-sm"
                            style={{
                                backgroundColor: 'var(--surface-bg)',
                                borderColor: noticeToast.tone === 'warning' ? 'rgba(251,191,36,0.45)' : 'rgba(59,130,246,0.35)'
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
