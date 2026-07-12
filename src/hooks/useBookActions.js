import { useCallback, startTransition } from 'react';
import { updateBookInList } from '../bookModel';
import { deleteBookFromDB } from '../db';
import { sounds } from '../sounds';
import { getHighlightLabels } from '../highlightLabels';
import { normalizeAnnotationKind, buildAnnotationEntries, groupAnnotationsByBook, buildAnnotationExportContent, buildAnnotationExportFileName, HIGHLIGHT_COLOR_LABELS } from '../annotationExport';

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
    addons,
    addonConfig,
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
                    if (addons?.soundFeedback && addonConfig?.soundFeedback?.achievements !== false) {
                        sounds.bookFinished((addonConfig?.soundFeedback?.volume || 50) / 100 * 0.25);
                    }
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
    }, [addonConfig?.soundFeedback?.achievements, addonConfig?.soundFeedback?.volume, addons?.soundFeedback, setBooks, sharkyActionsRef]);

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
        const percentDelta = hasPercent && previousUpdate.percent !== null
            ? Math.abs(roundedPercent - previousUpdate.percent)
            : (hasPercent ? Infinity : 0);
        const percentChanged = percentDelta >= 0.5;
        const cfiChanged = cfi && cfi !== previousUpdate.cfi;
        const elapsed = now - previousUpdate.ts;
        const shouldUpdate =
            previousUpdate.ts === 0 ||
            percentChanged ||
            elapsed >= 2500 ||
            (cfiChanged && elapsed >= 900);
        if (!shouldUpdate) return;
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
        return buildAnnotationEntries(books, {
            bookId: options.bookId,
            getColorLabel: (color) => getHighlightLabels()[color] || HIGHLIGHT_COLOR_LABELS[color] || HIGHLIGHT_COLOR_LABELS.yellow,
        });
    }, [books]);

    const exportAnnotations = useCallback((format = 'txt', options = {}) => {
        const entries = getAnnotationEntries(options);
        if (!entries.length) {
            alert(t.noBookmarks);
            return;
        }

        const booksWithMarks = groupAnnotationsByBook(entries);
        const safeName = buildAnnotationExportFileName(booksWithMarks, options.fileName);
        const { content, mime, ext } = buildAnnotationExportContent(booksWithMarks, format, options.bookId || 'library');

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
