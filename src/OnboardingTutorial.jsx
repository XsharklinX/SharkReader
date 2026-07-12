import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SharkySprite from './SharkySprite';
import { RANDOM_EMOJIS } from './translations';
import appLogo from '../icon.png';

const BOOK_STEPS = [
    {
        id: 'welcome',
        chapter: 'Prologo',
        kicker: 'Antes de empezar',
        title: 'Lee a tu ritmo. Todo se queda contigo.',
        body: 'SharkReader guarda tu biblioteca, avances y notas en tu propio equipo. Sin cuentas obligatorias, sin ruido y sin convertir la lectura en una red social.',
        accent: '#38bdf8',
        cta: 'Empezar',
        skipLabel: 'Crear perfil',
        notes: ['Local-first', 'EPUB y PDF', 'Sin distracciones'],
        visual: 'welcome',
    },
    {
        id: 'library',
        chapter: 'Capitulo 1',
        kicker: 'Biblioteca',
        title: 'Tus libros, ordenados sin esfuerzo.',
        body: 'Importa archivos o carpetas completas. SharkReader intenta detectar portadas, metadatos y duplicados para que no tengas que organizarlo todo a mano.',
        accent: '#34d399',
        cta: 'Siguiente pagina',
        notes: ['Carpetas completas', 'Portadas', 'Duplicados'],
        visual: 'shelf',
    },
    {
        id: 'reader',
        chapter: 'Capitulo 2',
        kicker: 'Lector',
        title: 'Un lector comodo para sesiones largas.',
        body: 'Ajusta fuente, tamano, margenes, tema, doble pagina o modo dislexia. La meta es simple: que el texto se sienta bien en tu pantalla.',
        accent: '#a78bfa',
        cta: 'Siguiente pagina',
        notes: ['Tipografia', 'Modo Dx', 'Doble pagina'],
        visual: 'reader',
    },
    {
        id: 'annotations',
        chapter: 'Capitulo 3',
        kicker: 'Notas',
        title: 'Marca lo que vale la pena recordar.',
        body: 'Subraya frases, deja notas y guarda marcadores. Luego puedes volver a esas ideas y exportarlas a Markdown u Obsidian.',
        accent: '#f59e0b',
        cta: 'Siguiente pagina',
        notes: ['Subrayados', 'Notas', 'Exportar'],
        visual: 'notes',
    },
    {
        id: 'workshop',
        chapter: 'Capitulo 4',
        kicker: 'Workshop',
        title: 'Funciones extra, solo si las quieres.',
        body: 'Activa addons para adaptar la app a tu forma de leer: foco, backups, sonidos, ruleta, fuentes externas o Sharky. Nada esta impuesto.',
        accent: '#22d3ee',
        cta: 'Siguiente pagina',
        notes: ['Modular', 'Configurable', 'Opcional'],
        visual: 'workshop',
    },
    {
        id: 'sharky',
        chapter: 'Capitulo 5',
        kicker: 'Sharky',
        title: 'Un companero discreto, no una interrupcion.',
        body: 'Sharky puede celebrar hitos, resumir una sesion o darte un empujon cuando toca. Si no lo quieres presente, puedes limitarlo o esconderlo.',
        accent: '#2dd4bf',
        cta: 'Siguiente pagina',
        notes: ['Hitos reales', 'Sesiones', 'Presencia'],
        visual: 'sharky',
        hasActivateButton: true,
    },
    {
        id: 'analytics',
        chapter: 'Capitulo 6',
        kicker: 'Progreso',
        title: 'Entiende tu habito sin obsesionarte.',
        body: 'Rachas, metas, diario, logros y resumen anual estan ahi para darte contexto. Uselos como guia, no como presion.',
        accent: '#fbbf24',
        cta: 'Siguiente pagina',
        notes: ['Rachas', 'Metas', 'Resumen anual'],
        visual: 'analytics',
    },
    {
        id: 'profile',
        chapter: 'Epilogo',
        kicker: 'Perfil',
        title: 'Ponle nombre a tu espacio de lectura.',
        body: 'Tu perfil separa progreso, logros, preferencias y la presencia de Sharky. Todo sigue siendo local y puedes borrarlo cuando quieras.',
        accent: '#e879f9',
        cta: 'Crear perfil',
        notes: ['Nombre', 'Avatar', 'Datos locales'],
        visual: 'profile',
        hasProfileForm: true,
    },
    {
        id: 'done',
        chapter: 'Listo',
        kicker: 'Ya puedes entrar',
        title: 'La biblioteca esta lista para crecer.',
        body: 'Empieza importando un libro, abre el lector y ajusta la experiencia a tu gusto. Si necesitas este recorrido de nuevo, estara en Configuracion.',
        accent: '#38bdf8',
        cta: 'Entrar',
        notes: ['Importar', 'Leer', 'Personalizar'],
        visual: 'done',
    },
];

const PROFILE_STEP_INDEX = BOOK_STEPS.findIndex(step => step.id === 'profile');

