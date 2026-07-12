const { app, BrowserWindow, ipcMain, dialog, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');
const { execSync } = require('child_process');
const JSZip = require('jszip');
const { autoUpdater } = require('electron-updater');

// ── Perf flags (set before app.ready) ────────────────────────────────────────
// Enable GPU rasterization for smoother UI compositing
app.commandLine.appendSwitch('enable-gpu-rasterization');
// Prefer integrated GPU for battery; remove this line if you want discrete GPU
// app.commandLine.appendSwitch('force_low_power_gpu');
// Use V8 code cache to speed up repeated JS parsing
app.commandLine.appendSwitch('js-flags', '--harmony');
// ─────────────────────────────────────────────────────────────────────────────

let mainWindow = null;
const folderImportSessions = new Map();
const IMPORT_BATCH_SIZE = 12;
const CATALOG_MAX_BYTES = 2 * 1024 * 1024;
const BOOK_DOWNLOAD_MAX_BYTES = 250 * 1024 * 1024;
const EXTERNAL_FETCH_TIMEOUT_MS = 15000;

// Extraer ruta de archivo epub/pdf de los argumentos
function getFileFromArgs(argv) {
    return argv.slice(1).find(a => /\.(epub|pdf)$/i.test(a)) || null;
}

// Single-instance: si ya hay una ventana abierta, enfócarla y enviarle el archivo
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', (_event, argv) => {
        const filePath = getFileFromArgs(argv);
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            if (filePath) mainWindow.webContents.send('open-file', filePath);
        }
    });
}

const isDev = process.env.VITE_DEV === '1';

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'icon_build.ico'),
        backgroundColor: '#0f172a', // paint background before renderer loads (reduces white flash)
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false,   // keep timers/RAF accurate when window is hidden
            v8CacheOptions: 'bypassHeatCheck', // cache V8 bytecode from first run
        }
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist-renderer', 'index.html'));
    }

    // Enviar archivo al renderer cuando esté listo
    const startFile = getFileFromArgs(process.argv);
    if (startFile) {
        mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('open-file', startFile);
        });
    }

    mainWindow.on('closed', () => { mainWindow = null; });
}

function notifyRenderer(channel, payload) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(channel, payload);
}

// Seleccionar carpeta de sincronización
const BOOK_EXTENSIONS = new Set(['.epub', '.pdf']);

function isBookPath(filePath) {
    return BOOK_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isSafeHttpUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function isPrivateHostname(hostname) {
    const normalized = String(hostname || '').toLowerCase();
    return normalized === 'localhost' || normalized.endsWith('.localhost');
}

function isPrivateIp(address) {
    if (!address) return true;
    if (address === '::1' || address.startsWith('fe80:')) return true;
    if (address.startsWith('::ffff:')) return isPrivateIp(address.slice(7));

    if (net.isIP(address) === 4) {
        const parts = address.split('.').map(Number);
        const [a, b] = parts;
        return (
            a === 10 ||
            a === 127 ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 169 && b === 254) ||
            a === 0
        );
    }

    return net.isIP(address) === 6 && (
        address === '::' ||
        address.startsWith('fc') ||
        address.startsWith('fd')
    );
}

async function assertNetworkTargetAllowed(url, allowPrivateNetwork = false) {
    const parsed = new URL(url);
    if (allowPrivateNetwork) return;
    if (isPrivateHostname(parsed.hostname) || isPrivateIp(parsed.hostname)) {
        throw new Error('Fuente de red local bloqueada. Activa acceso local solo para fuentes propias.');
    }

    const addresses = await dns.promises.lookup(parsed.hostname, { all: true, verbatim: true });
    if (addresses.some(entry => isPrivateIp(entry.address))) {
        throw new Error('Fuente bloqueada: resuelve a una red privada/local.');
    }
}

function resolveExternalUrl(baseUrl, href) {
    try {
        return new URL(href, baseUrl).toString();
    } catch {
        return null;
    }
}

