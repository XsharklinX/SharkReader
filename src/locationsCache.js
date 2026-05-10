// SharkReader — Locations Cache
// Stores/retrieves pre-computed epubjs location arrays in IndexedDB
// so we never run the expensive locations.generate() more than once per book.

const CACHE_DB = 'SharkLocationsCache';
const CACHE_VERSION = 1;
const CACHE_STORE = 'locations';

let _db = null;

function openCacheDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(CACHE_DB, CACHE_VERSION);
        req.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(CACHE_STORE, { keyPath: 'bookId' });
        };
        req.onsuccess = () => { _db = req.result; resolve(_db); };
        req.onerror = () => reject(req.error);
    });
}

export async function getCachedLocations(bookId) {
    try {
        const db = await openCacheDB();
        return new Promise((resolve) => {
            const req = db.transaction(CACHE_STORE, 'readonly')
                .objectStore(CACHE_STORE).get(bookId);
            req.onsuccess = () => resolve(req.result?.locations ?? null);
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

export async function setCachedLocations(bookId, locations) {
    try {
        const db = await openCacheDB();
        const tx = db.transaction(CACHE_STORE, 'readwrite');
        tx.objectStore(CACHE_STORE).put({ bookId, locations, cachedAt: Date.now() });
    } catch {
        // Non-critical — silently ignore
    }
}

export async function clearCachedLocations(bookId) {
    try {
        const db = await openCacheDB();
        const tx = db.transaction(CACHE_STORE, 'readwrite');
        tx.objectStore(CACHE_STORE).delete(bookId);
    } catch {}
}
