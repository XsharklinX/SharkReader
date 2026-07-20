import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Icons } from './icons';
import { useHighlightLabels } from './highlightLabels';
import { NEURAL_VOICES } from './ttsVoices';
import { buildPdfTtsBlocks, buildPdfTtsQueue } from './pdfTts';
import { useReaderSearchTask } from './hooks/useReaderSearchTask';
import ReaderSearchExcerpt from './ReaderSearchExcerpt';
import { addDiagnosticEntry } from './diagnostics';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// Mismos 4 colores que EPUB (highlightLabels.js): el color en sí es fijo,
// solo la etiqueta de texto es personalizable — y esa etiqueta se comparte
// entre ambos lectores a través de useHighlightLabels().
const HIGHLIGHT_COLORS = {
    yellow: 'rgba(250,204,21,0.5)',
    green:  'rgba(74,222,128,0.5)',
    blue:   'rgba(96,165,250,0.5)',
    pink:   'rgba(251,113,133,0.5)',
};

const TTS_HIGHLIGHT_FILL = 'rgba(56, 189, 248, 0.20)';
const TTS_CHUNK_MAX_LEN = 200;

const CANVAS_FILTER_PRESETS = {
    normal:   { label: 'Normal', icon: '☀', filter: 'none' },
    dark:     { label: 'Oscuro', icon: '🌙', filter: 'invert(1) hue-rotate(180deg)' },
    sepia:    { label: 'Sepia', icon: '📜', filter: 'sepia(0.6) contrast(0.9) brightness(0.95)' },
    contrast: { label: 'Alto contraste', icon: '◐', filter: 'contrast(1.35) brightness(0.97)' },
};

const HighlightLayer = ({ pageNum, bookmarks }) => {
    const highlights = (bookmarks || [])
        .filter(b => b.kind === 'highlight')
        .map(b => { try { return JSON.parse(b.note); } catch { return null; } })
        .filter(h => h?.pageNum === pageNum);
    if (!highlights.length) return null;
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {highlights.flatMap(h =>
                h.rects.map((r, i) => (
                    <div key={`${h.id}-${i}`} style={{
                        position: 'absolute',
                        left: `${r.xp * 100}%`, top: `${r.yp * 100}%`,
                        width: `${r.wp * 100}%`, height: `${r.hp * 100}%`,
                        background: HIGHLIGHT_COLORS[h.color] || HIGHLIGHT_COLORS.yellow,
                        borderRadius: '2px',
                    }} />
                ))
            )}
        </div>
    );
};

const TtsHighlightLayer = ({ rect }) => {
    if (!rect) return null;
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{
                position: 'absolute',
                left: `${rect.xp * 100}%`, top: `${rect.yp * 100}%`,
                width: `${rect.wp * 100}%`, height: `${rect.hp * 100}%`,
                background: TTS_HIGHLIGHT_FILL,
                boxShadow: '0 0 0 5px rgba(56, 189, 248, 0.20)',
                borderRadius: '4px',
                transition: 'all 0.2s ease',
            }} />
        </div>
    );
};

