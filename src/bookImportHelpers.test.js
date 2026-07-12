import { describe, it, expect } from 'vitest';
import { buildNewBookRecord } from './bookImportHelpers';

function fakeFile(name, { nativeMeta, sourcePath } = {}) {
    return { name, nativeMeta, sourcePath };
}

describe('buildNewBookRecord', () => {
    it('detecta tipo pdf por extensión', () => {
        const record = buildNewBookRecord(fakeFile('report.pdf'));
        expect(record.type).toBe('pdf');
    });

    it('detecta tipo epub por defecto para cualquier otra extensión', () => {
        const record = buildNewBookRecord(fakeFile('book.epub'));
        expect(record.type).toBe('epub');
    });

    it('usa el nombre de archivo sin extensión como título si no hay metadata nativa', () => {
        const record = buildNewBookRecord(fakeFile('Mi Novela Genial.epub'));
        expect(record.name).toBe('Mi Novela Genial');
        expect(record.originalTitle).toBe('Mi Novela Genial');
    });

    it('prioriza título/autor de la metadata nativa del EPUB sobre el nombre de archivo', () => {
        const record = buildNewBookRecord(fakeFile('archivo_raro_123.epub', {
            nativeMeta: { title: 'El Título Real', creator: 'Autora Real', description: 'Sinopsis', publisher: 'Editorial X', subject: 'ficción', coverBase64: 'data:image/png;base64,xyz' },
        }));
        expect(record.name).toBe('El Título Real');
        expect(record.author).toBe('Autora Real');
        expect(record.description).toBe('Sinopsis');
        expect(record.publisher).toBe('Editorial X');
        expect(record.tags).toBe('ficción');
        expect(record.coverUrl).toBe('data:image/png;base64,xyz');
    });

    it('la metadata nativa se ignora para PDFs (solo aplica a epub)', () => {
        const record = buildNewBookRecord(fakeFile('doc.pdf', { nativeMeta: { title: 'No debería usarse' } }));
        expect(record.name).toBe('doc');
    });

    it('usa la etiqueta de autor desconocido cuando no hay autor', () => {
        const record = buildNewBookRecord(fakeFile('sin_autor.epub'), { unknownAuthorLabel: 'Autor desconocido' });
        expect(record.author).toBe('Autor desconocido');
    });

    it('respeta id/color/now inyectados para tests deterministas', () => {
        const now = 1700000000000;
        const record = buildNewBookRecord(fakeFile('x.epub'), { id: 'fixed-id', color: 'hsl(210, 70%, 40%)', now });
        expect(record.id).toBe('fixed-id');
        expect(record.color).toBe('hsl(210, 70%, 40%)');
        expect(record.dateAdded).toBe(now);
        expect(record.updatedAt).toBe(now);
        expect(record.progressUpdatedAt).toBe(now);
        expect(record.metadataUpdatedAt).toBe(now);
    });

    it('conserva sourcePath del archivo cuando existe', () => {
        const record = buildNewBookRecord(fakeFile('x.epub', { sourcePath: 'C:/libros/x.epub' }));
        expect(record.sourcePath).toBe('C:/libros/x.epub');
    });

    it('valores por defecto de un libro recién importado: sin progreso, sin terminar, no cargando', () => {
        const record = buildNewBookRecord(fakeFile('x.epub'));
        expect(record.progress).toBe(0);
        expect(record.isFinished).toBe(false);
        expect(record.loading).toBe(false);
        expect(record.bookmarks).toEqual([]);
        expect(record.rating).toBe(0);
    });
});
