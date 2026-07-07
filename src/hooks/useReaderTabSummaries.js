import { useMemo, useRef } from 'react';

export function useReaderTabSummaries(tabs, booksById) {
    const cacheRef = useRef(new Map());
    const arrayRef = useRef([]);

    return useMemo(() => {
        const liveIds = new Set(tabs.map(tab => tab.bookId));
        const nextCache = new Map();

        tabs.forEach(tab => {
            const book = booksById.get(tab.bookId);
            if (!book) return;

            const previous = cacheRef.current.get(book.id);
            if (
                previous &&
                previous.name === book.name &&
                previous.author === book.author &&
                previous.type === book.type &&
                previous.coverUrl === book.coverUrl
            ) {
                nextCache.set(book.id, previous);
                return;
            }

            nextCache.set(book.id, {
                id: book.id,
                name: book.name,
                author: book.author,
                type: book.type,
                coverUrl: book.coverUrl,
            });
        });

        cacheRef.current.forEach((summary, id) => {
            if (liveIds.has(id) && !nextCache.has(id)) {
                nextCache.set(id, summary);
            }
        });

        cacheRef.current = nextCache;
        const nextArray = tabs.map(tab => nextCache.get(tab.bookId)).filter(Boolean);
        const previousArray = arrayRef.current;
        const sameArray = previousArray.length === nextArray.length
            && previousArray.every((item, index) => item === nextArray[index]);
        if (sameArray) return previousArray;
        arrayRef.current = nextArray;
        return nextArray;
    }, [booksById, tabs]);
}
