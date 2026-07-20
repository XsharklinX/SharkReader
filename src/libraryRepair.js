// Reparador de biblioteca: detecta problemas que pueden acumularse con el
// tiempo (portadas que nunca se extrajeron, metadata dañada, duplicados,
// archivos huérfanos en IndexedDB) sin arreglarlos automáticamente — el
// usuario decide qué hacer con cada hallazgo. Lógica pura y testeable.
import { findDuplicateBookGroups } from './bookModel';

export function findBooksMissingCovers(books = []) {
    return books
        .filter(book => !book?.loading && !book.coverBase64 && !book.customCover)
        .map(book => ({ id: book.id, name: book.name || book.originalTitle || '(sin título)' }));
}

// "Dañada" = estructuralmente inválida (rompería la UI o el progreso), no
// simplemente "sin autor" — eso último es un valor de resguardo legítimo
// (UNKNOWN_AUTHOR_FALLBACK en bookModel.js), no corrupción.
export function findBooksWithCorruptedMetadata(books = []) {
    return books
        .filter(book => {
            if (!book || book.loading) return false;
            const title = String(book.name ?? book.originalTitle ?? '').trim();
            const progress = Number(book.progress);
            const readingMinutes = book.readingMinutes;
            return !book.id
                || !title
                || !['epub', 'pdf'].includes(book.type)
                || !Number.isFinite(progress) || progress < 0 || progress > 100
                || (readingMinutes != null && (!Number.isFinite(Number(readingMinutes)) || Number(readingMinutes) < 0));
        })
        .map(book => ({ id: book.id || '(sin id)', name: book.name || book.originalTitle || '(sin título)' }));
}

// `fileRecords` = registros del store de archivos (IndexedDB) — un archivo
// sin libro correspondiente quedó huérfano (el libro se borró pero el
// archivo, por alguna razón, no).
export function findOrphanedFiles(books = [], fileRecords = []) {
    const bookIds = new Set(books.filter(Boolean).map(book => book.id));
    return fileRecords
        .filter(record => record?.id && !bookIds.has(record.id))
        .map(record => ({ id: record.id, name: record.file?.name || record.originalTitle || record.id }));
}

export function scanLibraryIssues(books = [], fileRecords = []) {
    return {
        missingCovers: findBooksMissingCovers(books),
        corruptedMetadata: findBooksWithCorruptedMetadata(books),
        duplicateGroups: findDuplicateBookGroups(books),
        orphanedFiles: findOrphanedFiles(books, fileRecords),
    };
}
