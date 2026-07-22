import { describe, expect, it } from 'vitest';
import { detectSeriesCandidates } from './seriesDetection';

const book = (over = {}) => ({ id: Math.random().toString(36).slice(2), name: '', author: 'Autor', series: '', ...over });

describe('detectSeriesCandidates', () => {
    it('agrupa libros con número final del mismo autor', () => {
        const groups = detectSeriesCandidates([
            book({ id: 'a', name: 'Dune 1', author: 'Herbert' }),
            book({ id: 'b', name: 'Dune 2', author: 'Herbert' }),
            book({ id: 'c', name: 'Dune 3', author: 'Herbert' }),
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].suggestedName).toBe('Dune');
        expect(groups[0].books.map(b => b.detectedIndex)).toEqual([1, 2, 3]);
    });

    it('no agrupa si sólo hay un libro con número', () => {
        expect(detectSeriesCandidates([book({ name: 'Solo 1' })])).toHaveLength(0);
    });

    it('ignora libros que ya tienen serie asignada', () => {
        const groups = detectSeriesCandidates([
            book({ name: 'Saga 1', series: 'Saga' }),
            book({ name: 'Saga 2', series: 'Saga' }),
        ]);
        expect(groups).toHaveLength(0);
    });

    it('separa por autor distinto aunque el título base coincida', () => {
        const groups = detectSeriesCandidates([
            book({ name: 'Libro 1', author: 'Ana' }),
            book({ name: 'Libro 2', author: 'Ana' }),
            book({ name: 'Libro 1', author: 'Beto' }),
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].author).toBe('Ana');
    });

    it('reconoce variantes tipo "Vol. N" y "#N"', () => {
        const groups = detectSeriesCandidates([
            book({ name: 'Cosmos Vol. 1' }),
            book({ name: 'Cosmos #2' }),
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].books.map(b => b.detectedIndex)).toEqual([1, 2]);
    });

    it('no lanza ante entradas vacías', () => {
        expect(() => detectSeriesCandidates()).not.toThrow();
        expect(detectSeriesCandidates([])).toEqual([]);
    });
});
