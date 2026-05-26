import { useEffect, startTransition } from 'react';
import { checkNewAchievements } from '../achievements';
import { updateBookInList } from '../bookModel';
import { saveAppData } from '../db';

export function useReadingSession({
    view,
    userProfile,
    tabs,
    activeTabId,
    setBooks,
    setStats,
    setAnniversaryInfo,
    setAchievements,
    setAchievementToast,
    setView,
    isDbLoaded,
    isStateHydrated,
    stats,
    books,
    vocabulary,
    achievements,
    addons,
    addonConfig,
    yearlyGoal,
    booksById,
    lastReadId,
    activeBookIdRef,
    sharkyActionsRef,
}) {
    // Reading timer + streak + per-book minutes (fires every 60s while reading)
    useEffect(() => {
        let interval;
        if (view === 'reader' && userProfile) {
            interval = setInterval(() => {
                const today = new Date();
                const todayStr = today.toDateString();
                const hour = today.getHours();
                let newStreak = null;
                setStats(prev => {
                    let { timeRead = 0, pagesTurned = 0, streak = 0, currentDailyMins = 0, lastActiveDate = '', streakSavers = 0, history = {}, minutesByDay = {}, hourlyLog = {} } = prev;
                    timeRead++;
                    minutesByDay = { ...minutesByDay, [todayStr]: (minutesByDay[todayStr] || 0) + 1 };
                    hourlyLog = { ...hourlyLog, [hour]: (hourlyLog[hour] || 0) + 1 };
                    if (lastActiveDate !== todayStr) { currentDailyMins = 1; lastActiveDate = todayStr; }
                    else { currentDailyMins++; }
                    if (currentDailyMins === 5 && history[todayStr] !== 'read') {
                        const dates = Object.keys(history).filter(k => history[k] === 'read' || history[k] === 'saved').sort((a, b) => new Date(a) - new Date(b));
                        const lastDateStr = dates[dates.length - 1];
                        if (lastDateStr) {
                            const lastDate = new Date(lastDateStr); lastDate.setHours(0, 0, 0, 0);
                            const todayMidnight = new Date(today); todayMidnight.setHours(0, 0, 0, 0);
                            const diffDays = Math.round((todayMidnight - lastDate) / 86400000);
                            if (diffDays === 1) { streak++; }
                            else if (diffDays > 1) {
                                const missed = diffDays - 1;
                                if (streakSavers >= missed) {
                                    streakSavers -= missed; streak++;
                                    for (let i = 1; i <= missed; i++) {
                                        const d = new Date(lastDateStr); d.setDate(d.getDate() + i);
                                        history[d.toDateString()] = 'saved';
                                    }
                                } else { streak = 1; streakSavers = 0; }
                            }
                        } else { streak = 1; }
                        history[todayStr] = 'read';
                        if (streak > 0 && streak % 5 === 0) streakSavers = Math.min(2, streakSavers + 1);
                        newStreak = streak;
                    }
                    return { timeRead, pagesTurned, streak, currentDailyMins, lastActiveDate, streakSavers, history, minutesByDay, hourlyLog };
                });
                if (activeBookIdRef.current) {
                    startTransition(() => {
                        setBooks(prev => {
                            if (!prev.find(b => b.id === activeBookIdRef.current)) return prev;
                            return updateBookInList(prev, activeBookIdRef.current, b => ({
                                ...b,
                                readingMinutes: (b.readingMinutes || 0) + 1,
                                dateStarted: b.dateStarted || Date.now(),
                            }));
                        });
                    });
                }
                if (newStreak !== null) {
                    setTimeout(() => sharkyActionsRef?.current?.notifyStreakMilestone(newStreak), 200);
                }
            }, 60000);
        }
        return () => clearInterval(interval);
    }, [view, userProfile]); // eslint-disable-line

    // Keep activeBookIdRef in sync with the active tab
    useEffect(() => {
        const tab = tabs.find(t => t.id === activeTabId);
        activeBookIdRef.current = tab?.bookId || null;
    }, [activeTabId, tabs]); // eslint-disable-line

    // Anniversary detection on book open
    useEffect(() => {
        if (!lastReadId) return;
        const bk = booksById.get(lastReadId);
        if (!bk || !bk.dateStarted || !(bk.readingMinutes > 0)) return;
        const daysSince = Math.floor((Date.now() - bk.dateStarted) / 86400000);
        const milestones = [7, 14, 30, 60, 100, 180, 365];
        if (milestones.includes(daysSince)) {
            setAnniversaryInfo({ name: bk.name, days: daysSince, readingMinutes: bk.readingMinutes || 0 });
            setTimeout(() => sharkyActionsRef?.current?.notifyBookAnniversary({ bookName: bk.name, dateStarted: bk.dateStarted }), 1500);
        }
    }, [lastReadId, booksById]); // eslint-disable-line

    // Achievement check when reading state changes
    useEffect(() => {
        if (!isDbLoaded || !isStateHydrated || !userProfile) return;
        const context = { stats, books, vocabulary, achievements, addons, addonConfig, yearlyGoal };
        const newOnes = checkNewAchievements(context, achievements);
        if (!newOnes.length) return;
        const now = Date.now();
        const updated = { ...achievements };
        newOnes.forEach(a => { updated[a.id] = { unlockedAt: now }; });
        setAchievements(updated);
        saveAppData('achievements', updated);
        setAchievementToast(newOnes[0]);
        setTimeout(() => setAchievementToast(null), 4000);
    }, [stats, books, vocabulary, addons]); // eslint-disable-line

    // Redirect away from achievements page if no profile
    useEffect(() => {
        if (!userProfile && view === 'achievements') {
            setView('library');
        }
    }, [userProfile, view]); // eslint-disable-line
}
