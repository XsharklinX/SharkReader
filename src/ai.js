// Capa de acceso a proveedores de IA — aislada de App.jsx y de SharkyContext
// para que la configuración/llamadas de IA no vivan mezcladas dentro de un
// componente gigante. No depende de React ni de estado de la app: recibe
// provider/apiKey/prompt y devuelve texto o lanza un Error con mensaje claro.

// Metadata para poblar selects sin duplicar la lista en cada sitio que la
// necesita (SettingsPanel, SharkyWidget, etc.).
export const AI_PROVIDERS = [
    { id: 'groq', label: 'Groq - Llama 3', keyPlaceholder: 'gsk_...' },
    { id: 'openrouter', label: 'OpenRouter - Llama / Mistral', keyPlaceholder: 'sk-or-v1-...' },
    { id: 'gemini', label: 'Google Gemini', keyPlaceholder: 'AIza...' },
    { id: 'xai', label: 'xAI Grok', keyPlaceholder: 'xai-...' },
];

const OAI_CONFIG = {
    xai:        { url: 'https://api.x.ai/v1/chat/completions',             model: 'grok-3-mini' },
    openai:     { url: 'https://api.openai.com/v1/chat/completions',        model: 'gpt-4o-mini' },
    openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions',     model: 'meta-llama/llama-3.1-8b-instruct:free' },
    mistral:    { url: 'https://api.mistral.ai/v1/chat/completions',        model: 'mistral-small-latest' },
    groq:       { url: 'https://api.groq.com/openai/v1/chat/completions',   model: 'llama-3.3-70b-versatile' },
};

export async function fetchAIMessage({ provider, apiKey, prompt, history, maxTokens = 120 }) {
    if (!apiKey || !apiKey.trim()) {
        throw new Error('Falta la API key. Añádela en Ajustes > Avanzado (o en la configuración de Sharky).');
    }
    if (provider === 'gemini') {
        const contents = [];
        if (history && history.length > 0) {
            history.forEach(m => {
                contents.push({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] });
            });
        }
        contents.push({ role: 'user', parts: [{ text: prompt }] });
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            if (res.status === 429) throw new Error('Límite de velocidad alcanzado (Gemini). Espera unos segundos.');
            if (res.status === 401 || res.status === 403) throw new Error('API key de Gemini inválida o sin permisos.');
            throw new Error(`Gemini ${res.status}: ${body?.error?.message || res.statusText}`);
        }
        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    }
    // Proveedores compatibles con la API de OpenAI (xAI, OpenAI, OpenRouter, Mistral, Groq)
    if (OAI_CONFIG[provider]) {
        const { url, model } = OAI_CONFIG[provider];
        const messages = [];
        if (history?.length > 0) {
            history.forEach(m => messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
        }
        messages.push({ role: 'user', content: prompt });
        const extraHeaders = provider === 'openrouter'
            ? { 'HTTP-Referer': 'https://sharkreader.app', 'X-Title': 'SharkReader' }
            : {};
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...extraHeaders },
            body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            if (res.status === 429) throw new Error(`Límite de velocidad alcanzado (${provider}). Espera unos segundos.`);
            if (res.status === 401) throw new Error(`API key inválida (${provider})`);
            if (res.status === 403) throw new Error(`Sin permisos (${provider})`);
            throw new Error(`${provider} ${res.status}: ${body?.error?.message || res.statusText}`);
        }
        const data = await res.json();
        return data?.choices?.[0]?.message?.content?.trim() || null;
    }
    // Proveedor no reconocido: mejor un error explícito que un `null` que el
    // resto del código interpreta como "sin respuesta" y descarta en silencio.
    throw new Error(provider ? `Proveedor de IA no reconocido: "${provider}"` : 'No hay proveedor de IA configurado.');
}

// Ping mínimo para "Probar conexión" — no depende de contexto de lectura ni
// de Sharky, solo confirma que provider+key funcionan.
export async function testAIConnection(provider, apiKey) {
    const text = await fetchAIMessage({
        provider,
        apiKey,
        prompt: 'Responde solo con la palabra: OK',
        maxTokens: 10,
    });
    return text || '(sin contenido)';
}
