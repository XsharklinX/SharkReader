import { useEffect, startTransition } from 'react';
import { checkNewAchievements } from '../achievements';
import { updateBookInList } from '../bookModel';
import { saveAppData } from '../db';
import { applyReadingMinute } from '../readingProgress';

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
                let newStreak = null;
                let lostStreak = null;
                setStats(prev => {
                    const r = applyReadingMinute(prev, today);
                    newStreak = r.newStreak;
                    lostStreak = r.lostStreak;
                    return r.next;
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
                if (lostStreak !== null) {
                    setTimeout(() => sharkyActionsRef?.current?.notifyStreakLost?.(lostStreak), 300);
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
        if (!milestones.includes(daysSince)) return;

        const seenMilestones = Array.isArray(bk.anniversaryMilestonesSeen) ? bk.anniversaryMilestonesSeen : [];
        if (seenMilestones.includes(daysSince)) return;

        const now = Date.now();
        startTransition(() => {
            setBooks(prev => updateBookInList(prev, lastReadId, currentBook => {
                const currentSeen = Array.isArray(currentBook?.anniversaryMilestonesSeen)
                    ? currentBook.anniversaryMilestonesSeen
                    : [];
                if (currentSeen.includes(daysSince)) return currentBook;
                return {
                    ...currentBook,
                    anniversaryMilestonesSeen: [...currentSeen, daysSince].sort((a, b) => a - b),
                    metadataUpdatedAt: now,
                    updatedAt: now,
                };
            }));
        });

        setAnniversaryInfo({ name: bk.name, days: daysSince, readingMinutes: bk.readingMinutes || 0 });
        setTimeout(() => sharkyActionsRef?.current?.notifyBookAnniversary({ bookName: bk.name, dateStarted: bk.dateStarted }), 1500);
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
