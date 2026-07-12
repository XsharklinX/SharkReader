import { describe, it, expect } from 'vitest';
import { filterCommands, filterBooksForPalette } from './commandPaletteSearch';

const COMMANDS = [
    { id: 'go-library', label: 'Ir a la Biblioteca', keywords: 'biblioteca library inicio home' },
    { id: 'open-settings', label: 'Abrir Configuración', keywords: 'configuracion ajustes settings opciones' },
    { id: 'theme-dark', label: 'Tema oscuro', keywords: 'tema oscuro dark modo noche' },
];

describe('filterCommands', () => {
    it('sin query devuelve todos los comandos', () => {
        expect(filterCommands('', COMMANDS)).toEqual(COMMANDS);
        expect(filterCommands('   ', COMMANDS)).toEqual(COMMANDS);
    });

    it('matchea por label, insensible a mayúsculas', () => {
        const result = filterCommands('biblioteca', COMMANDS);
        expect(result.map(c => c.id)).toEqual(['go-library']);
    });

    it('matchea por keywords aunque no aparezcan en el label', () => {
        const result = filterCommands('ajustes', COMMANDS);
        expect(result.map(c => c.id)).toEqual(['open-settings']);
    });

    it('sin coincidencias devuelve vacío', () => {
        expect(filterCommands('xyz-no-existe', COMMANDS)).toEqual([]);
    });
});

const BOOKS = [
    { id: 'b1', name: 'Dune', author: 'Frank Herbert', loading: false },
    { id: 'b2', name: 'Fundación', author: 'Isaac Asimov', loading: false },
    { id: 'b3', name: 'Cargando...', author: '', loading: true },
];

describe('filterBooksForPalette', () => {
    it('sin query no devuelve libros (solo aparecen al buscar)', () => {
        expect(filterBooksForPalette('', BOOKS)).toEqual([]);
    });

    it('matchea por título', () => {
        const result = filterBooksForPalette('dune', BOOKS);
        expect(result).toHaveLength(1);
        expect(result[0].bookId).toBe('b1');
        expect(result[0].label).toBe('Dune');
    });

    it('matchea por autor', () => {
        const result = filterBooksForPalette('asimov', BOOKS);
        expect(result.map(b => b.bookId)).toEqual(['b2']);
    });

    it('excluye libros en loading aunque coincidan', () => {
        const result = filterBooksForPalette('cargando', BOOKS);
        expect(result).toEqual([]);
    });

    it('respeta el límite de resultados', () => {
        const manyBooks = Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, name: `Libro ${i}`, author: 'Mismo Autor', loading: false }));
        const result = filterBooksForPalette('mismo autor', manyBooks, 6);
        expect(result).toHaveLength(6);
    });

    it('icono según tipo de libro', () => {
        const books = [{ id: 'p1', name: 'Un PDF', type: 'pdf', loading: false }, { id: 'e1', name: 'Un Epub', type: 'epub', loading: false }];
        const result = filterBooksForPalette('un', books);
        expect(result.find(b => b.bookId === 'p1').icon).toBe('📄');
        expect(result.find(b => b.bookId === 'e1').icon).toBe('📖');
    });

    it('hint incluye autor y progreso cuando hay autor', () => {
        const result = filterBooksForPalette('dune', [{ id: 'b1', name: 'Dune', author: 'Frank Herbert', progress: 42, loading: false }]);
        expect(result[0].hint).toBe('Frank Herbert · 42%');
    });

    it('hint es solo el progreso cuando no hay autor', () => {
        const result = filterBooksForPalette('sinautor', [{ id: 'b1', name: 'SinAutor', author: '', progress: 10, loading: false }]);
        expect(result[0].hint).toBe('10%');
    });
});
