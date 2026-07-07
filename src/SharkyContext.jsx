// SharkyContext — gestiona todo el estado, lógica y efectos de la mascota Sharkie.
// Para añadir nuevas funciones a Sharkie, edita este archivo y SharkyWidget.jsx.
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { saveAppData, loadAppData } from './db';
import {
    DIALOGUE, JOKE_POOL, CHAT_PATTERNS, CHAT_RESPONSES, SESSION_END, BOOK_OPENED,
    pickRandom, getLines, matchIntent, findSimilarBooks,
    getScriptedResponse, buildSystemPrompt, buildChatAIPrompt, buildSpecialAIPrompt,
} from './sharkyDialogues';

const SharkyContext = createContext(null);

const resolveAIConfig = (cfg = {}, globalProvider, globalKey) => ({
    provider: cfg.aiProvider || globalProvider || '',
    apiKey: cfg.aiKey || globalKey || '',
});

const SHARKY_EVENT_RULES = {
    bookOpened: { priority: 'low', cooldownMs: 10 * 60 * 1000, expression: 'curious', emote: 'idea' },
    readingTip: { priority: 'low', cooldownMs: 20 * 60 * 1000, expression: 'curious', emote: 'idea' },
    milestone: { priority: 'medium', cooldownMs: 90 * 1000, expression: 'happy', emote: 'star' },
    sessionSummary: { priority: 'medium', cooldownMs: 2 * 60 * 1000, expression: 'happy', emote: 'star' },
    bookFinished: { priority: 'high', cooldownMs: 0, expression: 'laugh', emote: 'star' },
    streak: { priority: 'high', cooldownMs: 0, expression: 'happy', emote: 'star' },
    streakLost: { priority: 'high', cooldownMs: 0, expression: 'sad', emote: 'sad' },
    achievement: { priority: 'high', cooldownMs: 0, expression: 'happy', emote: 'star' },
    anniversary: { priority: 'medium', cooldownMs: 0, expression: 'curious', emote: 'idea' },
};

const EVENT_FREQUENCY_PRIORITY = {
    normal: new Set(['low', 'medium', 'high']),
    reduced: new Set(['medium', 'high']),
    important: new Set(['high']),
};

export const useSharky = () => {
    const ctx = useContext(SharkyContext);
    if (!ctx) throw new Error('useSharky must be used inside SharkyProvider');
    return ctx;
};

// ── AI helpers ─────────────────────────────────────────────────────────────
async function fetchAIMessage({ provider, apiKey, prompt, history, maxTokens = 120 }) {
    if (provider === 'gemini') {
        const contents = [];
        if (history && history.length > 0) {
            history.forEach(m => {
                contents.push({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] });
            });
        }
        contents.push({ role: 'user', parts: [{ text: prompt }] });
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            if (res.status === 429) throw new Error('Límite de velocidad alcanzado (Gemini). Espera unos segundos.');
            if (res.status === 401 || res.status === 403) throw new Error('API key de Gemini inválida o sin permisos.');
            throw new Error(`Gemini ${res.status}: ${body?.error?.message || res.statusText}`);
        }
        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    }
    // OpenAI-compatible providers (xAI, OpenAI, OpenRouter, Mistral)
    const OAI_CONFIG = {
        xai:        { url: 'https://api.x.ai/v1/chat/completions',             model: 'grok-3-mini' },
        openai:     { url: 'https://api.openai.com/v1/chat/completions',        model: 'gpt-4o-mini' },
        openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions',     model: 'meta-llama/llama-3.1-8b-instruct:free' },
        mistral:    { url: 'https://api.mistral.ai/v1/chat/completions',        model: 'mistral-small-latest' },
    };
    if (OAI_CONFIG[provider]) {
        const { url, model } = OAI_CONFIG[provider];
        const messages = [];
        if (history?.length > 0) {
            history.forEach(m => messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
        }
        messages.push({ role: 'user', content: prompt });
        const extraHeaders = provider === 'openrouter'
            ? { 'HTTP-Referer': 'https://sharkreader.app', 'X-Title': 'SharkReader' }
            : {};
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...extraHeaders },
            body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            if (res.status === 429) throw new Error(`Límite de velocidad alcanzado (${provider}). Espera unos segundos.`);
            if (res.status === 401) throw new Error(`API key inválida (${provider})`);
            if (res.status === 403) throw new Error(`Sin permisos (${provider})`);
            throw new Error(`${provider} ${res.status}: ${body?.error?.message || res.statusText}`);
        }
        const data = await res.json();
        return data?.choices?.[0]?.message?.content?.trim() || null;
    }
    return null;
}


