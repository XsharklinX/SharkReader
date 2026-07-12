// Trocea texto en unidades cortas de habla para TTS: divide por frases y funde
// las muy cortas (diálogos) hasta un tamaño objetivo, para que cada síntesis sea
// rápida y el reinicio (al cambiar voz/velocidad/motor) caiga cerca de donde iba
// el usuario en vez de repetir un párrafo entero.

const SENTENCE_SPLIT_RE = /(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"“(])/;
const CLAUSE_SPLIT_RE = /(?<=[,;:])\s+/;

function splitSentences(text) {
    return text.split(SENTENCE_SPLIT_RE).map(s => s.trim()).filter(Boolean);
}

function hardWrapByWords(text, maxLen) {
    const words = text.split(' ');
    const chunks = [];
    let current = '';
    words.forEach(word => {
        if (!current) { current = word; return; }
        if ((current + ' ' + word).length <= maxLen) current += ' ' + word;
        else { chunks.push(current); current = word; }
    });
    if (current) chunks.push(current);
    return chunks;
}

// Una frase que por sí sola supera maxLen se corta por comas/punto y coma;
// si ni así entra, se envuelve por palabras como último recurso.
function splitLongSentence(sentence, maxLen) {
    if (sentence.length <= maxLen) return [sentence];
    const pieces = sentence.split(CLAUSE_SPLIT_RE);
    const chunks = [];
    let current = '';
    pieces.forEach(piece => {
        if (!current) { current = piece; return; }
        if ((current + ' ' + piece).length <= maxLen) current += ' ' + piece;
        else { chunks.push(current); current = piece; }
    });
    if (current) chunks.push(current);
    return chunks.flatMap(chunk => chunk.length <= maxLen ? [chunk] : hardWrapByWords(chunk, maxLen));
}

// API pública: texto de un bloque (párrafo, li, etc.) → array de trozos hablables.
export function splitIntoSpeechChunks(text, maxLen = 200) {
    const clean = (text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [];

    const sentences = splitSentences(clean);
    const merged = [];
    let buffer = '';
    sentences.forEach(sentence => {
        const candidate = buffer ? `${buffer} ${sentence}` : sentence;
        if (candidate.length <= maxLen) {
            buffer = candidate;
        } else {
            if (buffer) merged.push(buffer);
            buffer = sentence;
        }
    });
    if (buffer) merged.push(buffer);

    return merged.flatMap(chunk => chunk.length <= maxLen ? [chunk] : splitLongSentence(chunk, maxLen));
}
