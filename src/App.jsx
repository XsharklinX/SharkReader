// SharkReader - App Component (v2 — Tabs + Optimizations + Series + Vocab + AI)
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ePub from 'epubjs';
import { Icons, renderAvatar } from './icons';
import { translations, languageNames, RANDOM_EMOJIS } from './translations';
import { safeParse, loadFilesFromDB, saveFileToDB, deleteFileFromDB, fileToBase64, saveAppData, loadAppData } from './db';
import EpubReader from './EpubReader';
import PdfReader from './PdfReader';
import AnalyticsView from './AnalyticsView';
import WorkshopPanel from './WorkshopPanel';
import SettingsPanel from './SettingsPanel';
import UserMenu from './UserMenu';
import { checkNewAchievements, ACHIEVEMENTS, RARITY } from './achievements';
import { useBooks } from './hooks/useBooks';
import BookCard from './BookCard';
import TabBar from './TabBar';
import { EpubReaderBoundary, ErrorBoundary } from './ErrorBoundaries';


    // ─────────────────────────────────────────
    // APP PRINCIPAL
    // ─────────────────────────────────────────
    const App = () => {
        const initialBooksMeta = safeParse('sharkreader_meta', {});

        // ── LIBROS ──
        const [books, setBooks] = useState([]);
        const [isDbLoaded, setIsDbLoaded] = useState(false);

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
        const [customCategories, setCustomCategories] = useState(() => {
            const s = safeParse('sharkreader_categories', null);
            return (s && Array.isArray(s)) ? s.filter(c => c.toLowerCase() !== 'favoritos') : ['Pendientes', 'Estudio'];
        });
        const [currentFilter, setCurrentFilter] = useState('all');
        const [sortBy, setSortBy] = useState('lastRead');
        const [activeBookModal, setActiveBookModal] = useState(null);
        const [contextMenu, setContextMenu] = useState(null);
        const [isDragging, setIsDragging] = useState(false);

        // ── USUARIO / STATS ──
        const [userProfile, setUserProfile] = useState(() => safeParse('sharkreader_user', null));
        const [stats, setStats] = useState(() => safeParse('sharkreader_stats', null) || {
            timeRead: 0, pagesTurned: 0, streak: 0, lastStreakDate: '',
            currentDailyMins: 0, lastActiveDate: '', streakSavers: 0, history: {}, minutesByDay: {}
        });
        const [showLoginModal, setShowLoginModal] = useState(false);
        const [showUserMenu, setShowUserMenu] = useState(false);
        const [tempLoginName, setTempLoginName] = useState('');
        const [tempLoginAvatar, setTempLoginAvatar] = useState('🦈');
        const [showEditProfileModal, setShowEditProfileModal] = useState(false);
        const [tempEditName, setTempEditName] = useState('');
        const [tempEditAvatar, setTempEditAvatar] = useState('');
        const [showStreakModal, setShowStreakModal] = useState(false);
        const [showSaverInfo, setShowSaverInfo] = useState(false);

        // ── UI ──
        const [sidebarOpen, setSidebarOpen] = useState(false);
        const [libraryView, setLibraryView] = useState(() => safeParse('sharkreader_libview', 'grid'));
        const [settingsOpen, setSettingsOpen] = useState(false);

        const [isFullscreen, setIsFullscreen] = useState(false);

        // ── PREFERENCIAS ──
        const [theme, setTheme] = useState(() => safeParse('sharkreader_theme', 'dark'));
        const [lang, setLang] = useState(() => safeParse('sharkreader_lang', 'es'));
        const [readFlow, setReadFlow] = useState(() => safeParse('sharkreader_flow', 'paginated'));
        const [readLayout, setReadLayout] = useState(() => safeParse('sharkreader_layout', 'none'));
        const [pageTransition, setPageTransition] = useState(() => localStorage.getItem('page_transition') || 'slide');
        const [warmMode, setWarmMode] = useState(() => safeParse('sharkreader_warm', false));

        // ── VOCABULARIO ──
        const [vocabulary, setVocabulary] = useState(() => safeParse('sharkreader_vocab', []));
        const [showVocabPanel, setShowVocabPanel] = useState(false);
        const [vocabSearch, setVocabSearch] = useState('');

        // ── AI ──
        const [aiProvider, setAiProvider] = useState(() => safeParse('sharkreader_ai_provider', 'groq'));
        const [aiApiKey, setAiApiKey] = useState(() => safeParse('sharkreader_ai_key', ''));

        // ── SYNC CARPETA LOCAL ──
        const [syncFolder, setSyncFolder] = useState(() => safeParse('sharkreader_sync_folder', ''));

        // ── ACCENT COLOR ──
        const [accentColor, setAccentColor] = useState(() => safeParse('sharkreader_accent', null));

        // ── DRAG & DROP ──
        const [draggedBookId, setDraggedBookId] = useState(null);
        const [dropTargetCat, setDropTargetCat] = useState(null);

        // ── SMART FOLDERS ──
        const [showAuthorSection, setShowAuthorSection] = useState(false);

        // ── ANIVERSARIOS ──
        const [anniversaryInfo, setAnniversaryInfo] = useState(null);

        // ── OBJETIVOS ──
        const [dailyGoalMins, setDailyGoalMins] = useState(() => safeParse('sharkreader_daily_goal', 30));
        const [yearlyGoal, setYearlyGoal] = useState(() => safeParse('sharkreader_yearly_goal', 12));

        // ── REFS ──
        const fileInputRef = useRef(null);
        const folderInputRef = useRef(null);
        const importInputRef = useRef(null);
        const avatarInputRef = useRef(null);
        const persistTimerRef = useRef(null);       // books debounce
        const persistStatsRef = useRef(null);       // stats debounce
        const persistSettingsRef = useRef(null);    // settings debounce
        const activeBookIdRef = useRef(null);

        // ── LOGROS / WORKSHOP / ANALYTICS ──
        const [achievements, setAchievements] = useState(() => safeParse('sharkreader_achievements', {}));
        const [addons, setAddons] = useState(() => safeParse('sharkreader_addons', {}));
        const addonsRef = useRef({});
        const [showWorkshop, setShowWorkshop] = useState(false);
        const [achievementToast, setAchievementToast] = useState(null);
        const [journalEntries, setJournalEntries] = useState(() => safeParse('sharkreader_journal', []));
        const [showJournalModal, setShowJournalModal] = useState(false);

        const t = translations[lang] || translations['es'];

        // ─────────────────────────────────────────
        // EFECTOS
        // ─────────────────────────────────────────
        useEffect(() => {
            document.body.className = `theme-${theme}`;
            setStats(prev => {
                const used = new Set(prev.themesUsed || []);
                used.add(theme);
                if (used.size === (prev.themesUsed || []).length) return prev;
                return { ...prev, themesUsed: [...used] };
            });
        }, [theme]);

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
            }
        }, [accentColor]);

        // Cargar libros desde IndexedDB
        useEffect(() => {
            const safetyTimer = setTimeout(() => {
                const loader = document.getElementById('shark-preloader');
                if (loader) { loader.style.opacity = '0'; loader.style.visibility = 'hidden'; }
            }, 5000);
            loadFilesFromDB().then(storedFiles => {
                const meta = safeParse('sharkreader_meta', {});
                const loaded = storedFiles.map(stored => {
                    const key = stored.originalTitle + '|' + stored.originalAuthor;
                    const m = meta[key] || {};
                    return {
                        id: stored.id,
                        name: m.customTitle || stored.originalTitle,
                        author: m.customAuthor || stored.originalAuthor,
                        originalTitle: stored.originalTitle,
                        originalAuthor: stored.originalAuthor,
                        description: m.description || '',
                        publisher: m.publisher || '',
                        tags: m.tags || '',
                        series: m.series || '',
                        seriesIndex: m.seriesIndex || 0,
                        file: stored.file,
                        type: stored.file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub',
                        url: URL.createObjectURL(stored.file),
                        coverUrl: m.customCover || stored.coverBase64,
                        color: `hsl(${(parseInt(String(stored.id).slice(-3), 16) || 0) % 360}, 70%, 40%)`,
                        isFav: m.isFav || false,
                        rating: m.rating || 0,
                        progress: m.progress || 0,
                        lastLocation: m.lastLocation || null,
                        dateAdded: m.dateAdded || stored.dateAdded || Date.now(),
                        lastReadDate: m.lastReadDate || 0,
                        bookmarks: m.bookmarks || [],
                        notes: m.notes || '',
                        isFinished: m.isFinished || false,
                        dateStarted: m.dateStarted || null,
                        dateFinished: m.dateFinished || null,
                        readingMinutes: m.readingMinutes || 0,
                        category: m.category || null,
                        loading: false
                    };
                });
                setBooks(loaded);
                setIsDbLoaded(true);
                clearTimeout(safetyTimer);
                setTimeout(() => {
                    const loader = document.getElementById('shark-preloader');
                    if (loader) { loader.style.opacity = '0'; setTimeout(() => { loader.style.visibility = 'hidden'; }, 400); }
                }, 300);
            }).catch(() => {
                clearTimeout(safetyTimer);
                const loader = document.getElementById('shark-preloader');
                if (loader) { loader.style.opacity = '0'; loader.style.visibility = 'hidden'; }
            });
        }, []);

        // Cargar datos pesados desde IDB (async, override de localStorage si hay datos más recientes)
        useEffect(() => {
            loadAppData('stats').then(s => { if (s) setStats(s); });
            loadAppData('journalEntries').then(j => { if (j) setJournalEntries(j); });
            loadAppData('vocabulary').then(v => { if (v) setVocabulary(v); });
        }, []);

        // ── PERSIST: books + categories (debounce 2000ms + idle so it never blocks reading)
        useEffect(() => {
            if (!isDbLoaded) return;
            clearTimeout(persistTimerRef.current);
            persistTimerRef.current = setTimeout(() => {
                // Use requestIdleCallback so JSON serialization doesn't block page turns
                const doSave = () => {
                    const metaToSave = {};
                    books.forEach(b => {
                        if (b.loading) return;
                        const k = b.originalTitle + '|' + b.originalAuthor;
                        metaToSave[k] = {
                            progress: b.progress, lastLocation: b.lastLocation, lastReadDate: b.lastReadDate,
                            bookmarks: b.bookmarks, notes: b.notes || '',
                            isFinished: b.isFinished || false, dateStarted: b.dateStarted || null,
                            dateFinished: b.dateFinished || null, readingMinutes: b.readingMinutes || 0,
                            category: b.category, customTitle: b.name,
                            customAuthor: b.author, customCover: b.coverUrl, description: b.description,
                            publisher: b.publisher, tags: b.tags, isFav: b.isFav, rating: b.rating || 0,
                            dateAdded: b.dateAdded, series: b.series || '', seriesIndex: b.seriesIndex || 0
                        };
                    });
                    localStorage.setItem('sharkreader_meta', JSON.stringify(metaToSave));
                    localStorage.setItem('sharkreader_categories', JSON.stringify(customCategories));
                    if (syncFolder && window.electronAPI) {
                        const syncData = JSON.stringify({ meta: metaToSave, exportedAt: new Date().toISOString() }, null, 2);
                        window.electronAPI.writeSyncFile(syncFolder, syncData).catch(() => {});
                    }
                };
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(doSave, { timeout: 5000 });
                } else {
                    doSave();
                }
            }, 2000);
            return () => clearTimeout(persistTimerRef.current);
        }, [books, customCategories, isDbLoaded, syncFolder]);

        // ── PERSIST: stats only (changes every page turn + every 60s — debounce 3000ms)
        useEffect(() => {
            if (!isDbLoaded) return;
            clearTimeout(persistStatsRef.current);
            persistStatsRef.current = setTimeout(() => {
                localStorage.setItem('sharkreader_stats', JSON.stringify(stats));
                saveAppData('stats', stats);
            }, 3000);
            return () => clearTimeout(persistStatsRef.current);
        }, [stats, isDbLoaded]);

        // ── PERSIST: settings (change only on user interaction — debounce 1000ms)
        useEffect(() => {
            if (!isDbLoaded) return;
            clearTimeout(persistSettingsRef.current);
            persistSettingsRef.current = setTimeout(() => {
                if (userProfile) localStorage.setItem('sharkreader_user', JSON.stringify(userProfile));
                else localStorage.removeItem('sharkreader_user');
                localStorage.setItem('sharkreader_theme', JSON.stringify(theme));
                localStorage.setItem('sharkreader_lang', JSON.stringify(lang));
                localStorage.setItem('sharkreader_flow', JSON.stringify(readFlow));
                localStorage.setItem('sharkreader_layout', JSON.stringify(readLayout));
                localStorage.setItem('sharkreader_warm', JSON.stringify(warmMode));
                localStorage.setItem('sharkreader_vocab', JSON.stringify(vocabulary));
                saveAppData('vocabulary', vocabulary);
                localStorage.setItem('sharkreader_ai_provider', JSON.stringify(aiProvider));
                localStorage.setItem('sharkreader_ai_key', JSON.stringify(aiApiKey));
                localStorage.setItem('sharkreader_sync_folder', JSON.stringify(syncFolder));
                localStorage.setItem('sharkreader_libview', JSON.stringify(libraryView));
                localStorage.setItem('sharkreader_daily_goal', JSON.stringify(dailyGoalMins));
                localStorage.setItem('sharkreader_yearly_goal', JSON.stringify(yearlyGoal));
                localStorage.setItem('sharkreader_achievements', JSON.stringify(achievements));
                localStorage.setItem('sharkreader_addons', JSON.stringify(addons));
                localStorage.setItem('sharkreader_journal', JSON.stringify(journalEntries));
                saveAppData('journalEntries', journalEntries);
            }, 1000);
            return () => clearTimeout(persistSettingsRef.current);
        }, [userProfile, theme, lang, readFlow, readLayout, warmMode, vocabulary, aiProvider, aiApiKey,
            syncFolder, libraryView, dailyGoalMins, yearlyGoal, achievements, addons, journalEntries, isDbLoaded]);

        // Cleanup blob URLs al desmontar
        useEffect(() => {
            return () => { books.forEach(b => { if (b.url) URL.revokeObjectURL(b.url); }); };
        }, []);

        // Listeners globales
        useEffect(() => {
            const closeCtx = () => setContextMenu(null);
            const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
            window.addEventListener('click', closeCtx);
            document.addEventListener('fullscreenchange', handleFs);
            return () => { window.removeEventListener('click', closeCtx); document.removeEventListener('fullscreenchange', handleFs); };
        }, []);

        // IPC: abrir archivo desde Windows (asociación de archivos)
        useEffect(() => {
            if (!window.electronAPI) return;
            const handler = async (filePath) => {
                if (!filePath) return;
                const resp = await fetch(filePath.startsWith('file://') ? filePath : `file:///${filePath.replace(/\\/g, '/')}`);
                const blob = await resp.blob();
                const file = new File([blob], filePath.split(/[\\/]/).pop(), { type: blob.type });
                await processFiles([file]);
            };
            window.electronAPI.onOpenFile(handler);
            return () => window.electronAPI.offOpenFile();
        }, []);

        // Racha de lectura + minutos por libro
        useEffect(() => {
            let interval;
            if (view === 'reader' && userProfile) {
                interval = setInterval(() => {
                    const today = new Date();
                    const todayStr = today.toDateString();
                    // Actualizar stats globales — un solo setStats para evitar dos re-renders por minuto
                    const hour = today.getHours();
                    setStats(prev => {
                        let { timeRead = 0, pagesTurned = 0, streak = 0, currentDailyMins = 0, lastActiveDate = '', streakSavers = 0, history = {}, minutesByDay = {}, hourlyLog = {} } = prev;
                        timeRead++;
                        minutesByDay = { ...minutesByDay, [todayStr]: (minutesByDay[todayStr] || 0) + 1 };
                        hourlyLog = { ...hourlyLog, [hour]: (hourlyLog[hour] || 0) + 1 };
                        if (lastActiveDate !== todayStr) { currentDailyMins = 1; lastActiveDate = todayStr; }
                        else { currentDailyMins++; }
                        if (currentDailyMins === 5 && history[todayStr] !== 'read') {
                            const dates = Object.keys(history).filter(k => history[k] === 'read' || history[k] === 'saved').sort((a, b) => new Date(a) - new Date(b));
                            const lastDateStr = dates[dates.length - 1];
                            if (lastDateStr) {
                                const lastDate = new Date(lastDateStr); lastDate.setHours(0, 0, 0, 0);
                                const todayMidnight = new Date(today); todayMidnight.setHours(0, 0, 0, 0);
                                const diffDays = Math.round((todayMidnight - lastDate) / 86400000);
                                if (diffDays === 1) { streak++; }
                                else if (diffDays > 1) {
                                    const missed = diffDays - 1;
                                    if (streakSavers >= missed) {
                                        streakSavers -= missed; streak++;
                                        for (let i = 1; i <= missed; i++) {
                                            const d = new Date(lastDateStr); d.setDate(d.getDate() + i);
                                            history[d.toDateString()] = 'saved';
                                        }
                                    } else { streak = 1; streakSavers = 0; }
                                }
                            } else { streak = 1; }
                            history[todayStr] = 'read';
                            if (streak > 0 && streak % 5 === 0) streakSavers = Math.min(2, streakSavers + 1);
                        }
                        return { timeRead, pagesTurned, streak, currentDailyMins, lastActiveDate, streakSavers, history, minutesByDay, hourlyLog };
                    });
                    // Acumular minuto en el libro activo
                    if (activeBookIdRef.current) {
                        setBooks(prev => prev.map(b => {
                            if (b.id !== activeBookIdRef.current) return b;
                            return {
                                ...b,
                                readingMinutes: (b.readingMinutes || 0) + 1,
                                dateStarted: b.dateStarted || Date.now()
                            };
                        }));
                    }
                }, 60000);
            }
            return () => clearInterval(interval);
        }, [view, userProfile]);

        // Mantener ref del libro activo para el timer de racha
        useEffect(() => {
            const tab = tabs.find(t => t.id === activeTabId);
            activeBookIdRef.current = tab?.bookId || null;
        }, [activeTabId, tabs]);

        // Detectar aniversarios de lectura al abrir libro (solo para libros ya empezados)
        useEffect(() => {
            if (!lastReadId) return;
            const bk = books.find(b => b.id === lastReadId);
            // Solo mostrar si el libro ha sido leído al menos 1 minuto
            if (!bk || !bk.dateStarted || !(bk.readingMinutes > 0)) return;
            const daysSince = Math.floor((Date.now() - bk.dateStarted) / 86400000);
            const milestones = [7, 14, 30, 60, 100, 180, 365];
            if (milestones.includes(daysSince)) {
                setAnniversaryInfo({ name: bk.name, days: daysSince, readingMinutes: bk.readingMinutes || 0 });
            }
        }, [lastReadId]); // eslint-disable-line

        // Comprobar logros cuando cambian stats o libros
        useEffect(() => {
            if (!isDbLoaded || !userProfile) return;
            const context = { stats, books, vocabulary, achievements, addons, yearlyGoal };
            const newOnes = checkNewAchievements(context, achievements);
            if (!newOnes.length) return;
            const now = Date.now();
            const updated = { ...achievements };
            newOnes.forEach(a => { updated[a.id] = { unlockedAt: now }; });
            setAchievements(updated);
            localStorage.setItem('sharkreader_achievements', JSON.stringify(updated));
            // Show toast for the first new achievement
            setAchievementToast(newOnes[0]);
            setTimeout(() => setAchievementToast(null), 4000);
        }, [stats, books, vocabulary, addons]); // eslint-disable-line

        // ─────────────────────────────────────────
        // TABS
        // ─────────────────────────────────────────
        const openBook = useCallback((bookId, cfi = null) => {
            const existing = tabs.find(t => t.bookId === bookId);
            if (existing) {
                setActiveTabId(existing.id);
                if (cfi) setTabTargetCfi(p => ({ ...p, [existing.id]: cfi }));
                setView('reader');
                return;
            }
            const tabId = 'tab_' + Date.now();
            setTabs(prev => [...prev, { id: tabId, bookId }]);
            setActiveTabId(tabId);
            if (cfi) setTabTargetCfi(p => ({ ...p, [tabId]: cfi }));
            setLastReadId(bookId);
            setBooks(prev => prev.map(b => {
                if (b.id !== bookId) return b;
                return { ...b, lastReadDate: Date.now(), dateStarted: b.dateStarted || Date.now() };
            }));
            setView('reader');
        }, [tabs]);

        const closeTab = useCallback((tabId, e) => {
            if (e) { e.stopPropagation(); e.preventDefault(); }
            if (!tabId) return;
            // On close: Reading Journal + Auto Bookmark (use addonsRef to avoid stale closure)
            setBooks(booksSnap => {
                const closingTab = tabs.find(t => t.id === tabId);
                if (closingTab) {
                    const book = booksSnap.find(b => b.id === closingTab.bookId);
                    if (book) {
                        if (addonsRef.current.readingJournal && book.readingMinutes > 0) {
                            addJournalEntry(book.name, book.readingMinutes, book.progress || 0);
                        }
                        if (addonsRef.current.autoBookmark && book.lastLocation) {
                            // Auto-bookmark current position if not already bookmarked there
                            const alreadyBookmarked = book.bookmarks?.some(bm => bm.cfi === book.lastLocation);
                            if (!alreadyBookmarked) {
                                const autoMark = { cfi: book.lastLocation, note: `📌 Auto — ${new Date().toLocaleDateString()}`, date: new Date().toLocaleDateString() };
                                return booksSnap.map(b => b.id === closingTab.bookId ? { ...b, bookmarks: [...(b.bookmarks || []), autoMark] } : b);
                            }
                        }
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
        }, [activeTabId, rightTabId]);

        const closeBook = useCallback(() => {
            closeTab(activeTabId);
            if (document.fullscreenElement) document.exitFullscreen();
        }, [activeTabId, closeTab]);

        const activeTab = tabs.find(t => t.id === activeTabId);
        const currentBookData = useMemo(() => activeTab ? books.find(b => b.id === activeTab.bookId) : null, [activeTab, books]);
        const currentTargetCfi = tabTargetCfi[activeTabId] || null;
        const rightBookData = useMemo(() => {
            if (!panelMode || !rightTabId) return null;
            const rt = tabs.find(t => t.id === rightTabId);
            return rt ? books.find(b => b.id === rt.bookId) : null;
        }, [panelMode, rightTabId, tabs, books]);

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
        const handleRandomEmoji = () => setTempLoginAvatar(RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)]);

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

        const assignBookCategory = useCallback((bookId, category) => {
            setBooks(prev => prev.map(b => b.id === bookId ? { ...b, category } : b));
            setDraggedBookId(null);
            setDropTargetCat(null);
        }, []);

        const toggleAddon = (id) => {
            setAddons(prev => {
                const updated = { ...prev, [id]: !prev[id] };
                addonsRef.current = updated;
                localStorage.setItem('sharkreader_addons', JSON.stringify(updated));
                return updated;
            });
        };
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
            // Only remind if more than 1 hour has passed since last session
            if (hoursSincePrev < 1) return;
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
        }, [addons.reminders, userProfile]);

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

        const exportAllData = () => {
            if (!userProfile) { alert("Inicia sesión para exportar."); return; }
            const data = { meta: safeParse('sharkreader_meta', {}), categories: safeParse('sharkreader_categories', []), stats: safeParse('sharkreader_stats', {}), user: safeParse('sharkreader_user', {}) };
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            const a = document.createElement('a'); a.href = url; a.download = `SharkReader_Backup_${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url);
        };
        const importData = (e) => {
            const f = e.target.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = ev => {
                try {
                    const d = JSON.parse(ev.target.result);
                    if (d.meta) localStorage.setItem('sharkreader_meta', JSON.stringify(d.meta));
                    if (d.categories) localStorage.setItem('sharkreader_categories', JSON.stringify(d.categories));
                    if (d.stats) localStorage.setItem('sharkreader_stats', JSON.stringify(d.stats));
                    if (d.user) localStorage.setItem('sharkreader_user', JSON.stringify(d.user));
                    alert("Datos restaurados. Recargando..."); window.location.reload();
                } catch (_) { alert("Archivo inválido."); }
            };
            r.readAsText(f); e.target.value = '';
        };

        // ─────────────────────────────────────────
        // ARCHIVOS
        // ─────────────────────────────────────────
        const handleDragOver = (e) => { e.preventDefault(); if (view === 'library') setIsDragging(true); };
        const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); };
        const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); if (view !== 'library') return; processFiles(Array.from(e.dataTransfer.files)); };
        const handleFilesUpload = async (e) => { await processFiles(Array.from(e.target.files)); if (fileInputRef.current) fileInputRef.current.value = ''; if (folderInputRef.current) folderInputRef.current.value = ''; };

        const processFiles = async (files) => {
            const valid = files.filter(f => /\.(epub|pdf)$/i.test(f.name));
            if (!valid.length) { alert("Solo se aceptan archivos .epub y .pdf"); return; }
            const loader = document.getElementById('shark-preloader');
            if (loader) { loader.style.visibility = 'visible'; loader.style.opacity = '1'; }
            const placeholders = valid.map(file => ({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                name: file.name.replace(/\.[^/.]+$/, ''), author: 'Cargando...',
                description: '', publisher: '', tags: '', series: '', seriesIndex: 0,
                file, type: /\.pdf$/i.test(file.name) ? 'pdf' : 'epub',
                url: URL.createObjectURL(file), coverUrl: null,
                color: `hsl(${200 + Math.random() * 40}, 70%, 40%)`,
                isFav: false, rating: 0, progress: 0, lastLocation: null,
                dateAdded: Date.now(), lastReadDate: 0, bookmarks: [], category: null, loading: true
            }));
            setBooks(prev => [...prev, ...placeholders]);
            const parsed = [];
            for (const p of placeholders) {
                let coverBase64 = null;
                let meta = { title: p.name, creator: t.unknownAuthor, description: '', publisher: '', tags: '', series: '', seriesIndex: 0 };
                if (p.type === 'epub') {
                    try {
                        const tmp = ePub(); await tmp.open(p.file);
                        const cu = await tmp.coverUrl();
                        if (cu) { const res = await fetch(cu); coverBase64 = await fileToBase64(await res.blob()); }
                        const m = await tmp.loaded.metadata;
                        if (m.title) meta.title = m.title;
                        if (m.creator) meta.creator = m.creator;
                        if (m.description) meta.description = m.description.replace(/<\/?[^>]+(>|$)/g, '');
                        if (m.publisher) meta.publisher = m.publisher;
                        if (m.subject) meta.tags = Array.isArray(m.subject) ? m.subject.join(', ') : m.subject;
                        // Series from Calibre metadata or epub3 belongs-to-collection
                        try {
                            const raw = tmp.packaging?.metadata || {};
                            const seriesName = raw['calibre:series'] || raw['belongs_to_collection'] || m.series || '';
                            const seriesIdx = raw['calibre:series_index'] || raw['group_position'] || m.series_index || 0;
                            if (seriesName) { meta.series = String(seriesName).trim(); meta.seriesIndex = parseFloat(seriesIdx) || 0; }
                        } catch (_) { }
                        tmp.destroy();
                    } catch (_) { }
                }
                await saveFileToDB(p.id, p.file, coverBase64, meta.title, meta.creator, p.dateAdded);
                const k = meta.title + '|' + meta.creator;
                const saved = initialBooksMeta[k] || {};
                parsed.push({
                    ...p, originalTitle: meta.title, originalAuthor: meta.creator,
                    name: saved.customTitle || meta.title, author: saved.customAuthor || meta.creator,
                    coverUrl: saved.customCover || coverBase64,
                    description: saved.description !== undefined ? saved.description : meta.description,
                    publisher: saved.publisher !== undefined ? saved.publisher : meta.publisher,
                    tags: saved.tags !== undefined ? saved.tags : meta.tags,
                    series: saved.series || meta.series || '', seriesIndex: saved.seriesIndex || meta.seriesIndex || 0,
                    isFav: saved.isFav || false, rating: saved.rating || 0,
                    progress: saved.progress || 0, lastLocation: saved.lastLocation || null,
                    lastReadDate: saved.lastReadDate || 0, bookmarks: saved.bookmarks || [],
                    notes: saved.notes || '',
                    isFinished: saved.isFinished || false,
                    dateStarted: saved.dateStarted || null,
                    dateFinished: saved.dateFinished || null,
                    readingMinutes: saved.readingMinutes || 0,
                    category: saved.category || null, loading: false
                });
            }
            setBooks(prev => prev.map(b => parsed.find(n => n.id === b.id) || b));
            if (loader) { loader.style.opacity = '0'; setTimeout(() => { loader.style.visibility = 'hidden'; }, 300); }
        };

        // ─────────────────────────────────────────
        // LIBROS
        // ─────────────────────────────────────────
        const handleContextMenu = useCallback((e, book) => { e.preventDefault(); setContextMenu({ x: e.pageX, y: e.pageY, book }); }, []);
        const toggleFavorite = useCallback((bookId) => setBooks(prev => prev.map(b => b.id === bookId ? { ...b, isFav: !b.isFav } : b)), []);

        const markFinished = useCallback((bookId) => {
            setBooks(prev => prev.map(b => {
                if (b.id !== bookId) return b;
                const nowFinished = !b.isFinished;
                return { ...b, isFinished: nowFinished, progress: nowFinished ? 100 : b.progress, dateFinished: nowFinished ? Date.now() : null };
            }));
        }, []);

        const deleteBook = useCallback((bookId) => {
            if (!window.confirm(t.confirmDelete)) return;
            const book = books.find(b => b.id === bookId);
            if (book?.url) URL.revokeObjectURL(book.url);
            const tabToClose = tabs.find(tb => tb.bookId === bookId);
            if (tabToClose) closeTab(tabToClose.id);
            setBooks(prev => prev.filter(b => b.id !== bookId));
            if (lastReadId === bookId) setLastReadId(null);
            deleteFileFromDB(bookId);
        }, [books, tabs, lastReadId, t, closeTab]);

        const updateBookLocation = useCallback((bookId, cfi, percent) => {
            setBooks(prev => {
                const book = prev.find(b => b.id === bookId);
                if (!book) return prev;
                const hasPercent = percent !== null && percent !== undefined;
                const newProgress = hasPercent ? percent : book.progress;
                if (book.lastLocation === cfi && book.progress === newProgress) return prev;
                return prev.map(b => b.id === bookId
                    ? { ...b, lastLocation: cfi, progress: newProgress, lastReadDate: Date.now() }
                    : b);
            });
            // Clear the initial CFI target once relocated
            setTabTargetCfi(prev => {
                const tab = tabs.find(t => t.bookId === bookId);
                if (!tab || !prev[tab.id]) return prev;
                const n = { ...prev }; delete n[tab.id]; return n;
            });
        }, [tabs]);

        const toggleBookmarkInApp = useCallback((bookId, cfi, note = "Marcador", isDelete = false) => {
            setBooks(prev => prev.map(b => {
                if (b.id !== bookId) return b;
                if (isDelete) return { ...b, bookmarks: b.bookmarks.filter(bm => bm.cfi !== cfi) };
                const exists = b.bookmarks.find(bm => bm.cfi === cfi && bm.note === note);
                if (exists) return { ...b, bookmarks: b.bookmarks.filter(bm => !(bm.cfi === cfi && bm.note === note)) };
                return { ...b, bookmarks: [...b.bookmarks, { cfi, note, date: new Date().toLocaleDateString() }] };
            }));
        }, []);

        const saveWordToVocab = useCallback((word, definition, bookId, bookName) => {
            setVocabulary(prev => {
                if (prev.some(v => v.word.toLowerCase() === word.toLowerCase() && v.bookId === bookId)) return prev;
                return [...prev, { id: Date.now().toString(), word, definition, bookId, bookName, date: new Date().toLocaleDateString() }];
            });
        }, []);

        const exportAnnotations = (format = 'txt') => {
            const booksWithMarks = books.filter(b => b.bookmarks && b.bookmarks.length > 0);
            if (!booksWithMarks.length) { alert(t.noBookmarks); return; }
            let content, mime, ext;
            if (format === 'md') {
                content = `# 🦈 Mis Anotaciones — Shark Reader\n\n`;
                booksWithMarks.forEach(b => {
                    content += `## 📚 ${b.name} — *${b.author}*\n\n`;
                    b.bookmarks.forEach(bm => {
                        if (bm.note?.includes('[Subrayado]')) content += `> ${bm.note.replace('[Subrayado] ', '')}\n>\n> — *${bm.date}*\n\n`;
                        else content += `- **${bm.note}** *(${bm.date})*\n`;
                    });
                    content += '\n---\n\n';
                });
                mime = 'text/markdown'; ext = 'md';
            } else {
                content = "🦈 SHARK READER - TUS ANOTACIONES\n\n";
                booksWithMarks.forEach(b => {
                    content += `=========================================\n📚 ${b.name.toUpperCase()} - ${b.author}\n=========================================\n\n`;
                    b.bookmarks.forEach(bm => { content += `[${bm.date}] - ${bm.note}\n(CFI: ${bm.cfi})\n\n`; });
                });
                mime = 'text/plain'; ext = 'txt';
            }
            const url = URL.createObjectURL(new Blob([content], { type: mime }));
            const a = document.createElement('a'); a.href = url; a.download = `Mis_Anotaciones.${ext}`; a.click(); URL.revokeObjectURL(url);
        };

        const addNewCategory = () => {
            const c = prompt('Nueva categoría:');
            if (c && c.trim() && !customCategories.includes(c.trim())) setCustomCategories(prev => [...prev, c.trim()]);
        };
        const removeCategory = (cat) => {
            if (!confirm(`¿Eliminar "${cat}"?`)) return;
            setCustomCategories(prev => prev.filter(c => c !== cat));
            setBooks(prev => prev.map(b => b.category === cat ? { ...b, category: null } : b));
            if (currentFilter === cat) setCurrentFilter('all');
        };

        const displayedBooks = useMemo(() => {
            const filtered = books.filter(b => {
                if (b.loading) return false;
                if (currentFilter === 'favorites' && !b.isFav) return false;
                if (currentFilter === 'unstarted') return !b.lastReadDate && !b.isFinished;
                if (currentFilter === 'reading') return b.lastReadDate > 0 && !b.isFinished;
                if (currentFilter === 'finished') return b.isFinished === true;
                if (currentFilter === 'recents') return (b.dateAdded > Date.now() - 7 * 24 * 60 * 60 * 1000) || (b.lastReadDate > Date.now() - 14 * 24 * 60 * 60 * 1000);
                if (currentFilter.startsWith('author:')) return b.author === currentFilter.slice(7);
                if (currentFilter !== 'all' && currentFilter !== 'favorites' && b.category !== currentFilter) return false;
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    return b.name.toLowerCase().includes(term) || b.author.toLowerCase().includes(term) ||
                        (b.tags && b.tags.toLowerCase().includes(term)) || (b.series && b.series.toLowerCase().includes(term)) ||
                        (b.description && b.description.toLowerCase().includes(term)) || (b.publisher && b.publisher.toLowerCase().includes(term));
                }
                return true;
            });
            return [...filtered].sort((a, b) => {
                if (sortBy === 'lastRead') return (b.lastReadDate || 0) - (a.lastReadDate || 0);
                if (sortBy === 'added') return (b.dateAdded || 0) - (a.dateAdded || 0);
                if (sortBy === 'name') return a.name.localeCompare(b.name);
                if (sortBy === 'progress') return (b.progress || 0) - (a.progress || 0);
                if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
                return 0;
            });
        }, [books, currentFilter, searchTerm, sortBy]);

        const searchResultsWithMatches = useMemo(() => {
            if (!searchTerm) return null;
            const term = searchTerm.toLowerCase();
            return displayedBooks.map(b => ({
                ...b,
                matchedFields: [
                    b.name.toLowerCase().includes(term) && 'Título',
                    b.author.toLowerCase().includes(term) && 'Autor',
                    b.series && b.series.toLowerCase().includes(term) && 'Serie',
                    b.tags && b.tags.toLowerCase().includes(term) && 'Etiquetas',
                    b.description && b.description.toLowerCase().includes(term) && 'Sinopsis',
                    b.publisher && b.publisher.toLowerCase().includes(term) && 'Editorial',
                ].filter(Boolean)
            }));
        }, [displayedBooks, searchTerm]);

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

        const allBookmarks = useMemo(() => books.filter(b => b.bookmarks.length > 0), [books]);
        const openBookIds = useMemo(() => new Set(tabs.map(t => t.bookId)), [tabs]);

        // ─────────────────────────────────────────
        // RENDER
        // ─────────────────────────────────────────
        return (
            <div className="w-full h-screen flex flex-col relative"
                style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>

                {/* Warm overlay */}
                {warmMode && <div style={{ position: 'fixed', inset: 0, zIndex: 999997, backgroundColor: 'rgba(255,140,30,0.10)', pointerEvents: 'none', mixBlendMode: 'multiply' }} />}

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
                                <input type="text" placeholder="Título, autor, serie..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
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
                                    </select>
                                )}
                                <div className="flex bg-black/20 rounded-xl p-0.5 border border-white/10">
                                    <button onClick={() => setLibraryView('grid')} title="Vista cuadrícula"
                                        className={`px-2 py-1 rounded-lg text-xs font-bold transition ${libraryView === 'grid' ? 'bg-white/20' : 'opacity-50 hover:opacity-80'}`}>⊞</button>
                                    <button onClick={() => setLibraryView('list')} title="Vista lista"
                                        className={`px-2 py-1 rounded-lg text-xs font-bold transition ${libraryView === 'list' ? 'bg-white/20' : 'opacity-50 hover:opacity-80'}`}>☰</button>
                                </div>
                                <div className="w-px h-6 bg-white/20 mx-1"></div>
                                <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition font-semibold text-sm whitespace-nowrap"><Icons.Plus /> <span className="hidden xl:inline">{t.addBook}</span></button>
                                <button onClick={() => folderInputRef.current.click()} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition font-semibold text-sm whitespace-nowrap"><Icons.FolderPlus /> <span className="hidden xl:inline">{t.addFolder}</span></button>
                            </div>
                            {lastReadId && (
                                <button onClick={() => openBook(lastReadId)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-400 text-white shadow-md mr-2 whitespace-nowrap">
                                    <Icons.Play /> <span className="hidden lg:inline">{t.continueReading}</span>
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
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
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
                <input type="file" multiple ref={folderInputRef} accept=".epub,.pdf" className="hidden" onChange={handleFilesUpload} webkitdirectory="true" directory="true" />
                <input type="file" accept=".json" ref={importInputRef} className="hidden" onChange={importData} />
                <input type="file" accept="image/*" ref={avatarInputRef} className="hidden" onChange={handleAvatarUpload} />

                {/* ── MODALS ── */}

                {showLoginModal && (
                    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-md fade-in" onClick={() => setShowLoginModal(false)}>
                        <div className="bg-[var(--surface-bg)] w-full max-w-sm rounded-3xl p-8 shadow-2xl relative border border-[var(--highlight)]" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 p-2 opacity-50 hover:opacity-100 transition"><Icons.Close /></button>
                            <h2 className="text-2xl font-black mb-2 text-center text-[var(--highlight)]">{t.createProfile}</h2>
                            <p className="text-xs text-center opacity-60 mb-6">{t.createProfileDesc}</p>
                            <div className="flex flex-col items-center gap-4 mb-6">
                                <div className="w-24 h-24 bg-black/5 dark:bg-white/5 rounded-full border-4 border-[var(--highlight)] shadow-xl flex items-center justify-center text-5xl overflow-hidden">{renderAvatar(tempLoginAvatar)}</div>
                                <div className="flex gap-2">
                                    <button onClick={handleRandomEmoji} className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-bold hover:bg-black/10 flex items-center gap-2 transition"><Icons.Dice /> Aleatorio</button>
                                    <button onClick={() => avatarInputRef.current.click()} className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-bold hover:bg-black/10 flex items-center gap-2 transition"><Icons.Image /> Foto</button>
                                </div>
                            </div>
                            <input type="text" placeholder="Ej. El Gran Tiburón" className="w-full bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none font-bold text-center text-lg transition mb-8"
                                value={tempLoginName} onChange={e => setTempLoginName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                            <button onClick={handleLogin} className="w-full bg-[var(--highlight)] text-white font-black py-4 rounded-xl shadow-lg hover:brightness-110 transition text-lg">{t.startReading}</button>
                        </div>
                    </div>
                )}

                {/* ── MODAL EDITAR PERFIL ── */}
                {showEditProfileModal && userProfile && (
                    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-md fade-in" onClick={() => setShowEditProfileModal(false)}>
                        <div className="bg-[var(--surface-bg)] w-full max-w-sm rounded-3xl p-8 shadow-2xl relative border border-[var(--highlight)]" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setShowEditProfileModal(false)} className="absolute top-4 right-4 p-2 opacity-50 hover:opacity-100 transition"><Icons.Close /></button>
                            <h2 className="text-2xl font-black mb-2 text-center" style={{ color: 'var(--highlight)' }}>Editar Perfil</h2>
                            <p className="text-xs text-center opacity-60 mb-6">Cambia tu nombre o avatar</p>
                            <div className="flex flex-col items-center gap-4 mb-6">
                                <div className="w-24 h-24 bg-black/5 dark:bg-white/5 rounded-full border-4 border-[var(--highlight)] shadow-xl flex items-center justify-center text-5xl overflow-hidden">{renderAvatar(tempEditAvatar)}</div>
                                <div className="flex gap-2">
                                    <button onClick={() => setTempEditAvatar(RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)])}
                                        className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-bold hover:bg-black/10 flex items-center gap-2 transition">
                                        <Icons.Dice /> Aleatorio
                                    </button>
                                    <label className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-bold hover:bg-black/10 flex items-center gap-2 transition cursor-pointer">
                                        <Icons.Image /> Foto
                                        <input type="file" accept="image/*" className="hidden" onChange={handleEditAvatarUpload} />
                                    </label>
                                </div>
                                <div className="flex gap-2 w-full">
                                    {RANDOM_EMOJIS.slice(0, 8).map(e => (
                                        <button key={e} onClick={() => setTempEditAvatar(e)}
                                            className={`flex-1 rounded-xl py-2 text-xl transition ${tempEditAvatar === e ? 'bg-[var(--highlight)]/20 scale-110' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10'}`}>
                                            {e}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <input type="text" placeholder="Tu nombre" className="w-full bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none font-bold text-center text-lg transition mb-4"
                                value={tempEditName} onChange={e => setTempEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditProfile()} />
                            <button onClick={saveEditProfile} disabled={!tempEditName.trim()}
                                className="w-full text-white font-black py-4 rounded-xl shadow-lg hover:brightness-110 transition text-lg disabled:opacity-50"
                                style={{ backgroundColor: 'var(--highlight)' }}>
                                Guardar cambios
                            </button>
                        </div>
                    </div>
                )}

                {/* ── MODAL ANIVERSARIO ── */}
                {anniversaryInfo && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm fade-in" onClick={() => setAnniversaryInfo(null)}>
                        <div className="bg-[var(--surface-bg)] rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-[var(--border-color)] text-center mx-4" onClick={e => e.stopPropagation()}>
                            <div className="text-6xl mb-4">
                                {anniversaryInfo.days >= 365 ? '🎉' : anniversaryInfo.days >= 100 ? '🏆' : anniversaryInfo.days >= 30 ? '🔥' : '📅'}
                            </div>
                            <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--highlight)' }}>
                                {anniversaryInfo.days >= 365 ? '¡Un año leyendo este libro!' : `¡${anniversaryInfo.days} días leyendo!`}
                            </h2>
                            <p className="opacity-70 text-sm mb-4 leading-relaxed">
                                Llevas <b>{anniversaryInfo.days} días</b> con<br/>
                                <span className="font-bold" style={{ color: 'var(--highlight)' }}>"{anniversaryInfo.name}"</span>
                            </p>
                            <div className="bg-black/5 dark:bg-white/5 rounded-2xl px-6 py-3 mb-6 inline-block">
                                <span className="text-2xl font-black" style={{ color: 'var(--highlight)' }}>
                                    {anniversaryInfo.readingMinutes >= 60
                                        ? `${Math.floor(anniversaryInfo.readingMinutes / 60)}h ${anniversaryInfo.readingMinutes % 60}m`
                                        : `${anniversaryInfo.readingMinutes} min`}
                                </span>
                                <p className="text-[11px] font-bold opacity-50 uppercase tracking-widest mt-1">de lectura real</p>
                            </div>
                            <button onClick={() => setAnniversaryInfo(null)}
                                className="w-full py-3 rounded-xl font-bold text-white transition hover:brightness-110"
                                style={{ backgroundColor: 'var(--highlight)' }}>
                                ¡Seguir leyendo! 📖
                            </button>
                        </div>
                    </div>
                )}

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
                                        { filter: 'all', icon: <Icons.Library />, label: t.library, count: books.filter(b => !b.loading).length },
                                        { filter: 'reading', icon: <span>📖</span>, label: 'Leyendo', count: books.filter(b => !b.loading && b.lastReadDate > 0 && !b.isFinished).length },
                                        { filter: 'unstarted', icon: <span>📚</span>, label: 'Sin empezar', count: books.filter(b => !b.loading && !b.lastReadDate && !b.isFinished).length },
                                        { filter: 'finished', icon: <span>🏁</span>, label: 'Terminados', count: books.filter(b => !b.loading && b.isFinished).length },
                                        { filter: 'favorites', icon: <Icons.Heart className="text-red-500" />, label: t.favorites, count: books.filter(b => b.isFav).length },
                                        { filter: 'recents', icon: <span>🕐</span>, label: 'Recientes', count: books.filter(b => !b.loading && ((b.dateAdded > Date.now() - 7*24*60*60*1000) || (b.lastReadDate > Date.now() - 14*24*60*60*1000))).length },
                                    ].map(item => (
                                        <button key={item.filter} onClick={() => { setCurrentFilter(item.filter); setView('library'); setSidebarOpen(false); }}
                                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition text-left font-semibold ${currentFilter === item.filter ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                            <span className="opacity-80">{item.icon}</span> {item.label}
                                            <span className="ml-auto text-xs font-bold px-2 py-1 bg-black/5 dark:bg-white/10 rounded-lg">{item.count}</span>
                                        </button>
                                    ))}

                                    {/* Por Autor */}
                                    {books.filter(b => b.author && !b.loading).length > 0 && (() => {
                                        const authors = [...new Set(books.filter(b => b.author && !b.loading).map(b => b.author))].sort();
                                        return (
                                            <div>
                                                <button onClick={() => setShowAuthorSection(p => !p)}
                                                    className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition text-left font-semibold hover:bg-black/5 dark:hover:bg-white/5">
                                                    <span className="opacity-80">👤</span> Por Autor
                                                    <span className="ml-auto text-xs font-bold px-2 py-1 bg-black/5 dark:bg-white/10 rounded-lg">{authors.length}</span>
                                                    <span className="text-xs opacity-40">{showAuthorSection ? '▲' : '▼'}</span>
                                                </button>
                                                {showAuthorSection && (
                                                    <div className="ml-4 space-y-0.5 max-h-48 overflow-y-auto">
                                                        {authors.map(author => (
                                                            <button key={author} onClick={() => { setCurrentFilter(`author:${author}`); setView('library'); setSidebarOpen(false); }}
                                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left text-sm ${currentFilter === `author:${author}` ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                                                <span className="truncate flex-1 opacity-80">{author}</span>
                                                                <span className="text-[10px] font-bold opacity-40 flex-shrink-0">{books.filter(b => b.author === author).length}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {customCategories.length > 0 && (
                                        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                            <p className="text-[9px] font-black uppercase tracking-widest opacity-30 px-4 mb-1">Mis categorías</p>
                                        </div>
                                    )}
                                    {customCategories.map(cat => (
                                        <div key={cat} className={`flex items-center rounded-xl transition group ${currentFilter === cat ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                            <button onClick={() => { setCurrentFilter(cat); setView('library'); setSidebarOpen(false); }} className="flex-1 flex items-center gap-4 px-4 py-3 text-left font-semibold">
                                                <span className="opacity-80"><Icons.FolderPlus /></span> {cat}
                                                <span className="ml-auto text-xs font-bold px-2 py-1 bg-black/5 dark:bg-white/10 rounded-lg">{books.filter(b => b.category === cat).length}</span>
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); removeCategory(cat); }} className="opacity-0 group-hover:opacity-100 p-3 text-red-500 hover:text-red-600 transition"><Icons.Trash className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                    <button onClick={addNewCategory} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition text-left font-semibold hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100 border border-dashed border-gray-500/30 mt-2">
                                        <span className="opacity-80"><Icons.Plus /></span> Añadir Categoría
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
                                                    <button onClick={() => {
                                                        let md = '# 📖 Mi Vocabulario — Shark Reader\n\n';
                                                        vocabulary.forEach(v => { md += `## ${v.word}\n${v.definition}\n\n*${v.bookName} · ${v.date}*\n\n---\n\n`; });
                                                        const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
                                                        const a = document.createElement('a'); a.href = url; a.download = 'Mi_Vocabulario.md'; a.click(); URL.revokeObjectURL(url);
                                                    }} className="w-full text-xs font-bold py-2 mt-2 rounded-xl bg-black/5 dark:bg-white/5 hover:opacity-80 transition">
                                                        Exportar .MD ({vocabulary.length} palabras)
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Marcadores y Subrayados */}
                                <div className="px-3">
                                    <div className="flex items-center justify-between mb-3 pl-1">
                                        <span className="font-black uppercase text-xs tracking-widest flex items-center gap-2 opacity-50">
                                            <Icons.Bookmark /> Anotaciones
                                        </span>
                                        <div className="flex gap-1">
                                            <button onClick={() => exportAnnotations('txt')} className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">.TXT</button>
                                            <button onClick={() => exportAnnotations('md')} className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">.MD</button>
                                            <button onClick={exportQuotesAsImage} title="Exportar subrayados como imagen" className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">🖼️</button>
                                        </div>
                                    </div>
                                    {allBookmarks.length === 0 ? (
                                        <div className="text-center py-8 opacity-40">
                                            <p className="text-2xl mb-2">🔖</p>
                                            <p className="text-xs font-medium">{t.noBookmarks}</p>
                                        </div>
                                    ) : allBookmarks.map(b => {
                                        const highlights = b.bookmarks.filter(bm => bm.note && bm.note.startsWith('[Subrayado]'));
                                        const marks = b.bookmarks.filter(bm => !bm.note || !bm.note.startsWith('[Subrayado]'));
                                        return (
                                            <div key={'bm-' + b.id} className="mb-4 fade-in">
                                                {/* Book header */}
                                                <div className="flex items-center gap-2 mb-2 px-1">
                                                    <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--highlight)' }}></div>
                                                    <p className="text-[11px] font-black truncate flex-1 opacity-70">{b.name}</p>
                                                    <span className="text-[9px] font-bold opacity-30">{b.bookmarks.length}</span>
                                                </div>

                                                {/* Marcadores */}
                                                {marks.length > 0 && (
                                                    <div className="mb-2">
                                                        <p className="text-[9px] font-black uppercase tracking-widest opacity-30 px-2 mb-1">📌 Marcadores</p>
                                                        <div className="flex flex-col gap-1">
                                                            {marks.map((bm, i) => (
                                                                <div key={i} className="group flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition">
                                                                    <button
                                                                        onClick={() => { openBook(b.id, bm.cfi); setSidebarOpen(false); }}
                                                                        className="flex-1 text-left min-w-0">
                                                                        <span className="text-[12px] font-semibold leading-snug block truncate" style={{ color: 'var(--text-color)' }}>{bm.note}</span>
                                                                        <span className="text-[9px] opacity-40 font-bold">{bm.date}</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => toggleBookmarkInApp(b.id, bm.cfi, bm.note, true)}
                                                                        className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition text-red-400 text-base leading-none flex-shrink-0">×</button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Subrayados */}
                                                {highlights.length > 0 && (
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-widest opacity-30 px-2 mb-1">💛 Subrayados</p>
                                                        <div className="flex flex-col gap-1">
                                                            {highlights.map((bm, i) => {
                                                                const quoteText = bm.note.replace('[Subrayado] ', '').replace(/^"|"$/g, '').replace(/\.\.\.$/,'');
                                                                return (
                                                                    <div key={i} className="group flex items-start gap-2 px-2 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition">
                                                                        <div className="w-0.5 rounded-full flex-shrink-0 mt-1 self-stretch" style={{ backgroundColor: '#facc15', minHeight: 12 }}></div>
                                                                        <button
                                                                            onClick={() => { openBook(b.id, bm.cfi); setSidebarOpen(false); }}
                                                                            className="flex-1 text-left min-w-0">
                                                                            <span className="text-[11px] font-medium leading-snug block line-clamp-2 italic opacity-80">{quoteText}</span>
                                                                            <span className="text-[9px] opacity-40 font-bold">{bm.date}</span>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => toggleBookmarkInApp(b.id, bm.cfi, bm.note, true)}
                                                                            className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition text-red-400 text-base leading-none flex-shrink-0 mt-0.5">×</button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="p-4 border-t space-y-1.5" style={{ borderColor: 'var(--border-color)' }}>
                                <button onClick={() => { setView('analytics'); setSidebarOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition font-bold opacity-70 hover:opacity-100 text-sm">
                                    <span className="text-base">📊</span> Analíticas
                                </button>
                                <button onClick={() => { setView('achievements'); setSidebarOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition font-bold opacity-70 hover:opacity-100 text-sm">
                                    <span className="text-base">🏆</span> Logros
                                    <span className="ml-auto text-xs font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: Object.keys(achievements).length > 0 ? 'var(--highlight)' : 'rgba(128,128,128,0.3)' }}>
                                        {Object.keys(achievements).length}/{ACHIEVEMENTS.length}
                                    </span>
                                </button>
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
                {showStreakModal && (
                    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-in" onClick={() => setShowStreakModal(false)}>
                        <div className="bg-[var(--surface-bg)] w-full max-w-sm rounded-3xl p-8 shadow-2xl relative border border-[var(--border-color)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setShowStreakModal(false)} className="absolute top-4 right-4 p-2 opacity-50 hover:opacity-100 transition"><Icons.Close /></button>
                            <h2 className="text-2xl font-black mb-6 text-orange-500 flex items-center gap-3"><div className="p-2 bg-orange-500/20 rounded-full"><Icons.Fire /></div> Tu Racha</h2>
                            {!userProfile ? (
                                <p className="text-center p-4 bg-orange-500/10 rounded-xl text-sm font-bold opacity-80">Inicia sesión para guardar tu racha.</p>
                            ) : (
                                <>
                                    <div className="flex gap-4 mb-6">
                                        <div className="flex-1 bg-black/5 dark:bg-white/5 rounded-2xl p-4 text-center">
                                            <span className="text-4xl font-black">{stats.streak}</span>
                                            <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mt-1">Días Seguidos</p>
                                        </div>
                                        <div className="flex-1 bg-blue-500/10 rounded-2xl p-4 text-center border border-blue-500/20 relative">
                                            <button onClick={() => setShowSaverInfo(p => !p)} className="absolute -top-2 -right-2 bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">?</button>
                                            <span className="text-4xl font-black text-blue-500">{stats.streakSavers || 0}</span><span className="text-xl font-bold text-blue-500/50">/2</span>
                                            <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mt-1 text-blue-600 dark:text-blue-400">Salvadores</p>
                                            {showSaverInfo && (
                                                <div className="absolute top-8 right-0 w-64 bg-slate-800 text-white p-5 rounded-2xl shadow-2xl border border-blue-500/30 text-xs z-50 text-left">
                                                    <div className="flex justify-between items-center mb-2"><strong className="text-blue-400 text-sm font-black">¿Qué es un Salvador?</strong><button onClick={e => { e.stopPropagation(); setShowSaverInfo(false); }}><Icons.Close /></button></div>
                                                    Si un día olvidas leer, el sistema usa 1 Salvador para <span className="text-orange-400 font-bold">evitar que tu racha vuelva a cero</span>. Ganas 1 por cada 5 días de racha (máx 2).
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-black/5 dark:bg-white/5 p-5 rounded-2xl mb-2">
                                        <h3 className="font-bold text-xs uppercase tracking-widest opacity-50 mb-4 text-center">Últimos 7 Días</h3>
                                        <div className="flex justify-between items-center">
                                            {Array.from({ length: 7 }).map((_, i) => {
                                                const d = new Date(); d.setDate(d.getDate() - (6 - i));
                                                const ds = d.toDateString(); const st = stats.history?.[ds]; const isToday = i === 6;
                                                let cc = "bg-gray-300 dark:bg-gray-700";
                                                if (st === 'read') cc = "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)] scale-110";
                                                else if (st === 'saved') cc = "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] scale-110";
                                                else if (isToday && stats.currentDailyMins > 0 && stats.currentDailyMins < 5) cc = "bg-orange-400/50 animate-pulse border-orange-500 border-2";
                                                return (
                                                    <div key={i} className="flex flex-col items-center gap-2 relative">
                                                        {isToday && <div className="absolute -top-4 text-[8px] font-black text-orange-500 uppercase">Hoy</div>}
                                                        <div className={`w-8 h-8 rounded-full ${cc} transition-all border border-[var(--surface-bg)] flex items-center justify-center`}>
                                                            {isToday && stats.currentDailyMins > 0 && stats.currentDailyMins < 5 && <span className="text-[8px] font-bold text-white">{stats.currentDailyMins}m</span>}
                                                        </div>
                                                        <span className={`text-[10px] font-bold opacity-60 ${isToday ? 'text-orange-500 opacity-100' : ''}`}>{['D','L','M','X','J','V','S'][d.getDay()]}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-center opacity-40 mt-2">*Lee al menos 5 minutos al día para mantener tu racha.*</p>

                                    {/* Objetivo diario */}
                                    <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl mt-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-xs font-black opacity-60">🎯 Objetivo diario</p>
                                            <span className="text-xs font-black" style={{ color: stats.currentDailyMins >= dailyGoalMins ? '#22c55e' : 'var(--highlight)' }}>
                                                {Math.min(stats.currentDailyMins || 0, dailyGoalMins)} / {dailyGoalMins} min
                                            </span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-3">
                                            <div className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(100, ((stats.currentDailyMins || 0) / dailyGoalMins) * 100)}%`, backgroundColor: stats.currentDailyMins >= dailyGoalMins ? '#22c55e' : 'var(--highlight)' }} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] opacity-50">15m</span>
                                            <input type="range" min="15" max="120" step="5" value={dailyGoalMins}
                                                onChange={e => setDailyGoalMins(Number(e.target.value))}
                                                className="flex-1 accent-[var(--highlight)]" />
                                            <span className="text-[10px] opacity-50">2h</span>
                                        </div>
                                    </div>

                                    {/* Meta anual */}
                                    {(() => {
                                        const thisYear = new Date().getFullYear();
                                        const finishedThisYear = books.filter(b => b.isFinished && b.dateFinished && new Date(b.dateFinished).getFullYear() === thisYear).length;
                                        const pct = Math.min(100, (finishedThisYear / yearlyGoal) * 100);
                                        return (
                                            <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl mt-3">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="text-xs font-black opacity-60">📚 Meta {thisYear}</p>
                                                    <span className="text-xs font-black" style={{ color: finishedThisYear >= yearlyGoal ? '#22c55e' : 'var(--highlight)' }}>
                                                        {finishedThisYear} / {yearlyGoal} libros
                                                    </span>
                                                </div>
                                                <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-3">
                                                    <div className="h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${pct}%`, backgroundColor: finishedThisYear >= yearlyGoal ? '#22c55e' : 'var(--highlight)' }} />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] opacity-50">1</span>
                                                    <input type="range" min="1" max="52" step="1" value={yearlyGoal}
                                                        onChange={e => setYearlyGoal(Number(e.target.value))}
                                                        className="flex-1 accent-[var(--highlight)]" />
                                                    <span className="text-[10px] opacity-50">52</span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {/* Gráfica 30 días */}
                                    {(() => {
                                        const days = Array.from({ length: 30 }).map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (29 - i)); return { mins: (stats.minutesByDay || {})[d.toDateString()] || 0 }; });
                                        const mx = Math.max(...days.map(d => d.mins), 1);
                                        return (
                                            <div className="bg-black/5 dark:bg-white/5 p-5 rounded-2xl mt-4">
                                                <h3 className="font-bold text-xs uppercase tracking-widest opacity-50 mb-4 text-center">Minutos — últimos 30 días</h3>
                                                <div className="flex items-end gap-0.5 h-20">
                                                    {days.map((d, i) => (
                                                        <div key={i} className="flex-1 group relative">
                                                            <div className="w-full rounded-t-sm transition-all duration-500" style={{ height: `${Math.max(2, (d.mins / mx) * 100)}%`, background: d.mins > 0 ? 'linear-gradient(to top, var(--progress-bg), var(--highlight))' : 'rgba(128,128,128,0.15)' }} />
                                                            {d.mins > 0 && <div className="absolute bottom-full mb-1 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded-md font-black opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">{d.mins}m</div>}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex justify-between mt-1"><span className="text-[9px] opacity-30">hace 30d</span><span className="text-[9px] opacity-30">hoy</span></div>
                                            </div>
                                        );
                                    })()}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* ── BIBLIOTECA ── */}
                {view === 'library' && (
                    <div className="flex-1 library-container w-full relative overflow-y-auto">

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
                                                    <button onClick={() => fileInputRef.current.click()} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"><Icons.Plus /> {t.addBook}</button>
                                                    <button onClick={() => folderInputRef.current.click()} className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"><Icons.FolderPlus /> {t.addFolder}</button>
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
                                    <div className={`books-grid fade-in ${addons.netflixView ? 'netflix-grid' : ''}`}>
                                        {displayedBooks.map(book => (
                                            <div key={book.id} draggable
                                                onDragStart={e => { e.dataTransfer.setData('bookId', book.id); setDraggedBookId(book.id); }}
                                                onDragEnd={() => { setDraggedBookId(null); setDropTargetCat(null); }}>
                                                <BookCard book={book} isOpen={openBookIds.has(book.id)} onOpen={openBook} onContextMenu={handleContextMenu} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {displayedBooks.length > 0 && libraryView === 'list' && (
                                    <div className="p-4 flex flex-col gap-2 fade-in max-w-4xl mx-auto w-full">
                                        {displayedBooks.map(book => {
                                            const statusIcon = book.isFinished ? '✅' : book.lastReadDate > 0 ? '📖' : '📚';
                                            return (
                                                <div key={book.id}
                                                    className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer border border-transparent hover:border-[var(--border-color)] transition group"
                                                    style={{ backgroundColor: 'var(--surface-bg)' }}
                                                    onClick={() => openBook(book.id)}
                                                    onContextMenu={e => handleContextMenu(e, book)}>
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
                                )}
                            </>
                        )}

                        <div className="md:hidden fixed bottom-6 right-6 flex flex-col gap-4 z-30">
                            <button onClick={() => folderInputRef.current.click()} className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl bg-slate-700 hover:scale-110 transition-transform"><Icons.FolderPlus /></button>
                            <button onClick={() => fileInputRef.current.click()} className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 transition-transform" style={{ backgroundColor: 'var(--highlight)' }}><Icons.Plus /></button>
                        </div>
                    </div>
                )}

                {/* ── CONTEXT MENU ── */}
                {contextMenu && (
                    <div className="absolute shadow-2xl rounded-2xl py-2 z-50 text-sm border backdrop-blur-xl fade-in" style={{ top: contextMenu.y, left: contextMenu.x, backgroundColor: 'var(--surface-bg)', color: 'var(--text-color)', borderColor: 'var(--border-color)', minWidth: '220px' }}>
                        <button onClick={() => { setActiveBookModal(contextMenu.book); setContextMenu(null); }} className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 font-semibold transition"><Icons.Info /> {t.bookInfo}</button>
                        <button onClick={() => { toggleFavorite(contextMenu.book.id); setContextMenu(null); }} className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 font-semibold transition"><Icons.Heart fill={contextMenu.book.isFav ? '#ef4444' : 'none'} className={contextMenu.book.isFav ? 'text-red-500' : ''} /> {contextMenu.book.isFav ? t.remFav : t.addFav}</button>
                        <button onClick={() => { markFinished(contextMenu.book.id); setContextMenu(null); }} className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 font-semibold transition">
                            {contextMenu.book.isFinished ? '↩️' : '✅'} {contextMenu.book.isFinished ? 'Marcar como leyendo' : 'Marcar como terminado'}
                        </button>
                        <div className="border-t my-1" style={{ borderColor: 'var(--border-color)' }}></div>
                        <button onClick={() => { deleteBook(contextMenu.book.id); setContextMenu(null); }} className="w-full text-left px-5 py-3 flex items-center gap-3 text-red-500 hover:bg-red-500/10 font-bold transition"><Icons.Trash /> {t.deleteBook}</button>
                    </div>
                )}

                {/* ── MODAL INFO LIBRO ── */}
                {activeBookModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm fade-in" onClick={() => setActiveBookModal(null)}>
                        <div className="bg-[var(--surface-bg)] w-full max-w-4xl p-8 rounded-3xl shadow-2xl border border-[var(--border-color)] flex flex-col md:flex-row gap-8 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setActiveBookModal(null)} className="absolute top-6 right-6 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition"><Icons.Close /></button>
                            <div className="flex flex-col items-center w-full md:w-1/3">
                                <div className="w-full aspect-[2/3] rounded-xl shadow-xl mb-4 flex items-center justify-center text-white text-center p-4 bg-cover bg-center" style={{ backgroundImage: activeBookModal.coverUrl ? `url(${activeBookModal.coverUrl})` : 'none', backgroundColor: activeBookModal.color }}>
                                    {!activeBookModal.coverUrl && <span className="font-bold">{activeBookModal.name}</span>}
                                </div>
                                <div className="w-full mt-2">
                                    <label className="text-[10px] font-bold opacity-40 uppercase tracking-widest block mb-1">{t.cover}</label>
                                    <input className="w-full bg-black/5 dark:bg-white/5 p-2 text-xs rounded-lg border border-transparent focus:border-[var(--highlight)] outline-none transition" value={activeBookModal.coverUrl || ''} placeholder="https://..." onChange={e => setActiveBookModal({ ...activeBookModal, coverUrl: e.target.value })} />
                                </div>
                                <div className="flex gap-2 w-full justify-center mt-4">
                                    <span className="text-xs px-3 py-1.5 bg-slate-500/10 text-slate-600 dark:text-slate-300 rounded-lg uppercase font-bold tracking-wider">{activeBookModal.type}</span>
                                    <span className="text-xs px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg font-bold tracking-wider">{activeBookModal.progress || 0}% Leído</span>
                                </div>
                                <div className="flex items-center justify-center gap-1 mt-3">
                                    {[1,2,3,4,5].map(star => (
                                        <button key={star} onClick={() => setActiveBookModal({ ...activeBookModal, rating: star === activeBookModal.rating ? 0 : star })} className="text-2xl transition-transform hover:scale-125">
                                            <span style={{ color: star <= (activeBookModal.rating || 0) ? '#f59e0b' : 'rgba(128,128,128,0.3)' }}>★</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col w-full md:w-2/3">
                                <div className="space-y-4 flex-1">
                                    <input className="w-full bg-transparent text-2xl md:text-4xl font-black border-b border-transparent hover:border-gray-500/30 focus:border-[var(--highlight)] outline-none transition py-1" value={activeBookModal.name} onChange={e => setActiveBookModal({ ...activeBookModal, name: e.target.value })} />
                                    <input className="w-full bg-transparent text-lg font-semibold opacity-70 border-b border-transparent hover:border-gray-500/30 focus:border-[var(--highlight)] outline-none transition py-1" value={activeBookModal.author} onChange={e => setActiveBookModal({ ...activeBookModal, author: e.target.value })} />
                                    {/* Series */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">Serie</label>
                                            <input className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition" value={activeBookModal.series || ''} placeholder="Nombre de la serie..." onChange={e => setActiveBookModal({ ...activeBookModal, series: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">Nº en la serie</label>
                                            <input type="number" min="0" className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition" value={activeBookModal.seriesIndex || ''} placeholder="1" onChange={e => setActiveBookModal({ ...activeBookModal, seriesIndex: Number(e.target.value) })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-2">Colección</label>
                                            <div className="flex flex-wrap gap-2">
                                                {customCategories.map(c => (
                                                    <button key={c} onClick={() => setActiveBookModal({ ...activeBookModal, category: activeBookModal.category === c ? null : c })}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${activeBookModal.category === c ? 'bg-[var(--highlight)] text-white shadow-md' : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20'}`}>{c}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">{t.tags}</label>
                                            <input className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition" value={activeBookModal.tags || ''} placeholder="Ficción, Novela..." onChange={e => setActiveBookModal({ ...activeBookModal, tags: e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">{t.publisher}</label>
                                        <input className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition" value={activeBookModal.publisher || ''} placeholder="Editorial..." onChange={e => setActiveBookModal({ ...activeBookModal, publisher: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">{t.synopsis}</label>
                                        <textarea className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition resize-none h-28 leading-relaxed" value={activeBookModal.description || ''} placeholder="Descripción..." onChange={e => setActiveBookModal({ ...activeBookModal, description: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">📝 Mis notas</label>
                                        <textarea className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition resize-none h-24 leading-relaxed" value={activeBookModal.notes || ''} placeholder="Tus notas personales sobre este libro..." onChange={e => setActiveBookModal({ ...activeBookModal, notes: e.target.value })} />
                                    </div>
                                </div>
                                {/* Stats del libro */}
                                <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase opacity-40 tracking-widest mb-3">📊 Estadísticas</p>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        {[
                                            { label: 'Tiempo leído', value: activeBookModal.readingMinutes >= 60 ? `${Math.floor(activeBookModal.readingMinutes / 60)}h ${activeBookModal.readingMinutes % 60}m` : `${activeBookModal.readingMinutes || 0} min` },
                                            { label: 'Inicio', value: activeBookModal.dateStarted ? new Date(activeBookModal.dateStarted).toLocaleDateString() : '—' },
                                            { label: 'Fin', value: activeBookModal.dateFinished ? new Date(activeBookModal.dateFinished).toLocaleDateString() : '—' }
                                        ].map(s => (
                                            <div key={s.label} className="bg-black/5 dark:bg-white/5 p-3 rounded-xl">
                                                <p className="text-[10px] opacity-50 font-bold uppercase tracking-wider">{s.label}</p>
                                                <p className="font-black mt-0.5">{s.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => { markFinished(activeBookModal.id); setActiveBookModal(p => ({ ...p, isFinished: !p.isFinished, progress: !p.isFinished ? 100 : p.progress })); }}
                                        className={`w-full mt-3 py-2 rounded-xl font-bold text-sm transition ${activeBookModal.isFinished ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'}`}>
                                        {activeBookModal.isFinished ? '✅ Terminado — clic para desmarcar' : '☑ Marcar como terminado'}
                                    </button>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button onClick={() => setActiveBookModal(null)} className="flex-1 bg-black/5 dark:bg-white/5 py-4 rounded-xl font-bold hover:opacity-80 transition">{t.cancel}</button>
                                    <button onClick={() => { setBooks(prev => prev.map(b => b.id === activeBookModal.id ? activeBookModal : b)); setActiveBookModal(null); }} className="flex-1 bg-[var(--highlight)] text-white py-4 rounded-xl font-bold shadow-lg hover:brightness-110 transition">{t.save}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── MODAL SETTINGS (extracted) ── */}
                <SettingsPanel
                    open={settingsOpen} onClose={() => setSettingsOpen(false)}
                    theme={theme} setTheme={setTheme}
                    warmMode={warmMode} setWarmMode={setWarmMode}
                    readFlow={readFlow} setReadFlow={setReadFlow}
                    readLayout={readLayout} setReadLayout={setReadLayout}
                    pageTransition={pageTransition} setPageTransition={(v) => { setPageTransition(v); localStorage.setItem('page_transition', v); }}
                    lang={lang} setLang={setLang}
                    aiProvider={aiProvider} setAiProvider={setAiProvider}
                    aiApiKey={aiApiKey} setAiApiKey={setAiApiKey}
                    syncFolder={syncFolder} setSyncFolder={setSyncFolder}
                    accentColor={accentColor} setAccentColor={setAccentColor}
                    t={t}
                />

                {/* ── ANALYTICS VIEW ── */}
                {(view === 'analytics' || view === 'achievements') && (
                    <div className="flex-1 overflow-hidden">
                        <AnalyticsView
                            stats={stats}
                            books={books}
                            vocabulary={vocabulary}
                            achievements={achievements}
                            yearlyGoal={yearlyGoal}
                            initialTab={view === 'achievements' ? 'achievements' : 'stats'}
                            onBack={() => setView('library')}
                        />
                    </div>
                )}

                {/* ── READER ── */}
                {view === 'reader' && currentBookData && (
                    <div className="flex-1 flex overflow-hidden relative w-full" style={{ backgroundColor: 'var(--bg-color)' }}>
                        {/* Panel izquierdo / principal */}
                        <div className={`flex flex-col ${panelMode && rightBookData ? 'w-1/2 border-r border-white/10' : 'w-full'} overflow-hidden`}>
                            {currentBookData.type === 'epub' ? (
                                <EpubReaderBoundary onClose={closeBook}>
                                <EpubReader
                                    bookData={currentBookData}
                                    targetCfi={currentTargetCfi}
                                    theme={theme} t={t} lang={lang}
                                    readFlow={readFlow} readLayout={readLayout}
                                    updateLocationAndProgress={updateBookLocation}
                                    toggleBookmark={toggleBookmarkInApp}
                                    isFullscreen={isFullscreen}
                                    focusMode={addons.focusMode}
                                    pageTransition={pageTransition}
                                    smartTocAddon={addons.smartToc}
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
                                />
                                </EpubReaderBoundary>
                            ) : (
                                <PdfReader
                                    bookData={currentBookData}
                                    theme={theme} t={t}
                                    isFullscreen={isFullscreen}
                                    focusMode={addons.focusMode}
                                    onClose={closeBook}
                                    onOpenSettings={() => setSettingsOpen(true)}
                                    onOpenBookInfo={() => setActiveBookModal(currentBookData)}
                                    updateLocationAndProgress={updateBookLocation}
                                    toggleBookmark={toggleBookmarkInApp}
                                    onStatsUpdate={pages => setStats(prev => ({ ...prev, pagesTurned: prev.pagesTurned + pages }))}
                                    tabs={tabs} activeTabId={activeTabId} allBooks={books}
                                    onSwitchTab={id => setActiveTabId(id)}
                                    onCloseTab={closeTab}
                                    onGoToLibrary={() => setView('library')}
                                />
                            )}
                        </div>

                        {/* Panel derecho (multi-panel) */}
                        {panelMode && rightBookData && (
                            <div className="w-1/2 flex flex-col overflow-hidden">
                                {/* Selector de qué tab mostrar en el panel derecho */}
                                <div className="flex-shrink-0 flex items-center gap-1 px-2 h-9 overflow-x-auto" style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    {tabs.filter(tb => tb.id !== activeTabId).map(tb => {
                                        const bk = books.find(b => b.id === tb.bookId);
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
                                    <EpubReader
                                        bookData={rightBookData}
                                        targetCfi={tabTargetCfi[rightTabId] || null}
                                        theme={theme} t={t} lang={lang}
                                        readFlow={readFlow} readLayout={readLayout}
                                        updateLocationAndProgress={updateBookLocation}
                                        toggleBookmark={toggleBookmarkInApp}
                                        isFullscreen={false}
                                        onClose={() => { setPanelMode(false); setRightTabId(null); }}
                                        onOpenSettings={() => setSettingsOpen(true)}
                                        onStatsUpdate={pages => setStats(prev => ({ ...prev, pagesTurned: prev.pagesTurned + pages }))}
                                        onOpenBookInfo={() => setActiveBookModal(rightBookData)}
                                        onSaveWord={saveWordToVocab}
                                        aiProvider={aiProvider}
                                        aiApiKey={aiApiKey}
                                    />
                                ) : (
                                    <PdfReader
                                        bookData={rightBookData}
                                        theme={theme} t={t}
                                        isFullscreen={false}
                                        onClose={() => { setPanelMode(false); setRightTabId(null); }}
                                        onOpenSettings={() => setSettingsOpen(true)}
                                        onOpenBookInfo={() => setActiveBookModal(rightBookData)}
                                        updateLocationAndProgress={updateBookLocation}
                                        toggleBookmark={toggleBookmarkInApp}
                                        onStatsUpdate={pages => setStats(prev => ({ ...prev, pagesTurned: prev.pagesTurned + pages }))}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}
                {/* ── WORKSHOP ── */}
                {showWorkshop && (
                    <WorkshopPanel
                        addons={addons}
                        onToggle={toggleAddon}
                        onClose={() => setShowWorkshop(false)}
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
                        <button onClick={() => setDraggedBookId(null)} className="ml-2 opacity-40 hover:opacity-100 transition text-lg leading-none">×</button>
                    </div>
                )}

                {/* ── ACHIEVEMENT TOAST ── */}
                {achievementToast && (() => {
                    const r = RARITY[achievementToast.rarity];
                    return (
                        <div className="fixed bottom-6 right-6 z-[9999] fade-in" style={{ animation: 'fadeInUp 0.4s ease' }}>
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
