import React from 'react';

export default function AnniversaryModal({ anniversaryInfo, onClose }) {
    if (!anniversaryInfo) return null;
    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm fade-in" onClick={onClose}>
            <div className="bg-[var(--surface-bg)] rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-[var(--border-color)] text-center mx-4" onClick={e => e.stopPropagation()}>
                <div className="text-6xl mb-4">
                    {anniversaryInfo.days >= 365 ? '🎉' : anniversaryInfo.days >= 100 ? '🏆' : anniversaryInfo.days >= 30 ? '🔥' : '📅'}
                </div>
                <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--highlight)' }}>
                    {anniversaryInfo.days >= 365 ? '¡Un año leyendo este libro!' : `¡${anniversaryInfo.days} días leyendo!`}
                </h2>
                <p className="opacity-70 text-sm mb-4 leading-relaxed">
                    Llevas <b>{anniversaryInfo.days} días</b> con<br />
                    <span className="font-bold" style={{ color: 'var(--highlight)' }}>"{anniversaryInfo.name}"</span>
                </p>
                <div className="bg-black/5 dark:bg-white/5 rounded-2xl px-6 py-3 mb-6 inline-block">
                    <span className="text-2xl font-black" style={{ color: 'var(--highlight)' }}>
                        {anniversaryInfo.readingMinutes >= 60
                            ? `${Math.floor(anniversaryInfo.readingMinutes / 60)}h ${anniversaryInfo.readingMinutes % 60}m`
                            : `${anniversaryInfo.readingMinutes} min`}
                    </span>
                    <p className="text-[11px] font-bold opacity-50 uppercase tracking-widest mt-1">de lectura real</p>
                </div>
                <button onClick={onClose}
                    className="w-full py-3 rounded-xl font-bold text-white transition hover:brightness-110"
                    style={{ backgroundColor: 'var(--highlight)' }}>
                    ¡Seguir leyendo! 📖
                </button>
            </div>
        </div>
    );
}
