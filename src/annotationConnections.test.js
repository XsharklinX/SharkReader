import { describe, expect, it } from 'vitest';
import { findAnnotationConnections } from './annotationConnections';

const hl = (text, color, cfi) => ({ cfi, kind: 'highlight', color, note: `[Subrayado] "${text}"` });
const book = (id, name, bookmarks) => ({ id, name, bookmarks });

describe('findAnnotationConnections', () => {
    it('conecta subrayados del mismo color en libros distintos', () => {
        const { colorConnections } = findAnnotationConnections([
            book('b1', 'Uno', [hl('idea A', 'green', 'c1')]),
            book('b2', 'Dos', [hl('idea B', 'green', 'c2')]),
        ], { getColorLabel: c => c === 'green' ? 'Idea' : c });
        expect(colorConnections).toHaveLength(1);
        expect(colorConnections[0].label).toBe('Idea');
        expect(colorConnections[0].entries.map(e => e.bookId).sort()).toEqual(['b1', 'b2']);
    });

    it('no conecta un color que sólo aparece en un libro', () => {
        const { colorConnections } = findAnnotationConnections([
            book('b1', 'Uno', [hl('a', 'blue', 'c1'), hl('b', 'blue', 'c2')]),
        ]);
        expect(colorConnections).toHaveLength(0);
    });

    it('detecta una palabra temática compartida entre libros', () => {
        const { keywordConnections } = findAnnotationConnections([
            book('b1', 'Uno', [hl('la filosofía antigua', 'yellow', 'c1')]),
            book('b2', 'Dos', [hl('sobre filosofía moderna', 'pink', 'c2')]),
        ]);
        const kws = keywordConnections.map(k => k.keyword);
        expect(kws).toContain('filosofia');
    });

    it('ignora bookmarks que no son subrayados', () => {
        const { colorConnections, keywordConnections } = findAnnotationConnections([
            book('b1', 'Uno', [{ cfi: 'c1', note: 'Página 3' }]),
            book('b2', 'Dos', [{ cfi: 'c2', kind: 'note', note: 'nota suelta' }]),
        ]);
        expect(colorConnections).toHaveLength(0);
        expect(keywordConnections).toHaveLength(0);
    });

    it('no lanza ante entradas vacías', () => {
        expect(() => findAnnotationConnections()).not.toThrow();
        expect(findAnnotationConnections([])).toEqual({ colorConnections: [], keywordConnections: [] });
    });
});
