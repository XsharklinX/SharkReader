import React, { useState, useCallback, useEffect, useRef, useReducer } from 'react';
import BookfinSprite from './SharkySprite';
import { RANDOM_EMOJIS } from './translations';

const STEPS = [
    {
        id: 'welcome',
        mood: 'celebrate',
        expression: 'happy',
        eyecatch: '¡Hola!',
        title: 'Bienvenido a SharkReader',
        body: 'Tu biblioteca personal, lector y asistente de lectura. La app sigue activa mientras exploras el tour.',
        cta: 'Comenzar',
        skipLabel: 'Saltar al perfil →',
    },
    {
        id: 'library',
        mood: 'focus',
        expression: 'neutral',
        eyecatch: 'Paso 1 — Biblioteca',
        title: 'Añade tu primer libro',
        body: 'Arrastra un EPUB o PDF a la ventana, o usa el botón + en la barra superior. El tour avanza solo cuando lo hagas.',
        cta: 'Siguiente →',
        features: [
            { icon: '📥', label: 'Drag & drop o botón +' },
            { icon: '🏷️', label: 'Tags y categorías' },
            { icon: '⭐', label: 'Rating y filtros' },
            { icon: '📊', label: 'Progreso por libro' },
        ],
    },
    {
        id: 'reader',
        mood: 'focus',
        expression: 'neutral',
        eyecatch: 'Paso 2 — Lector',
        title: 'Abre un libro para leer',
        body: 'Haz doble click sobre cualquier libro. El tour avanza automáticamente al entrar al lector.',
        cta: 'Siguiente →',
        features: [
            { icon: '🎨', label: 'Subrayados multicolor' },
            { icon: '📝', label: 'Notas al margen' },
            { icon: '🔍', label: 'Búsqueda interna' },
            { icon: '🌅', label: 'Modo cálido' },
        ],
    },
    {
        id: 'analytics',
        mood: 'idle',
        expression: 'happy',
        eyecatch: 'Paso 3 — Analíticas',
        title: 'Mide tu progreso lector',
        body: 'Tiempo de lectura, rachas diarias, logros y metas. Todo se registra automáticamente mientras lees.',
        cta: 'Siguiente →',
        features: [
            { icon: '🔥', label: 'Rachas de lectura' },
            { icon: '🏆', label: 'Logros y hitos' },
            { icon: '🎯', label: 'Metas diarias' },
            { icon: '📅', label: 'Historial por día' },
        ],
    },
    {
        id: 'sharky',
        mood: 'celebrate',
        expression: 'loved',
        eyecatch: 'Paso 4 — Tu asistente',
        title: 'Conoce a Sharky',
        body: 'Tu compañero de lectura IA. Actívalo y te aparecerá en la esquina inferior derecha una vez tengas perfil.',
        cta: 'Siguiente →',
        hasActivateButton: true,
        features: [
            { icon: '💬', label: 'Chat contextual' },
            { icon: '🔮', label: 'Recomendaciones' },
            { icon: '😄', label: 'Personalidad propia' },
            { icon: '⚡', label: 'Múltiples modelos IA' },
        ],
    },
    {
        id: 'profile',
        mood: 'celebrate',
        expression: 'loved',
        eyecatch: 'Paso 5 — Tu perfil',
        title: 'Crea tu perfil lector',
        body: 'Sharky te reconocerá por tu nombre. Elige un avatar y escribe cómo quieres que te llamen.',
        cta: 'Crear perfil',
        hasProfileForm: true,
    },
    {
        id: 'done',
        mood: 'celebrate',
        expression: 'happy',
        eyecatch: '¡Todo listo!',
        cta: '¡Vamos!',
    },
];

const PROFILE_STEP_IDX = STEPS.findIndex(s => s.id === 'profile');

