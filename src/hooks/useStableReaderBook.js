import { useMemo, useRef } from 'react';

const isSameReaderBookSnapshot = (previous, next) => {
    if (!previous || !next) return previous === next;
    return previous.id === next.id
        && previous.name === next.name
        && previous.author === next.author
        && previous.type === next.type
        && previous.file === next.file
        && previous.url === next.url
        && previous.pdfScale === next.pdfScale
        && previous.coverUrl === next.coverUrl
        && previous.tags === next.tags
        && previous.series === next.series
        && previous.seriesIndex === next.seriesIndex
        && previous.readingMinutes === next.readingMinutes
        && previous.bookmarks === next.bookmarks
        && previous.metadataUpdatedAt === next.metadataUpdatedAt;
};

export function useStableReaderBook(book) {
    const snapshotRef = useRef(null);

    return useMemo(() => {
        if (!book) {
            snapshotRef.current = null;
            return null;
        }
        if (isSameReaderBookSnapshot(snapshotRef.current, book)) {
            return snapshotRef.current;
        }
        snapshotRef.current = book;
        return book;
    }, [book]);
}
