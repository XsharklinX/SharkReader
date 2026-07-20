import { migrateBackupToLatest } from './backupMigrations';

export const BACKUP_SCHEMA_VERSION = 4;

const isRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const toFiniteNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};
const toTimestamp = (value) => Math.max(0, toFiniteNumber(value, 0));
const toText = (value, fallback = '', maxLength = 200000) => {
    if (value === null || value === undefined) return fallback;
    return String(value).slice(0, maxLength);
};

const normalizeBookmarks = (value) => {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 20000).filter(isRecord).map(bookmark => ({
        cfi: toText(bookmark.cfi, '', 4000),
        note: toText(bookmark.note, '', 200000),
        date: toText(bookmark.date, '', 64),
        color: bookmark.color == null ? null : toText(bookmark.color, '', 64),
        kind: bookmark.kind == null ? null : toText(bookmark.kind, '', 64),
    })).filter(bookmark => bookmark.cfi || bookmark.note);
};

const normalizeBook = (book) => {
    if (!isRecord(book)) return null;
    const id = toText(book.id, '', 256).trim();
    if (!id) return null;
    const type = ['epub', 'pdf', 'mobi'].includes(book.type) ? book.type : 'epub';
    return {
        id,
        sourcePath: book.sourcePath == null ? null : toText(book.sourcePath, '', 4000),
        type,
        originalTitle: toText(book.originalTitle || book.name, 'Libro sin titulo', 2000),
        originalAuthor: toText(book.originalAuthor || book.author, 'Autor desconocido', 2000),
        customTitle: toText(book.customTitle, '', 2000),
        customAuthor: toText(book.customAuthor, '', 2000),
        coverBase64: typeof book.coverBase64 === 'string' ? book.coverBase64 : null,
        customCover: typeof book.customCover === 'string' ? book.customCover : null,
        description: toText(book.description, '', 500000),
        publisher: toText(book.publisher, '', 2000),
        tags: toText(book.tags, '', 20000),
        series: toText(book.series, '', 2000),
        seriesIndex: toFiniteNumber(book.seriesIndex, 0),
        progress: Math.min(100, Math.max(0, toFiniteNumber(book.progress, 0))),
        bookmarks: normalizeBookmarks(book.bookmarks),
        notes: toText(book.notes, '', 500000),
        isFav: Boolean(book.isFav),
        rating: Math.min(5, Math.max(0, toFiniteNumber(book.rating, 0))),
        pdfScale: Math.min(5, Math.max(0.25, toFiniteNumber(book.pdfScale, 1.2))),
        readerPreferences: isRecord(book.readerPreferences) ? { ...book.readerPreferences } : null,
        lastLocation: book.lastLocation == null ? null : toText(book.lastLocation, '', 10000),
        dateAdded: toTimestamp(book.dateAdded),
        lastReadDate: toTimestamp(book.lastReadDate),
        category: book.category == null ? null : toText(book.category, '', 2000),
        readingMinutes: Math.max(0, toFiniteNumber(book.readingMinutes, 0)),
        isFinished: Boolean(book.isFinished),
        dateStarted: book.dateStarted == null ? null : toTimestamp(book.dateStarted),
        dateFinished: book.dateFinished == null ? null : toTimestamp(book.dateFinished),
        anniversaryMilestonesSeen: Array.isArray(book.anniversaryMilestonesSeen)
            ? book.anniversaryMilestonesSeen.slice(0, 100).map(value => toText(value, '', 128))
            : [],
        updatedAt: toTimestamp(book.updatedAt),
        progressUpdatedAt: toTimestamp(book.progressUpdatedAt),
        metadataUpdatedAt: toTimestamp(book.metadataUpdatedAt),
        annotationsUpdatedAt: toTimestamp(book.annotationsUpdatedAt),
    };
};

const normalizeCollections = (value) => {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 10000).filter(isRecord).map((collection, index) => {
        const name = toText(collection.name, 'Colección', 500).trim() || 'Colección';
        return {
            id: toText(collection.id, `collection-${index}`, 256),
            name,
            emoji: collection.emoji == null ? undefined : toText(collection.emoji, '', 32),
            bookIds: Array.from(new Set(Array.isArray(collection.bookIds)
                ? collection.bookIds.map(id => toText(id, '', 256)).filter(Boolean)
                : [])),
            rule: isRecord(collection.rule) ? { ...collection.rule } : undefined,
        };
    });
};

