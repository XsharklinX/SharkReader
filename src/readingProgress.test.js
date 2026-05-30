import { describe, it, expect } from 'vitest';
import { applyReadingMinute, readerXp, readerLevelFromXp } from './readingProgress';

const day = (s) => new Date(s + 'T12:00:00');

describe('applyReadingMinute — contadores básicos', () => {
    it('incrementa timeRead y minutesByDay/hourlyLog del día', () => {
        const now = day('2026-05-10');
        const { next } = applyReadingMinute({ timeRead: 4 }, now);
        expect(next.timeRead).toBe(5);
        expect(next.minutesByDay[now.toDateString()]).toBe(1);
        expect(next.hourlyLog[now.getHours()]).toBe(1);
    });

    it('reinicia currentDailyMins a 1 en un día nuevo', () => {
        const prev = { currentDailyMins: 20, lastActiveDate: day('2026-05-09').toDateString() };
        const { next } = applyReadingMinute(prev, day('2026-05-10'));
        expect(next.currentDailyMins).toBe(1);
        expect(next.lastActiveDate).toBe(day('2026-05-10').toDateString());
    });

    it('acumula currentDailyMins dentro del mismo día', () => {
        const today = day('2026-05-10');
        const prev = { currentDailyMins: 2, lastActiveDate: today.toDateString() };
        const { next } = applyReadingMinute(prev, today);
        expect(next.currentDailyMins).toBe(3);
    });

    it('no muta el history del estado previo', () => {
        const prevHistory = {};
        const prev = { currentDailyMins: 4, lastActiveDate: day('2026-05-10').toDateString(), history: prevHistory };
        applyReadingMinute(prev, day('2026-05-10'));
        expect(prevHistory).toEqual({}); // el original no se tocó
    });
});

describe('applyReadingMinute — rachas', () => {
    // Helper: simula llegar al minuto 5 del día (umbral que evalúa racha)
    const atFifthMinute = (extra, now) =>
        applyReadingMinute({ currentDailyMins: 4, lastActiveDate: now.toDateString(), ...extra }, now);

    it('primer día de lectura: racha = 1', () => {
        const { next, newStreak } = atFifthMinute({ history: {} }, day('2026-05-10'));
        expect(next.streak).toBe(1);
        expect(newStreak).toBe(1);
        expect(next.history[day('2026-05-10').toDateString()]).toBe('read');
    });

    it('día consecutivo: racha +1', () => {
        const prev = { history: { [day('2026-05-09').toDateString()]: 'read' }, streak: 3 };
        const { next, newStreak } = atFifthMinute(prev, day('2026-05-10'));
        expect(next.streak).toBe(4);
        expect(newStreak).toBe(4);
    });

    it('hueco de 1 día sin savers: racha se reinicia a 1', () => {
        const prev = { history: { [day('2026-05-08').toDateString()]: 'read' }, streak: 2, streakSavers: 0 };
        const { next, lostStreak } = atFifthMinute(prev, day('2026-05-10'));
        expect(next.streak).toBe(1);
        expect(lostStreak).toBeNull(); // racha perdida era <= 3, no se notifica
    });

    it('racha perdida > 3 reporta lostStreak', () => {
        const prev = { history: { [day('2026-05-08').toDateString()]: 'read' }, streak: 7, streakSavers: 0 };
        const { next, lostStreak } = atFifthMinute(prev, day('2026-05-10'));
        expect(next.streak).toBe(1);
        expect(lostStreak).toBe(7);
    });

    it('un saver cubre un hueco de 1 día y mantiene la racha', () => {
        const prev = { history: { [day('2026-05-08').toDateString()]: 'read' }, streak: 5, streakSavers: 1 };
        const { next } = atFifthMinute(prev, day('2026-05-10'));
        expect(next.streak).toBe(6);
        expect(next.streakSavers).toBe(0); // se consumió el saver
        expect(next.history[day('2026-05-09').toDateString()]).toBe('saved'); // día cubierto
    });

    it('gana un saver al llegar a múltiplo de 5', () => {
        const prev = { history: { [day('2026-05-09').toDateString()]: 'read' }, streak: 4, streakSavers: 0 };
        const { next } = atFifthMinute(prev, day('2026-05-10'));
        expect(next.streak).toBe(5);
        expect(next.streakSavers).toBe(1);
    });

    it('savers tope en 2', () => {
        const prev = { history: { [day('2026-05-09').toDateString()]: 'read' }, streak: 9, streakSavers: 2 };
        const { next } = atFifthMinute(prev, day('2026-05-10'));
        expect(next.streak).toBe(10);
        expect(next.streakSavers).toBe(2);
    });

    it('no evalúa racha antes del minuto 5', () => {
        const prev = { currentDailyMins: 2, lastActiveDate: day('2026-05-10').toDateString(), history: {}, streak: 0 };
        const { next, newStreak } = applyReadingMinute(prev, day('2026-05-10'));
        expect(next.streak).toBe(0);
        expect(newStreak).toBeNull();
    });

    it('maxStreak nunca disminuye', () => {
        const prev = { history: { [day('2026-05-08').toDateString()]: 'read' }, streak: 8, streakSavers: 0, maxStreak: 8 };
        const { next } = atFifthMinute(prev, day('2026-05-10')); // pierde racha → streak=1
        expect(next.streak).toBe(1);
        expect(next.maxStreak).toBe(8); // máximo histórico se conserva
    });
});

describe('readerXp', () => {
    it('suma minutos*2 + libros*80 + bookmarks*8 + notas*20', () => {
        expect(readerXp({ minutesRead: 10, booksFinished: 1, bookmarks: 2, notedBooks: 1 }))
            .toBe(20 + 80 + 16 + 20);
    });
    it('vacío = 0', () => {
        expect(readerXp()).toBe(0);
    });
    it('no permite XP negativo por minutos', () => {
        expect(readerXp({ minutesRead: -100 })).toBe(0);
    });
});

describe('readerLevelFromXp', () => {
    it('nivel 1 con 0 XP', () => {
        const r = readerLevelFromXp(0, 100);
        expect(r.level).toBe(1);
        expect(r.current).toBe(0);
        expect(r.progress).toBe(0);
    });
    it('250 XP con 100/nivel → nivel 3, 50 en curso, 50%', () => {
        const r = readerLevelFromXp(250, 100);
        expect(r.level).toBe(3);
        expect(r.current).toBe(50);
        expect(r.progress).toBe(50);
    });
    it('respeta xpPerLevel custom', () => {
        const r = readerLevelFromXp(500, 250);
        expect(r.level).toBe(3);
        expect(r.current).toBe(0);
    });
    it('xpPerLevel inválido cae a 100', () => {
        const r = readerLevelFromXp(150, 0);
        expect(r.xpPerLevel).toBe(100);
        expect(r.level).toBe(2);
    });
});