async function fetchBuffer(url, { maxBytes, timeoutMs = EXTERNAL_FETCH_TIMEOUT_MS, redirects = 0, allowPrivateNetwork = false } = {}) {
    await assertNetworkTargetAllowed(url, allowPrivateNetwork);
    return new Promise((resolve, reject) => {
        if (!isSafeHttpUrl(url)) {
            reject(new Error('URL no permitida'));
            return;
        }

        const parsed = new URL(url);
        const client = parsed.protocol === 'https:' ? https : http;
        const req = client.get(parsed, {
            timeout: timeoutMs,
            headers: {
                'User-Agent': 'SharkReader/2.5',
                'Accept': 'application/atom+xml,application/xml,text/xml,application/epub+zip,application/pdf,*/*;q=0.8',
            },
        }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 4) {
                res.resume();
                const nextUrl = resolveExternalUrl(url, res.headers.location);
                if (!nextUrl) {
                    reject(new Error('Redireccion invalida'));
                    return;
                }
                fetchBuffer(nextUrl, { maxBytes, timeoutMs, redirects: redirects + 1, allowPrivateNetwork }).then(resolve, reject);
                return;
            }

            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode || 'desconocido'}`));
                return;
            }

            const chunks = [];
            let total = 0;
            res.on('data', chunk => {
                total += chunk.length;
                if (total > maxBytes) {
                    req.destroy(new Error('Respuesta demasiado grande'));
                    return;
                }
                chunks.push(chunk);
            });
            res.on('end', () => resolve({
                buffer: Buffer.concat(chunks),
                contentType: String(res.headers['content-type'] || ''),
                finalUrl: url,
            }));
        });

        req.on('timeout', () => req.destroy(new Error('Tiempo de espera agotado')));
        req.on('error', reject);
    });
}

function detectBookExtFromBuffer(buffer, contentType = '', sourceUrl = '') {
    const header = buffer.subarray(0, 160).toString('latin1');
    if (header.startsWith('%PDF')) return '.pdf';
    if (header.startsWith('PK')) return '.epub';
    const extFromUrl = path.extname(new URL(sourceUrl).pathname).toLowerCase();
    if (BOOK_EXTENSIONS.has(extFromUrl)) return extFromUrl;
    if (/pdf/i.test(contentType)) return '.pdf';
    if (/epub|zip/i.test(contentType)) return '.epub';
    return null;
}

function decodeXmlEntities(value = '') {
    return String(value)
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .trim();
}

function getXmlTag(xml, tagName) {
    const match = new RegExp(`<(?:\\w+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`, 'i').exec(xml);
    return match ? decodeXmlEntities(match[1].replace(/<[^>]+>/g, ' ')) : '';
}

function parseXmlAttrs(tag) {
    const attrs = {};
    const attrRegex = /([\w:-]+)\s*=\s*["']([^"']*)["']/g;
    let match;
    while ((match = attrRegex.exec(tag))) {
        attrs[match[1]] = decodeXmlEntities(match[2]);
    }
    return attrs;
}

function parseOpdsCatalog(xml, sourceUrl) {
    const catalogTitle = getXmlTag(xml, 'title') || 'Catalogo OPDS';
    const entries = [];
    const navigation = [];
    const entryRegex = /<(?:\w+:)?entry\b[^>]*>([\s\S]*?)<\/(?:\w+:)?entry>/gi;
    let entryMatch;

    while ((entryMatch = entryRegex.exec(xml))) {
        const entryXml = entryMatch[1];
        const title = getXmlTag(entryXml, 'title') || 'Sin titulo';
        const author = getXmlTag(entryXml, 'name');
        const summary = getXmlTag(entryXml, 'summary') || getXmlTag(entryXml, 'content');
        const links = [];
        const linkRegex = /<(?:\w+:)?link\b[^>]*\/?>/gi;
        let linkMatch;

        while ((linkMatch = linkRegex.exec(entryXml))) {
            const attrs = parseXmlAttrs(linkMatch[0]);
            if (!attrs.href) continue;
            const href = resolveExternalUrl(sourceUrl, attrs.href);
            if (!href) continue;
            links.push({
                href,
                rel: attrs.rel || '',
                type: attrs.type || '',
                title: attrs.title || '',
            });
        }

        const acquisition = links.find(link =>
            /acquisition|open-access/i.test(link.rel) ||
            /epub|pdf/i.test(link.type) ||
            /\.(epub|pdf)(?:$|[?#])/i.test(link.href)
        );
        const nav = links.find(link =>
            /subsection|collection|start|alternate/i.test(link.rel) &&
            !/acquisition/i.test(link.rel)
        );
        const image = links.find(link => /image/i.test(link.type) || /cover|thumbnail/i.test(link.rel));

        if (acquisition) {
            entries.push({
                id: acquisition.href,
                title,
                author,
                summary,
                downloadUrl: acquisition.href,
                format: acquisition.type || path.extname(new URL(acquisition.href).pathname).replace('.', ''),
                coverUrl: image?.href || null,
            });
        } else if (nav) {
            navigation.push({
                id: nav.href,
                title,
                url: nav.href,
                type: nav.type || 'application/atom+xml',
            });
        }
    }

    return { title: catalogTitle, entries, navigation, sourceUrl };
}

function walkBookFiles(dirPath) {
    const found = [];
    const stack = [dirPath];

    while (stack.length) {
        const current = stack.pop();
        let entries = [];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch (_) {
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) stack.push(fullPath);
            else if (entry.isFile() && isBookPath(fullPath)) found.push(fullPath);
        }
    }

    return found;
}

async function extractEpubMeta(buffer, filePath = 'unknown') {
    try {
        const zip = await JSZip.loadAsync(buffer);

        let opfPath = null;
        const containerKey = Object.keys(zip.files).find(k => k.toLowerCase() === 'meta-inf/container.xml');
        if (containerKey) {
            const containerStr = await zip.files[containerKey].async('string');
            const match = containerStr.match(/full-path\s*=\s*["']([^"']+)["']/i);
            if (match) opfPath = match[1];
        }

        if (!opfPath) {
            opfPath = Object.keys(zip.files).find(k => k.toLowerCase().endsWith('.opf'));
        }
        if (!opfPath) return null;

        const opfFile = zip.file(opfPath) || Object.values(zip.files).find(f => f.name.toLowerCase() === opfPath.toLowerCase());
        if (!opfFile) return null;
        const opfStr = await opfFile.async('string');

        const findTag = (tag) => {
            const regex = new RegExp(`<[^:>]*:?${tag}[^>]*>([\\s\\S]*?)</[^:>]*:?${tag}>`, 'i');
            const match = opfStr.match(regex);
            return match
                ? match[1]
                    .replace(/<!\[CDATA\[|\]\]>/g, '')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&apos;/g, "'")
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .trim()
                : '';
        };

        const getAttr = (xml, attr) => {
            const match = xml.match(new RegExp(`\\s${attr}\\s*=\\s*["']([^"']+)["']`, 'i'));
            return match ? match[1] : '';
        };

        const title = findTag('title');
        const creator = findTag('creator');
        const description = findTag('description');
        const publisher = findTag('publisher');
        const subject = findTag('subject');

        const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
        const items = [];
        const itemRegex = /<item\b[^>]*>/gi;
        let itemMatch;
        while ((itemMatch = itemRegex.exec(opfStr))) {
            const xml = itemMatch[0];
            const href = getAttr(xml, 'href');
            const mediaType = getAttr(xml, 'media-type');
            if (!href) continue;
            items.push({
                id: getAttr(xml, 'id'),
                href,
                mediaType,
                properties: getAttr(xml, 'properties'),
            });
        }

        let coverHref = null;

        const coverImage = items.find(item =>
            item.mediaType?.startsWith('image/') &&
            /\bcover-image\b/i.test(item.properties || '')
        );
        if (coverImage) coverHref = coverImage.href;

        if (!coverHref) {
            const metaRegex = /<meta\b[^>]*>/gi;
            let metaMatch;
            while ((metaMatch = metaRegex.exec(opfStr))) {
                const xml = metaMatch[0];
                if (getAttr(xml, 'name').toLowerCase() === 'cover') {
                    const coverId = getAttr(xml, 'content');
                    const coverItem = items.find(item => item.id === coverId);
                    if (coverItem?.mediaType?.startsWith('image/')) {
                        coverHref = coverItem.href;
                        break;
                    }
                }
            }
        }

        if (!coverHref) {
            const hinted = items.find(item => {
                const hint = `${item.id || ''} ${item.href || ''}`.toLowerCase();
                return item.mediaType?.startsWith('image/') && /(cover|portada|front|titlepage)/i.test(hint);
            });
            if (hinted) coverHref = hinted.href;
        }

        if (!coverHref) {
            const firstImage = items.find(item => item.mediaType?.startsWith('image/'));
            if (firstImage) coverHref = firstImage.href;
        }

        let coverBase64 = null;
        if (coverHref) {
            let cleanHref = decodeURIComponent(coverHref.replace(/&amp;/g, '&')).split('#')[0].split('?')[0];
            let fullPath = cleanHref.startsWith('/') ? cleanHref.slice(1) : (opfDir + cleanHref);

            const parts = [];
            for (const p of fullPath.split('/')) {
                if (p === '..') parts.pop();
                else if (p && p !== '.') parts.push(p);
            }
            fullPath = parts.join('/');

            const coverFile = zip.file(fullPath) || Object.values(zip.files).find(f => f.name.toLowerCase() === fullPath.toLowerCase());
            if (coverFile) {
                const data = await coverFile.async('base64');
                const ext = fullPath.split('.').pop().toLowerCase();
                const mime = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', gif:'image/gif', svg:'image/svg+xml' }[ext] || 'image/jpeg';
                coverBase64 = `data:${mime};base64,${data}`;
            }
        }

        return { title, creator, description, publisher, subject, coverBase64 };
    } catch (e) {
        console.error(`[SharkReader] Native extract failed for ${filePath}:`, e);
        return null;
    }
}

async function readBookPayload(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            console.error(`[SharkReader] Archivo no existe: ${filePath}`);
            return null;
        }
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
            console.error(`[SharkReader] Archivo vacío (0 bytes): ${filePath}`);
            return null;
        }

        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let meta = null;
        if (ext === '.epub') {
            // Verificación básica de cabecera ZIP (PK\x03\x04)
            const isZip = data.length >= 4 && 
                          data[0] === 0x50 && data[1] === 0x4B && 
                          data[2] === 0x03 && data[3] === 0x04;

            if (!isZip) {
                console.error(`[SharkReader] El archivo EPUB no es un ZIP válido (cabecera incorrecta): ${filePath}`);
            } else {
                try {
                    meta = await extractEpubMeta(data, filePath);
                } catch (err) {
                    console.error(`[SharkReader] Error en metadata para ${filePath}:`, err);
                }
            }
        }

        return {
            name: path.basename(filePath),
            path: filePath,
            type: ext === '.pdf' ? 'application/pdf' : 'application/epub+zip',
            lastModified: stats.mtimeMs,
            dataBase64: data.toString('base64'),
            meta
        };
    } catch (err) {
        console.error(`[SharkReader] readBookPayload falló para ${filePath}:`, err);
        throw err;
    }
}

function createBookImportStub(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    let lastModified = Date.now();
    try {
        lastModified = fs.statSync(filePath).mtimeMs;
    } catch (_) {}

    return {
        name: path.basename(filePath),
        path: filePath,
        type: ext === '.pdf' ? 'application/pdf' : 'application/epub+zip',
        lastModified,
    };
}

function readBookPayloads(filePaths) {
    return Promise.all(filePaths
        .filter(isBookPath)
        .map(async filePath => {
            try {
                return await readBookPayload(filePath);
            } catch (err) {
                console.error('[SharkReader] No se pudo leer libro:', filePath, err);
                return null;
            }
        })
    ).then(res => res.filter(Boolean));
}

async function scanBookFiles(sessionId, rootPath) {
    const session = folderImportSessions.get(sessionId);
    if (!session) return [];

    const found = [];
    const stack = [rootPath];
    let lastEmitAt = 0;

    while (stack.length) {
        if (session.cancelled) break;

        const current = stack.pop();
        let entries = [];
        try {
            entries = await fs.promises.readdir(current, { withFileTypes: true });
        } catch (_) {
            continue;
        }

        for (const entry of entries) {
            if (session.cancelled) break;

            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }

            if (entry.isFile() && isBookPath(fullPath)) {
                found.push(fullPath);
                session.discovered = found.length;

                const now = Date.now();
                if (now - lastEmitAt > 80) {
                    notifyRenderer('folder-import-progress', {
                        sessionId,
                        phase: 'scanning',
                        discovered: session.discovered,
                        total: 0,
                        imported: 0,
                        currentName: entry.name,
                    });
                    lastEmitAt = now;
                }
            }
        }

        await new Promise(resolve => setTimeout(resolve, 0));
    }

    return found;
}

async function runFolderImportSession(sessionId, rootPath) {
    const session = folderImportSessions.get(sessionId);
    if (!session) return;

    try {
        notifyRenderer('folder-import-progress', {
            sessionId,
            phase: 'scanning',
            discovered: 0,
            total: 0,
            imported: 0,
            currentName: path.basename(rootPath),
        });

        const paths = await scanBookFiles(sessionId, rootPath);
        const total = paths.length;
        session.total = total;

        if (session.cancelled) {
            notifyRenderer('folder-import-done', { sessionId, cancelled: true, total, imported: session.imported });
            return;
        }

        notifyRenderer('folder-import-progress', {
            sessionId,
            phase: 'importing',
            discovered: total,
            total,
            imported: 0,
            currentName: total ? path.basename(paths[0]) : '',
        });

        for (let i = 0; i < paths.length; i += IMPORT_BATCH_SIZE) {
            if (session.cancelled) break;

            const batchPaths = paths.slice(i, i + IMPORT_BATCH_SIZE);
            const batch = batchPaths.map(createBookImportStub);

            session.imported += batch.length;

            notifyRenderer('folder-import-batch', {
                sessionId,
                batch,
            });

            notifyRenderer('folder-import-progress', {
                sessionId,
                phase: 'importing',
                discovered: total,
                total,
                imported: session.imported,
                currentName: path.basename(batchPaths[batchPaths.length - 1] || ''),
            });

            await new Promise(resolve => setTimeout(resolve, 0));
        }

        notifyRenderer('folder-import-done', {
            sessionId,
            cancelled: session.cancelled,
            total,
            imported: session.imported,
        });
    } catch (err) {
        notifyRenderer('folder-import-done', {
            sessionId,
            cancelled: false,
            total: session.total || 0,
            imported: session.imported || 0,
            error: err.message,
        });
    } finally {
        setTimeout(() => {
            folderImportSessions.delete(sessionId);
        }, 60000);
    }
}

ipcMain.handle('pick-book-files', async () => {
    if (!mainWindow) return [];
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Libros', extensions: ['epub', 'pdf'] }],
        title: 'Añadir libros'
    });
    if (result.canceled) return [];
    return readBookPayloads(result.filePaths);
});

ipcMain.handle('pick-book-folder', async () => {
    if (!mainWindow) return [];
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Añadir carpeta de libros'
    });
    if (result.canceled || !result.filePaths[0]) return [];
    return await readBookPayloads(walkBookFiles(result.filePaths[0]));
});

ipcMain.handle('start-folder-import', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'AÃ±adir carpeta de libros'
    });
    if (result.canceled || !result.filePaths[0]) return null;

    const rootPath = result.filePaths[0];
    const sessionId = `folder-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    folderImportSessions.set(sessionId, {
        sessionId,
        rootPath,
        cancelled: false,
        discovered: 0,
        imported: 0,
        total: 0,
    });

    setTimeout(() => {
        runFolderImportSession(sessionId, rootPath).catch((err) => {
            notifyRenderer('folder-import-done', {
                sessionId,
                cancelled: false,
                total: 0,
                imported: 0,
                error: err.message,
            });
        });
    }, 0);

    return {
        sessionId,
        folderName: path.basename(rootPath),
    };
});

ipcMain.handle('start-folder-import-path', async (_e, rootPath) => {
    if (!mainWindow || !rootPath) return null;
    try {
        const stats = fs.statSync(rootPath);
        if (!stats.isDirectory()) return null;
    } catch {
        return null;
    }

    const sessionId = `folder-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    folderImportSessions.set(sessionId, {
        sessionId,
        rootPath,
        cancelled: false,
        discovered: 0,
        imported: 0,
        total: 0,
    });

    setTimeout(() => {
        runFolderImportSession(sessionId, rootPath).catch((err) => {
            notifyRenderer('folder-import-done', {
                sessionId,
                cancelled: false,
                total: 0,
                imported: 0,
                error: err.message,
            });
        });
    }, 0);

    return {
        sessionId,
        folderName: path.basename(rootPath),
    };
});

ipcMain.handle('cancel-folder-import', async (_e, sessionId) => {
    const session = folderImportSessions.get(sessionId);
    if (session) session.cancelled = true;
    return { ok: true };
});

ipcMain.handle('read-book-file', async (_e, filePath) => {
    if (!filePath || !isBookPath(filePath)) return null;
    try {
        return await readBookPayload(filePath);
    } catch (err) {
        console.error('[SharkReader] No se pudo abrir libro desde ruta:', filePath, err);
        return null;
    }
});

ipcMain.handle('fetch-external-catalog', async (_e, sourceUrl, options = {}) => {
    try {
        if (!isSafeHttpUrl(sourceUrl)) return { ok: false, msg: 'URL no permitida' };
        const { buffer, contentType, finalUrl } = await fetchBuffer(sourceUrl, {
            maxBytes: CATALOG_MAX_BYTES,
            timeoutMs: EXTERNAL_FETCH_TIMEOUT_MS,
            allowPrivateNetwork: !!options.allowPrivateNetwork,
        });
        if (!/xml|atom|opds|text/i.test(contentType) && !/<(?:\w+:)?feed\b/i.test(buffer.toString('utf8', 0, Math.min(buffer.length, 512)))) {
            return { ok: false, msg: 'La fuente no parece ser un catalogo OPDS/XML' };
        }
        return { ok: true, catalog: parseOpdsCatalog(buffer.toString('utf8'), finalUrl) };
    } catch (err) {
        return { ok: false, msg: err.message };
    }
});

ipcMain.handle('download-external-book', async (_e, downloadUrl, fallbackName = 'book', options = {}) => {
    try {
        if (!isSafeHttpUrl(downloadUrl)) return { ok: false, msg: 'URL no permitida' };
        const { buffer, contentType, finalUrl } = await fetchBuffer(downloadUrl, {
            maxBytes: BOOK_DOWNLOAD_MAX_BYTES,
            timeoutMs: 30000,
            allowPrivateNetwork: !!options.allowPrivateNetwork,
        });
        const parsed = new URL(finalUrl);
        const ext = detectBookExtFromBuffer(buffer, contentType, finalUrl);
        if (!ext) {
            return { ok: false, msg: 'La descarga no parece ser un EPUB o PDF valido.' };
        }
        const safeBase = String(fallbackName || path.basename(parsed.pathname) || 'book')
            .replace(/\.[^/.]+$/, '')
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
            .slice(0, 120) || 'book';
        return {
            ok: true,
            payload: {
                name: `${safeBase}${ext}`,
                path: finalUrl,
                type: ext === '.pdf' ? 'application/pdf' : 'application/epub+zip',
                lastModified: Date.now(),
                dataBase64: buffer.toString('base64'),
                meta: null,
            },
        };
    } catch (err) {
        return { ok: false, msg: err.message };
    }
});

ipcMain.handle('pick-folder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Carpeta de sincronización de progreso'
    });
    return result.canceled ? null : result.filePaths[0];
});

// Escribir archivo de sync
ipcMain.handle('write-sync-file', async (_e, folderPath, content) => {
    try {
        fs.writeFileSync(path.join(folderPath, 'sharkreader_sync.json'), content, 'utf-8');
        return { ok: true };
    } catch (err) {
        return { ok: false, msg: err.message };
    }
});

// Leer archivo de sync
ipcMain.handle('read-sync-file', async (_e, folderPath) => {
    try {
        const content = fs.readFileSync(path.join(folderPath, 'sharkreader_sync.json'), 'utf-8');
        return { ok: true, content };
    } catch {
        return { ok: false };
    }
});

// ── Sync WebDAV (Nextcloud, ownCloud o cualquier servidor WebDAV propio) ────
// Alternativa a la carpeta local para quien no quiere depender de OneDrive/
// Dropbox. allowPrivateNetwork siempre true aquí: es un servidor que el propio
// usuario escribe en Ajustes (a menudo autoalojado en su LAN), mismo nivel de
// confianza que ya se le da a la carpeta de sync local con acceso a disco.
const WEBDAV_SYNC_FILENAME = 'sharkreader_sync.json';

async function getWebdavClient(config) {
    const { createClient } = await import('webdav');
    return createClient(config.url, {
        username: config.username || undefined,
        password: config.password || undefined,
    });
}

ipcMain.handle('webdav-test-connection', async (_e, config) => {
    try {
        if (!config?.url || !isSafeHttpUrl(config.url)) return { ok: false, msg: 'URL no válida' };
        await assertNetworkTargetAllowed(config.url, true);
        const client = await getWebdavClient(config);
        await client.getDirectoryContents('/');
        return { ok: true };
    } catch (err) {
        return { ok: false, msg: err?.message || 'No se pudo conectar al servidor' };
    }
});

ipcMain.handle('webdav-write-sync-file', async (_e, config, content) => {
    try {
        if (!config?.url || !isSafeHttpUrl(config.url)) return { ok: false, msg: 'URL no válida' };
        await assertNetworkTargetAllowed(config.url, true);
        const client = await getWebdavClient(config);
        await client.putFileContents(WEBDAV_SYNC_FILENAME, content, { overwrite: true });
        return { ok: true };
    } catch (err) {
        return { ok: false, msg: err?.message || 'No se pudo escribir en el servidor' };
    }
});

ipcMain.handle('webdav-read-sync-file', async (_e, config) => {
    try {
        if (!config?.url || !isSafeHttpUrl(config.url)) return { ok: false };
        await assertNetworkTargetAllowed(config.url, true);
        const client = await getWebdavClient(config);
        const exists = await client.exists(WEBDAV_SYNC_FILENAME);
        if (!exists) return { ok: false };
        const content = await client.getFileContents(WEBDAV_SYNC_FILENAME, { format: 'text' });
        return { ok: true, content };
    } catch (err) {
        return { ok: false, msg: err?.message };
    }
});

// Registrar asociaciones de archivo en Windows (requiere permisos de admin)
ipcMain.handle('register-file-associations', async () => {
    if (process.platform !== 'win32') return { ok: false, msg: 'Solo disponible en Windows' };

    const exePath = process.execPath.replace(/\\/g, '\\\\');
    const appDir = __dirname.replace(/\\/g, '\\\\');
    // El comando que Windows usará para abrir el archivo:
    // electron.exe "ruta/al/proyecto" "%1"
    const openCmd = app.isPackaged
        ? `\\"${exePath}\\" \\"%1\\"`
        : `\\"${exePath}\\" \\"${appDir}\\" \\"%1\\"`;

    const formats = [
        { ext: '.epub', progId: 'SharkReader.epub', desc: 'EPUB Document', contentType: 'application/epub+zip' },
        { ext: '.pdf', progId: 'SharkReader.pdf', desc: 'PDF Document', contentType: 'application/pdf' },
    ];

    try {
        for (const fmt of formats) {
            // Asociar extensión al ProgId
            execSync(`reg add "HKCU\\Software\\Classes\\${fmt.ext}" /ve /d "${fmt.progId}" /f`);
            execSync(`reg add "HKCU\\Software\\Classes\\${fmt.ext}" /v "Content Type" /d "${fmt.contentType}" /f`);

            // Registrar ProgId
            execSync(`reg add "HKCU\\Software\\Classes\\${fmt.progId}" /ve /d "${fmt.desc} — Shark Reader" /f`);

            // Ícono
            execSync(`reg add "HKCU\\Software\\Classes\\${fmt.progId}\\DefaultIcon" /ve /d "${exePath},0" /f`);

            // Comando de apertura
            execSync(`reg add "HKCU\\Software\\Classes\\${fmt.progId}\\shell\\open\\command" /ve /d "${openCmd}" /f`);
        }

        // Notificar a Explorer para que refresque los iconos
        execSync('ie4uinit.exe -show', { stdio: 'ignore' });

        return { ok: true, msg: 'Asociaciones registradas correctamente' };
    } catch (err) {
        return { ok: false, msg: err.message };
    }
});

ipcMain.handle('remove-file-associations', async () => {
    if (process.platform !== 'win32') return { ok: false };
    try {
        [
            'SharkReader.epub',
            'SharkReader.pdf',
            '.epub',
            '.pdf',
        ].forEach(key => {
            try {
                execSync(`reg delete "HKCU\\Software\\Classes\\${key}" /f`);
            } catch (_) {}
        });
        try { execSync('ie4uinit.exe -show', { stdio: 'ignore' }); } catch (_) {}
        return { ok: true };
    } catch (err) {
        return { ok: false, msg: err.message };
    }
});

ipcMain.handle('app-version', () => app.getVersion());

// ── OpenLibrary metadata fetch ────────────────────────────────────────────────
// Busca metadata de un libro por título+autor en la API pública de OpenLibrary.
// Devuelve { coverUrl, description, year, isbn } o null si no encuentra nada.
//
// Nota: la versión previa apuntaba a "opds.openlibrary.org", un subdominio que
// nunca resuelve por DNS (ni siquiera existe) — la función fallaba siempre, con
// cualquier libro, silenciosamente (try/catch → null). El endpoint real y
// documentado es openlibrary.org/search.json.
ipcMain.handle('fetch-openlibrary', async (_e, { title, author }) => {
    if (!title) return null;
    try {
        const q = encodeURIComponent(`${title} ${author || ''}`.trim().slice(0, 120));
        const fields = 'title,author_name,first_publish_year,cover_i,isbn,key';
        const searchUrl = `https://openlibrary.org/search.json?q=${q}&fields=${fields}&limit=1`;
        const { buffer } = await fetchBuffer(searchUrl, { maxBytes: 512 * 1024 });
        const data = JSON.parse(buffer.toString('utf8'));
        const doc = data?.docs?.[0];
        if (!doc) return null;

        // Segunda llamada opcional: la sinopsis solo vive en el detalle del "work"
        let description = null;
        if (doc.key) {
            try {
                const { buffer: detailBuf } = await fetchBuffer(`https://openlibrary.org${doc.key}.json`, { maxBytes: 256 * 1024 });
                const detail = JSON.parse(detailBuf.toString('utf8'));
                description = typeof detail.description === 'string'
                    ? detail.description
                    : detail.description?.value || null;
            } catch (_) { /* la sinopsis es opcional; seguir sin ella */ }
        }

        const year = doc.first_publish_year || null;
        const isbn = doc.isbn?.[0] || null;
        const coverUrl = doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
            : isbn
                ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
                : null;
        return { coverUrl, description: description?.slice(0, 2000) || null, year, isbn };
    } catch (_) {
        return null;
    }
});

