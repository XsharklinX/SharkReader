// SharkReader - Database & Storage utilities

const DB_NAME = 'SharkReaderDB';
const DB_VERSION = 3; // v3: appData store for heavy key-value data

export const safeParse = (key, fallbackValue) => {
    try {
        const item = localStorage.getItem(key);
        if (!item || item === 'undefined') return fallbackValue;
        return JSON.parse(item);
    } catch {
        return fallbackValue;
    }
};

// Cache the DB connection promise — only open once per session
let _dbPromise = null;

export const initDB = () => {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const oldVersion = e.oldVersion;

        // v1: store inicial
        if (oldVersion < 1) {
            db.createObjectStore('files', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
            // v2: no schema changes
        }
        // v3: appData store for heavy key-value data (stats, journal, vocab)
        if (oldVersion < 3) {
            db.createObjectStore('appData', { keyPath: 'key' });
        }
    };

        req.onsuccess = () => { migrateFromLegacyDB().then(() => resolve(req.result)); };
        req.onerror = () => { _dbPromise = null; reject(req.error); };
    });
    return _dbPromise;
};

// Migra registros de 'SharkReaderDB_v4' (DB vieja) si existen
const migrateFromLegacyDB = () => new Promise((resolve) => {
    const legacyReq = indexedDB.open('SharkReaderDB_v4', 1);
    legacyReq.onerror = () => resolve(); // no existe, OK
    legacyReq.onsuccess = async () => {
        const legacyDB = legacyReq.result;
        if (!legacyDB.objectStoreNames.contains('files')) { legacyDB.close(); return resolve(); }
        const tx = legacyDB.transaction('files', 'readonly');
        const all = await new Promise(res => {
            const r = tx.objectStore('files').getAll();
            r.onsuccess = () => res(r.result || []);
            r.onerror = () => res([]);
        });
        legacyDB.close();
        if (!all.length) return resolve();
        const migrated = safeParse('sharkreader_migrated_v2', false);
        if (migrated) return resolve();
        // Guardar en nueva DB
        const newDB = await initDB();
        const writeTx = newDB.transaction('files', 'readwrite');
        const store = writeTx.objectStore('files');
        for (const record of all) {
            try { store.put(record); } catch (_) {}
        }
        writeTx.oncomplete = () => {
            localStorage.setItem('sharkreader_migrated_v2', 'true');
            console.log(`[SharkReader] Migrados ${all.length} libros desde DB legacy`);
            resolve();
        };
        writeTx.onerror = () => resolve();
    };
});

export const saveFileToDB = async (id, file, coverBase64, originalTitle, originalAuthor, dateAdded) => {
    try {
        const db = await initDB();
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put({ id, file, coverBase64, originalTitle, originalAuthor, dateAdded });
    } catch (e) { console.error('Error guardando en IDB', e); }
};

export const deleteFileFromDB = async (id) => {
    try {
        const db = await initDB();
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').delete(id);
    } catch (_) {}
};

export const loadFilesFromDB = async () => {
    try {
        const db = await initDB();
        return new Promise((resolve) => {
            const tx = db.transaction('files', 'readonly');
            const req = tx.objectStore('files').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    } catch { return []; }
};

export const saveAppData = async (key, value) => {
    try {
        const db = await initDB();
        const tx = db.transaction('appData', 'readwrite');
        tx.objectStore('appData').put({ key, value });
    } catch (e) { console.error('saveAppData', e); }
};

export const loadAppData = async (key) => {
    try {
        const db = await initDB();
        return new Promise((resolve) => {
            const tx = db.transaction('appData', 'readonly');
            const req = tx.objectStore('appData').get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
            req.onerror = () => resolve(null);
        });
    } catch { return null; }
};

export const fileToBase64 = (blob) => new Promise((resolve) => {
    if (!blob) return resolve(null);
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
});
