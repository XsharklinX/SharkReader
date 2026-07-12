// Lógica pura de anotaciones: normalización, aplanado y builders de export.
// Extraída de hooks/useBookActions.js para poder testearla sin React ni DOM.

export const HIGHLIGHT_COLOR_LABELS = {
    yellow: 'importante',
    green: 'idea',
    blue: 'duda',
    pink: 'cita',
};

export function normalizeAnnotationKind(bookmark = {}) {
    if (bookmark.kind === 'highlight' || bookmark.note?.includes('[Subrayado]')) return 'highlight';
    if (bookmark.kind === 'note') return 'note';
    return 'bookmark';
}

export function normalizeAnnotationText(bookmark = {}) {
    if (normalizeAnnotationKind(bookmark) === 'highlight') {
        return String(bookmark.note || '')
            .replace('[Subrayado] ', '')
            .replace(/^"|"$/g, '')
            .replace(/\.\.\.$/, '')
            .trim();
    }
    return String(bookmark.note || '').trim();
}

// Aplana los bookmarks de la biblioteca (o de un libro) en entradas de anotación.
// getColorLabel(color) resuelve la etiqueta de un color de highlight — inyectado
// para no acoplar este módulo a localStorage/highlightLabels.js.
export function buildAnnotationEntries(books, { bookId, getColorLabel } = {}) {
    const resolveColorLabel = getColorLabel || (color => HIGHLIGHT_COLOR_LABELS[color] || HIGHLIGHT_COLOR_LABELS.yellow);
    const scopedBooks = bookId
        ? books.filter(book => book.id === bookId)
        : books.filter(book => Array.isArray(book.bookmarks) && book.bookmarks.length > 0);

    return scopedBooks.flatMap(book =>
        (book.bookmarks || []).map((bookmark, index) => {
            const kind = normalizeAnnotationKind(bookmark);
            return {
                id: `${book.id}:${bookmark.cfi}:${bookmark.date || ''}:${index}`,
                bookId: book.id,
                bookName: book.name,
                bookAuthor: book.author,
                cfi: bookmark.cfi,
                date: bookmark.date || '',
                color: bookmark.color || 'yellow',
                colorLabel: kind === 'highlight' ? resolveColorLabel(bookmark.color || 'yellow') : '',
                kind,
                text: normalizeAnnotationText(bookmark),
                rawNote: bookmark.note || '',
            };
        })
    );
}

export function groupAnnotationsByBook(entries) {
    const grouped = entries.reduce((acc, entry) => {
        if (!acc[entry.bookId]) {
            acc[entry.bookId] = { bookId: entry.bookId, bookName: entry.bookName, bookAuthor: entry.bookAuthor, items: [] };
        }
        acc[entry.bookId].items.push(entry);
        return acc;
    }, {});
    return Object.values(grouped);
}

const sanitizeFileName = (name) => String(name)
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 64);

export function buildAnnotationExportFileName(booksWithMarks, fileNameOverride) {
    const fallback = booksWithMarks.length === 1 ? booksWithMarks[0].bookName : 'Mis_Anotaciones';
    return sanitizeFileName(fileNameOverride || fallback);
}

// Construye { content, mime, ext } para un formato de export dado. Pura: no
// toca el DOM (el caller decide cómo descargarlo). `scope` es el bookId si el
// export está acotado a un libro, o 'library' si es de toda la biblioteca.
export function buildAnnotationExportContent(booksWithMarks, format, scope = 'library') {
    if (format === 'md') {
        let content = '# Mis anotaciones — Shark Reader\n\n';
        booksWithMarks.forEach(book => {
            content += `## ${book.bookName}${book.bookAuthor ? ` — ${book.bookAuthor}` : ''}\n\n`;
            book.items.forEach(item => {
                if (item.kind === 'highlight') content += `> ${item.text}\n>\n> ${item.colorLabel ? `_${item.colorLabel}_ · ` : ''}${item.date}\n\n`;
                else if (item.kind === 'note') content += `- Nota: **${item.text || 'Sin texto'}** _(${item.date})_\n`;
                else content += `- Marcador: **${item.text || 'Sin texto'}** _(${item.date})_\n`;
            });
            content += '\n---\n\n';
        });
        return { content, mime: 'text/markdown', ext: 'md' };
    }

    if (format === 'html') {
        const sections = booksWithMarks.map(book => `
                <section>
                    <h2>${book.bookName}${book.bookAuthor ? ` — ${book.bookAuthor}` : ''}</h2>
                    <ul>
                        ${book.items.map(item => `<li><strong>${item.kind === 'highlight' ? 'Subrayado' : item.kind === 'note' ? 'Nota' : 'Marcador'}</strong>: ${item.text || 'Sin texto'}${item.colorLabel ? ` <em>(${item.colorLabel})</em>` : ''} <small>${item.date}</small></li>`).join('')}
                    </ul>
                </section>
            `).join('\n');
        const content = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Mis anotaciones</title><style>body{font-family:Segoe UI,system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px}section{background:#111827;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:20px;margin:0 0 18px}h1{color:#7dd3fc}h2{margin:0 0 12px}ul{padding-left:18px}li{margin:0 0 10px;line-height:1.5}small{opacity:.7}</style></head><body><h1>Mis anotaciones — Shark Reader</h1>${sections}</body></html>`;
        return { content, mime: 'text/html', ext: 'html' };
    }

    if (format === 'json') {
        const content = JSON.stringify({
            exportedAt: new Date().toISOString(),
            scope,
            books: booksWithMarks,
        }, null, 2);
        return { content, mime: 'application/json', ext: 'json' };
    }

    // txt (default)
    let content = 'SHARK READER - TUS ANOTACIONES\n\n';
    booksWithMarks.forEach(book => {
        content += `=========================================\n${book.bookName.toUpperCase()}${book.bookAuthor ? ` - ${book.bookAuthor}` : ''}\n=========================================\n\n`;
        book.items.forEach(item => {
            const kindLabel = item.kind === 'highlight' ? 'Subrayado' : item.kind === 'note' ? 'Nota' : 'Marcador';
            const colorLabel = item.colorLabel ? ` [${item.colorLabel}]` : '';
            content += `[${item.date}] ${kindLabel}${colorLabel} - ${item.text || 'Sin texto'}\n(CFI: ${item.cfi})\n\n`;
        });
    });
    return { content, mime: 'text/plain', ext: 'txt' };
}
