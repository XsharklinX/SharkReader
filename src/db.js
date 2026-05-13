// SharkReader - Database & Storage utilities

const DB_NAME = 'SharkReaderDB';
const DB_VERSION = 5; // v5: books store is the source of truth for library metadata
const LEGACY_DB_NAME = 'SharkReaderDB_v4';
const LEGACY_MIGRATION_KEY = 'sharkreader_migrated_v5';

const FILES_STORE = 'files';
const LEGACY_APPDATA_STORE = 'appData';
const BOOKS_STORE = 'books';
const SETTINGS_STORE = 'settings';
const CACHE_STORE = 'cache';

export const safeParse = (key, fallbackValue) => {
    try {
        const item = localStorage.getItem(key);
        if (!item || item === 'undefined') return fallbackValue;
        return JSON.parse(item);
    } catch {
        return fallbackValue;
    }
};

let _dbPromise = null;

const runTransaction = (db, storeName, mode, worker) => {
    if (!db.objectStoreNames.contains(storeName)) {
        return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let request = null;

        tx.oncomplete = () => resolve(request?.result ?? null);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);

        try {
            request = worker(store, tx) || null;
            if (request) {
                request.onerror = () => reject(request.error);
            }
        } catch (error) {
            reject(error);
        }
    });
};

const getAllFromStore = async (db, storeName) => {
    const records = await runTransaction(db, storeName, 'readonly', (store) => store.getAll()).catch(() => []);
    return records || [];
};

const getByKeyFromStore = async (db, storeName, key) => {
    const record = await runTransaction(db, storeName, 'readonly', (store) => store.get(key)).catch(() => null);
    return record || null;
};

const putManyIntoStore = async (db, storeName, records) => {
    if (!Array.isArray(records) || !records.length) return;
    await runTransaction(db, storeName, 'readwrite', (store) => {
        records.forEach((record) => {
            if (record) store.put(record);
        });
        return null;
    });
};

const putIntoStore = async (db, storeName, record) => {
    await runTransaction(db, storeName, 'readwrite', (store) => store.put(record));
};

const deleteFromStore = async (db, storeName, key) => {
    await runTransaction(db, storeName, 'readwrite', (store) => store.delete(key));
};

const countStore = async (db, storeName) => {
    const count = await runTransaction(db, storeName, 'readonly', (store) => store.count()).catch(() => 0);
    return count || 0;
};

const inferBookType = (record) => {
    const fileName = record?.file?.name || '';
    if (/\.pdf$/i.test(fileName)) return 'pdf';
    if (/\.mobi$/i.test(fileName)) return 'mobi';
    return 'epub';
};

const buildBookRecordFromLegacy = (fileRecord, metaRecord = {}) => ({
    id: fileRecord.id,
    sourcePath: fileRecord.sourcePath || fileRecord.file?.sourcePath || null,
    file: fileRecord.file || null,
    type: inferBookType(fileRecord),
    originalTitle: fileRecord.originalTitle || metaRecord.customTitle || fileRecord.file?.name?.replace(/\.[^/.]+$/, '') || 'Libro sin titulo',
    originalAuthor: fileRecord.originalAuthor || metaRecord.customAuthor || 'Autor desconocido',
    coverBase64: fileRecord.coverBase64 || null,
    description: metaRecord.description || '',
    publisher: metaRecord.publisher || '',
    tags: metaRecord.tags || '',
    series: metaRecord.series || '',
    seriesIndex: metaRecord.seriesIndex || 0,
    progress: metaRecord.progress || 0,
    bookmarks: Array.isArray(metaRecord.bookmarks) ? metaRecord.bookmarks : [],
    notes: metaRecord.notes || '',
    customTitle: metaRecord.customTitle || '',
    customAuthor: metaRecord.customAuthor || '',
    customCover: metaRecord.customCover || null,
    isFav: !!metaRecord.isFav,
    rating: metaRecord.rating || 0,
    lastLocation: metaRecord.lastLocation || null,
    dateAdded: metaRecord.dateAdded || fileRecord.dateAdded || Date.now(),
    lastReadDate: metaRecord.lastReadDate || 0,
    category: metaRecord.category || null,
    readingMinutes: metaRecord.readingMinutes || 0,
    isFinished: !!metaRecord.isFinished,
    dateStarted: metaRecord.dateStarted || null,
    dateFinished: metaRecord.dateFinished || null,
    isWishlist: !!metaRecord.isWishlist,
});

const migrateLegacyExternalDB = async (db) => {
    const alreadyMigrated = safeParse('sharkreader_migrated_v2', false);
    if (alreadyMigrated) return;

    await new Promise((resolve) => {
        const legacyReq = indexedDB.open(LEGACY_DB_NAME, 1);
        legacyReq.onerror = () => resolve();
        legacyReq.onsuccess = async () => {
            const legacyDB = legacyReq.result;
            if (!legacyDB.objectStoreNames.contains(FILES_STORE)) {
                legacyDB.close();
                resolve();
                return;
            }

            const legacyFiles = await getAllFromStore(legacyDB, FILES_STORE);
            legacyDB.close();
            if (!legacyFiles.length) {
                resolve();
                return;
            }

            await putManyIntoStore(db, FILES_STORE, legacyFiles).catch(() => {});
            localStorage.setItem('sharkreader_migrated_v2', 'true');
            console.log(`[SharkReader] Migrados ${legacyFiles.length} libros desde DB legacy`);
            resolve();
        };
    });
};

