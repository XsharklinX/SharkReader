import { describe, expect, it } from 'vitest';
import {
    findBooksMissingCovers,
    findBooksWithCorruptedMetadata,
    findOrphanedFiles,
    scanLibraryIssues,
} from './libraryRepair';

const book = (overrides = {}) => ({
    id: 'b1', name: 'Dune', originalTitle: 'Dune', type: 'epub', progress: 20,
    coverBase64: 'data:image/jpeg;base64,AAAA', readingMinutes: 30,
    ...overrides,
});

describe('findBooksMissingCovers', () => {
    it('marca libros sin coverBase64 ni customCover', () => {
        const books = [book({ coverBase64: null, customCover: null })];
        expect(findBooksMissingCovers(books)).toHaveLength(1);
    });

    it('no marca libros con customCover aunque falte coverBase64', () => {
        const books = [book({ coverBase64: null, customCover: 'data:image/jpeg;base64,BBBB' })];
        expect(findBooksMissingCovers(books)).toHaveLength(0);
    });

    it('ignora libros en carga', () => {
        const books = [book({ coverBase64: null, loading: true })];
        expect(findBooksMissingCovers(books)).toHaveLength(0);
    });
});

describe('findBooksWithCorruptedMetadata', () => {
    it('no marca un libro válido sin autor (autor desconocido es legítimo)', () => {
        const books = [book({ author: undefined, originalAuthor: undefined })];
        expect(findBooksWithCorruptedMetadata(books)).toHaveLength(0);
    });

    it('marca un libro sin id', () => {
        expect(findBooksWithCorruptedMetadata([book({ id: '' })])).toHaveLength(1);
    });

    it('marca un libro sin título', () => {
        expect(findBooksWithCorruptedMetadata([book({ name: '', originalTitle: '' })])).toHaveLength(1);
    });

    it('marca un tipo de libro inválido', () => {
        expect(findBooksWithCorruptedMetadata([book({ type: 'mobi' })])).toHaveLength(1);
    });

    it('marca progreso fuera de 0-100', () => {
        expect(findBooksWithCorruptedMetadata([book({ progress: 150 })])).toHaveLength(1);
        expect(findBooksWithCorruptedMetadata([book({ progress: -5 })])).toHaveLength(1);
        expect(findBooksWithCorruptedMetadata([book({ progress: NaN })])).toHaveLength(1);
    });

    it('marca readingMinutes negativo o no numérico', () => {
        expect(findBooksWithCorruptedMetadata([book({ readingMinutes: -10 })])).toHaveLength(1);
    });

    it('no marca un libro completamente sano', () => {
        expect(findBooksWithCorruptedMetadata([book()])).toHaveLength(0);
    });
});

describe('findOrphanedFiles', () => {
    it('detecta un archivo sin libro correspondiente', () => {
        const books = [book({ id: 'b1' })];
        const fileRecords = [{ id: 'b1', file: { name: 'dune.epub' } }, { id: 'orphan-1', file: { name: 'ghost.epub' } }];
        const orphans = findOrphanedFiles(books, fileRecords);
        expect(orphans).toHaveLength(1);
        expect(orphans[0].id).toBe('orphan-1');
    });

    it('devuelve vacío si todos los archivos tienen libro', () => {
        const books = [book({ id: 'b1' })];
        const fileRecords = [{ id: 'b1', file: { name: 'dune.epub' } }];
        expect(findOrphanedFiles(books, fileRecords)).toHaveLength(0);
    });
});

describe('scanLibraryIssues', () => {
    it('agrupa los cuatro tipos de hallazgo', () => {
        const books = [
            book({ id: 'b1', coverBase64: null, customCover: null }),
            book({ id: 'b2', name: 'Dune', file: { name: 'dune.epub', size: 100 } }),
            book({ id: 'b3', name: 'Dune', file: { name: 'dune.epub', size: 100 } }),
        ];
        const fileRecords = [{ id: 'orphan-1', file: { name: 'ghost.epub' } }];
        const result = scanLibraryIssues(books, fileRecords);
        expect(result.missingCovers).toHaveLength(1);
        expect(result.duplicateGroups.length).toBeGreaterThan(0);
        expect(result.orphanedFiles).toHaveLength(1);
        expect(result.corruptedMetadata).toEqual([]);
    });
});