function formatRemainingText(minutes, lang = 'es') {
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

const PdfReader = ({
    bookData, targetPage, theme, t, lang = 'es', isFullscreen, focusMode,
    onClose, onOpenSettings, onOpenBookInfo,
    updateLocationAndProgress, toggleBookmark, onStatsUpdate, onPersistPdfZoom,
    tabs, activeTabId, allBooks, onSwitchTab, onCloseTab, onGoToLibrary
}) => {
    const canvasRef = useRef(null);
    const textLayerRef = useRef(null);
    const canvasRef2 = useRef(null);
    const textLayerRef2 = useRef(null);
    const containerRef = useRef(null);
    const pageWrapRef = useRef(null);
    const pageWrap1Ref = useRef(null);
    const pageWrap2Ref = useRef(null);
    const pdfRef = useRef(null);
    const renderTaskRef = useRef(null);
    const renderTaskRef2 = useRef(null);
    const selectionTimerRef = useRef(null);
    const wheelTimeout = useRef(null);
    const lastTrackedPageRef = useRef(null);
    const currentPageRef = useRef(1);
    const totalPagesRef = useRef(0);

    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    // Anuncio para lectores de pantalla — ver EpubReader.jsx para el porqué.
    const [readerAnnouncement, setReaderAnnouncement] = useState('');
    useEffect(() => {
        if (!currentPage || !totalPages) return;
        setReaderAnnouncement(`Página ${currentPage} de ${totalPages}`);
    }, [currentPage, totalPages]);
    const [scale, setScale] = useState(bookData.pdfScale || 1.2);
    const [dualPage, setDualPage] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [pdfError, setPdfError] = useState(null);
    const [inputPage, setInputPage] = useState('1');
    const [showToolbar, setShowToolbar] = useState(true);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [pendingNote, setPendingNote] = useState('');
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [focusToolbarVisible, setFocusToolbarVisible] = useState(true);
    const focusHideTimer = useRef(null);

    // Historial de posiciones: pila de páginas previas a saltos (índice, búsqueda, anotaciones)
    const historyRef = useRef([]);
    const [historyCount, setHistoryCount] = useState(0);

    // Imagen de cita
    const [quoteModal, setQuoteModal] = useState(null); // { text }
    const quoteCanvasRef = useRef(null);

    // Lectura en voz alta (TTS) — misma arquitectura de motor dual que EpubReader,
    // adaptada a páginas en vez de bloques DOM.
    const [showTtsPanel, setShowTtsPanel] = useState(false);
    const savedTtsPage = useMemo(() => {
        if (!showTtsPanel) return null;
        try { return parseInt(localStorage.getItem(`sr_tts_pos_${bookData.id}`), 10) || null; } catch { return null; }
    }, [showTtsPanel, bookData.id]);
    const [ttsStatus, setTtsStatus] = useState('idle'); // idle | playing | paused
    const [ttsRate, setTtsRate] = useState(() => { const r = parseFloat(localStorage.getItem('sr_tts_rate')); return Number.isFinite(r) ? r : 1; });
    const [ttsVoiceURI, setTtsVoiceURI] = useState(() => { try { return localStorage.getItem('sr_tts_voice') || ''; } catch { return ''; } });
    const [ttsVoices, setTtsVoices] = useState([]);
    const [ttsEngine, setTtsEngine] = useState(() => { try { return localStorage.getItem('sr_tts_engine') || 'neural'; } catch { return 'neural'; } });
    const [ttsNeuralVoice, setTtsNeuralVoice] = useState(() => { try { return localStorage.getItem('sr_tts_neural_voice') || 'es-ES-ElviraNeural'; } catch { return 'es-ES-ElviraNeural'; } });
    const [ttsHighlightRect, setTtsHighlightRect] = useState(null); // { xp, yp, wp, hp, pageNum }
    const ttsQueueRef = useRef([]);
    const ttsIndexRef = useRef(0);
    const ttsActiveRef = useRef(false);
    const ttsUttRef = useRef(null);
    const ttsRateRef = useRef(ttsRate);
    const ttsVoiceRef = useRef(ttsVoiceURI);
    const ttsEngineRef = useRef(ttsEngine);
    const ttsNeuralVoiceRef = useRef(ttsNeuralVoice);
    const ttsAudioRef = useRef(null);
    const ttsAudioCacheRef = useRef(new Map());
    const stopTtsRef = useRef(() => {});
    const restartTtsFromCurrentRef = useRef(() => {}); // fallback de resumeTts si resume() no reanuda de verdad
    const speakTtsElRef = useRef(() => {});
    const advanceTtsPageRef = useRef(() => {});

    const highlightLabels = useHighlightLabels();

    // Search
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
    const [isSearching, setIsSearching] = useState(false);
    const searchInputRef = useRef(null);
    const { beginSearchTask, cancelSearchTask } = useReaderSearchTask();

    useEffect(() => {
        if (showSearch) return;
        cancelSearchTask();
        setIsSearching(false);
    }, [showSearch, cancelSearchTask]);

    // Highlights & annotations
    const [highlightPopup, setHighlightPopup] = useState(null); // { x, y, text, rects, pageNum }
    const [showAnnotationsPanel, setShowAnnotationsPanel] = useState(false);
    const [annotationSearch, setAnnotationSearch] = useState('');
    const [annotationKindFilter, setAnnotationKindFilter] = useState('all');
    const [annotationColorFilter, setAnnotationColorFilter] = useState('all');

    // v3.4 — presets de filtro visual sobre el canvas (v5.0: más que solo invertir) + outline/TOC
    const [pdfFilterPreset, setPdfFilterPreset] = useState('normal');
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [outline, setOutline] = useState([]);
    const [showOutline, setShowOutline] = useState(false);
    const [outlineSearch, setOutlineSearch] = useState('');
    const canvasFilter = (CANVAS_FILTER_PRESETS[pdfFilterPreset] || CANVAS_FILTER_PRESETS.normal).filter;

    useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
    useEffect(() => { totalPagesRef.current = totalPages; }, [totalPages]);
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
    useEffect(() => {
        if (!window.speechSynthesis) return;
        const load = () => setTtsVoices(window.speechSynthesis.getVoices() || []);
        load();
        window.speechSynthesis.onvoiceschanged = load;
        return () => { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null; };
    }, []);

    // Parar TTS al cambiar de libro
    useEffect(() => () => {
        ttsActiveRef.current = false;
        try { window.speechSynthesis?.cancel(); } catch (_) {}
        try { ttsAudioRef.current?.pause(); } catch (_) {}
        ttsAudioRef.current = null;
    }, [bookData.id]);

    useEffect(() => () => {
        clearTimeout(focusHideTimer.current);
        clearTimeout(selectionTimerRef.current);
        clearTimeout(wheelTimeout.current);
        try { renderTaskRef.current?.cancel?.(); } catch (_) {}
        try { renderTaskRef2.current?.cancel?.(); } catch (_) {}
        try { pdfRef.current?.destroy?.(); } catch (_) {}
        try { window.speechSynthesis?.cancel(); } catch (_) {}
        try { ttsAudioRef.current?.pause(); } catch (_) {}
        renderTaskRef.current = null;
        renderTaskRef2.current = null;
        pdfRef.current = null;
    }, []);

    // Exporta las anotaciones del PDF como Markdown (ordenadas por página).
    const exportPdfAnnotations = () => {
        const items = (bookData.bookmarks || []).map(b => {
            if (b.kind === 'highlight') { try { const d = JSON.parse(b.note); return { page: d.pageNum, kind: 'Subrayado', text: d.text }; } catch { return null; } }
            return { page: parseInt(b.cfi, 10) || 0, kind: b.kind === 'note' ? 'Nota' : 'Marcador', text: b.note || '' };
        }).filter(Boolean).sort((a, z) => a.page - z.page);
        if (!items.length) return;
        const today = new Date().toISOString().slice(0, 10);
        const esc = (s) => String(s).replace(/"/g, "'");
        const lines = [
            '---',
            `title: "${esc(bookData.name || 'PDF')}"`,
            bookData.author ? `author: "${esc(bookData.author)}"` : null,
            `date: ${today}`,
            'source: SharkReader',
            'tags: ["lectura"]',
            '---',
            '',
            `# ${bookData.name || 'PDF'}`,
            '',
        ].filter(l => l !== null);
        items.forEach(a => {
            lines.push(`> ${a.text || '(sin texto)'}`);
            lines.push(`> — **${a.kind}** · pág. ${a.page}`);
            lines.push('');
        });
        const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${(bookData.name || 'pdf').replace(/[^a-z0-9]/gi, '_')}.md`;
        link.click();
        URL.revokeObjectURL(url);
    };


    useEffect(() => {
        if (!focusMode) { setFocusToolbarVisible(true); return; }
        const onMove = (e) => {
            setFocusToolbarVisible(true);
            clearTimeout(focusHideTimer.current);
            if (e.clientY > 80) focusHideTimer.current = setTimeout(() => setFocusToolbarVisible(false), 2500);
        };
        document.addEventListener('mousemove', onMove);
        focusHideTimer.current = setTimeout(() => setFocusToolbarVisible(false), 2500);
        return () => { document.removeEventListener('mousemove', onMove); clearTimeout(focusHideTimer.current); setFocusToolbarVisible(true); };
    }, [focusMode]);

    useEffect(() => {
        setIsBookmarked(bookData.bookmarks?.some(b => b.cfi === String(currentPage) && !b.note?.includes('[Subrayado]') && b.kind !== 'note' && b.kind !== 'highlight') || false);
    }, [currentPage, bookData.bookmarks]);

    useEffect(() => {
        setScale(bookData.pdfScale || 1.2);
        lastTrackedPageRef.current = null;
    }, [bookData.id, bookData.pdfScale]);

    useEffect(() => {
        const requestedPage = parseInt(targetPage, 10);
        if (!totalPages || !Number.isFinite(requestedPage) || requestedPage < 1) return;
        setCurrentPage(Math.min(requestedPage, totalPages));
    }, [targetPage, totalPages]);

    useEffect(() => {
        if (!onPersistPdfZoom) return;
        const timer = setTimeout(() => onPersistPdfZoom(bookData.id, scale), 250);
        return () => clearTimeout(timer);
    }, [bookData.id, onPersistPdfZoom, scale]);


    // Load PDF
    useEffect(() => {
        let isMounted = true;
        let loadingTask = null;
        setIsLoading(true);
        setPdfError(null);
        setOutline([]);
        try { pdfRef.current?.destroy?.(); } catch (_) {}
        pdfRef.current = null;
        const load = async () => {
            try {
                let data = bookData.file;
                if (data instanceof Blob) data = await data.arrayBuffer();
                loadingTask = pdfjsLib.getDocument({ data });
                const pdf = await loadingTask.promise;
                if (!isMounted) return;
                pdfRef.current = pdf;
                setTotalPages(pdf.numPages);
                const requestedPage = parseInt(targetPage, 10);
                const savedPage = Number.isFinite(requestedPage) && requestedPage > 0
                    ? requestedPage
                    : (bookData.lastLocation ? parseInt(bookData.lastLocation, 10) || 1 : 1);
                const startPage = Math.min(Math.max(1, savedPage), pdf.numPages);
                setCurrentPage(startPage);
                setInputPage(String(startPage));
                setIsLoading(false);
                // Outline / índice del PDF (best-effort)
                try {
                    const ol = await pdf.getOutline();
                    if (isMounted && ol && ol.length) {
                        const flatten = async (items, depth = 0, acc = []) => {
                            for (const it of items) {
                                let page = null;
                                try {
                                    const dest = typeof it.dest === 'string' ? await pdf.getDestination(it.dest) : it.dest;
                                    if (dest && dest[0]) page = (await pdf.getPageIndex(dest[0])) + 1;
                                } catch (_) {}
                                acc.push({ title: it.title, page, depth });
                                if (it.items?.length && depth < 3) await flatten(it.items, depth + 1, acc);
                            }
                            return acc;
                        };
                        const flat = await flatten(ol);
                        if (isMounted) setOutline(flat);
                    }
                } catch (_) {}
            } catch (err) {
                console.error('Error loading PDF:', err);
                if (isMounted) { setIsLoading(false); setPdfError(err?.message || 'No se pudo cargar el PDF.'); }
            }
        };
        load();
        return () => {
            isMounted = false;
            try { loadingTask?.destroy?.(); } catch (_) {}
        };
    }, [bookData.file]);

    // Helper: render a single page onto a canvas + text layer
    const renderPage = useCallback(async (pageNum, canvas, textLayer, taskRef, containerW, isMountedCheck, dual) => {
        try {
            if (taskRef.current) { taskRef.current.cancel(); taskRef.current = null; }
            const page = await pdfRef.current.getPage(pageNum);
            if (!isMountedCheck()) return;
            const baseVp = page.getViewport({ scale: 1 });
            const usableW = dual ? (containerW / 2 - 32) : (containerW - 48);
            const autoScale = Math.min(scale, usableW / baseVp.width);
            const viewport = page.getViewport({ scale: Math.max(autoScale, 0.7) });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            const task = page.render({ canvasContext: ctx, viewport });
            taskRef.current = task;
            await task.promise;
            if (!isMountedCheck()) return;
            if (textLayer && pdfjsLib.TextLayer) {
                textLayer.innerHTML = '';
                textLayer.style.width = `${viewport.width}px`;
                textLayer.style.height = `${viewport.height}px`;
                try {
                    const tc = await page.getTextContent();
                    if (!isMountedCheck()) return;
                    const tl = new pdfjsLib.TextLayer({ textContentSource: tc, container: textLayer, viewport });
                    await tl.render();
                } catch (err) {
                    console.warn('[SharkReader] PDF text layer render failed:', err);
                }
            }
        } catch (err) {
            if (err?.name !== 'RenderingCancelledException') console.error('Render error:', err);
        }
    }, [scale]);

    // Render page + text layer
    useEffect(() => {
        if (!pdfRef.current || !canvasRef.current || isLoading) return;
        let isMounted = true;
        const isMountedCheck = () => isMounted;
        const containerW = containerRef.current?.clientWidth || 800;

        const doRender = async () => {
            // dualPage just enabled: canvas2 may not be in the DOM yet — wait one frame
            if (dualPage && !canvasRef2.current) {
                await new Promise(r => requestAnimationFrame(r));
            }
            await renderPage(currentPage, canvasRef.current, textLayerRef.current, renderTaskRef, containerW, isMountedCheck, dualPage);
            if (!isMounted) return;
            if (dualPage && currentPage + 1 <= totalPages && canvasRef2.current) {
                await renderPage(currentPage + 1, canvasRef2.current, textLayerRef2.current, renderTaskRef2, containerW, isMountedCheck, dualPage);
            } else if (canvasRef2.current) {
                // Clear second canvas when no second page
                const ctx2 = canvasRef2.current.getContext('2d');
                ctx2.clearRect(0, 0, canvasRef2.current.width, canvasRef2.current.height);
                canvasRef2.current.width = 0;
            }
            if (!isMounted) return;
            if (lastTrackedPageRef.current !== currentPage) {
                lastTrackedPageRef.current = currentPage;
                const pct = Math.round((currentPage / totalPages) * 100);
                updateLocationAndProgress(bookData.id, String(currentPage), pct);
                onStatsUpdate && onStatsUpdate(1);
            }
            setInputPage(String(currentPage));
        };
        doRender();
        return () => {
            isMounted = false;
            try { renderTaskRef.current?.cancel?.(); } catch (_) {}
            try { renderTaskRef2.current?.cancel?.(); } catch (_) {}
        };
    }, [pdfRef.current, currentPage, scale, totalPages, isLoading, dualPage]);

    const goTo = useCallback((n) => {
        if (!totalPages) return;
        setCurrentPage(Math.min(Math.max(1, n), totalPages));
    }, [totalPages]);

    // Guarda la página actual antes de un salto (índice, búsqueda, anotación).
    const pushHistory = useCallback(() => {
        const stack = historyRef.current;
        const page = currentPageRef.current;
        if (stack[stack.length - 1] !== page) {
            stack.push(page);
            if (stack.length > 50) stack.shift();
            setHistoryCount(stack.length);
        }
    }, []);

    const goBackHistory = useCallback(() => {
        const page = historyRef.current.pop();
        setHistoryCount(historyRef.current.length);
        if (page) {
            if (ttsActiveRef.current) stopTtsRef.current();
            goTo(page);
        }
    }, [goTo]);

    const prevPage = useCallback(() => {
        if (ttsActiveRef.current) stopTtsRef.current();
        goTo(currentPage - (dualPage ? 2 : 1));
    }, [currentPage, dualPage, goTo]);

    const nextPage = useCallback(() => {
        if (ttsActiveRef.current) {
            try { window.speechSynthesis.cancel(); } catch (_) {}
            try { ttsAudioRef.current?.pause(); } catch (_) {}
            ttsAudioRef.current = null;
            advanceTtsPageRef.current?.();
            return;
        }
        goTo(currentPage + (dualPage ? 2 : 1));
    }, [currentPage, dualPage, goTo]);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); setScale(s => Math.min(4, parseFloat((s + 0.2).toFixed(1)))); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setScale(s => Math.max(0.7, parseFloat((s - 0.2).toFixed(1)))); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setScale(1.2); return; }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); setShowSearch(p => !p); return; }
            const activeElement = document.activeElement;
            if (
                activeElement?.tagName === 'INPUT' ||
                activeElement?.tagName === 'TEXTAREA' ||
                activeElement?.tagName === 'SELECT' ||
                activeElement?.isContentEditable
            ) return;
            if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBackHistory(); return; }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevPage();
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextPage();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [prevPage, nextPage, goBackHistory]);

    const handleWheel = (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setScale(s => {
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                return Math.min(4, Math.max(0.4, parseFloat((s + delta).toFixed(1))));
            });
            return;
        }
        if (wheelTimeout.current) return;
        wheelTimeout.current = setTimeout(() => { wheelTimeout.current = null; }, 350);
        if (e.deltaY > 0) nextPage(); else prevPage();
    };

    // Search across all pages
    const runSearch = useCallback(async (query) => {
        const needle = query.trim();
        const pdf = pdfRef.current;
        if (!pdf || !needle) {
            cancelSearchTask();
            setSearchResults([]);
            setSearchActiveIndex(-1);
            setIsSearching(false);
            return;
        }
        const isCurrentSearch = beginSearchTask();
        setIsSearching(true);
        const results = [];
        try {
            const lowerNeedle = needle.toLowerCase();
            for (let p = 1; p <= pdf.numPages; p++) {
                if (!isCurrentSearch()) return;
                const page = await pdf.getPage(p);
                try {
                    const tc = await page.getTextContent();
                    if (!isCurrentSearch()) return;
                    const pageText = tc.items.map(i => i.str).join(' ');
                    const lowerText = pageText.toLowerCase();
                    let idx = lowerText.indexOf(lowerNeedle);
                    while (idx !== -1 && results.length < 80) {
                        const start = Math.max(0, idx - 60);
                        const excerpt = pageText.slice(start, idx + needle.length + 60);
                        results.push({ page: p, excerpt, index: idx });
                        idx = lowerText.indexOf(lowerNeedle, idx + lowerNeedle.length);
                    }
                } finally {
                    page.cleanup?.();
                }
                if (results.length >= 80) break;
            }
        } catch (err) {
            if (!isCurrentSearch()) return;
            console.warn('[SharkReader] PDF search failed:', err);
        } finally {
            if (isCurrentSearch()) {
                setSearchResults(results);
                setSearchActiveIndex(results.length > 0 ? 0 : -1);
                setIsSearching(false);
            }
        }
    }, [beginSearchTask, cancelSearchTask]);

    const jumpToSearchIndex = useCallback((index) => {
        const result = searchResults[index];
        if (!result) return;
        pushHistory();
        setSearchActiveIndex(index);
        goTo(result.page);
    }, [goTo, searchResults, pushHistory]);

    const moveSearchResult = useCallback((direction) => {
        if (!searchResults.length) return;
        const next = searchActiveIndex < 0
            ? 0
            : (searchActiveIndex + direction + searchResults.length) % searchResults.length;
        jumpToSearchIndex(next);
    }, [jumpToSearchIndex, searchActiveIndex, searchResults.length]);

    useEffect(() => {
        if (showSearch && searchInputRef.current) searchInputRef.current.focus();
    }, [showSearch]);

    // ── TTS: construye la cola de una página a partir de getTextContent(), ──
    // independiente del render visual (así no hay que esperar al canvas).
    const buildQueueForPage = useCallback(async (pageNum) => {
        if (!pdfRef.current) return [];
        try {
            const page = await pdfRef.current.getPage(pageNum);
            const baseVp = page.getViewport({ scale: 1 });
            const tc = await page.getTextContent();
            page.cleanup?.();
            const blocks = buildPdfTtsBlocks(tc.items, baseVp.width, baseVp.height);
            return buildPdfTtsQueue(blocks, TTS_CHUNK_MAX_LEN).map(chunk => ({ ...chunk, pageNum }));
        } catch (_) {
            return [];
        }
    }, []);

    const stopTts = useCallback(() => {
        if (ttsActiveRef.current) {
            try { localStorage.setItem(`sr_tts_pos_${bookData.id}`, String(currentPageRef.current)); } catch (_) {}
        }
        ttsActiveRef.current = false;
        ttsUttRef.current = null;
        ttsQueueRef.current = [];
        ttsIndexRef.current = 0;
        setTtsHighlightRect(null);
        try { window.speechSynthesis?.cancel(); } catch (_) {}
        try { ttsAudioRef.current?.pause(); } catch (_) {}
        ttsAudioRef.current = null;
        ttsAudioCacheRef.current.clear();
        setTtsStatus('idle');
    }, [bookData.id]);
    useEffect(() => { stopTtsRef.current = stopTts; }, [stopTts]);

    // Limpieza al cerrar el libro / desmontar el lector — ver EpubReader.jsx
    // para el porqué: sin esto la lectura en voz alta seguía sonando después
    // de cerrar el PDF.
    useEffect(() => () => {
        try { window.speechSynthesis?.cancel(); } catch (_) {}
        try { ttsAudioRef.current?.pause(); } catch (_) {}
    }, []);

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

    // Al agotar la cola de la página visible, pasa página y sigue leyendo.
    // depth evita bucles si una página no aporta texto (p. ej. solo imágenes).
    const advanceTtsPage = useCallback((depth = 0) => {
        if (!ttsActiveRef.current || depth >= 4) { stopTts(); return; }
        const next = currentPageRef.current + 1;
        if (next > totalPagesRef.current) { stopTts(); return; }
        goTo(next);
        buildQueueForPage(next).then(queue => {
            if (!ttsActiveRef.current) return;
            if (!queue.length) { advanceTtsPage(depth + 1); return; }
            ttsQueueRef.current = queue;
            ttsAudioCacheRef.current.clear();
            speakTtsElRef.current?.(0);
        });
    }, [goTo, buildQueueForPage, stopTts]);
    useEffect(() => { advanceTtsPageRef.current = advanceTtsPage; }, [advanceTtsPage]);

    const speakTtsEl = useCallback((index) => {
        if (!ttsActiveRef.current) return;
        const queue = ttsQueueRef.current;
        if (index >= queue.length) {
            setTtsHighlightRect(null);
            advanceTtsPage();
            return;
        }
        const chunk = queue[index];
        ttsIndexRef.current = index;
        if (!chunk.text) { speakTtsEl(index + 1); return; }

        setTtsHighlightRect({ ...chunk.rect, pageNum: chunk.pageNum });

        const advance = () => {
            if (!ttsActiveRef.current) return;
            speakTtsEl(index + 1);
        };

        // ── Motor neuronal (Edge, requiere internet) ──
        if (ttsEngineRef.current === 'neural' && window.electronAPI?.synthesizeNeuralTts) {
            fetchNeuralAudio(index).then(data => {
                if (!ttsActiveRef.current || ttsIndexRef.current !== index) return;
                if (!data) {
                    addDiagnosticEntry('warning', 'TTS neuronal: sin datos de audio (sin internet o servicio caído)', { source: 'tts', engine: 'neural' });
                    stopTts();
                    return;
                }
                fetchNeuralAudio(index + 1); // prefetch
                const url = URL.createObjectURL(new Blob([data], { type: 'audio/mpeg' }));
                const audio = new Audio(url);
                ttsAudioRef.current = audio;
                audio.onended = () => { URL.revokeObjectURL(url); advance(); };
                audio.onerror = () => {
                    addDiagnosticEntry('warning', 'TTS neuronal: error al reproducir el audio generado', { source: 'tts', engine: 'neural' });
                    URL.revokeObjectURL(url);
                    if (ttsActiveRef.current) stopTts();
                };
                audio.play().catch((err) => {
                    addDiagnosticEntry('warning', `TTS neuronal: audio.play() rechazado — ${err?.message || err}`, { source: 'tts', engine: 'neural' });
                    if (ttsActiveRef.current) stopTts();
                });
            });
            return;
        }

        // ── Motor del sistema (offline) ──
        const utt = new SpeechSynthesisUtterance(chunk.text);
        utt.rate = ttsRateRef.current;
        utt.lang = lang === 'es' ? 'es-ES' : 'en-US';
        const voice = (window.speechSynthesis.getVoices() || []).find(v => v.voiceURI === ttsVoiceRef.current);
        if (voice) { utt.voice = voice; utt.lang = voice.lang; }
        utt.onend = advance;
        utt.onerror = (e) => {
            if (e?.error === 'interrupted' || e?.error === 'canceled') return;
            addDiagnosticEntry('warning', `TTS del sistema: ${e?.error || 'error desconocido'}`, { source: 'tts', engine: 'system' });
            if (ttsActiveRef.current) stopTts();
        };
        ttsUttRef.current = utt;
        window.speechSynthesis.speak(utt);
    }, [lang, advanceTtsPage, stopTts, fetchNeuralAudio]);
    useEffect(() => { speakTtsElRef.current = speakTtsEl; }, [speakTtsEl]);

    const startTts = useCallback(() => {
        if (!window.speechSynthesis || !pdfRef.current) return;
        try { window.speechSynthesis.cancel(); } catch (_) {}
        buildQueueForPage(currentPageRef.current).then(queue => {
            if (!queue.length) return;
            ttsQueueRef.current = queue;
            ttsIndexRef.current = 0;
            ttsAudioCacheRef.current.clear();
            ttsActiveRef.current = true;
            setTtsStatus('playing');
            speakTtsEl(0);
        });
    }, [buildQueueForPage, speakTtsEl]);

    // Retoma la escucha desde la última página guardada de este libro.
    const resumeTtsFromSaved = useCallback(() => {
        if (!window.speechSynthesis || !pdfRef.current || !savedTtsPage) return;
        pushHistory();
        goTo(savedTtsPage);
        buildQueueForPage(savedTtsPage).then(queue => {
            if (!queue.length) return;
            try { window.speechSynthesis.cancel(); } catch (_) {}
            ttsQueueRef.current = queue;
            ttsIndexRef.current = 0;
            ttsAudioCacheRef.current.clear();
            ttsActiveRef.current = true;
            setTtsStatus('playing');
            speakTtsEl(0);
        });
    }, [savedTtsPage, goTo, pushHistory, buildQueueForPage, speakTtsEl]);

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
            // Bug conocido de speechSynthesis en varios motores: resume() no
            // siempre reanuda de verdad tras una pausa larga. Si sigue marcada
            // como pausada un instante después, se reinicia desde el mismo
            // trozo en vez de dejar la UI en "reproduciendo" sin audio.
            setTimeout(() => {
                if (ttsActiveRef.current && ttsEngineRef.current !== 'neural' && window.speechSynthesis?.paused) {
                    addDiagnosticEntry('warning', 'TTS: resume() no reanudó la síntesis — reiniciando desde el trozo actual', { source: 'tts', engine: 'system' });
                    restartTtsFromCurrentRef.current();
                }
            }, 400);
        }
        setTtsStatus('playing');
    }, []);

    // Cambiar velocidad/voz/motor en caliente: reinicia desde el trozo actual
    const restartTtsFromCurrent = useCallback(() => {
        if (!ttsActiveRef.current) return;
        const index = ttsIndexRef.current;
        ttsActiveRef.current = false;
        try { window.speechSynthesis.cancel(); } catch (_) {}
        try { ttsAudioRef.current?.pause(); } catch (_) {}
        ttsAudioRef.current = null;
        ttsAudioCacheRef.current.clear();
        setTtsStatus('playing');
        setTimeout(() => {
            if (!ttsQueueRef.current.length) return;
            ttsActiveRef.current = true;
            speakTtsEl(index);
        }, 80);
    }, [speakTtsEl]);
    useEffect(() => { restartTtsFromCurrentRef.current = restartTtsFromCurrent; }, [restartTtsFromCurrent]);

    // Clic en un párrafo mientras se lee: salta la lectura ahí (solo en modo página única)
    const handlePageClick = useCallback((e) => {
        if (isFullscreen) setShowToolbar(p => !p);
        if (!ttsActiveRef.current || dualPage) return;
        const wrap = pageWrapRef.current;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const yp = (e.clientY - rect.top) / rect.height;
        const queue = ttsQueueRef.current;
        if (!queue.length) return;
        let bestIdx = -1, bestDist = Infinity;
        queue.forEach((chunk, i) => {
            if (!chunk.rect) return;
            const mid = chunk.rect.yp + chunk.rect.hp / 2;
            const dist = Math.abs(mid - yp);
            if (dist < bestDist) { bestDist = dist; bestIdx = i; }
        });
        if (bestIdx === -1) return;
        ttsActiveRef.current = false;
        try { window.speechSynthesis.cancel(); } catch (_) {}
        try { ttsAudioRef.current?.pause(); } catch (_) {}
        ttsAudioRef.current = null;
        ttsAudioCacheRef.current.clear();
        ttsIndexRef.current = bestIdx;
        ttsActiveRef.current = true;
        setTtsStatus('playing');
        speakTtsEl(bestIdx);
    }, [isFullscreen, dualPage, speakTtsEl]);

    const handleAddBookmark = () => {
        if (isBookmarked) toggleBookmark(bookData.id, String(currentPage), null, true);
        else toggleBookmark(bookData.id, String(currentPage), `Página ${currentPage}`);
    };

    const handleAddPageNote = () => {
        setPendingNote('');
        setShowNoteModal(true);
    };

    const savePageNote = () => {
        toggleBookmark(bookData.id, String(currentPage), pendingNote.trim() || `Nota en página ${currentPage}`, false, { kind: 'note' });
        setShowNoteModal(false);
        setPendingNote('');
    };

    const handleTextMouseUp = useCallback((e, pageNum, pageWrapEl) => {
        clearTimeout(selectionTimerRef.current);
        selectionTimerRef.current = setTimeout(() => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.rangeCount) return;
            const selText = sel.toString().trim();
            if (selText.length < 2) return;
            const range = sel.getRangeAt(0);
            const pageRect = pageWrapEl?.getBoundingClientRect();
            if (!pageRect || pageRect.width === 0) return;
            const clientRects = Array.from(range.getClientRects());
            const rects = clientRects.map(r => ({
                xp: (r.left - pageRect.left) / pageRect.width,
                yp: (r.top - pageRect.top) / pageRect.height,
                wp: r.width / pageRect.width,
                hp: r.height / pageRect.height,
            })).filter(r => r.wp > 0.001 && r.hp > 0.001);
            if (!rects.length) return;
            const last = clientRects[clientRects.length - 1];
            setHighlightPopup({ x: last.left + last.width / 2, y: last.bottom, text: selText, rects, pageNum });
            selectionTimerRef.current = null;
        }, 10);
    }, []);

    const saveHighlight = useCallback((color) => {
        if (!highlightPopup) return;
        const id = `hl-${Date.now()}`;
        const data = { id, pageNum: highlightPopup.pageNum, rects: highlightPopup.rects, color, text: highlightPopup.text };
        toggleBookmark(bookData.id, id, JSON.stringify(data), false, { kind: 'highlight' });
        window.getSelection()?.removeAllRanges();
        setHighlightPopup(null);
    }, [highlightPopup, bookData.id, toggleBookmark]);

    const deleteHighlight = useCallback((hlId) => {
        toggleBookmark(bookData.id, hlId, null, true, { kind: 'highlight' });
    }, [bookData.id, toggleBookmark]);

    const slugName = () => (bookData.name || 'pdf').replace(/[^a-z0-9]/gi, '_');

    // ── IMAGEN DE CITA (canvas 1080×1080 descargable) — mismo diseño que EpubReader ──
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

        ctx.strokeStyle = p.accent;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 3;
        ctx.strokeRect(48, 48, W - 96, H - 96);
        ctx.globalAlpha = 1;

        ctx.fillStyle = p.accent;
        ctx.globalAlpha = 0.5;
        ctx.font = '900 190px Georgia, serif';
        ctx.textAlign = 'left';
        ctx.fillText('"', 90, 250);
        ctx.globalAlpha = 1;

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

        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(W / 2 - 60, H - 235);
        ctx.lineTo(W / 2 + 60, H - 235);
        ctx.stroke();

        ctx.font = '700 34px Inter, "Helvetica Neue", Arial, sans-serif';
        ctx.fillStyle = p.text;
        ctx.fillText(bookData.name || 'PDF', W / 2, H - 175, W - 200);
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

    const pdfAnnotations = useMemo(() => {
        return (bookData.bookmarks || [])
            .map(b => {
                if (b.kind === 'highlight') {
                    try { const data = JSON.parse(b.note); return { ...b, _page: data.pageNum, _data: data, _kind: 'highlight', _text: data.text || '' }; } catch { return null; }
                }
                const kind = b.kind === 'note' ? 'note' : 'bookmark';
                return { ...b, _page: parseInt(b.cfi, 10) || 0, _kind: kind, _text: b.note || '' };
            })
            .filter(Boolean)
            .sort((a, z) => a._page - z._page);
    }, [bookData.bookmarks]);

    const pdfAnnotationStats = useMemo(() => {
        return pdfAnnotations.reduce((acc, item) => {
            acc.total += 1;
            acc[item._kind] = (acc[item._kind] || 0) + 1;
            if (item._kind === 'highlight') acc.colors[item._data.color] = (acc.colors[item._data.color] || 0) + 1;
            return acc;
        }, { total: 0, highlight: 0, note: 0, bookmark: 0, colors: {} });
    }, [pdfAnnotations]);

    const filteredPdfAnnotations = useMemo(() => {
        const q = annotationSearch.trim().toLowerCase();
        return pdfAnnotations.filter(item => {
            if (annotationKindFilter !== 'all' && item._kind !== annotationKindFilter) return false;
            if (annotationColorFilter !== 'all' && item._kind === 'highlight' && item._data.color !== annotationColorFilter) return false;
            if (annotationColorFilter !== 'all' && item._kind !== 'highlight') return false;
            if (!q) return true;
            return [item._text, item.note, item._kind, item._page].filter(Boolean)
                .some(value => String(value).toLowerCase().includes(q));
        });
    }, [annotationColorFilter, annotationKindFilter, annotationSearch, pdfAnnotations]);

    const pct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
    const estimatedRemainingText = (() => {
        const readingMinutes = Number(bookData.readingMinutes || 0);
        if (pct < 3 || readingMinutes < 3) return '';
        const estimatedTotal = readingMinutes / (pct / 100);
        const remaining = Math.max(1, Math.round(estimatedTotal - readingMinutes));
        return formatRemainingText(remaining, lang);
    })();
    const bgColor = theme === 'dark' ? '#0f172a' : theme === 'sepia' ? '#f5f0e8' : '#f8fafc';

    return (
        <div className={`w-full h-full flex flex-col relative ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
            style={{ backgroundColor: bgColor }}>

            {/* Anuncio para lectores de pantalla: página actual — invisible en
                pantalla, solo lo escucha un lector de pantalla. */}
            <div className="sr-only" role="status" aria-live="polite">{readerAnnouncement}</div>

            {/* Error screen */}
            {pdfError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-50 gap-5 p-8 text-center"
                    style={{ backgroundColor: bgColor, color: 'var(--text-color)' }}>
                    <span className="text-6xl">📄</span>
                    <h2 className="text-xl font-black">Error al cargar el PDF</h2>
                    <p className="text-sm opacity-60 max-w-sm font-medium">{pdfError}</p>
                    <button onClick={onClose} className="px-6 py-3 rounded-2xl font-black text-sm text-white"
                        style={{ backgroundColor: 'var(--highlight)' }}>← Volver</button>
                </div>
            )}

            {/* ── BARRA SUPERIOR ── */}
            {!isFullscreen && (
                <div className={`flex-shrink-0 flex flex-col text-white shadow-md z-40 focus-mode-toolbar ${focusMode && !focusToolbarVisible ? 'hidden' : ''}`}
                    style={{ background: 'linear-gradient(to right, var(--topbar-bg), var(--highlight))' }}>

                    {/* Pestañas */}
                    {tabs && (
                        <div className="flex items-stretch flex-shrink-0 overflow-x-auto overflow-y-hidden select-none"
                            style={{ height: '34px', backgroundColor: 'rgba(0,0,0,0.22)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <button onClick={onGoToLibrary} aria-label="Ir a la biblioteca" className="px-3 h-full hover:bg-white/10 transition flex-shrink-0 flex items-center opacity-70 hover:opacity-100">
                                <Icons.Library />
                            </button>
                            <div className="w-px bg-white/10 flex-shrink-0 self-stretch my-1"></div>
                            {tabs.map(tab => {
                                const book = allBooks?.find(b => b.id === tab.bookId);
                                const isActive = tab.id === activeTabId;
                                return (
                                    <div key={tab.id}
                                        role="tab"
                                        aria-selected={isActive}
                                        tabIndex={0}
                                        title={book?.name || 'Libro'}
                                        className={`flex items-center gap-1.5 px-3 flex-shrink-0 max-w-[180px] min-w-[80px] cursor-pointer group border-r border-white/10 relative transition-all ${isActive ? 'bg-white/15' : 'hover:bg-white/10 opacity-70 hover:opacity-100'}`}
                                        onClick={() => onSwitchTab?.(tab.id)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSwitchTab?.(tab.id); } }}>
                                        {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t" />}
                                        <span className="text-white text-[11px] font-semibold truncate flex-1 leading-none">{book?.name || '…'}</span>
                                        <button onClick={(e) => onCloseTab?.(tab.id, e)}
                                            aria-label={`Cerrar pestaña: ${book?.name || 'Libro'}`}
                                            className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-white hover:bg-white/20 rounded w-4 h-4 flex items-center justify-center flex-shrink-0 transition text-xs leading-none">×</button>
                                    </div>
                                );
                            })}
                            <button onClick={onGoToLibrary} className="px-3 h-full text-white/40 hover:text-white hover:bg-white/10 transition flex-shrink-0 flex items-center justify-center text-xl font-light leading-none">+</button>
                        </div>
                    )}

                    {/* Controles */}
                    <div className="h-14 flex items-center justify-between px-3 gap-2">
                        <div className="flex items-center gap-1 min-w-0">
                            <button onClick={onClose} aria-label="Volver a la biblioteca" className="p-2 hover:bg-black/20 rounded-full transition flex-shrink-0"><Icons.Back /></button>
                            <button onClick={onOpenBookInfo} className="flex items-center gap-1 hover:bg-black/10 px-2 py-1 rounded-xl transition min-w-0">
                                <span className="font-bold text-sm truncate max-w-[140px] sm:max-w-xs">{bookData.name}</span>
                                <Icons.Info />
                            </button>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Zoom */}
                            <div className="flex items-center bg-black/20 rounded-xl overflow-hidden">
                                <button onClick={() => setScale(s => Math.max(0.7, parseFloat((s - 0.2).toFixed(1))))}
                                    aria-label="Alejar" className="px-2 py-1.5 hover:bg-white/20 transition font-bold text-base leading-none">−</button>
                                <span className="px-2 text-xs font-black min-w-[44px] text-center">{Math.round(scale * 100)}%</span>
                                <button onClick={() => setScale(s => Math.min(4, parseFloat((s + 0.2).toFixed(1))))}
                                    aria-label="Acercar" className="px-2 py-1.5 hover:bg-white/20 transition font-bold text-base leading-none">+</button>
                            </div>
                            <div className="w-px h-5 bg-white/20 mx-0.5"></div>
                            <button onClick={prevPage} disabled={currentPage <= 1}
                                className="p-1.5 hover:bg-white/15 rounded-xl transition disabled:opacity-30"><Icons.ChevronLeft /></button>
                            <div className="flex items-center gap-1 bg-black/20 rounded-xl px-2 py-1">
                                <input type="text" value={inputPage}
                                    onChange={e => setInputPage(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { const n = parseInt(inputPage, 10); if (!isNaN(n)) goTo(n); } }}
                                    onBlur={() => { const n = parseInt(inputPage, 10); if (!isNaN(n)) goTo(n); else setInputPage(String(currentPage)); }}
                                    className="w-10 bg-transparent text-center text-xs font-black outline-none" />
                                <span className="text-xs opacity-60">/ {totalPages}</span>
                            </div>
                            <button onClick={nextPage} disabled={currentPage >= totalPages}
                                className="p-1.5 hover:bg-white/15 rounded-xl transition disabled:opacity-30"><Icons.ChevronRight /></button>
                            <div className="w-px h-5 bg-white/20 mx-0.5"></div>
                            {/* Índice / TOC (solo si el PDF lo trae) */}
                            {outline.length > 0 && (
                                <button onClick={() => { setShowOutline(p => !p); setShowSearch(false); setShowAnnotationsPanel(false); }}
                                    className={`p-1.5 rounded-xl transition ${showOutline ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                    title="Índice del documento">
                                    <Icons.List />
                                </button>
                            )}
                            {/* Presets de filtro visual (normal / oscuro / sepia / alto contraste) */}
                            <div className="relative" onClick={e => e.stopPropagation()}>
                                <button onClick={() => setShowFilterMenu(p => !p)}
                                    className={`p-1.5 rounded-xl transition text-sm leading-none ${pdfFilterPreset !== 'normal' ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                    title="Tema visual de la página">
                                    {CANVAS_FILTER_PRESETS[pdfFilterPreset].icon}
                                </button>
                                {showFilterMenu && (
                                    <div className="topbar-popup active" style={{ minWidth: '170px' }}>
                                        <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-2">Tema visual</p>
                                        <div className="flex flex-col gap-1">
                                            {Object.entries(CANVAS_FILTER_PRESETS).map(([id, preset]) => (
                                                <button key={id} onClick={() => { setPdfFilterPreset(id); setShowFilterMenu(false); }}
                                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold transition text-left ${pdfFilterPreset === id ? 'bg-[var(--highlight)] text-white' : 'bg-black/5 dark:bg-white/5 opacity-70 hover:opacity-100'}`}>
                                                    <span>{preset.icon}</span> {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Search */}
                            <button onClick={() => setShowSearch(p => !p)}
                                className={`p-1.5 rounded-xl transition ${showSearch ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                title="Buscar en el PDF (Ctrl+F)">
                                <Icons.Search />
                            </button>
                            <button onClick={handleAddBookmark} className="p-1.5 hover:bg-white/15 rounded-xl transition" title="Marcador">
                                <Icons.Bookmark fill={isBookmarked ? '#facc15' : 'none'} color={isBookmarked ? '#facc15' : 'currentColor'} />
                            </button>
                            <button onClick={handleAddPageNote} className="p-1.5 hover:bg-white/15 rounded-xl transition" title="Nota de página">
                                <Icons.Notes />
                            </button>
                            <button onClick={() => { setShowAnnotationsPanel(p => !p); setShowSearch(false); }}
                                className={`p-1.5 rounded-xl transition ${showAnnotationsPanel ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                title="Anotaciones">
                                <Icons.AnnotationPanel />
                            </button>
                            {window.speechSynthesis && (
                                <div className="relative" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => setShowTtsPanel(p => !p)}
                                        className={`p-1.5 rounded-xl transition ${showTtsPanel ? 'bg-white/25' : ttsStatus === 'playing' ? 'text-green-400 hover:bg-white/15' : 'hover:bg-white/15'}`}
                                        title="Leer en voz alta">
                                        <Icons.Speaker />
                                    </button>
                                    {showTtsPanel && (
                                        <div className="topbar-popup active" style={{ minWidth: '240px' }} onWheel={e => e.stopPropagation()}>
                                            <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-3">Leer en voz alta</p>
                                            {ttsStatus === 'idle' && savedTtsPage && savedTtsPage !== currentPage && (
                                                <button onClick={resumeTtsFromSaved}
                                                    className="w-full mb-2 py-2 rounded-xl font-bold text-sm transition border"
                                                    style={{ borderColor: 'var(--highlight)', color: 'var(--highlight)' }}>
                                                    ⏵ Continuar en pág. {savedTtsPage}
                                                </button>
                                            )}
                                            <div className="flex gap-1.5 mb-3">
                                                {ttsStatus === 'idle' && (
                                                    <button onClick={startTts}
                                                        className="flex-1 py-2 rounded-xl font-bold text-sm text-white transition"
                                                        style={{ backgroundColor: 'var(--highlight)' }}>
                                                        ▶ Leer esta página
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
                                                    <button onClick={stopTts} aria-label="Detener lectura en voz alta"
                                                        className="px-3 py-2 rounded-xl font-bold text-sm bg-red-500/15 text-red-500 transition hover:bg-red-500/25">
                                                        ■
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1">Velocidad</p>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-xs opacity-50">🐢</span>
                                                <input type="range" min="0.5" max="2" step="0.1" value={ttsRate}
                                                    onChange={e => setTtsRate(parseFloat(e.target.value))}
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
                                                    {ttsVoices.filter(v => v.lang?.toLowerCase().startsWith(lang === 'es' ? 'es' : 'en')).map(v => (
                                                        <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                                                    ))}
                                                </select>
                                            )}
                                            {ttsEngine === 'system' && ttsVoices.length === 0 && (
                                                <p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[10px] font-bold text-amber-500">
                                                    ⚠ No se encontraron voces instaladas en el sistema. Prueba el motor Neural, o instala voces desde la configuración de idioma de Windows.
                                                </p>
                                            )}
                                            <p className="text-[9px] opacity-40 mt-2 leading-relaxed">
                                                Lee la página actual y pasa sola a la siguiente. Toca cualquier párrafo mientras lee para saltar ahí.
                                                {ttsEngine === 'system' && ttsVoices.length > 0 ? ` ${ttsVoices.length} voces disponibles.` : ''}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                            <button onClick={() => setDualPage(p => !p)}
                                className={`p-1.5 rounded-xl transition hidden sm:flex items-center gap-1 text-xs font-black ${dualPage ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                title="Doble página">
                                ⊟⊟
                            </button>
                            <button onClick={onOpenSettings} className="p-1.5 hover:bg-white/15 rounded-xl transition hidden sm:block" title={t.settings}>
                                <Icons.Settings />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CANVAS + TEXT LAYER ── */}
            <div ref={containerRef} className="flex-1 overflow-auto flex items-start justify-center p-4"
                style={{ backgroundColor: bgColor }}
                onWheel={handleWheel}
                onClick={handlePageClick}>

                {isLoading ? (
                    <div className="flex items-center justify-center h-full w-full"><div className="loader" /></div>
                ) : dualPage ? (
                    <div ref={pageWrapRef} className="flex gap-3 items-start">
                        <div ref={pageWrap1Ref} style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                            <canvas ref={canvasRef} className="shadow-2xl" style={{ maxWidth: '100%', display: 'block', borderRadius: '2px', filter: canvasFilter }} />
                            <HighlightLayer pageNum={currentPage} bookmarks={bookData.bookmarks} />
                            <TtsHighlightLayer rect={ttsHighlightRect?.pageNum === currentPage ? ttsHighlightRect : null} />
                            <div ref={textLayerRef} className="pdf-text-layer"
                                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'auto', overflow: 'hidden', opacity: 1, lineHeight: 1 }}
                                onMouseUp={(e) => handleTextMouseUp(e, currentPage, pageWrap1Ref.current)} />
                        </div>
                        {currentPage + 1 <= totalPages && (
                            <div ref={pageWrap2Ref} style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                                <canvas ref={canvasRef2} className="shadow-2xl" style={{ maxWidth: '100%', display: 'block', borderRadius: '2px', filter: canvasFilter }} />
                                <HighlightLayer pageNum={currentPage + 1} bookmarks={bookData.bookmarks} />
                                <TtsHighlightLayer rect={ttsHighlightRect?.pageNum === currentPage + 1 ? ttsHighlightRect : null} />
                                <div ref={textLayerRef2} className="pdf-text-layer"
                                    style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'auto', overflow: 'hidden', opacity: 1, lineHeight: 1 }}
                                    onMouseUp={(e) => handleTextMouseUp(e, currentPage + 1, pageWrap2Ref.current)} />
                            </div>
                        )}
                    </div>
                ) : (
                    <div ref={pageWrapRef} style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                        <canvas ref={canvasRef} className="shadow-2xl" style={{ maxWidth: '100%', display: 'block', borderRadius: '2px', filter: canvasFilter }} />
                        <HighlightLayer pageNum={currentPage} bookmarks={bookData.bookmarks} />
                        <TtsHighlightLayer rect={ttsHighlightRect?.pageNum === currentPage ? ttsHighlightRect : null} />
                        <div ref={textLayerRef} className="pdf-text-layer"
                            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'auto', overflow: 'hidden', opacity: 1, lineHeight: 1 }}
                            onMouseUp={(e) => handleTextMouseUp(e, currentPage, pageWrapRef.current)} />
                    </div>
                )}

                {!isLoading && (
                    <>
                        <div onClick={e => { e.stopPropagation(); prevPage(); }} className="reader-nav-zone" style={{ left: 0 }}>
                            <div className="reader-nav-btn"><Icons.ChevronLeft /></div>
                        </div>
                        <div onClick={e => { e.stopPropagation(); nextPage(); }} className="reader-nav-zone" style={{ right: 0 }}>
                            <div className="reader-nav-btn"><Icons.ChevronRight /></div>
                        </div>
                    </>
                )}
            </div>

            {/* ── SEARCH PANEL ── */}
            {showNoteModal && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-sm fade-in" onClick={() => setShowNoteModal(false)}>
                    <div className="bg-[var(--surface-bg)] rounded-2xl p-6 w-80 shadow-2xl border border-[var(--border-color)]" onClick={e => e.stopPropagation()}>
                        <h3 className="font-black text-base mb-1">Añadir nota de página</h3>
                        <p className="text-xs opacity-50 mb-4">La nota quedará ligada a la página actual.</p>
                        <textarea
                            value={pendingNote}
                            onChange={e => setPendingNote(e.target.value)}
                            placeholder={`Escribe tu nota para la página ${currentPage}...`}
                            className="w-full min-h-[120px] resize-none bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3 text-sm font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition mb-4"
                            style={{ color: 'var(--text-color)' }}
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setShowNoteModal(false)} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-black/5 dark:bg-white/5 hover:opacity-80 transition">
                                Cancelar
                            </button>
                            <button onClick={savePageNote} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition" style={{ backgroundColor: 'var(--highlight)' }}>
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showOutline && outline.length > 0 && (
                <div className="absolute left-0 bottom-7 w-72 z-50 flex flex-col shadow-2xl border-r fade-in"
                    style={{ top: tabs ? '88px' : '64px', backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                    onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                        <span className="font-black text-sm" style={{ color: 'var(--text-color)' }}>Índice</span>
                        <button onClick={() => setShowOutline(false)} aria-label="Cerrar índice" className="p-1 opacity-50 hover:opacity-100 transition"><Icons.Close /></button>
                    </div>
                    <div className="px-3 pt-2.5 pb-1 flex-shrink-0">
                        <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 rounded-lg px-2 py-1.5">
                            <Icons.Search className="w-3 h-3 opacity-40 flex-shrink-0" />
                            <input type="text" value={outlineSearch} onChange={e => setOutlineSearch(e.target.value)}
                                placeholder="Buscar en indice..." className="bg-transparent outline-none text-xs flex-1 min-w-0" style={{ color: 'var(--text-color)' }} />
                            {outlineSearch && <button onClick={() => setOutlineSearch('')} aria-label="Limpiar búsqueda en índice" className="opacity-40 hover:opacity-100 text-xs leading-none">×</button>}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: '460px', overscrollBehavior: 'contain' }}>
                        {outline
                            .filter(it => !outlineSearch.trim() || it.title?.toLowerCase().includes(outlineSearch.trim().toLowerCase()) || String(it.page || '').includes(outlineSearch.trim()))
                            .map((it, i) => (
                            <button key={`${it.title}-${i}`} onClick={() => { if (it.page) { pushHistory(); goTo(it.page); setShowOutline(false); setOutlineSearch(''); } }}
                                disabled={!it.page}
                                className={`w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-40 flex items-center gap-2 ${it.page === currentPage ? 'bg-[var(--highlight)]/15 font-black' : ''}`}
                                style={{ paddingLeft: `${8 + it.depth * 14}px`, color: 'var(--text-color)' }}>
                                <span className="flex-1 truncate opacity-80">{it.title}</span>
                                {it.page && <span className="text-[10px] font-black opacity-40 flex-shrink-0">{it.page}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {showSearch && (
                <div className="absolute right-0 bottom-7 w-80 z-50 flex flex-col shadow-2xl border-l fade-in"
                    style={{ top: tabs ? '88px' : '64px', backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                    onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="flex-1 flex items-center gap-2 bg-black/5 dark:bg-white/5 rounded-xl px-3 py-2">
                            <Icons.Search />
                            <input ref={searchInputRef} type="text" placeholder="Buscar en el PDF..." value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key !== 'Enter') return;
                                    if (searchResults.length > 0) moveSearchResult(e.shiftKey ? -1 : 1);
                                    else runSearch(searchQuery);
                                }}
                                className="flex-1 bg-transparent outline-none text-sm font-medium"
                                style={{ color: 'var(--text-color)' }} />
                        </div>
                        <button onClick={() => runSearch(searchQuery)}
                            className="px-3 py-2 rounded-xl text-white text-xs font-black"
                            style={{ backgroundColor: 'var(--highlight)' }}>Ir</button>
                        {searchResults.length > 0 && (
                            <div className="flex items-center gap-1">
                                <button onClick={() => moveSearchResult(-1)} aria-label="Resultado anterior" className="px-2 py-2 rounded-xl text-xs font-black bg-black/5 dark:bg-white/5 hover:opacity-80">↑</button>
                                <button onClick={() => moveSearchResult(1)} aria-label="Resultado siguiente" className="px-2 py-2 rounded-xl text-xs font-black bg-black/5 dark:bg-white/5 hover:opacity-80">↓</button>
                            </div>
                        )}
                        <button onClick={() => { setShowSearch(false); setSearchResults([]); setSearchQuery(''); setSearchActiveIndex(-1); }}
                            aria-label="Cerrar búsqueda" className="p-2 opacity-50 hover:opacity-100"><Icons.Close /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto" style={{ maxHeight: '400px' }}>
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
                            <p className="p-6 text-sm opacity-40 text-center">Escribe algo y presiona Enter</p>
                        )}
                        {!isSearching && searchResults.length > 0 && (
                            <div className="p-2">
                                <p className="text-[10px] font-black uppercase opacity-40 tracking-widest px-3 py-2">
                                    {searchActiveIndex >= 0 ? `${searchActiveIndex + 1} / ` : ''}{searchResults.length}{searchResults.length >= 80 ? '+' : ''} resultados
                                </p>
                                {searchResults.map((r, i) => (
                                    <button key={i} onClick={() => jumpToSearchIndex(i)}
                                        className={`w-full text-left px-3 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition mb-1 ${searchActiveIndex === i ? 'ring-1 ring-[var(--highlight)]' : ''}`}>
                                        <span className="text-[10px] font-black opacity-40 block mb-1">Pág. {r.page}</span>
                                        <ReaderSearchExcerpt
                                            text={r.excerpt}
                                            query={searchQuery}
                                            className="text-xs leading-relaxed font-medium opacity-80 line-clamp-2"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── HIGHLIGHT COLOR PICKER ── */}
            {highlightPopup && (
                <div className="fixed z-[600] flex items-center gap-1 p-1.5 rounded-2xl shadow-2xl border"
                    style={{
                        left: highlightPopup.x, top: highlightPopup.y + 10,
                        transform: 'translateX(-50%)',
                        backgroundColor: 'var(--surface-bg)',
                        borderColor: 'var(--border-color)',
                    }}
                    onMouseDown={e => e.preventDefault()}
                    onClick={e => e.stopPropagation()}>
                    {Object.entries(HIGHLIGHT_COLORS).map(([color, bg]) => (
                        <button key={color} onClick={() => saveHighlight(color)} title={highlightLabels[color]}
                            className="w-6 h-6 rounded-full transition hover:scale-125 active:scale-110 flex-shrink-0"
                            style={{ background: bg, border: '2px solid rgba(0,0,0,0.15)' }} />
                    ))}
                    <div className="w-px h-5 mx-0.5" style={{ backgroundColor: 'var(--border-color)' }} />
                    <button onClick={() => { setQuoteModal({ text: highlightPopup.text }); setHighlightPopup(null); }}
                        title="Imagen de cita"
                        className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-black text-white transition hover:opacity-80 flex-shrink-0"
                        style={{ backgroundColor: 'var(--highlight)' }}>
                        <Icons.Quote /> Cita
                    </button>
                    <button onClick={() => { window.getSelection()?.removeAllRanges(); setHighlightPopup(null); }}
                        aria-label="Cerrar selector de resaltado" className="p-1 opacity-40 hover:opacity-100 transition"><Icons.Close /></button>
                </div>
            )}

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

            {/* ── ANNOTATIONS PANEL ── */}
            {showAnnotationsPanel && (
                <div className="absolute right-0 bottom-7 w-80 z-50 flex flex-col shadow-2xl border-l fade-in"
                    style={{ top: tabs ? '88px' : '64px', backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                    onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
                        style={{ borderColor: 'var(--border-color)' }}>
                        <span className="font-black text-sm" style={{ color: 'var(--text-color)' }}>Anotaciones</span>
                        <div className="flex items-center gap-1">
                            {(bookData.bookmarks || []).length > 0 && (
                                <button onClick={exportPdfAnnotations} className="px-2 py-1 rounded-lg text-[10px] font-black hover:bg-black/5 dark:hover:bg-white/5 transition opacity-50 hover:opacity-100" title="Exportar como Markdown">↓ MD</button>
                            )}
                            <button onClick={() => setShowAnnotationsPanel(false)} aria-label="Cerrar anotaciones" className="p-1 opacity-50 hover:opacity-100 transition"><Icons.Close /></button>
                        </div>
                    </div>
                    {pdfAnnotationStats.total > 0 && (
                        <div className="px-3 pt-2.5 pb-1 flex-shrink-0 space-y-2">
                            <div className="grid grid-cols-4 gap-1">
                                {[
                                    ['all', 'Todo', pdfAnnotationStats.total],
                                    ['highlight', 'Subr.', pdfAnnotationStats.highlight],
                                    ['note', 'Notas', pdfAnnotationStats.note],
                                    ['bookmark', 'Marks', pdfAnnotationStats.bookmark],
                                ].map(([id, label, count]) => (
                                    <button key={id} onClick={() => setAnnotationKindFilter(id)}
                                        className={`rounded-lg px-2 py-1 text-[10px] font-black transition ${annotationKindFilter === id ? 'bg-[var(--highlight)] text-white' : 'bg-black/5 dark:bg-white/5 opacity-70 hover:opacity-100'}`}>
                                        {label} {count || 0}
                                    </button>
                                ))}
                            </div>
                            {pdfAnnotationStats.highlight > 0 && (
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setAnnotationColorFilter('all')}
                                        className={`rounded-lg px-2 py-1 text-[10px] font-black transition ${annotationColorFilter === 'all' ? 'bg-[var(--highlight)] text-white' : 'bg-black/5 dark:bg-white/5 opacity-70 hover:opacity-100'}`}>
                                        Colores
                                    </button>
                                    {Object.entries(HIGHLIGHT_COLORS).map(([id, bg]) => (
                                        <button key={id} onClick={() => setAnnotationColorFilter(id)}
                                            title={`${highlightLabels[id]} (${pdfAnnotationStats.colors[id] || 0})`}
                                            className={`h-6 min-w-6 rounded-lg border px-1 text-[9px] font-black transition ${annotationColorFilter === id ? 'scale-105 border-white' : 'border-transparent opacity-80 hover:opacity-100'}`}
                                            style={{ background: bg }}>
                                            {pdfAnnotationStats.colors[id] || 0}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 rounded-lg px-2 py-1.5">
                                <Icons.Search className="w-3 h-3 opacity-40 flex-shrink-0" />
                                <input type="text" value={annotationSearch} onChange={e => setAnnotationSearch(e.target.value)}
                                    placeholder="Buscar en anotaciones..." className="bg-transparent outline-none text-xs flex-1 min-w-0" style={{ color: 'var(--text-color)' }} />
                                {annotationSearch && <button onClick={() => setAnnotationSearch('')} aria-label="Limpiar búsqueda de anotaciones" className="opacity-40 hover:opacity-100 text-xs leading-none">×</button>}
                            </div>
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: '420px', overscrollBehavior: 'contain' }}>
                        {(() => {
                            const items = filteredPdfAnnotations;
                            if (!items.length) return (
                                <p className="p-6 text-sm opacity-40 text-center font-medium">{annotationSearch.trim() ? `Sin resultados para "${annotationSearch}".` : 'Sin anotaciones todavia.'}</p>
                            );
                            return items.map((b, i) => (
                                <div key={i} className="rounded-xl px-3 py-2.5 mb-1 group hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                                    onClick={() => { pushHistory(); goTo(b._page); }}>
                                    <div className="flex items-start gap-2">
                                        {b._kind === 'highlight' && (
                                            <span className="mt-0.5 w-3 h-3 rounded-sm flex-shrink-0"
                                                style={{ background: HIGHLIGHT_COLORS[b._data.color] || HIGHLIGHT_COLORS.yellow }} />
                                        )}
                                        {b._kind === 'note' && <span className="text-sm flex-shrink-0">N</span>}
                                        {b._kind === 'bookmark' && <span className="text-sm flex-shrink-0">B</span>}
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-black opacity-40 block mb-0.5">Pág. {b._page}</span>
                                            <p className="text-xs font-medium opacity-80 line-clamp-2">
                                                {b._kind === 'highlight' ? b._data.text : (b.note || `Página ${b._page}`)}
                                            </p>
                                        </div>
                                        {b._kind === 'highlight' && (
                                            <button onClick={(e) => { e.stopPropagation(); deleteHighlight(b._data.id); }}
                                                aria-label="Eliminar resaltado"
                                                className="opacity-0 group-hover:opacity-40 hover:!opacity-100 p-1 transition flex-shrink-0">
                                                <Icons.Close />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            )}

            {/* ── BARRA DE PROGRESO ── */}
            <div className="flex-shrink-0 relative"
                style={{ height: '28px', backgroundColor: 'var(--surface-bg)', borderTop: '1px solid var(--border-color)' }}>
                <div className="h-1.5 absolute top-0 left-0 right-0" style={{ backgroundColor: 'var(--border-color)' }}>
                    <div className="h-full transition-all duration-700 ease-out"
                        style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--progress-bg), var(--highlight))' }} />
                </div>
                <div className="absolute inset-0 flex items-end justify-between px-4 pb-1">
                    <div className="flex items-center gap-2 min-w-0 max-w-[55%]">
                        {historyCount > 0 && (
                            <button onClick={goBackHistory}
                                className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-black transition hover:bg-black/10 dark:hover:bg-white/10 flex-shrink-0"
                                style={{ color: 'var(--highlight)' }}
                                title={`Volver a la posición anterior (Alt+←) · ${historyCount} en historial`}>
                                <Icons.HistoryBack className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Volver</span>
                            </button>
                        )}
                        <span className="text-[10px] font-black opacity-40 uppercase tracking-widest truncate">{bookData.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {estimatedRemainingText && (
                            <span className="text-[10px] font-bold opacity-50">{estimatedRemainingText}</span>
                        )}
                        <span className="text-[10px] font-bold opacity-50">Pág. {currentPage} / {totalPages}</span>
                        <span className="text-[11px] font-black" style={{ color: 'var(--highlight)' }}>{pct}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PdfReader;
