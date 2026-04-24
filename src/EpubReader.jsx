// SharkReader - EpubReader Component
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ePub from 'epubjs';
import { Icons } from './icons';

    const EpubReader = ({ bookData, targetCfi, theme, t, lang, readFlow, readLayout, updateLocationAndProgress, toggleBookmark, isFullscreen, onClose, onOpenSettings, onStatsUpdate, onOpenBookInfo, onSaveWord, aiProvider, aiApiKey, tabs, activeTabId, allBooks, onSwitchTab, onCloseTab, onGoToLibrary }) => {
        const viewerRef = useRef(null);
        const renditionRef = useRef(null);
        const bookRef = useRef(null);
        const locationsReadyRef = useRef(false);

        const [fontSize, setFontSize] = useState(110);
        const [fontFamily, setFontFamily] = useState('Inter');
        const [lineHeight, setLineHeight] = useState(1.6);
        const [pageMargins, setPageMargins] = useState(20);
        const [customBg, setCustomBg] = useState('');
        const [currentCfi, setCurrentCfi] = useState('');
        const [isLoading, setIsLoading] = useState(true);
        const [isReady, setIsReady] = useState(false);
        const [locationsGenerating, setLocationsGenerating] = useState(false);
        const [currentPercent, setCurrentPercent] = useState(bookData.progress || 0);
        const [currentSection, setCurrentSection] = useState(0);
        const [totalSections, setTotalSections] = useState(0);

        const [toc, setToc] = useState([]);
        const [showToolbar, setShowToolbar] = useState(true);
        const [showToc, setShowToc] = useState(false);
        const [showFontMenu, setShowFontMenu] = useState(false);
        const [showBrightness, setShowBrightness] = useState(false);
        const [brightness, setBrightness] = useState(100);
        const [dictionaryPopup, setDictionaryPopup] = useState(null);

        const [showSearch, setShowSearch] = useState(false);
        const [searchQuery, setSearchQuery] = useState('');
        const [searchResults, setSearchResults] = useState([]);
        const [isSearching, setIsSearching] = useState(false);
        const searchInputRef = useRef(null);

        const [bookmarkNote, setBookmarkNote] = useState('');
        const [pendingBookmarkCfi, setPendingBookmarkCfi] = useState(null);
        const bookmarkNoteInputRef = useRef(null);

        const [isHighlighting, setIsHighlighting] = useState(false);
        const isHighlightingRef = useRef(isHighlighting);

        // Pomodoro
        const [pomodoroActive, setPomodoroActive] = useState(false);
        const [pomodoroPhase, setPomodoroPhase] = useState('work');
        const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60);
        const [showPomodoro, setShowPomodoro] = useState(false);

        // AI Chat
        // Auto-scroll
        const [autoScroll, setAutoScroll] = useState(false);
        const [autoScrollSpeed, setAutoScrollSpeed] = useState(2);
        const [showAutoScrollPanel, setShowAutoScrollPanel] = useState(false);
        const autoScrollIntervalRef = useRef(null);

        const [showAiChat, setShowAiChat] = useState(false);
        const [aiMessages, setAiMessages] = useState([]);
        const [aiInput, setAiInput] = useState('');
        const [aiLoading, setAiLoading] = useState(false);
        const aiInputRef = useRef(null);
        const aiScrollRef = useRef(null);
        const [currentChapterTitle, setCurrentChapterTitle] = useState('');

        useEffect(() => { isHighlightingRef.current = isHighlighting; }, [isHighlighting]);

        // Cerrar popups al click fuera
        useEffect(() => {
            const close = () => { setShowToc(false); setShowFontMenu(false); setShowBrightness(false); setShowPomodoro(false); };
            document.addEventListener('click', close);
            return () => document.removeEventListener('click', close);
        }, []);

        // Pomodoro countdown
        useEffect(() => {
            if (!pomodoroActive) return;
            const id = setInterval(() => {
                setPomodoroTimeLeft(prev => {
                    if (prev <= 1) {
                        const next = pomodoroPhase === 'work' ? 'break' : 'work';
                        setPomodoroPhase(next);
                        const nextTime = next === 'work' ? 25 * 60 : 5 * 60;
                        try { new Notification(next === 'break' ? '☕ ¡Descanso! 5 min' : '📖 ¡A leer! 25 min', { body: 'Shark Reader' }); } catch (e) { }
                        return nextTime;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(id);
        }, [pomodoroActive, pomodoroPhase]);

        // Auto-scroll AI chat
        useEffect(() => {
            if (aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
        }, [aiMessages, aiLoading]);

        useEffect(() => {
            if (showSearch && searchInputRef.current) searchInputRef.current.focus();
        }, [showSearch]);

        const getPercentage = useCallback((book, cfi) => {
            if (!book || !cfi) return 0;
            if (locationsReadyRef.current && book.locations && book.locations.length > 0) {
                const pct = book.locations.percentageFromCfi(cfi);
                if (pct !== null && pct >= 0) return Math.round(pct * 100);
            }
            if (book.spine) {
                try {
                    const spineItem = book.spine.get(cfi);
                    if (spineItem) return Math.round((spineItem.index / book.spine.length) * 100);
                } catch (e) { }
            }
            return 0;
        }, []);

        const prevPage = useCallback(() => {
            if (renditionRef.current && readFlow === 'paginated') renditionRef.current.prev();
        }, [readFlow]);

        const nextPage = useCallback(() => {
            if (renditionRef.current && readFlow === 'paginated') renditionRef.current.next();
        }, [readFlow]);

        useEffect(() => {
            if (!viewerRef.current) return;

            let isMounted = true;
            setIsReady(false);
            setIsLoading(true);
            locationsReadyRef.current = false;

            const book = ePub();
            bookRef.current = book;

            const loadBook = async () => {
                try {
                    let fileData = bookData.file;
                    if (fileData instanceof Blob) fileData = await fileData.arrayBuffer();
                    if (!isMounted) return;

                    await book.open(fileData);
                    if (!isMounted) return;

                    const rendition = book.renderTo(viewerRef.current, {
                        width: "100%", height: "100%", spread: readLayout, manager: "continuous", flow: readFlow
                    });
                    renditionRef.current = rendition;

                    const paddingPx = readLayout === 'auto' ? "0 40px" : "0 20px";
                    rendition.themes.register("light", { "body": { "background": "transparent", "color": "#0f172a", "padding": `${paddingPx} !important` } });
                    rendition.themes.register("dark", { "body": { "background": "transparent", "color": "#f1f5f9", "padding": `${paddingPx} !important` } });
                    rendition.themes.register("sepia", { "body": { "background": "transparent", "color": "#451a03", "padding": `${paddingPx} !important` } });
                    rendition.themes.default({
                        '::selection': { 'background': 'rgba(255, 255, 0, 0.3)' },
                        '.epubjs-hl': { 'fill': 'yellow', 'background-color': 'rgba(255, 255, 0, 0.4)' }
                    });

                    rendition.hooks.content.register((contents) => {
                        const el = contents.document.documentElement;
                        if (el) {
                            el.addEventListener('wheel', (e) => {
                                window.dispatchEvent(new CustomEvent('epub-wheel', { detail: { deltaY: e.deltaY } }));
                            }, { passive: true });
                        }
                        // Inyectar Google Fonts dentro de cada iframe del epub
                        const head = contents.document.head;
                        if (head && !head.querySelector('#shark-fonts')) {
                            const link = contents.document.createElement('link');
                            link.id = 'shark-fonts';
                            link.rel = 'stylesheet';
                            link.href = 'https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;0,700;1,400&family=Roboto+Slab:wght@400;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap';
                            head.appendChild(link);
                        }
                    });

                    rendition.on('click', () => {
                        setShowToc(false);
                        setShowFontMenu(false);
                        setShowBrightness(false);
                        setDictionaryPopup(null);
                        if (isFullscreen) setShowToolbar(prev => !prev);
                    });

                    rendition.on('markClicked', (cfiRange) => {
                        if (window.confirm("¿Deseas eliminar este subrayado?")) {
                            rendition.annotations.remove(cfiRange, "highlight");
                            toggleBookmark(bookData.id, cfiRange, null, true);
                        }
                    });

                    rendition.on('selected', async (cfiRange, contents) => {
                        const selection = contents.window.getSelection();
                        const text = selection.toString().trim();
                        if (isHighlightingRef.current && text.length > 0) {
                            rendition.annotations.highlight(cfiRange, {}, () => { });
                            toggleBookmark(bookData.id, cfiRange, `[Subrayado] "${text.substring(0, 60)}..."`);
                            contents.window.getSelection().removeAllRanges();
                        } else if (text && text.length > 2 && text.split(' ').length === 1) {
                            try {
                                const langCode = lang === 'es' ? 'es' : 'en';
                                const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/${langCode}/${text}`);
                                if (!res.ok) throw new Error('not found');
                                const data = await res.json();
                                if (data && data[0] && data[0].meanings[0]) {
                                    const range = selection.getRangeAt(0);
                                    const rect = range.getBoundingClientRect();
                                    setDictionaryPopup({ word: text, def: data[0].meanings[0].definitions[0].definition, x: rect.left, y: rect.bottom + 10 });
                                }
                            } catch (e) { }
                            contents.window.getSelection().removeAllRanges();
                        }
                    });

                    book.loaded.navigation.then((nav) => {
                        if (isMounted && nav && nav.toc) setToc(nav.toc);
                    });

                    book.ready.then(() => {
                        if (!isMounted) return;
                        if (book.spine && book.spine.spineItems) {
                            setTotalSections(book.spine.spineItems.length);
                        }
                        if (bookData.bookmarks && bookData.bookmarks.length > 0) {
                            bookData.bookmarks.forEach(bm => {
                                if (bm.note && bm.note.includes('[Subrayado]')) {
                                    rendition.annotations.highlight(bm.cfi, {}, () => { });
                                }
                            });
                        }
                    });

                    // Separar CFI del scroll pct si existe
                    const rawLocation = targetCfi || bookData.lastLocation || undefined;
                    let cleanCfi = rawLocation;
                    let savedScrollPct = null;
                    if (rawLocation && rawLocation.includes('|scrollpct:')) {
                        const parts = rawLocation.split('|scrollpct:');
                        cleanCfi = parts[0];
                        savedScrollPct = parseFloat(parts[1]);
                    }
                    try {
                        await rendition.display(cleanCfi || undefined);
                    } catch (e) {
                        await rendition.display();
                    }
                    // Restaurar scroll exacto en modo continuo
                    if (savedScrollPct !== null && readFlow === 'scrolled-doc') {
                        setTimeout(() => {
                            if (viewerRef.current) {
                                const el = viewerRef.current;
                                el.scrollTop = savedScrollPct * (el.scrollHeight - el.clientHeight);
                            }
                        }, 400);
                    }

                    if (!isMounted) return;
                    setIsReady(true);
                    setIsLoading(false);

                    // Generar locations en background para % preciso
                    setLocationsGenerating(true);
                    book.locations.generate(1024).then(() => {
                        if (!isMounted) return;
                        locationsReadyRef.current = true;
                        setLocationsGenerating(false);
                        const loc = renditionRef.current && renditionRef.current.currentLocation();
                        if (loc && loc.start && loc.start.cfi) {
                            const pct = Math.round((book.locations.percentageFromCfi(loc.start.cfi) || 0) * 100);
                            setCurrentPercent(pct);
                            const saveCfi = (loc.end && loc.end.cfi) ? loc.end.cfi : loc.start.cfi;
                            updateLocationAndProgress(bookData.id, saveCfi, pct);
                        }
                    }).catch(() => { if (isMounted) setLocationsGenerating(false); });

                    rendition.on('relocated', (location) => {
                        if (!isMounted) return;
                        const displayCfi = location.start.cfi;
                        const saveCfi = (location.end && location.end.cfi) ? location.end.cfi : displayCfi;
                        setCurrentCfi(displayCfi);
                        try {
                            const spineItem = bookRef.current.spine.get(displayCfi);
                            if (spineItem && spineItem.index !== undefined) {
                                setCurrentSection(spineItem.index + 1);
                            }
                            // Buscar capítulo actual en TOC por href
                            const findChapter = (items) => {
                                for (const item of items) {
                                    if (item.href && spineItem && spineItem.href &&
                                        item.href.split('#')[0] === spineItem.href.split('#')[0]) return item.label;
                                    if (item.subitems) { const s = findChapter(item.subitems); if (s) return s; }
                                }
                                return null;
                            };
                            const ch = findChapter(bookRef.current.navigation?.toc || []);
                            if (ch) setCurrentChapterTitle(ch);
                        } catch (e) {}
                        const percent = getPercentage(bookRef.current, displayCfi);
                        setCurrentPercent(percent);
                        // En modo scroll, guardar también el porcentaje de scroll como fallback
                        let finalCfi = saveCfi;
                        if (readFlow === 'scrolled-doc' && viewerRef.current) {
                            const el = viewerRef.current;
                            const scrollPct = el.scrollHeight > el.clientHeight
                                ? el.scrollTop / (el.scrollHeight - el.clientHeight)
                                : 0;
                            // Codificar pct de scroll en el CFI como sufijo para restauración
                            finalCfi = `${saveCfi}|scrollpct:${scrollPct.toFixed(4)}`;
                        }
                        updateLocationAndProgress(bookData.id, finalCfi, percent);
                        onStatsUpdate(1);
                    });

                } catch (error) {
                    console.error("Error loading epub:", error);
                    if (isMounted) setIsLoading(false);
                }
            };

            loadBook();
            return () => {
                isMounted = false;
                if (bookRef.current) bookRef.current.destroy();
            };
        }, [bookData.file, readFlow, readLayout]);

        useEffect(() => { if (isReady && renditionRef.current) renditionRef.current.themes.select(theme); }, [theme, isReady]);
        useEffect(() => { if (isReady && renditionRef.current) renditionRef.current.themes.fontSize(`${fontSize}%`); }, [fontSize, isReady]);
        useEffect(() => { if (isReady && renditionRef.current) renditionRef.current.themes.font(fontFamily); }, [fontFamily, isReady]);
        useEffect(() => {
            if (!isReady || !renditionRef.current) return;
            renditionRef.current.themes.override('line-height', `${lineHeight}`);
        }, [lineHeight, isReady]);
        useEffect(() => {
            if (!isReady || !renditionRef.current) return;
            renditionRef.current.themes.override('padding-left', `${pageMargins}px`);
            renditionRef.current.themes.override('padding-right', `${pageMargins}px`);
        }, [pageMargins, isReady]);
        useEffect(() => {
            if (!isReady || !renditionRef.current) return;
            if (customBg) renditionRef.current.themes.override('background-color', customBg);
        }, [customBg, isReady]);

        useEffect(() => {
            let wheelTimeout;
            const handleUniversalWheel = (e) => {
                if (readFlow !== 'paginated') return;
                if (wheelTimeout) return;
                wheelTimeout = setTimeout(() => { wheelTimeout = null; }, 300);
                const delta = e.deltaY || (e.detail && e.detail.deltaY);
                if (delta > 0) nextPage(); else if (delta < 0) prevPage();
            };
            const handleKeyDown = (e) => {
                if (readFlow !== 'paginated') return;
                if (e.key === 'ArrowLeft') prevPage();
                if (e.key === 'ArrowRight') nextPage();
            };
            document.addEventListener('keydown', handleKeyDown);
            if (readFlow === 'paginated') {
                document.addEventListener('wheel', handleUniversalWheel);
                window.addEventListener('epub-wheel', handleUniversalWheel);
            }
            return () => {
                document.removeEventListener('keydown', handleKeyDown);
                document.removeEventListener('wheel', handleUniversalWheel);
                window.removeEventListener('epub-wheel', handleUniversalWheel);
                if (wheelTimeout) clearTimeout(wheelTimeout);
            };
        }, [readFlow, prevPage, nextPage]);

        // Auto-scroll en modo continuo
        useEffect(() => {
            if (autoScrollIntervalRef.current) clearInterval(autoScrollIntervalRef.current);
            if (!autoScroll || readFlow !== 'scrolled-doc' || !viewerRef.current) return;
            autoScrollIntervalRef.current = setInterval(() => {
                if (viewerRef.current) viewerRef.current.scrollTop += autoScrollSpeed;
            }, 50);
            return () => clearInterval(autoScrollIntervalRef.current);
        }, [autoScroll, autoScrollSpeed, readFlow]);

        const jumpToToc = (href) => {
            if (renditionRef.current) { renditionRef.current.display(href); setShowToc(false); }
        };

        const runSearch = async (query) => {
            if (!bookRef.current || !query.trim()) { setSearchResults([]); return; }
            setIsSearching(true);
            try {
                const book = bookRef.current;
                const allResults = [];
                for (const item of book.spine.spineItems) {
                    await item.load(book.load.bind(book));
                    const found = item.find(query.trim());
                    item.unload();
                    found.forEach(r => allResults.push(r));
                    if (allResults.length >= 50) break;
                }
                setSearchResults(allResults);
            } catch (e) {
                setSearchResults([]);
            }
            setIsSearching(false);
        };

        const handleSearchKey = (e) => {
            if (e.key === 'Enter') runSearch(searchQuery);
        };

        const jumpToResult = (cfi) => {
            if (renditionRef.current) { renditionRef.current.display(cfi); setShowSearch(false); }
        };

        const handleAddBookmark = () => {
            if (!renditionRef.current) return;
            const loc = renditionRef.current.currentLocation();
            if (!loc || !loc.start) return;
            const cfi = loc.start.cfi;
            if (bookData.bookmarks.some(b => b.cfi === cfi)) {
                toggleBookmark(bookData.id, cfi, null, true);
            } else {
                setBookmarkNote(`Página ~${currentPercent}%`);
                setPendingBookmarkCfi(cfi);
                setTimeout(() => bookmarkNoteInputRef.current && bookmarkNoteInputRef.current.focus(), 50);
            }
        };

        const confirmBookmark = () => {
            if (pendingBookmarkCfi) {
                toggleBookmark(bookData.id, pendingBookmarkCfi, bookmarkNote.trim() || `Página ~${currentPercent}%`);
                setPendingBookmarkCfi(null);
                setBookmarkNote('');
            }
        };

        const toggleFullscreen = () => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { });
            else if (document.exitFullscreen) document.exitFullscreen();
        };

        const formatPomodoroTime = (secs) => {
            const m = Math.floor(secs / 60).toString().padStart(2, '0');
            const s = (secs % 60).toString().padStart(2, '0');
            return `${m}:${s}`;
        };

        const sendAiMessage = async (overrideText) => {
            const text = (overrideText || aiInput).trim();
            if (!text || aiLoading || !aiApiKey) return;
            const userMsg = { role: 'user', content: text };
            const newMessages = [...aiMessages, userMsg];
            setAiMessages(newMessages);
            setAiInput('');
            setAiLoading(true);
            const currentChapter = currentChapterTitle || (toc.length > 0 ? toc[0].label : '');
            const systemPrompt = `Eres un asistente de lectura para el libro "${bookData.name}"${bookData.author ? ` de ${bookData.author}` : ''}. ${currentChapter ? `Capítulo actual: ${currentChapter}.` : ''} Responde de forma concisa en español.`;
            try {
                let response;
                if (aiProvider === 'gemini') {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${aiApiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            system_instruction: { parts: [{ text: systemPrompt }] },
                            contents: newMessages.map(m => ({
                                role: m.role === 'assistant' ? 'model' : 'user',
                                parts: [{ text: m.content }]
                            }))
                        })
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error.message || 'Gemini API error');
                    response = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';
                } else if (aiProvider === 'openrouter') {
                    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}`, 'HTTP-Referer': 'https://sharkreader.app', 'X-Title': 'SharkReader' },
                        body: JSON.stringify({ model: 'meta-llama/llama-3.2-3b-instruct:free', messages: [{ role: 'system', content: systemPrompt }, ...newMessages], max_tokens: 500 })
                    });
                    const data = await res.json();
                    console.log('[OpenRouter response]', res.status, JSON.stringify(data));
                    if (!res.ok || data.error) throw new Error(`HTTP ${res.status}: ${typeof data.error === 'string' ? data.error : data.error?.message || JSON.stringify(data)}`);
                    response = data.choices?.[0]?.message?.content || 'Sin respuesta.';
                } else if (aiProvider === 'xai') {
                    const res = await fetch('https://api.x.ai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
                        body: JSON.stringify({ model: 'grok-3-mini', messages: [{ role: 'system', content: systemPrompt }, ...newMessages], max_tokens: 500 })
                    });
                    const data = await res.json();
                    console.log('[xAI response]', res.status, JSON.stringify(data));
                    if (!res.ok || data.error) throw new Error(`HTTP ${res.status}: ${typeof data.error === 'string' ? data.error : data.error?.message || JSON.stringify(data)}`);
                    response = data.choices?.[0]?.message?.content || 'Sin respuesta.';
                } else {
                    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
                        body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'system', content: systemPrompt }, ...newMessages], max_tokens: 500 })
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error.message || 'Groq API error');
                    response = data.choices?.[0]?.message?.content || 'Sin respuesta.';
                }
                setAiMessages(prev => [...prev, { role: 'assistant', content: response }]);
            } catch (e) {
                setAiMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message || 'Verifica tu clave API.'}` }]);
            }
            setAiLoading(false);
        };

        const isBookmarked = currentCfi && bookData.bookmarks.some(b => b.cfi === currentCfi);
        const maxWidthStr = readFlow === 'paginated' && readLayout === 'auto' ? '1800px' : '1000px';

        // --- Sub-componentes de controles compartidos ---
        const ZoomControls = ({ small }) => (
            <div className={`flex items-center ${small ? 'gap-0.5' : 'gap-1'} bg-black/20 rounded-xl overflow-hidden`}>
                <button
                    onClick={(e) => { e.stopPropagation(); setFontSize(s => Math.max(50, s - 10)); }}
                    className="px-2 py-1.5 hover:bg-white/20 transition font-bold text-base leading-none"
                    title="Reducir texto"
                >−</button>
                <span className="px-2 text-xs font-black opacity-90 min-w-[40px] text-center">{fontSize}%</span>
                <button
                    onClick={(e) => { e.stopPropagation(); setFontSize(s => Math.min(250, s + 10)); }}
                    className="px-2 py-1.5 hover:bg-white/20 transition font-bold text-base leading-none"
                    title="Aumentar texto"
                >+</button>
            </div>
        );

        const FONTS = [
            { id: 'Inter', label: 'Inter', desc: 'Sans-serif moderna' },
            { id: 'Georgia', label: 'Georgia', desc: 'Serif clásica' },
            { id: 'Lora', label: 'Lora', desc: 'Serif elegante' },
            { id: 'Merriweather', label: 'Merriweather', desc: 'Serif legible' },
            { id: 'Crimson Text', label: 'Crimson Text', desc: 'Serif literaria' },
            { id: 'Roboto Slab', label: 'Roboto Slab', desc: 'Slab serif' },
            { id: 'OpenDyslexic', label: 'OpenDyslexic', desc: 'Para dislexia' },
        ];

        const FontMenuBtn = ({ dock }) => (
            <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                    onClick={() => { setShowFontMenu(p => !p); setShowToc(false); setShowBrightness(false); setShowAutoScrollPanel(false); }}
                    className={`font-black text-sm px-2 py-1.5 rounded-xl transition ${showFontMenu ? 'bg-white/25' : 'hover:bg-white/15'}`}
                    title="Tipografía"
                >Aa</button>
                {showFontMenu && (
                    <div className={dock ? "dock-popup active" : "topbar-popup active"} style={{ minWidth: '260px', maxHeight: '480px', overflowY: 'auto' }}>
                        {/* Fuentes */}
                        <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-2">Fuente</p>
                        <div className="grid grid-cols-2 gap-1 mb-3">
                            {FONTS.map(f => (
                                <button key={f.id} onClick={() => setFontFamily(f.id)}
                                    className={`text-left px-2 py-2 rounded-lg text-xs font-bold transition leading-tight ${fontFamily === f.id ? 'bg-[var(--highlight)] text-white' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
                                    style={{ fontFamily: f.id }}>
                                    <span>{f.label}</span>
                                    <span className="block text-[9px] opacity-60 font-normal">{f.desc}</span>
                                </button>
                            ))}
                        </div>
                        <div className="border-t my-2" style={{ borderColor: 'rgba(128,128,128,0.2)' }}></div>
                        {/* Line-height */}
                        <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1">Espaciado entre líneas</p>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs opacity-50">A</span>
                            <input type="range" min="1.0" max="2.5" step="0.1" value={lineHeight}
                                onChange={e => setLineHeight(parseFloat(e.target.value))}
                                className="flex-1 accent-[var(--highlight)]" />
                            <span className="text-xs opacity-50 text-right">A</span>
                            <span className="text-xs font-black opacity-70 min-w-[28px] text-right">{lineHeight}×</span>
                        </div>
                        {/* Márgenes */}
                        <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1">Márgenes laterales</p>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] opacity-50">|←</span>
                            <input type="range" min="0" max="80" step="5" value={pageMargins}
                                onChange={e => setPageMargins(Number(e.target.value))}
                                className="flex-1 accent-[var(--highlight)]" />
                            <span className="text-[10px] opacity-50">→|</span>
                            <span className="text-xs font-black opacity-70 min-w-[32px] text-right">{pageMargins}px</span>
                        </div>
                        {/* Color de fondo personalizado */}
                        <div className="border-t my-2" style={{ borderColor: 'rgba(128,128,128,0.2)' }}></div>
                        <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-2">Color de fondo</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            {['', '#fafafa', '#f5f0e8', '#1e1e2e', '#0f1117', '#1a2332', '#2d1b1b'].map(c => (
                                <button key={c || 'auto'} onClick={() => setCustomBg(c)}
                                    title={c || 'Automático (según tema)'}
                                    className={`w-6 h-6 rounded-full border-2 transition ${customBg === c ? 'border-[var(--highlight)] scale-125' : 'border-transparent hover:scale-110'}`}
                                    style={{ backgroundColor: c || 'var(--bg-color)', outline: c === '' ? '1px dashed rgba(128,128,128,0.5)' : 'none' }}>
                                    {c === '' && <span className="text-[8px] leading-none block text-center opacity-60">A</span>}
                                </button>
                            ))}
                            <input type="color" value={customBg || '#ffffff'}
                                onChange={e => setCustomBg(e.target.value)}
                                title="Color personalizado"
                                className="w-6 h-6 rounded-full border-0 cursor-pointer p-0"
                                style={{ outline: '2px solid rgba(128,128,128,0.3)' }} />
                        </div>
                    </div>
                )}
            </div>
        );

        const BrightnessBtn = ({ dock }) => (
            <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                    onClick={() => { setShowBrightness(p => !p); setShowToc(false); setShowFontMenu(false); }}
                    className={`p-2 rounded-xl transition ${showBrightness ? 'bg-white/25' : 'hover:bg-white/15'}`}
                    title="Brillo"
                ><Icons.Sun /></button>
                {showBrightness && (
                    <div className={dock ? "dock-popup active" : "topbar-popup active"} style={{ minWidth: '200px' }}>
                        <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-3">Brillo de pantalla</p>
                        <div className="flex items-center gap-2">
                            <span className="text-xs opacity-50">🌑</span>
                            <input
                                type="range" min="10" max="100" value={brightness}
                                onChange={e => setBrightness(Number(e.target.value))}
                                className="w-full accent-[var(--highlight)]"
                            />
                            <span className="text-xs opacity-50">☀️</span>
                        </div>
                        <p className="text-center text-xs font-black opacity-60 mt-2">{brightness}%</p>
                    </div>
                )}
            </div>
        );

        const TocItem = ({ item, depth = 0 }) => {
            const [open, setOpen] = useState(depth === 0);
            const hasSubs = item.subitems && item.subitems.length > 0;
            return (
                <div>
                    <div className="flex items-center" style={{ paddingLeft: `${depth * 12}px` }}>
                        {hasSubs && (
                            <button onClick={e => { e.stopPropagation(); setOpen(p => !p); }}
                                className="p-1 opacity-40 hover:opacity-100 transition flex-shrink-0">
                                <span className={`inline-block transition-transform duration-200 ${open ? 'rotate-90' : 'rotate-0'}`}>›</span>
                            </button>
                        )}
                        <button onClick={() => jumpToToc(item.href)}
                            className={`flex-1 text-left text-xs py-1.5 px-2 hover:bg-[var(--highlight)]/20 font-medium rounded-lg transition truncate ${!hasSubs ? 'ml-5' : ''}`}>
                            {item.label}
                        </button>
                    </div>
                    {hasSubs && open && item.subitems.map((sub, j) => <TocItem key={j} item={sub} depth={depth + 1} />)}
                </div>
            );
        };

        const AutoScrollBtn = ({ dock }) => readFlow === 'scrolled-doc' ? (
            <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                    onClick={() => { setShowAutoScrollPanel(p => !p); setShowToc(false); setShowFontMenu(false); setShowBrightness(false); }}
                    className={`p-2 rounded-xl transition text-base leading-none ${showAutoScrollPanel ? 'bg-white/25' : autoScroll ? 'text-green-400 hover:bg-white/15' : 'hover:bg-white/15'}`}
                    title="Auto-scroll">
                    {autoScroll ? '⏸' : '▶'}
                </button>
                {showAutoScrollPanel && (
                    <div className={dock ? "dock-popup active" : "topbar-popup active"} style={{ minWidth: '200px' }}>
                        <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-3">Auto-scroll</p>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs opacity-50">🐢</span>
                            <input type="range" min="1" max="10" value={autoScrollSpeed}
                                onChange={e => setAutoScrollSpeed(Number(e.target.value))}
                                className="flex-1 accent-[var(--highlight)]" />
                            <span className="text-xs opacity-50">🐇</span>
                            <span className="text-xs font-black opacity-70 min-w-[16px]">{autoScrollSpeed}</span>
                        </div>
                        <button onClick={() => setAutoScroll(p => !p)}
                            className="w-full py-2 rounded-xl font-bold text-sm text-white transition"
                            style={{ backgroundColor: autoScroll ? '#ef4444' : 'var(--highlight)' }}>
                            {autoScroll ? '⏸ Pausar' : '▶ Iniciar auto-scroll'}
                        </button>
                    </div>
                )}
            </div>
        ) : null;

        const PomodoroBtn = ({ dock }) => (
            <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                    onClick={() => { setShowPomodoro(p => !p); setShowToc(false); setShowFontMenu(false); setShowBrightness(false); }}
                    className={`p-2 rounded-xl transition text-base leading-none ${showPomodoro ? 'bg-white/25' : 'hover:bg-white/15'} ${pomodoroActive ? 'text-red-400' : ''}`}
                    title="Pomodoro">
                    🍅
                </button>
                {showPomodoro && (
                    <div className={dock ? "dock-popup active" : "topbar-popup active"} style={{ minWidth: '200px' }}>
                        <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-3">
                            {pomodoroPhase === 'work' ? '🍅 Sesión de lectura' : '☕ Descanso'}
                        </p>
                        <div className="text-center mb-4">
                            <span className={`text-3xl font-black tabular-nums ${pomodoroActive ? (pomodoroPhase === 'work' ? 'text-red-400' : 'text-green-400') : 'opacity-60'}`}>
                                {formatPomodoroTime(pomodoroTimeLeft)}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    if (!pomodoroActive) { try { Notification.requestPermission(); } catch (e) { } }
                                    setPomodoroActive(p => !p);
                                }}
                                className="flex-1 py-2 rounded-xl font-bold text-xs text-white transition"
                                style={{ backgroundColor: 'var(--highlight)' }}>
                                {pomodoroActive ? 'Pausar' : 'Iniciar'}
                            </button>
                            <button
                                onClick={() => { setPomodoroActive(false); setPomodoroPhase('work'); setPomodoroTimeLeft(25 * 60); }}
                                className="px-3 py-2 rounded-xl font-bold text-xs bg-black/10 dark:bg-white/10 hover:opacity-80 transition">
                                Reset
                            </button>
                        </div>
                        {pomodoroActive && (
                            <p className="text-center text-[10px] opacity-40 mt-3 font-medium">
                                {pomodoroPhase === 'work' ? 'Sigue leyendo...' : '¡Tómate un descanso!'}
                            </p>
                        )}
                    </div>
                )}
            </div>
        );

        const TocBtn = ({ dock }) => (
            <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                    onClick={() => { setShowToc(p => !p); setShowFontMenu(false); setShowBrightness(false); }}
                    className={`p-2 rounded-xl transition flex items-center gap-2 ${showToc ? 'bg-black/30' : 'hover:bg-white/15'}`}
                    title={t.toc}
                >
                    <Icons.List />
                    {!dock && <span className="hidden lg:inline text-xs font-bold uppercase">Índice</span>}
                </button>
                {showToc && (
                    <div className={dock ? "dock-popup active text-left" : "topbar-popup active text-left"}>
                        <h4 className="font-black text-[10px] uppercase opacity-50 px-2 py-1 border-b border-slate-700/50 mb-2 tracking-widest">{t.toc}</h4>
                        <div className="max-h-72 overflow-y-auto pr-1">
                            {toc.length === 0
                                ? <p className="text-xs p-2 opacity-70">No hay índice.</p>
                                : toc.map((item, i) => <TocItem key={i} item={item} depth={0} />)
                            }
                        </div>
                    </div>
                )}
            </div>
        );

        return (
            <div className={`w-full h-full flex flex-col relative bg-transparent ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
                style={isFullscreen ? { backgroundColor: 'var(--bg-color)' } : {}}>

                {/* Overlay de Brillo */}
                <div style={{
                    opacity: 1 - (brightness / 100),
                    backgroundColor: '#000',
                    pointerEvents: 'none',
                    zIndex: 999998,
                    position: 'fixed',
                    inset: 0,
                    transition: 'opacity 0.3s ease'
                }} />

                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/10 backdrop-blur-sm">
                        <div className="loader"></div>
                    </div>
                )}

                {/* ── BARRA SUPERIOR — Modo Normal ── */}
                {!isFullscreen && (
                    <div className="flex-shrink-0 flex flex-col text-white shadow-md z-40" style={{ background: 'linear-gradient(to right, var(--topbar-bg), var(--highlight))' }}>

                        {/* Fila 1: pestañas (solo cuando se pasan tabs) */}
                        {tabs && (
                            <div className="flex items-stretch flex-shrink-0 overflow-x-auto overflow-y-hidden select-none" style={{ height: '34px', backgroundColor: 'rgba(0,0,0,0.22)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <button onClick={onGoToLibrary} className="px-3 h-full hover:bg-white/10 transition flex-shrink-0 flex items-center opacity-70 hover:opacity-100" title="Ir a biblioteca">
                                    <Icons.Library />
                                </button>
                                <div className="w-px bg-white/10 flex-shrink-0 self-stretch my-1"></div>
                                {tabs.map(tab => {
                                    const book = allBooks && allBooks.find(b => b.id === tab.bookId);
                                    const isTabActive = tab.id === activeTabId;
                                    return (
                                        <div key={tab.id}
                                            title={book?.name || 'Libro'}
                                            className={`flex items-center gap-1.5 px-3 flex-shrink-0 max-w-[180px] min-w-[80px] cursor-pointer group border-r border-white/10 relative transition-all ${isTabActive ? 'bg-white/15' : 'hover:bg-white/10 opacity-70 hover:opacity-100'}`}
                                            onClick={() => onSwitchTab && onSwitchTab(tab.id)}>
                                            {isTabActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t" />}
                                            <span className="text-white text-[11px] font-semibold truncate flex-1 leading-none">
                                                {book?.name || 'Cargando…'}
                                            </span>
                                            <button
                                                onClick={(e) => onCloseTab && onCloseTab(tab.id, e)}
                                                className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-white hover:bg-white/20 rounded w-4 h-4 flex items-center justify-center flex-shrink-0 transition text-xs leading-none">
                                                ×
                                            </button>
                                        </div>
                                    );
                                })}
                                <button onClick={onGoToLibrary} title="Abrir biblioteca / añadir libro"
                                    className="px-3 h-full text-white/40 hover:text-white hover:bg-white/10 transition flex-shrink-0 flex items-center justify-center text-xl font-light leading-none">
                                    +
                                </button>
                            </div>
                        )}

                        {/* Fila 2: controles de lectura */}
                        <div className="h-14 flex items-center justify-between px-3">
                            {/* Izquierda: back + título (sin tabs) | solo título+info (con tabs) */}
                            {!tabs ? (
                                <div className="flex items-center gap-2 min-w-0">
                                    <button onClick={onClose} className="p-2 hover:bg-black/20 rounded-full transition flex-shrink-0 transform hover:-translate-x-1"><Icons.Back /></button>
                                    <button onClick={onOpenBookInfo} className="flex items-center gap-1.5 hover:bg-black/10 px-2 py-1.5 rounded-xl transition min-w-0">
                                        <span className="font-bold text-base tracking-wide truncate max-w-[150px] sm:max-w-xs">{bookData.name}</span>
                                        <Icons.Info />
                                    </button>
                                </div>
                            ) : (
                                <button onClick={onOpenBookInfo} className="flex items-center gap-1.5 hover:bg-black/10 px-2 py-1 rounded-xl transition min-w-0 max-w-[200px]" title="Info del libro">
                                    <span className="font-bold text-sm tracking-wide truncate opacity-90">{bookData.name}</span>
                                    <Icons.Info className="flex-shrink-0 opacity-60 w-4 h-4" />
                                </button>
                            )}

                            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                                <TocBtn dock={false} />
                                <div className="w-px h-5 bg-white/20 hidden sm:block mx-0.5"></div>
                                <ZoomControls />
                                <BrightnessBtn dock={false} />
                                <FontMenuBtn dock={false} />
                                <div className="w-px h-5 bg-white/20 mx-0.5"></div>
                                <button onClick={handleAddBookmark} className="p-1.5 hover:bg-white/15 rounded-xl transition" title={t.bookmarks}>
                                    <Icons.Bookmark fill={isBookmarked ? "#facc15" : "none"} color={isBookmarked ? "#facc15" : "currentColor"} />
                                </button>
                                <button onClick={() => setIsHighlighting(!isHighlighting)}
                                    className={`p-1.5 rounded-xl transition ${isHighlighting ? 'bg-yellow-400 text-yellow-900 shadow-inner' : 'hover:bg-white/15'}`}
                                    title={t.highlight}>
                                    <Icons.Highlighter />
                                </button>
                                <button onClick={() => { setShowSearch(p => !p); setShowAiChat(false); }}
                                    className={`p-1.5 rounded-xl transition ${showSearch ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                    title="Buscar en el libro">
                                    <Icons.Search />
                                </button>
                                <AutoScrollBtn dock={false} />
                                <PomodoroBtn dock={false} />
                                {aiApiKey && (
                                    <button onClick={() => { setShowAiChat(p => !p); setShowSearch(false); }}
                                        className={`p-1.5 rounded-xl transition text-base leading-none ${showAiChat ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                        title="Asistente IA">
                                        🤖
                                    </button>
                                )}
                                <button onClick={onOpenSettings} className="p-1.5 hover:bg-white/15 rounded-xl transition hidden sm:block" title={t.settings}>
                                    <Icons.Settings />
                                </button>
                                <button onClick={toggleFullscreen} className="p-1.5 hover:bg-white/15 rounded-xl transition" title={t.fullscreen}>
                                    <Icons.Fullscreen />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── DOCK FLOTANTE — Modo Fullscreen ── */}
                {isFullscreen && (
                    <>
                        <div className={`absolute top-4 left-4 right-4 flex items-center justify-between text-white z-40 transition-all duration-500 ${showToolbar ? 'translate-y-0 opacity-100' : '-translate-y-16 opacity-0 pointer-events-none'}`}>
                            <button onClick={onClose} className="p-3 bg-slate-900/80 backdrop-blur-xl border border-white/10 hover:bg-black/60 rounded-full transition shadow-xl"><Icons.Back /></button>
                            <button onClick={onOpenBookInfo} className="bg-slate-900/80 backdrop-blur-xl border border-white/10 px-5 py-2 rounded-full shadow-xl flex items-center gap-2 hover:bg-black/60 transition">
                                <span className="font-bold text-sm truncate max-w-[180px] sm:max-w-sm opacity-90">{bookData.name}</span>
                                <Icons.Info />
                            </button>
                            <button onClick={toggleFullscreen} className="p-3 bg-slate-900/80 backdrop-blur-xl border border-white/10 hover:bg-black/60 rounded-full transition shadow-xl"><Icons.FullscreenExit /></button>
                        </div>

                        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900/85 backdrop-blur-2xl border border-white/10 text-white z-40 rounded-full px-3 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 ${showToolbar ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-24 opacity-0 scale-95 pointer-events-none'}`}>

                            <TocBtn dock={true} />

                            <div className="w-px h-5 bg-white/10 mx-1"></div>

                            <ZoomControls small />

                            <BrightnessBtn dock={true} />

                            <FontMenuBtn dock={true} />

                            <div className="w-px h-5 bg-white/10 mx-1"></div>

                            <button onClick={handleAddBookmark} className="p-2.5 hover:bg-white/15 rounded-full transition" title={t.bookmarks}>
                                <Icons.Bookmark fill={isBookmarked ? "#facc15" : "none"} color={isBookmarked ? "#facc15" : "currentColor"} />
                            </button>

                            <button onClick={() => setIsHighlighting(!isHighlighting)}
                                className={`p-2.5 rounded-full transition ${isHighlighting ? 'bg-yellow-400 text-yellow-900' : 'hover:bg-white/15'}`}
                                title={t.highlight}>
                                <Icons.Highlighter />
                            </button>

                            <button onClick={() => { setShowSearch(p => !p); setShowAiChat(false); }}
                                className={`p-2.5 rounded-full transition ${showSearch ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                title="Buscar en el libro">
                                <Icons.Search />
                            </button>

                            <AutoScrollBtn dock={true} />
                            <PomodoroBtn dock={true} />

                            {aiApiKey && (
                                <button onClick={() => { setShowAiChat(p => !p); setShowSearch(false); }}
                                    className={`p-2.5 rounded-full transition text-base leading-none ${showAiChat ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                    title="Asistente IA">
                                    🤖
                                </button>
                            )}

                            <div className="w-px h-5 bg-white/10 mx-1"></div>

                            <button onClick={onOpenSettings} className="p-2.5 hover:bg-white/15 rounded-full transition" title={t.settings}>
                                <Icons.Settings />
                            </button>
                        </div>
                    </>
                )}

                {/* Zonas de navegación laterales */}
                {readFlow === 'paginated' && (
                    <>
                        <div onClick={prevPage} className="reader-nav-zone" style={{ left: 0 }}>
                            <div className="reader-nav-btn"><Icons.ChevronLeft /></div>
                        </div>
                        <div onClick={nextPage} className="reader-nav-zone" style={{ right: 0 }}>
                            <div className="reader-nav-btn"><Icons.ChevronRight /></div>
                        </div>
                    </>
                )}

                {/* Área del libro */}
                <div className="flex-1 relative flex items-center justify-center overflow-hidden w-full pt-2">
                    <div
                        id="viewer"
                        ref={viewerRef}
                        className="w-full h-full px-8 sm:px-16"
                        style={{
                            maxWidth: maxWidthStr,
                            margin: '0 auto',
                            overflowY: readFlow === 'scrolled-doc' ? 'auto' : 'hidden'
                        }}
                    ></div>

                    {/* Popup Diccionario */}
                    {dictionaryPopup && (
                        <div className="absolute z-50 bg-[var(--surface-bg)] border border-[var(--border-color)] shadow-2xl p-5 rounded-3xl max-w-[300px]"
                            style={{ top: dictionaryPopup.y, left: dictionaryPopup.x }}>
                            <div className="flex justify-between items-start mb-3">
                                <h4 className="font-black text-[var(--highlight)] text-sm uppercase tracking-widest">{dictionaryPopup.word}</h4>
                                <button onClick={() => setDictionaryPopup(null)} className="opacity-50 hover:opacity-100 transition ml-3"><Icons.Close /></button>
                            </div>
                            <p className="text-sm opacity-80 leading-relaxed font-medium mb-3">{dictionaryPopup.def}</p>
                            {onSaveWord && (
                                <button
                                    onClick={() => { onSaveWord(dictionaryPopup.word, dictionaryPopup.def, bookData.id, bookData.name); setDictionaryPopup(null); }}
                                    className="w-full py-2 rounded-xl text-xs font-black text-white transition hover:opacity-80"
                                    style={{ backgroundColor: 'var(--highlight)' }}>
                                    💾 Guardar en vocabulario
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* ── POPUP NOTA DE BOOKMARK ── */}
                {pendingBookmarkCfi && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-sm fade-in"
                        onClick={() => setPendingBookmarkCfi(null)}>
                        <div className="bg-[var(--surface-bg)] rounded-2xl p-6 w-80 shadow-2xl border border-[var(--border-color)]"
                            onClick={e => e.stopPropagation()}>
                            <h3 className="font-black text-base mb-1">Añadir marcador</h3>
                            <p className="text-xs opacity-50 mb-4">Escribe una nota para este punto (opcional)</p>
                            <input
                                ref={bookmarkNoteInputRef}
                                type="text"
                                value={bookmarkNote}
                                onChange={e => setBookmarkNote(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && confirmBookmark()}
                                placeholder={`Página ~${currentPercent}%`}
                                className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3 text-sm font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition mb-4"
                                style={{ color: 'var(--text-color)' }}
                            />
                            <div className="flex gap-2">
                                <button onClick={() => setPendingBookmarkCfi(null)}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-black/5 dark:bg-white/5 hover:opacity-80 transition">
                                    Cancelar
                                </button>
                                <button onClick={confirmBookmark}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition"
                                    style={{ backgroundColor: 'var(--highlight)' }}>
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── PANEL DE BÚSQUEDA ── */}
                {showSearch && (
                    <div className="absolute right-0 bottom-7 w-80 z-50 flex flex-col shadow-2xl border-l fade-in"
                        style={{ top: tabs ? '88px' : '64px', backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                            <div className="flex-1 flex items-center gap-2 bg-black/5 dark:bg-white/5 rounded-xl px-3 py-2">
                                <Icons.Search />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Buscar en el libro..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={handleSearchKey}
                                    className="flex-1 bg-transparent outline-none text-sm font-medium"
                                    style={{ color: 'var(--text-color)' }}
                                />
                            </div>
                            <button onClick={() => runSearch(searchQuery)}
                                className="px-3 py-2 rounded-xl text-white text-xs font-black transition"
                                style={{ backgroundColor: 'var(--highlight)' }}>
                                Ir
                            </button>
                            <button onClick={() => { setShowSearch(false); setSearchResults([]); setSearchQuery(''); }}
                                className="p-2 opacity-50 hover:opacity-100 transition">
                                <Icons.Close />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {isSearching && (
                                <div className="flex items-center justify-center p-8 gap-3 opacity-60">
                                    <div className="loader" style={{ width: 20, height: 20, borderWidth: 2 }}></div>
                                    <span className="text-sm font-bold">Buscando...</span>
                                </div>
                            )}
                            {!isSearching && searchResults.length === 0 && searchQuery && (
                                <p className="p-6 text-sm opacity-50 text-center font-medium">Sin resultados para "{searchQuery}"</p>
                            )}
                            {!isSearching && searchResults.length === 0 && !searchQuery && (
                                <p className="p-6 text-sm opacity-40 text-center">Escribe algo y presiona Enter o "Ir"</p>
                            )}
                            {!isSearching && searchResults.length > 0 && (
                                <div className="p-2">
                                    <p className="text-[10px] font-black uppercase opacity-40 tracking-widest px-3 py-2">
                                        {searchResults.length}{searchResults.length >= 50 ? '+' : ''} resultados
                                    </p>
                                    {searchResults.map((result, i) => (
                                        <button key={i} onClick={() => jumpToResult(result.cfi)}
                                            className="w-full text-left px-3 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition mb-1">
                                            <p className="text-xs leading-relaxed font-medium opacity-80 line-clamp-3"
                                                dangerouslySetInnerHTML={{
                                                    __html: result.excerpt.replace(
                                                        new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                                                        m => `<mark style="background:rgba(250,204,21,0.4);border-radius:3px;padding:0 2px">${m}</mark>`
                                                    )
                                                }}
                                            />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── PANEL DE CHAT IA ── */}
                {showAiChat && (
                    <div className="absolute right-0 bottom-7 w-80 z-50 flex flex-col shadow-2xl border-l fade-in"
                        style={{ top: tabs ? '88px' : '64px', backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                            <div className="flex items-center gap-2">
                                <span className="text-base">🤖</span>
                                <span className="font-black text-sm">Asistente IA</span>
                                {aiProvider && <span className="text-[10px] opacity-40 font-bold uppercase bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full">{aiProvider}</span>}
                            </div>
                            <div className="flex items-center gap-1">
                                {aiMessages.length > 0 && (
                                    <button onClick={() => setAiMessages([])} className="text-[10px] opacity-40 hover:opacity-80 px-2 py-1 rounded-lg transition font-bold">Limpiar</button>
                                )}
                                <button onClick={() => setShowAiChat(false)} className="p-1.5 opacity-50 hover:opacity-100 transition"><Icons.Close /></button>
                            </div>
                        </div>

                        <div ref={aiScrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                            {aiMessages.length === 0 && (
                                <div className="text-center opacity-40 mt-8 px-4">
                                    <p className="text-3xl mb-3">🤖</p>
                                    <p className="text-xs font-medium leading-relaxed">Pregúntame sobre el libro,<br/>el autor o los personajes</p>
                                    <div className="mt-4 flex flex-col gap-2">
                                        {[
                                            '¿De qué trata este libro?',
                                            '¿Quiénes son los personajes principales?',
                                            currentChapterTitle
                                                ? `📖 Resume el capítulo: "${currentChapterTitle}"`
                                                : '📖 Resume lo que he leído hasta ahora',
                                            '💡 Dame una reflexión sobre lo que he leído'
                                        ].map(q => (
                                            <button key={q} onClick={() => sendAiMessage(q)}
                                                className="text-left text-[11px] px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition font-medium opacity-70 hover:opacity-100">
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {aiMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] px-3 py-2.5 rounded-2xl text-xs font-medium leading-relaxed ${msg.role === 'user' ? 'text-white rounded-tr-sm' : 'bg-black/5 dark:bg-white/5 rounded-tl-sm'}`}
                                        style={msg.role === 'user' ? { backgroundColor: 'var(--highlight)' } : {}}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {aiLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-black/5 dark:bg-white/5 px-4 py-3 rounded-2xl rounded-tl-sm">
                                        <div className="flex gap-1.5 items-center">
                                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                            {!aiApiKey && (
                                <p className="text-xs text-center opacity-50 mb-2 font-medium">Configura tu API key en ⚙️ Ajustes</p>
                            )}
                            <div className="flex gap-2">
                                <input
                                    ref={aiInputRef}
                                    type="text"
                                    value={aiInput}
                                    onChange={e => setAiInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendAiMessage()}
                                    placeholder="Pregunta sobre el libro..."
                                    disabled={!aiApiKey || aiLoading}
                                    className="flex-1 bg-black/5 dark:bg-white/5 rounded-xl px-3 py-2 text-xs font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition disabled:opacity-40"
                                    style={{ color: 'var(--text-color)' }}
                                />
                                <button
                                    onClick={sendAiMessage}
                                    disabled={!aiApiKey || aiLoading || !aiInput.trim()}
                                    className="px-3 py-2 rounded-xl text-white text-sm font-black transition disabled:opacity-40 flex-shrink-0"
                                    style={{ backgroundColor: 'var(--highlight)' }}>
                                    ›
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── BARRA DE PROGRESO ── */}
                <div className="flex-shrink-0 relative" style={{ height: '28px', backgroundColor: 'var(--surface-bg)', borderTop: '1px solid var(--border-color)' }}>
                    <div className="h-1.5 absolute top-0 left-0 right-0" style={{ backgroundColor: 'var(--border-color)' }}>
                        <div
                            className="h-full transition-all duration-700 ease-out"
                            style={{
                                width: `${currentPercent}%`,
                                background: 'linear-gradient(90deg, var(--progress-bg), var(--highlight))'
                            }}
                        />
                    </div>
                    <div className="absolute inset-0 flex items-end justify-between px-4 pb-1">
                        <span className="text-[10px] font-black opacity-40 uppercase tracking-widest truncate max-w-[50%]">{bookData.name}</span>
                        <div className="flex items-center gap-3">
                            {locationsGenerating && (
                                <span className="text-[9px] font-bold opacity-40 animate-pulse">Calculando...</span>
                            )}
                            {currentSection > 0 && totalSections > 0 && (
                                <span className="text-[10px] font-bold opacity-50">
                                    Sec. {currentSection} / {totalSections}
                                </span>
                            )}
                            <span className="text-[11px] font-black" style={{ color: 'var(--highlight)' }}>{currentPercent}%</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

export default EpubReader;
