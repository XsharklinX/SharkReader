import { describe, expect, it } from 'vitest';
import { buildPdfTtsBlocks, buildPdfTtsQueue } from './pdfTts';

// item de pdf.js: transform = [a,b,c,d,e,f], con e=x, f=y (desde abajo)
const item = (str, x, yFromBottom, width, height = 10) => ({
    str, width, height, transform: [height, 0, 0, height, x, yFromBottom],
});

const PW = 100, PH = 200;

describe('buildPdfTtsBlocks', () => {
    it('agrupa items de la misma línea y los ordena de arriba abajo', () => {
        const blocks = buildPdfTtsBlocks([
            item('Otra', 5, 150, 40),
            item('Hola', 5, 180, 20),
            item('mundo', 30, 180, 25),
        ], PW, PH);
        expect(blocks.map(b => b.text)).toEqual(['Hola mundo', 'Otra']);
    });

    it('normaliza el rect a 0..1 con el origen arriba-izquierda', () => {
        const [block] = buildPdfTtsBlocks([item('Hola', 5, 180, 20, 10)], PW, PH);
        // top = 200 - 180 - 10 = 10  →  yp = 0.05 ; xp = 5/100 = 0.05
        expect(block.rect.xp).toBeCloseTo(0.05, 5);
        expect(block.rect.yp).toBeCloseTo(0.05, 5);
        expect(block.rect.wp).toBeCloseTo(0.2, 5);
        expect(block.rect.hp).toBeCloseTo(0.05, 5);
    });

    it('descarta items vacíos', () => {
        expect(buildPdfTtsBlocks([item('   ', 0, 100, 5)], PW, PH)).toEqual([]);
    });
});

describe('buildPdfTtsQueue', () => {
    const blocks = [
        { text: 'Primera línea corta.', rect: { xp: 0, yp: 0, wp: 1, hp: 0.1 } },
        { text: 'Segunda línea corta.', rect: { xp: 0, yp: 0.1, wp: 1, hp: 0.1 } },
    ];

    it('une líneas cuando caben bajo maxLen y une sus rects', () => {
        const [chunk, ...rest] = buildPdfTtsQueue(blocks, 200);
        expect(rest).toHaveLength(0);
        expect(chunk.text).toBe('Primera línea corta. Segunda línea corta.');
        expect(chunk.rect.hp).toBeCloseTo(0.2, 5); // unión vertical de ambas
    });

    it('separa en varios chunks cuando maxLen es pequeño', () => {
        const queue = buildPdfTtsQueue(blocks, 25);
        expect(queue.length).toBeGreaterThan(1);
        expect(queue.every(c => c.text.length <= 25)).toBe(true);
    });

    it('trocea un bloque más largo que maxLen respetando el límite', () => {
        const long = [{ text: 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce', rect: { xp: 0, yp: 0, wp: 1, hp: 0.1 } }];
        const queue = buildPdfTtsQueue(long, 20);
        expect(queue.every(c => c.text.length <= 20)).toBe(true);
        expect(queue.map(c => c.text).join(' ')).toContain('doce');
    });

    it('no lanza ante entradas vacías', () => {
        expect(buildPdfTtsQueue()).toEqual([]);
        expect(buildPdfTtsQueue([])).toEqual([]);
    });
});
