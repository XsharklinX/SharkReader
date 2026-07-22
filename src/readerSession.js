// src/readerSession.js
// Persistencia de la "sesión del lector": qué tabs hay abiertas, cuál está
// activa, el split view (panel derecho) y los saltos a CFI pendientes por tab.
//
// RECONSTRUIDO tras pérdida del archivo. La forma canónica de la sesión es la
// que consume useReaderOrchestration / useAppHydration:
//   { tabs: [{ id, bookId, startMinutes, startProgress }],
//     activeTabId: string|null,
//     tabTargetCfi: { [tabId]: cfi },
//     panelMode: boolean,
//     rightTabId: string|null }

// Una tab válida necesita al menos id + bookId; el resto se normaliza a número.
function normalizeTab(tab) {
    if (!tab || typeof tab !== 'object') return null;
    const id = tab.id != null ? String(tab.id) : null;
    const bookId = tab.bookId != null ? String(tab.bookId) : null;
    if (!id || !bookId) return null;
    const startMinutes = Number(tab.startMinutes);
    const startProgress = Number(tab.startProgress);
    return {
        id,
        bookId,
        startMinutes: Number.isFinite(startMinutes) ? startMinutes : 0,
        startProgress: Number.isFinite(startProgress) ? startProgress : 0,
    };
}

// Lee una sesión almacenada (posiblemente parcial o corrupta) y devuelve
// siempre un objeto completo y coherente (no lanza).
export function normalizeReaderSession(stored) {
    if (!stored || typeof stored !== 'object') {
        return { tabs: [], activeTabId: null, tabTargetCfi: {}, panelMode: false, rightTabId: null };
    }

    const tabs = Array.isArray(stored.tabs)
        ? stored.tabs.map(normalizeTab).filter(Boolean)
        : [];

    const tabIds = new Set(tabs.map(t => t.id));

    // activeTabId sólo es válido si apunta a una tab existente.
    let activeTabId = stored.activeTabId != null ? String(stored.activeTabId) : null;
    if (activeTabId && !tabIds.has(activeTabId)) activeTabId = null;
    if (!activeTabId && tabs.length) activeTabId = tabs[0].id;

    // tabTargetCfi: sólo entradas de tabs vivas, con cfi no vacío.
    const tabTargetCfi = {};
    if (stored.tabTargetCfi && typeof stored.tabTargetCfi === 'object') {
        for (const [tabId, cfi] of Object.entries(stored.tabTargetCfi)) {
            if (tabIds.has(String(tabId)) && cfi != null && cfi !== '') {
                tabTargetCfi[String(tabId)] = cfi;
            }
        }
    }

    // rightTabId (split view) sólo válido si apunta a una tab existente.
    let rightTabId = stored.rightTabId != null ? String(stored.rightTabId) : null;
    if (rightTabId && !tabIds.has(rightTabId)) rightTabId = null;

    const panelMode = Boolean(stored.panelMode) && rightTabId != null;

    return { tabs, activeTabId, tabTargetCfi, panelMode, rightTabId };
}

// Construye el snapshot serializable que se persiste. Reutiliza la
// normalización para no guardar basura (tabs sin libro, CFIs huérfanos, etc.).
export function buildReaderSessionSnapshot({ tabs, activeTabId, tabTargetCfi, panelMode, rightTabId } = {}) {
    return normalizeReaderSession({ tabs, activeTabId, tabTargetCfi, panelMode, rightTabId });
}

export default { normalizeReaderSession, buildReaderSessionSnapshot };
