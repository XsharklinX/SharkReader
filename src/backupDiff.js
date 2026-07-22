// src/backupDiff.js
// Resumen "antes de aplicar" de un backup entrante: cuántos libros son nuevos,
// cuántos actualizan a uno local, cuántos no cambian, cuántos borrados trae y
// qué secciones opcionales incluye. Lógica pura, para la vista previa de
// importación (BackupPreviewModal).
//
// RECONSTRUIDO tras pérdida del archivo. Reutiliza exactamente las mismas
// claves de identidad y el mismo criterio de "más nuevo" que backupMerge, para
// que el conteo previo coincida con lo que la fusión hará realmente.
import { getBookDedupKey, getBookTitleDedupKey } from './bookModel';
import { getBookMergeTimestamp } from './backupMerge';

const hasEntries = (value) =>
    !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;

const hasItems = (value) => Array.isArray(value) && value.length > 0;

export function computeBackupDiff(localBooks = [], backup = {}) {
    const safeBackup = backup && typeof backup === 'object' ? backup : {};
    const incomingBooks = Array.isArray(safeBackup.books) ? safeBackup.books : [];

    // Índice de la biblioteca local por las dos claves de identidad que usa la
    // fusión: por archivo (dedup) y por título+autor (aunque cambie el id).
    const localByKey = new Map();
    for (const book of localBooks || []) {
        if (!book) continue;
        const fileKey = getBookDedupKey(book);
        const titleKey = getBookTitleDedupKey(book);
        if (fileKey && !localByKey.has(fileKey)) localByKey.set(fileKey, book);
        if (titleKey && !localByKey.has(titleKey)) localByKey.set(titleKey, book);
    }

    let newBooks = 0;
    let updatedBooks = 0;
    let unchangedBooks = 0;

    for (const incoming of incomingBooks) {
        if (!incoming) continue;
        const match = localByKey.get(getBookDedupKey(incoming))
            || localByKey.get(getBookTitleDedupKey(incoming));
        if (!match) {
            newBooks += 1;
            continue;
        }
        if (getBookMergeTimestamp(incoming) > getBookMergeTimestamp(match)) {
            updatedBooks += 1;
        } else {
            unchangedBooks += 1;
        }
    }

    const achievementCount = hasEntries(safeBackup.achievements)
        ? Object.keys(safeBackup.achievements).length
        : 0;

    return {
        totalIncomingBooks: incomingBooks.length,
        newBooks,
        updatedBooks,
        unchangedBooks,
        deletedBooks: hasEntries(safeBackup.deletedBooks)
            ? Object.keys(safeBackup.deletedBooks).length
            : 0,
        hasCategories: hasItems(safeBackup.categories),
        hasCollections: hasItems(safeBackup.collections),
        hasWorkshop: hasEntries(safeBackup.workshop),
        hasStats: hasEntries(safeBackup.stats),
        hasUser: hasEntries(safeBackup.user),
        hasAchievements: achievementCount > 0,
        achievementCount,
    };
}

export default computeBackupDiff;
