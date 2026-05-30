// Lógica pura de progreso de lectura: rachas (streak) y sistema de niveles (XP).
// Extraída de useReadingSession.js y App.jsx para poder testearla sin React.

// ── Rachas ─────────────────────────────────────────────────────────────────
// Aplica un "minuto leído" al objeto stats y devuelve el nuevo estado + señales.
// `now` es inyectable para tests deterministas.
// Reglas:
// - La racha solo se evalúa al alcanzar 5 min de lectura en el día (currentDailyMins === 5).
// - +1 día consecutivo aumenta la racha; un hueco se cubre con streakSavers si alcanzan,
//   si no, la racha se reinicia a 1 (y se reporta lostStreak si la perdida era > 3).
// - Cada 5 días de racha se gana un streakSaver (máx 2).
export function applyReadingMinute(prev, now = new Date()) {
    const todayStr = now.toDateString();
    const hour = now.getHours();
    let {
        timeRead = 0, pagesTurned = 0, streak = 0, currentDailyMins = 0,
        lastActiveDate = '', streakSavers = 0, history = {}, minutesByDay = {},
        hourlyLog = {}, maxStreak = 0,
    } = prev || {};

    let newStreak = null;   // racha alcanzada hoy (para notificar milestone)
    let lostStreak = null;  // racha perdida (para notificar pérdida) si era > 3

    timeRead++;
    minutesByDay = { ...minutesByDay, [todayStr]: (minutesByDay[todayStr] || 0) + 1 };
    hourlyLog = { ...hourlyLog, [hour]: (hourlyLog[hour] || 0) + 1 };
    history = { ...history };

    if (lastActiveDate !== todayStr) { currentDailyMins = 1; lastActiveDate = todayStr; }
    else { currentDailyMins++; }

    if (currentDailyMins === 5 && history[todayStr] !== 'read') {
        const dates = Object.keys(history)
            .filter(k => history[k] === 'read' || history[k] === 'saved')
            .sort((a, b) => new Date(a) - new Date(b));
        const lastDateStr = dates[dates.length - 1];
        if (lastDateStr) {
            const lastDate = new Date(lastDateStr); lastDate.setHours(0, 0, 0, 0);
            const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0);
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
                } else { if (streak > 3) lostStreak = streak; streak = 1; streakSavers = 0; }
            }
        } else { streak = 1; }
        history[todayStr] = 'read';
        if (streak > 0 && streak % 5 === 0) streakSavers = Math.min(2, streakSavers + 1);
        newStreak = streak;
    }

    const next = {
        ...prev,
        timeRead, pagesTurned, streak, currentDailyMins, lastActiveDate,
        streakSavers, history, minutesByDay, hourlyLog,
        maxStreak: Math.max(maxStreak, streak),
    };
    return { next, newStreak, lostStreak };
}

// ── Sistema de niveles ───────────────────────────────────────────────────────
// XP = minutos*2 + libros terminados*80 + bookmarks*8 + libros con notas*20.
export function readerXp({ minutesRead = 0, booksFinished = 0, bookmarks = 0, notedBooks = 0 } = {}) {
    return Math.max(0, minutesRead * 2) + booksFinished * 80 + bookmarks * 8 + notedBooks * 20;
}

export function readerLevelFromXp(xp, xpPerLevel = 100) {
    const per = xpPerLevel > 0 ? xpPerLevel : 100;
    const level = Math.max(1, Math.floor(xp / per) + 1);
    const current = xp % per;
    return { xp, level, current, xpPerLevel: per, progress: Math.round((current / per) * 100) };
}
