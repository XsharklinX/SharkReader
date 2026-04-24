import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Icons } from './icons';

// Worker apuntando al CDN de la misma versión instalada
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const PdfReader = ({
    bookData, theme, t, isFullscreen,
    onClose, onOpenSettings, onOpenBookInfo,
    updateLocationAndProgress, toggleBookmark, onStatsUpdate,
    tabs, activeTabId, allBooks, onSwitchTab, onCloseTab, onGoToLibrary
}) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const pdfRef = useRef(null);
    const renderTaskRef = useRef(null);

    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.2);
    const [isLoading, setIsLoading] = useState(true);
    const [inputPage, setInputPage] = useState('1');
    const [showToolbar, setShowToolbar] = useState(true);
    const [isBookmarked, setIsBookmarked] = useState(false);

    // Calcular si la página actual tiene marcador
    useEffect(() => {
        setIsBookmarked(bookData.bookmarks?.some(b => b.cfi === String(currentPage)) || false);
    }, [currentPage, bookData.bookmarks]);

    // Cargar PDF
    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);
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
                if (isMounted) setIsLoading(false);
            }
        };
        load();
        return () => { isMounted = false; };
    }, [bookData.file]);

    // Renderizar página actual
    useEffect(() => {
        if (!pdfRef.current || !canvasRef.current || isLoading) return;
        let isMounted = true;

        const render = async () => {
            try {
                if (renderTaskRef.current) {
                    renderTaskRef.current.cancel();
                    renderTaskRef.current = null;
                }
                const page = await pdfRef.current.getPage(currentPage);
                if (!isMounted) return;

                // Escalar al ancho del contenedor si es posible
                const containerW = containerRef.current?.clientWidth || 800;
                const baseVp = page.getViewport({ scale: 1 });
                const autoScale = Math.min(scale, (containerW - 48) / baseVp.width);
                const viewport = page.getViewport({ scale: Math.max(autoScale, 0.5) });

                const canvas = canvasRef.current;
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');

                const task = page.render({ canvasContext: ctx, viewport });
                renderTaskRef.current = task;
                await task.promise;
                if (!isMounted) return;

                const pct = Math.round((currentPage / totalPages) * 100);
                updateLocationAndProgress(bookData.id, String(currentPage), pct);
                onStatsUpdate && onStatsUpdate(1);
                setInputPage(String(currentPage));
            } catch (err) {
                if (err?.name !== 'RenderingCancelledException') console.error('Render error:', err);
            }
        };
        render();
        return () => { isMounted = false; };
    }, [pdfRef.current, currentPage, scale, totalPages, isLoading]);

    const goTo = useCallback((n) => {
        if (!totalPages) return;
        setCurrentPage(Math.min(Math.max(1, n), totalPages));
    }, [totalPages]);

    const prevPage = useCallback(() => goTo(currentPage - 1), [currentPage, goTo]);
    const nextPage = useCallback(() => goTo(currentPage + 1), [currentPage, goTo]);

    // Teclado
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevPage();
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextPage();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [prevPage, nextPage]);

    // Scroll del ratón
    const wheelTimeout = useRef(null);
    const handleWheel = (e) => {
        if (wheelTimeout.current) return;
        wheelTimeout.current = setTimeout(() => { wheelTimeout.current = null; }, 350);
        if (e.deltaY > 0) nextPage(); else prevPage();
    };

    const handleAddBookmark = () => {
        if (isBookmarked) {
            toggleBookmark(bookData.id, String(currentPage), null, true);
        } else {
            toggleBookmark(bookData.id, String(currentPage), `Página ${currentPage}`);
        }
    };

    const pct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
    const bgColor = theme === 'dark' ? '#0f172a' : theme === 'sepia' ? '#f5f0e8' : '#f8fafc';

    return (
        <div className={`w-full h-full flex flex-col relative ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
            style={{ backgroundColor: bgColor }}>

            {/* ── BARRA SUPERIOR ── */}
            {!isFullscreen && (
                <div className="flex-shrink-0 flex flex-col text-white shadow-md z-40"
                    style={{ background: 'linear-gradient(to right, var(--topbar-bg), var(--highlight))' }}>

                    {/* Fila de pestañas */}
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

                            {/* Navegación de páginas */}
                            <button onClick={prevPage} disabled={currentPage <= 1}
                                className="p-1.5 hover:bg-white/15 rounded-xl transition disabled:opacity-30"><Icons.ChevronLeft /></button>
                            <div className="flex items-center gap-1 bg-black/20 rounded-xl px-2 py-1">
                                <input
                                    type="text"
                                    value={inputPage}
                                    onChange={e => setInputPage(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { const n = parseInt(inputPage); if (!isNaN(n)) goTo(n); } }}
                                    onBlur={() => { const n = parseInt(inputPage); if (!isNaN(n)) goTo(n); else setInputPage(String(currentPage)); }}
                                    className="w-10 bg-transparent text-center text-xs font-black outline-none"
                                />
                                <span className="text-xs opacity-60">/ {totalPages}</span>
                            </div>
                            <button onClick={nextPage} disabled={currentPage >= totalPages}
                                className="p-1.5 hover:bg-white/15 rounded-xl transition disabled:opacity-30"><Icons.ChevronRight /></button>

                            <div className="w-px h-5 bg-white/20 mx-0.5"></div>

                            <button onClick={handleAddBookmark} className="p-1.5 hover:bg-white/15 rounded-xl transition" title="Marcador">
                                <Icons.Bookmark fill={isBookmarked ? '#facc15' : 'none'} color={isBookmarked ? '#facc15' : 'currentColor'} />
                            </button>
                            <button onClick={onOpenSettings} className="p-1.5 hover:bg-white/15 rounded-xl transition hidden sm:block" title={t.settings}>
                                <Icons.Settings />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CANVAS ── */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto flex items-start justify-center p-4"
                style={{ backgroundColor: bgColor }}
                onWheel={handleWheel}
                onClick={() => isFullscreen && setShowToolbar(p => !p)}>

                {isLoading ? (
                    <div className="flex items-center justify-center h-full w-full">
                        <div className="loader" />
                    </div>
                ) : (
                    <canvas
                        ref={canvasRef}
                        className="shadow-2xl"
                        style={{ maxWidth: '100%', display: 'block', borderRadius: '2px' }}
                    />
                )}

                {/* Zonas de click laterales para pasar página */}
                {!isLoading && (
                    <>
                        <div onClick={e => { e.stopPropagation(); prevPage(); }}
                            className="reader-nav-zone" style={{ left: 0 }}>
                            <div className="reader-nav-btn"><Icons.ChevronLeft /></div>
                        </div>
                        <div onClick={e => { e.stopPropagation(); nextPage(); }}
                            className="reader-nav-zone" style={{ right: 0 }}>
                            <div className="reader-nav-btn"><Icons.ChevronRight /></div>
                        </div>
                    </>
                )}
            </div>

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
