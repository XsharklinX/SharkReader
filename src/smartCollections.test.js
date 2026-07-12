import { describe, it, expect } from 'vitest';
import { matchesSmartRule, smartCollectionBookIds } from './smartCollections';

const DAY = 86400000;

describe('matchesSmartRule', () => {
    it('tag: coincide por substring, insensible a mayúsculas', () => {
        const book = { tags: 'Fantasía, Épico' };
        expect(matchesSmartRule(book, { type: 'tag', value: 'fantas' })).toBe(true);
        expect(matchesSmartRule(book, { type: 'tag', value: 'terror' })).toBe(false);
    });

    it('tag: regla sin valor no matchea nada', () => {
        expect(matchesSmartRule({ tags: 'algo' }, { type: 'tag', value: '' })).toBe(false);
    });

    it('author: coincidencia exacta insensible a mayúsculas', () => {
        const book = { author: 'Isaac Asimov' };
        expect(matchesSmartRule(book, { type: 'author', value: 'isaac asimov' })).toBe(true);
        expect(matchesSmartRule(book, { type: 'author', value: 'Isaac' })).toBe(false);
    });

    it('progressBelow: compara progreso numérico', () => {
        expect(matchesSmartRule({ progress: 5 }, { type: 'progressBelow', value: 10 })).toBe(true);
        expect(matchesSmartRule({ progress: 15 }, { type: 'progressBelow', value: 10 })).toBe(false);
        expect(matchesSmartRule({}, { type: 'progressBelow', value: 10 })).toBe(true); // progress undefined -> 0
    });

    it('progressBelow: valor no numérico no matchea', () => {
        expect(matchesSmartRule({ progress: 5 }, { type: 'progressBelow', value: 'no-numero' })).toBe(false);
    });

    it('addedWithinDays: dentro de la ventana', () => {
        const now = Date.now();
        const book = { dateAdded: now - 5 * DAY };
        expect(matchesSmartRule(book, { type: 'addedWithinDays', value: 30 }, now)).toBe(true);
        expect(matchesSmartRule(book, { type: 'addedWithinDays', value: 3 }, now)).toBe(false);
    });

    it('addedWithinDays: sin dateAdded no matchea', () => {
        expect(matchesSmartRule({}, { type: 'addedWithinDays', value: 30 })).toBe(false);
    });

    it('tipo de regla desconocido no matchea', () => {
        expect(matchesSmartRule({ tags: 'x' }, { type: 'nope', value: 'x' })).toBe(false);
    });

    it('sin regla o sin libro no matchea', () => {
        expect(matchesSmartRule(null, { type: 'tag', value: 'x' })).toBe(false);
        expect(matchesSmartRule({ tags: 'x' }, null)).toBe(false);
    });
});

describe('smartCollectionBookIds', () => {
    it('filtra la biblioteca completa por la regla y excluye libros en loading', () => {
        const books = [
            { id: '1', author: 'A', loading: false },
            { id: '2', author: 'B', loading: false },
            { id: '3', author: 'A', loading: true }, // en loading, se excluye aunque matchee
        ];
        const ids = smartCollectionBookIds(books, { type: 'author', value: 'A' });
        expect(ids).toEqual(['1']);
    });

    it('sin regla devuelve vacío', () => {
        expect(smartCollectionBookIds([{ id: '1' }], null)).toEqual([]);
    });
});
