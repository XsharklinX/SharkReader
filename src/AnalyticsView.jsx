import React, { useMemo, useState, lazy, Suspense } from 'react';
import { ACHIEVEMENTS, RARITY, isAchievementVisible } from './achievements';
const YearWrapped = lazy(() => import('./YearWrapped'));

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
            {unlocked && (
                <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: r.color, opacity: 0.9 }}>
                    <span className="text-white text-[10px] font-black leading-none">✓</span>
                </div>
            )}
        </div>
    );
};

const LEVEL_NAMES = ['Aprendiz', 'Curioso', 'Lector', 'Devorador', 'Bibliófilo', 'Sabio', 'Leyenda'];

const AnalyticsView = ({ stats, books, vocabulary, achievements, yearlyGoal, addons = {}, addonConfig = {}, initialTab = 'stats', onBack, dailyGoalMins = 30, weeklyGoalMins = 120, currentWeekMins = 0, readerLevel, journalEntries = [] }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [chartPeriod, setChartPeriod] = useState('week');
    const [showWrapped, setShowWrapped] = useState(false);
    const [planGoal, setPlanGoal] = useState('');
    const [planDate, setPlanDate] = useState(() => {
        const d = new Date(); d.setFullYear(d.getFullYear() + 1);
        return d.toISOString().slice(0, 10);
    });

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

    // ── Daily data (last 30 days) ─────────────────────────────────────────
    const dayData = useMemo(() => {
        return Array.from({ length: 30 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (29 - i));
            return {
                label: (i === 0 || i === 29 || i % 7 === 0) ? `${d.getDate()}/${d.getMonth() + 1}` : '',
                minutes: (stats.minutesByDay || {})[d.toDateString()] || 0,
            };
        });
    }, [stats.minutesByDay]);
    const maxDay = Math.max(...dayData.map(d => d.minutes), 1);

    // ── Monthly data (last 12 months) ─────────────────────────────────────
    const monthData = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - (11 - i));
            const y = d.getFullYear(); const m = d.getMonth();
            const total = Object.entries(stats.minutesByDay || {}).reduce((sum, [dateStr, mins]) => {
                const dt = new Date(dateStr);
                return (dt.getFullYear() === y && dt.getMonth() === m) ? sum + mins : sum;
            }, 0);
            return { label: MONTHS_SHORT[m], minutes: total };
        });
    }, [stats.minutesByDay]);
    const maxMonth = Math.max(...monthData.map(d => d.minutes), 1);

    // ── Current month minutes ─────────────────────────────────────────────
    const currentMonthMins = useMemo(() => {
        const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
        return Object.entries(stats.minutesByDay || {}).reduce((sum, [dateStr, mins]) => {
            const d = new Date(dateStr);
            return (d.getFullYear() === y && d.getMonth() === m) ? sum + mins : sum;
        }, 0);
    }, [stats.minutesByDay]);

    // ── Summary stats ─────────────────────────────────────────────────────
    const totalMins = stats.timeRead || 0;
    const daysRead = Object.keys(stats.minutesByDay || {}).filter(k => (stats.minutesByDay[k] || 0) >= 5).length;
    const avgSession = daysRead > 0 ? Math.round(totalMins / daysRead) : 0;
    const booksFinished = books.filter(b => b.isFinished).length;

    const totalBookmarks = books.reduce((s, b) => s + (b.bookmarks?.length || 0), 0);

    // ── Reading personality ───────────────────────────────────────────────
    const personality = useMemo(() => {
        const hl = stats.hourlyLog || {};
        const night = (hl[22] || 0) + (hl[23] || 0) + (hl[0] || 0) + (hl[1] || 0);
        const morning = (hl[5] || 0) + (hl[6] || 0) + (hl[7] || 0) + (hl[8] || 0);
        if (night > morning && night > 5) return { title: 'Búho Nocturno', emoji: '🦉', color: '#6366f1' };
        if (morning > night && morning > 5) return { title: 'Madrugador', emoji: '🌅', color: '#f59e0b' };
        if (avgSession >= 60) return { title: 'Lector de Maratón', emoji: '⚡', color: '#22c55e' };
        if (stats.streak >= 7) return { title: 'Lector Constante', emoji: '🔥', color: '#f97316' };
        return { title: 'Explorador', emoji: '📚', color: 'var(--highlight)' };
    }, [stats.hourlyLog, avgSession, stats.streak]);

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
        ...(addons.readingJournal && journalEntries.length > 0 ? [{ id: 'journal', label: '📓 Diario' }] : []),
    ];

    const achievementContext = { stats, books, vocabulary, achievements, yearlyGoal, addons, addonConfig };
    const visibleAchievements = ACHIEVEMENTS.filter(achievement => isAchievementVisible(achievement, achievementContext, achievements));
    const visibleUnlockedCount = visibleAchievements.filter(achievement => achievements[achievement.id]).length;

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
                    <button title="Exportar estadísticas" onClick={() => {
                        const payload = { stats, booksCount: books.length, booksFinished, daysRead, avgSession, totalBookmarks, vocabulary: vocabulary.length, top5: books.filter(b => b.readingMinutes > 0).sort((a,z) => z.readingMinutes - a.readingMinutes).slice(0,5).map(b => ({ name: b.name, author: b.author, mins: b.readingMinutes, progress: b.progress })) };
                        const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
                        const a = document.createElement('a'); a.href = url; a.download = 'SharkReader_Stats.json'; a.click(); URL.revokeObjectURL(url);
                    }} className="px-2 py-1.5 rounded-xl text-xs font-bold opacity-60 hover:opacity-100 hover:bg-white/20 transition">.JSON</button>
                    <button title="Exportar como CSV" onClick={() => {
                        const top5 = books.filter(b => b.readingMinutes > 0).sort((a,z) => z.readingMinutes - a.readingMinutes).slice(0,5);
                        const rows = [['Libro','Autor','Minutos','Progreso','Terminado'], ...top5.map(b => [b.name, b.author||'', b.readingMinutes||0, b.progress||0, b.isFinished?'Sí':'No'])];
                        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
                        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
                        const a = document.createElement('a'); a.href = url; a.download = 'SharkReader_Top5.csv'; a.click(); URL.revokeObjectURL(url);
                    }} className="px-2 py-1.5 rounded-xl text-xs font-bold opacity-60 hover:opacity-100 hover:bg-white/20 transition">.CSV</button>
                    <button onClick={() => setShowWrapped(true)}
                        className="px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5"
                        style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
                        title={`Resumen ${new Date().getFullYear()}`}>
                        ✨ Wrapped
                    </button>
                </div>
            </div>

            {showWrapped && (
                <Suspense fallback={null}>
                    <YearWrapped stats={stats} books={books} onClose={() => setShowWrapped(false)} />
                </Suspense>
            )}

            <div className="flex-1 overflow-y-auto">
                {activeTab === 'stats' && (
                    <div className="p-5 space-y-5 max-w-5xl mx-auto w-full">
                        {/* Summary cards */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {[
                                { label: 'Tiempo Total', value: fmtTime(totalMins), sub: null, icon: '⏱️', color: 'var(--highlight)' },
                                { label: 'Terminados', value: booksFinished, sub: null, icon: '✅', color: '#22c55e' },
                                { label: 'Racha', value: `${stats.streak || 0}d`, sub: `Máx: ${stats.maxStreak || 0}d`, icon: '🔥', color: '#f97316' },
                                { label: 'Sesión Media', value: fmtTime(avgSession), sub: `${daysRead}d activos`, icon: '📈', color: '#3b82f6' },
                                { label: 'Anotaciones', value: totalBookmarks, sub: null, icon: '🔖', color: '#f59e0b' },
                            ].map(s => (
                                <div key={s.label} className="rounded-2xl p-3 text-center flex flex-col items-center"
                                    style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                                    <div className="text-xl mb-1">{s.icon}</div>
                                    <div className="text-lg font-black leading-none" style={{ color: s.color }}>{s.value}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-wider opacity-50 mt-0.5">{s.label}</div>
                                    {s.sub && <div className="text-[8px] opacity-30 mt-0.5">{s.sub}</div>}
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
                                        <div key={week[0]?.date || wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <div style={{ height: 16, fontSize: 9, fontWeight: 'bold', opacity: 0.4, lineHeight: '16px', whiteSpace: 'nowrap' }}>
                                                {monthLabels[wi] ? MONTHS_SHORT[monthLabels[wi].month] : ''}
                                            </div>
                                            {week.map((day) => (
                                                <div key={day.date}
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
                                    {[0, 5, 20, 40, 70].map((v) => (
                                        <div key={v} style={{ width: 11, height: 11, borderRadius: 2, backgroundColor: heatColor(v), border: '1px solid rgba(255,255,255,0.1)' }} />
                                    ))}
                                    <span style={{ fontSize: 9 }}>Más</span>
                                </div>
                            </div>
                        </div>

                        {/* Multi-period chart */}
                        <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-black text-sm opacity-80">📈 Actividad de lectura</h2>
                                <div className="flex gap-1">
                                    {[['day', 'Días'], ['week', 'Semanas'], ['month', 'Meses']].map(([p, lbl]) => (
                                        <button key={p} onClick={() => setChartPeriod(p)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${chartPeriod === p ? 'text-white' : 'opacity-40 hover:opacity-70'}`}
                                            style={chartPeriod === p ? { backgroundColor: 'var(--highlight)' } : {}}>
                                            {lbl}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {(() => {
                                const W = 600; const H = 90; const PAD = 10;
                                if (chartPeriod === 'week') {
                                    if (maxWeekly <= 1) return <p className="text-sm opacity-40 italic text-center py-6">Comienza a leer para ver la gráfica.</p>;
                                    const pts = weeklyData.map((d, i) => {
                                        const x = PAD + (i / (weeklyData.length - 1)) * (W - PAD * 2);
                                        const y = H - PAD - ((d.minutes / maxWeekly) * (H - PAD * 2));
                                        return `${x},${y}`;
                                    });
                                    return (
                                        <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`} preserveAspectRatio="none">
                                            <defs><linearGradient id="wkGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="var(--highlight)" stopOpacity="0.35" /><stop offset="100%" stopColor="var(--highlight)" stopOpacity="0.03" /></linearGradient></defs>
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
                                }
                                if (chartPeriod === 'day') {
                                    if (maxDay <= 1) return <p className="text-sm opacity-40 italic text-center py-6">Comienza a leer para ver la gráfica.</p>;
                                    const slots = dayData.length;
                                    const slotW = (W - PAD * 2) / slots;
                                    const barW = Math.max(1, slotW - 2);
                                    return (
                                        <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`} preserveAspectRatio="none">
                                            {dayData.map((d, i) => {
                                                const bh = d.minutes > 0 ? Math.max(2, Math.round((d.minutes / maxDay) * (H - PAD))) : 0;
                                                const x = PAD + i * slotW;
                                                return (
                                                    <g key={i}>
                                                        {bh > 0 && <rect x={x} y={H - bh} width={barW} height={bh} rx="1.5" fill="var(--highlight)" opacity={0.5 + 0.5 * (d.minutes / maxDay)} />}
                                                        {d.label && <text x={x + barW / 2} y={H + 14} fontSize="8" fill="currentColor" opacity="0.35" textAnchor="middle">{d.label}</text>}
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                    );
                                }
                                // month
                                if (maxMonth <= 1) return <p className="text-sm opacity-40 italic text-center py-6">Comienza a leer para ver la gráfica.</p>;
                                const slots = monthData.length;
                                const slotW = (W - PAD * 2) / slots;
                                const barW = Math.max(1, slotW - 4);
                                return (
                                    <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`} preserveAspectRatio="none">
                                        {monthData.map((d, i) => {
                                            const bh = d.minutes > 0 ? Math.max(2, Math.round((d.minutes / maxMonth) * (H - PAD))) : 0;
                                            const x = PAD + i * slotW;
                                            return (
                                                <g key={i}>
                                                    {bh > 0 && <rect x={x} y={H - bh} width={barW} height={bh} rx="2" fill="var(--highlight)" opacity={0.5 + 0.5 * (d.minutes / maxMonth)} />}
                                                    <text x={x + barW / 2} y={H + 14} fontSize="9" fill="currentColor" opacity="0.4" textAnchor="middle">{d.label}</text>
                                                </g>
                                            );
                                        })}
                                    </svg>
                                );
                            })()}
                        </div>

                        {/* Reading goals */}
                        <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                            <h2 className="font-black text-sm mb-4 opacity-80">🎯 Metas de lectura</h2>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Hoy', current: stats.currentDailyMins || 0, goal: dailyGoalMins, color: '#3b82f6' },
                                    { label: 'Esta semana', current: currentWeekMins, goal: weeklyGoalMins, color: '#22c55e' },
                                    { label: 'Este mes', current: currentMonthMins, goal: weeklyGoalMins * 4, color: '#a855f7' },
                                ].map(({ label, current, goal, color }) => {
                                    const pct = Math.min(100, goal > 0 ? Math.round((current / goal) * 100) : 0);
                                    const done = pct >= 100;
                                    return (
                                        <div key={label} className="rounded-xl p-3 flex flex-col gap-1.5"
                                            style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-[9px] font-bold uppercase tracking-wider opacity-50">{label}</span>
                                                <span className="text-[10px] font-black" style={{ color: done ? '#22c55e' : color }}>{done ? '✓' : `${pct}%`}</span>
                                            </div>
                                            <div className="text-base font-black leading-none" style={{ color }}>{fmtTime(current)}</div>
                                            <div className="text-[9px] opacity-35">meta: {fmtTime(goal)}</div>
                                            <div className="w-full h-1.5 rounded-full mt-0.5" style={{ background: 'var(--border-color)' }}>
                                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: done ? '#22c55e' : color }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Plan de lectura */}
                        {(() => {
                            const goalN = parseInt(planGoal);
                            const booksFinished = books.filter(b => b.isFinished).length;
                            const targetDate = planDate ? new Date(planDate) : null;
                            const daysLeft = targetDate ? Math.max(0, Math.round((targetDate - new Date()) / 86400000)) : null;
                            const booksLeft = goalN > 0 ? Math.max(0, goalN - booksFinished) : null;
                            const daysPerBook = (booksLeft > 0 && daysLeft > 0) ? Math.round(daysLeft / booksLeft) : null;
                            return (
                                <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                                    <h2 className="font-black text-sm mb-4 opacity-80">📅 Plan de lectura</h2>
                                    <div className="flex flex-wrap items-end gap-4 mb-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black uppercase tracking-wider opacity-50">Quiero leer</label>
                                            <div className="flex items-center gap-2">
                                                <input type="number" min="1" max="9999" value={planGoal} onChange={e => setPlanGoal(e.target.value)} placeholder="N libros"
                                                    className="w-24 rounded-xl px-3 py-2 text-sm font-bold outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                                    style={{ background: 'var(--bg-color)', color: 'var(--text-color)' }} />
                                                <span className="text-sm opacity-60">libros antes del</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black uppercase tracking-wider opacity-50">Fecha límite</label>
                                            <input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)}
                                                className="rounded-xl px-3 py-2 text-sm font-bold outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                                style={{ background: 'var(--bg-color)', color: 'var(--text-color)' }} />
                                        </div>
                                    </div>
                                    {goalN > 0 && daysLeft !== null && (
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { label: 'Terminados', value: `${booksFinished} / ${goalN}`, color: 'var(--highlight)' },
                                                { label: 'Días restantes', value: `${daysLeft}d`, color: '#f59e0b' },
                                                { label: daysPerBook !== null ? 'Días por libro' : 'Meta cumplida', value: daysPerBook !== null ? `${daysPerBook}d` : '🏆', color: booksLeft === 0 ? '#22c55e' : '#a855f7' },
                                            ].map(s => (
                                                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                                                    <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
                                                    <div className="text-[9px] font-bold uppercase tracking-wider opacity-50 mt-0.5">{s.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Top 5 libros por tiempo */}
                        {(() => {
                            const top = books.filter(b => (b.readingMinutes || 0) > 0).sort((a, z) => (z.readingMinutes || 0) - (a.readingMinutes || 0)).slice(0, 5);
                            if (!top.length) return null;
                            const maxMins = top[0].readingMinutes || 1;
                            return (
                                <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                                    <h2 className="font-black text-sm mb-4 opacity-80">📚 Top 5 — Más tiempo leyendo</h2>
                                    <div className="space-y-3">
                                        {top.map((b, i) => (
                                            <div key={b.id} className="flex items-center gap-3">
                                                <span className="text-[10px] font-black opacity-30 w-4 text-right flex-shrink-0">{i + 1}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <span className="text-xs font-bold truncate">{b.name}</span>
                                                        <span className="text-[10px] font-black opacity-60 ml-2 flex-shrink-0">{fmtTime(b.readingMinutes)}</span>
                                                    </div>
                                                    <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--border-color)' }}>
                                                        <div className="h-full rounded-full" style={{ width: `${Math.round((b.readingMinutes / maxMins) * 100)}%`, backgroundColor: 'var(--highlight)', opacity: 1 - i * 0.15 }} />
                                                    </div>
                                                </div>
                                                {b.isFinished && <span className="text-[10px] flex-shrink-0">✅</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Annual goal projection */}
                        {yearlyGoal > 0 && (() => {
                            const today = new Date();
                            const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 1)) / 86400000) + 1;
                            const daysInYear = today.getFullYear() % 4 === 0 ? 366 : 365;
                            const daysLeft = daysInYear - dayOfYear;
                            const rate = dayOfYear > 0 ? booksFinished / dayOfYear : 0;
                            const projected = Math.round(rate * daysInYear);
                            const pctGoal = Math.min(100, Math.round((booksFinished / yearlyGoal) * 100));
                            const onTrack = projected >= yearlyGoal;
                            const booksNeeded = Math.max(0, yearlyGoal - booksFinished);
                            const daysPerBook = booksNeeded > 0 && daysLeft > 0 ? Math.round(daysLeft / booksNeeded) : null;
                            return (
                                <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                                    <div className="flex items-center justify-between mb-3">
                                        <h2 className="font-black text-sm opacity-80">🎯 Proyección de Meta Anual</h2>
                                        <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: onTrack ? 'rgba(34,197,94,0.15)' : 'rgba(249,115,22,0.15)', color: onTrack ? '#22c55e' : '#f97316' }}>
                                            {onTrack ? 'En camino ✓' : 'Necesitas acelerar'}
                                        </span>
                                    </div>
                                    <div className="flex items-end gap-6 mb-4">
                                        <div>
                                            <div className="text-3xl font-black" style={{ color: 'var(--highlight)' }}>{booksFinished}<span className="text-base opacity-50"> / {yearlyGoal}</span></div>
                                            <div className="text-[10px] font-bold opacity-40 uppercase tracking-wider">libros terminados</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-black" style={{ color: onTrack ? '#22c55e' : '#f97316' }}>{projected}</div>
                                            <div className="text-[10px] font-bold opacity-40 uppercase tracking-wider">proyección fin de año</div>
                                        </div>
                                        {daysPerBook !== null && (
                                            <div>
                                                <div className="text-2xl font-black" style={{ color: '#a855f7' }}>{daysPerBook}d</div>
                                                <div className="text-[10px] font-bold opacity-40 uppercase tracking-wider">por libro para cumplir</div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--border-color)' }}>
                                        <div className="h-full rounded-full transition-all" style={{ width: `${pctGoal}%`, background: onTrack ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#f97316,#ea580c)' }} />
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[9px] opacity-40">{pctGoal}% completado</span>
                                        <span className="text-[9px] opacity-40">{daysLeft}d restantes en el año</span>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Level system */}
                        {addons.levelSystem && readerLevel && (
                            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                                <h2 className="font-black text-sm mb-4 opacity-80">⭐ Sistema de Niveles</h2>
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl font-black"
                                        style={{ background: 'linear-gradient(135deg, var(--highlight), #a855f7)', color: 'white' }}>
                                        {readerLevel.level}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 mb-0.5">
                                            <span className="font-black text-sm">{LEVEL_NAMES[Math.min((readerLevel.level || 1) - 1, LEVEL_NAMES.length - 1)]}</span>
                                            <span className="text-[10px] opacity-40">Niv. {readerLevel.level}</span>
                                        </div>
                                        <div className="text-[10px] opacity-45 mb-2">{readerLevel.current} / {readerLevel.xpPerLevel} XP para siguiente nivel</div>
                                        <div className="w-full h-2 rounded-full" style={{ background: 'var(--border-color)' }}>
                                            <div className="h-full rounded-full transition-all" style={{ width: `${readerLevel.progress}%`, background: 'linear-gradient(90deg, var(--highlight), #a855f7)' }} />
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-xl font-black" style={{ color: 'var(--highlight)' }}>{readerLevel.xp}</div>
                                        <div className="text-[9px] opacity-35 uppercase tracking-wider">XP total</div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                )}

                {activeTab === 'achievements' && (
                    <div className="p-5 max-w-3xl mx-auto w-full">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="font-black text-lg">Mis Logros</h2>
                            <div className="flex items-center gap-2">
                                <div className="text-sm font-black" style={{ color: 'var(--highlight)' }}>{visibleUnlockedCount} / {visibleAchievements.length}</div>
                                <div className="w-24 h-2 rounded-full" style={{ backgroundColor: 'var(--border-color)' }}>
                                    <div className="h-full rounded-full transition-all" style={{ width: `${visibleAchievements.length ? (visibleUnlockedCount / visibleAchievements.length) * 100 : 0}%`, backgroundColor: 'var(--highlight)' }} />
                                </div>
                            </div>
                        </div>
                        {['legendary', 'epic', 'rare', 'common'].map(rarity => {
                            const group = visibleAchievements.filter(a => a.rarity === rarity);
                            if (!group.length) return null;
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
                {activeTab === 'journal' && (
                    <div className="p-5 max-w-3xl mx-auto w-full">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="font-black text-lg">Diario de Lectura</h2>
                            <button onClick={() => {
                                const lines = ['# Diario de Lectura SharkReader', '', ...journalEntries.map(e => `- **${e.date}** — ${e.bookName} — ${fmtTime(e.minutes)}${e.progress != null ? ` (${Math.round(e.progress * 100)}%)` : ''}`)];
                                const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }));
                                const a = document.createElement('a'); a.href = url; a.download = 'diario_lectura.md'; a.click(); URL.revokeObjectURL(url);
                            }} className="px-3 py-1.5 rounded-xl text-xs font-bold opacity-60 hover:opacity-100 transition"
                                style={{ background: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                                ↓ MD
                            </button>
                        </div>
                        {journalEntries.length === 0 ? (
                            <p className="text-sm opacity-40 italic text-center py-10">No hay entradas aún. Lee durante al menos un minuto para empezar el diario.</p>
                        ) : (
                            <div className="space-y-2">
                                {journalEntries.map(entry => (
                                    <div key={entry.id} className="rounded-xl p-3 flex items-center gap-3"
                                        style={{ background: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                                            style={{ background: 'rgba(var(--highlight-rgb, 59,130,246),0.15)' }}>
                                            📖
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold truncate">{entry.bookName}</div>
                                            <div className="text-[10px] opacity-50">{entry.date}</div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-sm font-black" style={{ color: 'var(--highlight)' }}>{fmtTime(entry.minutes)}</div>
                                            {entry.progress != null && (
                                                <div className="text-[9px] opacity-40">{Math.round(entry.progress * 100)}%</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

export default AnalyticsView;
