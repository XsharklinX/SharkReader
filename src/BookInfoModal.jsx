import React from 'react';
import { Icons } from './icons';

const toDateInputValue = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const fromDateInputValue = (value) => {
    if (!value) return null;
    const parsed = new Date(`${value}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

export default function BookInfoModal({ book, onChange, onClose, onSave, onMarkFinished, onRestoreOriginal, onToggleCollection, onCreateCollection, coverInputRef, customCategories, manualCollections = [], t }) {
    if (!book) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm fade-in" onClick={onClose} onWheel={e => e.stopPropagation()}>
            <div className="bg-[var(--surface-bg)] w-full max-w-4xl p-8 rounded-3xl shadow-2xl border border-[var(--border-color)] flex flex-col md:flex-row gap-8 relative max-h-[90vh] overflow-y-auto" style={{ overscrollBehavior: 'contain' }} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition"><Icons.Close /></button>
                <div className="flex flex-col items-center w-full md:w-1/3">
                    <div className="w-full aspect-[2/3] rounded-xl shadow-xl mb-4 flex items-center justify-center text-white text-center p-4 bg-cover bg-center"
                        style={{ backgroundImage: book.coverUrl ? `url(${book.coverUrl})` : 'none', backgroundColor: book.color }}>
                        {!book.coverUrl && <span className="font-bold">{book.name}</span>}
                    </div>
                    <div className="w-full mt-2">
                        <label className="text-[10px] font-bold opacity-40 uppercase tracking-widest block mb-1">{t.cover}</label>
                        <input className="w-full bg-black/5 dark:bg-white/5 p-2 text-xs rounded-lg border border-transparent focus:border-[var(--highlight)] outline-none transition"
                            value={book.coverUrl || ''} placeholder="https://..." onChange={e => onChange({ ...book, coverUrl: e.target.value })} />
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <button onClick={() => coverInputRef.current?.click()} className="rounded-xl bg-black/5 dark:bg-white/10 px-3 py-2 text-xs font-bold hover:bg-black/10 dark:hover:bg-white/20">Reemplazar portada</button>
                            <button onClick={onRestoreOriginal} className="rounded-xl bg-black/5 dark:bg-white/10 px-3 py-2 text-xs font-bold hover:bg-black/10 dark:hover:bg-white/20">Restaurar original</button>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full justify-center mt-4">
                        <span className="text-xs px-3 py-1.5 bg-slate-500/10 text-slate-600 dark:text-slate-300 rounded-lg uppercase font-bold tracking-wider">{book.type}</span>
                        <span className="text-xs px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg font-bold tracking-wider">{book.progress || 0}% Leído</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-3">
                        {[1,2,3,4,5].map(star => (
                            <button key={star} onClick={() => onChange({ ...book, rating: star === book.rating ? 0 : star })} className="text-2xl transition-transform hover:scale-125">
                                <span style={{ color: star <= (book.rating || 0) ? '#f59e0b' : 'rgba(128,128,128,0.3)' }}>★</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col w-full md:w-2/3">
                    <div className="space-y-4 flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">Título</label>
                                <input className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition font-bold"
                                    value={book.name} onChange={e => onChange({ ...book, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">Autor</label>
                                <input className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition font-semibold"
                                    value={book.author} onChange={e => onChange({ ...book, author: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">Serie</label>
                                <input className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition"
                                    value={book.series || ''} placeholder="Nombre de la serie..." onChange={e => onChange({ ...book, series: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">Nº en la serie</label>
                                <input type="number" min="0" className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition"
                                    value={book.seriesIndex || ''} placeholder="1" onChange={e => onChange({ ...book, seriesIndex: Number(e.target.value) })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-2">Colección</label>
                                <div className="flex flex-wrap gap-2">
                                    {customCategories.map(c => (
                                        <button key={c} onClick={() => onChange({ ...book, category: book.category === c ? null : c })}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${book.category === c ? 'bg-[var(--highlight)] text-white shadow-md' : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20'}`}>{c}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">{t.tags}</label>
                                <input className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition"
                                    value={book.tags || ''} placeholder="Ficción, Novela..." onChange={e => onChange({ ...book, tags: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <label className="text-xs font-bold opacity-40 uppercase tracking-widest block">Listas manuales</label>
                                <button onClick={() => onCreateCollection?.()} className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-1 text-[10px] font-black hover:bg-black/10 dark:hover:bg-white/20 transition">+ Nueva</button>
                            </div>
                            {manualCollections.length === 0 ? (
                                <div className="rounded-xl bg-black/5 dark:bg-white/5 px-3 py-2 text-xs opacity-55">TodavÃ­a no hay colecciones manuales.</div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {manualCollections.map(collection => {
                                        const selected = collection.bookIds?.includes(book.id);
                                        return (
                                            <button
                                                key={collection.id}
                                                onClick={() => onToggleCollection?.(book.id, collection.id)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${selected ? 'bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300 shadow-md' : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20'}`}
                                            >
                                                {collection.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">{t.publisher}</label>
                            <input className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition"
                                value={book.publisher || ''} placeholder="Editorial..." onChange={e => onChange({ ...book, publisher: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">Agregado</label>
                                <input
                                    type="date"
                                    className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition"
                                    value={toDateInputValue(book.dateAdded)}
                                    onChange={e => onChange({ ...book, dateAdded: fromDateInputValue(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">Inicio lectura</label>
                                <input
                                    type="date"
                                    className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition"
                                    value={toDateInputValue(book.dateStarted)}
                                    onChange={e => onChange({ ...book, dateStarted: fromDateInputValue(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">Fin lectura</label>
                                <input
                                    type="date"
                                    className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition"
                                    value={toDateInputValue(book.dateFinished)}
                                    onChange={e => onChange({ ...book, dateFinished: fromDateInputValue(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">{t.synopsis}</label>
                            <textarea className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition resize-none h-28 leading-relaxed"
                                value={book.description || ''} placeholder="Descripción..." onChange={e => onChange({ ...book, description: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold opacity-40 uppercase tracking-widest block mb-1">📝 Mis notas</label>
                            <textarea className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition resize-none h-24 leading-relaxed"
                                value={book.notes || ''} placeholder="Tus notas personales sobre este libro..." onChange={e => onChange({ ...book, notes: e.target.value })} />
                        </div>
                    </div>
                    <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl">
                        <p className="text-[10px] font-black uppercase opacity-40 tracking-widest mb-3">📊 Estadísticas</p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            {[
                                { label: 'Tiempo leído', value: book.readingMinutes >= 60 ? `${Math.floor(book.readingMinutes / 60)}h ${book.readingMinutes % 60}m` : `${book.readingMinutes || 0} min` },
                                { label: 'Inicio', value: book.dateStarted ? new Date(book.dateStarted).toLocaleDateString() : '—' },
                                { label: 'Fin', value: book.dateFinished ? new Date(book.dateFinished).toLocaleDateString() : '—' }
                            ].map(s => (
                                <div key={s.label} className="bg-black/5 dark:bg-white/5 p-3 rounded-xl">
                                    <p className="text-[10px] opacity-50 font-bold uppercase tracking-wider">{s.label}</p>
                                    <p className="font-black mt-0.5">{s.value}</p>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => { onMarkFinished(book.id); onChange(p => ({ ...p, isFinished: !p.isFinished, progress: !p.isFinished ? 100 : p.progress })); }}
                            className={`w-full mt-3 py-2 rounded-xl font-bold text-sm transition ${book.isFinished ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'}`}>
                            {book.isFinished ? '✅ Terminado — clic para desmarcar' : '☑ Marcar como terminado'}
                        </button>
                        <button
                            onClick={() => onChange({ ...book, isWishlist: !book.isWishlist })}
                            className={`w-full mt-2 py-2 rounded-xl font-bold text-sm transition ${book.isWishlist ? 'bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'}`}
                        >
                            {book.isWishlist ? '💜 En wishlist — clic para quitar' : '🕒 Añadir a wishlist'}
                        </button>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button onClick={onClose} className="flex-1 bg-black/5 dark:bg-white/5 py-4 rounded-xl font-bold hover:opacity-80 transition">{t.cancel}</button>
                        <button onClick={onSave} disabled={!book.name?.trim()}
                            className="flex-1 bg-[var(--highlight)] text-white py-4 rounded-xl font-bold shadow-lg hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed">{t.save}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
