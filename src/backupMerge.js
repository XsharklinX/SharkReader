import { getBookDedupKey, getBookTitleDedupKey } from './bookModel';

const newerTimestamp = (...values) => Math.max(...values.map(value => Number(value || 0)));

const getBookMergeTimestamp = (book = {}) => newerTimestamp(
    book.updatedAt,
    book.metadataUpdatedAt,
    book.progressUpdatedAt,
    book.lastReadDate,
    book.dateFinished,
    book.dateStarted,
    book.dateAdded,
);

const mergeProgressFields = (base = {}, next = {}) => {
    const baseTs = newerTimestamp(base.progressUpdatedAt, base.lastReadDate);
    const nextTs = newerTimestamp(next.progressUpdatedAt, next.lastReadDate);
    const winner = nextTs >= baseTs ? next : base;
    return {
        progress: winner.progress ?? base.progress ?? 0,
        lastLocation: winner.lastLocation ?? base.lastLocation ?? null,
        lastReadDate: winner.lastReadDate ?? base.lastReadDate ?? 0,
        readingMinutes: Math.max(Number(base.readingMinutes || 0), Number(next.readingMinutes || 0)),
        isFinished: !!(base.isFinished || next.isFinished),
        dateStarted: base.dateStarted || next.dateStarted || null,
        dateFinished: base.dateFinished || next.dateFinished || null,
        progressUpdatedAt: Math.max(baseTs, nextTs, Date.now()),
    };
};

const mergeMetadataFields = (base = {}, next = {}) => {
    const baseTs = newerTimestamp(base.metadataUpdatedAt, base.updatedAt, base.dateAdded);
    const nextTs = newerTimestamp(next.metadataUpdatedAt, next.updatedAt, next.dateAdded);
    const winner = nextTs >= baseTs ? next : base;
    return {
        originalTitle: winner.originalTitle || base.originalTitle || next.originalTitle,
        originalAuthor: winner.originalAuthor || base.originalAuthor || next.originalAuthor,
        customTitle: winner.customTitle ?? base.customTitle ?? '',
        customAuthor: winner.customAuthor ?? base.customAuthor ?? '',
        coverBase64: winner.coverBase64 ?? base.coverBase64 ?? null,
        customCover: winner.customCover ?? base.customCover ?? null,
        description: winner.description ?? base.description ?? '',
        publisher: winner.publisher ?? base.publisher ?? '',
        tags: winner.tags ?? base.tags ?? '',
        series: winner.series ?? base.series ?? '',
        seriesIndex: winner.seriesIndex ?? base.seriesIndex ?? 0,
        category: winner.category ?? base.category ?? null,
        rating: winner.rating ?? base.rating ?? 0,
        isFav: !!(base.isFav || next.isFav),
        notes: winner.notes ?? base.notes ?? '',
        bookmarks: Array.isArray(winner.bookmarks) ? winner.bookmarks : (Array.isArray(base.bookmarks) ? base.bookmarks : []),
        metadataUpdatedAt: Math.max(baseTs, nextTs, Date.now()),
    };
};

const mergeBookRecord = (base = {}, next = {}) => {
    const progress = mergeProgressFields(base, next);
    const metadata = mergeMetadataFields(base, next);
    const latest = getBookMergeTimestamp(next) >= getBookMergeTimestamp(base) ? next : base;
    return {
        ...base,
        ...next,
        ...metadata,
        ...progress,
        id: base.id || next.id,
        file: base.file || next.file || null,
        sourcePath: base.sourcePath || next.sourcePath || null,
        type: base.type || next.type || latest.type || 'epub',
        dateAdded: Math.min(Number(base.dateAdded || Date.now()), Number(next.dateAdded || Date.now())),
        updatedAt: Math.max(getBookMergeTimestamp(base), getBookMergeTimestamp(next), Date.now()),
    };
};

const mergeStats = (localStats = {}, incomingStats = {}) => {
    const merged = { ...localStats, ...incomingStats };
    ['timeRead', 'pagesTurned', 'streak', 'currentDailyMins', 'streakSavers'].forEach(key => {
        merged[key] = Math.max(Number(localStats?.[key] || 0), Number(incomingStats?.[key] || 0));
    });
    merged.history = { ...(localStats.history || {}), ...(incomingStats.history || {}) };
    merged.minutesByDay = { ...(localStats.minutesByDay || {}), ...(incomingStats.minutesByDay || {}) };
    return merged;
};

export const mergeBookSnapshots = (localBooks = [], incomingBooks = []) => {
    const merged = new Map();
    const identityToId = new Map();
    const rememberIdentity = (book) => {
        if (!book?.id) return;
        [getBookDedupKey(book), getBookTitleDedupKey(book)].forEach(key => {
            if (key) identityToId.set(key, book.id);
        });
    };
    const addOrMerge = (book) => {
        if (!book?.id) return;
        const existingId = identityToId.get(getBookDedupKey(book)) || identityToId.get(getBookTitleDedupKey(book));
        const targetId = existingId || book.id;
        const normalizedBook = targetId === book.id ? book : { ...book, id: targetId };
        const current = merged.get(targetId);
        const next = current ? mergeBookRecord(current, normalizedBook) : normalizedBook;
        next.id = targetId;
        merged.set(targetId, next);
        rememberIdentity(next);
    };
    localBooks.forEach(addOrMerge);
    incomingBooks.forEach(addOrMerge);
    return Array.from(merged.values());
};

export const mergeBackupData = (localBackup, incomingBackup) => ({
    schemaVersion: 2,
    app: 'SharkReader',
    exportedAt: new Date().toISOString(),
    books: mergeBookSnapshots(localBackup.books || [], incomingBackup.books || []),
    categories: Array.from(new Set([...(localBackup.categories || []), ...(incomingBackup.categories || [])])).filter(cat => String(cat).toLowerCase() !== 'favoritos'),
    stats: mergeStats(localBackup.stats || {}, incomingBackup.stats || {}),
    user: Object.keys(incomingBackup.user || {}).length ? incomingBackup.user : (localBackup.user || {}),
    workshop: incomingBackup.workshop || localBackup.workshop,
});

export const buildPortableBackup = ({ books, categories, stats, user, workshop }) => ({
    schemaVersion: 2,
    app: 'SharkReader',
    exportedAt: new Date().toISOString(),
    books,
    categories,
    stats,
    user,
    workshop,
});
