import { getBookDedupKey, getBookTitleDedupKey } from './bookModel';
import { BACKUP_SCHEMA_VERSION } from './backupValidation';

const newerTimestamp = (...values) => Math.max(...values.map(value => Number(value || 0)));
const resolvedTimestamp = (...values) => newerTimestamp(...values) || Date.now();
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const winnerValue = (winner, key, fallback) => hasOwn(winner, key) ? winner[key] : fallback;

export const getBookMergeTimestamp = (book = {}) => newerTimestamp(
    book.updatedAt,
    book.metadataUpdatedAt,
    book.progressUpdatedAt,
    book.annotationsUpdatedAt,
    book.lastReadDate,
    book.dateFinished,
    book.dateStarted,
    book.dateAdded,
);

export const isBookDeletedByTombstone = (book, deletedBooks = {}) =>
    Number(deletedBooks?.[book?.id] || 0) >= getBookMergeTimestamp(book);

const mergeProgressFields = (base = {}, next = {}) => {
    const baseTs = newerTimestamp(base.progressUpdatedAt, base.lastReadDate);
    const nextTs = newerTimestamp(next.progressUpdatedAt, next.lastReadDate);
    const winner = nextTs >= baseTs ? next : base;
    return {
        progress: winnerValue(winner, 'progress', base.progress ?? next.progress ?? 0),
        lastLocation: winnerValue(winner, 'lastLocation', base.lastLocation ?? next.lastLocation ?? null),
        lastReadDate: winnerValue(winner, 'lastReadDate', base.lastReadDate ?? next.lastReadDate ?? 0),
        readingMinutes: Math.max(Number(base.readingMinutes || 0), Number(next.readingMinutes || 0)),
        isFinished: !!winner.isFinished,
        dateStarted: winnerValue(winner, 'dateStarted', base.dateStarted ?? next.dateStarted ?? null),
        dateFinished: winnerValue(winner, 'dateFinished', base.dateFinished ?? next.dateFinished ?? null),
        progressUpdatedAt: resolvedTimestamp(baseTs, nextTs),
    };
};

const mergeBookmarkArrays = (a = [], b = []) => {
    const seen = new Map();
    [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].forEach(bm => {
        const key = `${bm.cfi}|${bm.note}`;
        if (!seen.has(key)) seen.set(key, bm);
    });
    return Array.from(seen.values());
};

const mergeMetadataFields = (base = {}, next = {}) => {
    const baseTs = newerTimestamp(base.metadataUpdatedAt, base.updatedAt, base.dateAdded);
    const nextTs = newerTimestamp(next.metadataUpdatedAt, next.updatedAt, next.dateAdded);
    const winner = nextTs >= baseTs ? next : base;
    return {
        originalTitle: winner.originalTitle || base.originalTitle || next.originalTitle,
        originalAuthor: winner.originalAuthor || base.originalAuthor || next.originalAuthor,
        customTitle: winnerValue(winner, 'customTitle', base.customTitle ?? next.customTitle ?? ''),
        customAuthor: winnerValue(winner, 'customAuthor', base.customAuthor ?? next.customAuthor ?? ''),
        coverBase64: winnerValue(winner, 'coverBase64', base.coverBase64 ?? next.coverBase64 ?? null),
        customCover: winnerValue(winner, 'customCover', base.customCover ?? next.customCover ?? null),
        description: winnerValue(winner, 'description', base.description ?? next.description ?? ''),
        publisher: winnerValue(winner, 'publisher', base.publisher ?? next.publisher ?? ''),
        tags: winnerValue(winner, 'tags', base.tags ?? next.tags ?? ''),
        series: winnerValue(winner, 'series', base.series ?? next.series ?? ''),
        seriesIndex: winnerValue(winner, 'seriesIndex', base.seriesIndex ?? next.seriesIndex ?? 0),
        category: winnerValue(winner, 'category', base.category ?? next.category ?? null),
        rating: winnerValue(winner, 'rating', base.rating ?? next.rating ?? 0),
        pdfScale: winnerValue(winner, 'pdfScale', base.pdfScale ?? next.pdfScale ?? 1.2),
        readerPreferences: winnerValue(winner, 'readerPreferences', base.readerPreferences || next.readerPreferences || null),
        isFav: !!winner.isFav,
        notes: winnerValue(winner, 'notes', base.notes ?? next.notes ?? ''),
        metadataUpdatedAt: resolvedTimestamp(baseTs, nextTs),
    };
};

