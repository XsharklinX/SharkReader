import { useMemo, useCallback } from 'react';
import { getBookSearchIndex } from '../bookModel';
import { smartCollectionBookIds } from '../smartCollections';

const LIBRARY_VIRTUALIZE_THRESHOLD = 80;
const LIBRARY_SCROLL_OVERSCAN = 4;
// Altura fija estimada de una fila de resultado de búsqueda (portada 64px + padding
// + hasta 2 líneas de texto + chips). La lista de resultados es siempre de una sola
// columna, a diferencia de la grid principal, así que necesita su propia geometría
// de virtualización en vez de reutilizar virtualLibrary (que asume el layout activo
// — grid o lista — y produce offsets incorrectos si son distintos).
const SEARCH_RESULT_ROW_HEIGHT = 120;

const splitBookTags = (value) => String(value || '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);

const normalizeTagKey = (value) => String(value || '').trim().toLowerCase();

export function useLibrary({
    books,
    contentIndexMap,
    currentFilter,
    deferredSearchTerm,
    searchTerm,
    manualCollections,
    sortBy,
    filterTags,
    filterAuthors,
    customCategories,
    netflixView,
    libraryView,
    libraryViewport,
    getAnnotationEntries,
    shouldComputeAnnotations = false,
    annotationSearch,
    annotationBookFilter,
    tabs,
    folderImport,
}) {
    const metricsStart = typeof performance !== 'undefined' ? performance.now() : 0;
    const activeSearchNeedle = deferredSearchTerm.trim().toLowerCase();
    const contentIndexDependency = activeSearchNeedle ? contentIndexMap : null;
    const collectionLookup = useMemo(() => {
        const byId = new Map();
        const bookSets = new Map();
        manualCollections.forEach(collection => {
            byId.set(collection.id, collection);
            // Las colecciones "smart" (con regla) recalculan su contenido en vivo
            // contra la biblioteca actual en vez de guardar una lista fija de IDs.
            const ids = collection.rule ? smartCollectionBookIds(books, collection.rule) : (collection.bookIds || []);
            bookSets.set(collection.id, new Set(ids));
        });
        return { byId, bookSets };
    }, [manualCollections, books]);

    const displayedBooks = useMemo(() => {
        const now = Date.now();
        const searchNeedle = activeSearchNeedle;
        const filtered = books.filter(b => {
            if (b.loading) return false;
            if (currentFilter === 'favorites' && !b.isFav) return false;
            if (currentFilter === 'unfinished') return !b.isFinished;
            if (currentFilter === 'unstarted') return !b.lastReadDate && !b.isFinished;
            if (currentFilter === 'reading') return b.lastReadDate > 0 && !b.isFinished;
            if (currentFilter === 'finished') return b.isFinished === true;
            if (currentFilter === 'recents') return (b.dateAdded > now - 7 * 24 * 60 * 60 * 1000) || (b.lastReadDate > now - 14 * 24 * 60 * 60 * 1000);
            if (currentFilter.startsWith('collection:')) {
                const collectionId = currentFilter.slice(11);
                return !!collectionLookup.bookSets.get(collectionId)?.has(b.id);
            }
            if (currentFilter.startsWith('author:')) return b.author?.toLowerCase() === currentFilter.slice(7).toLowerCase();
            if (currentFilter.startsWith('tag:')) {
                const tagNeedle = normalizeTagKey(currentFilter.slice(4));
                return splitBookTags(b.tags).some(tag => normalizeTagKey(tag) === tagNeedle);
            }
            if (currentFilter.startsWith('rating:')) {
                const requiredRating = Number(currentFilter.slice(7));
                return Number(b.rating || 0) === requiredRating;
            }
            if (currentFilter === 'shelf:abandoned') {
                const now = Date.now();
                return !b.isFinished && b.lastReadDate > 0 && (now - b.lastReadDate) > 180 * 86400000;
            }
            if (currentFilter === 'shelf:unopened') return !b.lastReadDate && !b.isFinished;
            if (currentFilter === 'shelf:almostdone') return !b.isFinished && (b.progress || 0) >= 80;
            if (currentFilter !== 'all' && currentFilter !== 'favorites' && b.category !== currentFilter) return false;
            if (filterTags.length > 0) {
                const bookTagNorms = splitBookTags(b.tags).map(normalizeTagKey);
                if (!filterTags.some(tag => bookTagNorms.includes(normalizeTagKey(tag)))) return false;
            }
            if (filterAuthors.length > 0) {
                if (!filterAuthors.some(a => b.author?.toLowerCase() === a.toLowerCase())) return false;
            }
            if (searchNeedle) {
                const contentIndex = contentIndexMap[b.id]?.text || '';
                return getBookSearchIndex(b).includes(searchNeedle) || contentIndex.includes(searchNeedle);
            }
            return true;
        });
        return [...filtered].sort((a, b) => {
            if (sortBy === 'lastRead') return (b.lastReadDate || 0) - (a.lastReadDate || 0);
            if (sortBy === 'added') return (b.dateAdded || 0) - (a.dateAdded || 0);
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'progress') return (b.progress || 0) - (a.progress || 0);
            if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
            if (sortBy === 'series') {
                const seriesCompare = (a.series || '').localeCompare(b.series || '');
                if (seriesCompare !== 0) return seriesCompare;
                const indexCompare = (a.seriesIndex || 0) - (b.seriesIndex || 0);
                if (indexCompare !== 0) return indexCompare;
                return a.name.localeCompare(b.name);
            }
            return 0;
        });
    }, [books, contentIndexDependency, currentFilter, activeSearchNeedle, collectionLookup, sortBy, filterTags, filterAuthors]);

    const searchResultsWithMatches = useMemo(() => {
        if (!searchTerm) return null;
        const term = activeSearchNeedle;
        return displayedBooks.map(b => ({
            ...b,
            contentMatch: (contentIndexMap[b.id]?.text || '').includes(term),
            matchedFields: [
                b.name.toLowerCase().includes(term) && 'Título',
                b.author.toLowerCase().includes(term) && 'Autor',
                b.series && b.series.toLowerCase().includes(term) && 'Serie',
                b.tags && b.tags.toLowerCase().includes(term) && 'Etiquetas',
                b.description && b.description.toLowerCase().includes(term) && 'Sinopsis',
                b.publisher && b.publisher.toLowerCase().includes(term) && 'Editorial',
                (contentIndexMap[b.id]?.text || '').includes(term) && 'Contenido',
            ].filter(Boolean)
        }));
    }, [activeSearchNeedle, contentIndexDependency, displayedBooks, searchTerm]);

    const libraryDerived = useMemo(() => {
        const now = Date.now();
        const authorsSet = new Set();
        const counts = {
            all: 0,
            reading: 0,
            unfinished: 0,
            unstarted: 0,
            finished: 0,
            favorites: 0,
            recents: 0,
            shelfAbandoned: 0,
            shelfUnopened: 0,
            shelfAlmostDone: 0,
        };
        const categoryCounts = new Map(customCategories.map(category => [category, 0]));
        const collectionCounts = new Map(manualCollections.map(collection => [collection.id, 0]));
        const authorCounts = new Map();
        const tagCounts = new Map();
        const ratingCounts = new Map([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);

        books.forEach(book => {
            if (book.loading) return;
            counts.all += 1;
            if (book.author) {
                authorsSet.add(book.author);
                authorCounts.set(book.author, (authorCounts.get(book.author) || 0) + 1);
            }
            if (book.lastReadDate > 0 && !book.isFinished) counts.reading += 1;
            if (!book.isFinished) counts.unfinished += 1;
            if (!book.lastReadDate && !book.isFinished) counts.unstarted += 1;
            if (book.isFinished) counts.finished += 1;
            if (book.isFav) counts.favorites += 1;
            if ((book.dateAdded > now - 7 * 24 * 60 * 60 * 1000) || (book.lastReadDate > now - 14 * 24 * 60 * 60 * 1000)) counts.recents += 1;
            if (!book.isFinished && book.lastReadDate > 0 && (now - book.lastReadDate) > 180 * 86400000) counts.shelfAbandoned += 1;
            if (!book.lastReadDate && !book.isFinished) counts.shelfUnopened += 1;
            if (!book.isFinished && (book.progress || 0) >= 80) counts.shelfAlmostDone += 1;
            if (book.category && categoryCounts.has(book.category)) {
                categoryCounts.set(book.category, (categoryCounts.get(book.category) || 0) + 1);
            }
            splitBookTags(book.tags).forEach(tag => {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
            const rating = Number(book.rating || 0);
            if (rating >= 1 && rating <= 5) {
                ratingCounts.set(rating, (ratingCounts.get(rating) || 0) + 1);
            }
        });
        manualCollections.forEach(collection => {
            collectionCounts.set(collection.id, collectionLookup.bookSets.get(collection.id)?.size || 0);
        });

        return {
            authors: [...authorsSet].sort(),
            tags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
            counts,
            authorCounts,
            categoryCounts,
            collectionCounts,
            tagCounts,
            ratingCounts,
        };
    }, [books, customCategories, manualCollections, collectionLookup]);

    const virtualLibrary = useMemo(() => {
        const total = displayedBooks.length;
        const enabled = total > LIBRARY_VIRTUALIZE_THRESHOLD && libraryViewport.height > 0;
        if (!enabled) {
            return { enabled: false, items: displayedBooks, top: 0, totalHeight: 0, columns: 1, startIndex: 0, endIndex: total };
        }

        if (libraryView === 'list') {
            const itemHeight = 88;
            const startIndex = Math.max(0, Math.floor(libraryViewport.scrollTop / itemHeight) - LIBRARY_SCROLL_OVERSCAN);
            const visibleCount = Math.ceil(libraryViewport.height / itemHeight) + LIBRARY_SCROLL_OVERSCAN * 2;
            const endIndex = Math.min(total, startIndex + visibleCount);
            return {
                enabled: true,
                items: displayedBooks.slice(startIndex, endIndex),
                top: startIndex * itemHeight,
                totalHeight: total * itemHeight,
                columns: 1,
                startIndex,
                endIndex,
            };
        }

        const horizontalPadding = libraryViewport.width >= 768 ? 96 : 32;
        const availableWidth = Math.max(260, libraryViewport.width - horizontalPadding);
        const minCardWidth = netflixView ? 200 : 160;
        const columnGap = 24;
        const rowGap = netflixView ? 32 : 40;
        const columns = Math.max(1, Math.floor((availableWidth + columnGap) / (minCardWidth + columnGap)));
        const cardWidth = (availableWidth - columnGap * (columns - 1)) / columns;
        const rowHeight = Math.ceil(cardWidth * 1.5 + 74 + rowGap);
        const rowCount = Math.ceil(total / columns);
        const startRow = Math.max(0, Math.floor(libraryViewport.scrollTop / rowHeight) - LIBRARY_SCROLL_OVERSCAN);
        const visibleRows = Math.ceil(libraryViewport.height / rowHeight) + LIBRARY_SCROLL_OVERSCAN * 2;
        const endRow = Math.min(rowCount, startRow + visibleRows);
        const startIndex = startRow * columns;
        const endIndex = Math.min(total, endRow * columns);

        return {
            enabled: true,
            items: displayedBooks.slice(startIndex, endIndex),
            top: startRow * rowHeight,
            totalHeight: rowCount * rowHeight,
            columns,
            startIndex,
            endIndex,
        };
    }, [netflixView, displayedBooks, libraryView, libraryViewport.height, libraryViewport.scrollTop, libraryViewport.width]);

    const virtualSearchResults = useMemo(() => {
        const total = searchResultsWithMatches?.length || 0;
        const enabled = total > LIBRARY_VIRTUALIZE_THRESHOLD && libraryViewport.height > 0;
        if (!enabled) {
            return { enabled: false, items: searchResultsWithMatches || [], top: 0, totalHeight: 0, startIndex: 0, endIndex: total };
        }
        const itemHeight = SEARCH_RESULT_ROW_HEIGHT;
        const startIndex = Math.max(0, Math.floor(libraryViewport.scrollTop / itemHeight) - LIBRARY_SCROLL_OVERSCAN);
        const visibleCount = Math.ceil(libraryViewport.height / itemHeight) + LIBRARY_SCROLL_OVERSCAN * 2;
        const endIndex = Math.min(total, startIndex + visibleCount);
        return {
            enabled: true,
            items: searchResultsWithMatches.slice(startIndex, endIndex),
            top: startIndex * itemHeight,
            totalHeight: total * itemHeight,
            startIndex,
            endIndex,
        };
    }, [searchResultsWithMatches, libraryViewport.height, libraryViewport.scrollTop]);

    const annotationEntries = useMemo(() => {
        if (!shouldComputeAnnotations) return [];
        return getAnnotationEntries();
    }, [getAnnotationEntries, shouldComputeAnnotations]);

    const annotationBookOptions = useMemo(() => {
        const grouped = annotationEntries.reduce((acc, entry) => {
            if (!acc.has(entry.bookId)) {
                acc.set(entry.bookId, { bookId: entry.bookId, bookName: entry.bookName, bookAuthor: entry.bookAuthor, total: 0 });
            }
            acc.get(entry.bookId).total += 1;
            return acc;
        }, new Map());
        return Array.from(grouped.values()).sort((a, b) => a.bookName.localeCompare(b.bookName, 'es'));
    }, [annotationEntries]);

    const filteredAnnotationEntries = useMemo(() => {
        const term = annotationSearch.trim().toLowerCase();
        return annotationEntries.filter(entry => {
            if (annotationBookFilter !== 'all' && entry.bookId !== annotationBookFilter) return false;
            if (!term) return true;
            return [
                entry.text,
                entry.bookName,
                entry.bookAuthor,
                entry.rawNote,
                entry.colorLabel,
                entry.kind,
            ].filter(Boolean).some(value => String(value).toLowerCase().includes(term));
        });
    }, [annotationBookFilter, annotationEntries, annotationSearch]);

    const annotationsByBook = useMemo(() => {
        return filteredAnnotationEntries.reduce((acc, entry) => {
            if (!acc[entry.bookId]) {
                acc[entry.bookId] = {
                    bookId: entry.bookId,
                    bookName: entry.bookName,
                    bookAuthor: entry.bookAuthor,
                    total: 0,
                    highlights: 0,
                    notes: 0,
                    bookmarks: 0,
                    entries: [],
                };
            }
            acc[entry.bookId].total += 1;
            if (entry.kind === 'highlight') acc[entry.bookId].highlights += 1;
            else if (entry.kind === 'note') acc[entry.bookId].notes += 1;
            else acc[entry.bookId].bookmarks += 1;
            acc[entry.bookId].entries.push(entry);
            return acc;
        }, {});
    }, [filteredAnnotationEntries]);

    const annotationGroups = useMemo(() => Object.values(annotationsByBook), [annotationsByBook]);

    const annotationSummary = useMemo(() => filteredAnnotationEntries.reduce((acc, entry) => {
        acc.total += 1;
        if (entry.kind === 'highlight') acc.highlights += 1;
        else if (entry.kind === 'note') acc.notes += 1;
        else acc.bookmarks += 1;
        return acc;
    }, { total: 0, highlights: 0, notes: 0, bookmarks: 0 }), [filteredAnnotationEntries]);

    const openBookIds = useMemo(() => new Set(tabs.map(t => t.bookId)), [tabs]);

    const folderImportOverlay = useMemo(() => {
        if (!folderImport) return null;

        const total = Math.max(folderImport.total || 0, folderImport.discovered || 0, 0);
        const imported = Math.min(folderImport.imported || 0, total || folderImport.imported || 0);
        const metadataProcessed = Math.min(folderImport.metadataProcessed || 0, total || folderImport.metadataProcessed || 0);
        const addedCount = Math.min(folderImport.addedCount || 0, metadataProcessed);
        const skippedDuplicates = folderImport.skippedDuplicates || 0;
        const failedCount = (folderImport.failedFiles || []).length;

        if (folderImport.phase === 'empty') {
            return { ...folderImport, title: 'No se encontraron libros', detail: 'La carpeta seleccionada no contiene EPUB ni PDF.', progress: 100, indeterminate: false, canCancel: false };
        }
        if (folderImport.phase === 'error') {
            return { ...folderImport, title: 'La importación se detuvo', detail: folderImport.error || 'Ocurrió un error inesperado durante la importación.', progress: 100, indeterminate: false, canCancel: false };
        }
        if (folderImport.phase === 'cancelled') {
            const skippedText = skippedDuplicates > 0 ? ` Se omitieron ${skippedDuplicates} duplicado(s).` : '';
            return { ...folderImport, title: 'Importación cancelada', detail: `Se procesaron ${metadataProcessed} de ${total || imported || 0} libros antes de detenerse.${skippedText}`, progress: total > 0 ? Math.round((metadataProcessed / total) * 100) : 0, indeterminate: false, canCancel: false };
        }
        if (folderImport.phase === 'done') {
            const skippedText = skippedDuplicates > 0 ? ` Se omitieron ${skippedDuplicates} duplicado(s).` : '';
            const failedText = failedCount > 0 ? ` ${failedCount} archivo(s) fallaron.` : '';
            return { ...folderImport, title: failedCount > 0 ? 'Importación completada con avisos' : 'Importación completada', detail: `Se agregaron ${addedCount} libros${folderImport.folderName ? ` desde ${folderImport.folderName}` : ''}.${skippedText}${failedText}`, progress: 100, indeterminate: false, canCancel: false, failedCount };
        }
        if (folderImport.phase === 'metadata') {
            return { ...folderImport, title: 'Extrayendo portadas y metadatos', detail: `${metadataProcessed} de ${total || 0} libros listos.`, progress: total > 0 ? Math.round((metadataProcessed / total) * 100) : 0, indeterminate: false, canCancel: !folderImport.isCancelling };
        }
        if (folderImport.phase === 'importing') {
            return { ...folderImport, title: 'Importando libros en segundo plano', detail: `${imported} de ${total || 0} libros cargados desde disco.`, progress: total > 0 ? Math.round((imported / total) * 100) : 0, indeterminate: false, canCancel: !folderImport.isCancelling };
        }

        return { ...folderImport, title: 'Escaneando carpeta', detail: total > 0 ? `${total} libros detectados hasta ahora.` : 'Buscando archivos compatibles...', progress: 15, indeterminate: true, canCancel: !folderImport.isCancelling };
    }, [folderImport]);

    if (import.meta.env.DEV && typeof performance !== 'undefined') {
        const elapsed = performance.now() - metricsStart;
        if (books.length > 250 && elapsed > 12) {
            console.info(`[SharkReader] useLibrary render cost: ${Math.round(elapsed)}ms for ${books.length} books`);
        }
    }

    return {
        displayedBooks,
        searchResultsWithMatches,
        libraryDerived,
        virtualLibrary,
        virtualSearchResults,
        annotationBookOptions,
        annotationGroups,
        annotationSummary,
        openBookIds,
        folderImportOverlay,
    };
}
