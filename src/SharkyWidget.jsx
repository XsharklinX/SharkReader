// SharkyWidget — renderiza la mascota Sharkie, su toast, menú y chat.
// Para añadir botones, secciones o comportamientos, edita aquí y en SharkyContext.jsx.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import SharkySprite from './SharkySprite';
import { useSharky } from './SharkyContext';

// Mood → accent color mapping (matches CSS --sm-accent logic)
const MOOD_ACCENT = {
    idle:      ['#6366f1', 'rgba(99,102,241,0.18)'],
    focus:     ['#10b981', 'rgba(16,185,129,0.18)'],
    celebrate: ['#f59e0b', 'rgba(245,158,11,0.18)'],
    sleepy:    ['#a855f7', 'rgba(168,85,247,0.18)'],
    curious:   ['#14b8a6', 'rgba(20,184,166,0.18)'],
};

// ── Chat panel ──────────────────────────────────────────────────────────────
function SharkyChatPanel() {
    const {
        chatMessages, sharkyTyping, sendChatMessage, sendSpecialCommand,
        clearChat, closeChat, addonConfig, readerLevel, lang, sharkyState,
        lastReadBook,
    } = useSharky();

    const [input, setInput] = useState('');
    const [chatTalkFrame, setChatTalkFrame] = useState(0);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const sharkyConfig = addonConfig.sharkyMascot || {};
    const sharkyName = sharkyConfig.name?.trim() || 'Sharky';
    const aiEnabled = !!(sharkyConfig.aiEnabled && sharkyConfig.aiKey);

    const t = (es, en) => lang === 'en' ? en : es;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, sharkyTyping]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!sharkyTyping) {
            setChatTalkFrame(0);
            return undefined;
        }
        const timer = window.setInterval(() => {
            setChatTalkFrame(prev => (prev + 1) % 2);
        }, 220);
        return () => window.clearInterval(timer);
    }, [sharkyTyping]);

    const handleSend = () => {
        if (!input.trim() || sharkyTyping) return;
        sendChatMessage(input);
        setInput('');
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isEmpty = chatMessages.length === 0;

    // Book-specific action chips
    const bookActions = lastReadBook ? [
        { key: 'bookTalk', label: t('📖 Del libro', '📖 About book') },
        { key: 'summary',  label: t('📋 Resumen', '📋 Summary'),  ai: true },
        { key: 'quiz',     label: t('❓ Quiz', '❓ Quiz'),         ai: true },
        { key: 'similar',  label: t('🔍 Similares', '🔍 Similar') },
    ] : [
        { key: 'nextBook', label: t('📚 ¿Qué leer después?', '📚 What to read next?') },
    ];

    const generalSuggestions = [
        t('Motívame', 'Motivate me'),
        t('Mi progreso', 'My progress'),
        t('Cuéntame un chiste', 'Tell me a joke'),
    ];

    return (
        <div className="sharky-chat" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sharky-chat-header">
                <div className="sharky-chat-header-left">
                    <SharkySprite
                        size={26}
                        mood={sharkyState.mood}
                        expression={sharkyTyping ? 'speaking' : 'happy'}
                        stage={sharkyState.stage}
                        cosmetic={sharkyConfig.cosmetic || 'auto'}
                        emote={sharkyTyping ? 'ellipsis' : 'none'}
                        talking={sharkyTyping}
                        talkFrame={chatTalkFrame}
                    />
                    <div>
                        <span className="sharky-chat-title">{sharkyName}</span>
                        {aiEnabled && <span className="sharky-chat-ai-badge">AI</span>}
                    </div>
                </div>
                <div className="sharky-chat-header-actions">
                    {chatMessages.length > 0 && (
                        <button className="sharky-chat-icon-btn" onClick={clearChat} title={t('Limpiar chat', 'Clear chat')}>
                            ✕
                        </button>
                    )}
                    <button className="sharky-chat-icon-btn" onClick={closeChat} title={t('Cerrar', 'Close')}>
                        ↓
                    </button>
                </div>
            </div>

            {/* Book action chips — always visible when there's an active book */}
            {lastReadBook && (
                <div className="sharky-chat-book-strip">
                    {bookActions.map(a => (
                        <button
                            key={a.key}
                            className={`sharky-chat-book-chip${a.ai && aiEnabled ? ' ai-chip' : ''}`}
                            onClick={() => sendSpecialCommand(a.key)}
                            disabled={sharkyTyping}
                            title={a.ai && !aiEnabled ? t('Requiere IA activa', 'Requires AI enabled') : undefined}
                        >
                            {a.label}{a.ai && !aiEnabled ? ' *' : ''}
                        </button>
                    ))}
                </div>
            )}

            {/* Messages */}
            <div className="sharky-chat-messages">
                {isEmpty && (
                    <div className="sharky-chat-welcome">
                        <SharkySprite
                            size={38}
                            mood="idle"
                            expression="happy"
                            stage={sharkyState.stage}
                            cosmetic={sharkyConfig.cosmetic || 'auto'}
                            emote="none"
                        />
                        <p>{t(`¡Hola! Soy ${sharkyName}. ¿En qué puedo ayudarte?`, `Hi! I am ${sharkyName}. How can I help?`)}</p>

                        {/* Show nextBook chip here if no active book */}
                        {!lastReadBook && (
                            <div className="sharky-chat-suggestions" style={{ marginBottom: 4 }}>
                                {bookActions.map(a => (
                                    <button key={a.key} className="sharky-chat-suggestion" onClick={() => sendSpecialCommand(a.key)} disabled={sharkyTyping}>
                                        {a.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="sharky-chat-suggestions">
                            {generalSuggestions.map(s => (
                                <button key={s} className="sharky-chat-suggestion" onClick={() => sendChatMessage(s)} disabled={sharkyTyping}>
                                    {s}
                                </button>
                            ))}
                        </div>

                        {bookActions.some(a => a.ai) && !aiEnabled && (
                            <p style={{ fontSize: 10, opacity: 0.38, marginTop: 2, textAlign: 'center' }}>
                                * {t('Activa la IA en ajustes para resumen y quiz', 'Enable AI in settings for summary and quiz')}
                            </p>
                        )}
                    </div>
                )}

                {chatMessages.map((msg, i) => (
                    <div key={i} className={`sharky-chat-msg ${msg.role === 'user' ? 'is-user' : 'is-sharky'}`}>
                        <span className="sharky-chat-bubble">{msg.text}</span>
                    </div>
                ))}

                {sharkyTyping && (
                    <div className="sharky-chat-msg is-sharky">
                        <span className="sharky-chat-bubble sharky-typing-indicator">
                            <span /><span /><span />
                        </span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="sharky-chat-input-row">
                <input
                    ref={inputRef}
                    className="sharky-chat-input"
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={t('Escribe algo...', 'Type something...')}
                    maxLength={300}
                    disabled={sharkyTyping}
                />
                <button
                    className="sharky-chat-send"
                    onClick={handleSend}
                    disabled={!input.trim() || sharkyTyping}
                >
                    ➤
                </button>
            </div>
        </div>
    );
}

// ── Widget principal ───────────────────────────────────────────────────────
export default function SharkyWidget() {
    const {
        sharkyOpen, setSharkyOpen,
        sharkyConfigOpen, setSharkyConfigOpen,
        sharkyExpression,
        sharkyHeart,
        sharkyMoodEvent,
        sharkyCelebration, setSharkyCelebration,
        draggingSharky,
        sharkyState,
        aiTestStatus,
        sharkyChatOpen,
        sharkyTyping,
        openChat,
        moveSharkyMascot,
        handleSharkyClick,
        handleSharkyPet,
        sharkyContinueReading,
        sharkyOpenAchievements,
        sharkyOpenGoal,
        sharkyRoulette,
        setSharkyPersonality,
        setSharkyVisibility,
        setSharkyCosmetic,
        setSharkyName,
        setSharkyAIEnabled,
        setSharkyAIProvider,
        setSharkyAIKey,
        setSharkyChat,
        testSharkyAI,
        addons,
        addonConfig,
        readerLevel,
        lang,
        unlockedCosmetics,
        shouldShowSharky,
    } = useSharky();

    const [talkFrame, setTalkFrame] = useState(0);

    if (!shouldShowSharky) return null;

    const sharkyConfig = addonConfig.sharkyMascot || {};
    const sharkyName = sharkyConfig.name?.trim() || 'Sharky';
    const sharkyVisibility = sharkyConfig.visibility || 'always';
    const currentCosmetic = unlockedCosmetics.find(item => item.id === (sharkyConfig.cosmetic || 'auto') && item.unlocked) || unlockedCosmetics[0];
    const aiEnabled = !!sharkyConfig.aiEnabled;
    const aiProvider = sharkyConfig.aiProvider || 'gemini';
    const aiKey = sharkyConfig.aiKey || '';
    const chatEnabled = !!sharkyConfig.chatEnabled;

    const t = (es, en) => lang === 'en' ? en : es;

    // Resolve mood accent colors for CSS vars
    const [accent, accentSoft] = MOOD_ACCENT[sharkyState.mood] || MOOD_ACCENT.idle;

    const goalPct = Math.min(100, sharkyState.goal > 0 ? Math.round((sharkyState.daily / sharkyState.goal) * 100) : 0);
    const isSpeaking = !!(sharkyTyping || sharkyMoodEvent || sharkyCelebration);

    useEffect(() => {
        if (!isSpeaking) {
            setTalkFrame(0);
            return undefined;
        }
        const timer = window.setInterval(() => {
            setTalkFrame(prev => (prev + 1) % 2);
        }, 220);
        return () => window.clearInterval(timer);
    }, [isSpeaking]);

    const visualState = useMemo(() => {
        if (sharkyHeart) return { expression: 'loved', emote: 'heart' };
        if (sharkyTyping) return { expression: 'speaking', emote: 'ellipsis' };
        if (sharkyExpression && sharkyExpression !== 'neutral') {
            const emoteByExpression = {
                loved: 'heart',
                laugh: 'laugh',
                happy: 'star',
                sad: 'sad',
                surprised: 'surprise',
                curious: 'idea',
                determined: 'ellipsis',
                speaking: 'ellipsis',
            };
            return { expression: sharkyExpression, emote: emoteByExpression[sharkyExpression] || 'none' };
        }
        if (sharkyCelebration) return { expression: 'laugh', emote: 'star' };
        if (sharkyMoodEvent) {
            if (sharkyState.mood === 'celebrate') return { expression: 'happy', emote: 'star' };
            if (sharkyState.mood === 'focus') return { expression: 'determined', emote: 'ellipsis' };
            if (sharkyState.mood === 'sleepy') return { expression: 'sad', emote: 'sad' };
            if (sharkyState.mood === 'curious') return { expression: 'curious', emote: 'idea' };
            return { expression: 'speaking', emote: 'ellipsis' };
        }
        if (sharkyState.mood === 'celebrate') return { expression: 'happy', emote: 'star' };
        if (sharkyState.mood === 'focus') return { expression: 'determined', emote: 'none' };
        if (sharkyState.mood === 'sleepy') return { expression: 'sleepy', emote: 'none' };
        if (sharkyState.mood === 'curious') return { expression: 'curious', emote: 'idea' };
        return { expression: 'neutral', emote: 'none' };
    }, [sharkyCelebration, sharkyExpression, sharkyHeart, sharkyMoodEvent, sharkyState.mood, sharkyTyping]);

    return (
        <div
            className="sharky-wrap"
            style={{
                left: sharkyConfig.left ?? 'auto',
                top: sharkyConfig.top ?? 'auto',
                right: sharkyConfig.left == null ? 22 : 'auto',
                bottom: sharkyConfig.top == null ? 22 : 'auto',
                '--sm-accent': accent,
                '--sm-accent-soft': accentSoft,
            }}
        >
            {/* Mood toast */}
            {sharkyMoodEvent && (
                <div className="sharky-toast">
                    {sharkyMoodEvent}
                </div>
            )}

            {/* Chat panel */}
            {sharkyChatOpen && <SharkyChatPanel />}

            {/* Quick menu */}
            {sharkyOpen && !sharkyChatOpen && (
                <div className="sharky-menu" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>

                    {/* Header */}
                    <div className="sharky-menu-head">
                        <span>
                            <SharkySprite
                                size={34}
                                mood={sharkyState.mood}
                                expression={visualState.expression}
                                stage={sharkyState.stage}
                                cosmetic={currentCosmetic.id}
                                emote={visualState.emote}
                                talking={isSpeaking}
                                talkFrame={talkFrame}
                            />
                        </span>
                        <div>
                            <p>{sharkyName}</p>
                            <small>{t(`Nivel ${readerLevel.level}`, `Level ${readerLevel.level}`)}</small>
                        </div>
                    </div>

                    {/* Daily goal progress */}
                    <div className="sharky-goal">
                        <div className="sharky-goal-label">
                            <span>{t('Meta diaria', 'Daily goal')}</span>
                            <b>{sharkyState.daily}/{sharkyState.goal} min</b>
                        </div>
                        <div className="sharky-goal-track">
                            <div className="sharky-goal-fill" style={{ width: `${goalPct}%` }} />
                        </div>
                    </div>

                    {/* Celebration strip */}
                    {sharkyCelebration && (
                        <div className="sharky-summary">
                            <b>{sharkyCelebration.title}</b>
                            <span>{sharkyCelebration.bookName}</span>
                            {sharkyCelebration.detail && <small>{sharkyCelebration.detail}</small>}
                            <button onClick={() => setSharkyCelebration(null)}>
                                {t('Ocultar', 'Dismiss')}
                            </button>
                        </div>
                    )}

                    {/* Quick action grid */}
                    <div className="sharky-action-grid">
                        {chatEnabled && (
                            <button className="sharky-action-btn" onClick={openChat}>
                                <span className="sa-icon">💬</span>
                                <span className="sa-label">{t('Chat', 'Chat')}</span>
                            </button>
                        )}
                        <button className="sharky-action-btn" onClick={sharkyContinueReading}>
                            <span className="sa-icon">▶</span>
                            <span className="sa-label">{t('Continuar', 'Continue')}</span>
                        </button>
                        <button className="sharky-action-btn" onClick={sharkyRoulette}>
                            <span className="sa-icon">🎲</span>
                            <span className="sa-label">{t('Ruleta', 'Roulette')}</span>
                        </button>
                        <button className="sharky-action-btn" onClick={sharkyOpenGoal}>
                            <span className="sa-icon">🎯</span>
                            <span className="sa-label">{t('Meta', 'Goal')}</span>
                        </button>
                        <button className="sharky-action-btn" onClick={sharkyOpenAchievements}>
                            <span className="sa-icon">🏆</span>
                            <span className="sa-label">{t('Logros', 'Awards')}</span>
                        </button>
                        <button className="sharky-action-btn" onClick={() => setSharkyConfigOpen(prev => !prev)}>
                            <span className="sa-icon">⚙️</span>
                            <span className="sa-label">{t('Ajustes', 'Settings')}</span>
                        </button>
                    </div>

                    {/* Config sections — hidden until gear icon clicked */}
                    {sharkyConfigOpen && (
                        <>
                            <div className="sharky-menu-section">
                                <label>{t('Nombre', 'Name')}</label>
                                <input
                                    className="sharky-name-input"
                                    value={sharkyConfig.name ?? 'Sharky'}
                                    maxLength={24}
                                    onChange={event => setSharkyName(event.target.value)}
                                />
                            </div>

                            <div className="sharky-menu-section">
                                <label>{t('Visibilidad', 'Visibility')}</label>
                                <div className="sharky-chip-row">
                                    {['always', 'library', 'reader', 'events'].map(mode => (
                                        <button
                                            key={mode}
                                            className={sharkyVisibility === mode ? 'active' : ''}
                                            onClick={() => setSharkyVisibility(mode)}
                                        >
                                            {mode === 'always' ? t('Siempre', 'Always') :
                                                mode === 'library' ? t('Biblioteca', 'Library') :
                                                mode === 'reader' ? t('Lector', 'Reader') :
                                                t('Eventos', 'Events')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="sharky-menu-section">
                                <label>{t('Cosméticos', 'Cosmetics')}</label>
                                <div className="sharky-cosmetics">
                                    {unlockedCosmetics.map(item => (
                                        <button
                                            key={item.id}
                                            disabled={!item.unlocked}
                                            className={currentCosmetic.id === item.id ? 'active' : ''}
                                            onClick={() => item.unlocked && setSharkyCosmetic(item.id)}
                                            title={item.unlocked ? item.label : t('Bloqueado', 'Locked')}
                                        >
                                            <span><SharkySprite size={22} mood="idle" stage={sharkyState.stage} cosmetic={item.id} expression="happy" emote="none" /></span>
                                            <small>{item.label}</small>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Chat toggle */}
                            <div className="sharky-menu-section">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label style={{ marginBottom: 0 }}>💬 {t('Chat', 'Chat')}</label>
                                    <button
                                        className={`sharky-ai-toggle ${chatEnabled ? 'active' : ''}`}
                                        onClick={() => setSharkyChat(!chatEnabled)}
                                    >
                                        {chatEnabled ? t('Activo', 'On') : t('Inactivo', 'Off')}
                                    </button>
                                </div>
                                {chatEnabled && (
                                    <p style={{ fontSize: 10, opacity: 0.4, marginTop: 6, lineHeight: 1.4 }}>
                                        {t(
                                            'Sharky responderá con su biblioteca de diálogos. Si configuras la IA abajo, usará respuestas generadas.',
                                            'Sharky will reply using its built-in dialogue library. If you set up AI below, it will use generated responses.',
                                        )}
                                    </p>
                                )}
                            </div>

                            {/* AI config */}
                            <div className="sharky-menu-section">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <label style={{ marginBottom: 0 }}>🤖 {t('IA', 'AI')}</label>
                                    <button
                                        className={`sharky-ai-toggle ${aiEnabled ? 'active' : ''}`}
                                        onClick={() => setSharkyAIEnabled(!aiEnabled)}
                                    >
                                        {aiEnabled ? t('Activa', 'On') : t('Inactiva', 'Off')}
                                    </button>
                                </div>
                                {aiEnabled && (
                                    <div className="sharky-ai-config">
                                        <div className="sharky-chip-row" style={{ marginBottom: 8 }}>
                                            {[
                                                { id: 'gemini',     label: 'Gemini',     note: t('gratis', 'free') },
                                                { id: 'xai',        label: 'Grok',       note: t('gratis', 'free') },
                                                { id: 'openrouter', label: 'OpenRouter', note: t('gratis+', 'free+') },
                                                { id: 'openai',     label: 'OpenAI',     note: t('pago', 'paid') },
                                                { id: 'mistral',    label: 'Mistral',    note: t('gratis', 'free') },
                                            ].map(p => (
                                                <button
                                                    key={p.id}
                                                    className={aiProvider === p.id ? 'active' : ''}
                                                    onClick={() => setSharkyAIProvider(p.id)}
                                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '4px 8px' }}
                                                >
                                                    <span>{p.label}</span>
                                                    <span style={{ fontSize: 9, opacity: 0.55 }}>{p.note}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <label style={{ fontSize: 10, opacity: 0.45, textTransform: 'uppercase', letterSpacing: 1 }}>
                                            {aiProvider === 'gemini'     ? 'Google AI Studio Key (AIzaSy...)' :
                                             aiProvider === 'xai'        ? 'xAI API Key (xai-...)' :
                                             aiProvider === 'openai'     ? 'OpenAI API Key (sk-...)' :
                                             aiProvider === 'openrouter' ? 'OpenRouter Key (sk-or-...)' :
                                             aiProvider === 'mistral'    ? 'Mistral API Key' :
                                             'API Key'}
                                        </label>
                                        <input
                                            className="sharky-name-input"
                                            type="password"
                                            placeholder={t('Pega tu API key aquí', 'Paste your API key here')}
                                            value={aiKey}
                                            onChange={e => setSharkyAIKey(e.target.value)}
                                            style={{ marginTop: 4, marginBottom: 6 }}
                                        />
                                        <button
                                            onClick={testSharkyAI}
                                            disabled={aiTestStatus === 'testing' || !aiKey}
                                            style={{ opacity: aiKey ? 1 : 0.4 }}
                                        >
                                            {aiTestStatus === 'testing'            ? t('Probando...', 'Testing...') :
                                             aiTestStatus === 'ok'                 ? t('✓ Conexión OK', '✓ Connected') :
                                             aiTestStatus?.startsWith('error:')   ? `✗ ${aiTestStatus.slice(6)}` :
                                             t('Probar conexión', 'Test connection')}
                                        </button>
                                        <p style={{ fontSize: 10, opacity: 0.4, marginTop: 6, lineHeight: 1.5 }}>
                                            {aiProvider === 'gemini'     && t('Gemini 2.0 Flash · Tier gratuito generoso en aistudio.google.com', 'Gemini 2.0 Flash · Generous free tier at aistudio.google.com')}
                                            {aiProvider === 'xai'        && t('Grok 3 Mini · Tier gratuito en console.x.ai', 'Grok 3 Mini · Free tier at console.x.ai')}
                                            {aiProvider === 'openai'     && t('GPT-4o mini · Pago por uso, muy barato en platform.openai.com', 'GPT-4o mini · Pay-per-use, very cheap at platform.openai.com')}
                                            {aiProvider === 'openrouter' && t('Llama 3.1 8B · Modelos gratis + cientos de pago en openrouter.ai', 'Llama 3.1 8B · Free models + hundreds of paid ones at openrouter.ai')}
                                            {aiProvider === 'mistral'    && t('Mistral Small · Tier gratuito disponible en console.mistral.ai', 'Mistral Small · Free tier available at console.mistral.ai')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Mascot button */}
            <button
                type="button"
                className={`sharky-mascot mood-${sharkyState.mood} stage-${sharkyState.stage} ${draggingSharky ? 'is-dragging' : ''} ${sharkyChatOpen ? 'chat-open' : ''} ${isSpeaking ? 'is-speaking' : ''}`}
                onPointerDown={moveSharkyMascot}
                onClick={handleSharkyClick}
                onContextMenu={handleSharkyPet}
                title={t(
                    `Haz click o arrastra a ${sharkyName}. Click derecho para acariciar.`,
                    `Click or drag ${sharkyName}. Right click to pet.`,
                )}
            >
                {sharkyHeart && <span className="sharky-heart">♥</span>}
                <SharkySprite
                    size={44}
                    mood={sharkyState.mood}
                    expression={visualState.expression}
                    stage={sharkyState.stage}
                    cosmetic={currentCosmetic.id}
                    emote={visualState.emote}
                    talking={isSpeaking}
                    talkFrame={talkFrame}
                />
            </button>
        </div>
    );
}
