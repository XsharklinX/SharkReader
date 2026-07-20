import { describe, it, expect } from 'vitest';
import {
    updateBookInList,
    getBookDedupKey,
    getBookTitleDedupKey,
    getBookSearchIndex,
    normalizeBookStem,
    toStoredBookRecord,
    hydrateStoredBook,
    applyImportedBookData,
    stripBookFilesForExport,
    stripBookAssetsForSync,
    findDuplicateBookGroups,
    UNKNOWN_AUTHOR_FALLBACK,
} from './bookModel';

// ─── updateBookInList ───────────────────────────────────────────────────────

describe('updateBookInList', () => {
    const books = [
        { id: '1', name: 'Book A', progress: 0 },
        { id: '2', name: 'Book B', progress: 50 },
    ];

    it('applies object updater', () => {
        const result = updateBookInList(books, '1', { progress: 30 });
        expect(result[0].progress).toBe(30);
        expect(result[1].progress).toBe(50);
    });

    it('applies function updater', () => {
        const result = updateBookInList(books, '2', b => ({ ...b, progress: b.progress + 10 }));
        expect(result[1].progress).toBe(60);
    });

    it('returns original list when id not found', () => {
        const result = updateBookInList(books, 'X', { progress: 99 });
        expect(result).toBe(books);
    });

    it('returns original list when updater returns same object', () => {
        const result = updateBookInList(books, '1', b => b);
        expect(result).toBe(books);
    });

    it('does not mutate the original list', () => {
        const original = [{ id: '1', name: 'X' }];
        updateBookInList(original, '1', { name: 'Y' });
        expect(original[0].name).toBe('X');
    });
});

// ─── getBookDedupKey ────────────────────────────────────────────────────────

describe('getBookDedupKey', () => {
    it('prefers sourcePath', () => {
        const key = getBookDedupKey({ sourcePath: '/books/moby.epub', file: { name: 'moby.epub', size: 1000 } });
        expect(key).toMatch(/^path:/);
        expect(key).toContain('moby.epub');
    });

    it('falls back to file name + size', () => {
        const key = getBookDedupKey({ file: { name: 'moby.epub', size: 1234 } });
        expect(key).toMatch(/^file:epub\|/);
        expect(key).toContain('1234');
    });

    it('two books with same file produce same key', () => {
        const a = getBookDedupKey({ file: { name: 'book.epub', size: 999 } });
        const b = getBookDedupKey({ file: { name: 'book.epub', size: 999 } });
        expect(a).toBe(b);
    });

    it('detects pdf type from file name', () => {
        const key = getBookDedupKey({ file: { name: 'report.pdf', size: 100 } });
        expect(key).toMatch(/^file:pdf\|/);
    });
});

// ─── getBookTitleDedupKey ───────────────────────────────────────────────────

describe('getBookTitleDedupKey', () => {
    it('produces key from title + author', () => {
        const key = getBookTitleDedupKey({ originalTitle: 'Moby Dick', originalAuthor: 'Melville' });
        expect(key).toContain('moby dick');
        expect(key).toContain('melville');
    });

    it('strips file extension from title stem', () => {
        const k1 = getBookTitleDedupKey({ name: 'Moby Dick' });
        const k2 = getBookTitleDedupKey({ name: 'Moby Dick.epub' });
        expect(k1).toBe(k2);
    });

    it('two books with same title/author produce same key regardless of casing', () => {
        const a = getBookTitleDedupKey({ originalTitle: 'Dune', originalAuthor: 'Frank Herbert' });
        const b = getBookTitleDedupKey({ originalTitle: 'DUNE', originalAuthor: 'frank herbert' });
        expect(a).toBe(b);
    });
});

// ─── findDuplicateBookGroups ────────────────────────────────────────────────

// ─── stripBookAssetsForSync ─────────────────────────────────────────────────

describe('stripBookAssetsForSync', () => {
    it('quita file, coverBase64 y customCover pero conserva el resto', () => {
        const book = {
            id: '1', name: 'Dune', author: 'Frank Herbert',
            file: { name: 'dune.epub' },
            coverBase64: 'data:image/jpeg;base64,AAAA',
            customCover: 'data:image/jpeg;base64,BBBB',
            progress: 42,
        };
        const record = stripBookAssetsForSync(book);
        expect(record.file).toBeUndefined();
        expect(record.coverBase64).toBeUndefined();
        expect(record.customCover).toBeUndefined();
        expect(record.progress).toBe(42);
        expect(record.originalTitle).toBe('Dune');
    });

    it('no lanza si el libro no tiene portada', () => {
        const book = { id: '1', name: 'Dune', progress: 0 };
        expect(() => stripBookAssetsForSync(book)).not.toThrow();
    });
});