// Atomic reducer: direction + index always update together
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
    onComplete,
    onSkip,
    onActivateSharky,
    onCreateProfile,
    hasProfile = false,
    bookCount = 0,
    isInReader = false,
}) {
    const [{ index: stepIndex, direction }, dispatch] = useReducer(stepReducer, { index: 0, direction: 1 });
    const [sharkyActivated, setSharkyActivated] = useState(false);
    const [profileName, setProfileName] = useState('');
    const [profileAvatar, setProfileAvatar] = useState(RANDOM_EMOJIS[0]);
    const avatarFileRef = useRef(null);

    // Drag state
    const [pos, setPosState] = useState(loadSavedPos);
    const posRef = useRef(pos);
    const dragMovedRef = useRef(false);

    const setPos = useCallback((newPos) => {
        posRef.current = newPos;
        setPosState(newPos);
    }, []);

    const step = STEPS[stepIndex];
    const isLast = stepIndex === STEPS.length - 1;
    const isFirst = stepIndex === 0;

    const goNext = useCallback(() => {
        if (step.id === 'profile' && profileName.trim()) {
            onCreateProfile?.(profileName.trim(), profileAvatar);
        }
        if (isLast) { onComplete(); return; }
        dispatch({ type: 'next' });
    }, [step.id, isLast, onComplete, profileName, profileAvatar, onCreateProfile]);

    const goBack = useCallback(() => dispatch({ type: 'prev' }), []);

    const skipToProfile = useCallback(() => {
        dispatch({ type: 'goto', index: PROFILE_STEP_IDX });
    }, []);

    const handleActivateSharky = useCallback(() => {
        onActivateSharky?.();
        setSharkyActivated(true);
    }, [onActivateSharky]);

    const handleAvatarFile = useCallback((e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = ev => setProfileAvatar(ev.target.result);
        reader.readAsDataURL(f);
    }, []);

    // Drag handler — attached to the header bar
    const handleDragStart = useCallback((e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        // Determine starting position from current rendered position
        const card = e.currentTarget.closest('[data-onboarding-card]');
        const rect = card ? card.getBoundingClientRect() : { left: window.innerWidth - 334, top: window.innerHeight - 500 };
        const startLeft = rect.left;
        const startTop = rect.top;
        dragMovedRef.current = false;

        const onMove = (mv) => {
            const dx = mv.clientX - startX;
            const dy = mv.clientY - startY;
            if (Math.abs(dx) + Math.abs(dy) > 4) dragMovedRef.current = true;
            const newPos = {
                left: Math.round(Math.max(8, Math.min(window.innerWidth - 330, startLeft + dx))),
                top: Math.round(Math.max(8, Math.min(window.innerHeight - 80, startTop + dy))),
            };
            setPos(newPos);
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (posRef.current) {
                localStorage.setItem('sharkreader_tutorial_pos', JSON.stringify(posRef.current));
            }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }, [setPos]);

    // Auto-advance: biblioteca → se importó el primer libro
    useEffect(() => {
        if (step.id !== 'library' || bookCount === 0) return;
        const t = setTimeout(() => dispatch({ type: 'next' }), 900);
        return () => clearTimeout(t);
    }, [step.id, bookCount]);

    // Auto-advance: lector → se abrió un libro
    useEffect(() => {
        if (step.id !== 'reader' || !isInReader) return;
        const t = setTimeout(() => dispatch({ type: 'next' }), 900);
        return () => clearTimeout(t);
    }, [step.id, isInReader]);

    // Auto-advance: sharky → se activó el addon
    useEffect(() => {
        if (step.id !== 'sharky' || !sharkyActivated) return;
        const t = setTimeout(() => dispatch({ type: 'next' }), 1400);
        return () => clearTimeout(t);
    }, [step.id, sharkyActivated]);

    // Auto-advance: si ya tiene perfil, saltar el paso de perfil
    useEffect(() => {
        if (step.id !== 'profile' || !hasProfile) return;
        const t = setTimeout(() => dispatch({ type: 'next' }), 400);
        return () => clearTimeout(t);
    }, [step.id, hasProfile]);

    const animName = direction > 0 ? 'onboardingSlideRight' : 'onboardingSlideLeft';
    const isProfileCtaDisabled = step.id === 'profile' && !profileName.trim();

    const stepTitle = step.id === 'done' ? `¡Bienvenido, ${profileName || 'lector'}!` : step.title;
    const stepBody = step.id === 'done'
        ? 'Sharky te irá dando tips mientras usas la app. Puedes reiniciar este tour desde Configuración cuando quieras.'
        : step.body;

    const renderAvatarPreview = () => {
        if (profileAvatar.startsWith('data:')) {
            return <img src={profileAvatar} alt="" className="w-full h-full object-cover" />;
        }
        return <span className="text-4xl leading-none">{profileAvatar}</span>;
    };

    const cardStyle = pos
        ? { left: pos.left, top: pos.top }
        : { bottom: '1rem', right: '1rem' };

    return (
        <div
            data-onboarding-card
            key={stepIndex}
            className="fixed z-[680] w-[318px] rounded-[22px] border border-white/10 bg-[#0d1117] text-white overflow-hidden"
            style={{
                ...cardStyle,
                animation: `${animName} 0.22s cubic-bezier(0.22,1,0.36,1)`,
                boxShadow: '0 12px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.35)',
            }}
        >
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-sky-600 via-sky-400 to-blue-500" />

            {/* Drag handle — header area */}
            <div
                className="absolute top-0 inset-x-0 h-14 cursor-grab active:cursor-grabbing"
                onPointerDown={handleDragStart}
            />

            <div className="p-5">
                {/* Header: sprite + badge + dots */}
                <div className="flex items-center gap-2.5 mb-3 pointer-events-none select-none">
                    <BookfinSprite
                        size={44}
                        mood={step.mood}
                        expression={step.expression}
                        stage="reader"
                        className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                        <span className="inline-block rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.2em] text-sky-400">
                            {step.eyecatch}
                        </span>
                    </div>
                    <div className="flex gap-1 items-center flex-shrink-0">
                        {STEPS.map((_, i) => (
                            <div
                                key={i}
                                className={`rounded-full transition-all duration-300 ${
                                    i === stepIndex   ? 'w-4 h-1.5 bg-sky-400' :
                                    i < stepIndex     ? 'w-1.5 h-1.5 bg-sky-400/40' :
                                                        'w-1.5 h-1.5 bg-white/15'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Texto */}
                <h2 className="text-base font-black leading-tight mb-1.5">{stepTitle}</h2>
                <p className="text-[11px] text-white/55 leading-relaxed mb-3">{stepBody}</p>

                {/* Feature chips */}
                {step.features && (
                    <div className="grid grid-cols-2 gap-1 mb-3">
                        {step.features.map(f => (
                            <div key={f.label} className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.04] px-2.5 py-1.5">
                                <span className="text-sm leading-none">{f.icon}</span>
                                <span className="text-[0.68rem] font-semibold text-white/65">{f.label}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Botón de activación de Sharky */}
                {step.hasActivateButton && onActivateSharky && (
                    <div className="mb-3">
                        {!sharkyActivated ? (
                            <button
                                onClick={handleActivateSharky}
                                className="w-full rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-300 hover:bg-sky-400/20 active:scale-[0.98] transition"
                            >
                                🦈 Activar Sharky ahora
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 rounded-xl border border-green-400/25 bg-green-400/[0.08] px-3 py-2">
                                <span className="text-green-400 font-black text-xs">✓ Sharky activado</span>
                                <span className="text-[10px] text-white/40">— crea tu perfil para que aparezca</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Formulario de perfil inline */}
                {step.hasProfileForm && (
                    <div className="mb-3 space-y-2.5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 flex-shrink-0 rounded-full border-2 border-sky-400/40 bg-white/5 flex items-center justify-center overflow-hidden">
                                {renderAvatarPreview()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap gap-1">
                                    {RANDOM_EMOJIS.map(e => (
                                        <button
                                            key={e}
                                            onClick={() => setProfileAvatar(e)}
                                            className={`w-7 h-7 rounded-lg text-base transition ${
                                                profileAvatar === e
                                                    ? 'bg-sky-400/20 ring-1 ring-sky-400/60 scale-110'
                                                    : 'bg-white/5 hover:bg-white/10'
                                            }`}
                                        >
                                            {e}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => avatarFileRef.current?.click()}
                                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition text-sm"
                                        title="Subir foto"
                                    >
                                        📷
                                    </button>
                                    <input
                                        ref={avatarFileRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleAvatarFile}
                                    />
                                </div>
                            </div>
                        </div>
                        <input
                            type="text"
                            placeholder="Ej. El Gran Tiburón"
                            value={profileName}
                            onChange={e => setProfileName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !isProfileCtaDisabled && goNext()}
                            autoFocus
                            className="w-full bg-white/[0.06] border border-white/10 focus:border-sky-400/50 rounded-xl px-3 py-2 text-xs font-bold text-center text-white outline-none placeholder:text-white/30 transition"
                        />
                    </div>
                )}

                {/* Navegación */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {!isFirst && step.id !== 'profile' && (
                            <button
                                onClick={goBack}
                                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/55 hover:text-white hover:bg-white/10 transition"
                            >
                                ← Atrás
                            </button>
                        )}
                        {isFirst && (
                            <button
                                onClick={skipToProfile}
                                className="text-[11px] font-bold text-white/30 hover:text-white/55 transition px-1 py-1.5"
                            >
                                {step.skipLabel || 'Saltar al perfil →'}
                            </button>
                        )}
                    </div>
                    <button
                        onClick={goNext}
                        disabled={isProfileCtaDisabled}
                        className="rounded-xl bg-sky-500 px-4 py-1.5 text-xs font-black text-slate-950 hover:bg-sky-400 active:scale-[0.97] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                        {step.cta}
                    </button>
                </div>
            </div>
        </div>
    );
}
