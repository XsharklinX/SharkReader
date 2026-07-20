// SharkReader - App Component (v2 — Tabs + Optimizations + Series + Vocab + AI)
import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense, useDeferredValue } from 'react';
import JSZip from 'jszip';
import { Icons, renderAvatar } from './icons';
import { translations, languageNames, RANDOM_EMOJIS } from './translations';
import { safeParse, saveBookToDB, saveBooksToDB, saveAppData, saveSetting, loadFilesFromDB, deleteBookFromDB } from './db';
import { RARITY } from './achievements';
import { DEFAULT_EXTERNAL_SOURCES, migrateWorkshopData, normalizeAddonConfig, normalizeAddonState, validateAddonToggle } from './workshopModules';
import {
    applyImportedBookData,
    getBookDedupKey,
    getBookTitleDedupKey,
    stripBookFilesForExport,
    toStoredBookRecord,
    updateBookInList,
} from './bookModel';
import { buildPortableBackup, isBookDeletedByTombstone, mergeAchievements } from './backupMerge';
import { validateBackupData } from './backupValidation';
import { sha256Hex } from './checksum';
import { computeBackupDiff } from './backupDiff';
import BackupPreviewModal from './BackupPreviewModal';
import { scanLibraryIssues } from './libraryRepair';
import LibraryRepairModal from './LibraryRepairModal';
import { clearDiagnosticEntries, getDiagnosticEntries, installDiagnostics } from './diagnostics';
import { createWorkshopApi } from './workshopApi';
import Tooltip from './Tooltip';
import { useBookRouletteAddon } from './addons/useBookRouletteAddon';
import { useWatchedFolderAddon } from './addons/useWatchedFolderAddon';
import { useAutoBackupAddon } from './addons/useAutoBackupAddon';
import { readerXp, readerLevelFromXp } from './readingProgress';
import { settleChallenges, lastWeekSummary, isoWeekKey, createChallenge } from './challenges';
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
import { useReaderPerformance } from './hooks/useReaderPerformance';
import { useReaderOrchestration } from './hooks/useReaderOrchestration';
import { useAppHydration } from './hooks/useAppHydration';
import { useAppPersistence } from './hooks/useAppPersistence';
import { useAccountReset } from './hooks/useAccountReset';
import { useContentIndexing } from './hooks/useContentIndexing';
import { useMetadataRepair } from './hooks/useMetadataRepair';
import { useAIConfig } from './hooks/useAIConfig';
import Sidebar from './Sidebar';
import LibraryView from './LibraryView';
import { sounds } from './sounds';
import { TipToast } from './TipToast';
import CommandPalette from './CommandPalette';
import BookComparisonModal from './BookComparisonModal';
import LibraryIntelligenceModal from './LibraryIntelligenceModal';
import BookRouletteModal from './BookRouletteModal';
import AnnotationsModal from './AnnotationsModal';
import { TIPS } from './tips';

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
        const [deletedBookTombstones, setDeletedBookTombstones] = useState({});
        const [isDbLoaded, setIsDbLoaded] = useState(false);
        const [isStateHydrated, setIsStateHydrated] = useState(false);

        // ── NAVEGACIÓN ──
        const [view, setView] = useState('library');
        const [lastReadId, setLastReadId] = useState(null);
        // tabs/activeTabId/tabTargetCfi/panelMode/rightTabId viven en useReaderOrchestration

        // ── BIBLIOTECA ──
        const [searchTerm, setSearchTerm] = useState('');
        const deferredSearchTerm = useDeferredValue(searchTerm);
        // Estado de sync (carpeta local / WebDAV) — antes solo se sabía entrando
        // a Ajustes; 'syncing'|'synced'|'error'|null (null = sin configurar).
        const [syncStatus, setSyncStatus] = useState(null);
        const onSyncStatusChange = useCallback((status) => setSyncStatus(status), []);
        // Búsquedas recientes — preferencia liviana, se guarda directo en
        // localStorage (mismo patrón que accentColor) sin pasar por la
        // hidratación de IndexedDB.
        const [recentSearches, setRecentSearches] = useState(() => {
            const s = safeParse('sharkreader_recent_searches', []);
            return Array.isArray(s) ? s.filter(t => typeof t === 'string') : [];
        });
        const [searchFocused, setSearchFocused] = useState(false);
        const commitRecentSearch = useCallback((term) => {
            const trimmed = (term || '').trim();
            if (!trimmed) return;
            setRecentSearches(prev => {
                const next = [trimmed, ...prev.filter(t => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
                try { localStorage.setItem('sharkreader_recent_searches', JSON.stringify(next)); } catch (_) {}
                return next;
            });
        }, []);
        const removeRecentSearch = useCallback((term) => {
            setRecentSearches(prev => {
                const next = prev.filter(t => t !== term);
                try { localStorage.setItem('sharkreader_recent_searches', JSON.stringify(next)); } catch (_) {}
                return next;
            });
        }, []);
        // Historial de importaciones por carpeta — útil para saber si ya
        // importaste una carpeta antes sin tener que recordarlo de memoria.
        const [importHistory, setImportHistory] = useState(() => {
            const s = safeParse('sharkreader_import_history', []);
            return Array.isArray(s) ? s : [];
        });
        const recordImportEvent = useCallback((entry) => {
            setImportHistory(prev => {
                const next = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now(), ...entry }, ...prev].slice(0, 10);
                try { localStorage.setItem('sharkreader_import_history', JSON.stringify(next)); } catch (_) {}
                return next;
            });
        }, []);
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
        const [showComparison, setShowComparison] = useState(false);
        const [showLibraryIntel, setShowLibraryIntel] = useState(false);
        const [showAnnotationsModal, setShowAnnotationsModal] = useState(false);
        const [libraryRepairScan, setLibraryRepairScan] = useState(null);
        const [libraryRepairLoading, setLibraryRepairLoading] = useState(false);
        const [backupHistory, setBackupHistory] = useState([]);
        // Registra un backup (export o import) en el historial local — no es
        // crítico para la integridad de los datos, así que se persiste directo
        // en vez de sumar otro efecto debounced.
        const recordBackupEvent = useCallback((entry) => {
            setBackupHistory(prev => {
                const next = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now(), ...entry }, ...prev].slice(0, 20);
                saveAppData('backupHistory', next);
                return next;
            });
        }, []);
        const [addonHistory, setAddonHistory] = useState({});
        // Historial corto por addon (activar/desactivar/configurar) — igual que
        // recordBackupEvent, se persiste directo sin sumar otro efecto debounced.
        const recordAddonHistory = useCallback((addonId, entry) => {
            setAddonHistory(prev => {
                const list = prev[addonId] || [];
                const next = {
                    ...prev,
                    [addonId]: [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now(), ...entry }, ...list].slice(0, 10),
                };
                saveAppData('addonHistory', next);
                return next;
            });
        }, []);
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

        // Recordatorio suave de backup: si hace 30+ días que no se exporta (o
        // nunca se exportó) y ya hay libros que valga la pena proteger, un aviso
        // — no bloqueante, una sola vez por sesión — en vez de descubrir la
        // pérdida de datos el día que algo sale mal.
        const backupReminderShownRef = useRef(false);
        useEffect(() => {
            if (!isStateHydrated || !isDbLoaded || backupReminderShownRef.current) return;
            if (books.length === 0) return;
            backupReminderShownRef.current = true;
            const lastExportAt = backupHistory
                .filter(entry => entry.type === 'export')
                .reduce((max, entry) => Math.max(max, entry.timestamp || 0), 0);
            const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
            if (!lastExportAt || Date.now() - lastExportAt > THIRTY_DAYS_MS) {
                const timer = setTimeout(() => {
                    showNoticeToast(
                        lastExportAt
                            ? 'Hace más de 30 días que no exportas un backup. Ajustes → Datos.'
                            : 'Todavía no has exportado un backup de tu biblioteca. Ajustes → Datos.',
                        'warning'
                    );
                }, 3000);
                return () => clearTimeout(timer);
            }
        }, [isStateHydrated, isDbLoaded, books.length, backupHistory, showNoticeToast]);

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

        // ── AI ── (estado + prueba de conexión aislados en su propio hook)
        const {
            aiProvider, setAiProvider,
            aiApiKey, setAiApiKey,
            aiTestStatus, aiTestMessage,
            testAIConnection, resetAITestStatus,
        } = useAIConfig();

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
            resetOnboardingState,
        } = useOnboarding({ view, booksCount: books.length, isResettingRef });

        // ── SYNC CARPETA LOCAL ──
        const [syncFolder, setSyncFolder] = useState('');
        const [webdavConfig, setWebdavConfig] = useState({ url: '', username: '', password: '' });

        // ── ACCENT COLOR ──
        const [accentColor, setAccentColor] = useState(() => safeParse('sharkreader_accent', null));

        // ── ALTO CONTRASTE ── preferencia manual independiente del tema —
        // se guarda igual que accentColor (localStorage directo, sin pasar
        // por la hidratación de IndexedDB) para que esté lista desde el
        // primer render y no haya parpadeo de bajo contraste al abrir la app.
        const [highContrast, setHighContrast] = useState(() => safeParse('sharkreader_high_contrast', false));
        useEffect(() => {
            try { localStorage.setItem('sharkreader_high_contrast', JSON.stringify(highContrast)); } catch (_) {}
        }, [highContrast]);

        // ── TAMAÑO DE INTERFAZ ── escala el font-size raíz: como casi todo el
        // espaciado y tipografía de Tailwind está en rem, esto agranda texto
        // y controles de forma proporcional en toda la app (no solo el texto
        // del lector, que ya tenía su propio control de tamaño de fuente).
        // No afecta iconos/medidas fijas en px puro, pero cubre la mayoría.
        const [uiScale, setUiScale] = useState(() => safeParse('sharkreader_ui_scale', 1));
        useEffect(() => {
            document.documentElement.style.fontSize = `${uiScale * 100}%`;
            try { localStorage.setItem('sharkreader_ui_scale', JSON.stringify(uiScale)); } catch (_) {}
        }, [uiScale]);

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
        const activeBookIdRef = useRef(null);
        const metadataRepairingRef = useRef(new Set());
        const bookDedupKeysRef = useRef(new Set());
        const bookTitleDedupKeysRef = useRef(new Set());
        const activeObjectUrlsRef = useRef(new Set());
        const progressUpdateThrottleRef = useRef(new Map());
        const watchedFolderTimerRef = useRef(null);
        const openBookNotifyTimerRef = useRef(null);

        // ── LOGROS / WORKSHOP / ANALYTICS ──
        const [achievements, setAchievements] = useState({});
        // Última vez que cambió la configuración (Workshop/categorías/colecciones)
        // — permite fusionar por fecha en vez de que gane siempre el lado que
        // sincroniza último (ver mergeBackupData en backupMerge.js).
        const [settingsUpdatedAt, setSettingsUpdatedAt] = useState(0);
        const settingsUpdatedAtSkipRef = useRef(true);
        const [achievementToast, setAchievementToast] = useState(null);
        const [activeTip, setActiveTip] = useState(null);
        const isReaderActiveRef = useRef(false);
        const showingOnboardingRef = useRef(false);
        const [addons, setAddons] = useState({});
        const [addonConfig, setAddonConfig] = useState(() => normalizeAddonConfig({}));
        useEffect(() => {
            if (!isDbLoaded || !isStateHydrated) return;
            // Se salta el primer disparo tras la hidratación (cargar lo guardado
            // no es un "cambio" del usuario) y no se dispara mientras se está
            // restaurando un backup (ver isResettingRef) para no pisar el
            // settingsUpdatedAt que trae el propio backup importado.
            if (settingsUpdatedAtSkipRef.current) { settingsUpdatedAtSkipRef.current = false; return; }
            if (isResettingRef.current) return;
            setSettingsUpdatedAt(Date.now());
        }, [addons, addonConfig, customCategories, manualCollections, isDbLoaded, isStateHydrated]);
        const [externalSources, setExternalSources] = useState(DEFAULT_EXTERNAL_SOURCES);
        const [externalCatalogState, setExternalCatalogState] = useState({ loading: false, error: '', catalog: null, importingId: null });
        const sharkyActionsRef = useRef(null);
        const addonsRef = useRef({});
        const [journalEntries, setJournalEntries] = useState([]);
        const [challenges, setChallenges] = useState([]);
        const challengeToastTimerRef = useRef(null);
        const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
        const [libraryViewport, setLibraryViewport] = useState({ width: 0, height: 0, scrollTop: 0 });

        const t = translations[lang] || translations['es'];
        const appliedTheme = useMemo(() => {
            if (!autoDarkMode) return theme;
            const hour = new Date(themeClock).getHours();
            return hour >= 19 || hour < 7 ? 'dark' : 'light';
        }, [autoDarkMode, theme, themeClock]);

        const booksById = useMemo(() => new Map(books.map(book => [book.id, book])), [books]);
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

        // Sonido de subida de nivel: readerLevel es un useMemo, así que detectamos
        // el cruce de nivel comparando contra el valor anterior tras la hidratación.
        const prevReaderLevelRef = useRef(null);
        useEffect(() => {
            if (!isStateHydrated) return;
            if (prevReaderLevelRef.current === null) {
                prevReaderLevelRef.current = readerLevel.level;
                return;
            }
            if (readerLevel.level > prevReaderLevelRef.current && addons.levelSystem) {
                if (addons.soundFeedback && addonConfig.soundFeedback?.achievements !== false) {
                    sounds.levelUp((addonConfig.soundFeedback?.volume ?? 100) / 100 * 0.25);
                }
                sharkyActionsRef?.current?.notifyLevelUp?.(readerLevel.level);
            }
            prevReaderLevelRef.current = readerLevel.level;
        }, [readerLevel.level, isStateHydrated, addons.levelSystem, addons.soundFeedback, addonConfig.soundFeedback]);

        // ── RETOS DE LECTURA: detección de completado ──
        useEffect(() => {
            if (!isStateHydrated || challenges.length === 0) return;
            const { next, justCompleted } = settleChallenges(challenges, { stats, books });
            if (!justCompleted.length) return;
            setChallenges(next);
            const done = justCompleted[0];
            setAchievementToast({ emoji: done.emoji || '🎯', name: '¡Reto completado!', desc: done.title, rarity: 'epic' });
            if (addons.soundFeedback && addonConfig.soundFeedback?.achievements !== false) {
                sounds.achievement((addonConfig.soundFeedback?.volume ?? 100) / 100 * 0.3);
            }
            sharkyActionsRef?.current?.notifyChallengeCompleted?.(done.title);
            clearTimeout(challengeToastTimerRef.current);
            challengeToastTimerRef.current = setTimeout(() => setAchievementToast(null), 4500);
        }, [challenges, stats, books, isStateHydrated, addons.soundFeedback, addonConfig.soundFeedback]);

        useEffect(() => () => clearTimeout(challengeToastTimerRef.current), []);

        const addChallenge = useCallback((type, target) => {
            const challenge = createChallenge(type, target);
            if (!challenge) return;
            setChallenges(prev => [
                ...prev.filter(c => !(c.type === type && c.target === target && !c.completedAt)),
                challenge,
            ]);
        }, []);

        const removeChallenge = useCallback((id) => {
            setChallenges(prev => prev.filter(c => c.id !== id));
        }, []);

        // ── RESUMEN SEMANAL: notificación nativa una vez por semana ──
        useEffect(() => {
            if (!isStateHydrated || !userProfile) return;
            if (typeof Notification === 'undefined') return;
            const weekKey = isoWeekKey();
            let lastNotified = null;
            try { lastNotified = localStorage.getItem('sr_weekly_summary_week'); } catch (_) {}
            if (lastNotified === weekKey) return;
            try { localStorage.setItem('sr_weekly_summary_week', weekKey); } catch (_) {}
            const summary = lastWeekSummary({ stats, books });
            if (summary.minutes < 5) return; // semana sin actividad relevante: no molestar
            const showNotification = () => {
                const parts = [`${summary.minutes} min leídos en ${summary.daysActive} ${summary.daysActive === 1 ? 'día' : 'días'}`];
                if (summary.booksFinished > 0) parts.push(`${summary.booksFinished} ${summary.booksFinished === 1 ? 'libro terminado' : 'libros terminados'}`);
                if (stats.streak > 0) parts.push(`racha de ${stats.streak} días`);
                try { new Notification('🦈 Tu semana de lectura', { body: parts.join(' · '), silent: true }); } catch (_) {}
            };
            if (Notification.permission === 'granted') showNotification();
            else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(p => { if (p === 'granted') showNotification(); }).catch(() => {});
            }
        }, [isStateHydrated, userProfile]); // eslint-disable-line

        // ── Migración: perfiles creados antes de v5.2 no tienen joinedAt (usado
        // para el aniversario de cuenta de Sharky) — se rellena una sola vez.
        useEffect(() => {
            if (!isStateHydrated || !userProfile || userProfile.joinedAt) return;
            setUserProfile(prev => (prev && !prev.joinedAt) ? { ...prev, joinedAt: Date.now() } : prev);
        }, [isStateHydrated, userProfile]);

        // ── PALETA DE COMANDOS: Ctrl+K / Cmd+K ──
        useEffect(() => {
            const onKeyDown = (e) => {
                if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                    e.preventDefault();
                    setCommandPaletteOpen(prev => !prev);
                }
            };
            window.addEventListener('keydown', onKeyDown);
            return () => window.removeEventListener('keydown', onKeyDown);
        }, []);

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
            recordImportEvent,
        });

        useContentIndexing({
            books,
            contentIndexMap,
            deferredSearchTerm,
            isDbLoaded,
            isStateHydrated,
            setContentIndexMap,
            booksRef,
            contentIndexQueueRef,
            contentIndexRunningRef,
            contentIndexMapRef,
            contentIndexQueuedRef,
        });

        useMetadataRepair({
            isDbLoaded,
            isResettingRef,
            booksRef,
            metadataRepairingRef,
            bookPayloadsToFiles,
            setBooks,
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

        // ── ¿SABÍAS QUE? — refs de estado en el momento de disparo ──
        // El efecto de activeTabId se registra tras useReaderOrchestration (más abajo)
        // porque activeTabId vive en ese hook.
        useEffect(() => { showingOnboardingRef.current = showWelcomeTutorial; }, [showWelcomeTutorial]);

        // ── ¿SABÍAS QUE? — scheduling de tips ──
        useEffect(() => {
            if (!isStateHydrated) return;

            const sessions = parseInt(localStorage.getItem('sr_tip_sessions') || '0', 10) + 1;
            localStorage.setItem('sr_tip_sessions', String(sessions));

            const isNewUser = sessions <= 5;
            const FIRST_DELAY = isNewUser ? 25000 : 55000;
            const REPEAT_DELAY = isNewUser ? 8 * 60000 : 15 * 60000;
            const MAX_TIPS = 3;
            let shown = 0;

            function pickTip() {
                const seenIds = JSON.parse(localStorage.getItem('sr_tips_seen') || '[]');
                const unseen = TIPS.filter(t => !seenIds.includes(t.id));
                const pool = unseen.length > 0 ? unseen : TIPS;
                const tip = pool[Math.floor(Math.random() * pool.length)];
                localStorage.setItem('sr_tips_seen', JSON.stringify(
                    unseen.length > 0 ? [...seenIds, tip.id] : [tip.id]
                ));
                return tip;
            }

            function tryShowTip() {
                if (shown >= MAX_TIPS) return;
                if (isReaderActiveRef.current) return;
                if (showingOnboardingRef.current) return;
                setActiveTip(pickTip());
                shown++;
            }

            const t1 = setTimeout(tryShowTip, FIRST_DELAY);
            const t2 = setInterval(tryShowTip, REPEAT_DELAY);

            return () => { clearTimeout(t1); clearInterval(t2); };
        }, [isStateHydrated]);

        useEffect(() => {
            document.body.className = `theme-${appliedTheme}${highContrast ? ' high-contrast' : ''}`;
            setStats(prev => {
                const used = new Set(prev.themesUsed || []);
                used.add(appliedTheme);
                if (used.size === (prev.themesUsed || []).length) return prev;
                return { ...prev, themesUsed: [...used] };
            });
        }, [appliedTheme, highContrast]);

        useEffect(() => {
            if (!autoDarkMode) return;
            const timer = setInterval(() => setThemeClock(Date.now()), 60000);
            return () => clearInterval(timer);
        }, [autoDarkMode]);

        // Apply accent color CSS variables
        useEffect(() => {
            if (isResettingRef.current) return;
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

        // Definida antes de useReaderOrchestration porque el hook la usa en su
        // llamada inicial (evita el TDZ: no puede referenciarse antes de existir).
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

        const {
            tabs, setTabs,
            activeTabId, setActiveTabId,
            tabTargetCfi, setTabTargetCfi,
            panelMode, setPanelMode,
            rightTabId, setRightTabId,
            openBook,
            closeTab,
            closeBook,
            switchReaderTab,
            activeTab,
            currentBookData,
            stableCurrentBookData,
            currentTargetCfi,
            rightBookData,
            stableRightBookData,
        } = useReaderOrchestration({
            books,
            booksRef,
            booksById,
            addonsRef,
            sharkyActionsRef,
            addJournalEntry,
            setBooks,
            setStats,
            setLastReadId,
            setView,
            isDbLoaded,
            isStateHydrated,
            isResettingRef,
            openBookNotifyTimerRef,
        });

        useAppHydration({
            setBooks,
            setIsDbLoaded,
            setIsStateHydrated,
            activeObjectUrlsRef,
            setters: {
                setStats,
                setJournalEntries,
                setChallenges,
                setVocabulary,
                setCustomCategories,
                setManualCollections,
                setDeletedBookTombstones,
                setCurrentFilter,
                setSortBy,
                setTabs,
                setActiveTabId,
                setTabTargetCfi,
                setPanelMode,
                setRightTabId,
                setUserProfile,
                setTheme,
                setAutoDarkMode,
                setLang,
                setReadFlow,
                setReadLayout,
                setPageTransition,
                setWarmMode,
                setAiProvider,
                setAiApiKey,
                setSyncFolder,
                setWebdavConfig,
                setLibraryView,
                setDailyGoalMins,
                setYearlyGoal,
                setWeeklyGoalMins,
                setAchievements,
                setAddons,
                setAddonConfig,
                setExternalSources,
                setAccentColor,
                setSettingsUpdatedAt,
                setBackupHistory,
                setAddonHistory,
            },
        });

        const { resetPersistenceRuntime } = useAppPersistence({
            books,
            deletedBookTombstones,
            customCategories,
            manualCollections,
            stats,
            userProfile,
            addons,
            addonConfig,
            externalSources,
            syncFolder,
            webdavConfig,
            onSyncStatusChange,
            theme,
            autoDarkMode,
            tutorialEnabled,
            showWelcomeTutorial,
            tutorialSeenHints,
            lang,
            readFlow,
            readLayout,
            pageTransition,
            warmMode,
            libraryView,
            accentColor,
            vocabulary,
            dailyGoalMins,
            weeklyGoalMins,
            yearlyGoal,
            achievements,
            settingsUpdatedAt,
            journalEntries,
            challenges,
            currentFilter,
            sortBy,
            categoryColors,
            aiProvider,
            aiApiKey,
            isDbLoaded,
            isStateHydrated,
            isResettingRef,
        });

        // useBookRouletteAddon (más abajo) expone closeBookRoulette, pero
        // useAccountReset se llama antes en el render — se reenvía por ref
        // (mismo patrón que stopTtsRef en los lectores) para no depender del
        // orden real de declaración.
        const closeBookRouletteRef = useRef(() => {});

        const deleteAccountAndData = useAccountReset({
            isResettingRef,
            refs: {
                persistStatsRef,
                openBookNotifyTimerRef,
                challengeToastTimerRef,
                watchedFolderTimerRef,
                booksRef,
                activeObjectUrlsRef,
                bookDedupKeysRef,
                bookTitleDedupKeysRef,
                metadataRepairingRef,
                contentIndexQueueRef,
                contentIndexQueuedRef,
                contentIndexRunningRef,
                contentIndexMapRef,
                progressUpdateThrottleRef,
                activeBookIdRef,
            },
            actions: {
                resetPersistenceRuntime,
                resetTutorialCooldown,
                resetImportState,
                resetUI,
                resetOnboardingState,
                setIsDragging,
                showNoticeToast,
            },
            setters: {
                setAchievementToast,
                setActiveTip,
                setAchievements,
                setStats,
                setVocabulary,
                setJournalEntries,
                setChallenges,
                setAddons,
                setAddonConfig,
                setExternalSources,
                setExternalCatalogState,
                setCustomCategories,
                setManualCollections,
                setDeletedBookTombstones,
                setCategoryColors,
                setContentIndexMap,
                setTabs,
                setActiveTabId,
                setTabTargetCfi,
                setRightTabId,
                setPanelMode,
                setLastReadId,
                setCurrentFilter,
                setSortBy,
                setSearchTerm,
                setFilterTags,
                setFilterAuthors,
                setSelectedBookIds,
                setIsSelecting,
                setActiveBookModal,
                setShowComparison,
                setShowLibraryIntel,
                setShowAnnotationsModal,
                setAnnotationSearch,
                setAnnotationBookFilter,
                closeBookRoulette: () => closeBookRouletteRef.current(),
                setTheme,
                setAutoDarkMode,
                setLang,
                setReadFlow,
                setReadLayout,
                setPageTransition,
                setWarmMode,
                setLibraryView,
                setAccentColor,
                setAiProvider,
                setAiApiKey,
                setSyncFolder,
                setWebdavConfig,
                setDailyGoalMins,
                setWeeklyGoalMins,
                setYearlyGoal,
                setAnniversaryInfo,
                setView,
                setUserProfile,
                setBooks,
            },
        });

        const readerTabBooks = useReaderTabSummaries(tabs, booksById);
        useEffect(() => { isReaderActiveRef.current = activeTabId !== null; }, [activeTabId]);

        const toggleSpreadLayout = useCallback(() => {
            setReadLayout(prev => prev === 'auto' ? 'none' : 'auto');
        }, []);

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
            setDeletedBookTombstones,
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
            showNoticeToast,
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
            if (!tempLoginName.trim()) { showNoticeToast('Ingresa un nombre para crear tu perfil.', 'warning'); return; }
            setUserProfile({ name: tempLoginName.trim(), avatar: tempLoginAvatar, joinedAt: Date.now() });
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

        // Colección inteligente: guarda una regla en vez de una lista fija de
        // bookIds. Su contenido se recalcula en vivo en useLibrary (collectionLookup).
        const createSmartCollection = useCallback((name, rule) => {
            const cleanName = (name || '').trim();
            if (!cleanName || !rule?.type || rule.value === '' || rule.value == null) return null;
            const existing = manualCollections.find(collection => collection.name.toLowerCase() === cleanName.toLowerCase());
            if (existing) return existing.id;
            const nextCollection = {
                id: `collection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                name: cleanName,
                emoji: '⚡',
                rule,
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

        const bulkAssignAuthor = useCallback((author) => {
            const clean = (author || '').trim();
            if (!clean) return;
            const now = Date.now();
            setBooks(prev => prev.map(b => selectedBookIds.has(b.id) ? { ...b, author: clean, updatedAt: now, metadataUpdatedAt: now } : b));
        }, [selectedBookIds]);

        const bulkAssignSeries = useCallback((series) => {
            const clean = (series || '').trim();
            if (!clean) return;
            const now = Date.now();
            setBooks(prev => {
                // Continuar la numeración si la serie ya tiene libros con índice
                let nextIndex = prev.reduce((max, b) => (b.series === clean && b.seriesIndex ? Math.max(max, b.seriesIndex) : max), 0);
                return prev.map(b => {
                    if (!selectedBookIds.has(b.id)) return b;
                    if (b.series === clean && b.seriesIndex) return b; // ya estaba en la serie
                    nextIndex += 1;
                    return { ...b, series: clean, seriesIndex: nextIndex, updatedAt: now, metadataUpdatedAt: now };
                });
            });
        }, [selectedBookIds]);

        const bulkMarkFinished = useCallback((isFinished) => {
            const now = Date.now();
            setBooks(prev => prev.map(b => !selectedBookIds.has(b.id) ? b : {
                ...b,
                isFinished,
                dateFinished: isFinished ? now : null,
                progressUpdatedAt: now,
                updatedAt: now,
            }));
            clearSelection();
        }, [selectedBookIds, clearSelection]);

        const bulkToggleFav = useCallback(() => {
            const now = Date.now();
            const allFav = [...selectedBookIds].every(id => books.find(b => b.id === id)?.isFav);
            setBooks(prev => prev.map(b => !selectedBookIds.has(b.id) ? b : {
                ...b,
                isFav: !allFav,
                metadataUpdatedAt: now,
                updatedAt: now,
            }));
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
            const deletedAt = Date.now();
            setDeletedBookTombstones(prev => {
                const next = { ...prev };
                idsToDelete.forEach(id => { next[id] = deletedAt; });
                return next;
            });
            setBooks(prev => prev.filter(b => !idsToDelete.has(b.id)));
            Promise.all([...idsToDelete].map(deleteBookFromDB)).catch(error => {
                console.error('[SharkReader] No se pudieron eliminar todos los libros seleccionados:', error);
            });
            clearSelection();
        }, [selectedBookIds, clearSelection]);

        // Elimina libros puntuales por id (usado por el escaneo de duplicados) —
        // sin depender de la selección múltiple de la biblioteca.
        const deleteBooksByIds = useCallback((ids) => {
            if (!ids?.length) return;
            if (!window.confirm(`¿Eliminar ${ids.length} libro(s)? Esta acción no se puede deshacer.`)) return;
            const idsToDelete = new Set(ids);
            const deletedAt = Date.now();
            setDeletedBookTombstones(prev => {
                const next = { ...prev };
                idsToDelete.forEach(id => { next[id] = deletedAt; });
                return next;
            });
            setBooks(prev => prev.filter(b => !idsToDelete.has(b.id)));
            Promise.all([...idsToDelete].map(deleteBookFromDB)).catch(error => {
                console.error('[SharkReader] No se pudieron eliminar todos los libros detectados:', error);
            });
        }, []);

        // Reparador de biblioteca (Fase 6): escanea portadas faltantes, metadata
        // dañada, duplicados y archivos huérfanos en IndexedDB. El scan de
        // huérfanos necesita leer FILES_STORE, así que es async — el resto del
        // escaneo es síncrono y puro (libraryRepair.js).
        const runLibraryRepairScan = useCallback(async () => {
            setLibraryRepairLoading(true);
            // Un resultado vacío (no null) mantiene el modal abierto mostrando
            // "Escaneando…" en vez de parpadear cerrado mientras se espera.
            setLibraryRepairScan(prev => prev || { missingCovers: [], corruptedMetadata: [], duplicateGroups: [], orphanedFiles: [] });
            try {
                const fileRecords = await loadFilesFromDB();
                setLibraryRepairScan(scanLibraryIssues(booksRef.current, fileRecords));
            } catch (error) {
                console.warn('[SharkReader] No se pudo escanear la biblioteca:', error);
                showNoticeToast('No se pudo completar el escaneo de la biblioteca.', 'warning');
            } finally {
                setLibraryRepairLoading(false);
            }
        }, [showNoticeToast]);

        const closeLibraryRepair = useCallback(() => {
            setLibraryRepairScan(null);
        }, []);

        // Un archivo huérfano no tiene libro asociado (por definición), así que
        // no pasa por deleteBooksByIds (que filtra el array `books`) — solo hay
        // que borrar su registro en IndexedDB directamente.
        const deleteOrphanedFile = useCallback((id) => {
            deleteBookFromDB(id).then(() => {
                setLibraryRepairScan(prev => prev ? { ...prev, orphanedFiles: prev.orphanedFiles.filter(f => f.id !== id) } : prev);
            }).catch(error => {
                console.warn('[SharkReader] No se pudo eliminar el archivo huérfano:', error);
                showNoticeToast('No se pudo eliminar el archivo huérfano.', 'warning');
            });
        }, [showNoticeToast]);

        // Aplica un grupo de series detectado automáticamente: asigna `series`/`seriesIndex`
        // a los libros del grupo (LibraryIntelligenceModal, v5.1).
        const applySeriesCandidate = useCallback((candidate) => {
            if (!candidate?.books?.length) return;
            const now = Date.now();
            const indexById = new Map(candidate.books.map(b => [b.id, b.detectedIndex]));
            setBooks(prev => prev.map(b => indexById.has(b.id)
                ? { ...b, series: candidate.suggestedName, seriesIndex: indexById.get(b.id), updatedAt: now, metadataUpdatedAt: now }
                : b));
        }, []);

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

        // Reordenar arrastrando una colección hasta la posición de otra —
        // complementa a moveManualCollection (↑↓), que sigue siendo el único
        // camino accesible por teclado.
        const reorderManualCollection = useCallback((draggedId, targetId) => {
            if (draggedId === targetId) return;
            setManualCollections(prev => {
                const fromIdx = prev.findIndex(c => c.id === draggedId);
                const toIdx = prev.findIndex(c => c.id === targetId);
                if (fromIdx === -1 || toIdx === -1) return prev;
                const next = [...prev];
                const [moved] = next.splice(fromIdx, 1);
                next.splice(toIdx, 0, moved);
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
                recordAddonHistory(id, { type: validation.enabled ? 'enabled' : 'disabled' });
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
                // El auto-backup reescribe lastBackupAt en cada ciclo — no es un
                // cambio real de configuración hecho por el usuario, así que no
                // se registra en el historial para no llenarlo de ruido.
                const isAutoBackupTick = id === 'autoBackup' && Object.keys(patch || {}).every(key => key === 'lastBackupAt');
                if (!isAutoBackupTick) recordAddonHistory(id, { type: 'config', patch });
                return updated;
            });
        }, [recordAddonHistory]);

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


        // API interna mínima que exponemos a los addons (reader/library/storage/
        // audio/notifications/sharky) — evita que su lógica dependa directamente
        // de window.electronAPI o de los setters internos de App.jsx.
        const workshopApi = useMemo(
            () => createWorkshopApi({ openBook, showNoticeToast, setStats }),
            [openBook, showNoticeToast]
        );

        useWatchedFolderAddon({
            enabled: addons.watchedFolder,
            config: addonConfig.watchedFolder,
            api: workshopApi,
            folderImport,
            beginFolderImportSession,
            timerRef: watchedFolderTimerRef,
        });

        const buildAutoBackupPayload = useCallback(() => buildPortableBackup({
            books: books.filter(b => !b.loading).map(stripBookFilesForExport),
            deletedBooks: deletedBookTombstones,
            categories: customCategories,
            collections: manualCollections,
            stats,
            user: userProfile || {},
            workshop: migrateWorkshopData({ addons, addonConfig, externalSources }),
            achievements,
            settingsUpdatedAt,
        }), [addonConfig, addons, achievements, books, customCategories, deletedBookTombstones, manualCollections, externalSources, settingsUpdatedAt, stats, userProfile]);

        useAutoBackupAddon({
            enabled: addons.autoBackup,
            config: addonConfig.autoBackup,
            api: workshopApi,
            ready: isDbLoaded && isStateHydrated,
            buildBackup: buildAutoBackupPayload,
            updateConfig: useCallback((patch) => updateAddonConfig('autoBackup', patch), [updateAddonConfig]),
        });

        const {
            rouletteBook,
            roulettePool,
            spinBookRoulette,
            handleRouletteResult,
            closeBookRoulette,
        } = useBookRouletteAddon({ config: addonConfig.bookRoulette, books, api: workshopApi });
        useEffect(() => { closeBookRouletteRef.current = closeBookRoulette; }, [closeBookRoulette]);

        // ── SYSTEM TRAY: informar último libro y responder a "Continuar leyendo" ──
        const trayActionRef = useRef({ lastReadId: null, openBook: null });
        useEffect(() => {
            trayActionRef.current = { lastReadId, openBook };
            if (!window.electronAPI?.updateTrayInfo) return;
            const lastBook = books.find(b => b.id === lastReadId);
            window.electronAPI.updateTrayInfo({ lastBookName: lastBook?.name || null });
        }, [lastReadId, books, openBook]);

        useEffect(() => {
            if (!window.electronAPI?.onTrayContinueReading) return;
            const subscription = window.electronAPI.onTrayContinueReading(() => {
                const { lastReadId: id, openBook: open } = trayActionRef.current;
                if (id && open) open(id);
            });
            return () => window.electronAPI.offTrayContinueReading?.(subscription);
        }, []);

        const persistEpubReaderPreferences = useCallback((bookId, readerPreferences) => {
            setBooks(previous => updateBookInList(previous, bookId, book => {
                const currentPreferences = book.readerPreferences || null;
                if (JSON.stringify(currentPreferences) === JSON.stringify(readerPreferences)) return book;
                const now = Date.now();
                return {
                    ...book,
                    readerPreferences,
                    metadataUpdatedAt: now,
                    updatedAt: now,
                };
            }));
        }, []);

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
            if (!userProfile) { showNoticeToast('Crea tu perfil antes de exportar.', 'warning'); return; }
            const data = buildPortableBackup({
                books: books.filter(b => !b.loading).map(stripBookFilesForExport),
                deletedBooks: deletedBookTombstones,
                categories: customCategories,
                collections: manualCollections,
                stats,
                user: userProfile || {},
                workshop: migrateWorkshopData({ addons, addonConfig, externalSources }),
                achievements,
                settingsUpdatedAt,
            });
            const fileName = `SharkReader_Backup_${new Date().toISOString().split('T')[0]}.json`;
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url);
            recordBackupEvent({ type: 'export-json', fileName, bookCount: (data.books || []).length });
        };

        // Export selectivo — comparten pipeline de importación con exportAllData
        // (mismo validateBackupData/BackupPreviewModal/applyBackupObject, que ya
        // tratan cada sección como opcional), así que no hace falta tocar nada
        // del lado de importación para que estos dos funcionen al restaurar.
        //
        // "Solo anotaciones" NO es uno de estos: el esquema de backup normaliza
        // TODO libro a un registro completo (progress, rating, etc. se rellenan
        // con valores por defecto aunque no vengan en el JSON de entrada), así
        // que un book record parcial se restauraría pisando progreso/valoración
        // con ceros — inseguro. Para solo-anotaciones ya existe un export de
        // solo-lectura correcto en el panel de Anotaciones (.MD/.HTML/.JSON),
        // pensado para leer/archivar, no para reimportar como backup.
        const downloadJsonBackup = (data, fileNamePrefix) => {
            const fileName = `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.json`;
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url);
            return fileName;
        };

        const exportLibraryOnly = useCallback(() => {
            const data = buildPortableBackup({
                books: booksRef.current.filter(b => !b.loading).map(stripBookFilesForExport),
                deletedBooks: deletedBookTombstones,
            });
            const fileName = downloadJsonBackup(data, 'SharkReader_Biblioteca');
            recordBackupEvent({ type: 'export-library', fileName, bookCount: (data.books || []).length });
        }, [deletedBookTombstones, recordBackupEvent]);

        const exportSettingsOnly = useCallback(() => {
            const data = buildPortableBackup({
                books: undefined,
                categories: customCategories,
                collections: manualCollections,
                workshop: migrateWorkshopData({ addons, addonConfig, externalSources }),
                settingsUpdatedAt,
            });
            const fileName = downloadJsonBackup(data, 'SharkReader_Ajustes');
            recordBackupEvent({ type: 'export-settings', fileName });
        }, [addonConfig, addons, customCategories, externalSources, manualCollections, recordBackupEvent, settingsUpdatedAt]);

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
            showNoticeToast('Diagnóstico limpiado.', 'info');
        }, [showNoticeToast]);

        const exportZipBackup = useCallback(async (includeFiles = false) => {
            const backup = buildPortableBackup({
                books: booksRef.current.filter(b => !b.loading).map(stripBookFilesForExport),
                deletedBooks: deletedBookTombstones,
                categories: customCategories,
                collections: manualCollections,
                stats,
                user: userProfile || {},
                workshop: migrateWorkshopData({ addons, addonConfig, externalSources }),
                achievements,
                settingsUpdatedAt,
            });

            const zip = new JSZip();
            const manifestJson = JSON.stringify(backup, null, 2);
            zip.file('sharkreader-backup.json', manifestJson);
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
            zip.file('achievements.json', JSON.stringify(backup.achievements || {}, null, 2));
            zip.file('diagnostics.json', JSON.stringify(getDiagnosticEntries(), null, 2));
            // "Backup verificable": hash del manifiesto para poder detectar en la
            // importación si el ZIP se corrompió en el camino (descarga
            // interrumpida, USB defectuoso, etc.) — no es una firma de seguridad,
            // solo una comprobación de integridad.
            zip.file('checksums.json', JSON.stringify({
                algorithm: 'sha256',
                'sharkreader-backup.json': await sha256Hex(manifestJson),
            }, null, 2));
            let includedFileCount = 0;
            if (includeFiles) {
                try {
                    const fileRecords = await loadFilesFromDB();
                    const booksById2 = new Map(booksRef.current.map(b => [b.id, b]));
                    fileRecords.forEach(record => {
                        const book = booksById2.get(record?.id);
                        if (!record?.file || !book) return;
                        const rawName = record.file.name || `${book.name || 'libro'}.${book.type || 'epub'}`;
                        const safeName = rawName.replace(/[<>:"/\\|?*]/g, '_').slice(0, 120);
                        zip.file(`books/${book.id}__${safeName}`, record.file);
                        includedFileCount += 1;
                    });
                } catch (err) {
                    console.warn('[SharkReader] No se pudieron incluir los archivos en el backup:', err);
                }
            }
            zip.file('README.txt', [
                'SharkReader backup ZIP',
                `Exportado: ${new Date().toISOString()}`,
                '',
                'Este ZIP contiene datos de biblioteca, metadata, progreso, configuración y diagnóstico.',
                includeFiles
                    ? `Incluye ${includedFileCount} archivo(s) EPUB/PDF en la carpeta books/ para restauración completa.`
                    : 'No incluye archivos EPUB/PDF completos para evitar duplicar contenido protegido.',
                '',
                'Para restaurar: Ajustes -> Datos -> Importar backup y selecciona este ZIP.',
            ].join('\n'));

            const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            const fileName = `SharkReader_Backup${includeFiles ? '_Completo' : ''}_${new Date().toISOString().slice(0, 10)}.zip`;
            downloadBlob(blob, fileName);
            recordBackupEvent({ type: 'export-zip', fileName, bookCount: (backup.books || []).length, includeFiles });
        }, [addonConfig, addons, achievements, customCategories, deletedBookTombstones, downloadBlob, externalSources, manualCollections, recordBackupEvent, settingsUpdatedAt, stats, userProfile]);

        const applyBackupObject = async (rawBackup, validationResult = null) => {
            const { backup: d, warnings } = validationResult || validateBackupData(rawBackup);
            const writes = [];
            const effectiveDeletedBooks = await new Promise(resolve => {
                setDeletedBookTombstones(prev => {
                    if (!d.deletedBooks) {
                        resolve(prev);
                        return prev;
                    }
                    const next = { ...prev };
                    Object.entries(d.deletedBooks).forEach(([bookId, timestamp]) => {
                        next[bookId] = Math.max(Number(next[bookId] || 0), Number(timestamp || 0));
                    });
                    resolve(next);
                    return next;
                });
            });
            if (d.deletedBooks) {
                writes.push(saveAppData('deletedBookTombstones', effectiveDeletedBooks));
            }

            if (Array.isArray(d.books) || d.meta || d.deletedBooks) {
                const nextBooks = await new Promise(resolve => {
                    setBooks(prev => {
                        let mergedBooks = prev;
                        if (Array.isArray(d.books)) {
                            const byId = new Map(d.books.filter(book => book?.id).map(book => [book.id, book]));
                            const bySourcePath = new Map(d.books.filter(book => book?.sourcePath).map(book => [book.sourcePath, book]));
                            const byLegacyKey = new Map(d.books.map(book => [`${book.originalTitle || ''}|${book.originalAuthor || ''}`, book]));
                            mergedBooks = prev.map(book => {
                                const imported = byId.get(book.id)
                                    || (book.sourcePath ? bySourcePath.get(book.sourcePath) : null)
                                    || byLegacyKey.get(`${book.originalTitle || ''}|${book.originalAuthor || ''}`);
                                return applyImportedBookData(book, imported);
                            });
                        } else if (d.meta) {
                            mergedBooks = prev.map(book => applyImportedBookData(book, d.meta[`${book.originalTitle || ''}|${book.originalAuthor || ''}`]));
                        }
                        mergedBooks = mergedBooks.filter(book => !isBookDeletedByTombstone(book, effectiveDeletedBooks));
                        resolve(mergedBooks);
                        return mergedBooks;
                    });
                });
                const liveIds = new Set(nextBooks.map(book => book.id));
                const deletedIds = booksRef.current
                    .filter(book => !liveIds.has(book.id))
                    .map(book => book.id);
                if (deletedIds.length) {
                    writes.push(Promise.all(deletedIds.map(deleteBookFromDB)).then(() => true));
                }
                writes.push(saveBooksToDB(nextBooks.filter(book => !book.loading).map(book =>
                    toStoredBookRecord(book, {}, { includeFile: false })
                )));
            }

            const nextCategories = Array.isArray(d.categories)
                ? d.categories.filter(cat => String(cat).toLowerCase() !== 'favoritos')
                : customCategories;
            setCustomCategories(nextCategories);
            writes.push(saveSetting('categories', nextCategories));

            if (Array.isArray(d.collections)) {
                setManualCollections(d.collections);
                writes.push(saveSetting('collections', d.collections));
            }
            if (d.stats) {
                setStats(d.stats);
                writes.push(saveAppData('stats', d.stats));
            }
            if (d.user) {
                setUserProfile(d.user);
                writes.push(saveAppData('userProfile', d.user));
            }
            if (d.workshop) {
                const migratedWorkshop = migrateWorkshopData(d.workshop);
                setAddons(migratedWorkshop.addons);
                setAddonConfig(migratedWorkshop.addonConfig);
                setExternalSources(migratedWorkshop.externalSources);
                writes.push(saveAppData('workshop', migratedWorkshop));
                const nextSettingsTs = Math.max(Number(d.settingsUpdatedAt || 0), Date.now());
                setSettingsUpdatedAt(nextSettingsTs);
                writes.push(saveAppData('settingsUpdatedAt', nextSettingsTs));
            }
            if (d.achievements) {
                // Restaurar (no reemplazar): un logro ya desbloqueado en este
                // dispositivo no debe "perderse" porque el backup importado no lo
                // tenía — se une conservando la fecha de desbloqueo más antigua.
                const mergedAchievements = mergeAchievements(achievements, d.achievements);
                setAchievements(mergedAchievements);
                writes.push(saveAppData('achievements', mergedAchievements));
            }

            const results = await Promise.all(writes);
            if (results.some(result => result === false)) {
                throw new Error('No se pudieron persistir todos los datos restaurados.');
            }
            if (warnings.length) {
                showNoticeToast(warnings.join(' '), 'warning');
            }
            return { warnings };
        };

        // Importar backup ahora es un flujo de dos pasos: "preparar" (leer,
        // validar, verificar checksum si lo trae, calcular el diff contra la
        // biblioteca actual) deja todo listo en `pendingImport` para que el
        // usuario vea una previsualización antes de que se toque ningún dato —
        // "confirmar" es lo único que realmente escribe algo.
        const [pendingImport, setPendingImport] = useState(null);
        const [importBusy, setImportBusy] = useState(false);

        const prepareZipImport = async (f) => {
            const zip = await JSZip.loadAsync(f);
            const manifest = zip.file('sharkreader-backup.json');
            if (!manifest) throw new Error('El ZIP no contiene sharkreader-backup.json');
            if (Number(manifest?._data?.uncompressedSize || 0) > 25 * 1024 * 1024) {
                throw new Error('El manifiesto del backup es demasiado grande.');
            }
            const manifestText = await manifest.async('string');
            const rawBackup = JSON.parse(manifestText);
            const validationResult = validateBackupData(rawBackup);

            // Verificación de integridad, best-effort: si el ZIP no trae
            // checksums.json (backups viejos) simplemente no se muestra nada.
            let checksumStatus = 'unavailable';
            const checksumsFile = zip.file('checksums.json');
            if (checksumsFile) {
                try {
                    const checksums = JSON.parse(await checksumsFile.async('string'));
                    const expected = checksums?.['sharkreader-backup.json'];
                    if (expected) {
                        const actual = await sha256Hex(manifestText);
                        checksumStatus = actual === expected ? 'ok' : 'mismatch';
                    }
                } catch (_) { checksumStatus = 'unavailable'; }
            }

            const bookEntries = Object.values(zip.files).filter(entry =>
                !entry.dir
                && entry.name.startsWith('books/')
                && /\.(epub|pdf)$/i.test(entry.name)
            );

            setPendingImport({
                kind: 'zip',
                zip,
                validationResult,
                diff: computeBackupDiff(booksRef.current, validationResult.backup),
                checksumStatus,
                bookEntries,
                bookEntryCount: bookEntries.length,
                warnings: validationResult.warnings,
                fileName: f.name,
            });
        };

        const prepareJsonImport = async (f) => {
            const text = await f.text();
            const rawBackup = JSON.parse(text);
            const validationResult = validateBackupData(rawBackup);
            setPendingImport({
                kind: 'json',
                zip: null,
                validationResult,
                diff: computeBackupDiff(booksRef.current, validationResult.backup),
                checksumStatus: 'unavailable',
                bookEntries: [],
                bookEntryCount: 0,
                warnings: validationResult.warnings,
                fileName: f.name,
            });
        };

        const importData = (e) => {
            const f = e.target.files[0]; if (!f) return;
            const prepare = /\.zip$/i.test(f.name) ? prepareZipImport(f) : prepareJsonImport(f);
            prepare.catch(error => {
                console.warn('[SharkReader] Backup rechazado:', error);
                showNoticeToast(error?.message || 'El archivo no es un backup válido de SharkReader.', 'error');
            });
            e.target.value = '';
        };

        const cancelPendingImport = useCallback(() => setPendingImport(null), []);

        const confirmPendingImport = useCallback(async () => {
            if (!pendingImport || importBusy) return;
            setImportBusy(true);
            try {
                const { bookEntries, validationResult, diff } = pendingImport;
                if (bookEntries.length) {
                    showNoticeToast(`Restaurando ${bookEntries.length} libro(s) del backup…`, 'info');
                    const restoreBatchSize = 8;
                    for (let index = 0; index < bookEntries.length; index += restoreBatchSize) {
                        const batchEntries = bookEntries.slice(index, index + restoreBatchSize);
                        const files = [];
                        for (const entry of batchEntries) {
                            const blob = await entry.async('blob');
                            const rawName = entry.name.slice('books/'.length).replace(/^[^_]+__/, '') || 'libro.epub';
                            const type = /\.pdf$/i.test(rawName) ? 'application/pdf' : 'application/epub+zip';
                            files.push(new File([blob], rawName, { type }));
                        }
                        await processFiles(files, { awaitMetadata: true });
                    }
                }
                const countBefore = booksRef.current.length;
                await applyBackupObject(validationResult.backup, validationResult);
                // Validación de integridad post-restauración: si el backup no traía
                // tombstones de borrado, la biblioteca nunca debería tener MENOS
                // libros después de importar — si pasa, algo falló a medias.
                if (diff.deletedBooks === 0 && booksRef.current.length < countBefore) {
                    showNoticeToast('El backup se restauró, pero la biblioteca tiene menos libros que antes — revisa que no falte nada.', 'warning');
                } else {
                    showNoticeToast('Backup restaurado.', 'success');
                }
                recordBackupEvent({ type: 'import', fileName: pendingImport.fileName, bookCount: diff.totalIncomingBooks });
                setPendingImport(null);
            } catch (error) {
                console.warn('[SharkReader] Error restaurando backup:', error);
                showNoticeToast(error?.message || 'No se pudo restaurar el backup.', 'error');
            } finally {
                setImportBusy(false);
            }
        }, [pendingImport, importBusy, processFiles, recordBackupEvent, showNoticeToast]);


        const {
            displayedBooks,
            searchResultsWithMatches,
            libraryDerived,
            virtualLibrary,
            virtualSearchResults,
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
            shouldComputeAnnotations: sidebarOpen || showAnnotationsModal,
            annotationSearch,
            annotationBookFilter,
            tabs,
            folderImport,
        });

        const selectAll = useCallback(() => {
            setSelectedBookIds(new Set(displayedBooks.map(b => b.id)));
        }, [displayedBooks]);

        const compareSelectedBooks = useCallback(() => {
            if (selectedBookIds.size >= 2 && selectedBookIds.size <= 4) {
                setShowComparison(true);
            }
        }, [selectedBookIds.size]);


        const exportQuotesAsImage = () => {
            const allQuotes = books.flatMap(b =>
                (b.bookmarks || [])
                    .filter(bm => bm.note && bm.note.includes('[Subrayado]'))
                    .map(bm => ({
                        text: bm.note.replace('[Subrayado] ', '').replace(/^"(.*?)"\.\.\.$/, '$1').replace(/^"(.*?)"$/, '$1'),
                        book: b.name, author: b.author || '', date: bm.date || ''
                    }))
            );
            if (!allQuotes.length) { showNoticeToast('No tienes subrayados guardados. Selecciona texto mientras lees y activa el modo Subrayar.', 'warning'); return; }

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
                            {folderImportOverlay.phase === 'done' && !(folderImportOverlay.failedCount > 0) ? (
                                // Importación limpia (sin fallidos): estado compacto de "listo"
                                // en vez de repetir la barra + grilla de stats que ya no aportan nada.
                                <div className="p-5 md:p-6 flex items-center gap-4">
                                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-black uppercase tracking-[0.24em] opacity-60" style={{ color: '#22c55e' }}>
                                            {folderImportOverlay.folderName || 'Importación'}
                                        </p>
                                        <h3 className="mt-1 text-lg font-black leading-tight">{folderImportOverlay.title}</h3>
                                        <p className="mt-1 text-sm opacity-70">{folderImportOverlay.detail}</p>
                                    </div>
                                    <button
                                        onClick={() => { setFolderImport(null); setFailedImportRetryQueue([]); }}
                                        aria-label="Cerrar"
                                        className="rounded-full p-1.5 opacity-50 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5 flex-shrink-0"
                                    >
                                        <Icons.Close />
                                    </button>
                                </div>
                            ) : (
                            <div className="p-5 md:p-6">
                                <div className="flex items-start gap-4">
                                    <div className="folder-import-icon flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: 'color-mix(in srgb, var(--highlight) 15%, transparent)', color: 'var(--highlight)' }}>
                                        <Icons.FolderPlus />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-black uppercase tracking-[0.24em] opacity-60" style={{ color: 'var(--highlight)' }}>
                                            {folderImportOverlay.folderName || 'Importación'}
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
                                    {!folderImportOverlay.canCancel && !(folderImportOverlay.failedCount > 0) && (
                                        <button
                                            onClick={() => { setFolderImport(null); setFailedImportRetryQueue([]); }}
                                            aria-label="Cerrar"
                                            className="rounded-full p-1.5 opacity-50 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5 flex-shrink-0"
                                        >
                                            <Icons.Close />
                                        </button>
                                    )}
                                </div>

                                <div className="mt-5">
                                    <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] opacity-45">
                                        <span>{folderImportOverlay.phase === 'metadata' ? 'Metadatos' : folderImportOverlay.phase === 'importing' ? 'Importación' : 'Estado'}</span>
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
                                        <div className="mt-2 max-h-24 overflow-y-auto space-y-1 text-xs opacity-80">
                                            {(folderImportOverlay.failedFiles || []).slice(0, 6).map((item, index) => (
                                                <div key={`${item.name}-${index}`} className="flex items-center gap-2">
                                                    <span className="truncate flex-1 min-w-0">{item.name}</span>
                                                    <span className="flex-shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">{item.reason}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                            <button onClick={retryFailedFolderImports} className="rounded-xl bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 hover:bg-amber-200">Reintentar fallidos</button>
                                            <button onClick={() => { setFolderImport(null); setFailedImportRetryQueue([]); }} className="rounded-xl border px-3 py-2 text-xs font-bold opacity-80 hover:opacity-100" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}>Cerrar</button>
                                        </div>
                                    </div>
                                )}

                                    </div>
                            )}
                                </div>
                            </div>
                )}

                {view === 'library' && (
                    <div className="flex-shrink-0 flex items-center justify-between px-6 text-white shadow-lg topbar-glow z-20 h-16" style={{ backgroundColor: 'var(--topbar-bg)' }}>
                        <div className="flex items-center gap-5">
                            <Tooltip label="Menú">
                                <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menú lateral" className="p-2 hover:bg-black/20 rounded-full transition"><Icons.Menu /></button>
                            </Tooltip>
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
                                <input type="text" placeholder="Título, autor, serie, tags..." value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    onFocus={() => setSearchFocused(true)}
                                    onBlur={() => { setSearchFocused(false); commitRecentSearch(searchTerm); }}
                                    onKeyDown={e => { if (e.key === 'Enter') commitRecentSearch(searchTerm); }}
                                    className="w-full bg-transparent text-white placeholder-white/40 pl-10 pr-8 py-2 outline-none text-sm" />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda" className="absolute right-2 opacity-50 hover:opacity-100 transition text-white text-xl leading-none">×</button>
                                )}
                                {searchFocused && !searchTerm && recentSearches.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border shadow-2xl overflow-hidden z-30"
                                        style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
                                        <p className="px-3 pt-2.5 pb-1 text-[9px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--text-color)' }}>Búsquedas recientes</p>
                                        {recentSearches.map(term => (
                                            <div key={term}
                                                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition"
                                                style={{ color: 'var(--text-color)' }}
                                                onMouseDown={e => e.preventDefault()}>
                                                <span className="opacity-40 flex-shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Search /></span>
                                                <button className="flex-1 min-w-0 text-left truncate" onClick={() => { setSearchTerm(term); setSearchFocused(false); }}>{term}</button>
                                                <button aria-label={`Quitar "${term}" de recientes`} className="opacity-40 hover:opacity-100 transition text-xs leading-none flex-shrink-0" onClick={() => removeRecentSearch(term)}>×</button>
                                            </div>
                                        ))}
                                    </div>
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
                                    <Tooltip label="Vista cuadrícula">
                                        <button onClick={() => setLibraryView('grid')} aria-pressed={libraryView === 'grid'}
                                            className={`px-2 py-1 rounded-lg text-xs font-bold transition ${libraryView === 'grid' ? 'bg-white/20' : 'opacity-50 hover:opacity-80'}`}>⊞</button>
                                    </Tooltip>
                                    <Tooltip label="Vista lista">
                                        <button onClick={() => setLibraryView('list')} aria-pressed={libraryView === 'list'}
                                            className={`px-2 py-1 rounded-lg text-xs font-bold transition ${libraryView === 'list' ? 'bg-white/20' : 'opacity-50 hover:opacity-80'}`}>☰</button>
                                    </Tooltip>
                                    <Tooltip label="Vista series">
                                        <button onClick={() => setLibraryView('series')} aria-pressed={libraryView === 'series'}
                                            className={`px-2 py-1 rounded-lg text-xs font-bold transition ${libraryView === 'series' ? 'bg-white/20' : 'opacity-50 hover:opacity-80'}`}>📚</button>
                                    </Tooltip>
                                    <Tooltip label="Selección múltiple">
                                        <button onClick={() => { setIsSelecting(p => { if (p) clearSelection(); return !p; }); }} aria-pressed={isSelecting}
                                            className={`px-2 py-1 rounded-lg text-xs font-bold transition ${isSelecting ? 'bg-white/25' : 'opacity-50 hover:opacity-80'}`}>☑</button>
                                    </Tooltip>
                                </div>
                            </div>
                            <div className="flex gap-2 items-center mr-2">
                                <Tooltip label={t.addBook}>
                                    <button onClick={openFilePicker} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 md:px-4 py-2 rounded-xl transition font-semibold text-sm whitespace-nowrap"><Icons.Plus /> <span className="hidden xl:inline">{t.addBook}</span></button>
                                </Tooltip>
                                <Tooltip label={t.addFolder}>
                                    <button onClick={openFolderPicker} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 md:px-4 py-2 rounded-xl transition font-semibold text-sm whitespace-nowrap"><Icons.FolderPlus /> <span className="hidden xl:inline">{t.addFolder}</span></button>
                                </Tooltip>
                            </div>
                            {lastReadId && (
                                <button onClick={() => openBook(lastReadId)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-400 text-white shadow-md mr-2 whitespace-nowrap">
                                    <Icons.Play /> <span className="hidden lg:inline">{t.continueReading}</span>
                                </button>
                            )}
                            {addons.bookRoulette && books.length > 0 && (
                                <Tooltip label={lang === 'en' ? 'Spin the roulette to pick a random book' : 'Gira la ruleta para elegir un libro al azar'} className="hidden sm:inline-flex mr-2">
                                    <button onClick={spinBookRoulette} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-cyan-500 hover:bg-cyan-400 text-white shadow-md whitespace-nowrap">
                                        <Icons.Roulette className="h-4 w-4" /> <span className="hidden lg:inline">{lang === 'en' ? 'Roulette' : 'Ruleta'}</span>
                                    </button>
                                </Tooltip>
                            )}
                            <Tooltip label="Anotaciones" className="mr-1">
                                <button onClick={() => setShowAnnotationsModal(true)} aria-label="Anotaciones"
                                    className="p-2 hover:bg-black/20 rounded-full transition">
                                    <Icons.Bookmark />
                                </button>
                            </Tooltip>
                            <div className="relative z-50">
                                {!userProfile ? (
                                    <button onClick={() => setShowLoginModal(true)} className="bg-orange-500 hover:bg-orange-400 text-white font-bold py-2 px-4 rounded-full shadow-lg transition text-sm whitespace-nowrap">{t.loginBtn}</button>
                                ) : (
                                    <>
                                        <Tooltip label={
                                            syncStatus === 'syncing' ? 'Sincronizando…'
                                                : syncStatus === 'error' ? 'Error al sincronizar'
                                                : syncStatus === 'synced' ? 'Sincronizado'
                                                : null
                                        }>
                                            <button onClick={e => { e.stopPropagation(); setShowUserMenu(p => !p); }} className="relative p-1 hover:bg-black/20 rounded-full transition flex items-center justify-center">
                                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-lg shadow-md border-2 border-white/20 overflow-hidden">{renderAvatar(userProfile.avatar)}</div>
                                                {(syncFolder || webdavConfig?.url) && (
                                                    <span
                                                        className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--topbar-bg)] ${syncStatus === 'syncing' ? 'animate-pulse' : ''}`}
                                                        style={{ backgroundColor: syncStatus === 'error' ? '#ef4444' : syncStatus === 'syncing' ? '#f59e0b' : '#22c55e' }}
                                                    />
                                                )}
                                            </button>
                                        </Tooltip>
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
                <input type="file" accept=".json,.zip" ref={importInputRef} className="hidden" onChange={importData} />
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
                    onOpenLibraryIntel={() => setShowLibraryIntel(true)}
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
                    createSmartCollection={createSmartCollection}
                    removeManualCollection={removeManualCollection}
                    renameManualCollection={renameManualCollection}
                    moveManualCollection={moveManualCollection}
                    reorderManualCollection={reorderManualCollection}
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
                    addons={addons}
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
                        virtualSearchResults={virtualSearchResults}
                        displayedBooks={displayedBooks}
                        libraryBookCount={libraryDerived.counts.all}
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
                        setDraggedBookId={setDraggedBookId}
                        setDropTargetCat={setDropTargetCat}
                        bulkToggleFav={bulkToggleFav}
                        bulkMarkFinished={bulkMarkFinished}
                        bulkAssignCategory={bulkAssignCategory}
                        bulkAssignAuthor={bulkAssignAuthor}
                        bulkAssignSeries={bulkAssignSeries}
                        onCompareBooks={compareSelectedBooks}
                        bulkDeleteBooks={bulkDeleteBooks}
                        bulkAddToCollection={bulkAddToCollection}
                        customCategories={customCategories}
                        manualCollections={manualCollections}
                    />
                )}
                {/* ── CONTEXT MENU ── */}
                {contextMenu && (
                    <div className="absolute shadow-2xl rounded-2xl py-2 z-50 text-sm border backdrop-blur-xl fade-in" style={{ top: contextMenu.y, left: contextMenu.x, backgroundColor: 'var(--surface-bg)', color: 'var(--text-color)', borderColor: 'var(--border-color)', minWidth: '240px' }}>
                        <p className="truncate px-5 pb-2 pt-1 text-[10px] font-black uppercase tracking-widest opacity-40">{contextMenu.book.name}</p>
                        <div className="border-t mb-1" style={{ borderColor: 'var(--border-color)' }}></div>
                        <button onClick={() => { setActiveBookModal(contextMenu.book); setContextMenu(null); }} className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 font-semibold transition"><Icons.Info /> {t.bookInfo}</button>
                        <button onClick={() => { fetchOpenLibraryMeta(contextMenu.book); setContextMenu(null); }} className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 font-semibold transition [&>svg]:h-5 [&>svg]:w-5 [&>svg]:flex-shrink-0"><Icons.Search /> Buscar info (OpenLibrary)</button>
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

                {showComparison && (
                    <BookComparisonModal
                        books={books.filter(b => selectedBookIds.has(b.id))}
                        onClose={() => setShowComparison(false)}
                    />
                )}

                {showLibraryIntel && (
                    <LibraryIntelligenceModal
                        books={books}
                        onClose={() => setShowLibraryIntel(false)}
                        onOpenBook={openBook}
                        onApplySeries={applySeriesCandidate}
                        onDeleteBooks={deleteBooksByIds}
                    />
                )}

                {showAnnotationsModal && (
                    <AnnotationsModal
                        onClose={() => setShowAnnotationsModal(false)}
                        openBook={openBook}
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
                        t={t}
                    />
                )}

                {pendingImport && (
                    <BackupPreviewModal
                        pendingImport={pendingImport}
                        busy={importBusy}
                        onConfirm={confirmPendingImport}
                        onCancel={cancelPendingImport}
                    />
                )}

                {libraryRepairScan && (
                    <LibraryRepairModal
                        scan={libraryRepairScan}
                        loading={libraryRepairLoading}
                        onClose={closeLibraryRepair}
                        onOpenBook={(id) => { openBook(id); closeLibraryRepair(); }}
                        onFetchCover={(id) => { const book = booksById.get(id); if (book) fetchOpenLibraryMeta(book); }}
                        onDeleteBooks={deleteBooksByIds}
                        onDeleteOrphan={deleteOrphanedFile}
                        onRescan={runLibraryRepairScan}
                    />
                )}

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
                        aiTestStatus={aiTestStatus} aiTestMessage={aiTestMessage}
                        onTestAIConnection={testAIConnection} onResetAITestStatus={resetAITestStatus}
                        syncFolder={syncFolder} setSyncFolder={setSyncFolder}
                        webdavConfig={webdavConfig} setWebdavConfig={setWebdavConfig}
                        accentColor={accentColor} setAccentColor={setAccentColor}
                        highContrast={highContrast} setHighContrast={setHighContrast}
                        uiScale={uiScale} setUiScale={setUiScale}
                        tutorialEnabled={tutorialEnabled} setTutorialEnabled={setTutorialEnabled}
                        onRestartTutorial={restartTutorial}
                        onExportDiagnostics={exportDiagnostics}
                        onClearDiagnostics={clearDiagnostics}
                        onExportZipBackup={exportZipBackup}
                        onExportLibraryOnly={exportLibraryOnly}
                        onExportSettingsOnly={exportSettingsOnly}
                        onOpenLibraryRepair={runLibraryRepairScan}
                        backupHistory={backupHistory}
                        importHistory={importHistory}
                        onDeleteAccount={deleteAccountAndData}
                        addons={addons}
                        addonConfig={addonConfig}
                        onToggleAddon={toggleAddon}
                        onUpdateAddonConfig={updateAddonConfig}
                        onOpenWorkshop={() => { setSettingsOpen(false); setShowWorkshop(true); }}
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
                                challenges={challenges}
                                onAddChallenge={addChallenge}
                                onRemoveChallenge={removeChallenge}
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
                                            key={currentBookData.id}
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
                                            tabs={tabs}
                                            activeTabId={activeTabId}
                                            allBooks={readerTabBooks}
                                            onSwitchTab={switchReaderTab}
                                            onCloseTab={closeTab}
                                            onGoToLibrary={() => setView('library')}
                                            onToggleSpread={toggleSpreadLayout}
                                            onPersistReaderPreferences={persistEpubReaderPreferences}
                                        />
                                    </Suspense>
                                </EpubReaderBoundary>
                            ) : (
                                <EpubReaderBoundary onClose={closeBook} resetKey={currentBookData.id}>
                                    <Suspense fallback={readerLoader(`Abriendo ${currentBookData.name || 'documento'}...`)}>
                                        <PdfReader
                                        key={currentBookData.id}
                                        bookData={stableCurrentBookData}
                                        targetPage={currentTargetCfi}
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
                                    <button onClick={() => { setPanelMode(false); setRightTabId(null); }} aria-label="Cerrar panel dividido" className="ml-auto px-2 text-white/40 hover:text-white transition text-lg">×</button>
                                </div>
                                {rightBookData.type === 'epub' ? (
                                    <EpubReaderBoundary onClose={() => { setPanelMode(false); setRightTabId(null); }} resetKey={rightBookData.id}>
                                        <Suspense fallback={readerLoader(`Abriendo ${rightBookData.name || 'libro'}...`)}>
                                            <EpubReader
                                            key={rightBookData.id}
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
                                            onToggleSpread={toggleSpreadLayout}
                                            onPersistReaderPreferences={persistEpubReaderPreferences}
                                            />
                                        </Suspense>
                                    </EpubReaderBoundary>
                                ) : (
                                    <EpubReaderBoundary onClose={() => { setPanelMode(false); setRightTabId(null); }} resetKey={rightBookData.id}>
                                        <Suspense fallback={readerLoader(`Abriendo ${rightBookData.name || 'documento'}...`)}>
                                            <PdfReader
                                            key={rightBookData.id}
                                            bookData={stableRightBookData}
                                            targetPage={tabTargetCfi[rightTabId] || null}
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
                            addonHistory={addonHistory}
                            lang={lang}
                        />
                    </PanelErrorBoundary>
                )}

                {roulettePool && (
                    <BookRouletteModal
                        pool={roulettePool}
                        winner={rouletteBook}
                        onResult={handleRouletteResult}
                        onRespin={() => setRouletteBook(null)}
                        onClose={closeBookRoulette}
                        onOpenBook={(id) => { openBook(id); closeBookRoulette(); }}
                        lang={lang}
                    />
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
                        <button onClick={() => setDraggedBookId(null)} aria-label="Cancelar arrastre" className="ml-2 opacity-40 hover:opacity-100 transition text-lg leading-none">×</button>
                    </div>
                )}

                {/* ── ACHIEVEMENT TOAST ── */}
                {achievementToast && userProfile && (() => {
                    const r = RARITY[achievementToast.rarity];
                    return (
                        <div className="fixed top-6 right-6 z-[9999]" style={{ animation: 'fadeInUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                            <div role="status" aria-live="polite" className="achievement-toast-card flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border"
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

                {/* ── PALETA DE COMANDOS (Ctrl+K) ── */}
                <CommandPalette
                    open={commandPaletteOpen}
                    onClose={() => setCommandPaletteOpen(false)}
                    books={books}
                    lastReadId={lastReadId}
                    openBook={openBook}
                    setView={setView}
                    setSettingsOpen={setSettingsOpen}
                    setShowWorkshop={setShowWorkshop}
                    setShowAnnotationsModal={setShowAnnotationsModal}
                    setTheme={setTheme}
                    exportZipBackup={exportZipBackup}
                    spinBookRoulette={spinBookRoulette}
                    openFilePicker={openFilePicker}
                    openFolderPicker={openFolderPicker}
                    onOpenLibraryRepair={runLibraryRepairScan}
                    lang={lang}
                />

                {/* ── ¿SABÍAS QUE? TIP TOAST ── */}
                {activeTip && !activeTabId && (
                    <div className="fixed bottom-6 right-6 z-[9997]">
                        <TipToast tip={activeTip} onClose={() => setActiveTip(null)} />
                    </div>
                )}

                {noticeToast && (
                    <div className="fixed bottom-6 left-6 z-[9998]" style={{ animation: 'fadeInUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                        <div
                            role="status" aria-live="polite"
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
                                    {noticeToast.tone === 'warning' ? 'Importación' : 'Aviso'}
                                </p>
                                <p className="mt-1 text-sm font-semibold opacity-85">{noticeToast.message}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── READING JOURNAL MODAL ── */}
                {showJournalModal && (
                    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-in" onClick={() => setShowJournalModal(false)}>
                        <div role="dialog" aria-modal="true" aria-label="Reading Journal" className="bg-[var(--surface-bg)] w-full max-w-md rounded-3xl shadow-2xl border border-[var(--border-color)] flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-6 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                                <h2 className="font-black text-xl flex items-center gap-2">📓 Reading Journal</h2>
                                <button onClick={() => setShowJournalModal(false)} aria-label="Cerrar diario de lectura" className="p-2 opacity-60 hover:opacity-100 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition">✕</button>
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