function MiniIllustration({ type, accent }) {
    const line = { stroke: accent, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
    const softFill = `${accent}22`;

    if (type === 'sharky') {
        return (
            <div className="onboarding-book-sharky">
                <SharkySprite size={92} mood="celebrate" expression="happy" stage="reader" />
            </div>
        );
    }

    if (type === 'welcome') {
        return (
            <div className="onboarding-book-logo">
                <img src={appLogo} alt="" width="96" height="96" />
            </div>
        );
    }

    return (
        <svg className="onboarding-book-illustration" viewBox="0 0 160 120" aria-hidden="true">
            <rect x="18" y="18" width="124" height="84" rx="18" fill={softFill} />
            {type === 'library' && <><path {...line} d="M42 88V34h22v54M70 88V28h24v60M100 88V42h18v46" /><path {...line} d="M36 88h88" /></>}
            {type === 'shelf' && <><path {...line} d="M34 40h92M34 72h92M42 40v32M62 40v32M86 40v32M108 40v32" /><path {...line} d="M45 84h70" /></>}
            {type === 'reader' && <><path {...line} d="M42 32h34c9 0 16 7 16 16v42H58c-9 0-16-7-16-16Z" /><path {...line} d="M92 48c0-9 7-16 16-16h10v58H92Z" /><path {...line} d="M55 50h22M55 62h26M105 50h12M105 62h12" /></>}
            {type === 'notes' && <><path {...line} d="M48 36h64v52H48Z" /><path {...line} d="M60 52h40M60 64h28M60 76h34" /><path {...line} d="M104 72l16 16M121 70l-19 19" /></>}
            {type === 'workshop' && <><path {...line} d="M56 42h18v18H56ZM86 42h18v18H86ZM56 72h18v18H56ZM86 72h18v18H86Z" /><path {...line} d="M118 56v20M108 66h20" /></>}
            {type === 'analytics' && <><path {...line} d="M44 86V62M68 86V46M92 86V54M116 86V34" /><path {...line} d="M38 86h88" /><path {...line} d="M45 44c15 14 28 6 42 14 11 6 19 1 30-16" /></>}
            {type === 'profile' && <><circle cx="80" cy="48" r="16" fill={softFill} stroke={accent} strokeWidth="2" /><path {...line} d="M52 88c5-17 51-17 56 0" /><path {...line} d="M116 40h16M124 32v16" /></>}
            {type === 'done' && <><path {...line} d="M48 66 70 86 116 36" /><path {...line} d="M46 98h68" /><path {...line} d="M58 34h44" /></>}
        </svg>
    );
}

export default function OnboardingTutorial({
    onComplete,
    onSkip,
    onActivateSharky,
    onCreateProfile,
    hasProfile = false,
}) {
    const [stepIndex, setStepIndex] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('sharkreader_tutorial_pos') || 'null');
            return Number.isInteger(saved?.index) ? Math.max(0, Math.min(saved.index, BOOK_STEPS.length - 1)) : 0;
        } catch {
            return 0;
        }
    });
    const [turnDirection, setTurnDirection] = useState(1);
    const [turning, setTurning] = useState(false);
    const [sharkyActivated, setSharkyActivated] = useState(false);
    const [profileName, setProfileName] = useState('');
    const [profileAvatar, setProfileAvatar] = useState(RANDOM_EMOJIS[0]);
    const avatarFileRef = useRef(null);
    const turnTimerRef = useRef(null);
    const step = BOOK_STEPS[stepIndex];
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === BOOK_STEPS.length - 1;

    const progress = useMemo(() => Math.round(((stepIndex + 1) / BOOK_STEPS.length) * 100), [stepIndex]);

    const persistIndex = useCallback((index) => {
        try { localStorage.setItem('sharkreader_tutorial_pos', JSON.stringify({ index })); } catch (_) {}
    }, []);

    const turnTo = useCallback((nextIndex, direction = 1) => {
        const clamped = Math.max(0, Math.min(nextIndex, BOOK_STEPS.length - 1));
        if (clamped === stepIndex || turning) return;
        window.clearTimeout(turnTimerRef.current);
        setTurnDirection(direction);
        setTurning(true);
        turnTimerRef.current = window.setTimeout(() => {
            setStepIndex(clamped);
            persistIndex(clamped);
            window.setTimeout(() => setTurning(false), 210);
        }, 180);
    }, [persistIndex, stepIndex, turning]);

    const complete = useCallback(() => {
        try { localStorage.removeItem('sharkreader_tutorial_pos'); } catch (_) {}
        onComplete?.();
    }, [onComplete]);

    const goNext = useCallback(() => {
        if (step.id === 'profile' && profileName.trim()) {
            onCreateProfile?.(profileName.trim(), profileAvatar);
        }
        if (isLast) {
            complete();
            return;
        }
        turnTo(stepIndex + 1, 1);
    }, [complete, isLast, onCreateProfile, profileAvatar, profileName, step.id, stepIndex, turnTo]);

    const goBack = useCallback(() => turnTo(stepIndex - 1, -1), [stepIndex, turnTo]);
    const skipToProfile = useCallback(() => turnTo(PROFILE_STEP_INDEX, 1), [turnTo]);

    const skipAll = useCallback(() => {
        try { localStorage.removeItem('sharkreader_tutorial_pos'); } catch (_) {}
        onSkip?.();
    }, [onSkip]);

    const handleActivateSharky = useCallback(() => {
        onActivateSharky?.();
        setSharkyActivated(true);
    }, [onActivateSharky]);

    const handleAvatarFile = useCallback((event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => setProfileAvatar(ev.target.result);
        reader.readAsDataURL(file);
    }, []);

    useEffect(() => () => window.clearTimeout(turnTimerRef.current), []);

    const isProfileCtaDisabled = step.id === 'profile' && !profileName.trim() && !hasProfile;
    const pageTitle = step.id === 'done' ? `Bienvenido, ${profileName || 'lector'}` : step.title;
    const primaryCta = step.id === 'profile' && hasProfile ? 'Continuar' : step.cta;

    const renderAvatarPreview = () => String(profileAvatar).startsWith('data:')
        ? <img src={profileAvatar} alt="" className="h-full w-full object-cover" />
        : <span className="text-3xl leading-none">{profileAvatar}</span>;

    return (
        <div className="onboarding-book-overlay" role="dialog" aria-modal="true" aria-label="Tutorial de bienvenida">
            <div className="onboarding-book-stage">
                <div className="onboarding-book-shadow" />
                <div className={`onboarding-book ${turning ? 'is-turning' : ''} ${turnDirection < 0 ? 'turn-back' : 'turn-next'}`}>
                    <div className="onboarding-book-spine" />
                    <section className="onboarding-book-page onboarding-book-page-left">
                        <button className="onboarding-book-close" onClick={skipAll} aria-label="Saltar tutorial">x</button>
                        <div className="onboarding-book-chapter" style={{ color: step.accent }}>{step.chapter}</div>
                        <h1>{pageTitle}</h1>
                        <p>{step.body}</p>

                        <div className="onboarding-book-notes">
                            {step.notes.map(note => (
                                <span key={note} style={{ '--note-accent': step.accent }}>{note}</span>
                            ))}
                        </div>

                        {step.hasActivateButton && onActivateSharky && (
                            <button className="onboarding-book-special" onClick={handleActivateSharky} style={{ '--book-accent': step.accent }}>
                                {sharkyActivated ? 'Sharky activado' : 'Activar Sharky'}
                            </button>
                        )}

                        {step.hasProfileForm && (
                            <div className="onboarding-book-profile">
                                <div className="onboarding-book-avatar">{renderAvatarPreview()}</div>
                                <div className="onboarding-book-avatar-list">
                                    {RANDOM_EMOJIS.map(item => (
                                        <button key={item} onClick={() => setProfileAvatar(item)} className={profileAvatar === item ? 'active' : ''}>
                                            {item}
                                        </button>
                                    ))}
                                    <button onClick={() => avatarFileRef.current?.click()} className="upload">Foto</button>
                                    <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
                                </div>
                                <input
                                    value={profileName}
                                    onChange={event => setProfileName(event.target.value)}
                                    onKeyDown={event => event.key === 'Enter' && !isProfileCtaDisabled && goNext()}
                                    placeholder="Como te llamamos?"
                                    autoFocus
                                />
                            </div>
                        )}
                    </section>

                    <section className="onboarding-book-page onboarding-book-page-right" style={{ '--book-accent': step.accent }}>
                        <div className="onboarding-book-kicker">{step.kicker}</div>
                        <MiniIllustration type={step.visual} accent={step.accent} />
                        <div className="onboarding-book-progress">
                            <div>
                                <strong>{progress}%</strong>
                                <span>del recorrido</span>
                            </div>
                            <div className="onboarding-book-progress-track">
                                <i style={{ width: `${progress}%`, background: step.accent }} />
                            </div>
                        </div>
                        <div className="onboarding-book-dots">
                            {BOOK_STEPS.map((item, index) => (
                                <button
                                    key={item.id}
                                    aria-label={`Ir a ${item.chapter}`}
                                    onClick={() => turnTo(index, index > stepIndex ? 1 : -1)}
                                    className={index === stepIndex ? 'active' : index < stepIndex ? 'done' : ''}
                                    style={index === stepIndex ? { background: step.accent } : {}}
                                />
                            ))}
                        </div>
                    </section>

                    <div className="onboarding-book-turn-page">
                        <div className="onboarding-book-turn-front" />
                        <div className="onboarding-book-turn-back" />
                    </div>
                </div>

                <div className="onboarding-book-actions">
                    <button onClick={isFirst ? skipToProfile : goBack} disabled={turning}>
                        {isFirst ? step.skipLabel : 'Pagina anterior'}
                    </button>
                    <button className="primary" onClick={goNext} disabled={turning || isProfileCtaDisabled} style={{ '--book-accent': step.accent }}>
                        {primaryCta}
                    </button>
                </div>
            </div>
        </div>
    );
}
