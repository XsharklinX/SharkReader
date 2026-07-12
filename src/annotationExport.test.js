import { describe, it, expect } from 'vitest';
import {
    normalizeAnnotationKind,
    normalizeAnnotationText,
    buildAnnotationEntries,
    groupAnnotationsByBook,
    buildAnnotationExportFileName,
    buildAnnotationExportContent,
} from './annotationExport';

describe('normalizeAnnotationKind', () => {
    it('detecta highlight por kind explícito', () => {
        expect(normalizeAnnotationKind({ kind: 'highlight' })).toBe('highlight');
    });
    it('detecta highlight por el prefijo [Subrayado] en note (datos legacy)', () => {
        expect(normalizeAnnotationKind({ note: '[Subrayado] "una cita"' })).toBe('highlight');
    });
    it('detecta note', () => {
        expect(normalizeAnnotationKind({ kind: 'note' })).toBe('note');
    });
    it('cualquier otro caso cae en bookmark', () => {
        expect(normalizeAnnotationKind({ note: 'Página 42' })).toBe('bookmark');
        expect(normalizeAnnotationKind({})).toBe('bookmark');
    });
});

describe('normalizeAnnotationText', () => {
    it('limpia el prefijo, comillas y puntos suspensivos de un highlight', () => {
        const text = normalizeAnnotationText({ kind: 'highlight', note: '[Subrayado] "una cita literaria..."' });
        expect(text).toBe('una cita literaria');
    });
    it('devuelve el note tal cual (recortado) para notas/bookmarks', () => {
        expect(normalizeAnnotationText({ kind: 'note', note: '  una nota  ' })).toBe('una nota');
    });
});

const BOOK_A = {
    id: 'b1', name: 'Dune', author: 'Frank Herbert',
    bookmarks: [
        { cfi: 'cfi1', kind: 'highlight', color: 'yellow', note: '[Subrayado] "el miedo mata la mente"', date: '2026-01-01' },
        { cfi: 'cfi2', kind: 'note', note: 'Releer este capítulo', date: '2026-01-02' },
    ],
};
const BOOK_B = {
    id: 'b2', name: 'Fundación', author: 'Isaac Asimov',
    bookmarks: [{ cfi: 'cfi3', note: 'Marcador simple', date: '2026-01-03' }],
};
const BOOK_EMPTY = { id: 'b3', name: 'Sin anotar', author: 'X', bookmarks: [] };

describe('buildAnnotationEntries', () => {
    it('aplana los bookmarks de toda la biblioteca, saltando libros sin anotaciones', () => {
        const entries = buildAnnotationEntries([BOOK_A, BOOK_B, BOOK_EMPTY]);
        expect(entries).toHaveLength(3);
        expect(entries.map(e => e.bookId)).toEqual(['b1', 'b1', 'b2']);
    });

    it('acota a un solo libro con bookId', () => {
        const entries = buildAnnotationEntries([BOOK_A, BOOK_B], { bookId: 'b2' });
        expect(entries).toHaveLength(1);
        expect(entries[0].bookName).toBe('Fundación');
    });

    it('resuelve colorLabel solo para highlights, vía el callback inyectado', () => {
        const entries = buildAnnotationEntries([BOOK_A], { getColorLabel: () => 'Importante' });
        const highlight = entries.find(e => e.kind === 'highlight');
        const note = entries.find(e => e.kind === 'note');
        expect(highlight.colorLabel).toBe('Importante');
        expect(note.colorLabel).toBe('');
    });

    it('usa el fallback interno de color si no se inyecta getColorLabel', () => {
        const entries = buildAnnotationEntries([BOOK_A]);
        const highlight = entries.find(e => e.kind === 'highlight');
        expect(highlight.colorLabel).toBe('importante');
    });

    it('ids son estables y únicos por bookmark', () => {
        const entries = buildAnnotationEntries([BOOK_A]);
        const ids = new Set(entries.map(e => e.id));
        expect(ids.size).toBe(entries.length);
    });
});

describe('groupAnnotationsByBook', () => {
    it('agrupa entradas por bookId preservando nombre/autor', () => {
        const entries = buildAnnotationEntries([BOOK_A, BOOK_B]);
        const grouped = groupAnnotationsByBook(entries);
        expect(grouped).toHaveLength(2);
        const dune = grouped.find(g => g.bookId === 'b1');
        expect(dune.bookName).toBe('Dune');
        expect(dune.items).toHaveLength(2);
    });
});

describe('buildAnnotationExportFileName', () => {
    it('usa el nombre del único libro si solo hay uno', () => {
        const grouped = groupAnnotationsByBook(buildAnnotationEntries([BOOK_A]));
        expect(buildAnnotationExportFileName(grouped)).toBe('Dune');
    });
    it('usa "Mis_Anotaciones" si hay varios libros', () => {
        const grouped = groupAnnotationsByBook(buildAnnotationEntries([BOOK_A, BOOK_B]));
        expect(buildAnnotationExportFileName(grouped)).toBe('Mis_Anotaciones');
    });
    it('sanea caracteres inválidos de nombre de archivo y respeta el override', () => {
        // Cada carácter inválido se reemplaza por su propio '_' antes de colapsar
        // espacios, así que un inválido pegado a un espacio deja '__' — es el
        // comportamiento real del saneo, no un caso a "arreglar" aquí.
        expect(buildAnnotationExportFileName([], 'Mi:Archivo/Raro Simple')).toBe('Mi_Archivo_Raro_Simple');
        expect(buildAnnotationExportFileName([], 'Mi:Archivo/Raro? Con Espacios')).toBe('Mi_Archivo_Raro__Con_Espacios');
    });
});

describe('buildAnnotationExportContent', () => {
    const grouped = groupAnnotationsByBook(buildAnnotationEntries([BOOK_A], { getColorLabel: () => 'Importante' }));

    it('formato md incluye encabezado y cita en blockquote', () => {
        const { content, mime, ext } = buildAnnotationExportContent(grouped, 'md');
        expect(ext).toBe('md');
        expect(mime).toBe('text/markdown');
        expect(content).toContain('## Dune — Frank Herbert');
        expect(content).toContain('> el miedo mata la mente');
    });

    it('formato html genera secciones válidas por libro', () => {
        const { content, ext } = buildAnnotationExportContent(grouped, 'html');
        expect(ext).toBe('html');
        expect(content).toContain('<h2>Dune — Frank Herbert</h2>');
        expect(content).toContain('Releer este capítulo');
    });

    it('formato json incluye scope y libros', () => {
        const { content, ext } = buildAnnotationExportContent(grouped, 'json', 'b1');
        expect(ext).toBe('json');
        const parsed = JSON.parse(content);
        expect(parsed.scope).toBe('b1');
        expect(parsed.books).toHaveLength(1);
    });

    it('formato por defecto (txt) incluye el CFI de cada entrada', () => {
        const { content, ext, mime } = buildAnnotationExportContent(grouped, 'txt');
        expect(ext).toBe('txt');
        expect(mime).toBe('text/plain');
        expect(content).toContain('(CFI: cfi1)');
        expect(content).toContain('DUNE - Frank Herbert');
    });
});
