export const UNKNOWN_AUTHOR_FALLBACK = 'Autor desconocido';

export const buildBookColor = (seed) => `hsl(${(parseInt(String(seed).slice(-3), 16) || 0) % 360}, 70%, 40%)`;

const bookSearchIndexCache = new WeakMap();

export const getBookSearchIndex = (book) => {
    if (!book || typeof book !== 'object') return '';
    const cached = bookSearchIndexCache.get(book);
    if (cached !== undefined) return cached;
    const index = [
        book.name,
        book.author,
        book.tags,
        book.series,
        book.description,
        book.publisher,
    ].filter(Boolean).join(' ').toLowerCase();
    bookSearchIndexCache.set(book, index);
    return index;
};

export const updateBookInList = (bookList, bookId, updater) => {
    const index = bookList.findIndex(book => book.id === bookId);
    if (index === -1) return bookList;

    const currentBook = bookList[index];
    const nextBook = typeof updater === 'function' ? updater(currentBook) : { ...currentBook, ...updater };
    if (!nextBook || nextBook === currentBook) return bookList;

    const nextList = bookList.slice();
    nextList[index] = nextBook;
    return nextList;
};

export const normalizeBookIdentity = (value) => String(value || '').trim().toLowerCase();

export const normalizeBookStem = (value) => normalizeBookIdentity(value)
    .replace(/\.[^/.]+$/, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/\s+/g, ' ');

export const getBookTitleDedupKey = (bookLike) => {
    const fileName = bookLike?.file?.name || bookLike?.name || bookLike?.originalTitle || '';
    const nativeMeta = bookLike?.nativeMeta || bookLike?.file?.nativeMeta || null;
    const rawTitle = nativeMeta?.title || bookLike?.originalTitle || bookLike?.name || fileName;
    const rawAuthor = nativeMeta?.creator || bookLike?.originalAuthor || bookLike?.author || '';
    const normalizedTitle = normalizeBookStem(rawTitle);
    const normalizedAuthor = normalizeBookIdentity(rawAuthor).replace(/\s+/g, ' ');
    const type = bookLike?.type || (/\.pdf$/i.test(fileName) ? 'pdf' : /\.mobi$/i.test(fileName) ? 'mobi' : 'epub');
    return `title:${type}|${normalizedTitle}|${normalizedAuthor}`;
};

export const getBookDedupKey = (bookLike) => {
    const sourcePath = bookLike?.sourcePath || bookLike?.path || bookLike?.file?.sourcePath || null;
    if (sourcePath) return `path:${normalizeBookIdentity(sourcePath)}`;

    const fileName = bookLike?.file?.name || bookLike?.name || bookLike?.originalTitle || '';
    const type = bookLike?.type || (/\.pdf$/i.test(fileName) ? 'pdf' : /\.mobi$/i.test(fileName) ? 'mobi' : 'epub');
    const size = bookLike?.file?.size ?? bookLike?.size ?? '';
    return `file:${type}|${normalizeBookStem(fileName)}|${size}`;
};

export const getBookType = (file, fallbackType = 'epub') => {
    const fileName = file?.name || '';
    if (/\.pdf$/i.test(fileName)) return 'pdf';
    if (/\.mobi$/i.test(fileName)) return 'mobi';
    return fallbackType;
};

export const toStoredBookRecord = (book, overrides = {}, options = {}) => {
    const snapshot = { ...book, ...overrides };
    const includeFile = options.includeFile !== false;
    const now = Date.now();
    const updatedAt = snapshot.updatedAt || snapshot.lastReadDate || snapshot.dateAdded || now;
    const record = {
        id: snapshot.id,
        sourcePath: snapshot.sourcePath || snapshot.file?.sourcePath || null,
        type: snapshot.type || getBookType(snapshot.file, 'epub'),
        originalTitle: snapshot.originalTitle || snapshot.name || 'Libro sin titulo',
        originalAuthor: snapshot.originalAuthor || snapshot.author || UNKNOWN_AUTHOR_FALLBACK,
        coverBase64: snapshot.coverBase64 || null,
        description: snapshot.description || '',
        publisher: snapshot.publisher || '',
        tags: snapshot.tags || '',
        series: snapshot.series || '',
        seriesIndex: snapshot.seriesIndex || 0,
        progress: snapshot.progress || 0,
        bookmarks: Array.isArray(snapshot.bookmarks) ? snapshot.bookmarks : [],
        notes: snapshot.notes || '',
        customTitle: snapshot.name && snapshot.name !== snapshot.originalTitle ? snapshot.name : '',
        customAuthor: snapshot.author && snapshot.author !== snapshot.originalAuthor ? snapshot.author : '',
        customCover: snapshot.customCover ?? (snapshot.coverUrl && snapshot.coverUrl !== snapshot.coverBase64 ? snapshot.coverUrl : null),
        isFav: !!snapshot.isFav,
        rating: snapshot.rating || 0,
        lastLocation: snapshot.lastLocation || null,
        dateAdded: snapshot.dateAdded || now,
        lastReadDate: snapshot.lastReadDate || 0,
        category: snapshot.category || null,
        readingMinutes: snapshot.readingMinutes || 0,
        isFinished: !!snapshot.isFinished,
        dateStarted: snapshot.dateStarted || null,
        dateFinished: snapshot.dateFinished || null,
        isWishlist: !!snapshot.isWishlist,
        updatedAt,
        progressUpdatedAt: snapshot.progressUpdatedAt || snapshot.lastReadDate || updatedAt,
        metadataUpdatedAt: snapshot.metadataUpdatedAt || updatedAt,
    };
    if (includeFile) record.file = snapshot.file || null;
    return record;
};

