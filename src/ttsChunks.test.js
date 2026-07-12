import { describe, it, expect } from 'vitest';
import { splitIntoSpeechChunks } from './ttsChunks';

describe('splitIntoSpeechChunks', () => {
    it('devuelve vacío para texto vacío o solo espacios', () => {
        expect(splitIntoSpeechChunks('')).toEqual([]);
        expect(splitIntoSpeechChunks('   ')).toEqual([]);
        expect(splitIntoSpeechChunks(null)).toEqual([]);
    });

    it('un párrafo corto de una frase queda en un solo trozo', () => {
        const chunks = splitIntoSpeechChunks('Esta es una frase corta.');
        expect(chunks).toEqual(['Esta es una frase corta.']);
    });

    it('funde frases cortas consecutivas (diálogo) hasta el límite', () => {
        const text = '¿Qué haces? Nada. ¿Seguro? Sí, seguro.';
        const chunks = splitIntoSpeechChunks(text, 200);
        // Todo cabe en 200 chars, así que debería quedar fundido en un solo trozo
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toContain('¿Qué haces?');
        expect(chunks[0]).toContain('seguro.');
    });

    it('un párrafo largo se corta en varios trozos por límite de frases', () => {
        const sentence = 'Esta es una frase de longitud media para la prueba.';
        const text = Array(6).fill(sentence).join(' ');
        const chunks = splitIntoSpeechChunks(text, 100);
        expect(chunks.length).toBeGreaterThan(1);
        chunks.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(100 + sentence.length));
    });

    it('ningún trozo pierde texto: reconstruidos contienen todas las palabras', () => {
        const text = 'Primero. Segundo, con coma intermedia, y más texto. Tercero final.';
        const chunks = splitIntoSpeechChunks(text, 30);
        const rebuilt = chunks.join(' ').replace(/\s+/g, ' ');
        const originalWords = text.replace(/\s+/g, ' ').split(' ').sort();
        const rebuiltWords = rebuilt.split(' ').sort();
        expect(rebuiltWords).toEqual(originalWords);
    });

    it('una frase única enorme sin puntuación interna se corta por comas', () => {
        const sentence = 'Uno, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez, once, doce, trece.';
        const chunks = splitIntoSpeechChunks(sentence, 30);
        expect(chunks.length).toBeGreaterThan(1);
        chunks.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(30 + 10));
    });

    it('un texto sin ninguna puntuación se envuelve por palabras como último recurso', () => {
        const words = Array(30).fill('palabra').join(' ');
        const chunks = splitIntoSpeechChunks(words, 40);
        expect(chunks.length).toBeGreaterThan(1);
        chunks.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(40));
    });

    it('normaliza espacios múltiples y saltos de línea', () => {
        const chunks = splitIntoSpeechChunks('Hola   mundo.\n\nOtra   frase.');
        expect(chunks.join(' ')).not.toMatch(/\s{2,}/);
    });

    it('respeta signos de apertura españoles (¿ ¡) como inicio de nueva frase', () => {
        const chunks = splitIntoSpeechChunks('Terminó el capítulo. ¿Empezamos el siguiente?', 200);
        expect(chunks).toHaveLength(1); // cabe en el límite, pero el split interno debe reconocerlo
        expect(chunks[0]).toContain('¿Empezamos');
    });
});
