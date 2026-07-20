export const WORKSHOP_SCHEMA_VERSION = 1;

const addonText = (es, en) => ({ es, en });

export const WORKSHOP_MATURITY = {
    stable: addonText('Estable', 'Stable'),
    experimental: addonText('Experimental', 'Experimental'),
};

const ADDON_MATURITY = {
    focusMode: 'stable',
    autoBookmark: 'stable',
    netflixView: 'stable',
    readingJournal: 'stable',
    reminders: 'stable',
    smartToc: 'stable',
    dyslexiaMode: 'stable',
    bookRoulette: 'stable',
    dynamicCovers: 'stable',
    quotePosters: 'stable',
    levelSystem: 'stable',
    soundFeedback: 'stable',
    sharkyMascot: 'stable',
    externalSources: 'experimental',
    watchedFolder: 'experimental',
    autoBackup: 'experimental',
};

const ADDON_API = {
    focusMode: ['reader.toolbar'],
    autoBookmark: ['reader.location', 'bookmarks.write'],
    netflixView: ['library.view'],
    readingJournal: ['reader.session', 'journal.write'],
    reminders: ['notifications.local'],
    smartToc: ['reader.toc'],
    externalSources: ['sources.external', 'imports.request'],
    dyslexiaMode: ['ui.accessibility', 'reader.typography'],
    bookRoulette: ['library.query'],
    dynamicCovers: ['library.coverEffects'],
    quotePosters: ['annotations.export', 'canvas.render'],
    watchedFolder: ['filesystem.read', 'imports.folder'],
    autoBackup: ['filesystem.write', 'backup.export'],
    levelSystem: ['stats.read', 'profile.display'],
    soundFeedback: ['audio.play'],
    sharkyMascot: ['profile.read', 'stats.read', 'ui.overlay'],
};

// Traducción legible de cada capacidad declarada en ADDON_API — hasta ahora
// esa lista se calculaba pero no se mostraba en ningún sitio (Fase 7:
// permisos/capacidades visibles por addon).
const API_CAPABILITY_LABELS = {
    'reader.toolbar': addonText('Mostrar/ocultar la barra del lector', 'Show/hide the reader toolbar'),
    'reader.location': addonText('Leer tu posición actual en el libro', 'Read your current position in the book'),
    'reader.session': addonText('Leer el inicio/fin de tus sesiones de lectura', 'Read the start/end of your reading sessions'),
    'journal.write': addonText('Añadir entradas a tu diario de lectura', 'Add entries to your reading journal'),
    'reader.toc': addonText('Leer el índice del libro', "Read the book's table of contents"),
    'reader.typography': addonText('Ajustar tipografía y espaciado del lector', 'Adjust reader typography and spacing'),
    'bookmarks.write': addonText('Crear marcadores en tu nombre', 'Create bookmarks on your behalf'),
    'library.view': addonText('Cambiar cómo se ve la biblioteca', 'Change how the library looks'),
    'library.query': addonText('Leer la lista de libros de tu biblioteca', 'Read your library book list'),
    'library.coverEffects': addonText('Aplicar efectos visuales a las portadas', 'Apply visual effects to covers'),
    'notifications.local': addonText('Mostrar notificaciones del sistema', 'Show system notifications'),
    'sources.external': addonText('Conectar servidores externos (OPDS/Calibre)', 'Connect external servers (OPDS/Calibre)'),
    'imports.request': addonText('Solicitar la importación de libros', 'Request book imports'),
    'imports.folder': addonText('Importar libros automáticamente desde una carpeta', 'Automatically import books from a folder'),
    'ui.accessibility': addonText('Cambiar ajustes de accesibilidad de la interfaz', 'Change interface accessibility settings'),
    'annotations.export': addonText('Leer tus subrayados para exportarlos', 'Read your highlights to export them'),
    'canvas.render': addonText('Generar imágenes (canvas) en tu equipo', 'Generate images (canvas) on your device'),
    'filesystem.read': addonText('Leer archivos de una carpeta que tú elijas', 'Read files from a folder you choose'),
    'filesystem.write': addonText('Escribir archivos en una carpeta que tú elijas', 'Write files to a folder you choose'),
    'backup.export': addonText('Generar un backup de tus datos', 'Generate a backup of your data'),
    'stats.read': addonText('Leer tus estadísticas de lectura', 'Read your reading statistics'),
    'profile.read': addonText('Leer tu perfil (nombre, avatar)', 'Read your profile (name, avatar)'),
    'profile.display': addonText('Mostrar información de tu perfil', 'Display your profile information'),
    'audio.play': addonText('Reproducir sonidos cortos', 'Play short sounds'),
    'ui.overlay': addonText('Mostrar un elemento flotante sobre la app', 'Show a floating element over the app'),
};

