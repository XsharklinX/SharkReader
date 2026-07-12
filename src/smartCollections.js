// Colecciones inteligentes: en vez de una lista fija de bookIds, una colección
// "smart" define una regla y su contenido se recalcula en vivo contra la
// biblioteca actual. Lógica pura y testeable, sin tocar React.

export const SMART_RULE_TYPES = [
    { id: 'tag', label: 'Etiqueta contiene', placeholder: 'ej. fantasía' },
    { id: 'author', label: 'Autor es', placeholder: 'ej. Isaac Asimov' },
    { id: 'progressBelow', label: 'Progreso menor que (%)', placeholder: 'ej. 10' },
    { id: 'addedWithinDays', label: 'Añadido en los últimos (días)', placeholder: 'ej. 30' },
];

const splitTags = (value) => String(value || '')
    .split(',')
    .map(tag => tag.trim().toLowerCase())
    .filter(Boolean);

// ¿Este libro cumple la regla de la colección inteligente?
export function matchesSmartRule(book, rule, now = Date.now()) {
    if (!rule || !book) return false;
    const value = rule.value;
    switch (rule.type) {
        case 'tag': {
            const needle = String(value || '').trim().toLowerCase();
            if (!needle) return false;
            return splitTags(book.tags).some(tag => tag.includes(needle));
        }
        case 'author': {
            const needle = String(value || '').trim().toLowerCase();
            if (!needle) return false;
            return (book.author || '').trim().toLowerCase() === needle;
        }
        case 'progressBelow': {
            const max = Number(value);
            if (!Number.isFinite(max)) return false;
            return (book.progress || 0) < max;
        }
        case 'addedWithinDays': {
            const days = Number(value);
            if (!Number.isFinite(days) || days <= 0) return false;
            if (!book.dateAdded) return false;
            return (now - book.dateAdded) <= days * 86400000;
        }
        default:
            return false;
    }
}

// IDs de los libros de la biblioteca que cumplen la regla ahora mismo.
export function smartCollectionBookIds(books, rule, now = Date.now()) {
    if (!rule) return [];
    return books
        .filter(book => !book?.loading && matchesSmartRule(book, rule, now))
        .map(book => book.id);
}

export function describeSmartRule(rule) {
    const template = SMART_RULE_TYPES.find(item => item.id === rule?.type);
    if (!template || !rule) return '';
    return `${template.label.replace(' (%)', '').replace(' (días)', '')}: ${rule.value}`;
}
