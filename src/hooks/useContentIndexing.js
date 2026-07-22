import { useEffect } from 'react';
import { buildBookContentIndex, CONTENT_INDEX_CACHE_PREFIX } from '../contentIndex';
import { saveCache, loadCacheByPrefix } from '../db';

// Indexación de contenido a demanda para la búsqueda "dentro del libro".
//
// RECONSTRUIDO tras pérdida del archivo. El índice sólo se construye cuando el
// usuario escribe algo en el buscador (deferredSearchTerm), porque extraer el
// texto de un EPUB/PDF es costoso. El resultado se cachea en IndexedDB
// (prefijo content-index:) para no repetirlo en cada sesión.
//
// Forma de cada entrada del mapa:  contentIndexMap[bookId] = { text }
// (consumida en useLibrary como `contentIndexMap[b.id]?.text`).

const cacheKeyFor = (bookId) => `${CONTENT_INDEX_CACHE_PREFIX}${bookId}`;

export function useContentIndexing({
    books,
    deferredSearchTerm,
    isDbLoaded,
    isStateHydrated,
    setContentIndexMap,
    booksRef,
    contentIndexQueueRef,
    contentIndexRunningRef,
    contentIndexMapRef,
    contentIndexQueuedRef,
}) {
    // Precarga de índices cacheados una vez que la DB está lista, para que la
    // primera búsqueda no tenga que reconstruir todo desde cero.
    useEffect(() => {
        if (!isDbLoaded) return;
        let cancelled = false;
        (async () => {
            const records = await loadCacheByPrefix(CONTENT_INDEX_CACHE_PREFIX);
            if (cancelled || !records.length) return;
            const validIds = new Set((booksRef.current || []).map(b => b.id));
            const restored = {};
            for (const { key, value } of records) {
                const bookId = key.slice(CONTENT_INDEX_CACHE_PREFIX.length);
                const text = typeof value === 'string' ? value : value?.text;
                if (bookId && validIds.has(bookId) && text) {
                    restored[bookId] = { text };
                }
            }
            if (!Object.keys(restored).length) return;
            contentIndexMapRef.current = { ...contentIndexMapRef.current, ...restored };
            setContentIndexMap(prev => ({ ...restored, ...prev }));
        })();
        return () => { cancelled = true; };
    }, [isDbLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

    // Procesa la cola de indexación de forma secuencial (un libro a la vez),
    // usando contentIndexRunningRef como lock para no solapar ejecuciones.
    const drainQueue = async () => {
        if (contentIndexRunningRef.current) return;
        contentIndexRunningRef.current = true;
        try {
            while (contentIndexQueueRef.current.length) {
                const bookId = contentIndexQueueRef.current.shift();
                contentIndexQueuedRef.current.delete(bookId);
                if (contentIndexMapRef.current[bookId]) continue;
                const book = (booksRef.current || []).find(b => b.id === bookId);
                if (!book) continue;
                let text = '';
                try {
                    text = await buildBookContentIndex(book);
                } catch (error) {
                    console.warn('[SharkReader] No se pudo indexar el contenido de', book?.name, error);
                }
                if (!text) continue;
                const entry = { text };
                contentIndexMapRef.current = { ...contentIndexMapRef.current, [bookId]: entry };
                setContentIndexMap(prev => ({ ...prev, [bookId]: entry }));
                saveCache(cacheKeyFor(bookId), { text }).catch(() => {});
            }
        } finally {
            contentIndexRunningRef.current = false;
        }
    };

    // Cuando hay un término de búsqueda activo, encola los libros que todavía no
    // tengan índice y lanza el procesamiento.
    useEffect(() => {
        if (!isDbLoaded || !isStateHydrated) return;
        if (!deferredSearchTerm || !deferredSearchTerm.trim()) return;
        const pending = (books || []).filter(book =>
            book?.file &&
            !contentIndexMapRef.current[book.id] &&
            !contentIndexQueuedRef.current.has(book.id)
        );
        if (!pending.length) return;
        for (const book of pending) {
            contentIndexQueuedRef.current.add(book.id);
            contentIndexQueueRef.current.push(book.id);
        }
        drainQueue();
    }, [deferredSearchTerm, books, isDbLoaded, isStateHydrated]); // eslint-disable-line react-hooks/exhaustive-deps
}

export default useContentIndexing;
