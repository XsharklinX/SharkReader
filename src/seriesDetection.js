// src/seriesDetection.js
// Detecta series sin agrupar: libros cuyo título termina en un número (o
// "Vol. N", "Libro N", "#N", "- N") y comparten un mismo título base + autor.
// El usuario luego confirma la agrupación (LibraryIntelligenceModal → Agrupar).
//
// RECONSTRUIDO tras pérdida del archivo. Devuelve
//   [{ suggestedName, author, books: [{ id, name, detectedIndex }] }]

const norm = (value) => String(value || '').trim().toLowerCase();

// Separa "Título base" y el número final. Soporta:
//   "Nombre 2" · "Nombre #2" · "Nombre - 2" · "Nombre Vol 2" · "Nombre Libro 2"
//   "Nombre Parte 2" · "Nombre Tomo 2" · números romanos simples (I-XX)
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
// Captura "<base> <número>" y, aparte, una palabra de volumen final que sólo se
// quita si aún queda base (así "Libro 1" conserva base "Libro").
const TAIL_RE = /^(.*?)[\s.,:_#-]*(\d{1,3}|[ivx]{1,4})\s*$/i;
const VOLUME_WORD_RE = /[\s.,:_#-]*(?:vol\.?|volumen|libro|book|parte|part|tomo|no\.?|n\.?º?)$/i;

function parseTitle(rawTitle) {
    const title = String(rawTitle || '').trim();
    if (!title) return null;
    const match = title.match(TAIL_RE);
    if (!match) return null;
    const token = match[2].toLowerCase();
    const index = /^\d+$/.test(token) ? parseInt(token, 10) : ROMAN[token];
    if (!Number.isFinite(index) || index <= 0) return null;

    let base = match[1].trim();
    const stripped = base.replace(VOLUME_WORD_RE, '').trim();
    if (stripped.length >= 2) base = stripped; // "Cosmos Vol. 1" → "Cosmos"
    if (!base || base.length < 2) return null;  // pero no dejamos base vacía
    return { base, index };
}

export function detectSeriesCandidates(books = []) {
    const list = Array.isArray(books) ? books.filter(Boolean) : [];
    const groups = new Map();

    for (const book of list) {
        if (book.loading) continue;
        // Si ya tiene serie asignada, está agrupado — no lo sugerimos.
        if (String(book.series || '').trim()) continue;
        const title = book.name || book.originalTitle || '';
        const parsed = parseTitle(title);
        if (!parsed) continue;

        const author = book.author || book.originalAuthor || '';
        const key = `${norm(parsed.base)}|${norm(author)}`;
        if (!groups.has(key)) {
            groups.set(key, { suggestedName: parsed.base, author, books: [], seen: new Set() });
        }
        const group = groups.get(key);
        group.books.push({ id: book.id, name: title, detectedIndex: parsed.index });
        group.seen.add(parsed.index);
    }

    return Array.from(groups.values())
        // Una "serie" necesita al menos 2 libros con números distintos.
        .filter(group => group.books.length >= 2 && group.seen.size >= 2)
        .map(({ suggestedName, author, books: groupBooks }) => ({
            suggestedName,
            author,
            books: groupBooks.slice().sort((a, b) => a.detectedIndex - b.detectedIndex),
        }))
        .sort((a, b) => a.suggestedName.localeCompare(b.suggestedName));
}

export default detectSeriesCandidates;
