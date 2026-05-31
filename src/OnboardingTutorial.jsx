import React, { useState, useCallback, useEffect, useRef, useReducer } from 'react';
import BookfinSprite from './SharkySprite';
import { RANDOM_EMOJIS } from './translations';

const STEPS = [
    {
        id: 'welcome',
        mood: 'celebrate',
        expression: 'happy',
        eyecatch: 'Bienvenido',
        title: 'SharkReader',
        subtitle: 'Tu lector personal, sin distracciones.',
        gradient: 'from-sky-600/30 via-blue-700/20 to-transparent',
        accent: '#38bdf8',
        cta: 'Empezar el tour',
        skipLabel: 'Saltar al perfil →',
        features: [
            { icon: '📚', label: 'EPUB y PDF', color: '#38bdf8' },
            { icon: '🦈', label: 'Sharky IA', color: '#818cf8' },
            { icon: '🏆', label: '60 logros', color: '#f59e0b' },
            { icon: '📊', label: 'Analíticas', color: '#34d399' },
        ],
    },
    {
        id: 'library',
        mood: 'focus',
        expression: 'curious',
        eyecatch: 'Paso 1 — Biblioteca',
        title: 'Añade tus libros',
        subtitle: 'Arrastra un EPUB o PDF, o usa el botón +. El tour avanza solo al importar.',
        gradient: 'from-emerald-600/30 via-green-700/20 to-transparent',
        accent: '#34d399',
        cta: 'Siguiente →',
        features: [
            { icon: '📥', label: 'Drag & drop', color: '#34d399' },
            { icon: '🔍', label: 'Buscar dentro', color: '#34d399' },
            { icon: '🏷️', label: 'Tags & series', color: '#34d399' },
            { icon: '✨', label: 'Goodreads CSV', color: '#34d399' },
        ],
    },
    {
        id: 'reader',
        mood: 'focus',
        expression: 'determined',
        eyecatch: 'Paso 2 — Lector',
        title: 'Lee sin distracciones',
        subtitle: 'Doble click sobre un libro para abrirlo. El tour avanza automáticamente.',
        gradient: 'from-violet-600/30 via-purple-700/20 to-transparent',
        accent: '#a78bfa',
        cta: 'Siguiente →',
        features: [
            { icon: '🎨', label: 'Subrayados', color: '#a78bfa' },
            { icon: '📝', label: 'Notas visibles', color: '#a78bfa' },
            { icon: '🌙', label: 'Dark mode EPUB', color: '#a78bfa' },
            { icon: '⊞', label: 'Doble página', color: '#a78bfa' },
        ],
    },
    {
        id: 'analytics',
        mood: 'idle',
        expression: 'happy',
        eyecatch: 'Paso 3 — Progreso',
        title: 'Tu lectura, visible',
        subtitle: 'Tiempo, rachas, logros y metas. Todo se registra mientras lees.',
        gradient: 'from-amber-600/30 via-orange-700/20 to-transparent',
        accent: '#fbbf24',
        cta: 'Siguiente →',
        features: [
            { icon: '🔥', label: 'Rachas diarias', color: '#fbbf24' },
            { icon: '🏆', label: '60 logros', color: '#fbbf24' },
            { icon: '📅', label: 'Resumen anual', color: '#fbbf24' },
            { icon: '🎯', label: 'Metas propias', color: '#fbbf24' },
        ],
    },
    {
        id: 'sharky',
        mood: 'celebrate',
        expression: 'loved',
        eyecatch: 'Paso 4 — Tu asistente',
        title: 'Conoce a Sharky',
        subtitle: 'Tu compañero de lectura. Te felicita, te desafía y te recuerda que no te rindas.',
        gradient: 'from-cyan-600/30 via-sky-700/20 to-transparent',
        accent: '#22d3ee',
        cta: 'Siguiente →',
        hasActivateButton: true,
        features: [
            { icon: '💬', label: 'Chat lector', color: '#22d3ee' },
            { icon: '🎉', label: 'Celebraciones', color: '#22d3ee' },
            { icon: '😄', label: 'Personalidad', color: '#22d3ee' },
            { icon: '🦈', label: 'Cosméticos', color: '#22d3ee' },
        ],
    },
    {
        id: 'profile',
        mood: 'celebrate',
        expression: 'loved',
        eyecatch: 'Paso 5 — Tu perfil',
        title: 'Crea tu identidad lectora',
        subtitle: 'Sharky te reconocerá por tu nombre desde el primer día.',
        gradient: 'from-fuchsia-600/30 via-pink-700/20 to-transparent',
        accent: '#e879f9',
        cta: 'Crear perfil',
        hasProfileForm: true,
    },
    {
        id: 'done',
        mood: 'celebrate',
        expression: 'happy',
        eyecatch: '¡Todo listo!',
        gradient: 'from-sky-600/30 via-blue-700/20 to-transparent',
        accent: '#38bdf8',
        cta: '¡Vamos a leer! 🦈',
    },
];

