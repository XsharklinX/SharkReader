import React, { useState } from 'react';

const ADDONS = [
    {
        id: 'focusMode',
        emoji: '🎯',
        name: 'Modo Focus',
        desc: 'Oculta la barra superior al leer. Mueve el ratón al borde superior para mostrarla.',
        category: 'Lectura',
        status: 'active',
    },
    {
        id: 'tts',
        emoji: '🔊',
        name: 'Text-to-Speech',
        desc: 'Lee el libro en voz alta usando la síntesis de voz del sistema. Botón TTS aparece en el lector.',
        category: 'Accesibilidad',
        status: 'active',
    },
    {
        id: 'netflixView',
        emoji: '🎬',
        name: 'Vista Netflix',
        desc: 'Amplía las portadas de la biblioteca y muestra info al pasar el ratón por encima.',
        category: 'Interfaz',
        status: 'active',
    },
    {
        id: 'readingJournal',
        emoji: '📓',
        name: 'Reading Journal',
        desc: 'Registra automáticamente cada sesión: fecha, libro, minutos leídos y progreso alcanzado.',
        category: 'Estadísticas',
        status: 'active',
    },
    {
        id: 'reminders',
        emoji: '⏰',
        name: 'Recordatorio Diario',
        desc: 'Recibe una notificación diaria para recordarte leer. Configura la hora en ajustes.',
        category: 'Productividad',
        status: 'active',
    },
    {
        id: 'xray',
        emoji: '🔍',
        name: 'X-Ray',
        desc: 'Rastrea personajes, lugares y términos clave del libro mientras lees. Crea tu propio glosario.',
        category: 'Lectura',
        status: 'soon',
    },
    {
        id: 'smartQuotes',
        emoji: '💬',
        name: 'Citas Inteligentes',
        desc: 'Detecta frases destacables automáticamente con IA y te sugiere guardarlas.',
        category: 'IA',
        status: 'soon',
    },
    {
        id: 'wordCloud',
        emoji: '☁️',
        name: 'Nube de Palabras',
        desc: 'Genera una nube con las palabras más frecuentes en tus libros.',
        category: 'Estadísticas',
        status: 'soon',
    },
    {
        id: 'smartToc',
        emoji: '🗺️',
        name: 'TOC Flotante',
        desc: 'Tabla de contenidos flotante con indicador de tu posición actual en el libro.',
        category: 'Navegación',
        status: 'soon',
    },
    {
        id: 'progressShare',
        emoji: '📸',
        name: 'Compartir Progreso',
        desc: 'Genera tarjetas visuales de tu progreso lector para compartir en redes sociales.',
        category: 'Social',
        status: 'soon',
    },
];

const CATEGORIES = ['Todos', 'Lectura', 'Accesibilidad', 'Interfaz', 'Estadísticas', 'Productividad', 'IA', 'Navegación', 'Social'];

const CATEGORY_ICONS = {
    'Lectura': '📖', 'Accesibilidad': '♿', 'Interfaz': '🎨', 'Estadísticas': '📊',
    'Productividad': '⚡', 'IA': '🤖', 'Navegación': '🗺️', 'Social': '👥',
};

