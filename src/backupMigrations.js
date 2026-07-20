// Registro explícito de migraciones entre versiones de esquema de backup —
// ver docs/DATA_MODEL.md para la tabla de versiones. Cada migración
// transforma el backup de la versión N a N+1; se aplican en cadena hasta
// llegar a BACKUP_SCHEMA_VERSION, así que un backup viejo (o de una versión
// futura de otro dispositivo aún no actualizado) sigue restaurando sin
// requerir lógica especial fuera de este archivo.
import { BACKUP_SCHEMA_VERSION } from './backupValidation';

// v1 → v2: se añadieron tombstones de borrado (`deletedBooks`) y
// `annotationsUpdatedAt` por libro. Ambos son opcionales/derivables, así
// que un backup v1 ya era compatible — esta migración solo deja constancia
// explícita del salto de versión.
function migrateV1toV2(backup) {
    return { ...backup, schemaVersion: 2 };
}

// v2 → v3: se consolidó `updatedAt` por libro como el máximo de los tres
// timestamps de campo (progreso/metadata/anotaciones). También derivable
// desde los campos existentes, sin transformación necesaria.
function migrateV2toV3(backup) {
    return { ...backup, schemaVersion: 3 };
}

// v3 → v4: añade `achievements` (historial de logros con fecha de
// desbloqueo) y `settingsUpdatedAt` (para fusionar Workshop/ajustes por
// fecha en vez de que gane siempre el lado que llega después). Ambos son
// opcionales — validateBackupData ya trata su ausencia como "sin datos de
// ese tipo", así que no hace falta (ni conviene) inyectar un valor por
// defecto aquí: un objeto sin relación con SharkReader no debe empezar a
// parecer un backup válido solo por pasar por esta migración.
function migrateV3toV4(backup) {
    return { ...backup, schemaVersion: 4 };
}

const MIGRATIONS = {
    1: migrateV1toV2,
    2: migrateV2toV3,
    3: migrateV3toV4,
};

// Aplica todas las migraciones necesarias hasta BACKUP_SCHEMA_VERSION.
// No lanza si ya está al día o si viene de una versión futura (eso lo
// rechaza validateBackupData por separado, con un mensaje claro).
export function migrateBackupToLatest(backup) {
    if (!backup || typeof backup !== 'object') return backup;
    let current = backup;
    let version = Math.max(1, Math.floor(Number(current.schemaVersion) || 1));
    let guard = 0;
    while (version < BACKUP_SCHEMA_VERSION && MIGRATIONS[version] && guard < 50) {
        current = MIGRATIONS[version](current);
        version = current.schemaVersion;
        guard += 1;
    }
    return current;
}
