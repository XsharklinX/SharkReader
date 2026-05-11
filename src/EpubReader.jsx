// SharkReader - EpubReader Component
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ePub from 'epubjs';
import { Icons } from './icons';
import { getCachedLocations, setCachedLocations } from './locationsCache';

function buildSharkCss({ fontFamily, fontSize, lineHeight, pageMargins, customBg, textJustify, firstLineIndent, letterSpacing, hyphenation, paragraphSpacing }) {
    const fontStack =
        fontFamily === 'Georgia' ? 'Georgia,"Times New Roman",serif' :
        fontFamily === 'Lora' ? '"Lora",Georgia,serif' :
        fontFamily === 'Merriweather' ? '"Merriweather",Georgia,serif' :
        fontFamily === 'Crimson Text' ? '"Crimson Text",Georgia,serif' :
        fontFamily === 'Roboto Slab' ? '"Roboto Slab",Georgia,serif' :
        fontFamily === 'OpenDyslexic' ? '"OpenDyslexic",Arial,sans-serif' :
        'Inter,"Helvetica Neue",Arial,sans-serif';
    const bgRule = customBg ? `background-color:${customBg} !important;` : '';
    const marginPx = pageMargins != null ? pageMargins : 20;
    const pExtras = [];
    if (textJustify) pExtras.push('text-align:justify !important');
    if (firstLineIndent) pExtras.push('text-indent:1.5em !important');
    if (letterSpacing !== 0) pExtras.push(`letter-spacing:${letterSpacing}em !important`);
    if (hyphenation) pExtras.push('hyphens:auto !important;-webkit-hyphens:auto !important');
    if (paragraphSpacing > 0) pExtras.push(`margin-bottom:${paragraphSpacing}em !important`);
    return [
        `html { font-size:${fontSize}% !important; }`,
        `body { font-size:1rem !important; padding-left:${marginPx}px !important; padding-right:${marginPx}px !important; ${bgRule} }`,
        `html,body,p,span,div,li,blockquote,td,th,a,em,strong,h1,h2,h3,h4,h5,h6,cite,q,small { font-family:${fontStack} !important; }`,
        `p,li,blockquote,div { line-height:${lineHeight} !important; font-kerning:normal !important; font-feature-settings:"kern" 1,"liga" 1,"calt" 1 !important; ${pExtras.join(' ')} }`,
    ].join('\n');
}