const WorkshopPanel = ({ addons, onToggle, onClose }) => {
    const [activeCategory, setActiveCategory] = useState('Todos');

    const activeCount = Object.values(addons).filter(Boolean).length;
    const filtered = ADDONS.filter(a => activeCategory === 'Todos' || a.category === activeCategory);
    const activeAddons = ADDONS.filter(a => addons[a.id]);

    return (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm fade-in" onClick={onClose}>
            <div className="w-full sm:max-w-2xl bg-[var(--surface-bg)] rounded-t-3xl sm:rounded-3xl border border-[var(--border-color)] shadow-2xl flex flex-col"
                style={{ maxHeight: '88vh' }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shadow-lg" style={{ background: 'linear-gradient(135deg, var(--topbar-bg), var(--highlight))' }}>
                            🔧
                        </div>
                        <div>
                            <h2 className="font-black text-xl leading-none">Workshop</h2>
                            <p className="text-[11px] opacity-50 mt-0.5">
                                {activeCount > 0 ? `${activeCount} addon${activeCount !== 1 ? 's' : ''} activo${activeCount !== 1 ? 's' : ''}` : 'Personaliza tu experiencia'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition opacity-60 hover:opacity-100 text-xl leading-none">×</button>
                </div>

                {/* Active addons strip */}
                {activeAddons.length > 0 && (
                    <div className="px-6 py-3 border-b flex gap-2 flex-wrap flex-shrink-0" style={{ borderColor: 'var(--border-color)', backgroundColor: 'color-mix(in srgb, var(--highlight) 6%, var(--surface-bg))' }}>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40 self-center mr-1">Activos:</span>
                        {activeAddons.map(a => (
                            <div key={a.id} className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold text-white"
                                style={{ background: 'linear-gradient(135deg, var(--topbar-bg), var(--highlight))' }}>
                                <span>{a.emoji}</span>
                                <span>{a.name}</span>
                                <button onClick={() => onToggle(a.id)} className="ml-1 opacity-70 hover:opacity-100 leading-none">×</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Category filter */}
                <div className="flex gap-2 px-6 py-3 overflow-x-auto border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                    {CATEGORIES.map(cat => (
                        <button key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition flex-shrink-0 flex items-center gap-1 ${activeCategory === cat ? 'text-white shadow-md' : 'bg-black/5 dark:bg-white/5 hover:opacity-80'}`}
                            style={activeCategory === cat ? { background: 'linear-gradient(135deg, var(--topbar-bg), var(--highlight))' } : {}}>
                            {CATEGORY_ICONS[cat] && <span>{CATEGORY_ICONS[cat]}</span>}
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Addon grid */}
                <div className="flex-1 overflow-y-auto p-5">
                    <div className="grid sm:grid-cols-2 gap-3">
                        {filtered.map(addon => {
                            const enabled = !!addons[addon.id];
                            const isSoon = addon.status === 'soon';
                            return (
                                <div key={addon.id}
                                    className={`p-4 rounded-2xl border transition-all ${isSoon ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}`}
                                    style={{
                                        borderColor: enabled ? 'var(--highlight)' : 'var(--border-color)',
                                        background: enabled
                                            ? 'color-mix(in srgb, var(--highlight) 8%, var(--surface-bg))'
                                            : 'var(--bg-color)',
                                    }}
                                    onClick={() => !isSoon && onToggle(addon.id)}>
                                    <div className="flex items-start gap-3">
                                        <div className="text-2xl flex-shrink-0 mt-0.5" style={{ filter: isSoon ? 'grayscale(1)' : 'none' }}>
                                            {addon.emoji}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="font-black text-sm">{addon.name}</span>
                                                {isSoon && (
                                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">
                                                        Pronto
                                                    </span>
                                                )}
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 opacity-70">
                                                    {addon.category}
                                                </span>
                                            </div>
                                            <p className="text-[11px] opacity-60 leading-relaxed">{addon.desc}</p>
                                        </div>
                                        {!isSoon && (
                                            <div className="flex-shrink-0 mt-0.5"
                                                style={{
                                                    width: 38, height: 22, borderRadius: 11,
                                                    backgroundColor: enabled ? 'var(--highlight)' : 'rgba(128,128,128,0.3)',
                                                    position: 'relative', transition: 'background-color 0.2s',
                                                }}>
                                                <div style={{
                                                    position: 'absolute', top: 3, left: enabled ? 19 : 3,
                                                    width: 16, height: 16, borderRadius: '50%',
                                                    backgroundColor: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                                                    transition: 'left 0.2s',
                                                }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <p className="text-center text-[11px] opacity-30 mt-6 font-bold">
                        Los addons marcados como "Pronto" están en desarrollo activo.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default WorkshopPanel;
