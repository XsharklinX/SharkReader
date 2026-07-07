import { useCallback, useEffect, useRef, startTransition } from 'react';
import { sounds } from '../sounds';

export function useReaderPerformance({ setStats, addonsRef, addonConfig }) {
    const pendingReaderPagesRef = useRef(0);
    const readerStatsFlushTimerRef = useRef(null);
    const lastPageSoundAtRef = useRef(0);

    const flushReaderStats = useCallback(() => {
        const pages = pendingReaderPagesRef.current;
        pendingReaderPagesRef.current = 0;
        if (readerStatsFlushTimerRef.current) {
            clearTimeout(readerStatsFlushTimerRef.current);
            readerStatsFlushTimerRef.current = null;
        }
        if (!pages) return;
        startTransition(() => {
            setStats(prev => ({ ...prev, pagesTurned: prev.pagesTurned + pages }));
        });
    }, [setStats]);

    const handleReaderPageTurn = useCallback((pages = 1) => {
        const safePages = Number.isFinite(pages) ? Math.max(0, pages) : 1;
        if (!safePages) return;
        pendingReaderPagesRef.current += safePages;
        if (!readerStatsFlushTimerRef.current) {
            readerStatsFlushTimerRef.current = setTimeout(flushReaderStats, 1000);
        }
        const now = Date.now();
        if (addonsRef.current.soundFeedback && addonConfig.soundFeedback?.pageTurn !== false && now - lastPageSoundAtRef.current > 180) {
            lastPageSoundAtRef.current = now;
            sounds.pageTurn((addonConfig.soundFeedback?.volume || 50) / 100 * 0.1);
        }
    }, [addonConfig.soundFeedback?.pageTurn, addonConfig.soundFeedback?.volume, addonsRef, flushReaderStats]);

    useEffect(() => () => {
        flushReaderStats();
    }, [flushReaderStats]);

    return {
        handleReaderPageTurn,
        flushReaderStats,
    };
}