// Explicación corta y práctica de cómo usar cada addon (distinto de `desc`,
// que describe QUÉ hace — esto es "cómo lo activas / dónde lo ves").
const ADDON_DOCS = {
    focusMode: addonText('Actívalo y simplemente lee — la barra vuelve sola al mover el ratón arriba.', 'Turn it on and just read — the toolbar comes back on its own when you move the mouse up.'),
    autoBookmark: addonText('No requiere nada de ti: se guarda solo al cerrar cualquier libro.', 'Requires nothing from you: it saves automatically whenever you close a book.'),
    netflixView: addonText('Cámbialo desde el selector de vista en la biblioteca (⊞ / ☰ / 📚).', 'Switch it from the view selector in the library (⊞ / ☰ / 📚).'),
    readingJournal: addonText('Se abre desde el menú lateral → Diario de Lectura, una vez que tengas alguna sesión registrada.', 'Open it from the side menu → Reading Journal, once you have at least one logged session.'),
    reminders: addonText('Necesita permiso de notificaciones del sistema operativo la primera vez.', 'Needs OS notification permission the first time.'),
    smartToc: addonText('Aparece como un panel flotante mientras lees un EPUB con índice.', 'Shows up as a floating panel while reading an EPUB that has a table of contents.'),
    externalSources: addonText('Configura tus servidores en Workshop → esta tarjeta → Configurar.', 'Set up your servers in Workshop → this card → Configure.'),
    dyslexiaMode: addonText('El interruptor real está en la barra del lector (Aa) — aquí solo se ajustan sus opciones.', 'The real switch lives in the reader toolbar (Aa) — this only tunes its options.'),
    bookRoulette: addonText('Botón 🎡 en la biblioteca. Filtra por no-leídos/favoritos/etiqueta desde Configurar.', '🎡 button in the library. Filter by unread/favorites/tag from Configure.'),
    dynamicCovers: addonText('Se aplica solo — no necesita configuración.', 'Applies automatically — no configuration needed.'),
    quotePosters: addonText('Botón 🖼️ al subrayar texto o en el panel de Anotaciones.', '🖼️ button when highlighting text or in the Annotations panel.'),
    watchedFolder: addonText('Elige la carpeta desde Configurar; el primer escaneo tarda hasta el intervalo elegido.', 'Choose the folder from Configure; the first scan takes up to the chosen interval.'),
    autoBackup: addonText('Elige carpeta y frecuencia desde Configurar — corre en segundo plano, sin avisos salvo error.', 'Choose folder and frequency from Configure — runs in the background, silent unless it fails.'),
    levelSystem: addonText('Tu nivel se ve en el menú de usuario y en Logros.', 'Your level shows in the user menu and in Achievements.'),
    soundFeedback: addonText('Ajusta el volumen y qué eventos suenan desde Configurar.', 'Adjust volume and which events play sound from Configure.'),
    sharkyMascot: addonText('Aparece flotando en pantalla — clic para el menú, clic derecho para acariciarlo.', 'Appears floating on screen — click for its menu, right-click to pet it.'),
};

