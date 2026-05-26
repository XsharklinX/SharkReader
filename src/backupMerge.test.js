import { describe, it, expect, beforeEach } from 'vitest';
import { mergeBookSnapshots, mergeBackupData, buildPortableBackup } from './backupMerge';

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

    it('does not lose bookmarks from local when incoming has newer metadata', () => {
        const bm = { cfi: 'cfi1', note: 'Important', date: '2024-01-01' };
        const local = [makeBook({ id: 'b1', bookmarks: [bm], metadataUpdatedAt: 1000 })];
        const incoming = [makeBook({ id: 'b1', bookmarks: [], metadataUpdatedAt: 9999 })];
        const result = mergeBookSnapshots(local, incoming);
        expect(result[0].bookmarks).toHaveLength(1);
    });

    it('combines books that only exist in one source', () => {
        const local = [makeBook({ id: 'b1' })];
        const incoming = [makeBook({ id: 'b2', originalTitle: 'Foundation' })];
        expect(mergeBookSnapshots(local, incoming)).toHaveLength(2);
    });

    it('takes isFav true if either source has it', () => {
        const local = [makeBook({ id: 'b1', isFav: true })];
        const incoming = [makeBook({ id: 'b1', isFav: false })];
        const result = mergeBookSnapshots(local, incoming);
        expect(result[0].isFav).toBe(true);
    });

    it('takes isFinished true if either source has it', () => {
        const local = [makeBook({ id: 'b1', isFinished: false })];
        const incoming = [makeBook({ id: 'b1', isFinished: true })];
        const result = mergeBookSnapshots(local, incoming);
        expect(result[0].isFinished).toBe(true);
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
        expect(backup.schemaVersion).toBe(2);
        expect(backup.app).toBe('SharkReader');
        expect(backup.books).toHaveLength(1);
        expect(backup.categories).toContain('Sci-Fi');
        expect(backup.exportedAt).toBeTruthy();
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
});
