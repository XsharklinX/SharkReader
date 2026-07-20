import { describe, expect, it } from 'vitest';
import { computeBackupDiff } from './backupDiff';

const book = (overrides = {}) => ({
    id: 'b1', originalTitle: 'Dune', originalAuthor: 'Herbert', type: 'epub',
    file: { name: 'dune.epub', size: 1000 },
    updatedAt: 100, metadataUpdatedAt: 100, progressUpdatedAt: 100, annotationsUpdatedAt: 100,
    ...overrides,
});

describe('computeBackupDiff', () => {
    it('cuenta un libro incoming que no existe localmente como nuevo', () => {
        const diff = computeBackupDiff([], { books: [book()] });
        expect(diff.newBooks).toBe(1);
        expect(diff.updatedBooks).toBe(0);
        expect(diff.unchangedBooks).toBe(0);
        expect(diff.totalIncomingBooks).toBe(1);
    });

    it('cuenta un libro incoming más nuevo que el local como actualizado', () => {
        const local = [book({ updatedAt: 100 })];
        const incoming = [book({ updatedAt: 500 })];
        const diff = computeBackupDiff(local, { books: incoming });
        expect(diff.updatedBooks).toBe(1);
        expect(diff.newBooks).toBe(0);
    });

    it('cuenta un libro incoming igual o más viejo como sin cambios', () => {
        const local = [book({ updatedAt: 500 })];
        const incoming = [book({ updatedAt: 100 })];
        const diff = computeBackupDiff(local, { books: incoming });
        expect(diff.unchangedBooks).toBe(1);
        expect(diff.updatedBooks).toBe(0);
    });

    it('identifica el mismo libro por título+autor aunque cambie el id', () => {
        const local = [book({ id: 'local-id', file: { name: 'a.epub', size: 1 } })];
        const incoming = [book({ id: 'other-id', file: { name: 'b.epub', size: 2 }, updatedAt: 999 })];
        const diff = computeBackupDiff(local, { books: incoming });
        expect(diff.updatedBooks).toBe(1);
        expect(diff.newBooks).toBe(0);
    });

    it('reporta cuántos tombstones de borrado trae el backup', () => {
        const diff = computeBackupDiff([], { deletedBooks: { a: 1, b: 2 } });
        expect(diff.deletedBooks).toBe(2);
    });

    it('reporta qué secciones opcionales trae el backup', () => {
        const diff = computeBackupDiff([], {
            categories: ['Sci-Fi'],
            collections: [{ id: 'c1', name: 'Favoritos' }],
            workshop: { addons: {} },
            stats: { streak: 1 },
            user: { name: 'Ana' },
            achievements: { first_open: { unlockedAt: 1 } },
        });
        expect(diff.hasCategories).toBe(true);
        expect(diff.hasCollections).toBe(true);
        expect(diff.hasWorkshop).toBe(true);
        expect(diff.hasStats).toBe(true);
        expect(diff.hasUser).toBe(true);
        expect(diff.hasAchievements).toBe(true);
        expect(diff.achievementCount).toBe(1);
    });

    it('marca las secciones opcionales como ausentes cuando no vienen', () => {
        const diff = computeBackupDiff([], {});
        expect(diff.hasCategories).toBe(false);
        expect(diff.hasCollections).toBe(false);
        expect(diff.hasWorkshop).toBe(false);
        expect(diff.hasStats).toBe(false);
        expect(diff.hasUser).toBe(false);
        expect(diff.hasAchievements).toBe(false);
    });

    it('no lanza con un backup vacío', () => {
        expect(() => computeBackupDiff([], {})).not.toThrow();
        expect(() => computeBackupDiff([], undefined)).not.toThrow();
    });
});
