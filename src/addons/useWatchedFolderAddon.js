import { useEffect, useRef } from 'react';

// Vigila una carpeta local y dispara una importación periódica cuando el
// addon está activo y hay una carpeta configurada.
// `timerRef` es opcional: si App.jsx necesita poder cancelar el timer desde
// otro flujo (p. ej. al borrar la cuenta), puede pasar su propio ref.
export function useWatchedFolderAddon({ enabled, config, api, folderImport, beginFolderImportSession, timerRef: externalTimerRef }) {
    const ownTimerRef = useRef(null);
    const timerRef = externalTimerRef || ownTimerRef;
    const lastRunRef = useRef(0);

    useEffect(() => {
        clearInterval(timerRef.current);
        const folder = config?.folder;
        if (!enabled || !folder || !api.storage.canImportFolder()) return;

        const runScan = async () => {
            if (folderImport || Date.now() - lastRunRef.current < 60000) return;
            lastRunRef.current = Date.now();
            try {
                const session = await api.storage.startFolderImportPath(folder);
                if (session?.sessionId) {
                    beginFolderImportSession(session, 'Carpeta vigilada');
                    api.notifications.notify('Carpeta vigilada: escaneo iniciado.', 'info');
                }
            } catch (error) {
                console.warn('[SharkReader] Error escaneando carpeta vigilada:', error);
            }
        };

        const intervalMs = Math.max(5, config?.intervalMinutes || 30) * 60000;
        timerRef.current = setInterval(runScan, intervalMs);
        return () => clearInterval(timerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, config?.folder, config?.intervalMinutes, api, folderImport, beginFolderImportSession]);
}
