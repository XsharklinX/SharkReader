// Etiquetas personalizables de los colores de subrayado.
// Fuente única para EpubReader, Sidebar y exportadores; el usuario puede
// renombrarlas (p. ej. amarillo: "Importante" → "A investigar").
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'sr_highlight_labels';
const CHANGE_EVENT = 'sr-highlight-labels-changed';

export const HIGHLIGHT_LABEL_DEFAULTS = {
    yellow: 'Importante',
    green: 'Idea',
    blue: 'Duda',
    pink: 'Cita',
};

export const HIGHLIGHT_SWATCHES = {
    yellow: '#facc15',
    green: '#22c55e',
    blue: '#3b82f6',
    pink: '#f472b6',
};

let cache = null;

function readLabels() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const merged = { ...HIGHLIGHT_LABEL_DEFAULTS };
        Object.keys(HIGHLIGHT_LABEL_DEFAULTS).forEach(color => {
            const value = typeof raw[color] === 'string' ? raw[color].trim() : '';
            if (value) merged[color] = value.slice(0, 24);
        });
        return merged;
    } catch {
        return { ...HIGHLIGHT_LABEL_DEFAULTS };
    }
}

export function getHighlightLabels() {
    if (!cache) cache = readLabels();
    return cache;
}

export function setHighlightLabel(color, label) {
    if (!(color in HIGHLIGHT_LABEL_DEFAULTS)) return;
    const next = { ...getHighlightLabels(), [color]: (label || '').trim().slice(0, 24) || HIGHLIGHT_LABEL_DEFAULTS[color] };
    cache = next;
    try {
        const overrides = {};
        Object.keys(HIGHLIGHT_LABEL_DEFAULTS).forEach(key => {
            if (next[key] !== HIGHLIGHT_LABEL_DEFAULTS[key]) overrides[key] = next[key];
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch (_) {}
    try { window.dispatchEvent(new Event(CHANGE_EVENT)); } catch (_) {}
}

function subscribe(callback) {
    window.addEventListener(CHANGE_EVENT, callback);
    return () => window.removeEventListener(CHANGE_EVENT, callback);
}

// Hook: re-renderiza al cambiar las etiquetas desde cualquier componente.
export function useHighlightLabels() {
    return useSyncExternalStore(subscribe, getHighlightLabels, getHighlightLabels);
}
