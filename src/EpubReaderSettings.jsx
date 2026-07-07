import React from 'react';

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
    textJustify, setTextJustify,
    firstLineIndent, setFirstLineIndent,
    hyphenation, setHyphenation,
    letterSpacing, setLetterSpacing,
    paragraphSpacing, setParagraphSpacing,
    columnWidth, setColumnWidth,
    applyReadingPreset,
}) {
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
