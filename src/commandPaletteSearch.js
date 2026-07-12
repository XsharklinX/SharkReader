// Filtrado y coincidencia de la paleta de comandos (Ctrl+K). Extraído de
// CommandPalette.jsx para poder testearlo sin React ni los closures de acción.

// Comandos cuyo label o keywords contienen la búsqueda (o todos si no hay query).
export function filterCommands(query, commands) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(cmd => cmd.label.toLowerCase().includes(q) || cmd.keywords.includes(q));
}

// Libros cuyo título o autor coincide con la búsqueda. Vacío si no hay query
// (los libros solo aparecen cuando el usuario busca algo, no en el listado base).
export function filterBooksForPalette(query, books, limit = 6) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    return books
        .filter(book => !book.loading && (
            (book.name || '').toLowerCase().includes(q) ||
            (book.author || '').toLowerCase().includes(q)
        ))
        .slice(0, limit)
        .map(book => ({
            id: `book-${book.id}`,
            bookId: book.id,
            icon: book.type === 'pdf' ? '📄' : '📖',
            label: book.name,
            hint: book.author ? `${book.author} · ${book.progress || 0}%` : `${book.progress || 0}%`,
        }));
}