const ADDON_CONFIG_SCHEMA = {
    focusMode: {
        idleMs: { type: 'number', min: 1000, max: 15000, fallback: 2500 },
    },
    reminders: {
        minHoursSinceLastOpen: { type: 'number', min: 1, max: 72, fallback: 1 },
    },
    watchedFolder: {
        folder: { type: 'string', fallback: '' },
        intervalMinutes: { type: 'number', min: 5, max: 1440, fallback: 30 },
    },
    autoBackup: {
        folder: { type: 'string', fallback: '' },
        everyDays: { type: 'number', min: 1, max: 90, fallback: 7 },
        // Marca de tiempo interna del último backup (App.jsx) — no es una
        // preferencia editable, se oculta del modal de configuración.
        lastBackupAt: { type: 'number', min: 0, fallback: 0, hidden: true },
    },
    levelSystem: {
        xpPerLevel: { type: 'number', min: 50, max: 1000, fallback: 100 },
        displayStyle: { type: 'enum', values: ['full', 'minimal'], fallback: 'full' },
    },
    soundFeedback: {
        volume: { type: 'number', min: 0, max: 100, fallback: 50 },
        pageTurn: { type: 'boolean', fallback: true },
        achievements: { type: 'boolean', fallback: true },
        streaks: { type: 'boolean', fallback: true },
        sharky: { type: 'boolean', fallback: true },
    },
    dyslexiaMode: {
        strongerContrast: { type: 'boolean', fallback: true },
        // Se activa/desactiva desde el botón dedicado dentro del lector, no
        // como una preferencia del modal de configuración.
        readerEnabled: { type: 'boolean', fallback: false, hidden: true },
        fontScale: { type: 'enum', values: ['1.0', '1.1', '1.2'], fallback: '1.1' },
    },
    bookRoulette: {
        onlyUnread: { type: 'boolean', fallback: true },
        onlyFavorites: { type: 'boolean', fallback: false },
        filterTag: { type: 'string', fallback: '' },
    },
    sharkyMascot: {
        position: { type: 'enum', values: ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'custom'], fallback: 'bottom-right' },
        name: { type: 'string', fallback: 'Sharky' },
        personality: { type: 'enum', values: ['friendly', 'serious', 'funny', 'minimal', 'silent'], fallback: 'friendly' },
        visibility: { type: 'enum', values: ['always', 'library', 'reader', 'events', 'hidden'], fallback: 'always' },
        eventFrequency: { type: 'enum', values: ['normal', 'reduced', 'important'], fallback: 'reduced' },
        showContextTips: { type: 'boolean', fallback: true },
        showSessionSummary: { type: 'boolean', fallback: true },
        milestoneReactions: { type: 'boolean', fallback: true },
        cosmetic: { type: 'string', fallback: 'auto' },
        left: { type: 'nullableNumber', fallback: null },
        top: { type: 'nullableNumber', fallback: null },
    },
};

const clampNumber = (value, rule) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return rule.fallback;
    return Math.min(rule.max ?? number, Math.max(rule.min ?? number, number));
};

const sanitizeConfigValue = (value, rule) => {
    if (!rule) return value;
    if (rule.type === 'number') return clampNumber(value, rule);
    if (rule.type === 'nullableNumber') return value === null || value === undefined || value === '' ? null : clampNumber(value, rule);
    if (rule.type === 'boolean') return typeof value === 'boolean' ? value : rule.fallback;
    if (rule.type === 'enum') return rule.values.includes(value) ? value : rule.fallback;
    if (rule.type === 'string') return typeof value === 'string' ? value : rule.fallback;
    return value;
};

export const sanitizeAddonConfig = (addonId, config = {}) => {
    const schema = ADDON_CONFIG_SCHEMA[addonId];
    if (!schema) return { ...config };
    const sanitized = { ...config };
    Object.entries(schema).forEach(([key, rule]) => {
        sanitized[key] = sanitizeConfigValue(sanitized[key] ?? rule.fallback, rule);
    });
    return sanitized;
};

