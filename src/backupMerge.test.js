import { describe, it, expect, beforeEach } from 'vitest';
import { mergeBookSnapshots, mergeBackupData, buildPortableBackup } from './backupMerge';
import { BACKUP_SCHEMA_VERSION } from './backupValidation';

const makeBook = (overrides = {}) => ({
    id: 'b1',
    originalTitle: 'Dune',
    originalAuthor: 'Herbert',
    type: 'epub',
    progress: 0,
    bookmarks: [],
    isFav: false,
    isFinished: false,
    readingMinutes: 0,
    dateAdded: 1000,
    updatedAt: 1000,
    metadataUpdatedAt: 1000,
    progressUpdatedAt: 1000,
    annotationsUpdatedAt: 1000,
    lastReadDate: 0,
    ...overrides,
});

// ─── mergeBookSnapshots ─────────────────────────────────────────────────────

describe('mergeBookSnapshots', () => {
    it('returns local books when incoming is empty', () => {
        const local = [makeBook({ id: 'b1' })];
        expect(mergeBookSnapshots(local, [])).toHaveLength(1);
    });

    it('returns incoming books when local is empty', () => {
        const incoming = [makeBook({ id: 'b1' })];
        expect(mergeBookSnapshots([], incoming)).toHaveLength(1);
    });

    it('merges matching books by id', () => {
        const local = [makeBook({ id: 'b1', progress: 20, progressUpdatedAt: 1000 })];
        const incoming = [makeBook({ id: 'b1', progress: 40, progressUpdatedAt: 2000 })];
        const result = mergeBookSnapshots(local, incoming);
        expect(result).toHaveLength(1);
        expect(result[0].progress).toBe(40);
    });

    it('keeps the higher progress when local is more recent', () => {
        const local = [makeBook({ id: 'b1', progress: 80, progressUpdatedAt: 3000 })];
        const incoming = [makeBook({ id: 'b1', progress: 40, progressUpdatedAt: 1000 })];
        const result = mergeBookSnapshots(local, incoming);
        expect(result[0].progress).toBe(80);
    });

    it('combines bookmarks from both sources (union)', () => {
        const bm1 = { cfi: 'cfi1', note: 'Mark 1', date: '2024-01-01' };
        const bm2 = { cfi: 'cfi2', note: 'Mark 2', date: '2024-01-02' };
        const local = [makeBook({ id: 'b1', bookmarks: [bm1] })];
        const incoming = [makeBook({ id: 'b1', bookmarks: [bm2] })];
        const result = mergeBookSnapshots(local, incoming);
        expect(result[0].bookmarks).toHaveLength(2);
    });

    it('deduplicates identical bookmarks', () => {
        const bm = { cfi: 'cfi1', note: 'Mark', date: '2024-01-01' };
        const local = [makeBook({ id: 'b1', bookmarks: [bm] })];
        const incoming = [makeBook({ id: 'b1', bookmarks: [bm] })];
        const result = mergeBookSnapshots(local, incoming);
        expect(result[0].bookmarks).toHaveLength(1);
    });

    it('allows a newer annotation snapshot to delete old bookmarks', () => {
        const bm = { cfi: 'cfi1', note: 'Important', date: '2024-01-01' };
        const local = [makeBook({ id: 'b1', bookmarks: [bm], annotationsUpdatedAt: 1000 })];
        const incoming = [makeBook({ id: 'b1', bookmarks: [], annotationsUpdatedAt: 9999 })];
        const result = mergeBookSnapshots(local, incoming);
        expect(result[0].bookmarks).toHaveLength(0);
    });

    it('combines books that only exist in one source', () => {
        const local = [makeBook({ id: 'b1' })];
        const incoming = [makeBook({ id: 'b2', originalTitle: 'Foundation' })];
        expect(mergeBookSnapshots(local, incoming)).toHaveLength(2);
    });

    it('uses the newest favorite state, including false', () => {
        const local = [makeBook({ id: 'b1', isFav: true, metadataUpdatedAt: 1000 })];
        const incoming = [makeBook({ id: 'b1', isFav: false, metadataUpdatedAt: 2000 })];
        const result = mergeBookSnapshots(local, incoming);
        expect(result[0].isFav).toBe(false);
    });

    it('uses the newest finished state, including false', () => {
        const local = [makeBook({ id: 'b1', isFinished: true, progressUpdatedAt: 1000 })];
        const incoming = [makeBook({ id: 'b1', isFinished: false, progressUpdatedAt: 2000 })];
        const result = mergeBookSnapshots(local, incoming);
        expect(result[0].isFinished).toBe(false);
    });

    it('allows newer metadata to clear nullable fields', () => {
        const local = [makeBook({
            id: 'b1',
            category: 'Sci-Fi',
            customCover: 'data:image/png;base64,AAAA',
            readerPreferences: { fontSize: 120 },
            metadataUpdatedAt: 1000,
        })];
        const incoming = [makeBook({
            id: 'b1',
            category: null,
            customCover: null,
            readerPreferences: null,
            metadataUpdatedAt: 2000,
        })];
        const result = mergeBookSnapshots(local, incoming);
        expect(result[0].category).toBeNull();
        expect(result[0].customCover).toBeNull();
        expect(result[0].readerPreferences).toBeNull();
    });

    it('matches books by title+author when ids differ', () => {
        const local = [makeBook({ id: 'old-id', originalTitle: 'Dune', originalAuthor: 'Herbert' })];
        const incoming = [makeBook({ id: 'new-id', originalTitle: 'Dune', originalAuthor: 'Herbert', progress: 60 })];
        const result = mergeBookSnapshots(local, incoming);
        expect(result).toHaveLength(1);
    });
});

