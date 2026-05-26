import { useState, useMemo, useRef, useEffect } from 'react';
import { saveAppData } from '../db';

export function useStats({ isDbLoaded, isStateHydrated, isResettingRef }) {
    const [stats, setStats] = useState({
        timeRead: 0, pagesTurned: 0, streak: 0, lastStreakDate: '',
        currentDailyMins: 0, lastActiveDate: '', streakSavers: 0, history: {}, minutesByDay: {}
    });
    const persistStatsRef = useRef(null);

    useEffect(() => {
        if (!isDbLoaded || !isStateHydrated || isResettingRef.current) return;
        clearTimeout(persistStatsRef.current);
        persistStatsRef.current = setTimeout(() => {
            saveAppData('stats', stats);
        }, 3000);
        return () => clearTimeout(persistStatsRef.current);
    }, [stats, isDbLoaded, isStateHydrated]); // eslint-disable-line

    const currentWeekMins = useMemo(() => {
        const mbd = stats.minutesByDay || {};
        let total = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date(); d.setDate(d.getDate() - i);
            total += mbd[d.toDateString()] || 0;
        }
        return total;
    }, [stats.minutesByDay]);

    return { stats, setStats, currentWeekMins, persistStatsRef };
}