export const SharkyProvider = ({
    children,
    actionsRef,
    addons,
    addonConfig,
    updateAddonConfig,
    stats,
    readerLevel,
    books,
    booksById,
    dailyGoalMins,
    lang,
    globalAiProvider,
    globalAiApiKey,
    lastReadId,
    view,
    userProfile,
    achievementToast,
    onPet,
    setAddonConfigLive,
    openBook,
    spinBookRoulette,
    setView,
    setSidebarOpen,
}) => {
    const [sharkyOpen, setSharkyOpen] = useState(false);
    const [sharkyConfigOpen, setSharkyConfigOpen] = useState(false);
    const [sharkyExpression, setSharkyExpression] = useState('neutral');
    const [sharkyEmote, setSharkyEmote] = useState('none');
    const [sharkyHeart, setSharkyHeart] = useState(false);
    const [sharkyMoodEvent, setSharkyMoodEvent] = useState(null);
    const [sharkyCelebration, setSharkyCelebration] = useState(null);
    const [draggingSharky, setDraggingSharky] = useState(false);
    const [aiTestStatus, setAiTestStatus] = useState(null);
    // Chat state
    const [sharkyChatOpen, setSharkyChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [sharkyTyping, setSharkyTyping] = useState(false);

    const sharkyDragMovedRef = useRef(false);
    const sharkyMilestonesRef = useRef(new Set());
    const aiRequestInFlightRef = useRef(false);
    const streakMilestonesNotifiedRef = useRef(new Set());
    const sharkyReactionTimerRef = useRef(null);
    const sharkyTimeoutsRef = useRef(new Set());
    const sharkyEventCooldownsRef = useRef(new Map());
    const isMountedRef = useRef(true);

    const scheduleSharkyTimeout = useCallback((callback, delay) => {
        const timer = window.setTimeout(() => {
            sharkyTimeoutsRef.current.delete(timer);
            if (isMountedRef.current) callback();
        }, delay);
        sharkyTimeoutsRef.current.add(timer);
        return timer;
    }, []);

    const clearMoodEventAfter = useCallback((delay, expected = null) => {
        scheduleSharkyTimeout(() => {
            setSharkyMoodEvent(prev => (expected === null || prev === expected ? null : prev));
        }, delay);
    }, [scheduleSharkyTimeout]);

    useEffect(() => () => {
        isMountedRef.current = false;
        if (sharkyReactionTimerRef.current) {
            window.clearTimeout(sharkyReactionTimerRef.current);
            sharkyReactionTimerRef.current = null;
        }
        sharkyTimeoutsRef.current.forEach(timer => window.clearTimeout(timer));
        sharkyTimeoutsRef.current.clear();
        aiRequestInFlightRef.current = false;
        if (actionsRef?.current) actionsRef.current = null;
    }, [actionsRef]);

    const queueSharkyReaction = useCallback((expression = 'neutral', {
        emote = 'none',
        heart = false,
        duration = 2200,
    } = {}) => {
        if (sharkyReactionTimerRef.current) {
            window.clearTimeout(sharkyReactionTimerRef.current);
            sharkyReactionTimerRef.current = null;
        }
        setSharkyExpression(expression);
        setSharkyEmote(emote);
        setSharkyHeart(heart);
        sharkyReactionTimerRef.current = scheduleSharkyTimeout(() => {
            setSharkyExpression('neutral');
            setSharkyEmote('none');
            setSharkyHeart(false);
            sharkyReactionTimerRef.current = null;
        }, duration);
    }, [scheduleSharkyTimeout]);

    const emitSharkyEvent = useCallback((eventType, {
        message,
        duration,
        expression,
        emote,
        celebration = null,
        force = false,
    } = {}) => {
        if (!addons.sharkyMascot || !userProfile || !message) return false;
        const cfg = addonConfig.sharkyMascot || {};
        const personality = cfg.personality || 'friendly';
        if (personality === 'silent' && !force) return false;

        const rule = SHARKY_EVENT_RULES[eventType] || { priority: 'low', cooldownMs: 60000 };
        const frequency = cfg.eventFrequency || 'reduced';
        const allowed = EVENT_FREQUENCY_PRIORITY[frequency] || EVENT_FREQUENCY_PRIORITY.reduced;
        if (!force && !allowed.has(rule.priority)) return false;

        const now = Date.now();
        const cooldownKey = `${eventType}:${message}`;
        const lastAt = sharkyEventCooldownsRef.current.get(cooldownKey) || 0;
        if (!force && rule.cooldownMs > 0 && now - lastAt < rule.cooldownMs) return false;
        sharkyEventCooldownsRef.current.set(cooldownKey, now);

        setSharkyMoodEvent(message);
        if (celebration) setSharkyCelebration(celebration);
        queueSharkyReaction(expression || rule.expression || 'neutral', {
            emote: emote || rule.emote || 'none',
            duration: Math.min(5000, Math.max(1800, duration || 2800)),
        });
        clearMoodEventAfter(duration || (rule.priority === 'high' ? 5000 : 3600), message);
        return true;
    }, [addonConfig.sharkyMascot, addons.sharkyMascot, clearMoodEventAfter, queueSharkyReaction, userProfile]);

    // ── Persistencia del chat ──
    useEffect(() => {
        loadAppData('sharkyChatHistory').then(data => {
            if (Array.isArray(data) && data.length > 0) setChatMessages(data.slice(-60));
        });
    }, []);
    useEffect(() => {
        if (chatMessages.length === 0) return;
        saveAppData('sharkyChatHistory', chatMessages.slice(-60));
    }, [chatMessages]);

    // ── Estado derivado ──
    const sharkyState = useMemo(() => {
        const daily = stats.currentDailyMins || 0;
        const goal = dailyGoalMins || 30;
        const activeReads = books.filter(b => b.lastReadDate > 0 && !b.isFinished).length;
        const daysSinceRead = (() => {
            if (!lastReadId) return null;
            const book = booksById.get(lastReadId);
            if (!book?.lastReadDate) return null;
            return Math.floor((Date.now() - book.lastReadDate) / 86400000);
        })();
        const stage = readerLevel.level >= 15 ? 'legend' : readerLevel.level >= 8 ? 'explorer' : readerLevel.level >= 4 ? 'reader' : 'baby';
        let mood = 'idle';
        if (view === 'reader') mood = 'focus';
        else if (daily >= goal) mood = 'celebrate';
        else if ((daysSinceRead ?? 0) >= 3) mood = 'sleepy';
        else if (activeReads >= 3) mood = 'curious';
        return {
            stage, mood, activeReads, finished: books.filter(b => b.isFinished).length, daily, goal,
            progress: Math.min(100, Math.round((daily / Math.max(1, goal)) * 100)),
        };
    }, [books, booksById, dailyGoalMins, lastReadId, readerLevel.level, stats.currentDailyMins, view]);

    const lastReadBook = useMemo(() => booksById.get(lastReadId) || null, [booksById, lastReadId]);

    // ── Chat context helper ──
    const buildChatCtx = useCallback(() => {
        const cfg = addonConfig.sharkyMascot || {};
        const personality = cfg.personality || 'friendly';
        const activeBooks = books
            .filter(b => b.lastReadDate > 0 && !b.isFinished)
            .sort((a, b) => b.lastReadDate - a.lastReadDate);
        const finishedBooks = books.filter(b => b.isFinished);
        const lastReadBook = booksById.get(lastReadId) || null;
        return {
            personality, lang,
            books, activeBooks, finishedBooks,
            stats, readerLevel, dailyGoalMins,
            daily: stats.currentDailyMins || 0,
            goal: dailyGoalMins || 30,
            streak: stats.streak || 0,
            lastReadBook,
        };
    }, [addonConfig.sharkyMascot, books, booksById, dailyGoalMins, lang, lastReadId, readerLevel, stats]);

    // ── Chat: enviar mensaje ──
    const sendChatMessage = useCallback(async (text) => {
        const trimmed = text.trim();
        if (!trimmed || sharkyTyping) return;

        const userMsg = { role: 'user', text: trimmed, ts: Date.now() };
        setChatMessages(prev => [...prev, userMsg]);
        setSharkyTyping(true);

        const cfg = addonConfig.sharkyMascot || {};
        const ctx = buildChatCtx();
        const resolvedAI = resolveAIConfig(cfg, globalAiProvider, globalAiApiKey);

        let reply = null;
        const delay = 500 + Math.random() * 600;

        try {
            if (cfg.aiEnabled && resolvedAI.apiKey && resolvedAI.provider) {
                // Build conversation history for AI (last 8 messages)
                const history = chatMessages.slice(-8).map(m => ({
                    role: m.role,
                    text: m.text,
                }));
                const prompt = buildChatAIPrompt({
                    userText: trimmed,
                    lang,
                    personality: cfg.personality || 'friendly',
                    books,
                    stats,
                    readerLevel,
                    dailyGoalMins,
                });
                // For AI, use history in the API call
                reply = await fetchAIMessage({
                    provider: resolvedAI.provider,
                    apiKey: resolvedAI.apiKey,
                    prompt,
                    history,
                });
            }
        } catch (err) {
            console.warn('[SharkReader] Sharky AI chat failed:', err);
        }

        if (!reply) {
            const intent = matchIntent(trimmed, lang);
            reply = getScriptedResponse(intent, ctx);
        }

        await new Promise(r => scheduleSharkyTimeout(r, delay));
        if (!isMountedRef.current) return;
        setChatMessages(prev => [...prev, { role: 'sharky', text: reply, ts: Date.now() }]);
        setSharkyTyping(false);
    }, [addonConfig.sharkyMascot, books, buildChatCtx, chatMessages, dailyGoalMins, globalAiApiKey, globalAiProvider, lang, readerLevel, scheduleSharkyTimeout, sharkyTyping, stats]);

    // ── Chat: comandos especiales (hablar del libro, resumen, quiz, similares) ──
    const sendSpecialCommand = useCallback(async (type) => {
        if (sharkyTyping) return;
        const cfg = addonConfig.sharkyMascot || {};
        const l = lang === 'en' ? 'en' : 'es';
        const userTextMap = {
            bookTalk: l === 'en' ? 'Talk about the book' : 'Háblame del libro',
            summary:  l === 'en' ? 'Current chapter summary' : 'Resumen del capítulo actual',
            quiz:     l === 'en' ? 'Reading quiz' : 'Quiz de lectura',
            similar:  l === 'en' ? 'Similar books' : 'Libros similares',
            nextBook: l === 'en' ? 'What to read next?' : '¿Qué leer después?',
        };
        const userText = userTextMap[type] || type;
        setChatMessages(prev => [...prev, { role: 'user', text: userText, ts: Date.now() }]);
        setSharkyTyping(true);

        const delay = 600 + Math.random() * 500;
        let reply = null;
        const currentBook = booksById.get(lastReadId) || null;
        const resolvedAI = resolveAIConfig(cfg, globalAiProvider, globalAiApiKey);

        try {
            if (type === 'similar' || type === 'nextBook') {
                const ctx = buildChatCtx();
                reply = getScriptedResponse(type, ctx);
            } else if (cfg.aiEnabled && resolvedAI.apiKey && resolvedAI.provider) {
                reply = await fetchAIMessage({
                    provider: resolvedAI.provider,
                    apiKey: resolvedAI.apiKey,
                    prompt: buildSpecialAIPrompt(type, {
                        lang, personality: cfg.personality || 'friendly',
                        books, stats, readerLevel, dailyGoalMins, currentBook,
                    }),
                    maxTokens: type === 'bookTalk' ? 120 : 300,
                });
            }
        } catch (err) {
            console.warn('[SharkReader] Sharky special command failed:', err);
        }

        if (!reply) {
            const fallbacks = {
                bookTalk: {
                    es: currentBook ? `¿Qué te parece "${currentBook.name}" hasta ahora?` : '¡Cuéntame qué estás leyendo!',
                    en: currentBook ? `What do you think of "${currentBook.name}" so far?` : 'Tell me what you are reading!',
                },
                summary: {
                    es: '¡Activa la IA en los ajustes de Sharky para obtener resúmenes de capítulos!',
                    en: 'Enable AI in Sharky settings to get chapter summaries!',
                },
                quiz: {
                    es: '¡Activa la IA en los ajustes de Sharky para el modo quiz!',
                    en: 'Enable AI in Sharky settings for quiz mode!',
                },
            };
            reply = fallbacks[type]?.[l] || null;
        }

        await new Promise(r => scheduleSharkyTimeout(r, delay));
        if (!isMountedRef.current) return;
        if (reply) setChatMessages(prev => [...prev, { role: 'sharky', text: reply, ts: Date.now() }]);
        setSharkyTyping(false);
    }, [addonConfig.sharkyMascot, books, booksById, buildChatCtx, dailyGoalMins, globalAiApiKey, globalAiProvider, lang, lastReadId, readerLevel, scheduleSharkyTimeout, sharkyTyping, stats]);

    const clearChat = useCallback(() => {
        setChatMessages([]);
    }, []);

    const openChat = useCallback(() => {
        setSharkyOpen(false);
        setSharkyChatOpen(true);
    }, []);

    const closeChat = useCallback(() => {
        setSharkyChatOpen(false);
    }, []);

    // ── AI: mensaje periódico ──
    const fetchAndShowAIMessage = useCallback(async () => {
        const cfg = addonConfig.sharkyMascot || {};
        const resolvedAI = resolveAIConfig(cfg, globalAiProvider, globalAiApiKey);
        if (!cfg.aiEnabled || !resolvedAI.apiKey || !resolvedAI.provider) return false;
        if (aiRequestInFlightRef.current) return false;
        aiRequestInFlightRef.current = true;
        try {
            const personality = cfg.personality || 'friendly';
            const msg = await fetchAIMessage({
                provider: resolvedAI.provider,
                apiKey: resolvedAI.apiKey,
                prompt: buildSystemPrompt({ lang, personality, books, stats, readerLevel, dailyGoalMins }) + '\n\nWrite a single short encouraging message (max 12 words). No quotes. Output only the message.',
            });
            if (msg) {
                if (!isMountedRef.current) return false;
                setSharkyMoodEvent(msg);
                clearMoodEventAfter(4000, msg);
                return true;
            }
        } catch (err) {
            console.warn('[SharkReader] Sharky AI message failed:', err);
        } finally {
            aiRequestInFlightRef.current = false;
        }
        return false;
    }, [addonConfig.sharkyMascot, books, clearMoodEventAfter, dailyGoalMins, globalAiApiKey, globalAiProvider, lang, readerLevel, stats]);

    // ── Efecto: modo concentración ──
    useEffect(() => {
        if (!addons.sharkyMascot || !userProfile) return;
        if (view === 'reader') {
            const personality = addonConfig.sharkyMascot?.personality || 'friendly';
            const lines = getLines(personality, lang);
            const msg = pickRandom(lines.focus);
            setSharkyMoodEvent(msg);
            const timer = scheduleSharkyTimeout(() => setSharkyMoodEvent(null), 2600);
            return () => clearTimeout(timer);
        }
    }, [addons.sharkyMascot, lang, scheduleSharkyTimeout, userProfile, view]);

    // ── Efecto: nuevo logro ──
    useEffect(() => {
        if (!addons.sharkyMascot || !userProfile || !achievementToast) return;
        emitSharkyEvent('achievement', {
            message: lang === 'en' ? `New achievement: ${achievementToast.name}` : `Nuevo logro: ${achievementToast.name}`,
            force: true,
        });
    }, [achievementToast, addons.sharkyMascot, emitSharkyEvent, lang, userProfile]);

    // ── Efecto: mensajes periódicos ──
    useEffect(() => {
        const cfg = addonConfig.sharkyMascot || {};
        const personality = cfg.personality || 'friendly';
        if (!addons.sharkyMascot || !userProfile || personality === 'silent') return;
        const tick = async () => {
            if (document.hidden || sharkyOpen || sharkyChatOpen || view === 'reader') return;
            const usedAI = await fetchAndShowAIMessage();
            if (!usedAI) {
                const lines = getLines(personality, lang);
                const line = pickRandom(lines.ambient);
                setSharkyMoodEvent(line);
                clearMoodEventAfter(4000, line);
            }
        };
        const timer = setInterval(tick, 45000);
        return () => clearInterval(timer);
    }, [addonConfig.sharkyMascot?.personality, addonConfig.sharkyMascot?.aiEnabled, addonConfig.sharkyMascot?.aiKey, addonConfig.sharkyMascot?.aiProvider, addons.sharkyMascot, clearMoodEventAfter, fetchAndShowAIMessage, lang, sharkyChatOpen, sharkyOpen, userProfile, view]);

    // ── Drag & click ──
    const moveSharkyMascot = useCallback((event) => {
        if (!addons.sharkyMascot) return;
        event.preventDefault();
        event.stopPropagation();
        setDraggingSharky(true);
        const startX = event.clientX;
        const startY = event.clientY;
        const current = addonConfig.sharkyMascot || {};
        const startLeft = Number(current.left ?? window.innerWidth - 82);
        const startTop = Number(current.top ?? window.innerHeight - 82);
        let lastPosition = { left: startLeft, top: startTop };
        sharkyDragMovedRef.current = false;
        const onMove = (moveEvent) => {
            const nextLeft = Math.max(20, Math.min(window.innerWidth - 60, startLeft + moveEvent.clientX - startX));
            const nextTop = Math.max(80, Math.min(window.innerHeight - 70, startTop + moveEvent.clientY - startY));
            if (Math.abs(moveEvent.clientX - startX) + Math.abs(moveEvent.clientY - startY) > 6) sharkyDragMovedRef.current = true;
            lastPosition = { left: Math.round(nextLeft), top: Math.round(nextTop) };
            setAddonConfigLive?.('sharkyMascot', lastPosition);
        };
        const onUp = () => {
            setDraggingSharky(false);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            updateAddonConfig('sharkyMascot', { ...(addonConfig.sharkyMascot || {}), ...lastPosition });
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }, [addonConfig, addons.sharkyMascot, updateAddonConfig]);

    const handleSharkyClick = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        if (sharkyDragMovedRef.current) {
            sharkyDragMovedRef.current = false;
            return;
        }
        // If chat is enabled and open, clicking the mascot closes chat
        if (sharkyChatOpen) { setSharkyChatOpen(false); return; }
        setSharkyOpen(prev => {
            if (prev) setSharkyConfigOpen(false);
            return !prev;
        });
    }, [sharkyChatOpen]);

    const handleSharkyPet = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        const name = addonConfig.sharkyMascot?.name?.trim() || 'Sharky';
        setSharkyExpression('loved');
        setSharkyHeart(true);
        setSharkyMoodEvent(lang === 'en' ? `${name} liked that.` : `${name} recibió una caricia.`);
        onPet?.();
        scheduleSharkyTimeout(() => setSharkyHeart(false), 1200);
        scheduleSharkyTimeout(() => setSharkyExpression('neutral'), 2300);
        scheduleSharkyTimeout(() => setSharkyMoodEvent(null), 3200);
    }, [addonConfig.sharkyMascot?.name, lang, onPet, scheduleSharkyTimeout]);

    const sharkyContinueReading = useCallback(() => {
        if (!lastReadId) {
            setSharkyMoodEvent(lang === 'en' ? 'No recent book found.' : 'No hay lectura reciente.');
            scheduleSharkyTimeout(() => setSharkyMoodEvent(null), 2400);
            return;
        }
        setSharkyOpen(false);
        openBook(lastReadId);
    }, [lang, lastReadId, openBook, scheduleSharkyTimeout]);

    const sharkyOpenAchievements = useCallback(() => {
        setSharkyOpen(false);
        setView('achievements');
    }, [setView]);

    const sharkyOpenGoal = useCallback(() => {
        setSharkyOpen(false);
        setSidebarOpen(true);
    }, [setSidebarOpen]);

    const sharkyRoulette = useCallback(() => {
        setSharkyOpen(false);
        spinBookRoulette();
    }, [spinBookRoulette]);

    const setSharkyPersonality = useCallback((personality) => {
        updateAddonConfig('sharkyMascot', { personality });
    }, [updateAddonConfig]);

    const setSharkyVisibility = useCallback((visibility) => {
        updateAddonConfig('sharkyMascot', { visibility });
    }, [updateAddonConfig]);

    const setSharkyCosmetic = useCallback((cosmetic) => {
        updateAddonConfig('sharkyMascot', { cosmetic });
    }, [updateAddonConfig]);

    const setSharkyName = useCallback((name) => {
        updateAddonConfig('sharkyMascot', { name: name.slice(0, 24) });
    }, [updateAddonConfig]);

    const setSharkyAIEnabled = useCallback((aiEnabled) => {
        updateAddonConfig('sharkyMascot', { aiEnabled });
        setAiTestStatus(null);
    }, [updateAddonConfig]);

    const setSharkyAIProvider = useCallback((aiProvider) => {
        updateAddonConfig('sharkyMascot', { aiProvider });
        setAiTestStatus(null);
    }, [updateAddonConfig]);

    const setSharkyAIKey = useCallback((aiKey) => {
        updateAddonConfig('sharkyMascot', { aiKey: aiKey.slice(0, 200) });
        setAiTestStatus(null);
    }, [updateAddonConfig]);

    const setSharkyChat = useCallback((chatEnabled) => {
        updateAddonConfig('sharkyMascot', { chatEnabled });
        if (!chatEnabled) setSharkyChatOpen(false);
    }, [updateAddonConfig]);

    const updateSharkyBehavior = useCallback((patch) => {
        updateAddonConfig('sharkyMascot', patch);
    }, [updateAddonConfig]);

    const testSharkyAI = useCallback(async () => {
        const cfg = addonConfig.sharkyMascot || {};
        const resolvedAI = resolveAIConfig(cfg, globalAiProvider, globalAiApiKey);
        if (!resolvedAI.apiKey || !resolvedAI.provider) return;
        setAiTestStatus('testing');
        try {
            const msg = await fetchAIMessage({
                provider: resolvedAI.provider,
                apiKey: resolvedAI.apiKey,
                prompt: buildSystemPrompt({ lang, personality: cfg.personality || 'friendly', books, stats, readerLevel, dailyGoalMins }) + '\n\nWrite a single short test greeting (max 10 words). No quotes.',
            });
            if (msg) {
                if (!isMountedRef.current) return;
                setAiTestStatus('ok');
                setSharkyMoodEvent(msg);
                clearMoodEventAfter(5000, msg);
            } else {
                setAiTestStatus('error:Sin respuesta');
            }
        } catch (err) {
            setAiTestStatus('error:' + (err?.message || 'Error desconocido'));
        }
    }, [addonConfig.sharkyMascot, books, clearMoodEventAfter, dailyGoalMins, globalAiApiKey, globalAiProvider, lang, readerLevel, stats]);

    // ── Métodos imperativos ──
    const notifyMilestone = useCallback((bookId, mark, bookName, previousProgress, nextProgress) => {
        if (!addons.sharkyMascot) return;
        if (addonConfig.sharkyMascot?.milestoneReactions === false) return;
        const key = `${bookId}:${mark}`;
        if (previousProgress >= mark || nextProgress < mark || sharkyMilestonesRef.current.has(key)) return;
        sharkyMilestonesRef.current.add(key);
        emitSharkyEvent(mark === 100 ? 'bookFinished' : 'milestone', {
            message: mark === 100
                ? (lang === 'en' ? `Finished: ${bookName}` : `Terminado: ${bookName}`)
                : (lang === 'en' ? `${mark}% reached in ${bookName}` : `${mark}% alcanzado en ${bookName}`),
            duration: mark === 100 ? 5000 : 3600,
            force: mark === 100,
            celebration: mark === 100 ? { title: lang === 'en' ? 'Book finished' : 'Libro terminado', bookName } : null,
        });
    }, [addonConfig.sharkyMascot?.milestoneReactions, addons.sharkyMascot, emitSharkyEvent, lang]);

    const notifyBookFinished = useCallback((bookName, minutes) => {
        if (!addons.sharkyMascot) return;
        setSharkyCelebration({
            title: lang === 'en' ? 'Book finished' : 'Libro terminado',
            bookName,
            detail: minutes > 0 ? (lang === 'en' ? `${minutes} min read` : `${minutes} min leídos`) : undefined,
        });
        setSharkyMoodEvent(lang === 'en' ? `Finished: ${bookName}` : `Terminado: ${bookName}`);
        clearMoodEventAfter(4200);
    }, [addons.sharkyMascot, clearMoodEventAfter, lang]);

    const notifySessionEnd = useCallback(({ bookName, sessionMins, startProgress, endProgress, progressDelta }) => {
        if (!addons.sharkyMascot) return;
        const cfg = addonConfig.sharkyMascot || {};
        const personality = cfg.personality || 'friendly';
        const l = lang === 'en' ? 'en' : 'es';
        const fn = SESSION_END[l]?.[personality];
        const msg = fn?.({ bookName, sessionMins, endProgress, progressDelta });
        if (!msg) return;
        setSharkyMoodEvent(msg);
        clearMoodEventAfter(sessionMins >= 20 ? 5000 : 4000, msg);
    }, [addons.sharkyMascot, addonConfig.sharkyMascot, clearMoodEventAfter, lang]);

    const notifyBookOpened = useCallback(({ bookName, progress, lastReadDate, isNew, hour }) => {
        if (!addons.sharkyMascot) return;
        const cfg = addonConfig.sharkyMascot || {};
        const personality = cfg.personality || 'friendly';
        const l = lang === 'en' ? 'en' : 'es';
        const daysSinceRead = lastReadDate ? Math.floor((Date.now() - lastReadDate) / 86400000) : 0;
        const fn = BOOK_OPENED[l]?.[personality];
        const msg = fn?.({ bookName, progress, daysSinceRead, isNew, hour });
        if (!msg) return;
        setSharkyMoodEvent(msg);
        clearMoodEventAfter(3500, msg);
    }, [addons.sharkyMascot, addonConfig.sharkyMascot, clearMoodEventAfter, lang]);

    const notifyStreakMilestone = useCallback((streak) => {
        if (!addons.sharkyMascot) return;
        const milestones = [7, 14, 30, 60, 100, 365];
        const hit = milestones.find(m => streak >= m && !streakMilestonesNotifiedRef.current.has(m));
        if (!hit) return;
        streakMilestonesNotifiedRef.current.add(hit);
        const l = lang === 'en' ? 'en' : 'es';
        const msg = l === 'es' ? `¡${hit} días seguidos leyendo! Racha épica.` : `${hit} days reading streak! Epic.`;
        setSharkyMoodEvent(msg);
        clearMoodEventAfter(5000, msg);
    }, [addons.sharkyMascot, clearMoodEventAfter, lang]);

    const notifyStreakLost = useCallback((streak) => {
        if (!addons.sharkyMascot) return;
        const l = lang === 'en' ? 'en' : 'es';
        const msg = l === 'es'
            ? `Racha de ${streak} días perdida... ¡No te rindas, puedes volver a empezar!`
            : `${streak}-day streak lost... Don't give up, start again!`;
        setSharkyMoodEvent(msg);
        clearMoodEventAfter(5000, msg);
    }, [addons.sharkyMascot, clearMoodEventAfter, lang]);

    const notifyNextInSeries = useCallback(({ seriesName, nextBookName }) => {
        if (!addons.sharkyMascot) return;
        const l = lang === 'en' ? 'en' : 'es';
        const msg = l === 'es'
            ? `¡Libro terminado! El siguiente en "${seriesName}" es "${nextBookName}".`
            : `Book finished! Next in "${seriesName}" is "${nextBookName}".`;
        setSharkyMoodEvent(msg);
        clearMoodEventAfter(5000, msg);
    }, [addons.sharkyMascot, clearMoodEventAfter, lang]);

    const notifyBookAnniversary = useCallback(({ bookName, dateStarted }) => {
        if (!addons.sharkyMascot || !dateStarted) return;
        const daysSince = Math.floor((Date.now() - dateStarted) / 86400000);
        if (daysSince !== 365 && daysSince !== 180 && daysSince !== 30) return;
        const l = lang === 'en' ? 'en' : 'es';
        let msg = null;
        if (daysSince === 365) msg = l === 'es' ? `¡Hace un año abriste "${bookName}"!` : `One year ago you opened "${bookName}"!`;
        else if (daysSince === 180) msg = l === 'es' ? `6 meses con "${bookName}". ¿Cómo va?` : `6 months with "${bookName}". How is it going?`;
        else if (daysSince === 30) msg = l === 'es' ? `Un mes desde que empezaste "${bookName}".` : `One month since you started "${bookName}".`;
        if (!msg) return;
        setSharkyMoodEvent(msg);
        clearMoodEventAfter(4500, msg);
    }, [addons.sharkyMascot, clearMoodEventAfter, lang]);

    const notifyBookFinishedFormal = useCallback((bookName, minutes) => {
        if (!addons.sharkyMascot) return;
        emitSharkyEvent('bookFinished', {
            message: lang === 'en' ? `Finished: ${bookName}` : `Terminado: ${bookName}`,
            duration: 5000,
            force: true,
            celebration: {
                title: lang === 'en' ? 'Book finished' : 'Libro terminado',
                bookName,
                detail: minutes > 0 ? (lang === 'en' ? `${minutes} min read` : `${minutes} min leídos`) : undefined,
            },
        });
    }, [addons.sharkyMascot, emitSharkyEvent, lang]);

    const notifySessionEndFormal = useCallback(({ bookName, sessionMins, startProgress, endProgress, progressDelta }) => {
        if (!addons.sharkyMascot || addonConfig.sharkyMascot?.showSessionSummary === false) return;
        const cfg = addonConfig.sharkyMascot || {};
        const personality = cfg.personality || 'friendly';
        const l = lang === 'en' ? 'en' : 'es';
        const fn = SESSION_END[l]?.[personality];
        const msg = fn?.({ bookName, sessionMins, endProgress, progressDelta });
        if (!msg) return;
        const safeMinutes = Math.max(0, Math.round(sessionMins || 0));
        const safeDelta = Math.max(0, Math.round(progressDelta || 0));
        emitSharkyEvent('sessionSummary', {
            message: msg,
            duration: safeMinutes >= 20 ? 5000 : 4000,
            celebration: safeMinutes >= 10 || safeDelta >= 5 ? {
                title: lang === 'en' ? 'Session summary' : 'Resumen de sesión',
                bookName,
                detail: `${safeMinutes} min · +${safeDelta}%`,
            } : null,
        });
    }, [addonConfig.sharkyMascot, addons.sharkyMascot, emitSharkyEvent, lang]);

    const notifyBookOpenedFormal = useCallback(({ bookName, progress, lastReadDate, isNew, hour }) => {
        if (!addons.sharkyMascot || addonConfig.sharkyMascot?.showContextTips === false) return;
        const cfg = addonConfig.sharkyMascot || {};
        const personality = cfg.personality || 'friendly';
        const l = lang === 'en' ? 'en' : 'es';
        const daysSinceRead = lastReadDate ? Math.floor((Date.now() - lastReadDate) / 86400000) : 0;
        const fn = BOOK_OPENED[l]?.[personality];
        const msg = fn?.({ bookName, progress, daysSinceRead, isNew, hour });
        if (!msg) return;
        emitSharkyEvent('bookOpened', { message: msg, duration: 3200 });
    }, [addonConfig.sharkyMascot, addons.sharkyMascot, emitSharkyEvent, lang]);

    const notifyStreakMilestoneFormal = useCallback((streak) => {
        if (!addons.sharkyMascot) return;
        const milestones = [7, 14, 30, 60, 100, 365];
        const hit = milestones.find(m => streak >= m && !streakMilestonesNotifiedRef.current.has(m));
        if (!hit) return;
        streakMilestonesNotifiedRef.current.add(hit);
        const msg = lang === 'en' ? `${hit} days reading streak! Epic.` : `¡${hit} días seguidos leyendo! Racha épica.`;
        emitSharkyEvent('streak', { message: msg, duration: 5000, force: true });
    }, [addons.sharkyMascot, emitSharkyEvent, lang]);

    const notifyStreakLostFormal = useCallback((streak) => {
        if (!addons.sharkyMascot) return;
        const msg = lang === 'en'
            ? `${streak}-day streak lost... Don't give up, start again!`
            : `Racha de ${streak} días perdida... puedes volver a empezar.`;
        emitSharkyEvent('streakLost', { message: msg, duration: 5000, force: true });
    }, [addons.sharkyMascot, emitSharkyEvent, lang]);

    const notifyNextInSeriesFormal = useCallback(({ seriesName, nextBookName }) => {
        if (!addons.sharkyMascot) return;
        const msg = lang === 'en'
            ? `Book finished. Next in "${seriesName}": "${nextBookName}".`
            : `Libro terminado. Siguiente en "${seriesName}": "${nextBookName}".`;
        emitSharkyEvent('bookFinished', { message: msg, duration: 5000, force: true });
    }, [addons.sharkyMascot, emitSharkyEvent, lang]);

    const notifyBookAnniversaryFormal = useCallback(({ bookName, dateStarted }) => {
        if (!addons.sharkyMascot || !dateStarted) return;
        const daysSince = Math.floor((Date.now() - dateStarted) / 86400000);
        if (daysSince !== 365 && daysSince !== 180 && daysSince !== 30) return;
        let msg = null;
        if (daysSince === 365) msg = lang === 'en' ? `One year ago you opened "${bookName}".` : `Hace un año abriste "${bookName}".`;
        else if (daysSince === 180) msg = lang === 'en' ? `6 months with "${bookName}". How is it going?` : `6 meses con "${bookName}". ¿Cómo va?`;
        else if (daysSince === 30) msg = lang === 'en' ? `One month since you started "${bookName}".` : `Un mes desde que empezaste "${bookName}".`;
        if (!msg) return;
        emitSharkyEvent('anniversary', { message: msg, duration: 4500 });
    }, [addons.sharkyMascot, emitSharkyEvent, lang]);

    // ── Cosméticos ──
    const unlockedCosmetics = useMemo(() => [
        { id: 'auto',    label: 'Auto',                                         unlocked: true },
        { id: 'glasses', label: lang === 'en' ? 'Glasses' : 'Gafas',           unlocked: readerLevel.level >= 2 },
        { id: 'scarf',   label: lang === 'en' ? 'Scarf' : 'Bufanda',           unlocked: (stats.streak || 0) >= 3 },
        { id: 'cap',     label: lang === 'en' ? 'Cap' : 'Gorra',               unlocked: books.some(b => b.isFinished) },
        { id: 'crown',   label: lang === 'en' ? 'Crown' : 'Corona',            unlocked: readerLevel.level >= 10 },
    ], [books, lang, readerLevel.level, stats.streak]);

    // ── Visibilidad ──
    const sharkyConfig = addonConfig.sharkyMascot || {};
    const sharkyVisibility = sharkyConfig.visibility || 'always';
    const shouldShowSharky =
        sharkyVisibility !== 'hidden' && (
        sharkyVisibility === 'always' ||
        (sharkyVisibility === 'library' && view === 'library') ||
        (sharkyVisibility === 'reader' && view === 'reader') ||
        (sharkyVisibility === 'events' && (!!sharkyMoodEvent || !!sharkyCelebration))
        );

    useEffect(() => {
        if (!actionsRef) return;
        actionsRef.current = {
            notifyMilestone,
            notifyBookFinished: notifyBookFinishedFormal,
            notifySessionEnd: notifySessionEndFormal,
            notifyBookOpened: notifyBookOpenedFormal,
            notifyStreakMilestone: notifyStreakMilestoneFormal,
            notifyBookAnniversary: notifyBookAnniversaryFormal,
            notifyNextInSeries: notifyNextInSeriesFormal,
            notifyStreakLost: notifyStreakLostFormal,
        };
    }, [actionsRef, notifyMilestone, notifyBookFinishedFormal, notifySessionEndFormal, notifyBookOpenedFormal, notifyStreakMilestoneFormal, notifyBookAnniversaryFormal, notifyNextInSeriesFormal, notifyStreakLostFormal]);

    const value = {
        sharkyOpen, setSharkyOpen,
        sharkyConfigOpen, setSharkyConfigOpen,
        sharkyExpression,
        sharkyHeart,
        sharkyMoodEvent,
        sharkyCelebration, setSharkyCelebration,
        draggingSharky,
        sharkyState,
        aiTestStatus,
        sharkyChatOpen, setSharkyChatOpen,
        chatMessages,
        sharkyTyping,
        sendChatMessage,
        sendSpecialCommand,
        clearChat,
        openChat,
        closeChat,
        lastReadBook,
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
        updateSharkyBehavior,
        testSharkyAI,
        addons,
        addonConfig,
        readerLevel,
        lang,
        userProfile,
        view,
        unlockedCosmetics,
        shouldShowSharky,
    };

    return <SharkyContext.Provider value={value}>{children}</SharkyContext.Provider>;
};
