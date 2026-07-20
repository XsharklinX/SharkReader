import React, { useState } from 'react';
import { Icons } from './icons';
import { useModalA11y } from './hooks/useModalA11y';

const TABS = [
    { id: 'covers', label: 'Portadas', icon: '🖼️' },
    { id: 'metadata', label: 'Metadata', icon: '⚠️' },
    { id: 'duplicates', label: 'Duplicados', icon: '🧹' },
    { id: 'orphans', label: 'Huérfanos', icon: '👻' },
];

export default function LibraryRepairModal({ scan, loading, onClose, onOpenBook, onFetchCover, onDeleteBooks, onDeleteOrphan, onRescan }) {
    const [tab, setTab] = useState('covers');
    const dialogRef = useModalA11y(!!scan, onClose);
    if (!scan) return null;

    const counts = {
        covers: scan.missingCovers.length,
        metadata: scan.corruptedMetadata.length,
        duplicates: scan.duplicateGroups.length,
        orphans: scan.orphanedFiles.length,
    };
    const totalIssues = counts.covers + counts.metadata + counts.duplicates + counts.orphans;

    return (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 backdrop-blur-sm fade-in p-4" onClick={onClose}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Reparador de biblioteca" tabIndex={-1}
                className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl shadow-2xl border outline-none"
                style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                onClick={e => e.stopPropagation()}>

                <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                    <div>
                        <h2 className="font-black text-lg">🔧 Reparador de biblioteca</h2>
                        <p className="text-[11px] opacity-50 mt-0.5">{totalIssues === 0 ? 'Todo en orden' : `${totalIssues} cosa(s) para revisar`}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={onRescan} disabled={loading} title="Volver a escanear"
                            className="p-2 rounded-full opacity-50 hover:opacity-100 transition disabled:opacity-20">
                            <Icons.Refresh />
                        </button>
                        <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-full opacity-50 hover:opacity-100 transition">
                            <Icons.Close />
                        </button>
                    </div>
                </div>

                <div className="flex gap-1 px-4 pt-3 flex-shrink-0 overflow-x-auto">
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition flex-shrink-0 ${tab === t.id ? 'text-white' : 'opacity-60 hover:opacity-100 bg-black/5 dark:bg-white/5'}`}
                            style={tab === t.id ? { backgroundColor: 'var(--highlight)' } : {}}>
                            <span>{t.icon}</span> {t.label} {counts[t.id] > 0 && <span className="opacity-70">{counts[t.id]}</span>}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {loading && <p className="text-center text-sm opacity-50 py-10">Escaneando…</p>}

                    {!loading && tab === 'covers' && (
                        scan.missingCovers.length === 0 ? <EmptyState text="Todos los libros tienen portada." /> : (
                            <div className="space-y-1.5">
                                {scan.missingCovers.map(item => (
                                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition">
                                        <button onClick={() => onOpenBook(item.id)} className="text-left text-sm font-semibold truncate flex-1 hover:underline">{item.name}</button>
                                        <button onClick={() => onFetchCover(item.id)}
                                            className="px-3 py-1.5 rounded-lg text-[11px] font-black text-white flex-shrink-0 hover:opacity-80 transition"
                                            style={{ backgroundColor: 'var(--highlight)' }}>
                                            Buscar portada
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {!loading && tab === 'metadata' && (
                        scan.corruptedMetadata.length === 0 ? <EmptyState text="No se detectó metadata dañada." /> : (
                            <div className="space-y-1.5">
                                {scan.corruptedMetadata.map(item => (
                                    <button key={item.id} onClick={() => onOpenBook(item.id)}
                                        className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition text-sm font-semibold truncate">
                                        {item.name} <span className="opacity-40 font-normal">· abrir y revisar</span>
                                    </button>
                                ))}
                            </div>
                        )
                    )}

                    {!loading && tab === 'duplicates' && (
                        scan.duplicateGroups.length === 0 ? <EmptyState text="No se encontraron duplicados." /> : (
                            <div className="space-y-3">
                                {scan.duplicateGroups.map((group, i) => (
                                    <div key={i} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-color)' }}>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">
                                            {group.reason === 'file' ? 'Mismo archivo' : 'Mismo título y autor'}
                                        </p>
                                        <ul className="space-y-1.5">
                                            {group.books.map(b => (
                                                <li key={b.id} className="flex items-center justify-between gap-2 text-xs">
                                                    <span className="truncate flex-1">{b.name}</span>
                                                    <button onClick={() => onDeleteBooks([b.id])}
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

                    {!loading && tab === 'orphans' && (
                        scan.orphanedFiles.length === 0 ? <EmptyState text="No hay archivos huérfanos." /> : (
                            <div className="space-y-1.5">
                                <p className="text-[11px] opacity-50 mb-2">Archivos guardados sin ningún libro asociado — probablemente de un borrado incompleto.</p>
                                {scan.orphanedFiles.map(item => (
                                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition">
                                        <span className="text-sm font-semibold truncate flex-1">{item.name}</span>
                                        <button onClick={() => onDeleteOrphan(item.id)}
                                            className="px-2 py-1 rounded-lg text-[10px] font-black bg-red-500/15 text-red-500 hover:bg-red-500/25 transition flex-shrink-0">
                                            Eliminar
                                        </button>
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
    return <p className="text-sm opacity-50 text-center py-10 px-4 font-medium">✓ {text}</p>;
}
