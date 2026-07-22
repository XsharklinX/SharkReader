// src/annotationConnections.js
// Encuentra "puentes" entre las anotaciones de distintos libros:
//  · colorConnections  → subrayados del mismo color (misma categoría) en ≥2 libros
//  · keywordConnections → subrayados que comparten una palabra temática en ≥2 libros
// Lógica pura (LibraryIntelligenceModal → pestaña Anotaciones).
//
// RECONSTRUIDO tras pérdida del archivo. Devuelve
//   { colorConnections: [{ label, entries: [{ id, bookId, bookName, text }] }],
//     keywordConnections: [{ keyword, entries: [{ id, bookId, bookName, text }] }] }

// Un subrayado se guarda como bookmark con note "[Subrayado] \"texto\"..." y un
// color. Extraemos el texto limpio igual que hacen los exportadores.
const HIGHLIGHT_MARK = '[Subrayado]';

function extractHighlightText(note) {
    return String(note || '')
        .replace(HIGHLIGHT_MARK, '')
        .replace(/^\s*/, '')
        .replace(/^"(.*?)"\.\.\.$/, '$1')
        .replace(/^"(.*?)"$/, '$1')
        .replace(/\.\.\.$/, '')
        .trim();
}

const isHighlight = (bm) =>
    bm && (bm.kind === 'highlight' || (typeof bm.note === 'string' && bm.note.includes(HIGHLIGHT_MARK)));

// Palabras vacías (ES + EN) que no aportan tema.
const STOPWORDS = new Set([
    'el','la','los','las','un','una','unos','unas','de','del','al','a','ante','bajo','con','contra','desde','en','entre','hacia','hasta','para','por','segun','sin','sobre','tras','y','o','u','e','ni','que','se','su','sus','le','les','lo','me','mi','te','tu','nos','es','son','ser','fue','han','hay','como','mas','pero','porque','cuando','donde','muy','ya','no','si','este','esta','estos','estas','ese','esa','eso','esto','aquel','todo','toda','todos','todas','cada','tan','the','a','an','of','to','in','on','and','or','is','are','was','were','be','been','it','its','this','that','these','those','with','for','as','at','by','from','but','not','so','if','then','than','into','about','their','they','them','his','her','our','your',
]);

const COMBINING_MARKS = /[̀-ͯ]/g;

function extractKeywords(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD').replace(COMBINING_MARKS, '') // quita acentos para agrupar mejor
        .replace(/[^a-z0-9ñü\s]/gi, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 5 && !STOPWORDS.has(word));
}

export function findAnnotationConnections(books = [], { getColorLabel } = {}) {
    const list = Array.isArray(books) ? books.filter(Boolean) : [];
    const labelOf = typeof getColorLabel === 'function' ? getColorLabel : (c) => c;

    // Recolecta todos los subrayados con su libro.
    const entries = [];
    for (const book of list) {
        const bookmarks = Array.isArray(book.bookmarks) ? book.bookmarks : [];
        bookmarks.forEach((bm, i) => {
            if (!isHighlight(bm)) return;
            const text = extractHighlightText(bm.note);
            if (!text) return;
            entries.push({
                id: `${book.id}:${bm.cfi || i}`,
                bookId: book.id,
                bookName: book.name || book.originalTitle || '(sin título)',
                text,
                color: bm.color || 'yellow',
            });
        });
    }

    // ── Conexiones por color ──────────────────────────────────────────────
    const byColor = new Map();
    for (const entry of entries) {
        if (!byColor.has(entry.color)) byColor.set(entry.color, []);
        byColor.get(entry.color).push(entry);
    }
    const colorConnections = [];
    for (const [color, colorEntries] of byColor) {
        const distinctBooks = new Set(colorEntries.map(e => e.bookId));
        if (distinctBooks.size < 2) continue; // debe cruzar ≥2 libros
        colorConnections.push({
            color,
            label: labelOf(color),
            entries: colorEntries.map(({ id, bookId, bookName, text }) => ({ id, bookId, bookName, text })),
        });
    }

    // ── Conexiones por palabra temática ───────────────────────────────────
    const byKeyword = new Map();
    for (const entry of entries) {
        const seen = new Set(extractKeywords(entry.text)); // una vez por subrayado
        for (const keyword of seen) {
            if (!byKeyword.has(keyword)) byKeyword.set(keyword, []);
            byKeyword.get(keyword).push(entry);
        }
    }
    const keywordConnections = [];
    for (const [keyword, kwEntries] of byKeyword) {
        const distinctBooks = new Set(kwEntries.map(e => e.bookId));
        if (distinctBooks.size < 2) continue;
        keywordConnections.push({
            keyword,
            distinctBooks: distinctBooks.size,
            entries: kwEntries.map(({ id, bookId, bookName, text }) => ({ id, bookId, bookName, text })),
        });
    }
    // Las palabras que conectan más libros primero; como mucho unas pocas.
    keywordConnections.sort((a, b) => b.distinctBooks - a.distinctBooks || b.entries.length - a.entries.length);

    return {
        colorConnections,
        keywordConnections: keywordConnections.slice(0, 12).map(({ keyword, entries: e }) => ({ keyword, entries: e })),
    };
}

export default findAnnotationConnections;