describe('findDuplicateBookGroups', () => {
    it('agrupa libros con el mismo archivo (nombre + tamaño)', () => {
        const books = [
            { id: '1', file: { name: 'dune.epub', size: 1000 } },
            { id: '2', file: { name: 'dune.epub', size: 1000 } },
            { id: '3', file: { name: 'otro.epub', size: 500 } },
        ];
        const groups = findDuplicateBookGroups(books);
        expect(groups).toHaveLength(1);
        expect(groups[0].books.map(b => b.id).sort()).toEqual(['1', '2']);
    });

    it('agrupa libros con mismo título+autor aunque el archivo sea distinto', () => {
        const books = [
            { id: '1', originalTitle: 'Dune', originalAuthor: 'Frank Herbert', file: { name: 'a.epub', size: 100 } },
            { id: '2', originalTitle: 'DUNE', originalAuthor: 'frank herbert', file: { name: 'b.epub', size: 200 } },
        ];
        const groups = findDuplicateBookGroups(books);
        expect(groups).toHaveLength(1);
        expect(groups[0].reason).toBe('title');
    });

    it('no agrupa libros distintos', () => {
        const books = [
            { id: '1', originalTitle: 'Dune', originalAuthor: 'Frank Herbert', file: { name: 'a.epub', size: 100 } },
            { id: '2', originalTitle: 'Otro libro', originalAuthor: 'Otro Autor', file: { name: 'b.epub', size: 200 } },
        ];
        expect(findDuplicateBookGroups(books)).toEqual([]);
    });

    it('no repite el mismo grupo cuando coincide por archivo y por título a la vez', () => {
        const books = [
            { id: '1', originalTitle: 'Dune', originalAuthor: 'Frank Herbert', file: { name: 'dune.epub', size: 1000 } },
            { id: '2', originalTitle: 'Dune', originalAuthor: 'Frank Herbert', file: { name: 'dune.epub', size: 1000 } },
        ];
        const groups = findDuplicateBookGroups(books);
        expect(groups).toHaveLength(1);
    });

    it('devuelve vacío para biblioteca sin duplicados o vacía', () => {
        expect(findDuplicateBookGroups([])).toEqual([]);
        expect(findDuplicateBookGroups([{ id: '1', file: { name: 'a.epub', size: 1 } }])).toEqual([]);
    });
});

// ─── normalizeBookStem ──────────────────────────────────────────────────────

describe('normalizeBookStem', () => {
    it('lowercases and trims', () => {
        expect(normalizeBookStem('  DUNE  ')).toBe('dune');
    });

    it('strips file extension', () => {
        expect(normalizeBookStem('book.epub')).toBe('book');
    });

    it('strips trailing numbering like (2)', () => {
        expect(normalizeBookStem('Book Name (2)')).toBe('book name');
    });
});

// ─── getBookSearchIndex ─────────────────────────────────────────────────────

describe('getBookSearchIndex', () => {
    it('returns empty string for null/undefined', () => {
        expect(getBookSearchIndex(null)).toBe('');
        expect(getBookSearchIndex(undefined)).toBe('');
    });

    it('includes name, author, and tags', () => {
        const idx = getBookSearchIndex({ name: 'Dune', author: 'Herbert', tags: 'sci-fi' });
        expect(idx).toContain('dune');
        expect(idx).toContain('herbert');
        expect(idx).toContain('sci-fi');
    });

    it('caches results for same object reference', () => {
        const book = { name: 'Test', author: 'A' };
        const r1 = getBookSearchIndex(book);
        const r2 = getBookSearchIndex(book);
        expect(r1).toBe(r2);
    });
});

// ─── toStoredBookRecord ─────────────────────────────────────────────────────