const mergeAnnotationFields = (base = {}, next = {}) => {
    const baseTs = newerTimestamp(base.annotationsUpdatedAt, base.metadataUpdatedAt, base.updatedAt);
    const nextTs = newerTimestamp(next.annotationsUpdatedAt, next.metadataUpdatedAt, next.updatedAt);
    if (baseTs === nextTs) {
        return {
            bookmarks: mergeBookmarkArrays(base.bookmarks, next.bookmarks),
            annotationsUpdatedAt: resolvedTimestamp(baseTs, nextTs),
        };
    }
    const winner = nextTs > baseTs ? next : base;
    return {
        bookmarks: Array.isArray(winner.bookmarks) ? winner.bookmarks : [],
        annotationsUpdatedAt: resolvedTimestamp(baseTs, nextTs),
    };
};

const mergeBookRecord = (base = {}, next = {}) => {
    const progress = mergeProgressFields(base, next);
    const metadata = mergeMetadataFields(base, next);
    const annotations = mergeAnnotationFields(base, next);
    const latest = getBookMergeTimestamp(next) >= getBookMergeTimestamp(base) ? next : base;
    const dateAddedCandidates = [base.dateAdded, next.dateAdded].map(Number).filter(value => value > 0);
    return {
        ...base,
        ...next,
        ...metadata,
        ...progress,
        ...annotations,
        id: base.id || next.id,
        file: base.file || next.file || null,
        sourcePath: base.sourcePath || next.sourcePath || null,
        type: base.type || next.type || latest.type || 'epub',
        dateAdded: dateAddedCandidates.length ? Math.min(...dateAddedCandidates) : Date.now(),
        updatedAt: resolvedTimestamp(getBookMergeTimestamp(base), getBookMergeTimestamp(next)),
    };
};

const mergeStats = (localStats = {}, incomingStats = {}) => {
    const merged = { ...localStats, ...incomingStats };
    ['timeRead', 'pagesTurned', 'streak', 'currentDailyMins', 'streakSavers'].forEach(key => {
        merged[key] = Math.max(Number(localStats?.[key] || 0), Number(incomingStats?.[key] || 0));
    });
    merged.history = { ...(localStats.history || {}), ...(incomingStats.history || {}) };
    const allDays = new Set([...Object.keys(localStats.minutesByDay || {}), ...Object.keys(incomingStats.minutesByDay || {})]);
    merged.minutesByDay = {};
    allDays.forEach(day => {
        merged.minutesByDay[day] = Math.max(
            Number((localStats.minutesByDay || {})[day] || 0),
            Number((incomingStats.minutesByDay || {})[day] || 0)
        );
    });
    return merged;
};

