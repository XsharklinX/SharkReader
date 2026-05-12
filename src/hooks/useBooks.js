import { useState, useCallback, useMemo } from 'react';
import { safeParse, saveFileToDB, deleteFileFromDB } from '../db';
import { extractEpubMeta } from '../epubMeta';

export function useBooks(t) {
    const initialBooksMeta = safeParse('sharkreader_meta', {});
    const [books, setBooks] = useState([]);
    const [isDbLoaded, setIsDbLoaded] = useState(false);

    const handleContextMenu = useCallback((e, book) => e.preventDefault(), []);
    const toggleFavorite = useCallback((bookId) => setBooks(prev => prev.map(b => b.id === bookId ? { ...b, isFav: !b.isFav } : b)), []);

    const markFinished = useCallback((bookId) => {
        setBooks(prev => prev.map(b => {
            if (b.id !== bookId) return b;
            const nowFinished = !b.isFinished;
            return { ...b, isFinished: nowFinished, progress: nowFinished ? 100 : b.progress, dateFinished: nowFinished ? Date.now() : null };
        }));
    }, []);

    const updateBookLocation = useCallback((bookId, cfi, percent, tabs) => {
        setBooks(prev => {
            const book = prev.find(b => b.id === bookId);
            if (!book || (book.lastLocation === cfi && book.progress === percent)) return prev;
            return prev.map(b => b.id === bookId ? { ...b, lastLocation: cfi, progress: percent, lastReadDate: Date.now() } : b);
        });
    }, []);

    const toggleBookmark = useCallback((bookId, cfi, note = "Marcador", isDelete = false) => {
        setBooks(prev => prev.map(b => {
            if (b.id !== bookId) return b;
            if (isDelete) return { ...b, bookmarks: b.bookmarks.filter(bm => bm.cfi !== cfi) };
            const exists = b.bookmarks.find(bm => bm.cfi === cfi && bm.note === note);
            if (exists) return { ...b, bookmarks: b.bookmarks.filter(bm => !(bm.cfi === cfi && bm.note === note)) };
            return { ...b, bookmarks: [...b.bookmarks, { cfi, note, date: new Date().toLocaleDateString() }] };
        }));
    }, []);

    const processFiles = useCallback(async (files, onDone) => {
        const valid = files.filter(f => /\.(epub|pdf)$/i.test(f.name));
        if (!valid.length) { alert("Solo se aceptan archivos .epub y .pdf"); return; }
        const loader = document.getElementById('shark-preloader');
        if (loader) { loader.style.visibility = 'visible'; loader.style.opacity = '1'; }
        const placeholders = valid.map(file => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            name: file.name.replace(/\.[^/.]+$/, ''), author: 'Cargando...',
            description: '', publisher: '', tags: '', series: '', seriesIndex: 0,
            file, type: /\.pdf$/i.test(file.name) ? 'pdf' : 'epub',
            url: URL.createObjectURL(file), coverUrl: null,
            color: `hsl(${200 + Math.random() * 40}, 70%, 40%)`,
            isFav: false, rating: 0, progress: 0, lastLocation: null,
            dateAdded: Date.now(), lastReadDate: 0, bookmarks: [], category: null, loading: true,
            readingMinutes: 0, notes: '', isFinished: false, dateStarted: null, dateFinished: null
        }));
        setBooks(prev => [...prev, ...placeholders]);
        const parsed = [];
        for (const p of placeholders) {
            let coverBase64 = null;
            let meta = { title: p.name, creator: t.unknownAuthor || 'Autor desconocido', description: '', publisher: '', tags: '' };
            if (p.type === 'epub') {
                try {
                    const extracted = await extractEpubMeta(p.file);
                    if (extracted?.title) meta.title = extracted.title;
                    if (extracted?.creator) meta.creator = extracted.creator;
                    if (extracted?.description) meta.description = extracted.description;
                    if (extracted?.publisher) meta.publisher = extracted.publisher;
                    if (extracted?.subject) meta.tags = extracted.subject;
                    if (extracted?.coverBase64) coverBase64 = extracted.coverBase64;
                } catch (_) {}
            }
            await saveFileToDB(p.id, p.file, coverBase64, meta.title, meta.creator, p.dateAdded);
            const k = meta.title + '|' + meta.creator;
            const saved = initialBooksMeta[k] || {};
            parsed.push({
                ...p, originalTitle: meta.title, originalAuthor: meta.creator,
                name: saved.customTitle || meta.title, author: saved.customAuthor || meta.creator,
                coverUrl: saved.customCover || coverBase64,
                description: saved.description !== undefined ? saved.description : meta.description,
                publisher: saved.publisher !== undefined ? saved.publisher : meta.publisher,
                tags: saved.tags !== undefined ? saved.tags : meta.tags,
                series: saved.series || '', seriesIndex: saved.seriesIndex || 0,
                isFav: saved.isFav || false, rating: saved.rating || 0,
                progress: saved.progress || 0, lastLocation: saved.lastLocation || null,
                lastReadDate: saved.lastReadDate || 0, bookmarks: saved.bookmarks || [],
                notes: saved.notes || '', isFinished: saved.isFinished || false,
                dateStarted: saved.dateStarted || null, dateFinished: saved.dateFinished || null,
                readingMinutes: saved.readingMinutes || 0,
                category: saved.category || null, loading: false
            });
        }
        setBooks(prev => prev.map(b => parsed.find(n => n.id === b.id) || b));
        if (loader) { loader.style.opacity = '0'; setTimeout(() => { loader.style.visibility = 'hidden'; }, 300); }
        onDone && onDone(parsed);
    }, [t, initialBooksMeta]);

    const deleteBook = useCallback((bookId, books, tabs, lastReadId, closeTab, setLastReadId) => {
        setBooks(prev => prev.filter(b => b.id !== bookId));
        deleteFileFromDB(bookId);
    }, []);

    const importGoodreads = useCallback((text) => {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const newBooks = [];
        for (const line of lines) {
            const parts = line.split(/[,;|]/).map(p => p.trim());
            const title = parts[0]?.replace(/^["']|["']$/g, '').trim();
            const author = parts[1]?.replace(/^["']|["']$/g, '').trim() || 'Autor desconocido';
            if (!title) continue;
            const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            newBooks.push({
                id, name: title, author,
                originalTitle: title, originalAuthor: author,
                description: 'Importado desde Goodreads', publisher: '', tags: 'goodreads-import',
                series: '', seriesIndex: 0, file: null, type: 'wishlist',
                url: null, coverUrl: null, color: `hsl(${Math.random() * 360}, 60%, 45%)`,
                isFav: false, rating: 0, progress: 0, lastLocation: null,
                dateAdded: Date.now(), lastReadDate: 0, bookmarks: [], category: 'Pendientes',
                loading: false, readingMinutes: 0, notes: '', isFinished: false,
                dateStarted: null, dateFinished: null, isWishlist: true
            });
        }
        if (newBooks.length === 0) return 0;
        setBooks(prev => [...prev, ...newBooks]);
        return newBooks.length;
    }, []);

    const displayedBooks = useCallback((books, currentFilter, searchTerm, sortBy) => {
        const filtered = books.filter(b => {
            if (b.loading) return false;
            if (currentFilter === 'favorites' && !b.isFav) return false;
            if (currentFilter === 'unstarted') return !b.lastReadDate && !b.isFinished && !b.isWishlist;
            if (currentFilter === 'reading') return b.lastReadDate > 0 && !b.isFinished;
            if (currentFilter === 'finished') return b.isFinished === true;
            if (currentFilter === 'wishlist') return b.isWishlist === true;
            if (currentFilter !== 'all' && b.category !== currentFilter) return false;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return b.name.toLowerCase().includes(term) || b.author.toLowerCase().includes(term) ||
                    (b.tags && b.tags.toLowerCase().includes(term)) || (b.series && b.series.toLowerCase().includes(term)) ||
                    (b.description && b.description.toLowerCase().includes(term));
            }
            return true;
        });
        return [...filtered].sort((a, b) => {
            if (sortBy === 'lastRead') return (b.lastReadDate || 0) - (a.lastReadDate || 0);
            if (sortBy === 'added') return (b.dateAdded || 0) - (a.dateAdded || 0);
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'progress') return (b.progress || 0) - (a.progress || 0);
            if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
            return 0;
        });
    }, []);

    return {
        books, setBooks, isDbLoaded, setIsDbLoaded,
        toggleFavorite, markFinished, updateBookLocation, toggleBookmark,
        processFiles, deleteBook, importGoodreads, displayedBooks
    };
}
