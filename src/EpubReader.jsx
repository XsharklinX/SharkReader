// SharkReader - EpubReader Component
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ePub from 'epubjs';
import { Icons } from './icons';
import { getCachedLocations, setCachedLocations } from './locationsCache';
import EpubReaderSettings, { READING_PRESETS } from './EpubReaderSettings';
import { useHighlightLabels } from './highlightLabels';
import { splitIntoSpeechChunks } from './ttsChunks';

function buildSharkCss({ fontFamily, fontSize, lineHeight, pageMargins, customBg, customText, textJustify, firstLineIndent, letterSpacing, hyphenation, paragraphSpacing, theme }) {
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
    const lines = [
        `@font-face { font-family:"OpenDyslexic"; src:url("https://cdn.jsdelivr.net/npm/opendyslexic@1.0.3/OpenDyslexic-Regular.otf") format("opentype"); font-weight:400; font-style:normal; font-display:swap; }`,
        `html { font-size:${fontSize}% !important; }`,
        `html,body { box-sizing:border-box !important; }`,
        `*,*::before,*::after { box-sizing:inherit !important; }`,
        `body { font-size:1rem !important; margin:0 !important; padding-left:${marginPx}px !important; padding-right:${marginPx}px !important; ${bgRule} }`,
        `html,body,p,span,div,li,blockquote,td,th,a,em,strong,h1,h2,h3,h4,h5,h6,cite,q,small { font-family:${fontStack} !important; }`,
        `p,li,blockquote,div { line-height:${lineHeight} !important; font-kerning:normal !important; font-feature-settings:"kern" 1,"liga" 1,"calt" 1 !important; ${pExtras.join(' ')} }`,
    ];
    if (fontFamily === 'OpenDyslexic') {
        lines.push(
            `body { word-spacing:0.12em !important; }`,
            `p,li,blockquote { text-align:left !important; letter-spacing:${Math.max(letterSpacing || 0, 0.055)}em !important; margin-bottom:${Math.max(paragraphSpacing || 0, 0.45)}em !important; }`,
            `p,li,blockquote,div,span { text-rendering:optimizeLegibility !important; }`,
        );
    }
    // Override hardcoded EPUB backgrounds/colors that break dark and sepia themes
    if (theme === 'dark') {
        lines.push(
            `div,section,aside,article,blockquote,figure,table,thead,tbody,tr,td,th,header,footer,nav,main,dl,dt,dd,form,fieldset,caption,label { background-color:transparent !important; border-color:rgba(255,255,255,0.1) !important; }`,
            `p,span,li,cite,q,figcaption,small,h1,h2,h3,h4,h5,h6,strong,b,em,i,u,s,sub,sup { color:#cbd5e1 !important; }`,
            `a { color:#93c5fd !important; }`,
        );
    } else if (theme === 'sepia') {
        lines.push(
            `div,section,aside,article,blockquote,figure,table,thead,tbody,tr,td,th,header,footer,nav,main,dl,dt,dd { background-color:transparent !important; border-color:rgba(69,26,3,0.2) !important; }`,
            `p,span,li,cite,q,figcaption,small,h1,h2,h3,h4,h5,h6,strong,b,em,i { color:#451a03 !important; }`,
        );
    }
    // Color de texto personalizado — va al final para ganar a las reglas del tema
    if (customText) {
        lines.push(`p,span,li,cite,q,figcaption,small,h1,h2,h3,h4,h5,h6,strong,b,em,i,u,s,sub,sup,div,td,th,dt,dd,blockquote { color:${customText} !important; }`);
    }
    return lines.join('\n');
}

// Voces neuronales del Edge Read Aloud API (requieren internet, calidad casi humana)
const NEURAL_VOICES = [
    { id: 'es-ES-ElviraNeural', label: 'Elvira — España (F)' },
    { id: 'es-ES-AlvaroNeural', label: 'Álvaro — España (M)' },
    { id: 'es-MX-DaliaNeural', label: 'Dalia — México (F)' },
    { id: 'es-MX-JorgeNeural', label: 'Jorge — México (M)' },
    { id: 'es-DO-RamonaNeural', label: 'Ramona — Rep. Dominicana (F)' },
    { id: 'es-DO-EmilioNeural', label: 'Emilio — Rep. Dominicana (M)' },
    { id: 'es-AR-ElenaNeural', label: 'Elena — Argentina (F)' },
    { id: 'es-AR-TomasNeural', label: 'Tomás — Argentina (M)' },
    { id: 'es-CO-SalomeNeural', label: 'Salomé — Colombia (F)' },
    { id: 'es-CO-GonzaloNeural', label: 'Gonzalo — Colombia (M)' },
    { id: 'en-US-AriaNeural', label: 'Aria — English US (F)' },
    { id: 'en-US-GuyNeural', label: 'Guy — English US (M)' },
    { id: 'en-GB-SoniaNeural', label: 'Sonia — English UK (F)' },
];

const HIGHLIGHT_PRESETS = {
    yellow: { label: 'Importante', fill: 'rgba(250, 204, 21, 0.62)' },
    green:  { label: 'Idea',       fill: 'rgba(34, 197, 94, 0.55)'  },
    blue:   { label: 'Duda',       fill: 'rgba(99, 179, 237, 0.58)' },
    pink:   { label: 'Cita',       fill: 'rgba(244, 114, 182, 0.58)'},
};

function formatRemainingText(minutes, lang) {
    if (!minutes || minutes < 1) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (lang === 'en') {
        if (hours > 0) return `${hours}h ${mins}m left`;
        return `${mins}m left`;
    }
    if (hours > 0) return `${hours}h ${mins}min para terminar`;
    return `${mins}min para terminar`;
}

