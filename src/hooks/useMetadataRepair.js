import { useEffect } from 'react';
import { extractEpubMeta } from '../epubMeta';
import { resizeCoverDataUrl } from '../coverResize';

// Reparación silenciosa de metadata en segundo plano.
//
// RECONSTRUIDO tras pérdida del archivo. Al arrancar, algunos libros pueden
// haber quedado sin portada (importaciones antiguas, extracción fallida, etc.).
// Este hook re-lee el EPUB y rellena la portada y los campos de metadata que
// estén vacíos, sin tocar nada que el usuario ya haya personalizado.
//
// - Sólo EPUB con `file` disponible y sin `coverBase64`.
// - `metadataRepairingRef` (Set) evita reprocesar el mismo libro.
// - Procesa de uno en uno para no cargar muchos archivos a la vez.

export function useMetadataRepair({
    isDbLoaded,
    isResettingRef,
    booksRef,
    metadataRepairingRef,
    bookPayloadsToFiles, // eslint-disable-line no-unused-vars
    setBooks,
}) {
    useEffect(() => {
        if (!isDbLoaded || isResettingRef.current) return;
        let cancelled = false;

        const needsCover = (book) =>
            book &&
            !book.loading &&
            book.type === 'epub' &&
            !book.coverBase64 &&
            !book.customCover &&
            book.file &&
            !metadataRepairingRef.current.has(book.id);

        const repairOne = async (book) => {
            metadataRepairingRef.current.add(book.id);
            let meta = null;
            try {
                meta = await extractEpubMeta(book.file);
            } catch (error) {
                console.warn('[SharkReader] Reparación de metadata falló para', book?.name, error);
            }
            if (cancelled || !meta) return;

            let cover = meta.coverBase64 || null;
            if (cover) {
                try {
                    cover = await resizeCoverDataUrl(cover);
                } catch (_) { /* si el resize falla, guardamos la portada original */ }
            }
            if (cancelled) return;

            // Sólo rellenamos huecos; nunca pisamos lo que el usuario editó.
            setBooks(prev => prev.map(b => {
                if (b.id !== book.id) return b;
                const patch = {};
                if (cover && !b.coverBase64) {
                    patch.coverBase64 = cover;
                    if (!b.customCover) patch.coverUrl = cover;
                }
                if (!b.description && meta.description) patch.description = meta.description;
                if (!b.publisher && meta.publisher) patch.publisher = meta.publisher;
                if ((!b.tags || !b.tags.trim()) && meta.subject) patch.tags = meta.subject;
                if (!Object.keys(patch).length) return b;
                const now = Date.now();
                return { ...b, ...patch, metadataUpdatedAt: now, updatedAt: now };
            }));
        };

        const run = async () => {
            const pending = (booksRef.current || []).filter(needsCover);
            for (const book of pending) {
                if (cancelled) break;
                await repairOne(book);
            }
        };

        // Pequeño respiro tras la hidratación para no competir con el render inicial.
        const timer = setTimeout(run, 1200);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [isDbLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}

export default useMetadataRepair;
