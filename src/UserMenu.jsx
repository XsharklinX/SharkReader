import React, { useState } from 'react';
import { Icons, renderAvatar } from './icons';
import { ACHIEVEMENTS, RARITY } from './achievements';

const UserMenu = ({ userProfile, stats, achievements, books, onNavigate, onExport, onImport, onLogout, onDeleteAccount, onShowWorkshop, onEditProfile, importInputRef }) => {
    if (!userProfile) return null;

    const [confirmDelete, setConfirmDelete] = useState(false);

    const lvl = Math.floor((stats.timeRead || 0) / 60) + 1;
    const xpInLevel = (stats.timeRead || 0) % 60;
    const xpPct = (xpInLevel / 60) * 100;

    const recent = Object.entries(achievements)
        .sort((a, b) => (b[1]?.unlockedAt || 0) - (a[1]?.unlockedAt || 0))
        .slice(0, 3)
        .map(([id]) => ACHIEVEMENTS.find(a => a.id === id))
        .filter(Boolean);

    return (
        <div className="absolute top-full mt-2 right-0 bg-[var(--surface-bg)] text-[var(--text-color)] rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden w-72 fade-in"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="p-4 border-b border-[var(--border-color)] flex items-center gap-3 bg-black/5 dark:bg-white/5">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-2xl shadow-lg flex-shrink-0 overflow-hidden">
                    {renderAvatar(userProfile.avatar)}
                </div>
                <div className="flex-1 overflow-hidden min-w-0">
                    <div className="font-black text-lg truncate">{userProfile.name}</div>
                    <p className="text-[10px] opacity-70 uppercase tracking-widest mt-0.5 font-bold" style={{ color: 'var(--highlight)' }}>
                        Nivel {lvl} — Lector
                    </p>
                </div>
                <button onClick={onEditProfile}
                    className="flex-shrink-0 p-2 rounded-xl opacity-40 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition"
                    title="Editar perfil">
                    <Icons.Settings />
                </button>
            </div>

            {/* Stats grid */}
            <div className="p-4 grid grid-cols-3 gap-2 text-center border-b border-[var(--border-color)]">
                {[
                    { v: stats.timeRead >= 60 ? `${Math.floor(stats.timeRead / 60)}h` : `${stats.timeRead || 0}m`, l: 'Tiempo', c: 'var(--highlight)' },
                    { v: stats.pagesTurned || 0, l: 'Páginas', c: '#22c55e' },
                    { v: stats.streak || 0, l: 'Racha 🔥', c: '#f97316' },
                ].map(s => (
                    <div key={s.l} className="bg-black/5 dark:bg-white/5 rounded-xl p-2">
                        <div className="text-lg font-black" style={{ color: s.c }}>{s.v}</div>
                        <div className="text-[8px] uppercase tracking-widest opacity-50 font-bold mt-0.5">{s.l}</div>
                    </div>
                ))}
            </div>

            {/* XP bar */}
            <div className="px-4 py-3 border-b border-[var(--border-color)]">
                <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-black opacity-50 uppercase tracking-widest">Nivel {lvl}</span>
                    <span className="text-[10px] font-black opacity-50">{xpInLevel}/60 min</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${xpPct}%`, background: 'linear-gradient(90deg, var(--progress-bg), var(--highlight))' }} />
                </div>
            </div>

            {/* Recent achievements */}
            {recent.length > 0 && (
                <div className="px-4 py-3 border-b border-[var(--border-color)]">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black opacity-50 uppercase tracking-widest">Últimos Logros</span>
                        <button onClick={() => onNavigate('achievements')} className="text-[10px] font-black opacity-60 hover:opacity-100 transition" style={{ color: 'var(--highlight)' }}>
                            Ver todos →
                        </button>
                    </div>
                    <div className="flex gap-2">
                        {recent.map(a => {
                            const r = RARITY[a.rarity];
                            return (
                                <div key={a.id} title={a.name} className="flex-1 rounded-xl p-2 text-center"
                                    style={{ backgroundColor: r.bg, border: `1px solid ${r.border}` }}>
                                    <div className="text-xl">{a.emoji}</div>
                                    <div className="text-[8px] font-black opacity-70 mt-0.5 truncate">{a.name}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Book stats */}
            <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-[var(--border-color)]">
                {[
                    { v: books.filter(b => b.isFinished).length, l: '📚 Terminados' },
                    { v: books.filter(b => b.lastReadDate > 0 && !b.isFinished).length, l: '📖 Leyendo' },
                    { v: books.reduce((s, b) => s + (b.bookmarks?.length || 0), 0), l: '🔖 Notas' },
                ].map(s => (
                    <div key={s.l} className="bg-black/5 dark:bg-white/5 rounded-xl p-2 text-center">
                        <div className="text-base font-black">{s.v}</div>
                        <div className="text-[8px] opacity-50 font-bold mt-0.5">{s.l}</div>
                    </div>
                ))}
            </div>

            {/* Quick links */}
            <div className="p-3 grid grid-cols-2 gap-2">
                <button onClick={() => onNavigate('analytics')}
                    className="py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:opacity-80 transition text-white"
                    style={{ background: 'linear-gradient(135deg, var(--topbar-bg), var(--highlight))' }}>
                    📊 Analíticas
                </button>
                <button onClick={onShowWorkshop}
                    className="py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:opacity-80 transition bg-black/5 dark:bg-white/5">
                    🔧 Workshop
                </button>
                <button onClick={onExport} className="py-2 bg-black/5 dark:bg-white/5 font-bold rounded-xl flex items-center justify-center gap-1.5 hover:opacity-80 transition text-xs">
                    <Icons.Export /> Exportar
                </button>
                <button onClick={() => importInputRef.current?.click()}
                    className="py-2 bg-black/5 dark:bg-white/5 font-bold rounded-xl flex items-center justify-center gap-1.5 hover:opacity-80 transition text-xs">
                    <Icons.Import /> Importar
                </button>
            </div>

            {/* Session actions */}
            <div className="px-3 pb-3 flex flex-col gap-1.5">
                <button onClick={onLogout} className="w-full py-2 text-orange-400 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-orange-500/10 transition text-sm">
                    <Icons.Close /> Cerrar sesión
                </button>

                {!confirmDelete ? (
                    <button
                        onClick={() => setConfirmDelete(true)}
                        className="w-full py-2 text-red-500/60 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/10 hover:text-red-500 transition text-xs"
                    >
                        🗑️ Eliminar cuenta y todos los datos
                    </button>
                ) : (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                        <p className="text-red-400 text-xs font-bold text-center mb-2">
                            ⚠️ Esto borrará tu perfil, estadísticas y ajustes.<br />
                            <span className="opacity-70 font-normal">Los libros de la biblioteca no se borran.</span>
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmDelete(false)}
                                className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-black/10 hover:bg-black/20 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={onDeleteAccount}
                                className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-red-500 hover:bg-red-600 text-white transition"
                            >
                                Sí, eliminar todo
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserMenu;