describe('toStoredBookRecord', () => {
    it('produces a complete record from a minimal book', () => {
        const book = { id: 'b1', name: 'Test', author: 'A', progress: 42, bookmarks: [] };
        const rec = toStoredBookRecord(book);
        expect(rec.id).toBe('b1');
        expect(rec.progress).toBe(42);
        expect(rec.isFav).toBe(false);
        expect(rec.isFinished).toBe(false);
    });

    it('excludes file when includeFile is false', () => {
        const book = { id: 'b1', name: 'X', file: { name: 'x.epub' } };
        const rec = toStoredBookRecord(book, {}, { includeFile: false });
        expect(rec.file).toBeUndefined();
    });

    it('includes file by default', () => {
        const file = { name: 'x.epub' };
        const book = { id: 'b1', name: 'X', file };
        const rec = toStoredBookRecord(book);
        expect(rec.file).toBe(file);
    });

    it('stores customTitle only when name differs from originalTitle', () => {
        const rec1 = toStoredBookRecord({ id: '1', name: 'Custom', originalTitle: 'Original' });
        expect(rec1.customTitle).toBe('Custom');

        const rec2 = toStoredBookRecord({ id: '1', name: 'Same', originalTitle: 'Same' });
        expect(rec2.customTitle).toBe('');
    });

    it('stores EPUB reader preferences by book', () => {
        const readerPreferences = {
            fontFamily: 'Lora',
            fontSize: 120,
            lineHeight: 1.8,
            columnWidth: 'narrow',
        };
        const record = toStoredBookRecord({
            id: 'prefs',
            name: 'Libro',
            originalTitle: 'Libro',
            readerPreferences,
        }, {}, { includeFile: false });
        expect(record.readerPreferences).toEqual(readerPreferences);
    });
});

// ─── hydrateStoredBook ──────────────────────────────────────────────────────

describe('hydrateStoredBook', () => {
    it('does not create an ObjectURL for files kept in memory', () => {
        const file = new Blob(['book'], { type: 'application/epub+zip' });
        const hydrated = hydrateStoredBook({ id: '1', originalTitle: 'Book', file });
        expect(hydrated.file).toBe(file);
        expect(hydrated.url).toBeNull();
    });

    it('reconstructs name from customTitle or originalTitle', () => {
        const withCustom = hydrateStoredBook({ id: '1', customTitle: 'Custom', originalTitle: 'Original' });
        expect(withCustom.name).toBe('Custom');

        const withoutCustom = hydrateStoredBook({ id: '1', originalTitle: 'Original' });
        expect(withoutCustom.name).toBe('Original');
    });

    it('sets loading to false', () => {
        const h = hydrateStoredBook({ id: '1' });
        expect(h.loading).toBe(false);
    });

    it('normalizes missing fields to safe defaults', () => {
        const h = hydrateStoredBook({ id: '1' });
        expect(h.bookmarks).toEqual([]);
        expect(h.isFav).toBe(false);
        expect(h.progress).toBe(0);
        expect(h.author).toBe(UNKNOWN_AUTHOR_FALLBACK);
    });

    it('hydrates EPUB reader preferences', () => {
        const readerPreferences = { fontFamily: 'Georgia', fontSize: 130, columnWidth: 'wide' };
        const hydrated = hydrateStoredBook({ id: 'prefs', readerPreferences });
        expect(hydrated.readerPreferences).toEqual(readerPreferences);
    });
});

// ─── applyImportedBookData ──────────────────────────────────────────────────

describe('applyImportedBookData', () => {
    it('returns base unchanged when imported is null', () => {
        const base = { id: '1', name: 'Original' };
        expect(applyImportedBookData(base, null)).toBe(base);
    });

    it('merges progress and bookmarks from imported', () => {
        const base = { id: '1', name: 'X', progress: 0, bookmarks: [] };
        const imported = { progress: 75, bookmarks: [{ cfi: 'cfi1', note: 'test', date: '2024-01-01' }] };
        const result = applyImportedBookData(base, imported);
        expect(result.progress).toBe(75);
        expect(result.bookmarks).toHaveLength(1);
    });

    it('uses imported customTitle when present', () => {
        const base = { id: '1', name: 'Old', originalTitle: 'Old' };
        const imported = { customTitle: 'New Title', originalTitle: 'Old' };
        const result = applyImportedBookData(base, imported);
        expect(result.name).toBe('New Title');
    });
});

// ─── stripBookFilesForExport ────────────────────────────────────────────────

describe('stripBookFilesForExport', () => {
    it('removes file property', () => {
        const book = { id: '1', name: 'X', file: { name: 'x.epub' } };
        const stripped = stripBookFilesForExport(book);
        expect(stripped.file).toBeUndefined();
    });
});
