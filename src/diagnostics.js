const MAX_ENTRIES = 300;

let installed = false;
let entries = [];
let longTaskObserver = null;

const toText = (value) => {
    if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack || ''}`.trim();
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

export const addDiagnosticEntry = (level, message, meta = {}) => {
    entries = [
        {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            ts: new Date().toISOString(),
            level,
            message: toText(message),
            meta,
        },
        ...entries,
    ].slice(0, MAX_ENTRIES);
};

export const installDiagnostics = () => {
    if (installed || typeof window === 'undefined') return;
    installed = true;

    window.addEventListener('error', (event) => {
        addDiagnosticEntry('error', event.error || event.message, {
            source: event.filename,
            line: event.lineno,
            column: event.colno,
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        addDiagnosticEntry('error', event.reason || 'Unhandled rejection', {
            source: 'unhandledrejection',
        });
    });

    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args) => {
        addDiagnosticEntry('error', args.map(toText).join(' '), { source: 'console.error' });
        originalError.apply(console, args);
    };

    console.warn = (...args) => {
        addDiagnosticEntry('warning', args.map(toText).join(' '), { source: 'console.warn' });
        originalWarn.apply(console, args);
    };

    if (typeof PerformanceObserver !== 'undefined') {
        try {
            longTaskObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    if (entry.duration < 180) return;
                    addDiagnosticEntry('performance', 'Bloqueo prolongado del hilo de interfaz', {
                        source: 'performance.longtask',
                        durationMs: Math.round(entry.duration),
                        startedAtMs: Math.round(entry.startTime),
                    });
                });
            });
            longTaskObserver.observe({ type: 'longtask', buffered: true });
        } catch {
            longTaskObserver = null;
        }
    }
};

export const getDiagnosticEntries = () => [...entries];

export const clearDiagnosticEntries = () => {
    entries = [];
};
