import React, { useState } from 'react';

const CUSTOM_THEMES_KEY = 'sr_custom_themes';

function loadCustomThemes() {
    try {
        const raw = JSON.parse(localStorage.getItem(CUSTOM_THEMES_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

export const FONTS = [
    { id: 'Inter', label: 'Inter', desc: 'Sans-serif moderna' },
    { id: 'Georgia', label: 'Georgia', desc: 'Serif clásica' },
    { id: 'Lora', label: 'Lora', desc: 'Serif elegante' },
    { id: 'Merriweather', label: 'Merriweather', desc: 'Serif legible' },
    { id: 'Crimson Text', label: 'Crimson Text', desc: 'Serif literaria' },
    { id: 'Roboto Slab', label: 'Roboto Slab', desc: 'Slab serif' },
    { id: 'OpenDyslexic', label: 'OpenDyslexic', desc: 'Para dislexia' },
];

export const READING_PRESETS = [
    {
        id: 'balanced',
        label: 'Equilibrado',
        desc: 'Cómodo para novelas largas',
        values: { fontFamily: 'Lora', lineHeight: 1.7, pageMargins: 24, letterSpacing: 0, paragraphSpacing: 0.3, textJustify: true, firstLineIndent: false, hyphenation: true, columnWidth: 'normal' },
    },
    {
        id: 'focus',
        label: 'Enfoque',
        desc: 'Más aire y menos fatiga',
        values: { fontFamily: 'Merriweather', lineHeight: 1.85, pageMargins: 34, letterSpacing: 0.01, paragraphSpacing: 0.5, textJustify: false, firstLineIndent: false, hyphenation: false, columnWidth: 'narrow' },
    },
    {
        id: 'dense',
        label: 'Compacto',
        desc: 'Más texto por pantalla',
        values: { fontFamily: 'Georgia', lineHeight: 1.45, pageMargins: 14, letterSpacing: 0, paragraphSpacing: 0, textJustify: true, firstLineIndent: true, hyphenation: true, columnWidth: 'wide' },
    },
    {
        id: 'access',
        label: 'Accesible',
        desc: 'Espaciado y contraste lector',
        values: { fontFamily: 'OpenDyslexic', lineHeight: 1.95, pageMargins: 36, letterSpacing: 0.04, paragraphSpacing: 0.7, textJustify: false, firstLineIndent: false, hyphenation: false, columnWidth: 'normal' },
    },
];

export default function EpubReaderSettings({
    dock,
    showFontMenu, setShowFontMenu,
    setShowToc, setShowBrightness, setShowAutoScrollPanel,
    fontFamily, setFontFamily,
    lineHeight, setLineHeight,
    pageMargins, setPageMargins,
    customBg, setCustomBg,
    customText, setCustomText,
    textJustify, setTextJustify,
    firstLineIndent, setFirstLineIndent,
    hyphenation, setHyphenation,
    letterSpacing, setLetterSpacing,
    paragraphSpacing, setParagraphSpacing,
    columnWidth, setColumnWidth,
    applyReadingPreset,
}) {
    const [customThemes, setCustomThemes] = useState(loadCustomThemes);
    const [newThemeName, setNewThemeName] = useState('');

    const persistThemes = (next) => {
        setCustomThemes(next);
        try { localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(next)); } catch (_) {}
    };

    const saveCurrentTheme = () => {
        const name = newThemeName.trim();
        if (!name || (!customBg && !customText)) return;
        const next = [
            ...customThemes.filter(item => item.name !== name),
            { id: Date.now().toString(36), name, bg: customBg, text: customText },
        ].slice(-8);
        persistThemes(next);
        setNewThemeName('');
    };

    const applyCustomTheme = (item) => {
        setCustomBg(item.bg || '');
        setCustomText?.(item.text || '');
    };

    const deleteCustomTheme = (id) => {
        persistThemes(customThemes.filter(item => item.id !== id));
    };

    return (
        <div className="relative" onClick={e => e.stopPropagation()}>
            <button
                onClick={() => { setShowFontMenu(p => !p); setShowToc(false); setShowBrightness(false); setShowAutoScrollPanel(false); }}
                className={`font-black text-sm px-2 py-1.5 rounded-xl transition ${showFontMenu ? 'bg-white/25' : 'hover:bg-white/15'}`}
                title="Tipografía"
            >Aa</button>
            {showFontMenu && (
                <div className={dock ? "dock-popup active" : "topbar-popup active"} style={{ minWidth: '260px', maxHeight: '480px', overflowY: 'auto' }} onWheel={e => e.stopPropagation()}>
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-2">Presets de lectura</p>
                    <div className="grid grid-cols-2 gap-1 mb-3">
                        {READING_PRESETS.map(preset => (
                            <button key={preset.id} onClick={() => applyReadingPreset?.(preset.id)}
                                className="text-left px-2 py-2 rounded-lg text-xs font-bold transition leading-tight hover:bg-black/5 dark:hover:bg-white/10">
                                <span>{preset.label}</span>
                                <span className="block text-[9px] opacity-60 font-normal">{preset.desc}</span>
                            </button>
                        ))}
                    </div>
                    <div className="border-t my-2" style={{ borderColor: 'rgba(128,128,128,0.2)' }}></div>
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-2">Fuente</p>
                    <div className="grid grid-cols-2 gap-1 mb-3">
                        {FONTS.map(f => (
                            <button key={f.id} onClick={() => setFontFamily(f.id)}
                                className={`text-left px-2 py-2 rounded-lg text-xs font-bold transition leading-tight ${fontFamily === f.id ? 'bg-[var(--highlight)] text-white' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
                                style={{ fontFamily: f.id }}>
                                <span>{f.label}</span>
                                <span className="block text-[9px] opacity-60 font-normal">{f.desc}</span>
                            </button>
                        ))}
                    </div>
                    <div className="border-t my-2" style={{ borderColor: 'rgba(128,128,128,0.2)' }}></div>
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1">Espaciado entre líneas</p>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs opacity-50">A</span>
                        <input type="range" min="1.0" max="2.5" step="0.1" value={lineHeight}
                            onChange={e => setLineHeight(parseFloat(e.target.value))}
                            className="flex-1 accent-[var(--highlight)]" />
                        <span className="text-xs opacity-50 text-right">A</span>
                        <span className="text-xs font-black opacity-70 min-w-[28px] text-right">{lineHeight}×</span>
                    </div>
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1">Márgenes laterales</p>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] opacity-50">|←</span>
                        <input type="range" min="0" max="80" step="5" value={pageMargins}
                            onChange={e => setPageMargins(Number(e.target.value))}
                            className="flex-1 accent-[var(--highlight)]" />
                        <span className="text-[10px] opacity-50">→|</span>
                        <span className="text-xs font-black opacity-70 min-w-[32px] text-right">{pageMargins}px</span>
                    </div>
                    <div className="border-t my-2" style={{ borderColor: 'rgba(128,128,128,0.2)' }}></div>
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-2">Color de fondo</p>
                    <div className="flex items-center gap-2 flex-wrap">
                        {['', '#fafafa', '#f5f0e8', '#262626', '#1e1e2e', '#0f1117', '#1a2332', '#2d1b1b'].map(c => (
                            <button key={c || 'auto'} onClick={() => setCustomBg(c)}
                                title={c || 'Automático (según tema)'}
                                className={`w-6 h-6 rounded-full border-2 transition ${customBg === c ? 'border-[var(--highlight)] scale-125' : 'border-transparent hover:scale-110'}`}
                                style={{ backgroundColor: c || 'var(--bg-color)', outline: c === '' ? '1px dashed rgba(128,128,128,0.5)' : 'none' }}>
                                {c === '' && <span className="text-[8px] leading-none block text-center opacity-60">A</span>}
                            </button>
                        ))}
                        <input type="color" value={customBg || '#ffffff'}
                            onChange={e => setCustomBg(e.target.value)}
                            title="Color personalizado"
                            className="w-6 h-6 rounded-full border-0 cursor-pointer p-0"
                            style={{ outline: '2px solid rgba(128,128,128,0.3)' }} />
                    </div>
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-2 mt-3">Color de texto</p>
                    <div className="flex items-center gap-2 flex-wrap">
                        {['', '#1a1a1a', '#3b2f2f', '#e2e8f0', '#c9d1d9', '#f5deb3', '#a8b5c4'].map(c => (
                            <button key={c || 'auto'} onClick={() => setCustomText?.(c)}
                                title={c || 'Automático (según tema)'}
                                className={`w-6 h-6 rounded-full border-2 transition ${customText === c ? 'border-[var(--highlight)] scale-125' : 'border-transparent hover:scale-110'}`}
                                style={{ backgroundColor: c || 'var(--text-color)', outline: c === '' ? '1px dashed rgba(128,128,128,0.5)' : 'none' }}>
                                {c === '' && <span className="text-[8px] leading-none block text-center opacity-60" style={{ color: 'var(--bg-color)' }}>A</span>}
                            </button>
                        ))}
                        <input type="color" value={customText || '#000000'}
                            onChange={e => setCustomText?.(e.target.value)}
                            title="Color de texto personalizado"
                            className="w-6 h-6 rounded-full border-0 cursor-pointer p-0"
                            style={{ outline: '2px solid rgba(128,128,128,0.3)' }} />
                    </div>
                    <div className="border-t my-2 mt-3" style={{ borderColor: 'rgba(128,128,128,0.2)' }}></div>
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-2">Mis temas</p>
                    {customThemes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {customThemes.map(item => (
                                <div key={item.id}
                                    className={`group flex items-center gap-1.5 rounded-lg pl-1.5 pr-1 py-1 text-xs font-bold transition cursor-pointer border ${customBg === (item.bg || '') && customText === (item.text || '') ? 'border-[var(--highlight)]' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/10'}`}
                                    onClick={() => applyCustomTheme(item)}
                                    title={`Fondo ${item.bg || 'auto'} · Texto ${item.text || 'auto'}`}>
                                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/10 dark:border-white/20 text-[8px] font-black leading-none"
                                        style={{ backgroundColor: item.bg || 'var(--bg-color)', color: item.text || 'var(--text-color)' }}>A</span>
                                    <span className="max-w-[90px] truncate">{item.name}</span>
                                    <button onClick={e => { e.stopPropagation(); deleteCustomTheme(item.id); }}
                                        className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-[10px] leading-none px-0.5"
                                        title="Eliminar tema">×</button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 mb-1">
                        <input
                            type="text"
                            value={newThemeName}
                            onChange={e => setNewThemeName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveCurrentTheme()}
                            placeholder="Nombre del tema..."
                            className="flex-1 min-w-0 rounded-lg bg-black/5 dark:bg-white/5 px-2 py-1.5 text-xs font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition"
                            style={{ color: 'var(--text-color)' }}
                        />
                        <button onClick={saveCurrentTheme}
                            disabled={!newThemeName.trim() || (!customBg && !customText)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-black text-white transition disabled:opacity-30 hover:opacity-80"
                            style={{ backgroundColor: 'var(--highlight)' }}
                            title="Guardar colores actuales como tema">
                            Guardar
                        </button>
                    </div>
                    <p className="text-[9px] opacity-40 leading-relaxed mb-1">Elige fondo y texto arriba y guárdalos con nombre para reutilizarlos en cualquier libro.</p>
                    <div className="border-t my-2" style={{ borderColor: 'rgba(128,128,128,0.2)' }}></div>
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-2">Tipografía</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        <button onClick={() => setTextJustify(p => !p)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex-1 ${textJustify ? 'bg-[var(--highlight)] text-white' : 'hover:bg-black/5 dark:hover:bg-white/10 opacity-60'}`}>
                            Justificado
                        </button>
                        <button onClick={() => setFirstLineIndent(p => !p)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex-1 ${firstLineIndent ? 'bg-[var(--highlight)] text-white' : 'hover:bg-black/5 dark:hover:bg-white/10 opacity-60'}`}>
                            Sangría
                        </button>
                        <button onClick={() => setHyphenation(p => !p)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex-1 ${hyphenation ? 'bg-[var(--highlight)] text-white' : 'hover:bg-black/5 dark:hover:bg-white/10 opacity-60'}`}>
                            Separación
                        </button>
                    </div>
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1">Interletraje</p>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs opacity-50">A·A</span>
                        <input type="range" min="-0.05" max="0.15" step="0.01" value={letterSpacing}
                            onChange={e => setLetterSpacing(parseFloat(e.target.value))}
                            className="flex-1 accent-[var(--highlight)]" />
                        <span className="text-xs font-black opacity-70 min-w-[36px] text-right">{letterSpacing > 0 ? '+' : ''}{(letterSpacing * 1000).toFixed(0)}‰</span>
                    </div>
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-1">Espacio entre párrafos</p>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs opacity-50">¶</span>
                        <input type="range" min="0" max="1.5" step="0.1" value={paragraphSpacing}
                            onChange={e => setParagraphSpacing(parseFloat(e.target.value))}
                            className="flex-1 accent-[var(--highlight)]" />
                        <span className="text-xs font-black opacity-70 min-w-[32px] text-right">{paragraphSpacing > 0 ? `+${paragraphSpacing.toFixed(1)}` : '0'}em</span>
                    </div>
                    <div className="border-t my-2" style={{ borderColor: 'rgba(128,128,128,0.2)' }}></div>
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest mb-2">Ancho de columna</p>
                    <div className="flex gap-1.5">
                        {[['narrow', 'Estrecha'], ['normal', 'Normal'], ['wide', 'Ancha']].map(([id, lbl]) => (
                            <button key={id} onClick={() => setColumnWidth(id)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${columnWidth === id ? 'bg-[var(--highlight)] text-white' : 'hover:bg-black/5 dark:hover:bg-white/10 opacity-60'}`}>
                                {lbl}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