const migrateBooksStore = async (db) => {
    const alreadyMigrated = safeParse(LEGACY_MIGRATION_KEY, false);
    const booksCount = await countStore(db, BOOKS_STORE);
    if (alreadyMigrated || booksCount > 0) {
        localStorage.setItem(LEGACY_MIGRATION_KEY, 'true');
        return;
    }

    const legacyFiles = await getAllFromStore(db, FILES_STORE);
    if (!legacyFiles.length) {
        localStorage.setItem(LEGACY_MIGRATION_KEY, 'true');
        return;
    }

    const legacyMeta = safeParse('sharkreader_meta', {});
    const migratedBooks = legacyFiles.map((fileRecord) => {
        const legacyKey = `${fileRecord.originalTitle || ''}|${fileRecord.originalAuthor || ''}`;
        return buildBookRecordFromLegacy(fileRecord, legacyMeta[legacyKey] || {});
    });

    await putManyIntoStore(db, BOOKS_STORE, migratedBooks).catch((err) => {
        console.error('[SharkReader] Error migrando books store:', err);
    });
    localStorage.setItem(LEGACY_MIGRATION_KEY, 'true');
    console.log(`[SharkReader] Migrados ${migratedBooks.length} libros al store books`);
};

export const initDB = () => {
    if (_dbPromise) return _dbPromise;

    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        let settled = false;

        const fail = (error) => {
            if (settled) return;
            settled = true;
            _dbPromise = null;
            reject(error);
        };

        const finish = (db) => {
            if (settled) return;
            settled = true;
            db.onversionchange = () => {
                try { db.close(); } catch (_) {}
            };
            resolve(db);
        };

        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            const oldVersion = e.oldVersion;

            if (oldVersion < 1 && !db.objectStoreNames.contains(FILES_STORE)) {
                db.createObjectStore(FILES_STORE, { keyPath: 'id' });
            }
            if (oldVersion < 3 && !db.objectStoreNames.contains(LEGACY_APPDATA_STORE)) {
                db.createObjectStore(LEGACY_APPDATA_STORE, { keyPath: 'key' });
            }
            if (oldVersion < 5 && !db.objectStoreNames.contains(BOOKS_STORE)) {
                db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
            }
            if (oldVersion < 5 && !db.objectStoreNames.contains(SETTINGS_STORE)) {
                db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
            }
            if (oldVersion < 5 && !db.objectStoreNames.contains(CACHE_STORE)) {
                db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
            }
        };

        req.onsuccess = async () => {
            try {
                const db = req.result;
                await migrateLegacyExternalDB(db);
                await migrateBooksStore(db);
                finish(db);
            } catch (error) {
                fail(error);
            }
        };

        req.onblocked = () => fail(new Error('IndexedDB blocked'));
        req.onerror = () => fail(req.error);
    });

    return _dbPromise;
};

export const saveBookToDB = async (bookRecord) => {
    if (!bookRecord?.id) return;
    try {
        const db = await initDB();
        await putIntoStore(db, BOOKS_STORE, bookRecord);
    } catch (error) {
        console.error('saveBookToDB', error);
    }
};

export const saveBooksToDB = async (bookRecords) => {
    if (!Array.isArray(bookRecords)) return;
    try {
        const db = await initDB();
        await putManyIntoStore(db, BOOKS_STORE, bookRecords);
    } catch (error) {
        console.error('saveBooksToDB', error);
    }
};

export const loadBooksFromDB = async () => {
    try {
        const db = await initDB();
        return await getAllFromStore(db, BOOKS_STORE);
    } catch {
        return [];
    }
};

export const deleteBookFromDB = async (id) => {
    try {
        const db = await initDB();
        await deleteFromStore(db, BOOKS_STORE, id);
        if (db.objectStoreNames.contains(FILES_STORE)) {
            await deleteFromStore(db, FILES_STORE, id).catch(() => {});
        }
    } catch (_) {}
};

// Legacy helpers kept for compatibility with older code paths
export const saveFileToDB = async (id, file, coverBase64, originalTitle, originalAuthor, dateAdded) => {
    try {
        const db = await initDB();
        await putIntoStore(db, FILES_STORE, {
            id,
            file,
            coverBase64,
            originalTitle,
            originalAuthor,
            dateAdded,
            sourcePath: file?.sourcePath || null,
        });
    } catch (error) {
        console.error('saveFileToDB', error);
    }
};

export const deleteFileFromDB = deleteBookFromDB;

export const loadFilesFromDB = async () => {
    try {
        const db = await initDB();
        return await getAllFromStore(db, FILES_STORE);
    } catch {
        return [];
    }
};

export const saveSetting = async (key, value) => {
    try {
        const db = await initDB();
        await putIntoStore(db, SETTINGS_STORE, { key, value });
    } catch (error) {
        console.error('saveSetting', error);
    }
};

export const loadSetting = async (key) => {
    try {
        const db = await initDB();
        const current = await getByKeyFromStore(db, SETTINGS_STORE, key);
        if (current) return current.value;

        const legacy = await getByKeyFromStore(db, LEGACY_APPDATA_STORE, key);
        return legacy ? legacy.value : null;
    } catch {
        return null;
    }
};

export const saveCache = async (key, value) => {
    try {
        const db = await initDB();
        await putIntoStore(db, CACHE_STORE, { key, value });
    } catch (error) {
        console.error('saveCache', error);
    }
};

export const loadCache = async (key) => {
    try {
        const db = await initDB();
        const current = await getByKeyFromStore(db, CACHE_STORE, key);
        return current ? current.value : null;
    } catch {
        return null;
    }
};

export const saveAppData = saveSetting;
export const loadAppData = loadSetting;

export const fileToBase64 = (blob) => new Promise((resolve) => {
    if (!blob) return resolve(null);
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
});