const mergeCollections = (localCollections = [], incomingCollections = []) => {
    const merged = new Map();
    const upsert = (collection = {}) => {
        if (!collection) return;
        const normalizedName = String(collection.name || '').trim();
        const key = collection.id || normalizedName.toLowerCase();
        if (!key) return;
        const current = merged.get(key);
        if (!current) {
            merged.set(key, {
                ...collection,
                id: collection.id || key,
                name: normalizedName || 'Colección',
                bookIds: Array.from(new Set(collection.bookIds || [])).filter(Boolean),
            });
            return;
        }
        merged.set(key, {
            ...current,
            ...collection,
            id: current.id || collection.id || key,
            name: normalizedName || current.name || 'Colección',
            bookIds: Array.from(new Set([...(current.bookIds || []), ...(collection.bookIds || [])])).filter(Boolean),
        });
    };
    localCollections.forEach(upsert);
    incomingCollections.forEach(upsert);
    return Array.from(merged.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
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

const mergeDeletedBooks = (localDeleted = {}, incomingDeleted = {}) => {
    const merged = { ...localDeleted };
    Object.entries(incomingDeleted || {}).forEach(([bookId, timestamp]) => {
        merged[bookId] = Math.max(Number(merged[bookId] || 0), Number(timestamp || 0));
    });
    return merged;
};

// Unión de logros: un logro desbloqueado en cualquiera de los dos lados
// queda desbloqueado, conservando el `unlockedAt` MÁS ANTIGUO de los dos —
// esa es la fecha real en la que se ganó, no la fecha del último sync.
export const mergeAchievements = (localAchievements = {}, incomingAchievements = {}) => {
    const merged = { ...localAchievements };
    Object.entries(incomingAchievements || {}).forEach(([id, data]) => {
        const localUnlock = Number(merged[id]?.unlockedAt || 0);
        const incomingUnlock = Number(data?.unlockedAt || 0);
        if (!incomingUnlock) return;
        if (!localUnlock || incomingUnlock < localUnlock) {
            merged[id] = { unlockedAt: incomingUnlock };
        }
    });
    return merged;
};

export const mergeBackupData = (localBackup, incomingBackup) => {
    const deletedBooks = mergeDeletedBooks(localBackup.deletedBooks, incomingBackup.deletedBooks);
    // Workshop/ajustes son un blob de configuración opaco — no tiene sentido
    // fusionarlo campo a campo, así que gana el lado con settingsUpdatedAt
    // más reciente (todo el bloque junto), igual que metadataUpdatedAt
    // decide el ganador del grupo de campos de metadata en cada libro.
    const localSettingsTs = Number(localBackup.settingsUpdatedAt || 0);
    const incomingSettingsTs = Number(incomingBackup.settingsUpdatedAt || 0);
    const settingsWinner = incomingSettingsTs >= localSettingsTs ? incomingBackup : localBackup;
    return {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        app: 'SharkReader',
        exportedAt: new Date().toISOString(),
        books: mergeBookSnapshots(localBackup.books || [], incomingBackup.books || [])
            .filter(book => !isBookDeletedByTombstone(book, deletedBooks)),
        deletedBooks,
        categories: Array.from(new Set([...(localBackup.categories || []), ...(incomingBackup.categories || [])])).filter(cat => String(cat).toLowerCase() !== 'favoritos'),
        collections: mergeCollections(localBackup.collections || [], incomingBackup.collections || []),
        stats: mergeStats(localBackup.stats || {}, incomingBackup.stats || {}),
        user: Object.keys(incomingBackup.user || {}).length ? incomingBackup.user : (localBackup.user || {}),
        workshop: settingsWinner.workshop || localBackup.workshop || incomingBackup.workshop,
        achievements: mergeAchievements(localBackup.achievements, incomingBackup.achievements),
        settingsUpdatedAt: Math.max(localSettingsTs, incomingSettingsTs) || Date.now(),
    };
};

export const buildPortableBackup = ({ books, deletedBooks, categories, collections, stats, user, workshop, achievements, settingsUpdatedAt }) => ({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: 'SharkReader',
    exportedAt: new Date().toISOString(),
    books,
    deletedBooks: deletedBooks || {},
    categories,
    // OJO: a diferencia de `deletedBooks`/`achievements`, NO se le pone `|| []`
    // aquí — un backup selectivo (export/import selectivo, Fase 6) puede omitir
    // `collections` a propósito para que ese campo quede ausente y no se
    // toque al restaurar. Si defaulteara a `[]`, applyBackupObject vería un
    // array válido (Array.isArray([]) === true) y BORRARÍA las colecciones
    // del usuario en cualquier restauración parcial que no las incluyera.
    collections,
    stats,
    user,
    workshop,
    achievements: achievements || {},
    settingsUpdatedAt: Number(settingsUpdatedAt || 0),
});
