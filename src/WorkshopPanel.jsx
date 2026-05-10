import React, { useState } from 'react';

// context: 'reader' = only affects the reader, 'library' = only affects library, 'global' = both
const ADDONS = [
    {
        id: 'focusMode',
        emoji: '🎯',
        name: 'Modo Focus',
        desc: 'La barra desaparece tras 2.5s de inactividad. Acerca el ratón al borde superior para recuperarla.',
        category: 'Lectura',
        context: 'reader',
        status: 'active',
    },
    {
        id: 'autoBookmark',
        emoji: '📌',
        name: 'Marcador Automático',
        desc: 'Guarda automáticamente tu posición como marcador cada vez que cierras un libro.',
        category: 'Lectura',
        context: 'reader',
        status: 'active',
    },

    {
        id: 'netflixView',
        emoji: '🎬',
        name: 'Vista Netflix',
        desc: 'Portadas más grandes en la biblioteca. Hover para ver info rápida del libro.',
        category: 'Interfaz',
        context: 'library',
        status: 'active',
    },
    {
        id: 'readingJournal',
        emoji: '📓',
        name: 'Reading Journal',
        desc: 'Registra automáticamente cada sesión: fecha, libro y progreso. Accede desde el menú lateral.',
        category: 'Estadísticas',
        context: 'global',
        status: 'active',
    },
    {
        id: 'reminders',
        emoji: '⏰',
        name: 'Recordatorio Diario',
        desc: 'Muestra una notificación para recordarte leer cuando llevas más de 1h sin abrir la app.',
        category: 'Productividad',
        context: 'global',
        status: 'active',
    },
    {
        id: 'smartToc',
        emoji: '🗺️',
        name: 'TOC Flotante',
        desc: 'Tabla de contenidos flotante con indicador de posición actual mientras lees.',
        category: 'Navegación',
        context: 'reader',
        status: 'active',
    },
];

const CATEGORIES = ['Todos', 'Lectura', 'Accesibilidad', 'Interfaz', 'Estadísticas', 'Productividad', 'Navegación'];
const CONTEXT_LABELS = {
    reader: { label: 'En el lector', color: '#3b82f6' },
    library: { label: 'En biblioteca', color: '#22c55e' },
    global: { label: 'Global', color: '#a855f7' },
};

const WorkshopPanel = ({ addons, onToggle, onClose }) => {
    const [activeCategory, setActiveCategory] = useState('Todos');
    const [lastToggled, setLastToggled] = useState(null);

    const handleToggle = (id) => {
        onToggle(id);
        setLastToggled(id);
        setTimeout(() => setLastToggled(null), 1200);
    };

    const activeCount = Object.values(addons).filter(Boolean).length;
    const filtered = ADDONS.filter(a => activeCategory === 'Todos' || a.category === activeCategory);
    const activeAddonsList = ADDONS.filter(a => addons[a.id] && a.status === 'active');

    return (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm fade-in" onClick={onClose}>
            <div className="w-full sm:max-w-2xl bg-[var(--surface-bg)] rounded-t-3xl sm:rounded-3xl border border-[var(--border-color)] shadow-2xl flex flex-col"
                style={{ maxHeight: '90vh' }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-md"
                            style={{ background: 'linear-gradient(135deg, var(--topbar-bg), var(--highlight))' }}>🔧</div>
                        <div>
                            <h2 className="font-black text-xl leading-none">Workshop</h2>
                            <p className="text-[11px] opacity-50 mt-0.5">
                                {activeCount > 0 ? `${activeCount} addon${activeCount !== 1 ? 's' : ''} activo${activeCount !== 1 ? 's' : ''}` : 'Activa funciones extra'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition opacity-60 hover:opacity-100 text-xl leading-none">×</button>
                </div>

                {/* Active addons pills */}
                {activeAddonsList.length > 0 && (
                    <div className="px-5 py-2.5 border-b flex gap-2 flex-wrap flex-shrink-0"
                        style={{ borderColor: 'var(--border-color)', backgroundColor: 'color-mix(in srgb, var(--highlight) 5%, var(--surface-bg))' }}>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-40 self-center">Activos:</span>
                        {activeAddonsList.map(a => (
                            <button key={a.id} onClick={() => handleToggle(a.id)}
                                title="Clic para desactivar"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition hover:opacity-80"
                                style={{ background: 'linear-gradient(135deg, var(--topbar-bg), var(--highlight))' }}>
                                {a.emoji} {a.name} ×
                            </button>
                        ))}
                    </div>
                )}

                {/* Category tabs */}
                <div className="flex gap-1.5 px-5 py-2.5 overflow-x-auto border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                    {CATEGORIES.map(cat => (
                        <button key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition flex-shrink-0 ${activeCategory === cat ? 'text-white' : 'bg-black/5 dark:bg-white/5 opacity-60 hover:opacity-100'}`}
                            style={activeCategory === cat ? { background: 'linear-gradient(135deg, var(--topbar-bg), var(--highlight))' } : {}}>
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Addon grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid sm:grid-cols-2 gap-2.5">
                        {filtered.map(addon => {
                            const enabled = !!addons[addon.id];
                            const isSoon = addon.status === 'soon';
                            const justToggled = lastToggled === addon.id;
                            const ctx = CONTEXT_LABELS[addon.context];

                            return (
                                <div key={addon.id}
                                    className={`p-4 rounded-2xl border transition-all relative overflow-hidden ${isSoon ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                    style={{
                                        borderColor: enabled ? 'var(--highlight)' : 'var(--border-color)',
                                        background: enabled
                                            ? 'color-mix(in srgb, var(--highlight) 8%, var(--bg-color))'
                                            : 'var(--bg-color)',
                                        boxShadow: justToggled ? `0 0 0 3px var(--highlight)` : 'none',
                                    }}
                                    onClick={() => !isSoon && handleToggle(addon.id)}>

                                    {/* Activated flash */}
                                    {justToggled && (
                                        <div className="absolute inset-0 rounded-2xl pointer-events-none"
                                            style={{ background: 'var(--highlight)', opacity: 0.12, animation: 'fadeOut 1.2s forwards' }} />
                                    )}

                                    <div className="flex items-start gap-3">
                                        <div className="text-2xl flex-shrink-0 mt-0.5">{addon.emoji}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                <span className="font-black text-sm">{addon.name}</span>
                                                {isSoon && (
                                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 uppercase tracking-wider">Pronto</span>
                                                )}
                                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: ctx.color + '20', color: ctx.color }}>
                                                    {ctx.label}
                                                </span>
                                            </div>
                                            <p className="text-[11px] opacity-55 leading-relaxed">{addon.desc}</p>
                                        </div>
                                        {!isSoon && (
                                            <div className="flex-shrink-0 mt-0.5 relative"
                                                style={{ width: 38, height: 22, borderRadius: 11, backgroundColor: enabled ? 'var(--highlight)' : 'rgba(128,128,128,0.25)', transition: 'background-color 0.2s' }}>
                                                <div style={{ position: 'absolute', top: 3, left: enabled ? 19 : 3, width: 16, height: 16, borderRadius: '50%', backgroundColor: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'left 0.2s' }} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Active indicator bar */}
                                    {enabled && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl" style={{ backgroundColor: 'var(--highlight)' }} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 p-3 rounded-2xl text-center" style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                        <p className="text-[11px] opacity-40 font-bold">
                            💡 Los addons <span style={{ color: '#3b82f6' }}>«En el lector»</span> solo funcionan cuando hay un libro abierto.
                            Los <span style={{ color: '#22c55e' }}>«En biblioteca»</span> cambian la interfaz de la biblioteca.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkshopPanel;
