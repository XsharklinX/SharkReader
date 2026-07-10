import { describe, it, expect } from 'vitest';
import {
    CHALLENGE_TEMPLATES,
    createChallenge,
    challengeDeadline,
    computeChallengeProgress,
    settleChallenges,
    isoWeekKey,
    lastWeekSummary,
} from './challenges';

const DAY = 86400000;

describe('createChallenge', () => {
    it('crea un reto válido con título y emoji de la plantilla', () => {
        const c = createChallenge('streak', 7, 1000);
        expect(c.type).toBe('streak');
        expect(c.target).toBe(7);
        expect(c.title).toContain('7');
        expect(c.emoji).toBe('🔥');
        expect(c.completedAt).toBeNull();
    });

    it('rechaza tipos o targets fuera de plantilla', () => {
        expect(createChallenge('streak', 999)).toBeNull();
        expect(createChallenge('nope', 7)).toBeNull();
    });

    it('todas las plantillas construyen títulos', () => {
        CHALLENGE_TEMPLATES.forEach(tpl => {
            tpl.targets.forEach(target => {
                expect(typeof tpl.buildTitle(target)).toBe('string');
            });
        });
    });
});

describe('challengeDeadline', () => {
    it('streak no expira', () => {
        expect(challengeDeadline(createChallenge('streak', 7, 0))).toBeNull();
    });
    it('minutes dura 7 días y books 30', () => {
        expect(challengeDeadline(createChallenge('minutes', 60, 0))).toBe(7 * DAY);
        expect(challengeDeadline(createChallenge('books', 1, 0))).toBe(30 * DAY);
    });
});

describe('computeChallengeProgress', () => {
    it('streak usa la racha actual y se completa al alcanzar el target', () => {
        const c = createChallenge('streak', 3, Date.now());
        const partial = computeChallengeProgress(c, { stats: { streak: 2 } });
        expect(partial.current).toBe(2);
        expect(partial.done).toBe(false);
        const full = computeChallengeProgress(c, { stats: { streak: 3 } });
        expect(full.done).toBe(true);
        expect(full.pct).toBe(100);
    });

    it('minutes suma solo días dentro de la ventana', () => {
        const start = new Date('2026-07-06T10:00:00');
        const c = createChallenge('minutes', 60, start.getTime());
        const minutesByDay = {
            [new Date('2026-07-05T10:00:00').toDateString()]: 500, // antes del reto
            [new Date('2026-07-07T10:00:00').toDateString()]: 40,
            [new Date('2026-07-08T10:00:00').toDateString()]: 25,
        };
        const p = computeChallengeProgress(c, { stats: { minutesByDay } }, new Date('2026-07-09T10:00:00').getTime());
        expect(p.current).toBe(60); // 65 recortado al target
        expect(p.done).toBe(true);
    });

    it('books cuenta terminados con dateFinished dentro de la ventana', () => {
        const start = Date.now() - 5 * DAY;
        const c = createChallenge('books', 2, start);
        const books = [
            { isFinished: true, dateFinished: start + DAY },
            { isFinished: true, dateFinished: start - DAY },      // antes
            { isFinished: true, dateFinished: null },              // sin fecha
            { isFinished: false, dateFinished: start + 2 * DAY },  // no terminado
        ];
        const p = computeChallengeProgress(c, { books });
        expect(p.current).toBe(1);
        expect(p.done).toBe(false);
    });

    it('marca expirado cuando pasa la deadline sin completar', () => {
        const c = createChallenge('minutes', 60, 0);
        const p = computeChallengeProgress(c, { stats: {} }, 8 * DAY);
        expect(p.expired).toBe(true);
        expect(p.done).toBe(false);
    });

    it('un reto ya completado sigue done aunque baje la racha', () => {
        const c = { ...createChallenge('streak', 5, 0), completedAt: 1000 };
        const p = computeChallengeProgress(c, { stats: { streak: 0 } });
        expect(p.done).toBe(true);
    });
});

describe('settleChallenges', () => {
    it('estampa completedAt y reporta los recién completados', () => {
        const now = Date.now();
        const done = createChallenge('streak', 3, now);
        const pending = createChallenge('streak', 30, now);
        const { next, justCompleted } = settleChallenges([done, pending], { stats: { streak: 3 } }, now);
        expect(justCompleted).toHaveLength(1);
        expect(justCompleted[0].id).toBe(done.id);
        expect(next.find(c => c.id === done.id).completedAt).toBe(now);
        expect(next.find(c => c.id === pending.id).completedAt).toBeNull();
    });

    it('devuelve la misma referencia si no hay cambios', () => {
        const list = [createChallenge('streak', 30, Date.now())];
        const { next } = settleChallenges(list, { stats: { streak: 1 } });
        expect(next).toBe(list);
    });
});

describe('isoWeekKey', () => {
    it('devuelve el lunes de la semana', () => {
        // 2026-07-10 es viernes → lunes 2026-07-06
        expect(isoWeekKey(new Date('2026-07-10T15:00:00'))).toBe('2026-07-06');
        expect(isoWeekKey(new Date('2026-07-06T00:30:00'))).toBe('2026-07-06');
    });
    it('el domingo pertenece a la semana que empezó el lunes anterior', () => {
        expect(isoWeekKey(new Date('2026-07-12T23:00:00'))).toBe('2026-07-06');
    });
});

describe('lastWeekSummary', () => {
    it('suma minutos y días activos de lunes a domingo anteriores', () => {
        const now = new Date('2026-07-10T12:00:00'); // viernes
        const stats = {
            minutesByDay: {
                [new Date('2026-06-30T10:00:00').toDateString()]: 30, // martes semana pasada
                [new Date('2026-07-04T10:00:00').toDateString()]: 45, // sábado semana pasada
                [new Date('2026-07-08T10:00:00').toDateString()]: 60, // esta semana → fuera
            },
        };
        const summary = lastWeekSummary({ stats, books: [] }, now);
        expect(summary.minutes).toBe(75);
        expect(summary.daysActive).toBe(2);
    });

    it('cuenta libros terminados la semana pasada', () => {
        const now = new Date('2026-07-10T12:00:00');
        const books = [
            { isFinished: true, dateFinished: new Date('2026-07-01T20:00:00').getTime() },
            { isFinished: true, dateFinished: new Date('2026-07-09T20:00:00').getTime() }, // esta semana
        ];
        const summary = lastWeekSummary({ stats: {}, books }, now);
        expect(summary.booksFinished).toBe(1);
    });
});
