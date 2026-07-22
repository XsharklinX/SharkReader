import { describe, expect, it } from 'vitest';
import { getActiveSeasonalEvent, getAppAnniversaryEvent } from './seasonalEvents';

describe('getActiveSeasonalEvent', () => {
    it('devuelve el evento del Día del Libro el 23 de abril', () => {
        const event = getActiveSeasonalEvent(new Date(2026, 3, 23), 'es');
        expect(event?.id).toBe('bookday');
        expect(event.message).toContain('📖');
    });

    it('devuelve null en un día sin evento', () => {
        expect(getActiveSeasonalEvent(new Date(2026, 2, 15))).toBeNull();
    });

    it('respeta el idioma', () => {
        expect(getActiveSeasonalEvent(new Date(2026, 0, 1), 'en').message).toMatch(/reading year/i);
    });
});

describe('getAppAnniversaryEvent', () => {
    it('marca el aniversario en la misma fecha, un año después', () => {
        const joined = new Date(2024, 5, 10).getTime();
        const now = new Date(2026, 5, 10).getTime();
        const event = getAppAnniversaryEvent(joined, now, 'es');
        expect(event?.years).toBe(2);
    });

    it('no dispara antes de cumplir un año', () => {
        const joined = new Date(2026, 5, 10).getTime();
        const now = new Date(2026, 5, 10, 12).getTime();
        expect(getAppAnniversaryEvent(joined, now)).toBeNull();
    });

    it('devuelve null sin fecha de alta', () => {
        expect(getAppAnniversaryEvent(null)).toBeNull();
    });
});