const ADDONS = [
    {
        id: 'focusMode',
        name: addonText('Modo Focus', 'Focus Mode'),
        desc: addonText('La barra desaparece tras 2.5s de inactividad. Acerca el ratón al borde superior para recuperarla.', 'The toolbar hides after 2.5s of inactivity. Move the mouse to the top edge to bring it back.'),
        category: 'reading',
        context: 'reader',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { idleMs: 2500 },
    },
    {
        id: 'autoBookmark',
        name: addonText('Marcador Automático', 'Auto Bookmark'),
        desc: addonText('Guarda automáticamente tu posición como marcador cada vez que cierras un libro.', 'Automatically saves your position as a bookmark whenever you close a book.'),
        category: 'reading',
        context: 'reader',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { onClose: true },
    },
    {
        id: 'netflixView',
        name: addonText('Vista Netflix', 'Netflix View'),
        desc: addonText('Portadas más grandes en la biblioteca. Hover para ver información rápida del libro.', 'Larger covers in the library. Hover to see quick book information.'),
        category: 'interface',
        context: 'library',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { largeCovers: true },
    },
    {
        id: 'readingJournal',
        name: addonText('Diario de Lectura', 'Reading Journal'),
        desc: addonText('Registra automáticamente cada sesión: fecha, libro y progreso. Accede desde el menú lateral.', 'Automatically logs each session: date, book and progress. Open it from the side menu.'),
        category: 'stats',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { maxEntries: 100 },
    },
    {
        id: 'reminders',
        name: addonText('Recordatorio Diario', 'Daily Reminder'),
        desc: addonText('Muestra una notificación para recordarte leer cuando llevas más de 1h sin abrir la app.', 'Shows a notification reminding you to read when you have not opened the app for more than 1 hour.'),
        category: 'productivity',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { minHoursSinceLastOpen: 1 },
    },
    {
        id: 'smartToc',
        name: addonText('Índice Flotante', 'Floating TOC'),
        desc: addonText('Tabla de contenidos flotante con indicador de posición actual mientras lees.', 'Floating table of contents with a current-position indicator while reading.'),
        category: 'navigation',
        context: 'reader',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { showProgress: true },
    },
    {
        id: 'externalSources',
        name: addonText('Fuentes externas seguras', 'Safe External Sources'),
        desc: addonText('Prepara conexiones OPDS, Calibre server, nube personal y bibliotecas públicas sin distribuir contenido dentro de la app.', 'Prepare OPDS, Calibre server, personal cloud and public-domain library connections without distributing content inside the app.'),
        category: 'integrations',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { allowPublicDomainOnly: true },
    },
    {
        id: 'dyslexiaMode',
        name: addonText('Modo Dislexia', 'Dyslexia Mode'),
        desc: addonText('Aplica fuente legible, más espaciado y contraste optimizado en la interfaz.', 'Applies a readable font, more spacing and optimized contrast across the interface.'),
        category: 'accessibility',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { strongerContrast: true },
    },
    {
        id: 'bookRoulette',
        name: addonText('Ruleta de Libros', 'Book Roulette'),
        desc: addonText('Elige tu próxima lectura al azar desde tus libros pendientes.', 'Randomly picks your next read from your unread books.'),
        category: 'productivity',
        context: 'library',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { onlyUnread: true },
    },
    {
        id: 'dynamicCovers',
        name: addonText('Portadas Dinámicas', 'Dynamic Covers'),
        desc: addonText('Agrega un efecto sutil a favoritos, libros abiertos y lecturas activas.', 'Adds a subtle effect to favorites, open books and active reads.'),
        category: 'interface',
        context: 'library',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { subtleMotion: true },
    },
    {
        id: 'quotePosters',
        name: addonText('Pósters de Citas', 'Quote Posters'),
        desc: addonText('Activa la exportación visual de frases destacadas para compartir.', 'Enables visual export of highlighted quotes for sharing.'),
        category: 'creativity',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { posterStyle: 'shark' },
    },
    {
        id: 'watchedFolder',
        name: addonText('Carpeta Vigilada', 'Watched Folder'),
        desc: addonText('Escanea una carpeta elegida cada cierto tiempo e importa libros nuevos.', 'Scans a selected folder periodically and imports new books.'),
        category: 'integrations',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { folder: '', intervalMinutes: 30 },
    },
    {
        id: 'autoBackup',
        name: addonText('Backup Automático', 'Automatic Backup'),
        desc: addonText('Exporta un backup local cada cierto número de días a una carpeta elegida.', 'Exports a local backup every set number of days to a selected folder.'),
        category: 'productivity',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { folder: '', everyDays: 7, lastBackupAt: 0 },
    },
    {
        id: 'levelSystem',
        name: addonText('Sistema de Niveles', 'Level System'),
        desc: addonText('Calcula XP por minutos leídos, libros terminados, notas y favoritos.', 'Calculates XP from reading minutes, finished books, notes and favorites.'),
        category: 'stats',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { xpPerLevel: 100 },
    },
    {
        id: 'soundFeedback',
        name: addonText('Sonido de feedback', 'Sound Feedback'),
        desc: addonText('Sonidos sutiles al desbloquear logros, subir de nivel, pasar página y más. Controla el volumen desde aquí.', 'Subtle sounds when unlocking achievements, leveling up, turning pages and more. Control volume from here.'),
        category: 'interface',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: { volume: 50, pageTurn: true, achievements: true, streaks: true, sharky: true },
    },
    {
        id: 'sharkyMascot',
        name: addonText('Mascota Sharky', 'Sharky Mascot'),
        desc: addonText('Muestra un acompañante visual que evoluciona con tus hábitos.', 'Shows a visual companion that evolves with your reading habits.'),
        category: 'creativity',
        context: 'global',
        status: 'active',
        defaultEnabled: false,
        defaultConfig: {
            position: 'bottom-right',
            name: 'Sharky',
            personality: 'friendly',
            visibility: 'always',
            eventFrequency: 'reduced',
            showContextTips: true,
            showSessionSummary: true,
            milestoneReactions: true,
            cosmetic: 'auto',
            left: null,
            top: null,
        },
    },
];

