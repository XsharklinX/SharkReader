import { describe, expect, it } from 'vitest';
import { migrateBackupToLatest } from './backupMigrations';
import { BACKUP_SCHEMA_VERSION } from './backupValidation';

describe('migrateBackupToLatest', () => {
    it('sube un backup v1 hasta la versión actual', () => {
        const migrated = migrateBackupToLatest({ app: 'SharkReader', schemaVersion: 1, books: [] });
        expect(migrated.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    });

    it('trata la ausencia de schemaVersion como v1', () => {
        const migrated = migrateBackupToLatest({ app: 'SharkReader', books: [] });
        expect(migrated.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    });

    it('no toca un backup que ya está al día', () => {
        const input = { app: 'SharkReader', schemaVersion: BACKUP_SCHEMA_VERSION, books: [] };
        expect(migrateBackupToLatest(input)).toEqual(input);
    });

    it('conserva los campos existentes al migrar', () => {
        const migrated = migrateBackupToLatest({
            app: 'SharkReader',
            schemaVersion: 1,
            books: [{ id: 'a' }],
            stats: { streak: 5 },
        });
        expect(migrated.books).toEqual([{ id: 'a' }]);
        expect(migrated.stats).toEqual({ streak: 5 });
    });

    it('no lanza ni añade campos falsos para un objeto no relacionado', () => {
        const migrated = migrateBackupToLatest({ hello: 'world' });
        expect(migrated.achievements).toBeUndefined();
        expect(migrated.settingsUpdatedAt).toBeUndefined();
    });

    it('no lanza con entradas no-objeto', () => {
        expect(migrateBackupToLatest(null)).toBeNull();
        expect(migrateBackupToLatest(undefined)).toBeUndefined();
        expect(migrateBackupToLatest('x')).toBe('x');
    });

    it('no entra en bucle infinito con un schemaVersion futuro', () => {
        const input = { app: 'SharkReader', schemaVersion: BACKUP_SCHEMA_VERSION + 5, books: [] };
        expect(() => migrateBackupToLatest(input)).not.toThrow();
        expect(migrateBackupToLatest(input).schemaVersion).toBe(BACKUP_SCHEMA_VERSION + 5);
    });
});
