import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Icons } from './icons';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const HIGHLIGHT_COLORS = {
    yellow: 'rgba(250,204,21,0.5)',
    green:  'rgba(74,222,128,0.5)',
    blue:   'rgba(96,165,250,0.5)',
    pink:   'rgba(251,113,133,0.5)',
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
    bookData, theme, t, lang = 'es', isFullscreen, focusMode,
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

    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
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

    // Search
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchInputRef = useRef(null);

    // Highlights & annotations
    const [highlightPopup, setHighlightPopup] = useState(null); // { x, y, text, rects, pageNum }
    const [showAnnotationsPanel, setShowAnnotationsPanel] = useState(false);
    const [annotationSearch, setAnnotationSearch] = useState('');

    // v3.4 — dark mode (invierte el canvas) + outline/TOC
    const [pdfDark, setPdfDark] = useState(false);
    const [outline, setOutline] = useState([]);
    const [showOutline, setShowOutline] = useState(false);
    const canvasFilter = pdfDark ? 'invert(1) hue-rotate(180deg)' : 'none';

    // Exporta las anotaciones del PDF como Markdown (ordenadas por página).
    const exportPdfAnnotations = () => {
        const items = (bookData.bookmarks || []).map(b => {
            if (b.kind === 'highlight') { try { const d = JSON.parse(b.note); return { page: d.pageNum, kind: 'Subrayado', text: d.text }; } catch { return null; } }
            return { page: parseInt(b.cfi) || 0, kind: b.kind === 'note' ? 'Nota' : 'Marcador', text: b.note || '' };
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
    }, [bookData.id, bookData.pdfScale]);

    useEffect(() => {
        if (!onPersistPdfZoom) return;
        const timer = setTimeout(() => onPersistPdfZoom(bookData.id, scale), 250);
        return () => clearTimeout(timer);
    }, [bookData.id, onPersistPdfZoom, scale]);


    // Load PDF
    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);
        setPdfError(null);
        const load = async () => {
            try {
                let data = bookData.file;
                if (data instanceof Blob) data = await data.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data }).promise;
                if (!isMounted) return;
                pdfRef.current = pdf;
                setTotalPages(pdf.numPages);
                const savedPage = bookData.lastLocation ? parseInt(bookData.lastLocation) || 1 : 1;
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
        return () => { isMounted = false; };
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
            const pct = Math.round((currentPage / totalPages) * 100);
            updateLocationAndProgress(bookData.id, String(currentPage), pct);
            onStatsUpdate && onStatsUpdate(1);
            setInputPage(String(currentPage));
        };
        doRender();
        return () => { isMounted = false; };
    }, [pdfRef.current, currentPage, scale, totalPages, isLoading, dualPage]);

    const goTo = useCallback((n) => {
        if (!totalPages) return;
        setCurrentPage(Math.min(Math.max(1, n), totalPages));
    }, [totalPages]);

    const prevPage = useCallback(() => goTo(currentPage - (dualPage ? 2 : 1)), [currentPage, dualPage, goTo]);
    const nextPage = useCallback(() => goTo(currentPage + (dualPage ? 2 : 1)), [currentPage, dualPage, goTo]);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); setScale(s => Math.min(4, parseFloat((s + 0.2).toFixed(1)))); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setScale(s => Math.max(0.7, parseFloat((s - 0.2).toFixed(1)))); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setScale(1.2); return; }
            if (document.activeElement?.tagName === 'INPUT') return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevPage();
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextPage();
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowSearch(p => !p); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [prevPage, nextPage]);

    const wheelTimeout = useRef(null);
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
    const runSearch = async (query) => {
        if (!pdfRef.current || !query.trim()) { setSearchResults([]); return; }
        setIsSearching(true);
        const results = [];
        try {
            for (let p = 1; p <= pdfRef.current.numPages; p++) {
                const page = await pdfRef.current.getPage(p);
                const tc = await page.getTextContent();
                const pageText = tc.items.map(i => i.str).join(' ');
                const q = query.toLowerCase();
                const idx = pageText.toLowerCase().indexOf(q);
                if (idx !== -1) {
                    const start = Math.max(0, idx - 60);
                    const excerpt = pageText.slice(start, idx + query.length + 60);
                    results.push({ page: p, excerpt });
                }
                if (results.length >= 40) break;
            }
        } catch (err) {
            console.warn('[SharkReader] PDF search failed:', err);
        }
        setSearchResults(results);
        setIsSearching(false);
    };

    useEffect(() => {
        if (showSearch && searchInputRef.current) searchInputRef.current.focus();
    }, [showSearch]);


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
        setTimeout(() => {
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
                            <button onClick={onGoToLibrary} className="px-3 h-full hover:bg-white/10 transition flex-shrink-0 flex items-center opacity-70 hover:opacity-100">
                                <Icons.Library />
                            </button>
                            <div className="w-px bg-white/10 flex-shrink-0 self-stretch my-1"></div>
                            {tabs.map(tab => {
                                const book = allBooks?.find(b => b.id === tab.bookId);
                                const isActive = tab.id === activeTabId;
                                return (
                                    <div key={tab.id}
                                        className={`flex items-center gap-1.5 px-3 flex-shrink-0 max-w-[180px] min-w-[80px] cursor-pointer group border-r border-white/10 relative transition-all ${isActive ? 'bg-white/15' : 'hover:bg-white/10 opacity-70 hover:opacity-100'}`}
                                        onClick={() => onSwitchTab?.(tab.id)}>
                                        {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t" />}
                                        <span className="text-white text-[11px] font-semibold truncate flex-1 leading-none">{book?.name || '…'}</span>
                                        <button onClick={(e) => onCloseTab?.(tab.id, e)}
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
                            <button onClick={onClose} className="p-2 hover:bg-black/20 rounded-full transition flex-shrink-0"><Icons.Back /></button>
                            <button onClick={onOpenBookInfo} className="flex items-center gap-1 hover:bg-black/10 px-2 py-1 rounded-xl transition min-w-0">
                                <span className="font-bold text-sm truncate max-w-[140px] sm:max-w-xs">{bookData.name}</span>
                                <Icons.Info />
                            </button>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Zoom */}
                            <div className="flex items-center bg-black/20 rounded-xl overflow-hidden">
                                <button onClick={() => setScale(s => Math.max(0.7, parseFloat((s - 0.2).toFixed(1))))}
                                    className="px-2 py-1.5 hover:bg-white/20 transition font-bold text-base leading-none">−</button>
                                <span className="px-2 text-xs font-black min-w-[44px] text-center">{Math.round(scale * 100)}%</span>
                                <button onClick={() => setScale(s => Math.min(4, parseFloat((s + 0.2).toFixed(1))))}
                                    className="px-2 py-1.5 hover:bg-white/20 transition font-bold text-base leading-none">+</button>
                            </div>
                            <div className="w-px h-5 bg-white/20 mx-0.5"></div>
                            <button onClick={prevPage} disabled={currentPage <= 1}
                                className="p-1.5 hover:bg-white/15 rounded-xl transition disabled:opacity-30"><Icons.ChevronLeft /></button>
                            <div className="flex items-center gap-1 bg-black/20 rounded-xl px-2 py-1">
                                <input type="text" value={inputPage}
                                    onChange={e => setInputPage(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { const n = parseInt(inputPage); if (!isNaN(n)) goTo(n); } }}
                                    onBlur={() => { const n = parseInt(inputPage); if (!isNaN(n)) goTo(n); else setInputPage(String(currentPage)); }}
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
                            {/* Dark mode (invertir) */}
                            <button onClick={() => setPdfDark(p => !p)}
                                className={`p-1.5 rounded-xl transition text-sm leading-none ${pdfDark ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                title={pdfDark ? 'Modo claro' : 'Modo oscuro (invertir)'}>
                                {pdfDark ? '☀' : '🌙'}
                            </button>
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
                onClick={() => isFullscreen && setShowToolbar(p => !p)}>

                {isLoading ? (
                    <div className="flex items-center justify-center h-full w-full"><div className="loader" /></div>
                ) : dualPage ? (
                    <div ref={pageWrapRef} className="flex gap-3 items-start">
                        <div ref={pageWrap1Ref} style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                            <canvas ref={canvasRef} className="shadow-2xl" style={{ maxWidth: '100%', display: 'block', borderRadius: '2px', filter: canvasFilter }} />
                            <HighlightLayer pageNum={currentPage} bookmarks={bookData.bookmarks} />
                            <div ref={textLayerRef} className="pdf-text-layer"
                                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'auto', overflow: 'hidden', opacity: 1, lineHeight: 1 }}
                                onMouseUp={(e) => handleTextMouseUp(e, currentPage, pageWrap1Ref.current)} />
                        </div>
                        {currentPage + 1 <= totalPages && (
                            <div ref={pageWrap2Ref} style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                                <canvas ref={canvasRef2} className="shadow-2xl" style={{ maxWidth: '100%', display: 'block', borderRadius: '2px', filter: canvasFilter }} />
                                <HighlightLayer pageNum={currentPage + 1} bookmarks={bookData.bookmarks} />
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
                        <button onClick={() => setShowOutline(false)} className="p-1 opacity-50 hover:opacity-100 transition"><Icons.Close /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: '460px', overscrollBehavior: 'contain' }}>
                        {outline.map((it, i) => (
                            <button key={i} onClick={() => { if (it.page) { goTo(it.page); setShowOutline(false); } }}
                                disabled={!it.page}
                                className="w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-40 flex items-center gap-2"
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
                                onKeyDown={e => e.key === 'Enter' && runSearch(searchQuery)}
                                className="flex-1 bg-transparent outline-none text-sm font-medium"
                                style={{ color: 'var(--text-color)' }} />
                        </div>
                        <button onClick={() => runSearch(searchQuery)}
                            className="px-3 py-2 rounded-xl text-white text-xs font-black"
                            style={{ backgroundColor: 'var(--highlight)' }}>Ir</button>
                        <button onClick={() => { setShowSearch(false); setSearchResults([]); setSearchQuery(''); }}
                            className="p-2 opacity-50 hover:opacity-100"><Icons.Close /></button>
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
                                    {searchResults.length}{searchResults.length >= 40 ? '+' : ''} resultados
                                </p>
                                {searchResults.map((r, i) => (
                                    <button key={i} onClick={() => { goTo(r.page); setShowSearch(false); }}
                                        className="w-full text-left px-3 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition mb-1">
                                        <span className="text-[10px] font-black opacity-40 block mb-1">Pág. {r.page}</span>
                                        <p className="text-xs leading-relaxed font-medium opacity-80 line-clamp-2"
                                            dangerouslySetInnerHTML={{
                                                __html: r.excerpt.replace(
                                                    new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                                                    m => `<mark style="background:rgba(250,204,21,0.65);border-radius:3px;padding:0 2px">${m}</mark>`
                                                )
                                            }} />
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
                        <button key={color} onClick={() => saveHighlight(color)}
                            className="w-6 h-6 rounded-full transition hover:scale-125 active:scale-110 flex-shrink-0"
                            style={{ background: bg, border: '2px solid rgba(0,0,0,0.15)' }} />
                    ))}
                    <div className="w-px h-5 mx-0.5" style={{ backgroundColor: 'var(--border-color)' }} />
                    <button onClick={() => { window.getSelection()?.removeAllRanges(); setHighlightPopup(null); }}
                        className="p-1 opacity-40 hover:opacity-100 transition"><Icons.Close /></button>
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
                            <button onClick={() => setShowAnnotationsPanel(false)} className="p-1 opacity-50 hover:opacity-100 transition"><Icons.Close /></button>
                        </div>
                    </div>
                    {(bookData.bookmarks || []).length > 0 && (
                        <div className="px-3 pt-2.5 pb-1 flex-shrink-0">
                            <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 rounded-lg px-2 py-1.5">
                                <Icons.Search className="w-3 h-3 opacity-40 flex-shrink-0" />
                                <input type="text" value={annotationSearch} onChange={e => setAnnotationSearch(e.target.value)}
                                    placeholder="Buscar en anotaciones..." className="bg-transparent outline-none text-xs flex-1 min-w-0" style={{ color: 'var(--text-color)' }} />
                                {annotationSearch && <button onClick={() => setAnnotationSearch('')} className="opacity-40 hover:opacity-100 text-xs leading-none">×</button>}
                            </div>
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: '420px', overscrollBehavior: 'contain' }}>
                        {(() => {
                            const q = annotationSearch.trim().toLowerCase();
                            const items = (bookData.bookmarks || [])
                                .map(b => {
                                    if (b.kind === 'highlight') {
                                        try { const d = JSON.parse(b.note); return { ...b, _page: d.pageNum, _data: d }; } catch { return null; }
                                    }
                                    return { ...b, _page: parseInt(b.cfi) || 0 };
                                })
                                .filter(Boolean)
                                .filter(b => !q || (b.kind === 'highlight' ? (b._data.text || '') : (b.note || '')).toLowerCase().includes(q))
                                .sort((a, z) => a._page - z._page);
                            if (!items.length) return (
                                <p className="p-6 text-sm opacity-40 text-center font-medium">{q ? `Sin resultados para “${annotationSearch}”.` : 'Sin anotaciones todavía.'}</p>
                            );
                            return items.map((b, i) => (
                                <div key={i} className="rounded-xl px-3 py-2.5 mb-1 group hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                                    onClick={() => goTo(b._page)}>
                                    <div className="flex items-start gap-2">
                                        {b.kind === 'highlight' && (
                                            <span className="mt-0.5 w-3 h-3 rounded-sm flex-shrink-0"
                                                style={{ background: HIGHLIGHT_COLORS[b._data.color] || HIGHLIGHT_COLORS.yellow }} />
                                        )}
                                        {b.kind === 'note' && <span className="text-sm flex-shrink-0">📝</span>}
                                        {!b.kind && <span className="text-sm flex-shrink-0">🔖</span>}
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-black opacity-40 block mb-0.5">Pág. {b._page}</span>
                                            <p className="text-xs font-medium opacity-80 line-clamp-2">
                                                {b.kind === 'highlight' ? b._data.text : (b.note || `Página ${b._page}`)}
                                            </p>
                                        </div>
                                        {b.kind === 'highlight' && (
                                            <button onClick={(e) => { e.stopPropagation(); deleteHighlight(b._data.id); }}
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
                    <span className="text-[10px] font-black opacity-40 uppercase tracking-widest truncate max-w-[50%]">{bookData.name}</span>
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
