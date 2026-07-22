import { describe, expect, it } from 'vitest';
import { getReadingRecommendations } from './readingRecommendations';

const book = (over = {}) => ({
    id: Math.random().toString(36).slice(2),
    name: 'Libro', author: 'Autor', series: '', seriesIndex: 0,
    progress: 0, isFinished: false, isFav: false, rating: 0, lastReadDate: 0,
    dateAdded: Date.now(), ...over,
});

describe('getReadingRecommendations', () => {
    it('sólo recomienda libros sin empezar', () => {
        const recs = getReadingRecommendations([
            book({ id: 'started', progress: 40, lastReadDate: Date.now() }),
            book({ id: 'done', isFinished: true }),
            book({ id: 'fresh' }),
        ]);
        const ids = recs.map(r => r.book.id);
        expect(ids).toContain('fresh');
        expect(ids).not.toContain('started');
        expect(ids).not.toContain('done');
    });

    it('prioriza continuar una serie ya iniciada', () => {
        const recs = getReadingRecommendations([
            book({ id: 'read1', series: 'Saga', seriesIndex: 1, isFinished: true }),
            book({ id: 'next2', series: 'Saga', seriesIndex: 2 }),
            book({ id: 'random', author: 'Otro' }),
        ]);
        expect(recs[0].book.id).toBe('next2');
        expect(recs[0].reason).toMatch(/serie/i);
    });

    it('respeta el límite pedido', () => {
        const books = Array.from({ length: 10 }, (_, i) => book({ id: `b${i}` }));
        expect(getReadingRecommendations(books, { limit: 3 })).toHaveLength(3);
    });

    it('no lanza sin libros', () => {
        expect(getReadingRecommendations([])).toEqual([]);
        expect(() => getReadingRecommendations()).not.toThrow();
    });
});
