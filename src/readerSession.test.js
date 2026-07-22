import { describe, expect, it } from 'vitest';
import { normalizeReaderSession, buildReaderSessionSnapshot } from './readerSession';

const tab = (over = {}) => ({ id: 't1', bookId: 'b1', startMinutes: 5, startProgress: 10, ...over });

describe('normalizeReaderSession', () => {
    it('devuelve una sesión vacía coherente ante entradas basura', () => {
        for (const input of [null, undefined, 42, 'x', {}]) {
            const s = normalizeReaderSession(input);
            expect(s).toEqual({ tabs: [], activeTabId: null, tabTargetCfi: {}, panelMode: false, rightTabId: null });
        }
    });

    it('descarta tabs sin id o sin bookId', () => {
        const s = normalizeReaderSession({ tabs: [tab(), { id: 'x' }, { bookId: 'y' }, null] });
        expect(s.tabs).toHaveLength(1);
        expect(s.tabs[0]).toMatchObject({ id: 't1', bookId: 'b1', startMinutes: 5, startProgress: 10 });
    });

    it('corrige activeTabId huérfano al primero disponible', () => {
        const s = normalizeReaderSession({ tabs: [tab()], activeTabId: 'no-existe' });
        expect(s.activeTabId).toBe('t1');
    });

    it('elimina CFIs y rightTabId que no apunten a una tab viva', () => {
        const s = normalizeReaderSession({
            tabs: [tab()],
            tabTargetCfi: { t1: 'epubcfi(/6/4)', fantasma: 'x' },
            rightTabId: 'fantasma',
            panelMode: true,
        });
        expect(s.tabTargetCfi).toEqual({ t1: 'epubcfi(/6/4)' });
        expect(s.rightTabId).toBeNull();
        expect(s.panelMode).toBe(false);
    });

    it('mantiene el split view cuando rightTabId es válido', () => {
        const s = normalizeReaderSession({
            tabs: [tab(), tab({ id: 't2', bookId: 'b2' })],
            activeTabId: 't1', rightTabId: 't2', panelMode: true,
        });
        expect(s.rightTabId).toBe('t2');
        expect(s.panelMode).toBe(true);
    });
});

describe('buildReaderSessionSnapshot', () => {
    it('es idempotente respecto a normalize (round-trip)', () => {
        const input = { tabs: [tab()], activeTabId: 't1', tabTargetCfi: { t1: 'c' }, panelMode: false, rightTabId: null };
        const snap = buildReaderSessionSnapshot(input);
        expect(normalizeReaderSession(snap)).toEqual(snap);
    });

    it('no lanza sin argumentos', () => {
        expect(() => buildReaderSessionSnapshot()).not.toThrow();
    });
});
