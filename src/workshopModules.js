export const WORKSHOP_SCHEMA_VERSION = 1;

export const WORKSHOP_ADDONS = [
    {
        id: 'focusMode',
        emoji: '🎯',
        name: 'Modo Focus',
        desc: 'La barra desaparece tras 2.5s de inactividad. Acerca el raton al borde superior para recuperarla.',
        category: 'Lectura',
        context: 'reader',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { idleMs: 2500 },
    },
    {
        id: 'autoBookmark',
        emoji: '📌',
        name: 'Marcador Automatico',
        desc: 'Guarda automaticamente tu posicion como marcador cada vez que cierras un libro.',
        category: 'Lectura',
        context: 'reader',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { onClose: true },
    },
    {
        id: 'netflixView',
        emoji: '🎬',
        name: 'Vista Netflix',
        desc: 'Portadas mas grandes en la biblioteca. Hover para ver info rapida del libro.',
        category: 'Interfaz',
        context: 'library',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { largeCovers: true },
    },
    {
        id: 'readingJournal',
        emoji: '📓',
        name: 'Reading Journal',
        desc: 'Registra automaticamente cada sesion: fecha, libro y progreso. Accede desde el menu lateral.',
        category: 'Estadisticas',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { maxEntries: 100 },
    },
    {
        id: 'reminders',
        emoji: '⏰',
        name: 'Recordatorio Diario',
        desc: 'Muestra una notificacion para recordarte leer cuando llevas mas de 1h sin abrir la app.',
        category: 'Productividad',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { minHoursSinceLastOpen: 1 },
    },
    {
        id: 'smartToc',
        emoji: '🗺️',
        name: 'TOC Flotante',
        desc: 'Tabla de contenidos flotante con indicador de posicion actual mientras lees.',
        category: 'Navegacion',
        context: 'reader',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { showProgress: true },
    },
    {
        id: 'externalSources',
        emoji: '🌐',
        name: 'Fuentes externas seguras',
        desc: 'Prepara conexiones OPDS, Calibre server, nube personal y bibliotecas publicas sin distribuir contenido dentro de la app.',
        category: 'Integraciones',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { allowPublicDomainOnly: true },
    },
];

export const WORKSHOP_CATEGORIES = ['Todos', 'Lectura', 'Accesibilidad', 'Interfaz', 'Estadisticas', 'Productividad', 'Navegacion', 'Integraciones'];

export const WORKSHOP_MODULES_BY_ID = new Map(WORKSHOP_ADDONS.map(addon => [addon.id, addon]));

export const DEFAULT_EXTERNAL_SOURCES = [
    {
        id: 'standard-ebooks',
        type: 'opds',
        name: 'Standard Ebooks',
        url: 'https://standardebooks.org/feeds/opds',
        enabled: false,
        publicDomainOnly: true,
        allowPrivateNetwork: false,
    },
    {
        id: 'calibre-local',
        type: 'calibre',
        name: 'Calibre local',
        url: 'http://localhost:8080/opds',
        enabled: false,
        publicDomainOnly: false,
        allowPrivateNetwork: true,
    },
];

const normalizeExternalSource = (source = {}) => ({
    id: source.id || `source-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: source.type || 'opds',
    name: source.name || 'Fuente externa',
    url: source.url || '',
    enabled: !!source.enabled,
    publicDomainOnly: source.publicDomainOnly !== false,
    allowPrivateNetwork: !!source.allowPrivateNetwork || source.type === 'calibre',
});

export const normalizeAddonState = (stored = {}) => {
    const normalized = {};
    for (const addon of WORKSHOP_ADDONS) {
        normalized[addon.id] = Boolean(stored?.[addon.id] ?? addon.defaultEnabled);
    }
    return normalized;
};

export const normalizeAddonConfig = (stored = {}) => {
    const normalized = {};
    for (const addon of WORKSHOP_ADDONS) {
        normalized[addon.id] = {
            ...(addon.defaultConfig || {}),
            ...(stored?.[addon.id] || {}),
        };
    }
    return normalized;
};

export const validateAddonToggle = (addonId, nextEnabled, context = {}) => {
    const addon = WORKSHOP_MODULES_BY_ID.get(addonId);
    if (!addon) return { ok: false, reason: 'Addon desconocido' };
    if (addon.status !== 'active') return { ok: false, reason: 'Addon no disponible' };
    if (addon.requiresProfile && !context.userProfile) return { ok: false, reason: 'Necesitas iniciar sesion' };
    return { ok: true, enabled: Boolean(nextEnabled) };
};

export const migrateWorkshopData = ({ addons = {}, addonConfig = {}, externalSources = [] } = {}) => ({
    schemaVersion: WORKSHOP_SCHEMA_VERSION,
    addons: normalizeAddonState(addons),
    addonConfig: normalizeAddonConfig(addonConfig),
    externalSources: (Array.isArray(externalSources) && externalSources.length ? externalSources : DEFAULT_EXTERNAL_SOURCES).map(normalizeExternalSource),
});
