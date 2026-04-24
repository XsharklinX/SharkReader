import React, { useMemo, useState } from 'react';
import { ACHIEVEMENTS, RARITY } from './achievements';

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function heatColor(minutes) {
    if (!minutes) return 'var(--border-color)';
    if (minutes < 15) return '#1e3a5f';
    if (minutes < 30) return '#1d4ed8';
    if (minutes < 60) return '#3b82f6';
    return 'var(--highlight)';
}

function fmtTime(mins) {
    if (!mins) return '0m';
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins}m`;
}

const AchievementCard = ({ achievement, unlocked, unlockedAt }) => {
    const r = RARITY[achievement.rarity];
    return (
        <div title={unlocked ? `Desbloqueado ${unlockedAt ? new Date(unlockedAt).toLocaleDateString() : ''}` : 'Bloqueado'}
            className="rounded-2xl p-3 flex items-center gap-3 transition"
            style={{ backgroundColor: unlocked ? r.bg : 'rgba(128,128,128,0.05)', border: `1px solid ${unlocked ? r.border : 'rgba(128,128,128,0.1)'}`, opacity: unlocked ? 1 : 0.5 }}>
            <div className="text-2xl flex-shrink-0" style={{ filter: unlocked ? 'none' : 'grayscale(1)' }}>{achievement.emoji}</div>
            <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-sm truncate">{achievement.name}</span>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0" style={{ backgroundColor: r.bg, color: r.color, border: `1px solid ${r.border}` }}>{r.label}</span>
                </div>
                <p className="text-[11px] opacity-60 leading-tight mt-0.5">{achievement.desc}</p>
            </div>
            {unlocked && <div className="flex-shrink-0 text-lg">✅</div>}
        </div>
    );
};

const AnalyticsView = ({ stats, books, vocabulary, achievements, yearlyGoal, onBack }) => {
    const [activeTab, setActiveTab] = useState('stats');

    // ── Heatmap ──────────────────────────────────────────────────────────────
    const weeks = useMemo(() => {
        const today = new Date();
        const year = today.getFullYear();
        const jan1 = new Date(year, 0, 1);
        // Start from first Sunday on or before Jan 1
        const startDay = new Date(jan1);
        while (startDay.getDay() !== 0) startDay.setDate(startDay.getDate() - 1);

        const result = [];
        const cur = new Date(startDay);
        while (cur <= today || result.length < 53) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                const inYear = cur.getFullYear() === year && cur <= today;
                week.push({
                    date: cur.toDateString(),
                    dateObj: new Date(cur),
                    minutes: inYear ? ((stats.minutesByDay || {})[cur.toDateString()] || 0) : -1,
                    month: cur.getMonth(),
                    day: cur.getDate(),
                });
                cur.setDate(cur.getDate() + 1);
            }
            result.push(week);
            if (result.length >= 53 && cur > today) break;
        }
        return result;
    }, [stats.minutesByDay]);

    // ── Top 5 books ──────────────────────────────────────────────────────────
    const topBooks = useMemo(() =>
        [...books].filter(b => (b.readingMinutes || 0) > 0)
            .sort((a, b) => (b.readingMinutes || 0) - (a.readingMinutes || 0))
            .slice(0, 5),
        [books]);
    const maxBookTime = topBooks[0]?.readingMinutes || 1;

    // ── Weekly data (last 12 weeks) ───────────────────────────────────────
    const weeklyData = useMemo(() => {
        return Array.from({ length: 12 }, (_, w) => {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay() - (11 - w) * 7);
            let total = 0;
            for (let d = 0; d < 7; d++) {
                const day = new Date(weekStart);
                day.setDate(day.getDate() + d);
                total += (stats.minutesByDay || {})[day.toDateString()] || 0;
            }
            return { w, minutes: total };
        });
    }, [stats.minutesByDay]);
    const maxWeekly = Math.max(...weeklyData.map(w => w.minutes), 1);

    // ── Hourly pattern ────────────────────────────────────────────────────
    const hourlyData = useMemo(() =>
        Array.from({ length: 24 }, (_, i) => ({ hour: i, minutes: (stats.hourlyLog || {})[i] || 0 })),
        [stats.hourlyLog]);
    const maxHourly = Math.max(...hourlyData.map(h => h.minutes), 1);

    // ── Summary stats ─────────────────────────────────────────────────────
    const totalMins = stats.timeRead || 0;
    const daysRead = Object.keys(stats.minutesByDay || {}).filter(k => (stats.minutesByDay[k] || 0) >= 5).length;
    const avgSession = daysRead > 0 ? Math.round(totalMins / daysRead) : 0;
    const booksFinished = books.filter(b => b.isFinished).length;
    const wpm = totalMins > 10 ? Math.round(((stats.pagesTurned || 0) * 250) / totalMins) : 0;
    const totalBookmarks = books.reduce((s, b) => s + (b.bookmarks?.length || 0), 0);

    // ── Reading personality ───────────────────────────────────────────────
    const personality = useMemo(() => {
        const hl = stats.hourlyLog || {};
        const night = (hl[22] || 0) + (hl[23] || 0) + (hl[0] || 0) + (hl[1] || 0);
        const morning = (hl[5] || 0) + (hl[6] || 0) + (hl[7] || 0) + (hl[8] || 0);
        if (wpm >= 300) return { title: 'Lector Veloz', emoji: '🚀', color: '#a855f7' };
        if (night > morning && night > 5) return { title: 'Búho Nocturno', emoji: '🦉', color: '#6366f1' };
        if (morning > night && morning > 5) return { title: 'Madrugador', emoji: '🌅', color: '#f59e0b' };
        if (avgSession >= 60) return { title: 'Lector de Maratón', emoji: '⚡', color: '#22c55e' };
        if (stats.streak >= 7) return { title: 'Lector Constante', emoji: '🔥', color: '#f97316' };
        return { title: 'Explorador', emoji: '📚', color: 'var(--highlight)' };
    }, [stats.hourlyLog, wpm, avgSession, stats.streak]);

    // ── Month labels for heatmap ──────────────────────────────────────────
    const monthLabels = useMemo(() => {
        const labels = [];
        let lastMonth = -1;
        weeks.forEach((week, wi) => {
            const firstVisibleDay = week.find(d => d.minutes >= 0);
            if (firstVisibleDay && firstVisibleDay.month !== lastMonth && firstVisibleDay.day <= 7) {
                labels.push({ wi, month: firstVisibleDay.month });
                lastMonth = firstVisibleDay.month;
            } else {
                labels.push(null);
            }
        });
        return labels;
    }, [weeks]);

    const tabs = [
        { id: 'stats', label: '📊 Estadísticas' },
        { id: 'achievements', label: '🏆 Logros' },
    ];

    const unlockedCount = Object.keys(achievements).length;

    return (
        <div className="w-full h-full flex flex-col" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
            {/* Header */}
            <div className="flex-shrink-0 flex items-center gap-4 px-5 h-16 border-b text-white z-10"
                style={{ background: 'linear-gradient(to right, var(--topbar-bg), var(--highlight))', borderColor: 'rgba(255,255,255,0.1)' }}>
                <button onClick={onBack} className="p-2 hover:bg-black/20 rounded-full transition flex-shrink-0">
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" /></svg>
                </button>
                <div className="flex items-center gap-3 flex-1">
                    <span className="text-2xl">📊</span>
                    <div>
                        <h1 className="font-black text-lg leading-none">Analíticas</h1>
                        <p className="text-[10px] opacity-60 uppercase tracking-widest">{personality.emoji} {personality.title}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${activeTab === tab.id ? 'bg-white/20' : 'opacity-60 hover:opacity-100'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {activeTab === 'stats' && (
                    <div className="p-5 space-y-5 max-w-5xl mx-auto w-full">
                        {/* Summary cards */}
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                            {[
                                { label: 'Tiempo Total', value: fmtTime(totalMins), icon: '⏱️', color: 'var(--highlight)' },
                                { label: 'Terminados', value: booksFinished, icon: '✅', color: '#22c55e' },
                                { label: 'Racha', value: `${stats.streak || 0}d`, icon: '🔥', color: '#f97316' },
                                { label: 'Velocidad', value: wpm > 0 ? `${wpm}wpm` : '—', icon: '🚀', color: '#a855f7' },
                                { label: 'Sesión Media', value: fmtTime(avgSession), icon: '📈', color: '#3b82f6' },
                                { label: 'Anotaciones', value: totalBookmarks, icon: '🔖', color: '#f59e0b' },
                            ].map(s => (
                                <div key={s.label} className="rounded-2xl p-3 text-center flex flex-col items-center"
                                    style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                                    <div className="text-xl mb-1">{s.icon}</div>
                                    <div className="text-lg font-black leading-none" style={{ color: s.color }}>{s.value}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-wider opacity-50 mt-1">{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Heatmap */}
                        <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                            <h2 className="font-black text-sm mb-3 opacity-80">📅 Heatmap {new Date().getFullYear()}</h2>
                            <div className="overflow-x-auto">
                                <div style={{ display: 'flex', gap: 3, minWidth: 'max-content' }}>
                                    {/* Day labels */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 2 }}>
                                        <div style={{ height: 16 }} />
                                        {DAYS_SHORT.map((d, i) => (
                                            <div key={d} style={{ height: 11, fontSize: 9, fontWeight: 'bold', opacity: 0.4, lineHeight: '11px', textAlign: 'right', width: 10 }}>
                                                {i % 2 === 1 ? d : ''}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Weeks */}
                                    {weeks.map((week, wi) => (
                                        <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <div style={{ height: 16, fontSize: 9, fontWeight: 'bold', opacity: 0.4, lineHeight: '16px', whiteSpace: 'nowrap' }}>
                                                {monthLabels[wi] ? MONTHS_SHORT[monthLabels[wi].month] : ''}
                                            </div>
                                            {week.map((day, di) => (
                                                <div key={di}
                                                    title={day.minutes >= 0 ? `${day.date}: ${day.minutes}min` : ''}
                                                    style={{
                                                        width: 11, height: 11, borderRadius: 2, flexShrink: 0,
                                                        backgroundColor: day.minutes < 0 ? 'transparent' : heatColor(day.minutes),
                                                        border: day.minutes >= 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                                {/* Legend */}
                                <div className="flex items-center gap-2 mt-3" style={{ opacity: 0.5 }}>
                                    <span style={{ fontSize: 9 }}>Menos</span>
                                    {[0, 5, 20, 40, 70].map((v, i) => (
                                        <div key={i} style={{ width: 11, height: 11, borderRadius: 2, backgroundColor: heatColor(v), border: '1px solid rgba(255,255,255,0.1)' }} />
                                    ))}
                                    <span style={{ fontSize: 9 }}>Más</span>
                                </div>
                            </div>
                        </div>

                        {/* Top 5 + Hourly */}
                        <div className="grid md:grid-cols-2 gap-5">
                            {/* Top 5 */}
                            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                                <h2 className="font-black text-sm mb-4 opacity-80">🏆 Top 5 por Tiempo Leído</h2>
                                {topBooks.length === 0 ? (
                                    <p className="text-sm opacity-40 italic text-center py-6">Aún no hay datos.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {topBooks.map((book, i) => {
                                            const pct = Math.round((book.readingMinutes / maxBookTime) * 100);
                                            return (
                                                <div key={book.id} className="space-y-1.5">
                                                    <div className="flex justify-between items-center gap-2">
                                                        <span className="text-xs font-bold truncate flex-1">{i + 1}. {book.name}</span>
                                                        <span className="text-xs font-black opacity-60 flex-shrink-0">{fmtTime(book.readingMinutes)}</span>
                                                    </div>
                                                    <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--border-color)' }}>
                                                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--progress-bg), var(--highlight))' }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Hourly pattern */}
                            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                                <h2 className="font-black text-sm mb-4 opacity-80">🕐 ¿Cuándo Lees Más?</h2>
                                {maxHourly <= 0 ? (
                                    <p className="text-sm opacity-40 italic text-center py-6">Aún sin datos horarios.</p>
                                ) : (
                                    <div className="flex items-end gap-0.5" style={{ height: 90 }}>
                                        {hourlyData.map(h => (
                                            <div key={h.hour} className="flex-1 flex flex-col items-center group relative" style={{ height: '100%', justifyContent: 'flex-end' }}>
                                                <div className="w-full rounded-t-sm"
                                                    style={{ height: `${Math.max(3, (h.minutes / maxHourly) * 72)}px`, background: h.minutes > 0 ? 'linear-gradient(to top, var(--progress-bg), var(--highlight))' : 'rgba(128,128,128,0.12)' }} />
                                                {h.minutes > 0 && (
                                                    <div className="absolute bottom-full mb-1 bg-slate-900 text-white text-[8px] px-1 py-0.5 rounded font-black opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">{h.minutes}m</div>
                                                )}
                                                {h.hour % 6 === 0 && <div className="text-[8px] opacity-30 font-bold mt-0.5">{h.hour}h</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Weekly line chart */}
                        <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                            <h2 className="font-black text-sm mb-4 opacity-80">📈 Minutos por Semana — Últimas 12</h2>
                            {maxWeekly <= 1 ? (
                                <p className="text-sm opacity-40 italic text-center py-6">Comienza a leer para ver la gráfica.</p>
                            ) : (() => {
                                const W = 600; const H = 100; const PAD = 10;
                                const pts = weeklyData.map((d, i) => {
                                    const x = PAD + (i / (weeklyData.length - 1)) * (W - PAD * 2);
                                    const y = H - PAD - ((d.minutes / maxWeekly) * (H - PAD * 2));
                                    return `${x},${y}`;
                                });
                                return (
                                    <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`} preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id="wkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" stopColor="var(--highlight)" stopOpacity="0.35" />
                                                <stop offset="100%" stopColor="var(--highlight)" stopOpacity="0.03" />
                                            </linearGradient>
                                        </defs>
                                        <path d={`M ${pts[0]} L ${pts.slice(1).join(' L ')} L ${pts[pts.length - 1].split(',')[0]},${H - PAD} L ${PAD},${H - PAD} Z`} fill="url(#wkGrad)" />
                                        <polyline points={pts.join(' ')} fill="none" stroke="var(--highlight)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                                        {weeklyData.map((d, i) => {
                                            const x = PAD + (i / (weeklyData.length - 1)) * (W - PAD * 2);
                                            const y = H - PAD - ((d.minutes / maxWeekly) * (H - PAD * 2));
                                            return <circle key={i} cx={x} cy={y} r="3.5" fill="var(--highlight)" stroke="var(--surface-bg)" strokeWidth="2" />;
                                        })}
                                        <text x={PAD} y={H + 14} fontSize="9" fill="currentColor" opacity="0.3">hace 12 sem</text>
                                        <text x={W - PAD} y={H + 14} fontSize="9" fill="currentColor" opacity="0.3" textAnchor="end">esta sem</text>
                                    </svg>
                                );
                            })()}
                        </div>

                        {/* Book comparison table */}
                        <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                            <h2 className="font-black text-sm mb-4 opacity-80">📚 Comparativa de Libros</h2>
                            {books.filter(b => b.lastReadDate > 0).length === 0 ? (
                                <p className="text-sm opacity-40 italic text-center py-4">Abre libros para ver comparativas.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs min-w-[480px]">
                                        <thead>
                                            <tr style={{ opacity: 0.4 }}>
                                                <th className="text-left pb-3 font-black uppercase tracking-wider">Libro</th>
                                                <th className="text-right pb-3 font-black uppercase tracking-wider">Progreso</th>
                                                <th className="text-right pb-3 font-black uppercase tracking-wider">Tiempo</th>
                                                <th className="text-right pb-3 font-black uppercase tracking-wider">WPM</th>
                                                <th className="text-right pb-3 font-black uppercase tracking-wider">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...books].filter(b => b.lastReadDate > 0)
                                                .sort((a, b) => (b.readingMinutes || 0) - (a.readingMinutes || 0))
                                                .slice(0, 12)
                                                .map(book => {
                                                    const wpmBook = (book.readingMinutes || 0) > 5 ? Math.round(((book.progress || 0) / 100 * 60000) / book.readingMinutes) : 0;
                                                    return (
                                                        <tr key={book.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                                                            <td className="py-2 font-semibold max-w-[160px] truncate pr-4">{book.name}</td>
                                                            <td className="py-2 text-right font-black" style={{ color: 'var(--highlight)' }}>{book.progress || 0}%</td>
                                                            <td className="py-2 text-right opacity-60">{fmtTime(book.readingMinutes)}</td>
                                                            <td className="py-2 text-right opacity-60">{wpmBook > 0 ? wpmBook : '—'}</td>
                                                            <td className="py-2 text-right">{book.isFinished ? '✅' : book.lastReadDate > 0 ? '📖' : '📚'}</td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'achievements' && (
                    <div className="p-5 max-w-3xl mx-auto w-full">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="font-black text-lg">Mis Logros</h2>
                            <div className="flex items-center gap-2">
                                <div className="text-sm font-black" style={{ color: 'var(--highlight)' }}>{unlockedCount} / {ACHIEVEMENTS.length}</div>
                                <div className="w-24 h-2 rounded-full" style={{ backgroundColor: 'var(--border-color)' }}>
                                    <div className="h-full rounded-full transition-all" style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%`, backgroundColor: 'var(--highlight)' }} />
                                </div>
                            </div>
                        </div>
                        {['legendary', 'epic', 'rare', 'common'].map(rarity => {
                            const group = ACHIEVEMENTS.filter(a => a.rarity === rarity);
                            const r = RARITY[rarity];
                            return (
                                <div key={rarity} className="mb-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                                        <span className="text-xs font-black uppercase tracking-widest" style={{ color: r.color }}>{r.label}</span>
                                        <span className="text-xs opacity-40">— {group.filter(a => achievements[a.id]).length}/{group.length}</span>
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-2">
                                        {group.map(a => (
                                            <AchievementCard key={a.id} achievement={a} unlocked={!!achievements[a.id]} unlockedAt={achievements[a.id]?.unlockedAt} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalyticsView;