// ─── mergeBackupData ────────────────────────────────────────────────────────

describe('mergeBackupData', () => {
    const base = {
        books: [makeBook({ id: 'b1', readingMinutes: 30 })],
        categories: ['Sci-Fi'],
        stats: { timeRead: 50, streak: 5, minutesByDay: { 'Mon Jan 01 2024': 10 } },
        user: { name: 'Alice' },
        workshop: null,
    };

    it('merges book lists', () => {
        const incoming = { ...base, books: [makeBook({ id: 'b2', originalTitle: 'Foundation' })] };
        const result = mergeBackupData(base, incoming);
        expect(result.books).toHaveLength(2);
    });

    it('unions categories', () => {
        const incoming = { ...base, categories: ['Fantasy'] };
        const result = mergeBackupData(base, incoming);
        expect(result.categories).toContain('Sci-Fi');
        expect(result.categories).toContain('Fantasy');
    });

    it('filters out "favoritos" from merged categories', () => {
        const incoming = { ...base, categories: ['Favoritos', 'Fantasy'] };
        const result = mergeBackupData(base, incoming);
        expect(result.categories).not.toContain('Favoritos');
    });

    it('takes max for numeric stats', () => {
        const incoming = { ...base, stats: { timeRead: 100, streak: 3, minutesByDay: {} } };
        const result = mergeBackupData(base, incoming);
        expect(result.stats.timeRead).toBe(100);
        expect(result.stats.streak).toBe(5);
    });

    it('merges minutesByDay with Math.max per day', () => {
        const dayKey = 'Mon Jan 01 2024';
        const local = { ...base, stats: { minutesByDay: { [dayKey]: 20 } } };
        const incoming = { ...base, stats: { minutesByDay: { [dayKey]: 35 } } };
        const result = mergeBackupData(local, incoming);
        expect(result.stats.minutesByDay[dayKey]).toBe(35);
    });

    it('preserves days only in one source', () => {
        const local = { ...base, stats: { minutesByDay: { 'Day A': 10 } } };
        const incoming = { ...base, stats: { minutesByDay: { 'Day B': 20 } } };
        const result = mergeBackupData(local, incoming);
        expect(result.stats.minutesByDay['Day A']).toBe(10);
        expect(result.stats.minutesByDay['Day B']).toBe(20);
    });

    it('prefers incoming user when non-empty', () => {
        const incoming = { ...base, user: { name: 'Bob' } };
        const result = mergeBackupData(base, incoming);
        expect(result.user.name).toBe('Bob');
    });

    it('falls back to local user when incoming is empty', () => {
        const incoming = { ...base, user: {} };
        const result = mergeBackupData(base, incoming);
        expect(result.user.name).toBe('Alice');
    });

    it('does not resurrect a book deleted after its last update', () => {
        const local = {
            ...base,
            books: [],
            deletedBooks: { b1: 5000 },
        };
        const incoming = {
            ...base,
            books: [makeBook({ id: 'b1', updatedAt: 3000 })],
        };
        const result = mergeBackupData(local, incoming);
        expect(result.books).toHaveLength(0);
        expect(result.deletedBooks.b1).toBe(5000);
    });

    it('allows a deliberately newer reimport to supersede an old tombstone', () => {
        const local = {
            ...base,
            books: [],
            deletedBooks: { b1: 5000 },
        };
        const incoming = {
            ...base,
            books: [makeBook({
                id: 'b1',
                updatedAt: 6000,
                metadataUpdatedAt: 6000,
                progressUpdatedAt: 6000,
            })],
        };
        expect(mergeBackupData(local, incoming).books).toHaveLength(1);
    });

    it('keeps reader preferences from the newest metadata version', () => {
        const local = {
            ...base,
            books: [makeBook({
                id: 'b1',
                metadataUpdatedAt: 100,
                readerPreferences: { fontFamily: 'Georgia', fontSize: 110 },
            })],
        };
        const incoming = {
            ...base,
            books: [makeBook({
                id: 'b1',
                metadataUpdatedAt: 200,
                readerPreferences: { fontFamily: 'Lora', fontSize: 125 },
            })],
        };
        const result = mergeBackupData(local, incoming);
        expect(result.books[0].readerPreferences).toEqual({ fontFamily: 'Lora', fontSize: 125 });
    });

    it('unions achievements unlocked on either side', () => {
        const local = { ...base, achievements: { first_open: { unlockedAt: 1000 } } };
        const incoming = { ...base, achievements: { library_5: { unlockedAt: 2000 } } };
        const result = mergeBackupData(local, incoming);
        expect(result.achievements.first_open.unlockedAt).toBe(1000);
        expect(result.achievements.library_5.unlockedAt).toBe(2000);
    });

    it('keeps the earlier unlockedAt when both sides have the same achievement', () => {
        const local = { ...base, achievements: { first_open: { unlockedAt: 5000 } } };
        const incoming = { ...base, achievements: { first_open: { unlockedAt: 1000 } } };
        const result = mergeBackupData(local, incoming);
        expect(result.achievements.first_open.unlockedAt).toBe(1000);
    });

    it('picks workshop from the side with the newer settingsUpdatedAt', () => {
        const local = { ...base, workshop: { addons: { sharkyMascot: true } }, settingsUpdatedAt: 1000 };
        const incoming = { ...base, workshop: { addons: { sharkyMascot: false } }, settingsUpdatedAt: 2000 };
        const result = mergeBackupData(local, incoming);
        expect(result.workshop).toEqual({ addons: { sharkyMascot: false } });
        expect(result.settingsUpdatedAt).toBe(2000);
    });

    it('keeps local workshop when it has the newer settingsUpdatedAt', () => {
        const local = { ...base, workshop: { addons: { sharkyMascot: true } }, settingsUpdatedAt: 9000 };
        const incoming = { ...base, workshop: { addons: { sharkyMascot: false } }, settingsUpdatedAt: 2000 };
        const result = mergeBackupData(local, incoming);
        expect(result.workshop).toEqual({ addons: { sharkyMascot: true } });
    });
});

