import { useState, useEffect, useRef, useCallback } from 'react';

const safeParseLocal = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
};

export const TUTORIAL_HINTS = {
    library: [
        { id: 'library-import', icon: '📥', title: 'Añade tu primer libro', body: 'Arrastra archivos EPUB o PDF a la ventana, o usa el botón + en la esquina superior derecha.' },
        { id: 'library-filter', icon: '🔍', title: 'Filtra y busca', body: 'Usa la barra de búsqueda para encontrar libros por título, autor, serie, tags o sinopsis. El lateral organiza por categorías.' },
        { id: 'library-workshop', icon: '🔧', title: 'Workshop', body: 'Workshop activa módulos extra como sincronización y vocabulario, sin tocar tu biblioteca principal.' },
    ],
    reader: [
        { id: 'reader-highlight', icon: '🎨', title: 'Subrayados por color', body: 'Selecciona cualquier texto para subrayarlo. Elige entre 4 colores con significado propio.' },
        { id: 'reader-notes', icon: '📝', title: 'Notas al margen', body: 'Cuando subrayas, puedes añadir una nota al pasaje. Se guarda unida a ese punto exacto del libro.' },
        { id: 'reader-annotations-panel', icon: '📚', title: 'Panel lateral de anotaciones', body: 'El botón de anotaciones reúne marcadores, subrayados y notas para saltar entre ellos rápido.' },
        { id: 'reader-search', icon: '🔍', title: 'Búsqueda interna', body: 'La lupa busca texto dentro del libro y te mueve directo al resultado.' },
        { id: 'reader-book-info', icon: 'ℹ️', title: 'Ficha del libro', body: 'Desde el lector puedes abrir la ficha del libro para editar metadatos y revisar progreso.' },
    ],
    analytics: [
        { id: 'analytics-overview', icon: '📊', title: 'Tu dashboard lector', body: 'Tiempo de lectura, rachas, logros y progreso de toda tu biblioteca en un solo lugar.' },
        { id: 'analytics-goals', icon: '🎯', title: 'Metas de lectura', body: 'Define metas diarias y semanales. Sharky te animará cuando estés cerca del objetivo.' },
    ],
};

export function useOnboarding({ view, booksCount }) {
    const [tutorialEnabled, setTutorialEnabled] = useState(() => safeParseLocal('sharkreader_tutorial_enabled', true));
    const [showWelcomeTutorial, setShowWelcomeTutorial] = useState(() => safeParseLocal('sharkreader_tutorial_seen', false) !== true);
    const [tutorialQueue, setTutorialQueue] = useState([]);
    const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
    const [tutorialSeenHints, setTutorialSeenHints] = useState(() => safeParseLocal('sharkreader_tutorial_hints', {}));
    const [tutorialCooldown, setTutorialCooldown] = useState(false);
    const tutorialCooldownRef = useRef(null);

    useEffect(() => {
        localStorage.setItem('sharkreader_tutorial_enabled', JSON.stringify(tutorialEnabled));
        localStorage.setItem('sharkreader_tutorial_seen', JSON.stringify(!showWelcomeTutorial));
        localStorage.setItem('sharkreader_tutorial_hints', JSON.stringify(tutorialSeenHints));
    }, [showWelcomeTutorial, tutorialEnabled, tutorialSeenHints]);

    const startTutorialCooldown = useCallback((cooldownMs = 900) => {
        clearTimeout(tutorialCooldownRef.current);
        setTutorialCooldown(true);
        tutorialCooldownRef.current = setTimeout(() => setTutorialCooldown(false), cooldownMs);
    }, []);

    const dismissTutorialHints = useCallback(() => {
        const allHintIds = Object.values(TUTORIAL_HINTS).flat().map(hint => hint.id);
        setTutorialSeenHints(prev => {
            const next = { ...prev };
            allHintIds.forEach(id => { next[id] = true; });
            return next;
        });
        setTutorialQueue([]);
        setTutorialStepIndex(0);
        startTutorialCooldown(1200);
    }, [startTutorialCooldown]);

    const restartTutorial = useCallback(() => {
        clearTimeout(tutorialCooldownRef.current);
        setTutorialCooldown(false);
        setTutorialSeenHints({});
        setTutorialQueue([]);
        setTutorialStepIndex(0);
        setShowWelcomeTutorial(true);
    }, []);

    const completeWelcomeTutorial = useCallback((cooldownMs = 2500) => {
        clearTimeout(tutorialCooldownRef.current);
        setShowWelcomeTutorial(false);
        startTutorialCooldown(cooldownMs);
    }, [startTutorialCooldown]);

    const skipWelcomeTutorial = useCallback(() => {
        clearTimeout(tutorialCooldownRef.current);
        setTutorialCooldown(false);
        setShowWelcomeTutorial(false);
        dismissTutorialHints();
    }, [dismissTutorialHints]);

    useEffect(() => {
        if (!tutorialEnabled || showWelcomeTutorial || tutorialCooldown) return;
        const hints = TUTORIAL_HINTS[view] || [];
        const pending = hints.filter(hint => !tutorialSeenHints[hint.id]);
        if (!pending.length) return;
        setTutorialQueue(current => current.length > 0 ? current : [pending[0]]);
        setTutorialStepIndex(0);
    }, [showWelcomeTutorial, tutorialEnabled, tutorialSeenHints, view, tutorialCooldown]);

    const activeTutorialHint = tutorialQueue[tutorialStepIndex] || null;
    const handleTutorialNext = useCallback(() => {
        const currentHint = tutorialQueue[tutorialStepIndex];
        if (!currentHint) return;
        setTutorialSeenHints(prev => ({ ...prev, [currentHint.id]: true }));
        setTutorialQueue([]);
        setTutorialStepIndex(0);
        startTutorialCooldown(700);
    }, [startTutorialCooldown, tutorialQueue, tutorialStepIndex]);

    useEffect(() => {
        if (activeTutorialHint?.id !== 'library-import' || booksCount === 0) return;
        handleTutorialNext();
    }, [activeTutorialHint?.id, booksCount, handleTutorialNext]);

    useEffect(() => {
        if (activeTutorialHint?.id !== 'analytics-overview' || view !== 'analytics') return;
        const t = setTimeout(() => handleTutorialNext(), 5000);
        return () => clearTimeout(t);
    }, [activeTutorialHint?.id, view, handleTutorialNext]);

    // Auto-dismiss any active hint after 60 seconds
    useEffect(() => {
        if (!activeTutorialHint) return;
        const t = setTimeout(() => handleTutorialNext(), 60000);
        return () => clearTimeout(t);
    }, [activeTutorialHint?.id, handleTutorialNext]);

    useEffect(() => () => clearTimeout(tutorialCooldownRef.current), []);

    const resetTutorialCooldown = useCallback(() => {
        clearTimeout(tutorialCooldownRef.current);
        setTutorialCooldown(false);
    }, []);

    return {
        tutorialEnabled,
        setTutorialEnabled,
        showWelcomeTutorial,
        tutorialQueue,
        tutorialStepIndex,
        tutorialSeenHints,
        activeTutorialHint,
        dismissTutorialHints,
        restartTutorial,
        handleTutorialNext,
        completeWelcomeTutorial,
        skipWelcomeTutorial,
        resetTutorialCooldown,
    };
}
