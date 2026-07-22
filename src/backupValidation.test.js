import { describe, expect, it } from 'vitest';
import { validateBackupData, BACKUP_SCHEMA_VERSION } from './backupValidation';

describe('validateBackupData', () => {
    it('normaliza un backup mínimo válido', () => {
        const { backup, warnings } = validateBackupData({ app: 'SharkReader', books: [] });
        expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
        expect(Array.isArray(backup.books)).toBe(true);
        expect(Array.isArray(warnings)).toBe(true);
    });

    it('rechaza objetos que no son backups', () => {
        expect(() => validateBackupData(null)).toThrow();
        expect(() => validateBackupData({ app: 'OtraApp' })).toThrow();
    });

    it('omite libros inválidos y lo avisa', () => {
        const { backup, warnings } = validateBackupData({
            app: 'SharkReader',
            books: [{ id: 'ok', originalTitle: 'T' }, { noId: true }, null],
        });
        expect(backup.books).toHaveLength(1);
        expect(warnings.some(w => /inválido/i.test(w))).toBe(true);
    });
});