const normalizeDeletedBooks = (value) => {
    if (!isRecord(value)) return {};
    return Object.fromEntries(Object.entries(value)
        .slice(0, 100000)
        .map(([id, timestamp]) => [toText(id, '', 256).trim(), toTimestamp(timestamp)])
        .filter(([id, timestamp]) => id && timestamp > 0));
};

// { [achievementId]: { unlockedAt } } — historial de logros, desde v4.
const normalizeAchievements = (value) => {
    if (!isRecord(value)) return undefined;
    const entries = Object.entries(value)
        .slice(0, 2000)
        .map(([id, data]) => {
            const key = toText(id, '', 128).trim();
            const unlockedAt = toTimestamp(isRecord(data) ? data.unlockedAt : data);
            return key && unlockedAt > 0 ? [key, { unlockedAt }] : null;
        })
        .filter(Boolean);
    return Object.fromEntries(entries);
};

export class BackupValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BackupValidationError';
    }
}

export function validateBackupData(rawInput) {
    if (!isRecord(rawInput)) throw new BackupValidationError('El backup no contiene un objeto JSON válido.');
    if (rawInput.app && rawInput.app !== 'SharkReader') {
        throw new BackupValidationError('El archivo pertenece a otra aplicación.');
    }
    // Migra a la versión más reciente ANTES de validar/normalizar, así el
    // resto de esta función solo tiene que entender un único formato.
    const input = migrateBackupToLatest(rawInput);
    const schemaVersion = Math.max(1, Math.floor(toFiniteNumber(input.schemaVersion, 1)));
    if (schemaVersion > BACKUP_SCHEMA_VERSION) {
        throw new BackupValidationError(`El backup usa un esquema más nuevo (${schemaVersion}).`);
    }

    const knownPayload = Array.isArray(input.books)
        || isRecord(input.meta)
        || Array.isArray(input.categories)
        || Array.isArray(input.collections)
        || isRecord(input.stats)
        || isRecord(input.user)
        || isRecord(input.workshop)
        || isRecord(input.deletedBooks)
        || isRecord(input.achievements);
    if (!knownPayload) throw new BackupValidationError('El archivo no contiene datos reconocibles de SharkReader.');
    if (input.books !== undefined && !Array.isArray(input.books)) {
        throw new BackupValidationError('La lista de libros del backup está dañada.');
    }

    const warnings = [];
    const sourceBooks = Array.isArray(input.books) ? input.books.slice(0, 100000) : [];
    const books = sourceBooks.map(normalizeBook).filter(Boolean);
    if (books.length !== sourceBooks.length) {
        warnings.push(`${sourceBooks.length - books.length} libro(s) inválido(s) fueron omitidos.`);
    }

    return {
        backup: {
            schemaVersion,
            app: 'SharkReader',
            exportedAt: toText(input.exportedAt, '', 128),
            books: input.books === undefined ? undefined : books,
            meta: isRecord(input.meta) ? input.meta : undefined,
            categories: input.categories === undefined
                ? undefined
                : Array.from(new Set(input.categories
                    .map(category => toText(category, '', 500).trim())
                    .filter(Boolean)))
                    .filter(category => category.toLowerCase() !== 'favoritos'),
            collections: input.collections === undefined ? undefined : normalizeCollections(input.collections),
            stats: isRecord(input.stats) ? { ...input.stats } : undefined,
            user: isRecord(input.user) ? { ...input.user } : undefined,
            workshop: isRecord(input.workshop) ? { ...input.workshop } : undefined,
            deletedBooks: input.deletedBooks === undefined ? undefined : normalizeDeletedBooks(input.deletedBooks),
            achievements: normalizeAchievements(input.achievements),
            settingsUpdatedAt: input.settingsUpdatedAt === undefined ? undefined : toTimestamp(input.settingsUpdatedAt),
        },
        warnings,
    };
}
