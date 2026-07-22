import React, { useState } from 'react';
import { Icons } from './icons';

export default function StreakModal({ show, onClose, userProfile, stats, dailyGoalMins, setDailyGoalMins, weeklyGoalMins, setWeeklyGoalMins, yearlyGoal, setYearlyGoal, currentWeekMins, books }) {
    const [showSaverInfo, setShowSaverInfo] = useState(false);

    if (!show) return null;
    return (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-in" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label="Tu racha de lectura" className="bg-[var(--surface-bg)] w-full max-w-sm rounded-3xl p-8 shadow-2xl relative border border-[var(--border-color)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} aria-label="Cerrar" className="absolute top-4 right-4 p-2 opacity-50 hover:opacity-100 transition"><Icons.Close /></button>
                <h2 className="text-2xl font-black mb-6 text-orange-500 flex items-center gap-3"><div className="p-2 bg-orange-500/20 rounded-full"><Icons.Fire /></div> Tu Racha</h2>
                {!userProfile ? (
                    <p className="text-center p-4 bg-orange-500/10 rounded-xl text-sm font-bold opacity-80">Inicia sesión para guardar tu racha.</p>
                ) : (
                    <>
                        <div className="flex gap-4 mb-6">
                            <div className="flex-1 bg-black/5 dark:bg-white/5 rounded-2xl p-4 text-center">
                                <span className="text-4xl font-black">{stats.streak}</span>
                                <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mt-1">Días Seguidos</p>
                            </div>
                            <div className="flex-1 bg-blue-500/10 rounded-2xl p-4 text-center border border-blue-500/20 relative">
                                <button onClick={() => setShowSaverInfo(p => !p)} aria-label="¿Qué son los salvadores de racha?" className="absolute -top-2 -right-2 bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">?</button>
                                <span className="text-4xl font-black text-blue-500">{stats.streakSavers || 0}</span><span className="text-xl font-bold text-blue-500/50">/2</span>
                                <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mt-1 text-blue-600 dark:text-blue-400">Salvadores</p>
                                {showSaverInfo && (
                                    <div className="absolute top-8 right-0 w-64 bg-slate-800 text-white p-5 rounded-2xl shadow-2xl border border-blue-500/30 text-xs z-50 text-left">
                                        <div className="flex justify-between items-center mb-2"><strong className="text-blue-400 text-sm font-black">¿Qué es un Salvador?</strong><button onClick={e => { e.stopPropagation(); setShowSaverInfo(false); }}><Icons.Close /></button></div>
                                        Si un día olvidas leer, el sistema usa 1 Salvador para <span className="text-orange-400 font-bold">evitar que tu racha vuelva a cero</span>. Ganas 1 por cada 5 días de racha (máx 2).
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-black/5 dark:bg-white/5 p-5 rounded-2xl mb-2">
                            <h3 className="font-bold text-xs uppercase tracking-widest opacity-50 mb-4 text-center">Últimos 7 Días</h3>
                            <div className="flex justify-between items-center">
                                {Array.from({ length: 7 }).map((_, i) => {
                                    const d = new Date(); d.setDate(d.getDate() - (6 - i));
                                    const ds = d.toDateString(); const st = stats.history?.[ds]; const isToday = i === 6;
                                    let cc = "bg-gray-300 dark:bg-gray-700";
                                    if (st === 'read') cc = "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)] scale-110";
                                    else if (st === 'saved') cc = "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] scale-110";
                                    else if (isToday && stats.currentDailyMins > 0 && stats.currentDailyMins < 5) cc = "bg-orange-400/50 animate-pulse border-orange-500 border-2";
                                    return (
                                        <div key={i} className="flex flex-col items-center gap-2 relative">
                                            {isToday && <div className="absolute -top-4 text-[8px] font-black text-orange-500 uppercase">Hoy</div>}
                                            <div className={`w-8 h-8 rounded-full ${cc} transition-all border border-[var(--surface-bg)] flex items-center justify-center`}>
                                                {isToday && stats.currentDailyMins > 0 && stats.currentDailyMins < 5 && <span className="text-[8px] font-bold text-white">{stats.currentDailyMins}m</span>}
                                            </div>
                                            <span className={`text-[10px] font-bold opacity-60 ${isToday ? 'text-orange-500 opacity-100' : ''}`}>{['D','L','M','X','J','V','S'][d.getDay()]}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <p className="text-[10px] text-center opacity-40 mt-2">*Lee al menos 5 minutos al día para mantener tu racha.*</p>

                        <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-xs font-black opacity-60">🎯 Objetivo diario</p>
                                <span className="text-xs font-black" style={{ color: stats.currentDailyMins >= dailyGoalMins ? '#22c55e' : 'var(--highlight)' }}>
                                    {Math.min(stats.currentDailyMins || 0, dailyGoalMins)} / {dailyGoalMins} min
                                </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-3">
                                <div className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, ((stats.currentDailyMins || 0) / dailyGoalMins) * 100)}%`, backgroundColor: stats.currentDailyMins >= dailyGoalMins ? '#22c55e' : 'var(--highlight)' }} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] opacity-50">15m</span>
                                <input type="range" min="15" max="120" step="5" value={dailyGoalMins}
                                    onChange={e => setDailyGoalMins(Number(e.target.value))}
                                    className="flex-1 accent-[var(--highlight)]" />
                                <span className="text-[10px] opacity-50">2h</span>
                            </div>
                        </div>

                        <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl mt-3">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-xs font-black opacity-60">📅 Meta semanal</p>
                                <span className="text-xs font-black" style={{ color: currentWeekMins >= weeklyGoalMins ? '#22c55e' : 'var(--highlight)' }}>
                                    {currentWeekMins} / {weeklyGoalMins} min
                                </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-3">
                                <div className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, (currentWeekMins / weeklyGoalMins) * 100)}%`, backgroundColor: currentWeekMins >= weeklyGoalMins ? '#22c55e' : 'var(--highlight)' }} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] opacity-50">30m</span>
                                <input type="range" min="30" max="600" step="30" value={weeklyGoalMins}
                                    onChange={e => setWeeklyGoalMins(Number(e.target.value))}
                                    className="flex-1 accent-[var(--highlight)]" />
                                <span className="text-[10px] opacity-50">10h</span>
                            </div>
                        </div>

                        {(() => {
                            const thisYear = new Date().getFullYear();
                            const finishedThisYear = books.filter(b => b.isFinished && b.dateFinished && new Date(b.dateFinished).getFullYear() === thisYear).length;
                            const pct = Math.min(100, (finishedThisYear / yearlyGoal) * 100);
                            return (
                                <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl mt-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-xs font-black opacity-60">📚 Meta {thisYear}</p>
                                        <span className="text-xs font-black" style={{ color: finishedThisYear >= yearlyGoal ? '#22c55e' : 'var(--highlight)' }}>
                                            {finishedThisYear} / {yearlyGoal} libros
                                        </span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-3">
                                        <div className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${pct}%`, backgroundColor: finishedThisYear >= yearlyGoal ? '#22c55e' : 'var(--highlight)' }} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] opacity-50">1</span>
                                        <input type="range" min="1" max="52" step="1" value={yearlyGoal}
                                            onChange={e => setYearlyGoal(Number(e.target.value))}
                                            className="flex-1 accent-[var(--highlight)]" />
                                        <span className="text-[10px] opacity-50">52</span>
                                    </div>
                                </div>
                            );
                        })()}

                        {(() => {
                            const days = Array.from({ length: 30 }).map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (29 - i)); return { mins: (stats.minutesByDay || {})[d.toDateString()] || 0 }; });
                            const mx = Math.max(...days.map(d => d.mins), 1);
                            return (
                                <div className="bg-black/5 dark:bg-white/5 p-5 rounded-2xl mt-4">
                                    <h3 className="font-bold text-xs uppercase tracking-widest opacity-50 mb-4 text-center">Minutos — últimos 30 días</h3>
                                    <div className="flex items-end gap-0.5 h-20">
                                        {days.map((d, i) => (
                                            <div key={i} className="flex-1 group relative">
                                                <div className="w-full rounded-t-sm transition-all duration-500" style={{ height: `${Math.max(2, (d.mins / mx) * 100)}%`, background: d.mins > 0 ? 'linear-gradient(to top, var(--progress-bg), var(--highlight))' : 'rgba(128,128,128,0.15)' }} />
                                                {d.mins > 0 && <div className="absolute bottom-full mb-1 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded-md font-black opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">{d.mins}m</div>}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between mt-1"><span className="text-[9px] opacity-30">hace 30d</span><span className="text-[9px] opacity-30">hoy</span></div>
                                </div>
                            );
                        })()}
                    </>
                )}
            </div>
        </div>
    );
}
