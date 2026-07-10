// Lógica pura de retos de lectura: plantillas, progreso y detección de completado.
// Sin React ni side-effects para poder testearla igual que readingProgress.js.

export const CHALLENGE_TEMPLATES = [
    {
        type: 'streak',
        emoji: '🔥',
        label: 'Racha de días',
        desc: 'Lee al menos 5 minutos al día durante N días seguidos',
        targets: [3, 7, 14, 30],
        unit: 'días',
        buildTitle: (target) => `Racha de ${target} días`,
    },
    {
        type: 'minutes',
        emoji: '⏱️',
        label: 'Minutos en una semana',
        desc: 'Acumula N minutos de lectura en 7 días',
        targets: [60, 120, 300, 500],
        unit: 'min',
        buildTitle: (target) => `${target} minutos en una semana`,
    },
    {
        type: 'books',
        emoji: '📚',
        label: 'Libros en un mes',
        desc: 'Termina N libros en 30 días',
        targets: [1, 2, 3, 5],
        unit: 'libros',
        buildTitle: (target) => `${target} ${target === 1 ? 'libro' : 'libros'} en un mes`,
    },
];

const DURATION_DAYS = { streak: null, minutes: 7, books: 30 };

export function createChallenge(type, target, now = Date.now()) {
    const template = CHALLENGE_TEMPLATES.find(item => item.type === type);
    if (!template || !template.targets.includes(target)) return null;
    return {
        id: `${type}_${target}_${now.toString(36)}`,
        type,
        target,
        title: template.buildTitle(target),
        emoji: template.emoji,
        createdAt: now,
        completedAt: null,
    };
}

// Ventana temporal del reto: [createdAt, createdAt + duración). Streak no tiene ventana.
export function challengeDeadline(challenge) {
    const days = DURATION_DAYS[challenge.type];
    if (!days) return null;
    return challenge.createdAt + days * 86400000;
}

// Suma minutos leídos dentro de la ventana del reto usando stats.minutesByDay
// (claves en formato Date.toDateString()).
function minutesInWindow(minutesByDay = {}, fromTs, toTs) {
    let total = 0;
    Object.entries(minutesByDay).forEach(([dayStr, mins]) => {
        const day = new Date(dayStr).getTime();
        if (Number.isFinite(day) && day >= fromTs - 86400000 && day <= toTs) {
            // margen de -1 día porque toDateString es medianoche local
            const dayEnd = day + 86400000;
            if (dayEnd > fromTs && day < toTs) total += mins || 0;
        }
    });
    return total;
}

function booksFinishedInWindow(books = [], fromTs, toTs) {
    return books.filter(book =>
        book.isFinished &&
        Number.isFinite(book.dateFinished) &&
        book.dateFinished >= fromTs &&
        book.dateFinished <= toTs
    ).length;
}

// Progreso de un reto: { current, target, pct, done, expired, deadline }.
export function computeChallengeProgress(challenge, { stats = {}, books = [] } = {}, now = Date.now()) {
    const target = challenge.target || 1;
    let current = 0;
    const deadline = challengeDeadline(challenge);
    const expired = deadline !== null && now > deadline && !challenge.completedAt;

    if (challenge.type === 'streak') {
        current = stats.streak || 0;
    } else if (challenge.type === 'minutes') {
        current = minutesInWindow(stats.minutesByDay, challenge.createdAt, deadline ?? now);
    } else if (challenge.type === 'books') {
        current = booksFinishedInWindow(books, challenge.createdAt, deadline ?? now);
    }

    current = Math.min(current, target);
    const done = !!challenge.completedAt || (!expired && current >= target);
    return {
        current,
        target,
        pct: Math.min(100, Math.round((current / target) * 100)),
        done,
        expired,
        deadline,
    };
}

// Devuelve la lista con completedAt estampado en los retos recién completados,
// junto con los retos que acaban de completarse (para notificar). No muta.
export function settleChallenges(challenges = [], context, now = Date.now()) {
    const justCompleted = [];
    const next = challenges.map(challenge => {
        if (challenge.completedAt) return challenge;
        const progress = computeChallengeProgress(challenge, context, now);
        if (progress.done) {
            const settled = { ...challenge, completedAt: now };
            justCompleted.push(settled);
            return settled;
        }
        return challenge;
    });
    return { next: justCompleted.length ? next : challenges, justCompleted };
}

// ── Resumen semanal ──────────────────────────────────────────────────────────
// Clave ISO de la semana (lunes) para deduplicar la notificación.
export function isoWeekKey(now = new Date()) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    // Retroceder hasta el lunes
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
}

// Estadísticas de la semana pasada (lunes a domingo anteriores a la semana actual).
export function lastWeekSummary({ stats = {}, books = [] } = {}, now = new Date()) {
    const thisMonday = new Date(now);
    thisMonday.setHours(0, 0, 0, 0);
    thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7));
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);

    let minutes = 0;
    let daysActive = 0;
    Object.entries(stats.minutesByDay || {}).forEach(([dayStr, mins]) => {
        const day = new Date(dayStr);
        if (day >= lastMonday && day < thisMonday && mins > 0) {
            minutes += mins;
            daysActive += 1;
        }
    });
    const booksFinished = booksFinishedInWindow(books, lastMonday.getTime(), thisMonday.getTime() - 1);
    return { minutes, daysActive, booksFinished };
}