export const WORKSHOP_ADDONS = ADDONS.map(addon => ({
    ...addon,
    maturity: ADDON_MATURITY[addon.id] || 'experimental',
    api: ADDON_API[addon.id] || [],
    docs: ADDON_DOCS[addon.id] || null,
    configSchema: ADDON_CONFIG_SCHEMA[addon.id] || {},
    lifecycle: {
        configurable: Boolean(ADDON_CONFIG_SCHEMA[addon.id]),
        migratable: true,
    },
}));

// Traduce las capacidades declaradas de un addon (`addon.api`, strings tipo
// "reader.toolbar") a descripciones legibles — antes se calculaban pero no
// se mostraban en ningún sitio (Fase 7: permisos/capacidades visibles).
export const getAddonCapabilityLabels = (addon, lang = 'es') =>
    (addon?.api || []).map(capability => ({
        id: capability,
        label: getLocalizedText(API_CAPABILITY_LABELS[capability], lang) || capability,
    }));

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
        configure: 'Configurar',
        soon: 'Pronto',
        contexts: {
            reader: 'En el lector',
            library: 'En biblioteca',
            global: 'Global',
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
        configure: 'Configure',
        soon: 'Soon',
        contexts: {
            reader: 'In reader',
            library: 'In library',
            global: 'Global',
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
        normalized[addon.id] = sanitizeAddonConfig(addon.id, {
            ...(addon.defaultConfig || {}),
            ...(stored?.[addon.id] || {}),
        });
    }
    return normalized;
};

export const validateAddonToggle = (addonId, nextEnabled, context = {}) => {
    const addon = WORKSHOP_MODULES_BY_ID.get(addonId);
    if (!addon) return { ok: false, reason: context.lang === 'en' ? 'Unknown addon' : 'Addon desconocido' };
    if (addon.status !== 'active') return { ok: false, reason: context.lang === 'en' ? 'Addon unavailable' : 'Addon no disponible' };
    if (addon.requiresProfile && !context.userProfile) return { ok: false, reason: context.lang === 'en' ? 'You need to sign in' : 'Necesitas iniciar sesión' };
    if (nextEnabled && addon.maturity === 'experimental' && !context.allowExperimental) {
        return {
            ok: false,
            needsConfirmation: true,
            reason: context.lang === 'en'
                ? 'This addon is experimental. Open its card and confirm activation.'
                : 'Este addon es experimental. Abre su tarjeta y confirma la activación.',
        };
    }
    return { ok: true, enabled: Boolean(nextEnabled) };
};

export const migrateWorkshopData = ({ addons = {}, addonConfig = {}, externalSources = [] } = {}) => ({
    schemaVersion: WORKSHOP_SCHEMA_VERSION,
    addons: normalizeAddonState(addons),
    addonConfig: normalizeAddonConfig(addonConfig),
    externalSources: (Array.isArray(externalSources) && externalSources.length ? externalSources : DEFAULT_EXTERNAL_SOURCES).map(normalizeExternalSource),
});