const PROFILE_STEP_IDX = STEPS.findIndex(s => s.id === 'profile');

function stepReducer(state, action) {
    switch (action.type) {
        case 'next': return { index: Math.min(state.index + 1, STEPS.length - 1), direction: 1 };
        case 'prev': return { index: Math.max(state.index - 1, 0), direction: -1 };
        case 'goto': return { index: action.index, direction: action.index >= state.index ? 1 : -1 };
        default: return state;
    }
}

function loadSavedPos() {
    try { return JSON.parse(localStorage.getItem('sharkreader_tutorial_pos') || 'null'); }
    catch { return null; }
}

export default function OnboardingTutorial({
    onComplete, onSkip, onActivateSharky, onCreateProfile,
    hasProfile = false, bookCount = 0, isInReader = false,
}) {
    const [{ index: stepIndex, direction }, dispatch] = useReducer(stepReducer, { index: 0, direction: 1 });
    const [sharkyActivated, setSharkyActivated] = useState(false);
    const [profileName, setProfileName] = useState('');
    const [profileAvatar, setProfileAvatar] = useState(RANDOM_EMOJIS[0]);
    const avatarFileRef = useRef(null);
    const [pos, setPosState] = useState(loadSavedPos);
    const posRef = useRef(pos);
    const dragMovedRef = useRef(false);

    const setPos = useCallback((newPos) => { posRef.current = newPos; setPosState(newPos); }, []);

    const step = STEPS[stepIndex];
    const isLast = stepIndex === STEPS.length - 1;
    const isFirst = stepIndex === 0;

    const goNext = useCallback(() => {
        if (step.id === 'profile' && profileName.trim()) onCreateProfile?.(profileName.trim(), profileAvatar);
        if (isLast) { onComplete(); return; }
        dispatch({ type: 'next' });
    }, [step.id, isLast, onComplete, profileName, profileAvatar, onCreateProfile]);

    const goBack = useCallback(() => dispatch({ type: 'prev' }), []);
    const skipToProfile = useCallback(() => dispatch({ type: 'goto', index: PROFILE_STEP_IDX }), []);
    const handleActivateSharky = useCallback(() => { onActivateSharky?.(); setSharkyActivated(true); }, [onActivateSharky]);

    const handleAvatarFile = useCallback((e) => {
        const f = e.target.files?.[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = ev => setProfileAvatar(ev.target.result);
        reader.readAsDataURL(f);
    }, []);

    const handleDragStart = useCallback((e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const startX = e.clientX; const startY = e.clientY;
        const card = e.currentTarget.closest('[data-onboarding-card]');
        const rect = card ? card.getBoundingClientRect() : { left: window.innerWidth - 384, top: window.innerHeight - 560 };
        const startLeft = rect.left; const startTop = rect.top;
        dragMovedRef.current = false;
        const onMove = (mv) => {
            const dx = mv.clientX - startX; const dy = mv.clientY - startY;
            if (Math.abs(dx) + Math.abs(dy) > 4) dragMovedRef.current = true;
            setPos({ left: Math.round(Math.max(8, Math.min(window.innerWidth - 376, startLeft + dx))), top: Math.round(Math.max(8, Math.min(window.innerHeight - 80, startTop + dy))) });
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (posRef.current) localStorage.setItem('sharkreader_tutorial_pos', JSON.stringify(posRef.current));
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }, [setPos]);

    useEffect(() => { if (step.id !== 'library' || bookCount === 0) return; const t = setTimeout(() => dispatch({ type: 'next' }), 900); return () => clearTimeout(t); }, [step.id, bookCount]);
    useEffect(() => { if (step.id !== 'reader' || !isInReader) return; const t = setTimeout(() => dispatch({ type: 'next' }), 900); return () => clearTimeout(t); }, [step.id, isInReader]);
    useEffect(() => { if (step.id !== 'sharky' || !sharkyActivated) return; const t = setTimeout(() => dispatch({ type: 'next' }), 1400); return () => clearTimeout(t); }, [step.id, sharkyActivated]);
    useEffect(() => { if (step.id !== 'profile' || !hasProfile) return; const t = setTimeout(() => dispatch({ type: 'next' }), 400); return () => clearTimeout(t); }, [step.id, hasProfile]);

    const animName = direction > 0 ? 'onboardingSlideRight' : 'onboardingSlideLeft';
    const isProfileCtaDisabled = step.id === 'profile' && !profileName.trim();
    const stepTitle = step.id === 'done' ? `¡Bienvenido, ${profileName || 'lector'}!` : step.title;
    const stepSubtitle = step.id === 'done' ? 'Sharky te irá dando tips mientras usas la app. Puedes reiniciar este tour desde Configuración.' : step.subtitle;
    const cardStyle = pos ? { left: pos.left, top: pos.top } : { bottom: '1.25rem', right: '1.25rem' };

    const renderAvatarPreview = () => profileAvatar.startsWith('data:')
        ? <img src={profileAvatar} alt="" className="w-full h-full object-cover" />
        : <span className="text-3xl leading-none">{profileAvatar}</span>;

    return (
        <div
            data-onboarding-card
            key={stepIndex}
            className="fixed z-[680] w-[370px] rounded-[24px] overflow-hidden"
            style={{
                ...cardStyle,
                animation: `${animName} 0.25s cubic-bezier(0.22,1,0.36,1)`,
                background: 'rgba(10,14,26,0.97)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: `0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.4), 0 0 40px ${step.accent}22`,
            }}
        >
            {/* Top gradient accent line */}
            <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${step.accent}, transparent)` }} />

            {/* Hero area */}
            <div className={`relative h-[118px] bg-gradient-to-br ${step.gradient} flex items-center px-5 overflow-hidden`}>
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-[0.06]" style={{
                    backgroundImage: `radial-gradient(circle at 20% 50%, ${step.accent} 0%, transparent 60%), radial-gradient(circle at 80% 50%, ${step.accent} 0%, transparent 60%)`,
                }} />
                {/* Drag handle on hero */}
                <div className="absolute inset-0 cursor-grab active:cursor-grabbing" onPointerDown={handleDragStart} />
                {/* Sharky */}
                <div className="relative z-10 flex-shrink-0 drop-shadow-2xl">
                    <BookfinSprite size={74} mood={step.mood} expression={step.expression} stage="reader" />
                </div>
                {/* Step info */}
                <div className="relative z-10 ml-4 flex-1 min-w-0">
                    <span className="inline-block rounded-full px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] mb-1.5"
                        style={{ background: `${step.accent}20`, color: step.accent, border: `1px solid ${step.accent}30` }}>
                        {step.eyecatch}
                    </span>
                    <h2 className="text-[1.15rem] font-black text-white leading-tight">{stepTitle}</h2>
                </div>
                {/* Progress dots */}
                <div className="absolute bottom-3 right-4 flex gap-1 items-center z-10">
                    {STEPS.map((_, i) => (
                        <div key={i} className="rounded-full transition-all duration-300"
                            style={{
                                width: i === stepIndex ? 16 : 5,
                                height: 4,
                                background: i === stepIndex ? step.accent : i < stepIndex ? `${step.accent}50` : 'rgba(255,255,255,0.12)',
                            }} />
                    ))}
                </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
                {/* Subtitle */}
                {stepSubtitle && (
                    <p className="text-[11.5px] text-white/55 leading-relaxed mb-4">{stepSubtitle}</p>
                )}

                {/* Feature grid */}
                {step.features && (
                    <div className="grid grid-cols-2 gap-1.5 mb-4">
                        {step.features.map(f => (
                            <div key={f.label}
                                className="flex items-center gap-2 rounded-xl px-3 py-2 transition"
                                style={{ background: `${f.color}0d`, border: `1px solid ${f.color}20` }}>
                                <span className="text-sm leading-none">{f.icon}</span>
                                <span className="text-[11px] font-semibold" style={{ color: `${f.color}cc` }}>{f.label}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Sharky activate button */}
                {step.hasActivateButton && onActivateSharky && (
                    <div className="mb-4">
                        {!sharkyActivated ? (
                            <button onClick={handleActivateSharky}
                                className="w-full rounded-xl py-2 text-xs font-black transition active:scale-[0.98]"
                                style={{ background: `${step.accent}15`, border: `1px solid ${step.accent}30`, color: step.accent }}>
                                🦈 Activar Sharky ahora
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
                                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                                <span className="font-black" style={{ color: '#34d399' }}>✓ Sharky activado</span>
                                <span className="text-white/40">— crea tu perfil para que aparezca</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Profile form */}
                {step.hasProfileForm && (
                    <div className="mb-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center overflow-hidden"
                                style={{ background: `${step.accent}15`, border: `2px solid ${step.accent}30` }}>
                                {renderAvatarPreview()}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-wrap gap-1">
                                {RANDOM_EMOJIS.map(e => (
                                    <button key={e} onClick={() => setProfileAvatar(e)}
                                        className={`w-7 h-7 rounded-lg text-base transition ${profileAvatar === e ? 'scale-110' : 'opacity-60 hover:opacity-100'}`}
                                        style={profileAvatar === e ? { background: `${step.accent}20`, outline: `1.5px solid ${step.accent}60` } : { background: 'rgba(255,255,255,0.05)' }}>
                                        {e}
                                    </button>
                                ))}
                                <button onClick={() => avatarFileRef.current?.click()}
                                    className="w-7 h-7 rounded-lg text-sm flex items-center justify-center opacity-50 hover:opacity-80 transition"
                                    style={{ background: 'rgba(255,255,255,0.05)' }}>
                                    📷
                                </button>
                                <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
                            </div>
                        </div>
                        <input type="text" placeholder="¿Cómo te llamamos?" value={profileName}
                            onChange={e => setProfileName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !isProfileCtaDisabled && goNext()}
                            autoFocus
                            className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-center text-white outline-none placeholder:text-white/25 transition"
                            style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${profileName ? step.accent + '50' : 'rgba(255,255,255,0.08)'}` }} />
                    </div>
                )}

                {/* Nav */}
                <div className="flex items-center justify-between gap-3 mt-1">
                    <div>
                        {!isFirst && step.id !== 'profile' && (
                            <button onClick={goBack}
                                className="rounded-xl px-3 py-1.5 text-xs font-bold text-white/40 hover:text-white/70 transition"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                ← Atrás
                            </button>
                        )}
                        {isFirst && (
                            <button onClick={skipToProfile}
                                className="text-[11px] font-bold text-white/30 hover:text-white/55 transition px-1">
                                {step.skipLabel || 'Saltar →'}
                            </button>
                        )}
                    </div>
                    <button onClick={goNext} disabled={isProfileCtaDisabled}
                        className="flex-1 max-w-[180px] rounded-xl py-2 text-xs font-black transition active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed text-slate-950"
                        style={{ background: isProfileCtaDisabled ? step.accent : `linear-gradient(135deg, ${step.accent}, ${step.accent}cc)` }}>
                        {step.cta}
                    </button>
                </div>
            </div>
        </div>
    );
}
