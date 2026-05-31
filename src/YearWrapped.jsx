import React, { useState, useEffect, useMemo } from 'react';
import BookfinSprite from './SharkySprite';

function fmtTime(mins) {
    if (!mins) return '0m';
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins}m`;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const PERSONALITIES = [
    { min: 300, emoji: '🌌', name: 'Leyenda Literaria', desc: 'Lees más que el 99% de las personas.' },
    { min: 180, emoji: '⚡', name: 'Devorador de Páginas', desc: 'Tu ritmo de lectura es impresionante.' },
    { min: 90,  emoji: '🔥', name: 'Lector Constante', desc: 'La lectura es parte de tu rutina diaria.' },
    { min: 30,  emoji: '📚', name: 'Bibliófilo en Ciernes', desc: 'Cada libro leído es un mundo ganado.' },
    { min: 0,   emoji: '🌱', name: 'Explorador de Mundos', desc: 'El mejor momento para empezar es hoy.' },
];

function buildSlides(stats, books, year) {
    const yearBooks = books.filter(b => b.isFinished && b.dateFinished && new Date(b.dateFinished).getFullYear() === year);
    const totalMins = stats.timeRead || 0;
    const maxStreak = stats.maxStreak || stats.streak || 0;
    const totalAnnotations = books.reduce((s, b) => s + (b.bookmarks?.length || 0), 0);

    const minutesByMonth = Array.from({ length: 12 }, (_, m) => {
        return Object.entries(stats.minutesByDay || {}).reduce((sum, [dateStr, mins]) => {
            const d = new Date(dateStr);
            return (d.getFullYear() === year && d.getMonth() === m) ? sum + mins : sum;
        }, 0);
    });
    const bestMonthIdx = minutesByMonth.indexOf(Math.max(...minutesByMonth));
    const bestMonthMins = minutesByMonth[bestMonthIdx];

    const topBook = [...books].filter(b => (b.readingMinutes || 0) > 0).sort((a, z) => (z.readingMinutes || 0) - (a.readingMinutes || 0))[0];
    const personality = PERSONALITIES.find(p => totalMins >= p.min) || PERSONALITIES[PERSONALITIES.length - 1];

    return [
        {
            id: 'intro',
            bg: 'from-slate-900 via-blue-950 to-slate-900',
            accent: '#38bdf8',
            sharkyMood: 'celebrate',
            sharkyExpr: 'happy',
            label: `${year} en libros`,
            big: '📖',
            bigIsEmoji: true,
            title: 'Tu año en libros',
            subtitle: 'Un resumen de tu aventura lectora',
        },
        {
            id: 'books',
            bg: 'from-slate-900 via-emerald-950 to-slate-900',
            accent: '#34d399',
            sharkyMood: 'celebrate',
            sharkyExpr: 'laugh',
            label: yearBooks.length === 1 ? 'libro terminado' : 'libros terminados',
            big: yearBooks.length,
            title: yearBooks.length === 0 ? 'El primer libro está por llegar' : yearBooks.length >= 10 ? '¡Eso es increíble!' : '¡Bien hecho!',
            subtitle: yearBooks.length > 0 ? `${yearBooks.slice(0, 2).map(b => `"${b.name}"`).join(' y ')}${yearBooks.length > 2 ? ` y ${yearBooks.length - 2} más` : ''}` : 'Cada libro leído es un logro. El año que viene más.',
        },
        {
            id: 'time',
            bg: 'from-slate-900 via-violet-950 to-slate-900',
            accent: '#a78bfa',
            sharkyMood: 'idle',
            sharkyExpr: 'surprised',
            label: 'horas leyendo',
            big: Math.floor(totalMins / 60),
            title: totalMins >= 3000 ? '¡Eres un maratonista!' : totalMins >= 600 ? 'Una dedicación real' : 'Cada minuto cuenta',
            subtitle: fmtTime(totalMins) + ' de lectura total',
        },
        {
            id: 'streak',
            bg: 'from-slate-900 via-orange-950 to-slate-900',
            accent: '#fb923c',
            sharkyMood: maxStreak >= 30 ? 'celebrate' : 'focus',
            sharkyExpr: maxStreak >= 30 ? 'loved' : 'happy',
            label: 'días de racha máxima',
            big: maxStreak,
            title: maxStreak >= 100 ? '¡Centenario imparable!' : maxStreak >= 30 ? '¡Un mes sin parar!' : maxStreak >= 7 ? 'Una semana perfecta' : 'Cada día importa',
            subtitle: maxStreak > 0 ? `Tu racha más larga fue de ${maxStreak} días consecutivos` : 'Empieza mañana — día 1 de tu primera racha',
        },
        {
            id: 'best_month',
            bg: 'from-slate-900 via-amber-950 to-slate-900',
            accent: '#fbbf24',
            sharkyMood: 'idle',
            sharkyExpr: 'curious',
            label: bestMonthMins > 0 ? `mejor mes: ${MONTHS[bestMonthIdx]}` : 'sin pico de lectura aún',
            big: bestMonthMins > 0 ? MONTHS[bestMonthIdx] : '?',
            bigIsLabel: true,
            title: bestMonthMins > 0 ? `${MONTHS[bestMonthIdx]} fue tu mes más lector` : 'Tu mejor mes está por llegar',
            subtitle: bestMonthMins > 0 ? `${fmtTime(bestMonthMins)} de lectura en ese mes` : 'Proponte un reto mensual en el plan de lectura',
        },
        {
            id: 'annotations',
            bg: 'from-slate-900 via-fuchsia-950 to-slate-900',
            accent: '#e879f9',
            sharkyMood: 'idle',
            sharkyExpr: 'determined',
            label: totalAnnotations === 1 ? 'anotación guardada' : 'anotaciones guardadas',
            big: totalAnnotations,
            title: totalAnnotations >= 50 ? '¡Mentalidad de estudioso!' : totalAnnotations >= 10 ? 'Lector activo' : 'Subrayar es pensar',
            subtitle: totalAnnotations > 0 ? 'Tus ideas, preservadas para siempre' : 'Prueba subrayar una cita la próxima vez que leas',
            topBook: topBook ? `Tu libro más leído: "${topBook.name}"` : null,
        },
        {
            id: 'personality',
            bg: 'from-slate-900 via-sky-950 to-slate-900',
            accent: '#38bdf8',
            sharkyMood: 'celebrate',
            sharkyExpr: 'happy',
            label: 'eres un',
            big: personality.emoji,
            bigIsEmoji: true,
            title: personality.name,
            subtitle: personality.desc,
        },
    ];
}

export default function YearWrapped({ stats, books, onClose }) {
    const year = new Date().getFullYear();
    const slides = useMemo(() => buildSlides(stats, books, year), [stats, books, year]);
    const [idx, setIdx] = useState(0);
    const [animDir, setAnimDir] = useState(1);
    const slide = slides[idx];
    const isLast = idx === slides.length - 1;

    const go = (dir) => {
        if (dir > 0 && isLast) { onClose(); return; }
        if (dir < 0 && idx === 0) return;
        setAnimDir(dir);
        setIdx(i => i + dir);
    };

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') go(1);
            if (e.key === 'ArrowLeft') go(-1);
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [idx, isLast]);

    return (
        <div className="fixed inset-0 z-[700] flex items-center justify-center" onClick={() => go(1)}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

            {/* Card */}
            <div
                className={`relative w-full max-w-md mx-4 rounded-[32px] overflow-hidden bg-gradient-to-br ${slide.bg} shadow-2xl`}
                style={{
                    boxShadow: `0 32px 80px rgba(0,0,0,0.8), 0 0 60px ${slide.accent}22`,
                    border: '1px solid rgba(255,255,255,0.07)',
                    animation: `${animDir > 0 ? 'onboardingSlideRight' : 'onboardingSlideLeft'} 0.3s cubic-bezier(0.22,1,0.36,1)`,
                    minHeight: 480,
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Glow orbs */}
                <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-20 blur-3xl" style={{ background: slide.accent }} />
                <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full opacity-10 blur-3xl" style={{ background: slide.accent }} />

                {/* Top bar */}
                <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 text-white">{year} • SharkReader</span>
                    <button onClick={onClose} className="p-1.5 rounded-full opacity-40 hover:opacity-80 transition text-white text-sm">✕</button>
                </div>

                {/* Progress bar */}
                <div className="relative z-10 px-6 mb-6">
                    <div className="flex gap-1">
                        {slides.map((_, i) => (
                            <div key={i} className="flex-1 h-0.5 rounded-full transition-all duration-500"
                                style={{ background: i <= idx ? slide.accent : 'rgba(255,255,255,0.15)' }} />
                        ))}
                    </div>
                </div>

                {/* Main content */}
                <div className="relative z-10 px-8 pb-8 flex flex-col items-center text-center">
                    {/* Sharky */}
                    <div className="mb-4 drop-shadow-2xl">
                        <BookfinSprite size={72} mood={slide.sharkyMood} expression={slide.sharkyExpr} stage="reader" />
                    </div>

                    {/* Label */}
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] mb-3" style={{ color: `${slide.accent}99` }}>
                        {slide.label}
                    </p>

                    {/* Big stat */}
                    <div className="mb-4">
                        {slide.bigIsEmoji ? (
                            <span className="text-7xl leading-none drop-shadow-lg">{slide.big}</span>
                        ) : slide.bigIsLabel ? (
                            <span className="text-6xl font-black text-white drop-shadow-lg">{slide.big}</span>
                        ) : (
                            <span className="text-7xl font-black leading-none drop-shadow-lg" style={{ color: slide.accent }}>
                                {typeof slide.big === 'number' ? slide.big.toLocaleString() : slide.big}
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-black text-white mb-2 leading-tight">{slide.title}</h2>

                    {/* Subtitle */}
                    <p className="text-sm text-white/55 leading-relaxed max-w-[280px]">{slide.subtitle}</p>

                    {/* Extra info */}
                    {slide.topBook && (
                        <div className="mt-3 px-4 py-2 rounded-2xl text-[11px] font-semibold text-white/60"
                            style={{ background: `${slide.accent}10`, border: `1px solid ${slide.accent}20` }}>
                            {slide.topBook}
                        </div>
                    )}
                </div>

                {/* Bottom nav */}
                <div className="relative z-10 flex items-center justify-between px-6 pb-6">
                    <button onClick={(e) => { e.stopPropagation(); go(-1); }}
                        disabled={idx === 0}
                        className="px-4 py-2 rounded-2xl text-xs font-black text-white/40 hover:text-white/70 transition disabled:opacity-0"
                        style={{ background: 'rgba(255,255,255,0.05)' }}>
                        ← Atrás
                    </button>
                    <span className="text-[10px] text-white/25 font-bold">{idx + 1} / {slides.length}</span>
                    <button onClick={(e) => { e.stopPropagation(); go(1); }}
                        className="px-5 py-2 rounded-2xl text-xs font-black text-slate-950 transition active:scale-[0.97]"
                        style={{ background: `linear-gradient(135deg, ${slide.accent}, ${slide.accent}cc)` }}>
                        {isLast ? '¡Cerrar! 🦈' : 'Siguiente →'}
                    </button>
                </div>
            </div>

            {/* Hint */}
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-white/20 font-bold pointer-events-none">
                Click, → o Espacio para avanzar · Esc para cerrar
            </p>
        </div>
    );
}
