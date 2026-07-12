import React from 'react';
import { Icons } from './icons';

const fmtTime = (mins) => {
    const m = Math.round(mins || 0);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString() : '—';

const ROWS = [
    { label: 'Progreso', get: b => `${b.progress || 0}%`, best: (a, b) => (a.progress || 0) - (b.progress || 0) },
    { label: 'Tiempo leído', get: b => fmtTime(b.readingMinutes), best: (a, b) => (a.readingMinutes || 0) - (b.readingMinutes || 0) },
    { label: 'Anotaciones', get: b => String((b.bookmarks || []).length), best: (a, b) => (a.bookmarks || []).length - (b.bookmarks || []).length },
    { label: 'Valoración', get: b => b.rating ? '★'.repeat(b.rating) : '—', best: (a, b) => (a.rating || 0) - (b.rating || 0) },
    { label: 'Empezado', get: b => fmtDate(b.dateStarted), best: null },
    { label: 'Terminado', get: b => b.isFinished ? fmtDate(b.dateFinished) : '—', best: null },
];

export default function BookComparisonModal({ books, onClose }) {
    if (!books || books.length < 2) return null;
    return (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 backdrop-blur-sm fade-in p-4" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label="Comparación de libros"
                className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-3xl shadow-2xl border"
                style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-bg)' }}>
                    <h2 className="font-black text-lg">📊 Comparar libros</h2>
                    <button onClick={onClose} aria-label="Cerrar comparación" className="p-2 rounded-full opacity-50 hover:opacity-100 transition">
                        <Icons.Close />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ minWidth: `${books.length * 180 + 160}px` }}>
                        <thead>
                            <tr>
                                <th className="text-left text-[10px] font-black uppercase tracking-widest opacity-40 px-6 py-3 sticky left-0" style={{ backgroundColor: 'var(--surface-bg)' }}></th>
                                {books.map(book => (
                                    <th key={book.id} className="px-4 py-3 text-center align-top">
                                        <div className="w-16 h-24 mx-auto rounded-lg overflow-hidden shadow-lg bg-cover bg-center flex items-center justify-center text-white text-[10px] font-bold text-center p-1"
                                            style={{ backgroundImage: book.coverUrl ? `url(${book.coverUrl})` : 'none', backgroundColor: book.color }}>
                                            {!book.coverUrl && book.name}
                                        </div>
                                        <p className="mt-2 font-black text-xs leading-tight line-clamp-2">{book.name}</p>
                                        <p className="text-[10px] opacity-50 truncate mt-0.5">{book.author}</p>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ROWS.map(row => {
                                const values = books.map(b => row.get(b));
                                const bestIndex = row.best
                                    ? books.reduce((bestI, _, i) => (row.best(books[i], books[bestI]) > 0 ? i : bestI), 0)
                                    : -1;
                                const allEqual = values.every(v => v === values[0]);
                                return (
                                    <tr key={row.label} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                                        <td className="px-6 py-3 text-xs font-bold opacity-60 sticky left-0" style={{ backgroundColor: 'var(--surface-bg)' }}>{row.label}</td>
                                        {books.map((book, i) => (
                                            <td key={book.id} className="px-4 py-3 text-center text-sm font-semibold">
                                                <span className={!allEqual && i === bestIndex ? 'font-black' : ''} style={!allEqual && i === bestIndex ? { color: 'var(--highlight)' } : {}}>
                                                    {values[i]}
                                                    {!allEqual && i === bestIndex && ' 👑'}
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="text-[10px] opacity-40 text-center px-6 py-4">👑 marca el libro que va a la cabeza en cada métrica (cuando no hay empate).</p>
            </div>
        </div>
    );
}
