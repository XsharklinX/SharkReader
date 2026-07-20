import React, { useState } from 'react';
import { Icons } from './icons';
import { useHighlightLabels, setHighlightLabel, HIGHLIGHT_SWATCHES, HIGHLIGHT_LABEL_DEFAULTS } from './highlightLabels';
import { useModalA11y } from './hooks/useModalA11y';

const ANNOTATION_COLOR_META = {
    yellow: { label: 'Importante', swatch: '#facc15' },
    green: { label: 'Idea', swatch: '#22c55e' },
    blue: { label: 'Duda', swatch: '#3b82f6' },
    pink: { label: 'Cita', swatch: '#f472b6' },
};

// Nota y marcador no tienen color propio (a diferencia del subrayado, que
// hereda uno de los 4 colores del usuario) — se les da un acento fijo y
// distinto entre sí para que el tipo se reconozca de un vistazo, sin tener
// que leer la etiqueta de texto.
const NOTE_SWATCH = '#a78bfa';
const BOOKMARK_SWATCH = '#f59e0b';

// Color + icono + etiqueta de un tipo de anotación, resuelto por entrada
// (el subrayado usa el color que el propio usuario le puso).
function getEntryMeta(entry, highlightLabels) {
    if (entry.kind === 'highlight') {
        const colorMeta = ANNOTATION_COLOR_META[entry.color] || ANNOTATION_COLOR_META.yellow;
        return { swatch: colorMeta.swatch, label: highlightLabels[entry.color] || colorMeta.label, Icon: Icons.Highlighter };
    }
    if (entry.kind === 'note') return { swatch: NOTE_SWATCH, label: 'Nota', Icon: Icons.Notes };
    return { swatch: BOOKMARK_SWATCH, label: 'Marcador', Icon: Icons.Bookmark };
}

const KindBadge = ({ label, count, swatch }) => (
    <span
        className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
        style={{ backgroundColor: `${swatch}1c`, color: swatch }}>
        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: swatch }} />
        {label} {count}
    </span>
);

