import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Icons } from './icons';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const PdfReader = ({
    bookData, theme, t, isFullscreen, focusMode,
    onClose, onOpenSettings, onOpenBookInfo,
    updateLocationAndProgress, toggleBookmark, onStatsUpdate,
    tabs, activeTabId, allBooks, onSwitchTab, onCloseTab, onGoToLibrary
}) => {
    const canvasRef = useRef(null);
    const textLayerRef = useRef(null);
    const canvasRef2 = useRef(null);
    const textLayerRef2 = useRef(null);
    const containerRef = useRef(null);
    const pageWrapRef = useRef(null);
    const pdfRef = useRef(null);
    const renderTaskRef = useRef(null);
    const renderTaskRef2 = useRef(null);

    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.2);
    const [dualPage, setDualPage] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [pdfError, setPdfError] = useState(null);
    const [inputPage, setInputPage] = useState('1');
    const [showToolbar, setShowToolbar] = useState(true);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [focusToolbarVisible, setFocusToolbarVisible] = useState(true);
    const focusHideTimer = useRef(null);

    // Search
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchInputRef = useRef(null);


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
        setIsBookmarked(bookData.bookmarks?.some(b => b.cfi === String(currentPage)) || false);
    }, [currentPage, bookData.bookmarks]);


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
            const viewport = page.getViewport({ scale: Math.max(autoScale, 0.4) });
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
                } catch (_) {}
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
        } catch (_) {}
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

    const pct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
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
                                <button onClick={() => setScale(s => Math.max(0.4, parseFloat((s - 0.2).toFixed(1))))}
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
                            {/* Search */}
                            <button onClick={() => setShowSearch(p => !p)}
                                className={`p-1.5 rounded-xl transition ${showSearch ? 'bg-white/25' : 'hover:bg-white/15'}`}
                                title="Buscar en el PDF (Ctrl+F)">
                                <Icons.Search />
                            </button>
                            <button onClick={handleAddBookmark} className="p-1.5 hover:bg-white/15 rounded-xl transition" title="Marcador">
                                <Icons.Bookmark fill={isBookmarked ? '#facc15' : 'none'} color={isBookmarked ? '#facc15' : 'currentColor'} />
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
                        <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                            <canvas ref={canvasRef} className="shadow-2xl" style={{ maxWidth: '100%', display: 'block', borderRadius: '2px' }} />
                            <div ref={textLayerRef} className="pdf-text-layer"
                                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'auto', overflow: 'hidden', opacity: 1, lineHeight: 1 }} />
                        </div>
                        {currentPage + 1 <= totalPages && (
                            <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                                <canvas ref={canvasRef2} className="shadow-2xl" style={{ maxWidth: '100%', display: 'block', borderRadius: '2px' }} />
                                <div ref={textLayerRef2} className="pdf-text-layer"
                                    style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'auto', overflow: 'hidden', opacity: 1, lineHeight: 1 }} />
                            </div>
                        )}
                    </div>
                ) : (
                    <div ref={pageWrapRef} style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                        <canvas ref={canvasRef} className="shadow-2xl" style={{ maxWidth: '100%', display: 'block', borderRadius: '2px' }} />
                        {/* Text layer for selection */}
                        <div ref={textLayerRef} className="pdf-text-layer"
                            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'auto', overflow: 'hidden', opacity: 1, lineHeight: 1 }} />
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
                                                    m => `<mark style="background:rgba(250,204,21,0.4);border-radius:3px;padding:0 2px">${m}</mark>`
                                                )
                                            }} />
                                    </button>
                                ))}
                            </div>
                        )}
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
                        <span className="text-[10px] font-bold opacity-50">Pág. {currentPage} / {totalPages}</span>
                        <span className="text-[11px] font-black" style={{ color: 'var(--highlight)' }}>{pct}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PdfReader;
