import React from 'react';
import { Icons } from './icons';
import BookCard from './BookCard';
import QuickEditCard from './QuickEditCard';

const LibraryView = React.forwardRef(({
    searchTerm,
    searchResultsWithMatches,
    displayedBooks,
    books,
    currentFilter,
    setCurrentFilter,
    setSearchTerm,
    openBook,
    handleContextMenu,
    openBookIds,
    openFilePicker,
    openFolderPicker,
    libraryView,
    virtualLibrary,
    addons,
    isSelecting,
    selectedBookIds,
    toggleSelectBook,
    selectAll,
    clearSelection,
    quickEditBookId,
    setQuickEditBookId,
    saveQuickEdit,
    draggedBookId,
    setDraggedBookId,
    dropTargetCat,
    setDropTargetCat,
    bulkToggleFav,
    bulkMarkFinished,
    bulkAssignCategory,
    bulkAssignAuthor,
    bulkAssignSeries,
    bulkDeleteBooks,
    bulkAddToCollection,
    customCategories,
    manualCollections,
}, ref) => {
    const visibleSearchResults = virtualLibrary.enabled
        ? searchResultsWithMatches?.slice(virtualLibrary.startIndex, virtualLibrary.endIndex)
        : searchResultsWithMatches;

    return (
        <div ref={ref} className="flex-1 library-container w-full relative overflow-y-auto">

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
                        <div
                            className="flex flex-col gap-2"
                            style={virtualLibrary.enabled ? { height: virtualLibrary.totalHeight, position: 'relative' } : undefined}>
                            <div
                                className="flex flex-col gap-2"
                                style={virtualLibrary.enabled ? { transform: `translateY(${virtualLibrary.top}px)` } : undefined}>
                            {(visibleSearchResults || []).map(book => (
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
                        </div>
                    )}
                </div>
            )}

            {/* Vista de cuadrícula normal */}
            {!searchTerm && (
                <>
                    {displayedBooks.length === 0 && (() => {
                        const isSearch = !!searchTerm.trim();
                        const isFiltered = currentFilter !== 'all';
                        const isEmptyLibrary = books.filter(b => !b.loading).length === 0;

                        const configs = {
                            search: { emoji: '🔍', title: `Sin resultados para "${searchTerm}"`, sub: 'Prueba con el título, autor, serie o un tag del libro.', accent: '#38bdf8', sharkyMood: 'sad' },
                            favorites: { emoji: '❤️', title: 'Aún no tienes favoritos', sub: 'Pulsa el corazón de cualquier libro para guardarlo aquí.', accent: '#f43f5e', sharkyMood: 'sad' },
                            finished: { emoji: '🏁', title: 'Todavía no has terminado ningún libro', sub: '¡Sigue leyendo! Cuando termines uno aparecerá aquí.', accent: '#22c55e', sharkyMood: 'focus' },
                            reading: { emoji: '📖', title: 'No estás leyendo nada ahora', sub: 'Abre un libro y empezará a aparecer aquí automáticamente.', accent: '#a78bfa', sharkyMood: 'curious' },
                            unstarted: { emoji: '📚', title: 'Todos tus libros tienen progreso', sub: '¡Impresionante! No queda ninguno sin empezar.', accent: '#fbbf24', sharkyMood: 'happy' },
                            shelf: { emoji: '⏸', title: 'Esta estantería está vacía', sub: 'Nada en este filtro automático por ahora.', accent: '#fb923c', sharkyMood: 'curious' },
                            recents: { emoji: '🕐', title: 'Sin actividad reciente', sub: 'Los libros abiertos o añadidos recientemente aparecen aquí.', accent: '#38bdf8', sharkyMood: 'sleepy' },
                            filtered: { emoji: '🏷️', title: 'Sin resultados para este filtro', sub: 'Prueba a quitar alguno de los filtros activos.', accent: '#38bdf8', sharkyMood: 'curious' },
                            empty: { emoji: '🦈', title: '¡Bienvenido a SharkReader!', sub: 'Tu biblioteca está vacía. Añade tu primer EPUB o PDF para empezar.', accent: 'var(--highlight)', sharkyMood: 'celebrate' },
                        };

                        let cfg;
                        if (isSearch) cfg = configs.search;
                        else if (isEmptyLibrary) cfg = configs.empty;
                        else if (currentFilter === 'favorites') cfg = configs.favorites;
                        else if (currentFilter === 'finished') cfg = configs.finished;
                        else if (currentFilter === 'reading') cfg = configs.reading;
                        else if (currentFilter === 'unstarted') cfg = configs.unstarted;
                        else if (currentFilter === 'recents') cfg = configs.recents;
                        else if (currentFilter.startsWith('shelf:')) cfg = configs.shelf;
                        else if (isFiltered) cfg = configs.filtered;
                        else cfg = configs.empty;

                        return (
                            <div className="absolute inset-0 flex items-center justify-center p-6 fade-in">
                                <div className="max-w-md w-full flex flex-col items-center text-center px-8 py-10 rounded-[2rem]"
                                    style={{ background: 'var(--surface-bg)', border: '1px solid var(--border-color)', boxShadow: `0 0 60px ${cfg.accent}0a` }}>
                                    <div className="relative mb-5">
                                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                                            style={{ background: `${cfg.accent}15`, border: `1px solid ${cfg.accent}25` }}>
                                            <span className="text-4xl leading-none">{cfg.emoji}</span>
                                        </div>
                                    </div>
                                    <h2 className="text-xl font-black mb-2 leading-tight">{cfg.title}</h2>
                                    <p className="text-sm opacity-55 leading-relaxed mb-6 max-w-xs">{cfg.sub}</p>
                                    {(isEmptyLibrary || currentFilter === 'all') && !isSearch && (
                                        <div className="flex flex-col sm:flex-row gap-2.5 w-full justify-center">
                                            <button onClick={openFilePicker}
                                                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm text-white transition active:scale-[0.97]"
                                                style={{ background: `linear-gradient(135deg, var(--highlight), var(--topbar-bg))` }}>
                                                <Icons.Plus /> Añadir libro
                                            </button>
                                            <button onClick={openFolderPicker}
                                                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition active:scale-[0.97]"
                                                style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                                                <Icons.FolderPlus /> Añadir carpeta
                                            </button>
                                        </div>
                                    )}
                                    {isSearch && (
                                        <button onClick={() => setSearchTerm('')}
                                            className="px-6 py-2.5 rounded-2xl font-bold text-sm transition"
                                            style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                                            × Limpiar búsqueda
                                        </button>
                                    )}
                                    {isFiltered && !isSearch && !isEmptyLibrary && (
                                        <button onClick={() => setCurrentFilter('all')}
                                            className="px-6 py-2.5 rounded-2xl font-bold text-sm transition"
                                            style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                                            Ver todos los libros
                                        </button>
                                    )}
                                    {isEmptyLibrary && (
                                        <p className="mt-4 text-[10px] opacity-35 max-w-[240px] leading-relaxed">
                                            Arrastra archivos .epub o .pdf directamente a esta ventana
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
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
                        <button onClick={() => {
                            const author = window.prompt(`Autor para ${selectedBookIds.size} libro(s):`);
                            if (author) bulkAssignAuthor(author);
                        }} disabled={!selectedBookIds.size}
                            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-400 hover:bg-sky-500/25 transition disabled:opacity-40">
                            👤 Autor
                        </button>
                        <button onClick={() => {
                            const series = window.prompt(`Nombre de la serie para ${selectedBookIds.size} libro(s) (índices automáticos):`);
                            if (series) bulkAssignSeries(series);
                        }} disabled={!selectedBookIds.size}
                            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-400 hover:bg-violet-500/25 transition disabled:opacity-40">
                            📖 Serie
                        </button>
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
    );
});

LibraryView.displayName = 'LibraryView';

export default React.memo(LibraryView);