export default function AnnotationsModal({
    onClose,
    openBook,
    annotationSearch,
    setAnnotationSearch,
    annotationBookFilter,
    setAnnotationBookFilter,
    annotationBookOptions,
    annotationSummary,
    annotationGroups,
    exportAnnotations,
    exportSingleQuote,
    exportQuotesAsImage,
    addons,
    toggleBookmarkInApp,
    appliedTheme,
    t,
}) {
    const highlightLabels = useHighlightLabels();
    const [showLabelEditor, setShowLabelEditor] = useState(false);
    const dialogRef = useModalA11y(true, onClose);

    return (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 backdrop-blur-sm fade-in p-4" onClick={onClose}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Anotaciones" tabIndex={-1}
                className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl shadow-2xl border outline-none"
                style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                onClick={e => e.stopPropagation()}>

                <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                    <span className="font-black text-lg flex items-center gap-2">
                        <Icons.Bookmark /> Anotaciones
                    </span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => exportAnnotations('txt', annotationBookFilter === 'all' ? {} : { bookId: annotationBookFilter })} className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">.TXT</button>
                        <button onClick={() => exportAnnotations('md', annotationBookFilter === 'all' ? {} : { bookId: annotationBookFilter })} className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">.MD</button>
                        <button onClick={() => exportAnnotations('html', annotationBookFilter === 'all' ? {} : { bookId: annotationBookFilter })} className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">.HTML</button>
                        <button onClick={() => exportAnnotations('json', annotationBookFilter === 'all' ? {} : { bookId: annotationBookFilter })} className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">.JSON</button>
                        {addons.quotePosters && <button onClick={exportQuotesAsImage} title="Exportar subrayados como imagen" className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">🖼️</button>}
                        <button onClick={() => setShowLabelEditor(p => !p)} title="Personalizar etiquetas de colores"
                            className={`text-[10px] font-black px-2 py-1 rounded-lg transition ${showLabelEditor ? 'opacity-100 text-[var(--highlight)]' : 'opacity-40 hover:opacity-100 hover:text-[var(--highlight)]'}`}>
                            ✏️
                        </button>
                        <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-full opacity-50 hover:opacity-100 transition ml-1">
                            <Icons.Close />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {showLabelEditor && (
                        <div className="mb-4 rounded-2xl border p-3 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-45">Etiquetas de subrayado</p>
                            {Object.keys(HIGHLIGHT_LABEL_DEFAULTS).map(color => (
                                <div key={color} className="flex items-center gap-2">
                                    <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: HIGHLIGHT_SWATCHES[color] }} />
                                    <input
                                        type="text"
                                        defaultValue={highlightLabels[color]}
                                        maxLength={24}
                                        placeholder={HIGHLIGHT_LABEL_DEFAULTS[color]}
                                        onBlur={e => setHighlightLabel(color, e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                                        className="flex-1 min-w-0 bg-black/5 dark:bg-white/5 rounded-lg px-2 py-1.5 text-xs font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                        style={{ color: 'var(--text-color)' }}
                                    />
                                </div>
                            ))}
                            <p className="text-[9px] opacity-40 leading-relaxed">Dale tu propio significado a cada color (p. ej. "A investigar", "Definición"). Se aplica en el lector, aquí y en los exports.</p>
                        </div>
                    )}

                    <div className="mb-4 space-y-2">
                        <input
                            type="text"
                            value={annotationSearch}
                            onChange={e => setAnnotationSearch(e.target.value)}
                            placeholder="Buscar en notas y subrayados..."
                            className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-3 py-2 text-xs font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition"
                            style={{ color: 'var(--text-color)' }}
                        />
                        <select
                            value={annotationBookFilter}
                            onChange={e => setAnnotationBookFilter(e.target.value)}
                            className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-3 py-2 text-xs font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition"
                            style={{ color: 'var(--text-color)' }}
                        >
                            <option value="all">Toda la biblioteca</option>
                            {annotationBookOptions.map(option => (
                                <option key={option.bookId} value={option.bookId}>
                                    {option.bookName} ({option.total})
                                </option>
                            ))}
                        </select>
                        <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="rounded-xl px-2 py-2" style={{ backgroundColor: 'color-mix(in srgb, var(--text-color) 6%, transparent)' }}>
                                <p className="text-[9px] font-black uppercase tracking-widest opacity-35">Total</p>
                                <p className="mt-1 text-sm font-black">{annotationSummary.total}</p>
                            </div>
                            <div className="rounded-xl px-2 py-2" style={{ backgroundColor: `${HIGHLIGHT_SWATCHES.yellow}16` }}>
                                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: HIGHLIGHT_SWATCHES.yellow, opacity: 0.85 }}>Subr.</p>
                                <p className="mt-1 text-sm font-black" style={{ color: HIGHLIGHT_SWATCHES.yellow }}>{annotationSummary.highlights}</p>
                            </div>
                            <div className="rounded-xl px-2 py-2" style={{ backgroundColor: `${NOTE_SWATCH}16` }}>
                                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: NOTE_SWATCH, opacity: 0.85 }}>Notas</p>
                                <p className="mt-1 text-sm font-black" style={{ color: NOTE_SWATCH }}>{annotationSummary.notes}</p>
                            </div>
                            <div className="rounded-xl px-2 py-2" style={{ backgroundColor: `${BOOKMARK_SWATCH}16` }}>
                                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: BOOKMARK_SWATCH, opacity: 0.85 }}>Marc.</p>
                                <p className="mt-1 text-sm font-black" style={{ color: BOOKMARK_SWATCH }}>{annotationSummary.bookmarks}</p>
                            </div>
                        </div>
                    </div>

                    {annotationGroups.length === 0 ? (() => {
                        const isFiltered = !!annotationSearch || annotationBookFilter !== 'all';
                        return (
                            <div className="flex flex-col items-center px-6 py-10 text-center fade-in">
                                <div
                                    className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl [&>svg]:h-7 [&>svg]:w-7"
                                    style={{ backgroundColor: `${BOOKMARK_SWATCH}15`, border: `1px solid ${BOOKMARK_SWATCH}25` }}>
                                    <Icons.Bookmark color={BOOKMARK_SWATCH} />
                                </div>
                                <h3 className="text-base font-black">
                                    {isFiltered ? 'Sin resultados para ese filtro' : 'Aún no tienes anotaciones'}
                                </h3>
                                <p className="mt-1.5 max-w-xs text-xs leading-relaxed opacity-55">
                                    {isFiltered
                                        ? 'Prueba con otro libro, otro término de búsqueda o quita el filtro activo.'
                                        : 'Selecciona texto mientras lees para subrayarlo o añadir una nota, o usa el botón de marcador en la barra del lector.'}
                                </p>
                                {isFiltered && (
                                    <button
                                        onClick={() => { setAnnotationSearch(''); setAnnotationBookFilter('all'); }}
                                        className="mt-4 rounded-xl px-4 py-2 text-xs font-bold transition"
                                        style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                                        × Quitar filtros
                                    </button>
                                )}
                            </div>
                        );
                    })() : annotationGroups.map(group => (
                        <div key={`annotation-${group.bookId}`} className="mb-4 fade-in">
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--highlight)' }}></div>
                                <button
                                    onClick={() => setAnnotationBookFilter(prev => prev === group.bookId ? 'all' : group.bookId)}
                                    className="text-[11px] font-black truncate flex-1 opacity-70 text-left hover:opacity-100 transition"
                                >
                                    {group.bookName}
                                </button>
                                <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-bold opacity-30">{group.total}</span>
                                    <button
                                        onClick={() => exportAnnotations('md', { bookId: group.bookId })}
                                        className="text-[9px] font-black px-1.5 py-0.5 rounded-lg opacity-30 hover:opacity-100 hover:text-[var(--highlight)] transition"
                                        title="Exportar este libro"
                                    >
                                        .MD
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 px-1 mb-2">
                                {group.highlights > 0 && <KindBadge label="Subrayados" count={group.highlights} swatch={HIGHLIGHT_SWATCHES.yellow} />}
                                {group.notes > 0 && <KindBadge label="Notas" count={group.notes} swatch={NOTE_SWATCH} />}
                                {group.bookmarks > 0 && <KindBadge label="Marcadores" count={group.bookmarks} swatch={BOOKMARK_SWATCH} />}
                            </div>

                            <div className="flex flex-col gap-1.5">
                                {group.entries.map(entry => {
                                    const meta = getEntryMeta(entry, highlightLabels);
                                    const deleteNote = entry.rawNote || entry.text;
                                    return (
                                        <div key={entry.id} className="group relative flex items-start gap-2.5 px-2.5 py-2.5 rounded-xl border-l-[3px] transition hover:brightness-[1.08]"
                                            style={{ backgroundColor: `${meta.swatch}0f`, borderColor: meta.swatch }}>
                                            <span
                                                className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full [&>svg]:h-3.5 [&>svg]:w-3.5"
                                                style={{ backgroundColor: `${meta.swatch}26`, color: meta.swatch }}>
                                                <meta.Icon />
                                            </span>
                                            <button
                                                onClick={() => { openBook(group.bookId, entry.page ? String(entry.page) : entry.cfi); onClose(); }}
                                                className="flex-1 text-left min-w-0"
                                            >
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${meta.swatch}22`, color: meta.swatch }}>
                                                        {meta.label}
                                                    </span>
                                                </div>
                                                <span className={`block leading-snug ${entry.kind === 'highlight' ? 'text-[11px] font-medium line-clamp-3 italic opacity-80' : 'text-[12px] font-semibold'} break-words`} style={{ color: 'var(--text-color)' }}>
                                                    {entry.text || 'Sin texto'}
                                                </span>
                                                <span className="text-[9px] opacity-40 font-bold">{entry.date}</span>
                                            </button>
                                            {addons.quotePosters && entry.kind === 'highlight' && (
                                                <button
                                                    onClick={() => exportSingleQuote(entry.text, group.bookName, group.bookAuthor, appliedTheme)}
                                                    title="Exportar como imagen"
                                                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition text-[11px] flex-shrink-0 mt-0.5"
                                                >
                                                    🖼️
                                                </button>
                                            )}
                                            <button
                                                onClick={() => toggleBookmarkInApp(group.bookId, entry.cfi, deleteNote, true)}
                                                aria-label="Eliminar anotación"
                                                className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition text-red-400 text-base leading-none flex-shrink-0 mt-0.5"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
