import React, { useMemo, useState } from 'react';
import { Icons } from './icons';
import { useHighlightLabels } from './highlightLabels';
import { getReadingRecommendations } from './readingRecommendations';
import { detectSeriesCandidates } from './seriesDetection';
import { findAnnotationConnections } from './annotationConnections';
import { findDuplicateBookGroups } from './bookModel';
import { useModalA11y } from './hooks/useModalA11y';

const TABS = [
    { id: 'recommend', label: 'Qué leer', icon: '✨' },
    { id: 'series', label: 'Series', icon: '📚' },
    { id: 'duplicates', label: 'Duplicados', icon: '🧹' },
    { id: 'connections', label: 'Anotaciones', icon: '🔗' },
];

const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString() : '—';

export default function LibraryIntelligenceModal({ books, onClose, onOpenBook, onApplySeries, onDeleteBooks }) {
    const [tab, setTab] = useState('recommend');
    const highlightLabels = useHighlightLabels();
    const getColorLabel = (color) => highlightLabels[color] || color;

    const recommendations = useMemo(() => getReadingRecommendations(books, { limit: 6 }), [books]);
    const seriesCandidates = useMemo(() => detectSeriesCandidates(books), [books]);
    const duplicateGroups = useMemo(() => findDuplicateBookGroups(books), [books]);
    const connections = useMemo(() => findAnnotationConnections(books, { getColorLabel }), [books, highlightLabels]);

    const openAndClose = (id) => { onOpenBook?.(id); onClose?.(); };
    const dialogRef = useModalA11y(true, onClose);

    return (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 backdrop-blur-sm fade-in p-4" onClick={onClose}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Inteligencia de biblioteca" tabIndex={-1}
                className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl shadow-2xl border outline-none"
                style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                onClick={e => e.stopPropagation()}>

                <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                    <h2 className="font-black text-lg">✨ Biblioteca inteligente</h2>
                    <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-full opacity-50 hover:opacity-100 transition">
                        <Icons.Close />
                    </button>
                </div>

                <div className="flex gap-1 px-4 pt-3 flex-shrink-0 overflow-x-auto">
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition flex-shrink-0 ${tab === t.id ? 'text-white' : 'opacity-60 hover:opacity-100 bg-black/5 dark:bg-white/5'}`}
                            style={tab === t.id ? { backgroundColor: 'var(--highlight)' } : {}}>
                            <span>{t.icon}</span> {t.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {tab === 'recommend' && (
                        recommendations.length === 0 ? (
                            <EmptyState text="No hay libros sin empezar para recomendar ahora mismo." />
                        ) : (
                            <div className="space-y-2">
                                {recommendations.map(({ book, reason }) => (
                                    <button key={book.id} onClick={() => openAndClose(book.id)}
                                        className="w-full flex items-center gap-3 p-3 rounded-2xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition">
                                        <div className="w-10 h-14 rounded-md overflow-hidden shadow flex-shrink-0 bg-cover bg-center flex items-center justify-center text-white text-[8px] font-bold text-center p-0.5"
                                            style={{ backgroundImage: book.coverUrl ? `url(${book.coverUrl})` : 'none', backgroundColor: book.color }}>
                                            {!book.coverUrl && book.name}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm truncate">{book.name}</p>
                                            <p className="text-[11px] opacity-50 truncate">{book.author}</p>
                                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--highlight)' }}>{reason}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )
                    )}

                    {tab === 'series' && (
                        seriesCandidates.length === 0 ? (
                            <EmptyState text="No se detectaron series sin agrupar. Si un libro tiene un número al final del título (ej. «Nombre 2»), aparecerá aquí." />
                        ) : (
                            <div className="space-y-3">
                                {seriesCandidates.map((group, i) => (
                                    <div key={i} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-color)' }}>
                                        <div className="flex items-center justify-between mb-2 gap-2">
                                            <div className="min-w-0">
                                                <p className="font-black text-sm truncate">{group.suggestedName}</p>
                                                <p className="text-[11px] opacity-50 truncate">{group.author}</p>
                                            </div>
                                            <button onClick={() => onApplySeries?.(group)}
                                                className="px-3 py-1.5 rounded-lg text-[11px] font-black text-white flex-shrink-0 hover:opacity-80 transition"
                                                style={{ backgroundColor: 'var(--highlight)' }}>
                                                Agrupar
                                            </button>
                                        </div>
                                        <ul className="space-y-1">
                                            {group.books.map(b => (
                                                <li key={b.id} className="text-xs opacity-70 flex items-center gap-2">
                                                    <span className="font-black opacity-50">#{b.detectedIndex}</span> {b.name}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {tab === 'duplicates' && (
                        duplicateGroups.length === 0 ? (
                            <EmptyState text="No se encontraron duplicados en tu biblioteca." />
                        ) : (
                            <div className="space-y-3">
                                {duplicateGroups.map((group, i) => (
                                    <div key={i} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-color)' }}>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">
                                            {group.reason === 'file' ? 'Mismo archivo' : 'Mismo título y autor'}
                                        </p>
                                        <ul className="space-y-1.5">
                                            {group.books.map(b => (
                                                <li key={b.id} className="flex items-center justify-between gap-2 text-xs">
                                                    <span className="truncate flex-1">{b.name} <span className="opacity-40">· añadido {fmtDate(b.dateAdded)}</span></span>
                                                    <button onClick={() => onDeleteBooks?.([b.id])}
                                                        className="px-2 py-1 rounded-lg text-[10px] font-black bg-red-500/15 text-red-500 hover:bg-red-500/25 transition flex-shrink-0">
                                                        Eliminar
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {tab === 'connections' && (
                        connections.colorConnections.length === 0 && connections.keywordConnections.length === 0 ? (
                            <EmptyState text="Subraya texto en varios libros para descubrir conexiones entre tus anotaciones." />
                        ) : (
                            <div className="space-y-4">
                                {connections.colorConnections.map((conn, i) => (
                                    <div key={`c-${i}`} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-color)' }}>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Misma categoría: {conn.label}</p>
                                        <ul className="space-y-1.5">
                                            {conn.entries.map(e => (
                                                <li key={e.id} className="text-xs">
                                                    <button onClick={() => openAndClose(e.bookId)} className="font-bold hover:underline" style={{ color: 'var(--highlight)' }}>{e.bookName}</button>
                                                    <span className="opacity-60"> — {e.text}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                                {connections.keywordConnections.map((conn, i) => (
                                    <div key={`k-${i}`} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-color)' }}>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Tema compartido: "{conn.keyword}"</p>
                                        <ul className="space-y-1.5">
                                            {conn.entries.map(e => (
                                                <li key={e.id} className="text-xs">
                                                    <button onClick={() => openAndClose(e.bookId)} className="font-bold hover:underline" style={{ color: 'var(--highlight)' }}>{e.bookName}</button>
                                                    <span className="opacity-60"> — {e.text}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

function EmptyState({ text }) {
    return <p className="text-sm opacity-50 text-center py-10 px-4 font-medium">{text}</p>;
}