export const hydrateStoredBook = (stored) => {
    const file = stored.file || null;
    if (file && stored.sourcePath) file.sourcePath = stored.sourcePath;

    const originalTitle = stored.originalTitle || stored.customTitle || file?.name?.replace(/\.[^/.]+$/, '') || 'Libro sin titulo';
    const originalAuthor = stored.originalAuthor || stored.customAuthor || UNKNOWN_AUTHOR_FALLBACK;

    return {
        id: stored.id,
        name: stored.customTitle || originalTitle,
        author: stored.customAuthor || originalAuthor,
        originalTitle,
        originalAuthor,
        coverBase64: stored.coverBase64 || null,
        description: stored.description || '',
        publisher: stored.publisher || '',
        tags: stored.tags || '',
        series: stored.series || '',
        seriesIndex: stored.seriesIndex || 0,
        file,
        sourcePath: stored.sourcePath || file?.sourcePath || null,
        type: stored.type || getBookType(file, 'epub'),
        url: file ? URL.createObjectURL(file) : null,
        coverUrl: stored.customCover || stored.coverBase64 || null,
        color: stored.color || buildBookColor(stored.id),
        isFav: !!stored.isFav,
        rating: stored.rating || 0,
        progress: stored.progress || 0,
        lastLocation: stored.lastLocation || null,
        dateAdded: stored.dateAdded || Date.now(),
        lastReadDate: stored.lastReadDate || 0,
        bookmarks: Array.isArray(stored.bookmarks) ? stored.bookmarks : [],
        notes: stored.notes || '',
        isFinished: !!stored.isFinished,
        dateStarted: stored.dateStarted || null,
        dateFinished: stored.dateFinished || null,
        readingMinutes: stored.readingMinutes || 0,
        category: stored.category || null,
        loading: false,
        isWishlist: !!stored.isWishlist,
        updatedAt: stored.updatedAt || stored.lastReadDate || stored.dateAdded || Date.now(),
        progressUpdatedAt: stored.progressUpdatedAt || stored.lastReadDate || stored.updatedAt || stored.dateAdded || Date.now(),
        metadataUpdatedAt: stored.metadataUpdatedAt || stored.updatedAt || stored.dateAdded || Date.now(),
    };
};

export const stripBookFilesForExport = (book) => {
    const { file, ...record } = toStoredBookRecord(book, {}, { includeFile: false });
    return record;
};

export const applyImportedBookData = (book, imported) => {
    if (!imported) return book;

    const originalTitle = imported.originalTitle || book.originalTitle;
    const originalAuthor = imported.originalAuthor || book.originalAuthor;
    const customTitle = imported.customTitle || '';
    const customAuthor = imported.customAuthor || '';
    const coverBase64 = imported.coverBase64 ?? book.coverBase64 ?? null;
    const customCover = imported.customCover ?? null;

    return {
        ...book,
        originalTitle,
        originalAuthor,
        name: customTitle || originalTitle,
        author: customAuthor || originalAuthor,
        coverBase64,
        coverUrl: customCover || coverBase64 || book.coverUrl || null,
        description: imported.description ?? book.description ?? '',
        publisher: imported.publisher ?? book.publisher ?? '',
        tags: imported.tags ?? book.tags ?? '',
        series: imported.series ?? book.series ?? '',
        seriesIndex: imported.seriesIndex ?? book.seriesIndex ?? 0,
        progress: imported.progress ?? book.progress ?? 0,
        bookmarks: Array.isArray(imported.bookmarks) ? imported.bookmarks : book.bookmarks,
        notes: imported.notes ?? book.notes ?? '',
        isFav: imported.isFav ?? book.isFav ?? false,
        rating: imported.rating ?? book.rating ?? 0,
        lastLocation: imported.lastLocation ?? book.lastLocation ?? null,
        dateAdded: imported.dateAdded ?? book.dateAdded ?? Date.now(),
        lastReadDate: imported.lastReadDate ?? book.lastReadDate ?? 0,
        category: imported.category ?? book.category ?? null,
        readingMinutes: imported.readingMinutes ?? book.readingMinutes ?? 0,
        isFinished: imported.isFinished ?? book.isFinished ?? false,
        dateStarted: imported.dateStarted ?? book.dateStarted ?? null,
        dateFinished: imported.dateFinished ?? book.dateFinished ?? null,
        sourcePath: imported.sourcePath || book.sourcePath || null,
        updatedAt: imported.updatedAt || book.updatedAt || Date.now(),
        progressUpdatedAt: imported.progressUpdatedAt || book.progressUpdatedAt || imported.lastReadDate || book.lastReadDate || Date.now(),
        metadataUpdatedAt: imported.metadataUpdatedAt || book.metadataUpdatedAt || imported.updatedAt || book.updatedAt || Date.now(),
    };
};