const EpubReader = ({ bookData, targetCfi, theme, t, lang, readFlow, readLayout, updateLocationAndProgress, toggleBookmark, isFullscreen, focusMode, pageTransition, smartTocAddon, dyslexiaAddon, dyslexiaModeActive, onToggleDyslexiaMode, onClose, onOpenSettings, onStatsUpdate, onOpenBookInfo, onSaveWord, aiProvider, aiApiKey, tabs, activeTabId, allBooks, onSwitchTab, onCloseTab, onGoToLibrary, onToggleSpread }) => {
        const viewerRef = useRef(null);
        const renditionRef = useRef(null);
        const bookRef = useRef(null);
        const locationsReadyRef = useRef(false);
        const tocMapRef = useRef(new Map());          // href ←’ chapter label, built once on load
        const saveCfiThrottleRef = useRef(0);         // timestamp of last CFI+stats save in scroll mode
        const autoScrollRafRef = useRef(null);         // rAF id for auto-scroll
        const autoScrollLastTsRef = useRef(0);
        const currentPercentRef = useRef(bookData.progress || 0);
        const readerTimeoutsRef = useRef(new Set());

        const scheduleReaderTimeout = useCallback((callback, delay) => {
            const timer = setTimeout(() => {
                readerTimeoutsRef.current.delete(timer);
                callback();
            }, delay);
            readerTimeoutsRef.current.add(timer);
            return timer;
        }, []);

        const highlightLabels = useHighlightLabels();
        const _bookFontKey = `sr_font_${bookData.id}`;
        const _savedFont = (() => { try { const r = localStorage.getItem(_bookFontKey); return r ? JSON.parse(r) : null; } catch { return null; } })();
        const [fontSize, setFontSize] = useState(_savedFont?.fontSize ?? 110);
        const [fontFamily, setFontFamily] = useState(_savedFont?.fontFamily ?? 'Inter');
        const [lineHeight, setLineHeight] = useState(_savedFont?.lineHeight ?? 1.6);
        const [pageMargins, setPageMargins] = useState(_savedFont?.pageMargins ?? 20);
        const [customBg, setCustomBg] = useState(_savedFont?.customBg ?? '');
        const [customText, setCustomText] = useState(_savedFont?.customText ?? '');
        const [currentCfi, setCurrentCfi] = useState('');
        // Progreso dentro del capítulo (páginas de la sección actual, solo paginado)
        const [chapterPage, setChapterPage] = useState(0);
        const [chapterTotal, setChapterTotal] = useState(0);
        // Historial de posiciones: pila de CFIs previos a saltos (TOC, búsqueda, anotaciones)
        const historyRef = useRef([]);
        const [historyCount, setHistoryCount] = useState(0);
        // Imagen de cita
        const [quotePrompt, setQuotePrompt] = useState(null);   // { text, x, y } popup flotante
        const [quoteModal, setQuoteModal] = useState(null);      // { text } modal con canvas
        const quoteCanvasRef = useRef(null);
        // Lectura en voz alta (TTS)
        const [showTtsPanel, setShowTtsPanel] = useState(false);
        // Posición de escucha guardada de este libro (si hay), recalculada cada
        // vez que se abre el panel — TtsBtn se recrea en cada render y no puede
        // llevar hooks propios sin remontarse, así que esto vive en el nivel
        // superior del componente.
        const savedTtsCfi = useMemo(() => {
            if (!showTtsPanel) return null;
            try { return localStorage.getItem(`sr_tts_pos_${bookData.id}`) || null; } catch { return null; }
        }, [showTtsPanel, bookData.id]);
        const [ttsStatus, setTtsStatus] = useState('idle');      // idle | playing | paused
        const [ttsRate, setTtsRate] = useState(() => { const r = parseFloat(localStorage.getItem('sr_tts_rate')); return Number.isFinite(r) ? r : 1; });
        const [ttsVoiceURI, setTtsVoiceURI] = useState(() => { try { return localStorage.getItem('sr_tts_voice') || ''; } catch { return ''; } });
        const [ttsVoices, setTtsVoices] = useState([]);
        const [ttsEngine, setTtsEngine] = useState(() => { try { return localStorage.getItem('sr_tts_engine') || 'neural'; } catch { return 'neural'; } });
        const [ttsNeuralVoice, setTtsNeuralVoice] = useState(() => { try { return localStorage.getItem('sr_tts_neural_voice') || 'es-ES-ElviraNeural'; } catch { return 'es-ES-ElviraNeural'; } });
        const ttsQueueRef = useRef([]);           // elementos DOM pendientes de leer
        const ttsIndexRef = useRef(0);
        const ttsActiveRef = useRef(false);
        const ttsUttRef = useRef(null);
        const ttsRateRef = useRef(ttsRate);
        const ttsVoiceRef = useRef(ttsVoiceURI);
        const ttsHighlightRef = useRef(null);       // elemento sombreado actualmente
        const stopTtsRef = useRef(() => {});        // acceso a stopTts desde callbacks definidos antes
        const jumpTtsToElementRef = useRef(() => {}); // salta la lectura al párrafo clicado
        const advanceTtsPageRef = useRef(() => {});   // pasa página y sigue leyendo (reusado al pasar página a mano)
        const ttsEngineRef = useRef(ttsEngine);
        const ttsNeuralVoiceRef = useRef(ttsNeuralVoice);
        const ttsAudioRef = useRef(null);           // <audio> del chunk neuronal en reproducción
        const ttsAudioCacheRef = useRef(new Map()); // índice de cola → Promise<audio buffer> (prefetch)
        const [isLoading, setIsLoading] = useState(true);
        const [isReady, setIsReady] = useState(false);
        const [epubError, setEpubError] = useState(null);
        const [locationsGenerating, setLocationsGenerating] = useState(false);
        const [currentPercent, setCurrentPercent] = useState(bookData.progress || 0);
        const [currentSection, setCurrentSection] = useState(0);
        const [totalSections, setTotalSections] = useState(0);

        const [toc, setToc] = useState([]);
        const [copiedAnnotations, setCopiedAnnotations] = useState(false);
        const [annotationSearch, setAnnotationSearch] = useState('');
        const [annotationKindFilter, setAnnotationKindFilter] = useState('all');
        const [annotationColorFilter, setAnnotationColorFilter] = useState('all');
        const [showToolbar, setShowToolbar] = useState(true);
        const [showToc, setShowToc] = useState(false);
        const [showFontMenu, setShowFontMenu] = useState(false);
        const [showBrightness, setShowBrightness] = useState(false);
        const [brightness, setBrightness] = useState(100);
        const [dictionaryPopup, setDictionaryPopup] = useState(null);
        const dictCacheRef = useRef({});
        const stylesRef = useRef({ fontFamily: 'Inter', fontSize: 110, lineHeight: 1.6, pageMargins: 20, customBg: '', customText: '', textJustify: false, firstLineIndent: false, letterSpacing: 0, hyphenation: false, paragraphSpacing: 0, theme: 'dark' });

        const [showSearch, setShowSearch] = useState(false);
        const [searchQuery, setSearchQuery] = useState('');
        const [searchResults, setSearchResults] = useState([]);
        const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
        const [isSearching, setIsSearching] = useState(false);
        const searchInputRef = useRef(null);
        const [showAnnotationsPanel, setShowAnnotationsPanel] = useState(false);

        const [bookmarkNote, setBookmarkNote] = useState('');
        const [pendingBookmarkCfi, setPendingBookmarkCfi] = useState(null);
        const [pendingBookmarkType, setPendingBookmarkType] = useState('bookmark');
        const bookmarkNoteInputRef = useRef(null);

        const [isHighlighting, setIsHighlighting] = useState(false);
        const [highlightColor, setHighlightColor] = useState(() => {
            try { return localStorage.getItem('sr_highlight_color') || 'yellow'; } catch { return 'yellow'; }
        });
        const isHighlightingRef = useRef(isHighlighting);
        const highlightColorRef = useRef(highlightColor);

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
        const [tocSearch, setTocSearch] = useState('');
        const [tocActiveHref, setTocActiveHref] = useState('');

        // Typography — defaults are all "off" so we never override the book's own CSS
        const [textJustify, setTextJustify] = useState(_savedFont?.textJustify ?? false);
        const [firstLineIndent, setFirstLineIndent] = useState(_savedFont?.firstLineIndent ?? false);
        const [letterSpacing, setLetterSpacing] = useState(_savedFont?.letterSpacing ?? 0);
        const [hyphenation, setHyphenation] = useState(_savedFont?.hyphenation ?? false);
        const [paragraphSpacing, setParagraphSpacing] = useState(_savedFont?.paragraphSpacing ?? 0);
        const [columnWidth, setColumnWidth] = useState(() => readFlow === 'scrolled-doc' ? 'narrow' : 'normal');
        const dyslexiaPreviousRef = useRef(null);
        const estimatedRemainingText = useMemo(() => {
            const progress = Number(currentPercent || 0);
            const readingMinutes = Number(bookData.readingMinutes || 0);
            if (progress < 3 || readingMinutes < 3) return '';
            const estimatedTotal = readingMinutes / (progress / 100);
            const remaining = Math.max(1, Math.round(estimatedTotal - readingMinutes));
            return formatRemainingText(remaining, lang);
        }, [bookData.readingMinutes, currentPercent, lang]);

        const currentAnnotations = useMemo(() => {
            return (bookData.bookmarks || []).map((bookmark, index) => {
                const kind = bookmark.kind === 'note'
                    ? 'note'
                    : bookmark.note?.includes('[Subrayado]')
                        ? 'highlight'
                        : 'bookmark';
                const preview = kind === 'highlight'
                    ? String(bookmark.note || '')
                        .replace('[Subrayado] ', '')
                        .replace(/^"|"$/g, '')
                        .replace(/\.\.\.$/, '')
                    : (bookmark.note || (kind === 'note' ? 'Nota' : 'Marcador'));
                return {
                    id: `${bookmark.cfi}:${bookmark.note || ''}:${index}`,
                    cfi: bookmark.cfi,
                    note: bookmark.note || '',
                    preview,
                    date: bookmark.date || '',
                    color: bookmark.color || 'yellow',
                    kind,
                };
            });
        }, [bookData.bookmarks]);

        const annotationStats = useMemo(() => {
            return currentAnnotations.reduce((acc, item) => {
                acc.total += 1;
                acc[item.kind] = (acc[item.kind] || 0) + 1;
                if (item.kind === 'highlight') {
                    acc.colors[item.color] = (acc.colors[item.color] || 0) + 1;
                }
                return acc;
            }, { total: 0, highlight: 0, note: 0, bookmark: 0, colors: {} });
        }, [currentAnnotations]);

        const filteredAnnotations = useMemo(() => {
            const q = annotationSearch.trim().toLowerCase();
            return currentAnnotations.filter(entry => {
                if (annotationKindFilter !== 'all' && entry.kind !== annotationKindFilter) return false;
                if (annotationColorFilter !== 'all' && entry.color !== annotationColorFilter) return false;
                if (!q) return true;
                const label = entry.kind === 'highlight'
                    ? (highlightLabels[entry.color] || '')
                    : entry.kind === 'note' ? 'nota' : 'marcador';
                return [entry.preview, entry.note, label, entry.date]
                    .filter(Boolean)
                    .some(value => String(value).toLowerCase().includes(q));
            });
        }, [annotationColorFilter, annotationKindFilter, annotationSearch, currentAnnotations, highlightLabels]);

        const flattenTocItems = useCallback((items = [], depth = 0, output = []) => {
            items.forEach(item => {
                output.push({ ...item, depth });
                if (item.subitems?.length) flattenTocItems(item.subitems, depth + 1, output);
            });
            return output;
        }, []);

        const flatToc = useMemo(() => flattenTocItems(toc), [flattenTocItems, toc]);


        // Cleanup reader timers on unmount
        useEffect(() => () => {
            clearTimeout(chapterHintTimerRef.current);
            readerTimeoutsRef.current.forEach(timer => clearTimeout(timer));
            readerTimeoutsRef.current.clear();
        }, []);

        // Block page-turn wheel while any panel/overlay is open.
        // showTtsPanel queda fuera a propósito: se deja abierto mientras se escucha,
        // y el propio popup ya corta la propagación de wheel sobre sí mismo.
        const anyPanelOpenRef = useRef(false);
        useEffect(() => {
            anyPanelOpenRef.current = showToc || showFontMenu || showBrightness || showSearch ||
                showAutoScrollPanel || showAnnotationsPanel || !!pendingBookmarkCfi || !!quoteModal;
        }, [showToc, showFontMenu, showBrightness, showSearch, showAutoScrollPanel, showAnnotationsPanel, pendingBookmarkCfi, quoteModal]);

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
        useEffect(() => { highlightColorRef.current = highlightColor; }, [highlightColor]);

        useEffect(() => {
            try { localStorage.setItem('sr_highlight_color', highlightColor); } catch (_) {}
        }, [highlightColor]);

        useEffect(() => {
            if (!dyslexiaAddon) return;
            if (dyslexiaModeActive && !dyslexiaPreviousRef.current) {
                dyslexiaPreviousRef.current = { fontFamily, fontSize, lineHeight, letterSpacing, paragraphSpacing, textJustify };
                setFontFamily('OpenDyslexic');
                setFontSize(prev => Math.max(prev, 118));
                setLineHeight(prev => Math.max(prev, 1.8));
                setLetterSpacing(prev => Math.max(prev, 0.055));
                setParagraphSpacing(prev => Math.max(prev, 0.45));
                setTextJustify(false);
            }
            if (!dyslexiaModeActive && dyslexiaPreviousRef.current) {
                const previous = dyslexiaPreviousRef.current;
                dyslexiaPreviousRef.current = null;
                setFontFamily(previous.fontFamily);
                setFontSize(previous.fontSize);
                setLineHeight(previous.lineHeight);
                setLetterSpacing(previous.letterSpacing);
                setParagraphSpacing(previous.paragraphSpacing);
                setTextJustify(previous.textJustify);
            }
        }, [dyslexiaAddon, dyslexiaModeActive]); // eslint-disable-line react-hooks/exhaustive-deps

        // Cerrar popups al click fuera
        useEffect(() => {
            const close = () => { setShowToc(false); setShowFontMenu(false); setShowBrightness(false); setShowTtsPanel(false); };
            document.addEventListener('click', close);
            return () => document.removeEventListener('click', close);
        }, []);

        useEffect(() => {
            if (!showSearch) return;
            const timer = setTimeout(() => searchInputRef.current?.focus(), 30);
            return () => clearTimeout(timer);
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
                } catch (e) {
                    console.warn('[SharkReader] getPercentage spine lookup failed:', e);
                }
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
            scheduleReaderTimeout(() => {
                action();
                el.classList.remove(exitClass);
                el.classList.add(enterClass);
                scheduleReaderTimeout(() => el.classList.remove(enterClass), enterMs);
            }, exitMs);
        }, [scheduleReaderTimeout]);

        const prevPage = useCallback(() => {
            if (renditionRef.current && readFlow === 'paginated') {
                if (ttsActiveRef.current) stopTtsRef.current(); // navegación manual: cortar lectura
                doTransition('prev', () => renditionRef.current.prev());
            }
        }, [readFlow, doTransition]);

        const nextPage = useCallback(() => {
            if (renditionRef.current && readFlow === 'paginated') {
                // Pasar página hacia adelante mientras se escucha continúa la lectura en la
                // nueva página (misma dirección que el TTS ya sigue) en vez de cortarla —
                // reusa advanceTtsPage, la misma máquina que usa el avance automático. Corta
                // primero el audio en curso (si el usuario avanzó a media frase) para que no
                // se solape con lo que empiece a sonar en la página nueva.
                if (ttsActiveRef.current) {
                    try { window.speechSynthesis.cancel(); } catch (_) {}
                    try { ttsAudioRef.current?.pause(); } catch (_) {}
                    ttsAudioRef.current = null;
                    advanceTtsPageRef.current?.();
                    return;
                }
                doTransition('next', () => renditionRef.current.next());
            }
        }, [readFlow, doTransition]);

        // Guarda la posición actual antes de un salto (TOC, búsqueda, anotación).
        // Definido antes del efecto de teclado que lo usa en sus deps (evita TDZ).
        const pushHistory = useCallback(() => {
            const loc = renditionRef.current?.currentLocation?.();
            const cfi = loc?.start?.cfi;
            if (!cfi) return;
            const stack = historyRef.current;
            if (stack[stack.length - 1] !== cfi) {
                stack.push(cfi);
                if (stack.length > 50) stack.shift();
                setHistoryCount(stack.length);
            }
        }, []);

        const goBackHistory = useCallback(() => {
            const cfi = historyRef.current.pop();
            setHistoryCount(historyRef.current.length);
            if (cfi && renditionRef.current) {
                if (ttsActiveRef.current) stopTtsRef.current();
                renditionRef.current.display(cfi).catch(() => {});
            }
        }, []);

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
                        width: "100%", height: "100%", spread: readLayout, manager: "continuous", flow: readFlow, allowScriptedContent: false
                    });
                    renditionRef.current = rendition;

                    // In spread/auto mode epubjs manages its own column layout;
                    // adding body padding causes text to overflow outside the virtual page.
                    const paddingPx = readLayout === 'auto' ? "0 8px" : "0 20px";
                    rendition.themes.register("light", { "body": { "background": "transparent", "color": "#0f172a", "padding": `${paddingPx} !important` } });
                    rendition.themes.register("dark", { "body": { "background": "transparent", "color": "#f1f5f9", "padding": `${paddingPx} !important` } });
                    rendition.themes.register("sepia", { "body": { "background": "transparent", "color": "#451a03", "padding": `${paddingPx} !important` } });
                    rendition.themes.default({
                        '::selection': { 'background': 'rgba(255, 255, 0, 0.45)' },
                        '.epubjs-hl': { 'fill': 'yellow', 'background-color': 'rgba(255, 255, 0, 0.62)' }
                    });

                    rendition.hooks.content.register((contents) => {
                        const el = contents.document.documentElement;
                        if (el) {
                            el.addEventListener('wheel', (e) => {
                                window.dispatchEvent(new CustomEvent('epub-wheel', { detail: { deltaY: e.deltaY } }));
                            }, { passive: true });
                            // Relay arrow keys from inside the epub iframe to the parent
                            el.addEventListener('keydown', (e) => {
                                if (readFlow !== 'paginated') return;
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

                    rendition.on('click', (e) => {
                        setShowToc(false);
                        setShowFontMenu(false);
                        setShowBrightness(false);
                        setDictionaryPopup(null);
                        setQuotePrompt(null);
                        if (isFullscreen) setShowToolbar(prev => !prev);
                        if (ttsActiveRef.current && e?.target) jumpTtsToElementRef.current?.(e.target);
                    });

                    rendition.on('rendered', (_section, view) => {
                        const doc = view?.document;
                        if (!doc) return;
                        doc.addEventListener('dblclick', async (e) => {
                            const sel = doc.getSelection();
                            const text = sel?.toString().trim().replace(/[^a-zA-ZÀ-ÿ'-]/g, '');
                            if (!text || text.split(' ').length > 1 || text.length < 2) return;
                            const langCode = lang === 'es' ? 'es' : 'en';
                            const cacheKey = `${langCode}:${text.toLowerCase()}`;
                            let def = dictCacheRef.current[cacheKey];
                            try {
                                if (!def) {
                                    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/${langCode}/${text}`);
                                    if (!res.ok) throw new Error('not found');
                                    const data = await res.json();
                                    def = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
                                    if (def) dictCacheRef.current[cacheKey] = def;
                                }
                                if (def) {
                                    const range = sel.getRangeAt(0);
                                    const rect = range.getBoundingClientRect();
                                    setDictionaryPopup({ word: text, def, x: rect.left, y: rect.bottom + 10 });
                                }
                            } catch (_) {}
                        });
                    });

                    rendition.on('markClicked', (cfiRange) => {
                        if (window.confirm("¿Deseas eliminar este subrayado?")) {
                            rendition.annotations.remove(cfiRange, "highlight");
                            toggleBookmark(bookData.id, cfiRange, null, true);
                        }
                    });

                    rendition.on('selected', async (cfiRange, contents) => {
                        try {
                        const selection = contents.window.getSelection();
                        if (!selection) return;
                        const text = selection.toString().trim();
                        if (isHighlightingRef.current && text.length > 0) {
                            const activeHighlightColor = highlightColorRef.current || 'yellow';
                            const highlightStyle = { fill: HIGHLIGHT_PRESETS[activeHighlightColor]?.fill || HIGHLIGHT_PRESETS.yellow.fill };
                            try { rendition.annotations.highlight(cfiRange, {}, () => { }, undefined, highlightStyle); } catch (_) {}
                            toggleBookmark(bookData.id, cfiRange, `[Subrayado] "${text.substring(0, 60)}..."`, false, { color: activeHighlightColor, kind: 'highlight' });
                            try { contents.window.getSelection()?.removeAllRanges(); } catch (_) {}
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
                            } catch (err) {
                                if (err?.message !== 'not found') console.warn('[SharkReader] dictionary lookup failed:', err);
                            }
                            try { contents.window.getSelection()?.removeAllRanges(); } catch (_) {}
                        } else if (text && text.split(/\s+/).length >= 3) {
                            // Selección de frase: ofrecer crear imagen de cita
                            try {
                                const range = selection.getRangeAt(0);
                                const rect = range.getBoundingClientRect();
                                setQuotePrompt({ text: text.slice(0, 500), x: rect.left, y: rect.bottom + 10 });
                            } catch (_) {}
                        }
                        } catch (err) {
                            console.warn('[SharkReader] selectionchanged handler error:', err);
                        }
                    });

                    book.loaded.navigation.then((nav) => {
                        if (!isMounted || !nav?.toc) return;
                        setToc(nav.toc);
                        // Build flat href←’label Map for O(1) chapter lookup in relocated
                        tocMapRef.current = new Map();
                        const buildTocMap = (items) => {
                            items.forEach(item => {
                                if (item.href) tocMapRef.current.set(item.href.split('#')[0], item.label);
                                if (item.subitems?.length) buildTocMap(item.subitems);
                            });
                        };
                        buildTocMap(nav.toc);
                    }).catch(() => {});

                    book.ready.then(() => {
                        if (!isMounted) return;
                        if (book.spine && book.spine.spineItems) {
                            setTotalSections(book.spine.spineItems.length);
                        }
                        if (bookData.bookmarks && bookData.bookmarks.length > 0) {
                            bookData.bookmarks.forEach(bm => {
                                if (bm.note && bm.note.includes('[Subrayado]')) {
                                    const highlightStyle = { fill: HIGHLIGHT_PRESETS[bm.color || 'yellow']?.fill || HIGHLIGHT_PRESETS.yellow.fill };
                                    try { rendition.annotations.highlight(bm.cfi, {}, () => { }, undefined, highlightStyle); } catch (_) {}
                                } else if (bm.kind === 'note' && bm.cfi) {
                                    // Marca de nota visible en el texto + tooltip con el contenido.
                                    const noteText = (bm.note || 'Nota').slice(0, 280);
                                    try {
                                        rendition.annotations.underline(bm.cfi, {}, () => {}, 'shark-note-mark', {
                                            'border-bottom': '2px dotted var(--highlight, #6366f1)',
                                            'cursor': 'help',
                                        });
                                        // Tooltip nativo en el elemento de anotación creado por epub.js
                                        scheduleReaderTimeout(() => {
                                            try {
                                                rendition.getContents().forEach(c => {
                                                    c.document?.querySelectorAll('.shark-note-mark')?.forEach(el => { if (!el.getAttribute('title')) el.setAttribute('title', noteText); });
                                                });
                                            } catch (_) {}
                                        }, 300);
                                    } catch (_) {}
                                }
                            });
                        }
                    }).catch(() => {});

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
                        scheduleReaderTimeout(() => {
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
                            // Progreso dentro del capítulo: página X de Y de la sección actual
                            const displayed = location.start.displayed;
                            if (displayed && displayed.total > 0) {
                                setChapterPage(displayed.page || 0);
                                setChapterTotal(displayed.total || 0);
                            } else {
                                setChapterPage(0);
                                setChapterTotal(0);
                            }
                            const spineItem = bookRef.current.spine.get(displayCfi);
                            if (spineItem && spineItem.index !== undefined) {
                                setCurrentSection(spineItem.index + 1);
                            }
                            // O(1) chapter lookup via pre-built Map (was O(n) recursive traversal)
                            const spineHref = spineItem?.href?.split('#')[0];
                            if (spineHref) setTocActiveHref(spineHref);
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
                        } catch (e) {
                            console.warn('[SharkReader] chapter hint update failed:', e);
                        }

                        // Expensive saves — throttle to once per 2s in scroll mode to avoid
                        // flooding setBooks+setStats ←’ persist effect on every section boundary
                        const now = Date.now();
                        const isPaginated = readFlow !== 'scrolled-doc';
                        const shouldSave = isPaginated || (now - saveCfiThrottleRef.current > 2000);

                        if (shouldSave) {
                            saveCfiThrottleRef.current = now;
                            let percent = undefined;
                            if (locationsReadyRef.current) {
                                const raw = getPercentage(bookRef.current, displayCfi);
                                const prev = currentPercentRef.current;
                                percent = raw;
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
                        } catch (e) {
                            console.warn('[SharkReader] shark-styles inject failed:', e);
                        }
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
                if (bookRef.current) {
                    try { bookRef.current.destroy(); } catch (_) {}
                    bookRef.current = null;
                }
            };
        }, [bookData.file, readFlow, readLayout, scheduleReaderTimeout]);

        useEffect(() => {
            if (!isReady || !renditionRef.current) return;
            renditionRef.current.themes.select(theme);
            // Re-inject CSS immediately so dark/sepia overrides take effect on current page
            stylesRef.current = { ...stylesRef.current, theme };
            const css = buildSharkCss(stylesRef.current);
            try {
                renditionRef.current.getContents().forEach(c => {
                    if (!c?.document?.head) return;
                    let el = c.document.head.querySelector('#shark-styles');
                    if (!el) { el = c.document.createElement('style'); el.id = 'shark-styles'; c.document.head.appendChild(el); }
                    el.textContent = css;
                });
            } catch (_) {}
        }, [theme, isReady]);
        useEffect(() => {
            const opts = { fontFamily, fontSize, lineHeight, pageMargins, customBg, customText, textJustify, firstLineIndent, letterSpacing, hyphenation, paragraphSpacing, theme };
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
            } catch (e) {
                console.warn('[SharkReader] getContents() style inject failed:', e);
            }

            // Fallback: query iframes directly (works when getContents() returns empty)
            if (!injected && viewerRef.current) {
                const iframes = viewerRef.current.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    try { injectIntoDoc(iframe.contentDocument || iframe.contentWindow?.document); injected = true; } catch (e) {
                        console.warn('[SharkReader] iframe style inject failed:', e);
                    }
                });
            }

            // Last resort: force a re-display — hooks.content.register will pick up the new stylesRef
            if (!injected) {
                try {
                    const scrollState = readFlow === 'scrolled-doc' && viewerRef.current
                        ? {
                            top: viewerRef.current.scrollTop,
                            ratio: viewerRef.current.scrollHeight > viewerRef.current.clientHeight
                                ? viewerRef.current.scrollTop / (viewerRef.current.scrollHeight - viewerRef.current.clientHeight)
                                : 0,
                        }
                        : null;
                    const loc = renditionRef.current.currentLocation();
                    renditionRef.current.display(loc?.start?.cfi || undefined).then(() => {
                        if (!scrollState || !viewerRef.current) return;
                        requestAnimationFrame(() => {
                            if (!viewerRef.current) return;
                            const targetTop = viewerRef.current.scrollHeight > viewerRef.current.clientHeight
                                ? scrollState.ratio * (viewerRef.current.scrollHeight - viewerRef.current.clientHeight)
                                : scrollState.top;
                            viewerRef.current.scrollTop = Number.isFinite(targetTop) ? targetTop : scrollState.top;
                        });
                    }).catch(() => {});
                } catch (e) {
                    console.warn('[SharkReader] force re-display fallback failed:', e);
                }
            }

            if (readFlow === 'paginated') {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        try {
                            renditionRef.current?.resize?.();
                        } catch (e) {
                            console.warn('[SharkReader] paginated style relayout failed:', e);
                        }
                    });
                });
            }
        }, [fontFamily, fontSize, lineHeight, pageMargins, customBg, customText, textJustify, firstLineIndent, letterSpacing, hyphenation, paragraphSpacing, theme, isReady, readFlow]);

        useEffect(() => {
            try { localStorage.setItem(_bookFontKey, JSON.stringify({ fontSize, fontFamily, lineHeight, pageMargins, paragraphSpacing, textJustify, firstLineIndent, letterSpacing, hyphenation, customBg, customText })); } catch (_) {}
        }, [_bookFontKey, fontSize, fontFamily, lineHeight, pageMargins, paragraphSpacing, textJustify, firstLineIndent, letterSpacing, hyphenation, customBg, customText]);

        // When columnWidth changes, the #viewer div gets a new maxWidth — force epub.js to re-layout.
        useEffect(() => {
            if (readFlow !== 'paginated' || !renditionRef.current || !isReady) return;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (!renditionRef.current) return;
                    const loc = renditionRef.current.currentLocation();
                    const cfi = loc?.start?.cfi;
                    renditionRef.current.display(cfi || undefined).catch(() => {});
                });
            });
        }, [columnWidth, isReady, readFlow]);

        useEffect(() => {
            let wheelTimeout;
            const handleUniversalWheel = (e) => {
                if (readFlow !== 'paginated') return;
                if (anyPanelOpenRef.current) return;
                if (wheelTimeout) return;
                wheelTimeout = scheduleReaderTimeout(() => { wheelTimeout = null; }, 300);
                const delta = e.deltaY || (e.detail && e.detail.deltaY);
                if (delta > 0) nextPage(); else if (delta < 0) prevPage();
            };
            const handleKeyDown = (e) => {
                const target = e.target;
                if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
                if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBackHistory(); return; }
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
        }, [readFlow, prevPage, nextPage, scheduleReaderTimeout, goBackHistory]);

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
                if (ttsActiveRef.current) stopTtsRef.current();
                pushHistory();
                renditionRef.current.display(href);
                setShowToc(false);
            }
        };

        // ── LECTURA EN VOZ ALTA (Web Speech API) ──
        useEffect(() => {
            if (!window.speechSynthesis) return;
            const load = () => setTtsVoices(window.speechSynthesis.getVoices() || []);
            load();
            window.speechSynthesis.addEventListener?.('voiceschanged', load);
            return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load);
        }, []);

        useEffect(() => {
            ttsRateRef.current = ttsRate;
            try { localStorage.setItem('sr_tts_rate', String(ttsRate)); } catch (_) {}
        }, [ttsRate]);

        useEffect(() => {
            ttsVoiceRef.current = ttsVoiceURI;
            try { localStorage.setItem('sr_tts_voice', ttsVoiceURI); } catch (_) {}
        }, [ttsVoiceURI]);

        useEffect(() => {
            ttsEngineRef.current = ttsEngine;
            try { localStorage.setItem('sr_tts_engine', ttsEngine); } catch (_) {}
        }, [ttsEngine]);

        useEffect(() => {
            ttsNeuralVoiceRef.current = ttsNeuralVoice;
            try { localStorage.setItem('sr_tts_neural_voice', ttsNeuralVoice); } catch (_) {}
        }, [ttsNeuralVoice]);

        // ── Utilidades TTS ──
        // Elementos de bloque legibles de un documento, excluyendo los que contienen
        // otros bloques (evita leer un blockquote y luego sus <p> internos dos veces).
        const TTS_BLOCK_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li,blockquote';
        const ttsBlocksOf = useCallback((doc) => {
            if (!doc?.body) return [];
            return Array.from(doc.body.querySelectorAll(TTS_BLOCK_SELECTOR)).filter(el =>
                (el.innerText || '').trim().length > 1 && !el.querySelector(TTS_BLOCK_SELECTOR)
            );
        }, []);

        const ensureTtsStyles = useCallback((doc) => {
            if (!doc?.head || doc.head.querySelector('#shark-tts-style')) return;
            const style = doc.createElement('style');
            style.id = 'shark-tts-style';
            style.textContent = `
                .shark-tts-active {
                    background: rgba(56, 189, 248, 0.20) !important;
                    box-shadow: 0 0 0 5px rgba(56, 189, 248, 0.20);
                    border-radius: 4px;
                    transition: background 0.25s ease;
                }
            `;
            doc.head.appendChild(style);
        }, []);

        const clearTtsHighlight = useCallback(() => {
            try { ttsHighlightRef.current?.classList?.remove('shark-tts-active'); } catch (_) {}
            ttsHighlightRef.current = null;
        }, []);

        // Índice del bloque que contiene un nodo (subiendo por ancestros)
        const blockIndexOf = (node, blocks) => {
            let el = node?.nodeType === 1 ? node : node?.parentElement;
            while (el) {
                const idx = blocks.indexOf(el);
                if (idx !== -1) return idx;
                el = el.parentElement;
            }
            return -1;
        };

        // Convierte bloques DOM en una cola de trozos {el, text} cortos (frases,
        // fundiendo diálogo breve). Esto es lo que hace que cambiar voz/velocidad
        // reinicie cerca de donde iba el usuario, no desde el principio del párrafo,
        // y que cada síntesis sea rápida en vez de esperar un párrafo entero.
        //
        // boundaries.start/end recortan el PRIMER/ÚLTIMO bloque a partir de un punto
        // exacto del DOM: cuando un párrafo queda cortado justo en el borde de página
        // (media frase en esta página, media en la siguiente), sin esto se leería el
        // párrafo completo — incluida la mitad que está fuera de pantalla.
        const TTS_CHUNK_MAX_LEN = 200;
        const buildTtsQueue = useCallback((blocks, boundaries = {}) => {
            const { start, end } = boundaries;
            const queue = [];
            blocks.forEach((el, i) => {
                const useStart = i === 0 && start && el.contains(start.node);
                const useEnd = i === blocks.length - 1 && end && el.contains(end.node);
                let text = null;
                if (useStart || useEnd) {
                    try {
                        const range = el.ownerDocument.createRange();
                        if (useStart) range.setStart(start.node, start.offset); else range.setStart(el, 0);
                        if (useEnd) range.setEnd(end.node, end.offset); else range.setEnd(el, el.childNodes.length);
                        text = range.toString();
                    } catch (_) { text = null; }
                }
                if (text == null) text = el.innerText;
                text = (text || '').trim();
                splitIntoSpeechChunks(text, TTS_CHUNK_MAX_LEN).forEach(chunkText => {
                    queue.push({ el, text: chunkText });
                });
            });
            return queue;
        }, []);

        // Bloques legibles EN PANTALLA ahora mismo, en orden de lectura, más los
        // límites exactos del recorte de página (solo en modo paginado — en modo
        // scroll el contenido fluye sin cortes duros y no hace falta recortar).
        const getVisibleTtsBlocks = useCallback(() => {
            const rendition = renditionRef.current;
            const loc = rendition?.currentLocation?.();
            if (!rendition || !loc?.start?.cfi) return { blocks: [], start: null, end: null };

            if (readFlow === 'scrolled-doc') {
                const viewer = viewerRef.current;
                const vr = viewer?.getBoundingClientRect();
                if (!vr) return { blocks: [], start: null, end: null };
                const allBlocks = [];
                (rendition.getContents() || []).forEach(c => {
                    const doc = c.document;
                    if (!doc?.body) return;
                    ensureTtsStyles(doc);
                    const iframe = doc.defaultView?.frameElement;
                    const ifr = iframe?.getBoundingClientRect();
                    if (!ifr) return;
                    ttsBlocksOf(doc).forEach(el => {
                        const r = el.getBoundingClientRect();
                        allBlocks.push({ el, absTop: r.top + ifr.top, absBottom: r.bottom + ifr.top });
                    });
                });
                allBlocks.sort((a, b) => a.absTop - b.absTop);
                const startIdx = allBlocks.findIndex(b => b.absBottom > vr.top + 8 && b.absTop < vr.bottom - 8);
                if (startIdx === -1) return { blocks: [], start: null, end: null };
                return { blocks: allBlocks.slice(startIdx).map(b => b.el), start: null, end: null };
            }

            // Paginado: rango visible exacto vía CFI
            let startRange = null;
            let endRange = null;
            try { startRange = rendition.getRange(loc.start.cfi); } catch (_) {}
            try { endRange = loc.end?.cfi ? rendition.getRange(loc.end.cfi) : null; } catch (_) {}
            const doc = startRange?.startContainer?.ownerDocument;
            if (!doc?.body) return { blocks: [], start: null, end: null };
            ensureTtsStyles(doc);
            const blocks = ttsBlocksOf(doc);
            if (!blocks.length) return { blocks: [], start: null, end: null };
            let startIdx = blockIndexOf(startRange.startContainer, blocks);
            if (startIdx === -1) startIdx = 0;
            let endIdx = endRange && endRange.startContainer.ownerDocument === doc
                ? blockIndexOf(endRange.startContainer, blocks)
                : blocks.length - 1;
            if (endIdx === -1) endIdx = blocks.length - 1;
            return {
                blocks: blocks.slice(startIdx, endIdx + 1),
                start: { node: startRange.startContainer, offset: startRange.startOffset },
                end: endRange ? { node: endRange.startContainer, offset: endRange.startOffset } : null,
            };
        }, [readFlow, ensureTtsStyles, ttsBlocksOf]);

        // Cola de lectura: todo lo visible en la página/pantalla actual, recortado
        // en los bordes si algún párrafo queda partido, troceado en frases.
        const collectVisibleTtsQueue = useCallback(() => {
            const { blocks, start, end } = getVisibleTtsBlocks();
            return buildTtsQueue(blocks, { start, end });
        }, [getVisibleTtsBlocks, buildTtsQueue]);

        const stopTts = useCallback(() => {
            // Recordar dónde se quedó la escucha (solo si de verdad estaba activa,
            // para no pisar la posición guardada con paradas redundantes/en vacío).
            if (ttsActiveRef.current) {
                try {
                    const cfi = renditionRef.current?.currentLocation?.()?.start?.cfi;
                    if (cfi) localStorage.setItem(`sr_tts_pos_${bookData.id}`, cfi);
                } catch (_) {}
            }
            ttsActiveRef.current = false;
            ttsUttRef.current = null;
            ttsQueueRef.current = [];
            ttsIndexRef.current = 0;
            clearTtsHighlight();
            try { window.speechSynthesis?.cancel(); } catch (_) {}
            try { ttsAudioRef.current?.pause(); } catch (_) {}
            ttsAudioRef.current = null;
            ttsAudioCacheRef.current.clear();
            setTtsStatus('idle');
        }, [clearTtsHighlight, bookData.id]);
        useEffect(() => { stopTtsRef.current = stopTts; }, [stopTts]);

        // Sintetiza (y cachea) el audio neuronal de un índice de la cola — permite prefetch
        const fetchNeuralAudio = useCallback((index) => {
            const chunk = ttsQueueRef.current[index];
            const text = (chunk?.text || '').trim();
            if (!text || !window.electronAPI?.synthesizeNeuralTts) return Promise.resolve(null);
            const cache = ttsAudioCacheRef.current;
            if (!cache.has(index)) {
                const pct = Math.round((ttsRateRef.current - 1) * 100);
                cache.set(index, window.electronAPI.synthesizeNeuralTts({
                    text,
                    voice: ttsNeuralVoiceRef.current,
                    rate: `${pct >= 0 ? '+' : ''}${pct}%`,
                }).catch(() => null));
            }
            return cache.get(index);
        }, []);

        // Centrar suavemente el párrafo activo en modo scroll (coords iframe → contenedor)
        const scrollTtsElIntoView = useCallback((el) => {
            if (readFlow !== 'scrolled-doc') return;
            const viewer = viewerRef.current;
            const iframe = el?.ownerDocument?.defaultView?.frameElement;
            if (!viewer || !iframe) return;
            try {
                const ifr = iframe.getBoundingClientRect();
                const vr = viewer.getBoundingClientRect();
                const r = el.getBoundingClientRect();
                const delta = (r.top + ifr.top) - (vr.top + viewer.clientHeight * 0.35);
                if (Math.abs(delta) > 30) viewer.scrollTo({ top: viewer.scrollTop + delta, behavior: 'smooth' });
            } catch (_) {}
        }, [readFlow]);

        // Al agotar la página visible en modo paginado, pasa página y sigue leyendo.
        // depth evita bucles si una página no aporta bloques nuevos (párrafo partido).
        // speakTtsElRef rompe la dependencia circular advanceTtsPage ↔ speakTtsEl.
        const speakTtsElRef = useRef(null);
        const advanceTtsPage = useCallback((depth = 0) => {
            if (!ttsActiveRef.current || readFlow !== 'paginated' || !renditionRef.current || depth >= 4) {
                stopTts();
                return;
            }
            renditionRef.current.next().then(() => {
                scheduleReaderTimeout(() => {
                    if (!ttsActiveRef.current) return;
                    const els = collectVisibleTtsQueue();
                    if (!els.length) { advanceTtsPage(depth + 1); return; }
                    ttsQueueRef.current = els;
                    ttsAudioCacheRef.current.clear(); // la caché neuronal va por índice de cola
                    speakTtsElRef.current?.(0);
                }, 450);
            }).catch(() => stopTts());
        }, [readFlow, scheduleReaderTimeout, collectVisibleTtsQueue, stopTts]);
        useEffect(() => { advanceTtsPageRef.current = advanceTtsPage; }, [advanceTtsPage]);

        const speakTtsEl = useCallback((index) => {
            if (!ttsActiveRef.current) return;
            const queue = ttsQueueRef.current;
            if (index >= queue.length) {
                clearTtsHighlight();
                advanceTtsPage();
                return;
            }
            const { el, text } = queue[index];
            ttsIndexRef.current = index;
            if (!text) { speakTtsEl(index + 1); return; }

            // Sombrear el párrafo — solo si cambiamos de elemento, para no parpadear
            // entre frases consecutivas del mismo párrafo.
            if (ttsHighlightRef.current !== el) {
                clearTtsHighlight();
                try { el.classList.add('shark-tts-active'); ttsHighlightRef.current = el; } catch (_) {}
                scrollTtsElIntoView(el);
            }

            const advance = () => {
                if (!ttsActiveRef.current) return;
                speakTtsEl(index + 1);
            };

            // ── Motor neuronal (Edge, requiere internet) ──
            if (ttsEngineRef.current === 'neural' && window.electronAPI?.synthesizeNeuralTts) {
                fetchNeuralAudio(index).then(data => {
                    // Ignorar respuestas tardías si el usuario paró o saltó de párrafo
                    if (!ttsActiveRef.current || ttsIndexRef.current !== index) return;
                    if (!data) { stopTts(); return; } // sin internet o fallo del servicio
                    fetchNeuralAudio(index + 1); // prefetch: elimina el hueco entre párrafos
                    const url = URL.createObjectURL(new Blob([data], { type: 'audio/mpeg' }));
                    const audio = new Audio(url);
                    ttsAudioRef.current = audio;
                    audio.onended = () => { URL.revokeObjectURL(url); advance(); };
                    audio.onerror = () => { URL.revokeObjectURL(url); if (ttsActiveRef.current) stopTts(); };
                    audio.play().catch(() => { if (ttsActiveRef.current) stopTts(); });
                });
                return;
            }

            // ── Motor del sistema (offline) ──
            const utt = new SpeechSynthesisUtterance(text);
            utt.rate = ttsRateRef.current;
            utt.lang = lang === 'es' ? 'es-ES' : 'en-US';
            const voice = (window.speechSynthesis.getVoices() || []).find(v => v.voiceURI === ttsVoiceRef.current);
            if (voice) { utt.voice = voice; utt.lang = voice.lang; }
            utt.onend = advance;
            utt.onerror = (e) => {
                // cancel() dispara 'interrupted'/'canceled' — no son errores reales
                if (e?.error === 'interrupted' || e?.error === 'canceled') return;
                if (ttsActiveRef.current) stopTts();
            };
            ttsUttRef.current = utt; // evitar GC del utterance en Chromium
            window.speechSynthesis.speak(utt);
        }, [lang, clearTtsHighlight, advanceTtsPage, scrollTtsElIntoView, stopTts, fetchNeuralAudio]);
        useEffect(() => { speakTtsElRef.current = speakTtsEl; }, [speakTtsEl]);

        // Clic en un párrafo mientras se lee: salta la lectura ahí mismo, sin salirse
        // de lo visible (usa los mismos bloques que la cola normal, desde el clicado).
        const jumpTtsToElement = useCallback((clickedNode) => {
            if (!ttsActiveRef.current || isHighlightingRef.current) return;
            const { blocks, start, end } = getVisibleTtsBlocks();
            if (!blocks.length) return;
            let target = clickedNode?.nodeType === 1 ? clickedNode : clickedNode?.parentElement;
            while (target && !blocks.includes(target)) target = target.parentElement;
            if (!target) return; // el clic no cayó dentro de un bloque legible visible
            // Los límites de página solo aplican de verdad si el bloque clicado sigue
            // siendo el primero/último tras el recorte (buildTtsQueue lo comprueba).
            const newQueue = buildTtsQueue(blocks.slice(blocks.indexOf(target)), { start, end });
            if (!newQueue.length) return;

            ttsActiveRef.current = false;
            try { window.speechSynthesis.cancel(); } catch (_) {}
            try { ttsAudioRef.current?.pause(); } catch (_) {}
            ttsAudioRef.current = null;
            ttsAudioCacheRef.current.clear();
            ttsQueueRef.current = newQueue;
            ttsIndexRef.current = 0;
            ttsActiveRef.current = true;
            setTtsStatus('playing');
            speakTtsElRef.current?.(0);
        }, [getVisibleTtsBlocks, buildTtsQueue]);
        useEffect(() => { jumpTtsToElementRef.current = jumpTtsToElement; }, [jumpTtsToElement]);

        const startTts = useCallback(() => {
            if (!window.speechSynthesis) return;
            try { window.speechSynthesis.cancel(); } catch (_) {}
            const els = collectVisibleTtsQueue();
            if (!els.length) return;
            ttsQueueRef.current = els;
            ttsIndexRef.current = 0;
            ttsAudioCacheRef.current.clear();
            ttsActiveRef.current = true;
            setTtsStatus('playing');
            speakTtsEl(0);
        }, [collectVisibleTtsQueue, speakTtsEl]);

        // Retoma la escucha desde la última posición guardada de este libro (aunque
        // sea en otra página/sesión): salta ahí, espera a que renderice y arranca.
        const resumeTtsFromSaved = useCallback(() => {
            if (!window.speechSynthesis || !renditionRef.current) return;
            let savedCfi = null;
            try { savedCfi = localStorage.getItem(`sr_tts_pos_${bookData.id}`); } catch (_) {}
            if (!savedCfi) return;
            pushHistory();
            renditionRef.current.display(savedCfi).then(() => {
                scheduleReaderTimeout(() => {
                    try { window.speechSynthesis.cancel(); } catch (_) {}
                    const els = collectVisibleTtsQueue();
                    if (!els.length) return;
                    ttsQueueRef.current = els;
                    ttsIndexRef.current = 0;
                    ttsAudioCacheRef.current.clear();
                    ttsActiveRef.current = true;
                    setTtsStatus('playing');
                    speakTtsEl(0);
                }, 350);
            }).catch(() => {});
        }, [bookData.id, collectVisibleTtsQueue, speakTtsEl, scheduleReaderTimeout, pushHistory]);

        const pauseTts = useCallback(() => {
            if (ttsEngineRef.current === 'neural') {
                try { ttsAudioRef.current?.pause(); } catch (_) {}
            } else {
                try { window.speechSynthesis?.pause(); } catch (_) {}
            }
            setTtsStatus('paused');
        }, []);

        const resumeTts = useCallback(() => {
            if (ttsEngineRef.current === 'neural') {
                try { ttsAudioRef.current?.play?.(); } catch (_) {}
            } else {
                try { window.speechSynthesis?.resume(); } catch (_) {}
            }
            setTtsStatus('playing');
        }, []);

        // Cambiar velocidad/voz/motor en caliente: reinicia desde el párrafo actual
        const restartTtsFromCurrent = useCallback(() => {
            if (!ttsActiveRef.current) return;
            const index = ttsIndexRef.current;
            // Desactivar antes de cancel() para que el onend del utterance cortado no avance la cola
            ttsActiveRef.current = false;
            try { window.speechSynthesis.cancel(); } catch (_) {}
            try { ttsAudioRef.current?.pause(); } catch (_) {}
            ttsAudioRef.current = null;
            ttsAudioCacheRef.current.clear(); // la velocidad/voz van horneadas en el audio neuronal
            setTtsStatus('playing');
            scheduleReaderTimeout(() => {
                if (!ttsQueueRef.current.length) return;
                ttsActiveRef.current = true;
                speakTtsEl(index);
            }, 80);
        }, [scheduleReaderTimeout, speakTtsEl]);

        // Cortar el TTS al desmontar el lector o cambiar de libro
        useEffect(() => () => {
            ttsActiveRef.current = false;
            try { ttsHighlightRef.current?.classList?.remove('shark-tts-active'); } catch (_) {}
            ttsHighlightRef.current = null;
            try { window.speechSynthesis?.cancel(); } catch (_) {}
            try { ttsAudioRef.current?.pause(); } catch (_) {}
            ttsAudioRef.current = null;
        }, [bookData.id]);

        // ── IMAGEN DE CITA (canvas 1080×1080 descargable) ──
        useEffect(() => {
            if (!quoteModal || !quoteCanvasRef.current) return;
            const canvas = quoteCanvasRef.current;
            const W = 1080, H = 1080;
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d');

            const palettes = {
                dark:  { bg1: '#0f172a', bg2: '#1e293b', text: '#f1f5f9', accent: '#38bdf8', muted: 'rgba(241,245,249,0.55)' },
                light: { bg1: '#f8fafc', bg2: '#e2e8f0', text: '#0f172a', accent: '#0284c7', muted: 'rgba(15,23,42,0.55)' },
                sepia: { bg1: '#f5f0e8', bg2: '#e8dcc8', text: '#451a03', accent: '#92400e', muted: 'rgba(69,26,3,0.55)' },
            };
            const p = palettes[theme] || palettes.dark;

            const grad = ctx.createLinearGradient(0, 0, W, H);
            grad.addColorStop(0, p.bg1);
            grad.addColorStop(1, p.bg2);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            // Marco sutil
            ctx.strokeStyle = p.accent;
            ctx.globalAlpha = 0.35;
            ctx.lineWidth = 3;
            ctx.strokeRect(48, 48, W - 96, H - 96);
            ctx.globalAlpha = 1;

            // Comilla decorativa
            ctx.fillStyle = p.accent;
            ctx.globalAlpha = 0.5;
            ctx.font = '900 190px Georgia, serif';
            ctx.textAlign = 'left';
            ctx.fillText('“', 90, 250);
            ctx.globalAlpha = 1;

            // Texto de la cita con ajuste de línea y tamaño adaptativo
            const text = quoteModal.text;
            const fontSize = text.length > 320 ? 36 : text.length > 180 ? 44 : text.length > 90 ? 52 : 62;
            const lineHeightPx = fontSize * 1.45;
            ctx.font = `600 ${fontSize}px Georgia, "Times New Roman", serif`;
            ctx.fillStyle = p.text;
            ctx.textAlign = 'center';
            const maxWidth = W - 220;
            const words = text.split(/\s+/);
            const linesOut = [];
            let line = '';
            words.forEach(word => {
                const probe = line ? `${line} ${word}` : word;
                if (ctx.measureText(probe).width > maxWidth && line) {
                    linesOut.push(line);
                    line = word;
                } else {
                    line = probe;
                }
            });
            if (line) linesOut.push(line);
            const blockHeight = linesOut.length * lineHeightPx;
            let y = (H - blockHeight) / 2 + fontSize * 0.8;
            linesOut.forEach(l => { ctx.fillText(l, W / 2, y); y += lineHeightPx; });

            // Separador + autor/libro
            ctx.strokeStyle = p.accent;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(W / 2 - 60, H - 235);
            ctx.lineTo(W / 2 + 60, H - 235);
            ctx.stroke();

            ctx.font = '700 34px Inter, "Helvetica Neue", Arial, sans-serif';
            ctx.fillStyle = p.text;
            ctx.fillText(bookData.name || 'Libro', W / 2, H - 175, W - 200);
            if (bookData.author) {
                ctx.font = '500 27px Inter, "Helvetica Neue", Arial, sans-serif';
                ctx.fillStyle = p.muted;
                ctx.fillText(bookData.author, W / 2, H - 128, W - 200);
            }

            ctx.font = '600 21px Inter, "Helvetica Neue", Arial, sans-serif';
            ctx.fillStyle = p.muted;
            ctx.globalAlpha = 0.7;
            ctx.fillText('🦈 SharkReader', W / 2, H - 72);
            ctx.globalAlpha = 1;
        }, [quoteModal, theme, bookData.name, bookData.author]);

        const downloadQuoteImage = () => {
            const canvas = quoteCanvasRef.current;
            if (!canvas) return;
            canvas.toBlob(blob => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${slugName()}_cita.png`;
                link.click();
                URL.revokeObjectURL(url);
            }, 'image/png');
        };

        const SEARCH_LIMIT = 50;
        const runSearch = async (query) => {
            if (!bookRef.current || !query.trim()) { setSearchResults([]); setSearchActiveIndex(-1); return; }
            setIsSearching(true);
            try {
                const book = bookRef.current;
                const allResults = [];
                let truncated = false;
                for (const item of book.spine.spineItems) {
                    await item.load(book.load.bind(book));
                    const found = item.find(query.trim());
                    item.unload();
                    found.forEach(r => allResults.push(r));
                    if (allResults.length >= SEARCH_LIMIT) { truncated = true; break; }
                }
                if (truncated) {
                    allResults._truncated = true;
                }
                setSearchResults(allResults);
                setSearchActiveIndex(allResults.length > 0 ? 0 : -1);
            } catch (e) {
                setSearchResults([]);
                setSearchActiveIndex(-1);
            }
            setIsSearching(false);
        };

        const jumpToSearchIndex = useCallback((index) => {
            const result = searchResults[index];
            if (!result?.cfi || !renditionRef.current) return;
            pushHistory();
            setSearchActiveIndex(index);
            renditionRef.current.display(result.cfi).catch(() => {});
        }, [searchResults, pushHistory]);

        const moveSearchResult = useCallback((direction) => {
            if (!searchResults.length) return;
            const next = searchActiveIndex < 0
                ? 0
                : (searchActiveIndex + direction + searchResults.length) % searchResults.length;
            jumpToSearchIndex(next);
        }, [jumpToSearchIndex, searchActiveIndex, searchResults.length]);

        const handleSearchKey = (e) => {
            if (e.key !== 'Enter') return;
            if (searchResults.length > 0) {
                moveSearchResult(e.shiftKey ? -1 : 1);
            } else {
                runSearch(searchQuery);
            }
        };

        const jumpToResult = (cfi) => {
            if (renditionRef.current) { pushHistory(); renditionRef.current.display(cfi); setShowSearch(false); }
        };

        const jumpToAnnotation = (cfi) => {
            if (!renditionRef.current || !cfi) return;
            pushHistory();
            renditionRef.current.display(cfi).catch(() => {});
            setShowAnnotationsPanel(false);
        };

        const deleteAnnotation = (entry) => {
            if (!entry?.cfi) return;
            if (entry.kind === 'highlight') {
                try { renditionRef.current?.annotations?.remove(entry.cfi, 'highlight'); } catch (_) {}
            }
            toggleBookmark(bookData.id, entry.cfi, entry.note || null, true);
        };

        // Resuelve el capítulo de una anotación (best-effort) vía spine + TOC.
        const resolveChapter = (cfi) => {
            try {
                const sec = bookRef.current?.spine?.get?.(cfi);
                const href = sec?.href;
                if (href) return tocMapRef.current.get(href.split('#')[0]) || null;
            } catch (_) {}
            return null;
        };

        const labelFor = (a) => a.kind === 'highlight'
            ? (highlightLabels[a.color] || 'Subrayado')
            : a.kind === 'note' ? 'Nota' : 'Marcador';

        const slugName = () => (bookData.name || 'libro').replace(/[^a-z0-9]/gi, '_');

        const downloadText = (content, filename, mime = 'text/markdown;charset=utf-8') => {
            const url = URL.createObjectURL(new Blob([content], { type: mime }));
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
        };

        // Construye el cuerpo Markdown plano (sin frontmatter).
        const buildPlainMarkdown = () => {
            const lines = [
                `# ${bookData.name || 'Libro'}`,
                bookData.author ? `*${bookData.author}*` : '',
                `*Exportado: ${new Date().toLocaleDateString()}*`,
                '---',
                '',
            ].filter(l => l !== '');
            if (bookData.notes?.trim()) {
                lines.push('## Notas del libro', '', bookData.notes.trim(), '', '---', '');
            }
            currentAnnotations.forEach(a => {
                lines.push(`**[${labelFor(a)}]** ${a.preview}`);
                if (a.date) lines.push(`> *${a.date}*`);
                lines.push('');
            });
            return lines.join('\n');
        };

        const exportAnnotations = () => {
            if (currentAnnotations.length === 0) return;
            downloadText(buildPlainMarkdown(), `${slugName()}_anotaciones.md`);
        };

        // Export pensado para pegar en Obsidian: frontmatter YAML + agrupado por capítulo.
        const buildObsidianMarkdown = () => {
            const today = new Date().toISOString().slice(0, 10);
            const esc = (s) => String(s).replace(/"/g, "'");
            const tags = (bookData.tags && bookData.tags.length)
                ? bookData.tags.map(t => `"${esc(t)}"`).join(', ')
                : '"lectura"';
            const out = [
                '---',
                `title: "${esc(bookData.name || 'Libro')}"`,
                bookData.author ? `author: "${esc(bookData.author)}"` : null,
                `date: ${today}`,
                'source: SharkReader',
                `tags: [${tags}]`,
                '---',
                '',
                `# ${bookData.name || 'Libro'}`,
                bookData.author ? `> por ${bookData.author}` : null,
                '',
            ].filter(l => l !== null);

            if (bookData.notes?.trim()) {
                out.push('## Notas del libro', '', bookData.notes.trim(), '');
            }

            // Agrupar por capítulo preservando el orden de aparición.
            const groups = new Map();
            currentAnnotations.forEach(a => {
                const ch = resolveChapter(a.cfi) || 'Sin capítulo';
                if (!groups.has(ch)) groups.set(ch, []);
                groups.get(ch).push(a);
            });
            groups.forEach((items, chapter) => {
                out.push(`## ${chapter}`, '');
                items.forEach(a => {
                    out.push(`> ${a.preview}`);
                    out.push(`> — **${labelFor(a)}**${a.date ? ` · ${a.date}` : ''}`);
                    out.push('');
                });
            });
            return out.join('\n');
        };

        const exportToObsidian = () => {
            if (currentAnnotations.length === 0) return;
            downloadText(buildObsidianMarkdown(), `${slugName()}.md`);
            try { localStorage.setItem('sr_obsidian_exported', '1'); } catch (_) {}
        };

        const copyAnnotations = async () => {
            if (currentAnnotations.length === 0) return;
            try {
                await navigator.clipboard.writeText(buildObsidianMarkdown());
                setCopiedAnnotations(true);
                scheduleReaderTimeout(() => setCopiedAnnotations(false), 1500);
            } catch (_) {}
        };

        const openAnnotationComposer = (type) => {
            if (!renditionRef.current) return;
            const loc = renditionRef.current.currentLocation();
            if (!loc || !loc.start) return;
            const cfi = loc.start.cfi;
            const hasBookmark = bookData.bookmarks.some(b => b.cfi === cfi && !b.note?.includes('[Subrayado]') && b.kind !== 'note');
            if (type === 'bookmark' && hasBookmark) {
                toggleBookmark(bookData.id, cfi, null, true);
            } else {
                setPendingBookmarkType(type);
                setBookmarkNote(type === 'note' ? '' : `Página ~${currentPercent}%`);
                setPendingBookmarkCfi(cfi);
                scheduleReaderTimeout(() => bookmarkNoteInputRef.current && bookmarkNoteInputRef.current.focus(), 50);
            }
        };

        const handleAddBookmark = () => openAnnotationComposer('bookmark');
        const handleAddMarginNote = () => openAnnotationComposer('note');
        const toggleAnnotationsPanel = () => {
            setShowSearch(false);
            setShowToc(false);
            setShowAnnotationsPanel(prev => !prev);
        };

        const confirmBookmark = () => {
            if (pendingBookmarkCfi) {
                const fallback = pendingBookmarkType === 'note' ? `Nota en ~${currentPercent}%` : `Página ~${currentPercent}%`;
                toggleBookmark(bookData.id, pendingBookmarkCfi, bookmarkNote.trim() || fallback, false, { kind: pendingBookmarkType });
                setPendingBookmarkCfi(null);
                setBookmarkNote('');
                setPendingBookmarkType('bookmark');
            }
        };

        const applyReadingPreset = useCallback((presetId) => {
            const preset = READING_PRESETS.find(item => item.id === presetId);
            if (!preset) return;
            const values = preset.values || {};
            if (values.fontFamily) setFontFamily(values.fontFamily);
            if (values.lineHeight != null) setLineHeight(values.lineHeight);
            if (values.pageMargins != null) setPageMargins(values.pageMargins);
            if (values.letterSpacing != null) setLetterSpacing(values.letterSpacing);
            if (values.paragraphSpacing != null) setParagraphSpacing(values.paragraphSpacing);
            if (values.textJustify != null) setTextJustify(values.textJustify);
            if (values.firstLineIndent != null) setFirstLineIndent(values.firstLineIndent);
            if (values.hyphenation != null) setHyphenation(values.hyphenation);
            if (values.columnWidth) setColumnWidth(values.columnWidth);
        }, []);

        const toggleFullscreen = () => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { });
            else if (document.exitFullscreen) document.exitFullscreen();
        };


        const isBookmarked = currentCfi && bookData.bookmarks.some(b => b.cfi === currentCfi && !b.note?.includes('[Subrayado]') && b.kind !== 'note');
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

        const renderFontMenu = (dock) => (
            <EpubReaderSettings
                dock={dock}
                showFontMenu={showFontMenu} setShowFontMenu={setShowFontMenu}
                setShowToc={setShowToc} setShowBrightness={setShowBrightness} setShowAutoScrollPanel={setShowAutoScrollPanel}
                fontFamily={fontFamily} setFontFamily={setFontFamily}
                lineHeight={lineHeight} setLineHeight={setLineHeight}
                pageMargins={pageMargins} setPageMargins={setPageMargins}
                customBg={customBg} setCustomBg={setCustomBg}
                customText={customText} setCustomText={setCustomText}
                textJustify={textJustify} setTextJustify={setTextJustify}
                firstLineIndent={firstLineIndent} setFirstLineIndent={setFirstLineIndent}
                hyphenation={hyphenation} setHyphenation={setHyphenation}
                letterSpacing={letterSpacing} setLetterSpacing={setLetterSpacing}
                paragraphSpacing={paragraphSpacing} setParagraphSpacing={setParagraphSpacing}
                columnWidth={columnWidth} setColumnWidth={setColumnWidth}
                applyReadingPreset={applyReadingPreset}
            />
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

        const DyslexiaBtn = () => {
            if (!dyslexiaAddon) return null;
            return (
                <button
                    onClick={onToggleDyslexiaMode}
                    className={`px-2 py-1.5 rounded-xl transition text-xs font-black ${dyslexiaModeActive ? 'bg-cyan-400 text-slate-950' : 'hover:bg-white/15'}`}
                    title={lang === 'en' ? 'Toggle dyslexia mode' : 'Activar/desactivar modo dislexia'}>
                    <span style={{ fontFamily: 'OpenDyslexic, Arial, sans-serif', letterSpacing: '0.02em' }}>Dx</span>
                </button>
            );
        };

        const TocItem = ({ item, depth = 0 }) => {
            const [open, setOpen] = useState(depth === 0);
            const hasSubs = item.subitems && item.subitems.length > 0;
            const hrefKey = item.href?.split('#')[0] || '';
            const isActive = hrefKey && hrefKey === tocActiveHref;
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
                            className={`flex-1 text-left text-xs py-1.5 px-2 hover:bg-[var(--highlight)]/20 rounded-lg transition truncate ${!hasSubs ? 'ml-5' : ''} ${isActive ? 'bg-[var(--highlight)] text-white font-black' : 'font-medium'}`}>
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
                    {autoScroll ? 'â¸' : '▶'}
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
                            {autoScroll ? 'â¸ Pausar' : '▶ Iniciar auto-scroll'}
                        </button>
                    </div>
                )}
            </div>
        ) : null;

        const TtsBtn = ({ dock }) => {
            if (!window.speechSynthesis) return null;
            const preferredVoices = ttsVoices.filter(v => v.lang?.toLowerCase().startsWith(lang === 'es' ? 'es' : 'en'));
            const voiceList = preferredVoices.length > 0 ? preferredVoices : ttsVoices;
            return (
                <div className="relative" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => { setShowTtsPanel(p => !p); setShowToc(false); setShowFontMenu(false); setShowBrightness(false); setShowAutoScrollPanel(false); }}
                        className={`p-2 rounded-xl transition ${showTtsPanel ? 'bg-white/25' : ttsStatus === 'playing' ? 'text-green-400 hover:bg-white/15' : 'hover:bg-white/15'}`}
                        title="Leer en voz alta">
                        <Icons.Speaker />
                    </button>
                    {showTtsPanel && (
                        <div className={dock ? "dock-popup active" : "topbar-popup active"} style={{ minWidth: '240px' }} onWheel={e => e.stopPropagation()}>
                            <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-3">Leer en voz alta</p>
                            {ttsStatus === 'idle' && savedTtsCfi && (
                                <button onClick={resumeTtsFromSaved}
                                    className="w-full mb-2 py-2 rounded-xl font-bold text-sm transition border"
                                    style={{ borderColor: 'var(--highlight)', color: 'var(--highlight)' }}>
                                    ⏵ Continuar escucha donde la dejaste
                                </button>
                            )}
                            <div className="flex gap-1.5 mb-3">
                                {ttsStatus === 'idle' && (
                                    <button onClick={startTts}
                                        className="flex-1 py-2 rounded-xl font-bold text-sm text-white transition"
                                        style={{ backgroundColor: 'var(--highlight)' }}>
                                        ▶ Leer desde esta página
                                    </button>
                                )}
                                {ttsStatus === 'playing' && (
                                    <button onClick={pauseTts}
                                        className="flex-1 py-2 rounded-xl font-bold text-sm bg-black/10 dark:bg-white/10 transition hover:opacity-80">
                                        ⏸ Pausar
                                    </button>
                                )}
                                {ttsStatus === 'paused' && (
                                    <button onClick={resumeTts}
                                        className="flex-1 py-2 rounded-xl font-bold text-sm text-white transition"
                                        style={{ backgroundColor: 'var(--highlight)' }}>
                                        ▶ Continuar
                                    </button>
                                )}
                                {ttsStatus !== 'idle' && (
                                    <button onClick={stopTts}
                                        className="px-3 py-2 rounded-xl font-bold text-sm bg-red-500/15 text-red-500 transition hover:bg-red-500/25">
                                        ■
                                    </button>
                                )}
                            </div>
                            <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1">Velocidad</p>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs opacity-50">🐢</span>
                                <input type="range" min="0.5" max="2" step="0.1" value={ttsRate}
                                    onChange={e => { setTtsRate(parseFloat(e.target.value)); }}
                                    onMouseUp={() => { if (ttsStatus === 'playing') restartTtsFromCurrent(); }}
                                    className="flex-1 accent-[var(--highlight)]" />
                                <span className="text-xs opacity-50">🐇</span>
                                <span className="text-xs font-black opacity-70 min-w-[32px] text-right">{ttsRate.toFixed(1)}×</span>
                            </div>
                            <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1">Motor de voz</p>
                            <div className="flex gap-1 mb-3">
                                <button onClick={() => { setTtsEngine('neural'); if (ttsStatus === 'playing') restartTtsFromCurrent(); }}
                                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-black transition ${ttsEngine === 'neural' ? 'bg-[var(--highlight)] text-white' : 'bg-black/5 dark:bg-white/5 opacity-60 hover:opacity-100'}`}>
                                    ✨ Neural
                                </button>
                                <button onClick={() => { setTtsEngine('system'); if (ttsStatus === 'playing') restartTtsFromCurrent(); }}
                                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-black transition ${ttsEngine === 'system' ? 'bg-[var(--highlight)] text-white' : 'bg-black/5 dark:bg-white/5 opacity-60 hover:opacity-100'}`}>
                                    💻 Sistema
                                </button>
                            </div>
                            <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1">Voz</p>
                            {ttsEngine === 'neural' ? (
                                <select
                                    value={ttsNeuralVoice}
                                    onChange={e => { setTtsNeuralVoice(e.target.value); if (ttsStatus === 'playing') restartTtsFromCurrent(); }}
                                    className="w-full rounded-xl bg-black/5 dark:bg-white/5 px-2 py-2 text-xs font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                    style={{ color: 'var(--text-color)', backgroundColor: 'var(--surface-bg)' }}>
                                    {NEURAL_VOICES.map(v => (
                                        <option key={v.id} value={v.id}>{v.label}</option>
                                    ))}
                                </select>
                            ) : (
                                <select
                                    value={ttsVoiceURI}
                                    onChange={e => { setTtsVoiceURI(e.target.value); if (ttsStatus === 'playing') restartTtsFromCurrent(); }}
                                    className="w-full rounded-xl bg-black/5 dark:bg-white/5 px-2 py-2 text-xs font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                    style={{ color: 'var(--text-color)', backgroundColor: 'var(--surface-bg)' }}>
                                    <option value="">Voz del sistema (auto)</option>
                                    {voiceList.map(v => (
                                        <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                                    ))}
                                </select>
                            )}
                            <p className="text-[9px] opacity-40 mt-2 leading-relaxed">
                                {ttsEngine === 'neural'
                                    ? 'Voces neuronales de alta calidad (requieren internet). Si falla la conexión, la lectura se detiene.'
                                    : 'Voces instaladas en Windows (funcionan sin internet).'}
                                {' '}Empieza en lo visible, sombrea el párrafo actual y pasa de página sola. Toca cualquier párrafo mientras lee para saltar ahí.
                            </p>
                        </div>
                    )}
                </div>
            );
        };

        const TocBtn = ({ dock }) => (
            <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                    onClick={() => { setShowToc(p => !p); setShowFontMenu(false); setShowBrightness(false); setShowSearch(false); setShowAnnotationsPanel(false); }}
                    className={`p-2 rounded-xl transition flex items-center gap-2 ${showToc ? 'bg-black/30' : 'hover:bg-white/15'}`}
                    title={t.toc}
                >
                    <Icons.Toc />
                    {!dock && <span className="hidden lg:inline text-xs font-bold uppercase">Índice</span>}
                </button>
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
                            ← Volver a la biblioteca
                        </button>
                    </div>
                )}

                {isLoading && !epubError && (
                    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/10 backdrop-blur-sm">
                        <div className="loader"></div>
                    </div>
                )}

                {/* ── BARRA SUPERIOR — Modo Normal ── */}
                {!isFullscreen && (
                    <div className={`flex-shrink-0 flex flex-col text-white shadow-md z-40 focus-mode-toolbar ${focusMode && !focusToolbarVisible ? 'hidden' : ''}`} style={{ background: 'linear-gradient(to right, var(--topbar-bg), var(--highlight))' }}>

                        {/* Fila 1: pestañas (solo cuando se pasan tabs) */}
                        {tabs && (
                            <div className="flex items-stretch flex-shrink-0 overflow-x-auto overflow-y-hidden select-none" style={{ height: '30px', backgroundColor: 'rgba(0,0,0,0.22)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
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
                                                {book?.name || 'Cargando...'}
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
                        <div className="h-12 flex items-center justify-between px-2.5">
                            {/* Izquierda: back + título (sin tabs) | solo título+info (con tabs) */}
                            {!tabs ? (
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <button onClick={onClose} aria-label="Volver a la biblioteca" className="p-1.5 hover:bg-black/20 rounded-full transition flex-shrink-0 transform hover:-translate-x-1"><Icons.Back /></button>
                                    <button onClick={onOpenBookInfo} className="flex items-center gap-1.5 hover:bg-black/10 px-2 py-1 rounded-xl transition min-w-0">
                                        <span className="font-bold text-sm tracking-wide truncate max-w-[150px] sm:max-w-xs">{bookData.name}</span>
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
                                <DyslexiaBtn />
                                {renderFontMenu(false)}
                                <div className="w-px h-5 bg-white/20 mx-0.5"></div>
                                <button onClick={handleAddBookmark} className="p-1.5 hover:bg-white/15 rounded-xl transition" title="Marcador r?pido">
                                    <Icons.Bookmark fill={isBookmarked ? "#facc15" : "none"} color={isBookmarked ? "#facc15" : "currentColor"} />
                                </button>
                                <button onClick={handleAddMarginNote} className="p-1.5 hover:bg-white/15 rounded-xl transition" title="Crear nota al margen">
                                    <Icons.Notes />
                                </button>
                                <button onClick={toggleAnnotationsPanel} className={`p-1.5 rounded-xl transition ${showAnnotationsPanel ? 'bg-white/25' : 'hover:bg-white/15'}`} title="Abrir panel de anotaciones">
                                    <span className="relative inline-flex">
                                        <Icons.AnnotationPanel />
                                        {currentAnnotations.length > 0 && <span className="absolute -right-2 -top-2 min-w-[16px] rounded-full bg-fuchsia-400 px-1 text-[9px] font-black text-slate-950">{currentAnnotations.length}</span>}
                                    </span>
                                </button>
                                <button onClick={() => setIsHighlighting(!isHighlighting)}
                                    className={`p-1.5 rounded-xl transition ${isHighlighting ? 'bg-yellow-400 text-yellow-900 shadow-inner' : 'hover:bg-white/15'}`}
                                    title={t.highlight}>
                                    <Icons.Highlighter />
                                </button>
                                {isHighlighting && (
                                    <div className="flex items-center gap-1 px-1.5">
                                        {Object.entries(HIGHLIGHT_PRESETS).map(([id, preset]) => (
                                            <button
                                                key={id}
                                                onClick={() => setHighlightColor(id)}
                                                title={highlightLabels[id] || preset.label}
                                                className={`h-4 w-4 rounded-full border transition ${highlightColor === id ? 'scale-110 border-white' : 'border-white/30'}`}
                                                style={{ backgroundColor: preset.fill.replace(/0\.\d+\)/, '1)') }}
                                            />
                                        ))}
                                    </div>
                                )}
                                <button onClick={() => setShowSearch(p => !p)}
                                    className={`p-1.5 rounded-xl transition ${showSearch ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                    title="Buscar en el libro">
                                    <Icons.Search />
                                </button>
                                <AutoScrollBtn dock={false} />
                                <TtsBtn dock={false} />
                                <button onClick={onOpenSettings} className="p-1.5 hover:bg-white/15 rounded-xl transition hidden sm:block" title={t.settings}>
                                    <Icons.Settings />
                                </button>
                                {onToggleSpread && (
                                    <button onClick={onToggleSpread} className={`p-1.5 rounded-xl transition text-sm leading-none hidden sm:block ${readLayout === 'auto' ? 'bg-white/25' : 'hover:bg-white/15'}`} title={readLayout === 'auto' ? 'Vista simple' : 'Doble página'}>
                                        ⊞
                                    </button>
                                )}
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
                        <div className={`absolute top-4 left-4 right-4 flex items-center justify-between text-white z-40 pointer-events-none transition-all duration-500 ${showToolbar ? 'translate-y-0 opacity-100' : '-translate-y-16 opacity-0'}`}>
                            <button onClick={onClose} className="p-3 bg-slate-900/80 backdrop-blur-xl border border-white/10 hover:bg-black/60 rounded-full transition shadow-xl pointer-events-auto" title="Cerrar"><Icons.Back /></button>
                            <button onClick={toggleFullscreen} className="p-3 bg-slate-900/80 backdrop-blur-xl border border-white/10 hover:bg-black/60 rounded-full transition shadow-xl pointer-events-auto" title="Salir de pantalla completa"><Icons.FullscreenExit /></button>
                        </div>

                        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900/85 backdrop-blur-2xl border border-white/10 text-white z-40 rounded-full px-2.5 py-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 ${showToolbar ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-24 opacity-0 scale-95 pointer-events-none'}`}>

                            <TocBtn dock={true} />

                            <div className="w-px h-5 bg-white/10 mx-1"></div>

                            <ZoomControls small />

                            <BrightnessBtn dock={true} />
                            <DyslexiaBtn />

                            {renderFontMenu(true)}

                            <div className="w-px h-5 bg-white/10 mx-1"></div>

                            <button onClick={handleAddBookmark} className="p-2.5 hover:bg-white/15 rounded-full transition" title="Marcador r?pido">
                                <Icons.Bookmark fill={isBookmarked ? "#facc15" : "none"} color={isBookmarked ? "#facc15" : "currentColor"} />
                            </button>
                            <button onClick={handleAddMarginNote} className="p-2.5 hover:bg-white/15 rounded-full transition" title="Crear nota al margen">
                                <Icons.Notes />
                            </button>
                            <button onClick={toggleAnnotationsPanel} className={`p-2.5 rounded-full transition ${showAnnotationsPanel ? 'bg-white/25' : 'hover:bg-white/15'}`} title="Abrir panel de anotaciones">
                                <span className="relative inline-flex">
                                    <Icons.AnnotationPanel />
                                    {currentAnnotations.length > 0 && <span className="absolute -right-2 -top-2 min-w-[16px] rounded-full bg-fuchsia-400 px-1 text-[9px] font-black text-slate-950">{currentAnnotations.length}</span>}
                                </span>
                            </button>

                            <button onClick={() => setIsHighlighting(!isHighlighting)}
                                className={`p-2.5 rounded-full transition ${isHighlighting ? 'bg-yellow-400 text-yellow-900' : 'hover:bg-white/15'}`}
                                title={t.highlight}>
                                <Icons.Highlighter />
                            </button>
                            {isHighlighting && (
                                <div className="flex items-center gap-1 px-1">
                                    {Object.entries(HIGHLIGHT_PRESETS).map(([id, preset]) => (
                                        <button
                                            key={id}
                                            onClick={() => setHighlightColor(id)}
                                            title={highlightLabels[id] || preset.label}
                                            className={`h-4 w-4 rounded-full border transition ${highlightColor === id ? 'scale-110 border-white' : 'border-white/30'}`}
                                            style={{ backgroundColor: preset.fill.replace(/0\.\d+\)/, '1)') }}
                                        />
                                    ))}
                                </div>
                            )}

                            <button onClick={() => setShowSearch(p => !p)}
                                className={`p-2.5 rounded-full transition ${showSearch ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                title="Buscar en el libro">
                                <Icons.Search />
                            </button>

                            <AutoScrollBtn dock={true} />
                            <TtsBtn dock={true} />

                            <div className="w-px h-5 bg-white/10 mx-1"></div>

                            {onToggleSpread && (
                                <button onClick={onToggleSpread} className={`p-2.5 rounded-full transition text-sm leading-none ${readLayout === 'auto' ? 'bg-white/25' : 'hover:bg-white/15'}`} title={readLayout === 'auto' ? 'Vista simple' : 'Doble página'}>
                                    ⊞
                                </button>
                            )}
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
                {readFlow === 'paginated' && (!focusMode || focusToolbarVisible) && (
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
                            boxSizing: 'border-box',
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
                                <button onClick={() => setDictionaryPopup(null)} aria-label="Cerrar diccionario" className="opacity-50 hover:opacity-100 transition ml-3"><Icons.Close /></button>
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

                    {/* Popup Crear imagen de cita */}
                    {quotePrompt && (
                        <div className="absolute z-50 flex items-center gap-1 bg-[var(--surface-bg)] border border-[var(--border-color)] shadow-2xl px-2 py-1.5 rounded-2xl fade-in"
                            style={{ top: Math.min(quotePrompt.y, (viewerWrapRef.current?.clientHeight || 600) - 60), left: Math.min(quotePrompt.x, (viewerWrapRef.current?.clientWidth || 800) - 220) }}>
                            <button
                                onClick={() => { setQuoteModal({ text: quotePrompt.text }); setQuotePrompt(null); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-white transition hover:opacity-80"
                                style={{ backgroundColor: 'var(--highlight)' }}>
                                <Icons.Quote /> Imagen de cita
                            </button>
                            <button onClick={() => setQuotePrompt(null)} className="p-1.5 opacity-50 hover:opacity-100 transition">
                                <Icons.Close />
                            </button>
                        </div>
                    )}
                </div>

                {/* ── MODAL IMAGEN DE CITA ── */}
                {quoteModal && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm fade-in p-6"
                        onClick={() => setQuoteModal(null)}>
                        <div role="dialog" aria-modal="true" aria-label="Imagen de cita" className="bg-[var(--surface-bg)] rounded-3xl p-5 shadow-2xl border border-[var(--border-color)] max-w-[440px] w-full"
                            onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-black text-base">Imagen de cita</h3>
                                <button onClick={() => setQuoteModal(null)} aria-label="Cerrar" className="p-1.5 opacity-50 hover:opacity-100 transition">
                                    <Icons.Close />
                                </button>
                            </div>
                            <canvas
                                ref={quoteCanvasRef}
                                className="w-full rounded-2xl border"
                                style={{ borderColor: 'var(--border-color)', aspectRatio: '1 / 1' }}
                            />
                            <div className="flex gap-2 mt-4">
                                <button onClick={() => setQuoteModal(null)}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-black/5 dark:bg-white/5 hover:opacity-80 transition">
                                    Cerrar
                                </button>
                                <button onClick={downloadQuoteImage}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition hover:opacity-80"
                                    style={{ backgroundColor: 'var(--highlight)' }}>
                                    ⬇ Descargar PNG
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── POPUP NOTA DE BOOKMARK ── */}
                {showToc && (
                    <div
                        className="absolute right-0 bottom-7 w-[340px] z-50 flex flex-col shadow-2xl border-l fade-in"
                        style={{ top: tabs ? '76px' : '52px', backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        onWheel={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-2 p-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-45">?ndice</p>
                                <p className="text-sm font-black">{flatToc.length} secciones</p>
                            </div>
                            <button onClick={() => setShowToc(false)} className="p-2 opacity-50 hover:opacity-100 transition">
                                <Icons.Close />
                            </button>
                        </div>
                        {flatToc.length > 0 && (
                            <div className="px-3 pt-2.5 pb-1">
                                <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 rounded-lg px-2 py-1.5">
                                    <Icons.Search className="w-3 h-3 opacity-40 flex-shrink-0" />
                                    <input
                                        type="text"
                                        value={tocSearch}
                                        onChange={e => setTocSearch(e.target.value)}
                                        placeholder="Buscar capitulo..."
                                        className="bg-transparent outline-none text-xs flex-1 min-w-0"
                                        style={{ color: 'var(--text-color)' }}
                                    />
                                    {tocSearch && <button onClick={() => setTocSearch('')} className="opacity-40 hover:opacity-100 text-xs leading-none">×</button>}
                                </div>
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto p-3 space-y-1">
                            {toc.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-4 text-sm opacity-60">
                                    No hay ?ndice disponible en este libro.
                                </div>
                            ) : tocSearch.trim() ? (() => {
                                const q = tocSearch.trim().toLowerCase();
                                const results = flatToc.filter(item => item.label?.toLowerCase().includes(q));
                                if (!results.length) return <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-4 text-sm opacity-50">Sin resultados.</div>;
                                return results.map((item, i) => {
                                    const hrefKey = item.href?.split('#')[0] || '';
                                    const isActive = hrefKey && hrefKey === tocActiveHref;
                                    return (
                                        <button key={`${item.href}-${i}`} onClick={() => { jumpToToc(item.href); setTocSearch(''); }}
                                            className={`w-full text-left text-xs py-2 px-2 rounded-lg transition truncate ${isActive ? 'bg-[var(--highlight)] text-white font-black' : 'hover:bg-[var(--highlight)]/20 font-medium'}`}
                                            style={{ paddingLeft: `${8 + item.depth * 14}px` }}>
                                            {item.label}
                                        </button>
                                    );
                                });
                            })() : toc.map((item, i) => <TocItem key={i} item={item} depth={0} />)}
                        </div>
                    </div>
                )}

                {showAnnotationsPanel && (
                    <div
                        className="absolute right-0 bottom-7 w-[340px] z-50 flex flex-col shadow-2xl border-l fade-in"
                        style={{ top: tabs ? '76px' : '52px', backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        onWheel={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-2 p-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-45">Anotaciones</p>
                                <p className="text-sm font-black">{annotationStats.total} en este libro</p>
                            </div>
                            <div className="flex items-center gap-1">
                                {currentAnnotations.length > 0 && (
                                    <>
                                        <button onClick={copyAnnotations} className="px-2 py-1 rounded-lg text-[10px] font-black hover:bg-black/5 dark:hover:bg-white/5 transition opacity-50 hover:opacity-100" title="Copiar (formato Obsidian)">
                                            {copiedAnnotations ? '✓' : '⧉'}
                                        </button>
                                        <button onClick={exportToObsidian} className="px-2 py-1 rounded-lg text-[10px] font-black hover:bg-black/5 dark:hover:bg-white/5 transition opacity-50 hover:opacity-100" title="Exportar a Obsidian (frontmatter + por capítulo)">
                                            Obsidian
                                        </button>
                                        <button onClick={exportAnnotations} className="px-2 py-1 rounded-lg text-[10px] font-black hover:bg-black/5 dark:hover:bg-white/5 transition opacity-50 hover:opacity-100" title="Exportar como Markdown">
                                            ↓ MD
                                        </button>
                                    </>
                                )}
                                <button onClick={() => setShowAnnotationsPanel(false)} className="p-2 opacity-50 hover:opacity-100 transition">
                                    <Icons.Close />
                                </button>
                            </div>
                        </div>
                        {currentAnnotations.length > 0 && (
                            <div className="px-3 pt-2.5 pb-1 space-y-2">
                                <div className="grid grid-cols-4 gap-1">
                                    {[
                                        ['all', 'Todo', annotationStats.total],
                                        ['highlight', 'Subr.', annotationStats.highlight],
                                        ['note', 'Notas', annotationStats.note],
                                        ['bookmark', 'Marks', annotationStats.bookmark],
                                    ].map(([id, label, count]) => (
                                        <button key={id} onClick={() => setAnnotationKindFilter(id)}
                                            className={`rounded-lg px-2 py-1 text-[10px] font-black transition ${annotationKindFilter === id ? 'bg-[var(--highlight)] text-white' : 'bg-black/5 dark:bg-white/5 opacity-70 hover:opacity-100'}`}>
                                            {label} {count || 0}
                                        </button>
                                    ))}
                                </div>
                                {annotationStats.highlight > 0 && (
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setAnnotationColorFilter('all')}
                                            className={`rounded-lg px-2 py-1 text-[10px] font-black transition ${annotationColorFilter === 'all' ? 'bg-[var(--highlight)] text-white' : 'bg-black/5 dark:bg-white/5 opacity-70 hover:opacity-100'}`}>
                                            Colores
                                        </button>
                                        {Object.entries(HIGHLIGHT_PRESETS).map(([id, preset]) => (
                                            <button key={id} onClick={() => setAnnotationColorFilter(id)}
                                                title={`${highlightLabels[id] || preset.label} (${annotationStats.colors[id] || 0})`}
                                                className={`h-6 min-w-6 rounded-lg border px-1 text-[9px] font-black transition ${annotationColorFilter === id ? 'scale-105 border-white' : 'border-transparent opacity-80 hover:opacity-100'}`}
                                                style={{ backgroundColor: preset.fill.replace(/0\.\d+\)/, '0.8)') }}>
                                                {annotationStats.colors[id] || 0}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 rounded-lg px-2 py-1.5">
                                    <Icons.Search className="w-3 h-3 opacity-40 flex-shrink-0" />
                                    <input
                                        type="text"
                                        value={annotationSearch}
                                        onChange={e => setAnnotationSearch(e.target.value)}
                                        placeholder="Buscar en anotaciones..."
                                        className="bg-transparent outline-none text-xs flex-1 min-w-0"
                                        style={{ color: 'var(--text-color)' }}
                                    />
                                    {annotationSearch && <button onClick={() => setAnnotationSearch('')} className="opacity-40 hover:opacity-100 text-xs leading-none">×</button>}
                                </div>
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ overscrollBehavior: 'contain' }}>
                            {currentAnnotations.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-4 text-sm opacity-60">
                                    Todavía no hay anotaciones en este libro.
                                </div>
                            ) : (() => {
                                const filtered = filteredAnnotations;
                                if (!filtered.length) {
                                    return <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-4 text-sm opacity-50">Sin resultados para “{annotationSearch}”.</div>;
                                }
                                return filtered.map(entry => (
                                <div key={entry.id} className="rounded-2xl border border-black/5 bg-black/5 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest" style={{
                                                    backgroundColor: entry.kind === 'highlight'
                                                        ? HIGHLIGHT_PRESETS[entry.color]?.fill?.replace(/0\.\d+\)/, '0.35)') || 'rgba(250, 204, 21, 0.35)'
                                                        : 'rgba(148, 163, 184, 0.16)',
                                                    color: 'var(--text-color)',
                                                }}>
                                                    {entry.kind === 'highlight' ? (highlightLabels[entry.color] || 'Subrayado') : entry.kind === 'note' ? 'Nota' : 'Marcador'}
                                                </span>
                                                {entry.date && <span className="text-[10px] opacity-40 font-bold">{entry.date}</span>}
                                            </div>
                                            <p className="text-sm font-semibold leading-relaxed break-words">{entry.preview || 'Sin texto'}</p>
                                        </div>
                                        <button onClick={() => deleteAnnotation(entry)} className="p-1.5 rounded-xl text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition">
                                            <Icons.Trash className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="mt-3 flex items-center gap-2">
                                        <button onClick={() => jumpToAnnotation(entry.cfi)} className="rounded-xl bg-[var(--highlight)]/15 px-3 py-1.5 text-xs font-black text-[var(--highlight)] hover:bg-[var(--highlight)]/20 transition">
                                            Ir a la anotación
                                        </button>
                                        {entry.kind === 'highlight' && entry.preview && (
                                            <button onClick={() => setQuoteModal({ text: entry.preview })}
                                                className="rounded-xl bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-black opacity-70 hover:opacity-100 transition"
                                                title="Crear imagen de cita con este subrayado">
                                                🖼 Imagen
                                            </button>
                                        )}
                                    </div>
                                </div>
                                ));
                            })()}
                        </div>
                    </div>
                )}

                {pendingBookmarkCfi && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-sm fade-in"
                        onClick={() => { setPendingBookmarkCfi(null); setPendingBookmarkType('bookmark'); }}>
                        <div role="dialog" aria-modal="true" aria-label={pendingBookmarkType === 'note' ? 'Añadir nota al margen' : 'Añadir marcador'} className="bg-[var(--surface-bg)] rounded-2xl p-6 w-80 shadow-2xl border border-[var(--border-color)]"
                            onClick={e => e.stopPropagation()}>
                            <h3 className="font-black text-base mb-1">{pendingBookmarkType === 'note' ? 'Añadir nota al margen' : 'Añadir marcador'}</h3>
                            <p className="text-xs opacity-50 mb-4">{pendingBookmarkType === 'note' ? 'Esta nota quedará atada a este punto del libro.' : 'Escribe una nota para este punto (opcional).'}</p>
                            <input
                                ref={bookmarkNoteInputRef}
                                type="text"
                                value={bookmarkNote}
                                onChange={e => setBookmarkNote(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && confirmBookmark()}
                                placeholder={pendingBookmarkType === 'note' ? 'Escribe tu nota...' : `Página ~${currentPercent}%`}
                                className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3 text-sm font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition mb-4"
                                style={{ color: 'var(--text-color)' }}
                            />
                            <div className="flex gap-2">
                                <button onClick={() => { setPendingBookmarkCfi(null); setPendingBookmarkType('bookmark'); }}
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
                        onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
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
                            {searchResults.length > 0 && (
                                <div className="flex items-center gap-1">
                                    <button onClick={() => moveSearchResult(-1)} className="px-2 py-2 rounded-xl text-xs font-black bg-black/5 dark:bg-white/5 hover:opacity-80">↑</button>
                                    <button onClick={() => moveSearchResult(1)} className="px-2 py-2 rounded-xl text-xs font-black bg-black/5 dark:bg-white/5 hover:opacity-80">↓</button>
                                </div>
                            )}
                            <button onClick={() => { setShowSearch(false); setSearchResults([]); setSearchQuery(''); setSearchActiveIndex(-1); }}
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
                                        {searchActiveIndex >= 0 ? `${searchActiveIndex + 1} / ` : ''}{searchResults.length}{searchResults._truncated ? '+ (limite alcanzado)' : ''} resultados
                                    </p>
                                    {searchResults._truncated && (
                                        <p className="text-[10px] px-3 pb-2 opacity-50">Mostrando los primeros 50 resultados. Usa un término más específico para ver todos.</p>
                                    )}
                                    {searchResults.map((result, i) => (
                                        <button key={i} onClick={() => jumpToResult(result.cfi)}
                                            className={`w-full text-left px-3 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition mb-1 ${searchActiveIndex === i ? 'ring-1 ring-[var(--highlight)]' : ''}`}>
                                            <p className="text-xs leading-relaxed font-medium opacity-80 line-clamp-3"
                                                dangerouslySetInnerHTML={{
                                                    __html: result.excerpt.replace(
                                                        new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                                                        m => `<mark style="background:rgba(250,204,21,0.65);border-radius:3px;padding:0 2px">${m}</mark>`
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
                                style={{ top: tabs ? '88px' : '64px', bottom: '28px', width: '210px', backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', opacity: 0.96 }}
                                onWheel={e => e.stopPropagation()}>
                                <div className="px-2 py-2 border-b flex-shrink-0 space-y-1.5" style={{ borderColor: 'var(--border-color)' }}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Índice</span>
                                        <button onClick={() => setTocCollapsed(true)} className="p-0.5 opacity-40 hover:opacity-100 transition text-base leading-none" title="Colapsar">‹</button>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 rounded-lg px-2 py-1">
                                        <Icons.Search className="w-3 h-3 opacity-40 flex-shrink-0" />
                                        <input
                                            type="text"
                                            value={tocSearch}
                                            onChange={e => setTocSearch(e.target.value)}
                                            placeholder="Buscar capítulo..."
                                            className="flex-1 bg-transparent outline-none text-[11px] font-medium"
                                            style={{ color: 'var(--text-color)' }}
                                        />
                                        {tocSearch && <button onClick={() => setTocSearch('')} className="opacity-40 hover:opacity-100 text-xs leading-none">×</button>}
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto py-1 px-1">
                                    {(() => {
                                        const q = tocSearch.trim().toLowerCase();
                                        if (!q) {
                                            return toc.map((item, i) => {
                                                const isActive = currentChapterTitle && item.label === currentChapterTitle;
                                                return (
                                                    <button key={i} onClick={() => { if (renditionRef.current) { pushHistory(); renditionRef.current.display(item.href); } }}
                                                        className={`w-full text-left text-[11px] px-2 py-1.5 rounded-lg transition font-medium mb-0.5 truncate ${isActive ? 'text-white font-black' : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}
                                                        style={isActive ? { backgroundColor: 'var(--highlight)' } : {}}>
                                                        {item.label}
                                                    </button>
                                                );
                                            });
                                        }
                                        const results = [];
                                        const walk = (items) => items.forEach(item => {
                                            if (item.label?.toLowerCase().includes(q)) results.push(item);
                                            if (item.subitems?.length) walk(item.subitems);
                                        });
                                        walk(toc);
                                        if (results.length === 0) return <p className="text-[10px] opacity-40 px-2 py-3 text-center">Sin resultados</p>;
                                        return results.map((item, i) => (
                                            <button key={i} onClick={() => { if (renditionRef.current) { pushHistory(); renditionRef.current.display(item.href); setTocSearch(''); } }}
                                                className="w-full text-left text-[11px] px-2 py-1.5 rounded-lg transition font-medium mb-0.5 truncate opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5">
                                                {item.label}
                                            </button>
                                        ));
                                    })()}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Barra de progreso */}
                <div className={`flex-shrink-0 relative ${focusMode && !focusToolbarVisible ? 'hidden' : ''}`} style={{ height: '28px', backgroundColor: 'var(--surface-bg)', borderTop: '1px solid var(--border-color)' }}>
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
                        <div className="flex items-center gap-2 min-w-0 max-w-[55%]">
                            {historyCount > 0 && (
                                <button onClick={goBackHistory}
                                    className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-black transition hover:bg-black/10 dark:hover:bg-white/10"
                                    style={{ color: 'var(--highlight)' }}
                                    title={`Volver a la posición anterior (Alt+←) · ${historyCount} en historial`}>
                                    <Icons.HistoryBack className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Volver</span>
                                </button>
                            )}
                            <span className="text-[10px] font-black opacity-40 truncate">
                                {currentChapterTitle || bookData.name}
                                {readFlow === 'paginated' && chapterTotal > 1 && (
                                    <span className="opacity-80"> · pág. {chapterPage}/{chapterTotal}</span>
                                )}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            {locationsGenerating && (
                                <span className="text-[9px] font-bold opacity-40 animate-pulse">Calculando...</span>
                            )}
                            {estimatedRemainingText && (
                                <span className="text-[10px] font-bold opacity-50">{estimatedRemainingText}</span>
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
