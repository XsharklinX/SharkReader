export const WORKSHOP_SCHEMA_VERSION = 1;

const addonText = (es, en) => ({ es, en });

export const WORKSHOP_ADDONS = [
    {
        id: 'focusMode',
        emoji: '🎯',
        name: addonText('Modo Focus', 'Focus Mode'),
        desc: addonText(
            'La barra desaparece tras 2.5s de inactividad. Acerca el ratón al borde superior para recuperarla.',
            'The toolbar hides after 2.5s of inactivity. Move the mouse to the top edge to bring it back.'
        ),
        category: 'reading',
        context: 'reader',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { idleMs: 2500 },
    },
    {
        id: 'autoBookmark',
        emoji: '📌',
        name: addonText('Marcador Automático', 'Auto Bookmark'),
        desc: addonText(
            'Guarda automáticamente tu posición como marcador cada vez que cierras un libro.',
            'Automatically saves your position as a bookmark whenever you close a book.'
        ),
        category: 'reading',
        context: 'reader',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { onClose: true },
    },
    {
        id: 'netflixView',
        emoji: '🎬',
        name: addonText('Vista Netflix', 'Netflix View'),
        desc: addonText(
            'Portadas más grandes en la biblioteca. Hover para ver información rápida del libro.',
            'Larger covers in the library. Hover to see quick book information.'
        ),
        category: 'interface',
        context: 'library',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { largeCovers: true },
    },
    {
        id: 'readingJournal',
        emoji: '📓',
        name: addonText('Diario de Lectura', 'Reading Journal'),
        desc: addonText(
            'Registra automáticamente cada sesión: fecha, libro y progreso. Accede desde el menú lateral.',
            'Automatically logs each session: date, book and progress. Open it from the side menu.'
        ),
        category: 'stats',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { maxEntries: 100 },
    },
    {
        id: 'reminders',
        emoji: '⏰',
        name: addonText('Recordatorio Diario', 'Daily Reminder'),
        desc: addonText(
            'Muestra una notificación para recordarte leer cuando llevas más de 1h sin abrir la app.',
            'Shows a notification reminding you to read when you have not opened the app for more than 1 hour.'
        ),
        category: 'productivity',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { minHoursSinceLastOpen: 1 },
    },
    {
        id: 'smartToc',
        emoji: '🗺️',
        name: addonText('Índice Flotante', 'Floating TOC'),
        desc: addonText(
            'Tabla de contenidos flotante con indicador de posición actual mientras lees.',
            'Floating table of contents with a current-position indicator while reading.'
        ),
        category: 'navigation',
        context: 'reader',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { showProgress: true },
    },
    {
        id: 'externalSources',
        emoji: '🌐',
        name: addonText('Fuentes externas seguras', 'Safe External Sources'),
        desc: addonText(
            'Prepara conexiones OPDS, Calibre server, nube personal y bibliotecas públicas sin distribuir contenido dentro de la app.',
            'Prepare OPDS, Calibre server, personal cloud and public-domain library connections without distributing content inside the app.'
        ),
        category: 'integrations',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { allowPublicDomainOnly: true },
    },
    {
        id: 'dyslexiaMode',
        emoji: '🔤',
        name: addonText('Modo Dislexia', 'Dyslexia Mode'),
        desc: addonText(
            'Aplica fuente legible, más espaciado y contraste optimizado en la interfaz.',
            'Applies a readable font, more spacing and optimized contrast across the interface.'
        ),
        category: 'accessibility',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { strongerContrast: true },
    },
    {
        id: 'removedShelf',
        emoji: '📚',
        name: addonText('Biblioteca Física', 'Physical Shelf'),
        desc: addonText(
            'Convierte la biblioteca en una estantería visual con repisas sutiles.',
            'Turns the library into a visual bookshelf with subtle shelves.'
        ),
        category: 'interface',
        context: 'library',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { shelfLines: true },
    },
    {
        id: 'bookRoulette',
        emoji: '🎲',
        name: addonText('Ruleta de Libros', 'Book Roulette'),
        desc: addonText(
            'Elige tu próxima lectura al azar desde tus libros pendientes.',
            'Randomly picks your next read from your unread books.'
        ),
        category: 'productivity',
        context: 'library',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { onlyUnread: true },
    },
    {
        id: 'dynamicCovers',
        emoji: '✨',
        name: addonText('Portadas Dinámicas', 'Dynamic Covers'),
        desc: addonText(
            'Agrega un efecto sutil a favoritos, libros abiertos y lecturas activas.',
            'Adds a subtle effect to favorites, open books and active reads.'
        ),
        category: 'interface',
        context: 'library',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { subtleMotion: true },
    },
    {
        id: 'quotePosters',
        emoji: '🖼️',
        name: addonText('Pósters de Citas', 'Quote Posters'),
        desc: addonText(
            'Activa la exportación visual de frases destacadas para compartir.',
            'Enables visual export of highlighted quotes for sharing.'
        ),
        category: 'creativity',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { posterStyle: 'shark' },
    },
    {
        id: 'watchedFolder',
        emoji: '👁️',
        name: addonText('Carpeta Vigilada', 'Watched Folder'),
        desc: addonText(
            'Escanea una carpeta elegida cada cierto tiempo e importa libros nuevos.',
            'Scans a selected folder periodically and imports new books.'
        ),
        category: 'integrations',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { folder: '', intervalMinutes: 30 },
    },
    {
        id: 'autoBackup',
        emoji: '💾',
        name: addonText('Backup Automático', 'Automatic Backup'),
        desc: addonText(
            'Exporta un backup local cada cierto número de días a una carpeta elegida.',
            'Exports a local backup every set number of days to a selected folder.'
        ),
        category: 'productivity',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { folder: '', everyDays: 7, lastBackupAt: 0 },
    },
    {
        id: 'levelSystem',
        emoji: '⭐',
        name: addonText('Sistema de Niveles', 'Level System'),
        desc: addonText(
            'Calcula XP por minutos leídos, libros terminados, notas y favoritos.',
            'Calculates XP from reading minutes, finished books, notes and favorites.'
        ),
        category: 'stats',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { xpPerLevel: 100 },
    },
    {
        id: 'sharkyMascot',
        emoji: '🦈',
        name: addonText('Mascota Sharky', 'Sharky Mascot'),
        desc: addonText(
            'Muestra un acompañante visual que evoluciona con tus hábitos.',
            'Shows a visual companion that evolves with your reading habits.'
        ),
        category: 'creativity',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: {
            position: 'bottom-right',
            name: 'Sharky',
            personality: 'friendly',
            visibility: 'always',
            cosmetic: 'auto',
            left: null,
            top: null,
        },
    },
].filter(addon => addon.id !== 'removedShelf');

