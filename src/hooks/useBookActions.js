import { useCallback, startTransition } from 'react';
import { updateBookInList } from '../bookModel';
import { deleteBookFromDB } from '../db';

const HIGHLIGHT_COLOR_LABELS = {
    yellow: 'importante',
    green: 'idea',
    blue: 'duda',
    pink: 'cita',
};

const normalizeAnnotationKind = (bookmark = {}) => {
    if (bookmark.kind === 'highlight' || bookmark.note?.includes('[Subrayado]')) return 'highlight';
    if (bookmark.kind === 'note') return 'note';
    return 'bookmark';
};

const normalizeAnnotationText = (bookmark = {}) => {
    if (normalizeAnnotationKind(bookmark) === 'highlight') {
        return String(bookmark.note || '')
            .replace('[Subrayado] ', '')
            .replace(/^"|"$/g, '')
            .replace(/\.\.\.$/, '')
            .trim();
    }
    return String(bookmark.note || '').trim();
};

export function useBookActions({
    books,
    booksById,
    setBooks,
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
}) {
    const handleContextMenu = useCallback((e, book) => {
        e.preventDefault();
        setContextMenu({ x: e.pageX, y: e.pageY, book });
    }, [setContextMenu]);

    const toggleFavorite = useCallback((bookId) => {
        const now = Date.now();
        setBooks(prev => prev.map(b => b.id === bookId ? { ...b, isFav: !b.isFav, metadataUpdatedAt: now, updatedAt: now } : b));
    }, [setBooks]);

    const markFinished = useCallback((bookId) => {
        setBooks(prev => {
            const next = prev.map(b => {
                if (b.id !== bookId) return b;
                const now = Date.now();
                const nowFinished = !b.isFinished;
                if (nowFinished) {
                    sharkyActionsRef.current?.notifyBookFinished(b.name, b.readingMinutes || 0);
                    if (b.series && b.seriesIndex) {
                        const nextBook = prev.find(x => x.series === b.series && x.seriesIndex === b.seriesIndex + 1 && !x.isFinished);
                        if (nextBook) {
                            setTimeout(() => sharkyActionsRef.current?.notifyNextInSeries({ seriesName: b.series, nextBookName: nextBook.name }), 2000);
                        }
                    }
                }
                return {
                    ...b,
                    isFinished: nowFinished,
                    progress: nowFinished ? 100 : b.progress,
                    dateFinished: nowFinished ? now : null,
                    progressUpdatedAt: now,
                    updatedAt: now,
                };
            });
            return next;
        });
    }, [setBooks, sharkyActionsRef]);

    const deleteBook = useCallback((bookId) => {
        if (!window.confirm(t.confirmDelete)) return;
        const book = booksById.get(bookId);
        if (book?.url) URL.revokeObjectURL(book.url);
        const tabToClose = tabs.find(tb => tb.bookId === bookId);
        if (tabToClose) closeTab(tabToClose.id);
        setBooks(prev => prev.filter(b => b.id !== bookId));
        if (lastReadId === bookId) setLastReadId(null);
        progressUpdateThrottleRef.current.delete(bookId);
        deleteBookFromDB(bookId);
    }, [booksById, tabs, lastReadId, t, closeTab, setBooks, setLastReadId, progressUpdateThrottleRef]);

    const updateBookLocation = useCallback((bookId, cfi, percent) => {
        const now = Date.now();
        const previousUpdate = progressUpdateThrottleRef.current.get(bookId) || { ts: 0, percent: null, cfi: null };
        const hasPercent = percent !== null && percent !== undefined;
        const roundedPercent = hasPercent ? Math.round(percent * 10) / 10 : null;
        const percentChanged = roundedPercent !== previousUpdate.percent;
        const cfiChanged = cfi && cfi !== previousUpdate.cfi;
        if (!percentChanged && !cfiChanged && now - previousUpdate.ts < 1200) return;
        progressUpdateThrottleRef.current.set(bookId, { ts: now, percent: roundedPercent, cfi });

        startTransition(() => {
            setBooks(prev => {
                const book = prev.find(b => b.id === bookId);
                if (!book) return prev;
                const newProgress = hasPercent ? percent : book.progress;
                if (book.lastLocation === cfi && book.progress === newProgress) return prev;
                if (addonsRef.current.sharkyMascot && hasPercent) {
                    const previousProgress = Number(book.progress || 0);
                    const nextProgress = Number(newProgress || 0);
                    [25, 50, 75, 100].forEach(mark => {
                        sharkyActionsRef.current?.notifyMilestone(bookId, mark, book.name, previousProgress, nextProgress);
                    });
                }
                return updateBookInList(prev, bookId, {
                    lastLocation: cfi,
                    progress: newProgress,
                    lastReadDate: now,
                    progressUpdatedAt: now,
                    updatedAt: now,
                });
            });
        });
        setTabTargetCfi(prev => {
            const tab = tabs.find(tabItem => tabItem.bookId === bookId);
            if (!tab || !prev[tab.id]) return prev;
            const next = { ...prev };
            delete next[tab.id];
            return next;
        });
    }, [tabs, progressUpdateThrottleRef, addonsRef, sharkyActionsRef, setBooks, setTabTargetCfi]);

    const toggleBookmarkInApp = useCallback((bookId, cfi, note = 'Marcador', isDelete = false, options = {}) => {
        const now = Date.now();
        setBooks(prev => prev.map(b => {
            if (b.id !== bookId) return b;
            if (isDelete) {
                return {
                    ...b,
                    bookmarks: (b.bookmarks || []).filter(bookmark => {
                        if (bookmark.cfi !== cfi) return true;
                        if (note) return bookmark.note !== note;
                        if (options.kind) return bookmark.kind !== options.kind;
                        const kind = normalizeAnnotationKind(bookmark);
                        return kind !== 'bookmark';
                    }),
                    metadataUpdatedAt: now,
                    updatedAt: now,
                };
            }
            const exists = (b.bookmarks || []).find(bookmark => bookmark.cfi === cfi && bookmark.note === note);
            if (exists) {
                return {
                    ...b,
                    bookmarks: (b.bookmarks || []).filter(bookmark => !(bookmark.cfi === cfi && bookmark.note === note)),
                    metadataUpdatedAt: now,
                    updatedAt: now,
                };
            }
            return {
                ...b,
                bookmarks: [
                    ...(b.bookmarks || []),
                    {
                        cfi,
                        note,
                        date: new Date().toISOString().slice(0, 10),
                        color: options.color || null,
                        kind: options.kind || null,
                    },
                ],
                metadataUpdatedAt: now,
                updatedAt: now,
            };
        }));
    }, [setBooks]);

    const saveWordToVocab = useCallback((word, definition, bookId, bookName) => {
        setVocabulary(prev => {
            if (prev.some(v => v.word.toLowerCase() === word.toLowerCase() && v.bookId === bookId)) return prev;
            return [...prev, { id: Date.now().toString(), word, definition, bookId, bookName, date: new Date().toLocaleDateString() }];
        });
    }, [setVocabulary]);

    const getAnnotationEntries = useCallback((options = {}) => {
        const scopedBooks = options.bookId
            ? books.filter(book => book.id === options.bookId)
            : books.filter(book => Array.isArray(book.bookmarks) && book.bookmarks.length > 0);

        return scopedBooks.flatMap(book =>
            (book.bookmarks || []).map((bookmark, index) => {
                const kind = normalizeAnnotationKind(bookmark);
                return {
                    id: `${book.id}:${bookmark.cfi}:${bookmark.date || ''}:${index}`,
                    bookId: book.id,
                    bookName: book.name,
                    bookAuthor: book.author,
                    cfi: bookmark.cfi,
                    date: bookmark.date || '',
                    color: bookmark.color || 'yellow',
                    colorLabel: kind === 'highlight' ? (HIGHLIGHT_COLOR_LABELS[bookmark.color] || HIGHLIGHT_COLOR_LABELS.yellow) : '',
                    kind,
                    text: normalizeAnnotationText(bookmark),
                    rawNote: bookmark.note || '',
                };
            })
        );
    }, [books]);

    const exportAnnotations = useCallback((format = 'txt', options = {}) => {
        const entries = getAnnotationEntries(options);
        if (!entries.length) {
            alert(t.noBookmarks);
            return;
        }

        const grouped = entries.reduce((acc, entry) => {
            if (!acc[entry.bookId]) {
                acc[entry.bookId] = {
                    bookId: entry.bookId,
                    bookName: entry.bookName,
                    bookAuthor: entry.bookAuthor,
                    items: [],
                };
            }
            acc[entry.bookId].items.push(entry);
            return acc;
        }, {});
        const booksWithMarks = Object.values(grouped);
        const safeName = String(options.fileName || (booksWithMarks.length === 1 ? booksWithMarks[0].bookName : 'Mis_Anotaciones'))
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, '_')
            .slice(0, 64);

        let content = '';
        let mime = 'text/plain';
        let ext = 'txt';

        if (format === 'md') {
            content = '# Mis anotaciones — Shark Reader\n\n';
            booksWithMarks.forEach(book => {
                content += `## ${book.bookName}${book.bookAuthor ? ` — ${book.bookAuthor}` : ''}\n\n`;
                book.items.forEach(item => {
                    if (item.kind === 'highlight') content += `> ${item.text}\n>\n> ${item.colorLabel ? `_${item.colorLabel}_ · ` : ''}${item.date}\n\n`;
                    else if (item.kind === 'note') content += `- Nota: **${item.text || 'Sin texto'}** _(${item.date})_\n`;
                    else content += `- Marcador: **${item.text || 'Sin texto'}** _(${item.date})_\n`;
                });
                content += '\n---\n\n';
            });
            mime = 'text/markdown';
            ext = 'md';
        } else if (format === 'html') {
            const sections = booksWithMarks.map(book => `
                <section>
                    <h2>${book.bookName}${book.bookAuthor ? ` — ${book.bookAuthor}` : ''}</h2>
                    <ul>
                        ${book.items.map(item => `<li><strong>${item.kind === 'highlight' ? 'Subrayado' : item.kind === 'note' ? 'Nota' : 'Marcador'}</strong>: ${item.text || 'Sin texto'}${item.colorLabel ? ` <em>(${item.colorLabel})</em>` : ''} <small>${item.date}</small></li>`).join('')}
                    </ul>
                </section>
            `).join('\n');
            content = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Mis anotaciones</title><style>body{font-family:Segoe UI,system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px}section{background:#111827;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:20px;margin:0 0 18px}h1{color:#7dd3fc}h2{margin:0 0 12px}ul{padding-left:18px}li{margin:0 0 10px;line-height:1.5}small{opacity:.7}</style></head><body><h1>Mis anotaciones — Shark Reader</h1>${sections}</body></html>`;
            mime = 'text/html';
            ext = 'html';
        } else if (format === 'json') {
            content = JSON.stringify({
                exportedAt: new Date().toISOString(),
                scope: options.bookId || 'library',
                books: booksWithMarks,
            }, null, 2);
            mime = 'application/json';
            ext = 'json';
        } else {
            content = 'SHARK READER - TUS ANOTACIONES\n\n';
            booksWithMarks.forEach(book => {
                content += `=========================================\n${book.bookName.toUpperCase()}${book.bookAuthor ? ` - ${book.bookAuthor}` : ''}\n=========================================\n\n`;
                book.items.forEach(item => {
                    const kindLabel = item.kind === 'highlight' ? 'Subrayado' : item.kind === 'note' ? 'Nota' : 'Marcador';
                    const colorLabel = item.colorLabel ? ` [${item.colorLabel}]` : '';
                    content += `[${item.date}] ${kindLabel}${colorLabel} - ${item.text || 'Sin texto'}\n(CFI: ${item.cfi})\n\n`;
                });
            });
        }

        const url = URL.createObjectURL(new Blob([content], { type: mime }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${safeName}.${ext}`;
        link.click();
        URL.revokeObjectURL(url);
    }, [getAnnotationEntries, t]);

    const addNewCategory = useCallback(() => {
        const category = prompt('Nueva categoria:');
        if (category && category.trim() && !customCategories.includes(category.trim())) {
            setCustomCategories(prev => [...prev, category.trim()]);
        }
    }, [customCategories, setCustomCategories]);

    const removeCategory = useCallback((category) => {
        if (!confirm(`Eliminar "${category}"?`)) return;
        setCustomCategories(prev => prev.filter(item => item !== category));
        setBooks(prev => prev.map(book => book.category === category ? { ...book, category: null } : book));
        if (currentFilter === category) setCurrentFilter('all');
    }, [currentFilter, setBooks, setCurrentFilter, setCustomCategories]);

    return {
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
    };
}
