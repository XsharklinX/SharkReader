// src/readingRecommendations.js
// "¿Qué leo ahora?" — sugiere libros SIN EMPEZAR de la biblioteca, priorizando
// afinidades que ya demuestra el historial del usuario: autores que terminó o
// marcó como favoritos, series que dejó a medias, valoraciones altas y libros
// recién añadidos. Lógica pura (LibraryIntelligenceModal).
//
// RECONSTRUIDO tras pérdida del archivo. Devuelve [{ book, reason }].

const UNKNOWN_AUTHORS = new Set(['', 'autor desconocido', 'unknown', 'unknown author']);

const norm = (value) => String(value || '').trim().toLowerCase();

// Un libro está "sin empezar" si nunca se abrió y no tiene progreso ni se marcó
// como terminado.
const isUnstarted = (book) =>
    book &&
    !book.loading &&
    !book.isFinished &&
    Number(book.progress || 0) <= 1 &&
    !book.lastReadDate;

const isEngaged = (book) =>
    book && (book.isFinished || book.isFav || Number(book.progress || 0) > 1 || book.lastReadDate);

export function getReadingRecommendations(books = [], { limit = 6 } = {}) {
    const list = Array.isArray(books) ? books.filter(Boolean) : [];
    if (!list.length) return [];

    // Señales aprendidas del historial.
    const likedAuthors = new Map();   // autor -> peso
    const favAuthors = new Set();
    const seriesProgress = new Map(); // serie -> mayor seriesIndex ya empezado

    for (const book of list) {
        if (!isEngaged(book)) continue;
        const author = norm(book.author);
        if (author && !UNKNOWN_AUTHORS.has(author)) {
            let weight = 0;
            if (book.isFinished) weight += 3;
            if (book.isFav) { weight += 2; favAuthors.add(author); }
            if (Number(book.rating || 0) >= 4) weight += 2;
            if (book.lastReadDate) weight += 1;
            likedAuthors.set(author, (likedAuthors.get(author) || 0) + weight);
        }
        const series = norm(book.series);
        if (series) {
            seriesProgress.set(series, Math.max(seriesProgress.get(series) || 0, Number(book.seriesIndex || 0)));
        }
    }

    const scored = [];
    for (const book of list) {
        if (!isUnstarted(book)) continue;
        const author = norm(book.author);
        const series = norm(book.series);
        let score = 0;

        // Cada señal suma al score; la RAZÓN mostrada es la de mayor prioridad
        // que se cumpla (serie > favorito > autor favorito > valoración > autor
        // que te gustó > recién añadido), independientemente del orden de suma.
        const continuesSeries = series && seriesProgress.has(series)
            && Number(book.seriesIndex || 0) >= seriesProgress.get(series);
        if (continuesSeries) score += 10;

        const favAuthor = author && favAuthors.has(author);
        if (favAuthor) score += 6;
        else if (author && likedAuthors.has(author)) score += likedAuthors.get(author);

        if (book.isFav) score += 4;
        const highRating = Number(book.rating || 0) >= 4;
        if (highRating) score += 2;

        const ageDays = (Date.now() - Number(book.dateAdded || 0)) / 86400000;
        const isRecent = ageDays <= 14;
        if (isRecent) score += 1;

        let reason = 'Aún no lo has empezado';
        if (isRecent) reason = 'Añadido hace poco';
        if (author && likedAuthors.has(author) && !favAuthor && score >= 3) reason = `Te gustó otro libro de ${book.author}`;
        if (highRating) reason = 'Le pusiste buena valoración';
        if (favAuthor) reason = `De ${book.author}, uno de tus favoritos`;
        if (book.isFav) reason = 'Está en tus favoritos y sigue pendiente';
        if (continuesSeries) reason = `Continúa la serie «${book.series}»`;

        scored.push({ book, reason, score, dateAdded: Number(book.dateAdded || 0) });
    }

    scored.sort((a, b) => b.score - a.score || b.dateAdded - a.dateAdded);

    return scored.slice(0, Math.max(0, limit)).map(({ book, reason }) => ({ book, reason }));
}

export default getReadingRecommendations;
