import React, { useState } from 'react';
import { Icons } from './icons';
import { useHighlightLabels, setHighlightLabel, HIGHLIGHT_SWATCHES, HIGHLIGHT_LABEL_DEFAULTS } from './highlightLabels';
import { SMART_RULE_TYPES, describeSmartRule } from './smartCollections';

const ANNOTATION_COLOR_META = {
    yellow: { label: 'Importante', swatch: '#facc15' },
    green: { label: 'Idea', swatch: '#22c55e' },
    blue: { label: 'Duda', swatch: '#3b82f6' },
    pink: { label: 'Cita', swatch: '#f472b6' },
};

const Sidebar = ({
    open,
    onClose,
    stats,
    lastReadId,
    openBook,
    currentFilter,
    setCurrentFilter,
    setView,
    libraryDerived,
    filterAuthors,
    toggleFilterAuthor,
    showAuthorSection,
    setShowAuthorSection,
    filterTags,
    toggleFilterTag,
    showTagSection,
    setShowTagSection,
    showRatingSection,
    setShowRatingSection,
    manualCollections,
    createManualCollection,
    createSmartCollection,
    removeManualCollection,
    renameManualCollection,
    moveManualCollection,
    renamingCollectionId,
    setRenamingCollectionId,
    renamingCollectionValue,
    setRenamingCollectionValue,
    customCategories,
    categoryColors,
    setCategoryColors,
    addNewCategory,
    removeCategory,
    vocabulary,
    setVocabulary,
    showVocabPanel,
    setShowVocabPanel,
    vocabSearch,
    setVocabSearch,
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
    journalEntries,
    userProfile,
    t,
    setShowStreakModal,
    setShowWorkshop,
    setShowJournalModal,
    setSettingsOpen,
}) => {
    const highlightLabels = useHighlightLabels();
    const [showLabelEditor, setShowLabelEditor] = useState(false);
    const [showSmartForm, setShowSmartForm] = useState(false);
    const [smartName, setSmartName] = useState('');
    const [smartRuleType, setSmartRuleType] = useState(SMART_RULE_TYPES[0].id);
    const [smartRuleValue, setSmartRuleValue] = useState('');

    const submitSmartCollection = () => {
        const created = createSmartCollection?.(smartName, { type: smartRuleType, value: smartRuleValue });
        if (created) {
            setShowSmartForm(false);
            setSmartName('');
            setSmartRuleValue('');
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="w-80 h-full shadow-2xl flex flex-col slide-in-left border-r" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
                <div className="p-6 pb-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🦈</span>
                        <div className="flex flex-col leading-none">
                            <span className="font-black text-lg tracking-tighter text-[var(--highlight)] uppercase">Shark</span>
                            <span className="font-black text-lg tracking-tighter text-[var(--text-color)] uppercase -mt-1">Reader</span>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Cerrar menú" className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition"><Icons.Close /></button>
                </div>
                <div className="flex-1 overflow-y-auto py-4 px-3">
                    <div className="px-3 mb-5 fade-in cursor-pointer" onClick={() => { setShowStreakModal(true); onClose(); }}>
                        <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 hover:border-orange-500/60 transition p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${stats.streak > 0 ? 'bg-orange-500 text-white shadow-lg streak-glow' : 'bg-gray-500/20 text-gray-500'}`}><Icons.Fire /></div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{t.streak}</p>
                                    <p className={`text-xl font-black ${stats.streak > 0 ? 'text-orange-500' : 'opacity-80'}`}>{stats.streak || 0} {t.streakDays}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    {lastReadId && (
                        <div className="px-3 mb-5 fade-in">
                            <button onClick={() => { openBook(lastReadId); onClose(); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white shadow-md hover:shadow-lg transition" style={{ backgroundColor: 'var(--topbar-bg)' }}>
                                <Icons.Play /> {t.continueReading}
                            </button>
                        </div>
                    )}
                    <div className="space-y-1">
                        {[
                            { filter: 'all', icon: <Icons.Library />, label: t.library, count: libraryDerived.counts.all },
                            { filter: 'reading', icon: <span>📖</span>, label: 'Leyendo', count: libraryDerived.counts.reading },
                            { filter: 'unstarted', icon: <span>📚</span>, label: 'Por leer', count: libraryDerived.counts.unstarted },
                            { filter: 'finished', icon: <span>✅</span>, label: 'Terminados', count: libraryDerived.counts.finished },
                            { filter: 'favorites', icon: <Icons.Heart className="text-red-500" />, label: t.favorites, count: libraryDerived.counts.favorites },
                            { filter: 'recents', icon: <span>🕐</span>, label: 'Recientes', count: libraryDerived.counts.recents },
                        ].map(item => (
                            <button key={item.filter} onClick={() => { setCurrentFilter(item.filter); setView('library'); onClose(); }}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left font-semibold text-sm ${currentFilter === item.filter ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                <span className="opacity-70 text-base">{item.icon}</span> {item.label}
                                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md">{item.count}</span>
                            </button>
                        ))}

                        {(libraryDerived.counts.shelfAbandoned > 0 || libraryDerived.counts.shelfAlmostDone > 0) && (
                            <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                <p className="text-[9px] font-black uppercase tracking-widest opacity-30 px-1 mb-1">Estanterías</p>
                                {[
                                    { filter: 'shelf:abandoned', icon: '⏸', label: 'Pausados +6 meses', count: libraryDerived.counts.shelfAbandoned },
                                    { filter: 'shelf:almostdone', icon: '🏁', label: 'Casi terminados', count: libraryDerived.counts.shelfAlmostDone },
                                ].filter(s => s.count > 0).map(item => (
                                    <button key={item.filter} onClick={() => { setCurrentFilter(item.filter); setView('library'); onClose(); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left font-semibold text-sm ${currentFilter === item.filter ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                        <span className="opacity-70 text-base">{item.icon}</span> {item.label}
                                        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md">{item.count}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {libraryDerived.authors.length > 0 && (() => {
                            const authors = libraryDerived.authors;
                            return (
                                <div>
                                    <button onClick={() => setShowAuthorSection(p => !p)}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left font-semibold text-sm hover:bg-black/5 dark:hover:bg-white/5">
                                        <span className="opacity-70 text-base">👤</span> Por Autor
                                        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md">{authors.length}</span>
                                        <span className="text-[10px] opacity-40">{showAuthorSection ? '▲' : '▼'}</span>
                                    </button>
                                    {showAuthorSection && (
                                        <div className="ml-4 space-y-0.5 max-h-48 overflow-y-auto">
                                            {authors.map(author => {
                                                const active = filterAuthors.includes(author);
                                                return (
                                                    <button key={author} onClick={() => { toggleFilterAuthor(author); setView('library'); }}
                                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left text-sm ${active ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                                        {active && <span className="text-sky-500 font-black text-xs">✓</span>}
                                                        <span className="truncate flex-1 opacity-80">{author}</span>
                                                        <span className="text-[10px] font-bold opacity-40 flex-shrink-0">{libraryDerived.authorCounts.get(author) || 0}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {libraryDerived.tags.length > 0 && (
                            <div>
                                <button onClick={() => setShowTagSection(prev => !prev)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left font-semibold text-sm hover:bg-black/5 dark:hover:bg-white/5">
                                    <span className="opacity-70 text-base">🏷️</span> Tags
                                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md">{libraryDerived.tags.length}</span>
                                    <span className="text-[10px] opacity-40">{showTagSection ? '▲' : '▼'}</span>
                                </button>
                                {showTagSection && (
                                    <div className="ml-4 space-y-0.5 max-h-48 overflow-y-auto">
                                        {libraryDerived.tags.map(([tag, count]) => {
                                            const active = filterTags.includes(tag);
                                            return (
                                                <button key={tag} onClick={() => { toggleFilterTag(tag); setView('library'); }}
                                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left text-sm ${active ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                                    {active && <span className="text-purple-500 font-black text-xs">✓</span>}
                                                    <span className="truncate flex-1 opacity-80">{tag}</span>
                                                    <span className="text-[10px] font-bold opacity-40 flex-shrink-0">{count}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        <div>
                            <button onClick={() => setShowRatingSection(prev => !prev)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left font-semibold text-sm hover:bg-black/5 dark:hover:bg-white/5">
                                <span className="opacity-70 text-base">⭐</span> Valoración
                                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md">
                                    {[1, 2, 3, 4, 5].filter(rating => (libraryDerived.ratingCounts.get(rating) || 0) > 0).length}
                                </span>
                                <span className="text-[10px] opacity-40">{showRatingSection ? '▲' : '▼'}</span>
                            </button>
                            {showRatingSection && (
                                <div className="ml-4 space-y-0.5">
                                    {[5, 4, 3, 2, 1].map(rating => {
                                        const count = libraryDerived.ratingCounts.get(rating) || 0;
                                        if (!count) return null;
                                        return (
                                            <button key={rating} onClick={() => { setCurrentFilter(`rating:${rating}`); setView('library'); onClose(); }}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left text-sm ${currentFilter === `rating:${rating}` ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                                <span className="flex-1 opacity-80" style={{ color: '#f59e0b', letterSpacing: '-1px' }}>{'★'.repeat(rating)}</span>
                                                <span className="text-[10px] font-bold opacity-40 flex-shrink-0">{count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>


                        {manualCollections.length > 0 && (
                            <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                <div className="flex items-center justify-between px-4 mb-1">
                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-30">Colecciones</p>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setShowSmartForm(p => !p)} className="text-[10px] font-black opacity-50 hover:opacity-100 transition">⚡ Inteligente</button>
                                        <button onClick={() => createManualCollection()} className="text-[10px] font-black opacity-50 hover:opacity-100 transition">+ Nueva</button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {showSmartForm && (
                            <div className="mx-3 mb-2 rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
                                <p className="text-[9px] font-black uppercase tracking-widest opacity-45">Nueva colección inteligente</p>
                                <input type="text" value={smartName} onChange={e => setSmartName(e.target.value)} placeholder="Nombre"
                                    className="w-full bg-black/5 dark:bg-white/5 rounded-lg px-2 py-1.5 text-xs font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                    style={{ color: 'var(--text-color)' }} />
                                <select value={smartRuleType} onChange={e => setSmartRuleType(e.target.value)}
                                    className="w-full bg-black/5 dark:bg-white/5 rounded-lg px-2 py-1.5 text-xs font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                    style={{ color: 'var(--text-color)' }}>
                                    {SMART_RULE_TYPES.map(rule => <option key={rule.id} value={rule.id}>{rule.label}</option>)}
                                </select>
                                <input type="text" value={smartRuleValue} onChange={e => setSmartRuleValue(e.target.value)}
                                    placeholder={SMART_RULE_TYPES.find(r => r.id === smartRuleType)?.placeholder}
                                    onKeyDown={e => e.key === 'Enter' && submitSmartCollection()}
                                    className="w-full bg-black/5 dark:bg-white/5 rounded-lg px-2 py-1.5 text-xs font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                    style={{ color: 'var(--text-color)' }} />
                                <button onClick={submitSmartCollection} disabled={!smartName.trim() || !smartRuleValue.trim()}
                                    className="w-full py-1.5 rounded-lg text-xs font-black text-white transition disabled:opacity-30 hover:opacity-80"
                                    style={{ backgroundColor: 'var(--highlight)' }}>
                                    Crear
                                </button>
                                <p className="text-[9px] opacity-40 leading-relaxed">Se auto-actualiza: cualquier libro que cumpla la regla entra o sale de la colección sola.</p>
                            </div>
                        )}
                        {manualCollections.map((collection, colIdx) => (
                            <div key={collection.id} className={`flex items-center rounded-xl transition group ${currentFilter === `collection:${collection.id}` ? 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                {renamingCollectionId === collection.id ? (
                                    <input
                                        value={renamingCollectionValue}
                                        onChange={e => setRenamingCollectionValue(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') renameManualCollection(collection.id, renamingCollectionValue);
                                            if (e.key === 'Escape') { setRenamingCollectionId(null); setRenamingCollectionValue(''); }
                                        }}
                                        onBlur={() => renameManualCollection(collection.id, renamingCollectionValue || collection.name)}
                                        className="flex-1 mx-3 my-1 text-sm font-bold rounded-lg px-2 py-1 outline-none border border-[var(--highlight)]"
                                        style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}
                                        autoFocus
                                        onClick={e => e.stopPropagation()}
                                    />
                                ) : (
                                    <button onClick={() => { setCurrentFilter(`collection:${collection.id}`); setView('library'); onClose(); }}
                                        title={collection.rule ? `Inteligente — ${describeSmartRule(collection.rule)}` : undefined}
                                        className="flex-1 flex items-center gap-2 px-3 py-2 text-left text-sm font-semibold min-w-0">
                                        <span className="text-base flex-shrink-0">{collection.emoji || '🗂️'}</span>
                                        <span className="flex-1 truncate">{collection.name}</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md flex-shrink-0">{libraryDerived.collectionCounts.get(collection.id) || 0}</span>
                                    </button>
                                )}
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition flex-shrink-0 pr-1 gap-0.5">
                                    <button onClick={e => { e.stopPropagation(); moveManualCollection(collection.id, 'up'); }} disabled={colIdx === 0} className="p-1 text-xs disabled:opacity-20 hover:opacity-70 transition" title="Subir">↑</button>
                                    <button onClick={e => { e.stopPropagation(); moveManualCollection(collection.id, 'down'); }} disabled={colIdx === manualCollections.length - 1} className="p-1 text-xs disabled:opacity-20 hover:opacity-70 transition" title="Bajar">↓</button>
                                    <button onClick={e => { e.stopPropagation(); setRenamingCollectionId(collection.id); setRenamingCollectionValue(collection.name); }} className="p-1 text-xs hover:opacity-70 transition" title="Renombrar">✏️</button>
                                    <button onClick={(e) => { e.stopPropagation(); removeManualCollection(collection.id); }} aria-label={`Eliminar colección ${collection.name}`} className="p-1 text-red-500 hover:text-red-600 transition"><Icons.Trash className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                        ))}
                        {manualCollections.length === 0 && (
                            <button onClick={() => createManualCollection()} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100 border border-dashed border-fuchsia-500/20 mt-1">
                                <span className="opacity-70 text-base">🗂️</span> Crear Colección
                            </button>
                        )}

                        {customCategories.length > 0 && (
                            <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                <p className="text-[9px] font-black uppercase tracking-widest opacity-30 px-4 mb-1">Mis categorías</p>
                            </div>
                        )}
                        {customCategories.map(cat => {
                            const catColor = categoryColors[cat];
                            return (
                            <div key={cat} className={`flex items-center rounded-xl transition group ${currentFilter === cat ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                <button onClick={() => { setCurrentFilter(cat); setView('library'); onClose(); }} className="flex-1 flex items-center gap-3 px-3 py-2 text-left text-sm font-semibold">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/20" style={{ backgroundColor: catColor || 'var(--highlight)' }}></span>
                                    {cat}
                                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md">{libraryDerived.categoryCounts.get(cat) || 0}</span>
                                </button>
                                <input type="color" value={catColor || '#6366f1'} title="Color de categoría"
                                    onChange={e => setCategoryColors(prev => ({ ...prev, [cat]: e.target.value }))}
                                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 w-5 h-5 rounded cursor-pointer transition border-0 bg-transparent p-0 flex-shrink-0" />
                                <button onClick={e => { e.stopPropagation(); removeCategory(cat); }} aria-label={`Eliminar categoría ${cat}`} className="opacity-0 group-hover:opacity-100 p-3 text-red-500 hover:text-red-600 transition"><Icons.Trash className="w-4 h-4" /></button>
                            </div>
                            );
                        })}
                        <button onClick={addNewCategory} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100 border border-dashed border-gray-500/30 mt-1">
                            <span className="opacity-70"><Icons.Plus /></span> Añadir Categoría
                        </button>
                    </div>
                    <div className="my-5 border-t mx-3" style={{ borderColor: 'var(--border-color)' }}></div>

                    {/* Vocabulario */}
                    <div className="px-3 mb-4">
                        <button onClick={() => setShowVocabPanel(p => !p)} className="w-full flex items-center justify-between px-1 py-2 opacity-70 hover:opacity-100 transition">
                            <span className="font-black uppercase text-xs tracking-widest flex items-center gap-2">📖 Vocabulario</span>
                            <span className="text-xs font-bold px-2 py-0.5 bg-black/5 dark:bg-white/10 rounded-lg">{vocabulary.length}</span>
                        </button>
                        {showVocabPanel && (
                            <div className="mt-2">
                                {vocabulary.length === 0 ? (
                                    <div className="text-center py-6 opacity-40">
                                        <p className="text-2xl mb-1">📖</p>
                                        <p className="text-xs font-medium">Selecciona palabras mientras lees para guardarlas aquí.</p>
                                    </div>
                                ) : (
                                    <>
                                        {vocabulary.length > 3 && (
                                            <div className="flex items-center gap-1.5 mb-2 px-1">
                                                <input
                                                    type="text"
                                                    value={vocabSearch}
                                                    onChange={e => setVocabSearch(e.target.value)}
                                                    placeholder="Buscar palabra..."
                                                    className="flex-1 bg-black/5 dark:bg-white/5 rounded-xl px-3 py-1.5 text-xs font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                                    style={{ color: 'var(--text-color)' }}
                                                />
                                                {vocabSearch && (
                                                    <button onClick={() => setVocabSearch('')} className="opacity-40 hover:opacity-100 transition text-base leading-none flex-shrink-0">×</button>
                                                )}
                                            </div>
                                        )}
                                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                                            {vocabulary.slice().reverse()
                                                .filter(v => !vocabSearch || v.word.toLowerCase().includes(vocabSearch.toLowerCase()) || v.definition.toLowerCase().includes(vocabSearch.toLowerCase()))
                                                .map(v => (
                                                    <div key={v.id} className="group bg-black/5 dark:bg-white/5 rounded-xl p-3 hover:bg-black/8 dark:hover:bg-white/8 transition">
                                                        <div className="flex justify-between items-start">
                                                            <span className="font-black text-sm" style={{ color: 'var(--highlight)' }}>{v.word}</span>
                                                            <button onClick={() => setVocabulary(prev => prev.filter(w => w.id !== v.id))} aria-label={`Eliminar palabra ${v.word} del vocabulario`} className="opacity-0 group-hover:opacity-40 hover:!opacity-100 text-red-500 transition ml-2 flex-shrink-0"><Icons.Trash className="w-3 h-3" /></button>
                                                        </div>
                                                        <p className="text-[11px] opacity-70 mt-1 leading-relaxed">{v.definition}</p>
                                                        <p className="text-[9px] opacity-40 mt-1">{v.bookName} · {v.date}</p>
                                                    </div>
                                                ))
                                            }
                                            {vocabulary.length > 0 && vocabulary.slice().reverse().filter(v => !vocabSearch || v.word.toLowerCase().includes(vocabSearch.toLowerCase()) || v.definition.toLowerCase().includes(vocabSearch.toLowerCase())).length === 0 && (
                                                <p className="text-xs opacity-40 text-center py-4">Sin resultados para "{vocabSearch}"</p>
                                            )}
                                        </div>
                                        <div className="flex gap-1.5 mt-2">
                                            <button onClick={() => {
                                                let md = '# 📖 Mi Vocabulario — Shark Reader\n\n';
                                                vocabulary.forEach(v => { md += `## ${v.word}\n${v.definition}\n\n*${v.bookName} · ${v.date}*\n\n---\n\n`; });
                                                const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
                                                const a = document.createElement('a'); a.href = url; a.download = 'Mi_Vocabulario.md'; a.click(); URL.revokeObjectURL(url);
                                            }} className="flex-1 text-xs font-bold py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:opacity-80 transition">.MD</button>
                                            <button onClick={() => {
                                                const rows = [['Palabra', 'Definición', 'Libro', 'Fecha'], ...vocabulary.map(v => [v.word, v.definition, v.bookName, v.date])];
                                                const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                                                const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
                                                const a = document.createElement('a'); a.href = url; a.download = 'Mi_Vocabulario.csv'; a.click(); URL.revokeObjectURL(url);
                                            }} className="flex-1 text-xs font-bold py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:opacity-80 transition">.CSV</button>
                                            <button onClick={() => {
                                                const url = URL.createObjectURL(new Blob([JSON.stringify(vocabulary, null, 2)], { type: 'application/json' }));
                                                const a = document.createElement('a'); a.href = url; a.download = 'Mi_Vocabulario.json'; a.click(); URL.revokeObjectURL(url);
                                            }} className="flex-1 text-xs font-bold py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:opacity-80 transition">.JSON</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="px-3">
                        <div className="flex items-center justify-between mb-3 pl-1">
                            <span className="font-black uppercase text-xs tracking-widest flex items-center gap-2 opacity-50">
                                <Icons.Bookmark /> Anotaciones
                            </span>
                            <div className="flex gap-1">
                                <button onClick={() => exportAnnotations('txt', annotationBookFilter === 'all' ? {} : { bookId: annotationBookFilter })} className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">.TXT</button>
                                <button onClick={() => exportAnnotations('md', annotationBookFilter === 'all' ? {} : { bookId: annotationBookFilter })} className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">.MD</button>
                                <button onClick={() => exportAnnotations('html', annotationBookFilter === 'all' ? {} : { bookId: annotationBookFilter })} className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">.HTML</button>
                                <button onClick={() => exportAnnotations('json', annotationBookFilter === 'all' ? {} : { bookId: annotationBookFilter })} className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">.JSON</button>
                                {addons.quotePosters && <button onClick={exportQuotesAsImage} title="Exportar subrayados como imagen" className="text-[10px] font-black px-2 py-1 rounded-lg opacity-40 hover:opacity-100 hover:text-[var(--highlight)] transition">🖼️</button>}
                                <button onClick={() => setShowLabelEditor(p => !p)} title="Personalizar etiquetas de colores"
                                    className={`text-[10px] font-black px-2 py-1 rounded-lg transition ${showLabelEditor ? 'opacity-100 text-[var(--highlight)]' : 'opacity-40 hover:opacity-100 hover:text-[var(--highlight)]'}`}>
                                    ✏️
                                </button>
                            </div>
                        </div>

                        {showLabelEditor && (
                            <div className="mb-3 rounded-2xl border p-3 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
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

                        <div className="mb-3 space-y-2">
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
                                <div className="rounded-xl bg-black/5 dark:bg-white/5 px-2 py-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-35">Total</p>
                                    <p className="mt-1 text-sm font-black">{annotationSummary.total}</p>
                                </div>
                                <div className="rounded-xl bg-black/5 dark:bg-white/5 px-2 py-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-35">Subr.</p>
                                    <p className="mt-1 text-sm font-black">{annotationSummary.highlights}</p>
                                </div>
                                <div className="rounded-xl bg-black/5 dark:bg-white/5 px-2 py-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-35">Notas</p>
                                    <p className="mt-1 text-sm font-black">{annotationSummary.notes}</p>
                                </div>
                                <div className="rounded-xl bg-black/5 dark:bg-white/5 px-2 py-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-35">Marc.</p>
                                    <p className="mt-1 text-sm font-black">{annotationSummary.bookmarks}</p>
                                </div>
                            </div>
                        </div>

                        {annotationGroups.length === 0 ? (
                            <div className="text-center py-8 opacity-40">
                                <p className="text-2xl mb-2">🔖</p>
                                <p className="text-xs font-medium">{annotationSearch || annotationBookFilter !== 'all' ? 'No hay resultados para ese filtro.' : t.noBookmarks}</p>
                            </div>
                        ) : annotationGroups.map(group => (
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
                                    {group.highlights > 0 && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-black/5 dark:bg-white/5">Subrayados {group.highlights}</span>}
                                    {group.notes > 0 && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-black/5 dark:bg-white/5">Notas {group.notes}</span>}
                                    {group.bookmarks > 0 && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-black/5 dark:bg-white/5">Marcadores {group.bookmarks}</span>}
                                </div>

                                <div className="flex flex-col gap-1">
                                    {group.entries.map(entry => {
                                        const colorMeta = ANNOTATION_COLOR_META[entry.color] || ANNOTATION_COLOR_META.yellow;
                                        const deleteNote = entry.kind === 'highlight'
                                            ? `[Subrayado] "${entry.text}${entry.rawNote.endsWith('...') ? '...' : ''}"`
                                            : entry.rawNote || entry.text;
                                        return (
                                            <div key={entry.id} className="group flex items-start gap-2 px-2 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition">
                                                <div
                                                    className="w-0.5 rounded-full flex-shrink-0 mt-1 self-stretch"
                                                    style={{ backgroundColor: entry.kind === 'highlight' ? colorMeta.swatch : 'var(--highlight)', minHeight: 14 }}
                                                />
                                                <button
                                                    onClick={() => { openBook(group.bookId, entry.cfi); onClose(); }}
                                                    className="flex-1 text-left min-w-0"
                                                >
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <span className="text-[9px] font-black uppercase tracking-widest opacity-35">
                                                            {entry.kind === 'highlight' ? 'Subrayado' : entry.kind === 'note' ? 'Nota' : 'Marcador'}
                                                        </span>
                                                        {entry.kind === 'highlight' && (
                                                            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${colorMeta.swatch}22`, color: colorMeta.swatch }}>
                                                                {highlightLabels[entry.color] || colorMeta.label}
                                                            </span>
                                                        )}
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
                <div className="p-4 border-t space-y-1.5" style={{ borderColor: 'var(--border-color)' }}>
                    <button onClick={() => { setView('analytics'); onClose(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition font-bold opacity-70 hover:opacity-100 text-sm">
                        <span className="text-base">📊</span> Analíticas
                    </button>
                    {userProfile && (
                    <button onClick={() => { setView('achievements'); onClose(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition font-bold opacity-70 hover:opacity-100 text-sm">
                        <span className="text-base">🏆</span> Logros
                    </button>
                    )}
                    <button onClick={() => { setShowWorkshop(true); onClose(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition font-bold opacity-70 hover:opacity-100 text-sm">
                        <span className="text-base">🔧</span> Workshop
                        {Object.values(addons).filter(Boolean).length > 0 && (
                            <span className="ml-auto text-xs font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: '#22c55e' }}>
                                {Object.values(addons).filter(Boolean).length} activos
                            </span>
                        )}
                    </button>
                    {addons.readingJournal && journalEntries.length > 0 && (
                        <button onClick={() => { setShowJournalModal(true); onClose(); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition font-bold opacity-70 hover:opacity-100 text-sm">
                            <span className="text-base">📓</span> Reading Journal
                            <span className="ml-auto text-xs font-black px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10">{journalEntries.length}</span>
                        </button>
                    )}
                    <button onClick={() => { setSettingsOpen(true); onClose(); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition font-bold opacity-70 hover:opacity-100 text-sm">
                        <Icons.Settings /> {t.settings}
                    </button>
                </div>
            </div>
            <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
        </div>
    );
};

export default Sidebar;
