import { useCallback, useRef, useState } from 'react';
import { testAIConnection } from '../ai';

// Aísla la configuración global de IA (proveedor + API key) y la prueba de
// conexión fuera de App.jsx — antes eran dos useState sueltos en el
// componente gigante, sin ninguna forma de validar la clave salvo dentro del
// panel de configuración de Sharky. El hook devuelve los mismos nombres de
// setter que ya esperan useAppHydration/useAppPersistence, así que aislar el
// estado aquí no cambia cómo se hidrata/persiste.
export function useAIConfig() {
    const [aiProvider, setAiProvider] = useState('groq');
    const [aiApiKey, setAiApiKey] = useState('');
    // idle | testing | ok | error
    const [aiTestStatus, setAiTestStatus] = useState('idle');
    const [aiTestMessage, setAiTestMessage] = useState('');
    const testRunIdRef = useRef(0);

    const testConnection = useCallback(async () => {
        const runId = ++testRunIdRef.current;
        if (!aiApiKey.trim()) {
            setAiTestStatus('error');
            setAiTestMessage('Falta la API key.');
            return;
        }
        setAiTestStatus('testing');
        setAiTestMessage('');
        try {
            await testAIConnection(aiProvider, aiApiKey);
            if (testRunIdRef.current !== runId) return; // una prueba más nueva ya la reemplazó
            setAiTestStatus('ok');
            setAiTestMessage(`Conectado con ${aiProvider}.`);
        } catch (err) {
            if (testRunIdRef.current !== runId) return;
            setAiTestStatus('error');
            setAiTestMessage(err?.message || 'Error desconocido al conectar.');
        }
    }, [aiProvider, aiApiKey]);

    const resetTestStatus = useCallback(() => {
        setAiTestStatus('idle');
        setAiTestMessage('');
    }, []);

    return {
        aiProvider, setAiProvider,
        aiApiKey, setAiApiKey,
        aiTestStatus, aiTestMessage,
        testAIConnection: testConnection,
        resetAITestStatus: resetTestStatus,
    };
}
