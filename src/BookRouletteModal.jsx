import React, { useRef, useState } from 'react';
import { Icons } from './icons';
import { useModalA11y } from './hooks/useModalA11y';

const WHEEL_COLORS = [
    '#f43f5e', '#fb923c', '#facc15', '#4ade80', '#22d3ee',
    '#818cf8', '#c084fc', '#f472b6', '#38bdf8', '#34d399', '#fb7185', '#a3e635',
];

// Gajos puramente decorativos: la rueda nunca muestra libros concretos, para
// que no parezca que se elige entre un puñado de opciones visibles cuando la
// biblioteca puede tener cientos — el libro ganador sale al azar de TODO el
// pool, independiente de en qué gajo se detenga el puntero.
const WHEEL_SLICE_COUNT = 12;
const SPIN_DURATION_MS = 4200;

function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeSlice(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

const sliceAngle = 360 / WHEEL_SLICE_COUNT;

export default function BookRouletteModal({ pool, winner, onResult, onRespin, onClose, onOpenBook, lang = 'es' }) {
    const [spinning, setSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const spinTimerRef = useRef(null);
    const t = (es, en) => (lang === 'en' ? en : es);

    const size = 280;
    const center = size / 2;
    const radius = size / 2 - 6;
    // La regla CSS global de prefers-reduced-motion colapsa la duración real
    // del giro casi a 0 — si el timer de JS siguiera esperando 4.2s reales,
    // la rueda se vería parada mucho antes de revelar el resultado.
    const prefersReducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const spinDuration = prefersReducedMotion ? 150 : SPIN_DURATION_MS;

    const spin = () => {
        if (spinning) return;
        onRespin?.();
        const landingSlice = Math.floor(Math.random() * WHEEL_SLICE_COUNT);
        const extraTurns = 5 + Math.floor(Math.random() * 3);
        const targetCenter = landingSlice * sliceAngle + sliceAngle / 2;
        const currentOffset = ((rotation % 360) + 360) % 360;
        const finalRotation = rotation - currentOffset + extraTurns * 360 + (360 - targetCenter);
        // El libro ganador es independiente del gajo donde caiga el puntero —
        // así la rueda nunca insinúa que solo se podía elegir entre 12 libros.
        const winnerBook = pool[Math.floor(Math.random() * pool.length)];

        setSpinning(true);
        setRotation(finalRotation);
        clearTimeout(spinTimerRef.current);
        spinTimerRef.current = setTimeout(() => {
            setSpinning(false);
            onResult?.(winnerBook);
        }, spinDuration);
    };

    const dialogRef = useModalA11y(true, onClose);

    return (
        <div className="fixed inset-0 z-[650] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm fade-in" onClick={onClose}>
            <div
                ref={dialogRef}
                role="dialog" aria-modal="true" aria-label={t('Ruleta de libros', 'Book roulette')} tabIndex={-1}
                className="relative w-full max-w-sm rounded-[32px] border p-6 shadow-2xl text-center outline-none"
                style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                onClick={e => e.stopPropagation()}>
                <button onClick={onClose} aria-label={t('Cerrar', 'Close')}
                    className="absolute right-4 top-4 rounded-full p-2 text-xl leading-none opacity-50 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5">
                    ×
                </button>

                <p className="flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: 'var(--highlight)' }}>
                    <Icons.Roulette className="h-3.5 w-3.5" /> {t('Ruleta de libros', 'Book Roulette')}
                </p>

                {!winner ? (
                    <>
                        <h2 className="mt-1 mb-5 text-xl font-black">{t('¿Qué vas a leer?', 'What will you read?')}</h2>
                        <div className="relative mx-auto" style={{ width: size, height: size }}>
                            {/* Puntero fijo, no rota con la rueda */}
                            <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}>
                                <div style={{ width: 0, height: 0, borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderTop: '18px solid var(--highlight)' }} />
                            </div>
                            <svg
                                viewBox={`0 0 ${size} ${size}`}
                                width={size}
                                height={size}
                                style={{
                                    transform: `rotate(${rotation}deg)`,
                                    transition: spinning ? `transform ${spinDuration}ms cubic-bezier(0.12, 0.67, 0.16, 1)` : 'none',
                                }}>
                                <circle cx={center} cy={center} r={radius + 4} fill="var(--surface-bg)" stroke="var(--border-color)" strokeWidth="2" />
                                {Array.from({ length: WHEEL_SLICE_COUNT }).map((_, i) => {
                                    const startAngle = i * sliceAngle;
                                    const endAngle = startAngle + sliceAngle;
                                    return (
                                        <path key={i} d={describeSlice(center, center, radius, startAngle, endAngle)}
                                            fill={WHEEL_COLORS[i % WHEEL_COLORS.length]} stroke="var(--surface-bg)" strokeWidth="2" />
                                    );
                                })}
                                <circle cx={center} cy={center} r={radius * 0.16} fill="var(--highlight)" stroke="var(--surface-bg)" strokeWidth="3" />
                            </svg>
                        </div>
                        <button onClick={spin} disabled={spinning}
                            className="mt-6 w-full rounded-2xl px-4 py-3.5 text-sm font-black text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                            style={{ backgroundColor: 'var(--highlight)' }}>
                            {spinning ? t('Girando…', 'Spinning…') : t('🎡 Girar la rueda', '🎡 Spin the wheel')}
                        </button>
                        <p className="mt-3 text-[10px] opacity-40">{t('Elige entre toda tu biblioteca disponible.', 'Picks from your whole available library.')}</p>
                    </>
                ) : (
                    <div className="roulette-winner-pop">
                        <h2 className="mt-1 mb-5 text-xl font-black">{t('¡Tu próxima lectura!', 'Your next read!')}</h2>
                        <div className="mx-auto flex max-w-[220px] flex-col items-center gap-4">
                            <div className="h-48 w-32 overflow-hidden rounded-2xl shadow-2xl" style={{ boxShadow: '0 0 0 4px var(--highlight), 0 20px 40px rgba(0,0,0,0.4)' }}>
                                {winner.coverUrl
                                    ? <img src={winner.coverUrl} alt="" className="h-full w-full object-cover" />
                                    : <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs font-black text-white" style={{ backgroundColor: winner.color || 'var(--highlight)' }}>{winner.name}</div>}
                            </div>
                            <div>
                                <h3 className="text-lg font-black leading-tight">{winner.name}</h3>
                                <p className="mt-1 text-sm opacity-60">{winner.author}</p>
                                <p className="mt-3 text-xs font-bold opacity-50">{winner.progress || 0}% {t('leído', 'read')}</p>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-2">
                            <button onClick={() => onOpenBook(winner.id)}
                                className="flex-1 rounded-xl px-4 py-3 text-sm font-black text-white transition hover:brightness-110"
                                style={{ backgroundColor: 'var(--highlight)' }}>
                                {t('Leer ahora', 'Read now')}
                            </button>
                            <button onClick={spin} className="rounded-xl border px-4 py-3 text-sm font-bold transition hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: 'var(--border-color)' }}>
                                {t('Otra vez', 'Again')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