// ─── buildPortableBackup ────────────────────────────────────────────────────

describe('buildPortableBackup', () => {
    it('builds a valid backup object', () => {
        const backup = buildPortableBackup({
            books: [makeBook()],
            categories: ['Sci-Fi'],
            stats: { timeRead: 10 },
            user: { name: 'Alice' },
            workshop: null,
        });
        expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
        expect(backup.app).toBe('SharkReader');
        expect(backup.books).toHaveLength(1);
        expect(backup.categories).toContain('Sci-Fi');
        expect(backup.exportedAt).toBeTruthy();
    });

    it('leaves collections undefined (not []) when omitted, for safe selective exports', () => {
        // Un export selectivo (Fase 6) puede querer omitir `collections` a
        // propósito para que ese campo quede ausente y applyBackupObject no lo
        // toque al restaurar. Si defaulteara a [], Array.isArray([]) === true
        // borraría las colecciones del usuario en cualquier restauración
        // parcial que no las incluyera — por eso este campo NO debe defaultear.
        const backup = buildPortableBackup({ books: [makeBook()], categories: ['Sci-Fi'] });
        expect(backup.collections).toBeUndefined();
    });

    it('merging a backup with itself is idempotent for books', () => {
        const backup = buildPortableBackup({
            books: [makeBook({ id: 'b1', progress: 55 })],
            categories: [],
            stats: {},
            user: {},
            workshop: null,
        });
        const merged = mergeBackupData(backup, backup);
        expect(merged.books).toHaveLength(1);
        expect(merged.books[0].progress).toBe(55);
    });

    it('does not advance timestamps when merging the same snapshot repeatedly', () => {
        const backup = buildPortableBackup({
            books: [makeBook({ id: 'b1', updatedAt: 5000, metadataUpdatedAt: 5000, progressUpdatedAt: 5000 })],
            categories: [],
            stats: {},
            user: {},
            workshop: null,
        });
        const first = mergeBackupData(backup, backup);
        const second = mergeBackupData(first, first);
        expect(second.books[0].updatedAt).toBe(first.books[0].updatedAt);
        expect(second.books[0].metadataUpdatedAt).toBe(first.books[0].metadataUpdatedAt);
        expect(second.books[0].progressUpdatedAt).toBe(first.books[0].progressUpdatedAt);
    });
});