const EpubReader = ({ bookData, targetCfi, theme, t, lang, readFlow, readLayout, updateLocationAndProgress, toggleBookmark, isFullscreen, focusMode, pageTransition, smartTocAddon, onClose, onOpenSettings, onStatsUpdate, onOpenBookInfo, onSaveWord, aiProvider, aiApiKey, tabs, activeTabId, allBooks, onSwitchTab, onCloseTab, onGoToLibrary }) => {
        const viewerRef = useRef(null);
        const renditionRef = useRef(null);
        const bookRef = useRef(null);
        const locationsReadyRef = useRef(false);
        const tocMapRef = useRef(new Map());          // href → chapter label, built once on load
        const saveCfiThrottleRef = useRef(0);         // timestamp of last CFI+stats save in scroll mode
        const autoScrollRafRef = useRef(null);         // rAF id for auto-scroll
        const autoScrollLastTsRef = useRef(0);
        const navDirectionRef = useRef('next');        // 'next' | 'prev' | 'jump'
        const currentPercentRef = useRef(bookData.progress || 0);

        const [fontSize, setFontSize] = useState(110);
        const [fontFamily, setFontFamily] = useState('Inter');
        const [lineHeight, setLineHeight] = useState(1.6);
        const [pageMargins, setPageMargins] = useState(20);
        const [customBg, setCustomBg] = useState('');
        const [currentCfi, setCurrentCfi] = useState('');
        const [isLoading, setIsLoading] = useState(true);
        const [isReady, setIsReady] = useState(false);
        const [epubError, setEpubError] = useState(null);
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
        const dictCacheRef = useRef({});
        const stylesRef = useRef({ fontFamily: 'Inter', fontSize: 110, lineHeight: 1.6, pageMargins: 20, customBg: '', textJustify: false, firstLineIndent: false, letterSpacing: 0, hyphenation: false, paragraphSpacing: 0 });

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

        // Page transitions
        const viewerWrapRef = useRef(null);
        const pageTransitionRef = useRef(pageTransition || 'slide');
        useEffect(() => { pageTransitionRef.current = pageTransition || 'none'; }, [pageTransition]);

        // Auto-scroll
        const [autoScroll, setAutoScroll] = useState(false);
        const [autoScrollSpeed, setAutoScrollSpeed] = useState(2);
        const [showAutoScrollPanel, setShowAutoScrollPanel] = useState(false);

        const [currentChapterTitle, setCurrentChapterTitle] = useState('');
        const [showChapterHint, setShowChapterHint] = useState(false);
        const prevChapterRef = useRef(null);
        const chapterHintTimerRef = useRef(null);
        const [tocCollapsed, setTocCollapsed] = useState(false);

        // Typography — defaults are all "off" so we never override the book's own CSS
        const [textJustify, setTextJustify] = useState(false);
        const [firstLineIndent, setFirstLineIndent] = useState(false);
        const [letterSpacing, setLetterSpacing] = useState(0);
        const [hyphenation, setHyphenation] = useState(false);
        const [paragraphSpacing, setParagraphSpacing] = useState(0);
        const [columnWidth, setColumnWidth] = useState(() => readFlow === 'scrolled-doc' ? 'narrow' : 'normal');
        const [zenMode, setZenMode] = useState(false);


        // Cleanup chapter hint timer on unmount
        useEffect(() => () => clearTimeout(chapterHintTimerRef.current), []);

        // Block page-turn wheel while any panel/overlay is open
        const anyPanelOpenRef = useRef(false);
        useEffect(() => {
            anyPanelOpenRef.current = showToc || showFontMenu || showBrightness || showSearch ||
                showAutoScrollPanel || !!pendingBookmarkCfi;
        }, [showToc, showFontMenu, showBrightness, showSearch, showAutoScrollPanel, pendingBookmarkCfi]);

        // Focus mode: hide toolbar on mouse idle, show on hover near top
        const focusToolbarHideTimer = useRef(null);
        const [focusToolbarVisible, setFocusToolbarVisible] = useState(true);

        useEffect(() => {
            if (!focusMode) { setFocusToolbarVisible(true); return; }
            const onMove = (e) => {
                // Avoid setState on every pixel — only act on state transitions
                setFocusToolbarVisible(prev => {
                    if (!prev) return true;
                    return prev;
                });
                clearTimeout(focusToolbarHideTimer.current);
                if (e.clientY > 80) {
                    focusToolbarHideTimer.current = setTimeout(() => setFocusToolbarVisible(false), 2500);
                }
            };
            document.addEventListener('mousemove', onMove);
            focusToolbarHideTimer.current = setTimeout(() => setFocusToolbarVisible(false), 2500);
            return () => {
                document.removeEventListener('mousemove', onMove);
                clearTimeout(focusToolbarHideTimer.current);
                setFocusToolbarVisible(true);
            };
        }, [focusMode]);

        useEffect(() => { isHighlightingRef.current = isHighlighting; }, [isHighlighting]);

        // Cerrar popups al click fuera
        useEffect(() => {
            const close = () => { setShowToc(false); setShowFontMenu(false); setShowBrightness(false); };
            document.addEventListener('click', close);
            return () => document.removeEventListener('click', close);
        }, []);

        useEffect(() => {
            if (showSearch && searchInputRef.current) searchInputRef.current.focus();
        }, [showSearch]);

        const getPercentage = useCallback((book, cfi) => {
            if (!book || !cfi) return 0;
            if (locationsReadyRef.current && book.locations && book.locations.total > 0) {
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

        const doTransition = useCallback((direction, action) => {
            const pt = pageTransitionRef.current;
            if (pt === 'none' || !viewerWrapRef.current) { action(); return; }
            const el = viewerWrapRef.current;
            const exitClass = pt === 'fade' ? 'pt-fade-exit' : `pt-${pt}-exit-${direction}`;
            const enterClass = pt === 'fade' ? 'pt-fade-enter' : `pt-${pt}-enter-${direction}`;
            const exitMs = pt === 'slide' ? 150 : pt === 'rise' ? 140 : pt === 'curl' ? 180 : pt === 'cover' ? 80 : 130;
            const enterMs = pt === 'zoom' ? 240 : pt === 'fade' ? 220 : pt === 'curl' ? 300 : pt === 'cover' ? 320 : 260;
            el.classList.add(exitClass);
            setTimeout(() => {
                action();
                el.classList.remove(exitClass);
                el.classList.add(enterClass);
                setTimeout(() => el.classList.remove(enterClass), enterMs);
            }, exitMs);
        }, []);

        const prevPage = useCallback(() => {
            if (renditionRef.current && readFlow === 'paginated') {
                navDirectionRef.current = 'prev';
                doTransition('prev', () => renditionRef.current.prev());
            }
        }, [readFlow, doTransition]);

        const nextPage = useCallback(() => {
            if (renditionRef.current && readFlow === 'paginated') {
                navDirectionRef.current = 'next';
                doTransition('next', () => renditionRef.current.next());
            }
        }, [readFlow, doTransition]);

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
                        width: "100%", height: "100%", spread: readLayout, manager: "continuous", flow: readFlow, allowScriptedContent: true
                    });
                    renditionRef.current = rendition;

                    // In spread/auto mode epubjs manages its own column layout;
                    // adding body padding causes text to overflow outside the virtual page.
                    const paddingPx = readLayout === 'auto' ? "0 8px" : "0 20px";
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
                            // Relay arrow keys from inside the epub iframe to the parent
                            el.addEventListener('keydown', (e) => {
                                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                                    e.preventDefault();
                                    window.dispatchEvent(new CustomEvent('epub-keydown', { detail: { key: e.key } }));
                                }
                            }, { capture: true });
                        }
                        const head = contents.document.head;
                        if (head) {
                            // Google Fonts via @font-face (more reliable in Electron than <link>)
                            if (!head.querySelector('#shark-fonts')) {
                                const fontStyle = contents.document.createElement('style');
                                fontStyle.id = 'shark-fonts';
                                fontStyle.textContent = `
                                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,700;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Roboto+Slab:wght@400;700&display=swap');
                                    @font-face { font-family: 'OpenDyslexic'; src: url('https://fonts.cdnfonts.com/s/14614/OpenDyslexic-Regular.woff') format('woff'), url('https://fonts.gstatic.com/s/opendyslexic/v2/LYjAdGzzklQtCMp9pgfFx7HnLzA.woff2') format('woff2'); }
                                `;
                                head.appendChild(fontStyle);
                            }
                            // Pagination quality: orphans/widows, prevent breaks inside headings/figures
                            if (!head.querySelector('#shark-pagination')) {
                                const style = contents.document.createElement('style');
                                style.id = 'shark-pagination';
                                style.textContent = `
                                    p { orphans: 3; widows: 3; }
                                    h1,h2,h3,h4,h5,h6 { break-after: avoid; page-break-after: avoid; break-inside: avoid; page-break-inside: avoid; }
                                    img, figure, table, pre { break-inside: avoid; page-break-inside: avoid; }
                                `;
                                head.appendChild(style);
                            }
                            {
                                let sStyle = head.querySelector('#shark-styles');
                                if (!sStyle) {
                                    sStyle = contents.document.createElement('style');
                                    sStyle.id = 'shark-styles';
                                    head.appendChild(sStyle);
                                }
                                sStyle.textContent = buildSharkCss(stylesRef.current);
                            }
                            if (readFlow === 'scrolled-doc' && !head.querySelector('#shark-scroll')) {
                                const sStyle = contents.document.createElement('style');
                                sStyle.id = 'shark-scroll';
                                sStyle.textContent = `* { page-break-before: auto !important; page-break-after: auto !important; break-before: auto !important; break-after: auto !important; } body { padding-bottom: 2rem !important; }`;
                                head.appendChild(sStyle);
                            }
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
                                const cacheKey = `${langCode}:${text.toLowerCase()}`;
                                let def = dictCacheRef.current[cacheKey];
                                if (!def) {
                                    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/${langCode}/${text}`);
                                    if (!res.ok) throw new Error('not found');
                                    const data = await res.json();
                                    def = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
                                    if (def) dictCacheRef.current[cacheKey] = def;
                                }
                                if (def) {
                                    const range = selection.getRangeAt(0);
                                    const rect = range.getBoundingClientRect();
                                    setDictionaryPopup({ word: text, def, x: rect.left, y: rect.bottom + 10 });
                                }
                            } catch (e) { }
                            contents.window.getSelection().removeAllRanges();
                        }
                    });

                    book.loaded.navigation.then((nav) => {
                        if (!isMounted || !nav?.toc) return;
                        setToc(nav.toc);
                        // Build flat href→label Map for O(1) chapter lookup in relocated
                        tocMapRef.current = new Map();
                        const buildTocMap = (items) => {
                            items.forEach(item => {
                                if (item.href) tocMapRef.current.set(item.href.split('#')[0], item.label);
                                if (item.subitems?.length) buildTocMap(item.subitems);
                            });
                        };
                        buildTocMap(nav.toc);
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

                    // Locations: load from cache or generate once then cache
                    const finishLocations = () => {
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
                    };

                    setLocationsGenerating(true);
                    getCachedLocations(bookData.id).then(cached => {
                        if (!isMounted) return;
                        if (cached && cached.length > 0) {
                            // Restore from cache — zero CPU cost
                            book.locations.load(cached);
                            finishLocations();
                        } else {
                            // First open: generate and cache for future opens
                            book.locations.generate(1024).then(() => {
                                if (!isMounted) return;
                                // Persist to IDB in background (non-blocking)
                                setCachedLocations(bookData.id, book.locations.save());
                                finishLocations();
                            }).catch(() => { if (isMounted) setLocationsGenerating(false); });
                        }
                    }).catch(() => {
                        // Cache unavailable — fall back to generate
                        book.locations.generate(1024)
                            .then(finishLocations)
                            .catch(() => { if (isMounted) setLocationsGenerating(false); });
                    });

                    rendition.on('relocated', (location) => {
                        if (!isMounted) return;
                        const displayCfi = location.start.cfi;
                        const saveCfi = (location.end && location.end.cfi) ? location.end.cfi : displayCfi;
                        setCurrentCfi(displayCfi);

                        // Cheap UI updates — always run
                        try {
                            const spineItem = bookRef.current.spine.get(displayCfi);
                            if (spineItem && spineItem.index !== undefined) {
                                setCurrentSection(spineItem.index + 1);
                            }
                            // O(1) chapter lookup via pre-built Map (was O(n) recursive traversal)
                            const spineHref = spineItem?.href?.split('#')[0];
                            const ch = spineHref ? tocMapRef.current.get(spineHref) : null;
                            if (ch) {
                                setCurrentChapterTitle(ch);
                                if (prevChapterRef.current !== null && prevChapterRef.current !== ch) {
                                    setShowChapterHint(true);
                                    clearTimeout(chapterHintTimerRef.current);
                                    chapterHintTimerRef.current = setTimeout(() => setShowChapterHint(false), 6000);
                                }
                                prevChapterRef.current = ch;
                            }
                        } catch (e) {}

                        // Expensive saves — throttle to once per 2s in scroll mode to avoid
                        // flooding setBooks+setStats → persist effect on every section boundary
                        const now = Date.now();
                        const isPaginated = readFlow !== 'scrolled-doc';
                        const shouldSave = isPaginated || (now - saveCfiThrottleRef.current > 2000);

                        if (shouldSave) {
                            saveCfiThrottleRef.current = now;
                            let percent = undefined;
                            if (locationsReadyRef.current) {
                                const raw = getPercentage(bookRef.current, displayCfi);
                                const prev = currentPercentRef.current;
                                const delta = raw - prev;
                                // Clamp forward nav to prevent % going backwards at chapter boundaries.
                                // Large jumps (>8%) are TOC/explicit nav — trust them unconditionally.
                                if (Math.abs(delta) > 8 || navDirectionRef.current === 'jump') {
                                    percent = raw;
                                } else if (navDirectionRef.current === 'prev') {
                                    percent = Math.min(prev, raw);
                                } else {
                                    percent = Math.max(prev, raw);
                                }
                                currentPercentRef.current = percent;
                                setCurrentPercent(percent);
                            }
                            let finalCfi = saveCfi;
                            if (!isPaginated && viewerRef.current) {
                                const el = viewerRef.current;
                                const scrollPct = el.scrollHeight > el.clientHeight
                                    ? el.scrollTop / (el.scrollHeight - el.clientHeight)
                                    : 0;
                                finalCfi = `${saveCfi}|scrollpct:${scrollPct.toFixed(4)}`;
                            }
                            updateLocationAndProgress(bookData.id, finalCfi, percent);
                            onStatsUpdate(1);
                        }

                        // Re-apply user styles after every page render (getContents returns fresh content here)
                        try {
                            const css = buildSharkCss(stylesRef.current);
                            renditionRef.current.getContents().forEach(c => {
                                if (!c?.document?.head) return;
                                let el = c.document.head.querySelector('#shark-styles');
                                if (!el) { el = c.document.createElement('style'); el.id = 'shark-styles'; c.document.head.appendChild(el); }
                                el.textContent = css;
                            });
                        } catch (e) {}
                    });

                } catch (error) {
                    console.error("Error loading epub:", error);
                    if (isMounted) {
                        setIsLoading(false);
                        setEpubError(error?.message || 'El archivo EPUB no se pudo abrir.');
                    }
                }
            };

            loadBook();
            return () => {
                isMounted = false;
                if (bookRef.current) bookRef.current.destroy();
            };
        }, [bookData.file, readFlow, readLayout]);

        useEffect(() => { if (isReady && renditionRef.current) renditionRef.current.themes.select(theme); }, [theme, isReady]);
        useEffect(() => {
            const opts = { fontFamily, fontSize, lineHeight, pageMargins, customBg, textJustify, firstLineIndent, letterSpacing, hyphenation, paragraphSpacing };
            stylesRef.current = opts;
            if (!renditionRef.current || !isReady) return;

            const css = buildSharkCss(opts);
            const injectIntoDoc = (doc) => {
                if (!doc?.head) return false;
                let el = doc.head.querySelector('#shark-styles');
                if (!el) { el = doc.createElement('style'); el.id = 'shark-styles'; doc.head.appendChild(el); }
                el.textContent = css;
                return true;
            };

            // Primary: epub.js getContents()
            let injected = false;
            try {
                const contents = renditionRef.current.getContents();
                if (contents && contents.length > 0) {
                    contents.forEach(c => injectIntoDoc(c.document));
                    injected = true;
                }
            } catch (e) {}

            // Fallback: query iframes directly (works when getContents() returns empty)
            if (!injected && viewerRef.current) {
                const iframes = viewerRef.current.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    try { injectIntoDoc(iframe.contentDocument || iframe.contentWindow?.document); injected = true; } catch (e) {}
                });
            }

            // Last resort: force a re-display — hooks.content.register will pick up the new stylesRef
            if (!injected) {
                try {
                    const loc = renditionRef.current.currentLocation();
                    renditionRef.current.display(loc?.start?.cfi || undefined).catch(() => {});
                } catch (e) {}
            }
        }, [fontFamily, fontSize, lineHeight, pageMargins, customBg, textJustify, firstLineIndent, letterSpacing, hyphenation, paragraphSpacing, isReady]);

        // When columnWidth changes, the #viewer div gets a new maxWidth — force epub.js to re-layout.
        useEffect(() => {
            if (!renditionRef.current || !isReady) return;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (!renditionRef.current) return;
                    const loc = renditionRef.current.currentLocation();
                    const cfi = loc?.start?.cfi;
                    renditionRef.current.display(cfi || undefined).catch(() => {});
                });
            });
        }, [columnWidth, isReady]);

        useEffect(() => {
            let wheelTimeout;
            const handleUniversalWheel = (e) => {
                if (readFlow !== 'paginated') return;
                if (anyPanelOpenRef.current) return;
                if (wheelTimeout) return;
                wheelTimeout = setTimeout(() => { wheelTimeout = null; }, 300);
                const delta = e.deltaY || (e.detail && e.detail.deltaY);
                if (delta > 0) nextPage(); else if (delta < 0) prevPage();
            };
            const handleKeyDown = (e) => {
                if (e.key === 'z' || e.key === 'Z') { setZenMode(p => !p); return; }
                if (e.key === 'Escape') { setZenMode(false); return; }
                if (readFlow !== 'paginated') return;
                if (anyPanelOpenRef.current) return;
                if (e.key === 'ArrowLeft') prevPage();
                if (e.key === 'ArrowRight') nextPage();
            };
            const handleEpubKey = (e) => {
                if (readFlow !== 'paginated') return;
                if (anyPanelOpenRef.current) return;
                if (e.detail?.key === 'ArrowLeft') prevPage();
                if (e.detail?.key === 'ArrowRight') nextPage();
            };
            document.addEventListener('keydown', handleKeyDown);
            window.addEventListener('epub-keydown', handleEpubKey);
            if (readFlow === 'paginated') {
                document.addEventListener('wheel', handleUniversalWheel);
                window.addEventListener('epub-wheel', handleUniversalWheel);
            }
            return () => {
                document.removeEventListener('keydown', handleKeyDown);
                window.removeEventListener('epub-keydown', handleEpubKey);
                document.removeEventListener('wheel', handleUniversalWheel);
                window.removeEventListener('epub-wheel', handleUniversalWheel);
                if (wheelTimeout) clearTimeout(wheelTimeout);
            };
        }, [readFlow, prevPage, nextPage]);

        // Auto-scroll — requestAnimationFrame (smooth 60fps, replaces jittery setInterval)
        useEffect(() => {
            if (autoScrollRafRef.current) cancelAnimationFrame(autoScrollRafRef.current);
            autoScrollLastTsRef.current = 0;
            if (!autoScroll || readFlow !== 'scrolled-doc') return;
            const tick = (ts) => {
                if (!viewerRef.current) { autoScrollRafRef.current = requestAnimationFrame(tick); return; }
                if (autoScrollLastTsRef.current) {
                    // Keep same px/s rate as the old setInterval(50ms): speed px per 50ms = speed*20 px/s
                    const dt = Math.min(ts - autoScrollLastTsRef.current, 100);
                    viewerRef.current.scrollTop += autoScrollSpeed * dt / 50;
                }
                autoScrollLastTsRef.current = ts;
                autoScrollRafRef.current = requestAnimationFrame(tick);
            };
            autoScrollRafRef.current = requestAnimationFrame(tick);
            return () => cancelAnimationFrame(autoScrollRafRef.current);
        }, [autoScroll, autoScrollSpeed, readFlow]);

        const jumpToToc = (href) => {
            if (renditionRef.current) {
                navDirectionRef.current = 'jump';
                renditionRef.current.display(href);
                setShowToc(false);
            }
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


        const isBookmarked = currentCfi && bookData.bookmarks.some(b => b.cfi === currentCfi);
        const colPx = { narrow: 640, normal: 760, wide: 960 };
        const isSpread = readFlow === 'paginated' && readLayout === 'auto';
        // In spread mode, double the column width (two pages side-by-side) so the control is still meaningful
        const maxWidthStr = isSpread ? `${(colPx[columnWidth] || 760) * 2 + 80}px` : `${colPx[columnWidth] || 760}px`;

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

        const renderFontMenu = (dock) => (
            <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                    onClick={() => { setShowFontMenu(p => !p); setShowToc(false); setShowBrightness(false); setShowAutoScrollPanel(false); }}
                    className={`font-black text-sm px-2 py-1.5 rounded-xl transition ${showFontMenu ? 'bg-white/25' : 'hover:bg-white/15'}`}
                    title="Tipografía"
                >Aa</button>
                {showFontMenu && (
                    <div className={dock ? "dock-popup active" : "topbar-popup active"} style={{ minWidth: '260px', maxHeight: '480px', overflowY: 'auto' }} onWheel={e => e.stopPropagation()}>
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
                            {['', '#fafafa', '#f5f0e8', '#262626', '#1e1e2e', '#0f1117', '#1a2332', '#2d1b1b'].map(c => (
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
                        <div className="border-t my-2" style={{ borderColor: 'rgba(128,128,128,0.2)' }}></div>
                        <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-2">Tipografía</p>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            <button onClick={() => setTextJustify(p => !p)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex-1 ${textJustify ? 'bg-[var(--highlight)] text-white' : 'hover:bg-black/5 dark:hover:bg-white/10 opacity-60'}`}>
                                Justificado
                            </button>
                            <button onClick={() => setFirstLineIndent(p => !p)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex-1 ${firstLineIndent ? 'bg-[var(--highlight)] text-white' : 'hover:bg-black/5 dark:hover:bg-white/10 opacity-60'}`}>
                                Sangría
                            </button>
                            <button onClick={() => setHyphenation(p => !p)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex-1 ${hyphenation ? 'bg-[var(--highlight)] text-white' : 'hover:bg-black/5 dark:hover:bg-white/10 opacity-60'}`}>
                                Separación
                            </button>
                        </div>
                        <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1">Interletraje</p>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs opacity-50">A·A</span>
                            <input type="range" min="-0.05" max="0.15" step="0.01" value={letterSpacing}
                                onChange={e => setLetterSpacing(parseFloat(e.target.value))}
                                className="flex-1 accent-[var(--highlight)]" />
                            <span className="text-xs font-black opacity-70 min-w-[36px] text-right">{letterSpacing > 0 ? '+' : ''}{(letterSpacing * 1000).toFixed(0)}‰</span>
                        </div>
                        <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1">Espacio entre párrafos</p>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs opacity-50">¶</span>
                            <input type="range" min="0" max="1.5" step="0.1" value={paragraphSpacing}
                                onChange={e => setParagraphSpacing(parseFloat(e.target.value))}
                                className="flex-1 accent-[var(--highlight)]" />
                            <span className="text-xs font-black opacity-70 min-w-[32px] text-right">{paragraphSpacing > 0 ? `+${paragraphSpacing.toFixed(1)}` : '0'}em</span>
                        </div>
                        <div className="border-t my-2" style={{ borderColor: 'rgba(128,128,128,0.2)' }}></div>
                        <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-2">Ancho de columna</p>
                        <div className="flex gap-1.5">
                            {[['narrow', 'Estrecha'], ['normal', 'Normal'], ['wide', 'Ancha']].map(([id, lbl]) => (
                                <button key={id} onClick={() => setColumnWidth(id)}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${columnWidth === id ? 'bg-[var(--highlight)] text-white' : 'hover:bg-black/5 dark:hover:bg-white/10 opacity-60'}`}>
                                    {lbl}
                                </button>
                            ))}
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
                    <div className={dock ? "dock-popup active" : "topbar-popup active"} style={{ minWidth: '200px' }} onWheel={e => e.stopPropagation()}>
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
                    <div className={dock ? "dock-popup active" : "topbar-popup active"} style={{ minWidth: '200px' }} onWheel={e => e.stopPropagation()}>
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
                    <div className={dock ? "dock-popup active text-left" : "topbar-popup active text-left"} onWheel={e => e.stopPropagation()}>
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

                {epubError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 gap-5 p-8 text-center"
                        style={{ backgroundColor: 'var(--bg-color)' }}>
                        <span className="text-6xl">📕</span>
                        <h2 className="text-xl font-black" style={{ color: 'var(--text-color)' }}>Error al cargar el libro</h2>
                        <p className="text-sm opacity-60 max-w-sm font-medium" style={{ color: 'var(--text-color)' }}>
                            {epubError}
                        </p>
                        <p className="text-xs opacity-40 max-w-xs" style={{ color: 'var(--text-color)' }}>
                            El archivo puede estar dañado, tener DRM, o no ser un EPUB válido.
                        </p>
                        <button onClick={onClose}
                            className="px-6 py-3 rounded-2xl font-black text-sm text-white transition hover:opacity-80"
                            style={{ backgroundColor: 'var(--highlight)' }}>
                            ← Volver a la biblioteca
                        </button>
                    </div>
                )}

                {isLoading && !epubError && (
                    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/10 backdrop-blur-sm">
                        <div className="loader"></div>
                    </div>
                )}

                {/* ── BARRA SUPERIOR — Modo Normal ── */}
                {!isFullscreen && !zenMode && (
                    <div className={`flex-shrink-0 flex flex-col text-white shadow-md z-40 focus-mode-toolbar ${focusMode && !focusToolbarVisible ? 'hidden' : ''}`} style={{ background: 'linear-gradient(to right, var(--topbar-bg), var(--highlight))' }}>

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
                                {renderFontMenu(false)}
                                <div className="w-px h-5 bg-white/20 mx-0.5"></div>
                                <button onClick={handleAddBookmark} className="p-1.5 hover:bg-white/15 rounded-xl transition" title={t.bookmarks}>
                                    <Icons.Bookmark fill={isBookmarked ? "#facc15" : "none"} color={isBookmarked ? "#facc15" : "currentColor"} />
                                </button>
                                <button onClick={() => setIsHighlighting(!isHighlighting)}
                                    className={`p-1.5 rounded-xl transition ${isHighlighting ? 'bg-yellow-400 text-yellow-900 shadow-inner' : 'hover:bg-white/15'}`}
                                    title={t.highlight}>
                                    <Icons.Highlighter />
                                </button>
                                <button onClick={() => setShowSearch(p => !p)}
                                    className={`p-1.5 rounded-xl transition ${showSearch ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                    title="Buscar en el libro">
                                    <Icons.Search />
                                </button>
                                <AutoScrollBtn dock={false} />
                                <button onClick={onOpenSettings} className="p-1.5 hover:bg-white/15 rounded-xl transition hidden sm:block" title={t.settings}>
                                    <Icons.Settings />
                                </button>
                                <button onClick={() => setZenMode(true)} className="p-1.5 hover:bg-white/15 rounded-xl transition hidden sm:block" title="Modo Zen (Z)">
                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2M16 4h2a2 2 0 012 2v2M16 20h2a2 2 0 002-2v-2"/></svg>
                                </button>
                                <button onClick={toggleFullscreen} className="p-1.5 hover:bg-white/15 rounded-xl transition" title={t.fullscreen}>
                                    <Icons.Fullscreen />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── DOCK FLOTANTE — Modo Fullscreen ── */}
                {isFullscreen && !zenMode && (
                    <>
                        <div className={`absolute top-4 left-4 right-4 flex items-center justify-between text-white z-40 pointer-events-none transition-all duration-500 ${showToolbar ? 'translate-y-0 opacity-100' : '-translate-y-16 opacity-0'}`}>
                            <button onClick={onClose} className="p-3 bg-slate-900/80 backdrop-blur-xl border border-white/10 hover:bg-black/60 rounded-full transition shadow-xl pointer-events-auto" title="Cerrar"><Icons.Back /></button>
                            <button onClick={toggleFullscreen} className="p-3 bg-slate-900/80 backdrop-blur-xl border border-white/10 hover:bg-black/60 rounded-full transition shadow-xl pointer-events-auto" title="Salir de pantalla completa"><Icons.FullscreenExit /></button>
                        </div>

                        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900/85 backdrop-blur-2xl border border-white/10 text-white z-40 rounded-full px-3 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 ${showToolbar ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-24 opacity-0 scale-95 pointer-events-none'}`}>

                            <TocBtn dock={true} />

                            <div className="w-px h-5 bg-white/10 mx-1"></div>

                            <ZoomControls small />

                            <BrightnessBtn dock={true} />

                            {renderFontMenu(true)}

                            <div className="w-px h-5 bg-white/10 mx-1"></div>

                            <button onClick={handleAddBookmark} className="p-2.5 hover:bg-white/15 rounded-full transition" title={t.bookmarks}>
                                <Icons.Bookmark fill={isBookmarked ? "#facc15" : "none"} color={isBookmarked ? "#facc15" : "currentColor"} />
                            </button>

                            <button onClick={() => setIsHighlighting(!isHighlighting)}
                                className={`p-2.5 rounded-full transition ${isHighlighting ? 'bg-yellow-400 text-yellow-900' : 'hover:bg-white/15'}`}
                                title={t.highlight}>
                                <Icons.Highlighter />
                            </button>

                            <button onClick={() => setShowSearch(p => !p)}
                                className={`p-2.5 rounded-full transition ${showSearch ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                title="Buscar en el libro">
                                <Icons.Search />
                            </button>

                            <AutoScrollBtn dock={true} />

                            <div className="w-px h-5 bg-white/10 mx-1"></div>

                            <button onClick={onOpenSettings} className="p-2.5 hover:bg-white/15 rounded-full transition" title={t.settings}>
                                <Icons.Settings />
                            </button>
                            <button onClick={onOpenBookInfo} className="p-2.5 hover:bg-white/15 rounded-full transition" title="Info del libro">
                                <Icons.Info />
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
                <div ref={viewerWrapRef} className="flex-1 relative flex items-center justify-center overflow-hidden w-full pt-2">
                    <div
                        id="viewer"
                        ref={viewerRef}
                        className={`w-full h-full`}
                        style={{
                            maxWidth: maxWidthStr,
                            margin: '0 auto',
                            overflowY: readFlow === 'scrolled-doc' ? 'auto' : 'hidden',
                            paddingLeft: `${pageMargins}px`,
                            paddingRight: `${pageMargins}px`,
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
                        onClick={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
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


                {/* ── SMART TOC FLOTANTE ── */}
                {smartTocAddon && toc.length > 0 && (
                    <>
                        {tocCollapsed ? (
                            <button
                                onClick={() => setTocCollapsed(false)}
                                className="absolute left-0 z-40 flex flex-col items-center justify-center gap-1 shadow-xl border-r py-4 px-1.5 hover:opacity-100 transition"
                                style={{ top: tabs ? '88px' : '64px', backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', opacity: 0.8 }}
                                title="Mostrar índice">
                                <span className="text-xs">›</span>
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-40" style={{ writingMode: 'vertical-rl' }}>Índice</span>
                            </button>
                        ) : (
                            <div className="absolute left-0 z-40 flex flex-col shadow-xl border-r"
                                style={{ top: tabs ? '88px' : '64px', bottom: '28px', width: '200px', backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', opacity: 0.96 }}
                                onWheel={e => e.stopPropagation()}>
                                <div className="px-3 py-2 border-b flex-shrink-0 flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Índice</span>
                                    <div className="flex items-center gap-1">
                                        {currentChapterTitle && (
                                            <span className="text-[9px] font-bold opacity-40 truncate max-w-[80px]">{currentChapterTitle}</span>
                                        )}
                                        <button onClick={() => setTocCollapsed(true)} className="p-0.5 opacity-40 hover:opacity-100 transition text-base leading-none" title="Colapsar">‹</button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto py-1 px-1">
                                    {toc.map((item, i) => {
                                        const isActive = currentChapterTitle && item.label === currentChapterTitle;
                                        return (
                                            <button key={i} onClick={() => { if (renditionRef.current) renditionRef.current.display(item.href); }}
                                                className={`w-full text-left text-[11px] px-2 py-1.5 rounded-lg transition font-medium mb-0.5 truncate ${isActive ? 'text-white font-black' : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}
                                                style={isActive ? { backgroundColor: 'var(--highlight)' } : {}}>
                                                {item.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Zen mode exit hint */}
                {zenMode && (
                    <button
                        onClick={() => setZenMode(false)}
                        className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-5 py-1.5 rounded-full text-[11px] font-bold opacity-30 hover:opacity-100 hover:scale-105 transition-all duration-200 select-none"
                        style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: 'white', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
                        title="Salir del modo Zen (Esc o Z)">
                        · · ·
                    </button>
                )}

                {/* ── BARRA DE PROGRESO ── */}
                {!zenMode && <div className="flex-shrink-0 relative" style={{ height: '28px', backgroundColor: 'var(--surface-bg)', borderTop: '1px solid var(--border-color)' }}>
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
                        <span className="text-[10px] font-black opacity-40 truncate max-w-[55%]">{currentChapterTitle || bookData.name}</span>
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
                </div>}
            </div>
        );
    };

export default EpubReader;
