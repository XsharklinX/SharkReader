// Resumen local — sin IA. Construye un resumen extractivo a partir de los
// propios subrayados/notas del usuario en el libro, para que "Resumen del
// capítulo actual" siga aportando algo útil cuando no hay clave de IA
// configurada (o falla), en vez de un simple "activa la IA".
import { buildAnnotationEntries } from './annotationExport';

export function buildLocalSummary(book, { lang = 'es', maxItems = 6 } = {}) {
    if (!book) return null;
    const entries = buildAnnotationEntries([book], { bookId: book.id })
        .filter(entry => (entry.kind === 'highlight' || entry.kind === 'note') && entry.text);
    if (entries.length === 0) return null;

    // Más recientes primero — son las más relevantes a "hasta dónde vas".
    const picked = [...entries]
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, maxItems)
        .reverse();

    const header = lang === 'en'
        ? `I don't have AI configured, but here's a summary from your own highlights and notes in "${book.name}":`
        : `No tengo IA configurada, pero aquí tienes un resumen a partir de tus propios subrayados y notas de "${book.name}":`;
    const lines = picked.map(entry => `• ${entry.text}`);
    const footer = lang === 'en'
        ? '(Based only on what you already marked — configure an AI provider in Settings for a real generated summary.)'
        : '(Basado solo en lo que ya marcaste — configura un proveedor de IA en Ajustes para un resumen generado de verdad.)';

    return [header, '', ...lines, '', footer].join('\n');
}
