import { useCallback, useState } from 'react';

// Calcula el conjunto de libros elegibles y deja que el propio modal
// (BookRouletteModal) gire la rueda y elija — la rueda es puramente
// decorativa, el ganador se elige al azar de todo el pool.
export function useBookRouletteAddon({ config, books, api }) {
    const [rouletteBook, setRouletteBook] = useState(null);
    const [roulettePool, setRoulettePool] = useState(null);

    const spinBookRoulette = useCallback(() => {
        const cfg = config || {};
        let pool = api.library.listBooks(books);
        if (cfg.onlyUnread !== false) pool = pool.filter(b => !b.isFinished);
        if (cfg.onlyFavorites) pool = pool.filter(b => b.isFav);
        if (cfg.filterTag) {
            const tag = cfg.filterTag.toLowerCase();
            pool = pool.filter(b => String(b.tags || '').toLowerCase().includes(tag));
        }
        if (!pool.length) {
            api.notifications.notify('No hay libros disponibles para la ruleta.', 'warning');
            return;
        }
        setRouletteBook(null);
        setRoulettePool(pool);
    }, [config, books, api]);

    const handleRouletteResult = useCallback((book) => {
        setRouletteBook(book);
        api.sharky.bumpStat('rouletteSpins');
    }, [api]);

    const closeBookRoulette = useCallback(() => {
        setRoulettePool(null);
        setRouletteBook(null);
    }, []);

    return { rouletteBook, roulettePool, spinBookRoulette, handleRouletteResult, closeBookRoulette };
}