export const WORKSHOP_CATEGORIES = [
    { id: 'all', label: addonText('Todos', 'All') },
    { id: 'reading', label: addonText('Lectura', 'Reading') },
    { id: 'accessibility', label: addonText('Accesibilidad', 'Accessibility') },
    { id: 'interface', label: addonText('Interfaz', 'Interface') },
    { id: 'stats', label: addonText('Estadísticas', 'Stats') },
    { id: 'productivity', label: addonText('Productividad', 'Productivity') },
    { id: 'navigation', label: addonText('Navegación', 'Navigation') },
    { id: 'integrations', label: addonText('Integraciones', 'Integrations') },
    { id: 'creativity', label: addonText('Creatividad', 'Creativity') },
];

export const WORKSHOP_I18N = {
    es: {
        title: 'Workshop',
        subtitleEmpty: 'Activa funciones extra',
        active: 'Activos:',
        activeSingular: 'addon activo',
        activePlural: 'addons activos',
        clickToDisable: 'Clic para desactivar',
        soon: 'Pronto',
        contexts: {
            reader: 'En el lector',
            library: 'En biblioteca',
            global: 'Global',
        },
        fields: {
            hours: 'Horas:',
            volume: 'Volumen:',
            minutes: 'Min:',
            days: 'Días:',
        },
        folder: {
            choose: 'Elegir carpeta',
            change: 'Cambiar carpeta',
            none: 'Sin carpeta configurada',
            chooseDestination: 'Elegir destino',
            changeDestination: 'Cambiar destino',
            noDestination: 'Sin destino configurado',
        },
        external: {
            title: 'Fuentes externas seguras',
            description: 'OPDS, Calibre server, nube personal y bibliotecas públicas. SharkReader no distribuye libros: solo conecta fuentes del usuario o dominio público.',
            activeSources: 'fuente(s) activas',
            localNetworkAllowed: 'Acceso a red local permitido',
            browse: 'Explorar',
            remove: 'Quitar',
            loading: 'Cargando catálogo...',
            books: 'libros',
            unknownAuthor: 'Autor desconocido',
            download: 'descarga',
            importing: 'Importando...',
            import: 'Importar',
            cloud: 'Nube personal',
            publicDomain: 'Dominio público',
            namePlaceholder: 'Nombre',
            add: 'Agregar',
            allowPrivateNetwork: 'Permitir red local/privada para esta fuente propia',
        },
        footer: 'Los addons del lector solo funcionan con un libro abierto. Las integraciones externas solo guardan configuración; la descarga/importación desde fuentes será una capa separada.',
    },
    en: {
        title: 'Workshop',
        subtitleEmpty: 'Enable extra features',
        active: 'Active:',
        activeSingular: 'active addon',
        activePlural: 'active addons',
        clickToDisable: 'Click to disable',
        soon: 'Soon',
        contexts: {
            reader: 'In reader',
            library: 'In library',
            global: 'Global',
        },
        fields: {
            hours: 'Hours:',
            volume: 'Volume:',
            minutes: 'Min:',
            days: 'Days:',
        },
        folder: {
            choose: 'Choose folder',
            change: 'Change folder',
            none: 'No folder configured',
            chooseDestination: 'Choose destination',
            changeDestination: 'Change destination',
            noDestination: 'No destination configured',
        },
        external: {
            title: 'Safe external sources',
            description: 'OPDS, Calibre server, personal cloud and public-domain libraries. SharkReader does not distribute books: it only connects user-owned or public-domain sources.',
            activeSources: 'active source(s)',
            localNetworkAllowed: 'Local network access allowed',
            browse: 'Browse',
            remove: 'Remove',
            loading: 'Loading catalog...',
            books: 'books',
            unknownAuthor: 'Unknown author',
            download: 'download',
            importing: 'Importing...',
            import: 'Import',
            cloud: 'Personal cloud',
            publicDomain: 'Public domain',
            namePlaceholder: 'Name',
            add: 'Add',
            allowPrivateNetwork: 'Allow local/private network for this own source',
        },
        footer: 'Reader addons only work while a book is open. External integrations only save configuration; download/import from sources will remain a separate layer.',
    },
};

export const getLocalizedText = (value, lang = 'es') => {
    if (!value || typeof value === 'string') return value || '';
    return value[lang] || value.es || value.en || '';
};

export const getWorkshopLocale = (lang = 'es') => WORKSHOP_I18N[lang] || WORKSHOP_I18N.es;

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
    if (!addon) return { ok: false, reason: context.lang === 'en' ? 'Unknown addon' : 'Addon desconocido' };
    if (addon.status !== 'active') return { ok: false, reason: context.lang === 'en' ? 'Addon unavailable' : 'Addon no disponible' };
    if (addon.requiresProfile && !context.userProfile) return { ok: false, reason: context.lang === 'en' ? 'You need to sign in' : 'Necesitas iniciar sesión' };
    return { ok: true, enabled: Boolean(nextEnabled) };
};

export const migrateWorkshopData = ({ addons = {}, addonConfig = {}, externalSources = [] } = {}) => ({
    schemaVersion: WORKSHOP_SCHEMA_VERSION,
    addons: normalizeAddonState(addons),
    addonConfig: normalizeAddonConfig(addonConfig),
    externalSources: (Array.isArray(externalSources) && externalSources.length ? externalSources : DEFAULT_EXTERNAL_SOURCES).map(normalizeExternalSource),
});
