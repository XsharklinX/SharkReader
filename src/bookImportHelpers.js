// Construcción pura del registro inicial de un libro a partir de un File
// recién importado. Extraída de hooks/useBookImport.js para poder testearla
// sin depender de URL.createObjectURL ni del DOM.
export function buildNewBookRecord(file, { unknownAuthorLabel = 'Autor desconocido', id, color, now = Date.now() } = {}) {
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const type = /\.pdf$/i.test(file.name) ? 'pdf' : 'epub';
    const nativeMeta = type === 'epub' ? file.nativeMeta : null;
    const nativeTitle = (nativeMeta?.title || '').trim();
    const nativeAuthor = (nativeMeta?.creator || '').trim();
    return {
        id: id || (Date.now().toString() + Math.random().toString(36).substr(2, 5)),
        file,
        type,
        sourcePath: file.sourcePath || null,
        name: nativeTitle || baseName,
        author: nativeAuthor || unknownAuthorLabel,
        originalTitle: nativeTitle || baseName,
        originalAuthor: nativeAuthor || unknownAuthorLabel,
        description: nativeMeta?.description || '',
        publisher: nativeMeta?.publisher || '',
        tags: nativeMeta?.subject || '',
        series: '',
        seriesIndex: 0,
        coverUrl: nativeMeta?.coverBase64 || null,
        color: color || `hsl(${200 + Math.random() * 40}, 70%, 40%)`,
        isFav: false,
        rating: 0,
        progress: 0,
        lastLocation: null,
        dateAdded: now,
        lastReadDate: 0,
        bookmarks: [],
        category: null,
        notes: '',
        isFinished: false,
        dateStarted: null,
        dateFinished: null,
        readingMinutes: 0,
        loading: false,
        updatedAt: now,
        progressUpdatedAt: now,
        metadataUpdatedAt: now,
        annotationsUpdatedAt: now,
    };
}
