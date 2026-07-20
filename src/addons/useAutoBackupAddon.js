import { useEffect } from 'react';

// Escribe un backup periódico en una carpeta local cuando el addon está
// activo y ha pasado el intervalo configurado desde el último backup.
export function useAutoBackupAddon({ enabled, config, api, ready, buildBackup, updateConfig }) {
    useEffect(() => {
        const folder = config?.folder;
        if (!enabled || !folder || !api.storage.canWriteSyncFile() || !ready) return;
        const everyMs = Math.max(1, config?.everyDays || 7) * 86400000;
        const lastBackupAt = Number(config?.lastBackupAt || 0);
        if (Date.now() - lastBackupAt < everyMs) return;

        const backup = buildBackup();
        api.storage.writeSyncFile(folder, JSON.stringify(backup, null, 2))
            .then(() => {
                updateConfig({ lastBackupAt: Date.now() });
                api.notifications.notify('Backup automático guardado.', 'info');
            })
            .catch(() => api.notifications.notify('No se pudo guardar el backup automático.', 'warning'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, config, api, ready, buildBackup, updateConfig]);
}