// ── Auto-updater (electron-updater + GitHub releases) ─────────────────────────
function sendUpdateStatus(status, info) {
    notifyRenderer('update-status', { status, info: info || null });
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking'));
autoUpdater.on('update-available', (info) => sendUpdateStatus('available', { version: info?.version }));
autoUpdater.on('update-not-available', () => sendUpdateStatus('not-available'));
autoUpdater.on('download-progress', (p) => sendUpdateStatus('downloading', { percent: p?.percent }));
autoUpdater.on('update-downloaded', (info) => sendUpdateStatus('downloaded', { version: info?.version }));
autoUpdater.on('error', (err) => sendUpdateStatus('error', { message: String(err?.message || err) }));

ipcMain.handle('check-for-updates', async () => {
    if (isDev) { sendUpdateStatus('not-available'); return { ok: false, dev: true }; }
    try {
        await autoUpdater.checkForUpdates();
        return { ok: true };
    } catch (err) {
        sendUpdateStatus('error', { message: String(err?.message || err) });
        return { ok: false, msg: String(err?.message || err) };
    }
});

ipcMain.handle('quit-and-install-update', () => {
    try { autoUpdater.quitAndInstall(); return { ok: true }; }
    catch (err) { return { ok: false, msg: String(err?.message || err) }; }
});

// ── TTS neuronal (Edge Read Aloud API vía msedge-tts) ────────────────────────
// Reutiliza la instancia mientras no cambie la voz (mantiene el websocket vivo).
let edgeTts = null;
let edgeTtsVoice = null;

ipcMain.handle('tts-synthesize', async (_e, payload) => {
    const text = String(payload?.text || '').slice(0, 8000).trim();
    const voice = String(payload?.voice || 'es-ES-ElviraNeural');
    const rate = String(payload?.rate || '+0%');
    if (!text) return null;
    try {
        const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
        if (!edgeTts || edgeTtsVoice !== voice) {
            edgeTts = new MsEdgeTTS();
            await edgeTts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
            edgeTtsVoice = voice;
        }
        const { audioStream } = edgeTts.toStream(text, { rate });
        const chunks = [];
        return await new Promise((resolve) => {
            audioStream.on('data', (chunk) => chunks.push(chunk));
            audioStream.on('end', () => resolve(Buffer.concat(chunks)));
            audioStream.on('error', () => { edgeTts = null; edgeTtsVoice = null; resolve(null); });
        });
    } catch (err) {
        edgeTts = null;
        edgeTtsVoice = null;
        return null;
    }
});

// ── System tray ──────────────────────────────────────────────────────────────
let tray = null;
let trayLastBook = null;

function focusMainWindow() {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
}

function buildTrayMenu() {
    return Menu.buildFromTemplate([
        { label: 'Abrir SharkReader', click: focusMainWindow },
        ...(trayLastBook ? [{
            label: `📖 Continuar: ${trayLastBook.slice(0, 42)}${trayLastBook.length > 42 ? '…' : ''}`,
            click: () => {
                focusMainWindow();
                if (mainWindow) mainWindow.webContents.send('tray-continue-reading');
            },
        }] : []),
        { type: 'separator' },
        { label: 'Salir', click: () => app.quit() },
    ]);
}

function createTray() {
    try {
        tray = new Tray(path.join(__dirname, 'icon_build.ico'));
        tray.setToolTip('SharkReader');
        tray.setContextMenu(buildTrayMenu());
        tray.on('double-click', focusMainWindow);
    } catch (err) {
        console.warn('[SharkReader] No se pudo crear el tray:', err);
    }
}

ipcMain.on('update-tray-info', (_e, payload) => {
    trayLastBook = payload?.lastBookName || null;
    if (tray) tray.setContextMenu(buildTrayMenu());
});

app.whenReady().then(() => {
    createWindow();
    createTray();
    // Comprobación silenciosa al arrancar (solo en producción, no bloquea el inicio)
    if (!isDev) {
        setTimeout(() => { autoUpdater.checkForUpdates().catch(() => {}); }, 4000);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
